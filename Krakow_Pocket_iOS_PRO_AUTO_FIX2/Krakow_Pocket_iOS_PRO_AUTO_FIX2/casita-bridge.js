(() => {
  const config = window.POCKET_HOME_CONFIG || {};
  const adapter = window.PocketHomeAdapter;
  const base = String(config.apiBase || "").trim().replace(/\/+$/, "");
  if (!adapter || !base) return;

  const pollMs = Math.max(2000, Number(config.pollMs) || 3000);
  let timer;

  async function refresh() {
    try {
      const response = await fetch(`${base}/api/v1/state`, { cache: "no-store" });
      if (!response.ok) throw new Error("offline");
      const state = await response.json();
      adapter.update({ ...state, mode: "live" });
    } catch (_) {
      adapter.clear();
    } finally {
      clearTimeout(timer);
      timer = setTimeout(refresh, pollMs);
    }
  }

  refresh();
})();
