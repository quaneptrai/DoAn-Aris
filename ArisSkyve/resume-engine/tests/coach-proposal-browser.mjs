import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { sample } from '../src/sample.ts';

const require = createRequire(import.meta.url);
const puppeteer = require('../../node_modules/puppeteer-core');
const root = resolve('../wwwroot');
const initial = structuredClone(sample);
initial.basics.summary = '';
let stored = structuredClone(initial);
let writes = 0;
let coachCalls = 0;
let checks = 0;

const json = (response, value, status = 200) => {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(value));
};
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};

const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path.startsWith('/api/resume-engine/')) {
      if (path.endsWith('/session')) return json(response, { token: 'coach-fixture-token', userId: 'coach-fixture-user' });
      if (path.endsWith('/capabilities')) return json(response, { layoutOcr: false, layoutOcrReason: 'fixture_ocr_disabled' });
      if (request.method === 'POST' && request.headers.requestverificationtoken !== 'coach-fixture-token') return json(response, { error: 'CSRF missing' }, 400);
      let raw = '';
      for await (const part of request) raw += part;
      if (path.endsWith('/coach')) {
        coachCalls++;
        return json(response, {
          status: 'success',
          cv_skills: ['React'],
          roles: [],
          titles_indexed: true,
          target: {
            query: 'Backend Developer', postings: 1, sample_titles: [],
            skills: [{ skill: 'Docker', share: 0.8, postings: 1, have: false }],
            plan: { coverage: { now: 40, after_stage1: 60 }, steps: [], total_steps: 0, soft_skills: [] },
          },
        });
      }
      if (path.endsWith('/document') && request.method === 'POST') {
        const body = JSON.parse(raw);
        stored = body.data;
        writes++;
        return json(response, { resumeId: 7, published: false, aiSync: 'pending' });
      }
      if (path.endsWith('/document/7')) return json(response, { data: stored, templateId: 't3', published: false, resumeId: 7 });
      return json(response, { error: 'Not mocked' }, 404);
    }
    const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});

await new Promise(resolveServer => server.listen(0, '127.0.0.1', resolveServer));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.setRequestInterception(true);
page.on('request', request => {
  const url = new URL(request.url());
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') request.continue();
  else request.abort();
});

const clickText = async (selector, text) => {
  const clicked = await page.evaluate((query, label) => {
    const element = [...document.querySelectorAll(query)].find(node => node.textContent?.includes(label));
    if (!element) return false;
    element.click();
    return true;
  }, selector, text);
  check(clicked, `Control exists: ${text}`);
};

try {
  await page.goto(`${base}/resume-engine/?resumeId=7`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.word-titlebar');
  await clickText('.title-actions button', 'Trợ lý CV');
  await page.waitForSelector('.coach-panel');
  await page.waitForFunction(() => document.querySelector('.coach-target-result'));
  check(coachCalls > 0, 'Coach analyzes only through the local fixture API');
  const marketText = await page.$eval('.coach-target-result', element => element.textContent || '');
  check(marketText.includes('kho tin đã lập chỉ mục'), 'Market analysis identifies its indexed-record source');
  check(marketText.includes('không xác nhận tin còn mở'), 'Market analysis discloses that active-job evidence is unavailable');
  check(!/đang có|đang tuyển|current\b|\bopen\b/i.test(marketText), 'Market analysis never claims jobs are currently open without active-job evidence');
  check(await page.$eval('.coach-skill-status', element => element.textContent?.includes('cần xác thực')), 'Missing target skills are labeled for verification rather than asserted as CV facts');
  check(await page.$$eval('[aria-label^="Xem đề xuất thêm"]', elements => elements.length === 0), 'Target-job demand has no auto-applicable add-to-CV control');

  await clickText('.coach-checks button', 'Mở mục sửa');
  await page.waitForSelector('.resume-editor');
  check(true, 'Non-actionable Coach checks open their editor section');
  await page.evaluate(() => document.querySelector('.resume-editor button[aria-label="Đóng"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForFunction(() => !document.querySelector('.resume-editor'));

  await clickText('.coach-checks button', 'Xem đề xuất');
  await page.waitForSelector('.proposal-dialog[open]');
  check(await page.$eval('.proposal-after', element => element.textContent.includes('Senior Software Engineer') && element.textContent.includes('React')), 'Proposal presents a deterministic draft grounded in CV facts');
  check(await page.$$eval('.proposal-changes code', elements => elements.map(element => element.textContent).join(',') === 'basics.summary'), 'Dialog names the one exact CV field it will change');
  check(await page.$$eval('.proposal-evidence li', elements => elements.length >= 2), 'Dialog displays multiple source facts used by the proposal');
  check(await page.$$eval('.proposal-evidence code', elements => elements.some(element => element.textContent === 'basics.headline') && elements.some(element => element.textContent?.startsWith('skills['))), 'Dialog identifies the original CV paths for cited facts');
  check(await page.$eval('.proposal-after', element => getComputedStyle(element).animationName === 'coach-proposal-reveal'), 'Proposal text has a reveal animation');
  check(await page.$eval('.proposal-preview .page-zoom', element => getComputedStyle(element).animationName === 'coach-preview-pulse'), 'CV preview animates the proposed state');
  check(stored.basics.summary === '' && writes === 0, 'Preview has not persisted or committed the proposal');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyS');
  await page.keyboard.up('Control');
  await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  check(writes === 0, 'Keyboard save is blocked until the proposal is accepted or cancelled');
  await clickText('.proposal-dialog button', 'Giữ nguyên');
  await page.waitForFunction(() => !document.querySelector('.proposal-dialog'));
  check(stored.basics.summary === '' && writes === 0, 'Cancel leaves the CV unchanged');

  await clickText('.coach-checks button', 'Xem đề xuất');
  await page.waitForSelector('.proposal-dialog[open]');
  await clickText('.proposal-dialog button', 'Áp dụng thay đổi');
  await page.waitForFunction(() => !document.querySelector('.proposal-dialog'));
  check(writes === 0, 'Apply updates only the working copy before Save');
  await clickText('.title-actions button', 'Lưu CV');
  await page.waitForFunction(() => document.querySelector('.document-title')?.textContent?.includes('Đã lưu'));
  check(stored.basics.summary.includes('Senior Software Engineer') && stored.basics.summary.includes('React') && writes === 1, 'Confirmed fact-grounded text proposal is saved');
  await page.reload({ waitUntil: 'networkidle0' });
  check(await page.$eval('.engine-root', element => element.textContent.includes('Senior Software Engineer') && element.textContent.includes('React')), 'Confirmed proposal survives reload');
  check(stored.skills.every(group => group.items.every(item => item.name !== 'Docker')) && writes === 1, 'A target-only skill recommendation cannot mutate or save the CV');
  check(errors.length === 0, `No browser runtime errors: ${errors.join('; ')}`);
  console.log(`COACH PROPOSAL BROWSER: ${checks} checks passed`);
} finally {
  await browser.close();
  server.close();
}
