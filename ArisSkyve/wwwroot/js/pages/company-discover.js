/* =============================================================================
   ARIS — Khám phá công ty (thiết kế "Aris Kinetic" theo mẫu Stitch, 26/09/2026)
   View: Views/Company/Index.cshtml · CSS: wwwroot/css/pages/company-discover.css
   - Tìm & lọc tại chỗ (từ khoá, lĩnh vực, đang tuyển, đã xác minh, đang theo dõi), sắp xếp có FLIP
   - Dạng lưới / danh sách (nhớ trên máy), ?industry= & ?q= trên URL, phím "/" để tìm
   - Theo dõi công ty (đồng bộ mọi nút + số người theo dõi), lưu bài văn hoá, xem ảnh lớn
   - Tin 24h của mọi doanh nghiệp (aris-stories.js, scope=companies)
   ============================================================================= */
(function () {
    'use strict';

    const M = window.ArisMotion || {
        flip: (c, mutate) => { mutate(); return Promise.resolve(); },
        animate: (el, k, o) => (el && el.animate ? el.animate(k, o) : { finished: Promise.resolve() }),
        rollNumber: (el, v) => { if (el) el.textContent = v; },
        pulse: () => {},
        toast: (msg) => { if (window.showToast) window.showToast(msg); },
        reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches
    };
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const renderIcons = () => { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); };
    const cfg = window.__CX__ || {};
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

    const grid = $('#cxGrid');
    const cards = grid ? $$('.cx-card', grid) : [];
    const q = $('#cxQ');
    const sortSel = $('#cxSort');
    const countEl = $('#cxCount');
    const none = $('#cxNone');
    const featured = $('#cxFeatured');
    const state = { q: '', industries: new Set(), hiring: false, verified: false, following: false, sort: 'popular' };

    cards.forEach((c) => { c._search = norm(c.dataset.search); c._order = cards.indexOf(c); });

    /* ---------------- Lọc ---------------- */
    function active() {
        return !!(state.q || state.industries.size || state.hiring || state.verified || state.following);
    }

    function matches(c) {
        if (state.q && !state.q.split(/\s+/).every((w) => c._search.includes(w))) return false;
        if (state.industries.size && !state.industries.has(c.dataset.industry)) return false;
        if (state.hiring && +c.dataset.jobs <= 0) return false;
        if (state.verified && c.dataset.verified !== '1') return false;
        if (state.following && c.dataset.following !== '1') return false;
        return true;
    }

    function apply(animate = true) {
        if (!grid) return;
        const mutate = () => {
            let n = 0;
            cards.forEach((c) => {
                const ok = matches(c);
                c.hidden = !ok;
                if (ok) n++;
            });
            const sorted = cards.slice().sort((a, b) => {
                if (state.sort === 'jobs') return (+b.dataset.jobs - +a.dataset.jobs) || a._order - b._order;
                if (state.sort === 'name') return a.dataset.name.localeCompare(b.dataset.name, 'vi');
                return a._order - b._order;
            });
            sorted.forEach((c) => grid.append(c));
            if (countEl) countEl.innerHTML = active()
                ? `Tìm thấy <b class="a-num">${n}</b> / ${cards.length} công ty`
                : `Đang hiển thị <b class="a-num">${cards.length}</b> công ty`;
            if (none) none.hidden = n > 0;
        };
        if (animate && !M.reduced()) M.flip(grid, mutate, { selector: '.cx-card:not([hidden])' });
        else mutate();

        const on = active();
        $$('[data-clear]').forEach((b) => { if (b.classList.contains('cx-clear')) b.hidden = !on; });
        $$('.cx-chip').forEach((b) => {
            const f = b.dataset.filter;
            const pressed = f === 'all' ? !state.industries.size && !state.hiring && !state.verified && !state.following
                : f === 'industry' ? state.industries.has(b.dataset.value)
                : !!state[f];
            b.setAttribute('aria-pressed', String(pressed));
        });
        if (featured) featured.classList.toggle('is-collapsed', on);

        const url = new URL(location.href);
        url.searchParams.delete('industry');
        url.searchParams.delete('q');
        state.industries.forEach((i) => url.searchParams.append('industry', i));
        if (state.q) url.searchParams.set('q', q.value.trim());
        history.replaceState(null, '', url.pathname + url.search + url.hash);
    }

    function clearAll() {
        state.q = '';
        state.industries.clear();
        state.hiring = state.verified = state.following = false;
        if (q) q.value = '';
        apply();
    }

    let qTimer = 0;
    if (q) {
        q.addEventListener('input', () => {
            clearTimeout(qTimer);
            qTimer = setTimeout(() => { state.q = norm(q.value.trim()); apply(); }, 140);
        });
    }
    const form = $('#cxSearch');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            state.q = norm(q.value.trim());
            apply();
            const all = $('#cxAll');
            if (all) all.scrollIntoView({ behavior: M.reduced() ? 'auto' : 'smooth', block: 'start' });
        });
    }
    if (sortSel) sortSel.addEventListener('change', () => { state.sort = sortSel.value; apply(); });

    /* ---------------- Dạng lưới / danh sách ---------------- */
    function setView(v, save) {
        if (!grid) return;
        M.flip(grid, () => { grid.dataset.view = v; }, { selector: '.cx-card:not([hidden])' });
        $$('[data-view]').forEach((b) => { if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.dataset.view === v)); });
        if (save) { try { localStorage.setItem('aris-cx-view', v); } catch (e) { /* chế độ riêng tư */ } }
    }

    /* ---------------- Theo dõi · lưu bài ---------------- */
    async function toggleFollow(id, btn) {
        const btns = $$(`[data-follow-co="${id}"]`);
        const next = btn.getAttribute('aria-pressed') !== 'true';
        const paint = (on) => btns.forEach((b) => {
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', String(on));
            b.innerHTML = on ? '<i data-lucide="check"></i><span>Đang theo dõi</span>' : '<i data-lucide="plus"></i><span>Theo dõi</span>';
        });
        paint(next);
        renderIcons();
        M.pulse(btn, 1.06);
        btns.forEach((b) => { b.disabled = true; });
        try {
            const r = await fetch(`/Company/ToggleFollow/${id}`, { method: 'POST' });
            const d = await r.json();
            if (!d.success) throw new Error(d.message);
            paint(d.following);
            renderIcons();
            $$(`[data-fcount="${id}"]`).forEach((el) => M.rollNumber(el, d.followerCount));
            const card = $(`.cx-card[data-cid="${id}"]`);
            if (card) { card.dataset.following = d.following ? '1' : '0'; card.dataset.followers = d.followerCount; }
            M.toast(d.following ? 'Đã theo dõi — tin và việc mới của công ty sẽ hiện trên Bảng tin.' : 'Đã bỏ theo dõi công ty.', { tone: d.following ? 'success' : 'default' });
            if (state.following) apply();
        } catch (e) {
            paint(!next);
            renderIcons();
            M.toast('Chưa theo dõi được, thử lại nhé.', { tone: 'danger' });
        } finally {
            btns.forEach((b) => { b.disabled = false; });
        }
    }

    async function toggleSave(pid, btn) {
        const next = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(next));
        btn.setAttribute('aria-label', next ? 'Bỏ lưu' : 'Lưu bài viết');
        M.pulse($('svg', btn) || btn, 1.2);
        try {
            const r = await fetch('/Dashboard/ToggleSave', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ postId: pid }).toString() });
            const d = await r.json();
            if (!d.success) throw new Error(d.message);
            btn.setAttribute('aria-pressed', String(!!d.saved));
            M.toast(d.saved ? 'Đã lưu bài viết.' : 'Đã bỏ lưu bài viết.', { tone: d.saved ? 'success' : 'default' });
        } catch (e) {
            btn.setAttribute('aria-pressed', String(!next));
            M.toast('Chưa lưu được, thử lại nhé.', { tone: 'danger' });
        }
    }

    /* ---------------- Sự kiện ---------------- */
    document.addEventListener('click', (e) => {
        const t = e.target;
        let b;
        if ((b = t.closest('.cx-chip'))) {
            const f = b.dataset.filter;
            if (f === 'all') { state.industries.clear(); state.hiring = state.verified = state.following = false; }
            else if (f === 'industry') { const v = b.dataset.value; if (state.industries.has(v)) state.industries.delete(v); else state.industries.add(v); }
            else state[f] = !state[f];
            apply();
            return;
        }
        if (t.closest('[data-clear]')) { clearAll(); return; }
        if ((b = t.closest('[data-view]')) && b.tagName === 'BUTTON') { setView(b.dataset.view, true); return; }
        if ((b = t.closest('[data-follow-co]'))) { e.preventDefault(); toggleFollow(+b.dataset.followCo, b); return; }
        if ((b = t.closest('[data-save-post]'))) { toggleSave(+b.dataset.savePost, b); return; }
        if ((b = t.closest('img[data-lb]'))) {
            const imgs = $$(`img[data-lb="${b.dataset.lb}"]`);
            if (window.openLightbox) window.openLightbox(imgs, imgs.indexOf(b));
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (!q) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        q.focus();
        q.select();
    }, true);

    /* ---------------- Khởi tạo ---------------- */
    const params = new URLSearchParams(location.search);
    params.getAll('industry').forEach((i) => state.industries.add(i));
    if (params.get('q') && q) { q.value = params.get('q'); state.q = norm(q.value); }
    let savedView = 'grid';
    try { savedView = localStorage.getItem('aris-cx-view') || 'grid'; } catch (e) { /* bỏ qua */ }
    if (grid && savedView === 'list') { grid.dataset.view = 'list'; setView('list', false); }
    if (active()) apply(false);

    if (window.ArisStories && $('#cxStoryTrack')) {
        window.ArisStories.init({
            section: '#cxStories',
            track: '#cxStoryTrack',
            scope: 'companies',
            showSub: true,
            fillers: cfg.fillers || [],
            emptyHtml: '<b>Chưa có công ty nào đăng tin hôm nay</b><span>Tin 24h của doanh nghiệp sẽ xuất hiện ở đây.</span>'
        });
    }
})();
