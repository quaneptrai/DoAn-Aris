const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const cp = require('child_process');

console.log('========================================================================');
console.log('   VERIFYING 8 SPECIFIC EDGE CASES: R4 (1-4), R5 (5,6), R6 (7), R2 (8)   ');
console.log('========================================================================\n');

const repoRoot = path.resolve(__dirname, '..');
const employerJsPath = path.join(repoRoot, 'ArisSkyve', 'wwwroot', 'js', 'pages', 'employer.js');
const jobsControllerPath = path.join(repoRoot, 'ArisSkyve', 'Controllers', 'JobsController.cs');

const employerJsCode = fs.readFileSync(employerJsPath, 'utf8');
const jobsControllerCode = fs.readFileSync(jobsControllerPath, 'utf8');

// Helper to run BackendEfTests with targeted case filter and fallback if unbuilt
function runEfCase(caseName) {
    try {
        return cp.execFileSync('dotnet', ['run', '--project', 'tests/BackendEfTests/BackendEfTests.csproj', '--no-build', '--', caseName], {
            encoding: 'utf8',
            cwd: repoRoot
        });
    } catch {
        return cp.execFileSync('dotnet', ['run', '--project', 'tests/BackendEfTests/BackendEfTests.csproj', '--', caseName], {
            encoding: 'utf8',
            cwd: repoRoot
        });
    }
}

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
            checked: true,
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
    makeEl('scheduleInterviewModal');
    makeEl('interviewDateInput', 'INPUT');
    makeEl('interviewTimeInput', 'INPUT');
    makeEl('interviewLocationInput', 'INPUT');
    makeEl('interviewVideoCallToggle', 'INPUT');
    makeEl('interviewNoteInput', 'INPUT');
    makeEl('confirmScheduleBtn', 'BUTTON');

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

