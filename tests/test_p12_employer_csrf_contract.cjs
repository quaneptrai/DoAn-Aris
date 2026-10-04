const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const applicationsController = read('ArisSkyve/Controllers/JobApplicationsController.cs');
const jobsController = read('ArisSkyve/Controllers/JobsController.cs');
const companyController = read('ArisSkyve/Controllers/CompanyController.cs');
const settingsController = read('ArisSkyve/Controllers/SettingsController.cs');
const socialConnectController = read('ArisSkyve/Controllers/SocialConnectController.cs');
const employerJs = read('ArisSkyve/wwwroot/js/pages/employer.js');
const jobsJs = read('ArisSkyve/wwwroot/js/pages/jobs.js');
const employerView = read('ArisSkyve/Views/Employer/Index.cshtml');
const jobsView = read('ArisSkyve/Views/Jobs/Index.cshtml');
const companyEditView = read('ArisSkyve/Views/Company/Edit.cshtml');
const settingsView = read('ArisSkyve/Views/Settings/Index.cshtml');
const profileView = read('ArisSkyve/Views/Profile/Index.cshtml');
const facebookPageView = read('ArisSkyve/Views/SocialConnect/SelectFacebookPage.cshtml');
const becomeEmployerJs = read('ArisSkyve/wwwroot/js/pages/become-employer.js');
const program = read('ArisSkyve/Program.cs');

console.log('--- RUNNING P12: EMPLOYER MUTATION CSRF CONTRACT ---');

function actionHasCsrf(source, actionName) {
    const action = `public async Task<IActionResult> ${actionName}(`;
    let actionIndex = source.indexOf(action);
    while (actionIndex >= 0) {
        const previousAction = source.lastIndexOf('public ', actionIndex - 1);
        const httpPost = source.lastIndexOf('[HttpPost]', actionIndex);
        if (httpPost > previousAction && source.slice(httpPost, actionIndex).includes('[ValidateAntiForgeryToken]')) return true;
        actionIndex = source.indexOf(action, actionIndex + action.length);
    }
    return false;
}

[
    'RescoreApplication',
    'QueueScoringForJob',
    'UpdateApplicationStatus',
    'ScheduleInterview',
    'SubmitEvaluation',
    'SendOffer'
].forEach((actionName) => assert(actionHasCsrf(applicationsController, actionName), `${actionName} must require CSRF validation`));

[
    'CreateJobPosting',
    'UpdateJobPosting',
    'ToggleJobActive',
    'ShareJob',
    'ExtractJobFromPdf'
].forEach((actionName) => assert(actionHasCsrf(jobsController, actionName), `${actionName} must require CSRF validation`));

assert(actionHasCsrf(companyController, 'Edit'), 'Company profile edit must require CSRF validation');
[
    'UpdateActiveStatus',
    'UpdateUsername',
    'UpdateAvatar',
    'UpdateCoverPhoto',
    'UpdateRejectionTemplates'
].forEach((actionName) => assert(actionHasCsrf(settingsController, actionName), `${actionName} must require CSRF validation`));
[
    'ToggleAutoShare',
    'Disconnect',
    'ConfirmFacebookPage',
    'ConnectFacebookManual',
    'GenerateZaloGroupLinkCode'
].forEach((actionName) => assert(actionHasCsrf(socialConnectController, actionName), `${actionName} must require CSRF validation`));

assert(program.includes('options.HeaderName = "RequestVerificationToken"'), 'the application must accept the browser CSRF header');
console.log('PASS: employer controller mutations require anti-forgery validation');

