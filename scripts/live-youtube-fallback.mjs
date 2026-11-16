import assert from 'node:assert/strict';

const base='https://vyrnivo-downloads.onrender.com';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const getJson=async(path,init={})=>{
 const response=await fetch(base+path,{...init,signal:AbortSignal.timeout(25000)});
 const text=await response.text();
 let data;try{data=JSON.parse(text)}catch{data={error:text.slice(0,200)}}
 return {status:response.status,data};
};

let status;
for(let tries=0;tries<45;tries++){
 try{
  const res=await getJson('/api/downloads/status');
  status=res.data;
  if(res.status===200&&status?.enabled&&status?.freeFallbackEnabled)break;
  console.log('WAITING_FOR_DEPLOY',res.status,{enabled:status?.enabled,backup:status?.freeFallbackEnabled});
 }catch(e){console.log('DEPLOY_CHECK_ERROR',String(e?.message||e))}
 await pause(4000);
}
assert.equal(status?.enabled,true,'Downloader should be online');
assert.equal(status?.freeFallbackEnabled,true,'New cloud fallback must be deployed');
console.log('BACKUP_DEPLOYED',{youtube:status.sourceAvailability?.youtube,backupRetryAt:status.backupRetryAt});

const input={url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',mode:'Video + audio',quality:'720p',container:'MP4'};
let started;
for(let i=0;i<3;i++){
 started=await getJson('/api/downloads',{
  method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(input)
 });
 if(started.status!==429||started.data.code!=='SERVER_BUSY')break;
 await pause(6000);
}
console.log('LIVE_SUBMIT',started.status,{state:started.data.state,code:started.data.code,message:started.data.error});
assert.ok([200,202].includes(started.status),'Downloader rejected request');
assert.ok(started.data.id);
let job=started.data;
for(let i=0;job.state==='processing'&&i<50;i++){
 await pause(2500);
 const result=await getJson('/api/downloads/'+job.id);
 assert.equal(result.status,200);
 job=result.data;
}
console.log('LIVE_FINAL',JSON.stringify({state:job.state,provider:job.provider,bytes:job.bytes,failureCode:job.failureCode,error:job.error}));
assert.equal(job.state,'ready','Live YouTube job must prepare real media bytes');
assert.ok(job.bytes>128);
assert.ok(job.downloadUrl?.startsWith('/api/downloads/'));
const file=await fetch(base+job.downloadUrl,{signal:AbortSignal.timeout(20000)});
assert.equal(file.status,200);
assert.ok(Number(file.headers.get('content-length'))>128);
const reader=file.body?.getReader();
const result=await reader?.read();
await reader?.cancel();
assert.ok(result?.value?.byteLength>128,'Download link must return actual bytes');
console.log('LIVE_YOUTUBE_DOWNLOAD_VERIFIED',job.provider,job.bytes);
