const r={engine:'yt-dlp-wasm',backend:'GitHub Ubuntu Node JSPI',videoId:'aqz-KE-bpKQ',verifiedMedia:false};
let ytdlp;
try{
 const mod=await import('@project516/yt-dlp-wasm');
 ytdlp=await mod.createYtDlp({onLog:(line)=>{if(/ERROR|login required|429|403|Sign in/i.test(line))r.lastError=String(line).slice(0,160)}});
 const info=await ytdlp.extractInfo('https://www.youtube.com/watch?v=aqz-KE-bpKQ',{noplaylist:true,skip_download:true,socket_timeout:12,retries:0,extractor_retries:0});
 r.metadata=!!info?.id;r.title=info?.title?.slice(0,80);
 const urls=(info?.formats||[]).filter(f=>f.url&&/^https:/.test(f.url)&&/mp4|webm/.test(f.ext||''));
 r.formats=urls.length;
 const f=urls.find(f=>f.ext==='mp4')||urls[0];
 if(f){
  const media=await fetch(f.url,{headers:{Range:'bytes=0-65535'},signal:AbortSignal.timeout(17000)});
  const reader=media.body?.getReader();const b=reader?(await reader.read()).value||new Uint8Array():new Uint8Array();
  await reader?.cancel().catch(()=>{});
  const mp4=b.length>8&&String.fromCharCode(...b.slice(4,8))==='ftyp';
  const webm=b.length>=4&&b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3;
  r.mediaHttp=media.status;r.mediaBytes=b.length;r.signature=mp4?'MP4':webm?'WebM':'unknown';r.verifiedMedia=media.ok&&(mp4||webm);
 }
}catch(e){r.error=String(e.message||e).replace(/https?:\/\/[^\s]+/g,'[url]').slice(0,240)}
finally{try{await ytdlp?.close()}catch{}}
console.log('ENGINE_SHOWDOWN',JSON.stringify(r));process.exit(0);
