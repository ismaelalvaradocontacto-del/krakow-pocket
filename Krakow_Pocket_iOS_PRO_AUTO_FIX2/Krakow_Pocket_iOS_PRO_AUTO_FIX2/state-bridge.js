(() => {
  "use strict";
  if (window.__kpStateBridge) return;
  window.__kpStateBridge = true;

  const STORAGE = "krakowPocketCoop";
  const nativeFetch = window.fetch.bind(window);
  const nativeSetItem = Storage.prototype.setItem;
  const now = () => new Date().toISOString();
  const parse = value => { try { return JSON.parse(value || "{}"); } catch { return null; } };
  const ts = value => { const n = new Date(value || 0).getTime(); return Number.isFinite(n) ? n : 0; };
  const read = () => parse(localStorage.getItem(STORAGE)) || {};

  function mergeTimed(a = {}, b = {}) {
    const out = {};
    for (const src of [a, b]) {
      for (const [id, op] of Object.entries(src || {})) {
        if (!op || typeof op !== "object") continue;
        const prev = out[id];
        if (!prev || ts(op.updatedAt) >= ts(prev.updatedAt)) out[id] = { ...op };
      }
    }
    return out;
  }

  function applyStatus(state) {
    state = state && typeof state === "object" ? state : {};
    if (!Array.isArray(state.visited)) state.visited = [];
    const visited = new Set(state.visited);
    for (const [id, op] of Object.entries(state.missionStatus || {})) {
      if (!op || typeof op !== "object") continue;
      if (op.done) visited.add(id); else visited.delete(id);
    }
    for (const [id, op] of Object.entries(state.discoveryStatus || {})) {
      if (!op || typeof op !== "object") continue;
      if (op.done) visited.add(id); else visited.delete(id);
    }
    state.visited = [...visited];
    return state;
  }

  function mergeLocalStatus(state, local = read()) {
    state = state && typeof state === "object" ? { ...state } : {};
    state.missionStatus = mergeTimed(state.missionStatus || {}, local.missionStatus || {});
    state.discoveryStatus = mergeTimed(state.discoveryStatus || {}, local.discoveryStatus || {});
    return applyStatus(state);
  }

  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === STORAGE) {
      const incoming = parse(value);
      if (incoming) value = JSON.stringify(mergeLocalStatus(incoming));
    }
    return nativeSetItem.call(this, key, value);
  };

  function isRpc(url, name) {
    return typeof url === "string" && url.includes(`/rest/v1/rpc/${name}`);
  }

  window.fetch = async function(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    let next = init ? { ...init } : {};

    if (isRpc(url, "adventure_put") && next.body) {
      try {
        const payload = JSON.parse(next.body);
        if (payload?.p_state) {
          payload.p_state = mergeLocalStatus(payload.p_state);
          next.body = JSON.stringify(payload);
        }
      } catch {}
      return nativeFetch(input, next);
    }

    if (!isRpc(url, "adventure_get")) return nativeFetch(input, next);

    const response = await nativeFetch(input, next);
    if (!response.ok) return response;

    let remote;
    try { remote = JSON.parse(await response.clone().text() || "{}"); }
    catch { return response; }
    if (!remote || typeof remote !== "object") return response;

    const before = JSON.stringify({
      v: remote.visited || [],
      m: remote.missionStatus || {},
      d: remote.discoveryStatus || {}
    });
    const merged = mergeLocalStatus(remote);
    const after = JSON.stringify({
      v: merged.visited || [],
      m: merged.missionStatus || {},
      d: merged.discoveryStatus || {}
    });

    if (before !== after && next.body) {
      try {
        const auth = JSON.parse(next.body);
        const putUrl = url.replace(/adventure_get(?:\?.*)?$/, "adventure_put");
        const putBody = JSON.stringify({ ...auth, p_state: { ...merged, updatedAt: now() } });
        window.fetch(putUrl, {
          method: "POST",
          headers: next.headers || { "Content-Type": "application/json" },
          body: putBody
        }).catch(() => {});
      } catch {}
    }

    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(merged), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };

  window.KP_STATE_BRIDGE = {
    version: "1.1",
    reversibleDiscoveries: true,
    normalize: state => mergeLocalStatus(state)
  };
})();
if(!window.__kpNetworkStatusLoader){window.__kpNetworkStatusLoader=true;document.write('<script src="./network-status.js?v=20260810n" data-kp-network-status="1"><\/script>')}
if(!window.__kpInteractionFixLoader){window.__kpInteractionFixLoader=true;document.write('<script src="./interaction-fix.js?v=20260810m" data-kp-interaction-fix="1"><\/script>')}
