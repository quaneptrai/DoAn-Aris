/*
 * Isolated, local-only runtime E2E for privacy consent and passwordless sign-in limits.
 *
 * Same disposable setup as runtime_e2e_local.cjs (temporary build, loopback-only Kestrel,
 * EF InMemory database, no AI/parser/SMTP). Verifies:
 *   - /privacy renders for anonymous users and names the data processors;
 *   - CV-AI endpoints return 428 cv_ai_consent_required until the user consents; Studio save skips AI;
 *   - consent can be granted and revoked through the /privacy endpoints;
 *   - onboarding (NewUserInfor) requires accepting the privacy policy and records it;
 *   - magic-link emails are limited per recipient and per IP; confirm links are limited per IP.
 *
 * Run manually:
 *   node tests/runtime_e2e_privacy.cjs
 */


const assert = require('assert');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const projectDir = path.join(repoRoot, 'ArisSkyve');
const projectFile = path.join(projectDir, 'ArisSkyve.csproj');
const runId = `${process.pid}-${Date.now().toString(36)}`;
const tempPrefix = path.join(os.tmpdir(), 'aris-privacy-e2e-');
const tempRoot = fs.mkdtempSync(tempPrefix);
const buildOutput = path.join(tempRoot, 'build');

let appProcess = null;
let cleanupStarted = false;

function tail(value, limit = 6000) {
    return value.length <= limit ? value : value.slice(-limit);
}

function diagnostic(value) {
    return tail(String(value || '').replace(/(RequestVerificationToken|Set-Cookie)\s*[:=]\s*[^\s;]+/gi, '$1: [redacted]'));
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function onceExit(child) {
    return new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
}

function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd || repoRoot,
            env: options.env || process.env,
            shell: false,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk.toString(); });
        child.stderr.on('data', chunk => { stderr += chunk.toString(); });
        child.once('error', error => reject(error));
        child.once('close', code => {
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }
            reject(new Error(`${command} exited with code ${code}.\n${diagnostic(`${stdout}\n${stderr}`)}`));
        });
    });
}

async function reserveLoopbackPort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen({ host: '127.0.0.1', port: 0 }, resolve);
    });

    const address = server.address();
    assert(address && typeof address !== 'string' && address.address === '127.0.0.1', 'port reservation must be loopback-only');
    const port = address.port;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    return port;
}

function appendProcessOutput(child) {
    const output = { stdout: '', stderr: '' };
    child.stdout.on('data', chunk => { output.stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { output.stderr += chunk.toString(); });
    return output;
}

async function stopExactChild(child) {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;

    const exited = onceExit(child);
    // The child is `dotnet <our temporary ArisSkyve.dll>`, not a shell or a
    // shared development server.  Killing it cannot target another instance.
    child.kill('SIGTERM');
    const graceful = await Promise.race([
        exited,
        delay(8000).then(() => null)
    ]);
    if (graceful) return;

    child.kill('SIGKILL');
    await Promise.race([
        exited,
        delay(4000).then(() => null)
    ]);
}

function cleanupTemporaryBuild() {
    if (cleanupStarted) return;
    cleanupStarted = true;
    // `tempRoot` came from mkdtemp with this exact prefix; never clean a broad
    // workspace path from this smoke test.
    if (path.dirname(tempRoot) === path.dirname(tempPrefix) && path.basename(tempRoot).startsWith(path.basename(tempPrefix))) {
        fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
    }
}

async function abortForSignal(signal) {
    console.error(`Received ${signal}; stopping the isolated E2E child...`);
    try {
        await stopExactChild(appProcess);
    } finally {
        cleanupTemporaryBuild();
        process.exit(signal === 'SIGINT' ? 130 : 143);
    }
}

process.once('SIGINT', () => { void abortForSignal('SIGINT'); });
process.once('SIGTERM', () => { void abortForSignal('SIGTERM'); });

class CookieJar {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.cookies = new Map();
    }

    absorb(response) {
        const values = typeof response.headers.getSetCookie === 'function'
            ? response.headers.getSetCookie()
            : splitSetCookie(response.headers.get('set-cookie'));
        for (const setCookie of values) {
            const firstPart = setCookie.split(';', 1)[0];
            const separator = firstPart.indexOf('=');
            if (separator <= 0) continue;
            const name = firstPart.slice(0, separator).trim();
            const value = firstPart.slice(separator + 1).trim();
            if (!value) this.cookies.delete(name);
            else this.cookies.set(name, value);
        }
    }

    header() {
        return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    }

    async request(relativeUrl, options = {}) {
        const headers = new Headers(options.headers || {});
        const cookie = this.header();
        if (cookie) headers.set('Cookie', cookie);
        const response = await fetch(new URL(relativeUrl, this.baseUrl), {
            method: options.method || 'GET',
            headers,
            body: options.body,
            redirect: 'manual',
            signal: AbortSignal.timeout(options.timeoutMs || 15000)
        });
        this.absorb(response);
        return response;
    }
}

