(() => {
  "use strict";
  if (window.__kpPortraitStability) return;
  window.__kpPortraitStability = true;

  // compat profile v2 owns the two profile hosts and repairs them only when
  // they are actually replaced by the game header. Keep this as a no-op for
  // older cached loaders.
  window.KP_PORTRAIT_STABILITY = {
    version: "2.0",
    dualPortraitRepair: true,
    profilesVerified: !!document.querySelector("#kpGameHud .kp-profile-stack"),
    noMutationObserver: true,
    noRepairBurst: true
  };
})();
