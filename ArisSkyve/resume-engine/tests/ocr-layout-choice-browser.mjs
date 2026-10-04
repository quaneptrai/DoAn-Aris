import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const puppeteer = require('../../node_modules/puppeteer-core');
const root = resolve('../wwwroot');
const artifacts = resolve('tests/.artifacts/ocr-layout-choice');
await mkdir(artifacts, { recursive: true });

const fixture = JSON.parse(await readFile('../../.local/cv-layout-fixture.json', 'utf8'));
const ocrFixture = structuredClone(fixture);
ocrFixture.data.importedLayout.ocrReviewRequired = true;
ocrFixture.data.importedLayout.ocrReviewConfirmed = false;
ocrFixture.data.importedLayout.warnings = ['OCR fixture requires review before publishing.'];
ocrFixture.warnings = [...ocrFixture.data.importedLayout.warnings];
let stored = structuredClone(ocrFixture.data);
let directAttempts = 0;
let ocrAttempts = 0;
let writes = 0;
let missingCsrf = 0;

const json = (response, value, status = 200) => {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(value));
};
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path.startsWith('/api/resume-engine/')) {
      let body = ''; for await (const chunk of request) body += chunk;
      if (path.endsWith('/session')) return json(response, { userId: 7, token: 'ocr-choice-token' });
      if (path.endsWith('/capabilities')) return json(response, { layoutOcr: true, layoutOcrReason: null });
      if (request.method === 'POST' && request.headers.requestverificationtoken !== 'ocr-choice-token') { missingCsrf++; return json(response, { error: 'CSRF missing' }, 400); }
      if (path.endsWith('/parse')) {
        const mode = /name="mode"\r\n\r\n([^\r\n]+)/.exec(body)?.[1];
        if (mode === 'layout') {
          directAttempts++;
          return json(response, { error: 'Synthetic scan needs explicit OCR.', code: 'layout_scan_detected', actions: [{ id: 'use-layout-ocr', label: 'OCR' }] }, 422);
        }
        if (mode === 'layout-ocr') { ocrAttempts++; return json(response, ocrFixture); }
        return json(response, { error: 'Unexpected mode' }, 400);
      }
      if (path.endsWith('/document') && request.method === 'POST') {
        const data = JSON.parse(body).data;
        if (data?.importedLayout?.ocrReviewRequired && data.importedLayout.ocrReviewConfirmed !== true)
          return json(response, { error: 'OCR review required', code: 'ocr_review_required' }, 422);
        stored = data; writes++;
        return json(response, { resumeId: 7, published: false, aiSync: 'scheduled' });
      }
      if (path.endsWith('/document/7')) return json(response, { data: stored, templateId: 't1', published: false, resumeId: 7 });
      return json(response, { error: 'Not mocked' }, 404);
    }
    const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch (error) { response.writeHead(500).end(String(error)); }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'], userDataDir: resolve(artifacts, 'chrome') });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1050 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; console.log(`PASS ${label}`); };
const clickText = async (selector, text) => {
  const clicked = await page.evaluate((candidateSelector, candidateText) => {
    const element = [...document.querySelectorAll(candidateSelector)].find(node => node.textContent?.includes(candidateText));
    element?.click(); return Boolean(element);
  }, selector, text);
  assert.ok(clicked, `Could not find control: ${text}`);
};

try {
  await page.goto(`${base}/resume-engine/?new=1`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('dialog[open]');
  check(await page.$eval('dialog[open] button[title]', button => !button.disabled), 'OCR choice is enabled only after the local capability check');

  await clickText('dialog[open] button', 'Nhập PDF có lớp chữ');
  await (await page.$('input[type="file"]')).uploadFile(resolve('../../.local/cv-layout-fixture.pdf'));
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.textContent?.includes('OCR giữ bố cục cho CV scan/ảnh'));
  check(directAttempts === 1 && ocrAttempts === 0, 'A scan response never starts OCR automatically');
  check(writes === 0, 'A failed direct layout import never persists a document');

  await clickText('dialog[open] button', 'Bắt đầu OCR cục bộ');
  await page.waitForSelector('.imported-page');
  check(ocrAttempts === 1, 'OCR runs only after the explicit confirmation');
  check(await page.$eval('.parse-warnings', element => element.textContent?.includes('OCR fixture requires review')), 'OCR review warning is visible to the owner');

  await page.click('.imported-text');
  const input = 'textarea[aria-label="Nội dung khối chữ"]';
  await page.waitForSelector(input);
  await page.click(input); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.type(input, 'OCR Reviewed Text');
  check(await page.$eval('.imported-text', element => element.textContent === 'OCR Reviewed Text'), 'OCR overlay edits render before save');
  await clickText('.title-actions button', 'Lưu CV');
  await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent?.includes('xác nhận đã đối chiếu'));
  check(writes === 0, 'OCR document cannot be saved before the owner acknowledges the original-file review');
  await clickText('.studio-messages button', 'Tôi đã đối chiếu với file gốc');
  check(await page.$eval('.studio-messages', element => !element.textContent?.includes('Kiểm tra OCR trước khi tiếp tục')), 'Owner acknowledgement clears the OCR save gate');
  await clickText('.title-actions button', 'Lưu CV');
  await page.waitForFunction(() => document.querySelector('.document-title')?.textContent?.includes('Đã lưu'), { timeout: 5000 });
  check(writes === 1, `Saving issues one document write (${writes})`);
  check(stored.importedLayout.pages[0].elements.some(element => element.text === 'OCR Reviewed Text'), 'Saving persists the reviewed OCR overlay, not an image-only result');
  await page.waitForFunction(() => sessionStorage.getItem('aris-draft:7:7') === null, { timeout: 5000 });
  check(await page.evaluate(() => sessionStorage.getItem('aris-draft:7:7') === null), 'A saved OCR document is removed from sessionStorage');

  await page.goto(`${base}/resume-engine/?resumeId=7`, { waitUntil: 'networkidle0' });
  check(await page.$eval('.imported-text', element => element.textContent === 'OCR Reviewed Text'), 'Reload preserves OCR layout edits');
  check(await page.$eval('.parse-warnings', element => element.textContent?.includes('OCR fixture requires review')), 'OCR warning remains visible after reload');
  check(missingCsrf === 0 && errors.length === 0, `OCR requests retain CSRF and no browser error occurs: ${errors.join('; ')}`);

  await writeFile(resolve(artifacts, 'result.json'), JSON.stringify({ checks, directAttempts, ocrAttempts, writes, missingCsrf, errors, note: 'Synthetic local fixture; no production CV, parser, OCR model, or AI request.' }, null, 2));
  console.log(`OCR LAYOUT CHOICE: ${checks} checks passed`);
} finally {
  await browser.close();
  server.close();
}