(async function runAllEdgeCaseTests() {
    try {
        // =========================================================================
        // CASE 1 (R4): Hai lần đổi trạng thái nhanh, request 1 thất bại, request 2 thành công
        // BUG CŨ: UI kẹt ở 'Submitted', Server là 'Hired'.
        // KẾT QUẢ ĐÚNG: UI phải là 'Hired', Server là 'Hired'.
        // =========================================================================
        console.log('>>> RUNNING CASE 1 (R4): Two rapid changes: req1 fails, req2 succeeds...');
        {
            const { doc } = createEmployerDOM();
            const serverStatusLog = [];
            let serverFinalStatus = 'Submitted';

            const fakeFetch = (url, opts) => {
                const body = JSON.parse(opts.body);
                const status = body.Status;
                if (status === 'UnderReview') {
                    // Request 1 fails on server
                    return new Promise(resolve => {
                        setTimeout(() => {
                            serverStatusLog.push({ status: 'UnderReview', success: false });
                            resolve({
                                ok: true,
                                status: 200,
                                json: () => Promise.resolve({ success: false, message: 'Thao tác tạm thời bị từ chối' })
                            });
                        }, 30);
                    });
                }
                if (status === 'Hired') {
                    // Request 2 succeeds on server
                    return new Promise(resolve => {
                        setTimeout(() => {
                            serverFinalStatus = 'Hired';
                            serverStatusLog.push({ status: 'Hired', success: true });
                            resolve({
                                ok: true,
                                status: 200,
                                json: () => Promise.resolve({ success: true, status: 'Hired' })
                            });
                        }, 30);
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
                ArisMotion: { toast() {}, openDialog() {}, closeDialog() {} }
            };
            sandbox.window = sandbox;

            vm.runInNewContext(employerJsCode, sandbox);
            const { executeStatusChange } = sandbox.window.__employerInternals;

            const app = { id: 201, fullName: 'Nguyễn Văn Case1', status: 'Submitted' };

            // Hai lần đổi trạng thái liên tiếp cực nhanh
            const p1 = executeStatusChange(app, 'Submitted', 'UnderReview');
            const p2 = executeStatusChange(app, 'UnderReview', 'Hired');

            await Promise.all([p1, p2]);
            await new Promise(r => setTimeout(r, 60));

            assert.strictEqual(serverFinalStatus, 'Hired', 'Server final status must be Hired');
            assert.strictEqual(app.status, 'Hired', 'UI must show Hired (not overwritten to Submitted by failed 1st request)');
            console.log('✓ CASE 1 PASSED: UI is Hired and Server is Hired cleanly.\n');
        }

        // =========================================================================
        // CASE 2 (R4): Cả hai request đổi trạng thái nhanh đều thất bại
        // BUG CŨ: UI kẹt ở 'UnderReview', Server vẫn là 'Submitted'.
        // KẾT QUẢ ĐÚNG: UI phải rollback về trạng thái server đã xác nhận ban đầu ('Submitted').
        // =========================================================================
        console.log('>>> RUNNING CASE 2 (R4): Two rapid changes: both fail...');
        {
            const { doc } = createEmployerDOM();
            let serverFinalStatus = 'Submitted';

            const fakeFetch = (url, opts) => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            status: 200,
                            json: () => Promise.resolve({ success: false, message: 'Máy chủ lỗi' })
                        });
                    }, 20);
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

            const app = { id: 202, fullName: 'Trần Văn Case2', status: 'Submitted' };

            const p1 = executeStatusChange(app, 'Submitted', 'UnderReview');
            const p2 = executeStatusChange(app, 'UnderReview', 'Hired');

            await Promise.all([p1, p2]);
            await new Promise(r => setTimeout(r, 60));

            assert.strictEqual(serverFinalStatus, 'Submitted', 'Server status must be Submitted');
            assert.strictEqual(app.status, 'Submitted', 'UI must rollback to Submitted (not left in intermediate UnderReview)');
            console.log('✓ CASE 2 PASSED: UI correctly rolled back to Submitted when all rapid requests failed.\n');
        }

        // =========================================================================
        // CASE 3 (R4): Server đã ghi nhưng mất response, người dùng Undo
        // BUG CŨ: Vì fetch bắt lỗi mạng (succeeded=false), Undo bỏ qua không gọi server -> UI 'Submitted', Server 'UnderReview'.
        // KẾT QUẢ ĐÚNG: Undo vẫn gửi yêu cầu khôi phục trạng thái cũ lên server -> UI 'Submitted', Server 'Submitted'.
        // =========================================================================
        console.log('>>> RUNNING CASE 3 (R4): Server wrote but response lost + Undo clicked...');
        {
            const { doc } = createEmployerDOM();
            const toasts = [];
            let serverStatus = 'Submitted';
            let undoCallCount = 0;

            const fakeFetch = (url, opts) => {
                const body = JSON.parse(opts.body);
                if (body.Status === 'UnderReview') {
                    // Server ghi nhận thành công, nhưng kết nối mạng bị ngắt khi trả về (fetch throw lỗi mạng)
                    serverStatus = 'UnderReview';
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            reject(new Error('Network connection drop / response lost'));
                        }, 40);
                    });
                }
                if (body.Status === 'Submitted') {
                    // Request Hoàn tác (Undo)
                    undoCallCount++;
                    serverStatus = 'Submitted';
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve({
                                ok: true,
                                status: 200,
                                json: () => Promise.resolve({ success: true, status: 'Submitted' })
                            });
                        }, 20);
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
                    toast: (msg, opts) => toasts.push({ msg, opts }),
                    openDialog() {},
                    closeDialog() {}
                }
            };
            sandbox.window = sandbox;

            vm.runInNewContext(employerJsCode, sandbox);
            const { executeStatusChange } = sandbox.window.__employerInternals;

            const app = { id: 203, fullName: 'Lê Văn Case3', status: 'Submitted' };

            const opPromise = executeStatusChange(app, 'Submitted', 'UnderReview');

            // Người dùng click Hoàn tác trên toast
            await new Promise(r => setTimeout(r, 10));
            const undoToast = toasts.find(t => t.opts && t.opts.action && t.opts.action.label === 'Hoàn tác');
            assert(undoToast, 'Undo toast must be present');

            const undoPromise = undoToast.opts.action.onClick();

            await Promise.allSettled([opPromise, undoPromise]);
            await new Promise(r => setTimeout(r, 80));

            assert.strictEqual(undoCallCount, 1, 'Undo request MUST be sent to server to recover lost response');
            assert.strictEqual(serverStatus, 'Submitted', 'Server final status must be Submitted');
            assert.strictEqual(app.status, 'Submitted', 'UI must match server state (Submitted)');
            console.log('✓ CASE 3 PASSED: Server state and UI are both Submitted even when original response was lost.\n');
        }

        // =========================================================================
        // CASE 4 (R4): Đặt lịch phỏng vấn khi request đổi trạng thái còn đang chạy
        // BUG CŨ: Schedule chạy song song và hoàn thành trước, sau đó UpdateApplicationStatus hoàn thành sau -> UI 'InterviewScheduled', Server 'UnderReview'.
        // KẾT QUẢ ĐÚNG: Schedule phối hợp tuần tự với queue; Server là 'InterviewScheduled', UI là 'InterviewScheduled'.
        // =========================================================================
        console.log('>>> RUNNING CASE 4 (R4): Schedule interview while status update is in-flight...');
        {
            const { doc, elements } = createEmployerDOM();
            const serverSequence = [];
            let serverFinalStatus = 'Submitted';

            // Fake bootstrap Modal
            let modalShown = false;
            let modalHidden = false;
            class FakeModal {
                constructor() {}
                show() { modalShown = true; }
                hide() { modalHidden = true; }
            }

            const fakeFetch = (url, opts) => {
                if (url.includes('UpdateApplicationStatus')) {
                    const body = JSON.parse(opts.body);
                    return new Promise(resolve => {
                        // Request đổi trạng thái chậm (60ms)
                        setTimeout(() => {
                            serverFinalStatus = body.Status;
                            serverSequence.push(`Update:${body.Status}`);
                            resolve({
                                ok: true,
                                status: 200,
                                json: () => Promise.resolve({ success: true, status: body.Status })
                            });
                        }, 60);
                    });
                }
                if (url.includes('ScheduleInterview')) {
                    return new Promise(resolve => {
                        // Schedule hoàn thành trong 20ms
                        setTimeout(() => {
                            serverFinalStatus = 'InterviewScheduled';
                            serverSequence.push('Schedule:InterviewScheduled');
                            resolve({
                                ok: true,
                                status: 200,
                                json: () => Promise.resolve({
                                    success: true,
                                    interviewAt: '2026-10-15T10:00:00Z',
                                    interviewLocation: 'Aris Video Room',
                                    isVideoCall: true
                                })
                            });
                        }, 20);
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
                bootstrap: { Modal: FakeModal },
                fetch: fakeFetch,
                ArisMotion: { toast() {}, openDialog() {}, closeDialog() {} }
            };
            sandbox.window = sandbox;

            vm.runInNewContext(employerJsCode, sandbox);
            const { executeStatusChange, openScheduleInterviewModal } = sandbox.window.__employerInternals;

            const app = { id: 204, fullName: 'Hoàng Văn Case4', status: 'Submitted' };

            // 1. Kích hoạt đổi trạng thái sang UnderReview (đang chạy mạng 60ms)
            const statusChangePromise = executeStatusChange(app, 'Submitted', 'UnderReview');

            // 2. Ngay khi đang chạy (tại 10ms), mở modal hẹn phỏng vấn và bấm xác nhận
            await new Promise(r => setTimeout(r, 10));
            openScheduleInterviewModal(app, 'Submitted');
            assert(elements.confirmScheduleBtn.onclick, 'confirmScheduleBtn handler must be bound');

            const schedulePromise = elements.confirmScheduleBtn.onclick();

            await Promise.all([statusChangePromise, schedulePromise]);
            await new Promise(r => setTimeout(r, 80));

            // Kiểm tra thứ tự thực thi tuần tự trên server
            assert.deepStrictEqual(serverSequence, ['Update:UnderReview', 'Schedule:InterviewScheduled'],
                'Server operations must be strictly sequenced: Update followed by Schedule');
            assert.strictEqual(serverFinalStatus, 'InterviewScheduled',
                'Server final status must be InterviewScheduled (not overwritten by UnderReview)');
            assert.strictEqual(app.status, 'InterviewScheduled',
                'UI final status must be InterviewScheduled');
            console.log('✓ CASE 4 PASSED: Sequenced coordination ensured Server and UI are both InterviewScheduled.\n');
        }

        // =========================================================================
        // =========================================================================
        // CASE 5 (R5 & R6): Force refresh & vector_pending/vector_empty protection
        // KẾT QUẢ ĐÚNG:
        // - Khi force refresh nhận [] (rỗng), cache cũ của CV đó được xóa sạch.
        // - Khi AiCore trả về vector_pending hoặc vector_empty, cache cũ KHÔNG bị xóa
        //   và KHÔNG được ghi marker hoàn tất 0-job.
        // Chạy kiểm thử EF Core và Controller thật (BackendEfTests).
        // =========================================================================
        console.log('>>> RUNNING CASE 5 (R5): Force refresh with empty list clears obsolete cache & vector status protection...');
        {
            // Kiểm tra hợp đồng mã nguồn trong JobsController.cs
            assert(jobsControllerCode.includes('// AI trả về rỗng (0 recommendations)'),
                'JobsController must handle empty recommendation results by clearing old cache');
            assert(jobsControllerCode.includes('_context.UserRecommendations.RemoveRange(oldBatchRecords);'),
                'JobsController must call RemoveRange on old batch records when AI returns empty');
            assert(jobsControllerCode.includes('result?.Status == "vector_pending"'),
                'JobsController must explicitly handle vector_pending without clearing cache');
            assert(jobsControllerCode.includes('result?.Status == "vector_empty"'),
                'JobsController must explicitly handle vector_empty without clearing cache');

            // Chạy kiểm thử EF Core & JobsController thật
            const efOutput = runEfCase('case5');

            assert(efOutput.includes('Subtest 5A: vector_pending safely preserved existing cache'),
                'Real EF Core: vector_pending must safely preserve cache and not write false 0-job marker');
            assert(efOutput.includes('Subtest 5B: vector_empty safely preserved existing cache'),
                'Real EF Core: vector_empty must safely preserve cache and not write false 0-job marker');
            assert(efOutput.includes('Subtest 5C: Genuine success with empty list cleared old cache and wrote 0-job marker'),
                'Real EF Core: Genuine empty result must clear old cache and save 0-job marker');

            console.log('✓ CASE 5 PASSED: Real EF Core & Controller verified cache clearance and vector_pending protection.\n');
        }

        // =========================================================================
        // CASE 6 (R5): Reason mới rỗng vẫn giữ lời giải thích cũ
        // BUG CŨ: if (!string.IsNullOrEmpty(rec.Reason)) { existing.Reason = rec.Reason; } -> reason mới rỗng bị bỏ qua.
        // KẾT QUẢ ĐÚNG: existing.Reason = rec.Reason ?? string.Empty;
        // Chạy kiểm thử EF Core và Controller thật (BackendEfTests).
        // =========================================================================
        console.log('>>> RUNNING CASE 6 (R5): Overwrite empty new reason cleanly without preserving stale text...');
        {
            // Kiểm tra mã nguồn không còn giữ if (!string.IsNullOrEmpty(rec.Reason))
            assert(jobsControllerCode.includes('existing.Reason = rec.Reason ?? string.Empty;'),
                'JobsController must directly assign existing.Reason = rec.Reason ?? string.Empty');
            assert(!jobsControllerCode.includes('if (!string.IsNullOrEmpty(rec.Reason))\r\n                                            {\r\n                                                existing.Reason = rec.Reason;'),
                'JobsController must NOT guard reason update with isNullOrEmpty');

            // Chạy kiểm thử EF Core & JobsController thật
            const efOutput = runEfCase('case6');

            assert(efOutput.includes('CASE 6 PASSED: Stale reason was cleanly overwritten with empty string in real EF Core.'),
                'Real EF Core: Stale reason must be overwritten cleanly with empty string');

            console.log('✓ CASE 6 PASSED: Obsolete reason was cleanly replaced in real EF Core.\n');
        }

        // =========================================================================
        // CASE 7 (R6): Kết quả 0 job không được lưu dấu hoàn tất, nên tải lại vẫn gọi AI
        // KẾT QUẢ ĐÚNG: Lưu marker hoàn tất 0-job (JobId = 0, RequestedTopK = topK); tải lại không gọi AI.
        // Chạy kiểm thử EF Core và Controller thật (BackendEfTests).
        // =========================================================================
        console.log('>>> RUNNING CASE 7 (R6): Zero-job completion marker avoids repeated AI calls on reload...');
        {
            // Kiểm tra mã nguồn
            assert(jobsControllerCode.includes('JobId = 0'),
                'JobsController must persist a marker record with JobId = 0');
            assert(jobsControllerCode.includes('emptyMarkerPayload'),
                'JobsController must create emptyMarkerPayload with RequestedTopK');

            // Chạy kiểm thử EF Core & JobsController thật
            const efOutput = runEfCase('case7');

            assert(efOutput.includes('Subtest 7A: Cache hit on zero-job marker avoided AI call for topK=5.'),
                'Real EF Core: Cache hit on zero-job marker avoided AI call');
            assert(efOutput.includes('Subtest 7B: RequestedTopK updated to 10 in real EF Core for larger batch.'),
                'Real EF Core: RequestedTopK updated for larger batch');

            console.log('✓ CASE 7 PASSED: Zero-job marker verified in real EF Core & Controller.\n');
        }

        // =========================================================================
        // CASE 8 (R2): Bỏ hoàn toàn fallback ResumeId == null để cách ly triệt để giữa các CV
        // KẾT QUẢ ĐÚNG:
        // - Cache query trong JobsController phải khớp chặt r.ResumeId == resumeIdBefore.
        // - Không còn fallback r.ResumeId == null hoặc hasMultipleResumes.
        // - Hai CV cùng timestamp, xóa một CV thì CV còn lại vẫn KHÔNG nhận cache ResumeId == null.
        // Chạy kiểm thử EF Core và Controller thật (BackendEfTests).
        // =========================================================================
        console.log('>>> RUNNING CASE 8 (R2): Strict CV identity isolation across multiple resumes with same timestamp...');
        {
            // Kiểm tra mã nguồn trong JobsController.cs
            assert(!jobsControllerCode.includes('hasMultipleResumes'),
                'JobsController must not rely on hasMultipleResumes fallback');
            assert(!jobsControllerCode.includes('r.ResumeId == null'),
                'JobsController must not contain fallback ResumeId == null');
            assert(jobsControllerCode.includes('r.ResumeId == resumeIdBefore'),
                'JobsController must strictly require r.ResumeId == resumeIdBefore');

            // Chạy kiểm thử EF Core & JobsController thật
            const efOutput = runEfCase('case8');

            assert(efOutput.includes('Subtest 8A: Resume B strictly did NOT match legacy ResumeId == null cache.'),
                'Real EF Core: Resume B must strictly ignore legacy null cache');
            assert(efOutput.includes('Subtest 8B: After deleting CV A, CV B STILL strictly ignores legacy ResumeId == null cache.'),
                'Real EF Core: After deleting CV A, CV B must still strictly ignore legacy null cache');

            console.log('✓ CASE 8 PASSED: Strict CV identity isolation verified in real EF Core & Controller.\n');
        }

        // =========================================================================
        // CASE 9 (R4 Robustness): Stale Undo toast does not overwrite newer operations
        // KẾT QUẢ ĐÚNG: Toast cũ bị từ chối, giữ nguyên trạng thái mới nhất 'Hired'.
        // =========================================================================
        console.log('>>> RUNNING CASE 9 (R4): Stale Undo toast does not clobber newer operations...');
        {
            const { doc } = createEmployerDOM();
            const toasts = [];
            let serverStatus = 'Submitted';

            const fakeFetch = (url, opts) => {
                const body = JSON.parse(opts.body);
                serverStatus = body.Status;
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, status: body.Status }) });
            };

            const sandbox = {
                console, setTimeout, clearTimeout, AbortController,
                document: doc,
                window: { __IS_BUSINESS__: true },
                fetch: fakeFetch,
                ArisMotion: {
                    toast: (msg, opts) => toasts.push({ msg, opts }),
                    openDialog() {}, closeDialog() {}
                }
            };
            sandbox.window = sandbox;

            vm.runInNewContext(employerJsCode, sandbox);
            const { executeStatusChange } = sandbox.window.__employerInternals;

            const app = { id: 209, fullName: 'Phạm Thị Case9', status: 'Submitted' };

            // Op 1: Submitted -> UnderReview
            await executeStatusChange(app, 'Submitted', 'UnderReview');
            const toast1 = toasts[0];
            assert.strictEqual(app.status, 'UnderReview');

            // Op 2: UnderReview -> Hired
            await executeStatusChange(app, 'UnderReview', 'Hired');
            assert.strictEqual(app.status, 'Hired');
            assert.strictEqual(serverStatus, 'Hired');

            // Người dùng click [Hoàn tác] trên Toast 1 cũ
            await toast1.opts.action.onClick();
            await new Promise(r => setTimeout(r, 40));

            // Trạng thái KHÔNG được rollback về Submitted, phải được bảo vệ ở Hired
            assert.strictEqual(serverStatus, 'Hired', 'Server must remain Hired');
            assert.strictEqual(app.status, 'Hired', 'UI must remain Hired despite stale toast Undo click');
            console.log('✓ CASE 9 PASSED: Stale toast Undo was safely rejected, preserving latest Hired status.\n');
        }

        // =========================================================================
        // CASE 10 (R4 Robustness): In-flight Undo failure does not corrupt confirmedStatus
        // KẾT QUẢ ĐÚNG: Sau khi Undo thất bại, confirmedStatus là UnderReview. Khi Op 3 thất bại, UI rollback về UnderReview, không bị lệch sang Submitted.
        // =========================================================================
        console.log('>>> RUNNING CASE 10 (R4): In-flight Undo failure preserves confirmedStatus...');
        {
            const { doc } = createEmployerDOM();
            const toasts = [];
            let serverStatus = 'Submitted';

            const fakeFetch = (url, opts) => {
                const body = JSON.parse(opts.body);
                if (body.Status === 'UnderReview') {
                    serverStatus = 'UnderReview';
                    return new Promise(r => setTimeout(() => r({ ok: true, json: () => Promise.resolve({ success: true, status: 'UnderReview' }) }), 20));
                }
                if (body.Status === 'Submitted') {
                    // Undo thất bại trên server
                    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: false, message: 'Undo rejected by server' }) });
                }
                if (body.Status === 'Offered') {
                    // Op 3 thất bại trên server
                    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: false, message: 'Offered failed' }) });
                }
            };

            const sandbox = {
                console, setTimeout, clearTimeout, AbortController,
                document: doc,
                window: { __IS_BUSINESS__: true },
                fetch: fakeFetch,
                ArisMotion: {
                    toast: (msg, opts) => toasts.push({ msg, opts }),
                    openDialog() {}, closeDialog() {}
                }
            };
            sandbox.window = sandbox;

            vm.runInNewContext(employerJsCode, sandbox);
            const { executeStatusChange, getAppState } = sandbox.window.__employerInternals;

            const app = { id: 210, fullName: 'Vũ Văn Case10', status: 'Submitted' };

            // Op 1: Submitted -> UnderReview (đang chạy)
            const p1 = executeStatusChange(app, 'Submitted', 'UnderReview');

            // Người dùng click Undo ngay khi Op 1 đang chạy
            await new Promise(r => setTimeout(r, 5));
            const toast1 = toasts[0];
            const pUndo = toast1.opts.action.onClick();

            await Promise.all([p1, pUndo]);
            await new Promise(r => setTimeout(r, 40));

            // Server vẫn là UnderReview, UI phải là UnderReview và confirmedStatus phải là UnderReview
            const stateAfterUndo = getAppState(app);
            assert.strictEqual(serverStatus, 'UnderReview', 'Server must be UnderReview');
            assert.strictEqual(app.status, 'UnderReview', 'UI must be UnderReview after failed Undo');
            assert.strictEqual(stateAfterUndo.confirmedStatus, 'UnderReview', 'confirmedStatus must be UnderReview');

            // Op 3: UnderReview -> Offered (thất bại)
            await executeStatusChange(app, 'UnderReview', 'Offered');
            await new Promise(r => setTimeout(r, 40));

            assert.strictEqual(serverStatus, 'UnderReview', 'Server remains UnderReview');
            assert.strictEqual(app.status, 'UnderReview', 'UI must rollback to UnderReview, NOT diverged to Submitted');
            console.log('✓ CASE 10 PASSED: Undo failure correctly updated confirmedStatus to UnderReview.\n');
        }

        // =========================================================================
        // CASE 11 (R4 Robustness): Job switch during in-flight status failure rolls back applicant.status
        // KẾT QUẢ ĐÚNG: Dù người dùng chuyển đổi tab tin tuyển dụng, app.status vẫn được rollback sạch sẽ.
        // =========================================================================
        console.log('>>> RUNNING CASE 11 (R4): Job switch during status update failure maintains applicant status...');
        {
            const { doc } = createEmployerDOM();
            let serverStatus = 'Submitted';

            const fakeFetch = (url, opts) => {
                if (url.includes('GetApplicantsForJob')) {
                    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, applicants: [] }) });
                }
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve({ ok: true, json: () => Promise.resolve({ success: false, message: 'Server error' }) });
                    }, 30);
                });
            };

            const sandbox = {
                console, setTimeout, clearTimeout, AbortController,
                document: doc,
                window: { __IS_BUSINESS__: true },
                fetch: fakeFetch,
                ArisMotion: { toast() {}, openDialog() {}, closeDialog() {} }
            };
            sandbox.window = sandbox;

            vm.runInNewContext(employerJsCode, sandbox);
            const { executeStatusChange } = sandbox.window.__employerInternals;

            sandbox.window.selectJob(101);
            const app = { id: 211, fullName: 'Đỗ Văn Case11', status: 'Submitted' };

            // Thao tác đổi trạng thái trên job 101
            const p = executeStatusChange(app, 'Submitted', 'UnderReview');

            // Chuyển sang job 102 khi request đang chạy mạng
            sandbox.window.selectJob(102);

            await p;
            await new Promise(r => setTimeout(r, 50));

            assert.strictEqual(app.status, 'Submitted', 'app.status must be rolled back to Submitted even when active jobId shifted');
            console.log('✓ CASE 11 PASSED: Applicant status was properly rolled back despite job tab change.\n');
        }

        console.log('========================================================================');
        console.log('   ALL 11 EDGE CASE VERIFICATIONS (R4 1-4, 9-11, R5 5-6, R6 7, R2 8) PASSED!   ');
        console.log('========================================================================\n');
        process.exit(0);
    } catch (err) {
        console.error('\nFAILED EDGE CASE VERIFICATION:');
        console.error(err);
        process.exit(1);
    }
})();
