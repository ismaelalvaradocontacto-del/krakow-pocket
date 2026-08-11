(() => {
  "use strict";
  if (window.__kpDefaultProfileImage) return;
  window.__kpDefaultProfileImage = true;

  const STORAGE = "krakowPocketCoop";
  const PLAYER_KEY = "krakowPlayer";
  const NS = "http://www.w3.org/2000/svg";
  let raf = 0;

  const currentPlayer = () => localStorage.getItem(PLAYER_KEY) === "Laura" ? "Laura" : "Ismael";

  function readState() {
    try { return JSON.parse(localStorage.getItem(STORAGE) || "{}") || {}; }
    catch { return {}; }
  }

  function customPhoto(name) {
    const value = readState().profilePhotos?.[name]?.dataUrl;
    return typeof value === "string" && value.startsWith("data:image/");
  }

  function directChild(host, className) {
    return [...(host?.children || [])].find(node => node.classList?.contains(className)) || null;
  }

  function playerForHost(host) {
    return host?.dataset?.kpProfile || host?.closest?.("[data-kp-player]")?.dataset?.kpPlayer || "";
  }

  function svgNode(tag, attrs = {}) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  }

  function createDefaultAvatar(name = "") {
    const svg = svgNode("svg", {
      viewBox: "0 0 100 100",
      role: "img",
      "aria-label": name ? `Imagen de perfil por defecto de ${name}` : "Imagen de perfil por defecto",
      focusable: "false"
    });
    svg.classList.add("kp-profile-default");
    svg.dataset.kpDefaultProfile = "1";
    svg.appendChild(svgNode("circle", { cx: 50, cy: 50, r: 50, fill: "#aaaaaa" }));
    svg.appendChild(svgNode("circle", { cx: 50, cy: 34, r: 17.5, fill: "#f4f4f4" }));
    svg.appendChild(svgNode("path", {
      d: "M18 100C20.5 74 32.5 62 50 62S79.5 74 82 100Z",
      fill: "#f4f4f4"
    }));
    return svg;
  }

  function ensureStyles() {
    if (document.querySelector("style[data-kp-default-profile]")) return;
    const style = document.createElement("style");
    style.dataset.kpDefaultProfile = "1";
    style.textContent = `
      .kp-profile-face,.kp-picker-face{position:relative!important;overflow:hidden!important}
      .kp-profile-default{
        position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
        display:block!important;pointer-events:none!important;z-index:4!important;border-radius:inherit!important;
      }
      .kp-profile-photo{z-index:6!important}
      #kpProfilePhotoPreview{position:relative!important;overflow:hidden!important}
      #kpProfilePhotoPreview>.kp-profile-default{z-index:3!important}
      #kpProfilePhotoPreview>img:not(.kp-profile-default){position:relative;z-index:5!important}
    `;
    document.head.appendChild(style);
  }

  function removeDefaults(host) {
    if (!host) return;
    [...host.children].forEach(node => {
      if (node.classList?.contains("kp-profile-default")) node.remove();
    });
  }

  function ensureDefault(host, name) {
    if (!host) return;
    const hasPhotoNode = !!directChild(host, "kp-profile-photo");
    if (customPhoto(name) || hasPhotoNode) {
      removeDefaults(host);
      return;
    }

    let fallback = directChild(host, "kp-profile-default");
    if (fallback?.tagName?.toLowerCase() === "img") {
      fallback.remove();
      fallback = null;
    }
    if (!fallback) host.appendChild(createDefaultAvatar(name));
  }

  function paintManager() {
    const manager = document.getElementById("kpProfilePhotoManager");
    if (!manager) return;
    const name = currentPlayer();
    const reset = manager.querySelector("#kpProfilePhotoReset");
    if (reset) {
      reset.textContent = "↩ Imagen por defecto";
      reset.title = "Quitar la foto personalizada y volver a la imagen por defecto";
    }

    const status = manager.querySelector("#kpProfilePhotoStatus");
    if (status && !customPhoto(name) && /fototeca|ilustrado/i.test(status.textContent || "")) {
      status.textContent = "Puedes elegir una foto de la fototeca o mantener la imagen por defecto.";
    }

    const preview = manager.querySelector("#kpProfilePhotoPreview");
    if (!preview) return;
    const customPreview = [...preview.children].some(node => node.tagName === "IMG" && !node.classList.contains("kp-profile-default"));
    if (customPhoto(name) || customPreview) {
      removeDefaults(preview);
      return;
    }

    let fallback = directChild(preview, "kp-profile-default");
    if (fallback?.tagName?.toLowerCase() === "img") {
      fallback.remove();
      fallback = null;
    }
    if (!fallback) preview.appendChild(createDefaultAvatar(name));
  }

  function paint() {
    raf = 0;
    ensureStyles();
    document.querySelectorAll('#kpGameHud .kp-profile-face[data-kp-profile]').forEach(host => ensureDefault(host, playerForHost(host)));
    document.querySelectorAll('#kpPlayerPicker [data-kp-player] .kp-picker-face').forEach(host => ensureDefault(host, playerForHost(host)));
    paintManager();
    window.KP_DEFAULT_PROFILE = {
      version: "1.1",
      genericDefault: true,
      inlineSvg: true,
      noExternalImageDependency: true,
      replacesIllustratedProfileFallback: true
    };
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(paint);
  }

  function burst() {
    [0, 50, 160, 420].forEach(ms => setTimeout(schedule, ms));
  }

  function boot() {
    ensureStyles();
    burst();

    document.addEventListener("click", event => {
      const target = event.target.closest?.("#kpGameSettings,#openSettings,#closeSettings,#kpPlayerPicker [data-kp-player],#kpProfilePhotoChoose,#kpProfilePhotoReset");
      if (!target) return;
      burst();
      if (target.id === "kpProfilePhotoReset") {
        setTimeout(() => {
          const toast = document.getElementById("toast");
          if (toast && toast.style.display !== "none") toast.textContent = `Imagen por defecto restaurada para ${currentPlayer()}`;
        }, 30);
      }
    }, true);

    window.addEventListener("storage", burst);
    window.addEventListener("kp:profile-photo-change", burst);
    window.addEventListener("kp:profile-photo-sync", burst);
    window.addEventListener("kp:render", burst);
    window.addEventListener("kp:game-render", burst);
    window.addEventListener("kp:statechange", burst);
    window.addEventListener("pageshow", burst);
    window.addEventListener("orientationchange", burst, { passive: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) burst(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
