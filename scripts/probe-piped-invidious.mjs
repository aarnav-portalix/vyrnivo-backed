// One-off, low-volume probe of public Piped and Invidious APIs.
// Only tests CC-BY Blender Foundation video and at most 48KB of file content.
// Never forward third-party media URLs or identities to the Vyrnivo production site.
import {setTimeout as delay} from 'node:timers/promises';
const id='aqz-KE-bpKQ'; // Blender Foundation Big Buck Bunny (CC BY 3.0)
const piped=[
 'https://pipedapi.kavin.rocks',
 'https://pipedapi.adminforge.de',
 'https://pipedapi.owo.si'
];
const invidious=[
 'https://inv.nadeko.net',
 'https://invidious.nerdvpn.de',
 'https://invidious.tiekoetter.com'
];
const safeFetch=async(url,{ms=12500,range=false}={})=>{
 const u=new URL(url);
 if(u.protocol!=='https:')throw Error('not HTTPS');
 const r=await fetch(u,{signal:AbortSignal.timeout(ms),redirect:'error',headers:range?{Range:'bytes=0-32767'}:{Accept:'application/json'}});
 return r;
};
const summarizeError=(e)=>String(e?.message||e).slice(0,140);
function safeMediaURL(raw,fromHost){
 try{
  const u=new URL(raw),host=u.hostname.toLowerCase(),origin=new URL(fromHost);
  // Only approved public video CDN or the inspected API instance itself.
  return u.protocol==='https:'&&(
   host==='googlevideo.com'||host.endsWith('.googlevideo.com')||
   host===origin.hostname
  )?u.href:null;
 }catch{return null}
}
async function firstBytes(url){
 const response=await safeFetch(url,{ms:14000,range:true});
 const rdr=response.body?.getReader();
 let bytes=new Uint8Array();
 try{
  if(rdr){const read=await rdr.read();bytes=read.value||bytes}
 }finally{await rdr?.cancel().catch(()=>{})}
 const magic=bytes.length>=12?Array.from(bytes.slice(0,12)).map(n=>n.toString(16).padStart(2,'0')).join(''):'';
 const mp4=bytes.length>8&&String.fromCharCode(...bytes.slice(4,8))==='ftyp';
 const webm=bytes.length>4&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;
 return {status:response.status,contentType:(response.headers.get('content-type')||'').slice(0,75),firstChunkBytes:bytes.length,mediaSignature:mp4?'MP4':webm?'WebM':'unknown',sampleHashPrefix:magic.slice(0,8)};
}
async function probe(host,kind){
 try{
  const path=kind==='Piped'?'/streams/'+id:'/api/v1/videos/'+id;
  const r=await safeFetch(host+path);
  const raw=(await r.text()).slice(0,2_000_000);
  let json;try{json=JSON.parse(raw)}catch{json=null}
  const a=kind==='Piped'?[...(json?.videoStreams||[]),...(json?.audioStreams||[])]:[...(json?.formatStreams||[]),...(json?.adaptiveFormats||[])];
  const stream=a.find(s=>safeMediaURL(s.url,host)&&(/video\/mp4|video\/webm/.test(s.mimeType||s.type||'')||/(?:mp4|webm)/.test(s.container||'')));
  const result={kind,host,status:r.status,json:!!json,title:!!(json?.title),streams:a.length,available:!!stream};
  if(stream){try{result.media=await firstBytes(safeMediaURL(stream.url,host))}catch(e){result.mediaError=summarizeError(e)}}
  console.log('PROBE_RESULT',JSON.stringify(result));
  return result;
 }catch(e){const result={kind,host,error:summarizeError(e)};console.log('PROBE_RESULT',JSON.stringify(result));return result}
}
const results=await Promise.all([
 ...piped.map(x=>probe(x,'Piped')),
 ...invidious.map(x=>probe(x,'Invidious'))
]);
const passed=results.filter(r=>r.media?.firstChunkBytes>0&&['MP4','WebM'].includes(r.media.mediaSignature));
console.log('ALTERNATIVE_ENGINE_VERDICT',JSON.stringify({tested:results.length,metadataUsable:results.filter(x=>x.streams>0).length,realMediaBytesPassed:passed.length,passSources:passed.map(x=>x.kind)}));
// Do not return code 1 because "no accessible public instance" is an empirical outcome, not a broken script.
