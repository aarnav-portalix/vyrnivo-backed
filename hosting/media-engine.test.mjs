import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {selectConversion,conversionArgs,convertMedia} from './media-engine.mjs';

test('safe FFmpeg fast paths only for compatible codecs',()=>{
 assert.equal(selectConversion({streams:[{codec_type:'video',codec_name:'h264'},{codec_type:'audio',codec_name:'aac'}]},'MP4'),'copy');
 assert.equal(selectConversion({streams:[{codec_type:'video',codec_name:'h264'}]},'MP4'),'copy');
 assert.equal(selectConversion({streams:[{codec_type:'video',codec_name:'vp9'},{codec_type:'audio',codec_name:'opus'}]},'MP4'),'encode');
 assert.equal(selectConversion({streams:[{codec_type:'audio',codec_name:'mp3'}]},'MP3'),'copy');
 assert.equal(selectConversion({streams:[{codec_type:'audio',codec_name:'aac'}]},'MP3'),'encode');
 assert.equal(selectConversion(null,'MP4'),'encode');
});
test('fast copy uses stream copy and preserves media; encoding is bounded and CPU-conscious',()=>{
 const copy=conversionArgs('/tmp/in.mp4','/tmp/out.mp4','MP4',{copy:true});
 assert.ok(copy.includes('copy'));
 assert.ok(copy.includes('+faststart'));
 assert.ok(!copy.includes('libx264'));
 assert.equal(copy[copy.indexOf('-t')+1],'120');
 assert.ok(copy.includes('-progress'));
 const encode=conversionArgs('/tmp/in.webm','/tmp/out.mp4','MP4');
 assert.ok(encode.includes('libx264'));
 assert.ok(encode.includes('ultrafast'));
 assert.equal(encode[encode.indexOf('-threads')+1],'2');
 const audio=conversionArgs('/tmp/a.mp3','/tmp/a2.mp3','MP3',{copy:true});
 assert.ok(audio.includes('copy'));
 assert.ok(!audio.includes('libmp3lame'));
});
test('copy failure falls back to compatible conversion and reports stage progress',async()=>{
 const history=[],progress=[];
 const spawnProcess=(command,args)=>{
  history.push({command,args});
  const child=new EventEmitter();
  child.stdout=new EventEmitter();
  child.stderr=new EventEmitter();
  child.kill=()=>{};
  queueMicrotask(()=>{
   if(command==='ffprobe'){
    child.stdout.emit('data',Buffer.from(JSON.stringify({format:{duration:'20.0'},streams:[{codec_type:'video',codec_name:'h264'},{codec_type:'audio',codec_name:'aac'}]})));
    child.emit('close',0);
   }else{
    child.stderr.emit('data',Buffer.from('out_time_us=4000000\nprogress=continue\n'));
    child.emit('close',args.includes('copy')?1:0);
   }
  });
  return child;
 };
 const result=await convertMedia('/tmp/source.mp4','/tmp/converted.mp4','MP4',{spawnProcess,onProgress:p=>progress.push(p)});
 assert.equal(result.method,'transcode');
 assert.equal(history.filter(x=>x.command==='ffmpeg').length,2);
 assert.ok(progress.some(x=>x.stage==='Fast-copying compatible media'));
 assert.ok(progress.some(x=>x.stage==='Converting with compatible settings'));
 assert.ok(progress.some(x=>Number.isFinite(x.progressPercent)));
});
