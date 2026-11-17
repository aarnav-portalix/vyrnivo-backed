/**
 * Public YouTube search with separate content types.
 * No credentials, no account data, no bypassing source access limits.
 * Parsed results are navigational links; they are NOT download guarantees.
 */
import {officialYouTubeSearch} from './youtube-official.mjs';
const cache=new Map();
export const YOUTUBE_TYPES=Object.freeze({
 all:'',videos:'EgIQAQ==',shorts:'EgIQCQ==',channels:'EgIQAg==',playlists:'EgIQAw=='
});
const plain=x=>String(x?.simpleText||x?.runs?.map(r=>r.text||'').join('')||x?.content||'').trim().slice(0,180);
const validVideoId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{11}$/.test(x);
const validChannelId=x=>typeof x==='string'&&/^UC[a-zA-Z0-9_-]{22}$/.test(x);
const validPlaylist=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{10,80}$/.test(x);
const allowedThumb=raw=>{
 try{
  const u=new URL(raw);
  return u.protocol==='https:'&&(
   u.hostname==='i.ytimg.com'||u.hostname==='yt3.ggpht.com'||
   u.hostname==='yt3.googleusercontent.com'||u.hostname==='i9.ytimg.com'
  )?u.href:null;
 }catch{return null}
};
const picture=(raw,id,channel=false)=>{
 const list=raw?.thumbnails||raw?.sources||raw?.image?.sources||[];
 const url=Array.isArray(list)?allowedThumb(list.at(-1)?.url):null;
 return url||(!channel&&validVideoId(id)?'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg':null);
};
export function extractYouTubeSearchData(html){
 const source=String(html||'');
 for(const marker of ['var ytInitialData = ','ytInitialData = ','window["ytInitialData"] = ','window.ytInitialData = ']){
  const start=source.indexOf(marker);
  if(start<0)continue;
  const pos=source.indexOf('{',start+marker.length);
  if(pos<0||pos-start>180)continue;
  let quote=false,escape=false,depth=0;
  for(let i=pos;i<Math.min(source.length,pos+4_000_000);i++){
   const c=source[i];
   if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue}
   if(c==='"'){quote=true;continue}
   if(c==='{')depth++;
   if(c==='}'&&--depth===0){
    try{return JSON.parse(source.slice(pos,i+1))}catch{break}
   }
  }
 }
 return null;
}
export function parseYouTubeItems(data,kind='all'){
 const all=[],seen=new Set();let visited=0;
 // Read actual search-results containers only, not recommendations elsewhere
 // in the page's hydrated JSON tree.
 const root=data?.contents?.twoColumnSearchResultsRenderer?.primaryContents||
  data?.contents?.sectionListRenderer||data?.contents?.richGridRenderer||
  (Array.isArray(data?.contents)?data.contents:null);
 if(!root)return [];
 const add=item=>{
  if(!item?.url||!item.id||seen.has(item.kind+':'+item.id))return;
  seen.add(item.kind+':'+item.id);
  all.push(item);
 };
 const visit=obj=>{
  if(!obj||typeof obj!=='object'||++visited>20000)return;
  if(Array.isArray(obj)){for(const x of obj)visit(x);return}
  const v=obj.videoRenderer;
  if(v&&validVideoId(v.videoId)){
   const url=String(v.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url||'');
   const isShort=url.startsWith('/shorts/')||Boolean(v.navigationEndpoint?.reelWatchEndpoint);
   const k=isShort?'short':'video';
   add({id:v.videoId,kind:k,url:k==='short'?'https://www.youtube.com/shorts/'+v.videoId:'https://www.youtube.com/watch?v='+v.videoId,
    title:plain(v.title)||'YouTube video',creator:plain(v.ownerText)||plain(v.longBylineText),
    duration:plain(v.lengthText),views:plain(v.viewCountText),published:plain(v.publishedTimeText),
    thumbnail:picture(v.thumbnail,v.videoId),source:'YouTube search'});
  }
  const ch=obj.channelRenderer;
  if(ch&&validChannelId(ch.channelId)){
   add({id:ch.channelId,kind:'channel',title:plain(ch.title)||'YouTube channel',
    creator:plain(ch.subscriberCountText)||plain(ch.videoCountText),
    url:'https://www.youtube.com/channel/'+ch.channelId,
    thumbnail:picture(ch.thumbnail,null,true),source:'YouTube search'});
  }
  const pl=obj.playlistRenderer;
  if(pl&&validPlaylist(pl.playlistId)){
   add({id:pl.playlistId,kind:'playlist',title:plain(pl.title)||'YouTube playlist',
    creator:plain(pl.longBylineText)||plain(pl.shortBylineText),
    url:'https://www.youtube.com/playlist?list='+encodeURIComponent(pl.playlistId),
    thumbnail:picture(pl.thumbnails?.[0]?.thumbnails||pl.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail,null,true),
    source:'YouTube search'});
  }
  const reel=obj.reelItemRenderer;
  if(reel&&validVideoId(reel.videoId)){
   add({id:reel.videoId,kind:'short',title:plain(reel.headline)||plain(reel.title)||'YouTube Short',
    creator:plain(reel.viewCountText),url:'https://www.youtube.com/shorts/'+reel.videoId,
    thumbnail:picture(reel.thumbnail,reel.videoId),source:'YouTube search'});
  }
  const sh=obj.shortsLockupViewModel;
  if(sh){
   const id=sh.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId||
    sh.onTap?.reelWatchEndpoint?.videoId||sh.contentId;
   if(validVideoId(id))add({id,kind:'short',
    title:plain(sh.overlayMetadata?.primaryText)||plain(sh.accessibilityText)||'YouTube Short',
    creator:plain(sh.overlayMetadata?.secondaryText),
    url:'https://www.youtube.com/shorts/'+id,
    thumbnail:picture(sh.thumbnail,id),source:'YouTube search'});
  }
  const lock=obj.lockupViewModel;
  if(lock?.contentType==='LOCKUP_CONTENT_TYPE_PLAYLIST'&&validPlaylist(lock.contentId)){
   const id=lock.contentId;
   add({id,kind:'playlist',url:'https://www.youtube.com/playlist?list='+encodeURIComponent(id),
    title:plain(lock.metadata?.lockupMetadataViewModel?.title)||'YouTube playlist',
    creator:plain(lock.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text),
    thumbnail:picture(lock.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image,null,true),
    source:'YouTube search'});
  }
  if(lock&&validVideoId(lock.contentId)&&lock.contentType==='LOCKUP_CONTENT_TYPE_VIDEO'){
   const id=lock.contentId;
   add({id,kind:'video',url:'https://www.youtube.com/watch?v='+id,
    title:plain(lock.metadata?.lockupMetadataViewModel?.title)||'YouTube video',
    creator:plain(lock.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text),
    thumbnail:picture(lock.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image,id),
    source:'YouTube search'});
  }
  for(const value of Object.values(obj))visit(value);
 };
 visit(root);
 const accepted=kind==='shorts'?['short']:kind==='channels'?['channel']:kind==='playlists'?['playlist']:kind==='videos'?['video']:['video','short','channel','playlist'];
 return all.filter(item=>accepted.includes(item.kind)).slice(0,30);
}
function directYouTubeLink(query){
 try{
  const u=new URL(query);
  if(u.protocol!=='https:'||u.username||u.password)return null;
  const host=u.hostname.replace(/^www\./,'');
  let id=null,short=false;
  if(host==='youtu.be')id=u.pathname.split('/').filter(Boolean)[0];
  if(['youtube.com','m.youtube.com','music.youtube.com'].includes(host)){
   if(u.pathname==='/watch')id=u.searchParams.get('v');
   else{
    const match=u.pathname.match(/^\/(shorts|live)\/([A-Za-z0-9_-]{11})\/?$/);
    if(match){id=match[2];short=match[1]==='shorts'}
   }
  }
  if(!validVideoId(id))return null;
  return {id,kind:short?'short':'video',
   url:short?'https://www.youtube.com/shorts/'+id:'https://www.youtube.com/watch?v='+id,
   title:short?'YouTube Short '+id:'YouTube video '+id,creator:'Direct link',source:'User-provided link',
   thumbnail:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',matchType:'direct-link'};
 }catch{return null}
}
export async function search(request,{fetchImpl=fetch,now=Date.now,apiKey=null}={}){
 const url=new URL(request.url);
 const query=(url.searchParams.get('q')||'').trim();
 const kind=url.searchParams.get('kind')||'all';
 const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
 if(query.length<2||query.length>240)return json({error:'Enter 2–240 characters or a public YouTube link.'},400);
 if(!(kind in YOUTUBE_TYPES))return json({error:'Choose a supported search type.'},400);
 const destination=new URL('https://www.youtube.com/results');
 destination.searchParams.set('search_query',query);
 if(YOUTUBE_TYPES[kind])destination.searchParams.set('sp',YOUTUBE_TYPES[kind]);
 const direct=directYouTubeLink(query);
 if(direct){
  const items=(kind==='all'||kind==='videos'&&direct.kind==='video'||kind==='shorts'&&direct.kind==='short')?[direct]:[];
  return json({items,query,kind,searchUrl:direct.url,matchType:'direct-link',
   notice:items.length?'Exact YouTube link entered. Playback and download availability are controlled by YouTube.':
    'The supplied link does not match this result filter. Change to All or Videos.'});
 }
 const cacheKey=(apiKey?'official|':'public|')+kind+'|'+query.toLowerCase();
 const hit=cache.get(cacheKey);
 if(hit&&now()-hit.time<(hit.data.items.length?90000:18000))return json(hit.data);
 if(apiKey&&kind!=='shorts'){
  const official=await officialYouTubeSearch({query,kind,apiKey,fetchImpl});
  if(official){
   const data={items:official.items,query,kind,searchUrl:destination.href,
    matchType:'official-search',source:'YouTube API',
    notice:official.items.length?'Matching YouTube search listings. Results can differ from your personalized YouTube search.':
     'No public results matched this filter. Open YouTube to search with your own account settings.'};
   if(cache.size>140)cache.clear();cache.set(cacheKey,{data,time:now()});
   return json(data);
  }
 }
 try{
  const r=await fetchImpl(destination.href,{redirect:'error',signal:AbortSignal.timeout(11000),
   headers:{Accept:'text/html'}});
  if(!r.ok)throw Error('source-unavailable');
  const html=(await r.text()).slice(0,4_000_000);
  const raw=extractYouTubeSearchData(html);
  if(!raw)throw Error('source-unavailable');
  const items=parseYouTubeItems(raw,kind);
  const data={items,query,kind,source:'YouTube public search page',
   searchUrl:destination.href,matchType:'public-page',
   notice:items.length?'Public YouTube results. Your own YouTube search may differ by account, region or availability.':
    'No trustworthy matching results were returned. Open YouTube to see its native search results.'};
  if(cache.size>140)cache.clear();cache.set(cacheKey,{data,time:now()});
  return json(data);
 }catch{
  return json({items:[],query,kind,searchUrl:destination.href,matchType:'unavailable',
   notice:'YouTube results could not be fetched right now. Open this exact search directly on YouTube.'});
 }
}
