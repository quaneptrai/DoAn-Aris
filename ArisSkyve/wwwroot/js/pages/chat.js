/* =============================================================================
   ARIS LINE V7 — Chat / Tin nhắn (chat.js)
   - Real SignalR integration with window.ArisChat & VideoCallHub
   - Matches reference/chat.html, reference/chat.css, reference/chat-demo.js
   ============================================================================= */
(function () {
    'use strict';

    const M = window.ArisMotion || {
        animate: (el, kf, opt) => el.animate(kf, opt),
        flip: (c, fn) => fn(),
        indicator: (ind, target) => {
            if (!ind || !target) return;
            const r = target.getBoundingClientRect();
            const cr = ind.parentElement.getBoundingClientRect();
            ind.style.transform = `translateY(${r.top - cr.top}px)`;
            ind.style.height = `${r.height}px`;
            ind.style.opacity = '1';
        },
        toast: (msg) => { if (window.showToast) window.showToast(msg); else alert(msg); },
        morphButton: () => {},
        EASE_OUT: 'cubic-bezier(0.16, 1, 0.3, 1)',
        EASE_IN: 'cubic-bezier(0.7, 0, 0.84, 0)'
    };

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const isMobile = () => matchMedia('(max-width: 767px)').matches;

    const myUserId = window.__CURRENT_USER_ID__ || 0;
    const initialOpenUserId = window.__OPEN_USER_ID__;

    const chat = $('#chat');
    const box = $('#threadMessages');
    const input = $('#composerInput');
    const sendBtn = $('#sendBtn');
    const composerForm = $('#composerForm');
    const convList = $('#conversationList');
    const convIndEl = () => $('.a-indicator', convList);
    const jumpBtn = $('#jumpBtn');

    let conversations = [];
    let currentConv = null;
    let activeUserId = -1;
    let currentMessages = [];
    const messagesById = {};
    let replyingTo = null;
    let stagedImageFile = null;
    let forwardingMessageId = null;
    let typingTimeout = null;
    let lastTypingSent = 0;

    // --- Helpers ---
    function toneOf(name) {
        let h = 0;
        for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
        return (Math.abs(h) % 6) + 1;
    }

    function initials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /* Chữ viết tắt luôn nằm dưới ảnh: ảnh lỗi / ảnh "chữ cái" tự sinh bị ẩn thì vẫn còn chữ */
    function avatarHtml(name, size = 40, online = false, avatarUrl = null) {
        const dot = online ? ' data-online="true"' : '';
        const img = avatarUrl && !avatarUrl.includes('default-avatar.png')
            ? `<img src="${esc(avatarUrl)}" alt="" onerror="this.remove()">` : '';
        return `<span class="a-avatar a-avatar--${size}" style="--_s:${size}px" data-tone="${toneOf(name)}"${dot}>${esc(initials(name))}${img}</span>`;
    }
    /* Tên hiển thị: tên công ty / họ tên (máy chủ gửi displayName), không có thì tên đăng nhập */
    const nm = (o) => (o && (o.displayName || o.username)) || '';

    function renderIcons() {
        if (window.lucide && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
        }
    }

    const DAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const DAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const pad = (n) => String(n).padStart(2, '0');
    const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    function dayDiff(d) {
        const a = new Date(); a.setHours(0, 0, 0, 0);
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

    function parseDate(val) {
        if (!val) return new Date();
        const d = new Date(val);
        return isNaN(d.getTime()) ? new Date() : d;
    }

    // Google Drive direct-view URLs omit the source extension. New Drive video
    // uploads carry a client-only fragment set by the server; keep extension
    // detection for legacy/local media already stored in Message.ImageUrl.
    const isVideoUrl = (u) => /(?:\.(?:mp4|webm|mov|m4v)(?:\?|#|$)|[?#&]aris-media=video(?:[&#]|$))/i.test(String(u || ''));

    function snippetOf(m) {
        if (!m) return '';
        if (m.deleted) return 'Tin nhắn đã được thu hồi';
        if (m.imageUrl && !m.content) return isVideoUrl(m.imageUrl) ? 'Đã gửi một video' : 'Đã gửi một hình ảnh';
        return m.content || '';
    }

    /* "Xoá ở phía tôi": ẩn tin trên thiết bị này (lưu trong trình duyệt) */
    const HIDE_KEY = 'aris-chat-hidden-' + myUserId;
    const hiddenIds = new Set((() => { try { return JSON.parse(localStorage.getItem(HIDE_KEY) || '[]'); } catch (e) { return []; } })());
    const saveHidden = () => { try { localStorage.setItem(HIDE_KEY, JSON.stringify(Array.from(hiddenIds).slice(-500))); } catch (e) { /* bỏ qua */ } };

    function preview(c) {
        const s = c.lastMessage || '';
        return c.isMine ? `Bạn: ${s}` : s;
    }

    // --- Indicator ---
    function placeConvIndicator(instant) {
        const convInd = convIndEl();
        if (!convInd || !convInd.parentElement) return;
        const target = currentConv ? $(`#conv-${currentConv.userId}`) : null;
        if (target) {
            M.indicator(convInd, target, { instant });
        } else {
            convInd.style.opacity = '0';
        }
    }

    // --- Conversation List ---
    function convRowHtml(c) {
        const unread = c.unreadCount > 0;
        let trail = '';
        if (unread) {
            trail = `<span class="a-badge a-badge--accent a-num">${c.unreadCount}</span>`;
        } else if (c.isMine) {
            trail = `<span class="conv__receipt" title="Đã gửi"><i data-lucide="check"></i></span>`;
        }
        const d = parseDate(c.lastMessageAt);
        const isSelected = activeUserId === c.userId;

        return `<div class="a-row conv${unread ? ' a-row--unread' : ''}" role="option" tabindex="-1" aria-selected="${isSelected}" data-user-id="${c.userId}" id="conv-${c.userId}">
          ${avatarHtml(nm(c), 44, c.isOnline, c.avatar)}
          <div class="a-row__main">
            <div class="a-row__top"><span class="a-row__title">${esc(nm(c))}</span><span class="a-row__meta">${listTime(d)}</span></div>
            <div class="a-row__sub"><span>${esc(preview(c))}</span>${trail}</div>
          </div>
        </div>`;
    }

    function renderConvList() {
        const q = ($('#userSearchInput')?.value || '').trim().toLowerCase();
        const filtered = conversations.filter(c => !q || (nm(c) + ' ' + c.username).toLowerCase().includes(q));

        convList.innerHTML = `<span class="a-indicator" data-axis="y" data-inset="16"></span>` +
            (filtered.length === 0
                ? `<div class="a-empty"><i data-lucide="message-square"></i><div class="a-empty__title">${q ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có tin nhắn nào'}</div></div>`
                : filtered.map(convRowHtml).join(''));

        renderIcons();
        rovingInit();
        placeConvIndicator(true);
        updateOnlinePeople();
    }

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
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const uid = parseInt(rows[i].dataset.userId, 10);
            openThread(uid);
        }
    });

    convList.addEventListener('click', (e) => {
        const row = e.target.closest('.conv');
        if (row) {
            const uid = parseInt(row.dataset.userId, 10);
            openThread(uid, { focusComposer: !isMobile() });
        }
    });

    async function loadConversations() {
        try {
            const res = await fetch('/Chat/GetConversations');
            if (!res.ok) return;
            conversations = await res.json();
            renderConvList();
            syncRailBadge();
        } catch (e) {
            console.error('Failed to load conversations', e);
        }
    }

    function syncRailBadge() {
        const total = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);
        const b = $('#railChatBadge');
        if (!b) return;
        if (!total) {
            b.style.display = 'none';
        } else {
            b.style.display = 'inline-flex';
            b.textContent = total > 99 ? '99+' : total;
        }
    }

    function updateOnlinePeople() {
        const wrap = $('#onlinePeople');
        if (!wrap) return;
        const onlineConvs = conversations.filter(c => c.isOnline);
        if (!onlineConvs.length) {
            wrap.innerHTML = `<span class="text-muted small">Hiện không có bạn bè trực tuyến</span>`;
            return;
        }
        wrap.innerHTML = onlineConvs.slice(0, 6).map(c => `
          <button class="a-btn a-btn--ghost a-btn--sm" type="button" data-user-id="${c.userId}" style="gap:6px">
            ${avatarHtml(nm(c), 24, true, c.avatar)}
            <span>${esc(nm(c))}</span>
          </button>
        `).join('');
    }

    $('#onlinePeople')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-user-id]');
        if (btn) openThread(parseInt(btn.dataset.userId, 10));
    });

    // --- Message Rendering ---
    const GROUP_GAP = 5 * 60 * 1000;
    const posOf = (i, n) => (n === 1 ? 'single' : i === 0 ? 'first' : i === n - 1 ? 'last' : 'middle');

    function bubbleInner(m) {
        if (m.deleted) return null;
        let h = '';
        if (m.isForwarded) {
            h += '<div class="m-fwd"><i data-lucide="forward"></i>Đã chuyển tiếp</div>';
        }
        if (m.replyTo) {
            const o = m.replyTo;
            const isMe = o.senderId === myUserId;
            h += `<button type="button" class="m-quote" data-jump="${o.id}" aria-label="Xem tin được trả lời">
              <span class="m-quote__name">${isMe ? 'Bạn' : esc(nm(currentConv) || o.senderUsername || '')}</span>
              <span class="m-quote__text">${esc(o.content || (o.imageUrl ? (isVideoUrl(o.imageUrl) ? '[Video]' : '[Hình ảnh]') : ''))}</span>
            </button>`;
        }
        if (m.imageUrl && isVideoUrl(m.imageUrl)) {
            h += `<div class="m-media m-media--video">
              <video src="${esc(m.imageUrl)}${String(m.imageUrl).includes('#') ? '' : '#t=0.1'}" controls playsinline preload="metadata"></video>
              ${m.uploading ? `<span class="m-media__progress"><svg class="a-loader" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="3" fill="none"/></svg></span>` : ''}
            </div>`;
            if (m.content) h += `<div class="m-caption"><span class="m-text">${esc(m.content)}</span></div>`;
        } else if (m.imageUrl) {
            h += `<button type="button" class="m-media" data-lightbox="${m.id}" aria-label="Xem ảnh lớn">
              <img src="${esc(m.imageUrl)}" alt="${esc(m.content || 'Ảnh trong cuộc trò chuyện')}" style="--ar:4/3">
              ${m.uploading ? `<span class="m-media__progress"><svg class="a-loader" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="3" fill="none"/></svg></span>` : ''}
            </button>`;
            if (m.content) h += `<div class="m-caption"><span class="m-text">${esc(m.content)}</span></div>`;
        } else if (m.content) {
            h += `<span class="m-text">${esc(m.content)}</span>`;
        }
        return h;
    }

    const fullTime = (d) => `${hhmm(d)} · ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    function rowHtml(m, pos, receipt) {
        const mine = m.senderId === myUserId;
        const inner = bubbleInner(m);
        const d = parseDate(m.sentAt);
        const time = `<time class="m-time" datetime="${d.toISOString()}">${hhmm(d)}</time>`;
        const bubble = inner === null
            ? `<div class="m-bubble m-bubble--deleted" title="${fullTime(d)}">Tin nhắn đã được thu hồi</div>`
            : `<div class="m-bubble${m.imageUrl ? ' has-media' : ''}" title="${fullTime(d)}">${inner}${time}</div>`;

        const avatar = mine ? '' : `<div class="m-avatar">${pos === 'last' || pos === 'single' ? avatarHtml(currentConv ? nm(currentConv) : '', 32, false, currentConv ? currentConv.avatar : null) : ''}</div>`;

        const reactBtn = window.ArisReactions && ArisReactions.enabled() ? `<button type="button" data-act="react" data-id="${m.id}" data-tip="Thả cảm xúc" aria-label="Thả cảm xúc"><i data-lucide="smile-plus"></i></button>` : '';
        const actions = m.deleted ? '' : `<div class="m-actions">${reactBtn}
            <button type="button" data-act="reply" data-id="${m.id}" data-tip="Trả lời" aria-label="Trả lời"><i data-lucide="quote"></i></button>
            <button type="button" data-act="forward" data-id="${m.id}" data-tip="Chuyển tiếp" aria-label="Chuyển tiếp"><i data-lucide="forward"></i></button>
            <button type="button" data-act="more" data-id="${m.id}" data-tip="Thêm" aria-label="Thêm tuỳ chọn" aria-haspopup="menu"><i data-lucide="more-horizontal"></i></button>
          </div>`;

        let rc = '';
        if (receipt === 'seen') rc = `<div class="m-seen" title="Đã xem">${avatarHtml(currentConv ? nm(currentConv) : '', 16, false, currentConv ? currentConv.avatar : null)}</div>`;
        else if (receipt === 'sent') rc = '<div class="m-sent"><i data-lucide="check"></i>Đã gửi</div>';

        return `<div class="m-row m-row--${mine ? 'me' : 'them'} is-${pos}" data-id="${m.id}">
          ${avatar}<div class="m-stack">${bubble}${window.ArisReactions ? ArisReactions.chipsHtml(m, myUserId) : ''}${actions}${rc}</div>
        </div>`;
    }

    function groupsOf(msgs) {
        const out = [];
        let day = null;
        let g = null;
        msgs.forEach((m) => {
            const d = parseDate(m.sentAt);
            const dk = d.toDateString();
            if (dk !== day) {
                out.push({ type: 'day', label: dayLabel(d) });
                day = dk;
                g = null;
            }
            const senderKey = m.senderId === myUserId ? 'me' : 'them';
            if (!g || g.from !== senderKey || (d - g.last > GROUP_GAP)) {
                g = { type: 'group', from: senderKey, items: [], last: d };
                out.push(g);
            }
            g.items.push(m);
            g.last = d;
        });
        return out;
    }

    function renderThread(msgs, opts = {}) {
        let html = '';
        let open = false;
        const shown = msgs.filter((m) => !hiddenIds.has(m.id));
        const groups = groupsOf(shown);
        // Messenger: avatar tí hon dưới tin cuối cùng đối phương đã xem; tin cuối chưa xem → "Đã gửi"
        const mine = shown.filter((m) => m.senderId === myUserId && !m.deleted);
        const lastMine = mine[mine.length - 1];
        const lastSeen = [...mine].reverse().find((m) => m.isRead);
        const lastOverall = shown[shown.length - 1];
        const receipts = {};
        if (lastSeen) receipts[lastSeen.id] = 'seen';
        if (lastMine && !lastMine.isRead && lastOverall === lastMine) receipts[lastMine.id] = 'sent';
        const nearBottom = box ? (box.scrollHeight - box.scrollTop - box.clientHeight < 160) : true;

        for (const part of groups) {
            if (part.type === 'day') {
                if (open) html += '</section>';
                html += `<section class="m-dayblock"><div class="m-day"><span>${part.label}</span></div>`;
                open = true;
            } else {
                html += `<div class="m-group" data-from="${part.from}">${part.items.map((m, i) => rowHtml(m, posOf(i, part.items.length), receipts[m.id])).join('')}</div>`;
            }
        }
        if (open) html += '</section>';

        const prevTop = box.scrollTop;
        box.innerHTML = html;
        renderIcons();
        if (opts.keepScroll && !nearBottom) box.scrollTop = prevTop;
        else scrollToBottom(true);
        updateJump();
    }

    function scrollToBottom(instant = false) {
        if (!box) return;
        if (instant) {
            box.scrollTop = box.scrollHeight;
        } else {
            box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
        }
    }

    function updateJump() {
        if (!box || !jumpBtn) return;
        const dist = box.scrollHeight - box.scrollTop - box.clientHeight;
        jumpBtn.hidden = dist < 200;
    }

    box?.addEventListener('scroll', updateJump);
    jumpBtn?.addEventListener('click', () => scrollToBottom());

    // --- Open Thread ---
    async function openThread(userId, opts = {}) {
        if (userId === activeUserId && currentConv) {
            if (isMobile()) chat.dataset.view = 'thread';
            return;
        }

        activeUserId = userId;
        clearReply();
        clearImage();

        $('#threadEmpty').hidden = true;
        $('#threadActive').hidden = false;

        let conv = conversations.find(c => c.userId === userId);
        if (!conv) {
            conv = { userId, username: `Người dùng #${userId}`, avatar: '', unreadCount: 0, isOnline: false };
        }
        currentConv = conv;

        // Render Head
        $('#threadAvatar').innerHTML = avatarHtml(nm(conv), 36, conv.isOnline, conv.avatar);
        $('#threadUsername').textContent = nm(conv);
        setStatus(conv.isOnline ? 'online' : 'offline');

        $$('.conv', convList).forEach((r) => r.setAttribute('aria-selected', String(parseInt(r.dataset.userId, 10) === userId)));
        rovingInit();
        placeConvIndicator();

        box.innerHTML = `<div class="p-4 text-center text-muted"><svg class="a-loader" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="3" fill="none"/></svg></div>`;

        try {
            const res = await fetch(`/Chat/GetMessages?userId=${userId}`);
            if (!res.ok) throw new Error('Failed to load messages');
            const data = await res.json();

            if (data.partner) {
                currentConv.username = data.partner.username;
                currentConv.displayName = data.partner.displayName;
                currentConv.avatar = data.partner.avatar;
                currentConv.isOnline = data.partner.isOnline;
                $('#threadAvatar').innerHTML = avatarHtml(nm(conv), 36, conv.isOnline, conv.avatar);
                $('#threadUsername').textContent = nm(conv);
                setStatus(conv.isOnline ? 'online' : 'offline');
            }

            currentMessages = data.messages || [];
            currentMessages.forEach(m => { messagesById[m.id] = m; });
            renderThread(currentMessages);

            if (conv.unreadCount > 0) {
                conv.unreadCount = 0;
                renderConvList();
                window.ArisChat?.markRead(userId);
            }

            if (chat.dataset.drawer === 'open') fillDrawer();
        } catch (e) {
            console.error(e);
            box.innerHTML = `<div class="a-empty"><div class="a-empty__title">Không thể tải tin nhắn</div></div>`;
        }

        if (isMobile()) {
            chat.dataset.view = 'thread';
            M.animate($('#threadPane'), [{ transform: 'translateX(30%)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: M.EASE_OUT });
            scrollToBottom(true);
        }

        if (opts.focusComposer) input.focus({ preventScroll: true });

        const url = new URL(location);
        url.searchParams.set('userId', userId);
        history.replaceState(null, '', url);
    }

    function setStatus(state) {
        const st = $('#threadStatus');
        if (!st) return;
        st.dataset.state = state;
        st.textContent = state === 'typing' ? 'đang nhập…' : state === 'online' ? 'Đang hoạt động' : 'Ngoại tuyến';
    }

    // --- Back to list (Mobile) ---
    $('#backToConversations')?.addEventListener('click', () => {
        chat.dataset.view = 'list';
        $('#userSearchInput')?.focus();
    });

    // --- Drawer ---
    function toggleDrawer(open) {
        const next = open ?? (chat.dataset.drawer !== 'open');
        chat.dataset.drawer = next ? 'open' : 'closed';
        $('#drawerBtn')?.setAttribute('aria-pressed', String(next));
        if (next) fillDrawer();
    }

    $('#drawerBtn')?.addEventListener('click', () => toggleDrawer());
    $('#drawerClose')?.addEventListener('click', () => toggleDrawer(false));

    function fillDrawer() {
        if (!currentConv) return;
        $('#drawerAvatar').innerHTML = avatarHtml(nm(currentConv), 72, currentConv.isOnline, currentConv.avatar);
        $('#drawerName').textContent = nm(currentConv);
        $('#drawerStatus').textContent = currentConv.isOnline ? 'Đang hoạt động' : 'Ngoại tuyến';

        // Media
        const mediaMsgs = currentMessages.filter(m => m.imageUrl && !m.deleted && !isVideoUrl(m.imageUrl));
        $('#drawerMediaCount').textContent = `(${mediaMsgs.length})`;
        const mediaBox = $('#drawerMedia');
        if (mediaMsgs.length === 0) {
            mediaBox.innerHTML = '<div class="text-muted small" style="grid-column: 1 / -1; padding: 12px 0;">Chưa có ảnh nào được chia sẻ</div>';
        } else {
            mediaBox.innerHTML = mediaMsgs.map(m => `
              <button class="drawer-media__item" type="button" data-lightbox="${m.id}" aria-label="Xem ảnh">
                <img src="${esc(m.imageUrl)}" alt="">
              </button>
            `).join('');
        }
    }

    // Drawer Thread Search
    let threadSearchMatches = [];
    let currentMatchIndex = -1;

    $('#threadSearch')?.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        $$('.m-row.has-match', box).forEach(r => r.classList.remove('has-match', 'current-match'));
        if (!q) {
            $('#threadSearchNav').hidden = true;
            threadSearchMatches = [];
            currentMatchIndex = -1;
            return;
        }

        threadSearchMatches = currentMessages.filter(m => !m.deleted && (m.content || '').toLowerCase().includes(q));
        if (threadSearchMatches.length === 0) {
            $('#threadSearchNav').hidden = false;
            $('#threadSearchCount').textContent = '0 kết quả';
            currentMatchIndex = -1;
            return;
        }

        $('#threadSearchNav').hidden = false;
        currentMatchIndex = threadSearchMatches.length - 1;
        updateSearchNav();
    });

    function updateSearchNav() {
        if (currentMatchIndex < 0) return;
        $('#threadSearchCount').textContent = `${currentMatchIndex + 1}/${threadSearchMatches.length}`;
        const targetMsg = threadSearchMatches[currentMatchIndex];
        const row = $(`.m-row[data-id="${targetMsg.id}"]`, box);
        if (row) {
            $$('.m-row.current-match', box).forEach(r => r.classList.remove('current-match'));
            row.classList.add('has-match', 'current-match');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    $('#threadSearchPrev')?.addEventListener('click', () => {
        if (!threadSearchMatches.length) return;
        currentMatchIndex = (currentMatchIndex - 1 + threadSearchMatches.length) % threadSearchMatches.length;
        updateSearchNav();
    });

    $('#threadSearchNext')?.addEventListener('click', () => {
        if (!threadSearchMatches.length) return;
        currentMatchIndex = (currentMatchIndex + 1) % threadSearchMatches.length;
        updateSearchNav();
    });

    // --- Lightbox delegation ---
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-lightbox]');
        if (!btn) return;
        const msgId = parseInt(btn.dataset.lightbox, 10);
        const m = messagesById[msgId];
        if (m && m.imageUrl && !isVideoUrl(m.imageUrl)) {
            const imgs = currentMessages.filter((x) => x.imageUrl && !x.deleted && !isVideoUrl(x.imageUrl) && !hiddenIds.has(x.id));
            const idx = Math.max(0, imgs.indexOf(m));
            if (window.openLightbox) window.openLightbox(imgs.map((x) => ({ src: x.imageUrl, alt: x.content || '', caption: x.content || '' })), idx);
            else window.open(m.imageUrl, '_blank');
        }
    });

    // --- Message Jump (Quote) delegation ---
    box?.addEventListener('click', (e) => {
        const quote = e.target.closest('[data-jump]');
        if (quote) {
            const targetId = quote.dataset.jump;
            const targetRow = $(`.m-row[data-id="${targetId}"]`, box);
            if (targetRow) {
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetRow.classList.add('m-row--highlight');
                setTimeout(() => targetRow.classList.remove('m-row--highlight'), 1200);
            }
        }
    });

    // --- Reply Preview ---
    function setReplyingTo(m) {
        replyingTo = m;
        const name = m.senderId === myUserId ? 'chính mình' : (nm(currentConv) || 'đối phương');
        $('#replyPreviewName').textContent = name;
        $('#replyPreviewSnippet').textContent = snippetOf(m);
        $('#replyPreviewBar').dataset.open = 'true';
        input.focus();
    }

    function clearReply() {
        replyingTo = null;
        $('#replyPreviewBar').dataset.open = 'false';
    }

    $('#replyPreviewCancel')?.addEventListener('click', clearReply);

    // --- Image Preview ---
    const imagePickerBtn = $('#imagePickerBtn');
    const chatImageInput = $('#chatImageInput');

    imagePickerBtn?.addEventListener('click', () => chatImageInput?.click());

    chatImageInput?.addEventListener('change', () => {
        const file = chatImageInput.files[0];
        chatImageInput.value = '';
        if (!file) return;
        const isVid = (file.type || '').startsWith('video/');
        const maxMb = isVid ? 50 : 10;
        if (file.size > maxMb * 1024 * 1024) {
            M.toast(`Tệp quá lớn — tối đa ${maxMb} MB cho ${isVid ? 'video' : 'ảnh'}.`, { tone: 'danger' });
            return;
        }
        stagedImageFile = file;
        const url = URL.createObjectURL(file);
        const thumb = $('#imagePreviewThumb');
        const vthumb = $('#videoPreviewThumb');
        if (thumb) { thumb.hidden = isVid; if (!isVid) thumb.src = url; }
        if (vthumb) { vthumb.hidden = !isVid; if (isVid) vthumb.src = url; }
        const title = $('#imagePreviewTitle');
        if (title) title.textContent = isVid ? 'Video đính kèm' : 'Ảnh đính kèm';
        $('#imagePreviewName').textContent = file.name;
        $('#imagePreviewBar').dataset.open = 'true';
        checkSendBtnState();
        input.focus();
    });

    function clearImage() {
        stagedImageFile = null;
        $('#imagePreviewBar').dataset.open = 'false';
        checkSendBtnState();
    }

    $('#imagePreviewCancel')?.addEventListener('click', clearImage);

    // --- Composer Form ---
    function checkSendBtnState() {
        const hasText = input.value.trim().length > 0;
        const hasFile = stagedImageFile !== null;
        sendBtn.disabled = !(hasText || hasFile) || activeUserId <= 0;
    }

    input?.addEventListener('input', () => {
        checkSendBtnState();
        // Autosize
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';

        // Typing indicator
        if (activeUserId > 0) {
            const now = Date.now();
            if (now - lastTypingSent > 2000) {
                lastTypingSent = now;
                window.ArisChat?.typing(activeUserId);
            }
        }
    });

    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
            e.preventDefault();
            if (!sendBtn.disabled) {
                composerForm.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        }
    });

    composerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        const file = stagedImageFile;
        const replyId = replyingTo ? replyingTo.id : null;

        if ((!text && !file) || activeUserId <= 0) return;

        input.value = '';
        input.style.height = 'auto';
        clearReply();
        clearImage();
        checkSendBtnState();

        let uploadedUrl = null;
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await fetch('/Chat/UploadChatMedia', { method: 'POST', body: formData });
                const r = await res.json().catch(() => ({ success: false }));
                if (!r.success) {
                    M.toast(r.message || 'Không thể tải tệp lên.', { tone: 'danger' });
                    return;
                }
                uploadedUrl = r.url;
            } catch (err) {
                M.toast('Lỗi kết nối khi tải tệp lên.', { tone: 'danger' });
                return;
            }
        }

        try {
            await window.ArisChat?.send(activeUserId, text, replyId, uploadedUrl);
        } catch (err) {
            console.error('Send message failed:', err);
            M.toast('Không thể gửi tin nhắn.', { tone: 'danger' });
        }
    });

    // --- Message Context Actions (Reply, Forward, Delete, Copy) ---
    box?.addEventListener('click', (e) => {
        if (isMobile() && !e.target.closest('[data-act], .m-quote, .m-media, video, a')) {
            const row = e.target.closest('.m-row');
            $$('.m-row.is-active', box).forEach((r) => { if (r !== row) r.classList.remove('is-active'); });
            if (row) row.classList.toggle('is-active');
        }
        const chip = e.target.closest('.rx-chip');
        if (chip) { ArisChat.react(parseInt(chip.dataset.id, 10), chip.dataset.rx); return; }
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        const msgId = parseInt(btn.dataset.id, 10);
        const m = messagesById[msgId];
        if (!m) return;

        if (act === 'react') {
            ArisReactions.open(btn, m, myUserId, (emoji) => ArisChat.react(m.id, emoji));
        } else if (act === 'reply') {
            setReplyingTo(m);
        } else if (act === 'forward') {
            openForwardModal(m);
        } else if (act === 'more') {
            openMsgMenu(btn, m);
        }
    });

    function openMsgMenu(anchor, m) {
        const menu = $('#msgMenu');
        if (!menu) return;
        const isMe = m.senderId === myUserId;
        const row = anchor.closest('.m-row');

        menu.classList.add('m-menu');
        menu.innerHTML = `
          ${m.content ? '<button class="a-menu__item" type="button" role="menuitem" data-menu-act="copy"><i data-lucide="copy"></i>Sao chép tin nhắn</button>' : ''}
          <button class="a-menu__item" type="button" role="menuitem" data-menu-act="reply"><i data-lucide="quote"></i>Trả lời</button>
          <button class="a-menu__item" type="button" role="menuitem" data-menu-act="forward"><i data-lucide="forward"></i>Chuyển tiếp</button>
          ${m.imageUrl ? `<a class="a-menu__item" role="menuitem" href="${esc(m.imageUrl)}" download target="_blank" rel="noopener" data-menu-act="download"><i data-lucide="download"></i>Tải ${isVideoUrl(m.imageUrl) ? 'video' : 'ảnh'} về</a>` : ''}
          <button class="a-menu__item" type="button" role="menuitem" data-menu-act="details"><i data-lucide="info"></i>Xem chi tiết</button>
          <div class="a-menu__sep" role="separator"></div>
          ${isMe ? '<button class="a-menu__item a-menu__item--danger" type="button" role="menuitem" data-menu-act="delete"><i data-lucide="rotate-ccw"></i>Thu hồi với mọi người</button>' : ''}
          <button class="a-menu__item a-menu__item--danger" type="button" role="menuitem" data-menu-act="hide"><i data-lucide="trash-2"></i>Xoá chỉ ở phía tôi</button>
        `;
        renderIcons();

        const done = () => {
            if (row) row.classList.remove('is-menu');
            document.removeEventListener('click', outside, true);
            document.removeEventListener('keydown', onEsc, true);
        };
        const close = () => { menu.hidden = true; done(); };
        const outside = (ev) => { if (!menu.contains(ev.target) && !anchor.contains(ev.target)) close(); };
        const onEsc = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); anchor.focus(); } };

        if (row) row.classList.add('is-menu');
        menu.hidden = false;
        const rect = anchor.getBoundingClientRect();
        const mw = menu.offsetWidth || 248;
        const mh = menu.offsetHeight || 320;
        let left = isMe ? rect.right - mw : rect.left;
        left = Math.max(8, Math.min(window.innerWidth - mw - 8, left));
        let top = rect.bottom + 6;
        if (top + mh > window.innerHeight - 8) top = Math.max(8, rect.top - mh - 6);
        menu.style.position = 'fixed';
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        setTimeout(() => {
            document.addEventListener('click', outside, true);
            document.addEventListener('keydown', onEsc, true);
            menu.querySelector('.a-menu__item')?.focus({ preventScroll: true });
        }, 0);

        menu.onclick = async (ev) => {
            const item = ev.target.closest('[data-menu-act]');
            if (!item) return;
            const menuAct = item.dataset.menuAct;
            if (menuAct === 'download') { close(); return; }
            close();

            if (menuAct === 'copy') {
                if (m.content && navigator.clipboard) navigator.clipboard.writeText(m.content).catch(() => {});
                M.toast('Đã sao chép tin nhắn', { tone: 'success' });
            } else if (menuAct === 'reply') {
                setReplyingTo(m);
            } else if (menuAct === 'forward') {
                openForwardModal(m);
            } else if (menuAct === 'details') {
                const d = parseDate(m.sentAt);
                const who = isMe ? 'Bạn gửi' : `${nm(currentConv) || 'Đối phương'} gửi`;
                const state = isMe ? (m.isRead ? ' · Đã xem' : ' · Chưa xem') : '';
                M.toast(`${who} lúc ${fullTime(d)}${state}`);
            } else if (menuAct === 'hide') {
                hiddenIds.add(m.id);
                saveHidden();
                renderThread(currentMessages, { keepScroll: true });
                M.toast('Đã xoá tin nhắn ở phía bạn (trên thiết bị này).', {
                    action: { label: 'Hoàn tác', onClick: () => { hiddenIds.delete(m.id); saveHidden(); renderThread(currentMessages, { keepScroll: true }); } }
                });
            } else if (menuAct === 'delete') {
                try {
                    await window.ArisChat?.deleteMessage(m.id);
                    m.deleted = true;
                    renderThread(currentMessages, { keepScroll: true });
                } catch (e) {
                    M.toast('Không thể thu hồi tin nhắn', { tone: 'danger' });
                }
            }
        };
    }

    // --- Forward Dialog ---
    function openForwardModal(m) {
        forwardingMessageId = m.id;
        $('#forwardSnippet').textContent = snippetOf(m);
        renderForwardTargets();
        $('#forwardScrim').hidden = false;
        $('#forwardDialog').hidden = false;
    }

    function closeForwardModal() {
        $('#forwardScrim').hidden = true;
        $('#forwardDialog').hidden = true;
        forwardingMessageId = null;
    }

    $('#forwardDialog [data-close]')?.addEventListener('click', closeForwardModal);
    $('#forwardScrim')?.addEventListener('click', closeForwardModal);

    function renderForwardTargets() {
        const q = ($('#forwardSearch')?.value || '').trim().toLowerCase();
        const targets = conversations.filter(c => !q || (nm(c) + ' ' + c.username).toLowerCase().includes(q));
        const list = $('#forwardTargetList');
        if (!list) return;

        list.innerHTML = targets.length === 0
            ? '<div class="p-3 text-muted small">Không tìm thấy người nhận nào</div>'
            : targets.map(c => `
              <div class="a-row" style="cursor:pointer" data-forward-uid="${c.userId}">
                ${avatarHtml(nm(c), 36, c.isOnline, c.avatar)}
                <div class="a-row__main">
                  <div class="a-row__title">${esc(nm(c))}</div>
                </div>
                <button class="a-btn a-btn--secondary a-btn--sm" type="button">Gửi</button>
              </div>
            `).join('');
    }

    $('#forwardSearch')?.addEventListener('input', renderForwardTargets);

    $('#forwardTargetList')?.addEventListener('click', async (e) => {
        const row = e.target.closest('[data-forward-uid]');
        if (!row || !forwardingMessageId) return;
        const targetUid = parseInt(row.dataset.forwardUid, 10);
        closeForwardModal();
        try {
            await window.ArisChat?.forward(targetUid, forwardingMessageId);
            M.toast('Đã chuyển tiếp tin nhắn');
        } catch (err) {
            M.toast('Lỗi chuyển tiếp tin nhắn', { tone: 'danger' });
        }
    });

    // --- Network Tabs (Chats · Friends · Requests) ---
    const networkTabs = $('#networkTabs');
    const friendsListEl = $('#friendsList');
    const requestsListEl = $('#requestsList');
    const requestsBadge = $('#requestsBadge');

    networkTabs?.addEventListener('click', (e) => {
        const btn = e.target.closest('.a-seg__btn');
        if (!btn) return;
        $$('.a-seg__btn', networkTabs).forEach(b => b.setAttribute('aria-selected', 'false'));
        btn.setAttribute('aria-selected', 'true');

        const listId = btn.dataset.list;
        convList.hidden = listId !== 'conversationList';
        friendsListEl.hidden = listId !== 'friendsList';
        requestsListEl.hidden = listId !== 'requestsList';

        if (listId === 'friendsList') loadFriends();
        if (listId === 'requestsList') loadRequests();
    });

    async function loadFriends() {
        friendsListEl.innerHTML = '<div class="p-3 text-muted small"><svg class="a-loader" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="3" fill="none"/></svg></div>';
        try {
            const res = await fetch('/Friends/GetFriends');
            const friends = await res.json();
            friendsListEl.innerHTML = friends.length === 0
                ? '<div class="a-empty"><div class="a-empty__title">Chưa có bạn bè nào</div><div class="a-empty__text">Tìm kiếm để kết bạn với những người khác</div></div>'
                : friends.map(f => `
                  <div class="a-row" data-user-id="${f.userId}">
                    ${avatarHtml(nm(f), 40, f.isOnline, f.avatar)}
                    <div class="a-row__main">
                      <div class="a-row__title">${esc(nm(f))}</div>
                    </div>
                    <button class="a-btn a-btn--secondary a-btn--sm" type="button" data-friend-chat>Nhắn tin</button>
                    <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-friend-remove title="Hủy kết bạn"><i data-lucide="user-minus"></i></button>
                  </div>
                `).join('');
            renderIcons();
        } catch (e) {
            friendsListEl.innerHTML = '<div class="p-3 text-muted small">Không thể tải danh sách bạn bè</div>';
        }
    }

    friendsListEl?.addEventListener('click', async (e) => {
        const row = e.target.closest('[data-user-id]');
        if (!row) return;
        const uid = parseInt(row.dataset.userId, 10);

        if (e.target.closest('[data-friend-remove]')) {
            if (confirm('Hủy kết bạn với người này?')) {
                const body = new URLSearchParams({ userId: uid });
                await fetch('/Friends/RemoveFriend', { method: 'POST', body });
                loadFriends();
            }
            return;
        }

        openThread(uid, { focusComposer: true });
    });

    async function loadRequests() {
        requestsListEl.innerHTML = '<div class="p-3 text-muted small"><svg class="a-loader" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="3" fill="none"/></svg></div>';
        try {
            const [friendsRes, invitationsRes] = await Promise.all([
                fetch('/Friends/GetPendingRequests').then(r => r.json()),
                fetch('/JobApplications/GetInterviewInvitations').then(r => r.json())
            ]);

            const invitations = invitationsRes.invitations || [];
            const pendingInvs = invitations.filter(i => i.response === 'Pending');
            const total = friendsRes.incoming.length + pendingInvs.length;

            if (requestsBadge) {
                requestsBadge.textContent = total;
                requestsBadge.style.display = total > 0 ? 'inline-flex' : 'none';
            }

            let html = '';
            if (invitations.length > 0) {
                html += '<div class="chat-list__section">Lời mời phỏng vấn</div>';
                html += invitations.map(inv => `
                  <div class="a-card p-3 mb-2" style="margin: 0 4px">
                    <div class="d-flex align-items-center gap-2 mb-2">
                      <span class="a-avatar a-avatar--36">${esc((inv.companyName || 'C')[0])}</span>
                      <div>
                        <div class="fw-semibold small">${esc(inv.jobTitle)}</div>
                        <div class="text-muted" style="font-size:12px">${esc(inv.companyName)}</div>
                      </div>
                    </div>
                    <div class="small text-muted mb-2"><i data-lucide="calendar"></i> ${inv.isAiInterview ? 'Phỏng vấn AI · hạn ' : ''}${new Date(inv.interviewAt).toLocaleString('vi-VN')}</div>
                    ${inv.isAiInterview ? `
                      <a class="a-btn a-btn--primary a-btn--sm" href="/InterviewKit/Application/${inv.id}"><i data-lucide="bot"></i> Làm phỏng vấn AI</a>
                    ` : inv.response === 'Pending' ? `
                      <div class="d-flex gap-2">
                        <button class="a-btn a-btn--primary a-btn--sm" type="button" data-inv-respond="1" data-id="${inv.id}">Chấp nhận</button>
                        <button class="a-btn a-btn--secondary a-btn--sm" type="button" data-inv-respond="0" data-id="${inv.id}">Từ chối</button>
                      </div>
                    ` : `<span class="a-badge">${inv.response === 'Accepted' ? 'Đã nhận lời' : 'Đã từ chối'}</span>`}
                  </div>
                `).join('');
            }

            if (friendsRes.incoming.length > 0) {
                html += '<div class="chat-list__section">Lời mời kết bạn</div>';
                html += friendsRes.incoming.map(r => `
                  <div class="a-row">
                    ${avatarHtml(nm(r), 36, false, r.avatar)}
                    <div class="a-row__main"><div class="a-row__title">${esc(nm(r))}</div></div>
                    <div class="d-flex gap-1">
                      <button class="a-btn a-btn--primary a-btn--sm" type="button" data-friend-req="accept" data-req-id="${r.requestId}">Đồng ý</button>
                      <button class="a-btn a-btn--secondary a-btn--sm" type="button" data-friend-req="decline" data-req-id="${r.requestId}">Xoá</button>
                    </div>
                  </div>
                `).join('');
            }

            requestsListEl.innerHTML = html || '<div class="a-empty"><div class="a-empty__title">Không có lời mời nào</div></div>';
            renderIcons();
        } catch (e) {
            requestsListEl.innerHTML = '<div class="p-3 text-muted small">Không thể tải lời mời</div>';
        }
    }

    requestsListEl?.addEventListener('click', async (e) => {
        const reqBtn = e.target.closest('[data-friend-req]');
        if (reqBtn) {
            const act = reqBtn.dataset.friendReq;
            const reqId = reqBtn.dataset.reqId;
            const url = act === 'accept' ? '/Friends/AcceptRequest' : '/Friends/DeclineRequest';
            const body = new URLSearchParams({ requestId: reqId });
            await fetch(url, { method: 'POST', body });
            loadRequests();
            return;
        }

        const invBtn = e.target.closest('[data-inv-respond]');
        if (invBtn) {
            const accept = invBtn.dataset.invRespond === '1';
            const appId = invBtn.dataset.id;
            await fetch(`/JobApplications/RespondToInterview?applicationId=${appId}&accept=${accept}`, { method: 'POST' });
            loadRequests();
        }
    });

    // --- Search Users Input ---
    let searchDebounce = null;
    $('#userSearchInput')?.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(async () => {
            const q = e.target.value.trim();
            renderConvList();
            if (q.length > 1) {
                try {
                    const res = await fetch(`/Chat/SearchUsers?q=${encodeURIComponent(q)}`);
                    const users = await res.json();
                    if (users.length > 0) {
                        const hitsHtml = `<div class="chat-list__section">Người dùng khác</div>` +
                            users.map(u => `
                              <div class="a-row" data-user-id="${u.id}">
                                ${avatarHtml(nm(u), 36, false, u.avatar)}
                                <div class="a-row__main">
                                  <div class="a-row__title">${esc(nm(u))}</div>
                                </div>
                                <button class="a-btn a-btn--secondary a-btn--sm" type="button">Nhắn tin</button>
                              </div>
                            `).join('');
                        convList.insertAdjacentHTML('beforeend', hitsHtml);
                        renderIcons();
                    }
                } catch (err) {}
            }
        }, 300);
    });

    // --- Video Call Implementation ---
    (function setupVideoCall() {
        const videoHub = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/videocall')
            .withAutomaticReconnect()
            .build();

        const incomingToast = $('#incomingCallToast');
        const incomingAvatar = $('#incomingCallAvatar');
        const incomingName = $('#incomingCallName');
        const incomingAccept = $('#incomingCallAccept');
        const incomingDecline = $('#incomingCallDecline');

        const callOverlay = $('#callOverlay');
        const callOverlayName = $('#callOverlayName');
        const callOverlayStatus = $('#callOverlayStatus');
        const callRemoteVideo = $('#callRemoteVideo');
        const callRemotePlaceholder = $('#callRemotePlaceholder');
        const callLocalVideo = $('#callLocalVideo');
        const callToggleMicBtn = $('#callToggleMicBtn');
        const callToggleCamBtn = $('#callToggleCamBtn');
        const callLeaveBtn = $('#callLeaveBtn');
        const startCallBtn = $('#startCallBtn');
        const drawerCallBtn = $('#drawerCall');

        let pc = null;
        let localStream = null;
        let callState = 'idle'; // idle | ringing-out | ringing-in | active
        let callPeerId = null;
        let callPeerName = '';
        let makingOffer = false;
        let ignoreOffer = false;
        let announceInterval = null;

        function partnerDisplay(uid) {
            const c = conversations.find(x => x.userId === uid);
            return { name: c ? nm(c) : `Người dùng #${uid}`, avatar: (c && c.avatar) || '' };
        }

        function resetCallUI() {
            callState = 'idle';
            callPeerId = null;
            if (announceInterval) { clearInterval(announceInterval); announceInterval = null; }
            if (callOverlay) callOverlay.hidden = true;
            if (incomingToast) incomingToast.hidden = true;
            if (callRemoteVideo) callRemoteVideo.srcObject = null;
            if (callRemotePlaceholder) callRemotePlaceholder.style.display = 'grid';
            if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
            if (pc) { pc.close(); pc = null; }
        }

        let iceCache = null;
        async function getIce() {
            if (iceCache) return iceCache;
            try {
                const res = await fetch('/Turn/GetIceServers').then(r => r.json());
                iceCache = res.iceServers;
            } catch {
                iceCache = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
            }
            return iceCache;
        }

        async function createPC(otherId) {
            const polite = myUserId < otherId;
            const p = new RTCPeerConnection({ iceServers: await getIce() });
            p._polite = polite;

            p.onnegotiationneeded = async () => {
                try {
                    makingOffer = true;
                    await p.setLocalDescription();
                    videoHub.invoke('SendChatSignal', otherId, { description: p.localDescription }).catch(console.error);
                } catch (err) {
                    console.error(err);
                } finally {
                    makingOffer = false;
                }
            };

            p.onicecandidate = ({ candidate }) => {
                if (candidate) videoHub.invoke('SendChatSignal', otherId, { candidate }).catch(console.error);
            };

            p.ontrack = (evt) => {
                if (callRemoteVideo) callRemoteVideo.srcObject = evt.streams[0];
                if (callRemotePlaceholder) callRemotePlaceholder.style.display = 'none';
            };

            p.onconnectionstatechange = () => {
                if (p.connectionState === 'connected') {
                    if (callOverlayStatus) callOverlayStatus.textContent = 'Đã kết nối';
                    if (announceInterval) { clearInterval(announceInterval); announceInterval = null; }
                } else if (p.connectionState === 'disconnected' || p.connectionState === 'failed') {
                    if (callOverlayStatus) callOverlayStatus.textContent = 'Mất kết nối...';
                }
            };

            return p;
        }

        async function acquireMedia() {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (callLocalVideo) callLocalVideo.srcObject = localStream;
        }

        async function startCall() {
            if (activeUserId <= 0 || callState !== 'idle') return;
            const info = partnerDisplay(activeUserId);
            callPeerId = activeUserId;
            callPeerName = info.name;
            callState = 'ringing-out';

            if (callOverlayName) callOverlayName.textContent = info.name;
            if (callOverlayStatus) callOverlayStatus.textContent = 'Đang gọi…';
            if (callOverlay) callOverlay.hidden = false;

            try {
                await acquireMedia();
            } catch {
                M.toast('Vui lòng cho phép truy cập camera và micro.', { tone: 'danger' });
                resetCallUI();
                return;
            }

            pc = await createPC(callPeerId);
            localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

            videoHub.invoke('JoinChatCall', callPeerId).catch(console.error);
            announceInterval = setInterval(() => {
                if (!pc || pc.connectionState === 'connected') { clearInterval(announceInterval); announceInterval = null; return; }
                videoHub.invoke('JoinChatCall', callPeerId).catch(() => {});
            }, 3000);
        }

        function showIncoming(fromId) {
            if (callState !== 'idle') return;
            callState = 'ringing-in';
            callPeerId = fromId;
            const info = partnerDisplay(fromId);
            callPeerName = info.name;
            if (incomingAvatar) incomingAvatar.innerHTML = avatarHtml(info.name, 44, false, info.avatar);
            if (incomingName) incomingName.textContent = info.name;
            if (incomingToast) incomingToast.hidden = false;
        }

        async function acceptCall() {
            if (incomingToast) incomingToast.hidden = true;
            const otherId = callPeerId;
            callState = 'active';

            if (callOverlayName) callOverlayName.textContent = callPeerName;
            if (callOverlayStatus) callOverlayStatus.textContent = 'Đang kết nối…';
            if (callOverlay) callOverlay.hidden = false;

            try {
                await acquireMedia();
            } catch {
                M.toast('Vui lòng cho phép truy cập camera và micro.', { tone: 'danger' });
                videoHub.invoke('DeclineChatCall', otherId).catch(() => {});
                resetCallUI();
                return;
            }

            pc = await createPC(otherId);
            localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
            videoHub.invoke('JoinChatCall', otherId).catch(console.error);
        }

        function declineCall() {
            if (callPeerId != null) videoHub.invoke('DeclineChatCall', callPeerId).catch(() => {});
            resetCallUI();
        }

        function leaveCall() {
            if (callPeerId != null) videoHub.invoke('LeaveChatCall', callPeerId).catch(() => {});
            resetCallUI();
        }

        videoHub.on('PeerJoined', (roomId, fromId) => {
            if (callState === 'idle') { showIncoming(fromId); return; }
            if (fromId !== callPeerId) return;
            if (callOverlayStatus) callOverlayStatus.textContent = 'Đang kết nối…';
            if (pc && pc.signalingState === 'stable') pc.onnegotiationneeded();
        });

        videoHub.on('ReceiveSignal', async (roomId, fromId, signal) => {
            if (!pc || fromId !== callPeerId) return;
            try {
                if (signal.description) {
                    const collision = signal.description.type === 'offer' && (makingOffer || pc.signalingState !== 'stable');
                    ignoreOffer = !pc._polite && collision;
                    if (ignoreOffer) return;

                    await pc.setRemoteDescription(signal.description);
                    if (signal.description.type === 'offer') {
                        await pc.setLocalDescription();
                        videoHub.invoke('SendChatSignal', fromId, { description: pc.localDescription }).catch(console.error);
                    }
                } else if (signal.candidate) {
                    try {
                        await pc.addIceCandidate(signal.candidate);
                    } catch (err) {
                        if (!ignoreOffer) console.error(err);
                    }
                }
            } catch (err) {
                console.error(err);
            }
        });

        videoHub.on('PeerLeft', () => {
            if (callPeerId == null) return;
            if (callOverlayStatus) callOverlayStatus.textContent = `${callPeerName} đã rời cuộc gọi`;
            setTimeout(resetCallUI, 1500);
        });

        videoHub.on('CallDeclined', () => {
            if (callOverlayStatus) callOverlayStatus.textContent = `${callPeerName} đã từ chối cuộc gọi`;
            setTimeout(resetCallUI, 1500);
        });

        startCallBtn?.addEventListener('click', startCall);
        drawerCallBtn?.addEventListener('click', startCall);
        incomingAccept?.addEventListener('click', acceptCall);
        incomingDecline?.addEventListener('click', declineCall);
        callLeaveBtn?.addEventListener('click', leaveCall);

        callToggleMicBtn?.addEventListener('click', () => {
            if (!localStream) return;
            const t = localStream.getAudioTracks()[0];
            if (!t) return;
            t.enabled = !t.enabled;
            callToggleMicBtn.setAttribute('aria-pressed', String(!t.enabled));
        });

        callToggleCamBtn?.addEventListener('click', () => {
            if (!localStream) return;
            const t = localStream.getVideoTracks()[0];
            if (!t) return;
            t.enabled = !t.enabled;
            callToggleCamBtn.setAttribute('aria-pressed', String(!t.enabled));
        });

        videoHub.start().catch(err => console.warn('Video call hub not available:', err));
        window.addEventListener('beforeunload', () => {
            if (callPeerId != null) videoHub.invoke('LeaveChatCall', callPeerId).catch(() => {});
        });
    })();

    // --- SignalR Message & Presence Handlers ---
    if (window.ArisChat) {
        ArisChat.onMessage((msg) => {
            messagesById[msg.id] = msg;
            if (msg.senderId === activeUserId || msg.receiverId === activeUserId) {
                currentMessages.push(msg);
                renderThread(currentMessages, { keepScroll: msg.senderId !== myUserId });
                if (msg.senderId === activeUserId) {
                    ArisChat.markRead(activeUserId);
                }
            }
            loadConversations();
        });

        ArisChat.onRead((readerId) => {
            if (readerId !== activeUserId) return;
            let changed = false;
            currentMessages.forEach((m) => { if (m.senderId === myUserId && !m.isRead) { m.isRead = true; changed = true; } });
            if (changed) renderThread(currentMessages, { keepScroll: true });
        });

        ArisChat.onTyping((fromUserId) => {
            if (fromUserId !== activeUserId) return;
            setStatus('typing');
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                setStatus(currentConv?.isOnline ? 'online' : 'offline');
            }, 2000);
        });

        ArisChat.onPresence((userId, isOnline) => {
            const conv = conversations.find(c => c.userId === userId);
            if (conv) {
                conv.isOnline = isOnline;
                renderConvList();
            }
            if (userId === activeUserId && currentConv) {
                currentConv.isOnline = isOnline;
                setStatus(isOnline ? 'online' : 'offline');
            }
        });

        if (ArisChat.onReaction) ArisChat.onReaction((update) => {
            if (window.ArisReactions && ArisReactions.apply(messagesById, update)) renderThread(currentMessages, { keepScroll: true });
        });

        ArisChat.onDeleted((messageId) => {
            const m = messagesById[messageId];
            if (m) {
                m.deleted = true;
                const row = $(`.m-row[data-id="${messageId}"]`, box);
                if (row) {
                    row.outerHTML = rowHtml(m, 'single');
                    renderIcons();
                }
            }
            loadConversations();
        });

        ArisChat.onConnectionState((state) => {
            const banner = $('#connBanner');
            const bannerMsg = $('#connBannerMsg');
            if (!banner) return;
            if (state === 'reconnecting') {
                bannerMsg.textContent = 'Mất kết nối. Đang thử kết nối lại…';
                banner.dataset.open = 'true';
            } else if (state === 'disconnected') {
                bannerMsg.textContent = 'Đã ngắt kết nối với máy chủ.';
                banner.dataset.open = 'true';
            } else if (state === 'connected') {
                banner.dataset.open = 'false';
            }
        });

        // Initialize Chat connection
        ArisChat.start().then(() => {
            loadConversations().then(() => {
                if (initialOpenUserId) {
                    openThread(initialOpenUserId);
                }
            });
            loadRequests();

            // Liên kết thẳng tới tab: /Chat?tab=friends | /Chat?tab=requests (sidebar "Mạng lưới kết nối", thông báo lời mời)
            const tab = new URLSearchParams(location.search).get('tab') || new URLSearchParams(location.search).get('networkTab');
            const tabList = { friends: 'friendsList', requests: 'requestsList' }[tab];
            if (tabList) $(`#networkTabs [data-list="${tabList}"]`)?.click();
        });
    }

    // Alt + Up / Down keyboard navigation between conversations
    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            if (!conversations.length) return;
            const curIdx = conversations.findIndex(c => c.userId === activeUserId);
            let nextIdx = 0;
            if (curIdx >= 0) {
                nextIdx = e.key === 'ArrowDown'
                    ? (curIdx + 1) % conversations.length
                    : (curIdx - 1 + conversations.length) % conversations.length;
            }
            openThread(conversations[nextIdx].userId);
        }
    });

})();
