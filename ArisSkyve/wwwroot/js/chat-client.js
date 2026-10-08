// Thin wrapper around the /hubs/chat SignalR connection, shared by the full
// messenger page (Chat/Index) and the floating chat bubble widget so both
// stay in sync off a single connection-ish contract.
window.ArisChat = (function () {
    let connection = null;
    let startPromise = null;

    const handlers = {
        message: [],
        presence: [],
        typing: [],
        read: [],
        notification: [],
        deleted: [],
        reaction: [],
        newPost: [],
        connectionState: []
    };

    let lastConnectionState = 'disconnected';

    function emitConnectionState(state) {
        lastConnectionState = state;
        handlers.connectionState.forEach(fn => fn(state));
    }

    function build() {
        connection = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/chat')
            .withAutomaticReconnect()
            .build();

        connection.on('ReceiveMessage', (msg) => handlers.message.forEach(fn => fn(msg)));
        connection.on('PresenceChanged', (userId, isOnline) => handlers.presence.forEach(fn => fn(userId, isOnline)));
        connection.on('UserTyping', (userId) => handlers.typing.forEach(fn => fn(userId)));
        connection.on('MessagesRead', (userId) => handlers.read.forEach(fn => fn(userId)));
        connection.on('ReceiveNotification', (n) => handlers.notification.forEach(fn => fn(n)));
        connection.on('MessageDeleted', (messageId) => handlers.deleted.forEach(fn => fn(messageId)));
        connection.on('MessageReactionChanged', (update) => handlers.reaction.forEach(fn => fn(update)));
        connection.on('NewPost', (post) => handlers.newPost.forEach(fn => fn(post)));
        connection.onreconnecting(() => emitConnectionState('reconnecting'));
        connection.onreconnected(() => emitConnectionState('connected'));
        connection.onclose(() => {
            startPromise = null;
            emitConnectionState('disconnected');
        });
    }

    function start() {
        if (!connection) build();
        if (!startPromise) {
            emitConnectionState('connecting');
            startPromise = connection.start()
                .then(() => {
                    emitConnectionState('connected');
                    return connection;
                })
                .catch(err => {
                    console.error('Chat connection failed:', err);
                    startPromise = null;
                    emitConnectionState('disconnected');
                });
        }
        return startPromise;
    }

    async function ensureConnected() {
        await start();
        if (connection.state !== signalR.HubConnectionState.Connected) {
            await start();
        }
    }

    return {
        start,
        onMessage: (fn) => handlers.message.push(fn),
        onPresence: (fn) => handlers.presence.push(fn),
        onTyping: (fn) => handlers.typing.push(fn),
        onRead: (fn) => handlers.read.push(fn),
        onNotification: (fn) => handlers.notification.push(fn),
        onDeleted: (fn) => handlers.deleted.push(fn),
        onReaction: (fn) => handlers.reaction.push(fn),
        onNewPost: (fn) => handlers.newPost.push(fn),
        onConnectionState: (fn) => {
            handlers.connectionState.push(fn);
            fn(lastConnectionState);
        },
        getConnectionState: () => lastConnectionState,
        async send(receiverId, content, replyToMessageId, imageUrl) {
            await ensureConnected();
            return connection.invoke('SendMessage', receiverId, content, replyToMessageId ?? null, imageUrl ?? null);
        },
        async forward(receiverId, sourceMessageId) {
            await ensureConnected();
            return connection.invoke('ForwardMessage', receiverId, sourceMessageId);
        },
        async deleteMessage(messageId) {
            await ensureConnected();
            return connection.invoke('DeleteMessage', messageId);
        },
        async react(messageId, emoji) {
            await ensureConnected();
            return connection.invoke('ToggleReaction', messageId, emoji).catch(() => false);
        },
        async typing(receiverId) {
            await ensureConnected();
            return connection.invoke('Typing', receiverId).catch(() => {});
        },
        async markRead(otherUserId) {
            await ensureConnected();
            return connection.invoke('MarkAsRead', otherUserId).catch(() => {});
        },
        async isOnline(userId) {
            await ensureConnected();
            return connection.invoke('IsOnline', userId).catch(() => false);
        }
    };
})();

