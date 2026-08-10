(() => {
"use strict";
const RECOVERY="20260810-1752";
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const setStatus=(title,text)=>{const t=$("recTitle"),p=$("recText"),s=$("syncText");if(t)t.textContent=title;if(p&&text)p.textContent=text;if(s)s.textContent="recuperando…"};
const isReady=()=>{const t=$("recTitle");return !!window.KP_APP&&!!t&&t.textContent.trim()!=="Calculando…"&&t.textContent.trim()!=="Calculando..."};
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.async=false;s.onload=()=>resolve(src);s.onerror=()=>reject(new Error(`No se pudo cargar ${src}`));document.head.appendChild(s)});
async function loadVisuals(){if(document.querySelector(`script[data-kp-visuals-core="${RECOVERY}"]`))return;const s=document.createElement("script");s.dataset.kpVisualsCore=RECOVERY;s.src=`./visuals-core.js?v=${RECOVERY}`;s.async=true;s.onerror=()=>console.warn("Kraków Pocket: visuals-core no disponible");document.head.appendChild(s)}
async function recover(){
  await sleep(700);
  if(isReady()){loadVisuals();return}
  setStatus("Recuperando la aventura…","Estamos corrigiendo automáticamente la carga de la app en este iPhone.");
  try{
    if(!window.KP_DATA)await load(`./data.js?v=${RECOVERY}`);
    await load(`./app.js?v=${RECOVERY}`);
    if(document.readyState!=="loading")document.dispatchEvent(new Event("DOMContentLoaded"));
    await sleep(80);
    await load(`./game.js?v=${RECOVERY}`);
    await loadVisuals();
    await sleep(250);
    if(!isReady())throw new Error("El núcleo cargó pero no terminó de iniciar");
  }catch(err){
    console.error("Kraków Pocket recovery",err);
    const t=$("recTitle"),p=$("recText"),s=$("syncText");
    if(t)t.textContent="⚠️ Error de arranque";
    if(p)p.textContent=`${err?.message||err}. Recarga esta página una vez.`;
    if(s)s.textContent="sin iniciar";
  }
}
recover();
})();