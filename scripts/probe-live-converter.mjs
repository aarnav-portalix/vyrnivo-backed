import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
const base='https://vyrnivo-downloads.onrender.com';
const startAt=Date.now();
async function json(path,opts){const r=await fetch(base+path,{signal:AbortSignal.timeout(30000),...opts});return {r,body:await r.json()}}
async function waitReady(){
 for(let i=0;i<35;i++){
  try{const x=await json('/health');if(x.body?.ok&&x.body?.converter)return;}catch{}
  await sleep(4000);
 }
 throw Error('Public converter not deployed and healthy');
}
async function test(output,source){
 const {r,body}=await json('/api/converter',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({url:source,output})});
 assert.equal(r.status,202,'Public server rejected converter job '+JSON.stringify(body));
 let job=body;
 for(let n=0;n<110&&job.state==='processing';n++){
  await sleep(1200);
  const value=await json('/api/converter/'+job.id);job=value.body;
 }
 assert.equal(job.state,'ready','Live converter failed '+JSON.stringify(job));
 const file=await fetch(base+job.downloadUrl,{signal:AbortSignal.timeout(30000)});
 assert.equal(file.status,200);const bytes=new Uint8Array(await file.arrayBuffer());
 assert.ok(bytes.length>300);
 assert.equal(bytes.length,job.bytes);
 if(output==='MP4')assert.equal(String.fromCharCode(...bytes.slice(4,8)),'ftyp');
 else assert.ok(String.fromCharCode(...bytes.slice(0,3))==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224));
 console.log('VYRNIVO_LIVE_CONVERSION_OK',JSON.stringify({output,bytes:bytes.length,expiresAt:job.expiresAt,seconds:Math.round((Date.now()-startAt)/1000)}));
}
await waitReady();
await test('MP3','https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3');
await test('MP4','https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');
