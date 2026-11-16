/**
 * Find separately hosted, freely licensed video files that mention an exact
 * YouTube ID on Wikimedia Commons. A search result is NOT proof that a file
 * is the identical or complete YouTube video. Caller must show provenance
 * and obtain an explicit user selection before converting.
 */
import {isYoutubeLink} from './licensed-youtube.mjs';

const API='https://commons.wikimedia.org/w/api.php';
const VIDEO_EXT=/\.(?:webm|ogv|ogg|mp4)$/i;
const MAX_BYTES=30*1024*1024;
const USER_AGENT='VyrnivoLicensedMediaDiscovery/1.0 (read-only Commons API)';
const REQUEST_TIMEOUT=14000;
const APPROVED_LICENSE=/^https:\/\/creativecommons\.org\/(?:licenses\/by\/(?:3\.0|4\.0)|publicdomain\/zero\/1\.0)\/?$/i;

export function youtubeVideoId(raw){
 if(typeof raw!=='string'||raw.length>1900||!isYoutubeLink(raw))throw Error('Paste a valid public YouTube video link.');
 const u=new URL(raw);
 if(u.username||u.password||u.port)throw Error('Use a normal HTTPS YouTube video link.');
 const host=u.hostname.toLowerCase();
 let id;
 if(host==='youtu.be'||host==='www.youtu.be')id=u.pathname.replace(/^\/|\/$/g,'');
 else if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
 else id=u.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})\/?$/)?.[1]||'';
 if(!/^[\w-]{11}$/.test(id))throw Error('Paste a single YouTube video link.');
 return id;
}

async function query(params,fetchImpl){
 const u=new URL(API);
 for(const [k,v]of Object.entries({format:'json',...params}))u.searchParams.set(k,String(v));
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),REQUEST_TIMEOUT);
 try{
  const r=await fetchImpl(u.href,{headers:{Accept:'application/json','User-Agent':USER_AGENT},redirect:'error',signal:ctrl.signal});
  if(!r.ok)throw Error('The Commons catalogue is temporarily unavailable.');
  const d=await r.json();
  if(d.error)throw Error('The Commons catalogue rejected the search.');
  return d;
 }catch(e){
  if(e?.name==='AbortError')throw Error('The Commons catalogue timed out.');
  throw e;
 }finally{clearTimeout(timer)}
}
function safeCandidate(page){
 const ii=page?.imageinfo?.[0];if(!ii)return null;
 const pageTitle=String(page.title||'');
 const url=String(ii.url||'');
 let parsed;try{parsed=new URL(url)}catch{return null}
 if(parsed.protocol!=='https:'||parsed.hostname!=='upload.wikimedia.org'||parsed.username||parsed.password||parsed.port||!VIDEO_EXT.test(parsed.pathname))return null;
 const size=Number(ii.size),mime=String(ii.mime||'').toLowerCase();
 if(!Number.isSafeInteger(size)||size<128||size>MAX_BYTES)return null;
 if(!['video/webm','video/mp4','video/ogg','application/ogg'].includes(mime))return null;
 const meta=ii.extmetadata||{};
 const license=String(meta.LicenseShortName?.value||'');
 const licenseUrl=String(meta.LicenseUrl?.value||'');
 if(!APPROVED_LICENSE.test(licenseUrl))return null;
 if(!/^File:/i.test(pageTitle))return null;
 const sourcePage='https://commons.wikimedia.org/wiki/'+encodeURIComponent(pageTitle.replace(/ /g,'_'));
 return {
  title:pageTitle.replace(/^File:/i,'').slice(0,180),
  mediaUrl:parsed.href,sourcePage,mime,size,license:license.slice(0,60),licenseUrl,
  attribution:'See the Wikimedia Commons file page for creator credit and any required attribution.',
  description:'Independently hosted, freely licensed video that mentions this YouTube ID. It may be a clip, edit or different version; it is not a download from YouTube.',
  alternateVersion:true
 };
}
export async function findCommonsAlternatives(youtubeUrl,{fetchImpl=fetch}={}){
 const videoId=youtubeVideoId(youtubeUrl);
 const found=await query({action:'query',list:'search',srnamespace:6,srsearch:'"'+videoId+'"',srlimit:35},fetchImpl);
 const titles=[...new Set((found.query?.search||[]).map(x=>x.title).filter(x=>/^File:/.test(x)))].slice(0,35);
 if(!titles.length)return {videoId,candidates:[]};
 const meta=await query({action:'query',prop:'imageinfo',iiprop:'url|size|mime|extmetadata',titles:titles.join('|')},fetchImpl);
 const pages=Object.values(meta.query?.pages||{});
 const titleSet=new Set(titles);
 const candidates=pages.filter(page=>titleSet.has(page.title)).map(safeCandidate).filter(Boolean).slice(0,12);
 return {videoId,candidates};
}
