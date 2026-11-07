/*
 * Original SVG artwork: the three guardians (브라키오, 스테고, 티라노), the
 * baby dinosaur in its nest, stage-card environments and level-map scenery.
 * All drawings are hand-built vector shapes in this file.
 */
(function (root) {
  'use strict';
  const DME = (root.DME = root.DME || {});

  const C = {
    brachio: { body: '#3cc6c0', dark: '#239c97', belly: '#b4f0ea', line: '#145452' },
    stego: { body: '#6cc24a', dark: '#46962f', belly: '#d3f2a4', line: '#2a5a1b', plate: '#f5922f', plateLine: '#9c4d12' },
    tyranno: { body: '#f6943a', dark: '#d46a1c', belly: '#ffe0aa', line: '#73360c' },
  };
  const SW = 'stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"';

  function eye(cx, cy, r, mood, line) {
    if (mood === 'laugh') {
      return `<path d="M${cx - r} ${cy + 1} Q${cx} ${cy - r * 1.2} ${cx + r} ${cy + 1}" fill="none" stroke="${line}" stroke-width="3.5" stroke-linecap="round"/>`;
    }
    return `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 1.1}" fill="#fff" stroke="${line}" stroke-width="2.5"/>
      <circle cx="${cx + r * 0.25}" cy="${cy + r * 0.15}" r="${r * 0.55}" fill="#1d1d1d"/>
      <circle cx="${cx + r * 0.45}" cy="${cy - r * 0.2}" r="${r * 0.22}" fill="#fff"/>`;
  }

  function brachio(mood) {
    const c = C.brachio;
    const mouth = mood === 'laugh'
      ? `<path d="M194 42 Q209 62 222 40 Z" fill="#8b2232" stroke="${c.line}" stroke-width="3" stroke-linejoin="round"/><path d="M200 48 Q209 56 216 46" fill="#ff8095"/>`
      : `<path d="M200 44 Q209 50 218 41" fill="none" stroke="${c.line}" stroke-width="3.5" stroke-linecap="round"/>`;
    return `<svg class="dino-svg" viewBox="0 0 240 220" aria-hidden="true">
      <ellipse cx="120" cy="210" rx="92" ry="8" fill="rgba(0,0,0,.18)"/>
      <g class="leg leg-b"><path d="M60 150 h22 v52 q0 7 -11 7 q-11 0 -11 -7z" fill="${c.dark}" stroke="${c.line}" ${SW}/></g>
      <g class="leg leg-a"><path d="M136 150 h22 v52 q0 7 -11 7 q-11 0 -11 -7z" fill="${c.dark}" stroke="${c.line}" ${SW}/></g>
      <g class="bob">
        <path d="M72 138 C44 138 22 128 6 110 C12 140 40 162 84 164 Z" fill="${c.body}" stroke="${c.line}" ${SW}/>
        <ellipse cx="114" cy="146" rx="60" ry="36" fill="${c.body}" stroke="${c.line}" ${SW}/>
        <ellipse cx="118" cy="162" rx="42" ry="14" fill="${c.belly}"/>
        <circle cx="96" cy="126" r="7" fill="${c.dark}" opacity=".55"/><circle cx="120" cy="120" r="5" fill="${c.dark}" opacity=".55"/>
        <circle cx="80" cy="140" r="4.5" fill="${c.dark}" opacity=".55"/><circle cx="140" cy="132" r="4" fill="${c.dark}" opacity=".55"/>
        <path d="M140 128 C152 100 160 70 164 42 L190 46 C186 82 178 114 170 144 Z" fill="${c.body}" stroke="${c.line}" ${SW}/>
        <path d="M166 60 q6 2 12 0 M164 82 q6 2 12 0 M160 104 q6 2 12 0" stroke="${c.dark}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M158 42 C158 22 176 13 194 15 C213 17 225 28 223 40 C221 53 205 57 187 55 C171 54 158 52 158 42Z" fill="${c.body}" stroke="${c.line}" ${SW}/>
        <circle cx="219" cy="30" r="1.8" fill="${c.line}"/>
        ${eye(190, 30, 7.5, mood, c.line)}
        <circle cx="181" cy="45" r="4.5" fill="#ff8fa3" opacity=".7"/>
        ${mouth}
      </g>
      <g class="leg leg-a"><path d="M76 152 h24 v52 q0 7 -12 7 q-12 0 -12 -7z" fill="${c.body}" stroke="${c.line}" ${SW}/></g>
      <g class="leg leg-b"><path d="M150 152 h24 v52 q0 7 -12 7 q-12 0 -12 -7z" fill="${c.body}" stroke="${c.line}" ${SW}/></g>
    </svg>`;
  }

  function plate(x, y, s, c) {
    return `<path d="M${x - 14 * s} ${y} Q${x - 13 * s} ${y - 24 * s} ${x} ${y - 34 * s} Q${x + 13 * s} ${y - 24 * s} ${x + 14 * s} ${y} Z" fill="${c.plate}" stroke="${c.plateLine}" stroke-width="3" stroke-linejoin="round"/>`;
  }

  function stego(mood) {
    const c = C.stego;
    const plates = [[74, 104, 0.8], [98, 88, 1], [126, 80, 1.15], [154, 84, 1.05], [180, 98, 0.85]].map(([x, y, s]) => plate(x, y, s, c)).join('');
    const mouth = mood === 'laugh'
      ? `<path d="M232 146 Q242 160 252 142 Z" fill="#8b2232" stroke="${c.line}" stroke-width="3" stroke-linejoin="round"/>`
      : `<path d="M234 148 Q242 154 250 145" fill="none" stroke="${c.line}" stroke-width="3.5" stroke-linecap="round"/>`;
    return `<svg class="dino-svg" viewBox="0 0 260 200" aria-hidden="true">
      <ellipse cx="135" cy="192" rx="100" ry="7" fill="rgba(0,0,0,.18)"/>
      <g class="leg leg-b"><path d="M60 146 h22 v36 q0 6 -11 6 q-11 0 -11 -6z" fill="${c.dark}" stroke="${c.line}" ${SW}/></g>
      <g class="leg leg-a"><path d="M152 146 h22 v36 q0 6 -11 6 q-11 0 -11 -6z" fill="${c.dark}" stroke="${c.line}" ${SW}/></g>
      <g class="bob">
        ${plates}
        <path d="M62 140 C40 138 20 128 8 114 C14 140 38 158 72 160 Z" fill="${c.body}" stroke="${c.line}" ${SW}/>
        <path d="M18 120 l-10 -16 l18 8 z M32 128 l-6 -18 l14 12 z" fill="${c.plate}" stroke="${c.plateLine}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M50 150 C50 102 90 76 132 76 C178 76 212 104 214 140 C214 156 200 162 180 162 L76 162 C60 162 50 160 50 150 Z" fill="${c.body}" stroke="${c.line}" ${SW}/>
        <path d="M74 150 C100 160 170 160 196 148 C194 156 186 160 176 160 L82 160 C76 160 74 156 74 150Z" fill="${c.belly}"/>
        <circle cx="110" cy="112" r="6" fill="${c.dark}" opacity=".5"/><circle cx="140" cy="104" r="5" fill="${c.dark}" opacity=".5"/><circle cx="168" cy="118" r="5" fill="${c.dark}" opacity=".5"/>
        <path d="M200 126 C212 124 220 128 228 132 L226 156 C214 158 206 156 198 150 Z" fill="${c.body}" stroke="${c.line}" ${SW}/>
        <ellipse cx="232" cy="142" rx="22" ry="16" fill="${c.body}" stroke="${c.line}" ${SW}/>
        ${eye(234, 136, 6, mood, c.line)}
        <circle cx="226" cy="148" r="3.5" fill="#ff8fa3" opacity=".7"/>
        ${mouth}
      </g>
      <g class="leg leg-a"><path d="M72 148 h24 v38 q0 6 -12 6 q-12 0 -12 -6z" fill="${c.body}" stroke="${c.line}" ${SW}/></g>
      <g class="leg leg-b"><path d="M166 148 h24 v38 q0 6 -12 6 q-12 0 -12 -6z" fill="${c.body}" stroke="${c.line}" ${SW}/></g>
    </svg>`;
  }

  function tyranno(mood) {
    const c = C.tyranno;
    const mouth = mood === 'laugh'
      ? `<path d="M166 68 Q196 104 228 62 Q198 76 166 68 Z" fill="#8b2232" stroke="${c.line}" stroke-width="3" stroke-linejoin="round"/><path d="M184 84 Q197 94 210 82" fill="#ff8095"/>`
      : `<path d="M168 72 Q198 84 226 64" fill="none" stroke="${c.line}" stroke-width="3.5" stroke-linecap="round"/>
         <path d="M184 77 l4 7 l4 -6 z M200 77 l4 7 l4 -8 z" fill="#fff" stroke="${c.line}" stroke-width="1.5" stroke-linejoin="round"/>`;
    return `<svg class="dino-svg" viewBox="0 0 240 240" aria-hidden="true">
      <ellipse cx="120" cy="230" rx="84" ry="7" fill="rgba(0,0,0,.18)"/>
      <g class="leg leg-b"><path d="M98 160 C94 186 96 205 100 220 L126 220 C124 204 122 184 124 164 Z" fill="${c.dark}" stroke="${c.line}" ${SW}/>
        <path d="M94 220 h36 q4 0 4 5 h-44 q0 -5 4 -5z" fill="${c.dark}" stroke="${c.line}" stroke-width="3" stroke-linejoin="round"/></g>
      <g class="bob">
        <path d="M96 146 C64 152 32 166 6 172 C30 186 72 184 108 172 Z" fill="${c.body}" stroke="${c.line}" ${SW}/>
        <path d="M88 150 C82 110 104 78 140 72 C170 70 184 100 178 140 C172 176 142 190 118 186 C100 182 90 170 88 150 Z" fill="${c.body}" stroke="${c.line}" ${SW}/>
        <path d="M134 100 C158 102 168 132 160 160 C152 178 134 180 126 172 C120 150 120 120 134 100 Z" fill="${c.belly}"/>
        <path d="M104 118 q8 -4 14 2 M100 138 q8 -4 14 2" stroke="${c.dark}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M156 116 C166 118 172 124 170 134" stroke="${c.line}" stroke-width="10" fill="none" stroke-linecap="round"/>
        <path d="M156 116 C166 118 172 124 170 134" stroke="${c.body}" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M130 78 C124 50 140 24 176 22 C206 20 230 32 232 54 C234 72 220 86 196 88 L160 92 C144 94 134 90 130 78 Z" fill="${c.body}" stroke="${c.line}" ${SW}/>
        <circle cx="224" cy="42" r="2" fill="${c.line}"/>
        ${eye(178, 46, 9, mood, c.line)}
        <circle cx="170" cy="66" r="5" fill="#ff8fa3" opacity=".7"/>
        ${mouth}
      </g>
      <g class="leg leg-a"><path d="M118 156 C112 186 114 205 118 220 L144 220 C142 204 142 184 146 160 Z" fill="${c.body}" stroke="${c.line}" ${SW}/>
        <path d="M112 220 h38 q4 0 4 5 h-46 q0 -5 4 -5z" fill="${c.body}" stroke="${c.line}" stroke-width="3" stroke-linejoin="round"/></g>
    </svg>`;
  }

  const GUARDIANS = {
    1: { kind: 'brachio', name: '브라키오' },
    2: { kind: 'stego', name: '스테고' },
    3: { kind: 'tyranno', name: '티라노' },
  };

  function dino(kind, mood) {
    const svg = kind === 'brachio' ? brachio(mood) : kind === 'stego' ? stego(mood) : tyranno(mood);
    // Stand on the bottom edge of whatever box the drawing is placed in.
    return svg.replace('<svg ', '<svg preserveAspectRatio="xMidYMax meet" ');
  }

  /** Baby dinosaur in a nest. #mouth-zone is the deletion hit area. */
  function babyNest() {
    return `<svg class="baby-svg" viewBox="0 0 200 180" aria-hidden="true">
      <ellipse cx="100" cy="142" rx="92" ry="30" fill="#6b4220"/>
      <g class="baby-body">
        <ellipse cx="100" cy="122" rx="46" ry="38" fill="#9ee37d" stroke="#3f7a2c" stroke-width="3.5"/>
        <ellipse cx="100" cy="132" rx="28" ry="22" fill="#e3f9c9"/>
        <path d="M60 116 q-10 8 -4 16 M140 116 q10 8 4 16" stroke="#3f7a2c" stroke-width="5" fill="none" stroke-linecap="round"/>
        <g class="baby-head">
          <circle cx="100" cy="68" r="44" fill="#9ee37d" stroke="#3f7a2c" stroke-width="3.5"/>
          <path d="M60 50 L68 38 L76 48 L86 32 L96 46 L106 30 L116 46 L126 34 L134 46 L140 52 C134 26 118 16 100 16 C80 16 64 28 60 50 Z" fill="#fff8e6" stroke="#b9a37a" stroke-width="2.5" stroke-linejoin="round"/>
          <g class="baby-eyes">
            <ellipse cx="82" cy="64" rx="9" ry="10" fill="#fff" stroke="#3f7a2c" stroke-width="2"/><circle cx="84" cy="66" r="5" fill="#1d1d1d"/><circle cx="86" cy="63" r="1.8" fill="#fff"/>
            <ellipse cx="118" cy="64" rx="9" ry="10" fill="#fff" stroke="#3f7a2c" stroke-width="2"/><circle cx="120" cy="66" r="5" fill="#1d1d1d"/><circle cx="122" cy="63" r="1.8" fill="#fff"/>
          </g>
          <circle cx="70" cy="84" r="6" fill="#ff8fa3" opacity=".6"/><circle cx="130" cy="84" r="6" fill="#ff8fa3" opacity=".6"/>
          <path class="mouth-closed" d="M88 90 Q100 100 112 90" fill="none" stroke="#3f7a2c" stroke-width="3.5" stroke-linecap="round"/>
          <g class="mouth-open">
            <ellipse cx="100" cy="94" rx="19" ry="16" fill="#7a1f2b" stroke="#3f7a2c" stroke-width="3"/>
            <ellipse cx="100" cy="102" rx="11" ry="6" fill="#ff7b8a"/>
            <path d="M88 82 l4 6 l4 -6 z M104 82 l4 6 l4 -6 z" fill="#fff"/>
          </g>
          <ellipse id="mouth-zone" class="mouth-zone" cx="100" cy="94" rx="21" ry="17" fill="transparent"/>
        </g>
      </g>
      <path d="M8 138 Q100 192 192 138 Q194 172 100 178 Q6 172 8 138 Z" fill="#9a6431" stroke="#5a3616" stroke-width="3"/>
      <path d="M24 150 l40 8 M60 164 l50 -6 M120 160 l52 -10 M40 162 l30 -14 M140 168 l30 -14 M90 170 l20 -12" stroke="#5a3616" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }

  // Gradient ids must be unique per SVG instance: a url(#id) that resolves to
  // a copy inside a hidden screen does not render in some browsers.
  let uidCounter = 0;
  function uniq(svg) {
    const sfx = '_u' + ++uidCounter;
    return svg.replace(/id="([A-Za-z]+)"/g, `id="$1${sfx}"`).replace(/url\(#([A-Za-z]+)\)/g, `url(#$1${sfx})`);
  }

  // ---------- environments ----------
  function prng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
  }

  function tree(x, y, s, hue) {
    const g = hue || '#3e9b3a';
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-7" y="-40" width="14" height="44" rx="4" fill="#6b4220"/>
      <circle cx="0" cy="-58" r="30" fill="${g}"/><circle cx="-20" cy="-44" r="20" fill="${g}"/><circle cx="20" cy="-44" r="20" fill="${g}"/>
      <circle cx="-8" cy="-68" r="12" fill="#ffffff" opacity=".12"/>
    </g>`;
  }
  function pine(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-5" y="-14" width="10" height="16" fill="#5a3616"/>
      <path d="M0 -90 L26 -40 L14 -40 L32 -12 L-32 -12 L-14 -40 L-26 -40 Z" fill="#2f7d39"/>
    </g>`;
  }
  function fern(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="#4fb043" stroke-width="5" stroke-linecap="round">
      <path d="M0 0 Q-10 -24 -30 -30"/><path d="M0 0 Q4 -30 -4 -44"/><path d="M0 0 Q14 -22 32 -26"/></g>`;
  }
  function flower(x, y, col) {
    return `<g transform="translate(${x} ${y})"><path d="M0 0 v-12" stroke="#3e8a32" stroke-width="3"/>
      <circle cx="0" cy="-15" r="6" fill="${col}"/><circle cx="0" cy="-15" r="2.5" fill="#ffe066"/></g>`;
  }
  function rock(x, y, s, col) {
    col = col || '#9c7a5b';
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-34 0 L-28 -26 L-8 -40 L18 -36 L34 -16 L36 0 Z" fill="${col}" stroke="#5c3f28" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-8 -40 L-2 -18 L18 -36 M-2 -18 L34 -16" stroke="#5c3f28" stroke-width="2" fill="none" opacity=".6"/>
      <path d="M-24 -22 L-10 -32" stroke="#fff" stroke-width="3" opacity=".25" stroke-linecap="round"/></g>`;
  }
  function burntTree(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="#1e1410" stroke-linecap="round" fill="none">
      <path d="M0 0 L0 -70" stroke-width="10"/><path d="M0 -40 L-22 -60" stroke-width="6"/><path d="M0 -52 L18 -74" stroke-width="6"/>
      <path d="M-22 -60 L-30 -64" stroke-width="4"/><path d="M18 -74 L26 -76" stroke-width="4"/>
      <path d="M-2 -20 L2 -30" stroke="#ff7a1a" stroke-width="2.5"/></g>`;
  }
  function lavaPool(x, y, rx, ry) {
    return `<g transform="translate(${x} ${y})"><ellipse rx="${rx + 6}" ry="${ry + 4}" fill="#3a1d14"/>
      <ellipse rx="${rx}" ry="${ry}" fill="url(#lavaGrad)" class="lava-glow"/>
      <circle cx="${-rx * 0.3}" cy="0" r="${ry * 0.3}" fill="#ffd166" class="bubble"/>
      <circle cx="${rx * 0.35}" cy="${-ry * 0.2}" r="${ry * 0.22}" fill="#ffd166" class="bubble b2"/></g>`;
  }

  const DEFS = `<defs>
    <linearGradient id="lavaGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset=".5" stop-color="#ff7b1c"/><stop offset="1" stop-color="#e63b17"/></linearGradient>
    <linearGradient id="skyForest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd6e8"/><stop offset="1" stop-color="#d7f2c5"/></linearGradient>
    <linearGradient id="skyCanyon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7c873"/><stop offset="1" stop-color="#f3e2b3"/></linearGradient>
    <linearGradient id="skyLava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b1020"/><stop offset=".6" stop-color="#8c2a1c"/><stop offset="1" stop-color="#d4561c"/></linearGradient>
  </defs>`;

  function stageCardArt(stage) {
    return uniq(stageCardArtRaw(stage));
  }
  function stageCardArtRaw(stage) {
    if (stage === 1) {
      return `<svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${DEFS}
        <rect width="400" height="260" fill="url(#skyForest)"/>
        <path d="M0 150 Q100 100 200 140 T400 120 V260 H0Z" fill="#7cc46a"/>
        <path d="M0 175 Q120 140 240 170 T400 160 V260 H0Z" fill="#5aa64c"/>
        ${pine(40, 168, 0.9)}${pine(350, 160, 1)}${tree(90, 190, 1.1)}${tree(300, 185, 1.05, '#4aa845')}${tree(200, 160, 0.8, '#2f8a34')}
        <path d="M150 260 C170 220 230 220 220 190 C215 175 190 172 200 160" stroke="#8a5a2b" stroke-width="40" fill="none" stroke-linecap="round"/>
        <path d="M150 260 C170 220 230 220 220 190 C215 175 190 172 200 160" stroke="#a87442" stroke-width="28" fill="none" stroke-linecap="round"/>
        ${fern(40, 250, 1)}${fern(360, 245, 1.1)}${flower(110, 245, '#ff7aa2')}${flower(280, 240, '#ffd23f')}${flower(320, 250, '#a78bfa')}
        </svg>`;
    }
    if (stage === 2) {
      return `<svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${DEFS}
        <rect width="400" height="260" fill="url(#skyCanyon)"/>
        <path d="M0 60 L60 50 L90 90 L130 80 L150 130 L0 140Z" fill="#c8693a"/>
        <path d="M0 90 L70 85 L120 130 L0 150Z" fill="#a8502a"/>
        <path d="M400 50 L330 60 L300 100 L260 95 L240 140 L400 150Z" fill="#c8693a"/>
        <path d="M400 85 L320 95 L280 140 L400 160Z" fill="#a8502a"/>
        <path d="M0 110 h150 M250 120 h150 M0 125 h120 M290 132 h110" stroke="#e08a52" stroke-width="4" opacity=".7"/>
        <path d="M0 150 Q200 120 400 150 V260 H0Z" fill="#b97a48"/>
        <path d="M120 260 L170 200 L190 150 L210 150 L230 200 L280 260Z" fill="#d9a46b"/>
        <path d="M170 230 l14 -12 l-6 -10 l12 -8 M230 240 l-10 -14 l8 -8" stroke="#6e4426" stroke-width="3" fill="none" stroke-linecap="round"/>
        ${rock(60, 230, 1.2)}${rock(340, 225, 1.3, '#a88466')}${rock(110, 200, 0.7, '#b48f6b')}${rock(300, 190, 0.7)}${rock(30, 175, 0.6, '#8a6a4f')}
        </svg>`;
    }
    return `<svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${DEFS}
      <rect width="400" height="260" fill="url(#skyLava)"/>
      <path d="M120 150 L180 50 L220 50 L290 150Z" fill="#3a2320"/>
      <path d="M180 50 L190 80 L200 62 L210 85 L220 50Z" fill="#ff7b1c"/>
      <circle cx="200" cy="30" r="22" fill="#5a4a48" opacity=".7" class="smoke"/><circle cx="222" cy="14" r="16" fill="#5a4a48" opacity=".55" class="smoke s2"/>
      <path d="M0 150 Q200 125 400 150 V260 H0Z" fill="#4a2a1e"/>
      ${lavaPool(200, 205, 110, 32)}
      ${burntTree(50, 190, 1)}${burntTree(355, 185, 0.9)}${rock(90, 245, 0.9, '#3d2b27')}${rock(320, 248, 1, '#3d2b27')}
      </svg>`;
  }

  /** Wide level-map scenery with level positions along a winding path. */
  function mapScene(stage, levelCount) {
    const W = 260 + levelCount * 170;
    const H = 600;
    const r = prng(stage * 977);
    const pts = [];
    for (let i = 0; i < levelCount; i++) pts.push({ x: 150 + i * 170, y: i % 2 === 0 ? 168 : 432 });
    let path = `M20 300 C70 300 ${pts[0].x - 80} ${pts[0].y} ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      path += ` C${a.x + 85} ${a.y} ${b.x - 85} ${b.y} ${b.x} ${b.y}`;
    }
    const last = pts[pts.length - 1];
    path += ` C${last.x + 80} ${last.y} ${W - 60} 300 ${W} 300`;

    let sky, ground, deco = '', road, roadTop, extra = '';
    if (stage === 1) {
      sky = 'url(#skyForest)';
      ground = `<rect y="70" width="${W}" height="${H}" fill="#6db35a"/><rect y="70" width="${W}" height="30" fill="#5aa64c"/>`;
      road = '#8a5a2b'; roadTop = '#b07a45';
      for (let x = 30; x < W; x += 70 + r() * 50) {
        deco += pine(x, 72 + r() * 10, 0.7 + r() * 0.4);
      }
      for (let i = 0; i < levelCount; i++) {
        const p = pts[i];
        const side = p.y < 300 ? 1 : -1;
        deco += tree(p.x + 70, p.y + side * 120 + 40, 0.9 + r() * 0.3, r() > 0.5 ? '#3e9b3a' : '#2f8a34');
        deco += fern(p.x - 60, p.y + side * 90, 0.9);
        deco += flower(p.x + 10 + r() * 40, p.y - side * 70 + 20, ['#ff7aa2', '#ffd23f', '#a78bfa', '#ff9f43'][i % 4]);
      }
      for (let x = 60; x < W; x += 140) deco += tree(x + r() * 40, 590, 1.1 + r() * 0.3, '#2f8a34');
    } else if (stage === 2) {
      sky = 'url(#skyCanyon)';
      ground = `<rect y="70" width="${W}" height="${H}" fill="#c08550"/>`;
      road = '#8e5c34'; roadTop = '#d9a46b';
      for (let x = 0; x < W; x += 200) {
        extra += `<path d="M${x} 110 L${x + 40} 40 L${x + 90} 60 L${x + 130} 20 L${x + 200} 70 L${x + 200} 110 Z" fill="#a8502a"/>`;
        extra += `<path d="M${x} 90 h200" stroke="#e08a52" stroke-width="5" opacity=".6"/>`;
      }
      for (let i = 0; i < levelCount; i++) {
        const p = pts[i];
        const side = p.y < 300 ? 1 : -1;
        deco += rock(p.x + 75, p.y + side * 110 + 30, 0.8 + r() * 0.5, ['#9c7a5b', '#a88466', '#8a6a4f'][i % 3]);
        deco += rock(p.x - 70, p.y - side * 60 + 20, 0.5 + r() * 0.3, '#b48f6b');
      }
      for (let x = 40; x < W; x += 120) deco += rock(x + r() * 40, 598, 1 + r() * 0.5, '#8a6a4f');
    } else {
      sky = 'url(#skyLava)';
      ground = `<rect y="70" width="${W}" height="${H}" fill="#4a2a1e"/>`;
      road = '#2a1a16'; roadTop = '#5b3b30';
      for (let x = 0; x < W; x += 320) {
        extra += `<path d="M${x + 40} 100 L${x + 130} 10 L${x + 170} 10 L${x + 260} 100 Z" fill="#2e1b18"/><path d="M${x + 130} 10 L${x + 140} 34 L${x + 150} 18 L${x + 160} 36 L${x + 170} 10Z" fill="#ff7b1c" class="lava-glow"/>`;
      }
      for (let i = 0; i < levelCount; i++) {
        const p = pts[i];
        const side = p.y < 300 ? 1 : -1;
        deco += burntTree(p.x + 70, p.y + side * 120 + 40, 0.9 + r() * 0.3);
        if (i % 2 === 0) deco += lavaPool(p.x - 70, p.y + side * 110, 40, 14);
        deco += rock(p.x - 60, p.y - side * 70 + 20, 0.5, '#3d2b27');
      }
    }
    // cracks along the road (stage 2: dark cracks, stage 3: lava inside)
    let cracks = '';
    if (stage >= 2) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const crack = `M${mx - 16} ${my - 10} l10 8 l-6 8 l12 6 l-4 8`;
        if (stage === 2) cracks += `<path d="${crack}" stroke="#5a3a20" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
        else cracks += `<path d="${crack}" stroke="#1a0d0a" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path class="lava-glow" d="${crack}" stroke="#ff8a1c" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    }
    const svg = `<svg class="map-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${DEFS}
      <rect width="${W}" height="${H}" fill="${sky}"/>${extra}${ground}${deco}
      <path d="${path}" stroke="${road}" stroke-width="76" fill="none" stroke-linecap="round"/>
      <path d="${path}" stroke="${roadTop}" stroke-width="58" fill="none" stroke-linecap="round"/>
      <path d="${path}" stroke="rgba(255,255,255,.35)" stroke-width="5" stroke-dasharray="14 18" fill="none"/>
      ${cracks}</svg>`;
    return { svg: uniq(svg), width: W, height: H, points: pts };
  }

  /** Grassland background for the standalone calculator. */
  function grassland() {
    return uniq(`<svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${DEFS}
      <rect width="800" height="600" fill="url(#skyForest)"/>
      <circle cx="680" cy="90" r="46" fill="#fff3b0"/><circle cx="680" cy="90" r="34" fill="#ffe066"/>
      <g fill="#fff" opacity=".85"><ellipse cx="160" cy="90" rx="60" ry="20"/><ellipse cx="200" cy="76" rx="40" ry="20"/><ellipse cx="480" cy="130" rx="54" ry="16"/></g>
      <path d="M0 330 Q200 270 400 320 T800 300 V600 H0Z" fill="#8fd16f"/>
      <path d="M0 400 Q260 350 520 400 T800 390 V600 H0Z" fill="#6dbb54"/>
      <path d="M0 500 Q300 460 800 500 V600 H0Z" fill="#8a5a2b"/>
      ${tree(60, 360, 0.9)}${tree(740, 350, 1)}${pine(140, 330, 0.7)}${pine(660, 320, 0.7)}
      ${flower(220, 470, '#ff7aa2')}${flower(260, 480, '#ffd23f')}${flower(560, 470, '#a78bfa')}${flower(600, 478, '#ff9f43')}
      </svg>`);
  }

  DME.Art = { dino, babyNest, stageCardArt, mapScene, grassland, GUARDIANS, COLORS: C };
})(typeof self !== 'undefined' ? self : this);
