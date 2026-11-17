import assert from 'node:assert/strict';
const base='https://vyrnivo-downloads.onrender.com';
const get=async(path)=>{
 const r=await fetch(base+path,{signal:AbortSignal.timeout(20000),headers:{Accept:'*/*'}});
 assert.equal(r.status,200,path+' must be available');
 return r.text();
};
const html=await get('/');
assert.match(html,/app\.js/,'Frontend bundle should load');
const js=await get('/app.js');
const css=await get('/app.css');
const icon=await get('/favicon.svg');
assert.match(html,/rel="icon"[^>]*href="\/favicon.svg"/);
assert.match(icon,/viewBox="0 0 64 64"/);
assert.match(icon,/linearGradient/);
assert.match(js,/Frequently asked questions/);
assert.match(js,/Do YouTube downloads work/);
assert.match(css,/\.faq-item/);
for(const label of ['Discover','Main engine','Backup engine','Open Discover','Privacy Policy','Terms of Use','Copyright & Content Removal','Service & Availability Notice','Built by Aarnav','One quick security check','No reliable completion estimate available yet']){
 assert.ok(js.includes(label),'Live app is missing '+label);
}
assert.doesNotMatch(js,/WebDownloader|yt-dlp/, 'Public UI should not reveal downloader implementation');
assert.doesNotMatch(js,/Our own engine\./,'Retired Our Engine page should be gone');
assert.doesNotMatch(js,/About <b>.*<\/b> left/,'No fabricated fixed countdown');
assert.ok(css.includes('.legal-center'),'Live CSS must style policies');
assert.ok(css.includes('.discover-hub'),'Live CSS must style Discover');
const homepage=await fetch(base+'/',{signal:AbortSignal.timeout(20000)});
assert.equal(homepage.headers.get('x-frame-options'),'DENY');
assert.equal(homepage.headers.get('x-content-type-options'),'nosniff');
assert.match(homepage.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
const botConfig=JSON.parse(await get('/api/security/status'));
assert.equal(typeof botConfig.enabled,'boolean');
if(botConfig.enabled)assert.ok(botConfig.siteKey,'Enabled Turnstile must publish a site key, not the secret.');
else assert.equal(botConfig.siteKey,null);
const engines=JSON.parse(await get('/api/downloads/status'));
assert.equal(engines.enabled,true);
const presence=JSON.parse(await get('/api/presence/status'));
assert.equal(presence.approximate,true);
assert.equal(typeof presence.online,'number');

assert.match(css,/backdrop-filter/);

assert.match(js,/YouTube/);
assert.match(js,/Instagram/);
assert.match(js,/Download/);
assert.match(js,/Paste/);
assert.doesNotMatch(js,/How it works/);
assert.doesNotMatch(js,/Experimental public Reel discovery/);
assert.match(css,/@media\s*\(max-width:520px\)/);
assert.match(css,/prefers-reduced-motion/);
assert.match(css,/safe-area-inset-bottom/);
const search=await fetch(base+'/api/search/instagram?q='+encodeURIComponent('roblox rivals'),{signal:AbortSignal.timeout(25000)});
assert.equal(search.status,200);
const data=await search.json();
assert.ok(Array.isArray(data.items),'Instagram results must be an array');
console.log('LIVE_UI_OK',JSON.stringify({threeTabs:true,privacyAndTerms:true,privateEngineLabels:true,unifiedInstagram:true,responsiveCSS:true,customLogo:true,faqs:true,liquidGlass:true,securityHeaders:true,botConfigEnabled:botConfig.enabled,instagramResults:data.items.length}));
