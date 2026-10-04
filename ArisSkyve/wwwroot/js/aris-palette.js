/* =============================================================================
   ARIS LINE — Command Palette (Ctrl+K, /)
   Nối tìm kiếm thời gian thực GET /Search/Global và hành động nhanh
   ============================================================================= */
(function () {
  'use strict';
  const M = window.ArisMotion;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  let palette = $('#palette');
  let palScrim = $('#paletteScrim');
  let palItems = [];
  let palIndex = 0;
  let palOrigin = null;
  let searchAbortCtrl = null;
  let debounceTimer = null;

  const STATIC_ACTIONS = [
    { group: 'Hành động', icon: 'plus-square', label: 'Tạo bài viết', meta: 'N', run: () => window.ArisAppCompose ? window.ArisAppCompose() : location.href = '/Dashboard/Index#compose' },
    { group: 'Hành động', icon: 'file-text', label: 'Tạo CV mới', href: '/Resume' },
    { group: 'Hành động', icon: 'file-check', label: 'Xem đơn ứng tuyển', href: '/JobApplications/MyApplications' },
    { group: 'Hành động', icon: 'moon', label: 'Đổi giao diện sáng / tối', run: () => $('[data-action="theme"]')?.click() },
    { group: 'Hành động', icon: 'settings', label: 'Cài đặt', href: '/Settings' },
    { group: 'Hành động', icon: 'briefcase', label: 'Khám phá việc làm', href: '/Jobs' },
    { group: 'Hành động', icon: 'building-2', label: 'Danh sách công ty', href: '/Company' },
    { group: 'Hành động', icon: 'message-circle', label: 'Tin nhắn', href: '/Chat' }
  ];

  function getRecents() {
    try {
      return JSON.parse(localStorage.getItem('aris-palette-recent') || '[]');
    } catch {
      return [];
    }
  }

  function addRecent(item) {
    if (!item || !item.label) return;
    try {
      const recents = getRecents().filter(r => r.label !== item.label);
      recents.unshift({
        group: 'Gần đây',
        icon: item.icon || 'clock',
        label: item.label,
        meta: item.meta || '',
        href: item.href || ''
      });
      localStorage.setItem('aris-palette-recent', JSON.stringify(recents.slice(0, 6)));
    } catch {}
  }

  function norm(s) {
    if (!s) return '';
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  function hl(label, q) {
    if (!q) return label;
    const i = norm(label).indexOf(norm(q));
    if (i < 0) return label;
    return label.slice(0, i) + '<mark>' + label.slice(i, i + q.length) + '</mark>' + label.slice(i + q.length);
  }

  function ensurePaletteElements() {
    if (!palScrim) {
      palScrim = document.createElement('div');
      palScrim.id = 'paletteScrim';
      palScrim.className = 'a-scrim';
      palScrim.hidden = true;
      document.body.appendChild(palScrim);
      palScrim.addEventListener('click', closePalette);
    }
    if (!palette) {
      palette = document.createElement('div');
      palette.id = 'palette';
      palette.className = 'a-palette a-dialog';
      palette.setAttribute('role', 'dialog');
      palette.setAttribute('aria-modal', 'true');
      palette.setAttribute('aria-label', 'Tìm nhanh');
      palette.hidden = true;
      document.body.appendChild(palette);
    }
  }

  function renderList(items, q) {
    const list = $('.a-palette__list', palette);
    if (!list) return;

    let html = '<span class="a-palette__hl" aria-hidden="true"></span>';
    let group = '';
    items.forEach((d, i) => {
      if (d.group !== group) {
        group = d.group;
        html += `<div class="a-palette__group">${group}</div>`;
      }
      html += `<div class="a-palette__item" role="option" id="pal-${i}" data-i="${i}">
        <i data-lucide="${d.icon}"></i>
        <span>${hl(d.label, q)}</span>
        ${d.meta ? `<span class="a-row__meta">${d.meta}</span>` : ''}
      </div>`;
    });

    if (!items.length) {
      html += `<div class="a-empty">
        <i data-lucide="search"></i>
        <div class="a-empty__title">Không thấy “${q.replace(/</g, '&lt;')}”</div>
        <div class="a-empty__text">Thử tìm theo tên công ty, chức danh việc làm hoặc tên người dùng.</div>
      </div>`;
    }

    if (M && M.flip) {
      M.flip(list, () => { list.innerHTML = html; }, { enter: false });
    } else {
      list.innerHTML = html;
    }

    window.renderIcons();
    palItems = items;
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
    if (instant) {
      hlEl.getBoundingClientRect();
      hlEl.style.transition = '';
    }
    $('.a-palette__input', palette)?.setAttribute('aria-activedescendant', it.id);
    it.scrollIntoView({ block: 'nearest' });
  }

  function runPal(i) {
    const d = palItems[i];
    if (!d) return;
    closePalette();
    if (d.href) {
      addRecent(d);
      location.href = d.href;
    } else if (d.run) {
      d.run();
    }
  }

  async function queryGlobalSearch(q) {
    if (searchAbortCtrl) {
      searchAbortCtrl.abort();
    }
    searchAbortCtrl = new AbortController();

    const staticMatches = STATIC_ACTIONS.filter(d => norm(d.label).includes(norm(q)));

    try {
      const res = await fetch(`/Search/Global?q=${encodeURIComponent(q)}`, {
        signal: searchAbortCtrl.signal
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();

      const hits = [...staticMatches];

      if (data.jobs && data.jobs.length) {
        data.jobs.forEach(j => {
          hits.push({
            group: 'Việc làm',
            icon: 'briefcase',
            label: j.title,
            meta: `${j.company}${j.salary ? ' · ' + j.salary : ''}`,
            href: `/Jobs/Details/${j.id}`
          });
        });
      }

      if (data.companies && data.companies.length) {
        data.companies.forEach(c => {
          hits.push({
            group: 'Công ty',
            icon: 'building-2',
            label: c.name,
            meta: c.industry || '',
            href: `/Company/Details/${c.id}`
          });
        });
      }

      if (data.people && data.people.length) {
        data.people.forEach(p => {
          hits.push({
            group: 'Mọi người',
            icon: 'circle-user',
            label: p.username,
            meta: '',
            href: `/Chat/Index?userId=${p.id}`
          });
        });
      }

      renderList(hits, q);
    } catch (err) {
      if (err.name === 'AbortError') return;
      // Lỗi mạng hoặc server: hiện kết quả tĩnh kèm thông báo
      const list = $('.a-palette__list', palette);
      if (staticMatches.length > 0) {
        renderList(staticMatches, q);
      } else if (list) {
        list.innerHTML = `<div class="a-empty">
          <i data-lucide="wifi-off"></i>
          <div class="a-empty__title">Chưa tìm được</div>
          <div class="a-empty__text">Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.</div>
        </div>`;
        window.renderIcons();
      }
    }
  }

  function handleQueryChange(val) {
    const q = val.trim();
    if (!q) {
      if (searchAbortCtrl) searchAbortCtrl.abort();
      const recents = getRecents();
      const initialItems = [...recents, ...STATIC_ACTIONS];
      renderList(initialItems, '');
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      queryGlobalSearch(q);
    }, 250);
  }

  function openPalette(origin) {
    ensurePaletteElements();
    palOrigin = origin || document.activeElement;
    palette.innerHTML = `
      <div class="a-palette__search">
        <i data-lucide="search"></i>
        <input class="a-palette__input" type="text" placeholder="Tìm việc làm, công ty, mọi người hoặc hành động…" role="combobox" aria-expanded="true" aria-controls="palList" aria-label="Tìm nhanh">
      </div>
      <div class="a-palette__list" id="palList" role="listbox"></div>
      <div class="a-palette__foot">
        <span><span class="a-kbd">↑</span><span class="a-kbd">↓</span> chọn</span>
        <span><span class="a-kbd">Enter</span> mở</span>
        <span><span class="a-kbd">Esc</span> đóng</span>
      </div>`;

    if (M && M.openDialog) {
      M.openDialog(palette, palScrim, palOrigin);
    } else {
      palette.hidden = false;
      palScrim.hidden = false;
    }

    const input = $('.a-palette__input', palette);
    const recents = getRecents();
    renderList([...recents, ...STATIC_ACTIONS], '');
    input.focus();

    input.addEventListener('input', () => handleQueryChange(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        palIndex = Math.min(palIndex + 1, palItems.length - 1);
        moveHl();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        palIndex = Math.max(palIndex - 1, 0);
        moveHl();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        runPal(palIndex);
      }
    });

    palette.addEventListener('pointermove', (e) => {
      const it = e.target.closest('.a-palette__item');
      if (it && +it.dataset.i !== palIndex) {
        palIndex = +it.dataset.i;
        moveHl();
      }
    });

    palette.addEventListener('click', (e) => {
      const it = e.target.closest('.a-palette__item');
      if (it) runPal(+it.dataset.i);
    });
  }

  function closePalette() {
    if (!palette || palette.hidden) return;
    if (searchAbortCtrl) searchAbortCtrl.abort();
    if (M && M.closeDialog) {
      M.closeDialog(palette, palScrim);
    } else {
      palette.hidden = true;
      if (palScrim) palScrim.hidden = true;
    }
    if (palOrigin && palOrigin.focus) {
      palOrigin.focus({ preventScroll: true });
    }
  }

  window.openPalette = openPalette;
  window.closePalette = closePalette;

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action="palette"]');
    if (b) openPalette(b);
  });

  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, select, [contenteditable="true"]');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      ensurePaletteElements();
      palette.hidden ? openPalette() : closePalette();
      return;
    }
    if (e.key === 'Escape' && palette && !palette.hidden) {
      e.preventDefault();
      closePalette();
      return;
    }
    if (!typing && e.key === '/' && (!palette || palette.hidden)) {
      e.preventDefault();
      openPalette();
    }
  });
})();
