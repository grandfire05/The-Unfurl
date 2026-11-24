/* ============================================================
   guild.js - 길드 상태 / 저장 / 영입 / 사망 / 연대기 / 실시간 의뢰 (3~6단계)
   화면(ui.js)과 분리해서, 나중에 서버 API로 바꾸기 쉽게 만든다.
   ============================================================ */
(function (global) {
  'use strict';

  const SAVE_KEY = 'guild-save-v3';
  const MINUTE = 60000;
  const DAY = 86400000;

  // 규칙 값 (나중에 밸런스 조정은 여기서)
  const ABSENCE_DAYS = 30;  // 이 기간 미접속할 때마다 모험가 1명 이탈
  const START_GOLD = 200;   // 시작 무료 재화
  const CRISIS_AT = 0.5;        // 의뢰 진행률이 이 지점에 오면 위기 신호가 온다 (위기가 있는 의뢰만)
  const HEAL_FULL_MIN = 60; // 체력 0%에서 가득 찰 때까지(분, 병동 0레벨 기준)
  // 위기 후 결정 제한 시간. '시간의 눈'을 가진 파티원이 있으면 60% 늘어난다.
  const decisionMs = (q, ids) => {
    if (q.tutorial) return 6 * 60 * MINUTE; // 튜토리얼의 위기 결정은 시간 제한 없이 기다려 준다
    const base = Math.max(10, Math.min(60, Math.round(q.minutes * 0.5)));
    return Math.round(base * (1 + Math.min(1.5, sumMod(ids, 'window')))) * MINUTE;
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
  let forceSkill = false; // 개발용: 채용하면 고유스킬을 무조건 얻는다
  let state = null;
  let registry = null;
  let lastReport = null;   // 최근 이탈 결과 (화면 안내용)

  /* ---------- 저장 / 불러오기 ---------- */
  const TUTORIAL_DONE = 99;
  const newStats = () => ({ clears: 0, deaths: 0, streak: 0, best: 0, crisisWins: 0, specials: 0, kills: 0, goldEarned: 0, byGrade: {}, retreats: 0, wipes: 0, mourns: 0, talks: 0, recruited: 0, crafted: 0, sold: 0, trained: 0, resets: 0 });
  const newGuide = (open) => ({ unlock: open ? { quests: true, roster: true, shop: true, guild: true } : { quests: false, roster: false, shop: false, guild: false }, done: {}, chap: null, queue: [], news: [] });
  function newState() {
    return {
      version: 3,
      guildName: '이름 없는 길드', guildNamed: false,
      guildGrade: 0,       // 길드 등급 (0=F ~ 6=S)
      fame: 0,             // 다음 승급까지의 명성
      payQueue: [], materials: {}, stock: [], display: [], crafts: [], shopLog: [], shopAt: Date.now(), nextItem: 1,
      gold: START_GOLD,    // 무료 재화 (임시 이름: 금화)
      tutorial: 0,         // 첫 튜토리얼(환영·채용·첫 원정) 단계 (TUTORIAL_DONE이면 끝). 건너뛸 수 없다
      guide: newGuide(),   // 길잡이 퀘스트 · 탭 해금 · 해금 때 뜨는 짧은 안내(챕터)
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

  const mkReg = (saved) => Character.createSkillRegistry(saved, (id) => !!(global.Server && global.Server.foreign(id)));
  function save() {
    state.lastVisit = Date.now(); // 저장 = 접속 중이라는 뜻
    state.registry = registry.toJSON();
    if (global.Server) global.Server.queueSave();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; } // 저장 공간 부족/차단 시에도 게임은 계속 진행
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) state = JSON.parse(raw);
    } catch (e) { state = null; }
    // 튜토리얼 도중에 나갔다 들어오면 처음부터 다시 한다 (튜토리얼 중의 진행은 모두 되돌리고 길드 이름만 남긴다)
    let keepName = null;
    if (state && state.version === 3 && typeof state.tutorial === 'number' && state.tutorial > 0 && state.tutorial < TUTORIAL_DONE) {
      const t = state.tutorial, hired = Array.isArray(state.characters) && state.characters.length >= 1;
      if (t >= 8 && hired) { // 채용까지 마쳤다면 그 뒤부터 이어 한다: 첫 원정 안내는 처음 장면(9)으로 되돌린다
        state.tutorial = 9; state.tutorialRan = false;
        state.board = (state.board || []).filter((k) => !k.tutorial);
        state.missions = (state.missions || []).filter((m) => !(m.contract && m.contract.tutorial));
        state.inbox = (state.inbox || []).filter((r) => !JSON.stringify(r).includes('"tutorial":true'));
        for (const c of state.characters) delete c.mission;
      } else { // 환영·채용 도중에 나갔다면 처음부터 다시 한다
        keepName = { n: state.guildName, ok: state.guildNamed };
        state = null;
      }
    }
    if (!state || state.version !== 3) {
      state = newState();
      if (keepName) { state.guildName = keepName.n; state.guildNamed = keepName.ok; }
      registry = mkReg(null);
      addChronicle('길드 창설', 'founded');
    } else {
      registry = mkReg(state.registry);
      // 이전 단계 저장 데이터 보정
      if (typeof state.gold !== 'number') state.gold = START_GOLD;
      if (typeof state.guildGrade !== 'number') state.guildGrade = 0;
      if (typeof state.fame !== 'number') state.fame = 0;
      ['payQueue', 'stock', 'display', 'crafts', 'shopLog'].forEach((k) => { if (!Array.isArray(state[k])) state[k] = []; });
      if (!state.materials) state.materials = {};
      // 재료 이름이 몬스터별로 바뀌기 전의 재료는 정리한다 (없는 재료는 쓸 수 없다)
      Object.keys(state.materials).forEach((n) => { if (!Gear.MAT_INFO[n]) delete state.materials[n]; });
      if (Array.isArray(state.matQueue)) { state.matQueue.forEach((q) => { if (Gear.MAT_INFO[q.name]) state.materials[q.name] = (state.materials[q.name] || 0) + q.qty; }); } // 예전 매입 대기분은 그대로 창고에 넣는다
      delete state.matQueue;
      state.board = (state.board || []).filter((k) => !k.item || Gear.MAT_INFO[k.item]);
      if (!state.lobby) state.lobby = null;
      if (typeof state.guildNamed !== 'boolean') state.guildNamed = state.guildName !== '이름 없는 길드' || state.characters.length > 0 || (state.tutorial || 0) > 0;
      if (typeof state.shopAt !== 'number') state.shopAt = Date.now();
      if (!state.nextItem) state.nextItem = 1;
      state.board.forEach((k) => { if (!k.relics) k.relics = []; k.min = 1; });
      // 몬스터 이름이 6글자 이내로 바뀐 뒤의 저장 데이터 보정: 없는 몬스터는 같은 등급의 몬스터로 바꾼다
      const fixMon = (k) => {
        if (!k || !k.monster || (global.Monsters && global.Monsters.INFO[k.monster])) return;
        if (k.monster === '우두머리 늑대') { k.monster = '늑대 대장'; return; }
        const M = global.Monsters, gi = typeof k.gi === 'number' ? k.gi : 0, list = (k.type === 'boss' ? M.BOSS : M.NORMAL)[gi];
        if (list && list[0]) { k.monster = list[0]; if (Gear.MONSTERS[k.monster]) k.attr = Gear.MONSTERS[k.monster].attr; }
      };
      state.board.forEach(fixMon); (state.missions || []).forEach((m) => fixMon(m.contract));
      if (state.codex && state.codex.mon) Object.keys(state.codex.mon).forEach((n) => { if (global.Monsters && !global.Monsters.INFO[n]) delete state.codex.mon[n]; });
      state.characters.forEach((c) => { if (c.injuredUntil) { if (c.injuredUntil > Date.now()) { c.hpPct = 0.5; c.hpAt = Date.now(); } delete c.injuredUntil; } });
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
      if (!state.guide) { state.guide = newGuide(true); GUIDE.forEach((q) => { state.guide.done[q.id] = 1; }); } // 예전 저장은 전부 열린 상태로 이어서 한다
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
    if (state && state.tutorial >= TUTORIAL_DONE) purgeTutorialContracts(); // 예전 저장에 남은 연습 의뢰 정리
    tick(); // 오프라인 중 끝난 의뢰부터 정리
    lastReport = processAbsence(); // 저장(=접속 시각 갱신) 전에 미접속 기간부터 계산
    save();
    return state;
  }

  // 서버 연동용: 지금 상태 / 서버 저장 불러오기 / 서버가 정한 스킬로 바꾸기
  function snapshot() { state.registry = registry.toJSON(); return state; }
  function importSave(raw) { try { localStorage.setItem(SAVE_KEY, raw); } catch (e) { /* 무시 */ } load(); }
  function retarget(c, id) { c.appearanceId = String(id); c.appearance = Appearance.decodeAppearance(String(id)); save(); }
  function swapSkill(cid, oldId, newId) {
    const c = state.characters.find((x) => x.id === cid); if (!c) return;
    registry.release(oldId);
    if (newId == null) { c.uniqueSkill = null; } else { registry.assign(newId, cid); c.uniqueSkill = newId; }
    const nm = newId == null ? '없음' : Character.SKILL_NAMES[newId];
    addChronicle(`${c.name}의 고유스킬이 다른 길드와 겹쳐 「${nm}」(으)로 바뀜`, null);
    gnotice(`${c.name}의 고유스킬이 겹쳐서 [${nm}](으)로 바뀌었어요.`);
    save();
  }

  function resetAll() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
    state = newState();
    registry = mkReg(null);
    addChronicle('길드 창설', 'founded');
    save();
  }

  // 게임 속 현재 시각 (개발용 빨리감기가 반영된 시각)
  const now = () => Date.now() + (state ? state.timeShift || 0 : 0);

  // 채팅의 로그 채널로도 흘려 보낸다
  // 채용 연출이 끝나기 전에는 채팅에 내보내지 않고 모아 둔다 (연출 스포일러 방지). 끝나면 flushAnnounce가 순서대로 내보낸다.
  const pendingAnn = {}; let deferChat = null;
  function chatOut(it) { try { if (typeof Chat === 'undefined') return; if (it.ch === 'notice') Chat.notice(it.text); else Chat.log(it.text, it.kind); } catch (e) { /* 무시 */ } }
  function chatPush(it) {
    if (deferChat) { deferChat.push(it); return; }
    const ids = Object.keys(pendingAnn);
    if (ids.length) { pendingAnn[ids[ids.length - 1]].items.push(it); return; }
    chatOut(it);
  }
  function glog(text, kind) { chatPush({ ch: 'log', text, kind }); }
  function gnotice(text) { chatPush({ ch: 'notice', text }); }
  function flushAnnounce(id, minAge) {
    Object.keys(pendingAnn).forEach((k) => {
      if (id != null && String(k) !== String(id)) return;
      const p = pendingAnn[k]; if (minAge && Date.now() - p.at < minAge) return;
      delete pendingAnn[k]; p.items.forEach(chatOut);
    });
  }

  /* ---------- 연대기 ---------- */
  function addChronicle(text, onceKey, quiet) {
    if (onceKey && state.chronicle.some((e) => e.key === onceKey)) return false;
    state.chronicle.push({ t: now(), text, key: onceKey || null });
    if (!quiet) glog(text, 'chronicle');
    return true;
  }

  /* ---------- 이름 ---------- */
  // 모험가 이름: 판타지에 어울리는 이름만 쓴다(6글자 이내, 길드 안에서 겹치지 않게).
  // 손으로 고른 이름 목록 + 어울리는 앞·뒤 조각만 모은 조합. 한글 단어 조합(새벽빛 등)은 쓰지 않는다.
  const NM_FIXED = [
    '카엘', '레온', '아델', '세인', '리안', '아론', '에단', '로웬', '카이', '라온', '세온', '이안', '에린', '리아', '미라', '세라', '엘라', '노아', '레아', '티아', '루나', '이레', '하린', '소린', '카일', '다리안', '아이린', '유리엘', '엘리아', '이실리', '로제인', '카밀라', '벨리아', '아스란', '루미엘', '엘로이', '세이라', '노르딘', '카시안', '에리스', '리베르', '아델린', '오리안', '티엘라', '미카엘', '하이든', '아르카엘', '세리안', '에레나', '이리스', '실비아', '루시안', '엘레나', '카이로', '라파엘', '가브리엘', '제이든', '아리엘', '유니아', '세레나', '에이든', '오르한', '벨로아', '리엔', '타리엘', '셀레나', '아이덴', '로엔', '에반', '이든', '아벨', '카인', '이사', '루카', '라이언', '엘윈', '글렌', '브람', '다온', '시엘', '아르벨', '네리아', '펠릭스', '레나', '미엘', '노엘', '유진', '하엘', '라엘', '시안', '아로엔', '벨란', '카르엘', '리온', '테오', '로한', '오웬', '엘리온', '라시안', '이슬란', '세이안', '마리엘', '아드리안', '레이나', '이솔데', '나이엘', '엘다린', '카를로', '발렌', '실피아', '로렌', '리라', '하이넬', '아스트라', '세실', '벨라', '에스텔', '유리안', '다니엘', '칼리온', '아르윈', '이그니스', '에이린', '루네', '오리온', '파엘', '시린', '레이븐', '카산드라', '아이리스', '엘시아', '모르간', '타이런', '드레이크', '라그나', '브리엔', '고든', '헤르온', '루드', '아이젠', '스텔라', '로제', '비앙카', '이졸데', '크리스', '디온', '게일', '해럴드'
  ];
  const NM_FRONT = ['엘', '아르', '카', '세', '리', '루', '벨', '노', '레', '로', '미', '아델', '오르', '카이', '하', '세리', '에리', '유', '아스', '엘리'];
  const NM_BACK = ['안', '엘', '온', '린', '아', '라', '리아', '엘라', '란', '델', '윈', '렌', '로스', '라스', '나', '비아', '넬', '딘', '시안', '리온', '론'];
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  function oneName() {
    if (Math.random() < 0.8) return rnd(NM_FIXED);
    const f = rnd(NM_FRONT), b = rnd(NM_BACK);
    if (f[f.length - 1] === b[0] || (f + b).length < 3) return rnd(NM_FIXED); // 같은 글자가 이어지는 어색한 조합은 피한다
    return f + b;
  }
  function randomName(used) {
    for (let i = 0; i < 40; i++) { const n = oneName(); if (n.length >= 2 && n.length <= 6 && !(used && used.has(n))) return n; }
    return oneName().slice(0, 6);
  }

  // 받침 유무에 따라 조사 선택 (예: 이/가, 을/를)
  function pick(word, withBatchim, without) {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    return code >= 0 && code % 28 !== 0 ? withBatchim : without;
  }

  /* ---------- 길드 시설 (금화 사용처) ---------- */
  // 레벨 0에서 시작해 금화로 올린다. 비용 = base * (다음 레벨)^1.7
  // 강화 비용(골드) = 단계별 기본값 × 시설 가중치. 최대 레벨은 길드 등급이 제한한다.
  const FAC_BASE = [500, 1250, 2250, 4000, 7250, 13000, 23500, 42500]; // 의뢰 1일치 수입(등급별)의 약 0.5~0.8배 수준
  const FACILITIES = [
    { id: 'dorm',    name: '기숙사',   max: 8, w: 1.0, desc: '보유할 수 있는 모험가 수가 늘어요.',
      effect: (lv) => `보유 ${10 + 7 * lv}명` },
    { id: 'board',   name: '의뢰판', max: 8, w: 1.2, desc: '게시판에 걸리는 의뢰가 늘고, 새 의뢰가 더 빨리 들어와요.',
      effect: (lv) => `게시판 ${6 + lv}건 · ${Math.round(BOARD_SPAWN_MIN * (1 - 0.05 * lv) * 10) / 10}분마다 새 의뢰` },
    { id: 'dojo',    name: '수련장',   max: 8, w: 1.0, desc: '동시에 훈련할 수 있는 인원과 훈련 경험치가 늘어요.',
      effect: (lv) => `동시 훈련 ${1 + Math.ceil(lv / 2)}명 · 경험치 ${lv ? '+' + 10 * lv + '%' : '기본'}` },
    { id: 'ward',    name: '병동',     max: 8, w: 0.8, desc: '길드 안에서 체력이 더 빨리 회복돼요.',
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
  const facCost = (id) => { const f = FACILITIES.find((x) => x.id === id); return Math.round(FAC_BASE[Math.min(facLevel(id), 7)] * f.w * Math.max(0.5, 1 + guildMod('cost'))); };
  const rosterCap = () => 10 + 7 * facLevel('dorm');
  // 현역 모험가들의 고유스킬 중 '길드' 효과(훈련·회복 시간, 후보 수, 게시판, 시설비)를 합친다
  function guildMod(key) {
    let v = 0;
    for (const c of state.characters) {
      if (c.status !== 'ACTIVE' || c.uniqueSkill == null) continue;
      const g = Engine.collectMods(Character.toEngine(c)).mods.guild; if (g && g[key]) v += g[key];
    }
    return v;
  }
  // 파티(또는 한 명)의 고유스킬·특성 효과 합계
  const sumMod = (ids, key) => (ids || []).reduce((a, id) => { const c = state.characters.find((x) => x.id === id); return a + (c ? (Engine.collectMods(Character.toEngine(c)).mods[key] || 0) : 0); }, 0);
  const boardMax = () => BOARD_MAX + facLevel('board') + Math.round(guildMod('board'));
  const spawnMin = () => BOARD_SPAWN_MIN * (1 - 0.05 * facLevel('board'));
  const analysisTrials = () => 30; // 위험도 분석 시설은 폐지: 기본 표시만
  const injuryMinutes = (m) => Math.max(5, Math.round(m * (1 - 0.08 * facLevel('ward')) * Math.max(0.5, 1 + guildMod('wardTime'))));

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
      exp: Math.round(6 * Math.pow(c.level, 1.3) * Math.pow(minutes / 30, 0.9) * eff * Combat.expMulOf(c) * (1 + sumMod([c.id], 'trainExp'))),
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
    const mins = Math.max(5, Math.round(minutes * Math.max(0.5, 1 + guildMod('trainTime'))));
    c.training = { startedAt: t, until: t + mins * MINUTE, minutes, exp: pv.exp, cost: pv.cost };
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
  const APPLICANT_MIN = 1, applicantMax = () => 1 + Math.round(guildMod('cand')), APPLICANT_SPAWN_MIN = 45;

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
    if (forceSkill && c.uniqueSkill == null && !c.skillPending) c.skillPending = true;
    c.name = randomName(new Set([...state.characters.map((x) => x.name), ...state.applicants.map((x) => x.char.name)]));
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
      for (let i = 0; i < steps && state.applicants.length < applicantMax(); i++) { spawnApplicant(t); changed = true; }
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
    deferChat = [];
    if (c.skillPending || (forceSkill && c.uniqueSkill == null)) {
      c.uniqueSkill = registry.acquireRandom(c.id, Math.random); // 비어 있는 스킬이 없으면 null
      delete c.skillPending;
    }
    c.recruitedAt = Date.now();
    glog(`${c.name} 합류 (${c.grade})`, 'hire');
    state.characters.push(c); state.stats.recruited++;

    // 연대기 (처음 일어난 일만 / 특별한 일)
    addChronicle(`첫 번째 모험가 ${c.name} 영입`, 'first-recruit');
    if (['Epic', 'Unique', 'Legendary'].includes(c.grade)) {
      addChronicle(`첫 번째 ${c.grade} ${c.name} 탄생`, 'born:' + c.grade);
    }
    if (c.uniqueSkill !== null) {
      const sk = Character.SKILL_NAMES[c.uniqueSkill];
      addChronicle(`${c.name}${pick(c.name, '이', '가')} 고유스킬 「${sk}」${pick(sk, '을', '를')} 얻음`, null, true);
      addChronicle(`첫 번째 고유스킬 보유자 ${c.name} 탄생`, 'first-skill', true);
      const skText = `${state.guildName || '어느 길드'}의 ${c.name}${pick(c.name, '이', '가')} 고유스킬 {{sk:${c.uniqueSkill}}}${pick(sk, '을', '를')} 획득했어요!`;
      gnotice(skText);
      if (global.Server) global.Server.claimNew(c, skText); // 서버에 소유를 등록 (겹치면 다른 스킬로 바뀜)
    }
    pendingAnn[c.id] = { at: Date.now(), items: deferChat }; deferChat = null;
    setTimeout(() => flushAnnounce(c.id), 30000); // 안전장치
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
    // 유언·유품: 성격에 맞는 마지막 한마디, 가장 가까웠던 사람(살아 있다면)에게 건네는 말
    const fr = bondsOf(c.id).find((b) => b.other.status !== 'DEAD' && b.idx >= 1);
    c.finalWords = Saga.lastWords(c, fr ? fr.other.name : null);
    c.keepsake = Saga.keepsake(c);
    c.epitaph = c.finalWords;
    if (c.uniqueSkill !== null) { registry.release(c.uniqueSkill); if (global.Server) global.Server.release(c.uniqueSkill); } // 스킬은 다시 뽑힐 수 있게 풀림 (기록은 c에 남음)

    addChronicle(`${c.name} 사망 (${c.deathCause})`, null);
    addChronicle(`첫 번째 사망자 ${c.name} 발생`, 'first-death');
    if (c.grade === 'Legendary') addChronicle(`최초 Legendary ${c.name} 사망`, 'died:Legendary');
    save();
    return c;
  }

  // 유품 계승: 가장 가까웠던 생존자가 낮은 확률로 유품을 이어받아 '유지'를 얻는다 (공격·방어 +3%, 최대 2개)
  const HEIR_CHANCE = [0, 0.15, 0.4, 0.7], HEIR_PCT = 0.03, HEIR_MAX = 2;
  function inheritFrom(dead) {
    const b = bondsOf(dead.id).find((q) => q.other.status === 'ACTIVE');
    if (!b || Math.random() >= (HEIR_CHANCE[b.idx] || 0)) return null;
    const h = b.other;
    h.heirs = (h.heirs || []).concat([{ from: dead.name, item: dead.keepsake, at: now() }]).slice(-HEIR_MAX);
    dead.heirName = h.name;
    addChronicle(`${h.name}${pick(h.name, '이', '가')} ${dead.name}의 유품 「${dead.keepsake}」${pick(dead.keepsake, '을', '를')} 이어받았다`, null);
    save();
    return h;
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
  const BOND_CAP_PCT = 0.15, BOND_CAP_DM = 0.2;
  const bondKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const bondValue = (a, b) => state.bonds[bondKey(a, b)] || 0;
  const bondIdx = (v) => { let i = 0; BOND_LEVELS.forEach((l, k) => { if (v >= l.min) i = k; }); return i; };
  const bondInfo = (a, b) => { const v = bondValue(a, b); const i = bondIdx(v); return { value: v, idx: i, name: BOND_LEVELS[i].name, ...BOND_LEVELS[i] }; };
  // 유대를 올리고, 단계가 오르면 그 정보를 돌려준다
  function addBond(a, b, delta) {
    const k = bondKey(a, b), before = bondIdx(state.bonds[k] || 0);
    state.bonds[k] = Math.max(0, Math.min(100, (state.bonds[k] || 0) + delta));
    const after = bondIdx(state.bonds[k]);
    if (after > before) {
      const x = byId(a), y = byId(b);
      addChronicle(`${x.name}${pick(x.name, '과', '와')} ${y.name}의 사이가 「${BOND_LEVELS[after].name}」${pick(BOND_LEVELS[after].name, '이', '가')} 되었다`, 'bond-' + k + '-' + after);
      return { a: x.name, b: y.name, name: BOND_LEVELS[after].name };
    }
    return null;
  }
  // 슬픔: 함께 간 전우가 죽고 살아 돌아온 모험가는 6~24시간(무작위) 동안, 또는 추모식을 열기 전까지 다른 의뢰에 나갈 수 없다
  const mourningUntil = (c) => (c.mourning && c.mourning.until > now() ? c.mourning.until : 0);
  function bondsOf(id) {
    return state.characters.filter((o) => o.id !== id && (state.bonds[bondKey(id, o.id)] || 0) > 0)
      .map((o) => ({ other: o, ...bondInfo(id, o.id) })).sort((x, y) => y.value - x.value);
  }
  // 전투용 파티원 목록: 능력치에 유대·슬픔을 반영한다 (위험도 계산에도 이걸 쓴다)
  // 출정 방침: 출발할 때 한 번 정한다 (전투 중에는 바꿀 수 없다)
  const POLICIES = {
    careful: { name: '신중', atk: 0.95, def: 1.30, death: 0.10, exp: 0.9, gold: 1, desc: '공격 −5% · 방어 +30% · 치명상 버팀 +20%p · 경험치 −10% (더 안전하고 조금 느려요)' },
    balanced: { name: '균형', atk: 1, def: 1, death: 0, exp: 1, gold: 1, desc: '추가 효과 없음' },
    bold: { name: '공격적', atk: 1.10, def: 0.60, death: -0.10, exp: 1.2, gold: 1.1, desc: '공격 +10% · 방어 −40% · 치명상 버팀 −20%p · 경험치 +20% · 금화 +10% (더 빠르지만 위험해요)' },
  };
  const policyOf = (k) => POLICIES[k] || POLICIES.balanced;
  function buildMembers(chars, mon, policy) {
    const ms = chars.map(Combat.memberFrom);
    ms.forEach((m, i) => {
      let pct = 0, dm = 0, hs = 0;
      chars.forEach((o, j) => { if (i !== j) { const b = bondInfo(chars[i].id, o.id); pct += b.pct; dm += b.dm; hs += b.idx / (BOND_LEVELS.length - 1); } });
      pct = Math.min(BOND_CAP_PCT, pct); dm = Math.min(BOND_CAP_DM, dm);
      const hb = 1 + HEIR_PCT * Math.min(HEIR_MAX, (chars[i].heirs || []).length);
      const pol = policyOf(policy);
      m.tw = { atk: (1 + pct) * hb * pol.atk, def: (1 + pct) * hb * pol.def, death: dm + pol.death, hp: hpFrac(chars[i]), harm: chars.length > 1 ? hs / (chars.length - 1) : 0 };
    });
    return ms;
  }

  /* ---------- 의뢰 게시판 ---------- */
  // 길드로 의뢰가 들어온다. 각 의뢰에는 마감이 있고, 마감이 지나면 사라진다.
  const SPECIAL_CHANCE = 0.14;         // 기간 한정 의뢰가 될 확률
  const BOARD_MAX = 6;                 // 게시판에 동시에 걸리는 의뢰 수
  const BOARD_SPAWN_MIN = 20;          // 새 의뢰가 들어오는 간격(분)
  const WIPE_EXP = 0.25;               // 전멸(사망 없이 쓰러짐) 시 경험치 비율
  const COVER_EXP = 0.8;               // 엄호 후퇴 시 경험치 비율 (일반 후퇴보다 많이 받는다)
  const RETREAT_EXP = 0.5;             // 후퇴 시 (처치 비율만큼) 받는 경험치 비율

  // 등급별 의뢰 유형 비중: 채집·도움은 F/E에 몰려 있고 D부터는 거의 없다
  const TYPE_WEIGHT = { F: { gather: 30, help: 24, sweep: 22, wave: 12, boss: 12 }, E: { gather: 24, help: 20, sweep: 30, wave: 14, boss: 12 },
    D: { help: 4, sweep: 45, wave: 25, boss: 20 }, C: { help: 1, sweep: 47, wave: 28, boss: 22 },
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
      if (!state.tutorialRan && !state.board.some((k) => k.tutorial) && !state.missions.some((m) => m.contract.tutorial)) { addTutorialContract(); changed = true; }
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
  // 재료 처리: 출정할 때 정한 방식에 따라 길드가 받거나(받기), 모험가가 팔아 24시간 뒤 지갑에 들어온다(안 받기)
  const matUnit = (name) => { const mi = Gear.MAT_INFO[name], mo = mi.monster && Gear.MONSTERS[mi.monster]; return Math.round(Gear.MAT_PRICE[mi.grade] * (mo && mo.boss ? 1.5 : 1)); };
  // 받기를 고르면 모험가가 가져가는 몫이 늘어난다 (길드 수입에서 빠짐). 안 받기의 재료 판매대금과 비슷한 크기로 맞춘 값.
  const TAKE_FEE = { sweep: 0.19, wave: 0.21, boss: 0.18 };
  // 재료가 나올 확률과 개수 (임시값)
  const MAT_DROP = { sweep: { p: 0.7, a: 2, b: 4 }, wave: { p: 0.8, a: 3, b: 5 }, boss: { p: 1.0, a: 1, b: 2 } };
  const takeFeeRate = (k) => (k.tutorial ? 0 : TAKE_FEE[k.type] || 0);
  function grantMaterial(name, qty) { state.materials[name] = (state.materials[name] || 0) + qty; }
  // 판매대금을 24시간 뒤에 나눠 받는다
  function queuePay(ids, amt, at, label) {
    const list = ids.filter(Boolean); if (!list.length || amt <= 0) return;
    const each = Math.max(1, Math.round(amt / list.length));
    list.forEach((cid) => state.payQueue.push({ id: 'p' + (state.nextItem++), cid, amt: each, at: at + DAY, label }));
  }
  function processPay(t) {
    const due = state.payQueue.filter((p) => p.at <= t);
    if (!due.length) return false;
    due.forEach((p) => { const c = byId(p.cid); if (c && c.status !== 'DEAD') c.wallet = (c.wallet || 0) + p.amt; });
    state.payQueue = state.payQueue.filter((p) => p.at > t);
    return true;
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
  const isFree = (c) => c.status === 'ACTIVE' && !missionOf(c) && !c.training;

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
    c.mourning = null;
    addChronicle(`${c.name}${pick(c.name, '이', '가')} 초기화권을 써서 처음부터 다시 걷기 시작했다`, null);
    save(); return { ok: true };
  }
  const grantResetTicket = (n) => { state.items.resetTicket = resetTickets() + (n || 1); save(); };

  /* ---------- 길잡이 퀘스트 · 해금 ---------- */
  // 순서대로 하나씩 열린다. 달성하면 보상을 받고, 탭이 열리며(unlock), 그 기능의 짧은 안내(chapter)가 뜬다. 보상·조건은 임시 값.
  const GUIDE = [
    { id: 'hire', title: '모험가 채용하기', hint: '주점에서 지원자의 이야기를 듣고 채용해요.', goal: 1, cur: () => state.stats.recruited, gold: 0, unlock: 'quests', open: '원정' },
    { id: 'first', title: '첫 의뢰 완수하기', hint: '원정 탭에서 연습 의뢰를 받아 모험가를 보내요.', goal: 1, cur: () => (state.tutorial >= TUTORIAL_DONE ? 1 : 0), gold: 150, unlock: 'roster', open: '동료', chapter: 'roster' },
    { id: 'clear3', title: '의뢰 3건 완수하기', hint: '원정 탭의 게시판에서 의뢰를 골라 보내요.', goal: 3, cur: () => state.stats.clears, gold: 200, unlock: 'shop', open: '장터', chapter: 'market' },
    { id: 'clear8', title: '의뢰 8건 완수하기', hint: '모험가를 키우며 의뢰를 계속 해결해요.', goal: 8, cur: () => state.stats.clears, gold: 300, unlock: 'guild', open: '길드', chapter: 'guild' },
    { id: 'promote', title: '길드를 E등급으로 승급하기', hint: '의뢰로 명성을 모아 길드 탭에서 승급해요.', goal: 1, cur: () => (state.guildGrade >= 1 ? 1 : 0), gold: 500 },
  ];
  const unlockedCat = (id) => !state.guide || id === 'hub' || id === 'recruit' || !!state.guide.unlock[id];
  const lockReason = (id) => { const q = GUIDE.find((x) => x.unlock === id); return q ? `'${q.title}'를 마치면 열려요.` : ''; };
  // 달성한 퀘스트를 처리한다. 새로 마친 것이 있으면 true
  function guideCheck() {
    if (!state || !state.guide) return false;
    const g = state.guide; let any = false;
    for (const q of GUIDE) {
      if (g.done[q.id] || q.cur() < q.goal) continue;
      g.done[q.id] = Date.now(); any = true;
      if (q.gold) state.gold += q.gold;
      if (q.unlock) g.unlock[q.unlock] = true;
      if (q.chapter) g.queue.push(q.chapter);
      g.news.push({ id: q.id, title: q.title, gold: q.gold, open: q.open || '' });
    }
    if (any) save();
    return any;
  }
  const guideInfo = () => GUIDE.map((q) => ({ id: q.id, title: q.title, hint: q.hint, goal: q.goal, cur: Math.min(q.goal, q.cur()), gold: q.gold, open: q.open || '', done: !!(state.guide && state.guide.done[q.id]) }));
  const guideNow = () => guideInfo().find((q) => !q.done) || null; // 지금 목표
  const takeGuideNews = () => { const n = state.guide.news; state.guide.news = []; return n; };
  const guideChap = () => (state.guide && state.guide.chap) || null;
  function guideStartChapter() { const g = state.guide; if (!g.chap && g.queue.length) { g.chap = { id: g.queue.shift(), i: 0 }; save(); } return g.chap; }
  function guideSetChap(i, len) { const g = state.guide; if (!g.chap) return; if (i >= len) { g.chap = null; } else g.chap.i = i; save(); }
  const guideQueued = () => !!(state.guide && (state.guide.chap || state.guide.queue.length));

  /* ---------- 튜토리얼 (건너뛸 수 없다) ---------- */
  // 연습 의뢰: 몬스터가 약해서 튜토리얼 첫 전투에서 목숨을 잃을 걱정이 거의 없다
  function addTutorialContract() {
    const ex = state.board.find((k) => k.tutorial); if (ex) { ex.expiresAt = now() + 24 * 3600000; return ex; } // 이미 걸려 있으면 새로 만들지 않는다
    const tpl = Combat.templateById('F-sweep');
    const k = Combat.makeContract(tpl, now(), Math.random, 1);
    k.name = '연습 의뢰: ' + tpl.name; k.level = 1; k.exp = Combat.questExp(3); k.gold = 50; k.easy = 0.03; k.total = 4; k.min = 1; k.max = 2; k.size = 1;
    k.id = 'k' + (state.nextContract++); k.expiresAt = now() + 24 * 3600000; k.tutorial = true;
    state.board.unshift(k); save(); return k;
  }
  const tutorialStep = () => state.tutorial;
  const tutorialActive = () => state.tutorial < TUTORIAL_DONE;
  // 연습 의뢰는 튜토리얼 안에서 한 번만 쓴다. 끝났거나 다시 시작하면 게시판에 남은 연습 의뢰를 치운다.
  const purgeTutorialContracts = () => { state.board = state.board.filter((k) => !k.tutorial); };
  function setTutorial(n) {
    state.tutorial = n;
    if (n >= TUTORIAL_DONE) { purgeTutorialContracts(); }
    else if (n === 0) { state.tutorialRan = false; purgeTutorialContracts(); state.guide = newGuide(); }
    save();
  }
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
    tutorialDone: () => (state.tutorial >= TUTORIAL_DONE ? 1 : 0),
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
  // 추모식: 함께했던 사람들의 슬픔(출정 불가)을 풀어 준다
  function mourn(id) {
    const c = byId(id);
    if (!c || !mournable(c)) return { ok: false, reason: '이미 추모를 마쳤어요.' };
    if (state.gold < MOURN_COST) return { ok: false, reason: `금화가 부족해요. (${MOURN_COST} 필요)` };
    state.gold -= MOURN_COST; c.mourned = now(); state.stats.mourns++;
    const eased = [];
    for (const o of state.characters) {
      if (o.mourning && o.mourning.ids && o.mourning.ids.includes(c.id)) {
        o.mourning.ids = o.mourning.ids.filter((x) => x !== c.id);
        if (!o.mourning.ids.length) { o.mourning = null; if (o.status !== 'DEAD') eased.push(o.name); } // 모든 전우의 추모를 마치면 슬픔이 풀려 다시 나갈 수 있다
      }
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
  function sendParty(contractId, memberIds, policy, matMode) {
    const k = state.board.find((x) => x.id === contractId);
    if (!k || k.expiresAt <= now()) return { ok: false, reason: '이미 마감되었거나 사라진 의뢰예요.' };
    const ids = Array.from(new Set(memberIds || []));
    if (ids.length < k.min || ids.length > k.max) {
      return { ok: false, reason: k.min === k.max ? `이 의뢰는 ${k.min}명이 필요해요.` : `이 의뢰는 ${k.min}~${k.max}명으로 보내야 해요.` };
    }
    const members = ids.map(byId);
    if (members.some((c) => !c || !isFree(c))) return { ok: false, reason: '의뢰를 보낼 수 없는 모험가가 있어요.' };
    const mo = members.find((c) => mourningUntil(c));
    if (mo) return { ok: false, reason: `${mo.name}${pick(mo.name, '은', '는')} 전우를 추모하는 중이에요. 기념비에서 추모식을 열면 바로 나갈 수 있어요.` };
    const tb = takeBlock(members, k); if (tb) return { ok: false, reason: tb };

    const t = now();
    const mm = k.type === 'help' || k.tutorial ? 'take' : (matMode === 'sell' ? 'sell' : 'take');
    if (Combat.isWait(k)) { // 채집·도움: 정해진 시간만 기다리면 돌아온다 (실시간 확인 없음)
      const m = { id: 'm' + (state.nextMission++), contract: k, memberIds: ids, startedAt: t, paused: 0, wait: true, phase: 'plain', plain: 'win', mat: mm,
                  endsAt: t + waitMinutes(k, ids.length) * MINUTE, qty: k.type === 'gather' ? gatherQty(k, members) : 0, battle: { m: [], t: 0, kills: 0, log: [], dead: [] } };
      state.board = state.board.filter((x) => x.id !== contractId);
      addBoardGap(now());
      state.missions.push(m); glog(`파티 출발: ${ids.map((i) => (byId(i) || {}).name).filter(Boolean).join(', ')} → 「${k.name}」`, 'go'); save();
      return { ok: true, mission: m };
    }
    if (k.tutorial) { state.tutorialRan = true; members.forEach((c) => { c.hpPct = 0.14; c.hpAt = now(); }); } // 튜토리얼: 위기 결정을 해 볼 수 있게 일부러 체력을 15% 아래로 맞춘다
    const pk = k.easy || k.tutorial ? 'balanced' : (POLICIES[policy] ? policy : 'balanced');
    const bm = buildMembers(members, k.monster, pk);
    if (knowledge(k.monster) >= 1) bm.forEach((x) => { x.tw.atk *= 1 + Math.min(0.08, 0.01 * facLevel('archive')); }); // 기록실: 도감에 등록된 몬스터에게 주는 피해
    const st = Combat.startBattle(bm, k);
    const first = Combat.advanceBattle(st, k, Math.random, true);
    // 전투는 실시간으로 진행된다: 전투 시계 1초 = 실제 1초. 얼마나 걸릴지는 싸워 봐야 안다.
    const m = { id: 'm' + (state.nextMission++), contract: k, memberIds: ids, startedAt: t, paused: 0, battle: st, policy: pk, mat: mm };
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
    state.missions.push(m); glog(`파티 출발: ${ids.map((i) => (byId(i) || {}).name).filter(Boolean).join(', ')} → 「${k.name}」`, 'go');
    save();
    return { ok: true, mission: m };
  }

  // 채집·도움이 끝나 돌아왔다: 다치거나 죽는 일은 없다
  function finishWait(m, at) {
    const k = m.contract;
    state.missions = state.missions.filter((x) => x !== m);
    const gi = Math.max(0, GRADES.indexOf(k.grade));
    const gg = Math.round(k.gold * (1 + Math.min(1, sumMod(m.memberIds, 'goldMul'))));
    const res = { id: 'r' + at + '-' + m.id, t: at, questName: k.name, outcome: 'win', kind: 'wait', gold: gg, auto: false, killed: 0, members: [], log: [], drops: [], bonds: [] };
    state.gold += gg;
    const S = state.stats; S.clears++; S.goldEarned += gg; S.byGrade[k.grade] = (S.byGrade[k.grade] || 0) + 1; S.waits = (S.waits || 0) + 1;
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
    if (k.type === 'gather') {
      const q = m.qty || k.qty, val = q * matUnit(k.item), alive = m.memberIds.filter((id) => byId(id));
      if (m.mat === 'sell') { queuePay(alive, val, at, k.item); res.drops.push(`${k.item} ×${q} 판매 → 대금 ${val}금은 24시간 뒤 모험가들의 지갑에 들어와요`); }
      else {
        const fee = Math.min(state.gold, val); state.gold -= fee; res.fee = fee;
        grantMaterial(k.item, q);
        alive.forEach((id) => { const c = byId(id); c.wallet = (c.wallet || 0) + Math.round(fee / alive.length); });
        res.drops.push(`${k.item} ×${q} 보급고로 (모험가 수수료 ${fee}금)`);
      }
    }
    else res.drops.push(`${k.place} 사람들이 고마워했어요`);
    glog(`「${k.name}」 ${outcome === 'win' ? '완수' : outcome === 'retreat' ? '후퇴' : outcome === 'stalemate' ? '교착' : '실패'} (${names})`, outcome === 'win' ? 'win' : 'bad');
    for (const r of res.members) if (r.newLevel > r.oldLevel) glog(`${r.name} Lv.${r.newLevel} 달성`, 'level');
    // 귀환 에피소드: 이번 원정에서 있었던 일을 성격이 묻어나는 한두 줄로 남긴다
    try {
      const mem = st.m.map((x) => { const c = byId(x.id); return { name: c.name, tone: Saga.toneOf(c), kills: x.kills || 0, dmg: x.dmg || 0, fate: x.state === 'dead' ? 'dead' : 'ok', hp: x.hpMax ? x.hp / x.hpMax : undefined, id: c.id }; });
      const pairs = []; for (let i = 0; i < mem.length; i++) for (let j = i + 1; j < mem.length; j++) if (mem[i].fate !== 'dead' && mem[j].fate !== 'dead' && bondInfo(mem[i].id, mem[j].id).idx >= 1) pairs.push([mem[i].name, mem[j].name]);
      const dead = mem.filter((x) => x.fate === 'dead').map((x) => { const f = bondsOf(x.id).find((q) => st.m.some((y) => y.id === q.other.id && y.state !== 'dead') && q.idx >= 1); return { name: x.name, friend: f ? f.other.name : null }; });
      res.episodes = Saga.episodes({ outcome, hadCrisis: !!m.hadCrisis, members: mem, pairs, dead });
    } catch (e) { res.episodes = []; }
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
    const gg = outcome === 'win' ? Math.round(k.gold * policyOf(m.policy).gold * (1 + Math.min(1, sumMod(m.memberIds, 'goldMul')))) : 0;
    const pol = policyOf(m.policy); res.policy = m.policy || 'balanced';
    if (outcome === 'win') {
      pool = k.exp * nm * pol.exp;
      const fee = m.mat === 'take' ? Math.round(gg * takeFeeRate(k)) : 0; // 재료 받기: 모험가가 가져가는 몫이 늘어난다
      res.fee = fee; res.gold = gg - fee; state.gold += gg - fee;
    }
    else if (outcome === 'retreat') pool = Math.round(k.exp * nm * pol.exp * (m.cover ? COVER_EXP : RETREAT_EXP) * progress);
    else if (outcome === 'wipe') pool = Math.round(k.exp * nm * pol.exp * WIPE_EXP * progress);
    // 길드 명성: 클리어 +100%, 사망 1명당 -50%, 전멸 -150% (후퇴·이탈은 0). 0 아래로 내려가지 않는다.
    {
      const base = FAME_BY_GRADE[Math.max(0, GRADES.indexOf(k.grade))], deaths = st.m.filter((x) => x.state === 'dead').length;
      const avgRank = st.m.reduce((a, x) => a + rankOf(byId(x.id) || {}), 0) / Math.max(1, st.m.length);
      let fd = outcome === 'win' ? Math.round(base * (1 + 0.04 * avgRank) * (1 + Math.min(1, sumMod(m.memberIds, 'fame')))) : 0; // 높은 등급 모험가가 해낸 일은 명성이 조금 더 붙는다
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
        const trait = 1 + sumMod([c.id], 'codexExp') * (knowledge(k.monster) >= 1 ? 1 : 0) + sumMod([c.id], 'veteran') * Math.min(1, state.stats.clears / 300); // 특성: 관찰자(도감 몬스터) · 베테랑(클리어 횟수)
        r.exp = Math.round(pool * share(x) * Combat.expMulOf(c) * trait);
        if (r.exp > 0) Character.addExp(c, r.exp);
        r.newLevel = c.level;
        if (x.state === 'down') r.fate = 'injured';
        else if (outcome === 'retreat') r.fate = 'injured';
        const fr = x.hpMax ? x.hp / x.hpMax : 1;
        const floor = r.fate === 'ok' ? 0.05 : 0.1 + 0.5 * Math.max(0, sumMod([c.id], 'retreatInjury')); // 후퇴·쓰러짐으로 돌아올 때의 최소 체력(고유스킬로 올라간다)
        c.hpPct = Math.max(floor, Math.min(1, fr)); c.hpAt = at; r.hpAfter = c.hpPct;
        if (k.tutorial) { c.hpPct = 1; r.hpAfter = 1; } // 튜토리얼 의뢰가 끝나면 체력을 전부 회복시켜 준다
        if (outcome === 'win') { r.rankPts = rankPoints(c, k, st.t, false); r.rankUp = awardRank(c, r.rankPts, at); }
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
        S.clears++; S.goldEarned += gg;
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
    const hand = (it, label) => {
      if (!survivors.length) return;
      const who = survivors[rint(0, survivors.length - 1)], text = gainGear(who, it, label);
      res.drops.push(text); (res.gear = res.gear || []).push({ item: it, who: who.name, label, text }); // 귀환 보고에서 눈에 띄게 보여 주려고 따로 적어 둔다
    };
    if (outcome === 'win') {
      const info = Gear.MONSTERS[k.monster];
      // 재료 드롭: 확률과 개수는 MAT_DROP. 받기는 보급고로, 안 받기는 모험가가 팔아 24시간 뒤 지갑으로
      const dp = MAT_DROP[k.type] || MAT_DROP.sweep;
      if (res.fee && survivors.length) { // 받기: 늘어난 수수료는 살아 돌아온 모험가가 나눠 가진다
        const each = Math.round(res.fee / survivors.length);
        survivors.forEach((c) => { c.wallet = (c.wallet || 0) + each; });
      }
      if (info && Math.random() < dp.p) {
        const qty = rint(dp.a, dp.b);
        if (m.mat === 'sell') { const val = qty * matUnit(info.mat); queuePay(survivors.map((c) => c.id), val, at, info.mat); res.drops.push(`${info.mat} ×${qty} 판매 → 대금 ${val}금은 24시간 뒤 지갑에 들어와요`); }
        else { grantMaterial(info.mat, qty); res.drops.push(`${info.mat} ×${qty} 보급고로`); }
      }
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
      if (m.cover && (k.type === 'sweep' || k.type === 'wave') && st.kills > 0 && k.total > 1) k.total = Math.max(1, k.total - st.kills); // 엄호로 번 시간: 쓰러뜨린 만큼 다음 도전이 가벼워진다
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
    if (m.cover && m.cover.survived) for (const y of alive) if (y.id !== m.cover.id) { const up = addBond(m.cover.id, y.id, 6); if (up) res.bonds.push(up); } // 목숨 걸고 지켜 준 사이
    const fallen = st.m.filter((x) => x.state === 'dead');
    if (fallen.length && alive.length) {
      const ids = fallen.map((d) => d.id), hold = [];
      for (const y of alive) { const c = byId(y.id); if (!c) continue; c.mourning = { until: at + (6 + Math.random() * 18) * 3600000, ids: ids.slice() }; hold.push(c.name); }
      if (hold.length) res.drops.push(`전우를 잃은 ${hold.join(', ')}${pick(hold[hold.length - 1], '은', '는')} 슬픔에 잠겼어요. 6~24시간 동안, 또는 기념비에서 추모식을 열 때까지 다른 의뢰에 나갈 수 없어요.`);
    }
    for (const d of st.m.filter((x) => x.state === 'dead')) {
      for (const y of alive) {
        const idx = bondInfo(y.id, d.id).idx;
        if (idx >= 1) {
          const c = byId(y.id);
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

    // 귀환 에피소드: 이번 원정에서 있었던 일을 성격이 묻어나는 한두 줄로 남긴다
    try {
      const mem = st.m.map((x) => { const c = byId(x.id); return { name: c.name, tone: Saga.toneOf(c), kills: x.kills || 0, dmg: x.dmg || 0, fate: x.state === 'dead' ? 'dead' : 'ok', hp: x.hpMax ? x.hp / x.hpMax : undefined, id: c.id }; });
      const pairs = []; for (let i = 0; i < mem.length; i++) for (let j = i + 1; j < mem.length; j++) if (mem[i].fate !== 'dead' && mem[j].fate !== 'dead' && bondInfo(mem[i].id, mem[j].id).idx >= 1) pairs.push([mem[i].name, mem[j].name]);
      const dead = mem.filter((x) => x.fate === 'dead').map((x) => { const f = bondsOf(x.id).find((q) => st.m.some((y) => y.id === q.other.id && y.state !== 'dead') && q.idx >= 1); return { name: x.name, friend: f ? f.other.name : null }; });
      res.episodes = Saga.episodes({ outcome, hadCrisis: !!m.hadCrisis, members: mem, pairs, dead });
      if (m.cover) { const cc = byId(m.cover.id); if (cc) { res.cover = { name: cc.name, survived: !!m.cover.survived }; res.episodes.unshift(`${cc.name}${pick(cc.name, '이', '가')} 남아 퇴각을 엄호했다 — ${m.cover.survived ? '상처투성이로 살아 돌아왔다.' : '끝내 돌아오지 못했다.'}`); res.episodes = res.episodes.slice(0, 4); } }
    } catch (e) { res.episodes = []; }
    state.inbox.push(res);
    if (state.inbox.length > 40) state.inbox.splice(0, state.inbox.length - 40);
    // 사망 처리는 결과를 담은 뒤에 (연대기 순서를 위해)
    for (const x of st.m) {
      if (x.state === 'dead') {
        // 같이 나갔던 동료가 한 명이라도 돌아왔다면 사망 원인을 알 수 있다. 모두 쓰러졌다면 알 수 없다.
        const known = st.m.some((y) => y.state !== 'dead');
        const cause = (m.cover && m.cover.id === x.id) ? `「${k.name}」에서 동료들의 퇴각을 엄호하다 쓰러짐` : known ? `「${k.name}」에서 ${k.monster}에게 쓰러짐 (${auto ? '결정 시간 초과로' : '후퇴하지 않고'} 싸움을 이어감)` : `「${k.name}」에서 전멸 — 아무도 돌아오지 못해 사망 원인을 알 수 없어요`;
        kill(x.id, cause);
        { const dc = state.characters.find((y) => y.id === x.id); if (dc) dc.deathInfo = { quest: k.name, grade: k.grade, known, monster: known ? k.monster : '' }; }
        { // 유언과 계승을 귀환 보고에 남긴다
          const dc = byId(x.id), rm = res.members.find((q) => q.id === x.id);
          if (dc && rm) { rm.lastWords = dc.finalWords; rm.keepsake = dc.keepsake; }
          const heir = dc ? inheritFrom(dc) : null;
          if (heir && rm) rm.heir = { name: heir.name, item: dc.keepsake };
        }
      }
    }
    return res;
  }

  const outcomeOf = (r) => (r === 'win' ? 'win' : r === 'wipe' ? 'wipe' : 'stalemate');

  // 위기 신호에 대한 결정
  //  choice: 'retreat'(전체 후퇴) / 'continue'(계속 싸운다)
  // 엄호를 맡았을 때 살아 돌아올 확률: 체력이 남아 있을수록 높다
  function coverChance(x) { const f = x.hpMax ? x.hp / x.hpMax : 0.5; return Math.max(0.15, Math.min(0.8, 0.2 + 0.5 * f)); }
  // 위기 때 동료들이 낸 의견 (한 번만 정해서 저장)
  function councilOf(m) {
    if (m.council) return m.council;
    const st = m.battle, crisisIds = st.crisisIds || [];
    const fit = st.m.filter((x) => x.state === 'fit');
    const safeLow = m.hint === '희박' || m.hint === '낮음';
    m.council = fit.map((x) => {
      const c = byId(x.id); if (!c) return null;
      const friendCrisis = crisisIds.some((id) => id !== x.id && bondInfo(x.id, id).idx >= 1);
      const o = Saga.opinion(c, { hpFrac: x.hpMax ? x.hp / x.hpMax : 1, selfCrisis: crisisIds.includes(x.id), friendCrisis, safeLow }, m.nextCrisis || 0);
      return { id: x.id, name: x.name, side: o.side, line: o.line };
    }).filter(Boolean);
    return m.council;
  }
  // 결정이 누구의 의견을 따랐는지에 따라 동료 사이가 조금 변한다 (결정 시간 초과로 자동 진행될 때는 변하지 않는다)
  function councilEffect(m, side) {
    const cn = m.council; if (!cn || cn.length < 2) return;
    m.council = null;
    for (let i = 0; i < cn.length; i++) for (let j = i + 1; j < cn.length; j++) {
      const a = cn[i], b = cn[j];
      const d = a.side === b.side ? (a.side === side ? 2 : 1) : -2;
      if (byId(a.id) && byId(b.id)) addBond(a.id, b.id, d);
    }
  }
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
      if (r === 'crisis') { m.crisisAt = simMs(m); m.deadline = m.crisisAt + decisionMs(k, m.memberIds); m.hint = null; m.council = null; m.nextCrisis = (m.nextCrisis || 0) + 1; return; }
      m.phase = 'plain'; m.plain = (r === 'retreat' && !st.m.some((x) => x.state === 'fit')) ? 'retreat' : outcomeOf(r); m.endsAt = simMs(m);
    };
    if (choice === 'cover') {
      const x = st.m.find((y) => y.id === memberId && y.state === 'fit');
      if (!x) return { ok: false, reason: '엄호를 맡을 수 있는 모험가가 아니에요.' };
      if (st.m.filter((y) => y.state === 'fit').length < 2) return { ok: false, reason: '혼자서는 엄호할 사람이 없어요. 전체 후퇴를 선택해 주세요.' };
      const survived = Math.random() < coverChance(x);
      m.cover = { id: x.id, survived };
      const nm = x.name;
      st.log.push(`${nm}${pick(nm, '이', '가')} 남아 동료들의 퇴각을 엄호했다.`);
      if (!survived) { x.state = 'dead'; x.hp = 0; st.dead.push(x.id); st.log.push(`${nm}${pick(nm, '이', '가')} 쓰러져 숨을 거뒀다.`); }
      else x.hp = Math.max(1, Math.round(x.hpMax * 0.1));
      councilEffect(m, 'back');
      res = finishMission(m, 'retreat', t);
    } else if (choice === 'retreat') {
      st.log.push('전체 후퇴 명령을 내렸다.');
      councilEffect(m, 'back');
      res = finishMission(m, 'retreat', t);
    } else {
      councilEffect(m, 'fight');
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
    if (processPay(t)) changed = true;
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
      return { state: 'alert', quest: k, deadline: m.deadline, hint: m.hint, council: councilOf(m),
               cover: m.battle.m.filter((x) => x.state === 'fit').map((x) => ({ id: x.id, name: x.name, p: coverChance(x) })),
               crisis: Combat.crisisMembers(m.battle).map((x) => x.id) };
    }
    return { state: 'running', quest: k, clock: battleClock(m) };
  }

  // 체력: 전투에서 닳은 만큼 그대로 돌아오고, 길드에 있는 동안 천천히 차오른다 (병동 레벨이 높을수록 빠르다)
  const fullMinutes = (c) => Math.max(5, injuryMinutes(HEAL_FULL_MIN) * Math.max(0.4, 1 - sumMod([c.id], 'injury')));
  function hpFrac(c) {
    if (typeof c.hpPct !== 'number') return 1;
    if (missionOf(c) && !missionOf(c).wait) return c.hpPct;
    const el = Math.max(0, (now() - (c.hpAt || now())) / MINUTE);
    return Math.min(1, c.hpPct + el / fullMinutes(c));
  }
  // 체력이 가득 차는 시각
  function recoverAt(c) { const f = hpFrac(c); return now() + (1 - f) * fullMinutes(c) * MINUTE; }

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
    snapshot, importSave, swapSkill, retarget, freshAppearanceId,
    load, save, resetAll, recruit, kill, byStatus, adventureDays,
    checkAbsence, returnCharacter, simulateAbsence, addGold, advanceTime,
    sendParty, decide, tick, missionInfo, missionOf, missionById, isFree, hpFrac, recoverAt, dismissResult, now,
    codexMon() { return state.codex.mon; },
    hire, flushAnnounce, dismissApplicant, refillApplicants() { state.applicants = []; refreshApplicants(); save(); }, setSkillBoost(m) { skillBoost = m || 1; }, setForceSkill(b) { forceSkill = !!b; },
    get applicants() { return state.applicants; },
    BOND_LEVELS, POLICIES, coverChance, bondInfo, bondsOf, mourningUntil, buildMembers,
    lobby, lobbyNextAt, inLobby, talksLeft, TALK_PER, cancelTraining, achList, checkAch, takeAchNew, codexPct, monTotal, monKnown, MOURN_COST, mournable, mourn, talkOptions, talk,
    advanceCharacter(id, cls) {
      const c = byId(id);
      if (!c || !isFree(c) || !Character.advance(c, cls)) return { ok: false, reason: '전직할 수 없어요.' };
      addChronicle(`${c.name}, 「${cls}」(으)로 전직하다`, 'advance');
      save(); return { ok: true };
    },
    devSetLevel(id, lv) { const c = byId(id); if (c) { c.level = lv; c.exp = 0; save(); } },
    battleClock, battleView, knowledge, knowT, matCount, takeFeeRate, MAT_DROP, matUnit, matHave, waitMinutes, gatherQty, helpSpeed, recipeOpen, recipeFee, craftSlots, craftMinutes, startCraft, dumpPrice, dumpItem, dumpBelow, shopSlots, displayItem, undisplayItem, setPrice, gearScore,
    devShopVisit(c) { return shopVisit(c, Guild.now()); },
    devMat(n, q) { state.materials[n] = (state.materials[n] || 0) + q; save(); },
    TRAIN_OPTIONS, trainSlots, trainees, trainPreview, startTraining,
    unlockedCat, lockReason, guideCheck, guideInfo, guideNow, takeGuideNews, guideChap, guideStartChapter, guideSetChap, guideQueued,
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
    unsetName() { state.guildNamed = false; save(); },
    nameGuild(name) { const n = String(name || '').trim().slice(0, 8); if (n.length < 2) return { ok: false, reason: '길드 이름은 2~8글자로 지어 주세요.' }; state.guildName = n; state.guildNamed = true; addChronicle(`길드의 이름이 「${n}」으로 정해졌다`, null); save(); return { ok: true }; },
    // 이름을 바꾸면 명성이 절반으로 떨어진다
    renameGuild(name) {
      const n = String(name || '').trim().slice(0, 8);
      if (n.length < 2) return { ok: false, reason: '길드 이름은 2~8글자로 지어 주세요.' };
      if (n === state.guildName) return { ok: false, reason: '지금과 같은 이름이에요.' };
      const before = state.fame; state.fame = Math.floor(state.fame * 0.5); state.guildName = n;
      addChronicle(`길드가 「${n}」으로 이름을 바꿨다 (명성 ${before} → ${state.fame})`, null); save();
      return { ok: true, lost: before - state.fame };
    },
    setName(name) { state.guildName = String(name).trim().slice(0, 8) || '이름 없는 길드'; save(); },
  };
})(window);
