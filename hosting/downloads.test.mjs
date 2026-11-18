import test from 'node:test';import assert from'node:assert/strict';import{validate,argumentsFor,createDownloads}from'./downloads.mjs';import{EventEmitter}from'node:events';import{writeFile}from'node:fs/promises';import{PassThrough,Readable}from'node:stream';
const input={url:'https://www.youtube.com/watch?v=BaW_jenozKc',mode:'Video + audio',quality:'1080p',container:'MP4'};
test('rejects arbitrary hosts, playlists, credentials and shell inputs',()=>{for(const url of ['https://127.0.0.1/private','https://youtube.com.evil.test/watch?v=BaW_jenozKc','https://youtube.com/playlist?list=x','https://u:p@youtube.com/watch?v=BaW_jenozKc','; rm -rf /'])assert.throws(()=>validate({...input,url}));assert.equal(validate(input).height,1080);const args=argumentsFor(input,'/tmp/job');assert(args[args.indexOf('-f')+1].includes('bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]'));assert.equal(args.at(-2),'--')});
test('container choices prefer compatible streams and preserve audio-only behavior',()=>{
 const mp4=argumentsFor(input,'/tmp/job');assert(mp4[mp4.indexOf('-f')+1].includes('bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]'));
 const webm=argumentsFor({...input,container:'WebM'},'/tmp/job');assert(webm[webm.indexOf('-f')+1].includes('bestvideo[ext=webm][height<=1080]+bestaudio[ext=webm]'));
 const video=argumentsFor({...input,mode:'Video only'},'/tmp/job');assert(video[video.indexOf('-f')+1].includes('bestvideo[ext=mp4][height<=1080]/bestvideo[height<=1080]'));
 const audio=argumentsFor({...input,mode:'Audio only',container:'MP3'},'/tmp/job');assert.equal(audio[audio.indexOf('-f')+1],'bestaudio/best');assert(audio.includes('--audio-format'));assert(audio.includes('mp3'));
});
test('unknown Instagram Reel duration is allowed but known long videos remain limited',()=>{
 const args=argumentsFor({...input,url:'https://www.instagram.com/reel/ABCdef1234/'},'/tmp/reel');
 assert.equal(args[args.indexOf('--match-filter')+1],'duration <=? 1800');
});
test('Instagram MP4 selection permits unreported resolution and a generic best fallback',()=>{
 const url='https://www.instagram.com/reel/DdRlhjluRFw/';
 const args=argumentsFor({...input,url,quality:'720p'},'/tmp/reels');
 const format=args[args.indexOf('-f')+1];
 assert.equal(format,'best[height<=?720]/bestvideo*[height<=?720]+bestaudio/best');
 assert.equal(args.includes('--remux-video'),true);
});
test('720p selects separate HD MP4 video and M4A audio before low-res progressive fallback',()=>{
 const args=argumentsFor({...input,quality:'720p'},'/tmp/hd');
 const f=args[args.indexOf('-f')+1];
 assert.equal(f.startsWith('bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/'),true);
 assert.equal(f.includes('/bestvideo[height<=720]+bestaudio'),true);
 assert.equal(args[args.indexOf('--extractor-retries')+1],'2');
 assert.equal(args[args.indexOf('--retries')+1],'2');
 assert.equal(args[args.indexOf('--fragment-retries')+1],'2');
 assert.equal(args.includes('--js-runtimes'),true);
 for(const url of ['https://music.youtube.com/watch?v=BaW_jenozKc','https://www.youtube-nocookie.com/embed/BaW_jenozKc'])assert.doesNotThrow(()=>validate({...input,url}));
});
test('completed job exposes and streams exact prepared bytes',async()=>{const bytes=Buffer.from('fixture-media-bytes');const manager=await createDownloads({enabled:true,spawnProcess:(cmd,args)=>{const p=new EventEmitter();p.stderr=new EventEmitter();p.kill=()=>{};queueMicrotask(async()=>{await writeFile(args[args.indexOf('-o')+1].replace('%(ext)s','mp4'),bytes);p.emit('close',0)});return p}});try{let result;const req=Readable.from([Buffer.from(JSON.stringify(input))]);req.method='POST';const res={writeHead(s){this.status=s},end(v){result=JSON.parse(v)}};await manager.handle(req,res,'/api/downloads');assert.equal(res.status,202);const id=result.id;for(let i=0;i<50;i++){await new Promise(r=>setTimeout(r,10));await manager.handle({method:'GET'},res,'/api/downloads/'+id);if(result.state!=='processing')break}assert.equal(result.state,'ready');assert(result.expiresAt>Date.now()+590000);const stream=new PassThrough();stream.writeHead=(status,headers)=>{assert.equal(status,200);assert.equal(headers['content-length'],bytes.length)};const chunks=[];stream.on('data',c=>chunks.push(c));const complete=new Promise(r=>stream.on('end',r));await manager.handle({method:'GET'},stream,'/api/downloads/'+id+'/file');await complete;assert.deepEqual(Buffer.concat(chunks),bytes)}finally{manager.close()}});
test('manual upload route is retired; only extracted media is hosted',async()=>{
 const m=await createDownloads({enabled:true});
 try {
  let body;
  const res={writeHead(s){this.status=s},end(s){body=JSON.parse(s)}};
  const req=Readable.from([Buffer.from('upload')]);
  req.method='POST';req.headers={'content-type':'audio/wav','x-file-name':'upload.wav'};
  await m.handle(req,res,'/api/downloads/upload');
  assert.equal(res.status,410);
  assert.match(body.error,/manual uploads are disabled/i);
 }finally{m.close()}
});
test('an automatically extracted file expires after ten minutes',async()=>{
 let time=1000, result;
 const m=await createDownloads({enabled:true,now:()=>time,spawnProcess:(cmd,args)=>{
  const p=new EventEmitter();p.stderr=new EventEmitter();p.kill=()=>{};
  queueMicrotask(async()=>{await writeFile(args[args.indexOf('-o')+1].replace('%(ext)s','mp4'),Buffer.from('source-media'));p.emit('close',0)});
  return p;
 }});
 try{
  const res={writeHead(s){this.status=s},end(x){result=JSON.parse(x)}};
  const req=Readable.from([Buffer.from(JSON.stringify(input))]);req.method='POST';
  await m.handle(req,res,'/api/downloads');assert.equal(res.status,202);
  const id=result.id;
  for(let i=0;i<80;i++){await new Promise(r=>setTimeout(r,10));await m.handle({method:'GET'},res,'/api/downloads/'+id);if(result.state==='ready')break}
  assert.equal(result.state,'ready');
  assert.equal(result.expiresAt,time+600000);
  time+=600000;await m.sweep();
  await m.handle({method:'GET'},res,'/api/downloads/'+id);
  assert.equal(result.state,'expired');assert.equal(result.downloadUrl,null);
  await m.handle({method:'GET'},res,'/api/downloads/'+id+'/file');
  assert.equal(res.status,410);
 }finally{m.close()}
});

