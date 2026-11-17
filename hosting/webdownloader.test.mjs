import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {supportsFreeFallback,fallbackPayload,downloadViaFreeProvider} from './webdownloader.mjs';

const input={url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',mode:'Video + audio',quality:'720p',container:'MP4'};

test('free provider supports documented MP4 and MP3 contracts only',()=>{
 assert.equal(supportsFreeFallback(input),true);
 assert.deepEqual(fallbackPayload(input),{url:input.url,format:'video',quality:'720p',outputFormat:'mp4'});
 assert.deepEqual(fallbackPayload({...input,mode:'Audio only',container:'MP3'}),{url:input.url,format:'audio',quality:'best',outputFormat:'mp3'});
 assert.equal(supportsFreeFallback({...input,mode:'Video only'}),false);
 assert.equal(supportsFreeFallback({...input,container:'WebM'}),false);
 assert.equal(fallbackPayload({...input,quality:'2160p · 4K'}).quality,'2160p');
});
test('downloads actual MP4 bytes only from fixed documented free API',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vyrnivo-free-provider-'));
 const expected=Buffer.alloc(2048,0x5b);
 let calls=0;
 try{
  const result=await downloadViaFreeProvider(input,dir,{fetchImpl:async(url,init)=>{
   calls++;assert.equal(url,'https://save.brianrianrehan.com/api/v1/download?wait=true&download=true');
   assert.equal(init.redirect,'error');assert.equal(init.method,'POST');
   assert.equal(JSON.parse(init.body).url,input.url);
   return new Response(expected,{status:200,headers:{'content-type':'video/mp4','content-length':String(expected.length)}});
  }});
  assert.equal(calls,1);
  assert.equal(result.bytes,expected.length);
  assert.equal(result.provider,'WebDownloader (free public API)');
  assert.deepEqual(await readFile(result.path),expected);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('provider 429 respects Retry-After; HTML masquerading as file is rejected',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vyrnivo-free-provider-'));
 try{
  await assert.rejects(
   downloadViaFreeProvider(input,dir,{fetchImpl:async()=>new Response('slow down',{status:429,headers:{'retry-after':'600'}})}),
   error=>error.code==='FREE_PROVIDER_RATE_LIMITED'&&error.retryAfterMs===600000
  );
  await assert.rejects(
   downloadViaFreeProvider(input,dir,{fetchImpl:async()=>new Response('<html>not media</html>',{status:200,headers:{'content-type':'text/html'}})}),
   error=>error.code==='FREE_PROVIDER_INVALID_MEDIA'
  );
  await assert.rejects(
   downloadViaFreeProvider(input,dir,{fetchImpl:async()=>new Response(Buffer.alloc(201),{status:200,headers:{'content-type':'video/mp4','content-length':String(201*1024*1024)}})}),
   error=>error.code==='FREE_PROVIDER_TOO_LARGE'
  );
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('one missing YouTube video never places all other videos in provider cooldown',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vyrnivo-specific-video-'));
 try{
  await assert.rejects(
   downloadViaFreeProvider({...input,quality:'2160p · 4K'},dir,{
    fetchImpl:async()=>new Response('video unavailable',{status:404})
   }),
   error=>error.code==='FREE_PROVIDER_MEDIA_UNAVAILABLE'&&error.retryAfterMs===0
  );
  await assert.rejects(
   downloadViaFreeProvider(input,dir,{
    fetchImpl:async()=>new Response('provider could not retrieve this source',{status:502})
   }),
   error=>error.code==='FREE_PROVIDER_UNAVAILABLE'&&error.retryAfterMs===0
  );
 }finally{await rm(dir,{recursive:true,force:true})}
});
