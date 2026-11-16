import assert from 'node:assert/strict';
import {findCommonsAlternatives} from '../hosting/commons-discovery.mjs';
for(const [id,description] of [['jNQXAC9IVRw','Me at the zoo'],['aqz-KE-bpKQ','Big Buck Bunny'],['BaW_jenozKc','Test video']]){
 try{
  const r=await findCommonsAlternatives('https://www.youtube.com/watch?v='+id);
  const items=r.candidates.map(x=>({title:x.title,size:x.size,mime:x.mime,license:x.license,sourcePage:x.sourcePage}));
  assert.ok(r.candidates.every(x=>x.mediaUrl.startsWith('https://upload.wikimedia.org/')));
  assert.ok(r.candidates.every(x=>x.size<=30*1024*1024));
  console.log('COMMONS_LIVE_DISCOVERY',JSON.stringify({video:id,description,found:items.length,items:items.slice(0,6)}));
 }catch(e){
  console.log('COMMONS_LIVE_DISCOVERY',JSON.stringify({video:id,description,error:String(e?.message||e)}));
  process.exitCode=1;
 }
}
