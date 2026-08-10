(() => {
"use strict";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function cleanTechnicalBits(){
 document.documentElement.classList.add("kp-rpg-v41");
 $$(".kp-version-pill").forEach(el=>el.remove());
 const live=$("#kpLiveCard");if(live)live.classList.add("kp-rpg-travel-center");
 const today=$("#kpToday");if(today)today.classList.add("kp-rpg-route");
 const ver=$("#settingsVersion");if(ver)ver.textContent="Kraków Pocket · v4.1 · auditoría visual";
}
function delayedAudit(){let tries=0;const id=setInterval(()=>{tries++;cleanTechnicalBits();if(($("#kpLiveCard")&&$("#kpToday"))||tries>=16)clearInterval(id)},250)}
function run(){cleanTechnicalBits();delayedAudit()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run();
window.addEventListener("storage",cleanTechnicalBits);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")cleanTechnicalBits()});
})();