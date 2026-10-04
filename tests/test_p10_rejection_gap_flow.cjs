const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');
const assert = require('assert');

console.log('--- RUNNING P10: REJECTION REASON + PER-JOB LEARNING PATH + CANDIDATE RESPONSES ---');

const repoRoot = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf8');

function stubEl(id) {
    return {
        id, hidden: false, disabled: false, value: '', innerText: '', innerHTML: '', style: {}, dataset: {},
        classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
        setAttribute(k, v) { this[k] = v; }, getAttribute(k) { return this[k]; },
        querySelector() { return null; }, querySelectorAll() { return []; },
        addEventListener() {}, appendChild() {}, focus() {}
    };
}

function sandboxDoc(elements) {
    return {
        getElementById(id) { return elements[id] || (elements[id] = stubEl(id)); },
        querySelector(sel) { return sel.startsWith('#') ? this.getElementById(sel.slice(1)) : null; },
        querySelectorAll() { return []; },
        addEventListener() {},
        createElement(tag) { return stubEl(tag); },
        body: stubEl('body')
    };
}

(async function run() {
    try {
        // 1. Employer: modal từ chối gửi nhóm lý do đã chọn kèm lời nhắn.
        {
            const elements = {};
            const doc = sandboxDoc(elements);
            const modal = doc.getElementById('rejectionModal');
            modal.querySelector = (sel) => sel.includes('rejectionCategory') ? { value: 'Experience' } : null;
            const sent = [];
            const fakeFetch = (url, opts) => {
                if (url.includes('GetRejectionTemplates')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, templates: ['Mẫu 1'] }) });
                sent.push({ url, body: JSON.parse(opts.body) });
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
            };
            class FakeModal { show() {} hide() {} }
            const sandbox = {
                console, setTimeout, clearTimeout, document: doc, fetch: fakeFetch,
                bootstrap: { Modal: FakeModal },
                ArisMotion: { toast() {}, openDialog() {}, closeDialog() {} }
            };
            sandbox.window = sandbox;
            vm.runInNewContext(read('ArisSkyve/wwwroot/js/pages/employer.js'), sandbox);
            const { openRejectionModal, mapApplicant } = sandbox.window.__employerInternals;
            const app = mapApplicant({ id: 7, fullName: 'Ứng viên A', status: 'Shortlisted', jobTitle: 'Backend' });
            openRejectionModal(app, 'Shortlisted');
            assert(elements.rejectionCategoryChoices.innerHTML.includes('value="Skills"'), 'Category chips must be rendered');
            elements.rejectionReasonInput.value = 'Cần thêm 1 năm kinh nghiệm .NET';
            elements.confirmRejectBtn.onclick();
            await new Promise(r => setTimeout(r, 20));
            const update = sent.find(s => s.url.includes('UpdateApplicationStatus'));
            assert(update, 'UpdateApplicationStatus must be called');
            assert.strictEqual(update.body.Status, 'Rejected');
            assert.strictEqual(update.body.RejectionCategory, 'Experience');
            assert.strictEqual(update.body.Note, 'Cần thêm 1 năm kinh nghiệm .NET');
            assert.strictEqual(app.status, 'Rejected');
            console.log('PASS: employer rejection modal sends RejectionCategory + note');
        }

        // 2. Ứng viên: lộ trình theo chặng — đúng thứ tự, escape tên kỹ năng, phần trăm khớp.
        {
            const sandbox = { console, setTimeout, clearTimeout, document: sandboxDoc({}) };
            sandbox.window = sandbox;
            vm.runInNewContext(read('ArisSkyve/wwwroot/js/match-insight.js'), sandbox);
            const MI = sandbox.window.ArisMatchInsight;
            assert(MI && typeof MI.renderGapPlan === 'function', 'ArisMatchInsight.renderGapPlan must be exported');
            const html = MI.renderGapPlan({
                coverageNow: 25, coverageAfterStage1: 50, totalSteps: 4,
                steps: [
                    { skill: 'aws', stage: 2, stageLabel: 'Tiếp theo', relatedTo: [], after: ['docker'], activePostings: 40, opens: 9 },
                    { skill: 'docker', stage: 1, stageLabel: 'Bắt đầu ngay', relatedTo: ['linux'], after: [], activePostings: 64, opens: 18 },
                    { skill: '<img onerror=x>', stage: 3, stageLabel: 'Mở rộng', relatedTo: [], after: [], activePostings: 3, opens: 0 }
                ],
                matched: ['python'], softSkills: ['giao tiếp'], unmapped: []
            });
            const iDocker = html.indexOf('>docker<'), iAws = html.indexOf('>aws<');
            assert(iDocker > 0 && iAws > iDocker, 'Stage 1 skills must come before stage 2');
            assert(html.includes('dựa trên linux bạn đã có') && html.includes('học sau docker'), 'Each step must say why');
            assert(html.includes('<b>25%</b>') && html.includes('<b>50%</b>'), 'Coverage now and after stage 1 shown');
            assert(html.includes('Và 1 kỹ năng khác'), 'Hidden steps are counted');
            assert(!html.includes('<img onerror'), 'Skill names must be escaped');
            const rej = MI.renderRejection({ label: 'Kinh nghiệm chưa đủ cho vị trí', note: '<b>x</b>' });
            assert(rej.includes('Kinh nghiệm chưa đủ') && rej.includes('&lt;b&gt;x&lt;/b&gt;'), 'Rejection note must be escaped');
            console.log('PASS: candidate gap plan renders ordered stages, reasons and escapes input');
        }

        // 3. Trang đơn ứng tuyển: trả lời lịch/offer gọi đúng endpoint và có token chống CSRF.
        {
            const js = read('ArisSkyve/wwwroot/js/application-actions.js');
            const partial = read('ArisSkyve/Views/JobApplications/_MyApplicationsPartial.cshtml');
            assert(js.includes("'/JobApplications/RespondToInterview'") && js.includes('proposedSlots: proposed'), 'Decline sends proposed slots');
            assert(js.includes("'/JobApplications/RespondToOffer'") && js.includes("'RequestVerificationToken': antiForgeryToken()"), 'Offer response sends the anti-forgery token');
            assert(partial.includes('@Html.AntiForgeryToken()'), 'Partial renders the anti-forgery token');
            ['acceptInterview', 'declineInterview', 'acceptOffer', 'declineOffer'].forEach(a =>
                assert(partial.includes(`data-app-act="${a}"`), `Partial renders ${a}`));
            assert(partial.includes('data-insight-app="@app.Id"') && partial.includes('Xem lý do &amp; lộ trình kỹ năng'), 'Rejected card links to reasons + path');
            assert(partial.includes('VnTime.Format(app.InterviewAt.Value'), 'Interview time is shown in Vietnam time, not UTC');
            const view = read('ArisSkyve/Views/Employer/Index.cshtml');
            assert(view.includes('@Html.AntiForgeryToken()') && view.includes('id="rejectionCategoryChoices"'), 'Employer view has token + category choices');
            console.log('PASS: candidate responses + employer view wiring');
        }

        // 4. Controller + EF thật.
        let out;
        try {
            out = cp.execFileSync('dotnet', ['run', '--project', 'tests/BackendEfTests/BackendEfTests.csproj', '--no-build', '--', 'recruit'], { encoding: 'utf8', cwd: repoRoot });
        } catch {
            out = cp.execFileSync('dotnet', ['run', '--project', 'tests/BackendEfTests/BackendEfTests.csproj', '--', 'recruit'], { encoding: 'utf8', cwd: repoRoot });
        }
        ['P10.1', 'P10.2', 'P10.3', 'P10.4', 'P10.5', 'P10.6'].forEach(k => assert(out.includes(`✓ ${k}`), `EF case ${k} must pass`));
        console.log('PASS: real EF Core cases P10.1–P10.6');

        console.log('\n--- All P10 tests passed (4/4) ---');
    } catch (err) {
        console.error('P10 FAILED:', err);
        process.exit(1);
    }
})();
