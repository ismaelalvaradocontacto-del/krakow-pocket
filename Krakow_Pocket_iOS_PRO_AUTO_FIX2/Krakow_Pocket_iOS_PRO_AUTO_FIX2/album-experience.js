(() => {
"use strict";
if(window.__kpAlbumExperience)return;
window.__kpAlbumExperience=true;

const VERSION="2.0";
const STORAGE="krakowPocketCoop";
const D=()=>window.KP_DATA||{pois:[],quests:[],days:[]};
const $=s=>document.querySelector(s);
const esc=(s="")=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>`${Number(n||0).toFixed(2).replace(".",",")} €`;
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return{}}};
const activeExpenses=s=>(s.expenses||[]).filter(x=>x&&!x.deletedAt);
const activeMemories=s=>(s.memories||[]).filter(x=>x&&!x.deletedAt);
const totalSpent=s=>activeExpenses(s).reduce((a,x)=>a+(+x.amount||0),0);
const missionDone=(s,id)=>s.missionStatus?.[id]?!!s.missionStatus[id].done:(s.visited||[]).includes(id);
const completed=s=>D().quests.filter(q=>missionDone(s,q.poi)).length;
const poi=id=>D().pois.find(p=>p.id===id);
let dialog=null,frame=null,lastSignature="";

const EXTRA_INFO={
  auschwitz:{title:"Auschwitz-Birkenau",emoji:"🕯️",comment:"Una visita para recordar y aprender. Esta parada queda en la crónica con respeto, sin convertirla en puntuación ni recompensa.",extra:true}
};

