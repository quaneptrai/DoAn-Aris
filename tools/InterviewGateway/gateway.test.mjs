// node --test tools/InterviewGateway/gateway.test.mjs
// Fake model router, renderer and voice service on random local ports; FFmpeg is the real one
// (INTERVIEW_FFMPEG, or the copy in .local/interview-tools). No real service or credit is touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGateway, rewriteMediaLinks, Ledger } from './gateway.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ffmpegPath = process.env.INTERVIEW_FFMPEG ?? path.resolve(here, '../../.local/interview-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const KEY = 'gateway-test-key-0123456789abcdef';
const seen = [];
let renderStatus = 200, quoteLifetime = 300, healthStatus = 200;

function listen(handler) {
  return new Promise(resolve => { const server = http.createServer(handler); server.listen(0, '127.0.0.1', () => resolve(server)); });
}
const body = req => new Promise(resolve => { const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); });
const json = (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };

const llm = await listen(async (req, res) => {
  const raw = await body(req);
  seen.push({ service: 'llm', url: req.url, auth: req.headers.authorization, raw: raw.toString() });
  if (req.url === '/v1/models') return json(res, healthStatus, { data: [{ id: 'test-model' }] });
  if (req.url === '/v1/chat/completions') return json(res, 200, { choices: [{ message: { content: '{"ok":true}' } }] });
  json(res, 404, {});
});
const clip = Buffer.from('fake-mp4-bytes');
let renderer;
renderer = await listen(async (req, res) => {
  const raw = await body(req);
  seen.push({ service: 'video', url: req.url, auth: req.headers.authorization, approval: req.headers['x-flow-approval'], account: req.headers['x-aris-account'], raw: raw.toString() });
  if (req.url === '/v1/generation/accounts') return json(res, 200, { accounts: [{ token_id: 1, credits: 100 }] });
  if (req.url === '/v1/generation/preview') {
    const request = JSON.parse(raw.toString());
    return json(res, 200, { approval_token: 'token-' + Math.random().toString(36).slice(2), estimated_credits: request.cost ?? null, expires_in: quoteLifetime });
  }
  if (req.url === '/v1/chat/completions') {
    if (renderStatus === 'disconnect') { res.destroy(); return; }
    if (renderStatus !== 200) return json(res, renderStatus, { error: { message: 'renderer failed' } });
    const origin = `http://127.0.0.1:${renderer.address().port}`;
    return json(res, 200, { choices: [{ message: { content: `<video src='${origin}/tmp/abc123.mp4' controls></video>` } }] });
  }
  if (req.url === '/tmp/abc123.mp4') { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(clip); }
  json(res, 404, {});
});
const voice = await listen(async (req, res) => {
  const raw = await body(req);
  seen.push({ service: 'tts', url: req.url, auth: req.headers.authorization, type: req.headers['content-type'], raw });
  if (req.url === '/v1/audio/speech') { res.writeHead(200, { 'content-type': 'audio/mpeg' }); return res.end(Buffer.from('ID3fake')); }
  if (req.url === '/api/v1/voices') return json(res, 200, { voices: [{ voice_id: 'v1' }] });
  json(res, 404, {});
});

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-test-'));
const config = {
  key: KEY, prefix: '/gw', dataDir, ffmpegPath, mediaConcurrency: 2,
  budget: { dailyCredits: 30, monthlyCredits: 100, unknownCostCredits: 0, timeZone: 'Asia/Ho_Chi_Minh' },
  upstreams: {
    llm: { baseUrl: `http://127.0.0.1:${llm.address().port}/v1`, apiKey: 'router-secret' },
    video: { baseUrl: `http://127.0.0.1:${renderer.address().port}/v1`, apiKey: 'renderer-secret' },
    tts: { baseUrl: `http://127.0.0.1:${voice.address().port}`, apiKey: '' },
  },
};
const { server, ledger } = createGateway(config);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const call = (route, init = {}) => fetch(base + route, { ...init, headers: { authorization: `Bearer ${KEY}`, ...init.headers } });
const postJson = (route, value, headers = {}) => call(route, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(value) });

