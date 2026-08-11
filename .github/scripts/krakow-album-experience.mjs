import { chromium, webkit } from 'playwright';

const base=process.env.KP_AUDIT_URL||'http://127.0.0.1:4173/';
const engines=[['chromium',chromium],['webkit',webkit]];
let failed=false;
const photo=color=>`data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="${color}"/><circle cx="400" cy="290" r="160" fill="#fff" opacity=".28"/><path d="M120 500L330 300l130 120 90-90 140 170z" fill="#fff" opacity=".55"/></svg>`).toString('base64')}`;
const seeded={visited:['florian','rynek'],missionStatus:{florian:{done:true,updatedAt:'2026-08-11T10:00:00+02:00'},rynek:{done:true,updatedAt:'2026-08-11T12:00:00+02:00'}},missionEvidence:{florian:{verified:true,photo:photo('#986f49'),by:'Ismael',distance:31,completedAt:'2026-08-11T10:00:00+02:00'},rynek:{verified:true,photo:photo('#73875c'),by:'Laura',distance:22,completedAt:'2026-08-11T12:00:00+02:00'},auschwitz:{verified:true,extra:true,photo:photo('#77736d'),by:'Ambos',distance:64,completedAt:'2026-08-12T08:50:00+02:00',comment:'Una visita para recordar y aprender.'}},expenses:[{id:'e1',amount:12.4,category:'food',by:'Ismael',ts:'2026-08-11T13:00:00+02:00'}],memories:[{id:'m1',title:'Una mañana de agosto',note:'Nos quedamos mirando la plaza un rato más.',place:'Rynek Główny',by:'Laura',ts:'2026-08-11T12:30:00+02:00'}],config:{dailyTarget:21,fixedPaid:72.16},updatedAt:'2026-08-12T09:00:00+02:00'};

for(const [name,engine] of engines){
  const browser=await engine.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,serviceWorkers:'block'});
  await context.addInitScript(state=>localStorage.setItem('krakowPocketCoop',JSON.stringify(state)),seeded);
  await context.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**',async route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(seeded)}));
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/Service Worker registration blocked/i.test(m.text()))errors.push(m.text())});
  try{
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>window.KP_ALBUM_EXPERIENCE?.version==='2.0',{timeout:18000});
    await page.waitForSelector('#kpAlbumExperienceCard',{state:'visible',timeout:8000});
    const card=await page.locator('#kpAlbumExperienceCard').evaluate(el=>({text:el.textContent,preview:el.querySelectorAll('.kp-ae-preview img').length,open:!!el.querySelector('#kpAlbumOpenExperience')}));
    await page.locator('#kpAlbumOpenExperience').click();
    await page.waitForSelector('#kpAlbumExperienceDialog[open]',{timeout:8000});
    const iframe=page.frameLocator('#kpAlbumExperienceFrame');
    await iframe.locator('.cover h1').waitFor({state:'visible',timeout:8000});
    const inside={
      title:await iframe.locator('.cover h1').textContent(),
      photos:await iframe.locator('.photo-card').count(),
      respect:await iframe.locator('.respect-badge').count(),
      memories:await iframe.locator('.memory-grid article').count(),
      stats:await iframe.locator('.stat').count(),
      print:await iframe.locator('#printAlbum').count(),
      lightbox:await iframe.locator('#lightbox').count()
    };
    await iframe.locator('.photo-button').first().click();
    const lightboxOpen=await iframe.locator('#lightbox').evaluate(el=>el.classList.contains('open'));
    const html=await page.evaluate(()=>window.KP_ALBUM_EXPERIENCE.html());
    const exportOk=html.includes('KRAKÓW · ISMAEL & LAURA · 2026')&&html.includes('@media print')&&html.includes('IntersectionObserver')&&html.includes('Auschwitz-Birkenau')&&html.includes('Guardar como PDF');
    const api=await page.evaluate(()=>({interactive:KP_ALBUM_EXPERIENCE.interactive,offlineHtml:KP_ALBUM_EXPERIENCE.offlineHtml,pdfViaPrint:KP_ALBUM_EXPERIENCE.pdfViaPrint,lightbox:KP_ALBUM_EXPERIENCE.lightbox,animations:KP_ALBUM_EXPERIENCE.animations}));
    const ok=card.preview===3&&card.open&&inside.photos===3&&inside.respect===1&&inside.memories===1&&inside.stats===4&&inside.print===1&&inside.lightbox===1&&lightboxOpen&&exportOk&&Object.values(api).every(Boolean)&&errors.length===0;
    console.log(JSON.stringify({engine:name,base,ok,card,inside,lightboxOpen,exportOk,api,errors},null,2));
    if(!ok)failed=true;
  }catch(e){failed=true;console.error(`${name}: ${e.stack||e}`)}
  await browser.close();
}
if(failed)process.exit(1);
