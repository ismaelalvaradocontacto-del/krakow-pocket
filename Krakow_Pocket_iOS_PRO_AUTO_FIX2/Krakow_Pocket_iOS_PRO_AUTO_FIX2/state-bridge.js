(() => {
  "use strict";
  if (window.__kpStateBridge) return;
  window.__kpStateBridge = true;

  const STORAGE = "krakowPocketCoop";
  const EVIDENCE_SHADOW = "kpProtectedMissionEvidenceV2";
  const nativeFetch = window.fetch.bind(window);
  const nativeSetItem = Storage.prototype.setItem;
  const now = () => new Date().toISOString();
  const parse = value => { try { return JSON.parse(value || "{}"); } catch { return null; } };
  const ts = op => {
    const raw = op && typeof op === "object" ? (op.updatedAt || op.deletedAt || op.completedAt || op.verifiedAt || op.ts || 0) : op;
    const n = new Date(raw || 0).getTime();
    return Number.isFinite(n) ? n : 0;
  };
  const read = () => parse(localStorage.getItem(STORAGE)) || {};
  let stickyMissionEvidence = {};
  let stickyProfilePhotos = {};
  let stickyAlbumPhotos = [];
  let stickyMemories = [];
  let stickyExpenses = [];
  let reconcileQueued = false;
  let shadowSig = "";

  function mergeTimed(a = {}, b = {}) {
    const out = {};
    for (const src of [a, b]) {
      for (const [id, op] of Object.entries(src || {})) {
        if (!op || typeof op !== "object") continue;
        const prev = out[id];
        if (!prev || ts(op) >= ts(prev)) out[id] = { ...op };
      }
    }
    return out;
  }

  function mergeRecords(a = [], b = []) {
    const out = new Map();
    for (const item of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
      if (!item || !item.id) continue;
      const prev = out.get(item.id);
      if (!prev || ts(item) >= ts(prev)) out.set(item.id, { ...item });
    }
    return [...out.values()];
  }

  function restoreEvidenceShadow() {
    try {
      const saved = parse(sessionStorage.getItem(EVIDENCE_SHADOW));
      if (saved && typeof saved === "object" && !Array.isArray(saved)) stickyMissionEvidence = mergeTimed(stickyMissionEvidence, saved);
    } catch {}
  }
  function persistEvidenceShadow() {
    try {
      const text = JSON.stringify(stickyMissionEvidence || {});
      if (text === shadowSig) return;
      sessionStorage.setItem(EVIDENCE_SHADOW, text);
      shadowSig = text;
    } catch {}
  }

  function absorbMissionEvidence(...sources) {
    for (const source of sources) stickyMissionEvidence = mergeTimed(stickyMissionEvidence, source || {});
    persistEvidenceShadow();
    return mergeTimed({}, stickyMissionEvidence);
  }
  function absorbProfilePhotos(...sources) {
    for (const source of sources) stickyProfilePhotos = mergeTimed(stickyProfilePhotos, source || {});
    return mergeTimed({}, stickyProfilePhotos);
  }
  function absorbAlbumPhotos(...sources) {
    for (const source of sources) stickyAlbumPhotos = mergeRecords(stickyAlbumPhotos, source || []);
    return mergeRecords([], stickyAlbumPhotos);
  }
  function absorbMemories(...sources) {
    for (const source of sources) stickyMemories = mergeRecords(stickyMemories, source || []);
    return mergeRecords([], stickyMemories);
  }
  function absorbExpenses(...sources) {
    for (const source of sources) stickyExpenses = mergeRecords(stickyExpenses, source || []);
    return mergeRecords([], stickyExpenses);
  }

  restoreEvidenceShadow();
  const initial = read();
  absorbMissionEvidence(initial.missionEvidence || {});
  absorbProfilePhotos(initial.profilePhotos || {});
  absorbAlbumPhotos(initial.albumPhotos || []);
  absorbMemories(initial.memories || []);
  absorbExpenses(initial.expenses || []);

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
    state.expenses = absorbExpenses(local.expenses || [], state.expenses || []);
    state.memories = absorbMemories(local.memories || [], state.memories || []);
    state.albumPhotos = absorbAlbumPhotos(local.albumPhotos || [], state.albumPhotos || []);
    state.missionStatus = mergeTimed(local.missionStatus || {}, state.missionStatus || {});
    state.discoveryStatus = mergeTimed(local.discoveryStatus || {}, state.discoveryStatus || {});
    state.profilePhotos = absorbProfilePhotos(local.profilePhotos || {}, state.profilePhotos || {});
    state.missionEvidence = absorbMissionEvidence(local.missionEvidence || {}, state.missionEvidence || {});
    return applyStatus(state);
  }

  function dispatchSharedChanges(local, next) {
    const photosChanged = JSON.stringify(local.profilePhotos || {}) !== JSON.stringify(next.profilePhotos || {});
    const evidenceChanged = JSON.stringify(local.missionEvidence || {}) !== JSON.stringify(next.missionEvidence || {});
    const albumChanged = JSON.stringify(local.albumPhotos || []) !== JSON.stringify(next.albumPhotos || []);
    const memoriesChanged = JSON.stringify(local.memories || []) !== JSON.stringify(next.memories || []);
    const expensesChanged = JSON.stringify(local.expenses || []) !== JSON.stringify(next.expenses || []);
    if (photosChanged) {
      try { window.dispatchEvent(new CustomEvent("kp:profile-photo-sync", { detail: { profilePhotos: JSON.parse(JSON.stringify(next.profilePhotos || {})) } })); } catch {}
    }
    if (evidenceChanged) {
      try { window.dispatchEvent(new CustomEvent("kp:mission-evidence-sync", { detail: { missionEvidence: JSON.parse(JSON.stringify(next.missionEvidence || {})) } })); } catch {}
    }
    if (albumChanged) {
      try { window.dispatchEvent(new CustomEvent("kp:album-photos-sync", { detail: { albumPhotos: JSON.parse(JSON.stringify(next.albumPhotos || [])) } })); } catch {}
    }
    if (memoriesChanged || expensesChanged) {
      try { window.dispatchEvent(new CustomEvent("kp:diary-sync", { detail: { memories: JSON.parse(JSON.stringify(next.memories || [])), expenses: JSON.parse(JSON.stringify(next.expenses || [])) } })); } catch {}
    }
    return photosChanged || evidenceChanged || albumChanged || memoriesChanged || expensesChanged;
  }

  function reconcileProtectedState() {
    reconcileQueued = false;
    restoreEvidenceShadow();
    const local = read();
    const next = mergeLocalStatus(local, local);
    const changed = JSON.stringify({
      e: local.missionEvidence || {},
      p: local.profilePhotos || {},
      a: local.albumPhotos || [],
      m: local.memories || [],
      x: local.expenses || []
    }) !== JSON.stringify({
      e: next.missionEvidence || {},
      p: next.profilePhotos || {},
      a: next.albumPhotos || [],
      m: next.memories || [],
      x: next.expenses || []
    });
    if (!changed) return false;
    nativeSetItem.call(localStorage, STORAGE, JSON.stringify(next));
    dispatchSharedChanges(local, next);
    try { window.dispatchEvent(new CustomEvent("kp:statechange", { detail: { source:"state-bridge-reconcile" } })); } catch {}
    return true;
  }

  function queueReconcile() {
    if (reconcileQueued) return;
    reconcileQueued = true;
    queueMicrotask(() => {
      reconcileQueued = false;
      reconcileProtectedState();
    });
    [0, 60, 240, 700, 1800, 5200].forEach(delay => setTimeout(reconcileProtectedState, delay));
  }

  function adoptSharedFieldsAtomically(merged) {
    const local = read();
    const nextPhotos = absorbProfilePhotos(local.profilePhotos || {}, merged?.profilePhotos || {});
    const nextEvidence = absorbMissionEvidence(local.missionEvidence || {}, merged?.missionEvidence || {});
    const nextAlbum = absorbAlbumPhotos(local.albumPhotos || [], merged?.albumPhotos || []);
    const nextMemories = absorbMemories(local.memories || [], merged?.memories || []);
    const nextExpenses = absorbExpenses(local.expenses || [], merged?.expenses || []);
    const photosChanged = JSON.stringify(local.profilePhotos || {}) !== JSON.stringify(nextPhotos);
    const evidenceChanged = JSON.stringify(local.missionEvidence || {}) !== JSON.stringify(nextEvidence);
    const albumChanged = JSON.stringify(local.albumPhotos || []) !== JSON.stringify(nextAlbum);
    const memoriesChanged = JSON.stringify(local.memories || []) !== JSON.stringify(nextMemories);
    const expensesChanged = JSON.stringify(local.expenses || []) !== JSON.stringify(nextExpenses);
    if (!photosChanged && !evidenceChanged && !albumChanged && !memoriesChanged && !expensesChanged) return false;

    const nextLocal = mergeLocalStatus({
      ...local,
      profilePhotos: nextPhotos,
      missionEvidence: nextEvidence,
      albumPhotos: nextAlbum,
      memories: nextMemories,
      expenses: nextExpenses,
      updatedAt: merged?.updatedAt || local.updatedAt || now()
    }, local);
    nativeSetItem.call(localStorage, STORAGE, JSON.stringify(nextLocal));
    dispatchSharedChanges(local, nextLocal);
    queueReconcile();
    return true;
  }

  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === STORAGE) {
      const incoming = parse(value);
      if (incoming) value = JSON.stringify(mergeLocalStatus(incoming, read()));
      const result = nativeSetItem.call(this, key, value);
      queueReconcile();
      return result;
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
          payload.p_state = mergeLocalStatus(payload.p_state, read());
          payload.p_state.missionEvidence = absorbMissionEvidence(payload.p_state.missionEvidence || {});
          payload.p_state.profilePhotos = absorbProfilePhotos(payload.p_state.profilePhotos || {});
          payload.p_state.albumPhotos = absorbAlbumPhotos(payload.p_state.albumPhotos || []);
          payload.p_state.memories = absorbMemories(payload.p_state.memories || []);
          payload.p_state.expenses = absorbExpenses(payload.p_state.expenses || []);
          next.body = JSON.stringify(payload);
        }
      } catch {}
      const response = await nativeFetch(input, next);
      queueReconcile();
      return response;
    }

    if (!isRpc(url, "adventure_get")) return nativeFetch(input, next);

    const response = await nativeFetch(input, next);
    if (!response.ok) return response;

    let remote;
    try { remote = JSON.parse(await response.clone().text() || "{}"); }
    catch { return response; }
    if (!remote || typeof remote !== "object") return response;

    absorbMissionEvidence(remote.missionEvidence || {});
    absorbProfilePhotos(remote.profilePhotos || {});
    absorbAlbumPhotos(remote.albumPhotos || []);
    absorbMemories(remote.memories || []);
    absorbExpenses(remote.expenses || []);

    const before = JSON.stringify({ v: remote.visited || [], x: remote.expenses || [], r: remote.memories || [], a: remote.albumPhotos || [], m: remote.missionStatus || {}, d: remote.discoveryStatus || {}, p: remote.profilePhotos || {}, e: remote.missionEvidence || {} });
    const merged = mergeLocalStatus(remote, read());
    adoptSharedFieldsAtomically(merged);
    const after = JSON.stringify({ v: merged.visited || [], x: merged.expenses || [], r: merged.memories || [], a: merged.albumPhotos || [], m: merged.missionStatus || {}, d: merged.discoveryStatus || {}, p: merged.profilePhotos || {}, e: merged.missionEvidence || {} });

    if (before !== after && next.body) {
      try {
        const auth = JSON.parse(next.body);
        const putUrl = url.replace(/adventure_get(?:\?.*)?$/, "adventure_put");
        const protectedState = mergeLocalStatus({ ...merged, updatedAt: now() }, read());
        const putBody = JSON.stringify({ ...auth, p_state: protectedState });
        window.fetch(putUrl, { method: "POST", headers: next.headers || { "Content-Type": "application/json" }, body: putBody }).catch(() => {});
      } catch {}
    }

    queueReconcile();
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(merged), { status: response.status, statusText: response.statusText, headers });
  };

  window.addEventListener("pageshow", () => { restoreEvidenceShadow(); queueReconcile(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { restoreEvidenceShadow(); queueReconcile(); } });

  window.KP_STATE_BRIDGE = {
    version: "1.9",
    bridgeRevision: "20260812e",
    bridgeReconciliationRevision: "20260812g",
    reversibleDiscoveries: true,
    sharedProfilePhotos: true,
    immediateRemoteProfileAdoption: true,
    sharedMissionEvidence: true,
    immediateRemoteMissionEvidenceAdoption: true,
    sharedAlbumPhotos: true,
    staleMissionEvidenceProtection: true,
    staleMissionEvidenceSurvivesReload: true,
    staleProfilePhotoProtection: true,
    staleDiaryRecordProtection: true,
    stickyDiaryRecordProtection: true,
    staleAlbumPhotoProtection: true,
    atomicSharedFieldAdoption: true,
    remoteEvidenceAbsorbedBeforeAppMerge: true,
    outgoingEvidenceTimestampGuard: true,
    postAppWriteReconciliation: true,
    postSyncReconciliation: true,
    simplifiedProfileRuntime: true,
    proofOnlyAlbumSources: true,
    normalize: state => mergeLocalStatus(state, read()),
    reconcile: reconcileProtectedState,
    protectedMissionEvidence: () => mergeTimed({}, stickyMissionEvidence),
    protectedAlbumPhotos: () => mergeRecords([], stickyAlbumPhotos),
    protectedMemories: () => mergeRecords([], stickyMemories),
    protectedExpenses: () => mergeRecords([], stickyExpenses)
  };
})();
if(!window.__kpProfilePhotoLoader){window.__kpProfilePhotoLoader=true;document.write('<script src="./profile-photo.js?v=20260811f" data-kp-profile-photo="1"><\/script>')}
if(!window.__kpNetworkStatusLoader){window.__kpNetworkStatusLoader=true;document.write('<script src="./network-status.js?v=20260810n" data-kp-network-status="1"><\/script>')}
if(!window.__kpWorldArtStabilityLoader){window.__kpWorldArtStabilityLoader=true;document.write('<script src="./world-art-stability.js?v=20260810q" data-kp-world-art-stability="1"><\/script>')}
if(!window.__kpInteractionFixLoader){window.__kpInteractionFixLoader=true;document.write('<script src="./interaction-fix.js?v=20260810p" data-kp-interaction-fix="1"><\/script>')}
if(!window.__kpMissionProofLoader){window.__kpMissionProofLoader=true;document.write('<script src="./mission-proof.js?v=20260812c" data-kp-mission-proof="1"><\/script>')}
if(!window.__kpMissionProofGuardLoader){window.__kpMissionProofGuardLoader=true;document.write('<script src="./mission-proof-guard.js?v=20260811a" data-kp-mission-proof-guard="1"><\/script>')}
if(!window.__kpAuschwitzExtraLoader){window.__kpAuschwitzExtraLoader=true;document.write('<script src="./auschwitz-extra.js?v=20260812c" data-kp-auschwitz-extra="1"><\/script>')}
if(!window.__kpAlbumNextLoader){window.__kpAlbumNextLoader=true;const load=()=>{if(document.querySelector('script[data-kp-album-next="1"]'))return;const s=document.createElement("script");s.src="./album-next.js?v=20260812a";s.dataset.kpAlbumNext="1";document.head.appendChild(s)};if(document.readyState==="complete")setTimeout(load,0);else window.addEventListener("load",load,{once:true})}
