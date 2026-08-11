(() => {
  "use strict";
  if (window.__kpPlayerStability) return;
  window.__kpPlayerStability = true;

  // Player selection is now handled by compat profile v2 plus the native
  // #playerSelect change handler. This compatibility shim intentionally does
  // not observe or rewrite the DOM.
  const who = localStorage.getItem("krakowPlayer") === "Laura" ? "Laura" : "Ismael";
  window.KP_PLAYER_STABILITY = {
    version: "2.0",
    deterministicSelection: true,
    selected: who,
    persisted: localStorage.getItem("krakowPlayer") === who,
    noMutationObserver: true
  };
})();
