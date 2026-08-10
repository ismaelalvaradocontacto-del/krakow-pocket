(() => {
"use strict";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const POS={florian:[18,13],maria:[50,13],planty:[82,13],maius:[18,35],tomasza:[50,35],szeroka:[82,35],dragon:[18,57],bernatek:[50,57],placnowy:[82,57],wawel:[18,79],rynek:[50,79],ghetto:[82,79]};
function avatar(who,mini=false,tag=false){return `<span class="kp46-avatar ${who.toLowerCase()}${mini?" mini":""}"><i class="haircap"></i><i class="face"></i><i class="eye e1"></i><i class="eye e2"></i><i class="smile"></i><i class="torso"></i>${tag?`<em class="tag">${who}</em>`:""}</span>`}
function fixPortrait(){const p=$("#kp45Portrait");if(!p)return;const selected=localStorage.getItem("krakowPlayer")||"Ismael";if(p.dataset.v46===selected)return;p.dataset.v46=selected;p.innerHTML=avatar(selected)}
function fixQuestMap(){const world=$("#kpQuestWorld");if(!world)return;for(const b of world.querySelectorAll("[data-pixel-poi]")){const pos=POS[b.dataset.pixelPoi];if(pos){b.style.left=`${pos[0]}%`;b.style.top=`${pos[1]}%`}}
 const couple=world.querySelector(".kp-couple");if(couple&&couple.dataset.v46!=="1"){couple.dataset.v46="1";couple.innerHTML=avatar("Ismael",true,true)+avatar("Laura",true,true)}}
function fixChrome(){document.documentElement.classList.add("kp-rpg-v46");fixPortrait();fixQuestMap();const version=$("#settingsVersion");if(version)version.textContent="Kraków Pocket · v4.6"}
function bind(){fixChrome();const world=$("#kpQuestWorld");if(world&&!world.dataset.v46Observed){world.dataset.v46Observed="1";let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;fixQuestMap()})}).observe(world,{childList:true,subtree:true})}
 for(const t of $$(".tab[data-panel]")){if(t.dataset.v46Bound)return;t.dataset.v46Bound="1";t.addEventListener("click",()=>setTimeout(fixChrome,60))}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
window.addEventListener("storage",()=>setTimeout(fixChrome,0));document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")fixChrome()});
$("#playerSelect")?.addEventListener("change",()=>setTimeout(fixPortrait,0));
})();
