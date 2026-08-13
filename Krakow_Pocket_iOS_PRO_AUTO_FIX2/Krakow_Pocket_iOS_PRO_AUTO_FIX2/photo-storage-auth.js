(() => {
"use strict";
if (window.__kpR2PhotoAuth) return;
window.__kpR2PhotoAuth = true;

const TOKEN_KEY = "kpR2UploadToken";
const nativeFetch = window.fetch.bind(window);

function provisionFromHash() {
  try {
    const raw = location.hash.replace(/^#/, "");
    if (!raw) return false;
    const params = new URLSearchParams(raw);
    const token = String(params.get("r2token") || "").trim();
    if (token.length < 24) return false;
    localStorage.setItem(TOKEN_KEY, token);
    params.delete("r2token");
    const rest = params.toString();
    history.replaceState(null, "", `${location.pathname}${location.search}${rest ? `#${rest}` : ""}`);
    try { window.dispatchEvent(new CustomEvent("kp:r2-auth-ready")); } catch {}
    return true;
  } catch { return false; }
}

function token() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

window.fetch = function(input, init) {
  try {
    const sourceUrl = typeof input === "string" ? input : (input?.url || "");
    const url = new URL(sourceUrl, location.href);
    const method = String(init?.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
    if (url.origin === location.origin && url.pathname === "/api/photo" && (method === "POST" || method === "DELETE")) {
      const next = init ? { ...init } : {};
      const baseHeaders = next.headers || (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
      const headers = new Headers(baseHeaders || {});
      const value = token();
      if (value) headers.set("X-KP-Upload-Token", value);
      next.headers = headers;
      return nativeFetch(input, next);
    }
  } catch {}
  return nativeFetch(input, init);
};

provisionFromHash();

window.KP_R2_AUTH = {
  version:"1.0",
  tokenKey:TOKEN_KEY,
  hasToken:() => token().length >= 24,
  setToken(value) {
    const clean = String(value || "").trim();
    if (clean.length < 24) throw new Error("Upload token is too short");
    localStorage.setItem(TOKEN_KEY, clean);
    try { window.dispatchEvent(new CustomEvent("kp:r2-auth-ready")); } catch {}
    return true;
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    return true;
  }
};
})();
