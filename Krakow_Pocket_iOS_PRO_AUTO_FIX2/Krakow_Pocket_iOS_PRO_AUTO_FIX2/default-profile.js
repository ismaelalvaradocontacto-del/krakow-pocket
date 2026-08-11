(() => {
  "use strict";
  if (window.__kpDefaultProfileImage) return;
  window.__kpDefaultProfileImage = true;

  const STORAGE = "krakowPocketCoop";
  const PLAYER_KEY = "krakowPlayer";
  const DEFAULT_AVATAR = "data:image/jpeg;base64,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";
  let raf = 0;

  const currentPlayer = () => localStorage.getItem(PLAYER_KEY) === "Laura" ? "Laura" : "Ismael";

  function state() {
    try { return JSON.parse(localStorage.getItem(STORAGE) || "{}") || {}; }
    catch { return {}; }
  }

  function customPhoto(name) {
    const value = state().profilePhotos?.[name]?.dataUrl;
    return typeof value === "string" && value.startsWith("data:image/");
  }

  function playerForHost(host) {
    return host?.dataset?.kpProfile || host?.closest?.("[data-kp-player]")?.dataset?.kpPlayer || "";
  }

  function ensureStyles() {
    if (document.querySelector("style[data-kp-default-profile]")) return;
    const style = document.createElement("style");
    style.dataset.kpDefaultProfile = "1";
    style.textContent = `
      .kp-profile-face,.kp-picker-face{position:relative!important;overflow:hidden!important}
      .kp-profile-default{
        position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
        object-fit:cover!important;object-position:center!important;border-radius:inherit!important;
        display:block!important;pointer-events:none!important;z-index:4!important;background:#eee!important;
      }
      .kp-profile-photo{z-index:6!important}
      #kpProfilePhotoPreview{position:relative!important;overflow:hidden!important}
      #kpProfilePhotoPreview>.kp-profile-default{z-index:1!important}
      #kpProfilePhotoPreview>img:not(.kp-profile-default){z-index:2!important}
      #kpProfilePhotoPreview>.kp-profile-default~svg{visibility:hidden!important}
    `;
    document.head.appendChild(style);
  }

  function paintHost(host) {
    if (!host) return;
    const name = playerForHost(host);
    if (!name) return;
    let img = host.querySelector(":scope > .kp-profile-default");
    if (customPhoto(name) || host.querySelector(":scope > .kp-profile-photo")) {
      img?.remove();
      return;
    }
    if (!img) {
      img = document.createElement("img");
      img.className = "kp-profile-default";
      img.src = DEFAULT_AVATAR;
      img.alt = `Imagen de perfil por defecto de ${name}`;
      img.decoding = "async";
      img.draggable = false;
      host.appendChild(img);
    }
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
    let img = preview.querySelector(":scope > .kp-profile-default");
    if (customPhoto(name) || preview.querySelector(":scope > img:not(.kp-profile-default)")) {
      img?.remove();
      return;
    }
    if (!img) {
      img = document.createElement("img");
      img.className = "kp-profile-default";
      img.src = DEFAULT_AVATAR;
      img.alt = "";
      preview.appendChild(img);
    }
  }

  function paint() {
    raf = 0;
    ensureStyles();
    document.querySelectorAll(
      '#kpGameHud .kp-profile-face[data-kp-profile], #kpPlayerPicker [data-kp-player] .kp-picker-face'
    ).forEach(paintHost);
    paintManager();
    window.KP_DEFAULT_PROFILE = {
      version: "1.0",
      genericDefault: true,
      replacesIllustratedProfileFallback: true,
      dataUrl: DEFAULT_AVATAR
    };
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(paint);
  }

  function boot() {
    ensureStyles();
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", event => {
      if (event.target.closest?.("#kpProfilePhotoReset")) {
        setTimeout(() => {
          const toast = document.getElementById("toast");
          if (toast && toast.style.display !== "none") toast.textContent = `Imagen por defecto restaurada para ${currentPlayer()}`;
          schedule();
        }, 20);
      }
      if (event.target.closest?.("#kpPlayerPicker [data-kp-player],#kpGameSettings,#openSettings")) setTimeout(schedule, 30);
    }, true);
    window.addEventListener("storage", schedule);
    window.addEventListener("kp:profile-photo-change", schedule);
    window.addEventListener("kp:profile-photo-sync", schedule);
    window.addEventListener("kp:render", schedule);
    window.addEventListener("kp:game-render", schedule);
    window.addEventListener("pageshow", schedule);
    [50,150,400,900,1800,3200].forEach(ms => setTimeout(schedule, ms));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();
})();
