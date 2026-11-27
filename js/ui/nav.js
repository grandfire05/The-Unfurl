/* ui/nav.js — 내비게이션(헤더·하위 메뉴)·길잡이 카드·저장 표시·상단 바·공통 머리글
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

  /* ---------- 내비게이션: 위쪽 헤더(숫자 키) + 하위 메뉴(번호 키 → 하위 번호, Esc로 닫기) ----------
     헤더 1~6: 홈 · 의뢰 · 모험가 · 영입 · 상점 · 길드. 헤더를 고르면 첫 화면으로 가고, 그 아래에 하위 항목 줄이 열린다.
     하위 항목이 있는 헤더는 번호 키를 누르면 그 첫 화면으로 가면서 하위 메뉴가 열리고, 이어서 숫자 키로 하위 항목을 고른다. Esc로 메뉴를 닫는다. */
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
  const newContractCount = () => (U.newK ? U.newK.size : 0);
  const subCount = (id) => (id === 'quests' ? newContractCount() : id === 'active' ? Guild.missions.length : id === 'results' ? mailCount() : id === 'recruit' ? Guild.applicants.length : 0);
  function badgeOf(tab) {
    if (tab === 'quests') { const a = alertCount(); if (a) return { n: a, red: true }; const nk = newContractCount(); return nk ? { n: nk, gold: true } : { n: mailCount() }; }
    if (tab === 'roster') return { n: advanceCount() };
    if (tab === 'recruit') return { n: Guild.applicants.length };
    
    if (tab === 'guild') return { n: promoReady() ? 1 : 0 };
    return { n: 0 };
  }
  function tabbarHtml() {
    const cur = curCat().id, sub = (NAV[U.screen] || [])[1];
    return CATS.map((c, n) => {
      const locked = !Guild.unlockedCat(c.id), b = locked ? { n: 0 } : badgeOf(c.id), multi = c.subs.length > 1 && !locked;
      const btn = `<button class="tab${cur === c.id ? ' sel' : ''}${locked ? ' locked' : ''}" data-act="goto" data-screen="${c.subs[0][0]}" title="${c.label} (${n + 1})">${icon(c.icon)}<span>${c.label}</span>${multi ? '<s class="caret">▾</s>' : ''}<kbd>${n + 1}</kbd>${locked ? icon('lock', 'lk') : ''}${b.n ? `<i class="dot${b.red ? ' red' : b.gold ? ' new' : ''}">${b.n}</i>` : ''}</button>`;
      if (!multi) return btn;
      // 하위 화면이 있는 탭: 마우스를 올리면(또는 키보드로 들어가면) 바로 가기 목록이 펼쳐진다
      return `<div class="tabw${U.childMode && cur === c.id ? ' open' : ''}">${btn}<div class="tab-menu" role="menu">${c.subs.map(([id, label], i) => `<button class="tm-item${cur === c.id && sub === id ? ' on' : ''}" role="menuitem" data-act="goto" data-screen="${id}"><kbd>${i + 1}</kbd><span>${label}</span>${subCount(id) ? `<b>${subCount(id)}</b>` : ''}</button>`).join('')}</div></div>`;
    }).join('');
  }
  // 왼쪽 길잡이 카드: 지금 목표 · 진행 · 보상. 접어 둘 수 있고, 새 목표가 뜨면 펼쳐지며 튀어나온다.
  try { U.gFold = localStorage.getItem('guild_guide_fold') === '1'; } catch (e) { U.gFold = false; }
  function guideCardHtml() {
    const q = Guild.guideNow(), tc = tutCtx(), st = tc && tc.list[Math.min(tc.i, tc.list.length - 1)];
    if (!q || U.screen === 'battle' || (st && !(st.hl || []).includes('.gcard'))) return '';
    if (U.gLast !== q.id) { U.gLast = q.id; U.gFreshAt = Date.now(); }
    const isNew = U.gSeen !== q.id, fresh = isNew && Date.now() - U.gFreshAt < 9000; // 새 목표는 잠깐 펼쳐져 눈에 띈다
    const tutHl = st && (st.hl || []).includes('.gcard');
    // 본부에서는 펼쳐 두고, 다른 화면(의뢰판 등)에서는 내용을 가리지 않게 접어 둔다. 머리를 누르면 그 화면에서만 펼쳐진다.
    const open = tutHl || fresh || U.gOpenScr === U.screen || (U.screen === 'hub' && !U.gFold), min = !open;
    const rew = `${q.gold ? '보상 +' + q.gold + '금화' : ''}${q.open ? (q.gold ? ' · ' : '') + q.open + ' 탭 열림' : ''}`;
    // 등장 애니메이션은 한 번만: 다시 그려져도 음수 지연으로 이어서 재생해 튀지 않게 한다.
    const el = Date.now() - U.gFreshAt;
    const anim = fresh ? `animation:${el < 500 ? `gcIn .5s ease-out ${-el}ms both,` : ''}gcGlow 1.4s ease-in-out ${500 - el}ms ${Math.max(1, Math.ceil((9000 - el) / 1400))}` : '';
    return `<div class="gcard${fresh ? ' fresh' : ''}${min ? ' min' : ''}"${anim ? ` style="${anim}"` : ''}>
      <button class="gc-head" data-act="guide-fold" title="${min ? '펼치기' : '접기'}"><i>${icon('pin')}</i><b>길잡이</b>${isNew ? '<em>NEW</em>' : ''}<span class="gc-n">${q.cur}/${q.goal}</span><span class="gc-fold">${min ? '▸' : '▾'}</span></button>
      ${min ? '' : `<div class="gc-body"><div class="gc-t">${esc(q.title)}</div><div class="gc-h">${esc(q.hint)}</div><div class="gc-bar"><i style="width:${Math.round((100 * q.cur) / q.goal)}%"></i></div>${rew ? `<div class="gc-r">${esc(rew)}</div>` : ''}<button class="gc-all" data-act="menu-modal" data-m="guide">전체 목표 보기</button></div>`}
    </div>`;
  }
  function saveIndHtml() {
    const S = window.Server, inf = S && S.isIn() ? S.saveInfo() : null;
    if (!inf) return '<i class="si-dot local"></i>저장 안 됨 (게스트)';
    const hm = inf.at ? new Date(inf.at).toTimeString().slice(0, 5) : '';
    const m = { idle: ['ok', '서버 저장됨'], wait: ['wait', '저장 대기 중'], saving: ['wait', '저장 중…'], saved: ['ok', '서버 저장됨 ' + hm], error: ['err', '서버 저장 실패 · 다시 시도'] }[inf.state] || ['ok', ''];
    return `<i class="si-dot ${m[0]}"></i>${m[1]}`;
  }
  // 임시: 채팅에 개발자 코드를 치면 설정 창의 개발 도구가 열리고 닫힌다
  window.addEventListener('guild-dev-code', () => { U.devOn = !U.devOn; if (!U.devOn) { U.boost = false; U.forceSkill = false; U.showTalent = false; Guild.setSkillBoost(1); Guild.setForceSkill(false); } // 끄면 숨은 치트도 함께 꺼 둔다
    toast(U.devOn ? '🛠 개발자 모드 켜짐 (설정 창에 개발 도구가 나와요)' : '개발자 모드 꺼짐'); if (U.modal && U.modal.type === 'settings') render(); });
  function refreshSaveInd() { const e = document.getElementById('saveInd'); if (e) e.innerHTML = saveIndHtml(); }
  setInterval(refreshSaveInd, 3000);
  setInterval(() => { const gd = document.getElementById('guide'); if (gd && !document.hidden) { const h = guideCardHtml(); if (gd.innerHTML !== h) gd.innerHTML = h; } }, 1500);
  function topIcons() {
    return `<div class="top-icons"><span class="save-ind" id="saveInd">${saveIndHtml()}</span><button class="ibtn" data-act="menu-modal" data-m="help" title="도움말 (H)">${icon('help')}</button><button class="ibtn" data-act="menu-save" title="저장 (S)">${icon('save')}</button><button class="ibtn" data-act="menu-modal" data-m="settings" title="설정">${icon('gear')}</button></div>`;
  }
  function topbarHtml() {
    const res = `<div class="tb-res"><span title="현역 모험가 / 정원">${icon('people')}<b>${actives().length}</b> / ${Guild.rosterCap()}</span></div>`;
    const wallet = `<div class="tb-wallet tb-gold" title="길드 금고 (금화)">${icon('coin')}<b>${Guild.state.gold.toLocaleString()}</b><small>금화</small></div>`;
    return `<div class="tb-row"><div class="tb-name" title="${esc(Guild.state.guildName)}">${esc(Guild.state.guildName)}<small>${Guild.guildGrade()}급</small></div><div class="tb-tabs">${tabbarHtml()}</div><div class="tb-gap"></div>${stripHtml()}${res}${wallet}${topIcons()}</div>${subnavHtml()}`;
  }
  function subnavHtml() {
    const cat = curCat();
    if (cat.subs.length < 2) return '';
    const sub = (NAV[U.screen] || [])[1];
    const km = U.childMode;
    return `<div class="tb-sub${km ? ' keymode' : ''}"><span class="tb-path">${cat.label}</span>${cat.subs.map(([id, label], n) => `<button class="pill" aria-selected="${sub === id}" data-act="goto" data-screen="${id}"><kbd>${n + 1}</kbd>${label}${subCount(id) ? ` <b>${subCount(id)}</b>` : ''}</button>`).join('')}<span class="tb-hint">${km ? '숫자 키로 이동 · <b>Esc</b> 닫기' : '이 탭의 번호 키를 한 번 더 누르면 하위 메뉴가 열려요'}</span></div>`;
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
  // 체력 표시: 막대 + 퍼센트. 색으로 위험도를 바로 알 수 있다 (초록 70%↑ · 주황 40%↑ · 빨강)
  const hpLv = (f) => (f >= 0.7 ? 'hi' : f >= 0.4 ? 'mid' : 'lo');
  function hpMeter(c, cls) {
    if (!c || c.status !== 'ACTIVE') return '<span class="hpm none"></span>';
    const f = Guild.hpFrac(c), p = Math.round(f * 100);
    return `<span class="hpm ${cls || ''} ${hpLv(f)}" data-hpc="${c.id}" title="현재 체력 ${p}%"><em>체력</em><i style="width:${Math.max(3, p)}%"></i><b>${p}%</b></span>`;
  }
  const chk = (text, done) => `<div class="chk${done ? ' done' : ''}">${icon('diamond')}<span>${text}</span></div>`;


/* ---------- 클릭 처리 (data-act) — 이 화면의 동작을 ACT 표에 등록한다. false를 돌려주면 다시 그리지 않는다 ---------- */
Object.assign(ACT, {
  'goto'(el, id) {
    { const cid = (NAV[el.dataset.screen] || ['hub'])[0]; if (!Guild.unlockedCat(cid)) { toast('🔒 ' + CATS.find((x) => x.id === cid).label + ' 탭은 ' + Guild.lockReason(cid)); return; } U.screen = el.dataset.screen; U.childMode = false; return; }
  },
  'menu-save'(el, id) {
    { const ok = Guild.save(); toast(ok ? '저장했어요.' : '이 브라우저에서는 저장할 수 없어요.'); if (window.Server && Server.isIn()) Server.pushSave(true).then(refreshSaveInd); refreshSaveInd(); return; }
  },
  'guide-fold'(el, id) {
    { const gq = Guild.guideNow(); if (!gq) return; U.gSeen = gq.id;
          const wasOpen = !!el.closest('.gcard:not(.min)');
          if (U.screen === 'hub') { U.gFold = wasOpen; try { localStorage.setItem('guild_guide_fold', U.gFold ? '1' : '0'); } catch (e) { /* 무시 */ } } else U.gOpenScr = wasOpen ? null : U.screen;
          return; }
  },
  'menu-modal'(el, id) {
    U.modal = { type: el.dataset.m }; if (el.dataset.m === 'guide') { const gq = Guild.guideNow(); if (gq) U.gSeen = gq.id; } return;
  },
});
