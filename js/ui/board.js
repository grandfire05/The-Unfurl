/* ui/board.js — 의뢰 게시판 + 파티 편성
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

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
  // 편성 효과: 속성 상성·역할(스킬 기반)·속성 시너지를 편성 무대 아래에 한눈에 보여준다 (숫자는 전투 엔진과 같은 값)
  const ROLE_OF = { heal: '회복', healall: '회복', guard: '방어', guardall: '방어', shield: '방어', shieldall: '방어', aoe: '광역', dotall: '광역' };
  const rolesOf = (c) => { const set = new Set(); Engine.collectMods(engOf(c)).actives.forEach((a) => { const r = a.act && ROLE_OF[a.act.t]; if (r) set.add(r); }); return set; };
  function matchupOf(c, k) { // 몬스터 속성 기준 이 모험가의 상성: good(공격 ×1.3 / 부속성 ×1.15) · bad(공격 ×0.85, 방어 불리) · null
    const A = k.attr, B = Combat.BEATEN_BY; if (!A) return null;
    if (B[A] === c.mainAttribute) return { t: 'good', x: 1.3 };
    if (c.subAttribute && B[A] === c.subAttribute) return { t: 'good', x: 1.15 };
    if (B[c.mainAttribute] === A || c.mainAttribute === A) return { t: 'bad', x: 0.85 };
    return null;
  }
  const slotMatch = (c, k) => { // 슬롯 위: 속성 + (알고 있다면) 상성 표시
    const m = k && !Combat.isWait(k) && Guild.knowledge(k.monster) >= 2 ? matchupOf(c, k) : null;
    return `<span class="smatch${m ? ' ' + m.t : ''}">${esc(c.mainAttribute)}${m ? (m.t === 'good' ? ' ★' : ' ▼') : ''}</span>`;
  };
  function partyFx(party, k) {
    if (!k || !party.length || Combat.isWait(k)) return '';
    const chips = [];
    if (Guild.knowledge(k.monster) >= 2) {
      const ms = party.map((c) => ({ c, m: matchupOf(c, k) }));
      const good = ms.filter((x) => x.m && x.m.t === 'good'), bad = ms.filter((x) => x.m && x.m.t === 'bad');
      chips.push(good.length
        ? `<span class="chip skill" title="약점 속성(${k.weak})이면 공격 ×1.3, 부속성이면 ×1.15">약점 공략 ${good.length}/${party.length}명</span>`
        : `<span class="chip" title="약점 속성(${k.weak})을 가진 모험가가 없어요">약점 공략 없음</span>`);
      if (bad.length) chips.push(`<span class="chip d-danger" title="몬스터 속성(${k.attr})에 밀리는 모험가: 공격 ×0.85, 받는 피해가 늘 수 있어요">상성 불리 ${bad.map((x) => esc(x.c.name)).join('·')}</span>`);
    } else chips.push('<span class="chip" title="도감에서 이 몬스터를 알아가면 약점과 상성이 보여요">상성 불명</span>');
    if (party.length >= 2) {
      const have = new Set(); party.forEach((c) => rolesOf(c).forEach((r) => have.add(r)));
      [['회복', '다친 동료를 치료해요'], ['방어', '받는 피해를 줄이거나 보호막을 줘요'], ['광역', '여러 마리를 한꺼번에 공격해요']].forEach(([r, t]) => {
        chips.push(have.has(r) ? `<span class="chip d-safe" title="${t}">${r} ✓</span>` : `<span class="chip" title="${t} (파티에 이 역할이 없어요)">${r} 없음</span>`);
      });
      const attrs = party.map((c) => c.mainAttribute);
      if (new Set(attrs).size === party.length && party.some((c) => Engine.collectMods(engOf(c)).mods.allDiffAttr)) chips.push('<span class="chip skill" title="파티원의 주속성이 모두 달라서 속성 시너지 효과가 발동해요">속성 시너지</span>');
    }
    return `<div class="pfx">${chips.join('')}</div>`;
  }
  function partyBonds(party, k) {
    const rows = [];
    for (let i = 0; i < party.length; i++) for (let j = i + 1; j < party.length; j++) {
      const b = Guild.bondInfo(party[i].id, party[j].id);
      if (b.idx >= 1) rows.push(`<div class="kv"><span>${esc(party[i].name)} · ${esc(party[j].name)}</span><span>${b.name} +${Math.round(b.pct * 100)}%</span></div>`);
    }
    let discord = '';
    if (party.length > 3) {
      const hs = Guild.buildMembers(party), harm = hs.reduce((q, m) => q + (m.tw.harm || 0), 0) / hs.length, p = Math.round(Engine.discordChance(party.length, harm) * 100);
      discord = `<p class="small" style="color:#ffb36b">${party.length}명이라 호흡이 엇갈릴 수 있어요 — 전투 중 사고(동료 오사·틈 내줌) 확률 ${p}% / 약 10초마다. 유대가 깊을수록 줄어요.</p>`;
    }
    return (rows.length ? `<h3 style="margin-top:8px">유대</h3>${rows.join('')}` : '') + discord ;
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
        ${U.newK && U.newK.has(x.id) ? '<em class="qnew">NEW</em>' : ''}<span class="qhead"><span class="qgrade g-${x.grade}">${x.grade}</span><b class="qname">${esc(sn.title)}</b>${kindChip(x)}</span>
        <span class="qbody"><span class="qart">${Art.monster(x.art, '', x.hue, x.monster)}</span><span class="qinfo">
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
        ? `<button class="pslot${fresh ? ' pop' : ''}" data-act="party-toggle" data-id="${c.id}" aria-label="${c.name} 빼기"><span class="pic">${Art.character(c.appearance, { view: 'bust', label: c.name })}</span><span class="nameplate">${esc(c.name)} Lv.${c.level}</span>${hpMeter(c, 'md')}${slotMatch(c, k)}</button>`
        : `<div class="pslot empty"><span class="pic"><span class="ghost">+</span></span><span class="nameplate dim">${k && i < k.min ? '필요' : '선택'}</span></div>`;
    }).join('');
    const info = k ? `<div class="pinfo">${Combat.isWait(k) ? `<span class="chip">${Combat.TYPE_TEXT[k.type]} · ${k.type === 'gather' ? esc(k.item) + ' ' + (party.length ? Guild.gatherQty(k, party) : k.qty) + '개 예상 (운이 높은 사람이 많을수록 늘어요)' : esc(k.place)}</span><span class="chip">소요 ${Guild.waitMinutes(k, Math.max(1, party.length))}분${k.type === 'help' ? ' (사람이 많을수록 빨라져요)' : ''} · 실시간 확인 없음</span>` : `<span class="chip">${Combat.TYPE_TEXT[k.type]} · ${monLabel(k)} ${k.total}마리</span><span class="chip">${sizeText(k)}</span><span class="chip">전투 시간 미정</span>${wk(k) ? `<span class="chip skill">약점 ${wk(k)}</span>` : '<span class="chip">약점 불명</span>'}`}${k.relics && k.relics.length ? `<span class="chip skill">유품 ${k.relics.length}</span>` : ''}${d ? dangerChip(d) : ''}</div>` : '';
    const scene = `<div class="scene party q plain">${info}<div class="pslots">${stands}</div>${partyFx(party, k)}</div>`;
    const why = !k ? '의뢰를 골라 주세요' : party.length < k.min ? `${k.min}명 이상 골라 주세요` : block ? '등급이 모자라요' : '';
    const mm = U.matMode === 'sell' ? 'sell' : 'take', fr = k ? (k.tutorial ? 0.16 : Guild.takeFeeRate(k)) : 0;
    const matDesc = !k ? '' : k.type === 'gather'
      ? (mm === 'take' ? `재료는 보급고로 들어와요. 모험가에게 재료 시세만큼(약 ${k.qty * Guild.matUnit(k.item)}금) 수수료를 길드가 내요.` : '재료를 모험가가 팔아요. 대금은 24시간 뒤 모험가 지갑에 들어와요. 길드는 재료도 돈도 없어요.')
      : (mm === 'take' ? `나온 재료는 보급고로 들어와요. 모험가 수수료가 +${Math.round(fr * 100)}% 늘어 길드 수입이 그만큼 줄어요.` : '재료는 모험가가 팔아요. 대금은 24시간 뒤 지갑에 들어오고 수수료는 늘지 않아요.');
    const lock = '';
    const matBar = k && k.type !== 'help' ? `<div class="policy mat-bar"><span class="muted">재료</span>${[['take', '재료 받기'], ['sell', '안 받기']].map(([pk, nm]) => `<button class="pill" aria-selected="${mm === pk}" data-act="matmode" data-p="${pk}"${lock}>${nm}</button>`).join('')}<span class="small pdesc">${matDesc}</span></div>` : '';
    const polBar = k && !Combat.isWait(k) ? `<div class="policy pol-bar"><span class="muted">출정 방침</span>${Object.entries(Guild.POLICIES).map(([pk, p]) => `<button class="pill" aria-selected="${(U.policy || 'balanced') === pk}" data-act="policy" data-p="${pk}"${lock} title="${p.desc}">${p.name}</button>`).join('')}<span class="small pdesc">${Guild.POLICIES[U.policy || 'balanced'].desc}${k.tutorial ? ' (연습 의뢰는 균형으로 적용돼요)' : ''}</span></div>` : '';
    const center = `<section class="cpanel">${chead('원정대 편성')}${scene}${polBar}${matBar}<div class="actbar" style="grid-template-columns:1.6fr 1fr 1fr">
      <button class="act primary" data-act="dispatch"${ok ? '' : ' disabled'}>${why || '출정!'} ${icon('check')}</button>
      <button class="act" data-act="recommend"${k && free.length ? '' : ' disabled'}>자동 편성 ${icon('star')}</button>
      <button class="act" data-act="clear-party"${party.length ? '' : ' disabled'}>해산 ${icon('cross')}</button></div></section>`;

    // 오른쪽: 출발 점검 + 후보 목록
    const check = `<section class="parch tight qpaper">${k ? `<div class="qp-head"><span class="qgrade g-${k.grade}">${k.grade}</span><b>${k.name}</b></div><p class="small">${Combat.TYPE_TEXT[k.type]} · ${k.type === 'gather' ? '재료 ' + esc(k.item) + ' ' + k.qty + '개 (시세 약 ' + k.qty * Guild.matUnit(k.item) + '금)' : '금화 ' + k.gold} · 경험 ${k.exp}<br>마감 <span data-eta-left="${k.expiresAt}">${leftText(k.expiresAt - Guild.now())}</span><br>${fameText(k, true)}</p><hr class="rule">` : ''}<h3>출정 준비</h3>
      ${chk(k ? `인원 ${sizeText(k)} (현재 ${party.length}명)` : '인원', k && party.length >= k.min && party.length <= k.max)}${k ? chk(block ? esc(block) : `수주 등급 (${k.grade}급 의뢰)`, !block) : ''}${party.length ? (() => { const av = party.reduce((a, c) => a + Guild.hpFrac(c), 0) / party.length, lowN = party.filter((c) => Guild.hpFrac(c) < 0.7).length; return chk(`파티 평균 체력 ${Math.round(av * 100)}%${lowN ? ` · 체력이 낮은 모험가 ${lowN}명` : ''}`, lowN === 0); })() : ''}${party.length >= 3 ? chk('회복 스킬 보유', party.some(canHeal)) : ''}${k && wk(k) ? chk(`약점 속성 ${wk(k)}`, weakHit) : ''}${partyBonds(party, k)}</section>`;
    const score = (c) => c.level + (weakOf(c) ? 6 : 0);
    const cs = U.candSort;
    const sorted = free.slice().sort((a, b) => (cs === 'level' ? b.level - a.level : cs === 'class' ? clsOf(a).localeCompare(clsOf(b), 'ko') || b.level - a.level : (fullHp(b) - fullHp(a)) || score(b) - score(a)));
    const busy = actives().length - free.length;
    const cand = sorted.map((c) => `<button class="item${U.party.includes(c.id) ? ' sel' : ''}" data-act="party-toggle" data-id="${c.id}">${av(c)}<span class="grow"><span class="nm">${esc(c.name)}${weakOf(c) ? ' ★' : ''}</span><br><span class="sub">${Guild.rankLabel(c)}급 · Lv.${c.level} · ${esc(clsOf(c))} · ${attrText(c)}${canHeal(c) ? ' · 회복' : ''}</span></span>${hpMeter(c, 'md')}${U.party.includes(c.id) ? icon('check') : ''}</button>`).join('')
      || '<p class="empty">보낼 수 있는 모험가가 없어요.</p>';
    const pl = (kk, l) => `<button class="pill" aria-selected="${cs === kk}" data-act="cand-sort" data-k="${kk}">${l}</button>`;
    const right = `<div class="col"><section class="dpanel"><div class="dhead"><h2>대기 모험가 ${free.length}명</h2></div><div class="pills">${pl('rec', '추천순')}${pl('level', '레벨')}${pl('class', '직업')}</div>
      <div class="list" data-keep="cand-list">${cand}</div>${busy > 0 ? `<p class="small muted" style="padding:0 12px 8px">의뢰·훈련 중 ${busy}명</p>` : ''}</section></div>`;

    return `<div class="pscreen">${Art.hall()}<div class="qb">${cork}<div class="qdesk">${check}${center}${right}</div></div></div>`;
  }


/* ---------- 클릭 처리 (data-act) — 이 화면의 동작을 ACT 표에 등록한다. false를 돌려주면 다시 그리지 않는다 ---------- */
Object.assign(ACT, {
  'quest-sel'(el, id) {
    U.contract = id; U.tutPicked = true; return;
  },
  'to-quests'(el, id) {
    U.party = [id]; U.screen = 'quests'; return;
  },
  'party-toggle'(el, id) {
    {
          const k = Guild.board.find((x) => x.id === U.contract);
          if (U.party.includes(id)) U.party = U.party.filter((x) => x !== id);
          else if (k && U.party.length >= k.max) toast(`이 의뢰는 최대 ${k.max}명까지 보낼 수 있어요.`);
          else U.party.push(id);
          return;
        }
  },
  'qlist'(el, id) {
    U.modal = { type: 'qlist', cid: el.dataset.cid }; return;
  },
  'qhist'(el, id) {
    U.modal = { type: 'qhist', cid: el.dataset.cid, i: Number(el.dataset.i) }; return;
  },
  'clear-party'(el, id) {
    U.party = []; return;
  },
  'cand-sort'(el, id) {
    U.candSort = el.dataset.k; return;
  },
  'recommend'(el, id) {
    {
          const k = Guild.board.find((x) => x.id === U.contract);
          if (k) { U.party = recommendParty(k, idleHeroes()); if (!U.party.length) toast('체력이 100%인 모험가가 없어요.'); }
          return;
        }
  },
  'policy'(el, id) {
    U.policy = el.dataset.p; (U.tutTry = U.tutTry || {}).pol = 1; return;
  },
  'matmode'(el, id) {
    U.matMode = el.dataset.p; (U.tutTry = U.tutTry || {}).mat = 1; return;
  },
  'dispatch'(el, id) {
    {
          const k = Guild.board.find((x) => x.id === U.contract);
          const party = U.party.map(byId);
          const go = () => {
            const res = Guild.sendParty(U.contract, U.party, U.policy, U.matMode);
            if (!res.ok) toast(res.reason);
            else { Sound.play('dispatch'); toast('파티가 출발했어요. 위기 신호는 홈과 알림으로 알려 드려요.'); flash('#ffd166'); U.party = []; U.contract = null; if (k && k.tutorial) { U.policy = 'balanced'; U.matMode = 'take'; } }
            render();
          };
          if (k && !Combat.isWait(k) && party.length >= k.min) {
            const d = dangerFor(party, k);
            const avg = party.reduce((a, c) => a + c.level, 0) / party.length;
            if (d.key === 'danger' || d.key === 'extreme') {
              U.modal = { type: 'confirm', title: '정말 보낼까요?', text: `이 파티에게는 <b>${d.text}</b>한 의뢰예요.<br>위기가 오면 결정 시간 안에 후퇴할 수 있지만, 체력이 0이 된 모험가는 그 자리에서 사망해요.`, yes: '그래도 출발', no: '다시 고르기', onYes: go };
              return;
            }
          }
          go();
          return;
        }
  },
});
