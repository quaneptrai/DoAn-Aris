/* =============================================================================
   ARIS — Trang công ty (bản "Aris Night", 27/09/2026 — theo mẫu Stitch "Chi tiết doanh nghiệp")
   View: Views/Company/Details.cshtml · CSS: wwwroot/css/pages/company-profile.css
   - Theo dõi / bỏ theo dõi (số người theo dõi lăn số), chia sẻ, sao chép địa chỉ
   - Thanh mục dính: vạch chỉ báo trượt theo mục đang đọc (scrollspy)
   - Ảnh "Khoảnh khắc": xem lớn (openLightbox trong aris-shell.js)
   ============================================================================= */
(function () {
    'use strict';
    const M = window.ArisMotion || {
        rollNumber: (el, v) => { if (el) el.textContent = v; },
        pulse: () => {},
        toast: (msg) => { if (window.showToast) window.showToast(msg); }
    };
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const renderIcons = () => { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); };

    /* ---------------- Theo dõi ---------------- */
    async function toggleFollow(btn) {
        const id = btn.dataset.coFollow;
        const next = btn.getAttribute('aria-pressed') !== 'true';
        const paint = (on) => {
            btn.classList.toggle('is-on', on);
            btn.setAttribute('aria-pressed', String(on));
            btn.innerHTML = on ? '<i data-lucide="check"></i><span>Đang theo dõi</span>' : '<i data-lucide="plus"></i><span>Theo dõi</span>';
            renderIcons();
        };
        paint(next);
        M.pulse(btn, 1.05);
        btn.disabled = true;
        try {
            const r = await fetch(`/Company/ToggleFollow/${id}`, { method: 'POST' });
            const d = await r.json();
            if (!d.success) throw new Error(d.message);
            paint(d.following);
            const n = $('#coFollowers');
            if (n && typeof d.followerCount === 'number') M.rollNumber(n, d.followerCount);
            M.toast(d.following ? 'Đã theo dõi — bài đăng và việc mới của công ty sẽ hiện trên Bảng tin.' : 'Đã bỏ theo dõi công ty.', { tone: d.following ? 'success' : 'default' });
        } catch (e) {
            paint(!next);
            M.toast('Chưa theo dõi được, thử lại nhé.', { tone: 'danger' });
        } finally {
            btn.disabled = false;
        }
    }

    document.addEventListener('click', (e) => {
        const t = e.target;
        let b;
        if ((b = t.closest('[data-co-follow]'))) { toggleFollow(b); return; }
        if (t.closest('[data-co-share]')) {
            const url = location.origin + location.pathname;
            if (navigator.share && matchMedia('(max-width: 767px)').matches) { navigator.share({ url }).catch(() => {}); return; }
            if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
            M.toast('Đã sao chép liên kết trang công ty.', { tone: 'success' });
            return;
        }
        if (t.closest('[data-co-copy]')) {
            const text = ($('#coAddress')?.textContent || '').trim();
            if (text && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
            M.toast('Đã sao chép địa chỉ.', { tone: 'success' });
            return;
        }
        if ((b = t.closest('img[data-co-lb]'))) {
            const imgs = $$('img[data-co-lb]');
            if (window.openLightbox) window.openLightbox(imgs, imgs.indexOf(b));
        }
    });

    /* ---------------- Thanh mục + scrollspy ---------------- */
    const tabs = $('#coTabs');
    if (tabs) {
        const ind = $('.co-tabs__ind', tabs);
        const links = $$('.co-tab', tabs);
        const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
        const place = (a, instant) => {
            if (!ind || !a) return;
            const r = a.getBoundingClientRect();
            const pr = tabs.getBoundingClientRect();
            ind.style.transition = instant ? 'none' : '';
            ind.style.width = r.width + 'px';
            ind.style.transform = `translateX(${r.left - pr.left + tabs.scrollLeft}px)`;
        };
        const setCurrent = (a, instant) => {
            links.forEach((l) => l.setAttribute('aria-current', String(l === a)));
            place(a, instant);
        };
        let locked = false;
        links.forEach((a) => a.addEventListener('click', () => {
            setCurrent(a);
            locked = true;
            setTimeout(() => { locked = false; }, 700);
        }));
        const spy = () => {
            if (locked) return;
            const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 0) + 90;
            let cur = links[0];
            sections.forEach((s, i) => { if (s.getBoundingClientRect().top - top <= 0) cur = links[i]; });
            if (cur && cur.getAttribute('aria-current') !== 'true') setCurrent(cur);
        };
        window.addEventListener('scroll', spy, { passive: true });
        window.addEventListener('resize', () => place(links.find((l) => l.getAttribute('aria-current') === 'true'), true));
        requestAnimationFrame(() => setCurrent(links[0], true));
        const stickTop = () => tabs.classList.toggle('is-stuck', tabs.getBoundingClientRect().top <= (parseFloat(getComputedStyle(tabs).top) || 0) + 1);
        window.addEventListener('scroll', stickTop, { passive: true });
    }
})();
