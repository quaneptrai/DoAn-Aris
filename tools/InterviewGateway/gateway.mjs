// Interview gateway: the only door from the Aris server into the services on this PC.
// Aris knows this gateway's address and key, nothing else. The language model router, the video
// renderer, the voice service and FFmpeg stay on this machine (see README.md).
//
//   node gateway.mjs [--config <file>]               run (default config: config.local.json)
//   node gateway.mjs status|pause|resume [--config <file>]
//   node gateway.mjs new-key                         print a random key for config.local.json
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { silenceFilter, parseSilences, speechSegments, planFit, fitFilter } from './speech-fit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const MB = 1024 * 1024;
// loudnorm normalises dynamically only from 3 s up; a shorter line gets a peak-capped linear gain and stays quiet.
const NORMALISE = 'apad=whole_dur=3,loudnorm=I=-14:TP=-1:LRA=11';

export function loadConfig(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const config = {
    host: '127.0.0.1', port: 8780, prefix: '/gw', dataDir: 'data', ffmpegPath: 'ffmpeg', mediaConcurrency: 2,
    upstreams: {}, ...raw,
    budget: { dailyCredits: null, monthlyCredits: null, unknownCostCredits: null, perAccountDailyCredits: null, unlimitedAccounts: [], timeZone: 'Asia/Ho_Chi_Minh', ...raw.budget },
  };
  if (config.adminKey != null && (typeof config.adminKey !== 'string' || config.adminKey.length < 24)) throw new Error('config.adminKey needs at least 24 characters');
  if (typeof config.key !== 'string' || config.key.length < 24) throw new Error('config.key needs at least 24 characters');
  for (const name of ['dailyCredits', 'monthlyCredits', 'unknownCostCredits', 'perAccountDailyCredits']) {
    const value = config.budget[name];
    if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new Error(`budget.${name} must be a nonnegative number or null`);
  }
  if (!Number.isInteger(config.mediaConcurrency) || config.mediaConcurrency < 1) throw new Error('mediaConcurrency must be a positive integer');
  new Intl.DateTimeFormat('en-CA', { timeZone: config.budget.timeZone });
  const folder = path.dirname(path.resolve(file));
  config.dataDir = path.resolve(folder, config.dataDir);
  // A relative FFmpeg path is relative to the config file; a bare name is looked up on PATH.
  if (/[\\/]/.test(config.ffmpegPath) && !path.isAbsolute(config.ffmpegPath)) config.ffmpegPath = path.resolve(folder, config.ffmpegPath);
  if (config.voiceConversion) {
    config.voiceConversion = { timeoutSeconds: 180, maxDurationDriftMs: 80, ...config.voiceConversion };
    for (const name of ['pythonPath', 'workerPath', 'configPath']) {
      const value = config.voiceConversion[name];
      if (typeof value !== 'string' || !value.trim()) throw new Error(`voiceConversion.${name} is required`);
      if (name !== 'pythonPath' || /[\\/]/.test(value)) config.voiceConversion[name] = path.resolve(folder, value);
    }
    if (!Number.isFinite(config.voiceConversion.timeoutSeconds) || config.voiceConversion.timeoutSeconds < 1 || config.voiceConversion.timeoutSeconds > 1800) throw new Error('voiceConversion.timeoutSeconds must be between 1 and 1800');
    if (!Number.isFinite(config.voiceConversion.maxDurationDriftMs) || config.voiceConversion.maxDurationDriftMs < 0 || config.voiceConversion.maxDurationDriftMs > 80) throw new Error('voiceConversion.maxDurationDriftMs must be between 0 and 80');
  }
  return config;
}

// ---------- credit budget ----------

export class Ledger {
  constructor(dataDir, budget, now = () => new Date()) {
    this.file = path.join(dataDir, 'ledger.json');
    this.budget = budget;
    this.now = now;
    const stored = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : {};
    this.entries = stored.entries ?? [];
    this.grants = stored.grants ?? [];
  }
  day(date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: this.budget.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
  usage(account = null) {
    const today = this.day(this.now()), month = today.slice(0, 7);
    let day = 0, total = 0;
    for (const entry of this.entries) {
      if (entry.state === 'released' || (account != null && entry.account !== account)) continue;
      const when = this.day(new Date(entry.at));
      if (when === today) day += entry.credits;
      if (when.startsWith(month)) total += entry.credits;
    }
    const bonus = account == null ? 0 : this.grants.filter(g => g.account === account && g.day === today).reduce((sum, g) => sum + g.credits, 0);
    return { day: { used: day, cap: account == null ? this.budget.dailyCredits : this.budget.unlimitedAccounts?.includes(account) ? null : (this.budget.perAccountDailyCredits == null ? null : this.budget.perAccountDailyCredits + bonus) }, month: { used: total, cap: account == null ? this.budget.monthlyCredits : null } };
  }
  /** Null when `credits` more still fit today's and this month's caps; otherwise the refusal. */
  refusal(credits, account = null) {
    if (account != null) { const refusal = this.refusal(credits); if (refusal) return refusal; }
    const { day, month } = this.usage(account);
    if (day.cap != null && day.used + credits > day.cap) return 'Đã dùng hết hạn mức tạo video của hệ thống hôm nay. Thử lại vào ngày mai.';
    if (month.cap != null && month.used + credits > month.cap) return 'Đã dùng hết hạn mức tạo video của hệ thống tháng này.';
    return null;
  }
  reserve(credits, kind, account = null) {
    const entry = { id: crypto.randomUUID(), at: this.now().toISOString(), credits, kind, account, state: 'reserved' };
    this.entries.push(entry);
    this.save();
    return entry.id;
  }
  settle(id, state) {
    const entry = this.entries.find(e => e.id === id);
    if (entry) { entry.state = state; this.save(); }
  }
  grant({ id, account, actor, credits, day }) {
    if (typeof id !== 'string' || !/^support-[1-9]\d{0,9}$/.test(id) || !/^[a-f0-9]{64}$/.test(account ?? '') || !/^[a-f0-9]{64}$/.test(actor ?? '') || !Number.isInteger(credits) || credits < 1 || credits > 10000 || !/^\d{4}-\d{2}-\d{2}$/.test(day ?? '') || !Number.isFinite(Date.parse(day + 'T00:00:00Z')) || new Date(day + 'T00:00:00Z').toISOString().slice(0,10) !== day || day > this.day(this.now()))
      throw new GatewayError(400, 'invalid_grant', 'Khoản credit bổ sung không hợp lệ.');
    const existing = this.grants.find(g => g.id === id);
    if (existing) {
      if (existing.account !== account || existing.actor !== actor || existing.credits !== credits || existing.day !== day) throw new GatewayError(409, 'grant_conflict', 'Yêu cầu này đã có khoản credit khác.');
      return existing;
    }
    const grant = { id, account, actor, credits, day, at: this.now().toISOString() };
    this.grants.push(grant); this.save(); return grant;
  }
  save() {
    const cutoff = this.now().getTime() - 40 * 24 * 3600 * 1000;
    this.entries = this.entries.filter(e => new Date(e.at).getTime() >= cutoff);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify({ entries: this.entries, grants: this.grants }, null, 1));
    fs.renameSync(this.file + '.tmp', this.file);
  }
}

