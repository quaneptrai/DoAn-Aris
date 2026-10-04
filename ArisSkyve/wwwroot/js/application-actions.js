/* =============================================================================
   ARIS LINE — Xử lý Đơn ứng tuyển (V7 + quy trình tuyển dụng 04/10/2026)
   Lọc tab, rút đơn, xác nhận / xin đổi lịch phỏng vấn (kèm giờ đề xuất), trả lời offer.
   Sau mỗi thao tác tải lại danh sách tại chỗ (partial) để "Bước tiếp theo" luôn đúng với máy chủ.
   File: wwwroot/js/application-actions.js
   ============================================================================= */
(function () {
    'use strict';

    const M = window.ArisMotion || {
        openDialog: (d, s) => { if (s) s.hidden = false; if (d) d.hidden = false; },
        closeDialog: (d, s) => { if (s) s.hidden = true; if (d) d.hidden = true; return Promise.resolve(); },
        toast: (msg, opts) => { if (window.showToast) window.showToast(msg, opts?.tone); else alert(msg); },
        removeFrom: (parent, el) => { if (el) el.remove(); return Promise.resolve(); }
    };

    function esc(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function renderIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function antiForgeryToken() {
        const input = document.querySelector('input[name="__RequestVerificationToken"]');
        return input ? input.value : '';
    }

    async function postForm(url, fields) {
        const body = new URLSearchParams();
        Object.entries(fields).forEach(([k, v]) => {
            if (Array.isArray(v)) v.forEach(x => body.append(k, x));
            else if (v != null) body.append(k, v);
        });
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'RequestVerificationToken': antiForgeryToken()
            },
            body: body.toString()
        });
        if (!res.ok) return { success: false, message: `Máy chủ trả lỗi (HTTP ${res.status}).` };
        return res.json();
    }

    // ---------------------------------------------------------------------
    // Lọc theo tab
    // ---------------------------------------------------------------------
    let currentTab = 'all';

    function applyTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.app-card').forEach((card) => {
            if (tab === 'all') card.hidden = false;
            else if (tab === 'todo') card.hidden = card.dataset.todo !== '1';
            else card.hidden = card.dataset.category !== tab;
        });
    }

    document.addEventListener('click', (e) => {
        const segBtn = e.target.closest('#appFilterSeg .a-seg__btn');
        if (!segBtn) return;
        const seg = segBtn.closest('#appFilterSeg');
        seg.querySelectorAll('.a-seg__btn').forEach((b) => b.setAttribute('aria-selected', String(b === segBtn)));
        if (M.segment) M.segment(seg, segBtn);
        applyTab(segBtn.dataset.tab);
    });

    // Tải lại danh sách + số đếm, giữ tab đang chọn. Hộp thoại rút đơn nằm ngoài vùng thay thế.
    async function refreshList(focusId) {
        try {
            const res = await fetch('/JobApplications/MyApplications', { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            if (!res.ok) throw new Error();
            const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
            const nextFilter = doc.getElementById('appFilter');
            const nextList = doc.getElementById('appList');
            const filter = document.getElementById('appFilter');
            const list = document.getElementById('appList');
            if (nextFilter && filter) {
                filter.replaceWith(nextFilter);
                nextFilter.querySelectorAll('.a-seg__btn').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === currentTab)));
            }
            if (nextList && list) list.replaceWith(nextList);
            const token = doc.querySelector('input[name="__RequestVerificationToken"]');
            const mine = document.querySelector('input[name="__RequestVerificationToken"]');
            if (token && mine) mine.value = token.value;
            applyTab(currentTab);
            renderIcons();
            if (focusId) flashCard(focusId, false);
        } catch {
            window.location.reload();
        }
    }

    function flashCard(id, scroll) {
        const card = document.getElementById(`app-${id}`);
        if (!card) return;
        if (scroll) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.remove('is-flash');
        void card.offsetWidth;
        card.classList.add('is-flash');
    }

    // ---------------------------------------------------------------------
    // Hộp thoại trả lời (dựng một lần, dùng cho xin đổi lịch và offer)
    // ---------------------------------------------------------------------
    let dlg = null, scrim = null, onSubmit = null;

    function ensureDialog() {
        if (dlg) return;
        scrim = document.createElement('div');
        scrim.className = 'a-scrim';
        scrim.hidden = true;
        dlg = document.createElement('div');
        dlg.className = 'a-dialog app-respond-dialog';
        dlg.setAttribute('role', 'dialog');
        dlg.setAttribute('aria-modal', 'true');
        dlg.setAttribute('aria-labelledby', 'appRespondTitle');
        dlg.hidden = true;
        dlg.innerHTML = `
          <div class="a-dialog__head">
            <h2 class="a-dialog__title" id="appRespondTitle"></h2>
            <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-respond-close aria-label="Đóng"><i data-lucide="x"></i></button>
          </div>
          <div class="a-dialog__body" id="appRespondBody"></div>
          <div class="a-dialog__foot">
            <button type="button" class="a-btn a-btn--ghost" data-respond-close>Huỷ</button>
            <button type="button" class="a-btn a-btn--primary" id="appRespondSubmit"></button>
          </div>`;
        document.body.append(scrim, dlg);
        scrim.addEventListener('click', closeDialog);
        dlg.addEventListener('click', (e) => { if (e.target.closest('[data-respond-close]')) closeDialog(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dlg && !dlg.hidden) closeDialog(); });
        dlg.querySelector('#appRespondSubmit').addEventListener('click', async () => {
            if (!onSubmit) return;
            const btn = dlg.querySelector('#appRespondSubmit');
            btn.disabled = true;
            try {
                await onSubmit();
            } catch {
                M.toast('Lỗi kết nối máy chủ.', { tone: 'danger' });
            } finally {
                btn.disabled = false;
            }
        });
    }

    function openDialog(title, bodyHtml, submitLabel, submitTone, handler, origin) {
        ensureDialog();
        dlg.querySelector('#appRespondTitle').textContent = title;
        dlg.querySelector('#appRespondBody').innerHTML = bodyHtml;
        const btn = dlg.querySelector('#appRespondSubmit');
        btn.textContent = submitLabel;
        btn.className = `a-btn ${submitTone === 'danger' ? 'a-btn--danger' : 'a-btn--primary'}`;
        onSubmit = handler;
        M.openDialog(dlg, scrim, origin);
        renderIcons();
        setTimeout(() => dlg.querySelector('textarea, input')?.focus(), 60);
    }

    function closeDialog() {
        onSubmit = null;
        if (dlg) M.closeDialog(dlg, scrim);
    }

    // Giá trị mặc định cho ô giờ đề xuất: ngày làm việc kế tiếp 9:00 và 14:00, ngày sau đó 9:00.
    function defaultSlots() {
        const pad = (n) => String(n).padStart(2, '0');
        const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        const nextWorkday = (from) => {
            const d = new Date(from);
            do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
            return d;
        };
        const d1 = nextWorkday(new Date());
        const d2 = nextWorkday(d1);
        return [
            fmt(new Date(d1.getFullYear(), d1.getMonth(), d1.getDate(), 9, 0)),
            fmt(new Date(d1.getFullYear(), d1.getMonth(), d1.getDate(), 14, 0)),
            fmt(new Date(d2.getFullYear(), d2.getMonth(), d2.getDate(), 9, 0))
        ];
    }

    function openDeclineInterview(id, title, origin) {
        const slots = defaultSlots();
        openDialog('Báo bận và đề xuất giờ khác', `
            <p class="a-help" style="margin:0">Nhà tuyển dụng nhận lý do và chốt lại một trong các khung giờ bạn chọn chỉ với một lần bấm${title ? ` cho "${esc(title)}"` : ''}.</p>
            <div class="a-field">
              <label class="a-label" for="appDeclineReason">Lý do (không bắt buộc)</label>
              <textarea class="a-textarea" id="appDeclineReason" rows="2" maxlength="500" placeholder="VD: Trùng lịch thi cuối kỳ"></textarea>
            </div>
            <div class="a-field">
              <div class="a-label">Giờ bạn có thể tham gia (tối đa 3, giờ Việt Nam)</div>
              <div class="app-slots">
                ${slots.map((v, i) => `<input type="datetime-local" class="a-input" data-slot value="${v}" aria-label="Khung giờ ${i + 1}">`).join('')}
              </div>
              <div class="a-help">Xoá ô nào không dùng. Khung giờ phải sau thời điểm hiện tại ít nhất 30 phút.</div>
            </div>`,
            'Gửi đề xuất', 'primary', async () => {
                const reason = dlg.querySelector('#appDeclineReason').value.trim();
                const proposed = Array.from(dlg.querySelectorAll('[data-slot]')).map(i => i.value).filter(Boolean);
                const r = await postForm('/JobApplications/RespondToInterview', { applicationId: id, accept: 'false', reason, proposedSlots: proposed });
                if (!r.success) { M.toast(r.message || 'Không gửi được phản hồi.', { tone: 'danger' }); return; }
                closeDialog();
                M.toast(r.proposedSlots && r.proposedSlots.length
                    ? `Đã gửi ${r.proposedSlots.length} khung giờ cho nhà tuyển dụng.`
                    : 'Đã báo bận. Nhà tuyển dụng sẽ hẹn lại.', { tone: 'success' });
                refreshList(id);
            }, origin);
    }

    function openAcceptOffer(id, title, origin) {
        openDialog('Nhận offer?', `
            <p style="margin:0">Bạn xác nhận nhận offer${title ? ` "<b>${esc(title)}</b>"` : ''}. Đơn chuyển sang "Đã nhận việc" và nhà tuyển dụng được báo ngay.</p>
            <p class="a-help" style="margin:0">Các đơn khác của bạn vẫn giữ nguyên — hãy rút những đơn không còn muốn theo.</p>`,
            'Nhận offer', 'primary', async () => {
                const r = await postForm('/JobApplications/RespondToOffer', { applicationId: id, accept: 'true' });
                if (!r.success) { M.toast(r.message || 'Không gửi được phản hồi.', { tone: 'danger' }); return; }
                closeDialog();
                M.toast('Chúc mừng! Bạn đã nhận offer.', { tone: 'success' });
                refreshList(id);
            }, origin);
    }

    function openDeclineOffer(id, title, origin) {
        openDialog('Từ chối offer', `
            <p class="a-help" style="margin:0">Lý do giúp nhà tuyển dụng điều chỉnh${title ? ` offer "${esc(title)}"` : ''} — họ có thể gửi lại offer mới.</p>
            <div class="a-field">
              <label class="a-label" for="appOfferReason">Lý do (không bắt buộc)</label>
              <textarea class="a-textarea" id="appOfferReason" rows="3" maxlength="500" placeholder="VD: Mức lương chưa phù hợp, đã nhận nơi khác..."></textarea>
            </div>`,
            'Từ chối offer', 'danger', async () => {
                const reason = dlg.querySelector('#appOfferReason').value.trim();
                const r = await postForm('/JobApplications/RespondToOffer', { applicationId: id, accept: 'false', reason });
                if (!r.success) { M.toast(r.message || 'Không gửi được phản hồi.', { tone: 'danger' }); return; }
                closeDialog();
                M.toast('Đã gửi phản hồi từ chối offer.', { tone: 'success' });
                refreshList(id);
            }, origin);
    }

    async function acceptInterview(id, btn) {
        btn.disabled = true;
        try {
            const r = await postForm('/JobApplications/RespondToInterview', { applicationId: id, accept: 'true' });
            if (!r.success) { M.toast(r.message || 'Không xác nhận được lịch.', { tone: 'danger' }); return; }
            M.toast('Đã xác nhận lịch phỏng vấn. Aris sẽ nhắc bạn trước 24 giờ và 1 giờ.', { tone: 'success' });
            refreshList(id);
        } catch {
            M.toast('Lỗi kết nối máy chủ.', { tone: 'danger' });
        } finally {
            btn.disabled = false;
        }
    }

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-app-act]');
        if (!btn) return;
        e.preventDefault();
        const id = btn.dataset.id;
        const title = btn.dataset.title || '';
        switch (btn.dataset.appAct) {
            case 'acceptInterview': acceptInterview(id, btn); break;
            case 'declineInterview': openDeclineInterview(id, title, btn); break;
            case 'acceptOffer': openAcceptOffer(id, title, btn); break;
            case 'declineOffer': openDeclineOffer(id, title, btn); break;
        }
    });

    // ---------------------------------------------------------------------
    // Rút đơn ứng tuyển với hộp thoại xác nhận Aris V7
    // ---------------------------------------------------------------------
    let pendingWithdrawId = null;
    const dialog = document.getElementById('withdrawDialog');
    const wScrim = document.getElementById('withdrawScrim');
    const titleEl = document.getElementById('withdrawTitle');

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.withdraw-application-btn');
        if (!btn) return;

        pendingWithdrawId = btn.dataset.id;
        const jobTitle = btn.dataset.title || 'công việc này';
        if (titleEl) {
            titleEl.textContent = `Rút đơn ứng tuyển ${jobTitle}?`;
        }

        M.openDialog(dialog, wScrim);
        document.getElementById('cancelWithdrawBtn')?.focus();
    });

    document.getElementById('cancelWithdrawBtn')?.addEventListener('click', () => {
        pendingWithdrawId = null;
        M.closeDialog(dialog, wScrim);
    });

    wScrim?.addEventListener('click', () => {
        pendingWithdrawId = null;
        M.closeDialog(dialog, wScrim);
    });

    document.getElementById('confirmWithdrawBtn')?.addEventListener('click', async () => {
        if (!pendingWithdrawId) return;

        const id = pendingWithdrawId;
        await M.closeDialog(dialog, wScrim);

        try {
            const data = await postForm('/JobApplications/Withdraw', { applicationId: id });
            if (data.success) {
                M.toast('Đã rút đơn ứng tuyển thành công.', { tone: 'success' });
                refreshList();
            } else {
                M.toast(data.message || 'Không thể rút đơn.', { tone: 'danger' });
            }
        } catch (err) {
            M.toast('Lỗi kết nối máy chủ.', { tone: 'danger' });
        } finally {
            pendingWithdrawId = null;
        }
    });

    // Mở từ thông báo (/JobApplications/MyApplications?app=ID): cuộn tới đúng đơn; đơn bị từ
    // chối thì mở luôn ngăn "Vì sao?" (lý do + lộ trình kỹ năng).
    function openDeepLink() {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const tabBtn = tab && document.querySelector(`#appFilterSeg .a-seg__btn[data-tab="${CSS.escape(tab)}"]`);
        if (tabBtn) tabBtn.click();
        const id = params.get('app');
        if (!id) return;
        const card = document.getElementById(`app-${id}`);
        if (!card) return;
        flashCard(id, true);
        const insight = card.querySelector('[data-insight-app]');
        if (insight && card.querySelector('.app-reject') && window.ArisMatchInsight) {
            setTimeout(() => window.ArisMatchInsight.openForApplication(id, insight), 500);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        renderIcons();
        openDeepLink();
    });
})();
