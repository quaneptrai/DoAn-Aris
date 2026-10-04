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
  await new Promise(r => setTimeout(r, 1500));
  const a = await page.evaluate(() => {
    const g = document.querySelector(".aris-earth-globe");
    if (!g) return { ok: false, reason: "no globe", html: !!document.getElementById("aris-earth-root") };
    const cs = getComputedStyle(g);
    return {
      ok: true,
      bp1: cs.backgroundPosition,
      bg: cs.backgroundImage.slice(0, 90),
      round: cs.borderRadius,
      size: cs.backgroundSize
    };
  });
  await new Promise(r => setTimeout(r, 1200));
  const b = await page.evaluate(() => {
    const g = document.querySelector(".aris-earth-globe");
    return g ? getComputedStyle(g).backgroundPosition : null;
  });
  await page.evaluate(() => window.scrollBy(0, 800));
  await new Promise(r => setTimeout(r, 800));
  const c = await page.evaluate(() => {
    const g = document.querySelector(".aris-earth-globe");
    return g ? getComputedStyle(g).backgroundPosition : null;
  });
  await page.screenshot({ path: "wwwroot/_smoke-earth-globe.png", fullPage: false });
  console.log(JSON.stringify({ a, b, c, spinning: !!(a && a.bp1 && b && a.bp1 !== b) }, null, 2));
  await browser.close();
})().catch(e => { console.error(String(e)); process.exit(1); });