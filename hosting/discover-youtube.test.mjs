import test from 'node:test';
import assert from 'node:assert/strict';
import {extractYouTubeSearchData,parseYouTubeItems,search,YOUTUBE_TYPES} from '../worker/search.mjs';

const videoId='jNQXAC9IVRw';
const shortId='BaW_jenozKc';
const channelId='UC'+'A'.repeat(22);
const playlistId='PL'+'B'.repeat(20);
const resultTree={contents:[
 {videoRenderer:{videoId,title:{runs:[{text:'Original video'}]},ownerText:{runs:[{text:'Test uploader'}]}}},
 {channelRenderer:{channelId,title:{simpleText:'Test channel'},subscriberCountText:{simpleText:'12 subscribers'}}},
 {playlistRenderer:{playlistId,title:{simpleText:'Test playlist'}}},
 {lockupViewModel:{contentId:'PL'+'C'.repeat(20),contentType:'LOCKUP_CONTENT_TYPE_PLAYLIST',metadata:{lockupMetadataViewModel:{title:{content:'New-format playlist'}}}}},
 {shortsLockupViewModel:{contentId:shortId,overlayMetadata:{primaryText:{content:'Test Short'}}}},
 {reelItemRenderer:{videoId:'YE7VzlLtp-4',headline:{simpleText:'Reel item Short'}}}
]};
const html='<!doctype html><script>var ytInitialData = '+JSON.stringify(resultTree)+';</script>';
test('public YouTube search parses verified navigation IDs, including Shorts, channels and playlists',()=>{
 const data=extractYouTubeSearchData(html);
 assert.ok(data);
 const items=parseYouTubeItems(data,'all');
 assert.equal(items.length,6);
 const video=items.find(x=>x.kind==='video');
 const short=items.find(x=>x.kind==='short');
 const channel=items.find(x=>x.kind==='channel');
 const playlist=items.find(x=>x.kind==='playlist');
 assert.equal(video.url,'https://www.youtube.com/watch?v='+videoId);
 assert.equal(short.url,'https://www.youtube.com/shorts/'+shortId);
 assert.equal(channel.url,'https://www.youtube.com/channel/'+channelId);
 assert.equal(playlist.url,'https://www.youtube.com/playlist?list='+playlistId);
 assert.ok(!parseYouTubeItems(data,'channels').some(x=>x.kind==='video'));
 assert.ok(parseYouTubeItems(data,'shorts').every(x=>x.kind==='short'));
 assert.ok(parseYouTubeItems(data,'videos').every(x=>x.kind==='video'));
 assert.equal(parseYouTubeItems(data,'playlists').length,2);
});
test('search respects YouTube-native source filters and never fabricates results',async()=>{
 for(const kind of Object.keys(YOUTUBE_TYPES)){
  let requested;
  const response=await search(new Request('https://vyrnivo.test/api/search/youtube?q=roblox%20rivals&kind='+kind),{
   fetchImpl:async(url,options)=>{
    requested=new URL(url);
    assert.equal(options.redirect,'error');
    return new Response(html,{status:200});
   }
  });
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.kind,kind);
  assert.equal(requested.searchParams.get('search_query'),'roblox rivals');
  assert.equal(requested.searchParams.get('sp'),YOUTUBE_TYPES[kind]||null);
  assert.ok(Array.isArray(data.items));
  assert.ok(data.searchUrl.includes('youtube.com/results'));
 }
 const denied=await search(new Request('https://vyrnivo.test/api/search/youtube?q=x&kind=channels'));
 assert.equal(denied.status,400);
});
test('YouTube unavailable search has an honest external URL and no fabricated videos',async()=>{
 const result=await search(new Request('https://vyrnivo.test/api/search/youtube?q=valid%20query&kind=shorts'),{
  fetchImpl:async()=>new Response('blocked',{status:429})
 });
 assert.equal(result.status,200);
 const json=await result.json();
 assert.deepEqual(json.items,[]);
 assert.match(json.notice,/could not be reached/);
 assert.match(json.searchUrl,/youtube\.com/);
});
test('malformed YouTube initial data is rejected without eval',()=>{
 assert.equal(extractYouTubeSearchData('<script>var ytInitialData = {invalid};</script>'),null);
});
