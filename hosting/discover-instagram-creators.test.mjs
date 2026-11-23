import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalInstagramProfile,parseIndexedInstagramProfiles,searchInstagramCreators} from '../worker/ig-creators.mjs';
import {findReels} from '../worker/reels.mjs';

const rss='<rss><channel>'+
 '<item><title>Public creator A (@sample_creator) Instagram</title><link>https://www.instagram.com/sample_creator/</link></item>'+
 '<item><title>Another public creator</title><link>https://www.instagram.com/another.creator/</link></item>'+
 '<item><title>Duplicate creator</title><link>https://www.instagram.com/sample_creator/?hl=en</link></item>'+
 '<item><title>Reel not a profile</title><link>https://www.instagram.com/reel/ABCabc1234/</link></item>'+
 '<item><title>Unsafe lookalike</title><link>https://www.instagram.com.evil.test/unsafe/</link></item>'+
 '</channel></rss>';
test('creator parser accepts public indexed profile URLs only and removes duplicates',()=>{
 const list=parseIndexedInstagramProfiles(rss);
 assert.deepEqual(list.map(x=>x.id),['sample_creator','another.creator']);
 assert.equal(list[0].url,'https://www.instagram.com/sample_creator/');
 assert.equal(list[0].verified,false);
 assert.equal(canonicalInstagramProfile('https://www.instagram.com/reel/ABCabc1234/'),null);
 assert.equal(canonicalInstagramProfile('https://instagram.com/accounts/login/'),null);
 assert.equal(canonicalInstagramProfile('https://instagram.com.evil.test/someone/'),null);
 assert.equal(canonicalInstagramProfile('http://instagram.com/someone/'),null);
});
test('Instagram creator search works keylessly on public RSS and labels links honestly',async()=>{
 let calls=0;
 const request=new Request('https://vyrnivo.test/api/search/instagram?q=sample_creator&kind=creators');
 const r=await searchInstagramCreators(request,{
  fetchImpl:async(url,init)=>{
   calls++;assert.equal(new URL(url).hostname,'www.bing.com');
   assert.match(new URL(url).searchParams.get('q'),/site:instagram\.com/);
   assert.equal(init.redirect,'error');
   return new Response(rss,{status:200,headers:{'content-type':'application/rss+xml'}});
  }
 });
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.kind,'creators');
 assert.ok(data.items.some(item=>item.creator==='@sample_creator'));
 assert.equal(data.items[0].creator,'@sample_creator');
 assert.match(data.notice,/public index/i);
 assert.ok(data.searchUrl.includes('instagram.com/explore/search/keyword'));
 assert.equal(calls,1);
});
test('Instagram creator API remains separate from Reels and rejects unsupported filters',async()=>{
 const req=new Request('https://vyrnivo.test/api/search/instagram?q=roblox&kind=creators');
 const found=await findReels(req,{searchCreators:async()=>Response.json({items:[{kind:'creator',id:'somecreator',url:'https://www.instagram.com/somecreator/'}],kind:'creators'})});
 assert.equal(found.status,200);
 assert.equal((await found.json()).items[0].kind,'creator');
 const invalid=await findReels(new Request('https://vyrnivo.test/api/search/instagram?q=roblox&kind=private'));
 assert.equal(invalid.status,400);
});
test('index restrictions produce a truthful empty list rather than invented creator accounts',async()=>{
 const r=await searchInstagramCreators(new Request('https://vyrnivo.test/api/search/instagram?q=nonexisting-creators-xx&kind=creators'),{fetchImpl:async()=>new Response('denied',{status:403})});
 const json=await r.json();
 assert.deepEqual(json.items,[]);
 assert.match(json.notice,/No related creator profiles/);
});

test('a precise @handle is offered only as an explicitly unverified profile suggestion',async()=>{
 const response=await searchInstagramCreators(new Request('https://vyrnivo.test/api/search/instagram?q=%40natgeo&kind=creators'),{fetchImpl:async()=>new Response('unavailable',{status:429})});
 const data=await response.json();
 assert.equal(data.items.length,1);
 assert.equal(data.items[0].url,'https://www.instagram.com/natgeo/');
 assert.equal(data.items[0].verified,false);
 assert.equal(data.items[0].source,'Username entered by visitor');
 assert.equal(data.items[0].matchType,'direct-username');
});
