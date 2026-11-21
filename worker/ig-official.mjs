// Authorized Instagram hashtag discovery. Requires a Meta professional account,
// approved public-content permissions and server-side credentials.
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
export async function officialInstagramSearch(request,{accountId,token,fetchImpl=fetch,version='v24.0'}={}){
 const query=(new URL(request.url).searchParams.get('q')||'').trim();
 if(!accountId||!token)return null;
 const hashtag=query.replace(/^#/,'').trim();
 if(!/^[\p{L}\p{N}_]{2,80}$/u.test(hashtag)||hashtag.includes(' '))return null;
 const call=async(path,params)=>{
  const u=new URL('https://graph.facebook.com/'+version+'/'+path);
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  u.searchParams.set('access_token',token);
  const response=await fetchImpl(u.href,{redirect:'error',signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error('META_API_UNAVAILABLE');
  return response.json();
 };
 try{
  const found=await call('ig_hashtag_search',{user_id:accountId,q:hashtag});
  const id=found.data?.[0]?.id;
  if(!id)return json({items:[],kind:'reels',query,source:'instagram-api',notice:'Instagram returned no matching hashtag.'});
  const data=await call(id+'/recent_media',{user_id:accountId,fields:'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,username,timestamp',limit:'40'});
  const seen=new Set(),items=[];
  for(const media of data.data||[]){
   if(media.media_product_type!=='REELS'||typeof media.permalink!=='string')continue;
   let url;try{url=new URL(media.permalink)}catch{continue}
   const code=url.pathname.match(/^\/(?:reel|reels)\/([A-Za-z0-9_-]{6,30})\/?$/)?.[1];
   if(!code||!['instagram.com','www.instagram.com'].includes(url.hostname)||seen.has(code))continue;
   seen.add(code);
   items.push({id:code,kind:'instagram',title:String(media.caption||'Instagram Reel').slice(0,180),
    creator:media.username?'@'+media.username:'Instagram',description:String(media.caption||'').slice(0,350),
    thumbnail:media.thumbnail_url||undefined,source:'Instagram API',url:'https://www.instagram.com/reel/'+code+'/'});
   if(items.length>=18)break;
  }
  return json({items,kind:'reels',query,source:'instagram-api',notice:'Public Reels returned by the authorized Instagram hashtag API.'});
 }catch{
  return json({items:[],kind:'reels',query,source:'instagram-api',error:'Instagram API could not complete this hashtag search. Check permissions, token and account configuration.'},502);
 }
}
