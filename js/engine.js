/* ============================================================
   engine.js - 새 전투 엔진 (기획서 14~24장 기준)
   화면·저장을 모르는 순수 계산 모듈. rng를 주입하면 결과가 재현된다.
   - 스탯 5종(체력·공격·방어·운·속도): 희귀도 총합을 랜덤 분배, 직업 선호 스탯 보너스
   - 속도는 기본 공격 간격만 바꾸고, 스킬은 별개의 쿨타임으로 추가 발동
   - 상태 효과, 속성 상성, 보스 스킬, 위기 판정(15%), 사망 판정
   데이터: DATA_CLASSES / DATA_UNIQUE / DATA_TRAITS (자동 생성 파일)
   ============================================================ */
(function (global) {
  'use strict';

  const STATS = ['체력', '공격', '방어', '운', '속도'];
  const GRADES = ['Common', 'Rare', 'Epic', 'Unique', 'Legendary'];
  const T0 = { Common: 50, Rare: 75, Epic: 120, Unique: 200, Legendary: 290 };
  const GROW = { Common: 5, Rare: 8, Epic: 14, Unique: 26, Legendary: 40 };
  const TALENT_MIN = { Common: 10, Rare: 30, Epic: 50, Unique: 70, Legendary: 90 };
  const MAX_LEVEL = 99;
  const CRISIS_RATIO = 0.15;
  const DISCORD_PER = 0.4, DISCORD_CAP = 0.8, DISCORD_HARM = 0.85; // 합이 안 맞을 확률: 3명 초과 1인당 +12%p, 파티 유대가 최고면 85% 감소
  const DEATH_BASE = 0.55, DEATH_PER = 0.12, DEATH_CAP = 0.95, DEATH_MIN = 0.05;
  const CAP_SEC = 1800; // 전투 시간 상한 30분 (넘으면 교착)
  const UNIQUE_BASE = 1.06; // 고유스킬 보유자: 전 능력치 +6%

  /* ---------- 의뢰 등급 (기획서 19-4) ---------- */
  // 재보정(2026.11.21 밤): 몬스터 공격 배율을 등급·의뢰 종류마다 따로 정했다. 기준 (맨몸, 최대 인원, 등급 맨 위 레벨의 무작위 파티):
  //  같은 등급 의뢰 성공률 F 94% → S 82%로 낮아지고, 한 단계 아래 등급 파티는 그보다 약 20%p 낮다. 같은 등급 장비를 입으면 거의 100%. (맨몸 기준은 2차로 1.35배 어렵게 올려 같은 등급 약 70~90%, 한 단계 아래 약 25~80%)
  const QUEST_GRADES = {
    F: { level: 10, hp: 900 }, E: { level: 25, hp: 880 }, D: { level: 40, hp: 3500 }, C: { level: 55, hp: 7200 },
    B: { level: 70, hp: 9100 }, A: { level: 85, hp: 14200 }, S: { level: 99, hp: 26500 },
  };
  const ATK = { // 몬스터 공격 배율 (유형별) — 3인 파티(적정 레벨, 장비 없음) 기준 승률 소탕 85% · 웨이브 65% · 보스 75%에 맞춤
    F: { sweep: 0.1508, wave: 0.1486, boss: 0.2036 },
    E: { sweep: 0.0902, wave: 0.1194, boss: 0.1583 },
    D: { sweep: 0.0988, wave: 0.135, boss: 0.1443 },
    C: { sweep: 0.0905, wave: 0.1166, boss: 0.0519 },
    B: { sweep: 0.0854, wave: 0.1128, boss: 0.0257 },
    A: { sweep: 0.0858, wave: 0.1152, boss: 0.0187 },
    S: { sweep: 0.0527, wave: 0.0997, boss: 0.006 },
  };
  const HPT = { // 몬스터 총 체력 배율 (유형별) — 전투 시간이 F 약 1분 ~ S 약 3분이 되도록 맞춤
    F: { sweep: 0.293, wave: 0.319, boss: 0.303 },
    E: { sweep: 0.380, wave: 0.452, boss: 0.391 },
    D: { sweep: 0.207, wave: 0.226, boss: 0.172 },
    C: { sweep: 0.157, wave: 0.139, boss: 0.100 },
    B: { sweep: 0.169, wave: 0.141, boss: 0.109 },
    A: { sweep: 0.091, wave: 0.102, boss: 0.061 },
    S: { sweep: 0.112, wave: 0.132, boss: 0.052 },
  };
  const atkOf = (grade, type) => ATK[grade][type];
  const QUEST_TYPES = { boss: { n: 1, conc: 1 }, sweep: { n: 12, conc: 3 }, wave: { n: 15, conc: 5 } }; // 마릿수, 동시 공격 수
  const LV_LO = { F: 1, E: 11, D: 26, C: 41, B: 56, A: 71, S: 86 };
  let LV_COMPRESS = 0.25;


  /* ---------- 속성 상성 (기획서 21장) ---------- */
  const BEATS = { 물: '불', 불: '바람', 바람: '땅', 땅: '물', 빛: '어둠', 어둠: '빛' };
  const beats = (a, b) => BEATS[a] === b;
  // 공격 배율: 내가 강하면 1.3, 몬스터가 강하거나 같으면 0.85, 그 외 1.0. 부속성은 이득(1.3→1.15)만 적용.
  function attackRel(me, mon) {
    const rel = (attr, sub) => (beats(attr, mon) ? (sub ? 1.15 : 1.3) : (beats(mon, attr) || attr === mon) ? (sub ? 1 : 0.85) : 1);
    let best = rel(me.attrMain, false);
    if (me.attrSub) best = Math.max(best, rel(me.attrSub, true));
    return best;
  }
  // 방어 배율: 몬스터 공격 속성이 내 주속성에 강하면 1.2, 내가 강하면 0.85
  function defendRel(me, mon) {
    return beats(mon, me.attrMain) ? 1.2 : beats(me.attrMain, mon) ? 0.85 : 1;
  }

  /* ---------- 스탯 / 성장 ---------- */
  function totalPoints(rarity, talent, level, lvStat) {
    const g = GROW[rarity] * (0.6 + 0.8 * talent / 100) * (1 + (lvStat || 0));
    return T0[rarity] + g * (Math.max(1, level) - 1);
  }
  // 임의 비율 분배(균등 랜덤, 감마 분포): 가중치 5개 (합 1)
  function randomSplit(rng) {
    const w = [0, 0, 0, 0, 0].map(() => -Math.log(1 - rng()));
    const s = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / s);
  }
  function rollTalent(rarity, rng) {
    return TALENT_MIN[rarity] + Math.floor(rng() * (100 - TALENT_MIN[rarity] + 1));
  }
  function pathOf(root, level, pick) {
    // 레벨 구간(30/60/90)에 따라 전직 경로를 따라간 직업 이름 목록. pick(children, tier)로 선택(없으면 첫째)
    const C = global.DATA_CLASSES;
    const out = [root];
    const tiers = level >= 90 ? 3 : level >= 60 ? 2 : level >= 30 ? 1 : 0;
    let cur = root;
    for (let t = 1; t <= tiers; t++) {
      const kids = C[cur].children;
      cur = pick ? pick(kids, t) : kids[0];
      out.push(cur);
    }
    return out;
  }
  const tierOfLevel = (level) => (level >= 90 ? 3 : level >= 60 ? 2 : level >= 30 ? 1 : 0);

  /* ---------- 효과 모으기 ---------- */
  const SUM_KEYS = ['atk', 'def', 'hp', 'spd', 'luk', 'critCh', 'critDmg', 'dmgBoss', 'dmgMob', 'dmgWeak', 'reduce', 'regen', 'crisisHeal',
    'startShield', 'killHeal', 'steal', 'cdCut', 'eSpd', 'eAtk', 'eDef', 'poison', 'taken', 'berserk', 'party3Atk', 'crisisAtk', 'allyCrisisAtk', 'allyCrisisDef',
    'allAttrAtk', 'subAttrBoost', 'deathMod', 'healTaken', 'window', 'expMul', 'goldMul', 'dropMul', 'trainExp', 'fame', 'lvStat', 'injury',
    'retreatInjury', 'survInjury', 'wipeDeath', 'offline', 'panic', 'bondGain', 'bondSyn', 'bondCap', 'bondDeath', 'griefCut', 'allDiffAttr'];
  const LIST_KEYS = ['lowHp', 'opening', 'openTime', 'execDmg', 'killBuff', 'combo', 'smallParty', 'bigParty', 'partyLow', 'attrAtk', 'fullHp'];
  const PARTY_KEYS = ['atk', 'def', 'spd', 'hp', 'critCh', 'cd', 'regen', 'death', 'crisisDeath', 'expMul', 'goldMul', 'fame'];

  function emptyMods() {
    const m = { party: {}, lists: {}, startCharge: 0, crisisThr: 0, window: 0, resistHalf: false, info: [], lateBloomer: false, guild: {} };
    SUM_KEYS.forEach((k) => { m[k] = 0; });
    LIST_KEYS.forEach((k) => { m.lists[k] = []; });
    return m;
  }
  function addMods(acc, src) {
    if (!src) return;
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (v === null || v === undefined) continue;
      if (k === 'all') { ['atk', 'def', 'hp', 'spd', 'luk'].forEach((s) => { acc[s] += v; }); }
      else if (k === 'party') { for (const p of Object.keys(v)) if (v[p] != null) acc.party[p] = (acc.party[p] || 0) + v[p]; }
      else if (k === 'guild') { for (const p of Object.keys(v)) if (v[p] != null) acc.guild[p] = (acc.guild[p] || 0) + v[p]; }
      else if (k === 'startCharge') acc.startCharge = Math.max(acc.startCharge, v);
      else if (k === 'crisisThr') acc.crisisThr = acc.crisisThr ? Math.min(acc.crisisThr, v) : v;
      else if (k === 'resistHalf') acc.resistHalf = acc.resistHalf || !!v;
      else if (k === 'lateBloomer') acc.lateBloomer = true;
      else if (k === 'info') acc.info.push(v);
      else if (k === 'alertMin') acc.alertMin = v;
      else if (LIST_KEYS.indexOf(k) >= 0) acc.lists[k].push(v);
      else if (SUM_KEYS.indexOf(k) >= 0) acc[k] += v;
    }
  }

  // 한 모험가의 모든 패시브 효과(특성·직업 경로 패시브·고유스킬)
  function collectMods(c) {
    const m = emptyMods();
    const T = global.DATA_TRAITS, C = global.DATA_CLASSES, U = global.DATA_UNIQUE;
    (c.traits || []).forEach((name) => {
      const t = T.find((x) => x.name === name);
      if (t && !t.ext) addMods(m, t.mods);
    });
    const path = c.path || [];
    const actives = [];
    path.forEach((cn) => {
      const cls = C[cn];
      if (!cls) return;
      cls.skills.forEach((s) => {
        if (s.ext) return;
        if (s.kind === 'P') addMods(m, s.mods); else if (s.act && s.act.t !== 'ext') actives.push({ name: s.name, cd: s.cd, act: s.act, src: 'class' });
      });
    });
    if (c.unique !== null && c.unique !== undefined && U[c.unique]) {
      const u = U[c.unique];
      if (!u.ext) {
        addMods(m, u.mods); if (u.kind !== 'P' && u.act && u.act.t !== 'ext') actives.push({ name: u.name, cd: u.cd, act: u.act, src: 'unique' });
      }
    }
    return { mods: m, actives };
  }

  /* ---------- 전투원 만들기 ---------- */
  function statPoints(c, mods) {
    const level = c.level || 1;
    const total = totalPoints(c.rarity, c.talent, level, mods ? mods.lvStat : 0);
    const split = c.split || [0.2, 0.2, 0.2, 0.2, 0.2];
    const pts = split.map((w) => Math.max(1, total * w));
    // 선호 스탯 보너스 (주 +20%, 부 +10%) - 1차 이상 직업의 선호를 우선
    const C = global.DATA_CLASSES;
    let pref = null;
    (c.path || []).forEach((cn) => { if (C[cn] && C[cn].pref) pref = C[cn].pref; });
    if (pref) {
      const i1 = STATS.indexOf(pref[0]), i2 = STATS.indexOf(pref[1]);
      if (i1 >= 0) pts[i1] *= 1.2;
      if (i2 >= 0) pts[i2] *= 1.1;
    }
    if (c.unique !== null && c.unique !== undefined) for (let i = 0; i < 5; i++) pts[i] *= UNIQUE_BASE;
    if (c.gear) for (let i = 0; i < 5; i++) pts[i] += c.gear[i] || 0; // 장비 보너스는 마지막에 더한다
    return pts;
  }
  // 직업별 기본 공격 방식: hits=한 번에 때리는 횟수(합계 배율 total), targets=동시에 맞는 몬스터 수(각각 per 배율)
  const ATK_STYLE = {
    '궁수': { hits: 2, total: 1.2 }, '도적': { hits: 3, total: 1.25 }, '무투가': { hits: 3, total: 1.3 },
    '마법사': { targets: 3, per: 0.55 }, '광전사': { targets: 2, per: 0.7 }, '검성': { hits: 2, total: 1.2 },
  };
  const styleOf = (path) => { const p = path || []; for (let i = p.length - 1; i >= 0; i--) if (ATK_STYLE[p[i]]) return ATK_STYLE[p[i]]; return null; };
  const baseInterval = (spd) => 3 / (1 + Math.sqrt(spd) / 10);
  // 행동 타임라인: 한 번 행동하면 다음 차례까지 기다리고, 속도가 높을수록 그 기다림이 짧다.
  // 공격 간격이 TEMPO배 길어진 만큼 한 번의 공격(피해)은 TEMPO배 묵직하다 → 초당 피해와 전투 시간은 그대로, 한 턴 한 턴만 느려지고 굵어진다.
  const TEMPO = 2.1;
  const HIT_P = 2.1, HIT_M = 2.1; // 아군·몬스터 한 방의 굵기 (균형을 맞추는 값)
  const heroInterval = (spd) => 6.5 / (1 + spd / 50); // 속도 1 → 6.4초 · 20 → 4.6초 · 75 → 2.6초 · 130 → 1.8초
  const HIT_GAP = 0.32; // 다단 히트 사이 간격(초)
  const critChance = (luk) => Math.min(0.6, luk / (luk + 400));

  function makeActor(c, id) {
    const { mods, actives } = collectMods(c);
    const pts = statPoints(c, mods);
    const mul = (k) => 1 + mods[k];
    const hpP = pts[0] * mul('hp'), atkP = pts[1] * mul('atk'), defP = pts[2] * mul('def'), lukP = pts[3] * mul('luk'), spdP = pts[4] * mul('spd');
    return {
      id: id !== undefined ? id : c.id, ref: c, side: 'p', mods, attrMain: c.attrMain || '불', attrSub: c.attrSub || null,
      hpPts: hpP, atkBase: atkP * 3, defBase: defP * 2, lukP, spdP,
      maxHp: 50 + hpP * 12, hp: 50 + hpP * 12, iv: heroInterval(spdP),
      style: styleOf(c.path), actives, buffs: [], guard: null, shield: 0, shieldUntil: 0, state: 'fit', crisis: false, damage: 0, kills: 0, crisisAt: null, downAt: null,
      actions: 0, crisisHealUsed: false, comboTarget: null, comboN: 0,
    };
  }

  /* ---------- 의뢰(몬스터) 만들기 ---------- */
  function makeQuest(grade, type, rng, opts) {
    opts = opts || {};
    const g = QUEST_GRADES[grade], ty = QUEST_TYPES[type];
    const L = opts.level || g.level;
    const Leff = (opts.level && !opts.noCompress) ? Math.round(LV_LO[grade] + (L - LV_LO[grade]) * LV_COMPRESS) : L; // 같은 등급 안에서는 레벨이 달라도 난이도 차이가 크지 않게
    const P = totalPoints('Common', 55, Leff) / 5; // 그 레벨 Common 평균 스탯 1개분
    const nMon = opts.n || ty.n;
    const hpTotal = (opts.hpTotal || P * g.hp * HPT[grade][type]) * (opts.hpMul || 1);
    const atkMul = opts.atk || atkOf(grade, type); // 튜토리얼 등은 절대값을 직접 넘긴다
    const attr = opts.attr || ['불', '물', '바람', '땅', '빛', '어둠'][Math.floor(rng() * 6)];
    const mons = [];
    for (let i = 0; i < nMon; i++) {
      const a = opts.mixAttr ? ['불', '물', '바람', '땅', '빛', '어둠'][Math.floor(rng() * 6)] : attr;
      mons.push({ id: 'm' + i, side: 'm', hp: hpTotal / nMon, maxHp: hpTotal / nMon, atk: P * 3 * atkMul, def: P * 2, iv: baseInterval(P * (type === 'boss' ? 1.3 : 1)) * TEMPO,
        attr: a, boss: type === 'boss', debuffs: [], dots: [], state: 'fit' });
    }
    return { grade, type, level: L, P, atkMul, safe: !!opts.safe, attr, monsters: mons, conc: ty.conc, boss: type === 'boss', bossAtk: P * 3 * atkMul };
  }

  /* ---------- 전투 시뮬레이션 ---------- */
  // opts: record(이벤트 기록) / stop(첫 위기에서 멈춤)
  //       tweaks({id:{atk,def,death}}) / forkRng(마지막 결정 이후의 난수를 갈아 끼움: 위험 예측용)
  function simulate(chars, quest, rng0, opts) {
    opts = opts || {};
    let R = rng0;
    const rng = () => R();
    const party = chars.map((c, i) => makeActor(c, c.id !== undefined ? c.id : 'p' + i));
    party.forEach((a) => {
      const tw = opts.tweaks && opts.tweaks[a.id];
      if (tw) { a.atkBase *= tw.atk || 1; a.defBase *= tw.def || 1; a.twDeath = tw.death || 0; if (typeof tw.hp === 'number' && tw.hp < 1) a.hpStart = Math.max(0.03, tw.hp); }
    });
    // 파티 효과 합산
    const pm = {};
    PARTY_KEYS.forEach((k) => { pm[k] = 0; });
    party.forEach((a) => { PARTY_KEYS.forEach((k) => { pm[k] += a.mods.party[k] || 0; }); });
    let eSpd = 0, eAtk = 0, eDef = 0;
    party.forEach((a) => { eSpd += a.mods.eSpd; eAtk += a.mods.eAtk; eDef += a.mods.eDef; });
    const attrs = party.map((a) => a.attrMain);
    const allDiff = new Set(attrs).size === party.length && party.length >= 2;
    // 파티 효과를 각 전투원에 반영
    party.forEach((a) => {
      if (pm.atk) a.atkBase *= 1 + pm.atk;
      if (pm.def) a.defBase *= 1 + pm.def;
      if (pm.spd) { a.spdP *= 1 + pm.spd; a.iv = heroInterval(a.spdP); }
      if (pm.hp) { a.maxHp = 50 + a.hpPts * (1 + pm.hp) * 12; a.hp = a.maxHp; }
      if (allDiff && a.mods.allDiffAttr) { const f = 1 + a.mods.allDiffAttr; a.atkBase *= f; a.defBase *= f; }
      a.critCh = Math.min(0.75, critChance(a.lukP) + a.mods.critCh + (pm.critCh || 0));
      a.critDmg = 1.5 + a.mods.critDmg;
      a.cdScale = 1 - Math.min(0.5, a.mods.cdCut + (pm.cd || 0));
      a.regenPct = a.mods.regen + (pm.regen || 0);
      a.crisisThr = a.mods.crisisThr || CRISIS_RATIO;
      a.deathMod = a.mods.deathMod + (pm.death || 0);
      // 시작 보호막
      if (a.mods.startShield) { a.shield = a.maxHp * a.mods.startShield; a.shieldUntil = 10; }
      if (a.mods.berserk) { a.defBase *= 1 - 0.1; }
      if (a.hpStart) a.hp = Math.max(1, a.maxHp * a.hpStart);
    });
    // 치명상 버팀 확률: 개인 효과 + 파티 효과 + 다른 파티원의 효과(bondDeath), 전투당 1회
    party.forEach((a) => {
      const bond = party.reduce((s, p) => s + (p !== a ? p.mods.bondDeath || 0 : 0), 0);
      a.endure = Math.min(0.6, 2 * ((a.deathMod || 0) + (a.twDeath || 0) + bond));
      a.endureUsed = false;
    });
    // 전투 시작 상태: 모든 전투원이 자기 속도에 맞는 첫 턴(간격의 절반)부터 시작한다 → 빠른 쪽이 먼저 때리고, 이후 속도에 따라 번갈아 턴이 돈다
    const heap0 = [];
    const mons0 = quest.monsters;
    party.forEach((a, i) => pushTo(heap0, a.iv * 0.5 + i * 0.001, 'p', i));
    for (let k = 0; k < quest.conc; k++) pushTo(heap0, mons0[0].iv * (0.5 + k / quest.conc) + 0.0005 + k * 0.001, 'm', k); // 몬스터도 한 마리씩 차례로 때린다
    if (quest.boss) { pushTo(heap0, 20, 'b1'); pushTo(heap0, 30, 'b2'); }
    pushTo(heap0, 8 + rng() * 10, 'x'); // 전투 중 돌발 사건 (승률이 출렁이는 요소)
    // 합이 안 맞는 일: 파티가 3명을 넘으면 사람이 늘수록 호흡이 엇갈릴 수 있다. 파티원끼리 유대가 깊을수록(harm 0~1) 덜하다.
    const harmAvg = party.reduce((s, a) => s + ((opts.tweaks && opts.tweaks[a.id] && opts.tweaks[a.id].harm) || 0), 0) / Math.max(1, party.length);
    quest.discordP = Math.min(DISCORD_CAP, DISCORD_PER * Math.max(0, party.length - 3)) * (1 - DISCORD_HARM * harmAvg);
    if (party.length > 3 && !quest.safe) pushTo(heap0, 8 + rng() * 6, 'h');
    party.forEach((a, i) => {
      a.actives.forEach((s, j) => {
        s.cdEff = Math.max(3, s.cd * a.cdScale);
        pushTo(heap0, s.cdEff * (1 - Math.max(0.5, a.mods.startCharge || 0.5)), 's', i, j);
      });
      if (a.regenPct) pushTo(heap0, 30, 'r', i);
    });
    return exec({ party, quest, heap: heap0, eSpd, eAtk, eDef }, rng0, opts);
  }

  function pushTo(heap, t, kind, i, j) {
    const e = { t, kind, i, j };
    let lo = 0, hi = heap.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (heap[mid].t <= t) lo = mid + 1; else hi = mid; }
    heap.splice(lo, 0, e);
  }

  // 전투 진행: S({party, quest, heap, eSpd, eAtk, eDef})는 통째로 복사해 이어서 굴릴 수 있다 (승률 예측용)
  function exec(S, rng0, opts) {
    opts = opts || {};
    let R = rng0;
    const rng = () => R();
    const { party, quest, heap, eSpd, eAtk, eDef } = S;
    const mons = quest.monsters;
    const eventsOut = opts.record ? [] : null;
    const log = (t, k, d) => { if (eventsOut) eventsOut.push(Object.assign({ t: Math.round(t * 100) / 100, k }, d)); };
    const push = (t, kind, i, j) => pushTo(heap, t, kind, i, j);

    // 보조 함수
    const alive = () => party.filter((a) => a.state === 'fit');
    const liveMons = () => mons.filter((m) => m.hp > 0);
    const activeMons = () => liveMons().slice(0, quest.conc);
    const lowestMon = () => { const l = liveMons(); return l.length ? l.reduce((b, m) => (m.hp < b.hp ? m : b)) : null; };
    const buffVal = (a, stat, t) => a.buffs.filter((b) => b.stat === stat && b.until > t).reduce((s, b) => Math.max(s, b.p), 0);
    const debuffOf = (m, stat, t) => m.debuffs.filter((d) => d.stat === stat && d.until > t).reduce((s, d) => Math.max(s, d.p), 0);

    function atkValue(a, mon, t, isSkill) {
      let atk = a.atkBase * (1 + buffVal(a, 'atk', t));
      const hpR = a.hp / a.maxHp;
      let mult = 1;
      a.mods.lists.lowHp.forEach((x) => { if (hpR <= x.thr) atk *= 1 + x.atk; });
      if (a.mods.berserk) atk *= 1 + a.mods.berserk * (1 - hpR);
      a.mods.lists.fullHp.forEach((x) => { if (hpR >= 0.999) { if (x.all) atk *= 1 + x.all; } });
      if (a.mods.crisisAtk && a.crisis) atk *= 1 + a.mods.crisisAtk;
      if (a.mods.allyCrisisAtk && party.some((p) => p !== a && p.crisis && p.state === 'fit')) atk *= 1 + a.mods.allyCrisisAtk;
      if (a.mods.party3Atk && party.length >= 3) atk *= 1 + a.mods.party3Atk;
      a.mods.lists.smallParty.forEach((x) => { if (party.length <= x.max) atk *= 1 + x.atk; });
      a.mods.lists.bigParty.forEach((x) => { if (party.length >= x.min) atk *= 1 + x.all; });
      a.mods.lists.partyLow.forEach(() => {});
      // 피해 배율
      const rel = attackRel(a, mon.attr);
      mult *= rel;
      if (rel > 1 && a.mods.dmgWeak) mult *= 1 + a.mods.dmgWeak;
      if (rel < 1 && a.mods.resistHalf) mult *= 1 + (1 - rel) / 2 / rel;
      if (mon.boss) mult *= 1 + a.mods.dmgBoss; else mult *= 1 + a.mods.dmgMob;
      a.mods.lists.attrAtk.forEach((x) => { if (x.attr === a.attrMain) mult *= 1 + x.v; });
      if (a.mods.allAttrAtk) mult *= 1 + a.mods.allAttrAtk;
      a.mods.lists.opening.forEach((x) => { if (x.n && a.actions < x.n) mult *= 1 + x.dmg; });
      a.mods.lists.openTime.forEach((x) => { if (x.dmg && t < x.t) mult *= 1 + x.dmg; });
      a.mods.lists.execDmg.forEach((x) => { if (mon.hp / mon.maxHp <= x.thr) mult *= 1 + x.dmg; });
      a.mods.lists.combo.forEach((x) => { if (a.comboTarget === mon.id) mult *= 1 + Math.min(x.max, x.step * a.comboN); });
      const D = mon.def * Math.max(0.1, 1 - debuffOf(mon, 'def', t) + eDef);
      const A = atk * mult;
      return A * A / (A + Math.max(1, D));
    }
    function hitMon(a, mon, amount, t, leech, quiet) {
      if (mon.hp <= 0) return;
      const dealt = Math.min(mon.hp, amount);
      mon.hp -= amount; a.damage += dealt;
      if (!quiet) log(t, 'dmg', { by: a.id, mon: mon.id, d: Math.round(amount), crit: a.fxCrit ? 1 : 0, sk: a.fxSkill ? 1 : 0 });
      if (a.mods.steal) heal(a, dealt * a.mods.steal, t);
      if (leech) heal(a, dealt * leech, t);
      if (mon.hp <= 0) {
        mon.hp = 0; mon.state = 'dead'; a.kills++;
        log(t, 'kill', { by: a.id, mon: mon.id });
        if (a.mods.killHeal) heal(a, a.maxHp * a.mods.killHeal, t);
        a.mods.lists.killBuff.forEach((x) => a.buffs.push({ stat: 'spd', p: x.spd, until: t + x.t }));
      }
    }
    function heal(a, amount, t) {
      if (a.state !== 'fit') return;
      const before = a.hp;
      a.hp = Math.min(a.maxHp, a.hp + amount * (1 + (a.mods.healTaken || 0)));
      if (a.hp - before >= 1) log(t, 'heal', { id: a.id, d: Math.round(a.hp - before) });
      if (a.crisis && a.hp >= a.maxHp * a.crisisThr * 1.0001) { a.crisis = false; log(t, 'crisisClear', { id: a.id }); }
    }
    function takeHit(a, amount, t, from) {
      if (a.state !== 'fit') return 0;
      const hp0 = a.hp;
      let x = amount;
      const hpR = a.hp / a.maxHp;
      if (a.guard && a.guard.until > t) x *= 1 - a.guard.p;
      x *= 1 - a.mods.reduce + a.mods.taken;
      a.mods.lists.fullHp.forEach((f) => { if (hpR >= 0.999 && f.reduce) x *= 1 - f.reduce; });
      if (a.shield > 0 && a.shieldUntil > t) { const ab = Math.min(a.shield, x); a.shield -= ab; x -= ab; }
      a.hp -= x;
      log(t, 'hurt', { id: a.id, d: Math.round(x), by: from });
      if (a.hp <= 0 && a.endure > 0 && !a.endureUsed) {
        a.endureUsed = true;
        if (rng() < a.endure) { a.hp = Math.max(1, a.maxHp * 0.05); if (!a.crisis) { a.crisis = true; if (a.crisisAt === null) a.crisisAt = t; log(t, 'crisis', { id: a.id }); } log(t, 'endure', { id: a.id }); return; }
      }
      if (a.hp <= 0) {
        a.hp = 0; a.state = 'down'; a.downAt = t; a.crisis = true; log(t, 'down', { id: a.id });
        return;
      }
      if (!a.crisis && a.hp < a.maxHp * a.crisisThr) {
        a.crisis = true; if (a.crisisAt === null) a.crisisAt = t; log(t, 'crisis', { id: a.id });
        if (a.mods.crisisHeal && !a.crisisHealUsed) { a.crisisHealUsed = true; heal(a, a.maxHp * a.mods.crisisHeal, t); }
      }
    }
    const monAttack = (m, t, mult, target, sc) => {
      const tgt = target || (() => { const al = alive(); return al.length ? al[Math.floor(rng() * al.length)] : null; })();
      if (!tgt) return;
      const A = m.atk * mult * Math.max(0.1, 1 - debuffOf(m, 'atk', t) + eAtk) * defendRel(tgt, m.attr) * (quest.boost && quest.boost.until > t ? 1 + quest.boost.p : 1);
      const D = tgt.defBase * (1 + buffVal(tgt, 'def', t)) * (tgt.mods.allyCrisisDef && party.some((p) => p !== tgt && p.crisis && p.state === 'fit') ? 1 + tgt.mods.allyCrisisDef : 1);
      log(t, 'matk', { mon: m.id, tgt: tgt.id, big: mult > 1.5 ? 1 : 0 });
      takeHit(tgt, A * A / (A + Math.max(1, D)) * (sc || 1), t, m.id);
    };

    let t = 0, outcome = null, lastT = 0;
    const probes = opts.probeEvery ? [] : null; let nextProbe = 0;
    const takeProbe = (tt) => probes.push({ t: tt, S: structuredClone({ party, quest, heap, eSpd, eAtk, eDef }) });
    const snaps = opts.snapEvery ? [] : null; let nextSnap = 0;
    const snap = (tt) => snaps.push({ t: tt, p: party.map((a) => [Math.max(0, Math.round(a.hp)), Math.round(a.maxHp), a.state, a.crisis ? 1 : 0]), m: mons.map((m) => Math.max(0, m.hp)) });
    let armed = true, crisisIds = [];
    // 위기 체크포인트: 새 위기가 생기면 (stop일 때) 멈춘다
    function checkpoint() {
      if (!armed || !alive().some((a) => a.crisis)) return false;
      if (opts.stop) { crisisIds = alive().filter((a) => a.crisis).map((a) => a.id); return true; }
      armed = false; if (opts.forkRng) R = opts.forkRng; return false;
    }
    const dotTick = (m, d, tt) => {
      if (m.hp <= 0) return;
      const a = d.src;
      const dm = d.dmg;
      hitMon(a, m, dm, tt, 0, true);
    };
    while (heap.length) {
      const ev = heap[0];
      t = ev.t;
      while (snaps && nextSnap < t && nextSnap <= CAP_SEC) { snap(nextSnap); nextSnap += opts.snapEvery; } // 사건 사이에는 상태가 변하지 않는다
      while (probes && nextProbe < t && nextProbe <= CAP_SEC) { takeProbe(nextProbe); nextProbe += opts.probeEvery * (nextProbe >= 300 ? 4 : 1); }
      if (t > (opts.maxT || CAP_SEC)) { outcome = 'stalemate'; break; }
      if (!alive().length) { outcome = party.some((a) => a.state === 'down') ? 'wipe' : 'retreat'; t = lastT; break; }
      if (!liveMons().length) { outcome = 'win'; t = lastT; break; }
      if (checkpoint()) { outcome = 'crisis'; t = lastT; break; }
      heap.shift(); lastT = t;
      if (ev.kind === 'p') {
        const a = party[ev.i];
        if (a.state !== 'fit') continue;
        const mon = lowestMon(); if (!mon) continue;
        const st = a.style;
        const mark = eventsOut ? eventsOut.length : 0;
        if (st && st.targets) { // 전체(다수) 공격: 체력이 낮은 몬스터부터 여러 마리를 동시에
          const tg = liveMons().sort((p, q) => p.hp - q.hp).slice(0, st.targets);
          tg.forEach((m, k) => {
            let x = atkValue(a, m, t) * st.per * HIT_P; const isCrit = rng() < a.critCh; if (isCrit) x *= a.critDmg;
            if (k === 0) log(t, 'atk', { by: a.id, mon: m.id, crit: isCrit ? 1 : 0, a0: t });
            a.fxCrit = isCrit; hitMon(a, m, x, t); a.fxCrit = false;
          });
          a.comboTarget = mon.id;
        } else {
          const n = st && st.hits ? st.hits : 1, per = st && st.hits ? st.total / st.hits : 1;
          for (let h = 0; h < n; h++) { // 다단 히트: 같은 대상에게 짧은 간격으로 여러 번
            const m = h === 0 ? mon : lowestMon(); if (!m) break;
            let x = atkValue(a, m, t) * per * HIT_P; const isCrit = rng() < a.critCh; if (isCrit) x *= a.critDmg;
            if (a.comboTarget === m.id) a.comboN++; else { a.comboTarget = m.id; a.comboN = 0; }
            const th = t + h * HIT_GAP;
            log(th, 'atk', { by: a.id, mon: m.id, crit: isCrit ? 1 : 0, a0: t });
            a.fxCrit = isCrit; hitMon(a, m, x, th); a.fxCrit = false;
          }
        }
        a.actions++;
        let spdMul = 1 + buffVal(a, 'spd', t);
        a.mods.lists.openTime.forEach((o) => { if (o.spd && t < o.t) spdMul += o.spd; });
        a.mods.lists.fullHp.forEach((f) => { if (a.hp >= a.maxHp * 0.999 && f.spd) spdMul += f.spd; });
        a.mods.lists.partyLow.forEach((pl) => { if (party.reduce((s, q) => s + q.hp, 0) / party.reduce((s, q) => s + q.maxHp, 0) <= pl.thr) spdMul += pl.spd; });
        const nxT = t + a.iv / Math.max(0.3, spdMul); // 다음 차례가 오는 때 (속도가 빠를수록 가깝다)
        if (eventsOut) for (let q = mark; q < eventsOut.length; q++) if (eventsOut[q].k === 'atk' && eventsOut[q].by === a.id) eventsOut[q].nx = Math.round(nxT * 100) / 100;
        push(nxT, 'p', ev.i);
      } else if (ev.kind === 'm') {
        const act = activeMons();
        const m = act[ev.i];
        if (m) monAttack(m, t, 1, null, HIT_M);
        push(t + mons[0].iv / Math.max(0.3, 1 + eSpd), 'm', ev.i);
      } else if (ev.kind === 'b1') {
        const m = liveMons()[0]; if (m) monAttack(m, t, 2.5);
        push(t + 20, 'b1'); log(t, 'bossSkill', { n: 1 });
      } else if (ev.kind === 'b2') {
        const m = liveMons()[0];
        if (m) alive().forEach((a) => monAttack(m, t, 1.2, a));
        push(t + 30, 'b2'); log(t, 'bossSkill', { n: 2 });
      } else if (ev.kind === 'x') {
        // 돌발 사건: 좋은 일 3가지, 나쁜 일 3가지 중 하나 (운에 따라 전세가 뒤집힌다)
        const al = alive();
        if (al.length && liveMons().length) {
          const k = quest.safe ? [1, 3, 4][Math.floor(rng() * 3)] : Math.floor(rng() * 6); // 연습 의뢰는 좋은 일만 일어난다
          if (k === 0) { quest.boost = { p: 0.5, until: t + 12 }; log(t, 'swing', { name: '몬스터가 격분했다! (공격 +50%)', good: 0 }); }
          else if (k === 1) { quest.boost = { p: -0.35, until: t + 8 }; log(t, 'swing', { name: '몬스터가 주춤한다! (공격 -35%)', good: 1 }); }
          else if (k === 2) { const v = al[Math.floor(rng() * al.length)]; log(t, 'swing', { name: '함정에 걸렸다!', good: 0, id: v.id }); takeHit(v, v.maxHp * 0.33, t, 'trap'); }
          else if (k === 3) { al.forEach((q) => heal(q, q.maxHp * 0.15, t)); log(t, 'swing', { name: '행운의 물약! 파티 체력 회복', good: 1 }); }
          else if (k === 4) { al.forEach((q) => q.buffs.push({ stat: 'atk', p: 0.25, until: t + 10 })); log(t, 'swing', { name: '투지가 불타오른다! (공격 +25%)', good: 1 }); }
          else { const m2 = lowestMon(); if (m2) { m2.hp = Math.min(m2.maxHp, m2.hp + m2.maxHp * 0.5); log(t, 'swing', { name: '몬스터가 상처를 회복했다!', good: 0 }); } }
        }
        push(t + 12 + rng() * 14, 'x');
      } else if (ev.kind === 'h') {
        const al = alive();
        if (al.length > 1 && liveMons().length) {
          if (rng() < (quest.discordP || 0)) {
            if (rng() < 0.6) { // 아군 오사: 서로 엉켜 동료를 다치게 한다
              const v = al[Math.floor(rng() * al.length)];
              log(t, 'swing', { name: "손발이 엇갈려 동료가 다쳤다!", good: 0, id: v.id }); takeHit(v, v.maxHp * 0.25, t, 'friend');
            } else { // 엇박자: 지휘가 엇갈려 틈을 내준다
              quest.boost = { p: 0.5, until: t + 10 }; log(t, 'swing', { name: '호흡이 맞지 않아 틈을 보였다! (적 공격 +50%)', good: 0 });
            }
          }
        }
        push(t + 7 + rng() * 5, 'h');
      } else if (ev.kind === 'r') {
        const a = party[ev.i];
        if (a.state === 'fit' && a.regenPct) { heal(a, a.maxHp * a.regenPct, t); push(t + 30, 'r', ev.i); }
      } else if (ev.kind === 'tick') {
        // 지속 피해 틱 (ev.i = 몬스터, ev.j = 효과)
        const m = ev.i, d = ev.j;
        if (m.hp > 0 && t <= d.until) { dotTick(m, d, t); push(t + 1, 'tick', m, d); }
      } else if (ev.kind === 's') {
        const a = party[ev.i], s = a.actives[ev.j];
        if (a.state !== 'fit') continue;
        a.fxSkill = true; const fired = castSkill(a, s, t); a.fxSkill = false;
        if (fired) log(t, 'skill', { by: a.id, name: s.name });
        push(t + (fired ? s.cdEff : 3), 's', ev.i, ev.j);
      }
    }
    if (snaps) snap(Math.min(t, CAP_SEC));
    if (probes) while (nextProbe <= Math.min(t, CAP_SEC) + 1e-9) { takeProbe(nextProbe); nextProbe += opts.probeEvery * (nextProbe >= 300 ? 4 : 1); }
    if (!outcome) outcome = alive().length ? (liveMons().length ? 'stalemate' : 'win') : (party.some((a) => a.state === 'down') ? 'wipe' : 'retreat');
    if (outcome === 'win' && liveMons().length) outcome = 'stalemate';

    function castSkill(a, s, t) {
      const act = s.act, mon = lowestMon();
      const lowestAlly = () => alive().reduce((b, q) => (!b || q.hp / q.maxHp < b.hp / b.maxHp ? q : b), null);
      switch (act.t) {
        case 'hit': { if (!mon) return false; let x = atkValue(a, mon, t, true) * act.a; if (act.crit) x *= a.critDmg; hitMon(a, mon, x, t, act.leech); return true; }
        case 'multi': { for (let n = 0; n < act.n; n++) { const m = lowestMon(); if (!m) break; hitMon(a, m, atkValue(a, m, t, true) * act.a, t); } return true; }
        case 'aoe': { liveMons().forEach((m) => hitMon(a, m, atkValue(a, m, t, true) * act.a, t)); return true; }
        case 'exec': { if (!mon) return false; const low = liveMons().filter((m) => m.hp / m.maxHp <= act.thr)[0]; const tg = low || mon; hitMon(a, tg, atkValue(a, tg, t, true) * (low ? act.a : act.base), t); return true; }
        case 'dot': case 'dotall': {
          const tgs = act.t === 'dotall' ? liveMons() : (mon ? [mon] : []); if (!tgs.length) return false;
          tgs.forEach((m) => { const d = { src: a, dmg: atkValue(a, m, t, true) * act.a, until: t + act.dur }; m.dots.push(d); push(t + 1, 'tick', m, d); }); return true;
        }
        case 'heal': { const l = lowestAlly(); if (!l || l.hp / l.maxHp > 0.7) return false; heal(l, l.maxHp * act.p, t); return true; }
        case 'healall': { const al = alive(); if (Math.min.apply(null, al.map((q) => q.hp / q.maxHp)) > 0.7) return false; al.forEach((q) => heal(q, q.maxHp * act.p, t)); return true; }
        case 'guard': { if (a.guard && a.guard.until > t) return false; a.guard = { p: act.p, until: t + act.dur }; return true; }
        case 'guardall': { const al = alive(); if (al.every((q) => q.guard && q.guard.until > t)) return false; al.forEach((q) => { q.guard = { p: Math.max(act.p, q.guard && q.guard.until > t ? q.guard.p : 0), until: t + act.dur }; }); return true; }
        case 'shield': { const l = lowestAlly(); if (!l) return false; l.shield = Math.max(l.shield, l.maxHp * act.p); l.shieldUntil = t + act.dur; return true; }
        case 'shieldall': { alive().forEach((q) => { q.shield = Math.max(q.shield, q.maxHp * act.p); q.shieldUntil = t + act.dur; }); return true; }
        case 'buff': {
          const tg = act.party ? alive() : [a];
          if (tg.every((q) => buffVal(q, act.stat, t) >= act.p)) return false;
          tg.forEach((q) => q.buffs.push({ stat: act.stat, p: act.p, until: t + act.dur })); return true;
        }
        case 'debuff': { const ms = liveMons(); if (!ms.length) return false; if (ms.every((m) => debuffOf(m, act.stat, t) >= act.p)) return false; ms.forEach((m) => m.debuffs.push({ stat: act.stat, p: act.p, until: t + act.dur })); return true; }
        case 'debuffall': { const ms = liveMons(); if (!ms.length) return false; ms.forEach((m) => { m.debuffs.push({ stat: 'atk', p: act.p, until: t + act.dur }); m.debuffs.push({ stat: 'def', p: act.p, until: t + act.dur }); }); return true; }
        default: return false;
      }
    }

    // 결과 정리
    const crisisAny = party.some((a) => a.crisisAt !== null || a.state === 'down');
    const first = party.filter((a) => a.crisisAt !== null).reduce((m, a) => Math.min(m, a.crisisAt), Infinity);
    return {
      outcome, seconds: t, crisis: crisisAny, crisisIds, kills: mons.filter((m) => m.hp <= 0).length, firstCrisisAt: isFinite(first) ? first : null,
      members: party.map((a) => ({ id: a.id, hp: Math.round(a.hp), maxHp: Math.round(a.maxHp), state: a.state, crisis: a.crisis, damage: Math.round(a.damage), kills: a.kills, downAt: a.downAt })),
      events: eventsOut, party, snaps, probes, monMax: mons.map((m) => m.maxHp),
    };
  }
  // 복사해 둔 상태에서 이어서 끝까지 굴린다 (결과: 'win' / 그 밖)
  const resume = (S, rng) => exec(S, rng, {}).outcome;

  // 쓰러진 파티원의 사망 판정 (기획서 기존 규칙 유지)
  function deathChance(actor, others, partyDeathMod) {
    const n = others.filter((o) => o !== actor && (o.crisis || o.state === 'down')).length;
    return Math.max(DEATH_MIN, Math.min(DEATH_CAP, DEATH_BASE + DEATH_PER * n - (actor.deathMod || 0) - (actor.twDeath || 0) - (partyDeathMod || 0)));
  }

  const discordChance = (n, harm) => Math.min(DISCORD_CAP, DISCORD_PER * Math.max(0, n - 3)) * (1 - DISCORD_HARM * (harm || 0));
  global.Engine = {
    discordChance,
    atkOf, ATK, LV_LO, setCompress: (v) => { LV_COMPRESS = v; }, STATS, GRADES, T0, GROW, MAX_LEVEL, QUEST_GRADES, QUEST_TYPES, CRISIS_RATIO, CAP_SEC,
    totalPoints, randomSplit, rollTalent, TEMPO, heroInterval, pathOf, tierOfLevel, collectMods, makeActor, makeQuest, simulate, resume, deathChance, attackRel, defendRel, beats, statPoints, baseInterval, critChance,
  };
})(typeof window !== 'undefined' ? window : globalThis);
