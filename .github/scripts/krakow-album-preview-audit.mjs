import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
const label = process.env.KP_AUDIT_LABEL || 'local';
const outDir = process.env.KP_AUDIT_OUT || '/tmp/album-preview-audit';
fs.mkdirSync(outDir,{recursive:true});

const svg=(label,color)=>`data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200"><rect width="900" height="1200" fill="${color}"/><circle cx="680" cy="220" r="110" fill="#efd8a5"/><path d="M0 900L180 600l170 180 180-300 180 220 190-170v670H0z" fill="#66775d"/><text x="48" y="1110" font-family="Arial" font-size="58" fill="white">${label}</text></svg>`).toString('base64')}`;
const now='2026-08-13T08:00:00.000Z';
const state={
  visited:['florian','rynek','maria'],
  missionStatus:{florian:{done:true,updatedAt:now},rynek:{done:true,updatedAt:now},maria:{done:true,updatedAt:now}},
  missionEvidence:{
    florian:{id:'florian',verified:true,photo:svg('Florian','#7b9cab'),title:'Puerta de San Florián',place:'Stare Miasto',comment:'Primer recuerdo vertical para comprobar que la foto se muestra completa.',by:'Ismael',distance:18,completedAt:now,updatedAt:now},
    rynek:{id:'rynek',verified:true,photo:svg('Rynek','#a88367'),title:'Rynek Główny',place:'Plaza del Mercado',comment:'Una foto central del viaje.',by:'Laura',distance:12,completedAt:now,updatedAt:now},
    maria:{id:'maria',verified:true,photo:svg('Mariacki','#788c70'),title:'Basílica de Santa María',place:'Rynek',comment:'Otro recuerdo para comprobar la retícula.',by:'Ambos',distance:25,completedAt:now,updatedAt:now}
  },
  albumPhotos:[{id:'extra-audit',missionId:'rynek',title:'Otra foto de Rynek',place:'Rynek Główny',photo:svg('Extra','#8a7a92'),comment:'Segunda foto de la misma misión.',by:'Laura',verified:false,createdAt:now,completedAt:now,updatedAt:now,source:'album-extra'}],
  memories:[{id:'memory-audit',title:'La primera mañana',note:'Un texto del diario que debe aparecer en la previsualización del álbum y nunca como interfaz de la app.',place:'Cracovia',by:'Ambos',ts:now,updatedAt:now}],
  expenses:[],config:{dailyTarget:21,fixedPaid:0},updatedAt:now
};

const cloud={
  server:structuredClone(state),
  async route(route){
    const url=route.request().url();
    if(url.includes('adventure_get')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(this.server)});
    if(url.includes('adventure_put')){try{const body=JSON.parse(route.request().postData()||'{}');if(body?.p_state)this.server=structuredClone(body.p_state)}catch{};return route.fulfill({status:200,contentType:'application/json',body:'{}'});}
    return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  }
};

const report={target:base,label,generatedAt:new Date().toISOString(),engines:[],failures:[]};
const engines=[['chromium',chromium],['webkit',webkit]];

function addCheck(bucket,name,ok,detail=''){
  bucket.push({name,ok:!!ok,detail});
  if(!ok) report.failures.push(`${name}${detail?` — ${detail}`:''}`);
}

for(const [engineName,engine] of engines){
  const checks=[]; const errors=[]; let browser;
  try{
    browser=await engine.launch({headless:true});
    const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,serviceWorkers:'block'});
    await ctx.addInitScript(s=>{localStorage.setItem('krakowPocketCoop',JSON.stringify(s));localStorage.setItem('krakowPlayer','Ismael')},state);
    await ctx.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**',r=>cloud.route(r));
    const page=await ctx.newPage();
    page.on('pageerror',e=>errors.push(`pageerror:${e.message}`));
    page.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource/.test(m.text()))errors.push(`console:${m.text()}`)});
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>window.KP_ALBUM_NEXT?.version&&window.KP_ALBUM_V5?.html,{timeout:25000});
    await page.evaluate(()=>document.querySelector('.tab[data-panel="diary"]')?.click());
    await page.locator('#kpAlbumV5Open').waitFor({state:'visible',timeout:15000});
    await page.locator('#kpAlbumV5Open').click();
    await page.locator('#kpAlbumV5Dialog[open]').waitFor({state:'visible',timeout:10000});
    const f=page.frameLocator('#kpAlbumV5Frame');
    await f.locator('[data-kp-album-v5="1"]').waitFor({state:'attached',timeout:12000});
    await page.waitForTimeout(700);

    const identity=await f.locator('html').evaluate(()=>({
      title:document.title,
      url:location.href,
      albumRoot:!!document.querySelector('[data-kp-album-v5="1"]'),
      book:!!document.querySelector('.book'),
      cover:!!document.querySelector('.cover'),
      app:!!document.querySelector('.app'),
      bottom:!!document.querySelector('nav.bottom'),
      home:!!document.querySelector('#home'),
      map:!!document.querySelector('#mapPanel'),
      updateBanner:!!document.querySelector('#updateBanner'),
      bodyText:(document.body?.innerText||'').slice(0,500)
    }));
    addCheck(checks,`${engineName}: preview is album document`,identity.albumRoot&&identity.book&&identity.cover,JSON.stringify(identity));
    addCheck(checks,`${engineName}: preview does not embed app UI`,!identity.app&&!identity.bottom&&!identity.home&&!identity.map&&!identity.updateBanner,JSON.stringify(identity));
    addCheck(checks,`${engineName}: preview uses srcdoc document`,identity.url==='about:srcdoc'||identity.url.startsWith('about:srcdoc'),identity.url);

    const shell=await page.locator('#kpAlbumV5Dialog').evaluate(el=>{const r=el.getBoundingClientRect(),fr=el.querySelector('iframe')?.getBoundingClientRect(),head=el.querySelector('.kp-v5-shell>header')?.getBoundingClientRect(),foot=el.querySelector('.kp-v5-shell>footer')?.getBoundingClientRect();return{dialog:{x:r.x,y:r.y,w:r.width,h:r.height},frame:fr&&{x:fr.x,y:fr.y,w:fr.width,h:fr.height},header:head&&{h:head.height},footer:foot&&{h:foot.height},vw:innerWidth,vh:innerHeight}});
    addCheck(checks,`${engineName}: preview shell fits viewport`,shell.dialog.w<=shell.vw+1&&shell.dialog.h<=shell.vh+1&&shell.frame?.w>300&&shell.frame?.h>500,JSON.stringify(shell));

    const visual=await f.locator('html').evaluate(()=>{
      const root=document.documentElement,body=document.body,book=document.querySelector('.book'),cover=document.querySelector('.cover'),toolbar=document.querySelector('.toolbar'),img=document.querySelector('.photo-button img');
      const taps=[...document.querySelectorAll('.toolbar a,.toolbar button,.story-controls button,.overlay-close')].filter(x=>x.getBoundingClientRect().height>0).map(x=>Math.min(x.getBoundingClientRect().width,x.getBoundingClientRect().height));
      const cs=img?getComputedStyle(img):null;
      return{
        cw:root.clientWidth,sw:root.scrollWidth,bw:body.scrollWidth,
        bookW:book?.getBoundingClientRect().width||0,
        coverH:cover?.getBoundingClientRect().height||0,
        toolbarOverflow:toolbar?toolbar.scrollWidth-toolbar.clientWidth:0,
        minTap:taps.length?Math.min(...taps):0,
        photoObjectFit:cs?.objectFit||'',photoHeight:img?.getBoundingClientRect().height||0,photoWidth:img?.getBoundingClientRect().width||0,
        photos:document.querySelectorAll('.photo-card').length,chapters:document.querySelectorAll('.chapter').length,memories:document.querySelectorAll('.memory-card').length
      };
    });
    addCheck(checks,`${engineName}: no horizontal overflow`,visual.sw<=visual.cw+1&&visual.bw<=visual.cw+1,JSON.stringify(visual));
    addCheck(checks,`${engineName}: mobile cover has useful height`,visual.coverH>=560,JSON.stringify(visual));
    addCheck(checks,`${engineName}: toolbar is not clipped`,visual.toolbarOverflow<=1,JSON.stringify(visual));
    addCheck(checks,`${engineName}: controls are touch friendly`,visual.minTap>=40,JSON.stringify(visual));
    addCheck(checks,`${engineName}: vertical photos are contained`,visual.photoObjectFit==='contain'&&visual.photoHeight>visual.photoWidth,JSON.stringify(visual));
    addCheck(checks,`${engineName}: projected multi-photo data visible`,visual.photos===4&&visual.memories===1,JSON.stringify(visual));

    await page.locator('#kpAlbumV5Dialog').screenshot({path:path.join(outDir,`${label}-${engineName}-preview-shell.png`)});
    await f.locator('body').screenshot({path:path.join(outDir,`${label}-${engineName}-album-document.png`),fullPage:true});

    const first=await f.locator('.photo-button').first(); await first.click();
    addCheck(checks,`${engineName}: lightbox opens`,await f.locator('#lightbox').evaluate(e=>e.classList.contains('open')));
    await page.keyboard.press('Escape');
    await f.locator('#storyAlbum').click();
    addCheck(checks,`${engineName}: Story opens`,await f.locator('#storyMode').evaluate(e=>e.classList.contains('open')));
    await f.locator('#storyMode .overlay-close').click();

    for(const width of [320,390,430,768]){
      await page.setViewportSize({width,height:844}); await page.waitForTimeout(100);
      const m=await f.locator('html').evaluate(()=>({cw:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth,toolbar:(()=>{const x=document.querySelector('.toolbar');return x?x.scrollWidth-x.clientWidth:0})()}));
      addCheck(checks,`${engineName}: responsive ${width}px`,m.sw<=m.cw+1&&m.toolbar<=1,JSON.stringify(m));
    }

    await page.setViewportSize({width:390,height:844});
    await page.locator('#kpAlbumV5Close').click();
    addCheck(checks,`${engineName}: preview closes`,await page.locator('#kpAlbumV5Dialog').evaluate(e=>!e.open));
    addCheck(checks,`${engineName}: no runtime errors`,errors.length===0,errors.join(' | '));
    await ctx.close();
  }catch(e){
    errors.push(String(e?.stack||e)); report.failures.push(`${engineName}: fatal — ${String(e?.message||e)}`);
  }finally{if(browser)await browser.close().catch(()=>{});}
  report.engines.push({engine:engineName,checks,errors});
}

fs.writeFileSync(path.join(outDir,`${label}-report.json`),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.failures.length)process.exit(1);
