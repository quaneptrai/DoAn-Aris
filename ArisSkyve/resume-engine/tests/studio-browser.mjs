import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { sample } from '../src/sample.ts';
const require = createRequire(import.meta.url);
const puppeteer = require('../../node_modules/puppeteer-core');
const root = resolve('../wwwroot');
const artifacts = resolve('tests/artifacts');
await mkdir(artifacts, { recursive: true });
let stored = structuredClone(sample), templateId = 't3', published = false, writes = 0;
const json = (res, value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.startsWith('/api/resume-engine/')) {
      if (path.endsWith('/session')) return json(res, { token: 'browser-test-token', userId: 'browser-test-user' });
      if (path.endsWith('/capabilities')) return json(res, { layoutOcr: false, layoutOcrReason: 'fixture_ocr_disabled' });
      if (req.method === 'POST' && req.headers.requestverificationtoken !== 'browser-test-token') return json(res, { error: 'CSRF missing' }, 400);
      if (path.endsWith('/document') && req.method === 'POST') {
        let raw = ''; for await (const part of req) raw += part;
        const body = JSON.parse(raw); assert.ok(body.data.basics.email); assert.match(body.templateId, /^t\d+$/);
        stored = body.data; templateId = body.templateId; writes++; return json(res, { resumeId: 7, published });
      }
      if (path.endsWith('/unpublish')) { published = false; return json(res, { published }); }
      if (path.endsWith('/publish')) { published = true; return json(res, { published, url: '/portfolio/7' }); }
      if (path.endsWith('/document/7')) return json(res, { data: stored, templateId, published, resumeId: 7 });
      if (path.endsWith('/public/7')) return published ? json(res, { data: stored, templateId }) : json(res, { error: 'Not found' }, 404);
      return json(res, { error: 'Not mocked' }, 404);
    }
    const target = resolve(root, '.' + (path.startsWith('/portfolio/') ? '/resume-engine/index.html' : path.endsWith('/') ? path + 'index.html' : path));
    if (!target.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream' }); res.end(await readFile(target));
  } catch (e) { res.writeHead(404); res.end(String(e)); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--disable-gpu'], userDataDir: resolve('tests/artifacts/chrome-studio') });
const page = await browser.newPage(); await page.setViewport({ width: 1512, height: 982, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const clickText = async (selector, text) => {
  const result = await page.evaluate((s, t) => { const el = [...document.querySelectorAll(s)].find(e => e.textContent.includes(t)); if (!el) return false; el.click(); return true; }, selector, text);
  check(result, `Control exists: ${text}`);
};
const fill = async (selector, value) => { await page.click(selector); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.type(selector, value); };
try {
  await page.goto(base + '/resume-engine/?resumeId=7', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.word-titlebar');
  check(await page.$eval('.document-title', e => e.textContent.includes('Nguyễn An')), 'Loaded account document');
  check(await page.$$eval('select[aria-label="Font nội dung"] option', e => e.length >= 70), '69 fonts + template default');
  await page.select('select[aria-label="Font nội dung"]', 'Georgia');
  await page.waitForFunction(() => document.querySelector('.engine-root').style.getPropertyValue('--body-font') === 'Georgia');
  check(true, 'Font changes actual rendered style');
  await clickText('.color-tools button', 'Màu chính');
  await page.waitForSelector('.color-dialog[open]');
  await fill('.mixer-values input[maxlength="7"]', '#663399');
  await page.screenshot({ path: resolve(artifacts, 'studio-color-mixer.png'), fullPage: false });
  await clickText('.color-dialog button', 'Áp dụng màu');
  await page.waitForFunction(() => document.querySelector('.engine-root').style.getPropertyValue('--primary') === '#663399');
  await page.click('button[aria-label="Hoàn tác"]');
  await page.waitForFunction(() => document.querySelector('.engine-root').style.getPropertyValue('--primary') !== '#663399');
  await page.click('button[aria-label="Làm lại"]');
  await page.waitForFunction(() => document.querySelector('.engine-root').style.getPropertyValue('--primary') === '#663399');
  check(true, 'Color mixer and undo/redo');
  await clickText('.document-outline nav button', 'Thông tin');
  await page.waitForSelector('.resume-editor');
  const nameSelector = '.resume-editor input';
  await fill(nameSelector, 'Trần Minh Anh');
  await clickText('.resume-editor footer button', 'Áp dụng');
  await page.waitForFunction(() => !document.querySelector('.resume-editor'));
  check(await page.$eval('.engine-root', e => e.textContent.includes('Trần Minh Anh')), 'Editor applies canonical content');
  await clickText('.title-actions button', 'Lưu CV');
  await page.waitForFunction(() => document.querySelector('.document-title').textContent.includes('Đã lưu'));
  check(stored.basics.name === 'Trần Minh Anh' && stored.meta.theme.fontBody === 'Georgia' && stored.meta.theme.primaryColor === '#663399', 'Save contains data and theme');
  await clickText('.outline-template button', '32 layout');
  await page.waitForSelector('.native-card');
  check(await page.$$eval('.native-card', x => x.length) === 32, '32 native layouts available');
  await page.screenshot({ path: resolve(artifacts, 'studio-layout-library.png'), fullPage: false });
  await clickText('.native-card', 'Essential Compact');
  await page.waitForFunction(() => !!document.querySelector('.template-t32'));
  await clickText('.title-actions button', 'Lưu CV');
  await page.waitForFunction(() => document.querySelector('.document-title').textContent.includes('Đã lưu'));
  check(templateId === 't32' && writes === 2, 'Layout persists with exactly one save per click');
  await clickText('.community-button', 'cộng đồng');
  await page.waitForSelector('.external-gallery');
  await page.waitForFunction(() => document.querySelector('.external-gallery').textContent.includes('609'));
  check(true, 'External catalog fetched');
  await page.keyboard.press('Escape');
  await clickText('.publish-button', 'portfolio');
  await page.waitForFunction(() => document.querySelector('.word-statusbar').textContent.includes('Portfolio công khai'));
  check(published, 'Publish waits for successful save');
  await page.screenshot({ path: resolve(artifacts, 'studio-desktop.png'), fullPage: false });
  await page.goto(base + '/portfolio/7', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.template-t32');
  check(!await page.$('.word-titlebar'), 'Public portfolio hides all editor chrome');
  check(await page.title() === `${stored.basics.name} — ${stored.basics.headline}`, 'Dynamic portfolio title');
  await page.goto(base + '/resume-engine/?resumeId=7', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.template-t32');
  await page.emulateMediaType('print');
  check(await page.$eval('.word-titlebar', e => getComputedStyle(e).display === 'none'), 'Print hides full editor chrome');
  await page.pdf({ path: resolve(artifacts, 'studio-a4.pdf'), preferCSSPageSize: true, printBackground: true });
  await page.emulateMediaType('screen');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.screenshot({ path: resolve(artifacts, 'studio-mobile.png'), fullPage: false });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile chrome has no horizontal page overflow');
  check(errors.length === 0, `No browser runtime errors: ${errors.join('; ')}`);
  const result = { checks, writes, errors, note: 'Real Chrome UI with in-memory HTTP API fixtures; no production DB or LLM request.' };
  await writeFile(resolve(artifacts, 'studio-result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} catch (error) {
  console.log(JSON.stringify({ checks, errors, primary: await page.$eval('.engine-root', e => e.style.getPropertyValue('--primary')).catch(() => ''), inputs: await page.$$eval('.color-dialog input', els => els.map(e => ({value:e.value,type:e.type}))) }));
  await page.screenshot({ path: resolve(artifacts, 'studio-failure.png'), fullPage: false }); throw error;
} finally { await browser.close(); server.close(); }
