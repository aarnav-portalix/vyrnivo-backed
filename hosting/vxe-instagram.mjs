import {createWriteStream} from 'node:fs';
import {stat,unlink} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Readable,Transform} from 'node:stream';
import {join} from 'node:path';

const MAX_BYTES=200*1024*1024;
const htmlEntities=s=>s.replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&quot;/g,'"');
export function extractPublicVideo(html){
 const tags=String(html).match(/<meta\s+[^>]*>/gi)||[];
 for(const tag of tags){
  const attrs=Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(m=>[m[1].toLowerCase(),htmlEntities(m[3])]));
  if(['og:video','og:video:url','og:video:secure_url','twitter:player:stream'].includes(attrs.property||attrs.name))
   return attrs.content||null;
 }
 return null;
}
function allowedMediaUrl(raw){
 const u=new URL(raw);
 if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('VXE refused an unsafe media URL.');
 const h=u.hostname.toLowerCase();
 if(!(h==='cdninstagram.com'||h.endsWith('.cdninstagram.com')||h==='fbcdn.net'||h.endsWith('.fbcdn.net')||h==='instagram.com'||h.endsWith('.instagram.com')))
  throw Error('VXE refused an untrusted media host.');
 return u.href;
}
async function request(url,fetchImpl,signal){
 const response=await fetchImpl(url,{redirect:'manual',signal,headers:{'user-agent':'Mozilla/5.0 (compatible; Vyrnivo/1.0)','accept':'text/html,video/mp4;q=0.9,*/*;q=0.1'}});
 if([301,302,303,307,308].includes(response.status))return response;
 return response;
}
export async function downloadPublicInstagram(input,dir,{fetchImpl=fetch}={}){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
 let output;
 try{
  const page=await request(input.url,fetchImpl,controller.signal);
  if(!page.ok)throw Error('VXE could not access the public Instagram page.');
  if(Number(page.headers.get('content-length'))>1024*1024)throw Error('VXE page is too large.');
  const html=(await page.text()).slice(0,1024*1024);
  const candidate=extractPublicVideo(html);
  if(!candidate)throw Error('VXE found no publicly exposed video stream.');
  let url=allowedMediaUrl(candidate),response;
  for(let i=0;i<4;i++){
   response=await request(url,fetchImpl,controller.signal);
   if(![301,302,303,307,308].includes(response.status))break;
   url=allowedMediaUrl(new URL(response.headers.get('location'),url).href);
  }
  if(!response.ok||!response.body)throw Error('VXE media was unavailable.');
  if(!/^(video\/|application\/octet-stream)/i.test(response.headers.get('content-type')||''))throw Error('VXE did not receive a video.');
  if(Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('VXE media exceeds the size limit.');
  output=join(dir,'media.mp4');let bytes=0;
  const limit=new Transform({transform(chunk,enc,callback){bytes+=chunk.length;callback(bytes>MAX_BYTES?Error('VXE media exceeds the size limit.'):null,chunk)}});
  await pipeline(Readable.fromWeb(response.body),limit,createWriteStream(output,{flags:'wx',mode:0o600}));
  if((await stat(output)).size<1024)throw Error('VXE received an empty video.');
  return {path:output,name:'media.mp4',bytes,sourceTitle:null};
 }catch(error){if(output)await unlink(output).catch(()=>{});throw error}
 finally{clearTimeout(timeout)}
}
