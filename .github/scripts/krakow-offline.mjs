import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
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

await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(1800);
const ready = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return false;
  await navigator.serviceWorker.ready;
  return true;
});
if (!ready) throw new Error('Service worker did not become ready');

/* Reload once online so the active worker controls the page and runtime CDN assets are cached. */
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(1600);
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
if (!controlled) throw new Error('Service worker does not control the application after reload');

await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(1800);
const state = await page.evaluate(() => ({
  data: !!window.KP_DATA,
  runtime: window.KP_RUNTIME_AUDIT || null,
  hud: !!document.getElementById('kpGameHud'),
  village: !!document.getElementById('kpGameHub'),
  tabs: [...document.querySelectorAll('.tab[data-panel]')].length,
  sync: document.getElementById('syncText')?.textContent?.trim(),
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  controller: !!navigator.serviceWorker.controller,
  guard: window.KP_CELEBRATION_GUARD || null
}));
console.log(JSON.stringify({ state, errors }, null, 2));
const ok = state.data && state.hud && state.village && state.tabs === 5 && state.controller && state.overflow === false && state.sync === 'sin conexión' && state.runtime?.stateOk === true && state.runtime?.storageOk === true && state.guard?.duplicateOverlayBlocked === true && errors.length === 0;
await browser.close();
if (!ok) process.exit(1);
