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
  let uid = 0;
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

  /* ---------- 캐릭터 (모험가 화풍: 5.5등신 · 가는 외곽선 · 채도 낮은 색 · 장비가 보이는 차림) ----------
     외형 9개 값이 모두 그림에 드러난다:
       성별(체형·얼굴선·속눈썹) · 종족20(귀·뿔·꼬리·날개·피부색·얼굴 무늬) · 피부20(밝기)
       눈50(모양5 × 눈썹5 × 반짝임2, 크기는 눈·눈색 값으로 다양) · 헤어100(실루엣10 × 앞머리5 × 헤어 장식2)
       눈색500·헤어색500(색상50 × 명도10) · 옷100(복장10 × 팔레트10, 복장마다 머리 장비·배낭이 다름)
       장식100(들고 있는 물건/얼굴 소품10 × 색10)
     어울리지 않는 조합이 생기지 않도록 규칙으로 막는다(머리 장비와 머리 모양, 동물 귀, 소품 위치 등). 검증: test/char-check.js */
  const RACES = [
    {}, { ears: 'long' }, { mark: 'freckle' }, { ears: 'small', mark: 'blushy' }, { skin: [200, 26, 52], mark: 'rune' },
    { ears: 'fox', tail: 'fox' }, { skin: [8, 30, 46], horn: 'one', fang: 1 }, { beard: 1, mark: 'brow' }, { mark: 'scar' }, { skin: [330, 24, 74], wings: 1, ears: 'small' },
    { mark: 'paint' }, { ears: 'cat', tail: 'cat' }, { mark: 'brow', big: 1 }, { ears: 'long', skin: [268, 14, 40] }, { skin: [105, 22, 50], leaf: 1, ears: 'small' },
    { mark: 'mole' }, { ears: 'half' }, { ears: 'wolf', tail: 'wolf', fang: 1 }, { mark: 'stubble' }, { skin: [186, 28, 56], ears: 'fin' },
  ];
  // 머리 장비가 정수리를 덮는 복장: 기사(투구) · 마법사(뾰족모자) · 도적(후드) · 음유시인(베레) · 광부(안전모)
  const HAT_OUTFITS = [0, 1, 3, 6, 9];
  const HAT_FRINGE = { 0: false, 1: true, 3: true, 6: true, 9: false };   // 모자 아래로 앞머리가 보이는가

  function look(a) {
    const R = RACES[a.race % 20];
    const hue50 = (n) => (n % 50) * 7.2, tier = (n) => Math.floor(n / 50);
    let skinH = 22 + (a.skin % 5) * 3, skinS = 34 + (a.skin % 4) * 2, skinL = 38 + a.skin * 2.1;
    if (R.skin) { skinH = R.skin[0]; skinS = R.skin[1]; skinL = R.skin[2] + a.skin * 1.2; }
    const hT = tier(a.hairColor), hH = hue50(a.hairColor), hS = 13 + hT * 2.6, hL = 20 + hT * 4.4;
    const eT = tier(a.eyeColor), eH = hue50(a.eyeColor);
    const ot = a.clothes % 10, pal = Math.floor(a.clothes / 10);
    const ch = (pal * 36 + ot * 13) % 360;
    const at = a.accessory % 10, tint = Math.floor(a.accessory / 10) * 36;
    return {
      R, ot, at,
      skin: hsl(skinH, skinS, skinL), skinDk: hsl(skinH - 5, skinS + 5, skinL - 13), skinLn: hsl(skinH - 8, skinS + 8, skinL - 30),
      hair: hsl(hH, hS, hL), hairDk: hsl(hH + 5, hS + 4, hL - 9), hairHi: hsl(hH, hS - 6, hL + 14),
      iris: hsl(eH, 38 + eT * 2, 34 + eT * 2.4), irisDk: hsl(eH, 40 + eT * 2, 20 + eT),
      main: hsl(ch, 24 + (pal % 3) * 4, 36 + (pal % 2) * 6), mainDk: hsl(ch, 26 + (pal % 3) * 4, 25 + (pal % 2) * 4),
      sec: hsl(ch + 40, 20, 33), secDk: hsl(ch + 40, 22, 22),
      trim: hsl(ch + 180, 30, 60), leather: hsl(28, 30, 28 + (pal % 3) * 4), leatherDk: hsl(26, 32, 17 + (pal % 3) * 3),
      cream: hsl(40, 24, 76), creamDk: hsl(38, 24, 58),
      gem: hsl(tint, 42, 52), gemDk: hsl(tint, 44, 32),
    };
  }

  const MET = '#a7afb9', MET_DK = '#6b7480', MET_HI = '#d5dbe2', WOOD = '#7d5a3a', WOOD_DK = '#52391f', GOLD = '#c9a85a', GOLD_DK = '#8a6e30', LN = '#2a2019';

  function character(a, opts) {
    opts = opts || {};
    const L = look(a), R = L.R, ot = L.ot, at = L.at, fem = a.gender === 1;
    const id = 'g' + (++uid);
    const o = `stroke="${LN}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"`;
    const cel = (n, c1, c2, st, x1, y1, x2, y2) => `<linearGradient id="${id}${n}" x1="${x1 === undefined ? .08 : x1}" y1="${y1 === undefined ? 0 : y1}" x2="${x2 === undefined ? .92 : x2}" y2="${y2 === undefined ? .25 : y2}"><stop offset="0" stop-color="${c1}"/><stop offset="${st || .62}" stop-color="${c1}"/><stop offset="${st || .62}" stop-color="${c2}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
    const defs = `<defs>${cel('s', L.skin, L.skinDk, .68)}${cel('h', L.hair, L.hairDk, .6)}${cel('m', L.main, L.mainDk)}${cel('c', L.sec, L.secDk)}${cel('l', L.leather, L.leatherDk)}${cel('r', L.cream, L.creamDk)}${cel('t', MET, MET_DK, .58)}${cel('g', GOLD, GOLD_DK, .55)}${cel('w', WOOD, WOOD_DK, .55)}${cel('x', L.gem, L.gemDk, .55)}</defs>`;
    const F = (k) => `url(#${id}${k})`;
    const P = (d, fill, extra) => `<path d="${d}" fill="${fill}" ${o} ${extra || ''}/>`;
    const hatted = HAT_OUTFITS.includes(ot), topOk = !hatted;

    /* ----- 체형 ----- */
    const sw = (fem ? 15.500 : 19) + (R.big ? 2 : 0), ww = fem ? 10 : 12, hw = fem ? 13 : 13.500;
    const X = (dx) => 50 + dx;                      // 중심 기준 x
    const ys = 55, yw = 90, yh = 104;               // 어깨·허리·골반 높이
    const T = (skirt) => `M${X(-sw)} ${ys} Q50 ${ys - 5} ${X(sw)} ${ys} L${X(ww + 1)} ${yw} L${X(hw)} ${yh + (skirt || 0)} L${X(-hw)} ${yh + (skirt || 0)} L${X(-ww - 1)} ${yw}Z`;

    /* ----- 복장별 구성 ----- */
    let back = '', pants = F('c'), boot = F('l'), bootHi = '', long = 0, skirt = 0, torso = '', over = '', sleeve = F('m'), cuff = '', bare = false, hat = '', gloves = '', front = '';
    const belt = (y) => `<path d="M${X(-ww - 1.500)} ${y} H${X(ww + 1.500)} V${y + 4.500} H${X(-ww - 1.500)}Z" fill="${F('l')}" ${o}/><rect x="47.500" y="${y - .5}" width="5" height="5.500" rx="1" fill="${F('g')}" ${o}/>`;
    const pouch = (x, y) => `<path d="M${x} ${y} h7 v7 q-3.500 2 -7 0z" fill="${F('l')}" ${o}/><path d="M${x} ${y + 2} h7" stroke="${LN}" stroke-width=".8"/>`;
    const backpack = (w) => `<path d="M${X(-sw - 5)} ${ys - 2} Q${X(-sw - 8)} 82 ${X(-sw - 3)} 112 H${X(sw + 3)} Q${X(sw + 8)} 82 ${X(sw + 5)} ${ys - 2}Z" fill="${F('l')}" ${o}/><rect x="${X(-sw - 9)}" y="${ys - 8}" width="${2 * sw + 18}" height="9" rx="4.500" fill="${F('r')}" ${o}/><path d="M${X(-sw - 4)} ${ys - 5} v5 M${X(sw + 4)} ${ys - 5} v5" stroke="${LN}" stroke-width="1"/><path d="M${X(-sw - 2)} 96 h${2 * sw + 4}" stroke="${LN}" stroke-width="1" opacity=".6"/>`;
    const strap = `<path d="M${X(-sw + 3)} ${ys + 1} L${X(-ww + 1)} 98 M${X(sw - 3)} ${ys + 1} L${X(ww - 1)} 98" stroke="${L.leatherDk}" stroke-width="3" fill="none"/>`;
    if (ot === 0) { // 기사: 사슬+판금, 투구, 배낭 두루마리
      back = backpack();
      pants = F('c'); boot = F('t'); bootHi = 1;
      torso = P(T(5), F('t')) + `<path d="M${X(-ww)} 88 H${X(ww)} L${X(hw)} 108 H${X(-hw)}Z" fill="${F('c')}" ${o}/><path d="M${X(-ww + 1)} 62 Q50 70 ${X(ww - 1)} 62 L${X(ww)} 88 Q50 92 ${X(-ww)} 88Z" fill="${F('t')}" ${o}/><path d="M50 62 V88" stroke="${LN}" stroke-width="1" opacity=".7"/><path d="M${X(-ww + 2)} 70 Q50 75 ${X(ww - 2)} 70" fill="none" stroke="${MET_HI}" stroke-width="1" opacity=".8"/>`;
      over = belt(88) + `<ellipse cx="${X(-sw)}" cy="${ys + 3}" rx="7.500" ry="5.500" fill="${F('t')}" ${o}/><ellipse cx="${X(sw)}" cy="${ys + 3}" rx="7.500" ry="5.500" fill="${F('t')}" ${o}/>`;
      sleeve = F('c'); cuff = F('t'); gloves = F('t');
    } else if (ot === 1) { // 마법사: 긴 로브
      long = 1; boot = F('l');
      torso = P(`M${X(-sw)} ${ys} Q50 ${ys - 5} ${X(sw)} ${ys} L${X(ww + 1)} ${yw} L${X(hw + 8)} 156 Q50 162 ${X(-hw - 8)} 156 L${X(-ww - 1)} ${yw}Z`, F('m')) + `<path d="M50 ${ys + 2} V158" stroke="${LN}" stroke-width="1" opacity=".6"/><path d="M${X(-hw - 8)} 150 Q50 156 ${X(hw + 8)} 150" fill="none" stroke="${F('g')}" stroke-width="2.600"/>`;
      over = belt(88) + `<path d="M${X(-sw + 2)} ${ys + 1} Q50 ${ys + 8} ${X(sw - 2)} ${ys + 1} L${X(sw - 4)} ${ys + 6} Q50 ${ys + 14} ${X(-sw + 4)} ${ys + 6}Z" fill="${F('r')}" ${o}/><path d="M50 98 l2 4 4.500 .6 -3.300 3.100 .8 4.500 -4 -2.100 -4 2.100 .8 -4.500 -3.300 -3.100 4.500 -.6z" fill="${F('g')}" stroke="${LN}" stroke-width=".8"/>`;
      sleeve = F('m'); cuff = F('r');
    } else if (ot === 2) { // 레인저: 망토 + 배낭
      back = `<path d="M${X(-sw - 2)} ${ys} L${X(-sw - 9)} 126 Q50 134 ${X(sw + 9)} 126 L${X(sw + 2)} ${ys}Z" fill="${F('c')}" ${o}/>` + backpack();
      pants = F('l'); boot = F('l');
      torso = P(T(0), F('m')) + `<path d="M${X(-ww)} 66 H${X(ww)} V70 H${X(-ww)}Z" fill="${F('l')}" opacity="0"/>`;
      over = belt(88) + pouch(X(-hw - 2), 94) + `<path d="M${X(-sw + 2)} ${ys + 1} Q50 ${ys + 12} ${X(sw - 2)} ${ys + 1} L${X(sw - 1)} ${ys + 9} Q50 ${ys + 20} ${X(-sw + 1)} ${ys + 9}Z" fill="${F('c')}" ${o}/>` + strap;
      sleeve = F('m'); cuff = F('l'); gloves = F('l');
    } else if (ot === 3) { // 도적: 어두운 조끼 + 크로스 벨트 + 후드(올림)
      back = `<path d="M${X(-sw - 1)} ${ys} L${X(-sw - 5)} 112 Q50 120 ${X(sw + 5)} 112 L${X(sw + 1)} ${ys}Z" fill="${F('c')}" ${o}/>`;
      pants = F('c'); boot = F('l');
      torso = P(T(2), F('c')) + `<path d="M${X(-sw + 2)} ${ys + 2} L50 ${ys + 12} L${X(sw - 2)} ${ys + 2} L${X(ww)} ${yw} H${X(-ww)}Z" fill="${F('l')}" ${o}/>`;
      over = belt(88) + `<path d="M${X(-sw + 3)} ${ys + 4} L${X(ww - 1)} 94 M${X(sw - 3)} ${ys + 4} L${X(-ww + 1)} 94" stroke="${LN}" stroke-width="3.400" fill="none"/><path d="M${X(-sw + 3)} ${ys + 4} L${X(ww - 1)} 94 M${X(sw - 3)} ${ys + 4} L${X(-ww + 1)} 94" stroke="${L.leather}" stroke-width="1.800" fill="none"/>` + pouch(X(hw - 4), 96);
      sleeve = F('c'); cuff = F('l'); gloves = F('l');
    } else if (ot === 4) { // 성직자: 연한 로브 + 띠 + 성표
      long = 1; boot = F('l'); skirt = 0;
      torso = P(`M${X(-sw)} ${ys} Q50 ${ys - 5} ${X(sw)} ${ys} L${X(ww + 1)} ${yw} L${X(hw + 5)} 138 Q50 144 ${X(-hw - 5)} 138 L${X(-ww - 1)} ${yw}Z`, F('r')) + `<path d="M50 ${ys + 4} V132" stroke="${LN}" stroke-width="1" opacity=".5"/><path d="M${X(-hw - 5)} 132 Q50 138 ${X(hw + 5)} 132" fill="none" stroke="${L.main}" stroke-width="3"/>`;
      over = `<path d="M${X(-ww - 1)} 88 H${X(ww + 1)} V94 H${X(-ww - 1)}Z" fill="${F('m')}" ${o}/><path d="M${X(ww - 3)} 94 v22 l-2.500 -3 l-2.500 3 v-22" fill="${F('m')}" ${o}/><path d="M50 ${ys + 6} v11 M46 ${ys + 10} h8" stroke="${GOLD}" stroke-width="2.200" stroke-linecap="round"/><path d="M${X(-sw + 2)} ${ys + 1} Q50 ${ys + 7} ${X(sw - 2)} ${ys + 1}" fill="none" stroke="${F('m')}" stroke-width="3"/>`;
      sleeve = F('r'); cuff = F('m');
    } else if (ot === 5) { // 여행자: 튜닉 + 앞치마 + 배낭
      back = backpack();
      pants = F('c'); boot = F('l');
      torso = P(T(4), F('m')) + `<path d="M${X(-ww + 1)} 74 H${X(ww - 1)} L${X(ww + 2)} 112 H${X(-ww - 2)}Z" fill="${F('r')}" ${o}/>`;
      over = belt(88) + `<path d="M${X(-sw + 4)} ${ys + 2} L${X(-ww + 1)} 74 M${X(sw - 4)} ${ys + 2} L${X(ww - 1)} 74" stroke="${LN}" stroke-width="3" fill="none"/><path d="M${X(-sw + 4)} ${ys + 2} L${X(-ww + 1)} 74 M${X(sw - 4)} ${ys + 2} L${X(ww - 1)} 74" stroke="${L.leather}" stroke-width="1.600" fill="none"/>` + `<path d="M${X(-9)} ${ys - 1} Q50 ${ys + 9} ${X(9)} ${ys - 1} L${X(8)} ${ys + 4} Q50 ${ys + 13} ${X(-8)} ${ys + 4}Z" fill="${F('r')}" ${o}/>`;
      sleeve = F('m'); cuff = F('r');
    } else if (ot === 6) { // 음유시인: 더블릿 + 한쪽 망토 + 베레
      back = `<path d="M${X(sw - 2)} ${ys} Q${X(sw + 10)} 90 ${X(sw + 4)} 120 L${X(sw - 14)} 110 Z" fill="${F('c')}" ${o}/>`;
      pants = F('l'); boot = F('l');
      torso = P(T(5), F('m')) + `<path d="M${X(-ww + 1)} 64 L50 98 L${X(ww - 1)} 64" fill="none" stroke="${F('g')}" stroke-width="1.600"/>`;
      over = belt(88) + `<g fill="${F('g')}" stroke="${LN}" stroke-width=".8"><circle cx="50" cy="70" r="1.600"/><circle cx="50" cy="77" r="1.600"/><circle cx="50" cy="84" r="1.600"/></g><path d="M${X(-sw + 2)} ${ys + 1} Q50 ${ys + 8} ${X(sw - 2)} ${ys + 1}" fill="none" stroke="${F('r')}" stroke-width="3.200"/>`;
      sleeve = F('m'); cuff = F('r');
    } else if (ot === 7) { // 전사: 가죽 하네스 + 맨팔 + 모피 어깨
      pants = F('l'); boot = F('l'); bare = true; gloves = F('l');
      torso = P(T(0), F('s')) + `<path d="M${X(-sw + 3)} ${ys + 1} L${X(ww - 2)} 92 M${X(sw - 3)} ${ys + 1} L${X(-ww + 2)} 92" stroke="${LN}" stroke-width="4.400" fill="none"/><path d="M${X(-sw + 3)} ${ys + 1} L${X(ww - 2)} 92 M${X(sw - 3)} ${ys + 1} L${X(-ww + 2)} 92" stroke="${L.leather}" stroke-width="2.600" fill="none"/>`;
      over = belt(88) + `<path d="M${X(-sw - 3)} ${ys + 2} Q${X(-sw)} ${ys - 6} ${X(-sw + 8)} ${ys - 2} L${X(-sw + 6)} ${ys + 10} Q${X(-sw)} ${ys + 14} ${X(-sw - 3)} ${ys + 2}Z" fill="${F('r')}" ${o}/>` + `<circle cx="50" cy="73" r="2.400" fill="${F('g')}" ${o}/>`;
      sleeve = F('s'); cuff = F('t');
    } else if (ot === 8) { // 귀족: 긴 코트 + 장식 단추 + 칼라
      long = 0; pants = F('c'); boot = F('l');
      torso = P(`M${X(-sw)} ${ys} Q50 ${ys - 5} ${X(sw)} ${ys} L${X(ww + 1)} ${yw} L${X(hw + 6)} 130 Q50 135 ${X(-hw - 6)} 130 L${X(-ww - 1)} ${yw}Z`, F('m')) + `<path d="M50 ${ys + 4} V140" stroke="${LN}" stroke-width="1" opacity=".6"/><path d="M${X(-hw - 6)} 124 Q50 130 ${X(hw + 6)} 124" fill="none" stroke="${F('g')}" stroke-width="2"/>`;
      over = belt(88) + `<g fill="${F('g')}" stroke="${LN}" stroke-width=".8"><circle cx="48" cy="66" r="1.500"/><circle cx="48" cy="74" r="1.500"/><circle cx="48" cy="82" r="1.500"/></g><path d="M${X(-9)} ${ys - 2} L50 ${ys + 12} L${X(9)} ${ys - 2} L${X(8)} ${ys - 6} Q50 ${ys + 3} ${X(-8)} ${ys - 6}Z" fill="${F('r')}" ${o}/>`;
      sleeve = F('m'); cuff = F('g');
    } else { // 광부: 셔츠 + 멜빵바지 + 배낭 + 안전모
      back = backpack();
      pants = F('c'); boot = F('l'); gloves = F('l');
      torso = P(T(2), F('r')) + `<path d="M${X(-ww - 1)} 74 H${X(ww + 1)} L${X(hw)} 108 H${X(-hw)}Z" fill="${F('c')}" ${o}/>`;
      over = `<path d="M${X(-sw + 4)} ${ys + 1} L${X(-ww)} 74 M${X(sw - 4)} ${ys + 1} L${X(ww)} 74" stroke="${LN}" stroke-width="3.600" fill="none"/><path d="M${X(-sw + 4)} ${ys + 1} L${X(-ww)} 74 M${X(sw - 4)} ${ys + 1} L${X(ww)} 74" stroke="${F('c')}" stroke-width="2" fill="none"/><rect x="45" y="78" width="10" height="7" rx="1" fill="${F('l')}" ${o}/><circle cx="${X(-ww)}" cy="74" r="1.700" fill="${F('g')}"/><circle cx="${X(ww)}" cy="74" r="1.700" fill="${F('g')}"/>`;
      sleeve = F('r'); cuff = F('l');
    }

    /* ----- 다리·신발 ----- */
    let legs = '';
    if (!long) legs = `<path d="M${X(-hw)} ${yh - 2} L${X(-1)} ${yh - 2} L${X(-3)} 150 H${X(-hw + 3)}Z" fill="${pants}" ${o}/><path d="M${X(hw)} ${yh - 2} L${X(1)} ${yh - 2} L${X(3)} 150 H${X(hw - 3)}Z" fill="${pants}" ${o}/>`;
    const boots = `<path d="M${X(-hw + 2)} 146 H${X(-2.500)} L${X(-2)} 162 Q${X(-2)} 169 ${X(-7)} 169 H${X(-hw - 3)} Q${X(-hw - 3)} 163 ${X(-hw + 2)} 160Z" fill="${boot}" ${o}/><path d="M${X(hw - 2)} 146 H${X(2.500)} L${X(2)} 162 Q${X(2)} 169 ${X(7)} 169 H${X(hw + 3)} Q${X(hw + 3)} 163 ${X(hw - 2)} 160Z" fill="${boot}" ${o}/><path d="M${X(-hw + 2)} 150 H${X(-2.500)} M${X(hw - 2)} 150 H${X(2.500)}" stroke="${bootHi ? MET_HI : L.leatherDk}" stroke-width="1.800"/>`;

    /* ----- 팔·손 ----- */
    const armL = `M${X(-sw)} ${ys} L${X(-sw - 5)} 80 L${X(-sw - 4)} 99 L${X(-sw + 3.500)} 99 L${X(-sw + 4)} 82 L${X(-sw + 4)} ${ys + 3}Z`;
    const armR = `M${X(sw)} ${ys} L${X(sw + 5)} 80 L${X(sw + 4)} 99 L${X(sw - 3.500)} 99 L${X(sw - 4)} 82 L${X(sw - 4)} ${ys + 3}Z`;
    const armFill = (long && ot === 1) ? F('m') : sleeve;
    let arms = `<path d="${armL}" fill="${armFill}" ${o}/><path d="${armR}" fill="${armFill}" ${o}/>`;
    if (!bare) arms += `<path d="M${X(-sw - 4.500)} 94 H${X(-sw + 3.800)} V99 H${X(-sw - 4.500)}Z" fill="${cuff || sleeve}" ${o}/><path d="M${X(sw + 4.500)} 94 H${X(sw - 3.800)} V99 H${X(sw + 4.500)}Z" fill="${cuff || sleeve}" ${o}/>`;
    else arms += `<path d="M${X(-sw - 4.500)} 90 H${X(-sw + 3.800)} V99 H${X(-sw - 4.500)}Z" fill="${F('t')}" ${o}/><path d="M${X(sw + 4.500)} 90 H${X(sw - 3.800)} V99 H${X(sw + 4.500)}Z" fill="${F('t')}" ${o}/>`;
    const handFill = gloves || F('s');
    const hands = `<ellipse cx="${X(-sw - .5)}" cy="103" rx="4" ry="4.500" fill="${handFill}" ${o}/><ellipse cx="${X(sw + .5)}" cy="103" rx="4" ry="4.500" fill="${handFill}" ${o}/>`;

    /* ----- 머리·얼굴 ----- */
    const headP = fem ? `M36.500 28 Q36 13 50 13 Q64 13 63.500 28 Q63.500 36 61.500 40 Q57.500 49 50 50 Q42.500 49 38.500 40 Q36.500 36 36.500 28Z` : `M36 28 Q35.500 13 50 13 Q64.500 13 64 28 Q64 37 62.500 41 Q58.500 50 50 51 Q41.500 50 37.500 41 Q36 37 36 28Z`;
    const neck = `<path d="M45.500 44 H54.500 V ${ys + 1} Q50 ${ys + 5} 45.500 ${ys + 1}Z" fill="${F('s')}" ${o}/><path d="M45.500 47 Q50 52 54.500 47 V50 Q50 55 45.500 50Z" fill="#000" opacity=".16"/>`;
    const head = `<path d="${headP}" fill="${F('s')}" ${o}/>`;
    // 귀
    let ears = `<ellipse cx="36" cy="32" rx="2.400" ry="4" fill="${F('s')}" ${o}/><ellipse cx="64" cy="32" rx="2.400" ry="4" fill="${F('s')}" ${o}/>`;
    if (R.ears === 'long') ears = `<path d="M36.500 29 L23 24 L36.500 36Z" fill="${F('s')}" ${o}/><path d="M63.500 29 L77 24 L63.500 36Z" fill="${F('s')}" ${o}/>`;
    else if (R.ears === 'half') ears = `<path d="M36.500 29 L28 26 L36.500 35Z" fill="${F('s')}" ${o}/><path d="M63.500 29 L72 26 L63.500 35Z" fill="${F('s')}" ${o}/>`;
    else if (R.ears === 'small') ears = `<path d="M36.500 29 L31 27 L36.500 35Z" fill="${F('s')}" ${o}/><path d="M63.500 29 L69 27 L63.500 35Z" fill="${F('s')}" ${o}/>`;
    else if (R.ears === 'fin') ears = `<path d="M36.500 26 Q26 22 27 36 Q32 34 36.500 36Z" fill="#7fb8c0" ${o}/><path d="M63.500 26 Q74 22 73 36 Q68 34 63.500 36Z" fill="#7fb8c0" ${o}/>`;
    else if (R.ears) ears = `<ellipse cx="36" cy="33" rx="2" ry="3" fill="${F('s')}" ${o}/><ellipse cx="64" cy="33" rx="2" ry="3" fill="${F('s')}" ${o}/>`;

    // 눈: 모양5 × 눈썹5 × 반짝임2, 크기 0.85~1.3
    const sh = a.eye % 5, vr = Math.floor(a.eye / 5), brow = vr % 5, spark = vr >= 5;
    const es = 0.85 + ((a.eye * 7 + a.eyeColor) % 6) * 0.09;
    const closed = sh === 2 || sh === 3;
    const eye = (cx, sg) => {
      let e = '';
      if (sh === 0) e = `<path d="M${cx - 3.800} 31 Q${cx} 26.500 ${cx + 3.800} 31 Q${cx} 35 ${cx - 3.800} 31Z" fill="#f4efe6" stroke="${LN}" stroke-width="1"/><circle cx="${cx}" cy="31" r="2.700" fill="${L.iris}"/><circle cx="${cx}" cy="31" r="1.300" fill="${LN}"/><circle cx="${cx - .9}" cy="30" r=".8" fill="#fff"/><path d="M${cx - 4.200} 30.500 Q${cx} 26 ${cx + 4.200} 30.500" fill="none" stroke="${LN}" stroke-width="1.500" stroke-linecap="round"/>`;
      else if (sh === 1) e = `<path d="M${cx - 4.500} 31.500 Q${cx} 26 ${cx + 4.500} 31.500 Q${cx} 35.500 ${cx - 4.500} 31.500Z" fill="#f4efe6" stroke="${LN}" stroke-width="1"/><ellipse cx="${cx}" cy="31.300" rx="3" ry="3.400" fill="${L.iris}"/><ellipse cx="${cx}" cy="31.700" rx="1.400" ry="1.800" fill="${LN}"/><circle cx="${cx - 1}" cy="30.200" r=".9" fill="#fff"/><path d="M${cx - 4.800} 31 Q${cx} 25 ${cx + 4.800} 31" fill="none" stroke="${LN}" stroke-width="1.700" stroke-linecap="round"/>`;
      else if (sh === 2) e = `<path d="M${cx - 4} 32.500 Q${cx} 27.500 ${cx + 4} 32.500" fill="none" stroke="${LN}" stroke-width="1.700" stroke-linecap="round"/>`;
      else if (sh === 3) e = `<path d="M${cx - 4} 30 Q${cx} 34.500 ${cx + 4} 30" fill="none" stroke="${LN}" stroke-width="1.700" stroke-linecap="round"/>`;
      else e = `<path d="M${cx - sg * 4.500} 33 Q${cx} 28.500 ${cx + sg * 4.800} 28.800 Q${cx + sg * 1.500} 34.500 ${cx - sg * 4.500} 33Z" fill="#f4efe6" stroke="${LN}" stroke-width="1"/><ellipse cx="${cx + sg * .2}" cy="31.300" rx="2.200" ry="2.600" fill="${L.iris}"/><circle cx="${cx + sg * .2}" cy="31.500" r="1.100" fill="${LN}"/><circle cx="${cx - sg * .8}" cy="30.400" r=".7" fill="#fff"/><path d="M${cx - sg * 4.600} 33 Q${cx} 28 ${cx + sg * 5} 28.500" fill="none" stroke="${LN}" stroke-width="1.700" stroke-linecap="round"/>`;
      if (spark && closed) e += `<path d="M${cx - sg * 6} 35.500 h3.600 M${cx - sg * 6.500} 37.500 h3.600" stroke="#c4686e" stroke-width="1" stroke-linecap="round" opacity=".7"/>`;
      if (spark && !closed) e += `<path d="M${cx + sg * 4.800} 25.500 l.5 1.200 1.200 .5 -1.200 .5 -.5 1.200 -.5 -1.200 -1.200 -.5 1.200 -.5z" fill="#f3e6b0"/>`;
      if (fem) e += `<path d="M${cx + sg * 4} ${closed ? 31.500 : 30} l${sg * 2.200} -1.600" stroke="${LN}" stroke-width="1.100" stroke-linecap="round"/>`;
      return `<g transform="translate(${cx} 31) scale(${es.toFixed(2)}) translate(${-cx} -31)">${e}</g>`;
    };
    const by = 25.500 - (es - 1) * 3;
    const browC = L.hairDk;
    const brows = brow === 0 ? '' : [43.500, 56.500].map((cx, i) => { const sg = i ? 1 : -1; const w = brow === 4 ? 2.200 : 1.300;
      return brow === 1 ? `<path d="M${cx - 4} ${by} Q${cx} ${by - 1.200} ${cx + 4} ${by}" fill="none" stroke="${browC}" stroke-width="${w}" stroke-linecap="round"/>`
        : brow === 2 ? `<path d="M${cx - 4} ${by + (sg < 0 ? -1.800 : 1)} L${cx + 4} ${by + (sg < 0 ? 1 : -1.800)}" fill="none" stroke="${browC}" stroke-width="${w}" stroke-linecap="round"/>`
        : brow === 3 ? `<path d="M${cx - 4} ${by + (sg < 0 ? 1 : -1.500)} L${cx + 4} ${by + (sg < 0 ? -1.500 : 1)}" fill="none" stroke="${browC}" stroke-width="${w}" stroke-linecap="round"/>`
        : `<path d="M${cx - 4.200} ${by} H${cx + 4.200}" fill="none" stroke="${browC}" stroke-width="${w}" stroke-linecap="round"/>`; }).join('');
    const mv = (a.eye + a.gender + a.race) % 3;
    let mouth = mv === 0 ? `<path d="M46.500 42.500 Q50 45 53.500 42.500" fill="none" stroke="${L.skinLn}" stroke-width="1.300" stroke-linecap="round"/>`
      : mv === 1 ? `<path d="M46.500 42 Q50 47 53.500 42Z" fill="#6e2f33" stroke="${LN}" stroke-width="1"/>`
      : `<path d="M46.500 43 H53.500" stroke="${L.skinLn}" stroke-width="1.300" stroke-linecap="round"/>`;
    if (fem) mouth += `<path d="M47.500 43.300 Q50 44.700 52.500 43.300" fill="none" stroke="#a0585e" stroke-width=".9" opacity=".7"/>`;
    if (R.fang) mouth += `<path d="M47.200 42.400 l.9 2 .9 -2Z M51.900 42.400 l.9 2 .9 -2Z" fill="#fff" stroke="${LN}" stroke-width=".6"/>`;
    const nose = `<path d="M49.200 37 Q50.800 38.800 52 37.200" fill="none" stroke="${L.skinLn}" stroke-width="1" stroke-linecap="round"/>`;
    let marks = `<ellipse cx="41.500" cy="37" rx="3" ry="1.700" fill="#c4686e" opacity="${R.mark === 'blushy' ? .45 : .2}"/><ellipse cx="58.500" cy="37" rx="3" ry="1.700" fill="#c4686e" opacity="${R.mark === 'blushy' ? .45 : .2}"/>`;
    if (R.mark === 'freckle') marks += `<g fill="#7a4a30" opacity=".6"><circle cx="40.500" cy="36" r=".6"/><circle cx="43" cy="37.500" r=".6"/><circle cx="41" cy="39" r=".6"/><circle cx="59.500" cy="36" r=".6"/><circle cx="57" cy="37.500" r=".6"/><circle cx="59" cy="39" r=".6"/></g>`;
    if (R.mark === 'scar') marks += `<path d="M39 29 L44 40 M40 34 l2.400 -1.500 M41.500 37.500 l2.400 -1.500" stroke="#8a4a4a" stroke-width="1" stroke-linecap="round" fill="none"/>`;
    if (R.mark === 'paint') marks += `<path d="M38 36 H44 M38.500 38.500 H43.500 M62 36 H56 M61.500 38.500 H56.500" stroke="#a8554a" stroke-width="1.100" stroke-linecap="round"/>`;
    if (R.mark === 'mole') marks += `<circle cx="56.500" cy="41" r=".7" fill="#3a2418"/>`;
    if (R.mark === 'stubble') marks += `<path d="M41 44 Q50 52 59 44" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="3" stroke-dasharray=".8 1.800"/>`;
    if (R.mark === 'rune') marks += `<path d="M50 15.500 l2 3 -2 3 -2 -3z" fill="#bfe0ee" stroke="#5a8aa0" stroke-width=".8"/>`;
    if (R.mark === 'brow') marks += `<path d="M39 25 H47.500 M52.500 25 H61" stroke="${L.hairDk}" stroke-width="2" stroke-linecap="round"/>`;
    const face = `${marks}${eye(43.500, -1)}${eye(56.500, 1)}${brows}${nose}${mouth}`;
    const beard = R.beard ? P('M37 38 Q36 62 50 68 Q64 62 63 38 Q57 48 50 46 Q43 48 37 38Z', F('h')) : '';
    // 얼굴 위 이마 그림자
    const faceShade = `<path d="M37 24 Q50 14 63 24 L63 21 Q50 11 37 21Z" fill="#000" opacity=".1"/>`;

    /* ----- 머리카락 ----- */
    let hs = a.hair % 10; const fr = Math.floor(a.hair / 10) % 5, hairExtra = a.hair >= 50;
    // 앞머리 5종: 이마 위쪽을 덮는 모양(눈을 가리지 않는다)
    const crownTop = 'M34 34 Q29 7 50 7 Q71 7 66 34';
    const frs = [
      `${crownTop} Q64 27 58 24 Q50 28 42 24 Q36 27 34 34Z`,
      `${crownTop} Q58 28 49 19 Q42 26 34 34Z`,
      `${crownTop} Q58 26 50 19 Q42 26 34 34Z`,
      `${crownTop} L62 26 L58 31 L54 23 L50 30 L46 23 L42 31 L38 26Z`,
      `${crownTop} Q60 28 52 21 Q43 25 34 34Z M34 30 Q30 42 34 52 Q37 44 37 30Z`,
    ];
    let hairBack = '', hairFront = '', locks = '';
    // 모자 아래로 보이는 머리: 헤어 값마다 달라 보이게(구레나룻 길이=앞머리값, 모양=헤어값, 한 가닥=헤어 장식)
    const underHat = () => {
      const len = 36 + fr * 2.500;                      // 구레나룻 길이 5단계
      let u = `<path d="M35.500 26 L${35.500 + (hs === 4 ? 0 : .5)} ${len} L${hs === 4 ? 38 : 39.500} ${len - 3} L39 24Z" fill="${F('h')}" ${o}/><path d="M64.500 26 L64.500 ${len} L${hs === 4 ? 62 : 60.500} ${len - 3} L61 24Z" fill="${F('h')}" ${o}/>`;
      if (hs === 4) u += `<path d="M35.500 ${len} l-2.500 3 l4 -1 M64.500 ${len} l2.500 3 l-4 -1" fill="none" stroke="${LN}" stroke-width="1.100"/>`;
      if (hs === 8) u = `<path d="M36 26 L36 ${30 + fr * 2.500} M64 26 L64 ${30 + fr * 2.500}" stroke="${L.hairDk}" stroke-width="2.600" opacity=".75"/>` + (fr % 2 ? `<path d="M35.500 34 L36 ${len} L39 ${len - 4}Z" fill="${F('h')}" ${o}/>` : '');
      if (hairExtra) u += `<path d="M62 22 Q68 28 64 38" fill="none" stroke="${LN}" stroke-width="2.800" stroke-linecap="round"/><path d="M62 22 Q68 28 64 38" fill="none" stroke="${L.hair}" stroke-width="1.300" stroke-linecap="round"/>`;
      return u;
    };
    const sideburn = `<path d="M35.500 26 L36 38 L39.500 35 L39 24Z" fill="${F('h')}" ${o}/><path d="M64.500 26 L64 38 L60.500 35 L61 24Z" fill="${F('h')}" ${o}/>`;
    const longBack = (path) => P(path, F('h'));
    if (hs === 1) { hairBack = longBack('M34 30 Q27 9 50 7 Q73 9 66 30 L73 94 Q50 101 27 94Z'); locks = P(`M36 36 Q32 62 37 86 L44 86 Q42 60 42 42Z`, F('h')) + P(`M64 36 Q68 62 63 86 L56 86 Q58 60 58 42Z`, F('h')); }
    else if (hs === 2) { hairBack = P('M34 24 Q16 34 22 72 Q29 82 36 70 Q31 50 38 36Z', F('h')) + P('M66 24 Q84 34 78 72 Q71 82 64 70 Q69 50 62 36Z', F('h')) + `<rect x="30" y="60" width="9" height="4" rx="1.500" fill="${F('x')}" ${o} transform="rotate(-18 34 62)"/><rect x="61" y="60" width="9" height="4" rx="1.500" fill="${F('x')}" ${o} transform="rotate(18 66 62)"/>`; }
    else if (hs === 3) { hairBack = P('M62 14 Q92 18 88 58 Q86 78 77 94 Q74 66 67 44Z', F('h')) + `<rect x="62" y="11" width="9" height="5" rx="1.500" fill="${F('x')}" ${o} transform="rotate(20 66 13)"/>`; }
    else if (hs === 4) { hairBack = topOk ? P('M33 30 L26 22 L33 19 L28 9 L40 13 L42 3 L50 11 L58 3 L60 13 L72 9 L67 19 L74 22 L67 30Z', F('h')) : ''; }
    else if (hs === 5) { hairBack = topOk ? `<circle cx="50" cy="4" r="8.500" fill="${F('h')}" ${o}/>` : `<circle cx="58" cy="42" r="7" fill="${F('h')}" ${o}/>`; }
    else if (hs === 6) { hairBack = ''; locks = `<g fill="${F('h')}" ${o}><circle cx="${X(sw - 3)}" cy="62" r="4.600"/><circle cx="${X(sw - 2)}" cy="71" r="4.600"/><circle cx="${X(sw - 1)}" cy="80" r="4.600"/><circle cx="${X(sw - 1)}" cy="89" r="4.300"/><circle cx="${X(sw - 1.500)}" cy="97" r="3.800"/></g><rect x="${X(sw - 5)}" y="54" width="8" height="4" rx="1.500" fill="${F('x')}" ${o}/>`; hairBack = P('M34 30 Q29 9 50 8 Q71 9 66 30 L67 56 Q50 60 33 56Z', F('h')); }
    else if (hs === 7) { hairBack = `<g fill="${F('h')}" ${o}>${topOk ? '<circle cx="34" cy="20" r="9"/><circle cx="66" cy="20" r="9"/><circle cx="50" cy="9" r="11"/>' : ''}<circle cx="31" cy="35" r="8"/><circle cx="69" cy="35" r="8"/><circle cx="33" cy="50" r="7.500"/><circle cx="67" cy="50" r="7.500"/></g>`; }
    else if (hs === 8) { hairBack = topOk ? P(`M${44 - fr} 16 Q50 ${-2 - fr * 3} ${56 + fr} 16 L${56 + fr} 22 Q50 18 ${44 - fr} 22Z`, F('h')) : ''; }
    else if (hs === 9) { hairBack = longBack('M34 30 Q27 9 50 7 Q73 9 66 30 Q76 50 70 66 Q76 80 68 92 Q58 86 50 94 Q42 86 32 92 Q24 80 30 66 Q24 50 34 30Z'); locks = P('M62 34 Q70 54 62 80 L56 80 Q60 58 56 40Z', F('h')); }
    // 앞머리/정수리
    const crownShow = topOk;                           // 모자가 없으면 정수리 머리를 그린다
    const fringeShow = topOk || HAT_FRINGE[ot];
    let hairTop = '';
    if (crownShow && hs !== 7 && hs !== 8) hairTop = P(frs[fr], F('h')) + `<path d="M38 17 Q46 12 55 14" fill="none" stroke="${L.hairHi}" stroke-width="1.500" stroke-linecap="round" opacity=".8"/>`;
    else if (crownShow) hairTop = P(frs[hs === 8 ? 3 : fr], F('h'));
    else { hairTop = underHat(); if (fringeShow) hairTop += P(`M36 30 Q34 20 42 17 Q50 14 58 17 Q66 20 64 30 Q60 24 56 23 Q50 27 44 23 Q40 24 36 30Z`, F('h')); }
    if (hairExtra && crownShow) hairTop += `<path d="M50 9 Q42 -4 53 -5 Q57 1 52 5" fill="none" stroke="${LN}" stroke-width="3.400" stroke-linecap="round"/><path d="M50 9 Q42 -4 53 -5 Q57 1 52 5" fill="none" stroke="${L.hair}" stroke-width="1.700" stroke-linecap="round"/>`;
    // 동물 귀·뿔·잎 (모자를 쓰면 숨김)
    let top = '';
    if (topOk) {
      if (R.ears === 'cat') top += P('M37 20 L34 3 L48 12Z', F('h')) + P('M63 20 L66 3 L52 12Z', F('h')) + `<path d="M38 15 L36.500 7 L44 12Z M62 15 L63.500 7 L56 12Z" fill="#d89aa4"/>`;
      if (R.ears === 'fox') top += P('M36 22 L31 -2 L48 11Z', F('h')) + P('M64 22 L69 -2 L52 11Z', F('h')) + `<path d="M37 14 L34 3 L43 10Z M63 14 L66 3 L57 10Z" fill="#2a1a22"/>`;
      if (R.ears === 'wolf') top += P('M36 22 L36 0 L48 11Z', F('h')) + P('M64 22 L64 0 L52 11Z', F('h')) + `<path d="M38 14 L38 5 L44 10Z M62 14 L62 5 L56 10Z" fill="${L.hairDk}"/>`;
      if (R.horn === 'one') top += P('M46 16 L50 -6 L54 16Z', '#e6dec8');
    }
    const leaf = (R.leaf && topOk) ? P('M46 11 Q38 0 47 -4 Q54 3 51 11Z', '#6c9a58') + P('M53 11 Q58 -1 68 1 Q66 11 56 13Z', '#85b070') : '';

    /* ----- 머리 장비 ----- */
    if (ot === 0) hat = P('M34 30 Q32 6 50 6 Q68 6 66 30 L66 42 Q62 40 60 31 L60 22 Q50 18 40 22 L40 31 Q38 40 34 42Z', F('t')) + `<path d="M36 18 Q50 11 64 18" fill="none" stroke="${MET_HI}" stroke-width="1.200" opacity=".9"/><path d="M49 22 H51 V34 H49Z" fill="${F('t')}" ${o}/><path d="M50 6 Q56 -4 66 -1 Q58 3 54 11Z" fill="${F('m')}" ${o}/>`;
    else if (ot === 1) hat = P('M32 20 Q40 2 60 -14 Q57 4 70 20Z', F('m')) + `<ellipse cx="50" cy="20" rx="26" ry="5.500" fill="${F('m')}" ${o}/><path d="M33 19 Q50 25 68 19" fill="none" stroke="${GOLD}" stroke-width="2.400"/>`;
    else if (ot === 3) hat = P('M31 36 Q26 4 50 2 Q74 4 69 36 L69 56 Q64 60 60 52 Q64 36 61 27 Q50 16 39 27 Q36 36 40 52 Q36 60 31 56Z', F('c'), 'fill-rule="evenodd"') + `<path d="M40 18 Q50 11 60 18" fill="none" stroke="#fff" stroke-width="1" opacity=".18"/>`;
    else if (ot === 6) hat = P('M32 24 Q30 6 52 6 Q73 6 68 22 Q50 17 32 24Z', F('m')) + `<path d="M62 11 Q84 -6 92 8 Q80 6 66 16Z" fill="${F('g')}" ${o}/><circle cx="66" cy="11" r="2" fill="${F('x')}" ${o}/>`;
    else if (ot === 9) hat = P('M33 26 Q32 4 50 4 Q68 4 67 26Z', '#c9a64a') + `<path d="M30 24 H70 V29 H30Z" fill="#b8963c" ${o}/><circle cx="50" cy="13" r="4.500" fill="#efe3b0" ${o}/><path d="M38 12 Q50 6 62 12" fill="none" stroke="#fff" stroke-width="1" opacity=".3"/>`;
    else if (ot === 8) hat = `<path d="M35 22 Q50 14 65 22" fill="none" stroke="${LN}" stroke-width="4" stroke-linecap="round"/><path d="M35 22 Q50 14 65 22" fill="none" stroke="${GOLD}" stroke-width="2.200" stroke-linecap="round"/><path d="M50 17 l2.200 3 -2.200 3 -2.200 -3z" fill="${F('x')}" ${o}/>`;
    else if (ot === 7) hat = `<path d="M35 24 Q50 15 65 24 L65 28 Q50 20 35 28Z" fill="#9a5048" ${o}/><path d="M65 25 L74 29 L66 31Z" fill="#9a5048" ${o}/>`;
    else if (ot === 4) hat = '';
    else if (ot === 5) hat = `<path d="M37 21 Q50 17 63 21" fill="none" stroke="${L.cream}" stroke-width="0"/>`;

    /* ----- 장식: 얼굴 소품 + 들고 있는 물건 ----- */
    let acc = '', held = '', heldBack = '';
    const hx = X(sw + .5), hy = 103;
    const shaft = (x, y0, y1) => `<path d="M${x} ${y0} V${y1}" stroke="${LN}" stroke-width="4.200" stroke-linecap="round"/><path d="M${x} ${y0} V${y1}" stroke="${F('w')}" stroke-width="2.400" stroke-linecap="round"/>`;
    if (at === 0) held = `<g transform="rotate(10 ${hx} ${hy})"><path d="M${hx - 2} ${hy - 4} V${hy - 52} L${hx} ${hy - 58} L${hx + 2} ${hy - 52} V${hy - 4}Z" fill="${F('t')}" ${o}/><path d="M${hx} ${hy - 52} V${hy - 6}" stroke="${MET_HI}" stroke-width=".9"/><rect x="${hx - 6.500}" y="${hy - 5}" width="13" height="3.400" rx="1.200" fill="${F('g')}" ${o}/><rect x="${hx - 1.800}" y="${hy - 2}" width="3.600" height="9" rx="1.200" fill="${F('l')}" ${o}/></g>`;
    else if (at === 1) heldBack = shaft(hx, 8, 168) + P(`M${hx} -8 L${hx + 4} 12 L${hx} 9 L${hx - 4} 12Z`, F('t')) + `<path d="M${hx - 3} 14 H${hx + 3}" stroke="${L.gem}" stroke-width="2.600"/>`;
    else if (at === 2) heldBack = shaft(hx, 14, 168) + `<circle cx="${hx}" cy="9" r="6" fill="none" stroke="${LN}" stroke-width="3.600"/><circle cx="${hx}" cy="9" r="6" fill="none" stroke="${GOLD}" stroke-width="1.800"/><circle cx="${hx}" cy="9" r="2.800" fill="${F('x')}" ${o}/>`;
    else if (at === 3) heldBack = shaft(hx, 36, 136) + P(`M${hx} 32 Q${hx + 17} 28 ${hx + 15} 54 Q${hx + 7} 48 ${hx} 50Z`, F('t')) + `<path d="M${hx - 2} 100 h4 M${hx - 2} 104 h4" stroke="${L.gem}" stroke-width="2"/>` + `<path d="M${hx + 3} 36 Q${hx + 12} 36 ${hx + 12} 48" fill="none" stroke="${MET_HI}" stroke-width=".9"/>`;
    else if (at === 4) heldBack = `<path d="M${hx - 1} 50 Q${hx + 17} 92 ${hx - 1} 134" fill="none" stroke="${LN}" stroke-width="4"/><path d="M${hx - 1} 50 Q${hx + 17} 92 ${hx - 1} 134" fill="none" stroke="${F('w')}" stroke-width="2.200"/><path d="M${hx - 1} 50 L${hx - 1} 134" stroke="#e8dcc0" stroke-width=".7"/><path d="M${hx - 3} 88 h4 M${hx - 3} 92 h4" stroke="${L.gem}" stroke-width="2"/>`;
    else if (at === 5) heldBack = shaft(hx, 40, 148) + `<path d="M${hx - 14} 46 Q${hx} 32 ${hx + 14} 46" fill="none" stroke="${LN}" stroke-width="5"/><path d="M${hx - 14} 46 Q${hx} 32 ${hx + 14} 46" fill="none" stroke="${MET}" stroke-width="2.800"/><path d="M${hx - 2} 112 h4 M${hx - 2} 116 h4" stroke="${L.gem}" stroke-width="2"/>`;
    else if (at === 6) { acc = `<g fill="rgba(255,255,255,.14)" stroke="${GOLD_DK}" stroke-width="1.100"><circle cx="43.500" cy="31" r="5.600"/><circle cx="56.500" cy="31" r="5.600"/></g><path d="M49 30 H51" stroke="${GOLD_DK}" stroke-width="1"/>`;
      held = `<rect x="${hx - 6}" y="${hy - 18}" width="12" height="16" rx="1.500" fill="${F('x')}" ${o}/><path d="M${hx - 3} ${hy - 13} H${hx + 3} M${hx - 3} ${hy - 9} H${hx + 3}" stroke="#fff" stroke-opacity=".6" stroke-width="1"/>`; }
    else if (at === 7) { acc = `<ellipse cx="43.500" cy="31" rx="5.200" ry="4.800" fill="#1d1720" ${o} stroke-width="1"/><path d="M36 24 L40 27 M47 27 L64 22" stroke="#1d1720" stroke-width="1.300"/><circle cx="43.500" cy="31" r="1.600" fill="${L.gem}"/>`;
      held = `<path d="M${hx - 1.500} ${hy - 3} V${hy - 22} L${hx + .5} ${hy - 27} L${hx + 2.500} ${hy - 22} V${hy - 3}Z" fill="${F('t')}" ${o}/><rect x="${hx - 4}" y="${hy - 4}" width="8.500" height="3" rx="1" fill="${F('x')}" ${o}/>`; }
    else if (at === 8) { acc = `<g transform="translate(38 22)"><g fill="${F('x')}" ${o} stroke-width=".9"><circle cx="0" cy="-3.200" r="2.400"/><circle cx="3" cy="-1" r="2.400"/><circle cx="1.800" cy="2.600" r="2.400"/><circle cx="-1.800" cy="2.600" r="2.400"/><circle cx="-3" cy="-1" r="2.400"/></g><circle r="1.500" fill="#e8d28a" stroke="${LN}" stroke-width=".6"/></g>`;
      held = `<path d="M${hx - 4} ${hy - 4} h8 v-8 h-8z M${hx - 3} ${hy - 12} q3 -5 6 0" fill="${F('t')}" ${o}/><path d="M${hx} ${hy - 19} v-5" stroke="${GOLD}" stroke-width="1.600"/><circle cx="${hx}" cy="${hy - 8}" r="2" fill="#f0d890" stroke="${LN}" stroke-width=".7"/>`; }
    else if (at === 9) held = `<g><path d="M${X(-sw - 14)} 84 H${X(-sw + 6)} V102 Q${X(-sw - 4)} 118 ${X(-sw - 14)} 102Z" fill="${F('t')}" ${o}/><path d="M${X(-sw - 4)} 86 V114" stroke="${LN}" stroke-width="1" opacity=".7"/><circle cx="${X(-sw - 4)}" cy="96" r="3.600" fill="${F('x')}" ${o}/></g>`;

    /* ----- 꼬리·날개 ----- */
    let tail = '';
    if (R.wings) tail += `<path d="M44 66 Q8 40 6 82 Q22 76 44 92Z" fill="#cfe6ee" fill-opacity=".7" ${o}/><path d="M56 66 Q92 40 94 82 Q78 76 56 92Z" fill="#cfe6ee" fill-opacity=".7" ${o}/>`;
    if (R.tail === 'fox') tail += P('M60 108 Q98 118 92 74 Q88 100 70 100Z', F('h')) + `<path d="M92 74 Q90 86 88 92 Q84 88 86 80Z" fill="#efe8d8" stroke="${LN}" stroke-width="1"/>`;
    if (R.tail === 'cat') tail += `<path d="M60 112 Q94 120 86 94 Q84 86 90 82" fill="none" stroke="${LN}" stroke-width="7" stroke-linecap="round"/><path d="M60 112 Q94 120 86 94 Q84 86 90 82" fill="none" stroke="${L.hair}" stroke-width="4" stroke-linecap="round"/>`;
    if (R.tail === 'wolf') tail += P('M60 106 Q100 112 92 82 Q86 100 70 98Z', F('h'));

    const ground = opts.view === 'bust' ? '' : '<ellipse cx="50" cy="168" rx="28" ry="3.600" fill="#000" opacity=".32"/>';
    const vb = opts.view === 'bust' ? '12 -10 76 88' : '-8 -36 116 208';
    const HS = 'translate(50 50) scale(1.2) translate(-50 -50)';   // 머리를 키워 얼굴이 잘 보이게
    // 겹치는 순서(아래→위)
    const body = `${legs}${boots}${long ? '' : ''}${torso}${over}${arms}${hands}`;
    const handHeld = held;           // 손 위에 보이는 물건
    return `<svg class="char ${opts.cls || ''}" viewBox="${vb}" role="img" aria-label="${esc(opts.label || '모험가')}" data-ap="${[a.gender, a.race, a.skin, a.eye, a.hair, a.eyeColor, a.hairColor, a.clothes, a.accessory].join(',')}" data-tc="${L.skin}|${L.hair}|${L.iris}">${defs}${ground}${tail}${back}${heldBack}<g transform="${HS}"><g data-l="back">${hairBack}</g><g data-l="topear">${top}${leaf}</g></g>${body}${neck}<g transform="${HS}"><g data-l="locks">${locks}</g><g data-l="ears">${ears}</g><g data-l="hd">${head}${faceShade}</g><g data-l="beard">${beard}</g><g data-l="fx">${face}</g><g data-l="hair">${hairTop}</g><g data-l="hat">${hat}</g><g data-l="ac">${acc}</g></g>${handHeld}${front}</svg>`;
  }

  /* ---------- 몬스터 (캐릭터와 같은 화풍: 굵은 외곽선 · 계단 음영 · 큰 눈) ----------
     이름에서 체형(슬라임·들짐승·늑대류·날개·벌레·뱀·언데드·골렘·정령·용·악마·괴물)을 고르고,
     같은 체형 안에서도 이름마다 색과 무늬(줄무늬·점·뿔)가 달라진다. 보스는 왕관과 오라가 붙는다. */
  const MON_RULES = [
    [/슬라임|점액/, 'slime'], [/미믹/, 'mimic'], [/박쥐|까마귀|독수리|하피|그리폰|임프/, 'wing'],
    [/딱정벌레|메뚜기|거미/, 'bug'], [/독사|도마뱀|개구리|히드라|바실/, 'snake'],
    [/해골|좀비|구울|와이트|뱀파이어|죽음기사|리치|악령기사/, 'undead'], [/골렘|가고일|석상|트렌트|엔트/, 'golem'],
    [/정령|그림자|공허|사도|타락천사/, 'spirit'], [/와이번|드레이크|고룡|키메라|용인|용$|드래곤/, 'dragon'],
    [/악마|서큐버스|마신|마왕/, 'demon'], [/고블린|코볼트|리자드맨|오크|오우거|트롤|외눈거인|산적|거인|미노타|켄타우/, 'brute'],
    [/늑대|멧돼지|곰|여우|하이에나|웨어울프/, 'beast'], [/쥐|두더지|토끼/, 'rodent'],
  ];
  const ART_FALLBACK = { q1: 'rodent', q2: 'beast', q3: 'brute', q4: 'brute', q5: 'golem', q6: 'dragon' };
  const hashStr = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };
  // 체형별 기본 색상(색상값, 채도, 명도)
  const MON_BASE = { slime: [150, 55, 52], mimic: [28, 55, 38], wing: [260, 30, 34], bug: [30, 55, 36], snake: [105, 50, 44], undead: [45, 14, 82], golem: [30, 10, 52],
    spirit: [195, 70, 60], dragon: [8, 62, 50], demon: [350, 55, 42], brute: [100, 42, 46], beast: [28, 22, 52], rodent: [24, 26, 52] };

  function monsterArt(kind, name) {
    const h = hashStr(name || kind), id = 'm' + (++uid), v = h % 4, boss = /(왕|군주|여왕|대장|폭군|제왕|수호자|주술사)$|마왕|마신|고룡|고대/.test(name || '');
    const base = MON_BASE[kind] || MON_BASE.beast;
    let hue = base[0] + ((h >> 3) % 40) - 20, sat = base[1], lit = base[2];
    const nm = name || '';
    if (kind === 'brute') { if (/고블린/.test(nm)) { hue = 105; } else if (/홉/.test(nm)) { hue = 70; } else if (/코볼트/.test(nm)) { hue = 25; sat = 55; } else if (/리자드/.test(nm)) { hue = 170; } else if (/오크/.test(nm)) { hue = 125; lit = 36; } else if (/오우거|거인/.test(nm)) { hue = 32; sat = 38; lit = 52; } else if (/트롤/.test(nm)) { hue = 200; sat = 25; lit = 46; } else if (/산적/.test(nm)) { hue = 24; sat = 42; lit = 56; } else if (/미노타|켄타우/.test(nm)) { hue = 22; sat = 40; lit = 38; } }
    if (kind === 'undead') { if (/좀비|구울/.test(nm)) { hue = 95; sat = 30; lit = 50; } else if (/뱀파|와이트/.test(nm)) { hue = 270; sat = 18; lit = 74; } }
    if (kind === 'beast') { if (/곰/.test(nm)) { hue = 24; sat = 40; lit = 34; } else if (/여우/.test(nm)) { hue = 24; sat = 80; lit = 52; } else if (/늑대|웨어울프/.test(nm)) { hue = 220; sat = 12; lit = 54; } else if (/멧돼지/.test(nm)) { hue = 18; sat = 36; lit = 36; } else if (/하이에나/.test(nm)) { hue = 40; sat = 45; lit = 52; } }
    if (kind === 'snake' && /개구리/.test(nm)) { hue = 120; sat = 55; }
    if (kind === 'golem' && /트렌트|엔트/.test(nm)) { hue = 28; sat = 38; lit = 34; }
    if (kind === 'wing' && /임프/.test(nm)) { hue = 0; sat = 60; lit = 46; }
    const B = hsl(hue, sat, lit), D = hsl(hue + 8, sat + 6, lit - 15), H = hsl(hue - 6, sat - 6, lit + 18);
    const INKM = '#17111f', o = `stroke="${INKM}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"`;
    const cel = (n, c1, c2, at) => `<linearGradient id="${id}${n}" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="${at || .6}" stop-color="${c1}"/><stop offset="${at || .6}" stop-color="${c2}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
    const defs = `<defs>${cel('b', B, D)}${cel('s', '#e9e2cc', '#b8ae94')}${cel('k', hsl(hue, sat, lit - 8), hsl(hue, sat, lit - 22))}</defs>`;
    const F = `url(#${id}b)`, S = `url(#${id}s)`, K = `url(#${id}k)`;
    const E = (cx, cy, r, col, glow) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" ${o} stroke-width="2.2"/><circle cx="${cx}" cy="${cy + r * .1}" r="${r * .62}" fill="${col || INKM}"/>${glow ? `<circle cx="${cx}" cy="${cy}" r="${r * 1.5}" fill="${col}" opacity=".25"/>` : ''}<circle cx="${cx - r * .3}" cy="${cy - r * .3}" r="${r * .26}" fill="#fff"/>`;
    const P = (d, f) => `<path d="${d}" fill="${f || F}" ${o}/>`;
    const tooth = (x, y, w) => `<path d="M${x} ${y} l${w / 2} ${w * 1.1} l${w / 2} -${w * 1.1}Z" fill="#fff" stroke="${INKM}" stroke-width="1.6" stroke-linejoin="round"/>`;
    let g = '', top = 40;
    const stripes = v === 1 ? `<path d="M44 74 l-4 -10 M56 70 l-3 -10 M68 70 l3 -10" stroke="${D}" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>` : '';
    const spots = v === 2 ? `<g fill="${H}" opacity=".7"><circle cx="50" cy="86" r="4"/><circle cx="68" cy="80" r="3"/><circle cx="76" cy="94" r="4"/></g>` : '';
    if (kind === 'slime') { top = 48;
      g = `${P('M16 108 Q8 66 42 50 Q60 42 78 50 Q112 66 104 108 Q60 120 16 108Z')}<path d="M30 72 Q34 62 46 58" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".65"/><g fill="#fff" opacity=".28"><circle cx="86" cy="92" r="5"/><circle cx="26" cy="96" r="3"/></g>${E(46, 84, 8)}${E(74, 84, 8)}<path d="M54 99 Q60 105 66 99" fill="none" stroke="${INKM}" stroke-width="3" stroke-linecap="round"/>${v === 3 ? `<path d="M60 52 Q56 38 66 36 Q68 44 62 52Z" fill="${H}" ${o}/>` : ''}`; }
    else if (kind === 'mimic') { top = 40;
      g = `${P('M20 108 H100 V70 H20Z', F)}${P('M20 70 Q60 24 100 70Z', K)}<path d="M20 70 H100" stroke="${INKM}" stroke-width="3.2"/><path d="M20 84 H100" stroke="#e6c050" stroke-width="5"/><rect x="52" y="74" width="16" height="18" rx="3" fill="#e6c050" ${o}/><path d="M26 70 L34 82 L42 70 L50 82 L58 70 L66 82 L74 70 L82 82 L90 70Z" fill="#fff" ${o} stroke-width="2.2"/><path d="M50 74 Q60 100 72 74Z" fill="#e26a82" ${o} stroke-width="2.4"/>${E(40, 56, 7, '#e0524a')}${E(80, 56, 7, '#e0524a')}`; }
    else if (kind === 'wing') { top = 36; const bat = /박쥐|임프/.test(nm);
      g = `${P('M40 70 Q6 36 6 86 Q22 78 38 90Z', K)}${P('M80 70 Q114 36 114 86 Q98 78 82 90Z', K)}${P('M34 84 Q30 52 60 48 Q90 52 86 84 Q82 108 60 108 Q38 108 34 84Z')}<ellipse cx="60" cy="92" rx="15" ry="14" fill="${S}"/>${bat ? `${P('M42 56 L34 34 L52 50Z', K)}${P('M78 56 L86 34 L68 50Z', K)}${tooth(52, 82, 6)}${tooth(62, 82, 6)}` : `<path d="M54 80 L60 94 L66 80Z" fill="#f0b44a" ${o}/>`}${E(48, 70, 7)}${E(72, 70, 7)}${P('M46 106 l-4 8 h12z M74 106 l-4 8 h12z', '#e8b04a')}${v === 3 ? `<path d="M60 48 Q54 34 64 30" fill="none" stroke="${INKM}" stroke-width="3" stroke-linecap="round"/>` : ''}`; }
    else if (kind === 'bug') { top = 40;
      if (/거미/.test(nm)) g = `<g fill="none" stroke="${INKM}" stroke-width="3.2" stroke-linecap="round"><path d="M44 74 Q18 62 12 90 M44 82 Q16 82 14 108 M76 74 Q102 62 108 90 M76 82 Q104 82 106 108 M48 66 Q26 44 14 60 M72 66 Q94 44 106 60 M46 90 Q30 104 26 116 M74 90 Q90 104 94 116"/></g>${P('M60 62 Q92 66 90 92 Q86 112 60 112 Q34 112 30 92 Q28 66 60 62Z')}${P('M60 38 Q80 38 80 54 Q78 68 60 68 Q42 68 40 54 Q40 38 60 38Z', K)}<path d="M46 86 l8 -8 l8 8 l-8 8Z" fill="${H}" opacity=".7"/>${E(50, 52, 5, '#e0524a')}${E(70, 52, 5, '#e0524a')}${tooth(54, 62, 5)}${tooth(62, 62, 5)}`;
      else g = `<g fill="none" stroke="${INKM}" stroke-width="3.2" stroke-linecap="round"><path d="M34 90 L20 108 M44 98 L38 114 M86 90 L100 108 M76 98 L82 114 M52 30 Q44 14 36 18 M68 30 Q76 14 84 18"/></g>${P('M60 50 Q96 54 94 90 Q90 108 60 108 Q30 108 26 90 Q24 54 60 50Z')}<path d="M60 52 V108" stroke="${INKM}" stroke-width="2.6"/>${P('M60 28 Q82 28 82 46 Q82 60 60 60 Q38 60 38 46 Q38 28 60 28Z', K)}${E(50, 44, 6)}${E(70, 44, 6)}${v >= 2 ? `<path d="M60 28 Q58 10 70 8 Q66 20 66 30Z" fill="${H}" ${o}/>` : ''}${stripes}${spots}`; }
    else if (kind === 'snake') { top = 34;
      if (/개구리/.test(nm)) { top = 42; g = `${P('M16 100 Q12 60 60 56 Q108 60 104 100 Q100 116 60 116 Q20 116 16 100Z')}<ellipse cx="60" cy="100" rx="28" ry="14" fill="${S}"/>${P('M24 104 Q10 114 20 120 L40 112Z', K)}${P('M96 104 Q110 114 100 120 L80 112Z', K)}${E(38, 52, 11)}${E(82, 52, 11)}<path d="M40 82 Q60 94 80 82" fill="none" stroke="${INKM}" stroke-width="3.2" stroke-linecap="round"/>${spots}`; }
      else { const heads = /히드라/.test(nm) ? [[30, 46], [60, 34], [90, 46]] : [[60, 36]];
        g = `${P('M22 112 Q4 96 30 86 Q66 80 56 66 Q50 56 60 48', 'none')}<path d="M22 110 Q6 96 32 88 Q76 82 62 66 Q58 56 62 50" fill="none" stroke="${INKM}" stroke-width="26" stroke-linecap="round"/><path d="M22 110 Q6 96 32 88 Q76 82 62 66 Q58 56 62 50" fill="none" stroke="${B}" stroke-width="19" stroke-linecap="round"/><path d="M22 110 Q6 96 32 88 Q76 82 62 66 Q58 56 62 50" fill="none" stroke="${H}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 14" opacity=".7"/>` + heads.map(([hx, hy]) => `<path d="M${hx} ${hy + 22} L${hx} ${hy + 4}" stroke="${INKM}" stroke-width="22" stroke-linecap="round" ${heads.length > 1 ? '' : 'opacity="0"'}/><path d="M${hx} ${hy + 22} L${hx} ${hy + 4}" stroke="${B}" stroke-width="15" stroke-linecap="round" ${heads.length > 1 ? '' : 'opacity="0"'}/>${P(`M${hx - 18} ${hy} Q${hx} ${hy - 20} ${hx + 18} ${hy} Q${hx + 20} ${hy + 18} ${hx} ${hy + 20} Q${hx - 20} ${hy + 18} ${hx - 18} ${hy}Z`)}${E(hx - 7, hy + 2, 5, '#ffd34a')}${E(hx + 7, hy + 2, 5, '#ffd34a')}<path d="M${hx} ${hy + 14} v10 l-3 4 m3 -4 l3 4" fill="none" stroke="#e0404a" stroke-width="2.2" stroke-linecap="round"/>`).join('') + (heads.length > 1 ? '' : ''); } }
    else if (kind === 'undead') { top = 22; const helm = /죽음기사|악령기사/.test(nm), lich = /리치/.test(nm), cape = /뱀파|와이트/.test(nm), skull = /해골|리치|죽음|악령/.test(nm), glow = lich ? '#7ae0ff' : cape ? '#e0404a' : helm ? '#ff7a3a' : '#ffd34a';
      g = `${cape || helm ? P('M34 70 L22 114 L98 114 L86 70Z', K) : ''}${P('M38 74 Q60 68 82 74 L80 106 Q60 112 40 106Z', skull ? S : F)}<path d="M44 84 H76 M45 92 H75 M47 100 H73" stroke="${INKM}" stroke-width="2.600" opacity="${skull ? 1 : .5}"/><path d="M34 78 L24 104 M86 78 L96 104" stroke="${INKM}" stroke-width="12" stroke-linecap="round"/><path d="M34 78 L24 104 M86 78 L96 104" stroke="${skull ? '#d9d0b6' : B}" stroke-width="6" stroke-linecap="round"/>${P('M32 50 Q30 18 60 18 Q90 18 88 50 Q88 68 76 72 H44 Q32 68 32 50Z', skull ? S : F)}<ellipse cx="47" cy="50" rx="9" ry="10" fill="#1a1220" ${o} stroke-width="2.2"/><ellipse cx="73" cy="50" rx="9" ry="10" fill="#1a1220" ${o} stroke-width="2.2"/><circle cx="47" cy="51" r="4" fill="${glow}"/><circle cx="73" cy="51" r="4" fill="${glow}"/><circle cx="46" cy="49" r="1.4" fill="#fff"/><circle cx="72" cy="49" r="1.4" fill="#fff"/><path d="M57 60 l3 5 l3 -5Z" fill="#1a1220"/><path d="M44 70 H76" stroke="${INKM}" stroke-width="2.6"/><path d="M50 66 v8 M56 66 v8 M62 66 v8 M68 66 v8" stroke="${INKM}" stroke-width="1.800"/>${helm ? `${P('M30 52 Q28 12 60 12 Q92 12 90 52 L82 48 V38 Q60 28 38 38 V48Z', '#7c869c')}<path d="M44 40 Q60 34 76 40" stroke="${INKM}" stroke-width="2.4" fill="none"/>${P('M60 12 Q70 0 82 6 Q72 10 66 18Z', '#c0392b')}` : ''}${lich ? `${P('M42 22 L40 6 L50 14 L60 2 L70 14 L80 6 L78 22Z', '#e6c050')}` : ''}${cape ? `${tooth(48, 70, 5)}${tooth(66, 70, 5)}` : ''}`; }
    else if (kind === 'golem') {
      if (/트렌트|엔트/.test(nm)) { top = 14; g = `<path d="M30 112 Q38 94 44 90 M90 112 Q82 94 76 90" fill="none" stroke="${INKM}" stroke-width="14" stroke-linecap="round"/><path d="M30 112 Q38 94 44 90 M90 112 Q82 94 76 90" fill="none" stroke="${B}" stroke-width="8" stroke-linecap="round"/>${P('M38 112 Q34 70 42 50 H78 Q86 70 82 112Z')}<path d="M10 66 Q22 56 42 62 M110 66 Q98 56 78 62" fill="none" stroke="${INKM}" stroke-width="12" stroke-linecap="round"/><path d="M10 66 Q22 56 42 62 M110 66 Q98 56 78 62" fill="none" stroke="${B}" stroke-width="6" stroke-linecap="round"/><g fill="#4ea84a" ${o}><circle cx="36" cy="30" r="18"/><circle cx="84" cy="30" r="18"/><circle cx="60" cy="20" r="20"/></g><path d="M40 28 Q44 20 54 22" fill="none" stroke="#9be08a" stroke-width="4" stroke-linecap="round"/>${E(50, 72, 6, '#ffd34a')}${E(70, 72, 6, '#ffd34a')}<path d="M50 90 Q60 98 70 90" fill="none" stroke="${INKM}" stroke-width="3.400" stroke-linecap="round"/>`; }
      else if (/가고일|석상/.test(nm)) { top = 14; g = `${P('M40 66 Q4 40 8 90 Q24 82 40 96Z', K)}${P('M80 66 Q116 40 112 90 Q96 82 80 96Z', K)}${P('M34 70 H86 V108 Q60 116 34 108Z')}${P('M34 40 Q36 22 60 22 Q84 22 86 40 V64 H34Z')}${P('M38 30 L30 8 L46 24Z', K)}${P('M82 30 L90 8 L74 24Z', K)}${E(48, 46, 7, '#ff6a3a', 1)}${E(72, 46, 7, '#ff6a3a', 1)}<path d="M46 62 H74" stroke="${INKM}" stroke-width="3"/>${tooth(50, 62, 6)}${tooth(64, 62, 6)}<path d="M54 82 l8 10 l-4 10" stroke="#ffb347" stroke-width="3" fill="none" stroke-linecap="round"/>`; }
      else { top = 24; g = `${P('M8 62 H34 V108 H8Z')}${P('M86 62 H112 V108 H86Z')}${P('M30 62 H90 V112 H30Z')}${P('M38 26 H82 V62 H38Z', K)}<path d="M44 74 l8 12 l-6 12 M76 70 l-6 12 l8 10" stroke="#ff9a2a" stroke-width="3.600" fill="none" stroke-linecap="round"/><rect x="44" y="38" width="12" height="8" rx="2" fill="#ffb347" ${o} stroke-width="2"/><rect x="64" y="38" width="12" height="8" rx="2" fill="#ffb347" ${o} stroke-width="2"/><path d="M50 54 H70" stroke="${INKM}" stroke-width="3"/><path d="M14 74 h14 M92 74 h14" stroke="${INKM}" stroke-width="2.600"/>`; } }
    else if (kind === 'spirit') { top = 12; const wings = /사도|천사/.test(nm), dark = /그림자|타락|공허/.test(nm), many = /공허/.test(nm);
      g = `${wings ? `${P('M44 64 Q4 30 6 88 Q26 76 44 92Z', dark ? '#4a3a66' : '#f4f0e0')}${P('M76 64 Q116 30 114 88 Q94 76 76 92Z', dark ? '#4a3a66' : '#f4f0e0')}<ellipse cx="60" cy="14" rx="16" ry="5" fill="none" stroke="#ffe27a" stroke-width="4"/>` : ''}${P('M60 20 Q90 52 88 80 Q86 106 60 114 Q34 106 32 80 Q30 52 60 20Z')}<path d="M60 40 Q76 62 74 82 Q72 98 60 104 Q48 98 46 82 Q44 62 60 40Z" fill="${H}" opacity=".6"/>${many ? `${E(60, 52, 9, '#c06aff', 1)}${E(44, 72, 6, '#c06aff', 1)}${E(76, 72, 6, '#c06aff', 1)}` : `${E(48, 70, 8, dark ? '#c06aff' : '#fff6a0', 1)}${E(72, 70, 8, dark ? '#c06aff' : '#fff6a0', 1)}`}<path d="M52 90 Q60 96 68 90" fill="none" stroke="${INKM}" stroke-width="3" stroke-linecap="round"/>`; }
    else if (kind === 'dragon') { top = 26;
      g = `${P('M60 62 L6 24 L14 66 L2 84 L40 80Z', K)}${P('M62 62 L114 22 L106 66 L118 86 L82 80Z', K)}${P('M84 98 Q116 108 112 84 Q106 96 90 92Z', K)}${P('M30 82 Q28 56 60 54 Q92 56 90 82 Q90 112 60 114 Q30 112 30 82Z')}<ellipse cx="60" cy="96" rx="17" ry="17" fill="#f0d69a" ${o} stroke-width="2.6"/><path d="M48 90 h24 M48 98 h24 M50 106 h20" stroke="#c9a85a" stroke-width="2.200"/>${P('M38 52 L30 26 L48 42Z', '#efe6c8')}${P('M82 52 L90 26 L72 42Z', '#efe6c8')}${P('M34 52 Q34 28 60 28 Q86 28 86 52 Q86 68 60 68 Q34 68 34 52Z')}${E(48, 50, 7, '#ffd34a')}${E(72, 50, 7, '#ffd34a')}<ellipse cx="54" cy="62" rx="1.600" ry="2.200" fill="${INKM}"/><ellipse cx="66" cy="62" rx="1.600" ry="2.200" fill="${INKM}"/>${tooth(50, 66, 5)}${tooth(65, 66, 5)}${v >= 2 ? `<path d="M52 28 L60 16 L68 28Z" fill="${H}" ${o}/>` : ''}`; }
    else if (kind === 'demon') { top = 18;
      g = `${P('M38 70 Q4 34 8 88 Q24 78 40 94Z', K)}${P('M82 70 Q116 34 112 88 Q96 78 80 94Z', K)}<path d="M82 104 Q112 112 108 90" fill="none" stroke="${INKM}" stroke-width="9" stroke-linecap="round"/><path d="M82 104 Q112 112 108 90" fill="none" stroke="${B}" stroke-width="4.600" stroke-linecap="round"/>${P('M104 84 l10 -4 l-2 12Z', '#e0404a')}${P('M36 78 Q36 62 60 60 Q84 62 84 78 L86 108 Q60 116 34 108Z')}${P('M36 46 Q34 30 60 30 Q86 30 84 46 Q84 62 60 64 Q36 62 36 46Z')}${P('M38 36 Q22 22 34 8 Q38 22 48 30Z', '#e8e2d0')}${P('M82 36 Q98 22 86 8 Q82 22 72 30Z', '#e8e2d0')}${E(48, 48, 6.500, '#ff5a3a', 1)}${E(72, 48, 6.500, '#ff5a3a', 1)}<path d="M50 58 Q60 66 70 58" fill="#3a0f1a" ${o} stroke-width="2.4"/>${tooth(52, 58, 5)}${tooth(62, 58, 5)}<path d="M54 90 h12 M54 98 h12" stroke="${D}" stroke-width="3"/>`; }
    else if (kind === 'brute') { top = 22; const goblin = /고블린|코볼트/.test(nm), big = /오우거|트롤|거인|미노타/.test(nm), cyc = /외눈/.test(nm), tusk = /오크|오우거|트롤|거인/.test(nm), bandit = /산적/.test(nm), horn = /미노타/.test(nm), liz = /리자드/.test(nm);
      g = `<g transform="${goblin ? 'translate(60 112) scale(.88) translate(-60 -112)' : ''}">${P('M92 88 L110 28 L120 34 L102 96Z', '#8a5a32')}${P('M104 30 Q116 14 124 32 Q114 40 104 30Z', '#7c869c')}${P('M34 74 Q30 112 60 114 Q90 112 86 74 Q60 66 34 74Z')}${bandit ? `<path d="M36 80 H84" stroke="#c0392b" stroke-width="8"/>` : `<path d="M50 78 Q60 92 70 78" fill="none" stroke="${D}" stroke-width="3"/>`}${P('M30 74 L18 100 L30 104 L38 86Z', K)}${P('M90 74 L102 98 L90 104 L82 86Z', K)}${goblin || liz ? '' : ''}${P(`M${goblin ? 6 : 24} 50 L${goblin ? -6 : 10} 38 L${goblin ? 32 : 34} 40Z`, K)}${P(`M${goblin ? 114 : 96} 50 L${goblin ? 126 : 110} 38 L${goblin ? 88 : 86} 40Z`, K)}${P('M28 52 Q26 22 60 22 Q94 22 92 52 Q92 72 60 74 Q28 72 28 52Z')}${horn ? `${P('M34 28 Q18 20 22 6 Q34 12 42 24Z', '#efe6c8')}${P('M86 28 Q102 20 98 6 Q86 12 78 24Z', '#efe6c8')}` : ''}${bandit ? `<path d="M30 46 H90 V58 H30Z" fill="#c0392b" ${o} stroke-width="2.4"/>` : ''}${cyc ? E(60, 46, 12, '#e0524a') : `${E(46, 48, 7, '#ffe36a')}${E(74, 48, 7, '#ffe36a')}`}<path d="M44 62 Q60 72 76 62" fill="#3a1520" ${o} stroke-width="2.600"/>${tusk ? `${tooth(46, 62, 6)}${tooth(68, 62, 6)}` : tooth(55, 64, 6)}${liz ? `<path d="M40 28 l4 -8 l4 8 M54 24 l6 -10 l6 10 M72 28 l4 -8 l4 8" fill="${D}" stroke="${INKM}" stroke-width="2"/>` : ''}${big ? `<path d="M40 40 l10 4 M80 40 l-10 4" stroke="${INKM}" stroke-width="3.400" stroke-linecap="round"/>` : ''}${stripes}</g>`; }
    else if (kind === 'beast') { top = 46; const bear = /곰/.test(nm), boar = /멧돼지/.test(nm), fox = /여우/.test(nm);
      g = `${P('M92 86 Q120 84 112 58 Q108 78 88 78Z', fox ? S : K)}${P('M30 98 h14 v14 q0 4 -4 4 h-8 q-4 0 -4 -4z M50 100 h14 v12 q0 4 -4 4 h-8 q-4 0 -4 -4z', K)}${P('M72 100 h14 v12 q0 4 -4 4 h-8 q-4 0 -4 -4z M92 96 h14 v16 q0 4 -4 4 h-8 q-4 0 -4 -4z', K)}${P('M40 80 Q40 56 72 56 Q106 58 104 86 Q100 106 70 106 Q40 106 40 80Z')}${stripes}${spots}${bear ? `<circle cx="22" cy="48" r="9" fill="${F}" ${o}/><circle cx="44" cy="44" r="9" fill="${F}" ${o}/>` : `${P('M20 52 L22 28 L38 46Z', K)}${P('M42 46 L52 26 L58 52Z', K)}`}${P('M16 68 Q14 44 36 44 Q58 46 56 72 Q54 90 34 90 Q16 90 16 68Z')}${P('M8 74 Q6 64 20 66 Q30 70 24 82 Q12 86 8 74Z', S)}<ellipse cx="9" cy="72" rx="3.400" ry="2.600" fill="${INKM}"/>${E(30, 62, 6, fox || /늑대|웨어/.test(nm) ? '#ffd34a' : INKM)}${boar ? `<path d="M14 80 Q6 92 14 94 M26 82 Q30 94 22 94" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M14 80 Q6 92 14 94 M26 82 Q30 94 22 94" fill="none" stroke="${INKM}" stroke-width="1.4"/>` : `${tooth(13, 82, 5)}${tooth(20, 82, 5)}`}`; }
    else { top = 56; const bun = /토끼/.test(nm);
      g = `<path d="M98 94 Q124 96 116 66" fill="none" stroke="${INKM}" stroke-width="8" stroke-linecap="round"/><path d="M98 94 Q124 96 116 66" fill="none" stroke="#e6b8aa" stroke-width="4" stroke-linecap="round"/>${P('M40 90 Q40 64 70 64 Q104 66 102 94 Q98 112 70 112 Q40 112 40 90Z')}${stripes}${spots}<ellipse cx="70" cy="100" rx="14" ry="10" fill="${S}"/>${P('M32 108 h14 v8 h-14z M62 110 h14 v6 h-14z', K)}${bun ? `${P('M26 56 Q18 20 30 18 Q40 22 38 56Z', K)}${P('M42 54 Q40 16 54 16 Q62 22 52 56Z', K)}` : `<circle cx="24" cy="54" r="10" fill="${F}" ${o}/><circle cx="24" cy="54" r="5" fill="#f1a9b3"/><circle cx="48" cy="52" r="10" fill="${F}" ${o}/><circle cx="48" cy="52" r="5" fill="#f1a9b3"/>`}${P('M12 78 Q10 56 34 56 Q58 58 56 80 Q52 98 32 98 Q14 98 12 78Z')}<circle cx="10" cy="82" r="4" fill="#f1a9b3" ${o} stroke-width="2.200"/>${E(30, 72, 6.500, '#e0404a')}<rect x="24" y="90" width="6" height="8" rx="1.500" fill="#fff" ${o} stroke-width="1.800"/><path d="M12 88 l-10 -2 M12 92 l-10 4" stroke="${INKM}" stroke-width="1.800" stroke-linecap="round"/>`; }
    // 보스: 오라 + 왕관
    const aura = boss ? `<ellipse cx="60" cy="86" rx="54" ry="34" fill="#ffcf5a" opacity=".22"/>` : '';
    const crown = boss ? `<path d="M44 ${top + 6} l-2 -14 l9 7 l9 -12 l9 12 l9 -7 l-2 14Z" fill="#f0c43a" stroke="${INKM}" stroke-width="2.600" stroke-linejoin="round"/><circle cx="60" cy="${top - 4}" r="2.400" fill="#e0524a"/>` : '';
    return `${defs}<ellipse cx="60" cy="116" rx="40" ry="5" fill="#000" opacity=".34"/>${aura}${g}${crown}`;
  }

  // name(몬스터 이름)을 주면 img/mon/ 의 그림 파일을 먼저 찾고, 없으면 체형별 기본 SVG를 쓴다 (assets.js)
  function monster(questId, cls, hue, name) {
    const A = global.Assets, known = name && A ? A.monKnown(name) : '';
    if (known) return `<img class="mon mon-img ${cls || ''}" src="${known}" alt="" style="filter:none">`;
    const hit = MON_RULES.find(([re]) => re.test(name || ''));
    const kind = hit ? hit[1] : (ART_FALLBACK[questId] || 'beast');
    return `<svg class="mon ${cls || ''}" ${name && A && A.monMaybe(name) ? `data-mon="${esc(name)}" ` : ''}viewBox="0 0 120 124" aria-hidden="true">${monsterArt(kind, name || questId)}</svg>`;
  }

  /* ---------- 길드 홀 배경 ---------- */
  function hall() {
    return `<div class="hall" aria-hidden="true"><div class="h-wall"></div><div class="h-arch"><i class="mu v"></i><i class="mu h1"></i><i class="mu h2"></i></div><div class="h-beam"></div><div class="h-pillar l"></div><div class="h-pillar r"></div>
      <div class="h-board"><i class="pn p1"></i><i class="pn p2"></i><i class="pn p3"></i></div><div class="h-banner bl"></div><div class="h-banner br"></div>
      <div class="h-lamp l1"></div><div class="h-lamp l2"></div><div class="h-shaft"></div><div class="h-counter"></div><div class="h-shelf"><i></i><i></i><i></i><i></i><i></i></div><div class="h-floor"></div><div class="h-rug"></div></div>`;
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
