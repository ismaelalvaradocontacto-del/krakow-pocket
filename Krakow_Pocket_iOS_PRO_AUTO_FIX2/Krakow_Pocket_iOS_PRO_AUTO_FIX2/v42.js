(() => {
"use strict";
const D=window.KP_DATA,$=s=>document.querySelector(s);
if(!D)return;
const STORAGE="krakowPocketCoop";
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return{}}};
const done=(s,id)=>s.missionStatus?.[id]?!!s.missionStatus[id].done:(s.visited||[]).includes(id);
const missions=s=>D.quests.filter(q=>done(s,q.poi)).length;
function ensureStatusLine(){const home=$("#home");if(!home||$("#kpRpgStatusLine"))return;const anchor=$("#kpRpgHud")||$("#kpGameHub");if(!anchor)return;const line=document.createElement("div");line.id="kpRpgStatusLine";line.className="kp-rpg-statusline";anchor.insertAdjacentElement("afterend",line)}
function renderStatusLine(){ensureStatusLine();const line=$("#kpRpgStatusLine");if(!line)return;const s=read(),n=missions(s),left=Math.max(0,D.quests.length-n),sync=$("#heroSync")?.textContent?.trim()||"☁️ partida";line.innerHTML=`<span><b>${left?`${left} encargos por descubrir":"Aventura principal completada"}</b></span><span class="kp-rpg-badge">${sync}</span>`}
function tidyLabels(){const mapBanner=$("#mapPanel > .kp-panel-banner b");if(mapBanner)mapBanner.textContent="Mapa de Cracovia";const questBanner=$("#quests > .kp-panel-banner b");if(questBanner)questBanner.textContent="Tablón de encargos";const diaryBanner=$("#diary > .kp-panel-banner b");if(diaryBanner)diaryBanner.textContent="Crónica de la aventura";const budgetBanner=$("#budget > .kp-panel-banner b");if(budgetBanner)budgetBanner.textContent="Bolsa compartida"}
function polish(){document.documentElement.classList.add("kp-rpg-v42");renderStatusLine();tidyLabels();const v=$("#settingsVersion");if(v)v.textContent="Kraków Pocket · v4.2 · RPG cohesivo"}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",polish,{once:true});else polish();
window.addEventListener("storage",renderStatusLine);window.addEventListener("online",renderStatusLine);window.addEventListener("offline",renderStatusLine);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")renderStatusLine()});
})();
