(() => {
"use strict";
if (window.__kpR2PhotoStorage) return;
window.__kpR2PhotoStorage = true;

const VERSION = "1.2";
const STORAGE = "krakowPocketCoop";
const ENDPOINT = "/api/photo";
const pending = { mission:null, auschwitz:null };
let migrating = false;
let frameObserver = null;
let outerObserver = null;

const now = () => new Date().toISOString();
const read = () => { try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); } catch { return {}; } };
const external = value => typeof value === "string" && (/^https?:\/\//i.test(value) || value.startsWith("/api/photo?key="));
const embedded = value => typeof value === "string" && value.startsWith("data:image/");

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw new Error("Unsupported embedded image");
  const bytes = atob(match[2]);
  const out = new Uint8Array(bytes.length);
  for (let i=0;i<bytes.length;i++) out[i] = bytes.charCodeAt(i);
  return new Blob([out], { type:match[1] || "image/jpeg" });
}

function loadDataImage(data) {
  return new Promise((resolve,reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = data;
  });
}

async function tinyPreview(data) {
  if (!embedded(data)) return data;
  try {
    const img = await loadDataImage(data);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const scale = Math.min(1, 520 / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale)), h = Math.max(1, Math.round(ih * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha:false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,w,h);
    ctx.drawImage(img,0,0,w,h);
    return canvas.toDataURL("image/jpeg", .54);
  } catch { return data; }
}

async function health() {
  if (!navigator.onLine) return false;
  try {
    const r = await fetch(`${ENDPOINT}?health=1`, { cache:"no-store" });
    return r.ok && (await r.json())?.ok === true;
  } catch { return false; }
}

async function uploadBlob(blob, meta={}) {
  if (!blob || !String(blob.type || "").startsWith("image/")) throw new Error("Invalid image");
  const headers = {
    "Content-Type": blob.type || "image/jpeg",
    "X-KP-Filename": String(meta.name || "photo").slice(0,120),
    "X-KP-Poi": String(meta.poi || "").slice(0,64)
  };
  const r = await fetch(ENDPOINT, { method:"POST", headers, body:blob });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body?.url) throw new Error(body?.error || `R2 upload ${r.status}`);
  return body;
}

async function uploadFile(file, meta={}) {
  return uploadBlob(file, { ...meta, name:file?.name || meta.name });
}

async function writeExternal(id, previous, uploaded, extra={}) {
  const s = read();
  const current = s.missionEvidence?.[id];
  if (!current || !embedded(current.photo)) return null;
  if (external(current.photoFull) && current.photoKey === uploaded.key) return current;
  const stamp = now();
  const preview = await tinyPreview(current.photo);
  const entry = {
    ...current,
    ...previous,
    photo:preview,
    photoFull:uploaded.url,
    photoKey:uploaded.key,
    photoMime:uploaded.type || "",
    photoSize:Number(uploaded.size || 0),
    photoQuality:"r2-preview-v1",
    photoStorage:"cloudflare-r2",
    updatedAt:stamp
  };
  s.missionEvidence = { ...(s.missionEvidence || {}), [id]:entry };
  s.updatedAt = stamp;
  localStorage.setItem(STORAGE, JSON.stringify(s));
  try { window.dispatchEvent(new CustomEvent("kp:mission-evidence-local", { detail:{ id, entry, r2Storage:true, ...extra } })); } catch {}
  try { window.dispatchEvent(new CustomEvent("kp:statechange", { detail:{ source:"r2-photo-storage", id, ...extra } })); } catch {}
  upgradeVisiblePhotos();
  return entry;
}

function kindForInput(id) {
  if (id === "kpAuschwitzInput") return "auschwitz";
  if (id === "kpProofInput") return "mission";
  return "";
}

document.addEventListener("change", event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const kind = kindForInput(input.id);
  if (!kind) return;
  const file = input.files?.[0];
  if (!file || !String(file.type || "").startsWith("image/")) return;
  pending[kind] = uploadFile(file).catch(error => ({ error }));
}, true);

