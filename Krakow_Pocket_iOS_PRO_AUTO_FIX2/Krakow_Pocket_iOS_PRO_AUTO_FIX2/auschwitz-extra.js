(() => {
"use strict";
if(window.__kpAuschwitzExtra)return;
window.__kpAuschwitzExtra=true;

const VERSION="1.0";
const STORAGE="krakowPocketCoop";
const PLAYER="krakowPlayer";
const ID="auschwitz";
const EXTRA={
  id:ID,
  title:"Auschwitz-Birkenau",
  place:"Memorial y Museo Auschwitz-Birkenau",
  address:"Więźniów Oświęcimia 55, Oświęcim",
  mapsQuery:"Auschwitz-Birkenau Memorial and Museum, Więźniów Oświęcimia 55, Oświęcim, Poland",
  story:"Una visita de memoria y aprendizaje fuera de Cracovia. No suma escamas ni puntos: se guarda como una parada especial del viaje.",
  comment:"Una visita para recordar y aprender. Esta parada queda en el álbum sin convertirla en puntuación ni recompensa.",
  anchors:[
    {name:"Auschwitz I · centro de visitantes",lat:50.029763,lon:19.204816,radius:700},
    {name:"Auschwitz II-Birkenau",lat:50.038889,lon:19.175000,radius:1300}
  ]
};

const esc=(s="")=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const now=()=>new Date().toISOString();
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return{}}};
const player=()=>localStorage.getItem(PLAYER)||"Ismael";
let dialog=null,activePos=null;

function havMeters(a,b){
  const R=6371000,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),la1=rad(a.lat),la2=rad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function closestAnchor(pos){
  return EXTRA.anchors.map(a=>({...a,distance:havMeters(pos,a)})).sort((a,b)=>a.distance-b.distance)[0];
}
function evidence(){return read().missionEvidence?.[ID]||null}
function verified(){const e=evidence();return !!(e?.verified&&e?.photo)}

function injectStyles(){
  if(document.querySelector('style[data-kp-auschwitz-extra="1"]'))return;
  const s=document.createElement("style");s.dataset.kpAuschwitzExtra="1";s.textContent=`
  #kpAuschwitzExtraCard{border-color:#74665b;background:linear-gradient(180deg,#f2eadb,#e8dcc7);box-shadow:0 5px 0 rgba(72,58,49,.18)}
  #kpAuschwitzExtraCard .kp-extra-kicker{font-size:11px;letter-spacing:.12em;font-weight:900;color:#66584d;text-transform:uppercase}
  #kpAuschwitzExtraCard .kp-extra-note{padding:10px 12px;border-left:4px solid #786b61;background:rgba(255,255,255,.45);border-radius:0 12px 12px 0;margin:10px 0;color:#493f38}
  #kpAuschwitzExtraCard .kp-extra-status{display:inline-flex;align-items:center;gap:5px;padding:7px 10px;border:2px solid #988878;border-radius:999px;background:#f7f0e4;font-size:12px;font-weight:900}
  #kpAuschwitzExtraCard .kp-extra-status.done{background:#dfe8d5;border-color:#71815f}
  #kpAuschwitzDialog{border:0;padding:0;background:transparent;max-width:none;max-height:none;width:100%;height:100%;margin:0}
  #kpAuschwitzDialog::backdrop{background:rgba(34,30,27,.7);backdrop-filter:blur(2px)}
  .kp-auschwitz-shell{position:fixed;left:max(14px,env(safe-area-inset-left));right:max(14px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));max-height:88dvh;overflow:auto;background:#eee4d2;border:3px solid #65564b;border-radius:24px;box-shadow:0 10px 0 #3e342e;padding:18px;color:#382f2a}
  .kp-auschwitz-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.kp-auschwitz-head h2{margin:3px 0}.kp-auschwitz-close{width:44px;height:44px;flex:0 0 auto;border:2px solid #65564b;border-radius:14px;background:#faf5ea;font-size:20px}
  .kp-auschwitz-rule{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:13px 0}.kp-auschwitz-chip{padding:10px;border:2px solid #9d8a78;border-radius:14px;background:#f8f1e5;font-weight:800;text-align:center}.kp-auschwitz-chip.ok{background:#dfe8d5;border-color:#71815f}.kp-auschwitz-chip.bad{background:#ecd6cf;border-color:#9b6355}
  .kp-auschwitz-status{padding:12px;border:2px solid #aa9986;border-radius:14px;background:#faf5ea;line-height:1.35}.kp-auschwitz-status strong{display:block;margin-bottom:3px}
  .kp-auschwitz-preview{display:none;margin:12px 0;border:3px solid #65564b;border-radius:16px;overflow:hidden}.kp-auschwitz-preview img{display:block;width:100%;max-height:42dvh;object-fit:cover}
  .kp-auschwitz-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.kp-auschwitz-actions button,.kp-auschwitz-photo{min-height:48px;border:2px solid #65564b;border-radius:14px;background:#faf5ea;font:inherit;font-weight:900;color:#382f2a;display:flex;align-items:center;justify-content:center;text-align:center;padding:8px}.kp-auschwitz-photo.ready{background:#667559;color:#fff}.kp-auschwitz-photo.disabled{opacity:.45}.kp-auschwitz-photo input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}#kpAuschwitzSave{grid-column:1/-1;background:#667559;color:#fff;display:none}
  .kp-album-extra-badge{display:inline-block;margin-bottom:6px;padding:4px 7px;border-radius:999px;background:#e7dfd4;border:1px solid #85766b;font-size:10px;font-weight:900;letter-spacing:.08em;color:#51473f}
  @media(max-width:380px){.kp-auschwitz-rule,.kp-auschwitz-actions{grid-template-columns:1fr}#kpAuschwitzSave{grid-column:auto}}
  `;document.head.appendChild(s)
}

