import { chromium, webkit } from 'playwright';

const base=process.env.KP_AUDIT_URL||'http://127.0.0.1:4173/';
const label=process.env.KP_AUDIT_LABEL||'local';
const OLD='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#c66"/><text x="40" y="240" font-size="70">TEST OLD</text></svg>').toString('base64');
const newSvg='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#6a8"/><circle cx="450" cy="480" r="220" fill="#fff"/><text x="120" y="1000" font-size="84">WAWEL FINAL</text></svg>';
const completedAt='2026-08-13T09:20:00.000Z';
const initial={
  visited:['wawel'],
  missionStatus:{wawel:{done:true,updatedAt:completedAt}},
  missionEvidence:{wawel:{id:'wawel',questId:'q-wawel',place:'Colina de Wawel',title:'La colina de los reyes',photo:OLD,comment:'Foto de prueba',by:'Ismael',completedAt,distance:40,radius:180,verified:true,updatedAt:completedAt}},
  albumPhotos:[],memories:[],expenses:[],budget:[0,0,0],config:{dailyTarget:21,fixedPaid:72.16},updatedAt:completedAt
};

const report={label,base,engines:[],failures:[]};
function check(bucket,name,ok,detail=''){bucket.push({name,ok:!!ok,detail});if(!ok)report.failures.push(`${name}${detail?` — ${detail}`:''}`)}

for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const checks=[];let browser;
  try{
    browser=await engine.launch({headless:true});
    const server={state:structuredClone(initial)};
    const ctx=await browser.newContext({viewport:{width:390,height:844},geolocation:{latitude:50.0540,longitude:19.9355},permissions:['geolocation'],serviceWorkers:'block'});
    await ctx.addInitScript(s=>{localStorage.setItem('krakowPocketCoop',JSON.stringify(s));localStorage.setItem('krakowPlayer','Ismael')},initial);
    await ctx.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**',async route=>{
      const url=route.request().url();
      if(url.includes('adventure_get'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(server.state)});
      if(url.includes('adventure_put')){try{const b=JSON.parse(route.request().postData()||'{}');if(b?.p_state)server.state=structuredClone(b.p_state)}catch{}return route.fulfill({status:200,contentType:'application/json',body:'{}'});}
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });
    const page=await ctx.newPage();
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>window.KP_MISSION_PROOF?.version==='2.2'&&window.KP_MISSION_PROOF?.replaceCompletedPhoto===true,{timeout:25000});
    await page.evaluate(()=>document.querySelector('.tab[data-panel="quests"]')?.click());
    const button=page.locator('.q-done[data-poi="wawel"]');
    await button.waitFor({state:'visible',timeout:12000});
    check(checks,`${engineName}: completed mission exposes change-photo action`,(await button.textContent())?.includes('Cambiar foto'),await button.textContent()||'');
    await button.click();
    const dialog=page.locator('#kpMissionProofDialog');await dialog.waitFor({state:'visible',timeout:10000});
    check(checks,`${engineName}: replacement mode explains mission stays completed`,(await page.locator('#kpProofLead').textContent())?.includes('sustituir'),await page.locator('#kpProofLead').textContent()||'');
    await page.waitForFunction(()=>document.getElementById('kpProofGpsChip')?.textContent?.includes('OK')&&!document.getElementById('kpProofInput')?.disabled,{timeout:15000});
    check(checks,`${engineName}: current verified photo is shown`,(await page.locator('#kpProofImage').getAttribute('src'))===OLD);
    await page.locator('#kpProofInput').setInputFiles({name:'wawel-final.svg',mimeType:'image/svg+xml',buffer:Buffer.from(newSvg)});
    await page.waitForFunction(()=>document.getElementById('kpProofPhotoChip')?.textContent?.includes('Foto lista')&&!document.getElementById('kpProofFinish')?.disabled,{timeout:15000});
    check(checks,`${engineName}: save button switches to replacement copy`,(await page.locator('#kpProofFinish').textContent())?.includes('Guardar nueva foto'),await page.locator('#kpProofFinish').textContent()||'');
    await page.locator('#kpProofFinish').click();
    await page.waitForFunction(()=>!document.getElementById('kpMissionProofDialog')?.open,{timeout:15000});
    await page.waitForTimeout(2500);
    const out=await page.evaluate(()=>JSON.parse(localStorage.getItem('krakowPocketCoop')||'{}'));
    const e=out.missionEvidence?.wawel;
    check(checks,`${engineName}: Wawel remains completed`,out.visited?.includes('wawel')&&out.missionStatus?.wawel?.done===true,JSON.stringify({visited:out.visited,status:out.missionStatus?.wawel}));
    check(checks,`${engineName}: photo really changed`,typeof e?.photo==='string'&&e.photo!==OLD&&e.photo.startsWith('data:image/'),String(e?.photo||'').slice(0,40));
    check(checks,`${engineName}: original completion date is preserved`,e?.completedAt===completedAt,String(e?.completedAt||''));
    check(checks,`${engineName}: replacement is timestamped`,!!e?.replacedAt,String(e?.replacedAt||''));
    const oldArchived=(out.albumPhotos||[]).some(x=>x?.photo===OLD||String(x?.id||'').startsWith('history-wawel-'));
    check(checks,`${engineName}: discarded test photo is not archived`,!oldArchived,JSON.stringify((out.albumPhotos||[]).map(x=>x?.id)));
    await ctx.close();
  }catch(err){report.failures.push(`${engineName}: fatal — ${String(err?.message||err)}`);checks.push({name:`${engineName}: fatal`,ok:false,detail:String(err?.stack||err)});}finally{if(browser)await browser.close().catch(()=>{})}
  report.engines.push({engine:engineName,checks});
}
console.log(JSON.stringify(report,null,2));
if(report.failures.length)process.exit(1);
