/* ============================================================
   gear.js - 재료 / 장비 (기획서 24장)
   화면·저장을 모르는 순수 데이터와 계산. 장비는 모험가가 알아서 사고 입는다.
   ============================================================ */
(function (global) {
  'use strict';

  const GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
  const LV_REQ = [1, 11, 26, 41, 56, 71, 86];                 // 착용 가능 레벨 = 그 등급 의뢰의 시작 레벨
  const SLOTS = [['weapon', '무기'], ['armor', '방어구'], ['acc', '장신구']];
  // 품질 5단계: 능력치 배율 / 옵션 수 / 권장가 배율
  const QUALITY = [
    { name: '조잡', mult: 0.8, opts: 0, price: 0.6 }, { name: '보통', mult: 1.0, opts: 0, price: 1.0 },
    { name: '우수', mult: 1.15, opts: 1, price: 1.6 }, { name: '명품', mult: 1.35, opts: 2, price: 2.8 }, { name: '걸작', mult: 1.6, opts: 3, price: 5 },
  ];
  const BASE_PRICE = [100, 180, 320, 580, 1040, 1880, 3400];   // 보통 품질 권장가
  const MAT_PRICE = [4, 8, 14, 26, 48, 88, 160];               // 재료 매입 단가
  const CRAFT_MIN = [10, 20, 40, 80, 150, 240, 360];           // 제작 시간(분)
  const CRAFT_MATS = 6;                                        // 제작에 드는 재료 수 (같은 등급의 아무 재료)
  const CRAFT_FEE = (g) => Math.round(BASE_PRICE[g] * 0.22);   // 제작 수수료(금화)
  // 품질(%): 50%가 보통(능력치 배율 1.0). 낮으면 떨어지고 높으면 오른다. 제작 종류와는 상관없다.
  const QP_DEF = [20, 50, 72, 86, 96];                         // 예전 저장 데이터의 품질 단계 → 퍼센트
  const qpOf = (item) => (item.qp !== undefined ? item.qp : QP_DEF[item.q]);
  const tierOf = (qp) => (qp < 30 ? 0 : qp < 65 ? 1 : qp < 80 ? 2 : qp < 92 ? 3 : 4);   // 색·이름표용 단계
  const qMult = (qp) => (qp <= 50 ? 0.7 + 0.3 * (qp / 50) : 1.0 + 0.6 * ((qp - 50) / 50)); // 0%=0.7 · 50%=1.0 · 100%=1.6
  const qPrice = (qp) => Math.pow(qMult(qp), 3);                                          // 가격 배율
  const qOpts = (qp) => (qp >= 92 ? 3 : qp >= 80 ? 2 : qp >= 65 ? 1 : 0);                 // 붙는 옵션 수
  // 장비 종류: 등급마다 부위당 제작 5종(0~4) + 의뢰에서만 나오는 3종(5~7). s = 능력치 배분 [체력, 공격, 방어, 운, 속도]
  const GRADE_PFX = ['낡은', '철제', '강철', '미스릴', '용암', '비룡', '심연'];
  const TYPES = {
    weapon: [
      { n: '단검', s: [0, 0.45, 0, 0.2, 0.35] }, { n: '장검', s: [0, 0.65, 0, 0, 0.35] }, { n: '대검', s: [0.2, 0.8, 0, 0, 0] },
      { n: '활', s: [0, 0.5, 0, 0.3, 0.2] }, { n: '지팡이', s: [0.2, 0.55, 0, 0.25, 0] },
      { n: '쾌검', s: [0, 0.4, 0, 0.1, 0.5], drop: 1 }, { n: '파쇄도', s: [0, 0.9, 0, 0.1, 0], drop: 1 }, { n: '성광검', s: [0.25, 0.5, 0.25, 0, 0], drop: 1 },
    ],
    armor: [
      { n: '경갑', s: [0.2, 0, 0.3, 0, 0.5] }, { n: '사슬갑옷', s: [0.5, 0, 0.5, 0, 0] }, { n: '중갑', s: [0.2, 0, 0.8, 0, 0] },
      { n: '로브', s: [0.35, 0, 0.15, 0.5, 0] }, { n: '흉갑', s: [0.8, 0, 0.2, 0, 0] },
      { n: '인내갑', s: [0.6, 0, 0.3, 0.1, 0], drop: 1 }, { n: '질풍갑', s: [0.2, 0, 0.2, 0, 0.6], drop: 1 }, { n: '수호갑', s: [0.3, 0, 0.7, 0, 0], drop: 1 },
    ],
    acc: [
      { n: '목걸이', s: [0, 0, 0, 1, 0] }, { n: '반지', s: [0, 0.5, 0, 0.5, 0] }, { n: '귀걸이', s: [0, 0, 0, 0.5, 0.5] },
      { n: '팔찌', s: [0.4, 0, 0.4, 0.2, 0] }, { n: '부적', s: [0.2, 0.2, 0.2, 0.4, 0] },
      { n: '행운 인장', s: [0, 0.2, 0, 0.8, 0], drop: 1 }, { n: '투지 인장', s: [0.2, 0.5, 0, 0.3, 0], drop: 1 }, { n: '수호 인장', s: [0.3, 0, 0.5, 0.2, 0], drop: 1 },
    ],
  };
  const BONUS_RATE = 0.11; // 한 부위 = 그 등급 레벨대 Common 평균 스탯 총합의 약 11%
  const DEF_T = { weapon: 1, armor: 1, acc: 0 };   // 예전 저장 데이터의 장비(종류 없음)는 이 종류로 본다
  const DROP_MULT = 1.25, DROP_PRICE = 1.6;        // 의뢰 전용 장비만 능력치·가격 배율이 따로 있다 (제작 종류는 주 스탯만 다르다)
  const UNLOCK_LV = [0, 1, 3, 5, 7];               // 제작 종류 0~4가 열리는 대장간 레벨
  Object.keys(TYPES).forEach((sl) => TYPES[sl].forEach((ty, i) => { ty.p = ty.drop ? DROP_MULT : 1; }));
  const typeOf = (item) => TYPES[item.slot][item.t === undefined ? DEF_T[item.slot] : item.t];
  const SLOT_NAME = { weapon: '무기', armor: '방어구', acc: '장신구' };
  const STAT_LABEL = ['체력', '공격', '방어', '운', '속도'];
  const focus = (slot, t) => TYPES[slot][t].s.map((w, i) => [w, i]).filter((x) => x[0] >= 0.3).sort((a, b) => b[0] - a[0]).map((x) => STAT_LABEL[x[1]]).join('·');

  // 몬스터별 고유 소재 / 속성 (도감에 표시된다)
  const MONSTERS = {
    '들쥐':         { mat: '쥐 가죽',       attr: '땅',   grade: 0 }, '쥐왕':           { mat: '쥐왕의 이빨',   attr: '어둠', grade: 0, boss: true },
    '늑대':         { mat: '늑대 가죽',     attr: '바람', grade: 1 }, '우두머리 늑대':   { mat: '은빛 송곳니',   attr: '바람', grade: 1, boss: true },
    '고블린':       { mat: '고블린 귀',     attr: '땅',   grade: 2 }, '고블린 왕':       { mat: '왕의 왕관 조각', attr: '불',   grade: 2, boss: true },
    '오크':         { mat: '오크 뼈',       attr: '불',   grade: 3 }, '동굴 트롤':       { mat: '트롤의 피',     attr: '땅',   grade: 3, boss: true },
    '불꽃 정령':    { mat: '불꽃 결정',     attr: '불',   grade: 4 }, '용암 골렘':       { mat: '용암 핵',       attr: '불',   grade: 4, boss: true },
    '와이번':       { mat: '와이번 비늘',   attr: '바람', grade: 5 }, '고대 용':         { mat: '고대 용의 심장', attr: '불',   grade: 5, boss: true },
    '심연의 사도':  { mat: '심연의 파편',   attr: '어둠', grade: 6 }, '마왕':           { mat: '마왕의 뿔',     attr: '어둠', grade: 6, boss: true },
  };
  const MAT_INFO = {}; Object.keys(MONSTERS).forEach((m) => { MAT_INFO[MONSTERS[m].mat] = { grade: MONSTERS[m].grade, monster: m }; });

  const cls = (g) => global.Engine.QUEST_GRADES[GRADES[g]].level;
  // 장비가 주는 능력치 점수 [5]
  function bonusPts(item) {
    const total = BONUS_RATE * qMult(qpOf(item)) * global.Engine.totalPoints('Common', 55, cls(item.g)) * (1 + 0.1 * (item.plus || 0)) * typeOf(item).p;
    return typeOf(item).s.map((w) => total * w);
  }
  const price = (item) => Math.round(BASE_PRICE[item.g] * qPrice(qpOf(item)) * (typeOf(item).drop ? DROP_PRICE : 1));
  const sellValue = (item) => Math.round(price(item) * 0.5);
  const baseName = (item) => `${GRADE_PFX[item.g]} ${typeOf(item).n}`;
  const itemName = (item) => `${baseName(item)}${item.plus ? ' +' + item.plus : ''} (${qpOf(item)}%)`;
  const power = (item) => bonusPts(item).reduce((a, b) => a + b, 0) * (1 + 0.1 * item.opts.length);
  // 직업 선호 스탯과 맞는 정도 (구매·착용 선택에 쓴다)
  function fit(item, pref) {
    if (!pref) return 1;
    const b = bonusPts(item), tot = b.reduce((a, c) => a + c, 0) || 1;
    const i1 = global.Engine.STATS.indexOf(pref[0]), i2 = global.Engine.STATS.indexOf(pref[1]);
    return 1 + 0.6 * (b[i1] / tot) + 0.3 * (b[i2] / tot); // 모험가는 자기 직업이 중시하는 능력치를 올려 주는 장비를 좋아한다
  }
  const usable = (item, c) => c.level >= LV_REQ[item.g];
  const OPT_POOL = () => global.DATA_TRAITS.filter((t) => !t.ext).map((t) => t.name);

  // 제작 품질(%): 평균 50%, 대장간 레벨(bonusPct)이 높을수록 평균이 올라간다. 정규분포에 가깝게 흩어진다.
  function rollQuality(rng, bonusPct) {
    const z = (rng() + rng() + rng() + rng() - 2) * 1.73;  // 평균 0, 표준편차 약 1
    return Math.max(1, Math.min(100, Math.round(50 + (bonusPct || 0) * 0.5 + z * 17)));
  }
  function makeItem(id, slot, grade, qp, rng, t) {
    const pool = OPT_POOL(), opts = [];
    for (let i = 0; i < qOpts(qp); i++) { const rest = pool.filter((x) => !opts.includes(x)); opts.push(rest[Math.floor(rng() * rest.length)]); }
    return { id, slot, g: grade, q: tierOf(qp), qp, plus: 0, opts, t: t === undefined ? DEF_T[slot] : t };
  }

  /* ---------- 제작법 ---------- */
  // 제작법마다 필요한 재료와 개수가 정해져 있다 (같은 제작법은 늘 같은 재료). 채집물 1 + 몬스터 재료 1~2 + (고급) 보스 재료 1.
  const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const mul = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let RECIPES = null;
  function recipes() {
    if (RECIPES) return RECIPES;
    const M = global.Monsters, out = [];
    for (let g = 0; g < 7; g++) {
      const gather = M.GATHER[g], normal = M.NORMAL[g].slice(0, M.CORE).map((n) => MONSTERS[n].mat), boss = M.BOSS[g].slice(0, M.CORE_BOSS).map((n) => MONSTERS[n].mat);
      for (const [slot] of SLOTS) for (let t = 0; t < 5; t++) {
        const r = mul(hash(`${g}|${slot}|${t}`)), pick = (a, used) => { let x; do { x = a[Math.floor(r() * a.length)]; } while (used.includes(x)); used.push(x); return x; };
        const used = [], mats = [{ name: pick(gather, used), qty: 3 + (t >> 1) }, { name: pick(normal, used), qty: 2 + (t >= 2 ? 1 : 0) }];
        if (t >= 1) mats.push({ name: pick(normal, used), qty: 2 });
        if (t >= 3) mats.push({ name: pick(boss, used), qty: 1 + (t >= 4 ? 1 : 0) });
        out.push({ id: `${slot}:${g}:${t}`, slot, g, t, name: `${GRADE_PFX[g]} ${TYPES[slot][t].n}`, mats, unlock: UNLOCK_LV[t] });
      }
    }
    RECIPES = out; return out;
  }
  const recipeById = (id) => recipes().find((r) => r.id === id);

  global.Gear = { TYPES, typeOf, baseName, focus, recipes, recipeById, UNLOCK_LV, qpOf, tierOf, qMult, DROP_TYPES: [5, 6, 7], GRADE_PFX, GRADES, LV_REQ, SLOTS, SLOT_NAME, QUALITY, BASE_PRICE, MAT_PRICE, CRAFT_MIN, CRAFT_MATS, CRAFT_FEE, MONSTERS, MAT_INFO, STAT_LABEL,
    bonusPts, price, sellValue, itemName, power, fit, usable, rollQuality, makeItem };
})(typeof window !== 'undefined' ? window : globalThis);
