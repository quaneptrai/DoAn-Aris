/* =============================================================================
   ARIS — Bảng tin (bản "Aris Night" 27/09/2026 — thẻ bài kiểu Instagram theo mẫu Stitch)
   File: wwwroot/js/pages/feed.js  ·  View: Views/Dashboard/Index.cshtml
   - Thẻ bài: tác giả / công ty (xác minh, việc đang tuyển, Theo dõi), Kết nối,
     Thích (lạc quan, nhấn đúp ảnh), Bình luận (hộp thoại), Chia sẻ, Lưu, Ẩn, Sửa, Xoá có hoàn tác.
   - Tin 24h "Một ngày ở công ty": module dùng chung wwwroot/js/aris-stories.js.
   - Cột phải: nhận/từ chối phỏng vấn, lời mời kết nối, gợi ý kết bạn.
   - "N bài mới" thời gian thực (SignalR NewPost), cuộn vô hạn, phím tắt J/K/L/C/S/N/?.
   Mọi dữ liệu đều thật; tính năng cần migration V7 chỉ bật khi window.ArisFeatures cho phép.
   ============================================================================= */
(function () {
    'use strict';

    const M = window.ArisMotion || {
        animate: (el, k, o) => (el && el.animate ? el.animate(k, o) : { finished: Promise.resolve() }),
        rollNumber: (el, v) => { if (el) el.textContent = v; },
        shake: () => {},
        pulse: () => {},
        toast: (msg) => { if (window.showToast) window.showToast(msg); },
        morphButton: (btn, s) => { if (btn) btn.disabled = s === 'loading'; },
        openDialog: (d, s) => { if (s) s.hidden = false; if (d) d.hidden = false; },
        closeDialog: (d, s) => { if (s) s.hidden = true; if (d) d.hidden = true; return Promise.resolve(); },
        reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches
    };

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const isMobile = () => matchMedia('(max-width: 767px)').matches;
    const autosize = (ta, max = 9999) => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, max) + 'px'; };
    const form = (o) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });
    const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

    const cfg = window.__FEED_CONFIG__ || {};
    const F = window.ArisFeatures || {};
    const RX = window.ArisPostReactions || null; // cảm xúc (post-reactions.js); thiếu thì vẫn là tim
    const myId = cfg.currentUserId || 0;
    const myName = cfg.currentUserName || 'Tôi';
    const myAvatar = cfg.currentUserAvatar || '/images/default-avatar.png';

    const renderIcons = () => { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); };
    const initials = window.initials || ((n) => (n || 'A').trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase());
    const orgInitials = window.orgInitials || initials;
    const toneOf = window.toneOf || (() => 1);

    let nid = 100000;

    /* Avatar người = tròn, tổ chức = vuông bo góc. Ảnh lỗi → hiện chữ viết tắt phía dưới. */
    function face(name, avatarUrl, size = 40, org = false) {
        const cls = org ? 'a-logo' : 'a-avatar';
        const text = esc(org ? orgInitials(name) : initials(name));
        const img = avatarUrl && avatarUrl !== '/images/default-avatar.png'
            ? `<img src="${esc(avatarUrl)}" alt="" loading="lazy" onerror="this.remove()">` : '';
        return `<span class="${cls}" style="--_s:${size}px" data-tone="${toneOf(name)}">${text}${img}</span>`;
    }

    function timeAgo(mins) {
        if (mins < 1) return 'Vừa xong';
        if (mins < 60) return `${mins} phút trước`;
        if (mins < 1440) return `${Math.floor(mins / 60)} giờ trước`;
        const d = Math.floor(mins / 1440);
        if (d === 1) return 'Hôm qua';
        if (d < 7) return `${d} ngày trước`;
        const dt = new Date(Date.now() - mins * 60000);
        return `${dt.getDate()} thg ${dt.getMonth() + 1}${dt.getFullYear() !== new Date().getFullYear() ? ', ' + dt.getFullYear() : ''}`;
    }
    const minsSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

    function fullDate(mins) {
        const d = new Date(Date.now() - mins * 60000);
        return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()} lúc ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function richText(t) {
        return esc(t)
            .replace(/(^|\s)#([\p{L}\d_]+)/gu, '$1<a class="hashtag" href="/Search?q=%23$2">#$2</a>')
            .replace(/(^|\s)@([\p{L}\d_]{2,24})/gu, '$1<span class="mention">@$2</span>')
            .replace(/\n/g, '<br>');
    }

    /* ---------------------------------------------------------------------------
       TRẠNG THÁI
       --------------------------------------------------------------------------- */
    function fromDto(p) {
        return {
            id: p.id,
            userId: p.userId,
            who: p.authorName || 'Người dùng',
            avatar: p.authorAvatar,
            jobTitle: p.authorTitle || null,
            location: p.authorLocation || null,
            title: p.title || null,
            text: p.text || '',
            mins: p.mins || 0,
            likes: p.likes || 0,
            liked: !!p.liked,
            myReaction: p.myReaction || (p.liked ? 'like' : null),
            reactions: Array.isArray(p.reactions) ? p.reactions : [],
            saved: !!p.saved,
            commentCount: p.commentCount || 0,
            isOwner: !!p.isOwner,
            comments: [],
            media: p.media && p.media.length ? p.media : null,
            isCompany: !!p.isCompany,
            companyId: p.companyId || null,
            industry: p.industry || null,
            companyAddress: p.companyAddress || null,
            verified: !!p.verified,
            openJobs: p.openJobs || 0,
            following: !!p.following,
            relation: p.relation || 'none',
            friendLikers: p.friendLikers || []
        };
    }

    const state = { posts: (cfg.initialPosts || []).map(fromDto) };
    const byId = (id) => state.posts.find((p) => p.id === id);
    const hosts = (p) => $$(`[data-pid="${p.id}"]`);
    const list = $('#feedList');

    /* ---------------------------------------------------------------------------
       VẼ BÀI VIẾT
       --------------------------------------------------------------------------- */
    const authorHref = (p) => (p.isCompany && p.companyId ? `/Company/Details/${p.companyId}` : (p.isOwner ? '/Profile' : `/Profile/View/${p.userId}`));

    const myKind = (p) => (p.liked ? (p.myReaction || 'like') : null);

    /* Dòng dưới bài: cụm cảm xúc nhiều nhất + "Bạn và N người khác"; bấm để xem ai đã thả gì. */
    function likesHtml(p) {
        const rx = !!(RX && RX.enabled());
        if (p.likes <= 0) return `<span class="post__likes-empty">${rx ? 'Hãy là người đầu tiên bày tỏ cảm xúc' : 'Hãy là người đầu tiên thích bài này'}</span>`;
        const n = (x) => `<b class="a-num">${x}</b>`;
        const hearts = !RX || RX.onlyHearts(p.reactions);
        const mine = myKind(p);
        let who;
        if (mine) {
            who = p.likes > 1
                ? `Bạn và ${n(p.likes - 1)} người khác${hearts ? ' đã thích' : ''}`
                : (mine === 'like' || !RX ? 'Bạn đã thích bài này' : `Bạn đã thả “${RX.kind(mine).label}”`);
        } else if (p.friendLikers.length) {
            const names = p.friendLikers.slice(0, 2).map((x) => `<b>${esc(x)}</b>`);
            const rest = p.likes - names.length;
            const people = rest > 0 ? `${names.join(', ')} và ${n(rest)} người khác` : names.join(' và ');
            who = hearts ? `Được thích bởi ${people}` : people;
        } else {
            who = `${n(p.likes)} lượt ${hearts ? 'thích' : 'cảm xúc'}`;
        }
        const stack = RX ? RX.stackHtml(p.reactions.length ? p.reactions : [{ kind: 'like', count: p.likes }]) : '';
        return `<button class="rx-sum" type="button" data-rx-list aria-label="Xem ai đã bày tỏ cảm xúc">${stack}<span class="rx-sum__t">${who}</span></button>`;
    }

    /* Nút Thích: tim, hoặc mặt cảm xúc đã chọn. Rê chuột / giữ / ↑ để mở thanh chọn cảm xúc. */
    function likeBtnHtml(p, tip) {
        const k = myKind(p);
        const label = !k ? 'Thích' : (k === 'like' || !RX ? 'Bỏ thích' : `Bỏ cảm xúc ${RX.kind(k).label}`);
        const menu = RX && RX.enabled() ? ' aria-haspopup="menu" aria-expanded="false"' : '';
        return `<button class="act act--like" type="button" data-like data-kind="${k || ''}" aria-pressed="${!!k}" aria-label="${label}"${menu}${tip ? ` data-tip="${tip}" data-tip-side="bottom"` : ''}>`
            + `<i data-lucide="heart"></i><b class="act__emo rx-face" aria-hidden="true">${k && k !== 'like' && RX ? RX.kind(k).e : ''}</b></button>`;
    }

    const dotsHtml = (p) => `<div class="car__dots" aria-hidden="true">${p.media.map((_, i) => `<span class="car__dot${i === 0 ? ' is-on' : ''}"></span>`).join('')}</div>`;

    function carHtml(p) {
        const n = p.media.length;
        return `<div class="car" data-car aria-roledescription="carousel" aria-label="Ảnh trong bài của ${esc(p.who)}">
          <div class="car__track">
            ${p.media.map((m, i) => `<figure class="car__slide" aria-roledescription="slide" aria-label="${i + 1} / ${n}">
              ${m.kind === 'video'
                ? `<video src="${esc(m.src)}${String(m.src).includes('#') ? '' : '#t=0.1'}" muted playsinline loop controls preload="metadata" data-autoplay></video>`
                : `<img src="${esc(m.src)}" alt="Ảnh ${i + 1} trong bài của ${esc(p.who)}" draggable="false" loading="lazy">`}
            </figure>`).join('')}
          </div>
          ${n > 1 ? `<button class="car__btn car__btn--prev" type="button" data-car-step="-1" aria-label="Ảnh trước" hidden><i data-lucide="chevron-left"></i></button>
            <button class="car__btn car__btn--next" type="button" data-car-step="1" aria-label="Ảnh sau"><i data-lucide="chevron-right"></i></button>
            <span class="car__count a-num" aria-hidden="true">1/${n}</span>${dotsHtml(p)}` : ''}
        </div>`;
    }

    function bodyHtml(p) {
        if (!p.text && !p.title) return '<div class="post__body" hidden></div>';
        const long = p.text.length > 420;
        return `<div class="post__body">
          ${p.title ? `<h2 class="post__title">${esc(p.title)}</h2>` : ''}
          <div class="post__text${long ? ' is-clamped' : ''}" data-text>${richText(p.text)}</div>
          ${long ? '<button class="post__more" type="button" data-more>Xem thêm</button>' : ''}
        </div>`;
    }

    /* Bài có ảnh: chú thích nằm dưới ảnh, mở đầu bằng tên tác giả (kiểu Instagram) */
    function captionHtml(p) {
        if (!p.text && !p.title) return '<div class="post__body post__caption" hidden></div>';
        const long = p.text.length > 160;
        return `<div class="post__body post__caption">
          <div class="post__text${long ? ' is-clamped' : ''}" data-text><a class="post__cap-name" href="${authorHref(p)}">${esc(p.who)}</a> ${p.title ? `<b class="post__cap-title">${esc(p.title)}</b> ` : ''}${richText(p.text)}</div>
          ${long ? '<button class="post__more" type="button" data-more>xem thêm</button>' : ''}
        </div>`;
    }

    function relationBtn(p) {
        if (p.isOwner) return '';
        if (p.isCompany && p.companyId) {
            return F.social
                ? `<button class="fx-follow fx-follow--text${p.following ? ' is-on' : ''}" type="button" data-follow="${p.companyId}" aria-pressed="${p.following}">${p.following ? 'Đang theo dõi' : 'Theo dõi'}</button>`
                : '';
        }
        if (p.relation === 'none') return `<button class="fx-follow fx-follow--text" type="button" data-connect="${p.userId}">Kết nối</button>`;
        if (p.relation === 'pending') return '<span class="fx-follow fx-follow--text is-sent">Đã gửi lời mời</span>';
        return '';
    }

    function metaLine(p) {
        const bits = [];
        if (p.isCompany) {
            if (p.industry) bits.push(esc(p.industry));
        } else if (p.jobTitle) {
            bits.push(esc(p.jobTitle));
        } else if (p.location) {
            bits.push(esc(p.location));
        }
        bits.push(`<time title="${fullDate(p.mins)}">${timeAgo(p.mins)}</time>`);
        if (p.isCompany && p.openJobs) bits.push(`<a href="/Company/Details/${p.companyId}#jobs">${p.openJobs} việc đang tuyển</a>`);
        if (p.edited) bits.push('Đã chỉnh sửa');
        return bits.join('<span class="post__dot" aria-hidden="true"></span>');
    }

    function stripHtml(p) {
        if (!p.isCompany || !p.companyId || !p.media) return '';
        const place = [p.who, p.companyAddress].filter(Boolean).map(esc).join(' · ');
        const go = p.openJobs ? `Xem ${p.openJobs} vị trí đang tuyển` : 'Xem trang công ty';
        return `<a class="post__strip" href="/Company/Details/${p.companyId}">
          <span class="post__strip-dot" aria-hidden="true"></span><span class="post__strip-place">${place}</span>
          <span class="post__strip-go">${go}<i data-lucide="arrow-right"></i></span></a>`;
    }

    function postHtml(p) {
        const isText = !p.media;
        const rel = relationBtn(p);
        return `<article class="post fx-card${isText ? ' post--text' : ''}" id="post-${p.id}" data-pid="${p.id}" tabindex="-1" aria-labelledby="post-${p.id}-by">
          <header class="post__head">
            <a class="post__face${p.isCompany ? ' is-org' : ''}" href="${authorHref(p)}" tabindex="-1" aria-hidden="true">${face(p.who, p.avatar, 40, p.isCompany)}</a>
            <div class="post__who">
              <div class="post__name"><a href="${authorHref(p)}" id="post-${p.id}-by">${esc(p.who)}</a>${p.verified ? '<i data-lucide="badge-check" class="fx-verified" aria-label="Đã xác minh"></i>' : ''}${rel ? `<span class="post__sep" aria-hidden="true">·</span>${rel}` : ''}</div>
              <div class="post__meta">${metaLine(p)}</div>
            </div>
            <button class="post__menu" type="button" data-menu aria-label="Tuỳ chọn bài viết" aria-haspopup="menu"><i data-lucide="more-horizontal"></i></button>
          </header>
          ${isText ? bodyHtml(p) : ''}
          ${p.media ? `<div class="post__media">${carHtml(p)}${stripHtml(p)}</div>` : ''}
          <div class="post__bar">
            ${likeBtnHtml(p, 'Thích · L')}
            <button class="act" type="button" data-comments aria-label="Bình luận" data-tip="Bình luận · C"><i data-lucide="message-circle"></i></button>
            <button class="act" type="button" data-share aria-label="Gửi cho bạn bè" data-tip="Gửi cho bạn bè"><i data-lucide="send"></i></button>
            <button class="act act--save" type="button" data-save aria-pressed="${p.saved}" aria-label="${p.saved ? 'Bỏ lưu' : 'Lưu bài viết'}" data-tip="Lưu · S"><i data-lucide="bookmark"></i></button>
          </div>
          <div class="post__foot">
            <div class="post__likes" data-likes>${likesHtml(p)}</div>
            ${isText ? '' : captionHtml(p)}
            <button class="post__ccount" type="button" data-comments ${p.commentCount ? '' : 'hidden'}>Xem <span class="a-num" data-ccount>${p.commentCount}</span> bình luận</button>
            <div class="post__mine" data-mine></div>
            <form class="post__reply" data-reply autocomplete="off">
              ${face(myName, myAvatar, 28, !!cfg.isBusiness)}
              <input class="post__reply-input" type="text" maxlength="1000" placeholder="Thêm bình luận…" aria-label="Bình luận bài của ${esc(p.who)}">
              <button class="post__reply-send" type="submit" disabled>Đăng</button>
            </form>
          </div>
        </article>`;
    }

    function makePost(p) {
        const t = document.createElement('div');
        t.innerHTML = postHtml(p);
        return t.firstElementChild;
    }

    function renderFeed() {
        if (!state.posts.length) return;
        list.innerHTML = state.posts.map(postHtml).join('');
        wireAll(list);
        renderIcons();
    }

    function wireAll(root) {
        $$('.car', root).forEach(wireCarousel);
        if (root.classList && root.classList.contains('car')) wireCarousel(root);
        $$('video[data-autoplay]', root).forEach((v) => { if (videoIO) videoIO.observe(v); });
    }

    /* Video trong Bảng tin: tự phát (tắt tiếng) khi hiện ≥ 60% trong khung nhìn, dừng khi cuộn qua — như Instagram.
       Người dùng đã tự bấm dừng thì không tự phát lại video đó. */
    const videoIO = ('IntersectionObserver' in window && !M.reduced()) ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            const v = e.target;
            if (v.closest('.pd')) return;
            if (e.isIntersecting && e.intersectionRatio >= 0.6) {
                if (v.dataset.userPaused !== '1') v.play().catch(() => {});
            } else if (!v.paused) {
                v.dataset.autoPausing = '1';
                v.pause();
            }
        });
    }, { threshold: [0, 0.6] }) : null;
    document.addEventListener('pause', (e) => {
        const v = e.target;
        if (!(v instanceof HTMLVideoElement) || !v.hasAttribute('data-autoplay')) return;
        if (v.dataset.autoPausing === '1') { delete v.dataset.autoPausing; return; }
        v.dataset.userPaused = '1';
    }, true);
    document.addEventListener('play', (e) => {
        const v = e.target;
        if (v instanceof HTMLVideoElement) delete v.dataset.userPaused;
    }, true);

    function ringFlash(el) {
        if (!el || !el.animate) return;
        const c = getComputedStyle(document.documentElement).getPropertyValue('--brand-line').trim() || '#2563EB';
        M.animate(el, [{ boxShadow: `0 0 0 3px ${c}` }, { boxShadow: `0 0 0 3px ${c}`, offset: 0.4 }, { boxShadow: '0 0 0 3px transparent' }], { duration: 1400, easing: 'ease-out' });
    }

    /* Thu gọn rồi xoá một phần tử (lời mời, gợi ý…) */
    function collapse(el, then) {
        const h = el.offsetHeight;
        const a = M.animate(el, [
            { height: h + 'px', opacity: 1 },
            { height: '0px', opacity: 0, marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' }
        ], { duration: M.reduced() ? 1 : 260, easing: 'ease-in', fill: 'forwards' });
        el.style.overflow = 'hidden';
        (a.finished || Promise.resolve()).then(() => { el.remove(); if (then) then(); }).catch(() => { el.remove(); if (then) then(); });
    }

    /* ---------------------------------------------------------------------------
       CAROUSEL (+ tự chọn tỉ lệ khung theo ảnh đầu tiên)
       --------------------------------------------------------------------------- */
    function wireCarousel(car) {
        if (car._wired) return;
        car._wired = true;
        const host = car.closest('[data-pid]');
        const p = host ? byId(+host.dataset.pid) : null;
        const track = $('.car__track', car);
        if (!track) return;
        const n = $$('.car__slide', car).length;
        const count = $('.car__count', car);
        let idx = 0;

        if (!car.closest('.pd')) {
            const first = $('.car__slide img, .car__slide video', car);
            const setRatio = (w, h) => {
                if (!w || !h) return;
                const min = isMobile() ? 0.8 : 1;
                car.style.setProperty('--ar', String(Math.min(1.91, Math.max(min, w / h))));
            };
            if (first && first.tagName === 'IMG') {
                if (first.complete && first.naturalWidth) setRatio(first.naturalWidth, first.naturalHeight);
                else first.addEventListener('load', () => setRatio(first.naturalWidth, first.naturalHeight), { once: true });
            } else if (first) {
                first.addEventListener('loadedmetadata', () => setRatio(first.videoWidth, first.videoHeight), { once: true });
            }
        }

        const sync = () => {
            const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
            if (i !== idx) {
                idx = i;
                car.dataset.idx = i;
                $$('.car__dot', car).forEach((d, k) => d.classList.toggle('is-on', k === i));
                if (count) {
                    count.textContent = `${i + 1}/${n}`;
                    count.classList.remove('is-idle');
                    clearTimeout(car._idle);
                    car._idle = setTimeout(() => count.classList.add('is-idle'), 1600);
                }
            }
            const pr = $('.car__btn--prev', car);
            const nx = $('.car__btn--next', car);
            if (pr) pr.hidden = i === 0;
            if (nx) nx.hidden = i === n - 1;
        };
        track.addEventListener('scroll', sync, { passive: true });

        car.step = (dir) => {
            const j = idx + dir;
            if (j < 0 || j >= n) { M.shake(track); return; }
            track.scrollTo({ left: j * track.clientWidth, behavior: M.reduced() ? 'auto' : 'smooth' });
        };
        car.goTo = (j) => { track.scrollTo({ left: j * track.clientWidth, behavior: 'auto' }); sync(); };

        let down = null;
        let lastUp = 0;
        let lx = 0;
        let ly = 0;
        track.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
        track.addEventListener('pointerup', (e) => {
            if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down = null; return; }
            down = null;
            if (e.timeStamp - lastUp < 320 && Math.hypot(e.clientX - lx, e.clientY - ly) < 40) {
                lastUp = 0;
                if (p) doubleLike(p, car, e);
                return;
            }
            lastUp = e.timeStamp;
            lx = e.clientX;
            ly = e.clientY;
        });
    }

    function doubleLike(p, car, e) {
        const r = car.getBoundingClientRect();
        const h = document.createElement('span');
        h.className = 'bigheart';
        h.innerHTML = HEART;
        h.style.left = (e.clientX - r.left) + 'px';
        h.style.top = (e.clientY - r.top) + 'px';
        car.append(h);
        const rot = (Math.random() * 24 - 12).toFixed(1);
        const a = h.animate([
            { transform: `scale(0) rotate(${rot}deg)`, opacity: 0 },
            { transform: `scale(1.18) rotate(${rot}deg)`, opacity: 1, offset: 0.22 },
            { transform: `scale(.94) rotate(${rot}deg)`, opacity: 1, offset: 0.36 },
            { transform: `scale(1) rotate(${rot}deg)`, opacity: 1, offset: 0.7 },
            { transform: `translateY(-48px) scale(.9) rotate(${rot}deg)`, opacity: 0 }
        ], { duration: M.reduced() ? 1 : 1000, easing: 'ease-out' });
        a.finished.then(() => h.remove()).catch(() => h.remove());
        if (p.liked) hosts(p).forEach((x) => { const b = $('[data-like]', x); if (b) M.pulse(b, 1.2); });
        else react(p, 'like', { anchor: $('[data-like]', car.closest('[data-pid]') || document) });
    }

    /* Tia hạt nổ ra quanh nút tim khi bấm thích (kiểu Instagram) */
    function likeBurst(btn) {
        if (M.reduced() || !btn || !btn.isConnected) return;
        const n = 8;
        for (let i = 0; i < n; i++) {
            const s = document.createElement('span');
            s.className = 'like-burst';
            s.setAttribute('aria-hidden', 'true');
            const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6;
            const dist = 24 + Math.random() * 16;
            const dx = (Math.cos(ang) * dist).toFixed(1);
            const dy = (Math.sin(ang) * dist).toFixed(1);
            btn.appendChild(s);
            s.animate([
                { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
                { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)`, opacity: 0 }
            ], { duration: 480 + Math.random() * 220, easing: 'cubic-bezier(.17,.67,.35,1)' })
                .finished.then(() => s.remove()).catch(() => s.remove());
        }
    }

    /* ---------------------------------------------------------------------------
       THÍCH (LẠC QUAN) · LƯU · THEO DÕI CÔNG TY · KẾT NỐI
       --------------------------------------------------------------------------- */
    /* Thích / thả cảm xúc (lạc quan).
       k = null: bấm nút — bật tim, hoặc gỡ cảm xúc đang có. k = một loại: đặt loại đó; chọn lại đúng loại đang có thì gỡ.
       fx = { anchor: nút đã dùng, from: vị trí mặt trong thanh chọn } — hiệu ứng chỉ chạy ở nút đó. */
    function react(p, k, fx = {}) {
        const cur = myKind(p);
        const next = k == null ? (cur ? null : 'like') : (k === cur ? null : k);
        const before = { liked: p.liked, myReaction: p.myReaction, likes: p.likes, reactions: p.reactions };
        const seq = (p._rxSeq = (p._rxSeq || 0) + 1);
        p.liked = !!next;
        p.myReaction = next;
        p.likes = Math.max(0, p.likes + (next ? 1 : 0) - (cur ? 1 : 0));
        if (RX) p.reactions = RX.shift(p.reactions, cur, next);
        syncLike(p, { fx: next ? fx : null, removed: !next ? fx.anchor : null });

        const body = { postId: p.id };
        if (k) body.kind = k;
        fetch('/Dashboard/ToggleLike', form(body))
            .then((res) => res.json())
            .then((data) => {
                if (!data.success) throw new Error(data.message || 'Lỗi thích');
                if (seq !== p._rxSeq) return; // a newer click is in flight; it decides
                p.liked = !!data.liked;
                p.myReaction = data.liked ? (data.kind || 'like') : null;
                p.likes = data.likeCount;
                if (Array.isArray(data.reactions)) p.reactions = data.reactions;
                syncLike(p, { quiet: true });
            })
            .catch(() => {
                if (seq !== p._rxSeq) return;
                Object.assign(p, before);
                syncLike(p, { quiet: true });
                hosts(p).forEach((x) => M.shake($('[data-like]', x)));
                M.toast('Chưa lưu được cảm xúc do lỗi kết nối.', { tone: 'danger' });
            });
    }

    function syncLike(p, o = {}) {
        const k = myKind(p);
        hosts(p).forEach((h) => {
            const b = $('[data-like]', h);
            if (b) {
                b.setAttribute('aria-pressed', String(!!k));
                b.dataset.kind = k || '';
                b.setAttribute('aria-label', !k ? 'Thích' : (k === 'like' || !RX ? 'Bỏ thích' : `Bỏ cảm xúc ${RX.kind(k).label}`));
                const emo = $('.act__emo', b);
                if (emo) emo.textContent = k && k !== 'like' && RX ? RX.kind(k).e : '';
            }
            const box = $('[data-likes]', h);
            if (box) {
                const oldNum = $('.a-num', box);
                const oldVal = oldNum ? (oldNum.dataset.value ?? oldNum.textContent.trim()) : null;
                const oldKinds = $$('.rx-stack__i', box).map((x) => x.className);
                box.innerHTML = likesHtml(p);
                if (o.quiet) return;
                const newNum = $('.a-num', box);
                if (newNum && oldVal !== null) {
                    newNum.dataset.value = oldVal;
                    const m = newNum.textContent.trim().match(/[\d.,]+/);
                    if (m) M.rollNumber(newNum, m[0]);
                }
                // A face that just joined the summary pops in.
                $$('.rx-stack__i', box).filter((x) => !oldKinds.includes(x.className)).forEach((x) =>
                    M.animate(x, [{ transform: 'scale(0)' }, { transform: 'scale(1.25)', offset: .6 }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' }));
            }
        });
        if (o.quiet) return;
        const anchor = o.fx && o.fx.anchor && o.fx.anchor.isConnected ? o.fx.anchor : null;
        if (k && anchor) {
            if (RX) RX.celebrate(anchor, k, { from: o.fx.from });
            else if ($('svg', anchor)) {
                M.animate($('svg', anchor), [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
                likeBurst(anchor);
            }
        } else if (!k && o.removed && o.removed.isConnected && $('svg', o.removed)) {
            M.animate($('svg', o.removed), [{ transform: 'scale(.8)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
        }
    }

    function toggleSave(p) {
        if (!F.social) { M.toast('Tính năng lưu bài sẽ bật sau khi hệ thống được cập nhật.'); return; }
        p.saved = !p.saved;
        syncSave(p, true);
        fetch('/Dashboard/ToggleSave', form({ postId: p.id }))
            .then((r) => r.json())
            .then((d) => {
                if (!d.success) throw new Error(d.message);
                if (typeof d.saved === 'boolean' && d.saved !== p.saved) { p.saved = d.saved; syncSave(p); }
                M.toast(p.saved ? 'Đã lưu bài viết.' : 'Đã bỏ lưu bài viết.', { tone: p.saved ? 'success' : 'default' });
            })
            .catch(() => {
                p.saved = !p.saved;
                syncSave(p);
                M.toast('Chưa lưu được bài viết, thử lại nhé.', { tone: 'danger' });
            });
    }

    function syncSave(p, animate) {
        hosts(p).forEach((h) => {
            const b = $('[data-save]', h);
            if (!b) return;
            b.setAttribute('aria-pressed', String(p.saved));
            b.setAttribute('aria-label', p.saved ? 'Bỏ lưu' : 'Lưu bài viết');
            if (animate && $('svg', b)) M.pulse($('svg', b), 1.2);
        });
    }

    async function toggleFollow(cid) {
        const mine = state.posts.filter((x) => x.companyId === cid);
        const next = !(mine[0] && mine[0].following);
        mine.forEach((x) => { x.following = next; });
        syncFollow(cid, next);
        try {
            const r = await fetch(`/Company/ToggleFollow/${cid}`, { method: 'POST' });
            const d = await r.json();
            if (!d.success) throw new Error(d.message);
            mine.forEach((x) => { x.following = d.following; });
            syncFollow(cid, d.following);
            M.toast(d.following ? 'Đã theo dõi công ty — tin và việc mới sẽ hiện trên Bảng tin.' : 'Đã bỏ theo dõi công ty.', { tone: d.following ? 'success' : 'default' });
        } catch (e) {
            mine.forEach((x) => { x.following = !next; });
            syncFollow(cid, !next);
            M.toast('Chưa theo dõi được, thử lại nhé.', { tone: 'danger' });
        }
    }

    function syncFollow(cid, on) {
        $$(`[data-follow="${cid}"]`).forEach((b) => {
            b.classList.toggle('is-on', !!on);
            b.setAttribute('aria-pressed', String(!!on));
            b.innerHTML = b.classList.contains('fx-follow--text')
                ? (on ? 'Đang theo dõi' : 'Theo dõi')
                : (on ? '<i data-lucide="check"></i>Đang theo dõi' : '<i data-lucide="plus"></i>Theo dõi');
        });
        renderIcons();
    }

    async function connect(uid, btn) {
        btn.disabled = true;
        try {
            const r = await fetch(`/Friends/SendRequest?userId=${uid}`, { method: 'POST' });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || d.success === false) throw new Error(d.message || 'Không gửi được lời mời.');
            const becameFriends = d.status === 'friends';
            state.posts.filter((x) => x.userId === +uid).forEach((x) => { x.relation = becameFriends ? 'friend' : 'pending'; });
            $$(`[data-connect="${uid}"]`).forEach((b) => {
                const done = document.createElement('span');
                done.className = b.className + ' is-sent';
                done.textContent = becameFriends ? 'Đã là bạn bè' : 'Đã gửi lời mời';
                b.replaceWith(done);
            });
            M.toast(becameFriends ? 'Hai bạn đã được kết nối.' : 'Đã gửi lời mời kết nối.', { tone: 'success' });
        } catch (e) {
            btn.disabled = false;
            M.toast(e.message || 'Không gửi được lời mời.', { tone: 'danger' });
        }
    }

    function expandText(btn) {
        const t = $('[data-text]', btn.parentElement);
        if (!t) return;
        t.classList.remove('is-clamped');
        btn.remove();
    }

    /* ---------------------------------------------------------------------------
       HỘP THOẠI BÀI VIẾT & BÌNH LUẬN
       --------------------------------------------------------------------------- */
    const pd = $('#postDialog');
    const pdScrim = $('#pdScrim');
    let pdPost = null;
    const EMO = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

    // Replies/likes need the V7 tables; threads are one level deep (the server flattens them).
    const canThread = () => !!(window.ArisFeatures && window.ArisFeatures.social);
    let replyTo = null; // { root, name } while answering a comment in the dialog

    const cKind = (c) => (c.isLiked ? (c.myReaction || 'like') : null);

    function cmtHtml(c, isReply) {
        const k = cKind(c);
        const likeText = !k ? 'Thích' : (k === 'like' || !RX ? 'Đã thích' : RX.kind(k).label);
        const menu = RX && RX.enabled() ? ' aria-haspopup="menu" aria-expanded="false"' : '';
        const acts = c.pending ? '<span>Đang gửi…</span>' : (canThread() ? `
              <button type="button" data-clike="${c.id}" class="${k ? `is-liked rx-k--${k}` : ''}" aria-pressed="${!!k}"${menu}>${likeText}</button>
              <button type="button" data-creply="${c.id}">Trả lời</button>` : '')
            + (!c.pending && (c.canDelete || c.isMine) ? `<button type="button" data-cdel="${c.id}">Xoá</button>` : '');
        // Right column: the comment's reaction summary (top faces + count) — opens "who reacted".
        const total = c.likeCount || 0;
        const summary = total > 0 && canThread() && !c.pending
            ? `<button type="button" class="cmt__rx" data-crx="${c.id}" aria-label="${total} lượt cảm xúc, xem ai đã thả">${RX ? RX.stackHtml(c.reactions && c.reactions.length ? c.reactions : [{ kind: 'like', count: total }], 2) : ''}<span class="a-num">${total}</span></button>`
            : '<span></span>';
        return `<div class="cmt${isReply ? ' cmt--reply' : ''}" id="c-${c.id}">
          <div class="cmt__face">${face(c.username, c.avatar, isReply ? 26 : 32)}</div>
          <div>
            <div class="cmt__body"><span class="cmt__name">${esc(c.username)}</span>${richText(c.content)}</div>
            <div class="cmt__meta cmt__acts"><span>${timeAgo(minsSince(c.createdAt))}</span>${acts}</div>
          </div>
          ${summary}
        </div>`;
    }

    /* Câu trả lời thu gọn kiểu Instagram ("—— Xem 3 câu trả lời"); trả lời mới thì mở luồng ra. */
    const threadToggle = (n, open) => `<button type="button" class="cmt__more" data-cthread aria-expanded="${open}">${open ? 'Ẩn câu trả lời' : `Xem ${n} câu trả lời`}</button>`;

    function threadHtml(list, rootId) {
        const replies = list.filter((x) => x.parentCommentId === rootId);
        return `<div class="cmt-thread${replies.length ? ' is-collapsed' : ''}" data-thread="${rootId}">${replies.length ? threadToggle(replies.length, false) : ''}${replies.map((r) => cmtHtml(r, true)).join('')}</div>`;
    }

    // Keeps a thread's toggle in step with its replies; `open` forces it open / closed.
    function syncThread(thread, open) {
        if (!thread) return;
        const n = $$(':scope > .cmt', thread).length;
        let btn = $(':scope > [data-cthread]', thread);
        if (!n) {
            if (btn) btn.remove();
            thread.classList.remove('is-collapsed');
            return;
        }
        if (typeof open === 'boolean') thread.classList.toggle('is-collapsed', !open);
        const isOpen = !thread.classList.contains('is-collapsed');
        if (!btn) {
            thread.insertAdjacentHTML('afterbegin', threadToggle(n, isOpen));
            btn = $(':scope > [data-cthread]', thread);
        }
        btn.setAttribute('aria-expanded', String(isOpen));
        btn.textContent = isOpen ? 'Ẩn câu trả lời' : `Xem ${n} câu trả lời`;
    }

    function wireComments(box) {
        if (box.__wired) return;
        box.__wired = true;
        box.addEventListener('click', (e) => {
            const r = e.target.closest('[data-creply]'), l = e.target.closest('[data-clike]'), d = e.target.closest('[data-cdel]');
            const s = e.target.closest('[data-crx]'), th = e.target.closest('[data-cthread]');
            if (r) startReply(+r.dataset.creply);
            else if (l) {
                if (RX && RX.wasHeld(l)) return;
                if (RX) RX.closeDock(true);
                reactComment(+l.dataset.clike, null);
            }
            else if (d) deleteComment(+d.dataset.cdel);
            else if (s && RX) RX.openList({ commentId: +s.dataset.crx }, s);
            else if (th) {
                const thread = th.parentElement;
                const opening = thread.classList.contains('is-collapsed');
                syncThread(thread, opening);
                if (opening && M.stagger) M.stagger($$(':scope > .cmt', thread), { max: 8, step: 24 });
            }
        });
    }

    function startReply(id) {
        const p = pdPost, c = p && (p.comments || []).find((x) => x.id === id);
        const formEl = $('#pdForm'), input = $('#pdInput');
        if (!c || !formEl || !input) return;
        replyTo = { root: c.parentCommentId || c.id, name: c.username };
        let bar = $('#pdReplying');
        if (!bar) {
            formEl.insertAdjacentHTML('beforebegin', '<div class="cmt-replying" id="pdReplying"><span></span><button type="button" aria-label="Huỷ trả lời">×</button></div>');
            bar = $('#pdReplying');
            $('button', bar).addEventListener('click', clearReply);
        }
        $('span', bar).textContent = c.isMine ? 'Đang trả lời bình luận của bạn' : `Đang trả lời ${c.username}`;
        if (!c.isMine && !input.value.includes('@' + c.username)) input.value = `@${c.username} ` + input.value;
        input.focus();
        input.dispatchEvent(new Event('input'));
    }

    function clearReply() {
        replyTo = null;
        const bar = $('#pdReplying');
        if (bar) bar.remove();
    }

    /* Thích / cảm xúc cho bình luận và câu trả lời — cùng quy tắc với bài viết (react). */
    function reactComment(id, k, fx = {}) {
        const p = pdPost, c = p && (p.comments || []).find((x) => x.id === id);
        if (!c || c.pending) return;
        const cur = cKind(c);
        const next = k == null ? (cur ? null : 'like') : (k === cur ? null : k);
        const before = { isLiked: c.isLiked, myReaction: c.myReaction, likeCount: c.likeCount, reactions: c.reactions };
        const seq = (c._rxSeq = (c._rxSeq || 0) + 1);
        c.isLiked = !!next;
        c.myReaction = next;
        c.likeCount = Math.max(0, (c.likeCount || 0) + (next ? 1 : 0) - (cur ? 1 : 0));
        if (RX) c.reactions = RX.shift(c.reactions, cur, next);
        redrawComment(id, c);
        const btn = $(`#c-${id} [data-clike]`);
        if (next && btn) {
            if (RX) RX.celebrate(btn, next, { from: fx.from, small: true });
            else M.pulse(btn, 1.2);
        }
        const pill = $(`#c-${id} .cmt__rx`);
        if (pill && next) M.pulse(pill, 1.15);

        fetch('/Dashboard/ToggleCommentLike/' + id + (k ? '?kind=' + encodeURIComponent(k) : ''), { method: 'POST' })
            .then((res) => res.json())
            .then((data) => {
                if (!data.success) throw new Error(data.message);
                if (seq !== c._rxSeq) return;
                c.isLiked = !!data.liked;
                c.myReaction = data.liked ? (data.kind || 'like') : null;
                c.likeCount = data.likeCount;
                if (Array.isArray(data.reactions)) c.reactions = data.reactions;
                redrawComment(id, c);
            })
            .catch((err) => {
                if (seq !== c._rxSeq) return;
                Object.assign(c, before);
                redrawComment(id, c);
                M.toast((err && err.message) || 'Chưa lưu được cảm xúc, thử lại nhé.', { tone: 'danger' });
            });
    }

    function deleteComment(id) {
        const p = pdPost;
        if (!p || !window.confirm('Xoá bình luận này? Các câu trả lời của nó cũng bị xoá.')) return;
        fetch('/Dashboard/DeleteComment/' + id, { method: 'DELETE' })
            .then((res) => res.json())
            .then((data) => {
                if (!data.success) throw new Error(data.message);
                const gone = new Set(data.removedIds || [id]);
                p.comments = (p.comments || []).filter((x) => !gone.has(x.id));
                gone.forEach((cid) => {
                    const el = $('#c-' + cid);
                    const parent = el && el.parentElement && el.parentElement.closest('.cmt-thread');
                    if (el) el.remove();
                    const t = $(`[data-thread="${cid}"]`);
                    if (t) t.remove();
                    if (parent) syncThread(parent);
                });
                if (typeof data.commentCount === 'number') p.commentCount = data.commentCount;
                syncCounts(p);
            })
            .catch((err) => M.toast((err && err.message) || 'Không thể xoá bình luận.', { tone: 'danger' }));
    }

    function redrawComment(oldId, c) {
        const el = $('#c-' + oldId);
        if (el) el.outerHTML = cmtHtml(c, !!c.parentCommentId);
        renderIcons();
    }

    const cmtSkel = () => Array.from({ length: 3 }, () => '<div class="cmt-skel" aria-hidden="true"><span class="a-skel" style="width:32px;height:32px;border-radius:50%"></span><div><span class="a-skel" style="height:12px;width:80%"></span><span class="a-skel" style="height:10px;width:35%"></span></div></div>').join('');

    function openPost(p, origin, opts = {}) {
        pdPost = p;
        pd.dataset.pid = p.id;
        pd.classList.toggle('pd--text', !p.media);

        pd.innerHTML = `
          ${p.media ? `<div class="pd__media">${carHtml(p)}</div>` : ''}
          <div class="pd__side">
            <div class="pd__tools">
              <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-menu aria-label="Tuỳ chọn bài viết"><i data-lucide="more-horizontal"></i></button>
              <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-pd-close aria-label="Đóng (Esc)"><i data-lucide="x"></i></button>
            </div>
            <div class="pd__mhead">Bình luận</div>
            <div class="pd__scroll" id="pdScroll">
              <div class="cmt cmt--caption"><a class="post__face" href="${authorHref(p)}">${face(p.who, p.avatar, 32, p.isCompany)}</a><div><div class="cmt__body"><a class="cmt__name" href="${authorHref(p)}">${esc(p.who)}</a>${p.verified ? '<i data-lucide="badge-check" class="fx-verified"></i> ' : ''}${p.title ? `<span class="cmt__title">${esc(p.title)}</span>` : ''}${richText(p.text)}</div><div class="cmt__meta post__meta">${metaLine(p)}</div></div><span></span></div>
              <div id="pdComments" aria-live="polite" aria-busy="true">${cmtSkel()}</div>
            </div>
            <div class="pd__foot">
              <div class="post__actions post__actions--icons">
                ${likeBtnHtml(p)}
                <button class="act" type="button" data-comments aria-label="Viết bình luận"><i data-lucide="message-circle"></i></button>
                <button class="act" type="button" data-share aria-label="Chia sẻ"><i data-lucide="share-2"></i></button>
                <button class="act act--save" type="button" data-save aria-pressed="${p.saved}" aria-label="${p.saved ? 'Bỏ lưu' : 'Lưu bài viết'}"><i data-lucide="bookmark"></i></button>
              </div>
              <div class="post__likes" data-likes>${likesHtml(p)}</div>
              <div class="pd__time">${fullDate(p.mins)}</div>
              <div class="qemoji" role="group" aria-label="Chèn nhanh biểu tượng cảm xúc">${EMO.map((x) => `<button type="button" data-emo="${x}" aria-label="Chèn ${x}">${x}</button>`).join('')}</div>
              <form class="pd__form" id="pdForm" autocomplete="off">
                ${face(myName, myAvatar, 32, !!cfg.isBusiness)}
                <textarea class="pd__input" id="pdInput" rows="1" placeholder="Viết bình luận…" aria-label="Viết bình luận" maxlength="1000"></textarea>
                <button class="post__qsend" type="submit" id="pdSend" disabled>Gửi</button>
              </form>
            </div>
          </div>`;

        renderIcons();
        const car = $('.car', pd);
        M.openDialog(pd, pdScrim, origin);
        if (car) {
            wireCarousel(car);
            const feedCar = $(`#post-${p.id} .car`);
            const idx = feedCar ? +(feedCar.dataset.idx || 0) : 0;
            requestAnimationFrame(() => car.goTo(idx));
        }

        const ta = $('#pdInput');
        ta.addEventListener('input', () => { autosize(ta, 96); $('#pdSend').disabled = !ta.value.trim(); });
        ta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                $('#pdForm').requestSubmit();
            }
        });
        $('#pdForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const text = ta.value.trim();
            if (!text) return;
            addComment(p, text, replyTo && replyTo.root);
            clearReply();
            ta.value = '';
            autosize(ta, 96);
            $('#pdSend').disabled = true;
        });
        if (opts.focus) setTimeout(() => ta.focus(), 320);

        fetch('/Dashboard/GetComments?postId=' + p.id)
            .then((res) => res.json())
            .then((comments) => { p.comments = Array.isArray(comments) ? comments : (comments.comments || []); renderPdComments(p); })
            .catch(() => renderPdComments(p));
    }

    function renderPdComments(p) {
        const box = $('#pdComments');
        if (!box || pdPost !== p) return;
        replyTo = null;
        wireComments(box);
        const list = p.comments || [];
        const top = list.filter((c) => !c.parentCommentId || !list.some((x) => x.id === c.parentCommentId));
        box.innerHTML = list.length
            ? top.map((c) => cmtHtml(c) + threadHtml(list, c.id)).join('')
            : '<div class="a-empty" style="padding:32px 8px"><i data-lucide="message-circle"></i><div class="a-empty__title">Chưa có bình luận</div><div class="a-empty__text">Hãy là người đầu tiên bình luận.</div></div>';
        box.setAttribute('aria-busy', 'false');
        renderIcons();
    }

    function addComment(p, text, parentId) {
        const c = { id: nid++, pending: true, username: myName, avatar: myAvatar, content: text, createdAt: new Date().toISOString(),
            parentCommentId: parentId || null, isMine: true, canDelete: true, likeCount: 0, isLiked: false };
        p.comments = p.comments || [];
        p.comments.push(c);
        p.commentCount++;
        syncCounts(p);
        if (pdPost === p && !pd.hidden) insertDialogComment(c);

        const fields = { postId: p.id, content: text };
        if (parentId) fields.parentCommentId = parentId;
        fetch('/Dashboard/AddComment', form(fields))
            .then((res) => res.json())
            .then((data) => {
                if (!data.success) throw new Error(data.message || 'Lỗi gửi bình luận');
                if (typeof data.commentCount === 'number') p.commentCount = data.commentCount;
                const tempId = c.id;
                if (data.comment) Object.assign(c, data.comment);
                c.pending = false;
                redrawComment(tempId, c);
                syncCounts(p);
            })
            .catch((err) => {
                p.comments = p.comments.filter((x) => x !== c);
                p.commentCount = Math.max(0, p.commentCount - 1);
                const el = $('#c-' + c.id);
                if (el) el.remove();
                syncCounts(p);
                M.toast((err && err.message) || 'Không thể gửi bình luận. Thử lại nhé.', { tone: 'danger' });
            });
    }

    /* Bình luận ngay trong thẻ (ô "Thêm bình luận…"): gửi qua addComment, hiện ngay dưới chú thích */
    function replyInline(form) {
        const host = form.closest('[data-pid]');
        const p = host && byId(+host.dataset.pid);
        const input = $('.post__reply-input', form);
        const text = input ? input.value.trim() : '';
        if (!p || !text) return;
        addComment(p, text);
        const mine = $('[data-mine]', host);
        if (mine) {
            mine.insertAdjacentHTML('beforeend', `<div class="post__cmt"><b>${esc(myName)}</b> ${richText(text)}</div>`);
            const last = mine.lastElementChild;
            if (last) M.animate(last, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
        }
        input.value = '';
        $('.post__reply-send', form).disabled = true;
    }

    function syncCounts(p) {
        hosts(p).forEach((h) => {
            $$('[data-ccount]', h).forEach((el) => { el.textContent = p.commentCount; });
            const cc = $('.post__ccount', h);
            if (cc) cc.hidden = p.commentCount <= 0;
        });
    }

    function insertDialogComment(c) {
        const box = $('#pdComments');
        if (!box) return;
        const empty = $('.a-empty', box);
        if (empty) empty.remove();
        const thread = c.parentCommentId && $(`[data-thread="${c.parentCommentId}"]`, box);
        if (thread) {
            thread.insertAdjacentHTML('beforeend', cmtHtml(c, true));
            syncThread(thread, true); // your new reply is never hidden in a collapsed thread
        }
        else box.insertAdjacentHTML('beforeend', cmtHtml(c) + `<div class="cmt-thread" data-thread="${c.id}"></div>`);
        renderIcons();
        const el = $('#c-' + c.id, box);
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    async function closePost() {
        if (pd.hidden) return;
        if (RX) RX.closeDock(true);
        await M.closeDialog(pd, pdScrim);
        pdPost = null;
        delete pd.dataset.pid;
        pd.innerHTML = '';
    }
    pdScrim.addEventListener('click', closePost);

    /* ---------------------------------------------------------------------------
       TẠO BÀI VIẾT: ảnh/video (3 bước), bài chữ, bài có tiêu đề, cột mốc
       --------------------------------------------------------------------------- */
    const cmD = $('#composeDialog');
    const cmScrim = $('#composeScrim');
    const cmFile = $('#cmFile');
    let cm = null;

    const newCm = (mode) => {
        const c = {
            mode: mode === 'media' ? 'media' : 'text',
            step: mode === 'media' ? 'pick' : 'write',
            mediaFiles: [],
            mediaPreviews: [],
            active: 0,
            title: '',
            showTitle: false,
            text: '',
            placeholder: 'Bạn muốn chia sẻ điều gì?'
        };
        if (mode === 'article') {
            c.showTitle = true;
            c.placeholder = 'Chia sẻ kinh nghiệm, kiến thức hoặc câu chuyện nghề nghiệp của bạn…';
        }
        if (mode === 'milestone') {
            c.showTitle = true;
            c.title = '🎉 Cột mốc mới';
            c.placeholder = 'Nhận việc mới, thăng chức, hoàn thành chứng chỉ, kỷ niệm năm làm việc…';
        }
        return c;
    };

    function openCompose(mode, origin) {
        if (cm && !cmD.hidden) return;
        cm = newCm(mode || 'text');
        renderCm();
        M.openDialog(cmD, cmScrim, origin);
        setTimeout(() => (cm && cm.step === 'write' ? $(cm.showTitle && !cm.title ? '#cmTitleIn' : '#cmText') : null)?.focus(), 280);
    }
    window.ArisCompose = (origin) => openCompose('text', origin);

    async function closeCompose(published) {
        if (!cm) return;
        const dirty = cm.mediaFiles.length || cm.text.trim() || (cm.title.trim() && cm.title !== '🎉 Cột mốc mới');
        if (!published && dirty) {
            const ok = await confirmDiscard();
            if (!ok) return;
        }
        await M.closeDialog(cmD, cmScrim);
        cm.mediaPreviews.forEach((m) => URL.revokeObjectURL(m.src));
        cm = null;
        cmD.style.width = '';
    }
    cmScrim.addEventListener('click', () => closeCompose());

    function renderCm() {
        const s = cm.step;
        const title = s === 'pick' ? 'Tạo bài viết mới' : s === 'arrange' ? 'Sắp xếp ảnh' : (cm.mode === 'text' ? 'Tạo bài viết' : 'Viết chú thích');
        const canBack = s === 'write' && cm.mode === 'media';
        const next = s === 'pick' ? '' : s === 'arrange' ? 'Tiếp' : 'Đăng';

        cmD.innerHTML = `
          <div class="a-dialog__head">
            ${canBack ? '<button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-cm-back aria-label="Quay lại"><i data-lucide="arrow-left"></i></button>'
                : '<button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-cm-close aria-label="Đóng"><i data-lucide="x"></i></button>'}
            <h2 class="a-dialog__title" id="cmTitle">${title}</h2>
            ${next ? `<button class="a-btn a-btn--primary a-btn--sm" type="button" data-cm-next>${next}</button>` : '<span style="width:32px" aria-hidden="true"></span>'}
          </div>
          <div class="cm__body">${s === 'pick' ? pickHtml() : s === 'arrange' ? arrangeHtml() : writeHtml()}</div>`;

        renderIcons();
        cmD.style.width = (s === 'write' && cm.mode === 'media' && !isMobile()) ? 'min(900px, calc(100vw - 32px))' : '';
        wireCm();
        validateCm();
    }

    function pickHtml() {
        return `<div class="cm-drop" id="cmDrop">
          <span class="cm-drop__icon"><i data-lucide="images"></i></span>
          <div class="cm-drop__title">Kéo ảnh và video vào đây</div>
          <div class="cm-drop__text">Tối đa 10 tệp ảnh hoặc video</div>
          <div class="cm-drop__actions">
            <button class="a-btn a-btn--primary" type="button" data-cm-pick>Chọn từ máy</button>
          </div>
          <button class="a-btn a-btn--ghost a-btn--sm" type="button" data-cm-textonly><i data-lucide="type"></i>Chỉ viết chữ</button>
        </div>`;
    }

    function arrangeHtml() {
        const m = cm.mediaPreviews[cm.active];
        return `<div class="cm-arrange">
          <div class="cm-frame" id="cmFrame" style="max-height:420px;display:grid;place-items:center">
            ${m ? (m.kind === 'video' ? `<video src="${m.src}" muted playsinline loop autoplay controls style="max-height:100%;max-width:100%"></video>` : `<img src="${m.src}" alt="" style="max-height:100%;max-width:100%;object-fit:contain">`) : ''}
          </div>
          <div class="cm-strip" id="cmStrip">
            ${cm.mediaPreviews.map((p, i) => `
              <div class="cm-thumb${i === cm.active ? ' is-active' : ''}" data-mid="${p.id}" role="button" tabindex="0" aria-label="Ảnh ${i + 1}">
                ${p.kind === 'video' ? `<video src="${p.src}"></video>` : `<img src="${p.src}" alt="">`}
                <span class="cm-thumb__n">${i + 1}</span>
                <button class="cm-thumb__x" type="button" data-cm-remove="${p.id}" aria-label="Bỏ ảnh ${i + 1}"><i data-lucide="x"></i></button>
              </div>`).join('')}
            ${cm.mediaPreviews.length < 10 ? '<button class="cm-add" type="button" data-cm-pick aria-label="Thêm ảnh"><i data-lucide="plus"></i></button>' : ''}
          </div>
        </div>`;
    }

    function writeHtml() {
        const hasMedia = cm.mode === 'media' && cm.mediaPreviews.length > 0;
        return `<div class="cm-write${hasMedia ? ' has-media' : ''}">
          ${hasMedia ? `<div class="cm-write__preview">${cm.mediaPreviews[0].kind === 'video' ? `<video src="${cm.mediaPreviews[0].src}" muted playsinline loop autoplay></video>` : `<img src="${cm.mediaPreviews[0].src}" alt="">`}</div>` : ''}
          <div class="cm-fields">
            <div class="cm-author">${face(myName, myAvatar, 32, !!cfg.isBusiness)}<span>${esc(myName)}</span></div>
            <div id="cmTitleWrap" style="${cm.showTitle ? '' : 'display:none;'}">
              <input class="cm-title" id="cmTitleIn" placeholder="Tiêu đề bài viết" maxlength="120" value="${esc(cm.title)}" aria-label="Tiêu đề">
            </div>
            <textarea class="cm-text" id="cmText" aria-label="Nội dung" maxlength="2200" placeholder="${esc(hasMedia ? 'Viết chú thích…' : cm.placeholder)}">${esc(cm.text)}</textarea>
            <div class="cm-sep"></div>
            <div class="cm-row">
              <button class="a-btn a-btn--ghost a-btn--sm" type="button" data-cm-title><i data-lucide="heading"></i>${cm.showTitle ? 'Bỏ tiêu đề' : 'Thêm tiêu đề'}</button>
              ${cm.mode === 'text' ? '<button class="a-btn a-btn--ghost a-btn--sm" type="button" data-cm-addmedia><i data-lucide="image"></i>Thêm ảnh</button>' : ''}
              <span class="cm-count"><span class="a-num" id="cmCount">${cm.text.length}</span>/2.200</span>
            </div>
          </div>
        </div>`;
    }

    function wireCm() {
        const drop = $('#cmDrop');
        if (drop) {
            ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
            drop.addEventListener('dragleave', (e) => { if (!drop.contains(e.relatedTarget)) drop.classList.remove('is-over'); });
            drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); addFiles(e.dataTransfer.files); });
        }
        const text = $('#cmText');
        if (text) {
            text.addEventListener('input', () => {
                cm.text = text.value;
                const c = $('#cmCount');
                if (c) c.textContent = text.value.length;
                autosize(text, 320);
                validateCm();
            });
            autosize(text, 320);
        }
        const ti = $('#cmTitleIn');
        if (ti) ti.addEventListener('input', () => { cm.title = ti.value; validateCm(); });
    }

    function validateCm() {
        const btn = $('[data-cm-next]', cmD);
        if (!btn) return;
        let ok = true;
        if (cm.step === 'arrange') ok = cm.mediaPreviews.length > 0;
        if (cm.step === 'write') {
            ok = cm.mode === 'text'
                ? (!!cm.text.trim() || (cm.showTitle && !!cm.title.trim() && cm.title.trim() !== '🎉 Cột mốc mới'))
                : (cm.mediaPreviews.length > 0 || !!cm.text.trim());
        }
        btn.disabled = !ok;
    }

    function addFiles(files) {
        const arr = Array.from(files).filter((f) => /^(image|video)\//.test(f.type));
        if (!arr.length) { M.toast('Chỉ nhận tệp ảnh hoặc video.', { tone: 'danger' }); return; }
        const room = 10 - cm.mediaPreviews.length;
        if (arr.length > room) M.toast('Mỗi bài tối đa 10 tệp.');
        arr.slice(0, Math.max(0, room)).forEach((f) => {
            cm.mediaPreviews.push({ id: nid++, src: URL.createObjectURL(f), kind: f.type.startsWith('video') ? 'video' : 'image', file: f });
            cm.mediaFiles.push(f);
        });
        cm.mode = 'media';
        cm.step = 'arrange';
        renderCm();
    }

    cmD.addEventListener('click', (e) => {
        const t = e.target;
        let b;
        if (t.closest('[data-cm-close]')) { closeCompose(); return; }
        if (t.closest('[data-cm-back]')) { cm.step = 'arrange'; renderCm(); return; }
        if ((b = t.closest('[data-cm-next]'))) {
            if (b.disabled) return;
            if (cm.step === 'arrange') { cm.step = 'write'; renderCm(); return; }
            publishPost(b);
            return;
        }
        if (t.closest('[data-cm-pick]')) { cmFile.click(); return; }
        if (t.closest('[data-cm-textonly]')) { cm.mode = 'text'; cm.step = 'write'; renderCm(); return; }
        if (t.closest('[data-cm-addmedia]')) { cm.mode = 'media'; cm.step = 'pick'; renderCm(); return; }
        if ((b = t.closest('[data-cm-remove]'))) {
            const idx = cm.mediaPreviews.findIndex((x) => x.id === +b.dataset.cmRemove);
            if (idx >= 0) {
                URL.revokeObjectURL(cm.mediaPreviews[idx].src);
                cm.mediaPreviews.splice(idx, 1);
                cm.mediaFiles.splice(idx, 1);
                if (cm.active >= cm.mediaPreviews.length) cm.active = Math.max(0, cm.mediaPreviews.length - 1);
                if (!cm.mediaPreviews.length) cm.step = 'pick';
                renderCm();
            }
            return;
        }
        if ((b = t.closest('.cm-thumb'))) {
            cm.active = cm.mediaPreviews.findIndex((x) => x.id === +b.dataset.mid);
            renderCm();
            return;
        }
        if (t.closest('[data-cm-title]')) {
            cm.showTitle = !cm.showTitle;
            const w = $('#cmTitleWrap');
            if (w) w.style.display = cm.showTitle ? 'block' : 'none';
            const bt = $('[data-cm-title]', cmD);
            if (bt) bt.innerHTML = `<i data-lucide="heading"></i>${cm.showTitle ? 'Bỏ tiêu đề' : 'Thêm tiêu đề'}`;
            renderIcons();
            if (cm.showTitle) $('#cmTitleIn')?.focus();
            validateCm();
        }
    });

    cmFile.addEventListener('change', () => {
        if (cm && cmFile.files.length) addFiles(cmFile.files);
        cmFile.value = '';
    });

    async function publishPost(btn) {
        M.morphButton(btn, 'loading');
        const fd = new FormData();
        fd.append('content', cm.text.trim());
        if (cm.showTitle && cm.title.trim()) fd.append('title', cm.title.trim());
        cm.mediaFiles.forEach((file) => fd.append('mediaFiles', file));

        try {
            const res = await fetch('/Dashboard/CreatePost', { method: 'POST', body: fd });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Lỗi đăng bài');
            const d = data.data || {};
            const newP = fromDto({
                id: d.id,
                userId: myId,
                authorName: myName,
                authorAvatar: myAvatar,
                authorTitle: cfg.currentUserTitle,
                authorLocation: cfg.currentUserLocation,
                title: d.title,
                text: d.content,
                mins: 0,
                isOwner: true,
                media: d.media && d.media.length ? d.media.map((m) => ({ src: m.url, kind: m.type === 'video' ? 'video' : 'image' })) : null,
                isCompany: !!cfg.isBusiness,
                companyId: cfg.companyId,
                relation: 'self'
            });
            await closeCompose(true);
            $('.feed-empty', list)?.remove();
            state.posts.unshift(newP);
            const el = makePost(newP);
            list.prepend(el);
            wireAll(el);
            renderIcons();
            ringFlash(el);
            M.toast('Đã đăng bài viết.', { tone: 'success' });
        } catch (err) {
            M.morphButton(btn, 'idle');
            M.toast(err.message || 'Lỗi máy chủ khi đăng bài.', { tone: 'danger' });
        }
    }

    function confirmDiscard() {
        return new Promise((resolve) => {
            const d = $('#confirmDialog');
            const s = $('#confirmScrim');
            d.innerHTML = `<div class="confirm__body"><div class="confirm__title" id="confirmTitle">Bỏ bài viết này?</div><div class="confirm__text" id="confirmText">Nội dung bạn vừa soạn sẽ không được lưu.</div></div>
              <div class="confirm__btns"><button type="button" data-yes>Bỏ bài viết</button><button type="button" data-no>Tiếp tục soạn</button></div>`;
            M.openDialog(d, s);
            setTimeout(() => $('[data-no]', d)?.focus(), 40);
            const done = async (v) => {
                d.onclick = null;
                s.onclick = null;
                await M.closeDialog(d, s);
                resolve(v);
            };
            d.onclick = (e) => {
                if (e.target.closest('[data-yes]')) done(true);
                if (e.target.closest('[data-no]')) done(false);
            };
            s.onclick = () => done(false);
        });
    }

    /* ---------------------------------------------------------------------------
       MENU "…": sửa · xoá · lưu · chia sẻ · sao chép · ẩn · nhắn tin
       --------------------------------------------------------------------------- */
    const pop = $('#postMenu');
    const closeMenu = () => { if (window.closePopover && !pop.hidden) window.closePopover(); else pop.hidden = true; };
    function openMenu(btn, p) {
        const items = p.isOwner
            ? [['pencil', 'Sửa bài viết', 'edit'], ['link', 'Sao chép liên kết', 'copy'], ['trash-2', 'Xoá bài viết', 'delete', true]]
            : [
                [p.saved ? 'bookmark-minus' : 'bookmark', p.saved ? 'Bỏ lưu' : 'Lưu bài viết', 'save'],
                ['share-2', 'Chia sẻ cho bạn bè', 'share'],
                ['link', 'Sao chép liên kết', 'copy'],
                ...(F.social ? [['eye-off', 'Ẩn bài viết này', 'hide']] : []),
                ['message-circle', `Nhắn tin cho ${p.who}`, 'message']
            ];
        pop.innerHTML = items.map((it) => `<button class="a-menu__item${it[3] ? ' a-menu__item--danger' : ''}" type="button" role="menuitem" data-mact="${it[2]}"><i data-lucide="${it[0]}"></i>${esc(it[1])}</button>`).join('');
        renderIcons();
        pop.onclick = (e) => {
            const b = e.target.closest('[data-mact]');
            if (!b) return;
            closeMenu();
            menuAction(b.dataset.mact, p, btn);
        };
        if (window.openPopover) {
            window.openPopover(pop, btn, 'bottom-end');
        } else {
            const r = btn.getBoundingClientRect();
            pop.hidden = false;
            pop.style.position = 'fixed';
            pop.style.top = (r.bottom + 6) + 'px';
            pop.style.left = Math.max(8, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 8)) + 'px';
        }
    }

    function menuAction(act, p, btn) {
        if (act === 'edit') startEdit(p);
        else if (act === 'copy') copyLink(p);
        else if (act === 'delete') deletePost(p);
        else if (act === 'save') toggleSave(p);
        else if (act === 'share') openShare(p, btn);
        else if (act === 'hide') hidePost(p);
        else if (act === 'message') location.href = '/Chat?userId=' + p.userId;
    }

    function copyLink(p) {
        const url = `${location.origin}/Dashboard?post=${p.id}`;
        if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
        M.toast('Đã sao chép liên kết bài viết.', { tone: 'success' });
    }

    function hidePost(p) {
        const el = $('#post-' + p.id);
        if (!el) return;
        const ph = document.createElement('div');
        ph.className = 'post-hidden fx-card';
        ph.innerHTML = '<i data-lucide="eye-off"></i><span>Đã ẩn bài viết này khỏi Bảng tin của bạn.</span><button class="a-btn a-btn--ghost a-btn--sm" type="button" data-unhide>Hoàn tác</button>';
        el.replaceWith(ph);
        renderIcons();
        fetch(`/Dashboard/Hide/${p.id}`, { method: 'POST' }).catch(() => {});
        $('[data-unhide]', ph).addEventListener('click', () => {
            fetch(`/Dashboard/Hide/${p.id}`, { method: 'DELETE' }).catch(() => {});
            ph.replaceWith(el);
            ringFlash(el);
        });
    }

    function deletePost(p) {
        const el = $('#post-' + p.id);
        if (!el) return;
        const idx = state.posts.indexOf(p);
        el.style.display = 'none';
        state.posts.splice(idx, 1);
        let undone = false;
        M.toast('Đã xoá bài viết.', {
            action: {
                label: 'Hoàn tác',
                onClick: () => {
                    undone = true;
                    state.posts.splice(idx, 0, p);
                    el.style.display = '';
                    ringFlash(el);
                }
            }
        });
        setTimeout(() => {
            if (undone) return;
            fetch('/Dashboard/DeletePost/' + p.id, { method: 'DELETE' });
            el.remove();
        }, 6500);
    }

    function startEdit(p) {
        const el = $('#post-' + p.id);
        if (!el || $('.post__edit', el)) return;
        const body = $('.post__body', el);
        const ed = document.createElement('div');
        ed.className = 'post__edit';
        ed.innerHTML = `
          ${p.title != null ? `<input class="a-input" data-etitle value="${esc(p.title)}" placeholder="Tiêu đề (không bắt buộc)" aria-label="Tiêu đề">` : ''}
          <textarea class="a-textarea" data-etext rows="2" aria-label="Nội dung bài viết">${esc(p.text)}</textarea>
          <div class="post__edit-foot">
            <span class="a-help">Esc để huỷ · Ctrl + Enter để lưu</span>
            <button class="a-btn a-btn--ghost a-btn--sm" type="button" data-ecancel>Huỷ</button>
            <button class="a-btn a-btn--primary a-btn--sm" type="button" data-esave>Lưu</button>
          </div>`;
        if (body) body.hidden = true;
        (body || $('.post__head', el)).after(ed);

        const ta = $('textarea', ed);
        autosize(ta);
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);

        const cancel = () => { ed.remove(); if (body) body.hidden = !(p.text || p.title); };
        const save = async () => {
            const btn = $('[data-esave]', ed);
            M.morphButton(btn, 'loading');
            const payload = { id: p.id, content: ta.value.trim() };
            const ti = $('[data-etitle]', ed);
            if (ti && ti.value.trim()) payload.title = ti.value.trim();
            try {
                const res = await fetch('/Dashboard/EditPost', form(payload));
                const data = await res.json();
                if (!data.success) throw new Error(data.message || 'Lỗi cập nhật');
                p.text = data.content;
                p.title = data.title;
                p.edited = true;
                const fresh = makePost(p);
                el.replaceWith(fresh);
                wireAll(fresh);
                renderIcons();
                ringFlash(fresh);
                M.toast('Đã lưu thay đổi.', { tone: 'success' });
            } catch (err) {
                M.morphButton(btn, 'idle');
                M.toast(err.message || 'Không thể lưu bài viết.', { tone: 'danger' });
            }
        };
        ed.addEventListener('click', (e) => {
            if (e.target.closest('[data-ecancel]')) cancel();
            if (e.target.closest('[data-esave]')) save();
        });
        ed.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
        });
    }

    /* ---------------------------------------------------------------------------
       CHIA SẺ CHO BẠN BÈ
       --------------------------------------------------------------------------- */
    const share = $('#shareDialog');
    const shareScrim = $('#shareScrim');
    let sharePost = null;

    function openShare(p, origin) {
        sharePost = p;
        share.innerHTML = `
          <div class="a-dialog__head"><h2 class="a-dialog__title" id="shareTitle">Chia sẻ bài viết</h2><button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-share-close aria-label="Đóng"><i data-lucide="x"></i></button></div>
          <div class="a-dialog__body">
            <label class="a-search share__search"><i data-lucide="search"></i><input class="a-input" id="shareQ" type="search" placeholder="Tìm bạn bè…" autocomplete="off" aria-label="Tìm bạn bè"></label>
            <div class="share__grid" id="shareGrid" role="group" aria-label="Chọn người nhận">
              <div class="share__note">Đang tải bạn bè…</div>
            </div>
          </div>
          <div class="share__apps">
            <button class="share__app" type="button" data-share-copy><span><i data-lucide="link"></i></span><span>Sao chép liên kết</span></button>
            <button class="share__app" type="button" data-share-chat><span><i data-lucide="message-circle"></i></span><span>Mở tin nhắn</span></button>
          </div>`;
        renderIcons();
        M.openDialog(share, shareScrim, origin);

        fetch('/Friends/GetFriends')
            .then((r) => r.json())
            .then((friends) => {
                const grid = $('#shareGrid');
                if (!grid) return;
                if (!friends || !friends.length) { grid.innerHTML = '<div class="share__note">Chưa có bạn bè nào để gửi.</div>'; return; }
                grid.innerHTML = friends.map((f) => `
                  <button class="share__p" type="button" data-sp-user="${f.userId}" data-name="${esc((f.username || '').toLowerCase())}">
                    ${face(f.username, f.avatar, 52)}
                    <span>${esc(f.username)}</span>
                  </button>`).join('');
                const q = $('#shareQ');
                q.addEventListener('input', () => {
                    const v = q.value.trim().toLowerCase();
                    $$('.share__p', grid).forEach((b) => { b.hidden = !!v && !b.dataset.name.includes(v); });
                });
            })
            .catch(() => { const g = $('#shareGrid'); if (g) g.innerHTML = '<div class="share__note">Không thể tải danh sách bạn bè.</div>'; });
    }

    share.addEventListener('click', (e) => {
        if (e.target.closest('[data-share-close]')) { M.closeDialog(share, shareScrim); return; }
        if (e.target.closest('[data-share-copy]')) { copyLink(sharePost); M.closeDialog(share, shareScrim); return; }
        if (e.target.closest('[data-share-chat]')) { location.href = '/Chat'; return; }
        const b = e.target.closest('[data-sp-user]');
        if (b) location.href = `/Chat?userId=${b.dataset.spUser}`;
    });
    shareScrim.addEventListener('click', () => M.closeDialog(share, shareScrim));

    /* ---------------------------------------------------------------------------
       PHÍM TẮT & DI CHUYỂN J / K
       --------------------------------------------------------------------------- */
    const keysD = $('#keysDialog');
    const keysScrim = $('#keysScrim');
    const KEYS_DATA = [
        ['J', 'K', 'Bài tiếp / bài trước'],
        ['L', null, 'Thích bài đang xem'],
        ['C', null, 'Mở bình luận'],
        ['S', null, 'Lưu bài'],
        ['N', null, 'Tạo bài viết'],
        ['Ctrl', 'K', 'Tìm kiếm mọi thứ'],
        ['Ctrl', '\\', 'Thu gọn / mở rộng thanh bên'],
        ['?', null, 'Bảng phím tắt'],
        ['Esc', null, 'Đóng hộp thoại']
    ];

    function openKeys() {
        keysD.innerHTML = `
          <div class="a-dialog__head"><h2 class="a-dialog__title" id="keysTitle">Phím tắt</h2><button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-keys-close aria-label="Đóng"><i data-lucide="x"></i></button></div>
          <div class="a-dialog__body">${KEYS_DATA.map(([a, b, l]) => `<div class="keys__row"><span>${l}</span><span><span class="a-kbd">${esc(a)}</span>${b ? `<span class="a-kbd">${esc(b)}</span>` : ''}</span></div>`).join('')}</div>`;
        renderIcons();
        M.openDialog(keysD, keysScrim);
        keysD.onclick = (e) => { if (e.target.closest('[data-keys-close]')) M.closeDialog(keysD, keysScrim); };
    }
    keysScrim.addEventListener('click', () => M.closeDialog(keysD, keysScrim));

    const postsList = () => $$('.post', list);
    function currentPost() {
        const a = document.activeElement && document.activeElement.closest && document.activeElement.closest('.post');
        if (a) return a;
        const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 0) + 40;
        return postsList().find((el) => el.getBoundingClientRect().bottom > top + 100) || null;
    }
    function movePost(dir) {
        const all = postsList();
        const cur = currentPost();
        const i = cur ? all.indexOf(cur) : -1;
        const next = all[Math.max(0, Math.min(all.length - 1, i + dir))];
        if (!next) return;
        next.focus({ preventScroll: true });
        next.scrollIntoView({ block: 'start', behavior: M.reduced() ? 'auto' : 'smooth' });
    }

    /* ---------------------------------------------------------------------------
       CỘT PHẢI: phỏng vấn · lời mời kết nối · gợi ý kết bạn · số liệu trực tiếp
       --------------------------------------------------------------------------- */
    async function respondInterview(id, accept, b) {
        b.disabled = true;
        try {
            const res = await fetch(`/JobApplications/RespondToInterview?applicationId=${id}&accept=${accept}`, { method: 'POST' });
            const d = await res.json();
            if (!d.success) throw new Error(d.message);
            const card = b.closest('.iv');
            if (accept) {
                const wrap = $('.iv__actions', card);
                if (wrap) wrap.outerHTML = '<div class="todo__done"><i data-lucide="check-circle-2"></i>Đã nhận lời — hẹn gặp bạn nhé!</div>';
                renderIcons();
                M.toast('Đã nhận lời mời phỏng vấn.', { tone: 'success' });
            } else {
                collapse(card, bumpTodo);
                M.toast('Đã từ chối lời mời phỏng vấn.');
            }
        } catch (err) {
            b.disabled = false;
            M.toast('Không thực hiện được, thử lại nhé.', { tone: 'danger' });
        }
    }

    function bumpTodo() {
        const c = $('[data-todo-count]');
        const n = $$('#todoSide .iv, #todoSide .todo-row').length;
        if (c) { c.textContent = n; c.hidden = n === 0; }
        if (!n) {
            const box = $('#todoSide .todo-list');
            if (box && !$('.todo-empty', box)) {
                box.insertAdjacentHTML('beforeend', '<div class="todo-empty"><i data-lucide="check-circle-2"></i>Không có việc gì cần làm. Bạn đang rất ổn!</div>');
                renderIcons();
            }
        }
    }

    async function respondRequest(id, accept, btn) {
        const card = btn.closest('.req');
        $$('button', card).forEach((b) => { b.disabled = true; });
        try {
            const r = await fetch(accept ? '/Friends/AcceptRequest' : '/Friends/DeclineRequest', form({ requestId: id }));
            if (!r.ok) throw new Error();
            const c = $('[data-req-count]');
            if (c) c.textContent = Math.max(0, (+c.textContent || 1) - 1);
            const after = () => { if (!$('#reqSide .req')) { const sec = $('#reqSide'); if (sec) collapse(sec); } };
            if (accept) {
                const wrap = $('.req__actions', card);
                if (wrap) wrap.outerHTML = '<div class="todo__done"><i data-lucide="check-circle-2"></i>Đã kết nối</div>';
                renderIcons();
                M.toast('Đã chấp nhận lời mời kết nối.', { tone: 'success' });
                setTimeout(() => collapse(card, after), 1800);
            } else {
                collapse(card, after);
            }
        } catch (e) {
            $$('button', card).forEach((b) => { b.disabled = false; });
            M.toast('Không thực hiện được, thử lại nhé.', { tone: 'danger' });
        }
    }

    async function loadSuggestions() {
        const sec = $('#suggestSide');
        if (!sec || !F.social) return;
        try {
            const r = await fetch('/Friends/Suggestions?take=3');
            const d = await r.json();
            if (!Array.isArray(d) || !d.length) return;
            $('#suggestList').innerHTML = d.map((s) => {
                const sub = s.mutualCount > 0 ? s.reason : (s.headline && s.headline !== 'Chưa có tiểu sử.' ? s.headline : s.reason);
                return `<div class="person" data-sugg="${s.id}">
                  <a class="person__face" href="/Profile/View/${s.id}" tabindex="-1" aria-hidden="true">${face(s.name, s.avatar, 40)}</a>
                  <div class="person__text"><a class="person__name" href="/Profile/View/${s.id}">${esc(s.name)}</a><div class="person__sub">${esc(sub)}</div></div>
                  <button class="fx-follow fx-follow--sm" type="button" data-connect="${s.id}"><i data-lucide="user-plus"></i>Kết nối</button>
                  <button class="person__x" type="button" data-sugg-x="${s.id}" aria-label="Bỏ qua gợi ý ${esc(s.name)}"><i data-lucide="x"></i></button>
                </div>`;
            }).join('');
            sec.hidden = false;
            renderIcons();
        } catch (e) { /* không có gợi ý thì ẩn cả mục */ }
    }

    function dismissSuggestion(uid, btn) {
        const row = btn.closest('.person');
        fetch('/Friends/DismissSuggestion', form({ userId: uid })).catch(() => {});
        collapse(row, () => { if (!$('#suggestList .person')) { const sec = $('#suggestSide'); if (sec) sec.hidden = true; } });
    }

    function fetchLiveStats() {
        if (document.hidden) return;
        fetch('/Dashboard/GetLiveStats')
            .then((r) => r.json())
            .then((d) => {
                const j = $('#liveJobs');
                const o = $('#liveOnline');
                if (j && d.activeJobCount !== undefined && +j.textContent !== d.activeJobCount) M.rollNumber(j, d.activeJobCount);
                if (o && d.onlineFriendsCount !== undefined && +o.textContent !== d.onlineFriendsCount) M.rollNumber(o, d.onlineFriendsCount);
            })
            .catch(() => {});
    }

    /* ---------------------------------------------------------------------------
       "N BÀI MỚI" (SignalR) · CUỘN VÔ HẠN
       --------------------------------------------------------------------------- */
    const pill = $('#newPill');
    let incomingPosts = [];

    function showPill() {
        $('#newPillAvs').innerHTML = incomingPosts.slice(0, 3).map((n) => face(n.authorName, n.authorAvatar, 22)).join('');
        $('#newPillText').textContent = `${incomingPosts.length} bài mới`;
        if (pill.hidden) {
            pill.hidden = false;
            M.animate(pill, [{ transform: 'translateY(-12px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1.25)' });
        }
    }

    pill.addEventListener('click', async () => {
        pill.hidden = true;
        const n = incomingPosts.length;
        incomingPosts = [];
        try {
            const r = await fetch(`/Dashboard/GetPosts?take=${Math.min(20, n + 3)}`);
            const d = await r.json();
            const fresh = (d.posts || []).map(fromDto).filter((p) => !byId(p.id)).reverse();
            if (fresh.length) $('.feed-empty', list)?.remove();
            fresh.forEach((p) => {
                state.posts.unshift(p);
                const el = makePost(p);
                list.prepend(el);
                wireAll(el);
                ringFlash(el);
            });
            renderIcons();
        } catch (e) { /* bỏ qua */ }
        window.scrollTo({ top: 0, behavior: M.reduced() ? 'auto' : 'smooth' });
    });

    let hasMore = state.posts.length >= 10;
    let loadingMore = false;
    const skel = () => '<div class="post-skel fx-card" aria-hidden="true"><div class="post-skel__head"><span class="a-skel" style="width:44px;height:44px;border-radius:50%"></span><div style="flex:1;display:grid;gap:6px"><span class="a-skel" style="height:12px;width:40%"></span><span class="a-skel" style="height:10px;width:25%"></span></div></div><span class="a-skel" style="height:12px;width:92%"></span><span class="a-skel" style="height:12px;width:70%"></span><span class="a-skel" style="height:220px;border-radius:12px"></span></div>';

    async function loadMore() {
        if (loadingMore || !hasMore || !state.posts.length) return;
        loadingMore = true;
        list.setAttribute('aria-busy', 'true');
        list.insertAdjacentHTML('beforeend', skel() + skel());
        try {
            const last = Math.min(...state.posts.map((p) => p.id));
            const r = await fetch(`/Dashboard/GetPosts?before=${last}&take=10`);
            const d = await r.json();
            $$('.post-skel', list).forEach((x) => x.remove());
            const more = (d.posts || []).map(fromDto).filter((p) => !byId(p.id));
            more.forEach((p) => {
                state.posts.push(p);
                const el = makePost(p);
                list.append(el);
                wireAll(el);
            });
            renderIcons();
            hasMore = !!d.hasMore && more.length > 0;
        } catch (e) {
            $$('.post-skel', list).forEach((x) => x.remove());
        }
        loadingMore = false;
        list.setAttribute('aria-busy', 'false');
        showEnd();
    }

    function showEnd() {
        const end = $('#feedEnd');
        if (!end || hasMore || !state.posts.length || !end.hidden) return;
        end.hidden = false;
        requestAnimationFrame(() => end.classList.add('is-in'));
    }

    /* ---------------------------------------------------------------------------
       SỰ KIỆN CHUNG
       --------------------------------------------------------------------------- */
    document.addEventListener('keydown', (e) => {
        if (e.defaultPrevented) return;
        if (e.key === 'Escape') {
            if (!pd.hidden) { closePost(); e.preventDefault(); return; }
            if (!cmD.hidden) { closeCompose(); e.preventDefault(); return; }
            if (!share.hidden) { M.closeDialog(share, shareScrim); e.preventDefault(); return; }
            if (!keysD.hidden) { M.closeDialog(keysD, keysScrim); e.preventDefault(); return; }
            if (!pop.hidden) { closeMenu(); e.preventDefault(); }
            return;
        }
        if (document.querySelector('.a-dialog:not([hidden])')) return;
        if ((e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) || e.ctrlKey || e.metaKey || e.altKey) return;

        const k = e.key.toLowerCase();
        if (k === 'j' || k === 'k') { e.preventDefault(); movePost(k === 'j' ? 1 : -1); return; }
        if (e.key === '?') { e.preventDefault(); openKeys(); return; }
        if (k === 'n') { e.preventDefault(); openCompose('text'); return; }

        const el = currentPost();
        const p = el && byId(+el.dataset.pid);
        if (!p) return;
        if (k === 'l') { e.preventDefault(); react(p, null, { anchor: $('[data-like]', el) }); }
        else if (k === 'c') { e.preventDefault(); openPost(p, $('[data-comments]', el), { focus: true }); }
        else if (k === 's') { e.preventDefault(); toggleSave(p); }
    });

    document.addEventListener('submit', (e) => {
        const f = e.target.closest && e.target.closest('[data-reply]');
        if (!f) return;
        e.preventDefault();
        replyInline(f);
    });
    document.addEventListener('input', (e) => {
        const i = e.target.closest && e.target.closest('.post__reply-input');
        if (!i) return;
        const send = i.parentElement.querySelector('.post__reply-send');
        if (send) send.disabled = !i.value.trim();
    });

    document.addEventListener('click', (e) => {
        const t = e.target;
        let b;

        // Cột phải
        if ((b = t.closest('[data-iv-accept]'))) { respondInterview(b.dataset.ivAccept, true, b); return; }
        if ((b = t.closest('[data-iv-decline]'))) { respondInterview(b.dataset.ivDecline, false, b); return; }
        if ((b = t.closest('[data-req-accept]'))) { respondRequest(b.dataset.reqAccept, true, b); return; }
        if ((b = t.closest('[data-req-decline]'))) { respondRequest(b.dataset.reqDecline, false, b); return; }
        if ((b = t.closest('[data-sugg-x]'))) { dismissSuggestion(b.dataset.suggX, b); return; }
        if ((b = t.closest('[data-connect]'))) { connect(b.dataset.connect, b); return; }
        if ((b = t.closest('[data-follow]'))) { toggleFollow(+b.dataset.follow); return; }
        if (t.closest('[data-keys]')) { openKeys(); return; }

        // Bài viết
        const host = t.closest('[data-pid]');
        const p = host && byId(+host.dataset.pid);
        if (p && (b = t.closest('[data-like]'))) {
            if (RX && RX.wasHeld(b)) return; // the long press opened the reaction bar instead
            if (RX) RX.closeDock(true);
            react(p, null, { anchor: b });
            return;
        }
        if (p && (b = t.closest('[data-rx-list]'))) { if (RX) RX.openList({ postId: p.id }, b); return; }
        if (p && (b = t.closest('[data-comments]'))) {
            if (host === pd) $('#pdInput')?.focus();
            else openPost(p, b, { focus: b.classList.contains('act') });
            return;
        }
        if (p && (b = t.closest('[data-share]'))) { openShare(p, b); return; }
        if (p && t.closest('[data-save]')) { toggleSave(p); return; }
        if (p && (b = t.closest('[data-menu]'))) { openMenu(b, p); return; }
        if ((b = t.closest('[data-more]'))) { expandText(b); return; }
        if ((b = t.closest('[data-car-step]'))) { b.closest('.car')?.step(+b.dataset.carStep); return; }
        if ((b = t.closest('[data-emo]'))) {
            const ta = $('#pdInput');
            if (ta) { ta.value += b.dataset.emo; ta.focus(); autosize(ta, 96); $('#pdSend').disabled = false; }
            return;
        }
        if (t.closest('[data-pd-close]')) { closePost(); return; }

        // Soạn bài
        if ((b = t.closest('[data-compose]'))) { openCompose(b.dataset.compose, b); return; }

        if (!window.openPopover && !pop.hidden && !t.closest('#postMenu') && !t.closest('[data-menu]')) pop.hidden = true;
    });

    /* Mobile: thanh đầu ẩn khi cuộn xuống */
    const mhead = $('#feedMhead');
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
        if (!mhead || !isMobile()) return;
        const y = window.scrollY;
        if (Math.abs(y - lastY) < 6) return;
        mhead.classList.toggle('is-hidden', y > lastY && y > 80);
        lastY = y;
    }, { passive: true });

    /* ---------------------------------------------------------------------------
       KHỞI CHẠY
       --------------------------------------------------------------------------- */
    /* Thanh chọn cảm xúc trên nút Thích của bài (thẻ + hộp thoại) và của bình luận / câu trả lời. */
    function bindReactions() {
        if (!RX) return;
        RX.bind(document, '[data-like]', (b) => {
            const host = b.closest('[data-pid]');
            const p = host && byId(+host.dataset.pid);
            if (!p) return null;
            return { current: myKind(p), onPick: (k, fx) => react(p, k, { anchor: b, from: fx.from }) };
        });
        RX.bind(document, '[data-clike]', (b) => {
            const c = pdPost && (pdPost.comments || []).find((x) => x.id === +b.dataset.clike);
            if (!c || c.pending || !canThread()) return null;
            return { current: cKind(c), size: 'sm', onPick: (k, fx) => reactComment(c.id, k, { from: fx.from }) };
        });
    }

    function init() {
        bindReactions();
        renderFeed();
        if (window.ArisStories && $('#storyTrack')) {
            window.ArisStories.init({
                section: '#storiesSection',
                track: '#storyTrack',
                emptyHtml: '<b>Chưa có tin mới từ bạn bè hay công ty bạn theo dõi</b><span>Theo dõi công ty để xem "một ngày ở công ty" của họ — văn phòng, sự kiện, đội ngũ.</span><a class="a-btn a-btn--secondary a-btn--sm" href="/Company"><i data-lucide="compass"></i>Khám phá công ty</a>'
            });
        }
        loadSuggestions();
        setInterval(fetchLiveStats, 30000);

        const sentinel = $('#feedSentinel');
        if (sentinel && 'IntersectionObserver' in window) {
            new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) loadMore(); }, { rootMargin: '800px 0px' }).observe(sentinel);
        }
        showEnd();

        if (window.ArisChat && window.ArisChat.onNewPost) {
            window.ArisChat.onNewPost((n) => {
                if (!n || n.authorId === myId || byId(n.postId) || incomingPosts.some((x) => x.postId === n.postId)) return;
                incomingPosts.unshift(n);
                showPill();
            });
            if (window.ArisChat.start) window.ArisChat.start();
        }

        const params = new URLSearchParams(location.search);
        if (params.get('post')) {
            const p = byId(+params.get('post'));
            if (p) openPost(p, null);
        }
        if (location.hash === '#compose') {
            history.replaceState(null, '', location.pathname + location.search);
            openCompose('text');
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
