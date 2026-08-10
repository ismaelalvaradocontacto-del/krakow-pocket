(() => {
"use strict";
const D=window.KP_DATA;if(!D)return;
const STORAGE="krakowPocketCoop",STREET="krakowPocketStreetMode";
const $=s=>document.querySelector(s);
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return{}}};
const when=iso=>{if(!iso)return"";const d=new Date(iso),mins=Math.max(0,Math.floor((Date.now()-d.getTime())/60000));if(mins<1)return"ahora";if(mins<60)return`hace ${mins} min`;const h=Math.floor(mins/60);if(h<24)return`hace ${h} h`;return d.toLocaleDateString("es-ES",{day:"numeric",month:"short"})};
const maps=q=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
function ensure(){
  if(!$("#kpSharedActivity")){const e=document.createElement("article");e.id="kpSharedActivity";e.className="card kp-shared-activity";const anchor=$("#kpToday")||$("#kpLiveCard")||$("#recommendation");anchor?.insertAdjacentElement("afterend",e)}
  if(!$("#kpStreetBar")){const e=document.createElement("div");e.id="kpStreetBar";e.className="kp-street-bar";e.innerHTML='<button id="kpStreetToggle">☀️ Modo calle</button><button id="kpBackBase">🏠 Base</button><button id="kpBackMda">🚌 MDA</button>';document.body.appendChild(e)}
}
function events(s){const out=[];
  for(const [id,op] of Object.entries(s.missionStatus||{})){if(!op?.updatedAt)continue;const q=D.quests.find(x=>x.poi===id),p=D.pois.find(x=>x.id===id);out.push({ts:op.updatedAt,icon:op.done?"🧩":"↩️",title:op.done?`Misión completada: ${q?.title||p?.name||id}`:`Misión reabierta: ${q?.title||p?.name||id}`,by:"Compartido"})}
  for(const x of (s.expenses||[])){if(!x?.ts)continue;out.push({ts:x.updatedAt||x.ts,icon:x.deletedAt?"↩️":"💰",title:x.deletedAt?`Gasto eliminado${x.note?`: ${x.note}`:""}`:`${Number(x.amount||0).toFixed(2).replace(".",",")} €${x.note?` · ${x.note}`:""}`,by:x.by||"Ambos"})}
  for(const x of (s.memories||[])){if(!x?.ts)continue;out.push({ts:x.updatedAt||x.ts,icon:x.deletedAt?"↩️":"✨",title:x.deletedAt?"Recuerdo eliminado":x.title||"Recuerdo guardado",by:x.by||"Ambos"})}
  return out.sort((a,b)=>new Date(b.ts)-new Date(a.ts)).slice(0,4)}
function renderActivity(){const host=$("#kpSharedActivity");if(!host)return;const s=read(),items=events(s),updated=s.updatedAt;host.innerHTML=`<div class="kp-shared-head"><div><div class="smart-kicker">Ismael + Laura</div><h2>Actividad compartida</h2><p class="small">Así podéis comprobar de un vistazo que los dos móviles están viendo la misma aventura.</p></div><span class="kp-shared-sync">☁️ ${navigator.onLine?"juntos":"offline"}</span></div>${items.length?`<div class="kp-activity-list">${items.map(x=>`<div class="kp-activity-item"><span class="kp-activity-icon">${x.icon}</span><div><b>${x.title}</b><small>${x.by} · ${when(x.ts)}</small></div></div>`).join("")}</div>`:`<div class="kp-activity-empty">Todavía no hay actividad. La primera misión, gasto o recuerdo aparecerá aquí.</div>`}<div class="kp-shared-foot"><span>Último cambio: ${updated?when(updated):"sin cambios"}</span><button id="kpRefreshShared">↻ Actualizar</button></div>`;$("#kpRefreshShared").onclick=()=>{window.dispatchEvent(new Event("online"));location.reload()}}
function street(on){document.documentElement.classList.toggle("kp-street",on);localStorage.setItem(STREET,on?"1":"0");const b=$("#kpStreetToggle");if(b)b.textContent=on?"✓ Modo calle":"☀️ Modo calle"}
function wireBar(){const on=localStorage.getItem(STREET)==="1";street(on);$("#kpStreetToggle").onclick=()=>street(!document.documentElement.classList.contains("kp-street"));$("#kpBackBase").onclick=()=>window.open(maps("W94 Hostel, Juliana Dunajewskiego 8, Kraków"),"_blank");$("#kpBackMda").onclick=()=>window.open(maps(D.trip.stationKrakow),"_blank")}
function render(){ensure();renderActivity();wireBar();const ver=$("#settingsVersion");if(ver)ver.textContent="Kraków Pocket · v3.5"}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render);else render();window.addEventListener("storage",renderActivity);window.addEventListener("online",renderActivity);window.addEventListener("offline",renderActivity);setInterval(renderActivity,8000);
})();
