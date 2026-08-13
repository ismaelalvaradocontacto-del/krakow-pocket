(() => {
"use strict";
if (window.__kpAlbumV5) return;
window.__kpAlbumV5 = true;

const VERSION = "5.0";
const STORAGE = "krakowPocketCoop";
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const D = () => window.KP_DATA || { pois:[], quests:[], days:[] };
const esc = (s="") => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => `${Number(n||0).toFixed(2).replace(".",",")} €`;
const read = () => { try { return JSON.parse(localStorage.getItem(STORAGE)||"{}"); } catch { return {}; } };
const active = list => (Array.isArray(list)?list:[]).filter(x=>x&&!x.deletedAt);
const ts = value => { const n = new Date(value||0).getTime(); return Number.isFinite(n)?n:0; };

let dialog = null;
let frame = null;
let card = null;
let openTimer = 0;
let openSignature = "";
let pendingRefresh = false;

const EXTRA = {
  auschwitz:{ title:"Auschwitz-Birkenau", emoji:"🕯️", extra:true, comment:"Una visita para recordar y aprender. Esta parada queda en el álbum con respeto, sin convertirla en puntuación ni recompensa." }
};

function missionDone(s,id){ return s.missionStatus?.[id] ? !!s.missionStatus[id].done : (s.visited||[]).includes(id); }
function completed(s){ return D().quests.filter(q=>missionDone(s,q.poi)).length; }
function poi(id){ return D().pois.find(p=>p.id===id); }
function dateOf(entry,state,id){
  const op=state.missionStatus?.[id]||{};
  const raw=entry?.completedAt||entry?.verifiedAt||entry?.ts||entry?.updatedAt||op?.completedAt||op?.updatedAt||state.updatedAt;
  const d=new Date(raw||Date.now());
  return Number.isNaN(d.getTime())?new Date():d;
}
function dayKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function dayMeta(d){
  const key=dayKey(d),idx=D().days.findIndex(x=>x.date===key),trip=idx>=0?D().days[idx]:null;
  const date=new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long"}).format(d);
  return trip?{key,label:`Día ${idx+1}`,title:trip.title||key,date}:{key,label:"Extra",title:"Fuera de la ruta principal",date};
}
function evidenceEntries(state=read()){
  const evidence=state.missionEvidence&&typeof state.missionEvidence==="object"?state.missionEvidence:{};
  return Object.entries(evidence).filter(([,e])=>e&&typeof e.photo==="string"&&e.photo.startsWith("data:image/")).map(([id,e])=>{
    const p=poi(id),extra=EXTRA[id],date=dateOf(e,state,id);
    return {
      id,
      title:e.title||extra?.title||p?.name||id,
      place:e.place||p?.name||extra?.title||id,
      emoji:extra?.emoji||p?.emoji||"📍",
      photo:e.photo,
      comment:e.comment||extra?.comment||p?.story||"Un momento guardado para volver a él después.",
      by:e.by||e.player||e.completedBy||"Ambos",
      distance:Number.isFinite(+e.distance)?Math.round(+e.distance):null,
      verified:e.verified===true,
      extra:!!(extra?.extra||e.extra||e.bonus),
      date,
      meta:dayMeta(date)
    };
  }).sort((a,b)=>a.date-b.date);
}
function albumData(){
  const state=read(),entries=evidenceEntries(state),memories=active(state.memories).slice().sort((a,b)=>ts(a.ts||a.updatedAt)-ts(b.ts||b.updatedAt));
  const groups=[];
  for(const item of entries){ let g=groups.find(x=>x.key===item.meta.key); if(!g){g={...item.meta,items:[]};groups.push(g);} g.items.push(item); }
  const missions=completed(state),total=D().quests.length||12,spent=active(state.expenses).reduce((n,x)=>n+(+x.amount||0),0);
  return {state,entries,groups,memories,stats:{missions,total,photos:entries.length,memories:memories.length,spent},complete:missions>=total,generatedAt:new Date()};
}
function stateSignature(){
  const s=read(),e=s.missionEvidence||{};
  return JSON.stringify({
    evidence:Object.entries(e).map(([id,x])=>[id,x?.updatedAt||x?.completedAt||"",x?.photo?.length||0,x?.verified,x?.comment,x?.by]),
    memories:active(s.memories).map(x=>[x.id,x.updatedAt||x.ts,x.title,x.note,x.place,x.by]),
    expenses:active(s.expenses).map(x=>[x.id,x.updatedAt||x.ts,x.amount,x.category]),
    missions:D().quests.map(q=>[q.poi,missionDone(s,q.poi)])
  });
}

function photoMarkup(x,i){
  const meta=[x.verified?"✓ GPS":"",x.distance!=null?`${x.distance} m`:"",x.by].filter(Boolean).join(" · ");
  return `<article class="photo-card ${x.extra?"respect":""}" data-photo-index="${i}">
    <button class="photo-button" type="button" aria-label="Ampliar fotografía de ${esc(x.title)}"><img src="${x.photo}" alt="${esc(x.title)}" loading="${i<2?"eager":"lazy"}" decoding="async"></button>
    <div class="photo-copy"><div class="photo-topline">${x.extra?'<span class="respect-badge">EXTRA · MEMORIA</span>':'<span class="verified-badge">RECUERDO</span>'}<span class="photo-meta">${esc(meta)}</span></div><h3 class="photo-title"><span aria-hidden="true">${esc(x.emoji)}</span>${esc(x.title)}</h3><blockquote class="photo-comment ${x.extra?"quiet":""}"><p>${esc(x.comment)}</p></blockquote></div>
  </article>`;
}
function chapterMarkup(group,gi){
  let cursor=gi*20;
  return `<section class="chapter" id="chapter-${esc(group.key)}"><header class="chapter-head"><div class="chapter-number">${String(gi+1).padStart(2,"0")}</div><div><span class="chapter-date">${esc(group.date)}</span><div class="chapter-kicker">${esc(group.label)}</div><h2>${esc(group.title)}</h2></div><div class="chapter-count">${group.items.length} foto${group.items.length===1?"":"s"}</div></header><div class="photo-grid">${group.items.map((x,i)=>photoMarkup(x,cursor+i)).join("")}</div></section>`;
}
function memoryMarkup(memories){
  if(!memories.length)return "";
  return `<section class="memories" id="albumMemories"><header class="section-title"><small>NOTAS DEL VIAJE</small><h2>Recuerdos escritos</h2></header><div class="memory-grid">${memories.map(m=>`<article class="memory-card"><h3>${esc(m.title||"Recuerdo")}</h3>${m.place?`<div class="memory-place">📍 ${esc(m.place)}</div>`:""}<p>${esc(m.note||"")}</p><small>${esc(m.by||"Ambos")}</small></article>`).join("")}</div></section>`;
}

function standaloneHtml(){
  const a=albumData(),cover=a.entries.find(x=>!x.extra)?.photo||a.entries[0]?.photo||"";
  const title=a.complete?"Nuestra aventura por Cracovia":"Nuestro álbum de Cracovia";
  const subtitle=a.entries.length?`${a.stats.photos} fotografía${a.stats.photos===1?"":"s"} · ${a.stats.missions}/${a.stats.total} misiones · Ismael + Laura`:"El álbum crecerá con las fotografías y recuerdos del viaje.";
  const toc=a.groups.map((g,i)=>`<a href="#chapter-${esc(g.key)}"><span>${String(i+1).padStart(2,"0")}</span><strong>${esc(g.title)}</strong><small>${esc(g.label)} · ${g.items.length} foto${g.items.length===1?"":"s"}</small></a>`).join("");
  const chapters=a.groups.map(chapterMarkup).join("");
  const storyButton=a.entries.length?'<button class="js-only story-launch" type="button" id="storyAlbum">▶ Historia</button>':'';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#171310"><meta name="color-scheme" content="light"><meta name="kp-album-version" content="${VERSION}"><title>Kraków · Ismael & Laura · 2026</title><style>
:root{--ink:#2d2723;--muted:#776e67;--paper:#f8f5ee;--warm:#eee5d8;--dark:#171310;--line:rgba(52,42,35,.14);--green:#5d7252;--serif:Georgia,"Times New Roman",serif}*{box-sizing:border-box}html{scroll-behavior:smooth;background:var(--dark);scroll-padding-top:70px;overflow-anchor:none}body{margin:0;background:var(--dark);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;overflow-x:hidden}.book{max-width:1180px;margin:auto;min-height:100vh;background:var(--paper);overflow:hidden}.js-only{display:none!important}.js .js-only{display:inline-flex!important}button,a{font:inherit}button:focus-visible,a:focus-visible{outline:3px solid #3477b8;outline-offset:3px}
.cover{min-height:min(94svh,900px);position:relative;display:grid;align-items:end;isolation:isolate;background:linear-gradient(145deg,#5d4d41,#1b1714);overflow:hidden}.cover-photo{position:absolute;inset:-2%;width:104%;height:104%;object-fit:cover;z-index:-3;filter:saturate(.94) contrast(1.04) brightness(.87)}.cover::before{content:"";position:absolute;inset:0;z-index:-2;background:linear-gradient(180deg,rgba(8,7,6,.04),rgba(8,7,6,.12) 40%,rgba(8,7,6,.88))}.cover-copy{padding:72px clamp(22px,6vw,78px) max(68px,env(safe-area-inset-bottom));color:#fff7eb;max-width:980px}.cover-kicker{font-size:11px;letter-spacing:.2em;font-weight:800}.cover h1{font:500 clamp(46px,8vw,92px)/.92 var(--serif);letter-spacing:-.045em;margin:16px 0;max-width:820px}.cover p{font-size:clamp(16px,2.6vw,22px);line-height:1.45;margin:0;max-width:670px}.cover-progress{margin-top:26px;width:min(390px,92%);display:grid;grid-template-columns:1fr auto;gap:8px 10px;font-size:12px;font-weight:800}.cover-progress i{grid-column:1/-1;height:5px;background:#ffffff40;border-radius:99px;overflow:hidden}.cover-progress i::before{content:"";display:block;height:100%;width:${Math.min(100,(a.stats.missions/Math.max(1,a.stats.total))*100)}%;background:#efd194}.scroll-cue{margin-top:28px;width:44px;height:44px;border:1px solid #ffffff70;border-radius:50%;display:grid;place-items:center;color:white;text-decoration:none;background:#ffffff14}
.toolbar{position:sticky;top:8px;z-index:40;width:max-content;max-width:calc(100% - 18px);margin:-56px auto 34px;padding:6px;display:flex;gap:4px;border:1px solid var(--line);border-radius:999px;background:#faf7f1e8;box-shadow:0 10px 34px #21191322;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}.toolbar a,.toolbar button{min-height:40px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:999px;background:transparent;color:#403731;text-decoration:none;padding:8px 11px;font-size:12px;font-weight:760;white-space:nowrap}.toolbar .story-launch{background:#2f2a26;color:white}
.stats-wrap{max-width:900px;margin:auto;padding:5px 22px 40px}.stats{display:grid;grid-template-columns:repeat(4,1fr);border-block:1px solid var(--line)}.stat{padding:20px 8px;text-align:center;border-right:1px solid var(--line)}.stat:last-child{border-right:0}.stat strong{display:block;font:500 clamp(22px,4vw,32px)/1 var(--serif)}.stat span{display:block;margin-top:7px;font-size:9px;letter-spacing:.11em;color:var(--muted);font-weight:850}
.toc{max-width:900px;margin:14px auto 74px;padding:0 22px}.toc-head{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:22px}.toc h2,.section-title h2{font:500 clamp(31px,5vw,47px)/1 var(--serif);letter-spacing:-.03em;margin:0}.toc-head small{color:var(--muted)}.toc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.toc-grid a{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;align-items:center;min-height:88px;padding:14px 16px;border:1px solid var(--line);border-radius:18px;background:#fff;color:var(--ink);text-decoration:none}.toc-grid a span{grid-row:1/3;font:500 27px var(--serif);color:#6f6258}.toc-grid a strong{font-size:14px}.toc-grid a small{font-size:11px;color:var(--muted)}.empty{padding:28px;border:1px dashed #a69a91;border-radius:18px;color:var(--muted);text-align:center}
.chapter{max-width:1040px;margin:auto;padding:74px 28px 102px;border-top:1px solid var(--line)}.chapter-head{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:end;margin-bottom:38px}.chapter-number{font:400 clamp(48px,8vw,80px)/.78 var(--serif);letter-spacing:-.06em;color:#322b26}.chapter-date{display:block;font-size:11px;color:var(--muted);text-transform:capitalize}.chapter-kicker{margin-top:4px;font-size:10px;letter-spacing:.12em;color:#887b71;font-weight:850}.chapter h2{font:500 clamp(28px,4.5vw,45px)/1 var(--serif);letter-spacing:-.025em;margin:3px 0 0}.chapter-count{padding:6px 9px;border-radius:999px;background:#ebe5dc;color:#6f665e;font-size:11px}.photo-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:44px 20px}.photo-card{grid-column:span 6}.photo-card:nth-child(4n+1){grid-column:1/-1}.photo-card:nth-child(4n+4){grid-column:2/12}.photo-button{width:100%;padding:0;border:0;border-radius:22px;overflow:hidden;background:#ddd;display:block;box-shadow:0 14px 34px #231b161c;cursor:zoom-in}.photo-button img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}.photo-card:nth-child(4n+1) .photo-button img,.photo-card:nth-child(4n+4) .photo-button img{aspect-ratio:16/9;max-height:610px}.photo-copy{padding:17px 2px 0}.photo-topline{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.verified-badge,.respect-badge{padding:4px 7px;border:1px solid #786b6038;border-radius:999px;font-size:8px;letter-spacing:.08em;color:#685f58;font-weight:850}.photo-meta{font-size:9px;letter-spacing:.05em;color:#8a817a;text-transform:uppercase;font-weight:800}.photo-title{font:500 clamp(22px,3vw,31px)/1.05 var(--serif);letter-spacing:-.015em;margin:10px 0 11px;display:flex;gap:7px}.photo-comment{max-width:720px;margin:0;padding:0 0 0 15px;border-left:2px solid #9d8e80;color:#514943;line-height:1.55;font-size:14px}.photo-comment p{margin:0}.respect .photo-button{filter:saturate(.78)}.respect-badge{background:#e8e3dd}.quiet{border-left-color:#81766c}
.memories{max-width:1040px;margin:auto;padding:76px 28px 96px;border-top:1px solid var(--line)}.section-title{margin-bottom:28px}.section-title small{display:block;margin-bottom:6px;color:var(--muted);letter-spacing:.13em;font-size:10px;font-weight:850}.memory-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.memory-card{padding:24px;border:1px solid var(--line);border-radius:20px;background:#fff}.memory-card h3{font:500 22px var(--serif);margin:0 0 8px}.memory-card p{line-height:1.62}.memory-card small,.memory-place{color:var(--muted);font-size:12px}.pdf-help{max-width:900px;margin:0 auto 70px;padding:20px 22px;border-radius:18px;background:#eee8de;color:#554c45}.pdf-help h2{font:500 25px var(--serif);margin:0 0 8px}.pdf-help p{line-height:1.5;margin:7px 0}.ending{min-height:70svh;display:grid;place-content:center;text-align:center;padding:90px 28px;background:#1d1815;color:#f8eee1}.ending-strip{width:min(720px,88vw);margin:0 auto 24px;display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.ending-strip:empty{display:none}.ending-strip img{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}.ending h2{font:500 clamp(38px,7vw,66px)/1 var(--serif);letter-spacing:-.035em;margin:8px}.ending p{max-width:620px;margin:10px auto;line-height:1.6;color:#ddd0c3}.ending small{color:#aa9b8e}
.lightbox,.story-mode{position:fixed;inset:0;z-index:1000;display:none;color:white;background:#090807f8}.lightbox.open,.story-mode.open{display:grid}.lightbox{place-items:center;padding:max(14px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(14px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left))}.lightbox figure{margin:0;display:grid;gap:10px;max-width:min(96vw,1200px)}.lightbox img{max-width:100%;max-height:84svh;border-radius:10px;justify-self:center}.lightbox figcaption{text-align:center;color:#dcd1c7;font-size:13px}.overlay-close{width:44px;height:44px;border:1px solid #ffffff40;border-radius:50%;background:#ffffff18;color:white;font-size:20px}.lightbox .overlay-close{position:absolute;right:max(14px,env(safe-area-inset-right));top:max(14px,env(safe-area-inset-top))}.lightbox-nav{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:56px;border:1px solid #ffffff40;border-radius:14px;background:#ffffff15;color:white;font-size:24px}.lightbox-prev{left:10px}.lightbox-next{right:10px}
.story-mode{grid-template-rows:auto minmax(0,1fr) auto auto;background:#111;background-size:cover;background-position:center}.story-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:max(12px,env(safe-area-inset-top)) 14px 8px;background:linear-gradient(#0008,transparent)}.story-head strong{font-size:12px;letter-spacing:.1em;text-transform:uppercase}.story-actions{display:flex;align-items:center;gap:7px}.story-play{min-height:42px;padding:0 13px;border:1px solid #ffffff40;border-radius:999px;background:#ffffff18;color:white;font-weight:750}.story-play:disabled{opacity:.55}.story-stage{min-height:0;display:grid;place-items:center;padding:10px 16px}.story-card{width:min(980px,100%);height:min(72svh,720px);display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);overflow:hidden;border-radius:18px;background:#f7f2e9;color:var(--ink);box-shadow:0 22px 80px #0008}.story-card img{width:100%;height:100%;min-height:0;object-fit:contain;background:#090807}.story-copy{padding:24px;display:flex;flex-direction:column;justify-content:center;overflow:auto}.story-copy small{color:var(--muted);font-weight:800}.story-copy h2{font:500 clamp(28px,5vw,44px)/1 var(--serif);margin:8px 0 16px}.story-copy blockquote{margin:0;line-height:1.6}.story-controls{display:grid;grid-template-columns:1fr auto 1fr;gap:9px;padding:8px 14px}.story-controls button{min-height:44px;border:1px solid #ffffff3d;border-radius:13px;background:#ffffff13;color:white;font-weight:780}.story-position{display:grid;place-items:center;min-width:54px;font-weight:800}.story-progress{height:3px;background:#ffffff28;margin:0 14px}.story-progress i{display:block;height:100%;width:0;background:#f0d7a7;transition:width .25s}.filmstrip{display:flex;gap:7px;padding:8px max(14px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom));overflow-x:auto;scrollbar-width:none}.filmstrip::-webkit-scrollbar{display:none}.filmstrip button{flex:0 0 62px;width:62px;height:48px;padding:0;border:2px solid transparent;border-radius:9px;overflow:hidden;background:#222}.filmstrip button.active{border-color:#fff}.filmstrip img{width:100%;height:100%;object-fit:cover;display:block}
@media(max-width:700px){.cover-copy{text-align:center;margin:auto;padding-inline:22px}.cover h1{font-size:clamp(42px,12vw,60px)}.cover-progress{margin-inline:auto;text-align:left}.scroll-cue{margin-inline:auto}.toolbar{top:5px;width:calc(100% - 16px);max-width:none;display:grid;grid-template-columns:repeat(5,1fr);border-radius:18px;margin-top:-48px}.toolbar a,.toolbar button{min-width:0;padding:7px 2px;font-size:11px}.stats-wrap{padding-inline:14px}.stats{grid-template-columns:repeat(2,1fr)}.stat:nth-child(2){border-right:0}.stat:nth-child(-n+2){border-bottom:1px solid var(--line)}.toc{padding-inline:14px}.toc-grid{grid-template-columns:1fr}.chapter{padding:62px 14px 76px}.chapter-head{grid-template-columns:auto 1fr}.chapter-count{grid-column:2;justify-self:start}.photo-grid{grid-template-columns:1fr;gap:42px}.photo-card,.photo-card:nth-child(4n+1),.photo-card:nth-child(4n+4){grid-column:1!important}.photo-button img,.photo-card:nth-child(4n+1) .photo-button img,.photo-card:nth-child(4n+4) .photo-button img{aspect-ratio:4/3;max-height:none}.memories{padding:62px 14px 78px}.memory-grid{grid-template-columns:1fr}.pdf-help{margin-inline:14px}.story-card{height:auto;max-height:70svh;grid-template-columns:1fr;grid-template-rows:minmax(0,46svh) auto}.story-card img{object-fit:contain}.story-copy{padding:17px;max-height:24svh}.story-copy h2{font-size:28px}.story-head{gap:6px}.story-play{padding-inline:9px}.story-controls{padding-inline:10px}}
@media(max-width:340px){.toolbar a,.toolbar button{font-size:10px}.chapter-number{font-size:44px}.story-head strong{font-size:10px}.story-play{font-size:11px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.story-progress i{transition:none}}
@media print{@page{size:A4;margin:10mm}html,body,.book{background:white!important}.book{max-width:none}.cover{min-height:265mm;break-after:page}.toolbar,.scroll-cue,.lightbox,.story-mode{display:none!important}.stats-wrap{padding:0 0 8mm}.toc{break-after:page;margin:0;padding:8mm 0}.chapter{break-before:page;padding:8mm 0;border:0}.photo-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7mm}.photo-card,.photo-card:nth-child(4n+1),.photo-card:nth-child(4n+4){grid-column:auto!important;break-inside:avoid}.photo-button{box-shadow:none}.photo-button img,.photo-card:nth-child(4n+1) .photo-button img,.photo-card:nth-child(4n+4) .photo-button img{aspect-ratio:4/3;max-height:92mm}.memories{break-before:page;padding:8mm 0}.memory-card{break-inside:avoid}.pdf-help{display:none}.ending{break-before:page;min-height:260mm;background:white!important;color:#222!important}}
</style></head><body><script>document.documentElement.classList.add('js')<\/script><main class="book" data-kp-album-v5="1" id="albumTop"><section class="cover">${cover?`<img class="cover-photo" src="${cover}" alt="" decoding="async">`:""}<div class="cover-copy"><div class="cover-kicker">KRAKÓW · ISMAEL & LAURA · AGOSTO 2026</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p><div class="cover-progress"><span>Progreso de la aventura</span><strong>${a.stats.missions}/${a.stats.total}</strong><i aria-hidden="true"></i></div><a class="scroll-cue" href="#albumIndex" aria-label="Ir al índice">⌄</a></div></section><nav class="toolbar" aria-label="Navegación del álbum"><a href="#albumTop" aria-label="Portada">↑ <span>Portada</span></a><a href="#albumIndex" aria-label="Índice">☰ <span>Índice</span></a>${storyButton}<a id="albumPrint" href="#pdfHelp" aria-label="Guardar como PDF">PDF</a><a href="#albumEnd" aria-label="Final">↓ <span>Final</span></a></nav><section class="stats-wrap"><div class="stats"><div class="stat"><strong>${a.stats.photos}</strong><span>FOTOGRAFÍAS</span></div><div class="stat"><strong>${a.stats.missions}/${a.stats.total}</strong><span>MISIONES</span></div><div class="stat"><strong>${a.stats.memories}</strong><span>RECUERDOS</span></div><div class="stat"><strong>${money(a.stats.spent)}</strong><span>GASTO VARIABLE</span></div></div></section><section class="toc" id="albumIndex"><div class="toc-head"><h2>La historia, por capítulos</h2><small>${a.groups.length} jornada${a.groups.length===1?"":"s"}</small></div><div class="toc-grid">${toc||'<div class="empty">Todavía no hay fotografías guardadas.</div>'}</div></section>${chapters||'<section class="chapter"><div class="empty">Cuando guardéis una fotografía aparecerá aquí, sin tener que reconstruir el álbum.</div></section>'}${memoryMarkup(a.memories)}<section class="pdf-help" id="pdfHelp"><h2>Guardar como PDF</h2><p><strong>Safari, Chrome, Mac o PC:</strong> pulsa PDF para abrir la impresión y elige Guardar como PDF.</p><p><strong>Archivos/Quick Look en iPhone:</strong> si el visor no ejecuta JavaScript, usa Compartir → Imprimir y guarda la previsualización en Archivos.</p></section><section class="ending" id="albumEnd"><div class="ending-strip" aria-hidden="true"></div><div aria-hidden="true" style="font-size:42px">🐉</div><h2>${a.complete?"Aventura completada":"La historia continúa"}</h2><p>${a.complete?"Doce encargos, dos viajeros y una Cracovia que ya forma parte de vuestra historia.":"Este álbum seguirá creciendo con las fotografías y recuerdos que guardéis."}</p><small>Generado por Kraków Pocket · ${new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"long",year:"numeric"}).format(a.generatedAt)}</small></section></main><div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Fotografía ampliada"><button class="overlay-close" type="button" aria-label="Cerrar fotografía">✕</button><button class="lightbox-nav lightbox-prev" type="button" aria-label="Fotografía anterior">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="lightbox-nav lightbox-next" type="button" aria-label="Fotografía siguiente">›</button></div><div class="story-mode" id="storyMode" role="dialog" aria-modal="true" aria-label="Modo historia"><header class="story-head"><strong>Modo Historia</strong><div class="story-actions"><button class="story-play" type="button">▶ Reproducir</button><button class="overlay-close" type="button" aria-label="Cerrar modo historia">✕</button></div></header><div class="story-stage"><article class="story-card"><img alt=""><div class="story-copy"><small></small><h2></h2><blockquote></blockquote></div></article></div><div class="story-progress" aria-hidden="true"><i></i></div><footer class="story-controls"><button type="button" id="storyPrev">← Anterior</button><div class="story-position"></div><button type="button" id="storyNext">Siguiente →</button></footer><div class="filmstrip" aria-label="Miniaturas del álbum"></div></div><script>(()=>{const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)],cards=qa('.photo-card'),photos=cards.map(c=>({src:q('img',c)?.src||'',title:q('.photo-title',c)?.textContent?.trim()||'',meta:q('.photo-meta',c)?.textContent?.trim()||'',comment:q('.photo-comment p',c)?.textContent?.trim()||''})).filter(x=>x.src);const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;const end=q('.ending-strip');photos.slice(-4).forEach(p=>{const im=new Image();im.src=p.src;im.alt='';im.loading='lazy';end?.appendChild(im)});const lb=q('#lightbox'),lbImg=q('img',lb),lbCap=q('figcaption',lb);let li=0,lastFocus=null;function paintLb(i){if(!photos.length)return;li=(i+photos.length)%photos.length;const p=photos[li];lbImg.src=p.src;lbImg.alt=p.title;lbCap.textContent=p.title+' · '+p.meta}function close(el){el.classList.remove('open');document.body.style.overflow='';lastFocus?.focus?.()}cards.forEach((c,i)=>q('.photo-button',c)?.addEventListener('click',()=>{lastFocus=document.activeElement;paintLb(i);lb.classList.add('open');document.body.style.overflow='hidden';q('.overlay-close',lb)?.focus()}));q('.overlay-close',lb)?.addEventListener('click',()=>close(lb));q('.lightbox-prev',lb)?.addEventListener('click',()=>paintLb(li-1));q('.lightbox-next',lb)?.addEventListener('click',()=>paintLb(li+1));lb?.addEventListener('click',e=>{if(e.target===lb)close(lb)});const story=q('#storyMode'),launch=q('#storyAlbum'),play=q('.story-play',story),film=q('.filmstrip',story),pos=q('.story-position',story),bar=q('.story-progress i',story);let si=0,timer=0,playing=false,sx=null;photos.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.dataset.index=i;b.setAttribute('aria-label','Ir a '+p.title);const im=new Image();im.src=p.src;im.alt='';im.loading='lazy';b.appendChild(im);film.appendChild(b)});function stop(){playing=false;clearTimeout(timer);timer=0;if(play){play.textContent=photos.length<2?'1 foto':'▶ Reproducir';play.disabled=photos.length<2}}function schedule(){clearTimeout(timer);if(!playing)return;timer=setTimeout(()=>{if(si>=photos.length-1){stop();return}paintStory(si+1);schedule()},4500)}function paintStory(i){if(!photos.length)return;si=(i+photos.length)%photos.length;const p=photos[si],img=q('.story-card img',story);img.src=p.src;img.alt=p.title;q('.story-copy small',story).textContent=p.meta;q('.story-copy h2',story).textContent=p.title;q('.story-copy blockquote',story).textContent=p.comment;pos.textContent=(si+1)+' / '+photos.length;bar.style.width=((si+1)/photos.length*100)+'%';story.style.backgroundImage='linear-gradient(rgba(9,8,7,.58),rgba(9,8,7,.58)),url('+JSON.stringify(p.src)+')';qa('button',film).forEach((b,n)=>b.classList.toggle('active',n===si));qa('button',film)[si]?.scrollIntoView({behavior:reduce?'auto':'smooth',inline:'center',block:'nearest'})}function openStory(){if(!photos.length)return;lastFocus=document.activeElement;stop();paintStory(0);story.classList.add('open');document.body.style.overflow='hidden';q('.overlay-close',story)?.focus()}launch?.addEventListener('click',openStory);q('.overlay-close',story)?.addEventListener('click',()=>{stop();close(story)});q('#storyPrev')?.addEventListener('click',()=>{stop();paintStory(si-1)});q('#storyNext')?.addEventListener('click',()=>{stop();paintStory(si+1)});play?.addEventListener('click',()=>{if(reduce||photos.length<2)return;if(playing){stop();return}if(si>=photos.length-1)paintStory(0);playing=true;play.textContent='Ⅱ Pausar';schedule()});film?.addEventListener('click',e=>{const b=e.target.closest('button[data-index]');if(!b)return;stop();paintStory(Number(b.dataset.index))});story?.addEventListener('touchstart',e=>{sx=e.touches[0]?.clientX??null},{passive:true});story?.addEventListener('touchend',e=>{if(sx==null)return;const dx=(e.changedTouches[0]?.clientX??sx)-sx;sx=null;if(Math.abs(dx)>48){stop();paintStory(si+(dx<0?1:-1))}},{passive:true});stop();q('#albumPrint')?.addEventListener('click',e=>{e.preventDefault();print()});document.addEventListener('keydown',e=>{const active=story?.classList.contains('open')?story:lb?.classList.contains('open')?lb:null;if(!active)return;if(e.key==='Escape'){if(active===story)stop();close(active)}if(e.key==='ArrowLeft')active===story?(stop(),paintStory(si-1)):paintLb(li-1);if(e.key==='ArrowRight')active===story?(stop(),paintStory(si+1)):paintLb(li+1)})})()<\/script></body></html>`;
}

function albumFile(){
  const content=standaloneHtml();
  try{return new File([content],`Krakow_Pocket_Album_${new Date().toISOString().slice(0,10)}.html`,{type:"text/html;charset=utf-8"});}catch{return null;}
}
function download(){
  const content=standaloneHtml(),blob=new Blob([content],{type:"text/html;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`Krakow_Pocket_Album_${new Date().toISOString().slice(0,10)}.html`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);return true;
}
async function share(){
  const file=albumFile();if(!file)return false;
  try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:"Kraków · Ismael & Laura",text:"Nuestro álbum digital de Cracovia",files:[file]});return true;}}catch(e){if(e?.name==="AbortError")return true;}
  return download();
}
function frameHasAlbum(){
  try{return !!frame?.contentDocument?.querySelector('[data-kp-album-v5="1"]')}catch{return false}
}
function waitForFrameAlbum(timeout=4500){
  if(frameHasAlbum())return Promise.resolve(true);
  return new Promise(resolve=>{
    if(!frame){resolve(false);return}
    let settled=false;
    const done=ok=>{if(settled)return;settled=true;clearTimeout(timer);frame.removeEventListener("load",onLoad);resolve(ok)};
    const onLoad=()=>{requestAnimationFrame(()=>done(frameHasAlbum()))};
    const timer=setTimeout(()=>done(frameHasAlbum()),timeout);
    frame.addEventListener("load",onLoad);
  });
}
async function printAlbum(){
  if(!dialog?.open)open();
  if(!(await waitForFrameAlbum()))return false;
  try{
    frame.contentWindow.focus();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    frame.contentWindow.print();
    return true;
  }catch{return false}
}

function injectShellStyles(){
  if(document.getElementById("kpAlbumV5Styles"))return;
  const s=document.createElement("style");s.id="kpAlbumV5Styles";s.textContent=`#kpAlbumV5Card{overflow:hidden}#kpAlbumV5Card .kp-v5-title{font-family:Georgia,serif;font-size:26px;font-weight:700;color:var(--ink)}#kpAlbumV5Card .kp-v5-cover{height:168px;margin:12px 0;border-radius:18px;overflow:hidden;background:linear-gradient(145deg,#756153,#2b231f);position:relative}#kpAlbumV5Card .kp-v5-cover img{width:100%;height:100%;display:block;object-fit:cover}#kpAlbumV5Card .kp-v5-cover::after{content:"";position:absolute;inset:0;background:linear-gradient(transparent,#0005)}#kpAlbumV5Card .kp-v5-buttons{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}#kpAlbumV5Card .kp-v5-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}#kpAlbumV5Dialog{width:min(1180px,100vw);height:min(960px,100dvh);max-width:none;max-height:none;padding:0;border:0;border-radius:26px;background:#171310;box-shadow:0 28px 90px #0009;overflow:hidden}#kpAlbumV5Dialog::backdrop{background:#120d0ad9;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}.kp-v5-shell{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto}.kp-v5-shell>header{min-height:56px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:max(8px,env(safe-area-inset-top)) 11px 8px;background:#18130ff5;color:#fff6e8;border-bottom:1px solid #ffffff18}.kp-v5-shell>header .smart-kicker{color:#cdbfae;font-size:9px}.kp-v5-shell>header strong{font-family:Georgia,serif;font-size:17px}.kp-v5-head-actions{display:flex;gap:7px}.kp-v5-head-actions button{width:42px;height:42px;border:1px solid #ffffff35;border-radius:50%;background:#ffffff12;color:white;font-size:18px}#kpAlbumV5Frame{width:100%;height:100%;border:0;background:#111;min-height:0}.kp-v5-shell>footer{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:8px max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom));background:#18130ff5;border-top:1px solid #ffffff18}.kp-v5-shell>footer button{min-height:44px;border:1px solid #ffffff32;border-radius:13px;background:#ffffff12;color:#fff7e9;font-weight:780;font-size:12px;padding:7px}.kp-v5-shell>footer button:first-child{background:#f0dfbf;color:#3a2b21;border-color:#f0dfbf}html.kp-album-v5-open,html.kp-album-v5-open body{overflow:hidden}@media(max-width:700px){#kpAlbumV5Dialog{width:100vw;height:100dvh;border-radius:0}#kpAlbumV5Card .kp-v5-buttons{grid-template-columns:1fr}.kp-v5-shell>footer button{font-size:11px;padding-inline:3px}}`;
  document.head.appendChild(s);
}
function cleanupLegacy(){
  ["kpAlbumCard","kpAlbumDialog","kpAlbumExperienceCard","kpAlbumExperienceDialog"].forEach(id=>{const el=document.getElementById(id);if(el&&!el.closest?.("#kpAlbumV5Dialog"))el.remove();});
}
function patchLegacyApis(){
  if(window.KP_MISSION_PROOF){window.KP_MISSION_PROOF.openAlbum=open;window.KP_MISSION_PROOF.downloadAlbum=download;window.KP_MISSION_PROOF.albumUnifiedV5=true;}
}
function ensureDialog(){
  if(dialog?.isConnected)return dialog;
  dialog=document.createElement("dialog");dialog.id="kpAlbumV5Dialog";dialog.innerHTML=`<div class="kp-v5-shell"><header><div><div class="smart-kicker">ÁLBUM DIGITAL</div><strong>Kraków · Ismael & Laura</strong></div><div class="kp-v5-head-actions"><button id="kpAlbumV5ShareTop" type="button" aria-label="Compartir álbum">↗</button><button id="kpAlbumV5Close" type="button" aria-label="Cerrar álbum">✕</button></div></header><iframe id="kpAlbumV5Frame" title="Álbum digital de Cracovia"></iframe><footer><button id="kpAlbumV5Download" type="button">⬇ HTML</button><button id="kpAlbumV5Pdf" type="button">📄 PDF</button><button id="kpAlbumV5Share" type="button">↗ Compartir</button></footer></div>`;document.body.appendChild(dialog);frame=$("#kpAlbumV5Frame",dialog);$("#kpAlbumV5Close",dialog).onclick=()=>dialog.close();$("#kpAlbumV5Download",dialog).onclick=download;$("#kpAlbumV5Pdf",dialog).onclick=printAlbum;$("#kpAlbumV5Share",dialog).onclick=share;$("#kpAlbumV5ShareTop",dialog).onclick=share;dialog.addEventListener("close",()=>{document.documentElement.classList.remove("kp-album-v5-open");clearInterval(openTimer);openTimer=0;pendingRefresh=false;});return dialog;
}
function refreshFrame(preserve=true){
  if(!dialog?.open||!frame)return false;
  const doc=frame.contentDocument;
  if(doc?.querySelector("#storyMode.open,#lightbox.open")){pendingRefresh=true;return false;}
  const y=preserve?frame.contentWindow?.scrollY||0:0;
  const content=standaloneHtml();
  frame.addEventListener("load",()=>{
    const restore=()=>{try{frame.contentWindow.scrollTo(0,y)}catch{}};
    restore();
    try{frame.contentWindow.requestAnimationFrame(()=>{restore();frame.contentWindow.requestAnimationFrame(restore)})}catch{}
    setTimeout(restore,60);
  },{once:true});
  frame.srcdoc=content;openSignature=stateSignature();pendingRefresh=false;return true;
}
function monitorOpen(){
  if(window.KP_ALBUM_NEXT?.singleRefreshOwner)return;
  clearInterval(openTimer);openSignature=stateSignature();
  openTimer=setInterval(()=>{if(!dialog?.open){clearInterval(openTimer);openTimer=0;return;}const sig=stateSignature();if(sig===openSignature&&!pendingRefresh)return;const doc=frame?.contentDocument;if(doc?.querySelector("#storyMode.open,#lightbox.open")){pendingRefresh=true;return;}refreshFrame(true);},1200);
}
function open(){
  const owner=window.KP_ALBUM_NEXT;if(owner?.singleRefreshOwner&&typeof owner.open==="function"&&owner.open!==open)return owner.open();
  cleanupLegacy();injectShellStyles();ensureDialog();frame.srcdoc=standaloneHtml();openSignature=stateSignature();pendingRefresh=false;document.documentElement.classList.add("kp-album-v5-open");if(!dialog.open)dialog.showModal();monitorOpen();return true;
}
function renderCard(){
  cleanupLegacy();patchLegacyApis();const host=document.getElementById("diary-stories");if(!host)return false;
  card=document.getElementById("kpAlbumV5Card");if(!card){card=document.createElement("article");card.id="kpAlbumV5Card";card.className="card";const storyList=document.getElementById("storyList");if(storyList?.parentElement===host)host.insertBefore(card,storyList);else host.prepend(card);}
  const a=albumData(),cover=a.entries[0]?.photo||"";card.innerHTML=`<div class="row start"><div><div class="smart-kicker">VUESTRO RECUERDO DIGITAL</div><div class="kp-v5-title">📖 Álbum de la aventura</div></div><span class="pill ${a.complete?"green":"gold"}">${a.stats.photos} foto${a.stats.photos===1?"":"s"}</span></div><div class="kp-v5-meta"><span class="pill">${a.stats.missions}/${a.stats.total} misiones</span><span class="pill">${a.stats.memories} recuerdos</span>${a.entries.some(x=>x.extra)?'<span class="pill">🕯️ memoria extra</span>':''}</div>${cover?`<div class="kp-v5-cover"><img src="${cover}" alt="Vista previa del álbum" loading="lazy" decoding="async"></div>`:'<p class="small">Las fotografías verificadas aparecerán aquí a medida que avance la aventura.</p>'}<div class="kp-v5-buttons"><button class="btn green" id="kpAlbumV5Open" type="button">✨ Abrir álbum digital</button><button class="btn secondary" id="kpAlbumV5QuickShare" type="button" ${a.stats.photos?"":"disabled"}>↗ Compartir</button></div>`;$("#kpAlbumV5Open",card).onclick=open;$("#kpAlbumV5QuickShare",card).onclick=share;return true;
}
function scheduleCard(){setTimeout(()=>{cleanupLegacy();renderCard();},120);setTimeout(cleanupLegacy,320);}
function boot(){
  injectShellStyles();cleanupLegacy();renderCard();patchLegacyApis();
  ["kp:mission-evidence-local","kp:mission-evidence-sync","storage"].forEach(type=>window.addEventListener(type,scheduleCard));
  window.addEventListener("pageshow",scheduleCard,{passive:true});
  document.addEventListener("click",e=>{if(e.target.closest?.('.tab[data-panel="diary"]'))scheduleCard();else if(e.target.closest?.('#memoryForm,#expenseForm,#memorySave,#expenseSave,.memory-delete,.expense-delete'))scheduleCard();},true);
  document.addEventListener("change",e=>{if(e.target.closest?.('#memoryForm,#expenseForm,#dailyTarget'))scheduleCard();},true);
  const diary=document.getElementById("diary");if(diary)new MutationObserver(()=>{const legacy=document.getElementById("kpAlbumCard");if(legacy)legacy.remove();}).observe(diary,{childList:true,subtree:true});
  setTimeout(()=>{cleanupLegacy();renderCard();patchLegacyApis();},700);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
window.KP_ALBUM_DOCUMENT_FACTORY={version:VERSION,html:standaloneHtml,albumDocument:true,immutableSource:true};
window.KP_ALBUM_EXPERIENCE={version:VERSION,open,html:standaloneHtml,download,share,print:printAlbum,file:albumFile,digitalAlbum:true,unifiedSingleSource:true,legacyUiDisabled:true,iosQuickLookCompatible:true,noJsNavigation:true,offlineHtml:true,photoDataDeduplicated:true,storyMode:true,storyAutoplay:true,filmstrip:true,ambientStory:true,responsive:true,printReady:true,pdfWaitsForFrame:true,safariScrollRestore:true};
window.KP_ALBUM_V5={version:VERSION,open,html:standaloneHtml,download,share,print:printAlbum,renderCard,cleanupLegacy,stateSignature,singleSource:true,uniqueControlIds:true,boundedOpenMonitor:true,pdfWaitsForFrame:true,safariScrollRestore:true};
})();