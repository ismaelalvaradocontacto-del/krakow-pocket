(() => {
  "use strict";
  if (window.__kpCelebrationGuard) return;
  window.__kpCelebrationGuard = true;

  const STORAGE = "krakowPocketCoop";
  const D = window.KP_DATA || { quests: [], pois: [] };
  const questIds = new Set((D.quests || []).map(q => q.poi));
  const seen = new Set();
  let expectedMission = null;

  const read = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); }
    catch { return {}; }
  };
  const done = (s, id) => s?.missionStatus?.[id] ? !!s.missionStatus[id].done : (s?.visited || []).includes(id);

  function storyId() {
    const dialog = document.getElementById("storyDialog");
    if (dialog?.dataset.kpPoi) return dialog.dataset.kpPoi;
    const title = document.getElementById("storyDialogTitle")?.textContent || "";
    return (D.pois || []).find(p => title.includes(p.name))?.id || null;
  }

  function arm(id) {
    expectedMission = id && questIds.has(id) && !done(read(), id) ? id : null;
  }

  document.addEventListener("click", event => {
    const quest = event.target.closest?.(".q-done[data-poi]");
    if (quest) {
      arm(quest.dataset.poi);
      return;
    }
    if (event.target.closest?.("#storyMark")) {
      arm(storyId());
      return;
    }
    if (event.target.closest?.("#kpPixelDone")) {
      arm(document.getElementById("kpQuestDialog")?.dataset.kpPoi || null);
    }
  }, true);

  function operationKey(id, state) {
    const op = state?.missionStatus?.[id];
    return `${id}:${op?.updatedAt || state?.updatedAt || "legacy"}`;
  }

  function validateOverlay() {
    const overlay = document.getElementById("kpQuestWin");
    if (!overlay?.classList.contains("show")) return;
    const state = read();
    const id = expectedMission;
    if (!id || !done(state, id)) {
      overlay.classList.remove("show");
      return;
    }
    const key = operationKey(id, state);
    if (seen.has(key)) {
      overlay.classList.remove("show");
      expectedMission = null;
      return;
    }
    seen.add(key);
    if (seen.size > 48) seen.delete(seen.values().next().value);
    expectedMission = null;
  }

  const observer = new MutationObserver(records => {
    if (records.some(r => r.target?.id === "kpQuestWin" && r.attributeName === "class")) validateOverlay();
  });

  function boot() {
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
    validateOverlay();
    window.KP_CELEBRATION_GUARD = { version: "1.0", duplicateOverlayBlocked: true };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
if(!window.__kpCelebrationStabilityLoader){window.__kpCelebrationStabilityLoader=true;const s=document.createElement("script");s.src="./celebration-stability.js?v=20260810h";s.async=false;(document.head||document.documentElement).appendChild(s)}
if(!window.__kpPortraitStabilityLoader){window.__kpPortraitStabilityLoader=true;const s=document.createElement("script");s.src="./portrait-stability.js?v=20260810i";s.async=false;(document.head||document.documentElement).appendChild(s)}
