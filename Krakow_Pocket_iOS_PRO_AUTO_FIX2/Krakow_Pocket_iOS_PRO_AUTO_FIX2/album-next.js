(() => {
"use strict";
if(window.__kpAlbumNext)return;
window.__kpAlbumNext=true;

const VERSION="6.1";
const STORAGE="krakowPocketCoop";
const PLAYER="krakowPlayer";
const $=(s,r=document)=>r.querySelector(s);
const active=a=>(Array.isArray(a)?a:[]).filter(x=>x&&!x.deletedAt);
const parse=v=>{try{return JSON.parse(v||"{}")}catch{return null}};
const read=()=>parse(localStorage.getItem(STORAGE))||{};
const now=()=>new Date().toISOString();
const esc=(s="")=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const stamp=x=>{const raw=x&&typeof x==="object"?(x.updatedAt||x.deletedAt||x.completedAt||x.verifiedAt||x.ts||x.createdAt||0):x;const n=new Date(raw||0).getTime();return Number.isFinite(n)?n:0};
const stableId=x=>String(x?.id||"");

function photoHash(data=""){
 const s=String(data||""),step=Math.max(1,Math.floor(s.length/700));let h=2166136261>>>0;
 for(let i=0;i<s.length;i+=step){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
 h^=s.length;return(h>>>0).toString(36);
}
function mergeRecords(...lists){
 const map=new Map();
 for(const list of lists)for(const x of Array.isArray(list)?list:[]){if(!x?.id)continue;const prev=map.get(x.id);if(!prev||stamp(x)>=stamp(prev))map.set(x.id,{...x})}
 return [...map.values()];
}
function mergeEvidence(...objects){
 const out={};
 for(const obj of objects)for(const [id,x] of Object.entries(obj||{})){if(!x||typeof x!=="object")continue;const prev=out[id];if(!prev||stamp(x)>=stamp(prev))out[id]={...x}}
 return out;
}
function bridgeCall(name,fallback){try{return window.KP_STATE_BRIDGE?.[name]?.()??fallback}catch{return fallback}}
function protectedState(){
 const s=read();
 s.missionEvidence=mergeEvidence(s.missionEvidence||{},bridgeCall("protectedMissionEvidence",{}));
 s.albumPhotos=mergeRecords(s.albumPhotos||[],bridgeCall("protectedAlbumPhotos",[]));
 s.memories=mergeRecords(s.memories||[],bridgeCall("protectedMemories",[]));
 s.expenses=mergeRecords(s.expenses||[],bridgeCall("protectedExpenses",[]));
 return s;
}
function virtualEvidenceFromPhoto(p){
 if(!p?.photo)return null;
 const when=p.completedAt||p.createdAt||p.updatedAt||p.ts||"1970-01-01T00:00:00.000Z";
 return{
  id:`album-${p.id}`,title:p.title||p.place||"Recuerdo del viaje",place:p.place||"Cracovia",photo:p.photo,
  comment:p.comment||"Un momento más de nuestro viaje.",by:p.by||"Ambos",verified:p.verified===true,
  distance:Number.isFinite(+p.distance)?Math.round(+p.distance):null,extra:!!p.extra,bonus:!!p.extra,
  completedAt:when,updatedAt:p.updatedAt||p.createdAt||p.ts||when
 };
}
function projectedState(){
 const s=protectedState(),e={...(s.missionEvidence||{})},seen=new Set(Object.values(e).filter(x=>x?.photo).map(x=>photoHash(x.photo)));
 for(const p of active(s.albumPhotos)){
  const fp=p.photoHash||photoHash(p.photo);if(!p?.photo||seen.has(fp))continue;seen.add(fp);
  const v=virtualEvidenceFromPhoto(p);if(v)e[v.id]=v;
 }
 return{...s,missionEvidence:e};
}
function canonicalSignature(){
 const s=projectedState();
 const evidence=Object.entries(s.missionEvidence||{}).filter(([,x])=>x?.photo).sort(([a],[b])=>String(a).localeCompare(String(b))).map(([id,x])=>[
  id,photoHash(x.photo),x.title||"",x.place||"",x.comment||"",x.by||x.player||x.completedBy||"",!!x.verified,
  Number.isFinite(+x.distance)?Math.round(+x.distance):null,!!(x.extra||x.bonus),x.completedAt||x.verifiedAt||x.ts||""
 ]);
 const memories=active(s.memories).slice().sort((a,b)=>stableId(a).localeCompare(stableId(b))).map(x=>[x.id,x.title||"",x.note||"",x.place||"",x.by||"",x.ts||""]);
 const expenses=active(s.expenses).slice().sort((a,b)=>stableId(a).localeCompare(stableId(b))).map(x=>[x.id,+x.amount||0,x.category||"",x.note||"",x.by||"",x.ts||""]);
 const visited=[...(s.visited||[])].map(String).sort();
 const missionStatus=Object.entries(s.missionStatus||{}).sort(([a],[b])=>String(a).localeCompare(String(b))).map(([id,x])=>[id,!!x?.done]);
 return JSON.stringify({evidence,memories,expenses,visited,missionStatus});
}

let lastEvidence=mergeEvidence(protectedState().missionEvidence||{});
function evidenceArchiveRecord(id,e){
 if(!e?.photo)return null;const fp=photoHash(e.photo),when=e.completedAt||e.verifiedAt||e.updatedAt||e.ts||now();
 return{id:`history-${id}-${fp}`,missionId:id,title:e.title||e.place||"Recuerdo de la misión",place:e.place||"",photo:e.photo,
  comment:e.comment||"",by:e.by||e.player||e.completedBy||"Ambos",verified:e.verified===true,
  distance:Number.isFinite(+e.distance)?Math.round(+e.distance):null,extra:!!(e.extra||e.bonus),completedAt:when,updatedAt:when,photoHash:fp,source:"mission-history"};
}
function archiveReplacedEvidence(){
 const current=mergeEvidence(protectedState().missionEvidence||{}),extra=[];
 for(const [id,old] of Object.entries(lastEvidence||{})){
  const fresh=current[id];if(!old?.photo||!fresh?.photo||photoHash(old.photo)===photoHash(fresh.photo))continue;
  const older=stamp(fresh)>=stamp(old)?old:fresh,r=evidenceArchiveRecord(id,older);if(r)extra.push(r);
 }
 lastEvidence=JSON.parse(JSON.stringify(current));if(!extra.length)return false;
 const raw=read(),before=raw.albumPhotos||[],next=mergeRecords(before,bridgeCall("protectedAlbumPhotos",[]),extra);
 if(JSON.stringify(before)===JSON.stringify(next))return false;
 raw.albumPhotos=next;raw.updatedAt=now();
 try{localStorage.setItem(STORAGE,JSON.stringify(raw));window.dispatchEvent(new CustomEvent("kp:album-photos-local",{detail:{count:extra.length}}));window.dispatchEvent(new CustomEvent("kp:statechange",{detail:{source:"album-history"}}));nudgeSync();return true}catch{return false}
}

let baseApi=null;
function captureBase(){if(!baseApi&&window.KP_ALBUM_V5?.html)baseApi={...window.KP_ALBUM_V5};return baseApi}
function withProjected(fn){
 const state=projectedState(),prev=Storage.prototype.getItem;
 Storage.prototype.getItem=function(key){if(this===localStorage&&key===STORAGE)return JSON.stringify(state);return prev.call(this,key)};
 try{return fn(state)}finally{Storage.prototype.getItem=prev}
}
function html(){
 const api=captureBase();if(!api?.html)return"";
 let out=withProjected(()=>api.html());
 const css='<style data-kp-album-multi="1">@media screen{.photo-button img,.photo-card:nth-child(4n+1) .photo-button img,.photo-card:nth-child(4n+4) .photo-button img{aspect-ratio:auto!important;height:auto!important;max-height:78svh!important;object-fit:contain!important;background:#ebe5dc!important}}@media print{.photo-button img,.photo-card:nth-child(4n+1) .photo-button img,.photo-card:nth-child(4n+4) .photo-button img{aspect-ratio:auto!important;object-fit:contain!important;max-height:92mm!important}}</style>';
 return out.replace("</head>",css+"</head>").replace('data-kp-album-v5="1"','data-kp-album-v5="1" data-kp-album-multi="1"');
}
function photoCount(){return Object.values(projectedState().missionEvidence||{}).filter(x=>typeof x?.photo==="string"&&x.photo.startsWith("data:image/")).length}

let dialog=null,frame=null,lastSig="",refreshTimer=0,refreshing=false,pending=false,printing=false,fallbackTimer=0;
function ensureViewer(){
 dialog=document.getElementById("kpAlbumV5Dialog");
 if(!dialog){
  dialog=document.createElement("dialog");dialog.id="kpAlbumV5Dialog";
  dialog.innerHTML='<div class="kp-v5-shell"><header><div><div class="smart-kicker">ÁLBUM DIGITAL</div><strong>Kraków · Ismael & Laura</strong></div><div class="kp-v5-head-actions"><button id="kpAlbumV5ShareTop" type="button">↗</button><button id="kpAlbumV5Close" type="button">✕</button></div></header><iframe id="kpAlbumV5Frame" title="Álbum digital de Cracovia"></iframe><footer><button id="kpAlbumV6AddViewer" type="button">＋ Fotos</button><button id="kpAlbumV5Download" type="button">⬇ HTML</button><button id="kpAlbumV5Pdf" type="button">📄 PDF</button><button id="kpAlbumV5Share" type="button">↗ Compartir</button></footer></div>';
  document.body.appendChild(dialog);
  dialog.addEventListener("close",stopViewer);
 }
 frame=document.getElementById("kpAlbumV5Frame");return dialog;
}
function stopViewer(){
 document.documentElement.classList.remove("kp-album-v5-open");clearTimeout(refreshTimer);clearInterval(fallbackTimer);
 refreshTimer=fallbackTimer=0;refreshing=pending=printing=false;
}
function scrollIntent(y){const safe=Math.max(0,Number(y)||0);try{window.dispatchEvent(new CustomEvent("kp:album-scroll-intent",{detail:{y:safe}}))}catch{}return safe}
function bindFrameActivity(){
 try{
  const doc=frame?.contentDocument;if(!doc||doc.__kpAlbumActivityBound)return;doc.__kpAlbumActivityBound=true;
  const after=()=>setTimeout(flushPending,90);
  doc.addEventListener("click",after,true);doc.addEventListener("keydown",after,true);doc.addEventListener("touchend",after,{passive:true,capture:true});
 }catch{}
}
function frameBlocked(){try{return !!frame?.contentDocument?.querySelector("#storyMode.open,#lightbox.open")}catch{return false}}
function writeFrame(markCurrent=true){
 if(!dialog?.open||!frame)return false;
 const current=canonicalSignature();
 if(markCurrent)lastSig=current;
 const y=frame.contentWindow?.scrollY||0;scrollIntent(y);refreshing=true;pending=false;
 frame.addEventListener("load",()=>{bindFrameActivity();setTimeout(()=>{refreshing=false;flushPending()},120)},{once:true});
 frame.srcdoc=html();return true;
}
function refreshNow(){
 clearTimeout(refreshTimer);refreshTimer=0;
 if(!dialog?.open||!frame)return false;
 const current=canonicalSignature();
 if(current===lastSig){pending=false;return false}
 if(refreshing||printing||frameBlocked()){pending=true;return false}
 return writeFrame(true);
}
function scheduleRefresh(delay=520){
 if(!dialog?.open)return;
 const current=canonicalSignature();
 if(current===lastSig){pending=false;clearTimeout(refreshTimer);refreshTimer=0;return}
 pending=true;clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshNow,delay);
}
function flushPending(){
 if(!pending||refreshing||printing||frameBlocked())return;
 scheduleRefresh(120);
}
function open(){
 captureBase();ensureViewer();archiveReplacedEvidence();clearTimeout(refreshTimer);clearInterval(fallbackTimer);
 pending=refreshing=printing=false;lastSig=canonicalSignature();scrollIntent(0);frame.srcdoc=html();
 document.documentElement.classList.add("kp-album-v5-open");if(!dialog.open)dialog.showModal();
 frame.addEventListener("load",bindFrameActivity,{once:true});
 fallbackTimer=setInterval(()=>{if(!dialog?.open||refreshing||printing||frameBlocked())return;if(canonicalSignature()!==lastSig)scheduleRefresh(650)},2200);
 return true;
}
function file(){try{return new File([html()],`Krakow_Pocket_Album_${new Date().toISOString().slice(0,10)}.html`,{type:"text/html;charset=utf-8"})}catch{return null}}
function download(){const f=file();if(!f)return false;const a=document.createElement("a"),url=URL.createObjectURL(f);a.href=url;a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);return true}
async function share(){const f=file();if(!f)return false;try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[f]}))){await navigator.share({title:"Kraków · Ismael & Laura",text:"Nuestro álbum digital de Cracovia",files:[f]});return true}}catch(e){if(e?.name==="AbortError")return true}return download()}
async function print(){
 printing=true;clearTimeout(refreshTimer);refreshTimer=0;
 try{
  if(!dialog?.open)open();const start=Date.now();
  while(!frame?.contentDocument?.querySelector('[data-kp-album-v5="1"]')&&Date.now()-start<4500)await new Promise(r=>setTimeout(r,50));
  if(!frame?.contentDocument?.querySelector('[data-kp-album-v5="1"]'))return false;
  frame.contentWindow.focus();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));frame.contentWindow.print();return true;
 }catch{return false}finally{printing=false;flushPending()}
}

