import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyExtractorFailure as f} from './source-failures.mjs';

test('YouTube HTTP429 is classified as source access, not format retry',()=>{
 const result=f('ERROR: HTTP Error 429 Too Many Requests',{source:'youtube'});
 assert.equal(result.code,'SOURCE_RATE_LIMITED');
 assert.equal(result.accessDenied,true);
 assert.equal(result.retryable,false);
});
test('Instagram HTTP429 never claims YouTube is blocked',()=>{
 const result=f('HTTP Error 429',{source:'instagram'});
 assert.equal(result.code,'SOURCE_RATE_LIMITED');
 assert.doesNotMatch(result.message,/YouTube/);
});
test('login-required is identified as access denial',()=>{
 const result=f('ERROR [youtube]: Sign in to confirm you are not a bot');
 assert.equal(result.code,'SOURCE_VERIFICATION_REQUIRED');
 assert.equal(result.accessDenied,true);
});
test('403 is an access issue and cannot be fixed by conversion',()=>{
 assert.equal(f('HTTP Error 403: Forbidden').code,'SOURCE_ACCESS_DENIED');
});
test('missing format is fixable without pretending stream access worked',()=>{
 const result=f('ERROR: Requested format is not available');
 assert.equal(result.code,'MEDIA_FORMAT_UNAVAILABLE');
 assert.equal(result.retryable,true);
 assert.equal(result.accessDenied,false);
});
test('arbitrary extractor output is not exposed to client',()=>{
 const result=f('Unexpected problem: /home/user/.secret and an URL');
 assert.equal(result.code,'EXTRACTION_FAILED');
 assert.doesNotMatch(result.message,/\.secret|URL/);
});