// ---------- helpers ----------

class GatewayError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function send(res, status, body, headers = {}) {
  if (res.headersSent) { res.destroy(); return; }
  const data = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'content-type': Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json; charset=utf-8', 'content-length': data.length, ...headers });
  res.end(data);
}

function digest(value) { return crypto.createHash('sha256').update(String(value)).digest(); }

function authorized(req, key) {
  const header = req.headers.authorization ?? '';
  const supplied = header.replace(/^Bearer\s+/i, '').trim();
  return supplied.length > 0 && crypto.timingSafeEqual(digest(supplied), digest(key));
}

/** The request body as a stream that fails once it passes `limit` bytes. */
function limited(req, limit) {
  if (Number(req.headers['content-length'] ?? 0) > limit) throw new GatewayError(413, 'too_large', 'Dữ liệu gửi lên quá lớn.');
  let seen = 0;
  return Readable.from((async function* () {
    for await (const chunk of req) {
      seen += chunk.length;
      if (seen > limit) throw new GatewayError(413, 'too_large', 'Dữ liệu gửi lên quá lớn.');
      yield chunk;
    }
  })());
}

async function readAll(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function readForm(req, limit) {
  const type = req.headers['content-type'] ?? '';
  if (!type.toLowerCase().startsWith('multipart/form-data')) throw new GatewayError(400, 'bad_request', 'Cần dữ liệu multipart.');
  const request = new Request('http://gateway.local/', { method: 'POST', headers: { 'content-type': type }, body: Readable.toWeb(limited(req, limit)), duplex: 'half' });
  try { return await request.formData(); }
  catch (error) { if (error instanceof GatewayError || error?.cause instanceof GatewayError) throw error.cause ?? error; throw new GatewayError(400, 'bad_request', 'Dữ liệu multipart không hợp lệ.'); }
}

async function fileBytes(form, name, required = true) {
  const value = form.get(name);
  if (value == null || typeof value === 'string') { if (required) throw new GatewayError(400, 'bad_request', `Thiếu ${name}.`); return null; }
  return Buffer.from(await value.arrayBuffer());
}

/** One upstream call; the response comes back as a Node IncomingMessage. */
function upstreamRequest(target, { method, headers, body, signal }) {
  return new Promise((resolve, reject) => {
    const client = target.protocol === 'https:' ? https : http;
    const outgoing = client.request(target, { method, headers: { ...headers, host: target.host }, signal }, resolve);
    outgoing.on('error', reject);
    if (body && typeof body.pipe === 'function') { body.on('error', error => outgoing.destroy(error)); body.pipe(outgoing); }
    else outgoing.end(body);
  });
}

function joinUrl(base, suffix) {
  return new URL(base.replace(/\/+$/, '') + suffix);
}

// ---------- media ----------

function semaphore(size) {
  let active = 0;
  const waiting = [];
  return async task => {
    if (active >= size) await new Promise(resolve => waiting.push(resolve));
    active++;
    try { return await task(); }
    finally { active--; waiting.shift()?.(); }
  };
}

// Regular files also work in a restricted Windows session where anonymous pipe
// handles cannot be inherited. Keep capture files private, bounded, and ephemeral.
function captureProcess(command, args, { cwd, timeoutMs, signal, stdoutLimit = 64 * 1024, stderrLimit = 200 * 1024 }) {
  return new Promise((resolve, reject) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'interview-process-'));
    const output = path.join(dir, 'stdout'), errors = path.join(dir, 'stderr');
    const handles = [fs.openSync(output, 'w'), fs.openSync(errors, 'w')];
    let child, timer, settled = false, timedOut = false;
    const abort = () => child?.kill('SIGKILL');
    const tail = (file, limit) => {
      const size = fs.statSync(file).size, count = Math.min(size, limit), buffer = Buffer.alloc(count), descriptor = fs.openSync(file, 'r');
      try { fs.readSync(descriptor, buffer, 0, count, size - count); return buffer.toString('utf8'); }
      finally { fs.closeSync(descriptor); }
    };
    const finish = (error, code) => {
      if (settled) return; settled = true;
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      try {
        if (error) reject(error);
        else resolve({ code, timedOut, stdout: tail(output, stdoutLimit), stderr: tail(errors, stderrLimit) });
      } catch (failure) { reject(failure); }
      finally { fs.rmSync(dir, { recursive: true, force: true }); }
    };
    try { child = spawn(command, args, { cwd, windowsHide: true, stdio: ['ignore', handles[0], handles[1]] }); }
    catch (error) { for (const handle of handles) fs.closeSync(handle); finish(error); return; }
    for (const handle of handles) fs.closeSync(handle);
    timer = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    child.once('error', error => finish(error));
    child.once('close', code => finish(null, code));
    if (signal?.aborted) abort();
  });
}

