/**
 * First-party fast conversion. Probe media, stream-copy compatible codecs
 * without re-encoding, and retain a safe FFmpeg transcoding fallback.
 */
import {spawn} from 'node:child_process';
import {rm} from 'node:fs/promises';

const OUTPUT_LIMIT=80*1024*1024;
export const CONVERSION_TIMEOUT_MS=120000;

export function selectConversion(info,format){
 const streams=Array.isArray(info?.streams)?info.streams:[];
 const video=streams.find(x=>x.codec_type==='video');
 const audio=streams.find(x=>x.codec_type==='audio');
 if(format==='MP3')return audio?.codec_name==='mp3'?'copy':'encode';
 return video?.codec_name==='h264'&&(!audio||audio.codec_name==='aac')?'copy':'encode';
}

export function conversionArgs(source,target,format,{copy=false}={}){
 const args=['-hide_banner','-nostdin','-nostats','-loglevel','error','-y','-i',source,'-t','120'];
 if(format==='MP3'){
  args.push('-map','0:a:0','-vn','-codec:a',copy?'copy':'libmp3lame');
  if(!copy)args.push('-q:a','4');
 }else{
  args.push('-map','0:v:0','-map','0:a:0?');
  if(copy)args.push('-codec:v','copy','-codec:a','copy');
  else args.push('-codec:v','libx264','-preset','ultrafast','-crf','29','-pix_fmt','yuv420p','-threads','2','-codec:a','aac','-b:a','128k');
  args.push('-movflags','+faststart');
 }
 return [...args,'-fs',String(OUTPUT_LIMIT),'-progress','pipe:2',target];
}

export async function probeMedia(source,{spawnProcess=spawn}={}){
 return new Promise(resolve=>{
  let settled=false,out='';
  let proc;
  const done=data=>{if(settled)return;settled=true;clearTimeout(timer);resolve(data)};
  const timer=setTimeout(()=>{proc?.kill('SIGKILL');done(null)},6500);
  timer.unref?.();
  try{
   proc=spawnProcess('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name','-of','json',source],{stdio:['ignore','pipe','ignore']});
   proc.stdout?.on('data',chunk=>{out=(out+chunk).slice(0,16000)});
   proc.on('error',()=>done(null));
   proc.on('close',code=>{try{done(code===0?JSON.parse(out):null)}catch{done(null)}});
  }catch{done(null)}
 });
}

function runOnce(source,target,format,{copy=false,spawnProcess=spawn,onProgress=()=>{},durationSeconds=120}={}){
 return new Promise((resolve,reject)=>{
  let settled=false,errorOutput='',tail='',timedOut=false,proc;
  const end=(error)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve()};
  const timer=setTimeout(()=>{timedOut=true;proc?.kill('SIGKILL')},CONVERSION_TIMEOUT_MS);
  try{
   proc=spawnProcess('ffmpeg',conversionArgs(source,target,format,{copy}),{stdio:['ignore','ignore','pipe']});
   proc.stderr?.on('data',chunk=>{
    const data=String(chunk);errorOutput=(errorOutput+data).slice(-850);
    const lines=(tail+data).split(/\r?\n/);tail=lines.pop()||'';
    for(const line of lines){
     const found=line.match(/^out_time_(?:us|ms)=(\d+)/);
     if(!found)continue;
     const current=Number(found[1])/1_000_000;
     if(Number.isFinite(current)&&current>=0&&durationSeconds>0){
      const percentage=Math.min(98,Math.max(36,Math.round(35+60*current/Math.min(120,durationSeconds))));
      onProgress({progressPercent:percentage,stage:copy?'Finishing file':'Converting media'});
     }
    }
   });
   proc.on('error',()=>end(Error('The local converter is unavailable.')));
   proc.on('close',code=>{
    if(code===0)end();
    else if(timedOut)end(Error('Conversion timed out.'));
    else end(Error(/Stream map.*matches no streams|matches no streams|does not contain any stream/i.test(errorOutput)
     ?'The source does not contain media needed for this format.'
     :'This file could not be converted. Try another supported source.'));
   });
  }catch{end(Error('The local converter could not start.'))}
 });
}

export async function convertMedia(source,target,format,{spawnProcess=spawn,onProgress=()=>{}}={}){
 const info=await probeMedia(source,{spawnProcess});
 const duration=Number(info?.format?.duration);
 const durationSeconds=Number.isFinite(duration)&&duration>0?Math.min(duration,120):120;
 const mode=selectConversion(info,format);
 onProgress({stage:mode==='copy'?'Fast-copying compatible media':'Converting media',progressPercent:35,estimatedTotalSeconds:mode==='copy'?22:85});
 if(mode==='copy'){
  try{
   await runOnce(source,target,format,{copy:true,spawnProcess,onProgress,durationSeconds});
   return {method:'stream-copy',durationSeconds};
  }catch{
   await rm(target,{force:true});
   onProgress({stage:'Converting with compatible settings',progressPercent:35,estimatedTotalSeconds:85});
  }
 }
 await runOnce(source,target,format,{copy:false,spawnProcess,onProgress,durationSeconds});
 return {method:'transcode',durationSeconds};
}
