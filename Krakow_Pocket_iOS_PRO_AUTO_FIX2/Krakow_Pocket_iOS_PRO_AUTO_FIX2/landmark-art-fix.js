(() => {
  "use strict";
  if (window.__kpLandmarkArtFix) return;
  window.__kpLandmarkArtFix = true;

  const EXPECTED = ['florian','maria','planty','maius','tomasza','szeroka','dragon','bernatek','placnowy','wawel','rynek','ghetto'];
  const $all = s => [...document.querySelectorAll(s)];
  let pack = null;
  let loadError = null;
  let raf = 0;

  if (!document.querySelector('style[data-kp-landmark-v2]')) {
    const style = document.createElement('style');
    style.dataset.kpLandmarkV2 = '1';
    style.textContent = `
      html.kp-game.kp-landmark-v2-ready .kp-world-node .kp-node-icon>.kp-landmark-art{opacity:0!important;visibility:hidden!important}
      html.kp-game .kp-world-node .kp-node-icon{position:relative!important}
      html.kp-game .kp-landmark-v2-host{position:absolute;inset:-4px;z-index:3;display:block!important;opacity:1!important;visibility:visible!important;pointer-events:none;overflow:visible}
      html.kp-game .kp-landmark-v2-host svg{display:block!important;width:100%!important;height:100%!important;opacity:1!important;visibility:visible!important;overflow:visible!important;filter:drop-shadow(0 3px 1px rgba(55,35,22,.14))}
      @media(max-width:380px){html.kp-game .kp-landmark-v2-host{inset:-2px}}
    `;
    document.head.appendChild(style);
  }

  async function loadPack() {
    if (pack) return pack;
    try {
      const response = await fetch('./assets/landmarks-v2.svg?v=20260811c', { cache: 'no-store' });
      if (!response.ok) throw new Error(`landmarks-v2.svg ${response.status}`);
      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      if (doc.querySelector('parsererror')) throw new Error('landmarks-v2.svg parse error');
      const defs = doc.querySelector('defs')?.innerHTML || '';
      const symbols = new Map();
      doc.querySelectorAll('symbol[id]').forEach(symbol => {
        symbols.set(symbol.id, {
          viewBox: symbol.getAttribute('viewBox') || '0 0 180 180',
          html: symbol.innerHTML
        });
      });
      const missing = EXPECTED.filter(id => !symbols.has(`landmark-${id}`));
      if (missing.length) throw new Error(`missing landmark symbols: ${missing.join(',')}`);
      pack = { defs, symbols };
      loadError = null;
      return pack;
    } catch (error) {
      loadError = String(error?.message || error);
      console.warn('Kraków Pocket landmark art fallback', error);
      return null;
    }
  }

  function makeHost(id, sprite) {
    const symbol = sprite.symbols.get(`landmark-${id}`);
    if (!symbol) return null;
    const host = document.createElement('span');
    host.className = 'kp-landmark-v2-host';
    host.dataset.kpLandmarkV2 = id;
    host.innerHTML = `<svg class="kp-landmark-v2" data-kp-landmark-inline="${id}" viewBox="${symbol.viewBox}" aria-hidden="true" focusable="false"><defs>${sprite.defs}</defs>${symbol.html}</svg>`;
    return host;
  }

  function vectorHealth(host) {
    const svg = host?.querySelector('svg[data-kp-landmark-inline]');
    if (!svg || svg.querySelector('use')) return false;
    return svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon').length >= 2;
  }

  async function paint() {
    const sprite = await loadPack();
    if (!sprite) {
      document.documentElement.classList.remove('kp-landmark-v2-ready');
      window.KP_LANDMARK_ART = { version: '2.2', expected: EXPECTED.length, painted: 0, visibleVectors: 0, missing: EXPECTED.slice(), complete: false, error: loadError };
      return;
    }

    for (const node of $all('#kpQuestWorld .kp-world-node[data-pixel-poi]')) {
      const id = node.dataset.pixelPoi;
      if (!EXPECTED.includes(id)) continue;
      const icon = node.querySelector('.kp-node-icon');
      if (!icon) continue;
      let host = icon.querySelector(`.kp-landmark-v2-host[data-kp-landmark-v2="${id}"]`);
      if (!host || !vectorHealth(host)) {
        icon.querySelectorAll('.kp-landmark-v2-host').forEach(x => x.remove());
        host = makeHost(id, sprite);
        if (host) icon.appendChild(host);
      }
    }

    const rows = EXPECTED.map(id => {
      const node = document.querySelector(`.kp-world-node[data-pixel-poi="${id}"]`);
      const host = node?.querySelector(`.kp-landmark-v2-host[data-kp-landmark-v2="${id}"]`);
      return { id, node: !!node, host: !!host, vectors: vectorHealth(host) };
    });
    const painted = rows.filter(x => x.host).length;
    const visibleVectors = rows.filter(x => x.vectors).length;
    const complete = rows.every(x => x.node && x.host && x.vectors);
    document.documentElement.classList.toggle('kp-landmark-v2-ready', complete);
    window.KP_LANDMARK_ART = {
      version: '2.2',
      expected: EXPECTED.length,
      painted,
      visibleVectors,
      missing: rows.filter(x => !x.vectors).map(x => x.id),
      complete,
      externalUse: false,
      error: null
    };
  }

  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      paint();
    });
  }

  function bind() {
    paint();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', e => {
      if (e.target.closest?.('.tab[data-panel="quests"]')) setTimeout(paint, 25);
    }, true);
    window.addEventListener('kp:render', schedule);
    window.addEventListener('kp:game-render', schedule);
    window.addEventListener('kp:statechange', schedule);
    window.addEventListener('pageshow', schedule);
    [50,150,400,900,1800,3200].forEach(ms => setTimeout(paint, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
