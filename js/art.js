/* ============================================================
   art.js - 임시 아트 (UI 이미지가 생기기 전까지 쓰는 코드 그림)
   - icon(name)            : 선 아이콘
   - character(appearance) : 외형 값으로 색·형태가 정해지는 SVG 캐릭터
   - monster(questId)      : 의뢰별 몬스터 SVG
   - hall()                : 길드 홀 배경 (CSS로 꾸미는 레이어)
   나중에 실제 이미지가 생기면 이 파일의 함수만 바꿔 끼우면 된다.
   ============================================================ */
(function (global) {
  'use strict';

  const INK = '#1b1626';
  const hsl = (h, s, l) => `hsl(${Math.round(((h % 360) + 360) % 360)} ${s}% ${Math.round(l)}%)`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- 아이콘 (24x24, 선 스타일) ---------- */
  const ICONS = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    pin: '<path d="M12 21s-6-5.6-6-10a6 6 0 1 1 12 0c0 4.4-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.8.2 5 2.3 5 5.3"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.5 9.5h4a1.7 1.7 0 0 1 0 3.4h-3a1.7 1.7 0 0 0 0 3.4h4"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1.9-1.1 1.8M12 16.8v.2"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    scroll: '<path d="M8 4h10v12a3 3 0 0 1-3 3H6a3 3 0 0 0 2-3z"/><path d="M8 4a2 2 0 0 0-2 2v1h2M11 8h4M11 11.5h4M11 15h2"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    cross: '<path d="M6 6l12 12M18 6L6 18"/>',
    sword: '<path d="M14.5 4.5L20 4l-.5 5.5L9 20l-5-5z"/><path d="M5.5 13.5l5 5M4 20l2.5-2.5"/>',
    bandage: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M10 10.5v.1M14 13.5v.1M12 12v.1"/>',
    skull: '<path d="M5 11a7 7 0 0 1 14 0v3a2 2 0 0 1-2 2v3H7v-3a2 2 0 0 1-2-2z"/><circle cx="9.3" cy="11.5" r="1.4"/><circle cx="14.7" cy="11.5" r="1.4"/><path d="M10.5 16v2M13.5 16v2"/>',
    book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
    'chev-l': '<path d="M14.5 5l-7 7 7 7"/>',
    'chev-r': '<path d="M9.5 5l7 7-7 7"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    diamond: '<path d="M12 3l8 9-8 9-8-9z"/>',
    chat: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  };
  function icon(name, cls) {
    return `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  }

  // 나침반 (의뢰 파견 버튼)
  function compass() {
    return `<svg class="compass" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#2a1519" stroke="#d9b46c" stroke-width="3"/>
      <circle cx="50" cy="50" r="38" fill="none" stroke="#a8834a" stroke-width="1.5" stroke-dasharray="2 4"/>
      <path d="M50 10 L58 50 L50 90 L42 50Z" fill="#e8d7ac" stroke="#d9b46c" stroke-width="1.5"/>
      <path d="M10 50 L50 42 L90 50 L50 58Z" fill="#b3463f" stroke="#d9b46c" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="5" fill="#d9b46c"/></svg>`;
  }

  /* ---------- 캐릭터 ---------- */
  // 외형 번호 -> 색과 형태. (같은 외형이면 항상 같은 모습)
  function look(a) {
    const fantasy = a.race % 5 === 4; // 일부 종족은 비현실적인 피부색
    const hh = (a.hairColor / 500) * 360;
    const hl = (a.hairColor * 7) % 34;
    const ch = (a.clothes * 37) % 360;
    return {
      skin: fantasy ? hsl(a.race * 23, 32, 58 + (a.skin % 5) * 3) : hsl(20 + (a.skin % 4) * 3, 48, 48 + a.skin * 1.9),
      shade: fantasy ? hsl(a.race * 23, 32, 46) : hsl(18 + (a.skin % 4) * 3, 48, 38 + a.skin * 1.6),
      hair: hsl(hh, 48 + (a.hairColor % 4) * 9, 28 + hl),
      hairLight: hsl(hh, 50, 46 + hl / 2),
      iris: hsl((a.eyeColor / 500) * 360, 75, 52),
      cloth: hsl(ch, 38, 36),
      trim: hsl(ch, 45, 62),
      pants: hsl(ch + 200, 22, 22),
      gem: hsl((a.accessory * 53) % 360, 80, 60),
    };
  }

  function character(a, opts) {
    opts = opts || {};
    const L = look(a);
    const o = `stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"`;
    const sw = a.gender === 1 ? 0 : 3;            // 성별에 따라 어깨 폭이 조금 다르다
    const sl = 30 + sw, sr = 70 - sw;
    const hs = a.hair % 6;                         // 머리 모양 6가지
    const ev = a.eye % 3;                          // 눈 모양 3가지
    const rx = [4, 5, 4.3][ev], ry = [5.2, 3.6, 6.2][ev];
    const pointy = a.race % 4 === 1;               // 뾰족 귀
    const catEars = a.race % 6 === 5;              // 동물 귀
    const horns = a.race % 7 === 6;                // 뿔

    let back = '';
    if (catEars) back += `<path d="M30 28 L25 5 L45 20Z" fill="${L.hair}" ${o}/><path d="M70 28 L75 5 L55 20Z" fill="${L.hair}" ${o}/><path d="M31 24 L28 12 L38 20Z" fill="#f4a6b4"/><path d="M69 24 L72 12 L62 20Z" fill="#f4a6b4"/>`;
    if (horns) back += `<path d="M33 26 Q24 10 34 3 Q37 14 43 21Z" fill="#e8e2d0" ${o}/><path d="M67 26 Q76 10 66 3 Q63 14 57 21Z" fill="#e8e2d0" ${o}/>`;
    if (hs === 1) back += `<path d="M26 40 Q20 12 50 12 Q80 12 74 40 L80 96 Q50 104 20 96Z" fill="${L.hair}" ${o}/>`;
    if (hs === 2) back += `<path d="M27 40 Q24 14 50 14 Q76 14 73 40Z" fill="${L.hair}" ${o}/><g fill="${L.hair}" ${o}><circle cx="71" cy="64" r="5.5"/><circle cx="73" cy="75" r="5.5"/><circle cx="71" cy="86" r="5.5"/><circle cx="73" cy="97" r="5"/></g><path d="M66 58 L76 58 L72 66Z" fill="${L.gem}" ${o}/>`;
    if (hs === 3) back += `<path d="M28 36 Q8 50 13 92 Q24 72 31 52Z" fill="${L.hair}" ${o}/><path d="M72 36 Q92 50 87 92 Q76 72 69 52Z" fill="${L.hair}" ${o}/>`;
    if (hs === 5) back += `<circle cx="50" cy="11" r="10" fill="${L.hair}" ${o}/>`;

    const legs = `<path d="M34 112 L36 158 L49 158 L50 112Z" fill="${L.pants}" ${o}/><path d="M50 112 L51 158 L64 158 L66 112Z" fill="${L.pants}" ${o}/>
      <rect x="32" y="153" width="18" height="9" rx="3" fill="#2a2030" ${o}/><rect x="50" y="153" width="18" height="9" rx="3" fill="#2a2030" ${o}/>`;
    const torso = `<path d="M${sl} 72 Q50 64 ${sr} 72 L${sr + 3} 114 L${sl - 3} 114Z" fill="${L.cloth}" ${o}/>
      <path d="M44 68 L50 82 L56 68" fill="none" stroke="${L.trim}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="${sl - 3}" y="108" width="${sr - sl + 6}" height="6" fill="${L.trim}" ${o}/>`;
    const arms = `<path d="M${sl} 74 L${sl - 9} 110 L${sl - 1} 113 L${sl + 6} 82Z" fill="${L.cloth}" ${o}/><circle cx="${sl - 6}" cy="115" r="4.6" fill="${L.skin}" ${o}/>
      <path d="M${sr} 74 L${sr + 9} 110 L${sr + 1} 113 L${sr - 6} 82Z" fill="${L.cloth}" ${o}/><circle cx="${sr + 6}" cy="115" r="4.6" fill="${L.skin}" ${o}/>`;
    const neck = `<rect x="44" y="58" width="12" height="16" fill="${L.shade}" ${o}/>`;

    let ears = `<ellipse cx="29" cy="44" rx="3" ry="5" fill="${L.skin}" ${o}/><ellipse cx="71" cy="44" rx="3" ry="5" fill="${L.skin}" ${o}/>`;
    if (pointy) ears = `<path d="M30 40 L14 34 L31 52Z" fill="${L.skin}" ${o}/><path d="M70 40 L86 34 L69 52Z" fill="${L.skin}" ${o}/>`;
    const head = `<ellipse cx="50" cy="42" rx="21" ry="22" fill="${L.skin}" ${o}/>`;

    const eye = (cx) => `<ellipse cx="${cx}" cy="45" rx="${rx}" ry="${ry}" fill="#fff" ${o}/>
      <ellipse cx="${cx}" cy="45.5" rx="${rx * 0.78}" ry="${ry * 0.9}" fill="${L.iris}"/>
      <ellipse cx="${cx}" cy="46" rx="${rx * 0.4}" ry="${ry * 0.55}" fill="${INK}"/><circle cx="${cx - 1.2}" cy="43.2" r="1.3" fill="#fff"/>`;
    const face = `${eye(41)}${eye(59)}
      <path d="M35.5 37 Q40.5 34.5 45.5 37M54.5 37 Q59.5 34.5 64.5 37" fill="none" stroke="${L.hair}" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M46.5 54 Q50 57 53.5 54" fill="none" stroke="#7a3b3b" stroke-width="1.4" stroke-linecap="round"/>
      <ellipse cx="35" cy="51" rx="4" ry="2.3" fill="#ff6f8a" opacity=".28"/><ellipse cx="65" cy="51" rx="4" ry="2.3" fill="#ff6f8a" opacity=".28"/>`;

    let front = `<path d="M28 42 Q26 14 50 14 Q74 14 72 42 Q66 30 56 30 Q52 36 46 30 Q36 30 28 42Z" fill="${L.hair}" ${o}/>
      <path d="M38 20 Q46 16 54 19" fill="none" stroke="${L.hairLight}" stroke-width="2" stroke-linecap="round"/>`;
    if (hs === 4) front = `<path d="M27 40 L23 19 L36 26 L41 9 L50 24 L59 9 L64 26 L77 19 L73 40 Q62 28 50 30 Q38 28 27 40Z" fill="${L.hair}" ${o}/>`;

    let acc = '';
    const at = a.accessory % 4;
    if (at === 0) acc = `<circle cx="50" cy="88" r="4" fill="${L.gem}" ${o}/>`;
    if (at === 1) acc = `<path d="M64 20 l2 4.5 5 .6 -3.700 3.400 1 5 -4.300-2.500 -4.300 2.500 1-5 -3.700-3.400 5-.6z" fill="${L.gem}" ${o}/>`;
    if (at === 2) acc = `<path d="M38 66 Q50 75 62 66 L63 74 Q50 83 37 74Z" fill="${L.gem}" ${o}/>`;
    if (at === 3) acc = `<circle cx="29" cy="52" r="2.4" fill="${L.gem}" ${o}/><circle cx="71" cy="52" r="2.4" fill="${L.gem}" ${o}/>`;

    const vb = opts.view === 'bust' ? '12 8 76 86' : '0 0 100 166';
    return `<svg class="char ${opts.cls || ''}" viewBox="${vb}" role="img" aria-label="${esc(opts.label || '모험가')}" data-ap="${[a.gender, a.race, a.skin, a.eye, a.hair, a.eyeColor, a.hairColor, a.clothes, a.accessory].join(',')}" data-tc="${L.skin}|${L.hair}|${L.iris}">${back}${legs}${torso}${arms}${neck}${ears}${head}${face}${front}${acc}</svg>`;
  }

  /* ---------- 몬스터 ---------- */
  const MONSTERS = {
    q1: `<path d="M92 88 Q116 84 112 60" fill="none" stroke="#c9a28a" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="66" cy="82" rx="34" ry="22" fill="#8d6e5a" stroke="${INK}" stroke-width="2"/>
      <circle cx="34" cy="76" r="19" fill="#9c7b66" stroke="${INK}" stroke-width="2"/>
      <circle cx="24" cy="58" r="9" fill="#9c7b66" stroke="${INK}" stroke-width="2"/><circle cx="24" cy="58" r="5" fill="#f1a9b3"/>
      <circle cx="44" cy="57" r="9" fill="#9c7b66" stroke="${INK}" stroke-width="2"/><circle cx="44" cy="57" r="5" fill="#f1a9b3"/>
      <circle cx="26" cy="74" r="3" fill="#e5392f"/><circle cx="25" cy="73" r="1" fill="#fff"/><circle cx="15" cy="82" r="3.4" fill="#f1a9b3"/>
      <path d="M16 86 L4 84M16 88 L5 92" stroke="${INK}" stroke-width="1.2"/><rect x="22" y="90" width="5" height="6" fill="#fff" stroke="${INK}" stroke-width="1"/>`,
    q2: `<path d="M96 80 Q118 70 112 50 Q106 66 92 70Z" fill="#7d8594" stroke="${INK}" stroke-width="2"/>
      <ellipse cx="66" cy="78" rx="36" ry="24" fill="#8d96a6" stroke="${INK}" stroke-width="2"/>
      <path d="M40 54 L36 32 L52 48Z M62 52 L68 30 L76 54Z" fill="#7d8594" stroke="${INK}" stroke-width="2"/>
      <path d="M20 64 Q34 46 56 54 Q64 72 50 86 L14 84 Q8 74 20 64Z" fill="#a0a8b8" stroke="${INK}" stroke-width="2"/>
      <circle cx="40" cy="64" r="3.4" fill="#ffd34a"/><circle cx="39" cy="63" r="1.1" fill="#1b1626"/>
      <circle cx="12" cy="78" r="3.6" fill="${INK}"/><path d="M18 86 L22 94 L26 86Z M30 86 L34 94 L38 86Z" fill="#fff" stroke="${INK}" stroke-width="1"/>
      <path d="M44 100 L44 112 M60 102 L60 114 M80 102 L80 114 M96 96 L98 108" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
    q3: `<path d="M20 52 L2 38 L26 66Z M80 52 L98 38 L74 66Z" fill="#6fa356" stroke="${INK}" stroke-width="2"/>
      <ellipse cx="50" cy="60" rx="28" ry="26" fill="#7fb862" stroke="${INK}" stroke-width="2"/>
      <circle cx="40" cy="56" r="5" fill="#ffe36a" stroke="${INK}" stroke-width="1.4"/><circle cx="60" cy="56" r="5" fill="#ffe36a" stroke="${INK}" stroke-width="1.4"/>
      <circle cx="41" cy="57" r="1.8" fill="${INK}"/><circle cx="59" cy="57" r="1.8" fill="${INK}"/>
      <path d="M38 74 Q50 82 62 74" fill="none" stroke="${INK}" stroke-width="2"/><path d="M42 74 L44 79 L46 75Z M54 75 L56 79 L58 74Z" fill="#fff" stroke="${INK}" stroke-width="1"/>
      <path d="M30 86 L70 86 L66 112 L34 112Z" fill="#8a6a45" stroke="${INK}" stroke-width="2"/>
      <path d="M78 72 L106 40 L112 46 L86 84Z" fill="#7a5532" stroke="${INK}" stroke-width="2"/>`,
    q4: `<ellipse cx="60" cy="84" rx="40" ry="32" fill="#7f7466" stroke="${INK}" stroke-width="2"/>
      <ellipse cx="60" cy="92" rx="22" ry="18" fill="#9a8d7c"/>
      <path d="M22 70 Q4 84 10 106 L26 100 Q24 88 30 80Z M98 70 Q116 84 110 106 L94 100 Q96 88 90 80Z" fill="#7f7466" stroke="${INK}" stroke-width="2"/>
      <circle cx="60" cy="40" r="20" fill="#8a7f70" stroke="${INK}" stroke-width="2"/>
      <circle cx="52" cy="38" r="3.4" fill="#ff7a3a"/><circle cx="68" cy="38" r="3.4" fill="#ff7a3a"/>
      <path d="M48 52 Q60 58 72 52" fill="none" stroke="${INK}" stroke-width="2"/><path d="M50 52 L47 62 L55 54Z M70 52 L73 62 L65 54Z" fill="#f3ecd8" stroke="${INK}" stroke-width="1.4"/>`,
    q5: `<rect x="34" y="76" width="52" height="38" rx="6" fill="#6b625c" stroke="${INK}" stroke-width="2"/>
      <rect x="26" y="40" width="68" height="40" rx="8" fill="#7a706a" stroke="${INK}" stroke-width="2"/>
      <rect x="40" y="14" width="40" height="30" rx="7" fill="#867b74" stroke="${INK}" stroke-width="2"/>
      <rect x="6" y="46" width="22" height="48" rx="7" fill="#6b625c" stroke="${INK}" stroke-width="2"/><rect x="92" y="46" width="22" height="48" rx="7" fill="#6b625c" stroke="${INK}" stroke-width="2"/>
      <path d="M44 48 L52 64 L46 76 M74 46 L68 62 L78 78 M56 84 L62 100" fill="none" stroke="#ff8a2a" stroke-width="3" stroke-linecap="round"/>
      <rect x="48" y="26" width="8" height="6" rx="2" fill="#ffb347"/><rect x="64" y="26" width="8" height="6" rx="2" fill="#ffb347"/>`,
    q6: `<path d="M60 60 L8 20 L16 62 L4 80 L40 78Z" fill="#a33a35" stroke="${INK}" stroke-width="2"/>
      <path d="M62 60 L112 18 L104 62 L116 82 L80 78Z" fill="#a33a35" stroke="${INK}" stroke-width="2"/>
      <ellipse cx="60" cy="84" rx="30" ry="28" fill="#c0463f" stroke="${INK}" stroke-width="2"/>
      <ellipse cx="60" cy="94" rx="16" ry="18" fill="#e9c27a"/>
      <path d="M40 46 L34 24 L50 38Z M80 46 L86 24 L70 38Z" fill="#efe6c8" stroke="${INK}" stroke-width="2"/>
      <ellipse cx="60" cy="48" rx="22" ry="18" fill="#c8504a" stroke="${INK}" stroke-width="2"/>
      <circle cx="51" cy="44" r="4" fill="#ffd34a"/><circle cx="69" cy="44" r="4" fill="#ffd34a"/><rect x="50" y="42" width="2" height="5" fill="${INK}"/><rect x="68" y="42" width="2" height="5" fill="${INK}"/>
      <path d="M50 56 Q60 62 70 56" fill="none" stroke="${INK}" stroke-width="2"/>`,
  };
  // name(몬스터 이름)을 주면 img/mon/ 의 그림 파일을 먼저 찾고, 없으면 기본 SVG를 쓴다 (assets.js)
  function monster(questId, cls, hue, name) {
    const A = global.Assets, known = name && A ? A.monKnown(name) : '';
    if (known) return `<img class="mon mon-img ${cls || ''}" src="${known}" alt="" style="filter:none">`;
    return `<svg class="mon ${cls || ''}" ${name && A && A.monMaybe(name) ? `data-mon="${esc(name)}" ` : ''}${hue ? `style="filter:hue-rotate(${Math.round(hue) % 360}deg) saturate(1.1)" ` : ''}viewBox="0 0 120 120" aria-hidden="true">${MONSTERS[questId] || MONSTERS.q1}</svg>`;
  }

  /* ---------- 길드 홀 배경 ---------- */
  function hall() {
    return `<div class="hall" aria-hidden="true"><div class="h-wall"></div><div class="h-arch"></div><div class="h-board"></div>
      <div class="h-lamp l1"></div><div class="h-lamp l2"></div><div class="h-counter"></div><div class="h-floor"></div><div class="h-rug"></div></div>`;
  }


  /* ---------- 장비·재료 아이콘 ----------
     그림 파일을 넣으면 그 그림이 우선 보이고, 파일이 없으면 아래 기본 도형이 보인다.
       장비: img/gear/{부위}_{종류번호}.png   (부위: weapon · armor · acc, 종류번호 0~7)
       재료: img/mat/{재료 이름}.png          (이름의 공백은 _ 로) */
  const GRADE_COL = ['#8a93a6', '#4fae7c', '#4a90d9', '#9a62d8', '#e0913a', '#e0584a', '#f0c050'];
  const GLYPH = {
    dagger: '<path d="M16 4l3 14h-6z"/><path d="M11 18h10M16 18v8" /><circle cx="16" cy="27" r="1.6"/>',
    sword: '<path d="M16 3l3.2 17h-6.4z"/><path d="M9 20h14M16 20v7"/><circle cx="16" cy="28" r="1.8"/>',
    bow: '<path d="M9 4c10 3 10 21 0 24"/><path d="M9 4v24M9 16h15m-4-3l4 3-4 3"/>',
    staff: '<path d="M20 5l-9 22"/><circle cx="21" cy="7" r="4"/><path d="M19 9l-2 5" />',
    armor: '<path d="M8 8l5-3h6l5 3-2 7-2-1v13H12V14l-2 1z"/><path d="M13 5c1 3 5 3 6 0"/>',
    robe: '<path d="M12 5h8l3 8-3 1 3 14H9l3-14-3-1z"/><path d="M14 5l2 5 2-5"/>',
    ring: '<circle cx="16" cy="19" r="7"/><path d="M13 9l3-4 3 4-3 3z"/>',
    amulet: '<path d="M8 6c0 10 4 10 8 14 4-4 8-4 8-14"/><path d="M16 20l3 4-3 4-3-4z"/>',
    charm: '<path d="M10 4h12v4l-3 2v4l4 2v10H9V16l4-2v-4l-3-2z"/><path d="M16 17v6M13 20h6"/>',
    hide: '<path d="M7 9l5-3 4 2 4-2 5 3-2 6 2 8-6 2-3-3-3 3-6-2 2-8z"/>',
    fang: '<path d="M10 6c0 8 2 14 6 21 4-7 6-13 6-21-3 2-9 2-12 0z"/>',
    bone: '<path d="M9 8a3 3 0 1 1 3-3l8 10a3 3 0 1 1 3 3 3 3 0 1 1-3 3l-8-10a3 3 0 1 1-3-3z"/>',
    scale: '<path d="M16 4l8 5v9c0 5-4 8-8 10-4-2-8-5-8-10V9z"/><path d="M12 12h8M11 17h10M13 22h6"/>',
    eye: '<path d="M3 16c4-7 22-7 26 0-4 7-22 7-26 0z"/><circle cx="16" cy="16" r="4"/>',
    wing: '<path d="M5 22c2-10 10-16 22-17-2 6-5 9-9 11l6 2c-6 6-14 7-19 4z"/>',
    drop: '<path d="M16 4c5 7 8 11 8 16a8 8 0 0 1-16 0c0-5 3-9 8-16z"/>',
    gem: '<path d="M8 12l4-6h8l4 6-8 15z"/><path d="M8 12h16M12 6l4 21M20 6l-4 21"/>',
    leaf: '<path d="M6 26C6 12 14 6 27 5c0 13-6 21-19 21z"/><path d="M6 26L20 12"/>',
  };
  const gearGlyph = (slot, n) => (slot === 'weapon' ? (/단검|쾌검/.test(n) ? 'dagger' : /활/.test(n) ? 'bow' : /지팡이/.test(n) ? 'staff' : 'sword')
    : slot === 'armor' ? (/로브/.test(n) ? 'robe' : 'armor') : (/반지|귀걸이|팔찌/.test(n) ? 'ring' : /목걸이/.test(n) ? 'amulet' : 'charm'));
  const matGlyph = (name) => { const w = name.split(' ').pop(); return /가죽|모피|털|허물|껍질/.test(w) ? 'hide' : /뿔|엄니|이빨|발톱|가시|침|송곳니/.test(w) ? 'fang' : /뼈|해골/.test(w) ? 'bone' : /비늘|갑각|방패/.test(w) ? 'scale' : /눈|안구/.test(w) ? 'eye' : /날개|깃털/.test(w) ? 'wing' : /피|즙|독|점액|진액|액/.test(w) ? 'drop' : /뿌리|잎|풀|버섯|열매|꽃|이끼|줄기|씨앗|약초|가지/.test(w) ? 'leaf' : 'gem'; };
  function iconBox(glyph, grade, img, cls) {
    const c = GRADE_COL[Math.max(0, Math.min(6, grade))];
    return `<span class="gicon ${cls || ''}" style="--gc:${c}"><svg viewBox="0 0 32 32" aria-hidden="true" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${GLYPH[glyph] || GLYPH.gem}</svg>${global.Assets ? global.Assets.imgTag('gi-img', [img]) : ''}</span>`;
  }
  const gearIcon = (slot, grade, typeIdx, typeName, cls) => iconBox(gearGlyph(slot, typeName || ''), grade, `img/gear/${slot}_${typeIdx}.png`, cls);
  const matIcon = (name, grade, cls) => iconBox(matGlyph(name), grade, `img/mat/${String(name).replace(/ /g, '_')}.png`, cls);
  global.Art = { gearIcon, matIcon, icon, compass, character, monster, hall, esc };
})(window);
