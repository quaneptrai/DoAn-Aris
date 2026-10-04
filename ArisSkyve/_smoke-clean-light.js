const puppeteer = require("puppeteer-core");
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: "new", args: ["--no-sandbox"] });
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.setViewport({ width: 1400, height: 900 });
  await p.goto("http://localhost:5025/Account/QuickLogin?returnUrl=/Dashboard", { waitUntil: "networkidle2", timeout: 60000 });
  await p.goto("http://localhost:5025/Dashboard", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  const info = await p.evaluate(() => {
    const sun = document.querySelector(".aris-earth-sun-flare");
    const ghosts = document.querySelectorAll(".aris-earth-lens-ghost").length;
    const cs = sun && getComputedStyle(sun);
    return {
      mounted: !!window.__arisEarthGlobe,
      ghosts,
      sunW: sun && sun.offsetWidth,
      sunOpacity: cs && cs.opacity,
      sunFilter: cs && cs.filter
    };
  });
  await p.screenshot({ path: "wwwroot/_smoke-earth-clean-light.png", fullPage: false });
  console.log(JSON.stringify({ info, errs }, null, 2));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });