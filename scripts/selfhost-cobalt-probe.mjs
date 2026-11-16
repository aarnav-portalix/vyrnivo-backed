import {setTimeout as pause} from 'node:timers/promises';
const api='http://127.0.0.1:9000';
let version=null,services=[];
for(let n=0;n<45;n++){
 try{const r=await fetch(api+'/',{signal:AbortSignal.timeout(3000)});if(r.ok){const d=await r.json();version=d.cobalt?.version;services=d.cobalt?.services||[];break;}}catch{}
 await pause(1000);
}
if(!version){console.log('COBALT_PROBE',JSON.stringify({result:'backend-start-failed'}));process.exit(0)}
// Both films were released under Creative Commons Attribution 3.0 by Blender Foundation.
// Only attempt a small sample of media bytes if the processing API returns an eligible link.
for(const videoId of ['aqz-KE-bpKQ','eRsGyueVLvQ']){
 const report={engine:'self-hosted Cobalt',apiVersion:version,youtubeAdvertised:services.includes('youtube'),videoId,source:'Blender Foundation CC BY'};
 try{
  const r=await fetch(api+'/',{method:'POST',headers:{Accept:'application/json','content-type':'application/json'},body:JSON.stringify({url:'https://www.youtube.com/watch?v='+videoId,videoQuality:'360',downloadMode:'auto',localProcessing:'disabled',alwaysProxy:true}),signal:AbortSignal.timeout(45000)});
  const d=await r.json().catch(()=>({}));
  Object.assign(report,{http:r.status,status:d.status,errorCode:d.error?.code||null,returnedMediaLocation:!!d.url});
  if(['tunnel','redirect'].includes(d.status)&&d.url){
   const u=new URL(d.url);
   if(!['https:','http:'].includes(u.protocol))report.media='unsupported url';
   else{
    try{
     const f=await fetch(d.url,{headers:{Range:'bytes=0-32767'},signal:AbortSignal.timeout(22000)});
     const reader=f.body?.getReader();const first=reader?await reader.read():null;const bytes=first?.value||new Uint8Array();
     await reader?.cancel().catch(()=>{});
     const mp4=bytes.length>8&&String.fromCharCode(...bytes.slice(4,8))==='ftyp';
     const webm=bytes.length>4&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf;
     report.media={http:f.status,bytes:bytes.length,signature:mp4?'MP4':webm?'WebM':'unknown'};
    }catch(e){report.media={error:String(e?.message||e).slice(0,90)}}
   }
  }
 }catch(e){report.error=String(e?.message||e).slice(0,130)}
 console.log('COBALT_PROBE',JSON.stringify(report));
}
