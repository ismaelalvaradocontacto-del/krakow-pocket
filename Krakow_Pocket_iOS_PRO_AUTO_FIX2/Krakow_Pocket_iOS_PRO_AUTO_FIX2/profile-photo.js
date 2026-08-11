(() => {
  "use strict";
  if (window.__kpProfilePhotos) return;
  window.__kpProfilePhotos = true;

  const STORAGE = "krakowPocketCoop";
  const PLAYER_KEY = "krakowPlayer";
  const PLAYERS = ["Ismael", "Laura"];
  let paintRaf = 0;
  let managerBound = false;
  let lastSignature = "";

  const now = () => new Date().toISOString();
  const currentPlayer = () => localStorage.getItem(PLAYER_KEY) === "Laura" ? "Laura" : "Ismael";

  function readState() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE) || "{}");
      if (!state || typeof state !== "object") return {};
      if (!state.profilePhotos || typeof state.profilePhotos !== "object") state.profilePhotos = {};
      return state;
    } catch {
      return { profilePhotos: {} };
    }
  }

  function entryFor(name) {
    const entry = readState().profilePhotos?.[name];
    return entry && typeof entry === "object" && typeof entry.updatedAt === "string" ? entry : null;
  }

  function dataFor(name) {
    const dataUrl = entryFor(name)?.dataUrl;
    return typeof dataUrl === "string" && dataUrl.startsWith("data:image/") ? dataUrl : "";
  }

  function writeEntry(name, dataUrl) {
    if (!PLAYERS.includes(name)) return;
    const state = readState();
    const updatedAt = now();
    state.profilePhotos = { ...(state.profilePhotos || {}), [name]: { dataUrl: dataUrl || "", updatedAt } };
    state.updatedAt = updatedAt;
    localStorage.setItem(STORAGE, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("kp:profile-photo-change", { detail: { player: name, hasPhoto: !!dataUrl } }));
    schedulePaint();
  }

  function toast(message, ms = 2300) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.style.display = "block";
    clearTimeout(el._kpPhotoTimer);
    el._kpPhotoTimer = setTimeout(() => { el.style.display = "none"; }, ms);
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
      img.src = url;
    });
  }

  async function compressPhoto(file) {
    if (!file?.type?.startsWith("image/")) throw new Error("Selecciona una imagen");
    const img = await loadImage(file);
    const size = 144;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#f2dca6";
    ctx.fillRect(0, 0, size, size);
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const width = img.naturalWidth * scale;
    const height = img.naturalHeight * scale;
    ctx.drawImage(img, (size - width) / 2, (size - height) / 2, width, height);
    let dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    if (dataUrl.length > 26000) dataUrl = canvas.toDataURL("image/jpeg", 0.58);
    return dataUrl;
  }

  function ensureStyles() {
    if (document.querySelector("style[data-kp-profile-photo]")) return;
    const style = document.createElement("style");
    style.dataset.kpProfilePhoto = "1";
    style.textContent = `
      .kp-profile-face,.kp-picker-face{position:relative!important;overflow:hidden!important}
      .kp-profile-photo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important;border-radius:inherit!important;z-index:5!important;display:block!important;pointer-events:none!important}
      #kpProfilePhotoManager{margin:10px 0 2px;padding:12px;border:2px solid #b18b56;border-radius:12px;background:linear-gradient(180deg,#fff7dc,#ead39b);box-shadow:0 2px 0 rgba(82,53,31,.16)}
      #kpProfilePhotoManager .kp-photo-head{display:flex;gap:10px;align-items:center}
      #kpProfilePhotoManager .kp-photo-preview{position:relative;flex:0 0 58px;width:58px;height:58px;border:3px solid #70452c;border-radius:50%;overflow:hidden;background:#e1c78d;display:grid;place-items:center}
      #kpProfilePhotoManager .kp-photo-preview svg{width:100%;height:100%;display:block}
      #kpProfilePhotoManager .kp-photo-preview img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
      #kpProfilePhotoManager .kp-photo-copy{min-width:0;flex:1}
      #kpProfilePhotoManager .kp-photo-copy strong{display:block;font-size:14px;color:#442d20}
      #kpProfilePhotoManager .kp-photo-copy small{display:block;margin-top:3px;font-size:10.5px;line-height:1.3;color:#725b46}
      #kpProfilePhotoManager .kp-photo-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}
      #kpProfilePhotoManager .kp-photo-actions button{min-height:44px;padding:8px 9px;border:2px solid #69442c;border-radius:9px;font-weight:900;font-size:11px;box-shadow:0 2px 0 #463022}
      #kpProfilePhotoChoose{background:linear-gradient(#719e5d,#4e7f43);color:#fff}
      #kpProfilePhotoReset{background:linear-gradient(#f4e0b6,#dec08d);color:#432d20}
      #kpProfilePhotoReset:disabled{opacity:.45}
      #kpProfilePhotoStatus{margin-top:7px;font-size:9.5px;line-height:1.25;color:#725b46;text-align:center}
      @media(max-width:345px){#kpProfilePhotoManager .kp-photo-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function addOverlay(host, name) {
    if (!host) return;
    host.style.position = "relative";
    const dataUrl = dataFor(name);
    let img = host.querySelector(":scope > .kp-profile-photo");
    if (!dataUrl) {
      img?.remove();
      return;
    }
    if (!img) {
      img = document.createElement("img");
      img.className = "kp-profile-photo";
      img.alt = `Foto de perfil de ${name}`;
      img.decoding = "async";
      img.draggable = false;
      host.appendChild(img);
    }
    if (img.src !== dataUrl) img.src = dataUrl;
  }

  function ensureManager() {
    const picker = document.getElementById("kpPlayerPicker");
    if (!picker) return null;
    let manager = document.getElementById("kpProfilePhotoManager");
    if (!manager) {
      manager = document.createElement("div");
      manager.id = "kpProfilePhotoManager";
      manager.innerHTML = `
        <div class="kp-photo-head">
          <span class="kp-photo-preview" id="kpProfilePhotoPreview" aria-hidden="true"></span>
          <span class="kp-photo-copy"><strong id="kpProfilePhotoTitle">Foto de perfil</strong><small>Se reduce automáticamente y se sincroniza dentro de vuestra partida.</small></span>
        </div>
        <div class="kp-photo-actions">
          <button type="button" id="kpProfilePhotoChoose">📷 Cambiar foto</button>
          <button type="button" id="kpProfilePhotoReset">↩ Avatar ilustrado</button>
        </div>
        <input type="file" id="kpProfilePhotoInput" accept="image/*" hidden>
        <div id="kpProfilePhotoStatus">Puedes elegir una foto de la fototeca.</div>`;
      picker.insertAdjacentElement("afterend", manager);
      managerBound = false;
    }
    if (!managerBound) {
      managerBound = true;
      const input = manager.querySelector("#kpProfilePhotoInput");
      manager.querySelector("#kpProfilePhotoChoose")?.addEventListener("click", () => input?.click());
      manager.querySelector("#kpProfilePhotoReset")?.addEventListener("click", () => {
        const name = currentPlayer();
        writeEntry(name, "");
        toast(`Avatar ilustrado restaurado para ${name}`);
      });
      input?.addEventListener("change", async () => {
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        const name = currentPlayer();
        setStatus("Preparando foto…");
        try {
          const dataUrl = await compressPhoto(file);
          writeEntry(name, dataUrl);
          setStatus("Guardada · se sincroniza automáticamente con el otro iPhone");
          toast(`📷 Foto de ${name} actualizada`);
        } catch (error) {
          console.warn("Kraków Pocket profile photo", error);
          setStatus("No se pudo usar esa imagen");
          toast("No se pudo usar esa foto");
        }
      });
    }
    return manager;
  }

  function setStatus(text) {
    const status = document.getElementById("kpProfilePhotoStatus");
    if (status && text) status.textContent = text;
  }

  function paintManager() {
    const manager = ensureManager();
    if (!manager) return;
    const name = currentPlayer();
    const pickerFace = document.querySelector(`#kpPlayerPicker [data-kp-player="${name}"] .kp-picker-face`);
    const preview = manager.querySelector("#kpProfilePhotoPreview");
    const title = manager.querySelector("#kpProfilePhotoTitle");
    const reset = manager.querySelector("#kpProfilePhotoReset");
    if (title) title.textContent = `Foto de ${name}`;
    if (reset) reset.disabled = !dataFor(name);
    if (preview) {
      preview.replaceChildren();
      const dataUrl = dataFor(name);
      if (dataUrl) {
        const img = document.createElement("img");
        img.src = dataUrl;
        img.alt = "";
        preview.appendChild(img);
      } else {
        const svg = pickerFace?.querySelector("svg")?.cloneNode(true);
        if (svg) preview.appendChild(svg);
      }
    }
  }

  function paintProfiles() {
    ensureStyles();
    for (const name of PLAYERS) {
      document.querySelectorAll(`#kpGameHud .kp-profile-face[data-kp-profile="${name}"], #kpPlayerPicker [data-kp-player="${name}"] .kp-picker-face`).forEach(host => addOverlay(host, name));
    }
    paintManager();
    const photos = readState().profilePhotos || {};
    lastSignature = JSON.stringify(photos);
    window.KP_PROFILE_PHOTOS = {
      version: "1.1",
      sharedViaAdventureState: true,
      optimizedAvatar: true,
      immediateRemoteRepaint: true,
      players: Object.fromEntries(PLAYERS.map(name => [name, !!dataFor(name)])),
      get: name => dataFor(name),
      setDataUrl: (name, dataUrl) => writeEntry(name, dataUrl),
      remove: name => writeEntry(name, ""),
      snapshot: () => JSON.parse(JSON.stringify(readState().profilePhotos || {}))
    };
  }

  function schedulePaint() {
    if (paintRaf) return;
    paintRaf = requestAnimationFrame(() => { paintRaf = 0; paintProfiles(); });
  }

  function pollSharedState() {
    const signature = JSON.stringify(readState().profilePhotos || {});
    if (signature !== lastSignature) schedulePaint();
  }

  function boot() {
    ensureStyles();
    schedulePaint();
    const observer = new MutationObserver(records => {
      if (records.some(record => record.target?.closest?.("#kpGameHud,#kpPlayerPicker,#settingsSheet") || [...record.addedNodes].some(node => node?.querySelector?.("#kpGameHud,#kpPlayerPicker,#settingsSheet")))) schedulePaint();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", event => {
      if (event.target.closest?.("#kpPlayerPicker [data-kp-player],#openSettings,#kpGameSettings,#kpGameHud .kp-game-portrait")) setTimeout(schedulePaint, 30);
    }, true);
    window.addEventListener("storage", event => {
      if (event.key === STORAGE || event.key === PLAYER_KEY) schedulePaint();
    });
    window.addEventListener("kp:render", schedulePaint);
    window.addEventListener("kp:game-render", schedulePaint);
    window.addEventListener("kp:statechange", schedulePaint);
    window.addEventListener("pageshow", schedulePaint);
    window.addEventListener("kp:profile-photo-change", schedulePaint);
    window.addEventListener("kp:profile-photo-sync", schedulePaint);
    setInterval(pollSharedState, 1200);
    [50, 150, 400, 900, 1800, 3200].forEach(ms => setTimeout(schedulePaint, ms));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
