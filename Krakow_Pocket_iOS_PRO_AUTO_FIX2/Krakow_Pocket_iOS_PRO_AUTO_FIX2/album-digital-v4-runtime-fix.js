(() => {
"use strict";
if (window.__kpAlbumDigitalV4RuntimeFix) return;
window.__kpAlbumDigitalV4RuntimeFix = true;
const VERSION="1.2";
let sourceHtml=null,patched=false;

const SAFETY_CSS=`
<style data-kp-digital-runtime-safety="1">
.story-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important}
.story-head-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;margin-left:auto!important;position:relative!important;z-index:8!important;flex:0 0 auto!important}
.story-head .overlay-close{position:static!important;inset:auto!important;right:auto!important;top:auto!important;flex:0 0 42px!important;width:42px!important;height:42px!important;margin:0!important;transform:none!important;z-index:1!important}
.story-head .digital-play{position:relative!important;inset:auto!important;margin:0!important;z-index:2!important;pointer-events:auto!important}
@media(max-width:360px){.story-head{gap:6px!important}.story-head-actions{gap:5px!important}.story-head .digital-play{min-width:74px!important;padding-inline:8px!important}}
</style>`;

const EXPORT_RUNTIME=`
(() => {
 "use strict";
 function mount(){
  if(window.__kpDigitalAlbumRuntimeFixV12)return true;
  const story=document.getElementById("storyMode"),data=document.getElementById("kpAlbumPhotoData");
  if(!story||!data)return false;
  let photos=[];try{photos=JSON.parse(data.textContent||"[]")}catch{}
  if(!photos.length)return false;
  window.__kpDigitalAlbumRuntimeFixV12=true;
  const head=story.querySelector(".story-head"),close=head?.querySelector(".overlay-close");
  let actions=head?.querySelector(".story-head-actions");
  if(!actions&&head){actions=document.createElement("div");actions.className="story-head-actions";if(close){close.remove();actions.appendChild(close)}head.appendChild(actions)}
  let play=story.querySelector(".digital-play");
  if(!play){play=document.createElement("button");play.type="button";play.className="digital-play";play.textContent="▶ Reproducir";actions?.insertBefore(play,actions.firstChild)}
  let film=story.querySelector(".digital-filmstrip");
  if(!film){film=document.createElement("div");film.className="digital-filmstrip";film.setAttribute("aria-label","Miniaturas del álbum");photos.forEach((p,i)=>{const b=document.createElement("button");b.type="button";b.dataset.index=String(i);b.setAttribute("aria-label","Ir a "+p.title);const im=document.createElement("img");im.src=p.photo;im.alt="";im.loading="lazy";b.appendChild(im);film.appendChild(b)});story.appendChild(film)}
  const controls=story.querySelector(".story-controls");let progress=story.querySelector(".digital-story-progress");
  if(!progress&&controls){progress=document.createElement("div");progress.className="digital-story-progress";progress.setAttribute("aria-hidden","true");progress.innerHTML="<i></i>";controls.appendChild(progress)}
  const pos=story.querySelector(".story-position");pos?.classList.add("digital-counter");
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;let timer=0,playing=false;
  const indexNow=()=>{const n=parseInt(pos?.textContent||"1",10);return Number.isFinite(n)?Math.max(0,Math.min(photos.length-1,n-1)):0};
  function stop(){playing=false;clearInterval(timer);timer=0;play?.classList.remove("playing");if(play)play.textContent="▶ Reproducir"}
  function sync(){const i=indexNow(),p=photos[i];if(!p)return;story.style.backgroundImage="linear-gradient(rgba(8,7,6,.58),rgba(8,7,6,.58)),url("+JSON.stringify(p.photo)+")";const bar=progress?.querySelector("i");if(bar)bar.style.width=((i+1)/photos.length*100)+"%";film?.querySelectorAll("button").forEach((b,n)=>b.classList.toggle("active",n===i));if(playing&&i>=photos.length-1)stop()}
  function start(){if(reduce||photos.length<2)return;if(indexNow()>=photos.length-1){for(let i=indexNow();i>0;i--)document.getElementById("storyPrev")?.click()}playing=true;play?.classList.add("playing");if(play)play.textContent="Ⅱ Pausar";clearInterval(timer);timer=setInterval(()=>document.getElementById("storyNext")?.click(),4500)}
  play?.addEventListener("click",()=>playing?stop():start());
  film?.addEventListener("click",e=>{const b=e.target.closest("button[data-index]");if(!b)return;stop();const target=Number(b.dataset.index),cur=indexNow(),button=target>=cur?"storyNext":"storyPrev";for(let i=0;i<Math.abs(target-cur);i++)document.getElementById(button)?.click();sync()});
  document.getElementById("storyPrev")?.addEventListener("click",()=>{if(playing)stop();setTimeout(sync,0)},{capture:true});
  document.getElementById("storyNext")?.addEventListener("click",()=>setTimeout(sync,0),{capture:true});
  close?.addEventListener("click",stop,{capture:true});story.addEventListener("touchstart",()=>{if(playing)stop()},{passive:true});
  if(pos)new MutationObserver(sync).observe(pos,{childList:true,subtree:true,characterData:true});
  document.getElementById("storyAlbum")?.addEventListener("click",()=>setTimeout(sync,0));sync();return true;
 }
 if(!mount()){document.addEventListener("DOMContentLoaded",mount,{once:true});let n=0,t=setInterval(()=>{n++;if(mount()||n>80)clearInterval(t)},50)}
})();`;

function removeObsoleteRuntime(html){
 const marker="window.__kpDigitalAlbumRuntimeV4";
 const at=html.indexOf(marker);
 if(at<0)return html;
 const start=html.lastIndexOf("<script",at),end=html.indexOf("</script>",at);
 if(start<0||end<0)return html;
 return html.slice(0,start)+html.slice(end+9);
}

function enhance(input){
 let html=String(input||"");
 if(!html)return html;
 html=removeObsoleteRuntime(html);
 if(!html.includes('data-kp-digital-runtime-safety="1"'))html=html.replace("</head>",SAFETY_CSS+"</head>");
 if(!html.includes('data-kp-digital-runtime-fix="1"'))html=html.replace("</body>",`<script data-kp-digital-runtime-fix="1">${EXPORT_RUNTIME}<\/script></body>`);
 return html;
}

function patchApi(){
 const api=window.KP_ALBUM_EXPERIENCE;
 if(!api||patched||!api.digitalAlbum||typeof api.html!=="function")return false;
 sourceHtml=api.html.bind(api);
 api.html=()=>enhance(sourceHtml());
 api.cinemaRuntimeStable=true;
 api.cinemaRuntimeDirectMount=true;
 api.obsoleteRuntimeRemoved=true;
 patched=true;
 return true;
}

function armDocument(doc){
 if(!doc?.documentElement)return false;
 doc.documentElement.dataset.kpDigitalRuntimeInjected="1";
 return true;
}

function ensureSafetyStyle(doc){
 if(!doc?.head||doc.head.querySelector('[data-kp-digital-runtime-safety="1"]'))return;
 const box=doc.createElement("div");box.innerHTML=SAFETY_CSS;
 const style=box.firstElementChild;if(style)doc.head.appendChild(style);
}

function mountLive(doc){
 if(!doc?.body)return false;
 armDocument(doc);ensureSafetyStyle(doc);
 const root=doc.documentElement;
 if(root.dataset.kpDigitalDirectMounted==="1")return true;
 const story=doc.getElementById("storyMode"),data=doc.getElementById("kpAlbumPhotoData");
 if(!story||!data)return false;
 let photos=[];try{photos=JSON.parse(data.textContent||"[]")}catch{}
 if(!photos.length)return false;
 const win=doc.defaultView;if(!win)return false;
 root.dataset.kpDigitalDirectMounted="1";
 const head=story.querySelector(".story-head"),close=head?.querySelector(".overlay-close");
 let actions=head?.querySelector(".story-head-actions");
 if(!actions&&head){actions=doc.createElement("div");actions.className="story-head-actions";if(close){close.remove();actions.appendChild(close)}head.appendChild(actions)}
 let play=story.querySelector(".digital-play");
 if(!play){play=doc.createElement("button");play.type="button";play.className="digital-play";play.textContent="▶ Reproducir";actions?.insertBefore(play,actions.firstChild)}
 let film=story.querySelector(".digital-filmstrip");
 if(!film){film=doc.createElement("div");film.className="digital-filmstrip";film.setAttribute("aria-label","Miniaturas del álbum");photos.forEach((p,i)=>{const b=doc.createElement("button");b.type="button";b.dataset.index=String(i);b.setAttribute("aria-label","Ir a "+p.title);const im=doc.createElement("img");im.src=p.photo;im.alt="";im.loading="lazy";b.appendChild(im);film.appendChild(b)});story.appendChild(film)}
 const controls=story.querySelector(".story-controls");let progress=story.querySelector(".digital-story-progress");
 if(!progress&&controls){progress=doc.createElement("div");progress.className="digital-story-progress";progress.setAttribute("aria-hidden","true");progress.innerHTML="<i></i>";controls.appendChild(progress)}
 const pos=story.querySelector(".story-position");pos?.classList.add("digital-counter");
 const reduce=!!win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;let timer=0,playing=false;
 const indexNow=()=>{const n=parseInt(pos?.textContent||"1",10);return Number.isFinite(n)?Math.max(0,Math.min(photos.length-1,n-1)):0};
 function stop(){playing=false;win.clearInterval(timer);timer=0;play?.classList.remove("playing");if(play)play.textContent="▶ Reproducir"}
 function sync(){const i=indexNow(),p=photos[i];if(!p)return;story.style.setProperty("--digital-bg",`url(${JSON.stringify(p.photo)})`);const bar=progress?.querySelector("i");if(bar)bar.style.width=`${((i+1)/photos.length)*100}%`;film?.querySelectorAll("button").forEach((b,n)=>b.classList.toggle("active",n===i));if(playing&&i>=photos.length-1)stop()}
 function start(){if(reduce||photos.length<2)return;if(indexNow()>=photos.length-1){for(let i=indexNow();i>0;i--)doc.getElementById("storyPrev")?.click()}playing=true;play?.classList.add("playing");if(play)play.textContent="Ⅱ Pausar";win.clearInterval(timer);timer=win.setInterval(()=>doc.getElementById("storyNext")?.click(),4500)}
 play?.addEventListener("click",()=>playing?stop():start());
 film?.addEventListener("click",e=>{const b=e.target.closest?.("button[data-index]");if(!b)return;stop();const target=Number(b.dataset.index),cur=indexNow(),button=target>=cur?"storyNext":"storyPrev";for(let i=0;i<Math.abs(target-cur);i++)doc.getElementById(button)?.click();sync()});
 doc.getElementById("storyPrev")?.addEventListener("click",()=>{if(playing)stop();win.setTimeout(sync,0)},{capture:true});
 doc.getElementById("storyNext")?.addEventListener("click",()=>win.setTimeout(sync,0),{capture:true});
 close?.addEventListener("click",stop,{capture:true});story.addEventListener("touchstart",()=>{if(playing)stop()},{passive:true});
 if(pos)new win.MutationObserver(sync).observe(pos,{childList:true,subtree:true,characterData:true});
 doc.getElementById("storyAlbum")?.addEventListener("click",()=>win.setTimeout(sync,0));sync();return true;
}

function watchFrame(frame){
 if(!frame)return false;
 armDocument(frame.contentDocument);
 if(frame.dataset.kpDigitalFixBound==="1")return true;
 frame.dataset.kpDigitalFixBound="1";
 frame.addEventListener("load",()=>{armDocument(frame.contentDocument);[0,20,60,140].forEach(ms=>setTimeout(()=>mountLive(frame.contentDocument),ms))});
 return true;
}

function boot(){
 let n=0;
 const scan=()=>{const frame=document.getElementById("kpAlbumExperienceFrame");watchFrame(frame);mountLive(frame?.contentDocument);patchApi()};
 scan();
 const observer=new MutationObserver(scan);observer.observe(document.documentElement,{childList:true,subtree:true});
 const timer=setInterval(()=>{n++;scan();if(patched&&n>60)clearInterval(timer);if(n>220)clearInterval(timer)},60);
 document.addEventListener("click",e=>{if(!e.target.closest?.("#kpAlbumOpenExperience"))return;scan();[0,15,45,100,220,500].forEach(ms=>setTimeout(scan,ms))},true);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
window.KP_ALBUM_DIGITAL_RUNTIME_FIX={version:VERSION,enhance,mountLive,stableInit:true,exportedRuntime:true,directIframeMount:true,obsoleteRuntimeRemoved:true,headerCollisionGuard:true};
})();