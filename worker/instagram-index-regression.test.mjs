import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIndexRss,indexedInstagram} from './ig-index.mjs';
import {findReels} from './reels.mjs';
const id='CDEfgHiJ123';
test('public RSS index supports /reels/ URL and deduplicates',()=>{
 const rss='<rss><channel><item><title>Roblox edit</title><link>https://www.instagram.com/reels/'+id+'/</link><description>Roblox gameplay</description></item><item><title>Duplicate</title><link>https://www.instagram.com/reel/'+id+'/</link></item></channel></rss>';
 const rows=parseIndexRss(rss);
 assert.equal(rows.length,1);
 assert.equal(rows[0].url,'https://www.instagram.com/reel/'+id+'/');
});
test('index queries merge public results and Reel search ranks by topic',async()=>{
 const fetcher=async url=>new Response('<rss><channel><item><title>Roblox gameplay edit</title><link>https://www.instagram.com/reel/'+id+'/</link><description>Roblox clip</description></item></channel></rss>',{status:200});
 const req=new Request('https://example.test/api/search/instagram?q=Roblox&kind=reels');
 const index=await indexedInstagram(req,{fetcher,now:()=>100000000});
 assert.equal((await index.json()).items.length,1);
 const result=await findReels(req,{searchIndex:()=>indexedInstagram(req,{fetcher,now:()=>100000001}),now:()=>100000001});
 assert.equal((await result.json()).items.length,1);
});
