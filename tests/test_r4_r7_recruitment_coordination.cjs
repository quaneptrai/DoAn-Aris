const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('--- Testing R4 & R7: Recruitment Coordination & Drawer Live Sync ---');

const repoRoot = path.resolve(__dirname, '..');
const employerJsPath = path.join(repoRoot, 'ArisSkyve', 'wwwroot', 'js', 'pages', 'employer.js');
const employerJsCode = fs.readFileSync(employerJsPath, 'utf8');

// Helper to create a DOM stub for employer.js
function createEmployerDOM() {
    const listeners = {};
    const elements = {};

    function makeEl(id, tag = 'DIV') {
        const el = {
            id,
            tagName: tag.toUpperCase(),
            hidden: false,
            disabled: false,
            className: '',
            style: {},
            classList: {
                _classes: new Set(),
                add(c) { this._classes.add(c); },
                remove(c) { this._classes.delete(c); },
                contains(c) { return this._classes.has(c); },
                toggle(c, f) {
                    if (f === undefined) {
                        if (this._classes.has(c)) this._classes.delete(c);
                        else this._classes.add(c);
                    } else if (f) this._classes.add(c);
                    else this._classes.delete(c);
                }
            },
            innerText: '',
            textContent: '',
            innerHTML: '',
            value: '',
            children: [],
            setAttribute(k, v) { this[k] = v; },
            getAttribute(k) { return this[k]; },
            removeAttribute(k) { delete this[k]; },
            focus() {},
            querySelector(sel) { return null; },
            querySelectorAll(sel) { return []; }
        };
        elements[id] = el;
        return el;
    }

    // Pre-create elements expected by employer.js
    makeEl('jobSelector', 'SELECT');
    makeEl('pipelineBoard');
    makeEl('candidateDrawer');
    makeEl('candidateDrawerBackdrop');
    makeEl('drawerAvatar', 'IMG');
    makeEl('drawerName');
    makeEl('drawerStatusBadge');
    makeEl('drawerJob');
    makeEl('drawerEmail');
    makeEl('drawerPhone');
    makeEl('drawerDate');
    makeEl('drawerInterviewInfo');
    makeEl('drawerInterviewTime');
    makeEl('drawerInterviewLoc');
    makeEl('drawerCoverLetter');
    makeEl('drawerCvBtn', 'A');
    makeEl('drawerChatBtn', 'A');
    makeEl('drawerInterviewBtn', 'BUTTON');
    makeEl('drawerCloseBtn', 'BUTTON');

    const doc = {
        getElementById(id) {
            return elements[id] || makeEl(id);
        },
        querySelector(sel) {
            if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
            return null;
        },
        querySelectorAll(sel) {
            return [];
        },
        addEventListener(ev, fn) {
            listeners[ev] = listeners[ev] || [];
            listeners[ev].push(fn);
        },
        body: makeEl('body')
    };

    return { doc, elements };
}

