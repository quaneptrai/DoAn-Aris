const { createServer } = require('node:http');
const { readFile, mkdir, writeFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');
const puppeteer = require('../../node_modules/puppeteer-core');

const artifacts = resolve(__dirname, '.artifacts');
const previews = resolve(__dirname, '../../wwwroot/resume-engine/previews');
const required = ['Alex Canonical', 'canonical@example.org', '+84 912 345 678', 'SUMMARY_SENTINEL', 'WORK_SENTINEL', 'METRIC_SENTINEL', 'WORKSTACK_SENTINEL', 'PROJECT_SENTINEL', 'DEMO_SENTINEL', 'REPOSITORY_SENTINEL', 'PROJECTSTACK_SENTINEL', 'SKILL_SENTINEL', 'EDUCATION_SENTINEL', 'HONOR_SENTINEL', 'CUSTOM_SENTINEL', 'TIMELINE_SENTINEL'];
const failures = [], report = [];

(async () => {
  await mkdir(artifacts, { recursive: true }); await mkdir(previews, { recursive: true });
  if (!existsSync(join(artifacts, 'fixture.js'))) throw new Error('Build tests/browser-fixture.tsx to tests/.artifacts/fixture.js with esbuild first.');
  const server = createServer(async (req, res) => {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'); return; }
    if (req.url !== '/fixture.js' && req.url !== '/fixture.css') { res.writeHead(404).end(); return; }
    try { res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(await readFile(join(artifacts, req.url.slice(1)))); } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    page.on('pageerror', error => failures.push(`browser: ${error.message}`));
    await page.setViewport({ width: 1000, height: 1250, deviceScaleFactor: .5 });
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.renderResume === 'function');
    for (let index = 1; index <= 32; index++) {
      const id = `t${index}`;
      await page.emulateMediaType('screen');
      await page.setViewport({ width: 1000, height: 1250, deviceScaleFactor: .5 });
      await page.evaluate(id => window.renderResume(id, 'landing', false), id);
      await page.waitForSelector(`.template-${id}.mode-landing`);
      await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1500))]));
      await page.evaluate(() => { const dock = document.querySelector('.action-dock'); if (dock) dock.style.visibility = 'hidden'; });
      await page.screenshot({ path: join(previews, `${id}.png`), fullPage: false });
      for (const mode of ['landing', 'pdf']) {
        await page.evaluate(({ id, mode }) => window.renderResume(id, mode, true), { id, mode });
        await page.waitForSelector(`.template-${id}.mode-${mode}`);
        await page.emulateMediaType('print');
        await page.setViewport({ width: 680, height: 1020, deviceScaleFactor: 1 });
        const result = await page.evaluate(() => {
          const root = document.querySelector('.resume');
          const bounds = root.getBoundingClientRect();
          const overflowing = Array.from(root.querySelectorAll('*')).filter(node => {
            const style = getComputedStyle(node), rect = node.getBoundingClientRect();
            return style.display !== 'none' && style.position !== 'fixed' && rect.width > 0 && (rect.right > bounds.right + 2 || rect.left < bounds.left - 2);
          }).slice(0, 8).map(node => `${node.tagName}.${node.className}`);
          return { text: root.innerText.replace(/\s+/g, ' '), width: root.clientWidth, scrollWidth: root.scrollWidth, overflowing };
        });
        for (const marker of required) if (!result.text.includes(marker)) failures.push(`${id}/${mode}: print text missing ${marker}`);
        if (result.scrollWidth > result.width + 2 || result.overflowing.length) failures.push(`${id}/${mode}: horizontal overflow ${JSON.stringify(result)}`);
        await page.pdf({ path: join(artifacts, `${id}-${mode}.pdf`), preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
        report.push({ template: id, mode, width: result.width, scrollWidth: result.scrollWidth, overflowing: result.overflowing });
      }
      if (index % 4 === 0) console.log(`${index}/32 previews and ${index * 2}/64 PDFs generated`);
    }
    const python = spawnSync('python', ['-c', `import json, pathlib, pymupdf, sys\nroot=pathlib.Path(sys.argv[1]); required=json.loads(sys.argv[2]); errors=[]; pages=0\nfor file in sorted(root.glob('t*-*.pdf')):\n doc=pymupdf.open(file); pages+=len(doc); text=' '.join(' '.join(page.get_text() for page in doc).split())\n for marker in required:\n  if marker not in text: errors.append(file.name+': PDF missing '+marker)\n for page in doc:\n  for block in page.get_text('blocks'):\n   if block[0] < 0 or block[2] > page.rect.width+1: errors.append(file.name+': text outside page width')\nprint(json.dumps({'pages':pages,'failures':errors}))`, artifacts, JSON.stringify(required)], { encoding: 'utf8' });
    if (python.status !== 0) failures.push(`PDF text verification failed: ${python.stderr || python.error}`);
    else { const extracted = JSON.parse(python.stdout); failures.push(...extracted.failures); console.log(`Verified text in ${extracted.pages} PDF pages`); }
    await writeFile(join(artifacts, 'report.json'), JSON.stringify({ report, failures }, null, 2));
    if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exitCode = 1; }
    else console.log('PASS: 32 native previews, 64 print renders, PDF text preserved, no horizontal overflow.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
