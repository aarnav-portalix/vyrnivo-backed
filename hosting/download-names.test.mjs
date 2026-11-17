import test from 'node:test';
import assert from 'node:assert/strict';
import {
 safeMediaTitle,fallbackMediaTitle,actualMediaExtension,displayDownloadName,contentDisposition,
 titleFromContentDisposition,titleFromExtractorLog,lookupPublicTitle
} from './download-names.mjs';

const url='https://www.youtube.com/watch?v=jNQXAC9IVRw';

test('clean title, requested quality and actual extension produce clear names',()=>{
 assert.equal(displayDownloadName({
  title:'Awesome Montage 2026!',url,mode:'Video + audio',quality:'1080p',storageName:'media.mp4'
 }),'vyrnivo-Awesome Montage 2026!-1080p-MP4.mp4');
 assert.equal(displayDownloadName({
  title:'Roblox Edit',url,mode:'Audio only',quality:'Best available',storageName:'media.m4a'
 }),'vyrnivo-Roblox Edit-Audio-M4A.m4a');
 assert.equal(displayDownloadName({
  title:'Music ✨',url,mode:'Audio only',quality:'Best available',storageName:'media.wav'
 }),'vyrnivo-Music ✨-Audio-WAV.wav');
 assert.equal(displayDownloadName({
  title:'Creator',url,mode:'Video only',quality:'2160p · 4K',storageName:'media.webm'
 }),'vyrnivo-Creator-2160p-VideoOnly-WEBM.webm');
 assert.equal(displayDownloadName({
  url,mode:'Video + audio',quality:'720p',storageName:'media.mp4'
 }),'vyrnivo-YouTube-jNQXAC9IVRw-720p-MP4.mp4');
 assert.equal(displayDownloadName({
  url:'https://www.instagram.com/reel/ABCDxyzzzz/',mode:'Video + audio',quality:'Best available',storageName:'media.mp4'
 }),'vyrnivo-Instagram-Reel-ABCDxyzzzz-Best-MP4.mp4');
});

test('malicious or huge media titles cannot traverse paths or inject headers',()=>{
 const tricky='  ../my/evil\\thing:\r\nSet-Cookie: exploited<>?* | neat 🎵. ';
 const safe=safeMediaTitle(tricky);
 assert.ok(!safe.includes('/')&&!safe.includes('\\'));
 assert.ok(!safe.includes('\r')&&!safe.includes('\n'));
 assert.ok(!safe.includes(':'));
 const filename=displayDownloadName({
  title:tricky,url,mode:'Audio only',quality:'Best available',storageName:'media.mp3'
 });
 assert.ok(filename.startsWith('vyrnivo-'));
 assert.ok(filename.endsWith('-Audio-MP3.mp3'));
 assert.ok(filename.length<160);
 assert.throws(()=>displayDownloadName({title:'x',url,mode:'Audio only',storageName:'../../etc/passwd'}));
 assert.equal(actualMediaExtension('media.flac'),'flac');
 assert.equal(actualMediaExtension('media.mp3'),'mp3');
 assert.equal(actualMediaExtension('etc/passwd'),null);
 assert.ok([...safeMediaTitle('x'.repeat(500))].length<=82);
});

test('RFC 6266 filename header safely encodes non-ASCII video titles',()=>{
 const filename='vyrnivo-हिंदी-日本語-🎮-720p-MP4.mp4';
 const header=contentDisposition(filename);
 assert.ok(header.startsWith('attachment; filename="vyrnivo-'));
 assert.ok(header.includes("filename*=UTF-8''"));
 assert.equal(decodeURIComponent(header.split("filename*=UTF-8''")[1]),filename);
 assert.ok(!header.includes('\r')&&!header.includes('\n'));
 assert.ok(contentDisposition('evil"\r\nInjected').includes('Injected'));
});

test('yt-dlp and backup response titles are read only from intended metadata',()=>{
 assert.equal(titleFromExtractorLog('download: 100%\nVYRNIVO_MEDIA_TITLE:My Cool Edit\n'),'My Cool Edit');
 assert.equal(titleFromExtractorLog('text\nVYRNIVO_MEDIA_TITLE:First\nVYRNIVO_MEDIA_TITLE:Second\n'),'Second');
 assert.equal(titleFromExtractorLog('nothing'), '');
 assert.equal(titleFromContentDisposition('attachment; filename="My lovely edit.mp3"'),'My lovely edit');
 assert.equal(titleFromContentDisposition("attachment; filename*=UTF-8''%E6%97%A5%E6%9C%AC%E8%AA%9E.mp4"),'日本語');
 assert.equal(titleFromContentDisposition('attachment; filename="media.mp4"'),'');
 assert.equal(titleFromContentDisposition(''), '');
});

test('public oEmbed title is a bounded optional lookup with no cookies',async()=>{
 let calls=0;
 const found=await lookupPublicTitle(url,{fetchImpl:async(u,opt)=>{
  calls++;
  assert.equal(new URL(u).hostname,'www.youtube.com');
  assert.equal(new URL(u).pathname,'/oembed');
  assert.equal(opt.redirect,'error');
  assert.equal(opt.headers.accept,'application/json');
  return Response.json({title:'Independent Music Video 2026'});
 }});
 assert.equal(found,'Independent Music Video 2026');
 assert.equal(calls,1);
 assert.equal(await lookupPublicTitle('https://www.instagram.com/reel/ABCDEFGH/',{
  fetchImpl:async()=>{throw Error('should not be called')}
 }),null);
 assert.equal(await lookupPublicTitle(url,{fetchImpl:async()=>new Response('denied',{status:403})}),null);
});
