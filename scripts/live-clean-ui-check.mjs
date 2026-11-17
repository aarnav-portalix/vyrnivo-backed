import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const base='https://vyrnivo-downloads.onrender.com';
const source=readFileSync('src/App.jsx','utf8');
assert.match(source,/const \[job,setJob\]=useState\(null\)/,'Fresh session must not resurrect an expired localStorage job');
assert.doesNotMatch(source,/saved\('dw3lastJob'/,'Old job must not be restored from localStorage');
assert.doesNotMatch(source,/persist\('dw3lastJob'/,'Expired jobs must not be persisted in localStorage');
assert.match(source,/localStorage\.removeItem\('dw3lastJob'\)/);
assert.match(source,/const pages=\['download','discover','about'\]/);
assert.doesNotMatch(source,/page==='engine'/);
const get=async path=>{
 const res=await fetch(base+path,{signal:AbortSignal.timeout(25000)});
 assert.equal(res.status,200,path+' returned '+res.status);
 return res;
};
const html=await (await get('/')).text();
assert.match(html,/app\.js/);
const js=await (await get('/app.js')).text();
const css=await (await get('/app.css')).text();
assert.ok(js.includes('No reliable completion estimate available yet'),'Site is still serving the old fake countdown');
assert.ok(js.includes('Elapsed'),'Elapsed timer is missing');
assert.ok(!js.includes('Our own engine.'),'Deprecated public own-engine UI is still visible');
assert.ok(js.includes('Discover')&&js.includes('About')&&js.includes('Download'));
assert.match(css,/\.loading-track span\.measured/);
assert.match(css,/@media\(max-width:520px\)/);
assert.match(css,/prefers-reduced-motion/);
const health=await (await get('/health')).json();
assert.equal(health.ok,true);
assert.equal(health.downloads,true);
const download=await (await get('/api/downloads/status')).json();
assert.equal(download.enabled,true);
const bot=await (await get('/api/security/status')).json();
assert.equal(bot.enabled,true,'Cloudflare should still be activated');
const reel=await (await get('/api/search/instagram?q=wildlife&kind=reels')).json();
assert.ok(Array.isArray(reel.items));
const short=await (await get('/api/search/youtube?q=science%20facts&kind=shorts')).json();
assert.ok(Array.isArray(short.items));
console.log('LIVE_CLEAN_UI_PASS',JSON.stringify({
 threeTabs:true,oldExpiredJobRestore:false,removedOwnEngineTab:true,
 fabricatedCountdownRemoved:true,measuredProgress:true,
 botCheckEnabled:bot.enabled,downloadsEnabled:download.enabled,
 instagramResults:reel.items.length,youtubeShortsResults:short.items.length
}));
