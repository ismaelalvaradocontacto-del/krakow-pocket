(() => {
"use strict";
if(window.__kpMissionProof)return;
window.__kpMissionProof=true;

const VERSION="2.1";
const STORAGE="krakowPocketCoop";
const PLAYER="krakowPlayer";
const D=window.KP_DATA;
if(!D)return;

const RADII={florian:100,rynek:140,maria:100,maius:100,wawel:180,dragon:100,szeroka:160,placnowy:120,bernatek:120,ghetto:140,tomasza:100,planty:200};
const COMMENTS={
  florian:"La aventura empezó cruzando una puerta de verdad. Primer sello: dentro de Cracovia y con los ojos bien abiertos.",
  rynek:"Rynek os obligó a mirar dos veces. Una plaza enorme, un detalle pequeño y una foto que ya sabe contar el momento.",
  maria:"Entre torres y hejnał, Santa María puso banda sonora a la misión. Aquí mirar hacia arriba tenía recompensa.",
  maius:"Un patio escondido, piedra antigua y una pausa en mitad del centro. Collegium Maius se ganó su hueco en el álbum.",
  wawel:"Wawel no necesitó entrada para daros una vista real. La colina hizo el resto y el Vístula quedó de testigo.",
  dragon:"Prueba gráfica de que encontrasteis al culpable de todo esto. El Dragón de Wawel entrega una escama, pero no garantías contra el fuego.",
  szeroka:"Kazimierz se entiende mejor despacio. Esta foto queda como recordatorio de que una calle también puede contener muchas capas de historia.",
  placnowy:"Misión de calle superada: mirar, comparar y decidir sin prisa. Plac Nowy entra al álbum con espíritu de exploradores prácticos.",
  bernatek:"Un puente entre dos barrios y un momento exactamente en medio. No todos los cambios de mundo necesitan una pantalla de carga.",
  ghetto:"Aquí la aventura baja la voz. La fotografía queda como recuerdo de una parada hecha con tiempo, respeto y memoria.",
  tomasza:"Una misión que también alimenta. Comer caliente sin hacer sufrir al presupuesto merece documentación oficial.",
  planty:"La foto demuestra algo difícil de gamificar: supisteis parar. Planty certifica diez minutos de descanso bien invertidos."
};

const esc=(s="")=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const now=()=>new Date().toISOString();
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return{}}};
const poi=id=>D.pois.find(p=>p.id===id);
const quest=id=>D.quests.find(q=>q.poi===id);
const done=(s,id)=>s.missionStatus?.[id]?!!s.missionStatus[id].done:(s.visited||[]).includes(id);
const evidence=s=>s.missionEvidence&&typeof s.missionEvidence==="object"?s.missionEvidence:{};
const radius=id=>RADII[id]||120;
const currentPlayer=()=>localStorage.getItem(PLAYER)||"Ismael";
let activePoi=null,activePosition=null,allowId=null,proofDialog=null,pendingPhotoFile=null;

function havMeters(a,b){
  const R=6371000,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),la1=rad(a.lat),la2=rad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

function injectStyles(){
  if(document.querySelector('style[data-kp-mission-proof="2"]'))return;
  document.querySelector('style[data-kp-mission-proof="1"]')?.remove();
  const style=document.createElement("style");
  style.dataset.kpMissionProof="2";
  style.textContent=`
  .quest:not(.done) .smart-kicker::after{content:" · 📍 + 📷";font-weight:800}
  #kpMissionProofDialog{border:0;padding:0;background:transparent;max-width:none;max-height:none;width:100%;height:100%;margin:0}
  #kpMissionProofDialog::backdrop{background:rgba(45,27,17,.68);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
  .kp-proof-shell{position:fixed;left:max(14px,env(safe-area-inset-left));right:max(14px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));max-height:88dvh;overflow:auto;background:#fae8b6;border:3px solid #6d432b;border-radius:26px;box-shadow:0 10px 0 #4b2c1d;padding:18px;color:#3d271c}
  .kp-proof-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}.kp-proof-head h2{margin:2px 0 3px;font-size:24px}.kp-proof-close{width:44px;height:44px;border-radius:14px;border:2px solid #6d432b;background:#fff0c7;font-size:21px;font-weight:900;flex:0 0 auto}
  .kp-proof-rule{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:13px 0}.kp-proof-chip{padding:10px;border:2px solid #b88a52;border-radius:15px;background:#fff0c8;font-weight:800;text-align:center}.kp-proof-chip.ok{background:#dcebbf;border-color:#6f8d43}.kp-proof-chip.bad{background:#f5d1bd;border-color:#a95a43}
  .kp-proof-status{padding:12px 13px;border-radius:15px;background:#fff4d5;border:2px solid #d2aa6a;line-height:1.35;margin:10px 0}.kp-proof-status strong{display:block;margin-bottom:3px}.kp-proof-preview{display:none;margin:12px 0;border-radius:18px;overflow:hidden;border:3px solid #6d432b;background:#dccaa0}.kp-proof-preview img{display:block;width:100%;max-height:42dvh;object-fit:cover}
  .kp-proof-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.kp-proof-actions button,.kp-proof-photo-label{min-height:48px;border:2px solid #6d432b;border-radius:14px;background:#fff0c7;color:#3d271c;font:inherit;font-weight:900;display:flex;align-items:center;justify-content:center;text-align:center;padding:8px}.kp-proof-photo-label.ready{background:#527d39;color:white}.kp-proof-photo-label.disabled{opacity:.45}.kp-proof-photo-label input{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}#kpProofFinish{grid-column:1/-1;background:#527d39;color:#fff;display:none}#kpProofFinish[disabled]{opacity:.5}
  @media(max-width:380px){.kp-proof-rule,.kp-proof-actions{grid-template-columns:1fr}.kp-proof-actions #kpProofFinish{grid-column:auto}}
  `;
  document.head.appendChild(style);
}

