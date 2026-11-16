import assert from 'node:assert/strict';

const host='https://vyrnivo-downloads.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const req=async(path,init={})=>{
 const r=await fetch(host+path,{...init,signal:AbortSignal.timeout(20000)});
 const t=await r.text();let d;
 try{d=JSON.parse(t)}catch{d={error:t.slice(0,100)}}
 return {status:r.status,data:d};
};
const search=await req('/api/search/instagram?q='+encodeURIComponent('roblox rivals'));
assert.equal(search.status,200,'Reel search must be reachable');
const candidates=(search.data.items||[]).filter(x=>/^https:\/\/www\.instagram\.com\/reel\/[A-Za-z0-9_-]{6,30}\/$/.test(x.url)).slice(0,3);
console.log('REELS_FOUND',candidates.length,'from',search.data.items?.length,'public search results');
assert.ok(candidates.length>0,'No sample Reels available to test');
let succeeded=0,failed=0;
for(const [i,reel] of candidates.entries()){
 let outcome='unknown';
 try{
  const start=await req('/api/downloads',{method:'POST',headers:{Origin:host,'Content-Type':'application/json'},body:JSON.stringify({url:reel.url,mode:'Video + audio',quality:'720p',container:'MP4'})});
  if(![200,202].includes(start.status)||!start.data.id){outcome='HTTP_'+start.status+' '+(start.data.error||'');failed++;continue}
  let job=start.data;
  for(let k=0;job.state==='processing'&&k<22;k++){
   await sleep(1800);
   const x=await req('/api/downloads/'+job.id);
   if(x.status!==200){outcome='poll_http_'+x.status;break}
   job=x.data;
  }
  if(job.state!=='ready'){
   if(outcome==='unknown')outcome=(job.state||'unknown')+' '+(job.error||'not ready');
   failed++;continue;
  }
  const response=await fetch(host+job.downloadUrl,{headers:{Range:'bytes=0-31'},signal:AbortSignal.timeout(15000)});
  if(response.status!==200&&response.status!==206){outcome='file_http_'+response.status;failed++;continue}
  const bytes=new Uint8Array(await response.arrayBuffer());
  const hasMp4Box=bytes.length>=12&&String.fromCharCode(...bytes.slice(4,8))==='ftyp';
  if(hasMp4Box&&job.bytes>1000&&job.expiresAt>Date.now()){
   succeeded++;outcome='READY_MP4 '+job.bytes+' bytes, expiresAt '+new Date(job.expiresAt).toISOString();
  }else{failed++;outcome='invalid_media_bytes'}
 }catch(e){failed++;outcome='ERROR '+String(e?.message||e)}
 finally{console.log('INSTAGRAM_REEL_TEST',i+1,outcome)}
}
console.log('INSTAGRAM_VERDICT',JSON.stringify({tested:candidates.length,succeeded,failed}));
if(succeeded===0)process.exitCode=1;
