/* ============================================================
   ui.js - 게임 화면 (7단계 전 화면 개편)
   화면 5개: 홈(길드 홀) / 모험가 명부 / 의뢰 게시판 / 전투 / 연대기
   게임 규칙은 Guild·Combat가 갖고, 이 파일은 보여 주고 입력을 전달하기만 한다.
   ============================================================ */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const icon = Art.icon, esc = Art.esc;
  const fmt = (n) => BigInt(n).toLocaleString('en-US');
  const pad = (n) => String(n).padStart(2, '0');
  const dateText = (t) => { const d = new Date(t); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };
  const skillName = (c) => (c.uniqueSkill === null ? null : Character.SKILL_NAMES[c.uniqueSkill]);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const minText = (m) => (m >= 60 ? (m % 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m / 60}시간`) : `${m}분`);
  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`;
  }
  const hasBatchim = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c % 28 !== 0; };
  const eun = (w) => w + (hasBatchim(w) ? '은' : '는');

  /* ---------- 화면 상태 ---------- */
  const U = {
    screen: 'hub',      // hub | roster | quests | battle | chronicle | guild | recruit | codex | memorial
    codexTab: 'skill',  // 도감 탭: skill | monster
    skFilter: 'all', codexSel: null,     // 도감에서 고른 항목
    memSel: null,       // 추모비에서 고른 모험가
    chrFilter: 'all',   // 연대기 필터
    applicant: null,    // 영입 면접에서 보고 있는 지원자 id
    tab: 'active',      // 명부 탭: active | left | dead
    selId: null,        // 명부에서 고른 모험가
    contract: null,     // 의뢰 게시판에서 고른 의뢰 id
    party: [],          // 편성 중인 파티 (모험가 id)
    battle: null,       // 전투 화면에서 보고 있는 의뢰(mission) id
    achCat: '전체',     // 업적 분류
    childMode: false,   // Space로 들어가는 하위 항목 선택 모드
    modal: null,        // { type: mail | settings | help | recruit | confirm, ... }
    seenMail: 0,        // 이미 알린 보고 수 (새 보고가 오면 알림을 띄운다)
    rosterSort: 'recent', rosterClass: '', candSort: 'rec',
    boost: false,       // 개발: 고유스킬 확률 증가
    showTalent: false,  // 개발: 재능 수치 표시
  };

  const QUEST_DESC = {
    q1: '곳간을 갉아먹는 들쥐 떼가 마을을 괴롭히고 있어요. 이제 막 길드에 들어온 모험가에게 어울리는 의뢰예요.',
    q2: '숲길을 오가는 상인들이 늑대 무리에게 쫓기고 있어요. 길목을 지켜 주세요.',
    q3: '고블린들이 야영지를 차리고 근처 농가를 약탈하고 있어요. 수가 많으니 방심은 금물이에요.',
    q4: '동굴 깊은 곳의 트롤이 광부들의 길을 막고 있어요. 한 방 한 방이 묵직한 상대예요.',
    q5: '용암 지대에서 깨어난 골렘이 마을로 다가오고 있어요. 단단한 껍질을 깨야 해요.',
    q6: '고대 용이 산맥 위를 날고 있어요. 길드의 이름을 걸고 맞서야 하는, 가장 위험한 의뢰예요.',
  };
  const BATTLE_BG = {
    q1: ['#6b5a47', '#3d3027', '#4a3a2c', '#2a2018'], q2: ['#2f4a3a', '#1d3027', '#2b3a28', '#16200f'],
    q3: ['#4a4338', '#2e2a24', '#3c3a2a', '#1d1b12'], q4: ['#2c2f42', '#1a1c2a', '#2b2b36', '#15151c'],
    q5: ['#5a2a1c', '#2e1410', '#3a2018', '#1c0e09'], q6: ['#3a2f55', '#201a33', '#2d2a3a', '#141220'],
  };
  const MON_PX = { q1: 100, q2: 130, q3: 120, q4: 170, q5: 190, q6: 230 };
  const TYPE_DESC = { gather: '정해진 시간 동안 재료를 모아 와요. 위험은 거의 없고, 실시간으로 볼 수 없어요.', help: '마을 사람들의 일손을 도와요. 시간이 지나면 돌아오고, 실시간으로 볼 수 없어요.', boss: '강력한 한 마리와 맞서요. 한 번 맞으면 크게 아파요.', sweep: '수가 많은 적을 한꺼번에 상대해요. 체력이 깎이기 쉬워요.', wave: '몇 차례에 걸쳐 새 무리가 몰려와요.' };
  const STATE_CHIP = { running: '의뢰 중', alert: '위기!', recover: '회복중', training: '훈련 중' };
  const order = { alert: 0, idle: 1, running: 2, training: 3, recover: 1.5 };

  /* ---------- 상태 조회 ---------- */
  function statusOf(c) {
    if (c.status !== 'ACTIVE') return { state: 'idle' };
    const m = Guild.missionOf(c);
    if (m) return { ...Guild.missionInfo(m), mission: m };
    if (c.training) return { state: 'training', until: c.training.until, minutes: c.training.minutes };
    const hp = Guild.hpFrac(c);
    return hp < 0.999 ? { state: 'recover', hp, until: Guild.recoverAt(c) } : { state: 'idle', hp: 1 };
  }
  const actives = () => Guild.byStatus('ACTIVE');
  const idleHeroes = () => actives().filter((c) => { const st = statusOf(c).state; return st === 'idle' || st === 'recover'; });
  const byId = (id) => Guild.state.characters.find((c) => c.id === id) || null;
  const TAB_OF = { ACTIVE: 'active', LEFT: 'left', DEAD: 'dead' };

  // 위험도는 모의 전투라 계산이 무겁다. 모험가/레벨/의뢰별로 한 번만 계산해 둔다.
  const dangerCache = {};
  function dangerFor(members, q) {
    if (q.tutorial) return { key: 'safe', text: '안전' }; // 튜토리얼 연습 의뢰는 언제나 안전
    const tr = Guild.analysisTrials(); // 자료실이 높을수록 모의 전투를 많이 돌려 더 정확하다
    const k = q.id + '|' + tr + '|' + members.map((c) => c.id + ':' + c.level + ':' + Guild.bondsOf(c.id).length).join(',') + '|' + members.map((c) => (Guild.griefUntil(c) ? 'g' : '')).join('');
    if (!(k in dangerCache)) dangerCache[k] = Combat.dangerLevel(Combat.estimate(Guild.buildMembers(members), q, tr).crisisRate);
    return dangerCache[k];
  }
  const wk = (k) => (k && Guild.knowledge(k.monster) >= 2 ? k.weak : null);           // 약점은 도감 지식 2단계부터
  const monLabel = (k) => (Guild.knowledge(k.monster) >= 1 ? k.monster : '정체불명');
  const GRADE_ORDER = Combat.GRADES;
  const sortBoard = () => Guild.board.slice().sort((a, b) => (GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade)) || a.level - b.level || a.expiresAt - b.expiresAt);
  const clsOf = (c) => c.path[c.path.length - 1];
  const engOf = (c) => Character.toEngine(c);
  const canHeal = (c) => Engine.collectMods(engOf(c)).actives.some((s) => s.act && /^heal/.test(s.act.t));
  const attrText = (c) => c.mainAttribute + (c.subAttribute ? '/' + c.subAttribute : '');
  // 추천 편성: 약점 속성·레벨이 좋은 사람 중에서, 치유 담당을 한 명 넣고 직업이 겹치지 않게 고른다
  function recommendParty(k, free) {
    if (Combat.isWait(k)) return free.slice().sort((a, b) => a.level - b.level).slice(0, Math.max(k.min, Math.min(k.max, k.size || 1))).map((c) => c.id); // 채집·도움은 위험이 없으니 레벨이 낮은 모험가를 보낸다
    const size = Math.min(k.max, Math.max(k.min, k.size));
    const score = (c) => c.level + (wk(k) && (c.mainAttribute === wk(k) || c.subAttribute === wk(k)) ? 6 : 0);
    const pool = free.slice().sort((a, b) => score(b) - score(a));
    const pick = [];
    const healer = pool.find(canHeal);
    if (healer && size >= 3) pick.push(healer);
    for (const c of pool) { if (pick.length >= size) break; if (!pick.includes(c) && !pick.some((p) => p.path[0] === c.path[0])) pick.push(c); }
    for (const c of pool) { if (pick.length >= size) break; if (!pick.includes(c)) pick.push(c); }
    // 등급이 모자라 수주할 수 없으면 가장 높은 등급 모험가를 하나 끼워 넣는다
    if (pick.length && Guild.takeBlock(pick, k)) {
      const top = free.slice().sort((x, y) => Guild.rankOf(y) - Guild.rankOf(x))[0];
      if (top && !pick.includes(top)) { pick[pick.length - 1] = top; }
    }
    return pick.map((c) => c.id);
  }
  const dangerChip = (d) => `<span class="chip d-${d.key}">${d.text}</span>`;

  /* ---------- 공통 조각 ---------- */
  // 진행 현황 칩: 어느 화면에서든 한 번에 전투·위기·결과로 간다 (전투 화면 자체에서는 숨긴다)
  function stripHtml() {
    if (U.screen === 'battle' && Guild.fights.length) return '';
    const al = Guild.missions.filter((m) => Guild.missionInfo(m).state === 'alert');
    const run = Guild.missions.length - al.length;
    const chips = [];
    if (al.length) chips.push(`<button class="schip alert" data-act="view-battle" data-id="${al[0].id}">${icon('alert')}<b>위기 ${al.length}</b><span class="eta" data-eta="${Guild.missionInfo(al[0]).deadline}">${clock(Guild.missionInfo(al[0]).deadline - Guild.now())}</span></button>`);
    if (run) chips.push(`<button class="schip" data-act="goto" data-screen="active">${icon('sword')}<b>원정 중 ${run}</b></button>`);
    if (mailCount()) chips.push(`<button class="schip mail" data-act="goto" data-screen="results">${icon('mail')}<b>결과 ${mailCount()}</b></button>`);
    return chips.length ? `<div class="strip">${chips.join('')}</div>` : '';
  }
  /* ---------- 내비게이션: 위쪽 헤더(숫자 키) + 하위 줄(Space → 숫자 키, Esc로 나오기) ----------
     헤더 1~6: 홈 · 의뢰 · 모험가 · 영입 · 상점 · 길드. 헤더를 고르면 첫 화면으로 가고, 그 아래에 하위 항목 줄이 열린다.
     Space를 누르면 하위 항목 선택 모드가 되어 숫자 키로 하위 항목을 고르고, Esc로 헤더 선택으로 돌아온다. */
  const CATS = [
    { id: 'hub', label: '본부', icon: 'home', subs: [['hub', '길드 홀']] },
    { id: 'quests', label: '원정', icon: 'scroll', subs: [['quests', '의뢰판'], ['active', '원정 현황'], ['results', '귀환 보고']] },
    { id: 'roster', label: '동료', icon: 'people', subs: [['roster', '길드원'], ['dojo', '수련장']] },
    { id: 'recruit', label: '주점', icon: 'plus', subs: [['recruit', '선술집']] },
    { id: 'shop', label: '장터', icon: 'gear', subs: [['shop', '가판대'], ['workshop', '대장간'], ['warehouse', '보급고']] },
    { id: 'guild', label: '길드', icon: 'book', subs: [['guild', '건설'], ['achv', '공적'], ['memorial', '기념비'], ['chronicle', '연대기'], ['codex', '도감']] },
  ];
  const NAV = { battle: ['quests', 'active'] };
  CATS.forEach((c) => c.subs.forEach(([s]) => { NAV[s] = [c.id, s]; }));
  const curCat = () => CATS.find((c) => c.id === (NAV[U.screen] || ['hub'])[0]) || CATS[0];
  const alertCount = () => Guild.missions.filter((m) => Guild.missionInfo(m).state === 'alert').length;
  const advanceCount = () => actives().filter((c) => Character.needsAdvance(c)).length;
  const subCount = (id) => (id === 'active' ? Guild.missions.length : id === 'results' ? mailCount() : id === 'warehouse' ? Guild.state.matQueue.length : id === 'recruit' ? Guild.applicants.length : 0);
  function badgeOf(tab) {
    if (tab === 'quests') { const a = alertCount(); return a ? { n: a, red: true } : { n: mailCount() }; }
    if (tab === 'roster') return { n: advanceCount() };
    if (tab === 'recruit') return { n: Guild.applicants.length };
    if (tab === 'shop') return { n: Guild.state.matQueue.length };
    if (tab === 'guild') return { n: promoReady() ? 1 : 0 };
    return { n: 0 };
  }
  // 튜토리얼: 모바일에서 목표 화면까지 가는 길(탭 → 하위 메뉴)을 이어서 하이라이트
  const navPath = (screen) => {
    if (U.screen === screen) return [];
    const cat = (NAV[screen] || ['hub'])[0], c = CATS.find((x) => x.id === cat);
    if (!c) return [];
    if (curCat().id !== cat) return [`.tb-tabs [data-screen="${c.subs[0][0]}"]`];
    return [`.tb-sub [data-screen="${screen}"]`];
  };
  function tabbarHtml() {
    const cur = curCat().id;
    return CATS.map((c, n) => {
      const b = badgeOf(c.id);
      return `<button class="tab${cur === c.id ? ' sel' : ''}" data-act="goto" data-screen="${c.subs[0][0]}" title="${c.label} (${n + 1})">${icon(c.icon)}<span>${c.label}</span><kbd>${n + 1}</kbd>${b.n ? `<i class="dot${b.red ? ' red' : ''}">${b.n}</i>` : ''}</button>`;
    }).join('');
  }
  function topIcons() {
    return `<div class="top-icons"><button class="ibtn" data-act="menu-modal" data-m="help" title="도움말 (H)">${icon('help')}</button><button class="ibtn" data-act="menu-save" title="저장 (S)">${icon('save')}</button><button class="ibtn" data-act="menu-modal" data-m="settings" title="설정">${icon('gear')}</button></div>`;
  }
  function topbarHtml() {
    const res = `<div class="tb-res"><span title="금화" class="tb-gold">${icon('coin')}<b>${Guild.state.gold.toLocaleString()}</b></span><span title="현역 모험가 / 정원">${icon('people')}<b>${actives().length}</b> / ${Guild.rosterCap()}</span></div>`;
    return `<div class="tb-row"><div class="tb-name" title="${esc(Guild.state.guildName)}">${esc(Guild.state.guildName)}<small>${Guild.guildGrade()}급</small></div><div class="tb-tabs">${tabbarHtml()}</div><div class="tb-gap"></div>${stripHtml()}${res}${topIcons()}</div>${subnavHtml()}`;
  }
  function subnavHtml() {
    const cat = curCat();
    if (cat.subs.length < 2) return '';
    const sub = (NAV[U.screen] || [])[1];
    const km = U.childMode;
    return `<div class="tb-sub${km ? ' keymode' : ''}"><span class="tb-path">${cat.label}</span>${cat.subs.map(([id, label], n) => `<button class="pill" aria-selected="${sub === id}" data-act="goto" data-screen="${id}"><kbd>${n + 1}</kbd>${label}${subCount(id) ? ` <b>${subCount(id)}</b>` : ''}</button>`).join('')}<span class="tb-hint">${km ? '숫자 키로 선택 · <b>Esc</b> 나가기' : '<b>Space</b> 하위 메뉴 선택'}</span></div>`;
  }

  function chead(title) {
    return `<div class="chead"><div class="t">${icon('pin')}${title}<small>${dateText(Guild.now())}</small></div></div>`;
  }
  function dhead(title) {
    return `<div class="dhead"><h2>${title}</h2></div><div class="rule-g"></div>`;
  }
  const av = (c) => `<span class="av">${Art.character(c.appearance, { view: 'bust', label: c.name })}</span>`;

  // 모험가 증서 (우측 열)
  function license(c) {
    if (!c) {
      return `<section class="license"><div class="lic-head">${esc(Guild.state.guildName)}</div><div class="lic-frame empty">?</div>
        <div class="lic-name">미정</div><div class="lic-meta muted">모험가를 골라 주세요</div><div class="lic-title">Adventurers' License</div></section>`;
    }
    return `<section class="license"><div class="lic-head">${esc(Guild.state.guildName)}</div>
      <div class="lic-frame">${Art.character(c.appearance, { view: 'bust', label: c.name })}</div>
      <div class="lic-name">✦ ${c.name} ✦</div>
      <div class="lic-meta"><span class="g-${c.grade}">${c.grade}</span> · ${Guild.rankLabel(c)}급 · Lv.${c.level}</div>
      <div class="lic-foot">No. ${fmt(c.appearanceId)}</div><div class="lic-title">Adventurers' License</div></section>`;
  }
  const chk = (text, done) => `<div class="chk${done ? ' done' : ''}">${icon('diamond')}<span>${text}</span></div>`;

  // 말풍선 (모험가 상태에 따라 한마디)
  function bubbleLines(c, s) {
    if (c.status === 'LEFT') return [['light', '…길드에 돌아가도 될까요?'], ['dark', '다시 불러 주시면 힘이 될게요.']];
    if (c.status === 'DEAD') return [];
    if (s.state === 'alert') return [['light', '큰일 났어요! 결정을 내려 주세요!'], ['dark', '후퇴할지, 계속 싸울지…']];
    if (s.state === 'running') return [['light', `지금은 「${s.quest.name}」 중이에요.`]];
    if (s.state === 'training') return [['light', '지금 열심히 훈련 중이에요!'], ['dark', '조금만 더 강해져서 돌아올게요.']];
    if (s.state === 'recover') return [['light', `아직 몸이 다 낫지 않았어요. (체력 ${Math.round(s.hp * 100)}%)`], ['dark', '지금 나가면 위험할지도 몰라요…']];
    const t = c.traits[0];
    return [['light', '의뢰가 있으면 말씀해 주세요.'], ['dark', t ? `다들 저더러 「${t}」 사람이라고 해요.` : '준비는 언제든 되어 있어요.']];
  }
  const bubblesHtml = (ls) => (ls.length ? `<div class="bubbles">${ls.map(([k, t]) => `<div class="bub ${k}">${esc(t)}</div>`).join('')}</div>` : '');
  const sceneHtml = (c, extra) => `<div class="scene">${Art.hall()}${c ? `<div class="stand sticker${c.status === 'DEAD' ? ' dead-look' : ''}">${Art.character(c.appearance, { label: c.name })}</div>` : ''}${extra || ''}</div>`;

  /* ============================================================
     1) 홈 (길드 홀)
     ============================================================ */
  function hubHtml() {
    const act = actives().map((c) => ({ c, s: statusOf(c) })).sort((a, b) => order[a.s.state] - order[b.s.state]);
    const n = act.length;
    const lob = Guild.lobby();
    const actors = lob.slice().sort((p, q) => p.y - q.y).map((p) => {
      const c = byId(p.id), sc = (0.82 + 0.2 * (p.y - 66) / 28).toFixed(2);
      return `<button class="actor" style="left:${p.x}%;top:${p.y}%;z-index:${Math.round(p.y / 5)};transform:translate(-50%,-100%) scale(${sc});transform-origin:50% 100%" data-act="open-talk" data-id="${c.id}" aria-label="${c.name}에게 말 걸기">
        <span class="sbub">${icon('chat')}</span><span class="bobw">${Art.character(c.appearance, { label: c.name })}</span><span class="nameplate">${c.name} Lv.${c.level}</span></button>`;
    }).join('');

    const names = (m) => m.memberIds.map((id) => (byId(id) || {}).name).join(', ');
    const rows = Guild.missions.map((m) => ({ m, s: Guild.missionInfo(m) }))
      .sort((x, y) => (x.s.state === 'alert' ? 0 : 1) - (y.s.state === 'alert' ? 0 : 1)).map(({ m, s: i }) => {
        if (i.state === 'alert') {
          return `<button class="qrow alert" data-act="view-battle" data-id="${m.id}">${icon('alert')}<span><b>위기 신호!</b> 「${i.quest.name}」<br>${names(m)} · 결정 제한 <span class="eta" data-eta="${i.deadline}">${clock(i.deadline - Guild.now())}</span></span></button>`;
        }
        if (m.wait) return `<div class="qrow">${icon('book')}<span><b>「${i.quest.name}」</b> · ${names(m)}<br>${Combat.TYPE_TEXT[i.quest.type]} 중 · 남은 시간 <span class="eta" data-eta="${i.endsAt}">${clock(i.endsAt - Guild.now())}</span></span></div>`;
        return `<button class="qrow" data-act="view-battle" data-id="${m.id}">${icon('sword')}<span><b>「${i.quest.name}」</b> · ${names(m)}<br>전투 중 <b data-bclock="${m.id}">${mmss(i.clock)}</b></span></button>`;
      });
    act.filter((x) => x.s.state === 'training').forEach(({ c, s: i }) => {
      rows.push(`<button class="qrow" data-act="open-char" data-id="${c.id}">${icon(i.state === 'training' ? 'book' : 'bandage')}<span><b>${c.name}</b> ${i.state === 'training' ? '훈련 중' : '부상 회복 중'}<br>남은 시간 <span class="eta" data-eta="${i.until}">${clock(i.until - Guild.now())}</span></span></button>`);
    });
    if (promoReady()) rows.unshift(`<button class="qrow" data-act="goto" data-screen="guild">${icon('star')}<span><b>길드 승급 가능!</b><br>위쪽 <b>길드</b>(6)에서 승급해요</span></button>`);
    if (mailCount()) rows.unshift(`<button class="qrow" data-act="goto" data-screen="results">${icon('mail')}<span><b>새 의뢰 결과 ${mailCount()}건</b><br>눌러서 확인해요</span></button>`);
    act.filter((x) => Character.needsAdvance(x.c)).forEach(({ c }) => {
      rows.push(`<button class="qrow" data-act="open-char" data-id="${c.id}">${icon('star')}<span><b>${c.name}</b> 전직할 수 있어요<br>명부에서 직업을 골라 주세요</span></button>`);
    });
    if (rows.length > 5) { const extra = rows.length - 5; rows.length = 5; rows.push(`<div class="qnone">…외 ${extra}건</div>`); }

    return `<div class="hub">${Art.hall()}
      <div class="hub-title"><h1>${icon('pin')}길드 홀</h1><small>${esc(Guild.state.guildName)} · ${Guild.guildGrade()}급 · 명성 ${Guild.state.fame}${Guild.promoNeed() ? ' / ' + Guild.promoNeed().fame : ''}</small></div>
      <div class="hubq"><h2>길드 소식</h2>${rows.length ? rows.join('') : '<div class="qnone">진행 중인 일이 없어요.<br>위쪽 <b>원정</b> 탭에서 파티를 꾸려 보내 보세요.</div>'}</div>
      <div class="actors">${actors}</div>
      ${n === 0 ? '<div class="hub-hint">아직 길드에 모험가가 없어요.<br>위쪽 <b>주점</b>(숫자 키 4)에서 첫 모험가를 맞이해 보세요.</div>' : ''}
      ${n > 0 && !lob.length ? '<div class="hub-hint" style="top:40%">지금은 모두 의뢰나 훈련 중이라 로비가 비어 있어요.</div>' : ''}
      <div class="lobby-note">로비 ${lob.length}명 · ${isMobile ? '' : '12시간마다(00:00 · 12:00 PST) 의뢰 중이 아닌 모험가 10명이 나와요 · '}다음 교체 <span class="eta" data-eta="${Guild.lobbyNextAt()}">${clock(Guild.lobbyNextAt() - Guild.now())}</span></div>
    </div>`;
  }

  /* ============================================================
     2) 모험가 명부
     ============================================================ */
  function rosterHtml() {
    const lists = { active: Guild.byStatus('ACTIVE'), left: Guild.byStatus('LEFT'), dead: Guild.byStatus('DEAD') };
    let shown = lists[U.tab].slice().reverse(); // 최근 합류한 순서
    if (U.rosterRank !== undefined && U.rosterRank !== '') shown = shown.filter((x) => Guild.rankOf(x) === Number(U.rosterRank));
    if (U.rosterClass) shown = shown.filter((x) => x.path[0] === U.rosterClass);
    if (U.rosterState && U.tab === 'active') shown = shown.filter((x) => statusOf(x).state === U.rosterState);
    if (U.rosterSort === 'level') shown.sort((a, b) => b.level - a.level);
    else if (U.rosterSort === 'rank') shown.sort((a, b) => Guild.rankOf(b) - Guild.rankOf(a) || (b.rankPts || 0) - (a.rankPts || 0));
    else if (U.rosterSort === 'grade') shown.sort((a, b) => Character.GRADES.indexOf(b.grade) - Character.GRADES.indexOf(a.grade) || b.level - a.level);
    else if (U.rosterSort === 'state') shown.sort((a, b) => order[statusOf(a).state] - order[statusOf(b).state]);
    const c = shown.find((x) => x.id === U.selId) || shown[0] || null;
    U.selId = c ? c.id : null;
    const s = c ? statusOf(c) : { state: 'idle' };
    const cntRank = (r) => lists[U.tab].filter((x) => Guild.rankOf(x) === r).length;

    // 왼쪽: 목록 (작은 얼굴 + 한 줄 정보)
    const rows = shown.length ? shown.map((x) => {
      const xs = statusOf(x);
      return `<button class="rrow${x.id === U.selId ? ' sel' : ''}" data-act="sel" data-id="${x.id}">${av(x)}<span class="rn">${esc(x.name)}</span><span class="rg g-${x.grade}">${x.grade}</span><span class="rk">${Guild.rankLabel(x)}급</span><span class="rl">Lv.${x.level}</span><span class="rc">${esc(clsOf(x))}</span>
        <span class="rs">${x.status === 'ACTIVE' && Character.needsAdvance(x) ? '<span class="chip skill">전직</span>' : ''}${STATE_CHIP[xs.state] ? `<span class="chip ${xs.state}">${STATE_CHIP[xs.state]}</span>` : ''}</span></button>`;
    }).join('') : `<p class="empty">${lists[U.tab].length ? '조건에 맞는 모험가가 없어요.' : U.tab === 'active' ? '현역 모험가가 없어요.<br>위쪽 영입에서 맞이해 보세요.' : U.tab === 'left' ? '길드를 떠난 모험가가 없어요.' : '아직 사망자가 없어요.'}</p>`;
    const tab = (k, label) => `<button class="pill" role="tab" aria-selected="${U.tab === k}" data-act="tab" data-tab="${k}">${label} ${lists[k].length}</button>`;
    const sp = (k, l) => `<button class="pill" aria-selected="${U.rosterSort === k}" data-act="roster-sort" data-k="${k}">${l}</button>`;
    const roots = Character.ROOTS.map((r) => `<option value="${esc(r)}"${U.rosterClass === r ? ' selected' : ''}>${esc(r)}</option>`).join('');
    const left = `<section class="ros-list"><div class="ros-h">길드원 명부</div><div class="pills" role="tablist">${tab('active', '현역')}${tab('left', '이탈')}${tab('dead', '사망')}</div>
      <div class="pills sortrow">${sp('recent', '최근')}${sp('level', '레벨')}${sp('rank', '등급순')}${sp('grade', '희귀도')}<select data-act="roster-rank" aria-label="등급 거르기"><option value="">전체 등급</option>${Guild.RANKS.map((l, i) => `<option value="${i}"${String(U.rosterRank ?? '') === String(i) ? ' selected' : ''}>${l}급 (${cntRank(i)})</option>`).join('')}</select><select data-act="roster-state" aria-label="상태 거르기"><option value="">전체 상태</option>${[['idle', '대기'], ['recover', '회복중'], ['running', '의뢰 중'], ['alert', '위기!'], ['training', '훈련 중']].map(([k, l]) => `<option value="${k}"${U.rosterState === k ? ' selected' : ''}>${l}</option>`).join('')}</select><select data-act="roster-class" aria-label="직업 거르기"><option value="">전체 직업</option>${roots}</select></div>
      <div class="rlist" data-keep="roster-list">${rows}</div></section>`;

    // 오른쪽: 구조화된 상세
    let right = '<section class="ros-detail"><p class="empty">모험가를 골라 주세요.</p></section>';
    if (c) {
      const pts = Engine.statPoints(Character.toEngine(c), Engine.collectMods(Character.toEngine(c)).mods);
      const mx = Math.max(...pts) * 1.08 || 1;
      const sk = skillName(c), rp = Guild.rankProgress(c);
      const kv = (k, v, t) => `<div class="kv1"><span class="k">${k}</span><span class="v" title="${esc(t || String(v).replace(/<[^>]+>/g, ''))}">${v}</span></div>`;
      const statRows = Engine.STATS.map((n, i) => `<div class="st"><span>${n}</span><b>${Math.round(pts[i])}</b><i class="sbar"><i style="width:${Math.round((pts[i] / mx) * 100)}%"></i></i></div>`).join('');
      const efl = Combat.effectLines(c);
      const fxTrait = efl.filter((e) => e.trait).map((e) => `<div class="fx"><b>${esc(e.name)}</b><span title="${esc(e.text)}">${esc(e.text)}</span></div>`).join('') || '<div class="muted small">특성이 없어요.</div>';
      const fxSkill = efl.filter((e) => !e.trait).map((e) => `<div class="fx fxs">${skillIco(e.skill ? e.id : null)}<b>${e.skill ? '★ ' : ''}${esc(e.name)}</b><span title="${esc(e.text)}">${esc(e.text)}</span></div>`).join('') || '<div class="muted small">스킬이 없어요.</div>';
      const gear = Gear.SLOTS.map(([sl, l]) => { const it = c.equip && c.equip[sl]; return `<div class="fx geq">${it ? gIcon(it) : `<span class="gicon empty"><i>${l[0]}</i></span>`}<b>${l}</b><span class="${it ? 'q q' + it.q : 'muted'}">${it ? esc(Gear.itemName(it)) + ' · ' + statText(it) : '없음'}</span></div>`; }).join('');
      const bonds = Guild.bondsOf(c.id).slice(0, 4).map((b) => `<div class="fx"><b>${b.other.status === 'DEAD' ? '† ' : ''}${esc(b.other.name)}</b><span>${b.name} <span class="bar"><i style="width:${b.value}%"></i></span></span></div>`).join('') || '<div class="muted small">아직 가까운 동료가 없어요.</div>';
      const stateTxt = c.status === 'DEAD' ? `사망 · ${dateText(c.diedAt)}` : c.status === 'LEFT' ? `이탈 · ${dateText(c.leftAt)}` : s.state === 'training' ? `훈련 중 <span class="eta" data-eta="${s.until}">${clock(s.until - Guild.now())}</span>` : s.state === 'recover' ? `회복중 · 체력 ${Math.round(s.hp * 100)}% <span class="eta" data-eta="${s.until}">${clock(s.until - Guild.now())}</span>` : s.mission ? (s.mission.wait ? `${Combat.TYPE_TEXT[s.quest.type]} 중 <span class="eta" data-eta="${s.endsAt}">${clock(s.endsAt - Guild.now())}</span>` : '의뢰 전투 중') : '대기 중';
      const acts = [];
      if (c.status === 'LEFT') acts.push(`<button class="btn" data-act="return-char" data-id="${c.id}"${Guild.state.gold >= Guild.returnCost() ? '' : ' disabled'}>복귀 (금화 ${Guild.returnCost()})</button>`);
      if (c.status === 'ACTIVE' && Character.needsAdvance(c)) acts.push(`<button class="btn" data-act="open-advance" data-id="${c.id}">전직하기</button>`);
      if (c.status === 'ACTIVE' && s.state === 'training') acts.push(`<button class="btn ghost" data-act="cancel-train" data-id="${c.id}">훈련 취소</button>`);
      if (c.status === 'ACTIVE' && s.mission && !s.mission.wait) acts.push(`<button class="btn ghost" data-act="view-battle" data-id="${s.mission.id}">전투 보기</button>`);
      if (c.status === 'ACTIVE') acts.push(`<button class="btn ghost" data-act="reset-char" data-id="${c.id}"${Guild.resetTickets() > 0 && s.state === 'idle' ? '' : ' disabled'}>초기화 (${Guild.resetTickets()}장)</button>`);
      right = `<section class="ros-detail">
        <div class="rd-head">${Art.character(c.appearance, { view: 'bust', label: c.name })}<div class="rd-title"><h2>${esc(c.name)}</h2>
          <div class="rd-chips"><span class="chip g-${c.grade}">희귀도 ${c.grade}</span><span class="chip">${Guild.rankLabel(c)}급 모험가</span>${sk ? `<span class="chip skill">★ ${esc(sk)}</span>` : ''}<span class="chip ${s.state}">${stateTxt}</span></div></div>
          <div class="rd-acts">${acts.join('')}</div></div>
        <div class="rd-grid">
          <div class="rd-box"><h3>기본 정보</h3>
            ${kv('레벨', `Lv.${c.level} <small>${expText(c)}</small>`)}${kv('종족', esc(Appearance.raceName(c.appearance)))}${kv('직업', c.path.map(esc).join(' › '))}${kv('속성', attrText(c))}
            ${kv('등급 점수', rp.next ? `${rp.pts - rp.cur} / ${rp.next - rp.cur}` : '최고 등급')}${kv('처치 · 의뢰', `${c.kills || 0}마리 · ${c.quests || 0}건`)}${kv('합류', dateText(c.recruitedAt))}${kv('지갑', `${c.wallet || 0}금`)}
            ${Guild.griefUntil(c) ? kv('슬픔', `공격·방어 -8% <span class="eta" data-eta="${Guild.griefUntil(c)}">${clock(Guild.griefUntil(c) - Guild.now())}</span>`) : ''}${U.showTalent ? kv('재능(개발)', c.talent) : ''}</div>
          <div class="rd-box"><h3>능력치</h3><div class="stgrid">${statRows}</div></div>
          <div class="rd-box"><h3>특성</h3>${fxTrait}</div>
          <div class="rd-box"><h3>스킬</h3>${fxSkill}</div>
          <div class="rd-box"><h3>장비</h3>${gear}</div>
          <div class="rd-box"><h3>관계</h3>${bonds}</div>
          ${c.status === 'DEAD' ? `<div class="rd-box wide"><h3>마지막 기록</h3><div class="fx"><b>사인</b><span title="${esc(c.deathCause || '')}">${esc(c.deathCause || '')}</span></div></div>` : ''}
        </div></section>`;
    }
    if (isMobile) {
      const pg = U.rPage || 0, st = c && U.rStep === 'detail' ? 'm-detail' : 'm-list';
      const tabs = ['정보', '특성·스킬', '장비·관계'].map((l, i) => `<button class="pill" aria-selected="${pg === i}" data-act="r-page" data-p="${i}">${l}</button>`).join('');
      right = right.replace('<div class="rd-grid">', `<div class="rd-pages"><button class="pill" data-act="r-back">‹ 목록</button>${tabs}</div><div class="rd-grid pg${pg}">`);
    }
    return `<div class="ros${isMobile ? ' ' + (c && U.rStep === 'detail' ? 'm-detail' : 'm-list') : ''}">${left}${right}</div>`;
  }
  function bondRows(c) {
    const bs = Guild.bondsOf(c.id).slice(0, 4);
    if (!bs.length) return '<p class="small">아직 가까운 동료가 없어요.<br>함께 의뢰를 해내면 가까워져요.</p>';
    return bs.map((b) => `<div class="kv"><span>${b.other.status === 'DEAD' ? '† ' : ''}${esc(b.other.name)}</span><span>${b.name} <span class="bar"><i style="width:${b.value}%"></i></span></span></div>`).join('');
  }
  const expText = (c) => (c.level >= Character.MAX_LEVEL ? '최고 레벨' : Character.needsAdvance(c) ? '전직 필요' : `${c.exp || 0} / ${Character.expNeeded(c.level)}`);

  /* ============================================================
     3) 의뢰 게시판 + 파티 편성
     ============================================================ */
  const sizeText = (k) => (k.min === k.max ? `${k.min}명` : `${k.min}~${k.max}명`);
  const leftText = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };

  // 긴 의뢰 이름은 한 줄에 들어가도록 제목과 장소로 나눈다 ("민들레 뿌리 채집 (마른 계곡)", "솔숲 마을 · 홍수 대비…")
  function splitName(x) {
    let m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(x.name);
    if (m) return { title: m[1], place: m[2] };
    m = /^(.*?)\s·\s(.*)$/.exec(x.name);
    if (m) return { title: m[2], place: m[1] };
    return { title: x.name, place: '' };
  }
  const fameText = (x, long) => {
    const f = Guild.fameInfo(x);
    if (f.wait) return `명성 <b class="up">+${f.win}</b>`;
    return long ? `명성 <b class="up">클리어 +${f.win}</b> · <b class="dn">사망 1명당 −${f.death}</b> · <b class="dn">전멸 −${f.wipe}</b> · 후퇴 ±0` : `명성 <b class="up">+${f.win}</b> <b class="dn">사망 −${f.death}</b> <b class="dn">전멸 −${f.wipe}</b>`;
  };
  const kindChip = (x) => (x.kind === 'special' ? ' <span class="chip hot">한정</span>' : '');
  function partyBonds(party) {
    const rows = [];
    for (let i = 0; i < party.length; i++) for (let j = i + 1; j < party.length; j++) {
      const b = Guild.bondInfo(party[i].id, party[j].id);
      if (b.idx >= 1) rows.push(`<div class="kv"><span>${esc(party[i].name)} · ${esc(party[j].name)}</span><span>${b.name} +${Math.round(b.pct * 100)}%</span></div>`);
    }
    const grief = party.filter((c) => Guild.griefUntil(c)).map((c) => esc(c.name));
    return (rows.length ? `<h3 style="margin-top:8px">유대</h3>${rows.join('')}` : '') + (grief.length ? `<p class="small" style="color:var(--red)">${grief.join(', ')}: 슬픔에 잠겨 있어요 (공격·방어 -8%)</p>` : '');
  }

  function questsHtml() {
    const board = sortBoard();
    let k = board.find((x) => x.id === U.contract) || board[0] || null;
    U.contract = k ? k.id : null;
    const free = idleHeroes();
    U.party = U.party.filter((id) => free.some((h) => h.id === id)); // 더는 보낼 수 없는 사람은 뺀다
    if (k && U.party.length > k.max) U.party.length = k.max;
    const party = U.party.map(byId);
    const block = k && party.length ? Guild.takeBlock(party, k) : null;
    const ok = k && party.length >= k.min && party.length <= k.max && !block;
    const d = k && party.length && !Combat.isWait(k) ? dangerFor(party, k) : null;
    const weakOf = (c) => k && wk(k) && (c.mainAttribute === wk(k) || c.subAttribute === wk(k));
    const weakHit = party.some(weakOf);
    const avgLv = party.length ? Math.round(party.reduce((a, c) => a + c.level, 0) / party.length * 10) / 10 : 0;

    // 위쪽: 코르크 게시판. 의뢰서는 정해진 칸에 꽂히고, 사라지면 그 칸만 비었다가 새 의뢰가 들어온다.
    const cap = Guild.boardMax(), now = Date.now();
    const slotOf = U.slotOf || (U.slotOf = {}), ghosts = U.ghosts || (U.ghosts = {}), seen = U.noteSeen || (U.noteSeen = {}), cache = U.noteCache || (U.noteCache = {});
    if (U.slotScreenFresh) { for (const id in seen) delete seen[id]; U.slotScreenFresh = false; }
    const onBoard = new Set(board.map((x) => x.id));
    for (const id of Object.keys(slotOf)) if (!onBoard.has(id)) { if (cache[id]) ghosts[slotOf[id]] = { html: cache[id], until: now + 650 }; delete slotOf[id]; delete cache[id]; delete seen[id]; setTimeout(render, 700); }
    const taken = new Set(Object.values(slotOf));
    board.forEach((x) => {
      if (slotOf[x.id] != null) return;
      const freeSlots = []; for (let s = 0; s < cap; s++) if (!taken.has(s)) freeSlots.push(s);
      let s = freeSlots.length ? freeSlots[Math.floor(Math.random() * freeSlots.length)] : cap; while (taken.has(s)) s++;
      slotOf[x.id] = s; taken.add(s);
    });
    const bySlot = {}; board.forEach((x, i) => { bySlot[slotOf[x.id]] = x; });
    const total = Math.max(cap, ...Object.values(slotOf).map((s) => s + 1));
    let fresh = 0;
    const cells = Array.from({ length: total }, (_, s) => {
      const x = bySlot[s];
      if (!x) {
        const gh = ghosts[s];
        if (gh && gh.until > now) return `<div class="qcell"><div class="qleave">${gh.html}</div></div>`;
        return `<div class="qcell"><div class="qempty"><i class="pin hole"></i><span>빈 자리</span></div></div>`;
      }
      const dx = party.length && !Combat.isWait(x) && party.length >= x.min && party.length <= x.max ? dangerChip(dangerFor(party, x)) : '';
      const rot = (((s * 37 + 11) % 9) - 4) * 0.55, wait = Combat.isWait(x);
      const reward = x.type === 'gather' ? `재료 ${esc(x.item)} ${x.qty}개` : `금화 ${x.gold}`;
      const what = `${Combat.TYPE_TEXT[x.type]}${wait ? ' · ' + x.minutes + '분' : x.type === 'wave' ? ' · ' + x.total + '마리' : ''}`;
      const sel = k && x.id === k.id, sn = splitName(x);
      const isNew = !seen[x.id]; seen[x.id] = 1;
      const selNew = sel && U.selNoteShown !== x.id; if (sel) U.selNoteShown = x.id;
      const html = `<div role="button" tabindex="0" class="qnote n-${x.type}${sel ? ' sel' : ''}${selNew && !isNew ? ' selnew' : ''}${isNew ? ' drop' : ''}" style="--rot:${sel ? 0 : rot}deg;--dl:${isNew ? fresh++ * 70 : 0}ms" data-act="quest-sel" data-id="${x.id}" title="${esc(x.name)}">
        <i class="pin"></i>
        <span class="qhead"><span class="qgrade g-${x.grade}">${x.grade}</span><b class="qname">${esc(sn.title)}</b>${kindChip(x)}</span>
        <span class="qbody"><span class="qart">${Art.monster(x.art, '', x.hue)}</span><span class="qinfo">
          <span class="qmeta">${sn.place ? esc(sn.place) + ' · ' : ''}${what} · ${sizeText(x)}</span>
          <span class="qmeta rw">${reward} · 경험 ${x.exp}</span>${wk(x) ? `<span class="qmeta">약점 ${wk(x)}</span>` : ''}</span></span>
        <span class="qfame">${fameText(x)}</span>
        <span class="qfoot">${x.relics && x.relics.length ? '<span class="chip skill">유품 ' + x.relics.length + '</span>' : x.fails ? '<span class="chip">재도전</span>' : ''}${dx}<span class="due">마감 <span data-eta-left="${x.expiresAt}">${leftText(x.expiresAt - Guild.now())}</span></span></span></div>`;
      cache[x.id] = html.replace(' drop', '').replace(' selnew', '').replace(/ sel/, '');
      return `<div class="qcell">${html}</div>`;
    }).join('');
    const cork = `<section class="cork"><div class="cork-head"><h2>의뢰판</h2><span>걸린 의뢰 ${board.length} / ${cap}장 · 의뢰서를 눌러 골라요</span></div><div class="cork-grid" data-keep="quest-list">${cells}</div></section>`;

    // 가운데: 의뢰 요약 + 파티 무대
    const slots = k ? k.max : 3;
    const stands = Array.from({ length: slots }, (_, i) => {
      const c = party[i];
      const fresh = c && !(U.prevParty || []).includes(c.id);
      return c
        ? `<button class="pslot${fresh ? ' pop' : ''}" data-act="party-toggle" data-id="${c.id}" aria-label="${c.name} 빼기"><span class="pic">${Art.character(c.appearance, { view: 'bust', label: c.name })}</span><span class="nameplate">${esc(c.name)} Lv.${c.level}</span></button>`
        : `<div class="pslot empty"><span class="pic"><span class="ghost">+</span></span><span class="nameplate dim">${k && i < k.min ? '필요' : '선택'}</span></div>`;
    }).join('');
    const info = k ? `<div class="pinfo">${Combat.isWait(k) ? `<span class="chip">${Combat.TYPE_TEXT[k.type]} · ${k.type === 'gather' ? esc(k.item) + ' ' + (party.length ? Guild.gatherQty(k, party) : k.qty) + '개 예상 (운이 높은 사람이 많을수록 늘어요)' : esc(k.place)}</span><span class="chip">소요 ${Guild.waitMinutes(k, Math.max(1, party.length))}분${k.type === 'help' ? ' (사람이 많을수록 빨라져요)' : ''} · 실시간 확인 없음</span>` : `<span class="chip">${Combat.TYPE_TEXT[k.type]} · ${monLabel(k)} ${k.total}마리</span><span class="chip">${sizeText(k)}</span><span class="chip">전투 시간 미정</span>${wk(k) ? `<span class="chip skill">약점 ${wk(k)}</span>` : '<span class="chip">약점 불명</span>'}`}${k.relics && k.relics.length ? `<span class="chip skill">유품 ${k.relics.length}</span>` : ''}${d ? dangerChip(d) : ''}</div>` : '';
    const scene = `<div class="scene party q plain">${info}<div class="pslots">${stands}</div></div>`;
    const why = !k ? '의뢰를 골라 주세요' : party.length < k.min ? `${k.min}명 이상 골라 주세요` : block ? '등급이 모자라요' : '';
    const center = `<section class="cpanel">${chead('원정대 편성')}${scene}<div class="actbar" style="grid-template-columns:1.6fr 1fr 1fr">
      <button class="act primary" data-act="dispatch"${ok ? '' : ' disabled'}>${why || '출정!'} ${icon('check')}</button>
      <button class="act" data-act="recommend"${k && free.length ? '' : ' disabled'}>자동 편성 ${icon('star')}</button>
      <button class="act" data-act="clear-party"${party.length ? '' : ' disabled'}>해산 ${icon('cross')}</button></div></section>`;

    // 오른쪽: 출발 점검 + 후보 목록
    const check = `<section class="parch tight qpaper">${k ? `<div class="qp-head"><span class="qgrade g-${k.grade}">${k.grade}</span><b>${k.name}</b></div><p class="small">${Combat.TYPE_TEXT[k.type]} · ${k.type === 'gather' ? '재료 ' + esc(k.item) + ' ' + k.qty + '개 (매입가 약 ' + k.qty * Guild.matUnit(k.item) + '금)' : '금화 ' + k.gold} · 경험 ${k.exp}<br>마감 <span data-eta-left="${k.expiresAt}">${leftText(k.expiresAt - Guild.now())}</span><br>${fameText(k, true)}</p><hr class="rule">` : ''}<h3>출정 준비</h3>
      ${chk(k ? `인원 ${sizeText(k)} (현재 ${party.length}명)` : '인원', k && party.length >= k.min && party.length <= k.max)}${k ? chk(block ? esc(block) : `수주 등급 (${k.grade}급 의뢰)`, !block) : ''}${party.length >= 3 ? chk('회복 스킬 보유', party.some(canHeal)) : ''}${k && wk(k) ? chk(`약점 속성 ${wk(k)}`, weakHit) : ''}${partyBonds(party)}</section>`;
    const score = (c) => c.level + (weakOf(c) ? 6 : 0);
    const cs = U.candSort;
    const sorted = free.slice().sort((a, b) => (cs === 'level' ? b.level - a.level : cs === 'class' ? clsOf(a).localeCompare(clsOf(b), 'ko') || b.level - a.level : score(b) - score(a)));
    const busy = actives().length - free.length;
    const cand = sorted.map((c) => `<button class="item${U.party.includes(c.id) ? ' sel' : ''}" data-act="party-toggle" data-id="${c.id}">${av(c)}<span class="grow"><span class="nm">${esc(c.name)}${weakOf(c) ? ' ★' : ''}</span><br><span class="sub">${Guild.rankLabel(c)}급 · Lv.${c.level} · ${esc(clsOf(c))} · ${attrText(c)}${canHeal(c) ? ' · 회복' : ''}</span></span>${U.party.includes(c.id) ? icon('check') : ''}</button>`).join('')
      || '<p class="empty">보낼 수 있는 모험가가 없어요.</p>';
    const pl = (kk, l) => `<button class="pill" aria-selected="${cs === kk}" data-act="cand-sort" data-k="${kk}">${l}</button>`;
    const right = `<div class="col"><section class="dpanel"><div class="dhead"><h2>대기 모험가 ${free.length}명</h2></div><div class="pills">${pl('rec', '추천순')}${pl('level', '레벨')}${pl('class', '직업')}</div>
      <div class="list" data-keep="cand-list">${cand}</div>${busy > 0 ? `<p class="small muted" style="padding:0 12px 8px">의뢰·훈련 중 ${busy}명</p>` : ''}</section></div>`;

    const qs = isMobile ? (U.qStep === 'party' && k ? 'm-party' : 'm-board') : '';
    return `<div class="pscreen">${Art.hall()}<div class="qb ${qs}">${qs === 'm-party' ? `<button class="m-back" data-act="q-back">‹ 의뢰판으로</button>` : ''}${cork}<div class="qdesk">${check}${center}${right}</div></div></div>`;
  }

  /* ============================================================
     공통: 넓은 목록 화면 (진행 중 / 결과 / 훈련장)
     ============================================================ */
  function wideScreen(title, leftInner, inner, keep) {
    return `<div class="pscreen">${Art.hall()}<div class="cols"><div class="col"><section class="parch fit"><h3>${title}</h3><hr class="rule">${leftInner}</section></div>
      <section class="cpanel wide">${chead(title)}<div class="wlist" data-keep="${keep}">${inner}</div></section></div></div>`;
  }
  const faces = (ids) => ids.map(byId).filter(Boolean).map((c) => `<span class="av">${Art.character(c.appearance, { view: 'bust', label: c.name })}</span>`).join('');

  function activeHtml() {
    const ms = Guild.missions.map((m) => ({ m, i: Guild.missionInfo(m) })).sort((x, y) => (x.i.state === 'alert' ? 0 : 1) - (y.i.state === 'alert' ? 0 : 1));
    const cards = ms.map(({ m, i }) => {
      const k = i.quest, al = i.state === 'alert';
      const nm = m.memberIds.map((id) => (byId(id) || {}).name).join(', ');
      if (m.wait) return `<div class="mrow"><span class="faces">${faces(m.memberIds)}</span><span class="grow"><b><span class="chip qg">${k.grade}</span> ${esc(k.name)}</b><br><span class="sub">${esc(nm)}</span><br><span class="sub">${Combat.TYPE_TEXT[k.type]} 중 · 남은 시간 <span class="eta" data-eta="${i.endsAt}">${clock(i.endsAt - Guild.now())}</span> · 실시간 확인 없음</span></span></div>`;
      return `<button class="mrow${al ? ' alert' : ''}" data-act="view-battle" data-id="${m.id}"><span class="faces">${faces(m.memberIds)}</span>
        <span class="grow"><b><span class="chip qg">${k.grade}</span> ${esc(k.name)}</b><br><span class="sub">${esc(nm)}</span><br>
        ${al ? `<span class="sub" style="color:var(--red)">위기 신호! 결정 제한 <span class="eta" data-eta="${i.deadline}">${clock(i.deadline - Guild.now())}</span></span>`
             : `<span class="sub">전투 중 <b data-bclock="${m.id}">${mmss(i.clock)}</b> · 몬스터 <b data-balive="${m.id}">${Guild.battleView(m).alive}</b>마리 남음</span><span class="mbar"><i data-bhp="${m.id}"></i></span>`}</span>
        <span class="go">${al ? '결정하기' : '보기'}</span></button>`;
    });
    const others = actives().map((c) => ({ c, s: statusOf(c) })).filter((x) => x.s.state === 'training').map(({ c, s }) =>
      `<button class="mrow" data-act="open-char" data-id="${c.id}"><span class="faces">${faces([c.id])}</span><span class="grow"><b>${esc(c.name)}</b> ${'훈련 중'}<br><span class="sub">남은 시간 <span class="eta" data-eta="${s.until}">${clock(s.until - Guild.now())}</span></span></span><span class="go">보기</span></button>`);
    const adv = actives().filter((c) => Character.needsAdvance(c)).map((c) =>
      `<button class="mrow" data-act="open-char" data-id="${c.id}"><span class="faces">${faces([c.id])}</span><span class="grow"><b>${esc(c.name)}</b> 전직할 수 있어요<br><span class="sub">Lv.${c.level} · 직업을 골라 주세요</span></span><span class="go">전직</span></button>`);
    const all = cards.concat(others, adv);
    const alerts = alertCount();
    const left = `<div class="scroll lines"><p>의뢰 ${ms.length}건 진행 중</p><p class="small">${alerts ? `<b style="color:#a33a35">위기 신호 ${alerts}건 — 결정이 필요해요.</b><br>` : ''}훈련 ${others.length}명<br>카드를 누르면 전투 화면으로 가요.</p></div>`;
    return wideScreen('원정 현황', left, all.join('') || '<p class="empty" style="padding:30px">진행 중인 일이 없어요.<br>의뢰 › 게시판에서 파티를 꾸려 보내 보세요.</p>', 'active-list');
  }

  function resultsHtml() {
    const rep = Guild.lastReport;
    const absent = rep && rep.left.length
      ? `<div class="rep">${icon('people')}<div style="flex:1"><b>${rep.absentDays}일 만에 돌아오셨네요. ${Guild.ABSENCE_DAYS}일 이상 접속하지 않아 모험가 ${rep.left.length}명이 길드를 떠났어요: ${rep.left.map((c) => c.name).join(', ')}.</b><br><span class="muted" style="font-size:12px">모험가 명부의 이탈 탭에서 금화로 다시 데려올 수 있어요.</span></div>
        <button class="btn ghost sm" data-act="dismiss-report">확인</button></div>` : '';
    const reports = Guild.state.inbox.slice().reverse().map(reportHtml).join('');
    const n = mailCount();
    const left = `<div class="scroll lines"><p>확인하지 않은 결과 ${n}건</p><p class="small">의뢰와 훈련이 끝나면 결과가 이곳에 쌓여요.<br>확인하면 목록에서 사라져요.</p>${n > 1 ? '<p style="margin-top:8px"><button class="btn sm" data-act="dismiss" data-id="">모두 확인</button></p>' : ''}</div>`;
    return wideScreen('귀환 보고', left, absent + (reports ? `<div class="rc-grid">${reports}</div>` : '<div class="rc-none"><span>' + icon('scroll') + '</span>새 결과가 없어요.<small>의뢰나 훈련이 끝나면 보고서가 도착해요.</small></div>'), 'results-list');
  }


  /* ============================================================
     상점 / 대장간 / 보급고
     ============================================================ */
  const statText = (it) => Gear.bonusPts(it).map((v, i) => (v > 0.4 ? `${Gear.STAT_LABEL[i]} +${Math.round(v)}` : '')).filter(Boolean).join(' · ');
  const gIcon = (it, cls) => Art.gearIcon(it.slot, it.g, it.t === undefined ? 0 : it.t, Gear.typeOf(it).n, cls);
  const mIcon = (n, cls) => Art.matIcon(n, Gear.MAT_INFO[n] ? Gear.MAT_INFO[n].grade : 0, cls);
  const itemBlock = (it) => `<span class="ibox">${gIcon(it, 'lg')}<span class="ib-t"><b class="q q${it.q}">${esc(Gear.itemName(it))}</b> <span class="chip qg">${Gear.GRADES[it.g]}</span> <span class="chip qp q${it.q}">품질 ${Gear.qpOf(it)}% · ×${Gear.qMult(Gear.qpOf(it)).toFixed(2)}</span>${Gear.typeOf(it).drop ? ' <span class="chip skill">의뢰 전용</span>' : ''}<br><span class="sub">${Gear.SLOT_NAME[it.slot]} · Lv.${Gear.LV_REQ[it.g]} 이상 · ${statText(it)}</span>${it.opts.length ? `<br><span class="sub">옵션: ${it.opts.map(esc).join(', ')}</span>` : ''}</span></span>`;

  function shopHtml() {
    const st = Guild.state, slots = Guild.shopSlots();
    const disp = st.display.map((d) => `<div class="mrow flat"><span class="grow">${itemBlock(d.item)}</span>
      <span class="tbtns"><button class="btn ghost sm" data-act="price" data-id="${d.item.id}" data-d="-0.1">−10%</button><span class="pbox"><b class="${Guild.inFairBand(d) ? 'fair' : 'offfair'}">${d.price.toLocaleString()}금</b><small>적정 ${Guild.fairRange(d.item)[0].toLocaleString()}~${Guild.fairRange(d.item)[1].toLocaleString()} · ${Guild.inFairBand(d) ? '손님 옴' : d.price > Gear.price(d.item) ? '비싸서 안 옴' : '너무 싸서 의심받음'}</small></span><button class="btn ghost sm" data-act="price" data-id="${d.item.id}" data-d="0.1">+10%</button><button class="btn sm" data-act="undisplay" data-id="${d.item.id}">내리기</button></span></div>`).join('')
      || '<p class="empty">진열된 장비가 없어요. 대장간에서 만든 장비를 진열해 보세요.</p>';
    const stock = st.stock.map((it) => `<div class="mrow flat"><span class="grow">${itemBlock(it)}</span><span class="tbtns"><button class="btn ghost sm" data-act="dump" data-id="${it.id}" title="적정가의 반값에 바로 넘겨요">떨이 ${Guild.dumpPrice(it).toLocaleString()}금</button><button class="btn sm" data-act="display" data-id="${it.id}"${st.display.length >= slots ? ' disabled' : ''}>진열</button></span></div>`).join('')
      || '<p class="empty">보급고에 완성된 장비가 없어요.</p>';
    const th = U.dumpTh || 35;
    const dumpBar = st.stock.length ? `<div class="pills wsbar"><span class="muted small">안 팔리는 장비는 적정가의 반값에 떨이로 넘길 수 있어요.</span><select data-act="dump-th" aria-label="떨이 기준">${[20, 35, 50].map((v) => `<option value="${v}"${th === v ? ' selected' : ''}>품질 ${v}% 미만</option>`).join('')}</select><button class="btn ghost sm" data-act="dump-all">한꺼번에 떨이</button></div>` : '';
    const log = st.shopLog.slice().reverse().slice(0, 6).map((l) => `<p class="small muted" style="margin:0">${esc(l.text)}</p>`).join('') || '<p class="small muted">아직 팔린 장비가 없어요.</p>';
    const left = `<div class="scroll lines"><p>진열 ${st.display.length} / ${slots}칸</p><p class="small">모험가는 ① 적정 가격 ±20% 안이고 ② 지갑에 가격 이상의 돈이 있고 ③ 같은 칸의 지금 장비보다 좋고 ④ 착용 가능한 레벨일 때만 찾아와요. 비싸도, 너무 싸도 오지 않아요.<br>걸작이 팔리면 명성이 조금 올라요. 좋은 장비를 진열하면 지원자가 더 자주 찾아와요.</p></div>`;
    return wideScreen('가판대', left, `<h3 class="wh">가판대</h3>${disp}<h3 class="wh">보급고의 장비 (${st.stock.length})</h3>${dumpBar}${stock}<h3 class="wh">최근 거래</h3>${log}`, 'shop-list');
  }

  function workshopHtml() {
    const st = Guild.state, gi = Guild.gradeIdx(), free = Guild.craftSlots() - st.crafts.length, wl = Guild.facLevel('workshop');
    if (U.wsGrade === undefined || U.wsGrade > gi) U.wsGrade = gi;
    if (!U.wsSlot) U.wsSlot = 'weapon';
    const crafting = st.crafts.map((c) => `<div class="mrow flat">${gIcon(c.item, 'lg')}<span class="grow"><b>${esc(Gear.baseName(c.item))}</b> 제작 중<br><span class="sub">완성까지 <span class="eta" data-eta="${c.doneAt}">${clock(c.doneAt - Guild.now())}</span></span><span class="mbar"><i data-prog-start="${c.startedAt}" data-prog-end="${c.doneAt}"></i></span></span></div>`).join('');
    const rs = Gear.recipes().filter((r) => r.g === U.wsGrade && r.slot === U.wsSlot && Guild.recipeOpen(r)); // 아직 못 배운 제작법은 보이지 않는다
    const rows = rs.map((r) => {
      const open = Guild.recipeOpen(r), fee = Guild.recipeFee(r);
      const mats = r.mats.map((x) => { const h = Guild.matHave(x.name); return `<span class="mat${h >= x.qty ? ' ok' : ''}">${mIcon(x.name, 'xs')}${esc(x.name)} ${h}/${x.qty}</span>`; }).join('');
      const can = open && free > 0 && r.mats.every((x) => Guild.matHave(x.name) >= x.qty) && st.gold >= fee;
      const base = statText({ slot: r.slot, g: r.g, q: 1, qp: 50, t: r.t, plus: 0, opts: [] });
      return `<div class="mrow flat${open ? '' : ' locked'}">${Art.gearIcon(r.slot, r.g, r.t, Gear.TYPES[r.slot][r.t].n, 'lg')}<span class="grow"><b>${esc(r.name)}</b> <span class="chip">주 스탯 ${Gear.focus(r.slot, r.t)}</span><br><span class="sub mats">${mats}</span><span class="sub">품질 50% 기준 ${base} · 금화 ${fee} · ${minText(Guild.craftMinutes(r.g, r.t))}${open ? '' : ` · 대장간 Lv.${r.unlock}에 배워요`}</span></span><button class="btn sm" data-act="craft" data-id="${r.id}"${can ? '' : ' disabled'}>${open ? '제작' : '잠김'}</button></div>`;
    }).join('');
    const gsel = Gear.GRADES.slice(0, gi + 1).map((l, g) => `<option value="${g}"${U.wsGrade === g ? ' selected' : ''}>${l}등급</option>`).join('');
    const sp = Gear.SLOTS.map(([k, l]) => `<button class="pill" aria-selected="${U.wsSlot === k}" data-act="ws-slot" data-k="${k}">${l}</button>`).join('');
    const known = Gear.recipes().filter((r) => r.g <= gi && Guild.recipeOpen(r)).length;
    const left = `<div class="scroll lines"><p>동시 제작 ${st.crafts.length} / ${Guild.craftSlots()}</p><p>배운 제작법 ${known}개</p><p class="small">제작법마다 필요한 재료와 개수가 정해져 있어요. 품질은 만들어 봐야 알아요.<br>재료는 보급고에서 매입해요. 채집 의뢰와 몬스터 토벌에서 얻어요.<br>대장간을 확장하면 새 제작법을 배워요. (Lv.${Gear.UNLOCK_LV.filter((x) => x > 0).join(' · ')})<br>현재 대장간 Lv.${wl}</p></div>`;
    return wideScreen('대장간', left, (crafting ? `<h3 class="wh">제작 중</h3>${crafting}` : '') + `<div class="pills wsbar"><select data-act="ws-grade" aria-label="등급">${gsel}</select>${sp}</div><h3 class="wh">제작법</h3>${rows}`, 'workshop-list');
  }

  function warehouseHtml() {
    const st = Guild.state;
    const total = st.matQueue.reduce((a, q) => a + q.qty * Guild.matUnit(q.name), 0);
    const queue = st.matQueue.map((q) => `<div class="mrow flat">${mIcon(q.name, 'lg')}<span class="grow"><b>${esc(q.name)}</b> ×${q.qty} <span class="chip qg">${Gear.GRADES[Gear.MAT_INFO[q.name].grade]}</span><br><span class="sub">${(q.qty * Guild.matUnit(q.name)).toLocaleString()}금 · 남은 시간 <span class="eta" data-eta="${q.expiresAt}">${clock(q.expiresAt - Guild.now())}</span></span></span><button class="btn sm" data-act="decline-mat" data-id="${q.id}">거절</button><button class="btn sm" data-act="buy-mat" data-id="${q.id}"${st.gold < q.qty * Guild.matUnit(q.name) ? ' disabled' : ''}>매입</button></div>`).join('')
      || '<p class="empty">매입을 기다리는 재료가 없어요. 의뢰를 클리어하면 재료가 들어와요.</p>';
    const q = (U.wareQ || '').trim(), wg = U.wareGrade === undefined || U.wareGrade === '' ? '' : Number(U.wareGrade);
    const all = Object.keys(st.materials).filter((n) => st.materials[n] > 0);
    const have = all.filter((n) => (wg === '' || Gear.MAT_INFO[n].grade === wg) && (!q || n.includes(q))).sort((a, b) => Gear.MAT_INFO[a].grade - Gear.MAT_INFO[b].grade || a.localeCompare(b, 'ko'));
    const filt = `<div class="pills wsbar"><input type="search" class="wsearch" data-act="ware-q" placeholder="재료 이름 검색" value="${esc(U.wareQ || '')}" aria-label="재료 검색"><select data-act="ware-grade" aria-label="등급 거르기"><option value="">전체 등급</option>${Gear.GRADES.map((l, g) => `<option value="${g}"${wg === g ? ' selected' : ''}>${l}등급 (${all.filter((n) => Gear.MAT_INFO[n].grade === g).length})</option>`).join('')}</select><span class="muted small">${have.length} / ${all.length}종</span></div>`;
    const mats = have.map((n) => `<div class="mrow flat">${mIcon(n)}<span class="grow"><b>${esc(n)}</b> <span class="chip qg">${Gear.GRADES[Gear.MAT_INFO[n].grade]}</span></span><b>×${st.materials[n]}</b></div>`).join('') || `<p class="empty">${all.length ? '조건에 맞는 재료가 없어요.' : '보급고가 비어 있어요.'}</p>`;
    const left = `<div class="scroll lines"><p>매입 대기 ${st.matQueue.length}건</p><p class="small">돌아온 파티가 가져온 재료예요. <b>24시간</b> 안에 매입하지 않으면 사라져요.<br>매입한 재료는 대장간에서 장비가 돼요.</p>${st.matQueue.length > 1 ? `<p style="margin-top:8px"><button class="btn sm" data-act="buy-mat" data-id=""${st.gold < total ? ' disabled' : ''}>모두 매입 (${total.toLocaleString()}금)</button> <button class="btn ghost sm" data-act="decline-all">모두 거절</button></p>` : ''}</div>`;
    return wideScreen('보급고', left, `<h3 class="wh">매입 대기</h3>${queue}<h3 class="wh">보급고의 재료</h3>${filt}${mats}`, 'ware-list');
  }

  function dojoHtml() {
    const slots = Guild.trainSlots(), used = Guild.trainees().length;
    const train = Guild.trainees().map((c) => `<div class="mrow"><span class="faces">${faces([c.id])}</span><span class="grow"><b>${esc(c.name)}</b> Lv.${c.level} · 훈련 중<br><span class="sub">남은 시간 <span class="eta" data-eta="${c.training.until}">${clock(c.training.until - Guild.now())}</span></span><span class="mbar"><i data-prog-start="${c.training.startedAt}" data-prog-end="${c.training.until}"></i></span></span><button class="btn ghost sm" data-act="cancel-train" data-id="${c.id}">훈련 취소</button></div>`);
    const idle = idleHeroes().map((c) => {
      const need = Character.needsAdvance(c), max = c.level >= Character.MAX_LEVEL;
      const btns = need ? `<button class="btn sm" data-act="open-advance" data-id="${c.id}">전직하기</button>` : max ? '<span class="muted">최고 레벨</span>' : Guild.TRAIN_OPTIONS.map((min) => {
        const pv = Guild.trainPreview(c, min);
        return `<button class="btn ghost sm" data-act="train-go" data-id="${c.id}" data-min="${min}"${used >= slots || Guild.state.gold < pv.cost ? ' disabled' : ''}>${minText(min)}<br><small>금화 ${pv.cost} · 경험치 +${pv.exp}</small></button>`;
      }).join('');
      return `<div class="mrow flat"><span class="faces">${faces([c.id])}</span><span class="grow"><b>${esc(c.name)}</b> Lv.${c.level} · ${esc(clsOf(c))}<br><span class="sub">경험치 ${expText(c)}</span></span><span class="tbtns">${btns}</span></div>`;
    });
    const left = `<div class="scroll lines"><p>수련장 ${used} / ${slots}명 사용 중</p><p class="small">훈련은 목숨의 위험이 없어요.<br>시간이 지나면 경험치를 얻어요.<br>훈련장을 확장하면 동시에 더 많이, 더 효율적으로 훈련할 수 있어요.</p></div>`;
    return wideScreen('수련장', left, (train.length ? '<h3 class="wh">훈련 중</h3>' + train.join('') : '') + '<h3 class="wh">수련 보내기</h3>' + (idle.join('') || '<p class="empty">훈련을 보낼 수 있는 모험가가 없어요.</p>'), 'dojo-list');
  }

  /* ============================================================
     4) 전투 (의뢰 진행 화면)
     ============================================================ */
  // 지금 화면에 그릴 몬스터 (살아 있는 앞쪽 5마리, 모두 쓰러졌으면 한 마리만)
  function shownMonsOf(v) {
    const all = v.mons.map((mm, idx) => ({ ...mm, idx })), alive = all.filter((mm) => mm.alive);
    return (alive.length ? alive : all.slice(0, 1)).slice(0, 5);
  }
  const ROLE_FAM = { 전사: 'fighter', 무투가: 'fighter', 방패병: 'tank', 성기사: 'tank', 궁수: 'ranger', 도적: 'ranger', 마법사: 'mage', 연금술사: 'mage', 사제: 'support', 음유시인: 'support' };
  const TONE_KEY = { 용감함: 'bold', 광전사: 'bold', 투지: 'bold', 불굴: 'bold', 고집불통: 'bold', 신중함: 'calm', 침착: 'calm', 완벽주의: 'calm', 전략가: 'calm', 행운아: 'lucky', 행운: 'lucky', 도박꾼: 'lucky', 대박: 'lucky', '복권 상인': 'lucky', 느긋함: 'lazy', 게으름뱅이: 'lazy', 소식가: 'lazy', 낙천적: 'lazy', 야심가: 'proud', 천재: 'proud', 수재: 'proud', '고독한 늑대': 'proud', 동료애: 'kind', 희생정신: 'kind', 리더십: 'kind', '치유의 손': 'kind', 응원: 'kind', '사기 고양': 'kind' };
  const heroRole = (c) => ROLE_FAM[(c && c.path && c.path[0]) || ''] || '';
  const heroTone = (c) => { const t = ((c && c.traits) || []).find((n) => TONE_KEY[n]); return t ? TONE_KEY[t] : ''; };
  function battleHtml() {
    const ms = Guild.fights;
    let m = Guild.missionById(U.battle); if (m && m.wait) m = null; m = m || ms[0] || null;
    U.battle = m ? m.id : null;
    if (!m) {
      return `<div class="battle" style="--sky1:#2c2f42;--sky2:#1a1c2a;--g1:#2b2b36;--g2:#15151c">
        <div class="b-top"><button class="b-back" data-act="goto" data-screen="hub">${icon('back')}홈으로</button></div>
        <div class="b-bottom"><div class="b-info">${mailCount() ? '전투가 끝났어요.<br><button class="bigbtn" data-act="goto" data-screen="results">결과 보기</button>' : '진행 중인 전투가 없어요.<br>의뢰 게시판에서 파티를 꾸려 보내면 이곳에서 전투를 지켜볼 수 있어요.'}</div></div></div>`;
    }
    const i = Guild.missionInfo(m), k = i.quest, st = m.battle;
    const bg = BATTLE_BG[k.art] || BATTLE_BG.q1;
    const alert = i.state === 'alert';
    const n = st.m.length;
    const v = Guild.battleView(m);

    // 파티 (왼쪽): 체력은 항상 보인다
    const heroes = st.m.map((x, idx) => {
      const c = byId(x.id), h = v.heroes[idx];
      const cls = h.state === 'out' ? ' out' : h.state === 'down' ? ' out down' : '';
      const pct = Math.max(h.state === 'fit' ? 2 : 0, Math.round((h.hp / h.hpMax) * 100));
      return `<div class="b-hero${cls}" style="--i:${idx}" data-hid="${h.id}" data-role="${heroRole(c)}" data-tone="${heroTone(c)}">${Art.character(c.appearance, { label: c.name })}<span class="nameplate b">${c.name} Lv.${c.level}</span>
        <div class="hpbar hero${h.crisis ? ' low' : ''}" data-hbar="${h.id}"><i style="width:${pct}%"></i></div><div class="hptxt" data-htxt="${h.id}">${h.state === 'down' ? '사망' : `HP ${h.hp}/${h.hpMax}`}</div><span class="shadow"></span></div>`;
    }).join('');

    // 몬스터 (오른쪽): 지금 싸우는 몇 마리만 그린다
    const shownMons = shownMonsOf(v);
    const px = Math.round((MON_PX[k.art] || 120) * (shownMons.length > 3 ? 0.62 : shownMons.length > 1 ? 0.8 : 1));
    const enemies = shownMons.map((mm, idx) => `<div class="b-mon${mm.alive ? '' : ' down'}" data-midx="${mm.idx}"><span style="display:block;width:${px}px">${Art.monster(k.art, '', k.hue || 1).replace('style="filter:', `style="width:100%;height:auto;animation-delay:${(idx * 0.27).toFixed(2)}s;filter:`)}</span>
      <div class="hpbar" data-mbar="${mm.idx}"><i style="width:${Math.max(mm.alive ? 2 : 0, Math.round(mm.r * 100))}%"></i></div><span class="shadow" style="width:${px}px;margin-left:-${px / 2}px"></span></div>`).join('');
    const more = v.alive > shownMons.length ? `<div class="b-more">+${v.alive - shownMons.length}마리</div>` : '';
    const waveTxt = ` · 몬스터 <span data-balive="${m.id}">${v.alive}</span> / ${st.total}마리`;
    const feed = (vv) => vv.feed.map((f) => `<div class="${f.bad ? 'bad' : f.good ? 'good' : ''}">${esc(f.text)}</div>`).join('') || '<div class="muted">전투가 막 시작됐어요.</div>';

    const switcher = ms.length > 1
      ? `<div class="b-switch">${ms.map((x) => { const c0 = byId(x.memberIds[0]); const al = Guild.missionInfo(x).state === 'alert';
          return `<button class="avbtn${x.id === m.id ? ' sel' : ''}${al ? ' alert' : ''}" data-act="view-battle" data-id="${x.id}" aria-label="${x.contract.name}">${Art.character(c0.appearance, { view: 'bust', label: c0.name })}</button>`; }).join('')}</div>` : '';

    let bottom;
    if (alert) {
      bottom = `<div class="crisis"><div class="txt"><b class="h">${icon('alert')}위기 신호!</b>
        ${(() => { const nm = i.crisis.map((id) => st.m.find((y) => y.id === id).name); const last = nm[nm.length - 1] || ''; return nm.length ? nm.join(', ') + (nm.length > 1 ? ' 모두' : '') + (last && hasBatchim(last) ? '이' : '가') + ' 위험해요' : ''; })()}. 결정 제한 <span class="eta" data-eta="${i.deadline}">${clock(i.deadline - Guild.now())}</span><br>
        계속 싸울 때 아무도 죽지 않을 가능성: <b>${i.hint}</b>. 체력이 0이 되는 순간 그 모험가는 <b>사망</b>해요.<br>
        <span class="muted">시간 안에 정하지 않으면 자동으로 계속 싸우게 돼요.</span></div>
        <div class="btns"><button class="bigbtn" data-act="decide" data-choice="retreat" data-mid="${m.id}">전체 후퇴</button>
        <button class="bigbtn danger" data-act="decide" data-choice="continue" data-mid="${m.id}">계속 싸운다</button></div></div>`;
    } else {
      bottom = `<div class="b-graph"><canvas data-bgraph="${m.id}" width="1400" height="240"></canvas><div class="gr-side"><div>역전 <b data-bflip>0</b>번</div><div>최저 승률 <b data-bmin>--</b></div><div class="gr-t"><b data-bsec>${mmss(i.clock)}</b></div></div></div>`;
    }

    const wt = Fx.winText(m.id);
    return `<div class="battle" data-mid="${m.id}" style="--sky1:${bg[0]};--sky2:${bg[1]};--g1:${bg[2]};--g2:${bg[3]}">
      <div class="b-top"><button class="b-back" data-act="goto" data-screen="hub">${icon('back')}홈으로</button>
        <div class="b-title">「${k.name}」</div>
        <div class="b-sub">${alert ? `위기 신호 — 전투가 멈췄어요 · ${mmss(v.t)}${waveTxt}` : `전투 중 <b data-bclock="${m.id}">${mmss(i.clock)}</b>${waveTxt}`}</div>
        <div class="b-win"><span>우리 편이 이길 확률</span><b data-bwin class="${wt.cls}">${wt.txt}</b></div></div>
      <div class="b-order" data-border></div>
      ${switcher}
      <div class="b-field${alert ? ' paused' : ''}">
        <div class="b-party n${n}${n > 5 ? ' big' : ''}">${heroes}</div>
        <div class="b-enemies${shownMons.length > 4 ? ' many' : ''}">${enemies}${more}</div></div>
      <div class="b-log" data-bfeed="${m.id}">${feed(v)}</div>
      <div class="b-bottom">${bottom}</div></div>`;
  }

  /* ============================================================
     6) 길드 시설
     ============================================================ */
  const FAC_ICON = { dorm: 'people', board: 'scroll', dojo: 'sword', ward: 'bandage', archive: 'book', workshop: 'gear', shop: 'coin' };
  const promoReady = () => { const n = Guild.promoNeed(); return !!n && Guild.state.fame >= n.fame && Guild.state.gold >= n.gold; };
  function guildHtml() {
    const st = Guild.state;
    const cards = Guild.FACILITIES.map((f) => {
      const lv = Guild.facLevel(f.id), cap = Guild.facCap(f), cost = Guild.facCost(f.id);
      const maxed = !f.locked && lv >= f.max, capped = !f.locked && !maxed && lv >= cap;
      const pips = Array.from({ length: f.locked ? 3 : f.max }, (_, i) => `<i class="${i < lv ? 'on' : i >= cap ? 'lock' : ''}"></i>`).join('');
      const btn = f.locked ? '<button class="act primary fbtn" disabled>준비 중</button>'
        : maxed ? '<button class="act primary fbtn" disabled>최고 단계</button>'
        : capped ? `<button class="act primary fbtn" disabled>길드 ${Guild.GRADES[Guild.gradeIdx() + 1] || ''}급 승급이 필요해요</button>`
        : `<button class="act primary fbtn" data-act="upgrade" data-id="${f.id}"${st.gold < cost ? ' disabled' : ''}>확장 · 금화 ${cost.toLocaleString()}</button>`;
      return `<div class="fcard"><div class="fhead"><span class="fic">${icon(FAC_ICON[f.id])}</span><div><b>${f.name}</b> <small class="muted">${f.locked ? '' : `Lv.${lv} / ${cap}`}</small><div class="pips">${pips}</div></div></div>
        <p class="fdesc">${f.desc}</p>
        <div class="fnow">지금: ${f.effect(lv)}</div>${f.locked || maxed || capped ? '' : `<div class="fnext">다음: ${f.effect(lv + 1)}</div>`}${btn}</div>`;
    }).join('');
    const need = Guild.promoNeed();
    const pct = need ? Math.min(100, Math.round((st.fame / need.fame) * 100)) : 100;
    const promo = need
      ? `<p class="small">다음 등급 <b>${need.next}</b>까지<br>명성 ${st.fame.toLocaleString()} / ${need.fame.toLocaleString()}</p><div class="fame"><i style="width:${pct}%"></i></div>
         <p class="small" style="margin:6px 0">승급 비용 금화 ${need.gold.toLocaleString()}</p>
         <button class="btn sm" data-act="promote"${promoReady() ? '' : ' disabled'}>${promoReady() ? `${need.next}급으로 승급` : st.fame < need.fame ? '명성이 더 필요해요' : '금화가 더 필요해요'}</button>`
      : '<p class="small">최고 등급(S)에 올랐어요.</p>';
    const left = `<div class="col"><section class="parch fit"><h3>길드 ${Guild.guildGrade()}급</h3><hr class="rule"><div class="scroll lines">
      ${promo}
      <p class="small" style="margin-top:8px">등급이 오르면 시설을 더 높이 키울 수 있고 더 어려운 의뢰가 들어와요.<br>의뢰를 깨면 명성이 쌓이고, 모험가가 죽거나 파티가 전멸하면 줄어요.</p></div></section></div>`;
    const center = `<section class="cpanel wide">${chead('길드 시설')}<div class="fgrid">${cards}</div></section>`;
    return `<div class="pscreen">${Art.hall()}<div class="cols">${left}${center}</div></div>`;
  }

  /* ============================================================
     7) 영입 면접
     ============================================================ */
  // 접수처: 카운터 뒤에 앉아(1인칭) 찾아온 지원자 한 명을 마주 보고 이야기를 듣는다
  function recruitHtml() {
    const a = Guild.applicants[0] || null;
    U.applicant = a ? a.id : null;
    if (U.recFor !== U.applicant) { U.recFor = U.applicant; U.recLine = 0; }
    const c = a ? a.char : null;
    const block = Guild.recruitBlock();
    const nAct = actives().length, cap = Guild.rosterCap();
    const lines = a ? a.story.concat(a.hint ? [a.hint] : []) : [];
    const animNow = a && U.recAnim !== a.id; if (a) U.recAnim = a.id;
    const li = Math.min(U.recLine || 0, Math.max(0, lines.length - 1)), last = li >= lines.length - 1;
    const isHint = a && a.hint && li === lines.length - 1;
    const dlg = a
      ? `<div class="rcp-dlg" data-act="rec-next" role="button" tabindex="0"><div class="nm">${esc(c.name)}</div><div class="tx${isHint ? ' hint' : ''}">${esc(lines[li] || '')}</div><div class="nx">${last ? '' : '다음 ▶'} <small>${li + 1} / ${lines.length}</small></div></div>`
      : '<div class="rcp-dlg"><div class="tx" style="text-align:center;color:var(--muted)">접수처 앞이 비어 있어요. 다음 지원자를 기다리는 중…</div></div>';
    const memo = a ? `<div class="rcp-memo"><div class="mh">면접 메모 <small>${li + 1} / ${lines.length}</small></div>${lines.map((t, i) => `<p class="${a.hint && i === lines.length - 1 ? 'hint ' : ''}${i > li ? 'fut' : i === li ? 'cur' : ''}">${esc(t)}</p>`).join('')}</div>` : '';
    const desk = `<div class="rcp-desk">
      <div class="rcp-pad"><h3>채용 점검</h3>${chk(`금화 ${Guild.recruitCost()} (보유 ${Guild.state.gold})`, Guild.state.gold >= Guild.recruitCost())}${chk(`기숙사 여유 (${nAct} / ${cap})`, nAct < cap)}
        <p class="small muted" style="margin-top:6px">희귀도·직업·특성·능력치는 채용하면 바로 공개돼요.<br>돌려보낸 지원자는 다시 오지 않아요.</p></div>
      <div class="rcp-btns"><button class="act primary" data-act="hire" data-id="${a ? a.id : ''}"${a && !block ? '' : ' disabled'}>채용 · 금화 ${Guild.recruitCost()} ${icon('check')}</button>
        <button class="act" data-act="app-dismiss" data-id="${a ? a.id : ''}"${a ? '' : ' disabled'}>돌려보내기 ${icon('cross')}</button></div>
      <div class="rcp-pad right"><h3>지원서</h3>${a ? `<div class="kv1"><span class="k">이름</span><span class="v">${esc(c.name)}</span></div><div class="kv1"><span class="k">기본 직업</span><span class="v">${esc(c.path[0])}</span></div><div class="kv1"><span class="k">머무는 시간</span><span class="v"><span data-eta-left="${a.expiresAt}">${leftText(a.expiresAt - Guild.now())}</span></span></div>` : '<p class="small muted">기다리는 지원자가 없어요.</p>'}</div></div>`;
    return `<div class="rcp">${Art.hall()}<div class="rcp-shade"></div>${memo}${a ? `<div class="rcp-app${animNow ? ' enter' : ''}">${Art.character(c.appearance, { label: c.name })}</div>` : ''}${dlg}${desk}</div>`;
  }

  /* ============================================================
     5) 연대기 (필터)
     ============================================================ */
  // 연대기 글의 종류 (글 내용으로 구분한다)
  const CHR_KIND = [
    ['death', /사망|전멸|잃었다/], ['skill', /고유스킬/], ['bond', /사이가|잃었다/],
    ['guild', /확장|이름/], ['quest', /의뢰|후퇴|Lv\.|달성/], ['adv', /영입|탄생|돌아옴|떠남|이탈/],
  ];
  const kindOf = (text) => { for (const [k, re] of CHR_KIND) if (re.test(text)) return k; return 'etc'; };
  const CHR_TABS = [['all', '전체'], ['adv', '모험가'], ['quest', '의뢰'], ['bond', '관계'], ['death', '죽음'], ['skill', '고유스킬'], ['guild', '길드']];

  /* ============================================================
     업적 · 추모비
     ============================================================ */
  const ACH_CATS = ['전체', '의뢰', '모험가', '관계', '길드', '수집'];
  function achvHtml() {
    const L = Guild.achList(), done = L.filter((a) => a.done).length;
    const cat = U.achCat;
    const aq = (U.achQ || '').trim(), ast = U.achSt || '';
    const shown = L.filter((a) => (cat === '전체' || a.cat === cat) && (!ast || (ast === 'done' ? a.done : !a.done)) && (!aq || (a.name + ' ' + a.text).includes(aq)))
      .sort((a, b) => (a.done - b.done) || (b.now / b.goal - a.now / a.goal) || a.goal - b.goal);
    const rows = shown.map((a) => `<div class="arow${a.done ? ' done' : ' off'}"><span class="aic">${icon(a.done ? 'check' : 'lock')}</span>
      <span class="grow"><b>${esc(a.name)}</b> <span class="sub">${esc(a.text)}</span><span class="mbar"><i style="width:${Math.round(100 * a.now / a.goal)}%"></i></span></span>
      <span class="arw">${a.done ? '달성' : `${a.now.toLocaleString()} / ${a.goal.toLocaleString()}`}<br><span class="sub">금화 ${a.gold}${a.fame ? ' · 명성 ' + a.fame : ''}${a.ticket ? ' · 초기화권' : ''}</span></span></div>`).join('');
    const pills = ACH_CATS.map((k) => { const n = L.filter((a) => k === '전체' || a.cat === k); return `<button class="pill" aria-selected="${cat === k}" data-act="ach-cat" data-k="${k}">${k} ${n.filter((a) => a.done).length}/${n.length}</button>`; }).join('');
    const S = Guild.state.stats;
    const left = `<div class="scroll lines"><p>달성 <b>${done}</b> / ${L.length}</p><div class="pills wrap">${pills}</div>
      <p class="small" style="margin-top:8px">도감 완성도 <b>${Guild.codexPct()}%</b> (${Guild.monKnown()} / ${Guild.monTotal()}종)<br>공적은 달성하는 순간 보상이 자동으로 들어와요.</p>
      <p class="small">기록: 완수 ${S.clears}회 · 최고 무사고 ${S.best}연속 · 처치 ${S.kills} · 사망 ${S.deaths}명 · 대화 ${S.talks}번</p></div>`;
    const bar = `<div class="pills wsbar"><input type="search" class="wsearch" data-act="ach-q" placeholder="공적 검색" value="${esc(U.achQ || '')}" aria-label="공적 검색"><select data-act="ach-st" aria-label="달성 여부"><option value="">전체</option><option value="done"${ast === 'done' ? ' selected' : ''}>달성한 공적</option><option value="todo"${ast === 'todo' ? ' selected' : ''}>아직 못 한 공적</option></select><span class="muted small">${shown.length} / ${L.length}개</span></div>`;
    return wideScreen('공적', left, bar + (rows ? `<div class="a-grid">${rows}</div>` : '<p class="empty" style="padding:30px">조건에 맞는 공적이 없어요.</p>'), 'achv-list');
  }
  function memorialHtml() {
    const dead = Guild.state.characters.filter((c) => c.status === 'DEAD').sort((a, b) => b.diedAt - a.diedAt);
    const cards = dead.map((c) => {
      const b = Guild.bondsOf(c.id)[0];
      const days = Math.max(1, Math.round(((c.diedAt || 0) - (c.recruitedAt || c.diedAt || 0)) / 86400000));
      const hist = (c.history || []).slice().reverse();
      const nDone = Math.max(hist.length, c.quests || 0);
      const list = nDone ? `<button class="btn sm mc-done" data-act="qlist" data-cid="${c.id}">완수한 의뢰 <b>${nDone}</b>건 ›</button>` : '<span class="sub">완수한 의뢰가 없어요</span>';
      const info = c.deathInfo, known = info ? info.known : !/알 수 없/.test(c.deathCause || '');
      const pm = /「(.+?)」에서 (.+?)에게/.exec(c.deathCause || ''), qn = (info && info.quest) || (pm && pm[1]) || ((/「(.+?)」/.exec(c.deathCause || '')) || [])[1] || '', mon = (info && info.monster) || (pm && pm[2]) || '';
      const cause = known ? `<b class="mc-c1">${icon('skull')}${mon ? esc(mon) + '에게 쓰러짐' : '전투 중 사망'}</b><span class="mc-c2">${esc(qn)}</span>` : `<b class="mc-c1">${icon('skull')}원인 불명</b><span class="mc-c2">${esc(qn)} · 파티 전멸</span>`;
      return `<article class="mcard"><div class="mc-pic">${Art.character(c.appearance, { view: 'bust', label: c.name })}<span class="mc-rip">†</span></div>
        <div class="mc-body"><div class="mc-name"><b>${esc(c.name)}</b><span class="sub">${c.grade} · ${Guild.rankLabel(c)}급 · ${esc(clsOf(c))} · Lv.${c.level}</span></div>
          <div class="mc-dates">${dateText(c.recruitedAt || c.diedAt)} – ${dateText(c.diedAt)} · ${days}일을 함께했어요</div>
          <div class="mc-cause ${known ? '' : 'unk'}" title="${esc(c.deathCause || '')}">${cause}</div>
          <div class="mc-donewrap">${list}</div>
          <div class="mc-stat">처치 ${c.kills || 0}마리${b ? ` · 가장 가까웠던 사람: ${esc(b.other.name)}(${b.name})` : ''}</div>
          ${c.epitaph ? `<p class="epi">「${esc(c.epitaph)}」</p>` : ''}</div>
        <div class="mc-foot">${Guild.mournable(c) ? `<button class="btn sm" data-act="mourn" data-id="${c.id}">추모식 · 금화 ${Guild.MOURN_COST}</button>` : '<span class="sub">추모식을 마쳤어요</span>'}</div></article>`;
    }).join('');
    const left = `<div class="scroll lines"><p>잃은 모험가 <b>${dead.length}</b>명</p><p class="small">모험가가 죽으면 함께했던 동료는 슬픔에 잠겨 한동안 약해져요.<br>추모식을 열면 그 슬픔이 덜어져요. 비용은 금화 ${Guild.MOURN_COST}이에요.<br>같이 나갔던 동료가 한 명이라도 돌아왔다면 사망 원인을 알 수 있어요. 모두 쓰러졌다면 알 수 없어요.</p></div>`;
    return wideScreen('기념비', left, dead.length ? `<div class="mc-grid">${cards}</div>` : '<p class="empty" style="padding:30px">아직 떠난 모험가가 없어요.<br>그 날이 오지 않기를 바라요.</p>', 'mem-list');
  }
  function chronicleHtml() {
    const st = Guild.state;
    const all = st.characters;
    const quests = all.reduce((n, c) => n + (c.quests || 0), 0);
    const skilled = all.filter((c) => c.uniqueSkill !== null && c.status !== 'DEAD').length;
    const entries = st.chronicle.slice().sort((a, b) => b.t - a.t).map((e) => ({ ...e, kind: kindOf(e.text) }));
    const shown = U.chrFilter === 'all' ? entries : entries.filter((e) => e.kind === U.chrFilter);
    const left = `<div class="col"><section class="parch col-a"><h3>${esc(st.guildName)}</h3><hr class="rule"><div class="scroll lines">
      <p>지금까지 ${all.length}명의 모험가가 길드를 거쳐 갔다.</p>
      <p class="small">현역 ${Guild.byStatus('ACTIVE').length} · 이탈 ${Guild.byStatus('LEFT').length} · 사망 ${Guild.byStatus('DEAD').length}<br>완수한 의뢰 ${quests}건 · 고유스킬 보유자 ${skilled}명<br>기록 ${entries.length}건</p></div></section>
      <section class="dpanel">${dhead('연대기')}<div class="pills wrap" role="tablist">${CHR_TABS.map(([k, l]) => `<button class="pill" role="tab" aria-selected="${U.chrFilter === k}" data-act="chr-filter" data-k="${k}">${l}</button>`).join('')}</div>
      <p class="small muted" style="padding:6px 16px">${isMobile ? '위쪽' : '오른쪽'} 분류로 기록을 골라 볼 수 있어요.</p></section></div>`;
    const items = shown.map((e) => `<div class="tl-item"><time>${dateText(e.t)}</time><span>${e.kind === 'death' ? '† ' : ''}${esc(e.text)}</span></div>`).join('')
      || '<p class="muted" style="padding:20px;color:#7a6648">이 종류의 기록은 아직 없어요.</p>';
    const center = `<section class="cpanel wide">${chead('길드 연대기')}<div class="tl" data-keep="chronicle">${items}</div></section>`;
    return `<div class="pscreen">${Art.hall()}<div class="cols">${left}${center}</div></div>`;
  }

  /* ============================================================
     9) 도감 (고유스킬 / 몬스터)
     ============================================================ */
  const skillEffect = (id) => '모든 능력치 +6% · ' + DATA_UNIQUE[id].text;
  // 스킬 아이콘: 이미지가 준비되면 SKILL_ICON_PATH만 정하면 된다 (예: 'assets/skills/' → assets/skills/12.png). 지금은 별 모양 자리표시.
  const SKILL_ICON_PATH = null;
  const skillIco = (id, cls) => `<span class="sk-ico${cls ? ' ' + cls : ''}">${SKILL_ICON_PATH && id != null ? `<img src="${SKILL_ICON_PATH}${id}.png" alt="">` : icon('star')}</span>`;
  if (window.Chat) Chat.setSkillInfo((id) => (Character.SKILL_NAMES[id] ? { name: esc(Character.SKILL_NAMES[id]), text: esc(skillEffect(id)), icon: skillIco(id) } : null));
  function codexHtml() {
    const reg = Guild.registry;
    const seenSkills = [];
    for (let i = 0; i < Character.SKILL_COUNT; i++) if (reg.historyOf(i).length) seenSkills.push(i);
    const mons = Guild.codexMon();
    const GA = Combat.GRADE_INFO;
    const monList = Object.keys(mons).filter((n) => Gear.MONSTERS[n] && Guild.knowledge(n) >= 1).map((name) => {
      const mi = Gear.MONSTERS[name], gk = Gear.GRADES[mi.grade];
      return { name, art: GA[gk].art, hue: (Monsters.INFO[name] || {}).hue, grade: gk, gi: mi.grade, boss: !!mi.boss, kn: Guild.knowledge(name), rec: mons[name] };
    }).sort((x, y) => x.gi - y.gi || (x.boss - y.boss) || x.name.localeCompare(y.name, 'ko'));
    const isSkill = U.codexTab === 'skill';
    const tab = (k, l) => `<button class="pill" role="tab" aria-selected="${U.codexTab === k}" data-act="codex-tab" data-k="${k}">${l}</button>`;
    let cards = '', filt = '';
    if (isSkill) {
      const seenSet = new Set(seenSkills), st = (id) => (!seenSet.has(id) ? 'new' : reg.isAvailable(id) ? 'free' : 'own');
      const cnt = { new: 0, free: 0, own: 0 };
      for (let i = 0; i < Character.SKILL_COUNT; i++) cnt[st(i)]++;
      const F = [['all', '전체', Character.SKILL_COUNT], ['own', '주인 있음', cnt.own], ['free', '주인 없음', cnt.free], ['new', '미발견', cnt.new]];
      if (!F.some((f) => f[0] === U.skFilter)) U.skFilter = 'all';
      filt = `<div class="pills wrap" role="tablist">${F.map(([k, l, n]) => `<button class="pill" role="tab" aria-selected="${U.skFilter === k}" data-act="sk-filter" data-k="${k}">${l} ${n}</button>`).join('')}</div>`;
      const LBL = { new: '미발견', free: '주인 없음', own: '주인 있음' };
      cards = '<div class="cx-grid sk">' + Array.from({ length: Character.SKILL_COUNT }, (_, i) => i).filter((id) => U.skFilter === 'all' || st(id) === U.skFilter).sort((x, y) => (st(x) === 'new') - (st(y) === 'new') || x - y).map((id) => {
        const k = st(id), no = 'No. ' + String(id + 1).padStart(3, '0');
        return `<article class="cx-card sk-${k}">${skillIco(k === 'new' ? null : id, k === 'new' ? 'lock' : '')}<div class="cx-body"><div class="cx-top"><span class="cx-no">${no}</span><span class="cx-st ${k}">${LBL[k]}</span></div>
          <h4>${k === 'new' ? '???' : esc(Character.SKILL_NAMES[id])}</h4><p>${k === 'new' ? '아직 아무도 얻지 못한 스킬이에요.' : esc(skillEffect(id))}</p></div></article>`;
      }).join('') + '</div>';
    } else {
      const lock = '<span class="cx-lock">??? 더 만나 보면 알 수 있어요</span>';
      cards = monList.length ? '<div class="cx-grid mon">' + monList.map((m) => {
        const info = Gear.MONSTERS[m.name], rec = m.rec || {}, T = Guild.knowT(m.name);
        return `<article class="cx-card mon"><div class="cx-mon">${Art.monster(m.art, '', m.hue)}</div><div class="cx-body"><div class="cx-top"><span class="chip qg">${m.grade}</span>${m.boss ? '<span class="chip hot">보스</span>' : '<span class="chip">무리</span>'}<span class="cx-no">정보 ${m.kn}/3</span></div>
          <h4>${esc(m.name)}</h4><p class="cx-sub">귀환 보고 ${rec.reports || 0}회 · 처치 ${rec.kills || 0}마리${rec.firstBy ? ' · 최초 보고 ' + esc(rec.firstBy) : ''}</p>
          <dl><dt>소재</dt><dd>${esc(info.mat)} (${Gear.GRADES[info.grade]}등급)</dd><dt>속성</dt><dd>${m.kn >= 2 ? esc(info.attr) : lock}</dd><dt>약점</dt><dd>${m.kn >= 2 ? esc(Combat.BEATEN_BY[info.attr]) + ' 속성' : lock}</dd>
          <dt>특징</dt><dd>${m.kn >= 3 ? (info.boss ? '20초마다 단일 대상에게 강한 일격(×2.5), 30초마다 파티 전체 공격(×1.2)' : '무리를 지어 동시에 덤벼요. 한 마리씩은 약해요.') : lock}</dd></dl>
          ${m.kn < 3 ? `<p class="cx-more">상세 정보까지 ${Math.max(0, T - (rec.reports || 0))}회</p>` : ''}</div></article>`;
      }).join('') + '</div>' : '<p class="empty" style="padding:30px">아직 만나 본 몬스터가 없어요.<br>의뢰를 보내고 돌아온 모험가의 이야기를 들어 보세요.</p>';
    }
    const left = `<div class="scroll lines"><p>고유스킬 ${seenSkills.length} / ${Character.SKILL_COUNT}종 발견</p><p class="small">몬스터 ${monList.length} / ${Monsters.total()}종 확인<br>고유스킬은 모든 유저를 통틀어 한 명만 가질 수 있어요.<br>누가 얻었든 도감에 채워지고, 주인이 죽으면 다시 나올 수 있어요.</p></div>
      <div class="pills" role="tablist" style="margin:8px 0">${tab('skill', '고유스킬')}${tab('monster', '몬스터')}</div>${filt}`;
    return wideScreen('도감', left, cards, 'codex-' + U.codexTab);
  }

  /* ============================================================
     모달 (우편함 / 설정 / 도움말 / 새 모험가 / 확인)
     ============================================================ */
  const mailCount = () => Guild.state.inbox.length + (Guild.lastReport && Guild.lastReport.left.length ? 1 : 0);

  function reportHtml(r) {
    const dead = r.members.filter((x) => x.fate === 'dead');
    const kind = dead.length ? 'dead' : { win: 'win', train: 'train', wipe: 'wipe', retreat: 'retreat' }[r.outcome] || 'draw';
    const stamp = { win: '완수', train: '훈련 완료', wipe: '전멸', retreat: '후퇴', draw: '무승부' }[r.outcome] || '결과';
    const ic = { win: 'check', train: 'book', wipe: 'skull', retreat: 'bandage', draw: 'scroll' }[r.outcome] || 'scroll';
    const title = r.outcome === 'train' ? `${esc(r.members[0].name)}의 훈련` : esc(r.questName);
    const fate = { ok: r.outcome === 'train' ? '훈련 완료' : '무사 귀환', injured: '쓰러짐', out: '이탈 (쓰러짐)', dead: '사망' };
    const tot = r.members.reduce((a, x) => a + (x.exp || 0), 0);
    const pill = (cls, ico, label, val) => `<div class="rc-pill ${cls}"><span class="rc-pi">${ico}</span><span class="rc-pv">${val}</span><span class="rc-pl">${label}</span></div>`;
    const rewards = [
      r.gold ? pill('gold', icon('coin'), '금화', '+' + r.gold.toLocaleString()) : '',
      r.fame ? pill(r.fame > 0 ? 'up' : 'dn', icon('star'), '길드 명성', (r.fame > 0 ? '+' : '') + r.fame) : '',
      tot ? pill('exp', icon('book'), '경험치 합계', '+' + tot) : '',
      (r.killed && r.outcome !== 'train') ? pill('kill', icon('cross'), '처치', r.killed + '마리') : '',
    ].join('');
    const members = r.members.map((x) => {
      const c = byId(x.id);
      const face = c ? Art.character(c.appearance, { view: 'bust', label: x.name }) : '';
      const badge = x.fate === 'dead' ? '<i class="rc-b dead">†</i>' : x.fate === 'injured' || x.fate === 'out' ? '<i class="rc-b hurt">+</i>' : x.newLevel > x.oldLevel ? '<i class="rc-b lv">▲</i>' : '';
      const lines = [
        x.hpAfter !== undefined ? `체력 ${Math.round(x.hpAfter * 100)}%` : '',
        x.exp ? `경험치 +${x.exp}` : '',
        x.newLevel > x.oldLevel ? `<b class="up">Lv.${x.oldLevel} → ${x.newLevel}</b>` : '',
        x.rankPts ? `등급 점수 +${x.rankPts}` : '',
        x.rankUp ? `<b class="gold">${x.rankUp}급 승급!</b>` : '',
      ].filter(Boolean).join(' · ');
      return `<div class="rc-mem ${x.fate}"><span class="rc-face">${face}${badge}</span><span class="rc-mi"><b>${esc(x.name)}</b><span class="rc-fate">${fate[x.fate]}</span><span class="rc-ml">${lines}</span></span></div>`;
    }).join('');
    const notes = [
      ...(r.drops || []).map((d) => `<div class="rc-note">▸ ${esc(d)}</div>`),
      r.outcome !== 'win' && r.outcome !== 'train' ? '<div class="rc-note dim">▸ 의뢰는 게시판에 그대로 남았어요.</div>' : '',
      ...(r.bonds || []).map((bd) => `<div class="rc-note bond">♥ ${esc(bd.a)}${bd.b ? ' · ' + esc(bd.b) : ''} — ${bd.name}</div>`),
      r.auto ? '<div class="rc-note dim">▸ 결정 시간이 지나 자동으로 처리됐어요.</div>' : '',
    ].join('');
    return `<article class="rcard ${kind}"><header class="rc-head"><span class="rc-ico">${icon(ic)}</span><div class="rc-t"><b class="rc-title">${kind === 'dead' && r.outcome === 'win' ? '「' + title + '」 — 슬픈 승리' : '「' + title + '」'}</b><span class="rc-sub">${dateText(r.t)}</span></div><span class="rc-stamp">${stamp}</span></header>
      ${rewards ? `<div class="rc-rewards">${rewards}</div>` : ''}
      <div class="rc-party">${members}</div>${notes ? `<div class="rc-notes">${notes}</div>` : ''}
      ${r.log.length ? `<details class="rc-log"><summary>전투 기록 보기</summary><ul>${r.log.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}
      <footer class="rc-foot"><button class="btn sm" data-act="dismiss" data-id="${r.id}">확인했어요</button></footer></article>`;
  }

  // ---- 채용 공개 연출: 정해진 순서로 슬롯이 돌다 멈추고, 능력치 막대가 제각각 오르내리다 자리를 잡는다
  // 연출 색: 희귀도·직업·속성·특성마다 다른 색으로 보여 준다
  const RV_GRADE = { Common: '#d5dcec', Rare: '#5cb6ff', Epic: '#b97cff', Unique: '#ff7ab6', Legendary: '#ffd166' };
  const RV_ATTR = { '불': '#ff6a4d', '물': '#4db8ff', '바람': '#7de3a0', '땅': '#d2a96b', '빛': '#fff0a0', '어둠': '#a98bff' };
  const RV_CLASS = { '전사': '#ff7b6b', '방패병': '#8fa9cf', '궁수': '#93d96d', '도적': '#b9a0ff', '마법사': '#6fb8ff', '사제': '#fff1b8', '성기사': '#ffd27a', '연금술사': '#7fe6bc', '음유시인': '#ff9ed6', '무투가': '#ffa650' };
  const RV_TRAIT = '#7fe3d6';
  const rvCol = (map, v, d) => map[v] || d || '#aab3d0';
  const rvSpan = (t, col) => `<span style="color:${col}">${t}</span>`;
  function slotRow(label, pool, finalHtml, t, finalCls, skillName_, o) {
    o = o || {};
    const cm = o.cm || (() => '#aab3d0');
    const items = [];
    for (let i = 0; i < 15; i++) { let v; do { v = pool[Math.floor(Math.random() * pool.length)]; } while (v === items[i - 1]); items.push(v); }
    const cells = items.map((v) => `<div class="rv-si" style="--c:${cm(v)}">${esc(v)}</div>`);
    cells.push(`<div class="rv-si fin ${finalCls || ''}" style="--c:${o.c || '#fff'}">${finalHtml}</div>`);
    return `<div class="rv-row" data-t="${t}" data-c="${o.c || ''}" data-pow="${o.pow || 1}"${skillName_ ? ` data-skill="${esc(skillName_)}"` : ''}><span class="rv-k">${label}</span>${skillName_ ? '<i class="rv-rays"></i>' : ''}<div class="rv-slot"><div class="rv-reel" style="--n:${cells.length - 1}">${cells.join('')}</div></div></div>`;
  }
  function revealHtml(c) {
    const sk = skillName(c), pts = Engine.statPoints(Character.toEngine(c), Engine.collectMods(Character.toEngine(c)).mods);
    const mx = Math.max(...pts) * 1.08 || 1;
    const attrs = ['불', '물', '바람', '땅', '빛', '어둠'];
    const attrFinal = rvSpan(esc(c.mainAttribute), rvCol(RV_ATTR, c.mainAttribute)) + (c.subAttribute ? ' / ' + rvSpan(esc(c.subAttribute), rvCol(RV_ATTR, c.subAttribute)) : '');
    const traits = c.traits.length ? c.traits.map((x) => rvSpan(esc(x), RV_TRAIT)).join(', ') : '없음';
    const gradePow = { Common: 1, Rare: 2, Epic: 2, Unique: 3, Legendary: 3 }[c.grade] || 1;
    const bars = Engine.STATS.map((n, i) => {
      const f = pts[i] / mx, hi = Math.min(1, f + 0.25 + (i % 3) * 0.08), lo = Math.max(0.05, f * (0.25 + (i % 2) * 0.2)), dur = 1.5 + ((i * 37) % 7) / 10, dl = (i * 0.11).toFixed(2);
      return `<div class="st rv-st"><span>${n}</span><i class="sbar"><i style="--f:${f.toFixed(3)};--hi:${hi.toFixed(3)};--lo:${lo.toFixed(3)};--dur:${dur}s;--dl:${dl}s"></i></i><b style="--dl:${(1.2 + i * 0.1).toFixed(2)}s">${Math.round(pts[i])}</b></div>`;
    }).join('');
    return `<div class="reveal" data-rid="${c.id}"><div class="rv-left"><div class="lic-frame rv-face">${Art.character(c.appearance, { view: 'bust', label: c.name })}</div><h2>${esc(c.name)}</h2><p class="muted rv-hint">화면을 누르면 바로 결과를 봐요</p></div>
      <div class="rv-right">
        ${slotRow('희귀도', Character.GRADES, c.grade, 300, 'grade', null, { cm: (v) => rvCol(RV_GRADE, v), c: rvCol(RV_GRADE, c.grade), pow: gradePow })}
        ${slotRow('직업', Character.ROOTS, esc(clsOf(c)), 1200, '', null, { cm: (v) => rvCol(RV_CLASS, v), c: rvCol(RV_CLASS, c.path[0]) })}
        ${slotRow('속성', attrs, attrFinal, 2100, '', null, { cm: (v) => rvCol(RV_ATTR, v), c: rvCol(RV_ATTR, c.mainAttribute) })}
        ${slotRow('고유스킬', ['없음', '있음'], sk ? '있음' : '없음', 3000, sk ? 'gold' : 'dim', sk)}
        ${slotRow('특성', DATA_TRAITS.map((t) => t.name), traits, 3900, c.traits.length ? '' : 'dim', null, { cm: () => RV_TRAIT, c: RV_TRAIT, pow: c.traits.length >= 2 ? 2 : 1 })}
        <div class="rv-stats" data-t="4900"><div class="rv-sh">능력치</div>${bars}</div>
      </div></div>`;
  }
  let revealTimers = [];
  // 연출이 끝났음을 알린다 (튜토리얼이 기다리고 있으면 다음 단계로)
  function revFinish(rv) { U.revFin = U.modal && String(U.modal.id) === String(rv.dataset.rid) ? U.modal.id : rv.dataset.rid; if (Guild.tutorialActive()) { tutAdvance(); render(); } }
  function startReveal() {
    const rv = document.querySelector('#overlay .reveal');
    if (!rv) { revealTimers.forEach(clearTimeout); revealTimers = []; return; }
    if (rv.dataset.on) return;
    rv.dataset.on = '1';
    revealTimers.forEach(clearTimeout); revealTimers = [];
    rv.querySelectorAll('[data-t]').forEach((el) => {
      revealTimers.push(setTimeout(() => {
        el.classList.add('go');
        if (el.classList.contains('rv-row') && el.querySelector('.rv-reel')) revealTimers.push(setTimeout(() => { el.classList.add('stop'); rvJuice(rv, el); }, 1000));
      }, Number(el.dataset.t)));
    });
    const sr = rv.querySelector('[data-skill]');
    if (sr) { // 모든 정보가 정해진 뒤, 고유스킬 칸이 극적으로 공개된다
      revealTimers.push(setTimeout(() => { rv.classList.add('drama'); sr.classList.add('build'); }, 7000));
      revealTimers.push(setTimeout(() => { const m = rv.closest('.modal'); if (m) m.classList.add('quake'); }, 8100));
      revealTimers.push(setTimeout(() => skillBoom(rv, sr), 8700));
      revealTimers.push(setTimeout(() => rv.classList.remove('drama'), 10300));
    }
    revealTimers.push(setTimeout(() => { rv.classList.add('done'); Guild.flushAnnounce(rv.dataset.rid); revFinish(rv); }, sr ? 10300 : 7000));
  }
  // 슬롯이 멈추는 순간의 손맛: 색 번쩍임 + 튀어오르는 글자 + 입자, 높은 희귀도는 화면 흔들림까지
  function rvJuice(rv, row) {
    if (rv.classList.contains('skip') || row.dataset.skill) return;
    const col = row.dataset.c || '#ffffff', pow = Number(row.dataset.pow) || 1, slot = row.querySelector('.rv-slot');
    if (!slot) return;
    row.style.setProperty('--c', col);
    const fl = document.createElement('i'); fl.className = 'rv-sweep'; slot.appendChild(fl); setTimeout(() => fl.remove(), 700);
    if (pow >= 2) { const m = rv.closest('.modal'); if (m) { m.classList.add('thud'); setTimeout(() => m.classList.remove('thud'), 320); } }
    if (pow >= 3) { const f = document.createElement('div'); f.className = 'rv-flash tint'; f.style.setProperty('--c', col); rv.appendChild(f); setTimeout(() => f.remove(), 700); }
  }
  function skillBoom(rv, sr) {
    sr.classList.remove('build'); sr.classList.add('boom');
    const m = rv.closest('.modal'); if (m) m.classList.remove('quake');
    const f = document.createElement('div'); f.className = 'rv-flash'; rv.appendChild(f); setTimeout(() => f.remove(), 900);
    const slot = sr.querySelector('.rv-slot'), ring = document.createElement('i'); ring.className = 'rv-ring'; sr.appendChild(ring); setTimeout(() => ring.remove(), 1100);
    skillSwap(sr);
    burstAt(slot, ['#ffd166', '#fff3b0', '#ffb347', '#ffffff'], 44, 300);
  }
  function skillSwap(row) {
    const fin = row.querySelector('.rv-si.fin');
    if (fin && row.dataset.skill) { fin.textContent = '★ ' + row.dataset.skill; fin.classList.add('named'); }
  }
  function skipReveal() {
    const rv = document.querySelector('#overlay .reveal');
    if (!rv || rv.classList.contains('done')) return;
    revealTimers.forEach(clearTimeout); revealTimers = [];
    rv.classList.add('skip', 'done'); Guild.flushAnnounce(rv.dataset.rid); revFinish(rv);
    rv.querySelectorAll('[data-t]').forEach((el) => el.classList.add('go', 'stop'));
    const sr = rv.querySelector('[data-skill]'); if (sr) { sr.classList.remove('build'); sr.classList.add('boom-done'); skillSwap(sr); }
    rv.classList.remove('drama'); const mq = rv.closest('.modal'); if (mq) mq.classList.remove('quake');
  }
  function modalHtml() {
    const m = U.modal;
    if (!m) return '';
    const wrap = (title, body, foot, sm) => `<div class="scrim" data-act="scrim"><div class="modal${sm ? ' sm' : ''}" role="dialog" aria-modal="true" aria-label="${String(title).replace(/<[^>]+>/g, '')}">
      <div class="mhead"><span>${title}</span><button class="gbtn ibtn" data-act="close-modal" aria-label="닫기">${icon('cross')}</button></div>
      <div class="mbody">${body}</div><div class="mfoot">${foot}</div></div></div>`;

    if (m.type === 'mail') {
      const rep = Guild.lastReport;
      const absent = rep && rep.left.length
        ? `<div class="rep">${icon('people')}<div style="flex:1"><b>${rep.absentDays}일 만에 돌아오셨네요. ${Guild.ABSENCE_DAYS}일 이상 접속하지 않아 모험가 ${rep.left.length}명이 길드를 떠났어요: ${rep.left.map((c) => c.name).join(', ')}.</b><br><span class="muted" style="font-size:12px">모험가 명부의 이탈 탭에서 금화로 다시 데려올 수 있어요.</span></div>
          <button class="btn ghost sm" data-act="dismiss-report">확인</button></div>` : '';
      const reports = Guild.state.inbox.slice().reverse().map(reportHtml).join('');
      const foot = `${mailCount() > 1 ? '<button class="btn ghost" data-act="dismiss" data-id="">모두 확인</button>' : ''}<button class="btn" data-act="close-modal">닫기</button>`;
      return wrap('의뢰 보고', absent + reports || '<p class="empty">새 보고가 없어요.</p>', foot);
    }
    if (m.type === 'talk') {
      const c = byId(m.id);
      if (!c) return '';
      const left = Guild.talksLeft(m.id);
      const opts = m.typing ? '' : (m.opts || []).map((o, i) => `<button class="topt" data-act="talk-pick" data-q="${o.q}"><kbd>${i + 1}</kbd>${esc(o.text)}</button>`).join('') || '<p class="small muted" style="text-align:center;padding:6px">이번 교체 시간에는 더 이야기할 수 없어요. 다음 교체 때 다시 와 주세요.</p>';
      const msgs = (m.msgs && m.msgs.length ? m.msgs : [{ who: 'them', text: '무슨 일이세요, 마스터?' }]);
      const log = msgs.map((x) => `<div class="cm ${x.who}"><div class="cb">${esc(x.text)}</div></div>`).join('') + (m.typing ? '<div class="cm them"><div class="cb typing"><i></i><i></i><i></i></div></div>' : '');
      const fx = Combat.effectLines(c).filter((x) => !x.skill && !/ · /.test(x.name)).slice(0, 3);
      const info = `<div class="small" style="line-height:1.6">${Guild.rankLabel(c)}급 · Lv.${c.level}<br>${esc(clsOf(c))} · ${attrText(c)}${fx.length ? '<br>' + fx.map((x) => esc(x.name)).join(' · ') : ''}</div>`;
      return wrap(`${esc(c.name)} <small style="font-weight:500;color:var(--muted);margin-left:8px">남은 대화 ${left} / ${Guild.TALK_PER}</small>`, `<div class="talk"><div class="talk-face"><div class="lic-frame">${Art.character(c.appearance, { view: 'bust', label: c.name })}</div><div style="font-weight:700;margin-bottom:4px">${esc(c.name)}</div>${info}</div>
        <div class="talk-body"><div class="chat-log">${log}</div><div class="talk-opts">${opts}</div></div></div>`, `<button class="btn ghost" data-act="open-char" data-id="${c.id}">명부에서 보기</button><button class="btn" data-act="close-modal">대화 끝내기</button>`);
    }
    if (m.type === 'qlist') {
      const c = byId(m.cid); if (!c) return '';
      const hist = (c.history || []).slice().reverse();
      const rows = hist.length ? hist.map((h) => `<li><span class="chip qg">${h.g}</span><span class="ql-n">${esc(h.n)}</span><span class="ql-d">${dateText(h.t)}</span></li>`).join('') : `<li class="more">${c.quests ? `완수한 의뢰 ${c.quests}건 (이름은 기록되지 않았어요)` : '완수한 의뢰가 없어요'}</li>`;
      const more = c.quests > hist.length && hist.length ? `<li class="more">… 이전 기록 ${c.quests - hist.length}건은 이름이 남지 않았어요</li>` : '';
      return wrap(`${esc(c.name)}의 완수한 의뢰`, `<ul class="ql-list">${rows}${more}</ul>`, '<button class="btn" data-act="close-modal">닫기</button>', true);
    }
    if (m.type === 'qhist') {
      const c = byId(m.cid), h = c && c.history && c.history[m.i];
      if (!c || !h) return '';
      const body = `<div class="qh"><div class="qh-head"><span class="qgrade g-${h.g}">${h.g}</span><div><b>${esc(h.n)}</b><div class="sub">${h.g}급 의뢰 · 완수 ${dateText(h.t)}</div></div></div><p class="small muted" style="margin:0">${esc(c.name)}의 공적이에요.</p></div>`;
      return wrap('완수한 의뢰', body, '<button class="btn" data-act="close-modal">닫기</button>', true);
    }
    if (m.type === 'help') {
      return wrap('길드 안내', `<ul class="help-list">
        <li>모험가를 <b>주점</b>에서 모집하고 <b>출정</b>시켜 내보내 경험치와 금화를 얻어요.</li>
        <li>의뢰는 실제 시간이 지나야 끝나요. 접속하지 않은 동안에도 시간은 흘러요.</li>
        <li>의뢰 도중 <b>위기 신호</b>가 오면 제한 시간 안에 <b>후퇴</b>할지 <b>계속 싸울지</b> 정해요. 정하지 않으면 계속 싸워요.</li>
        <li>싸우다 쓰러지면 <b>영구 사망</b>이에요. 기록은 사망 명단과 연대기에 영원히 남아요.</li>
        <li>30일 넘게 접속하지 않으면 모험가가 한 명씩 떠나지만, 금화로 다시 데려올 수 있어요.</li>
        <li>모험가의 재능은 보이지 않아요. 키워 보면서 알게 돼요.</li></ul>`, '<button class="btn" data-act="close-modal">닫기</button>');
    }
    if (m.type === 'recruit') {
      const c = byId(m.id);
      if (!c) return '';
      return wrap('새 모험가가 합류했어요!', revealHtml(c), `<button class="btn ghost" data-act="close-modal">확인</button><button class="btn" data-act="open-char" data-id="${c.id}">명부에서 보기</button>`, false);
    }
    if (m.type === 'advance') {
      const c = byId(m.id);
      if (!c) return '';
      const opts = Character.advanceChoices(c).map((n) => {
        const d = DATA_CLASSES[n];
        const sk = d.skills.map((s) => `${s.kind === 'A' ? '[액티브]' : '[패시브]'} ${esc(s.name)}: ${esc(s.text)}`).join('<br>');
        return `<button class="item" data-act="advance-go" data-id="${c.id}" data-cls="${esc(n)}"><span class="grow"><span class="nm">${esc(n)}</span>${d.pref ? ` <span class="sub">선호 ${d.pref.join('/')}</span>` : ''}<br><span class="sub">${sk}</span></span>${icon('chev-r')}</button>`;
      }).join('');
      return wrap(`${c.name} 전직`, `<p class="muted" style="font-size:13px">현재 「${esc(c.path[c.path.length - 1])}」. 한 번 고르면 되돌릴 수 없어요.</p><div class="list" style="padding:0">${opts}</div>`, '<button class="btn ghost" data-act="close-modal">나중에</button>', true);
    }
    if (m.type === 'train') {
      const c = byId(m.id);
      if (!c) return '';
      const opts = Guild.TRAIN_OPTIONS.map((min) => {
        const pv = Guild.trainPreview(c, min);
        return `<button class="item" data-act="train-go" data-id="${c.id}" data-min="${min}"><span class="grow"><span class="nm">${minText(min)} 훈련</span><br><span class="sub">경험치 +${pv.exp} 예상 · 금화 ${pv.cost}</span></span>${icon('chev-r')}</button>`;
      }).join('');
      return wrap(`${c.name} 훈련`, `<p class="muted" style="font-size:13px">훈련은 목숨의 위험이 없어요. 시간이 지나면 경험치를 얻어요.<br>훈련장 ${Guild.trainees().length} / ${Guild.trainSlots()}명 사용 중</p><div class="list" style="padding:0">${opts}</div>`, '<button class="btn ghost" data-act="close-modal">닫기</button>', true);
    }
    if (m.type === 'confirm') {
      return wrap(m.title || '확인', `<p>${m.text}</p>`, `<button class="btn ghost" data-act="close-modal">${m.no || '취소'}</button><button class="btn danger" data-act="confirm-yes">${m.yes || '확인'}</button>`, true);
    }
    // settings
    return wrap('설정 / 개발 도구', `<h3>화면 방식</h3><div class="pills">${[['auto', '자동'], ['pc', 'PC'], ['mobile', '모바일(세로)']].map(([k, l]) => `<button class="pill" aria-selected="${layoutPref() === k}" data-act="set-layout" data-k="${k}">${l}</button>`).join('')}</div><h3>길드</h3><div class="form-row"><input type="text" id="in-name" maxlength="8" value="${esc(Guild.state.guildName)}" aria-label="길드 이름"><button class="btn sm" data-act="rename">이름 바꾸기</button></div><p class="small muted" style="margin:-4px 0 8px">이름을 바꾸면 명성이 50% 떨어져요.</p>
      <div class="form-row"><span class="small muted">${esc((authGet() || {}).email || '게스트(임시 입장)')}</span><button class="btn ghost sm" data-act="logout">로그아웃</button></div>
      <h3>개발 도구 (테스트용)</h3>
      <div class="form-row"><label><input type="checkbox" data-act="dev-boost"${U.boost ? ' checked' : ''}> 고유스킬 확률 ×100,000</label></div>
      <div class="form-row"><button class="btn ghost sm" data-act="dev-ticket">초기화권 +1 (보유 ${Guild.resetTickets()})</button><button class="btn ghost sm" data-act="dev-tutorial">튜토리얼 다시</button></div>
      <div class="form-row"><label><input type="checkbox" data-act="dev-skill"${U.forceSkill ? ' checked' : ''}> 채용하면 고유스킬 무조건 획득</label></div>
      <div class="form-row"><label><input type="checkbox" data-act="dev-talent"${U.showTalent ? ' checked' : ''}> 재능 수치 보기</label></div>
      <div class="form-row"><label for="in-skip">시간 빨리감기(분)</label><input type="number" id="in-skip" min="1" max="100000" value="10"><button class="btn ghost sm" data-act="dev-skip">보내기</button></div>
      <div class="form-row"><label for="in-abs">미접속 일수</label><input type="number" id="in-abs" min="1" max="3650" value="30"><button class="btn ghost sm" data-act="dev-absence">적용</button></div>
      <div class="form-row"><button class="btn ghost sm" data-act="dev-lv" data-lv="30">선택 Lv30</button><button class="btn ghost sm" data-act="dev-lv" data-lv="60">Lv60</button><button class="btn ghost sm" data-act="dev-lv" data-lv="90">Lv90</button><button class="btn ghost sm" data-act="dev-gold">금화 +100</button><button class="btn ghost sm" data-act="dev-applicants">지원자 새로고침</button><button class="btn ghost sm" data-act="dev-ten">10명 영입</button><button class="btn danger sm" data-act="dev-reset">저장 데이터 삭제</button></div>
      <p class="muted" style="font-size:12px" id="save-note"></p>`, '<button class="btn" data-act="close-modal">닫기</button>');
  }

  /* ============================================================
     그리기
     ============================================================ */

  /* ============================================================
     튜토리얼 (건너뛸 수 없다)
     카드 단계는 [다음]을 눌러야 넘어가고, 행동 단계는 조건이 채워지면 저절로 넘어간다.
     행동 단계에서는 안내에 없는 버튼이 막히고, 눌러야 할 버튼이 반짝인다.
     ============================================================ */
  const chars2 = () => Guild.state.characters.filter((c) => c.status === 'ACTIVE').length;
  const TUT = [
    { card: true, t: '길드에 오신 걸 환영해요', x: '당신은 작은 길드의 마스터예요.<br>개성 있는 모험가를 맞이하고 정성껏 키우는 게임이에요.<br>의뢰와 전투는 그 수단일 뿐이에요.<br><br><b>체력이 0이 된 모험가는 영원히 돌아오지 않아요.</b><br>잃은 사람은 되살릴 수 없으니, 누구를 어디로 보낼지 신중하게 정해요.', btn: '시작하기' },
    { t: '모험가를 맞이해요', x: '모험가는 <b>주점</b>에서 만나요.<br>위쪽 <b>주점</b> 탭(숫자 키 <b>4</b>)을 눌러 보세요.<br>▸ 지원자는 시간이 지나면 새로 찾아와요.<br>▸ 놓친 지원자는 다시 오지 않을 수도 있어요.', hl: ['#tabs .tab[data-screen="recruit"]'], allow: { goto: ['recruit'], acts: [] }, done: () => U.screen === 'recruit' },
    { t: '이야기를 들어봐요', x: '지원자가 자기 이야기를 들려줘요. <b>아래 대사창</b>을 눌러 끝까지 들어 봐요.<br>▸ 출신지·말투·사연에 그 사람의 <b>성격</b>이 묻어나요.<br>▸ 오른쪽 위 <b>면접 메모</b>에 들은 이야기가 쌓여요.<br>▸ 마지막에 <b>색이 다른 한 줄</b>이 나오면 숨은 재능을 암시하는 <b>힌트</b>예요.', hl: ['.rcp-dlg', '.rcp-memo'], allow: { goto: ['recruit'], acts: ['rec-next', 'app-sel'] }, done: () => { const a = Guild.applicants[0]; if (!a) return false; const n = a.story.length + (a.hint ? 1 : 0); return (U.recLine || 0) >= n - 1; } },
    { next: true, t: '채용 전에 확인해요', x: '<b>채용 점검</b> (왼쪽 아래)<br>▸ <b>금화</b>와 <b>기숙사 자리</b>가 모두 충족돼야 채용할 수 있어요.<br><b>지원서</b> (오른쪽 아래)<br>▸ 이름, 기본 직업, 접수처에 <b>머무는 시간</b>이 적혀 있어요.<br>▸ 시간이 지나면 떠나니, 마음에 들면 서둘러요.', hl: ['.rcp-pad'], allow: { goto: ['recruit'], acts: [] } },
    { t: '첫 모험가를 채용해요', x: '한 명을 골라 <b>채용</b>을 눌러요. (금화 100)<br>▸ 어떤 사람인지는 채용해야 알 수 있어요.<br>▸ 모험가는 저마다 <b>성격과 재능</b>이 달라서 같은 사람이 없어요.<br>▸ 마음에 들지 않으면 <b>돌려보내기</b>로 다른 지원자를 기다려요.', hl: ['[data-act="hire"]', '[data-act="app-sel"]', '[data-act="app-dismiss"]'], allow: { goto: ['recruit'], acts: ['app-sel', 'hire', 'app-dismiss'] }, done: () => chars2() >= 1 },
    { at: 4, t: '채용 연출을 기다려요', noClose: true, x: '채용하면 모험가의 정보가 <b>슬롯머신</b>처럼 하나씩 공개돼요.<br>▸ 희귀도 → 직업 → 속성 → 고유스킬 → 특성 → 능력치 순서예요.<br>▸ 끝까지 지켜보거나, 화면을 눌러 바로 결과로 넘어가도 돼요.', hl: ['.reveal'], allow: { goto: [], acts: [] }, done: () => !U.modal || U.revFin === U.modal.id },
    { next: true, at: 4, noClose: true, t: '공개된 정보 읽는 법 ①', x: '<b>왼쪽</b>은 이름과 얼굴이에요. 같은 모험가는 한 명도 없어요.<br><b>오른쪽 · 정해진 정보</b><br>▸ <b>희귀도</b>: 높을수록 잠재력이 커요.<br>▸ <b>직업 · 속성</b>: 싸우는 방식과 약점이 정해져요.<br>▸ <b>고유스킬</b>: <b>있음</b>이면 이 모험가만 가진 특별한 스킬이에요.<br>▸ <b>특성</b>: 타고난 성격이에요. 나중에 얻을 수는 없어요.', hl: ['.rv-left', '.rv-right .rv-row'], allow: { goto: [], acts: [] } },
    { next: true, at: 4, noClose: true, t: '공개된 정보 읽는 법 ②', x: '<b>능력치</b><br>▸ 체력·공격·방어·운·속도예요. 막대가 길수록 그 분야가 뛰어나요.<br>▸ 레벨이 오르면 함께 자라요.<br>▸ 스킬과 장비의 효과도 여기에 반영돼 있어요.', hl: ['.rv-stats'], allow: { goto: [], acts: [] } },
    { t: '합류를 확인해요', x: '이제 아래 <b>확인</b>을 눌러 닫아요.<br>▸ <b>명부에서 보기</b>를 누르면 이 모험가의 상세 정보를 바로 볼 수 있어요.', hl: ['.modal .mfoot .btn.ghost'], allow: { goto: ['recruit'], acts: ['close-modal'] }, done: () => !U.modal },
    { card: true, t: '길드의 작은 지원', x: '첫 의뢰를 위해 길드가 작은 선물을 준비했어요.<br>▸ <b>Lv.3</b>으로 시작해요.<br>▸ 몬스터가 약하고 늘 안전한 <b>연습 의뢰</b>를 하나 걸어 뒀어요.<br>(튜토리얼에서만 주는 선물이에요)<br><br>평소에는 <b>모험가 › 훈련장</b>에서 시간을 들여 키워요.', btn: '고마워요', onNext: () => { Guild.state.characters.filter((c) => c.status === 'ACTIVE').slice(0, 1).forEach((c) => { if (c.level < 3) Guild.devSetLevel(c.id, 3); }); Guild.addTutorialContract(); U.contract = null; U.tutPicked = false; } },
    { t: '의뢰판으로 가요', x: '이제 일을 맡길 차례예요.<br>위쪽 <b>원정</b> 탭(숫자 키 <b>2</b>)을 눌러 <b>의뢰 게시판</b>으로 가요.<br>▸ 게시판에는 마을 사람들의 의뢰가 걸려요.<br>▸ 의뢰마다 <b>마감 시간</b>이 있어요.', hl: ['#tabs [data-screen="quests"]'], allow: { goto: ['quests'] }, done: () => U.screen === 'quests' },
    { next: true, at: 520, t: '의뢰지 읽는 법', x: '종이 한 장이 의뢰 하나예요.<br>▸ <b>동그란 글자</b>: 등급 (F가 가장 쉬워요)<br>▸ <b>이름·종류·필요 인원</b>: 무엇을 몇 명이 하는지<br>▸ <b>금화·경험치</b>: 보상<br>▸ <b>명성</b>: 클리어하면 오르고(+), 사망·전멸하면 내려가요(−)<br>▸ <b>위험도 칩</b>: 파티를 정하면 나타나요<br>▸ <b>마감 시간</b>: 지나면 사라지고 새 의뢰로 채워져요', hl: ['.cork'], allow: { goto: ['quests'], acts: [] } },
    { t: '의뢰를 골라요', x: '<b>연습 의뢰</b> 종이를 눌러 선택해요.<br>▸ <b>의뢰 상세</b>와 <b>원정대 편성</b> 화면이 열려요.', xm: '<b>연습 의뢰</b> 종이를 눌러 선택해요.<br>▸ 편성 화면이 열려요. 위쪽에 <b>의뢰 상세</b>, 아래에 <b>원정대 편성</b> 칸이 있어요.', hl: ['.qnote'], allow: { goto: ['quests'], acts: ['quest-sel'] }, done: () => !!U.tutPicked || Guild.missions.length >= 1 },
    { next: true, t: '편성 화면 읽는 법', xm: '<b>위 · 의뢰 상세</b><br>▸ 보상, 명성 변화, <b>출정 준비</b> 점검표예요. 빨간 줄은 부족한 조건이에요.<br><b>가운데 · 원정대 편성</b><br>▸ 칩으로 몬스터·인원·<b>위험도</b>를 봐요. 둥근 칸에 모험가를 넣어요.<br><b>아래 · 대기 모험가</b><br>▸ 눌러서 파티에 넣고 빼요.', x: '<b>왼쪽 · 의뢰 상세</b><br>▸ 보상, 명성 변화, <b>출정 준비</b> 점검표예요. 빨간 줄은 부족한 조건이에요.<br><b>가운데 · 원정대 편성</b><br>▸ 칩으로 몬스터·인원·<b>위험도</b>를 봐요. 위험도는 위기를 맞을 가능성이에요.<br>▸ 둥근 칸에 모험가를 넣어요.<br><b>오른쪽 · 대기 모험가</b><br>▸ 쉬는 모험가 목록이에요. 눌러서 파티에 넣고 빼요.<br>▸ 추천순·레벨·직업으로 정렬해요.', hl: ['.qpaper', '.cpanel', '.pscreen .dpanel'], allow: { goto: ['quests'], acts: [] } },
    { t: '파티를 꾸려 출발해요', x: '<b>자동 편성</b>을 누른 뒤 <b>출정!</b>을 눌러요.<br>▸ 위험도 칩이 이 파티가 위기를 맞을 가능성을 알려 줘요.<br>▸ 연습 의뢰는 언제나 <b>안전</b>이에요.<br>▸ 의뢰마다 필요한 인원이 달라요.', hl: ['[data-act="recommend"]', '[data-act="dispatch"]'], allow: { goto: ['quests'], acts: ['quest-sel', 'party-toggle', 'recommend', 'clear-party', 'dispatch', 'cand-sort', 'confirm-yes'] }, done: () => Guild.missions.length >= 1 },
    { t: '전투를 지켜봐요', x: '파티가 길드를 떠났어요!<br>위쪽 <b>원정 중</b> 칩을 눌러 <b>전투 보기</b>로 가 봐요.<br>▸ 모험가들이 싸우며 주고받는 말도 이 게임의 재미예요.', xm: '파티가 길드를 떠났어요!<br><b>원정</b> 탭 → 윗줄 <b>원정 현황</b>에서 <b>전투 보기</b>로 가 봐요.<br>▸ 모험가들이 싸우며 주고받는 말도 이 게임의 재미예요.', hl: () => (isMobile ? [...navPath('active'), '[data-act="view-battle"]'] : ['.strip [data-screen="active"]', '[data-act="view-battle"]']), allow: { goto: ['quests', 'active'], acts: ['view-battle'] }, done: () => U.screen === 'battle' },
    { next: true, at: 300, t: '전투 화면 읽는 법 ①', x: '<b>위쪽</b><br>▸ 의뢰 이름, 전투 경과 시간, 남은 몬스터 수<br>▸ <b>우리 편이 이길 확률</b>은 실시간으로 바뀌어요.<br><b>왼쪽 위 · 행동 순서</b><br>▸ 다음에 누가 움직이는지 알려줘요.', hl: ['.b-top', '.b-order'], allow: { goto: [], acts: [] } },
    { next: true, t: '전투 화면 읽는 법 ②', x: '<b>왼쪽은 우리 모험가, 오른쪽은 몬스터</b>예요.<br>▸ 초록 막대는 <b>체력(HP)</b>이에요. 크게 줄면 <b>위기</b>, <b>0이 되면 즉시 사망</b>해요.<br><b>아래쪽</b><br>▸ <b>전투 기록</b>: 일어난 일이 글로 남아요.<br>▸ <b>승률 그래프</b>: 승률이 어떻게 출렁였는지 보여줘요.', hl: ['.b-party', '.b-enemies', '.b-log', '.b-bottom'], allow: { goto: [], acts: [] } },
    { card: true, t: '전투는 실시간이에요', x: '전투 시간은 실제 시간과 같이 흘러요.<br>▸ <b>얼마나 걸릴지는 아무도 몰라요.</b> (대개 몇 분)<br>▸ 접속을 끊어도 전투는 계속돼요.<br><br>싸우다 <b>위기</b>가 오면 전투가 멈추고 결정 시간이 주어져요.<br>▸ <b>계속 싸운다</b> / <b>전체 후퇴</b> 중에 골라요.<br>▸ 시간 안에 정하지 않으면 계속 싸워요.<br>▸ 체력이 0이 되면 <b>그 즉시 사망</b>해요.', btn: '알겠어요' },
    { t: '결과를 기다려요', x: '전투가 끝나면 <b>귀환 보고</b>가 도착해요.<br>▸ 기다리는 동안 명부나 장터를 둘러봐도 돼요.<br>▸ 앞으로는 위기 신호가 오면 직접 판단해야 해요.<br>▸ 이번 연습 의뢰는 안전하니 마음 편히 기다려요.', allow: null, done: () => mailCount() >= 1 },
    { t: '결과를 확인해요', xm: '위쪽 <b>원정</b> 탭 → <b>귀환 보고</b>로 가서 <b>확인</b>해요.<br>▸ <b>경험치</b>: 모험가가 성장해요.<br>▸ <b>재료</b>: 장비의 원료가 돼요.<br>▸ <b>명성</b>: 길드를 키워 줘요.<br>▸ 모험가의 <b>등급 점수</b>도 쌓여요.', x: '위쪽 <b>귀환 보고</b> 칩을 눌러 <b>확인</b>해요.<br>▸ <b>경험치</b>: 모험가가 성장해요.<br>▸ <b>재료</b>: 장비의 원료가 돼요.<br>▸ <b>명성</b>: 길드를 키워 줘요.<br>▸ 모험가의 <b>등급 점수</b>도 쌓여요.', hl: () => (isMobile ? [...navPath('results'), '[data-act="dismiss"]', '[data-act="dismiss-all"]'] : ['.strip [data-screen="results"]', '[data-act="dismiss"]', '[data-act="dismiss-all"]']), allow: { goto: ['quests', 'results', 'active'], acts: ['dismiss', 'dismiss-all', 'close-modal'] }, done: () => mailCount() === 0 },
    { card: true, t: '이제 길드를 키워 봐요', x: '의뢰로 <b>명성</b>을 모아 길드를 승급하면 시설과 의뢰가 넓어져요.<br><br>▸ 드롭 재료는 <b>장터 › 보급고</b>에서 사 둬요.<br>▸ <b>대장간</b>에서 장비로 만들어요.<br>▸ <b>진열</b>에 적정가로 올리면 모험가가 사 가요.<br>▸ 몬스터 약점은 <b>도감</b>에 쌓여요.<br><br>모험가를 잃어도 그 이름은 <b>연대기</b>에 남아요. 건투를 빌어요!', btn: '길드 운영 시작', onNext: () => { Guild.state.gold += 100; } },
  ];
  // 마지막 단계를 지난 저장(이전 버전의 버그로 단계만 올라간 경우)은 튜토리얼을 마친 것으로 본다
  const tutStep = () => (Guild.tutorialActive() ? TUT[Math.min(Guild.tutorialStep(), TUT.length - 1)] : null);
  // 조건이 채워진 행동 단계는 넘긴다 (카드 단계는 버튼을 눌러야 한다)
  function tutAdvance() {
    let guard = 0;
    while (Guild.tutorialActive() && guard++ < 20) {
      const s = TUT[Guild.tutorialStep()];
      if (!s || s.card || s.next || !s.done || !s.done()) break;
      Guild.setTutorial(Guild.tutorialStep() + 1);
    }
  }
  function tutAllowed(el) {
    const s = tutStep();
    if (!s) return true;
    const a = el.dataset.act;
    if (['coach-next', 'scrim', 'dev-tutorial', 'save', 'rec-next'].includes(a)) return true;
    if (s.allow === null) return true;
    if (a === 'modal') return true;
    if (a === 'close-modal' || a === 'confirm-yes') return !s.card && !s.noClose;
    const al = s.allow || { goto: [], acts: [] };
    if (a === 'goto') return (al.goto || []).includes(el.dataset.screen);
    return (al.acts || []).includes(a);
  }
  // 줄 단위로 나눠 보여 주고, ▸ 줄은 내어쓰기로 정렬한다
  const mtext = (x) => (isMobile ? x.replace(/위쪽/g, '아래쪽').replace(/<b>왼쪽은 우리 모험가, 오른쪽은 몬스터<\/b>예요/, '<b>아래는 우리 모험가, 위는 몬스터</b>예요').replace('왼쪽 위 · 행동 순서', '맨 위 · 행동 순서').replace('<b>왼쪽</b>은 이름과 얼굴이에요', '<b>위쪽</b>은 이름과 얼굴이에요').replace('<b>오른쪽 · 정해진 정보</b>', '<b>아래쪽 · 정해진 정보</b>').replace(/\(숫자 키 <b>\d<\/b>\)/g, '').replace(/ ?\(숫자 키 \d\)/g, '') : x);
  const fmtX = (x) => mtext(x).split('<br>').map((l) => (l ? `<div class="ln${l.startsWith('▸') ? ' b' : ''}">${l}</div>` : '<div class="gap"></div>')).join('');
  function coachHtml() {
    const s = tutStep();
    if (!s) return '';
    const n = Guild.tutorialStep() + 1, total = TUT.length;
    if (s.card) return `<div class="coach-scrim"><div class="coach-card"><div class="cstep">튜토리얼 ${n} / ${total}</div><h2>${s.t}</h2><p>${s.x}</p><button class="btn" data-act="coach-next">${s.btn}</button></div></div>`;
    return `<div class="coach-bar"><span class="cstep">튜토리얼 ${n} / ${total}</span><b>${s.t}</b><span>${s.x}</span></div>`;
  }
  // 튜토리얼: 대상만 밝게 두고 나머지는 어둡게 (SVG 마스크 구멍). 클릭은 그대로 통과한다.
  let dimSig = '';
  // 대상 요소와 그 안에서 삐져나온 자식(이름표 등)까지 합친 영역
  function unionRect(el) {
    const r = el.getBoundingClientRect();
    if (el.matches('.reveal')) return { left: r.left, top: r.top, width: r.width, height: r.height };
    let l = r.left, t = r.top, rt = r.right, bt = r.bottom;
    el.querySelectorAll('*').forEach((c) => { if (c.matches('.rv-reel, .rv-reel *, .rv-rays, .rv-ring, .rv-flash, .confetti, .confetti *, .fx-burst, .fx-burst *')) return; const q = c.getBoundingClientRect(); if (q.width < 1 || q.height < 1) return; l = Math.min(l, q.left); t = Math.min(t, q.top); rt = Math.max(rt, q.right); bt = Math.max(bt, q.bottom); });
    return { left: l, top: t, width: rt - l, height: bt - t };
  }
  function drawDim() {
    const s = tutStep();
    let d = document.getElementById('tutdim');
    const hl = s && !s.card && s.hl ? (typeof s.hl === 'function' ? s.hl() : s.hl) : null;
    if (!hl) { if (d) d.remove(); dimSig = ''; return; }
    const SW = isMobile ? 540 : 1760, SH = isMobile ? $('stage').offsetHeight : 990;
    const st = $('stage').getBoundingClientRect(), k = st.width / SW;
    const rs = [];
    hl.forEach((q) => document.querySelectorAll(q).forEach((el) => {
      const r = unionRect(el);
      if (r.width < 2 || r.height < 2) return;
      rs.push({ x: (r.left - st.left) / k - 6, y: (r.top - st.top) / k - 6, w: r.width / k + 12, h: r.height / k + 12 });
    }));
    if (isMobile && rs.length > 1) { // 모바일: 겹치거나 맞닿은 칸은 하나의 큰 박스로 합친다
      let again = true;
      while (again) {
        again = false;
        for (let i = 0; i < rs.length && !again; i++) for (let j = i + 1; j < rs.length && !again; j++) {
          const a = rs[i], b = rs[j];
          if (a.x <= b.x + b.w + 8 && b.x <= a.x + a.w + 8 && a.y <= b.y + b.h + 8 && b.y <= a.y + a.h + 8) {
            const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
            rs[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
            rs.splice(j, 1); again = true;
          }
        }
      }
    }
    const sig = rs.map((r) => [r.x, r.y, r.w, r.h].map(Math.round).join(',')).join('|');
    if (d && sig === dimSig) return;
    dimSig = sig;
    if (d && d.querySelectorAll('.td-ring').length === rs.length) { // 같은 개수면 위치만 갱신 (깜빡임 방지)
      const holes = d.querySelectorAll('#tdm rect:not(:first-child)'), rings = d.querySelectorAll('.td-ring');
      rs.forEach((r, i) => [holes[i], rings[i]].forEach((e) => { e.setAttribute('x', r.x); e.setAttribute('y', r.y); e.setAttribute('width', r.w); e.setAttribute('height', r.h); }));
      return;
    }
    const holes = rs.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="#000"/>`).join('');
    const rings = rs.map((r) => `<rect class="td-ring" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10"/>`).join('');
    const html = `<svg viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none"><defs><mask id="tdm"><rect width="${SW}" height="${SH}" fill="#fff"/>${holes}</mask></defs><rect width="${SW}" height="${SH}" fill="rgba(3,5,12,.74)" mask="url(#tdm)"/>${rings}</svg>`;
    if (!d) { d = document.createElement('div'); d.id = 'tutdim'; $('stage').insertBefore(d, $('coach')); }
    d.innerHTML = html;
  }
  function tutHighlight() { drawDim(); }
  setInterval(() => { if (!document.hidden && Guild.tutorialActive()) drawDim(); }, 300);
  window.addEventListener('resize', () => { dimSig = ''; drawDim(); });
  function coachHtml() {
    const s = tutStep();
    if (!s) return '';
    const n = Guild.tutorialStep() + 1, total = TUT.length, fresh = U.tutShown !== n;
    const cls = fresh ? ' coach-in' : '';
    if (s.card) return `<div class="coach-scrim"><div class="coach-card${cls}"><div class="cstep">튜토리얼 ${n} / ${total}</div><h2>${s.t}</h2><div class="coach-x">${fmtX(isMobile && s.xm ? s.xm : s.x)}</div><button class="btn coach-btn" data-act="coach-next">${s.btn}</button></div></div>`;
    return `<div class="coach-bar${cls}"${s.at ? ` style="top:${s.at}px"` : ''}><div class="cb-top"><span class="cstep">튜토리얼 ${n} / ${total}</span><b>${s.t}</b>${s.next ? '<button class="btn sm coach-btn" data-act="coach-next">다음 ▶</button>' : ''}</div><div class="coach-x">${fmtX(isMobile && s.xm ? s.xm : s.x)}</div>${s.next ? '<div class="hint">버튼이나 화면의 빈 곳을 눌러도 넘어가요</div>' : ''}</div>`;
  }
  // 설명 글자가 한 글자씩 튀어나오는 연출. 단계가 바뀔 때만 재생한다.
  let typeTimer = null, typeDone = null;
  function finishType() { if (typeDone) typeDone(); }
  // 글자가 채워지는 연출. 아직 안 나온 글자는 보이지 않을 뿐 자리는 차지해서 상자 크기가 변하지 않는다.
  function typeFill(root, perTick, ms, onEnd) {
    const nodes = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) nodes.push(w.currentNode);
    const parts = nodes.map((n) => {
      const t = n.nodeValue, a = document.createElement('span'), b = document.createElement('span');
      b.style.visibility = 'hidden'; b.textContent = t; n.parentNode.replaceChild(a, n); a.after(b);
      return { a, b, t };
    });
    const total = parts.reduce((x, o) => x + o.t.length, 0);
    let shown = 0, timer = null, ended = false;
    const paint = () => { let left = shown; parts.forEach((o) => { const take = Math.max(0, Math.min(o.t.length, left)); o.a.textContent = o.t.slice(0, take); o.b.textContent = o.t.slice(take); left -= take; }); };
    const finish = () => { if (ended) return; ended = true; clearInterval(timer); shown = total; paint(); root.classList.remove('typing'); if (onEnd) onEnd(); };
    paint(); root.classList.add('typing');
    timer = setInterval(() => { shown += perTick; paint(); if (shown >= total) finish(); }, ms);
    return finish;
  }
  function tutType() {
    const n = Guild.tutorialStep() + 1;
    if (!Guild.tutorialActive() || U.tutShown === n) return;
    U.tutShown = n;
    typeDone = null;
    const host = document.querySelector('#coach .coach-x');
    if (!host) return;
    const btn = document.querySelector('#coach .coach-btn'); if (btn) btn.classList.add('wait');
    typeDone = typeFill(host, 2, 22, () => { typeDone = null; if (btn) btn.classList.remove('wait'); });
  }
  // 영입 면접: 새 대사와 메모 줄이 한 글자씩 채워진다
  let recDone = null;
  function recType() {
    const key = U.applicant + ':' + (U.recLine || 0);
    if (!U.applicant || U.recTyped === key) return;
    U.recTyped = key;
    const tx = document.querySelector('.rcp-dlg .tx'), cur = document.querySelector('.rcp-memo p.cur');
    if (!tx) return;
    const f1 = typeFill(tx, 1, 28), f2 = cur ? typeFill(cur, 1, 28) : null;
    recDone = () => { f1(); if (f2) f2(); recDone = null; };
    const t = setInterval(() => { if (!tx.classList.contains('typing')) { clearInterval(t); recDone = null; } }, 60);
  }

  let lastSig = '';
  function render() {
    tutAdvance();
    // 새 보고가 오면 우편함을 자동으로 연다
    const mc = mailCount();
    if (mc > U.seenMail) {
      const fresh = Guild.state.inbox.slice(-(mc - U.seenMail));
      const died = fresh.some((r) => r.members.some((x) => x.fate === 'dead'));
      toast(died ? '의뢰 결과가 도착했어요. 슬픈 소식이 있어요.' : '의뢰 결과가 도착했어요. (위쪽 결과 칩)');
    }
    U.seenMail = mc;
    { const an = Guild.takeAchNew(); if (an.length) toast(an.length > 2 ? `공적 ${an.length}개 달성: ${an.slice(0, 2).join(', ')} 외 ${an.length - 2}개` : '공적 달성: ' + an.join(', ')); }

    // 목록 스크롤 위치 보존
    const keep = {};
    document.querySelectorAll('[data-keep]').forEach((el) => { keep[el.dataset.keep] = el.scrollTop; });

    const scrChanged = U.lastScr !== U.screen;
    if (scrChanged && U.screen === 'quests') U.slotScreenFresh = true;
    const body = { hub: hubHtml, roster: rosterHtml, quests: questsHtml, active: activeHtml, results: resultsHtml, battle: battleHtml, chronicle: chronicleHtml, guild: guildHtml, recruit: recruitHtml, dojo: dojoHtml, shop: shopHtml, workshop: workshopHtml, warehouse: warehouseHtml, codex: codexHtml, achv: achvHtml, memorial: memorialHtml }[U.screen]();
    if (!scrChanged) $('screen').classList.remove('scr-in');
    $('screen').innerHTML = body;
    if (scrChanged) { U.lastScr = U.screen; const s = $('screen'); s.classList.remove('scr-in'); void s.offsetWidth; s.classList.add('scr-in'); s.querySelectorAll('.list > *, .mrow, .tile, .tl-item, .qrow, .kv, .rd-box, .item, .rcard, .arow, .fac, .mcard').forEach((el, i) => el.style.setProperty('--si', Math.min(i, 12))); }
    U.prevParty = U.party.slice();
    $('tabs').innerHTML = topbarHtml();
    goldFx();
    $('screen').style.top = isMobile ? (curCat().subs.length > 1 ? '100px' : '56px') : (curCat().subs.length > 1 ? '78px' : '44px');
    { const rv = $('overlay').querySelector('.reveal'); // 공개 연출 중에는 창을 다시 그리지 않는다 (연출이 처음부터 재생되지 않도록)
      if (!(rv && U.modal && U.modal.type === 'recruit' && rv.dataset.rid === String(U.modal.id))) $('overlay').innerHTML = modalHtml(); }
    startReveal();
    { const sc = $('overlay').querySelector('.scrim'); if (sc && !U.modalWas) sc.classList.add('in'); U.modalWas = !!sc; }
    $('coach').innerHTML = coachHtml();
    tutHighlight();
    tutType();
    recType();
    document.querySelectorAll('[data-keep]').forEach((el) => { if (keep[el.dataset.keep] != null) el.scrollTop = keep[el.dataset.keep]; });
    { const cl = document.querySelector('.chat-log'); if (cl) cl.scrollTop = cl.scrollHeight; }
    const first = $('overlay').querySelector('.btn:not(.ghost), .btn');
    if (first && U.modal) first.focus({ preventScroll: true });

    const alerts = alertCount();
    document.title = (alerts ? '(!) ' : '') + '모험가 길드';
    lastSig = signature();
    updateLive();
  }

  // 상태가 바뀔 때만 다시 그리고, 그 사이에는 남은 시간과 진행 막대만 갱신한다
  function signature() {
    return actives().map((c) => c.id + ':' + statusOf(c).state).join('|') + '#' + Guild.missions.map((m) => m.id + ':' + Guild.missionInfo(m).state + ':' + m.battle.m.filter((x) => x.state === 'fit').length).join('|') +
      '#' + advanceCount() + '#' + battleSig() + '#' + Guild.board.map((k) => k.id).join(',') + '#' + Guild.applicants.map((a) => a.id).join(',') + '#' + mailCount() + '#' + Guild.state.characters.length + '#' + Guild.tutorialStep() + U.screen;
  }
  // 전투 화면에서 그림이 바뀌어야 하는 변화(몬스터 수, 파티원 상태)만 서명에 넣는다. 체력 막대는 updateLive가 갱신한다.
  function battleSig() {
    if (U.screen !== 'battle') return '';
    const m = Guild.missionById(U.battle);
    if (!m) return '';
    const v = Guild.battleView(m);
    return Math.min(5, v.alive) + ':' + v.heroes.map((h) => h.state).join(',') + ':' + m.phase;
  }
  function updateBattleLive() {
    const t = Guild.now();
    document.querySelectorAll('[data-bclock]').forEach((el) => { const m = Guild.missionById(el.dataset.bclock); if (m) el.textContent = mmss(Guild.battleClock(m)); });
    document.querySelectorAll('[data-bhp]').forEach((el) => { const m = Guild.missionById(el.dataset.bhp); if (m) el.style.width = Math.round((1 - Guild.battleView(m).monHpRatio) * 100) + '%'; });
    document.querySelectorAll('[data-balive]').forEach((el) => { const m = Guild.missionById(el.dataset.balive); if (m) el.textContent = Guild.battleView(m).alive; });
    if (U.screen !== 'battle') return;
    const m = Guild.missionById(U.battle);
    if (!m) return;
    const v = Guild.battleView(m);
    // 다음 웨이브가 나오는 등 보여 줄 몬스터가 바뀌면 화면을 다시 그린다
    { const have = [...document.querySelectorAll('.b-mon')].map((el) => el.dataset.midx); if (shownMonsOf(v).some((x) => !have.includes(String(x.idx)))) { render(); return; } }
    v.heroes.forEach((h) => {
      const bar = document.querySelector(`[data-hbar="${h.id}"] i`), tx = document.querySelector(`[data-htxt="${h.id}"]`);
      if (bar) bar.style.width = Math.max(h.state === 'fit' ? 2 : 0, Math.round((h.hp / h.hpMax) * 100)) + '%';
      if (tx) tx.textContent = h.state === 'down' ? '사망' : `HP ${h.hp}/${h.hpMax}`;
    });
    document.querySelectorAll('[data-mbar] i').forEach((el) => { const mm = v.mons[Number(el.parentElement.dataset.mbar)]; if (mm) el.style.width = Math.max(mm.alive ? 2 : 0, Math.round(mm.r * 100)) + '%'; });
    const f = document.querySelector('[data-bfeed]');
    if (f) { const h = v.feed.map((x) => `<div class="${x.bad ? 'bad' : x.good ? 'good' : ''}">${esc(x.text)}</div>`).join('') || '<div class="muted">전투가 막 시작됐어요.</div>'; if (f.dataset.h !== h) { f.dataset.h = h; f.innerHTML = h; } }
  }
  function updateLive() {
    updateBattleLive();
    const t = Guild.now();
    document.querySelectorAll('[data-eta]').forEach((el) => { el.textContent = clock(Number(el.dataset.eta) - t); });
    document.querySelectorAll('[data-eta-left]').forEach((el) => { el.textContent = leftText(Number(el.dataset.etaLeft) - t); });
    document.querySelectorAll('[data-prog-start]').forEach((el) => {
      const a = Number(el.dataset.progStart), b = Number(el.dataset.progEnd);
      el.style.width = Math.max(0, Math.min(100, ((t - a) / (b - a)) * 100)) + '%';
    });
  }
  setInterval(() => { if (!document.querySelector('#overlay .reveal')) Guild.flushAnnounce(null, 800); }, 1000);
  setInterval(() => {
    const changed = Guild.tick();
    if (document.hidden) return; // 안 보이는 탭에서는 그리지 않는다 (시간은 실제 시계로 계산되므로 문제 없다)
    if (changed || signature() !== lastSig) render(); else updateLive();
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  let toastT;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }
  // 화면 방식: PC(가로 1760×990) / 모바일(세로 540×1170). 자동 판별, 주소에 ?m=1(모바일) ?m=0(PC)로 강제, 설정에서도 바꿀 수 있다.
  const LAYOUT_KEY = 'guild_layout';
  function layoutPref() {
    try { const q = new URLSearchParams(location.search).get('m'); if (q === '1' || q === '0') { localStorage.setItem(LAYOUT_KEY, q === '1' ? 'mobile' : 'pc'); } } catch (e) { /* 무시 */ }
    try { return localStorage.getItem(LAYOUT_KEY) || 'auto'; } catch (e) { return 'auto'; }
  }
  const wantMobile = () => {
    const p = layoutPref();
    if (p === 'mobile') return true;
    if (p === 'pc') return false;
    const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    return touch && Math.min(window.innerWidth, window.innerHeight) <= 760;
  };
  let isMobile = false;
  function fit() {
    const mob = wantMobile();
    if (mob !== isMobile || !document.body.classList.contains(mob ? 'mobile' : 'pc')) {
      isMobile = mob; document.body.classList.toggle('mobile', mob); document.body.classList.toggle('pc', !mob);
      if (typeof U !== 'undefined') { U.lastSig = null; try { render(); } catch (e) { /* 무시 */ } }
    }
    document.body.classList.toggle('land', mob && window.innerWidth > window.innerHeight);
    if (mob) {
      // 브라우저 주소창·하단 바 때문에 화면이 납작해지면 무대 높이를 줄인다 (폭 540 고정, 높이 860~1170)
      const sw = window.innerWidth / 540, H = Math.round(Math.min(1170, Math.max(860, window.innerHeight / sw)));
      const s = Math.min(sw, window.innerHeight / H);
      $('stage').style.height = `${H}px`; $('stage').style.setProperty('--sh', `${H}px`);
      document.body.classList.toggle('short', H < 1100);
      $('stage').style.transform = `translate(-50%, -50%) scale(${s})`;
      return;
    }
    const m = Math.max(12, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.035)); // 상하좌우 여백
    const s = Math.max(0.3, Math.min((window.innerWidth - m * 2) / 1760, (window.innerHeight - m * 2) / 990));
    $('stage').style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);

  /* ============================================================
     입력
     ============================================================ */
  function doDecide(mid, choice, who) {
    const res = Guild.decide(mid, choice, who);
    if (!res.ok) toast(res.reason);
    else if (res.result) U.screen = 'hub'; // 결과는 우편함으로 온다
  }
  function openChar(id) {
    const c = byId(id);
    if (!c) return;
    U.screen = 'roster'; U.tab = TAB_OF[c.status]; U.selId = id; U.modal = null;
  }
  const val = (id, d) => Math.max(1, parseInt(document.getElementById(id).value, 10) || d);

  function act(name, el) {
    const id = el.dataset.id;
    switch (name) {
      case 'goto': U.screen = el.dataset.screen; U.childMode = false; break;
      case 'menu-save': toast(Guild.save() ? '저장했어요.' : '이 브라우저에서는 저장할 수 없어요.'); break;
      case 'set-layout': try { localStorage.setItem(LAYOUT_KEY, el.dataset.k); } catch (e) { /* 무시 */ } fit(); break;
      case 'menu-modal': U.modal = { type: el.dataset.m }; break;
      case 'open-char': openChar(id); break;
      case 'cancel-train': { const r = Guild.cancelTraining(id); toast(r.ok ? '훈련을 취소했어요. 들인 시간은 돌아오지 않아요.' : r.reason); break; }
      case 'chr-filter': U.chrFilter = el.dataset.k; break;
      case 'codex-tab': U.codexTab = el.dataset.k; U.codexSel = null; break;
      case 'sk-filter': U.skFilter = el.dataset.k; break;
      case 'open-dead': U.screen = 'roster'; U.tab = 'dead'; U.selId = null; break;
      case 'tab': U.tab = el.dataset.tab; U.selId = null; break;
      case 'sel': U.selId = id; if (isMobile) { U.rStep = 'detail'; U.rPage = 0; } break;
      case 'quest-sel': U.contract = id; U.tutPicked = true; if (isMobile) U.qStep = 'party'; break;
      case 'q-back': U.qStep = 'board'; break;
      case 'r-back': U.rStep = 'list'; break;
      case 'r-page': U.rPage = Number(el.dataset.p); break;
      case 'to-quests': U.party = [id]; U.screen = 'quests'; break;
      case 'party-toggle': {
        const k = Guild.board.find((x) => x.id === U.contract);
        if (U.party.includes(id)) U.party = U.party.filter((x) => x !== id);
        else if (k && U.party.length >= k.max) toast(`이 의뢰는 최대 ${k.max}명까지 보낼 수 있어요.`);
        else U.party.push(id);
        break;
      }
      case 'price': { const d = Guild.state.display.find((x) => x.item.id === id); if (d) Guild.setPrice(id, d.price * (1 + Number(el.dataset.d))); break; }
      case 'display': { const r = Guild.displayItem(id); if (!r.ok) toast(r.reason); break; }
      case 'undisplay': Guild.undisplayItem(id); break;
      case 'dump': { const r = Guild.dumpItem(id); toast(r.ok ? `떨이로 넘겼어요. +${r.gold.toLocaleString()}금` : r.reason); break; }
      case 'dump-all': {
        const th = U.dumpTh || 35, n = Guild.state.stock.filter((it) => Gear.qpOf(it) < th).length;
        if (!n) { toast('조건에 맞는 장비가 없어요.'); break; }
        U.modal = { type: 'confirm', title: '떨이 처분', text: `품질 ${th}% 미만 장비 ${n}점을 적정가의 반값에 모두 넘길까요? 되돌릴 수 없어요.`, yes: '넘기기', onYes: () => { const r = Guild.dumpBelow(th); toast(r.ok ? `${r.n}점을 넘겼어요. +${r.gold.toLocaleString()}금` : r.reason); } };
        break;
      }
      case 'ws-slot': U.wsSlot = el.dataset.k; break;
      case 'craft': { const r = Guild.startCraft(el.dataset.id); toast(r.ok ? '제작을 시작했어요.' : r.reason); break; }
      case 'qlist': U.modal = { type: 'qlist', cid: el.dataset.cid }; break;
      case 'qhist': U.modal = { type: 'qhist', cid: el.dataset.cid, i: Number(el.dataset.i) }; break;
      case 'decline-mat': { const r = Guild.declineMaterial(id); toast(r.ok ? '매입하지 않고 돌려보냈어요.' : r.reason); break; }
      case 'decline-all': { const n = Guild.state.matQueue.length; if (!n) break; U.modal = { type: 'confirm', title: '모두 거절', text: `매입 대기 재료 ${n}건을 모두 돌려보낼까요? 돌려보낸 재료는 사라져요.`, yes: '돌려보내기', onYes: () => { const r = Guild.declineMaterial(null); toast(r.ok ? `${r.n}건을 돌려보냈어요.` : r.reason); } }; break; }
      case 'buy-mat': { const r = Guild.buyMaterial(id || null); toast(r.ok ? `재료를 매입했어요. (-${r.cost}금)` : r.reason); break; }
      case 'clear-party': U.party = []; break;
      case 'cand-sort': U.candSort = el.dataset.k; break;
      case 'roster-sort': U.rosterSort = el.dataset.k; break;
      case 'recommend': {
        const k = Guild.board.find((x) => x.id === U.contract);
        if (k) U.party = recommendParty(k, idleHeroes());
        break;
      }
      case 'dispatch': {
        const k = Guild.board.find((x) => x.id === U.contract);
        const party = U.party.map(byId);
        const go = () => {
          const res = Guild.sendParty(U.contract, U.party);
          if (!res.ok) toast(res.reason);
          else { toast('파티가 출발했어요. 위기 신호는 홈과 알림으로 알려 드려요.'); flash('#ffd166'); U.party = []; U.contract = null; U.qStep = 'board'; }
          render();
        };
        if (k && !Combat.isWait(k) && party.length >= k.min) {
          const d = dangerFor(party, k);
          const avg = party.reduce((a, c) => a + c.level, 0) / party.length;
          if (d.key === 'danger' || d.key === 'extreme') {
            U.modal = { type: 'confirm', title: '정말 보낼까요?', text: `이 파티에게는 <b>${d.text}</b>한 의뢰예요.<br>위기가 오면 결정 시간 안에 후퇴할 수 있지만, 체력이 0이 된 모험가는 그 자리에서 사망해요.`, yes: '그래도 출발', no: '다시 고르기', onYes: go };
            break;
          }
        }
        go();
        break;
      }
      case 'view-battle': { const mm = Guild.missionById(id); if (mm && mm.wait) { toast('채집·도움은 돌아올 때까지 실시간 확인이 없어요.'); break; } } U.battle = id; U.screen = 'battle'; break;
      case 'decide':
        if (el.dataset.choice === 'continue') {
          const mid = el.dataset.mid;
          U.modal = { type: 'confirm', title: '계속 싸울까요?', text: '계속 싸우면 파티원이 쓰러질 수 있고, 체력이 0이 되는 파티원은 즉시 <b>영구 사망</b>해요.', yes: '계속 싸운다', no: '돌아가기', onYes: () => doDecide(mid, 'continue') };
        } else doDecide(el.dataset.mid, el.dataset.choice, id);
        break;
      case 'mourn': { const r = Guild.mourn(id); toast(r.ok ? '추모식을 열었어요.' : r.reason); break; }
      case 'confirm-yes': { const f = U.modal && U.modal.onYes; U.modal = null; if (f) f(); break; }
      case 'return-char': { const r = Guild.returnCharacter(id); toast(r.ok ? '길드로 돌아왔어요.' : r.reason); break; }
      case 'app-sel': U.applicant = id; break;
      case 'rec-next': if (recDone) { recDone(); break; } U.recLine = (U.recLine || 0) + 1; break;
      case 'app-dismiss': Guild.dismissApplicant(id); toast('지원자를 돌려보냈어요.'); break;
      case 'hire': {
        const r = Guild.hire(id);
        if (!r.ok) { toast(r.reason); } else { U.modal = { type: 'recruit', id: r.character.id } }
        break;
      }
      case 'dev-applicants': Guild.refillApplicants(); break;
      case 'reset-char': {
        const c0 = byId(id);
        U.modal = { type: 'confirm', title: `${c0 ? c0.name : ''} 초기화`, text: '초기화권을 써서 <b>레벨·전직 경로·모험가 등급·유대</b>를 처음으로 되돌려요.<br>외형, 희귀도, 재능, 기본 직업, 고유스킬, 장비는 그대로예요. 되돌릴 수 없어요.', yes: '초기화한다', no: '취소', onYes: () => { const r = Guild.resetCharacter(id); toast(r.ok ? '처음부터 다시 시작해요.' : r.reason); } };
        break;
      }
      case 'coach-next': { if (typeDone) { finishType(); break; } const s = tutStep(); if (s && (s.card || s.next)) { if (s.onNext) s.onNext(); const nx = Guild.tutorialStep() + 1; Guild.setTutorial(nx >= TUT.length ? Guild.TUTORIAL_DONE : nx); } break; }
      case 'dev-tutorial': Guild.setTutorial(0); U.modal = null; U.screen = 'hub'; break;
      case 'dev-ticket': Guild.grantResetTicket(1); toast('초기화권 +1'); break;
      case 'open-advance': U.modal = { type: 'advance', id }; break;
      case 'advance-go': { const r = Guild.advanceCharacter(id, el.dataset.cls); U.modal = null; toast(r.ok ? '전직했어요.' : r.reason); break; }
      case 'dev-lv': if (U.selId) Guild.devSetLevel(U.selId, Number(el.dataset.lv)); break;
      case 'ach-cat': U.achCat = el.dataset.k; break;
      case 'open-talk': if (!Guild.inLobby(id)) { toast('로비에 나와 있는 모험가와만 이야기할 수 있어요.'); break; } U.modal = { type: 'talk', id, opts: Guild.talkOptions(id), msgs: [{ who: 'them', text: '무슨 일이세요, 마스터?' }], typing: false }; break;
      case 'talk-pick': {
        const m = U.modal; if (!m || m.type !== 'talk' || m.typing) break;
        const q = Number(el.dataset.q), r = Guild.talk(m.id, q);
        if (!r.ok) { toast(r.reason); break; }
        m.msgs.push({ who: 'me', text: Dialog.question(q) }); m.typing = true; m.opts = [];
        const delay = 900 + Math.min(1400, r.line.length * 22) + Math.random() * 500;
        setTimeout(() => {
          if (U.modal !== m) return;
          m.typing = false; m.msgs.push({ who: 'them', text: r.line }); m.opts = Guild.talkOptions(m.id);
          render(); const cl = document.querySelector('.chat-log'); if (cl) cl.scrollTop = cl.scrollHeight;
        }, delay);
        break;
      }
      case 'open-train': U.modal = { type: 'train', id }; break;
      case 'train-go': { const r = Guild.startTraining(id, Number(el.dataset.min)); U.modal = null; toast(r.ok ? '훈련을 시작했어요.' : r.reason); break; }
      case 'modal': U.modal = { type: el.dataset.m }; break;
      case 'close-modal': U.modal = null; break;
      case 'dismiss': Guild.dismissResult(id || null); if (!id) Guild.clearReport(); break;
      case 'dismiss-report': Guild.clearReport(); break;
      case 'save': toast(Guild.save() ? '저장했어요.' : '이 브라우저에서는 저장할 수 없어요.'); break;
      case 'rename': {
        const nn = document.getElementById('in-name').value.trim();
        if (nn.length < 2) { toast('길드 이름은 2~8글자로 지어 주세요.'); break; }
        if (nn === Guild.state.guildName) { toast('지금과 같은 이름이에요.'); break; }
        U.modal = { type: 'confirm', title: '길드 이름 바꾸기', text: `「${esc(nn)}」(으)로 바꾸면 <b>명성이 50% 떨어져요.</b><br>(지금 ${Guild.state.fame} → ${Math.floor(Guild.state.fame * 0.5)})`, yes: '바꾼다', no: '그만두기', onYes: () => { const r = Guild.renameGuild(nn); toast(r.ok ? `길드 이름을 바꿨어요. (명성 -${r.lost})` : r.reason); } };
        break;
      }
      case 'logout': try { localStorage.removeItem('guild_auth'); } catch (e) {} U.modal = null; authRender(); break;
      case 'promote': { const r = Guild.promoteGuild(); toast(r.ok ? `길드가 ${Guild.guildGrade()}급으로 올랐어요!` : r.reason); break; }
      case 'upgrade': { const r = Guild.upgradeFacility(id); toast(r.ok ? '시설을 확장했어요.' : r.reason); break; }
      case 'dev-gold': Guild.addGold(100); break;
      case 'dev-ten': for (let i = 0; i < 10; i++) Guild.recruit({ free: true }); toast('10명을 영입했어요.'); break;
      case 'dev-skip': Guild.advanceTime(val('in-skip', 10)); break;
      case 'dev-absence': {
        Guild.simulateAbsence(val('in-abs', 30));
        U.modal = null;
        break;
      }
      case 'dev-reset':
        U.modal = { type: 'confirm', title: '저장 데이터 삭제', text: '저장된 길드 데이터를 모두 지우고 처음부터 시작할까요? 되돌릴 수 없어요.', yes: '삭제', onYes: () => { Guild.resetAll(); U.screen = 'hub'; U.selId = null; U.party = []; U.contract = null; U.seenMail = 0; } };
        break;
      default: return;
    }
    render();
  }

  // 금화가 바뀌면 숫자가 튀고 증감이 떠오른다
  // 화면 번쩍임과 색종이: 합성 레이어에서만 돌아서 가볍다
  function flash(color) {
    const st = $('stage'), d = document.createElement('div');
    d.className = 'fx-flash'; d.style.background = color;
    st.appendChild(d); setTimeout(() => d.remove(), 420);
  }
  // 어떤 요소의 한가운데에서 입자가 터져 나온다
  function burstAt(target, cols, n, spread) {
    const st = $('stage'), sr = st.getBoundingClientRect(), sc = sr.width / st.offsetWidth, r = target.getBoundingClientRect();
    const wrap = document.createElement('div');
    wrap.className = 'confetti'; wrap.style.left = ((r.left + r.width / 2 - sr.left) / sc) + 'px'; wrap.style.top = ((r.top + r.height / 2 - sr.top) / sc) + 'px';
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i'), a = Math.random() * Math.PI * 2, d = (spread || 200) * (0.4 + Math.random() * 0.8);
      p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d * 0.7 - 40 + 'px');
      p.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
      p.style.background = cols[i % cols.length]; p.style.animationDelay = Math.random() * 0.1 + 's';
      wrap.appendChild(p);
    }
    st.appendChild(wrap); setTimeout(() => wrap.remove(), 1500);
  }
  function goldFx() {
    const g = Guild.state.gold, prev = U.lastGold;
    U.lastGold = g;
    if (prev === undefined || prev === g) return;
    const el = document.querySelector('.tb-gold');
    if (!el) return;
    el.classList.add(g > prev ? 'bump-up' : 'bump-dn');
    const st = $('stage'), r = el.getBoundingClientRect(), sr = st.getBoundingClientRect(), sc = sr.width / st.offsetWidth;
    const f = document.createElement('div');
    f.className = 'gold-float ' + (g > prev ? 'up' : 'dn'); f.textContent = (g > prev ? '+' : '−') + Math.abs(g - prev).toLocaleString();
    f.style.left = ((r.left + r.width / 2 - sr.left) / sc) + 'px'; f.style.top = ((r.bottom - sr.top) / sc) + 'px';
    st.appendChild(f); setTimeout(() => f.remove(), 1200);
  }
  // 누르는 곳마다 파문이 퍼진다 (화면이 다시 그려져도 사라지지 않도록 무대 위에 따로 띄운다)
  document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest && e.target.closest('button, .qnote, .pslot, .item, .tab, [data-act]');
    if (!t || t.disabled) return;
    const st = $('stage'), sr = st.getBoundingClientRect(), sc = sr.width / st.offsetWidth;
    const d = document.createElement('div'); d.className = 'ripple';
    d.style.left = ((e.clientX - sr.left) / sc) + 'px'; d.style.top = ((e.clientY - sr.top) / sc) + 'px';
    st.appendChild(d); setTimeout(() => d.remove(), 520);
  }, true);
  // 터치: 길게 누르면 title(설명)을 안내 말풍선으로 보여준다 (호버 대체)
  (() => {
    let tm = null, sx = 0, sy = 0, fired = 0;
    const clr = () => { clearTimeout(tm); tm = null; };
    $('stage').addEventListener('touchstart', (e) => {
      if (!isMobile || e.touches.length !== 1) return;
      const el = e.target.closest('[title]');
      if (!el || !el.title) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; clr();
      tm = setTimeout(() => { fired = Date.now(); toast(el.title); if (navigator.vibrate) navigator.vibrate(10); }, 450);
    }, { passive: true });
    $('stage').addEventListener('touchmove', (e) => { const t = e.touches[0]; if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) clr(); }, { passive: true });
    ['touchend', 'touchcancel'].forEach((n) => $('stage').addEventListener(n, clr, { passive: true }));
    // 길게 눌러 말풍선이 뜬 직후의 클릭은 무시 (실수로 실행되는 것 방지)
    $('stage').addEventListener('click', (e) => { if (Date.now() - fired < 700) { e.stopPropagation(); e.preventDefault(); fired = 0; } }, true);
  })();

  $('stage').addEventListener('click', (e) => {
    if (e.target.closest('.reveal') && !e.target.closest('button')) {
      const rv = document.querySelector('#overlay .reveal'), ts = tutStep();
      if (rv && rv.classList.contains('done') && ts && ts.next) act('coach-next', { dataset: {} }); else skipReveal();
      return;
    }
    const el = e.target.closest('[data-act]');
    if (!el) { // 튜토리얼 설명 단계: 화면의 빈 곳을 눌러도 넘어간다
      const ts = tutStep();
      if (ts && ts.next && !e.target.closest('button, a, input, select, textarea, [role="button"], #chat')) act('coach-next', { dataset: {} });
      return;
    }
    if (el.dataset.act === 'scrim') {
      if (e.target !== el) return;
      const ts = tutStep();
      if (ts && ts.noClose) { if (ts.next) act('coach-next', { dataset: {} }); return; }
      U.modal = null; render(); return;
    }
    if (el.tagName === 'INPUT') return; // 체크박스는 change에서 처리
    if (!tutAllowed(el)) { toast('튜토리얼 안내를 먼저 따라 해 주세요.'); return; }
    act(el.dataset.act, el);
  });
  $('stage').addEventListener('input', (e) => {
    const inp = e.target.closest('input[data-act="ware-q"], input[data-act="ach-q"]');
    if (!inp) return;
    const key = inp.dataset.act;
    if (key === 'ach-q') U.achQ = inp.value; else U.wareQ = inp.value;
    const pos = inp.selectionStart; render();
    const n = document.querySelector('input[data-act="' + key + '"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) { /* 무시 */ } }
  });
  $('stage').addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-act]');
    if (sel && sel.dataset.act === 'roster-class') { U.rosterClass = sel.value; render(); return; }
    if (sel && sel.dataset.act === 'roster-state') { U.rosterState = sel.value; render(); return; }
    if (sel && sel.dataset.act === 'roster-rank') { U.rosterRank = sel.value; render(); return; }
    if (sel && sel.dataset.act === 'dump-th') { U.dumpTh = Number(sel.value); render(); return; }
    if (sel && sel.dataset.act === 'ware-grade') { U.wareGrade = sel.value; render(); return; }
    if (sel && sel.dataset.act === 'ach-st') { U.achSt = sel.value; render(); return; }
    if (sel && sel.dataset.act === 'ws-grade') { U.wsGrade = Number(sel.value); render(); return; }
    const el = e.target.closest('input[data-act]');
    if (!el) return;
    if (el.dataset.act === 'dev-boost') { U.boost = el.checked; Guild.setSkillBoost(U.boost ? 100000 : 1); }
    if (el.dataset.act === 'dev-skill') { U.forceSkill = el.checked; Guild.setForceSkill(U.forceSkill); }
    if (el.dataset.act === 'dev-talent') { U.showTalent = el.checked; render(); }
  });
  // PC 단축키: 1~6 헤더 · Space 하위 항목 선택 모드(숫자로 고르고 Esc로 나옴) · H 도움말 · S 저장
  document.addEventListener('keydown', (e) => {
    if ($('auth').innerHTML) return;
    if (e.ctrlKey || e.altKey || e.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName || '')) return;
    if (e.key === 'Escape') {
      if (U.modal) { U.modal = null; render(); }
      else if (U.childMode) { U.childMode = false; render(); }
      return;
    }
    // 튜토리얼 안내 카드가 떠 있으면 Space로 넘길 수 있다 (Enter는 채팅 전용)
    if (e.key === ' ' && !U.modal) { const nb = document.querySelector('#coach [data-act="coach-next"]'); if (nb) { e.preventDefault(); nb.click(); return; } }
    if (U.modal) {
      if (U.modal.type === 'talk' && /^[1-3]$/.test(e.key)) { const b = document.querySelectorAll('#overlay .topt')[Number(e.key) - 1]; if (b) b.click(); }
      return;
    }
    const k = e.key;
    if (k === ' ' || k === 'Spacebar') {
      e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (curCat().subs.length > 1) { U.childMode = !U.childMode; render(); }
    } else if (/^[1-9]$/.test(k)) {
      const n = Number(k) - 1;
      if (U.childMode) { const b = document.querySelectorAll('#tabs .tb-sub .pill')[n]; if (b) b.click(); }
      else { const t = document.querySelectorAll('#tabs .tab')[n]; if (t) t.click(); }
    } else if (k === 'h' || k === 'H' || k === 'ㅗ') { const b = document.querySelector('#tabs [data-m="help"]'); if (b) b.click(); }
    else if (k === 's' || k === 'S' || k === 'ㄴ') { const b = document.querySelector('#tabs [data-act="menu-save"]'); if (b) b.click(); }
  });
  // 탭을 켜 둔 채 오래 있다가 돌아온 경우도 처리
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { Guild.checkAbsence(); render(); }
  });

  /* ---------- 시작 ---------- */

  /* ---------- 로그인 / 회원가입 / 길드 이름 (아직 서버는 없어서 이 브라우저에만 기억한다) ---------- */
  function authGet() { try { return JSON.parse(localStorage.getItem('guild_auth') || 'null'); } catch (e) { return null; } }
  function authSet(v) { try { localStorage.setItem('guild_auth', JSON.stringify(v)); } catch (e) {} }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const AU = { tab: 'login', err: '' };
  function authHtml() {
    const sess = authGet();
    const card = (inner) => `<div class="au-wrap"><div class="au-card"><div class="au-logo">모험가 길드</div><div class="au-sub">모험가를 모으고, 키우고, 떠나보내는 이야기</div>${inner}</div></div>`;
    if (sess && !Guild.guildNamed()) {
      return card(`<h2>길드 이름을 정해 주세요</h2><p class="au-note">길드의 첫 이름이에요. 나중에 바꿀 수 있지만, <b>바꾸면 명성이 50% 떨어져요.</b></p>
        <form novalidate data-form="name"><label>길드 이름 <small>(2~8자)</small></label><input id="au-guild" type="text" maxlength="8" autocomplete="off" placeholder="예) 푸른 늑대 길드" value="">
        <div class="au-err">${AU.err}</div><button class="au-btn primary" type="submit">길드 시작하기</button></form>`);
    }
    const t = AU.tab;
    return card(`<div class="au-tabs"><button data-au="tab" data-k="login" class="${t === 'login' ? 'on' : ''}">로그인</button><button data-au="tab" data-k="signup" class="${t === 'signup' ? 'on' : ''}">회원가입</button></div>
      <form novalidate data-form="${t}"><label>이메일</label><input id="au-email" type="email" autocomplete="email" placeholder="you@example.com">
      <label>비밀번호</label><input id="au-pw" type="password" autocomplete="${t === 'login' ? 'current-password' : 'new-password'}" placeholder="8자 이상">
      ${t === 'signup' ? '<label>비밀번호 확인</label><input id="au-pw2" type="password" autocomplete="new-password" placeholder="한 번 더 입력">' : ''}
      <div class="au-err">${AU.err}</div>
      <button class="au-btn primary" type="submit">${t === 'login' ? '로그인' : '가입하고 시작하기'}</button></form>
      <div class="au-or"><span>또는</span></div>
      <button class="au-btn ghost" data-au="skip">로그인 건너뛰기 <small>(임시 · 테스트용)</small></button>
      <p class="au-foot">아직 서버가 없어서 실제 로그인은 되지 않아요. 입력한 정보는 이 브라우저 안에만 남아요.</p>`);
  }
  function authRender() {
    const sess = authGet(), el = $('auth');
    if (sess && Guild.guildNamed()) { el.innerHTML = ''; el.style.display = 'none'; render(); return; }
    el.style.display = 'block'; AU.err = AU.err || '';
    el.innerHTML = authHtml();
    const f = el.querySelector('input'); if (f) f.focus();
  }
  $('auth').addEventListener('click', (e) => {
    const b = e.target.closest('[data-au]'); if (!b) return;
    if (b.dataset.au === 'tab') { AU.tab = b.dataset.k; AU.err = ''; authRender(); }
    if (b.dataset.au === 'skip') { authSet({ skip: true, at: Date.now() }); AU.err = ''; authRender(); }
  });
  $('auth').addEventListener('submit', (e) => {
    e.preventDefault();
    const kind = e.target.dataset.form, v = (id) => (document.getElementById(id) || {}).value || '';
    const fail = (m) => { AU.err = m; const x = $('auth').querySelector('.au-err'); if (x) x.textContent = m; };
    if (kind === 'name') { const r = Guild.nameGuild(v('au-guild')); if (!r.ok) return fail(r.reason); AU.err = ''; authRender(); return; }
    const email = v('au-email').trim(), pw = v('au-pw');
    if (!EMAIL_RE.test(email)) return fail('이메일 주소를 확인해 주세요.');
    if (pw.length < 8) return fail('비밀번호는 8자 이상이어야 해요.');
    if (kind === 'signup' && pw !== v('au-pw2')) return fail('비밀번호가 서로 달라요.');
    authSet({ email, at: Date.now() }); AU.err = ''; authRender();
  });
  Guild.load();
  if (Guild.tutorialActive() && Guild.tutorialStep() >= TUT.length) Guild.setTutorial(Guild.TUTORIAL_DONE);
  fit();
  render();
  authRender();

  /* ---------- 로딩 화면: 처음 쓰는 화면·연출·계산을 미리 한 번씩 돌려 둔다 ---------- */
  (async function warmup() {
    const ld = $('loader'), fill = $('ld-fill'), msg = $('ld-msg');
    if (!ld) return;
    const t0 = performance.now();
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const SCREENS = ['hub', 'roster', 'quests', 'active', 'results', 'chronicle', 'guild', 'recruit', 'dojo', 'shop', 'workshop', 'warehouse', 'codex', 'achv', 'memorial'];
    const total = 4 + SCREENS.length;
    let done = 0;
    const step = (text) => { done++; if (text) msg.textContent = text; fill.style.width = Math.round((done / total) * 100) + '%'; };
    const saved = { screen: U.screen, tab: U.tab, childMode: U.childMode, selId: U.selId };
    let temp = null;
    try {
      msg.textContent = '글꼴을 불러오는 중…';
      if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, wait(1500)]);
      step();
      msg.textContent = '전투를 준비하는 중…';
      await frame();
      try {
        temp = Character.createCharacter({ index: 987654321n, appearanceId: String(BigInt(Math.floor(Math.random() * 1e9)) % Appearance.TOTAL), registry: Character.createSkillRegistry(null), deferSkill: true });
        temp.name = '예열'; temp.appearance = Appearance.decodeAppearance(temp.appearanceId); temp.level = 5; temp.id = 'warm';
        const rng = Math.random;
        for (let i = 0; i < 3; i++) Engine.simulate([Character.toEngine(temp), Character.toEngine(temp)], Engine.makeQuest('F', 'sweep', rng, {}), rng, {});
      } catch (e) { /* 예열 실패는 무시 */ }
      step();
      msg.textContent = '화면을 준비하는 중…';
      for (const s of SCREENS) {
        try { U.screen = s; U.childMode = false; render(); } catch (e) { /* 무시 */ }
        await frame();
        step();
      }
      msg.textContent = '연출을 준비하는 중…';
      try {
        if (temp) {
          const host = document.createElement('div');
          host.id = 'warm-host'; host.innerHTML = revealHtml(temp);
          $('stage').appendChild(host);
          host.querySelectorAll('[data-t]').forEach((el) => el.classList.add('go'));
          host.querySelectorAll('.rv-row').forEach((el) => el.classList.add('stop'));
          await wait(700);
          host.remove();
        }
      } catch (e) { /* 무시 */ }
      step();
      msg.textContent = '거의 다 됐어요!';
      await frame();
      step();
    } finally {
      U.screen = saved.screen; U.tab = saved.tab; U.childMode = saved.childMode; U.selId = saved.selId; U.lastScr = null;
      try { render(); } catch (e) { /* 무시 */ }
      fill.style.width = '100%';
      const left = Math.max(0, 600 - (performance.now() - t0));
      setTimeout(() => { ld.classList.add('out'); setTimeout(() => ld.remove(), 450); }, left);
    }
  })();
})();