test.after(() => { for (const s of [server, llm, renderer, voice]) s.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('a second gateway cannot share the same durable ledger', () => { assert.throws(() => createGateway(config), /Another gateway/); });

test('every route needs the gateway key, and a wrong key is refused the same way', async () => {
  for (const headers of [{}, { authorization: 'Bearer wrong' }, { authorization: 'Bearer ' }]) {
    const response = await fetch(base + '/gw/llm/models', { headers });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'unauthorized');
  }
  assert.equal(seen.filter(s => s.service === 'llm').length, 0, 'nothing reached the router');
});

test('only the listed operations exist', async () => {
  for (const route of ['/gw/llm/keys', '/gw/video/admin/tokens', '/gw/tts/api/v1/voices/x', '/gw/video/media/../v1/x', '/gw/video/media/tmp/%2e%2e/x', '/gw/anything']) {
    assert.equal((await call(route)).status, 404, route);
  }
});

test('model router: prefix stripped, provider key swapped in, gateway key never forwarded', async () => {
  for (const route of ['/gw/llm/chat/completions', '/llm/chat/completions']) {
    const response = await postJson(route, { model: 'm', messages: [] });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { choices: [{ message: { content: '{"ok":true}' } }] });
  }
  const calls = seen.filter(s => s.service === 'llm');
  assert.ok(calls.every(c => c.url === '/v1/chat/completions' && c.auth === 'Bearer router-secret'));
  assert.ok(!JSON.stringify(seen).includes(KEY));
});

test('video: quote within budget, render, link rewritten relative to the gateway, file downloaded through it', async () => {
  const request = { model: 'video-model', cost: 10, messages: [] };
  const quote = await (await postJson('/gw/video/generation/preview', request)).json();
  assert.equal(quote.estimated_credits, 10);
  const render = await postJson('/gw/video/chat/completions', request, { 'x-flow-approval': quote.approval_token });
  assert.equal(render.status, 200);
  const text = await render.text();
  assert.match(text, /src='media\/tmp\/abc123\.mp4'/);
  assert.doesNotMatch(text, /127\.0\.0\.1/);
  const link = new URL('media/tmp/abc123.mp4', base + '/gw/video/');
  const file = await call(link.pathname);
  assert.equal(file.status, 200);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), clip);
  const rendered = seen.filter(s => s.service === 'video' && s.url === '/v1/chat/completions').at(-1);
  assert.equal(rendered.approval, quote.approval_token);
  assert.equal(rendered.raw, JSON.stringify(request), 'body passed through byte for byte');
  assert.equal(rendered.auth, 'Bearer renderer-secret');
  assert.equal(ledger.usage().day.used, 10);
});

test('budget: a quote over the daily cap is refused before any approval token is handed out', async () => {
  const response = await postJson('/gw/video/generation/preview', { cost: 25 });
  assert.equal(response.status, 429);
  const error = (await response.json()).error;
  assert.equal(error.code, 'budget_exhausted');
  assert.match(error.message, /hôm nay/);
  assert.equal(ledger.usage().day.used, 10, 'a refused quote reserves nothing');
});

test('render needs a quote made through the gateway; an explicit refusal releases credits', async () => {
  assert.equal((await postJson('/gw/video/chat/completions', { cost: 5 }, { 'x-flow-approval': 'made-up' })).status, 428);
  const before = ledger.usage().day.used;
  const quote = await (await postJson('/gw/video/generation/preview', { cost: 5 })).json();
  renderStatus = 409;
  try { assert.equal((await postJson('/gw/video/chat/completions', { cost: 5 }, { 'x-flow-approval': quote.approval_token })).status, 409); }
  finally { renderStatus = 200; }
  assert.equal(ledger.usage().day.used, before);
  assert.equal((await postJson('/gw/video/chat/completions', { cost: 5 }, { 'x-flow-approval': quote.approval_token })).status, 428, 'a quote is single-use');
});

test('the cap is checked again at render time', async () => {
  const quote = await (await postJson('/gw/video/generation/preview', { cost: 10 })).json();
  const filler = ledger.reserve(15, 'video');
  try {
    const response = await postJson('/gw/video/chat/completions', { cost: 10 }, { 'x-flow-approval': quote.approval_token });
    assert.equal(response.status, 429);
  } finally { ledger.settle(filler, 'released'); }
});

test('unknown price uses the configured allowance, and null is never treated as zero', async () => {
  config.budget.unknownCostCredits = 7;
  const request = { model: 'image' };
  const quote = await (await postJson('/gw/video/generation/preview', request)).json();
  const before = ledger.usage().day.used;
  assert.equal((await postJson('/gw/video/chat/completions', request, { 'x-flow-approval': quote.approval_token })).status, 200);
  assert.equal(ledger.usage().day.used, before + 7);
  config.budget.unknownCostCredits = null;
  const denied = await postJson('/gw/video/generation/preview', request);
  assert.equal(denied.status, 429);
  assert.equal((await denied.json()).error.code, 'cost_unknown');
});

