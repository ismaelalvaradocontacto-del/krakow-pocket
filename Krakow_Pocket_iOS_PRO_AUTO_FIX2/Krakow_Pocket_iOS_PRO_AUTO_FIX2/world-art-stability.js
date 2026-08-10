(() => {
  "use strict";
  if (window.__kpWorldArtStability) return;
  window.__kpWorldArtStability = true;

  let burst = 0;
  const hasCouple = () => document.querySelectorAll('#kpGameHub .kp-couple-art svg[data-kp-inline]').length === 2;

  function requestPaint() {
    window.dispatchEvent(new Event('kp:game-render'));
  }

  function repairBurst() {
    const token = ++burst;
    for (const delay of [0, 25, 70, 150, 300, 550, 900, 1400]) {
      setTimeout(() => {
        if (token !== burst) return;
        requestPaint();
        if (hasCouple()) window.KP_WORLD_ART_STABILITY = { version:'1.0', navigationRepaint:true, coupleVerified:true };
      }, delay);
    }
  }

  function boot() {
    repairBurst();
    document.addEventListener('click', event => {
      if (event.target.closest?.('.tab[data-panel],#kpGameHub [data-go],#quickMap,#quickExpense,#quickMemory')) repairBurst();
    }, false);

    const observer = new MutationObserver(records => {
      if (!records.some(record => [...record.addedNodes].some(node => node?.matches?.('#kpGameHub,.kp-couple-art') || node?.querySelector?.('#kpGameHub,.kp-couple-art')))) return;
      repairBurst();
    });
    observer.observe(document.body, { childList:true, subtree:true });
    window.addEventListener('pageshow', repairBurst);
    window.addEventListener('orientationchange', () => setTimeout(repairBurst, 100), { passive:true });
    window.KP_WORLD_ART_STABILITY = { version:'1.0', navigationRepaint:true, coupleVerified:hasCouple() };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
