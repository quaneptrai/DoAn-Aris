/* =============================================================================
   ARIS LINE V7 — Jobs Page (jobs.js)
   - Handles Candidate master-detail view with FLIP and live API endpoints
   - Handles Business posting management (create, edit, toggle, applicants, share)
   ============================================================================= */
(function () {
    'use strict';

    const M = window.ArisMotion || {
        animate: (el, kf, opt) => el.animate(kf, opt),
        flip: (c, fn) => fn(),
        indicator: (ind, target, opts) => {
            if (!ind || !target) return;
            const r = target.getBoundingClientRect();
            const cr = ind.parentElement.getBoundingClientRect();
            ind.style.transform = `translateY(${r.top - cr.top}px)`;
            ind.style.height = `${r.height}px`;
            ind.style.opacity = '1';
        },
        openDialog: (dlg, scrim) => { dlg.hidden = false; if (scrim) scrim.hidden = false; },
        closeDialog: (dlg, scrim) => { dlg.hidden = true; if (scrim) scrim.hidden = true; },
        toast: (msg) => { if (window.showToast) window.showToast(msg); else alert(msg); },
        morphButton: () => {},
        EASE_OUT: 'cubic-bezier(0.16, 1, 0.3, 1)',
        EASE_IN: 'cubic-bezier(0.7, 0, 0.84, 0)'
    };

    const $ = (s, r = document) => (r && r.querySelector ? r.querySelector(s) : null);
    const $$ = (s, r = document) => (r && r.querySelectorAll ? Array.from(r.querySelectorAll(s)) : []);
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const isMobile = () => matchMedia('(max-width: 767px)').matches;

    function antiForgeryHeaders(headers = {}) {
        const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value;
        return token ? { ...headers, RequestVerificationToken: token } : headers;
    }

    function renderIcons() {
        if (window.lucide && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
        }
    }

    // =========================================================================
    // 1. BUSINESS VIEW LOGIC
    // =========================================================================
    if (window.__IS_BUSINESS__) {
        initBusiness();
        return;
    }

    function initBusiness() {
        const postJobDialog = $('#postJobDialog');
        const postJobScrim = $('#postJobScrim');
        const shareDialog = $('#shareDialog');
        const shareScrim = $('#shareScrim');

        // Modal Helpers
        function openDlg(dlg, scrim) { M.openDialog(dlg, scrim); renderIcons(); }
        function closeDlg(dlg, scrim) { M.closeDialog(dlg, scrim); }

        $$('.a-dialog [data-close]').forEach(b => {
            b.addEventListener('click', (e) => {
                const dlg = e.target.closest('.a-dialog');
                if (dlg === postJobDialog) closeDlg(postJobDialog, postJobScrim);
                if (dlg === shareDialog) closeDlg(shareDialog, shareScrim);
            });
        });

        postJobScrim?.addEventListener('click', () => closeDlg(postJobDialog, postJobScrim));
        shareScrim?.addEventListener('click', () => closeDlg(shareDialog, shareScrim));

        // Create Job Modal
        $('#openCreateJobBtn')?.addEventListener('click', () => {
            $('#jobEditId').value = '';
            $('#postJobModalTitle').textContent = 'Đăng tin tuyển dụng';
            $('#createJobForm').reset();
            openDlg(postJobDialog, postJobScrim);
        });
        // /Jobs/Index?compose=1 (từ trang "Đăng tuyển trên Aris" hoặc bảng tuyển dụng) mở sẵn form.
        if (new URLSearchParams(location.search).get('compose') === '1') {
            setTimeout(() => $('#openCreateJobBtn')?.click(), 250);
        }

        // Edit Job Button
        $$('.edit-job-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.jobId;
                try {
                    const res = await fetch(`/Jobs/GetJobPostingForEdit?id=${id}`);
                    const data = await res.json();
                    if (!data.success) { M.toast(data.message || 'Không thể lấy thông tin tin.', { tone: 'danger' }); return; }

                    const j = data.job;
                    $('#jobEditId').value = j.id;
                    $('#postJobModalTitle').textContent = 'Chỉnh sửa tin tuyển dụng';
                    $('#jobTitle').value = j.title || '';
                    $('#jobCate').value = j.category || '';
                    $('#jobCompany').value = j.company || '';
                    $('#jobSalary').value = j.salary || '';
                    $('#jobDeadline').value = j.deadline ? j.deadline.split('T')[0] : '';
                    $('#jobLocations').value = (j.locations || []).join('\n');
                    $('#jobResponsibilities').value = (j.responsibilities || []).join('\n');
                    $('#jobRequirements').value = (j.requirements || []).join('\n');
                    $('#jobBenefits').value = (j.benefits || []).join('\n');
                    $('#jobScreeningQuestions').value = (j.screeningQuestions || []).join('\n');
                    if ($('#jobOpenings')) $('#jobOpenings').value = j.openings || '';

                    openDlg(postJobDialog, postJobScrim);
                } catch (e) {
                    M.toast('Lỗi kết nối khi lấy dữ liệu tin.', { tone: 'danger' });
                }
            });
        });

        // JSON Upload
        $('#jsonUpload')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const d = JSON.parse(ev.target.result);
                    if (d.title) $('#jobTitle').value = d.title;
                    if (d.company) $('#jobCompany').value = d.company;
                    if (d.category) $('#jobCate').value = d.category;
                    if (d.salary) $('#jobSalary').value = d.salary;
                    if (d.deadline) $('#jobDeadline').value = d.deadline;
                    if (d.locations) $('#jobLocations').value = Array.isArray(d.locations) ? d.locations.join('\n') : d.locations;
                    if (d.responsibilities) $('#jobResponsibilities').value = Array.isArray(d.responsibilities) ? d.responsibilities.join('\n') : d.responsibilities;
                    if (d.requirements) $('#jobRequirements').value = Array.isArray(d.requirements) ? d.requirements.join('\n') : d.requirements;
                    if (d.benefits) $('#jobBenefits').value = Array.isArray(d.benefits) ? d.benefits.join('\n') : d.benefits;
                    M.toast('Đã nạp dữ liệu từ file JSON');
                } catch (err) {
                    M.toast('File JSON không hợp lệ.', { tone: 'danger' });
                }
            };
            reader.readAsText(file);
        });

        // PDF Extraction
        $('#pdfUpload')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            M.toast('Đang gửi file PDF tới AI để trích xuất…');

            try {
                const res = await fetch('/Jobs/ExtractJobFromPdf', { method: 'POST', headers: antiForgeryHeaders(), body: formData });
                const r = await res.json();
                if (!r.success) { M.toast(r.message || 'Không thể trích xuất PDF.', { tone: 'danger' }); return; }

                const j = r.data || {};
                if (j.title) $('#jobTitle').value = j.title;
                if (j.company) $('#jobCompany').value = j.company;
                if (j.category) $('#jobCate').value = j.category;
                if (j.salary) $('#jobSalary').value = j.salary;
                if (j.responsibilities) $('#jobResponsibilities').value = Array.isArray(j.responsibilities) ? j.responsibilities.join('\n') : j.responsibilities;
                if (j.requirements) $('#jobRequirements').value = Array.isArray(j.requirements) ? j.requirements.join('\n') : j.requirements;
                if (j.benefits) $('#jobBenefits').value = Array.isArray(j.benefits) ? j.benefits.join('\n') : j.benefits;
                M.toast('AI đã điền nội dung từ file PDF thành công!');
            } catch (err) {
                M.toast('Lỗi kết nối khi trích xuất PDF.', { tone: 'danger' });
            }
        });

        // Save Form
        $('#createJobForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editId = $('#jobEditId').value;
            const isEdit = editId !== '';
            const parseLines = (v) => v.split('\n').map(s => s.trim()).filter(Boolean);

            const dto = {
                title: $('#jobTitle').value.trim(),
                company: $('#jobCompany').value.trim(),
                category: $('#jobCate').value.trim(),
                salary: $('#jobSalary').value.trim(),
                deadline: $('#jobDeadline').value ? $('#jobDeadline').value : null,
                locations: parseLines($('#jobLocations').value),
                responsibilities: parseLines($('#jobResponsibilities').value),
                requirements: parseLines($('#jobRequirements').value),
                benefits: parseLines($('#jobBenefits').value),
                screeningQuestions: parseLines($('#jobScreeningQuestions').value),
                openings: $('#jobOpenings') && $('#jobOpenings').value ? parseInt($('#jobOpenings').value, 10) : null
            };

            const url = isEdit ? `/Jobs/UpdateJobPosting?id=${editId}` : '/Jobs/CreateJobPosting';
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: antiForgeryHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(dto)
                });
                const r = await res.json();
                if (r.success) {
                    M.toast(isEdit ? 'Đã cập nhật tin tuyển dụng' : 'Đã đăng tin tuyển dụng thành công');
                    setTimeout(() => location.reload(), 600);
                } else {
                    M.toast(r.message || 'Lỗi khi lưu tin tuyển dụng.', { tone: 'danger' });
                }
            } catch (err) {
                M.toast('Lỗi kết nối.', { tone: 'danger' });
            }
        });

        // Toggle Active
        $$('.toggle-job-active').forEach(sw => {
            sw.addEventListener('change', async () => {
                const id = sw.dataset.jobId;
                const checked = sw.checked;
                const badge = $(`#status-badge-${id}`);
                if (badge) {
                    badge.textContent = checked ? 'Đang tuyển' : 'Đã đóng';
                    badge.classList.toggle('a-status--success', checked);
                }
                try {
                    const res = await fetch(`/Jobs/ToggleJobActive?id=${id}`, { method: 'POST', headers: antiForgeryHeaders() });
                    const r = await res.json();
                    if (!r.success) {
                        sw.checked = !checked;
                        if (badge) {
                            badge.textContent = !checked ? 'Đang tuyển' : 'Đã đóng';
                            badge.classList.toggle('a-status--success', !checked);
                        }
                        M.toast(r.message || 'Không thể đổi trạng thái.', { tone: 'danger' });
                    } else {
                        M.toast(checked ? 'Tin đã mở lại tuyển dụng' : 'Đã đóng tin tuyển dụng');
                    }
                } catch (err) {
                    sw.checked = !checked;
                }
            });
        });

        // Quản lý ứng viên đã chuyển hẳn sang bảng Kanban /Employer (AI chấm điểm, lịch
        // phỏng vấn, đánh giá, offer) — nút "Ứng viên" trên mỗi tin giờ là liên kết tới đó.

        // Share Job
        let currentShareJobId = null;
        $$('.share-job-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                currentShareJobId = btn.dataset.jobId;
                $('#shareTitle').textContent = `Chia sẻ: ${btn.dataset.jobTitle || 'Tin tuyển dụng'}`;
                openDlg(shareDialog, shareScrim);
                $('#shareLoading').style.display = 'block';
                $('#shareBody').style.display = 'none';

                try {
                    const res = await fetch(`/Jobs/GetShareOptions?id=${currentShareJobId}`);
                    const data = await res.json();
                    $('#shareLoading').style.display = 'none';
                    $('#shareBody').style.display = 'block';
                    if (data.success) {
                        $('#shareMessage').value = data.defaultMessage || '';
                        const channels = data.channels || [];
                        $('#shareChannelList').innerHTML = channels.length === 0
                            ? '<div class="alert alert-light border small">Bạn chưa kết nối kênh nào (Facebook Page hoặc Zalo).</div>'
                            : channels.map(ch => `
                                <label class="a-check-row mb-1">
                                    <input type="checkbox" name="shareChannel" value="${ch.id}" checked>
                                    <span>${esc(ch.displayName || ch.name || ch.platform || 'Kênh')} (${esc(ch.platform || ch.provider || '')})</span>
                                </label>
                            `).join('');
                    }
                } catch (e) {
                    $('#shareLoading').textContent = 'Không thể tải danh sách kênh.';
                }
            });
        });

        $('#shareSubmitBtn')?.addEventListener('click', async () => {
            const selectedChannels = $$('input[name="shareChannel"]:checked', shareDialog).map(c => c.value);
            const msg = $('#shareMessage').value.trim();
            const btn = $('#shareSubmitBtn');
            btn.disabled = true;
            btn.textContent = 'Đang đăng...';

            try {
                const res = await fetch('/Jobs/ShareJob', {
                    method: 'POST',
                    headers: antiForgeryHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        jobId: parseInt(currentShareJobId, 10),
                        channels: selectedChannels.map(channelId => ({
                            channelId: parseInt(channelId, 10),
                            message: msg
                        }))
                    })
                });
                const r = await res.json();
                if (r.success) {
                    M.toast('Đã chia sẻ tin tuyển dụng thành công!');
                    closeDlg(shareDialog, shareScrim);
                } else {
                    M.toast(r.message || 'Lỗi khi chia sẻ.', { tone: 'danger' });
                }
            } catch (e) {
                M.toast('Lỗi kết nối khi chia sẻ.', { tone: 'danger' });
            } finally {
                btn.disabled = false;
                btn.textContent = 'Đăng ngay';
            }
        });
    }

    // =========================================================================
    // 2. CV-JD MATCHING (P06, P07) & CANDIDATE SHARED UTILITIES
    // (Runs on Details page and Jobs Index)
    // =========================================================================
    // Chia sẻ: bảng chia sẻ của máy nếu có, không thì sao chép liên kết
    document.addEventListener('click', (e) => {
        const b = e.target.closest('[data-share-job]');
        if (!b) return;
        const url = `${location.origin}/Jobs/Details/${b.dataset.shareJob}`;
        if (navigator.share && isMobile()) { navigator.share({ url }).catch(() => {}); return; }
        if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
        M.toast('Đã sao chép liên kết việc làm.', { tone: 'success' });
    });

