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

test('verified CC BY YouTube film resolves only to an attributed excerpt, not YouTube-hosted bytes',()=>{
 const sample=validateConversion({url:'https://www.youtube.com/watch?v=aqz-KE-bpKQ',output:'MP4'});
 assert.equal(sample.url,'https://upload.wikimedia.org/wikipedia/commons/3/3b/Big_Buck_Bunny_extract.ogv');
 assert.equal(sample.extension,'ogv');
 assert.equal(sample.sourceMetadata?.alternateVersion,true);
 assert.equal(sample.sourceMetadata?.durationSeconds,33);
 assert.match(sample.sourceMetadata?.description,/not a download of the full YouTube upload/i);
 assert.equal(sample.sourceMetadata?.licenseUrl,'https://creativecommons.org/licenses/by/3.0/');
});
test('unapproved YouTube uploads never silently reuse unrelated video files',()=>{
 assert.throws(()=>validateConversion({url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',output:'MP4'}),/No approved, separately hosted copy/);
});
