import http from 'node:http';
import {createDownloads} from './downloads.mjs';
import {createConverter} from './converter.mjs';
import {allowApi} from './access.mjs';
import worker from '../dist/server/index.js';
const env=process.env;
const downloads=await createDownloads({enabled:env.DOWNLOADS_ENABLED==='true',python:env.PYTHON||'python3',freeFallbackEnabled:env.FREE_YOUTUBE_BACKUP==='true'});
const converter=await createConverter({enabled:env.DOWNLOADS_ENABLED==='true'});
const buckets=new Map();
const uploadRemoved=()=>({enabled:false,reason:'Manual uploads are disabled. Paste a YouTube or Instagram link to receive an automatically hosted 10-minute download.'});
const server=http.createServer(async(req,res)=>{
 const json=(d,s=200)=>{res.writeHead(s,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(d))};
 try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/health')return json({ok:true,downloads:downloads.enabled,converter:converter.enabled,fileHosting:true});
 if((path.startsWith('/api/downloads')||path.startsWith('/api/files')||path.startsWith('/api/converter'))&&!allowApi(req,env))return json({error:'Cross-origin write is not allowed.'},403);
 if(path==='/api/files/status'&&req.method==='GET')return json(uploadRemoved());
 if(path.startsWith('/api/files')||path==='/api/internal/cleanup')return json({error:uploadRemoved().reason},410);
 const ip=req.socket.remoteAddress,now=Date.now();let b=buckets.get(ip);if(!b||now-b.start>60000){b={start:now,count:0};buckets.set(ip,b)}
 if(path.startsWith('/api/')&&++b.count>180){res.setHeader('retry-after','60');return json({error:'Please wait before trying again.'},429)}
 if(path.startsWith('/api/downloads'))return await downloads.handle(req,res,path);
 if(path.startsWith('/api/converter'))return await converter.handle(req,res,path);
 if(req.method!=='GET')return json({error:'Method not allowed'},405);
 const r=await worker.fetch(new Request('http://localhost'+req.url),{SEARXNG_URL:env.SEARXNG_URL});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
 }catch{if(!res.headersSent)json({error:'Request failed. Uploads with an uncertain outcome are held for review.'},502);else res.end()}
});
setInterval(()=>{for(const[k,v]of buckets)if(Date.now()-v.start>60000)buckets.delete(k)},60000).unref();
server.listen(Number(env.PORT||10000),'0.0.0.0');process.on('SIGTERM',()=>{downloads.close();converter.close();server.close(()=>process.exit(0))});
