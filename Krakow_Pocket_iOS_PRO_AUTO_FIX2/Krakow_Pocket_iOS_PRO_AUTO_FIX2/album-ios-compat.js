(() => {
"use strict";
if (window.__kpAlbumIosCompat) return;
window.__kpAlbumIosCompat = true;

const VERSION = "1.0";
let sourceHtml = null;
let apiPatched = false;

function fixHtml(input) {
  let html = String(input || "");
  if (!html || html.includes('data-kp-offline-compat="1"')) return html;

  html = html.replace('<section class="cover">', '<section class="cover" id="albumTop">');

  const oldToolbar = '<nav class="toolbar"><button type="button" id="printAlbum">📄 Guardar como PDF</button><button type="button" id="topAlbum">↑ Portada</button><button type="button" id="endAlbum">↓ Final</button></nav>';
  const newToolbar = '<nav class="toolbar" data-kp-offline-compat="1"><a id="printAlbum" href="#pdfHelp">📄 Guardar como PDF</a><a id="topAlbum" href="#albumTop">↑ Portada</a><a id="endAlbum" href="#albumEnd">↓ Final</a></nav>';
  html = html.replace(oldToolbar, newToolbar);

  const offlineCss = `<style data-kp-offline-compat="1">
    .toolbar a{border:1px solid #8b674e;background:#fff5d8;color:#4a3325;border-radius:999px;padding:10px 14px;font:inherit;font-weight:800;text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;min-height:42px}
    .toolbar a:active{transform:translateY(1px);background:#f5e3b8}
    .reveal{opacity:1!important;transform:none!important;animation:kpOfflineReveal .52s ease both;animation-delay:var(--delay,0s)}
    .offline-pdf-help{margin:20px 18px 34px;padding:18px;background:#fff5d8;border:1px solid rgba(104,67,45,.35);border-radius:22px;box-shadow:0 8px 22px rgba(56,34,22,.12)}
    .offline-pdf-help h2{font-family:Georgia,serif;margin:0 0 8px;font-size:25px}.offline-pdf-help p{margin:7px 0;line-height:1.5}.offline-pdf-help strong{color:#513526}
    @keyframes kpOfflineReveal{from{opacity:.25;transform:translateY(8px)}to{opacity:1;transform:none}}
    @media(max-width:680px){.toolbar a{white-space:nowrap}}
    @media(prefers-reduced-motion:reduce){.reveal{animation:none!important}}
    @media print{.offline-pdf-help{display:none!important}}
  </style>`;
  html = html.replace('</head>', `${offlineCss}</head>`);

  const help = `<section class="offline-pdf-help" id="pdfHelp"><h2>📄 Guardar este álbum como PDF</h2><p><strong>En iPhone:</strong> si has abierto el archivo desde Descargas o Archivos, el visor de iOS puede no permitir que una página HTML lance la impresión por sí sola.</p><p>Pulsa el botón <strong>Compartir</strong> del propio iPhone → <strong>Imprimir</strong>. Desde la previsualización puedes volver a pulsar Compartir y elegir <strong>Guardar en Archivos</strong>.</p><p>En Safari, Chrome, Mac o PC, el botón de arriba abre directamente la impresión cuando el navegador permite JavaScript.</p></section>`;
  html = html.replace('<section class="ending" id="albumEnd">', `${help}<section class="ending" id="albumEnd">`);

  return html;
}

function baseHtml() {
  try {
    if (sourceHtml) return sourceHtml();
    const api = window.KP_ALBUM_EXPERIENCE;
    if (api?.html && api.html !== fixedHtml) return api.html();
  } catch {}
  return "";
}

function fixedHtml() {
  return fixHtml(baseHtml());
}

function albumFile() {
  const html = fixedHtml();
  if (!html) return null;
  return new File([html], `Krakow_Pocket_Album_${new Date().toISOString().slice(0,10)}.html`, { type: "text/html;charset=utf-8" });
}

function download() {
  const html = fixedHtml();
  if (!html) return false;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Krakow_Pocket_Album_${new Date().toISOString().slice(0,10)}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

async function share() {
  const f = albumFile();
  if (!f) return false;
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [f] }))) {
      await navigator.share({ title: "Kraków · Ismael & Laura", text: "Nuestro álbum interactivo de Cracovia", files: [f] });
      return true;
    }
  } catch (e) {
    if (e?.name === "AbortError") return true;
  }
  return download();
}

function patchApi() {
  const api = window.KP_ALBUM_EXPERIENCE;
  if (!api || apiPatched) return false;
  if (typeof api.html !== "function") return false;
  sourceHtml = api.html.bind(api);
  api.html = fixedHtml;
  api.download = download;
  api.share = share;
  api.offlineFallbackLinks = true;
  api.iosQuickLookCompatible = true;
  apiPatched = true;
  return true;
}

document.addEventListener("click", event => {
  const el = event.target.closest?.("#kpAlbumDownload,#kpAlbumShare,#kpAlbumShareBottom,#kpAlbumQuickShare");
  if (!el) return;
  if (!patchApi() && !window.KP_ALBUM_EXPERIENCE) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (el.matches("#kpAlbumDownload")) download();
  else share();
}, true);

function boot() {
  if (patchApi()) return;
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (patchApi() || tries > 80) clearInterval(timer);
  }, 250);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();

window.KP_ALBUM_IOS_COMPAT = {
  version: VERSION,
  fixedHtml,
  download,
  share,
  noJsNavigation: true,
  noJsPdfFallback: true,
  revealWithoutJs: true,
  quickLookCompatible: true
};
})();
