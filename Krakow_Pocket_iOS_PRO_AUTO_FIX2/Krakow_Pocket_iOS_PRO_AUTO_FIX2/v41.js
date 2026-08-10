(() => {
"use strict";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function cleanTechnicalBits(){
 document.documentElement.classList.add("kp-rpg-v41");
 $$(".kp-version-pill").forEach(el=>el.remove());
 const live=$("#kpLiveCard");if(live)live.classList.add("kp-rpg-travel-center");
 const today=$("#kpToday");if(today)today.classList.add("kp-rpg-route");
 const ver=$("#settingsVersion");if(ver)ver.textContent="Kraków Pocket · v4.2 · RPG cohesivo";
}
function loadV42(){
 if(!document.querySelector('link[href*="v42.css"]')){const l=document.createElement("link");l.rel="stylesheet";l.href="./v42.css?v=4200";document.head.appendChild(l)}
 if(!document.querySelector('script[src*="v42.js"]')){const s=document.createElement("script");s.src="./v42.js?v=4200";document.body.appendChild(s)}
}
function delayedAudit(){let tries=0;const id=setInterval(()=>{tries++;cleanTechnicalBits();if(($("#kpLiveCard")&&$("#kpToday"))||tries>=16)clearInterval(id)},250)}
function run(){cleanTechnicalBits();delayedAudit();loadV42()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run();
window.addEventListener("storage",cleanTechnicalBits);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")cleanTechnicalBits()});
})();