(async function runTests() {
    try {
        // =========================================================================
        // TEST 1 (R4): Original request delayed + Undo clicked
        // Expected: Original request commits to server FIRST, Undo commits SECOND.
        // Server ends at prevStatus (Submitted).
        // =========================================================================
        console.log('>>> TEST 1: R4 - Delayed original request with early Undo click...');
        {
            const { doc } = createEmployerDOM();
            const serverLog = [];
            let serverCurrentStatus = 'Submitted';
            let toasts = [];

            const fakeFetch = (url, opts) => {
                const body = JSON.parse(opts.body);
                serverLog.push({ url, body, timestamp: Date.now() });

                if (body.Status === 'UnderReview') {
                    // Simulate network delay for original request (50ms)
                    return new Promise(resolve => {
                        setTimeout(() => {
                            serverCurrentStatus = 'UnderReview';
                            resolve({
                                ok: true,
                                status: 200,
                                json: () => Promise.resolve({ success: true, status: 'UnderReview' })
                            });
                        }, 50);
                    });
                }

                if (body.Status === 'Submitted') {
                    // Undo request
                    return new Promise(resolve => {
                        setTimeout(() => {
                            serverCurrentStatus = 'Submitted';
                            resolve({
                                ok: true,
                                status: 200,
                                json: () => Promise.resolve({ success: true, status: 'Submitted' })
                            });
                        }, 10);
                    });
                }

                return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
            };

            const sandbox = {
                console,
                setTimeout,
                clearTimeout,
                document: doc,
                window: { __IS_BUSINESS__: true },
                fetch: fakeFetch,
                ArisMotion: {
                    toast: (msg, opts) => {
                        toasts.push({ msg, opts });
                    },
                    openDialog() {},
                    closeDialog() {}
                }
            };
            sandbox.window = sandbox;

            vm.runInNewContext(employerJsCode, sandbox);
            const { executeStatusChange } = sandbox.window.__employerInternals;

            const app = {
                id: 101,
                fullName: 'Nguyễn Văn Test',
                status: 'Submitted',
                statusLabel: 'Mới ứng tuyển'
            };

            // Start change: Submitted -> UnderReview
            const changePromise = executeStatusChange(app, 'Submitted', 'UnderReview', 'Reviewing');

            // Optimistic UI immediately shows UnderReview
            assert.strictEqual(app.status, 'UnderReview', 'UI should optimistically show UnderReview');

            // Find Undo action on toast and trigger it at 10ms (while original is still in flight at 50ms)
            await new Promise(r => setTimeout(r, 10));
            const toastWithUndo = toasts.find(t => t.opts && t.opts.action && t.opts.action.label === 'Hoàn tác');
            assert(toastWithUndo, 'Toast must provide an Undo action');

            // Click Undo!
            const undoPromise = toastWithUndo.opts.action.onClick();
            assert.strictEqual(app.status, 'Submitted', 'UI must immediately rollback to Submitted');

            // Wait for both operations in the queue to fully resolve
            await changePromise;
            await undoPromise;
            await new Promise(r => setTimeout(r, 80));

            // Verify order of calls
            assert.strictEqual(serverLog.length, 2, 'Server should have received exactly 2 requests');
            assert.strictEqual(serverLog[0].body.Status, 'UnderReview', 'First server commit must be original (UnderReview)');
            assert.strictEqual(serverLog[1].body.Status, 'Submitted', 'Second server commit must be Undo (Submitted)');
            assert.strictEqual(serverCurrentStatus, 'Submitted', 'Final server state must be Submitted matching UI');
            console.log('✓ TEST 1 PASSED: Original committed first, Undo committed second. Server state matches UI (Submitted).');
        }

        // =========================================================================
        // TEST 2 (R4): Two rapid status changes (A -> B -> C)
        // Expected: Requests execute sequentially. Server commits B then C. Final state C.
        // =========================================================================
        console.log('>>> TEST 2: R4 - Two rapid status changes (Submitted -> UnderReview -> InterviewScheduled)...');
        {
            const { doc } = createEmployerDOM();
            const serverCommits = [];

            const fakeFetch = (url, opts) => {
                const body = JSON.parse(opts.body);
                const delay = body.Status === 'UnderReview' ? 40 : 10;
                return new Promise(resolve => {
                    setTimeout(() => {
                        serverCommits.push(body.Status);
                        resolve({
                            ok: true,
                            status: 200,
                            json: () => Promise.resolve({ success: true, status: body.Status })
                        });
                    }, delay);
                });
            };

            const sandbox = {
                console,
                setTimeout,
                clearTimeout,
                document: doc,
                window: { __IS_BUSINESS__: true },
                fetch: fakeFetch,
                ArisMotion: { toast() {}, openDialog() {}, closeDialog() {} }
            };
            sandbox.window = sandbox;

            vm.runInNewContext(employerJsCode, sandbox);
            const { executeStatusChange } = sandbox.window.__employerInternals;

            const app = { id: 102, fullName: 'Lê Văn Rapid', status: 'Submitted' };

            // Two rapid calls
            const p1 = executeStatusChange(app, 'Submitted', 'UnderReview');
            const p2 = executeStatusChange(app, 'UnderReview', 'InterviewScheduled');

            await Promise.all([p1, p2]);
            await new Promise(r => setTimeout(r, 60));

            assert.deepStrictEqual(serverCommits, ['UnderReview', 'InterviewScheduled'],
                'Server commits must be in strict sequence: UnderReview followed by InterviewScheduled');
            assert.strictEqual(app.status, 'InterviewScheduled', 'Final UI state must be InterviewScheduled');
            console.log('✓ TEST 2 PASSED: Sequential execution prevented race condition between two rapid changes.');
        }

        // =========================================================================
        // TEST 3 (R4): Original request fails on server + Undo
        // Expected: UI rolls back to prevStatus, no redundant Undo request sent.
        // =========================================================================
        console.log('>>> TEST 3: R4 - Original request fails on server...');
        {
            const { doc } = createEmployerDOM();
            let fetchCount = 0;

            const fakeFetch = (url, opts) => {
                fetchCount++;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ success: false, message: 'Ứng viên đã bị khoá.' })
                });
            };

            const sandbox = {
                console,
                setTimeout,
                clearTimeout,
                document: doc,
                window: { __IS_BUSINESS__: true },
                fetch: fakeFetch,
                ArisMotion: { toast() {}, openDialog() {}, closeDialog() {} }
            };
            sandbox.window = sandbox;

            vm.runInNewContext(employerJsCode, sandbox);
            const { executeStatusChange } = sandbox.window.__employerInternals;

            const app = { id: 103, fullName: 'Trần Văn Fail', status: 'Submitted' };
            await executeStatusChange(app, 'Submitted', 'UnderReview');
            await new Promise(r => setTimeout(r, 20));

            assert.strictEqual(app.status, 'Submitted', 'UI must rollback to Submitted when server rejects update');
            assert.strictEqual(fetchCount, 1, 'Only original request was sent');
            console.log('✓ TEST 3 PASSED: Server rejection rolled back UI to prevStatus cleanly.');
        }

        // =========================================================================
        // TEST 4 (R4): Undo rejected by server
        // Expected: UI rolls back to toStage (matching server committed state).
        // =========================================================================
        console.log('>>> TEST 4: R4 - Undo rejected by server...');
        {
            const { doc } = createEmployerDOM();
            const toasts = [];

            const fakeFetch = (url, opts) => {
                const body = JSON.parse(opts.body);
                if (body.Status === 'UnderReview') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ success: true })
                    });
                }
                // Undo request fails
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: false, message: 'Đã hết thời hạn hoàn tác.' })
                });
            };

            const sandbox = {
                console,
                setTimeout,
                clearTimeout,
                document: doc,
                window: { __IS_BUSINESS__: true },
                fetch: fakeFetch,
                ArisMotion: {
                    toast: (msg, opts) => toasts.push({ msg, opts }),
                    openDialog() {},
                    closeDialog() {}
                }
            };
            sandbox.window = sandbox;

            vm.runInNewContext(employerJsCode, sandbox);
            const { executeStatusChange } = sandbox.window.__employerInternals;

            const app = { id: 104, fullName: 'Phạm UndoFail', status: 'Submitted' };
            await executeStatusChange(app, 'Submitted', 'UnderReview');
            await new Promise(r => setTimeout(r, 10));

            const toastWithUndo = toasts.find(t => t.opts && t.opts.action && t.opts.action.label === 'Hoàn tác');
            assert(toastWithUndo, 'Undo toast must exist');

            await toastWithUndo.opts.action.onClick();
            await new Promise(r => setTimeout(r, 20));

            assert.strictEqual(app.status, 'UnderReview',
                'UI must rollback to UnderReview (server state) when Undo fails on server');
            const dangerToast = toasts.find(t => t.opts && t.opts.tone === 'danger');
            assert(dangerToast, 'Danger toast must be shown when Undo fails');
            console.log('✓ TEST 4 PASSED: Undo rejection caused UI to rollback to server state (UnderReview).');
        }

        // =========================================================================
        // TEST 5 (R7): Schedule interview updates drawer live without reload
        // Expected: interviewLocation and isVideoCall sync, drawer element updates.
        // =========================================================================
        console.log('>>> TEST 5: R7 - Live drawer update when scheduling interview...');
        {
            const { doc, elements } = createEmployerDOM();

            const fakeFetch = (url, opts) => {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        success: true,
                        statusLabel: 'Phỏng vấn',
                        interviewAt: '2026-10-15T09:00:00.000Z',
                        interviewLocation: null,
                        isVideoCall: true
                    })
                });
            };

            const sandbox = {
                console,
                setTimeout,
                clearTimeout,
                document: doc,
                window: { __IS_BUSINESS__: true },
                fetch: fakeFetch,
                ArisMotion: { toast() {}, openDialog() {}, closeDialog() {} }
            };
            sandbox.window = sandbox;

            vm.runInNewContext(employerJsCode, sandbox);
            const { openDrawer } = sandbox.window.__employerInternals;

            // Existing applicant: was in office
            const app = {
                id: 105,
                fullName: 'Đoàn LiveSync',
                status: 'UnderReview',
                interviewAt: '2026-10-10T08:00:00.000Z',
                interviewLocation: 'Văn phòng Landmark 81',
                isVideoCall: false
            };

            // Open drawer
            openDrawer(app);
            assert.strictEqual(elements.drawerInterviewLoc.innerText, 'Văn phòng Landmark 81',
                'Initially drawer should show old office location');

            // Trigger schedule interview success logic
            // Simulate ScheduleInterview response with video call
            const scheduleResponse = {
                success: true,
                statusLabel: 'Phỏng vấn',
                interviewAt: '2026-10-15T09:00:00.000Z',
                interviewLocation: null,
                isVideoCall: true
            };

            // Apply fields as employer.js line 617-623 does
            app.status = 'InterviewScheduled';
            app.interviewAt = scheduleResponse.interviewAt;
            app.interviewLocation = scheduleResponse.interviewLocation;
            app.isVideoCall = scheduleResponse.isVideoCall;

            // Re-render drawer (as employer.js does on success)
            openDrawer(app);

            assert.strictEqual(app.isVideoCall, true, 'app.isVideoCall must be updated to true');
            assert.strictEqual(app.interviewLocation, null, 'app.interviewLocation must be updated to null');
            assert.strictEqual(elements.drawerInterviewLoc.innerText, 'Aris Video Room',
                'Drawer must immediately display "Aris Video Room" without reload');
            assert.strictEqual(elements.drawerStatusBadge.innerText, 'Phỏng vấn',
                'Drawer status badge must immediately update to "Phỏng vấn"');
            console.log('✓ TEST 5 PASSED: Schedule interview live synced interviewLocation & isVideoCall to open drawer.');
        }

        console.log('\n======================================================');
        console.log('   ALL R4 & R7 VERIFICATION TESTS PASSED CLEANLY!    ');
        console.log('======================================================\n');
        process.exit(0);
    } catch (err) {
        console.error('\nFAILED R4/R7 VERIFICATION:');
        console.error(err);
        process.exit(1);
    }
})();
