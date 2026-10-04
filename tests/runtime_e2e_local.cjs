/*
 * Isolated, local-only runtime smoke test for the Resume Studio flow.
 *
 * It deliberately builds to a temporary directory and runs the published DLL
 * directly.  That gives this test one exact child process to terminate and
 * avoids starting a normal development instance with a real SQL connection.
 *
 * Run manually (it is intentionally not part of run_all_tests.cjs):
 *   node tests/runtime_e2e_local.cjs
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
const tempPrefix = path.join(os.tmpdir(), 'aris-runtime-e2e-');
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

async function main() {
    console.log('--- RUNNING ISOLATED LOCAL RUNTIME E2E SMOKE ---');
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
        E2E__DatabaseName: `aris-runtime-e2e-${runId}`,
        DemoData__SeedCompaniesAndJobs: 'false',
        DemoData__SeedSocial: 'false',
        ConnectionStrings__DefaultConnection: '',
        AiCore__BaseUrl: 'http://127.0.0.1:9',
        AiCore__ApiKey: '',
        ResumeEngine__ParserUrl: 'http://127.0.0.1:9',
        Authentication__Google__ClientId: '',
        Authentication__Google__ClientSecret: '',
        Authentication__Facebook__ClientId: '',
        Authentication__Facebook__ClientSecret: '',
        Smtp__Host: '',
        Smtp__User: '',
        Smtp__Password: '',
        Smtp__ApiKey: '',
        Smtp__FromEmail: '',
        NO_PROXY: '127.0.0.1,localhost',
        no_proxy: '127.0.0.1,localhost'
    };

    // Directly hosting the DLL means this is the exact app process that the
    // finally block terminates. `--urls` and ASPNETCORE_URLS are both exact
    // loopback URLs; no wildcard or LAN listener is requested.
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

    const liveness = await expectJson(await new CookieJar(baseUrl).request('/health/live'), 200, 'liveness probe');
    const readiness = await expectJson(await new CookieJar(baseUrl).request('/health/ready'), 200, 'readiness probe');
    assert.strictEqual(liveness.status, 'live', 'liveness probe must report a live process');
    assert.strictEqual(readiness.status, 'ready', 'readiness probe must verify the isolated in-memory schema');
    console.log('PASS: live and readiness probes work through the real HTTP pipeline');

    const ownerEmail = `runtime-owner-${runId}@local.test`;
    const otherEmail = `runtime-other-${runId}@local.test`;
    const owner = await quickLogin(baseUrl, ownerEmail);
    console.log('PASS: Development QuickLogin issued an owner session cookie');

    const created = await csrfPost(owner, '/Resume/CreateBlank', undefined, 'create blank resume');
    assert.strictEqual(created.success, true, 'CreateBlank must report success');
    assert(Number.isInteger(created.resumeId) && created.resumeId > 0, 'CreateBlank must return a positive resume id');
    const resumeId = created.resumeId;
    console.log('PASS: blank resume creation passed global antiforgery validation');

    const initial = await expectJson(await owner.request(`/api/resume-engine/document/${resumeId}`), 200, 'load blank resume');
    assert.strictEqual(initial.resumeId, resumeId, 'loaded document must belong to the blank resume');
    assert(initial.data && typeof initial.data === 'object' && initial.data.basics, 'blank resume must load as a canonical document');

    const studio = await expectStatus(await owner.request(`/Resume/Studio?resumeId=${resumeId}`), 200, 'Resume Studio shell');
    assert.match(studio, /id="root"/, 'Resume Studio shell must be served from the isolated content root');
    console.log('PASS: blank resume loads in the Resume Studio API and shell');

    const document = structuredClone(initial.data);
    const marker = `Runtime E2E ${runId}`;
    document.meta.slug = `runtime-e2e-${runId}`;
    document.basics.name = marker;
    document.basics.headline = 'Isolated runtime smoke test';
    document.basics.email = ownerEmail;
    document.basics.summary = 'Saved by the isolated local runtime smoke test.';
    const saved = await csrfPost(owner, '/api/resume-engine/document', {
        resumeId,
        templateId: 't3',
        data: document
    }, 'save Resume Studio document');
    assert.strictEqual(saved.resumeId, resumeId, 'save must update the requested owned resume');
    assert.strictEqual(saved.published, false, 'a newly saved document must remain private');

    const persisted = await expectJson(await owner.request(`/api/resume-engine/document/${resumeId}`), 200, 'reload saved resume');
    assert.strictEqual(persisted.templateId, 't3', 'saved template id must persist');
    assert.strictEqual(persisted.data.basics.name, marker, 'saved canonical data must persist');
    console.log('PASS: canonical document save and reload work without an AI service');

    const published = await csrfPost(owner, `/api/resume-engine/document/${resumeId}/publish`, undefined, 'publish resume');
    assert.strictEqual(published.published, true, 'publish endpoint must mark the resume public');
    assert.strictEqual(published.url, `/portfolio/${resumeId}`, 'publish endpoint must return the public portfolio URL');

    const publicDocument = await expectJson(await new CookieJar(baseUrl).request(`/api/resume-engine/public/${resumeId}`), 200, 'public resume document');
    assert.strictEqual(publicDocument.data.basics.name, marker, 'public API must expose the published document');
    const portfolio = await expectStatus(await new CookieJar(baseUrl).request(`/portfolio/${resumeId}`), 200, 'public portfolio');
    assert(portfolio.includes(marker), 'public portfolio must render the published resume identity');
    console.log('PASS: publish enables the public API and portfolio');

    const otherUser = await quickLogin(baseUrl, otherEmail);
    await expectStatus(await otherUser.request(`/api/resume-engine/document/${resumeId}`), 404, 'foreign user document access');
    console.log('PASS: a different authenticated user cannot read the owner document');

    const unpublished = await csrfPost(owner, `/api/resume-engine/document/${resumeId}/unpublish`, undefined, 'unpublish resume');
    assert.strictEqual(unpublished.published, false, 'unpublish endpoint must return private state');
    await expectStatus(await new CookieJar(baseUrl).request(`/api/resume-engine/public/${resumeId}`), 404, 'unpublished public API');
    await expectStatus(await new CookieJar(baseUrl).request(`/portfolio/${resumeId}`), 404, 'unpublished portfolio');
    console.log('PASS: unpublish removes both public routes');

    console.log('LOCAL RUNTIME E2E SMOKE PASSED');
}

main()
    .catch(error => {
        console.error(`LOCAL RUNTIME E2E SMOKE FAILED: ${error.stack || error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await stopExactChild(appProcess);
        cleanupTemporaryBuild();
    });
