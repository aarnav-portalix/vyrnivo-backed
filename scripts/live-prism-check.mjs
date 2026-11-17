import assert from 'node:assert/strict';
const base='https://vyrnivo-downloads.onrender.com';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchLive(path,opts={}){
 let error;
 for(let i=0;i<4;i++){
  try{
   const r=await fetch(base+path,{...opts,signal:AbortSignal.timeout(28000)});
   if(r.ok||opts.expectFailure)return r;
   error=Error(path+' returned '+r.status);
  }catch(e){error=e}
  await pause(2500);
 }
 throw error;
}
const root=await fetchLive('/');
const html=await root.text();
assert.match(html,/app\.js/);
const js=await (await fetchLive('/app.js')).text();
const css=await (await fetchLive('/app.css')).text();
for(const marker of [
 'file-label','downloadName','Discover','Aarnav12','Checking progress',
 'Cloudflare','Original audio','M4A'
 ])assert.ok(js.includes(marker),'Production bundle missing '+marker);
for(const marker of [
 'surface-interactive','file-label',
 'prefers-reduced-motion','max-width:520px'
 ])assert.ok(css.includes(marker),'Production CSS missing '+marker);
const health=await (await fetchLive('/health')).json();
assert.equal(health.ok,true);
assert.equal(health.downloads,true);
const status=await (await fetchLive('/api/downloads/status')).json();
assert.equal(status.enabled,true);
assert.equal(status.freeFallbackEnabled,true);
assert.deepEqual(status.audioFallbackFormats,['MP3','M4A','WAV']);
const security=await (await fetchLive('/api/security/status')).json();
assert.equal(security.enabled,true,'Cloudflare Turnstile must stay active');
const denied=await fetchLive('/api/downloads',{expectFailure:true,method:'POST',
 headers:{Origin:base,'content-type':'application/json'},
 body:JSON.stringify({url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',mode:'Video + audio',
 quality:'720p',container:'MP4'})
});
assert.equal(denied.status,403,'Unverified download should remain blocked');
const err=await denied.json();
assert.equal(err.code,'BOT_CHECK_REQUIRED');
const shorts=await (await fetchLive('/api/search/youtube?q=music&kind=shorts')).json();
assert.ok(Array.isArray(shorts.items));
console.log('LIVE_PRISM_VYRNIVO_OK',JSON.stringify({
 website:true,qualityFormatFilenameUI:true,prismMotionCSS:true,lightMobileCSS:true,
 mainDownload:true,backup:true,audioFormats:status.audioFallbackFormats,
 turnstileEnabled:true,unverifiedDownloadBlocked:true,
 discoverShorts:shorts.items.length
}));
