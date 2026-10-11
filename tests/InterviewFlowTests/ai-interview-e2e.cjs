// AI interview sent from the recruitment pipeline, on an isolated test host with fake providers:
// the company account posts a job and an interview kit, the candidate (an admin whose profile is a
// candidate profile) applies, the company sends an AI interview from the scheduling dialog, the
// candidate takes it from their application and the score comes back to the company's pipeline.
// Needs E2E:SeedInterviewAccounts + E2E:SeedAdminAccounts.  node ai-interview-e2e.cjs http://localhost:5028
const path = require('node:path');
const assert = require('node:assert/strict');
const puppeteer = require('../../ArisSkyve/node_modules/puppeteer-core');
const base = process.argv[2] || 'http://localhost:5028';
const shots = path.resolve('.local');
const COMPANY = 'xuanthangmuoi@gmail.com';
const CANDIDATE = 'tohkadangyeu@gmail.com';
let passed = 0;
const check = (name, condition) => { assert.ok(condition, name); console.log('PASS ' + name); passed++; };

// Same-origin JSON call from the page, with the layout's anti-forgery token.
const call = (page, url, { method = 'GET', body, form } = {}) => page.evaluate(async (url, method, body, form) => {
    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
    const init = { method, credentials: 'same-origin', headers: { RequestVerificationToken: token } };
    if (form) { const data = new FormData(); Object.entries(form).forEach(([k, v]) => data.append(k, v)); data.append('__RequestVerificationToken', token); init.body = data; }
    else if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    const response = await fetch(url, init);
    const text = await response.text();
    try { return { status: response.status, url: response.url, json: JSON.parse(text) }; } catch { return { status: response.status, url: response.url, json: null }; }
}, url, method, body, form);

async function loginAs(page, email, landing) {
    await page.goto(`${base}/Account/QuickLogin?email=${encodeURIComponent(email)}`);
    await page.goto(base + landing, { waitUntil: 'networkidle2' });
}

