/**
 * Vyrnivo's own first-party media conversion service.
 * This accepts actual, publicly accessible media files on a narrow host allowlist.
 * It does not extract videos from YouTube watch pages or evade access controls.
 */
import {spawn} from 'node:child_process';
import {createWriteStream,createReadStream} from 'node:fs';
import {mkdir,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {licensedSourceForYoutube} from './licensed-youtube.mjs';

const SOURCE_HOSTS=new Set([
 'interactive-examples.mdn.mozilla.net',
 'upload.wikimedia.org',
 'media.w3.org'
]);
const EXTENSIONS=new Set(['mp4','webm','mov','m4v','ogv','ogg','mp3','m4a','wav','opus']);
const MAX_INPUT_BYTES=30*1024*1024;
const MAX_OUTPUT_BYTES=80*1024*1024;
const RETENTION_MS=600000;
const MAX_RUNTIME_MS=120000;

export function validateConversion(input){
 if(!input||typeof input!=='object')throw Error('Provide a direct video or audio file URL.');
 const raw=String(input.url||'');
 if(raw.length>1900)throw Error('The media URL is too long.');
 let url;
 try{url=new URL(raw)}catch{throw Error('Enter a valid HTTPS media file URL.')}
 const licensed=licensedSourceForYoutube(raw);
 if(licensed){
  if(input.output!=='MP4'&&input.output!=='MP3')throw Error('Choose MP4 or MP3 as the output.');
  const sourceUrl=new URL(licensed.mediaUrl);
  if(!SOURCE_HOSTS.has(sourceUrl.hostname))throw Error('The licensed source is not approved.');
  return {url:sourceUrl.href,extension:sourceUrl.pathname.split('.').pop().toLowerCase(),output:input.output,sourceMetadata:{
   videoTitle:licensed.videoTitle,description:licensed.description,sourcePage:licensed.sourcePage,
   license:licensed.license,licenseUrl:licensed.licenseUrl,attribution:licensed.attribution,
   transformed:licensed.transformed,durationSeconds:licensed.durationSeconds,
   alternateVersion:true
  }};
 }
 if(url.protocol!=='https:'||url.username||url.password||url.port||!SOURCE_HOSTS.has(url.hostname.toLowerCase()))throw Error('Use a direct media file from an approved public source (MDN, Wikimedia or W3C).');
 const ext=url.pathname.split('.').pop()?.toLowerCase();
 if(!EXTENSIONS.has(ext))throw Error('Paste a direct media file ending in MP4, WebM, MOV, M4V, OGV, OGG, MP3, M4A, WAV or Opus—not a webpage or YouTube watch link.');
 if(url.search.length>500)throw Error('The media URL has too many parameters.');
 const output=input.output;
 if(output!=='MP4'&&output!=='MP3')throw Error('Choose MP4 or MP3 as the output.');
 return {url:url.href,extension:ext,output};
}

async function downloadAllowedFile(url,path,{fetchImpl=fetch}={}){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),35000);
 try{
  // Never follow a redirect to an unreviewed host, including private/internal IPs.
  const response=await fetchImpl(url,{redirect:'error',signal:controller.signal,headers:{Accept:'video/*, audio/*, application/octet-stream'}});
  if(!response.ok||!response.body)throw Error('The source file could not be retrieved.');
  const mime=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(!/^(video|audio)\//.test(mime)&&mime!=='application/octet-stream'&&mime!=='application/ogg')throw Error('This link did not return a video or audio file.');
  const announced=Number(response.headers.get('content-length'));
  if(Number.isFinite(announced)&&announced>MAX_INPUT_BYTES)throw Error('Source file exceeds the 30 MB converter limit.');
  let received=0;
  const limiter=new Transform({
   transform(chunk,encoding,callback){
    received+=chunk.length;
    if(received>MAX_INPUT_BYTES)callback(Error('Source file exceeds the 30 MB converter limit.'));
    else callback(null,chunk);
   }
  });
  await pipeline(Readable.fromWeb(response.body),limiter,createWriteStream(path,{mode:0o600}),{signal:controller.signal});
  if(received<128)throw Error('The source file was empty.');
  return received;
 }catch(e){
  if(e.name==='AbortError')throw Error('Retrieving this source file timed out.');
  throw e;
 }finally{clearTimeout(timeout)}
}

function ffmpegArgs(source,target,format){
 const base=['-hide_banner','-nostdin','-loglevel','error','-y','-i',source,'-t','120'];
 if(format==='MP3')return [...base,'-map','0:a:0','-vn','-codec:a','libmp3lame','-q:a','4','-fs',String(MAX_OUTPUT_BYTES),target];
 return [...base,'-map','0:v:0','-map','0:a:0?','-codec:v','libx264','-preset','ultrafast','-crf','29','-pix_fmt','yuv420p','-codec:a','aac','-b:a','128k','-movflags','+faststart','-fs',String(MAX_OUTPUT_BYTES),target];
}
async function runFfmpeg(source,target,format,{spawnProcess=spawn}={}){
 await new Promise((resolve,reject)=>{
  const child=spawnProcess('ffmpeg',ffmpegArgs(source,target,format),{stdio:['ignore','ignore','pipe']});
  let errorOutput='';
  child.stderr?.on('data',d=>{errorOutput=(errorOutput+d).slice(-600)});
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},MAX_RUNTIME_MS);
  const clear=()=>clearTimeout(timer);
  child.on('error',e=>{clear();reject(Error('Media converter is unavailable: '+e.code))});
  child.on('close',code=>{
   clear();
   if(code===0)resolve();
   else if(timedOut)reject(Error('The conversion exceeded the 2-minute server limit.'));
   else reject(Error(/Stream map.*matches no streams|matches no streams|does not contain any stream/i.test(errorOutput)
    ? 'The source does not contain the media needed for this output format.'
    : 'This media format could not be converted. Try a different direct media file.'));
  });
 });
}

