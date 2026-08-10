import { chromium, webkit } from 'playwright';

const base = 'http://127.0.0.1:4173/';
const engines = [['chromium', chromium], ['webkit', webkit]];
const viewports = [
  { width: 320, height: 568, name: 'compact' },
  { width: 375, height: 812, name: 'iphone-standard' },
  { width: 390, height: 844, name: 'iphone-current' },
  { width: 430, height: 932, name: 'iphone-large' }
];
let failed = false;

for (const [engineName, engine] of engines) {
  const browser = await engine.launch({ headless: true });
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 3, serviceWorkers: 'block' });
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
    const errors = [];
    page.on('pageerror', e => errors.push(e.message || String(e)));
    page.on('console', msg => {
      if (msg.type() === 'error' && !/Service Worker registration blocked/i.test(msg.text())) errors.push(msg.text());
    });
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1900);
      const nav = {};
      for (const panel of ['home','mapPanel','quests','diary','budget']) {
        await page.evaluate(p => document.querySelector(`.tab[data-panel="${p}"]`)?.click(), panel);
        await page.waitForTimeout(70);
        nav[panel] = await page.locator(`#${panel}`).evaluate(el => el.classList.contains('active'));
      }
      await page.evaluate(() => document.getElementById('openSettings')?.click());
      await page.waitForTimeout(100);
      const result = await page.evaluate(() => {
        const close = document.getElementById('closeSettings')?.getBoundingClientRect();
        const tabs = [...document.querySelectorAll('.tab[data-panel]')].map(el => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return { width:r.width, height:r.height, visible:s.display!=='none'&&s.visibility!=='hidden', disabled:!!el.disabled };
        });
        const sheet = document.getElementById('settingsSheet')?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          close: close ? { x:close.x, y:close.y, width:close.width, height:close.height } : null,
          sheet: sheet ? { top:sheet.top, bottom:sheet.bottom, width:sheet.width } : null,
          tabs,
          playerCards: document.querySelectorAll('#kpPlayerPicker [data-kp-player]').length,
          portraitFaces: document.querySelectorAll('#kpGameHud .kp-profile-face').length,
          guard: !!window.KP_CELEBRATION_GUARD?.duplicateOverlayBlocked
        };
      });
      const closeOk = result.close && result.close.width >= 44 && result.close.height >= 44 && result.close.y >= 38 && result.close.y + result.close.height <= viewport.height;
      const tabsOk = result.tabs.length === 5 && result.tabs.every(t => t.visible && !t.disabled && t.width >= 44 && t.height >= 44);
      const sheetOk = result.sheet && result.sheet.top >= 38 && result.sheet.bottom <= viewport.height + 1 && result.sheet.width <= viewport.width;
      const ok = !result.overflow && closeOk && tabsOk && sheetOk && result.playerCards === 2 && result.portraitFaces === 2 && result.guard && Object.values(nav).every(Boolean) && errors.length === 0;
      console.log(JSON.stringify({ engine:engineName, viewport:viewport.name, size:[viewport.width,viewport.height], ok, nav, result, errors }, null, 2));
      if (!ok) failed = true;
    } catch (error) {
      console.error(JSON.stringify({ engine:engineName, viewport:viewport.name, error:error.stack || String(error) }, null, 2));
      failed = true;
    }
    await context.close();
  }
  await browser.close();
}
if (failed) process.exit(1);
