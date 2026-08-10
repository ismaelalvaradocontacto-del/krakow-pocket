(() => {
"use strict";
const D=window.KP_DATA;if(!D)return;
const STORAGE="krakowPocketCoop";
const $=s=>document.querySelector(s);
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return{}}};
const done=(s,id)=>s.missionStatus?.[id]?!!s.missionStatus[id].done:(s.visited||[]).includes(id);
const poi=id=>D.pois.find(p=>p.id===id),questByPoi=id=>D.quests.find(q=>q.poi===id);
const coords={
 florian:[15,18],rynek:[42,27],maria:[55,22],maius:[33,39],planty:[73,36],wawel:[27,63],dragon:[18,77],szeroka:[65,62],placnowy:[77,72],bernatek:[60,81],ghetto:[78,88],tomasza:[52,43]
};
const icons={florian:"🛡️",rynek:"🏛️",maria:"⛪",maius:"📚",planty:"🌳",wawel:"🏰",dragon:"🐉",szeroka:"✡️",placnowy:"🥯",bernatek:"🌉",ghetto:"🪑",tomasza:"🍲"};
function ensure(){
 const panel=$("#quests");if(!panel||$("#kpQuestWorld"))return;
 const world=document.createElement("div");world.id="kpQuestWorld";world.className="kp-quest-world";
 panel.insertBefore(world,panel.firstChild);
 const sheet=document.createElement("div");sheet.id="kpQuestDialog";sheet.className="kp-pixel-dialog";sheet.innerHTML='<div class="kp-pixel-portrait">🐉</div><div class="kp-pixel-copy"><div class="kp-pixel-name" id="kpPixelName"></div><div class="kp-pixel-text" id="kpPixelText"></div><div class="kp-pixel-actions"><button id="kpPixelClose">Cerrar</button><button id="kpPixelContext">Contexto</button><button id="kpPixelDone">Completar</button></div></div>';
 document.body.appendChild(sheet);
 $("#kpPixelClose").onclick=()=>sheet.classList.remove("show");
}
function renderWorld(){
 ensure();const host=$("#kpQuestWorld");if(!host)return;const s=read(),total=D.quests.length,finished=D.quests.filter(q=>done(s,q.poi)).length,score=D.quests.filter(q=>done(s,q.poi)).reduce((a,q)=>a+q.points,0);
 host.innerHTML=`<div class="kp-world-frame"><div class="kp-world-top"><div><div class="kp-world-kicker">Kraków Quest</div><div class="kp-world-title">Las Escamas de Wawel</div></div><div class="kp-world-score"><span>🐉 ${score}</span><small>${finished}/${total} misiones</small></div></div><div class="kp-world-map"><div class="kp-river"></div><div class="kp-road r1"></div><div class="kp-road r2"></div><div class="kp-road r3"></div><div class="kp-tree t1">🌲</div><div class="kp-tree t2">🌳</div><div class="kp-tree t3">🌲</div><div class="kp-tree t4">🌳</div><div class="kp-couple"><span>🧑🏻</span><span>👩🏻</span></div>${D.quests.map(q=>{const p=poi(q.poi),xy=coords[q.poi]||[50,50],isDone=done(s,q.poi);return`<button class="kp-world-node ${isDone?"done":""}" data-pixel-poi="${q.poi}" style="left:${xy[0]}%;top:${xy[1]}%"><span class="kp-node-icon">${icons[q.poi]||p?.emoji||"✨"}</span><span class="kp-node-badge">${isDone?"★":"!"}</span><small>${p?.name||q.title}</small></button>`}).join("")}</div><div class="kp-world-tip">Toca un lugar con <b>!</b> para abrir su misión. Las completadas quedan marcadas con ★.</div></div>`;
 host.querySelectorAll("[data-pixel-poi]").forEach(b=>b.onclick=()=>openPixelMission(b.dataset.pixelPoi));
}
function triggerMission(id){const btn=document.querySelector(`.q-done[data-poi="${CSS.escape(id)}"]`);if(btn){btn.click();setTimeout(renderWorld,180);return true}return false}
function openPixelMission(id){
 const q=questByPoi(id),p=poi(id),s=read(),isDone=done(s,id),sheet=$("#kpQuestDialog");if(!q||!sheet)return;
 $("#kpPixelName").textContent=`${p?.name||"Cracovia"} · +${q.points} 🐉`;
 $("#kpPixelText").textContent=q.text;
 sheet.querySelector(".kp-pixel-portrait").textContent=icons[id]||p?.emoji||"🐉";
 const doneBtn=$("#kpPixelDone");doneBtn.textContent=isDone?"✓ Completada":"Completar";doneBtn.disabled=isDone;
 doneBtn.onclick=()=>{if(!isDone&&triggerMission(id)){sheet.classList.remove("show");setTimeout(renderWorld,220)}};
 const ctx=$("#kpPixelContext");ctx.onclick=()=>{const old=document.querySelector(`.q-context[data-poi="${CSS.escape(id)}"]`);if(old){sheet.classList.remove("show");old.click()}};
 sheet.classList.add("show");
}
function init(){ensure();renderWorld();window.addEventListener("storage",renderWorld);setInterval(renderWorld,4000);const ver=$("#settingsVersion");if(ver)ver.textContent="Kraków Pocket · v3.6"}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
