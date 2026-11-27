/* ui/records.js — 연대기·업적·추모비·도감
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

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
          ${c.epitaph ? `<p class="epi">「${esc(c.epitaph)}」</p>` : ''}
          ${c.keepsake ? `<div class="mc-keep">유품 · ${esc(c.keepsake)}${c.heirName ? ` <span class="sub">→ ${esc(c.heirName)}에게 이어짐</span>` : ''}</div>` : ''}</div>
        <div class="mc-foot">${Guild.mournable(c) ? `<button class="btn sm" data-act="mourn" data-id="${c.id}">추모식 · 금화 ${Guild.MOURN_COST}</button>` : '<span class="sub">추모식을 마쳤어요</span>'}</div></article>`;
    }).join('');
    const left = `<div class="scroll lines"><p>잃은 모험가 <b>${dead.length}</b>명</p><p class="small">모험가가 죽으면 함께 갔다가 살아 돌아온 동료는 슬픔에 잠겨 6~24시간 동안 의뢰에 나갈 수 없어요.<br>추모식을 열면 슬픔이 바로 풀려요. 비용은 금화 ${Guild.MOURN_COST}이에요.<br>같이 나갔던 동료가 한 명이라도 돌아왔다면 사망 원인을 알 수 있어요. 모두 쓰러졌다면 알 수 없어요.</p></div>`;
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
      <p class="small muted" style="padding:6px 16px">오른쪽 분류로 기록을 골라 볼 수 있어요.</p></section></div>`;
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
  const SKILL_ICON_PATH = 'img/skill/'; // img/skill/{번호}.png 가 있으면 그림을, 없으면 별 모양을 쓴다
  const skillIco = (id, cls) => `<span class="sk-ico${cls ? ' ' + cls : ''}">${icon('star')}${SKILL_ICON_PATH && id != null ? Assets.imgTag('sk-img', [`${SKILL_ICON_PATH}${id}.png`]) : ''}</span>`;
  if (window.Chat) Chat.setSkillInfo((id) => (Character.SKILL_NAMES[id] ? { name: esc(Character.SKILL_NAMES[id]), text: esc(skillEffect(id)), icon: skillIco(id) } : null));
  function codexHtml() {
    const reg = Guild.registry;
    const seenSkills = [];
    for (let i = 0; i < Character.SKILL_COUNT; i++) if (reg.historyOf(i).length || reg.isForeign(i)) seenSkills.push(i); // 다른 길드가 얻은 스킬도 발견으로 친다
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
        return `<article class="cx-card mon"><div class="cx-mon">${Art.monster(m.art, '', m.hue, m.name)}</div><div class="cx-body"><div class="cx-top"><span class="chip qg">${m.grade}</span>${m.boss ? '<span class="chip hot">보스</span>' : '<span class="chip">무리</span>'}<span class="cx-no">정보 ${m.kn}/3</span></div>
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


/* ---------- 클릭 처리 (data-act) — 이 화면의 동작을 ACT 표에 등록한다. false를 돌려주면 다시 그리지 않는다 ---------- */
Object.assign(ACT, {
  'chr-filter'(el, id) {
    U.chrFilter = el.dataset.k; return;
  },
  'codex-tab'(el, id) {
    U.codexTab = el.dataset.k; U.codexSel = null; return;
  },
  'sk-filter'(el, id) {
    U.skFilter = el.dataset.k; return;
  },
  'mourn'(el, id) {
    { const r = Guild.mourn(id); toast(r.ok ? '추모식을 열었어요.' : r.reason); return; }
  },
  'ach-cat'(el, id) {
    U.achCat = el.dataset.k; return;
  },
});
