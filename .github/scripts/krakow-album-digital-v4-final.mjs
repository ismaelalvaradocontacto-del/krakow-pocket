import { chromium, webkit } from 'playwright';
const base=process.env.KP_AUDIT_URL||'http://127.0.0.1:4173/';
const engines=[['chromium',chromium],['webkit',webkit]];
let failed=false;
const photo=c=>`data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 960"><rect width="1280" height="960" fill="${c}"/></svg>`).toString('base64')}`;
const state={visited:['florian','rynek'],missionStatus:{florian:{done:true},rynek:{done:true}},missionEvidence:{florian:{verified:true,photo:photo('#986f49'),by:'Ismael',distance:31,completedAt:'2026-08-11T10:00:00+02:00'},rynek:{verified:true,photo:photo('#73875c'),by:'Laura',distance:22,completedAt:'2026-08-11T12:00:00+02:00'},auschwitz:{verified:true,extra:true,photo:photo('#77736d'),by:'Ambos',distance:64,completedAt:'2026-08-12T08:50:00+02:00'}},memories:[{id:'m1',title:'Una mañana',note:'Un recuerdo.',by:'Laura',ts:'2026-08-11T12:30:00+02:00'}],expenses:[],updatedAt:'2026-08-12T09:00:00+02:00'};
for(const [name,engine] of engines){
 const browser=await engine.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await ctx.addInitScript(s=>localStorage.setItem('krakowPocketCoop',JSON.stringify(s)),state);
 await ctx.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(state)}));
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error'&&!/Failed to fetch|access control checks|Service Worker registration blocked/i.test(m.text()))errors.push(m.text())});
 try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KP_ALBUM_DIGITAL_V4?.version==='4.0'&&window.KP_ALBUM_DIGITAL_AMBIENT_FIX?.version==='1.1'&&window.KP_ALBUM_PHOTO_QUALITY?.version==='1.0'&&window.KP_ALBUM_EXPERIENCE?.digitalAlbum===true,{timeout:20000});
  await page.evaluate(()=>document.querySelector('.tab[data-panel="diary"]')?.click());
  await page.waitForTimeout(300);await page.locator('#kpAlbumOpenExperience').click();await page.waitForSelector('#kpAlbumExperienceDialog[open]');
  const f=page.frameLocator('#kpAlbumExperienceFrame');
  await f.locator('.book.digital-album').waitFor({state:'visible'});
  const photos=await f.locator('.photo-card').count();
  await f.locator('#storyAlbum').click();await f.locator('.digital-play').waitFor({state:'visible'});
  const thumbs=await f.locator('.digital-filmstrip button').count(),p1=await f.locator('.story-position').textContent();
  await f.locator('.digital-filmstrip button').nth(1).click();await page.waitForTimeout(120);const p2=await f.locator('.story-position').textContent();
  await f.locator('.digital-play').click();const playing=await f.locator('.digital-play').evaluate(x=>x.classList.contains('playing'));await f.locator('.digital-play').click();const stopped=await f.locator('.digital-play').evaluate(x=>!x.classList.contains('playing'));
  await page.waitForTimeout(100);const ambient=await f.locator('#storyMode').evaluate(x=>({ready:x.dataset.kpAmbientReady||'',custom:getComputedStyle(x).getPropertyValue('--digital-bg'),background:getComputedStyle(x).backgroundImage}));
  await f.locator('#storyMode').evaluate(x=>{x.classList.remove('open');document.body.style.overflow=''});
  const mobile=[];for(const width of [320,390,430,768]){await page.setViewportSize({width,height:844});const frame=page.frames().find(x=>x!==page.mainFrame()&&x.url()==='about:srcdoc');mobile.push({width,...await frame.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,toolbar:document.querySelector('.toolbar').scrollWidth-document.querySelector('.toolbar').clientWidth,minTap:Math.min(...[...document.querySelectorAll('.toolbar a,.toolbar button')].filter(x=>getComputedStyle(x).display!=='none').map(x=>x.getBoundingClientRect().height))}))})}
  await page.setViewportSize({width:390,height:844});
  const html=await page.evaluate(()=>window.KP_ALBUM_EXPERIENCE.html()),quality=await page.evaluate(()=>({max:window.KP_ALBUM_PHOTO_QUALITY.targetMax,size:window.KP_ALBUM_PHOTO_QUALITY.maxDataLength,safe:window.KP_ALBUM_PHOTO_QUALITY.storageSafeFallback}));
  const mobileOk=mobile.every(x=>x.overflow<=1&&x.toolbar<=1&&x.minTap>=40),ambientOk=ambient.ready==='1'&&(ambient.custom.includes('url')||ambient.background.includes('url')),exported=html.includes('data-kp-digital-album-v4="1"')&&html.includes('data-kp-ambient-fix="1"')&&html.includes('digital-filmstrip')&&html.includes('@media print')&&html.includes('data-kp-offline-compat="1"')&&!html.includes('cdn.jsdelivr.net');
  const ok=photos===3&&thumbs===3&&p1?.includes('1 / 3')&&p2?.includes('2 / 3')&&playing&&stopped&&ambientOk&&mobileOk&&quality.max===1280&&quality.size===300000&&quality.safe&&exported&&errors.length===0;
  const shot=process.env.KP_AUDIT_URL?`/tmp/album-v4-final-${name}-cloudflare.png`:`/tmp/album-v4-final-${name}-local.png`;const frame=page.frames().find(x=>x!==page.mainFrame()&&x.url()==='about:srcdoc');await frame.evaluate(()=>scrollTo(0,0));await page.locator('#kpAlbumExperienceFrame').screenshot({path:shot});
  console.log(JSON.stringify({engine:name,base,ok,photos,thumbs,p1,p2,playing,stopped,ambient,ambientOk,mobile,quality,exported,errors,shot},null,2));if(!ok)failed=true;
 }catch(e){failed=true;console.error(`${name}: ${e.stack||e}`)}
 await browser.close();
}
if(failed)process.exit(1);