import { chromium, webkit } from 'playwright';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
const engines = [['chromium', chromium], ['webkit', webkit]];
let failed = false;

for (const [name, engine] of engines) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3
  });
  const page = await context.newPage();
  let mainNavigations = 0;
  const navUrls = [];
  const pageErrors = [];

  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      mainNavigations++;
      navUrls.push(frame.url());
    }
  });
  page.on('pageerror', err => pageErrors.push(err.message || String(err)));

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.KP_STABILITY?.automaticReloadsBlocked === true, { timeout: 10000 });
  await page.waitForFunction(() => {
    const title = document.getElementById('recTitle')?.textContent?.trim() || '';
    return title && !/^Calculando/i.test(title);
  }, { timeout: 12000 }).catch(() => {});

  // Establish the navigation count after the initial document has settled.
  await page.waitForTimeout(2500);
  const baselineNavigations = mainNavigations;
  const initialUrl = page.url();

  // The old bug normally resurfaced through the mission poller / SW controller
  // within a few seconds. Keep the page idle long enough to cross several cycles.
  await page.waitForTimeout(22000);

  const finalUrl = page.url();
  const extraNavigations = mainNavigations - baselineNavigations;
  const marker = await page.evaluate(() => ({
    stability: window.KP_STABILITY || null,
    missionGuard: sessionStorage.getItem('kpMissionMutation'),
    updateRequested: sessionStorage.getItem('kpApplyUpdate'),
    sync: document.getElementById('syncText')?.textContent?.trim() || null,
    title: document.getElementById('recTitle')?.textContent?.trim() || null
  }));

  const report = { name, base, baselineNavigations, mainNavigations, extraNavigations, initialUrl, finalUrl, navUrls, marker, pageErrors };
  console.log(`\n=== ${name.toUpperCase()} NO-RELOAD AUDIT ===`);
  console.log(JSON.stringify(report, null, 2));

  const ok = extraNavigations === 0 && initialUrl === finalUrl && marker.stability?.automaticReloadsBlocked === true && marker.missionGuard === '1' && pageErrors.length === 0;
  if (!ok) failed = true;
  await browser.close();
}

if (failed) process.exit(1);
