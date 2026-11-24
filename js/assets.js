/* ============================================================
   assets.js - 이미지 · 소리 자리 (파일을 넣기만 하면 보이고 들린다)
   · 파일이 없으면 지금의 기본 그림(SVG)과 무음으로 그대로 동작한다.
   · 어떤 파일을 어디에 넣는지는 ASSETS.md 에 정리되어 있다. 이 파일의 SLOTS / SOUNDS 가 같은 내용이다.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 이미지 ---------- */
  const miss = new Set();   // 없는 것으로 확인된 경로 (다시 요청하지 않는다)
  const ok = new Set();     // 불러온 것으로 확인된 경로
  const P = { mon: 'img/mon/', gear: 'img/gear/', mat: 'img/mat/', skill: 'img/skill/', bg: 'img/bg/' };
  const enc = (s) => String(s).replace(/ /g, '_');

  // 이미지 한 장 (후보 경로를 차례로 시도). 전부 없으면 빈 문자열
  function imgTag(cls, srcs, extra) {
    const s = srcs.filter((p) => !miss.has(p));
    if (!s.length) return '';
    return `<img class="${cls}" src="${s[0]}" data-fb="${s.slice(1).join('|')}" alt=""${extra || ''} onerror="Assets.fb(this)" onload="Assets.ld(this)">`;
  }
  function fb(el) {
    miss.add(el.getAttribute('src'));
    const rest = (el.dataset.fb || '').split('|').filter((x) => x && !miss.has(x));
    if (!rest.length) { el.remove(); return; }
    el.dataset.fb = rest.slice(1).join('|'); el.src = rest[0];
  }
  function ld(el) { ok.add(el.getAttribute('src')); }

  // 몬스터: img/mon/{몬스터 전체 이름}.png → img/mon/{기본 몬스터 이름}.png 순서. 둘 다 없으면 기본 SVG.
  const monSrcs = (name) => {
    const info = global.Monsters && global.Monsters.INFO && global.Monsters.INFO[name], base = info && info.base;
    const a = [P.mon + enc(name) + '.png'];
    if (base && base !== name) a.push(P.mon + enc(base) + '.png');
    return a;
  };
  const monKnown = (name) => monSrcs(name).find((p) => ok.has(p)) || ''; // 이미 불러온 적 있는 그림
  const monMaybe = (name) => monSrcs(name).some((p) => !miss.has(p));    // 시도해 볼 가치가 있는가

  // 화면에 그려진 svg 몬스터 중 그림 파일이 있는 것을 그림으로 바꾼다 (파일이 없으면 아무 일도 없다)
  function upgradeMons(root) {
    (root || document).querySelectorAll('svg.mon[data-mon]').forEach((sv) => {
      if (sv.dataset.tried) return;
      sv.dataset.tried = '1';
      const srcs = monSrcs(sv.dataset.mon).filter((p) => !miss.has(p));
      if (!srcs.length) return;
      const tryAt = (i) => {
        if (i >= srcs.length) { miss.add(srcs[0]); return; }
        const im = new Image();
        im.onload = () => {
          ok.add(srcs[i]);
          if (!sv.isConnected) return;
          const el = document.createElement('img');
          el.src = srcs[i]; el.alt = ''; el.className = sv.getAttribute('class') + ' mon-img'; el.dataset.mon = sv.dataset.mon;
          const st = (sv.getAttribute('style') || '').replace(/filter:[^;]*;?/, ''); if (st) el.setAttribute('style', st);
          sv.replaceWith(el);
        };
        im.onerror = () => { miss.add(srcs[i]); tryAt(i + 1); };
        im.src = srcs[i];
      };
      tryAt(0);
    });
  }
  let upQ = 0;
  function watch() {
    const st = document.getElementById('stage'); if (!st || !global.MutationObserver) return;
    new MutationObserver(() => { if (upQ) return; upQ = requestAnimationFrame(() => { upQ = 0; upgradeMons(st); }); }).observe(st, { childList: true, subtree: true });
    upgradeMons(st);
  }

  // 배경: img/bg/hub.jpg (길드 홀), img/bg/battle.jpg (전투 화면). 있으면 CSS 변수와 클래스를 켠다.
  function probeBg() {
    [['hub', 'hub.jpg'], ['battle', 'battle.jpg']].forEach(([k, f]) => {
      const im = new Image();
      im.onload = () => { document.documentElement.style.setProperty('--img-' + k, `url(${P.bg + f})`); document.documentElement.classList.add('has-bg-' + k); };
      im.src = P.bg + f; // 없으면 조용히 넘어간다
    });
  }

  /* ---------- 소리 ---------- */
  const SOUNDS = {   // 효과음: snd/{이름}.mp3 (또는 .ogg / .wav)
    ui_click: '버튼을 누를 때', notify: '새 의뢰·결과가 올 때', unlock: '길잡이 퀘스트 완료·탭 해금', hire: '모험가를 채용했을 때',
    reveal_tick: '채용 연출에서 칸 하나가 멈출 때', reveal_rare: '높은 희귀도가 멈출 때', dispatch: '파티가 출정할 때',
    crisis: '위기 신호가 올 때', victory: '의뢰 결과가 도착(전원 생존)', defeat: '의뢰 결과가 도착(사망자 있음)',
  };
  const BGM = { town: '평소 화면', battle: '전투 화면', crisis: '위기 신호가 떠 있는 동안' }; // snd/bgm_{이름}.mp3
  const EXTS = ['mp3', 'ogg', 'wav'];
  const prefs = (() => { try { return Object.assign({ mute: false, se: 0.8, bgm: 0.5 }, JSON.parse(localStorage.getItem('guild_sound') || '{}')); } catch (e) { return { mute: false, se: 0.8, bgm: 0.5 }; } })();
  const savePrefs = () => { try { localStorage.setItem('guild_sound', JSON.stringify(prefs)); } catch (e) { /* 무시 */ } };
  const cache = {};     // 이름 -> Audio | null(없음) | 'loading'
  let touched = false;  // 브라우저는 사용자가 한 번 눌러야 소리를 허용한다
  function load(file, done) {
    if (cache[file] !== undefined && cache[file] !== 'loading') { done(cache[file]); return; }
    if (cache[file] === 'loading') return;
    cache[file] = 'loading';
    const tryExt = (i) => {
      if (i >= EXTS.length) { cache[file] = null; return; }
      const a = new Audio(); a.preload = 'auto';
      a.addEventListener('canplaythrough', () => { cache[file] = a; done(a); }, { once: true });
      a.addEventListener('error', () => tryExt(i + 1), { once: true });
      a.src = `snd/${file}.${EXTS[i]}`;
    };
    tryExt(0);
  }
  function play(name, vol) {
    if (prefs.mute || !touched) return;
    load(name, (a) => { if (!a) return; const n = a.cloneNode(); n.volume = Math.max(0, Math.min(1, prefs.se * (vol == null ? 1 : vol))); n.play().catch(() => {}); });
  }
  let bgmNow = null, bgmEl = null;
  function bgm(name) {
    if (name === bgmNow) return;
    bgmNow = name;
    if (bgmEl) { const old = bgmEl; bgmEl = null; let v = old.volume; const f = setInterval(() => { v -= 0.08; if (v <= 0) { clearInterval(f); old.pause(); } else old.volume = v; }, 60); }
    if (!name || prefs.mute || !touched) return;
    load('bgm_' + name, (a) => { if (!a || bgmNow !== name) return; const n = a.cloneNode(); n.loop = true; n.volume = prefs.bgm; bgmEl = n; n.play().catch(() => {}); });
  }
  function set(k, v) {
    prefs[k] = v; savePrefs();
    if (bgmEl) bgmEl.volume = prefs.mute ? 0 : prefs.bgm;
    if (k === 'mute') { const n = bgmNow; bgmNow = null; if (!v) bgm(n); else if (bgmEl) { bgmEl.pause(); bgmEl = null; } }
  }
  const unlock = () => { if (touched) return; touched = true; Object.keys(SOUNDS).forEach((k) => load(k, () => {})); const n = bgmNow; bgmNow = null; if (n) bgm(n); };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });

  /* ---------- 자리 목록 (ASSETS.md 와 같은 내용) ---------- */
  const SLOTS = [
    { kind: '몬스터', path: 'img/mon/{몬스터 이름}.png', size: '512×512 투명 PNG', note: '전체 이름(예: 붉은 들쥐) 파일이 있으면 그것을, 없으면 기본 몬스터 이름(들쥐) 파일을 씁니다. 둘 다 없으면 기본 그림.' },
    { kind: '장비 아이콘', path: 'img/gear/{부위}_{종류번호}.png', size: '128×128 PNG', note: '부위: weapon · armor · acc, 종류번호 0~7 (총 24장)' },
    { kind: '재료 아이콘', path: 'img/mat/{재료 이름}.png', size: '128×128 PNG', note: '이름의 공백은 _ (예: 붉은_들쥐_가죽.png)' },
    { kind: '고유스킬 아이콘', path: 'img/skill/{스킬 번호}.png', size: '128×128 PNG', note: '번호 0부터 (data-unique.js 의 순서)' },
    { kind: '배경 · 길드 홀', path: 'img/bg/hub.jpg', size: '1760×990 JPG', note: '있으면 코드로 그린 홀을 대신합니다.' },
    { kind: '배경 · 전투', path: 'img/bg/battle.jpg', size: '1760×990 JPG', note: '전투 화면 배경. 아래쪽 땅 위에 모험가가 섭니다.' },
  ];

  // 필요한 파일 이름 전체 목록 (개발용: 콘솔에서 Assets.names())
  function names() {
    const G = global.Gear, M = global.Monsters.INFO || {}, mats = G.MAT_INFO || {};
    const mon = Object.keys(M), base = Array.from(new Set(mon.map((n) => M[n].base).filter(Boolean)));
    const gear = []; Object.keys(G.TYPES).forEach((sl) => G.TYPES[sl].forEach((t, i) => gear.push({ file: `${sl}_${i}.png`, name: t.n })));
    return { monAll: mon.map((n) => n + '.png'), monBase: base.map((n) => n + '.png'), gear, mat: Object.keys(mats).map((n) => enc(n) + '.png'), skill: (global.DATA_UNIQUE || []).map((u, i) => ({ file: i + '.png', name: u.name || u.n || '' })) };
  }
  global.Assets = { names, imgTag, fb, ld, P, enc, monKnown, monMaybe, upgradeMons, watch, probeBg, SLOTS, SOUNDS, BGM,
    Sound: { play, bgm, set, prefs: () => prefs, unlock } };
  global.Sound = global.Assets.Sound;
  document.addEventListener('DOMContentLoaded', () => { watch(); probeBg(); });
  if (document.readyState !== 'loading') { watch(); probeBg(); }
})(window);
