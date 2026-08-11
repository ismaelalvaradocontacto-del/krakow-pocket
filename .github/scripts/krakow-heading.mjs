import { chromium, webkit } from 'playwright';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
let failed = false;

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    geolocation: { latitude: 50.06143, longitude: 19.93658, accuracy: 12 },
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
  await page.waitForFunction(() => window.KP_HEADING?.version === '1.0' && window.KP_HEADING?.noPermissionPrompt === true, { timeout: 8000 });
  await page.waitForFunction(() => !!document.querySelector('.loc-dot'), { timeout: 10000 });

  await page.evaluate(() => {
    const event = new Event('deviceorientation');
    Object.defineProperty(event, 'webkitCompassHeading', { value: 90, configurable: true });
    Object.defineProperty(event, 'webkitCompassAccuracy', { value: 4, configurable: true });
    window.dispatchEvent(event);
  });

  await page.waitForFunction(() => {
    const dot = document.querySelector('.loc-dot');
    return !!dot?.classList.contains('kp-has-heading') && /deg$/.test(dot.style.getPropertyValue('--kp-heading')) && !!dot.querySelector('.kp-heading-arrow') && !!dot.querySelector('.kp-heading-cone');
  }, { timeout: 5000 });

  const result = await page.evaluate(() => {
    const dot = document.querySelector('.loc-dot');
    return {
      module: window.KP_HEADING?.version,
      silent: window.KP_HEADING?.silent,
      noPermissionPrompt: window.KP_HEADING?.noPermissionPrompt,
      requestsOrientationPermission: window.KP_HEADING?.requestsOrientationPermission,
      sensorPreferred: window.KP_HEADING?.sensorPreferred,
      gpsFallback: window.KP_HEADING?.gpsFallback,
      active: window.KP_HEADING?.active,
      source: window.KP_HEADING?.source,
      heading: window.KP_HEADING?.heading,
      markerClass: dot?.classList.contains('kp-has-heading') || false,
      cssHeading: dot?.style.getPropertyValue('--kp-heading') || '',
      arrow: !!dot?.querySelector('.kp-heading-arrow'),
      cone: !!dot?.querySelector('.kp-heading-cone')
    };
  });

  const ok = result.module === '1.0' && result.silent === true && result.noPermissionPrompt === true && result.requestsOrientationPermission === false && result.sensorPreferred === true && result.gpsFallback === true && result.active === true && result.source === 'sensor-ios' && Number.isFinite(result.heading) && Math.abs(result.heading - 90) < 2 && result.markerClass && /deg$/.test(result.cssHeading) && result.arrow && result.cone && errors.length === 0;

  console.log(`\n=== ${name.toUpperCase()} SILENT HEADING AUDIT ===`);
  console.log(JSON.stringify({ ok, result, errors }, null, 2));
  if (!ok) failed = true;
  await browser.close();
}

if (failed) process.exit(1);
