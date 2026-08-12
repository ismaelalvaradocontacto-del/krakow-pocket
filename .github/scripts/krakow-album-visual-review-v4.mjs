import { chromium, webkit } from 'playwright';

const base=process.env.KP_AUDIT_URL||'http://127.0.0.1:4173/';
const engines=[['chromium',chromium],['webkit',webkit]];
const scene=(sky,ground,accent,label)=>`data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 960"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="#f0d5a8"/></linearGradient></defs><rect width="1280" height="960" fill="url(#s)"/><circle cx="980" cy="170" r="95" fill="#fff4c7" opacity=".8"/><path d="M0 620L210 420l180 145 210-250 210 220 160-175 310 280v320H0z" fill="${ground}"/><path d="M0 720Q250 650 460 745T920 700T1280 735v225H0z" fill="${accent}" opacity=".88"/><rect x="80" y="60" width="330" height="70" rx="18" fill="#1b1512" opacity=".56"/><text x="110" y="108" font-family="Arial" font-size="34" fill="white">${label}</text></svg>`).toString('base64')}`;
const photos={
 florian:scene('#88b9c8','#7d6a4c','#879c60','Puerta de San Florián'),
 rynek:scene('#9dc3d2','#a36f4d','#c6a66c','Rynek Główny'),
 maria:scene('#95b7c5','#7e5442','#b68d58','Santa María'),
 maius:scene('#89aebc','#725743','#9b7651','Collegium Maius'),
 wawel:scene('#90b7c7','#76634d','#6f8b65','Wawel'),
 auschwitz:scene('#9c9b94','#69655e','#88827a','Auschwitz-Birkenau')
};
const state={visited:['florian','rynek','maria','maius','wawel'],missionStatus:{florian:{done:true},rynek:{done:true},maria:{done:true},maius:{done:true},wawel:{done:true}},missionEvidence:{
 florian:{verified:true,photo:photos.florian,by:'Ismael',distance:31,completedAt:'2026-08-11T10:00:00+02:00',comment:'La aventura empezó cruzando una puerta de verdad.'},
 rynek:{verified:true,photo:photos.rynek,by:'Laura',distance:22,completedAt:'2026-08-11T11:15:00+02:00',comment:'Una plaza enorme y un detalle pequeño que ya forma parte del viaje.'},
 maria:{verified:true,photo:photos.maria,by:'Ismael',distance:18,completedAt:'2026-08-11T12:00:00+02:00',comment:'Entre torres y hejnał, mirar hacia arriba tenía recompensa.'},
 maius:{verified:true,photo:photos.maius,by:'Laura',distance:27,completedAt:'2026-08-11T13:20:00+02:00',comment:'Un patio escondido y una pausa en mitad del centro.'},
 wawel:{verified:true,photo:photos.wawel,by:'Ambos',distance:52,completedAt:'2026-08-11T16:40:00+02:00',comment:'La colina hizo el resto y el Vístula quedó de testigo.'},
 auschwitz:{verified:true,extra:true,photo:photos.auschwitz,by:'Ambos',distance:64,completedAt:'2026-08-12T08:50:00+02:00',comment:'Una visita para recordar y aprender.'}
},memories:[{id:'m1',title:'La primera tarde',note:'Nos sentamos un rato sin mirar el reloj y acabamos hablando de todo lo que ya habíamos visto.',place:'Planty',by:'Laura',ts:'2026-08-11T18:10:00+02:00'},{id:'m2',title:'Algo que nos hizo gracia',note:'Un pequeño momento que probablemente no saldría en ninguna guía, pero sí queríamos conservar.',place:'Stare Miasto',by:'Ismael',ts:'2026-08-11T19:00:00+02:00'}],expenses:[{id:'e1',amount:24.6,category:'food',ts:'2026-08-11T14:00:00+02:00'}],updatedAt:'2026-08-12T09:00:00+02:00'};

for(const [name,engine] of engines){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});
 await context.addInitScript(s=>localStorage.setItem('krakowPocketCoop',JSON.stringify(s)),state);
 await context.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(state)}));
 const page=await context.newPage();
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.KP_ALBUM_DIGITAL_V4?.version==='4.0'&&window.KP_ALBUM_DIGITAL_AMBIENT_FIX?.version==='1.1',{timeout:20000});
 await page.evaluate(()=>document.querySelector('.tab[data-panel="diary"]')?.click());
 await page.waitForTimeout(300);await page.locator('#kpAlbumOpenExperience').click();await page.waitForSelector('#kpAlbumExperienceDialog[open]');
 const f=page.frameLocator('#kpAlbumExperienceFrame');await f.locator('.book.digital-album').waitFor({state:'visible'});
 const frame=page.frames().find(x=>x!==page.mainFrame()&&x.url()==='about:srcdoc');
 const prefix=process.env.KP_AUDIT_URL?`/tmp/album-visual-${name}-cloudflare`:`/tmp/album-visual-${name}-local`;
 const shot=async(name2)=>page.locator('#kpAlbumExperienceFrame').screenshot({path:`${prefix}-${name2}.png`});
 await frame.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(120);await shot('cover');
 await f.locator('.chapter').first().scrollIntoViewIfNeeded();await page.waitForTimeout(160);await shot('chapter');
 await f.locator('.memories').scrollIntoViewIfNeeded();await page.waitForTimeout(160);await shot('memories');
 await f.locator('#storyAlbum').click();await f.locator('.digital-play').waitFor({state:'visible'});await page.waitForTimeout(140);await shot('cinema');
 await f.locator('#storyMode').evaluate(el=>{el.classList.remove('open');document.body.style.overflow=''});
 await f.locator('#albumEnd').scrollIntoViewIfNeeded();await page.waitForTimeout(160);await shot('ending');
 const metrics=await frame.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,chapters:document.querySelectorAll('.chapter').length,photos:document.querySelectorAll('.photo-card').length,memories:document.querySelectorAll('.memory-card').length,digital:document.querySelector('.book')?.classList.contains('digital-album'),toolbarOverflow:document.querySelector('.toolbar').scrollWidth-document.querySelector('.toolbar').clientWidth}));
 console.log(JSON.stringify({engine:name,base,metrics,prefix},null,2));
 await browser.close();
}
