import {spawn} from 'node:child_process';

/** Inspect actual output height; never infer it from a requested dropdown value. */
export async function probeVideoHeight(path,{spawnProcess=spawn,timeoutMs=4500}={}){
 return new Promise(resolve=>{
  let output='',settled=false;
  const done=value=>{if(!settled){settled=true;resolve(value)}};
  let proc;
  try{
   proc=spawnProcess('ffprobe',['-v','error','-select_streams','v:0',
    '-show_entries','stream=height','-of','default=noprint_wrappers=1:nokey=1',path],
    {stdio:['ignore','pipe','ignore']});
  }catch{return done(null)}
  proc.stdout?.on('data',chunk=>{output=(output+String(chunk)).slice(0,40)});
  proc.on('error',()=>done(null));
  proc.on('close',code=>{
   const n=Number(output.trim());
   done(code===0&&Number.isInteger(n)&&n>=120&&n<=10000?n:null);
  });
  const timer=setTimeout(()=>{proc.kill?.('SIGKILL');done(null)},timeoutMs);
  timer.unref?.();
  proc.on('close',()=>clearTimeout(timer));
 });
}
