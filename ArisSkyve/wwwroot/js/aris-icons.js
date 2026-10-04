/* =============================================================================
   ARIS ORBIT — bộ SVG riêng, v2 (04/10/2026)
   Nạp NGAY SAU lib/lucide/lucide.min.js. Ghi đè bản vẽ trong lucide.icons, nên mọi
   <i data-lucide="home"> (kể cả nội dung chèn động gọi lucide.createIcons()) đều ra icon Aris.
   Tên nào chưa có trong bộ này vẫn dùng bản vẽ Lucide, cùng độ dày nét (aris-line.css).

   Quy ước vẽ: lưới 24, nét tròn 1.7, góc cắt mềm, lớp mực 10%.
   Điểm quỹ đạo và các khoảng hở là dấu nhận diện; hình vẫn rõ ở 16px.
   - .ai-dot   "chấm hoàng hôn" — lấy từ chấm cam trên đỉnh logo Aris; mục đang chọn → màu cam.
   - .ai-fill  lớp tô 10%, đậm hơn khi mục đang chọn / đã bật.
   - .ai-solid chấm đặc luôn tô (dấu …, mắt, chấm câu).
   - .ai-knock nét "đục" màu nền (dấu tích trong huy hiệu xác minh).
   ============================================================================= */
(function () {
    'use strict';
    var L = window.lucide;
    if (!L || !L.icons) return;

    var BASE = {
        xmlns: 'http://www.w3.org/2000/svg', width: 24, height: 24, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-aris': 'orbit',
        focusable: 'false'
    };

    function p(d) { return ['path', { d: d }]; }
    function fill(d) { return ['path', { d: d, 'class': 'ai-fill' }]; }
    function c(cx, cy, r) { return ['circle', { cx: cx, cy: cy, r: r }]; }
    function dot(cx, cy, r) { return ['circle', { cx: cx, cy: cy, r: r || 1.4, 'class': 'ai-dot' }]; }
    function solid(cx, cy, r) { return ['circle', { cx: cx, cy: cy, r: r || 1.2, 'class': 'ai-solid' }]; }
    function r(x, y, w, h, rx, cls) {
        var a = { x: x, y: y, width: w, height: h, rx: rx };
        if (cls) a['class'] = cls;
        return ['rect', a];
    }

    /* Hình dùng lại */
    var HOUSE = 'M4 10.5 10.6 4a2 2 0 0 1 2.8 0l5.2 5.1A4.7 4.7 0 0 1 20 12.5V17a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 17z';
    var DOC = 'M8 3.5h6l5.5 5.5v7.5a4 4 0 0 1-4 4H8A3.5 3.5 0 0 1 4.5 17V7A3.5 3.5 0 0 1 8 3.5z';
    var DOC_FOLD = 'M14 3.5V7a2 2 0 0 0 2 2h3.5';
    var BUBBLE = 'M12 3.8h1.5a7 7 0 0 1 7 7v.7a7 7 0 0 1-7 7H10l-5.5 2 .9-4.7a7 7 0 0 1-1.9-4.8v-.2a7 7 0 0 1 7-7z';
    var HEART = 'M12 20.2s-8-4.7-8-10.3A4.5 4.5 0 0 1 8.5 5.4c1.5 0 2.7.7 3.5 1.9.8-1.2 2-1.9 3.5-1.9A4.5 4.5 0 0 1 20 9.9c0 5.6-8 10.3-8 10.3z';
    var PIN = 'M12 21s-6.6-5.7-6.6-11.1a6.6 6.6 0 0 1 13.2 0C18.6 15.3 12 21 12 21z';
    var CAL_BODY = r(3.5, 5, 17, 15.5, 3.2);
    var SEARCH_LENS = c(10.8, 10.8, 6.4);
    var CIRCLE = c(12, 12, 8.8);
    var CAL_TOP = p('M8 3.2v3.6M16 3.2v3.6M3.5 10h17');

    var ICONS = {
        /* ---------- Điều hướng ---------- */
        'home,house': [fill(HOUSE), p(HOUSE), p('M9 20.5v-5a3 3 0 0 1 3-3h1.5'), dot(15.8, 12.5, 1.35)],
        'briefcase,briefcase-business': [
            fill('M3.5 11.5v5a4 4 0 0 0 4 4h9a4 4 0 0 0 4-4v-5L12 15z'),
            r(3.5, 7, 17, 13.5, 4), p('M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7'),
            p('m3.5 11.5 6 2.5M14.5 14l6-2.5'), dot(12, 14.8, 1.4)
        ],
        'file-text': [fill(DOC), p(DOC), p(DOC_FOLD), dot(8.5, 8.2, 1.3), p('M8.5 12.5h7M8.5 16h4.5')],
        'file-check,file-check-2': [fill(DOC), p(DOC), p(DOC_FOLD), dot(9.3, 9.6, 1.35), p('m8.9 15 2.1 2.1 4.2-4.3')],
        'file-plus,file-plus-2': [p(DOC), p(DOC_FOLD), p('M12 11.2v6M9 14.2h6')],
        'message-circle': [fill(BUBBLE), p(BUBBLE), p('M7.5 10h5M7.5 13.5h2.5'), dot(16, 10, 1.4)],
        'message-square,messages-square': [
            fill('M5.5 4h13A2.5 2.5 0 0 1 21 6.5v8.2a2.5 2.5 0 0 1-2.5 2.5H10l-4.6 3.3v-3.3h.1A2.5 2.5 0 0 1 3 14.7V6.5A2.5 2.5 0 0 1 5.5 4z'),
            p('M5.5 4h13A2.5 2.5 0 0 1 21 6.5v8.2a2.5 2.5 0 0 1-2.5 2.5H10l-4.6 3.3v-3.3h.1A2.5 2.5 0 0 1 3 14.7V6.5A2.5 2.5 0 0 1 5.5 4z'),
            dot(12, 10.6, 1.25)
        ],
        'users,users-round': [
            fill('M3 19.5a6 6 0 0 1 12 0z'), c(9, 7.5, 3),
            p('M3 19.5a6 6 0 0 1 12 0M16 14a5 5 0 0 1 5 5.5M16 5.5a3 3 0 0 1 0 6'), dot(17.7, 18.5, 1.3)
        ],
        'building-2,building': [
            fill('M4 20.5V7a2 2 0 0 1 1.5-2l8-2V20.5z'),
            p('M4 20.5V7a2 2 0 0 1 1.5-2l8-2v17.5M13.5 9h4a3 3 0 0 1 3 3v8.5M3 20.5h18'),
            p('M8 8.5h1.5M8 12h1.5M8 15.5h1.5M16.8 13h.2'), dot(17, 17, 1.25)
        ],
        'calendar,calendar-days': [
            r(3.5, 5, 17, 15.5, 3.2, 'ai-fill'), CAL_BODY, p('M8 3.2v3.6M16 3.2v3.6M3.5 10h17'),
            p('M7.8 14h3M7.8 17h3'), dot(15.6, 15.5, 1.7)
        ],
        'compass': [p('M20.5 10a8.7 8.7 0 1 1-6.5-6.5'), fill('m15.5 8.5-2 5-5 2 2-5z'), p('m15.5 8.5-2 5-5 2 2-5z'), dot(18.2, 5.8, 1.5)],
        'gauge': [fill('M4 17a8.5 8.5 0 0 1 16 0z'), p('M4 17a8.5 8.5 0 1 1 16 0M7 20h10M6.5 9l1 1M12 6.5V8'), p('m12 15 4-4'), dot(12, 15, 1.7)],
        'search': [fill('M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0'), p('M16.8 9a6.5 6.5 0 1 1-4.4-4.7M15.2 15.2l5.3 5.3'), dot(16, 5, 1.35)],
        'search-x': [SEARCH_LENS, p('m15.6 15.6 4.8 4.8'), p('m8.6 8.6 4.4 4.4M13 8.6l-4.4 4.4')],
        'bell,bell-ring': [
            fill('M12 4a6 6 0 0 0-6 6v3l-2 4c5 2 11 2 16 0l-2-4v-3a6 6 0 0 0-6-6z'),
            p('M12 4a6 6 0 0 0-6 6v3l-2 4c5 2 11 2 16 0l-2-4v-2M10 21h4'), dot(17.5, 5.5, 1.6)
        ],
        'settings,settings-2,sliders-horizontal': [
            p('M4 7h8.6M17.4 7H20M4 12h2.6M11.4 12H20M4 17h8.6M17.4 17H20'),
            c(15, 7, 2.2), dot(9, 12, 2.2), c(15, 17, 2.2)
        ],
        'moon': [fill('M20.2 14.6A8.2 8.2 0 1 1 9.4 3.8a6.6 6.6 0 0 0 10.8 10.8z'), p('M20.2 14.6A8.2 8.2 0 1 1 9.4 3.8a6.6 6.6 0 0 0 10.8 10.8z'), dot(17.4, 5.4, 1.2)],
        'sun': [['circle', { cx: 12, cy: 12, r: 4, 'class': 'ai-fill' }], c(12, 12, 4), p('M12 2.8v1.9M12 19.3v1.9M2.8 12h1.9M19.3 12h1.9M5.5 5.5l1.35 1.35M17.15 17.15l1.35 1.35M5.5 18.5l1.35-1.35M17.15 6.85l1.35-1.35')],
        'sun-moon': [c(12, 12, 4), p('M12 2.8v1.9M12 19.3v1.9M2.8 12h1.9M19.3 12h1.9')],
        'circle-user,circle-user-round,user-circle': [p('M20.5 10a8.7 8.7 0 1 1-6.5-6.5'), c(11.5, 9.5, 2.8), fill('M6 18.5a6 6 0 0 1 11 0z'), p('M6 18.5a6 6 0 0 1 11 0'), dot(18.2, 5.8, 1.5)],
        'user,user-round': [c(12, 8, 3.8), p('M4.6 20.5c.8-3.9 3.8-6.3 7.4-6.3s6.6 2.4 7.4 6.3')],
        'user-plus,user-round-plus': [c(9.5, 8, 3.6), p('M3.4 20c.6-3.6 3-5.8 6.1-5.8 1.4 0 2.7.45 3.7 1.3'), p('M18 9.2v6M15 12.2h6')],
        'user-minus': [c(9.5, 8, 3.6), p('M3.4 20c.6-3.6 3-5.8 6.1-5.8 1.4 0 2.7.45 3.7 1.3'), p('M15 12.2h6')],
        'user-search': [c(10, 8, 3.6), p('M3.4 20c.6-3.5 3-5.7 6.3-5.8'), c(16.4, 16, 2.9), p('m18.5 18.1 2.2 2.2')],
        'log-out': [p('M9.5 20.5h-3a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h3'), p('M16 16.5 20.5 12 16 7.5M20.5 12h-11')],
        'log-in': [p('M14.5 3.5h3a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-3'), p('M10 16.5 14.5 12 10 7.5M14.5 12h-11')],

        /* ---------- Hành động ---------- */
        'plus': [p('M12 5v14M5 12h14')],
        'minus': [p('M5 12h14')],
        'plus-square,square-plus': [r(3.5, 3.5, 17, 17, 5.2, 'ai-fill'), r(3.5, 3.5, 17, 17, 5.2), p('M12 8.4v7.2M8.4 12h7.2')],
        'x': [p('M6.5 6.5l11 11M17.5 6.5l-11 11')],
        'check': [p('m5 12.6 4.4 4.4L19 7.4')],
        'heart': [fill(HEART), p(HEART), p('M7 9.8a1.8 1.8 0 0 1 1.8-1.8')],
        'bookmark': [fill('M8 3.5h8a3 3 0 0 1 3 3v14L12 17l-7 3.5v-14a3 3 0 0 1 3-3z'), p('M8 3.5h8a3 3 0 0 1 3 3v14L12 17l-7 3.5v-14a3 3 0 0 1 3-3z'), p('M9 7.5h6')],
        'send': [fill('m10 13 3.5 7.5L21 3z'), p('m21 3-7.5 17.5L10 13 3.5 10zM10 13l5-5')],
        'send-horizontal': [p('M4 4.5 20.5 12 4 19.5l2.6-7.5z'), p('M6.6 12h7')],
        'share-2,share,upload-cloud': [
            p('M8.2 10H6.8A1.8 1.8 0 0 0 5 11.8v6.4A1.8 1.8 0 0 0 6.8 20h10.4a1.8 1.8 0 0 0 1.8-1.8v-6.4a1.8 1.8 0 0 0-1.8-1.8h-1.4'),
            p('M12 3.6v10.2M8.6 7 12 3.6 15.4 7')
        ],
        'more-horizontal,ellipsis': [solid(6, 12, 1.5), solid(12, 12, 1.5), solid(18, 12, 1.5)],
        'more-vertical,ellipsis-vertical': [solid(12, 6, 1.5), solid(12, 12, 1.5), solid(12, 18, 1.5)],
        'trash-2,trash': [p('M4.5 6.5h15'), p('M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5'), p('m6.5 6.5.9 12.2a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.9-12.2'), p('M10 10.5v6M14 10.5v6')],
        'pencil,pen': [p('M15.2 4.6a2 2 0 0 1 2.8 0l1.4 1.4a2 2 0 0 1 0 2.8L9 19.2l-4.6 1.2 1.2-4.6z'), p('m13.8 6 4.2 4.2')],
        'pen-line': [p('M14.6 4.4a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L9.2 17.8l-4.2 1 1-4.2z'), p('M13 20.5h7')],
        'square-pen,edit,pencil-line,file-pen': [p('M12 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V12'), p('M17.6 3.9a1.9 1.9 0 0 1 2.7 2.7l-7.6 7.6-3.6.9.9-3.6z')],
        'copy': [p('M8 8V6.5A2.5 2.5 0 0 1 10.5 4h7A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H16'), r(4, 8, 12, 12, 2.5)],
        'link,link-2': [p('M10 14a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.2 1.2'), p('M14 10a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.2-1.2')],
        'external-link': [p('M13.5 4.5h6v6M19.5 4.5l-8 8'), p('M17.5 13.8v3.7a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h3.7')],
        'upload': [p('M12 15.5V4.5M7.5 9 12 4.5 16.5 9'), p('M4.5 15.5v2A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-2')],
        'download': [p('M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5'), p('M4.5 15.5v2A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-2')],
        'refresh-cw,refresh-ccw': [p('M20 11.5a8 8 0 0 0-14.3-4.3L4 9M4 4.5V9h4.5'), p('M4 12.5a8 8 0 0 0 14.3 4.3L20 15M20 19.5V15h-4.5')],
        'rotate-ccw,undo-2': [p('M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9'), p('M4.5 4.5V9H9')],
        'eye': [p('M2.8 12s3.4-6.5 9.2-6.5S21.2 12 21.2 12s-3.4 6.5-9.2 6.5S2.8 12 2.8 12z'), c(12, 12, 2.8), dot(12, 12, 1)],
        'eye-off': [p('M9.9 5.7A9.7 9.7 0 0 1 12 5.5c5.8 0 9.2 6.5 9.2 6.5a16 16 0 0 1-2.3 3.2M6.4 7.3C4.1 8.9 2.8 12 2.8 12s3.4 6.5 9.2 6.5a9 9 0 0 0 4.7-1.3'), p('M9.9 9.9a2.9 2.9 0 0 0 4.2 4.2'), p('m4 4 16 16')],
        'image,image-plus': [
            r(3.5, 4.5, 17, 15, 3.2, 'ai-fill'), r(3.5, 4.5, 17, 15, 3.2),
            p('m3.9 17.2 4.6-4.6a1.6 1.6 0 0 1 2.2 0l7.6 7.4'), p('m13.9 15.3 1.5-1.5a1.6 1.6 0 0 1 2.2 0l2.9 2.9'), dot(15.5, 9, 1.6)
        ],
        'images': [r(6.5, 3.5, 14, 12.5, 2.6), p('M3.5 8v9.5a3 3 0 0 0 3 3H16'), p('m6.8 13 3.4-3.4a1.4 1.4 0 0 1 2 0l3.8 3.8'), dot(16.4, 7.4, 1.3)],
        'camera': [p('M4 8.5a2 2 0 0 1 2-2h1.8l1.4-2h5.6l1.4 2H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z'), c(12, 13.2, 3.4), dot(17.1, 9.6, 1)],
        'video': [r(3, 6, 13, 12, 3, 'ai-fill'), r(3, 6, 13, 12, 3), p('m16 10.4 4.1-2.5a.6.6 0 0 1 .9.5v7.2a.6.6 0 0 1-.9.5L16 13.6'), dot(7, 9.6, 1.2)],
        'play-circle,circle-play': [CIRCLE, p('M10 8.9v6.2a.6.6 0 0 0 .9.5l4.9-3.1a.6.6 0 0 0 0-1L10.9 8.4a.6.6 0 0 0-.9.5z')],
        'zap': [fill('M13.2 3.2 5.5 13.4h5.8l-1 7.4 7.7-10.2h-5.8z'), p('M13.2 3.2 5.5 13.4h5.8l-1 7.4 7.7-10.2h-5.8z')],
        'sparkles,sparkle,wand-sparkles': [
            p('M11 3.5c.5 4 2.6 6.1 6.5 6.6-3.9.5-6 2.6-6.5 6.6-.5-4-2.6-6.1-6.5-6.6 3.9-.5 6-2.6 6.5-6.6z'),
            p('M18.4 14.6c.25 1.5 1 2.3 2.4 2.5-1.4.2-2.15 1-2.4 2.5-.25-1.5-1-2.3-2.4-2.5 1.4-.2 2.15-1 2.4-2.5z'),
            dot(5.4, 18.6, 1.2)
        ],
        'flame': [p('M12 21a6.2 6.2 0 0 0 6.2-6.2c0-3.7-2.6-5.5-3.7-8.8-.4 1.6-1.2 2.8-2.5 3.5.1-2.7-.9-4.9-3-6.5.3 3.3-3.2 5.4-3.2 9.8A6.2 6.2 0 0 0 12 21z'), dot(12, 16.6, 1.5)],
        'star': [fill('m12 3.6 2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z'), p('m12 3.6 2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z')],
        'award,medal': [c(12, 9.2, 5.3), p('m8.7 13.3-1.5 7.2 4.8-2.6 4.8 2.6-1.5-7.2'), dot(12, 9.2, 1.7)],
        'trending-up': [p('m3.5 16.5 5.5-5.5 4 4 7.5-7.5'), p('M15 7.5h5.5V13')],
        'quote': [p('M5 11h4.4v5.6H5v-5.2c0-3 1.2-4.9 3.8-5.9'), p('M14.6 11H19v5.6h-4.4v-5.2c0-3 1.2-4.9 3.8-5.9')],
        'lightbulb': [p('M9 17.5h6M9.8 20.5h4.4'), p('M8.6 14.6A6.2 6.2 0 1 1 15.4 14.6c-.6.5-.9 1.2-.9 2v.9H9.5v-.9c0-.8-.3-1.5-.9-2z'), dot(12, 9.6, 1.3)],

        /* ---------- Thông tin / trạng thái ---------- */
        'map-pin': [fill(PIN), p(PIN), dot(12, 9.9, 2.1)],
        'clock,clock-3,clock-4,timer': [CIRCLE, p('M12 7.4V12l3.1 1.9'), dot(12, 12, .95)],
        'wallet,banknote,coins': [
            r(3.5, 6, 17, 14, 3.2), p('M20.5 10.2h-3.8a2.3 2.3 0 0 0 0 4.6h3.8'), dot(16.9, 12.5, 1.15),
            p('M6.4 6 15 3.8a1.6 1.6 0 0 1 2 1.5V6')
        ],
        'layers,layers-3': [fill('m12 3.8 8.5 4.4-8.5 4.4-8.5-4.4z'), p('m12 3.8 8.5 4.4-8.5 4.4-8.5-4.4z'), p('m3.5 12.4 8.5 4.4 8.5-4.4'), p('m3.5 16.3 8.5 4.4 8.5-4.4')],
        'globe,globe-2': [CIRCLE, p('M12 3.2c2.4 2.4 3.6 5.4 3.6 8.8s-1.2 6.4-3.6 8.8c-2.4-2.4-3.6-5.4-3.6-8.8S9.6 5.6 12 3.2z'), p('M3.4 12h17.2')],
        'mail': [r(3.5, 5.5, 17, 13, 3, 'ai-fill'), r(3.5, 5.5, 17, 13, 3), p('m4.3 7.4 7 5.1a1.2 1.2 0 0 0 1.4 0l7-5.1')],
        'mail-check': [r(3, 5, 15, 11.5, 2.6), p('m3.7 6.8 6.1 4.4a1.1 1.1 0 0 0 1.4 0L17.3 6.8'), p('m14.6 18.4 1.9 1.9 3.9-4')],
        'at-sign': [c(12, 12, 3.8), p('M15.8 8.2v4.9a2.4 2.4 0 0 0 4.8 0V12a8.6 8.6 0 1 0-3.4 6.9')],
        'inbox': [p('M3.5 13.5 6 6.3A2 2 0 0 1 7.9 5h8.2A2 2 0 0 1 18 6.3l2.5 7.2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z'), p('M3.5 13.5h4.3l1.4 2.2h5.6l1.4-2.2h4.3')],
        'newspaper': [r(4, 4, 16, 16, 3.2), p('M8 8.5h8M8 12h8M8 15.5h4.8')],
        'badge-check,badge,verified': [
            ['rect', { x: 5.3, y: 5.3, width: 13.4, height: 13.4, rx: 3.4, fill: 'currentColor', stroke: 'none' }],
            ['rect', { x: 5.3, y: 5.3, width: 13.4, height: 13.4, rx: 3.4, fill: 'currentColor', stroke: 'none', transform: 'rotate(45 12 12)' }],
            ['path', { d: 'm8.7 12.2 2.3 2.3 4.3-4.6', 'class': 'ai-knock', 'stroke-width': 2.1 }]
        ],
        'shield-check': [p('M12 3.5 5 6.1v5.5c0 4.4 3 7.6 7 8.9 4-1.3 7-4.5 7-8.9V6.1z'), p('m9 12 2.1 2.1 4-4.1')],
        'shield': [p('M12 3.5 5 6.1v5.5c0 4.4 3 7.6 7 8.9 4-1.3 7-4.5 7-8.9V6.1z')],
        'check-circle-2,check-circle,circle-check,circle-check-big': [CIRCLE, p('m8.4 12.3 2.4 2.4 4.9-5')],
        'x-circle,circle-x': [CIRCLE, p('m9 9 6 6M15 9l-6 6')],
        'alert-circle,circle-alert': [CIRCLE, p('M12 7.6v5'), solid(12, 16.3, 1.1)],
        'alert-triangle,triangle-alert': [p('M10.3 4.4a2 2 0 0 1 3.4 0l7 12.1a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3z'), p('M12 9v4.2'), solid(12, 16.4, 1.05)],
        'info': [CIRCLE, p('M12 11v5.2'), solid(12, 7.9, 1.1)],
        'smile': [CIRCLE, p('M8.5 14.2c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8'), solid(9, 9.8, 1.05), solid(15, 9.8, 1.05)],

        /* ---------- Lịch hẹn: mỗi trạng thái có ký hiệu riêng ---------- */
        'calendar-clock': [fill('M3.5 10H13v10.5H7a3.5 3.5 0 0 1-3.5-3.5z'), p('M10 20.5H7a3.5 3.5 0 0 1-3.5-3.5V8.5A3.5 3.5 0 0 1 7 5h10a3.5 3.5 0 0 1 3.5 3.5V10'), CAL_TOP, c(16.5, 16.5, 4.5), p('M16.5 14v2.5l1.5 1')],
        'calendar-check': [CAL_BODY, CAL_TOP, p('m8 15 2.5 2.5 5-5')],
        'calendar-plus': [CAL_BODY, CAL_TOP, p('M12 12.5v5.5M9.25 15.25h5.5')],
        'calendar-x': [CAL_BODY, CAL_TOP, p('m9.5 12.8 5 5M14.5 12.8l-5 5')],

        /* ---------- CV, tuyển dụng, công cụ ---------- */
        'graduation-cap': [fill('m2.5 9 9.5-5 9.5 5-9.5 5z'), p('m2.5 9 9.5-5 9.5 5-9.5 5zM6 11v6c4 3 8 3 12 0v-6M21.5 9v7'), dot(21.5, 18.5, 1.2)],
        'flask-conical': [fill('m6 15-2 3.5a1.7 1.7 0 0 0 1.5 2.5h13a1.7 1.7 0 0 0 1.5-2.5L18 15z'), p('M8 3h8M9 3v7l-5 8.5A1.7 1.7 0 0 0 5.5 21h13a1.7 1.7 0 0 0 1.5-2.5L15 10V3M6 15h12'), dot(12, 17.8, 1.15)],
        'code-2,code': [p('m7 7-4.5 5L7 17M17 7l4.5 5-4.5 5M14 4l-4 16')],
        'list-checks': [p('m3 7 1.5 1.5 3-3M11 7h9M3 16l1.5 1.5 3-3M11 16h9')],
        'scan-search': [p('M3.5 8V6a2.5 2.5 0 0 1 2.5-2.5h2M16 3.5h2A2.5 2.5 0 0 1 20.5 6v2M3.5 16v2A2.5 2.5 0 0 0 6 20.5h2M20.5 16v2a2.5 2.5 0 0 1-2.5 2.5h-2'), c(11, 11, 3.5), p('m13.5 13.5 3 3')],
        'save': [fill('M7 14h10v6.5H7z'), p('M6.5 3.5h10L20.5 8v9.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3zM7 3.5V9h8V3.5M7 20.5V14h10v6.5'), dot(15.8, 10.8, 1)],
        'route': [c(6, 6, 2.5), dot(18, 18, 2.5), p('M12 6h4a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h4')],
        'type': [p('M4 7V4h16v3M12 4v16M8 20h8')],
        'heading': [p('M5 4v16M16 4v16M5 12h11M20 16v4')],
        'columns-3': [r(3.5, 4, 17, 16, 3.5), r(3.5, 4, 5.7, 16, 2, 'ai-fill'), p('M9.2 4v16M14.8 4v16')],
        'panel-right': [r(3.5, 4, 17, 16, 3.5), r(14, 4, 6.5, 16, 2, 'ai-fill'), p('M14 4v16'), dot(17.2, 9, 1.2)],
        'maximize-2': [p('M14.5 3.5h6v6M20.5 3.5l-6 6M9.5 20.5h-6v-6M3.5 20.5l6-6')],
        'rotate-cw': [p('M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9M19.5 4.5V9H15')],
        'forward': [fill('M4 18c1-5 4-8 9-8V5l8 7-8 7v-5c-4 0-6.5 1-9 4z'), p('M4 18c1-5 4-8 9-8V5l8 7-8 7v-5c-4 0-6.5 1-9 4z')],
        'help-circle,circle-help': [p('M20.5 10a8.7 8.7 0 1 1-6.5-6.5'), p('M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1.1-1.5 2.5'), solid(12, 16.7, 1), dot(18.2, 5.8, 1.5)],

        /* ---------- Hội thoại & phỏng vấn ---------- */
        'message-square-quote': [fill(BUBBLE), p(BUBBLE), p('M8 9h2v2c0 1.3-.6 2-1.7 2.5M13.5 9h2v2c0 1.3-.6 2-1.7 2.5')],
        'message-square-warning': [fill(BUBBLE), p(BUBBLE), p('M12 7.5v4'), solid(12, 14.5, 1)],
        'mic': [r(9, 3, 6, 12, 3, 'ai-fill'), r(9, 3, 6, 12, 3), p('M5.5 11v1a6.5 6.5 0 0 0 13 0v-1M12 18.5V22M9 22h6')],
        'mic-off': [p('M9 5.5a3 3 0 0 1 6 .5v5M9 10v2a3 3 0 0 0 4.5 2.6M5.5 11v1a6.5 6.5 0 0 0 11 4.7M18.5 11v1M12 18.5V22M9 22h6M3 3l18 18')],
        'monitor': [r(3, 4, 18, 13, 3.5), fill('M3 13h18v.5a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 13.5z'), p('M12 17v4M8 21h8'), dot(17, 8, 1.2)],
        'phone': [fill('M4 3.5h4l2 5-2.5 2a15 15 0 0 0 6 6l2-2.5 5 2v4c-8.5 1-17.5-8-16.5-16.5z'), p('M4 3.5h4l2 5-2.5 2a15 15 0 0 0 6 6l2-2.5 5 2v4c-8.5 1-17.5-8-16.5-16.5z')],
        'phone-off': [p('M4 4v4c1.5 6 6 10.5 12 12h4v-4l-5-2-2 2M8 4l2 5M3 3l18 18')],
        'wifi-off': [p('M8.5 5.3a16 16 0 0 1 13 3.2M2.5 8.5a16 16 0 0 1 3-1.9M12 10a10 10 0 0 1 6 2M6 12a10 10 0 0 1 2.5-1.4M9 15.5a5 5 0 0 1 4.5-.7M3 3l18 18'), solid(12, 19, 1.3)],
        'video-off': [p('M3 7v8a3 3 0 0 0 3 3h7M8 6h5a3 3 0 0 1 3 3v2l5-3v8l-2-1M3 3l18 18')],
        'play': [fill('M8 4.5 20 12 8 19.5z'), p('M8 4.5 20 12 8 19.5z')],
        'pause': [r(5, 4, 4.5, 16, 2, 'ai-fill'), r(5, 4, 4.5, 16, 2), r(14.5, 4, 4.5, 16, 2)],
        'volume-2': [fill('M3 9h4l5-5v16l-5-5H3z'), p('M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14')],
        'volume-x': [p('M3 9h4l5-5v16l-5-5H3zM16 9l5 6M21 9l-5 6')],
        'bookmark-minus': [p('M8 3.5h8a3 3 0 0 1 3 3v14L12 17l-7 3.5v-14a3 3 0 0 1 3-3zM9 10h6')],
        'clipboard-check': [fill('M7 5h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z'), p('M7.5 5H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3h-.5'), r(7.5, 2.5, 9, 5, 2), p('m8.5 14 2.5 2.5 4.5-5')],
        'lock': [r(4.5, 10, 15, 11, 3.5, 'ai-fill'), r(4.5, 10, 15, 11, 3.5), p('M8 10V7a4 4 0 0 1 8 0v3'), dot(12, 15.5, 1.5)],
        'loader,loader-circle': [p('M20.5 12a8.5 8.5 0 1 1-8.5-8.5'), dot(18, 6, 1.5)],

        /* ---------- Bố cục ---------- */
        'layout-grid': [r(4, 4, 7, 7, 2.2), r(13, 4, 7, 7, 2.2), r(4, 13, 7, 7, 2.2), r(13, 13, 7, 7, 2.2)],
        'rows-3,rows': [r(4, 4, 16, 16, 3.2), p('M4 9.4h16M4 14.6h16')],
        'list': [p('M9 6.5h11M9 12h11M9 17.5h11'), solid(4.8, 6.5, 1.15), solid(4.8, 12, 1.15), solid(4.8, 17.5, 1.15)],

        /* ---------- Mũi tên (hình học cơ bản, cùng tỉ lệ) ---------- */
        'arrow-right': [p('M4.5 12h15M13.5 6l6 6-6 6')],
        'arrow-left': [p('M19.5 12h-15M10.5 6l-6 6 6 6')],
        'arrow-up': [p('M12 19.5v-15M6 10.5l6-6 6 6')],
        'arrow-down': [p('M12 4.5v15M6 13.5l6 6 6-6')],
        'arrow-up-right': [p('M7 17 17 7M8.5 7H17v8.5')],
        'arrow-up-down,arrow-down-up': [p('M7.5 19V5M4 8.5 7.5 5 11 8.5'), p('M16.5 5v14M13 15.5l3.5 3.5 3.5-3.5')],
        'chevron-left': [p('m14.5 6-6 6 6 6')],
        'chevron-right': [p('m9.5 6 6 6-6 6')],
        'chevron-down': [p('m6 9.5 6 6 6-6')],
        'chevron-up': [p('m6 14.5 6-6 6 6')],
        'chevrons-left': [p('m11 7-5 5 5 5M18 7l-5 5 5 5')],
        'chevrons-right': [p('m13 7 5 5-5 5M6 7l5 5-5 5')],
        'chevrons-up-down': [p('m7.5 9.5 4.5-4.5 4.5 4.5M7.5 14.5l4.5 4.5 4.5-4.5')]
    };

    /* Cùng công thức đổi tên như lucide (home → Home, building-2 → Building2) */
    var pascal = function (n) {
        return n.replace(/(\w)(\w*)(_|-|\s*)/g, function (m, a, b) { return a.toUpperCase() + b.toLowerCase(); });
    };
    /* lucide.icons là object bị đóng băng → tạo bản gộp rồi bọc createIcons() để luôn dùng bản gộp */
    var merged = Object.assign({}, L.icons);
    Object.keys(ICONS).forEach(function (names) {
        var node = ['svg', BASE, ICONS[names]];
        names.split(',').forEach(function (n) { merged[pascal(n.trim())] = node; });
    });
    try { L.icons = merged; } catch (e) { /* bỏ qua */ }
    var original = L.createIcons;
    if (typeof original === 'function' && !original.__aris) {
        var wrapped = function (opts) {
            opts = opts || {};
            return original(Object.assign({}, opts, { icons: opts.icons && opts.icons !== merged ? Object.assign({}, merged, opts.icons) : merged }));
        };
        wrapped.__aris = true;
        L.createIcons = wrapped;
    }
    window.ArisIcons = {
        name: 'Aris Orbit', version: 2,
        names: Object.keys(ICONS).join(',').split(','),
        // Primary names for the specimen; aliases remain available to existing templates.
        primaryNames: Object.keys(ICONS).map(function (names) { return names.split(',')[0]; }),
        icons: merged
    };
})();
