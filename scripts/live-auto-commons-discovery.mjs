import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
const base='https://vyrnivo-downloads.onrender.com';
async function request(path,options){
 const r=await fetch(base+path,{signal:AbortSignal.timeout(30000),...options});
 const data=await r.json();return {r,data}
}
let ready=false;
for(let i=0;i<40;i++){
 try{
  const s=await request('/api/converter/status');
  if(s.r.ok&&s.data?.licensedDiscovery===true&&s.data?.enabled){ready=true;break}
 }catch{}
 await sleep(3000);
}
assert.ok(ready,'New licensed discovery version was not deployed');
const invalid=await request('/api/converter/discover?url='+encodeURIComponent('https://youtube.com.evil.example/watch?v=jNQXAC9IVRw'));
assert.equal(invalid.r.status,400,'Fake YouTube host must be rejected');
const found=await request('/api/converter/discover?url='+encodeURIComponent('https://www.youtube.com/watch?v=jNQXAC9IVRw'));
assert.equal(found.r.status,200,JSON.stringify(found.data));
assert.ok(found.data.alternatives?.length>=1,JSON.stringify(found.data));
const chosen=found.data.alternatives.find(x=>/Me at the zoo/i.test(x.title));
assert.ok(chosen,'Expected verified Wikimedia video candidate');
assert.equal(chosen.license,'CC BY 3.0');
const started=await request('/api/converter',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({candidateId:chosen.id,output:'MP4'})});
assert.equal(started.r.status,202,JSON.stringify(started.data));
let j=started.data;
for(let i=0;i<110&&j.state==='processing';i++){
 await sleep(1500);
 const x=await request('/api/converter/'+j.id);
 j=x.data;
}
assert.equal(j.state,'ready','Live converter failed: '+JSON.stringify(j));
assert.equal(j.sourceMetadata?.discovered,true);
assert.equal(j.sourceMetadata?.alternateVersion,true);
const res=await fetch(base+j.downloadUrl,{signal:AbortSignal.timeout(30000)});
assert.equal(res.status,200);
const bytes=new Uint8Array(await res.arrayBuffer());
assert.equal(bytes.length,j.bytes);
assert.equal(String.fromCharCode(...bytes.slice(4,8)),'ftyp','Real MP4 signature expected');
console.log('LIVE_AUTO_COMMONS_DISCOVERY_AND_MP4_SUCCESS',JSON.stringify({youtubeId:'jNQXAC9IVRw',matchedCandidate:chosen.title,size:bytes.length,licensed:chosen.license,source:'Wikimedia Commons',independentCopy:true}));
