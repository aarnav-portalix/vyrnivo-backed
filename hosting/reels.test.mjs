import test from 'node:test';
import assert from 'node:assert/strict';
import {findReels} from '../worker/reels.mjs';

const request=new Request('https://vyrnivo.test/api/search/instagram?q=roblox+rivals');
const good={id:'Abcdef123',kind:'instagram',url:'https://www.instagram.com/reel/Abcdef123/',title:'Roblox Rivals reel',creator:'@creator'};
test('deduplicates public and indexed results, rejects lookalike hosts',async()=>{
 const result=await findReels(request,{
  now:()=>100,
  searchPublic:async()=>Response.json({items:[good,{id:'x',url:'https://www.instagram.com.evil.test/reel/X12345678/'}]}),
  searchIndex:async()=>Response.json({items:[good,{id:'123456789',kind:'instagram',url:'https://instagram.com/reel/QWERTY123/',title:'Roblox Rivals montage'}]})
 });
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.items.length,2);
 assert.equal(data.items[0].url,'https://www.instagram.com/reel/Abcdef123/');
 assert.equal(data.items[1].url,'https://www.instagram.com/reel/QWERTY123/');
});
test('blocked sources give explicit notice, not fake results',async()=>{
 const r=await findReels(new Request('https://app.test/api/search/instagram?q=unavailable-vyrnivo'),{
  searchIndex:async()=>Response.json({error:'rate limited'},{status:429}),
  searchPublic:async()=>Response.json({error:'unavailable'},{status:502})
 });
 const x=await r.json();
 assert.deepEqual(x.items,[]);
 assert.match(x.notice,/No trustworthy matching Reels/i);
});
test('query validation runs before external calls',async()=>{
 const r=await findReels(new Request('https://app.test/api/search/instagram?q=a'),{searchIndex:()=>{throw Error('must not run')}});
 assert.equal(r.status,400);
});
