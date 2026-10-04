"""Offline EasyOCR worker used only by the explicit scanned-PDF import mode."""
import base64
import contextlib
import io
import json
import math
import os
import re
import socket
import sys
from pathlib import Path

MAX_REQUEST_BYTES = 9_000_000
MAX_IMAGE_BYTES = 6_000_000
MAX_IMAGE_PIXELS = 4_000_000
MAX_ITEMS = 1_200
MAX_TEXT_LENGTH = 1_000
MAX_BACKGROUND_BYTES = 6_000_000


def emit(value, status=0):
    # The parent starts this worker with ``-I``. On Windows that can leave stdout
    # on a legacy code page, so keep the process boundary ASCII-only even when
    # OCR returns Vietnamese text.
    sys.stdout.write(json.dumps(value, ensure_ascii=True, separators=(',', ':')))
    sys.stdout.write('\n')
    return status


def disable_network():
    def blocked(*args, **kwargs):
        raise OSError('offline OCR does not permit network connections')

    socket.socket.connect = blocked
    socket.create_connection = blocked


def request_image():
    encoded = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
    if len(encoded) > MAX_REQUEST_BYTES:
        raise ValueError('request_too_large')
    try:
        request = json.loads(encoded.decode('utf-8'))
        image_value = request['image'] if isinstance(request, dict) and set(request) == {'image'} else None
        if not isinstance(image_value, str):
            raise ValueError
        raw = base64.b64decode(image_value, validate=True)
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError):
        raise ValueError('invalid_request') from None
    if not 0 < len(raw) <= MAX_IMAGE_BYTES:
        raise ValueError('invalid_image_size')
    from PIL import Image, UnidentifiedImageError

    try:
        Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
        with Image.open(io.BytesIO(raw)) as image:
            if image.width < 32 or image.height < 32 or image.width * image.height > MAX_IMAGE_PIXELS:
                raise ValueError('invalid_image_dimensions')
            return image.convert('RGB')
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError):
        raise ValueError('invalid_image') from None


def runtime_options():
    model_dir = Path(os.environ.get('RESUME_OCR_MODEL_DIR', '')).expanduser()
    language_value = os.environ.get('RESUME_OCR_LANGUAGES', 'vi,en')
    languages = [value.strip() for value in language_value.split(',') if value.strip()]
    if not model_dir.is_dir() or not 1 <= len(languages) <= 4 or any(not re.fullmatch(r'[a-z_]{2,16}', value) for value in languages):
        raise RuntimeError('runtime_not_configured')
    gpu_value = os.environ.get('RESUME_OCR_GPU', '0').strip().lower()
    return str(model_dir), languages, gpu_value in {'1', 'true', 'yes'}


def normalize_records(records, width, height):
    normalized = []
    for record in records:
        if not isinstance(record, (list, tuple)) or len(record) != 3:
            continue
        polygon, text, confidence = record
        if not isinstance(text, str):
            continue
        text = ' '.join(text.split())
        if not text or len(text) > MAX_TEXT_LENGTH:
            continue
        try:
            confidence = float(confidence)
            points = [[float(point[0]), float(point[1])] for point in polygon]
        except (IndexError, TypeError, ValueError):
            continue
        if len(points) != 4 or not math.isfinite(confidence) or not 0 <= confidence <= 1:
            continue
        if any(not math.isfinite(value) or value < -1 or value > bound + 1
               for point in points for value, bound in zip(point, (width, height))):
            continue
        angle = math.degrees(math.atan2(points[1][1] - points[0][1], points[1][0] - points[0][0]))
        angle = ((angle + 90) % 180) - 90
        normalized.append({'polygon': points, 'text': text, 'confidence': confidence, 'rotation': angle})
    normalized.sort(key=lambda item: item['confidence'], reverse=True)
    kept = []
    for candidate in normalized:
        left = min(point[0] for point in candidate['polygon'])
        top = min(point[1] for point in candidate['polygon'])
        right = max(point[0] for point in candidate['polygon'])
        bottom = max(point[1] for point in candidate['polygon'])
        area = max(1.0, (right - left) * (bottom - top))
        duplicate = False
        for current in kept:
            current_left = min(point[0] for point in current['polygon'])
            current_top = min(point[1] for point in current['polygon'])
            current_right = max(point[0] for point in current['polygon'])
            current_bottom = max(point[1] for point in current['polygon'])
            overlap = max(0.0, min(right, current_right) - max(left, current_left)) * max(0.0, min(bottom, current_bottom) - max(top, current_top))
            same_text = candidate['text'].casefold() in current['text'].casefold() or current['text'].casefold() in candidate['text'].casefold()
            if same_text and overlap / area > .55:
                duplicate = True
                break
        if not duplicate:
            kept.append(candidate)
    return kept[:MAX_ITEMS]


def clean_background(image, records):
    import cv2
    import numpy as np

    pixels = np.asarray(image)
    mask = np.zeros(pixels.shape[:2], dtype=np.uint8)
    for record in records:
        points = np.array(record['polygon'], dtype=np.int32)
        cv2.fillPoly(mask, [points], 255)
    mask = cv2.dilate(mask, np.ones((3, 3), dtype=np.uint8), iterations=1)
    cleaned = cv2.inpaint(cv2.cvtColor(pixels, cv2.COLOR_RGB2BGR), mask, 3, cv2.INPAINT_TELEA)
    success, encoded = cv2.imencode('.jpg', cleaned, [cv2.IMWRITE_JPEG_QUALITY, 88])
    if not success or len(encoded) > MAX_BACKGROUND_BYTES:
        raise RuntimeError('background_encoding_failed')
    return cv2.cvtColor(cleaned, cv2.COLOR_BGR2RGB), base64.b64encode(encoded.tobytes()).decode('ascii'), float(mask.mean() / 255)


def main():
    disable_network()
    try:
        image = request_image()
    except ValueError as error:
        return emit({'error': {'code': str(error)}} , 2)
    try:
        model_dir, languages, gpu = runtime_options()
        with contextlib.redirect_stdout(sys.stderr):
            import easyocr
            import numpy as np
            reader = easyocr.Reader(languages, gpu=gpu, model_storage_directory=model_dir, download_enabled=False, verbose=False)
            records = reader.readtext(np.asarray(image), detail=1, paragraph=False)
        items = normalize_records(records, image.width, image.height)
        if not items:
            return emit({'error': {'code': 'ocr_no_text'}}, 2)
        cleaned, background, coverage = clean_background(image, items)
        with contextlib.redirect_stdout(sys.stderr):
            residual = reader.readtext(cleaned, detail=1, paragraph=False)
        residual_items = normalize_records(residual, image.width, image.height)
        return emit({'items': items, 'background': background, 'width': image.width, 'height': image.height,
                     'maskCoverage': round(coverage, 6), 'residualCount': len(residual_items)})
    except Exception:
        return emit({'error': {'code': 'ocr_runtime_unavailable'}}, 2)


if __name__ == '__main__':
    raise SystemExit(main())