assert(employerView.includes('@Html.AntiForgeryToken()'), 'Employer board must render a request token');
const tokenMarkup = '<form id="applyAntiforgeryForm" style="display:none">@Html.AntiForgeryToken()</form>';
assert(jobsView.includes(tokenMarkup), 'Jobs page must render a request token');
assert(jobsView.indexOf(tokenMarkup) < jobsView.indexOf('@if (!isBusiness)'), 'Jobs request token must also be available to business users');
assert(companyEditView.includes('@Html.AntiForgeryToken()'), 'Company edit form must render a request token');
assert(settingsView.includes('id="settingsAntiforgeryForm"'), 'Settings must render a request token for AJAX mutations');
assert(profileView.includes('id="profileAntiforgeryForm"'), 'Profile must render a request token for shared uploads');
assert(facebookPageView.includes('@Html.AntiForgeryToken()'), 'Facebook page confirmation form must render a request token');
console.log('PASS: employer and shared-upload entry pages render request tokens');

function assertTokenOnEachDirectCall(source, endpoint, expectedCount) {
    let offset = 0;
    let count = 0;
    while (true) {
        const index = source.indexOf(endpoint, offset);
        if (index < 0) break;
        const request = source.slice(index, index + 420);
        assert(request.includes("'RequestVerificationToken': antiForgeryToken()"), `${endpoint} call ${count + 1} must send RequestVerificationToken`);
        count++;
        offset = index + endpoint.length;
    }
    assert.strictEqual(count, expectedCount, `${endpoint} call count changed; review its CSRF handling`);
}

assert(employerJs.includes("'RequestVerificationToken': antiForgeryToken()"), 'employer postJson helper must send the request token');
assertTokenOnEachDirectCall(employerJs, '/JobApplications/UpdateApplicationStatus?', 2);
assertTokenOnEachDirectCall(employerJs, '/JobApplications/ScheduleInterview?', 1);
assertTokenOnEachDirectCall(employerJs, '/Jobs/ToggleJobActive/', 1);
['SendOffer', 'RescoreApplication', 'SubmitEvaluation', 'QueueScoringForJob'].forEach((actionName) =>
    assert(employerJs.includes(`postJson(\`/JobApplications/${actionName}?`), `${actionName} must use the token-aware postJson helper`));
console.log('PASS: every Employer-board mutation caller supplies the request token');

assert(jobsJs.includes('function antiForgeryHeaders(headers = {})'), 'Jobs business actions need a shared CSRF-header helper');
[
    "/Jobs/ExtractJobFromPdf', { method: 'POST', headers: antiForgeryHeaders()",
    "headers: antiForgeryHeaders({ 'Content-Type': 'application/json' })",
    '/Jobs/ToggleJobActive?id=${id}`, { method: \'POST\', headers: antiForgeryHeaders()'
].forEach((snippet) => assert(jobsJs.includes(snippet), `missing CSRF header at ${snippet}`));
console.log('PASS: Jobs management callers use the token-aware header helper');

function assertHeaderNear(source, endpoint, marker) {
    const index = source.indexOf(endpoint);
    assert(index >= 0, `missing caller for ${endpoint}`);
    assert(source.slice(index, index + 360).includes(marker), `${endpoint} must send its CSRF token`);
}

assert(companyEditView.includes('function antiForgeryHeaders(headers = {})'), 'Company edit must expose a token-aware header helper');
assertHeaderNear(companyEditView, '/Company/Edit', 'headers: antiForgeryHeaders()');
assertHeaderNear(companyEditView, '/Settings/UpdateAvatar', 'headers: antiForgeryHeaders()');
assertHeaderNear(companyEditView, '/Settings/UpdateCoverPhoto', 'headers: antiForgeryHeaders()');

assert(settingsView.includes('function antiForgeryHeaders(headers = {})'), 'Settings must expose a token-aware header helper');
['UpdateAvatar', 'UpdateUsername', 'UpdateActiveStatus'].forEach((actionName) =>
    assertHeaderNear(settingsView, `/Settings/${actionName}`, 'headers: antiForgeryHeaders()'));
assertHeaderNear(settingsView, '/Settings/UpdateRejectionTemplates', 'headers: antiForgeryHeaders({ "Content-Type": "application/json" })');

