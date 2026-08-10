(() => {
"use strict";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const labels={home:["🐉","Aldea"],mapPanel:["🗺️","Mapa"],quests:["📜","Encargos"],diary:["📖","Crónica"],budget:["🎒","Bolsa"]};
function gameify(){
 document.documentElement.classList.add("kp-rpg-v43");
 $$(".tab[data-panel]").forEach(tab=>{const x=labels[tab.dataset.panel];if(!x)return;const b=tab.querySelector("b");if(b)b.textContent=x[0];for(const n of [...tab.childNodes])if(n.nodeType===3&&n.textContent.trim())n.textContent=x[1]});
 const settings=$("#settingsVersion");if(settings)settings.textContent="Kraków Pocket · partida compartida";
 const settingsTitle=$("#settingsSheet .sheet-head strong");if(settingsTitle)settingsTitle.textContent="⚙️ Menú de partida";
 const settingsSub=$("#settingsSheet .sheet-head .small");if(settingsSub)settingsSub.textContent="Aventura, jugador y sincronización";
 const mapH=$("#mapPanel h2");if(mapH&&/Cerca/.test(mapH.textContent))mapH.textContent="Lugares cercanos";
}
function rerun(){gameify();setTimeout(gameify,300)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",rerun,{once:true});else rerun();
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")gameify()});
})();