window.addEventListener("kp:mission-evidence-local", async event => {
  if (event.detail?.r2Storage) return;
  const id = event.detail?.id;
  const entry = event.detail?.entry;
  if (!id || !embedded(entry?.photo)) return;
  const kind = id === "auschwitz" ? "auschwitz" : "mission";
  const task = pending[kind];
  if (!task) return;
  pending[kind] = null;
  const result = await task;
  if (!result?.url) return;
  await writeExternal(id, entry, result, { freshUpload:true });
});

function replacementMap() {
  const map = new Map();
  for (const entry of Object.values(read().missionEvidence || {})) {
    if (embedded(entry?.photo) && external(entry?.photoFull)) map.set(entry.photo, entry.photoFull);
  }
  return map;
}

function upgradeImagesIn(root) {
  if (!root?.querySelectorAll) return;
  const map = replacementMap();
  if (!map.size) return;
  const images = root.matches?.("img") ? [root] : [...root.querySelectorAll("img")];
  for (const img of images) {
    const raw = img.getAttribute("src") || "";
    const full = map.get(raw);
    if (full && raw !== full) img.setAttribute("src", full);
  }
}

function bindFrame(frame) {
  if (!frame) return;
  const apply = () => {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      upgradeImagesIn(doc);
      frameObserver?.disconnect();
      frameObserver = new MutationObserver(records => {
        for (const record of records) {
          if (record.type === "attributes" && record.target instanceof HTMLImageElement) upgradeImagesIn(record.target);
          for (const node of record.addedNodes || []) if (node.nodeType === 1) upgradeImagesIn(node);
        }
      });
      frameObserver.observe(doc.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:["src"] });
    } catch {}
  };
  frame.addEventListener("load", apply);
  apply();
}

function upgradeVisiblePhotos() {
  upgradeImagesIn(document);
  bindFrame(document.getElementById("kpAlbumV5Frame"));
}

function installObservers() {
  outerObserver?.disconnect();
  outerObserver = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof HTMLImageElement) upgradeImagesIn(record.target);
      for (const node of record.addedNodes || []) {
        if (node.nodeType !== 1) continue;
        upgradeImagesIn(node);
        const frame = node.matches?.("#kpAlbumV5Frame") ? node : node.querySelector?.("#kpAlbumV5Frame");
        if (frame) bindFrame(frame);
      }
    }
  });
  outerObserver.observe(document.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:["src"] });
  upgradeVisiblePhotos();
}

async function migrateExisting() {
  if (migrating || !navigator.onLine) return { migrated:0 };
  migrating = true;
  let migrated = 0;
  try {
    if (!(await health())) return { migrated:0, unavailable:true };
    const s = read();
    const entries = Object.entries(s.missionEvidence || {}).filter(([,entry]) => embedded(entry?.photo) && !external(entry?.photoFull));
    for (const [id,entry] of entries) {
      try {
        const blob = dataUrlToBlob(entry.photo);
        const uploaded = await uploadBlob(blob, { name:`legacy-${id}.jpg`, poi:id });
        if (await writeExternal(id, entry, uploaded, { legacyMigration:true })) migrated++;
      } catch (error) {
        console.warn("Kraków Pocket R2 legacy migration", id, error);
      }
    }
    return { migrated };
  } finally { migrating = false; }
}

window.addEventListener("online", () => setTimeout(migrateExisting, 1200));
window.addEventListener("kp:statechange", () => setTimeout(upgradeVisiblePhotos, 0));
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { installObservers(); setTimeout(migrateExisting, 1800); }, { once:true });
else { installObservers(); setTimeout(migrateExisting, 1800); }

window.KP_PHOTO_STORAGE = {
  version:VERSION,
  provider:"cloudflare-r2",
  endpoint:ENDPOINT,
  external,
  embedded,
  health,
  uploadFile,
  migrateExisting,
  upgradeVisiblePhotos,
  originalUploads:true,
  localPreviewOnly:true,
  legacyCompatible:true
};
})();
