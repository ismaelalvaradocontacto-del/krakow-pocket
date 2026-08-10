(() => {
  "use strict";
  if (window.__kpNetworkStatus) return;
  window.__kpNetworkStatus = true;

  let applying = false;
  let observer = null;

  function offlineCopy() {
    if (navigator.onLine || applying) return;
    applying = true;
    try {
      const text = document.getElementById("syncText");
      if (text && text.textContent.trim() !== "sin conexión") text.textContent = "sin conexión";

      const dot = document.getElementById("syncDot");
      if (dot && dot.className !== "sync-dot") dot.className = "sync-dot";

      const settings = document.getElementById("settingsSync");
      if (settings) {
        if (settings.textContent.trim() !== "☁️ sin conexión") settings.textContent = "☁️ sin conexión";
        if (settings.className !== "pill red") settings.className = "pill red";
      }

      const help = document.getElementById("syncHelp");
      if (help && !/sin conexión/i.test(help.textContent || "")) {
        help.textContent = "Sin conexión. Los cambios se guardan en este dispositivo y se sincronizarán al volver Internet.";
      }
    } finally {
      applying = false;
    }
  }

  function refreshMarker() {
    window.KP_NETWORK_STATUS = {
      version: "1.0",
      offlineUiGuard: true,
      online: navigator.onLine,
      label: document.getElementById("syncText")?.textContent?.trim() || null
    };
  }

  function enforce() {
    if (!navigator.onLine) offlineCopy();
    refreshMarker();
  }

  function start() {
    enforce();
    observer = new MutationObserver(records => {
      if (applying || navigator.onLine) return;
      const relevant = records.some(record => {
        const target = record.target?.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
        return target?.id === "syncText" || target?.id === "syncDot" || target?.id === "settingsSync" || target?.id === "syncHelp" || target?.closest?.("#syncText,#syncDot,#settingsSync,#syncHelp");
      });
      if (relevant) queueMicrotask(enforce);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("offline", () => { enforce(); setTimeout(enforce, 0); setTimeout(enforce, 120); });
    window.addEventListener("online", refreshMarker);
    for (const delay of [0, 60, 180, 500, 1200, 2400]) setTimeout(enforce, delay);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
