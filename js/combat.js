/* ============================================================
   combat.js - 의뢰 템플릿 / 파티 전투 어댑터 (새 엔진 Engine 기반)
   guild.js·ui.js가 쓰던 인터페이스(startBattle/advanceBattle/crisisMembers/commitLabel)는 유지하고,
   계산은 모두 engine.js의 시뮬레이션으로 한다.
   전투는 저장된 시드로 "처음부터 다시 굴려" 같은 결과를 재현한다 (위기마다 내린 결정 목록을 같이 저장).
   ============================================================ */
(function (global) {
  'use strict';

  const MAX_LEVEL = Character.MAX_LEVEL;
  const CRISIS_RATIO = Engine.CRISIS_RATIO;
  const ATTRIBUTES = ['불', '물', '바람', '땅', '빛', '어둠'];
  const BEATEN_BY = { 불: '물', 바람: '불', 땅: '바람', 물: '땅', 어둠: '빛', 빛: '어둠' }; // 이 속성의 약점 속성

  const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* ---------- 효과 설명 (특성 / 고유스킬 / 직업 스킬) ---------- */
  const modsOf = (c) => Engine.collectMods(Character.toEngine(c)).mods;
  function effectLines(c) {
    const out = (c.traits || []).map((t) => DATA_TRAITS.find((x) => x.name === t)).filter(Boolean).map((t) => ({ name: t.name, text: t.text, trait: true }));
    if (c.uniqueSkill !== null && c.uniqueSkill !== undefined) {
      const u = DATA_UNIQUE[c.uniqueSkill];
      out.push({ name: u.name, text: '모든 능력치 +6% · ' + u.text, skill: true, id: c.uniqueSkill });
    }
    (c.path || []).forEach((cn) => DATA_CLASSES[cn].skills.forEach((s) => out.push({ name: `${cn} · ${s.name}`, text: s.text })));
    return out;
  }
  const expMulOf = (c) => 1 + (modsOf(c).expMul || 0);
  const hasTimeEye = (c) => c.uniqueSkill === 0;

  /* ---------- 의뢰 템플릿 (등급 × 유형) ---------- */
  // 등급별 레벨 범위 / 소요 분 / 몬스터. 엔진이 등급 값(체력·공격)을 레벨에 맞춰 계산한다.
  const GRADE_INFO = {
    F: { lv: [1, 10],  min: 8,   art: 'q1', mon: ['들쥐', '쥐왕'],         names: ['곳간 쥐 퇴치', '쥐 소굴 소탕', '쥐왕 토벌'] },
    E: { lv: [11, 25], min: 15,  art: 'q2', mon: ['늑대', '늑대 대장'], names: ['숲 늑대 사냥', '늑대 무리 습격', '우두머리 늑대 토벌'] },
    D: { lv: [26, 40], min: 30,  art: 'q3', mon: ['고블린', '고블린 왕'],   names: ['고블린 야영지', '고블린 대군', '고블린 왕 토벌'] },
    C: { lv: [41, 55], min: 60,  art: 'q4', mon: ['오크', '동굴 트롤'],     names: ['오크 전초기지', '오크 군단', '동굴 트롤 토벌'] },
    B: { lv: [56, 70], min: 90,  art: 'q5', mon: ['불꽃 정령', '용암 골렘'], names: ['불꽃 정령 소탕', '정령 폭주', '용암 골렘 격파'] },
    A: { lv: [71, 85], min: 150, art: 'q6', mon: ['와이번', '고대 용'],     names: ['와이번 둥지', '비룡 군단', '고대 용 사냥'] },
    S: { lv: [86, 99], min: 240, art: 'q6', mon: ['심연의 사도', '마왕'],   names: ['심연의 문', '마왕군 침공', '마왕 토벌'] },
  };
  const GRADES = Object.keys(GRADE_INFO);
  const TYPES = ['sweep', 'wave', 'boss'];
  const TYPE_TEXT = { boss: '토벌 · 보스', sweep: '토벌', wave: '웨이브', gather: '채집', help: '도움' };
  const WAIT_TYPES = ['gather', 'help'];
  const isWait = (q) => WAIT_TYPES.includes(q.type);
  const TYPE_MIN = { sweep: 1, wave: 1.4, boss: 1.8 };
  const TEMPLATES = [];
  GRADES.forEach((g, gi) => TYPES.forEach((ty, ti) => {
    const gi_ = GRADE_INFO[g];
    TEMPLATES.push({ id: g + '-' + ty, grade: g, gi, type: ty, name: gi_.names[ti], art: gi_.art, monster: gi_.mon[ty === 'boss' ? 1 : 0],
      level: gi_.lv[1], lvMin: gi_.lv[0], minutes: Math.round(gi_.min * TYPE_MIN[ty] / 5) * 5 || 5,
      size: gi >= 4 ? 4 : 3, min: 1, max: 4, waves: [Engine.QUEST_TYPES[ty].n] });
  }));
  const templateById = (id) => TEMPLATES.find((t) => t.id === id);
  const totalMonsters = (q) => q.type === 'boss' ? 1 : (q.total || (Engine.QUEST_TYPES[q.type] || {}).n || 0);
  const questExp = (L) => Math.round(15 * Math.pow(L, 1.3));  // 파티원 1명당 (결과 정산에서 인원수만큼 곱해 나눈다)
  const GOLD_BY_GRADE = { F: 50, E: 90, D: 160, C: 290, B: 520, A: 940, S: 1700 }; // 의뢰 1회 클리어 금화 (기획서 15-2)
  const questGold = (grade) => GOLD_BY_GRADE[grade];

  function makeContract(tpl, t, rng, topLevel) {
    const hours = 2 + Math.floor(rng() * 7);
    const hi = Math.max(tpl.lvMin, Math.min(tpl.level, (topLevel || tpl.level) + 3)); // 등급 범위 안에서, 길드의 가장 강한 모험가보다 너무 높지 않게
    const L = tpl.lvMin + Math.floor(rng() * (hi - tpl.lvMin + 1));
    const attr = Gear.MONSTERS[tpl.monster].attr; // 몬스터 종류마다 속성이 정해져 있다
    const c = {
      tpl: tpl.id, grade: tpl.grade, name: tpl.name, type: tpl.type, art: tpl.art, monster: tpl.monster, level: L, attr,
      minutes: tpl.minutes, waves: [Math.min(5, Engine.QUEST_TYPES[tpl.type].n)], total: Engine.QUEST_TYPES[tpl.type].n,
      size: tpl.size, min: tpl.min, max: tpl.max, weak: BEATEN_BY[attr], resist: null, fails: 0, relics: [],
      createdAt: t, expiresAt: t + hours * 3600000,
    };
    c.exp = questExp(L);
    c.gold = questGold(tpl.grade);
    return c;
  }

  /* ---------- 무작위 의뢰 (몬스터 1000종 · 보스 100종 · 채집 · 도움) ---------- */
  const WAIT_MIN = { F: [10, 30], E: [20, 50], D: [40, 90], C: [60, 120], B: [90, 150], A: [120, 200], S: [150, 240] };
  const FIGHT_NAMES = { sweep: (m) => `${m} 토벌`, boss: (m) => `${m} 토벌`, wave: (m) => `${m} 습격 방어` };
  const rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
  function randomContract(grade, type, t, rng, topLevel) {
    const gi = GRADES.indexOf(grade), gi_ = GRADE_INFO[grade];
    const hours = 2 + Math.floor(rng() * 7);
    const hi = Math.max(gi_.lv[0], Math.min(gi_.lv[1], (topLevel || gi_.lv[1]) + 3));
    const L = gi_.lv[0] + Math.floor(rng() * (hi - gi_.lv[0] + 1));
    const c = { grade, type, level: L, fails: 0, relics: [], createdAt: t, expiresAt: t + hours * 3600000, weak: null, resist: null, hue: Math.floor(rng() * 360) };
    if (type === 'gather' || type === 'help') {
      const [a, b] = WAIT_MIN[grade];
      c.minutes = Math.round(rint(rng, a, b) / 5) * 5 || 5; c.art = gi_.art; c.monster = null; c.attr = null;
      c.min = 1; c.max = 4; c.size = 1; c.total = 0; c.waves = [0];
      if (type === 'gather') {
        const item = Monsters.pickFrom(Monsters.GATHER[gi], rng), place = Monsters.pickFrom(Monsters.PLACES, rng);
        c.item = item; c.place = place; c.name = `${item} 채집 (${place})`; c.qty = Math.max(4, Math.round(rint(rng, 4, 8) * (0.6 + c.minutes / 60)));
      } else {
        const v = Monsters.pickFrom(Monsters.VILLAGES, rng), h = Monsters.pickFrom(Monsters.HELP, rng);
        c.place = v; c.job = h; c.name = `${v} · ${h}`;
      }
      // 채집: 금화 보상 없이 재료를 가져온다(받기면 길드가 시세만큼 수수료, 안 받기면 모험가가 판매). 도움: 경험치는 적고 금화를 번다.
      c.exp = Math.round(questExp(L) * (type === 'gather' ? 0.3 : 0.1) * c.minutes / 20 + 2);
      c.gold = type === 'gather' ? 0 : Math.round(questGold(grade) * 1.1 * (0.6 + c.minutes / 60));
      return c;
    }
    const list = type === 'boss' ? Monsters.BOSS[gi] : Monsters.NORMAL[gi];
    const mon = Monsters.pickFrom(list, rng), attr = Gear.MONSTERS[mon].attr;
    const n = type === 'boss' ? 1 : type === 'wave' ? 12 + 3 * gi + rint(rng, 0, 6) : 12;
    Object.assign(c, { name: FIGHT_NAMES[type](mon), art: gi_.art, monster: mon, attr, weak: BEATEN_BY[attr], total: n, waves: [Math.min(5, n)],
      minutes: Math.round(gi_.min * TYPE_MIN[type] / 5) * 5 || 5,
      size: gi >= 4 ? 4 : 3, min: 1, max: type === 'wave' ? 10 : 4 });
    c.exp = questExp(L); c.gold = Math.round(questGold(grade) * (type === 'wave' ? 1.3 : type === 'boss' ? 1.2 : 1));
    return c;
  }
  const monsterStats = () => ({ hp: 1 }); // 화면 호환용 (몬스터 체력은 엔진 안에서만 쓰인다)

  /* ---------- 파티 전투 (엔진 어댑터) ---------- */
  // 전투 입력용 파티원: 엔진 캐릭터 + 유대/슬픔 보정(tweak)
  function memberFrom(c) {
    return { id: c.id, name: c.name, level: c.level, hpMax: 0, hp: 0, char: JSON.parse(JSON.stringify(Character.toEngine(c))),
      tw: { atk: 1, def: 1, death: 0 }, dmg: 0, kills: 0, state: 'fit', deathMod: 0 };
  }
  const questOf = (st, rng) => {
    const o = { level: st.qp.level, attr: st.qp.attr, n: st.qp.n, hpMul: st.qp.hpMul };
    if (st.qp.hpTotal) o.hpTotal = st.qp.hpTotal;
    if (st.qp.easy) o.safe = true;
    if (st.qp.easy) o.atk = Engine.atkOf(st.qp.grade, st.qp.type) * st.qp.easy; // 튜토리얼 연습 의뢰: 몬스터 공격을 약하게
    return Engine.makeQuest(st.qp.grade, st.qp.type, rng, o);
  };

  // 튜토리얼 연습 전투: 파티의 공격력을 재 보고 약 1분 안팎에 끝나도록 몬스터 체력을 맞춘다
  function easyHp(chars, tweaks, q) {
    try {
      const rng = mulberry(777), T = 20;
      const o = { level: q.level, attr: q.attr, n: q.total || undefined, hpMul: 1e5, safe: true, atk: 1e-6 };
      const res = Engine.simulate(chars, Engine.makeQuest(q.grade, q.type, rng, o), rng, { tweaks, maxT: T });
      const dmg = res.party.reduce((s, a) => s + a.damage, 0);
      return dmg > 0 ? (dmg / T) * (47 + Math.random() * 12) : 0;
    } catch (e) { return 0; }
  }
  function startBattle(members, q) {
    const tweaks = {}, chars = members.map((x) => { tweaks[x.id] = { atk: x.tw.atk * 1, def: x.tw.def * 1, death: x.tw.death + (x.deathMod || 0), hp: x.tw.hp, harm: x.tw.harm || 0 }; return x.char; });
    return {
      v: 2, seed: Math.floor(Math.random() * 4294967296), chars, tweaks, names: members.map((x) => x.name), levels: members.map((x) => x.level),
      qp: { grade: q.grade, type: q.type, level: q.level, attr: q.attr, easy: q.easy || 0, n: q.type === 'boss' ? 1 : (q.total || undefined), hpTotal: q.easy ? easyHp(structuredClone(members.map((x) => x.char)), tweaks, q) : 0, hpMul: q.easy ? 1 : q.type === 'wave' ? Math.max(1, members.length / 4) : 1 },
      m: members.map((x) => ({ id: x.id, name: x.name, level: x.level, hp: 1, hpMax: 1, dmg: 0, kills: 0, state: 'fit' })),
      wave: 0, mons: null, kills: 0, total: totalMonsters(q), dead: [], log: [], crisisIds: [],
    };
  }
  // 저장된 시드로 처음부터 굴린다. stop=true면 첫(또는 다음) 위기에서 멈춘다.
  function run(st, stop, forkRng, extra) {
    const rng = mulberry(st.seed);
    const quest = questOf(st, rng);
    return Engine.simulate(st.chars, quest, rng, Object.assign({ stop, tweaks: st.tweaks, forkRng }, extra || {}));
  }
  function apply(st, res, final) {
    st.crisisIds = res.crisisIds || [];
    st.kills = res.kills;
    st.t = res.seconds; // 이 구간 전투가 끝나거나 위기로 멈춘 시각(전투 시계, 초)
    res.party.forEach((a, i) => {
      const x = st.m[i];
      x.hp = Math.max(0, Math.round(a.hp)); x.hpMax = Math.round(a.maxHp); x.dmg = Math.round(a.damage); x.kills = a.kills;
      x.state = a.state === 'down' ? 'down' : a.state; // fit / down / out
    });
    if (!final) return;
    // 체력이 0이 된 파티원은 그 순간 사망한다 (전투 도중 확정, 끝난 뒤 따로 굴리지 않는다)
    res.party.filter((a) => a.state === 'down').sort((p, q) => p.downAt - q.downAt).forEach((a) => {
      const x = st.m[res.party.indexOf(a)];
      x.state = 'dead'; st.dead.push(x.id); st.log.push(`${x.name}${josa(x.name, '이', '가')} 쓰러져 숨을 거뒀다.`);
    });
  }
  function josa(w, a, b) { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c % 28 !== 0 ? a : b; }

  /** 반환: 'win' / 'crisis'(stop일 때만) / 'wipe' / 'retreat' */
  function advanceBattle(st, q, rng, stopOnCrisis) {
    const res = run(st, !!stopOnCrisis);
    const o = res.outcome;
    apply(st, res, o !== 'crisis');
    if (o === 'crisis') return 'crisis';
    if (o === 'win') { st.log.push(`${q.monster}${st.total > 1 ? ' 무리' : ''}를 쓰러뜨렸다.`); return 'win'; }
    if (o === 'stalemate') { st.log.push(`${q.monster}와(과) 승부가 나지 않아 물러났다.`); return 'retreat'; }
    return o; // wipe / retreat
  }
  /* ---------- 실시간 전투 화면용: 전투 시계(초) 시점의 상태 ---------- */
  const viewCache = new Map();
  const FEED = new Set(['swing', 'skill', 'kill', 'crisis', 'down', 'crisisClear', 'bossSkill', 'endure']);
  const FX = new Set(['swing', 'atk', 'matk', 'dmg', 'hurt', 'heal', 'skill', 'kill', 'down', 'crisis', 'endure', 'bossSkill']);
  const PROBE_STEP = 0.5, PROBE_N = 160;
  // 한 번 계산한 전투 기록 (스냅샷·이벤트·승률 예측용 복사본)
  function cacheOf(st, stop) {
    const key = st.seed + '|' + (stop ? 1 : 0);
    let c = viewCache.get(key);
    if (c) return c;
    const res = run(st, !!stop, null, { record: true, snapEvery: 0.25, probeEvery: PROBE_STEP });
    const name = {}; st.m.forEach((x) => { name[x.id] = x.name; });
    const ev = res.events;
    c = { key, snaps: res.snaps, monMax: res.monMax, probes: res.probes, endT: res.seconds, outcome: res.outcome,
      fx: ev.filter((e) => FX.has(e.k)), turns: ev.filter((e) => e.k === 'atk' || e.k === 'matk'),
      feed: ev.filter((e) => FEED.has(e.k)).map((e) => {
        const t = e.t;
        if (e.k === 'swing') return { t, text: e.id ? `${name[e.id]}${josa(name[e.id], '이', '가')} ${e.name}` : e.name, good: !!e.good, bad: !e.good };
        if (e.k === 'skill') return { t, text: `${name[e.by]}의 「${e.name}」` };
        if (e.k === 'kill') return { t, text: `${name[e.by]}${josa(name[e.by], '이', '가')} 몬스터를 쓰러뜨렸다` };
        if (e.k === 'crisis') return { t, text: `${name[e.id]}${josa(name[e.id], '이', '가')} 위기에 빠졌다!`, bad: true };
        if (e.k === 'endure') return { t, text: `${name[e.id]}${josa(name[e.id], '이', '가')} 치명상을 입고도 이를 악물고 버텨 냈다!`, good: true };
        if (e.k === 'down') return { t, text: `${name[e.id]}${josa(name[e.id], '이', '가')} 쓰러져 숨을 거뒀다`, bad: true };
        if (e.k === 'crisisClear') return { t, text: `${name[e.id]}의 위기가 해소됐다` };
        return { t, text: e.n === 1 ? '몬스터의 강타!' : '몬스터가 전체를 휩쓴다!', bad: true };
      }) };
    c.seedBase = st.seed | 0;
    viewCache.set(key, c);
    if (viewCache.size > 8) viewCache.delete(viewCache.keys().next().value);
    return c;
  }
  // simT: 전투 시계(초), stop: 위기에서 멈추는 구간인가
  function view(st, simT, stop) {
    const c = cacheOf(st, stop);
    let lo = 0, hi = c.snaps.length - 1; // simT 이하의 마지막 스냅샷 (이분 탐색)
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (c.snaps[mid].t <= simT) lo = mid; else hi = mid - 1; }
    const s = c.snaps[lo];
    const mons = s.m.map((hp, i) => ({ r: Math.max(0, hp / c.monMax[i]), alive: hp > 0 }));
    return {
      t: simT, heroes: st.m.map((x, i) => ({ id: x.id, hp: s.p[i][0], hpMax: s.p[i][1], state: s.p[i][2] === 'down' ? 'down' : s.p[i][2], crisis: !!s.p[i][3] })),
      mons, alive: mons.filter((m) => m.alive).length, monHpRatio: mons.reduce((a, m, i) => a + Math.max(0, s.m[i]), 0) / (c.monMax.reduce((a, b) => a + b, 0) || 1),
      feed: c.feed.filter((f) => f.t <= simT).slice(-5),
    };
  }
  // 연출용: (from, to] 시각에 일어난 사건들
  function fxBetween(st, stop, from, to) {
    const c = cacheOf(st, stop);
    return c.fx.filter((e) => e.t > from && e.t <= to);
  }
  // 앞으로 올 공격 순서 (다음 n번의 턴). 반환: [{side:'p'|'m', id}]
  function turnQueue(st, stop, simT, n) {
    const c = cacheOf(st, stop), out = [];
    for (let i = 0; i < c.turns.length && out.length < n; i++) {
      const e = c.turns[i];
      if (e.t <= simT) continue;
      out.push(e.k === 'atk' ? { side: 'p', id: e.by, t: e.t } : { side: 'm', id: e.mon, t: e.t });
    }
    return out;
  }
  /* ---------- 승률 예측 (몬테카를로) ----------
     0.5초마다 그 순간의 전투 상태를 복사해 PROBE_N(160)번 끝까지 싸워 본 이긴 비율.
     한 번에 몰아 계산하면 화면이 끊기므로, 호출될 때마다 주어진 시간(ms)만큼만 조금씩 계산한다. */
  const BACK_N = 48; // 지난 구간을 메울 때는 적은 횟수로 (흐릿해도 선 모양만 보이면 된다)
  const lastProbe = (c, simT) => { let i = c.probes.length - 1; while (i > 0 && c.probes[i].t > simT + 1e-9) i--; return i; };
  function probeWork(st, stop, simT, budgetMs) {
    const c = cacheOf(st, stop);
    if (!c.probes.length) return;
    const last = lastProbe(c, simT), t0 = performance.now();
    while (performance.now() - t0 < budgetMs) {
      let w = c.work;
      if (w && w.back && c.probes[last].p === undefined) w = c.work = null; // 최신 점이 먼저
      if (!w) {
        let i = -1, n = PROBE_N, back = false;
        if (c.probes[last].p === undefined) i = last;
        else { back = true; n = BACK_N; for (let j = last; j >= 0; j--) if (c.probes[j].p === undefined && j % 4 === 0) { i = j; break; } }
        if (i < 0) return;
        const pr = c.probes[i], mons = pr.S.quest.monsters;
        if (!mons.some((m) => m.hp > 0)) { pr.p = 1; continue; }
        if (!pr.S.party.some((a) => a.state === 'fit')) { pr.p = 0; continue; }
        w = c.work = { i, n, k: 0, wins: 0, back };
      }
      const r = mulberry((c.seedBase + (w.i + 1) * 7919 + w.k * 104729) | 0);
      if (Engine.resume(structuredClone(c.probes[w.i].S), r) === 'win') w.wins++;
      if (++w.k >= w.n) { c.probes[w.i].p = w.wins / w.n; c.work = null; }
    }
  }
  // 지금까지 계산된 승률 점들 (시간순)
  function winPoints(st, stop, simT) {
    const c = cacheOf(st, stop), last = lastProbe(c, simT), pts = [];
    for (let i = 0; i <= last && i < c.probes.length; i++) if (c.probes[i].p !== undefined) pts.push({ t: c.probes[i].t, p: c.probes[i].p });
    return pts;
  }
  const cloneBattle = (st) => JSON.parse(JSON.stringify(st));
  // 지금 위기에 빠진 파티원들 (advanceBattle이 위기로 멈춘 직후의 상태)
  const crisisMembers = (st) => st.m.filter((x) => x.state === 'fit' && st.crisisIds.includes(x.id));

  /* ---------- 위험도 ---------- */
  function estimate(members, q, trials) {
    const n = Math.min(trials || 40, 40);
    let crisis = 0;
    for (let i = 0; i < n; i++) {
      const st = startBattle(members, q);
      if (run(st, true).outcome === 'crisis') crisis++;
    }
    return { crisisRate: crisis / n, deadIfCommit: 0 };
  }
  function dangerLevel(crisisRate) {
    if (crisisRate < 0.05) return { key: 'safe', text: '안전' };
    if (crisisRate < 0.3) return { key: 'caution', text: '주의' };
    if (crisisRate < 0.7) return { key: 'danger', text: '위험' };
    return { key: 'extreme', text: '극히 위험' };
  }
  // 위기에서 "계속 싸우면" 아무도 죽지 않을 가능성 (말로 된 힌트): 위기 시점부터 난수만 바꿔 여러 번 굴린다
  function commitLabel(st, q, trials) {
    const n = Math.min(trials || 40, 60);
    let safe = 0;
    for (let i = 0; i < n; i++) {
      const c = cloneBattle(st);
      const res = run(c, false, mulberry(Math.floor(Math.random() * 4294967296)));
      apply(c, res, true);
      if (!c.dead.length) safe++;
    }
    const p = safe / n;
    return p < 0.2 ? '희박' : p < 0.45 ? '낮음' : p < 0.7 ? '반반' : '높음';
  }

  global.Combat = {
    MAX_LEVEL, CRISIS_RATIO, ATTRIBUTES, TEMPLATES, TYPE_TEXT, WAIT_TYPES, isWait, randomContract, GRADES, GRADE_INFO, BEATEN_BY,
    effectLines, expMulOf, hasTimeEye, templateById, totalMonsters, questExp, questGold, makeContract, monsterStats,
    memberFrom, startBattle, advanceBattle, crisisMembers, fxBetween, turnQueue, probeWork, winPoints, estimate, dangerLevel, commitLabel, view,
  };
})(typeof window !== 'undefined' ? window : globalThis);
