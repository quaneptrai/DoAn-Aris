/*
 * Regression guard for the application-wide antiforgery policy.  MVC now
 * validates unsafe requests by default, while the one non-browser webhook is
 * explicitly exempted only because it verifies Zalo's configured secret.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const program = read('ArisSkyve', 'Program.cs');
const appLayout = read('ArisSkyve', 'Views', 'Shared', '_AppLayout.cshtml');
const webhook = read('ArisSkyve', 'Controllers', 'ZaloBotWebhookController.cs');
const pickerHtml = read('ArisSkyve', 'wwwroot', 'cv-builder', 'picker.html');
const builderHtml = read('ArisSkyve', 'wwwroot', 'cv-builder', 'builder.html');
const pickerJs = read('ArisSkyve', 'wwwroot', 'cv-builder', 'picker.js');
const postBridge = read('ArisSkyve', 'wwwroot', 'cv-builder', 'post-bridge.js');
const staticCsrf = read('ArisSkyve', 'wwwroot', 'cv-builder', 'csrf.js');
const legacyPostActions = read('ArisSkyve', 'wwwroot', 'js', 'post-actions.js');

console.log('--- RUNNING CSRF GLOBAL COVERAGE ---');

assert.match(program, /AddControllersWithViews\(options\s*=>\s*\{[\s\S]*AutoValidateAntiforgeryTokenAttribute\(\)/,
    'MVC must use AutoValidateAntiforgeryToken globally');
assert.match(program, /options\.HeaderName\s*=\s*"RequestVerificationToken"/,
    'the server must accept the exact RequestVerificationToken header');
console.log('PASS: unsafe MVC actions are protected by the global antiforgery filter');

const missingBeforeGlobal = {
    'ProfileController.cs': ['AddContact', 'UpdateBio', 'UpdatePreferences'],
    'NotificationsController.cs': ['MarkAsRead', 'MarkAllAsRead'],
    'ResumeController.cs': ['CreateBlank', 'RenameResume', 'SaveBuilderData', 'AnalyzeCv', 'DeleteResume'],
    'FriendsController.cs': ['DismissSuggestion', 'SendRequest', 'AcceptRequest', 'DeclineRequest', 'CancelRequest', 'RemoveFriend'],
    'ChatController.cs': ['UploadChatMedia', 'UploadChatImage'],
    'CompanyController.cs': ['ToggleFollow'],
    'DashboardController.cs': ['CreatePost', 'ToggleLike', 'AddComment', 'ToggleCommentLike', 'DeleteComment', 'ToggleSave', 'Vote', 'DeleteVote', 'Hide', 'Unhide', 'Report', 'Repost', 'DeletePost', 'EditPost'],
    'StoriesController.cs': ['Create', 'RecordView'],
    'AccountController.cs': ['SignOutEverywhere'],
    'JobsController.cs': ['ToggleSave']
};

let rawMissingCount = 0;
for (const [file, actions] of Object.entries(missingBeforeGlobal)) {
    const source = read('ArisSkyve', 'Controllers', file);
    for (const action of actions) {
        assert.match(source, new RegExp(`public\\s+(?:async\\s+)?(?:Task<)?IActionResult>?\\s+${action}\\s*\\(`),
            `${file}.${action} must remain an MVC action covered by the global filter`);
        rawMissingCount++;
    }
}
assert.strictEqual(rawMissingCount, 37, 'audit baseline must enumerate all 37 formerly unannotated MVC mutations');
console.log('PASS: all 37 formerly unannotated MVC mutations are covered by the global filter');

const controllersPath = path.join(root, 'ArisSkyve', 'Controllers');
const ignoredActions = fs.readdirSync(controllersPath)
    .filter((name) => name.endsWith('.cs'))
    .flatMap((name) => (read('ArisSkyve', 'Controllers', name).match(/\[IgnoreAntiforgeryToken\]/g) || [])
        .map(() => name));
assert.deepStrictEqual(ignoredActions, ['ZaloBotWebhookController.cs'],
    'Zalo must be the only controller action exempted from the global CSRF filter');
assert.match(webhook, /\[HttpPost\]\s*\[IgnoreAntiforgeryToken\]\s*public async Task<IActionResult> Receive\(/,
    'only Zalo Receive may opt out');
assert.match(webhook, /string\.IsNullOrWhiteSpace\(expectedSecret\)\s*\|\|[\s\S]*string\.Equals\(Request\.Headers\["X-Bot-Api-Secret-Token"\], expectedSecret, StringComparison\.Ordinal\)/,
    'Zalo webhook must fail closed when its configured secret is missing or wrong');
console.log('PASS: the single webhook exception is externally authenticated and fail-closed');

const tokenMarker = 'id="arisAntiforgeryToken"';
const markerIndex = appLayout.indexOf(tokenMarker);
const layoutScriptStart = appLayout.indexOf('<script>', markerIndex);
const layoutScriptEnd = appLayout.indexOf('</script>', layoutScriptStart);
assert(markerIndex >= 0 && layoutScriptStart > markerIndex && layoutScriptEnd > layoutScriptStart,
    'the app layout must render its request token before its fetch wrapper');
assert(layoutScriptStart < appLayout.indexOf('@RenderBody()'),
    'the fetch wrapper must be installed before view scripts can run');
const layoutFetchScript = appLayout.slice(layoutScriptStart + '<script>'.length, layoutScriptEnd);
assert.match(layoutFetchScript, /headers\.set\("RequestVerificationToken", requestToken\)/,
    'same-origin unsafe fetches must receive the exact server header');

async function verifyLayoutFetchWrapper() {
    const calls = [];
    const window = {
        location: { href: 'https://aris.test/Dashboard', origin: 'https://aris.test' },
        fetch(resource, init) {
            calls.push({ resource, init });
            return Promise.resolve({ ok: true });
        }
    };
    const sandbox = {
        window,
        document: {
            querySelector(selector) {
                assert.strictEqual(selector, "#arisAntiforgeryToken input[name='__RequestVerificationToken']");
                return { value: 'layout-token' };
            }
        },
        Request: class Request {},
        URL,
        Headers,
        Promise
    };
    window.window = window;
    vm.runInNewContext(layoutFetchScript, sandbox, { filename: '_AppLayout.cshtml fetch wrapper' });

    await window.fetch('/Dashboard/ToggleLike', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    assert.strictEqual(calls[0].init.headers.get('RequestVerificationToken'), 'layout-token',
        'same-origin POST must get the layout token');
    assert.strictEqual(calls[0].init.headers.get('Content-Type'), 'application/json',
        'the wrapper must preserve caller headers');

    await window.fetch('/Dashboard/ToggleLike', { method: 'POST', headers: { RequestVerificationToken: 'caller-token' } });
    assert.strictEqual(calls[1].init.headers.get('RequestVerificationToken'), 'caller-token',
        'the wrapper must preserve an explicitly supplied token');

    await window.fetch('https://external.example.test/submit', { method: 'POST' });
    assert.strictEqual(calls[2].init.headers, undefined,
        'the wrapper must not attach an Aris token to a cross-origin request');

    await window.fetch('/Dashboard/GetPosts');
    assert.strictEqual(calls[3].init, undefined,
        'the wrapper must leave safe requests alone');
}

async function verifyStaticBuilderTokenBootstrap() {
    const calls = [];
    const window = {};
    const sandbox = {
        window,
        Promise,
        fetch(url, options) {
            calls.push({ url, options });
            return Promise.resolve({ ok: true, json: async () => ({ token: 'static-token' }) });
        }
    };
    window.window = window;
    vm.runInNewContext(staticCsrf, sandbox, { filename: 'cv-builder/csrf.js' });
    const headers = await window.ArisCsrf.headers({ 'Content-Type': 'application/json' });
    assert.deepStrictEqual({ ...headers }, {
        'Content-Type': 'application/json',
        RequestVerificationToken: 'static-token'
    }, 'the static builder must obtain and attach the exact CSRF header before a mutation');
    assert.strictEqual(calls.length, 1, 'the session token must be cached after the first bootstrap');
    assert.strictEqual(calls[0].url, '/api/resume-engine/session', 'the static builder must use the authenticated token endpoint');

    const failedCalls = [];
    const failedWindow = {};
    const failedSandbox = {
        window: failedWindow,
        Promise,
        fetch(url) {
            failedCalls.push(url);
            return Promise.resolve({ ok: false, status: 401 });
        }
    };
    failedWindow.window = failedWindow;
    vm.runInNewContext(staticCsrf, failedSandbox, { filename: 'cv-builder/csrf.js failure path' });
    await assert.rejects(() => failedWindow.ArisCsrf.headers(), /Unable to obtain an antiforgery token/,
        'a failed static-builder token bootstrap must reject before callers issue a mutation');
    assert.deepStrictEqual(failedCalls, ['/api/resume-engine/session'],
        'bootstrap failure must not issue an unauthenticated mutation request');
}

function verifyJqueryPrefilter() {
    const jqueryTagIndex = appLayout.indexOf('jquery.min.js');
    const scriptStart = appLayout.indexOf('<script>', jqueryTagIndex);
    const scriptEnd = appLayout.indexOf('</script>', scriptStart);
    assert(scriptStart > jqueryTagIndex && scriptEnd > scriptStart,
        'the jQuery prefilter must be installed immediately after jQuery loads');
    const jqueryPrefilterScript = appLayout.slice(scriptStart + '<script>'.length, scriptEnd);
    assert.match(jqueryPrefilterScript, /window\.jQuery\.ajaxPrefilter/,
        'same-origin jQuery mutations must be covered by an ajax prefilter');
    assert.match(jqueryPrefilterScript, /jqXHR\.setRequestHeader\("RequestVerificationToken", requestToken\)/,
        'the jQuery prefilter must use the exact CSRF header');

    let prefilter;
    const window = {
        location: { href: 'https://aris.test/Profile', origin: 'https://aris.test' },
        ArisCsrf: { token: () => 'jquery-token' },
        jQuery: { ajaxPrefilter(callback) { prefilter = callback; } }
    };
    const sandbox = { window, URL, Object, String };
    window.window = window;
    vm.runInNewContext(jqueryPrefilterScript, sandbox, { filename: '_AppLayout.cshtml jQuery prefilter' });
    assert.strictEqual(typeof prefilter, 'function', 'jQuery prefilter must register successfully');

    const headers = [];
    prefilter({ type: 'DELETE', url: '/Dashboard/DeletePost' }, {}, {
        setRequestHeader(name, value) { headers.push([name, value]); }
    });
    assert.deepStrictEqual(headers, [['RequestVerificationToken', 'jquery-token']],
        'same-origin jQuery DELETE must receive the layout token');

    prefilter({ type: 'POST', url: 'https://external.example.test/submit' }, {}, {
        setRequestHeader(name, value) { headers.push([name, value]); }
    });
    prefilter({ type: 'GET', url: '/Dashboard/GetPosts' }, {}, {
        setRequestHeader(name, value) { headers.push([name, value]); }
    });
    prefilter({ type: 'POST', url: '/Dashboard/EditPost', headers: { requestverificationtoken: 'caller-token' } }, {}, {
        setRequestHeader(name, value) { headers.push([name, value]); }
    });
    assert.strictEqual(headers.length, 1,
        'cross-origin, safe, and explicitly-tokenized jQuery requests must be left alone');
}

assert(pickerHtml.indexOf('csrf.js') < pickerHtml.indexOf('picker.js'),
    'picker must load its token helper before its CreateBlank caller');
assert(builderHtml.indexOf('csrf.js') < builderHtml.indexOf('post-bridge.js'),
    'builder must load its token helper before its SaveBuilderData caller');
assert.match(pickerJs, /await window\.ArisCsrf\.headers\(\)[\s\S]*fetch\("\/Resume\/CreateBlank", \{ method: "POST", headers \}\)/,
    'CreateBlank must wait for a token instead of silently posting without one');
assert.match(postBridge, /csrfHeaders\(\{ "Content-Type": "application\/json" \}\)[\s\S]*fetch\("\/Resume\/SaveBuilderData"/,
    'normal legacy-builder saves must wait for a token');
assert.doesNotMatch(postBridge, /navigator\.sendBeacon/,
    'legacy-builder unload saves cannot bypass CSRF with sendBeacon');
assert.match(legacyPostActions, /\$\.ajax\(\{ url: `\/Dashboard\/DeletePost\?id=\$\{id\}`, method: 'DELETE' \}\)/,
    'the jQuery prefilter audit must retain the legacy DELETE caller');
assert.match(legacyPostActions, /\$\.post\('\/Dashboard\/EditPost'/,
    'the jQuery prefilter audit must retain the legacy POST caller');

Promise.all([verifyLayoutFetchWrapper(), verifyStaticBuilderTokenBootstrap()])
    .then(() => {
        verifyJqueryPrefilter();
        console.log('PASS: fetch, jQuery, and static-builder callers attach RequestVerificationToken or block safely');
    })
    .catch((error) => {
        console.error(error.stack || error);
        process.exitCode = 1;
    });
