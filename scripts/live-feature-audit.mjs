import assert from 'node:assert/strict';

const base='https://vyrnivo-downloads.onrender.com';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const output={};
const call=async(path,init={})=>{
 let last;
 for(let n=0;n<3;n++){
  try{
   const r=await fetch(base+path,{...init,signal:AbortSignal.timeout(30000)});
   return r;
  }catch(e){last=e;if(n<2)await pause(3000)}
 }
 throw last;
};
const json=async(path,init={})=>{
 const r=await call(path,init);
 const body=await r.text();
 let data;try{data=JSON.parse(body)}catch{data={error:body.slice(0,100)}}
 return {status:r.status,data,headers:r.headers};
};
const check=(name,cond,detail)=>{output[name]={status:cond?'pass':'fail',detail};if(!cond)process.exitCode=1};
const page=await call('/');
const html=await page.text();
check('siteOnline',page.status===200,{status:page.status,hasAppScript:html.includes('/app.js')});
check('antiClickjack',page.headers.get('x-frame-options')==='DENY',{xFrameOptions:page.headers.get('x-frame-options')});
const [jsR,cssR]=await Promise.all([call('/app.js'),call('/app.css')]);
const js=await jsR.text(),css=await cssR.text();
const markers={
 tabs:['Discover','About','Download'],
 policies:['Privacy Policy','Terms of Use','Copyright & Content Removal','Service & Availability Notice'],
 credits:['Built by Aarnav12'],
 downloader:['Main engine','Backup engine','Open Discover'],
 processing:['No reliable completion estimate available yet','Elapsed'],
 bot:['One quick security check','Verify you'],
 search:['YouTube','Instagram','Preview'],
};
for(const [name,parts] of Object.entries(markers)){
 check('ui_'+name,parts.every(p=>js.includes(p)),{found:parts.filter(p=>js.includes(p)),missing:parts.filter(p=>!js.includes(p))});
}
const cssMarkers=['@media(max-width:520px)','@media(max-width:760px)','pointer:coarse','touch-action:manipulation','prefers-reduced-motion','.discover-teaser','.legal-center','.processing-time'];
check('responsiveTouchStyles',cssMarkers.every(p=>css.includes(p)),{found:cssMarkers.filter(p=>css.includes(p)),missing:cssMarkers.filter(p=>!css.includes(p))});
const health=await json('/health');
check('health',health.status===200&&health.data.ok===true,{http:health.status,downloads:health.data.downloads,converter:health.data.converter});
const bot=await json('/api/security/status');
check('botConfigurationEndpoint',bot.status===200&&typeof bot.data.enabled==='boolean',{http:bot.status,activated:bot.data.enabled,siteKeyPresent:Boolean(bot.data.siteKey)});
const downloads=await json('/api/downloads/status');
check('downloaderApi',downloads.status===200&&downloads.data.enabled===true,{http:downloads.status,enabled:downloads.data.enabled,freeBackupEnabled:downloads.data.freeFallbackEnabled,sourceAvailability:downloads.data.sourceAvailability});
const converter=await json('/api/converter/status');
check('converterApi',converter.status===200&&converter.data.enabled===true,{http:converter.status,enabled:converter.data.enabled,formats:converter.data.formats,licensedDiscovery:converter.data.licensedDiscovery});
const presence=await json('/api/presence/status');
check('onlineCounterApi',presence.status===200&&presence.data.approximate===true&&typeof presence.data.online==='number',{http:presence.status,online:presence.data.online,approximate:presence.data.approximate});
const privateApi=await json('/api/private/status');
check('privateApiProtected',privateApi.status===401,{unauthenticatedHttpStatus:privateApi.status});
const files=await json('/api/files/status');
check('manualUploadsDisabled',files.status===200&&files.data.enabled===false,{http:files.status,enabled:files.data.enabled});
const bad=await json('/api/downloads',{method:'POST',headers:{Origin:base,'content-type':'application/json'},body:JSON.stringify({url:'https://example.net/not-video',mode:'Video + audio',quality:'720p',container:'MP4'})});
check('invalidSourceBlocked',bad.status===400,{http:bad.status});
const invalidOrigin=await json('/api/downloads',{method:'POST',headers:{Origin:'https://untrusted.invalid','content-type':'application/json'},body:'{}'});
check('crossOriginWriteBlocked',invalidOrigin.status===403,{http:invalidOrigin.status});
for(const platform of ['youtube','instagram']){
 const result=await json('/api/search/'+platform+'?q='+encodeURIComponent('roblox rivals'));
 const ok=result.status===200&&Array.isArray(result.data.items);
 check('search_'+platform+'Endpoint',ok,{http:result.status,items:Array.isArray(result.data.items)?result.data.items.length:null,notice:result.data.notice?.slice(0,160)||null,error:result.data.error||null});
}
console.log('LIVE_FEATURE_AUDIT',JSON.stringify(output));
