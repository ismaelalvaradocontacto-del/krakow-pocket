export async function onRequestGet(context) {
  const store = context.env?.KP_PHOTOS || null;
  if (!store) {
    return Response.json({ ok:false, storage:"r2", binding:false }, { status:503 });
  }
  return Response.json({ ok:true, storage:"r2", binding:true });
}
