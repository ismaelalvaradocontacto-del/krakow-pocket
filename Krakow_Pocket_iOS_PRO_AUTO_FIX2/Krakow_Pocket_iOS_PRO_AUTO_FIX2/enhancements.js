(() => {
"use strict";
const D=window.KP_DATA;
if(!D)return;
if(!document.querySelector('link[href$="enhancements.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./enhancements.css';link.dataset.kpEnhancements='1';document.head.appendChild(link)}
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
  const route=routeForNow(state),visited=state.visited||[],ps=route.ids.map(poi).filter(Boolean),trackable=ps.filter(p=>!["base","bus"].includes(p.category)),done=trackable.filter(p=>visited.includes(p.id)).length,target=+(state.config?.dailyTarget||D.trip.dailyTarget||21),spent=todaySpend(state);
  const next=trackable.find(p=>!visited.includes(p.id));
  host.innerHTML=`<div class="row start"><div><div class="smart-kicker">${esc(route.label)}</div><h2>${esc(route.title)}</h2></div><span class="pill ${spent<=target?"green":"red"}">Hoy ${num(spent)}<span class="kp-unit">€</span> / ${num(target)}<span class="kp-unit">€</span></span></div>
  <div class="kp-route-progress"><i style="width:${trackable.length?Math.round(done/trackable.length*100):0}%"></i></div>
  <div class="kp-route-steps">${ps.map(p=>{const logistics=["base","bus"].includes(p.category),isDone=visited.includes(p.id);return`<button class="kp-route-step ${isDone?"done":""}" data-stop="${p.id}"><span class="kp-step-dot">${isDone?"✓":p.emoji}</span><span><b>${esc(p.name)}</b><small>${isDone?"hecho":logistics?"logística de la ruta":`${p.duration||20} min · ${esc(p.cost)}`}</small></span></button>`}).join("")}</div>
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
function renderAll(){ensureShell();const state=readState(),sig=JSON.stringify({v:state.visited,e:state.expenses,m:state.memories,c:state.config,d:dateKey(new Date())});if(sig!==lastSig){lastSig=sig;renderRoute(state);renderDistricts(state);renderShare(state)}const ver=$("#settingsVersion");if(ver)ver.textContent="Kraków Pocket · v3.1";renderNetwork()}
window.addEventListener("online",()=>{renderNetwork();setTimeout(renderAll,250)});window.addEventListener("offline",renderNetwork);window.addEventListener("storage",renderAll);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",renderAll);else renderAll();
setInterval(renderAll,1800);
})();

(() => {
"use strict";
const D=window.KP_DATA;if(!D)return;
const STORAGE="krakowPocketCoop";
const CLOUD={url:"https://ahzmwkztlakejmrvgcdm.supabase.co",key:"sb_publishable_sf-RddHTp5jdFCQOfRBBsQ_PZGKOIxJ",code:"WAWEL-ISMAEL-LAURA",secret:"krakow2026"};
const qIds=new Set(D.quests.map(q=>q.poi));
const nowIso=()=>new Date().toISOString();
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return{}}};
const write=s=>localStorage.setItem(STORAGE,JSON.stringify(s));
const time=v=>{const n=new Date(v||0).getTime();return Number.isFinite(n)?n:0};
function normalize(s){s=s&&typeof s==="object"?s:{};if(!Array.isArray(s.visited))s.visited=[];if(!s.missionStatus||typeof s.missionStatus!=="object"||Array.isArray(s.missionStatus))s.missionStatus={};for(const id of s.visited){if(qIds.has(id)&&!s.missionStatus[id])s.missionStatus[id]={done:true,updatedAt:s.updatedAt||"1970-01-01T00:00:00.000Z"}}return applyStatus(s,s.missionStatus)}
function mergeStatus(a={},b={}){const out={};for(const src of [a,b])for(const [id,op] of Object.entries(src||{})){if(!qIds.has(id)||!op)continue;const prev=out[id];if(!prev||time(op.updatedAt)>=time(prev.updatedAt))out[id]={done:!!op.done,updatedAt:op.updatedAt||"1970-01-01T00:00:00.000Z"}}return out}
function applyStatus(s,status){const v=new Set(s.visited||[]);for(const [id,op] of Object.entries(status||{})){if(!qIds.has(id))continue;if(op?.done)v.add(id);else v.delete(id)}s.visited=[...v];s.missionStatus=status;return s}
function mergeRecords(a=[],b=[]){const m=new Map();for(const item of [...(b||[]),...(a||[])]){if(!item?.id)continue;const p=m.get(item.id);if(!p||time(item.updatedAt||item.ts)>=time(p.updatedAt||p.ts))m.set(item.id,item)}return[...m.values()]}
async function rpc(name,body){const c=new AbortController(),tm=setTimeout(()=>c.abort(),9000);try{const r=await fetch(`${CLOUD.url}/rest/v1/rpc/${name}`,{method:"POST",headers:{"Content-Type":"application/json","apikey":CLOUD.key},body:JSON.stringify(body),signal:c.signal}),text=await r.text();if(!r.ok)throw new Error(text||`HTTP ${r.status}`);return text?JSON.parse(text):null}finally{clearTimeout(tm)}}
function buildMerged(local,remote,status){local=normalize(local);remote=normalize(remote);const allVisited=new Set([...(remote.visited||[]),...(local.visited||[])]);const out={...remote,...local};out.expenses=mergeRecords(local.expenses,remote.expenses);out.memories=mergeRecords(local.memories,remote.memories);out.config=remote.config||local.config||{};out.budget=Array.isArray(local.budget)?local.budget:(remote.budget||[]);out.visited=[...allVisited];out.missionStatus=status;applyStatus(out,status);out.updatedAt=nowIso();return out}
function effectiveDone(s,id){s=normalize(s);return s.missionStatus[id]?!!s.missionStatus[id].done:(s.visited||[]).includes(id)}
function setLocal(ids,done){const s=normalize(read()),stamp=nowIso();for(const id of ids){s.missionStatus[id]={done:!!done,updatedAt:stamp}}applyStatus(s,s.missionStatus);s.updatedAt=stamp;write(s);return s}
function flash(text){const t=document.getElementById("toast");if(t){t.textContent=text;t.style.display="block"}}
async function pushMissionState(local){if(!navigator.onLine)return local;try{const remote=normalize(await rpc("adventure_get",{p_code:CLOUD.code,p_secret:CLOUD.secret})||{}),status=mergeStatus(remote.missionStatus,local.missionStatus),out=buildMerged(local,remote,status);await rpc("adventure_put",{p_code:CLOUD.code,p_secret:CLOUD.secret,p_state:out});write(out);return out}catch(e){console.warn("Kraków Pocket mission sync",e);return local}}
async function change(ids,done,message){const local=setLocal(ids,done);flash("Sincronizando misión…");await pushMissionState(local);sessionStorage.setItem("kpMissionNotice",message);location.reload()}
function completedSorted(s){s=normalize(s);return D.quests.filter(q=>effectiveDone(s,q.poi)).sort((a,b)=>time(s.missionStatus[b.poi]?.updatedAt)-time(s.missionStatus[a.poi]?.updatedAt))}
function ensureManage(s){const header=document.getElementById("questCount")?.closest("article");if(!header)return;let box=document.getElementById("kpMissionManage");if(!box){box=document.createElement("div");box.id="kpMissionManage";box.className="grid2";box.style.marginTop="10px";header.appendChild(box)}const done=completedSorted(s);if(!done.length){box.style.display="none";return}box.style.display="grid";box.innerHTML='<button class="btn ghost small-btn" id="kpUndoMission">↩ Deshacer última</button><button class="btn secondary small-btn" id="kpResetMissions">Reiniciar misiones</button>';document.getElementById("kpUndoMission").onclick=e=>{e.preventDefault();e.stopPropagation();const q=done[0];change([q.poi],false,`↩ ${q.title} vuelve a estar pendiente`)};document.getElementById("kpResetMissions").onclick=e=>{e.preventDefault();e.stopPropagation();if(confirm("¿Marcar todas las misiones como pendientes?"))change(done.map(q=>q.poi),false,"↩ Misiones reiniciadas")}}
function renderMissionControls(){const s=normalize(read()),done=D.quests.filter(q=>effectiveDone(s,q.poi));document.querySelectorAll(".q-done[data-poi]").forEach(b=>{const isDone=effectiveDone(s,b.dataset.poi);b.textContent=isDone?"↩ Desmarcar":"✓ Completar";b.classList.toggle("green",!isDone);b.classList.toggle("secondary",isDone);b.closest(".quest")?.classList.toggle("done",isDone)});const count=document.getElementById("questCount");if(count)count.textContent=`${done.length} / ${D.quests.length}`;const bar=document.getElementById("questBar");if(bar)bar.style.width=`${D.quests.length?done.length/D.quests.length*100:0}%`;const home=document.getElementById("homeMission");if(home)home.textContent=`${done.length}/${D.quests.length}`;const ring=document.getElementById("adventureRing");if(ring){const pct=Math.round(done.length/Math.max(1,D.quests.length)*100);ring.style.setProperty("--p",pct);ring.dataset.label=`${pct}%`}const score=done.reduce((a,q)=>a+q.points,0),hero=document.getElementById("heroScore");if(hero)hero.textContent=`${score} 🐉`;ensureManage(s);const ver=document.getElementById("settingsVersion");if(ver)ver.textContent="Kraków Pocket · v3.3"}
document.addEventListener("click",e=>{const b=e.target.closest?.(".q-done[data-poi]");if(!b)return;e.preventDefault();e.stopImmediatePropagation();const s=normalize(read()),id=b.dataset.poi,isDone=effectiveDone(s,id),q=D.quests.find(x=>x.poi===id);change([id],!isDone,isDone?`↩ ${q?.title||"Misión"} vuelve a estar pendiente`:`✓ ${q?.title||"Misión"} completada`)},true);
let pulling=false;
async function pullMissionStatus(){if(pulling||!navigator.onLine)return;pulling=true;try{const remote=normalize(await rpc("adventure_get",{p_code:CLOUD.code,p_secret:CLOUD.secret})||{}),local=normalize(read()),status=mergeStatus(remote.missionStatus,local.missionStatus),before=JSON.stringify({v:local.visited,m:local.missionStatus}),merged=buildMerged(local,remote,status);merged.updatedAt=local.updatedAt||merged.updatedAt;const after=JSON.stringify({v:merged.visited,m:merged.missionStatus});write(merged);const remoteCheck=JSON.stringify({v:remote.visited,m:remote.missionStatus}),mergedCheck=JSON.stringify({v:merged.visited,m:merged.missionStatus});if(remoteCheck!==mergedCheck){const out={...merged,updatedAt:nowIso()};await rpc("adventure_put",{p_code:CLOUD.code,p_secret:CLOUD.secret,p_state:out});write(out)}if(before!==after){sessionStorage.setItem("kpMissionNotice","☁️ Progreso de misiones actualizado");location.reload()}}catch(e){console.warn("Kraków Pocket mission pull",e)}finally{pulling=false}}
function init(){const notice=sessionStorage.getItem("kpMissionNotice");if(notice){sessionStorage.removeItem("kpMissionNotice");setTimeout(()=>flash(notice),350)}renderMissionControls();setInterval(renderMissionControls,900);setTimeout(pullMissionStatus,1200);setInterval(pullMissionStatus,4000)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
