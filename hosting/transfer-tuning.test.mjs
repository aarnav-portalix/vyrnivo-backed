import test from 'node:test';
import assert from 'node:assert/strict';
import {argumentsFor} from './downloads.mjs';
import {readFileSync} from 'node:fs';
const url='https://www.youtube.com/watch?v=jNQXAC9IVRw';
const base={url,mode:'Video + audio',quality:'720p',container:'MP4'};
test('bounded fragment parallelism is enabled for compatible media',()=>{
 const args=argumentsFor(base,'/tmp/vyrnivo-test');
 const at=args.indexOf('--concurrent-fragments');
 assert.equal(args[at+1],'6');
 assert.equal(args[args.indexOf('--fragment-retries')+1],'1');
 assert.equal(args[args.indexOf('--extractor-retries')+1],'1');
});
test('audio-only formats retain their conversion flags',()=>{
 const args=argumentsFor({...base,mode:'Audio only',container:'MP3',audioBitrate:'320 kbps'},'/tmp/vyrnivo-test');
 assert.ok(args.includes('-x'));
 assert.equal(args[args.indexOf('--audio-format')+1],'mp3');
 assert.equal(args[args.indexOf('--audio-quality')+1],'320K');
});
test('success motion is short and honors reduced motion',()=>{
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(css,/vyrnivo-ready-pop 230ms/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
