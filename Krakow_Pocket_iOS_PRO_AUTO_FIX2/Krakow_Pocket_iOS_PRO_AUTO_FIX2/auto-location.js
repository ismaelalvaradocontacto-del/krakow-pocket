(() => {
"use strict";

const VERSION="1.0";
let attemptTimer=0;
let inFlight=false;
let lastAttemptAt=0;

const button=()=>document.getElementById("locateBtn");
const privacy=()=>document.getElementById("privacyGps");
const isSearching=()=>/Buscando/i.test(button()?.textContent||"");
const isActive=()=>/Ubicación activa/i.test(button()?.textContent||"")||/GPS activo/i.test(privacy()?.textContent||"");

async function permissionState(){
  if(!navigator.permissions?.query)return "unknown";
  try{return (await navigator.permissions.query({name:"geolocation"})).state}catch{return "unknown"}
}

function expose(extra={}){
  window.KP_AUTO_LOCATION={
    version:VERSION,
    autoStart:true,
    resumeRefresh:true,
    deviceOnly:true,
    active:isActive(),
    searching:isSearching(),
    lastAttemptAt:lastAttemptAt||null,
    retry:()=>attempt("manual-retry",true),
    ...extra
  };
}

async function attempt(reason="startup",force=false){
  const now=Date.now();
  if(!navigator.geolocation||document.hidden||inFlight)return;
  if(!force&&now-lastAttemptAt<12000)return;
  const btn=button();
  if(!btn){schedule(reason,350,force);return}
  if(isSearching())return;
  if(isActive()&&!force){expose({reason,status:"already-active"});return}

  const permission=await permissionState();
  if(permission==="denied"){
    expose({reason,status:"permission-denied",permission});
    return;
  }

  lastAttemptAt=Date.now();
  inFlight=true;
  expose({reason,status:"requesting",permission});
  try{
    btn.click();
  }catch(e){
    console.warn("Kraków Pocket automatic location",e);
  }

  setTimeout(()=>{
    inFlight=false;
    expose({reason,status:isActive()?"active":isSearching()?"searching":"idle",permission});
  },13000);
}

function schedule(reason="startup",delay=500,force=false){
  clearTimeout(attemptTimer);
  attemptTimer=setTimeout(()=>attempt(reason,force),delay);
}

function boot(){
  expose({status:"ready"});
  schedule("startup",550,false);

  window.addEventListener("pageshow",()=>{
    const stale=Date.now()-lastAttemptAt>30000;
    schedule("pageshow",400,stale);
  },{passive:true});

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden)return;
    const stale=Date.now()-lastAttemptAt>30000;
    schedule("resume",500,stale);
  },{passive:true});

  window.addEventListener("focus",()=>{
    if(!isActive()&&!isSearching())schedule("focus",650,false);
  },{passive:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
