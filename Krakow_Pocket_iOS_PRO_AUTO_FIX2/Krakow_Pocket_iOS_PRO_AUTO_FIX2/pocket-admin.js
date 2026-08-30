(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const pages = Array.isArray(window.POCKET_PAGES) ? [...window.POCKET_PAGES] : [];
  let loading = false;
  let accessTarget = null;
  let deleteTarget = null;

  const esc = value => String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const initials = name => String(name || "").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "P";
  const when = iso => {
    if (!iso) return "Nunca";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("es-ES", {day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"}).format(d);
  };

  function setState(mode, message = "") {
    $("adminLoading").hidden = mode !== "loading";
    $("adminDenied").hidden = mode !== "denied";
    $("adminContent").hidden = mode !== "ready";
    if (message) $("adminDeniedText").textContent = message;
  }

  function permissionLabel(user) {
    const count = Array.isArray(user.allowedPages) ? user.allowedPages.length : 0;
    if (user.role === "admin") return "Todas las páginas";
    return `${count} ${count === 1 ? "página" : "páginas"}`;
  }

  function pendingCard(user) {
    return `<article class="au-card pending" data-user="${esc(user.id)}" data-name="${esc(user.name)}">
      <div class="au-user-main">
        <div class="au-avatar">${esc(initials(user.name))}</div>
        <div class="au-user-copy">
          <div class="au-user-top"><strong>${esc(user.name)}</strong><span class="au-badge pending">Pendiente</span></div>
          <span>Solicitud · ${esc(when(user.requestedAt || user.createdAt))}</span>
        </div>
      </div>
      <div class="au-actions">
        <button type="button" class="primary" data-action="review">Revisar y dar acceso</button>
        <button type="button" class="danger" data-action="delete">Rechazar solicitud</button>
      </div>
    </article>`;
  }

  function userCard(user, registry, session) {
    const self = user.id === session.userId;
    const admin = user.id === registry.adminUserId;
    const blocked = user.status === "blocked" || user.active === false;
    const statusBadge = admin ? '<span class="au-badge">Admin permanente</span>' : blocked ? '<span class="au-badge blocked">Bloqueado</span>' : '<span class="au-badge">Con acceso</span>';
    return `<article class="au-card ${blocked ? "blocked" : ""}" data-user="${esc(user.id)}" data-name="${esc(user.name)}">
      <div class="au-user-main">
        <div class="au-avatar">${esc(initials(user.name))}</div>
        <div class="au-user-copy">
          <div class="au-user-top"><strong>${esc(user.name)}</strong>${statusBadge}${self ? '<span class="au-badge soft">Tú</span>' : ''}</div>
          <span>${admin ? "Acceso completo · administrador para siempre" : `${esc(permissionLabel(user))} · ${blocked ? "sin acceso ahora" : `última actividad ${esc(when(user.lastSeenAt))}`}`}</span>
        </div>
      </div>
      ${admin ? "" : `<div class="au-actions">
        <button type="button" class="permissions" data-action="permissions">Gestionar páginas · ${esc(permissionLabel(user))}</button>
        <button type="button" data-action="toggle">${blocked ? "Desbloquear" : "Bloquear"}</button>
        <button type="button" data-action="sessions">Cerrar sesiones</button>
        <button type="button" class="danger" data-action="delete">Eliminar perfil</button>
      </div>`}
    </article>`;
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
      const users = [...registry.users];
      const pending = users.filter(user => user.id !== registry.adminUserId && user.status === "pending").sort((a,b) => new Date(a.requestedAt || a.createdAt || 0) - new Date(b.requestedAt || b.createdAt || 0));
      const managed = users.filter(user => user.status !== "pending" || user.id === registry.adminUserId).sort((a,b) => {
        if (a.id === registry.adminUserId) return -1;
        if (b.id === registry.adminUserId) return 1;
        return new Date(b.lastSeenAt || b.approvedAt || b.createdAt || 0) - new Date(a.lastSeenAt || a.approvedAt || a.createdAt || 0);
      });
      const approved = users.filter(user => user.status === "approved").length;

      $("metricUsers").textContent = users.length;
      $("metricPending").textContent = pending.length;
      $("metricApproved").textContent = approved;
      $("pendingList").innerHTML = pending.length ? pending.map(pendingCard).join("") : '<div class="pending-empty">No hay solicitudes pendientes.</div>';
      $("userList").innerHTML = managed.length ? managed.map(user => userCard(user, registry, session)).join("") : '<div class="au-empty">Todavía no hay usuarios con acceso.</div>';

      document.querySelectorAll("button[data-action]").forEach(button => button.addEventListener("click", handleAction));
      setState("ready");
    } catch (error) {
      setState("denied", error?.message || "No se ha podido cargar el backend de Pocket.");
    } finally {
      loading = false;
    }
  }

  function openAccessDialog(user, mode) {
    accessTarget = {id:user.id, name:user.name, mode, allowedPages:[...(user.allowedPages || [])]};
    $("accessKicker").textContent = mode === "approve" ? "NUEVA SOLICITUD" : "PERMISOS";
    $("accessTitle").textContent = mode === "approve" ? `Dar acceso a ${user.name}` : `Páginas de ${user.name}`;
    $("accessSubtitle").textContent = mode === "approve" ? "Elige qué podrá ver. Podrás cambiarlo después." : "Marca únicamente las páginas que quieres que pueda abrir.";
    $("saveAccess").textContent = mode === "approve" ? "Aprobar acceso" : "Guardar permisos";
    $("permissionError").textContent = "";
    $("permissionList").innerHTML = pages.map(page => {
      const checked = accessTarget.allowedPages.includes(page.id);
      return `<label class="permission-option">
        <span class="permission-icon">${esc(page.icon || "•")}</span>
        <span class="permission-copy"><strong>${esc(page.title)}</strong><span>${esc(page.category || "Página")}</span></span>
        <input type="checkbox" value="${esc(page.id)}" ${checked ? "checked" : ""} aria-label="Permitir ${esc(page.title)}">
      </label>`;
    }).join("") || '<div class="au-empty">No hay páginas disponibles todavía.</div>';
    const dialog = $("accessDialog");
    dialog.hidden = false;
    requestAnimationFrame(() => dialog.classList.add("show"));
  }

  function closeAccessDialog() {
    accessTarget = null;
    const dialog = $("accessDialog");
    if (!dialog || dialog.hidden) return;
    dialog.classList.remove("show");
    setTimeout(() => { dialog.hidden = true; }, 170);
  }

  async function saveAccess() {
    if (!accessTarget) return;
    const selected = [...$("permissionList").querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
    if (!selected.length) {
      $("permissionError").textContent = "Selecciona al menos una página.";
      return;
    }
    const target = {...accessTarget};
    const button = $("saveAccess");
    button.disabled = true;
    button.textContent = target.mode === "approve" ? "Aprobando…" : "Guardando…";
    try {
      await window.PocketAuth.mutateRegistry(registry => {
        const user = registry.users.find(item => item.id === target.id);
        if (!user) throw new Error("El perfil ya no existe");
        if (user.id === registry.adminUserId) throw new Error("El administrador ya tiene acceso completo");
        user.allowedPages = [...new Set(selected)];
        if (target.mode === "approve") {
          user.status = "approved";
          user.active = true;
          user.approvedAt = new Date().toISOString();
        }
      });
      closeAccessDialog();
      await render();
    } catch (error) {
      $("permissionError").textContent = error?.message || "No se han podido guardar los permisos.";
    } finally {
      button.disabled = false;
      button.textContent = target.mode === "approve" ? "Aprobar acceso" : "Guardar permisos";
    }
  }

  function openDeleteDialog(user, pending = false) {
    if (!user) return;
    deleteTarget = {id:user.id, name:user.name, pending};
    $("deleteTitle").textContent = pending ? "¿Rechazar solicitud?" : "¿Eliminar perfil?";
    $("deleteDescription").textContent = pending ? "La solicitud desaparecerá. Si esta persona vuelve a intentarlo, se creará una nueva solicitud." : "Este perfil desaparecerá de Pocket y sus sesiones dejarán de ser válidas.";
    $("deleteUserName").textContent = user.name;
    $("confirmDelete").textContent = pending ? "Rechazar solicitud" : "Eliminar perfil";
    $("deleteNote").textContent = pending ? "No se enviará ninguna notificación automática." : "Si solo quieres impedirle entrar sin perder el perfil, usa Bloquear.";
    const dialog = $("deleteDialog");
    dialog.hidden = false;
    requestAnimationFrame(() => dialog.classList.add("show"));
  }

  function closeDeleteDialog() {
    deleteTarget = null;
    const dialog = $("deleteDialog");
    if (!dialog || dialog.hidden) return;
    dialog.classList.remove("show");
    setTimeout(() => { dialog.hidden = true; }, 170);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = {...deleteTarget};
    const button = $("confirmDelete");
    button.disabled = true;
    button.textContent = target.pending ? "Rechazando…" : "Eliminando…";
    try {
      await window.PocketAuth.mutateRegistry(registry => {
        if (target.id === registry.adminUserId) throw new Error("El administrador permanente no se puede eliminar");
        if (!registry.users.some(user => user.id === target.id)) throw new Error("El perfil ya no existe");
        registry.users = registry.users.filter(user => user.id !== target.id);
      });
      closeDeleteDialog();
      await render();
    } catch (error) {
      alert(error?.message || "No se ha podido eliminar el perfil");
    } finally {
      button.disabled = false;
      button.textContent = target.pending ? "Rechazar solicitud" : "Eliminar perfil";
    }
  }

  async function handleAction(event) {
    const button = event.currentTarget;
    const card = button.closest("[data-user]");
    const userId = card?.dataset.user;
    const name = card?.dataset.name || "este perfil";
    const action = button.dataset.action;
    if (!userId || !action) return;

    const registry = await window.PocketAuth.getRegistry({fresh:true});
    const user = registry.users.find(item => item.id === userId);
    if (!user) return render();

    if (action === "review") return openAccessDialog(user, "approve");
    if (action === "permissions") return openAccessDialog(user, "edit");
    if (action === "delete") return openDeleteDialog({id:userId, name}, user.status === "pending");

    button.disabled = true;
    try {
      await window.PocketAuth.mutateRegistry(next => {
        const target = next.users.find(item => item.id === userId);
        if (!target) throw new Error("El perfil ya no existe");
        if (target.id === next.adminUserId) throw new Error("El administrador permanente no se puede modificar desde aquí");
        if (action === "toggle") {
          const blocking = target.status !== "blocked";
          target.status = blocking ? "blocked" : "approved";
          target.active = !blocking;
          target.sessionVersion = (target.sessionVersion || 1) + 1;
        }
        if (action === "sessions") target.sessionVersion = (target.sessionVersion || 1) + 1;
      });
      await render();
    } catch (error) {
      alert(error?.message || "No se ha podido guardar el cambio");
      button.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    $("closeAccess")?.addEventListener("click", closeAccessDialog);
    $("cancelAccess")?.addEventListener("click", closeAccessDialog);
    $("saveAccess")?.addEventListener("click", saveAccess);
    $("accessDialog")?.addEventListener("click", event => { if (event.target === $("accessDialog")) closeAccessDialog(); });
    $("cancelDelete")?.addEventListener("click", closeDeleteDialog);
    $("confirmDelete")?.addEventListener("click", confirmDelete);
    $("deleteDialog")?.addEventListener("click", event => { if (event.target === $("deleteDialog")) closeDeleteDialog(); });
    $("refreshAdmin")?.addEventListener("click", render);
    await window.PocketAuth.ready;
    render();
  });

  window.addEventListener("pocket:authchange", () => setTimeout(render, 0));
})();