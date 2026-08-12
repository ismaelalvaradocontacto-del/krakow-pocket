(() => {
"use strict";
if (window.__kpAlbumDigitalV4) return;
window.__kpAlbumDigitalV4 = true;

const VERSION = "4.0";
let sourceHtml = null;
let patched = false;
let frameBound = false;

const SHELL_STYLE = `
<style data-kp-digital-shell-v4="1">
#kpAlbumExperienceDialog{background:transparent!important}
#kpAlbumExperienceDialog::backdrop{background:rgba(18,13,10,.84)!important;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
#kpAlbumExperienceDialog .kp-ae-shell{inset:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))!important;max-width:1180px!important;margin:auto!important;border:1px solid rgba(255,255,255,.15)!important;border-radius:28px!important;background:#17120f!important;box-shadow:0 28px 90px rgba(0,0,0,.48)!important;overflow:hidden!important}
#kpAlbumExperienceDialog .kp-ae-shell>header{min-height:54px!important;padding:8px 12px!important;background:rgba(24,18,14,.94)!important;color:#fff6e8!important;border-bottom:1px solid rgba(255,255,255,.1)!important;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
#kpAlbumExperienceDialog .kp-ae-shell>header .smart-kicker{color:#cdbda9!important;font-size:9px!important;letter-spacing:.14em!important}
#kpAlbumExperienceDialog .kp-ae-shell>header strong{font-family:Georgia,serif!important;font-size:17px!important;font-weight:600!important}
#kpAlbumExperienceDialog .kp-ae-header-actions button{width:40px!important;height:40px!important;border:1px solid rgba(255,255,255,.22)!important;background:rgba(255,255,255,.08)!important;color:white!important;border-radius:50%!important}
#kpAlbumExperienceFrame{background:#111!important}
#kpAlbumExperienceDialog .kp-ae-shell>footer{min-height:58px!important;padding:8px 10px max(8px,env(safe-area-inset-bottom))!important;background:rgba(24,18,14,.96)!important;border-top:1px solid rgba(255,255,255,.1)!important;gap:7px!important}
#kpAlbumExperienceDialog .kp-ae-shell>footer button{min-height:42px!important;border:1px solid rgba(255,255,255,.2)!important;background:rgba(255,255,255,.08)!important;color:#fff7e9!important;border-radius:14px!important;font-size:12px!important;font-weight:750!important;box-shadow:none!important}
#kpAlbumExperienceDialog .kp-ae-shell>footer button:first-child{background:#f2e0bd!important;color:#3b2b21!important;border-color:#f2e0bd!important}
#kpAlbumExperienceCard{overflow:hidden!important;position:relative!important}
#kpAlbumExperienceCard .kp-ae-preview{height:154px!important;display:grid!important;grid-template-columns:1.35fr .85fr!important;grid-template-rows:1fr 1fr!important;gap:4px!important;border-radius:18px!important;overflow:hidden!important;background:#2b211b!important}
#kpAlbumExperienceCard .kp-ae-preview img{width:100%!important;height:100%!important;object-fit:cover!important;border:0!important;border-radius:0!important;box-shadow:none!important}
#kpAlbumExperienceCard .kp-ae-preview img:first-child{grid-row:1/3!important}
#kpAlbumExperienceCard .kp-ae-title{font-family:Georgia,serif!important;font-size:25px!important}
@media(max-width:700px){
 #kpAlbumExperienceDialog .kp-ae-shell{inset:0!important;border:0!important;border-radius:0!important;max-width:none!important}
 #kpAlbumExperienceDialog .kp-ae-shell>header{padding-top:max(8px,env(safe-area-inset-top))!important}
 #kpAlbumExperienceDialog .kp-ae-shell>footer{grid-template-columns:repeat(3,1fr)!important}
 #kpAlbumExperienceDialog .kp-ae-shell>footer button{padding:7px 4px!important;font-size:11px!important}
}
</style>`;

const DIGITAL_STYLE = `
<style data-kp-digital-album-v4="1">
:root{--digital-ink:#29211c;--digital-paper:#f8f5ee;--digital-warm:#efe5d4;--digital-dark:#171310;--digital-muted:#746b63;--digital-accent:#7c5439;--digital-green:#5f7352}
html{background:#16120f!important;scroll-padding-top:64px}
body{background:#16120f!important;color:var(--digital-ink)!important}
.book.digital-album{max-width:1180px!important;background:var(--digital-paper)!important;box-shadow:none!important;overflow:hidden}
.cover{min-height:min(96svh,920px)!important;background:#171310!important}
.cover-photo{inset:-3%!important;width:106%!important;height:106%!important;filter:saturate(.96) contrast(1.04) brightness(.9)!important;animation:kpDigitalKenBurns 18s ease-in-out infinite alternate;will-change:transform}
.cover::before{background:linear-gradient(180deg,rgba(10,8,7,.04) 0%,rgba(10,8,7,.06) 30%,rgba(10,8,7,.72) 82%,rgba(10,8,7,.9) 100%)!important}
.cover::after{box-shadow:inset 0 0 0 1px rgba(255,255,255,.05),inset 0 -120px 130px rgba(0,0,0,.16)!important}
.cover-copy{width:min(92%,900px)!important;text-align:left!important;margin:0!important;padding:70px clamp(22px,6vw,74px) max(64px,env(safe-area-inset-bottom))!important}
.cover-kicker{padding:0!important;border:0!important;background:none!important;backdrop-filter:none!important;font-size:11px!important;letter-spacing:.2em!important;color:#f0dfc4!important}
.cover h1{max-width:780px!important;margin:16px 0!important;font-size:clamp(46px,8vw,92px)!important;line-height:.91!important;letter-spacing:-.045em!important;text-wrap:balance}
.cover p{max-width:650px!important;margin:0!important;font-size:clamp(16px,2.5vw,22px)!important;color:#f8efe1!important}
.cover-progress{width:min(390px,88%)!important;margin:24px 0 0!important}
.scroll-cue{margin:28px 0 0!important;background:rgba(255,255,255,.08)!important;backdrop-filter:blur(10px)}
.toolbar{top:8px!important;width:max-content!important;max-width:calc(100% - 20px)!important;margin:-59px auto 34px!important;padding:6px!important;border:1px solid rgba(71,56,46,.14)!important;border-radius:999px!important;background:rgba(250,247,240,.88)!important;box-shadow:0 10px 34px rgba(31,24,20,.16)!important;backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important;overflow:hidden!important}
.toolbar a,.toolbar button{min-height:40px!important;padding:8px 12px!important;border:0!important;background:transparent!important;border-radius:999px!important;color:#3f342d!important;font-size:12px!important;font-weight:760!important}
.toolbar .primary{background:#2d2824!important;color:#fff!important}
.toolbar a:hover,.toolbar button:hover{background:rgba(57,45,38,.08)!important}
.stats-wrap{max-width:900px!important;margin:0 auto!important;padding:4px 22px 30px!important}
.stats{gap:0!important;border-top:1px solid rgba(52,41,34,.13)!important;border-bottom:1px solid rgba(52,41,34,.13)!important}
.stat{padding:19px 8px!important;border:0!important;border-right:1px solid rgba(52,41,34,.11)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
.stat:last-child{border-right:0!important}.stat strong{font-size:clamp(22px,4vw,31px)!important;font-weight:500!important}.stat span{font-size:9px!important;letter-spacing:.12em!important}
.toc{max-width:900px!important;margin:18px auto 72px!important;padding:0 22px!important;background:transparent!important;border:0!important;border-radius:0!important}
.toc-head{align-items:flex-start!important;margin-bottom:22px!important}.toc h2{font-size:clamp(30px,5vw,46px)!important;font-weight:500!important;letter-spacing:-.025em!important}.toc-head small{padding-top:7px!important}
.toc-grid{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))!important;gap:10px!important}
.toc-grid a{min-height:90px!important;padding:14px 16px!important;border:1px solid rgba(55,43,35,.12)!important;border-radius:18px!important;background:#fff!important;box-shadow:0 8px 24px rgba(44,34,28,.05)!important;transition:transform .25s ease,box-shadow .25s ease!important}
.toc-grid a:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(44,34,28,.09)!important}.toc-grid a span{width:48px!important;height:48px!important;background:#2f2a26!important;box-shadow:none!important}
.chapter{max-width:1040px!important;margin:0 auto!important;padding:72px 28px 100px!important;position:relative!important}
.chapter::before{content:"";position:absolute;left:28px;right:28px;top:0;height:1px;background:rgba(53,41,34,.13)}
.chapter-head{grid-template-columns:auto 1fr auto!important;gap:18px!important;margin-bottom:36px!important;align-items:end!important}
.chapter-badge{width:auto!important;height:auto!important;padding:0!important;border-radius:0!important;background:transparent!important;color:#2e2925!important;box-shadow:none!important;font-family:Georgia,serif!important;font-size:clamp(46px,8vw,78px)!important;font-weight:400!important;line-height:.8!important;letter-spacing:-.05em!important}
.chapter-copy{padding-bottom:2px!important}.chapter-date{font-size:11px!important;letter-spacing:.08em!important;text-transform:none!important}.chapter h2{font-size:clamp(27px,4.5vw,44px)!important;font-weight:500!important;letter-spacing:-.025em!important}
.chapter-count{align-self:end!important;margin-bottom:3px!important;padding:5px 9px!important;border:0!important;background:#ece6dc!important;color:#6b625a!important}
.photo-grid{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr))!important;gap:42px 20px!important;align-items:start!important}
.photo-card{grid-column:span 6!important;overflow:visible!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
.photo-card:nth-child(4n+1){grid-column:1/-1!important}.photo-card:nth-child(4n+4){grid-column:2/12!important}
.photo-card::before{display:none!important}.photo-card.respect{background:transparent!important;border:0!important}
.photo-button{border-radius:24px!important;background:#ddd!important;box-shadow:0 16px 36px rgba(35,27,22,.11)!important;overflow:hidden!important}
.photo-button img{aspect-ratio:4/3!important;min-height:0!important;border-radius:0!important;transition:transform 1s cubic-bezier(.2,.7,.15,1),filter .3s ease!important}
.photo-card:nth-child(4n+1) .photo-button img,.photo-card:nth-child(4n+4) .photo-button img{aspect-ratio:16/9!important;max-height:610px!important}
.photo-button:hover img{transform:scale(1.018)!important}.photo-zoom{width:42px!important;height:42px!important;right:14px!important;bottom:14px!important;border:0!important;background:rgba(20,17,15,.66)!important}
.photo-copy{padding:17px 2px 0!important}.photo-topline{justify-content:flex-start!important;gap:9px!important}.verified-badge,.respect-badge{background:transparent!important;border:1px solid rgba(69,54,45,.22)!important;color:#685e56!important;font-size:8px!important}.meta{font-size:9px!important;color:#8a817a!important}
.photo-copy h3{font-size:clamp(22px,3vw,31px)!important;font-weight:500!important;margin:10px 0 11px!important;letter-spacing:-.015em!important}.photo-copy blockquote{max-width:720px!important;padding:0 0 0 15px!important;border-radius:0!important;border-left:2px solid #9c8d7d!important;background:transparent!important;color:#514943!important;font-size:14px!important}.photo-copy blockquote.quiet{background:transparent!important;border-left-color:#81766c!important}
.memories{max-width:1040px!important;margin:0 auto!important;padding:76px 28px 96px!important;background:transparent!important;border-top:1px solid rgba(53,41,34,.13)!important}.section-title{margin-bottom:28px!important}.section-title>span{font-size:28px!important}.section-title h2{font-size:clamp(30px,5vw,46px)!important;font-weight:500!important;letter-spacing:-.025em!important}.memory-grid{gap:16px!important}.memory-card{padding:24px!important;border:1px solid rgba(55,43,35,.12)!important;border-radius:20px!important;background:#fff!important;box-shadow:none!important}.memory-card h3{font-weight:500!important}.memory-pin{color:#8f7a66!important}
.offline-pdf-help{max-width:900px!important;margin:28px auto 68px!important;background:#f1ece3!important;border:0!important;border-radius:18px!important;box-shadow:none!important;color:#554c45!important}
.ending{min-height:72svh!important;display:grid!important;place-content:center!important;padding:90px 28px!important;background:#1d1815!important;color:#f8eee1!important}.ending-strip{width:min(720px,90vw)!important;max-width:none!important;gap:7px!important;transform:none!important}.ending-strip img{border:0!important;border-radius:12px!important;box-shadow:none!important;filter:saturate(.9)!important}.ending .dragon{font-size:42px!important}.ending h2{font-size:clamp(38px,7vw,66px)!important;font-weight:500!important;letter-spacing:-.035em!important}.ending p{color:#dccfc1!important}.ending small{color:#a99a8d!important}
.lightbox{background:rgba(8,7,6,.97)!important}.lightbox figure{max-width:min(96vw,1240px)!important}.lightbox img{max-height:84svh!important;border-radius:10px!important;box-shadow:none!important}.lightbox figcaption{font-size:13px!important;color:#d9cec4!important}.lightbox-nav,.overlay-close{background:rgba(255,255,255,.09)!important;border:1px solid rgba(255,255,255,.22)!important;backdrop-filter:blur(12px)!important}
.story-mode{--digital-bg:none!important;overflow:hidden!important;background:#111!important;isolation:isolate!important}.story-mode::before{content:"";position:absolute;inset:-45px;z-index:-2;background-image:var(--digital-bg)!important;background-size:cover!important;background-position:center!important;filter:blur(34px) saturate(.7) brightness(.42)!important;transform:scale(1.08)!important;opacity:.85!important}.story-mode::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(8,7,6,.38),rgba(8,7,6,.1) 45%,rgba(8,7,6,.72))!important}
.story-head{position:relative!important;z-index:4!important;border:0!important;padding:max(14px,env(safe-area-inset-top)) 16px 10px!important;background:linear-gradient(180deg,rgba(0,0,0,.42),transparent)!important}.story-head strong{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif!important;font-size:13px!important;letter-spacing:.06em!important;text-transform:uppercase!important}.story-head-actions{display:flex!important;align-items:center!important;gap:8px!important}.digital-play{min-width:92px!important;height:42px!important;padding:0 13px!important;border-radius:999px!important;border:1px solid rgba(255,255,255,.25)!important;background:rgba(255,255,255,.1)!important;color:white!important;font-weight:750!important}.digital-play.playing{background:#f2e0bd!important;color:#30251f!important;border-color:#f2e0bd!important}.story-stage{position:relative!important;z-index:2!important;padding:10px 18px 14px!important;overflow:hidden!important}.story-card{position:relative!important;width:min(1080px,100%)!important;height:min(74svh,760px)!important;display:block!important;border-radius:18px!important;background:#15120f!important;box-shadow:0 24px 70px rgba(0,0,0,.38)!important;overflow:hidden!important}.story-card img{width:100%!important;height:100%!important;max-height:none!important;object-fit:contain!important;background:#0e0d0c!important}.story-copy{position:absolute!important;left:0!important;right:0!important;bottom:0!important;padding:80px clamp(18px,4vw,46px) clamp(22px,4vw,38px)!important;background:linear-gradient(180deg,transparent,rgba(10,8,7,.86))!important;color:white!important;pointer-events:none!important}.story-copy small{color:#ddd0c3!important;font-size:11px!important}.story-copy h2{max-width:760px!important;margin:6px 0 8px!important;font-size:clamp(28px,5vw,48px)!important;color:#fff!important;font-weight:500!important;letter-spacing:-.025em!important}.story-copy blockquote{max-width:760px!important;color:#eee3d9!important;font-size:clamp(13px,2vw,16px)!important;line-height:1.5!important}.story-controls{position:relative!important;z-index:4!important;grid-template-columns:auto 1fr auto!important;align-items:center!important;padding:8px 16px max(14px,env(safe-area-inset-bottom))!important;background:linear-gradient(0deg,rgba(0,0,0,.52),transparent)!important}.story-controls button{min-width:104px!important;border-radius:999px!important;background:rgba(255,255,255,.08)!important}.story-position{font-size:12px!important}.digital-story-progress{position:absolute!important;left:16px!important;right:16px!important;top:0!important;height:3px!important;border-radius:99px!important;background:rgba(255,255,255,.18)!important;overflow:hidden!important}.digital-story-progress i{display:block!important;width:0;height:100%!important;background:#f4dfbb!important;transition:width .35s ease!important}.digital-filmstrip{position:absolute!important;left:50%!important;bottom:76px!important;z-index:5!important;transform:translateX(-50%)!important;display:flex!important;gap:6px!important;max-width:min(82vw,720px)!important;padding:6px!important;border-radius:15px!important;background:rgba(10,8,7,.38)!important;backdrop-filter:blur(12px)!important;overflow-x:auto!important;scrollbar-width:none!important}.digital-filmstrip::-webkit-scrollbar{display:none}.digital-filmstrip button{flex:0 0 50px!important;width:50px!important;height:38px!important;padding:0!important;border:2px solid transparent!important;border-radius:9px!important;overflow:hidden!important;background:#333!important;opacity:.56!important}.digital-filmstrip button.active{opacity:1!important;border-color:#fff!important}.digital-filmstrip img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}.digital-counter{font-variant-numeric:tabular-nums!important}
@keyframes kpDigitalKenBurns{from{transform:scale(1)}to{transform:scale(1.035) translate3d(-.5%,.3%,0)}}
@media(max-width:700px){
 .cover{min-height:88svh!important}.cover-copy{text-align:center!important;margin:auto!important;padding:54px 20px max(74px,env(safe-area-inset-bottom))!important}.cover h1{font-size:clamp(44px,14vw,66px)!important;margin-left:auto!important;margin-right:auto!important}.cover p,.cover-progress{margin-left:auto!important;margin-right:auto!important}.cover-progress{text-align:left!important}.scroll-cue{margin-left:auto!important;margin-right:auto!important}
 .toolbar{top:6px!important;margin:-52px 10px 26px!important;max-width:calc(100% - 20px)!important;width:auto!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:2px!important}.toolbar a,.toolbar button{min-width:0!important;padding:7px 3px!important;font-size:10px!important;gap:2px!important;overflow:hidden!important;text-overflow:ellipsis!important}.toolbar .primary{padding-left:2px!important;padding-right:2px!important}
 .stats-wrap{padding:0 14px 26px!important}.stat{padding:15px 4px!important}.stat strong{font-size:22px!important}.toc{margin:12px auto 54px!important;padding:0 14px!important}.toc-grid{grid-template-columns:1fr 1fr!important}.toc-grid a{min-height:76px!important;padding:10px!important}.toc-grid a span{width:40px!important;height:40px!important}.toc-grid a strong{font-size:12px!important}.chapter{padding:58px 14px 74px!important}.chapter::before{left:14px!important;right:14px!important}.chapter-head{grid-template-columns:auto 1fr!important;gap:12px!important;margin-bottom:24px!important}.chapter-badge{font-size:45px!important}.chapter-count{grid-column:2!important;justify-self:start!important}.photo-grid{display:block!important}.photo-card{margin:0 0 42px!important}.photo-card:nth-child(n){grid-column:auto!important}.photo-button{border-radius:18px!important}.photo-card:nth-child(n) .photo-button img{aspect-ratio:4/3!important;max-height:none!important}.photo-copy{padding-top:13px!important}.photo-copy blockquote{font-size:13px!important}.memories{padding:56px 14px 72px!important}.memory-grid{grid-template-columns:1fr!important}.offline-pdf-help{margin:20px 14px 54px!important}.ending{min-height:70svh!important;padding-left:18px!important;padding-right:18px!important}
 .story-stage{padding:8px 10px 10px!important}.story-card{height:min(70svh,660px)!important;border-radius:14px!important}.story-card img{object-fit:cover!important}.story-copy{padding:74px 18px 72px!important}.story-copy h2{font-size:30px!important}.story-copy blockquote{font-size:13px!important}.digital-filmstrip{bottom:72px!important;max-width:88vw!important}.digital-filmstrip button{flex-basis:44px!important;width:44px!important;height:34px!important}.story-controls{grid-template-columns:1fr auto 1fr!important}.story-controls button{min-width:0!important;font-size:12px!important}
}
@media(max-width:360px){.toc-grid{grid-template-columns:1fr!important}.toolbar a,.toolbar button{font-size:9px!important}.chapter-badge{font-size:40px!important}.digital-play{min-width:78px!important;padding:0 9px!important;font-size:11px!important}}
@media(prefers-reduced-motion:reduce){.cover-photo{animation:none!important}.toc-grid a,.photo-button img,.digital-story-progress i{transition:none!important}.digital-play{transition:none!important}}
@media print{
 .book.digital-album{background:white!important}.cover-photo{animation:none!important}.toolbar{display:none!important}.chapter{max-width:none!important;padding:8mm 0!important}.chapter::before{display:none!important}.chapter-head{margin-bottom:8mm!important}.chapter-badge{font-size:38pt!important}.photo-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7mm!important}.photo-card:nth-child(n){grid-column:auto!important;margin:0!important}.photo-button{border-radius:0!important;box-shadow:none!important}.photo-card:nth-child(n) .photo-button img{aspect-ratio:4/3!important;max-height:92mm!important}.photo-copy{padding:3mm 0 0!important}.digital-filmstrip,.digital-play,.digital-story-progress{display:none!important}.ending{min-height:0!important;color:#222!important;background:white!important}.ending p,.ending small{color:#555!important}
}
</style>`;

const DIGITAL_RUNTIME = `
(() => {
  "use strict";
  if (window.__kpDigitalAlbumRuntimeV4) return;
  window.__kpDigitalAlbumRuntimeV4 = true;
  document.documentElement.dataset.kpDigitalAlbum = "4";
  const book = document.querySelector(".book");
  if (book) book.classList.add("digital-album");
  const story = document.getElementById("storyMode");
  const dataNode = document.getElementById("kpAlbumPhotoData");
  let photos = [];
  try { photos = JSON.parse(dataNode?.textContent || "[]"); } catch {}
  if (!story || !photos.length) return;

  const head = story.querySelector(".story-head");
  const close = head?.querySelector(".overlay-close");
  let actions = head?.querySelector(".story-head-actions");
  if (!actions && head) {
    actions = document.createElement("div");
    actions.className = "story-head-actions";
    if (close) { close.remove(); actions.appendChild(close); }
    head.appendChild(actions);
  }
  let play = document.createElement("button");
  play.type = "button";
  play.className = "digital-play";
  play.textContent = "▶ Reproducir";
  if (actions) actions.insertBefore(play, actions.firstChild);

  const ambient = document.createElement("div");
  ambient.className = "digital-story-ambient";
  story.prepend(ambient);

  const filmstrip = document.createElement("div");
  filmstrip.className = "digital-filmstrip";
  filmstrip.setAttribute("aria-label", "Miniaturas del álbum");
  photos.forEach((p, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", "Ir a " + p.title);
    b.dataset.index = String(i);
    const img = document.createElement("img");
    img.src = p.photo;
    img.alt = "";
    img.loading = "lazy";
    b.appendChild(img);
    filmstrip.appendChild(b);
  });
  story.appendChild(filmstrip);

  const controls = story.querySelector(".story-controls");
  const progress = document.createElement("div");
  progress.className = "digital-story-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.innerHTML = "<i></i>";
  controls?.appendChild(progress);

  const position = story.querySelector(".story-position");
  position?.classList.add("digital-counter");
  let timer = 0;
  let playing = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function indexNow() {
    const text = position?.textContent || "1 / " + photos.length;
    const n = parseInt(text, 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(photos.length - 1, n - 1)) : 0;
  }
  function syncDigitalUi() {
    const i = indexNow();
    const p = photos[i];
    if (!p) return;
    story.style.setProperty("--digital-bg", "url(\"" + p.photo + "\")");
    progress.querySelector("i").style.width = (((i + 1) / photos.length) * 100) + "%";
    [...filmstrip.querySelectorAll("button")].forEach((b, n) => b.classList.toggle("active", n === i));
    const active = filmstrip.querySelector("button.active");
    active?.scrollIntoView({behavior:reduce?"auto":"smooth",inline:"center",block:"nearest"});
    if (playing && i >= photos.length - 1) stop();
  }
  function next() { document.getElementById("storyNext")?.click(); }
  function stop() {
    playing = false;
    clearInterval(timer);
    timer = 0;
    play.classList.remove("playing");
    play.textContent = "▶ Reproducir";
  }
  function start() {
    if (reduce || photos.length < 2) return;
    if (indexNow() >= photos.length - 1) {
      const current = indexNow();
      for (let i = 0; i < current; i++) document.getElementById("storyPrev")?.click();
    }
    playing = true;
    play.classList.add("playing");
    play.textContent = "Ⅱ Pausar";
    clearInterval(timer);
    timer = setInterval(next, 4500);
  }
  play.addEventListener("click", () => playing ? stop() : start());
  filmstrip.addEventListener("click", e => {
    const b = e.target.closest("button[data-index]");
    if (!b) return;
    stop();
    const target = Number(b.dataset.index), current = indexNow();
    const id = target >= current ? "storyNext" : "storyPrev";
    for (let i = 0; i < Math.abs(target - current); i++) document.getElementById(id)?.click();
  });
  document.getElementById("storyPrev")?.addEventListener("click", stop, {capture:true});
  document.getElementById("storyNext")?.addEventListener("click", () => { if (!playing) stop(); }, {capture:true});
  close?.addEventListener("click", stop, {capture:true});
  const mo = new MutationObserver(syncDigitalUi);
  if (position) mo.observe(position, {childList:true,subtree:true,characterData:true});
  const storyButton = document.getElementById("storyAlbum");
  storyButton?.addEventListener("click", () => setTimeout(syncDigitalUi, 0));
  story.addEventListener("touchstart", () => { if (playing) stop(); }, {passive:true});
  syncDigitalUi();
})();`;

function enhanceHtml(input) {
  let html = String(input || "");
  if (!html || html.includes('data-kp-digital-album-v4="1"')) return html;
  html = html.replace('<main class="book"', '<main class="book digital-album" data-kp-digital-album-v4="1"');
  html = html.replace("</head>", DIGITAL_STYLE + "</head>");
  html = html.replace("</body>", `<script>${DIGITAL_RUNTIME}<\/script></body>`);
  return html;
}

function injectShellStyle() {
  if (document.head.querySelector('[data-kp-digital-shell-v4="1"]')) return;
  document.head.insertAdjacentHTML("beforeend", SHELL_STYLE);
}

function paintFrame() {
  const frame = document.getElementById("kpAlbumExperienceFrame");
  const doc = frame?.contentDocument;
  if (!doc?.head || !doc.body) return false;
  if (!doc.head.querySelector('[data-kp-digital-album-v4="1"]')) doc.head.insertAdjacentHTML("beforeend", DIGITAL_STYLE);
  doc.querySelector(".book")?.classList.add("digital-album");
  if (!doc.documentElement.dataset.kpDigitalRuntimeInjected) {
    doc.documentElement.dataset.kpDigitalRuntimeInjected = "1";
    const s = doc.createElement("script");
    s.textContent = DIGITAL_RUNTIME;
    doc.body.appendChild(s);
  }
  return true;
}

function bindFrame() {
  const frame = document.getElementById("kpAlbumExperienceFrame");
  if (!frame || frame.dataset.kpDigitalBound === "1") return false;
  frame.dataset.kpDigitalBound = "1";
  frame.addEventListener("load", () => { setTimeout(paintFrame, 20); setTimeout(paintFrame, 180); });
  return true;
}

function patchApi() {
  const api = window.KP_ALBUM_EXPERIENCE;
  if (!api || patched || typeof api.html !== "function" || api.version !== "3.0") return false;
  if (!window.KP_ALBUM_IOS_COMPAT || !window.KP_ALBUM_V3_POLISH) return false;
  sourceHtml = api.html.bind(api);
  api.html = () => enhanceHtml(sourceHtml());
  api.digitalAlbum = true;
  api.digitalAlbumVersion = VERSION;
  api.immersiveSpreads = true;
  api.cinemaStory = true;
  api.storyAutoplay = true;
  api.filmstrip = true;
  api.ambientStory = true;
  api.fullBleedPhotography = true;
  api.progressiveEnhancementV4 = true;
  patched = true;
  return true;
}

function boot() {
  injectShellStyle();
  bindFrame();
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    injectShellStyle();
    bindFrame();
    if (patchApi() || tries > 120) clearInterval(timer);
  }, 100);
  document.addEventListener("click", e => {
    if (!e.target.closest?.("#kpAlbumOpenExperience")) return;
    bindFrame();
    [30,120,320,760].forEach(ms => setTimeout(paintFrame, ms));
  }, true);
  const observer = new MutationObserver(() => bindFrame());
  observer.observe(document.documentElement, {childList:true,subtree:true});
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {once:true}); else boot();

window.KP_ALBUM_DIGITAL_V4 = {
  version: VERSION,
  enhanceHtml,
  paintFrame,
  immersiveSpreads: true,
  cinemaStory: true,
  autoplay: true,
  filmstrip: true,
  ambientBackdrop: true,
  mobileFirst: true,
  printFallback: true,
  noJsCompatible: true
};
})();