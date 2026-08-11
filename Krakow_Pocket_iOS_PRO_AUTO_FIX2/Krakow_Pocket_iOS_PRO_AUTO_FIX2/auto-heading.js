(() => {
"use strict";

const VERSION="1.0";
let heading=null;
let source="none";
let lastSensorAt=0;
let gpsWatchId=null;
let lastGps=null;
let applyTimer=0;

const norm=n=>((Number(n)%360)+360)%360;
const finite=n=>Number.isFinite(Number(n));
const rad=d=>d*Math.PI/180;
const deg=r=>r*180/Math.PI;

function screenAngle(){
  const angle=screen.orientation?.angle;
  if(finite(angle))return Number(angle);
  const legacy=window.orientation;
  return finite(legacy)?Number(legacy):0;
}

function smoothAngle(prev,next,weight=.28){
  if(!finite(prev))return norm(next);
  const delta=((norm(next)-norm(prev)+540)%360)-180;
  return norm(Number(prev)+delta*weight);
}

function distanceMeters(a,b){
  const R=6371000;
  const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
  const la1=rad(a.lat),la2=rad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

function bearing(a,b){
  const la1=rad(a.lat),la2=rad(b.lat),dl=rad(b.lon-a.lon);
  const y=Math.sin(dl)*Math.cos(la2);
  const x=Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(dl);
  return norm(deg(Math.atan2(y,x)));
}

function injectStyles(){
  if(document.querySelector('style[data-kp-heading="1"]'))return;
  const style=document.createElement("style");
  style.dataset.kpHeading="1";
  style.textContent=`
    .loc-dot{position:relative!important;overflow:visible!important;isolation:isolate}
    .loc-dot .kp-heading-bearing{position:absolute;left:50%;top:50%;width:1px;height:1px;transform:rotate(var(--kp-heading,0deg));transform-origin:0 0;pointer-events:none;z-index:-1;transition:transform .14s linear}
    .loc-dot .kp-heading-cone{position:absolute;left:-24px;top:-48px;width:48px;height:48px;clip-path:polygon(50% 100%,8% 0,92% 0);background:linear-gradient(to top,rgba(34,121,207,.06),rgba(34,121,207,.27));filter:drop-shadow(0 2px 4px rgba(19,82,142,.12));opacity:.9}
    .loc-dot .kp-heading-arrow{position:absolute;left:-5px;top:-29px;width:10px;height:27px;clip-path:polygon(50% 0,100% 34%,70% 34%,70% 100%,30% 100%,30% 34%,0 34%);background:#156fbd;filter:drop-shadow(0 1px 1px rgba(0,0,0,.22))}
    .loc-dot:not(.kp-has-heading) .kp-heading-bearing{display:none}
  `;
  document.head.appendChild(style);
}

function ensureMarker(){
  const dot=document.querySelector(".loc-dot");
  if(!dot)return null;
  let bearingNode=dot.querySelector(":scope > .kp-heading-bearing");
  if(!bearingNode){
    bearingNode=document.createElement("span");
    bearingNode.className="kp-heading-bearing";
    bearingNode.setAttribute("aria-hidden","true");
    bearingNode.innerHTML='<i class="kp-heading-cone"></i><i class="kp-heading-arrow"></i>';
    dot.prepend(bearingNode);
  }
  return dot;
}

function applyMarker(){
  injectStyles();
  const dot=ensureMarker();
  if(!dot)return false;
  if(finite(heading)){
    dot.classList.add("kp-has-heading");
    dot.style.setProperty("--kp-heading",`${norm(heading).toFixed(1)}deg`);
    dot.dataset.headingSource=source;
    dot.setAttribute("aria-label",`Ubicación actual · dirección ${Math.round(norm(heading))} grados`);
    return true;
  }
  dot.classList.remove("kp-has-heading");
  dot.removeAttribute("data-heading-source");
  return false;
}

function expose(extra={}){
  window.KP_HEADING={
    version:VERSION,
    silent:true,
    noPermissionPrompt:true,
    requestsOrientationPermission:false,
    sensorPreferred:true,
    gpsFallback:true,
    heading:finite(heading)?norm(heading):null,
    source,
    active:finite(heading),
    apply:applyMarker,
    ...extra
  };
}

function setHeading(value,nextSource,weight){
  if(!finite(value))return;
  heading=smoothAngle(heading,norm(value),weight);
  source=nextSource;
  if(nextSource.startsWith("sensor"))lastSensorAt=Date.now();
  applyMarker();
  expose();
}

function onOrientation(event){
  let value=null;
  let nextSource="sensor";
  if(finite(event.webkitCompassHeading)){
    value=Number(event.webkitCompassHeading);
    nextSource="sensor-ios";
  }else if(event.absolute===true&&finite(event.alpha)){
    value=norm(360-Number(event.alpha)+screenAngle());
    nextSource="sensor-absolute";
  }
  if(value==null)return;
  setHeading(value,nextSource,.2);
}

function onGps(pos){
  const now=Date.now();
  const coords=pos?.coords;
  if(!coords||!finite(coords.latitude)||!finite(coords.longitude))return;
  const point={lat:Number(coords.latitude),lon:Number(coords.longitude),ts:now};
  let gpsHeading=null;

  if(finite(coords.heading)&&Number(coords.heading)>=0){
    const speed=finite(coords.speed)?Number(coords.speed):null;
    if(speed==null||speed>.35)gpsHeading=norm(Number(coords.heading));
  }

  if(gpsHeading==null&&lastGps){
    const moved=distanceMeters(lastGps,point);
    const dt=now-lastGps.ts;
    if(moved>=3&&dt>0&&dt<=20000)gpsHeading=bearing(lastGps,point);
  }
  if(!lastGps||distanceMeters(lastGps,point)>=2||now-lastGps.ts>12000)lastGps=point;

  if(gpsHeading!=null&&now-lastSensorAt>3000)setHeading(gpsHeading,"gps-course",.36);
  else applyMarker();
}

function startGpsFallback(){
  if(!navigator.geolocation||gpsWatchId!=null)return;
  try{
    gpsWatchId=navigator.geolocation.watchPosition(onGps,()=>{}, {
      enableHighAccuracy:false,
      maximumAge:5000,
      timeout:15000
    });
  }catch{}
}

function boot(){
  injectStyles();
  expose({status:"listening"});

  // Deliberately do NOT call DeviceOrientationEvent.requestPermission().
  // If iOS has already granted access or exposes the sensor silently, these events work.
  window.addEventListener("deviceorientationabsolute",onOrientation,{passive:true});
  window.addEventListener("deviceorientation",onOrientation,{passive:true});

  startGpsFallback();
  applyMarker();
  clearInterval(applyTimer);
  applyTimer=setInterval(()=>{if(!document.hidden&&finite(heading))applyMarker()},900);

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden)return;
    startGpsFallback();
    setTimeout(applyMarker,250);
  },{passive:true});
  window.addEventListener("pageshow",()=>setTimeout(applyMarker,220),{passive:true});
  window.addEventListener("orientationchange",()=>setTimeout(applyMarker,120),{passive:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