assert(profileView.includes('function antiForgeryHeaders(headers = {})'), 'Profile shared uploads must expose a token-aware header helper');
assertHeaderNear(profileView, '/Settings/UpdateAvatar', 'headers: antiForgeryHeaders()');
assertHeaderNear(profileView, '/Settings/UpdateCoverPhoto', 'headers: antiForgeryHeaders()');
assertHeaderNear(becomeEmployerJs, '/Settings/UpdateAvatar', "'RequestVerificationToken': token()");
console.log('PASS: company, settings, profile, and onboarding callers retain CSRF coverage');

function element(overrides = {}) {
    return {
        style: {},
        dataset: {},
        value: '',
        textContent: '',
        innerHTML: '',
        disabled: false,
        listeners: new Map(),
        addEventListener(type, listener) { this.listeners.set(type, listener); },
        querySelectorAll() { return []; },
        ...overrides
    };
}

async function verifySharePayloadWithProductionJs() {
    const shareButton = element({ dataset: { jobId: '77', jobTitle: 'Fixture job' } });
    const shareSubmit = element();
    const shareDialog = element();
    const selectedChannels = [element({ value: '12' }), element({ value: '34' })];
    shareDialog.querySelectorAll = (selector) => selector === 'input[name="shareChannel"]:checked' ? selectedChannels : [];

    const csrf = element({ value: 'fixture-csrf-token' });
    const nodes = new Map([
        ['#shareDialog', shareDialog],
        ['#shareScrim', element()],
        ['#shareSubmitBtn', shareSubmit],
        ['#shareTitle', element()],
        ['#shareLoading', element()],
        ['#shareBody', element()],
        ['#shareMessage', element()],
        ['#shareChannelList', element()]
    ]);
    const document = {
        querySelector(selector) {
            if (selector === 'input[name="__RequestVerificationToken"]') return csrf;
            return nodes.get(selector) || null;
        },
        querySelectorAll(selector) {
            return selector === '.share-job-btn' ? [shareButton] : [];
        }
    };

    const requests = [];
    const sandbox = {
        console,
        document,
        URLSearchParams,
        location: { search: '' },
        fetch: async (url, options = {}) => {
            requests.push({ url, options });
            if (url.startsWith('/Jobs/GetShareOptions')) {
                return { json: async () => ({ success: true, defaultMessage: 'Fixture caption', channels: [] }) };
            }
            if (url === '/Jobs/ShareJob') return { json: async () => ({ success: true }) };
            throw new Error(`Unexpected request: ${url}`);
        },
        window: {
            __IS_BUSINESS__: true,
            ArisMotion: { openDialog() {}, closeDialog() {}, toast() {} }
        }
    };
    sandbox.window.window = sandbox.window;
    sandbox.window.document = document;
    sandbox.window.fetch = sandbox.fetch;
    sandbox.window.console = console;
    sandbox.window.location = sandbox.location;

    vm.runInNewContext(jobsJs, sandbox, { filename: 'jobs.js' });
    await shareButton.listeners.get('click')({ target: shareButton });
    await shareSubmit.listeners.get('click')({ target: shareSubmit });

    const request = requests.find((entry) => entry.url === '/Jobs/ShareJob');
    assert(request, 'share submit must call the local ShareJob endpoint');
    assert.strictEqual(request.options.headers.RequestVerificationToken, 'fixture-csrf-token', 'share submit must include the request token');
    assert.strictEqual(request.options.headers['Content-Type'], 'application/json', 'share submit must remain JSON');
    assert.deepStrictEqual(JSON.parse(request.options.body), {
        jobId: 77,
        channels: [
            { channelId: 12, message: 'Fixture caption' },
            { channelId: 34, message: 'Fixture caption' }
        ]
    }, 'share submit must match ShareJobRequestDto exactly');
}

verifySharePayloadWithProductionJs()
    .then(() => console.log('PASS: production share UI sends CSRF token and DTO-compatible channel payload'))
    .catch((error) => {
        console.error(error.stack || error);
        process.exitCode = 1;
    });
