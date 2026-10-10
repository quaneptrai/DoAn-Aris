import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const dir = path.resolve('.local/interview-fixtures'); fs.mkdirSync(dir, { recursive: true });
const ffmpeg = process.env.INTERVIEW_FFMPEG || path.resolve('.local/interview-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
execFileSync(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=15:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(dir, 'clip.mp4')]);
execFileSync(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', path.join(dir, 'voice.wav')]);
const clip = fs.readFileSync(path.join(dir, 'clip.mp4')), audio = fs.readFileSync(path.join(dir, 'voice.wav')), image = fs.readFileSync('ArisSkyve/wwwroot/images/interview/interviewer-avatar.webp');
const log = [], approvals = new Map(), config = { credits: 10, avatarCredits: 5, delayMs: 0, fail: '', expiresIn: 300, accounts: [{token_id:2,credits:500,video_enabled:true},{token_id:7,credits:1000,video_enabled:true},{token_id:9,credits:0,video_enabled:true},{token_id:11,credits:700,video_enabled:false}] };
const read = req => new Promise(resolve => { let raw = ''; req.on('data', c => raw += c); req.on('end', () => resolve(raw)); });
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
http.createServer(async (req, res) => {
    const raw = await read(req); if (req.url === '/__config') { Object.assign(config, JSON.parse(raw)); return json(res, 200, config); } if (req.url === '/__requests') return json(res, 200, log);
    if (req.url === '/v1/generation/accounts') return json(res, 200, {accounts:config.accounts});
    if (req.url === '/files/clip.mp4') { res.writeHead(200, { 'Content-Type': 'video/mp4' }); return res.end(clip); }
    if (req.url === '/files/avatar.webp') { res.writeHead(200, { 'Content-Type': 'image/webp' }); return res.end(image); }
    const body = JSON.parse(raw || '{}'), avatar = body.model?.includes('image');
    log.push({ url: req.url, body, raw, approval: req.headers['x-flow-approval'] });
    if (req.url === '/v1/generation/preview') {
        if (config.unavailableAccounts?.includes(body.account_id)) return json(res, 503, { detail: 'Không chọn được tài khoản khả dụng. Kiểm tra trạng thái tài khoản.' });
        if (body.account_id) {
            const account = config.accounts.find(a => a.token_id === body.account_id && a.video_enabled);
            if (!account || account.credits < config.credits) return json(res, 409, { detail: 'Tài khoản vừa chọn không đủ credit.' });
        }
        const id = `provider-${crypto.randomUUID()}`; approvals.set(id, raw); return json(res, 200, { approval_token: id, estimated_credits: avatar ? config.avatarCredits : config.credits, expires_in: config.expiresIn });
    }
    if (req.url === '/v1/chat/completions') {
        const id = req.headers['x-flow-approval']; if (approvals.get(id) !== raw) return json(res, 409, { detail: 'approval/body mismatch' }); approvals.delete(id);
        if (config.delayMs) await new Promise(r => setTimeout(r, config.delayMs));
        if (config.fail === 'avatar-reference') return json(res, 500, { error: { message: 'Flow frontend RPC rejected: rpc=eb1hJf, code=[5]' }, flow2api_usage: { accounts:[{credit_balance_before:500,credit_balance_after:500}] } });
        if (config.fail) return json(res, 502, { error: { message: 'blocked by safety policy' } });
        res.writeHead(200, { 'Content-Type': 'text/event-stream' }); return res.end(`data: ${JSON.stringify({ choices: [{ delta: { content: avatar ? '![image](/files/avatar.webp)' : '<video src="/files/clip.mp4"></video>' } }] })}\n\ndata: [DONE]\n\n`);
    }
    json(res, 404, {});
}).listen(5302, '127.0.0.1');
http.createServer(async (req, res) => {
    const raw = await read(req);
    if (req.method === 'GET' && req.url === '/v1/models') return json(res, 200, { data: [{ id: 'test-model' }] });
    const body = JSON.parse(raw), user = JSON.parse(body.messages[1].content), system = body.messages[0].content;
    const content = system.includes('viết lời thoại') ? { intro: 'Xin chào bạn.', transition: 'Chúng ta sang câu tiếp theo.', outro: 'Cảm ơn bạn.', questions: user.questions.map(q => ({ id: q.id, line: q.question })) }
        : { points: user.key_points.map(p => ({ index: p.index, status: user.candidate_answer.toLowerCase().includes(p.text.toLowerCase()) ? 'covered' : 'missing', evidence: user.candidate_answer.toLowerCase().includes(p.text.toLowerCase()) ? p.text : '' })), feedback: 'Đã đối chiếu đáp án.' };
    json(res, 200, { choices: [{ message: { content: JSON.stringify(content) } }] });
}).listen(5301, '127.0.0.1');
http.createServer(async (req, res) => {
    const raw = await read(req);
    if (req.url === '/api/v1/voices' && req.method === 'GET') return json(res, 200, { voices: [{ id: 'vi_north_female_test', name: 'Nữ Bắc', gender: 'female' }, { id: 'vi_south_male_test', name: 'Nam Nam', gender: 'male' }] });
    if (req.url === '/api/v1/voices' && req.method === 'POST') return json(res, 200, { voice: { voice_id: 'clone-test', name: 'Giọng mẫu' } });
    if (req.url === '/v1/audio/speech') { res.writeHead(200, { 'Content-Type': 'audio/wav' }); return res.end(audio); }
    if (req.url === '/v1/audio/transcriptions') return json(res, 200, { text: 'nguồn reset clock' });
    json(res, 404, {});
}).listen(5303, '127.0.0.1');
console.log('Interview fake services: 5301/5302/5303');
