// No model, paid provider, private reference or network service is used by these tests.
// A fake worker plus synthetic FFmpeg media exercise the real gateway boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execCapturedSync as execFileSync, spawnCapturedSync as spawnSync } from './capture-sync-test-helper.mjs';
import { fileURLToPath } from 'node:url';
import { createGateway, wavTiming, verifyVoiceTiming, loadConfig } from './gateway.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ffmpegPath = process.env.INTERVIEW_FFMPEG ?? path.resolve(here, '../../.local/interview-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const ffmpegReady = spawnSync(ffmpegPath, ['-version'], { windowsHide: true }).status === 0;
const workerReady = spawnSync(process.execPath, ['-e', ''], { windowsHide: true }).status === 0;
const KEY = 'voice-conversion-test-key-0123456789';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-conversion-test-'));
const worker = path.join(temp, 'fake-worker.mjs');
fs.writeFileSync(worker, `
import fs from 'node:fs';
const option = name => process.argv[process.argv.indexOf(name) + 1];
const config = JSON.parse(fs.readFileSync(option('--config'), 'utf8'));
if (process.argv.includes('--health')) {
  console.log(JSON.stringify({ready: config.ready !== false, voices: config.ready === false ? [] : [{id:'ruby_wav_clean',name:'Ruby'}]}));
} else if (config.mode === 'timeout') {
  fs.writeFileSync(config.pidFile, String(process.pid));
  setTimeout(() => fs.writeFileSync(option('--output'), 'late'), 30000);
} else if (config.mode === 'fail') {
  console.error('PRIVATE_PROVIDER C:\\private\\reference.wav TOKEN_SECRET'); process.exitCode=2;
} else {
  let bytes=fs.readFileSync(option('--input'));
  if (config.mode === 'drift') {
    let offset=12;
    while(bytes.toString('ascii',offset,offset+4)!=='data') offset+=8+bytes.readUInt32LE(offset+4)+(bytes.readUInt32LE(offset+4)%2);
    const length=Math.floor(bytes.readUInt32LE(offset+4)/4)*2;
    bytes=Buffer.from(bytes.subarray(0,offset+8+length));
    bytes.writeUInt32LE(length,offset+4); bytes.writeUInt32LE(bytes.length-8,4);
  }
  fs.writeFileSync(option('--output'),bytes); console.log(JSON.stringify({ok:true}));
}
`);
const servers = [];
test.after(() => { for (const server of servers) server.close(); fs.rmSync(temp, { recursive: true, force: true }); });

