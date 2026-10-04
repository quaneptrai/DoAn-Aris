import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { sample } from '../src/sample.ts';

const require = createRequire(import.meta.url);
const puppeteer = require('../../node_modules/puppeteer-core');
const root = resolve('../wwwroot');
const artifacts = resolve('tests/.artifacts/unsaved-replacement');
await mkdir(artifacts, { recursive: true });

// Start from a saved document whose identity is deliberately different from
// the sample. That makes it possible to prove a replacement did not happen
// until the owner explicitly chooses an action in the confirmation dialog.
let stored = structuredClone(sample);
stored.basics.name = 'Saved Original';
stored.basics.headline = 'Current saved profile';
stored.basics.email = 'saved@example.com';
stored.meta.slug = 'saved-original';

const candidateSourceId = '0123456789abcdef0123456789abcdef';
const parsedCandidate = structuredClone(sample);
parsedCandidate.basics.name = 'Imported Candidate';
parsedCandidate.basics.headline = 'Parsed upload awaiting confirmation';
parsedCandidate.basics.email = 'imported@example.com';
parsedCandidate.meta.slug = 'imported-candidate';
parsedCandidate.importedLayout = {
  version: 1,
  sourceName: 'candidate.pdf',
  sourceId: candidateSourceId,
  warnings: [],
  pages: [{
    width: 595,
    height: 842,
    // The candidate is never rendered while the owner stays on the current
    // document; the schema-valid tiny payload keeps this test self-contained.
    background: 'data:image/jpeg;base64,AA==',
    elements: [{ id: 'name', text: 'Imported Candidate', x: 50, y: 50, width: 200, height: 18, fontSize: 14, fontFamily: 'Arial', color: '#000000', bold: true, italic: false }],
  }],
};
const uploadPath = resolve(artifacts, 'candidate.pdf');
await writeFile(uploadPath, Buffer.from('%PDF-1.4\n% browser fixture only\n'));

let writes = 0;
let parseCalls = 0;
let missingCsrf = 0;
const discardedOriginals = [];
const json = (response, value, status = 200) => {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(value));
};
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path.startsWith('/api/resume-engine/')) {
      let body = ''; for await (const chunk of request) body += chunk;
      if (path.endsWith('/session')) return json(response, { userId: 7, token: 'replacement-token' });
      if (path.endsWith('/capabilities')) return json(response, { layoutOcr: false, layoutOcrReason: 'fixture_ocr_disabled' });
      if (request.method === 'POST' && request.headers.requestverificationtoken !== 'replacement-token') {
        missingCsrf++;
        return json(response, { error: 'CSRF missing' }, 400);
      }
      if (path.endsWith('/parse') && request.method === 'POST') {
        parseCalls++;
        assert.match(body, /name="mode"\r\n\r\nlayout/);
        return json(response, { data: parsedCandidate, warnings: ['Imported fixture warning'] });
      }
      if (path === `/api/resume-engine/original/${candidateSourceId}/discard` && request.method === 'POST') {
        discardedOriginals.push(candidateSourceId);
        return json(response, { discarded: true });
      }
      if (path.endsWith('/document') && request.method === 'POST') {
        const payload = JSON.parse(body);
        stored = payload.data;
        writes++;
        return json(response, { resumeId: 7, published: false, aiSync: 'scheduled' });
      }
      if (path.endsWith('/document/7')) return json(response, { data: stored, templateId: 't3', published: false, resumeId: 7 });
      return json(response, { error: `Not mocked: ${path}` }, 404);
    }
    const target = resolve(root, '.' + (path.startsWith('/portfolio/') ? '/resume-engine/index.html' : path.endsWith('/') ? path + 'index.html' : path));
    if (!target.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream' });
    response.end(await readFile(target));
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  userDataDir: resolve(artifacts, 'chrome'),
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// After an explicit discard the replacement is a new, intentionally-unsaved
// draft. Accept its native leave-page warning when this test reloads the
// fixture's saved record; otherwise Chrome keeps navigation pending forever.
page.on('dialog', dialog => dialog.accept());
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; console.log(`PASS ${label}`); };
const clickText = async (selector, text) => {
  const clicked = await page.evaluate((candidateSelector, candidateText) => {
    const element = [...document.querySelectorAll(candidateSelector)].find(node => node.textContent?.includes(candidateText));
    element?.click();
    return Boolean(element);
  }, selector, text);
  assert.ok(clicked, `Could not find control: ${text}`);
};
const fill = async (selector, value) => {
  await page.click(selector);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.type(selector, value);
};
const waitForReplacement = () => page.waitForFunction(() => [...document.querySelectorAll('dialog[open]')].some(dialog => dialog.getAttribute('aria-label') === 'Lưu thay đổi trước khi thay CV?'));
const clickReplacement = async text => {
  const clicked = await page.evaluate(buttonText => {
    const dialog = [...document.querySelectorAll('dialog[open]')].find(candidate => candidate.getAttribute('aria-label') === 'Lưu thay đổi trước khi thay CV?');
    const button = dialog ? [...dialog.querySelectorAll('button')].find(candidate => candidate.textContent?.trim().includes(buttonText)) : null;
    button?.click();
    return Boolean(button);
  }, text);
  assert.ok(clicked, `Could not find replacement action: ${text}`);
};
const waitUntil = async (predicate, timeout = 3000) => {
  const until = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= until) throw new Error('Timed out waiting for fixture state');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
};
const openFile = async () => {
  await page.click('.file-tab');
  await page.waitForSelector('dialog[open]');
};
const markDirty = async () => {
  await page.select('select[aria-label="Font nội dung"]', 'Georgia');
  await page.waitForFunction(() => document.querySelector('.engine-root')?.style.getPropertyValue('--body-font') === 'Georgia');
};
const currentName = () => page.$eval('.document-title strong', element => element.textContent);

