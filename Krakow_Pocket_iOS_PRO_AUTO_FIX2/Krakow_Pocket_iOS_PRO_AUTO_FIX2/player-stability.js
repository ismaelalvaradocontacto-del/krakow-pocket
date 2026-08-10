(() => {
  "use strict";
  if (window.__kpPlayerStability) return;
  window.__kpPlayerStability = true;

  const KEY = "krakowPlayer";
  let desired = null;
  let desiredUntil = 0;
  let binding = false;

  const valid = value => value === "Ismael" || value === "Laura";

  function paint(who) {
    document.querySelectorAll("#kpPlayerPicker [data-kp-player]").forEach(button => {
      const active = button.dataset.kpPlayer === who;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      const small = button.querySelector("small");
      if (small) small.textContent = active ? "Este iPhone" : "Toca para elegir";
    });
    document.querySelectorAll("#kpGameHud .kp-profile-face[data-kp-profile]").forEach(face => {
      face.classList.toggle("active", face.dataset.kpProfile === who);
    });
    const portrait = document.querySelector("#kpGameHud .kp-game-portrait");
    if (portrait) portrait.dataset.profileWho = who;
  }

  function enforce(who, dispatch = false) {
    if (!valid(who)) return;
    if (localStorage.getItem(KEY) !== who) localStorage.setItem(KEY, who);
    const select = document.getElementById("playerSelect");
    if (select && select.value !== who) {
      select.value = who;
      if (dispatch) select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    paint(who);
    window.KP_PLAYER_STABILITY = {
      version: "1.0",
      deterministicSelection: true,
      selected: who,
      persisted: localStorage.getItem(KEY) === who
    };
  }

  function select(who) {
    if (!valid(who)) return;
    desired = who;
    desiredUntil = Date.now() + 3200;
    enforce(who, true);
    for (const delay of [0, 20, 60, 140, 300, 650, 1100, 1800, 2800]) {
      setTimeout(() => {
        if (desired === who && Date.now() <= desiredUntil) enforce(who, false);
      }, delay);
    }
  }

  function bindCards() {
    if (binding) return;
    binding = true;
    try {
      document.querySelectorAll("#kpPlayerPicker [data-kp-player]").forEach(button => {
        if (button.dataset.kpStableBound === "1") return;
        button.dataset.kpStableBound = "1";
        button.addEventListener("click", () => select(button.dataset.kpPlayer), { capture: true });
      });
    } finally {
      binding = false;
    }
  }

  function boot() {
    bindCards();
    const initial = localStorage.getItem(KEY);
    if (valid(initial)) enforce(initial, false);
    else enforce("Ismael", false);

    const observer = new MutationObserver(() => {
      bindCards();
      if (desired && Date.now() <= desiredUntil) enforce(desired, false);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("pageshow", () => {
      const who = desired && Date.now() <= desiredUntil ? desired : localStorage.getItem(KEY);
      if (valid(who)) enforce(who, false);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
