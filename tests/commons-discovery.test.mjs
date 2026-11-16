import test from 'node:test';
import assert from 'node:assert/strict';
import {findCommonsAlternatives,youtubeVideoId} from '../hosting/commons-discovery.mjs';
const url='https://www.youtube.com/watch?v=jNQXAC9IVRw';
test('validates official YouTube watch, Shorts and short URLs',()=>{
 assert.equal(youtubeVideoId(url),'jNQXAC9IVRw');
 assert.equal(youtubeVideoId('https://youtu.be/jNQXAC9IVRw'),'jNQXAC9IVRw');
 assert.equal(youtubeVideoId('https://www.youtube.com/shorts/jNQXAC9IVRw'),'jNQXAC9IVRw');
 for(const bad of ['https://youtube.com.evil.test/watch?v=jNQXAC9IVRw','http://youtube.com/watch?v=jNQXAC9IVRw','https://youtube.com/watch?v=INVALID','https://127.0.0.1/watch?v=jNQXAC9IVRw'])
 assert.throws(()=>youtubeVideoId(bad));
});
test('returns only verified-sized, freely licensed video hosted by Commons',async()=>{
 const calls=[];
 const fakeFetch=async raw=>{
  calls.push(raw);const u=new URL(raw);
  assert.equal(u.hostname,'commons.wikimedia.org');
  if(u.searchParams.get('list')==='search')return Response.json({query:{search:[
   {title:'File:Accepted film.webm'},{title:'File:Unlicensed.webm'},
   {title:'File:Poster.jpg'},{title:'File:Giant.webm'},
   {title:'File:Wrong host.webm'}
  ]}});
  return Response.json({query:{pages:{
   '1':{title:'File:Accepted film.webm',imageinfo:[{url:'https://upload.wikimedia.org/wikipedia/commons/0/01/Accepted_film.webm',size:1234567,mime:'video/webm',extmetadata:{LicenseShortName:{value:'CC BY 3.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/3.0/'}}}]},
   '2':{title:'File:Unlicensed.webm',imageinfo:[{url:'https://upload.wikimedia.org/wikipedia/commons/0/01/Unlicensed.webm',size:1234,mime:'video/webm',extmetadata:{LicenseShortName:{value:'All rights reserved'},LicenseUrl:{value:'https://bad.test/'}}}]},
   '3':{title:'File:Poster.jpg',imageinfo:[{url:'https://upload.wikimedia.org/wikipedia/commons/0/01/Poster.jpg',size:1234,mime:'image/jpeg',extmetadata:{LicenseUrl:{value:'https://creativecommons.org/licenses/by/3.0/'}}}]},
   '4':{title:'File:Giant.webm',imageinfo:[{url:'https://upload.wikimedia.org/wikipedia/commons/0/01/Giant.webm',size:40*1024*1024,mime:'video/webm',extmetadata:{LicenseUrl:{value:'https://creativecommons.org/licenses/by/3.0/'}}}]},
   '5':{title:'File:Wrong host.webm',imageinfo:[{url:'https://evil.example/clip.webm',size:1000,mime:'video/webm',extmetadata:{LicenseUrl:{value:'https://creativecommons.org/licenses/by/3.0/'}}}]}
  }}});
 };
 const result=await findCommonsAlternatives(url,{fetchImpl:fakeFetch});
 assert.equal(calls.length,2);
 assert.equal(result.videoId,'jNQXAC9IVRw');
 assert.equal(result.candidates.length,1);
 assert.equal(result.candidates[0].title,'Accepted film.webm');
 assert.equal(result.candidates[0].alternateVersion,true);
});
