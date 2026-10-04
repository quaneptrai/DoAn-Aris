const puppeteer = require("puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--window-size=1400,900"]
  });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("page:" + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("cons:" + m.text().slice(0, 200)); });
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto("http://localhost:5025/Account/QuickLogin?returnUrl=/Dashboard", { waitUntil: "networkidle2", timeout: 60000 });
  await page.goto("http://localhost:5025/Dashboard", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 3500));
  const info = await page.evaluate(() => {
    const host = document.getElementById("arisEarthGlobeHost");
    const canvas = document.querySelector("canvas.aris-earth-globe-canvas");
    return {
      url: location.pathname,
      THREE: typeof THREE !== "undefined",
      api: !!window.ArisEarthGlobe3D,
      host: !!host,
      webglClass: !!(host && host.classList.contains("aris-earth-globe-wrap--webgl")),
      canvas: !!canvas,
      cw: canvas ? canvas.width : 0,
      ch: canvas ? canvas.height : 0,
      mounted: !!window.__arisEarthGlobe,
      childTags: host ? [...host.children].map(c => c.tagName + "." + c.className).slice(0, 8) : []
    };
  });
  await page.screenshot({ path: "wwwroot/_smoke-earth-webgl.png", fullPage: false });
  console.log(JSON.stringify({ info, errs: errs.slice(0, 15) }, null, 2));
  await browser.close();
})().catch(e => { console.error(String(e)); process.exit(1); });