// Emoji reactions on chat messages, shared by the chat page and the bubble widget.
// Each participant has one reaction per message: same emoji again removes it.
window.ArisReactions = (function () {
    const QUICK = ['👍', '❤️', '😆', '😮', '😢', '😡'];
    const MORE = ['🔥', '👏', '🙏', '💯', '🎉', '😍', '🤔', '😅', '🥲', '😎', '🤝', '✅', '👀', '💪', '🙌', '😂', '🥰', '😴'];
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const enabled = () => !!(window.ArisFeatures && window.ArisFeatures.chatReactions);

    function chipsHtml(m, myId) {
        const list = (m && !m.deleted && m.reactions) || [];
        if (!list.length) return '';
        const groups = new Map();
        list.forEach((r) => {
            const g = groups.get(r.emoji) || { n: 0, mine: false };
            g.n++;
            if (r.userId === myId) g.mine = true;
            groups.set(r.emoji, g);
        });
        return `<div class="rx-chips">${[...groups].map(([e, g]) =>
            `<button type="button" class="rx-chip${g.mine ? ' is-mine' : ''}" data-rx="${esc(e)}" data-id="${m.id}" title="${g.mine ? 'Bấm để bỏ cảm xúc' : 'Thả cùng cảm xúc'}"><span class="rx-chip__e">${esc(e)}</span>${g.n > 1 ? g.n : ''}</button>`
        ).join('')}</div>`;
    }

    let bar = null;
    function close() {
        if (!bar) return;
        bar.remove();
        bar = null;
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('keydown', onKey, true);
    }
    function outside(e) { if (bar && !bar.contains(e.target)) close(); }
    function onKey(e) { if (e.key === 'Escape') close(); }

    function place(anchor) {
        const r = anchor.getBoundingClientRect();
        const w = bar.offsetWidth, h = bar.offsetHeight;
        bar.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
        bar.style.top = (r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8) + 'px';
    }

    // Quick bar above the message; "+" swaps in a wider set.
    function open(anchor, m, myId, onPick) {
        close();
        const mine = ((m.reactions || []).find((r) => r.userId === myId) || {}).emoji;
        const btn = (e) => `<button type="button" data-e="${esc(e)}" class="${e === mine ? 'is-mine' : ''}" aria-label="Thả ${esc(e)}">${esc(e)}</button>`;
        bar = document.createElement('div');
        bar.className = 'rx-bar';
        bar.setAttribute('role', 'menu');
        bar.innerHTML = QUICK.map(btn).join('') + '<button type="button" class="rx-bar__more" data-more aria-label="Thêm cảm xúc">＋</button>';
        document.body.appendChild(bar);
        place(anchor);
        bar.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-more')) {
                bar.style.flexWrap = 'wrap';
                bar.style.maxWidth = '300px';
                bar.style.borderRadius = '18px';
                bar.innerHTML = QUICK.concat(MORE).map(btn).join('');
                place(anchor);
                return;
            }
            close();
            onPick(b.dataset.e);
        });
        setTimeout(() => {
            document.addEventListener('pointerdown', outside, true);
            document.addEventListener('keydown', onKey, true);
        });
    }

    // Applies a server update to the message cache; returns the message if it is loaded.
    function apply(messagesById, update) {
        const m = update && messagesById[update.messageId];
        if (!m) return null;
        m.reactions = update.reactions || [];
        return m;
    }

    return { QUICK, enabled, chipsHtml, open, close, apply };
})();
