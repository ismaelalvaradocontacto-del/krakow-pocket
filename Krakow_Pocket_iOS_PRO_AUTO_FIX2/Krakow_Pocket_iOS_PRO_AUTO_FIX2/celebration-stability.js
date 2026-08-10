(() => {
  "use strict";
  if (window.__kpCelebrationStability) return;
  window.__kpCelebrationStability = true;

  const STORE = "krakowPocketCoop";
  const data = window.KP_DATA || { quests: [], pois: [] };
  const questIds = new Set((data.quests || []).map(q => q.poi));
  let expectedMission = null;
  let suppressUntil = 0;
  const seen = new Set();

  const read = () => {
    try { return JSON.parse(localStorage.getItem(STORE) || "{}"); }
    catch { return {}; }
  };
  const isDone = (state, id) => state?.missionStatus?.[id] ? !!state.missionStatus[id].done : (state?.visited || []).includes(id);

  function storyId() {
    const dialog = document.getElementById("storyDialog");
    if (dialog?.dataset.kpPoi) return dialog.dataset.kpPoi;
    const title = document.getElementById("storyDialogTitle")?.textContent || "";
    return (data.pois || []).find(p => title.includes(p.name))?.id || null;
  }

  function hide() {
    document.getElementById("kpQuestWin")?.classList.remove("show");
  }

  function suppress(ms = 5000) {
    expectedMission = null;
    suppressUntil = Math.max(suppressUntil, Date.now() + ms);
    hide();
    for (const delay of [0, 40, 120, 300, 700, 1400, 2600, 4200]) {
      setTimeout(() => { if (Date.now() < suppressUntil) hide(); }, delay);
    }
  }

  function arm(id) {
    if (!id || !questIds.has(id)) {
      expectedMission = null;
      return;
    }
    if (isDone(read(), id)) {
      suppress();
      return;
    }
    suppressUntil = 0;
    expectedMission = id;
  }

  document.addEventListener("click", event => {
    if (event.target.closest?.("#kpWinClose")) {
      suppress();
      return;
    }
    const questButton = event.target.closest?.(".q-done[data-poi]");
    if (questButton) {
      arm(questButton.dataset.poi);
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

  function keyFor(id, state) {
    const op = state?.missionStatus?.[id];
    return `${id}:${op?.updatedAt || state?.updatedAt || "legacy"}`;
  }

  function validate() {
    const overlay = document.getElementById("kpQuestWin");
    if (!overlay?.classList.contains("show")) return;
    if (Date.now() < suppressUntil) {
      overlay.classList.remove("show");
      return;
    }
    const state = read();
    const id = expectedMission;
    if (!id || !isDone(state, id)) {
      overlay.classList.remove("show");
      return;
    }
    const key = keyFor(id, state);
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
    const relevant = records.some(record => {
      if (record.type === "attributes") return record.target?.id === "kpQuestWin" && record.attributeName === "class";
      if (record.type === "childList") return [...record.addedNodes].some(node => node?.id === "kpQuestWin" || node?.querySelector?.("#kpQuestWin"));
      return false;
    });
    if (relevant) queueMicrotask(validate);
  });

  function start() {
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true });
    validate();
    window.KP_CELEBRATION_STABILITY = { version: "1.0", undoSuppression: true, delayedDuplicateBlocked: true };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