test('expired or changed quotes never render, concurrent reuse renders only once', async () => {
  quoteLifetime = 0.001;
  const expired = await (await postJson('/gw/video/generation/preview', { cost: 1 })).json();
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal((await postJson('/gw/video/chat/completions', { cost: 1 }, { 'x-flow-approval': expired.approval_token })).status, 428);
  quoteLifetime = 300;
  const quote = await (await postJson('/gw/video/generation/preview', { cost: 1 })).json();
  assert.equal((await postJson('/gw/video/chat/completions', { cost: 2 }, { 'x-flow-approval': quote.approval_token })).status, 409);
  const before = seen.filter(c => c.url === '/v1/chat/completions').length;
  const replies = await Promise.all([1, 2].map(() => postJson('/gw/video/chat/completions', { cost: 1 }, { 'x-flow-approval': quote.approval_token })));
  assert.deepEqual(replies.map(r => r.status).sort(), [200, 428]);
  assert.equal(seen.filter(c => c.url === '/v1/chat/completions').length, before + 1);
});

test('server errors and lost connections retain uncertain credits across restart', async () => {
  const before = ledger.usage().day.used;
  for (const status of [500, 'disconnect']) {
    const request = { cost: 2 }, quote = await (await postJson('/gw/video/generation/preview', request)).json();
    renderStatus = status;
    try { assert.equal((await postJson('/gw/video/chat/completions', request, { 'x-flow-approval': quote.approval_token })).status, status === 500 ? 500 : 502); }
    finally { renderStatus = 200; }
  }
  assert.equal(ledger.usage().day.used, before + 4);
  const restored = new Ledger(dataDir, config.budget);
  assert.equal(restored.usage().day.used, before + 4);
});

test('300 credits per account per Vietnam day, with owner exemption and persistent reservations', async () => {
  const dailyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-daily-'));
  let now = new Date('2026-10-10T16:59:00Z');
  const policy = { dailyCredits: null, monthlyCredits: null, perAccountDailyCredits: 300, unlimitedAccounts: ['owner'], timeZone: 'Asia/Ho_Chi_Minh' };
  try {
    const daily = new Ledger(dailyDir, policy, () => now);
    daily.reserve(200, 'video', 'user-a');
    assert.ok(daily.refusal(101, 'user-a'));
    assert.equal(daily.refusal(100, 'user-a'), null);
    assert.equal(daily.refusal(300, 'user-b'), null);
    daily.reserve(1000, 'video', 'owner');
    assert.equal(daily.refusal(10000, 'owner'), null);
    const restored = new Ledger(dailyDir, policy, () => now);
    assert.equal(restored.usage('user-a').day.used, 200);
    now = new Date('2026-10-10T17:01:00Z');
    assert.equal(restored.usage('user-a').day.used, 0);
    assert.equal(restored.refusal(300, 'user-a'), null);
  } finally { fs.rmSync(dailyDir, { recursive: true, force: true }); }
});

test('gateway requires trusted account identity and binds it to the approval', async () => {
  const oldCap = config.budget.dailyCredits, oldMonth = config.budget.monthlyCredits;
  config.budget.monthlyCredits = null;
  config.budget.dailyCredits = null;
  config.budget.perAccountDailyCredits = 300;
  const identity = 'a'.repeat(64), headers = { 'x-aris-account': identity };
  try {
    assert.equal((await postJson('/gw/video/generation/preview', { cost: 200 })).status, 400);
    const quote = await (await postJson('/gw/video/generation/preview', { cost: 200 }, headers)).json();
    assert.equal((await postJson('/gw/video/chat/completions', { cost: 200 }, { 'x-aris-account': 'b'.repeat(64), 'x-flow-approval': quote.approval_token })).status, 403);
    assert.equal((await postJson('/gw/video/chat/completions', { cost: 200 }, { ...headers, 'x-flow-approval': quote.approval_token })).status, 200);
    assert.equal((await postJson('/gw/video/generation/preview', { cost: 101 }, headers)).status, 429);
    assert.equal((await postJson('/gw/video/generation/preview', { cost: 300 }, { 'x-aris-account': 'b'.repeat(64) })).status, 200);
    const owner = 'c'.repeat(64);
    config.budget.unlimitedAccounts = [owner];
    const unknown = await (await postJson('/gw/video/generation/preview', { model: 'image' }, { 'x-aris-account': owner })).json();
    assert.equal(unknown.estimated_credits, null);
    assert.equal((await postJson('/gw/video/chat/completions', { model: 'image' }, { 'x-aris-account': owner, 'x-flow-approval': unknown.approval_token })).status, 200);
    assert.equal((await (await call('/gw/video/budget', { headers: { 'x-aris-account': owner } })).json()).limit, null);
    assert.ok(seen.filter(c => c.service === 'video').every(c => !c.account), 'billing identity never reaches provider');
  } finally { for (const entry of [...ledger.entries]) if (entry.account) ledger.settle(entry.id, 'released'); config.budget.dailyCredits = oldCap; config.budget.monthlyCredits = oldMonth; config.budget.perAccountDailyCredits = null; config.budget.unlimitedAccounts = []; }
});