export async function createConverter({enabled=false,now=Date.now,fetchImpl=fetch,spawnProcess=spawn}={}){
 const root=join(tmpdir(),'vyrnivo-converter');
 const jobs=new Map();
 let active=false;
 if(enabled){await rm(root,{recursive:true,force:true});await mkdir(root,{recursive:true,mode:0o700})}
 const publicJob=j=>({id:j.id,engine:'converter',state:j.state,error:j.error||null,expiresAt:j.expiresAt||null,name:j.name||null,bytes:j.bytes||0,sourceMetadata:j.sourceMetadata||null,downloadUrl:j.state==='ready'&&now()<j.expiresAt?'/api/converter/'+j.id+'/file':null});
 const clean=async()=>{
  for(const [id,j] of jobs){
   if(j.state==='ready'&&now()>=j.expiresAt){j.state='expired';await rm(j.dir,{recursive:true,force:true})}
   if(['expired','failed'].includes(j.state)&&now()-j.createdAt>3600000)jobs.delete(id);
  }
 };
 const timer=enabled?setInterval(()=>void clean().catch(()=>{}),5000):null;timer?.unref();
 async function execute(j,input){
  try{
   await mkdir(j.dir,{recursive:true,mode:0o700});
   const source=join(j.dir,'input.'+input.extension);
   const out=join(j.dir,'vyrnivo-converted.'+input.output.toLowerCase());
   await downloadAllowedFile(input.url,source,{fetchImpl});
   await runFfmpeg(source,out,input.output,{spawnProcess});
   await rm(source,{force:true});
   const info=await stat(out);
   if(!info.size||info.size>MAX_OUTPUT_BYTES)throw Error('Converted file exceeds the 80 MB server limit.');
   j.bytes=info.size;j.name='vyrnivo-converted.'+input.output.toLowerCase();j.file=out;j.sourceMetadata=input.sourceMetadata||null;
   j.expiresAt=now()+RETENTION_MS;j.state='ready';
  }catch(e){
   console.error('converter_failure',String(e?.message||e).slice(0,240));
   j.error=String(e?.message||'Conversion failed');j.state='failed';
   await rm(j.dir,{recursive:true,force:true});
  }finally{active=false}
 }
 return {
  enabled,sweep:clean,close(){clearInterval(timer)},
  async handle(req,res,path){
   const send=(data,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data))};
   if(path==='/api/converter/status'&&req.method==='GET')return send({enabled,formats:['MP4','MP3'],sourceHosts:[...SOURCE_HOSTS],maxInputMB:30,maxOutputMB:80,retentionMinutes:10,description:'Vyrnivo first-party converter for direct, authorized media files, plus one curated and clearly labeled licensed YouTube-film excerpt. General YouTube links are not supported.'});
   if(!enabled)return send({error:'Converter is currently offline.'},503);
   if(path==='/api/converter'&&req.method==='POST'){
    let body='';
    for await(const chunk of req){
     body+=chunk;
     if(body.length>4096)return send({error:'Request too large.'},413);
    }
    let input;try{input=validateConversion(JSON.parse(body))}catch(e){return send({error:e.message},400)}
    if(active)return send({error:'Another media file is being converted. Try again shortly.'},429);
    const id=randomUUID();
    const j={id,dir:join(root,id),createdAt:now(),state:'processing',sourceMetadata:input.sourceMetadata||null};
    jobs.set(id,j);active=true;
    void execute(j,input);
    return send(publicJob(j),202);
   }
   if(req.method!=='GET')return send({error:'Method not allowed.'},405);
   const match=path.match(/^\/api\/converter\/([0-9a-f-]{36})(\/file)?$/);
   if(!match)return send({error:'Not found.'},404);
   const j=jobs.get(match[1]);
   if(!j)return send({error:'File not found or expired.'},404);
   if(match[2]){
    if(j.state!=='ready'||now()>=j.expiresAt)return send({error:'File is not ready or has expired.'},410);
    res.writeHead(200,{'content-type':j.name.endsWith('.mp4')?'video/mp4':'audio/mpeg','content-disposition':'attachment; filename="'+j.name+'"','content-length':j.bytes,'cache-control':'private, no-store','x-content-type-options':'nosniff'});
    const stream=createReadStream(j.file);
    stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
    return;
   }
   if(j.state==='ready'&&now()>=j.expiresAt){j.state='expired';await rm(j.dir,{recursive:true,force:true})}
   return send(publicJob(j));
  }
 }
}
