/**
 * Ephemeral, privacy-preserving active-browser estimate.
 * No IP addresses, user agents, accounts, cookies or stored analytics.
 * Browser IDs are locally generated random UUIDs, expire in 75s,
 * and are only held in memory on this one Render instance.
 */
const WINDOW_MS=75000;
const MAX_ACTIVE=30000;
const ID_RE=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function createPresence({now=Date.now}={}){
 const visitors=new Map();
 const sweep=()=>{const cutoff=now()-WINDOW_MS;for(const [id,lastSeen] of visitors)if(lastSeen<=cutoff)visitors.delete(id)};
 const publicStatus=()=>{sweep();return {online:visitors.size,approximate:true,activeWindowSeconds:WINDOW_MS/1000,scope:'this server',updatedAt:now()}};
 return {
  status:publicStatus,
  async handle(req,res,path){
   const send=(data,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data))};
   if(path==='/api/presence/status'&&req.method==='GET')return send(publicStatus());
   if(path==='/api/presence/heartbeat'&&req.method==='POST'){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>160)return send({error:'Request too large.'},413)}
    let id;try{id=JSON.parse(body).id}catch{}
    if(typeof id!=='string'||!ID_RE.test(id))return send({error:'A valid visitor session is required.'},400);
    sweep();
    if(visitors.size>=MAX_ACTIVE&&!visitors.has(id))return send({error:'Presence service is busy.'},503);
    visitors.set(id,now());
    return send(publicStatus());
   }
   return send({error:'Not found.'},404);
  }
 };
}