async function ffmpeg(config, args, log, cwd, signal) {
  let result;
  try { result = await captureProcess(config.ffmpegPath, args, { cwd, timeoutMs: 10 * 60 * 1000, signal }); }
  catch (error) { log({ ffmpeg: error.code }); throw new GatewayError(503, 'media_unavailable', 'Bộ xử lý âm thanh/video chưa sẵn sàng.'); }
  if (result.code === 0) return result.stderr;
  log({ ffmpeg: result.code, detail: result.stderr.slice(-1500) });
  throw new GatewayError(422, 'media_failed', 'Không xử lý được âm thanh/video. Kiểm tra file nguồn rồi thử lại.');
}

// Voice conversion runs locally; these routes never send source or reference audio to an upstream.
async function voiceWorker(config, args, log, signal) {
  const settings = config.voiceConversion;
  if (!settings?.pythonPath || !settings.workerPath || !settings.configPath) throw new GatewayError(503, 'voice_conversion_unavailable', 'Bộ đổi giọng chưa sẵn sàng.');
  let result;
  try { result = await captureProcess(settings.pythonPath, [settings.workerPath, ...args, '--config', settings.configPath], { timeoutMs: (settings.timeoutSeconds ?? 180) * 1000, signal }); }
  catch (error) { log({ voiceConversion: 'unavailable', code: error.code }); throw new GatewayError(503, 'voice_conversion_unavailable', 'Bộ đổi giọng chưa sẵn sàng.'); }
  // Internal paths and model messages never become HTTP errors or gateway logs.
  if (result.code !== 0) {
    log({ voiceConversion: result.timedOut ? 'timeout' : 'failed', code: result.code });
    throw new GatewayError(result.timedOut ? 504 : 422, result.timedOut ? 'voice_conversion_timeout' : 'voice_conversion_failed', result.timedOut ? 'Đổi giọng quá thời gian xử lý. Thử lại sau.' : 'Không đổi được giọng cho clip này. Kiểm tra âm thanh gốc rồi thử lại.');
  }
  try { return JSON.parse(result.stdout); }
  catch { throw new GatewayError(503, 'voice_conversion_unavailable', 'Bộ đổi giọng chưa sẵn sàng.'); }
}

export async function voiceConversionHealth(config, log = () => {}, signal) {
  if (!config.voiceConversion) return { ready: false, voices: [] };
  try {
    const result = await voiceWorker(config, ['--health'], log, signal);
    const voices = Array.isArray(result.voices) ? result.voices.filter(v => /^[A-Za-z0-9_-]{1,100}$/.test(v?.id ?? '') && typeof v?.name === 'string' && v.name.length > 0 && v.name.length <= 80 && !/[\\/:<>]/.test(v.name)).map(v => ({ id: v.id, name: v.name })) : [];
    if (result.ready !== true || voices.length === 0) return { ready: false, voices: [] };
    await ffmpeg(config, ['-version'], () => {}, undefined, signal);
    return { ready: true, voices };
  } catch { return { ready: false, voices: [] }; }
}

// Read sample counts, rather than an approximate container duration. Inputs are local PCM WAV.
export function wavTiming(bytes) {
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new GatewayError(422, 'voice_conversion_failed', 'Âm thanh sau đổi giọng không hợp lệ.');
  let rate = 0, align = 0, size = null;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + length > bytes.length) throw new GatewayError(422, 'voice_conversion_failed', 'Âm thanh sau đổi giọng không hợp lệ.');
    if (kind === 'fmt ' && length >= 16) {
      const format = bytes.readUInt16LE(start);
      if (![1, 3, 65534].includes(format)) throw new GatewayError(422, 'voice_conversion_failed', 'Âm thanh sau đổi giọng không hợp lệ.');
      rate = bytes.readUInt32LE(start + 4); align = bytes.readUInt16LE(start + 12);
    }
    if (kind === 'data') size = (size ?? 0) + length;
    offset = start + length + (length % 2);
  }
  if (!rate || !align || !size || size % align) throw new GatewayError(422, 'voice_conversion_failed', 'Âm thanh sau đổi giọng không hợp lệ.');
  return { sampleRate: rate, frames: size / align, duration: size / align / rate };
}

