/**
 * Vyrnivo-owned extraction engine adapter.
 * Only calls an explicitly configured HTTPS service under our control.
 * Credentials remain server-to-server; no public provider URL is exposed.
 */
import {isIP} from 'node:net';
import {createWriteStream} from 'node:fs';
import {rm} from 'node:fs/promises';
import {join} from 'node:path';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const MAX_BYTES=200*1024*1024;
const JOB_ID=/^[0-9a-f-]{36}$/i;
const MEDIA_NAME=/^media\.(mp4|webm|mkv|mp3|m4a|wav|ogg|opus|mov)$/i;

export class OwnedEngineError extends Error{
 constructor(message,code='OWN_ENGINE_UNAVAILABLE',retryAfterMs=120000){
  super(message);this.code=code;this.retryAfterMs=retryAfterMs;
 }
}

export function validateOwnedEngineConfig(raw,token){
 if(!raw||!token)return null;
 try{
  const u=new URL(raw);
  const h=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.port||u.username||u.password||u.search||u.hash||
     u.pathname!=='/'||isIP(h)||!h.includes('.')||
     h==='localhost'||h.endsWith('.local')||h.endsWith('.localhost')||
     h==='metadata.google.internal')return null;
  if(String(token).length<24)return null;
  return {origin:u.origin,token:String(token)};
 }catch{return null}
}

const failure=(data,status)=>{
 const code=String(data?.failureCode||data?.code||'');
 if(code==='SOURCE_RATE_LIMITED'||status===429){
  return new OwnedEngineError('The private engine is temporarily rate-limited.','OWN_ENGINE_RATE_LIMITED',1800000);
 }
 if(code==='SOURCE_ACCESS_DENIED'||code==='SOURCE_VERIFICATION_REQUIRED'){
  return new OwnedEngineError('The private engine cannot access that source.','OWN_ENGINE_SOURCE_DENIED',180000);
 }
 if(status===401||status===403){
  return new OwnedEngineError('The private engine could not authenticate.','OWN_ENGINE_AUTH_FAILED',1800000);
 }
 return new OwnedEngineError('The private engine could not complete this download.','OWN_ENGINE_UNAVAILABLE',120000);
};

/**
 * The configured remote worker extracts an approved public video then streams
 * prepared media to Vyrnivo's existing short-lived local download storage.
 */
export async function downloadViaOwnedEngine(input,dir,{
 config,fetchImpl=fetch,onProgress=()=>{},now=Date.now,
 sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
}={}){
 if(!config?.origin||!config?.token)throw new OwnedEngineError('Private media engine is not configured.','OWN_ENGINE_NOT_CONFIGURED',0);
 const origin=config.origin;
 const headers={Authorization:'Bearer '+config.token};
 const request=async(path,init={})=>{
  try{
   return await fetchImpl(origin+path,{
    ...init,redirect:'error',
    headers:{...headers,...init.headers},
    signal:AbortSignal.timeout(init.longTransfer?120000:25000)
   });
  }catch{
   throw new OwnedEngineError('The private engine cannot be reached.','OWN_ENGINE_UNAVAILABLE',120000);
  }
 };
 const readJob=async(response)=>{
  let body;
  try{body=await response.json()}catch{throw new OwnedEngineError('Private engine response was invalid.')}
  if(!response.ok)throw failure(body,response.status);
  return body;
 };
 onProgress({stage:'Connecting to private engine',progressPercent:5});
 const started=await readJob(await request('/api/downloads',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
   url:input.url,mode:input.mode,quality:input.quality,container:input.container
  })
 }));
 if(typeof started.id!=='string'||!JOB_ID.test(started.id)){
  throw new OwnedEngineError('Private engine job ID was invalid.');
 }
 const id=started.id;
 let job=started;
 const deadline=now()+188000;
 while(job.state==='processing'&&now()<deadline){
  await sleep(1600);
  job=await readJob(await request('/api/downloads/'+id));
  if(job.id!==id)throw new OwnedEngineError('Private engine returned the wrong job.');
  onProgress({stage:job.stage||'Preparing media on private engine',
   progressPercent:Number.isFinite(job.progressPercent)?Math.max(5,Math.min(97,job.progressPercent)):null});
 }
 if(job.state!=='ready'){
  if(job.state==='failed')throw failure(job,502);
  throw new OwnedEngineError('The private engine did not finish in time.','OWN_ENGINE_TIMEOUT',120000);
 }
 const name=String(job.name||'');
 if(!MEDIA_NAME.test(name)||!Number.isSafeInteger(job.bytes)||job.bytes<128||job.bytes>MAX_BYTES){
  throw new OwnedEngineError('The private engine returned invalid media metadata.');
 }
 const expected='/api/downloads/'+id+'/file';
 if(job.downloadUrl!==expected)throw new OwnedEngineError('Private engine returned an invalid file route.');
 const response=await request(expected,{method:'GET',longTransfer:true});
 if(!response.ok||!response.body)throw failure(null,response.status);
 const announced=response.headers.get('content-length');
 if(announced!==null&&(Number(announced)!==job.bytes||Number(announced)>MAX_BYTES)){
  throw new OwnedEngineError('Private engine media size did not match its job.');
 }
 const destination=join(dir,name);
 let bytes=0,last=0;
 try{
  await pipeline(
   Readable.fromWeb(response.body),
   new Transform({transform(chunk,encoding,done){
    bytes+=chunk.length;
    if(bytes>MAX_BYTES)return done(new OwnedEngineError('Private engine output is too large.','OWN_ENGINE_TOO_LARGE',0));
    if(now()-last>250){last=now();onProgress({stage:'Transferring prepared media',
     progressPercent:Math.max(5,Math.min(99,Math.round(5+94*bytes/job.bytes)))})}
    done(null,chunk);
   }}),
   createWriteStream(destination,{mode:0o600})
  );
  if(bytes!==job.bytes||bytes<128)throw new OwnedEngineError('Private engine sent an incomplete file.');
 }catch(e){
  await rm(destination,{force:true});
  if(e instanceof OwnedEngineError)throw e;
  throw new OwnedEngineError('The private engine transfer was interrupted.');
 }
 return {path:destination,name,bytes,provider:'Vyrnivo Private Engine'};
}
