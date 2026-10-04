const puppeteer = require("puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox","--window-size=1400,900"]
  });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto("http://localhost:5025/Account/QuickLogin?returnUrl=/Dashboard", { waitUntil: "networkidle2", timeout: 60000 });
  await page.goto("http://localhost:5025/Dashboard", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  const y0 = await page.evaluate(() => {
    const e = window.__arisEarthGlobe;
    return e ? null : null;
  });
  // read earth rotation via poking scene is hard; check canvas + class + cam via debug
  const info = await page.evaluate(() => {
    const host = document.getElementById("arisEarthGlobeHost");
    const canvas = document.querySelector("canvas.aris-earth-globe-canvas");
    const cs = host && getComputedStyle(host);
    return {
      THREE: typeof THREE !== "undefined",
      api: !!window.ArisEarthGlobe3D,
      mounted: !!window.__arisEarthGlobe,
      webgl: !!(host && host.classList.contains("aris-earth-globe-wrap--webgl")),
      square: !!(canvas && canvas.width === canvas.height && canvas.width >= 320),
      cw: canvas && canvas.width,
      transform: cs && cs.transform,
      perspective: cs && cs.perspective,
      w: host && host.clientWidth,
      h: host && host.clientHeight
    };
  });
  // wait and ensure still spinning (no error)
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: "wwwroot/_smoke-earth-unsqueeze.png", fullPage: false });
  console.log(JSON.stringify({ info, errs: errs.slice(0, 10) }, null, 2));
  await browser.close();
})().catch(e => { console.error(String(e)); process.exit(1); });