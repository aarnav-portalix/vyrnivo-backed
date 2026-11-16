import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
const port=Number(process.env.VYRNIVO_TEST_PORT||18955),base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['hosting/server.mjs'],{env:{...process.env,DOWNLOADS_ENABLED:'true',PORT:String(port)},stdio:['ignore','pipe','pipe']});
let stderr='';
server.stderr.on('data',d=>stderr=(stderr+d).slice(-1500));
const request=async(path,options)=>{const r=await fetch(base+path,options);let data;try{data=await r.json()}catch{}return {r,data}};
async function ready(){
 for(let n=0;n<80;n++){
  if(server.exitCode!==null)throw Error('Vyrnivo server exited '+server.exitCode+' '+stderr);
  try{const {r,data}=await request('/health');if(r.ok&&data?.converter)return}catch{}
  await sleep(250);
 }
 throw Error('Vyrnivo local server did not become ready: '+stderr);
}
async function convert(url,output){
 const start=await request('/api/converter',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({url,output})});
 assert.equal(start.r.status,202,JSON.stringify(start.data));
 assert.equal(start.data.engine,'converter');
 let job=start.data;
 for(let n=0;n<220&&job.state==='processing';n++){
  await sleep(400);
  const x=await request('/api/converter/'+job.id);assert.equal(x.r.status,200);job=x.data;
 }
 assert.equal(job.state,'ready','Conversion failed: '+JSON.stringify(job)+' STDERR '+stderr);
 assert.ok(job.downloadUrl);
 const r=await fetch(base+job.downloadUrl);
 assert.equal(r.status,200);const bytes=new Uint8Array(await r.arrayBuffer());
 assert.equal(bytes.length,job.bytes);
 assert.ok(bytes.length>512);
 return {bytes,job};
}
try{
 await ready();
 const deny=await request('/api/converter',{method:'POST',headers:{Origin:'https://another-site.test','Content-Type':'application/json'},body:'{}'});
 assert.equal(deny.r.status,403,'Cross-origin writes must be rejected');
 const youtube=await request('/api/converter',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({url:'https://www.youtube.com/watch?v=BaW_jenozKc',output:'MP4'})});
 assert.equal(youtube.r.status,400,'Watch links must not impersonate direct media files');
 const mp4=await convert('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4','MP4');
 assert.equal(String.fromCharCode(...mp4.bytes.slice(4,8)),'ftyp','Expected genuine MP4 signature');
 console.log('OWN_CONVERTER_MP4_OK',JSON.stringify({bytes:mp4.bytes.length,content:'video/mp4',retention:10}));
 const mp3=await convert('https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3','MP3');
 const magic=String.fromCharCode(...mp3.bytes.slice(0,3));
 assert.ok(magic==='ID3'||(mp3.bytes[0]===255&&(mp3.bytes[1]&224)===224),'Expected genuine MP3');
 console.log('OWN_CONVERTER_MP3_OK',JSON.stringify({bytes:mp3.bytes.length,content:'audio/mpeg',retention:10}));
 const licensed=await convert('https://www.youtube.com/watch?v=aqz-KE-bpKQ','MP4');
 assert.equal(String.fromCharCode(...licensed.bytes.slice(4,8)),'ftyp','Expected real MP4 conversion of licensed Wikimedia alternate');
 assert.equal(licensed.job.sourceMetadata?.alternateVersion,true);
 assert.equal(licensed.job.sourceMetadata?.durationSeconds,33);
 console.log('LICENSED_YOUTUBE_LINK_EXCERPT_OK',JSON.stringify({bytes:licensed.bytes.length,excerptSeconds:licensed.job.sourceMetadata.durationSeconds,source:'Wikimedia Commons',fullYoutubeUpload:false}));
 const full=await convert('https://www.youtube.com/watch?v=jNQXAC9IVRw','MP4');
 assert.equal(String.fromCharCode(...full.bytes.slice(4,8)),'ftyp');
 assert.equal(full.job.sourceMetadata.durationSeconds,19);
 console.log('SECOND_CC_YOUTUBE_LINK_OK',JSON.stringify({bytes:full.bytes.length,durationSeconds:19,source:'Wikimedia Commons'}));


}catch(e){console.error('OWN_CONVERTER_TEST_FAILED',e?.stack||String(e));console.error('SERVER_STDERR',stderr);process.exitCode=1}
finally{server.kill('SIGTERM')}
