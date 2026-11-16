import assert from 'node:assert/strict';
const base='https://vyrnivo-downloads.onrender.com';
const url=base+'/api/search/instagram?q='+encodeURIComponent('roblox rivals');
const r=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{Accept:'application/json'}});
assert.equal(r.status,200,'Instagram discovery endpoint must respond with 200');
const d=await r.json();
assert.ok(Array.isArray(d.items));
for(const item of d.items){
 const u=new URL(item.url);
 assert.equal(u.protocol,'https:');
 assert.equal(u.hostname,'www.instagram.com');
 assert.match(u.pathname,/^\/reel\/[A-Za-z0-9_-]{6,30}\/$/);
}
console.log('LIVE_INSTAGRAM_DISCOVERY:',JSON.stringify({
 resultCount:d.items.length,
 firstThreeTitles:d.items.slice(0,3).map(x=>x.title),
 notice:d.notice,
 hasTopic:!!d.topic
}));