(async () => {
    const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setViewport({ width: 1280, height: 900 });

        await loginAs(page, COMPANY, '/Employer/InterviewFlow/New');
        const kitSave = await call(page, '/Employer/InterviewFlow/Save', { method: 'POST', form: {
            Title: 'Embedded AI e2e', PassPercent: '60', UseDefaultAvatar: 'true',
            'Questions[0].Question': 'Volatile dùng để làm gì?', 'Questions[0].AnswerKey': 'Ngăn trình biên dịch tối ưu biến đọc từ phần cứng',
            'Questions[0].KeyPoints': 'trình biên dịch;phần cứng', 'Questions[0].Code': 'q1', 'Questions[0].Weight': '1',
            'Questions[0].PrepSeconds': '0', 'Questions[0].AnswerSeconds': '30', 'Questions[0].Retakes': '1' } });
        const kitId = Number(new URL(kitSave.url).pathname.split('/').at(-1));
        check('company creates an interview kit', kitId > 0);
        await page.goto(base + '/Employer', { waitUntil: 'networkidle2' });
        const job = await call(page, '/Jobs/CreateJobPosting', { method: 'POST', body: { Title: 'Thực tập sinh Embedded (e2e)', Company: 'Admin fixture', FullText: 'Tin kiểm thử luồng phỏng vấn AI.' } });
        check('company posts a job', job.json?.success && job.json.jobId > 0);
        const jobId = job.json.jobId;
        await page.goto(base + '/Jobs', { waitUntil: 'networkidle2' });
        check('admin with a company profile gets the job management page with their posting', await page.evaluate(() =>
            document.title.includes('Quản lý tin tuyển dụng') && window.__IS_BUSINESS__ === true && document.body.innerText.includes('Thực tập sinh Embedded (e2e)')));

        await loginAs(page, CANDIDATE, '/Jobs');
        const resume = await call(page, '/Resume/CreateBlank', { method: 'POST' });
        const applied = await call(page, `/JobApplications/Apply?jobId=${jobId}`, { method: 'POST', body: { ResumeId: resume.json.resumeId, ScreeningAnswers: [] } });
        check('admin with a candidate profile can apply', applied.json?.success === true);
        const applicationId = applied.json.applicationId;

        await loginAs(page, COMPANY, `/Employer/Index?jobId=${jobId}&app=${applicationId}`);
        await page.waitForSelector('#drawerNextActions [data-next-act="schedule"]', { visible: true });
        await page.$eval('#drawerNextActions [data-next-act="schedule"]', el => el.click());
        await page.waitForSelector('#scheduleInterviewModal.show');
        check('scheduling dialog offers a live or AI interview', await page.$$eval('input[name="interviewMode"]', els => els.map(e => e.value).join() === 'live,ai'));
        check('live mode keeps time, duration and video room', await page.evaluate(() => document.getElementById('interviewAiFields').hidden && !document.getElementById('interviewDurationCol').hidden && !document.getElementById('interviewVideoCallBox').hidden));
        await page.$eval('input[name="interviewMode"][value="ai"]', el => el.click());
        await page.waitForFunction(id => [...document.querySelectorAll('#interviewKitSelect option')].some(o => o.value === String(id)), {}, kitId);
        check('AI mode lists the company kits and asks for a deadline', await page.evaluate(() => !document.getElementById('interviewAiFields').hidden
            && document.getElementById('interviewDurationCol').hidden && document.getElementById('interviewVideoCallBox').hidden
            && document.getElementById('interviewDateLabel').innerText === 'Hạn hoàn thành' && document.getElementById('confirmScheduleBtn').innerText === 'Gửi phỏng vấn AI'));
        await page.select('#interviewKitSelect', String(kitId));
        await page.screenshot({ path: path.join(shots, 'ai-interview-dialog.png') });
        await page.$eval('#confirmScheduleBtn', el => el.click());
        await page.waitForFunction(() => document.getElementById('drawerNextTitle')?.innerText.includes('phỏng vấn AI'), { timeout: 15000 });
        check('company sees the pipeline waiting for the AI interview', await page.$eval('#drawerNextTitle', el => el.innerText === 'Chờ ứng viên làm phỏng vấn AI'));

        await loginAs(page, CANDIDATE, `/JobApplications/MyApplications?app=${applicationId}`);
        const startLink = `a[href="/InterviewKit/Application/${applicationId}"]`;
        check('candidate gets a "take the AI interview" button on the application', !!(await page.$(startLink)));
        await page.goto(`${base}/InterviewKit/Application/${applicationId}`, { waitUntil: 'networkidle2' });
        check('candidate opens the AI interview without a public invite link', !!(await page.$('#interviewPlayer [data-start]')));
        const endpoint = await page.$eval('#interviewPlayer', el => el.dataset.endpoint);
        const plan = await call(page, endpoint + '/Start', { method: 'POST' });
        const question = plan.json.questions[0];
        await call(page, endpoint + '/Answer', { method: 'POST', body: { sessionId: plan.json.sessionId, questionId: question.id, transcript: 'Volatile ngăn trình biên dịch tối ưu biến được phần cứng thay đổi.' } });
        const finish = await call(page, endpoint + '/Finish', { method: 'POST', body: { sessionId: plan.json.sessionId } });
        check('candidate finishes the AI interview', finish.json?.done === true);
        await page.goto(`${base}/JobApplications/MyApplications?app=${applicationId}`, { waitUntil: 'networkidle2' });
        check('candidate then waits for the result instead of retaking it', await page.evaluate(() => document.body.innerText.includes('Bạn đã hoàn thành phỏng vấn AI')) && !(await page.$(startLink)));

        await loginAs(page, COMPANY, `/Employer/Index?jobId=${jobId}&app=${applicationId}`);
        await page.waitForFunction(() => document.getElementById('drawerNextTitle')?.innerText === 'Ứng viên đã làm phỏng vấn AI', { timeout: 15000 });
        check('company sees the AI score with a link to the answers', await page.evaluate(id => document.getElementById('drawerNextText').innerText.includes('/100')
            && !!document.querySelector(`#drawerNextActions a[href="/Employer/InterviewFlow/${id}#candidates"]`), kitId));
        check('drawer labels the time as the AI interview deadline', await page.$eval('#drawerInterviewLabel', el => el.innerText === 'Hạn làm phỏng vấn AI'));
        await page.screenshot({ path: path.join(shots, 'ai-interview-result.png') });
        check('no page errors', errors.length === 0 || (console.log(errors), false));
        console.log(`ALL AI INTERVIEW CHECKS PASSED (${passed})`);
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
