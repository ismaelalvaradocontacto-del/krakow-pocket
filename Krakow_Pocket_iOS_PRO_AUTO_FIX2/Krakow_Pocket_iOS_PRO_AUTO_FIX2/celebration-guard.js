(() => {
  "use strict";
  if (window.__kpCelebrationGuard) return;
  window.__kpCelebrationGuard = true;

  const STORAGE = "krakowPocketCoop";
  const D = window.KP_DATA || { quests: [] };
  const read = () => { try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); } catch { return {}; } };
  const done = (s,id) => s?.missionStatus?.[id] ? !!s.missionStatus[id].done : (s?.visited || []).includes(id);
  const snapshot = () => Object.fromEntries((D.quests || []).map(q => [q.poi, done(read(), q.poi)]));

  let previous = snapshot();
  let allowUntil = 0;

  function inspectTransition(){
    const next = snapshot();
    for(const id of Object.keys(next)){
      if(!previous[id] && next[id]){
        allowUntil = Date.now() + 3500;
        break;
      }
    }
    previous = next;
  }

  function enforce(){
    const win = document.getElementById("kpQuestWin");
    if(!win?.classList.contains("show")) return;
    if(Date.now() <= allowUntil) return;
    win.classList.remove("show");
    try { sessionStorage.removeItem("kpCelebrateMission"); } catch {}
  }

  window.addEventListener("kp:statechange",()=>queueMicrotask(inspectTransition));
  window.addEventListener("storage",()=>queueMicrotask(inspectTransition));
  document.addEventListener("DOMContentLoaded",()=>{
    previous = snapshot();
    try{
      const pending = sessionStorage.getItem("kpCelebrateMission");
      if(pending && !done(read(),pending)) sessionStorage.removeItem("kpCelebrateMission");
    }catch{}
    setTimeout(enforce,500);
  },{once:true});

  const observer = new MutationObserver(records=>{
    for(const r of records){
      const el = r.target;
      if(el?.id === "kpQuestWin"){
        queueMicrotask(enforce);
        break;
      }
    }
  });
  const start = () => observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:["class"]});
  if(document.body) start(); else document.addEventListener("DOMContentLoaded",start,{once:true});

  window.KP_CELEBRATION_GUARD = {
    version: "1.2",
    duplicateOverlayBlocked: true,
    staleOverlayBlocked: true,
    legitimateTransitionsAllowed: true
  };
})();
if(!window.__kpCelebrationStabilityLoader){window.__kpCelebrationStabilityLoader=true;const s=document.createElement("script");s.src="./celebration-stability.js?v=20260810m";s.async=false;(document.head||document.documentElement).appendChild(s)}
if(!window.__kpPortraitStabilityLoader){window.__kpPortraitStabilityLoader=true;const s=document.createElement("script");s.src="./portrait-stability.js?v=20260810m";s.async=false;(document.head||document.documentElement).appendChild(s)}
