import assert from 'node:assert/strict';

// This suite submits videos only to the local fake provider. Never target a real preview.
const base = process.argv[2] || 'http://localhost:5030';
assert.ok(['http://localhost:5030', 'http://localhost:5031'].includes(new URL(base).origin), 'Use only a dedicated fake provider preview on 5030 or 5031.');
const provider = 'http://127.0.0.1:5302';
const decode = text => String(text ?? '').replace(/&#x([\dA-F]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const token = html => html.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/)?.[1];
function session() {
  const cookies = new Map();
  async function go(url, init = {}) {
    const headers = new Headers(init.headers);
    if (cookies.size) headers.set('Cookie', [...cookies].map(([key, value]) => `${key}=${value}`).join('; '));
    const response = await fetch(base + url, { ...init, headers, redirect: 'manual' });
    for (const cookie of response.headers.getSetCookie()) { const value = cookie.split(';')[0], index = value.indexOf('='); cookies.set(value.slice(0, index), value.slice(index + 1)); }
    return response;
  }
  go.html = async url => { const response = await go(url); assert.equal(response.status, 200); return response.text(); };
  return go;
}
const owner = session(), other = session();
await owner('/Account/QuickLogin?email=port.owner%40example.test');
await other('/Account/QuickLogin?email=port.other%40example.test');
const ownerToken = token(await owner.html('/Employer/InterviewFlow/New'));
const otherToken = token(await other.html('/Employer/InterviewFlow/New'));
const configure = async values => { const response = await fetch(provider + '/__config', { method: 'POST', body: JSON.stringify(values) }); assert.equal(response.status, 200); return response.json(); };
const requests = async () => (await fetch(provider + '/__requests')).json();
const paid = async since => (await requests()).slice(since).filter(call => call.url === '/v1/chat/completions');
const post = async (go, url, body = {}, antiToken = undefined) => {
  return go(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(antiToken !== null ? { RequestVerificationToken: antiToken ?? (go === owner ? ownerToken : otherToken) } : {}) }, body: JSON.stringify(body) });
};
const jsonPost = async (url, body = {}) => { const response = await post(owner, url, body); assert.equal(response.status, 200); return response.json(); };
const jsonGet = async url => { const response = await owner(url); assert.equal(response.status, 200); return response.json(); };
async function waitUntil(read, condition, message) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { const value = await read(); if (condition(value)) return value; await new Promise(resolve => setTimeout(resolve, 40)); }
  throw new Error(message);
}
let count = 0;
const check = (label, result) => { assert.ok(result, label); count++; console.log('PASS ' + label); };
// The accumulated fake log can be large (reference image payloads); leave enough
// time to read it before the first render completes, even after previous suites.
const previous = await configure({ credits: 10, fail: '', delayMs: 10000, unavailableAccounts: [], accounts: [{ token_id: 2, credits: 500, video_enabled: true }, { token_id: 7, credits: 1000, video_enabled: true }] });
let kitId;
try {
  const body = new FormData();
  body.append('__RequestVerificationToken', token(await owner.html('/Employer/InterviewFlow/New')));
  for (const [key, value] of Object.entries({ Title: 'Stop video regression', Persona: 'Nhân vật hoạt hình thân thiện.', Scene: 'Phòng họp cố định.', 'Production.CreditMode': 'pool', 'Production.VoiceId': '', 'Questions[0].Question': 'Bạn có biết C không?', 'Questions[0].AnswerKey': 'Có.' })) body.append(key, value);
  const saved = await owner('/Employer/InterviewFlow/Save', { method: 'POST', body });
  assert.equal(saved.status, 302);
  kitId = Number(saved.headers.get('location').split('/').at(-1));
  let html = await owner.html('/Employer/InterviewFlow/' + kitId);
  const questionId = Number(html.match(/data-name="Id"[^>]*value="(\d+)"/)?.[1]);
  assert.ok(questionId);
  const script = new FormData(); script.append('__RequestVerificationToken', token(html)); script.append('approve', 'true');
  ['intro', 'question', 'transition', 'outro'].forEach((kind, index) => {
    script.append(`lines[${index}].Kind`, kind); script.append(`lines[${index}].Line`, kind === 'question' ? 'Bạn có biết C không?' : 'Xin chào bạn.');
    if (kind === 'question') script.append(`lines[${index}].QuestionId`, questionId);
  });
  assert.equal((await owner(`/Employer/InterviewFlow/${kitId}/Script/Save`, { method: 'POST', body: script })).status, 302);
  html = await owner.html('/Employer/InterviewFlow/' + kitId);
  check('manual first script is approved without an AI rewrite', /Kịch bản\s*✓/.test(decode(html)));
  const route = `/Employer/InterviewFlow/${kitId}/Videos`;
  check('idle kit reports no running videos', (await jsonGet(route + '/Status')).busy === false);
  check('stop rejects a missing antiforgery token', (await post(owner, route + '/Stop', {}, null)).status === 400);
  check('another employer cannot stop this kit', (await post(other, route + '/Stop')).status === 404);
  check('another employer cannot inspect this kit status', (await other(route + '/Status')).status === 404);
  check('stop rejects an unknown kit', (await post(owner, '/Employer/InterviewFlow/999999/Videos/Stop')).status === 404);

  // Stop also closes cost dialogs that were already priced but not submitted.
  const pendingStart = (await requests()).length;
  const pendingQuote = await jsonPost(route + '/Quote', { kind: 'intro' });
  const pendingBatch = await jsonPost(route + '/QuoteAll', { replaceExisting: false });
  check('quotes reach only the fake provider', (await requests()).slice(pendingStart).some(call => call.url === '/v1/generation/preview'));
  check('stop is accepted while only approvals are pending', (await jsonPost(route + '/Stop')).ok === true);
  check('a stopped single approval cannot later submit a video', (await jsonPost(route + '/Render', { quoteId: pendingQuote.quoteId })).ok === false);
  check('a stopped batch approval cannot later submit videos', (await jsonPost(route + '/RenderAll', { batchId: pendingBatch.batchId })).ok === false);
  check('pending batch records the stopped state', (await jsonGet('/Employer/InterviewFlow/Batches/' + pendingBatch.batchId)).state === 'stopped');
  check('stopping pending approvals submits no paid video requests', (await paid(pendingStart)).length === 0);

  const legacy = await jsonPost(route + '/QuoteAll', { replaceExisting: false });
  check('existing batch stop route remains supported', (await jsonPost('/Employer/InterviewFlow/Batches/' + legacy.batchId + '/Stop')).ok === true && (await jsonGet('/Employer/InterviewFlow/Batches/' + legacy.batchId)).state === 'stopped');

  const batchQuote = await jsonPost(route + '/QuoteAll', { replaceExisting: false });
  check('a new approval remains possible after stopping old ones', batchQuote.ok === true && batchQuote.count === 8);
  const batchStart = (await requests()).length;
  const batch = await jsonPost(route + '/RenderAll', { batchId: batchQuote.batchId });
  assert.ok(batch.ok);
  await waitUntil(() => paid(batchStart), calls => calls.length >= 1, 'Fake batch never submitted its first clip');
  const runningBatch = await jsonGet(route + '/Status');
  check('kit status exposes its running batch', runningBatch.busy === true && runningBatch.batchId === batch.batchId && !runningBatch.jobId);
  html = await owner.html('/Employer/InterviewFlow/' + kitId);
  const stopButton = html.match(/<button\b[^>]*\bdata-video-stop\b[^>]*>/)?.[0];
  check('page reload keeps the top stop button enabled during a batch', !!stopButton && !/\bdisabled/.test(stopButton) && html.includes(`data-batch="${batch.batchId}"`));
  check('another employer cannot stop a running batch by its ID', (await post(other, '/Employer/InterviewFlow/Batches/' + batch.batchId + '/Stop')).status === 404);
  const stoppedBatch = await jsonPost(route + '/Stop');
  check('stop acknowledges the already submitted clip', stoppedBatch.ok === true && stoppedBatch.busy === true && stoppedBatch.stopRequested === true);
  check('status keeps the stop request while the clip completes', (await jsonGet(route + '/Status')).stopRequested === true);
  const batchFinal = await waitUntil(() => jsonGet('/Employer/InterviewFlow/Batches/' + batch.batchId), state => state.state !== 'running', 'Stopped batch did not finish');
  check('batch saves the submitted clip then stops', batchFinal.state === 'stopped' && batchFinal.done === 1 && batchFinal.completed.length === 1);
  check('batch never submits the next video after stopping', (await paid(batchStart)).length === 1);
  check('status becomes idle after graceful batch stop', (await jsonGet(route + '/Status')).busy === false);
  html = await owner.html('/Employer/InterviewFlow/' + kitId);
  check('the submitted clip remains in its slot', /<article\b[^>]*data-kind="intro"[^>]*>[\s\S]*?<video\b/.test(html));

  const singleQuote = await jsonPost(route + '/Quote', { kind: 'question', questionId });
  assert.ok(singleQuote.ok);
  const singleStart = (await requests()).length;
  const single = await jsonPost(route + '/Render', { kind: 'question', questionId, quoteId: singleQuote.quoteId });
  assert.ok(single.ok);
  await waitUntil(() => paid(singleStart), calls => calls.length >= 1, 'Fake singleton never submitted its clip');
  const runningSingle = await jsonGet(route + '/Status');
  check('kit status exposes a running single video', runningSingle.busy === true && runningSingle.jobId === single.jobId && !runningSingle.batchId);
  html = await owner.html('/Employer/InterviewFlow/' + kitId);
  const singleStopButton = html.match(/<button\b[^>]*\bdata-video-stop\b[^>]*>/)?.[0];
  check('reload restores single-job polling and the enabled top stop button', html.includes(`data-video-job="${single.jobId}"`) && !!singleStopButton && !/\bdisabled/.test(singleStopButton));
  check('another employer cannot stop a single job by its ID', (await post(other, '/Employer/InterviewFlow/Jobs/' + single.jobId + '/Stop')).status === 404);
  check('single job stop also requires antiforgery protection', (await post(owner, '/Employer/InterviewFlow/Jobs/' + single.jobId + '/Stop', {}, null)).status === 400);
  check('single job stop endpoint accepts its owner', (await jsonPost('/Employer/InterviewFlow/Jobs/' + single.jobId + '/Stop')).ok === true);
  const singleFinal = await waitUntil(() => jsonGet('/Employer/InterviewFlow/Jobs/' + single.jobId), state => state.state !== 'running', 'Stopped singleton did not finish');
  check('single video finishes with stopped state and preserves its result', singleFinal.state === 'stopped' && singleFinal.stopRequested === true && singleFinal.message.includes('được lưu'));
  check('stopped singleton sends exactly one video request', (await paid(singleStart)).length === 1);
  html = await owner.html('/Employer/InterviewFlow/' + kitId);
  const questionArticle = [...html.matchAll(/<article\b[^>]*data-slot\b[^>]*>([\s\S]*?)<\/article>/g)].find(match => match[0].includes(`data-question="${questionId}"`));
  check('single video remains available in the question slot', !!questionArticle && /<video\b/.test(questionArticle[1]));
  const idleButton = html.match(/<button\b[^>]*\bdata-video-stop\b[^>]*>/)?.[0];
  check('top stop button returns to disabled while idle', !!idleButton && /\bdisabled/.test(idleButton) && (await jsonGet(route + '/Status')).busy === false);
  console.log(`STOP CHECKS PASSED (${count}); fake provider renders=2, real provider renders=0`);
} finally {
  if (kitId) {
    await jsonPost(`/Employer/InterviewFlow/${kitId}/Videos/Stop`).catch(() => {});
    await waitUntil(() => jsonGet(`/Employer/InterviewFlow/${kitId}/Videos/Status`), state => !state.busy, 'Fake cleanup did not become idle').catch(() => {});
  }
  await configure({ delayMs: 0, fail: '', unavailableAccounts: [], accounts: previous.accounts });
}
