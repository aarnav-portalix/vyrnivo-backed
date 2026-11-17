/**
 * Finish a supported backup audio transfer as the format the user selected.
 * The upstream fallback produces MP3. FFmpeg converts locally to M4A or WAV,
 * without asking a second external download service to process the file.
 */
import {spawn} from 'node:child_process';
import {stat,rm} from 'node:fs/promises';
import {join} from 'node:path';

const MAX_BYTES=200*1024*1024;
const MAX_RUNTIME=90000;

export function fallbackAudioSupported(input){
 return input?.mode==='Audio only'&&['MP3','M4A','WAV'].includes(input.container);
}

export function audioTranscodeArgs(input,output,format){
 if(!['M4A','WAV'].includes(format))throw Error('Unsupported audio output type');
 const args=['-hide_banner','-nostdin','-nostats','-loglevel','error','-y','-i',input,
  '-map','0:a:0','-vn','-sn','-dn'];
 if(format==='M4A'){
  args.push('-c:a','aac','-b:a','160k','-threads','2','-movflags','+faststart');
 }else{
  args.push('-c:a','pcm_s16le','-ar','44100','-ac','2','-threads','1');
 }
 return [...args,'-fs',String(MAX_BYTES),output];
}

function launch(command,args,{spawnProcess=spawn,timeout=MAX_RUNTIME,onOutput=()=>{}}={}){
 return new Promise((resolve,reject)=>{
  let settled=false,proc,tail='',timer;
  const finish=error=>{
   if(settled)return;
   settled=true;clearTimeout(timer);
   error?reject(error):resolve(tail);
  };
  try{
   proc=spawnProcess(command,args,{stdio:['ignore','pipe','pipe']});
   proc.stdout?.on('data',data=>{onOutput(data);tail=(tail+data).slice(-1200)});
   proc.stderr?.on('data',data=>{tail=(tail+data).slice(-1200)});
   timer=setTimeout(()=>{proc.kill('SIGKILL');finish(Error('Audio processing timed out.'))},timeout);
   timer.unref?.();
   proc.on('error',()=>finish(Error('Audio processing is unavailable.')));
   proc.on('close',code=>finish(code===0?null:Error('The file could not be converted to the requested audio format.')));
  }catch{finish(Error('Audio processing is unavailable.'))}
 });
}

export async function getAudioDuration(source,{spawnProcess=spawn}={}){
 try{
  let text='';
  await launch('ffprobe',['-v','error','-show_entries','format=duration',
   '-of','default=noprint_wrappers=1:nokey=1',source],{
   spawnProcess,timeout:6500,onOutput:part=>{text=(text+String(part)).slice(0,100)}
  });
  const value=Number.parseFloat(text.trim());
  return Number.isFinite(value)&&value>0?value:null;
 }catch{return null}
}

export async function convertBackupAudio(mp3,dir,format,{
 spawnProcess=spawn,onProgress=()=>{}
}={}){
 if(format==='MP3')return {...mp3,outputFormat:'MP3'};
 if(!['M4A','WAV'].includes(format))throw Error('Original audio is only available from a directly accessible source. Choose MP3, M4A or WAV instead.');
 const destination=join(dir,'media.'+format.toLowerCase());
 try{
  if(format==='WAV'){
   const duration=await getAudioDuration(mp3.path,{spawnProcess});
   // WAV is uncompressed 44.1 kHz stereo PCM; never silently truncate a long file.
   if(duration!==null&&duration*44100*2*2+4096>=MAX_BYTES){
    throw Error('This audio would exceed the 200 MB WAV limit. Choose MP3 or M4A instead.');
   }
  }
  onProgress({stage:'Converting audio to '+format,progressPercent:null,
   progressSource:null,estimatedSecondsRemaining:null,progressUpdatedAt:null});
  await launch('ffmpeg',audioTranscodeArgs(mp3.path,destination,format),{
   spawnProcess,timeout:MAX_RUNTIME
  });
  const details=await stat(destination);
  if(!details.size||details.size>=MAX_BYTES-4096){
   throw Error('Converted audio exceeds the 200 MB limit. Choose MP3 or M4A instead.');
  }
  await rm(mp3.path,{force:true});
  return {...mp3,path:destination,name:'media.'+format.toLowerCase(),
   bytes:details.size,outputFormat:format,convertedLocally:true};
 }catch(error){
  await rm(destination,{force:true});
  throw error;
 }
}
