import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {validate,argumentsFor,createDownloads} from './downloads.mjs';
import {fallbackPayload} from './webdownloader.mjs';
import {displayDownloadName} from './download-names.mjs';
import {probeVideoHeight} from './video-quality.mjs';
import {parseExtractorTelemetry} from './progress-metrics.mjs';

const yt='https://www.youtube.com/watch?v=jNQXAC9IVRw';
const insta='https://www.instagram.com/reel/DdRlhjluRFw/';
const input=(url,quality)=>({url,mode:'Video + audio',container:'MP4',quality});
test('YouTube and Instagram quality choices constrain upstream formats and preserve selected max',()=>{
 for(const url of [yt,insta]){
  for(const [label,max] of [['720p',720],['1080p',1080],['1440p',1440],['2160p · 4K',2160]]){
   const selected=input(url,label);
   assert.equal(validate(selected).height,max);
   const args=argumentsFor(selected,'/tmp/quality-check');
   const format=args[args.indexOf('-f')+1];
   assert.ok(format.includes(String(max)),url+' '+label+' should be included in yt-dlp selection');
  }
 }
 for(const url of [yt,insta]){
  const best=argumentsFor(input(url,'Best available'),'/tmp/quality-check');
  assert.ok(best.includes('-f'));
  assert.equal(validate(input(url,'Best available')).height,null);
 }
});

test('audio bitrates are validated, propagated to extractor, and included in user filenames',()=>{
 for(const [bitrate,token] of [['320 kbps','320K'],['120 kbps','120K']]){
  const inData={url:yt,mode:'Audio only',container:'MP3',quality:'Best available',audioBitrate:bitrate};
  assert.equal(validate(inData).audioBitrate,bitrate);
  const args=argumentsFor(inData,'/tmp/music');
  assert.equal(args[args.indexOf('--audio-quality')+1],token);
  assert.equal(displayDownloadName({...inData,title:'Study Beats',storageName:'media.mp3'}),
   'vyrnivo-Study Beats ('+bitrate.replace(' ','')+').mp3');
  assert.equal(fallbackPayload(inData).outputFormat,'mp3');
 }
 assert.throws(()=>validate({url:yt,mode:'Audio only',quality:'Best available',container:'MP3',audioBitrate:'999 kbps'}));
 assert.throws(()=>validate({url:yt,mode:'Audio only',quality:'Best available',container:'WAV',audioBitrate:'320 kbps'}));
});

test('video height probe reads actual stream height, not requested output label',async()=>{
 const mock=(command,args)=>{
  assert.equal(command,'ffprobe');
  assert.ok(args.includes('-select_streams'));
  const proc=new EventEmitter();
  proc.stdout=new EventEmitter();proc.kill=()=>{};
  queueMicrotask(()=>{proc.stdout.emit('data',Buffer.from('480\n'));proc.emit('close',0)});
  return proc;
 };
 assert.equal(await probeVideoHeight('/tmp/fake.mp4',{spawnProcess:mock}),480);
 assert.equal(displayDownloadName({title:'NASA Clip',url:yt,mode:'Video + audio',
  quality:'2160p · 4K',actualQuality:'480p',storageName:'media.mp4'}),
  'vyrnivo-NASA Clip (480p).mp4');
});

test('yt-dlp progress accepts measured ETA and keeps unknown initial stages unestimated',()=>{
 assert.deepEqual(parseExtractorTelemetry('download: 43.7%|01:12\n'),{percent:43.7,etaSeconds:72,speedBytesPerSecond:null,transferredBytes:null,totalBytes:null});
 assert.deepEqual(parseExtractorTelemetry('download: 78.0%|00:10\n'),{percent:78,etaSeconds:10,speedBytesPerSecond:null,transferredBytes:null,totalBytes:null});
 assert.deepEqual(parseExtractorTelemetry('preparing source'),{percent:null,etaSeconds:null,speedBytesPerSecond:null,transferredBytes:null,totalBytes:null});
 assert.deepEqual(parseExtractorTelemetry('download: 1.2%|N/A'),{percent:1.2,etaSeconds:null,speedBytesPerSecond:null,transferredBytes:null,totalBytes:null});
});

test('quality mismatch is rejected rather than falsely claimed as requested resolution',async()=>{
 let result;
 const manager=await createDownloads({enabled:true,probeQuality:async()=>1440,
  spawnProcess:(command,args)=>{
   const proc=new EventEmitter();proc.stdout=new EventEmitter();proc.stderr=new EventEmitter();proc.kill=()=>{};
   queueMicrotask(async()=>{const {writeFile}=await import('node:fs/promises');
    await writeFile(args[args.indexOf('-o')+1].replace('%(ext)s','mp4'),Buffer.alloc(256));
    proc.stdout.emit('data',Buffer.from('VYRNIVO_MEDIA_TITLE:Demo\n'));
    proc.emit('close',0);
   });return proc;
  }
 });
 try{
  const req=Readable.from([Buffer.from(JSON.stringify(input(yt,'720p')))]);req.method='POST';
  const res={writeHead(status){this.status=status},end(data){result=JSON.parse(data)}};
  await manager.handle(req,res,'/api/downloads');assert.equal(res.status,202);
  const id=result.id;
  for(let i=0;i<90;i++){
   await new Promise(resolve=>setTimeout(resolve,12));
   await manager.handle({method:'GET'},res,'/api/downloads/'+id);
   if(result.state!=='processing')break;
  }
  assert.equal(result.state,'failed');
  assert.match(result.error,/another video quality/i);
  assert.equal(result.canRetryWithDifferentFormat,true);
 }finally{manager.close()}
});
