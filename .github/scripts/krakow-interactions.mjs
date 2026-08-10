import { chromium, webkit } from 'playwright';

const base = 'http://127.0.0.1:4173/';
const engines = [['chromium', chromium], ['webkit', webkit]];
let failed = false;

async function missionInLocal(page,id){
  try{return await page.evaluate(id=>{const s=JSON.parse(localStorage.getItem('krakowPocketCoop')||'{}');return !!id&&((s.visited||[]).includes(id)||s.missionStatus?.[id]?.done===true)},id)}catch{return false}
}
async function waitMission(page,id,remote,timeout=8000){
  const until=Date.now()+timeout;
  while(Date.now()<until){
    const local=await missionInLocal(page,id);
    const remoteDone=!!id&&((remote.visited||[]).includes(id)||remote.missionStatus?.[id]?.done===true);
    if(local||remoteDone)return {ok:true,local,remote:remoteDone};
    await page.waitForTimeout(180).catch(()=>{});
  }
  return {ok:false,local:await missionInLocal(page,id),remote:!!id&&((remote.visited||[]).includes(id)||remote.missionStatus?.[id]?.done===true)};
}

for (const [name, engine] of engines) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    serviceWorkers: 'block'
  });
  let remote = {visited:[],budget:[0,0,0],expenses:[],memories:[],config:{dailyTarget:21,fixedPaid:72.16},updatedAt:'2026-08-10T16:00:00.000Z'};
  await context.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**', async route => {
    const req = route.request();
    const fn = new URL(req.url()).pathname.split('/').pop();
    let body = {};
    try { body = JSON.parse(req.postData() || '{}'); } catch {}
    if (fn === 'adventure_put' && body.p_state) remote = structuredClone(body.p_state);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(remote) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message || String(e)));
  page.on('console', m => {
    const text = m.text();
    const benign = /Service Worker registration blocked|Blocked call to navigator\.vibrate because user hasn't tapped/i.test(text);
    if (m.type() === 'error' && !benign) errors.push(text);
  });
  const checks = {};
  const debug = {};

  try {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1800);

    await page.evaluate(() => document.getElementById('openSettings')?.click());
    await page.waitForTimeout(100);
    checks.settingsOpen = await page.locator('#settingsSheet').evaluate(el => el.open === true);
    await page.evaluate(() => document.getElementById('closeSettings')?.click());
    checks.settingsClosed = await page.locator('#settingsSheet').evaluate(el => el.open === false);

    await page.locator('.tab[data-panel="budget"]').click();
    await page.locator('#expenseAmount').fill('1,23');
    await page.locator('#expenseCategory').selectOption('coffee');
    await page.locator('#expenseNote').fill('AUDIT-EXPENSE');
    await page.locator('#expenseForm button[type="submit"]').click();
    await page.waitForTimeout(350);
    checks.expenseAdded = (await page.locator('#expenseList').textContent()).includes('AUDIT-EXPENSE') && /1,23/.test(await page.locator('#budgetTotal').textContent());
    await page.locator('.expense-delete').first().click();
    await page.waitForTimeout(300);
    checks.expenseDeleted = !(await page.locator('#expenseList').textContent()).includes('AUDIT-EXPENSE');

    await page.locator('.tab[data-panel="diary"]').click();
    await page.locator('.segment button[data-diary="memories"]').click();
    await page.locator('#memoryTitle').fill('AUDIT-MEMORY');
    await page.locator('#memoryNote').fill('Recuerdo aislado de auditoría');
    await page.locator('#memoryPlace').fill('Cracovia');
    await page.locator('#memoryForm button[type="submit"]').click();
    await page.waitForTimeout(350);
    checks.memoryAdded = (await page.locator('#memoryList').textContent()).includes('AUDIT-MEMORY');
    await page.locator('.memory-delete').first().click();
    await page.waitForTimeout(300);
    checks.memoryDeleted = !(await page.locator('#memoryList').textContent()).includes('AUDIT-MEMORY');

    await page.locator('.tab[data-panel="quests"]').click();
    const missionPoi = await page.locator('.q-done[data-poi]').first().getAttribute('data-poi');
    debug.missionPoi=missionPoi;
    await page.evaluate(() => document.querySelector('.q-done[data-poi]')?.click());
    debug.missionImmediate=await missionInLocal(page,missionPoi);
    const persisted=await waitMission(page,missionPoi,remote,8000);
    debug.missionPersistence=persisted;
    checks.missionCompletes=debug.missionImmediate&&persisted.ok;
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(450);
    const win = page.locator('#kpQuestWin.show');
    if (await win.count()) await page.evaluate(() => document.getElementById('kpWinClose')?.click());
    await page.waitForTimeout(120);

    await page.evaluate(() => document.querySelector('.tab[data-panel="diary"]')?.click());
    await page.waitForTimeout(120);
    await page.evaluate(() => document.querySelector('.segment button[data-diary="stories"]')?.click());
    await page.evaluate(() => document.querySelector('.story-open')?.click());
    await page.waitForTimeout(120);
    checks.storyOpens = await page.locator('#storyDialog').evaluate(el => el.open === true);
    await page.evaluate(() => document.getElementById('storyClose')?.click());
    checks.storyCloses = await page.locator('#storyDialog').evaluate(el => el.open === false);

    checks.noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    checks.syncStillHealthy = await page.locator('#syncText').evaluate(el => el.textContent.trim() === 'sincronizados');
  } catch (err) {
    errors.push(err.stack || String(err));
  }

  console.log(`\n=== ${name.toUpperCase()} INTERACTION AUDIT ===`);
  console.log(JSON.stringify({checks,debug,errors}, null, 2));
  if (!Object.values(checks).every(Boolean) || errors.length) failed = true;
  await browser.close();
}

if (failed) process.exit(1);
