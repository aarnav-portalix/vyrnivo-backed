/**
 * Display-only download names. Internal job files remain media.<ext>.
 * Never pass a title, filename or other user content to a filesystem path.
 */
const BAD_CHARS=/[<>:"/\\|?*\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g;
const ALLOWED_EXT=new Set(['mp4','webm','mkv','mp3','m4a','wav','ogg','opus','mov','aac','flac','weba','oga','mka','aiff','m4b','m4r','ape','ac3','mp2','wma']);
const MAX_TITLE=82;

export function safeMediaTitle(raw){
 if(typeof raw!=='string')return '';
 const normalized=raw.normalize('NFKC').replace(BAD_CHARS,' ')
  .replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim()
  .replace(/^[.\-\s]+|[.\-\s]+$/g,'');
 const chars=Array.from(normalized).slice(0,MAX_TITLE).join('').trim().replace(/[.\s]+$/g,'');
 return chars==='.'||chars==='..'?'':chars;
}

export function fallbackMediaTitle(rawUrl){
 try{
  const url=new URL(rawUrl);
  const host=url.hostname.replace(/^www\./,'');
  if(host==='youtu.be'||host.endsWith('youtube.com')||host==='youtube-nocookie.com'){
   const id=host==='youtu.be'?url.pathname.split('/')[1]:
    url.searchParams.get('v')||url.pathname.split('/').filter(Boolean).at(-1);
   return /^[\w-]{11}$/.test(id||'')?'YouTube-'+id:'YouTube-video';
  }
  if(host==='instagram.com'){
   const parts=url.pathname.split('/').filter(Boolean);
   const id=parts[1];
   return /^[\w-]{6,30}$/.test(id||'')?
    'Instagram-'+(parts[0]==='reel'?'Reel':'Post')+'-'+id:'Instagram-video';
  }
 }catch{}
 return 'Video';
}

export function actualMediaExtension(storageName){
 const m=String(storageName||'').match(/^media\.([a-z0-9]{2,5})$/i);
 return m&&ALLOWED_EXT.has(m[1].toLowerCase())?m[1].toLowerCase():null;
}

export function displayDownloadName({title,url,mode,quality,storageName}){
 const ext=actualMediaExtension(storageName);
 if(!ext)throw Error('Unsupported output file extension');
 const label=safeMediaTitle(title)||fallbackMediaTitle(url);
 const format=ext.toUpperCase();
 const isAudio=mode==='Audio only';
 const qualityLabel=isAudio?'Audio':
  quality==='Best available'?'Best':
  /^\d{3,4}p/.test(quality||'')?String(quality).match(/^\d{3,4}p/)[0]:'Video';
 const modeLabel=mode==='Video only'?'-VideoOnly':'';
 return 'vyrnivo-'+label+'-'+qualityLabel+modeLabel+'-'+format+'.'+ext;
}

export function contentDisposition(name){
 // RFC 6266 / RFC 5987: ASCII fallback plus correctly encoded UTF-8 names.
 const value=String(name||'vyrnivo-download.mp4');
 const ascii=value.normalize('NFKD').replace(/[^\x20-\x7e]/g,'')
  .replace(/["\\;\r\n]/g,'_').slice(0,190)||'vyrnivo-download.mp4';
 const encoded=encodeURIComponent(value).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
 return 'attachment; filename="'+ascii+'"; filename*=UTF-8\'\''+encoded;
}

export function titleFromExtractorLog(log){
 const matches=[...String(log||'').matchAll(/(?:^|\n)VYRNIVO_MEDIA_TITLE:([^\r\n]*)/g)];
 return safeMediaTitle(matches.at(-1)?.[1]||'');
}

export function titleFromContentDisposition(value){
 const raw=String(value||'');
 const encoded=raw.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
 if(encoded){
  try{return safeMediaTitle(decodeURIComponent(encoded))}catch{}
 }
 const quoted=raw.match(/filename\s*=\s*"([^"]+)"/i)?.[1];
 const plain=raw.match(/filename\s*=\s*([^;]+)/i)?.[1];
 const name=(quoted||plain||'').trim().replace(/\.[a-z0-9]{2,5}$/i,'');
 if(/^media$|^download$|^video$/i.test(name))return '';
 return safeMediaTitle(name);
}

export async function lookupPublicTitle(rawUrl,{fetchImpl=fetch,timeoutMs=2200}={}){
 try{
  const url=new URL(rawUrl);
  const host=url.hostname.replace(/^www\./,'');
  if(!['youtube.com','m.youtube.com','music.youtube.com','youtu.be'].includes(host))return null;
  const oembed=new URL('https://www.youtube.com/oembed');
  oembed.searchParams.set('url',url.toString());
  oembed.searchParams.set('format','json');
  const response=await fetchImpl(oembed,{redirect:'error',
   headers:{accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)return null;
  const type=String(response.headers.get('content-type')||'');
  if(!/json/i.test(type))return null;
  const data=await response.json();
  return safeMediaTitle(data?.title)||null;
 }catch{return null}
}