function renderCard(){
  const panel=document.getElementById("quests");if(!panel)return;
  let card=document.getElementById("kpAuschwitzExtraCard");
  if(!card){card=document.createElement("article");card.id="kpAuschwitzExtraCard";card.className="card";const list=document.getElementById("questList");panel.insertBefore(card,list||null)}
  const done=verified();
  card.innerHTML=`<div class="row start"><div><div class="kp-extra-kicker">EXTRA OPCIONAL · FUERA DE CRACOVIA</div><h2>🕯️ Auschwitz-Birkenau</h2></div><span class="kp-extra-status ${done?"done":""}">${done?"✓ Guardado":"No cuenta 12/12"}</span></div><p class="small">${esc(EXTRA.story)}</p><div class="kp-extra-note"><strong>Visita de memoria</strong><br><span class="small">Si guardáis una foto, hacedla solo donde esté permitido y con un enfoque respetuoso. El recuerdo entra en el álbum, pero no suma puntos.</span></div><div class="grid2"><button class="btn secondary" id="kpAuschwitzMap">🗺️ Ver ubicación</button><button class="btn ${done?"secondary":"green"}" id="kpAuschwitzMemory">${done?"📸 Ver/actualizar recuerdo":"📍📷 Guardar visita"}</button></div>`;
  card.querySelector("#kpAuschwitzMap").onclick=()=>window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(EXTRA.mapsQuery)}`,"_blank");
  card.querySelector("#kpAuschwitzMemory").onclick=openDialog;
}

function ensureDialog(){
  if(dialog)return dialog;
  dialog=document.createElement("dialog");dialog.id="kpAuschwitzDialog";dialog.innerHTML=`<div class="kp-auschwitz-shell"><div class="kp-auschwitz-head"><div><div class="kp-extra-kicker">VISITA EXTRA · MEMORIA</div><h2>Auschwitz-Birkenau</h2><div class="small">No suma puntos. Solo verifica que habéis estado allí y guarda un recuerdo en el álbum.</div></div><button class="kp-auschwitz-close" id="kpAuschwitzClose" aria-label="Cerrar">✕</button></div><div class="kp-auschwitz-rule"><div class="kp-auschwitz-chip" id="kpAuschwitzGps">📍 GPS pendiente</div><div class="kp-auschwitz-chip" id="kpAuschwitzPhotoChip">📷 Foto pendiente</div></div><div class="kp-auschwitz-status" id="kpAuschwitzStatus"><strong>Comprobando ubicación…</strong>Se acepta Auschwitz I o Auschwitz II-Birkenau.</div><div class="kp-auschwitz-preview" id="kpAuschwitzPreview"><img id="kpAuschwitzImage" alt="Recuerdo de Auschwitz-Birkenau"></div><div class="kp-auschwitz-actions"><button id="kpAuschwitzRetry">↻ Comprobar GPS</button><label class="kp-auschwitz-photo disabled" id="kpAuschwitzPhotoLabel">📷 Hacer foto<input id="kpAuschwitzInput" type="file" accept="image/*" capture="environment" disabled></label><button id="kpAuschwitzSave" disabled>✓ Guardar en el álbum</button></div><p class="small" style="margin:12px 2px 0;color:#66584d">La app guarda la distancia verificada, no vuestras coordenadas exactas.</p></div>`;
  document.body.appendChild(dialog);
  document.getElementById("kpAuschwitzClose").onclick=()=>dialog.close();
  document.getElementById("kpAuschwitzRetry").onclick=checkGps;
  document.getElementById("kpAuschwitzInput").addEventListener("change",photoSelected);
  document.getElementById("kpAuschwitzSave").onclick=saveVisit;
  return dialog;
}
function refs(){return{gps:document.getElementById("kpAuschwitzGps"),photo:document.getElementById("kpAuschwitzPhotoChip"),status:document.getElementById("kpAuschwitzStatus"),input:document.getElementById("kpAuschwitzInput"),label:document.getElementById("kpAuschwitzPhotoLabel"),preview:document.getElementById("kpAuschwitzPreview"),image:document.getElementById("kpAuschwitzImage"),retry:document.getElementById("kpAuschwitzRetry"),save:document.getElementById("kpAuschwitzSave")}}

function getPosition(){return new Promise((resolve,reject)=>{if(!navigator.geolocation){reject(new Error("GPS"));return}navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy||0}),reject,{enableHighAccuracy:true,maximumAge:2500,timeout:12000})})}
async function checkGps(){
  const r=refs();r.retry.disabled=true;r.input.disabled=true;r.label.classList.add("disabled");r.label.classList.remove("ready");r.gps.className="kp-auschwitz-chip";r.gps.textContent="📍 comprobando…";r.status.innerHTML="<strong>Comprobando GPS…</strong>Se acepta vuestra posición en Auschwitz I o en Birkenau.";
  try{const pos=await getPosition(),a=closestAnchor(pos),ok=a.distance<=a.radius;activePos={...pos,site:a.name,distance:a.distance,radius:a.radius};r.gps.className=`kp-auschwitz-chip ${ok?"ok":"bad"}`;r.gps.textContent=ok?`📍 ${Math.round(a.distance)} m · OK`:`📍 ${Math.round(a.distance)} m`;r.status.innerHTML=ok?`<strong>✓ Ubicación verificada</strong>Estáis en ${esc(a.name)}. Podéis guardar una fotografía respetuosa de la visita.`:`<strong>Aún no estáis en el Memorial</strong>La zona válida más cercana es ${esc(a.name)}. La foto se desbloqueará cuando lleguéis.`;r.input.disabled=!ok;r.label.classList.toggle("disabled",!ok);r.label.classList.toggle("ready",ok);return ok}catch{activePos=null;r.gps.className="kp-auschwitz-chip bad";r.gps.textContent="📍 GPS no disponible";r.status.innerHTML="<strong>No puedo verificar la ubicación</strong>Comprueba el permiso de ubicación y vuelve a intentarlo.";return false}finally{r.retry.disabled=false}
}
function loadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=e=>{URL.revokeObjectURL(url);reject(e)};img.src=url})}
function jpeg(img,max=1000,quality=.72){const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,scale=Math.min(1,max/Math.max(iw,ih)),w=Math.max(1,Math.round(iw*scale)),h=Math.max(1,Math.round(ih*scale)),c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d",{alpha:false});ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);return c.toDataURL("image/jpeg",quality)}
async function photoSelected(e){
  const file=e.target.files?.[0],r=refs();if(!file)return;if(!(await checkGps())){e.target.value="";return}
  try{const img=await loadImage(file),data=jpeg(img);r.image.src=data;r.preview.style.display="block";r.photo.className="kp-auschwitz-chip ok";r.photo.textContent="📷 Foto lista";r.status.innerHTML="<strong>✓ Recuerdo preparado</strong>Se guardará como visita extra de memoria, sin puntos ni escamas.";r.save.dataset.photo=data;r.save.disabled=false;r.save.style.display="flex"}catch{r.photo.className="kp-auschwitz-chip bad";r.photo.textContent="📷 No se pudo leer";r.status.innerHTML="<strong>No he podido preparar la foto</strong>Prueba con otra imagen.";e.target.value=""}
}
function nudgeSync(){try{document.getElementById("dailyTarget")?.dispatchEvent(new Event("change",{bubbles:true}))}catch{}}
function saveVisit(){
  const r=refs(),photo=r.save.dataset.photo;if(!photo||!activePos||activePos.distance>activePos.radius)return;
  const stamp=now(),s=read(),entry={id:ID,bonus:true,album:true,verified:true,place:EXTRA.place,title:"Visita a Auschwitz-Birkenau",photo,comment:EXTRA.comment,by:player(),completedAt:stamp,distance:Math.round(activePos.distance),radius:activePos.radius,site:activePos.site,updatedAt:stamp};
  s.missionEvidence={...(s.missionEvidence||{}),[ID]:entry};s.updatedAt=stamp;
  try{localStorage.setItem(STORAGE,JSON.stringify(s))}catch{r.status.innerHTML="<strong>No queda espacio suficiente</strong>Prueba con otra fotografía.";return}
  try{window.dispatchEvent(new CustomEvent("kp:mission-evidence-local",{detail:{id:ID,entry}}))}catch{}
  nudgeSync();dialog.close();renderCard();setTimeout(patchAlbumCard,100);
  const toast=document.getElementById("toast");if(toast){toast.textContent="🕯️ Visita guardada en el álbum";toast.style.display="block";clearTimeout(toast._kpAusTimer);toast._kpAusTimer=setTimeout(()=>toast.style.display="none",2600)}
}
function openDialog(){
  ensureDialog();const r=refs(),old=evidence();activePos=null;r.gps.className="kp-auschwitz-chip";r.gps.textContent="📍 GPS pendiente";r.photo.className=`kp-auschwitz-chip ${old?.photo?"ok":""}`;r.photo.textContent=old?.photo?"📷 Foto guardada":"📷 Foto pendiente";r.status.innerHTML="<strong>Primero: estar allí</strong>La app aceptará Auschwitz I o Auschwitz II-Birkenau.";r.input.value="";r.input.disabled=true;r.label.classList.add("disabled");r.label.classList.remove("ready");r.preview.style.display=old?.photo?"block":"none";if(old?.photo)r.image.src=old.photo;else r.image.removeAttribute("src");r.save.dataset.photo="";r.save.disabled=true;r.save.style.display="none";if(!dialog.open)dialog.showModal();checkGps()
}

function coreAlbumEntries(){const s=read(),e=s.missionEvidence||{},D=window.KP_DATA||{quests:[]};return(D.quests||[]).map(q=>e[q.poi]).filter(x=>x?.verified&&x?.photo)}
function allAlbumEntries(){const list=coreAlbumEntries();const extra=evidence();if(extra?.verified&&extra?.photo)list.push(extra);return list.sort((a,b)=>new Date(a.completedAt)-new Date(b.completedAt))}
function fmtDate(iso){try{return new Intl.DateTimeFormat("es-ES",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(iso))}catch{return""}}
function extraAlbumMarkup(x){return`<article class="kp-album-entry kp-album-extra" style="animation-delay:.12s"><img src="${x.photo}" alt="${esc(x.place)}"><div class="kp-album-copy"><span class="kp-album-extra-badge">EXTRA · MEMORIA</span><div class="kp-album-meta">${esc(fmtDate(x.completedAt))} · ${esc(x.by||"Ambos")} · GPS ${Math.round(x.distance||0)} m</div><h3>${esc(x.title)}</h3><div>${esc(x.place)}</div><div class="kp-album-comment">🕯️ ${esc(x.comment)}</div></div></article>`}
function injectIntoOpenAlbum(){
  const x=evidence();if(!x?.verified||!x?.photo)return;const content=document.getElementById("kpAlbumContent");if(!content||content.querySelector(".kp-album-extra"))return;let grid=content.querySelector(".kp-album-grid");if(!grid){content.innerHTML='<div class="kp-album-grid"></div>';grid=content.firstElementChild}grid.insertAdjacentHTML("beforeend",extraAlbumMarkup(x))
}
function patchAlbumCard(){
  const card=document.getElementById("kpAlbumCard"),x=evidence();if(!card)return;card.querySelector(".kp-auschwitz-album-note")?.remove();if(x?.verified&&x?.photo){const note=document.createElement("div");note.className="small kp-auschwitz-album-note";note.style.marginTop="8px";note.textContent="🕯️ + visita extra a Auschwitz-Birkenau guardada";card.appendChild(note)}
}
function standaloneAlbum(entries){
  const cards=entries.map((x,i)=>`<article class="entry" style="animation-delay:${Math.min(i*.08,.6)}s"><img src="${x.photo}" alt="${esc(x.place)}"><div class="copy">${x.bonus?'<span class="badge">EXTRA · MEMORIA</span>':''}<div class="meta">${esc(fmtDate(x.completedAt))} · ${esc(x.by||"Ambos")} · GPS ${Math.round(x.distance||0)} m</div><h2>${esc(x.title||x.place)}</h2><div>${esc(x.place)}</div><p class="comment">${x.bonus?"🕯️":"🐉"} ${esc(x.comment||"")}</p></div></article>`).join("");
  return`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kraków Pocket · Álbum</title><style>body{margin:0;background:#f2deb1;color:#3b291f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.cover{padding:42px 18px;text-align:center;background:linear-gradient(#fff2c8,#dfba72)}.cover h1{font-family:Georgia,serif;font-size:38px;margin:8px 0}.grid{max-width:760px;margin:auto;padding:16px;display:grid;gap:18px}.entry{background:#fff0c8;border:2px solid #8c6544;border-radius:20px;overflow:hidden;box-shadow:0 5px 0 #b89662;animation:show .55s both}.entry img{width:100%;display:block;max-height:640px;object-fit:cover}.copy{padding:16px}.meta{font-size:12px;font-weight:800;color:#715444;text-transform:uppercase}.comment{padding:12px;border-left:4px solid #71825e;background:#f6e6bb;border-radius:0 12px 12px 0}.badge{display:inline-block;padding:5px 8px;border-radius:999px;background:#e6ddd2;border:1px solid #817268;font-size:10px;font-weight:900;letter-spacing:.08em}@keyframes show{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.entry{animation:none}}</style></head><body><div class="cover"><div style="font-size:48px">📸</div><h1>Kraków Pocket</h1><p>Álbum de Ismael y Laura · Cracovia 2026</p><p>${entries.length} recuerdos fotográficos</p></div><main class="grid">${cards}</main></body></html>`
}
async function downloadCombined(){
  const entries=allAlbumEntries();if(!entries.length)return;const html=standaloneAlbum(entries),blob=new Blob([html],{type:"text/html;charset=utf-8"}),fileName=`Krakow_Pocket_Album_${new Date().toISOString().slice(0,10)}.html`;
  try{if(navigator.share&&window.File){const file=new File([blob],fileName,{type:blob.type});if(!navigator.canShare||navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"Kraków Pocket · Álbum"});return}}}catch(e){if(e?.name==="AbortError")return}
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)
}

function bind(){
  injectStyles();ensureDialog();renderCard();patchAlbumCard();
  document.addEventListener("click",e=>{
    if(e.target.closest?.("#kpAlbumOpen"))setTimeout(()=>{injectIntoOpenAlbum();patchAlbumCard()},80);
    if(e.target.closest?.("#kpAlbumDownload,#kpAlbumDownloadInside")&&verified()){e.preventDefault();e.stopImmediatePropagation();downloadCombined()}
  },true);
  window.addEventListener("kp:mission-evidence-sync",()=>{renderCard();patchAlbumCard();setTimeout(injectIntoOpenAlbum,80)});
  window.addEventListener("kp:mission-evidence-local",()=>{renderCard();patchAlbumCard();setTimeout(injectIntoOpenAlbum,80)});
  window.addEventListener("pageshow",()=>{renderCard();patchAlbumCard()},{passive:true});
  window.KP_AUSCHWITZ_EXTRA={version:VERSION,optional:true,countsTowardCore:false,photoMemory:true,respectMode:true,acceptsAuschwitzI:true,acceptsBirkenau:true,storesExactCoordinates:false,open:openDialog,isSaved:verified,config:EXTRA};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
