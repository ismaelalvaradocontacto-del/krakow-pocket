import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
let remote = {visited:[],budget:[0,0,0],expenses:[],memories:[],config:{dailyTarget:21,fixedPaid:72.16},missionStatus:{},discoveryStatus:{},updatedAt:'2026-08-10T16:00:00.000Z'};
const cloudPattern = 'https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**';
const cloudHandler = async route => {
  const req = route.request();
  const fn = new URL(req.url()).pathname.split('/').pop();
  let body = {};
  try { body = JSON.parse(req.postData() || '{}'); } catch {}
  if (fn === 'adventure_put' && body.p_state) remote = structuredClone(body.p_state);
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(remote) });
};
await context.route(cloudPattern, cloudHandler);
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

/* Remove the mocked cloud route before going offline. Route.fulfill can otherwise keep
   answering even in browser offline mode, which would make this an invalid offline test. */
await context.unroute(cloudPattern, cloudHandler);
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2200);
const state = await page.evaluate(() => ({
  data: !!window.KP_DATA,
  runtime: window.KP_RUNTIME_AUDIT || null,
  hud: !!document.getElementById('kpGameHud'),
  village: !!document.getElementById('kpGameHub'),
  tabs: [...document.querySelectorAll('.tab[data-panel]')].length,
  sync: document.getElementById('syncText')?.textContent?.trim(),
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  controller: !!navigator.serviceWorker.controller,
  guard: window.KP_CELEBRATION_GUARD || null,
  missionUx: window.KP_MISSION_UX || null,
  stateBridge: window.KP_STATE_BRIDGE || null,
  network: window.KP_NETWORK_STATUS || null,
  portrait: window.KP_PORTRAIT_STABILITY || null
}));
const ok = state.data && state.hud && state.village && state.tabs === 5 && state.controller && state.overflow === false && state.sync === 'sin conexión' && state.runtime?.online === false && state.runtime?.stateOk === true && state.runtime?.storageOk === true && state.guard?.duplicateOverlayBlocked === true && state.missionUx?.version === '4.2' && state.stateBridge?.reversibleDiscoveries === true && state.network?.offlineUiGuard === true && state.network?.online === false && state.portrait?.profilesVerified === true && errors.length === 0;
console.log(JSON.stringify({ state, errors, ok }, null, 2));
if (!ok) {
  const msg = `state=${JSON.stringify(state)}; errors=${errors.join(' | ') || 'none'}`.replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');
  console.error(`::error title=Krakow offline PWA audit::${msg}`);
}
await browser.close();
if (!ok) process.exit(1);
