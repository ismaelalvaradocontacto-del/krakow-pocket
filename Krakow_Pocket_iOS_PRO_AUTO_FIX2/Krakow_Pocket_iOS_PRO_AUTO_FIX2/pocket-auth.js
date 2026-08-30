(() => {
  "use strict";

  const CLOUD = {
    url: "https://ahzmwkztlakejmrvgcdm.supabase.co",
    key: "sb_publishable_sf-RddHTp5jdFCQOfRBBsQ_PZGKOlxJ",
    code: "POCKET-USERS-2026",
    secret: "pocket-profiles-2026-5f78b4e1c2"
  };
  const SESSION_KEY = "pocketSessionV1";
  const ADMIN_KEY = "pocketAdminDeviceKeyV1";
  const RECENTS_KEY = "pocketRecentNamesV1";
  const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
  const LAST_TOUCH_KEY = "pocketLastRemoteTouchV1";
  const TOUCH_EVERY_MS = 6 * 60 * 60 * 1000;

  let registryCache = null;
  let session = null;
  let adminCapable = false;
  let gateEl = null;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });

  const nowIso = () => new Date().toISOString();
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
  const parse = (value, fallback = null) => { try { return JSON.parse(value); } catch { return fallback; } };
  const clone = value => JSON.parse(JSON.stringify(value));
  const normalizeKey = value => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const titleName = value => String(value || "").trim().replace(/\s+/g, " ").split(" ").map(part => part.split(/([-'])/).map(piece => /^[-']$/.test(piece) ? piece : piece ? piece[0].toLocaleUpperCase("es") + piece.slice(1).toLocaleLowerCase("es") : piece).join("")).join(" ");
  const initials = name => titleName(name).split(" ").filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase() || "P";
  const esc = value => String(value || "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function rpc(name, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${CLOUD.url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {"Content-Type": "application/json", "apikey": CLOUD.key},
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
    } finally {
      clearTimeout(timer);
    }
  }

  const emptyRegistry = () => ({
    schema: 1,
    users: [],
    adminUserId: null,
    adminDeviceHash: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });

  function normalizeRegistry(raw) {
    const value = raw && typeof raw === "object" ? raw : emptyRegistry();
    if (!Array.isArray(value.users)) value.users = [];
    value.schema = 1;
    value.users = value.users.map(user => ({
      id: user.id || uid("usr"),
      key: user.key || normalizeKey(user.name),
      name: titleName(user.name),
      role: user.role === "admin" ? "admin" : "user",
      active: user.active !== false,
      sessionVersion: Number.isFinite(+user.sessionVersion) ? +user.sessionVersion : 1,
      createdAt: user.createdAt || nowIso(),
      lastSeenAt: user.lastSeenAt || null
    })).filter(user => user.key && user.name);
    return value;
  }

  async function getRegistry({fresh = false} = {}) {
    if (registryCache && !fresh) return clone(registryCache);
    try {
      const raw = await rpc("adventure_get", {p_code: CLOUD.code, p_secret: CLOUD.secret});
      registryCache = normalizeRegistry(raw);
      return clone(registryCache);
    } catch (firstError) {
      const freshRegistry = emptyRegistry();
      try {
        await rpc("adventure_create", {p_code: CLOUD.code, p_secret: CLOUD.secret, p_state: freshRegistry});
        registryCache = freshRegistry;
        return clone(registryCache);
      } catch (createError) {
        try {
          const raw = await rpc("adventure_get", {p_code: CLOUD.code, p_secret: CLOUD.secret});
          registryCache = normalizeRegistry(raw);
          return clone(registryCache);
        } catch {
          throw firstError;
        }
      }
    }
  }

  async function putRegistry(registry) {
    const normalized = normalizeRegistry(registry);
    normalized.updatedAt = nowIso();
    await rpc("adventure_put", {p_code: CLOUD.code, p_secret: CLOUD.secret, p_state: normalized});
    registryCache = normalized;
    return clone(normalized);
  }

  async function mutateRegistry(mutator) {
    const current = await getRegistry({fresh: true});
    const next = clone(current);
    const result = await mutator(next);
    await putRegistry(next);
    return {registry: clone(next), result};
  }

  function readSession() {
    const value = parse(localStorage.getItem(SESSION_KEY), null);
    if (!value || !value.userId || !value.expiresAt || Date.now() >= +value.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return value;
  }

  function writeSession(user) {
    session = {
      userId: user.id,
      name: user.name,
      role: user.role,
      sessionVersion: user.sessionVersion,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_MS
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    rememberName(user.name);
    return session;
  }

  function rememberName(name) {
    const recents = parse(localStorage.getItem(RECENTS_KEY), []) || [];
    const key = normalizeKey(name);
    const next = [titleName(name), ...recents.filter(item => normalizeKey(item) !== key)].slice(0, 4);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  }

  function recentNames() {
    return (parse(localStorage.getItem(RECENTS_KEY), []) || []).filter(Boolean).slice(0, 4);
  }

  async function hasAdminCapability(registry, user) {
    if (!user || user.role !== "admin" || registry.adminUserId !== user.id || !registry.adminDeviceHash) return false;
    const key = localStorage.getItem(ADMIN_KEY);
    if (!key) return false;
    try { return await sha256(key) === registry.adminDeviceHash; } catch { return false; }
  }

  async function validateSessionRemote() {
    if (!session) return false;
    try {
      const registry = await getRegistry({fresh: true});
      const user = registry.users.find(item => item.id === session.userId);
      if (!user || !user.active || user.sessionVersion !== session.sessionVersion) {
        localStorage.removeItem(SESSION_KEY);
        session = null;
        adminCapable = false;
        return false;
      }
      session.name = user.name;
      session.role = user.role;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      adminCapable = await hasAdminCapability(registry, user);
      const lastTouch = +(localStorage.getItem(LAST_TOUCH_KEY) || 0);
      if (Date.now() - lastTouch > TOUCH_EVERY_MS) {
        localStorage.setItem(LAST_TOUCH_KEY, String(Date.now()));
        mutateRegistry(next => {
          const found = next.users.find(item => item.id === user.id);
          if (found) found.lastSeenAt = nowIso();
        }).catch(() => {});
      }
      return true;
    } catch {
      return true;
    }
  }

  async function loginWithName(rawName) {
    const name = titleName(rawName);
    const key = normalizeKey(name);
    if (name.length < 3 || !name.includes(" ")) throw new Error("Escribe tu nombre y al menos un apellido");

    let createdAdminKey = null;
    const outcome = await mutateRegistry(async registry => {
      let user = registry.users.find(item => item.key === key);
      if (user && !user.active) throw new Error("Este perfil está desactivado");

      if (!user) {
        const first = registry.users.length === 0;
        user = {
          id: uid("usr"), key, name, role: first ? "admin" : "user", active: true,
          sessionVersion: 1, createdAt: nowIso(), lastSeenAt: nowIso()
        };
        registry.users.push(user);
        if (first) {
          createdAdminKey = `${crypto.randomUUID ? crypto.randomUUID() : uid("key")}-${uid("admin")}`;
          registry.adminUserId = user.id;
          registry.adminDeviceHash = await sha256(createdAdminKey);
        }
      } else {
        user.name = name;
        user.lastSeenAt = nowIso();
      }
      return clone(user);
    });

    if (createdAdminKey) localStorage.setItem(ADMIN_KEY, createdAdminKey);
    const user = outcome.result;
    writeSession(user);
    adminCapable = await hasAdminCapability(outcome.registry, user);
    hideGate();
    mountAccount();
    window.dispatchEvent(new CustomEvent("pocket:authchange", {detail: {session: clone(session), admin: adminCapable}}));
    return clone(session);
  }

  function logout({show = true} = {}) {
    localStorage.removeItem(SESSION_KEY);
    session = null;
    adminCapable = false;
    closeAccountSheet();
    if (show) showGate();
    window.dispatchEvent(new CustomEvent("pocket:authchange", {detail: {session: null, admin: false}}));
  }

  function switchUser() {
    logout({show: true});
    setTimeout(() => gateEl?.querySelector("input")?.focus(), 80);
  }

  function buildGate() {
    if (gateEl) return gateEl;
    gateEl = document.createElement("div");
    gateEl.className = "pa-gate";
    gateEl.innerHTML = `
      <div class="pa-login-card" role="dialog" aria-modal="true" aria-labelledby="paLoginTitle">
        <div class="pa-logo" aria-hidden="true">P</div>
        <div class="pa-kicker">POCKET</div>
        <h1 id="paLoginTitle">¿Quién eres?</h1>
        <p class="pa-lead">Escribe tu nombre y apellidos. Pocket te recordará durante 30 días.</p>
        <form class="pa-login-form" autocomplete="off">
          <label class="pa-field"><span>Nombre y apellidos</span><input name="fullName" type="text" maxlength="90" autocomplete="name" autocapitalize="words" placeholder="Ej. Laura Moreno Pulido" required></label>
          <button class="pa-primary" type="submit">Entrar</button>
          <div class="pa-error" role="status" aria-live="polite"></div>
        </form>
        <div class="pa-recents"></div>
        <p class="pa-trust">Acceso sencillo para un espacio de confianza · sin contraseña</p>
      </div>`;
    document.body.appendChild(gateEl);
    const form = gateEl.querySelector("form");
    const input = gateEl.querySelector("input");
    const error = gateEl.querySelector(".pa-error");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = form.querySelector("button");
      error.textContent = "";
      button.disabled = true;
      button.textContent = "Entrando…";
      try { await loginWithName(input.value); }
      catch (err) { error.textContent = err?.message || "No se ha podido entrar"; }
      finally { button.disabled = false; button.textContent = "Entrar"; }
    });
    renderRecents();
    return gateEl;
  }

  function renderRecents() {
    if (!gateEl) return;
    const wrap = gateEl.querySelector(".pa-recents");
    const names = recentNames();
    if (!names.length) { wrap.innerHTML = ""; return; }
    wrap.innerHTML = `<div class="pa-recents-label">Usados en este dispositivo</div><div class="pa-recent-list">${names.map(name => `<button type="button" data-name="${esc(name)}"><span>${esc(initials(name))}</span>${esc(name)}</button>`).join("")}</div>`;
    wrap.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
      gateEl.querySelector("input").value = button.dataset.name || "";
      gateEl.querySelector("input").focus();
    }));
  }

  function showGate() {
    buildGate();
    renderRecents();
    gateEl.hidden = false;
    document.documentElement.classList.add("pa-locked");
    setTimeout(() => gateEl.querySelector("input")?.focus(), 60);
  }

  function hideGate() {
    if (gateEl) gateEl.hidden = true;
    document.documentElement.classList.remove("pa-locked");
  }

  function accountSheet() {
    let sheet = document.getElementById("paAccountSheet");
    if (sheet) return sheet;
    sheet = document.createElement("div");
    sheet.id = "paAccountSheet";
    sheet.className = "pa-sheet-backdrop";
    sheet.hidden = true;
    sheet.innerHTML = `<div class="pa-sheet" role="dialog" aria-modal="true" aria-label="Cuenta de Pocket"><button class="pa-sheet-close" type="button" aria-label="Cerrar">×</button><div class="pa-sheet-body"></div></div>`;
    document.body.appendChild(sheet);
    sheet.querySelector(".pa-sheet-close").addEventListener("click", closeAccountSheet);
    sheet.addEventListener("click", event => { if (event.target === sheet) closeAccountSheet(); });
    return sheet;
  }

  function openAccountSheet() {
    if (!session) return showGate();
    const sheet = accountSheet();
    const body = sheet.querySelector(".pa-sheet-body");
    body.innerHTML = `
      <div class="pa-account-hero"><div class="pa-avatar large">${esc(initials(session.name))}</div><div><div class="pa-account-name">${esc(session.name)}</div><div class="pa-account-role">${adminCapable ? "Administrador" : "Perfil de Pocket"}</div></div></div>
      ${adminCapable ? `<a class="pa-admin-link" href="./administrar.html"><span>Administrar Pocket</span><b>›</b></a>` : ""}
      <div class="pa-sheet-actions"><button type="button" data-action="switch">Cambiar de usuario</button><button type="button" data-action="logout" class="danger">Cerrar sesión</button></div>
      <p class="pa-session-note">La sesión caduca automáticamente 30 días después de iniciar sesión.</p>`;
    body.querySelector('[data-action="switch"]')?.addEventListener("click", switchUser);
    body.querySelector('[data-action="logout"]')?.addEventListener("click", () => logout({show: true}));
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add("show"));
  }

  function closeAccountSheet() {
    const sheet = document.getElementById("paAccountSheet");
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove("show");
    setTimeout(() => { sheet.hidden = true; }, 180);
  }

  function mountAccount() {
    if (!session) return;
    const mount = document.getElementById("pocketAccountMount");
    if (!mount) return;
    mount.innerHTML = `<button class="pa-account-button" type="button" aria-label="Cuenta: ${esc(session.name)}"><span class="pa-avatar">${esc(initials(session.name))}</span><span class="pa-account-button-copy"><b>${esc(session.name.split(" ")[0])}</b><small>${adminCapable ? "Admin" : "Cuenta"}</small></span></button>`;
    mount.querySelector("button").addEventListener("click", openAccountSheet);
  }

  async function boot() {
    buildGate();
    session = readSession();
    if (!session) {
      showGate();
      resolveReady({session: null, admin: false});
      return;
    }
    hideGate();
    mountAccount();
    const valid = await validateSessionRemote();
    if (!valid) showGate();
    else { hideGate(); mountAccount(); }
    resolveReady({session: session ? clone(session) : null, admin: adminCapable});
    setInterval(() => {
      if (!session) return;
      validateSessionRemote().then(valid => { if (!valid) showGate(); else { hideGate(); mountAccount(); } }).catch(() => {});
    }, 10 * 60 * 1000);
  }

  window.PocketAuth = {
    ready,
    getSession: () => session ? clone(session) : null,
    isAdmin: () => !!adminCapable,
    loginWithName,
    logout,
    switchUser,
    openAccount: openAccountSheet,
    getRegistry,
    mutateRegistry,
    refresh: async () => { const ok = await validateSessionRemote(); mountAccount(); return ok; },
    sessionDays: 30
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {once: true});
  else boot();
})();