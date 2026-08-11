import { chromium, webkit } from 'playwright';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
const custom = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mP8z8AARAwMjIwgAAMAAgEBAf8B9ukAAAAASUVORK5CYII=';
let failed = false;

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
  await page.waitForFunction(() => window.KP_DEFAULT_PROFILE?.version === '1.2' && window.KP_DEFAULT_PROFILE?.inlineSvg === true && window.KP_PROFILE_PHOTOS?.version === '1.2', { timeout: 7000 });
  await page.waitForFunction(() => document.querySelectorAll('#kpGameHud .kp-profile-face > svg.kp-profile-default').length === 2, { timeout: 5000 });

  const initial = await page.evaluate(() => {
    const faces = [...document.querySelectorAll('#kpGameHud .kp-profile-face[data-kp-profile]')];
    return {
      module: window.KP_DEFAULT_PROFILE?.version,
      photoModule: window.KP_PROFILE_PHOTOS?.version,
      inlineSvg: window.KP_DEFAULT_PROFILE?.inlineSvg,
      lightweight: window.KP_PROFILE_PHOTOS?.lightweightSettings,
      count: faces.filter(x => x.querySelector(':scope > svg.kp-profile-default')).length,
      noBrokenImages: faces.every(x => !x.querySelector(':scope > img.kp-profile-default')),
      visible: faces.every(x => {
        const svg = x.querySelector(':scope > svg.kp-profile-default');
        const box = svg?.getBoundingClientRect();
        return !!svg && !!svg.querySelector('circle') && !!svg.querySelector('path') && box.width > 20 && box.height > 20;
      })
    };
  });

  const started = Date.now();
  await page.locator('#kpGameSettings').click();
  await page.waitForSelector('#settingsSheet[open]', { timeout: 2500 });
  const settingsOpenMs = Date.now() - started;
  await page.waitForSelector('#kpProfilePhotoManager', { timeout: 4000 });
  await page.waitForFunction(() => document.querySelectorAll('#kpPlayerPicker .kp-picker-face > svg.kp-profile-default').length === 2, { timeout: 4000 });
  await page.waitForFunction(() => !!document.querySelector('#kpProfilePhotoPreview > svg.kp-profile-default'), { timeout: 4000 });

  const settings = await page.evaluate(() => ({
    pickerDefaults: document.querySelectorAll('#kpPlayerPicker .kp-picker-face > svg.kp-profile-default').length,
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
    defaultVisible: !!document.querySelector('#kpPlayerPicker [data-kp-player="Laura"] .kp-picker-face > svg.kp-profile-default')
  }));

  await page.locator('#kpPlayerPicker [data-kp-player="Ismael"]').click();
  await page.waitForFunction(() => localStorage.getItem('krakowPlayer') === 'Ismael', { timeout: 2500 });

  await page.evaluate(value => window.KP_PROFILE_PHOTOS.setDataUrl('Ismael', value), custom);
  await page.waitForFunction(() => {
    const host = document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"]');
    return !!host?.querySelector(':scope > .kp-profile-photo') && !host.querySelector(':scope > .kp-profile-default');
  }, { timeout: 4000 });
  const customState = await page.evaluate(() => ({
    customVisible: !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo'),
    defaultGone: !document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-default')
  }));

  await page.evaluate(() => window.KP_PROFILE_PHOTOS.remove('Ismael'));
  await page.waitForFunction(() => {
    const host = document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"]');
    return !host?.querySelector(':scope > .kp-profile-photo') && !!host?.querySelector(':scope > svg.kp-profile-default');
  }, { timeout: 4000 });
  const restored = await page.evaluate(() => ({
    customGone: !document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo'),
    defaultBack: !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > svg.kp-profile-default')
  }));

  await page.locator('#closeSettings').click();
  await page.waitForFunction(() => !document.querySelector('#settingsSheet')?.open, { timeout: 2500 });
  const closed = await page.evaluate(() => !document.querySelector('#settingsSheet')?.open);

  await page.locator('#kpGameSettings').click();
  await page.waitForSelector('#settingsSheet[open]', { timeout: 2500 });
  const reopened = await page.evaluate(() => document.querySelector('#settingsSheet')?.open === true);
  await page.locator('#closeSettings').click();

  const ok = initial.module === '1.2' && initial.photoModule === '1.2' && initial.inlineSvg && initial.lightweight && initial.count === 2 && initial.visible && initial.noBrokenImages &&
    settingsOpenMs < 2500 && settings.pickerDefaults === 2 && settings.resetText.includes('Imagen por defecto') && settings.previewDefault && settings.closeVisible &&
    lauraSelected.player === 'Laura' && lauraSelected.title.includes('Laura') && lauraSelected.defaultVisible &&
    customState.customVisible && customState.defaultGone && restored.customGone && restored.defaultBack && closed && reopened && errors.length === 0;

  console.log(`\n=== ${name.toUpperCase()} DEFAULT PROFILE + SETTINGS AUDIT ===`);
  console.log(JSON.stringify({ ok, initial, settingsOpenMs, settings, lauraSelected, customState, restored, closed, reopened, errors }, null, 2));
  if (!ok) failed = true;
  await browser.close();
}

if (failed) process.exit(1);
