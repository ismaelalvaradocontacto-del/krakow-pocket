(() => {
  "use strict";
  if (window.__kpProfilePhotos) return;
  window.__kpProfilePhotos = true;

  const STORAGE = "krakowPocketCoop";
  const PLAYER_KEY = "krakowPlayer";
  const PLAYERS = ["Ismael", "Laura"];
  const NS = "http://www.w3.org/2000/svg";
  let paintRaf = 0;
  let managerBound = false;

  const now = () => new Date().toISOString();
  const currentPlayer = () => localStorage.getItem(PLAYER_KEY) === "Laura" ? "Laura" : "Ismael";

  function readState() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE) || "{}");
      if (!state || typeof state !== "object") return { profilePhotos: {} };
      if (!state.profilePhotos || typeof state.profilePhotos !== "object") state.profilePhotos = {};
      return state;
    } catch {
      return { profilePhotos: {} };
    }
  }

  function entryFor(name) {
    const entry = readState().profilePhotos?.[name];
    return entry && typeof entry === "object" ? entry : null;
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
    try { window.dispatchEvent(new CustomEvent("kp:profile-photo-change", { detail: { player: name, hasPhoto: !!dataUrl } })); } catch {}
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

  function svgNode(tag, attrs = {}) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  }

  function createDefaultAvatar() {
    const svg = svgNode("svg", { viewBox: "0 0 100 100", focusable: "false", "aria-hidden": "true" });
    svg.classList.add("kp-profile-default");
    svg.appendChild(svgNode("circle", { cx: 50, cy: 50, r: 50, fill: "#aaaaaa" }));
    svg.appendChild(svgNode("circle", { cx: 50, cy: 34, r: 17.5, fill: "#f4f4f4" }));
    svg.appendChild(svgNode("path", { d: "M18 100C20.5 74 32.5 62 50 62S79.5 74 82 100Z", fill: "#f4f4f4" }));
    return svg;
  }

  function ensureStyles() {
    if (document.querySelector("style[data-kp-profile-photo]")) return;
    const style = document.createElement("style");
    style.dataset.kpProfilePhoto = "1";
    style.textContent = `
      .kp-profile-photo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important;border-radius:inherit!important;z-index:6!important;display:block!important;pointer-events:none!important}
      #kpProfilePhotoManager{margin:10px 0 2px;padding:12px;border:2px solid #b18b56;border-radius:12px;background:linear-gradient(180deg,#fff7dc,#ead39b);box-shadow:0 2px 0 rgba(82,53,31,.16)}
      #kpProfilePhotoManager .kp-photo-head{display:flex;gap:10px;align-items:center}
      #kpProfilePhotoManager .kp-photo-preview{position:relative;flex:0 0 58px;width:58px;height:58px;border:3px solid #70452c;border-radius:50%;overflow:hidden;background:#e1c78d;display:grid;place-items:center}
      #kpProfilePhotoManager .kp-photo-preview svg,#kpProfilePhotoManager .kp-photo-preview img{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover}
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

  function directPhoto(host) {
    return [...(host?.children || [])].find(node => node.classList?.contains("kp-profile-photo")) || null;
  }

  function paintHost(host, name) {
    if (!host) return;
    const dataUrl = dataFor(name);
    let img = directPhoto(host);
    if (!dataUrl) {
      if (img) img.remove();
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
    if (img.getAttribute("src") !== dataUrl) img.setAttribute("src", dataUrl);
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
          <button type="button" id="kpProfilePhotoReset">↩ Imagen por defecto</button>
        </div>
        <input type="file" id="kpProfilePhotoInput" accept="image/*" hidden>
        <div id="kpProfilePhotoStatus">Puedes elegir una foto de la fototeca o mantener la imagen por defecto.</div>`;
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
        toast(`Imagen por defecto restaurada para ${name}`);
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
    if (status && text && status.textContent !== text) status.textContent = text;
  }

  function paintManager() {
    const manager = ensureManager();
    if (!manager) return;
    const name = currentPlayer(),dataUrl=dataFor(name);
    const title = manager.querySelector("#kpProfilePhotoTitle");
    const reset = manager.querySelector("#kpProfilePhotoReset");
    const preview = manager.querySelector("#kpProfilePhotoPreview");
    const titleText=`Foto de ${name}`;if(title&&title.textContent!==titleText)title.textContent=titleText;
    if(reset){reset.disabled=!dataUrl;if(reset.textContent!=="↩ Imagen por defecto")reset.textContent="↩ Imagen por defecto"}
    if(!preview)return;
    if(dataUrl){
      const current=preview.querySelector(":scope > img.kp-photo-current");
      if(current&&current.getAttribute("src")===dataUrl&&preview.children.length===1)return;
      const img=document.createElement("img");img.className="kp-photo-current";img.src=dataUrl;img.alt="";preview.replaceChildren(img);return;
    }
    const fallback=preview.querySelector(":scope > svg.kp-profile-default");if(fallback&&preview.children.length===1)return;preview.replaceChildren(createDefaultAvatar());
  }

  function paintProfiles() {
    paintRaf=0;ensureStyles();
    for(const name of PLAYERS){document.querySelectorAll(`#kpGameHud .kp-profile-face[data-kp-profile="${name}"],#kpPlayerPicker [data-kp-player="${name}"] .kp-picker-face`).forEach(host=>paintHost(host,name))}
    paintManager();
    window.KP_PROFILE_PHOTOS={version:"2.0",sharedViaAdventureState:true,optimizedAvatar:true,immediateRemoteRepaint:true,eventDriven:true,noGlobalMutationObserver:true,noPollingLoop:true,players:Object.fromEntries(PLAYERS.map(name=>[name,!!dataFor(name)])),get:name=>dataFor(name),setDataUrl:(name,dataUrl)=>writeEntry(name,dataUrl),remove:name=>writeEntry(name,""),snapshot:()=>JSON.parse(JSON.stringify(readState().profilePhotos||{}))};
  }

  function schedulePaint(){if(!paintRaf)paintRaf=requestAnimationFrame(paintProfiles)}
  function shortBurst(){schedulePaint();setTimeout(schedulePaint,90)}

  function boot(){
    ensureStyles();shortBurst();
    document.addEventListener("click",event=>{if(event.target.closest?.("#kpGameSettings,#openSettings,#kpPlayerPicker [data-kp-player],#kpProfilePhotoReset"))shortBurst()},true);
    window.addEventListener("storage",event=>{if(event.key===STORAGE||event.key===PLAYER_KEY)shortBurst()});
    window.addEventListener("kp:profile-hosts-ready",shortBurst);
    window.addEventListener("kp:profile-photo-change",shortBurst);
    window.addEventListener("kp:profile-photo-sync",shortBurst);
    window.addEventListener("pageshow",shortBurst);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)shortBurst()});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
