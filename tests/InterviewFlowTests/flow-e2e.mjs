// Runs only against an isolated Aris instance and fake providers, never a production DB or paid API.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), C = require('../../ArisSkyve/wwwroot/js/pages/interview-data.js');
const base = process.argv[2] || 'http://localhost:5027';
let passed = 0;
const check = (name, condition) => { assert.ok(condition, name); console.log('PASS ' + name); passed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = text => text.replace(/&#x([\dA-F]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const token = html => html.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/)?.[1];
function session() {
    const cookies = new Map();
    async function go(url, init = {}) { const headers = new Headers(init.headers); if (cookies.size) headers.set('Cookie', [...cookies].map(([k, v]) => `${k}=${v}`).join('; ')); const response = await fetch(base + url, { ...init, headers, redirect: 'manual' }); for (const c of response.headers.getSetCookie()) { const [kv] = c.split(';'), i = kv.indexOf('='); cookies.set(kv.slice(0, i), kv.slice(i + 1)); } return response; }
    go.html = async url => decode(await (await go(url)).text());
    go.post = async (url, body, t) => { const r = await go(url, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: t }, body: JSON.stringify(body ?? {}) }); const data = await r.json().catch(() => ({})); return { status: r.status, ...data }; };
    go.form = (url, body, t) => go(url, { method: 'POST', headers: { RequestVerificationToken: t }, body }); return go;
}
const knobs = async body => (await fetch('http://127.0.0.1:5302/__config', { method: 'POST', body: JSON.stringify(body) })).json();
const calls = async () => (await fetch('http://127.0.0.1:5302/__requests')).json();
const initialRenderCount = (await calls()).filter(c => c.url === '/v1/chat/completions').length;
async function employer(email) { const go = session(); await go('/Account/QuickLogin?email=' + email); const html = await go.html('/Employer/InterviewFlow/New'); check('prepare isolated employer ' + email, html.includes('data-kit')); return go; }
const owner = await employer('port.owner@example.test'), other = await employer('port.other@example.test'), candidate = session(); await candidate('/Account/QuickLogin?email=port.candidate@example.test');
async function newKit(settings = {}, count = 2) {
    const t = token(await owner.html('/Employer/InterviewFlow/New')), body = new FormData(); body.append('__RequestVerificationToken', t); body.append('Title', 'Port all flows'); body.append('Persona', 'Nhân vật hoạt hình trong ảnh, thân thiện.');
    for (const [key, value] of Object.entries(settings)) body.append('Production.' + key, value);
    for (let i = 0; i < count; i++) for (const [key, value] of Object.entries({ Code: `q${i + 1}`, Question: `Câu ${i + 1}: nguồn reset clock?`, AnswerKey: 'nguồn reset clock', KeyPoints: 'nguồn;reset;clock', PointWeights: '2;1;1', Weight: i ? 1 : 3, PrepSeconds: 0, AnswerSeconds: 15 })) body.append(`Questions[${i}].${key}`, value);
    const result = await owner.form('/Employer/InterviewFlow/Save', body, t); const id = Number(result.headers.get('location')?.match(/\/(\d+)$/)?.[1]); check('kit saved with settings and weighted questions', id > 0); return id;
}
async function approve(id) {
    let html = await owner.html(`/Employer/InterviewFlow/${id}`), t = token(html); const written = await owner.post(`/Employer/InterviewFlow/${id}/Script/Write`, {}, t); assert.ok(written.ok, written.error);
    html = await owner.html(`/Employer/InterviewFlow/${id}`); t = token(html); const body = new FormData(); body.append('__RequestVerificationToken', t); body.append('approve', 'true');
    for (const [, index, kind, qid, line] of html.matchAll(/name="lines\[(\d+)\]\.(Kind|QuestionId|Line)"(?: value="([^"]*)")?[^>]*>([^<]*)/g)) body.append(`lines[${index}].${kind}`, kind === 'Line' ? line : qid);
    const result = await owner.form(`/Employer/InterviewFlow/${id}/Script/Save`, body, t); assert.equal(result.status, 302); return token(await owner.html(`/Employer/InterviewFlow/${id}`));
}
async function waitJob(id, batch = false) { for (let i = 0; i < 300; i++) { const state = await (await owner(`/Employer/InterviewFlow/${batch ? 'Batches' : 'Jobs'}/${id}`)).json(); if (state.state !== 'running') return state; await sleep(200); } throw new Error('Job timed out'); }
// Pure import behavior, including real 26Flow examples.
const parsed = C.parse('id,cau_hoi,dap_an,y_chinh\nq1,"Câu có, dấu phẩy",Đáp án,"ý một;ý hai"', 'sample.csv'); check('quoted CSV parsing', parsed[0].Question === 'Câu có, dấu phẩy' && parsed[0].KeyPoints === 'ý một;ý hai');
const structured = C.parse(JSON.stringify(C.sample), 'sample.json'); check('JSON preserves point weights', structured[0].PointWeights === '2;1');
const merged = C.merge(structured, 'id,dap_an,y_chinh\nq1,Đáp án mới,"ý mới;ý tiếp"', 'answers.csv'); check('answer matching updates answer and rubric by code', merged[0].AnswerKey === 'Đáp án mới' && merged[0].KeyPoints === 'ý mới;ý tiếp' && merged[1].AnswerKey === structured[1].AnswerKey);
check('TXT parsing', C.parse('ID: q1\nCâu hỏi: Hỏi gì?\nĐáp án: Đáp án.', 'sample.txt').length === 1);
for (const input of ['id,cau_hoi,dap_an\nq1,Hỏi,Đáp\nq1,Hỏi khác,Đáp', '[{"id":"q1","question":"x","weight":-1}]']) { let rejected = false; try { C.parse(input, input.startsWith('[') ? 'q.json' : 'q.csv'); } catch { rejected = true; } check('invalid question file rejected', rejected); }
await knobs({ credits: 10, avatarCredits: 5, delayMs: 0, fail: '', expiresIn: 300 });
const native = await newKit(); let html = await owner.html(`/Employer/InterviewFlow/${native}`), t = token(html);
check('default avatar is present and full production controls render', html.includes('data:image/webp;base64,') && html.includes('data-voice-select') && html.includes('data-import-questions'));
check('no renders without approval', (await calls()).filter(c => c.url === '/v1/chat/completions').length === initialRenderCount);
let body = new FormData(); body.append('Prompt', 'Nhân vật hoạt hình thân thiện'); body.append('UseCurrentAvatar', 'true');
let quote = await (await owner.form(`/Employer/InterviewFlow/${native}/Avatar/Quote`, body, t)).json(); check('avatar quote has credits and hides provider token', quote.ok && quote.cost === 5 && !JSON.stringify(quote).includes('provider-'));
await knobs({ avatarCredits: null }); const unpriced = await (await owner.form(`/Employer/InterviewFlow/${native}/Avatar/Quote`, body, t)).json(); await knobs({ avatarCredits: 5 });
check('image without an advance price is quoted with an unknown cost, not a server error', unpriced.ok === true && unpriced.cost === null);
check('another employer cannot use avatar approval', (await other.post(`/Employer/InterviewFlow/${native}/Avatar/Render`, { quoteId: quote.quoteId }, token(await other.html('/Employer/InterviewFlow/New')))).ok === false);
check('video endpoint cannot consume avatar quote', (await owner.post(`/Employer/InterviewFlow/${native}/Videos/Render`, { quoteId: quote.quoteId }, t)).ok === false);
const wrongKit = await newKit({}, 1); check('avatar quote bound to kit', (await owner.post(`/Employer/InterviewFlow/${wrongKit}/Avatar/Render`, { quoteId: quote.quoteId }, t)).ok === false);
let job = await owner.post(`/Employer/InterviewFlow/${native}/Avatar/Render`, { quoteId: quote.quoteId }, t); check('avatar rendering starts after approval', job.ok); check('avatar approval is single use', !(await owner.post(`/Employer/InterviewFlow/${native}/Avatar/Render`, { quoteId: quote.quoteId }, t)).ok);
check('avatar stored after background render', (await waitJob(job.jobId)).state === 'succeeded');
html = await owner.html(`/Employer/InterviewFlow/${native}`); check('avatar update invalidates script approval', !html.includes('Đã duyệt</span>'));
t = await approve(native); quote = await owner.post(`/Employer/InterviewFlow/${native}/Videos/QuoteAll`, { replaceExisting: false }, t);
check('native batch remains nine clips / ninety credits', quote.ok && quote.count === 9 && quote.total === 90);
job = await owner.post(`/Employer/InterviewFlow/${native}/Videos/RenderAll`, { batchId: quote.batchId }, t); let state = await waitJob(job.batchId, true); check('native batch completes', state.state === 'succeeded' && state.done === 9);
check('native model duration chosen from the line', (await calls()).some(c => c.url === '/v1/generation/preview' && c.body.model.includes('4s')));
const voices = await (await owner('/Employer/InterviewFlow/Voices')).json(); check('voices include searchable gender and region metadata', voices.voices.length === 2 && voices.voices[0].gender === 'female' && voices.voices[0].region === 'north');
const sample = await owner('/Employer/InterviewFlow/Voices/Sample', { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: t }, body: JSON.stringify({ voiceId: 'vi_north_female_test' }) }); check('voice audition returns audio', sample.status === 200 && (await sample.arrayBuffer()).byteLength > 1000);
body = new FormData(); body.append('name', 'Test clone'); body.append('audio', new Blob([fs.readFileSync('.local/interview-fixtures/voice.wav')], { type: 'audio/wav' }), 'voice.wav'); const clone = await (await owner.form('/Employer/InterviewFlow/Voices/Clone', body, t)).json(); check('voice cloning returns new voice', clone.ok && clone.voice.id === 'clone-test');
for (const [mode, expected] of [['expressions', 5], ['shared', 1]]) {
    const id = await newKit({ VisualMode: mode, NarrationMode: 'tts', VoiceId: 'vi_north_female_test' }, 1); const ts = await approve(id);
    const startCalls = (await calls()).length; const q = await owner.post(`/Employer/InterviewFlow/${id}/Videos/QuoteAll`, { replaceExisting: false }, ts); check(mode + ' prices only unique base videos', q.ok && q.total === expected * 10 && q.items.filter(i => i.cost === 10).length === expected);
    const j = await owner.post(`/Employer/InterviewFlow/${id}/Videos/RenderAll`, { batchId: q.batchId }, ts); const s = await waitJob(j.batchId, true); check(mode + ' generates and composes every public clip', s.state === 'succeeded' && s.done === expected + 8);
    check(mode + ' spends only once per base', (await calls()).slice(startCalls).filter(c => c.url === '/v1/chat/completions').length === expected);
    const after = await owner.html(`/Employer/InterviewFlow/${id}`); const url = after.match(/<video src="([^"]+)"/)?.[1]; const file = await (await owner(url)).arrayBuffer(); fs.writeFileSync(`.local/interview-fixtures/${mode}-mixed.mp4`, Buffer.from(file));
    const demo = await owner(`/Employer/InterviewFlow/${id}/Videos/Demo`, { method: 'POST', headers: { RequestVerificationToken: ts } }); check(mode + ' exports an MP4 demo', demo.status === 200 && (await demo.arrayBuffer()).byteLength > 1000);
}
// Candidate privacy, recorded audio + STT, supplement, weighted finish and regrade/export.
html = await owner.html(`/Employer/InterviewFlow/${native}`); t = token(html); body = new FormData(); body.append('open', 'true'); await owner.form(`/Employer/InterviewFlow/${native}/Invite`, body, t);
html = await owner.html(`/Employer/InterviewFlow/${native}`); const code = html.match(/\/InterviewKit\/([a-f\d]{24})/)?.[1]; assert.ok(code);
const ct = token(await candidate.html('/InterviewKit/' + code)), plan = await candidate.post(`/InterviewKit/${code}/Start`, {}, ct);
check('candidate plan hides answers and rubric', plan.questions.length === 2 && !JSON.stringify(plan).includes('answerKey') && !JSON.stringify(plan).includes('pointWeights'));
body = new FormData(); body.append('sessionId', plan.sessionId); body.append('questionId', plan.questions[0].id); body.append('transcribe', 'true'); body.append('audio', new Blob([fs.readFileSync('.local/interview-fixtures/voice.wav')], { type: 'audio/wav' }), 'answer.wav');
const recording = await (await candidate.form(`/InterviewKit/${code}/Recording`, body, ct)).json(); check('recorded audio is stored and transcribed', recording.ok && recording.transcript === 'nguồn reset clock');
let answer = await candidate.post(`/InterviewKit/${code}/Answer`, { sessionId: plan.sessionId, questionId: plan.questions[0].id, transcript: 'nguồn', recordingId: recording.recordingId }, ct);
check('partial answer offers supplement without exposing points or score', answer.action === 'supplement' && answer.score == null && answer.points == null);
const extraAudio = Buffer.from(fs.readFileSync('.local/interview-fixtures/voice.wav')); extraAudio[extraAudio.length - 1] ^= 1;
body = new FormData(); body.append('sessionId', plan.sessionId); body.append('questionId', plan.questions[0].id); body.append('audio', new Blob([extraAudio], { type: 'audio/wav' }), 'supplement.wav');
const extraRecording = await (await candidate.form(`/InterviewKit/${code}/Recording`, body, ct)).json();
check('supplement keeps original recording instead of replacing it', extraRecording.ok && extraRecording.recordingId !== recording.recordingId);
answer = await candidate.post(`/InterviewKit/${code}/Answer`, { sessionId: plan.sessionId, questionId: plan.questions[0].id, transcript: 'reset clock', supplement: true, recordingId: extraRecording.recordingId }, ct); check('supplement combines with prior answer', answer.passed && answer.action === 'next');
check('supplement limit enforced on server', (await candidate.post(`/InterviewKit/${code}/Answer`, { sessionId: plan.sessionId, questionId: plan.questions[0].id, transcript: 'again', supplement: true }, ct)).status === 400);
await candidate.post(`/InterviewKit/${code}/Answer`, { sessionId: plan.sessionId, questionId: plan.questions[1].id, transcript: '' }, ct);
const final = await candidate.post(`/InterviewKit/${code}/Finish`, { sessionId: plan.sessionId }, ct); check('candidate final exposes only aggregate reaction', final.done && final.passed && final.score == null);
check('owner may hear stored audio', (await owner(`/Employer/InterviewFlow/${native}/Recordings/${recording.recordingId}`)).status === 200);
check('other employer may not hear stored audio', (await other(`/Employer/InterviewFlow/${native}/Recordings/${recording.recordingId}`)).status === 404);
const result = await (await owner(`/Employer/InterviewFlow/${native}/Results/Export?format=json`)).json(); const run = result.sessions.find(s => s.id === plan.sessionId); check('finish uses question weights including unanswered/incorrect questions', run.score === 75 && run.answers[0].recordingId === extraRecording.recordingId);
check('results retain both recording segments', run.answers[0].recordingIds.includes(recording.recordingId) && run.answers[0].recordingIds.includes(extraRecording.recordingId));
check('completed interview cannot accept more answers', (await candidate.post(`/InterviewKit/${code}/Answer`, { sessionId: plan.sessionId, questionId: plan.questions[0].id, transcript: 'nguồn' }, ct)).status === 400);
check('completed candidate cannot start again', (await candidate.post(`/InterviewKit/${code}/Start`, {}, ct)).status === 409);
check('employer can regrade with current rubric', (await owner.post(`/Employer/InterviewFlow/${native}/Results/Regrade`, { sessionId: plan.sessionId, questionId: plan.questions[0].id }, t)).ok);
const csv = await owner(`/Employer/InterviewFlow/${native}/Results/Export?format=csv`); check('CSV has status and recorded answers', csv.status === 200 && (await csv.text()).includes('Đúng'));
// Price increase and expired approvals stop before spending credits.
const guard = await newKit({}, 1); const gt = await approve(guard); quote = await owner.post(`/Employer/InterviewFlow/${guard}/Videos/QuoteAll`, {}, gt); await knobs({ credits: 20 });
const before = (await calls()).filter(c => c.url === '/v1/chat/completions').length; job = await owner.post(`/Employer/InterviewFlow/${guard}/Videos/RenderAll`, { batchId: quote.batchId }, gt); state = await waitJob(job.batchId, true);
check('fresh quote cost increase stops batch', state.state === 'failed' && state.done === 0); check('price increase never invokes paid rendering', (await calls()).filter(c => c.url === '/v1/chat/completions').length === before);
await knobs({ credits: 10, expiresIn: 1 }); body = new FormData(); body.append('Prompt', 'Avatar mới'); quote = await (await owner.form(`/Employer/InterviewFlow/${guard}/Avatar/Quote`, body, gt)).json(); await sleep(1200); job = await owner.post(`/Employer/InterviewFlow/${guard}/Avatar/Render`, { quoteId: quote.quoteId }, gt); state = await waitJob(job.jobId);
check('expired avatar quote fails before rendering', state.state === 'failed' && (await calls()).filter(c => c.url === '/v1/chat/completions').length === before);
await knobs({ expiresIn: 300 });
const large = await newKit({}, 200); await approve(large);
html = await owner.html(`/Employer/InterviewFlow/${large}`);
check('two hundred questions and script lines save without form truncation', (html.match(/data-name="Question"/g) || []).length === 201 && html.includes('Câu 200: nguồn reset clock?'));
const longLine = 'Câu hỏi đầy đủ ' + 'nội dung '.repeat(90);
const longKit = await newKit({ NarrationMode: 'tts', VoiceId: 'vi_north_female_test' }, 1);
html = await owner.html(`/Employer/InterviewFlow/${longKit}`); const lt = token(html);
const longForm = new FormData(); longForm.append('Id', longKit); longForm.append('Title', 'Long TTS question'); longForm.append('UseDefaultAvatar', 'true'); longForm.append('Production.NarrationMode', 'tts'); longForm.append('Production.VoiceId', 'vi_north_female_test'); longForm.append('Questions[0].Code', 'long'); longForm.append('Questions[0].Question', longLine); longForm.append('Questions[0].AnswerKey', 'Đáp án');
check('long TTS question saves', (await owner.form('/Employer/InterviewFlow/Save', longForm, lt)).status === 302); await approve(longKit);
html = await owner.html(`/Employer/InterviewFlow/${longKit}`);
check('TTS script preserves question over six hundred characters', html.includes(longLine.trim()));
console.log(`ALL INTERVIEW PORT CHECKS PASSED (${passed})`);
