(() => {
"use strict";
const D=window.KP_DATA;
if(!D)return;
const STORAGE="krakowPocketCoop";
const $=s=>document.querySelector(s);
const esc=(s="")=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const num=n=>Number(n||0).toFixed(2).replace(".",",");
function readState(){try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return{}}}
function poi(id){return D.pois.find(x=>x.id===id)}
function quest(id){return D.quests.find(x=>x.poi===id)}
function score(state){return D.quests.filter(q=>(state.visited||[]).includes(q.poi)).reduce((a,q)=>a+q.points,0)}
function todayIndex(){return D.days.findIndex(x=>x.date===dateKey(new Date()))}
function activeExpenses(state){return (state.expenses||[]).filter(x=>x&&!x.deletedAt)}
function todaySpend(state){const key=dateKey(new Date());return activeExpenses(state).filter(x=>dateKey(new Date(x.ts))===key).reduce((a,x)=>a+(+x.amount||0),0)}
function totalSpend(state){return activeExpenses(state).reduce((a,x)=>a+(+x.amount||0),0)}
function routeForNow(state){
  const idx=todayIndex();
  if(idx===0)return {label:"Ruta de hoy",title:"Primer contacto · Old Town + Wawel",ids:["mda","w94","florian","rynek","maria","maius","wawel","dragon"]};
  if(idx===1)return {label:"Ruta de hoy",title:"Kazimierz → Vístula → Podgórze",ids:["szeroka","placnowy","bernatek","ghetto","planty"]};
  if(idx===2){
    const pending=D.pois.filter(p=>p.days?.includes(3)&&!["base","bus","shop","food"].includes(p.category)&&!(state.visited||[]).includes(p.id)).slice(0,4).map(p=>p.id);
    return {label:"Día flexible",title:"Pendientes sin correr + regreso",ids:[...pending,"mda"]};
  }
  const before=new Date()<new Date(D.trip.start);
  return before?{label:"Mañana en Cracovia",title:"Llegada → centro histórico → Wawel",ids:["mda","w94","florian","rynek","wawel","dragon"]}:{label:"Aventura guardada",title:"Vuestros lugares de Cracovia",ids:["rynek","wawel","dragon","szeroka","ghetto"]};
}
function mapsStopUrl(p){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.mapsQuery||`${p.lat},${p.lon}`)}`}
function mapsRouteUrl(ids){const ps=ids.map(poi).filter(Boolean);if(ps.length<2)return ps[0]?mapsStopUrl(ps[0]):"#";const q=p=>p.mapsQuery||`${p.lat},${p.lon}`;const origin=q(ps[0]),destination=q(ps[ps.length-1]),waypoints=ps.slice(1,-1).map(q).join("|");return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=walking${waypoints?`&waypoints=${encodeURIComponent(waypoints)}`:""}`}
function ensureShell(){
  if(!$("#kpRouteCard")){
    const card=document.createElement("article");card.id="kpRouteCard";card.className="card kp-route-card";
    const quick=$("#home .quick-grid");if(quick)quick.insertAdjacentElement("afterend",card);
  }
  if(!$("#kpDistrictCard")){
    const card=document.createElement("article");card.id="kpDistrictCard";card.className="card kp-district-card";
    const progress=$("#adventureRing")?.closest("article");if(progress)progress.insertAdjacentElement("afterend",card);
  }
  if(!$("#kpShareCard")){
    const card=document.createElement("article");card.id="kpShareCard";card.className="card kp-share-card";
    const formCard=$("#diary-memories form#memoryForm")?.closest("article");if(formCard)formCard.insertAdjacentElement("afterend",card);
  }
  if(!$("#kpOffline")){
    const chip=document.createElement("div");chip.id="kpOffline";chip.className="kp-offline";chip.textContent="📴 Sin conexión · la app sigue disponible";document.body.appendChild(chip);
  }
}
function renderRoute(state){
  const host=$("#kpRouteCard");if(!host)return;
  const route=routeForNow(state),visited=state.visited||[],ps=route.ids.map(poi).filter(Boolean),done=ps.filter(p=>visited.includes(p.id)).length,target=+(state.config?.dailyTarget||D.trip.dailyTarget||21),spent=todaySpend(state);
  const next=ps.find(p=>!visited.includes(p.id)&&!["base","bus"].includes(p.category));
  host.innerHTML=`<div class="row start"><div><div class="smart-kicker">${esc(route.label)}</div><h2>${esc(route.title)}</h2></div><span class="pill ${spent<=target?"green":"red"}">Hoy ${num(spent)}<span class="kp-unit">€</span> / ${num(target)}<span class="kp-unit">€</span></span></div>
  <div class="kp-route-progress"><i style="width:${ps.length?Math.round(done/ps.length*100):0}%"></i></div>
  <div class="kp-route-steps">${ps.map((p,i)=>`<button class="kp-route-step ${visited.includes(p.id)?"done":""}" data-stop="${p.id}"><span class="kp-step-dot">${visited.includes(p.id)?"✓":p.emoji}</span><span><b>${esc(p.name)}</b><small>${visited.includes(p.id)?"hecho":`${p.duration||20} min · ${esc(p.cost)}`}</small></span></button>`).join("")}</div>
  <div class="kp-route-actions"><button class="btn secondary" id="kpRouteOpen">🗺️ Abrir ruta</button>${next?`<button class="btn" id="kpNextMission">${quest(next.id)?"🧩 Siguiente misión":"📍 Siguiente parada"}</button>`:""}</div>`;
  $("#kpRouteOpen").onclick=()=>window.open(mapsRouteUrl(route.ids),"_blank");
  if(next&&$("#kpNextMission"))$("#kpNextMission").onclick=()=>window.open(mapsStopUrl(next),"_blank");
  host.querySelectorAll("[data-stop]").forEach(b=>{b.onclick=()=>{const p=poi(b.dataset.stop);if(p)window.open(mapsStopUrl(p),"_blank")}});
}
function renderDistricts(state){
  const host=$("#kpDistrictCard");if(!host)return;
  const defs=[{id:"old",name:"Old Town",emoji:"🏰"},{id:"wawel",name:"Wawel",emoji:"🐉"},{id:"kazimierz",name:"Kazimierz",emoji:"✡️"},{id:"podgorze",name:"Podgórze",emoji:"🌉"}],visited=state.visited||[];
  const rows=defs.map(d=>{const pts=D.pois.filter(p=>p.district===d.id&&["history","game","walk","rest","museum"].includes(p.category)),done=pts.filter(p=>visited.includes(p.id)).length,pct=pts.length?Math.round(done/pts.length*100):0;return`<div class="kp-district"><div class="row"><span>${d.emoji} <b>${esc(d.name)}</b></span><span class="kp-percent">${pct}<span>%</span></span></div><div class="kp-mini-track"><i style="width:${pct}%"></i></div><small>${done} de ${pts.length} descubiertos</small></div>`}).join("");
  host.innerHTML=`<div class="row"><div><div class="smart-kicker">Mapa de aventura</div><h2>Barrios que ya son vuestros</h2></div><span class="pill gold">${score(state)} 🐉</span></div><div class="kp-district-grid">${rows}</div>`;
}
function buildSummary(state){
  const memories=(state.memories||[]).filter(x=>x&&!x.deletedAt).sort((a,b)=>new Date(b.ts)-new Date(a.ts)),visited=state.visited||[],total=D.quests.length,done=D.quests.filter(q=>visited.includes(q.poi)).length;
  const lines=["Kraków Pocket · Ismael + Laura",`Misiones: ${done}/${total} · ${score(state)} escamas`,`Gasto variable: ${num(totalSpend(state))}€`,`Recuerdos guardados: ${memories.length}`];
  if(memories.length){lines.push("","Últimos recuerdos:");memories.slice(0,5).forEach(m=>lines.push(`• ${m.title||"Recuerdo"}${m.place?` · ${m.place}`:""}${m.note?`: ${m.note}`:""}`))}
  lines.push("","https://lambent-cupcake-945384.netlify.app/");return lines.join("\n")
}
async function shareSummary(){const text=buildSummary(readState());try{if(navigator.share){await navigator.share({title:"Kraków Pocket · nuestro viaje",text});return}await navigator.clipboard.writeText(text);alert("Resumen copiado al portapapeles.")}catch(e){if(e?.name!=="AbortError")prompt("Copia vuestro resumen:",text)}}
function renderShare(state){
  const host=$("#kpShareCard");if(!host)return;const memories=(state.memories||[]).filter(x=>x&&!x.deletedAt).length,done=D.quests.filter(q=>(state.visited||[]).includes(q.poi)).length;
  host.innerHTML=`<div class="row start"><div><div class="smart-kicker">Vuestro viaje, guardado</div><h2>Resumen de la aventura</h2><p class="small">${memories} recuerdos · ${done}/${D.quests.length} misiones · ${num(totalSpend(state))}<span class="kp-unit">€</span> variables</p></div><span class="kp-recap-mark">✦</span></div><button class="btn full" id="kpShareSummary">↗️ Compartir / guardar resumen</button>`;
  $("#kpShareSummary").onclick=shareSummary;
}
function renderNetwork(){const chip=$("#kpOffline");if(chip)chip.classList.toggle("show",!navigator.onLine)}
let lastSig="";
function renderAll(){ensureShell();const state=readState(),sig=JSON.stringify({v:state.visited,e:state.expenses,m:state.memories,c:state.config,d:dateKey(new Date())});if(sig!==lastSig){lastSig=sig;renderRoute(state);renderDistricts(state);renderShare(state)}renderNetwork()}
window.addEventListener("online",()=>{renderNetwork();setTimeout(renderAll,250)});window.addEventListener("offline",renderNetwork);window.addEventListener("storage",renderAll);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",renderAll);else renderAll();
setInterval(renderAll,1800);
})();
