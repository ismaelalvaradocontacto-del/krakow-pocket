(() => {
  const STORAGE_KEY = "pocket.casita.v1";
  const defaults = {
    mode: "simulation",
    electricityPrice: 0.22,
    indoor: { temp: 23.4, humidity: 54 },
    corner: { temp: 21.8, humidity: 68 },
    patio: { temp: 20.9, humidity: 77 },
    tank: { liters: 42, capacity: 100 },
    water: { today: 8.7, week: 51.3, rate: 0.46 },
    energy: { todayKwh: 3.8, dehumidifierKwh: 2.7 },
    devices: { dehumidifier: true, pump: false },
    updatedAt: Date.now()
  };

  const clone = value => JSON.parse(JSON.stringify(value));

  function merge(base, incoming) {
    if (!incoming || typeof incoming !== "object") return base;
    for (const [key, value] of Object.entries(incoming)) {
      if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object") {
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
      return merge(clone(defaults), stored);
    } catch (_) {
      return clone(defaults);
    }
  }

  let state = loadState();

  function saveState() {
    state.updatedAt = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  const el = id => document.getElementById(id);
  const fmt = (value, digits = 1) => Number(value).toLocaleString("es-ES", { maximumFractionDigits: digits, minimumFractionDigits: digits });

  function humidityDescriptor(humidity) {
    if (humidity < 40) return { label: "Demasiado seco", className: "danger" };
    if (humidity < 45) return { label: "Seco", className: "warning" };
    if (humidity <= 60) return { label: "Óptimo", className: "good" };
    if (humidity <= 65) return { label: "Algo húmedo", className: "warning" };
    return { label: "Humedad alta", className: "danger" };
  }

  function patioDescriptor(humidity) {
    if (humidity >= 70) return "Buen momento para producir";
    if (humidity >= 60) return "Producción favorable";
    if (humidity >= 50) return "Producción moderada";
    return "Poca humedad disponible";
  }

  function timeAgo(timestamp) {
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 45) return "Ahora";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `Hace ${hours} h`;
  }

  function setDot(node, className) {
    if (!node) return;
    node.classList.remove("good", "warning", "danger");
    node.classList.add(className);
  }

  function renderClimateCards() {
    const mount = el("climateCards");
    if (!mount) return;
    const zones = [
      ["Habitáculo", state.indoor, humidityDescriptor(state.indoor.humidity)],
      ["Esquina húmeda", state.corner, humidityDescriptor(state.corner.humidity)],
      ["Patio", state.patio, humidityDescriptor(state.patio.humidity)]
    ];
    mount.innerHTML = zones.map(([name, zone, descriptor]) => `
      <article class="detail-card">
        <span>${name}</span>
        <strong>${fmt(zone.humidity, 0)} %</strong>
        <small>${fmt(zone.temp, 1)} °C · ${descriptor.label}</small>
      </article>
    `).join("");
  }

  function render() {
    const indoorStatus = humidityDescriptor(state.indoor.humidity);
    const cornerStatus = humidityDescriptor(state.corner.humidity);
    const tankPct = Math.max(0, Math.min(100, (state.tank.liters / state.tank.capacity) * 100));
    const energyCost = state.energy.todayKwh * state.electricityPrice;
    const costPerLiter = state.water.today > 0 ? energyCost / state.water.today : 0;
    const efficiency = state.energy.dehumidifierKwh > 0 ? state.water.today / state.energy.dehumidifierKwh : 0;
    const washes = Math.max(0, Math.floor(state.tank.liters / 40));

    el("indoorHumidity").textContent = fmt(state.indoor.humidity, 0);
    el("humidityState").textContent = indoorStatus.label;
    el("humidityState").className = `metric-state ${indoorStatus.className}`;
    el("tankLiters").textContent = fmt(state.tank.liters, 0);
    el("tankState").textContent = `de ${fmt(state.tank.capacity, 0)} L`;
    el("energyCost").textContent = fmt(energyCost, 2);
    el("energyKwh").textContent = `${fmt(state.energy.todayKwh, 1)} kWh`;

    el("indoorTemp").textContent = `${fmt(state.indoor.temp, 1)} °C`;
    el("indoorHumidityInline").textContent = `${fmt(state.indoor.humidity, 0)} %`;
    el("cornerTemp").textContent = `${fmt(state.corner.temp, 1)} °C`;
    el("cornerHumidity").textContent = `${fmt(state.corner.humidity, 0)} %`;
    el("patioTemp").textContent = `${fmt(state.patio.temp, 1)} °C`;
    el("patioHumidity").textContent = `${fmt(state.patio.humidity, 0)} %`;
    el("patioProduction").textContent = patioDescriptor(state.patio.humidity);
    setDot(el("indoorDot"), indoorStatus.className);
    setDot(el("cornerDot"), cornerStatus.className);

    el("todayLiters").textContent = fmt(state.water.today, 1);
    el("productionRate").textContent = `${fmt(state.water.rate, 2)} L/h`;
    el("costPerLiter").textContent = `${fmt(costPerLiter, 2)} €/L`;
    el("tankProgress").style.width = `${tankPct}%`;

    el("waterDetailLiters").textContent = fmt(state.tank.liters, 0);
    el("waterDetailProgress").style.width = `${tankPct}%`;
    el("waterToday").textContent = `${fmt(state.water.today, 1)} L`;
    el("waterWeek").textContent = `${fmt(state.water.week, 1)} L`;
    el("waterRate").textContent = `${fmt(state.water.rate, 2)} L/h`;
    el("washEstimate").textContent = `≈ ${washes}`;

    el("energyDetailCost").textContent = fmt(energyCost, 2);
    el("energyDetailKwh").textContent = `${fmt(state.energy.todayKwh, 1)} kWh`;
    el("dehumidifierEnergy").textContent = `${fmt(state.energy.dehumidifierKwh, 1)} kWh`;
    el("efficiencyValue").textContent = `${fmt(efficiency, 2)} L/kWh`;

    const dehumidifierOn = Boolean(state.devices.dehumidifier);
    el("dehumidifierButton").setAttribute("aria-pressed", String(dehumidifierOn));
    el("dehumidifierSwitch").classList.toggle("on", dehumidifierOn);
    el("dehumidifierState").classList.toggle("on", dehumidifierOn);
    el("dehumidifierState").innerHTML = `<i></i> ${dehumidifierOn ? "Produciendo" : "Parado"}`;
    el("dehumidifierHint").textContent = `${dehumidifierOn ? "Encendido" : "Apagado"} · simulación`;

    const pumpOn = Boolean(state.devices.pump);
    el("pumpButton").setAttribute("aria-pressed", String(pumpOn));
    el("pumpSwitch").classList.toggle("on", pumpOn);
    el("pumpHint").textContent = `${pumpOn ? "Encendida" : "Apagada"} · simulación`;

    el("lastUpdated").textContent = timeAgo(state.updatedAt);
    el("modeBadge").textContent = state.mode === "live" ? "Conectado" : "Simulación";

    if (indoorStatus.className === "danger" && state.indoor.humidity < 40) {
      el("homeSummary").textContent = "El habitáculo está demasiado seco. Conviene parar la deshumidificación interior.";
    } else if (cornerStatus.className === "danger") {
      el("homeSummary").textContent = "El ambiente general está estable, pero la esquina húmeda merece seguimiento.";
    } else {
      el("homeSummary").textContent = "El ambiente está estable y no hay avisos importantes.";
    }

    renderClimateCards();
  }

  function setTab(name) {
    document.querySelectorAll(".tab").forEach(button => {
      button.classList.toggle("active", button.dataset.tab === name);
    });
    document.querySelectorAll(".tab-panel").forEach(panel => {
      const active = panel.dataset.panel === name;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
  }

  document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });

  el("dehumidifierButton")?.addEventListener("click", () => {
    if (state.mode !== "simulation") return;
    state.devices.dehumidifier = !state.devices.dehumidifier;
    if (!state.devices.dehumidifier) state.water.rate = 0;
    else if (state.water.rate <= 0) state.water.rate = defaults.water.rate;
    saveState();
    render();
  });

  el("pumpButton")?.addEventListener("click", () => {
    if (state.mode !== "simulation") return;
    state.devices.pump = !state.devices.pump;
    saveState();
    render();
  });

  /*
    Future integration point.
    Home Assistant / ESPHome / Supabase can feed normalized telemetry here
    without changing the UI. Example:

    window.PocketHomeAdapter.update({
      mode: "live",
      patio: { temp: 22.1, humidity: 74 },
      tank: { liters: 58.4 },
      devices: { dehumidifier: true }
    });
  */
  window.PocketHomeAdapter = {
    getState() { return clone(state); },
    update(payload) {
      state = merge(state, payload || {});
      state.updatedAt = Date.now();
      saveState();
      render();
    },
    resetSimulation() {
      state = clone(defaults);
      saveState();
      render();
    }
  };

  render();
  setInterval(() => {
    const node = el("lastUpdated");
    if (node) node.textContent = timeAgo(state.updatedAt);
  }, 30000);
})();
