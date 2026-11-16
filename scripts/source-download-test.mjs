import assert from 'node:assert/strict';

const base='https://vyrnivo-downloads.onrender.com';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const request=async(path,init={})=>{
 const response=await fetch(base+path,{...init,signal:AbortSignal.timeout(35000)});
 const text=await response.text();
 let data;try{data=JSON.parse(text)}catch{data={error:text.slice(0,200)}}
 return {status:response.status,data};
};
const headers={Origin:base,'content-type':'application/json'};
async function checkSource(platform,url){
 console.log('TEST_SOURCE_START',platform);
 let first;
 try{
  first=await request('/api/downloads',{method:'POST',headers,body:JSON.stringify({url,mode:'Video + audio',quality:'720p',container:'MP4'})});
  console.log('TEST_SOURCE_SUBMITTED',platform,first.status,JSON.stringify({state:first.data.state,error:first.data.error,code:first.data.code,jobId:first.data.id}));
  if(![200,202].includes(first.status)||!first.data.id)return false;
  let job=first.data;
  for(let i=0;job.state==='processing'&&i<35;i++){
   await wait(2500);
   const r=await request('/api/downloads/'+job.id);
   if(!r.status.toString().startsWith('2')){console.log('TEST_SOURCE_POLL_FAIL',platform,r.status,r.data.error);return false}
   job=r.data;
  }
  if(job.state!=='ready'){console.log('TEST_SOURCE_NOT_READY',platform,job.state,job.error||'timed out');return false}
  assert.ok(job.downloadUrl?.startsWith('/api/downloads/'));
  assert.ok(job.bytes>0);
  assert.ok(job.expiresAt>Date.now());
  const r=await fetch(base+job.downloadUrl,{signal:AbortSignal.timeout(30000)});
  try{
   assert.equal(r.status,200);
   assert.ok(Number(r.headers.get('content-length'))>0);
   const stream=r.body?.getReader();const chunk=await stream?.read();await stream?.cancel();
   assert.ok(chunk?.value?.byteLength>0);
   console.log('TEST_SOURCE_READY_WITH_BYTES',platform,job.bytes,job.name);
   return true;
  }finally{await r.body?.cancel?.().catch(()=>{})}
 }catch(e){console.log('TEST_SOURCE_EXCEPTION',platform,String(e?.message||e));return false}
}
const status=await request('/api/downloads/status');
console.log('DOWNLOAD_SERVER_STATUS',status.status,JSON.stringify({enabled:status.data.enabled,sourceAvailability:status.data.sourceAvailability,youtubeRetryAt:status.data.youtubeRetryAt}));
assert.equal(status.status,200);
assert.equal(status.data.enabled,true);
const youtube=await checkSource('youtube','https://www.youtube.com/watch?v=BaW_jenozKc');
let instagram=false;
try{
 const search=await request('/api/search/instagram?q='+encodeURIComponent('roblox rivals'));
 const item=search.data.items?.find(x=>/^https:\/\/www\.instagram\.com\/reel\/[\w-]{6,30}\/$/.test(x.url));
 if(item){instagram=await checkSource('instagram',item.url)}
 else console.log('INSTAGRAM_NO_PUBLIC_REEL_SOURCE',search.status,search.data.notice||search.data.error);
}catch(e){console.log('INSTAGRAM_SOURCE_LOOKUP_FAIL',String(e?.message||e))}
console.log('SOURCE_DOWNLOAD_VERDICT',JSON.stringify({youtube,instagram}));
if(!youtube||!instagram)process.exitCode=1;
