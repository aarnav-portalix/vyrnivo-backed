import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('developer project link has the correct destination and accessible name',()=>{
 const app=read('src/App.jsx');
 assert.match(app,/className="developer-project-link"/);
 assert.match(app,/href="https:\/\/nexusdeck-two\.vercel\.app"/);
 assert.match(app,/aria-label="Play Nexus Deck arcade game \(opens in new tab\)"/);
 assert.match(app,/rel="noopener noreferrer"/);
});
test('developer credit is consistent',()=>{
 const app=read('src/App.jsx');
 assert.match(app,/Built by Aarnav Fbav12/);
 assert.match(app,/Aarnav Fbav12 is the creator/);
 assert.doesNotMatch(app,/\bAarnav12\b/);
});
test('mobile and desktop have dedicated responsive styles',()=>{
 const css=read('src/style.css');
 for(const width of ['max-width:640px','min-width:1200px','min-width:1600px'])assert.ok(css.includes(width));
 assert.match(css,/\.developer-section \.developer-project-link:focus-visible/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('PWA service worker never caches download APIs',()=>{
 const sw=read('src/sw.js');
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(sw,/request\.method!=='GET'/);
});
