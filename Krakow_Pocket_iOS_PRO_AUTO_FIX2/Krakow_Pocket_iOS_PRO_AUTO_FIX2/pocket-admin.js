(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let loading = false;

  const esc = value => String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const when = iso => {
    if (!iso) return "Nunca";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("es-ES", {day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"}).format(d);
  };
  const initials = name => String(name || "").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "P";

  function setState(mode, message = "") {
    $("adminLoading").hidden = mode !== "loading";
    $("adminDenied").hidden = mode !== "denied";
    $("adminContent").hidden = mode !== "ready";
    if (message) $("adminDeniedText").textContent = message;
  }

  async function render() {
    if (loading) return;
    loading = true;
    try {
      const session = window.PocketAuth?.getSession?.();
      if (!session) { setState("denied", "Inicia sesión con el perfil administrador para abrir este panel."); return; }
      if (!window.PocketAuth.isAdmin()) { setState("denied", "Este perfil no tiene acceso al panel de administración."); return; }
      setState("loading");
      const registry = await window.PocketAuth.getRegistry({fresh:true});
      const users = [...registry.users].sort((a,b) => new Date(b.lastSeenAt || b.createdAt || 0) - new Date(a.lastSeenAt || a.createdAt || 0));
      const active = users.filter(u => u.active !== false).length;
      $("metricUsers").textContent = users.length;
      $("metricActive").textContent = active;
      $("metricLast").textContent = users[0]?.lastSeenAt ? when(users[0].lastSeenAt) : "—";
      $("userList").innerHTML = users.map(user => {
        const self = user.id === session.userId;
        const admin = user.id === registry.adminUserId && user.role === "admin";
        return `<article class="au-card ${user.active === false ? "disabled" : ""}" data-user="${esc(user.id)}">
          <div class="au-user-main">
            <div class="au-avatar">${esc(initials(user.name))}</div>
            <div class="au-user-copy"><div class="au-user-top"><strong>${esc(user.name)}</strong>${admin ? '<span class="au-badge">Admin</span>' : ''}${self ? '<span class="au-badge soft">Tú</span>' : ''}</div><span>${user.active === false ? "Acceso bloqueado" : `Última actividad · ${esc(when(user.lastSeenAt))}`}</span></div>
          </div>
          <div class="au-actions">
            <button type="button" data-action="toggle" ${self ? "disabled" : ""}>${user.active === false ? "Activar" : "Bloquear"}</button>
            <button type="button" data-action="sessions" ${self ? "disabled" : ""}>Cerrar sesiones</button>
          </div>
        </article>`;
      }).join("") || '<div class="au-empty">Todavía no hay perfiles.</div>';
      $("userList").querySelectorAll("button[data-action]").forEach(button => button.addEventListener("click", handleAction));
      setState("ready");
    } catch (error) {
      setState("denied", error?.message || "No se ha podido cargar el backend de Pocket.");
    } finally { loading = false; }
  }

  async function handleAction(event) {
    const button = event.currentTarget;
    const card = button.closest("[data-user]");
    const userId = card?.dataset.user;
    const action = button.dataset.action;
    if (!userId || !action) return;
    button.disabled = true;
    try {
      await window.PocketAuth.mutateRegistry(registry => {
        const user = registry.users.find(item => item.id === userId);
        if (!user) throw new Error("El perfil ya no existe");
        if (action === "toggle") {
          user.active = user.active === false;
          user.sessionVersion = (user.sessionVersion || 1) + 1;
        }
        if (action === "sessions") user.sessionVersion = (user.sessionVersion || 1) + 1;
      });
      await render();
    } catch (error) {
      alert(error?.message || "No se ha podido guardar el cambio");
      button.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await window.PocketAuth.ready;
    render();
  });
  window.addEventListener("pocket:authchange", () => setTimeout(render, 0));
  $("refreshAdmin")?.addEventListener("click", render);
})();