function splitSetCookie(header) {
    if (!header) return [];
    // Only used on old Node releases without Headers#getSetCookie.  It avoids
    // splitting the comma inside an Expires attribute.
    return header.split(/,(?=\s*[^;,=]+=[^;,]*)/);
}

async function expectStatus(response, expected, label) {
    const body = await response.text();
    assert.strictEqual(
        response.status,
        expected,
        `${label}: expected HTTP ${expected}, got ${response.status}. ${diagnostic(body)}`
    );
    return body;
}

async function expectJson(response, expected, label) {
    const body = await expectStatus(response, expected, label);
    try {
        return JSON.parse(body);
    } catch (error) {
        throw new Error(`${label}: expected JSON response. ${diagnostic(body)} (${error.message})`);
    }
}

async function quickLogin(baseUrl, email) {
    const client = new CookieJar(baseUrl);
    const query = new URLSearchParams({ email, returnUrl: '/Resume/Studio' });
    const response = await client.request(`/Account/QuickLogin?${query}`);
    await expectStatus(response, 302, 'QuickLogin');
    assert(client.cookies.size > 0, 'QuickLogin must issue an authentication cookie');
    return client;
}

async function antiForgeryToken(client) {
    const session = await expectJson(await client.request('/api/resume-engine/session'), 200, 'resume session');
    assert(Number.isInteger(session.userId) && session.userId > 0, 'session must identify the authenticated user');
    assert(typeof session.token === 'string' && session.token.length > 20, 'session must issue an antiforgery request token');
    assert(
        [...client.cookies.keys()].some(name => /antiforgery/i.test(name)),
        'session must store its paired antiforgery cookie in the test cookie jar'
    );
    return session.token;
}

async function csrfPost(client, relativeUrl, payload, label) {
    const token = await antiForgeryToken(client);
    const headers = { RequestVerificationToken: token };
    if (payload !== undefined) headers['Content-Type'] = 'application/json';
    const response = await client.request(relativeUrl, {
        method: 'POST',
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload)
    });
    return expectJson(response, 200, label);
}

async function waitForRuntime(baseUrl, child, output) {
    const deadline = Date.now() + 45000;
    let lastError = null;
    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error(`Kestrel stopped before becoming ready.\n${diagnostic(`${output.stdout}\n${output.stderr}`)}`);
        }
        try {
            const response = await fetch(`${baseUrl}/`, { redirect: 'manual', signal: AbortSignal.timeout(1500) });
            if (response.status >= 200 && response.status < 500) return;
        } catch (error) {
            lastError = error;
        }
        await delay(200);
    }
    throw new Error(`Kestrel did not become ready within 45 seconds (${lastError?.message || 'no response'}).\n${diagnostic(`${output.stdout}\n${output.stderr}`)}`);
}


