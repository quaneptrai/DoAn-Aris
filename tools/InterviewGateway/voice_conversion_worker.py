"""Local, offline tone conversion for an already speaking interview clip.

The operator provisions Python packages, model checkpoints and authorised reference
WAVs first. This executable has no download, network, TTS, ASR or VAD step. Conversion
uses the original speech rhythm; the gateway checks timing again before remuxing.
"""
from __future__ import annotations

import argparse
import contextlib
import importlib
import json
import math
import re
import sys
from pathlib import Path


class NotReady(Exception):
    pass


def local_path(value: object, folder: Path) -> Path:
    if not isinstance(value, str) or not value.strip() or "://" in value:
        raise NotReady()
    path = Path(value).expanduser()
    return (path if path.is_absolute() else folder / path).resolve()


def load_settings(file: str) -> dict:
    config_file = Path(file).resolve()
    with config_file.open("r", encoding="utf-8-sig") as source:
        config = json.load(source)
    if not isinstance(config, dict):
        raise NotReady()
    folder = config_file.parent
    model_dir = local_path(config.get("modelDir"), folder)
    for file_name in ("config.json", "checkpoint.pth"):
        if not (model_dir / file_name).is_file():
            raise NotReady()
    device = config.get("device", "auto")
    if device not in ("auto", "cuda", "cpu"):
        raise NotReady()
    drift = config.get("maxDurationDriftMs", 80)
    if not isinstance(drift, (int, float)) or not math.isfinite(drift) or not 0 <= drift <= 80:
        raise NotReady()
    voices = {}
    for voice_id, details in (config.get("voices") or {}).items():
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", voice_id) or not isinstance(details, dict):
            continue
        name = details.get("name", voice_id)
        if not isinstance(name, str) or not 1 <= len(name) <= 80 or re.search(r"[\\/:<>]", name):
            continue
        try:
            reference = local_path(details.get("referencePath"), folder)
            if reference.is_file():
                voices[voice_id] = {"name": name, "reference": reference}
        except NotReady:
            continue
    if not voices:
        raise NotReady()
    return {"model_dir": model_dir, "device": device, "drift": drift, "voices": voices}


def load_libraries():
    # The official API also imports its text helpers. Missing optional dependencies
    # are treated as unavailable, never installed automatically by this worker.
    torch = importlib.import_module("torch")
    np = importlib.import_module("numpy")
    sf = importlib.import_module("soundfile")
    importlib.import_module("librosa")
    api = importlib.import_module("openvoice.api")

    class OfflineToneConverter(api.ToneColorConverter):
        def __init__(self, config_path, device="cpu"):
            # Pinned upstream forwards enable_watermark to a base constructor
            # that rejects that keyword. Its default also downloads watermark
            # weights. Initialize the same official converter model directly,
            # with the optional watermark path disabled, and keep all official
            # extract_se/convert methods unchanged.
            api.OpenVoiceBaseClass.__init__(self, config_path, device=device)
            self.watermark_model = None
            self.version = getattr(self.hps, "_version_", "v1")

    return torch, np, sf, OfflineToneConverter


def audio_info(file: Path, np, sf, *, reference: bool = False) -> tuple[float, int]:
    samples, sample_rate = sf.read(str(file), dtype="float32", always_2d=True)
    duration = len(samples) / sample_rate
    if sample_rate < 8000 or samples.shape[1] < 1 or not np.isfinite(samples).all():
        raise NotReady()
    if not 0.25 <= duration <= 120 or (reference and duration < 1):
        raise NotReady()
    if float(np.mean(samples * samples)) < 1e-7:
        raise NotReady()
    return duration, sample_rate


def converter_for(settings: dict, torch, converter_type):
    requested = settings["device"]
    if requested == "cuda" and not torch.cuda.is_available():
        raise NotReady()
    device = "cuda:0" if requested == "cuda" or (requested == "auto" and torch.cuda.is_available()) else "cpu"
    model_dir = settings["model_dir"]
    converter = converter_type(str(model_dir / "config.json"), device=device)
    converter.load_ckpt(str(model_dir / "checkpoint.pth"))
    return converter


def ready_voices(settings: dict, converter, np, sf, torch) -> list[dict]:
    voices = []
    for voice_id, details in settings["voices"].items():
        try:
            audio_info(details["reference"], np, sf, reference=True)
            with torch.inference_mode():
                embedding = converter.extract_se(str(details["reference"]))
            if not bool(torch.isfinite(embedding).all()):
                continue
            voices.append({"id": voice_id, "name": details["name"]})
        except Exception:
            continue
    return voices


def execute(args) -> dict:
    settings = load_settings(args.config)
    torch, np, sf, converter_type = load_libraries()
    converter = converter_for(settings, torch, converter_type)
    if args.health:
        voices = ready_voices(settings, converter, np, sf, torch)
        return {"ready": bool(voices), "voices": voices}
    if args.voice not in settings["voices"]:
        raise NotReady()
    source = local_path(args.input, Path.cwd())
    output = local_path(args.output, Path.cwd())
    if source == output or not source.is_file() or not output.parent.is_dir():
        raise NotReady()
    reference = settings["voices"][args.voice]["reference"]
    original_duration, _ = audio_info(source, np, sf)
    audio_info(reference, np, sf, reference=True)
    try:
        with torch.inference_mode():
            source_embedding = converter.extract_se(str(source))
            target_embedding = converter.extract_se(str(reference))
            converter.convert(audio_src_path=str(source), src_se=source_embedding,
                              tgt_se=target_embedding, output_path=str(output), tau=0.3, message="")
        converted_duration, _ = audio_info(output, np, sf)
        drift_ms = abs(converted_duration - original_duration) * 1000
        if drift_ms > settings["drift"] + 0.001:
            raise NotReady()
        return {"ok": True, "durationDriftMs": round(drift_ms, 3)}
    except Exception:
        output.unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--health", action="store_true")
    parser.add_argument("--input")
    parser.add_argument("--output")
    parser.add_argument("--voice")
    args = parser.parse_args()
    if not args.health and not all((args.input, args.output, args.voice)):
        parser.error("conversion requires --input, --output and --voice")
    try:
        # Official library progress output is kept off the machine-readable stdout.
        with contextlib.redirect_stdout(sys.stderr):
            result = execute(args)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception:
        if args.health:
            print(json.dumps({"ready": False, "voices": []}))
            return 0
        print(json.dumps({"error": {"code": "voice_conversion_failed",
                                  "message": "Không đổi được giọng cho clip này."}}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