function setStateEvidence(id,entry){
  const s=read();
  s.missionEvidence={...(s.missionEvidence||{}),[id]:entry};
  s.updatedAt=now();
  localStorage.setItem(STORAGE,JSON.stringify(s));
  try{window.dispatchEvent(new CustomEvent("kp:mission-evidence-local",{detail:{id,entry}}))}catch{}
  try{window.dispatchEvent(new CustomEvent("kp:statechange",{detail:{source:"mission-proof",id}}))}catch{}
}

function getPosition(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation){reject(new Error("GPS no disponible"));return}
    navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy||0,ts:Date.now()}),
      reject,
      {enableHighAccuracy:true,maximumAge:2500,timeout:12000}
    );
  });
}

function refs(){return{
  place:document.getElementById("kpProofPlace"),gps:document.getElementById("kpProofGpsChip"),photo:document.getElementById("kpProofPhotoChip"),status:document.getElementById("kpProofStatus"),input:document.getElementById("kpProofInput"),label:document.getElementById("kpProofPhotoLabel"),preview:document.getElementById("kpProofPreview"),image:document.getElementById("kpProofImage"),retry:document.getElementById("kpProofRetry"),finish:document.getElementById("kpProofFinish")
}}

function ensureProofDialog(){
  if(proofDialog?.isConnected)return proofDialog;
  proofDialog=document.createElement("dialog");
  proofDialog.id="kpMissionProofDialog";
  proofDialog.innerHTML=`<div class="kp-proof-shell"><div class="kp-proof-head"><div><div class="smart-kicker">MISIÓN VERIFICADA</div><h2 id="kpProofPlace">Cracovia</h2><div class="small">Para conseguir la escama hay que estar allí y guardar una foto.</div></div><button class="kp-proof-close" id="kpProofClose" type="button" aria-label="Cerrar">✕</button></div><div class="kp-proof-rule"><div class="kp-proof-chip" id="kpProofGpsChip">📍 GPS pendiente</div><div class="kp-proof-chip" id="kpProofPhotoChip">📷 Foto pendiente</div></div><div class="kp-proof-status" id="kpProofStatus"><strong>Comprobando ubicación…</strong>Espera un momento.</div><div class="kp-proof-preview" id="kpProofPreview"><img id="kpProofImage" alt="Fotografía de la misión"></div><div class="kp-proof-actions"><button id="kpProofRetry" type="button">↻ Comprobar GPS</button><label class="kp-proof-photo-label disabled" id="kpProofPhotoLabel">📷 Hacer foto<input id="kpProofInput" type="file" accept="image/*" capture="environment" disabled></label><button id="kpProofFinish" type="button" disabled>✓ Guardar foto y completar misión</button></div></div>`;
  document.body.appendChild(proofDialog);
  document.getElementById("kpProofClose").onclick=()=>proofDialog.close();
  document.getElementById("kpProofRetry").onclick=()=>checkGps();
  document.getElementById("kpProofInput").addEventListener("change",onPhotoSelected);
  document.getElementById("kpProofFinish").onclick=finishMission;
  return proofDialog;
}

