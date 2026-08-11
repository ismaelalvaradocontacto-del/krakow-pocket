(() => {
  "use strict";
  if (window.__kpLandmarkArtFix) return;
  window.__kpLandmarkArtFix = true;

  const $all = s => [...document.querySelectorAll(s)];
  const W = "#5b3927";
  const STONE = "#e9dfc7";
  const BRICK = "#bd6848";
  const GREEN = "#6d9f55";
  const COPPER = "#5f8d7c";
  const GOLD = "#e4c06c";
  const WATER = "#75bfd6";

  const svg = body => `<svg class="kp-landmark-svg kp-landmark-v2" viewBox="0 0 180 180" aria-hidden="true" focusable="false"><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  const shadow = `<ellipse cx="90" cy="158" rx="64" ry="9" fill="#3a281d" opacity=".14"/>`;

  const ART = {
    florian: svg(`${shadow}
      <path d="M51 151V72h78v79z" fill="${STONE}" stroke="${W}" stroke-width="5"/>
      <path d="M44 73h92L90 28z" fill="#ad493e" stroke="${W}" stroke-width="5"/>
      <path d="M66 151v-42c0-16 9-26 24-26s24 10 24 26v42" fill="#6f503c" stroke="${W}" stroke-width="5"/>
      <path d="M59 69h62M61 58h58" stroke="#f7edcf" stroke-width="4" opacity=".8"/>
      <rect x="58" y="89" width="13" height="18" rx="2" fill="#6e93a5" stroke="${W}" stroke-width="3"/>
      <rect x="109" y="89" width="13" height="18" rx="2" fill="#6e93a5" stroke="${W}" stroke-width="3"/>
      <circle cx="90" cy="57" r="7" fill="${GOLD}" stroke="${W}" stroke-width="3"/>`),

    maria: svg(`${shadow}
      <rect x="42" y="78" width="96" height="72" fill="${BRICK}" stroke="${W}" stroke-width="5"/>
      <rect x="43" y="47" width="32" height="103" fill="#c2704d" stroke="${W}" stroke-width="5"/>
      <rect x="106" y="31" width="32" height="119" fill="#a8563d" stroke="${W}" stroke-width="5"/>
      <path d="M39 47 59 19l20 28M102 31 122 4l20 27" fill="${COPPER}" stroke="${W}" stroke-width="5"/>
      <circle cx="122" cy="70" r="9" fill="#f4dc92" stroke="${W}" stroke-width="4"/>
      <path d="M55 111h15M111 111h16M82 101h17" stroke="#7e4333" stroke-width="5"/>`),

    planty: svg(`${shadow}
      <path d="M24 145c31-31 67-35 132-17" fill="none" stroke="#d7bf78" stroke-width="14"/>
      <path d="M52 142V94h13v48M121 137V88h13v49" fill="#77523a" stroke="${W}" stroke-width="4"/>
      <circle cx="58" cy="70" r="32" fill="#6ca256" stroke="${W}" stroke-width="5"/>
      <circle cx="128" cy="63" r="36" fill="#7eb264" stroke="${W}" stroke-width="5"/>
      <circle cx="38" cy="81" r="20" fill="#85b968"/>
      <circle cx="148" cy="80" r="22" fill="#8dbf6d"/>
      <path d="M73 126h33M77 126v17M102 126v17M76 136h28" stroke="#694933" stroke-width="5"/>`),

    maius: svg(`${shadow}
      <path d="M27 65h126v86H27z" fill="#b96a4c" stroke="${W}" stroke-width="5"/>
      <path d="M21 65 45 38h90l24 27" fill="#6f7582" stroke="${W}" stroke-width="5"/>
      <path d="M40 151v-48h100v48" fill="#d8c294" stroke="${W}" stroke-width="4"/>
      <path d="M47 151v-28q0-16 13-16t13 16v28M77 151v-28q0-16 13-16t13 16v28M107 151v-28q0-16 13-16t13 16v28" fill="none" stroke="#7b5339" stroke-width="5"/>
      <circle cx="90" cy="56" r="9" fill="${GOLD}" stroke="${W}" stroke-width="3"/>
      <path d="M90 117v25M81 142h18" stroke="#5d4935" stroke-width="4"/>`),

    tomasza: svg(`${shadow}
      <path d="M29 66h122v84H29z" fill="#e3c88e" stroke="${W}" stroke-width="5"/>
      <path d="M25 66h130l-12-24H37z" fill="#9d3f36" stroke="${W}" stroke-width="5"/>
      <path d="M39 66v20M60 66v20M81 66v20M102 66v20M123 66v20M144 66v20" stroke="#fff1c7" stroke-width="9"/>
      <rect x="45" y="99" width="34" height="51" fill="#76a0ad" stroke="${W}" stroke-width="4"/>
      <rect x="94" y="98" width="42" height="24" rx="4" fill="#fff0c7" stroke="${W}" stroke-width="4"/>
      <path d="M101 109h28" stroke="#6e9a55" stroke-width="6"/>
      <path d="M101 134h29" stroke="#7a5638" stroke-width="5"/>`),

    szeroka: svg(`${shadow}
      <path d="M23 151V80h42v71M69 151V63h45v88M118 151V88h39v63" fill="#d8a06a" stroke="${W}" stroke-width="5"/>
      <path d="M19 80 44 52l25 28M65 63l27-31 26 31M114 88l23-25 24 25" fill="#a64b3d" stroke="${W}" stroke-width="5"/>
      <rect x="34" y="108" width="14" height="43" fill="#74513b"/>
      <rect x="84" y="107" width="15" height="44" fill="#77513a"/>
      <rect x="130" y="119" width="13" height="32" fill="#74513b"/>
      <path d="M34 94h15M83 83h17M129 104h13" stroke="#6f96a4" stroke-width="8"/>
      <path d="M90 151c-4-21-1-35 9-47" stroke="#c6a467" stroke-width="7"/>`),

    dragon: svg(`${shadow}
      <path d="M52 145c-22-20-23-54-5-77 18-24 48-29 75-12 21 13 30 39 21 62-9 23-29 37-55 38-14 0-26-4-36-11z" fill="#67a657" stroke="${W}" stroke-width="6"/>
      <path d="M59 73 45 35l30 23M80 58 75 26l23 28M109 58l14-29 14 35" fill="#dfbf55" stroke="${W}" stroke-width="5"/>
      <ellipse cx="82" cy="91" rx="7" ry="9" fill="#2a211c"/><ellipse cx="112" cy="91" rx="7" ry="9" fill="#2a211c"/>
      <circle cx="84" cy="88" r="2" fill="#fff"/><circle cx="114" cy="88" r="2" fill="#fff"/>
      <path d="M86 116q15 11 29 0" fill="none" stroke="#385d34" stroke-width="5"/>
      <path d="M48 109c-27 5-34 24-29 42 12-9 22-13 34-10M137 101c22 1 33 12 38 29-13-4-24-1-35 7" fill="#73b260" stroke="${W}" stroke-width="5"/>
      <path d="M142 108c17 1 28 9 36 20-13 0-23 5-31 13" fill="#f09a3d" stroke="#a65b2d" stroke-width="5"/>`),

    bernatek: svg(`${shadow}
      <path d="M18 125h144" stroke="#8b5d39" stroke-width="13"/>
      <path d="M28 124q20-57 62-57t62 57" fill="none" stroke="#5f4637" stroke-width="8"/>
      <path d="M44 84v41M67 70v55M90 67v58M113 72v53M136 89v36" stroke="#6b5141" stroke-width="3"/>
      <path d="M16 142h148" stroke="${WATER}" stroke-width="12" opacity=".75"/>
      <circle cx="67" cy="96" r="5" fill="#e8d6ac" stroke="${W}" stroke-width="2"/>
      <path d="M67 101v15M62 108h10" stroke="${W}" stroke-width="3"/>
      <circle cx="113" cy="91" r="5" fill="#e8d6ac" stroke="${W}" stroke-width="2"/>
      <path d="M113 96v16M108 104h10" stroke="${W}" stroke-width="3"/>`),

    placnowy: svg(`${shadow}
      <path d="M46 151V91l17-20h54l17 20v60z" fill="#cf9865" stroke="${W}" stroke-width="5"/>
      <path d="M56 70 90 45l34 25" fill="#a94c3c" stroke="${W}" stroke-width="5"/>
      <path d="M66 151v-31h48v31" fill="#74513b" stroke="${W}" stroke-width="4"/>
      <circle cx="90" cy="80" r="10" fill="${GOLD}" stroke="${W}" stroke-width="4"/>
      <path d="M45 103h90M52 114h76" stroke="#f1d99c" stroke-width="4" opacity=".8"/>
      <path d="M37 151h106" stroke="#8b6847" stroke-width="6"/>`),

    wawel: svg(`${shadow}
      <path d="M19 145q36-27 71-19 35-8 71 19v10H19z" fill="#7ea15c"/>
      <path d="M31 143V88h32V64h31v28h29V72h29v71z" fill="${STONE}" stroke="${W}" stroke-width="5"/>
      <path d="M27 88 47 61l20 27M59 64 78 39l20 25M119 72 138 45l18 27" fill="#b64d3e" stroke="${W}" stroke-width="5"/>
      <rect x="78" y="112" width="17" height="31" fill="#74513b"/>
      <path d="M39 106h13M72 83h13M128 93h13" stroke="#7194a2" stroke-width="7"/>`),

    rynek: svg(`${shadow}
      <path d="M25 149V83h130v66z" fill="#d9c3a0" stroke="${W}" stroke-width="5"/>
      <path d="M22 83h136l-18-22H40z" fill="#7b6d5b" stroke="${W}" stroke-width="5"/>
      <path d="M70 61V39h40v22" fill="#c68a55" stroke="${W}" stroke-width="5"/>
      <path d="M66 39 90 18l24 21" fill="#a64b3c" stroke="${W}" stroke-width="5"/>
      <circle cx="90" cy="49" r="7" fill="${GOLD}" stroke="${W}" stroke-width="3"/>
      <path d="M37 149v-24q0-13 11-13t11 13v24M69 149v-24q0-13 11-13t11 13v24M101 149v-24q0-13 11-13t11 13v24M133 149v-24q0-13 11-13t11 13v24" fill="none" stroke="#79563e" stroke-width="5"/>`),

    ghetto: svg(`${shadow}
      <path d="M30 146h120" stroke="#b79964" stroke-width="6"/>
      <g fill="none" stroke="${W}" stroke-width="6">
        <path d="M38 70v47h33V70M38 93h33M44 117v25M65 117v25"/>
        <path d="M108 56v47h33V56M108 79h33M114 103v39M135 103v39"/>
        <path d="M76 96v36h27V96M76 114h27M81 132v12M98 132v12"/>
      </g>
      <path d="M38 70h33M108 56h33M76 96h27" stroke="#8b694c" stroke-width="8"/>
      <circle cx="89" cy="44" r="7" fill="#d7bb73" opacity=".75"/>`)
  };

  const EXPECTED = Object.keys(ART);

  function paint() {
    let painted = 0;
    let missing = [];
    for (const node of $all('#kpQuestWorld .kp-world-node[data-pixel-poi]')) {
      const id = node.dataset.pixelPoi;
      const target = node.querySelector('.kp-landmark-art');
      if (!target) continue;
      const markup = ART[id];
      if (!markup) {
        missing.push(id);
        continue;
      }
      if (target.dataset.landmarkV2 === id && target.querySelector('.kp-landmark-v2')) continue;
      target.innerHTML = markup;
      target.dataset.landmarkV2 = id;
      target.dataset.asset = `landmark-v2-${id}`;
      painted++;
    }
    window.KP_LANDMARK_ART = {
      version: '2.0',
      expected: EXPECTED.length,
      painted: $all('#kpQuestWorld .kp-landmark-art .kp-landmark-v2').length,
      missing,
      complete: missing.length === 0 && $all('#kpQuestWorld .kp-landmark-art .kp-landmark-v2').length >= EXPECTED.length
    };
    return painted;
  }

  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      paint();
    });
  };

  function bind() {
    paint();
    const root = document.body;
    if (root) new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
    document.addEventListener('click', e => {
      if (e.target.closest?.('.tab[data-panel="quests"]')) setTimeout(paint, 20);
    }, true);
    window.addEventListener('kp:render', schedule);
    window.addEventListener('kp:game-render', schedule);
    window.addEventListener('kp:statechange', schedule);
    window.addEventListener('pageshow', schedule);
    [50, 180, 500, 1200].forEach(ms => setTimeout(paint, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
