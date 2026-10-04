/* =============================================================================
   Trang thành phần — dựng bảng màu, bảng tương phản, và các demo "Chạy lại".
   CHỈ có trong bản thiết kế. Mọi demo gọi đúng hàm sẽ port vào app (ArisMotion, shell).
   ============================================================================= */
(function () {
  'use strict';
  const M = window.ArisMotion;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

  /* ---------------- Đọc màu thật từ CSS ---------------- */
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.append(probe);
  const colorOf = (v) => { probe.style.color = ''; probe.style.color = v.startsWith('--') ? `var(${v})` : v; return getComputedStyle(probe).color; };
  const parseRgb = (s) => { const m = s.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3] === undefined ? 1 : m[3]]; };
  const toHex = (c) => { const [r, g, b, a] = parseRgb(c); const h = '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase(); return a < 1 ? `${h} · ${Math.round(a * 100)}%` : h; };
  const over = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
  const lum = (c) => { const [r, g, b] = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (f, b) => { const [hi, lo] = [lum(f), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

  const GROUPS = [
    ['Bề mặt', [['--canvas', 'Nền app: rail, danh sách, bộ lọc'], ['--surface', '"Tờ giấy": vùng làm việc, card đối tượng'], ['--surface-hover', 'Hover trên tờ giấy'], ['--field', 'Ô tìm, track segmented, tag'], ['--hover', 'Lớp phủ khi rê chuột (trong suốt)'], ['--pressed', 'Lớp phủ khi nhấn'], ['--selected', 'Hàng đang chọn trên canvas']]],
    ['Đường kẻ', [['--line', 'Viền card, đường chia'], ['--line-soft', 'Đường chia mảnh bên trong card'], ['--line-strong', 'Viền chip, card chọn được'], ['--line-control', 'Viền ô nhập, checkbox, radio (≥ 3:1)']]],
    ['Chữ', [['--text', 'Chữ chính, tiêu đề'], ['--text-2', 'Chữ phụ, nội dung đọc dài'], ['--text-3', 'Metadata (≥ 4.5:1)'], ['--text-4', 'Placeholder, icon phụ'], ['--text-disabled', 'Chữ bị vô hiệu hoá']]],
    ['Brand — hành động chính, lựa chọn', [['--brand', 'Nút chính, chỉ báo, checkbox bật'], ['--brand-hover', 'Nút chính khi rê chuột'], ['--brand-text', 'Link, chữ màu brand'], ['--brand-soft', 'Nền chip / mục đang chọn'], ['--brand-soft-2', 'Nền chọn đậm, bong bóng của mình'], ['--brand-line', 'Viền chip đang chọn'], ['--focus', 'Vòng focus bàn phím']]],
    ['Accent — CHỈ mới / chưa đọc / đang live', [['--accent', 'Badge chưa đọc, chấm live'], ['--accent-text', 'Chữ "Mới", giờ của tin chưa đọc'], ['--accent-soft', 'Nền tag "Mới"']]],
    ['Trạng thái', [['--success', 'Thành công, đang online'], ['--success-soft', 'Nền trạng thái thành công'], ['--warning', 'Cảnh báo'], ['--warning-soft', 'Nền cảnh báo'], ['--danger', 'Lỗi, chữ nguy hiểm'], ['--danger-soft', 'Nền lỗi'], ['--danger-fill', 'Nền nút nguy hiểm'], ['--on-status', 'Chữ trên nền --success / --warning đặc']]],
    ['Đặc biệt', [['--like', 'CHỈ trái tim đã thích'], ['--inverse', 'Nền toast, tooltip'], ['--on-inverse', 'Chữ trên toast, tooltip'], ['--inverse-action', 'Nút hành động trong toast'], ['--bubble-me', 'Bong bóng chat của mình'], ['--bubble-them', 'Bong bóng chat đối phương'], ['--scrim', 'Lớp tối phía sau hộp thoại']]],
    ['Tông avatar (nền / chữ viết tắt)', [1, 2, 3, 4, 5, 6].map((n) => [`--tone-${n}-bg`, `Tông ${n} · chữ --tone-${n}-fg`])]
  ];
  function renderSwatches() {
    $('#swatches').innerHTML = GROUPS.map(([title, items]) => `<div class="cg-group"><div class="cg-group__title">${title}</div><div class="cg-swatches">${items.map(([v, use]) => {
      const tone = v.includes('tone');
      return `<div class="cg-sw"><span class="cg-sw__chip" style="background:var(${v})${tone ? `;color:var(${v.replace('-bg', '-fg')})` : ''}">${tone ? 'ĐK' : ''}</span><div class="cg-sw__text"><div class="cg-sw__name">${v}</div><div class="cg-sw__val">${toHex(colorOf(v))}</div><div class="cg-sw__use" title="${esc(use)}">${esc(use)}</div></div></div>`;
    }).join('')}</div></div>`).join('');
  }

  /* Giữ đồng bộ với tools/contrast.js */
  const PAIRS = [
    ['--text', '--canvas', 'Chữ chính trên nền app', 4.5], ['--text', '--surface', 'Chữ chính trên tờ giấy', 4.5], ['--text-2', '--surface', 'Chữ phụ, nội dung dài', 4.5],
    ['--text-3', '--canvas', 'Metadata trên nền app', 4.5], ['--text-3', '--surface', 'Metadata trên tờ giấy', 4.5], ['--text-3', '--field', 'Metadata trên ô nhập / tag', 4.5],
    ['--text-4', '--surface', 'Placeholder, icon phụ (đồ hoạ)', 3], ['--text-4', '--field', 'Placeholder trong ô tìm (đồ hoạ)', 3],
    ['--on-brand', '--brand', 'Chữ trên nút chính', 4.5], ['--on-brand', '--brand-hover', 'Chữ trên nút chính khi hover', 4.5],
    ['--brand-text', '--surface', 'Link trên tờ giấy', 4.5], ['--brand-text', '--canvas', 'Link trên nền app', 4.5], ['--brand-text', '--brand-soft', 'Chip / mục đang chọn', 4.5],
    ['--brand', '--surface', 'Chỉ báo "The Line", viền focus (đồ hoạ)', 3], ['--brand', '--canvas', 'Chỉ báo trên nền app (đồ hoạ)', 3],
    ['--line-control', '--surface', 'Viền ô nhập, checkbox, radio (đồ hoạ)', 3], ['--line-control', '--canvas', 'Viền control trên nền app (đồ hoạ)', 3],
    ['#FFFFFF', '--accent', 'Số trên badge chưa đọc', 4.5], ['--accent-text', '--accent-soft', 'Tag "Mới"', 4.5], ['--accent-text', '--canvas', 'Giờ của tin chưa đọc', 4.5],
    ['--success', '--success-soft', 'Trạng thái thành công', 4.5], ['--success', '--surface', 'Chữ thành công', 4.5], ['--warning', '--warning-soft', 'Trạng thái cảnh báo', 4.5],
    ['--danger', '--danger-soft', 'Trạng thái lỗi', 4.5], ['--danger', '--surface', 'Chữ lỗi, mục menu nguy hiểm', 4.5], ['#FFFFFF', '--danger-fill', 'Nút nguy hiểm', 4.5],
    ['--on-status', '--success', 'Nút Nhận cuộc gọi', 4.5], ['--on-status', '--warning', 'Kết quả tìm đang chọn (chat)', 4.5],
    ['--on-inverse', '--inverse', 'Toast, tooltip', 4.5], ['--inverse-action', '--inverse', 'Nút hành động trong toast', 4.5],
    ['--bubble-text', '--bubble-me', 'Bong bóng chat của mình', 4.5], ['--bubble-text', '--bubble-them', 'Bong bóng chat đối phương', 4.5], ['--like', '--surface', 'Tim đã thích (đồ hoạ)', 3]
  ];
  function renderContrast() {
    const rows = PAIRS.map(([fg, bg, use, min]) => {
      const b = over(parseRgb(colorOf(bg)), [255, 255, 255, 1]);
      const f = over(parseRgb(colorOf(fg)), b);
      const r = ratio(f, b);
      return { fg, bg, use, min, r, ok: r >= min };
    });
    window.__contrast = rows;
    const css = (v) => (v.startsWith('--') ? `var(${v})` : v);
    $('#contrastTable tbody').innerHTML = rows.map((x) => `<tr>
      <td><span class="cg-pair"><span class="cg-pair__chip" style="background:${css(x.fg)}"></span><code>${x.fg}</code></span></td>
      <td><span class="cg-pair"><span class="cg-pair__chip" style="background:${css(x.bg)}"></span><code>${x.bg}</code></span></td>
      <td>${esc(x.use)}</td><td class="a-num">${x.min}:1</td>
      <td><span class="cg-ratio"><span class="cg-sample" style="color:${css(x.fg)};background:${css(x.bg)}">Aa</span><b class="a-num">${x.r.toFixed(2)}</b>${x.ok ? '<span class="a-status a-status--success">Đạt</span>' : '<span class="a-status a-status--danger">Chưa đạt</span>'}</span></td></tr>`).join('');
  }

  /* ---------------- Khoảng cách, avatar ---------------- */
  function renderStatic() {
    $('#spaceRow').innerHTML = [[1, 4], [2, 8], [3, 12], [4, 16], [5, 20], [6, 24], [8, 32], [10, 40], [12, 48]]
      .map(([n, px]) => `<div class="cg-space"><span style="width:${px}px;height:${px}px"></span><span>${px}</span><span>--s-${n}</span></div>`).join('');
    const names = ['Nguyễn Minh Anh', 'Lê Thu Hà', 'Phạm Gia Huy', 'Đỗ Khánh Linh', 'Vũ Hoàng Nam', 'Hoàng Mai Phương'];
    $('#avSizes').innerHTML = [24, 28, 32, 36, 40, 44, 56, 72, 96].map((s) => `<span class="a-avatar a-avatar--${s}" data-tone="1" title="${s}px">ĐK</span>`).join('') + '<span class="cg-note">24 · 28 · 32 · 36 · 40 · 44 · 56 · 72 · 96</span>';
    $('#avTones').innerHTML = names.map((n) => `<span class="a-avatar a-avatar--40" data-tone="${toneOf(n)}" title="${esc(n)} → tông ${toneOf(n)}">${initials(n)}</span>`).join('') + '<span class="cg-note">tông lấy theo tên (toneOf) — cùng tên luôn cùng màu</span>';
    $('#loaderSlot').insertAdjacentHTML('afterbegin', M.loaderSvg());
    $('#loaderSlot .a-loader').style.cssText = 'width:28px;height:28px';
  }

  /* ---------------- Giao diện sáng/tối ---------------- */
  function syncThemeSeg(instant) {
    const t = document.documentElement.dataset.theme;
    const btn = $(`[data-theme-set="${t}"]`);
    $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    M.segment($('#themeSeg'), btn, { instant });
  }
  $('#themeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-set]');
    if (!b || b.dataset.themeSet === document.documentElement.dataset.theme) return;
    M.setTheme(b.dataset.themeSet, b);
    setTimeout(() => window.syncThemeIcon && window.syncThemeIcon(), 30);
  });
  new MutationObserver(() => { renderSwatches(); renderContrast(); syncThemeSeg(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------------- Nút ---------------- */
  function wireButtons() {
    M.morphButton($('#btnLoading'), 'loading');
    M.morphButton($('#btnSuccess'), 'success', { hold: true });
    $('#morphOk').addEventListener('click', async (e) => { const b = e.currentTarget; if (b.dataset.state) return; M.morphButton(b, 'loading'); await sleep(900); M.morphButton(b, 'success'); });
    $('#morphErr').addEventListener('click', async (e) => { const b = e.currentTarget; if (b.dataset.state) return; M.morphButton(b, 'loading'); await sleep(700); M.morphButton(b, 'error'); M.toast('Không gửi được. Kiểm tra kết nối rồi thử lại.', { tone: 'danger' }); });
    $$('[data-chip]').forEach((c) => c.addEventListener('click', () => c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'))));
  }

  /* ---------------- The Line ---------------- */
  function wireSelection() {
    const seg = $('[data-demo-seg]');
    M.segment(seg, $('[aria-selected="true"]', seg), { instant: true });
    seg.addEventListener('click', (e) => { const b = e.target.closest('.a-seg__btn'); if (!b) return; $$('.a-seg__btn', seg).forEach((x) => x.setAttribute('aria-selected', String(x === b))); M.segment(seg, b); });
    const tabs = $('[data-demo-tabs]');
    const tind = $('.a-indicator', tabs);
    M.indicator(tind, $('[aria-selected="true"]', tabs), { instant: true });
    tabs.addEventListener('click', (e) => { const b = e.target.closest('.a-tab'); if (!b) return; $$('.a-tab', tabs).forEach((x) => x.setAttribute('aria-selected', String(x === b))); M.indicator(tind, b); });
    const list = $('#demoList');
    const lind = $('.a-indicator', list);
    M.indicator(lind, $('[aria-selected="true"]', list), { instant: true });
    list.addEventListener('click', (e) => {
      const r = e.target.closest('.a-row');
      if (!r) return;
      $$('.a-row', list).forEach((x) => { x.setAttribute('aria-selected', String(x === r)); x.tabIndex = x === r ? 0 : -1; });
      r.classList.remove('a-row--unread');
      const bd = $('.a-badge', r);
      if (bd) M.animate(bd, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.4)', opacity: 0 }], { duration: 180, fill: 'forwards' }).finished.then(() => bd.remove());
      M.indicator(lind, r);
    });
    $('#notifDemo').addEventListener('click', (e) => { const n = e.target.closest('.notif'); if (!n) return; e.preventDefault(); n.classList.toggle('is-unread'); });
  }

  /* ---------------- Nổi, hộp thoại, toast ---------------- */
  function wireOverlays() {
    $('#menuBtn').addEventListener('click', (e) => openPopover($('#demoMenu'), e.currentTarget, 'bottom'));
    $('#demoMenu').addEventListener('click', (e) => { if (e.target.closest('.a-menu__item')) { closePopover(); M.toast('Đã chọn: ' + e.target.closest('.a-menu__item').textContent.trim()); } });
    const dlg = $('#dlg');
    const scrim = $('#dlgScrim');
    const close = () => M.closeDialog(dlg, scrim);
    $('#dlgBtn').addEventListener('click', (e) => M.openDialog(dlg, scrim, e.currentTarget));
    dlg.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    scrim.addEventListener('click', close);
    $('#dlgSave').addEventListener('click', async (e) => { const b = e.currentTarget; M.morphButton(b, 'loading'); await sleep(700); M.morphButton(b, 'success', { hold: true }); await sleep(450); await close(); M.morphButton(b, 'idle'); M.toast('Đã đổi tên CV.', { tone: 'success' }); });
    const cf = $('#cf');
    const cfScrim = $('#cfScrim');
    const cfClose = () => M.closeDialog(cf, cfScrim);
    $('#confirmBtn').addEventListener('click', (e) => { $('#cfIn').value = ''; $('#cfGo').disabled = true; M.openDialog(cf, cfScrim, e.currentTarget); setTimeout(() => $('#cfIn').focus(), 40); });
    $('#cfIn').addEventListener('input', (e) => { $('#cfGo').disabled = e.target.value.trim().toUpperCase() !== 'XOÁ'; });
    cf.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) cfClose(); });
    cfScrim.addEventListener('click', cfClose);
    $('#cfGo').addEventListener('click', async (e) => { const b = e.currentTarget; M.morphButton(b, 'loading'); await sleep(900); M.morphButton(b, 'idle'); await cfClose(); M.toast('Đây là bản thiết kế — không có gì bị xoá.'); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!cf.hidden) { e.preventDefault(); cfClose(); } else if (!dlg.hidden) { e.preventDefault(); close(); }
    });
    $('#toastOk').addEventListener('click', () => M.toast('Đã lưu thay đổi.', { tone: 'success' }));
    $('#toastErr').addEventListener('click', () => M.toast('Không tải được dữ liệu. Thử lại sau ít phút.', { tone: 'danger', action: { label: 'Thử lại', onClick() {} } }));
    $('#toastUndo').addEventListener('click', () => M.toast('Đã xoá bình luận.', { action: { label: 'Hoàn tác', onClick: () => M.toast('Đã khôi phục bình luận.', { tone: 'success' }) } }));
    $('#retryBtn').addEventListener('click', async (e) => { const b = e.currentTarget; M.morphButton(b, 'loading'); await sleep(900); M.morphButton(b, 'error'); });
  }

  /* ---------------- Thẻ demo chuyển động ---------------- */
  const card = (name, fn, stage, meta, opts = {}) => ({ name, fn, stage, meta, ...opts });
  const MOTION = [
    card('flip()', 'flip', '<div class="cg-chips" data-s>' + ['React', 'Remote', 'TP.HCM', 'Junior', 'Fintech', 'Part-time'].map((x) => `<span class="a-chip">${x}</span>`).join('') + '</div>',
      '<b>Khi:</b> lọc, sắp xếp, thêm/bớt phần tử trong danh sách. <b>Thông số:</b> transform từ vị trí cũ → mới, 300ms, ease-out; phần tử mới: fade + scale .97, 220ms.',
      { run: (s) => { const box = $('[data-s]', s); const kids = $$('.a-chip', box); kids.sort(() => Math.random() - 0.5); M.flip(box, () => kids.forEach((k) => box.append(k))); } }),
    card('removeFrom()', 'removeFrom', '<div class="cg-mini" data-s><div class="cg-mini__row">Frontend Developer</div><div class="cg-mini__row">QA Engineer</div><div class="cg-mini__row">UI/UX Designer</div></div>',
      '<b>Khi:</b> xoá một mục. <b>Thông số:</b> mục bị xoá co + mờ 160ms (ease-in), các mục còn lại dồn lên bằng FLIP 300ms.',
      { run: async (s) => { const box = $('[data-s]', s); const rows = $$('.cg-mini__row', box); if (rows.length < 3) return; const mid = rows[1]; await M.removeFrom(box, mid); await sleep(700); M.flip(box, () => rows[0].after(mid)); mid.getAnimations().forEach((a) => a.cancel()); } }),
    card('rollNumber()', 'rollNumber', '<span class="cg-big a-num" data-s>128</span>',
      '<b>Khi:</b> số đếm thay đổi (kết quả, lượt thích, ký tự). <b>Thông số:</b> mỗi chữ số đổi lăn dọc, 360ms spring, lệch 40ms/chữ số; tăng lăn lên, giảm lăn xuống.',
      { run: (s) => { const el = $('[data-s]', s); const cur = +(el.dataset.value || el.textContent); M.rollNumber(el, Math.max(0, cur + Math.round(Math.random() * 40 - 16))); } }),
    card('morphButton()', 'morphButton', '<button class="a-btn a-btn--primary" type="button" data-s>Gửi hồ sơ</button>',
      '<b>Khi:</b> nút gửi dữ liệu lên máy chủ. <b>Thông số:</b> idle → loading (nhãn trượt lên 200ms, nét quỹ đạo chạy) → success (✓ tự vẽ 480ms, giữ 1.4s) hoặc error (rung 320ms rồi về idle). Chiều rộng nút không đổi.',
      { run: async (s) => { const b = $('[data-s]', s); M.morphButton(b, 'loading'); await sleep(900); M.morphButton(b, 'success'); } }),
    card('shake()', 'shake', '<div class="a-field" style="width:100%"><input class="a-input" value="khoa@" aria-invalid="true" data-s aria-label="Email"><span class="a-error"><i data-lucide="alert-circle"></i>Email thiếu tên miền</span></div>',
      '<b>Khi:</b> gửi form lỗi, thao tác không hợp lệ, vượt giới hạn. <b>Thông số:</b> dao động ngang ±5px tắt dần, 320ms. Không dùng cho thông báo thường.',
      { run: (s) => M.shake($('[data-s]', s)) }),
    card('pulse()', 'pulse', '<span class="cg-tile" data-s><i data-lucide="file-check"></i></span>',
      '<b>Khi:</b> một đích vừa nhận thứ gì đó (rail "Ứng tuyển" sau flyTo, nút Lưu). <b>Thông số:</b> scale 1 → 1.14 → 1, 380ms spring.',
      { run: (s) => M.pulse($('[data-s]', s)) }),
    card('indicator() — The Line', 'indicator', '<div class="a-tabs" role="tablist" style="width:100%" data-s><span class="a-indicator" data-axis="x" data-inset="10"></span><button class="a-tab" type="button" role="tab" aria-selected="true">Tất cả</button><button class="a-tab" type="button" role="tab" aria-selected="false">Chưa đọc</button><button class="a-tab" type="button" role="tab" aria-selected="false">Nhắc tên</button></div>',
      '<b>Khi:</b> mọi lựa chọn "đang ở đâu": rail, tab, danh sách, mục lục. <b>Thông số:</b> một phần tử duy nhất, transform translate + scale, 320ms spring. Lần đầu đặt tức thì, không trượt.',
      { init: (s) => { const t = $('[data-s]', s); M.indicator($('.a-indicator', t), $('[aria-selected="true"]', t), { instant: true }); t.addEventListener('click', (e) => { const b = e.target.closest('.a-tab'); if (!b) return; $$('.a-tab', t).forEach((x) => x.setAttribute('aria-selected', String(x === b))); M.indicator($('.a-indicator', t), b); }); },
        run: (s) => { const t = $('[data-s]', s); const tabs = $$('.a-tab', t); const i = tabs.findIndex((x) => x.getAttribute('aria-selected') === 'true'); tabs[(i + 1) % tabs.length].click(); } }),
    card('expand() / collapse()', 'expand', '<div style="width:100%"><button class="a-btn a-btn--ghost a-btn--sm" type="button" data-t><i data-lucide="chevron-down"></i>Xem 2 câu trả lời</button><div class="a-collapse" data-open="false" data-s><div class="a-collapse__inner"><div class="cg-mini" style="padding-top:6px"><div class="cg-mini__row">Có nha, tuần sau bên mình mở vị trí mới.</div><div class="cg-mini__row">Cảm ơn anh!</div></div></div></div></div>',
      '<b>Khi:</b> mở rộng tại chỗ (câu trả lời, chi tiết, bộ lọc nâng cao). <b>Thông số:</b> grid-template-rows 0fr → 1fr 320ms ease-out + mờ dần nội dung 200ms. Không đo chiều cao bằng JS.',
      { init: (s) => $('[data-t]', s).addEventListener('click', () => M.toggle($('[data-s]', s))), run: (s) => M.toggle($('[data-s]', s)) }),
    card('stagger()', 'stagger', '<div class="cg-mini" data-s>' + ['Kế toán tổng hợp', 'Chuyên viên Marketing', 'Backend Developer (.NET)', 'Thực tập sinh Data'].map((x) => `<div class="cg-mini__row">${x}</div>`).join('') + '</div>',
      '<b>Khi:</b> CHỈ khi một danh sách vừa tải xong / vừa đổi hẳn. <b>Thông số:</b> fade + nhích 6px, 240ms, lệch 30ms/mục, tối đa 6 mục. Không dùng khi cuộn thường.',
      { run: (s) => M.stagger($$('.cg-mini__row', s)) }),
    card('pop() / unpop()', 'pop', '<button class="a-btn a-btn--secondary a-btn--sm" type="button" data-t>Mở</button><div class="a-pop cg-popdemo" data-s hidden><button class="a-menu__item" type="button"><i data-lucide="pencil"></i>Sửa</button><button class="a-menu__item" type="button"><i data-lucide="link"></i>Sao chép liên kết</button></div>',
      '<b>Khi:</b> popover, menu, thẻ hover. <b>Thông số:</b> mở: scale .94 → 1 + mờ, 180ms ease-out, transform-origin = tâm nút đã bấm; đóng: 110ms ease-in.',
      { init: (s) => { const p = $('[data-s]', s); p.style.position = 'absolute'; $('[data-t]', s).addEventListener('click', (e) => (p.hidden ? M.pop(p, e.currentTarget) : M.unpop(p))); },
        run: async (s) => { const p = $('[data-s]', s); const t = $('[data-t]', s); if (!p.hidden) { await M.unpop(p); await sleep(150); } M.pop(p, t); } }),
    card('openDialog()', 'openDialog', '<button class="a-btn a-btn--primary a-btn--sm" type="button" data-t>Đổi tên CV</button>',
      '<b>Khi:</b> mọi hộp thoại. <b>Thông số:</b> desktop: dịch 55% quãng từ nút gốc + scale .86 → 1, 280ms; đóng thu về nút, 180ms. Mobile: trượt từ đáy. Focus vào ô đầu tiên, Esc đóng, trả focus về nút.',
      { run: (s) => M.openDialog($('#dlg'), $('#dlgScrim'), $('[data-t]', s)), init: (s) => $('[data-t]', s).addEventListener('click', (e) => M.openDialog($('#dlg'), $('#dlgScrim'), e.currentTarget)) }),
    card('flyTo()', 'flyTo', '<span class="cg-tile" data-s>TN</span>',
      '<b>Khi:</b> hành động đưa một thứ đi nơi khác: ứng tuyển → mục "Ứng tuyển" trên rail, lưu → "Đã lưu". <b>Thông số:</b> bản sao bay theo cung 620ms, nhỏ dần tới 22%, đích pulse khi tới.',
      { run: (s) => M.flyTo($('[data-s]', s), $('#railApplications svg') || $('#railApplications')) }),
    card('highlight()', 'highlight', '<p style="padding:8px 10px;border-radius:8px;font-size:13px;line-height:1.5" data-s>Tin nhắn được trích dẫn: "Văn phòng bên mình ở tầng 12".</p>',
      '<b>Khi:</b> cuộn/nhảy tới một mục (trả lời được trích dẫn, bình luận mới, kết quả tìm). <b>Thông số:</b> nền brand-soft-2 hiện rồi tắt dần, 1100ms.',
      { run: (s) => M.highlight($('[data-s]', s)) }),
    card('toast()', 'toast', '<span class="cg-note">Góc dưới trái (desktop) · trên tab bar (mobile)</span>',
      '<b>Khi:</b> xác nhận việc vừa làm, lỗi không chặn, Hoàn tác. <b>Thông số:</b> vào 320ms spring, tự đóng 4s (6s nếu có nút), dừng đếm khi rê chuột, vuốt ngang để đóng.',
      { run: () => M.toast('Đã lưu bài viết.', { tone: 'success', action: { label: 'Xem', onClick() {} } }) }),
    card('setTheme()', 'setTheme', '<button class="a-btn a-btn--secondary a-btn--sm" type="button" data-t><i data-lucide="moon"></i>Đổi giao diện</button>',
      '<b>Khi:</b> đổi sáng/tối. <b>Thông số:</b> View Transition, giao diện mới lộ ra theo vòng tròn lan từ nút, 520ms. Trình duyệt không hỗ trợ → đổi ngay.',
      { run: (s) => { const b = $('[data-t]', s); M.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', b); setTimeout(() => window.syncThemeIcon && window.syncThemeIcon(), 30); }, init: (s) => $('[data-t]', s).addEventListener('click', () => $('[data-run="setTheme"]').click()) }),
    card('openLightbox()', 'lightbox', '<button type="button" style="padding:0;border:0;border-radius:10px;overflow:hidden;cursor:zoom-in;background:none" data-t aria-label="Xem ảnh lớn"><img alt="Ảnh văn phòng" style="width:120px;height:90px;object-fit:cover" data-s></button>',
      '<b>Khi:</b> xem ảnh (chat, bài viết). <b>Thông số:</b> ảnh phóng ra từ đúng thumbnail 360ms và thu về đúng chỗ; nhiều ảnh: ‹ › / phím ← → / vuốt.',
      { init: (s) => { $('[data-s]', s).src = sceneThumb(); $('[data-t]', s).addEventListener('click', () => openLightbox([$('[data-s]', s)], 0, 'Văn phòng Quận 1')); }, run: (s) => openLightbox([$('[data-s]', s)], 0, 'Văn phòng Quận 1') }),
    card('sortable()', 'sortable', '<div class="cg-sort" data-s>' + [1, 2, 3, 4].map((n) => `<span class="a-drag" tabindex="0" aria-label="Mục ${n}. Kéo hoặc Alt + ← → để đổi chỗ">${n}</span>`).join('') + '</div>',
      '<b>Khi:</b> đổi thứ tự (ảnh trong bài, mục CV, cột pipeline). <b>Thông số:</b> mục kéo bám con trỏ + bóng; mục khác FLIP 220ms; thả ra spring 340ms. Bàn phím: Alt + mũi tên.',
      { init: (s) => M.sortable($('[data-s]', s), { selector: '.a-drag', axis: 'x', onChange: () => M.toast('Thứ tự mới: ' + $$('.a-drag', s).map((x) => x.textContent).join(' · ')) }),
        run: (s) => { const box = $('[data-s]', s); const kids = $$('.a-drag', box); M.flip(box, () => kids.reverse().forEach((k) => box.append(k))); } })
  ];
  function sceneThumb() {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#DCE4EE'/><g fill='#A9B8CA'><rect x='20' y='150' width='50' height='90'/><rect x='80' y='120' width='40' height='120'/><rect x='130' y='160' width='60' height='80'/><rect x='205' y='105' width='45' height='135'/><rect x='262' y='140' width='55' height='100'/><rect x='328' y='125' width='50' height='115'/></g><rect y='236' width='400' height='64' fill='#C8B79E'/><rect x='40' y='214' width='190' height='12' rx='3' fill='#7E6247'/><rect x='300' y='176' width='26' height='48' rx='8' fill='#6F8F6B'/></svg>";
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  const PATTERNS = [
    card('Thích lạc quan + lỗi', 'like', '<div style="display:grid;justify-items:center;gap:10px"><button class="cg-like" type="button" aria-pressed="false" data-s><i data-lucide="heart"></i><span class="a-num" data-n>23</span></button><label class="a-check-row" style="font-size:12px"><input class="a-check-input" type="checkbox" data-fail>Mô phỏng mất mạng</label></div>',
      '<b>Mẫu:</b> đổi giao diện NGAY (tim đỏ + nảy + số lăn), gọi API sau. Lỗi → trả về trạng thái cũ, rung nút, toast lỗi. Không khoá nút khi đang gọi.',
      { init: (s) => {
        const b = $('[data-s]', s);
        b.addEventListener('click', async () => {
          const on = b.getAttribute('aria-pressed') !== 'true';
          const n = $('[data-n]', b);
          const cur = +(n.dataset.value || n.textContent);
          b.setAttribute('aria-pressed', String(on));
          M.rollNumber(n, cur + (on ? 1 : -1));
          M.animate($('svg', b), on ? [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }] : [{ transform: 'scale(.8)' }, { transform: 'scale(1)' }], { duration: on ? 440 : 220, easing: on ? M.SPRING : M.EASE_OUT });
          await sleep(500);
          if ($('[data-fail]', s).checked) { b.setAttribute('aria-pressed', String(!on)); M.rollNumber(n, cur); M.shake(b); M.toast('Chưa thích được vì mất kết nối.', { tone: 'danger' }); }
        });
      }, run: (s) => $('[data-s]', s).click() }),
    card('Nhấn đúp để thích', 'dbl', '<div class="cg-heart" data-s>Nhấn đúp vào đây</div>',
      '<b>Mẫu (Instagram):</b> nhấn đúp lên ảnh → tim trắng lớn nảy tại điểm chạm rồi bay lên; nếu chưa thích thì thích luôn, đã thích thì chỉ nảy tim (không bỏ thích).',
      { init: (s) => {
        const box = $('[data-s]', s);
        let last = 0;
        const burst = (x, y) => {
          const r = box.getBoundingClientRect();
          const h = document.createElement('span');
          h.className = 'bigheart';
          h.innerHTML = HEART;
          h.style.left = (x - r.left) + 'px';
          h.style.top = (y - r.top) + 'px';
          box.append(h);
          h.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.18)', opacity: 1, offset: .22 }, { transform: 'scale(.94)', opacity: 1, offset: .36 }, { transform: 'scale(1)', opacity: 1, offset: .7 }, { transform: 'translateY(-36px) scale(.9)', opacity: 0 }], { duration: M.reduced() ? 1 : 1000, easing: 'ease-out' }).finished.then(() => h.remove());
        };
        box.addEventListener('pointerup', (e) => { if (e.timeStamp - last < 320) { burst(e.clientX, e.clientY); last = 0; } else last = e.timeStamp; });
        box._burst = () => { const r = box.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2); };
      }, run: (s) => $('[data-s]', s)._burst() }),
    card('Xoá + Hoàn tác', 'undo', '<div class="cg-mini" data-s><div class="cg-mini__row">Lời mời của Lý Minh Tuấn<button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-x aria-label="Xoá"><i data-lucide="x"></i></button></div><div class="cg-mini__row">Lời mời của Ngô Tường Vy<button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-x aria-label="Xoá"><i data-lucide="x"></i></button></div></div>',
      '<b>Mẫu:</b> xoá ngay khỏi giao diện (removeFrom), toast "Đã xoá… Hoàn tác" 6 giây; CHỈ gọi API xoá khi hết giờ mà không bấm Hoàn tác. Hoàn tác → chèn lại đúng vị trí + highlight.',
      { init: (s) => {
        const box = $('[data-s]', s);
        box.addEventListener('click', async (e) => {
          const x = e.target.closest('[data-x]');
          if (!x) return;
          const row = x.closest('.cg-mini__row');
          const next = row.nextElementSibling;
          await M.removeFrom(box, row);
          row.getAnimations().forEach((a) => a.cancel());
          M.toast('Đã xoá lời mời.', { action: { label: 'Hoàn tác', onClick: () => { M.flip(box, () => (next && next.isConnected ? next.before(row) : box.append(row))); M.highlight(row); } } });
        });
      }, run: (s) => { const x = $('[data-x]', s); if (x) x.click(); } }),
    card('Chọn nhiều người', 'pick', '<div class="cg-pick" data-s>' + ['Lê Thu Hà', 'Phạm Gia Huy', 'Đỗ Khánh Linh', 'Vũ Hoàng Nam'].map((n) => `<button type="button" aria-pressed="false" aria-label="${n}"><span class="a-avatar a-avatar--44" data-tone="${toneOf(n)}">${initials(n)}</span><span class="cg-check" aria-hidden="true"><i data-lucide="check"></i></span></button>`).join('') + '</div>',
      '<b>Mẫu:</b> gửi cho bạn bè, thêm người vào nhóm. Chọn → viền brand + dấu ✓ nảy (spring). Nút gửi đổi nhãn theo số người ("Gửi riêng cho 2 người").',
      { init: (s) => $('[data-s]', s).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); M.animate($('.a-avatar', b), [{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 300, easing: M.SPRING }); }),
        run: (s) => $$('button', s)[Math.floor(Math.random() * 4)].click() }),
    card('Bình chọn', 'poll', '<div class="cg-poll" data-s>' + [['Có người hướng dẫn', 48], ['Dự án thật', 23], ['Phụ cấp tốt', 17], ['Công ty lớn', 12]].map(([l, p], i) => `<button type="button" data-p="${p}" data-i="${i}"><i></i><span>${l}</span><span></span></button>`).join('') + '</div>',
      '<b>Mẫu:</b> bấm một lựa chọn → mọi thanh chạy từ 0 tới % thật (640ms, lệch 50ms), % lăn số, lựa chọn của mình có nền brand nhạt + ✓. Có "Rút lại phiếu".',
      { init: (s) => $('[data-s]', s).addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) votePoll(s, +b.dataset.i); }), run: (s) => votePoll(s, Math.floor(Math.random() * 4)) }),
    card('Kéo để làm mới', 'ptr', '<div class="cg-ptr" data-s><span data-l></span><input type="range" min="0" max="100" value="30" aria-label="Quãng kéo"><button class="a-btn a-btn--ghost a-btn--sm" type="button" data-go>Thả tay</button></div>',
      '<b>Mẫu (mobile, chỉ ở đầu trang):</b> kéo xuống → nét quỹ đạo của logo vẽ dần theo quãng kéo; đủ 64px thì thả để làm mới (nét chạy vòng), chưa đủ thì bật về.',
      { init: (s) => {
        const box = $('[data-s]', s);
        $('[data-l]', box).innerHTML = M.loaderSvg();
        const dash = $('.a-loader__dash', box);
        const inp = $('input', box);
        const draw = () => { dash.style.strokeDashoffset = String(100 - +inp.value); };
        inp.addEventListener('input', draw);
        draw();
        $('[data-go]', box).addEventListener('click', async () => {
          if (+inp.value < 64) { inp.value = 0; draw(); M.toast('Kéo chưa đủ — bật về.'); return; }
          box.classList.add('is-refreshing');
          dash.style.strokeDashoffset = '';
          await sleep(1200);
          box.classList.remove('is-refreshing');
          inp.value = 0;
          draw();
          M.toast('Đã có 2 bài mới.', { tone: 'success' });
        });
      }, run: (s) => { const inp = $('input', s); inp.value = 100; inp.dispatchEvent(new Event('input')); $('[data-go]', s).click(); } })
  ];
  function votePoll(s, i) {
    $$('button', s).forEach((b, k) => {
      const p = b.dataset.p + '%';
      const bar = $('i', b);
      const pct = $('span:last-child', b);
      b.classList.toggle('is-mine', k === i);
      bar.style.width = p;
      M.animate(bar, [{ width: '0%' }, { width: p }], { duration: 640, delay: k * 50, easing: M.EASE_OUT });
      pct.textContent = '0%';
      pct.dataset.value = '0%';
      setTimeout(() => M.rollNumber(pct, p), k * 50);
    });
  }

  function renderCards(host, list) {
    host.innerHTML = list.map((c) => `<article class="cg-m" data-card="${c.fn}">
      <div class="cg-m__head"><span class="cg-m__name">${c.name.includes('()') ? `<code>${esc(c.name)}</code>` : esc(c.name)}</span><button class="a-btn a-btn--ghost a-btn--sm" type="button" data-run="${c.fn}"><i data-lucide="rotate-ccw"></i>Chạy lại</button></div>
      <div class="cg-m__stage">${c.stage}</div>
      <p class="cg-m__meta">${c.meta}</p>
    </article>`).join('');
    list.forEach((c) => { const s = $(`[data-card="${c.fn}"] .cg-m__stage`, host); if (c.init) c.init(s); });
    host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-run]');
      if (!b) return;
      const c = list.find((x) => x.fn === b.dataset.run);
      if (c && c.run) c.run($(`[data-card="${c.fn}"] .cg-m__stage`, host));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderSwatches();
    renderContrast();
    renderStatic();
    renderCards($('#motionGrid'), MOTION);
    renderCards($('#patternGrid'), PATTERNS);
    renderIcons();
    wireButtons();
    wireSelection();
    wireOverlays();
    requestAnimationFrame(() => syncThemeSeg(true));
  });
})();
