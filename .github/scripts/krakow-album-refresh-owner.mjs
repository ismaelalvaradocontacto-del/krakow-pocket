import { chromium, webkit } from 'playwright';

const base=process.env.KP_AUDIT_URL||'http://127.0.0.1:4173/';
const img=`data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="#789"/></svg>').toString('base64')}`;
const initial={visited:['florian'],missionEvidence:{florian:{id:'florian',verified:true,photo:img,title:'Florian',place:'Florian',by:'Ismael',completedAt:'2026-08-12T09:00:00+02:00',updatedAt:'2026-08-12T09:00:00+02:00'}},missionStatus:{florian:{done:true,updatedAt:'2026-08-12T09:00:00+02:00'}},memories:[{id:'m0',title:'Inicial',note:'Inicial',place:'Cracovia',by:'Ambos',ts:'2026-08-12T08:00:00+02:00',updatedAt:'2026-08-12T08:00:00+02:00'}],albumPhotos:[],expenses:[],config:{dailyTarget:21,fixedPaid:0},updatedAt:'2026-08-12T09:00:00+02:00'};
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await ctx.addInitScript(s=>{
   localStorage.setItem('krakowPocketCoop',JSON.stringify(s));localStorage.setItem('krakowPlayer','Ismael');window.__kpSrcdocStacks=[];
   try{const p=HTMLIFrameElement.prototype,d=Object.getOwnPropertyDescriptor(p,'srcdoc');if(d?.set&&d.configurable){Object.defineProperty(p,'srcdoc',{configurable:true,enumerable:d.enumerable,get:d.get,set(v){if(this.id==='kpAlbumV5Frame')window.__kpSrcdocStacks.push(new Error('srcdoc-write').stack);return d.set.call(this,v)}})}}catch(e){window.__kpSrcdocPatchError=String(e)}
 },initial);
 let cloud=structuredClone(initial);await ctx.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**',async r=>{if(r.request().url().includes('adventure_get'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(cloud)});if(r.request().url().includes('adventure_put')){try{const b=JSON.parse(r.request().postData()||'{}');if(b.p_state)cloud=structuredClone(b.p_state)}catch{};return r.fulfill({status:200,contentType:'application/json',body:'{}'})}return r.fulfill({status:200,body:'{}'})});
 const page=await ctx.newPage();await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.KP_ALBUM_NEXT?.version==='6.0',{timeout:20000});await page.evaluate(()=>document.querySelector('.tab[data-panel="diary"]')?.click());await page.waitForTimeout(250);await page.locator('#kpAlbumV5Open').click();const f=page.frameLocator('#kpAlbumV5Frame');await f.locator('[data-kp-album-v5="1"]').waitFor();await page.waitForTimeout(500);await page.evaluate(()=>window.__kpSrcdocStacks=[]);
 await page.evaluate(()=>{memoryTitle.value='Trace uno';memoryNote.value='Recuerdo guardado desde el formulario real';memoryPlace.value='Cracovia';memoryForm.requestSubmit()});
 await f.getByRole('heading',{name:'Trace uno',exact:true}).waitFor({timeout:8000});await page.waitForTimeout(6500);
 const out=await page.evaluate(()=>({stacks:window.__kpSrcdocStacks,patchError:window.__kpSrcdocPatchError||'',memories:JSON.parse(localStorage.getItem('krakowPocketCoop')||'{}').memories?.map(x=>x.title),cloudSync:document.getElementById('syncText')?.textContent}));console.log(JSON.stringify({engine:name,...out},null,2));if(!out.memories?.includes('Trace uno'))process.exitCode=1;await ctx.close();await browser.close();
}
