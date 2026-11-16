import {setTimeout as sleep} from 'node:timers/promises';
const base='https://vyrnivo-downloads.onrender.com';
const video='https://www.youtube.com/watch?v=aqz-KE-bpKQ'; // Blender CC BY video
const body={url:video,mode:'Video + audio',quality:'720p',container:'MP4'};
const fetchJson=async (url,opts={})=>{const r=await fetch(url,{signal:AbortSignal.timeout(25000),...opts});let data={};try{data=await r.json()}catch{}return {http:r.status,data}};
const s=await fetchJson(base+'/api/downloads/status');
console.log('YOUTUBE_TEST_STATUS',JSON.stringify({http:s.http,enabled:s.data.enabled,youtubeSource:s.data.sourceAvailability?.youtube,retryAt:s.data.youtubeRetryAt}));
if(!s.data.enabled){console.log('YOUTUBE_TO_CONVERTER_VERDICT',JSON.stringify({success:false,reason:'Downloader disabled'}));process.exit(0)}
let x;
try{x=await fetchJson(base+'/api/downloads',{method:'POST',headers:{Origin:base,'content-type':'application/json'},body:JSON.stringify(body)});}catch(e){console.log('YOUTUBE_TO_CONVERTER_VERDICT',JSON.stringify({success:false,reason:'Request error',detail:String(e).slice(0,160)}));process.exit(0)}
console.log('YOUTUBE_START',JSON.stringify({http:x.http,state:x.data.state,code:x.data.code,error:x.data.error}));
if(x.http!==202&&x.http!==200){console.log('YOUTUBE_TO_CONVERTER_VERDICT',JSON.stringify({success:false,reason:x.data.error||'request rejected',code:x.data.code}));process.exit(0)}
let job=x.data;
for(let i=0;i<75&&job.state==='processing';i++){
 await sleep(2200);
 const r=await fetchJson(base+'/api/downloads/'+job.id);job=r.data;
}
if(job.state!=='ready'){console.log('YOUTUBE_TO_CONVERTER_VERDICT',JSON.stringify({success:false,state:job.state,error:job.error||'still processing'}));process.exit(0)}
const file=await fetch(base+job.downloadUrl,{signal:AbortSignal.timeout(25000)});
const bytes=new Uint8Array(await file.arrayBuffer());
const valid=bytes.length>1024&&(String.fromCharCode(...bytes.slice(4,8))==='ftyp'||job.name?.endsWith('.mkv')||job.name?.endsWith('.webm'));
console.log('YOUTUBE_TO_CONVERTER_VERDICT',JSON.stringify({success:valid,http:file.status,bytes:bytes.length,filename:job.name,mediaSignatureMP4:String.fromCharCode(...bytes.slice(4,8))==='ftyp'}));
