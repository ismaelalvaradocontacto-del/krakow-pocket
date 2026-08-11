(() => {
"use strict";
const GAME="./assets/game-art.svg",CHARS="./assets/characters.svg";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const CHAR={ismaelWorld:"char-ismael-v4-world",lauraWorld:"char-laura-v4-world",dragon:"npc-dragon-v4",guardian:"npc-guardian-v1"};
let game=null,chars=null,frame=0,ready=false,enforceTimer=0;

function parseSprite(text){const doc=new DOMParser().parseFromString(text,"image/svg+xml"),defs=doc.querySelector("defs")?.innerHTML||"",symbols=new Map();doc.querySelectorAll("symbol[id]").forEach(s=>symbols.set(s.id,{viewBox:s.getAttribute("viewBox")||"0 0 180 180",html:s.innerHTML}));return{defs,symbols}}
async function load(url){const r=await fetch(url,{cache:"force-cache"});if(!r.ok)throw new Error(`${url}: ${r.status}`);return parseSprite(await r.text())}
function inline(pack,id,cls){const s=pack?.symbols.get(id);if(!s)return"";return `<svg data-kp-inline="${id}" data-kp-character="${id}" class="${cls}" viewBox="${s.viewBox}" aria-hidden="true" focusable="false"><defs>${pack.defs}</defs>${s.html}</svg>`}
function player(){return localStorage.getItem("krakowPlayer")==="Laura"?"Laura":"Ismael"}
function speakerCharacter(){return/Guardián/i.test($("#kpGameHub .kp-hub-speaker")?.textContent||"")?CHAR.guardian:CHAR.dragon}

function defaultAvatarMarkup(who){return `<svg class="kp-profile-default" data-kp-default-profile="1" viewBox="0 0 100 100" role="img" aria-label="Imagen de perfil por defecto de ${who}" focusable="false"><circle cx="50" cy="50" r="50" fill="#aaa"/><circle cx="50" cy="34" r="17.5" fill="#f4f4f4"/><path d="M18 100C20.5 74 32.5 62 50 62S79.5 74 82 100Z" fill="#f4f4f4"/></svg>`}
function ensureProfileStyles(){
  if(!document.querySelector('link[data-kp-profiles="1"]')){const l=document.createElement("link");l.rel="stylesheet";l.href="./profiles.css?v=20260811e";l.dataset.kpProfiles="1";document.head.appendChild(l)}
  if(document.querySelector('style[data-kp-native-profile="1"]'))return;
  const s=document.createElement("style");s.dataset.kpNativeProfile="1";s.textContent=`
    .kp-profile-face,.kp-picker-face{position:relative!important;overflow:hidden!important}
    .kp-profile-default{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important;border-radius:inherit!important;pointer-events:none!important;z-index:2!important}
    .kp-profile-photo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important;border-radius:inherit!important;display:block!important;pointer-events:none!important;z-index:6!important}
  `;document.head.appendChild(s)
}

function setSelection(who){
  $$('.kp-profile-face[data-kp-profile]').forEach(el=>{const active=el.dataset.kpProfile===who;if(el.classList.contains('active')!==active)el.classList.toggle('active',active)});
  $$('#kpPlayerPicker [data-kp-player]').forEach(b=>{const active=b.dataset.kpPlayer===who;if(b.classList.contains('active')!==active)b.classList.toggle('active',active);const pressed=active?'true':'false';if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);const small=b.querySelector('small'),text=active?'Este iPhone':'Toca para elegir';if(small&&small.textContent!==text)small.textContent=text});
  const portrait=$("#kpGameHud .kp-game-portrait");if(portrait){if(portrait.dataset.profileWho!==who)portrait.dataset.profileWho=who;portrait.setAttribute("aria-label",`Perfiles de Ismael y Laura. Jugador activo: ${who}`);portrait.setAttribute("role","button");portrait.tabIndex=0}
}

function patchPlayerPicker(who){
  const select=$("#playerSelect"),label=select?.closest("label");if(!select||!label)return false;
  let changed=false,picker=$("#kpPlayerPicker");
  if(!picker){picker=document.createElement("div");picker.id="kpPlayerPicker";picker.setAttribute("role","group");picker.setAttribute("aria-label","Elegir jugador de este iPhone");label.parentNode.insertBefore(picker,label);label.classList.add("kp-native-player-select");changed=true}
  if(!picker.querySelector("[data-kp-player='Ismael']")||!picker.querySelector("[data-kp-player='Laura']")){
    picker.innerHTML=`<button type="button" class="kp-player-card" data-kp-player="Ismael"><span class="kp-picker-face">${defaultAvatarMarkup("Ismael")}</span><span><strong>Ismael</strong><small></small></span><i class="kp-player-check">✓</i></button><button type="button" class="kp-player-card" data-kp-player="Laura"><span class="kp-picker-face">${defaultAvatarMarkup("Laura")}</span><span><strong>Laura</strong><small></small></span><i class="kp-player-check">✓</i></button>`;changed=true
  }
  setSelection(who);return changed
}

function patchProfileHud(who){
  const portrait=$("#kpGameHud .kp-game-portrait");if(!portrait)return false;
  let changed=false;const faces=portrait.querySelectorAll(".kp-profile-face[data-kp-profile]");
  if(faces.length!==2||!portrait.querySelector('[data-kp-profile="Ismael"]')||!portrait.querySelector('[data-kp-profile="Laura"]')){
    portrait.innerHTML=`<span class="kp-profile-stack"><span class="kp-profile-face" data-kp-profile="Ismael">${defaultAvatarMarkup("Ismael")}</span><span class="kp-profile-face" data-kp-profile="Laura">${defaultAvatarMarkup("Laura")}</span></span>`;changed=true
  }
  setSelection(who);return changed
}

function notifyProfileHosts(){try{window.dispatchEvent(new CustomEvent("kp:profile-hosts-ready",{detail:{player:player()}}))}catch{}}
function patchProfiles(){ensureProfileStyles();const who=player(),changed=patchProfileHud(who)|patchPlayerPicker(who);if(changed)notifyProfileHosts();window.KP_COMPAT_PROFILE={version:"2.0",nativeDefaultAvatar:true,noGlobalMutationObserver:true,selected:who};return !!changed}

function patchWorldCharacters(){
  if(!ready)return;
  const couple=$$("#kpGameHub .kp-couple-art"),ids=[CHAR.ismaelWorld,CHAR.lauraWorld];couple.forEach((el,i)=>{const id=ids[i];if(!id||el.querySelector(`svg[data-kp-inline="${id}"]`))return;const html=inline(chars,id,"kp-character-asset");if(html){el.innerHTML=html;el.dataset.asset=id}});
  const npc=$("#kpGameHub .kp-hub-avatar"),npcId=speakerCharacter();if(npc&&!npc.querySelector(`svg[data-kp-inline="${npcId}"]`)){const html=inline(chars,npcId,"kp-npc-asset");if(html){npc.innerHTML=html;npc.dataset.asset=npcId}}
}
function patchLandmarks(){if(!ready)return;$$('#kpQuestWorld .kp-world-node[data-pixel-poi]').forEach(n=>{const id=n.dataset.pixelPoi,target=n.querySelector('.kp-landmark-art');if(!target||target.querySelector(`svg[data-kp-inline="landmark-${CSS.escape(id)}"]`))return;const html=inline(game,`landmark-${id}`,"kp-landmark-svg");if(html)target.innerHTML=html})}
const NAV={home:"nav-home",mapPanel:"nav-map",quests:"nav-quests",diary:"nav-diary",budget:"nav-budget"};
function patchNavigation(){if(!ready)return;$$('.tab[data-panel]').forEach(t=>{const id=NAV[t.dataset.panel],b=t.querySelector('b');if(!b||!id||b.querySelector(`svg[data-kp-inline="${id}"]`))return;const html=inline(game,id,"kp-asset-svg");if(html)b.innerHTML=`<span class="kp-nav-art">${html}</span>`});$$('#kpGameHub .kp-hub-place[data-go]').forEach(b=>{const id=NAV[b.dataset.go],target=b.querySelector('.building');if(!target||!id||target.querySelector(`svg[data-kp-inline="${id}"]`))return;const html=inline(game,id,"kp-asset-svg");if(html)target.innerHTML=html})}
function patch(){frame=0;patchProfiles();if(ready){patchWorldCharacters();patchLandmarks();patchNavigation();document.documentElement.classList.add("kp-inline-art-ready")}}
function schedule(){if(!frame)frame=requestAnimationFrame(patch)}
function applyNow(){patch()}
function enforceBurst(){clearInterval(enforceTimer);let ticks=0;enforceTimer=setInterval(()=>{if(document.visibilityState!=="hidden")applyNow();if(++ticks>=5){clearInterval(enforceTimer);enforceTimer=0}},300)}
function scrollPanelTop(){requestAnimationFrame(()=>{window.scrollTo({top:0,left:0,behavior:"auto"});document.scrollingElement?.scrollTo?.({top:0,left:0,behavior:"auto"})})}
function choosePlayer(who){if(who!=="Ismael"&&who!=="Laura")return;localStorage.setItem("krakowPlayer",who);setSelection(who);const select=$("#playerSelect");if(select){select.value=who;select.dispatchEvent(new Event("change",{bubbles:true}))}notifyProfileHosts();[0,70,180,420].forEach(ms=>setTimeout(applyNow,ms))}
function openPlayerSettings(){const trigger=$("#openSettings");if(trigger)trigger.click()}

function bind(){
  ensureProfileStyles();patchProfiles();
  document.addEventListener("click",e=>{
    const pick=e.target.closest?.("#kpPlayerPicker [data-kp-player]");if(pick){e.preventDefault();choosePlayer(pick.dataset.kpPlayer);return}
    if(e.target.closest?.("#kpGameHud .kp-game-portrait")){e.preventDefault();openPlayerSettings();return}
    if(e.target.closest?.('.tab[data-panel],#kpGameHub [data-go],#quickMap,#quickExpense,#quickMemory')){setTimeout(scrollPanelTop,20);[60,160,360].forEach(ms=>setTimeout(applyNow,ms))}
  },true);
  document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.closest?.("#kpGameHud .kp-game-portrait")){e.preventDefault();openPlayerSettings()}},true);
  window.addEventListener("storage",()=>setTimeout(applyNow,0));
  window.addEventListener("pageshow",applyNow);window.addEventListener("kp:render",applyNow);window.addEventListener("kp:game-render",applyNow);window.addEventListener("kp:statechange",applyNow);window.addEventListener("orientationchange",()=>setTimeout(applyNow,100),{passive:true});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)applyNow()});
  setInterval(()=>{if(document.visibilityState!=="hidden"&&!$("#kpGameHud .kp-profile-stack"))applyNow()},800);
  Promise.all([load(GAME),load(CHARS)]).then(([g,c])=>{game=g;chars=c;ready=true;applyNow();[80,240,650].forEach(ms=>setTimeout(applyNow,ms));enforceBurst()}).catch(err=>{console.warn("Kraków Pocket inline art fallback",err);document.documentElement.classList.add("kp-inline-art-failed")})
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
if(!window.__kpStateBridgeLoader){window.__kpStateBridgeLoader=true;document.write('<script src="./state-bridge.js?v=20260811f" data-kp-state-bridge="1"><\/script>')}
if(!window.__kpMissionFixLoader){window.__kpMissionFixLoader=true;document.write('<script src="./mission-fix.js?v=20260810h" data-kp-mission-fix="1"><\/script>')}
if(!window.__kpCelebrationGuardLoader){window.__kpCelebrationGuardLoader=true;document.write('<script src="./celebration-guard.js?v=20260810k" data-kp-celebration-guard="1"><\/script>')}
