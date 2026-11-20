const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require('playwright-core');
const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'src/components/veterinarian/Horse.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, mod, mod.exports);
const Horse = mod.exports.default;
const coats = ['black', 'gray', 'bay', 'palomino'];
const names = ['Ngáo', 'Nguyễn Ngọc Hân', 'Thầy Hoàng đẹp trai', 'Ngáo opk'];
const css = fs.readFileSync(path.join(root, 'src/styles/horses.css'), 'utf8');
function fixture(width) {
  const maxColumns = Math.max(1, Math.floor((width - 12) / 196));
  const columns = Math.ceil(4 / Math.ceil(4 / maxColumns));
  const rows = Math.ceil(4 / columns);
  const architecture = `<div class="stable-yard-architecture"><div class="stable-yard-ceiling"><span></span><span></span><span></span></div><div class="stable-yard-planks"></div><div class="stable-yard-window"><i></i><i></i></div><div class="stable-yard-pillar stable-yard-pillar--left"></div><div class="stable-yard-pillar stable-yard-pillar--right"></div><div class="stable-yard-led-lights"><i></i><i></i><i></i></div><div class="stable-yard-straw"></div><div class="stable-yard-daylight"></div><div class="stable-yard-trough"></div></div><div class="stable-yard-hay"><span></span><span></span><span></span></div>`;
  const horses = coats.map((coatColor, index) => {
    const row = Math.floor(index / columns);
    const left = (index % columns) * (width - 12) / columns + ((width - 12) / columns - 180) / 2;
    const svg = renderToStaticMarkup(React.createElement(Horse, { coatColor, size: 174, hasStar: true, socks: ['frontLeft'] }), { identifierPrefix: coatColor });
    return `<button class="stable-yard-horse" data-depth="${row === rows - 1 ? 'near' : 'far'}" data-motion="idle" style="bottom:${16 + (rows - 1 - row) * 160}px;transform:translateX(${left}px)"><span class="stable-yard-horse__visual"><span class="stable-yard-horse__name-pill"><i class="stable-yard-horse__health-dot" style="background:#10b981"></i><span class="stable-yard-horse__label">${names[index]}</span></span><span class="stable-yard-figure-wrap">${svg}</span></span></button>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}\nbody{margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif}.stable-yard-stall{width:${width}px}.stable-yard-stall__header{padding:15px 18px;font-size:14px}.stable-yard-stall__header small{display:block;margin-top:5px;color:#64748b}.stable-yard-scene{height:${185 + rows * 160}px;--stable-floor:${rows * 160 + 25}px;box-sizing:border-box}*{box-sizing:border-box}</style></head><body><section class="stable-yard-stall"><header class="stable-yard-stall__header"><div>Chuồng A-01<small>Khu Stable A</small></div><span>4 ngựa</span></header><div class="stable-yard-scene">${architecture}${horses}</div></section></body></html>`;
}
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [660, 320]) {
      const page = await browser.newPage({ viewport: { width: width + 48, height: 950 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
      await page.setContent(fixture(width));
      await page.locator('.stable-yard-stall').screenshot({ path: path.join(__dirname, `stable-${width}.png`) });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log('Rendered stable previews at 660px and 320px.');
})();
