(() => {
  "use strict";

  const CLOUD = {
    url: "https://ahzmwkztlakejmrvgcdm.supabase.co",
    key: "sb_publishable_sf-RddHTp5jdFCQOfRBBsQ_PZGKOlxJ",
    code: "POCKET-ACCESS-2026",
    secret: "pocket-access-2026-a41e7c9d"
  };
  const PENDING_KEY = "pocketPendingAccessV1";
  const PUBLIC_FILES = new Set(["", "index.html", "instalar.html", "administrar.html"]);

  let registryCache = null;
  let currentEntry = null;
  let pollTimer = null;
  let initialized = false;

  const nowIso = () => new Date().toISOString();
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeKey = value => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const titleName = value => String(value || "").trim().replace(/\s+/g, " ").split(" ").map(part => part ? part[0].toLocaleUpperCase("es") + part.slice(1).toLocaleLowerCase("es") : part).join(" ");
  const esc = value => String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function ensureStyles() {
    if (document.querySelector('link[data-pocket-access]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./pocket-access.css?v=20260830j";
    link.dataset.pocketAccess = "1";
    document.head.appendChild(link);
  }
  ensureStyles();

  async function waitForAuth() {
    const start = Date.now();
    while (!window.PocketAuth) {
      if (Date.now() - start > 15000) throw new Error("Pocket Auth no está disponible");
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    await window.PocketAuth.ready;
    return window.PocketAuth;
  }

  async function rpc(name, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${CLOUD.url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {"Content-Type":"application/json", "apikey":CLOUD.key},
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) {
        let message = text || `HTTP ${response.status}`;
        try { const json = JSON.parse(text); message = json.message || json.error || message; } catch {}
        throw new Error(message);
      }
      return text ? JSON.parse(text) : null;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("La conexión está tardando demasiado");
      throw error;
    } finally { clearTimeout(timer); }
  }

  const emptyRegistry = () => ({schema:1, entries:[], createdAt:nowIso(), updatedAt:nowIso()});

  function normalizeRegistry(raw) {
    const value = raw && typeof raw === "object" ? clone(raw) : emptyRegistry();
    if (!Array.isArray(value.entries)) value.entries = [];
    value.schema = 1;
    value.entries = value.entries.map(entry => ({
      key: entry.key || normalizeKey(entry.name),
      name: titleName(entry.name),
      status: ["pending","approved","blocked"].includes(entry.status) ? entry.status : "pending",
      allowedPages: Array.isArray(entry.allowedPages) ? [...new Set(entry.allowedPages.map(String).filter(Boolean))] : [],
      requestedAt: entry.requestedAt || entry.createdAt || nowIso(),
      approvedAt: entry.approvedAt || null,
      updatedAt: entry.updatedAt || nowIso()
    })).filter(entry => entry.key && entry.name);
    value.createdAt = value.createdAt || nowIso();
    value.updatedAt = value.updatedAt || nowIso();
    return value;
  }

  async function getRegistry({fresh=false}={}) {
    if (registryCache && !fresh) return clone(registryCache);
    try {
      const raw = await rpc("adventure_get", {p_code:CLOUD.code, p_secret:CLOUD.secret});
      registryCache = normalizeRegistry(raw);
      return clone(registryCache);
    } catch (firstError) {
      const freshRegistry = emptyRegistry();
      try {
        await rpc("adventure_create", {p_code:CLOUD.code, p_secret:CLOUD.secret, p_state:freshRegistry});
        registryCache = freshRegistry;
        return clone(registryCache);
      } catch {
        try {
          const raw = await rpc("adventure_get", {p_code:CLOUD.code, p_secret:CLOUD.secret});
          registryCache = normalizeRegistry(raw);
          return clone(registryCache);
        } catch { throw firstError; }
      }
    }
  }

  async function putRegistry(registry) {
    const normalized = normalizeRegistry(registry);
    normalized.updatedAt = nowIso();
    await rpc("adventure_put", {p_code:CLOUD.code, p_secret:CLOUD.secret, p_state:normalized});
    registryCache = normalized;
    return clone(normalized);
  }

  async function mutateRegistry(mutator) {
    const registry = await getRegistry({fresh:true});
    const next = clone(registry);
    const result = await mutator(next);
    await putRegistry(next);
    return {registry:clone(next), result};
  }

  async function entryForName(name, {fresh=true}={}) {
    const key = normalizeKey(name);
    const registry = await getRegistry({fresh});
    return registry.entries.find(entry => entry.key === key) || null;
  }

  async function requestAccess(name) {
    const cleanName = titleName(name);
    const key = normalizeKey(cleanName);
    const outcome = await mutateRegistry(registry => {
      let entry = registry.entries.find(item => item.key === key);
      if (!entry) {
        entry = {key, name:cleanName, status:"pending", allowedPages:[], requestedAt:nowIso(), approvedAt:null, updatedAt:nowIso()};
        registry.entries.push(entry);
      } else {
        entry.name = cleanName;
        entry.updatedAt = nowIso();
      }
      return clone(entry);
    });
    return outcome.result;
  }

  function currentPageId() {
    const explicit = document.documentElement.dataset.pocketPageId || document.body?.dataset?.pocketPageId;
    if (explicit) return explicit;
    const file = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
    if (PUBLIC_FILES.has(file) || !/\.html$/i.test(file)) return null;
    return file.replace(/\.html$/i, "");
  }

  function isAdmin() {
    return !!window.PocketAuth?.isAdmin?.();
  }

  function canAccessPage(pageId) {
    if (!pageId) return true;
    if (isAdmin()) return true;
    const session = window.PocketAuth?.getSession?.();
    if (!session || !currentEntry || currentEntry.status !== "approved") return false;
    return currentEntry.allowedPages.includes(pageId);
  }

  function authGate(show) {
    const gate = document.querySelector(".pa-gate");
    if (!gate) return;
    if (show) gate.style.display = "";
    else gate.style.display = "none";
  }

  function getStateGate() {
    let gate = document.getElementById("paxGate");
    if (gate) return gate;
    gate = document.createElement("div");
    gate.id = "paxGate";
    gate.className = "pax-gate";
    gate.hidden = true;
    gate.innerHTML = `<main class="pax-card" role="dialog" aria-modal="true"><div class="pax-logo">P</div><div class="pax-icon"></div><div class="pax-kicker"></div><h1 class="pax-title"></h1><p class="pax-text"></p><div class="pax-actions"></div><p class="pax-note"></p></main>`;
    document.body.appendChild(gate);
    return gate;
  }

  function hideState() {
    const gate = document.getElementById("paxGate");
    if (gate) gate.hidden = true;
    document.documentElement.classList.remove("pax-locked");
    authGate(true);
  }

  function showState({icon="•", kicker="POCKET", title, text, note="", actions=[]}) {
    const gate = getStateGate();
    authGate(false);
    gate.hidden = false;
    document.documentElement.classList.add("pax-locked");
    gate.querySelector(".pax-icon").textContent = icon;
    gate.querySelector(".pax-kicker").textContent = kicker;
    gate.querySelector(".pax-title").textContent = title;
    gate.querySelector(".pax-text").textContent = text;
    gate.querySelector(".pax-note").textContent = note;
    const wrap = gate.querySelector(".pax-actions");
    wrap.replaceChildren();
    actions.forEach(({label, primary=false, danger=false, href, onClick}) => {
      const el = href ? document.createElement("a") : document.createElement("button");
      if (!href) el.type = "button";
      if (href) el.href = href;
      el.className = `pax-action${primary ? " primary" : ""}${danger ? " danger" : ""}`;
      el.textContent = label;
      if (onClick) el.addEventListener("click", onClick);
      wrap.appendChild(el);
    });
  }

  function clearPending() {
    localStorage.removeItem(PENDING_KEY);
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function changeUser() {
    clearPending();
    currentEntry = null;
    hideState();
    window.PocketAuth?.logout?.({show:true});
  }

  function showPending(name) {
    localStorage.setItem(PENDING_KEY, titleName(name));
    showState({
      icon:"⌛",
      kicker:"SOLICITUD ENVIADA",
      title:"Esperando aprobación",
      text:`${titleName(name)} ya ha solicitado acceso a Pocket. El administrador tiene que aceptar el perfil y elegir qué páginas podrá ver.`,
      note:"No tienes que hacer nada más. Esta pantalla se actualizará automáticamente.",
      actions:[
        {label:"Comprobar ahora", primary:true, onClick:() => checkPending(true)},
        {label:"Usar otro perfil", onClick:changeUser}
      ]
    });
    startPendingPoll();
  }

  function showBlocked(name) {
    localStorage.setItem(PENDING_KEY, titleName(name));
    showState({
      icon:"—",
      kicker:"ACCESO PAUSADO",
      title:"Tu acceso está bloqueado",
      text:`El administrador ha pausado el acceso de ${titleName(name)} a Pocket.`,
      note:"Si vuelve a activarlo, Pocket lo detectará automáticamente.",
      actions:[
        {label:"Comprobar ahora", primary:true, onClick:() => checkPending(true)},
        {label:"Usar otro perfil", onClick:changeUser}
      ]
    });
    startPendingPoll();
  }

  function showDenied() {
    showState({
      icon:"○",
      kicker:"SIN ACCESO",
      title:"Esta página no está disponible",
      text:"Tu perfil está aprobado, pero el administrador no te ha dado acceso a esta página.",
      note:"En Pocket solo verás las páginas que tengas asignadas.",
      actions:[
        {label:"Volver a Pocket", primary:true, href:"./"},
        {label:"Cambiar de usuario", onClick:changeUser}
      ]
    });
  }

  function showPinStep(message) {
    const gate = document.querySelector(".pa-gate");
    if (!gate) return;
    authGate(true);
    const wrap = gate.querySelector(".pa-pin-wrap");
    const pin = gate.querySelector('input[name="pin"]');
    const copy = gate.querySelector(".pa-pin-copy");
    const error = gate.querySelector(".pa-error");
    if (wrap) wrap.hidden = false;
    if (copy) copy.textContent = "El administrador usa este PIN de 4 dígitos para proteger su acceso.";
    if (error) error.textContent = message || "Introduce el PIN de administrador";
    setTimeout(() => pin?.focus(), 50);
  }

  async function completeApprovedLogin(name, pin="") {
    clearPending();
    hideState();
    try {
      await window.PocketAuth.loginWithName(name, pin);
      await syncCurrentAccess({fresh:true});
      protectCurrentPage();
    } catch (error) {
      if (["PIN_CREATE","PIN_ADMIN","PIN_MIGRATE"].includes(error?.code)) {
        showPinStep(error.message);
        return;
      }
      const authError = document.querySelector(".pa-error");
      if (authError) authError.textContent = error?.message || "No se ha podido entrar";
      authGate(true);
    }
  }

  async function handleLoginForm(form) {
    const input = form.querySelector('input[name="fullName"]');
    const pinInput = form.querySelector('input[name="pin"]');
    const button = form.querySelector('button[type="submit"]');
    const errorEl = form.querySelector(".pa-error");
    const name = titleName(input?.value || "");
    const pin = String(pinInput?.value || "").trim();
    if (!name.includes(" ")) {
      if (errorEl) errorEl.textContent = "Escribe tu nombre y al menos un apellido";
      return;
    }

    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Comprobando…";
    if (errorEl) errorEl.textContent = "";
    try {
      const authRegistry = await window.PocketAuth.getRegistry({fresh:true});
      const key = normalizeKey(name);
      const authUser = authRegistry.users.find(user => user.key === key);
      const first = authRegistry.users.length === 0;
      const admin = first || (!!authUser && authUser.id === authRegistry.adminUserId);
      if (admin) {
        await completeApprovedLogin(name, pin);
        return;
      }

      let entry = await entryForName(name, {fresh:true});
      if (!entry) entry = await requestAccess(name);
      currentEntry = entry;
      if (entry.status === "approved") {
        await completeApprovedLogin(name);
      } else if (entry.status === "blocked") {
        showBlocked(name);
      } else {
        showPending(name);
      }
    } catch (error) {
      if (["PIN_CREATE","PIN_ADMIN","PIN_MIGRATE"].includes(error?.code)) showPinStep(error.message);
      else if (errorEl) errorEl.textContent = error?.message || "No se ha podido comprobar el acceso";
    } finally {
      button.disabled = false;
      button.textContent = original || "Entrar";
    }
  }

  function installLoginInterceptor() {
    document.addEventListener("submit", event => {
      const form = event.target?.closest?.(".pa-login-form");
      if (!form) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      handleLoginForm(form);
    }, true);
  }

  async function syncCurrentAccess({fresh=true}={}) {
    const session = window.PocketAuth?.getSession?.();
    if (!session) { currentEntry = null; return null; }
    if (window.PocketAuth.isAdmin()) { currentEntry = {key:"__admin__", name:session.name, status:"approved", allowedPages:["*"]}; return currentEntry; }
    currentEntry = await entryForName(session.name, {fresh});
    return currentEntry;
  }

  function protectCurrentPage() {
    const pageId = currentPageId();
    if (!pageId || isAdmin()) return true;
    if (canAccessPage(pageId)) return true;
    showDenied();
    return false;
  }

  async function enforceSessionAccess() {
    const session = window.PocketAuth?.getSession?.();
    if (!session) return;
    if (window.PocketAuth.isAdmin()) {
      currentEntry = {key:"__admin__", name:session.name, status:"approved", allowedPages:["*"]};
      hideState();
      protectCurrentPage();
      dispatchChange();
      return;
    }

    let entry = await entryForName(session.name, {fresh:true});
    if (!entry) entry = await requestAccess(session.name);
    currentEntry = entry;
    if (entry.status === "approved") {
      hideState();
      protectCurrentPage();
      startApprovedPoll();
      dispatchChange();
      return;
    }

    window.PocketAuth.logout({show:false});
    if (entry.status === "blocked") showBlocked(entry.name);
    else showPending(entry.name);
    dispatchChange();
  }

  async function checkPending(manual=false) {
    const name = localStorage.getItem(PENDING_KEY);
    if (!name) { hideState(); authGate(true); return; }
    try {
      const entry = await entryForName(name, {fresh:true});
      if (!entry) {
        clearPending();
        hideState();
        authGate(true);
        const error = document.querySelector(".pa-error");
        if (error) error.textContent = "La solicitud ya no está disponible. Puedes solicitar acceso de nuevo.";
        return;
      }
      currentEntry = entry;
      if (entry.status === "approved") {
        await completeApprovedLogin(name);
        dispatchChange();
      } else if (entry.status === "blocked") {
        showBlocked(name);
      } else if (manual) {
        const note = document.querySelector("#paxGate .pax-note");
        if (note) note.textContent = "Todavía está pendiente. Pocket seguirá comprobándolo automáticamente.";
      }
    } catch {
      if (manual) {
        const note = document.querySelector("#paxGate .pax-note");
        if (note) note.textContent = "No se ha podido comprobar ahora. Lo intentaremos de nuevo automáticamente.";
      }
    }
  }

  function startPendingPoll() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => checkPending(false), 15000);
  }

  function startApprovedPoll() {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      const session = window.PocketAuth?.getSession?.();
      if (!session || window.PocketAuth.isAdmin()) return;
      try {
        const before = JSON.stringify(currentEntry || {});
        const entry = await entryForName(session.name, {fresh:true});
        if (!entry || entry.status !== "approved") {
          currentEntry = entry;
          window.PocketAuth.logout({show:false});
          if (!entry) {
            clearPending();
            hideState();
            authGate(true);
          } else if (entry.status === "blocked") showBlocked(session.name);
          else showPending(session.name);
          dispatchChange();
          return;
        }
        currentEntry = entry;
        if (before !== JSON.stringify(entry)) {
          protectCurrentPage();
          dispatchChange();
        }
      } catch {}
    }, 60000);
  }

  function dispatchChange() {
    window.dispatchEvent(new CustomEvent("pocket:accesschange", {detail:{entry:clone(currentEntry), admin:isAdmin()}}));
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    installLoginInterceptor();
    await waitForAuth();

    const pendingName = localStorage.getItem(PENDING_KEY);
    const session = window.PocketAuth.getSession();
    if (session) await enforceSessionAccess();
    else if (pendingName) showPending(pendingName);

    window.addEventListener("pocket:authchange", () => setTimeout(() => {
      const nextSession = window.PocketAuth?.getSession?.();
      if (nextSession) enforceSessionAccess().catch(() => {});
    }, 0));
  }

  window.PocketAccess = {
    getRegistry,
    mutateRegistry,
    requestAccess,
    entryForName,
    canAccessPage,
    currentPageId,
    getCurrentEntry: () => clone(currentEntry),
    getAllowedPages: () => isAdmin() ? ["*"] : [...(currentEntry?.allowedPages || [])],
    isApproved: () => isAdmin() || currentEntry?.status === "approved",
    refresh: async () => { await enforceSessionAccess(); return clone(currentEntry); },
    normalizeKey
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();