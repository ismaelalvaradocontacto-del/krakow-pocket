import { MAX_BYTES, PREFIX, json, bucket, tokenConfigured, authorized, safeMeta, extFor, validKey } from "../../r2-photo-server.js";

export async function onRequestGet(context) {
  const store = bucket(context);
  if (!store) return json({ ok:false, storage:"r2", binding:false }, 503);
  const url = new URL(context.request.url);
  if (url.searchParams.get("health") === "1") {
    return json({ ok:true, storage:"r2", binding:true, uploadProtected:tokenConfigured(context) });
  }
  const key = url.searchParams.get("key") || "";
  if (!validKey(key)) return json({ ok:false, error:"Invalid photo key" }, 400);
  const object = await store.get(key);
  if (!object) return new Response("Not found", { status:404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}

export async function onRequestPost(context) {
  const store = bucket(context);
  if (!store) return json({ ok:false, error:"R2 binding KP_PHOTOS is not configured" }, 503);
  if (!tokenConfigured(context)) return json({ ok:false, error:"Upload token is not configured" }, 503);
  if (!authorized(context)) return json({ ok:false, error:"Unauthorized" }, 401);
  const type = String(context.request.headers.get("Content-Type") || "").toLowerCase().split(";")[0].trim();
  if (!type.startsWith("image/")) return json({ ok:false, error:"Only images are accepted" }, 415);
  const declared = Number(context.request.headers.get("Content-Length") || 0);
  if (declared > MAX_BYTES) return json({ ok:false, error:"Image is too large" }, 413);
  const bytes = await context.request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return json({ ok:false, error:"Image is empty or too large" }, bytes.byteLength ? 413 : 400);
  const key = `${PREFIX}${Date.now()}-${crypto.randomUUID()}.${extFor(type)}`;
  await store.put(key, bytes, {
    httpMetadata:{ contentType:type, cacheControl:"public, max-age=31536000, immutable" },
    customMetadata:{
      source:"krakow-pocket",
      originalName:safeMeta(context.request.headers.get("X-KP-Filename")),
      poi:safeMeta(context.request.headers.get("X-KP-Poi"), 64)
    }
  });
  return json({ ok:true, key, url:`/api/photo?key=${encodeURIComponent(key)}`, size:bytes.byteLength, type }, 201);
}

export async function onRequestDelete(context) {
  const store = bucket(context);
  if (!store) return json({ ok:false, error:"R2 binding KP_PHOTOS is not configured" }, 503);
  if (!tokenConfigured(context)) return json({ ok:false, error:"Upload token is not configured" }, 503);
  if (!authorized(context)) return json({ ok:false, error:"Unauthorized" }, 401);
  const key = new URL(context.request.url).searchParams.get("key") || "";
  if (!validKey(key)) return json({ ok:false, error:"Invalid photo key" }, 400);
  await store.delete(key);
  return json({ ok:true });
}
