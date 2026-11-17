import assert from 'node:assert/strict';

const origin=process.env.OWNED_ENGINE_TEST_URL||'http://127.0.0.1:19949';
const secret=process.env.OWN_DOWNLOADER_TOKEN;
assert.ok(secret&&secret.length>=24,'Supply a temporary testing secret');
const authorized={Authorization:'Bearer '+secret};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const call=async(path,init={})=>{
 const response=await fetch(origin+path,{...init,headers:{...authorized,...init.headers},signal:AbortSignal.timeout(20000)});
 const data=await response.json().catch(()=>null);
 return {status:response.status,data};
};

const worker=await call('/api/downloads/status');
assert.equal(worker.status,200);
assert.equal(worker.data.enabled,true);
assert.equal(worker.data.freeFallbackEnabled,false,'This must NOT use the external download API');
console.log('OWNED_ENGINE_INDEPENDENCE_CONFIRMED',{freeFallback:worker.data.freeFallbackEnabled});

const submitted=await call('/api/downloads',{method:'POST',
 headers:{'content-type':'application/json'},
 body:JSON.stringify({
  url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  mode:'Video + audio',quality:'720p',container:'MP4'
 })
});
assert.equal(submitted.status,202,'Independent worker refused to start: '+JSON.stringify(submitted.data));
const id=submitted.data.id;
assert.match(id,/^[0-9a-f-]{36}$/i);
let job=submitted.data;
for(let i=0;i<90&&job.state==='processing';i++){
 await pause(1800);
 const polled=await call('/api/downloads/'+id);
 assert.equal(polled.status,200);
 job=polled.data;
}
if(job.state!=='ready'){
 console.log('OWNED_ENGINE_SOURCE_REJECTED',{
  state:job.state,
  code:job.failureCode||'UNKNOWN',
  error:job.error,
  sourceHost:'youtube',
  freeFallbackUsed:false
 });
 throw Error('Own extractor could not access the test media from this cloud host. This is NOT a working replacement.');
}
assert.ok(job.bytes>200&&job.bytes<=200*1024*1024);
assert.equal(job.downloadUrl,'/api/downloads/'+id+'/file');
const response=await fetch(origin+job.downloadUrl,{headers:authorized,signal:AbortSignal.timeout(90000)});
assert.equal(response.status,200);
const data=new Uint8Array(await response.arrayBuffer());
assert.equal(data.length,job.bytes);
assert.equal(String.fromCharCode(...data.slice(4,8)),'ftyp','Expected genuine MP4 file bytes');
console.log('OWNED_ENGINE_REAL_YOUTUBE_MP4_VERIFIED',JSON.stringify({bytes:job.bytes,source:'YouTube',externalApi:false,engine:'first-party yt-dlp'}));
