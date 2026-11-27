/* ui/render.js — 그리기 · 실시간 갱신 · 토스트 · 화면 맞춤
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

  let lastSig = '';
  function render() {
    tutAdvance();
    { const g = document.getElementById('grade'); if (g) g.dataset.s = ['hub', 'battle', 'recruit'].includes(U.screen) ? 'scene' : 'panel'; } // 장면 화면은 조명을 진하게, 글이 많은 화면은 읽기 쉽게
    if (!Guild.unlockedCat((NAV[U.screen] || ['hub'])[0])) { U.screen = 'hub'; U.childMode = false; } // 아직 열리지 않은 탭으로는 갈 수 없다
    if (!tutCtx() && !Guild.tutorialActive() && Guild.guideQueued() && !U.modal && U.screen !== 'battle') { const ch = Guild.guideStartChapter(); if (ch && CH[ch.id] && CH[ch.id][0].enter) CH[ch.id][0].enter(); } // 해금 안내 시작
    { const gn = Guild.takeGuideNews(); if (gn.length) Sound.play('unlock'); if (gn.length) toast('✔ 길잡이 완료: ' + gn.map((n) => n.title + (n.gold ? ` · +${n.gold}금화` : '') + (n.open ? ` · ${n.open} 탭이 열렸어요` : '')).join(' / ')); }
    // 새 보고가 오면 우편함을 자동으로 연다
    const mc = mailCount();
    if (mc > U.seenMail) {
      const fresh = Guild.state.inbox.slice(-(mc - U.seenMail));
      const died = fresh.some((r) => r.members.some((x) => x.fate === 'dead'));
      toast(died ? '의뢰 결과가 도착했어요. 슬픈 소식이 있어요.' : '의뢰 결과가 도착했어요. (위쪽 결과 칩)'); Sound.play(died ? 'defeat' : 'victory');
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
    $('screen').style.top = curCat().subs.length > 1 ? '78px' : '44px';
    { const rv = $('overlay').querySelector('.reveal'); // 공개 연출 중에는 창을 다시 그리지 않는다 (연출이 처음부터 재생되지 않도록)
      if (!(rv && U.modal && U.modal.type === 'recruit' && rv.dataset.rid === String(U.modal.id))) $('overlay').innerHTML = modalHtml(); }
    startReveal();
    { const sc = $('overlay').querySelector('.scrim'); if (sc && !U.modalWas) sc.classList.add('in'); U.modalWas = !!sc; }
    { const gd = $('guide'); if (gd) { { const h = guideCardHtml(); if (gd.innerHTML !== h) gd.innerHTML = h; } gd.className = U.screen === 'hub' ? 'on-hub' : (curCat().subs.length > 1 ? 'on-sub' : ''); } }
    $('coach').innerHTML = coachHtml();
    tutHighlight();
    tutType();
    recType();
    document.querySelectorAll('[data-keep]').forEach((el) => { if (keep[el.dataset.keep] != null) el.scrollTop = keep[el.dataset.keep]; });
    { const cl = document.querySelector('.chat-log'); if (cl) cl.scrollTop = cl.scrollHeight; }
    const first = $('overlay').querySelector('.btn:not(.ghost), .btn');
    if (first && U.modal) first.focus({ preventScroll: true });

    const alerts = alertCount();
    if (alerts > (U.lastAlerts || 0)) Sound.play('crisis');
    U.lastAlerts = alerts;
    Sound.bgm(alerts ? 'crisis' : U.screen === 'battle' ? 'battle' : 'town');
    document.title = (alerts ? '(!) ' : '') + '모험가 길드';
    lastSig = signature();
    updateLive();
  }

  // 상태가 바뀔 때만 다시 그리고, 그 사이에는 남은 시간과 진행 막대만 갱신한다
  function signature() {
    return actives().map((c) => c.id + ':' + statusOf(c).state).join('|') + '#' + Guild.missions.map((m) => m.id + ':' + Guild.missionInfo(m).state + ':' + m.battle.m.filter((x) => x.state === 'fit').length).join('|') +
      '#' + advanceCount() + '#' + battleSig() + '#' + Guild.board.map((k) => k.id).join(',') + '#n' + U.newK.size + '#' + Guild.applicants.map((a) => a.id).join(',') + '#' + mailCount() + '#' + Guild.state.characters.length + '#' + Guild.tutorialStep() + U.screen + '#c' + (Guild.guideChap() ? Guild.guideChap().id + Guild.guideChap().i : '') + '#q' + Guild.guideInfo().map((q) => q.cur).join(',') + '#u' + Object.values(Guild.state.guide.unlock).join('');
  }
  // 전투 화면에서 그림이 바뀌어야 하는 변화(몬스터 수, 파티원 상태)만 서명에 넣는다. 체력 막대는 updateLive가 갱신한다.
  function battleSig() {
    if (U.screen !== 'battle') return '';
    const m = Guild.missionById(U.battle);
    if (!m) return '';
    const v = Guild.battleView(m);
    return v.heroes.map((h) => h.state).join(',') + ':' + m.phase;
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
    // 쓰러진 몬스터는 다시 그리지 않고 조용히 치우고, 새로 나온 몬스터만 덧붙인다 (화면 전체를 다시 그리면 한 번 튄다)
    if (v.alive > 0) {
      const box = document.querySelector('.b-enemies');
      if (box) {
        const shown = shownMonsOf(v), want = shown.map((x) => String(x.idx));
        const have = [...box.querySelectorAll('.b-mon')];
        have.forEach((el) => { if (!want.includes(el.dataset.midx) && !el.dataset.leaving) { el.dataset.leaving = '1'; setTimeout(() => el.remove(), 420); } });
        const there = have.map((el) => el.dataset.midx);
        const px = have.length ? Math.round(parseFloat((have[0].firstElementChild.style.width) || '120')) : 120;
        shown.forEach((x, i) => { if (!there.includes(String(x.idx))) {
          const tmp = document.createElement('div'); tmp.innerHTML = monHtml(x, i, px, m.contract);
          const el = tmp.firstElementChild; el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
          const more0 = box.querySelector('.b-more'); box.insertBefore(el, more0);
        } });
        const more = box.querySelector('.b-more'), extra = v.alive - shown.length;
        if (more) { if (extra > 0) more.textContent = '+' + extra + '마리'; else more.remove(); }
      }
    }
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
    document.querySelectorAll('[data-hpc]').forEach((el) => { const c = byId(el.dataset.hpc); if (!c) return; const f = Guild.hpFrac(c), p = Math.round(f * 100); el.firstElementChild.nextElementSibling.style.width = Math.max(3, p) + '%'; el.lastElementChild.textContent = p + '%'; const lv = hpLv(f); if (!el.classList.contains(lv)) { el.classList.remove('hi', 'mid', 'lo'); el.classList.add(lv); } });
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
    watchContracts();
    if (document.hidden) return; // 안 보이는 탭에서는 그리지 않는다 (시간은 실제 시계로 계산되므로 문제 없다)
    if (changed || signature() !== lastSig) render(); else updateLive();
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  // 새 의뢰가 들어오면 알려 준다: 토스트 + 원정 탭 배지(금색) + 의뢰서의 NEW 띠. 의뢰판을 보고 나가면 사라진다.
  U.newK = new Set(); let knownBoard = null, wasQuests = false;
  function watchContracts() {
    const ids = new Set(Guild.board.map((k) => k.id));
    if (U.screen === 'quests') wasQuests = true; else if (wasQuests) { wasQuests = false; if (U.newK.size) U.newK.clear(); }
    if (!knownBoard) { knownBoard = ids; return; }
    const fresh = Guild.board.filter((k) => !knownBoard.has(k.id) && !k.tutorial);
    knownBoard = ids;
    for (const id of Array.from(U.newK)) if (!ids.has(id)) U.newK.delete(id);
    if (!fresh.length || Guild.tutorialActive()) return;
    fresh.forEach((k) => U.newK.add(k.id));
    Sound.play('notify');
    toast(fresh.length === 1 ? `📜 새 의뢰가 도착했어요 — ${fresh[0].name}` : `📜 새 의뢰 ${fresh.length}건이 도착했어요`);
    try { Chat.log(fresh.length === 1 ? `새 의뢰 도착: ${fresh[0].name}` : `새 의뢰 ${fresh.length}건 도착`, 'go'); } catch (e) { /* 무시 */ }
  }
  let toastT;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }
  function fit() {
    const m = Math.max(12, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.035)); // 상하좌우 여백
    const s = Math.max(0.3, Math.min((window.innerWidth - m * 2) / 1760, (window.innerHeight - m * 2) / 990));
    $('stage').style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
