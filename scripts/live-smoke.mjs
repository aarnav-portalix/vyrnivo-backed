import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const base='https://vyrnivo-downloads.onrender.com';
const timeout=45000;
async function call(path,init={}){
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(base+path,{...init,signal:AbortSignal.timeout(timeout)});
      if(response.status>=500&&attempt<2){await new Promise(r=>setTimeout(r,3000));continue}
      return response;
    }catch(error){
      lastError=error;
      if(attempt<2)await new Promise(r=>setTimeout(r,3000));
    }
  }
  throw lastError||Error('Live service did not respond.');
}
const json=async(r)=>{const body=await r.text();assert.ok(r.ok,'HTTP '+r.status+': '+body.slice(0,400));return JSON.parse(body)};
const hash=b=>createHash('sha256').update(b).digest('hex');

const page=await call('/');
assert.equal(page.status,200);
assert.match(await page.text(),/Vyrnivo/i);
const health=await json(await call('/health'));
assert.equal(health.ok,true);
assert.equal(health.downloads,true);
const downloads=await json(await call('/api/downloads/status'));
assert.equal(downloads.enabled,true);
const uploads=await json(await call('/api/files/status'));
assert.equal(uploads.enabled,true);

const payload=Buffer.from('Vyrnivo automated upload integrity test', 'utf8');
const posted=await call('/api/files/upload',{
 method:'POST',
 headers:{Origin:base,'Content-Type':'audio/wav','X-File-Name':'vyrnivo-smoke.wav'},
 body:payload
});
const job=await json(posted);
assert.equal(job.state,'ready');
assert.equal(job.bytes,payload.length);
assert.ok(/^\/api\/downloads\/[0-9a-f-]{36}\/file$/.test(job.url),'Expected a temporary file URL');
const fetched=await call(job.url);
assert.equal(fetched.status,200);
const received=Buffer.from(await fetched.arrayBuffer());
assert.equal(hash(received),hash(payload),'Returned bytes must match exactly');
const denied=await call('/api/files/upload',{
 method:'POST',
 headers:{Origin:'https://untrusted.invalid','Content-Type':'audio/wav','X-File-Name':'not-allowed.wav'},
 body:payload
});
assert.equal(denied.status,403,'Cross-origin uploads must be refused');
console.log('LIVE SMOKE PASSED: web page, health, API, temporary upload, exact-byte download and cross-origin protection.');
