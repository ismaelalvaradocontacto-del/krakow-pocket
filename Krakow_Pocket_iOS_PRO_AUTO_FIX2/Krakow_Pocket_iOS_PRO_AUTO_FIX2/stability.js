(() => {
  "use strict";

  // Kraków Pocket is used as an app-like PWA. Keep the page itself at 1:1 scale so
  // Safari cannot leave the interface double-tap/pinch zoomed and horizontally panned.
  // Leaflet keeps its own internal map pinch/pan gestures independently.
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) viewport.setAttribute("content", "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover");

  // Load the illustrated storybook skin before the UI finishes composing.
  if (!document.querySelector('link[data-kp-storybook]')) {
    const skin = document.createElement("link");
    skin.rel = "stylesheet";
    skin.href = "./storybook.css";
    skin.dataset.kpStorybook = "1";
    document.head.appendChild(skin);
  }

  // Final iPhone layout guard. This sheet is deliberately appended after the visual
  // layers so old compatibility rules cannot re-enable hyphenation or overflow.
  if (!document.querySelector('link[data-kp-mobile-hotfix]')) {
    const hotfix = document.createElement("link");
    hotfix.rel = "stylesheet";
    hotfix.href = "./mobile-hotfix.css?v=20260811a";
    hotfix.dataset.kpMobileHotfix = "1";
    document.head.appendChild(hotfix);
  }

  // Feedback toasts are purely informational. Safari/WebKit can keep them over the
  // next control for a fraction longer than Chromium, so they must never intercept taps.
  if (!document.querySelector('style[data-kp-passive-toast]')) {
    const passiveToast = document.createElement("style");
    passiveToast.dataset.kpPassiveToast = "1";
    passiveToast.textContent = ".toast,#toast{pointer-events:none!important;user-select:none;-webkit-user-select:none}";
    document.head.appendChild(passiveToast);
  }

  // Load the final quest landmark layer before the mission board is first opened.
  // It uses self-contained SVGs, so no landmark can disappear because an inline SVG
  // references another symbol that Safari cannot resolve after extraction.
  if (!window.__kpLandmarkArtLoader && !document.querySelector('script[data-kp-landmark-art]')) {
    window.__kpLandmarkArtLoader = true;
    const landmarks = document.createElement("script");
    landmarks.src = "./landmark-art-fix.js?v=20260811a";
    landmarks.async = false;
    landmarks.dataset.kpLandmarkArt = "1";
    document.head.appendChild(landmarks);
  }

  // Never reload just because mission state was normalized in the background.
  // The UI layers already listen to storage/state events and can repaint in place.
  try { sessionStorage.setItem("kpMissionMutation", "1"); } catch {}

  // The legacy mission synchronizer schedules a pull shortly after every boot and
  // then periodically. If two state representations disagree, that old code calls
  // location.reload(), which can create a reload loop. The main app already performs
  // cloud synchronization, so block only that legacy automatic poller.
  const nativeTimeout = window.setTimeout.bind(window);
  const nativeInterval = window.setInterval.bind(window);
  const isLegacyMissionPull = (fn, delay) =>
    typeof fn === "function" && fn.name === "pullMissionStatus" && Number(delay) <= 5000;

  window.setTimeout = function(fn, delay, ...args) {
    if (isLegacyMissionPull(fn, delay)) return 0;
    return nativeTimeout(fn, delay, ...args);
  };
  window.setInterval = function(fn, delay, ...args) {
    if (isLegacyMissionPull(fn, delay)) return 0;
    return nativeInterval(fn, delay, ...args);
  };

  // app.js historically reloads on every Service Worker controllerchange.
  // Allow that reload only when the user explicitly pressed “Actualizar”.
  if ("serviceWorker" in navigator) {
    try {
      const proto = Object.getPrototypeOf(navigator.serviceWorker);
      const nativeAdd = proto.addEventListener;
      if (nativeAdd && !proto.__kpStableControllerChange) {
        Object.defineProperty(proto, "__kpStableControllerChange", { value: true });
        proto.addEventListener = function(type, listener, options) {
          if (this === navigator.serviceWorker && type === "controllerchange" && typeof listener === "function") {
            const guarded = function(event) {
              let requested = false;
              try { requested = sessionStorage.getItem("kpApplyUpdate") === "1"; } catch {}
              if (!requested) return;
              try { sessionStorage.removeItem("kpApplyUpdate"); } catch {}
              return listener.call(this, event);
            };
            return nativeAdd.call(this, type, guarded, options);
          }
          return nativeAdd.call(this, type, listener, options);
        };
      }
    } catch (err) {
      console.warn("Kraków Pocket update guard", err);
    }
  }

  document.addEventListener("click", event => {
    if (!event.target.closest?.("#applyUpdate")) return;
    try { sessionStorage.setItem("kpApplyUpdate", "1"); } catch {}
  }, true);

  // Diagnostic marker used by automated tests and for support.
  window.KP_STABILITY = {
    version: "1.4",
    automaticReloadsBlocked: true,
    storybookSkin: true,
    passiveToasts: true,
    pageScaleLocked: true,
    mobileLayoutHotfix: true,
    landmarkArtLayer: true
  };
})();
