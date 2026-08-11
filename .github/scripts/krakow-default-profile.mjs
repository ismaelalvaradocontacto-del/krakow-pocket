import { chromium, webkit } from 'playwright';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
const custom = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mP8z8AARAwMjIwgAAMAAgEBAf8B9ukAAAAASUVORK5CYII=';
let failed = false;

async function openSettings(page) {
  const started = Date.now();
  await page.locator('#kpGameSettings').click();
  await page.waitForSelector('#settingsSheet[open]', { timeout: 2500 });
  return Date.now() - started;
}

async function closeSettings(page) {
  await page.locator('#closeSettings').click();
  await page.waitForFunction(() => !document.querySelector('#settingsSheet')?.open, { timeout: 2500 });
}

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, serviceWorkers: 'block' });
  await context.route('**/*.supabase.co/rest/v1/rpc/**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.KP_COMPAT_PROFILE?.version === '2.2' && window.KP_PROFILE_PHOTOS?.version === '2.0' && window.KP_STATE_BRIDGE?.version === '1.4', { timeout: 7000 });
  await page.waitForFunction(() => document.querySelectorAll('#kpGameHud .kp-profile-face > svg.kp-profile-default[data-kp-inline]').length === 2, { timeout: 4000 });

  const initial = await page.evaluate(() => {
    const faces = [...document.querySelectorAll('#kpGameHud .kp-profile-face[data-kp-profile]')];
    return {
      compat: window.KP_COMPAT_PROFILE?.version,
      photoModule: window.KP_PROFILE_PHOTOS?.version,
      bridge: window.KP_STATE_BRIDGE?.version,
      nativeDefault: window.KP_COMPAT_PROFILE?.nativeDefaultAvatar,
      protectedFallback: window.KP_COMPAT_PROFILE?.protectedFromLegacyVisuals,
      persistentSettings: window.KP_COMPAT_PROFILE?.persistentSettingsButton,
      noCompatObserver: window.KP_COMPAT_PROFILE?.noGlobalMutationObserver,
      eventDriven: window.KP_PROFILE_PHOTOS?.eventDriven,
      noPolling: window.KP_PROFILE_PHOTOS?.noPollingLoop,
      count: faces.filter(x => x.querySelector(':scope > svg.kp-profile-default[data-kp-inline]')).length,
      noBrokenDefaultImages: faces.every(x => !x.querySelector(':scope > img.kp-profile-default')),
      visible: faces.every(x => {
        const svg = x.querySelector(':scope > svg.kp-profile-default[data-kp-inline]');
        const box = svg?.getBoundingClientRect();
        return !!svg && !!svg.querySelector('circle') && !!svg.querySelector('path') && box.width > 20 && box.height > 20;
      })
    };
  });

  const firstOpenMs = await openSettings(page);
  await page.waitForSelector('#kpProfilePhotoManager', { timeout: 2500 });
  await page.waitForFunction(() => document.querySelectorAll('#kpPlayerPicker .kp-picker-face > svg.kp-profile-default[data-kp-inline]').length === 2, { timeout: 2500 });
  await page.waitForFunction(() => !!document.querySelector('#kpProfilePhotoPreview > svg.kp-profile-default'), { timeout: 2500 });

  const settings = await page.evaluate(() => ({
    pickerDefaults: document.querySelectorAll('#kpPlayerPicker .kp-picker-face > svg.kp-profile-default[data-kp-inline]').length,
    resetText: document.querySelector('#kpProfilePhotoReset')?.textContent?.trim() || '',
    previewDefault: !!document.querySelector('#kpProfilePhotoPreview > svg.kp-profile-default'),
    closeVisible: !!document.querySelector('#closeSettings')?.getBoundingClientRect().width
  }));

  await page.locator('#kpPlayerPicker [data-kp-player="Laura"]').click();
  await page.waitForFunction(() => localStorage.getItem('krakowPlayer') === 'Laura', { timeout: 2500 });
  await page.waitForFunction(() => (document.querySelector('#kpProfilePhotoTitle')?.textContent || '').includes('Laura'), { timeout: 2500 });
  const lauraSelected = await page.evaluate(() => ({
    player: localStorage.getItem('krakowPlayer'),
    title: document.querySelector('#kpProfilePhotoTitle')?.textContent || '',
    defaultVisible: !!document.querySelector('#kpPlayerPicker [data-kp-player="Laura"] .kp-picker-face > svg.kp-profile-default[data-kp-inline]')
  }));

  await page.locator('#kpPlayerPicker [data-kp-player="Ismael"]').click();
  await page.waitForFunction(() => localStorage.getItem('krakowPlayer') === 'Ismael', { timeout: 2500 });

  await page.evaluate(value => window.KP_PROFILE_PHOTOS.setDataUrl('Ismael', value), custom);
  await page.waitForFunction(() => !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo'), { timeout: 2500 });
  const customState = await page.evaluate(() => ({
    customVisible: !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo'),
    fallbackUnderlay: !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > svg.kp-profile-default[data-kp-inline]')
  }));

  await page.evaluate(() => window.KP_PROFILE_PHOTOS.remove('Ismael'));
  await page.waitForFunction(() => {
    const host = document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"]');
    return !host?.querySelector(':scope > .kp-profile-photo') && !!host?.querySelector(':scope > svg.kp-profile-default[data-kp-inline]');
  }, { timeout: 2500 });
  const restored = await page.evaluate(() => {
    const fallback = document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > svg.kp-profile-default[data-kp-inline]');
    const box = fallback?.getBoundingClientRect();
    return {
      customGone: !document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo'),
      defaultBack: !!fallback && box.width > 20 && box.height > 20
    };
  });

  await closeSettings(page);
  const repeatedOpenMs = [];
  for (let i = 0; i < 5; i++) {
    repeatedOpenMs.push(await openSettings(page));
    await closeSettings(page);
  }
  const maxOpenMs = Math.max(firstOpenMs, ...repeatedOpenMs);

  const final = await page.evaluate(() => ({
    closed: !document.querySelector('#settingsSheet')?.open,
    defaultsStillThere: document.querySelectorAll('#kpGameHud .kp-profile-face > svg.kp-profile-default[data-kp-inline]').length === 2,
    compatObserverFree: window.KP_COMPAT_PROFILE?.noGlobalMutationObserver === true,
    photoObserverFree: window.KP_PROFILE_PHOTOS?.noGlobalMutationObserver === true,
    persistentSettings: window.KP_COMPAT_PROFILE?.persistentSettingsButton === true
  }));

  const ok = initial.compat === '2.2' && initial.photoModule === '2.0' && initial.bridge === '1.4' && initial.nativeDefault && initial.protectedFallback && initial.persistentSettings && initial.noCompatObserver && initial.eventDriven && initial.noPolling && initial.count === 2 && initial.visible && initial.noBrokenDefaultImages &&
    maxOpenMs < 2500 && settings.pickerDefaults === 2 && settings.resetText.includes('Imagen por defecto') && settings.previewDefault && settings.closeVisible &&
    lauraSelected.player === 'Laura' && lauraSelected.title.includes('Laura') && lauraSelected.defaultVisible &&
    customState.customVisible && customState.fallbackUnderlay && restored.customGone && restored.defaultBack && final.closed && final.defaultsStillThere && final.compatObserverFree && final.photoObserverFree && final.persistentSettings && errors.length === 0;

  console.log(`\n=== ${name.toUpperCase()} NATIVE PROFILE + SETTINGS AUDIT ===`);
  console.log(JSON.stringify({ ok, initial, firstOpenMs, repeatedOpenMs, maxOpenMs, settings, lauraSelected, customState, restored, final, errors }, null, 2));
  if (!ok) failed = true;
  await browser.close();
}

if (failed) process.exit(1);
