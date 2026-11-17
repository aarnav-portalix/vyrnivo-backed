import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';

test('single-host website and source-only downloads API work without revealing bearer token', {timeout:25000}, async()=>{
  const port=18091;
  const base='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,['hosting/server.mjs'],{
    cwd:process.cwd(),env:{...process.env,PORT:String(port),DOWNLOADS_ENABLED:'true',DOWNLOAD_API_TOKEN:'private-server-token',TURNSTILE_SITE_KEY:'',TURNSTILE_SECRET_KEY:''},
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
    assert.equal(r.headers.get('x-frame-options'),'DENY');
    assert.equal(r.headers.get('x-content-type-options'),'nosniff');
    assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    assert.match(r.headers.get('permissions-policy'),/camera=\(\)/);
    assert.match(await r.text(),/html/i);
    r=await fetch(base+'/api/security/status');
    assert.equal(r.status,200);
    assert.deepEqual(await r.json(),{enabled:false,siteKey:null});
    // Legal policies and Discover are bundled into the deployed public app.
    r=await fetch(base+'/app.js');
    assert.equal(r.status,200);
    const frontend=await r.text();
    for(const phrase of ['Discover','Privacy Policy','Terms of Use','Copyright & Content Removal','Service & Availability Notice','Download service','Source access','Open Discover','One quick security check','Time remaining appears when measurable progress is available']){
      assert.ok(frontend.includes(phrase),'Missing production UI feature: '+phrase);
    }
    assert.equal(frontend.includes('Our own engine.'),false,'Deprecated engine marketing tab must be removed.');
    assert.equal(frontend.includes('Link expired. Submit the video again.')&&frontend.includes('saved(\'dw3lastJob\''),false,'No stale download job should load from browser storage.');
    r=await fetch(base+'/api/downloads/status');
    assert.equal(r.status,200);
    const status=await r.json();
    assert.equal(status.enabled,true);
    // Private conversion API is unavailable without the server-side bearer token.
    r=await fetch(base+'/api/private/status');
    assert.equal(r.status,401);
    r=await fetch(base+'/api/private/status',{headers:{Authorization:'Bearer incorrect'}});
    assert.equal(r.status,401);
    r=await fetch(base+'/api/private/status',{headers:{Authorization:'Bearer private-server-token'}});
    assert.equal(r.status,200);
    assert.deepEqual((await r.json()).formats,['MP4','MP3']);
    r=await fetch(base+'/api/private/conversions',{
      method:'POST',
      headers:{Authorization:'Bearer private-server-token','Content-Type':'application/json'},
      body:JSON.stringify({url:'https://example.org/private.mp4',output:'MP4'})
    });
    assert.equal(r.status,400,'The private API must still reject unauthorized media source hosts.');

    // The public counter uses real same-origin browser heartbeats.
    r=await fetch(base+'/api/presence/status');
    assert.equal(r.status,200);
    assert.equal((await r.json()).online,0);
    const visitorId='123e4567-e89b-42d3-a456-426614174010';
    r=await fetch(base+'/api/presence/heartbeat',{
      method:'POST',headers:{Origin:base,'Content-Type':'application/json'},
      body:JSON.stringify({id:visitorId})
    });
    assert.equal(r.status,200);
    assert.equal((await r.json()).online,1);
    r=await fetch(base+'/api/presence/heartbeat',{
      method:'POST',headers:{Origin:base,'Content-Type':'application/json'},
      body:JSON.stringify({id:visitorId})
    });
    assert.equal(r.status,200);
    assert.equal((await r.json()).online,1,'Repeat heartbeat must not inflate online count.');
    r=await fetch(base+'/api/presence/heartbeat',{
      method:'POST',headers:{Origin:'https://not-vyrnivo.invalid','Content-Type':'application/json'},
      body:JSON.stringify({id:visitorId})
    });
    assert.equal(r.status,403,'Presence writes are same-origin only.');
    // Manual uploads are retired. Source URLs are the only way to create files.
    r=await fetch(base+'/api/files/status');
    assert.equal(r.status,200);
    assert.equal((await r.json()).enabled,false);
    const bytes=Buffer.from('example file');
    r=await fetch(base+'/api/downloads/upload',{
      method:'POST',
      headers:{Origin:base,'Content-Type':'audio/wav','X-File-Name':'sample.wav'},
      body:bytes
    });
    assert.equal(r.status,410);
    r=await fetch(base+'/api/files/upload',{
      method:'POST',
      headers:{Origin:'https://evil.example','Content-Type':'audio/wav'},
      body:bytes
    });
    assert.equal(r.status,403);
    // Source validation fails quickly rather than starting a false download.
    r=await fetch(base+'/api/downloads',{
      method:'POST',
      headers:{Origin:base,'Content-Type':'application/json'},
      body:JSON.stringify({url:'https://example.com/not-a-video',mode:'Video + audio',quality:'720p',container:'MP4'})
    });
    assert.equal(r.status,400);
  }finally{
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(2000)]);
    if(child.exitCode===null)child.kill('SIGKILL');
  }
});
