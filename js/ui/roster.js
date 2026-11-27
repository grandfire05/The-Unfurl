/* ui/roster.js — 모험가 명부
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

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
      return `<button class="rrow${x.id === U.selId ? ' sel' : ''}" data-act="sel" data-id="${x.id}">${av(x)}<span class="rn">${esc(x.name)}</span><span class="rg g-${x.grade}">${x.grade}</span><span class="rk">${Guild.rankLabel(x)}급</span><span class="rl">Lv.${x.level}</span><span class="rc">${esc(clsOf(x))}</span>${hpMeter(x, 'sm')}
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
      const gear = Gear.SLOTS.map(([sl, l]) => { const it = c.equip && c.equip[sl]; return `<div class="fx geq">${it ? gIcon(it) : `<span class="gicon empty"><i data-i18n="off">${(window.I18n ? I18n.tr(l) : l)[0]}</i></span>`}<b>${l}</b><span class="${it ? 'q q' + it.q : 'muted'}">${it ? esc(Gear.itemName(it)) + ' · ' + statText(it) : '없음'}</span></div>`; }).join('');
      const bonds = Guild.bondsOf(c.id).slice(0, 4).map((b) => `<div class="fx"><b>${b.other.status === 'DEAD' ? '† ' : ''}${esc(b.other.name)}</b><span>${b.name} <span class="bar"><i style="width:${b.value}%"></i></span></span></div>`).join('') || '<div class="muted small">아직 가까운 동료가 없어요.</div>';
      const stateTxt = c.status === 'DEAD' ? `사망 · ${dateText(c.diedAt)}` : c.status === 'LEFT' ? `이탈 · ${dateText(c.leftAt)}` : s.state === 'training' ? `훈련 중 <span class="eta" data-eta="${s.until}">${clock(s.until - Guild.now())}</span>` : s.state === 'mourn' ? `전우를 잃고 슬픔에 잠김 <span class="eta" data-eta="${s.until}">${clock(s.until - Guild.now())}</span> · 기념비에서 추모식을 열면 바로 풀려요` : s.state === 'recover' ? `회복중 · 체력 ${Math.round(s.hp * 100)}% <span class="eta" data-eta="${s.until}">${clock(s.until - Guild.now())}</span>` : s.mission ? (s.mission.wait ? `${Combat.TYPE_TEXT[s.quest.type]} 중 <span class="eta" data-eta="${s.endsAt}">${clock(s.endsAt - Guild.now())}</span>` : '의뢰 전투 중') : '대기 중';
      const acts = [];
      if (c.status === 'LEFT') acts.push(`<button class="btn" data-act="return-char" data-id="${c.id}"${Guild.state.gold >= Guild.returnCost() ? '' : ' disabled'}>복귀 (금화 ${Guild.returnCost()})</button>`);
      if (c.status === 'ACTIVE' && Character.needsAdvance(c)) acts.push(`<button class="btn" data-act="open-advance" data-id="${c.id}">전직하기</button>`);
      if (c.status === 'ACTIVE' && s.state === 'training') acts.push(`<button class="btn ghost" data-act="cancel-train" data-id="${c.id}">훈련 취소</button>`);
      if (c.status === 'ACTIVE' && s.mission && !s.mission.wait) acts.push(`<button class="btn ghost" data-act="view-battle" data-id="${s.mission.id}">전투 보기</button>`);
      if (c.status === 'ACTIVE') acts.push(`<button class="btn ghost" data-act="reset-char" data-id="${c.id}"${Guild.resetTickets() > 0 && s.state === 'idle' ? '' : ' disabled'}>초기화 (${Guild.resetTickets()}장)</button>`);
      right = `<section class="ros-detail">
        <div class="rd-head">${Art.character(c.appearance, { view: 'bust', label: c.name })}<div class="rd-title"><h2>${esc(c.name)}</h2>
          ${c.status === 'ACTIVE' ? `<div class="rd-hp">${hpMeter(c, 'lg')}</div>` : ''}<div class="rd-chips"><span class="chip g-${c.grade}">희귀도 ${c.grade}</span><span class="chip">${Guild.rankLabel(c)}급 모험가</span>${sk ? `<span class="chip skill">★ ${esc(sk)}</span>` : ''}<span class="chip ${s.state}">${stateTxt}</span></div></div>
          <div class="rd-acts">${acts.join('')}</div></div>
        <div class="rd-grid">
          <div class="rd-box"><h3>기본 정보</h3>
            ${kv('레벨', `Lv.${c.level} <small>${expText(c)}</small>`)}${kv('종족', esc(Appearance.raceName(c.appearance)))}${kv('직업', c.path.map(esc).join(' › '))}${kv('속성', attrText(c))}
            ${kv('등급 점수', rp.next ? `${rp.pts - rp.cur} / ${rp.next - rp.cur}` : '최고 등급')}${kv('처치 · 의뢰', `${c.kills || 0}마리 · ${c.quests || 0}건`)}${kv('합류', dateText(c.recruitedAt))}${kv('지갑', `${c.wallet || 0}금`)}
            ${Guild.mourningUntil(c) ? kv('슬픔', `출정 불가 <span class="eta" data-eta="${Guild.mourningUntil(c)}">${clock(Guild.mourningUntil(c) - Guild.now())}</span>`) : ''}${U.showTalent ? kv('재능(개발)', c.talent) : ''}</div>
          <div class="rd-box"><h3>능력치</h3><div class="stgrid">${statRows}</div></div>
          <div class="rd-box"><h3>특성</h3>${fxTrait}</div>
          <div class="rd-box"><h3>스킬</h3>${fxSkill}</div>
          <div class="rd-box"><h3>장비</h3>${gear}</div>
          <div class="rd-box"><h3>관계</h3>${bonds}${(c.heirs || []).map((h) => `<div class="fx"><b>유지</b><span title="${esc(h.from)}의 유품을 이어받음: 공격·방어 +3%">${esc(h.from)}의 「${esc(h.item)}」</span></div>`).join('')}</div>
          ${c.status === 'DEAD' ? `<div class="rd-box wide"><h3>마지막 기록</h3><div class="fx"><b>사인</b><span title="${esc(c.deathCause || '')}">${esc(c.deathCause || '')}</span></div></div>` : ''}
        </div></section>`;
    }
    return `<div class="ros">${left}${right}</div>`;
  }
  const expText = (c) => (c.level >= Character.MAX_LEVEL ? '최고 레벨' : Character.needsAdvance(c) ? '전직 필요' : `${c.exp || 0} / ${Character.expNeeded(c.level)}`);


/* ---------- 클릭 처리 (data-act) — 이 화면의 동작을 ACT 표에 등록한다. false를 돌려주면 다시 그리지 않는다 ---------- */
Object.assign(ACT, {
  'open-char'(el, id) {
    openChar(id); return;
  },
  'cancel-train'(el, id) {
    { const r = Guild.cancelTraining(id); toast(r.ok ? '훈련을 취소했어요. 들인 시간은 돌아오지 않아요.' : r.reason); return; }
  },
  'open-dead'(el, id) {
    U.screen = 'roster'; U.tab = 'dead'; U.selId = null; return;
  },
  'tab'(el, id) {
    U.tab = el.dataset.tab; U.selId = null; return;
  },
  'sel'(el, id) {
    U.selId = id; return;
  },
  'roster-sort'(el, id) {
    U.rosterSort = el.dataset.k; return;
  },
  'return-char'(el, id) {
    { const r = Guild.returnCharacter(id); toast(r.ok ? '길드로 돌아왔어요.' : r.reason); return; }
  },
  'reset-char'(el, id) {
    {
          const c0 = byId(id);
          U.modal = { type: 'confirm', title: `${c0 ? c0.name : ''} 초기화`, text: '초기화권을 써서 <b>레벨·전직 경로·모험가 등급·유대</b>를 처음으로 되돌려요.<br>외형, 희귀도, 재능, 기본 직업, 고유스킬, 장비는 그대로예요. 되돌릴 수 없어요.', yes: '초기화한다', no: '취소', onYes: () => { const r = Guild.resetCharacter(id); toast(r.ok ? '처음부터 다시 시작해요.' : r.reason); } };
          return;
        }
  },
  'open-advance'(el, id) {
    U.modal = { type: 'advance', id }; return;
  },
  'advance-go'(el, id) {
    { const r = Guild.advanceCharacter(id, el.dataset.cls); U.modal = null; toast(r.ok ? '전직했어요.' : r.reason); return; }
  },
  'open-talk'(el, id) {
    if (!Guild.inLobby(id)) { toast('로비에 나와 있는 모험가와만 이야기할 수 있어요.'); return; } U.modal = { type: 'talk', id, opts: Guild.talkOptions(id), msgs: [{ who: 'them', text: '무슨 일이세요, 마스터?' }], typing: false }; return;
  },
  'talk-pick'(el, id) {
    {
          const m = U.modal; if (!m || m.type !== 'talk' || m.typing) return;
          const q = Number(el.dataset.q), r = Guild.talk(m.id, q);
          if (!r.ok) { toast(r.reason); return; }
          m.msgs.push({ who: 'me', text: Dialog.question(q) }); m.typing = true; m.opts = [];
          const delay = 900 + Math.min(1400, r.line.length * 22) + Math.random() * 500;
          setTimeout(() => {
            if (U.modal !== m) return;
            m.typing = false; m.msgs.push({ who: 'them', text: r.line }); m.opts = Guild.talkOptions(m.id);
            render(); const cl = document.querySelector('.chat-log'); if (cl) cl.scrollTop = cl.scrollHeight;
          }, delay);
          return;
        }
  },
  'open-train'(el, id) {
    U.modal = { type: 'train', id }; return;
  },
  'train-go'(el, id) {
    { const r = Guild.startTraining(id, Number(el.dataset.min)); U.modal = null; toast(r.ok ? '훈련을 시작했어요.' : r.reason); return; }
  },
});
