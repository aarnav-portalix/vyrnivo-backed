/**
 * Cloudflare Turnstile request verification for public download submissions.
 * Secrets are never sent to browsers. This is optional until both Render
 * environment variables are configured, to preserve the existing downloader.
 */
const SITEVERIFY_URL='https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH=2048;

export function createHumanVerification({
 siteKey='',secretKey='',expectedHostname='vyrnivo-downloads.onrender.com',
 fetchImpl=fetch
}={}){
 const enabled=Boolean(siteKey&&secretKey);
 const acceptedHostnames=new Set(String(expectedHostname).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
 const incomplete=Boolean(siteKey)!==Boolean(secretKey);
 const publicStatus=()=>({enabled,siteKey:enabled?siteKey:null});
 async function verify(token){
  if(!enabled)return {ok:true};
  if(typeof token!=='string'||token.length<8||token.length>MAX_TOKEN_LENGTH)
   return {ok:false,status:403,code:'BOT_CHECK_REQUIRED',error:'Please complete the human verification and try again.'};
  let response;
  try{
   response=await fetchImpl(SITEVERIFY_URL,{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded','accept':'application/json'},
    body:new URLSearchParams({secret:secretKey,response:token}).toString(),
    redirect:'error',
    signal:AbortSignal.timeout(8000)
   });
   if(!response.ok)throw Error('Verification service returned an error.');
   const result=await response.json();
   if(result?.success===true&&acceptedHostnames.has(String(result?.hostname||'').toLowerCase())&&result?.action==='download')
    return {ok:true};
  }catch{
   return {ok:false,status:503,code:'BOT_CHECK_UNAVAILABLE',error:'Human verification is temporarily unavailable. Please try again shortly.'};
  }
  return {ok:false,status:403,code:'BOT_CHECK_FAILED',error:'Human verification failed or expired. Please try again.'};
 }
 return {enabled,incomplete,publicStatus,verify};
}
