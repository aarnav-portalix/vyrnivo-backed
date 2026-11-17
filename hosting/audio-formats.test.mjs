import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm,stat,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {audioTranscodeArgs,convertBackupAudio,getAudioDuration,fallbackAudioSupported} from './audio-formats.mjs';

const ffmpegAvailable=spawnSync('ffmpeg',['-version'],{stdio:'ignore'}).status===0&&
 spawnSync('ffprobe',['-version'],{stdio:'ignore'}).status===0;

test('audio backup format selection includes M4A and WAV but not falsely original audio',()=>{
 for(const format of ['MP3','M4A','WAV'])assert.equal(fallbackAudioSupported({mode:'Audio only',container:format}),true);
 assert.equal(fallbackAudioSupported({mode:'Audio only',container:'Original audio'}),false);
 assert.equal(fallbackAudioSupported({mode:'Video + audio',container:'MP3'}),false);
});

test('FFmpeg uses codec-specific low-overhead audio-only settings',()=>{
 const aac=audioTranscodeArgs('/tmp/track.mp3','/tmp/track.m4a','M4A');
 assert.ok(aac.includes('aac'));
 assert.ok(aac.includes('+faststart'));
 assert.equal(aac[aac.indexOf('-b:a')+1],'160k');
 assert.ok(aac.includes('-vn'));
 const wav=audioTranscodeArgs('/tmp/track.mp3','/tmp/track.wav','WAV');
 assert.ok(wav.includes('pcm_s16le'));
 assert.equal(wav[wav.indexOf('-ar')+1],'44100');
 assert.ok(wav.includes('-fs'));
 assert.throws(()=>audioTranscodeArgs('/tmp/a.mp3','/tmp/b.flac','FLAC'),/Unsupported/);
});

const buildAudio=async dir=>{
 const file=join(dir,'media.mp3');
 const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',
  '-f','lavfi','-i','sine=frequency=440:sample_rate=44100:duration=1.4',
  '-c:a','libmp3lame','-b:a','160k',file],{timeout:20000,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 return file;
};

test('actual FFmpeg creates a valid playable M4A from a real MP3',{skip:!ffmpegAvailable},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vyrnivo-m4a-'));
 try{
  const source=await buildAudio(dir);
  const duration=await getAudioDuration(source);
  assert.ok(duration>1&&duration<2);
  const result=await convertBackupAudio({path:source,name:'media.mp3',bytes:(await stat(source)).size},dir,'M4A');
  assert.equal(result.name,'media.m4a');
  assert.equal(result.outputFormat,'M4A');
  assert.equal(result.convertedLocally,true);
  assert.ok(result.bytes>1000);
  await assert.rejects(access(source));
  const bytes=await readFile(result.path);
  assert.equal(bytes.toString('ascii',4,8),'ftyp');
  const probe=spawnSync('ffprobe',['-v','error','-select_streams','a:0',
   '-show_entries','stream=codec_name','-of','default=noprint_wrappers=1:nokey=1',
   result.path],{encoding:'utf8'});
  assert.equal(probe.status,0);
  assert.equal(probe.stdout.trim(),'aac');
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('actual FFmpeg creates a valid stereo WAV from a real MP3',{skip:!ffmpegAvailable},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vyrnivo-wav-'));
 try{
  const source=await buildAudio(dir);
  const result=await convertBackupAudio({path:source,name:'media.mp3',bytes:(await stat(source)).size},dir,'WAV');
  assert.equal(result.name,'media.wav');
  assert.ok(result.bytes>10000);
  const bytes=await readFile(result.path);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WAVE');
  const probe=spawnSync('ffprobe',['-v','error','-select_streams','a:0',
   '-show_entries','stream=codec_name,channels,sample_rate','-of','json',result.path],{encoding:'utf8'});
  assert.equal(probe.status,0);
  const [audio]=JSON.parse(probe.stdout).streams;
  assert.equal(audio.codec_name,'pcm_s16le');
  assert.equal(audio.sample_rate,'44100');
  assert.equal(audio.channels,2);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('FFmpeg produces real 120 kbps and 320 kbps MP3 and AAC/M4A outputs',{skip:!ffmpegAvailable},async()=>{
 for(const format of ['MP3','M4A']){
  for(const [audioBitrate,target] of [['120 kbps',120000],['320 kbps',320000]]){
   const dir=await mkdtemp(join(tmpdir(),'vyrnivo-bitrate-'));
   try{
    const source=await buildAudio(dir);
    const report=[];
    const result=await convertBackupAudio({path:source,name:'media.mp3',bytes:(await stat(source)).size},dir,format,{
     audioBitrate,onProgress:x=>report.push(x)
    });
    assert.equal(result.name,'media.'+format.toLowerCase());
    assert.equal(result.convertedLocally,true);
    const probe=spawnSync('ffprobe',['-v','error','-select_streams','a:0',
     '-show_entries','stream=codec_name,bit_rate','-of','json',result.path],{encoding:'utf8',timeout:15000});
    assert.equal(probe.status,0,probe.stderr);
    const [audio]=JSON.parse(probe.stdout).streams;
    assert.equal(audio.codec_name,format==='MP3'?'mp3':'aac');
    const br=Number(audio.bit_rate);
    assert.ok(br>0&&br<target*1.23,format+' '+audioBitrate+' actual bitrate='+br);
    if(format==='MP3')assert.ok(br>target*.79,'MP3 target bitrate should be respected');
    // AAC output is content-dependent: FFmpeg -b:a sets the bitrate target, but
    // simple tones may compress far below it. Do not pretend higher size = higher quality.
    assert.equal(audioTranscodeArgs('/tmp/a.mp3','/tmp/b.'+format.toLowerCase(),format,
      target===320000?'320k':'120k')[audioTranscodeArgs('/tmp/a.mp3','/tmp/b.'+format.toLowerCase(),format,
      target===320000?'320k':'120k').indexOf('-b:a')+1],target===320000?'320k':'120k');
    assert.ok(report.some(x=>String(x.stage).includes('Converting to')));
   }finally{await rm(dir,{recursive:true,force:true})}
  }
 }
});