function dateValue(entry,state,id){
  const op=state.missionStatus?.[id]||{};
  const raw=entry?.completedAt||entry?.verifiedAt||entry?.ts||entry?.updatedAt||op?.completedAt||op?.updatedAt||op?.ts||state.updatedAt;
  const d=new Date(raw||Date.now());
  return Number.isNaN(d.getTime())?new Date():d;
}
function dayKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function dayMeta(d){
  const key=dayKey(d),trip=D().days.find((x,i)=>x.date===key?true:false),idx=D().days.findIndex(x=>x.date===key);
  if(trip)return{key,label:`Día ${idx+1}`,title:trip.title||key,date:new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long"}).format(d)};
  return{key,label:"Extra",title:"Fuera de la ruta principal",date:new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long"}).format(d)};
}
function evidenceEntries(state=read()){
  const ev=state.missionEvidence&&typeof state.missionEvidence==="object"?state.missionEvidence:{};
  return Object.entries(ev).filter(([,e])=>e&&e.photo).map(([id,e])=>{
    const p=poi(id),extra=EXTRA_INFO[id],date=dateValue(e,state,id),meta=dayMeta(date);
    return{
      id,
      title:e.title||extra?.title||p?.name||id,
      emoji:extra?.emoji||p?.emoji||"📍",
      photo:e.photo,
      comment:e.comment||extra?.comment||p?.story||"Un momento guardado para volver a él después.",
      by:e.by||e.player||e.completedBy||"Ambos",
      distance:Number.isFinite(+e.distance)?Math.round(+e.distance):null,
      date,
      meta,
      extra:!!extra?.extra||!!e.extra,
      verified:!!e.verified
    };
  }).sort((a,b)=>a.date-b.date);
}
function signature(){
  const s=read(),entries=evidenceEntries(s);
  return JSON.stringify([entries.map(x=>[x.id,x.photo?.length,x.date?.toISOString?.(),x.by,x.distance]),activeMemories(s).map(m=>[m.id,m.updatedAt,m.deletedAt]),activeExpenses(s).map(x=>[x.id,x.amount,x.deletedAt]),s.updatedAt]);
}

function albumData(){
  const s=read(),entries=evidenceEntries(s),memories=activeMemories(s).slice().sort((a,b)=>new Date(a.ts||a.updatedAt||0)-new Date(b.ts||b.updatedAt||0));
  const groups=[];
  for(const item of entries){let g=groups.find(x=>x.key===item.meta.key);if(!g){g={...item.meta,items:[]};groups.push(g)}g.items.push(item)}
  const first=entries[0]||null,last=entries[entries.length-1]||null;
  return{
    entries,groups,memories,
    stats:{missions:completed(s),total:D().quests.length||12,photos:entries.length,memories:memories.length,spent:totalSpent(s)},
    first,last,
    generatedAt:new Date(),
    complete:completed(s)>=(D().quests.length||12)
  };
}

function standaloneHtml(){
  const a=albumData();
  const coverPhoto=a.entries.find(x=>!x.extra)?.photo||a.entries[0]?.photo||"";
  const groups=a.groups.map((g,gi)=>`<section class="chapter reveal" style="--delay:${gi*.05}s"><div class="chapter-head"><span>${esc(g.label)}</span><div><h2>${esc(g.title)}</h2><p>${esc(g.date)}</p></div></div><div class="photo-grid">${g.items.map((x,i)=>`<article class="photo-card reveal ${x.extra?"respect":""}" style="--delay:${(i+1)*.07}s"><button class="photo-button" type="button" aria-label="Ver ${esc(x.title)} a pantalla completa"><img src="${x.photo}" alt="${esc(x.title)}" loading="lazy"></button><div class="photo-copy">${x.extra?'<span class="respect-badge">EXTRA · MEMORIA</span>':""}<div class="meta">${x.verified?"✓ GPS verificado · ":""}${x.distance!=null?`${x.distance} m · `:""}${esc(x.by)}</div><h3>${esc(x.emoji)} ${esc(x.title)}</h3><blockquote><span>🐉</span><p>${esc(x.comment)}</p></blockquote></div></article>`).join("")}</div></section>`).join("");
  const memories=a.memories.length?`<section class="memories reveal"><div class="section-title"><span>✨</span><div><small>LO QUE NO CABE EN UNA FOTO</small><h2>Recuerdos escritos</h2></div></div><div class="memory-grid">${a.memories.map(m=>`<article><div class="memory-pin">✦</div><h3>${esc(m.title||"Recuerdo")}</h3>${m.place?`<div class="memory-place">📍 ${esc(m.place)}</div>`:""}<p>${esc(m.note||"")}</p><small>${esc(m.by||"Ambos")}</small></article>`).join("")}</div></section>`:"";
  const title=a.complete?"Nuestra aventura por Cracovia":"Nuestro álbum de Cracovia";
  const subtitle=a.entries.length?`${a.stats.photos} fotografías · ${a.stats.missions}/${a.stats.total} misiones · Ismael + Laura`:"Las fotos aparecerán aquí a medida que completéis las misiones.";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#402719"><title>Kraków · Ismael & Laura · 2026</title><style>
  :root{--ink:#35261d;--muted:#755e4d;--paper:#f5e2b7;--cream:#fff5d8;--green:#60784c;--brown:#68432d;--shadow:rgba(56,34,22,.18)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#2e211a;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-x:hidden}.book{max-width:980px;margin:auto;background:linear-gradient(180deg,#f7e8c4,#efd8a6);min-height:100vh;box-shadow:0 0 70px rgba(0,0,0,.35)}
  .cover{min-height:92vh;position:relative;display:grid;place-items:end center;overflow:hidden;background:linear-gradient(180deg,#513526 0%,#805f43 50%,#d4ad70 100%);isolation:isolate}.cover-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.92) contrast(1.03);opacity:${coverPhoto?".76":"0"};z-index:-2}.cover:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,18,12,.06),rgba(30,18,12,.28) 55%,rgba(30,18,12,.82));z-index:-1}.cover-copy{width:min(90%,760px);text-align:center;color:#fff8e9;padding:40px 20px max(54px,env(safe-area-inset-bottom));text-shadow:0 2px 18px rgba(0,0,0,.4)}.cover-kicker{font-size:12px;letter-spacing:.22em;font-weight:900}.cover h1{font-family:Georgia,serif;font-size:clamp(42px,10vw,82px);line-height:.92;margin:14px 0}.cover p{font-size:clamp(16px,4vw,21px);line-height:1.5;margin:0 auto;max-width:620px}.scroll-cue{margin:28px auto 0;width:42px;height:42px;border:1px solid rgba(255,255,255,.65);border-radius:999px;display:grid;place-items:center;animation:float 1.8s ease-in-out infinite}
  .toolbar{position:sticky;top:0;z-index:20;display:flex;gap:8px;align-items:center;justify-content:center;padding:10px max(10px,env(safe-area-inset-left));background:rgba(245,226,183,.91);backdrop-filter:blur(14px);border-bottom:1px solid rgba(104,67,45,.28)}.toolbar button{border:1px solid #8b674e;background:#fff5d8;color:#4a3325;border-radius:999px;padding:10px 14px;font:inherit;font-weight:800}.toolbar button:hover{transform:translateY(-1px)}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:28px 18px}.stat{text-align:center;padding:17px 8px;background:rgba(255,245,216,.74);border:1px solid rgba(104,67,45,.24);border-radius:20px}.stat strong{display:block;font-family:Georgia,serif;font-size:28px}.stat span{font-size:12px;color:var(--muted);font-weight:800}
  .chapter{padding:26px 18px 44px}.chapter-head{display:flex;gap:14px;align-items:center;margin-bottom:18px}.chapter-head>span{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:#5e754a;color:white;font-weight:900;box-shadow:0 5px 0 #415235}.chapter-head h2{font-family:Georgia,serif;font-size:30px;margin:0}.chapter-head p{margin:4px 0 0;color:var(--muted);text-transform:capitalize}.photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.photo-card{background:var(--cream);border:1px solid rgba(104,67,45,.38);border-radius:24px;overflow:hidden;box-shadow:0 12px 30px var(--shadow);transform-origin:center}.photo-card:nth-child(even){transform:rotate(.35deg)}.photo-card:nth-child(odd){transform:rotate(-.28deg)}.photo-card.respect{background:#eee6db}.photo-button{border:0;padding:0;background:none;width:100%;display:block;cursor:zoom-in}.photo-button img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;transition:transform .8s cubic-bezier(.2,.7,.2,1)}.photo-card:hover img{transform:scale(1.035)}.photo-copy{padding:16px 17px 19px}.meta{font-size:11px;letter-spacing:.06em;font-weight:900;color:#80614c;text-transform:uppercase}.photo-copy h3{font-family:Georgia,serif;font-size:24px;margin:6px 0 12px}.photo-copy blockquote{margin:0;display:flex;gap:9px;padding:12px;background:#f5e7bd;border-radius:16px;border-left:4px solid #6c844f}.photo-copy blockquote span{font-size:22px}.photo-copy blockquote p{margin:0;line-height:1.45}.respect-badge{display:inline-block;margin:0 0 8px;padding:5px 8px;border:1px solid #8b7d70;border-radius:999px;color:#5b5149;font-size:9px;font-weight:900;letter-spacing:.12em}
  .memories{padding:44px 18px;background:rgba(255,247,224,.55)}.section-title{display:flex;gap:13px;align-items:center;margin-bottom:18px}.section-title>span{font-size:38px}.section-title small{font-weight:900;letter-spacing:.12em;color:var(--muted)}.section-title h2{font-family:Georgia,serif;font-size:31px;margin:2px 0}.memory-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.memory-grid article{position:relative;padding:22px 18px 18px;background:#fff5d8;border:1px solid rgba(104,67,45,.3);border-radius:6px 18px 18px 18px;box-shadow:0 7px 18px var(--shadow)}.memory-pin{position:absolute;right:12px;top:9px;color:#a97844}.memory-grid h3{margin:0 24px 7px 0;font-family:Georgia,serif;font-size:21px}.memory-grid p{line-height:1.5}.memory-place{font-size:12px;font-weight:800;color:var(--muted)}
  .ending{padding:70px 20px 80px;text-align:center;background:linear-gradient(180deg,transparent,rgba(96,120,76,.18))}.ending .dragon{font-size:56px;animation:float 2.2s ease-in-out infinite}.ending h2{font-family:Georgia,serif;font-size:38px;margin:8px}.ending p{max-width:620px;margin:10px auto;line-height:1.6}.ending small{color:var(--muted)}
  .reveal{opacity:0;transform:translateY(22px);transition:opacity .75s ease var(--delay,0s),transform .75s cubic-bezier(.2,.75,.2,1) var(--delay,0s)}.reveal.on{opacity:1;transform:none}.lightbox{position:fixed;inset:0;z-index:99;background:rgba(24,16,12,.94);display:none;place-items:center;padding:18px}.lightbox.open{display:grid}.lightbox img{max-width:96vw;max-height:88vh;border-radius:18px;box-shadow:0 20px 70px #000}.lightbox button{position:absolute;right:max(16px,env(safe-area-inset-right));top:max(16px,env(safe-area-inset-top));width:48px;height:48px;border:1px solid #fff7;border-radius:50%;background:#fff2;color:#fff;font-size:22px}
  @keyframes float{50%{transform:translateY(-7px)}}@media(max-width:680px){.cover{min-height:84vh}.stats{grid-template-columns:repeat(2,1fr)}.photo-grid,.memory-grid{grid-template-columns:1fr}.photo-card:nth-child(n){transform:none}.chapter{padding-left:12px;padding-right:12px}.toolbar{justify-content:flex-start;overflow-x:auto}.toolbar button{white-space:nowrap}}
  @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.scroll-cue,.ending .dragon{animation:none}.reveal{opacity:1;transform:none;transition:none}.photo-button img{transition:none}}
  @media print{body{background:white}.book{box-shadow:none;max-width:none}.cover{min-height:255mm;break-after:page}.toolbar,.scroll-cue,.lightbox{display:none!important}.reveal{opacity:1!important;transform:none!important}.chapter{break-before:page;padding:12mm}.photo-grid{gap:8mm}.photo-card{box-shadow:none;break-inside:avoid}.memories{break-before:page}.ending{break-before:page}.photo-button img{max-height:95mm}.stats{break-after:avoid}}
  </style></head><body><main class="book"><section class="cover">${coverPhoto?`<img class="cover-photo" src="${coverPhoto}" alt="">`:""}<div class="cover-copy"><div class="cover-kicker">KRAKÓW · ISMAEL & LAURA · 2026</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p><div class="scroll-cue">⌄</div></div></section><nav class="toolbar"><button type="button" id="printAlbum">📄 Guardar como PDF</button><button type="button" id="topAlbum">↑ Portada</button><button type="button" id="endAlbum">↓ Final</button></nav><section class="stats reveal"><div class="stat"><strong>${a.stats.photos}</strong><span>FOTOGRAFÍAS</span></div><div class="stat"><strong>${a.stats.missions}/${a.stats.total}</strong><span>MISIONES</span></div><div class="stat"><strong>${a.stats.memories}</strong><span>RECUERDOS</span></div><div class="stat"><strong>${money(a.stats.spent)}</strong><span>GASTO VARIABLE</span></div></section>${groups||'<section class="chapter"><div class="kp-album-empty">Todavía no hay fotografías verificadas.</div></section>'}${memories}<section class="ending" id="albumEnd"><div class="dragon">🐉</div><h2>${a.complete?"Aventura completada":"La historia continúa"}</h2><p>${a.complete?"Doce encargos, dos viajeros y una Cracovia que ya no es solo un punto en el mapa.":"Este álbum crecerá automáticamente con cada misión, fotografía y recuerdo que guardéis."}</p><small>Generado por Kraków Pocket · ${new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"long",year:"numeric"}).format(a.generatedAt)}</small></section></main><div class="lightbox" id="lightbox"><button type="button" aria-label="Cerrar">✕</button><img alt="Fotografía ampliada"></div><script>
  (()=>{const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,items=[...document.querySelectorAll('.reveal')];if(reduce)items.forEach(x=>x.classList.add('on'));else{const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target)}}),{threshold:.12});items.forEach(x=>io.observe(x))}const lb=document.getElementById('lightbox'),li=lb.querySelector('img');document.querySelectorAll('.photo-button').forEach(b=>b.addEventListener('click',()=>{li.src=b.querySelector('img').src;li.alt=b.querySelector('img').alt;lb.classList.add('open')}));lb.addEventListener('click',e=>{if(e.target===lb||e.target.tagName==='BUTTON')lb.classList.remove('open')});document.getElementById('printAlbum').onclick=()=>print();document.getElementById('topAlbum').onclick=()=>scrollTo({top:0,behavior:reduce?'auto':'smooth'});document.getElementById('endAlbum').onclick=()=>document.getElementById('albumEnd').scrollIntoView({behavior:reduce?'auto':'smooth'});document.addEventListener('keydown',e=>{if(e.key==='Escape')lb.classList.remove('open')})})();
  <\/script></body></html>`;
}

function file(){return new File([standaloneHtml()],`Krakow_Pocket_Album_${new Date().toISOString().slice(0,10)}.html`,{type:"text/html"})}
function download(){
  const f=file(),url=URL.createObjectURL(f),a=document.createElement("a");a.href=url;a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function share(){
  const f=file();
  try{
    if(navigator.share&&navigator.canShare?.({files:[f]})){await navigator.share({title:"Kraków · Ismael & Laura",text:"Nuestro álbum interactivo de Cracovia",files:[f]});return}
  }catch(e){if(e?.name==="AbortError")return}
  download();
}
function printAlbum(){
  const iframe=$("#kpAlbumExperienceFrame");
  try{iframe?.contentWindow?.focus();iframe?.contentWindow?.print()}catch{const w=window.open(URL.createObjectURL(new Blob([standaloneHtml()],{type:"text/html"})),"_blank");if(!w)download()}
}

function ensureDialog(){
  if(dialog)return dialog;
  dialog=document.createElement("dialog");dialog.id="kpAlbumExperienceDialog";dialog.innerHTML=`<div class="kp-ae-shell"><header><div><div class="smart-kicker">ÁLBUM INTERACTIVO</div><strong>Kraków · Ismael & Laura</strong></div><div class="kp-ae-header-actions"><button id="kpAlbumShare" aria-label="Compartir">↗</button><button id="kpAlbumClose" aria-label="Cerrar">✕</button></div></header><iframe id="kpAlbumExperienceFrame" title="Álbum interactivo de Cracovia"></iframe><footer><button id="kpAlbumDownload">⬇️ HTML offline</button><button id="kpAlbumPdf">📄 PDF / imprimir</button><button id="kpAlbumShareBottom">↗ Compartir</button></footer></div>`;document.body.appendChild(dialog);
  $("#kpAlbumClose").onclick=()=>dialog.close();$("#kpAlbumDownload").onclick=download;$("#kpAlbumPdf").onclick=printAlbum;$("#kpAlbumShare").onclick=share;$("#kpAlbumShareBottom").onclick=share;
  dialog.addEventListener("close",()=>{document.documentElement.classList.remove("kp-album-open")});
  return dialog;
}
function open(){
  ensureDialog();const f=$("#kpAlbumExperienceFrame");f.srcdoc=standaloneHtml();document.documentElement.classList.add("kp-album-open");if(!dialog.open)dialog.showModal();
}

function injectStyles(){
  if($("style[data-kp-album-experience]"))return;
  const s=document.createElement("style");s.dataset.kpAlbumExperience="2";s.textContent=`
  #kpAlbumCard{display:none!important}#kpAlbumExperienceCard{margin-top:12px;background:linear-gradient(145deg,#fff0c7,#efd08d);overflow:hidden}#kpAlbumExperienceCard .kp-ae-title{font-family:Georgia,serif;font-size:25px;margin:3px 0}#kpAlbumExperienceCard .kp-ae-preview{display:flex;margin:13px -3px 0;min-height:70px}#kpAlbumExperienceCard .kp-ae-preview img{width:31%;aspect-ratio:1;object-fit:cover;border:3px solid #fff0c7;border-radius:14px;margin-right:-5px;box-shadow:0 4px 10px rgba(68,40,24,.18);transform:rotate(-3deg)}#kpAlbumExperienceCard .kp-ae-preview img:nth-child(2){transform:rotate(2deg);z-index:2}#kpAlbumExperienceCard .kp-ae-preview img:nth-child(3){transform:rotate(-1deg)}#kpAlbumExperienceCard .kp-ae-buttons{display:grid;grid-template-columns:1.35fr 1fr;gap:8px;margin-top:13px}
  #kpAlbumExperienceDialog{border:0;padding:0;background:transparent;max-width:none;max-height:none;width:100%;height:100%;margin:0}#kpAlbumExperienceDialog::backdrop{background:rgba(37,24,16,.82);backdrop-filter:blur(5px)}.kp-ae-shell{position:fixed;inset:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;background:#f3deb0;border:2px solid #67442e;border-radius:25px;box-shadow:0 18px 70px rgba(0,0,0,.4)}.kp-ae-shell>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#f5e3ba;border-bottom:1px solid #aa845b}.kp-ae-shell>header strong{display:block;font-family:Georgia,serif;font-size:19px}.kp-ae-header-actions{display:flex;gap:7px}.kp-ae-header-actions button{width:44px;height:44px;border:2px solid #755038;border-radius:14px;background:#fff1cf;font:inherit;font-weight:900}.kp-ae-shell iframe{border:0;width:100%;height:100%;background:#2e211a}.kp-ae-shell>footer{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:9px;background:#f5e3ba;border-top:1px solid #aa845b}.kp-ae-shell>footer button{min-height:46px;border:2px solid #755038;border-radius:13px;background:#fff1cf;color:#442d20;font:inherit;font-size:12px;font-weight:900}.kp-ae-shell>footer button:first-child{background:#5e754a;color:#fff;border-color:#445638}@media(max-width:390px){#kpAlbumExperienceCard .kp-ae-buttons{grid-template-columns:1fr}.kp-ae-shell>footer{grid-template-columns:1fr 1fr}.kp-ae-shell>footer button:first-child{grid-column:1/-1}}`;
  document.head.appendChild(s);
}
function renderCard(){
  const diary=$("#diary");if(!diary)return;let card=$("#kpAlbumExperienceCard");if(!card){card=document.createElement("article");card.id="kpAlbumExperienceCard";card.className="card";const seg=diary.querySelector(".segment");seg?.insertAdjacentElement("afterend",card)}
  const a=albumData(),pre=a.entries.slice(-3).reverse();
  card.innerHTML=`<div class="row start"><div><div class="smart-kicker">VUESTRO RECUERDO DIGITAL</div><div class="kp-ae-title">📖 Álbum interactivo</div></div><span class="pill ${a.complete?"green":"gold"}">${a.stats.photos} foto${a.stats.photos===1?"":"s"}</span></div><p class="small">Fotos, días, comentarios, recuerdos y animaciones en un álbum que podéis abrir, compartir o conservar como HTML y PDF.</p>${pre.length?`<div class="kp-ae-preview">${pre.map(x=>`<img src="${x.photo}" alt="">`).join("")}</div>`:""}<div class="kp-ae-buttons"><button class="btn green" id="kpAlbumOpenExperience">✨ Abrir álbum</button><button class="btn secondary" id="kpAlbumQuickShare">↗ Compartir</button></div>`;
  $("#kpAlbumOpenExperience").onclick=open;$("#kpAlbumQuickShare").onclick=share;
}
function render(){injectStyles();renderCard();if(dialog?.open){const sig=signature();if(sig!==lastSignature){lastSignature=sig;const f=$("#kpAlbumExperienceFrame");if(f)f.srcdoc=standaloneHtml()}}}
function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=null;render()})}
function boot(){render();lastSignature=signature();window.addEventListener("kp:statechange",schedule);window.addEventListener("kp:mission-evidence-local",schedule);window.addEventListener("storage",schedule);document.addEventListener("click",e=>{if(e.target.closest?.('.tab[data-panel="diary"]'))setTimeout(schedule,30)},true);if(new URLSearchParams(location.search).get("album")==="1")setTimeout(open,1800);window.KP_ALBUM_EXPERIENCE={version:VERSION,open,download,share,html:standaloneHtml,print:printAlbum,interactive:true,offlineHtml:true,pdfViaPrint:true,lightbox:true,animations:true}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
