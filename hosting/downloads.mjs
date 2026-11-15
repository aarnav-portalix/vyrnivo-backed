import {spawn} from 'node:child_process';
import {mkdir,rm,readdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
export function validate(input){
 const u=new URL(input.url);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Use an HTTPS video link.');
 const h=u.hostname.replace(/^www\./,'');let allowed=false;
 if(h==='youtu.be')allowed=/^\/[\w-]{11}$/.test(u.pathname);
 if(['youtube.com','m.youtube.com'].includes(h))allowed=(u.pathname==='/watch'&&/^[\w-]{11}$/.test(u.searchParams.get('v')||''))||/^\/(shorts|live)\/[\w-]{11}\/?$/.test(u.pathname);
 if(h==='instagram.com')allowed=/^\/(reel|p|tv)\/[\w-]{6,30}\/?$/.test(u.pathname);
 if(!allowed)throw Error('Paste a single YouTube video or public Instagram Reel/post link.');
 const modes=['Video + audio','Video only','Audio only'];if(!modes.includes(input.mode))throw Error('Choose a valid format.');
 const heights={'Best available':null,'2160p · 4K':2160,'1440p':1440,'1080p':1080,'720p':720};
 if(input.mode!=='Audio only'&&!(input.quality in heights))throw Error('Choose a valid video quality.');
 const containers=input.mode==='Audio only'?['Original audio','MP3','M4A','WAV']:['MP4','WebM','MKV'];if(!containers.includes(input.container))throw Error('Choose a valid file type.');
 return {...input,url:u.href,height:heights[input.quality]};
}
export function argumentsFor(input,dir){const x=validate(input);const filter=x.height?'[height<='+x.height+']':'';let format=x.mode==='Audio only'?'bestaudio/best':x.mode==='Video only'?'bestvideo'+filter:'bestvideo'+filter+'+bestaudio/best'+filter;
 const a=['-m','yt_dlp','--ignore-config','--no-playlist','--no-progress','--no-warnings','--socket-timeout','20','--retries','1','--fragment-retries','1','--max-filesize','200M','--match-filter','duration <= 1800','--js-runtimes','node','-f',format,'-o',join(dir,'media.%(ext)s')];
 if(x.mode==='Audio only'){a.push('-x');if(x.container!=='Original audio')a.push('--audio-format',x.container.toLowerCase(),'--audio-quality','0')}
 else a.push('--merge-output-format',x.container.toLowerCase(),'--remux-video',x.container.toLowerCase());
 a.push('--',x.url);return a;
}
export async function createDownloads({enabled=false,python='python3',onReady,spawnProcess=spawn}={}){
 const root=join(tmpdir(),'vyrnivo-downloads');const jobs=new Map();let active=false;
 if(enabled){await rm(root,{recursive:true,force:true});await mkdir(root,{recursive:true,mode:0o700})}
 const publicJob=j=>({id:j.id,state:j.state,error:j.error,expiresAt:j.expiresAt,name:j.name,bytes:j.bytes,downloadUrl:j.state==='ready'&&Date.now()<j.expiresAt?'/api/downloads/'+j.id+'/file':null,hosted:j.hosted});
 async function run(j,input){try{await mkdir(j.dir,{recursive:true,mode:0o700});await new Promise((resolve,reject)=>{const proc=spawnProcess(python,argumentsFor(input,j.dir),{stdio:['ignore','ignore','pipe']});let stderr='';proc.stderr.on('data',d=>{stderr=(stderr+d).slice(-4000)});const timeout=setTimeout(()=>proc.kill('SIGKILL'),180000);const disk=setInterval(async()=>{try{let bytes=0;for(const f of await readdir(j.dir))bytes+=(await stat(join(j.dir,f))).size;if(bytes>400*1024*1024)proc.kill('SIGKILL')}catch{}},1000);const clear=()=>{clearTimeout(timeout);clearInterval(disk)};proc.on('error',e=>{clear();reject(e)});proc.on('close',code=>{clear();if(code===0)resolve();else reject(Error(/sign in|login|cookies|bot|403|429/i.test(stderr)?'The source blocked this request or requires sign-in. Private/session-based downloads are not supported.':'Could not prepare this format within the server limits. Try a lower quality or another file type.'))})});
 const names=(await readdir(j.dir)).filter(n=>/^media\.[a-z0-9]+$/i.test(n)&&!n.endsWith('.part'));if(names.length!==1)throw Error('No downloadable file was returned by the source.');j.path=join(j.dir,names[0]);j.bytes=(await stat(j.path)).size;if(!j.bytes||j.bytes>200*1024*1024)throw Error('This file exceeds the 200 MB server limit.');j.name=names[0];j.expiresAt=Date.now()+600000;j.state='ready';if(onReady&&j.bytes<=50*1024*1024){try{j.hosted=await onReady(j.path,j.name)}catch{j.hosted={notice:'External hosting failed; direct download remains available.'}}}
 }catch(e){j.state='failed';j.error=e.message;await rm(j.dir,{recursive:true,force:true})}finally{active=false}}
 const cleanup=async()=>{for(const [id,j]of jobs){if(j.state==='ready'&&Date.now()>=j.expiresAt){j.state='expired';await rm(j.dir,{recursive:true,force:true})}if(['failed','expired'].includes(j.state)&&Date.now()-j.createdAt>3600000)jobs.delete(id)}};
 const timer=enabled?setInterval(()=>cleanup().catch(()=>{}),5000):null;timer?.unref();
 return {enabled,close(){clearInterval(timer)},async handle(req,res,path){const send=(d,s=200)=>{res.writeHead(s,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(d))};if(path==='/api/downloads/status')return send({enabled,maxMB:200,maxMinutes:30,retentionMinutes:10,reason:enabled?null:'Download server is not connected. Connect the hosting account to activate downloads.'});if(!enabled)return send({error:'Download server is not connected.'},503);
 if(path==='/api/downloads'&&req.method==='POST'){if(active)return send({error:'Another file is processing. Try again shortly.'},429);let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return send({error:'Request too large'},413)}let input;try{input=validate(JSON.parse(body))}catch(e){return send({error:e.message},400)}const id=randomUUID();const j={id,dir:join(root,id),state:'processing',createdAt:Date.now()};jobs.set(id,j);active=true;void run(j,input);return send(publicJob(j),202)}
 if(req.method!=='GET')return send({error:'Method not allowed'},405);const parts=path.split('/');const j=jobs.get(parts[3]);if(!j)return send({error:'Download missing or expired.'},404);if(parts[4]==='file'){if(j.state!=='ready'||Date.now()>=j.expiresAt)return send({error:'Download is not ready or has expired.'},410);res.writeHead(200,{'content-type':'application/octet-stream','content-disposition':'attachment; filename="'+j.name+'"','content-length':j.bytes,'cache-control':'no-store','x-content-type-options':'nosniff'});const stream=createReadStream(j.path);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return}return send(publicJob(j))}}
}
