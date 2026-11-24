const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = fs.readFileSync(path.join(__dirname, '../src/components/horses/HorseUI.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const moduleUnderTest = { exports: {} };
new Function('require', 'module', 'exports', compiled)(ref => ref.startsWith('@/') ? {} : require(ref), moduleUnderTest, moduleUnderTest.exports);
const { HorseImage } = moduleUnderTest.exports;
const render = props => renderToStaticMarkup(React.createElement(HorseImage, { priority: true, ...props }));

test('horse image uses signed URL instead of private storage path', () => {
  const html = render({ horse: { id: 'h1', horse_name: 'Horse', image_url: 'horses/private.jpg', image_signed_url: 'https://images.example/horse.jpg?signature=abc' } });
  assert.match(html, /src="https:\/\/images.example\/horse.jpg\?signature=abc"/);
  assert.doesNotMatch(html, /src="horses\/private.jpg"/);
});

test('local upload preview takes precedence over existing signed image', () => {
  const html = render({ preview: 'blob:local-preview', horse: { id: 'h1', image_url: null, image_signed_url: 'https://images.example/old.jpg' } });
  assert.match(html, /src="blob:local-preview"/);
  assert.doesNotMatch(html, /src="https:\/\/images.example\/old.jpg"/);
});

test('direct public image is supported and private paths are not emitted as image sources', () => {
  assert.match(render({ horse: { id: 'h1', image_url: '/img/horse.jpg' } }), /src="\/img\/horse.jpg"/);
  assert.doesNotMatch(render({ horse: { id: 'h1', image_url: 'private/horse.jpg' } }), /<img/);
});