// Emoji picker + ":shortcode" autocomplete, shared by the full messenger page
// and the floating chat-head widget so both composers behave identically.
window.ArisChatEmoji = (function () {
    const EMOJIS = [
        ['smile', '😄'], ['laughing', '😆'], ['blush', '😊'], ['heart_eyes', '😍'], ['joy', '😂'],
        ['rofl', '🤣'], ['wink', '😉'], ['thinking', '🤔'], ['sob', '😭'], ['cry', '😢'],
        ['angry', '😠'], ['rage', '😡'], ['scream', '😱'], ['confused', '😕'], ['neutral', '😐'],
        ['sleepy', '😴'], ['sunglasses', '😎'], ['kiss', '😘'], ['heart', '❤️'], ['broken_heart', '💔'],
        ['thumbsup', '👍'], ['thumbsdown', '👎'], ['clap', '👏'], ['pray', '🙏'], ['ok_hand', '👌'],
        ['muscle', '💪'], ['wave', '👋'], ['fire', '🔥'], ['tada', '🎉'], ['star', '⭐'],
        ['sparkles', '✨'], ['100', '💯'], ['check', '✅'], ['x', '❌'], ['eyes', '👀'],
        ['ghost', '👻'], ['skull', '💀'], ['robot', '🤖'], ['poop', '💩'], ['unamused', '😒'],
        ['smirk', '😏'], ['yum', '😋'], ['rocket', '🚀'], ['coffee', '☕'], ['pizza', '🍕'],
        ['beer', '🍺'], ['gift', '🎁'], ['sun', '☀️'], ['moon', '🌙'], ['rainbow', '🌈'],
        ['party', '🥳'], ['clown', '🤡']
    ];

    let stylesInjected = false;
    function injectStyles() {
        if (stylesInjected) return;
        stylesInjected = true;
        const style = document.createElement('style');
        style.id = 'aris-emoji-styles';
        style.textContent = `
            .aris-emoji-autocomplete, .aris-emoji-picker {
                position: absolute;
                bottom: calc(100% + 6px);
                left: 0;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 6px 24px rgba(0,0,0,0.18);
                z-index: 4200;
                display: none;
            }
            .aris-emoji-autocomplete {
                min-width: 180px;
                max-width: 260px;
                overflow: hidden;
                padding: 4px 0;
            }
            .aris-emoji-suggestion {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                cursor: pointer;
                font-size: 13px;
            }
            .aris-emoji-suggestion-char { font-size: 16px; }
            .aris-emoji-suggestion-name { color: #6b7280; }
            .aris-emoji-suggestion.active, .aris-emoji-suggestion:hover {
                background: #f3f4f6;
            }
            .aris-emoji-picker {
                width: 232px;
                max-height: 200px;
                overflow-y: auto;
                grid-template-columns: repeat(8, 1fr);
                padding: 8px;
                gap: 2px;
            }
            .aris-emoji-item {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 26px;
                height: 26px;
                font-size: 17px;
                border-radius: 6px;
                cursor: pointer;
            }
            .aris-emoji-item:hover { background: #f3f4f6; }
        `;
        document.head.appendChild(style);
    }

    function matches(prefix) {
        const p = prefix.toLowerCase();
        return EMOJIS.filter(([name]) => name.startsWith(p)).slice(0, 6);
    }

    function buildPickerGrid() {
        return EMOJIS.map(([name, char]) =>
            `<span class="aris-emoji-item" data-emoji="${char}" title=":${name}:">${char}</span>`
        ).join('');
    }

    // Wires ":shortcode" autocomplete and an optional emoji-picker button onto a text input.
    // `container` should be position:relative (forced below) so the popups anchor correctly.
    function attach(input, { container, pickerBtn } = {}) {
        injectStyles();
        const anchor = container || input.parentElement;
        if (getComputedStyle(anchor).position === 'static') {
            anchor.style.position = 'relative';
        }

        const dropdown = document.createElement('div');
        dropdown.className = 'aris-emoji-autocomplete';
        anchor.appendChild(dropdown);

        let activeMatches = [];
        let tokenStart = -1;

        function closeDropdown() {
            dropdown.style.display = 'none';
            activeMatches = [];
            tokenStart = -1;
        }

        function currentToken() {
            const caret = input.selectionStart;
            const value = input.value;
            const upToCaret = value.slice(0, caret);
            const colonIdx = upToCaret.lastIndexOf(':');
            if (colonIdx === -1) return null;
            const token = upToCaret.slice(colonIdx + 1);
            if (token.length === 0 || /\s/.test(token)) return null;
            return { start: colonIdx, text: token };
        }

        function renderDropdown() {
            const tok = currentToken();
            if (!tok) { closeDropdown(); return; }
            activeMatches = matches(tok.text);
            tokenStart = tok.start;
            if (activeMatches.length === 0) { closeDropdown(); return; }
            dropdown.innerHTML = activeMatches.map(([name, char], i) => `
                <div class="aris-emoji-suggestion${i === 0 ? ' active' : ''}" data-index="${i}">
                    <span class="aris-emoji-suggestion-char">${char}</span><span class="aris-emoji-suggestion-name">:${name}:</span>
                </div>`).join('');
            dropdown.style.display = 'block';
        }

        function applySuggestion(index) {
            const match = activeMatches[index];
            if (!match || tokenStart < 0) return;
            const [, char] = match;
            const caret = input.selectionStart;
            const value = input.value;
            input.value = value.slice(0, tokenStart) + char + ' ' + value.slice(caret);
            const newCaret = tokenStart + char.length + 1;
            closeDropdown();
            input.focus();
            input.setSelectionRange(newCaret, newCaret);
        }

        input.addEventListener('input', renderDropdown);
        input.addEventListener('keydown', (e) => {
            if (dropdown.style.display === 'none') return;
            const activeEl = dropdown.querySelector('.aris-emoji-suggestion.active');
            let idx = activeEl ? parseInt(activeEl.dataset.index) : 0;
            if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, activeMatches.length - 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); }
            else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySuggestion(idx); return; }
            else if (e.key === 'Escape') { closeDropdown(); return; }
            else return;
            dropdown.querySelectorAll('.aris-emoji-suggestion').forEach(el => el.classList.remove('active'));
            dropdown.children[idx].classList.add('active');
        });
        dropdown.addEventListener('mousedown', (e) => {
            const item = e.target.closest('.aris-emoji-suggestion');
            if (!item) return;
            e.preventDefault();
            applySuggestion(parseInt(item.dataset.index));
        });
        input.addEventListener('blur', () => setTimeout(closeDropdown, 150));

        if (pickerBtn) {
            const picker = document.createElement('div');
            picker.className = 'aris-emoji-picker';
            picker.innerHTML = buildPickerGrid();
            anchor.appendChild(picker);

            picker.addEventListener('mousedown', (e) => {
                const item = e.target.closest('.aris-emoji-item');
                if (!item) return;
                e.preventDefault();
                const start = input.selectionStart ?? input.value.length;
                const end = input.selectionEnd ?? input.value.length;
                input.value = input.value.slice(0, start) + item.dataset.emoji + input.value.slice(end);
                const newCaret = start + item.dataset.emoji.length;
                input.focus();
                input.setSelectionRange(newCaret, newCaret);
                picker.style.display = 'none';
            });

            pickerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const willShow = picker.style.display !== 'grid';
                picker.style.display = willShow ? 'grid' : 'none';
                if (willShow) closeDropdown();
            });
            document.addEventListener('click', (e) => {
                if (picker.style.display === 'grid' && !picker.contains(e.target) && e.target !== pickerBtn) {
                    picker.style.display = 'none';
                }
            });
        }
    }

    return { attach };
})();
