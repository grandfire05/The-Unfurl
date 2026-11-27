/* ui/battle.js — 전투(의뢰 진행) 화면
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

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
  const monHtml = (mm, idx, px, k) => `<div class="b-mon${mm.alive ? '' : ' down'}" data-midx="${mm.idx}"><span style="display:block;width:${px}px">${Art.monster(k.art, '', k.hue || 1, k.monster).replace('style="filter:', `style="width:100%;height:auto;animation-delay:${(idx * 0.27).toFixed(2)}s;filter:`)}</span>
      <div class="hpbar" data-mbar="${mm.idx}"><i style="width:${Math.max(mm.alive ? 2 : 0, Math.round(mm.r * 100))}%"></i></div><span class="shadow" style="width:${px}px;margin-left:-${px / 2}px"></span></div>`;
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
      const cls = h.state === 'down' ? ' out down' : '';
      const pct = Math.max(h.state === 'fit' ? 2 : 0, Math.round((h.hp / h.hpMax) * 100));
      return `<div class="b-hero${cls}" style="--i:${idx}" data-hid="${h.id}" data-role="${heroRole(c)}" data-tone="${heroTone(c)}">${Art.character(c.appearance, { label: c.name })}<span class="nameplate b">${c.name} Lv.${c.level}</span>
        <div class="hpbar hero${h.crisis ? ' low' : ''}" data-hbar="${h.id}"><i style="width:${pct}%"></i></div><div class="agauge" data-gid="${h.id}" title="행동 게이지: 가득 차면 공격해요. 속도가 높을수록 빨리 차요"><i></i></div><div class="hptxt" data-htxt="${h.id}">${h.state === 'down' ? '사망' : `HP ${h.hp}/${h.hpMax}`}</div><span class="shadow"></span></div>`;
    }).join('');

    // 몬스터 (오른쪽): 지금 싸우는 몇 마리만 그린다
    const shownMons = shownMonsOf(v);
    const px = Math.round((MON_PX[k.art] || 120) * (shownMons.length > 3 ? 0.62 : shownMons.length > 1 ? 0.8 : 1));
    const enemies = shownMons.map((mm, idx) => monHtml(mm, idx, px, k)).join('');
    const more = v.alive > shownMons.length ? `<div class="b-more">+${v.alive - shownMons.length}마리</div>` : '';
    const waveTxt = ` · 몬스터 <span data-balive="${m.id}">${v.alive}</span> / ${st.total}마리`;
    const feed = (vv) => vv.feed.map((f) => `<div class="${f.bad ? 'bad' : f.good ? 'good' : ''}">${esc(f.text)}</div>`).join('') || '<div class="muted">전투가 막 시작됐어요.</div>';

    const switcher = ms.length > 1
      ? `<div class="b-switch">${ms.map((x) => { const c0 = byId(x.memberIds[0]); const al = Guild.missionInfo(x).state === 'alert';
          return `<button class="avbtn${x.id === m.id ? ' sel' : ''}${al ? ' alert' : ''}" data-act="view-battle" data-id="${x.id}" aria-label="${x.contract.name}">${Art.character(c0.appearance, { view: 'bust', label: c0.name })}</button>`; }).join('')}</div>` : '';

    let bottom;
    if (alert) {
      const nmL = i.crisis.map((id) => st.m.find((y) => y.id === id).name), lastN = nmL[nmL.length - 1] || '';
      const who = nmL.length ? nmL.join(', ') + (nmL.length > 1 ? ' 모두' : '') + (lastN && hasBatchim(lastN) ? '이' : '가') + ' 위험해요' : '';
      const al = v.mons.filter((mm) => mm.alive), avg = al.length ? Math.round(al.reduce((q, mm) => q + mm.r, 0) / al.length * 100) : 0;
      // 전황(체력)과 동료 의견을 한 줄로 합쳐, 인원이 많아도 창이 낮게 유지된다
      const opin = {}; (i.council || []).forEach((o) => { opin[o.name] = o; });
      const cvOf = {}; i.cover.forEach((x) => { cvOf[x.id] = x; });
      const canCover = i.cover.length > 1;
      const heroRows = v.heroes.filter((h) => h.state !== 'out').map((h) => {
        const f = h.hp / h.hpMax, p = Math.round(f * 100), dn = h.state === 'down', nm = byId(h.id).name, o = opin[nm], cv = cvOf[h.id];
        const say = dn ? '<span class="cr-gone">쓰러졌어요</span>' : o ? `<em class="${o.side}">${o.side === 'fight' ? '싸우자' : '물러나자'}</em><span class="cr-ln">“${esc(o.line)}”</span>` : '';
        const stay = cv && canCover ? `<button class="cr-stay" data-act="decide" data-choice="cover" data-mid="${m.id}" data-id="${cv.id}" title="${esc(nm)}이(가) 남아 퇴각을 돕는다">남기기 <b>생환 ${Math.round(cv.p * 20) * 5}%</b></button>` : '<span></span>';
        return `<div class="cr-hero${dn ? ' dn' : ''}${o ? ' ' + o.side : ''}"><span class="n">${esc(nm)}</span><span class="hpm md ${hpLv(f)}"><i style="width:${dn ? 0 : Math.max(3, p)}%"></i><b>${dn ? '사망' : p + '%'}</b></span>${say}${stay}</div>`;
      }).join('');
      const cover = canCover
        ? '<div class="cr-cover"><span class="lbl">엄호 후퇴 <small>줄 끝의 <b>남기기</b>를 누르면 그 모험가가 남아 퇴각을 돕고, 쓰러뜨린 만큼 다음 도전이 쉬워져요</small></span></div>'
        : '<div class="cr-cover locked"><span class="lbl">🔒 엄호 후퇴 <small>파티에 2명 이상 서 있을 때만 고를 수 있어요</small></span></div>';
      bottom = `<div class="crisis">
        <div class="cr-head"><span class="cr-t">${icon('alert')}위기 신호!</span><span class="cr-who">${who}</span><span class="cr-timer">${m.contract.tutorial ? '연습이라 결정 제한이 없어요' : `결정 제한 <b class="eta" data-eta="${i.deadline}">${clock(i.deadline - Guild.now())}</b>`}</span></div>
        <div class="cr-sum"><span>남은 적 <b>${v.alive}마리</b>${al.length ? ` · 평균 체력 <b>${avg}%</b>` : ''}</span><span>계속 싸울 때 아무도 안 죽을 가능성 <b class="hint">${i.hint}</b></span></div>
        <div class="cr-list">${heroRows || '<div class="muted">남은 동료가 없어요.</div>'}</div>
        ${cover}
        <div class="cr-foot"><span class="cr-warn">체력이 0이 되면 그 모험가는 영구 사망해요 · 정하지 않으면 자동으로 계속 싸워요</span>
          <div class="btns"><button class="bigbtn" data-act="decide" data-choice="retreat" data-mid="${m.id}">전체 후퇴</button>${m.contract.tutorial ? '<button class="bigbtn locked" disabled title="연습에서는 전체 후퇴만 고를 수 있어요">🔒 계속 싸운다</button>' : `<button class="bigbtn danger" data-act="decide" data-choice="continue" data-mid="${m.id}">계속 싸운다</button>`}</div></div></div>`;
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


/* ---------- 클릭 처리 (data-act) — 이 화면의 동작을 ACT 표에 등록한다. false를 돌려주면 다시 그리지 않는다 ---------- */
Object.assign(ACT, {
  'view-battle'(el, id) {
    { const mm = Guild.missionById(id); if (mm && mm.wait) { toast('채집·도움은 돌아올 때까지 실시간 확인이 없어요.'); return; } } U.battle = id; U.screen = 'battle'; return;
  },
  'decide'(el, id) {
    if (el.dataset.choice !== 'retreat' && Guild.missionById(el.dataset.mid) && Guild.missionById(el.dataset.mid).contract.tutorial) { toast('연습에서는 전체 후퇴를 눌러 보세요.'); return; }
          if (el.dataset.choice === 'continue') {
            const mid = el.dataset.mid;
            U.modal = { type: 'confirm', title: '계속 싸울까요?', text: (Guild.missionById(mid) && Guild.missionById(mid).contract.tutorial) ? '연습 의뢰라 몬스터가 약해서 안전해요. 실전에서는 파티원이 쓰러질 수 있고, 체력이 0이 되면 <b>영구 사망</b>해요.' : '계속 싸우면 파티원이 쓰러질 수 있고, 체력이 0이 되는 파티원은 즉시 <b>영구 사망</b>해요.', yes: '계속 싸운다', no: '돌아가기', onYes: () => doDecide(mid, 'continue') };
          } else doDecide(el.dataset.mid, el.dataset.choice, id);
          return;
  },
});
