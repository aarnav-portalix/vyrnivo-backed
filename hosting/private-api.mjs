/**
 * Private first-party conversion API and optional outbound signed webhooks.
 * No keys, signatures or callback destinations are exposed in the website UI.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';

const JOB_PATH=/^\/api\/private\/conversions\/([0-9a-f-]{36})(\/file)?$/i;
const PUBLIC_PREFIX='/api/converter/';
const secureEqual=(actual,expected)=>{
 const a=Buffer.from(String(actual||'')),b=Buffer.from(String(expected||''));
 return a.length===b.length&&timingSafeEqual(a,b);
};

export function privateApiAllowed(headers,secret){
 return Boolean(secret)&&secureEqual(headers?.authorization,'Bearer '+secret);
}
export function validWebhookUrl(raw){
 if(!raw)return false;
 try{
  const url=new URL(raw);
  const h=url.hostname.toLowerCase();
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!isIP(h)&&
    h!=='localhost'&&!h.endsWith('.localhost')&&!h.endsWith('.local')&&
    h!=='metadata.google.internal'&&h.includes('.')&&url.hash==='';
 }catch{return false}
}

export function signedWebhook(body,secret,at=Date.now()){
 const timestamp=String(at);
 const payload=JSON.stringify(body);
 const signature=createHmac('sha256',secret).update(timestamp+'.'+payload).digest('hex');
 return {timestamp,payload,signature};
}

export function createPrivateConversionApi({
 converter,token='',webhookUrl='',webhookSecret='',fetchImpl=fetch
}={}){
 const enabled=Boolean(token);
 const validWebhook=Boolean(webhookUrl&&webhookSecret&&validWebhookUrl(webhookUrl));
 const notify=async(event)=>{
  if(!validWebhook)return;
  const data={type:'conversion.completed',id:event.id,state:event.state,bytes:event.bytes,
   method:event.method,completedAt:event.completedAt};
  const signed=signedWebhook(data,webhookSecret);
  try{
   const response=await fetchImpl(webhookUrl,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
    headers:{'content-type':'application/json','x-vyrnivo-timestamp':signed.timestamp,'x-vyrnivo-signature':'sha256='+signed.signature},
    body:signed.payload
   });
   if(!response.ok)console.warn('private_conversion_webhook_unavailable',response.status);
  }catch{console.warn('private_conversion_webhook_unavailable')}
 };
 const handle=async(req,res,path)=>{
  const send=(data,status=200)=>{
   res.writeHead(status,{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'});
   res.end(JSON.stringify(data));
  };
  if(!enabled)return send({error:'Private conversion API is not configured.'},404);
  if(!privateApiAllowed(req.headers,token))return send({error:'Authentication required.'},401);
  if(path==='/api/private/status'&&req.method==='GET')return send({enabled:true,engine:'Vyrnivo',formats:['MP4','MP3'],webhooks:validWebhook});
  if(path==='/api/private/conversions'&&req.method==='POST')return converter.handle(req,res,'/api/converter');
  const match=JOB_PATH.exec(path);
  if(match&&req.method==='GET')return converter.handle(req,res,PUBLIC_PREFIX+match[1]+(match[2]||''));
  return send({error:'Private API endpoint not found.'},404);
 };
 return {enabled,webhookEnabled:validWebhook,handle,notify};
}
