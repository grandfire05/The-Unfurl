/* ============================================================
   battlefx.js - 전투 화면 연출 (효과음 없음, 화려한 스킬 이펙트 없음)
   - 전투 기록(이벤트)을 실시간 시계에 맞춰 한 건씩 보여 준다: 공격하러 다가갔다 돌아오기, 피격 번쩍임, 피해 숫자, 말풍선
   - 다음 공격 순서(작은 아이콘), 승률(몬테카를로) 그래프, 체력 막대를 0.05초 단위로 갱신한다
   화면 구조는 ui.js가 만들고, 여기서는 이미 그려진 요소를 data- 속성으로 찾아 움직인다.
   ============================================================ */
(function (global) {
  'use strict';

  const hist = new Map(); // 전투(미션) 번호 → 기록 {seed, pts, lastT, p, ...}
  // 전투 대사 (상황별, 총 100가지)
  const QUIPS = ['간다~', '받아라!', '이얍!', '반칙이야!', '여기다!', '한 방이다!', '조금만 더!', '맛 좀 봐라!', '피할 수 있을까?', '이건 어때!', '눈 감고도 하지!', '다음은 너야!', '내 차례다!', '쉽게 안 끝나!', '자, 간다!', '훗, 가볍군.', '한 번 더!', '집중, 집중!', '틈이 보여!', '놓치지 않아!', '여기서 끝내자!', '비켜라!', '정면 승부다!', '가만 안 둬!', '이거나 먹어라!', '호흡을 맞춰!', '흐름이 왔어!', '이쯤이야!', '발목 잡지 마!', '내가 상대해 주마!'];
  const CRIT = ['급소다!', '완벽해!', '이게 진짜 실력이지!', '정확히 맞았어!', '통했다!', '바로 이거야!', '한 방에 간다!', '손맛이 좋은데!', '봤냐, 이게 내 힘이다!', '불꽃이 튀었다!'];
  const HURT = ['으윽…', '아직이야!', '큭…', '위험해!', '아야!', '이 정도쯤!', '방심했다…', '제법인데…', '윽, 아프잖아!', '버틸 수 있어!', '아직 안 끝났어!', '흠, 센데?'];
  const CRISIS = ['더는 못 버티겠어…', '숨이 차…', '다리가 풀려…', '도와줘!', '눈앞이 흐려져…', '아직 쓰러질 수 없어…', '이대로는 위험해!', '힘이… 안 들어가…', '누가 좀… 도와줘!', '여기서 끝일 수는 없어…'];
  const THANKS = ['고마워!', '살았다!', '덕분에 살아났어!', '이제 좀 낫네.', '힘이 나!', '든든해!', '신세 졌어!', '다시 일어선다!'];
  const KILL = ['하나 처리!', '다음!', '쉬웠어.', '쓰러졌다!', '해치웠다!', '또 하나 끝!', '이쪽은 정리!', '다음 상대는?', '이게 내 실력이야.', '끝났다!'];
  const GOOD = ['좋아, 기세를 타자!', '운이 따르네!', '지금이 기회야!', '흐름이 바뀌었어!', '이거 되겠는데?', '해볼 만하다!'];
  const BAD = ['앗, 이건 예상 못 했는데!', '조심해!', '큰일이다!', '이런, 꼬였어!', '침착하자!', '아직 포기하긴 일러!'];
  const BOSS = ['저 기운은…!', '물러서!', '흩어져!', '버텨라!', '방패를 들어!', '큰 게 온다!', '정신 차려!', '이건 위험해, 각오해!'];
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];

  // ---- 직업·성격별 대사 ----
  const ROLE_OF = { 전사: 'fighter', 무투가: 'fighter', 방패병: 'tank', 성기사: 'tank', 궁수: 'ranger', 도적: 'ranger', 마법사: 'mage', 연금술사: 'mage', 사제: 'support', 음유시인: 'support' };
  const ROLE_ATK = {
    fighter: ['정면으로 간다!', '이 주먹, 받아라!', '뼈까지 울려 줄게!', '힘으로 밀어붙인다!', '내 무기가 울고 있어!', '한 번에 끝내자!'],
    tank: ['내가 막는다, 너희가 쳐라!', '한 발짝도 못 지나가!', '방패는 부서지지 않아!', '여기가 내 자리다!', '이쪽을 봐라, 덩치!', '버티는 건 자신 있어!'],
    ranger: ['눈 깜짝할 새에!', '거기 서 있어, 맞히기 쉽게!', '급소는 이미 봤어.', '그림자처럼 빠르게!', '조준 완료!', '들키기 전에 끝낸다.'],
    mage: ['계산대로야!', '원소여, 응답하라!', '잠깐, 이 배합이 좋겠어.', '마력이 차오른다!', '이론은 완벽해!', '물러서, 터진다!'],
    support: ['다들 힘내요!', '내가 뒤에 있어요!', '박자에 맞춰서!', '기도는 이미 올렸어요.', '좋은 노래가 될 거야!', '아무도 쓰러지게 두지 않아요.'],
  };
  const ROLE_KILL = {
    fighter: ['다음 상대는 누구냐!', '몸이 풀리는군.', '이 정도론 부족해!'],
    tank: ['한 걸음도 안 물러났지.', '다들 괜찮아?', '아직 멀쩡해.'],
    ranger: ['소리도 없이.', '한 발이면 충분하지.', '다음 표적은?'],
    mage: ['실험 성공!', '예상대로네.', '기록해 둬야겠어.'],
    support: ['다치지 않았죠?', '한 곡 끝났네요.', '다행이에요…'],
  };
  const ROLE_CRISIS = {
    fighter: ['이까짓 상처쯤…!', '아직 주먹은 쥘 수 있어!'], tank: ['방패가… 무거워…', '내가 쓰러지면 안 돼…!'],
    ranger: ['한 발만 더 쏘면…', '숨이… 차…'], mage: ['마력이 바닥나…', '계산 밖이었어…'], support: ['기도가… 닿지 않아…', '모두… 괜찮은 거죠…?'],
  };
  const TONE = {
    bold: ['두려울 게 뭐 있어!', '덤벼라!', '피하면 지는 거야!', '끝까지 간다!', '물러서는 건 모르겠는데!'],
    calm: ['침착하게, 침착하게…', '서두르지 마, 정확하게.', '패턴이 보여.', '숨을 고르고…', '계획대로야.'],
    lucky: ['오늘은 느낌이 좋아!', '운이 따라 주네!', '이번엔 대박이다!', '주사위는 던져졌어!', '될 것 같은 날이야!'],
    lazy: ['빨리 끝내고 쉬자~', '귀찮지만… 한다!', '배고프다, 얼른 끝내자.', '느긋하게 가자~', '으차, 한 번만 더.'],
    proud: ['내 이름을 기억해 둬!', '나 정도면 당연하지!', '이 정도는 식은 죽 먹기야.', '역시 나야!', '지켜봐, 전설이 되어 주지.'],
    kind: ['모두 같이 돌아가자!', '내가 도울게!', '다치면 말해!', '우리는 하나야!', '아무도 혼자 두지 않아!'],
  };
  function personalLine(el, kind) {
    if (!el) return null;
    const role = el.dataset.role, tone = el.dataset.tone, r = Math.random();
    const tbl = kind === 'kill' ? ROLE_KILL : kind === 'crisis' ? ROLE_CRISIS : ROLE_ATK;
    if (tone && TONE[tone] && kind === 'atk' && r < 0.3) return rnd(TONE[tone]);
    if (role && tbl[role] && r < 0.75) return rnd(tbl[role]);
    return null;
  }
  const pad = (n) => String(n).padStart(2, '0');
  const mmss = (s) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
  const fmt = (p) => ({ txt: Math.round(p * 100) + '%', cls: p >= 0.6 ? 'hi' : p >= 0.35 ? 'mid' : 'lo' });

  function winText(mid) {
    const h = hist.get(mid);
    return h && h.p != null ? fmt(h.p) : { txt: '--%', cls: '' };
  }

  /* ---------- 좌표 ---------- */
  function geom(root) {
    const field = root.querySelector('.b-field');
    const fr = field.getBoundingClientRect();
    const sc = fr.width / (field.offsetWidth || 1) || 1;
    return { field, fr, sc };
  }
  const centerOf = (g, el) => { const r = el.getBoundingClientRect(); return { x: (r.left + r.width / 2 - g.fr.left) / g.sc, y: (r.top + r.height / 2 - g.fr.top) / g.sc, top: (r.top - g.fr.top) / g.sc }; };
  const heroEl = (root, id) => root.querySelector(`.b-hero[data-hid="${id}"]`);
  const monEl = (root, mid) => root.querySelector(`.b-mon[data-midx="${String(mid).slice(1)}"]`);

  /* ---------- 작은 연출 도구 ---------- */
  function popup(g, x, y, text, cls, label) {
    if (g.field.querySelectorAll('.fx-num').length > 26) return;
    const d = document.createElement('div');
    d.className = 'fx-num ' + cls;
    d.innerHTML = (label ? `<small>${label}</small>` : '') + text;
    d.style.left = (x + (Math.random() * 30 - 15)) + 'px'; d.style.top = y + 'px';
    g.field.appendChild(d);
    const big = cls.indexOf('crit') >= 0;
    const a = d.animate([
      { transform: 'translate(-50%,0) scale(.5)', opacity: 0 },
      { transform: `translate(-50%,-12px) scale(${big ? 1.5 : 1.15})`, opacity: 1, offset: 0.18 },
      { transform: 'translate(-50%,-26px) scale(1)', opacity: 1, offset: 0.6 },
      { transform: 'translate(-50%,-58px) scale(.95)', opacity: 0 },
    ], { duration: big ? 1100 : 880, easing: 'ease-out' });
    a.onfinish = () => d.remove();
  }
  // 말풍선: 가까운 곳에 먼저 떠 있던 풍선은 위로 밀려 올라가고, 새 풍선이 아래에 놓인다 (스킬 이름 포함)
  const BUB_STEP = 30;
  function bubble(g, x, y, text, cls) {
    const live = [...g.field.querySelectorAll('.fx-bubble')];
    if (live.length > 6) return;
    live.forEach((o) => {
      if (Math.abs(parseFloat(o.dataset.x) - x) < 120 && Math.abs(parseFloat(o.dataset.y) - y) < 140) {
        const ny = (parseFloat(o.dataset.y) || y) - BUB_STEP; o.dataset.y = ny; o.style.top = ny + 'px';
      }
    });
    const d = document.createElement('div');
    d.className = 'fx-bubble ' + (cls || '');
    d.textContent = text;
    d.dataset.x = x; d.dataset.y = y;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    g.field.appendChild(d);
    const a = d.animate([
      { transform: 'translate(-50%,-100%) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%,-112%) scale(1.05)', opacity: 1, offset: 0.15 },
      { transform: 'translate(-50%,-116%) scale(1)', opacity: 1, offset: 0.8 },
      { transform: 'translate(-50%,-130%) scale(1)', opacity: 0 },
    ], { duration: 1500 });
    a.onfinish = () => d.remove();
  }
  function lunge(g, el, tgt, dist) {
    if (!el) return;
    let dx = 0, dy = 0;
    if (tgt) { const a = centerOf(g, el), b = centerOf(g, tgt); dx = (b.x - a.x) * (dist || 0.62); dy = (b.y - a.y) * 0.4; }
    el.animate([
      { translate: '0 0', scale: '1' },
      { translate: `${dx}px ${dy}px`, scale: '1.1', offset: 0.34, easing: 'ease-in' },
      { translate: `${dx}px ${dy}px`, scale: '1.1', offset: 0.46 },
      { translate: '0 0', scale: '1' },
    ], { duration: 520, easing: 'ease-out' });
  }
  function hit(el, dir) {
    if (!el) return;
    el.animate([{ translate: '0 0' }, { translate: `${-7 * dir}px 0`, offset: 0.2 }, { translate: `${5 * dir}px 0`, offset: 0.5 }, { translate: '0 0' }], { duration: 280 });
    const sv = el.querySelector('svg');
    if (sv) {
      const base = getComputedStyle(sv).filter;
      const b = base === 'none' ? '' : base + ' ';
      sv.animate([{ filter: b + 'brightness(1)' }, { filter: b + 'brightness(2.8) saturate(.4)', offset: 0.22 }, { filter: b + 'brightness(1)' }], { duration: 260 });
    }
  }
  function shake(field, amp) {
    field.animate([{ translate: '0 0' }, { translate: `${amp}px ${-amp * 0.6}px`, offset: 0.25 }, { translate: `${-amp}px ${amp * 0.5}px`, offset: 0.6 }, { translate: '0 0' }], { duration: 200 });
  }

  /* ---------- 사건 하나 처리 ---------- */
  function playEvent(root, g, e) {
    switch (e.k) {
      case 'atk': {
        const he = heroEl(root, e.by), me = monEl(root, e.mon);
        lunge(g, he, me, 0.62);
        if (he && Math.random() < 0.053) { const c = centerOf(g, he); bubble(g, c.x, c.top + 24, personalLine(he, 'atk') || rnd(QUIPS), 'hero'); }
        break;
      }
      case 'matk': {
        const me = monEl(root, e.mon), he = heroEl(root, e.tgt);
        lunge(g, me, he, e.big ? 0.8 : 0.6);
        if (e.big) shake(g.field, 5);
        break;
      }
      case 'dmg': {
        const me = monEl(root, e.mon);
        if (!me) break;
        const sv = me.querySelector('svg') || me, c = centerOf(g, sv);
        hit(me, -1);
        popup(g, c.x, c.top + 8, e.d, e.crit ? 'crit' : e.sk ? 'skill' : 'dmg', e.crit ? '치명타!' : '');
        if (e.crit) { shake(g.field, 3); const he = heroEl(root, e.by); if (he && Math.random() < 0.233) { const hc = centerOf(g, he); bubble(g, hc.x, hc.top + 24, rnd(CRIT), 'hero'); } }
        break;
      }
      case 'hurt': {
        const he = heroEl(root, e.id);
        if (!he) break;
        const sv = he.querySelector('svg') || he, c = centerOf(g, sv);
        hit(he, 1);
        popup(g, c.x, c.top + 18, e.d > 0 ? '-' + e.d : '막음', e.d > 0 ? 'hurt' : 'guard');
        if (e.d > 0 && Math.random() < 0.053) bubble(g, c.x, c.top + 24, rnd(HURT), 'hurt');
        break;
      }
      case 'heal': {
        const he = heroEl(root, e.id);
        if (!he) break;
        const sv = he.querySelector('svg') || he, c = centerOf(g, sv);
        popup(g, c.x, c.top + 30, '+' + e.d, 'heal');
        if (Math.random() < 0.2) bubble(g, c.x, c.top + 24, rnd(THANKS), 'hero');
        break;
      }
      case 'skill': {
        const he = heroEl(root, e.by);
        if (he) { const c = centerOf(g, he); bubble(g, c.x, c.top + 24, e.name, 'skill'); }
        break;
      }
      case 'kill': {
        const me = monEl(root, e.mon);
        { const he = heroEl(root, e.by); if (he && Math.random() < 0.2) { const kc = centerOf(g, he); bubble(g, kc.x, kc.top + 24, personalLine(he, 'kill') || rnd(KILL), 'hero'); } }
        if (me) { const sp = me.firstElementChild; if (sp) sp.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.55) rotate(18deg)' }], { duration: 380, fill: 'forwards' }); }
        break;
      }
      case 'crisis': {
        const he = heroEl(root, e.id);
        if (he) { const c = centerOf(g, he); bubble(g, c.x, c.top + 24, personalLine(he, 'crisis') || rnd(CRISIS), 'hurt'); }
        break;
      }
      case 'bossSkill': { shake(g.field, 8); const hs = root.querySelectorAll('.b-hero'); if (hs.length && Math.random() < 0.4) { const he = hs[Math.floor(Math.random() * hs.length)]; const c = centerOf(g, he); bubble(g, c.x, c.top + 24, rnd(BOSS), 'hero'); } break; }
      case 'swing': {
        const d = document.createElement('div');
        d.className = 'fx-banner ' + (e.good ? 'good' : 'bad'); d.textContent = e.name;
        g.field.appendChild(d);
        d.animate([{ opacity: 0, transform: 'translate(-50%,10px) scale(.8)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1)', offset: 0.12 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 2200 }).onfinish = () => d.remove();
        if (!e.good) shake(g.field, 5);
        { const hs = root.querySelectorAll('.b-hero'); if (hs.length && Math.random() < 0.467) { const he = hs[Math.floor(Math.random() * hs.length)], sc = centerOf(g, he); bubble(g, sc.x, sc.top + 24, rnd(e.good ? GOOD : BAD), 'hero'); } }
        break;
      }
      default: break;
    }
  }

  /* ---------- 다음 공격 순서 ---------- */
  function orderHtml(h, m, q) {
    return q.map((x, i) => {
      if (x.side === 'p') {
        if (!h.icons[x.id]) {
          const c = Guild.state.characters.find((y) => y.id === x.id);
          h.icons[x.id] = c ? Art.character(c.appearance, { view: 'bust', label: c.name }) : '';
        }
        return `<i class="oi p${i === 0 ? ' first' : ''}">${h.icons[x.id]}</i>`;
      }
      if (!h.micon) h.micon = Art.monster(m.contract.art, '', m.contract.hue || 1, m.contract.monster);
      return `<i class="oi m${i === 0 ? ' first' : ''}">${h.micon}</i>`;
    }).join('');
  }

  /* ---------- 승률 그래프 ---------- */
  function draw(cv, h, T) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const L = 62, R = W - 14, Tp = 16, B = H - 16;
    const X = (t, xm) => L + (R - L) * Math.min(1, t / xm), Y = (p) => B - (B - Tp) * p;
    const xm = Math.max(60, T * 1.3);
    ctx.font = '600 22px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(230,223,204,.75)'; ctx.textAlign = 'right';
    [0, 0.5, 1].forEach((p) => {
      ctx.fillText(String(Math.round(p * 100)), L - 12, Y(p));
      ctx.strokeStyle = p === 0.5 ? 'rgba(230,223,204,.28)' : 'rgba(230,223,204,.14)'; ctx.lineWidth = 2; ctx.setLineDash(p === 0.5 ? [10, 8] : []);
      ctx.beginPath(); ctx.moveTo(L, Y(p)); ctx.lineTo(R, Y(p)); ctx.stroke();
    });
    ctx.setLineDash([3, 9]); ctx.strokeStyle = 'rgba(230,223,204,.16)';
    for (let t = 30; t < xm; t += 30) { ctx.beginPath(); ctx.moveTo(X(t, xm), Tp); ctx.lineTo(X(t, xm), B); ctx.stroke(); }
    ctx.setLineDash([]);
    const pts = h.pts.filter((q) => q.t <= T + 1e-9);
    if (!pts.length) return;
    const cur = h.p == null ? pts[pts.length - 1].p : h.p;
    const line = pts.slice(); const lastPt = line[line.length - 1];
    if (lastPt.t < T - 0.01) line.push({ t: T, p: lastPt.p });
    ctx.beginPath(); ctx.moveTo(X(line[0].t, xm), B);
    line.forEach((q) => ctx.lineTo(X(q.t, xm), Y(q.p)));
    ctx.lineTo(X(line[line.length - 1].t, xm), B); ctx.closePath();
    ctx.fillStyle = cur >= 0.5 ? 'rgba(70,170,115,.42)' : 'rgba(185,62,52,.55)'; ctx.fill();
    ctx.beginPath(); line.forEach((q, i) => { if (i) ctx.lineTo(X(q.t, xm), Y(q.p)); else ctx.moveTo(X(q.t, xm), Y(q.p)); });
    ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    const ex = X(line[line.length - 1].t, xm), ey = Y(line[line.length - 1].p);
    ctx.setLineDash([4, 8]); ctx.strokeStyle = 'rgba(244,239,226,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(R, ey); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, 7); ctx.fill();
  }

  /* ---------- 프레임 ---------- */
  let frameN = 0;
  function frame() {
    const root = document.querySelector('.battle[data-mid]');
    if (!root || document.hidden) return;
    const m = Guild.missionById(root.dataset.mid);
    if (!m || m.wait || !m.battle) return;
    const st = m.battle, stop = m.phase === 'crisis';
    const T = Guild.battleClock(m);
    let h = hist.get(m.id);
    if (!h || h.seed !== st.seed) { h = { seed: st.seed, pts: [], map: new Map(), lastT: T, p: null, icons: {}, micon: null, orderSig: '' }; hist.set(m.id, h); }
    frameN++;

    // 1) 승률 계산 (조금씩) + 그래프 점 모으기
    Combat.probeWork(st, stop, T, 6);
    const got = Combat.winPoints(st, stop, T);
    let changed = false;
    got.forEach((q) => { if (h.map.get(q.t) !== q.p) { h.map.set(q.t, q.p); changed = true; } });
    if (changed || !h.pts.length) { h.pts = [...h.map.entries()].map(([t, p]) => ({ t, p })).sort((a, b) => a.t - b.t); }
    const upto = h.pts.filter((q) => q.t <= T + 1e-9);
    h.p = upto.length ? upto[upto.length - 1].p : null;

    // 2) 사건 연출
    if (T < h.lastT) h.lastT = T;
    const from = T - h.lastT > 2.5 ? T - 1 : h.lastT;
    if (T > h.lastT) {
      const g = geom(root);
      Combat.fxBetween(st, stop, from, T).forEach((e) => playEvent(root, g, e));
      h.lastT = T;
    }

    // 3) 체력 막대(실시간)
    const v = Combat.view(st, T, stop);
    v.heroes.forEach((x) => {
      const bar = root.querySelector(`[data-hbar="${x.id}"] i`), tx = root.querySelector(`[data-htxt="${x.id}"]`);
      if (bar) bar.style.width = Math.max(x.state === 'fit' ? 2 : 0, Math.round((x.hp / x.hpMax) * 100)) + '%';
      if (bar) { const f = x.hp / x.hpMax, wrap = bar.parentElement, c = f < 0.3 ? 'low' : f < 0.6 ? 'mid' : ''; if (wrap.dataset.lv !== c) { wrap.dataset.lv = c; wrap.classList.remove('low', 'mid'); if (c) wrap.classList.add(c); } }
      if (tx) tx.textContent = x.state === 'down' ? '사망' : `HP ${x.hp}/${x.hpMax}`;
    });
    root.querySelectorAll('[data-mbar] i').forEach((el) => { const mm = v.mons[Number(el.parentElement.dataset.mbar)]; if (mm) el.style.width = Math.max(mm.alive ? 2 : 0, Math.round(mm.r * 100)) + '%'; });

    // 4) 승률 글자 / 순서 아이콘 / 그래프
    const w = root.querySelector('[data-bwin]');
    if (w && h.p != null) { const f = fmt(h.p); if (w.textContent !== f.txt) w.textContent = f.txt; if (w.className !== f.cls) w.className = f.cls; }
    const ob = root.querySelector('[data-border]');
    if (ob) {
      const q = Combat.turnQueue(st, stop, T, 9);
      const sig = q.map((x) => x.side + x.id).join(',');
      if (sig !== h.orderSig || !ob.firstChild) { h.orderSig = sig; ob.innerHTML = q.length ? '<span class="ol">다음</span>' + orderHtml(h, m, q) : ''; }
    }
    const cv = root.querySelector('canvas[data-bgraph]');
    if (cv) {
      draw(cv, h, T);
      let flips = 0, side = null, mn = 1;
      upto.forEach((q) => { mn = Math.min(mn, q.p); const s = q.p > 0.55 ? 1 : q.p < 0.45 ? -1 : 0; if (s && side !== null && s !== side) flips++; if (s) side = s; });
      const set = (sel, txt) => { const el = root.querySelector(sel); if (el && el.textContent !== txt) el.textContent = txt; };
      set('[data-bflip]', String(flips)); set('[data-bmin]', upto.length ? Math.round(mn * 100) + '%' : '--'); set('[data-bsec]', mmss(T));
    }
  }
  setInterval(frame, 50);

  global.Fx = { winText };
})(typeof window !== 'undefined' ? window : globalThis);
