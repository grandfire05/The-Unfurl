/* ============================================================
   guild.js - 길드 상태 / 저장 / 영입 / 사망 / 연대기 / 실시간 의뢰 (3~6단계)
   화면(ui.js)과 분리해서, 나중에 서버 API로 바꾸기 쉽게 만든다.
   ============================================================ */
(function (global) {
  'use strict';

  const SAVE_KEY = 'guild-save-v3';
  const SEED = 'guild-dev-seed-v1'; // 개발용. 실서비스에서는 서버 비밀값.
  const MINUTE = 60000;
  const DAY = 86400000;

  // 규칙 값 (나중에 밸런스 조정은 여기서)
  const ABSENCE_DAYS = 30;  // 이 기간 미접속할 때마다 모험가 1명 이탈
  const START_GOLD = 200;   // 시작 무료 재화
  const CRISIS_AT = 0.5;        // 의뢰 진행률이 이 지점에 오면 위기 신호가 온다 (위기가 있는 의뢰만)
  const INJURY_RETREAT_MIN = 30; // 후퇴 명령으로 물러난 뒤 부상 회복 시간(분)
  const INJURY_TIMEOUT_MIN = 60; // 결정 시간을 놓쳐 스스로 물러난 뒤 중상 회복 시간(분)
  // 위기 후 결정 제한 시간. '시간의 눈'을 가진 파티원이 있으면 60% 늘어난다.
  const decisionMs = (q, ids) => {
    const base = Math.max(10, Math.min(60, Math.round(q.minutes * 0.5)));
    const eye = (ids || []).some((id) => { const c = state.characters.find((x) => x.id === id); return c && Combat.hasTimeEye(c); });
    return Math.round(base * (eye ? 1.6 : 1)) * MINUTE;
  };
  /* ---------- 길드 등급 · 명성 (기획서 15장) ---------- */
  const GRADES = Combat.GRADES;                        // F E D C B A S
  const FAME_BY_GRADE = [10, 16, 26, 42, 68, 110, 180]; // 의뢰 1회 클리어 명성
  // 의뢰 하나의 명성 변화 안내: 클리어(+), 모험가 1명 사망(-), 전멸(-). 채집·도움은 클리어 40%만 오르고 깎이지 않는다.
  const fameInfo = (k) => {
    const base = FAME_BY_GRADE[Math.max(0, GRADES.indexOf(k.grade))];
    if (k.type === 'gather' || k.type === 'help') return { wait: true, win: Math.round(base * 0.4) };
    return { wait: false, win: base, winMax: Math.round(base * 1.16), death: Math.round(base * 0.5), wipe: Math.round(base * 1.5) };
  };
  const PROMO_FAME = [300, 1120, 3640, 10500, 27200, 66000];   // 다음 등급 승급 명성
  const PROMO_GOLD = [1000, 1800, 3200, 5800, 10400, 18800];   // 승급 재화
  const FAC_CAP = [2, 3, 4, 5, 6, 7, 8];                // 등급별 시설 최대 레벨
  const TRAIN_BY_GRADE = [20, 36, 64, 116, 208, 376, 680];       // 훈련 2시간 슬롯 (하루 수입의 4%)
  const gradeIdx = () => (state && state.guildGrade) || 0;
  const guildGrade = () => GRADES[gradeIdx()];
  const RECRUIT_COST = 100; // 모집 가격은 고정(길드 등급·상황과 무관)
  const recruitCost = () => RECRUIT_COST;
  const returnCost = () => Math.round(recruitCost() * 1.5);
  const promoNeed = () => (gradeIdx() < GRADES.length - 1 ? { fame: PROMO_FAME[gradeIdx()], gold: PROMO_GOLD[gradeIdx()], next: GRADES[gradeIdx() + 1] } : null);
  function promoteGuild() {
    const need = promoNeed();
    if (!need) return { ok: false, reason: '이미 최고 등급이에요.' };
    if (state.fame < need.fame) return { ok: false, reason: `명성이 부족해요. (${need.fame} 필요)` };
    if (state.gold < need.gold) return { ok: false, reason: `금화가 부족해요. (${need.gold} 필요)` };
    state.gold -= need.gold; state.fame = 0; state.guildGrade = gradeIdx() + 1;
    addChronicle(`길드 ${need.next}급 승급`, 'grade-' + need.next);
    save();
    return { ok: true };
  }

  let skillBoost = 1; // 개발용: 고유스킬 확률 배율
  let state = null;
  let registry = null;
  let lastReport = null;   // 최근 이탈 결과 (화면 안내용)

  /* ---------- 저장 / 불러오기 ---------- */
  const TUTORIAL_DONE = 99;
  const newStats = () => ({ clears: 0, deaths: 0, streak: 0, best: 0, crisisWins: 0, specials: 0, kills: 0, goldEarned: 0, byGrade: {}, retreats: 0, wipes: 0, mourns: 0, talks: 0, recruited: 0, crafted: 0, sold: 0, trained: 0, resets: 0 });
  function newState() {
    return {
      version: 3,
      guildName: '이름 없는 길드', guildNamed: false,
      guildGrade: 0,       // 길드 등급 (0=F ~ 6=S)
      fame: 0,             // 다음 승급까지의 명성
      matQueue: [], materials: {}, stock: [], display: [], crafts: [], shopLog: [], shopAt: Date.now(), nextItem: 1,
      gold: START_GOLD,    // 무료 재화 (임시 이름: 금화)
      tutorial: 0,         // 튜토리얼 단계 (TUTORIAL_DONE이면 끝). 건너뛸 수 없다
      items: { resetTicket: 0 }, // 보유 아이템: 초기화권
      stats: newStats(), // 업적용 기록
      ach: {},             // 달성한 업적 { id: 달성 시각 }
      lastVisit: Date.now(), // 마지막 접속(저장) 시각
      timeShift: 0,        // 개발용 시간 빨리감기(ms). 의뢰·부상 시간에만 쓰인다
      inbox: [],           // 아직 확인하지 않은 의뢰 결과
      board: [],           // 게시판에 걸린 의뢰 (마감 있음)
      boardAt: Date.now(), // 마지막으로 새 의뢰가 들어온 시각
      nextContract: 1, nextMission: 1,
      missions: [],        // 진행 중인 파티 의뢰
      codex: { mon: {} },  // 도감: 몬스터별 처치 수와 처음 만난 날
      bonds: {},           // 모험가 쌍의 유대 { 'idA|idB': 0~100 }
      applicants: [],      // 면접을 기다리는 지원자
      applicantAt: Date.now(),
      facilities: { dorm: 0, board: 0, dojo: 0, ward: 0, archive: 0 },
      nextIndex: '0',      // 다음에 쓸 외형 순번 (BigInt를 문자열로)
      characters: [],      // 모든 캐릭터 (status로 구분, 삭제하지 않음)
      chronicle: [],       // 길드 연대기 [{ t, text, key? }]
      registry: null,
    };
  }

  function save() {
    state.lastVisit = Date.now(); // 저장 = 접속 중이라는 뜻
    state.registry = registry.toJSON();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; } // 저장 공간 부족/차단 시에도 게임은 계속 진행
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) state = JSON.parse(raw);
    } catch (e) { state = null; }
    if (!state || state.version !== 3) {
      state = newState();
      registry = Character.createSkillRegistry(null);
      addChronicle('길드 창설', 'founded');
    } else {
      registry = Character.createSkillRegistry(state.registry);
      // 이전 단계 저장 데이터 보정
      if (typeof state.gold !== 'number') state.gold = START_GOLD;
      if (typeof state.guildGrade !== 'number') state.guildGrade = 0;
      if (typeof state.fame !== 'number') state.fame = 0;
      ['matQueue', 'stock', 'display', 'crafts', 'shopLog'].forEach((k) => { if (!Array.isArray(state[k])) state[k] = []; });
      if (!state.materials) state.materials = {};
      // 재료 이름이 몬스터별로 바뀌기 전의 재료는 정리한다 (없는 재료는 쓸 수 없다)
      Object.keys(state.materials).forEach((n) => { if (!Gear.MAT_INFO[n]) delete state.materials[n]; });
      state.matQueue = state.matQueue.filter((q) => Gear.MAT_INFO[q.name]);
      state.board = (state.board || []).filter((k) => !k.item || Gear.MAT_INFO[k.item]);
      if (!state.lobby) state.lobby = null;
      if (typeof state.guildNamed !== 'boolean') state.guildNamed = state.guildName !== '이름 없는 길드' || state.characters.length > 0 || (state.tutorial || 0) > 0;
      if (typeof state.shopAt !== 'number') state.shopAt = Date.now();
      if (!state.nextItem) state.nextItem = 1;
      state.board.forEach((k) => { if (!k.relics) k.relics = []; });
      if (typeof state.lastVisit !== 'number') state.lastVisit = Date.now();
      if (typeof state.timeShift !== 'number') state.timeShift = 0;
      if (!Array.isArray(state.inbox)) state.inbox = [];
      // 파티 개편 이전 저장 데이터: 1인 의뢰는 정리하고 새 구조로 맞춘다
      if (!Array.isArray(state.board)) state.board = [];
      if (!Array.isArray(state.missions)) state.missions = [];
      if (!state.bonds) state.bonds = {};
      if (!state.codex) state.codex = { mon: {} };
      if (!Array.isArray(state.applicants)) state.applicants = [];
      if (typeof state.applicantAt !== 'number') state.applicantAt = Date.now();
      if (typeof state.tutorial !== 'number') state.tutorial = TUTORIAL_DONE; // 이미 하던 길드는 튜토리얼을 건너뛴 것으로 본다
      if (!state.items) state.items = { resetTicket: 0 };
      state.stats = Object.assign(newStats(), state.stats || {}); state.stats.byGrade = state.stats.byGrade || {};
      if (!state.ach) state.ach = {};
      if (!state.facilities) state.facilities = { dorm: 0, board: 0, dojo: 0, ward: 0, archive: 0 };
      if (typeof state.boardAt !== 'number') state.boardAt = Date.now();
      if (!Array.isArray(state.boardGaps)) state.boardGaps = [];
      if (!state.nextContract) state.nextContract = 1;
      if (!state.nextMission) state.nextMission = 1;
      state.inbox = state.inbox.filter((r) => Array.isArray(r.members));
      for (const c of state.characters) delete c.mission;
    }
    tick(); // 오프라인 중 끝난 의뢰부터 정리
    lastReport = processAbsence(); // 저장(=접속 시각 갱신) 전에 미접속 기간부터 계산
    save();
    return state;
  }

  function resetAll() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
    state = newState();
    registry = Character.createSkillRegistry(null);
    addChronicle('길드 창설', 'founded');
    save();
  }

  // 게임 속 현재 시각 (개발용 빨리감기가 반영된 시각)
  const now = () => Date.now() + (state ? state.timeShift || 0 : 0);

  /* ---------- 연대기 ---------- */
  function addChronicle(text, onceKey) {
    if (onceKey && state.chronicle.some((e) => e.key === onceKey)) return false;
    state.chronicle.push({ t: now(), text, key: onceKey || null });
    return true;
  }

  /* ---------- 이름 ---------- */
  const SYL = ['아', '르', '카', '벨', '리', '루', '미', '세', '도', '하', '에', '라', '진', '소', '윤', '테', '노', '펠', '시', '안'];
  function randomName() {
    const n = 2 + Math.floor(Math.random() * 2);
    let s = '';
    for (let i = 0; i < n; i++) s += SYL[Math.floor(Math.random() * SYL.length)];
    return s;
  }

  // 받침 유무에 따라 조사 선택 (예: 이/가, 을/를)
  function pick(word, withBatchim, without) {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    return code >= 0 && code % 28 !== 0 ? withBatchim : without;
  }

  /* ---------- 길드 시설 (금화 사용처) ---------- */
  // 레벨 0에서 시작해 금화로 올린다. 비용 = base * (다음 레벨)^1.7
  // 강화 비용(골드) = 단계별 기본값 × 시설 가중치. 최대 레벨은 길드 등급이 제한한다.
  const FAC_BASE = [200, 500, 900, 1600, 2900, 5200, 9400, 17000];
  const FACILITIES = [
    { id: 'dorm',    name: '기숙사',   max: 8, w: 1.0, desc: '보유할 수 있는 모험가 수가 늘어요.',
      effect: (lv) => `보유 ${10 + 7 * lv}명` },
    { id: 'board',   name: '의뢰판', max: 8, w: 1.2, desc: '게시판에 걸리는 의뢰가 늘고, 새 의뢰가 더 빨리 들어와요.',
      effect: (lv) => `게시판 ${6 + lv}건 · ${Math.round(BOARD_SPAWN_MIN * (1 - 0.05 * lv) * 10) / 10}분마다 새 의뢰` },
    { id: 'dojo',    name: '수련장',   max: 8, w: 1.0, desc: '동시에 훈련할 수 있는 인원과 훈련 경험치가 늘어요.',
      effect: (lv) => `동시 훈련 ${1 + Math.ceil(lv / 2)}명 · 경험치 ${lv ? '+' + 10 * lv + '%' : '기본'}` },
    { id: 'ward',    name: '병동',     max: 8, w: 0.8, desc: '부상 회복 시간이 줄어요.',
      effect: (lv) => `회복 시간 ${lv ? '-' + 8 * lv + '%' : '기본'}` },
    { id: 'archive', name: '기록실',   max: 8, w: 0.6, desc: '도감에 등록된 몬스터에게 주는 피해가 늘고, 상세 정보가 더 빨리 열려요.',
      effect: (lv) => lv ? `피해 +${Math.min(8, lv)}% · 상세 정보 조건 -${8 * lv}%` : '효과 없음' },
    { id: 'workshop', name: '대장간',    max: 8, w: 1.1, desc: '장비를 만들어요. 제작이 빨라지고, 동시에 더 많이 만들 수 있고, 좋은 품질이 잘 나와요.',
      effect: (lv) => `제작 시간 -${5 * lv}% · 동시 ${1 + Math.ceil(lv / 3)}개 · 품질 보정 +${3 * lv}%p` },
    { id: 'shop',    name: '장터',     max: 8, w: 0.9, desc: '만든 장비를 진열해요. 모험가들이 와서 알아서 사 가요.',
      effect: (lv) => `진열 ${2 + lv}칸 · 방문 빈도 +${8 * lv}%` },
  ];
  const facLevel = (id) => (state.facilities && state.facilities[id]) || 0;
  const facCap = (f) => Math.min(f.max, FAC_CAP[gradeIdx()]);
  const facCost = (id) => { const f = FACILITIES.find((x) => x.id === id); return Math.round(FAC_BASE[Math.min(facLevel(id), 7)] * f.w); };
  const rosterCap = () => 10 + 7 * facLevel('dorm');
  const boardMax = () => BOARD_MAX + facLevel('board');
  const spawnMin = () => BOARD_SPAWN_MIN * (1 - 0.05 * facLevel('board'));
  const analysisTrials = () => 30; // 위험도 분석 시설은 폐지: 기본 표시만
  const injuryMinutes = (m) => Math.max(5, Math.round(m * (1 - 0.08 * facLevel('ward'))));

  function upgradeFacility(id) {
    const f = FACILITIES.find((x) => x.id === id);
    if (!f) return { ok: false, reason: '없는 시설이에요.' };
    if (f.locked) return { ok: false, reason: '아직 쓸 수 없는 시설이에요.' };
    if (facLevel(id) >= f.max) return { ok: false, reason: '이미 최고 단계예요.' };
    if (facLevel(id) >= facCap(f)) return { ok: false, reason: `길드 등급을 올려야 해요. (${guildGrade()}급: 최대 ${facCap(f)}단계)` };
    const cost = facCost(id);
    if (state.gold < cost) return { ok: false, reason: `금화가 부족해요. (${cost} 필요)` };
    state.gold -= cost;
    state.facilities[id] = facLevel(id) + 1;
    addChronicle(`${f.name} 확장 (${state.facilities[id]}단계)`, 'fac-' + id + '-' + state.facilities[id]);
    save();
    return { ok: true };
  }

  /* ---------- 훈련 (안전한 성장) ---------- */
  // 의뢰와 달리 목숨의 위험이 없고, 금화를 내면 시간이 지난 뒤 경험치를 얻는다.
  const TRAIN_OPTIONS = [30, 120];                       // 분
  const trainSlots = () => 1 + Math.ceil(facLevel('dojo') / 2);
  const trainees = () => byStatus('ACTIVE').filter((c) => c.training);
  function trainPreview(c, minutes) {
    const eff = 1 + 0.1 * facLevel('dojo');
    return {
      cost: Math.round(TRAIN_BY_GRADE[gradeIdx()] * (minutes / 120)),
      exp: Math.round(6 * Math.pow(c.level, 1.3) * Math.pow(minutes / 30, 0.9) * eff * Combat.expMulOf(c)),
    };
  }
  function startTraining(id, minutes) {
    const c = byId(id);
    if (!c || !isFree(c)) return { ok: false, reason: '훈련을 보낼 수 없는 모험가예요.' };
    if (!TRAIN_OPTIONS.includes(minutes)) return { ok: false, reason: '없는 훈련이에요.' };
    if (trainees().length >= trainSlots()) return { ok: false, reason: `훈련장이 가득 찼어요. (동시에 ${trainSlots()}명) 훈련장을 확장해 보세요.` };
    if (c.level >= Character.MAX_LEVEL) return { ok: false, reason: '이미 최고 레벨이에요.' };
    if (Character.needsAdvance(c)) return { ok: false, reason: '전직을 해야 더 성장할 수 있어요.' };
    const pv = trainPreview(c, minutes);
    if (state.gold < pv.cost) return { ok: false, reason: `금화가 부족해요. (${pv.cost} 필요)` };
    state.gold -= pv.cost;
    const t = now();
    c.training = { startedAt: t, until: t + minutes * MINUTE, minutes, exp: pv.exp, cost: pv.cost };
    save();
    return { ok: true };
  }
  // 훈련 취소: 경험치는 없고 들인 시간만 날아간다 (낸 금화는 돌려받는다)
  function cancelTraining(id) {
    const c = byId(id);
    if (!c || !c.training) return { ok: false, reason: '훈련 중이 아니에요.' };
    state.gold += c.training.cost || 0; c.training = null; save();
    return { ok: true };
  }
  function finishTraining(c) {
    state.stats.trained++;
    const tr = c.training;
    delete c.training;
    const old = c.level;
    Character.addExp(c, tr.exp);
    state.inbox.push({ id: 'r' + tr.until + '-t' + c.id, t: tr.until, questName: '훈련', outcome: 'train', gold: 0, auto: false, killed: 0,
      members: [{ id: c.id, name: c.name, fate: 'ok', exp: tr.exp, oldLevel: old, newLevel: c.level, injuryMin: 0, kills: 0 }], log: [] });
    if (state.inbox.length > 40) state.inbox.splice(0, state.inbox.length - 40);
  }

  /* ---------- 영입 ---------- */
  /* ---------- 영입 면접 (지원자) ---------- */
  // 지원자는 시간이 지나며 찾아오고, 각자 머무는 시간(마감)이 있다.
  // 외형 ID는 채용이 확정될 때에만 길드의 것이 된다. 돌려보내거나 떠난 지원자의 외형은 그냥 사라지는 게 아니라
  // 다시 어떤 지원자의 모습으로 나올 수 있다 (같은 얼굴, 다른 사람: 등급·재능·특성은 새로 정해진다).
  const APPLICANT_MAX = 1, APPLICANT_MIN = 1, APPLICANT_SPAWN_MIN = 45;

  function randomAppearanceId() {
    const buf = new Uint32Array(2);
    (typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(buf) : buf.forEach((_, i) => { buf[i] = Math.floor(Math.random() * 4294967296); }));
    return ((BigInt(buf[0]) << 32n) | BigInt(buf[1])) % Appearance.TOTAL;
  }
  // 길드가 이미 쓰고 있거나, 지금 면접을 기다리는 외형은 피한다
  function freshAppearanceId() {
    const used = new Set(state.characters.map((c) => c.appearanceId));
    state.applicants.forEach((a) => used.add(a.char.appearanceId));
    let id;
    do { id = randomAppearanceId(); } while (used.has(String(id)));
    return id;
  }
  function makeCharacter() {
    const index = BigInt(state.nextIndex);
    state.nextIndex = (index + 1n).toString();
    const appearanceId = freshAppearanceId();
    const c = Character.createCharacter({ index, appearanceId, registry, deferSkill: true, skillChanceMultiplier: skillBoost });
    c.name = randomName();
    c.appearance = Appearance.decodeAppearance(appearanceId);
    c.level = 1; c.exp = 0; c.kills = 0; c.quests = 0;
    return c;
  }
  function spawnApplicant(t) {
    const c = makeCharacter();
    const hours = 3 + Math.floor(Math.random() * 8); // 3~10시간
    const a = { id: 'a' + c.index, char: c, story: Story.make(c), hint: c.skillPending ? Story.hint() : null, createdAt: t, expiresAt: t + hours * 3600000 };
    state.applicants.push(a);
    return a;
  }
  function refreshApplicants() {
    const t = now();
    const before = state.applicants.length;
    state.applicants = state.applicants.filter((a) => a.expiresAt > t);
    if (state.applicants.length > 1) state.applicants.length = 1; // 접수처에는 한 번에 한 명만 온다
    let changed = state.applicants.length !== before;
    const avgQ = state.display.length ? state.display.reduce((a, d) => a + d.item.q, 0) / state.display.length : 0;
    const spawn = APPLICANT_SPAWN_MIN * (1 - Math.min(0.3, 0.075 * avgQ)); // 좋은 장비가 진열되면 지원자가 더 자주 찾아온다
    const steps = Math.floor((t - state.applicantAt) / (spawn * MINUTE));
    if (steps > 0) {
      state.applicantAt += steps * spawn * MINUTE;
      for (let i = 0; i < steps && state.applicants.length < APPLICANT_MAX; i++) { spawnApplicant(t); changed = true; }
    }
    while (state.applicants.length < APPLICANT_MIN) { spawnApplicant(t); changed = true; }
    return changed;
  }

  // 영입할 수 없는 이유 (가능하면 null)
  function recruitBlock() {
    if (byStatus('ACTIVE').length >= rosterCap()) return `기숙사가 가득 찼어요. (정원 ${rosterCap()}명) 기숙사를 늘려 보세요.`;
    if (state.gold < recruitCost()) return `금화가 부족해요. (${recruitCost()} 필요)`;
    return null;
  }
  // 채용 확정: 고유스킬이 이때 정해지고, 길드의 모험가가 된다
  function admit(c) {
    if (c.skillPending) {
      c.uniqueSkill = registry.acquireRandom(c.id, Math.random); // 비어 있는 스킬이 없으면 null
      delete c.skillPending;
    }
    c.recruitedAt = Date.now();
    state.characters.push(c); state.stats.recruited++;

    // 연대기 (처음 일어난 일만 / 특별한 일)
    addChronicle(`첫 번째 모험가 ${c.name} 영입`, 'first-recruit');
    if (['Epic', 'Unique', 'Legendary'].includes(c.grade)) {
      addChronicle(`첫 번째 ${c.grade} ${c.name} 탄생`, 'born:' + c.grade);
    }
    if (c.uniqueSkill !== null) {
      const sk = Character.SKILL_NAMES[c.uniqueSkill];
      addChronicle(`${c.name}${pick(c.name, '이', '가')} 고유스킬 「${sk}」${pick(sk, '을', '를')} 얻음`, null);
      addChronicle(`첫 번째 고유스킬 보유자 ${c.name} 탄생`, 'first-skill');
    }
    save();
    return c;
  }
  function hire(applicantId) {
    const a = state.applicants.find((x) => x.id === applicantId);
    if (!a) return { ok: false, reason: '이미 떠난 지원자예요.' };
    const block = recruitBlock();
    if (block) return { ok: false, reason: block };
    state.gold -= recruitCost();
    state.applicants = state.applicants.filter((x) => x !== a);
    a.char.story = a.story;
    return { ok: true, character: admit(a.char) };
  }
  // 돌려보낸 지원자는 이 길드에 다시 오지 않는다. 외형은 소모되지 않는다.
  function dismissApplicant(applicantId) {
    state.applicants = state.applicants.filter((x) => x.id !== applicantId);
    save();
  }
  // 개발용: 면접 없이 바로 영입 (금화·정원 무시 옵션)
  function recruit(opts) {
    if (!(opts && opts.free)) { if (recruitBlock()) return null; state.gold -= recruitCost(); }
    return admit(makeCharacter());
  }

  /* ---------- 사망 ---------- */
  // 의뢰 중 사망했을 때 호출된다.
  function kill(characterId, cause) {
    const c = state.characters.find((x) => x.id === characterId);
    if (!c || c.status === 'DEAD') return null;
    c.status = 'DEAD';
    c.diedAt = now();
    c.deathCause = cause || '알 수 없음';
    state.stats.deaths++; state.stats.streak = 0;
    c.epitaph = c.lastWords || (c.story && c.story[1]) || '';
    if (c.uniqueSkill !== null) registry.release(c.uniqueSkill); // 스킬은 다시 뽑힐 수 있게 풀림 (기록은 c에 남음)

    addChronicle(`${c.name} 사망 (${c.deathCause})`, null);
    addChronicle(`첫 번째 사망자 ${c.name} 발생`, 'first-death');
    if (c.grade === 'Legendary') addChronicle(`최초 Legendary ${c.name} 사망`, 'died:Legendary');
    save();
    return c;
  }

  /* ---------- 관계 (유대) ---------- */
  // 같은 파티로 의뢰를 함께 해내면 두 사람의 유대가 쌓인다. 유대가 깊을수록 함께 싸울 때 강해지고,
  // 한쪽이 죽으면 남은 사람은 한동안 슬픔에 빠진다.
  const BOND_LEVELS = [
    { min: 0,  name: '지인', pct: 0,    dm: 0 },
    { min: 20, name: '동료', pct: 0.02, dm: 0 },
    { min: 50, name: '전우', pct: 0.04, dm: 0.05 },
    { min: 80, name: '막역', pct: 0.07, dm: 0.10 },
  ];
  const GRIEF_HOURS = 6;       // 슬픔 지속 시간 = 6시간 × 관계 단계
  const GRIEF_MUL = 0.92;      // 슬픔 중 공격·방어 배율
  const BOND_CAP_PCT = 0.15, BOND_CAP_DM = 0.2;
  const bondKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const bondValue = (a, b) => state.bonds[bondKey(a, b)] || 0;
  const bondIdx = (v) => { let i = 0; BOND_LEVELS.forEach((l, k) => { if (v >= l.min) i = k; }); return i; };
  const bondInfo = (a, b) => { const v = bondValue(a, b); const i = bondIdx(v); return { value: v, idx: i, name: BOND_LEVELS[i].name, ...BOND_LEVELS[i] }; };
  // 유대를 올리고, 단계가 오르면 그 정보를 돌려준다
  function addBond(a, b, delta) {
    const k = bondKey(a, b), before = bondIdx(state.bonds[k] || 0);
    state.bonds[k] = Math.min(100, (state.bonds[k] || 0) + delta);
    const after = bondIdx(state.bonds[k]);
    if (after > before) {
      const x = byId(a), y = byId(b);
      addChronicle(`${x.name}${pick(x.name, '과', '와')} ${y.name}의 사이가 「${BOND_LEVELS[after].name}」${pick(BOND_LEVELS[after].name, '이', '가')} 되었다`, 'bond-' + k + '-' + after);
      return { a: x.name, b: y.name, name: BOND_LEVELS[after].name };
    }
    return null;
  }
  const griefUntil = (c) => (c.grief && c.grief.until > now() ? c.grief.until : 0);
  function bondsOf(id) {
    return state.characters.filter((o) => o.id !== id && (state.bonds[bondKey(id, o.id)] || 0) > 0)
      .map((o) => ({ other: o, ...bondInfo(id, o.id) })).sort((x, y) => y.value - x.value);
  }
  // 전투용 파티원 목록: 능력치에 유대·슬픔을 반영한다 (위험도 계산에도 이걸 쓴다)
  function buildMembers(chars) {
    const ms = chars.map(Combat.memberFrom);
    ms.forEach((m, i) => {
      let pct = 0, dm = 0;
      chars.forEach((o, j) => { if (i !== j) { const b = bondInfo(chars[i].id, o.id); pct += b.pct; dm += b.dm; } });
      pct = Math.min(BOND_CAP_PCT, pct); dm = Math.min(BOND_CAP_DM, dm);
      const gr = griefUntil(chars[i]) ? GRIEF_MUL : 1;
      m.tw = { atk: (1 + pct) * gr, def: (1 + pct) * gr, death: dm };
    });
    return ms;
  }

  /* ---------- 의뢰 게시판 ---------- */
  // 길드로 의뢰가 들어온다. 각 의뢰에는 마감이 있고, 마감이 지나면 사라진다.
  const SPECIAL_CHANCE = 0.14;         // 기간 한정 의뢰가 될 확률
  const BOARD_MAX = 6;                 // 게시판에 동시에 걸리는 의뢰 수
  const BOARD_SPAWN_MIN = 20;          // 새 의뢰가 들어오는 간격(분)
  const INJURY = { retreat: 30, out: 45, down: 120 }; // 전체 후퇴 / 개별 이탈 / 쓰러졌다 살아남음 (분)
  const WIPE_EXP = 0.25;               // 전멸(사망 없이 쓰러짐) 시 경험치 비율
  const RETREAT_EXP = 0.5;             // 후퇴 시 (처치 비율만큼) 받는 경험치 비율

  // 등급별 의뢰 유형 비중: 채집·도움은 F/E에 몰려 있고 D부터는 거의 없다
  const TYPE_WEIGHT = { F: { gather: 30, help: 28, sweep: 22, wave: 12, boss: 8 }, E: { gather: 24, help: 20, sweep: 30, wave: 14, boss: 12 },
    D: { gather: 6, help: 4, sweep: 45, wave: 25, boss: 20 }, C: { gather: 2, help: 1, sweep: 47, wave: 28, boss: 22 },
    B: { sweep: 48, wave: 28, boss: 24 }, A: { sweep: 48, wave: 28, boss: 24 }, S: { sweep: 46, wave: 28, boss: 26 } };
  function pickType(grade) {
    const w = TYPE_WEIGHT[grade], keys = Object.keys(w), sum = keys.reduce((a, k) => a + w[k], 0);
    let r = Math.random() * sum;
    for (const k of keys) { r -= w[k]; if (r < 0) return k; }
    return keys[0];
  }
  function spawnContract(t) {
    const gi = Math.floor(Math.random() * (gradeIdx() + 1)); // 길드 등급 이하의 의뢰만 걸린다
    const grade = GRADES[gi];
    const top = byStatus('ACTIVE').reduce((m, x) => Math.max(m, x.level), 1);
    const c = Combat.randomContract(grade, pickType(grade), t, Math.random, top);
    c.id = 'k' + (state.nextContract++);
    if (Math.random() < SPECIAL_CHANCE && gradeIdx() >= 1) { // 기간 한정 의뢰: 보상이 크지만 금방 사라진다
      c.kind = 'special'; c.gold = Math.round(c.gold * 1.8); c.exp = Math.round(c.exp * 1.5);
      c.expiresAt = t + (1 + Math.floor(Math.random() * 3)) * 3600000;
    }
    state.board.push(c);
    return c;
  }
  // 의뢰가 빠져 빈 자리가 생기면 그 시각을 적어 두고, 5분이 지나야 새 의뢰가 그 자리를 채운다
  const GAP_FILL_MIN = 5;
  function addBoardGap(t) { if (!tutorialActive()) { if (!Array.isArray(state.boardGaps)) state.boardGaps = []; state.boardGaps.push(t); } }
  // 마감 지난 의뢰를 치우고, 시간이 흐른 만큼 새 의뢰를 채운다
  function refreshBoard() {
    const t = now();
    if (!Array.isArray(state.boardGaps)) state.boardGaps = [];
    const before = state.board.length;
    state.board.filter((k) => k.expiresAt <= t).forEach((k) => addBoardGap(k.expiresAt));
    state.board = state.board.filter((k) => k.expiresAt > t);
    let changed = state.board.length !== before;
    state.boardGaps.sort((a, b) => a - b);
    // 빈 자리가 생긴 지 5분이 지났다면 새 의뢰가 걸린다
    while (!tutorialActive() && state.boardGaps.length && state.boardGaps[0] + GAP_FILL_MIN * MINUTE <= t) {
      state.boardGaps.shift();
      if (state.board.length < boardMax()) { spawnContract(t); changed = true; }
    }
    if (state.boardGaps.length > boardMax()) state.boardGaps.length = boardMax();
    // 게시판이 확장돼 자리가 늘었을 때만, 일정 간격으로 새 의뢰가 들어온다
    const steps = tutorialActive() || state.boardGaps.length ? 0 : Math.floor((t - state.boardAt) / (spawnMin() * MINUTE));
    if (steps > 0) {
      state.boardAt += steps * spawnMin() * MINUTE;
      for (let i = 0; i < steps && state.board.length < boardMax(); i++) { spawnContract(t); changed = true; }
    } else if (state.boardGaps.length) state.boardAt = t;
    if (tutorialActive()) { // 튜토리얼 중에는 고정된 연습 의뢰 1건만 걸려 있다
      if (!state.board.some((k) => k.tutorial) && !state.missions.some((m) => m.contract.tutorial)) { addTutorialContract(); changed = true; }
      return changed;
    }
    while (state.board.length < 3 && !state.boardGaps.length) { spawnContract(t); changed = true; } // 처음 시작할 때는 최소 3건이 걸려 있다
    return changed;
  }


  /* ---------- 도감 지식 (기획서 23장) ---------- */
  // 귀환 보고가 쌓일수록 몬스터 정보가 열린다. 0 미확인 / 1 이름 / 2 속성·약점 / 3 상세
  const knowT = (name) => Math.max(2, Math.round((Gear.MONSTERS[name] && Gear.MONSTERS[name].boss ? 3 : 10) * (1 - 0.08 * facLevel('archive'))));
  function knowledge(name) {
    const r = (state.codex.mon[name] && state.codex.mon[name].reports) || 0, T = knowT(name);
    return r >= T ? 3 : r >= Math.ceil(T / 2) ? 2 : r >= 1 ? 1 : 0;
  }

  /* ---------- 재료 · 장비 · 대장간 · 상점 (기획서 24장) ---------- */
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const nextItemId = () => 'i' + (state.nextItem++);
  const gearScore = (it, c) => (it ? Gear.power(it) * Gear.fit(it, Character.prefOf(c)) : 0);
  // 모험가가 장비를 얻었을 때: 더 좋으면 끼고 이전 장비는 판매, 아니면 바로 판매. 결과 문장을 돌려준다.
  function gainGear(c, item, label) {
    c.equip = c.equip || {};
    const cur = c.equip[item.slot];
    if (Gear.usable(item, c) && gearScore(item, c) > gearScore(cur, c)) {
      c.equip[item.slot] = item;
      let t = `${c.name}: ${Gear.itemName(item)} 착용 (${label})`;
      if (cur) { c.wallet = (c.wallet || 0) + Gear.sellValue(cur); t += ` · 이전 장비 판매 +${Gear.sellValue(cur)}`; }
      return t;
    }
    const v = Gear.sellValue(item);
    c.wallet = (c.wallet || 0) + v;
    return `${c.name}: ${Gear.itemName(item)} 판매 +${v} (${label})`;
  }
  function queueMaterial(name, qty, at) {
    state.matQueue.push({ id: 'q' + (state.nextItem++), name, qty, expiresAt: at + DAY });
  }
  const matUnit = (name) => { const mi = Gear.MAT_INFO[name], mo = mi.monster && Gear.MONSTERS[mi.monster]; return Math.round(Gear.MAT_PRICE[mi.grade] * (mo && mo.boss ? 2.5 : 1)); };
  function buyMaterial(id) {
    const list = id ? state.matQueue.filter((q) => q.id === id) : state.matQueue.slice();
    const cost = list.reduce((a, q) => a + q.qty * matUnit(q.name), 0);
    if (!list.length) return { ok: false, reason: '매입할 재료가 없어요.' };
    if (state.gold < cost) return { ok: false, reason: `금화가 부족해요. (${cost} 필요)` };
    state.gold -= cost;
    list.forEach((q) => { state.materials[q.name] = (state.materials[q.name] || 0) + q.qty; });
    state.matQueue = state.matQueue.filter((q) => !list.includes(q));
    save();
    return { ok: true, cost };
  }
  // 매입하지 않고 돌려보낸다 (재료는 사라진다)
  function declineMaterial(id) {
    const list = id ? state.matQueue.filter((q) => q.id === id) : state.matQueue.slice();
    if (!list.length) return { ok: false, reason: '돌려보낼 재료가 없어요.' };
    state.matQueue = state.matQueue.filter((q) => !list.includes(q));
    save();
    return { ok: true, n: list.length };
  }
  const matOfGrade = (g) => Object.keys(state.materials).filter((n) => state.materials[n] > 0 && Gear.MAT_INFO[n].grade === g);
  const matCount = (g) => matOfGrade(g).reduce((a, n) => a + state.materials[n], 0);

  const craftSlots = () => 1 + Math.ceil(facLevel('workshop') / 3);
  const craftMinutes = (g) => Math.max(1, Math.round(Gear.CRAFT_MIN[g] * (1 - 0.05 * facLevel('workshop'))));
  const recipeOpen = (r) => facLevel('workshop') >= r.unlock;
  const matHave = (n) => state.materials[n] || 0;
  const recipeFee = (r) => Gear.CRAFT_FEE(r.g);
  function startCraft(recipeId) {
    const r = Gear.recipeById(recipeId);
    if (!r) return { ok: false, reason: '없는 제작법이에요.' };
    if (r.g > gradeIdx()) return { ok: false, reason: '길드 등급이 낮아 아직 만들 수 없어요.' };
    if (!recipeOpen(r)) return { ok: false, reason: `대장간 Lv.${r.unlock}이 되어야 배울 수 있는 제작법이에요.` };
    if (state.crafts.length >= craftSlots()) return { ok: false, reason: `대장간이 가득 찼어요. (동시 ${craftSlots()}개)` };
    const lack = r.mats.find((x) => matHave(x.name) < x.qty);
    if (lack) return { ok: false, reason: `재료가 부족해요. (${lack.name} ${lack.qty}개 필요)` };
    const fee = recipeFee(r);
    if (state.gold < fee) return { ok: false, reason: `금화가 부족해요. (${fee} 필요)` };
    state.gold -= fee;
    r.mats.forEach((x) => { state.materials[x.name] -= x.qty; if (state.materials[x.name] <= 0) delete state.materials[x.name]; });
    const q = Gear.rollQuality(Math.random, 3 * facLevel('workshop'));
    const item = Gear.makeItem(nextItemId(), r.slot, r.g, q, Math.random, r.t);
    const t = now();
    state.crafts.push({ id: item.id, item, startedAt: t, doneAt: t + craftMinutes(r.g) * MINUTE });
    save();
    return { ok: true };
  }
  function finishCrafts(t) {
    const done = state.crafts.filter((c) => c.doneAt <= t);
    if (!done.length) return false;
    state.crafts = state.crafts.filter((c) => c.doneAt > t);
    done.forEach((c) => {
      state.stats.crafted++;
      state.stock.push(c.item);
      if (c.item.q === 4) addChronicle(`대장간에서 걸작 「${Gear.itemName(c.item)}」 완성`, 'masterpiece-' + c.item.id);
    });
    return true;
  }

  const addShopLog = (text) => { state.shopLog.push({ t: now(), who: '', text }); if (state.shopLog.length > 40) state.shopLog.shift(); };
  // 떨이 처분: 보급고의 장비를 적정가의 반값에 바로 넘긴다 (안 팔리는 장비 정리용)
  const dumpPrice = (item) => Math.round(Gear.price(item) * 0.5);
  function dumpItem(itemId) {
    const i = state.stock.findIndex((x) => x.id === itemId);
    if (i < 0) return { ok: false, reason: '보급고에 없는 장비예요.' };
    const item = state.stock.splice(i, 1)[0], got = dumpPrice(item);
    state.gold += got; addShopLog(`떨이로 「${Gear.itemName(item)}」을(를) 넘겼다. +${got}금`);
    save(); return { ok: true, gold: got };
  }
  function dumpBelow(maxQp) {
    const list = state.stock.filter((it) => Gear.qpOf(it) < maxQp);
    if (!list.length) return { ok: false, reason: '조건에 맞는 장비가 없어요.' };
    let sum = 0; list.forEach((it) => { sum += dumpPrice(it); });
    state.stock = state.stock.filter((it) => Gear.qpOf(it) >= maxQp);
    state.gold += sum; addShopLog(`떨이로 장비 ${list.length}점을 넘겼다. +${sum}금`);
    save(); return { ok: true, n: list.length, gold: sum };
  }
  const shopSlots = () => 2 + facLevel('shop');
  function displayItem(itemId) {
    if (state.display.length >= shopSlots()) return { ok: false, reason: `진열대가 가득 찼어요. (${shopSlots()}칸)` };
    const i = state.stock.findIndex((x) => x.id === itemId);
    if (i < 0) return { ok: false, reason: '보급고에 없는 장비예요.' };
    const item = state.stock.splice(i, 1)[0];
    state.display.push({ item, price: Gear.price(item) });
    save(); return { ok: true };
  }
  function undisplayItem(itemId) {
    const i = state.display.findIndex((d) => d.item.id === itemId);
    if (i < 0) return { ok: false };
    state.stock.push(state.display.splice(i, 1)[0].item);
    save(); return { ok: true };
  }
  function setPrice(itemId, price) {
    const d = state.display.find((x) => x.item.id === itemId);
    if (!d) return { ok: false };
    d.price = Math.max(1, Math.min(Math.round(Gear.price(d.item) * 3), Math.round(price)));
    save(); return { ok: true };
  }
  // 모험가의 방문: 적정가 범위 안이고, 지갑 돈이 가격 이상이며, 같은 칸의 현재 장비보다 좋은 것만 산다.
  // 모험가는 적정 가격 ±20% 안에 올려 둔 것만 보러 온다.
  const FAIR_BAND = 0.2;
  const fairRange = (item) => { const f = Gear.price(item); return [Math.round(f * (1 - FAIR_BAND)), Math.round(f * (1 + FAIR_BAND))]; };
  const inFairBand = (d) => { const [lo, hi] = fairRange(d.item); return d.price >= lo && d.price <= hi; };
  function shopVisit(c, t) {
    let best = null, bestScore = 0;
    for (const d of state.display) {
      if (!Gear.usable(d.item, c) || d.price > (c.wallet || 0)) continue;
      const cur = c.equip && c.equip[d.item.slot];
      const s = gearScore(d.item, c);
      if (s <= gearScore(cur, c)) continue;
      if (!inFairBand(d)) continue; // 적정 가격 범위 밖이면(비싸든 싸든) 방문하지 않는다
      if (s > bestScore) { best = d; bestScore = s; }
    }
    if (!best) return false;
    c.wallet -= best.price; state.gold += best.price; state.stats.sold++;
    state.display = state.display.filter((d) => d !== best);
    const old = c.equip && c.equip[best.item.slot];
    const msg = gainGear(c, best.item, '구매').replace(/ \(구매\)$/, '');
    state.shopLog.push({ t, who: c.name, text: `${c.name}${pick(c.name, '이', '가')} ${Gear.itemName(best.item)}${pick(Gear.itemName(best.item), '을', '를')} ${best.price}금에 샀다` });
    if (state.shopLog.length > 30) state.shopLog.shift();
    if (best.item.q === 4) { addChronicle(`걸작 「${Gear.itemName(best.item)}」이(가) ${c.name}에게 팔렸다`, null); state.fame += Gear.QUALITY ? FAME_BY_GRADE[best.item.g] : 0; }
    return true;
  }
  function processShop(t) {
    const step = 10 * MINUTE;
    let steps = Math.min(144, Math.floor((t - state.shopAt) / step));
    if (steps <= 0) return false;
    state.shopAt += steps * step;
    if (!state.display.length) return false;
    const p = (1 / 12) * (1 + 0.08 * facLevel('shop'));
    let changed = false;
    for (let i = 0; i < steps && state.display.length; i++) {
      for (const c of byStatus('ACTIVE')) {
        if (!isFree(c) || Math.random() > p) continue;
        if (shopVisit(c, state.shopAt)) changed = true;
        if (!state.display.length) break;
      }
    }
    return changed;
  }

  /* ---------- 파티 의뢰 (실시간 파견) ---------- */
  // 출발하면 위기 직전까지 전투를 미리 굴려 두고(state.missions), 시간이 지나면서 공개된다.
  //  - 위기가 없는 의뢰: 걸리는 시간이 지나면 결과가 나온다.
  //  - 위기가 있는 의뢰: 중간(CRISIS_AT)에 위기 신호가 온다. 제한 시간 안에
  //      전체 후퇴 / 계속 싸운다 중에서 정한다.
  //    결정하지 않으면 자동으로 "계속 싸운다"가 된다.
  const byId = (id) => state.characters.find((x) => x.id === id) || null;
  const missionOf = (c) => state.missions.find((m) => m.memberIds.includes(c.id)) || null;
  const missionById = (id) => state.missions.find((m) => m.id === id) || null;
  const isFree = (c) => c.status === 'ACTIVE' && !missionOf(c) && !injuredUntil(c) && !c.training;

  // 전투 시계가 st.t(초)에 닿는 실제 시각 (위기 결정을 기다린 시간은 시계가 멈춰 있다)
  const simMs = (m) => m.startedAt + (m.paused || 0) + Math.round(m.battle.t * 1000);
  // 지금 전투 시계(초)
  const battleClock = (m) => Math.max(0, Math.min(m.battle.t, (now() - m.startedAt - (m.paused || 0)) / 1000));
  const battleView = (m) => Combat.view(m.battle, battleClock(m), m.phase === 'crisis');

  /* ---------- 초기화권 ----------
     외형·희귀도·재능·기본 직업·고유스킬·장비는 남기고, 레벨·전직 경로·모험가 등급·유대는 처음으로 돌린다. (결제는 아직 없다: 보유 수량만 센다) */
  const resetTickets = () => (state.items && state.items.resetTicket) || 0;
  function resetCharacter(id) {
    const c = byId(id);
    if (!c || c.status !== 'ACTIVE') return { ok: false, reason: '현역 모험가만 초기화할 수 있어요.' };
    if (!isFree(c)) return { ok: false, reason: '의뢰·훈련·회복 중에는 초기화할 수 없어요.' };
    if (resetTickets() < 1) return { ok: false, reason: '초기화권이 없어요.' };
    state.items.resetTicket--; state.stats.resets++;
    c.level = 1; c.exp = 0; c.path = [c.path[0]]; c.rank = 0; c.rankPts = 0;
    for (const k of Object.keys(state.bonds)) if (k.split('|').includes(String(c.id))) delete state.bonds[k];
    c.grief = null;
    addChronicle(`${c.name}${pick(c.name, '이', '가')} 초기화권을 써서 처음부터 다시 걷기 시작했다`, null);
    save(); return { ok: true };
  }
  const grantResetTicket = (n) => { state.items.resetTicket = resetTickets() + (n || 1); save(); };

  /* ---------- 튜토리얼 (건너뛸 수 없다) ---------- */
  // 연습 의뢰: 몬스터가 약해서 튜토리얼 첫 전투에서 목숨을 잃을 걱정이 거의 없다
  function addTutorialContract() {
    const ex = state.board.find((k) => k.tutorial); if (ex) { ex.expiresAt = now() + 24 * 3600000; return ex; } // 이미 걸려 있으면 새로 만들지 않는다
    const tpl = Combat.templateById('F-sweep');
    const k = Combat.makeContract(tpl, now(), Math.random, 1);
    k.name = '연습 의뢰: ' + tpl.name; k.level = 1; k.exp = Combat.questExp(3); k.gold = 50; k.easy = 0.03; k.total = 4; k.min = 2; k.max = 3; k.size = 2;
    k.id = 'k' + (state.nextContract++); k.expiresAt = now() + 24 * 3600000; k.tutorial = true;
    state.board.unshift(k); save(); return k;
  }
  const tutorialStep = () => state.tutorial;
  const tutorialActive = () => state.tutorial < TUTORIAL_DONE;
  function setTutorial(n) { state.tutorial = n; save(); }
  // 게임이 막히지 않게: 현역도 없고 진행 중 의뢰도 없는데 돈이 모자라면 길드 지원금으로 한 명 맞이할 수 있게 한다
  /* ---------- 업적 · 도감 진행도 ---------- */
  const monTotal = () => Monsters.total();
  const monKnown = () => Object.keys(state.codex.mon).filter((n) => knowledge(n) >= 1).length;
  const codexPct = () => Math.floor((100 * monKnown()) / Math.max(1, monTotal()));
  const bondVals = () => Object.values(state.bonds);
  const STAT = {
    clears: () => state.stats.clears, best: () => state.stats.best, crisisWins: () => state.stats.crisisWins, specials: () => state.stats.specials,
    retreats: () => state.stats.retreats, wipes: () => state.stats.wipes, kills: () => state.stats.kills, goldEarned: () => state.stats.goldEarned,
    recruited: () => state.stats.recruited, trained: () => state.stats.trained, resets: () => state.stats.resets, deaths: () => state.stats.deaths,
    mourns: () => state.stats.mourns, talks: () => state.stats.talks, crafted: () => state.stats.crafted, sold: () => state.stats.sold,
    actives: () => byStatus('ACTIVE').length,
    maxLevel: () => state.characters.reduce((a, c) => Math.max(a, c.level || 0), 0),
    maxRank: () => state.characters.reduce((a, c) => Math.max(a, c.rank || 0), 0),
    skillHolders: () => state.characters.filter((c) => c.uniqueSkill !== null && c.uniqueSkill !== undefined).length,
    rareHolders: () => state.characters.filter((c) => ['Epic', 'Unique', 'Legendary'].includes(c.grade)).length,
    bondBest: () => bondVals().reduce((a, v) => Math.max(a, v), 0),
    bondPairs: () => bondVals().filter((v) => v >= 20).length,
    talkedWho: () => state.characters.filter((c) => c.talk && c.talk.count > 0).length,
    grade: () => gradeIdx(), fameNow: () => state.fame,
    facTotal: () => Object.values(state.facilities || {}).reduce((a, v) => a + v, 0),
    codexPct: () => codexPct(), codexN: () => monKnown(),
    skillsSeen: () => { let n = 0; for (let i = 0; i < Character.SKILL_COUNT; i++) if (registry.historyOf(i).length) n++; return n; },
  };
  'FEDCBAS'.split('').forEach((g) => { STAT['g' + g] = () => state.stats.byGrade[g] || 0; });
  ['dorm', 'board', 'dojo', 'ward', 'archive', 'workshop', 'shop'].forEach((f) => { STAT['fac_' + f] = () => facLevel(f); });
  const statOf = (a) => (STAT[a.stat] ? STAT[a.stat]() : 0);
  // 새로 달성한 업적을 보상과 함께 지급하고 목록을 돌려준다
  function checkAch() {
    if (!global.DATA_ACH) return [];
    const got = [];
    for (const a of global.DATA_ACH) {
      if (state.ach[a.id] || statOf(a) < a.goal) continue;
      state.ach[a.id] = now();
      state.gold += a.gold || 0; state.fame += a.fame || 0;
      if (a.ticket) state.items.resetTicket = resetTickets() + a.ticket;
      got.push(a);
    }
    if (got.length) {
      state.achNew = (state.achNew || []).concat(got.map((a) => a.name));
      addChronicle(`업적 달성: ${got.length > 2 ? got.slice(0, 2).map((a) => a.name).join(', ') + ` 외 ${got.length - 2}개` : got.map((a) => a.name).join(', ')}`, null);
      save();
    }
    return got;
  }
  const achList = () => (global.DATA_ACH || []).map((a) => ({ ...a, now: Math.min(a.goal, statOf(a)), done: !!state.ach[a.id], at: state.ach[a.id] || 0 }));
  function takeAchNew() { const n = state.achNew || []; state.achNew = []; return n; }

  /* ---------- 추모 ---------- */
  const MOURN_COST = 100;
  const mournable = (c) => c.status === 'DEAD' && !c.mourned;
  // 추모식: 함께했던 사람들의 슬픔을 덜어 준다
  function mourn(id) {
    const c = byId(id);
    if (!c || !mournable(c)) return { ok: false, reason: '이미 추모를 마쳤어요.' };
    if (state.gold < MOURN_COST) return { ok: false, reason: `금화가 부족해요. (${MOURN_COST} 필요)` };
    state.gold -= MOURN_COST; c.mourned = now(); state.stats.mourns++;
    const eased = [];
    for (const o of state.characters) {
      if (o.status === 'DEAD' || o.id === c.id) continue;
      if (bondValue(o.id, c.id) > 0 && griefUntil(o)) { o.grief = null; eased.push(o.name); }
    }
    addChronicle(`${c.name}의 추모식이 열렸다${eased.length ? ` (${eased.join(', ')}의 슬픔이 덜어졌다)` : ''}`, null);
    save();
    return { ok: true, eased };
  }

  /* ---------- 대화 ---------- */
  // 길드 마스터가 모험가에게 말을 건다. 질문 3개가 무작위로 뜨고, 고르면 모험가가 대답한다.
  /* ---------- 길드 로비: 12시간마다(태평양 표준시 고정 00:00 · 12:00) 의뢰 중이 아닌 모험가 10명이 나와 서 있다 ---------- */
  const LOBBY_MS = 12 * 3600000, LOBBY_N = 10, PST_MS = 8 * 3600000;
  const lobbySlot = () => Math.floor((now() - PST_MS) / LOBBY_MS);
  const lobbyNextAt = () => (lobbySlot() + 1) * LOBBY_MS + PST_MS;
  const shuffled = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  function refreshLobby() {
    const slot = lobbySlot();
    const idle = () => byStatus('ACTIVE').filter((c) => !missionOf(c));
    if (!state.lobby || state.lobby.slot !== slot) { state.lobby = { slot, ids: shuffled(idle()).slice(0, LOBBY_N).map((c) => c.id) }; return true; }
    if (state.lobby.ids.length < LOBBY_N) { // 새로 합류한 모험가는 자리가 남아 있으면 로비에 선다
      const have = new Set(state.lobby.ids), add = shuffled(idle().filter((c) => !have.has(c.id))).slice(0, LOBBY_N - state.lobby.ids.length);
      if (add.length) { state.lobby.ids = state.lobby.ids.concat(add.map((c) => c.id)); return true; }
    }
    return false;
  }
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // 로비에 서 있는 모험가와 자리 (자리는 이번 교체 시각과 모험가 번호로 정해져서, 화면을 다시 그려도 그대로다. 간격은 제멋대로)
  function lobby() {
    if (refreshLobby()) save();
    const ids = state.lobby.ids, rnd = mulberry32(state.lobby.slot * 7919 + 17), placed = [];
    ids.forEach((id) => {
      let best = null, bd = -1;
      for (let k = 0; k < 40; k++) {
        const p = { x: 20 + rnd() * 70, y: 66 + rnd() * 28 };
        const d = placed.reduce((m, q) => Math.min(m, Math.hypot((p.x - q.x) * 1.0, (p.y - q.y) * 1.6)), 99);
        if (d > bd) { bd = d; best = p; }
        if (d > 16) break;
      }
      placed.push({ id, x: Math.round(best.x * 10) / 10, y: Math.round(best.y * 10) / 10 });
    });
    return placed.filter((p) => { const c = byId(p.id); return c && c.status === 'ACTIVE' && !missionOf(c); });
  }
  const inLobby = (id) => lobby().some((p) => p.id === id);

  const TALK_PER = 10; // 로비에 나온 모험가 한 명당, 교체 한 번에 10번
  const talksLeft = (id) => { const c = byId(id); if (!c) return 0; const t = c.talk; return !t || t.slot !== state.lobby.slot ? TALK_PER : Math.max(0, TALK_PER - (t.used || 0)); };
  function talkOptions(id) {
    const c = byId(id); if (!c || !inLobby(id) || talksLeft(id) <= 0) return [];
    const seen = c.talk && c.talk.seen ? c.talk.seen : {};
    const pool = []; for (let q = 0; q < Dialog.QUESTION_COUNT; q++) if (!seen[q]) pool.push(q);
    const src = pool.length >= 3 ? pool : Array.from({ length: Dialog.QUESTION_COUNT }, (_, q) => q);
    const out = [];
    while (out.length < 3) { const q = src[Math.floor(Math.random() * src.length)]; if (!out.includes(q)) out.push(q); }
    return out.map((q) => ({ q, text: Dialog.question(q) }));
  }
  function talk(id, q) {
    const c = byId(id);
    if (!c || c.status === 'DEAD') return { ok: false, reason: '대화할 수 없어요.' };
    if (!inLobby(id)) return { ok: false, reason: '로비에 나와 있는 모험가와만 이야기할 수 있어요.' };
    if (talksLeft(id) <= 0) return { ok: false, reason: '이번 교체 시간에는 더 이야기할 수 없어요. 다음 교체 때 다시 와 주세요.' };
    c.talk = c.talk || { count: 0, seen: {} };
    if (c.talk.slot !== state.lobby.slot) { c.talk.slot = state.lobby.slot; c.talk.used = 0; }
    c.talk.used++;
    const used = c.talk.seen[q] || [];
    const text = Dialog.reply(q, c, used, Math.random);
    c.talk.seen[q] = used.concat(text.k);
    c.talk.count++; state.stats.talks++;
    c.lastWords = text.line;
    checkAch(); save();
    return { ok: true, line: text.line, count: c.talk.count, left: talksLeft(id) };
  }

  function lifeline() {
    if (byStatus('ACTIVE').length || state.missions.length || state.gold >= recruitCost()) return false;
    state.gold = recruitCost(); addChronicle('길드 지원금이 도착했다', null); return true;
  }

  /* ---------- 모험가 등급 (F~S, 희귀도와 별개) ----------
     의뢰를 얼마나 어려운 것을, 얼마나 빨리, 몇 번 깼는지로 오른다. 수주 규칙은 기획서 16-1: 파티의 최고 등급까지 받을 수 있고,
     한 단계 위 의뢰는 파티 전원이 (의뢰 등급 − 1) 이상이어야 한다. */
  const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
  const RANK_AT = [0, 100, 300, 800, 2000, 5000, 12000];       // 이 등급이 되는 누적 점수
  const RANK_BASE = [10, 24, 55, 125, 280, 640, 1400];          // 자기 등급 의뢰를 깼을 때의 기본 점수
  const rankOf = (c) => Math.max(0, Math.min(6, c.rank || 0));
  const rankLabel = (c) => RANKS[rankOf(c)];
  function rankProgress(c) {
    const r = rankOf(c), pts = c.rankPts || 0;
    if (r >= 6) return { r, pts, cur: RANK_AT[6], next: null, ratio: 1 };
    return { r, pts, cur: RANK_AT[r], next: RANK_AT[r + 1], ratio: Math.min(1, (pts - RANK_AT[r]) / (RANK_AT[r + 1] - RANK_AT[r])) };
  }
  // 수주 가능 여부: 가능하면 null, 아니면 이유
  function takeBlock(members, k) {
    const qi = Math.max(0, RANKS.indexOf(k.grade));
    const rs = members.map(rankOf);
    if (!rs.length) return null;
    if (qi <= Math.max(...rs) || qi - 1 <= Math.min(...rs)) return null;
    return `${k.grade}급 의뢰는 ${RANKS[Math.max(0, qi - 1)]}급 이상 모험가만 모인 파티나 ${k.grade}급 모험가가 있어야 받을 수 있어요.`;
  }
  // 클리어 점수: 기본 × 속도(기준 4분, 0.6~1.5배) × 등급 차이 감쇠(자기보다 낮은 의뢰는 한 단계마다 절반)
  function rankPoints(c, k, seconds, half) {
    const qi = Math.max(0, RANKS.indexOf(k.grade));
    const speed = Math.max(0.6, Math.min(1.5, 240 / Math.max(30, seconds || 240)));
    return Math.round(RANK_BASE[qi] * speed * Math.pow(0.5, Math.max(0, rankOf(c) - qi)) * (half ? 0.5 : 1));
  }
  function awardRank(c, pts, at) {
    const before = rankOf(c);
    c.rankPts = (c.rankPts || 0) + pts;
    while (rankOf(c) < 6 && c.rankPts >= RANK_AT[rankOf(c) + 1]) c.rank = rankOf(c) + 1;
    if (rankOf(c) > before) { addChronicle(`${c.name}${pick(c.name, '이', '가')} ${RANKS[rankOf(c)]}급 모험가가 되었다`, null); return RANKS[rankOf(c)]; }
    return null;
  }

  // 도움: 사람이 많을수록 빨리 끝난다 (등급과 상관없이). 채집: 파티원 '운' 합이 높을수록 많이 가져온다.
  const helpSpeed = (n) => 1 / (1 + 0.45 * (Math.max(1, n) - 1));
  const waitMinutes = (k, n) => (k.type === 'help' ? Math.max(1, Math.round(k.minutes * helpSpeed(n))) : k.minutes);
  const gatherFactor = (members) => {
    if (!members.length) return 1;
    const sum = members.reduce((a, c) => a + Engine.makeActor(Character.toEngine(c)).lukP / (0.18 * Engine.totalPoints('Common', 55, c.level)), 0);
    return 0.3 + 0.7 * sum;
  };
  const gatherQty = (k, members) => Math.max(1, Math.round(k.qty * gatherFactor(members)));
  function sendParty(contractId, memberIds) {
    const k = state.board.find((x) => x.id === contractId);
    if (!k || k.expiresAt <= now()) return { ok: false, reason: '이미 마감되었거나 사라진 의뢰예요.' };
    const ids = Array.from(new Set(memberIds || []));
    if (ids.length < k.min || ids.length > k.max) {
      return { ok: false, reason: k.min === k.max ? `이 의뢰는 ${k.min}명이 필요해요.` : `이 의뢰는 ${k.min}~${k.max}명으로 보내야 해요.` };
    }
    const members = ids.map(byId);
    if (members.some((c) => !c || !isFree(c))) return { ok: false, reason: '의뢰를 보낼 수 없는 모험가가 있어요.' };
    const tb = takeBlock(members, k); if (tb) return { ok: false, reason: tb };

    const t = now();
    if (Combat.isWait(k)) { // 채집·도움: 정해진 시간만 기다리면 돌아온다 (실시간 확인 없음)
      const m = { id: 'm' + (state.nextMission++), contract: k, memberIds: ids, startedAt: t, paused: 0, wait: true, phase: 'plain', plain: 'win',
                  endsAt: t + waitMinutes(k, ids.length) * MINUTE, qty: k.type === 'gather' ? gatherQty(k, members) : 0, battle: { m: [], t: 0, kills: 0, log: [], dead: [] } };
      state.board = state.board.filter((x) => x.id !== contractId);
      addBoardGap(now());
      state.missions.push(m); save();
      return { ok: true, mission: m };
    }
    const bm = buildMembers(members);
    if (knowledge(k.monster) >= 1) bm.forEach((x) => { x.tw.atk *= 1 + Math.min(0.08, 0.01 * facLevel('archive')); }); // 기록실: 도감에 등록된 몬스터에게 주는 피해
    const st = Combat.startBattle(bm, k);
    const first = Combat.advanceBattle(st, k, Math.random, true);
    // 전투는 실시간으로 진행된다: 전투 시계 1초 = 실제 1초. 얼마나 걸릴지는 싸워 봐야 안다.
    const m = { id: 'm' + (state.nextMission++), contract: k, memberIds: ids, startedAt: t, paused: 0, battle: st };
    if (first === 'crisis') {
      m.phase = 'crisis'; m.hadCrisis = true;
      m.crisisAt = simMs(m);
      m.deadline = m.crisisAt + decisionMs(k, ids);
    } else {
      m.phase = 'plain';
      m.plain = first === 'win' ? 'win' : 'stalemate';
      m.endsAt = simMs(m);
    }
    state.board = state.board.filter((x) => x.id !== contractId);
    addBoardGap(now());
    state.missions.push(m);
    save();
    return { ok: true, mission: m };
  }

  // 채집·도움이 끝나 돌아왔다: 다치거나 죽는 일은 없다
  function finishWait(m, at) {
    const k = m.contract;
    state.missions = state.missions.filter((x) => x !== m);
    const gi = Math.max(0, GRADES.indexOf(k.grade));
    const res = { id: 'r' + at + '-' + m.id, t: at, questName: k.name, outcome: 'win', kind: 'wait', gold: k.gold, auto: false, killed: 0, members: [], log: [], drops: [], bonds: [] };
    state.gold += k.gold;
    const S = state.stats; S.clears++; S.goldEarned += k.gold; S.byGrade[k.grade] = (S.byGrade[k.grade] || 0) + 1; S.waits = (S.waits || 0) + 1;
    if (k.kind === 'special') S.specials++;
    for (const id of m.memberIds) {
      const c = byId(id); if (!c) continue;
      const r = { id: c.id, name: c.name, fate: 'ok', exp: Math.round(k.exp * Combat.expMulOf(c)), oldLevel: c.level, newLevel: c.level, injuryMin: 0, kills: 0 };
      if (r.exp > 0) Character.addExp(c, r.exp);
      r.newLevel = c.level;
      r.rankPts = Math.max(1, Math.round(RANK_BASE[gi] * 0.25 * Math.pow(0.5, Math.max(0, rankOf(c) - gi)))); r.rankUp = awardRank(c, r.rankPts, at);
      c.wallet = (c.wallet || 0) + Math.round(k.gold * 0.15);
      res.members.push(r);
    }
    state.fame += Math.round(FAME_BY_GRADE[gi] * 0.4); res.fame = Math.round(FAME_BY_GRADE[gi] * 0.4);
    if (k.type === 'gather') { const q = m.qty || k.qty; queueMaterial(k.item, q, at); res.drops.push(`${k.item} ×${q} (보급고 매입 대기에 올랐어요)`); }
    else res.drops.push(`${k.place} 사람들이 고마워했어요`);
    state.inbox.push(res);
    if (state.inbox.length > 40) state.inbox.splice(0, state.inbox.length - 40);
    return res;
  }

  // 의뢰를 끝내고 결과를 우편함(inbox)에 넣는다. at: 실제로 일어난 시각
  // outcome: win / wipe / retreat(전체 후퇴) / stalemate(승부 안 남)
  function finishMission(m, outcome, at, auto) {
    const k = m.contract, st = m.battle;
    state.missions = state.missions.filter((x) => x !== m);
    const cm = state.codex.mon[k.monster] || (state.codex.mon[k.monster] = { kills: 0, first: at });
    cm.kills += st.kills;
    if (st.m.some((x) => x.state !== 'dead')) { // 누군가 돌아왔다면 귀환 보고가 도감에 쌓인다
      cm.reports = (cm.reports || 0) + 1;
      if (!cm.firstBy) cm.firstBy = (byId(st.m.find((x) => x.state !== 'dead').id) || {}).name;
    }
    const total = Combat.totalMonsters(k);
    const progress = total ? st.kills / total : 0;
    const res = { id: 'r' + at + '-' + m.id, t: at, questName: k.name, outcome, gold: 0, auto: !!auto,
                  killed: st.kills, members: [], log: st.log.slice() };

    // 경험치 총량 -> 파티원 몫 (균등 70% + 활약 30%). 개별 이탈자는 절반만.
    let pool = 0;
    const nm = st.m.length;
    if (outcome === 'win') { pool = k.exp * nm; res.gold = k.gold; state.gold += k.gold; }
    else if (outcome === 'retreat') pool = Math.round(k.exp * nm * RETREAT_EXP * progress);
    else if (outcome === 'wipe') pool = Math.round(k.exp * nm * WIPE_EXP * progress);
    // 길드 명성: 클리어 +100%, 사망 1명당 -50%, 전멸 -150% (후퇴·이탈은 0). 0 아래로 내려가지 않는다.
    {
      const base = FAME_BY_GRADE[Math.max(0, GRADES.indexOf(k.grade))], deaths = st.m.filter((x) => x.state === 'dead').length;
      const avgRank = st.m.reduce((a, x) => a + rankOf(byId(x.id) || {}), 0) / Math.max(1, st.m.length);
      let fd = outcome === 'win' ? Math.round(base * (1 + 0.04 * avgRank)) : 0; // 높은 등급 모험가가 해낸 일은 명성이 조금 더 붙는다
      fd -= outcome === 'wipe' ? base * 1.5 : base * 0.5 * deaths;
      const before = state.fame;
      state.fame = Math.max(0, state.fame + Math.round(fd));
      res.fame = state.fame - before;
    }
    const dmgSum = st.m.reduce((a, x) => a + x.dmg, 0) || 1;
    const share = (x) => (0.7 / st.m.length + 0.3 * x.dmg / dmgSum);

    for (const x of st.m) {
      const c = byId(x.id);
      const r = { id: c.id, name: c.name, fate: 'ok', exp: 0, oldLevel: c.level, newLevel: c.level, injuryMin: 0, kills: x.kills };
      c.kills = (c.kills || 0) + x.kills;
      if (x.state === 'dead') {
        r.fate = 'dead';
      } else {
        r.exp = Math.round(pool * share(x) * (x.state === 'out' ? 0.5 : 1) * Combat.expMulOf(c));
        if (r.exp > 0) Character.addExp(c, r.exp);
        r.newLevel = c.level;
        if (x.state === 'down') { r.fate = 'injured'; r.injuryMin = injuryMinutes(INJURY.down); }
        else if (x.state === 'out') { r.fate = 'out'; r.injuryMin = injuryMinutes(INJURY.out); }
        else if (outcome === 'retreat') { r.fate = 'injured'; r.injuryMin = injuryMinutes(INJURY.retreat); }
        if (r.injuryMin) c.injuredUntil = at + r.injuryMin * MINUTE;
        if (outcome === 'win') { r.rankPts = rankPoints(c, k, st.t, x.state === 'out'); r.rankUp = awardRank(c, r.rankPts, at); }
        if (outcome === 'win') { c.quests = (c.quests || 0) + 1; (c.history || (c.history = [])).push({ n: k.name, g: k.grade, t: at }); if (c.history.length > 40) c.history.shift(); c.wallet = (c.wallet || 0) + Math.round(k.gold * 0.2); } // 개인 보수 (길드 수입에서 빼지 않는다)
      }
      res.members.push(r);
    }

    // 기록: 연속 무사고, 위기 극복, 한정 의뢰, 전투 통계
    {
      const deaths = st.m.filter((x) => x.state === 'dead').length;
      const S = state.stats;
      S.kills += st.kills;
      if (outcome === 'win') {
        S.clears++; S.goldEarned += k.gold;
        S.byGrade[k.grade] = (S.byGrade[k.grade] || 0) + 1;
        if (deaths === 0) { S.streak++; S.best = Math.max(S.best, S.streak); } else S.streak = 0;
        if (m.hadCrisis) S.crisisWins++;
        if (k.kind === 'special') S.specials++;
      } else {
        if (outcome === 'retreat') S.retreats++;
        if (outcome === 'wipe') S.wipes++;
        if (deaths) S.streak = 0;
      }
    }

    // 드롭(재료·장비), 유품, 실패한 의뢰는 게시판에 남는다
    res.drops = [];
    const survivors = st.m.filter((x) => x.state !== 'dead').map((x) => byId(x.id)).filter(Boolean);
    const deadChars = st.m.filter((x) => x.state === 'dead').map((x) => byId(x.id)).filter(Boolean);
    const lostGear = []; deadChars.forEach((d) => Object.values(d.equip || {}).forEach((it) => { if (it) lostGear.push(it); }));
    k.relics = k.relics || [];
    const hand = (it, label) => { if (survivors.length) res.drops.push(gainGear(survivors[rint(0, survivors.length - 1)], it, label)); };
    if (outcome === 'win') {
      const info = Gear.MONSTERS[k.monster];
      if (info) { const qty = k.type === 'boss' ? rint(2, 4) : k.type === 'wave' ? rint(4, 6) : rint(3, 6); queueMaterial(info.mat, qty, at); res.drops.push(`${info.mat} ×${qty} (매입 대기)`); }
      // 의뢰 전용 장비(부위마다 3종): 토벌에서 낮은 확률로 나온다
      if (survivors.length && Math.random() < (k.type === 'boss' ? 0.12 : k.type === 'wave' ? 0.05 : 0.04)) {
        const slot = Gear.SLOTS[rint(0, 2)][0], gi = Math.max(0, GRADES.indexOf(k.grade));
        hand(Gear.makeItem(nextItemId(), slot, gi, Gear.rollQuality(Math.random, 0), Math.random, Gear.DROP_TYPES[rint(0, 2)]), '드롭');
      }
      k.relics.forEach((it) => hand(it, '유품')); k.relics = [];
      lostGear.forEach((it) => hand(it, '전우의 장비'));
    } else {
      lostGear.forEach((it) => k.relics.push(it)); // 죽은 모험가의 장비는 의뢰에 유품으로 남는다
      k.fails = (k.fails || 0) + 1;
      k.expiresAt = k.relics.length ? Math.max(k.expiresAt, at + 7 * DAY) : Math.max(k.expiresAt, at + 2 * 3600000);
      state.board.push(k);
    }

    // 유대: 함께 살아남은 사람끼리 깊어진다. 죽은 사람과 가까웠던 사람은 슬픔에 빠진다.
    res.bonds = [];
    const gain = outcome === 'stalemate' ? 1 : 2 + (outcome === 'win' ? 3 : 0) + (m.hadCrisis ? 3 : 0);
    const alive = st.m.filter((x) => x.state !== 'dead');
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const up = addBond(alive[i].id, alive[j].id, gain);
      if (up) res.bonds.push(up);
    }
    for (const d of st.m.filter((x) => x.state === 'dead')) {
      for (const y of alive) {
        const idx = bondInfo(y.id, d.id).idx;
        if (idx >= 1) {
          const c = byId(y.id);
          c.grief = { until: at + GRIEF_HOURS * idx * 3600000 };
          addChronicle(`${c.name}${pick(c.name, '은', '는')} ${d.name}${pick(d.name, '을', '를')} 잃었다`, null);
        }
      }
    }

    const names = res.members.map((r) => r.name).join(', ');
    if (outcome === 'win') {
      addChronicle(`첫 번째 의뢰 완수: ${names}의 「${k.name}」`, 'first-quest');
      for (const r of res.members) {
        if (r.newLevel > r.oldLevel && r.newLevel >= 10) addChronicle(`첫 번째 Lv.10 달성: ${r.name}`, 'first-lv10');
      }
    }
    if (outcome === 'retreat') addChronicle(`첫 번째 후퇴: ${names}${pick(names, '이', '가')} 「${k.name}」에서 물러남`, 'first-retreat');
    if (res.members.length > 1 && res.members.every((r) => r.fate === 'dead')) {
      addChronicle(`「${k.name}」에서 파티 전멸 (${names})`, null);
    }

    state.inbox.push(res);
    if (state.inbox.length > 40) state.inbox.splice(0, state.inbox.length - 40);
    // 사망 처리는 결과를 담은 뒤에 (연대기 순서를 위해)
    for (const x of st.m) {
      if (x.state === 'dead') {
        // 같이 나갔던 동료가 한 명이라도 돌아왔다면 사망 원인을 알 수 있다. 모두 쓰러졌다면 알 수 없다.
        const known = st.m.some((y) => y.state !== 'dead');
        const cause = known ? `「${k.name}」에서 ${k.monster}에게 쓰러짐 (${auto ? '결정 시간 초과로' : '후퇴하지 않고'} 싸움을 이어감)` : `「${k.name}」에서 전멸 — 아무도 돌아오지 못해 사망 원인을 알 수 없어요`;
        kill(x.id, cause);
        { const dc = state.characters.find((y) => y.id === x.id); if (dc) dc.deathInfo = { quest: k.name, grade: k.grade, known, monster: known ? k.monster : '' }; }
      }
    }
    return res;
  }

  const outcomeOf = (r) => (r === 'win' ? 'win' : r === 'wipe' ? 'wipe' : 'stalemate');

  // 위기 신호에 대한 결정
  //  choice: 'retreat'(전체 후퇴) / 'continue'(계속 싸운다)
  function decide(missionId, choice, memberId) {
    const m = missionById(missionId);
    if (!m || m.phase !== 'crisis') return { ok: false, reason: '결정할 위기 신호가 없어요.' };
    const t = now();
    if (t < m.crisisAt) return { ok: false, reason: '아직 위기 신호가 오지 않았어요.' };
    if (t >= m.deadline) { tick(); return { ok: false, reason: '결정 시간이 지나 이미 싸움이 이어졌어요.' }; }
    const k = m.contract, st = m.battle;
    let res = null;
    const waited = () => { m.paused = (m.paused || 0) + (t - m.crisisAt); }; // 결정을 기다린 시간만큼 전투 시계가 멈춰 있었다
    const goOn = (stop) => {
      const r = Combat.advanceBattle(st, k, Math.random, stop);
      if (r === 'crisis') { m.crisisAt = simMs(m); m.deadline = m.crisisAt + decisionMs(k, m.memberIds); m.hint = null; return; }
      m.phase = 'plain'; m.plain = (r === 'retreat' && !st.m.some((x) => x.state === 'fit')) ? 'retreat' : outcomeOf(r); m.endsAt = simMs(m);
    };
    if (choice === 'retreat') {
      st.log.push('전체 후퇴 명령을 내렸다.');
      res = finishMission(m, 'retreat', t);
    } else {
      st.log.push('위기 속에서도 후퇴하지 않고 싸움을 이어갔다.');
      waited();
      goOn(false);
    }
    save();
    return { ok: true, result: res, mission: res ? null : m };
  }

  // 시간이 흘러 끝난 의뢰를 처리한다. 하나라도 처리했으면 true
  function tick() {
    const t = now();
    let changed = refreshBoard();
    if (refreshLobby()) changed = true;
    if (lifeline()) changed = true;
    if (finishCrafts(t)) changed = true;
    if (processShop(t)) changed = true;
    { const n = state.matQueue.length; state.matQueue = state.matQueue.filter((q) => q.expiresAt > t); if (state.matQueue.length !== n) changed = true; }
    if (refreshApplicants()) changed = true;
    for (const c of state.characters) {
      if (c.status === 'ACTIVE' && c.training && t >= c.training.until) { finishTraining(c); changed = true; }
    }
    for (const m of state.missions.slice()) {
      if (m.phase === 'crisis' && t >= m.deadline) {
        // 결정 시간이 지나면 후퇴하지 않고 그대로 싸움을 이어간다 (결정 마감 시각에 이어 싸운 것으로 친다)
        m.battle.log.push('결정이 없어 그대로 싸움을 이어갔다.');
        m.paused = (m.paused || 0) + (m.deadline - m.crisisAt);
        const r = Combat.advanceBattle(m.battle, m.contract, Math.random, false);
        m.phase = 'plain'; m.plain = outcomeOf(r); m.endsAt = simMs(m); m.auto = true;
        changed = true;
      }
      if (m.wait) { if (t >= m.endsAt) { finishWait(m, m.endsAt); changed = true; } continue; }
      if (m.phase === 'plain' && t >= m.endsAt) { finishMission(m, m.plain, m.endsAt, m.auto); changed = true; }
    }
    if (checkAch().length) changed = true;
    if (changed) save();
    return changed;
  }

  // 화면용: 지금 의뢰 상태. running(진행 중) / alert(위기 신호, 결정 대기)
  function missionInfo(m) {
    const k = m.contract;
    if (m.wait) return { state: 'running', quest: k, clock: 0, wait: true, endsAt: m.endsAt };
    if (m.phase === 'crisis' && now() >= m.crisisAt) {
      if (!m.hint) m.hint = Combat.commitLabel(m.battle, k, 150); // 한 번만 계산해서 저장
      return { state: 'alert', quest: k, deadline: m.deadline, hint: m.hint,
               crisis: Combat.crisisMembers(m.battle).map((x) => x.id) };
    }
    return { state: 'running', quest: k, clock: battleClock(m) };
  }

  // 부상 회복 끝나는 시각 (회복 중이 아니면 0)
  function injuredUntil(c) {
    return c.injuredUntil && c.injuredUntil > now() ? c.injuredUntil : 0;
  }

  function dismissResult(id) {
    state.inbox = id ? state.inbox.filter((r) => r.id !== id) : [];
    save();
  }

  /* ---------- 장기 미접속 이탈 / 복귀 ---------- */
  // 마지막 접속 후 30일마다 현역 1명이 LEFT가 된다. 사망이 아니며 다른 플레이어에게 넘어가지도 않는다.
  // 누가 떠날지는 무작위. 고유스킬은 사망 전까지 유지된다(떠난 캐릭터가 계속 보유).
  function processAbsence() {
    const now = Date.now();
    const elapsed = now - state.lastVisit;
    const due = Math.floor(elapsed / (ABSENCE_DAYS * DAY));
    const pool = byStatus('ACTIVE').filter((c) => !missionOf(c)); // 의뢰 중인 모험가는 떠나지 않는다
    const count = Math.min(due, pool.length);
    const left = [];
    for (let i = 0; i < count; i++) {
      const c = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      c.status = 'LEFT';
      c.leftAt = state.lastVisit + (i + 1) * ABSENCE_DAYS * DAY; // 연대기에는 실제로 떠났을 시점으로 기록
      state.chronicle.push({ t: c.leftAt, text: `${c.name}${pick(c.name, '이', '가')} 길드를 떠남 (장기 미접속)`, key: null });
      left.push(c);
    }
    state.lastVisit = now;
    return { absentDays: Math.floor(elapsed / DAY), due, left };
  }

  // 탭을 오래 켜 둔 채 돌아온 경우 등에서 다시 확인할 때 사용
  function checkAbsence() {
    tick();
    lastReport = processAbsence();
    save();
    return lastReport;
  }

  function returnCharacter(characterId) {
    const c = state.characters.find((x) => x.id === characterId);
    if (!c || c.status !== 'LEFT') return { ok: false, reason: '복귀시킬 수 없는 모험가예요.' };
    if (byStatus('ACTIVE').length >= rosterCap()) return { ok: false, reason: `기숙사가 가득 찼어요. (정원 ${rosterCap()}명)` };
    if (state.gold < returnCost()) return { ok: false, reason: `금화가 부족해요. (${returnCost()} 필요)` };
    state.gold -= returnCost();
    c.status = 'ACTIVE';
    c.returnedAt = Date.now();
    c.returnCount = (c.returnCount || 0) + 1;
    addChronicle(`${c.name}${pick(c.name, '이', '가')} 길드로 돌아옴`, null);
    save();
    return { ok: true };
  }

  /* ---------- 개발용 ---------- */
  function simulateAbsence(days) {
    state.timeShift += days * DAY; // 의뢰와 부상 시간도 함께 흐른다
    tick();
    state.lastVisit -= days * DAY;
    lastReport = processAbsence();
    save();
    return lastReport;
  }
  function addGold(n) { state.gold += n; save(); }
  function advanceTime(minutes) { // 시간 빨리감기
    state.timeShift += minutes * MINUTE;
    tick();
    save();
  }

  /* ---------- 조회 ---------- */
  const byStatus = (st) => state.characters.filter((c) => c.status === st);
  function adventureDays(c) {
    const end = c.diedAt || Date.now();
    return Math.floor((end - c.recruitedAt) / DAY);
  }

  global.Guild = {
    load, save, resetAll, recruit, kill, byStatus, adventureDays,
    checkAbsence, returnCharacter, simulateAbsence, addGold, advanceTime,
    sendParty, decide, tick, missionInfo, missionOf, missionById, isFree, injuredUntil, dismissResult, now,
    codexMon() { return state.codex.mon; },
    hire, dismissApplicant, refillApplicants() { state.applicants = []; refreshApplicants(); save(); }, setSkillBoost(m) { skillBoost = m || 1; },
    get applicants() { return state.applicants; },
    BOND_LEVELS, bondInfo, bondsOf, griefUntil, buildMembers,
    lobby, lobbyNextAt, inLobby, talksLeft, TALK_PER, cancelTraining, achList, checkAch, takeAchNew, codexPct, monTotal, monKnown, MOURN_COST, mournable, mourn, talkOptions, talk,
    advanceCharacter(id, cls) {
      const c = byId(id);
      if (!c || !isFree(c) || !Character.advance(c, cls)) return { ok: false, reason: '전직할 수 없어요.' };
      addChronicle(`${c.name}, 「${cls}」(으)로 전직하다`, 'advance');
      save(); return { ok: true };
    },
    devSetLevel(id, lv) { const c = byId(id); if (c) { c.level = lv; c.exp = 0; save(); } },
    battleClock, battleView, knowledge, knowT, buyMaterial, declineMaterial, matCount, matUnit, matHave, waitMinutes, gatherQty, helpSpeed, recipeOpen, recipeFee, craftSlots, craftMinutes, startCraft, dumpPrice, dumpItem, dumpBelow, shopSlots, displayItem, undisplayItem, setPrice, gearScore,
    devShopVisit(c) { return shopVisit(c, Guild.now()); },
    devMat(n, q) { state.materials[n] = (state.materials[n] || 0) + q; save(); },
    TRAIN_OPTIONS, trainSlots, trainees, trainPreview, startTraining,
    BOARD_MAX, addTutorialContract, TUTORIAL_DONE, tutorialStep, tutorialActive, setTutorial, resetTickets, resetCharacter, grantResetTicket, RANKS, RANK_AT, rankOf, rankLabel, rankProgress, takeBlock, rankPoints, FAIR_BAND, fairRange, inFairBand, FACILITIES, facLevel, facCost, facCap, GRADES, FAC_CAP, guildGrade, gradeIdx, promoNeed, promoteGuild, FAME_BY_GRADE, fameInfo, recruitCost, returnCost, upgradeFacility, rosterCap, boardMax, analysisTrials, recruitBlock,
    get board() { return state.board; },
    get missions() { return state.missions; },
    get fights() { return state.missions.filter((m) => !m.wait); },
    MINUTE, ABSENCE_DAYS,
    get lastReport() { return lastReport; },
    clearReport() { lastReport = null; },
    get state() { return state; },
    get registry() { return registry; },
    guildNamed: () => !!state.guildNamed,
    nameGuild(name) { const n = String(name || '').trim().slice(0, 20); if (n.length < 2) return { ok: false, reason: '길드 이름은 2글자 이상이어야 해요.' }; state.guildName = n; state.guildNamed = true; addChronicle(`길드의 이름이 「${n}」으로 정해졌다`, null); save(); return { ok: true }; },
    // 이름을 바꾸면 명성이 절반으로 떨어진다
    renameGuild(name) {
      const n = String(name || '').trim().slice(0, 20);
      if (n.length < 2) return { ok: false, reason: '길드 이름은 2글자 이상이어야 해요.' };
      if (n === state.guildName) return { ok: false, reason: '지금과 같은 이름이에요.' };
      const before = state.fame; state.fame = Math.floor(state.fame * 0.5); state.guildName = n;
      addChronicle(`길드가 「${n}」으로 이름을 바꿨다 (명성 ${before} → ${state.fame})`, null); save();
      return { ok: true, lost: before - state.fame };
    },
    setName(name) { state.guildName = String(name).trim().slice(0, 20) || '이름 없는 길드'; save(); },
  };
})(window);
