import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

const base=process.env.KP_AUDIT_URL||'http://127.0.0.1:4173/';
const engines=[['chromium',chromium],['webkit',webkit]];
const ids=['florian','rynek','maria','maius','wawel','dragon'];
const tiny=label=>`data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#d7b982"/><text x="40" y="300" font-size="48">${label}</text></svg>`).toString('base64')}`;
const stamp=i=>`2026-08-${i<4?'11':'12'}T${String(9+i).padStart(2,'0')}:00:00+02:00`;
const clone=x=>JSON.parse(JSON.stringify(x));

function makeState(){
  const missionEvidence={},missionStatus={};
  ids.forEach((id,i)=>{
    missionEvidence[id]={id,verified:true,photo:tiny(id),title:`Recuerdo ${id}`,place:id,comment:`Comentario ${id}`,by:i%2?'Laura':'Ismael',distance:20+i,completedAt:stamp(i),updatedAt:stamp(i)};
    missionStatus[id]={done:true,updatedAt:stamp(i)};
  });
  missionEvidence.auschwitz={id:'auschwitz',extra:true,bonus:true,verified:true,photo:tiny('auschwitz'),title:'Visita a Auschwitz-Birkenau',place:'Auschwitz-Birkenau',comment:'Una visita para recordar y aprender.',by:'Ambos',distance:64,completedAt:'2026-08-12T08:50:00+02:00',updatedAt:'2026-08-12T08:50:00+02:00'};
  return {visited:[...ids],missionEvidence,missionStatus,memories:[{id:'m1',title:'Primer recuerdo',note:'Texto del recuerdo',place:'Cracovia',by:'Ismael',ts:'2026-08-11T18:00:00+02:00',updatedAt:'2026-08-11T18:00:00+02:00'}],expenses:[{id:'e1',amount:24.6,category:'food',ts:'2026-08-11T14:00:00+02:00',updatedAt:'2026-08-11T14:00:00+02:00'}],config:{dailyTarget:21,fixedPaid:0},updatedAt:'2026-08-12T09:00:00+02:00'};
}

const report={generatedAt:new Date().toISOString(),target:base,albumVersion:'5.0',engines:[],failures:[]};

for(const [engineName,engine] of engines){
  const checks=[],errors=[],metrics={};
  const check=(name,ok,detail='')=>{checks.push({name,ok:!!ok,detail});if(!ok)report.failures.push(`${engineName}: ${name}${detail?` — ${detail}`:''}`)};
  let browser;
  try{
    let serverState=makeState();
    browser=await engine.launch({headless:true});
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true,serviceWorkers:'block'});
    await context.addInitScript(({state})=>{localStorage.setItem('krakowPocketCoop',JSON.stringify(state));localStorage.setItem('krakowPlayer','Ismael')},{state:clone(serverState)});
    await context.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**',async route=>{
      const url=route.request().url();
      if(url.includes('adventure_get')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(serverState)});
      if(url.includes('adventure_put')){
        try{const body=JSON.parse(route.request().postData()||'{}');if(body?.p_state)serverState=clone(body.p_state);}catch{}
        return route.fulfill({status:200,contentType:'application/json',body:'{}'});
      }
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });

    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(`pageerror: ${String(e)}`));
    page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>window.KP_ALBUM_V5?.version==='5.0'&&window.KP_ALBUM_EXPERIENCE?.version==='5.0',{timeout:20000});
    await page.waitForTimeout(900);
    await page.evaluate(()=>document.querySelector('.tab[data-panel="diary"]')?.click());
    await page.waitForTimeout(250);

    check('V5 API loaded',await page.evaluate(()=>window.KP_ALBUM_V5?.version==='5.0'));
    check('single V5 card',(await page.locator('#kpAlbumV5Card').count())===1);
    check('legacy album UI removed',(await page.locator('#kpAlbumCard,#kpAlbumDialog,#kpAlbumExperienceCard,#kpAlbumExperienceDialog').count())===0);
    const canonical=await page.evaluate(()=>window.KP_ALBUM_V5.html());
    metrics.canonicalHtmlChars=canonical.length;
    metrics.embeddedImageRefs=(canonical.match(/data:image\//g)||[]).length;
    metrics.localStateChars=await page.evaluate(()=>localStorage.getItem('krakowPocketCoop')?.length||0);
    check('canonical HTML identifies V5',canonical.includes('data-kp-album-v5="1"')&&canonical.includes('content="5.0"'));
    check('all initial evidence included',ids.every(id=>canonical.includes(`Recuerdo ${id}`))&&canonical.includes('Auschwitz-Birkenau'));
    check('memory included',canonical.includes('Primer recuerdo'));
    check('print CSS present',canonical.includes('@media print'));
    check('reduced motion supported',canonical.includes('prefers-reduced-motion:reduce'));
    check('mobile CSS present',canonical.includes('@media(max-width:700px)'));
    check('embedded image refs bounded',metrics.embeddedImageRefs<=Object.keys(serverState.missionEvidence).length*3+2,`${metrics.embeddedImageRefs} refs`);

    await page.locator('#kpAlbumV5Open').click();
    await page.waitForSelector('#kpAlbumV5Dialog[open]',{timeout:5000});
    const frame=page.frameLocator('#kpAlbumV5Frame');
    await frame.locator('.book[data-kp-album-v5="1"]').waitFor({state:'visible',timeout:5000});
    check('dialog opens',await page.locator('#kpAlbumV5Dialog').evaluate(el=>el.open));
    check('outer page locked',await page.evaluate(()=>document.documentElement.classList.contains('kp-album-v5-open')));
    check('photo cards rendered',(await frame.locator('.photo-card').count())===Object.keys(serverState.missionEvidence).length,`${await frame.locator('.photo-card').count()} cards`);
    check('toolbar visible',await frame.locator('.toolbar').isVisible());

    await frame.locator('.photo-button').first().click();
    check('lightbox opens',await frame.locator('#lightbox').evaluate(el=>el.classList.contains('open')));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    check('Escape closes lightbox',!(await frame.locator('#lightbox').evaluate(el=>el.classList.contains('open'))));

    const story=frame.locator('#storyAlbum');
    check('story button exists',(await story.count())===1);
    if(await story.count()){
      await story.click();
      check('story mode opens',await frame.locator('#storyMode').evaluate(el=>el.classList.contains('open')));
      const before=await frame.locator('.story-position').textContent();
      await frame.locator('#storyNext').click();
      const after=await frame.locator('.story-position').textContent();
      check('story next works',before!==after,`${before} -> ${after}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(80);
      check('Escape closes story',!(await frame.locator('#storyMode').evaluate(el=>el.classList.contains('open'))));
    }

    // Real local flow: use the app's own memory form so its in-memory state, localStorage and cloud push agree.
    await page.evaluate(()=>{
      document.getElementById('memoryTitle').value='Recuerdo en directo';
      document.getElementById('memoryNote').value='Añadido mientras el álbum estaba abierto';
      document.getElementById('memoryPlace').value='Cracovia';
      document.getElementById('memoryForm').requestSubmit();
    });
    let localLive=false;
    try{await frame.locator('text=Recuerdo en directo').waitFor({state:'visible',timeout:4500});localLive=true}catch{}
    check('album live-refreshes after real local memory save',localLive);

    // Remote flow: simulate a newer photo arriving from Laura and trigger the normal reconnect/pull path.
    const remoteStamp='2026-08-12T23:59:50+02:00';
    serverState=clone(serverState);
    serverState.missionEvidence.bernatek={id:'bernatek',verified:true,photo:tiny('bernatek-Laura'),title:'Recuerdo remoto de Laura',place:'Puente Bernatek',comment:'Llegó desde el otro iPhone',by:'Laura',distance:18,completedAt:remoteStamp,updatedAt:remoteStamp};
    serverState.missionStatus.bernatek={done:true,updatedAt:remoteStamp};
    serverState.visited=[...new Set([...(serverState.visited||[]),'bernatek'])];
    serverState.updatedAt=remoteStamp;
    await page.evaluate(()=>document.getElementById('reconnectCloud')?.click());
    let remoteLive=false;
    try{await frame.locator('text=Recuerdo remoto de Laura').waitFor({state:'visible',timeout:6000});remoteLive=true}catch{}
    check('remote photo from second iPhone reaches open album',remoteLive);
    const persistedRemote=await page.evaluate(()=>JSON.parse(localStorage.getItem('krakowPocketCoop')||'{}').missionEvidence?.bernatek?.title||'');
    check('remote photo persists in local shared state',persistedRemote==='Recuerdo remoto de Laura',persistedRemote);

    // Responsive overflow checks at the important iPhone widths.
    for(const width of [320,390,768]){
      await page.setViewportSize({width,height:844});
      await page.waitForTimeout(80);
      const outerOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
      const innerOverflow=await frame.locator('html').evaluate(el=>el.scrollWidth>el.clientWidth+2);
      check(`no horizontal overflow at ${width}px`,!outerOverflow&&!innerOverflow,`outer=${outerOverflow}, inner=${innerOverflow}`);
    }

    // Download should be generated by the same V5 source.
    let downloaded='';
    try{
      const p=page.waitForEvent('download',{timeout:3500});
      await page.locator('#kpAlbumV5Download').click();
      const dl=await p,path=await dl.path();if(path)downloaded=fs.readFileSync(path,'utf8');
    }catch{}
    check('HTML export works',downloaded.includes('data-kp-album-v5="1"')&&downloaded.includes('Recuerdo remoto de Laura'));

    await page.locator('#kpAlbumV5Close').click();
    await page.waitForTimeout(80);
    check('close button closes dialog',!(await page.locator('#kpAlbumV5Dialog').evaluate(el=>el.open)));
    check('outer page unlocks',!(await page.evaluate(()=>document.documentElement.classList.contains('kp-album-v5-open'))));
    const dupes=await page.evaluate(()=>{const m=new Map(),d=[];document.querySelectorAll('[id]').forEach(el=>m.set(el.id,(m.get(el.id)||0)+1));m.forEach((n,id)=>{if(n>1)d.push([id,n])});return d});
    check('no duplicate outer DOM ids',dupes.length===0,JSON.stringify(dupes));
    check('no runtime JS errors',errors.length===0,errors.join(' | ').slice(0,1200));
  }catch(e){
    check('diagnostic completed without unhandled exception',false,String(e?.stack||e).slice(0,1600));
  }finally{
    try{await browser?.close()}catch{}
    report.engines.push({engine:engineName,checks,errors,metrics});
  }
}

fs.writeFileSync('/tmp/album-deep-diagnostic.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.failures.length)process.exitCode=1;
