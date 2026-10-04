/* =============================================================================
   ARIS LINE — Trang Tin nhắn: MÔ PHỎNG TƯƠNG TÁC (bản thiết kế V7)
   - Dữ liệu ở đây là DỮ LIỆU MẪU. App thật lấy từ:
       GET /Chat/GetConversations, GET /Chat/GetMessages?userId=, GET /Chat/SearchUsers?q=
       SignalR (chat-client.js): sendMessage, forwardMessage, deleteMessage, typing, markAsRead
   - Phần "mô phỏng đối phương" (tự trả lời, tự đọc) KHÔNG port — app thật nhận qua SignalR.
   - Mọi animation, cấu trúc DOM, class, trạng thái: PORT NGUYÊN.
   ============================================================================= */
(function () {
  'use strict';
  const M = window.ArisMotion;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isMobile = () => matchMedia('(max-width: 767px)').matches;
  const params = new URLSearchParams(location.search);

  const chat = $('#chat');
  const box = $('#threadMessages');
  const input = $('#composerInput');
  const sendBtn = $('#sendBtn');
  const convList = $('#conversationList');
  const convInd = $('.a-indicator', convList);

  /* ---------------------------------------------------------------------------
     DỮ LIỆU MẪU
     --------------------------------------------------------------------------- */
  const NOW = new Date();
  function at(daysAgo, h, m) { const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d; }

  function photo(kind) {
    const scenes = {
      office: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#DCE4EE'/><g fill='#A9B8CA'><rect x='20' y='150' width='50' height='90'/><rect x='80' y='120' width='40' height='120'/><rect x='130' y='160' width='60' height='80'/><rect x='205' y='105' width='45' height='135'/><rect x='262' y='140' width='55' height='100'/><rect x='328' y='125' width='50' height='115'/></g><g fill='none' stroke='#8594A8' stroke-width='6'><rect x='3' y='3' width='394' height='294'/><path d='M133 0v240M266 0v240'/></g><rect y='236' width='400' height='64' fill='#C8B79E'/><rect x='40' y='214' width='190' height='12' rx='3' fill='#7E6247'/><rect x='64' y='184' width='56' height='32' rx='3' fill='#3A4150'/><rect x='300' y='176' width='26' height='48' rx='8' fill='#6F8F6B'/><rect x='304' y='220' width='18' height='18' rx='3' fill='#8C6F52'/></svg>`,
      meetup: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#ECE6DB'/><rect x='70' y='34' width='260' height='150' rx='6' fill='#2F3542'/><g fill='#8FB3D9'><rect x='96' y='62' width='130' height='12' rx='3'/><rect x='96' y='90' width='190' height='8' rx='3' opacity='.6'/><rect x='96' y='108' width='160' height='8' rx='3' opacity='.6'/><rect x='96' y='126' width='175' height='8' rx='3' opacity='.6'/></g><g fill='#5D6B7B'><circle cx='60' cy='250' r='26'/><circle cx='130' cy='262' r='28'/><circle cx='205' cy='252' r='26'/><circle cx='280' cy='262' r='28'/><circle cx='350' cy='250' r='26'/></g></svg>`,
      notes: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#F3F0E9'/><g><rect x='40' y='40' width='92' height='92' rx='4' fill='#F1D88E'/><rect x='150' y='56' width='92' height='92' rx='4' fill='#CFE2C4'/><rect x='262' y='36' width='92' height='92' rx='4' fill='#F2C6B6'/><rect x='92' y='160' width='92' height='92' rx='4' fill='#C9D8EE'/><rect x='214' y='170' width='92' height='92' rx='4' fill='#F1D88E'/></g><g stroke='#6B6457' stroke-width='5' stroke-linecap='round' opacity='.55'><path d='M58 70h52M58 90h36M168 86h52M168 106h30M280 66h52M280 86h40M110 190h50M110 210h32M232 200h52M232 220h36'/></g></svg>`
    };
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(scenes[kind]);
  }

  const P = {
    ma: { id: 11, name: 'Nguyễn Minh Anh', role: 'Tuyển dụng · TechNova', online: true },
    ha: { id: 12, name: 'Lê Thu Hà', role: 'Bạn bè · 8 bạn chung', online: false },
    huy: { id: 13, name: 'Phạm Gia Huy', role: 'Bạn bè', online: true },
    linh: { id: 14, name: 'Đỗ Khánh Linh', role: 'Bạn bè · 3 bạn chung', online: true },
    nam: { id: 15, name: 'Vũ Hoàng Nam', role: 'Bạn bè', online: false },
    phuong: { id: 16, name: 'Hoàng Mai Phương', role: 'Bạn bè', online: false },
    thinh: { id: 17, name: 'Trần Đức Thịnh', role: 'Bạn bè', online: false }
  };
  let nextId = 1000;
  const mk = (from, date, text, extra = {}) => ({ id: nextId++, from, date, text, ...extra });

  const maAsk = mk('me', at(0, 14, 10), 'Em rảnh chiều thứ Ba hoặc sáng thứ Năm ạ.');
  const CONVS = [
    {
      key: 'ma', person: P.ma, unread: 2, seenId: maAsk.id,
      messages: [
        mk('ma', at(3, 9, 12), 'Chào Khoa, mình là Minh Anh, phụ trách tuyển dụng ở TechNova.'),
        mk('ma', at(3, 9, 13), 'Cảm ơn bạn đã ứng tuyển vị trí Frontend Developer (React). Hồ sơ của bạn khá phù hợp với nhóm sản phẩm bên mình.'),
        mk('me', at(3, 9, 40), 'Dạ em chào chị Minh Anh, em cảm ơn chị đã phản hồi ạ.'),
        mk('me', at(3, 9, 41), 'Em có thể hỏi thêm về quy trình phỏng vấn không ạ?'),
        mk('ma', at(3, 10, 5), 'Quy trình có 2 vòng: vòng 1 trao đổi chuyên môn 45 phút, vòng 2 gặp trưởng nhóm sản phẩm.'),
        mk('ma', at(3, 10, 6), 'JD chi tiết: React 18, TypeScript; có kinh nghiệm tối ưu hiệu năng web là điểm cộng.', { forwarded: true }),
        mk('ma', at(0, 13, 58), 'Bên mình muốn hẹn bạn phỏng vấn vòng 1 vào tuần sau. Bạn tiện thời gian nào?'),
        maAsk,
        mk('me', at(0, 14, 11), '', { deleted: true }),
        mk('ma', at(0, 14, 31), 'Chiều thứ Ba lúc 14:00 nhé. Link phòng phỏng vấn sẽ có trong mục Đơn ứng tuyển.', { replyTo: maAsk.id }),
        mk('ma', at(0, 14, 32), 'Văn phòng bên mình ở tầng 12, nếu bạn muốn ghé trực tiếp.', { image: photo('office'), ar: '4 / 3' })
      ],
      replies: ['Ok bạn, hẹn gặp bạn chiều thứ Ba nhé!', 'Nếu cần đổi lịch bạn cứ nhắn mình trước 1 ngày.', 'Bạn nhớ mang theo laptop nếu muốn demo dự án nha.']
    },
    {
      key: 'huy', person: P.huy, unread: 1, seenId: null,
      messages: [
        mk('me', at(1, 20, 2), 'Huy ơi, slide buổi chia sẻ hôm trước anh còn giữ không?'),
        mk('huy', at(1, 21, 15), 'Còn nè, để anh chụp lại mấy ý chính cho.'),
        mk('huy', at(1, 21, 16), '', { image: photo('notes'), ar: '4 / 3' })
      ],
      replies: ['Có gì cần giải thích thêm cứ hỏi anh nha.', 'Phần cuối là mấy câu hay bị hỏi khi phỏng vấn đó.']
    },
    {
      key: 'ha', person: P.ha, unread: 0, seenId: null,
      messages: [
        mk('ha', at(0, 10, 20), 'Em gửi lại CV bản mới cho chị xem với, chị góp ý phần dự án cho.'),
        mk('me', at(0, 11, 5), 'Em đã gửi lại CV bản cập nhật ạ.')
      ],
      replies: []
    },
    {
      key: 'linh', person: P.linh, unread: 0, seenId: 'last',
      messages: [
        mk('me', at(4, 18, 30), 'Linh ơi tuần này có sự kiện gì hay không?'),
        mk('linh', at(4, 19, 2), 'Cuối tuần này có buổi meetup React ở quận 1 đó, đi không?'),
        mk('linh', at(4, 19, 3), '', { image: photo('meetup'), ar: '4 / 3' })
      ],
      replies: ['Đăng ký trước thứ Sáu nha, chỗ có hạn.', 'Mình đi chung cho vui!']
    },
    {
      key: 'nam', person: P.nam, unread: 0, seenId: 'last',
      messages: [
        mk('nam', at(7, 9, 0), 'Tài liệu ôn thuật toán anh để trong drive nhé.'),
        mk('me', at(7, 9, 20), 'Ok anh, em cảm ơn.')
      ],
      replies: []
    },
    {
      key: 'phuong', person: P.phuong, unread: 0, seenId: null,
      messages: [mk('phuong', at(10, 16, 40), 'Chúc mừng bạn nhé! Nghe nói bạn qua vòng CV rồi.')],
      replies: []
    },
    {
      key: 'thinh', person: P.thinh, unread: 0, seenId: 'last',
      messages: [mk('me', at(13, 8, 15), 'Bạn có tài liệu ôn phỏng vấn frontend không?')],
      replies: []
    }
  ];
  CONVS.forEach((c) => { if (c.seenId === 'last') c.seenId = [...c.messages].reverse().find((m) => m.from === 'me')?.id ?? null; });

  const REQUESTS = [
    { id: 1, name: 'Ngô Bảo Châu', sub: 'Sinh viên CNTT · 2 bạn chung', when: '2 ngày trước' },
    { id: 2, name: 'Lý Gia Hân', sub: 'Product Designer · 5 bạn chung', when: '5 ngày trước' }
  ];
  const SEARCH_POOL = [
    { name: 'Bùi Thanh Tâm', sub: 'Backend Developer · 1 bạn chung', status: 'none' },
    { name: 'Trương Ngọc Mai', sub: 'HR · Sao Mai Retail', status: 'none' },
    { name: 'Đinh Quang Minh', sub: 'Sinh viên · ĐH Bách khoa', status: 'pending_sent' }
  ];

  /* ---------------------------------------------------------------------------
     ĐỊNH DẠNG THỜI GIAN
     --------------------------------------------------------------------------- */
  const DAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const DAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  function dayDiff(d) {
    const a = new Date(NOW); a.setHours(0, 0, 0, 0);
    const b = new Date(d); b.setHours(0, 0, 0, 0);
    return Math.round((a - b) / 86400000);
  }
  function dayLabel(d) {
    const diff = dayDiff(d);
    if (diff === 0) return 'Hôm nay';
    if (diff === 1) return 'Hôm qua';
    if (diff < 7) return `${DAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  function listTime(d) {
    const diff = dayDiff(d);
    if (diff === 0) return hhmm(d);
    if (diff === 1) return 'Hôm qua';
    if (diff < 7) return DAYS_SHORT[d.getDay()];
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }

  /* ---------------------------------------------------------------------------
     DANH SÁCH HỘI THOẠI
     --------------------------------------------------------------------------- */
  let current = null;
  const convByKey = (k) => CONVS.find((c) => c.key === k);
  const lastMsg = (c) => c.messages[c.messages.length - 1];
  function snippetOf(m) {
    if (!m) return '';
    if (m.deleted) return 'Tin nhắn đã được thu hồi';
    if (m.image && !m.text) return 'Đã gửi một hình ảnh';
    return m.text;
  }
  function preview(c) {
    const m = lastMsg(c);
    const s = snippetOf(m);
    return m.from === 'me' ? `Bạn: ${s}` : s;
  }
  function convRowHtml(c) {
    const m = lastMsg(c);
    const unread = c.unread > 0;
    let trail = '';
    if (unread) trail = `<span class="a-badge a-badge--accent a-num">${c.unread}</span>`;
    else if (m.from === 'me' && !m.deleted) {
      const seen = c.seenId === m.id;
      trail = `<span class="conv__receipt" title="${seen ? 'Đã xem' : 'Đã gửi'}"><i data-lucide="${seen ? 'check-check' : 'check'}"></i></span>`;
    }
    return `<div class="a-row conv${unread ? ' a-row--unread' : ''}" role="option" tabindex="-1" aria-selected="${current === c}" data-key="${c.key}" id="conv-${c.key}">
      ${avatarHtml(c.person.name, 44, c.person.online)}
      <div class="a-row__main">
        <div class="a-row__top"><span class="a-row__title">${esc(c.person.name)}</span><span class="a-row__meta">${listTime(m.date)}</span></div>
        <div class="a-row__sub"><span>${esc(preview(c))}</span>${trail}</div>
      </div>
    </div>`;
  }
  function sortConvs() { CONVS.sort((a, b) => lastMsg(b).date - lastMsg(a).date); }
  function makeRow(c) { const t = document.createElement('div'); t.innerHTML = convRowHtml(c); return t.firstElementChild; }
  /* Cập nhật nội dung hàng tại chỗ (giữ nguyên phần tử) để FLIP trượt đúng hàng đó */
  function patchRow(row, c) {
    const f = makeRow(c);
    row.className = f.className;
    row.innerHTML = f.innerHTML;
    row.setAttribute('aria-selected', f.getAttribute('aria-selected'));
    return row;
  }
  function renderConvList(opts = {}) {
    sortConvs();
    const q = norm($('#userSearchInput').value.trim());
    const rows = CONVS.filter((c) => !q || norm(c.person.name).includes(q));
    const build = () => {
      $$('.chat-list__section, .person, .a-empty', convList).forEach((el) => el.remove());
      const keep = new Set(rows.map((c) => 'conv-' + c.key));
      $$('.conv', convList).forEach((el) => { if (!keep.has(el.id)) el.remove(); });
      rows.forEach((c) => {
        const old = $('#conv-' + c.key);
        convList.append(old ? patchRow(old, c) : makeRow(c));
      });
      if (q) renderPeopleResults(q, rows.length);
    };
    if (opts.flip) M.flip(convList, build, { selector: '.conv' }); else build();
    renderIcons();
    rovingInit();
    placeConvIndicator(true);
  }
  function updateConvRow(c, opts = {}) {
    const row = $(`#conv-${c.key}`);
    if (!row) { renderConvList(); return; }
    if (opts.moveTop) {
      sortConvs();
      M.flip(convList, () => {
        patchRow(row, c);
        const idx = CONVS.indexOf(c);
        const prevRow = idx === 0 ? null : $(`#conv-${CONVS[idx - 1].key}`);
        (prevRow || convInd).after(row);
      }, { selector: '.conv' });
    } else {
      patchRow(row, c);
    }
    renderIcons();
    rovingInit();
    placeConvIndicator(!opts.moveTop);
    if (opts.moveTop) setTimeout(() => placeConvIndicator(), 320);
  }
  function placeConvIndicator(instant) {
    M.indicator(convInd, current ? $(`#conv-${current.key}`) : null, { instant });
  }

  /* Người khác (kết quả tìm kiếm) */
  function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function personAction(p) {
    if (p.status === 'pending_sent') return '<button class="a-btn a-btn--ghost a-btn--sm person__action" type="button" disabled>Đã gửi lời mời</button>';
    if (p.status === 'accepted') return '<button class="a-btn a-btn--secondary a-btn--sm person__action" type="button" data-person-chat>Nhắn tin</button>';
    return '<button class="a-btn a-btn--secondary a-btn--sm person__action" type="button" data-add-friend><i data-lucide="user-plus"></i>Kết bạn</button>';
  }
  function renderPeopleResults(q, convCount) {
    const hits = SEARCH_POOL.filter((p) => norm(p.name).includes(q));
    let html = '';
    if (hits.length) {
      html += '<div class="chat-list__section">Người khác</div>';
      html += hits.map((p) => `<div class="a-row person" data-name="${esc(p.name)}">${avatarHtml(p.name, 40)}<div class="a-row__main"><div class="a-row__title">${esc(p.name)}</div><div class="a-row__sub"><span>${esc(p.sub)}</span></div></div>${personAction(p)}</div>`).join('');
    }
    if (!hits.length && !convCount) {
      html = `<div class="a-empty"><i data-lucide="search"></i><div class="a-empty__title">Không tìm thấy ai tên “${esc($('#userSearchInput').value.trim())}”</div><div class="a-empty__text">Kiểm tra lại chính tả hoặc thử tìm bằng họ.</div></div>`;
    }
    convList.insertAdjacentHTML('beforeend', html);
  }
  convList.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add-friend]');
    if (add) {
      const name = add.closest('.person').dataset.name;
      M.morphButton(add, 'loading');
      setTimeout(() => {
        const p = SEARCH_POOL.find((x) => x.name === name);
        p.status = 'pending_sent';
        M.morphButton(add, 'success', { hold: true });
        setTimeout(() => { add.outerHTML = personAction(p); M.toast(`Đã gửi lời mời kết bạn tới ${name}`, { tone: 'success' }); }, 700);
      }, 650);
      return;
    }
    const row = e.target.closest('.conv');
    if (row) selectConv(convByKey(row.dataset.key), { focusComposer: !isMobile() });
  });

  /* Roving focus trong listbox: ↑ ↓ Enter */
  function rovingInit() {
    const rows = $$('.conv', convList);
    if (!rows.length) return;
    const active = rows.find((r) => r.getAttribute('aria-selected') === 'true') || rows[0];
    rows.forEach((r) => { r.tabIndex = r === active ? 0 : -1; });
  }
  convList.addEventListener('keydown', (e) => {
    const rows = $$('.conv', convList);
    const i = rows.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      rows.forEach((r) => { r.tabIndex = -1; });
      n.tabIndex = 0;
      n.focus();
    }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectConv(convByKey(rows[i].dataset.key), { focusComposer: true }); }
  });

  /* ---------------------------------------------------------------------------
     CHỌN HỘI THOẠI
     --------------------------------------------------------------------------- */
  function selectConv(c, opts = {}) {
    if (!c) return;
    const same = current === c;
    current = c;
    $$('.conv', convList).forEach((r) => r.setAttribute('aria-selected', String(r.dataset.key === c.key)));
    rovingInit();
    placeConvIndicator();

    $('#threadEmpty').hidden = true;
    $('#threadActive').hidden = false;
    renderHead(c);
    if (!same) {
      clearReply();
      clearImage();
      renderThread(c);
      M.animate(box, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: M.EASE_OUT });
      if (chat.dataset.drawer === 'open') fillDrawer();
    }
    if (c.unread) markRead(c);

    if (isMobile() && chat.dataset.view !== 'thread') {
      chat.dataset.view = 'thread';
      M.animate($('#threadPane'), [{ transform: 'translateX(30%)', opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: M.EASE_OUT });
      scrollToBottom(true);
    }
    if (opts.focusComposer) input.focus({ preventScroll: true });
    history.replaceState(null, '', `?userId=${c.person.id}` + (params.has('theme') ? `&theme=${params.get('theme')}` : ''));
  }

  function renderHead(c) {
    const av = $('#threadAvatar');
    av.dataset.tone = toneOf(c.person.name);
    av.textContent = initials(c.person.name);
    if (c.person.online) av.dataset.online = 'true'; else delete av.dataset.online;
    $('#threadUsername').textContent = c.person.name;
    setStatus(c.person.online ? 'online' : 'offline');
  }
  function setStatus(state) {
    const st = $('#threadStatus');
    st.dataset.state = state;
    st.textContent = state === 'typing' ? 'đang nhập…' : state === 'online' ? 'Đang hoạt động' : 'Ngoại tuyến';
  }

  function markRead(c) {
    c.unread = 0;
    const row = $(`#conv-${c.key}`);
    const badge = row && $('.a-badge', row);
    const done = () => { updateConvRow(c); syncRailBadge(); };
    if (badge) {
      M.animate(badge, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.3)', opacity: 0 }], { duration: 180, easing: M.EASE_IN, fill: 'forwards' })
        .finished.then(done);
    } else done();
  }
  function syncRailBadge() {
    const total = CONVS.reduce((s, c) => s + c.unread, 0);
    const b = $('#railChatBadge');
    if (!b) return;
    if (!total) {
      M.animate(b, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.3)', opacity: 0 }], { duration: 180, easing: M.EASE_IN, fill: 'forwards' });
      b.dataset.hidden = '1';
      return;
    }
    if (b.dataset.hidden) { delete b.dataset.hidden; b.getAnimations().forEach((a) => a.cancel()); M.pulse(b); }
    M.rollNumber(b, total);
  }

  /* ---------------------------------------------------------------------------
     HIỂN THỊ TIN NHẮN — gom nhóm: cùng người gửi, cách nhau < 5 phút, cùng ngày
     --------------------------------------------------------------------------- */
  const GROUP_GAP = 5 * 60 * 1000;
  function bubbleInner(m, c) {
    if (m.deleted) return null;
    let h = '';
    if (m.forwarded) h += '<div class="m-fwd"><i data-lucide="forward"></i>Đã chuyển tiếp</div>';
    if (m.replyTo) {
      const o = c.messages.find((x) => x.id === m.replyTo);
      if (o) h += `<button type="button" class="m-quote" data-jump="${o.id}" aria-label="Xem tin được trả lời"><span class="m-quote__name">${o.from === 'me' ? 'Bạn' : esc(c.person.name)}</span><span class="m-quote__text">${esc(snippetOf(o))}</span></button>`;
    }
    if (m.image) {
      h += `<button type="button" class="m-media" data-lightbox="${m.id}" aria-label="Xem ảnh lớn"><img src="${m.image}" alt="${esc(m.text || 'Ảnh trong cuộc trò chuyện')}" style="--ar:${m.ar || '4 / 3'}">${m.uploading ? `<span class="m-media__progress">${M.loaderSvg()}</span>` : ''}</button>`;
      if (m.text) h += `<div class="m-caption"><span class="m-text">${esc(m.text)}</span></div>`;
    } else if (m.text) {
      h += `<span class="m-text">${esc(m.text)}</span>`;
    }
    return h;
  }
  function rowHtml(m, c, pos) {
    const mine = m.from === 'me';
    const inner = bubbleInner(m, c);
    const bubble = inner === null
      ? '<div class="m-bubble m-bubble--deleted">Tin nhắn đã được thu hồi</div>'
      : `<div class="m-bubble${m.image ? ' has-media' : ''}">${inner}</div>`;
    const avatar = mine ? '' : `<div class="m-avatar">${pos === 'last' || pos === 'single' ? avatarHtml(c.person.name, 28) : ''}</div>`;
    const actions = m.deleted ? '' : `<div class="m-actions">
        <button type="button" data-act="reply" data-tip="Trả lời" aria-label="Trả lời"><i data-lucide="reply"></i></button>
        <button type="button" data-act="forward" data-tip="Chuyển tiếp" aria-label="Chuyển tiếp"><i data-lucide="forward"></i></button>
        <button type="button" data-act="more" data-tip="Thêm" aria-label="Thêm tuỳ chọn" aria-haspopup="menu"><i data-lucide="more-horizontal"></i></button>
      </div>`;
    return `<div class="m-row m-row--${mine ? 'me' : 'them'} is-${pos}" data-id="${m.id}">${avatar}${bubble}${actions}<time class="m-time" datetime="${m.date.toISOString()}">${hhmm(m.date)}</time></div>`;
  }
  function groupsOf(c) {
    const out = [];
    const firstUnread = c.unread ? c.messages.length - c.unread : -1;
    let day = null;
    let g = null;
    c.messages.forEach((m, i) => {
      const dk = m.date.toDateString();
      if (dk !== day) { out.push({ type: 'day', label: dayLabel(m.date) }); day = dk; g = null; }
      if (i === firstUnread) { out.push({ type: 'unread' }); g = null; }
      if (!g || g.from !== m.from || m.date - g.last > GROUP_GAP) {
        g = { type: 'group', from: m.from, items: [], last: m.date };
        out.push(g);
      }
      g.items.push(m);
      g.last = m.date;
    });
    return out;
  }
  const posOf = (i, n) => (n === 1 ? 'single' : i === 0 ? 'first' : i === n - 1 ? 'last' : 'middle');
  function receiptHtml(c) {
    const lastMine = [...c.messages].reverse().find((m) => m.from === 'me' && !m.deleted);
    if (!lastMine) return '';
    if (c.seenId === lastMine.id) return `<div class="m-receipt" id="readReceipt" data-for="${lastMine.id}">${avatarHtml(c.person.name, 16)}<span>Đã xem</span></div>`;
    return `<div class="m-receipt" id="readReceipt" data-for="${lastMine.id}"><span>Đã gửi</span></div>`;
  }
  function renderThread(c) {
    let html = '';
    let open = false;
    for (const part of groupsOf(c)) {
      if (part.type === 'day') {
        if (open) html += '</section>';
        html += `<section class="m-dayblock"><div class="m-day"><span>${part.label}</span></div>`;
        open = true;
      } else if (part.type === 'unread') html += '<div class="m-unread" id="unreadDivider">Tin nhắn mới</div>';
      else html += `<div class="m-group" data-from="${part.from}">${part.items.map((m, i) => rowHtml(m, c, posOf(i, part.items.length))).join('')}</div>`;
    }
    if (open) html += '</section>';
    box.innerHTML = html;
    placeReceipt(c);
    renderIcons();
    const divider = $('#unreadDivider');
    if (divider) { box.scrollTop = divider.offsetTop - 80; } else scrollToBottom(true);
    updateJump();
  }
  function placeReceipt(c) {
    $('#readReceipt')?.remove();
    const html = receiptHtml(c);
    if (!html) return;
    const row = $(`.m-row[data-id="${JSON.parse(html.match(/data-for="(\d+)"/)[1])}"]`, box);
    if (row) row.insertAdjacentHTML('afterend', html);
  }

  /* Thêm 1 tin vào cuối: nối vào nhóm cuối nếu cùng người gửi & < 5 phút */
  function appendMessage(c, m, opts = {}) {
    $(':scope > .a-empty', box)?.remove();
    const atBottom = isAtBottom();
    const snapshot = $$('.m-row, .m-day, .m-receipt, .m-unread, .m-typing', box).slice(-14).map((el) => [el, el.getBoundingClientRect()]);
    removeTyping(true);
    const prev = c.messages[c.messages.length - 2];
    let block = box.lastElementChild && box.lastElementChild.classList.contains('m-dayblock') ? box.lastElementChild : null;
    if (!block || !prev || prev.date.toDateString() !== m.date.toDateString()) {
      box.insertAdjacentHTML('beforeend', `<section class="m-dayblock"><div class="m-day"><span>${dayLabel(m.date)}</span></div></section>`);
      block = box.lastElementChild;
    }
    const lastGroup = block.lastElementChild && block.lastElementChild.classList.contains('m-group') ? block.lastElementChild : null;
    let group;
    if (lastGroup && lastGroup.dataset.from === m.from && prev && m.date - prev.date <= GROUP_GAP && prev.date.toDateString() === m.date.toDateString()) {
      group = lastGroup;
      const lastRow = $$('.m-row', group).pop();
      lastRow.classList.replace(lastRow.classList.contains('is-single') ? 'is-single' : 'is-last', lastRow.classList.contains('is-single') ? 'is-first' : 'is-middle');
      if (m.from !== 'me') { const slot = $('.m-avatar', lastRow); if (slot) slot.innerHTML = ''; }
      group.insertAdjacentHTML('beforeend', rowHtml(m, c, 'last'));
    } else {
      block.insertAdjacentHTML('beforeend', `<div class="m-group" data-from="${m.from}">${rowHtml(m, c, 'single')}</div>`);
      group = block.lastElementChild;
    }
    if (m.from === 'me') placeReceipt(c);
    renderIcons();
    const row = $(`.m-row[data-id="${m.id}"]`, box);

    if (atBottom || m.from === 'me') scrollToBottom(true);
    else { newWhileAway++; updateJump(); }

    if (M.reduced()) return row;
    snapshot.forEach(([el, r]) => {
      if (!el.isConnected) return;
      const dy = r.top - el.getBoundingClientRect().top;
      if (Math.abs(dy) > .5) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 300, easing: M.EASE_OUT });
    });
    const bubble = $('.m-bubble', row);
    if (opts.fromComposer) {
      const from = input.getBoundingClientRect();
      const to = bubble.getBoundingClientRect();
      const dx = from.left + 6 - to.left;
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      bubble.style.transformOrigin = 'left center';
      bubble.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(.94)`, opacity: .35 },
        { transform: 'none', opacity: 1 }
      ], { duration: 380, easing: M.EASE_OUT });
    } else {
      bubble.style.transformOrigin = m.from === 'me' ? 'right bottom' : 'left bottom';
      bubble.animate([{ transform: 'translateY(8px) scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: M.SPRING });
    }
    return row;
  }

  /* ---------------------------------------------------------------------------
     CUỘN + NÚT XUỐNG CUỐI
     --------------------------------------------------------------------------- */
  let newWhileAway = 0;
  const jumpBtn = $('#jumpBtn');
  const isAtBottom = () => box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  function scrollToBottom(instant) {
    if (instant) box.scrollTop = box.scrollHeight;
    else box.scrollTo({ top: box.scrollHeight, behavior: M.reduced() ? 'auto' : 'smooth' });
  }
  function updateJump() {
    const show = box.scrollHeight - box.scrollTop - box.clientHeight > 240;
    if (!show) newWhileAway = 0;
    if (show && jumpBtn.hidden) M.pop(jumpBtn);
    if (!show && !jumpBtn.hidden) M.unpop(jumpBtn);
    let badge = $('.a-badge', jumpBtn);
    if (newWhileAway) {
      if (!badge) { jumpBtn.insertAdjacentHTML('beforeend', `<span class="a-badge a-badge--accent a-num">${newWhileAway}</span>`); badge = $('.a-badge', jumpBtn); M.pulse(badge); }
      else M.rollNumber(badge, newWhileAway);
    } else if (badge) badge.remove();
  }
  box.addEventListener('scroll', updateJump, { passive: true });
  jumpBtn.addEventListener('click', () => { newWhileAway = 0; scrollToBottom(); });

  /* ---------------------------------------------------------------------------
     SOẠN + GỬI
     --------------------------------------------------------------------------- */
  let replyTo = null;
  let pendingImage = null;
  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(168, Math.max(36, input.scrollHeight)) + 'px';
  }
  function updateSend() {
    const on = !!input.value.trim() || !!pendingImage;
    if (sendBtn.disabled === !on) return;
    sendBtn.disabled = !on;
    if (on) M.animate(sendBtn, [{ transform: 'scale(.8)' }, { transform: 'scale(1)' }], { duration: 300, easing: M.SPRING });
  }
  input.addEventListener('input', () => { autosize(); updateSend(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    if (e.key === 'Escape' && replyTo) { e.preventDefault(); e.stopPropagation(); clearReply(); }
    if (e.key === 'ArrowUp' && !input.value) {
      /* ↑ khi ô trống: trả lời tin cuối của đối phương */
      const m = [...current.messages].reverse().find((x) => x.from !== 'me' && !x.deleted);
      if (m) { e.preventDefault(); setReply(m); }
    }
  });
  $('#composerForm').addEventListener('submit', (e) => { e.preventDefault(); send(); });

  function send() {
    const text = input.value.trim();
    if (!text && !pendingImage) return;
    const c = current;
    const m = mk('me', new Date(), text, {
      replyTo: replyTo ? replyTo.id : null,
      image: pendingImage ? pendingImage.url : null,
      ar: pendingImage ? pendingImage.ar : null,
      uploading: !!pendingImage
    });
    c.messages.push(m);
    input.value = '';
    autosize();
    clearReply();
    clearImage();
    updateSend();
    appendMessage(c, m, { fromComposer: true });
    updateConvRow(c, { moveTop: true });
    if (m.uploading) {
      setTimeout(() => {
        m.uploading = false;
        const prog = $(`.m-row[data-id="${m.id}"] .m-media__progress`, box);
        if (prog) M.animate(prog, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(() => prog.remove());
      }, 1100);
    }
    simulatePartner(c, m);
  }

  /* Trả lời */
  function setReply(m) {
    if (!m || m.deleted) return;
    replyTo = m;
    $('#replyPreviewName').textContent = m.from === 'me' ? 'chính bạn' : current.person.name;
    $('#replyPreviewSnippet').textContent = snippetOf(m);
    M.expand($('#replyPreviewBar'));
    input.focus();
  }
  function clearReply() { replyTo = null; M.collapse($('#replyPreviewBar')); }
  $('#replyPreviewCancel').addEventListener('click', () => { clearReply(); input.focus(); });

  /* Ảnh đính kèm */
  $('#imagePickerBtn').addEventListener('click', () => $('#chatImageInput').click());
  $('#chatImageInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { M.toast('Chỉ gửi được tệp ảnh (JPG, PNG, WEBP).', { tone: 'danger' }); return; }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      pendingImage = { url, ar: `${img.naturalWidth} / ${img.naturalHeight}` };
      $('#imagePreviewThumb').src = url;
      $('#imagePreviewName').textContent = f.name;
      M.expand($('#imagePreviewBar'));
      updateSend();
      input.focus();
    };
    img.src = url;
    e.target.value = '';
  });
  function clearImage() { pendingImage = null; M.collapse($('#imagePreviewBar')); updateSend(); }
  $('#imagePreviewCancel').addEventListener('click', clearImage);

  /* Emoji */
  const EMOJI = ['😀', '😂', '😊', '😍', '🥳', '😎', '🤔', '😅', '😢', '😮', '🙏', '👍', '👏', '💪', '🙌', '👀', '❤️', '🔥', '✅', '🎉', '💡', '📌', '📎', '☕', '🚀', '🤝', '💼', '📅', '📝', '✨', '🙂', '😴'];
  $('#emojiGrid').innerHTML = EMOJI.map((e) => `<button type="button" aria-label="Chèn ${e}">${e}</button>`).join('');
  $('#emojiPickerBtn').addEventListener('click', (e) => openPopover($('#emojiPop'), e.currentTarget, 'top'));
  $('#emojiGrid').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const s = input.selectionStart ?? input.value.length;
    input.value = input.value.slice(0, s) + b.textContent + input.value.slice(input.selectionEnd ?? s);
    input.selectionStart = input.selectionEnd = s + b.textContent.length;
    closePopover();
    input.focus();
    autosize();
    updateSend();
  });

  /* ---------------------------------------------------------------------------
     THAO TÁC TRÊN TIN NHẮN
     --------------------------------------------------------------------------- */
  box.addEventListener('click', (e) => {
    const q = e.target.closest('.m-quote');
    if (q) { jumpTo(+q.dataset.jump); return; }
    const media = e.target.closest('[data-lightbox]');
    if (media) { const m = current.messages.find((x) => x.id === +media.dataset.lightbox); openLightbox([media.querySelector('img')], 0, m.text); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const id = +act.closest('.m-row').dataset.id;
    const m = current.messages.find((x) => x.id === id);
    if (act.dataset.act === 'reply') setReply(m);
    if (act.dataset.act === 'forward') openForward(m, act);
    if (act.dataset.act === 'more') openMsgMenu(m, act);
  });
  function jumpTo(id) {
    const row = $(`.m-row[data-id="${id}"]`, box);
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: M.reduced() ? 'auto' : 'smooth' });
    setTimeout(() => M.highlight($('.m-bubble', row)), 320);
  }
  function openMsgMenu(m, anchor) {
    const pop = $('#msgMenu');
    pop.innerHTML = `
      ${m.text ? '<button class="a-menu__item" type="button" data-m="copy"><i data-lucide="copy"></i>Sao chép</button>' : ''}
      <button class="a-menu__item" type="button" data-m="reply"><i data-lucide="reply"></i>Trả lời</button>
      <button class="a-menu__item" type="button" data-m="forward"><i data-lucide="forward"></i>Chuyển tiếp</button>
      ${m.from === 'me' ? '<div class="a-menu__sep"></div><button class="a-menu__item a-menu__item--danger" type="button" data-m="recall"><i data-lucide="undo-2"></i>Thu hồi với mọi người</button>' : ''}`;
    renderIcons();
    pop.onclick = (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      closePopover();
      if (b.dataset.m === 'copy') navigator.clipboard?.writeText(m.text).then(() => M.toast('Đã sao chép tin nhắn', { tone: 'success' }), () => M.toast('Không sao chép được, hãy chọn và sao chép thủ công.', { tone: 'danger' }));
      if (b.dataset.m === 'reply') setReply(m);
      if (b.dataset.m === 'forward') openForward(m, anchor);
      if (b.dataset.m === 'recall') recall(m);
    };
    openPopover(pop, anchor, 'bottom-end');
  }
  function recall(m) {
    const row = $(`.m-row[data-id="${m.id}"]`, box);
    m.deleted = true;
    const old = $('.m-bubble', row);
    M.animate(old, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }], { duration: 140, easing: M.EASE_IN, fill: 'forwards' }).finished.then(() => {
      const tmp = document.createElement('div');
      tmp.innerHTML = rowHtml(m, current, [...row.classList].find((x) => x.startsWith('is-')).slice(3));
      row.replaceWith(tmp.firstElementChild);
      const fresh = $(`.m-row[data-id="${m.id}"] .m-bubble`, box);
      M.animate(fresh, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      placeReceipt(current);
      updateConvRow(current);
    });
    M.toast('Đã thu hồi tin nhắn');
  }

  /* Chuyển tiếp */
  function openForward(m, origin) {
    const dlg = $('#forwardDialog');
    $('#forwardSnippet').textContent = snippetOf(m);
    const render = (q = '') => {
      const people = Object.values(P).filter((p) => !q || norm(p.name).includes(norm(q)));
      $('#forwardTargetList').innerHTML = people.length ? people.map((p) => `
        <div class="a-row" style="cursor:default">${avatarHtml(p.name, 36, p.online)}
          <div class="a-row__main"><div class="a-row__title">${esc(p.name)}</div><div class="a-row__sub"><span>${esc(p.role)}</span></div></div>
          <button class="a-btn a-btn--secondary a-btn--sm" type="button" data-fwd="${p.id}">Gửi</button></div>`).join('')
        : '<div class="a-empty"><div class="a-empty__title">Không có bạn bè nào khớp</div></div>';
      renderIcons();
    };
    render();
    $('#forwardSearch').value = '';
    $('#forwardSearch').oninput = (e) => render(e.target.value.trim());
    $('#forwardTargetList').onclick = (e) => {
      const b = e.target.closest('[data-fwd]');
      if (!b || b.dataset.state) return;
      M.morphButton(b, 'loading');
      setTimeout(() => {
        M.morphButton(b, 'success', { hold: true });
        const p = Object.values(P).find((x) => x.id === +b.dataset.fwd);
        const target = CONVS.find((c) => c.person === p);
        if (target && target !== current) {
          target.messages.push(mk('me', new Date(), m.text || '', { forwarded: true, image: m.image, ar: m.ar }));
          updateConvRow(target, { moveTop: true });
        }
        setTimeout(() => { b.outerHTML = '<button class="a-btn a-btn--ghost a-btn--sm" type="button" disabled>Đã gửi</button>'; }, 900);
      }, 600);
    };
    M.openDialog(dlg, $('#forwardScrim'), origin);
  }
  $('#forwardDialog').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) M.closeDialog($('#forwardDialog'), $('#forwardScrim')); });
  $('#forwardScrim').addEventListener('click', () => M.closeDialog($('#forwardDialog'), $('#forwardScrim')));

  /* XEM ẢNH: dùng openLightbox() dùng chung trong shell.js (ảnh phóng từ thumbnail) */

  /* ---------------------------------------------------------------------------
     NGĂN THÔNG TIN + TÌM TRONG CUỘC TRÒ CHUYỆN
     --------------------------------------------------------------------------- */
  function fillDrawer() {
    const c = current;
    if (!c) return;
    const av = $('#drawerAvatar');
    av.dataset.tone = toneOf(c.person.name);
    av.textContent = initials(c.person.name);
    if (c.person.online) av.dataset.online = 'true'; else delete av.dataset.online;
    $('#drawerName').textContent = c.person.name;
    $('#drawerStatus').textContent = `${c.person.role}${c.person.online ? ' · Đang hoạt động' : ''}`;
    const imgs = c.messages.filter((m) => m.image && !m.deleted);
    $('#drawerMediaCount').textContent = imgs.length ? imgs.length : '';
    $('#drawerMedia').innerHTML = imgs.length
      ? imgs.map((m) => `<button type="button" data-drawer-img="${m.id}" aria-label="Xem ảnh"><img src="${m.image}" alt=""></button>`).join('')
      : '<p style="grid-column:1/-1;font-size:13px;color:var(--text-3)">Chưa có ảnh nào trong cuộc trò chuyện này.</p>';
    $('#threadSearch').value = '';
    runSearch('');
  }
  function setDrawer(open) {
    const apply = () => {
      chat.dataset.drawer = open ? 'open' : 'closed';
      $('#drawerBtn').setAttribute('aria-pressed', String(open));
    };
    if (open) fillDrawer();
    const wide = matchMedia('(min-width: 1100px)').matches;
    if (wide && document.startViewTransition && !M.reduced()) {
      document.startViewTransition(apply);
    } else {
      apply();
      if (open) M.animate($('#chatDrawer'), [{ opacity: 0, transform: 'translateX(16px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: M.EASE_OUT });
    }
    if (open) setTimeout(() => $('#threadSearch').focus({ preventScroll: true }), 200);
    else runSearch('');
  }
  $('#drawerBtn').addEventListener('click', () => setDrawer(chat.dataset.drawer !== 'open'));
  $('#drawerClose').addEventListener('click', () => setDrawer(false));
  $('#drawerCall').addEventListener('click', (e) => startCall(e.currentTarget));
  $('#drawerMedia').addEventListener('click', (e) => {
    const b = e.target.closest('[data-drawer-img]');
    if (!b) return;
    /* Ảnh đã chia sẻ: xem như một bộ sưu tập, ← → chuyển ảnh */
    const imgs = $$('[data-drawer-img] img', $('#drawerMedia'));
    imgs.forEach((img) => { const m = current.messages.find((x) => x.id === +img.closest('[data-drawer-img]').dataset.drawerImg); img.dataset.caption = (m && m.text) || ''; });
    openLightbox(imgs, imgs.indexOf(b.querySelector('img')));
  });

  let hits = [];
  let hitIndex = 0;
  function runSearch(q) {
    $$('.m-text', box).forEach((el) => {
      if (el.dataset.raw === undefined) el.dataset.raw = el.textContent;
      el.innerHTML = esc(el.dataset.raw);
    });
    hits = [];
    const nav = $('#threadSearchNav');
    if (!q) { nav.hidden = true; return; }
    const nq = norm(q);
    $$('.m-text', box).forEach((el) => {
      const raw = el.dataset.raw;
      const n = norm(raw);
      let i = 0;
      let out = '';
      let from = 0;
      while ((i = n.indexOf(nq, from)) !== -1) {
        out += esc(raw.slice(from, i)) + `<mark class="m-hit">${esc(raw.slice(i, i + q.length))}</mark>`;
        from = i + q.length;
      }
      if (from) { el.innerHTML = out + esc(raw.slice(from)); }
    });
    hits = $$('mark.m-hit', box);
    nav.hidden = false;
    hitIndex = hits.length - 1;
    showHit();
  }
  function showHit() {
    const count = $('#threadSearchCount');
    hits.forEach((h) => h.classList.remove('is-current'));
    if (!hits.length) { count.textContent = 'Không có kết quả'; return; }
    count.textContent = `${hitIndex + 1} / ${hits.length} kết quả`;
    const h = hits[hitIndex];
    h.classList.add('is-current');
    h.scrollIntoView({ block: 'center', behavior: M.reduced() ? 'auto' : 'smooth' });
  }
  let searchTimer;
  $('#threadSearch').addEventListener('input', (e) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(e.target.value.trim()), 150); });
  $('#threadSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && hits.length) { e.preventDefault(); hitIndex = (hitIndex + (e.shiftKey ? 1 : -1) + hits.length) % hits.length; showHit(); }
  });
  $('#threadSearchPrev').addEventListener('click', () => { if (!hits.length) return; hitIndex = (hitIndex - 1 + hits.length) % hits.length; showHit(); });
  $('#threadSearchNext').addEventListener('click', () => { if (!hits.length) return; hitIndex = (hitIndex + 1) % hits.length; showHit(); });

  /* ---------------------------------------------------------------------------
     DANH SÁCH: segmented (Đoạn chat / Bạn bè / Lời mời) + tìm kiếm
     --------------------------------------------------------------------------- */
  const seg = $('#networkTabs');
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('.a-seg__btn');
    if (!b || b.getAttribute('aria-selected') === 'true') return;
    $$('.a-seg__btn', seg).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    M.segment(seg, b);
    showList(b.dataset.list);
  });
  function showList(id) {
    const lists = ['conversationList', 'friendsList', 'requestsList'].map((x) => $('#' + x));
    const target = $('#' + id);
    lists.forEach((l) => { if (l !== target) l.hidden = true; });
    if (id === 'friendsList') renderFriends();
    if (id === 'requestsList') renderRequests();
    target.hidden = false;
    M.stagger($$(':scope > .a-row', target));
    if (id === 'conversationList') placeConvIndicator(true);
  }
  function renderFriends() {
    const people = Object.values(P).sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name, 'vi'));
    const online = people.filter((p) => p.online).length;
    $('#friendsList').innerHTML = `<div class="chat-list__section">${online} người đang hoạt động · ${people.length} bạn bè</div>` + people.map((p) => `
      <div class="a-row" data-friend="${p.id}">${avatarHtml(p.name, 40, p.online)}
        <div class="a-row__main"><div class="a-row__title">${esc(p.name)}</div><div class="a-row__sub"><span>${p.online ? 'Đang hoạt động' : esc(p.role)}</span></div></div>
        <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-tip="Nhắn tin" aria-label="Nhắn tin cho ${esc(p.name)}"><i data-lucide="message-circle"></i></button>
      </div>`).join('');
    renderIcons();
  }
  $('#friendsList').addEventListener('click', (e) => {
    const row = e.target.closest('[data-friend]');
    if (!row) return;
    openChatWith(Object.values(P).find((p) => p.id === +row.dataset.friend));
  });
  function openChatWith(p) {
    let c = CONVS.find((x) => x.person === p);
    if (!c) { c = { key: 'p' + p.id, person: p, unread: 0, seenId: null, messages: [], replies: [] }; CONVS.push(c); }
    const convTab = $('[data-list="conversationList"]', seg);
    if (convTab.getAttribute('aria-selected') !== 'true') convTab.click();
    if (c.messages.length) selectConv(c, { focusComposer: true });
    else {
      current = c;
      $('#threadEmpty').hidden = true;
      $('#threadActive').hidden = false;
      renderHead(c);
      box.innerHTML = `<div class="a-empty" style="margin-top:12vh">${avatarHtml(p.name, 56)}<div class="a-empty__title">Bắt đầu trò chuyện với ${esc(p.name)}</div><div class="a-empty__text">Tin nhắn đầu tiên sẽ tạo cuộc trò chuyện mới.</div></div>`;
      if (isMobile()) chat.dataset.view = 'thread';
      input.focus();
    }
  }
  function renderRequests() {
    const list = $('#requestsList');
    list.innerHTML = REQUESTS.length ? REQUESTS.map((r) => `
      <div class="a-row" data-req="${r.id}" style="cursor:default;align-items:flex-start">${avatarHtml(r.name, 40)}
        <div class="a-row__main">
          <div class="a-row__top"><span class="a-row__title">${esc(r.name)}</span><span class="a-row__meta">${r.when}</span></div>
          <div class="a-row__sub"><span>${esc(r.sub)}</span></div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="a-btn a-btn--primary a-btn--sm" type="button" data-accept>Đồng ý</button>
            <button class="a-btn a-btn--ghost a-btn--sm" type="button" data-decline>Bỏ qua</button>
          </div>
        </div>
      </div>`).join('')
      : '<div class="a-empty"><i data-lucide="user-plus"></i><div class="a-empty__title">Không có lời mời nào</div><div class="a-empty__text">Lời mời kết bạn mới sẽ xuất hiện ở đây.</div></div>';
    renderIcons();
  }
  function syncReqBadge() {
    const b = $('#requestsBadge');
    if (!REQUESTS.length) { b.hidden = true; return; }
    b.hidden = false;
    M.rollNumber(b, REQUESTS.length);
  }
  $('#requestsList').addEventListener('click', (e) => {
    const row = e.target.closest('[data-req]');
    if (!row) return;
    const r = REQUESTS.find((x) => x.id === +row.dataset.req);
    const idx = REQUESTS.indexOf(r);
    const accept = e.target.closest('[data-accept]');
    const decline = e.target.closest('[data-decline]');
    if (!accept && !decline) return;
    const finish = () => {
      REQUESTS.splice(REQUESTS.indexOf(r), 1);
      syncReqBadge();
      M.removeFrom($('#requestsList'), row).then(() => { if (!REQUESTS.length) renderRequests(); });
    };
    if (accept) {
      M.morphButton(accept, 'loading');
      setTimeout(() => {
        M.morphButton(accept, 'success', { hold: true });
        setTimeout(() => {
          finish();
          const p = { id: 100 + r.id, name: r.name, role: 'Bạn bè', online: false };
          P['req' + r.id] = p;
          M.toast(`Đã kết bạn với ${r.name}`, { tone: 'success', action: { label: 'Nhắn tin', onClick: () => openChatWith(p) } });
        }, 450);
      }, 500);
    } else {
      finish();
      M.toast(`Đã bỏ qua lời mời của ${r.name}`, {
        action: {
          label: 'Hoàn tác',
          onClick: () => {
            REQUESTS.splice(idx, 0, r);
            syncReqBadge();
            if (!$('#requestsList').hidden) M.flip($('#requestsList'), renderRequests);
          }
        }
      });
    }
  });

  let searchT;
  $('#userSearchInput').addEventListener('input', () => {
    clearTimeout(searchT);
    searchT = setTimeout(() => {
      const convTab = $('[data-list="conversationList"]', seg);
      if (convTab.getAttribute('aria-selected') !== 'true') convTab.click();
      renderConvList({ flip: true });
    }, 120);
  });
  $('#userSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { const r = $('.conv', convList); if (r) { e.preventDefault(); r.focus(); } }
    if (e.key === 'Escape' && e.target.value) { e.preventDefault(); e.stopPropagation(); e.target.value = ''; renderConvList({ flip: true }); }
  });
  $('#newChatBtn').addEventListener('click', () => {
    $('[data-list="friendsList"]', seg).click();
    const s = $('#userSearchInput');
    s.focus();
  });

  /* ---------------------------------------------------------------------------
     MOBILE: quay lại danh sách
     --------------------------------------------------------------------------- */
  $('#backToConversations').addEventListener('click', () => {
    chat.dataset.view = 'list';
    M.animate($('.chat-list'), [{ transform: 'translateX(-24%)', opacity: .5 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: M.EASE_OUT });
    const row = current && $(`#conv-${current.key}`);
    if (row) row.focus({ preventScroll: true });
  });

  /* ---------------------------------------------------------------------------
     CUỘC GỌI VIDEO
     --------------------------------------------------------------------------- */
  const call = $('#callOverlay');
  const pip = $('#callPip');
  let callTimer = null;
  let callOrigin = null;
  let idleTimer = null;
  function circleAt(el) {
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    return { x, y, R: Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) };
  }
  function pipCorners() {
    const w = pip.offsetWidth;
    const h = pip.offsetHeight;
    const m = isMobile() ? 12 : 24;
    const bottom = isMobile() ? 108 : 112;
    return [
      { x: m, y: 72 }, { x: innerWidth - w - m, y: 72 },
      { x: m, y: innerHeight - h - bottom }, { x: innerWidth - w - m, y: innerHeight - h - bottom }
    ];
  }
  function setPip(x, y) { pip.style.transform = `translate(${x}px, ${y}px)`; pip._x = x; pip._y = y; }
  function startCall(origin) {
    const c = current;
    if (!c) return;
    callOrigin = origin;
    $('#callOverlayName').textContent = c.person.name;
    const av = $('#callAvatar');
    av.dataset.tone = toneOf(c.person.name);
    av.textContent = initials(c.person.name);
    $('#callOverlayStatus').textContent = 'Đang gọi…';
    $('#callLive').hidden = true;
    call.hidden = false;
    const k = pipCorners()[3];
    setPip(k.x, k.y);
    const { x, y, R } = circleAt(origin);
    M.animate(call, { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] }, { duration: 460, easing: M.EASE_IN_OUT });
    $('#callLeaveBtn').focus({ preventScroll: true });
    let sec = 0;
    callTimer = setTimeout(() => {
      $('#callLive').hidden = false;
      $('#callLive').textContent = 'Đang gọi video';
      callTimer = setInterval(() => {
        sec++;
        $('#callOverlayStatus').textContent = `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
      }, 1000);
    }, 1800);
    armIdle();
  }
  function endCall() {
    clearTimeout(callTimer);
    clearInterval(callTimer);
    $('#callOverlayStatus').textContent = 'Đã kết thúc';
    if (!(callOrigin && callOrigin.isConnected && callOrigin.getClientRects().length)) callOrigin = $('#startCallBtn');
    const { x, y, R } = circleAt(callOrigin);
    const a = M.animate(call, { clipPath: [`circle(${R}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`] }, { duration: 380, easing: M.EASE_IN_OUT, delay: 250, fill: 'forwards' });
    a.finished.then(() => {
      call.hidden = true;
      call.getAnimations().forEach((z) => z.cancel());
      ['#callToggleMicBtn', '#callToggleCamBtn'].forEach((s) => $(s).setAttribute('aria-pressed', 'false'));
      if (callOrigin && callOrigin.isConnected) callOrigin.focus({ preventScroll: true });
    });
  }
  function armIdle() {
    call.classList.remove('is-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!call.hidden && !call.querySelector(':focus-visible')) call.classList.add('is-idle'); }, 3000);
  }
  call.addEventListener('pointermove', armIdle);
  call.addEventListener('focusin', () => { if (call.querySelector(':focus-visible')) { call.classList.remove('is-idle'); clearTimeout(idleTimer); } });
  $('#startCallBtn').addEventListener('click', (e) => startCall(e.currentTarget));
  $('#callLeaveBtn').addEventListener('click', endCall);
  function toggleCallBtn(btn, onIcon, offIcon, onTip, offTip) {
    const pressed = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(pressed));
    btn.innerHTML = `<i data-lucide="${pressed ? offIcon : onIcon}"></i>`;
    btn.dataset.tip = pressed ? offTip : onTip;
    btn.setAttribute('aria-label', btn.dataset.tip);
    renderIcons();
    return pressed;
  }
  $('#callToggleMicBtn').addEventListener('click', (e) => toggleCallBtn(e.currentTarget, 'mic', 'mic-off', 'Tắt micro', 'Bật micro'));
  $('#callToggleCamBtn').addEventListener('click', (e) => {
    const off = toggleCallBtn(e.currentTarget, 'video', 'video-off', 'Tắt camera', 'Bật camera');
    $('span:last-child', pip).textContent = off ? 'Bạn · camera tắt' : 'Bạn';
  });

  /* Kéo khung camera của mình; thả ra thì bám vào góc gần nhất bằng spring */
  let drag = null;
  pip.addEventListener('pointerdown', (e) => {
    drag = { sx: e.clientX, sy: e.clientY, x: pip._x, y: pip._y, t: performance.now() };
    pip.setPointerCapture(e.pointerId);
    pip.getAnimations().forEach((a) => a.cancel());
  });
  pip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    setPip(drag.x + e.clientX - drag.sx, drag.y + e.clientY - drag.sy);
    drag.vx = e.movementX;
    drag.vy = e.movementY;
  });
  const drop = () => {
    if (!drag) return;
    /* ném theo hướng kéo: cộng quán tính nhỏ trước khi chọn góc */
    const px = pip._x + (drag.vx || 0) * 12;
    const py = pip._y + (drag.vy || 0) * 12;
    drag = null;
    const target = pipCorners().reduce((best, k) => (Math.hypot(k.x - px, k.y - py) < Math.hypot(best.x - px, best.y - py) ? k : best));
    const from = pip.style.transform;
    setPip(target.x, target.y);
    M.animate(pip, [{ transform: from }, { transform: pip.style.transform }], { duration: 520, easing: M.SPRING });
  };
  pip.addEventListener('pointerup', drop);
  pip.addEventListener('pointercancel', drop);
  window.addEventListener('resize', () => { if (!call.hidden) { const k = pipCorners()[3]; setPip(k.x, k.y); } });

  /* Cuộc gọi đến */
  const ring = $('#incomingCallToast');
  function incomingCall(c) {
    const av = $('#incomingCallAvatar');
    av.dataset.tone = toneOf(c.person.name);
    av.textContent = initials(c.person.name);
    $('#incomingCallName').textContent = c.person.name;
    ring.hidden = false;
    M.animate(ring, [{ opacity: 0, transform: 'translateY(-12px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: M.SPRING });
    ring._conv = c;
  }
  async function hideRing() {
    await M.animate(ring, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 180, easing: M.EASE_IN, fill: 'forwards' }).finished.catch(() => {});
    ring.hidden = true;
    ring.getAnimations().forEach((a) => a.cancel());
  }
  $('#incomingCallAccept').addEventListener('click', (e) => { selectConv(ring._conv); const o = e.currentTarget; hideRing(); startCall(o); });
  $('#incomingCallDecline').addEventListener('click', () => { hideRing(); M.toast(`Đã từ chối cuộc gọi của ${ring._conv.person.name}`); });

  /* ---------------------------------------------------------------------------
     MẤT KẾT NỐI (SignalR onreconnecting / onreconnected)
     --------------------------------------------------------------------------- */
  function connectionLost() {
    const banner = $('#connBanner');
    banner.classList.remove('is-ok');
    $('#connBannerMsg').innerHTML = `${M.loaderSvg()}<span>Mất kết nối. Đang thử kết nối lại — tin bạn gửi sẽ được gửi khi có mạng.</span>`;
    M.expand(banner);
    setTimeout(() => {
      banner.classList.add('is-ok');
      $('#connBannerMsg').innerHTML = '<i data-lucide="check"></i><span>Đã kết nối lại</span>';
      renderIcons();
      setTimeout(() => M.collapse(banner), 1400);
    }, 3200);
  }

  /* ---------------------------------------------------------------------------
     MÔ PHỎNG ĐỐI PHƯƠNG (chỉ có trong bản thiết kế — app thật nhận qua SignalR)
     --------------------------------------------------------------------------- */
  function showTyping(c) {
    if (current !== c || $('.m-typing', box)) return;
    setStatus('typing');
    const atBottom = isAtBottom();
    const block = box.lastElementChild && box.lastElementChild.classList.contains('m-dayblock') ? box.lastElementChild : box;
    block.insertAdjacentHTML('beforeend', `<div class="m-group m-typing" data-from="them"><div class="m-row m-row--them is-single"><div class="m-avatar">${avatarHtml(c.person.name, 28)}</div><div class="m-bubble" aria-label="${esc(c.person.name)} đang nhập"><i></i><i></i><i></i></div></div></div>`);
    const t = $('.m-typing .m-bubble', box);
    t.style.transformOrigin = 'left bottom';
    M.animate(t, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: M.SPRING });
    if (atBottom) scrollToBottom(true);
  }
  function removeTyping(instant) {
    const t = $('.m-typing', box);
    if (!t) return;
    if (current) setStatus(current.person.online ? 'online' : 'offline');
    if (instant) { t.remove(); return; }
    M.animate(t, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }).finished.then(() => t.remove());
  }
  function simulatePartner(c, mine) {
    if (!c.person.online || !c.replies || !c.replies.length) return;
    setTimeout(() => {
      c.seenId = mine.id;
      if (current === c) moveReceipt(c);
      updateConvRow(c);
    }, 900);
    setTimeout(() => showTyping(c), 1500);
    setTimeout(() => {
      const text = c.replies.shift();
      const m = mk(c.key, new Date(), text);
      c.messages.push(m);
      if (current === c) { appendMessage(c, m); placeReceipt(c); }
      else { removeTyping(true); c.unread++; syncRailBadge(); }
      updateConvRow(c, { moveTop: true });
    }, 3600);
  }
  function moveReceipt(c) {
    const r = $('#readReceipt');
    const before = r ? r.getBoundingClientRect() : null;
    placeReceipt(c);
    renderIcons();
    const now = $('#readReceipt');
    if (!now || !before) return;
    M.animate(now, [{ transform: `translateY(${before.top - now.getBoundingClientRect().top}px)`, opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: M.SPRING });
  }

  /* ---------------------------------------------------------------------------
     PHÍM TẮT CỦA TRANG
     --------------------------------------------------------------------------- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#forwardDialog').hidden) { M.closeDialog($('#forwardDialog'), $('#forwardScrim')); return; }
      if (chat.dataset.drawer === 'open' && !isMobile()) { setDrawer(false); $('#drawerBtn').focus(); return; }
      if (chat.dataset.drawer === 'open') { setDrawer(false); return; }
    }
    if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      sortConvs();
      const i = CONVS.indexOf(current);
      const n = CONVS[Math.max(0, Math.min(CONVS.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      selectConv(n, { focusComposer: true });
    }
  });

  /* ---------------------------------------------------------------------------
     BẢNG DEMO (rail → bình thí nghiệm). KHÔNG port.
     --------------------------------------------------------------------------- */
  window.ArisDemo = [
    { icon: 'phone', label: 'Có cuộc gọi đến', run: () => incomingCall(convByKey('linh')) },
    { icon: 'wifi-off', label: 'Mất kết nối rồi có lại', run: () => { if (!current) selectConv(CONVS[0]); connectionLost(); } },
    { icon: 'message-circle', label: 'Tin mới ở cuộc trò chuyện khác', run: () => { const c = convByKey('huy'); c.replies = c.replies.length ? c.replies : ['Tối nay rảnh không, gọi video chút nha?']; simulatePartner(c, lastMsg(c)); } },
    { icon: 'panel-right', label: 'Mở/đóng ngăn thông tin', run: () => setDrawer(chat.dataset.drawer !== 'open') },
    { icon: 'inbox', label: 'Xem trạng thái chưa chọn hội thoại', run: () => { current = null; $$('.conv', convList).forEach((r) => r.setAttribute('aria-selected', 'false')); placeConvIndicator(); $('#threadActive').hidden = true; $('#threadEmpty').hidden = false; } }
  ];

  /* ---------------------------------------------------------------------------
     KHỞI TẠO
     --------------------------------------------------------------------------- */
  function renderOnlinePeople() {
    $('#onlinePeople').innerHTML = Object.values(P).filter((p) => p.online).map((p) => `
      <button class="person-pick" type="button" data-pick="${p.id}">${avatarHtml(p.name, 48, true)}<span>${esc(p.name.split(' ').slice(-2).join(' '))}</span></button>`).join('');
    $('#onlinePeople').onclick = (e) => { const b = e.target.closest('[data-pick]'); if (b) openChatWith(Object.values(P).find((p) => p.id === +b.dataset.pick)); };
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderConvList();
    renderOnlinePeople();
    M.segment(seg, $('.a-seg__btn[aria-selected="true"]', seg), { instant: true });
    syncRailBadge();
    const openId = +(params.get('userId') || 0);
    const start = CONVS.find((c) => c.person.id === openId) || (params.has('empty') ? null : CONVS[0]);
    if (start && !(isMobile() && !openId)) selectConv(start);
    if (params.has('drawer')) setDrawer(true);
    if (params.has('reply')) setReply(current.messages.find((x) => x.from === 'me' && !x.deleted));
    if (params.has('call')) setTimeout(() => startCall($('#startCallBtn')), 200);
    if (params.has('ring')) incomingCall(convByKey('linh'));
    if (params.has('offline')) connectionLost();
    if (params.has('requests')) $('[data-list="requestsList"]', seg).click();
    if (params.has('typing')) showTyping(current);
    renderIcons();
  });
  window.addEventListener('resize', () => { placeConvIndicator(true); M.segment(seg, $('.a-seg__btn[aria-selected="true"]', seg), { instant: true }); });
})();
