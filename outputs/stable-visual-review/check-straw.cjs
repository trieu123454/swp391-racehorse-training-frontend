const fs = require('node:fs');
const { chromium } = require('playwright-core');
(async () => {
  const texture = `data:image/svg+xml;base64,${fs.readFileSync('public/images/stable-straw.svg').toString('base64')}`;
  const roll = `data:image/svg+xml;base64,${fs.readFileSync('public/images/stable-hay-roll.svg').toString('base64')}`;
  const css = fs.readFileSync('src/styles/horses.css', 'utf8').replaceAll('/images/stable-straw.svg', texture).replaceAll('/images/stable-hay-roll.svg', roll);
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 620, height: 270 }, deviceScaleFactor: 2 });
    await page.setContent(`<style>${css}body{margin:0}.scene{position:relative;height:270px;--stable-floor:270px}</style><div class="scene"><div class="stable-yard-straw"></div><div class="stable-yard-hay-roll" style="bottom:45px"></div><div class="stable-yard-hay" style="bottom:50px"><span></span><span></span><span></span></div></div>`);
    await page.screenshot({ path: 'outputs/stable-visual-review/straw-detail.png' });
  } finally { await browser.close(); }
})();
