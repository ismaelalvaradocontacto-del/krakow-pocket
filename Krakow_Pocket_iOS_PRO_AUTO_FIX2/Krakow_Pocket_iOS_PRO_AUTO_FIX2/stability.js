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
  if (!window.__kpAlbumExperienceLoader && !document.querySelector('script[data-kp-album-experience]')) {
    window.__kpAlbumExperienceLoader = true; const album = document.createElement("script"); album.src = "./album-experience.js?v=20260812a"; album.async = false; album.dataset.kpAlbumExperience = "1"; document.head.appendChild(album);
  }
  if (!window.__kpAlbumV3PolishLoader && !document.querySelector('script[data-kp-album-v3-polish]')) {
    window.__kpAlbumV3PolishLoader = true; const polish = document.createElement("script"); polish.src = "./album-v3-polish.js?v=20260812a"; polish.async = false; polish.dataset.kpAlbumV3Polish = "1"; document.head.appendChild(polish);
  }
  if (!window.__kpAlbumIosCompatLoader && !document.querySelector('script[data-kp-album-ios-compat]')) {
    window.__kpAlbumIosCompatLoader = true; const albumCompat = document.createElement("script"); albumCompat.src = "./album-ios-compat.js?v=20260811b"; albumCompat.async = false; albumCompat.dataset.kpAlbumIosCompat = "1"; document.head.appendChild(albumCompat);
  }
  if (!window.__kpAlbumPhotoQualityLoader && !document.querySelector('script[data-kp-album-photo-quality]')) {
    window.__kpAlbumPhotoQualityLoader = true; const quality = document.createElement("script"); quality.src = "./album-photo-quality.js?v=20260812a"; quality.async = false; quality.dataset.kpAlbumPhotoQuality = "1"; document.head.appendChild(quality);
  }

  // Digital album scripts are deliberately sequenced. Dynamic scripts can otherwise
  // finish downloading out of order in Chromium/WebKit. The safety runtime must be
  // active before V4 can paint an iframe; the ambient layer is loaded only after V4.
  function loadAmbientLayer() {
    if (window.__kpAlbumDigitalAmbientLoader || document.querySelector('script[data-kp-album-digital-ambient]')) return;
    window.__kpAlbumDigitalAmbientLoader = true;
    const ambient = document.createElement("script");
    ambient.src = "./album-digital-v4-ambient-fix.js?v=20260812c";
    ambient.async = false;
    ambient.dataset.kpAlbumDigitalAmbient = "1";
    document.head.appendChild(ambient);
  }

  function loadDigitalV4() {
    if (window.__kpAlbumDigitalV4Loader || document.querySelector('script[data-kp-album-digital-v4]')) {
      if (window.KP_ALBUM_DIGITAL_V4) loadAmbientLayer();
      return;
    }
    window.__kpAlbumDigitalV4Loader = true;
    const digital = document.createElement("script");
    digital.src = "./album-digital-v4.js?v=20260812c";
    digital.async = false;
    digital.dataset.kpAlbumDigitalV4 = "1";
    digital.addEventListener("load", loadAmbientLayer, { once: true });
    document.head.appendChild(digital);
  }

  function loadRuntimeThenV4() {
    if (window.KP_ALBUM_DIGITAL_RUNTIME_FIX) { loadDigitalV4(); return; }
    const existing = document.querySelector('script[data-kp-album-digital-runtime-fix]');
    if (existing) { existing.addEventListener("load", loadDigitalV4, { once: true }); return; }
    window.__kpAlbumDigitalRuntimeFixLoader = true;
    const runtimeFix = document.createElement("script");
    runtimeFix.src = "./album-digital-v4-runtime-fix.js?v=20260812c";
    runtimeFix.async = false;
    runtimeFix.dataset.kpAlbumDigitalRuntimeFix = "1";
    runtimeFix.addEventListener("load", loadDigitalV4, { once: true });
    document.head.appendChild(runtimeFix);
  }
  loadRuntimeThenV4();

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
    version: "2.4",
    automaticReloadsBlocked: true,
    storybookSkin: true,
    passiveToasts: true,
    pageScaleLocked: true,
    mobileLayoutHotfix: true,
    landmarkArtLayer: true,
    inlineLandmarks: true,
    interactiveAlbum: true,
    albumExperienceV3: true,
    albumVisualPolish: true,
    albumOfflineCompat: true,
    digitalAlbumV4: true,
    albumPhotoQuality: true,
    digitalAlbumRuntimeStable: true,
    runtimeArmedBeforeV4: true,
    digitalAlbumAmbientStable: true,
    deterministicAlbumLoaderOrder: true
  };
})();