(() => {
"use strict";
if (window.__kpAlbumDigitalV4RuntimeFix) return;
window.__kpAlbumDigitalV4RuntimeFix = true;
const VERSION="1.0";
let sourceHtml=null,patched=false;

const FIX_RUNTIME=`
(() => {
 "use strict";
 if(window.__kpDigitalAlbumRuntimeFixV1)return;
 const story=document.getElementById("storyMode"),data=document.getElementById("kpAlbumPhotoData");
 if(!story||!data)return;
 let photos=[];try{photos=JSON.parse(data.textContent||"[]")}catch{}
 if(!photos.length)return;
 window.__kpDigitalAlbumRuntimeFixV1=true;
 const head=story.querySelector(".story-head"),close=head?.querySelector(".overlay-close");
 let actions=head?.querySelector(".story-head-actions");
 if(!actions&&head){actions=document.createElement("div");actions.className="story-head-actions";if(close){close.remove();actions.appendChild(close)}head.appendChild(actions)}
 let play=story.querySelector(".digital-play");
 if(!play){play=document.createElement("button");play.type="button";play.className="digital-play";play.textContent="▶ Reproducir";actions?.insertBefore(play,actions.firstChild)}
 let film=story.querySelector(".digital-filmstrip");
 if(!film){film=document.createElement("div");film.className="digital-filmstrip";film.setAttribute("aria-label","Miniaturas del álbum");photos.forEach((p,i)=>{const b=document.createElement("button");b.type="button";b.dataset.index=String(i);b.setAttribute("aria-label","Ir a "+p.title);const im=document.createElement("img");im.src=p.photo;im.alt="";im.loading="lazy";b.appendChild(im);film.appendChild(b)});story.appendChild(film)}
 const controls=story.querySelector(".story-controls");
 let progress=story.querySelector(".digital-story-progress");
 if(!progress&&controls){progress=document.createElement("div");progress.className="digital-story-progress";progress.setAttribute("aria-hidden","true");progress.innerHTML="<i></i>";controls.appendChild(progress)}
 const pos=story.querySelector(".story-position");pos?.classList.add("digital-counter");
 const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;let timer=0,playing=false;
 const indexNow=()=>{const n=parseInt(pos?.textContent||"1",10);return Number.isFinite(n)?Math.max(0,Math.min(photos.length-1,n-1)):0};
 function stop(){playing=false;clearInterval(timer);timer=0;play?.classList.remove("playing");if(play)play.textContent="▶ Reproducir"}
 function sync(){const i=indexNow(),p=photos[i];if(!p)return;story.style.setProperty("--digital-bg","url(\""+p.photo+"\")");const bar=progress?.querySelector("i");if(bar)bar.style.width=((i+1)/photos.length*100)+"%";film?.querySelectorAll("button").forEach((b,n)=>b.classList.toggle("active",n===i));if(playing&&i>=photos.length-1)stop()}
 function start(){if(reduce||photos.length<2)return;if(indexNow()>=photos.length-1){for(let i=indexNow();i>0;i--)document.getElementById("storyPrev")?.click()}playing=true;play?.classList.add("playing");if(play)play.textContent="Ⅱ Pausar";clearInterval(timer);timer=setInterval(()=>document.getElementById("storyNext")?.click(),4500)}
 play?.addEventListener("click",()=>playing?stop():start());
 film?.addEventListener("click",e=>{const b=e.target.closest("button[data-index]");if(!b)return;stop();const target=Number(b.dataset.index),cur=indexNow(),button=target>=cur?"storyNext":"storyPrev";for(let i=0;i<Math.abs(target-cur);i++)document.getElementById(button)?.click()});
 document.getElementById("storyPrev")?.addEventListener("click",()=>{if(playing)stop()},{capture:true});
 close?.addEventListener("click",stop,{capture:true});story.addEventListener("touchstart",()=>{if(playing)stop()},{passive:true});
 if(pos)new MutationObserver(sync).observe(pos,{childList:true,subtree:true,characterData:true});
 document.getElementById("storyAlbum")?.addEventListener("click",()=>setTimeout(sync,0));sync();
})();`;

function enhance(input){let html=String(input||"");if(!html||html.includes('data-kp-digital-runtime-fix="1"'))return html;return html.replace("</body>",`<script data-kp-digital-runtime-fix="1">${FIX_RUNTIME}<\/script></body>`)}
function patchApi(){const api=window.KP_ALBUM_EXPERIENCE;if(!api||patched||!api.digitalAlbum||typeof api.html!=="function")return false;sourceHtml=api.html.bind(api);api.html=()=>enhance(sourceHtml());api.cinemaRuntimeStable=true;patched=true;return true}
function install(doc){if(!doc?.body||doc.documentElement.dataset.kpDigitalFixInstalled==="1")return false;if(!doc.getElementById("storyMode")||!doc.getElementById("kpAlbumPhotoData"))return false;doc.documentElement.dataset.kpDigitalFixInstalled="1";const s=doc.createElement("script");s.dataset.kpDigitalRuntimeFix="1";s.textContent=FIX_RUNTIME;doc.body.appendChild(s);return true}
function bind(){const frame=document.getElementById("kpAlbumExperienceFrame");if(!frame||frame.dataset.kpDigitalFixBound==="1")return false;frame.dataset.kpDigitalFixBound="1";frame.addEventListener("load",()=>{[0,40,140].forEach(ms=>setTimeout(()=>install(frame.contentDocument),ms))});return true}
function boot(){bind();let n=0,t=setInterval(()=>{n++;bind();patchApi();const f=document.getElementById("kpAlbumExperienceFrame");install(f?.contentDocument);if(patched&&n>30)clearInterval(t);if(n>160)clearInterval(t)},100);document.addEventListener("click",e=>{if(e.target.closest?.("#kpAlbumOpenExperience")){bind();[80,220,600].forEach(ms=>setTimeout(()=>install(document.getElementById("kpAlbumExperienceFrame")?.contentDocument),ms))}},true)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
window.KP_ALBUM_DIGITAL_RUNTIME_FIX={version:VERSION,enhance,install,stableInit:true,exportedRuntime:true};
})();