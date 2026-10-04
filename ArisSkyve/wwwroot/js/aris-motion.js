/* =============================================================================
   ARIS LINE — motion primitives (V7)
   Khi port vào app: copy nguyên file thành wwwroot/js/aris-motion.js.
   Không phụ thuộc thư viện. Mọi hàm tự tôn trọng prefers-reduced-motion.
   Không có vòng requestAnimationFrame chạy liên tục.
   ============================================================================= */
(function () {
  'use strict';

  const EASE_OUT = 'cubic-bezier(.2, .8, .2, 1)';
  const EASE_IN = 'cubic-bezier(.4, 0, 1, 1)';
  const EASE_IN_OUT = 'cubic-bezier(.65, 0, .35, 1)';
  const SPRING = 'linear(0, .009, .035 2.1%, .141 4.4%, .723 12.9%, .938 16.7%, 1.017 20.5%, 1.043 24.5%, 1.035 28.4%, 1.007 36%, .998 45.3%, 1)';

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => mq.matches;

  const LOGO_PATH = 'M 30,145 C 65,180 125,160 120,115 C 115,70 70,70 70,115 C 70,150 115,95 170,30';

  function loaderSvg(cls = '') {
    return `<svg class="a-loader ${cls}" viewBox="0 0 200 200" aria-hidden="true">
      <path class="a-loader__track" pathLength="100" d="${LOGO_PATH}"/>
      <path class="a-loader__dash" pathLength="100" d="${LOGO_PATH}"/></svg>`;
  }
  const CHECK_SVG = '<svg class="a-check" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function animate(el, keyframes, options) {
    if (!el || reduced()) return { finished: Promise.resolve(), cancel() {} };
    return el.animate(keyframes, options);
  }

  /* ---------------------------------------------------------------------------
     flip(container, mutate, { selector, duration })
     Đo vị trí → chạy mutate() (lọc/sắp xếp/thêm) → animate từ vị trí cũ sang mới.
     Phần tử mới xuất hiện bằng fade + scale nhẹ.
     --------------------------------------------------------------------------- */
  function flip(container, mutate, opts = {}) {
    const selector = opts.selector || ':scope > *';
    const duration = opts.duration || 300;
    const before = new Map();
    container.querySelectorAll(selector).forEach((el) => before.set(el, el.getBoundingClientRect()));
    mutate();
    if (reduced()) return Promise.resolve();
    const anims = [];
    container.querySelectorAll(selector).forEach((el) => {
      const b = before.get(el);
      const a = el.getBoundingClientRect();
      if (!b) {
        if (opts.enter === false) return;
        anims.push(el.animate(
          [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }],
          { duration: 220, easing: EASE_OUT }
        ));
        return;
      }
      const dx = b.left - a.left;
      const dy = b.top - a.top;
      if (Math.abs(dx) < .5 && Math.abs(dy) < .5) return;
      anims.push(el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration, easing: EASE_OUT }
      ));
    });
    return Promise.all(anims.map((x) => x.finished)).catch(() => {});
  }

  /* Xoá một phần tử khỏi danh sách: co lại + mờ, rồi các phần tử còn lại dồn chỗ */
  async function removeFrom(container, el, opts = {}) {
    if (!reduced()) {
      await el.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }],
        { duration: 160, easing: EASE_IN, fill: 'forwards' }
      ).finished.catch(() => {});
    }
    return flip(container, () => el.remove(), opts);
  }

  /* ---------------------------------------------------------------------------
     rollNumber(el, to) — số lăn theo từng chữ số
     --------------------------------------------------------------------------- */
  function rollNumber(el, to) {
    const next = String(to);
    const prev = el.dataset.value ?? el.textContent.trim();
    el.dataset.value = next;
    if (prev === next) return;
    if (reduced() || !el.isConnected) { el.textContent = next; return; }
    const dir = (parseFloat(next) || 0) >= (parseFloat(prev) || 0) ? 1 : -1;
    const len = Math.max(prev.length, next.length);
    const p = prev.padStart(len, ' ');
    const n = next.padStart(len, ' ');
    el.textContent = '';
    const anims = [];
    let changed = 0;
    for (let i = 0; i < len; i++) {
      if (p[i] === n[i]) { if (n[i] !== ' ') el.append(n[i]); continue; }
      const col = document.createElement('span');
      col.className = 'a-roll';
      const oldEl = document.createElement('span');
      const newEl = document.createElement('span');
      oldEl.textContent = p[i] === ' ' ? '​' : p[i];
      newEl.textContent = n[i] === ' ' ? '​' : n[i];
      col.append(oldEl, newEl);
      el.append(col);
      const o = { duration: 360, easing: SPRING, delay: changed * 40, fill: 'both' };
      anims.push(oldEl.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-100 * dir}%)`, opacity: 0 }], o));
      anims.push(newEl.animate([{ transform: `translateY(${100 * dir}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], o));
      changed++;
    }
    Promise.all(anims.map((a) => a.finished)).then(() => {
      if (el.dataset.value === next) el.textContent = next;
    }).catch(() => {});
  }

  /* ---------------------------------------------------------------------------
     morphButton(btn, 'idle' | 'loading' | 'success' | 'error', { hold })
     Markup: <button class="a-btn …"><span class="a-btn__label">Gửi</span></button>
     --------------------------------------------------------------------------- */
  function morphButton(btn, state, opts = {}) {
    if (!btn.querySelector('.a-btn__label')) {
      const label = document.createElement('span');
      label.className = 'a-btn__label';
      while (btn.firstChild) label.append(btn.firstChild);
      btn.append(label);
    }
    if (!btn.querySelector('.a-btn__status')) {
      btn.insertAdjacentHTML('beforeend', `<span class="a-btn__status" aria-hidden="true">${loaderSvg()}${CHECK_SVG}</span>`);
    }
    clearTimeout(btn._morphTimer);
    btn.dataset.state = state;
    btn.setAttribute('aria-busy', String(state === 'loading'));
    if (state === 'error') {
      shake(btn);
      btn._morphTimer = setTimeout(() => morphButton(btn, 'idle'), 240);
    }
    if (state === 'success' && opts.hold !== true) {
      btn._morphTimer = setTimeout(() => morphButton(btn, 'idle'), opts.hold || 1400);
    }
    if (state === 'idle') delete btn.dataset.state;
  }

  function shake(el) {
    return animate(el, [
      { transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' },
      { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }
    ], { duration: 320, easing: 'ease-out' });
  }

  function pulse(el, scale = 1.14) {
    return animate(el, [{ transform: 'scale(1)' }, { transform: `scale(${scale})` }, { transform: 'scale(1)' }],
      { duration: 380, easing: SPRING });
  }

  /* ---------------------------------------------------------------------------
     indicator(ind, target, { axis, inset, instant })
     Một phần tử chỉ báo duy nhất trượt tới mục đang chọn (rail, tab, list, seg).
     ind phải là con trực tiếp của container position:relative.
     --------------------------------------------------------------------------- */
  function indicator(ind, target, opts = {}) {
    if (!ind) return;
    if (!target) { ind.style.opacity = '0'; return; }
    const axis = opts.axis || ind.dataset.axis || 'y';
    const inset = opts.inset ?? Number(ind.dataset.inset || 0);
    const box = ind.parentElement;
    const c = box.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const first = !ind.dataset.placed;
    if (first || opts.instant) ind.classList.add('is-instant');
    if (axis === 'x') {
      const x = t.left - c.left - box.clientLeft + box.scrollLeft + inset;
      const w = Math.max(0, t.width - inset * 2);
      ind.style.transform = `translateX(${x}px) scaleX(${w})`;
    } else if (axis === 'thumb') {
      const x = t.left - c.left - box.clientLeft;
      ind.style.transform = `translateX(${x}px) scaleX(${t.width})`;
    } else {
      const y = t.top - c.top - box.clientTop + box.scrollTop + inset;
      const h = Math.max(0, t.height - inset * 2);
      ind.style.transform = `translateY(${y}px) scaleY(${h})`;
    }
    ind.style.opacity = '1';
    ind.dataset.placed = '1';
    if (first || opts.instant) {
      ind.getBoundingClientRect();
      requestAnimationFrame(() => ind.classList.remove('is-instant'));
    }
  }

  /* Segmented control: thumb có bo góc nên không dùng scaleX — dùng width cố định theo cột */
  function segment(root, selectedBtn, opts = {}) {
    const thumb = root.querySelector('.a-seg__thumb');
    if (!thumb || !selectedBtn) return;
    const first = !thumb.dataset.placed;
    if (first || opts.instant) thumb.classList.add('is-instant');
    thumb.style.width = selectedBtn.offsetWidth + 'px';
    thumb.style.transform = `translateX(${selectedBtn.offsetLeft}px)`;
    thumb.dataset.placed = '1';
    if (first || opts.instant) { thumb.getBoundingClientRect(); requestAnimationFrame(() => thumb.classList.remove('is-instant')); }
  }

  /* ---------------------------------------------------------------------------
     expand / collapse — markup: .a-collapse > .a-collapse__inner
     --------------------------------------------------------------------------- */
  function setOpen(el, open) { el.dataset.open = String(open); }
  const expand = (el) => setOpen(el, true);
  const collapse = (el) => setOpen(el, false);
  const toggle = (el) => setOpen(el, el.dataset.open !== 'true');

  /* ---------------------------------------------------------------------------
     stagger(list, { max, step }) — chỉ dùng khi danh sách vừa tải / vừa đổi
     --------------------------------------------------------------------------- */
  function stagger(elements, opts = {}) {
    const max = opts.max ?? 6;
    const step = opts.step ?? 30;
    Array.from(elements).slice(0, max).forEach((el, i) => {
      animate(el, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 240, easing: EASE_OUT, delay: i * step, fill: 'backwards' });
    });
  }

  /* ---------------------------------------------------------------------------
     pop(el, origin) / unpop(el) — popover, menu: nở ra từ nút đã bấm
     --------------------------------------------------------------------------- */
  function originOf(el, origin) {
    if (!origin) return 'top left';
    const o = origin.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return `${o.left + o.width / 2 - r.left}px ${o.top + o.height / 2 - r.top}px`;
  }
  function pop(el, origin) {
    el.hidden = false;
    el.style.transformOrigin = originOf(el, origin);
    return animate(el, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }],
      { duration: 180, easing: EASE_OUT });
  }
  function unpop(el) {
    if (el.hidden) return Promise.resolve();
    const a = animate(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }],
      { duration: 110, easing: EASE_IN, fill: 'forwards' });
    return a.finished.catch(() => {}).then(() => { el.hidden = true; if (a.cancel) a.cancel(); });
  }

  /* openDialog(dialog, scrim, origin) — hộp thoại mọc ra từ nút gốc, thu về khi đóng */
  function openDialog(dialog, scrim, origin) {
    scrim.hidden = false;
    dialog.hidden = false;
    dialog._origin = origin || null;
    animate(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE_OUT });
    const from = dialogFrom(dialog, origin);
    const a = animate(dialog, [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }],
      { duration: 280, easing: EASE_OUT });
    const focusable = dialog.querySelector('[autofocus], input, button, [tabindex]:not([tabindex="-1"])');
    if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 30);
    return a;
  }
  async function closeDialog(dialog, scrim) {
    const to = dialogFrom(dialog, dialog._origin);
    animate(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE_IN, fill: 'forwards' });
    await animate(dialog, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: to }],
      { duration: 180, easing: EASE_IN, fill: 'forwards' }).finished.catch(() => {});
    dialog.hidden = true;
    scrim.hidden = true;
    dialog.getAnimations().forEach((x) => x.cancel());
    scrim.getAnimations().forEach((x) => x.cancel());
    if (dialog._origin && dialog._origin.isConnected) dialog._origin.focus({ preventScroll: true });
  }
  function dialogFrom(dialog, origin) {
    if (window.matchMedia('(max-width: 767px)').matches) return 'translateY(100%)';
    if (!origin) return 'translateY(8px) scale(.98)';
    const o = origin.getBoundingClientRect();
    const r = dialog.getBoundingClientRect();
    const dx = (o.left + o.width / 2) - (r.left + r.width / 2);
    const dy = (o.top + o.height / 2) - (r.top + r.height / 2);
    return `translate(${dx * .55}px, ${dy * .55}px) scale(.86)`;
  }

  /* ---------------------------------------------------------------------------
     flyTo(source, target) — bản sao nhỏ bay theo cung tới đích, đích nảy nhẹ
     --------------------------------------------------------------------------- */
  function flyTo(source, target) {
    if (!source || !target) return Promise.resolve();
    if (reduced()) { pulse(target); return Promise.resolve(); }
    const s = source.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const ghost = source.cloneNode(true);
    ghost.removeAttribute('id');
    Object.assign(ghost.style, {
      position: 'fixed', left: s.left + 'px', top: s.top + 'px', width: s.width + 'px', height: s.height + 'px',
      margin: '0', zIndex: '9999', pointerEvents: 'none'
    });
    document.body.append(ghost);
    const dx = t.left + t.width / 2 - (s.left + s.width / 2);
    const dy = t.top + t.height / 2 - (s.top + s.height / 2);
    const lift = Math.min(120, Math.abs(dx) * .25 + 40);
    return ghost.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1, easing: 'cubic-bezier(.3, 0, .6, 1)' },
      { transform: `translate(${dx * .45}px, ${dy * .45 - lift}px) scale(.7)`, opacity: 1, offset: .45, easing: 'cubic-bezier(.4, 0, .7, 1)' },
      { transform: `translate(${dx}px, ${dy}px) scale(.22)`, opacity: .3 }
    ], { duration: 620 }).finished.then(() => { ghost.remove(); pulse(target); });
  }

  /* ---------------------------------------------------------------------------
     sortable(container, { selector, axis, ignore, onChange })
     Kéo-thả sắp xếp bằng con trỏ (chuột + cảm ứng + bút):
       - phần tử đang kéo bám theo con trỏ (class .is-dragging),
       - các phần tử khác FLIP nhường chỗ ngay khi vượt quá nửa phần tử bên cạnh,
       - thả ra: spring về đúng ô; gọi onChange(danh sách mới theo thứ tự DOM).
     Bàn phím: focus một mục + Alt + ← / → (axis 'x') hoặc Alt + ↑ / ↓ (axis 'y').
     selector phải là selector đơn giản cho từng mục (vd. '.cm-thumb'); ignore: vùng không bắt đầu kéo (nút xoá…).
     Click ngay sau khi kéo bị chặn (không vô tình mở/chọn mục).
     --------------------------------------------------------------------------- */
  function sortable(container, opts = {}) {
    const sel = opts.selector || ':scope > *';
    const axis = opts.axis || 'x';
    const items = () => Array.from(container.querySelectorAll(sel));
    const pos = (r) => (axis === 'x' ? r.left : r.top);
    const size = (r) => (axis === 'x' ? r.width : r.height);
    const client = (e) => (axis === 'x' ? e.clientX : e.clientY);
    const tr = (v) => (axis === 'x' ? `translateX(${v}px)` : `translateY(${v}px)`);
    const slot = (el) => { const t = el.style.transform; el.style.transform = 'none'; const p = pos(el.getBoundingClientRect()); el.style.transform = t; return p; };
    let d = null;
    container.addEventListener('pointerdown', (e) => {
      const el = e.target.closest(sel);
      if (!el || !container.contains(el) || e.button !== 0 || (opts.ignore && e.target.closest(opts.ignore))) return;
      d = { el, p0: client(e), started: false, id: e.pointerId };
    });
    container.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      if (!d.started) {
        if (Math.abs(client(e) - d.p0) < 5) return;
        d.started = true;
        d.el.setPointerCapture(e.pointerId);
        d.el.classList.add('is-dragging');
        d.grab = d.p0 - slot(d.el);
      }
      const want = client(e) - d.grab;
      const all = items();
      const others = all.filter((x) => x !== d.el);
      const center = want + size(d.el.getBoundingClientRect()) / 2;
      let to = others.findIndex((o) => { const r = o.getBoundingClientRect(); return center < pos(r) + size(r) / 2; });
      if (to === -1) to = others.length;
      if (others.length && to !== all.indexOf(d.el)) {
        flip(container, () => { if (others[to]) others[to].before(d.el); else others[others.length - 1].after(d.el); },
          { selector: `${sel}:not(.is-dragging)`, duration: 220 });
      }
      d.el.style.transform = tr(want - slot(d.el));
    });
    const end = () => {
      if (!d) return;
      const { el, started } = d;
      d = null;
      if (!started) return;
      const from = el.style.transform;
      el.style.transform = '';
      el.classList.remove('is-dragging');
      animate(el, [{ transform: from }, { transform: 'none' }], { duration: 340, easing: SPRING });
      container._justDragged = true;
      setTimeout(() => { container._justDragged = false; }, 0);
      if (opts.onChange) opts.onChange(items());
    };
    container.addEventListener('pointerup', end);
    container.addEventListener('pointercancel', end);
    container.addEventListener('click', (e) => { if (container._justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);
    container.addEventListener('keydown', (e) => {
      const el = e.target.closest(sel);
      const keys = axis === 'x' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
      if (!el || !e.altKey || !keys.includes(e.key)) return;
      e.preventDefault();
      const all = items();
      const i = all.indexOf(el);
      const j = i + (e.key === keys[0] ? -1 : 1);
      if (j < 0 || j >= all.length) { shake(el); return; }
      flip(container, () => (j < i ? all[j].before(el) : all[j].after(el)), { selector: sel });
      el.focus();
      if (opts.onChange) opts.onChange(items());
    });
  }

  /* ---------------------------------------------------------------------------
     highlight(el) — nháy nền 1 lần khi cuộn tới một phần tử (tin được trích dẫn…)
     --------------------------------------------------------------------------- */
  function highlight(el) {
    el.classList.remove('a-flash');
    void el.offsetWidth;
    el.classList.add('a-flash');
    setTimeout(() => el.classList.remove('a-flash'), 1200);
  }

  /* ---------------------------------------------------------------------------
     toast(message, { tone, action: { label, onClick }, duration })
     --------------------------------------------------------------------------- */
  const ICONS = {
    success: '<svg class="a-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>',
    danger: '<svg class="a-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>'
  };
  function region() {
    let r = document.querySelector('.a-toast-region');
    if (!r) {
      r = document.createElement('div');
      r.className = 'a-toast-region';
      r.setAttribute('aria-live', 'polite');
      document.body.append(r);
    }
    return r;
  }
  function toast(message, opts = {}) {
    const r = region();
    const el = document.createElement('div');
    el.className = 'a-toast' + (opts.tone ? ` a-toast--${opts.tone}` : '');
    el.setAttribute('role', opts.tone === 'danger' ? 'alert' : 'status');
    el.innerHTML = (ICONS[opts.tone] || '') + '<span class="a-toast__msg"></span>';
    el.querySelector('.a-toast__msg').textContent = message;
    let timer;
    const dismiss = async (dir = 0) => {
      clearTimeout(timer);
      if (!el.isConnected) return;
      const x = dir ? dir * 120 : 0;
      await animate(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translate(${x}px, ${dir ? 0 : 8}px) scale(${dir ? 1 : .97})` }],
        { duration: 180, easing: EASE_IN, fill: 'forwards' }).finished.catch(() => {});
      flip(r, () => el.remove());
    };
    if (opts.action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'a-toast__action';
      b.textContent = opts.action.label;
      b.addEventListener('click', () => { opts.action.onClick && opts.action.onClick(); dismiss(); });
      el.append(b);
    }
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'a-toast__close';
    x.setAttribute('aria-label', 'Đóng thông báo');
    x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    x.addEventListener('click', () => dismiss());
    el.append(x);

    flip(r, () => r.append(el), { enter: false });
    animate(el, [{ opacity: 0, transform: 'translateY(12px) scale(.98)' }, { opacity: 1, transform: 'none' }],
      { duration: 320, easing: SPRING });

    const duration = opts.duration ?? (opts.action ? 6000 : 4000);
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => dismiss(), duration); };
    el.addEventListener('pointerenter', () => clearTimeout(timer));
    el.addEventListener('pointerleave', arm);
    arm();

    /* vuốt ngang để đóng */
    let startX = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      startX = e.clientX;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(1 - Math.min(Math.abs(dx) / 200, .7));
    });
    const end = (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 80) { dismiss(Math.sign(dx)); return; }
      el.style.transform = '';
      el.style.opacity = '';
      animate(el, [{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 280, easing: SPRING });
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    return { dismiss };
  }

  /* ---------------------------------------------------------------------------
     setTheme(next, origin) — hình tròn lan ra từ nút đổi theme
     --------------------------------------------------------------------------- */
  function setTheme(next, origin) {
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = next;
      try { localStorage.setItem('aris-theme', next); } catch (e) { /* private mode */ }
    };
    if (!document.startViewTransition || reduced()) { apply(); return; }
    const r = origin ? origin.getBoundingClientRect() : null;
    const x = r ? r.left + r.width / 2 : innerWidth / 2;
    const y = r ? r.top + r.height / 2 : innerHeight / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('is-theme-vt');
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 520, easing: EASE_IN_OUT, pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
    vt.finished.finally(() => root.classList.remove('is-theme-vt'));
  }

  /* ---------------------------------------------------------------------------
     stickyHeader(header) — thêm .is-stuck khi trang đã cuộn
     --------------------------------------------------------------------------- */
  function stickyHeader(header) {
    if (!header) return;
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;height:1px;width:1px;margin-top:-1px;pointer-events:none';
    header.before(sentinel);
    new IntersectionObserver(([e]) => header.classList.toggle('is-stuck', !e.isIntersecting)).observe(sentinel);
  }

  /* ---------------------------------------------------------------------------
     tooltips — [data-tip="Nội dung"] (+ data-kbd="Ctrl K")
     --------------------------------------------------------------------------- */
  function initTooltips(root = document) {
    let tip = null;
    let timer = null;
    const show = (el) => {
      const text = el.getAttribute('data-tip');
      if (!text) return;
      tip = document.createElement('div');
      tip.className = 'a-tooltip';
      tip.setAttribute('role', 'tooltip');
      tip.textContent = text;
      if (el.dataset.kbd) { const k = document.createElement('span'); k.className = 'a-kbd'; k.textContent = el.dataset.kbd; tip.append(k); }
      document.body.append(tip);
      const r = el.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      const side = el.dataset.tipSide || (r.left < 100 ? 'right' : 'top');
      let left, top;
      if (side === 'right') { left = r.right + 8; top = r.top + r.height / 2 - t.height / 2; }
      else if (side === 'bottom') { left = r.left + r.width / 2 - t.width / 2; top = r.bottom + 8; }
      else { left = r.left + r.width / 2 - t.width / 2; top = r.top - t.height - 8; }
      left = Math.max(8, Math.min(left, innerWidth - t.width - 8));
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
      animate(tip, [{ opacity: 0, transform: side === 'right' ? 'translateX(-4px)' : 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: 140, easing: EASE_OUT });
    };
    const hide = () => { clearTimeout(timer); if (tip) { tip.remove(); tip = null; } };
    root.addEventListener('pointerover', (e) => {
      const el = e.target.closest('[data-tip]');
      if (!el || e.pointerType === 'touch') return;
      hide();
      timer = setTimeout(() => show(el), 450);
    });
    root.addEventListener('pointerout', (e) => { if (e.target.closest('[data-tip]')) hide(); });
    root.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (el && el.matches(':focus-visible')) { hide(); show(el); } });
    root.addEventListener('focusout', hide);
    root.addEventListener('pointerdown', hide);
  }

  window.ArisMotion = {
    EASE_OUT, EASE_IN, EASE_IN_OUT, SPRING, LOGO_PATH,
    reduced, animate, loaderSvg,
    flip, removeFrom, rollNumber, morphButton, shake, pulse,
    indicator, segment, expand, collapse, toggle, stagger,
    pop, unpop, openDialog, closeDialog, flyTo, highlight, toast, sortable,
    setTheme, stickyHeader, initTooltips
  };

  /* Tương thích ngược: code cũ gọi window.showToast(message, type) */
  window.showToast = function (message, type) {
    const tone = type === 'success' ? 'success' : (type === 'danger' || type === 'error') ? 'danger' : undefined;
    return toast(message, { tone });
  };
})();