async function checkGps(){
  if(!activePoi)return false;
  const p=poi(activePoi),r=refs(),limit=radius(activePoi);
  if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return false;
  r.retry.disabled=true;
  r.status.innerHTML="<strong>Comprobando GPS…</strong>Buscando una posición precisa.";
  r.gps.className="kp-proof-chip";r.gps.textContent="📍 comprobando…";
  r.input.disabled=true;r.label.classList.add("disabled");r.label.classList.remove("ready");
  try{
    const pos=await getPosition(),dist=havMeters(pos,{lat:p.lat,lon:p.lon});
    activePosition={...pos,distance:dist};
    const ok=dist<=limit;
    r.gps.className=`kp-proof-chip ${ok?"ok":"bad"}`;
    r.gps.textContent=ok?`📍 ${Math.round(dist)} m · OK`:`📍 ${Math.round(dist)} m`;
    r.status.innerHTML=ok?`<strong>✓ Estás lo bastante cerca</strong>A ${Math.round(dist)} m de ${esc(p.name)}. Ya puedes hacer la foto de la misión.`:`<strong>Acércate un poco más</strong>Estás a ${Math.round(dist)} m. Esta misión se desbloquea dentro de ${limit} m.`;
    r.input.disabled=!ok;r.label.classList.toggle("disabled",!ok);r.label.classList.toggle("ready",ok);
    return ok;
  }catch{
    activePosition=null;r.gps.className="kp-proof-chip bad";r.gps.textContent="📍 GPS no disponible";
    r.status.innerHTML="<strong>No puedo verificar que estés allí</strong>Comprueba que Kraków Pocket tenga acceso a Ubicación y vuelve a intentarlo.";
    return false;
  }finally{r.retry.disabled=false}
}

function loadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=e=>{URL.revokeObjectURL(url);reject(e)};img.src=url})}
function renderJpeg(img,max,quality){const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,scale=Math.min(1,max/Math.max(iw,ih)),w=Math.max(1,Math.round(iw*scale)),h=Math.max(1,Math.round(ih*scale)),c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d",{alpha:false});ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);return c.toDataURL("image/jpeg",quality)}
async function optimizePhoto(file){const img=await loadImage(file);let data=renderJpeg(img,720,.68);if(data.length>130000)data=renderJpeg(img,600,.60);if(data.length>130000)data=renderJpeg(img,500,.54);if(data.length>130000)data=renderJpeg(img,420,.48);return data}
function loadDataImage(data){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=data})}
function emitEvidence(id,entry,extra={}){try{window.dispatchEvent(new CustomEvent("kp:mission-evidence-local",{detail:{id,entry,...extra}}))}catch{}try{window.dispatchEvent(new CustomEvent("kp:statechange",{detail:{source:"mission-proof",id,...extra}}))}catch{}}
async function reclaimSpaceAndSave(id,entry){
  const state=read(), ev={...(state.missionEvidence||{}),[id]:entry};
  state.missionEvidence=ev;state.updatedAt=entry.updatedAt||now();
  const candidates=Object.entries(ev).filter(([key,x])=>key!==id&&typeof x?.photo==="string"&&x.photo.startsWith("data:image/")&&x.photo.length>90000).sort((a,b)=>b[1].photo.length-a[1].photo.length);
  const reclaimed=[];
  for(const [key,item] of candidates){
    try{
      const img=await loadDataImage(item.photo);let photo=renderJpeg(img,620,.56);if(photo.length>105000)photo=renderJpeg(img,520,.50);if(photo.length>105000)photo=renderJpeg(img,440,.44);
      if(photo.length>=item.photo.length)continue;
      const ts=now();ev[key]={...item,photo,photoQuality:"storage-reclaimed-v1",updatedAt:ts};state.updatedAt=ts;reclaimed.push([key,ev[key]]);
      try{localStorage.setItem(STORAGE,JSON.stringify(state));emitEvidence(id,entry,{storageRecovery:true});for(const [rid,rentry] of reclaimed)emitEvidence(rid,rentry,{storageReclaim:true});return entry}catch{}
    }catch{}
  }
  throw new Error("quota")
}
async function saveEvidenceAdaptive(id,entry,file){
  try{setStateEvidence(id,entry);return entry}catch{}
  if(!file)throw new Error("quota");
  const img=await loadImage(file),attempts=[[520,.52],[440,.46],[360,.40],[300,.35],[250,.31],[210,.28]];let last=entry;
  for(const [max,quality] of attempts){
    const ts=now(),photo=renderJpeg(img,max,quality),candidate={...entry,photo,photoQuality:"storage-adaptive-v1",updatedAt:ts};last=candidate;
    try{setStateEvidence(id,candidate);return candidate}catch{}
  }
  return reclaimSpaceAndSave(id,last);
}