async function start(mode = 'copy', extra = {}) {
  const dir = fs.mkdtempSync(path.join(temp, 'case-'));
  const configPath = path.join(dir, 'worker.json');
  fs.writeFileSync(configPath, JSON.stringify({ mode, ...extra }));
  const config = { key: KEY, prefix: '/gw', dataDir: path.join(dir, 'data'), ffmpegPath, mediaConcurrency: 1,
    budget: { timeZone: 'Asia/Ho_Chi_Minh' }, upstreams: {},
    voiceConversion: mode === 'missing' ? undefined : { pythonPath: process.execPath, workerPath: worker, configPath, timeoutSeconds: mode === 'timeout' ? 1 : 30, maxDurationDriftMs: 80 } };
  const { server, ledger } = createGateway(config); servers.push(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/gw`;
  const call = (route, init = {}) => fetch(base + route, { ...init, headers: { authorization: `Bearer ${KEY}`, ...init.headers } });
  const convert = (video, voice = 'ruby_wav_clean') => {
    const form = new FormData(); form.set('video', new Blob([video], { type: 'video/mp4' }), 'native.mp4'); form.set('voice', voice);
    return call('/media/convert-voice', { method: 'POST', body: form });
  };
  return { call, convert, base, ledger, config };
}

let source;
if (ffmpegReady) {
  const file = path.join(temp, 'native-source.mp4');
  execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x120:rate=25:duration=3.2', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3.2', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-movflags', '+faststart', file], { windowsHide: true });
  source = fs.readFileSync(file);
}
const media = (bytes, args) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', ...args], { input: bytes, maxBuffer: 8 * 1024 * 1024, windowsHide: true });

test('voice conversion health and conversion require the gateway key', async () => {
  const { base, ledger } = await start();
  for (const route of ['/media/voice-conversion/health', '/media/convert-voice']) {
    const response = await fetch(base + route, { method: route.endsWith('/health') ? 'GET' : 'POST' });
    assert.equal(response.status, 401);
  }
  assert.equal(ledger.entries.length, 0);
});

test('missing configuration stays unavailable and spends no credits', async () => {
  const { call, convert, ledger } = await start('missing');
  assert.deepEqual(await (await call('/media/voice-conversion/health')).json(), { ready: false, voices: [] });
  const response = await convert(Buffer.from('not-a-video'));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'voice_conversion_unavailable');
  assert.equal(ledger.entries.length, 0);
});

test('missing references do not advertise a usable voice', async () => {
  const { call, convert } = await start('copy', { ready: false });
  assert.deepEqual(await (await call('/media/voice-conversion/health')).json(), { ready: false, voices: [] });
  assert.equal((await convert(Buffer.from('not-a-video'))).status, 503);
});

test('unknown target fails before media work or generation', { skip: (!workerReady || !ffmpegReady) && 'sandbox cannot spawn a local worker or FFmpeg' }, async () => {
  const { call, convert, ledger } = await start();
  assert.deepEqual(await (await call('/media/voice-conversion/health')).json(), { ready: true, voices: [{ id: 'ruby_wav_clean', name: 'Ruby' }] });
  for (const voice of ['another_voice']) {
    const response = await convert(Buffer.from('not-a-video'), voice);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'invalid_voice');
  }
  assert.equal(ledger.entries.length, 0);
});

test('traversal-like voice ids fail before worker or generation', async () => {
  const { convert, ledger } = await start();
  for (const voice of ['../reference', 'https://private.example/audio']) {
    const response = await convert(Buffer.from('not-a-video'), voice);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'invalid_voice');
  }
  assert.equal(ledger.entries.length, 0);
});

test('conversion preserves the video bitstream and speech duration without looping', { skip: !ffmpegReady || !workerReady }, async () => {
  const { convert, ledger } = await start();
  const response = await convert(source);
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(response.headers.get('content-type'), 'video/mp4');
  const result = Buffer.from(await response.arrayBuffer());
  const videoHash = bytes => media(bytes, ['-map', '0:v:0', '-c:v', 'copy', '-f', 'hash', '-hash', 'sha256', 'pipe:1']).toString().trim();
  assert.equal(videoHash(result), videoHash(source), 'every original encoded video packet is retained');
  const packets = bytes => media(bytes, ['-copyts', '-map', '0:v:0', '-c:v', 'copy', '-f', 'framehash', 'pipe:1']).toString().split('\n').filter(line => line && !line.startsWith('#'));
  assert.deepEqual(packets(result), packets(source), 'video packet timestamps and frame durations remain unchanged');
  const audioFrames = bytes => media(bytes, ['-map', '0:a:0', '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', 'pipe:1']).length / 2;
  assert.ok(Math.abs(audioFrames(result) - audioFrames(source)) / 48000 < 0.05, 'only AAC rounding, not a repeated or shortened video');
  const loudness = spawnSync(ffmpegPath, ['-hide_banner', '-i', 'pipe:0', '-af', 'ebur128', '-f', 'null', '-'], { input: result, encoding: 'utf8' }).stderr.match(/Integrated loudness:\s*I:\s*(-?[\d.]+) LUFS/);
  assert.ok(loudness && Math.abs(Number(loudness[1]) + 14) <= 0.5, 'converted audio is normalized to about -14 LUFS');
  assert.equal(ledger.entries.length, 0);
});

test('large conversion duration drift is rejected, not stretched or silently remuxed', { skip: !ffmpegReady || !workerReady }, async () => {
  const { convert } = await start('drift');
  const response = await convert(source);
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'voice_timing_drift');
});

test('worker failure is sanitized and contains no reference path or provider details', { skip: !ffmpegReady || !workerReady }, async () => {
  const { convert } = await start('fail');
  const response = await convert(source), text = await response.text();
  assert.equal(response.status, 422);
  assert.doesNotMatch(text, /PRIVATE_PROVIDER|private|reference\.wav|TOKEN_SECRET|OpenVoice|Python/);
});

test('worker timeout kills its process rather than leaving conversion running', { skip: !ffmpegReady || !workerReady }, async () => {
  const pidFile = path.join(temp, 'timed-out.pid');
  const { convert } = await start('timeout', { pidFile });
  const response = await convert(source);
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, 'voice_conversion_timeout');
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
});

test('malformed PCM metadata is rejected instead of accepting a guessed duration', () => {
  assert.throws(() => wavTiming(Buffer.from('not-wav')));
});

test('sample counts allow only codec rounding, including different sample rates', () => {
  const wav = (rate, frames) => {
    const b = Buffer.alloc(44 + frames * 2);
    b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
    b.write('data', 36); b.writeUInt32LE(frames * 2, 40); return b;
  };
  const original = wav(48000, 48000 * 3);
  assert.equal(verifyVoiceTiming(original, wav(22050, 22050 * 3)).driftMs, 0);
  assert.ok(verifyVoiceTiming(original, wav(48000, 48000 * 3 + 2400)).driftMs <= 50.001);
  assert.throws(() => verifyVoiceTiming(original, wav(48000, 48000 * 3 + 4800)), error => error.code === 'voice_timing_drift');
  assert.throws(() => verifyVoiceTiming(original, wav(48000, 48000 * 2)), error => error.code === 'voice_timing_drift');
});

test('configuration resolves worker files against its folder and rejects unsafe drift', () => {
  const dir = fs.mkdtempSync(path.join(temp, 'config-')), file = path.join(dir, 'gateway.json');
  const raw = { key: KEY, voiceConversion: { pythonPath: 'venv/python.exe', workerPath: 'worker.py', configPath: 'voices.json', maxDurationDriftMs: 80 } };
  fs.writeFileSync(file, JSON.stringify(raw));
  assert.equal(loadConfig(file).voiceConversion.workerPath, path.join(dir, 'worker.py'));
  raw.voiceConversion.maxDurationDriftMs = 500; fs.writeFileSync(file, JSON.stringify(raw));
  assert.throws(() => loadConfig(file), /maxDurationDriftMs/);
});
