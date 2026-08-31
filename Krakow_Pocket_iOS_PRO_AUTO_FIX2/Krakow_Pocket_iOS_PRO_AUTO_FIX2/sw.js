const CACHE="pocket-v34-vehicle-makes-2026-20260831";
const CORE=["./","./index.html","./instalar.html","./administrar.html","./varsovia-ultimo-dia.html","./regreso-casa-31-agosto.html","./casita.html","./casita.css","./casita-config.js","./casita.js","./casita-bridge.js","./vehiculos.html","./vehiculos.css","./vehiculos.js","./vehiculos-v2.css","./vehiculos-v2.js","./ga-brand.js","./date-fields.css","./date-fields.js","./vehicle-scan.css","./vehicle-scan.js","./vehicle-scan-fast.js","./vehicle-brand-rescue.js","./traspaso.css","./traspaso.webmanifest","./traspaso-icon.svg","./assets/vehiculos/mandato.pdf","./assets/vehiculos/contrato-particulares.pdf","./assets/vehiculos/contrato-rehabilitacion.pdf","./hub.css","./hub.js","./pages.js","./pocket-auth.css","./pocket-auth.js","./pocket-network.js","./pocket-admin.js","./krakow-pocket.html","./styles.css","./game.css","./storybook.css","./compat.css","./profiles.css","./mobile-hotfix.css","./data.js","./compat.js","./state-bridge.js","./profile-photo.js","./mission-proof.js","./mission-proof-guard.js","./auschwitz-extra.js","./album-photo-quality.js","./album-v5.js","./album-next.js","./auto-location.js","./auto-heading.js","./network-status.js","./world-art-stability.js","./interaction-fix.js","./mission-fix.js","./celebration-guard.js","./celebration-stability.js","./runtime.js","./stability.js","./landmark-art-fix.js","./app.js","./enhancements.js","./game.js","./visuals.js","./assets/game-art.svg","./assets/landmarks-v2.svg","./assets/characters.svg","./assets/village.svg","./manifest.webmanifest","./pocket-icon-v2-192.svg","./pocket-icon-v2-512.svg","./pocket-icon-192.svg","./pocket-icon-512.svg","./icon-192.svg","./icon-512.svg"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)))});
self.addEventListener("activate",e=>{e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))]))});
self.addEventListener("message",e=>{if(e.data?.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(u.hostname.endsWith(".supabase.co")){e.respondWith(fetch(e.request));return}
  if(e.request.method!=="GET")return;
  if(u.hostname==="cdn.jsdelivr.net"&&(u.pathname.includes("leaflet@1.9.4")||u.pathname.includes("pdf-lib@1.17.1")||u.pathname.includes("tesseract.js@5")||u.pathname.includes("tesseract.js-core")||u.pathname.includes("@tesseract.js-data/"))){
    e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r})));
    return;
  }
  if(e.request.mode==="navigate"){
    e.respondWith(fetch(e.request,{cache:"no-store"}).then(r=>{
      const x=r.clone();
      if(u.origin===self.location.origin)caches.open(CACHE).then(c=>c.put(e.request,x));
      return r;
    }).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||caches.match("./index.html",{ignoreSearch:true}))));
    return;
  }
  if(u.origin!==self.location.origin)return;
  const fresh=/\.(?:js|css|svg|webmanifest)$/i.test(u.pathname);
  if(fresh){
    e.respondWith(fetch(e.request,{cache:"no-store"}).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})));
    return;
  }
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r})));
});