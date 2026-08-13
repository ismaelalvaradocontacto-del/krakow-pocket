const MAX_BYTES = 25 * 1024 * 1024;
const PREFIX = "krakow-pocket/2026/";
const ADVENTURE = "WAWEL-ISMAEL-LAURA";
const APP_SECRET = "krakow2026";

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }
});

function bucket(context) {
  return context.env?.KP_PHOTOS || null;
}

function authorized(request) {
  return request.headers.get("X-KP-Adventure") === ADVENTURE && request.headers.get("X-KP-Secret") === APP_SECRET;
}

function safeMeta(value, max = 120) {
  return String(value || "").replace(/[\r\n\0]/g, " ").trim().slice(0, max);
}

function extFor(type) {
  const clean = String(type || "").toLowerCase().split(";")[0].trim();
  return ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif"
  })[clean] || "img";
}

function validKey(key) {
  return typeof key === "string" && key.startsWith(PREFIX) && !key.includes("..") && key.length < 260;
}

export async function onRequestGet(context) {
  const store = bucket(context);
  if (!store) return json({ ok: false, error: "R2 binding KP_PHOTOS is not configured" }, 503);

  const url = new URL(context.request.url);
  if (url.searchParams.get("health") === "1") return json({ ok: true, storage: "r2" });

  const key = url.searchParams.get("key") || "";
  if (!validKey(key)) return json({ ok: false, error: "Invalid photo key" }, 400);

  const object = await store.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}

export async function onRequestPost(context) {
  const store = bucket(context);
  if (!store) return json({ ok: false, error: "R2 binding KP_PHOTOS is not configured" }, 503);
  if (!authorized(context.request)) return json({ ok: false, error: "Unauthorized" }, 401);

  const type = String(context.request.headers.get("Content-Type") || "").toLowerCase().split(";")[0].trim();
  if (!type.startsWith("image/")) return json({ ok: false, error: "Only images are accepted" }, 415);

  const declared = Number(context.request.headers.get("Content-Length") || 0);
  if (declared > MAX_BYTES) return json({ ok: false, error: "Image is too large" }, 413);

  const bytes = await context.request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return json({ ok: false, error: "Image is empty or too large" }, bytes.byteLength ? 413 : 400);

  const id = crypto.randomUUID();
  const key = `${PREFIX}${Date.now()}-${id}.${extFor(type)}`;
  const originalName = safeMeta(context.request.headers.get("X-KP-Filename"));
  const poi = safeMeta(context.request.headers.get("X-KP-Poi"), 64);

  await store.put(key, bytes, {
    httpMetadata: {
      contentType: type,
      cacheControl: "public, max-age=31536000, immutable"
    },
    customMetadata: {
      source: "krakow-pocket",
      originalName,
      poi
    }
  });

  return json({
    ok: true,
    key,
    url: `/api/photo?key=${encodeURIComponent(key)}`,
    size: bytes.byteLength,
    type
  }, 201);
}

export async function onRequestDelete(context) {
  const store = bucket(context);
  if (!store) return json({ ok: false, error: "R2 binding KP_PHOTOS is not configured" }, 503);
  if (!authorized(context.request)) return json({ ok: false, error: "Unauthorized" }, 401);

  const url = new URL(context.request.url);
  const key = url.searchParams.get("key") || "";
  if (!validKey(key)) return json({ ok: false, error: "Invalid photo key" }, 400);
  await store.delete(key);
  return json({ ok: true });
}
