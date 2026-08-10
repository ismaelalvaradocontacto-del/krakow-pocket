(() => {
  "use strict";

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
  window.KP_STABILITY = { version: "1.0", automaticReloadsBlocked: true };
})();
