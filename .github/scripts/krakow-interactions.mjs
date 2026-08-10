import { chromium, webkit } from 'playwright';

const base = 'http://127.0.0.1:4173/';
const engines = [['chromium', chromium], ['webkit', webkit]];
let failed = false;

async function readState(page){
  try{return await page.evaluate(()=>JSON.parse(localStorage.getItem('krakowPocketCoop')||'{}'))}catch{return {}}
}
async function missionInLocal(page,id){
  const s=await readState(page);
  return !!id&&(s.missionStatus?.[id]?s.missionStatus[id].done===true:(s.visited||[]).includes(id));
}
async function visitedInLocal(page,id){
  const s=await readState(page);
  return !!id&&(s.visited||[]).includes(id);
}
async function waitFor(check,timeout=8000,step=160){
  const until=Date.now()+timeout;
  while(Date.now()<until){
    try{if(await check())return true}catch{}
    await new Promise(r=>setTimeout(r,step));
  }
  try{return !!(await check())}catch{return false}
}

for (const [name, engine] of engines) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    serviceWorkers: 'block'
  });
  let remote = {visited:[],budget:[0,0,0],expenses:[],memories:[],config:{dailyTarget:21,fixedPaid:72.16},missionStatus:{},discoveryStatus:{},updatedAt:'2026-08-10T16:00:00.000Z'};
  await context.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**', async route => {
    const req = route.request();
    const fn = new URL(req.url()).pathname.split('/').pop();
    let body = {};
    try { body = JSON.parse(req.postData() || '{}'); } catch {}
    if (fn === 'adventure_put' && body.p_state) remote = structuredClone(body.p_state);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(remote) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(15000);
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
    await page.waitForTimeout(1900);

    /* Settings accessibility and player profiles. */
    await page.evaluate(() => document.getElementById('openSettings')?.click());
    await page.waitForTimeout(150);
    checks.settingsOpen = await page.locator('#settingsSheet').evaluate(el => el.open === true);
    const closeRect = await page.locator('#closeSettings').boundingBox();
    debug.closeRect = closeRect;
    checks.settingsCloseEasy = !!closeRect && closeRect.width >= 44 && closeRect.height >= 44 && closeRect.y >= 38;
    checks.playerCardsPresent = await page.locator('#kpPlayerPicker [data-kp-player]').count() === 2;
    await page.locator('#kpPlayerPicker [data-kp-player="Laura"]').click();
    await page.waitForTimeout(180);
    checks.playerLauraPersists = await page.evaluate(() => localStorage.getItem('krakowPlayer') === 'Laura');
    checks.playerLauraActive = await page.locator('.kp-profile-face[data-kp-profile="Laura"].active').count() === 1;
    await page.evaluate(() => document.getElementById('closeSettings')?.click());
    checks.settingsClosed = await page.locator('#settingsSheet').evaluate(el => el.open === false);

    /* Expense write and delete. */
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

    /* Memory write and delete. */
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

    /* Mission: complete, celebrate, sync, reload, undo, sync and reload again. */
    await page.locator('.tab[data-panel="quests"]').click();
    const missionPoi = await page.locator('.q-done[data-poi]').first().getAttribute('data-poi');
    debug.missionPoi = missionPoi;
    await page.locator(`.q-done[data-poi="${missionPoi}"]`).click();
    checks.missionCompletes = await waitFor(() => missionInLocal(page, missionPoi), 4000);
    checks.missionCelebrates = await waitFor(async () => await page.locator('#kpQuestWin.show').count() === 1, 2500);
    if (await page.locator('#kpQuestWin.show').count()) await page.locator('#kpWinClose').click();
    checks.missionSyncsComplete = await waitFor(async () => remote.missionStatus?.[missionPoi]?.done === true || (remote.visited||[]).includes(missionPoi), 7000);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    checks.missionPersistsReload = await missionInLocal(page, missionPoi);
    await page.locator('.tab[data-panel="quests"]').click();
    await page.locator(`.q-done[data-poi="${missionPoi}"]`).click();
    checks.missionUndoLocal = await waitFor(async () => !(await missionInLocal(page, missionPoi)), 4000);
    checks.missionSyncsUndo = await waitFor(async () => remote.missionStatus?.[missionPoi]?.done === false && !(remote.visited||[]).includes(missionPoi), 7000);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    checks.missionUndoPersistsReload = !(await missionInLocal(page, missionPoi));

    /* Story for a quest: mark discovered must use the same reliable mission state and be reversible. */
    await page.locator('.tab[data-panel="diary"]').click();
    await page.locator('.segment button[data-diary="stories"]').click();
    const questStory = page.locator(`.story-open[data-poi="${missionPoi}"]`);
    await questStory.click();
    checks.storyOpens = await page.locator('#storyDialog').evaluate(el => el.open === true);
    checks.storyMarkPendingLabel = /Marcar/i.test(await page.locator('#storyMark').textContent());
    await page.locator('#storyMark').click();
    checks.storyMarksQuest = await waitFor(() => missionInLocal(page, missionPoi), 4000);
    checks.storyMissionCelebrates = await waitFor(async () => await page.locator('#kpQuestWin.show').count() === 1, 2500);
    if (await page.locator('#kpQuestWin.show').count()) await page.locator('#kpWinClose').click();
    await page.waitForTimeout(150);
    await questStory.click();
    checks.storyUndoLabel = /Desmarcar/i.test(await page.locator('#storyMark').textContent());
    await page.locator('#storyMark').click();
    checks.storyUndoQuest = await waitFor(async () => !(await missionInLocal(page, missionPoi)), 4000);

    /* Non-quest discovery can also be reversed locally. */
    const nonQuestStory = page.locator('.story-open[data-poi="podmuseum"]');
    if (await nonQuestStory.count()) {
      await nonQuestStory.click();
      await page.locator('#storyMark').click();
      checks.nonQuestMarks = await waitFor(() => visitedInLocal(page, 'podmuseum'), 3000);
      await page.waitForTimeout(900);
      await nonQuestStory.click();
      checks.nonQuestUndoLabel = /Desmarcar/i.test(await page.locator('#storyMark').textContent());
      await page.locator('#storyMark').click();
      checks.nonQuestUndo = await waitFor(async () => !(await visitedInLocal(page, 'podmuseum')), 4000);
    } else {
      checks.nonQuestMarks = true;
      checks.nonQuestUndoLabel = true;
      checks.nonQuestUndo = true;
    }

    /* Final health checks. */
    if (await page.locator('#storyDialog').evaluate(el => el.open === true).catch(() => false)) await page.evaluate(() => document.getElementById('storyClose')?.click());
    checks.storyCloses = await page.locator('#storyDialog').evaluate(el => el.open === false);
    checks.noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    checks.syncStillHealthy = await page.locator('#syncText').evaluate(el => el.textContent.trim() === 'sincronizados');
    checks.missionUxLoaded = await page.evaluate(() => window.KP_MISSION_UX?.version === '4.0' && window.KP_MISSION_UX?.stateHooks === false && window.KP_MISSION_UX?.networkHooks === false);
    checks.runtimeHealthy = await page.evaluate(() => !!window.KP_RUNTIME_AUDIT && window.KP_RUNTIME_AUDIT.missing.length === 0 && window.KP_RUNTIME_AUDIT.stateOk === true && window.KP_RUNTIME_AUDIT.storageOk === true);
  } catch (err) {
    errors.push(err.stack || String(err));
  }

  console.log(`\n=== ${name.toUpperCase()} INTERACTION AUDIT ===`);
  console.log(JSON.stringify({checks,debug,errors}, null, 2));
  if (!Object.values(checks).every(Boolean) || errors.length) failed = true;
  await browser.close();
}

if (failed) process.exit(1);