let matcherAbortController = null;
    let matcherSeq = 0;

    function initCvMatcher(container = document) {
        const box = container.querySelector ? container.querySelector('.cv-match-box') : null;
        if (!box) return;
        if (box.dataset.matcherInit) return;
        box.dataset.matcherInit = 'true';

        const jobId = parseInt(box.dataset.jobId, 10);
        const cvSelect = box.querySelector('.cv-select');
        const scoreBtn = box.querySelector('.btn-score-cv');
        const resultBox = box.querySelector('.cv-match-result');

        if (!cvSelect || !scoreBtn || !resultBox) return;

        // Load candidate's resumes for dropdown
        fetch('/Jobs/GetCandidateResumes')
            .then(res => res.json())
            .then(data => {
                if (data.success && Array.isArray(data.resumes)) {
                    if (data.resumes.length === 0) {
                        cvSelect.innerHTML = '<option value="">Chưa có CV nào</option>';
                        cvSelect.disabled = true;
                        scoreBtn.disabled = true;
                        resultBox.innerHTML = `
                            <div class="cvm-card cvm-card--center">
                                <p class="mb-2">Bạn chưa có CV nào trong hệ thống để đối chiếu.</p>
                                <a href="/Resume" class="a-btn a-btn--primary a-btn--sm">Tạo hoặc tải CV</a>
                            </div>
                        `;
                    } else {
                        cvSelect.innerHTML = data.resumes.map(r => `
                            <option value="${r.id}">${esc(r.label || r.name)}${r.hasVector ? ' (Đã phân tích)' : ''}</option>
                        `).join('');
                        cvSelect.disabled = false;
                        scoreBtn.disabled = false;
                    }
                    renderIcons();
                } else {
                    cvSelect.innerHTML = `<option value="">${esc(data?.message || 'Không thể tải danh sách CV')}</option>`;
                    cvSelect.disabled = true;
                    scoreBtn.disabled = true;
                }
            })
            .catch(() => {
                cvSelect.innerHTML = '<option value="">Lỗi kết nối tải danh sách CV</option>';
                cvSelect.disabled = true;
                scoreBtn.disabled = true;
            });

        // Đổi lựa chọn CV: Huỷ request cũ và xoá kết quả cũ để tránh gắn nhãn sai (P07)
        cvSelect.addEventListener('change', () => {
            if (matcherAbortController) matcherAbortController.abort();
            scoreBtn.disabled = false;
            resultBox.innerHTML = `
                <div class="text-muted small py-2 d-flex align-items-center gap-2">
                    <i data-lucide="info" style="width:15px;height:15px;flex-shrink:0;"></i>
                    <span>Đã chọn CV khác. Bấm <strong>Phân tích</strong> để AI đánh giá mức độ tương thích của CV này với tin tuyển dụng.</span>
                </div>
            `;
            renderIcons();
        });

        scoreBtn.addEventListener('click', async () => {
            const resumeIdVal = cvSelect.value ? parseInt(cvSelect.value, 10) : null;

            if (matcherAbortController) matcherAbortController.abort();
            matcherAbortController = new AbortController();
            const signal = matcherAbortController.signal;
            const currentSeq = ++matcherSeq;

            scoreBtn.disabled = true;
            resultBox.innerHTML = `
                <div class="cvm-card cvm-card--center">
                    <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
                    <div class="cvm-title">Aris AI đang đối chiếu hồ sơ...</div>
                    <div class="cvm-sub">Phân tích yêu cầu, trách nhiệm JD và trích xuất bằng chứng từ CV</div>
                </div>
            `;

            try {
                const tokenEl = document.querySelector('input[name="__RequestVerificationToken"]');
                const token = tokenEl ? tokenEl.value : '';
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['RequestVerificationToken'] = token;

                const res = await fetch('/Jobs/ScoreCvForJob', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ jobId: jobId, resumeId: resumeIdVal }),
                    signal
                });

                if (currentSeq !== matcherSeq) return;

                if (!res.ok) {
                    resultBox.innerHTML = `<div class="cvm-card cvm-card--center cvm-card--danger">Không thể phân tích (HTTP ${res.status}). Vui lòng thử lại sau.</div>`;
                    return;
                }

                const json = await res.json();
                if (currentSeq !== matcherSeq) return;

                if (!json.success) {
                    if (json.status === 'no_cv') {
                        resultBox.innerHTML = `
                            <div class="cvm-card cvm-card--center">
                                <p class="mb-2">${esc(json.message || 'CV chưa có nội dung trích xuất.')}</p>
                                <a href="/Resume" class="a-btn a-btn--primary a-btn--sm">Cập nhật CV</a>
                            </div>
                        `;
                    } else if (json.status === 'vector_pending') {
                        resultBox.innerHTML = `
                            <div class="cvm-card cvm-card--center">
                                <p class="mb-2">${esc(json.message || 'Dữ liệu Vector đang được xử lý.')}</p>
                                <button type="button" class="a-btn a-btn--secondary a-btn--sm" data-retry-score-cv>Thử lại</button>
                            </div>
                        `;
                        const retryButton = resultBox.querySelector('[data-retry-score-cv]');
                        retryButton?.addEventListener('click', () => {
                            if (!scoreBtn.isConnected) {
                                retryButton.disabled = true;
                                retryButton.textContent = 'Không tìm thấy nút Phân tích. Tải lại trang.';
                                return;
                            }
                            window.setTimeout(() => scoreBtn.click(), 0);
                        });
                    } else if (json.status === 'vector_empty') {
                        resultBox.innerHTML = `
                            <div class="cvm-card cvm-card--center">
                                <p class="mb-2">${esc(json.message || 'Dữ liệu Vector của CV rỗng.')}</p>
                                <a href="/Resume" class="a-btn a-btn--primary a-btn--sm">Cập nhật CV</a>
                            </div>
                        `;
                    } else {
                        resultBox.innerHTML = `<div class="cvm-card cvm-card--center cvm-card--warn">${esc(json.message || 'Không thể thực hiện đối chiếu.')}</div>`;
                    }
                    renderIcons();
                    return;
                }

                const d = json.data;
                const hasScore = d.finalScore != null && !isNaN(d.finalScore);
                const score = hasScore ? Math.max(0, Math.min(100, Math.round(d.finalScore))) : 0;
                const tier = hasScore ? (score >= 80 ? 'high' : (score >= 60 ? 'mid' : 'low')) : 'none';
                const ringRadius = 22;
                const ringCircumference = 2 * Math.PI * ringRadius;
                const offset = ringCircumference * (1 - score / 100.0);

                let evidenceHtml = '';
                if (Array.isArray(d.evidence) && d.evidence.length > 0) {
                    evidenceHtml = `
                        <div class="cvm-evidence">
                            <div class="cvm-evidence__head">
                                <i data-lucide="quote" style="width:14px;height:14px;color:var(--brand)"></i> Bằng chứng đối chiếu (Evidence)
                            </div>
                            <div class="d-flex flex-column gap-2" style="font-size:12px;">
                                ${d.evidence.map(ev => `
                                    <div class="cvm-quote">
                                        <div><b>CV của bạn</b>${esc(tidyQuote(ev.cvQuote || ev.cv_quote) || '—')}</div>
                                        <div><b>Tin yêu cầu</b>${esc(tidyQuote(ev.jobQuote || ev.job_quote) || '—')}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }

                let skillsHtml = '';
                if ((d.matchedSkills && d.matchedSkills.length > 0) || (d.missingSkills && d.missingSkills.length > 0)) {
                    skillsHtml = `
                        <div class="skill-chip-row mt-2">
                            ${(d.matchedSkills || []).map(s => `<span class="skill-chip skill-chip-match" title="Kỹ năng khớp với CV"><i data-lucide="check"></i>${esc(s)}</span>`).join('')}
                            ${(d.missingSkills || []).map(s => `<span class="skill-chip skill-chip-missing" title="Chưa thấy trong nội dung CV đã lưu"><i data-lucide="help-circle"></i>Chưa thấy: ${esc(s)}</span>`).join('')}
                        </div>
                    `;
                }

                resultBox.innerHTML = `
                    <div class="cvm-card">
                        ${d.cvModifiedDuringEvaluation ? `
                            <div class="cvm-note">
                                <i data-lucide="alert-triangle" style="width:13px;height:13px"></i>
                                <span>CV đã được sửa đổi trong lúc đánh giá. Bạn có thể bấm <strong>Phân tích</strong> lại để cập nhật điểm mới nhất.</span>
                            </div>
                        ` : ''}
                        <div class="d-flex justify-content-between align-items-start gap-3">
                            <div>
                                <div class="cvm-title d-flex align-items-center gap-2 flex-wrap">
                                    <span>Độ phù hợp tổng quan</span>
                                    ${d.explanationStatus === 'grounded' ? '<span class="cvm-verified"><i data-lucide="shield-check"></i> Đã kiểm chứng trích dẫn</span>' : ''}
                                </div>
                                <div class="cvm-sub">Đối chiếu giữa <strong>${esc(d.resumeName || 'CV đã chọn')}</strong> và <strong>${esc(d.jobTitle)}</strong></div>
                            </div>

                            <div class="match-ring-wrap match-ring-${tier}" title="Điểm phù hợp">
                                <svg width="56" height="56" viewBox="0 0 56 56">
                                    <circle class="match-ring-track" cx="28" cy="28" r="${ringRadius}" fill="none" stroke-width="5"></circle>
                                    ${hasScore ? `<circle class="match-ring-fill" cx="28" cy="28" r="${ringRadius}" fill="none" stroke-width="5" stroke-dasharray="${ringCircumference}" style="--ring-offset:${offset}px"></circle>` : ''}
                                </svg>
                                <span class="match-ring-value" style="font-size: 11px;">${hasScore ? score + '/100' : 'Chưa có'}</span>
                            </div>
                        </div>

                        ${skillsHtml}

                        ${d.reason ? `
                            <div class="ai-reason-box mt-3">
                                <p class="mb-0">
                                    <i data-lucide="sparkles"></i><strong>Nhận định:</strong> ${esc(d.reason)}
                                </p>
                            </div>
                        ` : ''}

                        ${d.advice ? `
                            <div class="ai-advice-box mt-2">
                                <p class="mb-0">
                                    <i data-lucide="lightbulb"></i><strong>Gợi ý cải thiện:</strong> ${esc(d.advice)}
                                </p>
                            </div>
                        ` : ''}

                        ${evidenceHtml}
                    </div>
                `;
                renderIcons();
            } catch (err) {
                if (err.name === 'AbortError') return;
                if (currentSeq === matcherSeq) {
                    resultBox.innerHTML = '<div class="cvm-card cvm-card--center cvm-card--danger">Lỗi kết nối khi đối chiếu hồ sơ. Vui lòng thử lại.</div>';
                }
            } finally {
                scoreBtn.disabled = false;
            }
        });
    }

    // Trích dẫn CV đôi khi là nguyên một dòng dữ liệu kiểu "Skills: ['C#', 'PHP']" — in thành
    // "Skills: C#, PHP" cho dễ đọc; câu văn thường giữ nguyên.
    function tidyQuote(q) {
        if (!q) return '';
        return String(q).trim()
            .replace(/\[\s*((?:'[^']*'\s*,?\s*)+)\]/g, (_, inner) => inner.split(/'\s*,\s*'/).map(x => x.replace(/^'|'$/g, '').trim()).filter(Boolean).join(', '))
            .replace(/^"|"$/g, '');
    }

    window.initCvMatcher = initCvMatcher;

    // Call initCvMatcher if present on static load
    initCvMatcher(document);

    // =========================================================================
    // 3. CANDIDATE MASTER-DETAIL VIEW LOGIC
    // (Only runs on Jobs Index when #jobList is present)
    // =========================================================================
    const list = $('#jobList');
    if (!list) {
        // Details page or other views do not render #jobList; exit cleanly
        return;
    }

    const ind = $('.a-indicator', list);
    const searchInput = $('#jobSearch');
    const filterPop = $('#filterPop');
    const applyDialog = $('#applyDialog');
    const applyScrim = $('#applyScrim');
    const jdScroll = $('#jdScroll');
    const jdInner = $('#jdInner');
    const jdCompact = $('#jdCompact');
    const jdCompactLogo = $('#jdCompactLogo');
    const jdCompactTitle = $('#jdCompactTitle');

    const OPTIONS = {
        location: { label: 'Địa điểm', multi: false, values: ['TP.HCM', 'Hà Nội', 'Đà Nẵng', 'Toàn quốc'] },
        category: { label: 'Ngành nghề', multi: false, values: ['Công nghệ thông tin', 'Marketing', 'Thiết kế', 'Kinh doanh', 'Tài chính', 'Nhân sự'] },
        mode: { label: 'Hình thức', multi: false, values: ['Toàn thời gian', 'Hybrid', 'Remote', 'Bán thời gian', 'Thực tập'] },
        sort: { label: 'Sắp xếp', multi: false, values: ['Mới nhất', 'Cũ nhất'] }
    };

    const state = {
        q: searchInput?.value || '',
        location: '',
        category: '',
        mode: '',
        sort: 'newest',
        selectedId: window.__SELECTED_JOB_ID__ || null,
        skip: 10,
        take: 10,
        loading: false,
        exhausted: false
    };

    function placeInd(instant) {
        if (!ind || !state.selectedId) return;
        const target = $(`#job-${state.selectedId}`, list);
        if (target) M.indicator(ind, target, { instant });
    }

    // Load Job Details into sheet
    async function selectJob(id, opts = {}) {
        if (!id) return;
        if (matcherAbortController) matcherAbortController.abort();
        state.selectedId = id;

        $$('.job-row', list).forEach(r => {
            const isSel = parseInt(r.dataset.id, 10) === id;
            r.setAttribute('aria-selected', String(isSel));
            r.tabIndex = isSel ? 0 : -1;
        });
        placeInd(opts.quiet);

        if (isMobile()) {
            const sheet = $('#jobDetail');
            sheet.classList.add('is-mobile-open');
            M.animate(sheet, [{ transform: 'translateX(100%)' }, { transform: 'none' }], { duration: 300, easing: M.EASE_OUT });
        }

        const url = new URL(location);
        url.searchParams.set('job', id);
        history.replaceState(null, '', url);

        jdInner.classList.remove('jd-swap-in');
        jdInner.classList.add('jd-swap-out');

        try {
            const res = await fetch(`/Jobs/Details/${id}`);
            if (!res.ok) throw new Error('Details not found');
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const detailBlock = doc.querySelector('[data-job-detail]');

            if (detailBlock) {
                setTimeout(() => {
                    jdInner.innerHTML = detailBlock.outerHTML;
                    jdInner.classList.remove('jd-swap-out');
                    jdInner.classList.add('jd-swap-in');
                    jdScroll.scrollTop = 0;
                    jdCompact.classList.remove('is-shown');

                    const titleEl = jdInner.querySelector('.jd-title');
                    if (titleEl && jdCompactTitle) jdCompactTitle.textContent = titleEl.textContent;

                    const logoEl = jdInner.querySelector('.jd-head .a-logo');
                    if (logoEl && jdCompactLogo) {
                        jdCompactLogo.className = logoEl.className.replace('a-logo--56', 'a-logo--28');
                        jdCompactLogo.dataset.tone = logoEl.dataset.tone;
                        jdCompactLogo.innerHTML = logoEl.innerHTML;
                    }

                    renderIcons();
                    initCvMatcher(jdInner);
                }, 100);
            }
        } catch (e) {
            console.error('Failed to load job detail:', e);
            jdInner.classList.remove('jd-swap-out');
        }
    }

    // Keyboard navigation (J / K / A)
    document.addEventListener('keydown', (e) => {
        if (e.target.closest('input, textarea, select, [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return;
        if (!applyDialog?.hidden) return;

        const rows = $$('.job-row', list);
        if (!rows.length) return;
        const curIdx = rows.findIndex(r => parseInt(r.dataset.id, 10) === state.selectedId);
        const k = e.key.toLowerCase();

        if (k === 'j' || e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIdx = Math.min(rows.length - 1, (curIdx < 0 ? 0 : curIdx + 1));
            const targetId = parseInt(rows[nextIdx].dataset.id, 10);
            selectJob(targetId);
            rows[nextIdx].focus({ preventScroll: true });
            rows[nextIdx].scrollIntoView({ block: 'nearest' });
        } else if (k === 'k' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIdx = Math.max(0, (curIdx <= 0 ? 0 : curIdx - 1));
            const targetId = parseInt(rows[prevIdx].dataset.id, 10);
            selectJob(targetId);
            rows[prevIdx].focus({ preventScroll: true });
            rows[prevIdx].scrollIntoView({ block: 'nearest' });
        } else if (k === 'a' && state.selectedId) {
            e.preventDefault();
            openApplyDialog(state.selectedId);
        }
    });

    list?.addEventListener('click', (e) => {
        const row = e.target.closest('.job-row');
        if (row) {
            const id = parseInt(row.dataset.id, 10);
            selectJob(id);
        }
    });

    // Compact Bar Scroll Trigger
    jdScroll?.addEventListener('scroll', () => {
        const shown = jdScroll.scrollTop > 150;
        jdCompact?.classList.toggle('is-shown', shown);
    }, { passive: true });

    // Mobile Back Button
    $('#jobDetail')?.addEventListener('click', (e) => {
        if (e.target.closest('.jd-mobile-back, [data-back]')) {
            const sheet = $('#jobDetail');
            M.animate(sheet, [{ transform: 'none' }, { transform: 'translateX(100%)' }], { duration: 240, easing: M.EASE_IN, fill: 'forwards' }).finished.then(() => {
                sheet.classList.remove('is-mobile-open');
                sheet.getAnimations().forEach(a => a.cancel());
            });
        }
    });

    // Filter Chips & Popover
    let activeFilterKey = null;

    $('#filters')?.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-filter]');
        if (!chip) return;
        const key = chip.dataset.filter;
        if (filterPop.hidden || activeFilterKey !== key) {
            openFilterPopover(chip, key);
        } else {
            closeFilterPopover();
        }
    });

    $('#sortBtn')?.addEventListener('click', (e) => {
        const chip = e.currentTarget;
        if (filterPop.hidden || activeFilterKey !== 'sort') {
            openFilterPopover(chip, 'sort');
        } else {
            closeFilterPopover();
        }
    });

    function openFilterPopover(anchor, key) {
        activeFilterKey = key;
        const opt = OPTIONS[key];
        if (!opt) return;

        filterPop.innerHTML = `
            <div class="filter-pop__list">
                ${opt.values.map(v => {
                    const isChecked = state[key] === v || (key === 'mode' && state.mode === v);
                    return `
                        <label class="a-check-row" style="cursor:pointer">
                            <input type="radio" name="${key}" value="${esc(v)}" ${isChecked ? 'checked' : ''}>
                            <span style="flex:1">${esc(v)}</span>
                        </label>
                    `;
                }).join('')}
            </div>
            <div class="filter-pop__foot">
                <button class="a-btn a-btn--ghost a-btn--sm" type="button" data-reset>Bỏ chọn</button>
                <button class="a-btn a-btn--secondary a-btn--sm" type="button" data-done>Xong</button>
            </div>
        `;

        filterPop.hidden = false;
        const r = anchor.getBoundingClientRect();
        filterPop.style.top = `${r.bottom + 4}px`;
        filterPop.style.left = `${Math.min(window.innerWidth - 300, r.left)}px`;

        filterPop.onchange = (ev) => {
            const val = ev.target.value;
            if (key === 'sort') {
                state.sort = val === 'Cũ nhất' ? 'oldest' : 'newest';
                $('#sortBtn span').textContent = val;
            } else {
                state[key] = val;
                const labelEl = anchor.querySelector('span');
                if (labelEl) labelEl.textContent = val;
                anchor.setAttribute('aria-pressed', 'true');
            }
            closeFilterPopover();
            triggerSearch();
        };

        filterPop.onclick = (ev) => {
            if (ev.target.closest('[data-reset]')) {
                state[key] = '';
                const labelEl = anchor.querySelector('span');
                if (labelEl) labelEl.textContent = opt.label;
                anchor.setAttribute('aria-pressed', 'false');
                closeFilterPopover();
                triggerSearch();
            }
            if (ev.target.closest('[data-done]')) {
                closeFilterPopover();
            }
        };

        const closeEv = (ev) => {
            if (!filterPop.contains(ev.target) && !anchor.contains(ev.target)) {
                closeFilterPopover();
                document.removeEventListener('click', closeEv);
            }
        };
        setTimeout(() => document.addEventListener('click', closeEv), 10);
    }

    function closeFilterPopover() {
        filterPop.hidden = true;
        activeFilterKey = null;
    }

    // Search input
    let searchTimer = null;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.q = e.target.value.trim();
            triggerSearch();
        }, 300);
    });

    $('#clearFilters')?.addEventListener('click', () => {
        state.q = '';
        state.location = '';
        state.category = '';
        state.mode = '';
        state.sort = 'newest';
        if (searchInput) searchInput.value = '';
        $$('#filters .a-chip').forEach(c => {
            const k = c.dataset.filter;
            if (OPTIONS[k]) c.querySelector('span').textContent = OPTIONS[k].label;
            c.setAttribute('aria-pressed', 'false');
        });
        triggerSearch();
    });

    async function triggerSearch() {
        state.skip = 0;
        state.exhausted = false;
        $('#clearFilters').hidden = !state.q && !state.location && !state.category && !state.mode;

        const params = new URLSearchParams();
        if (state.q) params.set('q', state.q);
        if (state.location) params.set('location', state.location);
        if (state.category) params.set('category', state.category);
        if (state.mode) params.set('workMode', state.mode);
        if (state.sort) params.set('sort', state.sort);
        params.set('skip', 0);
        params.set('take', 10);

        try {
            const res = await fetch(`/Jobs/GetJobs?${params.toString()}`);
            if (res.headers.get('content-type')?.includes('application/json')) {
                const data = await res.json();
                if (!data.success) {
                    list.innerHTML = `<span class="a-indicator" data-axis="y" data-inset="18"></span><div class="a-empty"><div class="a-empty__title">Không tìm thấy việc làm phù hợp</div></div>`;
                    $('#resultCount').textContent = '0';
                    state.selectedId = null;
                    return;
                }
            }
            const html = await res.text();
            list.innerHTML = `<span class="a-indicator" data-axis="y" data-inset="18"></span>` + html;
            renderIcons();

            const rows = $$('.job-row', list);
            $('#resultCount').textContent = rows.length;
            if (rows.length > 0) {
                const firstId = parseInt(rows[0].dataset.id, 10);
                selectJob(firstId);
            }
            state.skip = rows.length;
        } catch (e) {
            console.error(e);
        }
    }

    // Infinite scroll with IntersectionObserver
    const sentinel = $('#listSentinel');
    if (sentinel) {
        new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !state.loading && !state.exhausted) {
                loadMoreJobs();
            }
        }, { root: isMobile() ? null : $('#listScroll'), rootMargin: '200px' }).observe(sentinel);
    }

    async function loadMoreJobs() {
        if (state.loading || state.exhausted) return;
        state.loading = true;

        const params = new URLSearchParams();
        if (state.q) params.set('q', state.q);
        if (state.location) params.set('location', state.location);
        if (state.category) params.set('category', state.category);
        if (state.mode) params.set('workMode', state.mode);
        if (state.sort) params.set('sort', state.sort);
        params.set('skip', state.skip);
        params.set('take', state.take);

        try {
            const res = await fetch(`/Jobs/GetJobs?${params.toString()}`);
            if (res.headers.get('content-type')?.includes('application/json')) {
                state.exhausted = true;
                return;
            }
            const html = await res.text();
            if (!html || !html.trim()) {
                state.exhausted = true;
                return;
            }
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            const newRows = Array.from(tmp.children);
            if (!newRows.length) {
                state.exhausted = true;
                return;
            }
            newRows.forEach(r => list.appendChild(r));
            state.skip += newRows.length;
            renderIcons();
            const totalRows = $$('.job-row', list).length;
            $('#resultCount').textContent = totalRows;
        } catch (e) {
            state.exhausted = true;
        } finally {
            state.loading = false;
        }
    }

    

    // Apply Modal
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-apply]')) {
            if (state.selectedId) openApplyDialog(state.selectedId);
        }
    });

    async function openApplyDialog(jobId, confirmedReapply = false) {
        try {
            const res = await fetch(`/JobApplications/GetApplyModal?jobId=${jobId}`);
            const data = await res.json();
            if (!data.success) {
                M.toast(data.message || 'Không thể ứng tuyển việc này.', { tone: 'danger' });
                return;
            }

            if (data.alreadyApplied && !confirmedReapply) {
                const count = Math.max(1, Number(data.applicationCount) || 1);
                applyDialog.innerHTML = `
                    <div class="a-dialog__head">
                        <h2 class="a-dialog__title" id="applyTitle">Nộp lại hồ sơ?</h2>
                        <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-close aria-label="Đóng"><i data-lucide="x"></i></button>
                    </div>
                    <div class="a-dialog__body">
                        <p style="margin:0">Bạn đã có ${count} đơn chưa rút cho công việc này. Đơn mới sẽ hiện riêng với nhà tuyển dụng, vì vậy chỉ tiếp tục khi CV hoặc thông tin ứng tuyển của bạn đã thay đổi đáng kể.</p>
                    </div>
                    <div class="a-dialog__foot">
                        <button class="a-btn a-btn--ghost" type="button" data-close>Quay lại</button>
                        <button class="a-btn a-btn--sunset" type="button" id="confirmReapplyBtn">Tiếp tục nộp lại</button>
                    </div>`;
                applyDialog.querySelector('#confirmReapplyBtn')?.addEventListener('click', () => openApplyDialog(jobId, true));
                renderIcons();
                M.openDialog(applyDialog, applyScrim);
                return;
            }

            const resumes = data.resumes || [];
            const screeningQuestions = data.screeningQuestions || [];
            const jobRow = $(`#job-${jobId}`, list);
            const title = jobRow?.querySelector('.job-row__title')?.textContent || 'Công việc';
            const company = (jobRow?.querySelector('.job-row__company')?.textContent || '').trim();
            const logo = jobRow?.querySelector('.a-logo');

            applyDialog.innerHTML = `
                <div class="a-dialog__head">
                    <h2 class="a-dialog__title" id="applyTitle">Ứng tuyển</h2>
                    <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-close aria-label="Đóng"><i data-lucide="x"></i></button>
                </div>
                <div class="a-dialog__body" id="applyBody">
                    <div class="apply-job">
                        ${logo ? logo.outerHTML : ''}
                        <div>
                            <div class="apply-job__title">${esc(title)}</div>
                            <div class="apply-job__sub">${esc(company)}</div>
                        </div>
                    </div>

                    <div class="a-label" id="cvLabel">Chọn CV gửi kèm</div>
                    ${resumes.length === 0 ? `
                        <div class="apply-nocv">
                            <div>Bạn chưa có CV nào trong tài khoản.</div>
                            <a href="/Resume" target="_blank" class="a-btn a-btn--secondary a-btn--sm">Tạo CV mới</a>
                        </div>
                    ` : `
                        <div class="cv-pick" role="radiogroup" aria-labelledby="cvLabel">
                            ${resumes.map((cv, i) => `
                                <label class="cv-card">
                                    <input type="radio" name="cv" value="${cv.id}" ${i === 0 ? 'checked' : ''}>
                                    <span class="cv-card__thumb" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
                                    <span class="cv-card__text"><span class="cv-card__name">${esc(cv.name || 'CV')}</span></span>
                                    <span class="cv-card__radio" aria-hidden="true"></span>
                                </label>
                            `).join('')}
                        </div>
                    `}

                    ${screeningQuestions.length > 0 ? `
                        <div class="screening-section">
                            <div class="a-label">Câu hỏi của nhà tuyển dụng</div>
                            ${screeningQuestions.map(q => `
                                <div class="a-field">
                                    <label class="a-label">${esc(q)} *</label>
                                    <textarea class="a-textarea screening-answer" rows="2" placeholder="Câu trả lời của bạn…" required></textarea>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    <div class="a-field">
                        <label class="a-label" for="applyNote">Lời nhắn cho nhà tuyển dụng <span class="apply-optional">(không bắt buộc)</span></label>
                        <textarea class="a-textarea" id="applyNote" rows="3" maxlength="500" placeholder="Vài dòng giới thiệu, hoặc ngày bạn có thể bắt đầu…"></textarea>
                    </div>
                </div>
                <div class="a-dialog__foot" id="applyFoot">
                    <button class="a-btn a-btn--ghost" type="button" data-close>Huỷ</button>
                    <button class="a-btn a-btn--sunset" type="button" id="applySubmitBtn" ${resumes.length === 0 ? 'disabled' : ''}>Gửi hồ sơ</button>
                </div>
            `;
            renderIcons();

            applyDialog.querySelector('#applySubmitBtn')?.addEventListener('click', async (e) => {
                const cvId = applyDialog.querySelector('input[name="cv"]:checked')?.value;
                if (!cvId) return;

                const answers = [];
                let missing = false;
                applyDialog.querySelectorAll('.screening-answer').forEach(el => {
                    const val = el.value.trim();
                    if (!val) missing = true;
                    answers.push(val);
                });

                if (missing) {
                    M.toast('Vui lòng trả lời đầy đủ câu hỏi của nhà tuyển dụng.', { tone: 'danger' });
                    return;
                }

                const btn = e.currentTarget;
                M.morphButton(btn, 'loading');

                try {
                    const submitRes = await fetch(`/JobApplications/Apply?jobId=${jobId}`, {
                        method: 'POST',
                        headers: (() => {
                            const headers = { 'Content-Type': 'application/json' };
                            const token = document.querySelector('#applyAntiforgeryForm input[name="__RequestVerificationToken"]')?.value;
                            if (token) headers.RequestVerificationToken = token;
                            return headers;
                        })(),
                        body: JSON.stringify({
                            ResumeId: parseInt(cvId, 10),
                            CoverLetter: applyDialog.querySelector('#applyNote')?.value.trim() || '',
                            ScreeningAnswers: answers
                        })
                    });
                    const r = await submitRes.json();
                    if (r.success) {
                        M.morphButton(btn, 'success', { hold: true });
                        applyDialog.querySelector('#applyBody').innerHTML = `
                            <div class="apply-done">
                                <span class="apply-done__mark"><i data-lucide="check"></i></span>
                                <div class="apply-done__title">Đã gửi hồ sơ</div>
                                <p class="apply-done__text">${esc(company || 'Nhà tuyển dụng')} đã nhận được đơn của bạn. Mỗi khi đơn được xem hay có lịch phỏng vấn, Aris sẽ báo cho bạn.</p>
                            </div>
                        `;
                        applyDialog.querySelector('#applyFoot').innerHTML = `
                            <a class="a-btn a-btn--ghost" href="/JobApplications/MyApplications">Xem đơn ứng tuyển</a>
                            <button class="a-btn a-btn--ink" type="button" data-close>Xong</button>
                        `;
                        renderIcons();

                        const mainBtn = $('#jdActions [data-apply]');
                        if (mainBtn) {
                            mainBtn.outerHTML = '<span class="jd-applied"><i data-lucide="check-circle-2"></i>Đã ứng tuyển · vừa xong</span>';
                            renderIcons();
                        }
                        const row = $(`#job-${jobId}`, list);
                        if (row) row.classList.add('is-applied');
                    } else {
                        M.morphButton(btn, 'error');
                        M.toast(r.message || 'Lỗi khi gửi hồ sơ.', { tone: 'danger' });
                    }
                } catch (err) {
                    M.morphButton(btn, 'error');
                    M.toast('Lỗi kết nối.', { tone: 'danger' });
                }
            });

            M.openDialog(applyDialog, applyScrim);
        } catch (e) {
            console.error(e);
            M.toast('Không thể mở form ứng tuyển. Vui lòng thử lại.', { tone: 'danger' });
        }
    }

    function closeApply() {
        M.closeDialog(applyDialog, applyScrim);
    }

    applyDialog?.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeApply(); });
    applyScrim?.addEventListener('click', closeApply);

    // =========================================================================
    // 3. CANDIDATE AI RECOMMENDATIONS TAB & STATE
    // =========================================================================
    const tabAllJobs = $('#tabAllJobs');
    const tabAiJobs = $('#tabAiJobs');
    const paneAllJobs = $('#paneAllJobs');
    const paneAiJobs = $('#paneAiJobs');
    const aiContent = $('#aiRecommendationsContent');
    const refreshAiBtn = $('#refreshAiBtn');

    let aiLoaded = false;
    let aiAbortController = null;
    let aiSeq = 0;

    function switchJobsTab(tab) {
        if (tab === 'ai') {
            tabAiJobs?.classList.add('active');
            tabAiJobs?.classList.remove('a-btn--ghost');
            tabAiJobs?.setAttribute('aria-selected', 'true');

            tabAllJobs?.classList.remove('active');
            tabAllJobs?.classList.add('a-btn--ghost');
            tabAllJobs?.setAttribute('aria-selected', 'false');

            paneAiJobs?.classList.remove('d-none');
            paneAiJobs?.classList.add('d-flex');

            paneAllJobs?.classList.add('d-none');
            paneAllJobs?.classList.remove('d-flex');

            if (!aiLoaded) {
                loadAiRecommendations();
            }
        } else {
            tabAllJobs?.classList.add('active');
            tabAllJobs?.classList.remove('a-btn--ghost');
            tabAllJobs?.setAttribute('aria-selected', 'true');

            tabAiJobs?.classList.remove('active');
            tabAiJobs?.classList.add('a-btn--ghost');
            tabAiJobs?.setAttribute('aria-selected', 'false');

            paneAllJobs?.classList.remove('d-none');
            paneAllJobs?.classList.add('d-flex');

            paneAiJobs?.classList.add('d-none');
            paneAiJobs?.classList.remove('d-flex');

            placeInd();
        }
    }

    tabAllJobs?.addEventListener('click', () => switchJobsTab('all'));
    tabAiJobs?.addEventListener('click', () => switchJobsTab('ai'));

    async function loadAiRecommendations(force = false) {
        if (!aiContent) return;
        if (!force && aiLoaded && aiContent.innerHTML.trim().length > 0) return;

        if (aiAbortController) aiAbortController.abort();
        aiAbortController = new AbortController();
        const signal = aiAbortController.signal;
        const currentSeq = ++aiSeq;

        if (refreshAiBtn) {
            refreshAiBtn.classList.add('disabled');
            refreshAiBtn.disabled = true;
        }

        aiContent.innerHTML = `
            <div class="p-4 text-center text-muted" style="min-height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div class="spinner-border spinner-border-sm text-primary mb-2" role="status" style="width: 2rem; height: 2rem;"></div>
                <div class="cvm-title mb-1">Aris AI đang tìm kiếm việc làm phù hợp...</div>
                <p class="small text-muted mb-0">Đang phân tích vector kỹ năng và kinh nghiệm từ CV của bạn</p>
            </div>
        `;

        try {
            const url = '/Jobs/GetAiRecommendations?topK=5' + (force ? '&force=true' : '');
            const res = await fetch(url, { signal });
            if (currentSeq !== aiSeq) return;

            if (!res.ok) {
                aiContent.innerHTML = `
                    <div class="p-4 text-center text-danger">
                        <p class="mb-1">Không thể kết nối dịch vụ gợi ý việc làm (HTTP ${res.status}).</p>
                        <button type="button" class="a-btn a-btn--secondary a-btn--sm mt-2" onclick="refreshAiRecommendations()">Thử lại</button>
                    </div>
                `;
                return;
            }

            const html = await res.text();
            if (currentSeq !== aiSeq) return;

            aiContent.innerHTML = html;
            aiLoaded = true;
            renderIcons();

            // Check suggested category
            const suggestedCatEl = aiContent.querySelector('#ai-suggested-category');
            if (suggestedCatEl && suggestedCatEl.dataset.category) {
                const cat = suggestedCatEl.dataset.category;
                console.log('AI recommended top category:', cat);
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            if (currentSeq === aiSeq) {
                aiContent.innerHTML = `
                    <div class="p-4 text-center text-danger">
                        <p class="mb-1">Lỗi kết nối khi tải gợi ý việc làm.</p>
                        <button type="button" class="a-btn a-btn--secondary a-btn--sm mt-2" onclick="refreshAiRecommendations()">Thử lại</button>
                    </div>
                `;
            }
        } finally {
            if (refreshAiBtn) {
                refreshAiBtn.classList.remove('disabled');
                refreshAiBtn.disabled = false;
            }
        }
    }

    window.refreshAiRecommendations = () => loadAiRecommendations(true);
    refreshAiBtn?.addEventListener('click', () => loadAiRecommendations(true));

    // Handle clicks inside AI recommendations (selectJob on click)
    aiContent?.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        const link = e.target.closest('a[href*="/Jobs/Details/"]');
        const card = e.target.closest('.ai-recommend-card');
        let jobId = null;
        if (link) {
            const m = link.getAttribute('href').match(/\/Jobs\/Details\/(\d+)/);
            if (m) jobId = parseInt(m[1], 10);
        } else if (card) {
            const cardLink = card.querySelector('a[href*="/Jobs/Details/"]');
            if (cardLink) {
                const m = cardLink.getAttribute('href').match(/\/Jobs\/Details\/(\d+)/);
                if (m) jobId = parseInt(m[1], 10);
            }
        }

        if (jobId) {
            e.preventDefault();
            selectJob(jobId);
        }
    });

    // Support ?tab=ai in URL
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('tab') === 'ai' || urlParams.get('view') === 'ai') {
        switchJobsTab('ai');
    }

    // Initial Selection
    // Điện thoại: chỉ mở sẵn chi tiết khi URL có ?job= (vào trang thì thấy danh sách trước)
    const initialJob = new URLSearchParams(location.search).get('job') || (isMobile() ? null : window.__SELECTED_JOB_ID__);
    if (initialJob) {
        selectJob(parseInt(initialJob, 10), { quiet: true });
    }
})();
