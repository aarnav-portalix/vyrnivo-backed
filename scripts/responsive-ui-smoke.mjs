import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const port=18879;
const base='http://127.0.0.1:'+port;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const server=spawn(process.execPath,['hosting/server.mjs'],{
 env:{...process.env,PORT:String(port),DOWNLOADS_ENABLED:'true',TURNSTILE_SITE_KEY:'',
 TURNSTILE_SECRET_KEY:'',DOWNLOAD_API_TOKEN:'test-only-responsive-browser-token'},
 stdio:['ignore','ignore','pipe']
});
let stderr='';
server.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-2500)});
let browser;
try{
 let ready=false;
 for(let i=0;i<70;i++){
  if(server.exitCode!==null)throw Error('Backend exited early: '+stderr);
  try{const r=await fetch(base+'/health');if(r.ok){ready=true;break}}catch{}
  await pause(200);
 }
 assert.ok(ready,'Local website should start: '+stderr);
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 await mkdir('responsive-artifacts',{recursive:true});
 const configurations=[
  ['small-mobile',320,700,true],['mobile',375,812,true],
  ['large-mobile',430,932,true],['tablet',768,1024,true],
  ['desktop',1440,900,false]
 ];
 for(const [device,width,height,mobile] of configurations){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,
   isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err.message)));
  await page.goto(base+'/#download',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('.panel').waitFor();
  assert.equal(await page.locator('.tabs .tab').count(),3,'Three tabs required');
  assert.equal(await page.locator('.file-label').count(),0,'Empty form must not show filename');
  assert.equal(await page.getByText('Link expired. Submit the video again.').count(),0,
   'Stale expired jobs must not appear on startup');
  await page.getByRole('textbox',{name:'Video URL'}).fill('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.getByRole('button',{name:'Audio',exact:true}).click();
  await page.locator('button.options-btn').click();
  await page.getByLabel('File type').selectOption({label:'M4A'});
  assert.match(await page.locator('.options-btn').innerText(),/M4A/);
  assert.equal(await page.getByLabel('Audio quality').inputValue(),'320 kbps');
  await page.getByLabel('Audio quality').selectOption({label:'120 kbps'});
  assert.match(await page.locator('.options-btn').innerText(),/120 kbps/);
  await page.screenshot({path:'responsive-artifacts/'+device+'-download.png',fullPage:true,animations:'disabled'});
  await page.locator('.tabs .tab').filter({hasText:'Discover'}).click();
  await page.locator('.discover-filters button').filter({hasText:'Shorts'}).click();
  assert.equal(await page.locator('.discover-filters .active').innerText(),'Shorts');
  await page.screenshot({path:'responsive-artifacts/'+device+'-discover.png',fullPage:true,animations:'disabled'});
  const scroll=await page.evaluate(()=>({inner:window.innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(scroll.scroll<=scroll.inner+3,device+' horizontal overflow: '+JSON.stringify(scroll));
  assert.deepEqual(errors,[],device+' page errors');
  console.log('RESPONSIVE_UI_OK',JSON.stringify({device,width,height,scrollWidth:scroll.scroll,jsErrors:errors.length}));
  await context.close();
 }
 // Desktop fine-pointer spotlight has a real input-response.
 const desktop=await browser.newContext({viewport:{width:1280,height:860},reducedMotion:'no-preference'});
 const page=await desktop.newPage();
 await page.goto(base+'/#download',{waitUntil:'domcontentloaded'});
 const panel=page.locator('.surface-interactive');
 const box=await panel.boundingBox();
 assert.ok(box);
 await page.mouse.move(box.x+box.width*.8,box.y+box.height*.3);
 await pause(100);
 const px=await panel.evaluate(el=>el.style.getPropertyValue('--glow-x'));
 assert.ok(Number.parseInt(px)>65,'Desktop panel should track pointer position');
 console.log('DESKTOP_POINTER_RESPONSE_OK',px);
 await desktop.close();
}catch(error){
 console.error('RESPONSIVE_UI_FAILED',error);
 process.exitCode=1;
}finally{
 await browser?.close();
 server.kill('SIGTERM');
 await Promise.race([new Promise(r=>server.once('exit',r)),pause(3000)]);
 if(server.exitCode===null)server.kill('SIGKILL');
}
