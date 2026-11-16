// One bounded diagnostic; no public endpoint and no user credentials.
import {spawn,execFileSync} from 'node:child_process';
import {writeFile,rm} from 'node:fs/promises';
const child=spawn(process.execPath,['src/cobalt.js'],{cwd:'/opt/cobalt/api',env:{PATH:process.env.PATH,HOME:'/tmp',API_URL:'http://127.0.0.1:9097/',API_PORT:'9097',API_LISTEN_ADDRESS:'127.0.0.1'},stdio:['ignore','ignore','ignore']});
const deadline=setTimeout(()=>{child.kill('SIGKILL');process.exit(1)},95000);
try {
 let ready=false;
 for(let i=0;i<20;i++){try {const r=await fetch('http://127.0.0.1:9097/',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}
 if(!ready)throw Error('engine_start_failed');
 const r=await fetch('http://127.0.0.1:9097/',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',downloadMode:'audio',audioFormat:'best'}),signal:AbortSignal.timeout(40000)});
 const result=await r.json();console.log('COBALT_PROBE extraction',r.status,result.status,JSON.stringify(result.error||null));
 if(result.status!=='tunnel'||new URL(result.url).origin!=='http://127.0.0.1:9097')throw Error('no_local_tunnel');
 const media=await fetch(result.url,{signal:AbortSignal.timeout(35000),redirect:'error'});let total=0;const parts=[];
 for await(const p of media.body){total+=p.length;if(total>5*1024*1024)throw Error('probe_size_limit');parts.push(p)}
 await writeFile('/tmp/cobalt-probe.media',Buffer.concat(parts));
 console.log('COBALT_PROBE file',media.status,total,media.headers.get('content-type'));
 const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,codec_type','-of','json','/tmp/cobalt-probe.media'],{timeout:10000,stdio:['ignore','pipe','ignore']}).toString());
 console.log('COBALT_PROBE verified',JSON.stringify(info));
}catch(e){console.log('COBALT_PROBE failed',String(e.message).slice(0,180))}finally{clearTimeout(deadline);child.kill('SIGKILL');await rm('/tmp/cobalt-probe.media',{force:true})}