test('pause refuses quotes and renders until resumed', async () => {
  fs.writeFileSync(path.join(dataDir, 'PAUSE'), 'x');
  try {
    const response = await postJson('/gw/video/generation/preview', { cost: 1 });
    assert.equal(response.status, 423);
    assert.equal((await response.json()).error.code, 'generation_paused');
  } finally { fs.rmSync(path.join(dataDir, 'PAUSE')); }
  assert.equal((await postJson('/gw/video/generation/preview', { cost: 1 })).status, 200);
});

test('voice service: speech, voice list and clone upload pass through', async () => {
  const speech = await postJson('/gw/tts/v1/audio/speech', { input: 'xin chào', voice: 'v1' });
  assert.equal(speech.status, 200);
  assert.equal(Buffer.from(await speech.arrayBuffer()).toString(), 'ID3fake');
  assert.deepEqual(await (await call('/gw/tts/api/v1/voices')).json(), { voices: [{ voice_id: 'v1' }] });
  const form = new FormData();
  form.set('name', 'giọng'); form.set('audio', new Blob([Buffer.from('RIFF0000WAVE')], { type: 'audio/wav' }), 'a.wav');
  assert.equal((await call('/gw/tts/api/v1/voices', { method: 'POST', body: form })).status, 200);
  assert.match(seen.filter(s => s.service === 'tts').at(-1).type, /^multipart\/form-data; boundary=/);
});

test('health reports which services answer, without addresses', async () => {
  const report = await (await call('/gw/health')).json();
  assert.deepEqual(Object.keys(report.services).sort(), ['ffmpeg', 'llm', 'tts', 'video']);
  assert.equal(report.services.llm, true);
  healthStatus = 401;
  try { assert.equal((await (await call('/gw/health')).json()).services.llm, false); }
  finally { healthStatus = 200; }
  assert.doesNotMatch(JSON.stringify(report), /127\.0\.0\.1|secret/);
});

test('links from the renderer become gateway-relative', () => {
  const origin = 'http://127.0.0.1:8000';
  assert.equal(rewriteMediaLinks(`<video src='${origin}/tmp/a.mp4'>`, origin), "<video src='media/tmp/a.mp4'>");
  assert.equal(rewriteMediaLinks('![x](http://localhost:8000/tmp/b.png)', origin), '![x](media/tmp/b.png)');
  assert.equal(rewriteMediaLinks('{"c":"<video src=\\"/files/clip.mp4\\">"}', origin), '{"c":"<video src=\\"media/files/clip.mp4\\">"}');
  assert.equal(rewriteMediaLinks('https://cdn.example/x.mp4', origin), 'https://cdn.example/x.mp4');
});

test('media: mix, concat and speech MP3 run on this machine', { skip: !fs.existsSync(ffmpegPath) && 'FFmpeg not found' }, async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-media-'));
  try {
    execFileSync(ffmpegPath, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=15:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(work, 'clip.mp4')]);
    execFileSync(ffmpegPath, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'aevalsrc=0.05*sin(2*PI*220*t)+0.75*lt(mod(t\\,0.6)\\,0.003)*sin(2*PI*2500*t):d=1.8:s=24000', path.join(work, 'voice.wav')]);
    const video = fs.readFileSync(path.join(work, 'clip.mp4')), audio = fs.readFileSync(path.join(work, 'voice.wav'));
    const form = new FormData();
    form.set('video', new Blob([video], { type: 'video/mp4' }), 'source.mp4');
    form.set('audio', new Blob([audio], { type: 'audio/wav' }), 'voice.wav');
    const mixed = await call('/gw/media/mix', { method: 'POST', body: form });
    assert.equal(mixed.status, 200);
    fs.writeFileSync(path.join(work, 'mixed.mp4'), Buffer.from(await mixed.arrayBuffer()));
    const measure = spawnSync(ffmpegPath, ['-hide_banner', '-i', path.join(work, 'mixed.mp4'), '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const loudness = Number([...measure.matchAll(/I:\s*(-?[\d.]+) LUFS/g)].at(-1)[1]);
    assert.ok(Math.abs(loudness + 14) <= 1, `short line mixed at ${loudness} LUFS`);
    assert.match(measure, /Duration: 00:00:0[23]\./, 'a short line is padded to 3 s, not cut');

    const silent = new FormData();
    silent.set('video', new Blob([video], { type: 'video/mp4' }), 'source.mp4');
    assert.equal((await call('/gw/media/mix', { method: 'POST', body: silent })).status, 200);

    const demo = new FormData();
    demo.append('clip', new Blob([video]), 'a.mp4'); demo.append('clip', new Blob([video]), 'b.mp4');
    const concat = await call('/gw/media/concat', { method: 'POST', body: demo });
    assert.equal(concat.status, 200);
    assert.equal(Buffer.from(await concat.arrayBuffer()).subarray(4, 8).toString(), 'ftyp');

    const answer = new FormData();
    answer.set('audio', new Blob([audio], { type: 'audio/wav' }), 'answer.wav');
    const mp3 = Buffer.from(await (await call('/gw/media/speech-mp3', { method: 'POST', body: answer })).arrayBuffer());
    assert.ok(mp3.subarray(0, 3).toString() === 'ID3' || (mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0), 'an MP3 comes back');

    const broken = new FormData();
    broken.set('video', new Blob([Buffer.from('not a video')]), 'source.mp4');
    const failed = await call('/gw/media/mix', { method: 'POST', body: broken });
    assert.equal(failed.status, 422);
    assert.doesNotMatch(await failed.text(), /ffmpeg|Invalid data|[A-Z]:\\|\.exe|interview-gateway-/i, 'no tool output or path reaches the caller');
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
});


