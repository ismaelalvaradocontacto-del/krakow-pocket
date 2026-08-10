(() => {
  "use strict";
  if (window.__kpCelebrationStability) return;
  window.__kpCelebrationStability = true;

  /*
   * mission-fix.js is the sole celebration lifecycle controller. An earlier
   * observer here could race that controller and remove a valid overlay before
   * the user saw it. Retain only the public health marker for diagnostics.
   */
  window.KP_CELEBRATION_STABILITY = {
    version: "1.1",
    undoSuppression: true,
    delayedDuplicateBlocked: true,
    delegatedToMissionUx: true
  };
})();
