/**
 * Standalone private Vyrnivo extraction worker.
 * Uses our own yt-dlp / FFmpeg engine, with no public third-party API.
 * Deploy separately with an independently hosted HTTPS origin.
 */
import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {createDownloads} from './downloads.mjs';
import {setSecurityHeaders} from './security-headers.mjs';

export function authorizedWorker(headers,secret){
 const expected=Buffer.from('Bearer '+String(secret||''));
 const supplied=Buffer.from(String(headers?.authorization||''));
 return Boolean(secret)&&expected.length===supplied.length&&timingSafeEqual(expected,supplied);
}

export function createWorkerHandler({engine,secret}){
 if(!secret||secret.length<24)throw Error('OWN_DOWNLOADER_TOKEN must be a strong server-only secret (at least 24 characters).');
 return async(req,res)=>{
  setSecurityHeaders(res);
  res.setHeader('cache-control','no-store');
  const send=(data,status=200)=>{
   res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
   res.end(JSON.stringify(data));
  };
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   if(path==='/health'&&req.method==='GET')return send({ok:true,service:'vyrnivo-media-worker'});
   if(!authorizedWorker(req.headers,secret))return send({error:'Unauthorized.'},401);
   if(path==='/api/downloads'&&req.method==='POST')return engine.handle(req,res,path);
   if(path==='/api/downloads/status'&&req.method==='GET')return engine.handle(req,res,path);
   if(/^\/api\/downloads\/[0-9a-f-]{36}(?:\/file)?$/i.test(path)&&req.method==='GET')return engine.handle(req,res,path);
   return send({error:'Not found.'},404);
  }catch{
   if(!res.headersSent)return send({error:'Media worker request failed.'},500);
   res.destroy();
  }
 };
}

export async function startMediaWorker(env=process.env){
 const secret=env.OWN_DOWNLOADER_TOKEN||'';
 if(secret.length<24)throw Error('Set the OWN_DOWNLOADER_TOKEN secret in the worker environment before deployment.');
 const downloads=await createDownloads({
  enabled:true,python:env.PYTHON||'python3',freeFallbackEnabled:false
 });
 const server=http.createServer(createWorkerHandler({engine:downloads,secret}));
 server.requestTimeout=30000;
 server.headersTimeout=15000;
 server.maxHeadersCount=80;
 server.listen(Number(env.PORT||10000),'0.0.0.0');
 process.on('SIGTERM',()=>{downloads.close();server.close(()=>process.exit(0))});
 return {server,downloads};
}
