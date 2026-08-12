import { chromium, webkit } from 'playwright';

const base=process.env.KP_AUDIT_URL||'http://127.0.0.1:4173/';
const engines=[['chromium',chromium],['webkit',webkit]];
let failed=false;
const photo=color=>`data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#d9c08c"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><circle cx="780" cy="260" r="170" fill="#fff" opacity=".22"/><path d="M0 820L330 460l210 210 150-170 510 320z" fill="#fff" opacity=".45"/></svg>`).toString('base64')}`;
const seeded={visited:['florian','rynek'],missionStatus:{florian:{done:true,updatedAt:'2026-08-11T10:00:00+02:00'},rynek:{done:true,updatedAt:'2026-08-11T12:00:00+02:00'}},missionEvidence:{florian:{verified:true,photo:photo('#986f49'),by:'Ismael',distance:31,completedAt:'2026-08-11T10:00:00+02:00',comment:'La primera puerta de la aventura.'},rynek:{verified:true,photo:photo('#73875c'),by:'Laura',distance:22,completedAt:'2026-08-11T12:00:00+02:00',comment:'La plaza parecía no terminar nunca.'},auschwitz:{verified:true,extra:true,photo:photo('#77736d'),by:'Ambos',distance:64,completedAt:'2026-08-12T08:50:00+02:00',comment:'Una visita para recordar y aprender.'}},expenses:[{id:'e1',amount:12.4,category:'food',by:'Ismael',ts:'2026-08-11T13:00:00+02:00'}],memories:[{id:'m1',title:'Una mañana de agosto',note:'Nos quedamos mirando la plaza un rato más.',place:'Rynek Główny',by:'Laura',ts:'2026-08-11T12:30:00+02:00'}],config:{dailyTarget:21,fixedPaid:72.16},updatedAt:'2026-08-12T09:00:00+02:00'};

for(const [name,engine] of engines){
  const browser=await engine.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});
  await context.addInitScript(state=>localStorage.setItem('krakowPocketCoop',JSON.stringify(state)),seeded);
  await context.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**',async route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(seeded)}));
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/Service Worker registration blocked|Failed to fetch|access control checks/i.test(m.text()))errors.push(m.text())});
  try{
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>window.KP_ALBUM_EXPERIENCE?.version==='3.0',{timeout:18000});
    await page.evaluate(()=>document.querySelector('.tab[data-panel="diary"]')?.click());
    await page.waitForTimeout(300);
    await page.waitForSelector('#kpAlbumExperienceCard',{state:'visible',timeout:8000});
    const card=await page.locator('#kpAlbumExperienceCard').evaluate(el=>({preview:el.querySelectorAll('.kp-ae-preview img').length,open:!!el.querySelector('#kpAlbumOpenExperience'),share:!!el.querySelector('#kpAlbumQuickShare'),progress:!!el.querySelector('.kp-ae-progress')}));
    await page.locator('#kpAlbumOpenExperience').click();
    await page.waitForSelector('#kpAlbumExperienceDialog[open]',{timeout:8000});
    const iframe=page.frameLocator('#kpAlbumExperienceFrame');
    await iframe.locator('.cover h1').waitFor({state:'visible',timeout:8000});
    const inside={title:await iframe.locator('.cover h1').textContent(),photos:await iframe.locator('.photo-card').count(),respect:await iframe.locator('.respect-badge').count(),memories:await iframe.locator('.memory-grid article').count(),stats:await iframe.locator('.stat').count(),toc:await iframe.locator('.toc-grid a').count(),print:await iframe.locator('#printAlbum').count(),lightbox:await iframe.locator('#lightbox').count(),story:await iframe.locator('#storyAlbum').count(),pdfHelp:await iframe.locator('#pdfHelp').count()};
    await iframe.locator('.photo-button').first().click();
    const firstSrc=await iframe.locator('#lightbox img').getAttribute('src');
    await iframe.locator('.lightbox-next').click();
    const secondSrc=await iframe.locator('#lightbox img').getAttribute('src');
    const lightboxOk=await iframe.locator('#lightbox').evaluate(el=>el.classList.contains('open'))&&firstSrc!==secondSrc;
    await iframe.locator('#lightbox .overlay-close').click();
    await iframe.locator('#storyAlbum').click();
    const storyOpen=await iframe.locator('#storyMode').evaluate(el=>el.classList.contains('open'));
    const storyPos1=await iframe.locator('.story-position').textContent();
    await iframe.locator('#storyNext').click();
    const storyPos2=await iframe.locator('.story-position').textContent();
    await iframe.locator('#storyMode .overlay-close').click();
    const storyOk=storyOpen&&storyPos1?.includes('1 / 3')&&storyPos2?.includes('2 / 3');
    const mobileChecks=[];
    for(const width of [320,390,430,768]){
      await page.setViewportSize({width,height:844});
      const frame=page.frames().find(f=>f!==page.mainFrame()&&f.url()==='about:srcdoc');
      const overflow=await frame.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      const toolbarMin=await frame.evaluate(()=>Math.min(...[...document.querySelectorAll('.toolbar a,.toolbar button')].filter(x=>getComputedStyle(x).display!=='none').map(x=>x.getBoundingClientRect().height)));
      mobileChecks.push({width,overflow,toolbarMin});
    }
    await page.setViewportSize({width:390,height:844});
    const html=await page.evaluate(()=>window.KP_ALBUM_EXPERIENCE.html());
    const exportOk=html.includes('data-kp-offline-compat="1"')&&html.includes('id="albumTop"')&&html.includes('id="albumIndex"')&&html.includes('story-mode')&&html.includes('@media print')&&html.includes('@media(prefers-reduced-motion:reduce)')&&html.includes('Auschwitz-Birkenau')&&html.includes('id="pdfHelp"');
    const api=await page.evaluate(()=>({interactive:KP_ALBUM_EXPERIENCE.interactive,offlineHtml:KP_ALBUM_EXPERIENCE.offlineHtml,pdfViaPrint:KP_ALBUM_EXPERIENCE.pdfViaPrint,lightbox:KP_ALBUM_EXPERIENCE.lightbox,storyMode:KP_ALBUM_EXPERIENCE.storyMode,noJsReady:KP_ALBUM_EXPERIENCE.noJsReady,accessible:KP_ALBUM_EXPERIENCE.accessible,responsive:KP_ALBUM_EXPERIENCE.responsive,printReady:KP_ALBUM_EXPERIENCE.printReady,animations:KP_ALBUM_EXPERIENCE.animations}));
    const screenshot=process.env.KP_AUDIT_URL?`/tmp/album-v3-${name}-cloudflare.png`:`/tmp/album-v3-${name}-local.png`;
    await page.locator('#kpAlbumExperienceFrame').screenshot({path:screenshot});
    const mobileOk=mobileChecks.every(x=>x.overflow<=1&&x.toolbarMin>=40);
    const ok=card.preview===3&&card.open&&card.share&&card.progress&&inside.photos===3&&inside.respect===1&&inside.memories===1&&inside.stats===4&&inside.toc===2&&inside.print===1&&inside.lightbox===1&&inside.story===1&&inside.pdfHelp===1&&lightboxOk&&storyOk&&mobileOk&&exportOk&&Object.values(api).every(Boolean)&&errors.length===0;
    console.log(JSON.stringify({engine:name,base,ok,card,inside,lightboxOk,storyOk,mobileChecks,exportOk,api,errors,screenshot},null,2));
    if(!ok)failed=true;
  }catch(e){failed=true;console.error(`${name}: ${e.stack||e}`)}
  await browser.close();
}
if(failed)process.exit(1);
