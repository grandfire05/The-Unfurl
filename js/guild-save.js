/* ============================================================
   guild-save.js - 저장 데이터 읽기·쓰기와, 예전 버전 저장을 지금 구조로 맞추는 보정(마이그레이션)
   길드 규칙은 모르고 데이터 모양만 다룬다. (guild.js보다 먼저 불러온다)
   ============================================================ */
(function (global) {
  'use strict';
  // 이 기기에는 게임을 저장하지 않는다. 로그인한 계정의 서버 저장만 쓴다. (게스트는 새로고침하면 처음부터)
  function read() { return null; }
  function write() { return true; }
  function remove() { /* 저장한 게 없다 */ }

  // 튜토리얼 도중에 나갔다 들어오면 이어 하거나 처음부터 다시 한다(튜토리얼 중의 진행은 되돌리고 길드 이름만 남긴다).
  // 처음부터 하는 경우 state는 null, 이름은 keepName으로 돌려준다.
  function resumeTutorial(state, TUTORIAL_DONE) {
    let keepName = null;
    if (state && state.version === 3 && typeof state.tutorial === 'number' && state.tutorial > 0 && state.tutorial < TUTORIAL_DONE) {
      const t = state.tutorial, hired = Array.isArray(state.characters) && state.characters.length >= 1;
      if (t >= 29) { state.tutorial = TUTORIAL_DONE; } // 첫 의뢰를 마친 뒤(길잡이 안내)에 나갔다면 끝낸 것으로 본다
      else if (t >= 8 && hired && state.characters.some((c) => c.status === 'ACTIVE')) { // 채용까지 마쳤다면 그 뒤부터 이어 한다: 첫 원정 안내는 처음 장면(9)으로 되돌린다
        state.tutorial = 9; state.tutorialRan = false;
        state.board = (state.board || []).filter((k) => !k.tutorial);
        state.missions = (state.missions || []).filter((m) => !(m.contract && m.contract.tutorial));
        state.inbox = (state.inbox || []).filter((r) => !JSON.stringify(r).includes('"tutorial":true'));
        for (const c of state.characters) { delete c.mission; if (c.status === 'ACTIVE') { c.hpPct = 1; c.hpAt = Date.now(); delete c.injuredUntil; } } // 튜토리얼 원정에서 깎인 체력을 되돌린다
      } else { // 환영·채용 도중에 나갔다면 처음부터 다시 한다
        keepName = { n: state.guildName, ok: state.guildNamed };
        state = null;
      }
    }
    return { state, keepName };
  }

  // 예전 버전 저장 데이터를 지금 구조로 맞춘다(없는 값 채우기, 이름이 바뀐 재료·몬스터 정리 등).
  // d: { START_GOLD, TUTORIAL_DONE, newStats, Guide, Gear }
  function migrate(state, d) {
    const { START_GOLD, TUTORIAL_DONE, newStats, Guide, Gear } = d;
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
    if (!state.guide) { state.guide = Guide.newGuide(true); Guide.GUIDE.forEach((q) => { state.guide.done[q.id] = 1; }); } // 예전 저장은 전부 열린 상태로 이어서 한다
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
  global.GuildSave = { read, write, remove, resumeTutorial, migrate };
})(window);
