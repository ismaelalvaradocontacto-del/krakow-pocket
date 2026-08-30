(() => {
  "use strict";

  if (window.__pocketNetworkInstalled) return;
  window.__pocketNetworkInstalled = true;

  const SUPABASE_ORIGIN = "https://ahzmwkztlakejmrvgcdm.supabase.co";
  const nativeFetch = window.fetch.bind(window);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function requestUrl(input) {
    try { return typeof input === "string" ? input : input?.url || ""; }
    catch { return ""; }
  }

  function isPocketBackend(input) {
    const url = requestUrl(input);
    return url.startsWith(`${SUPABASE_ORIGIN}/rest/v1/rpc/`);
  }

  function retryable(error) {
    return !error || error.name === "AbortError" || error.name === "TypeError" || /network|fetch|timeout|timed|abort|conex/i.test(String(error.message || error));
  }

  async function resilientFetch(input, init = {}) {
    const base = {...init};
    // Pocket's old 12 s AbortController is intentionally ignored here.
    // Each attempt has its own mobile-friendly timeout instead.
    delete base.signal;

    const plan = [
      {timeout: 22000, wait: 0},
      {timeout: 28000, wait: 650},
      {timeout: 32000, wait: 1400}
    ];
    let lastError = null;

    for (let i = 0; i < plan.length; i += 1) {
      const step = plan[i];
      if (step.wait) await sleep(step.wait);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), step.timeout);
      try {
        const response = await nativeFetch(input, {...base, signal: controller.signal, cache: "no-store"});
        clearTimeout(timer);
        // Retry transient server/gateway errors; return real application errors normally.
        if ([408, 425, 429, 500, 502, 503, 504].includes(response.status) && i < plan.length - 1) {
          lastError = new Error(`Backend temporalmente no disponible (${response.status})`);
          continue;
        }
        return response;
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        if (i === plan.length - 1 || !retryable(error)) throw error;
      }
    }

    throw lastError || new Error("No se ha podido conectar con Pocket");
  }

  window.fetch = function(input, init) {
    if (!isPocketBackend(input)) return nativeFetch(input, init);
    return resilientFetch(input, init);
  };
})();
