import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWorkerHandler,authorizedWorker} from './media-worker.mjs';
import {downloadViaOwnedEngine,validateOwnedEngineConfig} from './owned-downloader.mjs';

const token='VYRNiVO-private-engine-test-token-012345';
const origin='https://private-worker.example.org';
const config=validateOwnedEngineConfig(origin,token);
const input={url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',
 mode:'Video + audio',quality:'720p',container:'MP4'};
const id='123e4567-e89b-42d3-a456-426614174010';
const media=Buffer.alloc(900,0x42);

test('private worker authenticates every extraction route, no public-download bypass',async()=>{
 assert.equal(authorizedWorker({authorization:'Bearer '+token},token),true);
 assert.equal(authorizedWorker({authorization:'Bearer wrong'},token),false);
 const called=[];
 const handler=createWorkerHandler({secret:token,engine:{handle(req,res,path){called.push(path);res.writeHead(202);res.end('{"state":"processing"}')}}});
 async function call(path,headers={}){
  let status,body;
  const req={url:path,method:path==='/api/downloads'?'POST':'GET',headers};
  const res={setHeader(){},writeHead(code){status=code},end(raw){body=JSON.parse(raw)},destroy(){}};
  await handler(req,res);
  return {status,body};
 }
 assert.equal((await call('/health')).status,200);
 assert.equal((await call('/api/downloads')).status,401);
 assert.equal((await call('/api/downloads/status')).status,401);
 assert.equal((await call('/api/downloads/'+id+'/file')).status,401);
 assert.equal((await call('/api/downloads',{authorization:'Bearer '+token})).status,202);
 assert.equal(called[0],'/api/downloads');
 assert.equal((await call('/api/private/sneaky',{authorization:'Bearer '+token})).status,404);
});

test('owned engine URLs and credentials are validated before any outbound fetch',()=>{
 assert.deepEqual(config,{origin,token});
 for(const url of ['http://private-worker.example.org','https://127.0.0.1','https://localhost',
  'https://private-worker.example.org:8080','https://user:pass@private-worker.example.org',
  'https://private-worker.example.org/anything','https://metadata.google.internal']){
  assert.equal(validateOwnedEngineConfig(url,token),null,url);
 }
 assert.equal(validateOwnedEngineConfig(origin,'short'),null);
});

test('owned worker prepares a media file and copies exact bytes to local temp storage',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vyrnivo-owned-engine-'));
 const calls=[],progress=[];
 try{
  const result=await downloadViaOwnedEngine(input,dir,{
   config,onProgress:v=>progress.push(v),
   fetchImpl:async(url,init)=>{
    const u=new URL(url);calls.push(u.pathname);
    assert.equal(init.headers.Authorization,'Bearer '+token);
    if(u.pathname==='/api/downloads'&&init.method==='POST'){
     assert.deepEqual(JSON.parse(init.body),input);
     return Response.json({id,state:'processing'});
    }
    if(u.pathname==='/api/downloads/'+id) return Response.json({id,state:'ready',name:'media.mp4',bytes:media.length,downloadUrl:'/api/downloads/'+id+'/file'});
    if(u.pathname==='/api/downloads/'+id+'/file')return new Response(media,{status:200,headers:{'content-length':String(media.length),'content-type':'application/octet-stream'}});
    throw Error('unexpected remote request');
   },
   sleep:async()=>{}
  });
  assert.deepEqual(await readFile(result.path),media);
  assert.equal(result.provider,'Vyrnivo Private Engine');
  assert.equal(result.name,'media.mp4');
  assert.deepEqual(calls,['/api/downloads','/api/downloads/'+id,'/api/downloads/'+id+'/file']);
  assert.ok(progress.some(p=>p.stage==='Transferring prepared media'));
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('the adapter rejects bad remote IDs and never downloads from an arbitrary file URL',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vyrnivo-owned-engine-'));
 try{
  await assert.rejects(downloadViaOwnedEngine(input,dir,{
   config,fetchImpl:async()=>Response.json({id:'../etc/passwd',state:'ready'})
  }),/job ID was invalid/);
  await assert.rejects(downloadViaOwnedEngine(input,dir,{
   config,fetchImpl:async(url)=>{
    if(new URL(url).pathname==='/api/downloads')return Response.json({id,state:'ready',name:'media.mp4',bytes:media.length,downloadUrl:'https://attacker.invalid/file'});
    throw Error('File transfer must not begin');
   }
  }),/invalid file route/);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('remote source rate limits are distinguished from API outages',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vyrnivo-owned-engine-'));
 try{
  await assert.rejects(downloadViaOwnedEngine(input,dir,{config,fetchImpl:async()=>Response.json({code:'SOURCE_RATE_LIMITED',error:'blocked'},{status:429})}),
   err=>err.code==='OWN_ENGINE_RATE_LIMITED'&&err.retryAfterMs>=1800000);
 }finally{await rm(dir,{recursive:true,force:true})}
});
