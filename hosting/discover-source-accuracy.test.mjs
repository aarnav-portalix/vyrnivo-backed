import test from 'node:test';
import assert from 'node:assert/strict';
import {relevantIndexedItems,matchEvidence,nativeInstagramSearchUrl} from '../worker/search-quality.mjs';
import {parseYouTubeOfficialItems,officialYouTubeSearch} from '../worker/youtube-official.mjs';
import {search,parseYouTubeItems} from '../worker/search.mjs';
import {findReels} from '../worker/reels.mjs';

const videoId='jNQXAC9IVRw',shortId='BaW_jenozKc';
const channelId='UC'+'A'.repeat(22),playlistId='PL'+'B'.repeat(20);

test('indexed Reels only show links with evidence that they match the topic',()=>{
 const items=[
  {id:'A',title:'Wildlife animals in a rainforest',creator:'@nature',description:''},
  {id:'B',title:'Dinner recipe for the family',creator:'@food',description:''},
  {id:'C',title:'Instagram',creator:'Public Reel',description:'Wildlife photography and animals'},
  {id:'D',title:'Instagram',creator:'Public Reel',description:'No text was provided'}
 ];
 const matches=relevantIndexedItems(items,'wildlife animals');
 assert.deepEqual(matches.map(x=>x.id),['A','C']);
 assert.equal(matchEvidence(items[1],'wildlife animals').accepted,false);
 assert.equal(matchEvidence(items[0],'wildlife animals').accepted,true);
 assert.ok(relevantIndexedItems(items,'completely unrelated topic').length===0);
});

test('Instagram native search is exact to keywords and hashtags',()=>{
 assert.equal(nativeInstagramSearchUrl('#nature'),'https://www.instagram.com/explore/tags/nature/');
 assert.equal(nativeInstagramSearchUrl('wildlife videos'),'https://www.instagram.com/explore/search/keyword/?q=wildlife%20videos');
});

test('modern YouTube search root excludes unrelated sidebar cards and never relabels a standard video as Short',()=>{
 const tree={contents:{twoColumnSearchResultsRenderer:{
  primaryContents:{sectionListRenderer:{contents:[
   {itemSectionRenderer:{contents:[
    {videoRenderer:{videoId,title:{simpleText:'Genuine science video'}}},
    {shortsLockupViewModel:{contentId:shortId,overlayMetadata:{primaryText:{content:'A verified Short listing'}}}}
   ]}}
  ]}},
  secondaryContents:{sectionListRenderer:{contents:[
   {itemSectionRenderer:{contents:[{videoRenderer:{videoId:'QWERTY12345',title:{simpleText:'Sidebar recommendation'}}}]}}
  ]}}
 }}};
 const matches=parseYouTubeItems(tree,'all');
 assert.equal(matches.length,2);
 assert.ok(!matches.some(x=>x.id==='QWERTY12345'));
 assert.deepEqual(parseYouTubeItems(tree,'shorts').map(x=>x.id),[shortId]);
 assert.equal(parseYouTubeItems(tree,'videos')[0].kind,'video');
});

test('official YouTube search API maps only real identifiers to canonical platform links',()=>{
 const sample={items:[
  {id:{kind:'youtube#video',videoId},snippet:{title:'NASA rocket launch',channelTitle:'NASA',thumbnails:{high:{url:'https://i.ytimg.com/vi/'+videoId+'/hqdefault.jpg'}}}},
  {id:{kind:'youtube#channel',channelId},snippet:{title:'NASA channel'}},
  {id:{kind:'youtube#playlist',playlistId},snippet:{title:'NASA missions'}},
  {id:{kind:'youtube#video',videoId:'BAD'},snippet:{title:'Invalid fake video'}}
 ]};
 const results=parseYouTubeOfficialItems(sample);
 assert.equal(results.length,3);
 assert.equal(results[0].url,'https://www.youtube.com/watch?v='+videoId);
 assert.equal(results[1].url,'https://www.youtube.com/channel/'+channelId);
 assert.equal(results[2].url,'https://www.youtube.com/playlist?list='+playlistId);
 assert.equal(parseYouTubeOfficialItems(sample,'channels').length,1);
 assert.equal(parseYouTubeOfficialItems(sample,'videos').length,1);
});

test('official API is optional, server-side and falls back when unavailable',async()=>{
 let requested=0;
 const fake={items:[{id:{kind:'youtube#video',videoId},snippet:{title:'NASA tests'}}]};
 const api=await officialYouTubeSearch({query:'nasa',kind:'videos',apiKey:'test-key-from-server-123',
  fetchImpl:async(url,options)=>{
   requested++;
   const u=new URL(url);
   assert.equal(u.hostname,'www.googleapis.com');
   assert.equal(u.searchParams.get('q'),'nasa');
   assert.equal(u.searchParams.get('type'),'video');
   assert.equal(u.searchParams.get('key'),'test-key-from-server-123');
   assert.equal(options.redirect,'error');
   return Response.json(fake);
  }});
 assert.equal(requested,1);
 assert.equal(api.items[0].id,videoId);
 const unavailable=await officialYouTubeSearch({query:'nasa',kind:'videos',apiKey:'',fetchImpl:()=>{throw Error('should never call')}});
 assert.equal(unavailable,null);
});

test('an exact YouTube link stays an exact source link without claiming it was verified playable',async()=>{
 const data=await (await search(new Request('https://vyrnivo.test/api/search/youtube?kind=shorts&q='+
  encodeURIComponent('https://www.youtube.com/shorts/'+shortId)))).json();
 assert.equal(data.items.length,1);
 assert.equal(data.items[0].url,'https://www.youtube.com/shorts/'+shortId);
 assert.equal(data.items[0].matchType,'direct-link');
});

test('an exact Instagram Reel link returns only that link, without fabricating additional media',async()=>{
 const exact='https://www.instagram.com/reel/AbCdefGhI/';
 const data=await (await findReels(new Request('https://vyrnivo.test/api/search/instagram?kind=reels&q='+
  encodeURIComponent(exact)),{searchIndex:()=>{throw Error('direct must not fetch')}})).json();
 assert.equal(data.items.length,1);
 assert.equal(data.items[0].url,exact);
 assert.equal(data.items[0].matchType,'direct-link');
});
