import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
const engines = [['chromium', chromium], ['webkit', webkit]];
const ids = ['florian','rynek','maria','maius','wawel','dragon'];
const tiny = label => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#d7b982"/><text x="40" y="300" font-size="48">${label}</text></svg>`).toString('base64')}`;
const stamp = i => `2026-08-${i < 4 ? '11' : '12'}T${String(9 + i).padStart(2,'0')}:00:00+02:00`;

function makeState() {
  const missionEvidence = {}, missionStatus = {};
  ids.forEach((id,i) => {
    missionEvidence[id] = {
      id, verified:true, photo:tiny(id), title:`Recuerdo ${id}`, place:id,
      comment:`Comentario ${id}`, by:i % 2 ? 'Laura' : 'Ismael', distance:20+i,
      completedAt:stamp(i), updatedAt:stamp(i)
    };
    missionStatus[id] = {done:true, updatedAt:stamp(i)};
  });
  missionEvidence.auschwitz = {
    id:'auschwitz', extra:true, bonus:true, verified:true, photo:tiny('auschwitz'),
    title:'Visita a Auschwitz-Birkenau', place:'Auschwitz-Birkenau',
    comment:'Una visita para recordar y aprender.', by:'Ambos', distance:64,
    completedAt:'2026-08-12T08:50:00+02:00', updatedAt:'2026-08-12T08:50:00+02:00'
  };
  return {
    visited:[...ids], missionEvidence, missionStatus,
    memories:[
      {id:'m1',title:'Primer recuerdo',note:'Texto del recuerdo',place:'Cracovia',by:'Ismael',ts:'2026-08-11T18:00:00+02:00',updatedAt:'2026-08-11T18:00:00+02:00'},
      {id:'m2',title:'Segundo recuerdo',note:'Otro recuerdo',place:'Cracovia',by:'Laura',ts:'2026-08-12T18:00:00+02:00',updatedAt:'2026-08-12T18:00:00+02:00'}
    ],
    expenses:[{id:'e1',amount:24.6,category:'food',ts:'2026-08-11T14:00:00+02:00'}],
    config:{dailyTarget:21,fixedPaid:0}, updatedAt:'2026-08-12T09:00:00+02:00'
  };
}

