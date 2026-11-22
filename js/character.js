/* ============================================================
   character.js - 캐릭터 생성 (2단계)
   등급 판정 / 재능 / 속성·특성 / 고유스킬 배정
   * 난수는 Math.random (프로토타입). 서버로 옮길 때 이 파일의 rng만 교체하면 됨.
   ============================================================ */
(function (global) {
  'use strict';

  const GRADES = ['Common', 'Rare', 'Epic', 'Unique', 'Legendary'];

  // 재능 범위 (비공개 수치: 성장성 결정용)
  const TALENT_RANGE = {
    Common: [1, 100], Rare: [1, 100], Epic: [1, 100], Unique: [1, 100], Legendary: [1, 100], // 모든 희귀도 동일: 1~100
  };

  // 등급 내 고유스킬 확률 (기획서)
  const SKILL_CHANCE = {
    Common: 1e-7, Rare: 1e-6, Epic: 1e-5, Unique: 1e-4, Legendary: 1e-2,
  };

  // 등급 판정 단계: 순서대로 통과해야 다음 단계로. 실패한 지점이 등급.
  //   (주속성은 항상 보유)  10% 부속성 -> 10% 특성1 -> 5% 특성2 -> 1% Legendary
  const GRADE_STEPS = [
    { pass: 0.10, failGrade: 'Common' },
    { pass: 0.10, failGrade: 'Rare' },
    { pass: 0.05, failGrade: 'Epic' },
    { pass: 0.01, failGrade: 'Unique' },
  ];

  // 임시 데이터 (나중에 실제 기획에 맞게 교체)
  const ATTRIBUTES = ['불', '물', '바람', '땅', '빛', '어둠'];
  const TRAITS = global.DATA_TRAITS.map((t) => t.name);               // 특성 100종 (data-traits.js)
  const SKILL_COUNT = global.DATA_UNIQUE.length;                       // 고유스킬 500종 (data-unique.js)
  const SKILL_NAMES = global.DATA_UNIQUE.map((u) => u.name);
  const TRAIT_COUNT = { Common: 0, Rare: 1, Epic: 2, Unique: 3, Legendary: 3 };
  const COMMON_TRAIT_CHANCE = 0.1; // 커먼도 10% 확률로 특성 1개
  const ROOTS = Object.keys(global.DATA_CLASSES).filter((k) => global.DATA_CLASSES[k].tier === 0); // 0차 직업

  /* ---------- 성장: 레벨 99, 전직은 30/60/90 ---------- */
  const MAX_LEVEL = 99;
  const ADVANCE_AT = [30, 60, 90];
  // 다음 레벨까지 필요한 경험치 (의뢰 1건 경험치 15·L^1.3, 레벨당 의뢰 수 1+0.08L)
  const expNeeded = (level) => Math.round(15 * Math.pow(level, 1.3) * (1 + 0.08 * level));
  // 전직을 해야 더 오를 수 있는 상태인가 (path 길이 1 = 0차)
  const needsAdvance = (c) => c.path.length - 1 < ADVANCE_AT.length && c.level >= ADVANCE_AT[c.path.length - 1];
  const advanceChoices = (c) => (needsAdvance(c) ? global.DATA_CLASSES[c.path[c.path.length - 1]].children.slice() : []);
  function advance(c, className) {
    if (!advanceChoices(c).includes(className)) return false;
    c.path.push(className);
    return true;
  }
  // 경험치를 더하고 올린 레벨 수를 반환. 전직 대기 중이면 경험치를 받지 않는다.
  function addExp(c, amount) {
    let gained = 0;
    if (needsAdvance(c) || c.level >= MAX_LEVEL) return 0;
    c.exp = (c.exp || 0) + amount;
    while (c.level < MAX_LEVEL && !needsAdvance(c)) {
      const need = expNeeded(c.level);
      if (c.exp < need) break;
      c.exp -= need; c.level++; gained++;
    }
    if (c.level >= MAX_LEVEL || needsAdvance(c)) c.exp = 0;
    return gained;
  }
  // 직업 경로에서 선호 스탯 (가장 깊은 직업 기준)
  const prefOf = (c) => { for (let i = c.path.length - 1; i >= 0; i--) { const p = global.DATA_CLASSES[c.path[i]].pref; if (p) return p; } return null; };
  // 엔진에 넘기는 형태
  // 착용 장비의 능력치 합과 옵션(특성 이름)
  function gearOf(c) {
    const pts = [0, 0, 0, 0, 0], opts = [];
    Object.values(c.equip || {}).forEach((it) => { if (!it) return; global.Gear.bonusPts(it).forEach((v, i) => { pts[i] += v; }); it.opts.forEach((o) => opts.push(o)); });
    return { pts, opts };
  }
  const toEngine = (c) => { const gr = gearOf(c); return { id: c.id, rarity: c.grade, level: c.level, talent: c.talent, split: c.split, traits: (c.traits || []).concat(gr.opts), gear: gr.pts,
    unique: c.uniqueSkill, attrMain: c.mainAttribute, attrSub: c.subAttribute, path: c.path }; };

  /* ---------- 고유스킬 레지스트리 ---------- */
  // 한 스킬은 동시에 한 명만 보유. 캐릭터 사망 시 release로 풀어준다.
  // history는 3단계 이후 "고유스킬 역사" 화면에 쓰인다.
  // saved: toJSON()으로 저장해 둔 값 (없으면 새로 시작)
  function createSkillRegistry(saved) {
    const owner = saved ? saved.owner.slice() : new Array(SKILL_COUNT).fill(null);   // 스킬 번호 -> 현재 보유 캐릭터 id
    const history = saved ? saved.history.map((h) => h.map((r) => ({ ...r }))) : SKILL_NAMES.map(() => []); // 역대 보유자 기록

    return {
      toJSON: () => ({ owner, history }),
      isAvailable: (skillId) => owner[skillId] === null,
      availableCount: () => owner.filter((o) => o === null).length,
      ownerOf: (skillId) => owner[skillId],
      historyOf: (skillId) => history[skillId].slice(),

      // 비어 있는 스킬 중 무작위 하나를 캐릭터에게 귀속. 없으면 null.
      acquireRandom(characterId, rng) {
        const free = [];
        for (let i = 0; i < SKILL_COUNT; i++) if (owner[i] === null) free.push(i);
        if (free.length === 0) return null;
        const skillId = free[Math.floor(rng() * free.length)];
        owner[skillId] = characterId;
        history[skillId].push({ characterId, startedAt: Date.now(), endedAt: null });
        return skillId;
      },

      // 캐릭터 사망 등으로 스킬 반환 (스킬은 사라지지 않고 다시 뽑힐 수 있게 됨)
      release(skillId) {
        if (owner[skillId] === null) return;
        owner[skillId] = null;
        const rec = history[skillId][history[skillId].length - 1];
        if (rec) rec.endedAt = Date.now();
      },
    };
  }

  /* ---------- 판정 함수 ---------- */

  function rollGrade(rng) {
    let reached = 0;
    for (const step of GRADE_STEPS) {
      if (rng() >= step.pass) return { grade: step.failGrade, stage: reached };
      reached++;
    }
    return { grade: 'Legendary', stage: reached };
  }

  function rollTalent(grade, rng) {
    const [min, max] = TALENT_RANGE[grade];
    return min + Math.floor(rng() * (max - min + 1));
  }

  function pickOne(list, rng, exclude = []) {
    const pool = list.filter((x) => !exclude.includes(x));
    return pool[Math.floor(rng() * pool.length)];
  }

  // 등급 단계(stage)에 따라 속성·특성 개수가 정해진다.
  //   stage 0: 주속성만 / 1: +부속성 / 2: +특성1 / 3: +특성2 / 4: Legendary(특성2 유지)
  function rollAttributesAndTraits(stage, rng, grade) {
    const main = pickOne(ATTRIBUTES, rng);
    const sub = stage >= 1 ? pickOne(ATTRIBUTES, rng, [main]) : null;
    const traits = [];
    const n = grade === 'Common' ? (rng() < COMMON_TRAIT_CHANCE ? 1 : 0) : TRAIT_COUNT[grade];
    for (let i = 0; i < n; i++) traits.push(pickOne(TRAITS, rng, traits));
    return { mainAttribute: main, subAttribute: sub, traits };
  }

  /**
   * 캐릭터 한 명 생성
   * @param {object} ctx { index, appearanceId, registry, rng?, skillChanceMultiplier? }
   */
  function createCharacter(ctx) {
    const rng = ctx.rng || Math.random;
    const mult = ctx.skillChanceMultiplier || 1; // 테스트용 (기본 1 = 기획서 확률)

    const { grade, stage } = rollGrade(rng);
    const talent = rollTalent(grade, rng);
    const attrs = rollAttributesAndTraits(stage, rng, grade);

    const id = `c${ctx.index}`;
    let uniqueSkill = null, skillPending = false;
    if (rng() < Math.min(1, SKILL_CHANCE[grade] * mult)) {
      // deferSkill: 영입 면접 단계에서는 스킬 번호를 아직 정하지 않는다 (채용이 확정될 때 정한다)
      if (ctx.deferSkill) skillPending = true;
      else uniqueSkill = ctx.registry.acquireRandom(id, rng); // 비어 있는 스킬이 없으면 null
    }

    return {
      id,
      index: String(ctx.index),
      appearanceId: String(ctx.appearanceId),
      grade,
      talent,                // 플레이어에게는 직접 노출하지 않는 비공개 수치
      ...attrs,
      split: global.Engine.randomSplit(rng),   // 5스탯 분배 비율 (평생 고정, 비공개)
      path: [ROOTS[Math.floor(rng() * ROOTS.length)]], // 직업 경로 (0차에서 시작, 전직하면 늘어남)
      uniqueSkill,           // 스킬 번호 또는 null
      ...(skillPending ? { skillPending: true } : {}), // 면접 중: 채용하면 스킬이 정해진다
      status: 'ACTIVE',
    };
  }

  global.Character = {
    GRADES, TALENT_RANGE, SKILL_CHANCE, SKILL_NAMES, SKILL_COUNT,
    createSkillRegistry, createCharacter, rollGrade,
    MAX_LEVEL, ADVANCE_AT, ROOTS, expNeeded, needsAdvance, advanceChoices, advance, addExp, prefOf, toEngine,
  };
})(typeof window !== 'undefined' ? window : globalThis);
