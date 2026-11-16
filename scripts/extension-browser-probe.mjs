import puppeteer from 'puppeteer-core';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const ext=resolve(process.argv[2]||'./dist');
const chrome=process.env.CHROME_BINARY||'/usr/bin/google-chrome';
const report={engine:'YT Stream Downloader Chrome extension',platform:'GitHub Ubuntu Chrome',extensionBuild:existsSync(ext),videoId:'aqz-KE-bpKQ',verifiedMedia:false};
if(!report.extensionBuild){console.log('EXTENSION_SHOWDOWN',JSON.stringify({...report,error:'build folder missing'}));process.exit(0)}
let browser;
try{
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-extensions-except='+ext,'--load-extension='+ext]});
 const page=await browser.newPage();
 const resp=await page.goto('https://www.youtube.com/watch?v=aqz-KE-bpKQ',{waitUntil:'domcontentloaded',timeout:35000}).catch(e=>null);
 report.youtubePageHttp=resp?.status()||null;
 await new Promise(r=>setTimeout(r,20000));
 const state=await page.evaluate(()=>{
  const parser=window.ytParser;
  const streams=Array.isArray(parser?.streams)?parser.streams:[];
  return {parserAvailable:!!parser,streams:streams.length,hasDownloadApi:typeof parser?.download==='function',title:document.title?.slice(0,80),requiresSignIn:/sign in to confirm|not a bot|unusual traffic/i.test(document.body?.innerText||'')};
 });
 Object.assign(report,state);
 report.verifiedMedia=false;
}catch(e){report.error=String(e?.message||e).slice(0,200)}
finally{await browser?.close().catch(()=>{})}
console.log('EXTENSION_SHOWDOWN',JSON.stringify(report));
