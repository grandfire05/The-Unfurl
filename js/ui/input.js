/* ui/input.js — 입력(클릭·키보드·변경 처리)
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

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
    const h = ACT[name];
    if (!h) return;
    if (h(el, el.dataset.id) === false) return; // false: 다시 그리지 않음
    render();
  }

  // 금화가 바뀌면 숫자가 튀고 증감이 떠오른다
  // 화면 번쩍임과 색종이: 합성 레이어에서만 돌아서 가볍다
  function flash(color) {
    const st = $('stage'), d = document.createElement('div');
    d.className = 'fx-flash'; d.style.background = color;
    st.appendChild(d); setTimeout(() => d.remove(), 420);
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
  // 클릭으로 넘기는 튜토리얼 단계: 어두운 화면 어디를 눌러도(다른 UI 위여도) 그 UI가 눌리지 않고 다음 단계로 넘어간다.
  document.addEventListener('input', (e) => { const t = e.target; if (!t.dataset || !t.dataset.snd) return; if (t.dataset.snd === 'on') return; Sound.set(t.dataset.snd, Number(t.value) / 100); if (t.dataset.snd === 'se') Sound.play('ui_click'); });
  document.addEventListener('change', (e) => { const t = e.target; if (t.dataset && t.dataset.snd === 'on') Sound.set('mute', !t.checked); });
  $('stage').addEventListener('click', (e) => {
    if (!tutClickStep() || e.target.closest('#chat, #chat-set, #auth')) return;
    const rv = document.querySelector('#overlay .reveal');
    if (rv && e.target.closest('.reveal') && !rv.classList.contains('done')) return; // 채용 연출은 눌러서 건너뛰기(아래 일반 처리)
    e.stopPropagation(); e.preventDefault();
    act('coach-next', { dataset: {} });
  }, true);
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
    Sound.play('ui_click');
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
    // 튜토리얼 안내(클릭으로 넘기는 단계)는 Space로도 넘길 수 있다 (Enter는 채팅 전용)
    if (e.key === ' ' && !U.modal) { const ts = tutStep(); if (ts && (ts.card || ts.next)) { e.preventDefault(); act('coach-next', { dataset: {} }); return; } }
    if (U.modal) {
      if (U.modal.type === 'talk' && /^[1-3]$/.test(e.key)) { const b = document.querySelectorAll('#overlay .topt')[Number(e.key) - 1]; if (b) b.click(); }
      return;
    }
    const k = e.key;
    if (/^[1-9]$/.test(k)) {
      const n = Number(k) - 1;
      if (U.childMode) { const b = document.querySelectorAll('#tabs .tb-sub .pill')[n]; if (b) b.click(); }
      else {
        const t = document.querySelectorAll('#tabs .tab')[n];
        if (t) {
          const wasHere = curCat().id === CATS[n].id;
          if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
          if (!wasHere) t.click(); // 다른 탭이면 그 탭의 첫 화면으로 간다 (같은 탭이면 지금 화면 그대로)
          if (CATS[n].subs.length > 1 && curCat().id === CATS[n].id && !tutStep()) { U.childMode = true; render(); } // 하위 메뉴가 있는 탭은 번호 키로 펼친다
        }
      }
    } else if (k === 'h' || k === 'H' || k === 'ㅗ') { const b = document.querySelector('#tabs [data-m="help"]'); if (b) b.click(); }
    else if (k === 's' || k === 'S' || k === 'ㄴ') { const b = document.querySelector('#tabs [data-act="menu-save"]'); if (b) b.click(); }
  });
  // 탭을 켜 둔 채 오래 있다가 돌아온 경우도 처리
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { Guild.checkAbsence(); render(); }
  });

  /* ---------- 시작 ---------- */

  /* ---------- 로그인 / 회원가입(이메일 인증 번호) / 길드 이름 ---------- */
