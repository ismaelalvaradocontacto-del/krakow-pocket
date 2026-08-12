import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

const base=process.env.KP_AUDIT_URL||'http://127.0.0.1:4173/';
const engines=[['chromium',chromium],['webkit',webkit]];
const clone=x=>JSON.parse(JSON.stringify(x));
const iso=(d,h,m=0)=>`2026-08-${String(d).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00+02:00`;
const image=(label,color)=>`data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 960"><rect width="1280" height="960" fill="${color}"/><circle cx="1010" cy="160" r="95" fill="#f4d99a"/><path d="M0 710L200 420l200 175 220-270 210 225 180-150 300 300v260H0z" fill="#647857"/><text x="55" y="875" fill="white" font-size="54" font-family="Arial">${label}</text></svg>`).toString('base64')}`;
const ids=['florian','rynek','maria','maius','wawel','dragon','szeroka','placnowy'];
const colors=['#86adbf','#c59a71','#879d79','#b48768','#7896a8','#8fa671','#b58f72','#759aa4'];
function makeState(){
 const missionEvidence={},missionStatus={},visited=[];
 ids.forEach((id,i)=>{const t=iso(i<4?11:12,9+(i%4));missionEvidence[id]={id,verified:true,photo:image(id,colors[i]),title:`Recuerdo ${id}`,place:`Lugar ${id}`,comment:`Comentario ${id}`,by:i%2?'Laura':'Ismael',distance:20+i,completedAt:t,updatedAt:t};missionStatus[id]={done:true,completedAt:t,updatedAt:t};visited.push(id)});
 return{visited,missionEvidence,missionStatus,albumPhotos:[],memories:[{id:'m0',title:'Inicio del viaje',note:'Primer recuerdo escrito.',place:'Cracovia',by:'Ambos',ts:iso(11,8),updatedAt:iso(11,8)}],expenses:[],config:{dailyTarget:21,fixedPaid:0},updatedAt:iso(12,18)};
}
function sharedCloud(initial){let s=clone(initial);return{route:async r=>{const u=r.request().url();if(u.includes('adventure_get'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(s)});if(u.includes('adventure_put')){try{const b=JSON.parse(r.request().postData()||'{}');if(b?.p_state)s=clone(b.p_state)}catch{};return r.fulfill({status:200,contentType:'application/json',body:'{}'})}return r.fulfill({status:200,contentType:'application/json',body:'{}'})}}}
async function boot(browser,state){
 const cloud=sharedCloud(state),ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});
 await ctx.addInitScript(s=>{localStorage.setItem('krakowPocketCoop',JSON.stringify(s));localStorage.setItem('krakowPlayer','Ismael')},clone(state));
 await ctx.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**',cloud.route);
 const page=await ctx.newPage();await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.KP_ALBUM_V5?.version==='5.0'&&window.KP_ALBUM_NEXT?.version==='6.1'&&window.KP_ALBUM_NEXT?.singleRefreshOwner===true&&window.KP_STATE_BRIDGE?.bridgeReconciliationRevision==='20260812g',{timeout:20000});
 await page.evaluate(()=>document.querySelector('.tab[data-panel="diary"]')?.click());await page.waitForTimeout(250);await page.locator('#kpAlbumV5Open').click();
 const f=page.frameLocator('#kpAlbumV5Frame');await f.locator('[data-kp-album-v5="1"]').waitFor({state:'attached',timeout:10000});
 await page.evaluate(()=>{
  const fr=document.getElementById('kpAlbumV5Frame');window.__albumLoads=0;window.__albumWrites=0;
  fr?.addEventListener('load',()=>window.__albumLoads++);
  if(fr){new MutationObserver(ms=>{window.__albumWrites+=ms.filter(m=>m.type==='attributes'&&m.attributeName==='srcdoc').length}).observe(fr,{attributes:true,attributeFilter:['srcdoc']})}
 });
 return{ctx,page,f};
}
async function evalFrame(f,fn,arg){let last;for(let i=0;i<14;i++){try{return await f.locator('html').evaluate(fn,arg)}catch(e){last=e;if(!/Execution context was destroyed|Frame was detached|Target page, context or browser has been closed/i.test(String(e)))throw e;await new Promise(r=>setTimeout(r,100));try{await f.locator('[data-kp-album-v5="1"]').waitFor({state:'attached',timeout:2500})}catch{}}}throw last}
async function establishScroll(f){for(let i=0;i<12;i++){await evalFrame(f,()=>{document.documentElement.style.scrollBehavior='auto';const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);const target=Math.min(Math.max(160,Math.floor(max*.28)),Math.max(0,max-20));scrollTo(0,target)});await new Promise(r=>setTimeout(r,120));const y=await evalFrame(f,()=>scrollY);if(y>=80)return y}return evalFrame(f,()=>scrollY)}
async function addMemory(page,title){await page.evaluate(title=>{memoryTitle.value=title;memoryNote.value=`Contenido ${title}`;memoryPlace.value='Cracovia';memoryForm.requestSubmit()},title)}
const resetCounts=page=>page.evaluate(()=>{window.__albumLoads=0;window.__albumWrites=0});
const counts=page=>page.evaluate(()=>({loads:window.__albumLoads||0,writes:window.__albumWrites||0}));

const report={target:base,generatedAt:new Date().toISOString(),engines:[],failures:[]};
for(const [engineName,engine] of engines){
 const checks=[],errors=[];const check=(name,ok,detail='')=>{checks.push({name,ok:!!ok,detail});if(!ok)report.failures.push(`${engineName}: ${name}${detail?` — ${detail}`:''}`)};let browser;
 try{
  browser=await engine.launch({headless:true});const {ctx,page,f}=await boot(browser,makeState());page.on('pageerror',e=>errors.push(`pageerror:${e}`));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource/.test(m.text()))errors.push(`console:${m.text()}`)});
  await page.waitForTimeout(5200);let c=await counts(page);check('idle viewer does not regenerate album',c.writes===0,JSON.stringify(c));

  const y1=await establishScroll(f);check('test establishes real non-zero scroll',y1>=80,String(y1));await resetCounts(page);await addMemory(page,'Cambio con scroll');await f.getByRole('heading',{name:'Cambio con scroll',exact:true}).waitFor({state:'visible',timeout:8000});await page.waitForTimeout(1500);const y2=await evalFrame(f,()=>scrollY);c=await counts(page);check('non-zero scroll preserved after real refresh',y1>=80&&Math.abs(y2-y1)<=20,`${y1}->${y2}`);check('one real data change causes one srcdoc regeneration',c.writes===1,JSON.stringify(c));

  await f.locator('body').hover();await page.mouse.wheel(0,-30000);await page.waitForTimeout(320);let top=await evalFrame(f,()=>scrollY);if(top>4){await page.mouse.wheel(0,-30000);await page.waitForTimeout(320);top=await evalFrame(f,()=>scrollY)}check('user can immediately override restoration and reach top',top<=4,String(top));await resetCounts(page);await addMemory(page,'Cambio desde arriba');await f.getByRole('heading',{name:'Cambio desde arriba',exact:true}).waitFor({state:'visible',timeout:8000});await page.waitForTimeout(1500);const y0=await evalFrame(f,()=>scrollY);c=await counts(page);check('top remains top after refresh',y0<=6,String(y0));check('top refresh regenerates once',c.writes===1,JSON.stringify(c));

  await f.locator('#storyAlbum').click();await f.locator('#storyMode.open').waitFor();await resetCounts(page);await addMemory(page,'Mientras Historia');await page.waitForTimeout(2200);c=await counts(page);check('Story stays open during state change',await f.locator('#storyMode').evaluate(e=>e.classList.contains('open')));check('Story blocks album regeneration',c.writes===0,JSON.stringify(c));await f.locator('#storyMode .overlay-close').click();await f.getByRole('heading',{name:'Mientras Historia',exact:true}).waitFor({state:'visible',timeout:8000});await page.waitForTimeout(1400);c=await counts(page);check('deferred Story refresh regenerates once',c.writes===1,JSON.stringify(c));

  await f.locator('.photo-button').first().click();await f.locator('#lightbox.open').waitFor();await resetCounts(page);await addMemory(page,'Mientras Lightbox');await page.waitForTimeout(2200);c=await counts(page);check('lightbox stays open during state change',await f.locator('#lightbox').evaluate(e=>e.classList.contains('open')));check('lightbox blocks album regeneration',c.writes===0,JSON.stringify(c));await page.keyboard.press('Escape');await f.getByRole('heading',{name:'Mientras Lightbox',exact:true}).waitFor({state:'visible',timeout:8000});await page.waitForTimeout(1400);c=await counts(page);check('deferred lightbox refresh regenerates once',c.writes===1,JSON.stringify(c));

  await resetCounts(page);await addMemory(page,'Antes de PDF');const pdf=await page.evaluate(()=>window.KP_ALBUM_V5.print());check('PDF callable during pending state refresh',pdf===true);await page.waitForTimeout(1800);c=await counts(page);check('PDF lifecycle causes at most one regeneration',c.writes<=1,JSON.stringify(c));

  for(const width of [320,390,430,768]){await page.setViewportSize({width,height:844});await page.waitForTimeout(140);const m=await evalFrame(f,()=>({cw:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth,toolbar:document.querySelector('.toolbar')?document.querySelector('.toolbar').scrollWidth-document.querySelector('.toolbar').clientWidth:0}));check(`responsive ${width}px`,m.sw<=m.cw+1&&m.toolbar<=1,JSON.stringify(m))}
  const html=await page.evaluate(()=>window.KP_ALBUM_V5.html());const live=await page.evaluate(()=>JSON.parse(localStorage.getItem('krakowPocketCoop')||'{}').memories?.map(x=>x.title)||[]);check('standalone remains self-contained',!/<script[^>]+src=/i.test(html)&&!/<link[^>]+stylesheet/i.test(html));check('standalone contains latest live memories',html.includes('Cambio con scroll')&&html.includes('Cambio desde arriba')&&html.includes('Mientras Historia')&&html.includes('Mientras Lightbox')&&html.includes('Antes de PDF'),JSON.stringify(live));
  const nojs=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false});const np=await nojs.newPage();await np.setContent(html,{waitUntil:'domcontentloaded'});const nj=await np.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,photos:document.querySelectorAll('.photo-card').length,top:document.querySelector('a[href="#albumTop"]')?.getAttribute('href'),end:document.querySelector('a[href="#albumEnd"]')?.getAttribute('href'),story:document.querySelector('#storyAlbum')?getComputedStyle(document.querySelector('#storyAlbum')).display:'absent'}));check('Quick Look/no-JS fallback remains usable',nj.overflow<=1&&nj.photos===8&&nj.top==='#albumTop'&&nj.end==='#albumEnd'&&(nj.story==='none'||nj.story==='absent'),JSON.stringify(nj));await nojs.close();check('no runtime JS errors',errors.length===0,errors.join(' | ').slice(0,1000));await ctx.close();
 }catch(e){check('stress audit has no unhandled exception',false,String(e?.stack||e).slice(0,1600))}finally{try{await browser?.close()}catch{};report.engines.push({engine:engineName,checks,errors})}
}
fs.writeFileSync('/tmp/album-idle-stress.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.failures.length)process.exitCode=1;
