(() => {
  "use strict";
  const D = window.KP_DATA;
  if (!D || window.__kpMissionReliabilityV3) return;
  window.__kpMissionReliabilityV3 = true;

  const STORAGE = "krakowPocketCoop";
  const qIds = new Set((D.quests || []).map(q => q.poi));
  const now = () => new Date().toISOString();
  const stamp = value => {
    const n = new Date(value || 0).getTime();
    return Number.isFinite(n) ? n : 0;
  };
  const read = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); }
    catch { return {}; }
  };

  function mergeStatus(a = {}, b = {}) {
    const out = {};
    for (const src of [a, b]) {
      for (const [id, op] of Object.entries(src || {})) {
        if (!op || typeof op !== "object") continue;
        const prev = out[id];
        if (!prev || stamp(op.updatedAt) >= stamp(prev.updatedAt)) {
          out[id] = { done: !!op.done, updatedAt: op.updatedAt || "1970-01-01T00:00:00.000Z" };
        }
      }
    }
    return out;
  }

  function normalize(input, previous = null) {
    const s = input && typeof input === "object" ? input : {};
    if (!Array.isArray(s.visited)) s.visited = [];
    if (!Array.isArray(s.expenses)) s.expenses = [];
    if (!Array.isArray(s.memories)) s.memories = [];
    if (!s.config || typeof s.config !== "object") s.config = {};
    if (!s.missionStatus || typeof s.missionStatus !== "object" || Array.isArray(s.missionStatus)) s.missionStatus = {};
    if (previous?.missionStatus) s.missionStatus = mergeStatus(s.missionStatus, previous.missionStatus);

    const legacyStamp = s.updatedAt || "1970-01-01T00:00:00.000Z";
    for (const id of s.visited) {
      if (!s.missionStatus[id]) s.missionStatus[id] = { done: true, updatedAt: legacyStamp };
    }

    const visited = new Set(s.visited);
    for (const [id, op] of Object.entries(s.missionStatus)) {
      if (op?.done) visited.add(id); else visited.delete(id);
    }
    s.visited = [...visited];
    return s;
  }

  const isDone = (s, id) => {
    s = normalize(s);
    return s.missionStatus?.[id] ? !!s.missionStatus[id].done : s.visited.includes(id);
  };

  function writeStatus(id, done) {
    const s = normalize(read());
    const t = now();
    s.missionStatus[id] = { done: !!done, updatedAt: t };
    if (done) {
      if (!s.visited.includes(id)) s.visited.push(id);
    } else {
      s.visited = s.visited.filter(x => x !== id);
    }
    s.updatedAt = t;
    localStorage.setItem(STORAGE, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("kp:statechange", { detail: { source: "mission-fix", id, done: !!done } }));
    window.dispatchEvent(new Event("storage"));
    return s;
  }

  const nativeSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === STORAGE) {
      try {
        const previous = read();
        const incoming = JSON.parse(value || "{}");
        value = JSON.stringify(normalize(incoming, previous));
      } catch {}
    }
    return nativeSetItem.call(this, key, value);
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    try {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("/rest/v1/rpc/adventure_put") && init?.body) {
        const payload = JSON.parse(init.body);
        if (payload?.p_state) {
          const current = normalize(read());
          const outgoing = normalize(payload.p_state);
          outgoing.missionStatus = mergeStatus(outgoing.missionStatus, current.missionStatus);
          payload.p_state = normalize(outgoing);
          init = { ...init, body: JSON.stringify(payload) };
        }
      }
    } catch {}
    return nativeFetch(input, init);
  };

  function nudgeCloudSync() {
    const target = document.getElementById("dailyTarget");
    if (target) {
      try { target.dispatchEvent(new Event("change", { bubbles: true })); }
      catch {}
    }
  }

  function toast(text, ms = 2300) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = text;
    el.style.display = "block";
    clearTimeout(el._kpReliableTimer);
    el._kpReliableTimer = setTimeout(() => { el.style.display = "none"; }, ms);
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
    const s = normalize(read());
    const finished = (D.quests || []).filter(x => isDone(s, x.poi)).length;
    const score = (D.quests || []).filter(x => isDone(s, x.poi)).reduce((sum, x) => sum + (+x.points || 0), 0);
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
    win.querySelector("#kpWinReward").textContent = `+${q.points} 🐉 · ${score} escamas · ${finished}/${D.quests.length}`;
    const milestone = win.querySelector("#kpWinMilestone");
    milestone.textContent = milestones[finished] || "";
    milestone.style.display = milestones[finished] ? "block" : "none";
    win.classList.add("show");
    navigator.vibrate?.([35, 45, 35]);
  }

  function setMissionDialogState(id) {
    const dialog = document.getElementById("kpQuestDialog");
    const button = document.getElementById("kpPixelDone");
    if (!dialog || !button || !id) return;
    dialog.dataset.kpPoi = id;
    const done = isDone(read(), id);
    button.disabled = false;
    button.textContent = done ? "↩ Desmarcar" : "Completar";
  }

  function storyIdFromDialog() {
    const dialog = document.getElementById("storyDialog");
    if (dialog?.dataset.kpPoi) return dialog.dataset.kpPoi;
    const title = document.getElementById("storyDialogTitle")?.textContent || "";
    const p = (D.pois || []).find(x => title.includes(x.name));
    return p?.id || null;
  }

  function syncStoryButton(id = storyIdFromDialog()) {
    const button = document.getElementById("storyMark");
    if (!button || !id) return;
    const done = isDone(read(), id);
    button.textContent = done ? "↩ Desmarcar descubierto" : "✨ Marcar descubierto";
  }

  function softReload() {
    setTimeout(() => {
      try { location.reload(); } catch {}
    }, 700);
  }

  document.addEventListener("click", e => {
    const worldNode = e.target.closest?.(".kp-world-node[data-pixel-poi]");
    if (worldNode) {
      const id = worldNode.dataset.pixelPoi;
      setTimeout(() => setMissionDialogState(id), 0);
    }

    const storySource = e.target.closest?.(".q-context[data-poi],.story-open[data-poi],.near-story[data-poi],[data-open-poi]");
    if (storySource) {
      const id = storySource.dataset.poi || storySource.dataset.openPoi;
      setTimeout(() => {
        const dialog = document.getElementById("storyDialog");
        if (dialog && id) dialog.dataset.kpPoi = id;
        syncStoryButton(id);
      }, 0);
    }

    const missionButton = e.target.closest?.(".q-done[data-poi]");
    if (missionButton) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const id = missionButton.dataset.poi;
      const before = isDone(read(), id);
      if (!before) {
        const original = missionButton.onclick;
        if (typeof original === "function") {
          try { original.call(missionButton, e); } catch (error) { console.warn(error); }
        }
        writeStatus(id, true);
        toast(`+${(D.quests || []).find(q => q.poi === id)?.points || 0} escamas 🐉`);
        setTimeout(() => celebrate(id), 90);
      } else {
        writeStatus(id, false);
        nudgeCloudSync();
        toast("↩ Misión marcada de nuevo como pendiente");
        document.getElementById("kpQuestDialog")?.classList.remove("show");
        softReload();
      }
      return;
    }

    const storyMark = e.target.closest?.("#storyMark");
    if (storyMark) {
      const id = storyIdFromDialog();
      if (!id) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const before = isDone(read(), id);
      if (!before) {
        const original = storyMark.onclick;
        if (typeof original === "function") {
          try { original.call(storyMark, e); } catch (error) { console.warn(error); }
        }
        writeStatus(id, true);
        if (qIds.has(id)) setTimeout(() => celebrate(id), 90);
        else toast("✨ Lugar descubierto");
      } else {
        writeStatus(id, false);
        nudgeCloudSync();
        document.getElementById("storyDialog")?.close();
        toast(qIds.has(id) ? "↩ Misión vuelve a estar pendiente" : "↩ Lugar marcado como pendiente");
        softReload();
      }
      return;
    }
  }, true);

  const observer = new MutationObserver(() => {
    const missionDialog = document.getElementById("kpQuestDialog");
    if (missionDialog?.classList.contains("show") && missionDialog.dataset.kpPoi) setMissionDialogState(missionDialog.dataset.kpPoi);
    const storyDialog = document.getElementById("storyDialog");
    if (storyDialog?.open) syncStoryButton();
  });
  const startObserver = () => observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "open"] });
  if (document.body) startObserver(); else document.addEventListener("DOMContentLoaded", startObserver, { once: true });

  const style = document.createElement("style");
  style.dataset.kpMissionFixStyle = "1";
  style.textContent = `
    html.kp-game #settingsSheet{max-height:calc(100dvh - 58px)!important;margin-top:max(44px,calc(env(safe-area-inset-top) + 14px))!important;}
    html.kp-game #settingsSheet .sheet-head{padding-top:16px!important;padding-right:12px!important;min-height:68px!important;}
    html.kp-game #settingsSheet .close-btn{flex:0 0 48px!important;width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;display:grid!important;place-items:center!important;font-size:21px!important;margin-left:10px!important;position:relative!important;z-index:5!important;}
    @media(max-width:480px){
      html.kp-game #settingsSheet{width:calc(100vw - 12px)!important;max-height:calc(100dvh - 64px)!important;margin:52px 6px 6px!important;border-radius:18px 18px 0 0!important;}
      html.kp-game #settingsSheet .sheet-head{padding:14px 12px!important;min-height:72px!important;}
      html.kp-game #settingsSheet .close-btn{width:50px!important;height:50px!important;min-width:50px!important;min-height:50px!important;}
    }
  `;
  document.head.appendChild(style);
})();
