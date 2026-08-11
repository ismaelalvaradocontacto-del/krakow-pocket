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
  await page.waitForTimeout(isLocal ? 1700 : 2800);
  await page.evaluate(() => document.querySelector('.tab[data-panel="quests"]')?.click());
  await page.waitForFunction(() => window.KP_LANDMARK_ART?.complete === true && window.KP_LANDMARK_ART?.visibleVectors === 12, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);

  const report = await page.evaluate(expectedIds => {
    const rows = expectedIds.map(id => {
      const node = document.querySelector(`.kp-world-node[data-pixel-poi="${id}"]`);
      const host = node?.querySelector(`.kp-landmark-v2-host[data-kp-landmark-v2="${id}"]`);
      const art = host?.querySelector(`svg[data-kp-landmark-inline="${id}"]`);
      const r = art?.getBoundingClientRect();
      let box = null;
      try {
        const b = art?.getBBox?.();
        if (b) box = {x:b.x,y:b.y,width:b.width,height:b.height};
      } catch {}
      const vectorCount = art?.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon').length || 0;
      const useCount = art?.querySelectorAll('use').length || 0;
      const paintedVectorCount = art ? [...art.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon')].filter(el => {
        const fill = el.getAttribute('fill');
        const stroke = el.getAttribute('stroke');
        return (fill && fill !== 'none' && fill !== 'transparent') || (stroke && stroke !== 'none' && stroke !== 'transparent');
      }).length : 0;
      const geometryVisible = !!box && box.width >= 20 && box.height >= 20;
      return {
        id,
        node: !!node,
        host: !!host,
        art: !!art,
        width: r?.width || 0,
        height: r?.height || 0,
        bbox: box,
        vectorCount,
        paintedVectorCount,
        useCount,
        visible: !!art && getComputedStyle(art).visibility !== 'hidden' && getComputedStyle(art).display !== 'none' && getComputedStyle(art).opacity !== '0' && (r?.width || 0) >= 35 && (r?.height || 0) >= 35,
        realDrawing: vectorCount >= 2 && paintedVectorCount >= 2 && useCount === 0 && geometryVisible
      };
    });
    return {
      diagnostic: window.KP_LANDMARK_ART || null,
      rows,
      complete: rows.length === expectedIds.length && rows.every(x => x.node && x.host && x.art && x.visible && x.realDrawing)
    };
  }, expected);

  console.log(`\n=== ${name.toUpperCase()} LANDMARK ART AUDIT ===`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.complete || report.diagnostic?.version !== '2.2' || report.diagnostic?.complete !== true || report.diagnostic?.painted !== 12 || report.diagnostic?.visibleVectors !== 12 || report.diagnostic?.externalUse !== false) failed = true;
  await page.screenshot({ path: `audit-landmarks-${name}.png`, fullPage: true }).catch(() => {});
  await browser.close();
}

if (failed) process.exit(1);
