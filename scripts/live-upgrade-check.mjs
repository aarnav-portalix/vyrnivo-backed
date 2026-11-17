import assert from 'node:assert/strict';

const base='https://vyrnivo-downloads.onrender.com';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const get=async(path,init={})=>fetch(base+path,{...init,signal:AbortSignal.timeout(25000)});
const json=async(path,init={})=>{
 const r=await get(path,init);const data=await r.json();
 return {status:r.status,data};
};

let deployed=false;
for(let i=0;i<35;i++){
 try{
  const app=await get('/app.js');
  if(app.ok){
   const code=await app.text();
   if(code.includes('No reliable completion estimate available yet')&&code.includes('Checking progress')){
    deployed=true;break;
   }
  }
 }catch{}
 await pause(4000);
}
assert.equal(deployed,true,'Render must deploy the new private API and processing timer.');
const health=await json('/health');
assert.equal(health.status,200);
assert.equal(health.data.ok,true);
const downloads=await json('/api/downloads/status');
assert.equal(downloads.status,200);
assert.equal(downloads.data.enabled,true);
assert.equal(downloads.data.freeFallbackEnabled,true);
const converter=await json('/api/converter/status');
assert.equal(converter.status,200);
assert.equal(converter.data.enabled,true);
const unauthorized=await json('/api/private/status');
assert.equal(unauthorized.status,401,'Private API cannot be called without server-only bearer auth');
const invalid=await json('/api/private/status',{headers:{Authorization:'Bearer invalid-public-token'}});
assert.equal(invalid.status,401);
const bot=await json('/api/security/status');
assert.equal(bot.status,200);
assert.equal(typeof bot.data.enabled,'boolean');
const counter=await json('/api/presence/status');
assert.equal(counter.status,200);
assert.equal(counter.data.approximate,true);
console.log('LIVE_UPGRADE_OK',JSON.stringify({privateApiProtected:true,firstPartyConverterOnline:true,freeDownloadBackupEnabled:true,processingTimerDeployed:true,turnstileActive:bot.data.enabled,visitorCounter:true}));

// The existing direct-media example checks real FFmpeg output, not just status.
// A remote host may decline retrieval independent of Vyrnivo; this is logged
// separately without treating it as a converter bug.
const input={url:'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',output:'MP4'};
const start=await json('/api/converter',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(input)});
if(start.status===202){
 let job=start.data;
 for(let i=0;i<55&&job.state==='processing';i++){
  await pause(1700);
  const polled=await json('/api/converter/'+job.id);
  assert.equal(polled.status,200);
  job=polled.data;
 }
 if(job.state==='ready'){
  assert.ok(job.bytes>128,'Expected actual converted media bytes');
  const file=await get(job.downloadUrl);
  assert.equal(file.status,200);
  const head=new Uint8Array(await file.arrayBuffer());
  assert.equal(String.fromCharCode(...head.slice(4,8)),'ftyp');
  console.log('LIVE_OWN_ENGINE_MP4_VERIFIED',JSON.stringify({bytes:job.bytes,stage:job.stage}));
 }else if(job.state==='failed'&&/source file could not be retrieved|source file.*timed out/i.test(job.error||'')){
  console.log('LIVE_CONVERTER_EXTERNAL_SOURCE_UNAVAILABLE');
 }else{
  throw Error('Own conversion failed: '+JSON.stringify({state:job.state,error:job.error,stage:job.stage}));
 }
}else if(start.status===429){
 console.log('LIVE_CONVERTER_BUSY_VISITORS');
}else{
 throw Error('Converter rejected a valid file: '+JSON.stringify(start));
}
