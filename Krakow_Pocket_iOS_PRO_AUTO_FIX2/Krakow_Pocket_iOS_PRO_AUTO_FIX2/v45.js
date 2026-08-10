(() => {
"use strict";
const D=window.KP_DATA,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
if(!D)return;
const STORAGE="krakowPocketCoop",PLAYER="krakowPlayer";
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return{}}};
const done=(s,id)=>s.missionStatus?.[id]?!!s.missionStatus[id].done:(s.visited||[]).includes(id);
const activeExpenses=s=>(s.expenses||[]).filter(x=>x&&!x.deletedAt);
const questDone=s=>D.quests.filter(q=>done(s,q.poi));
const score=s=>questDone(s).reduce((a,q)=>a+(+q.points||0),0);
const spent=s=>activeExpenses(s).reduce((a,x)=>a+(+x.amount||0),0);
function charHtml(who,mini=false,name=false){return `<span class="kp45-char ${who.toLowerCase()}${mini?" mini":""}"><i class="hair"></i><i class="head"></i><i class="eye e1"></i><i class="eye e2"></i><i class="body"></i>${name?`<em class="name">${who}</em>`:""}</span>`}
function loadV46(){if(!document.querySelector('link[href*="v46.css"]')){const l=document.createElement("link");l.rel="stylesheet";l.href="./v46.css?v=4600";document.head.appendChild(l)}if(!document.querySelector('script[src*="v46.js"]')){const s=document.createElement("script");s.src="./v46.js?v=4600";document.body.appendChild(s)}}
function buildHeader(){
 let hud=$("#kpMasterHud");if(!hud)return;
 if(hud.dataset.v45==="1")return;
 hud.dataset.v45="1";
 hud.innerHTML=`<div class="kp45-brandrow"><div class="kp45-portrait" id="kp45Portrait"></div><div class="kp45-logo"><strong>Kraków Pocket</strong><span>Aventura para dos</span></div><button class="kp45-settings" id="kp45Settings" aria-label="Menú de partida">⚙️</button></div><div class="kp45-resourcebar"><div class="kp45-resource"><b id="kp45Score">🐉 0</b><span>Escamas</span></div><div class="kp45-resource"><b id="kp45Money">0,00 €</b><span>Monedas</span></div><div class="kp45-resource"><b id="kp45Missions">0/12</b><span>Misiones</span></div></div><div class="kp45-compat" aria-hidden="true"><span id="kpHudDay"></span><span id="kpHudTime"></span><span id="kpHudPlace"></span><span id="kpHudSub"></span><span id="kpHudScore"></span><span id="kpHudMissions"></span><span id="kpHudMoney"></span><span id="kpHudSync"></span></div>`;
 $("#kp45Settings").onclick=()=>$("#openSettings")?.click();
}
function objective(){
 const rec=$("#recTitle")?.textContent?.trim();
 const text=$("#recText")?.textContent?.trim();
 if(rec&&rec!=="Calculando…"&&rec!=="Calculando...")return ["🚌",rec,text||"La siguiente parte de la aventura os espera."];
 const s=read(),q=D.quests.find(x=>!done(s,x.poi));
 if(q)return ["📜",q.title||"Siguiente encargo",q.text||"Buscad la pista en la ciudad y volved con otra escama."];
 return ["🐉","Aventura principal completada","Habéis conseguido todas las escamas de Wawel."];
}
function ensureQuestStrip(){
 const app=$(".app"),content=$(".content");if(!app||!content)return;
 let strip=$("#kp45QuestStrip");if(!strip){strip=document.createElement("section");strip.id="kp45QuestStrip";app.insertBefore(strip,content)}
 const banner=$("#updateBanner");if(banner&&banner.parentElement!==app){app.insertBefore(banner,content)}
 if(banner&&strip.nextElementSibling!==banner)strip.insertAdjacentElement("afterend",banner);
}
function updateGameChrome(){
 buildHeader();ensureQuestStrip();const s=read(),qd=questDone(s),player=localStorage.getItem(PLAYER)||"Ismael";
 const portrait=$("#kp45Portrait");if(portrait&&!document.documentElement.classList.contains("kp-rpg-v46"))portrait.innerHTML=charHtml(player,false,false);
 if($("#kp45Score"))$("#kp45Score").textContent=`🐉 ${score(s)}`;
 if($("#kp45Money"))$("#kp45Money").textContent=`${spent(s).toFixed(2).replace('.',',')} €`;
 if($("#kp45Missions"))$("#kp45Missions").textContent=`${qd.length}/${D.quests.length}`;
 const o=objective(),strip=$("#kp45QuestStrip");if(strip)strip.innerHTML=`<div class="kp45-questico">${o[0]}</div><div class="kp45-questcopy"><b>${o[1]}</b><span>${o[2]}</span></div><div class="kp45-questcount">📋 ${qd.length}/${D.quests.length}</div>`;
}
function installCharacters(){
 const couple=$("#kpGameHub .kp-game-couple");if(couple&&!document.documentElement.classList.contains("kp-rpg-v46")){couple.innerHTML=charHtml("Ismael",false,true)+charHtml("Laura",false,true)}
}
function labels(){
 const map={home:["🏠","Aldea"],mapPanel:["🗺️","Mapa"],quests:["📜","Encargos"],diary:["📖","Crónica"],budget:["🎒","Bolsa"]};
 for(const [id,[ico,txt]] of Object.entries(map)){const tab=$(`.tab[data-panel="${id}"]`);if(!tab)continue;const b=tab.querySelector("b");if(b)b.textContent=ico;for(const n of [...tab.childNodes])if(n.nodeType===3&&n.textContent.trim())n.textContent=txt}
 const title=$("#settingsSheet .sheet-head strong");if(title)title.textContent="⚙️ Menú de partida";
 const sub=$("#settingsSheet .sheet-head .small");if(sub)sub.textContent="Jugador, presupuesto y partida compartida";
}
function polishQuestBoard(){
 const h=$("#quests>article:first-of-type h2");if(h)h.textContent="Las Escamas de Wawel";
 const k=$("#quests>article:first-of-type .smart-kicker");if(k)k.textContent="Kraków Quest";
}
function install(){document.documentElement.classList.add("kp-rpg-v45");loadV46();updateGameChrome();installCharacters();labels();polishQuestBoard();setTimeout(()=>{updateGameChrome();installCharacters();labels();polishQuestBoard()},350);setTimeout(()=>{updateGameChrome();installCharacters()},1200)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
window.addEventListener("storage",()=>{updateGameChrome();setTimeout(installCharacters,0)});
window.addEventListener("online",updateGameChrome);window.addEventListener("offline",updateGameChrome);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){updateGameChrome();installCharacters()}});
$("#playerSelect")?.addEventListener("change",()=>setTimeout(()=>{updateGameChrome();installCharacters()},0));
setInterval(updateGameChrome,30000);
})();
