/* ui/main.js — 서버 이벤트 연결 · 시작 · 로딩 화면
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

  Server.on('away', (n) => { // 접속할 때 공지는 한 번만: 그동안 몇 개가 새 주인을 찾았고, 몇 개가 남았는지
    const left = Math.max(0, Character.SKILL_COUNT - Server.takenCount());
    try { Chat.notice(`자리를 비운 사이 고유스킬 ${n}개를 누군가 얻었어요. 남은 고유스킬은 ${left}개예요.`); } catch (e) { /* 무시 */ }
    U.modal = { type: 'notice', title: '자리를 비운 사이', text: `고유스킬 <b>${n}개</b>를 다른 길드가 얻었어요.<br>남은 고유스킬 <b>${left}개</b><br><span class="muted">도감에서 확인할 수 있어요.</span>` }; render();
  });
  Server.on('saveState', refreshSaveInd);
  Server.on('saveReplaced', () => { render(); authRender(); });
  Server.on('signedOut', () => { authSet(null); authRender(); });
  Server.on('nameTaken', () => { AU.err = '이미 다른 길드가 쓰고 있는 이름이라 새로 정해야 해요.'; authRender(); });
  Guild.load();
  { const a0 = authGet(); if (a0 && a0.uid) Server.restore().then((ok) => { if (!ok && Server.available()) { authSet(null); authRender(); } }); }
  if (Guild.tutorialActive() && Guild.tutorialStep() >= TUT.length) Guild.setTutorial(Guild.TUTORIAL_DONE);
  Guild.guideCheck();
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
