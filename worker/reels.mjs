import {officialInstagramSearch} from './ig-official.mjs';
import {indexedInstagram} from './ig-index.mjs';
import {searx} from './searx.mjs';
import {searchInstagramCreators} from './ig-creators.mjs';
import {relevantIndexedItems,nativeInstagramSearchUrl} from './search-quality.mjs';

const cache=new Map();
const canonical=item=>{
 try{
  const u=new URL(item?.url);
  const code=u.pathname.match(/^\/(?:reel|reels)\/([a-zA-Z0-9_-]{6,30})\/?$/)?.[1];
  if(u.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(u.hostname)||!code)return null;
  return {id:code,kind:'instagram',title:String(item.title||'Public Instagram Reel').slice(0,180),creator:String(item.creator||'Instagram').slice(0,80),description:String(item.description||'').slice(0,350),source:item.source||'Public index',url:'https://www.instagram.com/reel/'+code+'/'};
 }catch{return null}
};

export async function findReels(request,{searchIndex=indexedInstagram,searchSearx=searx,searchCreators=searchInstagramCreators,base,now=Date.now,instagramAccountId,instagramAccessToken}={}){
 const url=new URL(request.url);
 const kind=url.searchParams.get('kind')||'reels';
 if(!['reels','creators'].includes(kind))return Response.json({error:'Unsupported Instagram search type.'},{status:400});
 if(kind==='creators')return searchCreators(request,{base,now});
 const query=url.searchParams.get('q')?.trim()||'';
 if(query.length<2||query.length>200)return Response.json({error:'Enter a topic or public Reel URL (2–200 characters).'},{status:400});
 const searchUrl=nativeInstagramSearchUrl(query);
 const official=await officialInstagramSearch(request,{accountId:instagramAccountId,token:instagramAccessToken});
 if(official)return official;
 const direct=canonical({url:query,title:'Instagram Reel',creator:'Public Reel',source:'Exact link entered'});
 // A single Instagram handle is an account lookup, not a Reel topic.
 if(/^@[A-Za-z0-9._]{1,30}$/.test(query))return searchCreators(
  new Request(url.origin+url.pathname+'?q='+encodeURIComponent(query)+'&kind=creators'),{base,now}
 );
 if(direct)return Response.json({items:[{...direct,matchType:'direct-link'}],kind:'reels',query,searchUrl,
  notice:'This is the exact Reel link you entered. Its availability is controlled by Instagram.'});
 const key=String(base||'')+'|'+query.toLocaleLowerCase();
 const hit=cache.get(key);
 if(hit&&now()-hit.time<(hit.data.items.length?120000:20000))return Response.json(hit.data);
  // Public Instagram topic pages are slow, often blocked, and rarely return usable Reel cards.
 // Prefer independent public search indexes rather than waiting for that endpoint.
 const tasks=[searchIndex(request)];
 if(base)tasks.unshift(searchSearx(request,base));
 const results=await Promise.allSettled(tasks);
 const seen=new Set(),items=[];let topic=null,sourceURL=null,availableSources=0;
 for(const outcome of results){
  if(outcome.status!=='fulfilled'||!outcome.value?.ok)continue;
  let data;try{data=await outcome.value.json()}catch{continue}
  availableSources++;
  if(data.topic&&!topic){topic=data.topic;sourceURL=data.sourceURL}
  for(const item of data.items||[]){
   const v=canonical(item);
   if(v&&!seen.has(v.id)){seen.add(v.id);items.push(v)}
   if(items.length===18)break;
  }
 }
 const matched=relevantIndexedItems(items,query,{max:18});
 const data={items:matched,kind:'reels',query,topic,sourceURL,searchUrl,diagnostics:{indexedCandidates:items.length,matched:matched.length,availableSources},
  indexedSearchUrl:'https://www.google.com/search?q='+encodeURIComponent('site:instagram.com/reel/ '+query),
  matchType:'public-index',notice:matched.length?
   'Matching publicly indexed Reel links. These are not Instagram live search results; open a Reel to confirm it is still available.':
   items.length?'Public search returned '+items.length+' Reel link(s), but none could be matched reliably to your keywords. Try a shorter topic or open Instagram search.':availableSources?'Public indexes returned no Reel links for this search. Try a different phrase or open Instagram search.':'Public search providers could not be reached. Open Instagram search for live results.'};
 if(cache.size>100)cache.clear();
 cache.set(key,{time:now(),data});
 return Response.json(data,{headers:{'cache-control':'no-store'}});
}
