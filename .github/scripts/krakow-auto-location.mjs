import { chromium, webkit } from 'playwright';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
let failed = false;

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    geolocation: { latitude: 50.06143, longitude: 19.93658, accuracy: 15 },
    permissions: ['geolocation'],
    serviceWorkers: 'block'
  });

  await context.route('**/*.supabase.co/rest/v1/rpc/**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.KP_AUTO_LOCATION?.version === '1.0' && window.KP_AUTO_LOCATION?.autoStart === true, { timeout: 7000 });
  await page.waitForFunction(() => /Ubicación activa/i.test(document.querySelector('#locateBtn')?.textContent || ''), { timeout: 10000 });

  const result = await page.evaluate(() => ({
    module: window.KP_AUTO_LOCATION?.version,
    autoStart: window.KP_AUTO_LOCATION?.autoStart,
    resumeRefresh: window.KP_AUTO_LOCATION?.resumeRefresh,
    deviceOnly: window.KP_AUTO_LOCATION?.deviceOnly,
    button: document.querySelector('#locateBtn')?.textContent?.trim() || '',
    privacy: document.querySelector('#privacyGps')?.textContent?.trim() || ''
  }));

  const ok = result.module === '1.0' && result.autoStart === true && result.resumeRefresh === true && result.deviceOnly === true && /Ubicación activa/i.test(result.button) && /GPS activo/i.test(result.privacy) && errors.length === 0;
  console.log(`\n=== ${name.toUpperCase()} AUTO LOCATION AUDIT ===`);
  console.log(JSON.stringify({ ok, result, errors }, null, 2));
  if (!ok) failed = true;
  await browser.close();
}

if (failed) process.exit(1);
