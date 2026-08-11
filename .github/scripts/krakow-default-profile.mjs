import { chromium, webkit } from 'playwright';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
const custom = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mP8z8AARAwMjIwgAAMAAgEBAf8B9ukAAAAASUVORK5CYII=';
let failed = false;

const cssFallbackVisible = () => {
  const faces = [...document.querySelectorAll('#kpGameHud .kp-profile-face[data-kp-profile]')];
  return faces.length === 2 && faces.every(face => {
    const box = face.getBoundingClientRect();
    const style = getComputedStyle(face);
    return box.width > 20 && box.height > 20 && style.backgroundImage !== 'none';
  });
};

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
  await page.waitForFunction(() => window.KP_COMPAT_PROFILE?.version === '2.2' && window.KP_COMPAT_PROFILE?.cssFallback === true && window.KP_PROFILE_PHOTOS?.version === '2.0' && window.KP_STATE_BRIDGE?.version === '1.4', { timeout: 7000 });
  await page.waitForFunction(cssFallbackVisible, { timeout: 4000 });

  const initial = await page.evaluate(() => {
    const faces = [...document.querySelectorAll('#kpGameHud .kp-profile-face[data-kp-profile]')];
    return {
      compat: window.KP_COMPAT_PROFILE?.version,
      photoModule: window.KP_PROFILE_PHOTOS?.version,
      bridge: window.KP_STATE_BRIDGE?.version,
      nativeDefault: window.KP_COMPAT_PROFILE?.nativeDefaultAvatar,
      cssFallback: window.KP_COMPAT_PROFILE?.cssFallback,
      protectedFallback: window.KP_COMPAT_PROFILE?.protectedFromLegacyVisuals,
      persistentSettings: window.KP_COMPAT_PROFILE?.persistentSettingsButton,
      noCompatObserver: window.KP_COMPAT_PROFILE?.noGlobalMutationObserver,
      eventDriven: window.KP_PROFILE_PHOTOS?.eventDriven,
      noPolling: window.KP_PROFILE_PHOTOS?.noPollingLoop,
      count: faces.length,
      noBrokenDefaultImages: faces.every(x => !x.querySelector(':scope > img.kp-profile-default')),
      visible: faces.every(face => {
        const box = face.getBoundingClientRect();
        const style = getComputedStyle(face);
        return box.width > 20 && box.height > 20 && style.backgroundImage !== 'none';
      })
    };
  });

  const firstOpenMs = await openSettings(page);
  await page.waitForSelector('#kpProfilePhotoManager', { timeout: 2500 });
  await page.waitForFunction(() => {
    const faces = [...document.querySelectorAll('#kpPlayerPicker .kp-picker-face')];
    return faces.length === 2 && faces.every(face => getComputedStyle(face).backgroundImage !== 'none');
  }, { timeout: 2500 });
  await page.waitForFunction(() => !!document.querySelector('#kpProfilePhotoPreview > svg.kp-profile-default'), { timeout: 2500 });

  const settings = await page.evaluate(() => ({
    pickerDefaults: [...document.querySelectorAll('#kpPlayerPicker .kp-picker-face')].filter(face => getComputedStyle(face).backgroundImage !== 'none').length,
    resetText: document.querySelector('#kpProfilePhotoReset')?.textContent?.trim() || '',
    previewDefault: !!document.querySelector('#kpProfilePhotoPreview > svg.kp-profile-default'),
    closeVisible: !!document.querySelector('#closeSettings')?.getBoundingClientRect().width
  }));

  await page.locator('#kpPlayerPicker [data-kp-player="Laura"]').click();
  await page.waitForFunction(() => localStorage.getItem('krakowPlayer') === 'Laura', { timeout: 2500 });
  await page.waitForFunction(() => (document.querySelector('#kpProfilePhotoTitle')?.textContent || '').includes('Laura'), { timeout: 2500 });
  const lauraSelected = await page.evaluate(() => {
    const face = document.querySelector('#kpPlayerPicker [data-kp-player="Laura"] .kp-picker-face');
    return {
      player: localStorage.getItem('krakowPlayer'),
      title: document.querySelector('#kpProfilePhotoTitle')?.textContent || '',
      defaultVisible: !!face && getComputedStyle(face).backgroundImage !== 'none'
    };
  });

  await page.locator('#kpPlayerPicker [data-kp-player="Ismael"]').click();
  await page.waitForFunction(() => localStorage.getItem('krakowPlayer') === 'Ismael', { timeout: 2500 });

  await page.evaluate(value => window.KP_PROFILE_PHOTOS.setDataUrl('Ismael', value), custom);
  await page.waitForFunction(() => !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo'), { timeout: 2500 });
  const customState = await page.evaluate(() => {
    const face = document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"]');
    return {
      customVisible: !!face?.querySelector(':scope > .kp-profile-photo'),
      fallbackUnderlay: !!face && getComputedStyle(face).backgroundImage !== 'none'
    };
  });

  await page.evaluate(() => window.KP_PROFILE_PHOTOS.remove('Ismael'));
  await page.waitForFunction(() => {
    const host = document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"]');
    if (!host || host.querySelector(':scope > .kp-profile-photo')) return false;
    const box = host.getBoundingClientRect();
    return box.width > 20 && box.height > 20 && getComputedStyle(host).backgroundImage !== 'none';
  }, { timeout: 2500 });
  const restored = await page.evaluate(() => {
    const host = document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"]');
    const box = host?.getBoundingClientRect();
    return {
      customGone: !host?.querySelector(':scope > .kp-profile-photo'),
      defaultBack: !!host && box.width > 20 && box.height > 20 && getComputedStyle(host).backgroundImage !== 'none'
    };
  });

  await closeSettings(page);
  const repeatedOpenMs = [];
  for (let i = 0; i < 5; i++) {
    repeatedOpenMs.push(await openSettings(page));
    await closeSettings(page);
  }
  const maxOpenMs = Math.max(firstOpenMs, ...repeatedOpenMs);

  const final = await page.evaluate(() => {
    const faces = [...document.querySelectorAll('#kpGameHud .kp-profile-face[data-kp-profile]')];
    return {
      closed: !document.querySelector('#settingsSheet')?.open,
      defaultsStillThere: faces.length === 2 && faces.every(face => getComputedStyle(face).backgroundImage !== 'none'),
      compatObserverFree: window.KP_COMPAT_PROFILE?.noGlobalMutationObserver === true,
      photoObserverFree: window.KP_PROFILE_PHOTOS?.noGlobalMutationObserver === true,
      persistentSettings: window.KP_COMPAT_PROFILE?.persistentSettingsButton === true,
      cssFallback: window.KP_COMPAT_PROFILE?.cssFallback === true
    };
  });

  const ok = initial.compat === '2.2' && initial.photoModule === '2.0' && initial.bridge === '1.4' && initial.nativeDefault && initial.cssFallback && initial.protectedFallback && initial.persistentSettings && initial.noCompatObserver && initial.eventDriven && initial.noPolling && initial.count === 2 && initial.visible && initial.noBrokenDefaultImages &&
    maxOpenMs < 2500 && settings.pickerDefaults === 2 && settings.resetText.includes('Imagen por defecto') && settings.previewDefault && settings.closeVisible &&
    lauraSelected.player === 'Laura' && lauraSelected.title.includes('Laura') && lauraSelected.defaultVisible &&
    customState.customVisible && customState.fallbackUnderlay && restored.customGone && restored.defaultBack && final.closed && final.defaultsStillThere && final.compatObserverFree && final.photoObserverFree && final.persistentSettings && final.cssFallback && errors.length === 0;

  console.log(`\n=== ${name.toUpperCase()} CSS FALLBACK + SETTINGS AUDIT ===`);
  console.log(JSON.stringify({ ok, initial, firstOpenMs, repeatedOpenMs, maxOpenMs, settings, lauraSelected, customState, restored, final, errors }, null, 2));
  if (!ok) failed = true;
  await browser.close();
}

if (failed) process.exit(1);
