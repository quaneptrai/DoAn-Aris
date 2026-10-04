/* =============================================================================
   ARIS — Đăng nhập / Đăng ký (bản "Aris Night", 27/09/2026)
   Views/Account/Login.cshtml · Register.cshtml · CSS: wwwroot/css/pages/auth.css
   - Kiểm tra email ngay tại chỗ, nút gửi có trạng thái "đang gửi"
   - Đăng ký: chọn vai trò (ứng viên / nhà tuyển dụng) → cập nhật form + liên kết Google/Facebook
   ============================================================================= */
(function () {
    'use strict';
    const M = window.ArisMotion || { shake: () => {} };
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const form = $('#authForm');
    const email = $('#authEmail');
    const hint = $('#authEmailHint');
    const submit = $('#authSubmit');

    if (form && email) {
        const check = (show) => {
            const ok = EMAIL.test(email.value.trim());
            if (show) {
                hint.hidden = ok;
                email.setAttribute('aria-invalid', String(!ok));
                email.closest('.auth-input')?.classList.toggle('is-invalid', !ok);
            }
            return ok;
        };
        /* "Hợp lệ" hiện ngay khi gõ đúng định dạng (như chữ "Available" trong mẫu Stitch) */
        const ok = $('#authEmailOk');
        const syncOk = () => { if (ok) ok.hidden = !EMAIL.test(email.value.trim()); };
        email.addEventListener('blur', () => { if (email.value.trim()) check(true); });
        email.addEventListener('input', () => { if (!hint.hidden) check(true); syncOk(); });
        syncOk();
        form.addEventListener('submit', (e) => {
            if (!check(true)) {
                e.preventDefault();
                M.shake(email.closest('.auth-input'));
                email.focus();
                return;
            }
            submit.disabled = true;
            submit.classList.add('is-loading');
            submit.innerHTML = '<span class="auth-spin" aria-hidden="true"></span><span>Đang gửi liên kết…</span>';
        });
    }

    /* Đăng ký: vai trò */
    const roles = $('#authRoles');
    if (roles) {
        const intent = $('#authIntent');
        const label = $('#authEmailLabel');
        const apply = (v) => {
            if (intent) intent.value = v;
            if (label) label.textContent = v === 'business' ? 'Email công việc' : 'Email';
            if (email) email.placeholder = v === 'business' ? 'tuyendung@congty.com' : 'ten@vidu.com';
            $$('[data-social]').forEach((a) => {
                const url = new URL(a.href, location.origin);
                url.searchParams.set('intent', v);
                a.href = url.pathname + url.search;
            });
            const u = new URL(location.href);
            u.searchParams.set('intent', v);
            history.replaceState(null, '', u.pathname + u.search);
        };
        roles.addEventListener('change', (e) => {
            const r = e.target.closest('input[name="roleChoice"]');
            if (!r) return;
            apply(r.value);
            if (window.ArisMotion && window.ArisMotion.pulse) window.ArisMotion.pulse(r.closest('.auth-role'), 1.02);
        });
    }
})();
