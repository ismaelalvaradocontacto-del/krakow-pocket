(() => {
"use strict";
if (window.__kpAlbumPhotoQuality) return;
window.__kpAlbumPhotoQuality = true;

function loadR2Storage() {
  if (window.__kpR2PhotoStorageLoader || document.querySelector('script[data-kp-r2-photo-storage]')) return;
  window.__kpR2PhotoStorageLoader = true;
  const storage = document.createElement("script");
  storage.src = "./photo-storage-r2.js?v=20260813b";
  storage.async = false;
  storage.dataset.kpR2PhotoStorage = "1";
  document.head.appendChild(storage);
}

if (!window.__kpR2PhotoAuthLoader && !document.querySelector('script[data-kp-r2-photo-auth]')) {
  window.__kpR2PhotoAuthLoader = true;
  const auth = document.createElement("script");
  auth.src = "./photo-storage-auth.js?v=20260813a";
  auth.async = false;
  auth.dataset.kpR2PhotoAuth = "1";
  auth.onload = loadR2Storage;
  auth.onerror = loadR2Storage;
  document.head.appendChild(auth);
} else {
  loadR2Storage();
}

const VERSION = "1.3";
const STORAGE = "krakowPocketCoop";
const TARGET_MAX = 1280;
const MAX_DATA_LENGTH = 220000;
const SOFT_STATE_LIMIT = 2600000;
let pendingMission = null;
let pendingExtra = null;
let applying = false;

const read = () => { try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); } catch { return {}; } };
const stamp = () => new Date().toISOString();
const externalPhoto = value => typeof value === "string" && (/^https?:\/\//i.test(value) || value.startsWith("/api/photo?key="));

function loadImage(file) {
  return new Promise((resolve,reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = e => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function jpeg(img, max, quality) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const scale = Math.min(1, max / Math.max(iw, ih));
  const width = Math.max(1, Math.round(iw * scale)), height = Math.max(1, Math.round(ih * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", {alpha:false});
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,width,height);
  ctx.drawImage(img,0,0,width,height);
  return {data:canvas.toDataURL("image/jpeg", quality), width, height};
}

async function prepare(file) {
  const img = await loadImage(file);
  let out = jpeg(img, TARGET_MAX, .82);
  if (out.data.length > MAX_DATA_LENGTH) out = jpeg(img, 1120, .79);
  if (out.data.length > MAX_DATA_LENGTH) out = jpeg(img, 960, .75);
  if (out.data.length > MAX_DATA_LENGTH) out = jpeg(img, 820, .72);
  return {...out, quality:"album-hq-v1"};
}

function captureInput(input) {
  const file = input.files?.[0];
  if (!file || !file.type?.startsWith("image/")) return;
  const promise = prepare(file).catch(() => null);
  if (input.id === "kpAuschwitzInput") pendingExtra = promise;
  if (input.id === "kpProofInput") pendingMission = promise;
}

document.addEventListener("change", e => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.id !== "kpProofInput" && input.id !== "kpAuschwitzInput") return;
  captureInput(input);
}, true);

async function upgradeEvidence(id, entry) {
  if (applying || !id || !entry?.photo) return;
  if (entry.photoStorage === "cloudflare-r2" || entry.photoQuality === "r2-original-v1" || externalPhoto(entry.photo)) {
    if (id === "auschwitz") pendingExtra = null; else pendingMission = null;
    return;
  }
  if (entry.photoQuality === "storage-adaptive-v1" || entry.photoQuality === "storage-reclaimed-v1") {
    if (id === "auschwitz") pendingExtra = null; else pendingMission = null;
    return;
  }
  const source = id === "auschwitz" ? pendingExtra : pendingMission;
  if (!source) return;
  const high = await source;
  if (id === "auschwitz") pendingExtra = null; else pendingMission = null;
  if (!high?.data || high.data === entry.photo) return;
  const state = read(), current = state.missionEvidence?.[id];
  if (!current?.photo || current.photoStorage === "cloudflare-r2" || externalPhoto(current.photo)) return;
  let currentSize = 0; try { currentSize = JSON.stringify(state).length; } catch {}
  if (currentSize > SOFT_STATE_LIMIT) return;
  const updatedAt = stamp();
  const upgraded = {
    ...current,
    photo:high.data,
    photoWidth:high.width,
    photoHeight:high.height,
    photoQuality:high.quality,
    updatedAt
  };
  const next = {...state, missionEvidence:{...(state.missionEvidence||{}), [id]:upgraded}, updatedAt};
  let payload = ""; try { payload = JSON.stringify(next); } catch { return; }
  if (payload.length > SOFT_STATE_LIMIT) return;
  try {
    applying = true;
    localStorage.setItem(STORAGE, payload);
  } catch {
    applying = false;
    return;
  }
  applying = false;
  try { window.dispatchEvent(new CustomEvent("kp:mission-evidence-local", {detail:{id,entry:upgraded,qualityUpgrade:true}})); } catch {}
  try { window.dispatchEvent(new CustomEvent("kp:statechange", {detail:{source:"album-photo-quality",id}})); } catch {}
  setTimeout(() => {
    try { document.getElementById("dailyTarget")?.dispatchEvent(new Event("change", {bubbles:true})); } catch {}
  }, 120);
}

window.addEventListener("kp:mission-evidence-local", e => {
  if (applying || e.detail?.qualityUpgrade || e.detail?.r2Storage) return;
  upgradeEvidence(e.detail?.id, e.detail?.entry);
});

window.KP_ALBUM_PHOTO_QUALITY = {
  version: VERSION,
  targetMax: TARGET_MAX,
  maxDataLength: MAX_DATA_LENGTH,
  softStateLimit: SOFT_STATE_LIMIT,
  qualityTag: "album-hq-v1",
  highQualityFuturePhotos: true,
  r2OriginalLayer: true,
  storageSafeFallback: true,
  noUpscaling: true
};
})();