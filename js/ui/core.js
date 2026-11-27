/* ui/core.js — 공통 도구·화면 상태(U)·편성/위험도 계산 보조
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
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

  /* ---------- 화면 상태 ---------- */
  const ACT = {};
// 언어 선택 버튼(로그인 화면·설정 공용). 글자는 번역하지 않는다.
const LANG_NAMES = { ko: '한국어', en: 'English', ja: '日本語', zh: '简体中文', zht: '繁體中文' };
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
    childMode: false,   // 헤더 번호 키로 연 하위 메뉴가 열려 있는 동안 true (숫자 키 = 하위 항목)
    modal: null,        // { type: mail | settings | help | recruit | confirm, ... }
    seenMail: 0,        // 이미 알린 보고 수 (새 보고가 오면 알림을 띄운다)
    rosterSort: 'recent', rosterClass: '', candSort: 'rec',
    boost: false,       // 개발: 고유스킬 확률 증가
    showTalent: false,  // 개발: 재능 수치 표시
  };

  const BATTLE_BG = {
    q1: ['#6b5a47', '#3d3027', '#4a3a2c', '#2a2018'], q2: ['#2f4a3a', '#1d3027', '#2b3a28', '#16200f'],
    q3: ['#4a4338', '#2e2a24', '#3c3a2a', '#1d1b12'], q4: ['#2c2f42', '#1a1c2a', '#2b2b36', '#15151c'],
    q5: ['#5a2a1c', '#2e1410', '#3a2018', '#1c0e09'], q6: ['#3a2f55', '#201a33', '#2d2a3a', '#141220'],
  };
  const MON_PX = { q1: 150, q2: 170, q3: 170, q4: 200, q5: 220, q6: 250 };
  const STATE_CHIP = { running: '의뢰 중', alert: '위기!', recover: '회복중', training: '훈련 중', mourn: '슬픔' };
  const order = { alert: 0, idle: 1, running: 2, training: 3, recover: 1.5, mourn: 1.7 };

  /* ---------- 상태 조회 ---------- */
  function statusOf(c) {
    if (c.status !== 'ACTIVE') return { state: 'idle' };
    const m = Guild.missionOf(c);
    if (m) return { ...Guild.missionInfo(m), mission: m };
    if (c.training) return { state: 'training', until: c.training.until, minutes: c.training.minutes };
    if (Guild.mourningUntil(c)) return { state: 'mourn', until: Guild.mourningUntil(c) };
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
    const pol = U.policy || 'balanced';
    if (q.tutorial) return { key: 'safe', text: '안전' }; // 튜토리얼 연습 의뢰는 언제나 안전
    const tr = Guild.analysisTrials(); // 자료실이 높을수록 모의 전투를 많이 돌려 더 정확하다
    const k = q.id + '|' + pol + '|' + tr + '|' + members.map((c) => c.id + ':' + c.level + ':' + Guild.bondsOf(c.id).length).join(',');
    if (!(k in dangerCache)) dangerCache[k] = Combat.dangerLevel(Combat.estimate(Guild.buildMembers(members, q.monster, pol), q, tr).crisisRate);
    return dangerCache[k];
  }
  const wk = (k) => (k && Guild.knowledge(k.monster) >= 2 ? k.weak : null);           // 약점은 도감 지식 2단계부터
  const monLabel = (k) => (Guild.knowledge(k.monster) >= 1 ? k.monster : '정체불명');
  const GRADE_ORDER = Combat.GRADES;
  const sortBoard = () => Guild.board.slice().sort((a, b) => (GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade)) || a.level - b.level || a.expiresAt - b.expiresAt);
  const clsOf = (c) => c.path[c.path.length - 1];
  const engOf = (c) => Character.toEngine(c);
  const canHeal = (c) => Engine.collectMods(engOf(c)).actives.some((s) => s.act && /^heal/.test(s.act.t));
  const attrText = (c) => { const t = (x) => (window.I18n ? I18n.tr(x) : x); return t(c.mainAttribute) + (c.subAttribute ? '/' + t(c.subAttribute) : ''); };
  // 추천 편성: 약점 속성·레벨이 좋은 사람 중에서, 치유 담당을 한 명 넣고 직업이 겹치지 않게 고른다
  const fullHp = (c) => (Guild.hpFrac(c) >= 0.999 ? 1 : 0);
  function recommendParty(k, free) {
    free = free.filter(fullHp); // 자동 편성은 체력이 100%인 모험가만
    if (Combat.isWait(k)) return free.slice().sort((a, b) => a.level - b.level).slice(0, k.max).map((c) => c.id); // 채집·도움은 위험이 없으니 레벨이 낮은 모험가를 최대 인원까지 보낸다
    const size = k.max; // 자동 편성은 최대 인원까지 채운다 (대기 모험가가 모자라면 있는 만큼)
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
