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
  await page.waitForFunction(() => window.KP_MISSION_PROOF?.version === '1.1' && window.KP_MISSION_PROOF_GUARD?.hardGate === true, { timeout: 8000 });
  await page.locator('.tab[data-panel="quests"]').click();
  await page.waitForSelector('.q-done[data-poi="florian"]', { timeout: 7000 });

  await page.locator('.q-done[data-poi="florian"]').click();
  await page.waitForSelector('#kpMissionProofDialog[open]', { timeout: 5000 });
  await page.waitForFunction(() => /Acércate un poco más/i.test(document.querySelector('#kpProofStatus')?.textContent || ''), { timeout: 8000 });
  const far = await page.evaluate(() => ({
    inputDisabled: document.querySelector('#kpProofInput')?.disabled === true,
    visited: (JSON.parse(localStorage.getItem('krakowPocketCoop') || '{}').visited || []).includes('florian')
  }));

  await context.setGeolocation({ latitude: 50.0647, longitude: 19.9414, accuracy: 8 });
  await page.locator('#kpProofRetry').click();
  await page.waitForFunction(() => /OK/.test(document.querySelector('#kpProofGpsChip')?.textContent || '') && !document.querySelector('#kpProofInput')?.disabled, { timeout: 8000 });
  await page.locator('#kpProofInput').setInputFiles({ name: 'florian.png', mimeType: 'image/png', buffer: tinyPng });
  await page.waitForFunction(() => !document.querySelector('#kpProofFinish')?.disabled && /Foto lista/i.test(document.querySelector('#kpProofPhotoChip')?.textContent || ''), { timeout: 8000 });
  await page.locator('#kpProofFinish').click();
  await page.waitForFunction(() => {
    const s = JSON.parse(localStorage.getItem('krakowPocketCoop') || '{}');
    return (s.visited || []).includes('florian') && !!s.missionEvidence?.florian?.photo && s.missionEvidence?.florian?.verified === true;
  }, { timeout: 8000 });

  const evidence = await page.evaluate(() => {
    const x = JSON.parse(localStorage.getItem('krakowPocketCoop') || '{}').missionEvidence?.florian || {};
    return {
      verified: x.verified === true,
      hasPhoto: /^data:image\/jpeg;base64,/.test(x.photo || ''),
      distance: x.distance,
      noExactLat: !Object.prototype.hasOwnProperty.call(x, 'lat') && !Object.prototype.hasOwnProperty.call(x, 'lon'),
      comment: !!x.comment,
      by: x.by
    };
  });

  const celebrationShown = await page.locator('#kpQuestWin.show').isVisible().catch(() => false);
  if (celebrationShown) {
    await page.locator('#kpWinClose').click();
    await page.waitForFunction(() => !document.querySelector('#kpQuestWin')?.classList.contains('show'), { timeout: 3000 });
  }

  await page.locator('.tab[data-panel="diary"]').click();
  await page.waitForSelector('#kpAlbumCard', { timeout: 5000 });
  await page.locator('#kpAlbumOpen').click();
  await page.waitForSelector('#kpAlbumDialog[open] .kp-album-entry', { timeout: 5000 });
  const album = await page.evaluate(() => ({
    count: window.KP_MISSION_PROOF?.count(),
    image: !!document.querySelector('#kpAlbumDialog .kp-album-entry img'),
    comment: !!document.querySelector('#kpAlbumDialog .kp-album-comment')?.textContent.trim(),
    animated: !!document.querySelector('style[data-kp-mission-proof="1"]')?.textContent.includes('kpAlbumComment')
  }));

  let downloaded = false;
  try {
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
    await page.locator('#kpAlbumDownloadInside').click();
    const download = await downloadPromise;
    downloaded = /Krakow_Pocket_Album_.*\.html$/i.test(download.suggestedFilename());
  } catch {}

  await page.waitForTimeout(1800);
  const shared = !!remote.missionEvidence?.florian?.photo;
  const ok = far.inputDisabled && !far.visited && evidence.verified && evidence.hasPhoto && Number.isFinite(evidence.distance) && evidence.distance <= 100 && evidence.noExactLat && evidence.comment && album.count === 1 && album.image && album.comment && album.animated && downloaded && shared && errors.length === 0;

  console.log(`\n=== ${name.toUpperCase()} VERIFIED MISSION + ALBUM AUDIT ===`);
  console.log(JSON.stringify({ ok, far, evidence, celebrationShown, album, downloaded, shared, errors }, null, 2));
  if (!ok) failed = true;
  await browser.close();
}

if (failed) process.exit(1);