async function onPhotoSelected(e){
  const file=e.target.files?.[0];if(!file||!activePoi)return;
  pendingPhotoFile=file;
  const r=refs();r.photo.className="kp-proof-chip";r.photo.textContent="📷 preparando…";r.status.innerHTML="<strong>Preparando la foto…</strong>La reducimos para guardarla de forma segura.";
  try{
    if(!(await checkGps())){pendingPhotoFile=null;e.target.value="";return}
    const dataUrl=await optimizePhoto(file);
    r.image.src=dataUrl;r.preview.style.display="block";r.photo.className="kp-proof-chip ok";r.photo.textContent="📷 Foto lista";
    r.status.innerHTML=`<strong>✓ Evidencia preparada</strong>${esc(currentPlayer())}, guardaremos la foto y la distancia verificada. Las coordenadas exactas no se guardan.`;
    r.finish.dataset.photo=dataUrl;r.finish.disabled=false;r.finish.style.display="flex";
  }catch{
    pendingPhotoFile=null;r.photo.className="kp-proof-chip bad";r.photo.textContent="📷 No se pudo leer";r.status.innerHTML="<strong>No he podido preparar esa imagen</strong>Haz otra foto o elige otra de la fototeca.";e.target.value="";
  }
}

function openProof(id){
  const p=poi(id),q=quest(id);if(!p||!q||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return false;
  const old=evidence(read())[id];
  if(old?.photo&&old?.verified){allowAndComplete(id);return true}
  activePoi=id;activePosition=null;pendingPhotoFile=null;ensureProofDialog();const r=refs();
  r.place.textContent=p.name;r.gps.className="kp-proof-chip";r.gps.textContent="📍 GPS pendiente";r.photo.className="kp-proof-chip";r.photo.textContent="📷 Foto pendiente";
  r.status.innerHTML=`<strong>Primero: estar allí</strong>Debes estar dentro de ${radius(id)} m de ${esc(p.name)}.`;
  r.input.value="";r.input.disabled=true;r.label.classList.add("disabled");r.label.classList.remove("ready");r.preview.style.display="none";r.image.removeAttribute("src");r.finish.dataset.photo="";r.finish.disabled=true;r.finish.style.display="none";
  if(!proofDialog.open)proofDialog.showModal();checkGps();return true;
}

async function finishMission(){
  const r=refs(),photo=r.finish.dataset.photo,id=activePoi,p=poi(id),q=quest(id);
  if(!id||!photo||!activePosition||!p||!q)return;
  const dist=activePosition.distance,limit=radius(id);
  if(!Number.isFinite(dist)||dist>limit){checkGps();return}
  const stamp=now();
  const entry={id,questId:q.id,place:p.name,title:q.title,photo,comment:COMMENTS[id]||`Una misión menos y un recuerdo más de ${p.name}.`,by:currentPlayer(),completedAt:stamp,distance:Math.round(dist),radius:limit,verified:true,updatedAt:stamp};
  r.finish.disabled=true;r.status.innerHTML="<strong>Guardando la foto…</strong>Si hace falta, la app ajustará automáticamente su tamaño sin pedirte que la repitas.";
  try{
    const saved=await saveEvidenceAdaptive(id,entry,pendingPhotoFile);
    r.finish.dataset.photo=saved.photo;r.image.src=saved.photo;
  }catch{
    r.finish.disabled=false;r.status.innerHTML="<strong>El almacenamiento de la app está completamente lleno</strong>La foto sigue preparada en esta pantalla. No la repitas; cierra otras pestañas de Kraków Pocket y vuelve a pulsar Guardar.";return;
  }
  pendingPhotoFile=null;proofDialog.close();allowAndComplete(id);
}

function allowAndComplete(id){
  allowId=id;
  const b=document.querySelector(`.q-done[data-poi="${CSS.escape(id)}"]`);
  if(b){b.click();setTimeout(()=>{allowId=null},100)}else allowId=null;
}
function interceptCompletion(e){
  const b=e.target.closest?.(".q-done");if(!b)return;
  const id=b.dataset.poi;if(!id)return;
  if(allowId===id){allowId=null;return}
  const s=read();if(done(s,id))return;
  e.preventDefault();e.stopImmediatePropagation();openProof(id);
}

const albumApi=()=>window.KP_ALBUM_V5||window.KP_ALBUM_EXPERIENCE;
const openAlbum=()=>albumApi()?.open?.()??false;
const downloadAlbum=()=>albumApi()?.download?.()??false;
function expose(){
  window.KP_MISSION_PROOF={
    version:VERSION,requiresPhoto:true,requiresProximity:true,sharedEvidence:true,storesExactCoordinates:false,
    albumUnifiedV5:true,legacyAlbumUi:false,legacyAlbumExporter:false,
    radii:{...RADII},open:openProof,openAlbum,downloadAlbum,
    getEvidence:()=>evidence(read()),count:()=>Object.values(evidence(read())).filter(x=>x?.verified&&x?.photo).length
  };
}
function boot(){
  injectStyles();ensureProofDialog();expose();
  document.addEventListener("click",interceptCompletion,true);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
