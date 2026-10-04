// Chụp ảnh bản thiết kế tham chiếu V7 (docs/design-v7/reference) để tự soát.
// Chạy (từ thư mục gốc repo):
//   node docs/design-v7/tools/shoot.js <thư-mục-lưu-ảnh> '<JSON danh sách cảnh>'
// Ví dụ:
//   node docs/design-v7/tools/shoot.js .local/v7-shots '[{"name":"chat","url":"chat.html"},{"name":"chat-dark","url":"chat.html","theme":"dark"},{"name":"jobs-m","url":"jobs.html","w":390,"h":844,"dpr":2,"mobile":true}]'
// Mỗi cảnh: name, url (tương đối trong reference/, có thể kèm ?drawer=1…), theme (light|dark),
//            w, h, dpr, mobile, wait (ms), script (JS chạy trong trang), after (ms chờ sau script).
// In ra "ok" hoặc lỗi JS/console của từng cảnh.
const path = require('path');
const puppeteer = require(path.resolve(__dirname, '../../../ArisSkyve/node_modules/puppeteer-core'));

const base = 'file:///' + path.resolve(__dirname, '../reference').split(path.sep).join('/') + '/';
const out = path.resolve(process.argv[2] || '.');
const scenes = JSON.parse(process.argv[3] || '[{"name":"chat","url":"chat.html"}]');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--allow-file-access-from-files']
  });
  for (const s of scenes) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    page.on('requestfailed', (r) => errs.push('request failed: ' + r.url().slice(0, 120)));
    await page.setViewport({ width: s.w || 1440, height: s.h || 900, deviceScaleFactor: s.dpr || 1, isMobile: !!s.mobile, hasTouch: !!s.mobile });
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('aris-theme', t); } catch (e) { /* file:// */ } }, s.theme || 'light');
    await page.goto(base + s.url, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, s.wait || 900));
    if (s.script) { await page.evaluate(s.script); await new Promise((r) => setTimeout(r, s.after || 800)); }
    await page.screenshot({ path: path.join(out, `${s.name}.png`) });
    console.log(s.name, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'ok');
    await page.close();
  }
  await browser.close();
})();
