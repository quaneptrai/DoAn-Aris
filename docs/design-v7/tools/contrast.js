// Đo tương phản WCAG cho các cặp màu chính của Aris Line, đọc token trực tiếp từ reference/line.css.
// Chạy: node docs/design-v7/tools/contrast.js            → bảng Markdown (sáng + tối)
//       node docs/design-v7/tools/contrast.js --fail     → chỉ in cặp KHÔNG đạt (exit 1 nếu có)
// Ngưỡng: chữ thường 4.5:1 · chữ lớn/đậm ≥ 18px hoặc đồ hoạ/viền control 3:1 (WCAG 2.2 AA, 1.4.3 + 1.4.11).
const fs = require('fs');
const path = require('path');

// Mặc định đọc bản tham chiếu; --css <đường dẫn> để đo file CSS khác (vd. css của app)
const cssArg = process.argv.indexOf('--css');
const cssPath = cssArg > -1 ? path.resolve(process.argv[cssArg + 1]) : path.resolve(__dirname, '../reference/line.css');
const css = fs.readFileSync(cssPath, 'utf8');

function block(selector) {
  const i = css.indexOf(selector + ' {');
  if (i < 0) throw new Error('Không thấy khối ' + selector);
  let depth = 0;
  let j = css.indexOf('{', i);
  const start = j;
  for (; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') { depth--; if (depth === 0) break; }
  }
  return css.slice(start + 1, j);
}
function parse(body) {
  const out = {};
  body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(--[\w-]+)\s*:\s*([^;]+);/g, (m, k, v) => { out[k] = v.trim(); });
  return out;
}
const light = parse(block(':root'));
const dark = Object.assign({}, light, parse(block(':root[data-theme="dark"]')));

function resolve(vars, v, depth = 0) {
  if (depth > 10) throw new Error('vòng lặp var: ' + v);
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  return m ? resolve(vars, vars[m[1]], depth + 1) : v;
}
function rgba(v) {
  v = v.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+))?\s*\)$/.exec(v);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  throw new Error('Không đọc được màu: ' + v);
}
const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lum = (c) => {
  const [r, g, b] = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
function ratio(vars, fg, bg) {
  const col = (x) => rgba(x.startsWith('--') ? resolve(vars, vars[x]) : x);
  // Nền trong suốt (vd. soft token của theme tối) được trộn lên --surface của chính theme đó
  const base = over(col('--surface'), [255, 255, 255, 1]);
  const b = over(col(bg), base);
  const f = over(col(fg), b);
  const [hi, lo] = [lum(f), lum(b)].sort((a, c) => c - a);
  return (hi + 0.05) / (lo + 0.05);
}

// [chữ/đồ hoạ, nền, dùng ở đâu, ngưỡng]
const PAIRS = [
  ['--text', '--canvas', 'Chữ chính trên nền app', 4.5],
  ['--text', '--surface', 'Chữ chính trên tờ giấy', 4.5],
  ['--text-2', '--surface', 'Chữ phụ, nội dung dài', 4.5],
  ['--text-3', '--canvas', 'Metadata trên nền app', 4.5],
  ['--text-3', '--surface', 'Metadata trên tờ giấy', 4.5],
  ['--text-3', '--field', 'Metadata trên ô nhập / tag', 4.5],
  ['--text-4', '--surface', 'Placeholder, icon phụ (đồ hoạ)', 3],
  ['--text-4', '--field', 'Placeholder trong ô tìm (đồ hoạ)', 3],
  ['--on-brand', '--brand', 'Chữ trên nút chính', 4.5],
  ['--on-brand', '--brand-hover', 'Chữ trên nút chính khi hover', 4.5],
  ['--brand-text', '--surface', 'Link trên tờ giấy', 4.5],
  ['--brand-text', '--canvas', 'Link trên nền app', 4.5],
  ['--brand-text', '--brand-soft', 'Chip / mục đang chọn', 4.5],
  ['--brand', '--surface', 'Chỉ báo "The Line", viền focus (đồ hoạ)', 3],
  ['--brand', '--canvas', 'Chỉ báo trên nền app (đồ hoạ)', 3],
  ['--line-control', '--surface', 'Viền ô nhập, checkbox, radio (đồ hoạ)', 3],
  ['--line-control', '--canvas', 'Viền control trên nền app (đồ hoạ)', 3],
  ['#FFFFFF', '--accent', 'Số trên badge chưa đọc', 4.5],
  ['--accent-text', '--accent-soft', 'Tag "Mới"', 4.5],
  ['--accent-text', '--canvas', 'Giờ của tin chưa đọc', 4.5],
  ['--success', '--success-soft', 'Trạng thái thành công', 4.5],
  ['--success', '--surface', 'Chữ thành công', 4.5],
  ['--warning', '--warning-soft', 'Trạng thái cảnh báo', 4.5],
  ['--danger', '--danger-soft', 'Trạng thái lỗi', 4.5],
  ['--danger', '--surface', 'Chữ lỗi, mục menu nguy hiểm', 4.5],
  ['#FFFFFF', '--danger-fill', 'Nút nguy hiểm', 4.5],
  ['--on-status', '--success', 'Nút Nhận cuộc gọi', 4.5],
  ['--on-status', '--warning', 'Kết quả tìm đang chọn (chat)', 4.5],
  ['--on-inverse', '--inverse', 'Toast, tooltip', 4.5],
  ['--inverse-action', '--inverse', 'Nút hành động trong toast', 4.5],
  ['--bubble-text', '--bubble-me', 'Bong bóng chat của mình', 4.5],
  ['--bubble-text', '--bubble-them', 'Bong bóng chat đối phương', 4.5],
  ['--like', '--surface', 'Tim đã thích (đồ hoạ)', 3],
  ...[1, 2, 3, 4, 5, 6].map((n) => [`--tone-${n}-fg`, `--tone-${n}-bg`, `Chữ viết tắt avatar tông ${n}`, 4.5])
];

const onlyFail = process.argv.includes('--fail');
let fails = 0;
const rows = PAIRS.map(([fg, bg, use, min]) => {
  const l = ratio(light, fg, bg);
  const d = ratio(dark, fg, bg);
  const ok = l >= min && d >= min;
  if (!ok) fails++;
  return { fg, bg, use, min, l, d, ok };
});
const fmt = (x, min) => `${x.toFixed(2)}${x >= min ? '' : ' ✗'}`;
const out = rows.filter((r) => !onlyFail || !r.ok);
console.log('| Chữ / đồ hoạ | Nền | Dùng cho | Ngưỡng | Sáng | Tối |');
console.log('|---|---|---|---|---|---|');
out.forEach((r) => console.log(`| \`${r.fg}\` | \`${r.bg}\` | ${r.use} | ${r.min}:1 | ${fmt(r.l, r.min)} | ${fmt(r.d, r.min)} |`));
console.log(`\n${rows.length - fails}/${rows.length} cặp đạt.`);
if (onlyFail && fails) process.exit(1);
