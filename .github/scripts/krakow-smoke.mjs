import { chromium, webkit } from 'playwright';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
const engines = [['chromium', chromium], ['webkit', webkit]];
let failed = false;

for (const [name, engine] of engines) {
  const browser = await engine.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.stack || err.message || String(err)));
  page.on('requestfailed', req => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText || 'failed'}`));

  let response;
  try {
    response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
  } catch (err) {
    pageErrors.push(`Navigation: ${err.stack || err}`);
  }

  const state = await page.evaluate(() => {
    const text = id => document.getElementById(id)?.textContent?.trim() || null;
    const visible = id => {
      const el = document.getElementById(id); if (!el) return false;
      const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden';
    };
    return {
      url: location.href,
      title: document.title,
      data: !!window.KP_DATA,
      app: !!window.KP_APP,
      appVersion: window.KP_APP?.version || null,
      recTitle: text('recTitle'),
      syncText: text('syncText'),
      hud: !!document.getElementById('kpGameHud'),
      objective: !!document.getElementById('kpGameObjective'),
      village: !!document.getElementById('kpGameHub'),
      tabs: [...document.querySelectorAll('.tab')].map(x => x.dataset.panel),
      activePanels: [...document.querySelectorAll('.panel.active')].map(x => x.id),
      bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      settings: !!document.getElementById('settingsSheet'),
      storyDialog: !!document.getElementById('storyDialog'),
      recommendationVisible: visible('recommendation')
    };
  }).catch(err => ({ evaluationError: String(err) }));

  const navResults = {};
  for (const panel of ['home','mapPanel','quests','diary','budget']) {
    try {
      await page.locator(`.tab[data-panel="${panel}"]`).click({ timeout: 5000 });
      await page.waitForTimeout(120);
      navResults[panel] = await page.locator(`#${panel}`).evaluate(el => el.classList.contains('active'));
    } catch (err) {
      navResults[panel] = `ERROR: ${err.message}`;
    }
  }

  const report = {
    engine: name,
    httpStatus: response?.status() ?? null,
    state,
    navResults,
    consoleErrors,
    pageErrors,
    failedRequests
  };
  console.log(`\n=== ${name.toUpperCase()} AUDIT ===`);
  console.log(JSON.stringify(report, null, 2));

  const mustBoot = state.data && state.app && state.recTitle && !/^Calculando/i.test(state.recTitle) && state.hud && state.village;
  const navOk = Object.values(navResults).every(v => v === true);
  if (!mustBoot || !navOk || pageErrors.length) failed = true;
  await page.screenshot({ path: `audit-${name}.png`, fullPage: true }).catch(() => {});
  await browser.close();
}

if (failed) process.exit(1);
