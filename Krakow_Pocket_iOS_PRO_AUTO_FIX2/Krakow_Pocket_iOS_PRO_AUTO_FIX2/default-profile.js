(() => {
  "use strict";
  if (window.__kpDefaultProfileImage) return;
  window.__kpDefaultProfileImage = true;

  // Since compat profile v2 the generic avatar is created natively inside each
  // profile host. Keep this file as a harmless compatibility shim so an older
  // cached loader cannot reintroduce repaint loops in Safari.
  window.KP_DEFAULT_PROFILE = {
    version: "2.0",
    genericDefault: true,
    inlineSvg: true,
    nativeProfileFallback: true,
    noExternalImageDependency: true,
    noMutationObserver: true,
    noSettingsBurst: true
  };
})();
