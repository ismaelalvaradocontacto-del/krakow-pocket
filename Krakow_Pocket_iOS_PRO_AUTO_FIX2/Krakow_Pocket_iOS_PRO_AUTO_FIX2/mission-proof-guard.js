(() => {
"use strict";
if(window.__kpMissionProofGuard)return;
window.__kpMissionProofGuard=true;
const STORAGE="krakowPocketCoop";
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return{}}};
const done=(s,id)=>s?.missionStatus?.[id]?!!s.missionStatus[id].done:(s?.visited||[]).includes(id);
window.addEventListener("click",event=>{
  const button=event.target.closest?.(".q-done[data-poi]");
  if(!button)return;
  const id=button.dataset.poi;if(!id)return;
  const state=read();if(done(state,id))return;
  const proof=state.missionEvidence?.[id];
  if(proof?.verified===true&&typeof proof.photo==="string"&&proof.photo.startsWith("data:image/"))return;
  const api=window.KP_MISSION_PROOF;
  if(!api?.open)return;
  event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
  api.open(id);
},true);
window.KP_MISSION_PROOF_GUARD={version:"1.0",hardGate:true,requiresStoredEvidence:true};
})();
