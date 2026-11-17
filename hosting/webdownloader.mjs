/**
 * Optional, no-key public API fallback for public YouTube videos.
 * WebDownloader documents this endpoint for integration into other apps:
 * https://save.brianrianrehan.com/docs
 * Never send login cookies, credentials, or raw arbitrary destination URLs.
 */
import {createWriteStream} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {join} from 'node:path';
import {rm} from 'node:fs/promises';
import {createTransferReporter} from './progress-metrics.mjs';

const API='https://save.brianrianrehan.com/api/v1/download?wait=true&download=true';
const MAX_BYTES=200*1024*1024;

export class FreeProviderError extends Error {
 constructor(message,code='FREE_PROVIDER_UNAVAILABLE',retryAfterMs=60000){
  super(message);this.code=code;this.retryAfterMs=retryAfterMs;
 }
}

export function supportsFreeFallback(input){
 return Boolean(input&&(
  (input.mode==='Video + audio'&&input.container==='MP4')||
  (input.mode==='Audio only'&&input.container==='MP3')
 ));
}

export function fallbackPayload(input){
 if(!supportsFreeFallback(input))throw new FreeProviderError('This free fallback only supports MP4 with sound or MP3 audio.','FREE_PROVIDER_FORMAT_UNSUPPORTED',0);
 const quality=input.mode==='Audio only'?'best':input.quality==='Best available'?'best':String(input.quality||'720p').replace(/^2160p.*$/,'2160p');
 return {url:input.url,format:input.mode==='Audio only'?'audio':'video',quality,outputFormat:input.mode==='Audio only'?'mp3':'mp4'};
}

export async function downloadViaFreeProvider(input,dir,{fetchImpl=fetch,onProgress=()=>{}}={}){
 const payload=fallbackPayload(input);
 const extension=payload.outputFormat;
 const destination=join(dir,'media.'+extension);
 let response;
 const signal=AbortSignal.timeout(105000);
 try{
  response=await fetchImpl(API,{
   method:'POST',headers:{'content-type':'application/json',accept:'video/*, audio/*, application/octet-stream'},
   body:JSON.stringify(payload),redirect:'error',signal
  });
 }catch{
  throw new FreeProviderError('The backup service could not be reached. Try again later.','FREE_PROVIDER_UNAVAILABLE',0);
 }
 if(response.status===429){
  const header=Number(response.headers.get('retry-after'));
  const retryAfterMs=Number.isFinite(header)&&header>0?Math.min(header*1000,21600000):300000;
  throw new FreeProviderError('The free backup downloader reached its rate limit.','FREE_PROVIDER_RATE_LIMITED',retryAfterMs);
 }
 if(response.status===425)throw new FreeProviderError('The backup is still preparing this video. Try again shortly.','FREE_PROVIDER_BUSY',0);
 if(!response.ok||!response.body){
  // A single unavailable video is NOT evidence that the entire downloader is offline.
  // Reserve global cooldowns for explicit provider-wide rate limits (HTTP 429).
  if([400,404,410,422,451].includes(response.status)){
   throw new FreeProviderError('This video could not be retrieved by the backup. Other public videos may still work.','FREE_PROVIDER_MEDIA_UNAVAILABLE',0);
  }
  throw new FreeProviderError('The backup could not retrieve this video right now. Try another public link or retry later.','FREE_PROVIDER_UNAVAILABLE',0);
 }
 const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase().trim();
 const allowed=extension==='mp4'?['video/mp4','application/octet-stream']:['audio/mpeg','audio/mp3','application/octet-stream'];
 if(!allowed.includes(type))throw new FreeProviderError('The backup did not return a playable media file for this request.','FREE_PROVIDER_INVALID_MEDIA',0);
 const lengthHeader=response.headers.get('content-length');
 const length=Number(lengthHeader);
 if(lengthHeader!==null&&(!Number.isSafeInteger(length)||length<=0||length>MAX_BYTES))
  throw new FreeProviderError('This media file exceeds the free 200 MB limit.','FREE_PROVIDER_TOO_LARGE',0);
 let bytes=0;
 const reportTransfer=createTransferReporter({onProgress,totalBytes:lengthHeader!==null?length:null,stage:'Receiving media'});
 const limiter=new Transform({transform(chunk,encoding,callback){
  bytes+=chunk.length;
  reportTransfer(chunk.length);
  if(bytes>MAX_BYTES)callback(new FreeProviderError('This media file exceeds the free 200 MB limit.','FREE_PROVIDER_TOO_LARGE',0));
  else callback(null,chunk);
 }});
 try{
  await pipeline(Readable.fromWeb(response.body),limiter,createWriteStream(destination,{mode:0o600}),{signal});
  if(bytes<128)throw new FreeProviderError('The free backup returned an empty media file.','FREE_PROVIDER_INVALID_MEDIA',120000);
 }catch(error){
  await rm(destination,{force:true});
  if(error instanceof FreeProviderError)throw error;
  throw new FreeProviderError('The backup transfer was interrupted. Try again later.','FREE_PROVIDER_UNAVAILABLE',0);
 }
 return {path:destination,name:'media.'+extension,bytes,provider:'WebDownloader (free public API)'};
}
