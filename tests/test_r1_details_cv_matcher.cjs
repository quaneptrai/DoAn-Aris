const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('--- Testing R1: Details Page Execution & CV Matcher Production Code ---');

const repoRoot = path.resolve(__dirname, '..');
const jobsJsPath = path.join(repoRoot, 'ArisSkyve', 'wwwroot', 'js', 'pages', 'jobs.js');
const jobsJsCode = fs.readFileSync(jobsJsPath, 'utf8');

// Helper to create a DOM stub environment
function createDOMEnvironment({ hasJobList = false, jobId = 42 } = {}) {
    const eventListeners = {};
    const dom = {
        elements: {},
        bodyListeners: {},
        docListeners: {}
    };

    function makeElement(tag, attrs = {}) {
        const el = {
            tagName: tag.toUpperCase(),
            hidden: false,
            disabled: false,
            dataset: {},
            classList: {
                _classes: new Set(),
                add(c) { this._classes.add(c); },
                remove(c) { this._classes.delete(c); },
                toggle(c, force) {
                    if (force === undefined) {
                        if (this._classes.has(c)) this._classes.delete(c);
                        else this._classes.add(c);
                    } else if (force) {
                        this._classes.add(c);
                    } else {
                        this._classes.delete(c);
                    }
                },
                contains(c) { return this._classes.has(c); }
            },
            style: {},
            children: [],
            _listeners: {},
            addEventListener(ev, fn) {
                if (!this._listeners[ev]) this._listeners[ev] = [];
                this._listeners[ev].push(fn);
            },
            removeEventListener(ev, fn) {
                if (this._listeners[ev]) {
                    this._listeners[ev] = this._listeners[ev].filter(f => f !== fn);
                }
            },
            dispatch(ev, eventObj = {}) {
                if (this._listeners[ev]) {
                    this._listeners[ev].forEach(fn => fn({
                        target: el,
                        currentTarget: el,
                        preventDefault: () => {},
                        stopPropagation: () => {},
                        ...eventObj
                    }));
                }
            },
            querySelector(sel) {
                return findDescendant(this, sel);
            },
            querySelectorAll(sel) {
                return findAllDescendants(this, sel);
            },
            contains(other) {
                if (other === this) return true;
                return this.children.some(c => c.contains(other));
            },
            getBoundingClientRect() {
                return { top: 100, bottom: 200, left: 50, right: 250, height: 100, width: 200 };
            }
        };

        let _innerHTML = '';
        Object.defineProperty(el, 'innerHTML', {
            get() { return _innerHTML; },
            set(val) {
                _innerHTML = String(val);
                // When innerHTML changes, simulate basic child elements if needed
            }
        });

        let _value = '';
        Object.defineProperty(el, 'value', {
            get() { return _value; },
            set(val) { _value = String(val); }
        });

        const { classList, ...restAttrs } = attrs;
        Object.assign(el, restAttrs);
        if (classList) {
            if (Array.isArray(classList)) classList.forEach(c => el.classList.add(c));
            else if (classList._classes) classList._classes.forEach(c => el.classList.add(c));
            else if (typeof classList === 'string') classList.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
        }
        return el;
    }

    function findDescendant(parent, sel) {
        for (const child of parent.children) {
            if (matches(child, sel)) return child;
            const found = findDescendant(child, sel);
            if (found) return found;
        }
        return null;
    }

    function findAllDescendants(parent, sel) {
        let results = [];
        for (const child of parent.children) {
            if (matches(child, sel)) results.push(child);
            results = results.concat(findAllDescendants(child, sel));
        }
        return results;
    }

    function matches(el, sel) {
        if (!el) return false;
        if (sel.includes('[')) {
            const tagPart = sel.slice(0, sel.indexOf('['));
            const attrPart = sel.slice(sel.indexOf('['));
            if (tagPart && el.tagName !== tagPart.toUpperCase()) return false;
            const m = attrPart.match(/^\[([a-zA-Z0-9_\-]+)(?:=(['"]?)(.*?)\2)?\]$/);
            if (m) {
                const k = m[1];
                const v = m[3];
                if (v === undefined) return k in el || el.hasAttribute?.(k);
                return el[k] === v || el.getAttribute?.(k) === v || el.dataset?.[k.replace('data-', '')] === v;
            }
        }
        if (sel.startsWith('#')) return el.id === sel.slice(1);
        if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
        return el.tagName === sel.toUpperCase();
    }

    const docElements = [];

    // Root document representation
    const documentObj = {
        querySelector(sel) {
            for (const el of docElements) {
                if (matches(el, sel)) return el;
                const found = findDescendant(el, sel);
                if (found) return found;
            }
            return null;
        },
        querySelectorAll(sel) {
            let res = [];
            for (const el of docElements) {
                if (matches(el, sel)) res.push(el);
                res = res.concat(findAllDescendants(el, sel));
            }
            return res;
        },
        addEventListener(ev, fn) {
            if (!dom.docListeners[ev]) dom.docListeners[ev] = [];
            dom.docListeners[ev].push(fn);
        },
        removeEventListener(ev, fn) {
            if (dom.docListeners[ev]) {
                dom.docListeners[ev] = dom.docListeners[ev].filter(f => f !== fn);
            }
        },
        dispatch(ev, eventObj) {
            if (dom.docListeners[ev]) {
                dom.docListeners[ev].forEach(fn => fn(eventObj));
            }
        }
    };

    // Build DOM structure based on page
    if (hasJobList) {
        // Jobs Index DOM
        const jobListEl = makeElement('div', { id: 'jobList' });
        const indEl = makeElement('span', { classList: { _classes: new Set(['a-indicator']) } });
        const row1 = makeElement('div', { classList: { _classes: new Set(['job-row']) }, dataset: { id: '1' } });
        const row2 = makeElement('div', { classList: { _classes: new Set(['job-row']) }, dataset: { id: '2' } });
        jobListEl.children.push(indEl, row1, row2);

        const jdScrollEl = makeElement('div', { id: 'jdScroll' });
        const jdInnerEl = makeElement('div', { id: 'jdInner' });
        const jdCompactEl = makeElement('div', { id: 'jdCompact' });
        const searchInputEl = makeElement('input', { id: 'jobSearch', value: '' });
        const filterPopEl = makeElement('div', { id: 'filterPop', hidden: true });
        const applyDialogEl = makeElement('div', { id: 'applyDialog', hidden: true });
        const applyScrimEl = makeElement('div', { id: 'applyScrim', hidden: true });
        const tabAllEl = makeElement('button', { id: 'tabAllJobs' });
        const tabAiEl = makeElement('button', { id: 'tabAiJobs' });
        const paneAllEl = makeElement('div', { id: 'paneAllJobs' });
        const paneAiEl = makeElement('div', { id: 'paneAiJobs' });
        const aiContentEl = makeElement('div', { id: 'aiRecommendationsContent' });
        const refreshAiBtnEl = makeElement('button', { id: 'refreshAiBtn' });

        docElements.push(jobListEl, jdScrollEl, jdInnerEl, jdCompactEl, searchInputEl, filterPopEl, applyDialogEl, applyScrimEl, tabAllEl, tabAiEl, paneAllEl, paneAiEl, aiContentEl, refreshAiBtnEl);
    } else {
        // Details page DOM: NO #jobList! HAS #cvMatchBox
        const cvMatchBox = makeElement('section', {
            id: 'cvMatchBox',
            classList: { _classes: new Set(['jd-section', 'cv-match-box']) },
            dataset: { jobId: String(jobId) }
        });
        const cvSelect = makeElement('select', {
            classList: { _classes: new Set(['form-select', 'cv-select']) },
            value: ''
        });
        const scoreBtn = makeElement('button', {
            classList: { _classes: new Set(['a-btn', 'btn-score-cv']) },
            dataset: { jobId: String(jobId) }
        });
        const resultBox = makeElement('div', {
            classList: { _classes: new Set(['cv-match-result']) }
        });
        const tokenInput = makeElement('input', {
            name: '__RequestVerificationToken',
            value: 'csrf-test-token-123'
        });

        cvMatchBox.children.push(cvSelect, scoreBtn, resultBox, tokenInput);
        docElements.push(cvMatchBox, tokenInput);
    }

    return { document: documentObj, elements: docElements };
}

// Track HTTP calls
const fetchCalls = [];
function fakeFetch(url, options = {}) {
    fetchCalls.push({ url, options });
    if (url === '/Jobs/GetCandidateResumes') {
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                success: true,
                resumes: [
                    { id: 10, label: 'CV Backend C#', hasVector: true },
                    { id: 11, label: 'CV Fullstack', hasVector: false }
                ]
            })
        });
    }
    if (url === '/Jobs/ScoreCvForJob') {
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                success: true,
                status: 'success',
                data: {
                    jobId: 42,
                    jobTitle: 'Senior .NET Engineer',
                    resumeId: 10,
                    resumeName: 'CV Backend C#',
                    finalScore: 88,
                    reason: 'Ứng viên có kỹ năng C# rất tốt',
                    matchedSkills: ['C#', 'SQL Server'],
                    missingSkills: ['Kubernetes'],
                    evidence: [{ cvQuote: 'Đã có 3 năm kinh nghiệm lập trình C#', jobQuote: 'Kinh nghiệm 3+ năm C#' }]
                }
            })
        });
    }
    return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<div>Mock response</div>'),
        json: () => Promise.resolve({ success: true })
    });
}

