import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';

test('single-host website and downloads API work without revealing bearer token', {timeout:25000}, async()=>{
  const port=18091;
  const base='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,['hosting/server.mjs'],{
    cwd:process.cwd(),env:{...process.env,PORT:String(port),DOWNLOADS_ENABLED:'true',DOWNLOAD_API_TOKEN:'private-server-token'},
    stdio:['ignore','ignore','pipe']
  });
  let errors='';
  child.stderr.on('data',b=>{errors+=String(b).slice(0,2000)});
  try{
    let ready=false;
    for(let attempt=0;attempt<60;attempt++){
      if(child.exitCode!==null)throw Error('Server crashed: '+errors);
      try{const r=await fetch(base+'/health');if(r.ok){ready=true;break}}catch{}
      await pause(100);
    }
    assert.equal(ready,true,'Server must become healthy. '+errors);
    let r=await fetch(base+'/');
    assert.equal(r.status,200);
    assert.match(await r.text(),/html/i);
    r=await fetch(base+'/api/downloads/status');
    assert.equal(r.status,200);
    const status=await r.json();
    assert.equal(status.enabled,true);
    // Same-origin users can upload their own media even when backend bearer auth is configured.
    const bytes=Buffer.from('RIFF\x0c\x00\x00\x00WAVEfmt ');
    r=await fetch(base+'/api/downloads/upload',{
      method:'POST',
      headers:{Origin:base,'Content-Type':'audio/wav','X-File-Name':'sample.wav'},
      body:bytes
    });
    assert.equal(r.status,201,await r.clone().text());
    const job=await r.json();
    assert.equal(job.state,'ready');
    r=await fetch(base+job.downloadUrl);
    assert.equal(r.status,200);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);
    // A cross-site POST cannot use the downloader to consume server resources.
    r=await fetch(base+'/api/downloads/upload',{
      method:'POST',
      headers:{Origin:'https://evil.example','Content-Type':'audio/wav','X-File-Name':'sample.wav'},
      body:bytes
    });
    assert.equal(r.status,403);
  }finally{
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(2000)]);
    if(child.exitCode===null)child.kill('SIGKILL');
  }
});
