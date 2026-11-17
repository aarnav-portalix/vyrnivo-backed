import assert from 'node:assert/strict';
import {search} from '../worker/search.mjs';
import {findReels} from '../worker/reels.mjs';
import {matchEvidence} from '../worker/search-quality.mjs';

const cases=[
 ['youtube','videos','space news'],['youtube','shorts','science facts'],
 ['youtube','channels','NASA'],['youtube','playlists','piano tutorials'],
 ['instagram','reels','wildlife animals'],['instagram','creators','national geographic']
];
for(const [platform,kind,q] of cases){
 const url='https://vyrnivo.test/api/search/'+platform+'?kind='+kind+'&q='+encodeURIComponent(q);
 const res=platform==='youtube'?await search(new Request(url)):await findReels(new Request(url));
 assert.equal(res.status,200,platform+' '+kind+' endpoint unavailable: '+res.status);
 const data=await res.json();
 assert.equal(data.kind,kind);
 assert.ok(Array.isArray(data.items));
 assert.ok(data.searchUrl.startsWith('https://www.'+platform+'.com/'));
 for(const item of data.items){
  const src=new URL(item.url);
  assert.equal(src.protocol,'https:');
  assert.equal(src.hostname,'www.'+platform+'.com');
  if(kind==='shorts')assert.equal(item.kind,'short');
  if(kind==='channels')assert.equal(item.kind,'channel');
  if(kind==='playlists')assert.equal(item.kind,'playlist');
  if(kind==='creators')assert.equal(item.kind,'creator');
  if(kind==='reels'){
   assert.match(src.pathname,/^\/reel\/[A-Za-z0-9_-]{6,30}\/$/);
   assert.equal(matchEvidence(item,q).accepted,true,
    'Off-topic indexed Instagram result must not appear: '+item.title);
  }
 }
 const note=data.items.length===0?'source unavailable or no verified index hits':'source matches';
 console.log('DISCOVER_ACCURACY_LIVE',JSON.stringify({platform,kind,query:q,count:data.items.length,
  examples:data.items.slice(0,3).map(x=>({title:x.title,url:x.url})),
  nativeSource:data.searchUrl,note}));
}
