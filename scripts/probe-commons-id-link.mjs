// Test exact YouTube-ID association on Wikimedia Commons.
const vids=['aqz-KE-bpKQ','jNQXAC9IVRw','BaW_jenozKc'];
const base='https://commons.wikimedia.org/w/api.php';
for(const video of vids){
 const url=new URL(base);
 url.searchParams.set('action','query');
 url.searchParams.set('list','search');
 url.searchParams.set('srnamespace','6');
 url.searchParams.set('srsearch','"'+video+'"');
 url.searchParams.set('srlimit','10');
 url.searchParams.set('format','json');
 try {
  const r=await fetch(url,{signal:AbortSignal.timeout(14000),headers:{'User-Agent':'VyrnivoLicenseProbe/0.1 (public-license-matching; example.org)',Accept:'application/json'}});
  const body=await r.text();
  let parsed=null;try{parsed=JSON.parse(body)}catch{}
  const matches=parsed?.query?.search||[];
  console.log('WIKIMEDIA_ID_MATCH',JSON.stringify({video,status:r.status,ct:r.headers.get('content-type'),found:matches.length,titles:matches.map(x=>x.title).slice(0,8),apiError:parsed?.error?.code||null,responseType:parsed?'json':body.slice(0,60)}));
 } catch(e){console.log('WIKIMEDIA_ID_MATCH',JSON.stringify({video,error:String(e).slice(0,150)}))}
}
for(const raw of ['File:Big Buck Bunny extract.ogv','File:Big Buck Bunny small.ogv']){
 const url=new URL(base);for(const [k,v] of Object.entries({action:'query',prop:'imageinfo',iiprop:'url|size|mime|extmetadata',titles:raw,format:'json'}))url.searchParams.set(k,v);
 try{
 const r=await fetch(url,{signal:AbortSignal.timeout(14000),headers:{'User-Agent':'VyrnivoLicenseProbe/0.1 (public-license-matching; example.org)',Accept:'application/json'}});
 const d=await r.json(),pages=Object.values(d.query?.pages||{});const x=pages[0]||{},ii=x.imageinfo?.[0]||{};
 console.log('WIKIMEDIA_FILE_METADATA',JSON.stringify({title:raw,status:r.status,missing:!!x.missing,mime:ii.mime,size:ii.size,license:ii.extmetadata?.LicenseShortName?.value,licenseUrl:ii.extmetadata?.LicenseUrl?.value,urlHost:ii.url?new URL(ii.url).hostname:null}));
 }catch(e){console.log('WIKIMEDIA_FILE_METADATA',JSON.stringify({title:raw,error:String(e).slice(0,180)}))}
}
