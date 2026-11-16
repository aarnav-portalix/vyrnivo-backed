// Keyless, best-effort search of publicly indexed Instagram Reel pages.
// This never claims access to Instagram's private search API.
const cache=new Map();
const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
const getReel=url=>{try{const u=new URL(decode(url.trim()));const id=u.pathname.match(/^\/reel\/([A-Za-z0-9_-]{6,30})\/?$/)?.[1];return u.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(u.hostname)&&id?{id,url:'https://www.instagram.com/reel/'+id+'/'}:null}catch{return null}};
export function parseIndexRss(xml){
 const items=[],seen=new Set();
 for(const entry of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const link=entry[1].match(/<link>([\s\S]*?)<\/link>/i)?.[1]||'';
  const m=getReel(link);
  if(!m||seen.has(m.id))continue;
  seen.add(m.id);
  const raw=entry[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'Indexed public Reel';
  items.push({...m,kind:'instagram',title:decode(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')).slice(0,180),creator:'Public Reel'});
  if(items.length===12)break;
 }
 return items;
}
export async function indexedInstagram(request,{fetcher=fetch,now=Date.now}={}){
 const q=(new URL(request.url).searchParams.get('q')||'').trim();
 if(q.length<2||q.length>100)return Response.json({error:'Enter a topic between 2 and 100 characters.'},{status:400});
 const key=q.toLowerCase();
 const old=cache.get(key);if(old&&now()-old.time<900000)return Response.json(old.data);
 const u=new URL('https://www.bing.com/search');
 u.searchParams.set('q','site:instagram.com/reel/ '+q);
 u.searchParams.set('format','rss');
 try{
  const r=await fetcher(u.href,{redirect:'manual',headers:{Accept:'application/rss+xml,application/xml'},signal:AbortSignal.timeout(8000)});
  if(!r.ok||r.status>=300&&r.status<400)throw Error('Search engine unavailable');
  const xml=(await r.text()).slice(0,1500000);
  const items=parseIndexRss(xml);
  if(!items.length)throw Error('No indexed Reel results');
  const data={items,query:q,notice:'Public search-index results. Some Reels may be unavailable or refuse embeds.'};
  if(cache.size>120)cache.clear();cache.set(key,{time:now(),data});
  return Response.json(data);
 }catch{
  return Response.json({items:[],query:q,notice:'In-app public Reel lookup returned no accessible results. Use the indexed web search link below or paste a specific Reel URL.'});
 }
}