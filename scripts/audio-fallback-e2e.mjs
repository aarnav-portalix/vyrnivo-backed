import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createDownloads} from '../hosting/downloads.mjs';

const temp=await mkdtemp(join(tmpdir(),'vyrnivo-audio-e2e-'));
const inputPath=join(temp,'source.mp3');
const generate=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',
 '-f','lavfi','-i','sine=frequency=523.25:sample_rate=44100:duration=1.5',
 '-c:a','libmp3lame','-b:a','160k',inputPath],{timeout:25000,encoding:'utf8'});
assert.equal(generate.status,0,'FFmpeg fixture generation failed: '+generate.stderr);
const {readFile}=await import('node:fs/promises');
const bytes=await readFile(inputPath);
let externalCalls=0,blockedCalls=0;
const manager=await createDownloads({
 enabled:true,freeFallbackEnabled:true,
 spawnProcess:()=>{
  blockedCalls++;
  const p=new EventEmitter();p.stdout=new EventEmitter();p.stderr=new EventEmitter();
  p.kill=()=>queueMicrotask(()=>p.emit('close',1));
  queueMicrotask(()=>p.stderr.emit('data',Buffer.from('HTTP Error 429: Too Many Requests')));
  return p;
 },
 fetchImpl:async(url,init)=>{
  externalCalls++;
  assert.equal(JSON.parse(init.body).outputFormat,'mp3');
  return new Response(bytes,{status:200,headers:{
   'content-type':'audio/mpeg','content-length':String(bytes.length)
  }});
 }
});
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 manager.handle(req,res,pathname).catch(e=>{
  if(!res.headersSent){res.writeHead(500);res.end(JSON.stringify({error:e.message}))}
 });
});
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 for(const [format,extension,codec] of [
  ['MP3','mp3','mp3'],['M4A','m4a','aac'],['WAV','wav','pcm_s16le']
 ]){
  const response=await fetch(base+'/api/downloads',{method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    mode:'Audio only',quality:'Best available',container:format})});
  assert.equal(response.status,202,'Audio job submission must succeed');
  let job=await response.json();
  for(let i=0;i<150&&job.state==='processing';i++){
   await new Promise(resolve=>setTimeout(resolve,100));
   const result=await fetch(base+'/api/downloads/'+job.id);
   assert.equal(result.status,200);
   job=await result.json();
  }
  assert.equal(job.state,'ready',format+' conversion failed: '+job.error);
  assert.equal(job.name,'media.'+extension);
  assert.ok(job.bytes>128);
  const result=await fetch(base+job.downloadUrl);
  assert.equal(result.status,200);
  const output=Buffer.from(await result.arrayBuffer());
  assert.equal(output.length,job.bytes);
  const file=join(temp,'downloaded.'+extension);
  await writeFile(file,output);
  const probe=spawnSync('ffprobe',['-v','error','-select_streams','a:0',
   '-show_entries','stream=codec_name','-of','default=noprint_wrappers=1:nokey=1',file],
   {encoding:'utf8',timeout:15000});
  assert.equal(probe.status,0,'Invalid '+format+' file: '+probe.stderr);
  assert.equal(probe.stdout.trim(),codec,'Wrong actual audio codec for '+format);
  console.log('REAL_AUDIO_FALLBACK_OK',JSON.stringify({format,bytes:job.bytes,codec,externalCalls,blockedCalls}));
 }
 assert.equal(externalCalls,3,'Each format should use exactly one upstream MP3 transfer');
 assert.equal(blockedCalls,1,'Known YouTube rate limit should skip blocked local extractor on subsequent formats');
}finally{
 manager.close();await new Promise(resolve=>server.close(resolve));
 await rm(temp,{recursive:true,force:true});
}
