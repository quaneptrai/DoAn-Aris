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
  return config;
}

// ---------- credit budget ----------

export class Ledger {
  constructor(dataDir, budget, now = () => new Date()) {
    this.file = path.join(dataDir, 'ledger.json');
    this.budget = budget;
    this.now = now;
    this.entries = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')).entries ?? [] : [];
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
    return { day: { used: day, cap: account == null ? this.budget.dailyCredits : this.budget.unlimitedAccounts?.includes(account) ? null : this.budget.perAccountDailyCredits }, month: { used: total, cap: account == null ? this.budget.monthlyCredits : null } };
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
  save() {
    const cutoff = this.now().getTime() - 40 * 24 * 3600 * 1000;
    this.entries = this.entries.filter(e => new Date(e.at).getTime() >= cutoff);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify({ entries: this.entries }, null, 1));
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

function ffmpeg(config, args, log, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.ffmpegPath, args, { cwd, windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 10 * 60 * 1000);
    child.stderr.on('data', chunk => { stderr += chunk; if (stderr.length > 200_000) stderr = stderr.slice(-100_000); });
    child.on('error', error => { clearTimeout(timer); reject(new GatewayError(503, 'media_unavailable', 'Bộ xử lý âm thanh/video chưa sẵn sàng.')); log({ ffmpeg: error.code }); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(stderr);
      else { log({ ffmpeg: code, detail: stderr.slice(-1500) }); reject(new GatewayError(422, 'media_failed', 'Không xử lý được âm thanh/video. Kiểm tra file nguồn rồi thử lại.')); }
    });
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
      if (!authorized(req, config.key)) throw new GatewayError(401, 'unauthorized', 'Thiếu hoặc sai khóa.');
      const is = (method, pattern) => req.method === method && (typeof pattern === 'string' ? route === pattern : pattern.test(route));
      if (is('GET', '/health')) { send(res, 200, await health()); status = 200; }
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
