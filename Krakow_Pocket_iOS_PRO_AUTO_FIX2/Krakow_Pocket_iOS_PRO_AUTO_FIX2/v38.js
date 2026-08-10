(() => {
"use strict";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function removeLegacyFloat(){const bar=$("#kpStreetBar");if(bar)bar.remove();}
function decorateHome(){
 const rec=$("#recommendation");if(rec){rec.classList.add("kp-rpg-board");const k=rec.querySelector(".smart-kicker");if(k)k.textContent="📜 Consejo del gremio";}
 const today=$("#kpToday");if(today){today.classList.add("kp-rpg-route");const pill=today.querySelector(".kp-version-pill");if(pill)pill.textContent="RUTA";}
 const live=$("#kpLiveCard");if(live)live.classList.add("kp-rpg-travel-center");
 const quick=$("#home > .quick-grid");if(quick){quick.classList.add("kp-rpg-actions");const labels=[
  ["#quickMap","🗺️ Explorar","Abrir el mapa real"],
  ["#quickExpense","🪙 Registrar gasto","Guardar en la bolsa"],
  ["#quickMemory","📖 Guardar recuerdo","Añadir a la crónica"],
  ["#quickRest","🌿 Descansar","Buscar algo tranquilo"]
 ];labels.forEach(([sel,title,sub])=>{const b=$(sel);if(!b)return;const strong=b.querySelector("strong"),span=b.querySelector("span");if(strong)strong.textContent=title;if(span)span.textContent=sub;});}
}
function decoratePanels(){
 const map=$("#mapPanel");if(map)map.classList.add("kp-rpg-panel-map");
 const quests=$("#quests");if(quests)quests.classList.add("kp-rpg-panel-quests");
 const diary=$("#diary");if(diary)diary.classList.add("kp-rpg-panel-diary");
 const budget=$("#budget");if(budget)budget.classList.add("kp-rpg-panel-budget");
 const qtop=$("#quests > .card");if(qtop){const k=qtop.querySelector(".smart-kicker");if(k)k.textContent="🐉 Libro de encargos";}
 const budgetTop=$("#budget > .card");if(budgetTop){const k=budgetTop.querySelector(".smart-kicker");if(k)k.textContent="🪙 Bolsa compartida";}
 const storyIntro=$("#diary-stories > .card .smart-kicker");if(storyIntro)storyIntro.textContent="📜 Crónica desbloqueable";
}
function addVillageShortcuts(){const hub=$("#kpGameHub .kp-village");if(!hub||hub.querySelector(".kp-village-shortcuts"))return;const wrap=document.createElement("div");wrap.className="kp-village-shortcuts";wrap.innerHTML='<button id="kpVillageBase">🏠<span>Base</span></button><button id="kpVillageMda">🚌<span>MDA</span></button>';hub.appendChild(wrap);const homeBtn=$("#homeMapBtn"),mdaBtn=$("#zachodniaBtn");$("#kpVillageBase").onclick=()=>homeBtn?.click();$("#kpVillageMda").onclick=()=>mdaBtn?.click();}
function mobileAudit(){
 document.documentElement.classList.add("kp-rpg-v38");
 $$('button,input,select,textarea').forEach(el=>el.classList.add('kp-touch-safe'));
 $$('[style*="color:var(--ink)"]').forEach(el=>{if(el.closest('.card,.smart-card'))el.style.color='';});
}
function updateVersion(){const v=$("#settingsVersion");if(v)v.textContent="Kraków Pocket · v3.8 · Adventure Edition";}
function run(){removeLegacyFloat();decorateHome();decoratePanels();addVillageShortcuts();mobileAudit();updateVersion();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run();
new MutationObserver(()=>{removeLegacyFloat();decorateHome();addVillageShortcuts();}).observe(document.body,{childList:true,subtree:true});
})();