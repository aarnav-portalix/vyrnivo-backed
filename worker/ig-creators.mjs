import {relevantIndexedItems,nativeInstagramSearchUrl} from './search-quality.mjs';
/**
 * Public, keyless Instagram creator discovery from search-engine index results.
 * Does NOT access private Instagram APIs and never marks a profile as verified.
 */
const reserved=new Set(['reel','reels','p','tv','stories','explore','accounts','about','developer',
 'api','direct','login','legal','privacy','help','popular','tags','challenge','directory',
 'web','create','oauth','emails','static','graphql','business','nametag']);
const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<')
 .replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
 .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
export function canonicalInstagramProfile(raw){
 try{
  const url=new URL(decode(raw.trim()));
  if(url.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(url.hostname)||url.username||url.password)return null;
  const match=url.pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?$/);
  if(!match||reserved.has(match[1].toLowerCase())||match[1].startsWith('.')||match[1].endsWith('.')||match[1].includes('..'))return null;
  const username=match[1];
  return {id:username.toLowerCase(),username,kind:'creator',url:'https://www.instagram.com/'+username+'/'};
 }catch{return null}
}
const strip=s=>decode(String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
export function parseIndexedInstagramProfiles(xml){
 const out=[],seen=new Set();
 for(const entry of String(xml||'').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const link=entry[1].match(/<link>([\s\S]*?)<\/link>/i)?.[1]||'';
  const profile=canonicalInstagramProfile(link);
  if(!profile||seen.has(profile.id))continue;
  seen.add(profile.id);
  const title=strip(entry[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'');
  out.push({...profile,title:title.slice(0,140)||'@'+profile.username,
    creator:'@'+profile.username,source:'Publicly indexed profile',verified:false});
  if(out.length===24)break;
 }
 return out;
}
const cache=new Map();
export async function searchInstagramCreators(request,{fetchImpl=fetch,now=Date.now,base=null}={}){
 const query=(new URL(request.url).searchParams.get('q')||'').trim();
 if(query.length<2||query.length>100)return Response.json({error:'Enter 2–100 characters.'},{status:400});
 const key=query.toLowerCase()+'|'+String(base||'');
 const old=cache.get(key);
 if(old&&now()-old.at<(old.data.items.length?300000:60000))return Response.json(old.data);
 const u=new URL('https://www.bing.com/search');
 u.searchParams.set('q','site:instagram.com/ '+query+' instagram creator');
 u.searchParams.set('format','rss');
 const indexedSearchUrl='https://www.google.com/search?q='+encodeURIComponent('site:instagram.com/ '+query);
 const fallback=nativeInstagramSearchUrl(query);
 const tasks=[
  fetchImpl(u.href,{redirect:'error',headers:{Accept:'application/rss+xml,application/xml'},signal:AbortSignal.timeout(9000)})
   .then(async r=>r.ok?parseIndexedInstagramProfiles((await r.text()).slice(0,1_500_000)):[])
   .catch(()=>[])
 ];
 if(base){
  tasks.push((async()=>{
   const address=new URL('/search',base);
   if(address.protocol!=='https:')return [];
   address.searchParams.set('q','site:instagram.com/ '+query+' creator');
   address.searchParams.set('format','json');
   const response=await fetchImpl(address.href,{redirect:'error',signal:AbortSignal.timeout(9000)});
   if(!response.ok)return [];
   const data=await response.json(),items=[];
   for(const value of (data.results||[]).slice(0,50)){
    const profile=canonicalInstagramProfile(value.url);
    if(profile)items.push({...profile,title:String(value.title||'@'+profile.username).slice(0,140),
     creator:'@'+profile.username,source:'Publicly indexed profile',verified:false});
   }
   return items;
  })().catch(()=>[]));
 }
 const settled=await Promise.all(tasks),items=[],seen=new Set();
 for(const group of settled)for(const item of group){
  if(!seen.has(item.id)){seen.add(item.id);items.push(item)}
  if(items.length>=24)break;
 }
 // Search for related creators, not an exact-handle lookup.
 const matched=relevantIndexedItems(items,query,{max:24});
 const data={items:matched,kind:'creators',query,searchUrl:fallback,indexedSearchUrl,
  notice:matched.length?
   'Matching public index profiles, not live Instagram account verification. Open Instagram to confirm the creator.':
   'No related creator profiles were found in public indexes. Try a broader topic or search on Instagram.'};
 if(cache.size>120)cache.clear();cache.set(key,{data,at:now()});
 return Response.json(data,{headers:{'cache-control':'no-store'}});
}
