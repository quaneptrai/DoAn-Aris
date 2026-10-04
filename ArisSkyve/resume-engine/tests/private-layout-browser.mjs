/*
 * Private layout verification for a pre-parsed PDF. This runner never reads an
 * original PDF or calls Aris/AiCore: it serves the built Studio bundle from a
 * localhost-only in-memory API. Keep both inputs outside the repository.
 *
 * PowerShell:
 *   $env:PRIVATE_LAYOUT_JSON = 'C:\\private\\parsed-layout.json'
 *   $env:PRIVATE_LAYOUT_ARTIFACT_DIR = 'C:\\private\\artifacts'
 *   node tests/private-layout-browser.mjs
 */
import { createServer } from 'node:http';
import { readFile, mkdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const engineRoot = resolve(here, '..');
const arisRoot = resolve(engineRoot, '..');
const wwwroot = resolve(arisRoot, 'wwwroot');
const require = createRequire(import.meta.url);
const puppeteer = require('../../node_modules/puppeteer-core');

const jsonPath = process.env.PRIVATE_LAYOUT_JSON;
const artifactPath = process.env.PRIVATE_LAYOUT_ARTIFACT_DIR;
const chromePath = process.env.PRIVATE_LAYOUT_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const token = 'private-layout-local-token';
const probe = `LAYOUT_EDIT_PROBE_${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;

const isWithin = (candidate, parent) => {
  const value = relative(parent, candidate);
  return value === '' || (!value.startsWith(`..${sep}`) && value !== '..' && !isAbsolute(value));
};

const requirePrivatePath = (value, name) => {
  if (!value || !isAbsolute(value)) throw new Error(`${name} must be an absolute path outside the repository.`);
  const absolute = resolve(value);
  if (isWithin(absolute, arisRoot)) throw new Error(`${name} must stay outside the repository.`);
  return absolute;
};

const jsonFile = requirePrivatePath(jsonPath, 'PRIVATE_LAYOUT_JSON');
const artifacts = requirePrivatePath(artifactPath, 'PRIVATE_LAYOUT_ARTIFACT_DIR');
if (!existsSync(jsonFile)) throw new Error('PRIVATE_LAYOUT_JSON does not exist.');
if (!existsSync(chromePath)) throw new Error('Chrome was not found; set PRIVATE_LAYOUT_CHROME.');

await mkdir(artifacts, { recursive: true });
const parsed = JSON.parse(await readFile(jsonFile, 'utf8'));
const layout = parsed?.data?.importedLayout;
if (!layout || !Array.isArray(layout.pages) || layout.pages.length === 0) {
  throw new Error('The private JSON does not contain an imported PDF layout.');
}

const inputStats = {
  pages: layout.pages.length,
  elements: layout.pages.reduce((total, page) => total + (Array.isArray(page.elements) ? page.elements.length : 0), 0),
  pageSizes: layout.pages.map(page => ({ width: page.width, height: page.height })),
};
const widths = inputStats.pageSizes.map(page => page.width);
const heights = inputStats.pageSizes.map(page => page.height);
inputStats.dimensionStats = {
  distinctPairs: new Set(inputStats.pageSizes.map(page => `${page.width.toFixed(6)}×${page.height.toFixed(6)}`)).size,
  widthRange: { min: Math.min(...widths), max: Math.max(...widths), delta: Math.max(...widths) - Math.min(...widths) },
  heightRange: { min: Math.min(...heights), max: Math.max(...heights), delta: Math.max(...heights) - Math.min(...heights) },
};
const printMeasureOnly = process.env.PRIVATE_LAYOUT_PRINT_MEASURE_ONLY === '1';
const printMatrixOnly = process.env.PRIVATE_LAYOUT_PRINT_MATRIX === '1';
const printSharedMatrixOnly = process.env.PRIVATE_LAYOUT_PRINT_SHARED_MATRIX === '1';
const printGlobalAutoOnly = process.env.PRIVATE_LAYOUT_PRINT_GLOBAL_AUTO === '1';
const printHeightMatrixOnly = process.env.PRIVATE_LAYOUT_PRINT_HEIGHT_MATRIX === '1';
const printHeightPlusMatrixOnly = process.env.PRIVATE_LAYOUT_PRINT_HEIGHT_PLUS_MATRIX === '1';
const printCascadeDiagnosticOnly = process.env.PRIVATE_LAYOUT_PRINT_CASCADE_DIAGNOSTIC === '1';

let stored = structuredClone(parsed.data);
let published = false;
let saveWrites = 0;
let publishWrites = 0;
let apiFailures = 0;
const apiRoutes = [];
const json = (res, value, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};

const contentType = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

const stripLeadingCssImport = css => {
  if (!css.startsWith('@import')) return css;
  let quote = '';
  let parentheses = 0;
  for (let index = '@import'.length; index < css.length; index++) {
    const character = css[index];
    if (quote) {
      if (character === '\\') {
        index++;
      } else if (character === quote) {
        quote = '';
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(') {
      parentheses++;
    } else if (character === ')') {
      parentheses = Math.max(0, parentheses - 1);
    } else if (character === ';' && parentheses === 0) {
      return css.slice(index + 1);
    }
  }
  return css;
};

const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.startsWith('/api/resume-engine/')) {
      apiRoutes.push(`${req.method} ${path.replace(/\/[0-9]+(?=\/|$)/g, '/:id')}`);
      if (path.endsWith('/session') && req.method === 'GET') return json(res, { token, userId: 'private-layout-test' });
      if (path.endsWith('/capabilities') && req.method === 'GET') return json(res, { layoutOcr: false, layoutOcrReason: 'fixture_ocr_disabled' });
      if (req.method === 'POST' && req.headers.requestverificationtoken !== token) return json(res, { error: 'CSRF missing' }, 400);
      if (path.endsWith('/document') && req.method === 'POST') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body?.data?.importedLayout) return json(res, { error: 'Expected positioned layout' }, 422);
        stored = body.data;
        saveWrites++;
        return json(res, { resumeId: 7, published, aiSync: 'pending' });
      }
      if (path.endsWith('/document/7/publish') && req.method === 'POST') {
        published = true;
        publishWrites++;
        return json(res, { published, url: '/portfolio/7' });
      }
      if (path.endsWith('/document/7/unpublish') && req.method === 'POST') {
        published = false;
        return json(res, { published });
      }
      if (path.endsWith('/document/7') && req.method === 'GET') {
        return json(res, { data: stored, templateId: 't1', published, resumeId: 7 });
      }
      if (path.endsWith('/public/7') && req.method === 'GET') {
        return published ? json(res, { data: stored, templateId: 't1' }) : json(res, { error: 'Not found' }, 404);
      }
      apiFailures++;
      return json(res, { error: 'Unexpected private harness API request' }, 404);
    }

    const requested = path.startsWith('/portfolio/')
      ? '/resume-engine/index.html'
      : path.endsWith('/') ? `${path}index.html` : path;
    const target = resolve(wwwroot, `.${requested}`);
    if (!isWithin(target, wwwroot)) {
      res.writeHead(403).end();
      return;
    }
    let file = await readFile(target);
    if (target.endsWith(`${sep}app.css`)) {
      // The built stylesheet imports Google Fonts. Remove that line so this
      // private run has no opportunity to make a non-local request.
      file = Buffer.from(stripLeadingCssImport(file.toString('utf8')), 'utf8');
    }
    res.writeHead(200, { 'Content-Type': contentType[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(file);
  } catch {
    res.writeHead(404).end();
  }
});

const waitFor = async (predicate, timeoutMs = 8_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for the local in-memory API.');
    await new Promise(resolveWait => setTimeout(resolveWait, 25));
  }
};

const inspectPdf = file => {
  const python = process.env.PRIVATE_LAYOUT_PYTHON || 'python';
  const code = [
    'import json, sys',
    'import pymupdf as fitz',
    'document = fitz.open(sys.argv[1])',
    "print(json.dumps({'pages': len(document), 'pageSizes': [[round(page.rect.width, 3), round(page.rect.height, 3)] for page in document], 'imageCounts': [len(page.get_images(full=True)) for page in document], 'imageBboxes': [[[round(value, 3) for value in info['bbox']] for info in page.get_image_info()] for page in document], 'textCharCounts': [len(page.get_text()) for page in document]}))",
    'document.close()',
  ].join('\n');
  const inspected = spawnSync(python, ['-c', code, file], { encoding: 'utf8', timeout: 30_000, windowsHide: true });
  if (inspected.status !== 0) throw new Error('Local PDF metadata inspection failed.');
  try {
    return JSON.parse(inspected.stdout.trim());
  } catch {
    throw new Error('Local PDF metadata was not valid JSON.');
  }
};

const equalPageSizes = (actual, expected) => actual.length === expected.length && actual.every((page, index) =>
  Math.abs(page[0] - expected[index].width) <= 0.5 && Math.abs(page[1] - expected[index].height) <= 0.5);

let browser;
let blockedRequests = 0;
let pageErrors = 0;
let result;
let stage = 'startup';
let domState = null;
let pdfMetadata = null;
let printDom = null;
let printMatrix = null;
let printCascade = null;
try {
  stage = 'start-local-server';
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const base = `http://127.0.0.1:${server.address().port}`;
  stage = 'launch-browser';
  browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run'],
    userDataDir: resolve(artifacts, 'chrome-profile'),
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  page.on('request', request => {
    try {
      const url = new URL(request.url());
      const local = url.origin === base || ['data:', 'blob:', 'about:'].includes(url.protocol);
      if (local) void request.continue();
      else {
        blockedRequests++;
        void request.abort('blockedbyclient');
      }
    } catch {
      blockedRequests++;
      void request.abort('blockedbyclient');
    }
  });
  page.on('pageerror', () => { pageErrors++; });

  stage = 'load-built-studio';
  await page.goto(`${base}/resume-engine/?resumeId=7`, { waitUntil: 'networkidle0' });
  try {
    await page.waitForSelector('.imported-page');
  } catch {
    domState = await page.evaluate(() => ({
      studioRoots: document.querySelectorAll('.word-studio').length,
      loadingViews: document.querySelectorAll('.studio-loading').length,
      importedPages: document.querySelectorAll('.imported-page').length,
      overlays: document.querySelectorAll('.imported-text').length,
      alerts: document.querySelectorAll('[role="alert"]').length,
    }));
    throw new Error('The built Studio did not render a positioned-layout page.');
  }
  stage = 'select-unique-overlay';
  const initial = await page.$$eval('.imported-text', elements => {
    const values = elements.map(element => element.textContent?.trim() || '');
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    const index = values.findIndex(value => value.length > 0 && counts.get(value) === 1);
    const element = index >= 0 ? elements[index] : null;
    return {
      index,
      pageCount: document.querySelectorAll('.imported-page').length,
      overlayCount: elements.length,
      signature: element ? {
        left: element.style.left,
        top: element.style.top,
        width: element.style.width,
        minHeight: element.style.minHeight,
        fontSize: element.style.fontSize,
        fontFamily: element.style.fontFamily,
        color: element.style.color,
        fontWeight: element.style.fontWeight,
        fontStyle: element.style.fontStyle,
      } : null,
    };
  });
  assert.equal(initial.pageCount, inputStats.pages, 'The built Studio must render every source page.');
  assert.equal(initial.overlayCount, inputStats.elements, 'The built Studio must render every positioned text overlay.');
  assert.ok(initial.index >= 0, 'The layout must contain one uniquely-addressable non-empty text overlay.');
  assert.ok(initial.signature?.left && initial.signature?.top && initial.signature?.fontSize, 'The selected overlay must retain source geometry.');

  stage = 'activate-unique-overlay';
  await page.evaluate(index => {
    const element = document.querySelectorAll('.imported-text')[index];
    if (!(element instanceof HTMLElement)) throw new Error('Overlay selection target is unavailable.');
    element.click();
  }, initial.index);
  stage = 'wait-for-overlay-editor';
  const editor = await page.waitForSelector('.imported-tools textarea');
  stage = 'edit-overlay';
  await editor.click();
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.type(probe);
  await page.waitForFunction(value => [...document.querySelectorAll('.imported-text')].some(element => element.textContent === value), {}, probe);
  const afterEdit = await page.$$eval('.imported-text', (elements, value) => {
    const element = elements.find(candidate => candidate.textContent === value);
    if (!element) return null;
    return {
      left: element.style.left,
      top: element.style.top,
      width: element.style.width,
      minHeight: element.style.minHeight,
      fontSize: element.style.fontSize,
      fontFamily: element.style.fontFamily,
      color: element.style.color,
      fontWeight: element.style.fontWeight,
      fontStyle: element.style.fontStyle,
    };
  }, probe);
  assert.deepEqual(afterEdit, initial.signature, 'Editing text must not alter its position or style.');

  stage = 'save-and-reload';
  await page.click('.title-actions button:not(.coach-button):not(.publish-button)');
  await waitFor(() => saveWrites === 1);
  assert.ok(JSON.stringify(stored).includes(probe), 'The local save payload must contain the edited overlay.');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(value => [...document.querySelectorAll('.imported-text')].some(element => element.textContent === value), {}, probe);
  assert.deepEqual(await page.$$eval('.imported-text', (elements, value) => {
    const element = elements.find(candidate => candidate.textContent === value);
    return element ? {
      left: element.style.left,
      top: element.style.top,
      width: element.style.width,
      minHeight: element.style.minHeight,
      fontSize: element.style.fontSize,
      fontFamily: element.style.fontFamily,
      color: element.style.color,
      fontWeight: element.style.fontWeight,
      fontStyle: element.style.fontStyle,
    } : null;
  }, probe), initial.signature, 'Reload must preserve the edited overlay geometry and style.');

  // Keep an editable-shell screenshot after reload, but print from the public
  // renderer below. Even with no selected fieldset, Chromium can paginate the
  // editing shell into blank Letter pages around named imported pages.
  if (!printMeasureOnly && !printMatrixOnly && !printSharedMatrixOnly && !printGlobalAutoOnly && !printHeightMatrixOnly && !printHeightPlusMatrixOnly && !printCascadeDiagnosticOnly) {
    await page.screenshot({ path: resolve(artifacts, 'edited-layout.png'), fullPage: true });
  }

  stage = 'publish-local-only';
  await page.click('.publish-button');
  await waitFor(() => publishWrites === 1);
  assert.ok(saveWrites >= 2, 'Publishing must save the in-memory document before making it public.');
  await page.goto(`${base}/portfolio/7`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(value => [...document.querySelectorAll('.imported-text')].some(element => element.textContent === value), {}, probe);
  assert.equal(await page.$('.imported-tools'), null, 'The public layout must not expose editor controls.');
  if (!printMeasureOnly && !printMatrixOnly && !printSharedMatrixOnly && !printGlobalAutoOnly && !printHeightMatrixOnly && !printHeightPlusMatrixOnly && !printCascadeDiagnosticOnly) {
    await page.screenshot({ path: resolve(artifacts, 'public-layout.png'), fullPage: true });
  }

  stage = 'export-private-artifacts';
  const pdfPath = resolve(artifacts, 'edited-layout.pdf');
  const printIsolation = process.env.PRIVATE_LAYOUT_PRINT_DISPLAY_CONTENTS === '1';
  const printGlobalFirstPage = process.env.PRIVATE_LAYOUT_PRINT_GLOBAL_FIRST_PAGE === '1';
  if (printIsolation) {
    await page.addStyleTag({ content: '@media print { .imported-document { display: contents !important; } }' });
  }
  if (printGlobalFirstPage) {
    const firstPage = layout.pages[0];
    await page.addStyleTag({ content: `@page { size: ${firstPage.width}pt ${firstPage.height}pt; margin: 0; } @media print { .imported-page { page: auto !important; } }` });
  }
  await page.emulateMediaType('print');
  printDom = await page.evaluate(pageSizes => {
    const documentRoot = document.querySelector('.imported-document');
    const pages = [...document.querySelectorAll('.imported-page')];
    const box = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        top: Number(rect.top.toFixed(3)),
        height: Number(rect.height.toFixed(3)),
        bottom: Number(rect.bottom.toFixed(3)),
        margin: [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft],
        border: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
        display: style.display,
        position: style.position,
        height: style.height,
        minHeight: style.minHeight,
      };
    };
    const root = document.getElementById('root');
    return {
      bodyScrollHeight: document.body.scrollHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      expectedPageCssPx: pageSizes.map(size => ({
        width: Number((size.width * 96 / 72).toFixed(3)),
        height: Number((size.height * 96 / 72).toFixed(3)),
      })),
      sectionCount: document.querySelectorAll('section').length,
      importedPageCount: pages.length,
      interactiveOnlyCount: document.querySelectorAll('.interactive-only').length,
      parentChildTags: documentRoot ? [...documentRoot.children].map(child => child.tagName) : [],
      pageRoots: {
        html: box(document.documentElement),
        body: box(document.body),
        root: root ? box(root) : null,
        rootChildTags: root ? [...root.children].map(child => child.tagName) : [],
        rootChildren: root ? [...root.children].map(child => box(child)) : [],
      },
      document: documentRoot ? box(documentRoot) : null,
      pages: pages.map(page => {
        const style = getComputedStyle(page);
        return {
          isLastChild: page.matches('.imported-page:last-child'),
          computedHeight: style.height,
          importHeight: style.getPropertyValue('--import-height'),
          inlineHeight: page.style.getPropertyValue('height'),
          inlineHeightPriority: page.style.getPropertyPriority('height'),
          breakAfter: style.breakAfter,
          pageBreakAfter: style.pageBreakAfter,
          page: style.getPropertyValue('page'),
          box: box(page),
        };
      }),
    };
  }, inputStats.pageSizes);
  if (printCascadeDiagnosticOnly) {
    printCascade = await page.evaluate(async () => {
      const target = document.querySelector('.imported-page');
      const computed = getComputedStyle(target);
      const matchingRules = [];
      const stylesheets = [];
      const visitRules = (rules, sheetIndex, context = [], prefix = '') => {
        for (let index = 0; index < rules.length; index++) {
          const rule = rules[index];
          const order = prefix ? `${prefix}.${index}` : `${index}`;
          if (typeof rule.selectorText === 'string') {
            try {
              if (target.matches(rule.selectorText) && rule.style.getPropertyValue('height')) {
                matchingRules.push({
                  selector: rule.selectorText,
                  height: rule.style.getPropertyValue('height'),
                  priority: rule.style.getPropertyPriority('height'),
                  context,
                  sourceOrder: `${sheetIndex}:${order}`,
                });
              }
            } catch {}
          }
          try {
            if (rule.cssRules) {
              const label = rule.conditionText ? `${rule.constructor.name}:${rule.conditionText}` : rule.constructor.name;
              visitRules(rule.cssRules, sheetIndex, [...context, label], order);
            }
          } catch {}
        }
      };
      for (let sheetIndex = 0; sheetIndex < document.styleSheets.length; sheetIndex++) {
        try {
          const rules = document.styleSheets[sheetIndex].cssRules;
          stylesheets.push({ index: sheetIndex, kind: document.styleSheets[sheetIndex].href ? 'external' : 'inline', ruleCount: rules.length });
          visitRules(rules, sheetIndex);
        } catch {
          stylesheets.push({ index: sheetIndex, kind: 'unreadable', ruleCount: 0 });
        }
      }
      const appCss = await fetch('/resume-engine/app.css').then(response => response.text());
      const normalized = appCss.replaceAll(/\s+/g, '');
      const importantRules = matchingRules.filter(rule => rule.priority === 'important');
      return {
        builtRulePresent: normalized.includes('height:calc(var(--import-height)-.05px)!important'),
        computedHeight: computed.height,
        importHeight: computed.getPropertyValue('--import-height'),
        inlineHeight: target.style.getPropertyValue('height'),
        inlineHeightPriority: target.style.getPropertyPriority('height'),
        rectHeight: Number(target.getBoundingClientRect().height.toFixed(6)),
        documentScrollHeight: document.documentElement.scrollHeight,
        stylesheets,
        matchingRules,
        lastImportantRule: importantRules.at(-1) || null,
      };
    });
  }
  if (printMatrixOnly || printSharedMatrixOnly || printGlobalAutoOnly || printHeightMatrixOnly || printHeightPlusMatrixOnly || printCascadeDiagnosticOnly) {
    const pageHeightRules = delta => layout.pages.map((page, index) =>
      `.imported-page-${index} { height: ${(page.height * 96 / 72 + delta).toFixed(3)}px !important; min-height: 0 !important; }`).join('');
    const firstPage = layout.pages[0];
    const sharedPage = `@page shared { size: ${firstPage.width}pt ${firstPage.height}pt; margin: 0; }`;
    const globalAutoCss = delta => `@page { size: ${firstPage.width}pt ${firstPage.height}pt; margin: 0; } @media print { .imported-page { page: auto !important; break-inside: auto !important; page-break-inside: auto !important; overflow: hidden !important; } .imported-page:not(:last-child) { break-after: page !important; page-break-after: always !important; } .imported-page:last-child { break-after: auto !important; page-break-after: auto !important; } ${pageHeightRules(delta)} }`;
    const variants = printCascadeDiagnosticOnly ? [
      { id: 'same-source-height', css: '@media print { .imported-page { height: calc(var(--import-height) - .05px) !important; } }' },
      { id: 'variable-height-minus-0.10', css: '@media print { .imported-page { height: calc(var(--import-height) - .1px) !important; } }' },
      { id: 'literal-height-minus-0.10', css: `@media print { .imported-page { height: calc(${(firstPage.height * 96 / 72).toFixed(3)}px - .1px) !important; } }` },
    ] : printHeightMatrixOnly ? [-0.05, -0.1, -0.25, -0.5].map(delta => ({ id: `height-minus-${Math.abs(delta).toFixed(2)}`, css: globalAutoCss(delta) })) : printHeightPlusMatrixOnly ? [0.05, 0.1].map(delta => ({ id: `height-plus-${delta.toFixed(2)}`, css: globalAutoCss(delta) })) : printGlobalAutoOnly ? [
      { id: 'global-auto-explicit-break', css: `@page { size: ${firstPage.width}pt ${firstPage.height}pt; margin: 0; } @media print { .imported-page { page: auto !important; break-inside: auto !important; page-break-inside: auto !important; } .imported-page:not(:last-child) { break-after: page !important; page-break-after: always !important; } .imported-page:last-child { break-after: auto !important; page-break-after: auto !important; } }` },
    ] : printSharedMatrixOnly ? [
      { id: 'shared-children-explicit-break', css: `${sharedPage} @media print { .imported-page { page: shared !important; break-inside: auto !important; page-break-inside: auto !important; } .imported-page:not(:last-child) { break-after: page !important; page-break-after: always !important; } .imported-page:last-child { break-after: auto !important; page-break-after: auto !important; } }` },
      { id: 'shared-parent-auto-children', css: `${sharedPage} @media print { body, .imported-document { page: shared !important; } .imported-page { page: auto !important; break-inside: auto !important; page-break-inside: auto !important; } .imported-page:not(:last-child) { break-after: page !important; page-break-after: always !important; } .imported-page:last-child { break-after: auto !important; page-break-after: auto !important; } }` },
    ] : [
      { id: 'page-auto', css: '@media print { .imported-page { page: auto !important; } }' },
      { id: 'page-auto-explicit-break', css: '@media print { .imported-page { page: auto !important; break-inside: auto !important; page-break-inside: auto !important; } .imported-page:not(:last-child) { break-after: page !important; page-break-after: always !important; } .imported-page:last-child { break-after: auto !important; page-break-after: auto !important; } }' },
      { id: 'named-last-avoid', css: '@media print { .imported-page:last-child { break-after: avoid-page !important; page-break-after: avoid !important; } }' },
      { id: 'no-break-inside', css: '@media print { .imported-page { break-inside: auto !important; page-break-inside: auto !important; } }' },
      { id: 'height-exact', css: `@media print { ${pageHeightRules(0)} }` },
      { id: 'height-minus-0.01', css: `@media print { ${pageHeightRules(-0.01)} }` },
    ];
    printMatrix = [];
    for (const variant of variants) {
      const tag = await page.addStyleTag({ content: variant.css });
      await page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
      const computed = await page.$$eval('.imported-page', pages => pages.map(page => {
        const style = getComputedStyle(page);
        return { page: style.getPropertyValue('page'), computedHeight: style.height, breakAfter: style.breakAfter, pageBreakAfter: style.pageBreakAfter, breakInside: style.breakInside };
      }));
      const parentPages = await page.evaluate(() => ({
        body: getComputedStyle(document.body).getPropertyValue('page'),
        document: getComputedStyle(document.querySelector('.imported-document')).getPropertyValue('page'),
      }));
      const variantPdf = resolve(artifacts, `print-matrix-${variant.id}.pdf`);
      await page.pdf({ path: variantPdf, printBackground: true, preferCSSPageSize: true });
      const metadata = inspectPdf(variantPdf);
      const backgroundCropIndicators = metadata.imageBboxes.map((boxes, pageIndex) => {
        const [width, height] = metadata.pageSizes[pageIndex];
        return !boxes.some(([left, top, right, bottom]) => left <= 0.5 && top <= 0.5 && Math.abs(right - width) <= 0.5 && Math.abs(bottom - height) <= 0.5);
      });
      printMatrix.push({
        id: variant.id,
        pages: metadata.pages,
        imageCounts: metadata.imageCounts,
        pageSizes: metadata.pageSizes,
        backgroundCropIndicators,
        computed,
        parentPages,
      });
      await unlink(variantPdf);
      await tag.evaluate(element => element.remove());
      await page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(resolveFrame)));
    }
  } else if (!printMeasureOnly) {
    await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
  }
  await page.emulateMediaType('screen');
  if (!printMeasureOnly && !printMatrixOnly && !printSharedMatrixOnly && !printGlobalAutoOnly && !printHeightMatrixOnly && !printHeightPlusMatrixOnly && !printCascadeDiagnosticOnly) {
    pdfMetadata = inspectPdf(pdfPath);
    assert.equal(pdfMetadata.pages, inputStats.pages, 'Exported PDF must contain exactly the imported page count.');
    assert.ok(equalPageSizes(pdfMetadata.pageSizes, inputStats.pageSizes), 'Exported PDF pages must retain imported dimensions.');
    assert.ok(pdfMetadata.imageCounts.every(count => count >= 1), 'Every exported page must retain its original-layout background image.');
  }

  stage = 'final-private-assertions';
  assert.equal(apiFailures, 0, 'The Studio must not call unmocked APIs in this private run.');
  assert.equal(pageErrors, 0, 'The real built Studio must have no browser runtime errors.');
  assert.equal(blockedRequests, 0, 'The private run must not attempt a non-local browser request.');
  result = {
    status: 'passed',
    stage,
    ...inputStats,
    editedOverlayIndex: initial.index,
    savedWrites: saveWrites,
    publishWrites,
    blockedRequests,
    pageErrors,
    apiRoutes: [...new Set(apiRoutes)],
    pdf: pdfMetadata,
    printIsolation,
    printGlobalFirstPage,
    printMeasureOnly,
    printMatrixOnly,
    printSharedMatrixOnly,
    printGlobalAutoOnly,
    printHeightMatrixOnly,
    printHeightPlusMatrixOnly,
    printCascadeDiagnosticOnly,
    printDom,
    printCascade,
    printMatrix,
    artifacts: printMeasureOnly || printMatrixOnly || printSharedMatrixOnly || printGlobalAutoOnly || printHeightMatrixOnly || printHeightPlusMatrixOnly || printCascadeDiagnosticOnly ? [] : ['edited-layout.png', 'edited-layout.pdf', 'public-layout.png'],
    note: 'Private localhost fixture only; report intentionally excludes CV text, names, and paths.',
  };
} catch (error) {
  result = {
    status: 'failed',
    errorType: error?.name || 'Error',
    stage,
    ...inputStats,
    savedWrites: saveWrites,
    publishWrites,
    blockedRequests,
    pageErrors,
    apiRoutes: [...new Set(apiRoutes)],
    domState,
    pdf: pdfMetadata,
    printDom,
    printMatrix,
    printCascade,
    note: 'Private run failed; report intentionally excludes CV text, names, paths, and error messages.',
  };
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server.listening) await new Promise(resolveClose => server.close(resolveClose));
  await writeFile(resolve(artifacts, 'private-layout-report.json'), JSON.stringify(result, null, 2));
}

console.log(JSON.stringify(result));
