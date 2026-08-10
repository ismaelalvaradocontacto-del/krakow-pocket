(() => {
"use strict";
const D=window.KP_DATA,$=s=>document.querySelector(s);
if(!D)return;
const STORAGE="krakowPocketCoop";
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return{}}};
const done=(s,id)=>s.missionStatus?.[id]?!!s.missionStatus[id].done:(s.visited||[]).includes(id);
const activeExpenses=s=>(s.expenses||[]).filter(x=>x&&!x.deletedAt);
const missions=s=>D.quests.filter(q=>done(s,q.poi)).length;
const score=s=>D.quests.filter(q=>done(s,q.poi)).reduce((a,q)=>a+(+q.points||0),0);
const spent=s=>activeExpenses(s).reduce((a,x)=>a+(+x.amount||0),0);
function ensureHud(){
 const home=$("#home");if(!home||$("#kpRpgHud"))return;
 const hud=document.createElement("div");hud.id="kpRpgHud";hud.className="kp-rpg-hud";
 const anchor=$("#kpGameHub")||home.firstElementChild;anchor?.insertAdjacentElement("afterend",hud);
}
function renderHud(){ensureHud();const h=$("#kpRpgHud");if(!h)return;const s=read();h.innerHTML=`<div class="kp-rpg-hud-item"><b>🐉 ${score(s)}</b><span>escamas</span></div><div class="kp-rpg-hud-item"><b>${missions(s)}/${D.quests.length}</b><span>misiones</span></div><div class="kp-rpg-hud-item"><b>${spent(s).toFixed(2).replace('.',',')} €</b><span>gastado</span></div>`}
function addSectionTitle(panel,selector,text){const p=$(panel),target=p?.querySelector(selector);if(!target||target.previousElementSibling?.classList.contains("kp-rpg-section-title"))return;const t=document.createElement("div");t.className="kp-rpg-section-title";t.textContent=text;target.insertAdjacentElement("beforebegin",t)}
function polish(){document.documentElement.classList.add("kp-rpg-v40");renderHud();addSectionTitle("#home",".kp-rpg-actions","Acciones de aventura");addSectionTitle("#mapPanel",".poi-list","Lugares cercanos");addSectionTitle("#quests","#questList","Encargos disponibles");addSectionTitle("#diary","#storyList","Crónica desbloqueada");addSectionTitle("#budget","#categoryBars","Inventario de gasto");const ver=$("#settingsVersion");if(ver)ver.textContent="Kraków Pocket · v4.0 · RPG estable"}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",polish,{once:true});else polish();
window.addEventListener("storage",renderHud);window.addEventListener("online",renderHud);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")renderHud()});
})();
