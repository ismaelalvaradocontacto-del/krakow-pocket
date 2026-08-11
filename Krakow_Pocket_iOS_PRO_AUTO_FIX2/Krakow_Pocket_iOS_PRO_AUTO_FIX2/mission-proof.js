(() => {
"use strict";
if(window.__kpMissionProof)return;
window.__kpMissionProof=true;

const VERSION="1.1";
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
const completed=s=>D.quests.filter(q=>done(s,q.poi)).length;
const evidence=s=>s.missionEvidence&&typeof s.missionEvidence==="object"?s.missionEvidence:{};
const radius=id=>RADII[id]||120;
const currentPlayer=()=>localStorage.getItem(PLAYER)||"Ismael";
let activePoi=null,activePosition=null,allowId=null,proofDialog=null,albumDialog=null;

function havMeters(a,b){
  const R=6371000,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),la1=rad(a.lat),la2=rad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

function injectStyles(){
  if(document.querySelector('style[data-kp-mission-proof="1"]'))return;
  const style=document.createElement("style");
  style.dataset.kpMissionProof="1";
  style.textContent=`
  .quest:not(.done) .smart-kicker::after{content:" · 📍 + 📷";font-weight:800}
  #kpMissionProofDialog,#kpAlbumDialog{border:0;padding:0;background:transparent;max-width:none;max-height:none;width:100%;height:100%;margin:0}
  #kpMissionProofDialog::backdrop,#kpAlbumDialog::backdrop{background:rgba(45,27,17,.68);backdrop-filter:blur(2px)}
  .kp-proof-shell{position:fixed;left:max(14px,env(safe-area-inset-left));right:max(14px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));max-height:88dvh;overflow:auto;background:#fae8b6;border:3px solid #6d432b;border-radius:26px;box-shadow:0 10px 0 #4b2c1d;padding:18px;color:#3d271c}
  .kp-proof-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}.kp-proof-head h2{margin:2px 0 3px;font-size:24px}.kp-proof-close{width:44px;height:44px;border-radius:14px;border:2px solid #6d432b;background:#fff0c7;font-size:21px;font-weight:900;flex:0 0 auto}
  .kp-proof-rule{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:13px 0}.kp-proof-chip{padding:10px;border:2px solid #b88a52;border-radius:15px;background:#fff0c8;font-weight:800;text-align:center}.kp-proof-chip.ok{background:#dcebbf;border-color:#6f8d43}.kp-proof-chip.bad{background:#f5d1bd;border-color:#a95a43}
  .kp-proof-status{padding:12px 13px;border-radius:15px;background:#fff4d5;border:2px solid #d2aa6a;line-height:1.35;margin:10px 0}.kp-proof-status strong{display:block;margin-bottom:3px}.kp-proof-preview{display:none;margin:12px 0;border-radius:18px;overflow:hidden;border:3px solid #6d432b;background:#dccaa0}.kp-proof-preview img{display:block;width:100%;max-height:42dvh;object-fit:cover}
  .kp-proof-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.kp-proof-actions button,.kp-proof-photo-label{min-height:48px;border:2px solid #6d432b;border-radius:14px;background:#fff0c7;color:#3d271c;font:inherit;font-weight:900;display:flex;align-items:center;justify-content:center;text-align:center;padding:8px}.kp-proof-photo-label.ready{background:#527d39;color:white}.kp-proof-photo-label.disabled{opacity:.45}.kp-proof-photo-label input{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}#kpProofFinish{grid-column:1/-1;background:#527d39;color:#fff;display:none}#kpProofFinish[disabled]{opacity:.5}
  #kpAlbumCard{margin-top:12px}.kp-album-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.kp-album-actions .btn{min-width:0}.kp-album-shell{position:fixed;inset:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));overflow:auto;background:#f7dfaa;border:3px solid #5e3825;border-radius:26px;box-shadow:0 9px 0 #402719;color:#3c291f}
  .kp-album-top{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px;background:rgba(247,223,170,.96);border-bottom:2px solid #9c7144}.kp-album-top h2{margin:0}.kp-album-close{width:44px;height:44px;border-radius:14px;border:2px solid #6d432b;background:#fff1c9;font-size:20px}.kp-album-cover{padding:34px 20px 26px;text-align:center;background:radial-gradient(circle at 50% 0,#fff5cf,#e3bd72)}.kp-album-cover .dragon{font-size:55px;animation:kpAlbumFloat 2.4s ease-in-out infinite}.kp-album-cover h1{font-family:Georgia,serif;font-size:34px;margin:8px 0}.kp-album-cover p{margin:4px auto;max-width:520px}
  .kp-album-grid{padding:15px;display:grid;gap:15px}.kp-album-entry{background:#fff0c7;border:2px solid #93623d;border-radius:20px;overflow:hidden;box-shadow:0 5px 0 rgba(90,55,31,.2);animation:kpAlbumReveal .55s both}.kp-album-entry img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#cfbd92}.kp-album-copy{padding:14px}.kp-album-meta{font-size:12px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;color:#76543d}.kp-album-copy h3{margin:5px 0 7px;font-size:22px}.kp-album-comment{margin-top:9px;padding:11px;border-left:4px solid #71924d;background:#f5e5b6;border-radius:0 12px 12px 0;animation:kpAlbumComment .65s .18s both}.kp-album-empty{padding:35px 18px;text-align:center}.kp-album-download{margin:0 15px 24px;width:calc(100% - 30px)}
  @keyframes kpAlbumReveal{from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:none}}@keyframes kpAlbumComment{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}@keyframes kpAlbumFloat{50%{transform:translateY(-5px) rotate(2deg)}}
  @media(max-width:380px){.kp-proof-rule,.kp-proof-actions,.kp-album-actions{grid-template-columns:1fr}.kp-proof-actions #kpProofFinish{grid-column:auto}}@media(prefers-reduced-motion:reduce){.kp-album-entry,.kp-album-comment,.kp-album-cover .dragon{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function setStateEvidence(id,entry){
  const s=read();s.missionEvidence={...(s.missionEvidence||{}),[id]:entry};s.updatedAt=now();localStorage.setItem(STORAGE,JSON.stringify(s));
  try{window.dispatchEvent(new CustomEvent("kp:mission-evidence-local",{detail:{id,entry}}))}catch{}
  renderAlbumCard();
}

function getPosition(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation){reject(new Error("GPS no disponible"));return}
    navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy||0,ts:Date.now()}),reject,{enableHighAccuracy:true,maximumAge:2500,timeout:12000});
  });
}

function refs(){return{place:document.getElementById("kpProofPlace"),gps:document.getElementById("kpProofGpsChip"),photo:document.getElementById("kpProofPhotoChip"),status:document.getElementById("kpProofStatus"),input:document.getElementById("kpProofInput"),label:document.getElementById("kpProofPhotoLabel"),preview:document.getElementById("kpProofPreview"),image:document.getElementById("kpProofImage"),retry:document.getElementById("kpProofRetry"),finish:document.getElementById("kpProofFinish")}}

function ensureProofDialog(){
  if(proofDialog)return proofDialog;
  proofDialog=document.createElement("dialog");proofDialog.id="kpMissionProofDialog";
  proofDialog.innerHTML=`<div class="kp-proof-shell"><div class="kp-proof-head"><div><div class="smart-kicker">MISIÓN VERIFICADA</div><h2 id="kpProofPlace">Cracovia</h2><div class="small">Para conseguir la escama hay que estar allí y guardar una foto.</div></div><button class="kp-proof-close" id="kpProofClose" aria-label="Cerrar">✕</button></div><div class="kp-proof-rule"><div class="kp-proof-chip" id="kpProofGpsChip">📍 GPS pendiente</div><div class="kp-proof-chip" id="kpProofPhotoChip">📷 Foto pendiente</div></div><div class="kp-proof-status" id="kpProofStatus"><strong>Comprobando ubicación…</strong>Espera un momento.</div><div class="kp-proof-preview" id="kpProofPreview"><img id="kpProofImage" alt="Fotografía de la misión"></div><div class="kp-proof-actions"><button id="kpProofRetry">↻ Comprobar GPS</button><label class="kp-proof-photo-label disabled" id="kpProofPhotoLabel">📷 Hacer foto<input id="kpProofInput" type="file" accept="image/*" capture="environment" disabled></label><button id="kpProofFinish" disabled>✓ Guardar foto y completar misión</button></div></div>`;
  document.body.appendChild(proofDialog);
  document.getElementById("kpProofClose").onclick=()=>proofDialog.close();document.getElementById("kpProofRetry").onclick=()=>checkGps();document.getElementById("kpProofInput").addEventListener("change",onPhotoSelected);document.getElementById("kpProofFinish").onclick=finishMission;
  return proofDialog;
}

async function checkGps(){
  if(!activePoi)return false;
  const p=poi(activePoi),r=refs(),limit=radius(activePoi);if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return false;
  r.retry.disabled=true;r.status.innerHTML="<strong>Comprobando GPS…</strong>Buscando una posición precisa.";r.gps.className="kp-proof-chip";r.gps.textContent="📍 comprobando…";r.input.disabled=true;r.label.classList.add("disabled");r.label.classList.remove("ready");
  try{
    const pos=await getPosition(),dist=havMeters(pos,{lat:p.lat,lon:p.lon});activePosition={...pos,distance:dist};const ok=dist<=limit;
    r.gps.className=`kp-proof-chip ${ok?"ok":"bad"}`;r.gps.textContent=ok?`📍 ${Math.round(dist)} m · OK`:`📍 ${Math.round(dist)} m`;
    r.status.innerHTML=ok?`<strong>✓ Estás lo bastante cerca</strong>A ${Math.round(dist)} m de ${esc(p.name)}. Ya puedes hacer la foto de la misión.`:`<strong>Acércate un poco más</strong>Estás a ${Math.round(dist)} m. Esta misión se desbloquea dentro de ${limit} m.`;
    r.input.disabled=!ok;r.label.classList.toggle("disabled",!ok);r.label.classList.toggle("ready",ok);return ok;
  }catch{
    activePosition=null;r.gps.className="kp-proof-chip bad";r.gps.textContent="📍 GPS no disponible";r.status.innerHTML="<strong>No puedo verificar que estés allí</strong>Comprueba que Kraków Pocket tenga acceso a Ubicación y vuelve a intentarlo.";return false;
  }finally{r.retry.disabled=false}
}

function loadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=e=>{URL.revokeObjectURL(url);reject(e)};img.src=url})}
function renderJpeg(img,max,quality){const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,scale=Math.min(1,max/Math.max(iw,ih)),w=Math.max(1,Math.round(iw*scale)),h=Math.max(1,Math.round(ih*scale)),c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d",{alpha:false});ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);return c.toDataURL("image/jpeg",quality)}
async function optimizePhoto(file){const img=await loadImage(file);let data=renderJpeg(img,720,.7);if(data.length>180000)data=renderJpeg(img,560,.62);if(data.length>180000)data=renderJpeg(img,440,.56);return data}

async function onPhotoSelected(e){
  const file=e.target.files?.[0];if(!file||!activePoi)return;const r=refs();r.photo.className="kp-proof-chip";r.photo.textContent="📷 preparando…";r.status.innerHTML="<strong>Preparando la foto…</strong>La reducimos para que el álbum no pese demasiado.";
  try{
    if(!(await checkGps())){e.target.value="";return}
    const dataUrl=await optimizePhoto(file);r.image.src=dataUrl;r.preview.style.display="block";r.photo.className="kp-proof-chip ok";r.photo.textContent="📷 Foto lista";r.status.innerHTML=`<strong>✓ Evidencia preparada</strong>${esc(currentPlayer())}, guardaremos la foto y la distancia verificada. Las coordenadas exactas no se guardan.`;r.finish.dataset.photo=dataUrl;r.finish.disabled=false;r.finish.style.display="flex";
  }catch{r.photo.className="kp-proof-chip bad";r.photo.textContent="📷 No se pudo leer";r.status.innerHTML="<strong>No he podido preparar esa imagen</strong>Haz otra foto o elige otra de la fototeca.";e.target.value=""}
}

function openProof(id){
  const p=poi(id),q=quest(id);if(!p||!q||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return false;
  const old=evidence(read())[id];if(old?.photo&&old?.verified){allowAndComplete(id);return true}
  activePoi=id;activePosition=null;ensureProofDialog();const r=refs();r.place.textContent=p.name;r.gps.className="kp-proof-chip";r.gps.textContent="📍 GPS pendiente";r.photo.className="kp-proof-chip";r.photo.textContent="📷 Foto pendiente";r.status.innerHTML=`<strong>Primero: estar allí</strong>Debes estar dentro de ${radius(id)} m de ${esc(p.name)}.`;r.input.value="";r.input.disabled=true;r.label.classList.add("disabled");r.label.classList.remove("ready");r.preview.style.display="none";r.image.removeAttribute("src");r.finish.dataset.photo="";r.finish.disabled=true;r.finish.style.display="none";if(!proofDialog.open)proofDialog.showModal();checkGps();return true;
}

function finishMission(){
  const r=refs(),photo=r.finish.dataset.photo,id=activePoi,p=poi(id),q=quest(id);if(!id||!photo||!activePosition||!p||!q)return;const dist=activePosition.distance,limit=radius(id);if(!Number.isFinite(dist)||dist>limit){checkGps();return}
  const entry={id,questId:q.id,place:p.name,title:q.title,photo,comment:COMMENTS[id]||`Una misión menos y un recuerdo más de ${p.name}.`,by:currentPlayer(),completedAt:now(),distance:Math.round(dist),radius:limit,verified:true,updatedAt:now()};
  try{setStateEvidence(id,entry)}catch{r.status.innerHTML="<strong>No queda espacio suficiente en el iPhone</strong>Haz otra foto; la app intentará guardarla más comprimida.";return}
  proofDialog.close();allowAndComplete(id);
}

function allowAndComplete(id){allowId=id;const b=document.querySelector(`.q-done[data-poi="${CSS.escape(id)}"]`);if(b){b.click();setTimeout(()=>{allowId=null;renderAlbumCard()},100)}}
function interceptCompletion(e){const b=e.target.closest?.(".q-done");if(!b)return;const id=b.dataset.poi;if(!id)return;if(allowId===id){allowId=null;return}const s=read();if(done(s,id))return;e.preventDefault();e.stopImmediatePropagation();openProof(id)}

function formatDate(iso){try{return new Intl.DateTimeFormat("es-ES",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(iso))}catch{return""}}
function albumEntries(){const e=evidence(read());return D.quests.map(q=>e[q.poi]).filter(x=>x?.photo&&x?.verified).sort((a,b)=>new Date(a.completedAt)-new Date(b.completedAt))}
function albumMarkup(entries){if(!entries.length)return`<div class="kp-album-empty"><div style="font-size:52px">📷</div><h3>El álbum aún está vacío</h3><p>Las fotos aparecerán aquí a medida que completéis misiones verificadas.</p></div>`;return`<div class="kp-album-grid">${entries.map((x,i)=>`<article class="kp-album-entry" style="animation-delay:${Math.min(i*.08,.6)}s"><img src="${x.photo}" alt="${esc(x.place)}"><div class="kp-album-copy"><div class="kp-album-meta">${esc(formatDate(x.completedAt))} · ${esc(x.by||"Ambos")} · GPS ${Math.round(x.distance||0)} m</div><h3>${esc(x.title||x.place)}</h3><div>${esc(x.place)}</div><div class="kp-album-comment">🐉 ${esc(x.comment||COMMENTS[x.id]||"")}</div></div></article>`).join("")}</div>`}

function ensureAlbumDialog(){
  if(albumDialog)return albumDialog;albumDialog=document.createElement("dialog");albumDialog.id="kpAlbumDialog";albumDialog.innerHTML=`<div class="kp-album-shell"><div class="kp-album-top"><div><div class="smart-kicker">CRÓNICA FOTOGRÁFICA</div><h2>Álbum de Cracovia</h2></div><button class="kp-album-close" id="kpAlbumClose" aria-label="Cerrar">✕</button></div><div id="kpAlbumContent"></div><button class="btn green kp-album-download" id="kpAlbumDownloadInside">⬇ Descargar álbum</button></div>`;document.body.appendChild(albumDialog);document.getElementById("kpAlbumClose").onclick=()=>albumDialog.close();document.getElementById("kpAlbumDownloadInside").onclick=downloadAlbum;return albumDialog;
}
function openAlbum(){ensureAlbumDialog();const entries=albumEntries(),s=read();document.getElementById("kpAlbumContent").innerHTML=`<section class="kp-album-cover"><div class="dragon">🐉</div><h1>Kraków Pocket</h1><p><strong>Ismael + Laura · Cracovia</strong></p><p>${entries.length} fotografías verificadas · ${completed(s)}/${D.quests.length} misiones completadas</p></section>${albumMarkup(entries)}`;if(!albumDialog.open)albumDialog.showModal()}

function standaloneAlbum(entries){
  const s=read(),cards=entries.map((x,i)=>`<article class="entry" style="--delay:${Math.min(i*.1,.8)}s"><img src="${x.photo}" alt="${esc(x.place)}"><div class="copy"><div class="meta">${esc(formatDate(x.completedAt))} · ${esc(x.by||"Ambos")} · GPS verificado a ${Math.round(x.distance||0)} m</div><h2>${esc(x.title||x.place)}</h2><div class="place">📍 ${esc(x.place)}</div><blockquote>🐉 ${esc(x.comment||COMMENTS[x.id]||"")}</blockquote></div></article>`).join("");
  return`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kraków Pocket · Álbum de Cracovia</title><style>*{box-sizing:border-box}body{margin:0;background:#ead08f;color:#3d281d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.cover{min-height:72vh;display:grid;place-content:center;text-align:center;padding:30px;background:radial-gradient(circle at 50% 15%,#fff5d2,#dcae5e);border-bottom:8px solid #5a3623}.dragon{font-size:78px;animation:float 2.5s ease-in-out infinite}.cover h1{font:700 46px Georgia,serif;margin:8px 0}.cover p{font-size:18px;margin:5px}.book{max-width:900px;margin:auto;padding:24px}.entry{overflow:hidden;background:#fff0c7;border:3px solid #72452d;border-radius:24px;margin:0 0 26px;box-shadow:0 8px 0 rgba(71,42,25,.2);animation:reveal .7s var(--delay) both}.entry img{display:block;width:100%;max-height:680px;object-fit:cover}.copy{padding:20px}.meta{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#7b5941}.copy h2{font:700 30px Georgia,serif;margin:8px 0}.place{font-weight:700}blockquote{margin:16px 0 0;padding:14px 16px;background:#f7dfaa;border-left:5px solid #688a45;border-radius:0 14px 14px 0;line-height:1.5;animation:comment .7s calc(var(--delay) + .3s) both}@keyframes reveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}@keyframes comment{from{opacity:0;transform:translateX(-15px)}to{opacity:1;transform:none}}@keyframes float{50%{transform:translateY(-7px) rotate(2deg)}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}@media print{body{background:#fff}.cover{min-height:95vh;break-after:page}.entry{break-inside:avoid;box-shadow:none}.book{max-width:none}}</style></head><body><section class="cover"><div class="dragon">🐉</div><h1>Kraków Pocket</h1><p><strong>Ismael + Laura · Cracovia · agosto 2026</strong></p><p>${entries.length} fotografías verificadas · ${completed(s)}/${D.quests.length} misiones</p><p>Las Escamas de Wawel</p></section><main class="book">${cards||"<p>Álbum vacío.</p>"}</main></body></html>`;
}

async function downloadAlbum(){
  const entries=albumEntries();if(!entries.length){window.alert?.("Completa al menos una misión con foto para crear el álbum.");return}
  const blob=new Blob([standaloneAlbum(entries)],{type:"text/html;charset=utf-8"}),fileName=`Krakow_Pocket_Album_${new Date().toISOString().slice(0,10)}.html`;
  try{if(navigator.canShare&&navigator.share&&typeof File!=="undefined"){const file=new File([blob],fileName,{type:"text/html"});if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"Kraków Pocket · Álbum de Cracovia"});return}}}catch(e){if(e?.name==="AbortError")return}
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}

