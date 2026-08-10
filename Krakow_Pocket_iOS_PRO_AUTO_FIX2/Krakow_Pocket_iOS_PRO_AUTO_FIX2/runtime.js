(() => {
"use strict";
const STORAGE="krakowPocketCoop",nativeSet=Storage.prototype.setItem,nativeInterval=window.setInterval.bind(window);
/* Compatibility throttle for the remaining legacy helper loops. Core 5 s cloud sync is untouched. */
window.setInterval=function(fn,delay,...args){let ms=Number(delay)||0;if(ms===900)ms=30000;else if(ms===1800)ms=30000;else if(ms===4000)ms=15000;return nativeInterval(fn,ms,...args)};
window.addEventListener("load",()=>setTimeout(()=>{window.setInterval=nativeInterval},0),{once:true});
const safeParse=v=>{try{return JSON.parse(v||"{}")}catch{return null}};
function normalizeMissionState(s){if(!s||typeof s!=="object")return s;if(!Array.isArray(s.visited))s.visited=[];const status=s.missionStatus;if(!status||typeof status!=="object"||Array.isArray(status))return s;const v=new Set(s.visited);for(const [id,op] of Object.entries(status)){if(!op||typeof op!=="object")continue;if(op.done)v.add(id);else v.delete(id)}s.visited=[...v];return s}
function sameVisited(a,b){const x=[...(a||[])].sort(),y=[...(b||[])].sort();return x.length===y.length&&x.every((v,i)=>v===y[i])}
function normalizeBootState(){const parsed=safeParse(localStorage.getItem(STORAGE));if(!parsed)return;const before=[...(parsed.visited||[])],normalized=normalizeMissionState(parsed);if(!sameVisited(before,normalized.visited))nativeSet.call(localStorage,STORAGE,JSON.stringify(normalized))}
normalizeBootState();if(window.KP_DATA)window.KP_DATA.version="6.2.0";
function emitState(detail={}){queueMicrotask(()=>{window.dispatchEvent(new CustomEvent("kp:statechange",{detail}));window.dispatchEvent(new Event("storage"))})}
Storage.prototype.setItem=function(key,value){if(this!==localStorage||key!==STORAGE)return nativeSet.call(this,key,value);const parsed=safeParse(value);if(!parsed)return nativeSet.call(this,key,value);const before=[...(parsed.visited||[])],normalized=normalizeMissionState(parsed),repaired=!sameVisited(before,normalized.visited);nativeSet.call(this,key,JSON.stringify(normalized));emitState({repaired});if(repaired&&sessionStorage.getItem("kpMissionMutation")!=="1"&&!window.__kpRepairReload){window.__kpRepairReload=true;setTimeout(()=>location.reload(),180)}return undefined};
const read=()=>normalizeMissionState(safeParse(localStorage.getItem(STORAGE))||{});
const num=n=>Number(n||0).toFixed(2).replace(".",",");
function summary(){const D=window.KP_DATA||{quests:[]},s=read(),status=s.missionStatus||{},isDone=id=>status[id]?!!status[id].done:(s.visited||[]).includes(id),done=(D.quests||[]).filter(q=>isDone(q.poi)),score=done.reduce((a,q)=>a+(+q.points||0),0),expenses=(s.expenses||[]).filter(x=>x&&!x.deletedAt),spent=expenses.reduce((a,x)=>a+(+x.amount||0),0),memories=(s.memories||[]).filter(x=>x&&!x.deletedAt).sort((a,b)=>new Date(b.ts||0)-new Date(a.ts||0)),lines=["Kraków Pocket · Ismael + Laura",`Misiones: ${done.length}/${D.quests?.length||12} · ${score} escamas`,`Gasto variable: ${num(spent)}€`,`Recuerdos guardados: ${memories.length}`];if(memories.length){lines.push("","Últimos recuerdos:");memories.slice(0,5).forEach(m=>lines.push(`• ${m.title||"Recuerdo"}${m.place?` · ${m.place}`:""}${m.note?`: ${m.note}`:""}`))}lines.push("",`${location.origin}${location.pathname}`);return lines.join("\n")}
async function share(){const text=summary();try{if(navigator.share){await navigator.share({title:"Kraków Pocket · nuestro viaje",text});return}if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);alert("Resumen copiado al portapeles.");return}prompt("Copia vuestro resumen:",text)}catch(e){if(e?.name!=="AbortError")prompt("Copia vuestro resumen:",text)}}
function networkClass(){document.documentElement.classList.toggle("kp-offline-state",!navigator.onLine)}
document.addEventListener("click",e=>{const b=e.target.closest?.("#kpShareSummary");if(!b)return;e.preventDefault();e.stopImmediatePropagation();share()},true);
window.addEventListener("online",networkClass);window.addEventListener("offline",networkClass);networkClass();document.documentElement.dataset.kpRuntime="6.2";
})();
