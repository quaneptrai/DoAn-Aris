/* =============================================================================
   ARIS — Tin 24h "Một ngày ở công ty" (dùng chung: Bảng tin, Khám phá công ty)
   File: wwwroot/js/aris-stories.js · CSS: wwwroot/css/aris-stories.css
   API: ArisStories.init({
          section: '#storiesSection',   // thẻ chứa (có nút [data-st-step])
          track:   '#storyTrack',       // hàng bong bóng (có thể chứa sẵn #storyMe)
          scope:   null | 'companies',  // 'companies' = tin của mọi doanh nghiệp
          showSub: false,               // hiện dòng phụ dưới tên (chú thích tin / số việc)
          fillers: [{ name, avatar, href, sub, org }],  // bong bóng liên kết khi công ty chưa có tin
          emptyHtml: '...'              // nội dung khi không có tin nào
        })
   Xem tin: tự chạy (ảnh 5 giây, video theo độ dài), chạm trái/phải, giữ để dừng, ← → Space Esc,
   ghi nhận lượt xem, trả lời bằng tin nhắn (ArisChat), xem ai đã xem tin của mình, đăng tin mới.
   ============================================================================= */
window.ArisStories = (function () {
    'use strict';

    const M = window.ArisMotion || {
        animate: (el, k, o) => (el && el.animate ? el.animate(k, o) : { finished: Promise.resolve() }),
        toast: (msg) => { if (window.showToast) window.showToast(msg); },
        morphButton: (b, s) => { if (b) b.disabled = s === 'loading'; },
        openDialog: (d, s) => { if (s) s.hidden = false; if (d) d.hidden = false; },
        closeDialog: (d, s) => { if (s) s.hidden = true; if (d) d.hidden = true; return Promise.resolve(); },
        pulse: () => {},
        reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches
    };
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const renderIcons = () => { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); };
    const initials = window.initials || ((n) => (n || 'A').trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase());
    const orgInitials = window.orgInitials || initials;
    const toneOf = window.toneOf || (() => 1);
    const F = window.ArisFeatures || {};
    const cfg = window.__STORY_ME__ || window.__FEED_CONFIG__ || {};
    const myId = cfg.currentUserId || 0;
    const myName = cfg.currentUserName || 'Tôi';
    const myAvatar = cfg.currentUserAvatar || '/images/default-avatar.png';

    function face(name, avatarUrl, size, org) {
        const text = esc(org ? orgInitials(name) : initials(name));
        const img = avatarUrl && avatarUrl !== '/images/default-avatar.png' ? `<img src="${esc(avatarUrl)}" alt="" loading="lazy" onerror="this.remove()">` : '';
        return `<span class="a-avatar" style="--_s:${size}px" data-tone="${toneOf(name)}">${text}${img}</span>`;
    }
    const minsSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    function timeAgo(m) {
        if (m < 1) return 'Vừa xong';
        if (m < 60) return `${m} phút trước`;
        return `${Math.floor(m / 60)} giờ trước`;
    }

    let opts = null;
    let users = [];
    let sv = null;
    let viewer = null;

    const mine = () => users.find((u) => u.userId === myId && u.items && u.items.length);

    function bubble(u) {
        const first = u.items.find((x) => !x._seen) || u.items[u.items.length - 1];
        const sub = opts.showSub ? `<span class="st__sub">${esc((first && first.caption) || timeAgo(minsSince(first.createdAt)))}</span>` : '';
        return `<button class="st${u.seen ? ' is-seen' : ''}" type="button" role="listitem" data-story-user="${u.userId}" aria-label="Xem tin của ${esc(u.name)}${u.seen ? '' : ' (chưa xem)'}">
          <span class="st__ring">${face(u.name, u.avatar, 58, u.isOrg)}</span>
          <span class="st__name">${esc(u.name)}</span>${sub}
        </button>`;
    }

    function filler(f) {
        return `<a class="st st--link" role="listitem" href="${esc(f.href)}" aria-label="${esc(f.name)} — xem trang công ty">
          <span class="st__ring">${face(f.name, f.avatar, 58, f.org !== false)}</span>
          <span class="st__name">${esc(f.name)}</span>${opts.showSub && f.sub ? `<span class="st__sub">${esc(f.sub)}</span>` : ''}
        </a>`;
    }

    async function load() {
        try {
            const r = await fetch('/Stories/Feed' + (opts.scope ? `?scope=${encodeURIComponent(opts.scope)}` : ''));
            const d = await r.json();
            users = Array.isArray(d) ? d.filter((u) => u.items && u.items.length) : [];
        } catch (e) {
            users = [];
        }
        render();
    }

    function render() {
        const track = opts.track;
        $$('.st--skel, .st[data-story-user], .st--link, .stories__empty', track).forEach((x) => x.remove());
        const me = mine();
        const meBtn = $('#storyMe', track);
        if (meBtn) {
            meBtn.classList.toggle('has-story', !!me);
            meBtn.setAttribute('aria-label', me ? 'Xem tin của bạn' : 'Tin của bạn — thêm tin mới');
        }
        const others = users.filter((u) => u.userId !== myId || !meBtn);
        const shownNames = new Set(others.map((u) => u.name));
        const fill = (opts.fillers || []).filter((f) => !shownNames.has(f.name)).slice(0, Math.max(0, 12 - others.length));
        if (!others.length && !fill.length) {
            if (opts.emptyHtml) track.insertAdjacentHTML('beforeend', `<div class="stories__empty">${opts.emptyHtml}</div>`);
        } else {
            track.insertAdjacentHTML('beforeend', others.map(bubble).join('') + fill.map(filler).join(''));
        }
        renderIcons();
        syncNav();
    }

    function syncNav() {
        if (!opts.section) return;
        const [prev, next] = $$('[data-st-step]', opts.section);
        const t = opts.track;
        const max = t.scrollWidth - t.clientWidth - 2;
        if (prev) prev.disabled = t.scrollLeft <= 2;
        if (next) next.disabled = t.scrollLeft >= max;
    }

    /* ---------------- Trình xem ---------------- */
    function ensureViewer() {
        if (viewer) return viewer;
        viewer = $('#story');
        if (!viewer) {
            viewer = document.createElement('div');
            viewer.className = 'story';
            viewer.id = 'story';
            viewer.setAttribute('role', 'dialog');
            viewer.setAttribute('aria-modal', 'true');
            viewer.setAttribute('aria-label', 'Xem tin');
            viewer.hidden = true;
            document.body.append(viewer);
        }
        viewer.addEventListener('click', onViewerClick);
        viewer.addEventListener('pointerdown', (e) => {
            if (!sv || !e.target.closest('.story__tap')) return;
            viewer._held = false;
            clearTimeout(viewer._holdT);
            viewer._holdT = setTimeout(() => { viewer._held = true; viewer.classList.add('is-holding'); setPaused(true); }, 220);
        });
        const release = () => {
            clearTimeout(viewer._holdT);
            if (viewer._held) {
                viewer.classList.remove('is-holding');
                setPaused(false);
                setTimeout(() => { viewer._held = false; }, 0);
            }
        };
        viewer.addEventListener('pointerup', release);
        viewer.addEventListener('pointercancel', release);
        viewer.addEventListener('dblclick', (e) => {
            if (!sv) return;
            const u = sv.list[sv.ui];
            const it = u && u.items[sv.ii];
            if (it && it.mediaType === 'image' && typeof window.openLightbox === 'function') {
                e.preventDefault();
                setPaused(true);
                window.openLightbox([{ src: it.mediaUrl, alt: it.caption || `Tin của ${u.name}`, caption: it.caption || '' }]);
            }
        });
        document.addEventListener('lightbox:close', () => {
            if (sv && sv.paused) setPaused(false);
        });
        viewer.addEventListener('submit', onReply);
        return viewer;
    }

    function viewerList() {
        const me = mine();
        const others = users.filter((u) => u.userId !== myId);
        return me ? [me, ...others] : others;
    }

    function open(userId) {
        ensureViewer();
        const lst = viewerList();
        const ui = lst.findIndex((u) => u.userId === userId);
        if (ui < 0) return;
        const first = lst[ui].items.findIndex((it) => !it._seen);
        sv = { list: lst, ui, ii: lst[ui].seen || first < 0 ? 0 : first, paused: false, muted: true, t0: 0, elapsed: 0, dur: 5000, raf: 0, back: document.activeElement };
        viewer.hidden = false;
        document.documentElement.style.overflow = 'hidden';
        frame();
        M.animate(viewer, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
        M.animate($('.story__frame', viewer),
            [{ opacity: 0, transform: 'scale(.94) translateY(10px)' }, { opacity: 1, transform: 'scale(1) translateY(0)' }],
            { duration: 260, easing: 'cubic-bezier(.22,.9,.28,1)' });
    }

    function frame() {
        const u = sv.list[sv.ui];
        const it = u.items[sv.ii];
        const own = u.userId === myId;
        const atStart = sv.ui === 0 && sv.ii === 0;
        const link = it.link && it.link.url ? it.link : (u.isOrg && u.companyId ? { url: `/Company/Details/${u.companyId}`, label: 'Xem trang công ty', internal: true } : null);
        viewer.innerHTML = `
          <button class="story__side story__side--prev" type="button" data-sv="prev" aria-label="Tin trước" ${atStart ? 'hidden' : ''}><i data-lucide="chevron-left"></i></button>
          <div class="story__frame" tabindex="-1">
            <div class="story__media">${it.mediaType === 'video'
                ? `<video src="${esc(it.mediaUrl)}" playsinline autoplay ${sv.muted ? 'muted' : ''}></video>`
                : `<img src="${esc(it.mediaUrl)}" alt="${esc(it.caption || 'Tin của ' + u.name)}">`}</div>
            <div class="story__shade-t"></div><div class="story__shade-b"></div>
            <div class="story__top">
              <div class="story__bars">${u.items.map((x, k) => `<span class="story__bar${k < sv.ii ? ' is-done' : ''}"><i></i></span>`).join('')}</div>
              <div class="story__head">
                ${face(u.name, u.avatar, 32, u.isOrg)}
                <span class="story__name">${esc(u.name)}</span><span class="story__time">${timeAgo(minsSince(it.createdAt))}</span>
                <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-sv="pause" aria-label="${sv.paused ? 'Tiếp tục' : 'Tạm dừng'}"><i data-lucide="${sv.paused ? 'play' : 'pause'}"></i></button>
                ${it.mediaType === 'image' ? '<button class="a-btn a-btn--ghost a-btn--icon a-btn--sm story__hzoom" type="button" data-sv="zoom" aria-label="Phóng to ảnh (Zoom)"><i data-lucide="zoom-in"></i></button>' : ''}
                ${it.mediaType === 'video' ? `<button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-sv="mute" aria-label="${sv.muted ? 'Bật tiếng' : 'Tắt tiếng'}"><i data-lucide="${sv.muted ? 'volume-x' : 'volume-2'}"></i></button>` : ''}
                <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm story__hclose" type="button" data-sv="close" aria-label="Đóng"><i data-lucide="x"></i></button>
              </div>
            </div>
            <div class="story__tap${it.mediaType === 'image' ? ' story__tap--image' : ''}">
              <button type="button" data-sv="prev" aria-label="Tin trước"></button>
              ${it.mediaType === 'image' ? '<button class="story__zoom" type="button" data-sv="zoom" aria-label="Phóng to ảnh (Zoom)"><span class="story__zoom-badge"><i data-lucide="zoom-in"></i><span>Phóng to</span></span></button>' : ''}
              <button type="button" data-sv="next" aria-label="Tin sau"></button>
            </div>
            ${it.caption ? `<div class="story__caption">${esc(it.caption)}</div>` : ''}
            ${link ? `<a class="story__sticker" href="${esc(link.url)}"${link.internal ? '' : ' target="_blank" rel="noopener"'}><i data-lucide="${link.internal ? 'building-2' : 'link'}"></i>${esc(link.label || 'Xem liên kết')}</a>` : ''}
            <div class="story__foot">
              ${own
                ? '<button class="story__viewers" type="button" data-sv="viewers"><i data-lucide="eye"></i><span>Xem ai đã xem</span></button>'
                : `<form class="story__reply" data-sv-reply autocomplete="off"><input class="story__input" placeholder="Trả lời ${esc(u.name)}…" maxlength="500" aria-label="Trả lời tin"><button class="act" type="submit" aria-label="Gửi"><i data-lucide="send"></i></button></form>`}
            </div>
            <div class="story__panel" data-sv-panel hidden></div>
          </div>
          <button class="story__side story__side--next" type="button" data-sv="next" aria-label="Tin sau"><i data-lucide="chevron-right"></i></button>
          <button class="a-btn a-btn--ghost a-btn--icon story__close" type="button" data-sv="close" aria-label="Đóng (Esc)"><i data-lucide="x"></i></button>`;
        renderIcons();
        $('.story__frame', viewer).focus({ preventScroll: true });

        if (!own && !it._seen) {
            it._seen = true;
            fetch(`/Stories/View/${it.id}`, { method: 'POST' }).catch(() => {});
        }
        sv.elapsed = 0;
        sv.dur = 5000;
        const v = $('video', viewer);
        if (v) {
            v.addEventListener('loadedmetadata', () => { if (sv) sv.dur = Math.min(60000, Math.max(3, v.duration || 5) * 1000); }, { once: true });
            if (sv.paused) v.pause();
        }
        const input = $('.story__input', viewer);
        if (input) {
            input.addEventListener('focus', () => setPaused(true));
            input.addEventListener('blur', () => setPaused(false));
        }
        tick();
    }

    function tick() {
        cancelAnimationFrame(sv.raf);
        const bar = $$('.story__bar', viewer)[sv.ii];
        const fill = bar && bar.firstElementChild;
        sv.t0 = performance.now() - sv.elapsed;
        const step = (t) => {
            if (!sv) return;
            if (sv.paused) {
                sv.t0 = t - sv.elapsed;
            } else {
                sv.elapsed = t - sv.t0;
                const pr = Math.min(1, sv.elapsed / sv.dur);
                if (fill) fill.style.transform = `scaleX(${pr})`;
                if (pr >= 1) { step1(1); return; }
            }
            sv.raf = requestAnimationFrame(step);
        };
        sv.raf = requestAnimationFrame(step);
    }

    function setPaused(on) {
        if (!sv) return;
        sv.paused = on;
        const v = $('video', viewer);
        if (v) { if (on) v.pause(); else v.play().catch(() => {}); }
        const b = $('[data-sv="pause"]', viewer);
        if (b) { b.innerHTML = `<i data-lucide="${on ? 'play' : 'pause'}"></i>`; b.setAttribute('aria-label', on ? 'Tiếp tục' : 'Tạm dừng'); renderIcons(); }
    }

    function step1(dir) {
        if (!sv) return;
        const u = sv.list[sv.ui];
        if (dir > 0) {
            if (sv.ii < u.items.length - 1) { sv.ii++; frame(); return; }
            if (u.items.every((x) => x._seen || u.userId === myId)) u.seen = true;
            if (sv.ui < sv.list.length - 1) { sv.ui++; sv.ii = 0; frame(); return; }
            close();
        } else {
            if (sv.ii > 0) { sv.ii--; frame(); return; }
            if (sv.ui > 0) { sv.ui--; sv.ii = 0; frame(); return; }
            sv.elapsed = 0;
            tick();
        }
    }

    function close() {
        if (!sv) return;
        cancelAnimationFrame(sv.raf);
        const u = sv.list[sv.ui];
        if (u && u.items.every((x) => x._seen)) u.seen = true;
        const back = sv.back;
        sv = null;
        M.animate($('.story__frame', viewer),
            [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.96) translateY(8px)' }],
            { duration: 180, easing: 'ease-in' });
        const a = M.animate(viewer, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in' });
        (a.finished || Promise.resolve()).then(() => {
            viewer.hidden = true;
            viewer.innerHTML = '';
            document.documentElement.style.overflow = '';
            render();
            if (back && back.focus) back.focus({ preventScroll: true });
        });
    }

    async function showViewers() {
        const u = sv && sv.list[sv.ui];
        const it = u && u.items[sv.ii];
        const panel = $('[data-sv-panel]', viewer);
        if (!it || !panel) return;
        setPaused(true);
        panel.hidden = false;
        panel.innerHTML = '<div class="story__panel-head">Người đã xem<button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-sv="panel-close" aria-label="Đóng"><i data-lucide="x"></i></button></div><div class="story__panel-list">Đang tải…</div>';
        renderIcons();
        try {
            const r = await fetch(`/Stories/Viewers/${it.id}`);
            const d = await r.json();
            const box = $('.story__panel-list', panel);
            if (!d.success || !d.viewers.length) { box.textContent = 'Chưa có ai xem tin này.'; return; }
            box.innerHTML = d.viewers.map((x) => `<div class="story__viewer">${face(x.name, x.avatar, 32)}<span>${esc(x.name)}</span><small>${timeAgo(minsSince(x.viewedAt))}</small></div>`).join('');
        } catch (e) {
            $('.story__panel-list', panel).textContent = 'Không tải được danh sách người xem.';
        }
    }

    function onViewerClick(e) {
        const b = e.target.closest('[data-sv]');
        if (!b || !sv) return;
        const a = b.dataset.sv;
        if (a === 'close') close();
        else if (a === 'next') { if (!viewer._held) step1(1); }
        else if (a === 'prev') { if (!viewer._held) step1(-1); }
        else if (a === 'zoom') {
            const u = sv.list[sv.ui];
            const it = u.items[sv.ii];
            if (it.mediaType === 'image' && typeof window.openLightbox === 'function') {
                e.preventDefault();
                setPaused(true);
                window.openLightbox([{ src: it.mediaUrl, alt: it.caption || `Tin của ${u.name}`, caption: it.caption || '' }]);
            }
        }
        else if (a === 'pause') setPaused(!sv.paused);
        else if (a === 'mute') {
            sv.muted = !sv.muted;
            const v = $('video', viewer);
            if (v) v.muted = sv.muted;
            b.innerHTML = `<i data-lucide="${sv.muted ? 'volume-x' : 'volume-2'}"></i>`;
            renderIcons();
        } else if (a === 'viewers') showViewers();
        else if (a === 'panel-close') { $('[data-sv-panel]', viewer).hidden = true; setPaused(false); }
    }

    async function onReply(e) {
        const f = e.target.closest('[data-sv-reply]');
        if (!f || !sv) return;
        e.preventDefault();
        const input = $('.story__input', f);
        const text = input.value.trim();
        if (!text) return;
        const u = sv.list[sv.ui];
        input.value = '';
        input.blur();
        try {
            if (!window.ArisChat || !window.ArisChat.send) throw new Error();
            await window.ArisChat.send(u.userId, `↩ Trả lời tin của bạn: ${text}`);
            M.toast(`Đã gửi trả lời cho ${u.name}.`, { tone: 'success' });
        } catch (err) {
            M.toast('Chưa gửi được trả lời, thử lại trong Tin nhắn nhé.', { tone: 'danger' });
        }
    }

    /* ---------------- Đăng tin mới ---------------- */
    function pick() {
        if (!F.stories) { M.toast('Tin 24h sẽ bật sau khi hệ thống được cập nhật.'); return; }
        let input = $('#storyFile');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'storyFile';
            input.hidden = true;
            input.accept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';
            document.body.append(input);
        }
        if (!input._wired) {
            input._wired = true;
            input.addEventListener('change', () => { const f = input.files[0]; input.value = ''; if (f) compose(f); });
        }
        input.click();
    }

    function compose(file) {
        if (file.size > 50 * 1024 * 1024) { M.toast('Tệp quá lớn (tối đa 50 MB).', { tone: 'danger' }); return; }
        let d = $('#storyNewDialog');
        let s = $('#storyNewScrim');
        if (!d) {
            s = document.createElement('div'); s.className = 'a-scrim'; s.id = 'storyNewScrim'; s.hidden = true;
            d = document.createElement('div'); d.className = 'a-dialog story-new'; d.id = 'storyNewDialog'; d.hidden = true;
            d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'storyNewTitle');
            document.body.append(s, d);
        }
        const url = URL.createObjectURL(file);
        const isVid = file.type.startsWith('video');
        d.innerHTML = `
          <div class="a-dialog__head"><h2 class="a-dialog__title" id="storyNewTitle">Tin mới</h2><button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-sn-close aria-label="Đóng"><i data-lucide="x"></i></button></div>
          <div class="story-new__body">
            <div class="story-new__preview">${isVid ? `<video src="${url}" muted autoplay loop playsinline></video>` : `<img src="${url}" alt="Xem trước tin">`}<div class="story-new__cap" data-sn-cap hidden></div></div>
            <div class="story-new__fields">
              <label class="a-label" for="snCaption">Chú thích</label>
              <input class="a-input" id="snCaption" maxlength="80" placeholder="Ví dụ: Demo day thứ Sáu ở văn phòng 🚀" autocomplete="off">
              <div class="a-help"><span class="a-num" data-sn-count>0</span>/80 · Tin hiển thị 24 giờ với bạn bè${cfg.isBusiness ? ' và người theo dõi công ty' : ''}.</div>
            </div>
          </div>
          <div class="a-dialog__foot"><button class="a-btn a-btn--ghost" type="button" data-sn-close>Huỷ</button><button class="a-btn a-btn--primary a-btn--glow" type="button" data-sn-post><i data-lucide="send"></i>Đăng tin</button></div>`;
        renderIcons();
        M.openDialog(d, s);
        const cap = $('#snCaption', d);
        const preview = $('[data-sn-cap]', d);
        cap.addEventListener('input', () => {
            preview.hidden = !cap.value.trim();
            preview.textContent = cap.value;
            $('[data-sn-count]', d).textContent = cap.value.length;
        });
        setTimeout(() => cap.focus(), 250);

        const done = async () => { d.onclick = null; s.onclick = null; await M.closeDialog(d, s); URL.revokeObjectURL(url); d.innerHTML = ''; };
        s.onclick = done;
        d.onclick = async (e) => {
            if (e.target.closest('[data-sn-close]')) { done(); return; }
            const btn = e.target.closest('[data-sn-post]');
            if (!btn) return;
            M.morphButton(btn, 'loading');
            const fd = new FormData();
            fd.append('media', file);
            if (cap.value.trim()) fd.append('caption', cap.value.trim());
            try {
                const r = await fetch('/Stories/Create', { method: 'POST', body: fd });
                const res = await r.json();
                if (!res.success) throw new Error(res.message);
                const st = res.story;
                const item = { id: st.id, mediaUrl: st.mediaUrl, mediaType: st.mediaType, caption: st.caption, link: st.linkUrl ? { url: st.linkUrl, label: st.linkLabel } : null, createdAt: st.createdAt, _seen: true };
                const me = users.find((u) => u.userId === myId);
                if (me) me.items.push(item);
                else users.unshift({ userId: myId, name: myName, avatar: myAvatar, isOrg: !!cfg.isBusiness, companyId: cfg.companyId || null, seen: true, items: [item] });
                await done();
                render();
                const ring = $('#storyMe .st__ring');
                if (ring) M.pulse(ring, 1.08);
                M.toast('Đã đăng tin — hiển thị trong 24 giờ.', { tone: 'success' });
            } catch (err) {
                M.morphButton(btn, 'idle');
                M.toast(err.message || 'Chưa đăng được tin, thử lại nhé.', { tone: 'danger' });
            }
        };
    }

    /* ---------------- Khởi tạo ---------------- */
    function init(o) {
        opts = Object.assign({ scope: null, showSub: false, fillers: [], emptyHtml: '' }, o);
        opts.section = typeof opts.section === 'string' ? $(opts.section) : opts.section;
        opts.track = typeof opts.track === 'string' ? $(opts.track) : opts.track;
        if (!opts.track) return;

        opts.track.addEventListener('scroll', syncNav, { passive: true });
        window.addEventListener('resize', syncNav, { passive: true });
        document.addEventListener('click', (e) => {
            const t = e.target;
            let b;
            if ((b = t.closest('#storyMe'))) {
                if (t.closest('[data-story-add]') || !mine()) pick();
                else open(myId);
                return;
            }
            if ((b = t.closest('[data-story-user]'))) { open(+b.dataset.storyUser); return; }
            if ((b = t.closest('[data-st-step]')) && opts.section && opts.section.contains(b)) {
                opts.track.scrollBy({ left: +b.dataset.stStep * opts.track.clientWidth * 0.7, behavior: M.reduced() ? 'auto' : 'smooth' });
            }
        });
        document.addEventListener('keydown', (e) => {
            if (!sv) return;
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
            if (e.target.closest && e.target.closest('input, textarea')) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); step1(1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); step1(-1); }
            else if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); setPaused(!sv.paused); }
            else e.stopImmediatePropagation();
        }, true);

        if (F.stories) load();
        else render();
    }

    return { init, isOpen: () => !!sv, pick };
})();