// TEST 1: Running jobs.js on Details page structure (WITHOUT #jobList)
console.log('>>> TEST 1: Running production jobs.js on Details page structure (no #jobList)...');
const detailsEnv = createDOMEnvironment({ hasJobList: false, jobId: 42 });

const sandboxDetails = {
    console: console,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    matchMedia: () => ({ matches: false }),
    URLSearchParams: URLSearchParams,
    location: { search: '', origin: 'http://localhost:5025' },
    history: { replaceState() {} },
    fetch: fakeFetch,
    document: detailsEnv.document,
    AbortController: AbortController
};
sandboxDetails.window = sandboxDetails;

let scriptError = null;
try {
    vm.runInNewContext(jobsJsCode, sandboxDetails);
} catch (e) {
    scriptError = e;
}

assert.strictEqual(scriptError, null, `jobs.js MUST NOT throw error on Details page, but threw: ${scriptError?.stack}`);
assert.strictEqual(typeof sandboxDetails.window.initCvMatcher, 'function', 'window.initCvMatcher must be exported as a function');
console.log('✓ TEST 1 PASSED: jobs.js executed without throwing on Details structure and exported initCvMatcher');

// Wait for GetCandidateResumes promise to resolve
setTimeout(async () => {
    try {
        console.log('>>> TEST 2: Verifying GetCandidateResumes was called on Details load...');
        const resumeCall = fetchCalls.find(c => c.url === '/Jobs/GetCandidateResumes');
        assert(resumeCall, 'initCvMatcher must fetch /Jobs/GetCandidateResumes');
        console.log('✓ TEST 2 PASSED: GetCandidateResumes called');

        // Check select element updated
        const cvBox = detailsEnv.document.querySelector('.cv-match-box');
        const cvSelect = cvBox.querySelector('.cv-select');
        assert(cvSelect.innerHTML.includes('CV Backend C#'), 'cvSelect must be populated with resumes from response');
        console.log('✓ TEST 3 PASSED: cvSelect dropdown populated with options');

        // Select a CV and click Score button
        console.log('>>> TEST 4: Simulating click on Score button...');
        cvSelect.value = '10';
        const scoreBtn = cvBox.querySelector('.btn-score-cv');
        scoreBtn.dispatch('click');

        // Wait for ScoreCvForJob
        await new Promise(r => setTimeout(r, 50));
        const scoreCall = fetchCalls.find(c => c.url === '/Jobs/ScoreCvForJob');
        assert(scoreCall, 'Score button must call /Jobs/ScoreCvForJob');
        assert.strictEqual(scoreCall.options.method, 'POST', 'Score request must be POST');
        assert.strictEqual(scoreCall.options.headers['RequestVerificationToken'], 'csrf-test-token-123', 'Score request must send RequestVerificationToken header');

        const requestBody = JSON.parse(scoreCall.options.body);
        assert.strictEqual(requestBody.jobId, 42, 'Score payload must contain jobId = 42');
        assert.strictEqual(requestBody.resumeId, 10, 'Score payload must contain resumeId = 10');
        console.log('✓ TEST 4 PASSED: Score request sent with correct CSRF token, jobId, and resumeId');

        const resultBox = cvBox.querySelector('.cv-match-result');
        assert(resultBox.innerHTML.includes('88/100'), 'cvMatchResult must render match score (88/100)');
        assert(resultBox.innerHTML.includes('C#'), 'cvMatchResult must render matched skills');
        assert(resultBox.innerHTML.includes('Kubernetes'), 'cvMatchResult must render missing skills');
        assert(resultBox.innerHTML.includes('Đã có 3 năm kinh nghiệm lập trình C#'), 'cvMatchResult must render evidence quote');
        console.log('✓ TEST 5 PASSED: Result rendered with score, skills chips, and evidence quotes');

        // TEST 6: Jobs Index page regression check
        console.log('>>> TEST 6: Regression check on Jobs Index page (with #jobList)...');
        const indexEnv = createDOMEnvironment({ hasJobList: true });
        const sandboxIndex = {
            console: console,
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            clearTimeout: (id) => clearTimeout(id),
            matchMedia: () => ({ matches: false }),
            URLSearchParams: URLSearchParams,
            location: { search: '', origin: 'http://localhost:5025' },
            history: { replaceState() {} },
            fetch: fakeFetch,
            document: indexEnv.document,
            AbortController: AbortController
        };
        sandboxIndex.window = sandboxIndex;

        let indexError = null;
        try {
            vm.runInNewContext(jobsJsCode, sandboxIndex);
        } catch (e) {
            indexError = e;
        }

        assert.strictEqual(indexError, null, `jobs.js must not throw error on Jobs Index page: ${indexError?.stack}`);
        assert.strictEqual(typeof sandboxIndex.window.initCvMatcher, 'function', 'window.initCvMatcher must also be defined on Jobs Index');
        console.log('✓ TEST 6 PASSED: Jobs Index initialized cleanly with #jobList without regressions');

        // TEST 7: Resumes fetch failure handling
        console.log('>>> TEST 7: Verifying error handling when GetCandidateResumes fails...');
        const failEnv = createDOMEnvironment({ hasJobList: false, jobId: 99 });
        const failFetchCalls = [];
        const sandboxFail = {
            console: console,
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            clearTimeout: (id) => clearTimeout(id),
            matchMedia: () => ({ matches: false }),
            URLSearchParams: URLSearchParams,
            location: { search: '', origin: 'http://localhost:5025' },
            history: { replaceState() {} },
            fetch: (url, opts) => {
                failFetchCalls.push({ url, options: opts });
                if (url === '/Jobs/GetCandidateResumes') {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            success: false,
                            message: 'Không tìm thấy hồ sơ cá nhân.'
                        })
                    });
                }
                return fakeFetch(url, opts);
            },
            document: failEnv.document,
            AbortController: AbortController
        };
        sandboxFail.window = sandboxFail;

        vm.runInNewContext(jobsJsCode, sandboxFail);
        await new Promise(r => setTimeout(r, 60));

        const failCvBox = failEnv.document.querySelector('.cv-match-box');
        const failCvSelect = failCvBox.querySelector('.cv-select');
        const failScoreBtn = failCvBox.querySelector('.btn-score-cv');

        assert.strictEqual(failCvSelect.disabled, true, 'cvSelect must be disabled when resumes fetch fails');
        assert.strictEqual(failScoreBtn.disabled, true, 'scoreBtn must be disabled when resumes fetch fails');
        assert(failCvSelect.innerHTML.includes('Không tìm thấy hồ sơ cá nhân.'), 'cvSelect must display backend error message');
        console.log('✓ TEST 7 PASSED: Gracefully handled GetCandidateResumes failure and disabled score button');

        console.log('\n======================================================');
        console.log('   ALL R1 VERIFICATION TESTS PASSED SUCCESSFULLY!    ');
        console.log('======================================================\n');
        process.exit(0);
    } catch (err) {
        console.error('\nFAILED VERIFICATION:');
        console.error(err);
        process.exit(1);
    }
}, 50);
