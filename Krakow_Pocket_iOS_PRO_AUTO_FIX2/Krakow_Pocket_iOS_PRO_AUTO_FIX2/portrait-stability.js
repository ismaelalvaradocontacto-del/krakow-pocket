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

  function profileHealth() {
    const faces = [...document.querySelectorAll("#kpGameHud .kp-profile-face[data-kp-profile]")];
    const names = new Set(faces.map(face => face.dataset.kpProfile));
    return faces.length === 2 && names.has("Ismael") && names.has("Laura");
  }

  function updateMarker() {
    window.KP_PORTRAIT_STABILITY = {
      version: "1.2",
      dualPortraitRepair: true,
      synchronousUiRepair: true,
      profilesVerified: profileHealth()
    };
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
    updateMarker();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = requestAnimationFrame(repair);
  }

  function repairAfterUiMutation() {
    queueMicrotask(repair);
    requestAnimationFrame(repair);
    setTimeout(repair, 0);
    setTimeout(repair, 30);
    setTimeout(repair, 90);
    setTimeout(repair, 220);
  }

  function boot() {
    repair();
    const observer = new MutationObserver(records => {
      if (repairing) return;
      if (records.some(record => {
        const target = record.target;
        return target?.closest?.("#kpGameHud, #kpPlayerPicker") || [...record.addedNodes].some(node => node?.matches?.("#kpGameHud, #kpPlayerPicker") || node?.querySelector?.("#kpGameHud, #kpPlayerPicker"));
      })) repairAfterUiMutation();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", event => {
      if (event.target.closest?.('.tab[data-panel],#kpGameHub [data-go],#openSettings,#kpGameSettings,#quickMap,#quickExpense,#quickMemory,#kpPlayerPicker [data-kp-player]')) {
        repairAfterUiMutation();
      }
    }, false);

    for (const delay of [20, 60, 120, 240, 450, 750, 1100, 1600, 2300, 3200, 4500, 6500]) setTimeout(repair, delay);
    window.addEventListener("storage", repairAfterUiMutation);
    window.addEventListener("pageshow", repairAfterUiMutation);
    window.addEventListener("kp:render", repairAfterUiMutation);
    window.addEventListener("kp:game-render", repairAfterUiMutation);
    window.addEventListener("kp:statechange", repairAfterUiMutation);
    window.addEventListener("orientationchange", () => setTimeout(repairAfterUiMutation, 100), { passive: true });
    updateMarker();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