function loadImage(f){return new Promise((res,rej)=>{const u=URL.createObjectURL(f),i=new Image();i.onload=()=>{URL.revokeObjectURL(u);res(i)};i.onerror=e=>{URL.revokeObjectURL(u);rej(e)};i.src=u})}
function jpeg(i,max,q){const iw=i.naturalWidth||i.width,ih=i.naturalHeight||i.height,k=Math.min(1,max/Math.max(iw,ih)),w=Math.max(1,Math.round(iw*k)),h=Math.max(1,Math.round(ih*k)),c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d",{alpha:false});x.fillStyle="#fff";x.fillRect(0,0,w,h);x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";x.drawImage(i,0,0,w,h);return{data:c.toDataURL("image/jpeg",q),width:w,height:h}}
async function compress(f){const i=await loadImage(f);let o=jpeg(i,1280,.78);if(o.data.length>170000)o=jpeg(i,1120,.72);if(o.data.length>145000)o=jpeg(i,960,.69);if(o.data.length>125000)o=jpeg(i,820,.66);if(o.data.length>110000)o=jpeg(i,720,.63);return o}
let addDialog=null;
function missionOptions(){const d=window.KP_DATA||{quests:[],pois:[]};return'<option value="">Sin asociar a una misión</option>'+(d.quests||[]).map(q=>{const p=d.pois.find(x=>x.id===q.poi);return`<option value="${esc(q.poi)}">${esc(p?.emoji||"📍")} ${esc(p?.name||q.title||q.poi)}</option>`}).join("")}
function ensureAddDialog(){
 if(addDialog?.isConnected)return addDialog;addDialog=document.createElement("dialog");addDialog.id="kpAlbumV6AddDialog";
 addDialog.innerHTML=`<div class="kp-album-add-shell"><div class="row start"><div><div class="smart-kicker">ÁLBUM COMPARTIDO</div><h2>Añadir fotos</h2><p class="small">Puedes elegir varias. Ninguna sustituye a las anteriores.</p></div><button class="kp-album-add-close" type="button">✕</button></div><label class="kp-album-file">📷 Elegir fotos<input id="kpAlbumV6Files" type="file" accept="image/*" multiple></label><div class="field"><span>Misión opcional</span><select id="kpAlbumV6Mission">${missionOptions()}</select></div><div class="field"><span>Título opcional</span><input id="kpAlbumV6Title" placeholder="Ej. Atardecer junto al Vístula"></div><div class="field"><span>Lugar opcional</span><input id="kpAlbumV6Place" placeholder="Cracovia"></div><div class="field"><span>Comentario opcional</span><textarea id="kpAlbumV6Comment" rows="2"></textarea></div><button class="btn green full" id="kpAlbumV6Save" type="button" disabled>Guardar fotos</button><div class="small" id="kpAlbumV6Status"></div><div id="kpAlbumV6Manage"></div></div>`;
 document.body.appendChild(addDialog);$(".kp-album-add-close",addDialog).onclick=()=>addDialog.close();$("#kpAlbumV6Files",addDialog).onchange=()=>{$("#kpAlbumV6Save",addDialog).disabled=!$("#kpAlbumV6Files",addDialog).files?.length};$("#kpAlbumV6Save",addDialog).onclick=savePhotos;renderManagedPhotos();return addDialog;
}
function renderManagedPhotos(){
 if(!addDialog?.isConnected)return;const host=$("#kpAlbumV6Manage",addDialog),list=active(protectedState().albumPhotos).filter(x=>x.source==="album-extra").sort((a,b)=>stamp(b)-stamp(a)).slice(0,20);
 host.innerHTML=list.length?'<div class="smart-kicker" style="margin-top:16px">FOTOS AÑADIDAS</div>'+list.map(x=>`<div class="kp-album-manage-row"><img src="${x.photo}" alt=""><span><b>${esc(x.title||x.place||"Foto")}</b><small>${esc(x.by||"Ambos")}</small></span><button type="button" data-del="${esc(x.id)}">✕</button></div>`).join(""):"";
 host.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>removePhoto(b.dataset.del));
}
function openAdd(){ensureAddDialog();renderManagedPhotos();if(!addDialog.open)addDialog.showModal()}
function removePhoto(id){
 const s=protectedState(),p=(s.albumPhotos||[]).find(x=>x.id===id);if(!p)return;const t=now();p.deletedAt=t;p.updatedAt=t;s.updatedAt=t;
 try{localStorage.setItem(STORAGE,JSON.stringify(s));dispatchData("kp:album-photos-local");nudgeSync();renderManagedPhotos();patchCard();scheduleRefresh(500)}catch{}
}
function nudgeSync(){try{document.getElementById("dailyTarget")?.dispatchEvent(new Event("change",{bubbles:true}))}catch{}}
function dispatchData(type){try{window.dispatchEvent(new CustomEvent(type));window.dispatchEvent(new CustomEvent("kp:statechange",{detail:{source:"album-controller"}}))}catch{}}
async function savePhotos(){
 const input=$("#kpAlbumV6Files",addDialog),files=[...(input.files||[])];if(!files.length)return;
 const status=$("#kpAlbumV6Status",addDialog),button=$("#kpAlbumV6Save",addDialog);button.disabled=true;
 const missionId=$("#kpAlbumV6Mission",addDialog).value,title=$("#kpAlbumV6Title",addDialog).value.trim(),place=$("#kpAlbumV6Place",addDialog).value.trim(),comment=$("#kpAlbumV6Comment",addDialog).value.trim();
 const d=window.KP_DATA||{pois:[]},poi=d.pois.find(x=>x.id===missionId),who=localStorage.getItem(PLAYER)||"Ismael";
 try{
  const out=[];
  for(let i=0;i<files.length;i++){
   status.textContent=`Preparando ${i+1}/${files.length}…`;const o=await compress(files[i]),t=now(),fp=photoHash(o.data);
   out.push({id:`photo-${Date.now().toString(36)}-${i}-${fp}`,missionId,title:title?(files.length>1?`${title} · ${i+1}`:title):(poi?.name||place||"Recuerdo del viaje"),place:place||poi?.name||"Cracovia",photo:o.data,comment,by:who,verified:false,createdAt:t,completedAt:t,updatedAt:t,photoWidth:o.width,photoHeight:o.height,photoHash:fp,source:"album-extra"});
  }
  const s=protectedState();s.albumPhotos=mergeRecords(s.albumPhotos||[],out);s.updatedAt=now();localStorage.setItem(STORAGE,JSON.stringify(s));dispatchData("kp:album-photos-local");nudgeSync();
  status.textContent=`✓ ${out.length} foto${out.length===1?"":"s"} guardada${out.length===1?"":"s"} para los dos.`;input.value="";$("#kpAlbumV6Title",addDialog).value="";$("#kpAlbumV6Comment",addDialog).value="";renderManagedPhotos();patchCard();scheduleRefresh(500);
 }catch{status.textContent="No se pudieron guardar. Prueba con menos fotos o elimina alguna añadida.";button.disabled=false}
}

