import assert from 'node:assert/strict';

const base='https://vyrnivo-downloads.onrender.com';
const get=async(path)=>{
 const r=await fetch(base+path,{signal:AbortSignal.timeout(25000)});
 assert.equal(r.status,200,'Expected 200 from '+path+' but got '+r.status);
 return r;
};
const json=async(path)=>(await get(path)).json();
const app=await (await get('/app.js')).text();
const css=await (await get('/app.css')).text();
for(const marker of ['discover-filters','Try 720p','Open creator','Open channel','Open playlist','Search Shorts','Built by Aarnav12']){
 assert.ok(app.includes(marker),'Live app missing '+marker);
}
assert.match(css,/\.discover-filters/);
const health=await json('/health');
assert.equal(health.ok,true);
assert.equal(health.downloads,true);
assert.equal(health.converter,true);
const engine=await json('/api/downloads/status');
assert.equal(engine.enabled,true);
assert.equal(engine.freeFallbackEnabled,true,'Keep working backup enabled until independent source proven');
const bot=await json('/api/security/status');
assert.equal(bot.enabled,true,'Turnstile must remain activated');
assert.ok(bot.siteKey,'Site key should be present');
let response=await fetch(base+'/api/downloads',{method:'POST',
 headers:{Origin:base,'content-type':'application/json'},
 body:JSON.stringify({url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',mode:'Video + audio',quality:'720p',container:'MP4'}),
 signal:AbortSignal.timeout(20000)});
assert.equal(response.status,403,'Download submission without Cloudflare token should be blocked');
assert.equal((await response.json()).code,'BOT_CHECK_REQUIRED');
const checks=[];
for(const [platform,kind,query] of [
 ['youtube','videos','space news'],
 ['youtube','shorts','science facts'],
 ['youtube','channels','NASA'],
 ['youtube','playlists','piano tutorials'],
 ['instagram','reels','wildlife'],
 ['instagram','creators','@natgeo']
]){
 const p='/api/search/'+platform+'?q='+encodeURIComponent(query)+'&kind='+kind;
 const result=await json(p);
 assert.equal(result.kind,kind,'Server did not honor requested '+kind+' filter');
 assert.ok(Array.isArray(result.items));
 for(const item of result.items){
  assert.ok(item.url,'Missing navigational URL');
  const u=new URL(item.url);
  assert.equal(u.protocol,'https:');
  assert.ok(platform==='youtube'?u.hostname==='www.youtube.com':u.hostname==='www.instagram.com');
  if(kind==='shorts')assert.equal(item.kind,'short');
  if(kind==='channels')assert.equal(item.kind,'channel');
  if(kind==='playlists')assert.equal(item.kind,'playlist');
  if(kind==='creators')assert.equal(item.kind,'creator');
 }
 if(platform==='youtube')assert.ok(result.items.length>0,'Expected real YouTube '+kind+' results from cloud search');
 if(kind==='creators'&&result.items.length===0){
  assert.equal(result.suggestedProfile?.url,'https://www.instagram.com/natgeo/');
  assert.equal(result.suggestedProfile?.verified,false);
 }
 checks.push({platform,kind,count:result.items.length,externalFallback:!!result.searchUrl,
  exactHandleSuggestion:!!result.suggestedProfile});
}
console.log('LIVE_DISCOVER_V2_VERIFIED',JSON.stringify({site:true,downloadButtonUI:true,converter:true,turnstileProtected:true,backupEnabled:true,checks}));
