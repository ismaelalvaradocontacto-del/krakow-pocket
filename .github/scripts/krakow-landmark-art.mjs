import { chromium, webkit } from 'playwright';

const base = process.env.KP_AUDIT_URL || 'http://127.0.0.1:4173/';
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)/.test(base);
const expected = ['florian','maria','planty','maius','tomasza','szeroka','dragon','bernatek','placnowy','wawel','rynek','ghetto'];
let failed = false;

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    ...(isLocal ? { serviceWorkers: 'block' } : {})
  });
  if (isLocal) {
    const mock = {visited:[],budget:[0,0,0],expenses:[],memories:[],config:{dailyTarget:21,fixedPaid:72.16},missionStatus:{},discoveryStatus:{},updatedAt:new Date().toISOString()};
    await context.route('https://ahzmwkztlakejmrvgcdm.supabase.co/rest/v1/rpc/**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mock)}));
  }
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(isLocal ? 1800 : 3000);
  await page.evaluate(() => document.querySelector('.tab[data-panel="quests"]')?.click());
  await page.waitForTimeout(900);
  const report = await page.evaluate(expectedIds => {
    const rows = expectedIds.map(id => {
      const node = document.querySelector(`.kp-world-node[data-pixel-poi="${id}"]`);
      const art = node?.querySelector('.kp-landmark-art .kp-landmark-v2');
      const r = art?.getBoundingClientRect();
      return {
        id,
        node: !!node,
        art: !!art,
        width: r?.width || 0,
        height: r?.height || 0,
        visible: !!art && getComputedStyle(art).visibility !== 'hidden' && getComputedStyle(art).display !== 'none' && (r?.width || 0) >= 35 && (r?.height || 0) >= 35
      };
    });
    return {
      diagnostic: window.KP_LANDMARK_ART || null,
      rows,
      complete: rows.length === expectedIds.length && rows.every(x => x.node && x.art && x.visible)
    };
  }, expected);
  console.log(`\n=== ${name.toUpperCase()} LANDMARK ART AUDIT ===`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.complete || report.diagnostic?.complete !== true || report.diagnostic?.painted < 12) failed = true;
  await page.screenshot({ path: `audit-landmarks-${name}.png`, fullPage: true }).catch(() => {});
  await browser.close();
}

if (failed) process.exit(1);
