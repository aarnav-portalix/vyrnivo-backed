export async function backend(request,env){
 const path=new URL(request.url).pathname;
 if(!env.DOWNLOAD_BACKEND_URL||!env.DOWNLOAD_BACKEND_TOKEN)return Response.json({enabled:false,error:'Download backend configuration is missing.'},{status:503});
 let timer;
 try{
  const controller=new AbortController();timer=setTimeout(()=>controller.abort(),70000);
  const base=new URL(String(env.DOWNLOAD_BACKEND_URL));if(base.protocol!=='https:')throw new Error('Backend URL must use HTTPS');
  const headers=new Headers({Authorization:'Bearer '+env.DOWNLOAD_BACKEND_TOKEN});
  for(const name of ['content-type','x-file-name'])if(request.headers.has(name))headers.set(name,request.headers.get(name));
  const init={method:request.method,headers,redirect:'manual',signal:controller.signal};
  if(!['GET','HEAD'].includes(request.method))init.body=request.body;
  const r=await fetch(new URL(path,base).href,init);
  if(r.status>=300&&r.status<400)throw new Error('Backend returned an unexpected redirect');
  const out=new Headers();for(const name of ['content-type','content-disposition','content-length','retry-after'])if(r.headers.has(name))out.set(name,r.headers.get(name));
  out.set('cache-control','no-store');out.set('x-content-type-options','nosniff');
  return new Response(r.body,{status:r.status,headers:out});
 }catch(e){
  const detail=String(e?.message||'Unknown error').split(String(env.DOWNLOAD_BACKEND_TOKEN)).join('[redacted]');
  console.error('backend_proxy_failure',String(e?.name),detail);
  return Response.json({enabled:false,error:'Download server is unavailable. Please try again shortly.',code:e?.name==='AbortError'?'BACKEND_TIMEOUT':'BACKEND_CONNECTION_FAILED'},{status:503});
 }finally{clearTimeout(timer)}
}