export function verifyVoiceTiming(original, converted, maxDriftMs = 80) {
  const before = wavTiming(original), after = wavTiming(converted);
  const driftMs = Math.abs(after.duration - before.duration) * 1000;
  if (driftMs > maxDriftMs + 0.001) throw new GatewayError(422, 'voice_timing_drift', 'Đổi giọng làm lệch thời lượng lời nói. Clip đã được giữ nguyên để tránh lệch khẩu hình.');
  return { before, after, driftMs };
}

/** Preserve every original video packet and audio timing; never loop or stretch a talking face. */
export async function convertVoice(config, log, video, voice, signal) {
  const health = await voiceConversionHealth(config, log, signal);
  if (!health.ready) throw new GatewayError(503, 'voice_conversion_unavailable', 'Bộ đổi giọng chưa sẵn sàng.');
  if (!health.voices.some(v => v.id === voice)) throw new GatewayError(400, 'invalid_voice', 'Giọng được chọn chưa sẵn sàng để đổi giọng.');
  return inTemp(async dir => {
    const source = path.join(dir, 'source.mp4'), original = path.join(dir, 'original.wav'), converted = path.join(dir, 'converted.wav'), output = path.join(dir, 'output.mp4');
    fs.writeFileSync(source, video);
    const audioStart = await extractSpeech(config, source, original, log, dir, signal);
    const originalBytes = fs.readFileSync(original);
    wavTiming(originalBytes);
    await voiceWorker(config, ['--input', original, '--output', converted, '--voice', voice], log, signal);
    if (!fs.existsSync(converted)) throw new GatewayError(422, 'voice_conversion_failed', 'Không đổi được giọng cho clip này.');
    const { before, driftMs } = verifyVoiceTiming(originalBytes, fs.readFileSync(converted), config.voiceConversion.maxDurationDriftMs ?? 80);
    // Only codec rounding <=80 ms may be padded/trimmed. No tempo change and no -shortest.
    const filter = await loudnessFilter(config, converted, log, dir, signal) + `,aresample=48000,apad,atrim=end_sample=${before.frames},asetpts=PTS-STARTPTS+(${audioStart})/TB`;
    await ffmpeg(config, ['-y', '-hide_banner', '-copyts', '-i', source, '-i', converted, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', filter, '-c:a', 'aac', '-ar', '48000', '-movflags', '+faststart', output], log, dir, signal);
    log({ voiceConversion: 'complete', durationDriftMs: Math.round(driftMs) });
    return fs.readFileSync(output);
  });
}

/** Writes the clip's own speech as 48 kHz mono PCM and returns when that audio starts in the video. */
async function extractSpeech(config, source, destination, log, dir, signal) {
  const extraction = await ffmpeg(config, ['-y', '-hide_banner', '-copyts', '-i', source, '-map', '0:a:0', '-vn', '-af', 'ashowinfo', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', destination], log, dir, signal);
  const start = extraction.match(/\bn:0\s+pts:\S+\s+pts_time:([+-]?[\d.eE]+)/);
  const audioStart = start ? Number(start[1]) : NaN;
  if (!Number.isFinite(audioStart)) throw new GatewayError(422, 'voice_timing_unavailable', 'Không xác định được thời điểm lời nói trong clip gốc.');
  return audioStart;
}

/** Two-pass loudnorm to -14 LUFS; falls back to single-pass when measurement is unavailable. */
async function loudnessFilter(config, file, log, dir, signal) {
  const normalise = 'loudnorm=I=-14:TP=-1:LRA=11';
  const measured = await ffmpeg(config, ['-hide_banner', '-i', file, '-af', normalise + ':print_format=json', '-f', 'null', '-'], log, dir, signal);
  const match = measured.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!match) return normalise;
  const m = JSON.parse(match[0]);
  return Number.isFinite(Number(m.input_i))
    ? normalise + `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`
    : normalise;
}

async function speechSpans(config, file, duration, log, dir, signal) {
  const levels = await ffmpeg(config, ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], log, dir, signal);
  const peak = Number(levels.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]);
  const report = await ffmpeg(config, ['-hide_banner', '-i', file, '-af', silenceFilter(peak), '-f', 'null', '-'], log, dir, signal);
  return speechSegments(parseSilences(report, duration), duration);
}

/**
 * "native-tts": keep the video's lip-synced timing but replace its voice with the kit's TTS.
 * The TTS is fitted phrase by phrase into the native speech spans; video packets are copied and
 * the audio track keeps the original length exactly, so sound never drifts from the picture.
 */
export async function fitVoice(config, log, video, audio, signal) {
  return inTemp(async dir => {
    const source = path.join(dir, 'source.mp4'), original = path.join(dir, 'original.wav'), voice = path.join(dir, 'voice.audio');
    const tts = path.join(dir, 'tts.wav'), fitted = path.join(dir, 'fitted.wav'), output = path.join(dir, 'output.mp4');
    fs.writeFileSync(source, video); fs.writeFileSync(voice, audio);
    const audioStart = await extractSpeech(config, source, original, log, dir, signal);
    await ffmpeg(config, ['-y', '-hide_banner', '-i', voice, '-vn', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', tts], log, dir, signal);
    const before = wavTiming(fs.readFileSync(original)), spoken = wavTiming(fs.readFileSync(tts));
    // FFmpeg/outage errors from speechSpans keep their own status; only a refused fit becomes speech_fit_failed.
    const nativeSpans = await speechSpans(config, original, before.duration, log, dir, signal);
    const ttsSpans = await speechSpans(config, tts, spoken.duration, log, dir, signal);
    let plan;
    try { plan = planFit(nativeSpans, ttsSpans); }
    catch (error) {
      log({ speechFit: 'refused', reason: error.message });
      throw new GatewayError(422, 'speech_fit_failed', error.message === 'no_native_speech'
        ? 'Video không có lời nói để khớp giọng đọc. Thử tạo lại clip này.'
        : 'Giọng đọc và lời nói trong video chênh nhau quá nhiều để khớp môi. Kiểm tra lời thoại rồi tạo lại.');
    }
    await ffmpeg(config, ['-y', '-hide_banner', '-i', original, '-i', tts, '-filter_complex', fitFilter(plan, before.sampleRate, before.frames), '-map', '[fit]', '-c:a', 'pcm_s16le', fitted], log, dir, signal);
    const filter = await loudnessFilter(config, fitted, log, dir, signal) + `,aresample=48000,apad,atrim=end_sample=${before.frames},asetpts=PTS-STARTPTS+(${audioStart})/TB`;
    await ffmpeg(config, ['-y', '-hide_banner', '-copyts', '-i', source, '-i', fitted, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', filter, '-c:a', 'aac', '-ar', '48000', '-movflags', '+faststart', output], log, dir, signal);
    log({ speechFit: 'complete', mode: plan.mode, phrases: plan.pieces.length, tempo: plan.pieces.map(p => Math.round(p.tempo * 100) / 100) });
    return fs.readFileSync(output);
  });
}

async function inTemp(work) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'interview-gateway-'));
  try { return await work(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/** Same recipe as InterviewSpeech.MixAsync: loop the video under the voice, voice at -14 LUFS. */
export function mix(config, log, video, audio) {
  return inTemp(async dir => {
    const source = path.join(dir, 'source.mp4'), destination = path.join(dir, 'output.mp4');
    fs.writeFileSync(source, video);
    const args = ['-y', '-hide_banner'];
    if (audio) {
      const voice = path.join(dir, 'voice.audio');
      fs.writeFileSync(voice, audio);
      const measured = await ffmpeg(config, ['-hide_banner', '-i', voice, '-af', NORMALISE + ':print_format=json', '-f', 'null', '-'], log);
      let filter = NORMALISE;
      const match = measured.match(/\{\s*"input_i"[\s\S]*?\}/);
      if (match) {
        const m = JSON.parse(match[0]);
        if (Number.isFinite(Number(m.input_i))) filter += `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
      }
      args.push('-stream_loop', '-1', '-i', source, '-i', voice, '-map', '0:v:0', '-map', '1:a:0', '-af', filter, '-shortest');
    } else args.push('-i', source, '-an');
    args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-ar', '48000', '-movflags', '+faststart', destination);
    await ffmpeg(config, args, log);
    return fs.readFileSync(destination);
  });
}

/** Same recipe as InterviewSpeech.DemoAsync. */
function concat(config, log, clips) {
  return inTemp(async dir => {
    clips.forEach((clip, i) => fs.writeFileSync(path.join(dir, `clip${i}.mp4`), clip));
    fs.writeFileSync(path.join(dir, 'list.txt'), clips.map((_, i) => `file 'clip${i}.mp4'`).join('\n') + '\n');
    await ffmpeg(config, ['-y', '-hide_banner', '-f', 'concat', '-safe', '1', '-i', 'list.txt', '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-movflags', '+faststart', 'demo.mp4'], log, dir);
    return fs.readFileSync(path.join(dir, 'demo.mp4'));
  });
}

/** Same recipe as InterviewSpeech.SpeechMp3Async: 16 kHz mono MP3 for transcription. */
function speechMp3(config, log, audio, name) {
  const extension = /\.(wav|webm|ogg|mp3|m4a)$/i.exec(name ?? '')?.[0].toLowerCase() ?? '.audio';
  return inTemp(async dir => {
    fs.writeFileSync(path.join(dir, 'answer' + extension), audio);
    await ffmpeg(config, ['-y', '-hide_banner', '-i', 'answer' + extension, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k', 'answer.mp3'], log, dir);
    return fs.readFileSync(path.join(dir, 'answer.mp3'));
  });
}

// ---------- media links in renderer replies ----------

/** Links to files on the renderer become relative to the gateway's video route ("media/…"). */
export function rewriteMediaLinks(text, origin) {
  const hosts = [origin, origin.replace('127.0.0.1', 'localhost')].map(o => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  let result = text.replace(new RegExp(`(?:${hosts.join('|')})/((?:tmp|files)/)`, 'g'), 'media/$1');
  result = result.replace(/(src\s*=\s*\\?["']|\]\()\/((?:tmp|files)\/)/g, '$1media/$2');
  return result;
}

// ---------- server ----------

export function createGateway(config) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const lockFile = path.join(config.dataDir, 'gateway.pid');
  if (fs.existsSync(lockFile)) {
    const owner = Number(fs.readFileSync(lockFile, 'utf8'));
    if (!Number.isInteger(owner) || owner <= 0) throw new Error('Invalid gateway lock; inspect it before removing.');
    try { process.kill(owner, 0); throw new Error('Another gateway owns this ledger.'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; fs.unlinkSync(lockFile); }
  }
  fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
  const releaseLock = () => { try { if (fs.readFileSync(lockFile, 'utf8') === String(process.pid)) fs.unlinkSync(lockFile); } catch {} };
  const ledger = new Ledger(config.dataDir, config.budget);
  const quotes = new Map();  // approval token -> { credits, kind, expires }
  const media = semaphore(config.mediaConcurrency);
  const logFile = path.join(config.dataDir, 'gateway.log');
  const log = entry => {
    try {
      if (fs.existsSync(logFile) && fs.statSync(logFile).size > 5 * MB) fs.renameSync(logFile, logFile + '.1');
      fs.appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
    } catch { /* logging never breaks a request */ }
  };
  const paused = () => config.paused === true || fs.existsSync(path.join(config.dataDir, 'PAUSE'));
  const upstream = name => {
    const settings = config.upstreams[name];
    if (!settings?.baseUrl) throw new GatewayError(503, 'not_configured', 'Dịch vụ này chưa được bật trên cổng.');
    return settings;
  };
  const auth = settings => settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {};
  const forwardHeaders = req => {
    const headers = {};
    for (const name of ['content-type', 'content-length', 'accept', 'x-flow-approval']) if (req.headers[name]) headers[name] = req.headers[name];
    return headers;
  };

  /** Streams the upstream reply straight back to Aris. */
  async function pipeThrough(req, res, target, settings, limit, signal) {
    const reply = await upstreamRequest(target, { method: req.method, headers: { ...forwardHeaders(req), ...auth(settings) }, body: req.method === 'GET' ? null : limited(req, limit), signal });
    const headers = {};
    for (const name of ['content-type', 'content-length', 'content-disposition']) if (reply.headers[name]) headers[name] = reply.headers[name];
    res.writeHead(reply.statusCode ?? 502, headers);
    reply.on('error', () => res.destroy());
    reply.on('aborted', () => res.destroy());
    reply.pipe(res);
    await new Promise(resolve => res.on('close', resolve));
    return reply.statusCode;
  }

  /** Waits for the whole upstream reply (renderer replies are small and may need rewriting). */
  async function buffered(req, target, settings, body, signal) {
    const reply = await upstreamRequest(target, { method: req.method, headers: { ...forwardHeaders(req), ...auth(settings) }, body, signal });
    return { status: reply.statusCode ?? 502, type: reply.headers['content-type'] ?? 'application/json', body: await readAll(limited(reply, 25 * MB)) };
  }

  function accountOf(req) {
    const value = req.headers['x-aris-account'];
    if (config.budget.perAccountDailyCredits != null && (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)))
      throw new GatewayError(400, 'account_required', 'Thiếu danh tính tài khoản từ máy chủ.');
    return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : null;
  }

  async function preview(req, res, signal) {
    if (paused()) throw new GatewayError(423, 'generation_paused', 'Tạo video đang tạm dừng. Thử lại sau.');
    const settings = upstream('video');
    const account = accountOf(req);
    const body = await readAll(limited(req, 25 * MB));
    const reply = await buffered(req, joinUrl(settings.baseUrl, '/generation/preview'), settings, body, signal);
    if (reply.status >= 200 && reply.status < 300) {
      let quote;
      try { quote = JSON.parse(reply.body.toString('utf8')); } catch { quote = null; }
      const token = quote?.approval_token;
      if (typeof token === 'string' && token) {
        const estimate = quote.estimated_credits;
        const priced = typeof estimate === 'number' && Number.isFinite(estimate) && estimate >= 0;
        const exempt = account != null && config.budget.unlimitedAccounts?.includes(account) && config.budget.dailyCredits == null && config.budget.monthlyCredits == null;
        const credits = priced ? estimate : exempt ? 0 : config.budget.unknownCostCredits;
        if (credits == null) throw new GatewayError(429, 'cost_unknown', 'Chưa xác định được chi phí. Người vận hành cần đặt hạn mức dự phòng trước khi tạo.');
        const refusal = ledger.refusal(credits, account);
        if (refusal) { log({ budget: 'refused', credits }); throw new GatewayError(429, 'budget_exhausted', refusal); }
        for (const [key, old] of quotes) if (old.expires < Date.now()) quotes.delete(key);
        const seconds = Number(quote.expires_in);
        const lifetime = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 300) * 1000 : 300_000;
        quotes.set(token, { account, credits, kind: priced ? 'priced' : 'unknown', bodyHash: digest(body), expires: Date.now() + lifetime });
      }
    }
    res.writeHead(reply.status, { 'content-type': reply.type, 'content-length': reply.body.length });
    res.end(reply.body);
    return reply.status;
  }

  async function render(req, res, signal) {
    if (paused()) throw new GatewayError(423, 'generation_paused', 'Tạo video đang tạm dừng. Thử lại sau.');
    const settings = upstream('video');
    const token = req.headers['x-flow-approval'];
    const quote = token ? quotes.get(token) : null;
    if (!quote || quote.expires <= Date.now()) {
      if (token) quotes.delete(token);
      throw new GatewayError(428, 'quote_required', 'Báo giá không còn hiệu lực. Bấm tạo lại để xem chi phí mới.');
    }
    const account = accountOf(req);
    if (quote.account !== account) throw new GatewayError(403, 'account_mismatch', 'Báo giá không thuộc tài khoản này.');
    const requestBody = await readAll(limited(req, 25 * MB));
    if (!crypto.timingSafeEqual(quote.bodyHash, digest(requestBody))) throw new GatewayError(409, 'quote_mismatch', 'Yêu cầu đã thay đổi. Xem lại báo giá trước khi tạo.');
    // Recheck after reading: simultaneous calls may have consumed the same token.
    if (quotes.get(token) !== quote || quote.expires <= Date.now()) throw new GatewayError(428, 'quote_required', 'Báo giá đã hết hạn hoặc đã dùng.');
    if (paused()) throw new GatewayError(423, 'generation_paused', 'Tạo video đang tạm dừng. Thử lại sau.');
    quotes.delete(token);
    const refusal = ledger.refusal(quote.credits, account);
    if (refusal) { log({ budget: 'refused', credits: quote.credits }); throw new GatewayError(429, 'budget_exhausted', refusal); }
    const reservation = ledger.reserve(quote.credits, quote.kind, account);
    let reply;
    try { reply = await buffered(req, joinUrl(settings.baseUrl, '/chat/completions'), settings, requestBody, signal); }
    catch (error) { ledger.settle(reservation, 'uncertain'); throw error; }
    // Timeouts and server errors can arrive after a provider charged credits. Keep them counted.
    ledger.settle(reservation, reply.status >= 400 && reply.status < 500 ? 'released' : reply.status >= 500 ? 'uncertain' : 'spent');
    const body = Buffer.from(rewriteMediaLinks(reply.body.toString('utf8'), new URL(settings.baseUrl).origin));
    res.writeHead(reply.status, { 'content-type': reply.type, 'content-length': body.length });
    res.end(body);
    log({ credits: quote.credits, kind: quote.kind, rendered: reply.status });
    return reply.status;
  }

  async function health() {
    const probe = async (name, suffix) => {
      const settings = config.upstreams[name];
      if (!settings?.baseUrl) return null;
      try {
        const reply = await upstreamRequest(joinUrl(settings.baseUrl, suffix), { method: 'GET', headers: auth(settings), signal: AbortSignal.timeout(5000) });
        reply.resume();
        return (reply.statusCode ?? 500) >= 200 && (reply.statusCode ?? 500) < 300;
      } catch { return false; }
    };
    const ffmpegOk = await ffmpeg(config, ['-version'], () => {}).then(() => true, () => false);
    const [llm, video, tts] = await Promise.all([probe('llm', '/models'), probe('video', '/generation/accounts'), probe('tts', '/api/v1/voices')]);
    return { ok: true, paused: paused(), services: { llm, video, tts, ffmpeg: ffmpegOk }, budget: ledger.usage() };
  }

  async function handle(req, res) {
    const started = Date.now();
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    const url = new URL(req.url, 'http://gateway.local');
    let route = url.pathname;
    if (config.prefix && (route === config.prefix || route.startsWith(config.prefix + '/'))) route = route.slice(config.prefix.length) || '/';
    const suffix = url.search;
    let status = 500;
    try {
      if (!authorized(req, route.startsWith('/admin/') ? (config.adminKey ?? '') : config.key)) throw new GatewayError(401, 'unauthorized', 'Thiếu hoặc sai khóa.');
      const is = (method, pattern) => req.method === method && (typeof pattern === 'string' ? route === pattern : pattern.test(route));
      if (is('GET', '/admin/status')) { send(res, 200, await health()); status = 200; }
      else if (is('POST', '/admin/pause') || is('POST', '/admin/resume')) {
        const file = path.join(config.dataDir, 'PAUSE');
        if (route.endsWith('/pause')) fs.writeFileSync(file, new Date().toISOString());
        else { if (config.paused === true) throw new GatewayError(409, 'config_paused', 'Cần bỏ chế độ tạm dừng trong cấu hình trước.'); if (fs.existsSync(file)) fs.unlinkSync(file); }
        log({ admin: route.endsWith('/pause') ? 'pause' : 'resume' });
        send(res, 200, { ok: true, paused: paused() }); status = 200;
      }
      else if (is('POST', '/admin/credit-grants')) {
        let value; try { value = JSON.parse((await readAll(limited(req, 4096))).toString('utf8')); } catch { throw new GatewayError(400, 'invalid_grant', 'Dữ liệu credit không hợp lệ.'); }
        if (!value || typeof value !== 'object') throw new GatewayError(400, 'invalid_grant', 'Dữ liệu credit không hợp lệ.');
        const grant = ledger.grant(value);
        log({ admin: 'credit-grant', grant: grant.id, credits: grant.credits });
        send(res, 200, { ok: true, id: grant.id, day: grant.day, credits: grant.credits }); status = 200;
      }
      else if (is('GET', '/health')) { send(res, 200, await health()); status = 200; }
      else if (is('GET', '/video/budget')) {
        const account = accountOf(req);
        const { day } = ledger.usage(account);
        send(res, 200, { limit: day.cap, used: day.used, remaining: day.cap == null ? null : Math.max(0, day.cap - day.used) }); status = 200;
      }
      else if (is('GET', '/llm/models') || is('POST', '/llm/chat/completions')) {
        const settings = upstream('llm');
        status = await pipeThrough(req, res, joinUrl(settings.baseUrl, route.slice('/llm'.length) + suffix), settings, 25 * MB, controller.signal);
      }
      else if (is('POST', '/video/generation/preview')) status = await preview(req, res, controller.signal);
      else if (is('POST', '/video/chat/completions')) status = await render(req, res, controller.signal);
      else if (is('GET', '/video/generation/accounts')) {
        const settings = upstream('video');
        status = await pipeThrough(req, res, joinUrl(settings.baseUrl, '/generation/accounts'), settings, 0, controller.signal);
      }
      else if (is('GET', /^\/video\/media\/(?:tmp|files)\/[\w.\-/]+$/) && !route.includes('..')) {
        const settings = upstream('video');
        status = await pipeThrough(req, res, new URL(route.slice('/video/media'.length), new URL(settings.baseUrl).origin), settings, 0, controller.signal);
      }
      else if (is('POST', '/tts/v1/audio/speech') || is('GET', '/tts/api/v1/voices') || is('POST', '/tts/api/v1/voices')) {
        const settings = upstream('tts');
        status = await pipeThrough(req, res, joinUrl(settings.baseUrl, route.slice('/tts'.length) + suffix), settings, 12 * MB, controller.signal);
      }
      else if (is('POST', '/stt/v1/audio/transcriptions')) {
        const settings = upstream('stt');
        status = await pipeThrough(req, res, joinUrl(settings.baseUrl, '/v1/audio/transcriptions'), settings, 12 * MB, controller.signal);
      }
      else if (is('GET', '/media/health')) {
        await ffmpeg(config, ['-version'], log);
        send(res, 200, { ok: true }); status = 200;
      }
      else if (is('GET', '/media/voice-conversion/health')) {
        send(res, 200, await media(() => voiceConversionHealth(config, log, controller.signal))); status = 200;
      }
      else if (is('POST', '/media/convert-voice')) {
        if (!config.voiceConversion) throw new GatewayError(503, 'voice_conversion_unavailable', 'Bộ đổi giọng chưa sẵn sàng.');
        const form = await readForm(req, 80 * MB), voice = form.get('voice');
        if (typeof voice !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(voice)) throw new GatewayError(400, 'invalid_voice', 'Giọng được chọn chưa sẵn sàng để đổi giọng.');
        const video = await fileBytes(form, 'video');
        send(res, 200, await media(() => convertVoice(config, log, video, voice, controller.signal)), { 'content-type': 'video/mp4' }); status = 200;
      }
      else if (is('POST', '/media/fit-voice')) {
        const form = await readForm(req, 80 * MB);
        const video = await fileBytes(form, 'video'), audio = await fileBytes(form, 'audio');
        send(res, 200, await media(() => fitVoice(config, log, video, audio, controller.signal)), { 'content-type': 'video/mp4' }); status = 200;
      }
      else if (is('POST', '/media/mix')) {
        const form = await readForm(req, 80 * MB);
        const video = await fileBytes(form, 'video'), audio = await fileBytes(form, 'audio', false);
        send(res, 200, await media(() => mix(config, log, video, audio)), { 'content-type': 'video/mp4' }); status = 200;
      }
      else if (is('POST', '/media/concat')) {
        const form = await readForm(req, 420 * MB);
        const clips = await Promise.all(form.getAll('clip').filter(v => typeof v !== 'string').map(async v => Buffer.from(await v.arrayBuffer())));
        if (clips.length === 0) throw new GatewayError(400, 'bad_request', 'Thiếu clip.');
        send(res, 200, await media(() => concat(config, log, clips)), { 'content-type': 'video/mp4' }); status = 200;
      }
      else if (is('POST', '/media/speech-mp3')) {
        const form = await readForm(req, 12 * MB);
        const audio = form.get('audio');
        if (audio == null || typeof audio === 'string') throw new GatewayError(400, 'bad_request', 'Thiếu audio.');
        send(res, 200, await media(async () => speechMp3(config, log, Buffer.from(await audio.arrayBuffer()), audio.name)), { 'content-type': 'audio/mpeg' }); status = 200;
      }
      else throw new GatewayError(404, 'not_found', 'Không có đường dẫn này.');
    } catch (error) {
      const known = error instanceof GatewayError ? error : error?.cause instanceof GatewayError ? error.cause : null;
      if (known) status = known.status;
      else if (controller.signal.aborted) status = 499;
      else { status = 502; log({ error: error?.code ?? error?.message ?? String(error), route }); }
      if (status !== 499) send(res, status, { error: { code: known?.code ?? 'upstream_unavailable', message: known?.message ?? 'Dịch vụ phía sau chưa sẵn sàng. Thử lại sau.' } });
    } finally {
      log({ method: req.method, route, status, ms: Date.now() - started });
    }
  }

  const server = http.createServer((req, res) => { handle(req, res); });
  server.once('close', releaseLock);
  process.once('exit', releaseLock);
  server.requestTimeout = 0;  // renders can take many minutes
  server.headersTimeout = 60_000;
  return { server, ledger };
}

// ---------- command line ----------

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : fallback;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'run';
  if (command === 'new-key') { console.log(crypto.randomBytes(32).toString('base64url')); process.exit(0); }
  const config = loadConfig(path.resolve(option('--config', path.join(here, 'config.local.json'))));
  const pauseFile = path.join(config.dataDir, 'PAUSE');
  if (command === 'pause') { fs.mkdirSync(config.dataDir, { recursive: true }); fs.writeFileSync(pauseFile, new Date().toISOString()); console.log('Đã tạm dừng tạo video (báo giá và tạo đều bị từ chối).'); }
  else if (command === 'resume') { fs.rmSync(pauseFile, { force: true }); console.log('Đã mở lại tạo video.'); }
  else if (command === 'status') {
    const usage = new Ledger(config.dataDir, config.budget).usage();
    console.log(JSON.stringify({ paused: config.paused === true || fs.existsSync(pauseFile), budget: usage }, null, 2));
  } else if (command === 'run') {
    const { server } = createGateway(config);
    server.listen(config.port, config.host, () => console.log(`Interview gateway on http://${config.host}:${config.port} (prefix ${config.prefix || 'none'})`));
  } else { console.error('Lệnh: run | status | pause | resume | new-key'); process.exit(2); }
}
