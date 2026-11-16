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
assert.equal(uploads.enabled,false,'Manual uploads must be disabled');
const body=Buffer.from('Retired public upload');
const uploaded=await call('/api/files/upload',{
 method:'POST',headers:{Origin:base,'Content-Type':'audio/wav'},body
});
assert.equal(uploaded.status,410,'Arbitrary public uploads should not be permitted');
const rejected=await call('/api/downloads',{
 method:'POST',headers:{Origin:base,'Content-Type':'application/json'},
 body:JSON.stringify({url:'https://example.org/not-media',mode:'Video + audio',quality:'720p',container:'MP4'})
});
assert.equal(rejected.status,400,'Only supported source links are allowed');
const denied=await call('/api/downloads',{
 method:'POST',headers:{Origin:'https://untrusted.invalid','Content-Type':'application/json'},
 body:JSON.stringify({url:'https://example.org/not-media',mode:'Video + audio',quality:'720p',container:'MP4'})
});
assert.equal(denied.status,403);
console.log('LIVE SMOKE PASSED: website, download API, source validation, manual upload removal, and cross-origin protection.');
