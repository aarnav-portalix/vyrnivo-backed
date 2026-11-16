// Independent proof-of-feasibility for a legitimate third-party source.
// Never download if the owner disables downloads. No copying from YouTube.
const hosts=['https://framatube.org','https://peertube.cpy.re','https://peertube2.cpy.re'];
const fetchJson=async url=>{const res=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error('HTTP '+res.status);return res.json()};
let passed=0;
for(const host of hosts){
 const report={service:'PeerTube',host,accessible:false,downloadEnabled:false,videoSourceVerified:false};
 try{
  const search=await fetchJson(host+'/api/v1/search/videos?search='+encodeURIComponent('What is PeerTube')+'&count=10');
  let videos=search.data||[];
  // Search results are remote; always inspect the video's authoritative metadata.
  for(const item of videos.slice(0,7)){
   let video;
   try{video=await fetchJson(host+'/api/v1/videos/'+encodeURIComponent(item.uuid||item.id))}catch{continue}
   if(!video.downloadEnabled)continue;
   const formats=[...(video.files||[]),...(video.streamingPlaylists||[]).flatMap(p=>p.files||[])];
   const choice=formats.find(f=>/^https:\/\//.test(f.fileDownloadUrl||f.fileUrl||''));if(!choice)continue;
   const link=choice.fileDownloadUrl||choice.fileUrl;
   const parsed=new URL(link);
   if(parsed.hostname!==new URL(host).hostname)continue; // no external CDN without separate review
   report.accessible=true;report.downloadEnabled=true;report.title=String(video.name||'').slice(0,100);
   const res=await fetch(link,{headers:{Range:'bytes=0-16383'},signal:AbortSignal.timeout(16000)});
   const reader=res.body?.getReader();const first=reader?await reader.read():null;
   const bytes=first?.value||new Uint8Array();if(reader)await reader.cancel().catch(()=>{});
   const mp4=bytes.length>8&&String.fromCharCode(...bytes.slice(4,8))==='ftyp';
   const webm=bytes.length>4&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;
   report.videoSourceVerified=res.ok&&(mp4||webm);report.firstBytes=bytes.length;report.fileType=mp4?'MP4':webm?'WebM':'unknown';report.http=res.status;
   if(report.videoSourceVerified)passed++;
   break;
  }
  report.searchResults=videos.length;
 }catch(e){report.error=String(e.message||e).slice(0,100)}
 console.log('PEERTUBE_REAL_DOWNLOAD_PROBE',JSON.stringify(report));
}
console.log('PEERTUBE_PROBE_SUMMARY',JSON.stringify({sitesWithVerifiedDownload:passed}));
