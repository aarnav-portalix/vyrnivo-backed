import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConversion} from '../hosting/converter.mjs';
const sample='https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
test('accepts direct CC0 media URL and MP4 conversion',()=>{
 const result=validateConversion({url:sample,output:'MP4'});
 assert.equal(result.extension,'mp4');assert.equal(result.output,'MP4');
});
test('rejects YouTube watch pages, arbitrary hosts, redirects, private targets, unsupported types',()=>{
 for(const link of [
 'https://youtube.com/watch?v=jNQXAC9IVRw',
 'http://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
 'https://127.0.0.1/private.mp4',
 'https://interactive-examples.mdn.mozilla.net.evil.org/video.mp4',
 'https://interactive-examples.mdn.mozilla.net/video.html',
 'https://interactive-examples.mdn.mozilla.net:444/video.mp4',
 'https://somewhere.example/clip.mp4'
 ]) assert.throws(()=>validateConversion({url:link,output:'MP4'}),{name:'Error'},link);
});
test('rejects invalid formats',()=>assert.throws(()=>validateConversion({url:sample,output:'EXE'})));
