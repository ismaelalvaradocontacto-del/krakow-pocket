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
  let albumScrollAnchor = null;
  let albumScrollBoundDocument = null;
  let albumRestoreEpoch = 0;
  const albumNextOwnsScroll = () => window.KP_ALBUM_NEXT?.version === "6.0";
  const albumAnchorFor = (frame, y) => {
    try {
      const doc = frame?.contentDocument, win = frame?.contentWindow;
      if (!doc || !win) return null;
      const scrollY = Math.max(0, Number(y ?? win.scrollY) || 0);
      if (scrollY <= 4) return { kind:"top", offset:0, fallback:0 };
      const candidates = [...doc.querySelectorAll('.photo-card,.memory-card,.chapter,#albumIndex,.stats-wrap')];
      let best = null;
      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        if (r.bottom <= 0 || r.top > Math.min(180, win.innerHeight * .3)) continue;
        if (!best || r.top > best.rect.top) best = { el, rect:r };
      }
      if (!best) return { kind:"pixel", offset:0, fallback:scrollY };
      const el = best.el;
      let kind = "pixel", key = "";
      if (el.classList.contains("photo-card")) { kind="photo"; key=el.getAttribute("data-photo-index") || ""; }
      else if (el.classList.contains("memory-card")) { kind="memory"; key=String([...doc.querySelectorAll('.memory-card')].indexOf(el)); }
      else if (el.classList.contains("chapter")) { kind="id"; key=el.id || ""; }
      else if (el.id) { kind="id"; key=el.id; }
      return { kind, key, offset:scrollY - el.offsetTop, fallback:scrollY };
    } catch { return null; }
  };
  const albumTargetFor = (frame, anchor, fallback) => {
    try {
      const doc = frame?.contentDocument;
      if (!doc) return Math.max(0, Number(fallback)||0);
      if (!anchor || anchor.kind === "pixel") return Math.max(0, Number(anchor?.fallback ?? fallback)||0);
      if (anchor.kind === "top") return 0;
      let el = null;
      if (anchor.kind === "photo") el = [...doc.querySelectorAll('.photo-card')].find(x => (x.getAttribute('data-photo-index')||"") === String(anchor.key));
      else if (anchor.kind === "memory") el = doc.querySelectorAll('.memory-card')[Number(anchor.key)] || null;
      else if (anchor.kind === "id" && anchor.key) el = doc.getElementById(anchor.key);
      if (!el) return Math.max(0, Number(anchor.fallback ?? fallback)||0);
      return Math.max(0, el.offsetTop + (Number(anchor.offset)||0));
    } catch { return Math.max(0, Number(fallback)||0); }
  };
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
  const cancelAlbumRestore = frame => {
    albumRestoreEpoch += 1;
    albumScrollIntent = null;
    albumScrollAnchor = null;
    try { albumScrollY = Math.max(0, Number(frame?.contentWindow?.scrollY) || 0); } catch {}
  };
  const bindAlbumInnerDocument = frame => {
    const win = frame?.contentWindow, doc = frame?.contentDocument;
    if (!win || !doc || albumScrollBoundDocument === doc) return;
    albumScrollBoundDocument = doc;
    const capture = () => captureAlbumScroll(frame);
    const userCancel = () => cancelAlbumRestore(frame);
    win.addEventListener("scroll", capture, { passive:true });
    win.addEventListener("pagehide", capture, { passive:true });
    win.addEventListener("beforeunload", capture);
    win.addEventListener("wheel", userCancel, { passive:true, capture:true });
    win.addEventListener("touchstart", userCancel, { passive:true, capture:true });
    win.addEventListener("pointerdown", userCancel, { passive:true, capture:true });
    win.addEventListener("keydown", event => {
      if (["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," "].includes(event.key)) userCancel();
    }, true);
    doc.addEventListener("visibilitychange", () => { if (doc.visibilityState === "hidden") capture(); }, { passive:true });
  };
  const restoreAlbumScroll = frame => {
    const win = frame?.contentWindow, doc = frame?.contentDocument;
    if (!win || !doc?.documentElement) return;
    const epoch = ++albumRestoreEpoch;
    const intended = Math.max(0, Number(albumScrollIntent != null ? albumScrollIntent : albumScrollY) || 0);
    const anchor = albumScrollAnchor;
    const root = doc.documentElement;
    const previousInline = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    const restore = () => {
      if (epoch !== albumRestoreEpoch) return;
      try {
        const target = albumTargetFor(frame, anchor, intended);
        win.scrollTo(0, target);
        albumScrollY = target;
      } catch {}
    };
    restore();
    try { win.requestAnimationFrame(() => { restore(); win.requestAnimationFrame(restore); }); } catch {}
    const delays = albumNextOwnsScroll() ? [70, 160, 300, 480] : [50, 120, 240, 420];
    delays.forEach(delay => setTimeout(restore, delay));
    setTimeout(() => {
      if (epoch === albumRestoreEpoch) {
        albumScrollIntent = null;
        albumScrollAnchor = null;
      }
      try { root.style.scrollBehavior = previousInline; } catch {}
    }, Math.max(...delays)+40);
    bindAlbumInnerDocument(frame);
  };
  const bindAlbumFrame = () => {
    const frame = document.getElementById("kpAlbumV5Frame");
    if (!frame || frame === albumFrame) return;
    albumFrame = frame;
    frame.addEventListener("load", () => {
      albumScrollBoundDocument = null;
      restoreAlbumScroll(frame);
    });
    const dialog = document.getElementById("kpAlbumV5Dialog");
    dialog?.addEventListener("close", () => {
      albumRestoreEpoch += 1;
      albumScrollY = 0;
      albumScrollIntent = null;
      albumScrollAnchor = null;
      albumScrollBoundDocument = null;
    });
    bindAlbumInnerDocument(frame);
    restoreAlbumScroll(frame);
  };
  const albumObserver = new MutationObserver(bindAlbumFrame);
  albumObserver.observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener("kp:album-scroll-intent", event => {
    const y = Math.max(0, Number(event?.detail?.y) || 0);
    albumRestoreEpoch += 1;
    albumScrollAnchor = albumAnchorFor(albumFrame, y);
    albumScrollY = y;
    albumScrollIntent = y;
  });
  document.addEventListener("click", event => {
    if (event.target.closest?.("#kpAlbumV5Open")) { albumRestoreEpoch += 1; albumScrollY = 0; albumScrollIntent = 0; albumScrollAnchor = {kind:"top",offset:0,fallback:0}; }
    if (event.target.closest?.("#kpAlbumV5Close")) { albumRestoreEpoch += 1; albumScrollY = 0; albumScrollIntent = null; albumScrollAnchor = null; }
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
    version: "3.3",
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
    albumNextOwnsScrollRestore: true,
    albumSemanticScrollAnchor: true,
    albumUserScrollCancelsRestore: true,
    albumIframeGuardRevision: "20260812c"
  };
})();