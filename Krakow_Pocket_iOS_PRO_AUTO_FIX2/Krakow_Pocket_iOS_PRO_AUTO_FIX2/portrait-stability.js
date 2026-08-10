(() => {
  "use strict";
  if (window.__kpPortraitStability) return;
  window.__kpPortraitStability = true;

  let repairing = false;
  let scheduled = 0;

  const selectedPlayer = () => localStorage.getItem("krakowPlayer") === "Laura" ? "Laura" : "Ismael";

  function sourceFor(name) {
    return document.querySelector(`#kpPlayerPicker [data-kp-player="${name}"] .kp-picker-face svg`);
  }

  function ensurePortrait() {
    if (repairing) return false;
    const portrait = document.querySelector("#kpGameHud .kp-game-portrait");
    if (!portrait) return false;
    const existing = portrait.querySelectorAll(".kp-profile-face[data-kp-profile]");
    if (existing.length === 2) return true;

    const ismael = sourceFor("Ismael");
    const laura = sourceFor("Laura");
    if (!ismael || !laura) return false;

    repairing = true;
    try {
      const who = selectedPlayer();
      const i = ismael.cloneNode(true);
      const l = laura.cloneNode(true);
      i.classList.add("kp-character-asset");
      l.classList.add("kp-character-asset");
      const stack = document.createElement("span");
      stack.className = "kp-profile-stack";
      const faceI = document.createElement("span");
      faceI.className = `kp-profile-face${who === "Ismael" ? " active" : ""}`;
      faceI.dataset.kpProfile = "Ismael";
      faceI.appendChild(i);
      const faceL = document.createElement("span");
      faceL.className = `kp-profile-face${who === "Laura" ? " active" : ""}`;
      faceL.dataset.kpProfile = "Laura";
      faceL.appendChild(l);
      stack.append(faceI, faceL);
      portrait.replaceChildren(stack);
      portrait.dataset.profileWho = who;
      portrait.setAttribute("aria-label", `Perfiles de Ismael y Laura. Jugador activo: ${who}`);
      portrait.setAttribute("role", "button");
      portrait.tabIndex = 0;
      return true;
    } finally {
      repairing = false;
    }
  }

  function paintSelection() {
    const who = selectedPlayer();
    document.querySelectorAll("#kpGameHud .kp-profile-face[data-kp-profile]").forEach(face => {
      face.classList.toggle("active", face.dataset.kpProfile === who);
    });
    const portrait = document.querySelector("#kpGameHud .kp-game-portrait");
    if (portrait) portrait.dataset.profileWho = who;
  }

  function repair() {
    scheduled = 0;
    if (ensurePortrait()) paintSelection();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = requestAnimationFrame(repair);
  }

  function boot() {
    repair();
    const observer = new MutationObserver(records => {
      if (repairing) return;
      if (records.some(record => {
        const target = record.target;
        return target?.closest?.("#kpGameHud, #kpPlayerPicker") || [...record.addedNodes].some(node => node?.matches?.("#kpGameHud, #kpPlayerPicker") || node?.querySelector?.("#kpGameHud, #kpPlayerPicker"));
      })) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    for (const delay of [40, 120, 280, 600, 1100, 1800, 2800, 4200, 6500]) setTimeout(repair, delay);
    window.addEventListener("storage", schedule);
    window.addEventListener("pageshow", schedule);
    window.addEventListener("kp:statechange", schedule);
    window.addEventListener("orientationchange", () => setTimeout(repair, 120), { passive: true });
    window.KP_PORTRAIT_STABILITY = { version: "1.0", dualPortraitRepair: true };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
