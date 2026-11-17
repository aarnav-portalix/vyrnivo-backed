/**
 * Optional, official search backend. The API key stays server-side.
 * An unset key causes the existing keyless public search to remain in use.
 */
const videoId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id);
const channelId=id=>typeof id==='string'&&/^UC[A-Za-z0-9_-]{22}$/.test(id);
const playlistId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{10,80}$/.test(id);
const entities=s=>String(s||'').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
 .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const truncate=(s,n=180)=>entities(s).trim().slice(0,n);
const thumbOf=snippet=>{
 const url=snippet?.thumbnails?.high?.url||snippet?.thumbnails?.medium?.url||snippet?.thumbnails?.default?.url;
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&['i.ytimg.com','yt3.googleusercontent.com','yt3.ggpht.com','yt3.google.com'].includes(u.hostname)?u.href:null;
 }catch{return null}
};
export function parseYouTubeOfficialItems(data,kind='all'){
 if(!Array.isArray(data?.items))return [];
 const seen=new Set(),out=[];
 for(const x of data.items.slice(0,50)){
  const id=x?.id||{},snippet=x?.snippet||{};
  const label=truncate(snippet.title)||'YouTube result';
  const creator=truncate(snippet.channelTitle,100);
  let item=null;
  if(id.kind==='youtube#video'&&videoId(id.videoId))
   item={kind:'video',id:id.videoId,url:'https://www.youtube.com/watch?v='+id.videoId,
    title:label,creator,thumbnail:thumbOf(snippet)||'https://i.ytimg.com/vi/'+id.videoId+'/hqdefault.jpg'};
  else if(id.kind==='youtube#channel'&&channelId(id.channelId))
   item={kind:'channel',id:id.channelId,url:'https://www.youtube.com/channel/'+id.channelId,
    title:label,creator,thumbnail:thumbOf(snippet)};
  else if(id.kind==='youtube#playlist'&&playlistId(id.playlistId))
   item={kind:'playlist',id:id.playlistId,url:'https://www.youtube.com/playlist?list='+encodeURIComponent(id.playlistId),
    title:label,creator,thumbnail:thumbOf(snippet)};
  if(!item||seen.has(item.kind+item.id))continue;
  if(kind==='videos'&&item.kind!=='video'||kind==='channels'&&item.kind!=='channel'||kind==='playlists'&&item.kind!=='playlist')continue;
  seen.add(item.kind+item.id);out.push({...item,source:'YouTube API search'});
 }
 return out;
}
export async function officialYouTubeSearch({query,kind,apiKey,fetchImpl=fetch}){
 if(typeof apiKey!=='string'||apiKey.length<12||kind==='shorts')return null;
 const type=kind==='videos'?'video':kind==='channels'?'channel':kind==='playlists'?'playlist':'video,channel,playlist';
 const url=new URL('https://www.googleapis.com/youtube/v3/search');
 for(const [k,v] of Object.entries({part:'snippet',q:query,type,maxResults:'30',
  order:'relevance',safeSearch:'moderate',key:apiKey}))url.searchParams.set(k,v);
 try{
  const response=await fetchImpl(url.href,{redirect:'error',headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(10500)});
  if(!response.ok)return null;
  const json=await response.json();
  const items=parseYouTubeOfficialItems(json,kind);
  return {items,source:'official-youtube-api'};
 }catch{return null}
}
