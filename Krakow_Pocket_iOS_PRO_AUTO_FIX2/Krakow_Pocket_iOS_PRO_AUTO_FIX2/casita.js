(() => {
  const STORAGE_KEY = "pocket.casita.v2";
  const emptyState = {
    mode: "disconnected",
    electricityPrice: null,
    indoor: { temp: null, humidity: null },
    corner: { temp: null, humidity: null },
    patio: { temp: null, humidity: null },
    tank: { liters: null, capacity: null },
    water: { today: null, week: null, rate: null },
    energy: { todayKwh: null, dehumidifierKwh: null },
    washer: { litersPerCycle: null },
    devices: {
      dehumidifier: { connected: false, on: null, controllable: false },
      pump: { connected: false, on: null, controllable: false }
    },
    cameras: [],
    access: { doorbellConnected: false, doorReleaseConnected: false },
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

  function humidityDescriptor(humidity) {
    if (!hasNumber(humidity)) return null;
    if (humidity < 40) return { label: "Muy seco", className: "danger" };
    if (humidity < 45) return { label: "Seco", className: "warning" };
    if (humidity <= 60) return { label: "En rango", className: "good" };
    if (humidity <= 65) return { label: "Algo húmedo", className: "warning" };
    return { label: "Humedad alta", className: "danger" };
  }

  function patioDescriptor(humidity) {
    if (!hasNumber(humidity)) return "Sin datos";
    if (humidity >= 70) return "Humedad alta";
    if (humidity >= 60) return "Humedad media-alta";
    if (humidity >= 50) return "Humedad media";
    return "Humedad baja";
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

  function setDot(node, descriptor) {
    if (!node) return;
    node.classList.remove("good", "warning", "danger");
    if (descriptor?.className) node.classList.add(descriptor.className);
    node.setAttribute("aria-label", descriptor?.label || "Sin datos");
  }

  function renderClimateCards() {
    const mount = el("climateCards");
    if (!mount) return;
    const zones = [
      ["Habitáculo", state.indoor],
      ["Esquina húmeda", state.corner],
      ["Patio", state.patio]
    ];
    mount.innerHTML = zones.map(([name, zone]) => {
      const descriptor = humidityDescriptor(zone.humidity);
      const humidity = hasNumber(zone.humidity) ? `${fmt(zone.humidity, 0)} %` : "Sin datos";
      const temp = hasNumber(zone.temp) ? `${fmt(zone.temp, 1)} °C` : "—";
      return `<article class="detail-card"><span>${name}</span><strong>${humidity}</strong><small>${temp}${descriptor ? ` · ${descriptor.label}` : ""}</small></article>`;
    }).join("");
  }

  function renderCameraCards() {
    const mount = el("cameraCards");
    const empty = el("cameraEmpty");
    if (!mount) return;
    const cameras = Array.isArray(state.cameras) ? state.cameras.filter(camera => camera && camera.name) : [];
    if (!cameras.length) {
      mount.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    mount.innerHTML = cameras.map(camera => `
      <article class="detail-card">
        <span>${String(camera.location || "Cámara")}</span>
        <strong>${String(camera.name)}</strong>
        <small>${camera.online === true ? "En línea" : camera.online === false ? "Sin conexión" : "Sin datos"}</small>
      </article>`).join("");
  }

  function setDeviceUI(name, disconnectedLabel) {
    const device = state.devices?.[name] || {};
    const connected = device.connected === true;
    const controllable = connected && device.controllable === true;
    const on = device.on === true;
    const button = el(`${name}Button`);
    const switchNode = el(`${name}Switch`);
    const hint = el(`${name}Hint`);

    if (button) {
      button.disabled = !controllable;
      button.setAttribute("aria-disabled", String(!controllable));
      button.setAttribute("aria-pressed", connected && typeof device.on === "boolean" ? String(on) : "false");
    }
    switchNode?.classList.toggle("on", connected && on);
    if (hint) hint.textContent = !connected ? disconnectedLabel : typeof device.on !== "boolean" ? "Sin datos" : on ? "Encendido" : "Apagado";
  }

  function render() {
    const indoorStatus = humidityDescriptor(state.indoor.humidity);
    const cornerStatus = humidityDescriptor(state.corner.humidity);

    el("indoorHumidity").textContent = hasNumber(state.indoor.humidity) ? fmt(state.indoor.humidity, 0) : "—";
    el("indoorHumidityUnit").textContent = hasNumber(state.indoor.humidity) ? "%" : "";
    el("humidityState").textContent = indoorStatus?.label || "Sin datos";
    el("humidityState").className = `metric-state${indoorStatus ? ` ${indoorStatus.className}` : ""}`;

    el("tankLiters").textContent = hasNumber(state.tank.liters) ? fmt(state.tank.liters, 0) : "—";
    el("tankLitersUnit").textContent = hasNumber(state.tank.liters) ? "L" : "";
    el("tankState").textContent = hasNumber(state.tank.capacity) ? `de ${fmt(state.tank.capacity, 0)} L` : "Sin datos";

    const energyCost = hasNumber(state.energy.todayKwh) && hasNumber(state.electricityPrice)
      ? state.energy.todayKwh * state.electricityPrice
      : null;
    el("energyCost").textContent = hasNumber(energyCost) ? fmt(energyCost, 2) : "—";
    el("energyCostUnit").textContent = hasNumber(energyCost) ? "€" : "";
    el("energyKwh").textContent = hasNumber(state.energy.todayKwh) ? `${fmt(state.energy.todayKwh, 1)} kWh` : "Sin datos";

    el("indoorTemp").textContent = hasNumber(state.indoor.temp) ? `${fmt(state.indoor.temp, 1)} °C` : "Sin datos";
    el("indoorHumidityInline").textContent = hasNumber(state.indoor.humidity) ? ` · ${fmt(state.indoor.humidity, 0)} %` : "";
    el("cornerTemp").textContent = hasNumber(state.corner.temp) ? `${fmt(state.corner.temp, 1)} °C` : "Sin datos";
    el("cornerHumidity").textContent = hasNumber(state.corner.humidity) ? ` · ${fmt(state.corner.humidity, 0)} %` : "";
    el("patioTemp").textContent = hasNumber(state.patio.temp) ? `${fmt(state.patio.temp, 1)} °C` : "Sin datos";
    el("patioHumidity").textContent = hasNumber(state.patio.humidity) ? ` · ${fmt(state.patio.humidity, 0)} %` : "";
    el("patioProduction").textContent = patioDescriptor(state.patio.humidity);
    setDot(el("indoorDot"), indoorStatus);
    setDot(el("cornerDot"), cornerStatus);

    el("todayLiters").textContent = hasNumber(state.water.today) ? fmt(state.water.today, 1) : "—";
    el("todayLitersUnit").textContent = hasNumber(state.water.today) ? "L hoy" : "Sin datos";
    el("productionRate").textContent = hasNumber(state.water.rate) ? `${fmt(state.water.rate, 2)} L/h` : "Sin datos";

    const costPerLiter = hasNumber(energyCost) && hasNumber(state.water.today) && state.water.today > 0
      ? energyCost / state.water.today
      : null;
    el("costPerLiter").textContent = hasNumber(costPerLiter) ? `${fmt(costPerLiter, 2)} €/L` : "Sin datos";

    const tankPct = hasNumber(state.tank.liters) && hasNumber(state.tank.capacity) && state.tank.capacity > 0
      ? Math.max(0, Math.min(100, (state.tank.liters / state.tank.capacity) * 100))
      : 0;
    el("tankProgress").style.width = `${tankPct}%`;
    el("waterDetailProgress").style.width = `${tankPct}%`;
    el("waterDetailLiters").textContent = hasNumber(state.tank.liters) ? fmt(state.tank.liters, 0) : "—";
    el("waterDetailCapacity").textContent = hasNumber(state.tank.capacity) ? `/ ${fmt(state.tank.capacity, 0)} L` : " Sin datos";
    el("waterToday").textContent = hasNumber(state.water.today) ? `${fmt(state.water.today, 1)} L` : "Sin datos";
    el("waterWeek").textContent = hasNumber(state.water.week) ? `${fmt(state.water.week, 1)} L` : "Sin datos";
    el("waterRate").textContent = hasNumber(state.water.rate) ? `${fmt(state.water.rate, 2)} L/h` : "Sin datos";

    const washes = hasNumber(state.tank.liters) && hasNumber(state.washer?.litersPerCycle) && state.washer.litersPerCycle > 0
      ? Math.floor(state.tank.liters / state.washer.litersPerCycle)
      : null;
    el("washEstimate").textContent = hasNumber(washes) ? String(washes) : "Sin datos";

    el("energyDetailCost").textContent = hasNumber(energyCost) ? fmt(energyCost, 2) : "—";
    el("energyDetailCostUnit").textContent = hasNumber(energyCost) ? "€" : "";
    el("energyDetailKwh").textContent = hasNumber(state.energy.todayKwh) ? `${fmt(state.energy.todayKwh, 1)} kWh` : "Sin datos.";
    el("dehumidifierEnergy").textContent = hasNumber(state.energy.dehumidifierKwh) ? `${fmt(state.energy.dehumidifierKwh, 1)} kWh` : "Sin datos";

    const efficiency = hasNumber(state.energy.dehumidifierKwh) && state.energy.dehumidifierKwh > 0 && hasNumber(state.water.today)
      ? state.water.today / state.energy.dehumidifierKwh
      : null;
    el("efficiencyValue").textContent = hasNumber(efficiency) ? `${fmt(efficiency, 2)} L/kWh` : "Sin datos";

    setDeviceUI("dehumidifier", "Sin conexión");
    setDeviceUI("pump", "Sin conexión");

    const dehumidifier = state.devices?.dehumidifier || {};
    const dehumidifierState = el("dehumidifierState");
    dehumidifierState?.classList.toggle("on", dehumidifier.connected === true && dehumidifier.on === true);
    if (dehumidifierState) {
      dehumidifierState.innerHTML = `<i></i> ${dehumidifier.connected !== true ? "Sin conexión" : typeof dehumidifier.on !== "boolean" ? "Sin datos" : dehumidifier.on ? "Produciendo" : "Parado"}`;
    }

    el("doorbellStatus").textContent = state.access?.doorbellConnected === true ? "En línea" : "Sin conexión";
    el("doorReleaseStatus").textContent = state.access?.doorReleaseConnected === true ? "Disponible" : "Sin conexión";

    el("lastUpdated").textContent = timeAgo(state.updatedAt);
    el("modeBadge").textContent = state.mode === "live" ? "En línea" : "Sin conexión";

    if (state.mode !== "live") {
      el("homeSummary").textContent = "Sin datos disponibles.";
    } else if (indoorStatus?.className === "danger" && hasNumber(state.indoor.humidity) && state.indoor.humidity < 40) {
      el("homeSummary").textContent = "Ambiente muy seco.";
    } else if (cornerStatus?.className === "danger") {
      el("homeSummary").textContent = "Humedad alta en la esquina.";
    } else {
      el("homeSummary").textContent = "Todo en orden.";
    }

    renderClimateCards();
    renderCameraCards();
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

  el("dehumidifierButton")?.addEventListener("click", () => {
    const device = state.devices?.dehumidifier;
    if (device?.connected === true && device?.controllable === true && typeof device.on === "boolean") {
      runCommand("dehumidifier", device.on ? "turn_off" : "turn_on");
    }
  });

  el("pumpButton")?.addEventListener("click", () => {
    const device = state.devices?.pump;
    if (device?.connected === true && device?.controllable === true && typeof device.on === "boolean") {
      runCommand("pump", device.on ? "turn_off" : "turn_on");
    }
  });

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