// Razor HTML-encodes non-ASCII text written through @(...) (e.g. "đ" -> "&#x111;"); browsers decode it.
function decodeEntities(html) {
    return html
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

async function expectPage(response, expected, label) {
    return decodeEntities(await expectStatus(response, expected, label));
}

function minimalPdf() {
    return Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');
}

async function csrfRequest(client, relativeUrl, options = {}) {
    const token = await antiForgeryToken(client);
    const headers = { RequestVerificationToken: token, ...(options.headers || {}) };
    return client.request(relativeUrl, { ...options, method: options.method || 'POST', headers });
}

async function analyzeCv(client) {
    const form = new FormData();
    form.append('file', new Blob([minimalPdf()], { type: 'application/pdf' }), 'cv.pdf');
    form.append('newResume', 'true');
    return csrfRequest(client, '/Resume/AnalyzeCv', { body: form });
}

async function expectConsentRequired(response, label) {
    const body = await expectJson(response, 428, label);
    assert.strictEqual(body.code, 'cv_ai_consent_required', `${label}: 428 must carry the consent code`);
}

async function formToken(client, relativeUrl) {
    const page = await expectPage(await client.request(relativeUrl), 200, `form page ${relativeUrl}`);
    const match = page.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)
        || page.match(/value="([^"]+)"[^>]*name="__RequestVerificationToken"/);
    assert(match, `${relativeUrl} must render an antiforgery form token`);
    return match[1];
}

async function requestMagicLink(client, token, email, { acceptTerms = true, returnView = 'Login', intent = 'candidate' } = {}) {
    return client.request('/Account/RequestMagicLink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email, returnView, intent, AcceptTerms: String(acceptTerms), __RequestVerificationToken: token })
    });
}

