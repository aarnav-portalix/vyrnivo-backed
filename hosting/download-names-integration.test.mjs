import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable,PassThrough} from 'node:stream';
import {writeFile} from 'node:fs/promises';
import {createDownloads} from './downloads.mjs';

const source='https://www.youtube.com/watch?v=jNQXAC9IVRw';
const sourceInput={url:source,mode:'Video + audio',quality:'1080p',container:'MP4'};

function testResponse(){
 let body,status,headers;
 const res={writeHead(s,h){status=s;headers=h},end(raw){body=JSON.parse(raw)}};
 return {res,get body(){return body},get status(){return status},get headers(){return headers}};
}
async function submit(manager,input){
 const req=Readable.from([Buffer.from(JSON.stringify(input))]);req.method='POST';
 const submitted=testResponse();
 await manager.handle(req,submitted.res,'/api/downloads');
 assert.equal(submitted.status,202);
 const id=submitted.body.id;
 let state;
 for(let n=0;n<100;n++){
  await new Promise(resolve=>setTimeout(resolve,15));
  state=testResponse();
  await manager.handle({method:'GET'},state.res,'/api/downloads/'+id);
  if(state.body.state!=='processing')break;
 }
 assert.equal(state.body.state,'ready',state.body.error);
 return state.body;
}
test('local extractor title drives actual file name while file remains in safe temp storage',async()=>{
 const bytes=Buffer.from('test-video-payload-for-stream');
 const manager=await createDownloads({enabled:true,
  lookupTitle:async()=>{throw Error('title lookup must not be required when yt-dlp provides title')},
  spawnProcess:(program,args)=>{
   const proc=new EventEmitter();proc.stdout=new EventEmitter();proc.stderr=new EventEmitter();proc.kill=()=>{};
   assert.ok(args.includes('--print'));
   assert.ok(args.includes('after_move:VYRNIVO_MEDIA_TITLE:%(title)s'));
   queueMicrotask(async()=>{
    proc.stdout.emit('data',Buffer.from('download: 99.9%\nVYRNIVO_MEDIA_TITLE:Epic Roblox Montage 2026!\n'));
    await writeFile(args[args.indexOf('-o')+1].replace('%(ext)s','mp4'),bytes);
    proc.emit('close',0);
   });
   return proc;
  }
 });
 try{
  const job=await submit(manager,sourceInput);
  assert.equal(job.name,'media.mp4','Storage and owned worker protocol must remain unchanged');
  assert.equal(job.title,'Epic Roblox Montage 2026!');
  assert.equal(job.downloadName,'vyrnivo-Epic Roblox Montage 2026! (1080p).mp4');
  const output=new PassThrough();
  let status,headers;
  output.writeHead=(code,h)=>{status=code;headers=h};
  const chunks=[];
  output.on('data',x=>chunks.push(x));
  const complete=new Promise(resolve=>output.on('end',resolve));
  await manager.handle({method:'GET'},output,job.downloadUrl);
  await complete;
  assert.equal(status,200);
  assert.ok(headers['content-disposition'].includes(job.downloadName));
  assert.ok(headers['content-disposition'].includes("filename*=UTF-8''"));
  assert.deepEqual(Buffer.concat(chunks),bytes);
 }finally{manager.close()}
});

test('indexed Discover title becomes filename for a backup MP3 even without source title header',async()=>{
 const fakeMP3=Buffer.alloc(400,0x4f);
 let invoked=0;
 const manager=await createDownloads({enabled:true,freeFallbackEnabled:true,
  lookupTitle:async()=>null,
  spawnProcess:()=>{
   const proc=new EventEmitter();proc.stdout=new EventEmitter();proc.stderr=new EventEmitter();
   proc.kill=()=>queueMicrotask(()=>proc.emit('close',1));
   queueMicrotask(()=>proc.stderr.emit('data',Buffer.from('HTTP Error 429: Too Many Requests')));
   return proc;
  },
  fetchImpl:async()=>{invoked++;return new Response(fakeMP3,{status:200,headers:{'content-type':'audio/mpeg'}})}
 });
 try{
  const job=await submit(manager,{...sourceInput,mode:'Audio only',quality:'Best available',container:'MP3',
   suggestedTitle:'My saved Short! 🎧'});
  assert.equal(invoked,1);
  assert.equal(job.name,'media.mp3');
  assert.equal(job.downloadName,'vyrnivo-My saved Short! 🎧 (Audio).mp3');
 }finally{manager.close()}
});

test('content disposition media metadata wins for backup and malformed hinted titles are rejected',async()=>{
 const manager=await createDownloads({enabled:true,freeFallbackEnabled:true,
  lookupTitle:async()=>null,
  spawnProcess:()=>{
   const proc=new EventEmitter();proc.stdout=new EventEmitter();proc.stderr=new EventEmitter();
   proc.kill=()=>queueMicrotask(()=>proc.emit('close',1));
   queueMicrotask(()=>proc.stderr.emit('data',Buffer.from('HTTP Error 429: Too Many Requests')));
   return proc;
  },
  fetchImpl:async()=>new Response(Buffer.alloc(450,0x30),{status:200,headers:{
   'content-type':'audio/mpeg','content-disposition':'attachment; filename="Provider Video Name.mp3"'
  }})
 });
 try{
  const job=await submit(manager,{...sourceInput,mode:'Audio only',quality:'Best available',container:'MP3'});
  assert.equal(job.downloadName,'vyrnivo-Provider Video Name (Audio).mp3');
  const invalid=testResponse();
  const req=Readable.from([Buffer.from(JSON.stringify({...sourceInput,suggestedTitle:5}))]);req.method='POST';
  await manager.handle(req,invalid.res,'/api/downloads');
  assert.equal(invalid.status,400);
 }finally{manager.close()}
});
