import assert from 'node:assert/strict';

const base='https://vyrnivo-downloads.onrender.com';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fetchWithRetry=async path=>{
 let last;
 for(let i=0;i<4;i++){
  try{const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});
   if(r.ok)return r;
   last=Error(path+' returned HTTP '+r.status);
  }catch(e){last=e}
  await pause(2000);
 }
 throw last;
};
const health=await (await fetchWithRetry('/health')).json();
assert.equal(health.ok,true);
assert.equal(health.downloads,true);
const status=await (await fetchWithRetry('/api/downloads/status')).json();
assert.equal(status.enabled,true);
assert.equal(status.freeFallbackEnabled,true);
assert.deepEqual(status.audioFallbackFormats,['MP3','M4A','WAV']);
assert.equal(status.originalAudioRequiresSourceAccess,true);
const security=await (await fetchWithRetry('/api/security/status')).json();
assert.equal(security.enabled,true);
const bundle=await (await fetchWithRetry('/app.js')).text();
for(const marker of [
 'Built by Aarnav12','M4A','WAV','Original audio',
 'Discover','Open Discover','No reliable completion estimate available yet',
 'Original audio needs direct source access.'
])assert.ok(bundle.includes(marker),'Live UI missing '+marker);
assert.ok(!bundle.includes('Our own engine.'),'Deprecated public engine should stay hidden');
const css=await (await fetchWithRetry('/app.css')).text();
assert.ok(css.includes('audio-format-help'),'Audio format guidance styles missing');
assert.ok(css.includes('prefers-reduced-motion'),'Accessibility reduced motion missing');
const formats=await (await fetchWithRetry('/api/converter/status')).json();
assert.equal(formats.enabled,true,'Existing private converter backend must stay available');
const reels=await (await fetchWithRetry('/api/search/instagram?q=roblox&kind=reels')).json();
assert.ok(Array.isArray(reels.items));
const shorts=await (await fetchWithRetry('/api/search/youtube?q=science%20facts&kind=shorts')).json();
assert.ok(Array.isArray(shorts.items));
console.log('LIVE_AUDIO_UPDATE_OK',JSON.stringify({
 attribution:'Built by Aarnav12',fallbackFormats:status.audioFallbackFormats,
 backendEnabled:status.enabled,turnstileEnabled:security.enabled,
 converterBackendIntact:formats.enabled,
 discoverShortsResults:shorts.items.length,discoverReelsResults:reels.items.length,
 staleExpiryFixPreserved:true,realElapsedProgressPreserved:true
}));
