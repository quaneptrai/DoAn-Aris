/* =============================================================================
   ARIS LINE — Trang Việc làm: MÔ PHỎNG TƯƠNG TÁC (bản thiết kế V7)
   App thật:
     - Lọc/sắp xếp/tải thêm: GET /Jobs/GetJobs?skip&take&q&location&category&workMode&sort
       (trả HTML partial _JobCardPartial hoặc JSON {success:false} khi hết/không có)
     - Xem trước: GET /Jobs/Details/{id} (chỉ đọc) → trích vùng [data-job-detail]
     - Ứng tuyển: GET /JobApplications/GetApplyModal?jobId= + POST /JobApplications/Apply
   Dữ liệu dưới đây là DỮ LIỆU MẪU.
   ============================================================================= */
(function () {
  'use strict';
  const M = window.ArisMotion;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isMobile = () => matchMedia('(max-width: 767px)').matches;
  const params = new URLSearchParams(location.search);
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

  const list = $('#jobList');
  const ind = $('.a-indicator', list);

  /* ---------------- Dữ liệu mẫu ---------------- */
  const J = (id, title, company, city, district, mode, cat, salary, min, posted, deadline) => ({ id, title, company, city, district, mode, cat, salary, min, posted, deadline });
  const JOBS = [
    J(1, 'Frontend Developer (React)', 'TechNova', 'TP.HCM', 'Quận 1', 'Hybrid', 'Công nghệ thông tin', '25–35 triệu', 25, 0, 61),
    J(2, 'Chuyên viên Marketing', 'GreenLeaf Foods', 'TP.HCM', 'Tân Bình', 'Toàn thời gian', 'Marketing', '12–18 triệu', 12, 1, 30),
    J(3, 'Thực tập sinh Data Analyst', 'Sao Mai Retail', 'Hà Nội', 'Cầu Giấy', 'Thực tập', 'Dữ liệu', '5 triệu', 5, 2, 20),
    J(4, 'Backend Developer (.NET)', 'TechNova', 'TP.HCM', 'Quận 1', 'Toàn thời gian', 'Công nghệ thông tin', '30–45 triệu', 30, 3, 45),
    J(5, 'UI/UX Designer', 'Lumen Studio', 'Đà Nẵng', 'Hải Châu', 'Remote', 'Thiết kế', '18–28 triệu', 18, 4, 25),
    J(6, 'Nhân viên Kinh doanh B2B', 'GreenLeaf Foods', 'Hà Nội', 'Đống Đa', 'Toàn thời gian', 'Kinh doanh', '10–15 triệu + thưởng', 10, 5, 12),
    J(7, 'QA Engineer', 'Nexa Pay', 'TP.HCM', 'Quận 3', 'Hybrid', 'Công nghệ thông tin', '20–30 triệu', 20, 6, 40),
    J(8, 'Content Writer (bán thời gian)', 'Lumen Studio', 'Đà Nẵng', 'Hải Châu', 'Bán thời gian', 'Marketing', '6–9 triệu', 6, 8, 15),
    J(9, 'Kế toán tổng hợp', 'Sao Mai Retail', 'Hà Nội', 'Cầu Giấy', 'Toàn thời gian', 'Tài chính', '14–18 triệu', 14, 9, 9),
    J(10, 'Mobile Developer (Flutter)', 'Nexa Pay', 'TP.HCM', 'Quận 3', 'Toàn thời gian', 'Công nghệ thông tin', 'Thoả thuận', 0, 11, 50),
    J(11, 'Chuyên viên Tuyển dụng', 'TechNova', 'TP.HCM', 'Quận 1', 'Toàn thời gian', 'Nhân sự', '15–20 triệu', 15, 12, 18),
    J(12, 'Thực tập sinh Frontend', 'Lumen Studio', 'Đà Nẵng', 'Hải Châu', 'Thực tập', 'Công nghệ thông tin', '4–6 triệu', 4, 14, 35)
  ];
  const COMPANY = {
    'TechNova': { size: '200–500 nhân sự', open: 12, about: 'Công ty sản phẩm SaaS cho bán lẻ, văn phòng tại Quận 1.' },
    'GreenLeaf Foods': { size: '500–1.000 nhân sự', open: 3, about: 'Chuỗi thực phẩm sạch với 40 cửa hàng.' },
    'Sao Mai Retail': { size: '1.000+ nhân sự', open: 5, about: 'Hệ thống bán lẻ tiện lợi miền Bắc.' },
    'Lumen Studio': { size: '20–50 nhân sự', open: 4, about: 'Studio thiết kế sản phẩm số, làm việc từ xa.' },
    'Nexa Pay': { size: '100–200 nhân sự', open: 6, about: 'Ví điện tử và cổng thanh toán cho doanh nghiệp nhỏ.' }
  };
  const TOTAL = 128;

  const OPTIONS = {
    location: { label: 'Địa điểm', multi: true, values: ['TP.HCM', 'Hà Nội', 'Đà Nẵng'], of: (j) => j.city },
    category: { label: 'Ngành nghề', multi: true, values: ['Công nghệ thông tin', 'Marketing', 'Thiết kế', 'Dữ liệu', 'Kinh doanh', 'Tài chính', 'Nhân sự'], of: (j) => j.cat },
    mode: { label: 'Hình thức', multi: true, values: ['Toàn thời gian', 'Hybrid', 'Remote', 'Bán thời gian', 'Thực tập'], of: (j) => j.mode },
    sort: { label: 'Sắp xếp', multi: false, values: ['Mới nhất', 'Lương cao nhất', 'Hạn nộp gần nhất'] }
  };
  const state = { q: '', location: [], category: [], mode: [], sort: 'Mới nhất', shown: 8, selected: null, applied: new Set() };

  const toneOf = window.toneOf;
  const logo = (company, size = '') => `<span class="a-logo${size ? ' a-logo--' + size : ''}" data-tone="${toneOf(company)}" aria-hidden="true">${window.orgInitials(company)}</span>`;
  const postedText = (d) => (d === 0 ? 'Hôm nay' : d === 1 ? 'Hôm qua' : `${d} ngày trước`);

  /* ---------------- Lọc + sắp xếp ---------------- */
  function matches(j, except) {
    if (state.q && !norm(`${j.title} ${j.company} ${j.cat}`).includes(norm(state.q))) return false;
    for (const k of ['location', 'category', 'mode']) {
      if (k === except || !state[k].length) continue;
      if (!state[k].includes(OPTIONS[k].of(j))) return false;
    }
    return true;
  }
  function results() {
    const r = JOBS.filter((j) => matches(j));
    if (state.sort === 'Lương cao nhất') r.sort((a, b) => b.min - a.min);
    else if (state.sort === 'Hạn nộp gần nhất') r.sort((a, b) => a.deadline - b.deadline);
    else r.sort((a, b) => a.posted - b.posted);
    return r;
  }

  function rowHtml(j) {
    return `<div class="a-row job-row${state.applied.has(j.id) ? ' is-applied' : ''}" role="option" tabindex="-1" aria-selected="${state.selected === j.id}" id="job-${j.id}" data-id="${j.id}">
      ${logo(j.company)}
      <div class="a-row__main">
        <div class="job-row__title">${esc(j.title)}</div>
        <div class="job-row__company">${esc(j.company)}</div>
        <div class="job-row__msal">${esc(j.salary)}${j.posted <= 1 ? '<span class="a-tag a-tag--new">Mới</span>' : ''}</div>
        <div class="job-row__meta"><span>${esc(j.city)}</span><span>${esc(j.mode)}</span><span>${postedText(j.posted)}</span></div>
      </div>
      <div class="job-row__side">
        <span class="job-row__salary">${esc(j.salary)}</span>
        ${j.posted <= 1 ? '<span class="a-tag a-tag--new">Mới</span>' : ''}
      </div>
    </div>`;
  }
  function makeRow(j) { const t = document.createElement('div'); t.innerHTML = rowHtml(j); return t.firstElementChild; }

  function render(opts = {}) {
    const r = results();
    const visible = r.slice(0, state.shown);
    M.flip(list, () => {
      $$(':scope > .a-empty, :scope > .job-skel', list).forEach((el) => el.remove());
      const keep = new Set(visible.map((j) => 'job-' + j.id));
      $$('.job-row', list).forEach((el) => { if (!keep.has(el.id)) el.remove(); });
      visible.forEach((j) => {
        const el = $('#job-' + j.id);
        if (el) { const f = makeRow(j); el.className = f.className; el.setAttribute('aria-selected', f.getAttribute('aria-selected')); list.append(el); }
        else list.append(makeRow(j));
      });
      if (!r.length) list.insertAdjacentHTML('beforeend', emptyHtml());
    }, { selector: '.job-row' });
    renderIcons();
    M.rollNumber($('#resultCount'), r.length);
    const any = state.q || state.location.length || state.category.length || state.mode.length;
    $('#clearFilters').hidden = !any;
    syncChips();
    if (!visible.some((j) => j.id === state.selected)) {
      if (visible.length && !isMobile()) select(visible[0].id, { quiet: true });
      else if (!visible.length) { state.selected = null; M.indicator(ind, null); showDetailEmpty(true); }
    } else placeInd(true);
    if (opts.syncUrl !== false) syncUrl();
  }
  function emptyHtml() {
    const active = [];
    ['location', 'category', 'mode'].forEach((k) => state[k].forEach((v) => active.push([k, v])));
    return `<div class="a-empty">
      <i data-lucide="search-x"></i>
      <div class="a-empty__title">Không có việc nào khớp</div>
      <div class="a-empty__text">${state.q && active.length ? `Từ khoá “${esc(state.q)}” kết hợp các bộ lọc bên dưới không cho kết quả nào. Bỏ bớt một điều kiện:`
        : state.q ? `Từ khoá “${esc(state.q)}” không cho kết quả nào. Thử từ khoá ngắn hơn hoặc bỏ nó:`
        : 'Các bộ lọc bên dưới không cho kết quả nào. Bỏ bớt một điều kiện:'}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px">
        ${state.q ? `<button class="a-chip" type="button" data-drop="q">“${esc(state.q)}” <i data-lucide="x"></i></button>` : ''}
        ${active.map(([k, v]) => `<button class="a-chip" type="button" data-drop="${k}" data-value="${esc(v)}">${esc(v)} <i data-lucide="x"></i></button>`).join('')}
      </div>
    </div>`;
  }
  list.addEventListener('click', (e) => {
    const drop = e.target.closest('[data-drop]');
    if (drop) {
      const k = drop.dataset.drop;
      if (k === 'q') { state.q = ''; $('#jobSearch').value = ''; } else state[k] = state[k].filter((v) => v !== drop.dataset.value);
      render();
      return;
    }
    const row = e.target.closest('.job-row');
    if (row) select(+row.dataset.id, { open: true });
  });

  function syncChips() {
    const sort = $('#sortBtn');
    $('span', sort).textContent = state.sort;
    sort.setAttribute('aria-label', 'Sắp xếp: ' + state.sort);
    $$('#filters .a-chip').forEach((chip) => {
      const k = chip.dataset.filter;
      const label = $('span', chip);
      const v = state[k];
      label.textContent = v.length ? (v.length === 1 ? v[0] : `${v[0]} +${v.length - 1}`) : OPTIONS[k].label;
      chip.setAttribute('aria-pressed', String(!!v.length));
    });
  }
  function syncUrl() {
    const u = new URLSearchParams();
    if (state.q) u.set('q', state.q);
    ['location', 'category', 'mode'].forEach((k) => state[k].length && u.set(k, state[k].join(',')));
    if (state.sort !== 'Mới nhất') u.set('sort', state.sort);
    if (state.selected) u.set('job', state.selected);
    history.replaceState(null, '', '?' + u.toString());
  }

  /* ---------------- Popover bộ lọc: đổi là ra kết quả ngay ---------------- */
  $('#filters').addEventListener('click', (e) => { const chip = e.target.closest('.a-chip'); if (chip) openFilter(chip, 'bottom'); });
  $('#sortBtn').addEventListener('click', (e) => openFilter(e.currentTarget, 'bottom-end'));
  function openFilter(chip, side) {
    const k = chip.dataset.filter;
    const opt = OPTIONS[k];
    const pop = $('#filterPop');
    const count = (v) => JOBS.filter((j) => matches(j, k) && opt.of(j) === v).length;
    pop.innerHTML = `
      <div class="a-menu__label">${opt.label}</div>
      <div class="filter-pop__list">
        ${opt.values.map((v) => `<label class="a-check-row">
          <input class="a-check-input" type="${opt.multi ? 'checkbox' : 'radio'}" name="f-${k}" value="${esc(v)}" ${(opt.multi ? state[k].includes(v) : state[k] === v) ? 'checked' : ''}>
          <span style="flex:1">${esc(v)}</span>${opt.multi ? `<span class="a-row__meta">${count(v)}</span>` : ''}</label>`).join('')}
      </div>
      ${opt.multi ? '<div class="filter-pop__foot"><button class="a-btn a-btn--ghost a-btn--sm" type="button" data-reset>Bỏ chọn</button><button class="a-btn a-btn--secondary a-btn--sm" type="button" data-done>Xong</button></div>' : ''}`;
    pop.onchange = (ev) => {
      const inp = ev.target;
      if (opt.multi) state[k] = $$('input:checked', pop).map((x) => x.value);
      else { state[k] = inp.value; closePopover(); }
      render();
      if (opt.multi) $$('.a-check-row', pop).forEach((row) => { const v = $('input', row).value; const c = $('.a-row__meta', row); if (c) c.textContent = count(v); });
    };
    pop.onclick = (ev) => {
      if (ev.target.closest('[data-reset]')) { state[k] = []; $$('input', pop).forEach((x) => { x.checked = false; }); render(); }
      if (ev.target.closest('[data-done]')) { closePopover(); chip.focus(); }
    };
    openPopover(pop, chip, side);
  }
  $('#clearFilters').addEventListener('click', () => {
    Object.assign(state, { q: '', location: [], category: [], mode: [] });
    $('#jobSearch').value = '';
    render();
  });
  let qTimer;
  $('#jobSearch').addEventListener('input', (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 180); });

  /* ---------------- Tải thêm khi cuộn ---------------- */
  let loading = false;
  function loadMore() {
    const r = results();
    if (loading || state.shown >= r.length) return;
    loading = true;
    list.insertAdjacentHTML('beforeend', Array.from({ length: 3 }, () => `
      <div class="job-skel" aria-hidden="true"><span class="a-skel" style="width:40px;height:40px;border-radius:10px"></span>
      <div class="job-skel__lines"><span class="a-skel" style="height:14px;width:70%"></span><span class="a-skel" style="height:12px;width:40%"></span><span class="a-skel" style="height:10px;width:55%"></span></div></div>`).join(''));
    setTimeout(() => {
      $$('.job-skel', list).forEach((el) => el.remove());
      const before = state.shown;
      state.shown += 6;
      const added = r.slice(before, state.shown);
      added.forEach((j) => list.append(makeRow(j)));
      renderIcons();
      M.stagger(added.map((j) => $('#job-' + j.id)));
      loading = false;
    }, window.__slowLoad ? 4000 : 700);
  }
  new IntersectionObserver((es) => { if (es[0].isIntersecting) loadMore(); }, { root: isMobile() ? null : $('#listScroll'), rootMargin: '200px' }).observe($('#listSentinel'));

  /* ---------------- Chọn việc + xem chi tiết ---------------- */
  function placeInd(instant) { M.indicator(ind, state.selected ? $('#job-' + state.selected) : null, { instant }); }
  function select(id, opts = {}) {
    const j = JOBS.find((x) => x.id === id);
    if (!j) return;
    const changed = state.selected !== id;
    state.selected = id;
    $$('.job-row', list).forEach((r) => r.setAttribute('aria-selected', String(+r.dataset.id === id)));
    $$('.job-row', list).forEach((r) => { r.tabIndex = +r.dataset.id === id ? 0 : -1; });
    placeInd(opts.quiet);
    if (changed || !$('#jdInner').children.length) swapDetail(j, opts.quiet);
    if (isMobile() && opts.open) openMobileDetail();
    syncUrl();
  }
  function swapDetail(j, instant) {
    const inner = $('#jdInner');
    const put = () => {
      inner.innerHTML = detailHtml(j);
      $('#jdScroll').scrollTop = 0;
      $('#jdCompact').classList.remove('is-shown');
      $('#jdCompactLogo').outerHTML = logo(j.company, '28').replace('class="a-logo', 'id="jdCompactLogo" class="a-logo');
      $('#jdCompactTitle').textContent = j.title;
      renderIcons();
      if (!instant && !M.reduced()) {
        inner.classList.remove('jd-swap-in'); void inner.offsetWidth; inner.classList.add('jd-swap-in');
        inner.addEventListener('animationend', () => inner.classList.remove('jd-swap-in'), { once: true });
      }
    };
    if (instant || M.reduced() || !inner.children.length) { put(); return; }
    inner.classList.remove('jd-swap-in');
    inner.classList.add('jd-swap-out');
    setTimeout(() => { inner.classList.remove('jd-swap-out'); put(); }, 110);
  }
  /* noResults: danh sách trống → sheet chỉ nói ngắn gọn, không bảo người dùng "chọn một việc" */
  function showDetailEmpty(noResults) {
    $('#jdInner').innerHTML = noResults
      ? '<div class="a-empty" style="margin-top:18vh"><i data-lucide="briefcase"></i><div class="a-empty__text">Chi tiết việc làm sẽ hiện ở đây khi có kết quả.</div></div>'
      : '<div class="a-empty" style="margin-top:18vh"><i data-lucide="briefcase"></i><div class="a-empty__title">Chọn một việc để xem chi tiết</div><div class="a-empty__text">Dùng phím J / K để chuyển nhanh giữa các việc.</div></div>';
    renderIcons();
  }
  function detailHtml(j) {
    const c = COMPANY[j.company];
    const applied = state.applied.has(j.id);
    const deadline = new Date(); deadline.setDate(deadline.getDate() + j.deadline);
    const dl = `${String(deadline.getDate()).padStart(2, '0')}/${String(deadline.getMonth() + 1).padStart(2, '0')}`;
    const isFE = j.id === 1;
    return `
      <div data-job-detail>
        <button class="a-btn a-btn--ghost a-btn--sm jd-mobile-back" type="button" data-back style="margin:-4px 0 12px -8px"><i data-lucide="chevron-left"></i>Danh sách</button>
        <div class="jd-head">
          ${logo(j.company, '56')}
          <div>
            <h2 class="jd-title">${esc(j.title)}</h2>
            <div class="jd-company"><a href="#company">${esc(j.company)}</a> · ${esc(j.district)}, ${esc(j.city)}</div>
          </div>
        </div>
        <div class="jd-facts">
          <span class="a-tag a-tag--salary"><i data-lucide="wallet"></i>${esc(j.salary)}</span>
          <span class="a-tag"><i data-lucide="briefcase"></i>${esc(j.mode)}</span>
          <span class="a-tag"><i data-lucide="layers"></i>${esc(j.cat)}</span>
          <span class="a-tag"><i data-lucide="clock"></i>Đăng ${postedText(j.posted).toLowerCase()}</span>
        </div>
        <div class="jd-actions" id="jdActions">
          ${applied
            ? '<span class="jd-applied"><i data-lucide="check"></i>Đã ứng tuyển · vừa xong</span>'
            : '<button class="a-btn a-btn--primary a-btn--lg" type="button" data-apply data-tip="Phím A" data-tip-side="bottom">Ứng tuyển</button>'}
          <button class="a-btn a-btn--secondary a-btn--lg a-btn--icon" type="button" data-tip="Chia sẻ" data-tip-side="bottom" aria-label="Chia sẻ"><i data-lucide="share-2"></i></button>
          <span class="jd-deadline">Hạn nộp ${dl} · còn ${j.deadline} ngày</span>
        </div>
        <div class="jd-body">
          <section class="jd-section"><h2>Mô tả công việc</h2>
            <p>${isFE ? 'Bạn sẽ cùng nhóm sản phẩm xây dựng bảng điều khiển bán hàng dùng bởi hơn 3.000 cửa hàng. Công việc hằng ngày gồm phát triển tính năng mới, tối ưu tốc độ tải trang và phối hợp với designer để hoàn thiện trải nghiệm.' : `Tham gia nhóm ${esc(j.cat.toLowerCase())} của ${esc(j.company)}, phụ trách các đầu việc chính của vị trí ${esc(j.title)} và báo cáo trực tiếp cho trưởng nhóm.`}</p>
          </section>
          <section class="jd-section"><h2>Yêu cầu</h2>
            <ul>${(isFE ? ['Từ 1 năm kinh nghiệm với React và TypeScript', 'Hiểu cách trình duyệt hiển thị trang, biết đo và cải thiện hiệu năng', 'Viết test cho component quan trọng', 'Đọc hiểu tài liệu tiếng Anh'] : ['Tốt nghiệp chuyên ngành liên quan hoặc có kinh nghiệm tương đương', 'Chủ động, giao tiếp rõ ràng', 'Ưu tiên ứng viên có dự án cá nhân']).map((x) => `<li>${x}</li>`).join('')}</ul>
          </section>
          <section class="jd-section"><h2>Quyền lợi</h2>
            <ul>${(isFE ? ['Lương tháng 13 và thưởng theo kết quả sản phẩm', 'Làm từ xa 2 ngày mỗi tuần', 'Ngân sách học tập 6 triệu/năm', 'Bảo hiểm sức khoẻ cho bạn và người thân'] : ['Lương tháng 13', 'Bảo hiểm đầy đủ theo luật', '12 ngày phép năm']).map((x) => `<li>${x}</li>`).join('')}</ul>
          </section>
        </div>
        <a class="jd-company-card" href="#company" style="color:inherit;text-decoration:none">
          ${logo(j.company, '')}
          <div class="jd-company-card__text"><div class="jd-company-card__name">${esc(j.company)}</div><div class="jd-company-card__sub">${c.size} · ${c.open} việc đang tuyển · ${c.about}</div></div>
          <i data-lucide="chevron-right" style="color:var(--text-4)"></i>
        </a>
      </div>`;
  }
  $('#jdScroll').addEventListener('scroll', (e) => {
    const shown = e.target.scrollTop > 150;
    const bar = $('#jdCompact');
    if (shown !== bar.classList.contains('is-shown')) { bar.classList.toggle('is-shown', shown); bar.setAttribute('aria-hidden', String(!shown)); $('[data-apply]', bar).tabIndex = shown ? 0 : -1; }
  }, { passive: true });
  $('#jobDetail').addEventListener('click', (e) => {
    if (e.target.closest('[data-apply]')) openApply(e.target.closest('[data-apply]'));
    if (e.target.closest('[data-back]')) closeMobileDetail();
  });

  function openMobileDetail() {
    const d = $('#jobDetail');
    d.classList.add('is-mobile-open');
    M.animate(d, [{ transform: 'translateX(100%)' }, { transform: 'none' }], { duration: 300, easing: M.EASE_OUT });
  }
  function closeMobileDetail() {
    const d = $('#jobDetail');
    M.animate(d, [{ transform: 'none' }, { transform: 'translateX(100%)' }], { duration: 240, easing: M.EASE_IN, fill: 'forwards' }).finished.then(() => {
      d.classList.remove('is-mobile-open');
      d.getAnimations().forEach((a) => a.cancel());
      $('#job-' + state.selected)?.focus({ preventScroll: true });
    });
  }

  /* Bàn phím: J/K hoặc ↑/↓ chuyển việc, A ứng tuyển */
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!$('#applyDialog').hidden || !$('#palette').hidden) return;
    const rows = $$('.job-row', list);
    const i = rows.findIndex((r) => +r.dataset.id === state.selected);
    const k = e.key.toLowerCase();
    if (k === 'j' || e.key === 'ArrowDown' || k === 'k' || e.key === 'ArrowUp') {
      if (!rows.length) return;
      e.preventDefault();
      const n = rows[Math.max(0, Math.min(rows.length - 1, i + ((k === 'j' || e.key === 'ArrowDown') ? 1 : -1)))];
      select(+n.dataset.id);
      n.focus({ preventScroll: true });
      n.scrollIntoView({ block: 'nearest' });
    }
    if (k === 'a' && state.selected && !state.applied.has(state.selected)) { e.preventDefault(); openApply($('#jdActions [data-apply]')); }
  });

  /* ---------------- Ứng tuyển ---------------- */
  const CVS = [
    { id: 1, name: 'CV Frontend — 2026', sub: 'Cập nhật 3 ngày trước · Tạo bằng trình dựng CV' },
    { id: 2, name: 'CV tiếng Anh', sub: 'Cập nhật 2 tuần trước · Tạo bằng trình dựng CV' },
    { id: 3, name: 'dang-khoa-cv.pdf', sub: 'Tải lên 18/08 · PDF, 214 KB' }
  ];
  const dlg = $('#applyDialog');
  const scrim = $('#applyScrim');
  function openApply(origin) {
    const j = JOBS.find((x) => x.id === state.selected);
    if (!j || state.applied.has(j.id)) return;
    dlg.innerHTML = `
      <div class="a-dialog__head"><h2 class="a-dialog__title" id="applyTitle">Ứng tuyển</h2>
        <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-close aria-label="Đóng"><i data-lucide="x"></i></button></div>
      <div class="a-dialog__body" id="applyBody">
        <div class="apply-job">${logo(j.company)}<div><div class="apply-job__title">${esc(j.title)}</div><div class="apply-job__sub">${esc(j.company)} · ${esc(j.city)}</div></div></div>
        <div class="a-label" id="cvLabel">Chọn CV gửi kèm</div>
        <div class="cv-pick" role="radiogroup" aria-labelledby="cvLabel">
          ${CVS.map((cv, i) => `<label class="cv-card"><input type="radio" name="cv" value="${cv.id}" ${i === 0 ? 'checked' : ''}>
            <span class="cv-card__thumb" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
            <span class="cv-card__text"><span class="cv-card__name">${esc(cv.name)}</span><br><span class="cv-card__sub">${esc(cv.sub)}</span></span>
            <span class="cv-card__radio" aria-hidden="true"></span></label>`).join('')}
        </div>
        <div class="a-field">
          <label class="a-label" for="applyNote">Lời nhắn cho nhà tuyển dụng <span style="font-weight:400;color:var(--text-3)">(không bắt buộc)</span></label>
          <textarea class="a-textarea" id="applyNote" rows="3" maxlength="500" placeholder="Ví dụ: Em có thể bắt đầu từ tháng 11 và làm hybrid 3 ngày/tuần."></textarea>
          <div class="a-help"><span class="a-num" id="noteCount">0</span>/500 ký tự</div>
        </div>
      </div>
      <div class="a-dialog__foot" id="applyFoot">
        <button class="a-btn a-btn--ghost" type="button" data-close>Huỷ</button>
        <button class="a-btn a-btn--primary" type="button" id="applySubmit">Gửi hồ sơ</button>
      </div>`;
    renderIcons();
    $('#applyNote').addEventListener('input', (e) => M.rollNumber($('#noteCount'), e.target.value.length));
    $('#applySubmit').addEventListener('click', (e) => submitApply(j, e.currentTarget));
    M.openDialog(dlg, scrim, origin);
  }
  function submitApply(j, btn) {
    M.morphButton(btn, 'loading');
    setTimeout(() => {
      if (window.__failApply) { M.morphButton(btn, 'error'); M.toast('Không gửi được hồ sơ. Kiểm tra kết nối rồi thử lại.', { tone: 'danger' }); return; }
      M.morphButton(btn, 'success', { hold: true });
      setTimeout(() => {
        state.applied.add(j.id);
        const body = $('#applyBody');
        const h = body.offsetHeight;
        body.innerHTML = `<div class="apply-done">
          <span class="apply-done__mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
          <div class="apply-done__title">Đã gửi hồ sơ tới ${esc(j.company)}</div>
          <p class="apply-done__text">Nhà tuyển dụng thường phản hồi trong 3–5 ngày làm việc. Bạn theo dõi trạng thái ở mục Ứng tuyển.</p></div>`;
        M.animate(body, [{ height: h + 'px' }, { height: body.offsetHeight + 'px' }], { duration: 280, easing: M.EASE_OUT });
        $('#applyFoot').innerHTML = '<a class="a-btn a-btn--ghost" href="#applications">Xem đơn ứng tuyển</a><button class="a-btn a-btn--primary" type="button" data-close data-done>Xong</button>';
        $('#applyFoot [data-done]').focus();
      }, 520);
    }, 900);
  }
  async function closeApply() {
    const done = state.applied.has(state.selected) && !$('#jdActions .jd-applied');
    await M.closeDialog(dlg, scrim);
    if (done) {
      const j = JOBS.find((x) => x.id === state.selected);
      const src = $('#jdInner .a-logo--56');
      M.flyTo(src, $('#railApplications svg') || $('#railApplications'));
      const btn = $('#jdActions [data-apply]');
      const chip = document.createElement('span');
      chip.className = 'jd-applied';
      chip.innerHTML = '<i data-lucide="check"></i>Đã ứng tuyển · vừa xong';
      btn.replaceWith(chip);
      renderIcons();
      M.animate(chip, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: M.SPRING });
      const row = $('#job-' + j.id);
      if (row) row.classList.add('is-applied');
    }
  }
  dlg.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeApply(); });
  scrim.addEventListener('click', closeApply);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dlg.hidden) closeApply(); });

  /* ---------------- Demo ---------------- */
  window.ArisDemo = [
    { icon: 'loader', label: 'Xem trạng thái đang tải thêm', run: () => { window.__slowLoad = true; state.shown = 8; render(); $('#listScroll').scrollTop = 1e6; } },
    { icon: 'search-x', label: 'Xem trạng thái không có kết quả', run: () => { state.location = ['Đà Nẵng']; state.mode = ['Toàn thời gian']; render(); } },
    { icon: 'alert-circle', label: 'Ứng tuyển bị lỗi mạng', run: () => { window.__failApply = true; openApply($('#jdActions [data-apply]')); } }
  ];

  /* ---------------- Khởi tạo ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    ['location', 'category', 'mode'].forEach((k) => { if (params.get(k)) state[k] = params.get(k).split(','); });
    if (params.get('q')) { state.q = params.get('q'); $('#jobSearch').value = state.q; }
    if (params.get('sort')) state.sort = params.get('sort');
    $('#totalCount').textContent = `${TOTAL} việc đang tuyển`;
    const want = +params.get('job') || null;
    if (want) state.selected = want;
    render({ syncUrl: false });
    if (!isMobile() && state.selected) swapDetail(JOBS.find((x) => x.id === state.selected), true);
    if (params.has('apply')) setTimeout(() => openApply($('#jdActions [data-apply]')), 300);
  });
  window.addEventListener('resize', () => placeInd(true));
})();
