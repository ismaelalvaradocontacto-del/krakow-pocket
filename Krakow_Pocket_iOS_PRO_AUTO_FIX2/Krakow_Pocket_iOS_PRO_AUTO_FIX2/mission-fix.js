(() => {
  "use strict";
  const D = window.KP_DATA;
  if (!D || window.__kpMissionUxV4) return;
  window.__kpMissionUxV4 = true;

  const STORAGE = "krakowPocketCoop";
  const qIds = new Set((D.quests || []).map(q => q.poi));
  const now = () => new Date().toISOString();
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
    clearTimeout(el._kpMissionUxTimer);
    el._kpMissionUxTimer = setTimeout(() => { el.style.display = "none"; }, ms);
  }

  function closeCelebration() {
    document.getElementById("kpQuestWin")?.classList.remove("show");
    try { sessionStorage.removeItem("kpCelebrateMission"); } catch {}
  }

  function ensureCelebration() {
    let win = document.getElementById("kpQuestWin");
    if (win) return win;
    win = document.createElement("div");
    win.id = "kpQuestWin";
    win.className = "kp-quest-win";
    win.innerHTML = '<div class="kp-win-card"><div class="kp-win-icon" id="kpWinIcon">🐉</div><div class="kp-win-kicker">MISIÓN COMPLETADA</div><div class="kp-win-title" id="kpWinTitle"></div><div class="kp-win-text" id="kpWinText"></div><div class="kp-win-reward" id="kpWinReward"></div><div class="kp-win-milestone" id="kpWinMilestone"></div><button id="kpWinClose">Seguir la aventura</button></div>';
    document.body.appendChild(win);
    win.querySelector("#kpWinClose").onclick = closeCelebration;
    win.onclick = event => { if (event.target === win) closeCelebration(); };
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

  let lastCelebratedId = null;
  let lastCelebratedAt = 0;
  function celebrate(id) {
    const q = (D.quests || []).find(x => x.poi === id);
    if (!q || !isDone(read(), id)) return;
    const t = Date.now();
    if (lastCelebratedId === id && t - lastCelebratedAt < 1600) return;
    lastCelebratedId = id;
    lastCelebratedAt = t;

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
      } else if (last[id] && !next[id]) {
        closeCelebration();
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
    button.disabled = false;
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
    const s = read();
    const done = qIds.has(id) ? isDone(s, id) : discovered(s, id);
    const label = done ? "↩ Desmarcar descubierto" : "✨ Marcar descubierto";
    if (button.textContent !== label) button.textContent = label;
  }

  function setDiscovery(id, done) {
    const s = read();
    const stamp = now();
    s.discoveryStatus = {
      ...(s.discoveryStatus || {}),
      [id]: { done: !!done, updatedAt: stamp }
    };
    const visited = new Set(s.visited || []);
    if (done) visited.add(id); else visited.delete(id);
    s.visited = [...visited];
    s.updatedAt = stamp;
    localStorage.setItem(STORAGE, JSON.stringify(s));
    try { sessionStorage.setItem("kpDiscoveryChanged", id); } catch {}
    toast(done ? "✨ Lugar descubierto" : "↩ Lugar marcado de nuevo como pendiente");
    setTimeout(() => location.reload(), 220);
  }

  document.addEventListener("click", event => {
    const qButton = event.target.closest?.(".q-done[data-poi]");
    if (qButton) {
      pendingQuest = qButton.dataset.poi || null;
      if (pendingQuest && isDone(read(), pendingQuest)) closeCelebration();
    }

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
        closeCelebration();
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
      if (isDone(read(), id)) closeCelebration();
      pendingQuest = id;
      document.querySelector(`.q-done[data-poi="${CSS.escape(id)}"]`)?.click();
      document.getElementById("storyDialog")?.close();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    document.getElementById("storyDialog")?.close();
    setDiscovery(id, !discovered(read(), id));
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

  window.KP_MISSION_UX = { version: "4.2", stateHooks: false, networkHooks: false };
})();
