/* ARIS — gắn bảng emoji đầy đủ vào ô soạn tin của trang Tin nhắn (xem js/aris-emoji-picker.js) */
import { attachEmojiPicker } from '/js/aris-emoji-picker.js';

attachEmojiPicker(document.getElementById('emojiPickerBtn'), document.getElementById('composerInput'));
