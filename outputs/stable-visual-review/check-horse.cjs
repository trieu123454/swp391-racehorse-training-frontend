const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require('playwright-core');
const source = fs.readFileSync('src/components/veterinarian/Horse.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, mod, mod.exports);
const Horse = mod.exports.default;
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 430 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const large = ['bay', 'gray', 'palomino'].map((coatColor) => renderToStaticMarkup(React.createElement(Horse, { coatColor, groundContact: true, size: 300, socks: ['frontLeft'], hasStar: true }), { identifierPrefix: coatColor })).join('');
    const small = ['bay', 'gray', 'black', 'chestnut', 'palomino'].map((coatColor) => renderToStaticMarkup(React.createElement(Horse, { coatColor, groundContact: true, size: 114 }), { identifierPrefix: `small-${coatColor}` })).join('');
    await page.setContent(`<style>body{margin:20px;background:#eee7d7}section{display:flex;justify-content:space-around}svg{flex-shrink:0}</style><section>${large}</section><section>${small}</section>`);
    await page.screenshot({ path: 'outputs/stable-visual-review/horse-refined.png' });
  } finally { await browser.close(); }
})();
