/* =============================================================================
   ARIS LINE — Khung ứng dụng dùng chung (V7)
   Rail + chỉ báo trượt, đổi theme, tooltip, popover, lightbox, TOC scrollspy.
   ============================================================================= */
(function () {
  'use strict';
  const M = window.ArisMotion;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  window.renderIcons = function () {
    if (window.lucide) window.lucide.createIcons();
  };

  /* Chữ viết tắt + tông màu avatar ổn định theo tên */
  window.initials = function (name) {
    if (!name) return 'A';
    const parts = name.trim().split(/\s+/);
    const a = parts.length > 1 ? parts[parts.length - 2][0] : '';
    return (a + parts[parts.length - 1][0]).toUpperCase();
  };

  /* Viết tắt tên tổ chức */
  window.orgInitials = function (name) {
    if (!name) return 'AR';
    const words = name.trim().split(/\s+/);
    const parts = words.length > 1 ? words : words[0].split(/(?=\p{Lu})/u);
    const s = parts.length > 1 ? parts[0][0] + parts[1][0] : words[0].slice(0, 2);
    return s.toUpperCase();
  };

  window.toneOf = function (name) {
    if (!name) return 1;
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return (h % 6) + 1;
  };

  window.avatarHtml = function (name, size = 40, online = false, extra = '') {
    return `<span class="a-avatar a-avatar--${size}" data-tone="${window.toneOf(name)}"${online ? ' data-online="true"' : ''} ${extra}>${window.initials(name)}</span>`;
  };

  function browserAvatarUrl(value) {
    const url = new URL(String(value || '').trim(), window.location.href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Unsupported avatar URL.');
    }
    return url.href;
  }

  function setAvatarSource(image, url) {
    if (!image) return;
    image.hidden = false;
    image.dataset.currentUserAvatarImage = 'true';
    image.dataset.arisAvatarManaged = 'true';
    delete image.dataset.arisFallbackApplied;
    image.classList.remove('aris-img-fallback');
    image.onerror = function () { this.hidden = true; };
    image.src = url;
  }

  // Shared by Settings, Profile, and Company. The server returns a new immutable
  // same-origin media URL for every upload, so there is no Drive cache-buster or
  // cross-origin preload gate between a successful upload and the UI update.
  window.updateCurrentUserAvatar = async function (value, extraImages = []) {
    const url = browserAvatarUrl(value);

    const targets = $$('[data-current-user-avatar]').map((container) => {
      let image = Array.from(container.children).find((child) => child.tagName === 'IMG');
      if (!image) {
        image = document.createElement('img');
        image.alt = '';
        container.append(image);
      }
      return image;
    });
    const extras = Array.isArray(extraImages) ? extraImages : [extraImages];
    [...targets, ...extras].forEach((image) => setAvatarSource(image, url));
    return url;
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
    if (side === 'right') {
      left = a.right + 8;
      top = a.bottom - p.height;
    } else if (side === 'top') {
      left = a.left + a.width / 2 - p.width / 2;
      top = a.top - p.height - 8;
    } else if (side === 'bottom-end') {
      left = a.right - p.width;
      top = a.bottom + 6;
    } else if (side === 'top-start') {
      left = a.left;
      top = a.top - p.height - 8;
    } else {
      left = a.left;
      top = a.bottom + 6;
    }
    left = Math.max(8, Math.min(left, innerWidth - p.width - 8));
    top = Math.max(8, Math.min(top, innerHeight - p.height - 8));
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  window.openPopover = function (pop, anchor, side) {
    if (!pop || !anchor) return;
    if (openPop === pop) {
      window.closePopover();
      return;
    }
    window.closePopover();
    place(pop, anchor, side);
    if (M && M.pop) M.pop(pop, anchor);
    openPop = pop;
    openPopAnchor = anchor;
    anchor.setAttribute('aria-expanded', 'true');
    const first = pop.querySelector('button:not([disabled]), a[href], input');
    if (first && pop.getAttribute('role') === 'menu') first.focus({ preventScroll: true });
  };

  window.closePopover = function () {
    if (!openPop) return;
    const p = openPop;
    const a = openPopAnchor;
    openPop = null;
    openPopAnchor = null;
    if (a) a.setAttribute('aria-expanded', 'false');
    if (M && M.unpop) M.unpop(p);
    else p.hidden = true;
  };

  document.addEventListener('pointerdown', (e) => {
    if (openPop && !openPop.contains(e.target) && !(openPopAnchor && openPopAnchor.contains(e.target))) {
      window.closePopover();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openPop) {
      const a = openPopAnchor;
      window.closePopover();
      if (a) a.focus();
      e.stopPropagation();
    }
  }, true);

  /* ---------------- Lightbox (Xem ảnh) ---------------- */
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
    window.renderIcons();
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-lb-close]')) {
        window.closeLightbox();
        return;
      }
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
    if (j < 0 || j >= LB.items.length) {
      if (M && M.shake) M.shake(lbImg());
      return;
    }
    const img = lbImg();
    if (M && M.animate) {
      await M.animate(img, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dir * 32}px)` }], { duration: 120, easing: M.EASE_IN, fill: 'forwards' }).finished.catch(() => {});
    }
    await lbFill(j);
    img.getAnimations().forEach((a) => a.cancel());
    if (M && M.animate) {
      M.animate(img, [{ opacity: 0, transform: `translateX(${dir * 32}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: M.EASE_OUT });
    }
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
    const thumb = LB.items[index]?.thumb;
    if (M && M.animate) {
      M.animate($('.a-lightbox__scrim', LB.el), [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: M.EASE_OUT });
      if (lbVisible(thumb)) {
        M.animate(lbImg(), [{ transform: lbFrom(thumb.getBoundingClientRect()), borderRadius: '14px' }, { transform: 'none', borderRadius: '10px' }], { duration: 360, easing: M.EASE_OUT });
      } else {
        M.animate(lbImg(), [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: M.EASE_OUT });
      }
    }
    $('.a-lightbox__close', LB.el)?.focus();
  };

  window.closeLightbox = async function () {
    if (!LB.el || LB.el.hidden) return;
    const thumb = LB.items[LB.i]?.thumb;
    const img = lbImg();
    if (M && M.animate) {
      M.animate($('.a-lightbox__scrim', LB.el), [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      await M.animate(img, lbVisible(thumb)
        ? [{ transform: 'none' }, { transform: lbFrom(thumb.getBoundingClientRect()) }]
        : [{ transform: 'none', opacity: 1 }, { transform: 'scale(.96)', opacity: 0 }], { duration: 260, easing: M.EASE_OUT, fill: 'forwards' }).finished.catch(() => {});
    }
    LB.el.hidden = true;
    LB.el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    const back = (lbVisible(thumb) && thumb.closest('button, a')) || LB.opener;
    if (back && back.isConnected) back.focus({ preventScroll: true });
  };

  window.isLightboxOpen = () => !!LB.el && !LB.el.hidden;

  document.addEventListener('keydown', (e) => {
    if (!window.isLightboxOpen()) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); window.closeLightbox(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); lbStep(e.key === 'ArrowLeft' ? -1 : 1); }
  }, true);

  /* ---------------- Sidebar (mở rộng / thu gọn) · Tab bar ---------------- */
  const html = document.documentElement;
  const side = $('.a-side');
  const sideInd = side && $('.a-side__nav > .a-indicator', side);
  const tabbar = $('.a-tabbar');
  const isNarrow = () => window.matchMedia('(min-width: 768px) and (max-width: 1099px)').matches;
  const savedSide = () => { try { return localStorage.getItem('aris-side'); } catch (e) { return null; } };

  function placeSide(instant) {
    if (!sideInd || !M || !M.indicator) return;
    const cur = $('.a-side__item[aria-current="page"]', side);
    M.indicator(sideInd, cur || null, { instant });
  }

  /* Tooltip chỉ khi thu gọn; nhãn lấy từ data-label */
  function syncSideTips(mini) {
    if (!side) return;
    $$('[data-label]', side).forEach((el) => {
      if (mini) el.setAttribute('data-tip', el.dataset.label);
      else el.removeAttribute('data-tip');
    });
  }

  function applySide(mode, animate) {
    const mini = mode === 'mini';
    if (animate && !(M && M.reduced && M.reduced())) {
      html.classList.add('is-side-anim');
      clearTimeout(applySide._t);
      applySide._t = setTimeout(() => html.classList.remove('is-side-anim'), 380);
    }
    if (mini) html.dataset.side = 'mini'; else delete html.dataset.side;
    syncSideTips(mini);
    const t = side && $('.a-side__toggle', side);
    if (t) {
      t.setAttribute('aria-expanded', String(!mini));
      t.setAttribute('aria-label', mini ? 'Mở rộng thanh điều hướng (Ctrl \\)' : 'Thu gọn thanh điều hướng (Ctrl \\)');
    }
    setTimeout(() => placeSide(true), animate ? 360 : 0);
  }

  if (side) {
    applySide(isNarrow() ? 'mini' : (savedSide() === 'mini' ? 'mini' : 'full'), false);
    const toggle = $('.a-side__toggle', side);
    if (toggle) toggle.addEventListener('click', () => {
      const next = html.dataset.side === 'mini' ? 'full' : 'mini';
      if (!isNarrow()) { try { localStorage.setItem('aris-side', next); } catch (e) { /* private mode */ } }
      applySide(next, true);
    });
    /* Xem trước: chỉ báo nhích 12% về phía mục đang rê chuột */
    $$('.a-side__item', side).forEach((item) => {
      item.addEventListener('pointerenter', () => {
        if (!sideInd || item.getAttribute('aria-current') === 'page') return;
        const cur = $('.a-side__item[aria-current="page"]', side);
        if (!cur) return;
        sideInd.style.translate = `0 ${(item.getBoundingClientRect().top - cur.getBoundingClientRect().top) * 0.12}px`;
      });
      item.addEventListener('pointerleave', () => { if (sideInd) sideInd.style.translate = ''; });
    });
    /* Vòng % hồ sơ: chạy từ 0 lên giá trị thật */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$('.a-ring[data-p]', side).forEach((r) => r.style.setProperty('--p', r.dataset.p));
    }));
  }
  window.addEventListener('load', () => placeSide(true));
  window.addEventListener('resize', () => {
    if (side && isNarrow() && html.dataset.side !== 'mini') applySide('mini', false);
    else if (side && !isNarrow() && html.dataset.side === 'mini' && savedSide() !== 'mini') applySide('full', false);
    placeSide(true);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === '\\' && side) { e.preventDefault(); const t = $('.a-side__toggle', side); if (t) t.click(); }
  });

  /* Mobile: tab bar ẩn khi cuộn xuống, hiện khi cuộn lên */
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    if (!tabbar || !window.matchMedia('(max-width: 767px)').matches) return;
    const y = window.scrollY;
    if (Math.abs(y - lastY) < 6) return;
    tabbar.classList.toggle('is-hidden', y > lastY && y > 80);
    lastY = y;
  }, { passive: true });

  /* ---------------- Theme ---------------- */
  function syncThemeIcon() {
    const dark = html.dataset.theme === 'dark';
    const icon = dark ? 'sun' : 'moon';
    const label = dark ? 'Giao diện sáng' : 'Giao diện tối';
    $$('[data-action="theme"]').forEach((btn) => {
      const lab = $('.a-side__item-label', btn);
      if (lab) {
        lab.textContent = label;
        const old = btn.querySelector('svg, i');
        if (old) old.outerHTML = `<i data-lucide="${icon}"></i>`;
        btn.dataset.label = label;
        if (html.dataset.side === 'mini') btn.setAttribute('data-tip', label);
      } else {
        btn.innerHTML = `<i data-lucide="${icon}"></i>`;
      }
      btn.setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
    });
    window.renderIcons();
  }
  window.syncThemeIcon = syncThemeIcon;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="theme"]');
    if (!btn) return;
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    if (M && M.setTheme) M.setTheme(next, btn);
    else html.dataset.theme = next;
    setTimeout(syncThemeIcon, 30);
  });

  /* ---------------- Account & Notification Popovers ---------------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action="account"]');
    if (a) {
      const pop = $('#accountPop');
      if (pop) window.openPopover(pop, a, a.closest('.a-side') ? 'top-start' : 'bottom-end');
      return;
    }
    const n = e.target.closest('[data-action="notifications"]');
    if (n) {
      e.preventDefault();
      const pop = $('#notifPop');
      if (pop) window.openPopover(pop, n, n.closest('.a-tabbar') ? 'top' : 'bottom-end');
    }
  });

  /* Nút Tạo bài viết */
  function compose(origin) {
    if (window.ArisCompose) {
      window.ArisCompose(origin);
    } else {
      window.location.href = '/Dashboard/Index#compose';
    }
  }
  window.ArisAppCompose = compose;

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action="compose"]');
    if (b) compose(b);
  });

  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n' && !document.querySelector('.a-dialog:not([hidden])')) {
      e.preventDefault();
      compose(null);
    }
  });

  /* ---------------- Mục lục + scrollspy ---------------- */
  window.initToc = function (toc) {
    if (!toc) return;
    const ind = $('.a-indicator', toc);
    const links = $$('a[href^="#"]', toc);
    const secs = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
    let cur = null;
    const set = (id, instant) => {
      if (id === cur) return;
      cur = id;
      links.forEach((a) => a.setAttribute('aria-current', String(a.hash.slice(1) === id)));
      const activeLink = links.find((a) => a.hash.slice(1) === id);
      if (activeLink && ind && M && M.indicator) {
        M.indicator(ind, activeLink, { instant });
      }
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
      t.scrollIntoView({ behavior: (M && M.reduced && M.reduced()) ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', a.hash);
      set(t.id);
    });
    if (secs[0]) set(secs[0].id, true);
  };

  /* ---------------- Init ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    window.renderIcons();
    syncThemeIcon();
    if (M && M.initTooltips) M.initTooltips();
    if (M && M.stickyHeader) M.stickyHeader($('.a-pagehead'));
    $$('[data-toc]').forEach((t) => window.initToc(t));
  });
})();
