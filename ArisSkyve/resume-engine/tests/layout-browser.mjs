import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const puppeteer = require('../../node_modules/puppeteer-core');
const root = resolve('../wwwroot');
const artifacts = resolve('../../.local/cv-browser'); await mkdir(artifacts, { recursive: true });
const fixture = JSON.parse(await readFile('../../.local/cv-layout-fixture.json', 'utf8'));
fixture.data.importedLayout.pages[0].elements[1].href = 'mailto:alex@example.com';
fixture.data.importedLayout.pages[0].elements[2].href = 'https://linkedin.com/in/alex';
const ownerSelectedName = fixture.data.importedLayout.pages[0].elements[2];
const editedName = 'Updated Example With Extra Text';
let stored = structuredClone(fixture.data), published = false, writes = 0, coachText = '', offline = true;
const json = (res, value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.startsWith('/api/')) {
      let body = ''; for await (const part of req) body += part;
      if (path.endsWith('/session')) return json(res, { userId: 7, token: 'fixture' });
      if (path.endsWith('/capabilities')) return json(res, { layoutOcr: false, layoutOcrReason: 'fixture_ocr_disabled' });
      if (path.endsWith('/coach')) { coachText = body; return json(res, { status: 'success', cv_skills: ['Python'], roles: [], titles_indexed: true }); }
      if (path.endsWith('/parse')) { assert.match(body, /name="mode"\r\n\r\nlayout/); return json(res, fixture); }
      if (path.endsWith('/document') && req.method === 'POST') { const data = JSON.parse(body); stored = data.data; writes++; return json(res, { resumeId: 7, published, aiSync: offline ? 'pending' : 'scheduled' }); }
      if (path.endsWith('/unpublish')) { published = false; return json(res, { published }); }
      if (path.endsWith('/publish')) { published = true; return json(res, { published, url: '/portfolio/7' }); }
      if (path.endsWith('/document/7')) return json(res, { data: stored, templateId: 't1', published, resumeId: 7 });
      if (path.endsWith('/public/7')) return json(res, published ? { data: stored, templateId: 't1' } : { error: 'Not found' }, published ? 200 : 404);
      return json(res, { error: 'Not mocked' }, 404);
    }
    const file = resolve(root, '.' + (path.startsWith('/portfolio/') ? '/resume-engine/index.html' : path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file));
  } catch (e) { res.writeHead(500).end(String(e)); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'], userDataDir: resolve(artifacts, 'chrome') });
const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1050 });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; console.log('PASS ' + message); };
const clickText = async (selector, text) => { assert.ok(await page.evaluate((s,t) => { const e = [...document.querySelectorAll(s)].find(e => e.textContent.includes(t)); e?.click(); return !!e; }, selector, text), text); };
const layoutPosition = (id) => page.$eval(`[data-layout-id="${id}"]`, element => ({
  x: Number.parseFloat(element.style.left),
  y: Number.parseFloat(element.style.top),
  page: Number(element.getAttribute('data-page-index')),
}));
let addedBlockId = '';
let addedBlockPosition = null;
try {
  await page.goto(base + '/resume-engine/?resumeId=7', { waitUntil: 'networkidle0' });
  check(await page.$$eval('.imported-page', es => es.length === 2), 'Uploaded PDF retains two pages');
  check(await page.$eval('.imported-text', e => e.textContent === 'Alex Example'), 'Real editable text, not only screenshot');
  const packagedFallback = await page.evaluate(async () => {
    const faces = await document.fonts.load('16px "Aris Carlito"', 'Alex Example');
    return faces.some(face => face.family.replaceAll('"', '') === 'Aris Carlito');
  });
  check(packagedFallback, 'A local metric-compatible Carlito fallback is bundled and loadable');
  check(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.endsWith('/resume-engine/fonts/carlito-regular.ttf'))), 'Imported layout fetches its fallback from the local bundle');
  const sourceFit = await page.evaluate(async () => {
    const node = document.querySelector('.imported-text');
    node.style.fontFamily = 'Arial, sans-serif';
    node.style.fontSize = '52pt';
    window.dispatchEvent(new Event('resize'));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const scale = Number(getComputedStyle(node).getPropertyValue('--import-text-scale-x'));
    const result = { intrinsicOverflow: node.scrollWidth > node.clientWidth + 1, scale, visualWidth: node.getBoundingClientRect().width, unscaledWidth: node.offsetWidth, alert: !!document.querySelector('.imported-overflow') };
    node.style.fontFamily = '';
    node.style.fontSize = '';
    window.dispatchEvent(new Event('resize'));
    await new Promise(resolve => requestAnimationFrame(resolve));
    return result;
  });
  check(sourceFit.intrinsicOverflow && sourceFit.scale < 1 && sourceFit.visualWidth <= sourceFit.unscaledWidth + 1 && !sourceFit.alert, 'An unedited source line horizontally fits a mismatched font without blocking save');
  const originalTextCount = await page.$$eval('.imported-text', elements => elements.length);
  await page.select('.imported-add-controls select', '0');
  await page.click('.imported-add-controls button');
  await page.waitForFunction(count => document.querySelectorAll('.imported-text').length === count + 1, {}, originalTextCount);
  const transientBlock = await page.$eval('.imported-text.selected', element => ({
    id: element.getAttribute('data-layout-id'),
    textEdited: element.getAttribute('data-text-edited'),
    page: element.getAttribute('data-page-index'),
  }));
  check(typeof transientBlock.id === 'string' && /^added-[a-z0-9]+$/i.test(transientBlock.id) && transientBlock.id.length <= 80 && transientBlock.textEdited === 'true' && transientBlock.page === '0', 'Adding a text block creates a bounded edited element on the chosen original page');
  await page.click('.imported-name-choice');
  await page.waitForFunction(() => document.querySelector('.imported-name-choice')?.getAttribute('aria-pressed') === 'true');
  await page.click('.imported-delete');
  await page.waitForFunction((count, id) => document.querySelectorAll('.imported-text').length === count && !document.querySelector(`[data-layout-id="${id}"]`), {}, originalTextCount, transientBlock.id);
  check(await page.$eval('.document-title strong', (title, originalName) => title.textContent.trim() === originalName, fixture.data.basics.name), 'Deleting the chosen-name block clears the name reference and restores a safe fallback');
  await page.click('.canvas-note');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
  await page.waitForFunction(id => !!document.querySelector(`[data-layout-id="${id}"]`), {}, transientBlock.id);
  await page.click(`[data-layout-id="${transientBlock.id}"]`);
  await page.waitForSelector('.imported-name-choice');
  check(await page.$eval('.imported-name-choice', choice => choice.getAttribute('aria-pressed') === 'true'), 'Undo restores a deleted selected text block and its name choice');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyY'); await page.keyboard.up('Control');
  await page.waitForFunction(id => !document.querySelector(`[data-layout-id="${id}"]`), {}, transientBlock.id);
  check(true, 'Redo removes the text block again without changing other page geometry');
  await page.click('.imported-add-controls button');
  await page.waitForSelector('.imported-text.selected');
  addedBlockId = await page.$eval('.imported-text.selected', element => element.getAttribute('data-layout-id'));
  assert.ok(addedBlockId, 'The permanent test block must have an id');
  const beforeDrag = await layoutPosition(addedBlockId);
  await page.$eval(`[data-layout-id="${addedBlockId}"]`, element => element.scrollIntoView({ block: 'center', inline: 'center' }));
  const dragTarget = await page.$(`[data-layout-id="${addedBlockId}"]`);
  const dragBox = await dragTarget.boundingBox();
  assert.ok(dragBox, 'The selected text block must have a rendered box');
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + dragBox.width / 2 + 72, dragBox.y + dragBox.height / 2 + 36, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction((id, before) => {
    const element = document.querySelector(`[data-layout-id="${id}"]`);
    return !!element && Number.parseFloat(element.style.left) > before.x + 2 && Number.parseFloat(element.style.top) > before.y + 2;
  }, {}, addedBlockId, beforeDrag);
  const afterDrag = await layoutPosition(addedBlockId);
  check(afterDrag.x > beforeDrag.x + 2 && afterDrag.y > beforeDrag.y + 2 && afterDrag.page === 0, 'Pointer dragging converts rendered coordinates back into the selected PDF page geometry');
  await page.$eval(`[data-layout-id="${addedBlockId}"]`, element => element.focus());
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((id, moved) => Number.parseFloat(document.querySelector(`[data-layout-id="${id}"]`).style.left) > moved.x, {}, addedBlockId, afterDrag);
  const afterNudge = await layoutPosition(addedBlockId);
  check(afterNudge.x > afterDrag.x && afterNudge.y === afterDrag.y, 'A focused selected block is keyboard-accessible and nudges by one PDF point');
  await page.click('.canvas-note');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
  await page.waitForFunction((id, moved) => Math.abs(Number.parseFloat(document.querySelector(`[data-layout-id="${id}"]`).style.left) - moved.x) < .01, {}, addedBlockId, afterDrag);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
  await page.waitForFunction((id, before) => Math.abs(Number.parseFloat(document.querySelector(`[data-layout-id="${id}"]`).style.left) - before.x) < .01, {}, addedBlockId, beforeDrag);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyY'); await page.keyboard.up('Control');
  await page.waitForFunction((id, moved) => Math.abs(Number.parseFloat(document.querySelector(`[data-layout-id="${id}"]`).style.left) - moved.x) < .01, {}, addedBlockId, afterDrag);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyY'); await page.keyboard.up('Control');
  await page.waitForFunction((id, nudged) => Math.abs(Number.parseFloat(document.querySelector(`[data-layout-id="${id}"]`).style.left) - nudged.x) < .01, {}, addedBlockId, afterNudge);
  addedBlockPosition = afterNudge;
  check(true, 'Drag and keyboard moves each remain undoable and redoable as separate coalesced history actions');
  const coords = await page.$eval('.imported-text', e => [e.style.left, e.style.top, e.style.fontSize]);
  await page.click('.imported-text');
  const input = 'textarea[aria-label="Nội dung khối chữ"]';
  await page.waitForSelector(input);
  await page.evaluate(() => {
    window.__layoutCloneCount = 0;
    const original = window.structuredClone;
    window.structuredClone = value => { window.__layoutCloneCount++; return original(value); };
    window.__draftWriteCount = 0;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === window.sessionStorage && String(key).startsWith('aris-draft:')) window.__draftWriteCount++;
      return originalSetItem.call(this, key, value);
    };
  });
  await page.click(input); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.type(input, editedName);
  check(await page.$eval('.imported-text', (element, name) => element.textContent === name, editedName), 'Text edits render immediately in original position');
  check(await page.$eval('.imported-text', e => e.dataset.textEdited === 'true'), 'A user-edited line is persisted as distinct from source PDF text');
  check(await page.evaluate(() => window.__layoutCloneCount) === 0, 'Typing in a positioned block does not clone the whole layout per key');
  await new Promise(resolve => setTimeout(resolve, 550));
  check(await page.evaluate(() => window.__draftWriteCount) === 1, 'A typing burst produces one debounced session draft write');
  await page.click('.canvas-note');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
  await page.waitForFunction(() => document.querySelector('.imported-text')?.textContent === 'Alex Example');
  check(true, 'One undo reverts the whole coalesced positioned-text typing burst');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyY'); await page.keyboard.up('Control');
  await page.waitForFunction(name => document.querySelector('.imported-text')?.textContent === name, {}, editedName);
  check(true, 'Redo restores the coalesced positioned-text typing burst');
  assert.deepEqual(await page.$eval('.imported-text', e => [e.style.left, e.style.top, e.style.fontSize]), coords); checks++;
  await page.waitForFunction(() => document.querySelector('[role="alert"]') !== null);
  const editedMetrics = await page.$eval('.imported-text', node => ({ textEdited: node.dataset.textEdited, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scale: getComputedStyle(node).getPropertyValue('--import-text-scale-x'), alert: !!document.querySelector('[role="alert"]') }));
  check(editedMetrics.alert, 'Long positioned text is flagged before it can overlap the next block');
  await clickText('.title-actions button', 'Lưu CV');
  await page.waitForFunction(() => document.body.textContent.includes('Có chữ vượt khối gốc'));
  check(writes === 0, 'Overflowing positioned text cannot be saved');
  await page.click('input[aria-label="Rộng"]'); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.type('input[aria-label="Rộng"]', '400');
  await page.waitForFunction(() => !document.querySelector('.imported-overflow'));
  await clickText('.title-actions button', 'Lưu CV');
  await page.waitForFunction(() => document.querySelector('.studio-messages')?.textContent.includes('AI chưa nhận'));
  const savedAddedBlock = stored.importedLayout.pages[0].elements.find(element => element.id === addedBlockId);
  check(writes === 1 && stored.basics.name === editedName && stored.importedLayout.pages[0].elements[0].text === editedName && stored.importedLayout.pages[0].elements[0].textEdited === true && savedAddedBlock?.textEdited === true && Math.abs(savedAddedBlock.x - addedBlockPosition.x) < .01 && Math.abs(savedAddedBlock.y - addedBlockPosition.y) < .01, 'Save preserves edited text plus an added, repositioned layout block and pending AI acknowledgement');
  // A new edit to the very same positioned element must start a fresh undo
  // group after saving. Undoing it returns to the saved object identity, which
  // must also clear dirty state and the debounced recovery draft.
  await page.click('.imported-text');
  await page.waitForSelector(input);
  await page.click(input); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.type(input, 'Post-save edit');
  await page.waitForFunction(() => document.querySelector('.document-title')?.textContent?.includes('Chưa lưu'));
  await new Promise(resolve => setTimeout(resolve, 550));
  check(await page.evaluate(() => sessionStorage.getItem('aris-draft:7:7') !== null), 'A post-save edit creates a recovery draft while it is dirty');
  await page.click('.canvas-note');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
  await page.waitForFunction(name => document.querySelector('.imported-text')?.textContent === name, {}, editedName);
  await page.waitForFunction(() => document.querySelector('.document-title')?.textContent?.includes('Đã lưu'));
  await page.waitForFunction(() => sessionStorage.getItem('aris-draft:7:7') === null);
  check(true, 'Undo after save restores the saved same-element version and clears dirty draft state');
  offline = false;
  await page.reload({ waitUntil: 'networkidle0' });
  check(await page.$eval('.imported-text', (element, name) => element.textContent === name, editedName), 'Reload displays saved edited text');
  const reloadedAddedBlock = await layoutPosition(addedBlockId);
  check(reloadedAddedBlock.page === 0 && Math.abs(reloadedAddedBlock.x - addedBlockPosition.x) < .01 && Math.abs(reloadedAddedBlock.y - addedBlockPosition.y) < .01, 'Reload preserves the added block’s PDF-page position');
  // The initial overlay is a document heading, but users must be able to choose
  // another real text block as their identity instead of accepting parser order.
  // Use the distinct third fixture element to prove this is an owner decision,
  // not a side-effect of editing the first span.
  check(await page.evaluate(target => {
    const element = [...document.querySelectorAll('.imported-text')].find(node => node.textContent === target);
    element?.click();
    return !!element;
  }, ownerSelectedName.text), 'A second imported text block can be selected as the CV name');
  await page.waitForSelector('.imported-name-choice');
  await page.click('.imported-name-choice');
  await page.waitForFunction(target => {
    const choice = document.querySelector('.imported-name-choice');
    const title = document.querySelector('.document-title strong');
    return choice?.getAttribute('aria-pressed') === 'true' && title?.textContent?.trim() === target;
  }, {}, ownerSelectedName.text);
  check(await page.$eval('.imported-name-choice', button => button.getAttribute('aria-pressed') === 'true') &&
    await page.$eval('.document-title strong', (title, name) => title.textContent.trim() === name, ownerSelectedName.text),
    'Owner-selected name updates the document title and marks the selected text block');
  await clickText('.title-actions button', 'Lưu CV');
  await page.waitForFunction(() => document.querySelector('.studio-messages')?.textContent.includes('AI đã nhận nội dung mới'));
  check(writes === 2 && stored.basics.name === ownerSelectedName.text && stored.importedLayout.nameElementId === ownerSelectedName.id,
    'Saving persists the owner-selected name block in basics and imported layout metadata');
  await clickText('.title-actions button', 'Trợ lý CV');
  await page.waitForFunction(() => document.querySelector('.coach-panel') && !document.querySelector('.coach-panel').textContent.includes('Đang đối chiếu'));
  await new Promise(r => setTimeout(r, 700));
  check(coachText.includes(editedName), 'Coach receives edited layout');
  check(await page.$('.coach-score') === null, 'No misleading template-section score for positioned PDF');
  await page.click('[aria-label="Đóng trợ lý"]');
  await page.screenshot({ path: resolve(artifacts, 'layout-desktop.png'), fullPage: false });
  const pdfPath = resolve(artifacts, 'edited.pdf');
  await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
  const links = spawnSync('python', ['-c', "import json,sys,pymupdf as fitz; d=fitz.open(sys.argv[1]); print(json.dumps([x.get('uri') for p in d for x in p.get_links() if x.get('uri')]))", pdfPath], { encoding: 'utf8', windowsHide: true });
  assert.equal(links.status, 0, 'Local PDF link inspection must succeed');
  check(JSON.parse(links.stdout).sort().join('|') === 'https://linkedin.com/in/alex|mailto:alex@example.com', 'Printed PDF retains both safe source links');
  await clickText('.title-actions button', 'Công khai');
  await page.waitForFunction(() => document.querySelector('.word-statusbar').textContent.includes('Portfolio công khai'));
  await page.goto(base + '/portfolio/7', { waitUntil: 'networkidle0' });
  check(await page.$eval('.imported-text', (element, name) => element.textContent === name, editedName), 'Public website uses edited original layout');
  check(await page.$eval(`[data-layout-id="${addedBlockId}"]`, element => element.getAttribute('data-text-edited') === 'true'), 'Public website includes the saved added text block without editor state');
  check(await page.$$eval('.imported-text[href]', anchors => anchors.map(anchor => anchor.getAttribute('href')).sort().join('|')) === 'https://linkedin.com/in/alex|mailto:alex@example.com', 'Public layout keeps editable source links');
  check(await page.$('.imported-tools') === null && await page.$('[role="button"]') === null, 'Public document has no edit controls');
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(artifacts, 'layout-public-mobile.png'), fullPage: false });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Public mobile page contains horizontal document scrolling');
  await page.setViewport({ width: 1440, height: 1050 });
  await page.goto(base + '/resume-engine/?resumeId=7', { waitUntil: 'networkidle0' });
  await clickText('.word-statusbar button', 'Thu hồi');
  await page.waitForFunction(() => document.querySelector('.word-statusbar').textContent.includes('Riêng tư'));
  check(!published, 'Unpublish revokes public state');
  await clickText('.ribbon-tabs button', 'Tệp');
  await page.waitForSelector('dialog[open]');
  await clickText('.file-actions button', 'Nhập PDF có lớp chữ');
  await (await page.$('input[type="file"]')).uploadFile(resolve('../../.local/cv-layout-fixture.pdf'));
  await page.waitForFunction(() => document.querySelector('.studio-messages')?.textContent.includes('Đã nhập bố cục gốc'));
  check(await page.$('.resume-editor') === null && await page.$$eval('.imported-page', es => es.length === 2), 'File upload selects layout mode and opens positioned editor');
  assert.deepEqual(errors, []); checks++;
  await writeFile(resolve(artifacts, 'report.json'), JSON.stringify({ checks, errors, kind: 'Browser fixture API; real Studio bundle and PDF output' }, null, 2));
  console.log(`LAYOUT BROWSER: ${checks} checks passed`);
} finally { await browser.close(); server.close(); }