test('duplicate requests share a processing job; upstream 429 aborts early and enables cooldown',async()=>{
 let process,calls=0,kills=0,first,second;
 const m=await createDownloads({enabled:true,spawnProcess:()=>{
  calls++;
  const p=new EventEmitter();
  p.stderr=new EventEmitter();
  p.kill=()=>{kills++;queueMicrotask(()=>p.emit('close',1))};
  process=p;
  return p;
 }});
 const post=async()=>{
  const req=Readable.from([Buffer.from(JSON.stringify(input))]);req.method='POST';
  let body;
  const res={writeHead(status){this.status=status},setHeader(){},end(x){body=JSON.parse(x)}};
  await m.handle(req,res,'/api/downloads');
  return {status:res.status,body};
 };
 try {
  first=await post();
  second=await post();
  assert.equal(first.status,202);
  assert.equal(second.status,202);
  assert.equal(first.body.id,second.body.id);
  for(let n=0;!process&&n<50;n++)await new Promise(r=>setTimeout(r,10));
  assert.equal(calls,1);
  process.stderr.emit('data',Buffer.from('HTTP Error 429: Too Many Requests'));
  for(let n=0;n<50;n++){
   await new Promise(r=>setTimeout(r,10));
   const req={method:'GET'},res={writeHead(status){this.status=status},end(s){this.body=JSON.parse(s)}};
   await m.handle(req,res,'/api/downloads/'+first.body.id);
   if(res.body.state==='failed')break;
  }
  assert.equal(kills,1,'Rate-limited extractor must terminate immediately');
  const retry=await post();
  assert.equal(retry.status,429);
  assert.equal(retry.body.code,'SOURCE_RATE_LIMITED');
  assert.equal(calls,1);
 }finally{m.close()}
});

