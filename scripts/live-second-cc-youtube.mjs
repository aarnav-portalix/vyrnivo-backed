import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
const base='https://vyrnivo-downloads.onrender.com';
const fetchJson=async(path,opts={})=>{const response=await fetch(base+path,{signal:AbortSignal.timeout(30000),...opts});return {status:response.status,data:await response.json()}};
const start=await fetchJson('/api/converter',{method:'POST',headers:{Origin:base,'content-type':'application/json'},body:JSON.stringify({url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',output:'MP4'})});
assert.equal(start.status,202,'Could not start licensed conversion: '+JSON.stringify(start.data));
let job=start.data;for(let n=0;n<75&&job.state==='processing';n++){await sleep(1400);job=(await fetchJson('/api/converter/'+job.id)).data}
assert.equal(job.state,'ready','Conversion did not finish: '+JSON.stringify(job));
assert.equal(job.sourceMetadata?.durationSeconds,19);
const response=await fetch(base+job.downloadUrl,{signal:AbortSignal.timeout(25000)});
assert.equal(response.status,200);
const video=new Uint8Array(await response.arrayBuffer());
assert.equal(video.byteLength,job.bytes);
assert.equal(String.fromCharCode(...video.slice(4,8)),'ftyp');
console.log('LIVE_SECOND_CC_FILM_OK',JSON.stringify({bytes:video.byteLength,videoLengthSeconds:19,creator:'Jawed Karim and Yakov Lapitsky',source:'Wikimedia Commons',youtubeMediaRetrieved:false}));
