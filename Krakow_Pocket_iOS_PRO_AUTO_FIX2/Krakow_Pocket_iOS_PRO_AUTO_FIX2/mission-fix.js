(() => {
  "use strict";
  const D = window.KP_DATA;
  if (!D || window.__kpMissionUxV4) return;
  window.__kpMissionUxV4 = true;

  const STORAGE = "krakowPocketCoop";
  const CLOUD = {
    url: "https://ahzmwkztlakejmrvgcdm.supabase.co",
    key: "sb_publishable_sf-RddHTp5jdFCQOfRBBsQ_PZGKOlxJ",
    code: "WAWEL-ISMAEL-LAURA",
    secret: "krakow2026"
  };
  const qIds = new Set((D.quests || []).map(q => q.poi));
  const now = () => new Date().toISOString();
  const time = value => {
    const n = new Date(value || 0).getTime();
    return Number.isFinite(n) ? n : 0;
  };
  const read = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); }
    catch { return {}; }
  };
  const isDone = (s, id) => s?.missionStatus?.[id] ? !!s.missionStatus[id].done : (s?.visited || []).includes(id);
  const discovered = (s, id) => s?.discoveryStatus?.[id] ? !!s.discoveryStatus[id].done : (s?.visited || []).includes(id);

  function snapshot(s = read()) {
    const out = {};
    for (const q of D.quests || []) out[q.poi] = isDone(s, q.poi);
    return out;
  }

  function toast(text, ms = 2300) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = text;
    el.style.display = "block";
    clearTimeout(el._kpUxTimer);
    el._kpUxTimer = setTimeout(() => { el.style.display = "none"; }, ms);
  }

  function ensureCelebration() {
    let win = document.getElementById("kpQuestWin");
    if (win) return win;
    win = document.createElement("div");
    win.id = "kpQuestWin";
    win.className = "kp-quest-win";
    win.innerHTML = '<div class="kp-win-card"><div class="kp-win-icon" id="kpWinIcon">🐉</div><div class="kp-win-kicker">MISIÓN COMPLETADA</div><div class="kp-win-title" id="kpWinTitle"></div><div class="kp-win-text" id="kpWinText"></div><div class="kp-win-reward" id="kpWinReward"></div><div class="kp-win-milestone" id="kpWinMilestone"></div><button id="kpWinClose">Seguir la aventura</button></div>';
    document.body.appendChild(win);
    win.querySelector("#kpWinClose").onclick = () => win.classList.remove("show");
    win.onclick = e => { if (e.target === win) win.classList.remove("show"); };
    return win;
  }

  const cheers = {
    florian: ["¡La ciudad os deja pasar!", "Primera escama asegurada. La aventura ya está oficialmente en marcha."],
    rynek: ["¡Ojos de explorador desbloqueados!", "Otra pequeña victoria compartida en pleno corazón de Cracovia."],
    maria: ["¡Hejnał localizado!", "Habéis mirado hacia arriba y Cracovia os recompensa por ello."],
    maius: ["¡Secreto universitario descubierto!", "Una escama más para la colección de Ismael y Laura."],
    wawel: ["¡Territorio real conquistado!", "Wawel ya forma parte de vuestra aventura."],
    dragon: ["¡ESCAMA LEGENDARIA!", "El Dragón de Wawel reconoce vuestra hazaña."],
    szeroka: ["¡Kazimierz descubierto!", "Habéis parado, mirado y sumado otra escama."],
    placnowy: ["¡Misión completada!", "Buen ojo y mejor presupuesto. Otra escama para la bolsa."],
    bernatek: ["¡Puente cruzado!", "Dos barrios conectados y una misión menos pendiente."],
    ghetto: ["Misión de memoria completada", "Gracias por dedicar tiempo y atención a este lugar."],
    tomasza: ["¡Maestros del złoty!", "Comer bien y cuidar el presupuesto también cuenta como aventura."],
    planty: ["¡Descanso profesional!", "A veces completar una misión consiste precisamente en parar."]
  };

  function celebrate(id) {
    const q = (D.quests || []).find(x => x.poi === id);
    if (!q) return;
    const p = (D.pois || []).find(x => x.id === id);
    const s = read();
    const completed = (D.quests || []).filter(x => isDone(s, x.poi));
    const score = completed.reduce((sum, x) => sum + (+x.points || 0), 0);
    const copy = cheers[id] || ["¡Misión superada!", "Cracovia acaba de entregaros otra pequeña victoria."];
    const milestones = {
      3: "🌱 Tres misiones completadas. La aventura ya tiene ritmo.",
      6: "⚔️ Mitad de las misiones. El dragón empieza a ponerse nervioso.",
      9: "👑 Nueve misiones. Ya casi tenéis todas las escamas.",
      12: "🏆 ¡LAS 12 ESCAMAS! Aventura completada."
    };
    const win = ensureCelebration();
    win.querySelector("#kpWinIcon").textContent = p?.emoji || "🐉";
    win.querySelector("#kpWinTitle").textContent = copy[0];
    win.querySelector("#kpWinText").textContent = copy[1];
    win.querySelector("#kpWinReward").textContent = `+${q.points} 🐉 · ${score} escamas · ${completed.length}/${D.quests.length}`;
    const milestone = win.querySelector("#kpWinMilestone");
    milestone.textContent = milestones[completed.length] || "";
    milestone.style.display = milestones[completed.length] ? "block" : "none";
    try { sessionStorage.removeItem("kpCelebrateMission"); } catch {}
    win.classList.add("show");
    navigator.vibrate?.([35, 45, 35]);
  }

  let last = snapshot();
  let armed = false;
  let pendingQuest = null;
  let activeStory = null;

  function inspectTransitions() {
    const next = snapshot();
    if (!armed) {
      last = next;
      return;
    }
    for (const id of Object.keys(next)) {
      if (!last[id] && next[id]) {
        if (!pendingQuest || pendingQuest === id) celebrate(id);
      }
    }
    last = next;
    pendingQuest = null;
  }

  function arm() {
    last = snapshot();
    armed = true;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(arm, 1200), { once: true });
  else setTimeout(arm, 1200);

  window.addEventListener("kp:statechange", () => queueMicrotask(inspectTransitions));
  window.addEventListener("storage", () => queueMicrotask(inspectTransitions));

  function setMissionDialogState(id) {
    const dialog = document.getElementById("kpQuestDialog");
    const button = document.getElementById("kpPixelDone");
    if (!dialog || !button || !id) return;
    if (dialog.dataset.kpPoi !== id) dialog.dataset.kpPoi = id;
    const done = isDone(read(), id);
    if (button.disabled) button.disabled = false;
    const label = done ? "↩ Desmarcar" : "Completar";
    if (button.textContent !== label) button.textContent = label;
  }

  function storyIdFromDialog() {
    const dialog = document.getElementById("storyDialog");
    if (dialog?.dataset.kpPoi) return dialog.dataset.kpPoi;
    const title = document.getElementById("storyDialogTitle")?.textContent || "";
    return (D.pois || []).find(x => title.includes(x.name))?.id || activeStory;
  }

  function syncStoryButton(id = storyIdFromDialog()) {
    const button = document.getElementById("storyMark");
    if (!button || !id) return;
    const state = read();
    const done = qIds.has(id) ? isDone(state, id) : discovered(state, id);
    const label = done ? "↩ Desmarcar descubierto" : "✨ Marcar descubierto";
    if (button.textContent !== label) button.textContent = label;
  }

  function mergeRecords(a = [], b = []) {
    const map = new Map();
    for (const item of [...b, ...a]) {
      if (!item?.id) continue;
      const prev = map.get(item.id);
      if (!prev || time(item.updatedAt || item.ts) >= time(prev.updatedAt || prev.ts)) map.set(item.id, item);
    }
    return [...map.values()];
  }

  function mergeTimedObjects(a = {}, b = {}) {
    const out = {};
    for (const src of [a, b]) for (const [id, op] of Object.entries(src || {})) {
      if (!op || typeof op !== "object") continue;
      const prev = out[id];
      if (!prev || time(op.updatedAt) >= time(prev.updatedAt)) out[id] = { ...op };
    }
    return out;
  }

  async function rpc(name, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${CLOUD.url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: CLOUD.key },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
      return text ? JSON.parse(text) : null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function undoNonQuest(id) {
    const local = read();
    const t = now();
    local.discoveryStatus = { ...(local.discoveryStatus || {}), [id]: { done: false, updatedAt: t } };
    local.visited = (local.visited || []).filter(x => x !== id);
    local.updatedAt = t;
    localStorage.setItem(STORAGE, JSON.stringify(local));
    toast("↩ Lugar marcado de nuevo como pendiente");

    try {
      const remote = await rpc("adventure_get", { p_code: CLOUD.code, p_secret: CLOUD.secret }) || {};
      const visited = new Set([...(remote.visited || []), ...(local.visited || [])]);
      visited.delete(id);
      const merged = {
        ...remote,
        ...local,
        visited: [...visited],
        expenses: mergeRecords(local.expenses || [], remote.expenses || []),
        memories: mergeRecords(local.memories || [], remote.memories || []),
        missionStatus: mergeTimedObjects(remote.missionStatus || {}, local.missionStatus || {}),
        discoveryStatus: mergeTimedObjects(remote.discoveryStatus || {}, local.discoveryStatus || {}),
        updatedAt: t
      };
      await rpc("adventure_put", { p_code: CLOUD.code, p_secret: CLOUD.secret, p_state: merged });
      localStorage.setItem(STORAGE, JSON.stringify(merged));
    } catch (error) {
      console.warn("Kraków Pocket discovery undo sync", error);
    }
  }

  function enforceDiscoveryTombstones() {
    const s = read();
    if (!s.discoveryStatus || !Array.isArray(s.visited)) return;
    const blocked = Object.entries(s.discoveryStatus).filter(([, op]) => op && op.done === false).map(([id]) => id);
    if (!blocked.some(id => s.visited.includes(id))) return;
    s.visited = s.visited.filter(id => !blocked.includes(id));
    localStorage.setItem(STORAGE, JSON.stringify(s));
  }
  window.addEventListener("kp:statechange", enforceDiscoveryTombstones);
  window.addEventListener("storage", enforceDiscoveryTombstones);
  enforceDiscoveryTombstones();

  document.addEventListener("click", event => {
    const qButton = event.target.closest?.(".q-done[data-poi]");
    if (qButton) pendingQuest = qButton.dataset.poi || null;

    const worldNode = event.target.closest?.(".kp-world-node[data-pixel-poi]");
    if (worldNode) {
      const id = worldNode.dataset.pixelPoi;
      setTimeout(() => setMissionDialogState(id), 0);
    }

    const storySource = event.target.closest?.(".q-context[data-poi],.story-open[data-poi],.near-story[data-poi],[data-open-poi]");
    if (storySource) {
      activeStory = storySource.dataset.poi || storySource.dataset.openPoi || null;
      setTimeout(() => {
        const dialog = document.getElementById("storyDialog");
        if (dialog && activeStory && dialog.dataset.kpPoi !== activeStory) dialog.dataset.kpPoi = activeStory;
        syncStoryButton(activeStory);
      }, 0);
    }

    const pixelDone = event.target.closest?.("#kpPixelDone");
    if (pixelDone) {
      const id = document.getElementById("kpQuestDialog")?.dataset.kpPoi;
      if (id && isDone(read(), id)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        pendingQuest = id;
        document.querySelector(`.q-done[data-poi="${CSS.escape(id)}"]`)?.click();
        document.getElementById("kpQuestDialog")?.classList.remove("show");
      }
      return;
    }

    const storyMark = event.target.closest?.("#storyMark");
    if (!storyMark) return;
    const id = storyIdFromDialog();
    if (!id) return;

    if (qIds.has(id)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      pendingQuest = id;
      document.querySelector(`.q-done[data-poi="${CSS.escape(id)}"]`)?.click();
      document.getElementById("storyDialog")?.close();
      return;
    }

    if (discovered(read(), id)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.getElementById("storyDialog")?.close();
      undoNonQuest(id).catch(() => {});
    }
  }, true);

  const observer = new MutationObserver(records => {
    let missionChanged = false;
    let storyChanged = false;
    for (const record of records) {
      const target = record.target;
      if (target?.id === "kpQuestDialog" || target?.closest?.("#kpQuestDialog")) missionChanged = true;
      if (target?.id === "storyDialog" || target?.closest?.("#storyDialog")) storyChanged = true;
    }
    if (missionChanged) {
      const missionDialog = document.getElementById("kpQuestDialog");
      if (missionDialog?.classList.contains("show") && missionDialog.dataset.kpPoi) setMissionDialogState(missionDialog.dataset.kpPoi);
    }
    if (storyChanged) {
      const storyDialog = document.getElementById("storyDialog");
      if (storyDialog?.open) {
        const id = storyIdFromDialog();
        if (id) {
          if (storyDialog.dataset.kpPoi !== id) storyDialog.dataset.kpPoi = id;
          activeStory = id;
          syncStoryButton(id);
        }
      }
    }
  });
  const startObserver = () => observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "open"] });
  if (document.body) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });

  window.KP_MISSION_UX = { version: "4.1", stateHooks: false, networkHooks: false };
})();
