(() => {
  "use strict";
  if (window.__kpLandmarkArtFix) return;
  window.__kpLandmarkArtFix = true;

  const EXPECTED = ['florian','maria','planty','maius','tomasza','szeroka','dragon','bernatek','placnowy','wawel','rynek','ghetto'];
  const $all = s => [...document.querySelectorAll(s)];

  if (!document.querySelector('style[data-kp-landmark-v2]')) {
    const style = document.createElement('style');
    style.dataset.kpLandmarkV2 = '1';
    style.textContent = `
      html.kp-game.kp-landmark-v2-ready .kp-world-node .kp-node-icon>.kp-landmark-art{opacity:0!important;visibility:hidden!important}
      html.kp-game .kp-world-node .kp-node-icon{position:relative!important}
      html.kp-game .kp-landmark-v2-host{position:absolute;inset:-4px;z-index:2;display:block;pointer-events:none;overflow:visible}
      html.kp-game .kp-landmark-v2-host svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 3px 1px rgba(55,35,22,.14))}
      @media(max-width:380px){html.kp-game .kp-landmark-v2-host{inset:-2px}}
    `;
    document.head.appendChild(style);
  }

  function makeHost(id) {
    const host = document.createElement('span');
    host.className = 'kp-landmark-v2-host';
    host.dataset.kpLandmarkV2 = id;
    host.innerHTML = `<svg class="kp-landmark-v2" viewBox="0 0 180 180" aria-hidden="true" focusable="false"><use href="./assets/landmarks-v2.svg#landmark-${id}"></use></svg>`;
    return host;
  }

  function paint() {
    for (const node of $all('#kpQuestWorld .kp-world-node[data-pixel-poi]')) {
      const id = node.dataset.pixelPoi;
      if (!EXPECTED.includes(id)) continue;
      const icon = node.querySelector('.kp-node-icon');
      if (!icon) continue;
      let host = icon.querySelector(`.kp-landmark-v2-host[data-kp-landmark-v2="${id}"]`);
      if (!host) {
        icon.querySelectorAll('.kp-landmark-v2-host').forEach(x => x.remove());
        host = makeHost(id);
        icon.appendChild(host);
      }
    }

    const rows = EXPECTED.map(id => {
      const node = document.querySelector(`.kp-world-node[data-pixel-poi="${id}"]`);
      const host = node?.querySelector(`.kp-landmark-v2-host[data-kp-landmark-v2="${id}"]`);
      return { id, node: !!node, host: !!host };
    });
    const painted = rows.filter(x => x.host).length;
    const complete = rows.every(x => x.node && x.host);
    document.documentElement.classList.toggle('kp-landmark-v2-ready', painted > 0);
    window.KP_LANDMARK_ART = { version: '2.1', expected: EXPECTED.length, painted, missing: rows.filter(x => !x.host).map(x => x.id), complete };
  }

  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; paint(); });
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
    [50,150,400,900,1800].forEach(ms => setTimeout(paint, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
