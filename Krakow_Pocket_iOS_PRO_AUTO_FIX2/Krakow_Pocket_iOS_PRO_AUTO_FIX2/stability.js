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

  let albumFrame = null;
  let albumScrollY = 0;
  let albumScrollIntent = null;
  let albumScrollBoundDocument = null;
  const captureAlbumScroll = frame => {
    if (albumScrollIntent != null) {
      albumScrollY = Math.max(0, Number(albumScrollIntent) || 0);
      return albumScrollY;
    }
    try {
      const win = frame?.contentWindow;
      if (win) albumScrollY = Math.max(0, Number(win.scrollY) || 0);
    } catch {}
    return albumScrollY;
  };
  const bindAlbumInnerDocument = frame => {
    const win = frame?.contentWindow, doc = frame?.contentDocument;
    if (!win || !doc || albumScrollBoundDocument === doc) return;
    albumScrollBoundDocument = doc;
    const capture = () => captureAlbumScroll(frame);
    win.addEventListener("scroll", capture, { passive:true });
    win.addEventListener("pagehide", capture, { passive:true });
    win.addEventListener("beforeunload", capture);
    doc.addEventListener("visibilitychange", () => { if (doc.visibilityState === "hidden") capture(); }, { passive:true });
  };
  const restoreAlbumScroll = frame => {
    const win = frame?.contentWindow, doc = frame?.contentDocument;
    if (!win || !doc?.documentElement) return;
    const target = Math.max(0, Number(albumScrollIntent != null ? albumScrollIntent : albumScrollY) || 0);
    albumScrollY = target;
    const root = doc.documentElement;
    const previousInline = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    const restore = () => { try { win.scrollTo(0, target); } catch {} };
    restore();
    try { win.requestAnimationFrame(() => { restore(); win.requestAnimationFrame(restore); }); } catch {}
    [50, 120, 240, 420].forEach(delay => setTimeout(restore, delay));
    setTimeout(() => { try { root.style.scrollBehavior = previousInline; } catch {} }, 460);
    bindAlbumInnerDocument(frame);
  };
  const bindAlbumFrame = () => {
    const frame = document.getElementById("kpAlbumV5Frame");
    if (!frame || frame === albumFrame) return;
    albumFrame = frame;
    frame.addEventListener("load", () => {
      albumScrollBoundDocument = null;
      restoreAlbumScroll(frame);
      albumScrollIntent = null;
    });
    const dialog = document.getElementById("kpAlbumV5Dialog");
    dialog?.addEventListener("close", () => {
      albumScrollY = 0;
      albumScrollIntent = null;
      albumScrollBoundDocument = null;
    });
    bindAlbumInnerDocument(frame);
    restoreAlbumScroll(frame);
  };
  const albumObserver = new MutationObserver(bindAlbumFrame);
  albumObserver.observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener("kp:album-scroll-intent", event => {
    const y = Math.max(0, Number(event?.detail?.y) || 0);
    albumScrollY = y;
    albumScrollIntent = y;
  });
  document.addEventListener("click", event => {
    if (event.target.closest?.("#kpAlbumV5Open")) { albumScrollY = 0; albumScrollIntent = 0; }
    if (event.target.closest?.("#kpAlbumV5Close")) { albumScrollY = 0; albumScrollIntent = null; }
  }, true);
  bindAlbumFrame();

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
    version: "3.1",
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
    albumPhotoQuality: true,
    albumSafariIframeScrollGuard: true,
    albumIframePerDocumentBinding: true,
    albumIframePagehideCapture: true,
    albumScrollIntentProtocol: true,
    albumIframeGuardRevision: "20260812b"
  };
})();