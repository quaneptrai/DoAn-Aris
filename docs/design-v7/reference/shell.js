/* =============================================================================
   ARIS LINE — khung app dùng chung (V7, bản tham chiếu)
   Rail + chỉ báo trượt, đổi theme, tooltip, popover (thông báo, tài khoản),
   command palette (Ctrl K), ẩn tab bar khi cuộn trên mobile.
   Khi port: tách thành wwwroot/js/aris-shell.js + aris-palette.js.
   Dữ liệu trong file này là DỮ LIỆU MẪU cho bản thiết kế — app thật lấy từ API.
   ============================================================================= */
(function () {
  'use strict';
  const M = window.ArisMotion;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  window.renderIcons = function () { if (window.lucide) window.lucide.createIcons(); };

  /* Chữ viết tắt + tông màu avatar ổn định theo tên */
  window.initials = function (name) {
    const parts = name.trim().split(/\s+/);
    const a = parts.length > 1 ? parts[parts.length - 2][0] : '';
    return (a + parts[parts.length - 1][0]).toUpperCase();
  };
  /* Viết tắt tên tổ chức: 2 từ đầu ("GreenLeaf Foods" → GF); tên 1 từ thì tách
     camelCase ("TechNova" → TN), không tách được thì 2 chữ đầu ("Aris" → AR) */
  window.orgInitials = function (name) {
    const words = name.trim().split(/\s+/);
    const parts = words.length > 1 ? words : words[0].split(/(?=\p{Lu})/u);
    const s = parts.length > 1 ? parts[0][0] + parts[1][0] : words[0].slice(0, 2);
    return s.toUpperCase();
  };
  window.toneOf = function (name) {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return (h % 6) + 1;
  };
  window.avatarHtml = function (name, size = 40, online = false, extra = '') {
    return `<span class="a-avatar a-avatar--${size}" data-tone="${toneOf(name)}"${online ? ' data-online="true"' : ''} ${extra}>${initials(name)}</span>`;
  };

  /* ---------------- Popover manager ---------------- */
  let openPop = null;
  let openPopAnchor = null;
  function place(pop, anchor, side = 'right') {
    pop.hidden = false;
    pop.style.left = '0px';
    pop.style.top = '0px';
    const a = anchor.getBoundingClientRect();
    const p = pop.getBoundingClientRect();
    let left;
    let top;
    if (side === 'right') { left = a.right + 8; top = a.bottom - p.height; }
    else if (side === 'top') { left = a.left + a.width / 2 - p.width / 2; top = a.top - p.height - 8; }
    else if (side === 'bottom-end') { left = a.right - p.width; top = a.bottom + 6; }
    else { left = a.left; top = a.bottom + 6; }
    left = Math.max(8, Math.min(left, innerWidth - p.width - 8));
    top = Math.max(8, Math.min(top, innerHeight - p.height - 8));
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }
  window.openPopover = function (pop, anchor, side) {
    if (openPop === pop) { closePopover(); return; }
    closePopover();
    place(pop, anchor, side);
    M.pop(pop, anchor);
    openPop = pop;
    openPopAnchor = anchor;
    anchor.setAttribute('aria-expanded', 'true');
    const first = pop.querySelector('button, a, input');
    if (first && pop.getAttribute('role') === 'menu') first.focus({ preventScroll: true });
  };
  window.closePopover = function () {
    if (!openPop) return;
    const p = openPop;
    const a = openPopAnchor;
    openPop = null;
    openPopAnchor = null;
    if (a) a.setAttribute('aria-expanded', 'false');
    M.unpop(p);
  };
  document.addEventListener('pointerdown', (e) => {
    if (openPop && !openPop.contains(e.target) && !(openPopAnchor && openPopAnchor.contains(e.target))) closePopover();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openPop) { const a = openPopAnchor; closePopover(); if (a) a.focus(); e.stopPropagation(); }
  }, true);

  /* ---------------- Xem ảnh (lightbox) ----------------
     openLightbox(items, index = 0, caption = '')
       items: mảng <img> thumbnail (lấy data-full nếu có, không thì src; chú thích lấy data-caption)
              hoặc mảng { src, alt, caption, thumb } cho ảnh không hiện trên trang (vd. ảnh thứ 5+ của bài viết).
     Ảnh phóng ra từ đúng thumbnail và thu về đúng thumbnail của ảnh đang xem khi đóng.
     Nhiều ảnh: nút ‹ ›, phím ← →, vuốt ngang (cảm ứng). Esc đóng. DOM tự tạo khi mở lần đầu. */
  const LB = { el: null, items: [], i: 0, caption: '', opener: null };
  function lbBuild() {
    if (LB.el) return LB.el;
    const el = document.createElement('div');
    el.className = 'a-lightbox';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Xem ảnh');
    el.innerHTML = `
      <div class="a-lightbox__scrim" data-lb-close></div>
      <img class="a-lightbox__img" alt="">
      <button class="a-btn a-btn--ghost a-btn--icon a-lightbox__btn a-lightbox__close" type="button" data-lb-close aria-label="Đóng (Esc)"><i data-lucide="x"></i></button>
      <button class="a-btn a-btn--ghost a-btn--icon a-lightbox__btn a-lightbox__prev" type="button" data-lb-step="-1" aria-label="Ảnh trước (←)"><i data-lucide="chevron-left"></i></button>
      <button class="a-btn a-btn--ghost a-btn--icon a-lightbox__btn a-lightbox__next" type="button" data-lb-step="1" aria-label="Ảnh sau (→)"><i data-lucide="chevron-right"></i></button>
      <div class="a-lightbox__foot"><span class="a-lightbox__count a-num"></span><span class="a-lightbox__caption"></span></div>`;
    document.body.append(el);
    renderIcons();
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-lb-close]')) { closeLightbox(); return; }
      const s = e.target.closest('[data-lb-step]');
      if (s) lbStep(+s.dataset.lbStep);
    });
    let sx = null;
    el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sx = e.clientX; });
    el.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1);
    });
    LB.el = el;
    return el;
  }
  const lbImg = () => $('.a-lightbox__img', LB.el);
  const lbVisible = (t) => t && t.isConnected && t.getBoundingClientRect().height > 0;
  function lbFrom(r) {
    const t = lbImg().getBoundingClientRect();
    return `translate(${r.left + r.width / 2 - (t.left + t.width / 2)}px, ${r.top + r.height / 2 - (t.top + t.height / 2)}px) scale(${r.width / t.width})`;
  }
  function lbFill(i) {
    LB.i = i;
    const it = LB.items[i];
    const n = LB.items.length;
    const img = lbImg();
    img.src = it.src;
    img.alt = it.alt || '';
    $('.a-lightbox__caption', LB.el).textContent = it.caption || LB.caption || '';
    $('.a-lightbox__count', LB.el).textContent = n > 1 ? `${i + 1} / ${n}` : '';
    $('.a-lightbox__prev', LB.el).hidden = n < 2;
    $('.a-lightbox__next', LB.el).hidden = n < 2;
    $('.a-lightbox__prev', LB.el).disabled = i === 0;
    $('.a-lightbox__next', LB.el).disabled = i === n - 1;
    return img.decode().catch(() => {});
  }
  async function lbStep(dir) {
    const j = LB.i + dir;
    if (j < 0 || j >= LB.items.length) { M.shake(lbImg()); return; }
    const img = lbImg();
    await M.animate(img, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dir * 32}px)` }], { duration: 120, easing: M.EASE_IN, fill: 'forwards' }).finished.catch(() => {});
    await lbFill(j);
    img.getAnimations().forEach((a) => a.cancel());
    M.animate(img, [{ opacity: 0, transform: `translateX(${dir * 32}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: M.EASE_OUT });
  }
  window.openLightbox = async function (items, index = 0, caption = '') {
    lbBuild();
    LB.items = Array.from(items).map((x) => (x instanceof Element
      ? { src: x.dataset.full || x.currentSrc || x.src, alt: x.alt, caption: x.dataset.caption, thumb: x }
      : x));
    LB.caption = caption;
    LB.opener = document.activeElement;
    await lbFill(index);
    LB.el.hidden = false;
    const thumb = LB.items[index].thumb;
    M.animate($('.a-lightbox__scrim', LB.el), [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: M.EASE_OUT });
    if (lbVisible(thumb)) {
      M.animate(lbImg(), [{ transform: lbFrom(thumb.getBoundingClientRect()), borderRadius: '14px' }, { transform: 'none', borderRadius: '10px' }], { duration: 360, easing: M.EASE_OUT });
    } else {
      M.animate(lbImg(), [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: M.EASE_OUT });
    }
    $('.a-lightbox__close', LB.el).focus();
  };
  window.closeLightbox = async function () {
    if (!LB.el || LB.el.hidden) return;
    const thumb = LB.items[LB.i].thumb;
    const img = lbImg();
    M.animate($('.a-lightbox__scrim', LB.el), [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    await M.animate(img, lbVisible(thumb)
      ? [{ transform: 'none' }, { transform: lbFrom(thumb.getBoundingClientRect()) }]
      : [{ transform: 'none', opacity: 1 }, { transform: 'scale(.96)', opacity: 0 }], { duration: 260, easing: M.EASE_OUT, fill: 'forwards' }).finished.catch(() => {});
    LB.el.hidden = true;
    LB.el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    const back = (lbVisible(thumb) && thumb.closest('button, a')) || LB.opener;
    if (back && back.isConnected) back.focus({ preventScroll: true });
  };
  window.isLightboxOpen = () => !!LB.el && !LB.el.hidden;
  /* capture: chặn Esc/←/→ trước khi tới phím tắt của trang */
  document.addEventListener('keydown', (e) => {
    if (!window.isLightboxOpen()) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeLightbox(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); lbStep(e.key === 'ArrowLeft' ? -1 : 1); }
  }, true);

  /* ---------------- Rail ---------------- */
  const rail = $('.a-rail');
  const railInd = rail && $('.a-rail__nav > .a-indicator', rail);
  function placeRail(instant) {
    if (!railInd) return;
    M.indicator(railInd, $('.a-rail__item[aria-current="page"]', rail), { instant });
  }
  window.addEventListener('load', () => placeRail(true));
  window.addEventListener('resize', () => placeRail(true));
  if (rail) {
    $$('.a-rail__item', rail).forEach((item) => {
      item.addEventListener('pointerenter', () => {
        if (item.getAttribute('aria-current') === 'page' || !railInd) return;
        const cur = $('.a-rail__item[aria-current="page"]', rail);
        if (!cur) return;
        /* Xem trước: chỉ báo nhích 25% quãng đường về phía mục đang hover */
        const c = cur.getBoundingClientRect();
        const t = item.getBoundingClientRect();
        railInd.style.translate = `0 ${(t.top - c.top) * .12}px`;
      });
      item.addEventListener('pointerleave', () => { if (railInd) railInd.style.translate = ''; });
    });
  }

  /* Mobile: tab bar ẩn khi cuộn xuống, hiện khi cuộn lên */
  let lastY = scrollY;
  window.addEventListener('scroll', () => {
    if (!rail || !matchMedia('(max-width: 767px)').matches) return;
    const y = scrollY;
    if (Math.abs(y - lastY) < 6) return;
    rail.classList.toggle('is-hidden', y > lastY && y > 80);
    lastY = y;
  }, { passive: true });

  /* ---------------- Theme ---------------- */
  function syncThemeIcon() {
    const btn = $('[data-action="theme"]');
    if (!btn) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    btn.innerHTML = `<i data-lucide="${dark ? 'sun' : 'moon'}"></i>`;
    btn.setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
    renderIcons();
  }
  window.syncThemeIcon = syncThemeIcon;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="theme"]');
    if (!btn) return;
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    M.setTheme(next, btn);
    setTimeout(syncThemeIcon, 30);
  });

  /* ---------------- Notifications (dữ liệu mẫu) ---------------- */
  const NOTIFS = [
    { unread: true, icon: 'calendar-clock', text: '<b>TechNova</b> hẹn bạn phỏng vấn vòng 1 lúc 14:00, thứ Ba', time: '5 phút' },
    { unread: true, icon: 'user-plus', text: '<b>Lê Thu Hà</b> đã chấp nhận lời mời kết bạn', time: '1 giờ' },
    { unread: true, icon: 'file-check', text: 'Đơn ứng tuyển <b>Frontend Developer</b> đã được xem', time: '3 giờ' },
    { unread: true, icon: 'heart', text: '<b>Đỗ Khánh Linh</b> và 4 người khác thích bài viết của bạn', time: 'Hôm qua' },
    { unread: false, icon: 'briefcase', text: '3 việc làm mới khớp với hồ sơ <b>React · TP.HCM</b>', time: '2 ngày' }
  ];
  function renderNotifs(pop) {
    pop.style.width = '360px';
    pop.style.padding = '0';
    const unread = NOTIFS.filter((n) => n.unread).length;
    pop.innerHTML = `
      <div style="display:flex;align-items:center;padding:12px 12px 8px 16px">
        <b style="flex:1;font-size:15px">Thông báo</b>
        <button class="a-btn a-btn--ghost a-btn--sm" type="button" data-markall ${unread ? '' : 'disabled'}>Đánh dấu đã đọc</button>
      </div>
      <div class="a-list" style="padding:0 6px 6px;gap:0">
        ${NOTIFS.map((n, i) => `
          <a class="a-row notif${n.unread ? ' is-unread' : ''}" href="#" data-i="${i}" style="align-items:flex-start;min-height:0;padding:10px">
            <span class="notif__bar" aria-hidden="true"></span>
            <i data-lucide="${n.icon}" style="width:18px;height:18px;margin-top:2px;color:var(--text-3)"></i>
            <span class="a-row__main" style="font-size:13px;line-height:1.45;color:var(--text-2)">${n.text}<br><span class="a-row__meta">${n.time} trước</span></span>
          </a>`).join('')}
      </div>`;
    renderIcons();
    pop.querySelector('[data-markall]').addEventListener('click', (e) => {
      NOTIFS.forEach((n) => { n.unread = false; });
      $$('.notif.is-unread', pop).forEach((row) => row.classList.remove('is-unread'));
      e.currentTarget.disabled = true;
      const badge = $('[data-action="notifications"] .a-badge');
      if (badge) {
        M.animate(badge, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.4)', opacity: 0 }], { duration: 200, easing: M.EASE_IN, fill: 'forwards' })
          .finished.then(() => badge.remove());
      }
    });
  }

  function renderAccount(pop) {
    pop.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;padding:8px 10px 10px">
        ${avatarHtml('Đặng Khoa', 36)}
        <div><div style="font-weight:600">Đặng Khoa</div><div style="font-size:12px;color:var(--text-3)">ungvien@aris.vn</div></div>
      </div>
      <div class="a-menu__sep"></div>
      <a class="a-menu__item" href="#profile"><i data-lucide="circle-user"></i>Hồ sơ của tôi</a>
      <a class="a-menu__item" href="#cv"><i data-lucide="file-text"></i>CV của tôi</a>
      <a class="a-menu__item" href="#settings"><i data-lucide="settings"></i>Cài đặt</a>
      <div class="a-menu__sep"></div>
      <button class="a-menu__item a-menu__item--danger" type="button"><i data-lucide="log-out"></i>Đăng xuất</button>`;
    renderIcons();
  }

  document.addEventListener('click', (e) => {
    const n = e.target.closest('[data-action="notifications"]');
    if (n) { const pop = $('#notifPop'); renderNotifs(pop); openPopover(pop, n, 'right'); return; }
    const a = e.target.closest('[data-action="account"]');
    if (a) { const pop = $('#accountPop'); renderAccount(pop); openPopover(pop, a, 'right'); return; }
    const d = e.target.closest('[data-action="demo"]');
    if (d) {
      const pop = $('#demoPop');
      const items = window.ArisDemo || [];
      pop.innerHTML = '<div class="a-menu__label">Mô phỏng (chỉ có trong bản thiết kế)</div>' +
        items.map((it, i) => `<button class="a-menu__item" type="button" data-demo="${i}"><i data-lucide="${it.icon}"></i>${it.label}</button>`).join('');
      renderIcons();
      pop.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => { closePopover(); items[+b.dataset.demo].run(); }));
      openPopover(pop, d, 'right');
    }
  });

  /* ---------------- Command palette (dữ liệu mẫu) ---------------- */
  const PAL_DATA = [
    { group: 'Hành động', icon: 'plus-square', label: 'Tạo bài viết', meta: 'N', run: () => compose(null) },
    { group: 'Hành động', icon: 'file-text', label: 'Tạo CV mới', href: '#cv' },
    { group: 'Hành động', icon: 'file-check', label: 'Xem đơn ứng tuyển', href: '#applications' },
    { group: 'Hành động', icon: 'moon', label: 'Đổi giao diện sáng / tối', run: () => $('[data-action="theme"]').click() },
    { group: 'Việc làm', icon: 'briefcase', label: 'Frontend Developer (React)', meta: 'TechNova · 25–35 triệu', href: 'jobs.html' },
    { group: 'Việc làm', icon: 'briefcase', label: 'Chuyên viên Marketing', meta: 'GreenLeaf Foods · 12–18 triệu', href: 'jobs.html' },
    { group: 'Việc làm', icon: 'briefcase', label: 'Thực tập sinh Data Analyst', meta: 'Sao Mai Retail · 5 triệu', href: 'jobs.html' },
    { group: 'Công ty', icon: 'building-2', label: 'TechNova', meta: '12 việc đang tuyển', href: '#companies' },
    { group: 'Công ty', icon: 'building-2', label: 'GreenLeaf Foods', meta: '3 việc đang tuyển', href: '#companies' },
    { group: 'Mọi người', icon: 'circle-user', label: 'Nguyễn Minh Anh', meta: 'Tuyển dụng · TechNova', href: 'chat.html' },
    { group: 'Mọi người', icon: 'circle-user', label: 'Lê Thu Hà', meta: 'Bạn bè', href: 'chat.html' }
  ];
  const palette = $('#palette');
  const palScrim = $('#paletteScrim');
  let palItems = [];
  let palIndex = 0;
  let palOrigin = null;
  function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function hl(label, q) {
    if (!q) return label;
    const i = norm(label).indexOf(norm(q));
    if (i < 0) return label;
    return label.slice(0, i) + '<mark>' + label.slice(i, i + q.length) + '</mark>' + label.slice(i + q.length);
  }
  function renderPalette(q) {
    const list = $('.a-palette__list', palette);
    const hits = PAL_DATA.filter((d) => !q || norm(d.label).includes(norm(q)) || norm(d.meta || '').includes(norm(q)));
    let html = '<span class="a-palette__hl" aria-hidden="true"></span>';
    let group = '';
    hits.forEach((d, i) => {
      if (d.group !== group) { group = d.group; html += `<div class="a-palette__group">${group}</div>`; }
      html += `<div class="a-palette__item" role="option" id="pal-${i}" data-i="${i}"><i data-lucide="${d.icon}"></i><span>${hl(d.label, q)}</span>${d.meta ? `<span class="a-row__meta">${d.meta}</span>` : ''}</div>`;
    });
    if (!hits.length) html += `<div class="a-empty"><i data-lucide="search"></i><div class="a-empty__title">Không thấy “${q.replace(/</g, '&lt;')}”</div><div class="a-empty__text">Thử tên công ty, vị trí hoặc tên người.</div></div>`;
    M.flip(list, () => { list.innerHTML = html; }, { enter: false });
    renderIcons();
    palItems = hits;
    palIndex = 0;
    moveHl(true);
  }
  function moveHl(instant) {
    const hlEl = $('.a-palette__hl', palette);
    const items = $$('.a-palette__item', palette);
    if (!hlEl) return;
    const it = items[palIndex];
    hlEl.style.display = it ? '' : 'none';
    if (!it) return;
    if (instant) hlEl.style.transition = 'none';
    hlEl.style.transform = `translateY(${it.offsetTop}px)`;
    if (instant) { hlEl.getBoundingClientRect(); hlEl.style.transition = ''; }
    $('.a-palette__input', palette).setAttribute('aria-activedescendant', it.id);
    it.scrollIntoView({ block: 'nearest' });
  }
  function runPal(i) {
    const d = palItems[i];
    if (!d) return;
    closePalette();
    if (d.run) d.run(); else if (d.href) location.href = d.href;
  }
  function openPalette(origin) {
    if (!palette) return;
    palOrigin = origin || document.activeElement;
    palette.innerHTML = `
      <div class="a-palette__search"><i data-lucide="search"></i>
        <input class="a-palette__input" type="text" placeholder="Tìm việc làm, công ty, mọi người hoặc hành động…" role="combobox" aria-expanded="true" aria-controls="palList" aria-label="Tìm nhanh"></div>
      <div class="a-palette__list" id="palList" role="listbox"></div>
      <div class="a-palette__foot"><span><span class="a-kbd">↑</span><span class="a-kbd">↓</span> chọn</span><span><span class="a-kbd">Enter</span> mở</span><span><span class="a-kbd">Esc</span> đóng</span></div>`;
    M.openDialog(palette, palScrim, null);
    const input = $('.a-palette__input', palette);
    renderPalette('');
    input.focus();
    input.addEventListener('input', () => renderPalette(input.value.trim()));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); palIndex = Math.min(palIndex + 1, palItems.length - 1); moveHl(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); palIndex = Math.max(palIndex - 1, 0); moveHl(); }
      if (e.key === 'Enter') { e.preventDefault(); runPal(palIndex); }
    });
    palette.addEventListener('pointermove', (e) => {
      const it = e.target.closest('.a-palette__item');
      if (it && +it.dataset.i !== palIndex) { palIndex = +it.dataset.i; moveHl(); }
    });
    palette.addEventListener('click', (e) => { const it = e.target.closest('.a-palette__item'); if (it) runPal(+it.dataset.i); });
  }
  function closePalette() {
    if (!palette || palette.hidden) return;
    M.closeDialog(palette, palScrim);
    if (palOrigin && palOrigin.focus) palOrigin.focus({ preventScroll: true });
  }
  window.openPalette = openPalette;
  if (palScrim) palScrim.addEventListener('click', closePalette);
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-action="palette"]'); if (b) openPalette(b); });
  /* Tạo bài viết: trang Bảng tin đăng ký window.ArisCompose; trang khác chuyển tới feed.html#compose */
  function compose(origin) { if (window.ArisCompose) window.ArisCompose(origin); else location.href = 'feed.html#compose'; }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-action="compose"]'); if (b) compose(b); });
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, select, [contenteditable="true"]');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette && palette.hidden ? openPalette() : closePalette(); return; }
    if (e.key === 'Escape' && palette && !palette.hidden) { e.preventDefault(); closePalette(); return; }
    if (!typing && e.key === '/' && palette && palette.hidden) { e.preventDefault(); openPalette(); }
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n' && palette && palette.hidden && !document.querySelector('.a-dialog:not([hidden])')) { e.preventDefault(); compose(null); }
  });

  /* ---------------- Mục lục + scrollspy ----------------
     Mục nào đang chiếm phần trên màn hình thì sáng lên; chỉ báo trượt tới mục đó.
     Bấm mục lục: cuộn mượt tới mục (tôn trọng reduced-motion), cập nhật hash không nhảy trang. */
  window.initToc = function (toc) {
    const ind = $('.a-indicator', toc);
    const links = $$('a[href^="#"]', toc);
    const secs = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
    let cur = null;
    const set = (id, instant) => {
      if (id === cur) return;
      cur = id;
      links.forEach((a) => a.setAttribute('aria-current', String(a.hash.slice(1) === id)));
      M.indicator(ind, links.find((a) => a.hash.slice(1) === id), { instant });
    };
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis.length) set(vis[0].target.id);
    }, { rootMargin: '-72px 0px -62% 0px' });
    secs.forEach((s) => io.observe(s));
    toc.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      e.preventDefault();
      const t = document.getElementById(a.hash.slice(1));
      if (!t) return;
      t.scrollIntoView({ behavior: M.reduced() ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', a.hash);
      set(t.id);
    });
    if (secs[0]) set(secs[0].id, true);
  };

  /* ---------------- Init ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    renderIcons();
    syncThemeIcon();
    M.initTooltips();
    M.stickyHeader($('.a-pagehead'));
    $$('[data-toc]').forEach((t) => window.initToc(t));
  });
})();
