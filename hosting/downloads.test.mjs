import test from 'node:test';import assert from'node:assert/strict';import{validate,argumentsFor,createDownloads}from'./downloads.mjs';import{EventEmitter}from'node:events';import{writeFile}from'node:fs/promises';import{PassThrough,Readable}from'node:stream';
const input={url:'https://www.youtube.com/watch?v=BaW_jenozKc',mode:'Video + audio',quality:'1080p',container:'MP4'};
test('rejects arbitrary hosts, playlists, credentials and shell inputs',()=>{for(const url of ['https://127.0.0.1/private','https://youtube.com.evil.test/watch?v=BaW_jenozKc','https://youtube.com/playlist?list=x','https://u:p@youtube.com/watch?v=BaW_jenozKc','; rm -rf /'])assert.throws(()=>validate({...input,url}));assert.equal(validate(input).height,1080);const args=argumentsFor(input,'/tmp/job');assert(args[args.indexOf('-f')+1].includes('bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]'));assert.equal(args.at(-2),'--')});
test('container choices prefer compatible streams and preserve audio-only behavior',()=>{
 const mp4=argumentsFor(input,'/tmp/job');assert(mp4[mp4.indexOf('-f')+1].includes('bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]'));
 const webm=argumentsFor({...input,container:'WebM'},'/tmp/job');assert(webm[webm.indexOf('-f')+1].includes('bestvideo[ext=webm][height<=1080]+bestaudio[ext=webm]'));
 const video=argumentsFor({...input,mode:'Video only'},'/tmp/job');assert(video[video.indexOf('-f')+1].includes('bestvideo[ext=mp4][height<=1080]/bestvideo[height<=1080]'));
 const audio=argumentsFor({...input,mode:'Audio only',container:'MP3'},'/tmp/job');assert.equal(audio[audio.indexOf('-f')+1],'bestaudio/best');assert(audio.includes('--audio-format'));assert(audio.includes('mp3'));
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