try {
  // The real bundle may request fonts in the background. Waiting for all
  // network activity here makes this regression flaky without adding signal;
  // wait for the Studio chrome and the explicitly asserted document instead.
  await page.goto(`${base}/resume-engine/?resumeId=7`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.word-titlebar');
  check(await currentName() === 'Saved Original', 'Loaded the saved document under test');
  await markDirty();

  // New blank CV: opening the form and submitting it must not silently throw
  // away the edit that made the current document dirty.
  await openFile();
  await fill('dialog[open] input[name="name"]', 'Blank Replacement');
  await fill('dialog[open] input[name="headline"]', 'Blank profile');
  await fill('dialog[open] input[name="email"]', 'blank@example.com');
  await page.click('dialog[open] .new-resume-form button[type="submit"]');
  await waitForReplacement();
  check(await currentName() === 'Saved Original', 'Starting a blank CV shows confirmation before replacing dirty content');
  await clickReplacement('Ở lại');
  await page.waitForFunction(() => ![...document.querySelectorAll('dialog[open]')].some(dialog => dialog.getAttribute('aria-label') === 'Lưu thay đổi trước khi thay CV?'));
  check(await currentName() === 'Saved Original' && writes === 0, 'Staying keeps the unsaved document and does not write it');

  // Sample replacement takes the explicit discard route. It should turn the
  // screen into a draft only after the owner chooses to discard.
  await openFile();
  await clickText('dialog[open] button', 'Dùng nội dung minh họa');
  await waitForReplacement();
  await clickReplacement('Bỏ thay đổi');
  await page.waitForFunction(expected => document.querySelector('.document-title strong')?.textContent === expected, {}, sample.basics.name);
  check(await currentName() === sample.basics.name && writes === 0, 'Discarding explicitly replaces the dirty document without an implicit save');

  // Reload the saved record, then import a new PDF. This verifies the more
  // sensitive path: a parsed upload can create an original file before the
  // owner decides whether to replace their current CV.
  await page.goto(`${base}/resume-engine/?resumeId=7`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.document-title strong')?.textContent === 'Saved Original');
  await markDirty();
  await openFile();
  await clickText('dialog[open] button', 'Nhập PDF có lớp chữ');
  await (await page.$('input[type="file"]')).uploadFile(uploadPath);
  await waitForReplacement();
  check(parseCalls === 1 && await currentName() === 'Saved Original', 'Parsed upload also waits for an explicit replacement decision');
  await clickReplacement('Ở lại');
  await waitUntil(() => discardedOriginals.length === 1);
  check(discardedOriginals[0] === candidateSourceId && await currentName() === 'Saved Original', 'Cancelling a parsed replacement cleans only that abandoned original and preserves the current CV');

  // Saving first is the third explicit choice. The API must receive the old
  // dirty document before the UI moves to the requested replacement.
  await openFile();
  await clickText('dialog[open] button', 'Dùng nội dung minh họa');
  await waitForReplacement();
  await clickReplacement('Lưu CV rồi tiếp tục');
  await page.waitForFunction(expected => document.querySelector('.document-title strong')?.textContent === expected, {}, sample.basics.name);
  check(writes === 1 && stored.basics.name === 'Saved Original' && stored.meta.theme.fontBody === 'Georgia', 'Save-and-replace persists the dirty original before showing the replacement');
  check(missingCsrf === 0, 'Replacement, parsed upload, cleanup, and save retain CSRF protection');
  check(errors.length === 0, `No browser runtime errors: ${errors.join('; ')}`);

  await writeFile(resolve(artifacts, 'result.json'), JSON.stringify({ checks, writes, parseCalls, discardedOriginals, missingCsrf, errors, note: 'Real Studio bundle with a local fixture API; tests blank, sample, and parsed-upload replacement choices.' }, null, 2));
  console.log(`UNSAVED REPLACEMENT BROWSER: ${checks} checks passed`);
} finally {
  await browser.close();
  server.close();
}
