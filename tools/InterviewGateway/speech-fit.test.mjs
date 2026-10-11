// "native-tts" timing: synthetic tone bursts stand in for speech. No model, provider or network service.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execCapturedSync as execFileSync, spawnCapturedSync as spawnSync } from './capture-sync-test-helper.mjs';
import { createGateway, wavTiming } from './gateway.mjs';
import { SILENCE_FILTER, silenceFilter, parseSilences, speechSegments, planFit, fitFilter } from './speech-fit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ffmpegPath = process.env.INTERVIEW_FFMPEG ?? path.resolve(here, '../../.local/interview-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const ffmpegReady = spawnSync(ffmpegPath, ['-version'], { windowsHide: true }).status === 0;
const KEY = 'speech-fit-test-key-0123456789';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'speech-fit-test-'));
const servers = [];
test.after(() => { for (const server of servers) server.close(); fs.rmSync(temp, { recursive: true, force: true }); });

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const bursts = spans => spans.map(([a, b]) => `between(t,${a},${b})`).join('+');
const ff = (args, input) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', ...args], { input, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
const report = (args, input) => spawnSync(ffmpegPath, ['-hide_banner', ...args], { input, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8', windowsHide: true }).stderr;

function nativeVideo(spans, duration = 5, hum = 0) {
  const file = path.join(temp, `native-${spans.length}-${duration}-${hum}.mp4`);
  ff(['-y', '-f', 'lavfi', '-i', `testsrc2=size=160x120:rate=24:duration=${duration}`, '-f', 'lavfi', '-i', `aevalsrc='0.5*sin(2*PI*440*t)*(${spans.length ? bursts(spans) : '0'})+${hum}*sin(2*PI*120*t)':s=48000:d=${duration}`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-movflags', '+faststart', file]);
  return fs.readFileSync(file);
}
function ttsWave(spans, duration) {
  const file = path.join(temp, `tts-${spans.join('-')}.wav`);
  ff(['-y', '-f', 'lavfi', '-i', `aevalsrc='0.5*sin(2*PI*330*t)*(${bursts(spans)})':s=24000:d=${duration}`, file]);
  return fs.readFileSync(file);
}
// A WAV written to a pipe has no final sizes in its header, so extract to a file.
let extracted = 0;
const audioOf = video => {
  const file = path.join(temp, `audio-${extracted++}.wav`);
  ff(['-y', '-i', 'pipe:0', '-map', '0:a:0', '-ac', '1', '-ar', '48000', file], video);
  return fs.readFileSync(file);
};
const spansOf = wav => { const { duration } = wavTiming(wav); return speechSegments(parseSilences(report(['-i', 'pipe:0', '-af', SILENCE_FILTER, '-f', 'null', '-'], wav), duration), duration); };
const videoHash = video => ff(['-i', 'pipe:0', '-map', '0:v:0', '-c', 'copy', '-f', 'md5', 'pipe:1'], video).toString().trim();

async function start() {
  const dir = fs.mkdtempSync(path.join(temp, 'case-'));
  const { server, ledger } = createGateway({ key: KEY, prefix: '/gw', dataDir: path.join(dir, 'data'), ffmpegPath, mediaConcurrency: 1, budget: { timeZone: 'Asia/Ho_Chi_Minh' }, upstreams: {} });
  servers.push(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/gw`;
  const fit = (video, audio, key = KEY) => {
    const form = new FormData();
    form.set('video', new Blob([video], { type: 'video/mp4' }), 'native.mp4');
    if (audio) form.set('audio', new Blob([audio], { type: 'audio/wav' }), 'voice.wav');
    return fetch(base + '/media/fit-voice', { method: 'POST', body: form, headers: key ? { authorization: `Bearer ${key}` } : {} });
  };
  return { fit, ledger };
}

test('silences become speech spans, ignoring blips and unterminated tails', () => {
  const silences = parseSilences('silence_start: 0\nsilence_end: 1.0\nsilence_start: 2.0\nsilence_end: 2.4\nsilence_start: 2.43\nsilence_end: 2.6\nsilence_start: 3.5\n', 5);
  // The 30 ms sound between 2.4 and 2.43 is a blip, not a phrase.
  assert.deepEqual(speechSegments(silences, 5), [{ start: 1, end: 2 }, { start: 2.6, end: 3.5 }]);
});

test('equal phrase counts map phrase to phrase; different counts fit the whole window', () => {
  const native = [{ start: 1, end: 2 }, { start: 2.4, end: 3.5 }];
  const phrases = planFit(native, [{ start: 0.2, end: 1.5 }, { start: 1.8, end: 3 }]);
  assert.equal(phrases.mode, 'phrases');
  near(phrases.pieces[0].tempo, 1.3, 1e-9, 'first tempo'); near(phrases.pieces[1].tempo, 1.2 / 1.1, 1e-9, 'second tempo');
  const window = planFit(native, [{ start: 0.1, end: 2.6 }]);
  assert.equal(window.mode, 'window');
  assert.deepEqual(window.pieces[0].dst, { start: 1, end: 3.5 });
  near(window.pieces[0].tempo, 1, 1e-9, 'window tempo');
});

test('one unnatural phrase pair falls back to the whole window; impossible fits are refused', () => {
  const fallback = planFit([{ start: 0, end: 0.2 }, { start: 0.5, end: 3 }], [{ start: 0, end: 1.2 }, { start: 1.4, end: 2.6 }]);
  assert.equal(fallback.mode, 'window');
  assert.throws(() => planFit([{ start: 0, end: 1 }], [{ start: 0, end: 3 }]), /tempo_out_of_range/);
  assert.throws(() => planFit([], [{ start: 0, end: 1 }]), /no_native_speech/);
  assert.throws(() => planFit([{ start: 0, end: 1 }], []), /no_tts_speech/);
});

test('silence threshold follows the clip peak within safe bounds', () => {
  assert.equal(silenceFilter(-1), 'silencedetect=noise=-29.0dB:d=0.12');
  assert.equal(silenceFilter(-40), 'silencedetect=noise=-55.0dB:d=0.12');
  assert.equal(silenceFilter(6), 'silencedetect=noise=-25.0dB:d=0.12');
  assert.equal(silenceFilter(NaN), 'silencedetect=noise=-38.0dB:d=0.12');
});

test('equal phrase counts that disagree with the overall tempo use the whole window', () => {
  // A breath in the native speech paired with a comma in the TTS: 1.0 s vs 0.4 s and 0.4 s vs 1.0 s.
  const plan = planFit([{ start: 0, end: 1 }, { start: 1.2, end: 1.6 }], [{ start: 0, end: 0.4 }, { start: 0.6, end: 1.6 }]);
  assert.equal(plan.mode, 'window');
});

test('filter cuts each piece to its destination and the mix to the exact original length', () => {
  const filter = fitFilter(planFit([{ start: 1, end: 2 }], [{ start: 0, end: 1.5 }]), 48000, 240000);
  assert.match(filter, /atempo=1\.500000/);
  assert.match(filter, /atrim=end_sample=48000,adelay=delays=48000S:all=1\[p0\]/);
  assert.match(filter, /atrim=end_sample=240000\[fit\]$/);
});

test('fit-voice requires the gateway key and both files', async () => {
  const { fit, ledger } = await start();
  assert.equal((await fit(Buffer.from('x'), Buffer.from('y'), null)).status, 401);
  assert.equal((await fit(Buffer.from('x'))).status, 400);
  assert.equal(ledger.entries.length, 0);
});

test('TTS lands on the native speech spans; video packets and total length are unchanged', { skip: !ffmpegReady && 'FFmpeg unavailable' }, async () => {
  const { fit, ledger } = await start();
  const native = [[1.0, 2.0], [2.4, 3.5]];
  const video = nativeVideo(native);
  const response = await fit(video, ttsWave([[0.2, 1.5], [1.8, 3.0]], 3.3));
  assert.equal(response.status, 200, await response.clone().text());
  const output = Buffer.from(await response.arrayBuffer());
  assert.equal(videoHash(output), videoHash(video), 'video bitstream must be copied');
  const before = wavTiming(audioOf(video)), after = wavTiming(audioOf(output));
  near(after.duration, before.duration, 0.03, 'audio duration');
  const spans = spansOf(audioOf(output));
  assert.equal(spans.length, 2, JSON.stringify(spans));
  spans.forEach((span, index) => { near(span.start, native[index][0], 0.06, `phrase ${index} start`); near(span.end, native[index][1], 0.06, `phrase ${index} end`); });
  const loudness = Number(report(['-i', 'pipe:0', '-af', 'ebur128', '-f', 'null', '-'], audioOf(output)).match(/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold[\s\S]*$/)?.[1]);
  near(loudness, -14, 1.5, 'integrated loudness');
  assert.equal(ledger.entries.length, 0);
});

test('room tone above -38 dB does not hide the pauses', { skip: !ffmpegReady && 'FFmpeg unavailable' }, async () => {
  const { fit } = await start();
  const native = [[1.0, 2.0], [2.4, 3.5]];
  const response = await fit(nativeVideo(native, 5, 0.015), ttsWave([[0.2, 1.5], [1.8, 3.0]], 3.3));
  assert.equal(response.status, 200, await response.clone().text());
  // The output carries only the fitted TTS (the hum is replaced), so phrases must sit on the native spans.
  const spans = spansOf(audioOf(Buffer.from(await response.arrayBuffer())));
  assert.equal(spans.length, 2, JSON.stringify(spans));
  spans.forEach((span, index) => { near(span.start, native[index][0], 0.06, `phrase ${index} start`); near(span.end, native[index][1], 0.06, `phrase ${index} end`); });
});

test('a clip without native speech is refused instead of guessing the timing', { skip: !ffmpegReady && 'FFmpeg unavailable' }, async () => {
  const { fit } = await start();
  const response = await fit(nativeVideo([], 3), ttsWave([[0.2, 1.5]], 2));
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.error.code, 'speech_fit_failed');
  assert.doesNotMatch(JSON.stringify(body), /[A-Z]:\\|ffmpeg|tempo/i);
});
