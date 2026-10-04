const puppeteer = require("puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--window-size=1400,900"]
  });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto("http://localhost:5025/Account/QuickLogin?returnUrl=/Dashboard", { waitUntil: "networkidle2", timeout: 60000 });
  await page.goto("http://localhost:5025/Dashboard", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));
  const info = await page.evaluate(() => {
    const host = document.getElementById("arisEarthGlobeHost");
    const canvas = document.querySelector("canvas.aris-earth-globe-canvas");
    const sun = document.querySelector(".aris-earth-sun-flare");
    const cs = host ? getComputedStyle(host) : null;
    return {
      THREE: typeof THREE !== "undefined",
      mounted: !!window.__arisEarthGlobe,
      webgl: !!(host && host.classList.contains("aris-earth-globe-wrap--webgl")),
      canvas: !!canvas,
      cw: canvas && canvas.width,
      ch: canvas && canvas.height,
      square: canvas && canvas.width === canvas.height,
      hostW: host && host.clientWidth,
      hostH: host && host.clientHeight,
      transform: cs && cs.transform,
      sunOk: !!sun,
      sunBg: sun ? getComputedStyle(sun).backgroundImage.slice(0, 80) : null
    };
  });
  await page.screenshot({ path: "wwwroot/_smoke-earth-matte.png", fullPage: false });
  console.log(JSON.stringify({ info, errs: errs.slice(0, 8) }, null, 2));
  await browser.close();
})().catch(e => { console.error(String(e)); process.exit(1); });