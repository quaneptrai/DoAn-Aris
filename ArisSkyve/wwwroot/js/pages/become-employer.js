/* =============================================================================
   ARIS LINE — Đăng tuyển trên Aris (3 bước + xem trước trực tiếp)
   File: wwwroot/js/pages/become-employer.js
   ============================================================================= */
(function () {
    'use strict';

    const M = window.ArisMotion || {
        toast: (msg) => alert(msg),
        morphButton: () => {},
        shake: () => {}
    };
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

    const form = $('#beForm');
    if (!form) return;

    const nextBtn = $('#beNext');
    const backBtn = $('#beBack');
    const cancelBtn = $('#beCancel');
    const stages = $$('.be-stage', form);
    const steps = $$('#beSteps .be-step');
    const card = $('#beCard');
    let step = 1;
    let maxReached = 1;
    let logoFile = null;
    let logoUrl = null;
    let submitting = false;

    const f = (name) => form.elements[name];
    const val = (name) => {
        const el = f(name);
        if (!el) return '';
        if (el instanceof RadioNodeList) return el.value || '';
        return (el.value || '').trim();
    };

    function renderIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }

    function setError(name, msg) {
        const box = form.querySelector(`[data-error-for="${name}"]`);
        if (box) box.textContent = msg || '';
        const input = f(name);
        if (input && input.classList) input.classList.toggle('is-invalid', !!msg);
        return !msg;
    }

    // ---------- Kiểm tra từng bước ----------
    function validate(s) {
        let ok = true;
        if (s === 1) {
            ok = setError('CompanyName', val('CompanyName').length < 2 ? 'Nhập tên doanh nghiệp (ít nhất 2 ký tự).' : '') && ok;
            ok = setError('Industry', !val('Industry') ? 'Chọn hoặc nhập lĩnh vực.' : '') && ok;
            const y = val('FoundedYear');
            const now = new Date().getFullYear();
            ok = setError('FoundedYear', y && (!/^\d{4}$/.test(y) || +y < 1900 || +y > now) ? `Năm từ 1900 đến ${now}.` : '') && ok;
            const tax = val('TaxCode');
            ok = setError('TaxCode', tax && !/^\d{10}(-\d{3})?$/.test(tax) ? 'Mã số thuế gồm 10 chữ số (chi nhánh: 0101234567-001).' : '') && ok;
        }
        if (s === 3) {
            ok = setError('Agree', !$('#beAgree').checked ? 'Đánh dấu xác nhận để tiếp tục.' : '') && ok;
        }
        return ok;
    }

    // ---------- Chuyển bước ----------
    function go(target) {
        if (target < 1 || target > 3) return;
        if (target > step) {
            for (let s = step; s < target; s++) {
                if (!validate(s)) {
                    M.shake && M.shake(nextBtn);
                    const firstBad = form.querySelector('.is-invalid');
                    firstBad && firstBad.focus();
                    return;
                }
            }
        }
        step = target;
        maxReached = Math.max(maxReached, step);
        stages.forEach(st => {
            const on = +st.dataset.stage === step;
            st.hidden = !on;
            st.classList.toggle('is-active', on);
        });
        steps.forEach(li => {
            const n = +li.dataset.step;
            li.classList.toggle('is-current', n === step);
            li.classList.toggle('is-done', n < step);
            const b = li.querySelector('button');
            if (b) b.disabled = n > maxReached;
        });
        backBtn.hidden = step === 1;
        cancelBtn.hidden = step !== 1;
        const label = nextBtn.querySelector('.a-btn__label') || nextBtn;
        label.textContent = step === 3 ? 'Chuyển sang nhà tuyển dụng' : 'Tiếp tục';
        if (step === 3) buildReview();
        const first = stages[step - 1].querySelector('input:not([type=hidden]):not([type=file]), textarea');
        if (first && step !== 3) setTimeout(() => first.focus({ preventScroll: true }), 60);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    nextBtn.addEventListener('click', () => (step < 3 ? go(step + 1) : submit()));
    backBtn.addEventListener('click', () => go(step - 1));
    $('#beSteps').addEventListener('click', (e) => {
        const b = e.target.closest('[data-goto]');
        if (b && !b.disabled) go(+b.dataset.goto);
    });
    form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'checkbox') {
            e.preventDefault();
            nextBtn.click();
        }
    });

    // ---------- Chọn nhanh lĩnh vực ----------
    const chips = $$('#beIndustryChips .be-chip');
    function syncChips() {
        const v = val('Industry').toLowerCase();
        chips.forEach(c => c.setAttribute('aria-selected', String(c.dataset.value.toLowerCase() === v)));
    }
    $('#beIndustryChips').addEventListener('click', (e) => {
        const c = e.target.closest('.be-chip');
        if (!c) return;
        f('Industry').value = c.dataset.value;
        setError('Industry', '');
        syncChips();
        updatePreview();
    });

    // ---------- Logo ----------
    const drop = $('#beDrop');
    const logoInput = $('#beLogo');
    const dropPreview = $('#beDropPreview');
    const clearBtn = $('#beLogoClear');

    function takeLogo(file) {
        if (!file) return;
        if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return setError('Logo', 'Chỉ nhận PNG, JPG hoặc WEBP.');
        if (file.size > 5 * 1024 * 1024) return setError('Logo', 'Logo phải nhỏ hơn 5MB.');
        setError('Logo', '');
        logoFile = file;
        if (logoUrl) URL.revokeObjectURL(logoUrl);
        logoUrl = URL.createObjectURL(file);
        dropPreview.innerHTML = `<img src="${logoUrl}" alt="">`;
        clearBtn.hidden = false;
        updatePreview();
    }
    logoInput.addEventListener('change', () => takeLogo(logoInput.files[0]));
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); logoInput.click(); } });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (e) => takeLogo(e.dataTransfer.files[0]));
    clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        logoFile = null;
        logoInput.value = '';
        dropPreview.innerHTML = '<i data-lucide="image-plus"></i>';
        clearBtn.hidden = true;
        renderIcons();
        updatePreview();
    });

    // ---------- Xem trước trực tiếp ----------
    const sizeText = { '1-10': 'Dưới 10 nhân sự', '11-50': '11 – 50 nhân sự', '51-200': '51 – 200 nhân sự', '200+': 'Trên 200 nhân sự' };
    function initials(name) {
        const parts = name.replace(/^(công ty|cty|tnhh|cổ phần|cp|jsc)\s+/gi, '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return 'A';
        return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    function tone(name) {
        let h = 0;
        for (const ch of name) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
        return (Math.abs(h) % 6) + 1;
    }
    function setFact(id, text) {
        const el = $(id);
        el.hidden = !text;
        el.querySelector('b').textContent = text || '';
    }

    let bumpTimer = null;
    function updatePreview() {
        const name = val('CompanyName');
        $('#pvName').textContent = name || 'Tên doanh nghiệp';
        const logo = $('#pvLogo');
        if (logoUrl && logoFile) {
            logo.innerHTML = `<img src="${logoUrl}" alt="">`;
        } else {
            logo.textContent = initials(name || 'Aris');
            logo.style.background = `var(--tone-${tone(name || 'Aris')}-bg, var(--brand))`;
        }
        const meta = [val('Industry'), sizeText[val('CompanySize')]].filter(Boolean).join(' · ');
        $('#pvMeta').textContent = meta || 'Lĩnh vực · Quy mô';
        const desc = val('Description');
        const pvDesc = $('#pvDesc');
        pvDesc.textContent = desc || 'Phần giới thiệu sẽ hiện ở đây.';
        pvDesc.classList.toggle('is-placeholder', !desc);
        setFact('#pvFounded', val('FoundedYear') ? `Thành lập ${val('FoundedYear')}` : '');
        setFact('#pvWeb', val('WebsiteUrl').replace(/^https?:\/\//i, ''));
        setFact('#pvAddr', val('CompanyAddress'));

        const count = $('#beDescCount');
        count.textContent = desc.length;
        count.parentElement.classList.toggle('is-good', desc.length >= 150);

        const checks = {
            name: name.length >= 2,
            industry: !!val('Industry'),
            size: !!val('CompanySize'),
            logo: !!logoFile,
            desc: desc.length >= 150,
            web: !!(val('WebsiteUrl') || val('CompanyAddress'))
        };
        let done = 0;
        Object.entries(checks).forEach(([k, ok]) => {
            const li = document.querySelector(`[data-check="${k}"]`);
            if (li) li.classList.toggle('is-ok', ok);
            if (ok) done++;
        });
        const pct = Math.round(done / 6 * 100);
        $('#beScore').textContent = pct + '%';
        const meter = $('#beMeter');
        meter.style.width = pct + '%';
        meter.classList.toggle('is-full', pct === 100);

        clearTimeout(bumpTimer);
        card.classList.remove('is-bump');
        bumpTimer = setTimeout(() => { card.classList.add('is-bump'); }, 10);
    }

    form.addEventListener('input', (e) => {
        if (e.target.name) setError(e.target.name, '');
        if (e.target.name === 'Industry') syncChips();
        if (e.target.name === 'FoundedYear' || e.target.name === 'TaxCode') {
            e.target.value = e.target.value.replace(e.target.name === 'TaxCode' ? /[^\d-]/g : /\D/g, '');
        }
        updatePreview();
    });
    form.addEventListener('change', updatePreview);

    // ---------- Bước 3: tóm tắt ----------
    function buildReview() {
        const rows = [
            ['Tên doanh nghiệp', val('CompanyName'), 1],
            ['Lĩnh vực', val('Industry'), 1],
            ['Quy mô', sizeText[val('CompanySize')] || '', 1],
            ['Năm thành lập', val('FoundedYear'), 1],
            ['Mã số thuế', val('TaxCode'), 1],
            ['Logo', logoFile ? logoFile.name : '', 2],
            ['Website', val('WebsiteUrl'), 2],
            ['Địa chỉ', val('CompanyAddress'), 2],
            ['Giới thiệu', val('Description') ? `${val('Description').length} ký tự` : '', 2]
        ];
        const dl = $('#beReview');
        dl.innerHTML = '';
        rows.forEach(([label, value, s]) => {
            const dt = document.createElement('dt');
            dt.textContent = label;
            const dd = document.createElement('dd');
            dd.textContent = value || 'Chưa điền';
            if (!value) dd.classList.add('is-empty');
            const ed = document.createElement('dd');
            ed.className = 'be-review__edit';
            ed.innerHTML = `<button type="button" data-goto="${s}">Sửa</button>`;
            dl.append(dt, dd, ed);
        });
    }
    $('#beReview').addEventListener('click', (e) => {
        const b = e.target.closest('[data-goto]');
        if (b) go(+b.dataset.goto);
    });
    $('#beAgree').addEventListener('change', () => setError('Agree', ''));

    // ---------- Gửi ----------
    function token() {
        const el = form.querySelector('input[name="__RequestVerificationToken"]') || document.querySelector('input[name="__RequestVerificationToken"]');
        return el ? el.value : '';
    }

    async function submit() {
        if (submitting) return;
        if (!validate(1) || !validate(3)) {
            M.shake && M.shake(nextBtn);
            if (!validate(1)) go(1);
            return;
        }
        submitting = true;
        M.morphButton && M.morphButton(nextBtn, 'loading');
        backBtn.disabled = true;

        const body = new URLSearchParams();
        ['CompanyName', 'Industry', 'CompanySize', 'FoundedYear', 'TaxCode', 'WebsiteUrl', 'CompanyAddress', 'Description'].forEach(n => {
            const v = val(n);
            if (v) body.append(n, v);
        });
        body.append('__RequestVerificationToken', token());

        try {
            const res = await fetch('/Account/UpgradeToBusiness', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body
            });
            const data = await res.json().catch(() => ({ success: false, message: `Máy chủ trả lỗi (HTTP ${res.status}).` }));
            if (!data.success) throw new Error(data.message || 'Không thể chuyển tài khoản.');

            if (logoFile) {
                const fd = new FormData();
                fd.append('avatar', logoFile);
                try {
                    const up = await fetch('/Settings/UpdateAvatar', {
                        method: 'POST',
                        headers: { 'RequestVerificationToken': token() },
                        body: fd
                    });
                    const r = await up.json();
                    if (!r.success) {
                        M.toast('Đã tạo tài khoản, nhưng chưa tải được logo — thử lại ở Hồ sơ công ty.', { tone: 'warning' });
                    } else if (window.updateCurrentUserAvatar) {
                        await window.updateCurrentUserAvatar(r.avatarUrl);
                    }
                } catch {
                    M.toast('Đã tạo tài khoản, nhưng chưa tải được logo — thử lại ở Hồ sơ công ty.', { tone: 'warning' });
                }
            }

            M.morphButton && M.morphButton(nextBtn, 'success');
            setTimeout(() => {
                form.hidden = true;
                $('#beSteps').hidden = true;
                $('#beDone').hidden = false;
                renderIcons();
            }, 450);
        } catch (err) {
            M.morphButton && M.morphButton(nextBtn, 'error');
            M.toast(err.message || 'Lỗi kết nối máy chủ.', { tone: 'danger' });
            backBtn.disabled = false;
            submitting = false;
            setTimeout(() => M.morphButton && M.morphButton(nextBtn, 'idle'), 1400);
        }
    }

    updatePreview();
    renderIcons();
})();
