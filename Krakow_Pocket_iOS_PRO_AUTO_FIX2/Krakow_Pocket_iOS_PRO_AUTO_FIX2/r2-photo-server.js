export const MAX_BYTES = 25 * 1024 * 1024;
export const PREFIX = "krakow-pocket/2026/";

export function json(data, status = 200) {
  return Response.json(data, { status, headers:{ "Cache-Control":"no-store" } });
}

export function bucket(context) {
  return context.env?.KP_PHOTOS || null;
}

export function tokenConfigured(context) {
  return String(context.env?.KP_UPLOAD_TOKEN || "").length >= 24;
}

export function authorized(context) {
  const expected = String(context.env?.KP_UPLOAD_TOKEN || "");
  const supplied = String(context.request.headers.get("X-KP-Upload-Token") || "");
  if (expected.length < 24 || supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return diff === 0;
}

export function safeMeta(value, max = 120) {
  return String(value || "").replace(/[\r\n\0]/g, " ").trim().slice(0, max);
}

export function extFor(type) {
  const clean = String(type || "").toLowerCase().split(";")[0].trim();
  return ({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/heic":"heic","image/heif":"heif","image/avif":"avif"})[clean] || "img";
}

export function validKey(key) {
  return typeof key === "string" && key.startsWith(PREFIX) && !key.includes("..") && key.length < 260;
}