test('blocked Render YouTube extractor falls back to actual free API media bytes; next request skips known blocked source',async()=>{
 let localCalls=0,remoteCalls=0,result;
 const bytes=Buffer.alloc(512,0x29);
 const manager=await createDownloads({
  enabled:true,freeFallbackEnabled:true,
  fetchImpl:async()=>{
   remoteCalls++;
   return new Response(bytes,{status:200,headers:{'content-type':'video/mp4','content-length':String(bytes.length)}});
  },
  spawnProcess:()=>{
   localCalls++;
   const proc=new EventEmitter();proc.stdout=new EventEmitter();proc.stderr=new EventEmitter();
   proc.kill=()=>queueMicrotask(()=>proc.emit('close',1));
   queueMicrotask(()=>proc.stderr.emit('data',Buffer.from('HTTP Error 429: Too Many Requests')));
   return proc;
  }
 });
 const request=async(url)=>{
  const req=Readable.from([Buffer.from(JSON.stringify({...input,url,quality:'720p'}))]);req.method='POST';
  const res={writeHead(code){this.status=code},setHeader(){},end(text){result=JSON.parse(text)}};
  await manager.handle(req,res,'/api/downloads');
  assert.equal(res.status,202);
  const id=result.id;
  for(let tries=0;tries<60;tries++){
   await new Promise(resolve=>setTimeout(resolve,10));
   await manager.handle({method:'GET'},res,'/api/downloads/'+id);
   if(result.state!=='processing')break;
  }
  assert.equal(result.state,'ready',result.error);
  assert.equal(result.bytes,bytes.length);
  assert.equal(result.provider,'WebDownloader (free public API)');
  assert.equal(result.failureCode,null,'A successful backup must clear local failure');
 };
 try{
  await request(input.url);
  assert.equal(localCalls,1);
  assert.equal(remoteCalls,1);
  await request('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  assert.equal(localCalls,1,'known local 429 cooldown should avoid another blocked local attempt');
  assert.equal(remoteCalls,2);
  const res={writeHead(){},end(text){result=JSON.parse(text)}};
  await manager.handle({method:'GET'},res,'/api/downloads/status');
  assert.equal(result.freeFallbackEnabled,true);
  assert.equal(result.sourceAvailability.youtube,'backup-available');
 }finally{manager.close()}
});

test('download creation is blocked until a verified human token is supplied',async()=>{
 let started=0;
 const manager=await createDownloads({
  enabled:true,
  verifyToken:async token=>token==='valid-human-token'?{ok:true}:{ok:false,status:403,code:'BOT_CHECK_FAILED',error:'Please verify you are human.'},
  spawnProcess:()=>{
   started++;
   const proc=new EventEmitter();proc.stdout=new EventEmitter();proc.stderr=new EventEmitter();
   queueMicrotask(()=>proc.emit('close',1));
   return proc;
  }
 });
 const submit=async token=>{
  const body={...input,url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',...(token?{turnstileToken:token}:{})};
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method='POST';
  let code=0,json;
  const res={writeHead(status){code=status},end(payload){json=JSON.parse(payload)}};
  await manager.handle(req,res,'/api/downloads');
  return {code,json};
 };
 try{
  const denied=await submit();
  assert.equal(denied.code,403);
  assert.equal(denied.json.code,'BOT_CHECK_FAILED');
  assert.equal(started,0,'No process must start before human verification succeeds');
  const accepted=await submit('valid-human-token');
  assert.equal(accepted.code,202);
  assert.equal(accepted.json.state,'processing');
 }finally{manager.close()}
});

test('a configured Vyrnivo-owned worker is used before local or public fallback',async()=>{
 const id='123e4567-e89b-42d3-a456-426614174010';
 const token='very-long-private-worker-test-secret-012345';
 const content=Buffer.alloc(512,0x5a);
 let localCalls=0,remoteCalls=0,response;
 const manager=await createDownloads({
  enabled:true,freeFallbackEnabled:true,
  ownedEngineConfig:{origin:'https://private-worker.example.org',token},
  spawnProcess:()=>{localCalls++;throw Error('The private worker succeeded; local extractor must not run');},
  fetchImpl:async(url,init)=>{
   remoteCalls++;assert.equal(init.headers.Authorization,'Bearer '+token);
   const path=new URL(url).pathname;
   if(path==='/api/downloads')return Response.json({id,state:'processing'});
   if(path==='/api/downloads/'+id)return Response.json({id,state:'ready',name:'media.mp4',bytes:content.length,downloadUrl:'/api/downloads/'+id+'/file'});
   if(path==='/api/downloads/'+id+'/file')return new Response(content,{status:200,headers:{'content-length':String(content.length),'content-type':'application/octet-stream'}});
   throw Error('Unexpected request to '+path);
  }
 });
 try{
  const req=Readable.from([Buffer.from(JSON.stringify(input))]);req.method='POST';
  const res={writeHead(status){this.status=status},end(body){response=JSON.parse(body)}};
  await manager.handle(req,res,'/api/downloads');
  assert.equal(res.status,202);
  const jobId=response.id;
  for(let i=0;i<90;i++){
   await new Promise(resolve=>setTimeout(resolve,30));
   await manager.handle({method:'GET'},res,'/api/downloads/'+jobId);
   if(response.state!=='processing')break;
  }
  assert.equal(response.state,'ready',response.error);
  assert.equal(response.bytes,content.length);
  assert.equal(response.provider,'Vyrnivo Private Engine');
  assert.equal(localCalls,0);
  assert.equal(remoteCalls,3);
 }finally{manager.close()}
});

test('source-blocked audio downloads use one MP3 backup transfer then deliver requested M4A/WAV files',async()=>{
 for(const format of ['M4A','WAV']){
  let fetches=0,converted=0,last;
  const manager=await createDownloads({
   enabled:true,freeFallbackEnabled:true,
   spawnProcess:()=>{
    const proc=new EventEmitter();proc.stdout=new EventEmitter();proc.stderr=new EventEmitter();
    proc.kill=()=>queueMicrotask(()=>proc.emit('close',1));
    queueMicrotask(()=>proc.stderr.emit('data',Buffer.from('HTTP Error 429: Too Many Requests')));
    return proc;
   },
   fetchImpl:async(url,init)=>{
    fetches++;
    assert.equal(init.method,'POST');
    assert.equal(JSON.parse(init.body).outputFormat,'mp3');
    return new Response(Buffer.alloc(512,0x7b),{status:200,headers:{
     'content-type':'audio/mpeg','content-length':'512'
    }});
   },
   convertAudio:async(downloaded,dir,target)=>{
    converted++;
    assert.equal(downloaded.name,'media.mp3');
    assert.equal(target,format);
    const destination=dir+'/media.'+target.toLowerCase();
    const bytes=Buffer.alloc(333,0x53);
    await writeFile(destination,bytes);
    return {...downloaded,path:destination,name:'media.'+target.toLowerCase(),bytes:bytes.length,convertedLocally:true};
   }
  });
  try{
   const body={...input,mode:'Audio only',quality:'Best available',container:format};
   const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method='POST';
   const res={writeHead(code){this.status=code},end(raw){last=JSON.parse(raw)}};
   await manager.handle(req,res,'/api/downloads');
   assert.equal(res.status,202);
   const id=last.id;
   for(let i=0;i<90;i++){
    await new Promise(resolve=>setTimeout(resolve,10));
    await manager.handle({method:'GET'},res,'/api/downloads/'+id);
    if(last.state!=='processing')break;
   }
   assert.equal(last.state,'ready',last.error);
   assert.equal(last.name,'media.'+format.toLowerCase());
   assert.equal(last.bytes,333);
   assert.equal(last.downloadUrl,'/api/downloads/'+id+'/file');
   assert.equal(converted,1);
   assert.equal(fetches,1,'One external MP3 transfer should be enough');
  }finally{manager.close()}
 }
});

test('quality options are passed to the extractor as resolution caps',()=>{
 for(const quality of ['720p','1080p','1440p','2160p · 4K']){
  const height=quality==='2160p · 4K'?2160:Number.parseInt(quality,10);
  const args=argumentsFor({...input,quality},'/tmp/quality-test');
  assert.ok(args[args.indexOf('-f')+1].includes('height<='+height));
 }
});
test('audio bitrate and container choices are validated',()=>{
 for(const rate of ['120 kbps','320 kbps']){
  const args=argumentsFor({...input,mode:'Audio only',container:'MP3',audioBitrate:rate},'/tmp/audio-test');
  assert.equal(args[args.indexOf('--audio-quality')+1],rate.split(' ')[0]+'K');
 }
 assert.throws(()=>validate({...input,mode:'Audio only',container:'MP4',audioBitrate:'320 kbps'}));
});
