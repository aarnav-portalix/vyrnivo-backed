// Permit the public app on this same host, while keeping the cross-service
// proxy authenticated with DOWNLOAD_API_TOKEN. The browser never sees the token.
export function isDownloadAuthorized(req,path,env={}){
 const h=req.headers||{},token=env.DOWNLOAD_API_TOKEN;
 if(token&&h.authorization==='Bearer '+token)return true;
 // Download links are short-lived, unguessable bearer URLs; allow sharing them.
 if(req.method==='GET'&&/^\/api\/(?:downloads|files)\/[0-9a-f-]{36}\/file$/.test(path))return true;
 const host=String(h.host||'').trim().toLowerCase();
 if(!/^[a-z0-9.-]+(?::[0-9]{1,5})?$/.test(host))return false;
 const forwarded=String(h['x-forwarded-proto']||'').split(',')[0].trim().toLowerCase();
 const proto=['https','http'].includes(forwarded)?forwarded:/^(localhost|127\.0\.0\.1)(:|$)/.test(host)?'http':'https';
 const ownOrigin=proto+'://'+host;
 if(h.origin&&h.origin!==ownOrigin)return false;
 if(h['sec-fetch-site']&&h['sec-fetch-site']!=='same-origin')return false;
 if(h['sec-fetch-site']==='same-origin'||h.origin===ownOrigin)return true;
 // Unauthenticated health/status GETs are useful when no token is configured.
 return !token&&['GET','HEAD'].includes(req.method);
}
