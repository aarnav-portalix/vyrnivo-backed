const videoId='aqz-KE-bpKQ';
const videoUrl='https://www.youtube.com/watch?v='+videoId;
const engine=process.argv[2]||'unknown';
const result={engine,videoId,backend:'GitHub Ubuntu Node 22',verifiedMedia:false,bytes:0};
function clean(err){return String(err?.message||err).replace(/https?:\/\/[^\s]+/g,'[url]').slice(0,220)}
async function verifyMedia(url){
 if(!url) return {verifiedMedia:false,reason:'No playable stream URL in metadata'};
 const u=new URL(url);
 if(u.protocol!=='https:')return {verifiedMedia:false,reason:'Media URL not HTTPS'};
 try{
  const res=await fetch(url,{headers:{Range:'bytes=0-65535'},signal:AbortSignal.timeout(14000)});
  const reader=res.body?.getReader();
  const first=reader?await reader.read():null;
  const bytes=first?.value||new Uint8Array();
  if(reader)await reader.cancel().catch(()=>{});
  const mp4=bytes.length>8&&String.fromCharCode(...bytes.slice(4,8))==='ftyp';
  const webm=bytes.length>=4&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;
  return {verifiedMedia:(mp4||webm)&&res.ok,bytes:bytes.length,signature:mp4?'MP4':webm?'WebM':'unverified',http:res.status,contentType:res.headers.get('content-type')};
 }catch(e){return {verifiedMedia:false,reason:'Video CDN request failed: '+clean(e)}}
}
async function probe(){
 if(engine==='youtubeijs'){
  const mod=await import('youtubei.js');
  const Innertube=mod.Innertube||mod.default?.Innertube;
  const yt=await Innertube.create({generate_session_locally:true});
  const video=await yt.getInfo(videoId);
  const streams=[...(video.streaming_data?.formats||[]),...(video.streaming_data?.adaptive_formats||[])];
  Object.assign(result,{metadata:!!video.basic_info,title:video.basic_info?.title?.slice(0,90),streams:streams.length,hasStreamUrl:streams.some(x=>Boolean(x.url))});
  const playable=streams.find(x=>x.mime_type?.includes('video/mp4')&&x.url)||streams.find(x=>x.url);
  Object.assign(result,await verifyMedia(playable?.url));
 }
 else if(engine==='distube'){
  const req=await import('node:module').then(x=>x.createRequire(import.meta.url));
  const ytdl=req('@distube/ytdl-core');
  result.packageVersion=req('@distube/ytdl-core/package.json').version;
  const info=await ytdl.getInfo(videoUrl);
  const streams=info?.formats||[];
  Object.assign(result,{metadata:!!info?.videoDetails,streams:streams.length,hasStreamUrl:streams.some(x=>Boolean(x.url))});
  const playable=streams.find(x=>x.url&&x.container==='mp4')||streams.find(x=>x.url);
  Object.assign(result,await verifyMedia(playable?.url));
 }
}
try{await probe()}catch(e){result.error=clean(e)}
console.log('ENGINE_SHOWDOWN',JSON.stringify(result));process.exit(0);
