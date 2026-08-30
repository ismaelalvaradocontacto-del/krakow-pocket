(() => {
  const STORAGE_KEY = "pocket.casita.v3";
  const emptyState = {
    mode: "disconnected",
    electricityPrice: null,
    environment: { value: null, unit: "%", state: null },
    zones: [],
    water: {
      availableLiters: null,
      capacityLiters: null,
      todayLiters: null,
      weekLiters: null,
      rateLitersHour: null
    },
    energy: {
      todayKwh: null,
      devices: []
    },
    devices: [],
    cameras: [],
    access: [],
    updatedAt: null
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const hasNumber = value => typeof value === "number" && Number.isFinite(value);
  const el = id => document.getElementById(id);
  const fmt = (value, digits = 1) => hasNumber(value)
    ? Number(value).toLocaleString("es-ES", { maximumFractionDigits: digits, minimumFractionDigits: digits })
    : null;

  function merge(base, incoming) {
    if (!incoming || typeof incoming !== "object") return base;
    for (const [key, value] of Object.entries(incoming)) {
      if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
        merge(base[key], value);
      } else {
        base[key] = value;
      }
    }
    return base;
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return merge(clone(emptyState), stored);
    } catch (_) {
      return clone(emptyState);
    }
  }

  let state = loadState();
  let commandHandler = null;

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function timeAgo(timestamp) {
    if (!hasNumber(timestamp)) return "Sin datos";
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 45) return "Ahora";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    return new Date(timestamp).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function statusClass(status) {
    if (["ok", "good", "normal", "online"].includes(status)) return "good";
    if (["warning", "attention"].includes(status)) return "warning";
    if (["danger", "alert", "offline"].includes(status)) return "danger";
    return "";
  }

  function showEmpty(emptyNode, hasItems) {
    if (emptyNode) emptyNode.hidden = hasItems;
  }

  function renderSummary() {
    const mount = el("summaryCards");
    const empty = el("summaryEmpty");
    if (!mount) return;

    const items = [];
    for (const zone of Array.isArray(state.zones) ? state.zones : []) {
      if (!zone?.name) continue;
      const bits = [];
      if (hasNumber(zone.temperature)) bits.push(`${fmt(zone.temperature, 1)} °C`);
      if (hasNumber(zone.humidity)) bits.push(`${fmt(zone.humidity, 0)} %`);
      items.push({ name: zone.name, meta: bits.join(" · ") || "Sin datos", status: zone.status });
    }
    for (const device of Array.isArray(state.devices) ? state.devices : []) {
      if (!device?.name) continue;
      const meta = device.connected === false
        ? "Sin conexión"
        : typeof device.on === "boolean"
          ? device.on ? "Encendido" : "Apagado"
          : device.connected === true ? "En línea" : "Sin datos";
      items.push({ name: device.name, meta, status: device.connected === false ? "offline" : device.status });
    }

    mount.innerHTML = items.map(item => `
      <article class="status-row">
        <div class="status-copy">
          <strong>${String(item.name)}</strong>
          <span>${String(item.meta)}</span>
        </div>
        <span class="dot ${statusClass(item.status)}" aria-hidden="true"></span>
      </article>
    `).join("");
    showEmpty(empty, items.length > 0);
  }

  function renderClimate() {
    const mount = el("climateCards");
    const empty = el("climateEmpty");
    if (!mount) return;
    const zones = (Array.isArray(state.zones) ? state.zones : []).filter(zone => zone?.name);
    mount.innerHTML = zones.map(zone => {
      const humidity = hasNumber(zone.humidity) ? `${fmt(zone.humidity, 0)} %` : "—";
      const temperature = hasNumber(zone.temperature) ? `${fmt(zone.temperature, 1)} °C` : "Sin datos";
      return `<article class="detail-card"><span>${String(zone.name)}</span><strong>${humidity}</strong><small>${temperature}</small></article>`;
    }).join("");
    showEmpty(empty, zones.length > 0);
  }

  function renderDevices() {
    const mount = el("deviceControls");
    if (!mount) return;
    const devices = (Array.isArray(state.devices) ? state.devices : []).filter(device => device?.name);
    mount.innerHTML = devices.map(device => {
      const connected = device.connected === true;
      const controllable = connected && device.controllable === true && typeof device.on === "boolean";
      const on = device.on === true;
      const stateText = !connected ? "Sin conexión" : typeof device.on === "boolean" ? on ? "Encendido" : "Apagado" : "En línea";
      return `
        <button class="control-card" type="button" data-device-id="${String(device.id || "")}" ${controllable ? "" : "disabled"} aria-disabled="${String(!controllable)}" aria-pressed="${String(controllable && on)}">
          <span class="control-copy"><strong>${String(device.name)}</strong><span>${stateText}</span></span>
          <span class="switch ${on && connected ? "on" : ""}" aria-hidden="true"><i></i></span>
        </button>`;
    }).join("");

    mount.querySelectorAll("[data-device-id]").forEach(button => {
      button.addEventListener("click", () => {
        const device = devices.find(item => String(item.id || "") === button.dataset.deviceId);
        if (!device || device.controllable !== true || typeof device.on !== "boolean") return;
        runCommand(device.id, device.on ? "turn_off" : "turn_on");
      });
    });
  }

  function renderEnergy() {
    const mount = el("energyDevices");
    const empty = el("energyEmpty");
    if (!mount) return;
    const devices = (Array.isArray(state.energy?.devices) ? state.energy.devices : []).filter(device => device?.name);
    mount.innerHTML = devices.map(device => `
      <div class="device-row"><span>${String(device.name)}</span><strong>${hasNumber(device.kwh) ? `${fmt(device.kwh, 2)} kWh` : "Sin datos"}</strong></div>
    `).join("");
    showEmpty(empty, devices.length > 0);
  }

  function renderCameras() {
    const mount = el("cameraCards");
    const empty = el("cameraEmpty");
    if (!mount) return;
    const cameras = (Array.isArray(state.cameras) ? state.cameras : []).filter(camera => camera?.name);
    mount.innerHTML = cameras.map(camera => `
      <article class="detail-card">
        <span>${camera.label ? String(camera.label) : "Cámara"}</span>
        <strong>${String(camera.name)}</strong>
        <small>${camera.online === true ? "En línea" : camera.online === false ? "Sin conexión" : "Sin datos"}</small>
      </article>
    `).join("");
    showEmpty(empty, cameras.length > 0);
  }

  function renderAccess() {
    const mount = el("accessCards");
    const empty = el("accessEmpty");
    if (!mount) return;
    const items = (Array.isArray(state.access) ? state.access : []).filter(item => item?.name);
    mount.innerHTML = items.map(item => `
      <div class="device-row"><span>${String(item.name)}</span><strong>${item.online === true ? (item.state ? String(item.state) : "En línea") : item.online === false ? "Sin conexión" : item.state ? String(item.state) : "Sin datos"}</strong></div>
    `).join("");
    showEmpty(empty, items.length > 0);
  }

  function renderOverview() {
    const environmentValue = hasNumber(state.environment?.value) ? fmt(state.environment.value, 0) : null;
    el("environmentValue").textContent = environmentValue ?? "—";
    el("environmentUnit").textContent = environmentValue ? String(state.environment.unit || "") : "";
    el("environmentState").textContent = state.environment?.state || "Sin datos";

    const waterValue = hasNumber(state.water?.availableLiters) ? fmt(state.water.availableLiters, 0) : null;
    el("waterValue").textContent = waterValue ?? "—";
    el("waterUnit").textContent = waterValue ? "L" : "";
    el("waterState").textContent = hasNumber(state.water?.capacityLiters) ? `de ${fmt(state.water.capacityLiters, 0)} L` : "Sin datos";

    const energyCost = hasNumber(state.energy?.todayKwh) && hasNumber(state.electricityPrice)
      ? state.energy.todayKwh * state.electricityPrice
      : null;
    el("energyValue").textContent = hasNumber(energyCost) ? fmt(energyCost, 2) : "—";
    el("energyUnit").textContent = hasNumber(energyCost) ? "€" : "";
    el("energyState").textContent = hasNumber(state.energy?.todayKwh) ? `${fmt(state.energy.todayKwh, 1)} kWh` : "Sin datos";

    const available = state.zones?.length || state.devices?.length || state.cameras?.length || state.access?.length || hasNumber(state.water?.availableLiters) || hasNumber(state.energy?.todayKwh);
    el("homeSummary").textContent = state.mode === "live" && available ? "Todo en orden." : "Sin datos disponibles.";
    el("modeBadge").textContent = state.mode === "live" ? "En línea" : "Sin conexión";
    el("lastUpdated").textContent = timeAgo(state.updatedAt);
  }

  function renderWater() {
    const available = state.water?.availableLiters;
    const capacity = state.water?.capacityLiters;
    el("waterDetailValue").textContent = hasNumber(available) ? fmt(available, 0) : "—";
    el("waterDetailUnit").textContent = hasNumber(available) ? "L" : "";
    el("waterToday").textContent = hasNumber(state.water?.todayLiters) ? `${fmt(state.water.todayLiters, 1)} L` : "Sin datos";
    el("waterWeek").textContent = hasNumber(state.water?.weekLiters) ? `${fmt(state.water.weekLiters, 1)} L` : "Sin datos";
    el("waterRate").textContent = hasNumber(state.water?.rateLitersHour) ? `${fmt(state.water.rateLitersHour, 2)} L/h` : "Sin datos";
    el("waterCapacity").textContent = hasNumber(capacity) ? `${fmt(capacity, 0)} L` : "Sin datos";
    const pct = hasNumber(available) && hasNumber(capacity) && capacity > 0 ? Math.max(0, Math.min(100, available / capacity * 100)) : 0;
    el("waterProgress").style.width = `${pct}%`;
  }

  function renderEnergySummary() {
    const kwh = state.energy?.todayKwh;
    const cost = hasNumber(kwh) && hasNumber(state.electricityPrice) ? kwh * state.electricityPrice : null;
    el("energyDetailValue").textContent = hasNumber(cost) ? fmt(cost, 2) : "—";
    el("energyDetailUnit").textContent = hasNumber(cost) ? "€" : "";
    el("energyDetailKwh").textContent = hasNumber(kwh) ? `${fmt(kwh, 1)} kWh` : "Sin datos.";
  }

  function render() {
    renderOverview();
    renderSummary();
    renderClimate();
    renderDevices();
    renderWater();
    renderEnergySummary();
    renderEnergy();
    renderCameras();
    renderAccess();
  }

  function setTab(name) {
    document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active", button.dataset.tab === name));
    document.querySelectorAll(".tab-panel").forEach(panel => {
      const active = panel.dataset.panel === name;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
  }

  document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => setTab(button.dataset.tab)));

  function runCommand(device, action) {
    if (typeof commandHandler !== "function") return;
    commandHandler({ device, action, requestedAt: Date.now() });
  }

  window.PocketHomeAdapter = {
    getState() { return clone(state); },
    update(payload) {
      state = merge(state, payload || {});
      state.updatedAt = Date.now();
      saveState();
      render();
    },
    setCommandHandler(handler) {
      commandHandler = typeof handler === "function" ? handler : null;
    },
    clear() {
      state = clone(emptyState);
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      render();
    }
  };

  render();
  setInterval(() => {
    const node = el("lastUpdated");
    if (node) node.textContent = timeAgo(state.updatedAt);
  }, 30000);
})();
