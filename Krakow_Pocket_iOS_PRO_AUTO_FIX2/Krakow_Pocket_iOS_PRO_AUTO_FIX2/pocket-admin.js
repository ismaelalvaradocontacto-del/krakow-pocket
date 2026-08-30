(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const pages = Array.isArray(window.POCKET_PAGES) ? [...window.POCKET_PAGES] : [];
  let loading = false;
  let permissionTarget = null;
  let deleteTarget = null;

  const esc = value => String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const initials = name => String(name || "").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "P";
  const when = iso => {
    if (!iso) return "Sin actividad";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("es-ES", {day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"}).format(d);
  };

  function setState(mode, message="") {
    $("adminLoading").hidden = mode !== "loading";
    $("adminDenied").hidden = mode !== "denied";
    $("adminContent").hidden = mode !== "ready";
    if (message) $("adminDeniedText").textContent = message;
  }

  async function fetchData() {
    const [authRegistry, accessRegistry] = await Promise.all([
      window.PocketAuth.getRegistry({fresh:true}),
      window.PocketAccess.getRegistry({fresh:true})
    ]);
    return {authRegistry, accessRegistry};
  }

  function renderPending(entries) {
    $("pendingCount").textContent = entries.length;
    $("pendingSection").hidden = entries.length === 0;
    $("pendingList").innerHTML = entries.map(entry => `
      <article class="request-card" data-key="${esc(entry.key)}">
        <div class="person"><div class="avatar">${esc(initials(entry.name))}</div><div class="person-copy"><div class="person-top"><strong>${esc(entry.name)}</strong><span class="badge wait">Pendiente</span></div><span>Solicitud · ${esc(when(entry.requestedAt))}</span></div></div>
        <div class="request-actions"><button class="review" type="button" data-action="approve">Revisar acceso</button><button class="delete" type="button" data-action="delete">Eliminar</button></div>
      </article>`).join("") || '<div class="empty">No hay solicitudes pendientes.</div>';
  }

  function renderUsers(authRegistry, accessRegistry) {
    const session = window.PocketAuth.getSession();
    const admin = authRegistry.users.find(user => user.id === authRegistry.adminUserId);
    const accessEntries = accessRegistry.entries.filter(entry => entry.status !== "pending").sort((a,b) => new Date(b.updatedAt||0) - new Date(a.updatedAt||0));
    const cards = [];

    if (admin) {
      cards.push(`<article class="user-card" data-admin="1"><div class="person"><div class="avatar">${esc(initials(admin.name))}</div><div class="person-copy"><div class="person-top"><strong>${esc(admin.name)}</strong><span class="badge">Admin permanente</span>${session?.userId===admin.id?'<span class="badge soft">Tú</span>':''}</div><span>Acceso a todas las páginas · protegido con PIN</span></div></div></article>`);
    }

    accessEntries.forEach(entry => {
      const blocked = entry.status === "blocked";
      const allowed = entry.allowedPages || [];
      const accessText = allowed.length ? `${allowed.length} ${allowed.length===1?"página":"páginas"}` : "Sin páginas asignadas";
      cards.push(`<article class="user-card ${blocked?"blocked":""}" data-key="${esc(entry.key)}">
        <div class="person"><div class="avatar">${esc(initials(entry.name))}</div><div class="person-copy"><div class="person-top"><strong>${esc(entry.name)}</strong>${blocked?'<span class="badge wait">Bloqueado</span>':'<span class="badge soft">Aprobado</span>'}</div><span>${blocked?"Acceso pausado":esc(accessText)}</span></div></div>
        <div class="actions">
          <button class="permissions" type="button" data-action="permissions">Permisos</button>
          <button type="button" data-action="toggle">${blocked?"Activar":"Bloquear"}</button>
          <button type="button" data-action="sessions">Cerrar sesiones</button>
          <button class="delete" type="button" data-action="delete">Eliminar</button>
        </div>
      </article>`);
    });

    $("userList").innerHTML = cards.join("") || '<div class="empty">Todavía no hay perfiles.</div>';
  }

  async function render() {
    if (loading) return;
    loading = true;
    try {
      const session = window.PocketAuth?.getSession?.();
      if (!session) { setState("denied", "Inicia sesión con el administrador para abrir este panel."); return; }
      if (!window.PocketAuth.isAdmin()) { setState("denied", "Este perfil no tiene acceso al panel de administración."); return; }
      setState("loading");
      const {authRegistry, accessRegistry} = await fetchData();
      const pending = accessRegistry.entries.filter(entry => entry.status === "pending").sort((a,b) => new Date(a.requestedAt||0)-new Date(b.requestedAt||0));
      const approved = accessRegistry.entries.filter(entry => entry.status === "approved");
      const total = 1 + accessRegistry.entries.length;
      $("metricUsers").textContent = total;
      $("metricPending").textContent = pending.length;
      $("metricApproved").textContent = 1 + approved.length;
      renderPending(pending);
      renderUsers(authRegistry, accessRegistry);
      setState("ready");
    } catch (error) {
      setState("denied", error?.message || "No se ha podido cargar la administración de Pocket.");
    } finally { loading = false; }
  }

  function renderPermissionList(selected=[]) {
    const set = new Set(selected);
    $("permissionList").innerHTML = pages.map(page => `
      <label class="permission-item">
        <div class="permission-icon">${esc(page.icon || "•")}</div>
        <div class="permission-copy"><strong>${esc(page.title)}</strong><span>${esc(page.category || "Página")}</span></div>
        <input type="checkbox" value="${esc(page.id)}" ${set.has(page.id)?"checked":""}>
      </label>`).join("");
  }

  async function openPermissions(key, mode) {
    const registry = await window.PocketAccess.getRegistry({fresh:true});
    const entry = registry.entries.find(item => item.key === key);
    if (!entry) return;
    permissionTarget = {key, mode};
    $("permissionKicker").textContent = mode === "approve" ? "APROBAR SOLICITUD" : "PERMISOS";
    $("permissionTitle").textContent = entry.name;
    $("permissionSub").textContent = mode === "approve" ? "Elige las páginas antes de darle acceso." : "Puedes cambiar estas páginas en cualquier momento.";
    $("savePermission").textContent = mode === "approve" ? "Aprobar acceso" : "Guardar permisos";
    $("permissionError").textContent = "";
    renderPermissionList(entry.allowedPages || []);
    $("permissionDialog").showModal();
  }

  async function savePermissions() {
    if (!permissionTarget) return;
    const selected = [...$("permissionList").querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
    if (!selected.length) {
      $("permissionError").textContent = "Selecciona al menos una página.";
      return;
    }
    $("savePermission").disabled = true;
    try {
      await window.PocketAccess.mutateRegistry(registry => {
        const entry = registry.entries.find(item => item.key === permissionTarget.key);
        if (!entry) throw new Error("La solicitud ya no existe");
        entry.allowedPages = selected;
        entry.status = "approved";
        entry.approvedAt = entry.approvedAt || new Date().toISOString();
        entry.updatedAt = new Date().toISOString();
      });
      $("permissionDialog").close();
      permissionTarget = null;
      await render();
    } catch (error) {
      $("permissionError").textContent = error?.message || "No se han podido guardar los permisos";
    } finally { $("savePermission").disabled = false; }
  }

  function openDelete(key) {
    window.PocketAccess.getRegistry({fresh:false}).then(registry => {
      const entry = registry.entries.find(item => item.key === key);
      if (!entry) return;
      deleteTarget = {key, name:entry.name};
      $("deleteCopy").textContent = `Se eliminará el perfil de ${entry.name}, su solicitud, sus permisos y cualquier sesión asociada. Si vuelve a usar ese nombre tendrá que solicitar acceso de nuevo.`;
      $("deleteDialog").showModal();
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    $("confirmDelete").disabled = true;
    try {
      const key = deleteTarget.key;
      await window.PocketAccess.mutateRegistry(registry => {
        registry.entries = registry.entries.filter(entry => entry.key !== key);
      });
      await window.PocketAuth.mutateRegistry(registry => {
        const admin = registry.adminUserId;
        registry.users = registry.users.filter(user => user.id === admin || user.key !== key);
      });
      $("deleteDialog").close();
      deleteTarget = null;
      await render();
    } catch (error) {
      alert(error?.message || "No se ha podido eliminar el perfil");
    } finally { $("confirmDelete").disabled = false; }
  }

  async function handleAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest("[data-key]");
    const key = card?.dataset.key;
    const action = button.dataset.action;
    if (!key) return;

    if (action === "approve") return openPermissions(key, "approve");
    if (action === "permissions") return openPermissions(key, "edit");
    if (action === "delete") return openDelete(key);

    button.disabled = true;
    try {
      if (action === "toggle") {
        let nextStatus = "approved";
        await window.PocketAccess.mutateRegistry(registry => {
          const entry = registry.entries.find(item => item.key === key);
          if (!entry) throw new Error("El perfil ya no existe");
          nextStatus = entry.status === "blocked" ? "approved" : "blocked";
          entry.status = nextStatus;
          entry.updatedAt = new Date().toISOString();
        });
        await window.PocketAuth.mutateRegistry(registry => {
          const user = registry.users.find(item => item.key === key);
          if (user) {
            user.active = nextStatus !== "blocked";
            if (nextStatus === "blocked") user.sessionVersion = (user.sessionVersion || 1) + 1;
          }
        });
      }
      if (action === "sessions") {
        await window.PocketAuth.mutateRegistry(registry => {
          const user = registry.users.find(item => item.key === key);
          if (user) user.sessionVersion = (user.sessionVersion || 1) + 1;
        });
      }
      await render();
    } catch (error) {
      alert(error?.message || "No se ha podido guardar el cambio");
      button.disabled = false;
    }
  }

  function selectAll() {
    const inputs = [...$("permissionList").querySelectorAll('input[type="checkbox"]')];
    const allChecked = inputs.length && inputs.every(input => input.checked);
    inputs.forEach(input => { input.checked = !allChecked; });
    $("selectAllPages").textContent = allChecked ? "Seleccionar todas" : "Quitar todas";
    $("permissionError").textContent = "";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await window.PocketAuth.ready;
    await new Promise(resolve => {
      if (window.PocketAccess) return resolve();
      const timer = setInterval(() => { if (window.PocketAccess) { clearInterval(timer); resolve(); } }, 30);
    });
    render();
  });

  $("pendingList")?.addEventListener("click", handleAction);
  $("userList")?.addEventListener("click", handleAction);
  $("refreshAdmin")?.addEventListener("click", render);
  $("closePermission")?.addEventListener("click", () => $("permissionDialog").close());
  $("cancelPermission")?.addEventListener("click", () => $("permissionDialog").close());
  $("savePermission")?.addEventListener("click", savePermissions);
  $("selectAllPages")?.addEventListener("click", selectAll);
  $("closeDelete")?.addEventListener("click", () => $("deleteDialog").close());
  $("cancelDelete")?.addEventListener("click", () => $("deleteDialog").close());
  $("confirmDelete")?.addEventListener("click", confirmDelete);
  window.addEventListener("pocket:authchange", () => setTimeout(render, 0));
})();