function installStyles(){
 if(document.getElementById("kpAlbumNextStyles"))return;const s=document.createElement("style");s.id="kpAlbumNextStyles";
 s.textContent='#kpAlbumV5Card .kp-album-next-note{margin-top:9px;padding:9px 11px;border-radius:13px;background:rgba(82,125,57,.11);font-size:12px}#kpAlbumV5Card .kp-v5-buttons{grid-template-columns:1fr 1fr!important}#kpAlbumV6Add{grid-column:1/-1}#kpAlbumV5Dialog .kp-v5-shell>footer{grid-template-columns:repeat(4,1fr)!important}#kpAlbumV6AddDialog{border:0;padding:0;background:transparent;width:100%;height:100%;max-width:none;max-height:none}#kpAlbumV6AddDialog::backdrop{background:#1b120ddb;backdrop-filter:blur(8px)}.kp-album-add-shell{position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));max-width:620px;margin:auto;max-height:88dvh;overflow:auto;padding:18px;border-radius:24px;background:#f7edd9;border:2px solid #6d432b;color:#3d271c}.kp-album-add-close{width:44px;height:44px;border:2px solid #6d432b;border-radius:14px;background:#fff4d4}.kp-album-file{min-height:54px;margin:13px 0;display:flex;align-items:center;justify-content:center;border:2px dashed #8f6546;border-radius:16px;background:#fff8e8;font-weight:900}.kp-album-file input{position:absolute;opacity:0;width:1px;height:1px}.kp-album-add-shell .field{margin-top:10px}.kp-album-add-shell .field>span{display:block;font-size:12px;font-weight:800;margin-bottom:5px}.kp-album-add-shell input,.kp-album-add-shell select,.kp-album-add-shell textarea{width:100%;min-height:44px;border:1px solid #b99875;border-radius:12px;background:#fff;padding:10px;font:inherit}.kp-album-manage-row{display:grid;grid-template-columns:48px 1fr 40px;align-items:center;gap:9px;margin-top:8px;padding:7px;border-radius:12px;background:#fff8e8}.kp-album-manage-row img{width:48px;height:48px;object-fit:cover;border-radius:9px}.kp-album-manage-row b,.kp-album-manage-row small{display:block}.kp-album-manage-row button{width:38px;height:38px;border:0;border-radius:10px;background:#ead8c3}@media(max-width:420px){#kpAlbumV5Card .kp-v5-buttons{grid-template-columns:1fr!important}#kpAlbumV6Add{grid-column:auto}#kpAlbumV5Dialog .kp-v5-shell>footer{grid-template-columns:repeat(4,1fr)!important}#kpAlbumV5Dialog .kp-v5-shell>footer button{font-size:10px!important}}';
 document.head.appendChild(s);
}
function patchCard(){
 const c=document.getElementById("kpAlbumV5Card");if(!c)return;const buttons=c.querySelector(".kp-v5-buttons");
 if(buttons&&!document.getElementById("kpAlbumV6Add")){const b=document.createElement("button");b.id="kpAlbumV6Add";b.className="btn secondary";b.type="button";b.textContent="＋ Añadir fotos al álbum";buttons.appendChild(b)}
 if(!c.querySelector(".kp-album-next-note")){const n=document.createElement("div");n.className="kp-album-next-note";n.textContent="📸 Podéis guardar varias fotos del mismo lugar sin que una sustituya a otra.";(buttons||c).insertAdjacentElement("beforebegin",n)}
 const pill=c.querySelector(".row.start .pill"),n=photoCount(),text=`${n} foto${n===1?"":"s"}`;if(pill&&pill.textContent!==text)pill.textContent=text;
}
function installApi(){
 const api=captureBase();if(!api?.html)return false;
 window.KP_ALBUM_V5={...window.KP_ALBUM_V5,version:"5.0",albumModelVersion:VERSION,html,open,download,share,print,file,stateSignature:canonicalSignature,multiPhoto:true,verticalPhotosUncropped:true,preservesSupersededEvidence:true,eventDrivenRefresh:true};
 window.KP_ALBUM_EXPERIENCE={...(window.KP_ALBUM_EXPERIENCE||{}),version:"5.0",albumModelVersion:VERSION,html,open,download,share,print,file,multiPhoto:true,eventDrivenRefresh:true};
 if(window.KP_MISSION_PROOF){window.KP_MISSION_PROOF.openAlbum=open;window.KP_MISSION_PROOF.downloadAlbum=download}
 return true;
}
function patch(){installStyles();const ok=installApi();patchCard();return ok}
function handleData(){archiveReplacedEvidence();patch();scheduleRefresh(600)}

