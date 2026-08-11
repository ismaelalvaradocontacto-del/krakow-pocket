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
  await page.waitForFunction(() => window.KP_DEFAULT_PROFILE?.genericDefault === true, { timeout: 7000 });
  await page.waitForTimeout(400);

  const initial = await page.evaluate(() => {
    const faces = [...document.querySelectorAll('#kpGameHud .kp-profile-face[data-kp-profile]')];
    return {
      module: window.KP_DEFAULT_PROFILE?.version,
      count: faces.filter(x => x.querySelector(':scope > .kp-profile-default')).length,
      visible: faces.every(x => {
        const img = x.querySelector(':scope > .kp-profile-default');
        return !!img && img.getBoundingClientRect().width > 20 && img.src.startsWith('data:image/jpeg;base64,');
      })
    };
  });

  await page.locator('#kpGameSettings').click();
  await page.waitForSelector('#settingsSheet[open]', { timeout: 5000 });
  await page.waitForTimeout(200);
  const settings = await page.evaluate(() => ({
    pickerDefaults: document.querySelectorAll('#kpPlayerPicker .kp-picker-face > .kp-profile-default').length,
    resetText: document.querySelector('#kpProfilePhotoReset')?.textContent?.trim() || '',
    previewDefault: !!document.querySelector('#kpProfilePhotoPreview > .kp-profile-default')
  }));

  await page.evaluate(value => window.KP_PROFILE_PHOTOS.setDataUrl('Ismael', value), custom);
  await page.waitForTimeout(250);
  const customState = await page.evaluate(() => ({
    customVisible: !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo'),
    defaultGone: !document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-default')
  }));

  await page.evaluate(() => window.KP_PROFILE_PHOTOS.remove('Ismael'));
  await page.waitForTimeout(250);
  const restored = await page.evaluate(() => ({
    customGone: !document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-photo'),
    defaultBack: !!document.querySelector('#kpGameHud .kp-profile-face[data-kp-profile="Ismael"] > .kp-profile-default')
  }));

  const ok = initial.module === '1.0' && initial.count === 2 && initial.visible &&
    settings.pickerDefaults === 2 && settings.resetText.includes('Imagen por defecto') && settings.previewDefault &&
    customState.customVisible && customState.defaultGone && restored.customGone && restored.defaultBack && errors.length === 0;

  console.log(`\n=== ${name.toUpperCase()} DEFAULT PROFILE AUDIT ===`);
  console.log(JSON.stringify({ ok, initial, settings, customState, restored, errors }, null, 2));
  if (!ok) failed = true;
  await browser.close();
}

if (failed) process.exit(1);
