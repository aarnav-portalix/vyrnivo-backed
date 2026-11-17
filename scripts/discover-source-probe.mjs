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

for(const query of ['site:instagram.com/ national geographic','site:instagram.com/ natgeo','site:instagram.com/natgeo']){
 const link=new URL('https://www.bing.com/search');
 link.searchParams.set('q',query);link.searchParams.set('format','rss');
 try{
  const r=await fetch(link,{redirect:'error',signal:AbortSignal.timeout(8000)});
  const xml=(await r.text()).slice(0,160000);
  const links=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)].slice(0,7).map(x=>({
   title:(x[1].match(/<title>([\s\S]*?)<\/title>/)?.[1]||'').slice(0,70),
   href:(x[1].match(/<link>([\s\S]*?)<\/link>/)?.[1]||'').slice(0,140)
  }));
  console.log('INSTAGRAM_PUBLIC_INDEX_DIAG',JSON.stringify({query,status:r.status,links}));
 }catch(e){console.log('INSTAGRAM_PUBLIC_INDEX_DIAG',JSON.stringify({query,error:String(e.message).slice(0,90)}))}
}
