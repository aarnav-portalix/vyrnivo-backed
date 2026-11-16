import http from 'node:http';
import {createDownloads} from './downloads.mjs';
import {allowApi,allowFileUpload} from './access.mjs';
import {readFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';
import {FileStore,providers} from './files.mjs';
const env=process.env,hosts=providers(env);
const enabled=env.FILE_HOSTING_ENABLED==='true'&&env.FILE_STATE_DIR&&env.CLEANUP_TOKEN&&env.APP_ORIGIN&&hosts.length&&(!env.GOFILE_TOKEN||env.GOFILE_RECYCLE_BIN_DISABLED==='true');
const files=enabled?await new FileStore(env.FILE_STATE_DIR,hosts).init():null;
if(files){await files.cleanup();setInterval(()=>files.cleanup().catch(()=>console.error('Cleanup failed; journal retained.')),15000).unref()}
const downloads=await createDownloads({enabled:env.DOWNLOADS_ENABLED==='true',python:env.PYTHON||'python3',onReady:files?async(path,name)=>files.upload(new Blob([await readFile(path)]),name):undefined});
const buckets=new Map();let uploading=false;
const status=()=>({enabled:!!files,providers:files?hosts.map(h=>h.name):[],retentionMinutes:10,maxBytes:50*1024*1024,reason:files?null:'File hosting needs provider credentials, durable storage and an unattended cleanup runner. Downloads are not connected.'});
const server=http.createServer(async(req,res)=>{
 const json=(d,s=200)=>{res.writeHead(s,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(d))};
 try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/health')return json({ok:true,downloads:downloads.enabled,fileHosting:!!files});
 if((path.startsWith('/api/downloads')||path.startsWith('/api/files'))&&!allowApi(req,env))return json({error:'Cross-origin write is not allowed.'},403);
 if(files&&path==='/api/files/status'&&req.method==='GET')return json(status());
 if(path==='/api/internal/cleanup'&&req.method==='POST'){
  if(!files||!env.CLEANUP_TOKEN||req.headers.authorization!=='Bearer '+env.CLEANUP_TOKEN)return json({error:'Unauthorized'},401);
  await files.cleanup();return json({ok:true});
 }
 const ip=req.socket.remoteAddress,now=Date.now();let b=buckets.get(ip);if(!b||now-b.start>60000){b={start:now,count:0};buckets.set(ip,b)}
 if(path.startsWith('/api/')&&++b.count>180){res.setHeader('retry-after','60');return json({error:'Please wait before trying again.'},429)}
 if(!files&&downloads.enabled&&path.startsWith('/api/files/'))return await downloads.handle(req,res,path.replace('/api/files/','/api/downloads/'));
 if(path.startsWith('/api/downloads'))return await downloads.handle(req,res,path);
 if(path==='/api/files/upload'&&req.method==='POST'){
  if(!files)return json({error:status().reason},503);
  if(!allowFileUpload(req,env))return json({error:'Origin not allowed'},403);
  if(uploading)return json({error:'An upload is in progress. Try again shortly.'},429);
  if(!Number(req.headers['content-length'])||Number(req.headers['content-length'])>status().maxBytes)return json({error:'File must be between 1 byte and 50 MB.'},413);
  const type=String(req.headers['content-type']||'').split(';')[0];if(!/^(video|audio)\//.test(type))return json({error:'Choose an audio or video file.'},415);
  uploading=true;try{let n=0;const chunks=[];for await(const c of req){n+=c.length;if(n>status().maxBytes){json({error:'File too large'},413);return}chunks.push(c)}
   if(!n)return json({error:'Empty file'},400);
   const name=decodeURIComponent(String(req.headers['x-file-name']||'media.mp4')).replace(/[^\w. -]/g,'_').slice(0,120);
   return json(await files.upload(new Blob(chunks,{type}),name),201);
  }finally{uploading=false}
 }
 if(path.startsWith('/api/files/')){if(req.method!=='GET')return json({error:'Method not allowed'},405);const item=files?.get(path.split('/').pop());return item?json(item):json({error:'File not found'},404)}
 if(req.method!=='GET')return json({error:'Method not allowed'},405);
 const r=await worker.fetch(new Request('http://localhost'+req.url),{SEARXNG_URL:env.SEARXNG_URL});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
 }catch{if(!res.headersSent)json({error:'Request failed. Uploads with an uncertain outcome are held for review.'},502);else res.end()}
});
setInterval(()=>{for(const[k,v]of buckets)if(Date.now()-v.start>60000)buckets.delete(k)},60000).unref();
server.listen(Number(env.PORT||10000),'0.0.0.0');process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
