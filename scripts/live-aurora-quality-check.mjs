import assert from 'node:assert/strict';
const base='https://vyrnivo-downloads.onrender.com';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const get=async(path,opts={})=>{
 let last;
 for(let i=0;i<4;i++){
  try{
   const res=await fetch(base+path,{...opts,signal:AbortSignal.timeout(28000)});
   if(res.ok||opts.allowError)return res;
   last=Error(path+' HTTP '+res.status);
  }catch(e){last=e}
  await pause(2200);
 }
 throw last;
};
const app=await (await get('/app.js')).text();
const css=await (await get('/app.css')).text();
for(const marker of ['aurora-visual','320 kbps','120 kbps','Audio quality','Try 720p','Download service','Source access','Time remaining appears when measurable progress is available','Built by Aarnav12','downloadName']){
 assert.ok(app.includes(marker),'Production client missing '+marker);
}
for(const bad of ['Backup engine','Main engine','This video could not be retrieved by the backup']){
 assert.ok(!app.includes(bad),'Production interface must not show provider details: '+bad);
}
for(const marker of ['aurora-svg','aurora-spin','flow-steps','prefers-reduced-motion','@media(max-width:520px)']){
 assert.ok(css.includes(marker),'Production CSS missing '+marker);
}
const status=await (await get('/api/downloads/status')).json();
assert.equal(status.enabled,true);
assert.ok(status.freeFallbackEnabled,'Existing source recovery should remain available');
const security=await (await get('/api/security/status')).json();
assert.equal(security.enabled,true);
const health=await (await get('/health')).json();
assert.equal(health.ok,true);
assert.equal(health.downloads,true);
assert.equal(health.converter,true);
const request=await get('/api/downloads',{allowError:true,method:'POST',
 headers:{Origin:base,'content-type':'application/json'},
 body:JSON.stringify({url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',mode:'Audio only',quality:'Best available',container:'MP3',audioBitrate:'320 kbps'})
});
assert.equal(request.status,403,'Cloudflare should still protect download requests');
const denied=await request.json();
assert.equal(denied.code,'BOT_CHECK_REQUIRED');
const insta=await (await get('/api/search/instagram?q=wildlife&kind=reels')).json();
const youtube=await (await get('/api/search/youtube?q=science%20facts&kind=shorts')).json();
assert.ok(Array.isArray(insta.items));assert.ok(Array.isArray(youtube.items));
console.log('LIVE_AURORA_QUALITY_OK',JSON.stringify({
 ui:'Aurora',mobileCSS:true,videoQualityFilters:true,audioBitrates:['120 kbps','320 kbps'],
 publicProviderNamesHidden:true,sourceRecoveryEnabled:true,elapsedAndMeasuredETA:true,
 downloadProtected:true,siteHealth:true,discoverYT:youtube.items.length,discoverInsta:insta.items.length
}));
