import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { sample } from '../src/sample.ts';

const require = createRequire(import.meta.url);
const puppeteer = require('../../node_modules/puppeteer-core');
const root = resolve('../wwwroot');
const artifacts = resolve('tests/.artifacts');
await mkdir(artifacts, { recursive: true });

const originalUpload = structuredClone(sample);
const convertedTemplate = structuredClone(sample);
convertedTemplate.basics.name = 'Studio Template Import';
let templateImports = 0;
let documentWrites = 0;

const json = (res, value, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
};

const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.startsWith('/api/resume-engine/')) {
      if (path.endsWith('/session')) return json(res, { token: 'legacy-choice-token', userId: 'legacy-choice-user' });
      if (path.endsWith('/capabilities')) return json(res, { layoutOcr: false, layoutOcrReason: 'fixture_ocr_disabled' });
      if (req.method === 'POST' && req.headers.requestverificationtoken !== 'legacy-choice-token') return json(res, { error: 'CSRF missing' }, 400);
      if (path.endsWith('/document/7/import-template') && req.method === 'POST') {
        templateImports++;
        return json(res, { data: convertedTemplate, templateId: 't1', published: false, resumeId: 7, imported: true, importSource: 'ai' });
      }
      if (path.endsWith('/document') && req.method === 'POST') {
        documentWrites++;
        return json(res, { resumeId: 7, published: false });
      }
      if (path.endsWith('/document/7')) return json(res, {
        data: originalUpload,
        templateId: 't1',
        published: false,
        resumeId: 7,
        imported: true,
        hasOriginalFile: true,
        importSource: 'basic',
      });
      return json(res, { error: 'Not mocked' }, 404);
    }

    const file = resolve(root, '.' + (path.startsWith('/portfolio/') ? '/resume-engine/index.html' : path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch (error) {
    res.writeHead(500).end(String(error));
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  userDataDir: resolve(artifacts, 'chrome-legacy-choice'),
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; console.log(`PASS ${message}`); };
const clickText = async (selector, text) => {
  const clicked = await page.evaluate((candidateSelector, candidateText) => {
    const element = [...document.querySelectorAll(candidateSelector)].find(node => node.textContent?.includes(candidateText));
    element?.click();
    return Boolean(element);
  }, selector, text);
  assert.ok(clicked, `Could not find control: ${text}`);
};

try {
  await page.goto(`${base}/resume-engine/?resumeId=7`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => [...document.querySelectorAll('dialog[open]')].some(dialog => dialog.textContent?.includes('Chuyển sang mẫu Studio mới')));

  check(templateImports === 0, 'Opening an uploaded original does not request template import');
  check(documentWrites === 0, 'Opening an uploaded original does not persist a converted document');
  check(await page.$eval('dialog[open]', dialog => dialog.textContent?.includes('Giữ bố cục PDF có lớp chữ')), 'Upload choice presents the original-layout action');

  await clickText('dialog[open] button', 'Chuyển sang mẫu Studio mới');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForSelector('.template-t1');

  check(templateImports === 1, 'Choosing Studio template sends exactly one explicit import request');
  check(documentWrites === 0, 'Explicit template choice does not save until the user saves');
  check(await page.$eval('.document-title strong', element => element.textContent === 'Studio Template Import'), 'Template view uses the explicit import response');
  check(await page.$('.imported-page') === null, 'Template choice leaves the original-layout renderer');
  check(errors.length === 0, `No browser runtime errors: ${errors.join('; ')}`);

  const result = { checks, templateImports, documentWrites, errors, note: 'Real built Studio bundle with local HTTP fixture; no production AI or CV data.' };
  await writeFile(resolve(artifacts, 'legacy-choice-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  server.close();
}
