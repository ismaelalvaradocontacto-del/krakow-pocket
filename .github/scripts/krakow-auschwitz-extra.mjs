import { chromium, webkit } from 'playwright';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mP8z8AARAwMjIwgAAMAAgEBAf8B9ukAAAAASUVORK5CYII=', 'base64');
let failed = false;

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    geolocation: { latitude: 52.2297, longitude: 21.0122, accuracy: 12 },
    permissions: ['geolocation'],
    serviceWorkers: 'block'
  });
  let remote = { visited: [], expenses: [], memories: [], missionStatus: {}, discoveryStatus: {}, profilePhotos: {}, missionEvidence: {}, config: { dailyTarget: 21, fixedPaid: 72.16 }, updatedAt: new Date().toISOString() };
  await context.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**', async route => {
    const url = route.request().url();
    const payload = JSON.parse(route.request().postData() || '{}');
    if (url.includes('/adventure_put')) remote = JSON.parse(JSON.stringify(payload.p_state || remote));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(remote) });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`page:${e.message || ''}`));
  page.on('console', m => { if (m.type() === 'error' && !/vibrate|service worker/i.test(m.text())) errors.push(`console:${m.text()}`); });

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.KP_AUSCHWITZ_EXTRA?.version === '1.0', { timeout: 8000 });
  await page.locator('.tab[data-panel="quests"]').click();
  await page.waitForSelector('#kpAuschwitzExtraCard', { timeout: 5000 });
  const initial = await page.evaluate(() => ({
    coreCount: window.KP_DATA?.quests?.length,
    optional: window.KP_AUSCHWITZ_EXTRA?.optional,
    noCore: window.KP_AUSCHWITZ_EXTRA?.countsTowardCore === false,
    respect: window.KP_AUSCHWITZ_EXTRA?.respectMode,
    bothSites: window.KP_AUSCHWITZ_EXTRA?.acceptsAuschwitzI && window.KP_AUSCHWITZ_EXTRA?.acceptsBirkenau,
    noExact: window.KP_AUSCHWITZ_EXTRA?.storesExactCoordinates === false,
    card: !!document.querySelector('#kpAuschwitzExtraCard')
  }));

  await page.locator('#kpAuschwitzMemory').click();
  await page.waitForSelector('#kpAuschwitzDialog[open]', { timeout: 5000 });
  await page.waitForFunction(() => /Aún no estáis|GPS no disponible/i.test(document.querySelector('#kpAuschwitzStatus')?.textContent || ''), { timeout: 8000 });
  const far = await page.evaluate(() => ({
    disabled: document.querySelector('#kpAuschwitzInput')?.disabled === true,
    stored: !!JSON.parse(localStorage.getItem('krakowPocketCoop') || '{}').missionEvidence?.auschwitz
  }));

  await context.setGeolocation({ latitude: 50.029763, longitude: 19.204816, accuracy: 8 });
  await page.locator('#kpAuschwitzRetry').click();
  await page.waitForFunction(() => /OK/.test(document.querySelector('#kpAuschwitzGps')?.textContent || '') && !document.querySelector('#kpAuschwitzInput')?.disabled, { timeout: 8000 });
  await page.locator('#kpAuschwitzInput').setInputFiles({ name: 'auschwitz.png', mimeType: 'image/png', buffer: tinyPng });
  await page.waitForFunction(() => !document.querySelector('#kpAuschwitzSave')?.disabled && /Foto lista/.test(document.querySelector('#kpAuschwitzPhotoChip')?.textContent || ''), { timeout: 8000 });
  await page.locator('#kpAuschwitzSave').click();
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('krakowPocketCoop') || '{}').missionEvidence?.auschwitz?.photo, { timeout: 8000 });

  const saved = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('krakowPocketCoop') || '{}');
    const x = s.missionEvidence?.auschwitz || {};
    return {
      verified: x.verified === true,
      bonus: x.bonus === true,
      album: x.album === true,
      photo: /^data:image\/jpeg;base64,/.test(x.photo || ''),
      site: x.site,
      distance: x.distance,
      noLat: !Object.prototype.hasOwnProperty.call(x, 'lat') && !Object.prototype.hasOwnProperty.call(x, 'lon'),
      coreVisited: (s.visited || []).length,
      coreCountText: document.querySelector('#questCount')?.textContent?.trim()
    };
  });

  await page.locator('.tab[data-panel="diary"]').click();
  await page.waitForSelector('#kpAlbumCard', { timeout: 5000 });
  await page.locator('#kpAlbumOpen').click();
  await page.waitForSelector('#kpAlbumDialog[open] .kp-album-extra', { timeout: 5000 });
  const album = await page.evaluate(() => ({
    extra: !!document.querySelector('#kpAlbumDialog .kp-album-extra'),
    badge: document.querySelector('#kpAlbumDialog .kp-album-extra-badge')?.textContent?.includes('EXTRA'),
    candle: document.querySelector('#kpAlbumDialog .kp-album-extra .kp-album-comment')?.textContent?.includes('🕯️'),
    note: document.querySelector('#kpAlbumCard .kp-auschwitz-album-note')?.textContent?.includes('Auschwitz')
  }));

  let downloaded = false;
  try {
    const p = page.waitForEvent('download', { timeout: 5000 });
    await page.locator('#kpAlbumDownloadInside').click();
    const d = await p;
    downloaded = /Krakow_Pocket_Album_.*\.html$/i.test(d.suggestedFilename());
  } catch {}
  await page.waitForTimeout(1800);
  const shared = !!remote.missionEvidence?.auschwitz?.photo;
  const ok = initial.coreCount === 12 && initial.optional && initial.noCore && initial.respect && initial.bothSites && initial.noExact && initial.card && far.disabled && !far.stored && saved.verified && saved.bonus && saved.album && saved.photo && saved.noLat && saved.coreVisited === 0 && saved.coreCountText === '0 / 12' && album.extra && album.badge && album.candle && album.note && downloaded && shared && errors.length === 0;
  console.log(`\n=== ${name.toUpperCase()} AUSCHWITZ EXTRA AUDIT ===`);
  console.log(JSON.stringify({ ok, initial, far, saved, album, downloaded, shared, errors }, null, 2));
  if (!ok) failed = true;
  await browser.close();
}
if (failed) process.exit(1);
