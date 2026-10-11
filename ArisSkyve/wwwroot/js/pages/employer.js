/* =============================================================================
   ARIS LINE — Bảng tuyển dụng & Pipeline (V7 + quy trình tuyển dụng 04/10/2026)
   - Thẻ ứng viên: điểm AI + một dòng lý do, cờ việc cần làm; sắp theo mới nhất / phù hợp nhất.
   - Ngăn chi tiết: "Bước tiếp theo" (RecruitmentFlow phía máy chủ), tab Tổng quan / Phân tích AI /
     Phỏng vấn (giờ ứng viên đề xuất, phiếu đánh giá) / Lịch sử.
   - Từ chối có nhóm lý do; hẹn phỏng vấn có cảnh báo trùng giờ; offer; lịch phỏng vấn theo tuần.
   - Đổi trạng thái: optimistic UI, tuần tự hoá theo từng đơn, Hoàn tác (R4).
   File: wwwroot/js/pages/employer.js
   ============================================================================= */
(function () {
    'use strict';

    const M = window.ArisMotion || {
        toast: (msg, opts) => { if (window.showToast) window.showToast(msg, opts?.tone); else alert(msg); },
        flip: (container, fn) => { fn(); }
    };

    let currentJobId = null;
    let applicantsData = [];
    let activeDrawerApplicant = null;
    let loadApplicantsAbortController = null;
    let loadApplicantsSeq = 0;
    let lastFocusedElement = null;

    let jobMeta = { openings: null, hiredCount: 0, jobActive: true, rejectionBreakdown: [] };
    let sortMode = 'recent';
    let viewMode = 'board';
    let pendingOpenAppId = null;
    let pollTimer = null;
    let pollCount = 0;
    let silentRefreshTimer = null;
    const detailCache = new Map();

    function esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function mapApplicant(raw) {
        return {
            id: raw.id,
            applicantId: raw.applicantId ?? null,
            candidateUserId: raw.candidateUserId ?? null,
            fullName: raw.fullName || raw.candidateName || 'Ứng viên',
            email: raw.email || '',
            avatar: raw.avatar || raw.avatarUrl || '/images/default-avatar.png',
            jobTitle: raw.jobTitle || '',
            coverLetter: raw.coverLetter || '',
            resumeUrl: raw.resumeUrl || '',
            resumeName: raw.resumeName || 'CV',
            screeningAnswers: Array.isArray(raw.screeningAnswers) ? raw.screeningAnswers : [],
            status: raw.status || 'Submitted',
            statusLabel: raw.statusLabel || raw.status || 'Đã nộp',
            statusNote: raw.statusNote || '',
            rejectionCategory: raw.rejectionCategory || null,
            rejectionLabel: raw.rejectionLabel || '',
            appliedAt: raw.appliedAt,
            updatedAt: raw.updatedAt || raw.appliedAt,
            applicationCount: typeof raw.applicationCount === 'number' ? raw.applicationCount : 1,
            interviewAt: raw.interviewAt || null,
            interviewLocation: raw.interviewLocation || null,
            isVideoCall: !!raw.isVideoCall,
            aiInterview: raw.aiInterview || null,
            interviewResponse: raw.interviewResponse || null,
            interviewRound: raw.interviewRound || 1,
            interviewDurationMinutes: raw.interviewDurationMinutes || 45,
            interviewDeclineReason: raw.interviewDeclineReason || '',
            proposedSlots: Array.isArray(raw.proposedSlots) ? raw.proposedSlots : [],
            matchScore: typeof raw.matchScore === 'number' ? raw.matchScore : null,
            matchSummary: raw.matchSummary || '',
            matchTier: raw.matchTier || 'none',
            matchTierLabel: raw.matchTierLabel || 'Chưa chấm',
            matchPending: !!raw.matchPending,
            matchError: raw.matchError || '',
            offerSalary: raw.offerSalary || '',
            offerStartDate: raw.offerStartDate || null,
            offerExpiresAt: raw.offerExpiresAt || null,
            offerResponse: raw.offerResponse || null,
            lastEvaluation: raw.lastEvaluation || null,
            nextStep: raw.nextStep || null
        };
    }

    const STAGES = [
        { key: 'Submitted', label: 'Đã nộp', icon: 'inbox' },
        { key: 'UnderReview', label: 'Đang xem xét', icon: 'search' },
        { key: 'Shortlisted', label: 'Rút gọn', icon: 'star' },
        { key: 'InterviewScheduled', label: 'Phỏng vấn', icon: 'calendar' },
        { key: 'Offered', label: 'Offer', icon: 'award' },
        { key: 'Hired', label: 'Đã tuyển', icon: 'badge-check' },
        { key: 'Rejected', label: 'Từ chối', icon: 'x-circle' }
    ];

    // Bước tiếp theo đang chờ chính nhà tuyển dụng — thẻ có vạch nhấn, sidebar đếm.
    const NEEDS_ACTION = new Set(['reschedule', 'evaluate', 'decide-offer', 'decide-next', 'decide-reject', 'decide-hold', 'offer-declined', 'offer-expired', 'ai-done', 'ai-overdue']);
    const STEP_TONE = { hired: 'ok', upcoming: 'ok', closed: 'muted', 'await-confirm': 'muted', 'offer-pending': 'muted', 'ai-waiting': 'muted' };

    const REJECTION_CATEGORIES = [
        { code: 'Skills', label: 'Kỹ năng chưa khớp' },
        { code: 'Experience', label: 'Chưa đủ kinh nghiệm' },
        { code: 'Interview', label: 'Phỏng vấn chưa đạt' },
        { code: 'Salary', label: 'Lương chưa khớp' },
        { code: 'Location', label: 'Địa điểm / thời gian' },
        { code: 'Filled', label: 'Đã tuyển đủ' },
        { code: 'Other', label: 'Khác' }
    ];

    function renderIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function antiForgeryToken() {
        const input = document.querySelector('input[name="__RequestVerificationToken"]');
        return input ? input.value : '';
    }

    async function postJson(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': antiForgeryToken() },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        if (!res.ok) return { success: false, message: `Máy chủ trả lỗi (HTTP ${res.status}).` };
        return res.json();
    }

    function pad2(n) { return String(n).padStart(2, '0'); }
    function fmtTime(iso) {
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }
    function fmtDate(iso) {
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '' : `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
    function fmtDateTime(iso) {
        const d = new Date(iso);
        return isNaN(d.getTime()) ? String(iso || '') : `${fmtTime(iso)} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
    }
    function relDay(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const days = Math.floor((Date.now() - d.getTime()) / 86400000);
        if (days <= 0) return 'Hôm nay';
        if (days === 1) return 'Hôm qua';
        if (days < 7) return `${days} ngày trước`;
        return d.toLocaleDateString('vi-VN');
    }
    function toDateInput(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

    // Khởi tạo
    document.addEventListener('DOMContentLoaded', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const paramJobId = urlParams.get('jobId') || urlParams.get('job');
        const paramApp = parseInt(urlParams.get('app'), 10);
        if (paramApp) pendingOpenAppId = paramApp;

        const firstJobItem = document.querySelector('.employer-job-item');
        if (paramJobId) {
            selectJob(parseInt(paramJobId, 10));
        } else if (firstJobItem) {
            const jId = parseInt(firstJobItem.getAttribute('data-job-id'), 10);
            selectJob(jId);
        } else {
            const titleEl = document.getElementById('pipelineJobTitle');
            const metaEl = document.getElementById('pipelineJobMeta');
            if (titleEl) titleEl.innerText = 'Chưa có tin tuyển dụng';
            if (metaEl) metaEl.innerText = 'Tạo tin tuyển dụng đầu tiên để quản lý ứng viên';
            STAGES.forEach(st => {
                const colBody = document.querySelector(`.pipeline-col[data-stage="${st.key}"] .pipeline-col__body`);
                if (colBody) colBody.innerHTML = '<div class="text-center py-4 text-muted small" style="opacity: 0.6;">Chưa có tin tuyển dụng</div>';
            });
        }

        bindJobEvents();
        bindDragAndDrop();
        bindDrawerEvents();
        bindModalEvents();
        bindHeaderControls();
        bindCalendar();
        if (urlParams.get('view') === 'calendar') setView('calendar');
    });

    // Chọn tin tuyển dụng
    window.selectJob = function (jobId) {
        currentJobId = jobId;
        stopPolling();

        document.querySelectorAll('.employer-job-item').forEach(el => {
            const id = parseInt(el.getAttribute('data-job-id'), 10);
            if (id === jobId) {
                el.classList.add('is-active');
            } else {
                el.classList.remove('is-active');
            }
        });

        // Cập nhật header sheet
        const selectedItem = document.querySelector(`.employer-job-item[data-job-id="${jobId}"]`);
        if (selectedItem) {
            const title = selectedItem.querySelector('.employer-job-item__title')?.innerText || 'Tin tuyển dụng';
            const titleEl = document.getElementById('pipelineJobTitle');
            if (titleEl) titleEl.innerText = title;
        }

        loadApplicants(jobId);
    };

    // Tải danh sách ứng viên của tin. silent: làm mới nền (sau thao tác / khi chờ AI chấm),
    // không hiện spinner, không đóng ngăn chi tiết.
    async function loadApplicants(jobId, opts) {
        opts = opts || {};
        const board = document.getElementById('pipelineBoard');
        if (!board) return;

        if (loadApplicantsAbortController) {
            loadApplicantsAbortController.abort();
        }
        loadApplicantsAbortController = new AbortController();
        const signal = loadApplicantsAbortController.signal;
        const currentSeq = ++loadApplicantsSeq;

        if (!opts.silent) {
            closeDrawer();

            // Xoá danh sách cũ và hiển thị spinner
            STAGES.forEach(st => {
                const colBody = document.querySelector(`.pipeline-col[data-stage="${st.key}"] .pipeline-col__body`);
                const colCount = document.querySelector(`.pipeline-col[data-stage="${st.key}"] .pipeline-col__count`);
                if (colBody) colBody.innerHTML = '<div class="text-center py-4 text-muted small"><span class="spinner-border spinner-border-sm"></span></div>';
                if (colCount) colCount.innerText = '0';
            });
        }

        try {
            const res = await fetch(`/JobApplications/GetApplicantsForJob?jobId=${jobId}`, { signal });
            if (currentSeq !== loadApplicantsSeq) return;

            if (res.status === 401 || res.status === 403) {
                renderErrorState('Chỉ tài khoản doanh nghiệp sở hữu tin mới có thể xem ứng viên.', false);
                return;
            }
            if (!res.ok) {
                if (!opts.silent) renderErrorState(`Không thể tải danh sách ứng viên (HTTP ${res.status}).`, true, jobId);
                return;
            }

            let data;
            try {
                data = await res.json();
            } catch {
                if (!opts.silent) renderErrorState('Dữ liệu từ máy chủ không hợp lệ.', true, jobId);
                return;
            }

            if (!data || typeof data !== 'object') {
                if (!opts.silent) renderErrorState('Phản hồi không hợp lệ từ máy chủ.', true, jobId);
                return;
            }

            if (!data.success) {
                renderErrorState(data.message || 'Không thể tải danh sách ứng viên.', false);
                return;
            }

            if (!Array.isArray(data.applicants)) {
                renderErrorState('Dữ liệu danh sách ứng viên không đúng định dạng.', true, jobId);
                return;
            }

            if (data.jobTitle) {
                const titleEl = document.getElementById('pipelineJobTitle');
                if (titleEl) titleEl.innerText = data.jobTitle;
            }

            jobMeta = {
                openings: typeof data.openings === 'number' ? data.openings : null,
                hiredCount: data.hiredCount || 0,
                jobActive: data.jobActive !== false,
                rejectionBreakdown: Array.isArray(data.rejectionBreakdown) ? data.rejectionBreakdown : []
            };

            applicantsData = data.applicants.map(mapApplicant);
            applicantsData.forEach(app => {
                const state = appStateCoordination.get(app.id);
                if (state && state.pendingOps === 0) {
                    state.confirmedStatus = app.status || 'Submitted';
                }
            });
            renderPipeline(applicantsData);
            renderJobMeta();
            updateScoreAllButton();
            updateSidebarTodo();
            schedulePolling();

            // Ngăn chi tiết đang mở: đồng bộ với dữ liệu mới.
            if (activeDrawerApplicant) {
                const fresh = applicantsData.find(a => a.id === activeDrawerApplicant.id);
                if (fresh) {
                    activeDrawerApplicant = fresh;
                    renderDrawerHeader(fresh);
                    renderDrawerNext(fresh);
                    if (fresh.matchScore !== null && detailCache.has(fresh.id) && !detailCache.get(fresh.id).match) {
                        detailCache.delete(fresh.id);
                        loadDetail(fresh);
                    }
                }
            }

            if (pendingOpenAppId) {
                const target = applicantsData.find(a => a.id === pendingOpenAppId);
                pendingOpenAppId = null;
                if (target) {
                    const card = document.querySelector(`.candidate-card[data-app-id="${target.id}"]`);
                    if (card) {
                        card.classList.add('is-flash');
                        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }
                    openDrawer(target, card);
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Lỗi khi tải ứng viên:', err);
            if (currentSeq === loadApplicantsSeq && !opts.silent) {
                renderErrorState('Lỗi kết nối khi tải danh sách ứng viên.', true, jobId);
            }
        }
    }

    // Làm mới nền sau một thao tác để "Bước tiếp theo" lấy đúng từ máy chủ.
    function scheduleSilentRefresh(delay) {
        if (currentJobId == null) return;
        clearTimeout(silentRefreshTimer);
        silentRefreshTimer = setTimeout(() => loadApplicants(currentJobId, { silent: true }), delay ?? 500);
    }

    // AI chấm ở nền (5–40 giây/đơn): hỏi lại mỗi 10 giây, tối đa 3 phút.
    function schedulePolling() {
        clearTimeout(pollTimer);
        const pending = applicantsData.some(a => a.matchPending);
        if (!pending || pollCount >= 18) { pollCount = 0; return; }
        pollCount++;
        pollTimer = setTimeout(() => {
            if (currentJobId != null) loadApplicants(currentJobId, { silent: true });
        }, 10000);
    }
    function stopPolling() { clearTimeout(pollTimer); pollCount = 0; }

    function renderErrorState(message, allowRetry, retryJobId) {
        STAGES.forEach(st => {
            const colBody = document.querySelector(`.pipeline-col[data-stage="${st.key}"] .pipeline-col__body`);
            const colCount = document.querySelector(`.pipeline-col[data-stage="${st.key}"] .pipeline-col__count`);
            if (colBody) {
                colBody.innerHTML = `
                    <div class="text-center py-4 px-2 text-danger small">
                        <div>${esc(message)}</div>
                        ${allowRetry && retryJobId ? `<button type="button" class="a-btn a-btn--secondary a-btn--sm mt-2 retry-btn" data-retry-job="${retryJobId}">Thử lại</button>` : ''}
                    </div>`;
            }
            if (colCount) colCount.innerText = '0';
        });

        if (allowRetry && retryJobId) {
            document.querySelectorAll('.retry-btn').forEach(btn => {
                btn.onclick = () => loadApplicants(retryJobId);
            });
        }
        M.toast(message, { tone: 'danger' });
    }

    function sortApplicants(list) {
        const byDate = (a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0);
        if (sortMode === 'match') {
            return list.slice().sort((a, b) => {
                const sa = a.matchScore, sb = b.matchScore;
                if (sa === null && sb === null) return byDate(a, b);
                if (sa === null) return 1;
                if (sb === null) return -1;
                return sb - sa || byDate(a, b);
            });
        }
        return list.slice().sort(byDate);
    }

    // Hiển thị ứng viên vào các cột
    function renderPipeline(applicants) {
        const groups = {};
        STAGES.forEach(st => { groups[st.key] = []; });

        applicants.forEach(app => {
            const st = app.status || 'Submitted';
            if (groups[st]) {
                groups[st].push(app);
            }
        });

        STAGES.forEach(st => {
            const col = document.querySelector(`.pipeline-col[data-stage="${st.key}"]`);
            const colBody = col?.querySelector('.pipeline-col__body');
            const colCount = col?.querySelector('.pipeline-col__count');
            if (!colBody) return;

            const list = sortApplicants(groups[st.key] || []);
            if (colCount) colCount.innerText = list.length.toString();

            if (st.key === 'Rejected' && col) {
                const breakdown = (jobMeta.rejectionBreakdown || []).map(r => `${r.label}: ${r.count}`).join('\n');
                col.setAttribute('title', breakdown ? `Lý do từ chối\n${breakdown}` : 'Bấm để mở rộng cột Từ chối');
            }

            if (list.length === 0) {
                colBody.innerHTML = '<div class="text-center py-4 text-muted small" style="opacity: 0.6;">Chưa có ứng viên</div>';
            } else {
                colBody.innerHTML = '';
                list.forEach(app => {
                    const card = createCandidateCard(app);
                    colBody.appendChild(card);
                });
            }
        });

        if (activeDrawerApplicant) {
            const currentActive = applicants.find(a => a.id === activeDrawerApplicant.id);
            if (currentActive) {
                const statusBadge = document.getElementById('drawerStatusBadge');
                if (statusBadge) {
                    const stageObj = STAGES.find(s => s.key === currentActive.status);
                    statusBadge.innerText = stageObj?.label || currentActive.statusLabel || currentActive.status;
                }
            }
        }

        renderIcons();
    }

    function cardFlags(app) {
        const flags = [];
        if (app.applicationCount > 1) {
            flags.push(`<span class="cc-flag" title="Đã nộp ${app.applicationCount} lần">Lần ${app.applicationCount}</span>`);
        }
        if (app.status === 'InterviewScheduled' && app.interviewAt) {
            if (app.interviewResponse === 'Declined') {
                flags.push(`<span class="cc-flag cc-flag--danger"><i data-lucide="calendar-x"></i> Xin đổi lịch</span>`);
            } else {
                const tone = app.interviewResponse === 'Accepted' ? 'cc-flag--ok' : 'cc-flag--brand';
                flags.push(`<span class="cc-flag ${tone}" title="${app.interviewResponse === 'Accepted' ? 'Ứng viên đã xác nhận' : 'Chờ ứng viên xác nhận'}"><i data-lucide="calendar"></i> ${esc(fmtDateTime(app.interviewAt))}</span>`);
            }
        }
        if (app.lastEvaluation) {
            const rec = app.lastEvaluation.recommendation;
            const tone = rec === 'Hire' ? 'cc-flag--ok' : rec === 'Reject' ? 'cc-flag--danger' : rec === 'NextRound' ? 'cc-flag--brand' : 'cc-flag--warn';
            flags.push(`<span class="cc-flag ${tone}" title="Phiếu vòng ${app.lastEvaluation.round}"><i data-lucide="clipboard-check"></i> ${esc(app.lastEvaluation.average)}/5</span>`);
        }
        if (app.status === 'Offered') {
            if (app.offerResponse === 'Declined') flags.push('<span class="cc-flag cc-flag--danger">Từ chối offer</span>');
            else if (app.offerExpiresAt) flags.push(`<span class="cc-flag cc-flag--warn">Hạn ${esc(fmtDate(app.offerExpiresAt).slice(0, 5))}</span>`);
        }
        if (app.status === 'Rejected' && app.rejectionLabel) {
            flags.push(`<span class="cc-flag" title="${esc(app.rejectionLabel)}">${esc(app.rejectionLabel.length > 26 ? app.rejectionLabel.slice(0, 25) + '…' : app.rejectionLabel)}</span>`);
        }
        return flags.join('');
    }

    function scoreBadge(app) {
        if (app.matchScore !== null) {
            return `<span class="cc-score" data-tier="${esc(app.matchTier)}" title="${esc(app.matchTierLabel)} — điểm AI giữa CV đã nộp và tin">${Math.round(app.matchScore)}</span>`;
        }
        if (app.matchPending) return '<span class="cc-score is-pending" title="AI đang chấm">AI</span>';
        return `<span class="cc-score" title="${esc(app.matchError || 'Chưa chấm')}">—</span>`;
    }

    // Tạo phần tử thẻ ứng viên
    function createCandidateCard(app) {
        const card = document.createElement('article');
        card.className = 'candidate-card';
        card.setAttribute('draggable', 'true');
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Xem hồ sơ của ${app.fullName || 'ứng viên'}`);
        card.setAttribute('data-app-id', app.id);
        card.setAttribute('data-status', app.status || 'Submitted');
        if (app.nextStep && NEEDS_ACTION.has(app.nextStep.key)) {
            card.classList.add('needs-action');
            card.setAttribute('title', app.nextStep.title || '');
        }

        const avatar = esc(app.avatar || '/images/default-avatar.png');
        const name = esc(app.fullName || 'Ứng viên');
        const dateStr = app.appliedAt ? relDay(app.appliedAt) : 'Mới nộp';
        const summary = app.matchSummary
            || (app.matchPending ? 'AI đang đọc CV và tin…' : '');

        card.innerHTML = `
            <div class="candidate-card__head">
                <img src="${avatar}" alt="${name}" class="candidate-card__avatar" onerror="this.onerror=null;this.src='/images/default-avatar.png'">
                <div class="min-w-0 flex-grow-1">
                    <h4 class="candidate-card__name">${name}</h4>
                    <div class="candidate-card__sub text-truncate">${esc(app.jobTitle || '')}</div>
                </div>
                ${scoreBadge(app)}
            </div>
            ${summary ? `<p class="cc-summary">${esc(summary)}</p>` : ''}
            <div class="d-flex align-items-center justify-content-between gap-2 pt-1">
                <div class="candidate-card__badges d-flex flex-wrap gap-1">${cardFlags(app)}</div>
                <div class="candidate-card__date">
                    <i data-lucide="clock" style="width: 12px; height: 12px;"></i> ${esc(dateStr)}
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (card.classList.contains('is-dragging')) return;
            openDrawer(app, card);
        });

        // Bàn phím: Enter/Space mở drawer; Alt+Left / Alt+Right di chuyển cột
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDrawer(app, card);
            } else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                e.preventDefault();
                moveCardKeyboard(app, card, e.key === 'ArrowRight' ? 1 : -1);
            }
        });

        return card;
    }

    // Di chuyển thẻ bằng bàn phím
    function moveCardKeyboard(app, card, direction) {
        const curStatus = card.getAttribute('data-status');
        const curIdx = STAGES.findIndex(s => s.key === curStatus);
        if (curIdx === -1) return;

        const targetIdx = curIdx + direction;
        if (targetIdx < 0 || targetIdx >= STAGES.length) return;

        const targetStage = STAGES[targetIdx].key;
        handleStatusChange(app.id, curStatus, targetStage, card);
    }

    // Drag and Drop
    let draggedAppId = null;
    let draggedFromStatus = null;
    let draggedCard = null;

    function bindDragAndDrop() {
        document.addEventListener('dragstart', (e) => {
            const card = e.target.closest('.candidate-card');
            if (!card) return;
            draggedCard = card;
            draggedAppId = parseInt(card.getAttribute('data-app-id'), 10);
            draggedFromStatus = card.getAttribute('data-status');
            card.classList.add('is-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedAppId.toString());
        });

        document.addEventListener('dragend', (e) => {
            if (draggedCard) {
                draggedCard.classList.remove('is-dragging');
                draggedCard = null;
            }
            document.querySelectorAll('.pipeline-col').forEach(c => c.classList.remove('is-drag-over'));
        });

        const columns = document.querySelectorAll('.pipeline-col');
        columns.forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                col.classList.add('is-drag-over');
            });

            col.addEventListener('dragleave', (e) => {
                if (!col.contains(e.relatedTarget)) {
                    col.classList.remove('is-drag-over');
                }
            });

            col.addEventListener('drop', (e) => {
                e.preventDefault();
                col.classList.remove('is-drag-over');
                const targetStage = col.getAttribute('data-stage');
                if (!targetStage || targetStage === draggedFromStatus) return;

                handleStatusChange(draggedAppId, draggedFromStatus, targetStage, draggedCard);
            });
        });
    }

    // Xử lý đổi trạng thái — các bước cần thêm thông tin mở hộp thoại tương ứng.
    async function handleStatusChange(appId, fromStage, targetStage, cardEl) {
        const app = applicantsData.find(a => a.id === appId);
        if (!app) return;

        if (targetStage === 'Rejected') {
            openRejectionModal(app, fromStage);
            return;
        }

        if (targetStage === 'InterviewScheduled') {
            openScheduleInterviewModal(app, fromStage);
            return;
        }

        if (targetStage === 'Offered') {
            openOfferModal(app);
            return;
        }

        executeStatusChange(app, fromStage, targetStage, targetStage === 'Hired' ? 'Ghi nhận đã tuyển' : null);
    }

    // Bộ điều phối tuần tự các thao tác cập nhật trạng thái theo application (R4)
    const appUpdateChains = new Map();
    const appStateCoordination = new Map();

    function getAppState(app, initialStatus) {
        let state = appStateCoordination.get(app.id);
        if (!state) {
            state = {
                confirmedStatus: app.status || initialStatus || 'Submitted',
                latestOpId: 0,
                pendingOps: 0
            };
            appStateCoordination.set(app.id, state);
        } else if (state.pendingOps === 0) {
            const incomingStatus = app.status || initialStatus;
            if (incomingStatus) {
                state.confirmedStatus = incomingStatus;
            }
        }
        return state;
    }

    function queueAppStatusUpdate(appId, fn) {
        const currentChain = appUpdateChains.get(appId) || Promise.resolve();
        const nextChain = currentChain
            .catch(() => {})
            .then(() => fn());
        appUpdateChains.set(appId, nextChain);
        return nextChain;
    }

    // Thực thi cập nhật trạng thái ngay lập tức (optimistic UI + tuần tự hoá và rollback khi lỗi hoặc khi nhấn Hoàn tác - R4)
    // extra.rejectionCategory: nhóm lý do khi từ chối.
    async function executeStatusChange(app, fromStage, toStage, note, extra) {
        const jobIdAtOperation = currentJobId;
        const appState = getAppState(app, fromStage);
        const rejectionCategory = extra && extra.rejectionCategory ? extra.rejectionCategory : null;

        const prevStatus = app.status;
        app.status = toStage;
        renderPipeline(applicantsData);

        appState.latestOpId++;
        const currentOpId = appState.latestOpId;
        appState.pendingOps++;

        let isUndone = false;
        let originalOperationCompleted = false;
        let originalOperationSucceeded = false;
        let originalNetworkError = false;
        const targetLabel = STAGES.find(s => s.key === toStage)?.label || toStage;

        M.toast(`Đã chuyển ${app.fullName} sang ${targetLabel}.`, {
            duration: 6000,
            action: {
                label: 'Hoàn tác',
                onClick: async () => {
                    if (isUndone) return;
                    if (appState.latestOpId !== currentOpId) {
                        M.toast(`Không thể hoàn tác thao tác cũ vì đã có thay đổi mới hơn cho ${app.fullName}.`, { tone: 'warning' });
                        return;
                    }
                    isUndone = true;
                    // Phục hồi giao diện tức thì (optimistic)
                    app.status = prevStatus;
                    if (currentJobId === jobIdAtOperation) {
                        renderPipeline(applicantsData);
                    }

                    // Điều phối tuần tự: chờ request gốc hoàn thành trước khi quyết định gửi Undo lên server (R4)
                    appState.pendingOps++;
                    return queueAppStatusUpdate(app.id, async () => {
                        try {
                            // Nếu request gốc thất bại với phản hồi từ chối từ server (không phải lỗi mạng),
                            // server chưa từng ghi nhận toStage (vẫn là confirmedStatus trước đó).
                            // Nhánh bỏ qua Undo phải khôi phục trạng thái đã xác nhận cho UI (R4).
                            if (originalOperationCompleted && !originalOperationSucceeded && !originalNetworkError) {
                                if (appState.latestOpId === currentOpId) {
                                    app.status = appState.confirmedStatus;
                                    if (currentJobId === jobIdAtOperation) {
                                        renderPipeline(applicantsData);
                                    }
                                }
                                M.toast(`Đã hoàn tác trạng thái của ${app.fullName}.`);
                                return;
                            }

                            try {
                                const res = await fetch(`/JobApplications/UpdateApplicationStatus?applicationId=${app.id}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': antiForgeryToken() },
                                    body: JSON.stringify({ Status: prevStatus, Note: 'Hoàn tác thao tác tuyển dụng' })
                                });
                                const r = await res.json();
                                if (r && r.success) {
                                    appState.confirmedStatus = prevStatus;
                                    if (appState.latestOpId === currentOpId) {
                                        app.status = prevStatus;
                                        if (currentJobId === jobIdAtOperation) {
                                            renderPipeline(applicantsData);
                                        }
                                    }
                                    M.toast(`Đã hoàn tác trạng thái của ${app.fullName}.`);
                                    scheduleSilentRefresh();
                                } else {
                                    // Server từ chối hoàn tác: rollback UI về toStage (trạng thái server đang giữ)
                                    appState.confirmedStatus = toStage;
                                    if (appState.latestOpId === currentOpId) {
                                        app.status = toStage;
                                        if (currentJobId === jobIdAtOperation) {
                                            renderPipeline(applicantsData);
                                        }
                                    }
                                    M.toast(r?.message || 'Không thể hoàn tác trạng thái trên máy chủ.', { tone: 'danger' });
                                }
                            } catch {
                                // Khi Undo gặp lỗi mạng: không suy đoán server đang ở toStage.
                                // Server có thể đã ghi nhận Undo thành công nhưng mất phản hồi (ở prevStatus),
                                // hoặc cả request gốc lẫn Undo đều không đến server (ở prevStatus).
                                // Giữ UI và confirmedStatus ở prevStatus để tránh lệch trạng thái (R4).
                                appState.confirmedStatus = prevStatus;
                                if (appState.latestOpId === currentOpId) {
                                    app.status = prevStatus;
                                    if (currentJobId === jobIdAtOperation) {
                                        renderPipeline(applicantsData);
                                    }
                                }
                                M.toast('Không thể hoàn tác trạng thái trên máy chủ do lỗi kết nối.', { tone: 'danger' });
                            }
                        } finally {
                            appState.pendingOps = Math.max(0, appState.pendingOps - 1);
                        }
                    });
                }
            }
        });

        // Gửi lưu trạng thái lên máy chủ theo hàng đợi tuần tự (R4)
        return queueAppStatusUpdate(app.id, async () => {
            try {
                const payload = { Status: toStage, Note: note || '' };
                if (rejectionCategory) payload.RejectionCategory = rejectionCategory;
                const res = await fetch(`/JobApplications/UpdateApplicationStatus?applicationId=${app.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': antiForgeryToken() },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                originalOperationCompleted = true;
                originalOperationSucceeded = Boolean(result && result.success);
                originalNetworkError = false;

                appState.pendingOps = Math.max(0, appState.pendingOps - 1);

                if (originalOperationSucceeded) {
                    appState.confirmedStatus = toStage;
                }

                if (isUndone) {
                    // Người dùng đã nhấn hoàn tác: tác vụ Undo trong hàng đợi sẽ khôi phục prevStatus trên server
                    return;
                }

                if (originalOperationSucceeded) {
                    // Nếu đây vẫn là operation mới nhất được kích hoạt, đồng bộ UI sang toStage
                    if (appState.latestOpId === currentOpId) {
                        app.status = toStage;
                        if (currentJobId === jobIdAtOperation) {
                            renderPipeline(applicantsData);
                        }
                    }
                    if (currentJobId === jobIdAtOperation) scheduleSilentRefresh();
                } else {
                    // Thao tác thất bại từ server.
                    // Nếu không còn thao tác nào đang chờ, rollback UI về confirmedStatus cuối cùng
                    if (appState.pendingOps === 0) {
                        app.status = appState.confirmedStatus;
                        if (currentJobId === jobIdAtOperation) {
                            renderPipeline(applicantsData);
                        }
                        M.toast(result?.message || 'Không thể cập nhật trạng thái.', { tone: 'danger' });
                    }
                }
            } catch {
                originalOperationCompleted = true;
                originalOperationSucceeded = false;
                originalNetworkError = true;

                appState.pendingOps = Math.max(0, appState.pendingOps - 1);

                if (isUndone) return;

                if (appState.pendingOps === 0) {
                    app.status = appState.confirmedStatus;
                    if (currentJobId === jobIdAtOperation) {
                        renderPipeline(applicantsData);
                    }
                    M.toast('Lỗi kết nối khi cập nhật trạng thái.', { tone: 'danger' });
                }
            }
        });
    }

    function getModal(el) {
        if (typeof bootstrap === 'undefined' || !el) return { show() {}, hide() {} };
        return bootstrap.Modal.getOrCreateInstance ? bootstrap.Modal.getOrCreateInstance(el) : new bootstrap.Modal(el);
    }

    // Modal Từ chối — nhóm lý do (ứng viên thấy, kèm lộ trình kỹ năng) + lời nhắn + mẫu soạn sẵn.
    function openRejectionModal(app, fromStage) {
        const modalEl = document.getElementById('rejectionModal');
        const noteInput = document.getElementById('rejectionReasonInput');
        const confirmBtn = document.getElementById('confirmRejectBtn');
        const tplContainer = document.getElementById('rejectionTemplateChoices');
        const catContainer = document.getElementById('rejectionCategoryChoices');

        if (!modalEl || !confirmBtn) return;

        if (noteInput) noteInput.value = '';

        // Gợi ý nhóm: phiếu đánh giá "không phù hợp" → phỏng vấn; điểm AI thấp → kỹ năng.
        let suggested = 'Skills';
        if (app.lastEvaluation && app.lastEvaluation.recommendation === 'Reject') suggested = 'Interview';
        else if (jobMeta.openings && jobMeta.hiredCount >= jobMeta.openings) suggested = 'Filled';
        if (catContainer) {
            catContainer.innerHTML = REJECTION_CATEGORIES.map(c => `
                <label><input type="radio" name="rejectionCategory" value="${c.code}" ${c.code === suggested ? 'checked' : ''}><span>${esc(c.label)}</span></label>`).join('');
        }

        if (tplContainer) {
            tplContainer.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            const detail = detailCache.get(app.id);
            const missing = detail && detail.match && Array.isArray(detail.match.missing) ? detail.match.missing.slice(0, 3) : [];
            fetch('/Settings/GetRejectionTemplates')
                .then(r => r.json())
                .then(res => {
                    tplContainer.innerHTML = '';
                    const templates = (res && res.success && Array.isArray(res.templates)) ? res.templates.slice() : [];
                    if (missing.length) {
                        templates.unshift(`Cảm ơn bạn đã quan tâm vị trí ${app.jobTitle || 'này'}. Lần này hồ sơ chưa thể hiện rõ ${missing.join(', ')} mà vị trí cần — rất mong gặp lại bạn ở cơ hội sau.`);
                    }
                    if (!templates.length) {
                        tplContainer.innerHTML = '<span class="text-muted small">Chưa có mẫu sẵn. Nhập lý do bên dưới.</span>';
                        return;
                    }
                    templates.forEach((tpl, i) => {
                        const item = document.createElement('button');
                        item.type = 'button';
                        item.className = 'emp-tpl';
                        if (i === 0 && missing.length) item.classList.add('is-ai');
                        item.innerText = tpl;
                        item.addEventListener('click', () => {
                            if (noteInput) noteInput.value = tpl;
                        });
                        tplContainer.appendChild(item);
                    });
                })
                .catch(() => {
                    tplContainer.innerHTML = '<span class="text-muted small">Không thể tải mẫu từ chối.</span>';
                });
        }

        const modal = getModal(modalEl);
        modal.show();

        confirmBtn.onclick = () => {
            const note = noteInput?.value.trim() || 'Hồ sơ chưa phù hợp vào thời điểm hiện tại.';
            const picked = modalEl.querySelector('input[name="rejectionCategory"]:checked');
            modal.hide();
            executeStatusChange(app, fromStage, 'Rejected', note, { rejectionCategory: picked ? picked.value : 'Other' });
        };
    }

    // Hình thức trong modal hẹn: người thật (giờ, phòng video/địa điểm) hoặc phỏng vấn AI (bộ phỏng vấn + hạn hoàn thành).
    const LIVE_HELP = 'Ứng viên nhận thông báo để xác nhận hoặc đề xuất giờ khác. Cả hai bên được nhắc trước 24 giờ và 1 giờ.';
    const AI_HELP = 'Ứng viên nhận thông báo và làm phỏng vấn AI ngay trong đơn ứng tuyển, lúc nào cũng được trước hạn. Điểm hiện trên thẻ ứng viên khi họ làm xong.';
    const AI_DEADLINE_DAYS = 3;
    let aiKitsPromise = null;
    const loadAiKits = () => aiKitsPromise ??= fetch('/JobApplications/AiInterviewKits', { credentials: 'same-origin' })
        .then(r => r.json())
        .then(d => (d && d.success ? d.kits : []))
        .catch(() => { aiKitsPromise = null; return []; });

    // Trả về hàm đọc lựa chọn hiện tại: { mode: 'live' | 'ai', kitId }.
    function setupInterviewMode(app, opts, liveConfirmLabel) {
        const byId = id => document.getElementById(id);
        const radios = [...document.querySelectorAll('input[name="interviewMode"]')];
        const kitSelect = byId('interviewKitSelect'), kitHelp = byId('interviewKitHelp');
        const toggle = byId('interviewVideoCallToggle'), slotPicks = byId('scheduleSlotPicks');
        const dateInput = byId('interviewDateInput'), timeInput = byId('interviewTimeInput');
        const slotPicksShown = !!slotPicks && !slotPicks.hidden;
        let mode = (opts.prefill && opts.prefill.mode) || (app.aiInterview && !opts.nextRound ? 'ai' : 'live');

        async function fillKits() {
            if (!kitSelect) return;
            kitSelect.replaceChildren(new Option('Đang tải bộ phỏng vấn…', ''));
            const kits = await loadAiKits();
            kitSelect.replaceChildren(...(kits.length
                ? kits.map(k => new Option(`${k.title} · ${k.questionCount} câu · ${k.videoCount} video`, k.id))
                : [new Option('Chưa có bộ phỏng vấn AI', '')]));
            const current = app.aiInterview && app.aiInterview.kitId;
            if (current && kits.some(k => k.id === current)) kitSelect.value = String(current);
            if (kitHelp) kitHelp.innerHTML = kits.length
                ? 'Ứng viên làm ngay trong đơn ứng tuyển, không cần mở link công khai của bộ. <a href="/Employer/InterviewFlow" target="_blank" rel="noopener">Quản lý bộ phỏng vấn</a>'
                : '<a href="/Employer/InterviewFlow/New" target="_blank" rel="noopener">Tạo bộ phỏng vấn AI</a> trước, rồi quay lại đây.';
        }

        function apply(next, resetDeadline) {
            mode = next;
            const ai = mode === 'ai';
            radios.forEach(r => { r.checked = r.value === mode; });
            byId('interviewAiFields').hidden = !ai;
            byId('interviewDurationCol').hidden = ai;
            byId('interviewVideoCallBox').hidden = ai;
            byId('interviewLocationField').hidden = ai || !!(toggle && toggle.checked);
            if (slotPicks) slotPicks.hidden = ai || !slotPicksShown;
            byId('interviewDateLabel').innerText = ai ? 'Hạn hoàn thành' : 'Ngày';
            byId('scheduleHelp').innerText = ai ? AI_HELP : LIVE_HELP;
            byId('confirmScheduleBtn').innerText = ai ? 'Gửi phỏng vấn AI' : liveConfirmLabel;
            if (ai && resetDeadline && dateInput && timeInput) {
                const deadline = new Date();
                deadline.setDate(deadline.getDate() + AI_DEADLINE_DAYS);
                dateInput.value = toDateInput(deadline);
                timeInput.value = '23:00';
            }
            if (ai) fillKits();
        }

        radios.forEach(r => { r.onchange = () => apply(r.value, true); });
        apply(mode, !opts.prefill);
        return () => ({ mode, kitId: kitSelect && kitSelect.value ? Number(kitSelect.value) : null });
    }

    // Modal Hẹn phỏng vấn. opts: { nextRound, slot (ISO), conflicts, prefill, force }
    function openScheduleInterviewModal(app, fromStage, opts) {
        opts = opts || {};
        const modalEl = document.getElementById('scheduleInterviewModal');
        const dateInput = document.getElementById('interviewDateInput');
        const timeInput = document.getElementById('interviewTimeInput');
        const durationInput = document.getElementById('interviewDurationInput');
        const locationInput = document.getElementById('interviewLocationInput');
        const videoCallToggle = document.getElementById('interviewVideoCallToggle');
        const noteInput = document.getElementById('interviewNoteInput');
        const confirmBtn = document.getElementById('confirmScheduleBtn');
        const titleEl = document.getElementById('scheduleModalTitle');
        const conflictEl = document.getElementById('scheduleConflict');

        if (!modalEl || !confirmBtn) return;

        const nextRound = !!opts.nextRound;
        if (titleEl) {
            titleEl.innerText = nextRound ? `Hẹn phỏng vấn vòng ${(app.interviewRound || 1) + 1}`
                : (app.status === 'InterviewScheduled' ? 'Đổi lịch phỏng vấn' : 'Lên lịch phỏng vấn');
        }

        // Mặc định: ngày mai 10:00, hoặc khung giờ ứng viên đề xuất, hoặc giá trị vừa nhập (khi trùng giờ).
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const prefill = opts.prefill || {};
        const slotDate = opts.slot ? new Date(opts.slot) : null;
        if (dateInput) dateInput.value = prefill.date || (slotDate && !isNaN(slotDate.getTime()) ? toDateInput(slotDate) : tomorrow.toISOString().split('T')[0]);
        if (timeInput) timeInput.value = prefill.time || (slotDate && !isNaN(slotDate.getTime()) ? fmtTime(opts.slot) : '10:00');
        if (durationInput) durationInput.value = String(prefill.duration || app.interviewDurationMinutes || 45);
        if (locationInput) locationInput.value = prefill.location || app.interviewLocation || 'Trực tuyến qua Aris Video Room';
        if (noteInput && prefill.note !== undefined) noteInput.value = prefill.note;
        if (videoCallToggle && prefill.isVideoCall !== undefined) videoCallToggle.checked = prefill.isVideoCall;

        renderSlotPicks(app, opts.slot);

        if (conflictEl) {
            if (opts.conflicts && opts.conflicts.length) {
                conflictEl.hidden = false;
                conflictEl.innerHTML = `<b>Trùng giờ với buổi phỏng vấn khác:</b>
                    <ul>${opts.conflicts.map(c => `<li>${esc(c.label || fmtDateTime(c.at))} · ${esc(c.name)} — ${esc(c.jobTitle || '')}</li>`).join('')}</ul>
                    Chọn giờ khác, hoặc bấm "Vẫn đặt lịch" nếu bạn chắc chắn.`;
            } else {
                conflictEl.hidden = true;
                conflictEl.innerHTML = '';
            }
        }
        const force = !!(opts.conflicts && opts.conflicts.length);
        const readMode = setupInterviewMode(app, opts,
            force ? 'Vẫn đặt lịch' : (app.status === 'InterviewScheduled' && !nextRound ? 'Gửi lịch mới' : 'Gửi lời mời'));

        const modal = getModal(modalEl);
        modal.show();

        confirmBtn.onclick = async () => {
            const jobIdAtSchedule = currentJobId;
            const dateStr = dateInput?.value;
            const timeStr = timeInput?.value;
            if (!dateStr || !timeStr) {
                M.toast('Vui lòng chọn ngày và giờ phỏng vấn.', { tone: 'danger' });
                return;
            }

            const scheduledDate = new Date(`${dateStr}T${timeStr}:00`);
            if (isNaN(scheduledDate.getTime())) {
                M.toast('Định dạng thời gian không hợp lệ.', { tone: 'danger' });
                return;
            }
            if (scheduledDate.getTime() < Date.now() - 60000) {
                M.toast('Thời gian phỏng vấn không thể ở quá khứ.', { tone: 'danger' });
                return;
            }

            const { mode, kitId } = readMode();
            const isAi = mode === 'ai';
            if (isAi && !kitId) {
                M.toast('Chọn một bộ phỏng vấn AI.', { tone: 'danger' });
                return;
            }

            const scheduledAt = scheduledDate.toISOString();
            const isVideoCall = !isAi && (videoCallToggle?.checked ?? true);
            const location = locationInput?.value ? locationInput.value.trim() : (isVideoCall ? 'Trực tuyến qua Aris Video Room' : 'Aris Video Room');
            const note = noteInput?.value ? noteInput.value.trim() : '';
            const duration = parseInt(durationInput?.value, 10) || app.interviewDurationMinutes || 45;

            modal.hide();

            const appState = getAppState(app, app.status);
            appState.latestOpId++;
            const scheduleOpId = appState.latestOpId;
            appState.pendingOps++;

            // Cập nhật optimistic UI cho InterviewScheduled
            const prevStatusBeforeSchedule = app.status;
            app.status = 'InterviewScheduled';
            if (currentJobId === jobIdAtSchedule) {
                renderPipeline(applicantsData);
            }

            return queueAppStatusUpdate(app.id, async () => {
                try {
                    const res = await fetch(`/JobApplications/ScheduleInterview?applicationId=${app.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': antiForgeryToken() },
                        body: JSON.stringify({
                            ScheduledAt: scheduledAt,
                            Location: location,
                            Note: note,
                            IsVideoCall: isVideoCall,
                            DurationMinutes: duration,
                            NextRound: nextRound,
                            Force: force,
                            InterviewKitId: isAi ? kitId : null
                        })
                    });
                    const result = await res.json();
                    appState.pendingOps = Math.max(0, appState.pendingOps - 1);

                    if (result && result.success) {
                        appState.confirmedStatus = 'InterviewScheduled';
                        if (appState.latestOpId === scheduleOpId) {
                            app.status = 'InterviewScheduled';
                        }
                        app.interviewAt = result.interviewAt || scheduledAt;
                        app.interviewLocation = result.interviewLocation !== undefined ? result.interviewLocation : (isVideoCall ? null : location);
                        app.isVideoCall = result.isVideoCall !== undefined ? result.isVideoCall : isVideoCall;
                        if (result.interviewRound) app.interviewRound = result.interviewRound;
                        if (result.interviewDurationMinutes) app.interviewDurationMinutes = result.interviewDurationMinutes;
                        app.aiInterview = result.aiInterview || null;
                        app.interviewResponse = isAi ? 'Accepted' : 'Pending';
                        app.proposedSlots = [];
                        if (currentJobId === jobIdAtSchedule) {
                            renderPipeline(applicantsData);

                            // Đồng bộ tức thì nếu drawer chi tiết của ứng viên này đang mở (R7)
                            if (activeDrawerApplicant && activeDrawerApplicant.id === app.id) {
                                openDrawer(app, lastFocusedElement);
                            }
                            scheduleSilentRefresh();
                        }
                        if (viewMode === 'calendar') loadCalendar();
                        M.toast(isAi ? 'Đã gửi phỏng vấn AI cho ứng viên!' : 'Đã lên lịch phỏng vấn và gửi thông báo tới ứng viên!', { tone: 'success' });
                    } else {
                        if (appState.pendingOps === 0) {
                            app.status = appState.confirmedStatus || prevStatusBeforeSchedule;
                            if (currentJobId === jobIdAtSchedule) {
                                renderPipeline(applicantsData);
                            }
                        }
                        if (result && result.conflict) {
                            openScheduleInterviewModal(app, fromStage, {
                                nextRound,
                                conflicts: result.conflicts || [],
                                prefill: { date: dateStr, time: timeStr, duration, location, note, isVideoCall, mode }
                            });
                            return;
                        }
                        M.toast(result?.message || 'Không thể lên lịch phỏng vấn.', { tone: 'danger' });
                    }
                } catch {
                    appState.pendingOps = Math.max(0, appState.pendingOps - 1);
                    if (appState.pendingOps === 0) {
                        app.status = appState.confirmedStatus || prevStatusBeforeSchedule;
                        if (currentJobId === jobIdAtSchedule) {
                            renderPipeline(applicantsData);
                        }
                    }
                    M.toast('Lỗi kết nối khi lên lịch phỏng vấn.', { tone: 'danger' });
                }
            });
        };
    }

    // Giờ ứng viên đề xuất (khi họ báo bận): bấm một khung để điền sẵn ngày/giờ.
    function renderSlotPicks(app, selected) {
        const wrap = document.getElementById('scheduleSlotPicks');
        const list = document.getElementById('scheduleSlotList');
        if (!wrap || !list) return;
        const slots = (app.proposedSlots || []).filter(s => new Date(s).getTime() > Date.now());
        if (!slots.length) {
            wrap.hidden = true;
            list.innerHTML = '';
            return;
        }
        wrap.hidden = false;
        list.innerHTML = slots.map(s => `
            <button type="button" class="iv-slot ${selected && new Date(selected).getTime() === new Date(s).getTime() ? 'is-selected' : ''}" data-slot="${esc(s)}">
              ${esc(fmtTime(s))}<small>${esc(new Date(s).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }))}</small>
            </button>`).join('');
        list.querySelectorAll('[data-slot]').forEach(btn => {
            btn.addEventListener('click', () => {
                const d = new Date(btn.dataset.slot);
                const dateInput = document.getElementById('interviewDateInput');
                const timeInput = document.getElementById('interviewTimeInput');
                if (dateInput) dateInput.value = toDateInput(d);
                if (timeInput) timeInput.value = fmtTime(btn.dataset.slot);
                list.querySelectorAll('.iv-slot').forEach(b => b.classList.toggle('is-selected', b === btn));
            });
        });
    }

    // Modal Gửi offer
    function openOfferModal(app) {
        const modalEl = document.getElementById('offerModal');
        const confirmBtn = document.getElementById('confirmOfferBtn');
        if (!modalEl || !confirmBtn) return;
        const nameEl = document.getElementById('offerName');
        if (nameEl) nameEl.innerText = app.fullName;
        const salary = document.getElementById('offerSalary');
        const start = document.getElementById('offerStart');
        const expires = document.getElementById('offerExpires');
        const note = document.getElementById('offerNote');
        const inWeek = new Date(); inWeek.setDate(inWeek.getDate() + 7);
        const inTwoWeeks = new Date(); inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
        if (salary) salary.value = app.offerSalary || '';
        if (start) start.value = app.offerStartDate ? toDateInput(new Date(app.offerStartDate)) : toDateInput(inTwoWeeks);
        if (expires) expires.value = toDateInput(inWeek);
        if (note) note.value = '';

        const modal = getModal(modalEl);
        modal.show();

        confirmBtn.onclick = async () => {
            confirmBtn.disabled = true;
            try {
                const r = await postJson(`/JobApplications/SendOffer?applicationId=${app.id}`, {
                    Salary: salary?.value.trim() || null,
                    StartDate: start?.value ? `${start.value}T09:00:00` : null,
                    ExpiresAt: expires?.value ? `${expires.value}T23:00:00` : null,
                    Note: note?.value.trim() || null
                });
                if (!r.success) { M.toast(r.message || 'Không gửi được offer.', { tone: 'danger' }); return; }
                modal.hide();
                app.status = 'Offered';
                app.offerResponse = 'Pending';
                app.offerExpiresAt = r.offerExpiresAt || app.offerExpiresAt;
                renderPipeline(applicantsData);
                M.toast(`Đã gửi offer cho ${app.fullName}.`, { tone: 'success' });
                scheduleSilentRefresh(200);
            } catch {
                M.toast('Lỗi kết nối khi gửi offer.', { tone: 'danger' });
            } finally {
                confirmBtn.disabled = false;
            }
        };
    }

    // =====================================================================
    // Ngăn chi tiết (Slide-in Drawer)
    // =====================================================================
    function renderDrawerHeader(app) {
        const statusBadge = document.getElementById('drawerStatusBadge');
        if (statusBadge) {
            const stageObj = STAGES.find(s => s.key === app.status);
            statusBadge.innerText = stageObj?.label || app.statusLabel || app.status;
        }
        const scoreBtn = document.getElementById('drawerScore');
        if (scoreBtn && scoreBtn.querySelector) {
            const num = scoreBtn.querySelector('.cd-score__num');
            const label = scoreBtn.querySelector('.cd-score__label');
            scoreBtn.setAttribute('data-tier', app.matchScore !== null && app.matchScore !== undefined ? (app.matchTier || 'none') : 'none');
            if (num) num.innerText = app.matchScore !== null && app.matchScore !== undefined ? String(Math.round(app.matchScore)) : (app.matchPending ? '…' : '—');
            if (label) label.innerText = app.matchScore !== null && app.matchScore !== undefined ? (app.matchTierLabel || '') : (app.matchPending ? 'AI đang chấm' : 'Chưa chấm');
        }
    }

    const ACTION_DEF = {
        shortlist: { label: 'Rút gọn', icon: 'star', tone: 'secondary' },
        schedule: { label: 'Hẹn phỏng vấn', icon: 'calendar', tone: 'primary' },
        reschedule: { label: 'Đổi lịch', icon: 'calendar-clock', tone: 'secondary' },
        pickSlot: { label: 'Chốt giờ ứng viên đề xuất', icon: 'calendar-check', tone: 'primary' },
        evaluate: { label: 'Ghi phiếu đánh giá', icon: 'clipboard-check', tone: 'primary' },
        offer: { label: 'Gửi offer', icon: 'award', tone: 'primary' },
        nextRound: { label: 'Hẹn vòng sau', icon: 'calendar-plus', tone: 'secondary' },
        markHired: { label: 'Ghi nhận đã tuyển', icon: 'badge-check', tone: 'secondary' },
        closeJob: { label: 'Đóng tin', icon: 'lock', tone: 'secondary' },
        joinRoom: { label: 'Vào phòng', icon: 'video', tone: 'primary' },
        aiResult: { label: 'Xem kết quả AI', icon: 'bot', tone: 'primary' },
        ics: { label: 'Thêm vào lịch', icon: 'calendar-plus', tone: 'ghost' },
        reject: { label: 'Từ chối', icon: 'x', tone: 'ghost-danger' }
    };

    function renderDrawerNext(app) {
        const box = document.getElementById('drawerNextStep');
        const titleEl = document.getElementById('drawerNextTitle');
        const textEl = document.getElementById('drawerNextText');
        const actionsEl = document.getElementById('drawerNextActions');
        if (!box || !titleEl || !textEl || !actionsEl) return;
        const step = app.nextStep;
        if (!step) {
            box.hidden = true;
            return;
        }
        box.hidden = false;
        box.setAttribute('data-tone', NEEDS_ACTION.has(step.key) ? 'warn' : (STEP_TONE[step.key] || ''));
        titleEl.innerText = step.title || '';
        textEl.innerText = step.text || '';
        const actions = Array.isArray(step.actions) ? step.actions : [];
        actionsEl.innerHTML = actions.map(a => {
            const def = ACTION_DEF[a];
            if (!def) return '';
            const label = a === 'nextRound' ? `Hẹn vòng ${(app.interviewRound || 1) + 1}` : def.label;
            const cls = def.tone === 'ghost-danger' ? 'a-btn--ghost" style="color:var(--danger)' : `a-btn--${def.tone}`;
            if (a === 'joinRoom') return `<a class="a-btn a-btn--primary a-btn--sm" href="/Interview/Room/${app.id}" target="_blank" rel="noopener"><i data-lucide="${def.icon}"></i> ${label}</a>`;
            if (a === 'aiResult') return app.aiInterview ? `<a class="a-btn a-btn--primary a-btn--sm" href="${esc(app.aiInterview.resultsUrl)}" target="_blank" rel="noopener"><i data-lucide="${def.icon}"></i> ${label}</a>` : '';
            if (a === 'ics') return `<a class="a-btn a-btn--ghost a-btn--sm" href="/JobApplications/InterviewIcs?applicationId=${app.id}"><i data-lucide="${def.icon}"></i> ${label}</a>`;
            return `<button type="button" class="a-btn ${cls} a-btn--sm" data-next-act="${a}"><i data-lucide="${def.icon}"></i> ${label}</button>`;
        }).join('');
        if (actionsEl.querySelectorAll) {
            actionsEl.querySelectorAll('[data-next-act]').forEach(btn => {
                btn.addEventListener('click', () => runAction(btn.dataset.nextAct, app));
            });
        }
        renderIcons();
    }

    function runAction(action, app) {
        switch (action) {
            case 'shortlist': executeStatusChange(app, app.status, 'Shortlisted', null); break;
            case 'schedule':
            case 'reschedule': openScheduleInterviewModal(app, app.status); break;
            case 'pickSlot': openScheduleInterviewModal(app, app.status, { slot: (app.proposedSlots || [])[0] }); break;
            case 'nextRound': openScheduleInterviewModal(app, app.status, { nextRound: true }); break;
            case 'evaluate': switchTab('interview'); setTimeout(() => document.querySelector('#evForm button')?.focus(), 80); break;
            case 'offer': openOfferModal(app); break;
            case 'markHired': executeStatusChange(app, app.status, 'Hired', 'Ghi nhận đã tuyển'); break;
            case 'closeJob': closeCurrentJob(); break;
            case 'reject': openRejectionModal(app, app.status); break;
        }
    }

    function switchTab(tab) {
        const tabs = document.getElementById('drawerTabs');
        if (!tabs || !tabs.querySelectorAll) return;
        tabs.querySelectorAll('button[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
        document.querySelectorAll('.cd-pane').forEach(p => { p.hidden = p.dataset.pane !== tab; });
    }

    function openDrawer(app, triggerEl) {
        lastFocusedElement = triggerEl || document.activeElement;
        const switching = !activeDrawerApplicant || activeDrawerApplicant.id !== app.id;
        activeDrawerApplicant = app;
        const drawer = document.getElementById('candidateDrawer');
        const backdrop = document.getElementById('candidateDrawerBackdrop');
        if (!drawer) return;

        const avatarImg = document.getElementById('drawerAvatar');
        if (avatarImg) avatarImg.src = app.avatar || '/images/default-avatar.png';

        const nameEl = document.getElementById('drawerName');
        if (nameEl) nameEl.innerText = app.fullName || 'Ứng viên';

        renderDrawerHeader(app);

        const jobEl = document.getElementById('drawerJob');
        if (jobEl) jobEl.innerText = app.jobTitle || '';

        const emailEl = document.getElementById('drawerEmail');
        if (emailEl) emailEl.innerText = app.email || 'Chưa có email';

        const dateEl = document.getElementById('drawerDate');
        if (dateEl) dateEl.innerText = app.appliedAt ? `Nộp ${new Date(app.appliedAt).toLocaleDateString('vi-VN')}` : '';

        // Hiển thị lịch phỏng vấn nếu đã lên lịch
        const interviewBox = document.getElementById('drawerInterviewInfo');
        const interviewTimeEl = document.getElementById('drawerInterviewTime');
        const interviewLocEl = document.getElementById('drawerInterviewLoc');
        if (interviewBox) {
            if (app.interviewAt) {
                interviewBox.classList.remove('d-none');
                const labelEl = document.getElementById('drawerInterviewLabel');
                if (labelEl) labelEl.innerText = app.aiInterview ? 'Hạn làm phỏng vấn AI' : 'Lịch phỏng vấn';
                if (interviewTimeEl) {
                    const d = new Date(app.interviewAt);
                    interviewTimeEl.innerText = isNaN(d.getTime()) ? app.interviewAt : d.toLocaleString('vi-VN');
                }
                if (interviewLocEl) {
                    interviewLocEl.innerText = app.interviewLocation || (app.isVideoCall ? 'Aris Video Room' : 'Tại văn phòng');
                }
            } else {
                interviewBox.classList.add('d-none');
            }
        }

        const coverEl = document.getElementById('drawerCoverLetter');
        if (coverEl) coverEl.innerText = app.coverLetter || 'Không có thư giới thiệu.';

        // Link CV
        const cvBtn = document.getElementById('drawerCvBtn');
        if (cvBtn) {
            if (app.resumeUrl) {
                cvBtn.href = app.resumeUrl;
                cvBtn.classList.remove('d-none');
            } else {
                cvBtn.classList.add('d-none');
            }
        }

        // Link Nhắn tin
        const chatBtn = document.getElementById('drawerChatBtn');
        if (chatBtn) {
            if (app.candidateUserId) {
                chatBtn.href = `/Chat?userId=${app.candidateUserId}`;
                chatBtn.classList.remove('d-none');
            } else {
                chatBtn.classList.add('d-none');
            }
        }

        // Nút Hẹn phỏng vấn trong drawer
        const interviewBtn = document.getElementById('drawerInterviewBtn');
        if (interviewBtn) {
            const closed = ['Rejected', 'Hired', 'Withdrawn', 'Offered'].includes(app.status);
            interviewBtn.hidden = closed;
            interviewBtn.onclick = () => {
                openScheduleInterviewModal(app, app.status);
            };
        }

        renderDrawerNext(app);
        if (switching) switchTab('overview');
        renderOverviewExtras(app, detailCache.get(app.id));
        renderInterviewPane(app, detailCache.get(app.id));
        loadDetail(app);

        drawer.setAttribute('aria-hidden', 'false');
        drawer.classList.add('is-open');
        if (backdrop) {
            backdrop.setAttribute('aria-hidden', 'false');
            backdrop.classList.add('is-open');
        }

        const closeBtn = document.getElementById('closeDrawerBtn');
        if (closeBtn) {
            setTimeout(() => closeBtn.focus(), 50);
        }

        renderIcons();
    }

    function closeDrawer() {
        const drawer = document.getElementById('candidateDrawer');
        const backdrop = document.getElementById('candidateDrawerBackdrop');
        if (drawer) {
            drawer.setAttribute('aria-hidden', 'true');
            drawer.classList.remove('is-open');
        }
        if (backdrop) {
            backdrop.setAttribute('aria-hidden', 'true');
            backdrop.classList.remove('is-open');
        }
        activeDrawerApplicant = null;

        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            try {
                lastFocusedElement.focus();
            } catch { /* ignore */ }
            lastFocusedElement = null;
        }
    }

    // Phân tích AI, câu hỏi sàng lọc, phiếu đánh giá, lịch sử — một lần gọi, giữ trong phiên.
    async function loadDetail(app, force) {
        if (!force && detailCache.has(app.id)) {
            renderDetail(app, detailCache.get(app.id));
            return;
        }
        const aiEl = document.getElementById('drawerAi');
        if (aiEl && !detailCache.has(app.id)) {
            aiEl.innerHTML = '<div class="ai-skel" style="width:40%;height:28px"></div><div class="ai-skel" style="width:100%;margin-top:10px"></div><div class="ai-skel" style="width:80%;margin-top:8px"></div>';
        }
        try {
            const res = await fetch(`/JobApplications/GetApplicationDetail?applicationId=${app.id}`);
            const d = await res.json();
            if (!d || !d.success) return;
            detailCache.set(app.id, d);
            if (activeDrawerApplicant && activeDrawerApplicant.id === app.id) renderDetail(app, d);
        } catch { /* giữ nội dung cũ */ }
    }

    function renderDetail(app, d) {
        if (!d) return;
        renderOverviewExtras(app, d);
        renderAiPane(app, d);
        renderInterviewPane(app, d);
        renderTimeline(d);
        renderIcons();
    }

    function renderOverviewExtras(app, d) {
        const wrap = document.getElementById('drawerScreeningWrap');
        const list = document.getElementById('drawerScreening');
        const screening = d && Array.isArray(d.screening) ? d.screening : [];
        if (wrap && list) {
            wrap.hidden = screening.length === 0;
            list.innerHTML = screening.map(s => `
                <li><div class="cd-qa__q">${esc(s.question)}</div>
                <div class="cd-qa__a ${s.answer ? '' : 'is-empty'}">${s.answer ? esc(s.answer) : 'Không trả lời'}</div></li>`).join('');
        }
        const otherWrap = document.getElementById('drawerOtherWrap');
        const other = document.getElementById('drawerOther');
        const others = d && Array.isArray(d.otherApplications) ? d.otherApplications : [];
        if (otherWrap && other) {
            otherWrap.hidden = others.length === 0;
            other.innerHTML = others.map(o => `
                <li><a href="/Employer/Index?jobId=${o.jobId}&app=${o.id}">${esc(o.jobTitle)}</a>
                <span class="text-muted small"> · ${esc(STAGES.find(s => s.key === o.status)?.label || o.status)} · ${esc(fmtDate(o.appliedAt))}</span></li>`).join('');
        }
    }

    function renderAiPane(app, d) {
        const el = document.getElementById('drawerAi');
        if (!el) return;
        const MI = window.ArisMatchInsight;
        let html = '';
        if (d.match && MI) {
            html = MI.render(d.match, { audience: 'employer' });
            if (d.match.scoredAt) html += `<div class="ai-meter__note">Chấm lúc ${esc(fmtDateTime(d.match.scoredAt))} trên đúng CV ứng viên đã nộp.</div>`;
        } else if (app.matchPending) {
            html = `<div class="ai-empty"><i data-lucide="loader"></i><div>AI đang đọc CV và tin (5–40 giây). Bảng tự cập nhật khi xong.</div></div>`;
        } else {
            html = `<div class="ai-empty"><i data-lucide="sparkles"></i><div>${esc(d.matchError || app.matchError || 'AI chưa chấm hồ sơ này.')}</div></div>`;
        }
        html += `<div><button type="button" class="a-btn a-btn--secondary a-btn--sm" id="drawerRescore"><i data-lucide="refresh-cw"></i> ${d.match ? 'Chấm lại' : 'Chấm ngay'}</button></div>`;
        el.innerHTML = `<div class="mi-body">${html}</div>`;
        if (MI) MI.animate(el);
        const btn = document.getElementById('drawerRescore');
        if (btn && btn.addEventListener) {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> AI đang chấm…';
                try {
                    const r = await postJson(`/JobApplications/RescoreApplication?applicationId=${app.id}`);
                    if (!r.success) { M.toast(r.message || 'AI chưa chấm được.', { tone: 'danger' }); return; }
                    app.matchScore = r.matchScore;
                    app.matchSummary = r.matchSummary || '';
                    app.matchTier = r.matchTier;
                    app.matchTierLabel = r.matchTierLabel;
                    app.matchPending = false;
                    renderPipeline(applicantsData);
                    renderDrawerHeader(app);
                    await loadDetail(app, true);
                    M.toast('Đã chấm lại mức phù hợp.', { tone: 'success' });
                } catch {
                    M.toast('Lỗi kết nối dịch vụ AI.', { tone: 'danger' });
                } finally {
                    btn.disabled = false;
                }
            });
        }
    }

    const EV_CRITERIA = [
        { key: 'TechnicalRating', label: 'Chuyên môn' },
        { key: 'CommunicationRating', label: 'Giao tiếp' },
        { key: 'ProblemSolvingRating', label: 'Giải quyết vấn đề' },
        { key: 'CultureFitRating', label: 'Phù hợp văn hoá' }
    ];
    const EV_RECS = [
        { key: 'Hire', label: 'Nên tuyển' },
        { key: 'NextRound', label: 'Vòng sau' },
        { key: 'Hold', label: 'Cân nhắc' },
        { key: 'Reject', label: 'Không phù hợp' }
    ];

    function renderInterviewPane(app, d) {
        const el = document.getElementById('drawerInterviewPane');
        if (!el) return;
        let html = '';

        if (app.interviewAt) {
            const resp = app.interviewResponse === 'Accepted' ? 'Ứng viên đã xác nhận'
                : app.interviewResponse === 'Declined' ? 'Ứng viên xin đổi lịch' : 'Chờ ứng viên xác nhận';
            html += `
              <div class="cd-block ${app.status === 'InterviewScheduled' ? 'cd-block--brand' : ''}">
                <div class="cd-block__label"><i data-lucide="calendar"></i> Vòng ${app.interviewRound} · ${esc(resp)}</div>
                <div class="fw-semibold">${esc(new Date(app.interviewAt).toLocaleString('vi-VN', { weekday: 'long', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }))} · ${app.interviewDurationMinutes} phút</div>
                <div class="small text-muted mt-1">${esc(app.interviewLocation || (app.isVideoCall ? 'Aris Video Room' : 'Tại văn phòng'))}</div>
                ${app.interviewDeclineReason ? `<div class="small mt-2"><b>Lý do:</b> ${esc(app.interviewDeclineReason)}</div>` : ''}
              </div>`;
            const slots = (app.proposedSlots || []).filter(s => new Date(s).getTime() > Date.now());
            if (slots.length) {
                html += `<div><h5 class="cd-h">Ứng viên rảnh vào — bấm để chốt</h5>
                    <div class="iv-slots">${slots.map(s => `<button type="button" class="iv-slot" data-pick-slot="${esc(s)}">${esc(fmtTime(s))}<small>${esc(new Date(s).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }))}</small></button>`).join('')}</div></div>`;
            }
        } else {
            html += `<div class="ai-empty"><i data-lucide="calendar"></i><div>Chưa hẹn phỏng vấn.</div></div>`;
        }

        const canEvaluate = app.interviewAt && ['InterviewScheduled', 'Offered'].includes(app.status);
        if (canEvaluate) {
            html += `
              <form class="ev-form" id="evForm">
                <h5 class="cd-h" style="margin:0">Phiếu đánh giá vòng ${app.interviewRound} <span class="text-muted small fw-normal">· chỉ nội bộ, ứng viên không thấy</span></h5>
                ${EV_CRITERIA.map(c => `
                  <div class="ev-row"><span>${c.label}</span>
                    <span class="ev-stars" data-crit="${c.key}" role="radiogroup" aria-label="${c.label}">
                      ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-v="${n}" aria-label="${n}/5"><i data-lucide="star"></i></button>`).join('')}
                    </span>
                  </div>`).join('')}
                <div class="ev-recs">
                  ${EV_RECS.map(r => `<label><input type="radio" name="evRec" value="${r.key}"><span data-rec="${r.key}">${r.label}</span></label>`).join('')}
                </div>
                <textarea class="a-textarea" id="evStrengths" rows="2" maxlength="1500" placeholder="Điểm mạnh"></textarea>
                <textarea class="a-textarea" id="evConcerns" rows="2" maxlength="1500" placeholder="Điểm cần lưu ý"></textarea>
                <div><button type="submit" class="a-btn a-btn--primary a-btn--sm">Lưu phiếu</button></div>
              </form>`;
        }

        const evals = d && Array.isArray(d.evaluations) ? d.evaluations : [];
        if (evals.length) {
            html += `<div><h5 class="cd-h">Phiếu đã ghi</h5><div class="d-grid gap-2">${evals.map(e => `
              <div class="ev-card">
                <div class="ev-card__head"><span>Vòng ${e.round} · ${esc(e.recommendationLabel)}</span><span>${esc(e.average)}/5</span></div>
                <div class="ev-card__bars">
                  ${[['Chuyên môn', e.technical], ['Giao tiếp', e.communication], ['Giải quyết vấn đề', e.problemSolving], ['Văn hoá', e.cultureFit]]
                      .map(([l, v]) => `<span>${l}</span><span class="ev-card__bar"><span style="width:${(v || 0) * 20}%"></span></span><span>${v}</span>`).join('')}
                </div>
                ${e.strengths ? `<div><b>Điểm mạnh:</b> ${esc(e.strengths)}</div>` : ''}
                ${e.concerns ? `<div><b>Lưu ý:</b> ${esc(e.concerns)}</div>` : ''}
                <div class="cd-timeline__meta">${esc(fmtDateTime(e.createdAt))}</div>
              </div>`).join('')}</div></div>`;
        }

        el.innerHTML = html;
        if (!el.querySelectorAll) return;

        el.querySelectorAll('[data-pick-slot]').forEach(btn => {
            btn.addEventListener('click', () => openScheduleInterviewModal(app, app.status, { slot: btn.dataset.pickSlot }));
        });

        const form = el.querySelector('#evForm');
        if (!form) return;
        const values = {};
        form.querySelectorAll('.ev-stars').forEach(group => {
            const buttons = group.querySelectorAll('button');
            buttons.forEach(b => b.addEventListener('click', () => {
                const v = parseInt(b.dataset.v, 10);
                values[group.dataset.crit] = v;
                buttons.forEach(x => x.classList.toggle('is-on', parseInt(x.dataset.v, 10) <= v));
            }));
        });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rec = form.querySelector('input[name="evRec"]:checked');
            if (EV_CRITERIA.some(c => !values[c.key])) { M.toast('Chấm đủ 4 tiêu chí (1–5 sao).', { tone: 'warning' }); return; }
            if (!rec) { M.toast('Chọn kết luận cho phiếu đánh giá.', { tone: 'warning' }); return; }
            const submit = form.querySelector('button[type="submit"]');
            submit.disabled = true;
            try {
                const r = await postJson(`/JobApplications/SubmitEvaluation?applicationId=${app.id}`, {
                    ...values,
                    Recommendation: rec.value,
                    Strengths: form.querySelector('#evStrengths').value.trim() || null,
                    Concerns: form.querySelector('#evConcerns').value.trim() || null
                });
                if (!r.success) { M.toast(r.message || 'Không lưu được phiếu.', { tone: 'danger' }); return; }
                M.toast(`Đã lưu phiếu đánh giá (${r.average}/5).`, { tone: 'success' });
                if (r.nextStep) {
                    app.nextStep = r.nextStep;
                    renderDrawerNext(app);
                    document.getElementById('drawerNextStep')?.classList.add('is-bump');
                }
                await loadDetail(app, true);
                scheduleSilentRefresh();
            } catch {
                M.toast('Lỗi kết nối khi lưu phiếu.', { tone: 'danger' });
            } finally {
                submit.disabled = false;
            }
        });
    }

    const ACTOR_LABEL = { Candidate: 'Ứng viên', Employer: 'Nhà tuyển dụng', System: 'Aris' };

    function renderTimeline(d) {
        const el = document.getElementById('drawerTimeline');
        if (!el) return;
        const items = Array.isArray(d.timeline) ? d.timeline : [];
        if (!items.length) {
            el.innerHTML = '<li><div class="cd-timeline__meta">Chưa có hoạt động.</div></li>';
            return;
        }
        el.innerHTML = items.map(t => `
            <li data-actor="${esc(t.actor)}" data-internal="${t.isInternal ? 'true' : 'false'}">
              <div class="cd-timeline__title">${esc(t.title)}${t.isInternal ? ' <span class="text-muted small fw-normal">· nội bộ</span>' : ''}</div>
              <div class="cd-timeline__meta">${esc(ACTOR_LABEL[t.actor] || t.actor)} · ${esc(fmtDateTime(t.at))}</div>
              ${t.detail ? `<div class="cd-timeline__detail">${esc(t.detail)}</div>` : ''}
            </li>`).join('');
    }

    function bindDrawerEvents() {
        const closeBtn = document.getElementById('closeDrawerBtn');
        if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

        const backdrop = document.getElementById('candidateDrawerBackdrop');
        if (backdrop) backdrop.addEventListener('click', closeDrawer);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const drawer = document.getElementById('candidateDrawer');
                if (drawer && drawer.classList.contains('is-open') && !document.querySelector('.modal.show')) {
                    closeDrawer();
                }
            }
        });

        document.addEventListener('click', (e) => {
            const drawer = document.getElementById('candidateDrawer');
            if (!drawer || !drawer.classList.contains('is-open')) return;
            if (!drawer.contains(e.target) && !e.target.closest('.candidate-card') && !e.target.closest('.modal') && !e.target.closest('.iv-ev') && !e.target.closest('.a-toast, .toast')) {
                closeDrawer();
            }
        });

        document.getElementById('drawerTabs')?.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-tab]');
            if (btn) switchTab(btn.dataset.tab);
        });

        document.getElementById('drawerScore')?.addEventListener('click', () => switchTab('ai'));

        document.getElementById('drawerCopyEmail')?.addEventListener('click', async () => {
            const email = activeDrawerApplicant?.email;
            if (!email) return;
            try {
                await navigator.clipboard.writeText(email);
                M.toast('Đã chép email.', { tone: 'success' });
            } catch {
                M.toast(email);
            }
        });
    }

    // =====================================================================
    // Header: chế độ xem, sắp xếp, chấm AI hàng loạt, đóng tin khi đủ người
    // =====================================================================
    function renderJobMeta() {
        const metaEl = document.getElementById('pipelineJobMeta');
        const total = applicantsData.length;
        const scored = applicantsData.filter(a => a.matchScore !== null).length;
        const todo = applicantsData.filter(a => a.nextStep && NEEDS_ACTION.has(a.nextStep.key)).length;
        if (metaEl) {
            const parts = [`<span><b>${total}</b> ứng viên</span>`];
            if (jobMeta.openings) parts.push(`<span>Đã tuyển <b>${jobMeta.hiredCount}/${jobMeta.openings}</b></span>`);
            if (total) parts.push(`<span>AI đã chấm <b>${scored}/${total}</b></span>`);
            if (todo) parts.push(`<span style="color:var(--accent, var(--warning))"><b>${todo}</b> việc chờ bạn</span>`);
            parts.push(`<span>${jobMeta.jobActive ? 'Đang nhận hồ sơ' : 'Đã đóng'}</span>`);
            metaEl.innerHTML = parts.join('<span>&bull;</span>');
        }

        const banner = document.getElementById('jobFullBanner');
        const bannerText = document.getElementById('jobFullText');
        const full = jobMeta.openings && jobMeta.hiredCount >= jobMeta.openings && jobMeta.jobActive;
        if (banner) {
            banner.hidden = !full;
            if (full && bannerText) bannerText.innerText = `Đã tuyển đủ ${jobMeta.hiredCount}/${jobMeta.openings} người cho tin này — đóng tin để ngừng nhận hồ sơ mới.`;
        }
    }

    function updateSidebarTodo() {
        const item = document.querySelector(`.employer-job-item[data-job-id="${currentJobId}"]`);
        if (!item) return;
        const todo = applicantsData.filter(a => a.nextStep && NEEDS_ACTION.has(a.nextStep.key)).length;
        let badge = item.querySelector('.employer-job-item__todo');
        if (!todo) { badge?.remove(); return; }
        if (!badge && item.dataset.jobActive === '1') {
            badge = document.createElement('span');
            badge.className = 'employer-job-item__todo';
            item.querySelector('.employer-job-item__title')?.after(badge);
        }
        if (badge) {
            badge.innerText = String(todo);
            badge.title = `${todo} việc đang chờ bạn`;
        }
    }

    function updateScoreAllButton() {
        const btn = document.getElementById('scoreAllBtn');
        const count = document.getElementById('scoreAllCount');
        if (!btn) return;
        const unscored = applicantsData.filter(a => a.matchScore === null && !a.matchPending && a.status !== 'Withdrawn').length;
        btn.hidden = unscored === 0;
        if (count) count.innerText = unscored ? String(unscored) : '';
    }

    async function closeCurrentJob() {
        if (currentJobId == null) return;
        try {
            const res = await fetch(`/Jobs/ToggleJobActive/${currentJobId}`, { method: 'POST', headers: { 'RequestVerificationToken': antiForgeryToken() } });
            const r = await res.json();
            if (!r.success) { M.toast(r.message || 'Không đóng được tin.', { tone: 'danger' }); return; }
            jobMeta.jobActive = false;
            const item = document.querySelector(`.employer-job-item[data-job-id="${currentJobId}"]`);
            if (item) item.dataset.jobActive = '0';
            renderJobMeta();
            M.toast(r.message || 'Đã đóng tin tuyển dụng.', { tone: 'success' });
        } catch {
            M.toast('Lỗi kết nối khi đóng tin.', { tone: 'danger' });
        }
    }

    function setView(view) {
        viewMode = view;
        document.querySelectorAll('#viewSeg button[data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === view)));
        const board = document.getElementById('pipelineBoard');
        const cal = document.getElementById('interviewCalendar');
        if (board) board.hidden = view !== 'board';
        if (cal) cal.hidden = view !== 'calendar';
        const sortSeg = document.getElementById('sortSeg');
        if (sortSeg) sortSeg.hidden = view !== 'board';
        if (view === 'calendar') loadCalendar();
    }

    function bindHeaderControls() {
        document.getElementById('viewSeg')?.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-view]');
            if (btn) setView(btn.dataset.view);
        });

        document.getElementById('sortSeg')?.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-sort]');
            if (!btn) return;
            sortMode = btn.dataset.sort;
            document.querySelectorAll('#sortSeg button[data-sort]').forEach(b => b.setAttribute('aria-checked', String(b === btn)));
            renderPipeline(applicantsData);
        });

        document.getElementById('scoreAllBtn')?.addEventListener('click', async () => {
            if (currentJobId == null) return;
            const btn = document.getElementById('scoreAllBtn');
            btn.disabled = true;
            try {
                const r = await postJson(`/JobApplications/QueueScoringForJob?jobId=${currentJobId}`);
                if (!r.success) { M.toast(r.message || 'Không xếp hàng chấm được.', { tone: 'danger' }); return; }
                applicantsData.forEach(a => { if (a.matchScore === null && a.status !== 'Withdrawn') a.matchPending = true; });
                renderPipeline(applicantsData);
                updateScoreAllButton();
                M.toast(r.queued ? `AI đang chấm ${r.queued} hồ sơ — bảng tự cập nhật.` : 'Các hồ sơ đã có trong hàng chấm.', { tone: 'info' });
                pollCount = 0;
                schedulePolling();
            } catch {
                M.toast('Lỗi kết nối dịch vụ AI.', { tone: 'danger' });
            } finally {
                btn.disabled = false;
            }
        });

        document.getElementById('closeJobBtn')?.addEventListener('click', closeCurrentJob);
    }

    // =====================================================================
    // Lịch phỏng vấn theo tuần (mọi tin của doanh nghiệp)
    // =====================================================================
    const CAL_START_HOUR = 7;
    const CAL_END_HOUR = 22;
    const HOUR_PX = 52;
    let calWeekStart = startOfWeek(new Date());
    let calSeq = 0;

    function startOfWeek(d) {
        const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dow = (x.getDay() + 6) % 7; // Thứ Hai = 0
        x.setDate(x.getDate() - dow);
        return x;
    }

    function bindCalendar() {
        document.getElementById('calPrev')?.addEventListener('click', () => { calWeekStart.setDate(calWeekStart.getDate() - 7); loadCalendar(); });
        document.getElementById('calNext')?.addEventListener('click', () => { calWeekStart.setDate(calWeekStart.getDate() + 7); loadCalendar(); });
        document.getElementById('calToday')?.addEventListener('click', () => { calWeekStart = startOfWeek(new Date()); loadCalendar(); });
        const onEvent = (e) => {
            const ev = e.target.closest('.iv-ev[data-app]');
            if (!ev) return;
            openFromCalendar(parseInt(ev.dataset.app, 10), parseInt(ev.dataset.job, 10), ev);
        };
        document.getElementById('calGrid')?.addEventListener('click', onEvent);
        document.getElementById('calList')?.addEventListener('click', onEvent);
    }

    function openFromCalendar(appId, jobId, el) {
        if (jobId === currentJobId) {
            const app = applicantsData.find(a => a.id === appId);
            if (app) { openDrawer(app, el); return; }
        }
        pendingOpenAppId = appId;
        selectJob(jobId);
    }

    function eventState(ev, now) {
        if (ev.needsEvaluation) return 'eval';
        if (ev.response === 'Declined') return 'declined';
        if (!ev.isCurrent || new Date(ev.at).getTime() + ev.duration * 60000 < now) return 'past';
        if (ev.response === 'Accepted') return 'ok';
        return 'pending';
    }

    async function loadCalendar() {
        const grid = document.getElementById('calGrid');
        const list = document.getElementById('calList');
        const range = document.getElementById('calRange');
        if (!grid) return;
        const seq = ++calSeq;
        const from = new Date(calWeekStart);
        const to = new Date(calWeekStart);
        to.setDate(to.getDate() + 7);
        const last = new Date(to); last.setDate(last.getDate() - 1);
        if (range) range.innerText = `${pad2(from.getDate())}/${pad2(from.getMonth() + 1)} – ${pad2(last.getDate())}/${pad2(last.getMonth() + 1)}/${last.getFullYear()}`;
        grid.innerHTML = '<div class="iv-cal__empty" style="grid-column:1/-1"><span class="spinner-border spinner-border-sm"></span></div>';

        let interviews = [];
        try {
            const res = await fetch(`/Employer/GetInterviews?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
            const d = await res.json();
            if (seq !== calSeq) return;
            if (!d.success) throw new Error(d.message);
            interviews = d.interviews || [];
        } catch (err) {
            if (seq !== calSeq) return;
            grid.innerHTML = `<div class="iv-cal__empty" style="grid-column:1/-1">${esc(err.message || 'Không tải được lịch phỏng vấn.')}</div>`;
            if (list) list.innerHTML = '';
            return;
        }

        const now = Date.now();
        const today = new Date();
        const days = [...Array(7)].map((_, i) => { const d = new Date(from); d.setDate(d.getDate() + i); return d; });
        const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
        const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        const hours = CAL_END_HOUR - CAL_START_HOUR;

        let html = '<div class="iv-cal__corner"></div>';
        days.forEach((d, i) => {
            html += `<div class="iv-cal__day ${sameDay(d, today) ? 'is-today' : ''}">${weekdays[i]}<b>${d.getDate()}</b></div>`;
        });
        html += `<div>${[...Array(hours)].map((_, h) => `<div class="iv-cal__hour">${pad2(CAL_START_HOUR + h)}:00</div>`).join('')}</div>`;

        const evButton = (ev, style) => {
            const state = eventState(ev, now);
            return `<button type="button" class="iv-ev" data-state="${state}" data-app="${ev.id}" data-job="${ev.jobId}" ${style ? `style="${style}"` : ''}
                    title="${esc(ev.name)} · ${esc(ev.jobTitle)} · vòng ${ev.round}">
                <b>${esc(fmtTime(ev.at))} ${esc(ev.name)}</b>
                <span>${esc(ev.jobTitle)}${ev.round > 1 ? ` · V${ev.round}` : ''}</span>
              </button>`;
        };

        days.forEach(d => {
            const dayEvents = interviews.filter(ev => sameDay(new Date(ev.at), d));
            let col = `<div class="iv-cal__col ${sameDay(d, today) ? 'is-today' : ''}" style="height:${hours * HOUR_PX}px">`;
            if (sameDay(d, today)) {
                const mins = (today.getHours() - CAL_START_HOUR) * 60 + today.getMinutes();
                if (mins >= 0 && mins <= hours * 60) col += `<div class="iv-cal__now" style="top:${mins / 60 * HOUR_PX}px"></div>`;
            }
            dayEvents.forEach(ev => {
                const t = new Date(ev.at);
                const mins = Math.max(0, Math.min(hours * 60 - 30, (t.getHours() - CAL_START_HOUR) * 60 + t.getMinutes()));
                const height = Math.max(26, (ev.duration || 45) / 60 * HOUR_PX - 2);
                col += evButton(ev, `top:${mins / 60 * HOUR_PX}px;height:${height}px`);
            });
            col += '</div>';
            html += col;
        });
        grid.innerHTML = html;

        if (list) {
            const byDay = days.map(d => ({ d, items: interviews.filter(ev => sameDay(new Date(ev.at), d)) })).filter(x => x.items.length);
            list.innerHTML = byDay.length
                ? byDay.map(({ d, items }) => `
                    <div><div class="iv-list-day ${sameDay(d, today) ? 'is-today' : ''}">${weekdays[(d.getDay() + 6) % 7]} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}</div>
                    ${items.map(ev => evButton(ev)).join('')}</div>`).join('')
                : '<div class="iv-cal__empty">Không có buổi phỏng vấn nào trong tuần này.</div>';
        }
        if (!interviews.length) {
            grid.insertAdjacentHTML('beforeend', '<div class="iv-cal__empty" style="grid-column:1/-1">Không có buổi phỏng vấn nào trong tuần này.</div>');
        }
        renderIcons();
    }

    // Các sự kiện tin tuyển dụng
    function bindJobEvents() {
        // Chọn tin bằng bàn phím (Enter / Space)
        document.addEventListener('keydown', (e) => {
            const item = e.target.closest('.employer-job-item');
            if (item && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                const jobId = parseInt(item.getAttribute('data-job-id'), 10);
                if (jobId) selectJob(jobId);
            }
        });

        // Nút thu gọn / mở rộng cột Từ chối
        const rejectCol = document.querySelector('.pipeline-col[data-stage="Rejected"]');
        if (rejectCol) {
            rejectCol.classList.add('is-collapsed');
            rejectCol.addEventListener('click', (e) => {
                if (rejectCol.classList.contains('is-collapsed')) {
                    rejectCol.classList.remove('is-collapsed');
                }
            });
        }
    }

    function bindModalEvents() {
        // Bật/tắt video: ẩn ô địa điểm khi phỏng vấn trên Aris Video Room
        const toggle = document.getElementById('interviewVideoCallToggle');
        const locField = document.getElementById('interviewLocationField');
        const syncLoc = () => { if (locField && toggle) locField.hidden = toggle.checked; };
        toggle?.addEventListener('change', syncLoc);
        syncLoc();
    }

    if (typeof window !== 'undefined') {
        window.__employerInternals = {
            executeStatusChange,
            openDrawer,
            openScheduleInterviewModal,
            openRejectionModal,
            openOfferModal,
            mapApplicant,
            queueAppStatusUpdate,
            appUpdateChains,
            appStateCoordination,
            getAppState,
            getActiveDrawerApplicant: () => activeDrawerApplicant,
            STAGES
        };
    }
})();
