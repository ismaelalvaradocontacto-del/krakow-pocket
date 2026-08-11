import { chromium, webkit } from 'playwright';

const base=process.env.KP_AUDIT_URL||'http://127.0.0.1:4173/';
const engines=[['chromium',chromium],['webkit',webkit]];
let failed=false;
const photo=`data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#78604c"/><circle cx="400" cy="290" r="160" fill="#fff" opacity=".25"/></svg>').toString('base64')}`;
const seeded={visited:['florian'],missionStatus:{florian:{done:true,updatedAt:'2026-08-11T10:00:00+02:00'}},missionEvidence:{florian:{verified:true,photo,by:'Ismael',distance:28,completedAt:'2026-08-11T10:00:00+02:00'}},expenses:[],memories:[],config:{dailyTarget:21,fixedPaid:72.16},updatedAt:'2026-08-11T10:00:00+02:00'};

for(const [name,engine] of engines){
  const browser=await engine.launch({headless:true});
  try{
    const live=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await live.addInitScript(state=>localStorage.setItem('krakowPocketCoop',JSON.stringify(state)),seeded);
    await live.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**',async route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(seeded)}));
    const page=await live.newPage();
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>window.KP_ALBUM_EXPERIENCE?.version==='2.0'&&window.KP_ALBUM_IOS_COMPAT?.version==='1.0'&&window.KP_ALBUM_EXPERIENCE?.iosQuickLookCompatible===true,{timeout:18000});
    const html=await page.evaluate(()=>window.KP_ALBUM_EXPERIENCE.html());
    const structural=html.includes('data-kp-offline-compat="1"')&&html.includes('id="albumTop"')&&html.includes('<a id="topAlbum" href="#albumTop">')&&html.includes('<a id="endAlbum" href="#albumEnd">')&&html.includes('<a id="printAlbum" href="#pdfHelp">')&&html.includes('id="pdfHelp"')&&html.includes('kpOfflineReveal');
    await live.close();

    const nojs=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false});
    const offline=await nojs.newPage();
    await offline.setContent(html,{waitUntil:'load'});
    const revealVisible=await offline.locator('.reveal').first().isVisible();
    await offline.locator('#endAlbum').click();
    const endHash=offline.url().endsWith('#albumEnd');
    await offline.locator('#topAlbum').click();
    const topHash=offline.url().endsWith('#albumTop');
    await offline.locator('#printAlbum').click();
    const pdfHash=offline.url().endsWith('#pdfHelp');
    const helpVisible=await offline.locator('#pdfHelp').isVisible();
    const labels=await offline.locator('.toolbar a').allTextContents();
    const ok=structural&&revealVisible&&endHash&&topHash&&pdfHash&&helpVisible&&labels.length===3;
    console.log(JSON.stringify({engine:name,base,ok,structural,revealVisible,endHash,topHash,pdfHash,helpVisible,labels},null,2));
    if(!ok)failed=true;
    await nojs.close();
  }catch(e){failed=true;console.error(`${name}: ${e.stack||e}`)}
  await browser.close();
}
if(failed)process.exit(1);