test('admin endpoints require a separate key; application keys cannot change spending or pause', async () => {
  for (const route of ['/gw/admin/status','/gw/admin/pause','/gw/admin/credit-grants']) {
    const reply=await call(route, {method: route.endsWith('/status') ? 'GET' : 'POST'}); assert.equal(reply.status,401);
  }
  config.adminKey='separate-admin-key-0123456789abcdef';
  const reply=await call('/gw/admin/status',{headers:{authorization:'Bearer '+config.adminKey}}); assert.equal(reply.status,200);
});

test('approved credits are scoped to one account and Vietnam day; identical retries and restarts do not add twice', () => {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'admin-credit-test-'));
  const policy={perAccountDailyCredits:300,timeZone:'Asia/Ho_Chi_Minh'};
  let time=new Date('2026-10-10T10:00:00Z');
  try {
    const a='a'.repeat(64), b='b'.repeat(64), actor='c'.repeat(64);
    const ledger=new Ledger(folder,policy,()=>time);
    const grant={id:'support-7',account:a,actor,credits:100,day:'2026-10-10'};
    ledger.reserve(290,'test',a); assert.match(ledger.refusal(20,a),/hạn mức/);
    ledger.grant(grant);ledger.grant(grant);assert.equal(ledger.usage(a).day.cap,400);assert.equal(ledger.usage(b).day.cap,300);assert.equal(ledger.usage(a).day.used,290);assert.equal(ledger.refusal(20,a),null);
    assert.throws(()=>ledger.grant({...grant,credits:200}),/đã có/);
    assert.throws(()=>ledger.grant({...grant,id:'support-8',credits:-100}),/không hợp lệ/);
    assert.throws(()=>ledger.grant({...grant,id:'support-8',day:'2026-10-11'}),/không hợp lệ/);
    const recovered=new Ledger(folder,policy,()=>time);recovered.grant(grant);assert.equal(recovered.usage(a).day.cap,400);
    time=new Date('2026-10-10T17:00:00Z');assert.equal(recovered.usage(a).day.cap,300);assert.equal(recovered.usage(a).day.used,0);
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('admin pause persists and resumes; credit grant route is bounded and idempotent', async () => {
  const headers={authorization:'Bearer '+config.adminKey};
  let reply=await postJson('/gw/admin/pause',{},headers);assert.equal(reply.status,200);
  reply=await postJson('/gw/video/generation/preview',{cost:0});assert.equal(reply.status,423);
  reply=await postJson('/gw/admin/resume',{},headers);assert.equal(reply.status,200);
  const grant={id:'support-123',account:'e'.repeat(64),actor:'f'.repeat(64),credits:25,day:ledger.day(new Date())};
  for(let attempt=0;attempt<2;attempt++){reply=await postJson('/gw/admin/credit-grants',grant,headers);assert.equal(reply.status,200);}
  assert.equal(ledger.grants.filter(g=>g.id===grant.id).length,1);
  reply=await postJson('/gw/admin/credit-grants',{...grant,credits:26},headers);assert.equal(reply.status,409);
  reply=await postJson('/gw/admin/credit-grants',{...grant,id:'support-124',credits:10001},headers);assert.equal(reply.status,400);
});
