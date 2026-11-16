import {createRequire} from 'node:module';
import {stat,open} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const pkg=require('@hiudyy/ytdl');
const report={engine:'@hiudyy/ytdl multi-provider',videoId:'aqz-KE-bpKQ',cloud:'GitHub Actions',verifiedMedia:false,permissionToEmbedProviders:'not verified'};
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),42000);
try{
 if(pkg.configureDefaultYouTubePool)pkg.configureDefaultYouTubePool({retries:0,retryDelayMs:250});
 const d=await pkg.downloadYouTube('https://www.youtube.com/watch?v=aqz-KE-bpKQ','mp4',{signal:controller.signal});
 report.provider=d?.source||null;report.successClaim=d?.success===true;report.error=String(d?.error||'').slice(0,130);
 if(d?.success&&d?.filePath){
  const s=await stat(d.filePath);
  const f=await open(d.filePath,'r');
  const b=Buffer.alloc(12);await f.read(b,0,12,0);await f.close();
  const mp4=b.subarray(4,8).toString()==='ftyp';
  const webm=b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3;
  report.bytes=s.size;report.signature=mp4?'MP4':webm?'WebM':'unknown';report.verifiedMedia=s.size>1024&&(mp4||webm);
 } else report.media='No local video file returned';
}catch(e){report.error=String(e?.message||e).slice(0,175)}
finally{clearTimeout(timer)}
console.log('MULTIPROVIDER_SHOWDOWN',JSON.stringify(report));process.exit(0);
