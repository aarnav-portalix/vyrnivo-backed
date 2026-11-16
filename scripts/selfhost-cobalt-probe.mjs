import {setTimeout as pause} from 'node:timers/promises';
const api='http://127.0.0.1:9000';
const clip='https://www.youtube.com/watch?v=aqz-KE-bpKQ'; // Blender Foundation Creative Commons movie
const report={engine:'self-hosted Cobalt',source:'CC BY video on YouTube',videoId:'aqz-KE-bpKQ'};
let up=false;
for(let n=0;n<45;n++){
 try{const r=await fetch(api+'/',{signal:AbortSignal.timeout(3000)});if(r.ok){const d=await r.json();report.apiVersion=d.cobalt?.version;report.youtubeAdvertised=(d.cobalt?.services||[]).includes('youtube');up=true;break;}}catch{}
 await pause(1000);
}
if(!up){console.log('COBALT_PROBE',JSON.stringify({...report,result:'backend-start-failed'}));process.exit(0)}
try{
 const r=await fetch(api+'/',{method:'POST',headers:{Accept:'application/json','content-type':'application/json'},body:JSON.stringify({url:clip,videoQuality:'360',downloadMode:'auto',localProcessing:'disabled',alwaysProxy:true}),signal:AbortSignal.timeout(45000)});
 let d={};try{d=await r.json()}catch{}
 report.http=r.status;report.status=d.status;report.errorCode=d.error?.code??null;report.returnedMediaLocation=Boolean(d.url);
 if((d.status==='tunnel'||d.status==='redirect')&&d.url){
  let target;try{target=new URL(d.url)}catch{target=null}
  if(target?.protocol==='http:'&&target.hostname!=='127.0.0.1'){report.media='not checked: unsafe URL';}
  else if(target&&['http:','https:'].includes(target.protocol)){
   try{
    const m=await fetch(d.url,{headers:{range:'bytes=0-32767'},signal:AbortSignal.timeout(22000)});
    const reader=m.body?.getReader();let got=new Uint8Array();
    if(reader){const x=await reader.read();got=x.value||got;await reader.cancel().catch(()=>{})}
    const isMp4=got.length>8&&String.fromCharCode(...got.slice(4,8))==='ftyp';
    const isWebM=got.length>4&&got[0]===0x1a&&got[1]===0x45&&got[2]===0xdf&&got[3]===0xa3;
    report.media={http:m.status,type:m.headers.get('content-type'),bytesRead:got.length,signature:isMp4?'MP4':isWebM?'WebM':'unknown'};
   }catch(e){report.media={error:String(e?.message||e).slice(0,120)}}
  }
 }
 console.log('COBALT_PROBE',JSON.stringify(report));
}catch(e){console.log('COBALT_PROBE',JSON.stringify({...report,result:'request-failed',error:String(e?.message||e).slice(0,120)}))}
