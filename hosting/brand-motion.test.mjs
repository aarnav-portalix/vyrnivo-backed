import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('approved orbital logo is SVG and includes a custom orbit without old triangle',()=>{
 const svg=read('src/vyrnivo-mark.svg');
 assert.match(svg,/<svg\b/);
 assert.match(svg,/aria-label="Vyrnivo orbital V"/);
 assert.match(svg,/id="orbit"/);
 assert.doesNotMatch(svg,/m43 15 9\.6/);
 assert.ok(svg.length<6000,'Keep logo lightweight');
});
test('logo is used by favicon and installed application manifest',()=>{
 const build=read('build.cjs');
 const manifest=JSON.parse(read('src/manifest.webmanifest'));
 assert.match(build,/src\/vyrnivo-mark\.svg/);
 assert.equal(manifest.icons[0].src,'/favicon.svg');
 assert.match(read('src/App.jsx'),/src="\/favicon\.svg"/);
});
test('interaction effects avoid perpetual animation and respect motion settings',()=>{
 const css=read('src/style.css');
 assert.match(css,/Phase 18: precise, low-cost motion language/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/transition-property:transform,border-color,background-color,opacity/);
 assert.doesNotMatch(css.slice(css.indexOf('Phase 18: precise, low-cost motion language')),/animation-iteration-count:\s*infinite/);
});
test('service worker version changes to invalidate old cached logo',()=>{
 const sw=read('src/sw.js');
 assert.match(sw,/vyrnivo-shell-v2/);
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
});
