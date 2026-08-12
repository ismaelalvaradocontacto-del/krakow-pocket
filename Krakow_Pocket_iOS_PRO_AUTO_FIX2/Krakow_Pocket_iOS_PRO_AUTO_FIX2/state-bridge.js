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
    state.profilePhotos = mergeTimed(state.profilePhotos || {}, local.profilePhotos || {});
    state.missionEvidence = mergeTimed(state.missionEvidence || {}, local.missionEvidence || {});
    return applyStatus(state);
  }

  function adoptMergedProfilePhotos(merged) {
    const local = read();
    const nextPhotos = merged?.profilePhotos || {};
    if (JSON.stringify(local.profilePhotos || {}) === JSON.stringify(nextPhotos)) return false;
    const nextLocal = { ...local, profilePhotos: nextPhotos, updatedAt: merged?.updatedAt || local.updatedAt || now() };
    nativeSetItem.call(localStorage, STORAGE, JSON.stringify(nextLocal));
    try { window.dispatchEvent(new CustomEvent("kp:profile-photo-sync", { detail: { profilePhotos: JSON.parse(JSON.stringify(nextPhotos)) } })); } catch {}
    return true;
  }

  function adoptMergedMissionEvidence(merged) {
    const local = read();
    const nextEvidence = merged?.missionEvidence || {};
    if (JSON.stringify(local.missionEvidence || {}) === JSON.stringify(nextEvidence)) return false;
    const nextLocal = { ...local, missionEvidence: nextEvidence, updatedAt: merged?.updatedAt || local.updatedAt || now() };
    nativeSetItem.call(localStorage, STORAGE, JSON.stringify(nextLocal));
    try { window.dispatchEvent(new CustomEvent("kp:mission-evidence-sync", { detail: { missionEvidence: JSON.parse(JSON.stringify(nextEvidence)) } })); } catch {}
    return true;
  }

  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === STORAGE) {
      const incoming = parse(value);
      if (incoming) value = JSON.stringify(mergeLocalStatus(incoming));
    }
    return nativeSetItem.call(this, key, value);
  };

  function isRpc(url, name) { return typeof url === "string" && url.includes(`/rest/v1/rpc/${name}`); }

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

    const before = JSON.stringify({ v: remote.visited || [], m: remote.missionStatus || {}, d: remote.discoveryStatus || {}, p: remote.profilePhotos || {}, e: remote.missionEvidence || {} });
    const merged = mergeLocalStatus(remote);
    adoptMergedProfilePhotos(merged);
    adoptMergedMissionEvidence(merged);
    const after = JSON.stringify({ v: merged.visited || [], m: merged.missionStatus || {}, d: merged.discoveryStatus || {}, p: merged.profilePhotos || {}, e: merged.missionEvidence || {} });

    if (before !== after && next.body) {
      try {
        const auth = JSON.parse(next.body);
        const putUrl = url.replace(/adventure_get(?:\?.*)?$/, "adventure_put");
        const putBody = JSON.stringify({ ...auth, p_state: { ...merged, updatedAt: now() } });
        window.fetch(putUrl, { method: "POST", headers: next.headers || { "Content-Type": "application/json" }, body: putBody }).catch(() => {});
      } catch {}
    }

    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(merged), { status: response.status, statusText: response.statusText, headers });
  };

  window.KP_STATE_BRIDGE = {
    version: "1.5",
    reversibleDiscoveries: true,
    sharedProfilePhotos: true,
    immediateRemoteProfileAdoption: true,
    sharedMissionEvidence: true,
    immediateRemoteMissionEvidenceAdoption: true,
    simplifiedProfileRuntime: true,
    proofOnlyAlbumSources: true,
    normalize: state => mergeLocalStatus(state)
  };
})();
if(!window.__kpProfilePhotoLoader){window.__kpProfilePhotoLoader=true;document.write('<script src="./profile-photo.js?v=20260811f" data-kp-profile-photo="1"><\/script>')}
if(!window.__kpNetworkStatusLoader){window.__kpNetworkStatusLoader=true;document.write('<script src="./network-status.js?v=20260810n" data-kp-network-status="1"><\/script>')}
if(!window.__kpWorldArtStabilityLoader){window.__kpWorldArtStabilityLoader=true;document.write('<script src="./world-art-stability.js?v=20260810q" data-kp-world-art-stability="1"><\/script>')}
if(!window.__kpInteractionFixLoader){window.__kpInteractionFixLoader=true;document.write('<script src="./interaction-fix.js?v=20260810p" data-kp-interaction-fix="1"><\/script>')}
if(!window.__kpMissionProofLoader){window.__kpMissionProofLoader=true;document.write('<script src="./mission-proof.js?v=20260812c" data-kp-mission-proof="1"><\/script>')}
if(!window.__kpMissionProofGuardLoader){window.__kpMissionProofGuardLoader=true;document.write('<script src="./mission-proof-guard.js?v=20260811a" data-kp-mission-proof-guard="1"><\/script>')}
if(!window.__kpAuschwitzExtraLoader){window.__kpAuschwitzExtraLoader=true;document.write('<script src="./auschwitz-extra.js?v=20260812c" data-kp-auschwitz-extra="1"><\/script>')}
