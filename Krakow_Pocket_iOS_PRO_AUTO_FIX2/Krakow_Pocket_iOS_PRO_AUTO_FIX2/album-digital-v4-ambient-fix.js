(() => {
"use strict";
if(window.__kpAlbumDigitalV4AmbientFix)return;
window.__kpAlbumDigitalV4AmbientFix=true;
const VERSION="1.2";
let sourceHtml=null,patched=false;

const EXPORT_SCRIPT=`
(() => {
 "use strict";
 function syncAmbient(){
  const story=document.getElementById("storyMode"),img=story?.querySelector(".story-card img");
  if(!story||!img?.src)return false;
  const image="url("+JSON.stringify(img.src)+")";
  story.style.setProperty("--digital-bg",image,"important");
  story.style.setProperty("background-image","linear-gradient(rgba(12,10,8,.48),rgba(12,10,8,.48)),"+image,"important");
  story.dataset.kpAmbientReady="1";
  return true;
 }
 function bootAmbient(){
  syncAmbient();
  const pos=document.querySelector("#storyMode .story-position"),img=document.querySelector("#storyMode .story-card img");
  const mo=new MutationObserver(syncAmbient);
  if(pos)mo.observe(pos,{childList:true,subtree:true,characterData:true});
  if(img)mo.observe(img,{attributes:true,attributeFilter:["src"]});
  document.getElementById("storyAlbum")?.addEventListener("click",()=>setTimeout(syncAmbient,0));
  document.getElementById("storyPrev")?.addEventListener("click",()=>setTimeout(syncAmbient,0));
  document.getElementById("storyNext")?.addEventListener("click",()=>setTimeout(syncAmbient,0));
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bootAmbient,{once:true});else bootAmbient();
})();`;

function enhance(html){
 html=String(html||"");
 if(!html||html.includes('data-kp-ambient-fix="1"'))return html;
 return html.replace("</body>",`<script data-kp-ambient-fix="1">${EXPORT_SCRIPT}<\/script></body>`);
}

function patchApi(){
 const api=window.KP_ALBUM_EXPERIENCE;
 if(!api||patched||!api.digitalAlbum||!api.cinemaRuntimeStable||typeof api.html!=="function")return false;
 sourceHtml=api.html.bind(api);
 api.html=()=>enhance(sourceHtml());
 api.ambientBackdropStable=true;
 api.ambientBackdropWebKit=true;
 patched=true;
 return true;
}

function syncLive(){
 const frame=document.getElementById("kpAlbumExperienceFrame"),doc=frame?.contentDocument;
 const story=doc?.getElementById("storyMode"),img=story?.querySelector(".story-card img");
 if(!story||!img?.src)return false;
 const image=`url(${JSON.stringify(img.src)})`;
 story.style.setProperty("--digital-bg",image,"important");
 story.style.setProperty("background-image",`linear-gradient(rgba(12,10,8,.48),rgba(12,10,8,.48)),${image}`,"important");
 story.dataset.kpAmbientReady="1";
 return true;
}

function observeInside(){
 const doc=document.getElementById("kpAlbumExperienceFrame")?.contentDocument;
 const pos=doc?.querySelector("#storyMode .story-position");
 if(pos&&!pos.dataset.kpAmbientObserved){pos.dataset.kpAmbientObserved="1";new MutationObserver(syncLive).observe(pos,{childList:true,subtree:true,characterData:true})}
 const img=doc?.querySelector("#storyMode .story-card img");
 if(img&&!img.dataset.kpAmbientObserved){img.dataset.kpAmbientObserved="1";new MutationObserver(syncLive).observe(img,{attributes:true,attributeFilter:["src"]})}
}

function bindFrame(){
 const frame=document.getElementById("kpAlbumExperienceFrame");
 if(!frame)return false;
 if(frame.dataset.kpAmbientBound!=="1"){
  frame.dataset.kpAmbientBound="1";
  frame.addEventListener("load",()=>[0,30,100,260,600,1200].forEach(ms=>setTimeout(()=>{syncLive();observeInside()},ms)));
 }
 syncLive();observeInside();
 return true;
}

function scan(){bindFrame();patchApi();syncLive();observeInside()}
function boot(){
 scan();
 const observer=new MutationObserver(scan);
 observer.observe(document.documentElement,{childList:true,subtree:true});
 let n=0;const timer=setInterval(()=>{n++;scan();if(n>600)clearInterval(timer)},80);
 document.addEventListener("click",e=>{
  if(e.target.closest?.("#kpAlbumOpenExperience,#storyAlbum,#storyPrev,#storyNext,.digital-filmstrip")){
   [0,20,60,140,320,700,1400].forEach(ms=>setTimeout(scan,ms));
  }
 },true);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
window.KP_ALBUM_DIGITAL_AMBIENT_FIX={version:VERSION,enhance,syncLive,ambientBackdropStable:true,ambientBackdropWebKit:true,importantCustomProperty:true,directBackgroundImage:true,offlineExport:true,timingIndependent:true,iframeObserver:true};
})();