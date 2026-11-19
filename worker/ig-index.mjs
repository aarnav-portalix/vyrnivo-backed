// Keyless, best-effort search of publicly indexed Instagram Reel pages.
// This never claims access to Instagram's private search API.
const cache=new Map();
const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
const getReel=url=>{try{const u=new URL(decode(url.trim()));const id=u.pathname.match(/^\/(?:reel|reels)\/([A-Za-z0-9_-]{6,30})\/?$/)?.[1];return u.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(u.hostname)&&id?{id,url:'https://www.instagram.com/reel/'+id+'/'}:null}catch{return null}};
export function parseIndexRss(xml){
 const items=[],seen=new Set();
 for(const entry of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const link=entry[1].match(/<link>([\s\S]*?)<\/link>/i)?.[1]||'';
  const embedded=entry[1].match(/https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels)\/[A-Za-z0-9_-]{6,30}\/?/i)?.[0];
  const m=getReel(link)||getReel(embedded||'');
  if(!m||seen.has(m.id))continue;
  seen.add(m.id);
  const raw=entry[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'Indexed public Reel';
  const excerpt=entry[1].match(/<description>([\s\S]*?)<\/description>/i)?.[1]||'';
  const strip=x=>decode(x.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
  items.push({...m,kind:'instagram',title:strip(raw).slice(0,180),description:strip(excerpt).slice(0,350),creator:'Public Reel',source:'Indexed search result'});
  if(items.length===12)break;
 }
 return items;
}
export async function indexedInstagram(request,{fetcher=fetch,now=Date.now}={}){
 const q=(new URL(request.url).searchParams.get('q')||'').trim();
 if(q.length<2||q.length>100)return Response.json({error:'Enter a topic between 2 and 100 characters.'},{status:400});
 const key=q.toLowerCase();
 const old=cache.get(key);if(old&&now()-old.time<120000)return Response.json(old.data);
 // Search hashtags as hashtags as well as words; Bing's index treats the two differently.
 const normalized=q.replace(/^#/,'').trim();
 const terms=[normalized,'"'+normalized+'"',...(q.startsWith('#')?['#'+normalized]:[])];
 const queries=[...new Set(terms.filter(Boolean).map(term=>'site:instagram.com/reel/ '+term))];
 const responses=await Promise.allSettled(queries.map(async term=>{
  const u=new URL('https://www.bing.com/search');
  u.searchParams.set('q',term);
  u.searchParams.set('format','rss');
  const r=await fetcher(u.href,{redirect:'error',headers:{Accept:'application/rss+xml,application/xml'},signal:AbortSignal.timeout(6500)});
  if(!r.ok)return [];
  return parseIndexRss((await r.text()).slice(0,1_500_000));
 }));
 const seen=new Set(),items=[];
 for(const response of responses){
  if(response.status!=='fulfilled')continue;
  for(const item of response.value){
   if(seen.has(item.id))continue;
   seen.add(item.id);items.push(item);
  }
 }
 const data={items:items.slice(0,24),query:q,notice:items.length?'Publicly indexed Reels; availability may vary.':'No publicly indexed Reel matches found.'};
 if(cache.size>120)cache.clear();
 cache.set(key,{time:now(),data});
 return Response.json(data);
}