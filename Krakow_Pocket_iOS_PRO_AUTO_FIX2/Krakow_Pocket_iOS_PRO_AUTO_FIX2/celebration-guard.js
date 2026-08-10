(() => {
  "use strict";
  if (window.__kpCelebrationGuard) return;
  window.__kpCelebrationGuard = true;

  /*
   * Celebration ownership now lives in mission-fix.js. Keeping a second observer
   * here used to hide legitimate completion overlays in both Chromium and WebKit.
   * This lightweight guard remains as a compatibility/diagnostic marker while the
   * mission controller itself de-duplicates a completion and closes stale overlays
   * on undo.
   */
  window.KP_CELEBRATION_GUARD = {
    version: "1.1",
    duplicateOverlayBlocked: true,
    delegatedToMissionUx: true
  };
})();
if(!window.__kpCelebrationStabilityLoader){window.__kpCelebrationStabilityLoader=true;const s=document.createElement("script");s.src="./celebration-stability.js?v=20260810k";s.async=false;(document.head||document.documentElement).appendChild(s)}
if(!window.__kpPortraitStabilityLoader){window.__kpPortraitStabilityLoader=true;const s=document.createElement("script");s.src="./portrait-stability.js?v=20260810k";s.async=false;(document.head||document.documentElement).appendChild(s)}
