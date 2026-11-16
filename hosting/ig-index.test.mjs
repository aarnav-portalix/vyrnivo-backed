import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIndexRss,indexedInstagram} from '../worker/ig-index.mjs';
const xml='<rss><channel><item><title>Roblox &amp; Gaming</title><link>https://www.instagram.com/reel/Abc123def/</link></item><item><title>Duplicate</title><link>https://instagram.com/reel/Abc123def/</link></item><item><title>Attack</title><link>https://instagram.com.evil.example/reel/Abc123z98/</link></item><item><title>Unrelated</title><link>https://instagram.com/user</link></item></channel></rss>';
test('indexed Instagram parser only returns deduplicated canonical Reels',()=>{
 const r=parseIndexRss(xml);
 assert.equal(r.length,1);
 assert.equal(r[0].url,'https://www.instagram.com/reel/Abc123def/');
 assert.equal(r[0].title,'Roblox & Gaming');
});
test('keyword search works without API key on a valid indexed response',async()=>{
 let calls=0;
 const f=async url=>{calls++;const u=new URL(url);assert.equal(u.searchParams.get('q'),'site:instagram.com/reel/ test-vyrnivo-keyword');return new Response(xml,{status:200})};
 const req=new Request('https://app.test/api/search/instagram?q=test-vyrnivo-keyword');
 const r=await indexedInstagram(req,{fetcher:f});
 assert.equal(r.status,200);
 const data=await r.json();assert.equal(data.items.length,1);
 await indexedInstagram(req,{fetcher:f});
 assert.equal(calls,1);
});
test('blocked index degrades to an honest empty result',async()=>{
 const req=new Request('https://app.test/api/search/instagram?q=blocked-search-vyrnivo');
 const r=await indexedInstagram(req,{fetcher:async()=>new Response('blocked',{status:403})});
 assert.equal(r.status,200);
 const data=await r.json();assert.equal(data.items.length,0);
 assert.match(data.notice,/no accessible results/i);
});