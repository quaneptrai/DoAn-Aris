const puppeteer = require("puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--window-size=1400,900"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto("http://localhost:5025/Account/QuickLogin?returnUrl=/Dashboard", { waitUntil: "networkidle2", timeout: 60000 });
  await page.goto("http://localhost:5025/Dashboard", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 1800));
  const info = await page.evaluate(() => {
    const q = (s) => !!document.querySelector(s);
    const g = document.querySelector(".aris-earth-globe");
    const wrap = document.querySelector(".aris-earth-globe-wrap");
    const cs = g ? getComputedStyle(g) : null;
    return {
      layers: {
        fog: q(".aris-earth-depth-fog"),
        bloom: q(".aris-earth-globe-bloom"),
        clouds: q(".aris-earth-globe-clouds"),
        terminator: q(".aris-earth-globe-terminator"),
        specular: q(".aris-earth-globe-specular"),
        atmos: q(".aris-earth-globe-atmos"),
        rim: q(".aris-earth-globe-rim")
      },
      bp: cs && cs.backgroundPosition,
      radius: cs && cs.borderRadius,
      wrapTf: wrap && wrap.style.transform,
      perspective: getComputedStyle(document.querySelector(".aris-earth-globe-stage")).perspective
    };
  });
  await new Promise(r => setTimeout(r, 1000));
  const bp2 = await page.evaluate(() => {
    const g = document.querySelector(".aris-earth-globe");
    return g ? getComputedStyle(g).backgroundPosition : null;
  });
  await page.screenshot({ path: "wwwroot/_smoke-earth-depth.png", fullPage: false });
  console.log(JSON.stringify({ info, bp2, spinning: info.bp !== bp2 }, null, 2));
  await browser.close();
})().catch(e => { console.error(String(e)); process.exit(1); });