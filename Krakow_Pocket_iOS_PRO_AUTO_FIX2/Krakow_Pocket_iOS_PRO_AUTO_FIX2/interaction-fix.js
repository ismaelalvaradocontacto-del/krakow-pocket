(() => {
  "use strict";
  if (window.__kpInteractionFix) return;
  window.__kpInteractionFix = true;

  const STORE = "krakowPocketCoop";
  const D = window.KP_DATA || { quests: [], pois: [] };
  const questIds = new Set((D.quests || []).map(q => q.poi));
  const now = () => new Date().toISOString();
  let pendingCelebration = null;
  let suppressCelebrationUntil = 0;

  const read = () => {
    try { return JSON.parse(localStorage.getItem(STORE) || "{}"); }
    catch { return {}; }
  };
  const missionDone = (state, id) => state?.missionStatus?.[id] ? state.missionStatus[id].done === true : (state?.visited || []).includes(id);
  const discoveryDone = (state, id) => state?.discoveryStatus?.[id] ? state.discoveryStatus[id].done === true : (state?.visited || []).includes(id);

  function storyId() {
    const title = document.getElementById("storyDialogTitle")?.textContent || "";
    const byTitle = (D.pois || []).find(p => title.includes(p.name))?.id;
    if (byTitle) return byTitle;
    return document.getElementById("storyDialog")?.dataset.kpPoi || null;
  }

  function hideCelebration() {
    document.getElementById("kpQuestWin")?.classList.remove("show");
  }

  function ensureCelebration() {
    let overlay = document.getElementById("kpQuestWin");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "kpQuestWin";
    overlay.className = "kp-quest-win";
    overlay.innerHTML = '<div class="kp-win-card"><div class="kp-win-icon" id="kpWinIcon">🐉</div><div class="kp-win-kicker">MISIÓN COMPLETADA</div><div class="kp-win-title" id="kpWinTitle"></div><div class="kp-win-text" id="kpWinText"></div><div class="kp-win-reward" id="kpWinReward"></div><div class="kp-win-milestone" id="kpWinMilestone"></div><button id="kpWinClose">Seguir la aventura</button></div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  const cheers = {
    florian:["¡La ciudad os deja pasar!","Primera escama asegurada. La aventura ya está oficialmente en marcha."],
    rynek:["¡Ojos de explorador desbloqueados!","Otra pequeña victoria compartida en pleno corazón de Cracovia."],
    maria:["¡Hejnał localizado!","Habéis mirado hacia arriba y Cracovia os recompensa por ello."],
    maius:["¡Secreto universitario descubierto!","Una escama más para la colección de Ismael y Laura."],
    wawel:["¡Territorio real conquistado!","Wawel ya forma parte de vuestra aventura."],
    dragon:["¡ESCAMA LEGENDARIA!","El Dragón de Wawel reconoce vuestra hazaña."],
    szeroka:["¡Kazimierz descubierto!","Habéis parado, mirado y sumado otra escama."],
    placnowy:["¡Misión completada!","Buen ojo y mejor presupuesto. Otra escama para la bolsa."],
    bernatek:["¡Puente cruzado!","Dos barrios conectados y una misión menos pendiente."],
    ghetto:["Misión de memoria completada","Gracias por dedicar tiempo y atención a este lugar."],
    tomasza:["¡Maestros del złoty!","Comer bien y cuidar el presupuesto también cuenta como aventura."],
    planty:["¡Descanso profesional!","A veces completar una misión consiste precisamente en parar."]
  };

  function paintCelebration(id) {
    if (!id || Date.now() < suppressCelebrationUntil || pendingCelebration !== id) return;
    const state = read();
    if (!missionDone(state, id)) return;
    const quest = (D.quests || []).find(q => q.poi === id);
    if (!quest) return;
    const poi = (D.pois || []).find(p => p.id === id);
    const completed = (D.quests || []).filter(q => missionDone(state, q.poi));
    const score = completed.reduce((sum, q) => sum + (+q.points || 0), 0);
    const copy = cheers[id] || ["¡Misión superada!","Cracovia acaba de entregaros otra pequeña victoria."];
    const milestones = {3:"🌱 Tres misiones completadas. La aventura ya tiene ritmo.",6:"⚔️ Mitad de las misiones. El dragón empieza a ponerse nervioso.",9:"👑 Nueve misiones. Ya casi tenéis todas las escamas.",12:"🏆 ¡LAS 12 ESCAMAS! Aventura completada."};
    const overlay = ensureCelebration();
    const set = (selector, value) => { const el = overlay.querySelector(selector); if (el && el.textContent !== value) el.textContent = value; };
    set("#kpWinIcon", poi?.emoji || "🐉");
    set("#kpWinTitle", copy[0]);
    set("#kpWinText", copy[1]);
    set("#kpWinReward", `+${quest.points} 🐉 · ${score} escamas · ${completed.length}/${D.quests.length}`);
    const milestone = overlay.querySelector("#kpWinMilestone");
    if (milestone) {
      milestone.textContent = milestones[completed.length] || "";
      milestone.style.display = milestones[completed.length] ? "block" : "none";
    }
    overlay.classList.add("show");
  }

  function armCelebration(id) {
    if (!id || !questIds.has(id)) return;
    if (missionDone(read(), id)) {
      pendingCelebration = null;
      suppressCelebrationUntil = Date.now() + 5200;
      hideCelebration();
      return;
    }
    pendingCelebration = id;
    suppressCelebrationUntil = 0;
    for (const delay of [80, 180, 350, 650, 1050, 1550, 2150]) setTimeout(() => paintCelebration(id), delay);
  }

  function closeAndSuppress() {
    pendingCelebration = null;
    suppressCelebrationUntil = Date.now() + 5200;
    hideCelebration();
    for (const delay of [40,120,300,700,1400,2500,4200]) setTimeout(() => {
      if (Date.now() < suppressCelebrationUntil) hideCelebration();
    }, delay);
  }

  function toast(text) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = text;
    el.style.display = "block";
    clearTimeout(el._kpInteractionTimer);
    el._kpInteractionTimer = setTimeout(() => { el.style.display = "none"; }, 2300);
  }

  function writeDiscovery(id, done) {
    const state = read();
    const stamp = now();
    state.discoveryStatus = { ...(state.discoveryStatus || {}), [id]: { done: !!done, updatedAt: stamp } };
    const visited = new Set(state.visited || []);
    if (done) visited.add(id); else visited.delete(id);
    state.visited = [...visited];
    state.updatedAt = stamp;
    localStorage.setItem(STORE, JSON.stringify(state));
    return stamp;
  }

  function reassertDiscovery(id, done, stamp) {
    const state = read();
    const op = state.discoveryStatus?.[id];
    if (op?.done === !!done && (!done || (state.visited || []).includes(id)) && (done || !(state.visited || []).includes(id))) return;
    state.discoveryStatus = { ...(state.discoveryStatus || {}), [id]: { done: !!done, updatedAt: stamp } };
    const visited = new Set(state.visited || []);
    if (done) visited.add(id); else visited.delete(id);
    state.visited = [...visited];
    state.updatedAt = stamp;
    localStorage.setItem(STORE, JSON.stringify(state));
  }

  function nudgeSync() {
    const target = document.getElementById("dailyTarget");
    if (!target) return;
    try { target.dispatchEvent(new Event("change", { bubbles: true })); } catch {}
  }

  function setDiscovery(id, done) {
    const stamp = writeDiscovery(id, done);
    try { window.dispatchEvent(new CustomEvent("kp:statechange", { detail: { source:"interaction-fix", id, done:!!done } })); } catch {}
    try { window.dispatchEvent(new Event("storage")); } catch {}
    for (const delay of [30,100,280,700,1500,2600]) setTimeout(() => reassertDiscovery(id, done, stamp), delay);
    for (const delay of [60,260,900]) setTimeout(nudgeSync, delay);
    document.getElementById("storyDialog")?.close();
    toast(done ? "✨ Lugar descubierto" : "↩ Lugar marcado de nuevo como pendiente");
  }

  window.addEventListener("click", event => {
    if (event.target.closest?.("#kpWinClose")) {
      closeAndSuppress();
      return;
    }

    const questButton = event.target.closest?.(".q-done[data-poi]");
    if (questButton) {
      armCelebration(questButton.dataset.poi || null);
      return;
    }

    if (event.target.closest?.("#kpPixelDone")) {
      armCelebration(document.getElementById("kpQuestDialog")?.dataset.kpPoi || null);
      return;
    }

    if (!event.target.closest?.("#storyMark")) return;
    const id = storyId();
    if (!id) return;
    if (questIds.has(id)) {
      armCelebration(id);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    setDiscovery(id, !discoveryDone(read(), id));
  }, true);

  window.KP_INTERACTION_FIX = {
    version: "1.0",
    celebrationRecovery: true,
    reversibleNonQuestDiscoveries: true
  };
})();