document.addEventListener("click",e=>{
 const id=e.target.closest?.("button")?.id||"";
 if(id==="kpAlbumV5Open"){e.preventDefault();e.stopImmediatePropagation();open()}
 else if(id==="kpAlbumV5QuickShare"||id==="kpAlbumV5Share"||id==="kpAlbumV5ShareTop"){e.preventDefault();e.stopImmediatePropagation();share()}
 else if(id==="kpAlbumV5Download"){e.preventDefault();e.stopImmediatePropagation();download()}
 else if(id==="kpAlbumV5Pdf"){e.preventDefault();e.stopImmediatePropagation();print()}
 else if(id==="kpAlbumV5Close"){e.preventDefault();e.stopImmediatePropagation();document.getElementById("kpAlbumV5Dialog")?.close()}
 else if(id==="kpAlbumV6Add"||id==="kpAlbumV6AddViewer"){e.preventDefault();e.stopImmediatePropagation();openAdd()}
 else if(e.target.closest?.('.tab[data-panel="diary"]'))setTimeout(patch,50);
},true);

function boot(){
 captureBase();archiveReplacedEvidence();patch();[100,350,900].forEach(ms=>setTimeout(patch,ms));
 ["kp:mission-evidence-local","kp:mission-evidence-sync","kp:album-photos-sync","kp:album-photos-local","kp:diary-sync","kp:statechange","storage","pageshow"].forEach(t=>window.addEventListener(t,handleData));
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)handleData()});
 window.KP_ALBUM_NEXT={version:VERSION,controllerRevision:"20260812a",multiPhoto:true,open,add:openAdd,html,download,print,share,photoCount,archiveReplacedEvidence,eventDrivenRefresh:true,singleRefreshOwner:true,protectedStateProjection:true,semanticContentSignature:true,quiescentRefresh:true,noGlobalMutationObserver:true,noContinuousDomPolling:true,serializedRefresh:true,printRefreshLock:true,scrollIntentProtocol:true,deferredOverlayRefresh:true};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();