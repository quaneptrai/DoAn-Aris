// Pure timing helpers for "native-tts": fit a separately synthesized TTS line into the speech
// spans of the video's own lip-synced speech. The video and its total duration never change;
// only the TTS is trimmed, tempo-adjusted per phrase and placed where the mouth moves.

/** Silence detection for clean single-speaker narration (no music by prompt). */
export const SILENCE_FILTER = 'silencedetect=noise=-38dB:d=0.12';
/**
 * Room tone above a fixed threshold would hide every pause, so the threshold follows the clip:
 * 28 dB under its peak, kept between -55 and -25 dBFS.
 */
export function silenceFilter(peakDb) {
  const noise = Number.isFinite(peakDb) ? Math.min(-25, Math.max(-55, peakDb - 28)) : -38;
  return `silencedetect=noise=${noise.toFixed(1)}dB:d=0.12`;
}
/** Phrase pairs may differ from the overall tempo by at most this factor before the window fit is used. */
const PHRASE_TEMPO_SPREAD = 1.35;
/** atempo keeps pitch; outside this range speech sounds unnatural, so the clip is refused. */
export const TEMPO_RANGE = [0.5, 2];
const MIN_SPEECH_SECONDS = 0.08;
const MAX_PHRASES = 24;

/** Silences reported by FFmpeg silencedetect; an unterminated silence lasts to the end. */
export function parseSilences(stderr, duration) {
  const silences = [];
  for (const match of stderr.matchAll(/silence_(start|end): ([-\d.eE+]+)/g)) {
    const value = Math.max(0, Number(match[2]));
    if (!Number.isFinite(value)) continue;
    if (match[1] === 'start') silences.push({ start: value, end: duration });
    else if (silences.length && silences.at(-1).end === duration) silences.at(-1).end = Math.min(value, duration);
  }
  return silences;
}

/** Spoken spans between silences, ignoring blips shorter than MIN_SPEECH_SECONDS. */
export function speechSegments(silences, duration) {
  const segments = [];
  let cursor = 0;
  for (const silence of [...silences].sort((a, b) => a.start - b.start)) {
    if (silence.start - cursor >= MIN_SPEECH_SECONDS) segments.push({ start: cursor, end: silence.start });
    cursor = Math.max(cursor, silence.end);
  }
  if (duration - cursor >= MIN_SPEECH_SECONDS) segments.push({ start: cursor, end: duration });
  return segments;
}

const span = segments => [{ start: segments[0].start, end: segments.at(-1).end }];

/**
 * Pairs TTS phrases with native phrases. Equal phrase counts map one to one (closer word timing);
 * otherwise the whole TTS speech is fitted into the whole native speech window.
 * tempo > 1 speeds the TTS up, < 1 slows it down.
 */
export function planFit(native, tts, byPhrase = true) {
  if (!native.length) throw new Error('no_native_speech');
  if (!tts.length) throw new Error('no_tts_speech');
  const paired = byPhrase && native.length > 1 && native.length === tts.length && native.length <= MAX_PHRASES;
  const destinations = paired ? native : span(native), sources = paired ? tts : span(tts);
  const pieces = destinations.map((dst, index) => {
    const src = sources[index];
    return { src, dst, tempo: (src.end - src.start) / (dst.end - dst.start) };
  });
  const overall = (tts.at(-1).end - tts[0].start) / (native.at(-1).end - native[0].start);
  const outOfRange = p => !Number.isFinite(p.tempo) || p.tempo < TEMPO_RANGE[0] || p.tempo > TEMPO_RANGE[1];
  // Equal counts can still pair a breath with a comma; a pair far from the overall tempo means a mismatch.
  const misPaired = p => p.tempo > overall * PHRASE_TEMPO_SPREAD || p.tempo < overall / PHRASE_TEMPO_SPREAD;
  if (pieces.some(outOfRange) || (paired && pieces.some(misPaired))) {
    if (!paired) throw new Error('tempo_out_of_range');
    return planFit(native, tts, false);   // one odd phrase pair must not fail the whole clip
  }
  return { mode: paired ? 'phrases' : 'window', pieces };
}

const f = value => value.toFixed(6);

/**
 * filter_complex for input 1 (TTS). Each piece is cut, tempo-adjusted, cut again to its exact
 * destination length, delayed to its native start and mixed. The result is exactly `frames` long.
 */
export function fitFilter(plan, sampleRate, frames) {
  const parts = plan.pieces.map((piece, index) => {
    const length = Math.max(1, Math.round((piece.dst.end - piece.dst.start) * sampleRate));
    const delay = Math.round(piece.dst.start * sampleRate);
    return `[1:a]aresample=${sampleRate},atrim=start=${f(piece.src.start)}:end=${f(piece.src.end)},asetpts=PTS-STARTPTS,`
      + `atempo=${f(piece.tempo)},apad,atrim=end_sample=${length},adelay=delays=${delay}S:all=1[p${index}]`;
  });
  const labels = plan.pieces.map((_, index) => `[p${index}]`).join('');
  const mix = plan.pieces.length === 1 ? `${labels}anull` : `${labels}amix=inputs=${plan.pieces.length}:normalize=0`;
  return `${parts.join(';')};${mix},apad,atrim=end_sample=${frames}[fit]`;
}
