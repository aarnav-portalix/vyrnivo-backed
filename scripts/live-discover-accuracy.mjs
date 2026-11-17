import assert from 'node:assert/strict';

const base='https://vyrnivo-downloads.onrender.com';
const get=async(path)=>{
 const r=await fetch(base+path,{signal:AbortSignal.timeout(25000)});
 assert.equal(r.status,200,'Expected 200 '+path+' got '+r.status);
 return r;
};
const js=await (await get('/app.js')).text();
const css=await (await get('/app.css')).text();
for(const marker of ['native-search-bar','View source','No trustworthy matches returned',
 'Find videos, Shorts & creators','Open original search','Built by Aarnav12']){
 assert.ok(js.includes(marker),'Live Discover bundle missing '+marker);
}
assert.ok(css.includes('native-search-bar'));
const health=await (await get('/health')).json();
assert.equal(health.ok,true);
const protection=await (await get('/api/security/status')).json();
assert.equal(protection.enabled,true);
const cases=[
 ['youtube','videos','space news'],['youtube','shorts','science facts'],
 ['youtube','channels','NASA'],['youtube','playlists','piano tutorials'],
 ['instagram','reels','wildlife animals'],['instagram','creators','national geographic']
];
const report=[];
for(const [platform,kind,q] of cases){
 const data=await (await get('/api/search/'+platform+'?kind='+kind+'&q='+encodeURIComponent(q))).json();
 assert.equal(data.kind,kind);
 assert.ok(Array.isArray(data.items));
 assert.ok(new URL(data.searchUrl).hostname==='www.'+platform+'.com',
  'Source search link must go to the original platform');
 for(const item of data.items){
  const u=new URL(item.url);
  assert.equal(u.hostname,'www.'+platform+'.com');
  if(kind==='shorts')assert.equal(item.kind,'short');
  if(kind==='channels')assert.equal(item.kind,'channel');
  if(kind==='playlists')assert.equal(item.kind,'playlist');
  if(kind==='creators')assert.equal(item.kind,'creator');
  if(kind==='reels')assert.equal(item.kind,'instagram');
 }
 report.push({platform,kind,matchingSourceLinks:data.items.length,nativeSearchAvailable:true});
}
const reelUrl='https://www.instagram.com/reel/AbCdefGhI/';
const direct=(await (await get('/api/search/instagram?kind=reels&q='+encodeURIComponent(reelUrl))).json());
assert.equal(direct.items.length,1);
assert.equal(direct.items[0].url,reelUrl);
console.log('LIVE_DISCOVER_ACCURACY_OK',JSON.stringify({frontend:true,health:true,
 turnstileEnabled:true,directLink:true,report}));
