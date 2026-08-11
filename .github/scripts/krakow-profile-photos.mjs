import { chromium, webkit } from 'playwright';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mP8z8AARAwMjIwgAAMAAgEBAf8B9ukAAAAASUVORK5CYII=', 'base64');
let failed = false;

async function openSettings(page) {
  await page.waitForSelector('#kpGameSettings', { timeout: 5000 });
  await page.locator('#kpGameSettings').click();
  await page.waitForSelector('#settingsSheet[open]', { timeout: 5000 });
}

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, serviceWorkers: 'block' });
  let remote = { visited: [], budget: [0,0,0], expenses: [], memories: [], config: { dailyTarget: 21, fixedPaid: 72.16 }, missionStatus: {}, discoveryStatus: {}, profilePhotos: {}, updatedAt: new Date().toISOString() };

  await context.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**', async route => {
    const url = route.request().url();
    const payload = JSON.parse(route.request().postData() || '{}');
    if (url.includes('/adventure_put')) remote = JSON.parse(JSON.stringify(payload.p_state || remote));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(remote) });
  });

  let page = await context.newPage();
  const errors = [];
  const bindErrors = p => {
    p.on('pageerror', e => errors.push(`page:${e.message || ''}`));
    p.on('console', m => { if (m.type() === 'error') errors.push(`console:${m.text()}`); });
  };
  bindErrors(page);

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.KP_COMPAT_PROFILE?.version === '2.2' && window.KP_PROFILE_PHOTOS?.version === '2.0', { timeout: 7000 });
  await openSettings(page);
  await page.waitForSelector('#kpProfilePhotoManager', { timeout: 5000 });

  const initial = await page.evaluate(() => ({
    module: window.KP_PROFILE_PHOTOS?.version,
    bridge: window.KP_STATE_BRIDGE?.version,
    compat: window.KP_COMPAT_PROFILE?.version,
    shared: window.KP_STATE_BRIDGE?.sharedProfilePhotos,
    immediate: window.KP_STATE_BRIDGE?.immediateRemoteProfileAdoption,
    eventDriven: window.KP_PROFILE_PHOTOS?.eventDriven,
    noPolling: window.KP_PROFILE_PHOTOS?.noPollingLoop,
    nativeDefault: window.KP_COMPAT_PROFILE?.nativeDefaultAvatar,
    protectedFallback: window.KP_COMPAT_PROFILE?.protectedFromLegacyVisuals,
    persistentSettings: window.KP_COMPAT_PROFILE?.persistentSettingsButton,
    manager: !!document.querySelector('#kpProfilePhotoManager'),
    choose: !!document.querySelector('#kpProfilePhotoChoose'),
    reset: !!document.querySelector('#kpProfilePhotoReset')
  }));

  await page.locator('#kpProfilePhotoInput').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: tinyPng });
  await page.waitForFunction(() => !!window.KP_PROFILE_PHOTOS?.get('Ismael'), { timeout: 5000 });
  await page.waitForFunction(() => !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo'), { timeout: 5000 });

  const afterUpload = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('krakowPocketCoop') || '{}');
    const header = document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo');
    const picker = document.querySelector('#kpPlayerPicker [data-kp-player="Ismael"] .kp-picker-face > .kp-profile-photo');
    return {
      stored: !!state.profilePhotos?.Ismael?.dataUrl,
      optimized: (state.profilePhotos?.Ismael?.dataUrl || '').length < 30000,
      header: !!header && header.getBoundingClientRect().width > 20,
      picker: !!picker && picker.getBoundingClientRect().width > 20,
      fallbackUnderPhoto: !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > svg.kp-profile-default[data-kp-inline]'),
      remoteShared: false
    };
  });

  await page.waitForTimeout(6200);
  afterUpload.remoteShared = !!remote.profilePhotos?.Ismael?.dataUrl;

  await page.close();
  page = await context.newPage();
  bindErrors(page);
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.KP_PROFILE_PHOTOS?.version === '2.0' && window.KP_COMPAT_PROFILE?.version === '2.2', { timeout: 7000 });
  await page.waitForFunction(() => !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo'), { timeout: 5000 });
  const afterReload = await page.evaluate(() => ({
    stored: !!JSON.parse(localStorage.getItem('krakowPocketCoop') || '{}').profilePhotos?.Ismael?.dataUrl,
    header: !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo')
  }));

  const remoteLaura = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=';
  remote.profilePhotos = { ...(remote.profilePhotos || {}), Laura: { dataUrl: remoteLaura, updatedAt: new Date(Date.now() + 5000).toISOString() } };
  remote.updatedAt = new Date(Date.now() + 5000).toISOString();
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('krakowPocketCoop') || '{}').profilePhotos?.Laura?.dataUrl, { timeout: 8500 });
  await page.waitForFunction(() => !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Laura"] > .kp-profile-photo'), { timeout: 3000 });
  const remoteMerge = await page.evaluate(() => ({
    lauraStored: !!JSON.parse(localStorage.getItem('krakowPocketCoop') || '{}').profilePhotos?.Laura?.dataUrl,
    lauraHeader: !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Laura"] > .kp-profile-photo')
  }));

  await openSettings(page);
  await page.locator('#kpPlayerPicker [data-kp-player="Ismael"]').click();
  await page.waitForFunction(() => localStorage.getItem('krakowPlayer') === 'Ismael', { timeout: 2500 });
  await page.locator('#kpProfilePhotoReset').click();
  await page.waitForFunction(() => {
    const host = document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"]');
    const fallback = host?.querySelector(':scope > svg.kp-profile-default[data-kp-inline]');
    const box = fallback?.getBoundingClientRect();
    return !host?.querySelector(':scope > .kp-profile-photo') && !!fallback && box.width > 20 && box.height > 20;
  }, { timeout: 3500 });
  const removed = await page.evaluate(() => {
    const entry = JSON.parse(localStorage.getItem('krakowPocketCoop') || '{}').profilePhotos?.Ismael;
    const fallback = document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > svg.kp-profile-default[data-kp-inline]');
    const box = fallback?.getBoundingClientRect();
    return {
      tombstone: !!entry && entry.dataUrl === '' && !!entry.updatedAt,
      headerGone: !document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo'),
      fallbackVisible: !!fallback && box.width > 20 && box.height > 20
    };
  });

  const ok = initial.module === '2.0' && initial.bridge === '1.4' && initial.compat === '2.2' && initial.shared && initial.immediate && initial.eventDriven && initial.noPolling && initial.nativeDefault && initial.protectedFallback && initial.persistentSettings && initial.manager && initial.choose && initial.reset &&
    afterUpload.stored && afterUpload.optimized && afterUpload.header && afterUpload.picker && afterUpload.fallbackUnderPhoto && afterUpload.remoteShared &&
    afterReload.stored && afterReload.header && remoteMerge.lauraStored && remoteMerge.lauraHeader && removed.tombstone && removed.headerGone && removed.fallbackVisible && errors.length === 0;

  console.log(`\n=== ${name.toUpperCase()} PROFILE PHOTO AUDIT ===`);
  console.log(JSON.stringify({ ok, initial, afterUpload, afterReload, remoteMerge, removed, errors }, null, 2));
  if (!ok) failed = true;
  await browser.close();
}

if (failed) process.exit(1);
