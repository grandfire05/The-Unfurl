/* ui/modals.js — 모달(우편함·귀환 보고·채용 연출·설정·도움말 등)
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

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
      const badge = x.fate === 'dead' ? '<i class="rc-b dead">†</i>' : x.fate === 'injured' ? '<i class="rc-b hurt">+</i>' : x.newLevel > x.oldLevel ? '<i class="rc-b lv">▲</i>' : '';
      const lines = [
        x.hpAfter !== undefined ? `체력 ${Math.round(x.hpAfter * 100)}%` : '',
        x.exp ? `경험치 +${x.exp}` : '',
        x.newLevel > x.oldLevel ? `<b class="up">Lv.${x.oldLevel} → ${x.newLevel}</b>` : '',
        x.rankPts ? `등급 점수 +${x.rankPts}` : '',
        x.rankUp ? `<b class="gold">${x.rankUp}급 승급!</b>` : '',
      ].filter(Boolean).join(' · ');
      const last = x.fate === 'dead' && x.lastWords ? `<span class="rc-last">「${esc(x.lastWords)}」</span>` : '';
      const heir = x.heir ? `<span class="rc-heir">♥ ${esc(x.heir.name)}${x.heir.name ? '이(가)' : ''} 「${esc(x.heir.item)}」을(를) 이어받았어요 (공격·방어 +3%)</span>` : '';
      return `<div class="rc-mem ${x.fate}"><span class="rc-face">${face}${badge}</span><span class="rc-mi"><b>${esc(x.name)}</b><span class="rc-fate">${fate[x.fate]}</span><span class="rc-ml">${lines}</span>${last}${heir}</span></div>`;
    }).join('');
    const story = (r.episodes || []).length ? `<div class="rc-story">${r.episodes.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : '';
    const gearTexts = new Set((r.gear || []).map((g) => g.text));
    const gearBox = (r.gear || []).map((g) => `<div class="rc-gear"><span class="rg-ic">${gIcon(g.item, 'lg')}</span><span class="rg-t"><i class="rg-tag">✦ ${esc(g.label === '드롭' ? '장비 획득' : g.label)}</i><b class="q q${g.item.q}">${esc(Gear.itemName(g.item))}</b> <span class="chip qg">${Gear.GRADES[g.item.g]}</span><br><span class="sub">${esc(g.text)}</span></span></div>`).join('');
    const notes = [
      ...(r.drops || []).filter((d) => !gearTexts.has(d)).map((d) => `<div class="rc-note">▸ ${esc(d)}</div>`),
      r.outcome !== 'win' && r.outcome !== 'train' ? '<div class="rc-note dim">▸ 의뢰는 게시판에 그대로 남았어요.</div>' : '',
      ...(r.bonds || []).map((bd) => `<div class="rc-note bond">♥ ${esc(bd.a)}${bd.b ? ' · ' + esc(bd.b) : ''} — ${bd.name}</div>`),
      r.auto ? '<div class="rc-note dim">▸ 결정 시간이 지나 자동으로 처리됐어요.</div>' : '',
    ].join('');
    return `<article class="rcard ${kind}${gearBox ? ' hasgear' : ''}"><header class="rc-head"><span class="rc-ico">${icon(ic)}</span><div class="rc-t"><b class="rc-title">${kind === 'dead' && r.outcome === 'win' ? '「' + title + '」 — 슬픈 승리' : '「' + title + '」'}</b><span class="rc-sub">${dateText(r.t)}</span></div>${gearBox ? '<span class="rc-gearflag">장비 획득!</span>' : ''}<span class="rc-stamp">${stamp}</span></header>
      ${rewards ? `<div class="rc-rewards">${rewards}</div>` : ''}${gearBox}
      <div class="rc-party">${members}</div><div class="rc-extra">${story}${notes ? `<div class="rc-notes">${notes}</div>` : ''}
      ${r.log.length ? `<details class="rc-log"><summary>전투 기록 보기</summary><ul>${r.log.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}</div>
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
    cells.unshift('<div class="rv-si" style="--c:#6f7899">???</div>'); // 돌기 전 첫 칸은 가려진 값
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
  function revFinish(rv) { U.revFin = U.modal && String(U.modal.id) === String(rv.dataset.rid) ? U.modal.id : rv.dataset.rid; if (tutOn()) { tutAdvance(); render(); } }
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
    if (sr) revealTimers.push(setTimeout(() => { sr.classList.add('boom-done'); skillSwap(sr); }, 6500)); // 고유스킬 칸은 다른 칸처럼 담담하게 이름으로 바뀐다
    revealTimers.push(setTimeout(() => { rv.classList.add('done'); Guild.flushAnnounce(rv.dataset.rid); revFinish(rv); }, 7000));
  }
  // 슬롯이 멈추는 순간의 손맛: 색 번쩍임 + 튀어오르는 글자 + 입자, 높은 희귀도는 화면 흔들림까지
  function rvJuice(rv, row) {
    if (rv.classList.contains('skip') || row.dataset.skill) return;
    const col = row.dataset.c || '#ffffff', pow = Number(row.dataset.pow) || 1, slot = row.querySelector('.rv-slot');
    if (!slot) return;
    row.style.setProperty('--c', col); Sound.play(pow >= 3 ? 'reveal_rare' : 'reveal_tick');
    const fl = document.createElement('i'); fl.className = 'rv-sweep'; slot.appendChild(fl); setTimeout(() => fl.remove(), 700);
    if (pow >= 2) { const m = rv.closest('.modal'); if (m) { m.classList.add('thud'); setTimeout(() => m.classList.remove('thud'), 320); } }
    if (pow >= 3) { const f = document.createElement('div'); f.className = 'rv-flash tint'; f.style.setProperty('--c', col); rv.appendChild(f); setTimeout(() => f.remove(), 700); }
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
    if (m.type === 'guide') {
      const L = Guild.guideInfo(), cur = L.find((q) => !q.done);
      const rows = L.map((q) => `<li class="gq${q.done ? ' done' : q === cur ? ' now' : ' wait'}"><span class="gq-mk">${q.done ? '✔' : q === cur ? '▶' : '·'}</span><div><b>${esc(q.title)}</b>${q.done ? '' : `<div class="gq-h">${esc(q.hint)}</div>`}${q === cur ? `<div class="gq-bar"><i style="width:${Math.round((100 * q.cur) / q.goal)}%"></i></div><div class="gq-n">${q.cur} / ${q.goal}</div>` : ''}</div><em>${q.done ? '완료' : `${q.gold ? '+' + q.gold + '금화' : ''}${q.open ? (q.gold ? ' · ' : '') + q.open + ' 탭 열림' : ''}`}</em></li>`).join('');
      return wrap('길잡이 퀘스트', `<ul class="gq-list">${rows}</ul><p class="gq-note">차례대로 하나씩 열려요. 마칠 때마다 보상을 받고, 새 기능이 열리면 짧은 안내가 나와요.</p>`, '<button class="btn" data-act="close-modal">닫기</button>');
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
    if (m.type === 'notice') return wrap(m.title || '알림', `<p>${m.text}</p>`, '<button class="btn" data-act="close-modal">확인</button>', true);
    if (m.type === 'confirm') {
      return wrap(m.title || '확인', `<p>${m.text}</p>`, `<button class="btn ghost" data-act="close-modal">${m.no || '취소'}</button><button class="btn danger" data-act="confirm-yes">${m.yes || '확인'}</button>`, true);
    }
    // settings
    return wrap('설정 / 개발 도구', `<h3>길드</h3><div class="form-row"><input type="text" id="in-name" maxlength="8" value="${esc(Guild.state.guildName)}" aria-label="길드 이름"><button class="btn sm" data-act="rename">이름 바꾸기</button></div><p class="small muted" style="margin:-4px 0 8px">이름을 바꾸면 명성이 50% 떨어져요.</p>
      <div class="form-row"><span class="small muted">${esc((authGet() || {}).email || '게스트(임시 입장)')}</span><button class="btn ghost sm" data-act="logout">로그아웃</button></div>
      <h3>소리</h3>
      <div class="form-row"><label><input type="checkbox" data-snd="on"${Sound.prefs().mute ? '' : ' checked'}> 소리 켜기</label></div>
      <div class="form-row snd-row"><label for="snd-se">효과음</label><input type="range" id="snd-se" min="0" max="100" data-snd="se" value="${Math.round(Sound.prefs().se * 100)}"><label for="snd-bgm">배경음</label><input type="range" id="snd-bgm" min="0" max="100" data-snd="bgm" value="${Math.round(Sound.prefs().bgm * 100)}"></div>
      ${U.devOn ? `      <h3>개발 도구 (테스트용)</h3>
      <div class="form-row"><label><input type="checkbox" data-act="dev-boost"${U.boost ? ' checked' : ''}> 고유스킬 확률 ×100,000</label></div>
      <div class="form-row"><button class="btn ghost sm" data-act="dev-ticket">초기화권 +1 (보유 ${Guild.resetTickets()})</button><button class="btn ghost sm" data-act="dev-tutorial">튜토리얼 다시</button></div>
      <div class="form-row"><label><input type="checkbox" data-act="dev-skill"${U.forceSkill ? ' checked' : ''}> 채용하면 고유스킬 무조건 획득</label></div>
      <div class="form-row"><label><input type="checkbox" data-act="dev-talent"${U.showTalent ? ' checked' : ''}> 재능 수치 보기</label></div>
      <div class="form-row"><label for="in-skip">시간 빨리감기(분)</label><input type="number" id="in-skip" min="1" max="100000" value="10"><button class="btn ghost sm" data-act="dev-skip">보내기</button></div>
      <div class="form-row"><label for="in-abs">미접속 일수</label><input type="number" id="in-abs" min="1" max="3650" value="30"><button class="btn ghost sm" data-act="dev-absence">적용</button></div>
      <div class="form-row"><button class="btn ghost sm" data-act="dev-lv" data-lv="30">선택 Lv30</button><button class="btn ghost sm" data-act="dev-lv" data-lv="60">Lv60</button><button class="btn ghost sm" data-act="dev-lv" data-lv="90">Lv90</button><button class="btn ghost sm" data-act="dev-gold">금화 +100</button><button class="btn ghost sm" data-act="dev-applicants">지원자 새로고침</button><button class="btn ghost sm" data-act="dev-ten">10명 영입</button><button class="btn danger sm" data-act="dev-reset">저장 데이터 삭제</button></div>`
      : ''}
      <p class="muted" style="font-size:12px" id="save-note"></p>`, '<button class="btn" data-act="close-modal">닫기</button>');
  }


/* ---------- 클릭 처리 (data-act) — 이 화면의 동작을 ACT 표에 등록한다. false를 돌려주면 다시 그리지 않는다 ---------- */
Object.assign(ACT, {
  'confirm-yes'(el, id) {
    { const f = U.modal && U.modal.onYes; U.modal = null; if (f) f(); return; }
  },
  'dev-applicants'(el, id) {
    Guild.refillApplicants(); return;
  },
  'dev-ticket'(el, id) {
    Guild.grantResetTicket(1); toast('초기화권 +1'); return;
  },
  'dev-lv'(el, id) {
    if (U.selId) Guild.devSetLevel(U.selId, Number(el.dataset.lv)); return;
  },
  'modal'(el, id) {
    U.modal = { type: el.dataset.m }; return;
  },
  'close-modal'(el, id) {
    U.modal = null; return;
  },
  'dismiss'(el, id) {
    Guild.dismissResult(id || null); if (!id) Guild.clearReport(); return;
  },
  'dismiss-report'(el, id) {
    Guild.clearReport(); return;
  },
  'save'(el, id) {
    toast(Guild.save() ? '저장했어요.' : '이 브라우저에서는 저장할 수 없어요.'); return;
  },
  'rename'(el, id) {
    {
          const nn = document.getElementById('in-name').value.trim();
          if (nn.length < 2) { toast('길드 이름은 2~8글자로 지어 주세요.'); return; }
          if (nn === Guild.state.guildName) { toast('지금과 같은 이름이에요.'); return; }
          U.modal = { type: 'confirm', title: '길드 이름 바꾸기', text: `「${esc(nn)}」(으)로 바꾸면 <b>명성이 50% 떨어져요.</b><br>(지금 ${Guild.state.fame} → ${Math.floor(Guild.state.fame * 0.5)})`, yes: '바꾼다', no: '그만두기', onYes: () => { Server.claimGuildName(nn).then((ok) => { if (!ok) { toast('이미 다른 길드가 쓰고 있는 이름이에요.'); return; } const r = Guild.renameGuild(nn); toast(r.ok ? `길드 이름을 바꿨어요. (명성 -${r.lost})` : r.reason); render(); }); } };
          return;
        }
  },
  'logout'(el, id) {
    Server.signOut().then(() => { try { localStorage.removeItem('guild_auth'); } catch (e) {} U.modal = null; authRender(); }); return;
  },
  'dev-gold'(el, id) {
    Guild.addGold(100); return;
  },
  'dev-ten'(el, id) {
    for (let i = 0; i < 10; i++) Guild.recruit({ free: true }); toast('10명을 영입했어요.'); return;
  },
  'dev-skip'(el, id) {
    Guild.advanceTime(val('in-skip', 10)); return;
  },
  'dev-absence'(el, id) {
    {
          Guild.simulateAbsence(val('in-abs', 30));
          U.modal = null;
          return;
        }
  },
  'dev-reset'(el, id) {
    U.modal = { type: 'confirm', title: '저장 데이터 삭제', text: '저장된 길드 데이터를 모두 지우고 처음부터 시작할까요? 되돌릴 수 없어요.', yes: '삭제', onYes: () => { Guild.resetAll(); U.screen = 'hub'; U.selId = null; U.party = []; U.contract = null; U.seenMail = 0; } };
          return;
  },
});
