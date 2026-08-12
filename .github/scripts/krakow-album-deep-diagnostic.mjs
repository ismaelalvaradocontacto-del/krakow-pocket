import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=process.env.KP_AUDIT_URL||'http://127.0.0.1:4173/';
const root=path.resolve('Krakow_Pocket_iOS_PRO_AUTO_FIX2/Krakow_Pocket_iOS_PRO_AUTO_FIX2');
const engines=[['chromium',chromium],['webkit',webkit]];
const ids=['florian','rynek','maria','maius','wawel','dragon','szeroka','placnowy','bernatek','ghetto','tomasza','planty'];
const tiny=(label)=>`data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#d7b982"/><text x="40" y="300" font-size="48">${label}</text></svg>`).toString('base64')}`;
const stamp=(i)=>`2026-08-${i<6?'11':'12'}T${String(9+(i%10)).padStart(2,'0')}:00:00+02:00`;
function makeState(count=6,{auschwitz=true,memories=2}={}){
 const selected=ids.slice(0,count), missionEvidence={}, missionStatus={};
 selected.forEach((id,i)=>{missionEvidence[id]={id,verified:true,photo:tiny(id),title:`Recuerdo ${id}`,place:id,comment:`Comentario ${id}`,by:i%2?'Laura':'Ismael',distance:20+i,completedAt:stamp(i),updatedAt:stamp(i)};missionStatus[id]={done:true,updatedAt:stamp(i)}});
 if(auschwitz)missionEvidence.auschwitz={id:'auschwitz',extra:true,bonus:true,verified:true,photo:tiny('auschwitz'),title:'Visita a Auschwitz-Birkenau',place:'Auschwitz-Birkenau',comment:'Una visita para recordar y aprender.',by:'Ambos',distance:64,completedAt:'2026-08-12T08:50:00+02:00',updatedAt:'2026-08-12T08:50:00+02:00'};
 return {visited:[...selected],missionEvidence,missionStatus,memories:Array.from({length:memories},(_,i)=>({id:`m${i}`,title:`Recuerdo escrito ${i+1}`,note:'Texto del recuerdo '.repeat(i+2),place:'Cracovia',by:i%2?'Laura':'Ismael',ts:`2026-08-11T${18+i}:00:00+02:00`,updatedAt:`2026-08-11T${18+i}:00:00+02:00`})),expenses:[{id:'e1',amount:24.6,category:'food',ts:'2026-08-11T14:00:00+02:00'}],config:{dailyTarget:21,fixedPaid:0},updatedAt:'2026-08-12T09:00:00+02:00'};
}

const staticFindings=[];
const mp=fs.readFileSync(path.join(root,'mission-proof.js'),'utf8');
const aus=fs.readFileSync(path.join(root,'auschwitz-extra.js'),'utf8');
const ambient=fs.readFileSync(path.join(root,'album-digital-v4-ambient-fix.js'),'utf8');
if(mp.includes('kpAlbumCard')&&mp.includes('kpAlbumDialog')) staticFindings.push('legacy mission-proof album UI is still active');
if(aus.includes('#kpAlbumDownload,#kpAlbumDownloadInside')) staticFindings.push('Auschwitz module intercepts generic album download ids');
if(aus.includes('downloadCombined()')) staticFindings.push('Auschwitz module has a separate legacy exporter');
if(ambient.includes('n>600')&&ambient.includes('observer.observe(document.documentElement')) staticFindings.push('ambient layer polls/observes the whole app for ~48 seconds');

const overall=[];
for(const [engineName,engine] of engines){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true,serviceWorkers:'block'});
 const initial=makeState(6,{auschwitz:true,memories:2});
 await context.addInitScript(({state})=>{localStorage.setItem('krakowPocketCoop',JSON.stringify(state));localStorage.setItem('krakowPlayer','Ismael')},{state:initial});
 await context.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**',async r=>{
   if(r.request().url().includes('adventure_get')) return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(initial)});
   return r.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 const page=await context.newPage();
 const checks=[];const check=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.KP_ALBUM_EXPERIENCE?.html&&window.KP_ALBUM_DIGITAL_V4?.version==='4.0',{timeout:20000});
 await page.waitForTimeout(800);
 await page.evaluate(()=>document.querySelector('.tab[data-panel="diary"]')?.click());
 await page.waitForTimeout(250);
 const cards=await page.locator('#kpAlbumCard,#kpAlbumExperienceCard').count();
 check('single album entry card',cards===1,`found ${cards}`);
 const legacyDialog=await page.locator('#kpAlbumDialog').count();
 check('no legacy album dialog precreated',legacyDialog===0,`found ${legacyDialog}`);
 const canonical=await page.evaluate(()=>window.KP_ALBUM_EXPERIENCE.html());
 check('canonical api html is digital v4',canonical.includes('data-kp-digital-album-v4="1"'));
 const photoRefs=(canonical.match(/data:image\//g)||[]).length;
 const photoCount=Object.keys(initial.missionEvidence).length;
 check('html does not duplicate embedded photos excessively',photoRefs<=photoCount+2,`${photoRefs} embedded refs for ${photoCount} photos`);

 await page.locator('#kpAlbumOpenExperience').click();
 await page.waitForSelector('#kpAlbumExperienceDialog[open]',{timeout:5000});
 await page.waitForTimeout(500);
 const duplicates=await page.evaluate(()=>{const m={};document.querySelectorAll('[id]').forEach(el=>(m[el.id]??=[]).push(el));return Object.entries(m).filter(([,v])=>v.length>1).map(([id,v])=>[id,v.length])});
 check('no duplicate DOM ids after opening album',duplicates.length===0,JSON.stringify(duplicates));
 const frame=page.frameLocator('#kpAlbumExperienceFrame');
 await frame.locator('.book').waitFor({state:'visible'});
 check('viewer has digital class',await frame.locator('.book.digital-album').count()===1);

 // New dialog close button must close the dialog itself.
 await page.locator('#kpAlbumExperienceDialog #kpAlbumClose').click();
 await page.waitForTimeout(100);
 check('outer album close button works',!(await page.locator('#kpAlbumExperienceDialog').evaluate(el=>el.open)));
 await page.locator('#kpAlbumOpenExperience').click();await page.waitForSelector('#kpAlbumExperienceDialog[open]');await page.waitForTimeout(300);

 // Clicking the visible download button must export the same digital generation, even with Auschwitz saved.
 let clickDownloaded='';
 try{
   const dlPromise=page.waitForEvent('download',{timeout:4000});
   await page.locator('#kpAlbumExperienceDialog #kpAlbumDownload').click();
   const dl=await dlPromise;const p=await dl.path();if(p)clickDownloaded=fs.readFileSync(p,'utf8');
 }catch(e){clickDownloaded=`ERROR:${e.message}`}
 check('visible download exports digital v4',clickDownloaded.includes('data-kp-digital-album-v4="1"'),clickDownloaded.startsWith('ERROR:')?clickDownloaded:'digital marker absent');
 check('visible download includes Auschwitz',clickDownloaded.includes('Auschwitz-Birkenau'));

 // Direct API download should also be canonical.
 let apiDownloaded='';
 try{
   const dlPromise=page.waitForEvent('download',{timeout:4000});
   await page.evaluate(()=>window.KP_ALBUM_EXPERIENCE.download());
   const dl=await dlPromise;const p=await dl.path();if(p)apiDownloaded=fs.readFileSync(p,'utf8');
 }catch(e){apiDownloaded=`ERROR:${e.message}`}
 check('api download matches digital generation',apiDownloaded.includes('data-kp-digital-album-v4="1"'),apiDownloaded.startsWith('ERROR:')?apiDownloaded:'digital marker absent');

 // Direct share should use the same current html.
 await page.evaluate(()=>{
   Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__kpSharedText=data.files?.[0]?await data.files[0].text():'';return undefined}});
 });
 await page.evaluate(()=>window.KP_ALBUM_EXPERIENCE.share());
 const shared=await page.evaluate(()=>window.__kpSharedText||'');
 check('api share matches digital generation',shared.includes('data-kp-digital-album-v4="1"'));

 // Same-tab state writes are what app.js uses. The open album should not silently remain stale.
 const beforeMem=await frame.locator('.memory-card').count();
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('krakowPocketCoop'));s.memories.push({id:'new-live-memory',title:'Nuevo recuerdo en directo',note:'Debe aparecer sin cerrar el álbum',place:'Rynek',by:'Laura',ts:new Date().toISOString(),updatedAt:new Date().toISOString()});s.updatedAt=new Date().toISOString();localStorage.setItem('krakowPocketCoop',JSON.stringify(s));});
 await page.waitForTimeout(600);
 const afterMem=await frame.locator('.memory-card').count();
 check('open album reacts to same-tab state updates',afterMem>beforeMem,`${beforeMem} -> ${afterMem}`);

 // Story mode should survive a remote evidence refresh rather than being torn down unexpectedly.
 if(await frame.locator('#storyAlbum').count()){
   await frame.locator('#storyAlbum').click();await page.waitForTimeout(150);
   const wasOpen=await frame.locator('#storyMode.open').count()===1;
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('kp:mission-evidence-sync',{detail:{missionEvidence:JSON.parse(localStorage.getItem('krakowPocketCoop')).missionEvidence}})));
   await page.waitForTimeout(350);
   const stillOpen=await page.frameLocator('#kpAlbumExperienceFrame').locator('#storyMode.open').count()===1;
   check('story mode survives benign sync refresh',wasOpen&&stillOpen,`${wasOpen} -> ${stillOpen}`);
 }

 // Empty album must not expose a dead Story control.
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('krakowPocketCoop'));s.missionEvidence={};s.missionStatus={};s.visited=[];s.updatedAt=new Date().toISOString();localStorage.setItem('krakowPocketCoop',JSON.stringify(s));document.querySelector('#kpAlbumExperienceDialog')?.close();});
 await page.locator('#kpAlbumOpenExperience').click();await page.waitForSelector('#kpAlbumExperienceDialog[open]');await page.waitForTimeout(400);
 const emptyFrame=page.frameLocator('#kpAlbumExperienceFrame');
 const emptyStoryVisible=await emptyFrame.locator('#storyAlbum').evaluate(el=>getComputedStyle(el).display!=='none').catch(()=>false);
 check('empty album has no dead story control',!emptyStoryVisible);

 // Repeated opens should remain singleton.
 await page.evaluate(()=>document.querySelector('#kpAlbumExperienceDialog')?.close());
 for(let i=0;i<4;i++){await page.locator('#kpAlbumOpenExperience').click();await page.waitForTimeout(80);await page.evaluate(()=>document.querySelector('#kpAlbumExperienceDialog')?.close());}
 const dialogCount=await page.locator('#kpAlbumExperienceDialog').count();
 check('repeated open/close keeps one modern dialog',dialogCount===1,`found ${dialogCount}`);

 check('no relevant JS errors',errors.length===0,errors.slice(0,8).join(' | '));
 overall.push({engine:engineName,base,checks,failures:checks.filter(x=>!x.ok),errors});
 await browser.close();
}

const report={base,staticFindings,engines:overall,totalFailures:staticFindings.length+overall.reduce((n,x)=>n+x.failures.length,0)};
console.log(JSON.stringify(report,null,2));
fs.writeFileSync('/tmp/album-deep-diagnostic.json',JSON.stringify(report,null,2));
if(report.totalFailures) process.exit(1);
