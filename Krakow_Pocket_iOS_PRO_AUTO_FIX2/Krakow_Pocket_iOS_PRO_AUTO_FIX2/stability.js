(() => {
  "use strict";

  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) viewport.setAttribute("content", "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover");

  if (!document.querySelector('link[data-kp-storybook]')) {
    const skin = document.createElement("link"); skin.rel = "stylesheet"; skin.href = "./storybook.css"; skin.dataset.kpStorybook = "1"; document.head.appendChild(skin);
  }
  if (!document.querySelector('link[data-kp-mobile-hotfix]')) {
    const hotfix = document.createElement("link"); hotfix.rel = "stylesheet"; hotfix.href = "./mobile-hotfix.css?v=20260811a"; hotfix.dataset.kpMobileHotfix = "1"; document.head.appendChild(hotfix);
  }
  if (!document.querySelector('style[data-kp-passive-toast]')) {
    const passiveToast = document.createElement("style"); passiveToast.dataset.kpPassiveToast = "1"; passiveToast.textContent = ".toast,#toast{pointer-events:none!important;user-select:none;-webkit-user-select:none}"; document.head.appendChild(passiveToast);
  }
  if (!window.__kpLandmarkArtLoader && !document.querySelector('script[data-kp-landmark-art]')) {
    window.__kpLandmarkArtLoader = true; const landmarks = document.createElement("script"); landmarks.src = "./landmark-art-fix.js?v=20260811c"; landmarks.async = false; landmarks.dataset.kpLandmarkArt = "1"; document.head.appendChild(landmarks);
  }

  // Album V5 intentionally replaces the previous stack of album-experience + V3/V4
  // patches. One module owns the card, viewer, HTML export, share and print paths.
  // This prevents duplicated dialogs/IDs and guarantees that what is viewed is what
  // is downloaded/shared. Photo-quality remains a separate capture concern.
  if (!window.__kpAlbumPhotoQualityLoader && !document.querySelector('script[data-kp-album-photo-quality]')) {
    window.__kpAlbumPhotoQualityLoader = true;
    const quality = document.createElement("script");
    quality.src = "./album-photo-quality.js?v=20260812a";
    quality.async = false;
    quality.dataset.kpAlbumPhotoQuality = "1";
    document.head.appendChild(quality);
  }
  if (!window.__kpAlbumV5Loader && !document.querySelector('script[data-kp-album-v5]')) {
    window.__kpAlbumV5Loader = true;
    const album = document.createElement("script");
    album.src = "./album-v5.js?v=20260812a";
    album.async = false;
    album.dataset.kpAlbumV5 = "1";
    document.head.appendChild(album);
  }

  try { sessionStorage.setItem("kpMissionMutation", "1"); } catch {}

  const nativeTimeout = window.setTimeout.bind(window);
  const nativeInterval = window.setInterval.bind(window);
  const isLegacyMissionPull = (fn, delay) => typeof fn === "function" && fn.name === "pullMissionStatus" && Number(delay) <= 5000;
  window.setTimeout = function(fn, delay, ...args) { if (isLegacyMissionPull(fn, delay)) return 0; return nativeTimeout(fn, delay, ...args); };
  window.setInterval = function(fn, delay, ...args) { if (isLegacyMissionPull(fn, delay)) return 0; return nativeInterval(fn, delay, ...args); };

  if ("serviceWorker" in navigator) {
    try {
      const proto = Object.getPrototypeOf(navigator.serviceWorker), nativeAdd = proto.addEventListener;
      if (nativeAdd && !proto.__kpStableControllerChange) {
        Object.defineProperty(proto, "__kpStableControllerChange", { value: true });
        proto.addEventListener = function(type, listener, options) {
          if (this === navigator.serviceWorker && type === "controllerchange" && typeof listener === "function") {
            const guarded = function(event) { let requested = false; try { requested = sessionStorage.getItem("kpApplyUpdate") === "1"; } catch {} if (!requested) return; try { sessionStorage.removeItem("kpApplyUpdate"); } catch {} return listener.call(this, event); };
            return nativeAdd.call(this, type, guarded, options);
          }
          return nativeAdd.call(this, type, listener, options);
        };
      }
    } catch (err) { console.warn("Kraków Pocket update guard", err); }
  }
  document.addEventListener("click", event => { if (!event.target.closest?.("#applyUpdate")) return; try { sessionStorage.setItem("kpApplyUpdate", "1"); } catch {} }, true);

  window.KP_STABILITY = {
    version: "3.0",
    automaticReloadsBlocked: true,
    storybookSkin: true,
    passiveToasts: true,
    pageScaleLocked: true,
    mobileLayoutHotfix: true,
    landmarkArtLayer: true,
    inlineLandmarks: true,
    interactiveAlbum: true,
    albumV5Unified: true,
    singleSourceAlbum: true,
    legacyAlbumLayersDisabled: true,
    albumPhotoQuality: true
  };
})();