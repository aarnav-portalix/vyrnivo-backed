import http from 'node:http';
import {createDownloads} from './downloads.mjs';
import {lookupPublicTitle} from './download-names.mjs';
import {createConverter} from './converter.mjs';
import {createPresence} from './presence.mjs';
import {allowApi} from './access.mjs';
import {createHumanVerification} from './security.mjs';
import {setSecurityHeaders} from './security-headers.mjs';
import {validateOwnedEngineConfig} from './owned-downloader.mjs';
import {createPrivateConversionApi} from './private-api.mjs';
import worker from '../dist/server/index.js';
const env=process.env;
const humanCheck=createHumanVerification({
 siteKey:env.TURNSTILE_SITE_KEY||'',
 secretKey:env.TURNSTILE_SECRET_KEY||'',
 expectedHostname:env.TURNSTILE_EXPECTED_HOSTNAME||'vyrnivo-downloads.onrender.com'
});
if(humanCheck.incomplete)console.warn('Turnstile setup incomplete; challenge stays disabled until both keys exist.');
const ownedEngineConfig=validateOwnedEngineConfig(env.OWN_DOWNLOADER_URL||'',env.OWN_DOWNLOADER_TOKEN||'');
if((env.OWN_DOWNLOADER_URL||env.OWN_DOWNLOADER_TOKEN)&&!ownedEngineConfig)
 console.warn('Private download engine configuration is incomplete or invalid; preserving existing downloaders.');
const downloads=await createDownloads({enabled:env.DOWNLOADS_ENABLED==='true',python:env.PYTHON||'python3',freeFallbackEnabled:env.FREE_YOUTUBE_BACKUP!=='false',verifyToken:humanCheck.verify,ownedEngineConfig,lookupTitle:lookupPublicTitle});
let privateApi;
const converter=await createConverter({enabled:env.DOWNLOADS_ENABLED==='true',onFinished:event=>privateApi?.notify(event)});
privateApi=createPrivateConversionApi({
 converter,token:env.VYRNIVO_PRIVATE_API_TOKEN||env.DOWNLOAD_API_TOKEN||'',
 webhookUrl:env.VYRNIVO_WEBHOOK_URL||'',
 webhookSecret:env.VYRNIVO_WEBHOOK_SECRET||''
});
const presence=createPresence();
const buckets=new Map();
const uploadRemoved=()=>({enabled:false,reason:'Manual uploads are disabled. Paste a YouTube or Instagram link to receive an automatically hosted 10-minute download.'});
const server=http.createServer(async(req,res)=>{
 setSecurityHeaders(res);
 const json=(d,s=200)=>{res.writeHead(s,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(d))};
 try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/health'){res.setHeader('access-control-allow-origin','*');return json({ok:true,downloads:downloads.enabled,converter:converter.enabled,fileHosting:downloads.enabled,readyForDownloads:downloads.enabled});}
 if(path==='/ready')return json({ready:downloads.enabled,downloads:downloads.enabled,converter:converter.enabled},downloads.enabled?200:503);
 if(path==='/api/security/status'&&req.method==='GET')return json(humanCheck.publicStatus());
 if((path.startsWith('/api/downloads')||path.startsWith('/api/files')||path.startsWith('/api/converter')||path.startsWith('/api/presence'))&&!allowApi(req,env))return json({error:'Cross-origin write is not allowed.'},403);
 if(path==='/api/files/status'&&req.method==='GET')return json(uploadRemoved());
 if(path.startsWith('/api/files')||path==='/api/internal/cleanup')return json({error:uploadRemoved().reason},410);
 const ip=req.socket.remoteAddress,now=Date.now();let b=buckets.get(ip);if(!b||now-b.start>60000){b={start:now,count:0};buckets.set(ip,b)}
 if(path.startsWith('/api/')&&++b.count>180){res.setHeader('retry-after','60');return json({error:'Please wait before trying again.'},429)}
 if(path.startsWith('/api/private/'))return await privateApi.handle(req,res,path);
 if(path.startsWith('/api/presence'))return await presence.handle(req,res,path);
 if(path.startsWith('/api/downloads'))return await downloads.handle(req,res,path);
 if(path.startsWith('/api/converter'))return await converter.handle(req,res,path);
 if(req.method!=='GET')return json({error:'Method not allowed'},405);
 const r=await worker.fetch(new Request('http://localhost'+req.url),{SEARXNG_URL:env.SEARXNG_URL,YOUTUBE_DATA_API_KEY:env.YOUTUBE_DATA_API_KEY||''});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
 }catch{if(!res.headersSent)json({error:'Request failed. Uploads with an uncertain outcome are held for review.'},502);else res.end()}
});
setInterval(()=>{for(const[k,v]of buckets)if(Date.now()-v.start>60000)buckets.delete(k)},60000).unref();
server.requestTimeout=30000;
server.headersTimeout=15000;
server.maxHeadersCount=80;
server.listen(Number(env.PORT||10000),'0.0.0.0');process.on('SIGTERM',()=>{downloads.close();converter.close();server.close(()=>process.exit(0))});