async function main() {
    console.log('--- RUNNING ISOLATED PRIVACY + SIGN-IN LIMITS E2E ---');
    console.log('Building the ASP.NET app into a disposable temporary directory...');
    await runCommand('dotnet', [
        'build', projectFile, '--no-restore', '--nologo', '-p:UseAppHost=false', '-o', buildOutput, '-v', 'quiet'
    ]);
    const runtimeDll = path.join(buildOutput, 'ArisSkyve.dll');
    assert(fs.existsSync(runtimeDll), 'temporary build must produce ArisSkyve.dll');
    const port = await reserveLoopbackPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const e2eEnv = {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        DOTNET_ENVIRONMENT: 'Development',
        ASPNETCORE_URLS: baseUrl,
        E2E__UseInMemoryDatabase: 'true',
        E2E__DisableBackgroundServices: 'true',
        E2E__DatabaseName: `aris-privacy-e2e-${runId}`,
        DemoData__SeedCompaniesAndJobs: 'false',
        DemoData__SeedSocial: 'false',
        ConnectionStrings__DefaultConnection: '',
        AiCore__BaseUrl: 'http://127.0.0.1:9',
        AiCore__ApiKey: '',
        ResumeEngine__ParserUrl: 'http://127.0.0.1:9',
        ResumeEngine__ParserApiKey: '',
        Auth__MagicLinkSecret: `privacy-e2e-${runId}-${'x'.repeat(40)}`,
        Authentication__Google__ClientId: '',
        Authentication__Google__ClientSecret: '',
        Authentication__Facebook__ClientId: '',
        Authentication__Facebook__ClientSecret: '',
        Smtp__Host: '',
        Smtp__User: '',
        Smtp__Password: '',
        Smtp__ApiKey: 'dummy-smtp-key-for-test',
        Smtp__FromEmail: '',
        RateLimits__MagicLinkRequestsPerIp: '7',
        NO_PROXY: '127.0.0.1,localhost',
        no_proxy: '127.0.0.1,localhost'
    };
    appProcess = spawn('dotnet', [runtimeDll, '--urls', baseUrl, '--contentRoot', projectDir], {
        cwd: projectDir,
        env: e2eEnv,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    const runtimeOutput = appendProcessOutput(appProcess);
    const spawnError = new Promise((_, reject) => appProcess.once('error', reject));
    await Promise.race([waitForRuntime(baseUrl, appProcess, runtimeOutput), spawnError]);
    console.log(`PASS: disposable Development Kestrel is listening only at ${baseUrl}`);

    const policy = await expectPage(await new CookieJar(baseUrl).request('/privacy'), 200, 'anonymous privacy page');
    assert(policy.includes('Chính sách quyền riêng tư') && !policy.includes('id="cv-ai"'), 'anonymous policy page renders without consent controls');
    assert(policy.includes('OpenAI') && policy.includes('Pinecone') && policy.includes('FastAPI Cloud'), 'policy names the AI and hosting processors');
    console.log('PASS: /privacy renders for anonymous visitors and names the data processors');

    const user = await quickLogin(baseUrl, `privacy-${runId}@local.test`);
    await expectConsentRequired(await analyzeCv(user), 'AnalyzeCv without consent');
    const created = await csrfPost(user, '/Resume/CreateBlank', undefined, 'create blank resume');
    const loaded = await expectJson(await user.request(`/api/resume-engine/document/${created.resumeId}`), 200, 'load blank resume');
    await expectConsentRequired(await csrfRequest(user, '/api/resume-engine/coach', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: loaded.data, target: 'Data Analyst' })
    }), 'Coach without consent');
    const templateForm = new FormData();
    templateForm.append('file', new Blob([minimalPdf()], { type: 'application/pdf' }), 'cv.pdf');
    templateForm.append('mode', 'template');
    await expectConsentRequired(await csrfRequest(user, '/api/resume-engine/parse', { body: templateForm }), 'Parse(template) without consent');
    const layoutForm = new FormData();
    layoutForm.append('file', new Blob([minimalPdf()], { type: 'application/pdf' }), 'cv.pdf');
    layoutForm.append('mode', 'layout');
    const layout = await csrfRequest(user, '/api/resume-engine/parse', { body: layoutForm });
    assert.notStrictEqual(layout.status, 428, 'layout import does not use AI and must not require AI consent');
    await layout.text();
    const document = structuredClone(loaded.data);
    document.basics.name = 'Privacy E2E';
    document.basics.headline = 'Consent check';
    document.basics.email = `privacy-${runId}@local.test`;
    const savedWithout = await csrfPost(user, '/api/resume-engine/document', { resumeId: created.resumeId, templateId: 't3', data: document }, 'save without consent');
    assert.strictEqual(savedWithout.aiSync, 'consent_required', 'Studio save must skip AI indexing without consent');
    console.log('PASS: AnalyzeCv, Coach and Parse(template) return 428 and Studio save skips AI until consent');

    const granted = await expectJson(await csrfRequest(user, '/privacy/cv-ai-consent', { headers: { Accept: 'application/json' } }), 200, 'grant consent');
    assert.strictEqual(granted.consented, true, 'grant endpoint must confirm consent');
    const afterConsent = await analyzeCv(user);
    assert.notStrictEqual(afterConsent.status, 428, 'AnalyzeCv must pass the consent gate after consent');
    await afterConsent.text();
    const savedWith = await csrfPost(user, '/api/resume-engine/document', { resumeId: created.resumeId, templateId: 't3', data: document }, 'save with consent');
    assert.notStrictEqual(savedWith.aiSync, 'consent_required', 'Studio save must try AI indexing after consent');
    const signedInPolicy = await expectPage(await user.request('/privacy'), 200, 'signed-in privacy page');
    assert(signedInPolicy.includes('id="cv-ai"') && signedInPolicy.includes('đang bật'), 'signed-in policy page shows the active consent');
    const revoked = await expectJson(await csrfRequest(user, '/privacy/cv-ai-consent/revoke', { headers: { Accept: 'application/json' } }), 200, 'revoke consent');
    assert.strictEqual(revoked.consented, false, 'revoke endpoint must withdraw consent');
    await expectConsentRequired(await analyzeCv(user), 'AnalyzeCv after revoke');
    console.log('PASS: consent can be granted, is shown on /privacy, and revoking restores the 428 gate');

    const newcomer = await quickLogin(baseUrl, `newcomer-${runId}@local.test`);
    const onboardingToken = await formToken(newcomer, '/Account/NewUserInfor');
    const onboarding = (accept) => newcomer.request('/Account/NewUserInfor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            __RequestVerificationToken: onboardingToken,
            Location: 'Hải Phòng',
            JobSearchingStatus: 'Looking',
            ShareWithRecruiters: 'true',
            AcceptPrivacy: accept ? 'true' : 'false',
            AllowCvAi: 'false'
        })
    });
    const rejected = await expectPage(await onboarding(false), 200, 'onboarding without privacy acceptance');
    assert(rejected.includes('Bạn cần đồng ý với Chính sách quyền riêng tư'), 'onboarding must explain the required acceptance');
    const accepted = await onboarding(true);
    assert.strictEqual(accepted.status, 302, 'onboarding with acceptance must continue into Aris');
    await accepted.text();
    const newcomerPolicy = await expectPage(await newcomer.request('/privacy'), 200, 'newcomer privacy page');
    assert(newcomerPolicy.includes('đã đồng ý lúc'), 'privacy acceptance must be recorded with a timestamp');
    console.log('PASS: onboarding requires and records privacy-policy acceptance');

    const anonymous = new CookieJar(baseUrl);
    const registerToken = await formToken(anonymous, '/Account/Register');
    for (const view of ['Login', 'Register']) {
        const page = await expectPage(await anonymous.request(`/Account/${view}`), 200, `${view} consent placement`);
        const formAt = page.indexOf('id="authForm"');
        const emailAt = page.indexOf('id="authEmail"');
        const consentAt = page.indexOf('id="authAcceptTerms"');
        const buttonAt = page.indexOf('id="authSubmit"');
        const formEnd = page.indexOf('</form>', formAt);
        assert(formAt >= 0 && formAt < emailAt && emailAt < consentAt && consentAt < buttonAt && buttonAt < formEnd,
            `${view} must place consent inside the form between the email field and submit button`);
        assert(page.slice(formAt, formEnd).includes('data-auth-terms-value'),
            `${view} must keep its form consent submission field`);
    }
    const authCss = await expectStatus(await anonymous.request('/css/pages/auth.css'), 200, 'auth CSS');
    assert(authCss.includes('animation: auth-wall') && authCss.includes('@keyframes auth-wall')
        && authCss.includes('prefers-reduced-motion: reduce'),
        'served auth CSS must animate job columns and provide a reduced-motion fallback');
    const rejectedRegister = await expectPage(await requestMagicLink(anonymous, registerToken, `unchecked-register-${runId}@local.test`, { acceptTerms: false, returnView: 'Register' }), 200, 'register without terms acceptance');
    assert(rejectedRegister.includes('Vui lòng đồng ý với điều khoản') && !rejectedRegister.includes('id="sentTitle"'), 'register must reject unchecked terms before creating a magic link');
    assert(!/<input[^>]*id="authAcceptTerms"[^>]*checked(?:\s|=|>)/.test(rejectedRegister), 'the agreement checkbox must remain unchecked after rejection');

    const loginToken = await formToken(anonymous, '/Account/Login');
    const rejectedLogin = await expectPage(await requestMagicLink(anonymous, loginToken, `unchecked-login-${runId}@local.test`, { acceptTerms: false }), 200, 'login without terms acceptance');
    assert(rejectedLogin.includes('Vui lòng đồng ý với điều khoản') && !rejectedLogin.includes('id="sentTitle"'), 'login must reject unchecked terms before creating a magic link');

    const rejectedSocial = await expectPage(await anonymous.request('/Account/GoogleLogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ acceptTerms: 'false', returnView: 'Login', __RequestVerificationToken: loginToken })
    }), 200, 'social login without terms acceptance');
    assert(rejectedSocial.includes('Vui lòng đồng ý với điều khoản'), 'social login must reject unchecked terms before challenging a provider');
    assert(rejectedSocial.includes('name="__RequestVerificationToken"'), 'social forms must retain antiforgery tokens');

    const target = `limit-${runId}@local.test`;
    let magicConfirmPath = null;
    for (let i = 1; i <= 3; i++) {
        const page = await expectPage(await requestMagicLink(anonymous, loginToken, target), 200, `magic link ${i}`);
        assert(page.includes('id="sentTitle"'), `magic link ${i} must be accepted`);
        if (i === 1) {
            assert(page.includes('Chưa gửi được email'), 'checked consent must succeed in Development without a configured mail provider');
            assert(!page.includes('id="resendAcceptTerms"') && /id="resendForm"[\s\S]*name="AcceptTerms" value="true"/.test(page),
                'the sent screen must offer resend without asking for a second agreement while retaining server-side consent');
            const match = page.match(/href="([^"]*\/Account\/ConfirmMagicLink[^"]*)"/);
            assert(match, 'Development must expose its signed confirmation URL for local verification');
            const confirmation = new URL(match[1], baseUrl);
            magicConfirmPath = confirmation.pathname + confirmation.search;
        }
    }
    const throttled = await expectPage(await requestMagicLink(anonymous, loginToken, target), 200, 'magic link 4 (same recipient)');
    assert(throttled.includes('Bạn vừa yêu cầu nhiều liên kết cho email này'), 'fourth link to one recipient within 15 minutes must be refused');
    console.log('PASS: magic-link emails are limited to 3 per recipient per 15 minutes');
    const fifth = await expectPage(await requestMagicLink(anonymous, loginToken, `other-${runId}@local.test`), 200, 'magic link 5 (new recipient)');
    assert(fifth.includes('id="sentTitle"'), 'a different recipient is still allowed until the IP limit');
    const ipLimited = await requestMagicLink(anonymous, loginToken, `third-${runId}@local.test`);
    const ipLimitedBody = await expectPage(ipLimited, 429, 'magic link 6 (IP limit)');
    assert(ipLimited.headers.get('retry-after') && ipLimitedBody.includes('Thử lại sau ít phút'), '429 must carry Retry-After and a readable page');
    console.log('PASS: magic-link requests are limited to 7 per IP in this consent regression run with a readable 429');
    assert(magicConfirmPath, 'checked magic-link request must yield a local confirmation URL');
    const confirmed = await anonymous.request(magicConfirmPath);
    assert.strictEqual(confirmed.status, 302, 'checked magic link must confirm and sign in in isolated Development');
    await confirmed.text();
    const confirmedPolicy = await expectPage(await anonymous.request('/privacy'), 200, 'magic-link privacy state');
    assert(confirmedPolicy.includes('đã đồng ý lúc'), 'magic-link consent must be recorded on the account');
    assert(confirmedPolicy.includes('AI xử lý CV: đang tắt'), 'terms acceptance must not grant optional CV-AI consent');
    console.log('PASS: checked magic link succeeds without email delivery and records privacy acceptance only');

    for (let i = 0; i < 19; i++) {
        const response = await anonymous.request('/Account/ConfirmMagicLink?token=invalid');
        assert.notStrictEqual(response.status, 429, `confirm attempt ${i + 2} of 20 must remain allowed`);
        await response.text();
    }
    const confirmLimited = await anonymous.request('/Account/ConfirmMagicLink?token=invalid');
    assert.strictEqual(confirmLimited.status, 429, 'the 21st confirm-link request including the successful confirmation must be rate limited');
    await confirmLimited.text();
    console.log('PASS: confirm-link attempts are limited to 20 per IP per 15 minutes');

    console.log('PRIVACY + SIGN-IN LIMITS E2E PASSED');
}

main()
    .catch(error => {
        console.error(`PRIVACY + SIGN-IN LIMITS E2E FAILED: ${error.stack || error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await stopExactChild(appProcess);
        cleanupTemporaryBuild();
    });
