import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const premium=css.slice(css.lastIndexOf('/* Premium motion pass:'),css.indexOf('/* Pro preview:',css.lastIndexOf('/* Premium motion pass:')));
test('premium motion is compositor-only and has device guards',()=>{
 assert.match(premium,/@media \(max-width:640px\)/);
 assert.match(premium,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(premium,/@media \(hover:hover\) and \(pointer:fine\)/);
 assert.doesNotMatch(premium,/[;{]\s*(?:width|height|top|left|margin|padding)\s*:/);
 assert.match(premium,/pointer-events:none/);
});
test('animation changes do not replace download or search interaction code',()=>{
 assert.match(app,/async function startDownload/);
 assert.match(app,/async function runSearch/);
 assert.match(app,/onSubmit=\{startDownload\}/);
});
