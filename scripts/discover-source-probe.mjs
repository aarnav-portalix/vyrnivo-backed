import assert from 'node:assert/strict';
import {search} from '../worker/search.mjs';
import {findReels} from '../worker/reels.mjs';

const cases=[
 ['youtube','all','wildlife documentaries'],
 ['youtube','videos','space news'],
 ['youtube','shorts','science facts'],
 ['youtube','channels','NASA'],
 ['youtube','playlists','piano tutorials'],
 ['instagram','reels','wildlife'],
 ['instagram','creators','national geographic']
];
const report=[];
for(const [source,kind,q] of cases){
 const request=new Request('https://vyrnivo.test/api/search/'+source+'?q='+encodeURIComponent(q)+'&kind='+kind);
 const response=source==='youtube'?await search(request):await findReels(request);
 assert.equal(response.status,200,source+' '+kind+' search failed with '+response.status);
 const result=await response.json();
 assert.ok(Array.isArray(result.items));
 for(const item of result.items){
  const url=new URL(item.url);
  assert.equal(url.protocol,'https:');
  if(source==='youtube'){
   assert.ok(url.hostname==='www.youtube.com'||url.hostname==='youtube.com');
  }else assert.equal(url.hostname,'www.instagram.com');
 }
 const types=[...new Set(result.items.map(x=>x.kind))].sort();
 const data={source,kind,count:result.items.length,types,example:result.items[0]?.url||null,notice:result.notice||null};
 report.push(data);
 console.log('DISCOVER_SOURCE_PROBE',JSON.stringify(data));
}
console.log('DISCOVER_SEARCH_SUMMARY',JSON.stringify(report));
