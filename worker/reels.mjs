import {instagram} from './instagram.mjs';
import {indexedInstagram} from './ig-index.mjs';
import {searx} from './searx.mjs';
import {searchInstagramCreators} from './ig-creators.mjs';

const cache=new Map();
const canonical=item=>{
 try{
  const u=new URL(item?.url);
  const code=u.pathname.match(/^\/reel\/([a-zA-Z0-9_-]{6,30})\/?$/)?.[1];
  if(u.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(u.hostname)||!code)return null;
  return {id:code,kind:'instagram',title:String(item.title||'Public Instagram Reel').slice(0,180),creator:String(item.creator||'Instagram').slice(0,80),url:'https://www.instagram.com/reel/'+code+'/'};
 }catch{return null}
};

export async function findReels(request,{searchIndex=indexedInstagram,searchPublic=instagram,searchSearx=searx,searchCreators=searchInstagramCreators,base,now=Date.now}={}){
 const url=new URL(request.url);
 const kind=url.searchParams.get('kind')||'reels';
 if(!['reels','creators'].includes(kind))return Response.json({error:'Unsupported Instagram search type.'},{status:400});
 if(kind==='creators')return searchCreators(request,{base,now});
  const query=(new URL(request.url).searchParams.get('q')||'').trim();
 if(query.length<2||query.length>100)return Response.json({error:'Enter a topic between 2 and 100 characters.'},{status:400});
 const key=String(base||'')+'|'+query.toLocaleLowerCase();
 const hit=cache.get(key);
 if(hit&&now()-hit.time<(hit.data.items.length?900000:120000))return Response.json(hit.data);
 // Run only bounded public searches. A denied source is not proof there are no Reels.
 const tasks=[searchIndex(request),searchPublic(request)];
 if(base)tasks.unshift(searchSearx(request,base));
 const results=await Promise.allSettled(tasks);
 const seen=new Set(),items=[];let topic=null,sourceURL=null;
 for(const outcome of results){
  if(outcome.status!=='fulfilled'||!outcome.value?.ok)continue;
  let data;try{data=await outcome.value.json()}catch{continue}
  if(data.topic&&!topic){topic=data.topic;sourceURL=data.sourceURL}
  for(const item of data.items||[]){
   const v=canonical(item);
   if(v&&!seen.has(v.id)){seen.add(v.id);items.push(v)}
   if(items.length===18)break;
  }
 }
 const searchUrl='https://www.google.com/search?q='+encodeURIComponent('site:instagram.com/reel/ '+query);
 const data={items,kind:'reels',query,topic,sourceURL,searchUrl,notice:items.length?
   'Public indexed/accessible Reel matches. Instagram may refuse preview or download for individual posts.':
   'No public Reel cards could be verified from this server. Open an indexed web search or paste a direct public Reel link.'};
 if(cache.size>100)cache.clear();
 cache.set(key,{time:now(),data});
 return Response.json(data,{headers:{'cache-control':'no-store'}});
}
