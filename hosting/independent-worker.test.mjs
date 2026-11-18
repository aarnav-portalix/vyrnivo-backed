import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkerHandler} from './media-worker.mjs';
import {validateOwnedEngineConfig} from './owned-downloader.mjs';

test('independent worker image starts the authenticated worker, not the public site',()=>{
 const image=readFileSync(new URL('../Dockerfile.worker',import.meta.url),'utf8');
 assert.match(image,/CMD \["node", "hosting\/media-worker-entry\.mjs"\]/);
 assert.doesNotMatch(image,/hosting\/server\.mjs/);
 assert.match(image,/ffmpeg/);
 assert.match(image,/yt-dlp/);
});
test('worker refuses missing or weak secret',()=>{
 assert.throws(()=>createWorkerHandler({secret:'weak',engine:{}}),/strong server-only secret/);
 assert.equal(validateOwnedEngineConfig('https://vyrnivo-downloads.onrender.com','strong-secret-123456789012345'),null);
});
test('independent worker is opt-in: invalid or missing connection cannot be enabled',()=>{
 assert.equal(validateOwnedEngineConfig('',''),null);
 assert.equal(validateOwnedEngineConfig('https://worker.example.org',''),null);
 assert.equal(validateOwnedEngineConfig('http://worker.example.org','strong-secret-123456789012345'),null);
});