function renderAlbumCard(){
  const diary=document.getElementById("diary");if(!diary)return;let card=document.getElementById("kpAlbumCard");if(!card){card=document.createElement("article");card.id="kpAlbumCard";card.className="card";const segment=diary.querySelector(".segment");diary.insertBefore(card,segment||diary.firstChild);card.addEventListener("click",e=>{if(e.target.closest("#kpAlbumOpen"))openAlbum();if(e.target.closest("#kpAlbumDownload"))downloadAlbum()})}
  const entries=albumEntries(),n=completed(read());card.innerHTML=`<div class="row start"><div><div class="smart-kicker">RECUERDO DE LA AVENTURA</div><h2>📸 Álbum de Cracovia</h2></div><span class="pill ${entries.length===D.quests.length?"green":"gold"}">${entries.length}/${D.quests.length} fotos</span></div><p class="small">Cada misión verificada añade su fotografía, quién la hizo, la distancia GPS y un comentario del Dragón. ${n===D.quests.length?"🏆 La aventura está completa: vuestro álbum final ya está listo.":"Podéis verlo y descargarlo en cualquier momento."}</p><div class="kp-album-actions"><button class="btn secondary" id="kpAlbumOpen">👀 Ver álbum</button><button class="btn" id="kpAlbumDownload" ${entries.length?"":"disabled"}>⬇ Descargar</button></div>`;
}

function expose(){window.KP_MISSION_PROOF={version:VERSION,requiresPhoto:true,requiresProximity:true,sharedEvidence:true,storesExactCoordinates:false,albumDownload:true,animatedComments:true,radii:{...RADII},open:openProof,openAlbum,downloadAlbum,getEvidence:()=>evidence(read()),count:()=>albumEntries().length}}
function boot(){injectStyles();ensureProofDialog();ensureAlbumDialog();renderAlbumCard();expose();document.addEventListener("click",interceptCompletion,true);window.addEventListener("kp:mission-evidence-sync",renderAlbumCard);window.addEventListener("kp:mission-evidence-local",renderAlbumCard);window.addEventListener("pageshow",()=>setTimeout(renderAlbumCard,250),{passive:true});document.addEventListener("visibilitychange",()=>{if(!document.hidden)setTimeout(renderAlbumCard,250)},{passive:true})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
