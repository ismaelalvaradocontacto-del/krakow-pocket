import { chromium, webkit } from 'playwright';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)/.test(base);
const engines = [['chromium', chromium], ['webkit', webkit]];
let failed = false;

async function snapshot(page) {
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      return await page.evaluate(() => {
        const text = id => document.getElementById(id)?.textContent?.trim() || null;
        const visible = id => {
          const el = document.getElementById(id); if (!el) return false;
          const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden';
        };
        return {
          url: location.href,
          title: document.title,
          data: !!window.KP_DATA,
          appApi: !!window.KP_APP,
          runtimeAudit: window.KP_RUNTIME_AUDIT || null,
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
      });
    } catch (err) {
      lastError = err;
      await page.waitForTimeout(650);
    }
  }
  return { evaluationError: String(lastError) };
}

for (const [name, engine] of engines) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    ...(isLocal ? { serviceWorkers: 'block' } : {})
  });

  // Local smoke tests must never depend on or mutate the real shared adventure.
  // Live Cloudflare tests intentionally use the real read path to prove production sync.
  if (isLocal) {
    let mockState = {visited:[],budget:[0,0,0],expenses:[],memories:[],config:{dailyTarget:21,fixedPaid:72.16},updatedAt:'2026-08-10T16:00:00.000Z'};
    await context.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**', async route => {
      const req = route.request();
      const fn = new URL(req.url()).pathname.split('/').pop();
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch {}
      if (fn === 'adventure_put' && body.p_state) mockState = structuredClone(body.p_state);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockState) });
    });
  }

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !(isLocal && /Service Worker registration blocked/i.test(msg.text()))) consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(err.stack || err.message || String(err)));
  page.on('requestfailed', req => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText || 'failed'}`));

  let response;
  try {
    response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3500);
  } catch (err) {
    pageErrors.push(`Navigation: ${err.stack || err}`);
  }

  const state = await snapshot(page);
  const navResults = {};
  // A celebration is a legitimate blocking modal. Close it before the generic navigation check.
  await page.evaluate(() => document.getElementById('kpWinClose')?.click()).catch(() => {});
  for (const panel of ['home','mapPanel','quests','diary','budget']) {
    try {
      await page.locator(`.tab[data-panel="${panel}"]`).click({ timeout: 5000 });
      await page.waitForTimeout(180);
      navResults[panel] = await page.locator(`#${panel}`).evaluate(el => el.classList.contains('active'));
    } catch (err) {
      navResults[panel] = `ERROR: ${err.message}`;
    }
  }

  const meaningfulPageErrors = pageErrors.filter(x => !/sw\.js due to access control checks/i.test(x));
  const authErrors = consoleErrors.filter(x => /401|Invalid API key/i.test(x));
  const report = {
    engine: name,
    mode: isLocal ? 'isolated-local' : 'live-production',
    httpStatus: response?.status() ?? null,
    state,
    navResults,
    consoleErrors,
    pageErrors,
    failedRequests
  };
  console.log(`\n=== ${name.toUpperCase()} AUDIT ===`);
  console.log(JSON.stringify(report, null, 2));

  const mustBoot = state.data && state.recTitle && !/^Calculando/i.test(state.recTitle) && state.hud && state.objective && state.village && state.recommendationVisible;
  const runtimeOk = !state.runtimeAudit || (state.runtimeAudit.stateOk && state.runtimeAudit.storageOk && (!state.runtimeAudit.missing || state.runtimeAudit.missing.length === 0));
  const navOk = Object.values(navResults).every(v => v === true);
  const layoutOk = state.bodyOverflow === false;
  if (!mustBoot || !runtimeOk || !navOk || !layoutOk || meaningfulPageErrors.length || authErrors.length) failed = true;
  await page.screenshot({ path: `audit-${name}.png`, fullPage: true }).catch(() => {});
  await browser.close();
}

if (failed) process.exit(1);
