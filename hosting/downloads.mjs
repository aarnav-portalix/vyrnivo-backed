import {spawn} from 'node:child_process';
import {mkdir,rm,readdir,stat,open} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {classifyExtractorFailure} from './source-failures.mjs';
import {supportsFreeFallback,downloadViaFreeProvider} from './webdownloader.mjs';
import {downloadViaOwnedEngine} from './owned-downloader.mjs';
import {parseExtractorProgress} from './progress-metrics.mjs';
export function validate(input){
 const u=new URL(input.url);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Use an HTTPS video link.');
 const h=u.hostname.replace(/^www\./,'');let allowed=false;
 if(h==='youtu.be')allowed=/^\/[\w-]{11}$/.test(u.pathname);
 if(['youtube.com','m.youtube.com','music.youtube.com'].includes(h))allowed=(u.pathname==='/watch'&&/^[\w-]{11}$/.test(u.searchParams.get('v')||''))||/^\/(shorts|live)\/[\w-]{11}\/?$/.test(u.pathname);
 if(h==='youtube-nocookie.com')allowed=/^\/embed\/[\w-]{11}\/?$/.test(u.pathname);
 if(h==='instagram.com')allowed=/^\/(reel|p|tv)\/[\w-]{6,30}\/?$/.test(u.pathname);
 if(!allowed)throw Error('Paste a single YouTube video or public Instagram Reel/post link.');
 const modes=['Video + audio','Video only','Audio only'];if(!modes.includes(input.mode))throw Error('Choose a valid format.');
 const heights={'Best available':null,'2160p · 4K':2160,'1440p':1440,'1080p':1080,'720p':720};
 if(input.mode!=='Audio only'&&!(input.quality in heights))throw Error('Choose a valid video quality.');
 const containers=input.mode==='Audio only'?['Original audio','MP3','M4A','WAV']:['MP4','WebM','MKV'];if(!containers.includes(input.container))throw Error('Choose a valid file type.');
 return {...input,url:u.href,height:heights[input.quality]};
}
export function argumentsFor(input,dir){const x=validate(input);const filter=x.height?'[height<='+x.height+']':'';const ext=x.container.toLowerCase();
 // Prefer streams that fit the requested container without transcoding.
 // Keep a format fallback for sources that do not offer those streams.
 const video=(extension)=>'bestvideo[ext='+extension+']'+filter;
 const audio=(extension)=>'bestaudio[ext='+extension+']';
 let format;
 if(x.mode==='Audio only')format='bestaudio/best';
 else if(x.mode==='Video only')format=ext==='mkv'?'bestvideo'+filter:video(ext)+'/bestvideo'+filter;
 else if(ext==='mp4'){const combined='best[ext=mp4]'+filter;const separate=video('mp4')+'+'+audio('m4a');const isInstagram=new URL(x.url).hostname.replace(/^www\./,'')==='instagram.com';format=isInstagram?'best[height<=?'+(x.height||2160)+']/bestvideo*[height<=?'+(x.height||2160)+']+bestaudio/best':separate+'/'+combined+'/bestvideo'+filter+'+bestaudio/best'+filter}
 else if(ext==='webm')format=video('webm')+'+'+audio('webm')+'/best[ext=webm]'+filter+'/bestvideo'+filter+'+bestaudio/best'+filter;
 else format='bestvideo'+filter+'+bestaudio/best'+filter;
 const a=['-m','yt_dlp','--ignore-config','--no-playlist','--newline','--progress-template','download:%(progress._percent_str)s','--socket-timeout','12','--extractor-retries','2','--retries','2','--fragment-retries','2','--max-filesize','200M','--match-filter','duration <=? 1800','--js-runtimes','node','-f',format,'-o',join(dir,'media.%(ext)s')];
 if(x.mode==='Audio only'){a.push('-x');if(x.container!=='Original audio')a.push('--audio-format',x.container.toLowerCase(),'--audio-quality','0')}
 else a.push('--merge-output-format',x.container.toLowerCase(),'--remux-video',x.container.toLowerCase());
 a.push('--',x.url);return a;
}
export async function createDownloads({enabled=false,python='python3',onReady,spawnProcess=spawn,now=Date.now,fetchImpl=fetch,freeFallbackEnabled=false,verifyToken=async()=>({ok:true}),ownedEngineConfig=null}={}){
 const root=join(tmpdir(),'vyrnivo-downloads');const jobs=new Map();let active=false;let youtubeRetryAt=0;let backupRetryAt=0;let ownedRetryAt=0;const successful=new Map();const inProgress=new Map();
 if(enabled){await rm(root,{recursive:true,force:true});await mkdir(root,{recursive:true,mode:0o700})}
 const canTryFallback=input=>freeFallbackEnabled&&now()>=backupRetryAt&&supportsFreeFallback(input);
 const publicJob=j=>({id:j.id,state:j.state,createdAt:j.createdAt,elapsedSeconds:Math.max(0,Math.floor((now()-j.createdAt)/1000)),stage:j.stage||null,progressPercent:j.progressPercent??null,estimatedTotalSeconds:null,estimatedSecondsRemaining:j.state==='processing'?j.estimatedSecondsRemaining??null:null,progressSource:j.progressSource||null,progressUpdatedAt:j.progressUpdatedAt||null,transferredBytes:j.transferredBytes||null,totalBytes:j.totalBytes||null,estimateIsApproximate:true,error:j.error,failureCode:j.failureCode||null,canRetryWithDifferentFormat:j.canRetryWithDifferentFormat===true,expiresAt:j.expiresAt,name:j.name,bytes:j.bytes,provider:j.provider||'Temporary server storage',url:j.state==='ready'&&now()<j.expiresAt?'/api/downloads/'+j.id+'/file':null,downloadUrl:j.state==='ready'&&now()<j.expiresAt?'/api/downloads/'+j.id+'/file':null,hosted:j.hosted});
 async function run(j,input){const youtubeInput=/^(?:youtube\.com|m\.youtube\.com|music\.youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(new URL(input.url).hostname.replace(/^www\./,''));
 const useBackupFirst=youtubeInput&&now()<youtubeRetryAt&&canTryFallback(input);
 const tryOwned=async()=>{
  j.stage='Connecting to Vyrnivo engine';j.progressPercent=null;j.estimatedSecondsRemaining=null;j.progressSource=null;
  const result=await downloadViaOwnedEngine(input,j.dir,{
   config:ownedEngineConfig,fetchImpl,onProgress:p=>Object.assign(j,p),now
  });
  Object.assign(j,result,{state:'ready',stage:'Ready',progressPercent:100,
   expiresAt:now()+600000,failureCode:null,error:null,canRetryWithDifferentFormat:false});
  successful.set(j.requestKey,j.id);
 };

 const backup=async()=>{j.stage='Connecting to backup engine';j.progressPercent=null;j.estimatedSecondsRemaining=null;j.progressSource=null;const result=await downloadViaFreeProvider(input,j.dir,{fetchImpl,onProgress:p=>Object.assign(j,p)});Object.assign(j,result,{expiresAt:now()+600000,state:'ready',stage:'Ready',progressPercent:100,failureCode:null,error:null,canRetryWithDifferentFormat:false});successful.set(j.requestKey,j.id)};
 try{await mkdir(j.dir,{recursive:true,mode:0o700});
 if(ownedEngineConfig&&now()>=ownedRetryAt){
  try{await tryOwned();return}
  catch(error){
   if(error?.retryAfterMs>0)ownedRetryAt=now()+error.retryAfterMs;
   await rm(j.dir,{recursive:true,force:true});
   await mkdir(j.dir,{recursive:true,mode:0o700});
   j.stage='Checking source';j.progressPercent=null;j.estimatedSecondsRemaining=null;j.progressSource=null;
  }
 }
 if(useBackupFirst){await backup();return}let stdout='',stderr='';await new Promise((resolve,reject)=>{const proc=spawnProcess(python,argumentsFor(input,j.dir),{stdio:['ignore','pipe','pipe']});proc.stdout?.on('data',d=>{stdout=(stdout+d).slice(-3500);
 const percent=parseExtractorProgress(stdout);
 if(percent!==null){j.stage='Downloading media';j.progressSource='reported-extractor';j.progressUpdatedAt=now();j.estimatedSecondsRemaining=null;j.progressPercent=Math.round(percent*10)/10}});proc.stderr.on('data',d=>{stderr=(stderr+d).slice(-4000);if(/(?:HTTP Error|status(?: code)?)\s*:?\s*429\b|\b429 Too Many Requests\b|Too Many Requests/i.test(stderr))proc.kill('SIGTERM')});const timeout=setTimeout(()=>proc.kill('SIGKILL'),180000);const disk=setInterval(async()=>{try{let bytes=0;for(const f of await readdir(j.dir))bytes+=(await stat(join(j.dir,f))).size;if(bytes>400*1024*1024)proc.kill('SIGKILL')}catch{}},1000);const clear=()=>{clearTimeout(timeout);clearInterval(disk)};proc.on('error',e=>{clear();reject(e)});proc.on('close',code=>{clear();if(code===0)resolve();else {
 const failure=classifyExtractorFailure(stderr,{source:youtubeInput?'youtube':'instagram'});
 if(youtubeInput&&failure.code==='SOURCE_RATE_LIMITED')youtubeRetryAt=now()+1800000;
 j.failureCode=failure.code;j.canRetryWithDifferentFormat=failure.code==='MEDIA_FORMAT_UNAVAILABLE';
 console.error('extractor_failure',code,JSON.stringify({source:youtubeInput?'youtube':'instagram',reason:failure.code}));
 reject(Error(failure.message))
 }})});
 j.stage='Finalizing media';j.progressPercent=null;j.estimatedSecondsRemaining=null;j.progressSource=null;const seenFiles=await readdir(j.dir);const names=seenFiles.filter(n=>/^media\.[a-z0-9]+$/i.test(n)&&!n.endsWith('.part'));if(names.length!==1){console.warn('extractor_no_output',JSON.stringify({origin:new URL(input.url).hostname,files:seenFiles.map(n=>n.replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,60)).slice(0,12),stdout:stdout.replace(/https?:\/\/[^\s]+/g,'[url]').slice(-1200),stderr:stderr.replace(/https?:\/\/[^\s]+/g,'[url]').slice(-800)}));throw Error(/does not pass filter|duration|not available/i.test(stdout)?'The source video was skipped by media metadata filters.':'The extractor returned no downloadable media. This Reel may be inaccessible from the server.');}j.path=join(j.dir,names[0]);j.bytes=(await stat(j.path)).size;if(!j.bytes||j.bytes>200*1024*1024)throw Error('This file exceeds the 200 MB server limit.');j.name=names[0];j.expiresAt=now()+600000;j.state='ready';j.progressPercent=100;j.stage='Ready';successful.set(j.requestKey,j.id);if(onReady&&j.bytes<=50*1024*1024){try{j.hosted=await onReady(j.path,j.name)}catch{j.hosted={notice:'External hosting failed; direct download remains available.'}}}
 }catch(e){
  if(youtubeInput&&!useBackupFirst&&canTryFallback(input)&&['SOURCE_RATE_LIMITED','SOURCE_ACCESS_DENIED','SOURCE_VERIFICATION_REQUIRED','SOURCE_NETWORK_ERROR'].includes(j.failureCode)){
   try{await rm(j.dir,{recursive:true,force:true});await mkdir(j.dir,{recursive:true,mode:0o700});await backup();return}
   catch(fallbackError){e=fallbackError}
  }
  if(e?.code?.startsWith('FREE_PROVIDER_')){
   j.failureCode=e.code;
   // Only a provider-wide rate limit should disable the backup for *other* videos.
   // Single-video failures should never create a global outage.
   if(e.code==='FREE_PROVIDER_RATE_LIMITED'&&e.retryAfterMs>0)backupRetryAt=now()+e.retryAfterMs;
  }
  j.state='failed';j.stage='Could not finish';j.error=e?.message||'Download unavailable.';
  await rm(j.dir,{recursive:true,force:true});
 }finally{if(inProgress.get(j.requestKey)===j.id)inProgress.delete(j.requestKey);active=false}}
 const cleanup=async()=>{for(const [id,j]of jobs){if(j.state==='ready'&&now()>=j.expiresAt){j.state='expired';if(successful.get(j.requestKey)===id)successful.delete(j.requestKey);await rm(j.dir,{recursive:true,force:true})}if(['failed','expired'].includes(j.state)&&now()-j.createdAt>3600000)jobs.delete(id)}};
 const timer=enabled?setInterval(()=>cleanup().catch(()=>{}),5000):null;timer?.unref();
 return {enabled,sweep:cleanup,close(){clearInterval(timer)},async handle(req,res,path){const send=(d,s=200)=>{res.writeHead(s,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(d))};if(path==='/api/downloads/status')return send({enabled,providers:['Temporary server storage'],maxBytes:50*1024*1024,youtubeRetryAt,freeFallbackEnabled,backupRetryAt,sourceAvailability:{youtube:now()<youtubeRetryAt?(freeFallbackEnabled&&now()>=backupRetryAt?'backup-available':'rate-limited'):'unverified',instagram:'unverified'},maxMB:200,maxMinutes:30,retentionMinutes:10,reason:enabled?null:'Temporary download server is offline.'});if(!enabled)return send({error:'Download server is not connected.'},503);
 if(path==='/api/downloads/upload')return send({error:'Manual uploads are disabled. Paste a YouTube or Instagram link; Vyrnivo prepares a temporary download automatically.'},410);
 if(path==='/api/downloads'&&req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return send({error:'Request too large'},413)}let input,verificationToken;try{const payload=JSON.parse(body);input=validate(payload);verificationToken=payload.turnstileToken}catch(e){return send({error:e.message},400)}if(/(?:youtube\.com|youtu\.be)/.test(new URL(input.url).hostname)&&now()<youtubeRetryAt&&!canTryFallback(input)&&!(ownedEngineConfig&&now()>=ownedRetryAt)){res.setHeader('retry-after',String(Math.ceil((youtubeRetryAt-now())/1000)));return send({error:'The source is rate-limiting this server and the backup is cooling down. Please retry later.',retryAt:youtubeRetryAt,code:'SOURCE_RATE_LIMITED'},429)}const verified=await verifyToken(verificationToken);
 if(!verified?.ok)return send({error:verified?.error||'Human verification required.',code:verified?.code||'BOT_CHECK_FAILED'},verified?.status||403);
 const requestKey=JSON.stringify([input.url,input.mode,input.quality,input.container]);const prior=jobs.get(successful.get(requestKey));if(prior?.state==='ready'&&now()<prior.expiresAt)return send(publicJob(prior),200);const pending=jobs.get(inProgress.get(requestKey));if(pending?.state==='processing')return send(publicJob(pending),202);if(active)return send({error:'Another source is being prepared. Please try again when it finishes.',code:'SERVER_BUSY'},429);const id=randomUUID();const j={id,dir:join(root,id),state:'processing',createdAt:now(),stage:'Checking source',progressPercent:null,estimatedSecondsRemaining:null,progressSource:null,requestKey};jobs.set(id,j);inProgress.set(requestKey,id);active=true;void run(j,input);return send(publicJob(j),202)}
 if(req.method!=='GET')return send({error:'Method not allowed'},405);const parts=path.split('/');const j=jobs.get(parts[3]);if(!j)return send({error:'Download missing or expired.'},404);if(parts[4]==='file'){if(j.state!=='ready'||now()>=j.expiresAt)return send({error:'Download is not ready or has expired.'},410);res.writeHead(200,{'content-type':'application/octet-stream','content-disposition':'attachment; filename="'+j.name+'"','content-length':j.bytes,'cache-control':'no-store','x-content-type-options':'nosniff'});const stream=createReadStream(j.path);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return}return send(publicJob(j))}}
}
