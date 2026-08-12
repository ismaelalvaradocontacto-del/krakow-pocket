(() => {
"use strict";
if(window.__kpAlbumV3Polish)return;
window.__kpAlbumV3Polish=true;
const VERSION="1.0";
const STYLE=`<style data-kp-v3-polish="1">
.chapter-date{text-transform:none!important}.chapter-badge{white-space:nowrap}.toc{scroll-margin-top:70px}
@media(max-width:700px){.toolbar{gap:5px!important;padding-left:8px!important;padding-right:8px!important;overflow:hidden!important}.toolbar a,.toolbar button{flex:1 1 0!important;min-width:56px!important;padding:8px 4px!important;font-size:12px!important;gap:3px!important}.chapter-badge{width:62px!important;height:62px!important;font-size:15px!important}}
@media(max-width:340px){.toolbar a,.toolbar button{font-size:11px!important;min-width:52px!important}.toolbar{gap:3px!important}}
</style>`;
let sourceHtml=null,patched=false;
function polishHtml(input){let html=String(input||"");if(!html||html.includes('data-kp-v3-polish="1"'))return html;return html.replace("</head>",`${STYLE}</head>`)}
function patchApi(){const api=window.KP_ALBUM_EXPERIENCE;if(!api||patched||api.version!=="3.0"||typeof api.html!=="function")return false;sourceHtml=api.html.bind(api);api.html=()=>polishHtml(sourceHtml());api.mobileToolbarFits=true;api.spanishDateCase=true;api.visualPolish=true;patched=true;return true}
function paintFrame(){const f=document.getElementById("kpAlbumExperienceFrame"),doc=f?.contentDocument;if(!doc?.head||doc.head.querySelector('[data-kp-v3-polish="1"]'))return false;doc.head.insertAdjacentHTML("beforeend",STYLE);return true}
document.addEventListener("click",e=>{if(e.target.closest?.("#kpAlbumOpenExperience")){setTimeout(paintFrame,40);setTimeout(paintFrame,180);setTimeout(paintFrame,600)}},true);
function boot(){if(!patchApi()){let n=0,t=setInterval(()=>{n++;if(patchApi()||n>80)clearInterval(t)},100)}window.addEventListener("load",()=>setTimeout(paintFrame,100),{once:true})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
window.KP_ALBUM_V3_POLISH={version:VERSION,polishHtml,mobileToolbarFits:true,spanishDateCase:true,visualPolish:true};
})();