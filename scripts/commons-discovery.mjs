// Check whether Commons exposes a reusable authorized-media search for public YouTube IDs.
// No download restrictions are evaded. We only inspect public Wikimedia search metadata.
const ids=['aqz-KE-bpKQ','jNQXAC9IVRw'];
const base='https://commons.wikimedia.org/w/api.php';
for(const id of ids){
 for(const q of ['"' + id + '"','"Big Buck Bunny" filetype:video']){
  if(id!=='aqz-KE-bpKQ'&&q.includes('Bunny'))continue;
  const params=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrsearch:q,gsrnamespace:'6',gsrlimit:'5',prop:'imageinfo',iiprop:'url|mime|size'});
  try{
   const r=await fetch(base+'?'+params,{signal:AbortSignal.timeout(12000)});
   const data=await r.json();
   const candidates=Object.values(data?.query?.pages||{}).map(x=>({title:x.title,mime:x.imageinfo?.[0]?.mime,bytes:x.imageinfo?.[0]?.size,host:x.imageinfo?.[0]?.url?new URL(x.imageinfo[0].url).hostname:null})).slice(0,5);
   console.log('COMMONS_SEARCH_CHECK',JSON.stringify({id,query:q,status:r.status,candidates}));
  }catch(e){console.log('COMMONS_SEARCH_CHECK',JSON.stringify({id,query:q,error:String(e).slice(0,160)}))}
 }
}
// Is a direct-media API source universally discoverable from YouTube ID?
console.log('COMMONS_DISCOVERY_NOTE','A YouTube ID on its own does not establish that a separately hosted copy exists or has the same duration or license.');
