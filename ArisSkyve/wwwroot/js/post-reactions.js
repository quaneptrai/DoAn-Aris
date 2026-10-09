/* =============================================================================
   ARIS — Cảm xúc cho bài viết & bình luận (09/10/2026)
   File: wwwroot/js/post-reactions.js · dùng ở Bảng tin (feed.js)
   - Thanh chọn cảm xúc: rê chuột lên nút Thích ~0,45 giây (máy tính), giữ ~0,4 giây rồi kéo
     hoặc chạm (điện thoại), hoặc phím ↑ khi nút Thích đang được chọn bằng bàn phím.
   - Hiệu ứng thả: emoji bay về nút, nổ hạt theo màu cảm xúc, vài emoji trôi lên rồi tan (kiểu YouTube).
   - Hộp thoại "Cảm xúc": ai đã thả gì, lọc theo từng loại.
   Chỉ bật khi window.ArisFeatures.postReactions (migration AddPostReactions); chưa có thì vẫn là tim.
   ============================================================================= */
window.ArisPostReactions = (function () {
    'use strict';

    // The quick faces of chat reactions (chat-reactions.js), in the same order. Keys must match
    // ReactionKinds on the server (Domain/Entities/PostReaction.cs). ❤️ is what the heart button gives.
    const KINDS = [
        { k: 'thumb', e: '👍', label: 'Thích' },
        { k: 'like', e: '❤️', label: 'Yêu thích' },
        { k: 'haha', e: '😆', label: 'Haha' },
        { k: 'wow', e: '😮', label: 'Wow' },
        { k: 'sad', e: '😢', label: 'Buồn' },
        { k: 'angry', e: '😡', label: 'Phẫn nộ' }
    ];
    const BY_KIND = Object.fromEntries(KINDS.map((x) => [x.k, x]));
    const kind = (k) => BY_KIND[k] || BY_KIND.like;
    const order = (k) => KINDS.findIndex((x) => x.k === k);

    const M = window.ArisMotion || {};
    const reduced = () => (M.reduced ? M.reduced() : matchMedia('(prefers-reduced-motion: reduce)').matches);
    const enabled = () => !!(window.ArisFeatures && window.ArisFeatures.postReactions);
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const icons = () => { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); };
    const done = (a, el) => (a && a.finished ? a.finished.then(() => el.remove(), () => el.remove()) : el.remove());

    /* ---------------------------------------------------------------------------
       SỐ LIỆU
       --------------------------------------------------------------------------- */
    // Optimistic change: one reaction moves from `from` to `to` (either may be null).
    function shift(reactions, from, to) {
        const counts = new Map((reactions || []).map((r) => [r.kind, r.count]));
        if (from) counts.set(from, Math.max(0, (counts.get(from) || 0) - 1));
        if (to) counts.set(to, (counts.get(to) || 0) + 1);
        return [...counts]
            .filter(([, n]) => n > 0)
            .map(([k, n]) => ({ kind: k, count: n }))
            .sort((a, b) => b.count - a.count || order(a.kind) - order(b.kind));
    }

    // Up to `max` faces, most used first, overlapping like Facebook's reaction summary.
    function stackHtml(reactions, max = 3) {
        const top = (reactions || []).filter((r) => r.count > 0).slice(0, max);
        if (!top.length) return '';
        return `<span class="rx-stack" aria-hidden="true">${top.map((r) => `<span class="rx-stack__i rx-k--${esc(r.kind)}">${kind(r.kind).e}</span>`).join('')}</span>`;
    }

    const onlyHearts = (reactions) => (reactions || []).every((r) => r.kind === 'like');

    /* ---------------------------------------------------------------------------
       THANH CHỌN CẢM XÚC
       --------------------------------------------------------------------------- */
    let dock = null; // { el, anchor, opts, closeTimer }

    function openDock(anchor, opts) {
        closeDock(true);
        const el = document.createElement('div');
        el.className = 'rxd' + (opts.size === 'sm' ? ' rxd--sm' : '');
        el.setAttribute('role', 'menu');
        el.setAttribute('aria-label', 'Chọn cảm xúc');
        el.innerHTML = KINDS.map((x, i) => `
          <button type="button" class="rxd__i rx-k--${x.k}${x.k === opts.current ? ' is-on' : ''}" role="menuitemradio"
                  aria-checked="${x.k === opts.current}" aria-label="${x.label}" data-k="${x.k}" tabindex="-1" style="--i:${i}">
            <span class="rxd__e">${x.e}</span><span class="rxd__tip" aria-hidden="true">${x.label}</span>
          </button>`).join('');
        document.body.appendChild(el);
        place(el, anchor);
        dock = { el, anchor, opts, closeTimer: 0 };
        anchor.setAttribute('aria-expanded', 'true');

        el.addEventListener('pointerenter', () => { if (dock) clearTimeout(dock.closeTimer); });
        el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') scheduleClose(); });
        el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') hot(e.target.closest('.rxd__i')); });
        el.addEventListener('click', (e) => {
            const b = e.target.closest('.rxd__i');
            if (b) pick(b);
        });
        el.addEventListener('keydown', onDockKey);
        if (opts.focus) (el.querySelector('.is-on') || el.querySelector('.rxd__i')).focus({ preventScroll: true });

        setTimeout(() => {
            document.addEventListener('pointerdown', outside, true);
            document.addEventListener('keydown', onEscape, true);
            window.addEventListener('scroll', onScroll, true);
            window.addEventListener('resize', onScroll);
        });
    }

    function place(el, anchor) {
        const r = anchor.getBoundingClientRect();
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const mid = r.left + r.width / 2;
        // The first face sits right above the button, as on Facebook; clamp to the viewport.
        const left = Math.max(8, Math.min(window.innerWidth - w - 8, mid - h / 2));
        let top = r.top - h - 10;
        const below = top < 8;
        if (below) top = r.bottom + 10;
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.setProperty('--ox', (mid - left) + 'px');
        el.classList.toggle('is-below', below);
    }

    function closeDock(instant) {
        if (!dock) return;
        const { el, anchor } = dock;
        clearTimeout(dock.closeTimer);
        dock = null;
        anchor.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('keydown', onEscape, true);
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onScroll);
        if (instant || reduced()) { el.remove(); return; }
        el.classList.add('is-out');
        setTimeout(() => el.remove(), 170);
    }

    function scheduleClose(ms = 320) {
        if (!dock) return;
        clearTimeout(dock.closeTimer);
        dock.closeTimer = setTimeout(() => closeDock(), ms);
    }

    function outside(e) {
        if (dock && !dock.el.contains(e.target) && !dock.anchor.contains(e.target)) closeDock();
    }
    function onScroll(e) {
        if (dock && !(e && e.target instanceof Node && dock.el.contains(e.target))) closeDock(true);
    }
    function onEscape(e) {
        if (e.key !== 'Escape' || !dock) return;
        e.preventDefault();
        e.stopPropagation();
        const a = dock.anchor;
        closeDock();
        a.focus({ preventScroll: true });
    }

    function onDockKey(e) {
        if (!dock) return;
        const items = Array.from(dock.el.querySelectorAll('.rxd__i'));
        const i = items.indexOf(document.activeElement);
        let next = null;
        if (e.key === 'ArrowRight') next = items[(i + 1) % items.length];
        else if (e.key === 'ArrowLeft') next = items[(i - 1 + items.length) % items.length];
        else if (e.key === 'Home') next = items[0];
        else if (e.key === 'End') next = items[items.length - 1];
        else if (e.key === 'Tab') { closeDock(); return; }
        if (next) {
            e.preventDefault();
            next.focus({ preventScroll: true });
            hot(next);
        }
    }

    // The face under the pointer / finger / keyboard focus grows and shows its label.
    function hot(item) {
        if (!dock) return;
        dock.el.querySelectorAll('.rxd__i.is-hot').forEach((x) => { if (x !== item) x.classList.remove('is-hot'); });
        if (item && dock.el.contains(item)) item.classList.add('is-hot');
        dock.el.classList.toggle('has-hot', !!(item && dock.el.contains(item)));
    }

    function pick(item) {
        if (!dock) return;
        const { anchor, opts } = dock;
        const face = item.querySelector('.rxd__e').getBoundingClientRect();
        closeDock(true);
        opts.onPick(item.dataset.k, { from: face, anchor });
    }

    /* Rê chuột / giữ ngón / phím ↑ trên mọi nút khớp `selector` trong `root`.
       getOpts(btn) → { current, size, onPick(kind, { from, anchor }) } hoặc null nếu không mở. */
    function bind(root, selector, getOpts) {
        let hoverTimer = 0;
        let pressTimer = 0;
        let press = null;
        let lastPress = 0;

        root.addEventListener('pointerover', (e) => {
            if (e.pointerType !== 'mouse' || !enabled()) return;
            const b = e.target.closest(selector);
            if (!b || !root.contains(b) || (e.relatedTarget instanceof Node && b.contains(e.relatedTarget))) return;
            // Right after a click the button is redrawn under the still cursor: that is not a new hover.
            if (Date.now() - lastPress < 800) return;
            clearTimeout(hoverTimer);
            if (dock && dock.anchor === b) { clearTimeout(dock.closeTimer); return; }
            hoverTimer = setTimeout(() => {
                const o = getOpts(b);
                if (o && b.isConnected && b.matches(':hover')) openDock(b, o);
            }, dock ? 150 : 450);
        });
        root.addEventListener('pointerout', (e) => {
            if (e.pointerType !== 'mouse') return;
            const b = e.target.closest(selector);
            if (!b || (e.relatedTarget instanceof Node && b.contains(e.relatedTarget))) return;
            clearTimeout(hoverTimer);
            if (dock && dock.anchor === b && !(e.relatedTarget instanceof Node && dock.el.contains(e.relatedTarget))) scheduleClose();
        });

        // Touch: hold to open, then slide onto a face and lift — or lift and tap a face.
        root.addEventListener('pointerdown', (e) => {
            const b = e.target.closest(selector);
            if (!b) return;
            // A quick click is a plain like: it cancels the bar that the hover was about to open.
            clearTimeout(hoverTimer);
            lastPress = Date.now();
            if (e.pointerType === 'mouse' || !enabled()) return;
            clearTimeout(pressTimer);
            press = { b, id: e.pointerId, x: e.clientX, y: e.clientY, open: false };
            pressTimer = setTimeout(() => {
                if (!press || press.b !== b) return;
                const o = getOpts(b);
                if (!o) return;
                press.open = true;
                b.dataset.rxHeld = String(Date.now());
                openDock(b, o);
                if (navigator.vibrate) navigator.vibrate(8);
            }, 420);
        });
        root.addEventListener('pointermove', (e) => {
            if (!press || e.pointerId !== press.id) return;
            if (!press.open) {
                if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(pressTimer); press = null; }
                return;
            }
            const under = document.elementFromPoint(e.clientX, e.clientY);
            hot(under && under.closest('.rxd__i'));
        });
        const end = (e) => {
            if (!press || e.pointerId !== press.id) return;
            clearTimeout(pressTimer);
            if (press.open && e.type === 'pointerup' && dock) {
                const under = document.elementFromPoint(e.clientX, e.clientY);
                const item = under && under.closest('.rxd__i');
                if (item && dock.el.contains(item)) pick(item);
                else hot(null);
            }
            press = null;
        };
        root.addEventListener('pointerup', end);
        root.addEventListener('pointercancel', end);
        root.addEventListener('contextmenu', (e) => { if (enabled() && e.target.closest(selector)) e.preventDefault(); });

        root.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowUp' || !enabled()) return;
            const b = e.target.closest(selector);
            const o = b && getOpts(b);
            if (!o) return;
            e.preventDefault();
            openDock(b, Object.assign({}, o, { focus: true }));
        });
    }

    // After a long press opened the dock, the click that may follow must not toggle the heart.
    function wasHeld(btn) {
        const t = +(btn && btn.dataset.rxHeld || 0);
        if (!t) return false;
        delete btn.dataset.rxHeld;
        return Date.now() - t < 1500;
    }

    /* ---------------------------------------------------------------------------
       HIỆU ỨNG THẢ CẢM XÚC
       --------------------------------------------------------------------------- */
    let layer = null;
    function fxLayer() {
        if (!layer || !layer.isConnected) {
            layer = document.createElement('div');
            layer.className = 'rxfx';
            layer.setAttribute('aria-hidden', 'true');
            document.body.appendChild(layer);
        }
        return layer;
    }

    function spawn(cls, text, x, y) {
        const s = document.createElement('span');
        s.className = cls;
        if (text) s.textContent = text;
        s.style.left = x + 'px';
        s.style.top = y + 'px';
        fxLayer().appendChild(s);
        return s;
    }

    /* anchor: the like button (or comment "Thích"); opts.from: rect of the picked face in the dock;
       opts.small: comment-sized. Call after the button already shows the new reaction. */
    function celebrate(anchor, k, opts = {}) {
        if (!anchor || !anchor.isConnected || reduced()) return;
        const x = kind(k);
        const r = anchor.getBoundingClientRect();
        // Whichever face the button currently shows (emoji for a reaction, the heart svg otherwise).
        const target = [anchor.querySelector('.rx-face'), anchor.querySelector('svg')]
            .find((el) => el && el.getClientRects().length) || anchor;
        const t = target.getBoundingClientRect();
        const cx = t.left + t.width / 2;
        const cy = t.top + t.height / 2;
        let delay = 0;

        // 1 · The picked face flies on a small arc from the dock into the button.
        if (opts.from) {
            const f = opts.from;
            const fx = f.left + f.width / 2;
            const fy = f.top + f.height / 2;
            const fly = spawn('rxfx__fly', x.e, fx, fy);
            fly.style.fontSize = Math.round(f.height) + 'px';
            const dx = cx - fx;
            const dy = cy - fy;
            done(fly.animate([
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                { transform: `translate(calc(-50% + ${dx * .45}px), calc(-50% + ${dy * .45 - 26}px)) scale(1.12)`, opacity: 1, offset: .45 },
                { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${opts.small ? .4 : .55})`, opacity: .35 }
            ], { duration: 360, easing: 'cubic-bezier(.33, .7, .4, 1)' }), fly);
            delay = 300;
        }

        // 2 · The button face springs in.
        target.animate([
            { transform: 'scale(.4)', offset: 0 },
            { transform: 'scale(1.32)', offset: .45 },
            { transform: 'scale(.92)', offset: .72 },
            { transform: 'scale(1)' }
        ], { duration: 520, delay, easing: 'ease-out', fill: 'backwards' });

        // 3 · A ring and dots burst in the reaction colour.
        const ring = spawn(`rxfx__ring rx-k--${x.k}`, '', cx, cy);
        done(ring.animate([
            { transform: 'translate(-50%, -50%) scale(.3)', opacity: .9 },
            { transform: `translate(-50%, -50%) scale(${opts.small ? 1.5 : 2})`, opacity: 0 }
        ], { duration: 520, delay, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'backwards' }), ring);
        const n = opts.small ? 6 : 10;
        for (let i = 0; i < n; i++) {
            const dot = spawn(`rxfx__dot rx-k--${x.k}`, '', cx, cy);
            const ang = (i / n) * Math.PI * 2 + Math.random() * .5;
            const dist = (opts.small ? 16 : 26) + Math.random() * (opts.small ? 10 : 18);
            done(dot.animate([
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                { transform: `translate(calc(-50% + ${(Math.cos(ang) * dist).toFixed(1)}px), calc(-50% + ${(Math.sin(ang) * dist).toFixed(1)}px)) scale(0)`, opacity: .2 }
            ], { duration: 460 + Math.random() * 240, delay, easing: 'cubic-bezier(.17, .67, .35, 1)', fill: 'backwards' }), dot);
        }

        // 4 · YouTube-style: a few faces drift up, sway and fade.
        const floats = opts.small ? 2 : (k === 'like' && !opts.from ? 3 : 5);
        for (let i = 0; i < floats; i++) {
            const f = spawn('rxfx__float', x.e, cx + (Math.random() * 16 - 8), r.top + 4);
            const rise = (opts.small ? 48 : 90) + Math.random() * (opts.small ? 24 : 60);
            const sway = (Math.random() < .5 ? -1 : 1) * (8 + Math.random() * 16);
            const rot = Math.random() * 40 - 20;
            const size = (opts.small ? .7 : .9) + Math.random() * .5;
            done(f.animate([
                { transform: `translate(-50%, 0) scale(${size * .4}) rotate(0deg)`, opacity: 0 },
                { transform: `translate(calc(-50% + ${sway * .6}px), ${-rise * .3}px) scale(${size}) rotate(${rot * .5}deg)`, opacity: 1, offset: .25 },
                { transform: `translate(calc(-50% - ${sway * .4}px), ${-rise * .7}px) scale(${size}) rotate(${-rot * .3}deg)`, opacity: .85, offset: .65 },
                { transform: `translate(calc(-50% + ${sway}px), ${-rise}px) scale(${size * .8}) rotate(${rot}deg)`, opacity: 0 }
            ], { duration: 1100 + Math.random() * 500, delay: delay + 80 + i * 90, easing: 'cubic-bezier(.25, .6, .4, 1)', fill: 'backwards' }), f);
        }
    }

    /* ---------------------------------------------------------------------------
       HỘP THOẠI "CẢM XÚC" — ai đã thả gì
       --------------------------------------------------------------------------- */
    let dlg = null;
    let scrim = null;
    let people = [];
    let seq = 0;

    function ensureDialog() {
        if (dlg && dlg.isConnected) return;
        scrim = document.createElement('div');
        scrim.className = 'a-scrim rxl-scrim';
        scrim.hidden = true;
        dlg = document.createElement('div');
        dlg.className = 'a-dialog rxl';
        dlg.setAttribute('role', 'dialog');
        dlg.setAttribute('aria-modal', 'true');
        dlg.setAttribute('aria-labelledby', 'rxlTitle');
        dlg.hidden = true;
        document.body.append(scrim, dlg);
        scrim.addEventListener('click', closeList);
        dlg.addEventListener('click', (e) => {
            if (e.target.closest('[data-rxl-close]')) { closeList(); return; }
            const tab = e.target.closest('[data-rxl-tab]');
            if (tab) selectTab(tab.dataset.rxlTab, true);
        });
        dlg.addEventListener('keydown', (e) => {
            const tab = e.target.closest('[data-rxl-tab]');
            if (!tab || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
            const tabs = Array.from(dlg.querySelectorAll('[data-rxl-tab]'));
            const next = tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
            e.preventDefault();
            selectTab(next.dataset.rxlTab, true);
            next.focus();
        });
    }

    function onListEscape(e) {
        if (e.key !== 'Escape' || !dlg || dlg.hidden) return;
        e.preventDefault();
        e.stopPropagation();
        closeList();
    }

    function closeList() {
        if (!dlg || dlg.hidden) return;
        document.removeEventListener('keydown', onListEscape, true);
        if (M.closeDialog) M.closeDialog(dlg, scrim);
        else { dlg.hidden = true; scrim.hidden = true; }
    }

    const skeleton = () => Array.from({ length: 4 }, () => '<div class="rxl__row is-skel" aria-hidden="true"><span class="a-skel" style="width:40px;height:40px;border-radius:50%"></span><span class="a-skel" style="height:12px;width:55%"></span></div>').join('');

    function face(name, url) {
        const initials = window.initials ? window.initials(name) : String(name || 'A').trim().slice(0, 1).toUpperCase();
        const tone = window.toneOf ? window.toneOf(name) : 1;
        const img = url && url !== '/images/default-avatar.png' ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : '';
        return `<span class="a-avatar" style="--_s:40px" data-tone="${tone}">${esc(initials)}${img}</span>`;
    }

    // target: { postId } or { commentId }; origin: the element that opened it (focus returns there).
    function openList(target, origin) {
        ensureDialog();
        const my = ++seq;
        people = [];
        dlg.innerHTML = `
          <div class="a-dialog__head"><h2 class="a-dialog__title" id="rxlTitle">Cảm xúc</h2>
            <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-rxl-close aria-label="Đóng"><i data-lucide="x"></i></button></div>
          <div class="rxl__tabs" role="tablist" aria-label="Lọc theo cảm xúc"></div>
          <div class="rxl__list" role="tabpanel" aria-busy="true">${skeleton()}</div>`;
        icons();
        if (M.openDialog) M.openDialog(dlg, scrim, origin);
        else { scrim.hidden = false; dlg.hidden = false; }
        document.addEventListener('keydown', onListEscape, true);

        const q = target.postId ? `postId=${encodeURIComponent(target.postId)}` : `commentId=${encodeURIComponent(target.commentId)}`;
        fetch('/Dashboard/GetReactions?' + q)
            .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then((d) => {
                if (my !== seq || !dlg || dlg.hidden) return;
                people = d.people || [];
                const counts = d.counts || [];
                const tabs = [{ k: 'all', html: `Tất cả <span class="a-num">${d.total || people.length}</span>` }]
                    .concat(counts.map((c) => ({ k: c.kind, html: `<span class="rxl__e">${kind(c.kind).e}</span><span class="a-num">${c.count}</span>`, label: kind(c.kind).label })));
                dlg.querySelector('.rxl__tabs').innerHTML = tabs.map((t) =>
                    `<button type="button" class="rxl__tab" role="tab" data-rxl-tab="${t.k}" aria-selected="false" tabindex="-1"${t.label ? ` aria-label="${t.label}: ${counts.find((c) => c.kind === t.k).count}"` : ''}>${t.html}</button>`
                ).join('') + '<span class="rxl__ink" aria-hidden="true"></span>';
                selectTab('all', false);
                if (d.total > people.length) {
                    dlg.querySelector('.rxl__list').insertAdjacentHTML('beforeend', `<div class="rxl__more">và ${d.total - people.length} người khác</div>`);
                }
            })
            .catch(() => {
                if (my !== seq || !dlg) return;
                const box = dlg.querySelector('.rxl__list');
                box.setAttribute('aria-busy', 'false');
                box.innerHTML = '<div class="a-empty" style="padding:32px 16px"><div class="a-empty__title">Không tải được danh sách</div><div class="a-empty__text">Kiểm tra kết nối rồi mở lại nhé.</div></div>';
            });
    }

    function selectTab(k, animate) {
        if (!dlg) return;
        const tabs = Array.from(dlg.querySelectorAll('[data-rxl-tab]'));
        tabs.forEach((t) => {
            const on = t.dataset.rxlTab === k;
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
        });
        const cur = tabs.find((t) => t.dataset.rxlTab === k);
        const ink = dlg.querySelector('.rxl__ink');
        if (ink && cur) {
            ink.classList.toggle('is-instant', !animate);
            ink.style.width = cur.offsetWidth + 'px';
            ink.style.transform = `translateX(${cur.offsetLeft}px)`;
        }
        const list = people.filter((p) => k === 'all' || p.kind === k);
        const box = dlg.querySelector('.rxl__list');
        box.setAttribute('aria-busy', 'false');
        box.innerHTML = list.length ? list.map((p) => `
          <a class="rxl__row" href="${esc(p.href)}">
            <span class="rxl__face">${face(p.name, p.avatar)}<span class="rxl__badge rx-k--${esc(p.kind)}" title="${kind(p.kind).label}">${kind(p.kind).e}</span></span>
            <span class="rxl__who"><b>${esc(p.name)}</b>${p.isMe ? '<span class="rxl__me">Bạn</span>' : ''}${p.subtitle ? `<small>${esc(p.subtitle)}</small>` : ''}</span>
            <i data-lucide="chevron-right" class="rxl__go"></i>
          </a>`).join('')
            : '<div class="a-empty" style="padding:32px 16px"><div class="a-empty__title">Chưa có ai</div></div>';
        icons();
        if (animate && M.stagger) M.stagger(box.querySelectorAll('.rxl__row'), { max: 8, step: 22 });
    }

    return { KINDS, kind, enabled, shift, stackHtml, onlyHearts, bind, wasHeld, closeDock, celebrate, openList };
})();