const overall = [];
for (const [engineName, engine] of engines) {
  const browser = await engine.launch({headless:true});
  const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true,serviceWorkers:'block'});
  const initial = makeState();
  await context.addInitScript(({state}) => {
    localStorage.setItem('krakowPocketCoop', JSON.stringify(state));
    localStorage.setItem('krakowPlayer','Ismael');
  }, {state:initial});
  await context.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**', async route => {
    if (route.request().url().includes('adventure_get')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(initial)});
    return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  });

  const page = await context.newPage();
  const checks = [];
  const errors = [];
  const check = (name, ok, detail='') => checks.push({name,ok:!!ok,detail});
  page.on('pageerror', e => errors.push(`pageerror: ${String(e)}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(() => window.KP_ALBUM_V5?.version === '5.0' && window.KP_ALBUM_EXPERIENCE?.version === '5.0',{timeout:20000});
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('.tab[data-panel="diary"]')?.click());
  await page.waitForTimeout(300);

  check('V5 API loaded', await page.evaluate(() => window.KP_ALBUM_V5?.version === '5.0'));
  check('single V5 album card', (await page.locator('#kpAlbumV5Card').count()) === 1);
  check('legacy album cards removed', (await page.locator('#kpAlbumCard,#kpAlbumExperienceCard').count()) === 0);
  check('legacy album dialogs removed', (await page.locator('#kpAlbumDialog,#kpAlbumExperienceDialog').count()) === 0);

  const canonical = await page.evaluate(() => window.KP_ALBUM_V5.html());
  check('canonical HTML identifies V5', canonical.includes('data-kp-album-v5="1"') && canonical.includes('name="kp-album-version" content="5.0"'));
  check('canonical HTML contains all evidence', ids.every(id => canonical.includes(`Recuerdo ${id}`)) && canonical.includes('Auschwitz-Birkenau'));
  check('canonical HTML contains memories', canonical.includes('Primer recuerdo') && canonical.includes('Segundo recuerdo'));
  check('canonical HTML has print CSS', canonical.includes('@media print'));
  check('canonical HTML has reduced-motion handling', canonical.includes('prefers-reduced-motion:reduce'));
  check('canonical HTML has mobile breakpoint', canonical.includes('@media(max-width:700px)'));
  const photoRefs = (canonical.match(/data:image\//g) || []).length;
  const sourcePhotos = Object.keys(initial.missionEvidence).length;
  check('embedded photo duplication bounded', photoRefs <= sourcePhotos * 5 + 2, `${photoRefs} refs for ${sourcePhotos} photos`);

  await page.locator('#kpAlbumV5Open').click();
  await page.waitForSelector('#kpAlbumV5Dialog[open]',{timeout:5000});
  check('outer dialog opens', await page.locator('#kpAlbumV5Dialog').evaluate(el => el.open));
  check('document locked while album open', await page.evaluate(() => document.documentElement.classList.contains('kp-album-v5-open')));

  const frame = page.frameLocator('#kpAlbumV5Frame');
  await frame.locator('.book[data-kp-album-v5="1"]').waitFor({state:'visible',timeout:5000});
  check('iframe renders V5 book', (await frame.locator('.book[data-kp-album-v5="1"]').count()) === 1);
  check('all photos rendered as cards', (await frame.locator('.photo-card').count()) === sourcePhotos, `${await frame.locator('.photo-card').count()} cards`);
  check('day chapters rendered', (await frame.locator('.chapter').count()) >= 2);
  check('memory cards rendered', (await frame.locator('.memory-card').count()) === 2);
  check('toolbar visible', await frame.locator('.toolbar').isVisible());

  await frame.locator('.photo-button').first().click();
  check('lightbox opens', await frame.locator('#lightbox').evaluate(el => el.classList.contains('open')));
  await frame.locator('#lightbox .overlay-close').click();
  check('lightbox closes', !(await frame.locator('#lightbox').evaluate(el => el.classList.contains('open'))));

  const storyButton = frame.locator('#storyAlbum');
  check('story control exists', (await storyButton.count()) === 1);
  if (await storyButton.count()) {
    await storyButton.click();
    check('story mode opens', await frame.locator('#storyMode').evaluate(el => el.classList.contains('open')));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    check('Escape closes story mode', !(await frame.locator('#storyMode').evaluate(el => el.classList.contains('open'))));
  }

  const scrollBefore = await frame.locator('body').evaluate(() => { window.scrollTo(0, Math.min(500, document.documentElement.scrollHeight)); return window.scrollY; });
  await page.evaluate(() => {
    const key='krakowPocketCoop';
    const s=JSON.parse(localStorage.getItem(key)||'{}');
    s.memories=[...(s.memories||[]),{id:'m3',title:'Recuerdo sincronizado',note:'Aparece con el álbum abierto',place:'Cracovia',by:'Ambos',ts:new Date().toISOString(),updatedAt:new Date().toISOString()}];
    s.updatedAt=new Date().toISOString();
    localStorage.setItem(key,JSON.stringify(s));
    window.dispatchEvent(new CustomEvent('kp:state-updated',{detail:{source:'diagnostic'}}));
  });
  await page.waitForTimeout(1700);
  await frame.locator('text=Recuerdo sincronizado').waitFor({state:'visible',timeout:4000});
  check('open album refreshes after state change', (await frame.locator('.memory-card').count()) === 3);
  const scrollAfter = await frame.locator('body').evaluate(() => window.scrollY);
  check('refresh preserves approximate scroll position', Math.abs(scrollAfter-scrollBefore) < 140, `${scrollBefore} -> ${scrollAfter}`);

  await page.locator('#kpAlbumV5Close').click();
  await page.waitForTimeout(100);
  check('outer close button works', !(await page.locator('#kpAlbumV5Dialog').evaluate(el => el.open)));
  check('document unlocks after close', !(await page.evaluate(() => document.documentElement.classList.contains('kp-album-v5-open'))));

  const duplicateIds = await page.evaluate(() => {
    const seen=new Map(),dupes=[];
    document.querySelectorAll('[id]').forEach(el=>{const n=(seen.get(el.id)||0)+1;seen.set(el.id,n);});
    seen.forEach((n,id)=>{if(n>1)dupes.push([id,n]);});
    return dupes;
  });
  check('no duplicate ids in outer document', duplicateIds.length===0, JSON.stringify(duplicateIds));
  check('no runtime JS errors', errors.length===0, errors.join(' | ').slice(0,1500));

  const failed = checks.filter(x => !x.ok);
  overall.push({engine:engineName,checks,errors,failed:failed.map(x=>x.name)});
  await browser.close();
}

const report = {
  generatedAt:new Date().toISOString(),
  target:base,
  albumVersion:'5.0',
  engines:overall,
  failures:overall.flatMap(x=>x.failed.map(name=>`${x.engine}: ${name}`))
};
fs.writeFileSync('/tmp/album-deep-diagnostic.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if (report.failures.length) process.exitCode=1;
