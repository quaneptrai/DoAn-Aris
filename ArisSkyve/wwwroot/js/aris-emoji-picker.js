/* =============================================================================
   ARIS — Bảng emoji đầy đủ dùng chung (trang Tin nhắn + khung chat nổi) — 27/09/2026
   emoji-picker-element 1.29, tự lưu trữ ở wwwroot/lib/emoji-picker-element: giao diện tiếng Việt,
   dữ liệu CLDR tiếng Việt (tìm "tim", "cười", "chó"…), ~1.800 emoji, màu da, emoji dùng gần đây.
   Dùng: import { attachEmojiPicker, toggleEmojiPicker } from '/js/aris-emoji-picker.js'
   ============================================================================= */
import '/lib/emoji-picker-element/index.js';
import vi from '/lib/emoji-picker-element/i18n/vi.js';

let pop = null;
let picker = null;
let current = null; // { btn, input }

const theme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

function ensure() {
    if (picker) return;
    pop = document.createElement('div');
    pop.className = 'emoji-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Chọn emoji');
    pop.hidden = true;
    picker = document.createElement('emoji-picker');
    picker.i18n = vi;
    picker.locale = 'vi';
    picker.dataSource = '/lib/emoji-picker-element/data-vi.json';
    picker.classList.add(theme());
    pop.appendChild(picker);
    document.body.appendChild(pop);
    picker.addEventListener('emoji-click', (e) => { if (current) insert(current.input, e.detail.unicode); });
    new MutationObserver(() => {
        picker.classList.remove('dark', 'light');
        picker.classList.add(theme());
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('resize', () => { if (!pop.hidden && current) place(current.btn); });
}

function insert(input, text) {
    if (!input || !text) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const pos = start + text.length;
    input.focus({ preventScroll: true });
    try { input.setSelectionRange(pos, pos); } catch (e) { /* input type khác */ }
    input.dispatchEvent(new Event('input', { bubbles: true })); // bật nút Gửi + tự giãn
}

function place(btn) {
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth || 368;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w));
    pop.style.left = left + 'px';
    pop.style.bottom = Math.max(8, window.innerHeight - r.top + 8) + 'px';
}

const outside = (e) => {
    if (!current) return;
    if (!pop.contains(e.target) && !current.btn.contains(e.target)) closeEmojiPicker();
};
const onEsc = (e) => {
    if (e.key === 'Escape' && current) {
        e.stopPropagation();
        const input = current.input;
        closeEmojiPicker();
        input && input.focus();
    }
};

export function closeEmojiPicker() {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    if (current) {
        current.btn.setAttribute('aria-expanded', 'false');
        current.btn.classList.remove('is-on');
    }
    current = null;
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', onEsc, true);
}

export function toggleEmojiPicker(btn, input) {
    ensure();
    if (!pop.hidden && current && current.btn === btn) { closeEmojiPicker(); return; }
    closeEmojiPicker();
    current = { btn, input };
    pop.hidden = false;
    place(btn);
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.add('is-on');
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', onEsc, true);
    setTimeout(() => picker.shadowRoot?.querySelector('input[type="search"]')?.focus(), 60);
}

export function attachEmojiPicker(btn, input) {
    if (!btn || !input || btn.dataset.emojiAttached) return;
    btn.dataset.emojiAttached = '1';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleEmojiPicker(btn, input);
    });
}
