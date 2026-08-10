const CACHE="krakow-pocket-v3-20260810g";
const CORE=["./","./index.html","./styles.css","./data.js","./app.js","./enhancements.js","./enhancements.css","./trip-tools.js","./trip-tools.css","./manifest.webmanifest","./icon-192.svg","./icon-512.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)))});
self.addEventListener("activate",event=>{event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))]))});
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(event.request.mode==="navigate"){
    event.respondWith(fetch(event.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(cache=>cache.put("./index.html",copy));return resp}).catch(()=>caches.match("./index.html")));
    return;
  }
  if(url.origin===self.location.origin){event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return resp})))}
});
