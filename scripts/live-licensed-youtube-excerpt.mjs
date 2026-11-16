import {setTimeout as sleep} from 'node:timers/promises';
import assert from 'node:assert/strict';
const base='https://vyrnivo-downloads.onrender.com';
async function req(path,opts){const r=await fetch(base+path,{signal:AbortSignal.timeout(25000),...opts});let data;try{data=await r.json()}catch{}return {status:r.status,data};}
for(let attempt=0;attempt<40;attempt++){
 try{const health=await req('/health');if(health.data?.converter===true)break;}catch{}
 await sleep(3000);
 if(attempt===39)throw Error('Converter not healthy');
}
const denied=await req('/api/converter',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',output:'MP4'})});
assert.equal(denied.status,400,'Unmapped video must not be advertised as downloadable');
assert.match(denied.data.error,/No approved, separately hosted copy/);
const started=await req('/api/converter',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({url:'https://www.youtube.com/watch?v=aqz-KE-bpKQ',output:'MP4'})});
assert.equal(started.status,202,'Could not start licensed film: '+JSON.stringify(started.data));
assert.equal(started.data.sourceMetadata?.alternateVersion,true);
let job=started.data;
for(let i=0;i<90&&job.state==='processing';i++){
 await sleep(1700);
 const polled=await req('/api/converter/'+job.id);job=polled.data;
}
assert.equal(job.state,'ready','Live licensed excerpt failed: '+JSON.stringify(job));
assert.equal(job.sourceMetadata.durationSeconds,33);
assert.equal(job.sourceMetadata.licenseUrl,'https://creativecommons.org/licenses/by/3.0/');
const f=await fetch(base+job.downloadUrl,{signal:AbortSignal.timeout(25000)});
assert.equal(f.status,200);const bytes=new Uint8Array(await f.arrayBuffer());
assert.equal(bytes.length,job.bytes);assert.ok(bytes.length>10_000);
assert.equal(String.fromCharCode(...bytes.slice(4,8)),'ftyp');
console.log('LIVE_LICENSED_YOUTUBE_EXCERPT_SUCCESS',JSON.stringify({youtubeId:'aqz-KE-bpKQ',fileType:'MP4',bytes:bytes.length,durationSeconds:33,source:'Wikimedia Commons',fullYoutubeVideo:false,attribution:true}));
