/* Offline app shell only. Never cache user links, API responses, or media files. */
const CACHE='vyrnivo-shell-v1';
const ASSETS=['/','/app.css','/app.js','/favicon.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()]))});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname==='/health')return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('/',copy)).catch(()=>{})}return response}).catch(()=>caches.match('/')));
  return;
 }
 if(!ASSETS.includes(url.pathname))return;
 event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(url.pathname,copy)).catch(()=>{})}return response}).catch(()=>caches.match(request)));
});
