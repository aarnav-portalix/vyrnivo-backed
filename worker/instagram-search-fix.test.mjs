import test from 'node:test';
import assert from 'node:assert/strict';
import {findReels} from './reels.mjs';
const reel='https://www.instagram.com/reel/CabcDEF12_3/';
const request=q=>new Request('https://vyrnivo.test/api/search/instagram?q='+encodeURIComponent(q)+'&kind=reels');
test('direct Reel links with share query params resolve without contacting indexes',async()=>{
 let called=false;
 const r=await findReels(request(reel+'?igsh=abc'),{searchIndex:async()=>{called=true;throw Error('should not fetch')}});
 const d=await r.json();
 assert.equal(d.items[0].url,reel);
 assert.equal(d.items[0].matchType,'direct-link');
 assert.equal(called,false);
});
test('index search no longer waits for blocked Instagram topic page',async()=>{
 const start=Date.now();
 const r=await findReels(request('vyrnivo unique test'),{
  searchIndex:async()=>Response.json({items:[{url:reel,title:'Vyrnivo unique test',description:'',creator:'Public Reel'}]})
 });
 const d=await r.json();
 assert.equal(d.items.length,1);
 assert.ok(Date.now()-start<1000);
});
test('unrelated indexed results are not presented as matches',async()=>{
 const r=await findReels(request('snowy mountains'),{
  searchIndex:async()=>Response.json({items:[{url:reel,title:'Unrelated makeup tutorial',creator:'Public Reel'}]})
 });
 assert.deepEqual((await r.json()).items,[]);
});
