/* ============================================================
   i18n.js - 언어 선택(한국어 / English / 日本語)과 화면 글자 번역
   게임 코드는 한글로 글자를 만들어 내고, 영어·일본어 모드에서는 화면에 나타난 글자를 번역표로 바꿔 보여 준다.
   - 번역표: I18n.add('en', { '한글 글자': 'English', '의뢰 {0}건': '{0} contracts' })  ({0}은 값이 들어가는 자리)
     · {~} 는 있어도 없어도 되는 조사(이/가/을/를/은/는…) 자리. 영어·일본어 쪽에는 쓰지 않는다.
     · 글자 중간의 값(이름 등)은 다시 번역표를 거친다.
   - 번역이 없는 글자는 한글 그대로 보인다.
   - 모험가 이름은 만들 때의 언어로 정해져 저장된다(언어를 바꿔도 이미 만든 이름은 그대로).
   ============================================================ */
(function (global) {
  'use strict';
  const KEY = 'guild_lang', LANGS = ['ko', 'en', 'ja', 'zh', 'zht'];
  const H = /[가-힣]/;
  let lang = 'ko';
  try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ } // 언어 선택은 없앴다: 한국어 고정
  document.documentElement.lang = { zh: 'zh-Hans', zht: 'zh-Hant' }[lang] || lang;

  const D = {}; // lang -> { exact: Map, idx: Map(prefix -> [pat]), gen: [pat] }
  const hooks = [];   // (text) => 번역 또는 null  (몬스터 이름처럼 규칙으로 만드는 번역)
  const nameSets = {};
  const cache = new Map();
  const dict = (l) => D[l] || (D[l] = { exact: new Map(), idx: new Map(), gen: [] });
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const JOSA = '(?:이\\(가\\)|을\\(를\\)|와\\(과\\)|이|가|을|를|은|는|과|와|으로|로|이라|라|이여|여)?';
  const norm = (s) => s.replace(/\s+/g, ' ');

  function add(l, map) {
    const d = dict(l);
    for (const k in map) {
      const v = map[k], key = norm(k).trim();
      if (!/\{(\d+|~)\}/.test(key)) { d.exact.set(key, v); continue; }
      // 앞뒤 값 자리가 비어 나오는 경우(예: "돌려보내기 {8}")를 위해 값 자리를 뗀 글자도 따로 등록한다
      { const a = /^(\{\d+\}) ?/.exec(key), b = / ?(\{\d+\})$/.exec(key), sv = String(v);
        let kk = key, vv = sv;
        if (a && sv.startsWith(a[1])) { kk = kk.slice(a[0].length); vv = vv.slice(a[1].length).replace(/^ /, ''); }
        if (b && vv.endsWith(b[1])) { kk = kk.slice(0, kk.length - b[0].length); vv = vv.slice(0, vv.length - b[1].length).replace(/ $/, ''); }
        if (kk !== key && kk.length >= 2 && !/\{(\d+|~)\}/.test(kk) && !d.exact.has(kk)) d.exact.set(kk, vv); }
      const parts = key.split(/\{(\d+|~)\}/); // [글자, 번호, 글자, 번호 …]
      let re = '^', reL = '^', nums = [];
      const used = new Set((String(v).match(/\{(\d+)\}/g) || []).map((x) => x.slice(1, -1)));
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) { re += esc(parts[i]); reL += esc(parts[i]); }
        else if (parts[i] === '~' || !used.has(parts[i])) { re += JOSA; reL += JOSA; } // 번역에 쓰지 않는 자리는 조사로 본다
        else if (parts[i - 1] === ' ' && i >= 3 && /^(개|마리|명|건|분|초|시간|일|회|번|층|%|금)/.test(parts[i + 1] || '')) { re += '(\\d[\\d,.]*)'; reL += '(\\d[\\d,.]*)'; nums.push(parts[i]); } // "{0} {1}개": 앞 값과 붙어 있으면 숫자만
        else { re += '((?:(?!, | · ).)+?)'; reL += '(.*?)'; nums.push(parts[i]); } // 엄격: 값 안에 쉼표·가운뎃점이 없다 / 느슨: 무엇이든
      }
      const pat = { re: new RegExp(re + '$'), reL: new RegExp(reL + '$'), nums, v, len: key.length };
      const lit = parts[0].slice(0, 2);
      if (lit.length === 2) { if (!d.idx.has(lit)) d.idx.set(lit, []); d.idx.get(lit).push(pat); }
      else d.gen.push(pat);
    }
    cache.clear();
  }

  // 괄호로 감싼 글, "이름: 내용", 여러 문장은 안쪽 조각을 따로 번역해 이어 붙인다 (모든 조각이 번역될 때만)
  const WRAP = { '「': '」', '『': '』', '“': '”', '‘': '’', '(': ')', '[': ']', '（': '）', '【': '】', '《': '》' };
  function structural(n, depth) {
    if (depth > 5) return null;
    const ok = (t) => typeof t === 'string' && !H.test(t);
    const w = WRAP[n[0]];
    if (w && n[n.length - 1] === w && n.length > 2) {
      const t = tr(n.slice(1, -1), depth + 1);
      if (ok(t)) {
        if (lang === 'en' && (n[0] === '「' || n[0] === '『')) return '“' + t + '”';
        if ((lang === 'zh' || lang === 'zht') && n[0] === '「') return '“' + t + '”';
        return n[0] + t + w;
      }
    }
    let m = /^(.+?) (\d+\/\d+)$/.exec(n);
    if (m) { const a = tr(m[1], depth + 1); if (ok(a)) return a + ' ' + m[2]; }
    m = /^([^:]{1,30}?): (.+)$/.exec(n);
    if (m) { const a = tr(m[1], depth + 1), b = tr(m[2], depth + 1); if (ok(a) && ok(b)) return a + (lang === 'zh' || lang === 'zht' || lang === 'ja' ? '：' : ': ') + b; }
    if (/[.!?…。] /.test(n)) {
      const ps = n.split(/(?<=[.!?…]) +/);
      if (ps.length > 1 && ps.length < 8) { const o = ps.map((p) => tr(p, depth + 1)); if (o.every(ok)) return o.join(lang === 'ja' || lang === 'zh' || lang === 'zht' ? '' : ' '); }
    }
    return null;
  }

  function core(text, depth) {
    const d = D[lang]; if (!d) return null;
    const n = norm(text).trim();
    if (!n) return null;
    let r = d.exact.get(n);
    if (r !== undefined) return r;
    const lists = [];
    const ix = d.idx.get(n.slice(0, 2)); if (ix) lists.push(ix);
    lists.push(d.gen);
    const match = (loose) => { // 값이 들어간 글자(패턴): 가장 긴 것을 고른다
      let best = null;
      for (const list of lists) for (const p of list) {
        const m = (loose ? p.reL : p.re).exec(n);
        if (m && (!best || p.len > best.p.len)) best = { p, m };
      }
      if (!best) return null;
      const vals = {};
      best.p.nums.forEach((num, i) => { vals[num] = depth < 4 ? tr(best.m[i + 1], depth + 1) : best.m[i + 1]; });
      return best.p.v.replace(/\{(\d+)\}/g, (_, k) => (vals[k] !== undefined ? vals[k] : ''));
    };
    const split = (sep, join) => { // 조각마다 번역하되, 모든 조각이 번역될 때만 쓴다
      if (n.indexOf(sep) <= 0) return null;
      const out = n.split(sep).map((p) => tr(p, depth + 1));
      return out.some((t) => H.test(t)) ? null : out.join(join);
    };
    r = match(false); if (r != null) return r;
    r = split(' · ', ' · '); if (r != null) return r;
    r = split(', ', lang === 'ja' ? '、' : lang === 'zh' || lang === 'zht' ? '，' : ', '); if (r != null) return r;
    r = match(true); if (r != null) return r;
    r = structural(n, depth); if (r != null) return r;
    for (const h of hooks) { const t = h(n, lang); if (t) return t; }
    return null;
  }

  // 마지막 수단: 통째로 번역이 없으면, 아는 낱말·구절(정확히 일치하는 항목)을 긴 것부터 찾아 바꾼다. 조사는 떼어 낸다.
  const JOSA_TAIL = /^(?:으로|에서|에게|께서|이라|이다|이며|부터|까지|처럼|보다|에는|에도|와의|과의|은|는|이|가|을|를|의|에|와|과|로|도|만|들)(?![가-힣])/;
  const exactIdx = {};
  function exactInfo() {
    let e = exactIdx[lang];
    if (!e) { e = exactIdx[lang] = { max: 0, built: D[lang] ? D[lang].exact.size : -1 }; D[lang] && D[lang].exact.forEach((v, k) => { if (k.length > e.max && k.length < 60) e.max = k.length; }); }
    if (D[lang] && e.built !== D[lang].exact.size) { delete exactIdx[lang]; return exactInfo(); }
    return e;
  }
  const UNITS = {
    en: { 마리: '', 시간: 'h', 개: '', 명: '', 건: '', 분: 'm', 초: 's', 일: 'd', 회: '', 번: '', 층: 'F' },
    ja: { 마리: '体', 시간: '時間', 개: '個', 명: '人', 건: '件', 분: '分', 초: '秒', 일: '日', 회: '回', 번: '回', 층: '階' },
    zh: { 마리: '只', 시간: '小时', 개: '个', 명: '人', 건: '件', 분: '分钟', 초: '秒', 일: '天', 회: '次', 번: '次', 층: '层' },
    zht: { 마리: '隻', 시간: '小時', 개: '個', 명: '人', 건: '件', 분: '分鐘', 초: '秒', 일: '天', 회: '次', 번: '次', 층: '層' },
  };
  function greedy(n) {
    const d = D[lang]; if (!d) return null;
    const info = exactInfo(), ex = d.exact;
    let out = '', i = 0, hit = 0;
    const isK = (c) => c >= '가' && c <= '힣';
    while (i < n.length) {
      const c = n[i];
      if (isK(c) && i > 0 && n[i - 1] >= '0' && n[i - 1] <= '9' && UNITS[lang]) { // 숫자 뒤 단위(개·마리·분 …)
        const U = UNITS[lang], um = /^(마리|시간|개|명|건|분|초|일|회|번|층)(?![가-힣])/.exec(n.substr(i));
        if (um) { out += U[um[1]]; i += um[1].length; hit++; continue; }
      }
      if (isK(c) && (i === 0 || !isK(n[i - 1]))) {
        let found = null;
        for (let L = Math.min(info.max, n.length - i); L >= 1; L--) {
          if (L === 1 && n[i + 1] && isK(n[i + 1])) continue; // 한 글자는 낱말일 때만
          const sub = n.substr(i, L), v = ex.get(sub);
          if (v === undefined || H.test(v)) continue;
          const after = n.substr(i + L);
          if (after && isK(after[0])) { const jm = JOSA_TAIL.exec(after); if (!jm) continue; found = { v, len: L + jm[0].length }; }
          else found = { v, len: L };
          break;
        }
        if (found) { out += found.v; i += found.len; hit++; continue; }
      }
      out += c; i++;
    }
    return hit ? out.replace(/ {2,}/g, ' ').replace(/^ +/, '') : null;
  }

  /* ---------- 모험가 이름: 언어를 바꾸면 그 언어의 이름으로 보인다 ---------- */
  let nameMap = new Map(), nameMax = 0;
  const NAME_JOSA = /^(?:으로|에서|에게서|에게|한테|이라|이다|이여|이랑|부터|까지|처럼|보다|와의|과의|아|야|은|는|이|가|을|를|의|에|와|과|로|도|만|께)(?![가-힣])/;
  const KJOSA = /^(이라|이|가|은|는|을|를|와|과|으로|로|라)(?![가-힣])/;
  const isK = (c) => c >= '가' && c <= '힣';
  const isLat = (c) => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
  function setNameMap(list) { // list: [{ko,en,ja,zh,zht}, …] 모험가마다 언어별 이름
    nameMap = new Map(); nameMax = 0;
    for (const nm of list || []) {
      const t = nm[lang]; if (!t) continue;
      for (const k in nm) { const v = nm[k]; if (v && v !== t && v.length >= 2 && !nameMap.has(v)) { nameMap.set(v, t); if (v.length > nameMax) nameMax = v.length; } }
    }
    cache.clear();
  }
  function koJosa(name, j) { // 한국어 이름 뒤 조사를 받침에 맞게 고친다
    const c = name.charCodeAt(name.length - 1); if (c < 0xAC00 || c > 0xD7A3) return j;
    const b = (c - 0xAC00) % 28, rl = b === 8;
    return { 이: b ? '이' : '가', 가: b ? '이' : '가', 은: b ? '은' : '는', 는: b ? '은' : '는', 을: b ? '을' : '를', 를: b ? '을' : '를', 와: b ? '과' : '와', 과: b ? '과' : '와', 으로: b && !rl ? '으로' : '로', 로: b && !rl ? '으로' : '로', 이라: b ? '이라' : '라', 라: b ? '이라' : '라' }[j] || j;
  }
  function applyNames(s, strip) {
    if (!nameMap.size || !s) return s;
    let out = '', i = 0, ch = false; const n = s.length;
    while (i < n) {
      const c = s[i];
      if (c > '@' && (i === 0 || !((isLat(c) && isLat(s[i - 1])) || (isK(c) && isK(s[i - 1]))))) {
        let hit = null;
        for (let L = Math.min(nameMax, n - i); L >= 2; L--) {
          const t = nameMap.get(s.substr(i, L)); if (t === undefined) continue;
          const last = s[i + L - 1], nx = s[i + L];
          if (isLat(last) && nx && isLat(nx)) continue;
          let jm = null;
          if (nx && isK(nx)) { jm = NAME_JOSA.exec(s.substr(i + L)); if (isK(last) && !jm) continue; if (!isK(last)) jm = KJOSA.exec(s.substr(i + L)) || null; }
          hit = { L, t, jm }; break;
        }
        if (hit) {
          out += hit.t; i += hit.L; ch = true;
          const jm = hit.jm || (s[i] && isK(s[i]) ? KJOSA.exec(s.substr(i)) : null);
          if (lang === 'ko' && jm) { const k = KJOSA.exec(s.substr(i)); if (k) { out += koJosa(hit.t, k[1]); i += k[1].length; } }
          else if (strip && jm && jm[0].length && !isK(s[i + jm[0].length] || ' ')) i += jm[0].length;
          continue;
        }
      }
      out += c; i++;
    }
    return ch ? out : s;
  }

  // 한글 글자를 현재 언어로 바꾼다 (번역이 없으면 그대로)
  function tr(s, depth) {
    if (typeof s !== 'string') return s;
    if (!depth && nameMap.size) {
      const a = applyNames(s, false);
      if (lang === 'ko' || !H.test(a)) return a;
      let r = trCore(a, 0);
      if (H.test(r)) { const b = applyNames(s, true); if (b !== a) { const r2 = trCore(b, 0); if (!H.test(r2)) return r2; } }
      return r;
    }
    return trCore(s, depth);
  }
  function trCore(s, depth) {
    if (lang === 'ko' || typeof s !== 'string' || !H.test(s)) return s;
    depth = depth || 0;
    const hit = cache.get(s);
    if (hit !== undefined) return hit;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    let t = core(m[2], depth);
    if (depth === 0 && (t == null || H.test(t))) for (const src of t == null ? [m[2]] : [t, m[2]]) { const g = greedy(src); if (g && !H.test(g)) { t = g; break; } }
    const out = t == null ? s : m[1] + t + m[3];
    if (cache.size > 6000) cache.clear();
    cache.set(s, out);
    return out;
  }

  /* ---------- 화면 글자 바꾸기 ---------- */
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'data-tip'];
  const last = new WeakMap();      // 텍스트 노드 -> 우리가 쓴 글자
  const lastA = new WeakMap();     // 요소 -> { 속성: 우리가 쓴 글자 }
  const off = (el) => el.closest && el.closest('[data-i18n="off"],script,style,textarea');
  function fixText(node) {
    const v = node.data;
    if (!v || last.get(node) === v || !(H.test(v) || nameMap.size)) return;
    if (node.parentNode && off(node.parentNode)) return;
    const o = tr(v);
    if (o !== v) { last.set(node, o); node.data = o; }
  }
  function fixAttrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v || !(H.test(v) || nameMap.size)) continue;
      const rec = lastA.get(el) || {};
      if (rec[a] === v) continue;
      const o = tr(v);
      if (o !== v) { rec[a] = o; lastA.set(el, rec); el.setAttribute(a, o); }
    }
  }
  function walk(node) {
    if (node.nodeType === 3) { fixText(node); return; }
    if (node.nodeType !== 1) return;
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || (node.getAttribute && node.getAttribute('data-i18n') === 'off')) return;
    fixAttrs(node);
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  }
  function start() {
    if (lang === 'ko') return;
    walk(document.documentElement);
    if (document.title && H.test(document.title)) document.title = tr(document.title);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else if (m.type === 'characterData') fixText(m.target);
        else if (m.type === 'attributes') fixAttrs(m.target);
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* ---------- 언어 바꾸기 / 이름 목록 ---------- */
  function setLang(l) {
    if (!LANGS.includes(l) || l === lang) return;
    try { localStorage.setItem(KEY, l); } catch (e) { /* 무시 */ }
    try { if (global.Guild && global.Guild.state) global.Guild.save(); } catch (e) { /* 무시 */ }
    location.reload();
  }
  const setNames = (l, set) => { nameSets[l] = set; };
  // 선택한 언어의 번역표 파일을 이어서 불러온다 (스크립트가 읽히는 중이라 document.write로 순서를 지킨다)
  const PARTS = ['skills', 'monsters', 'classes', 'ach', 'ui', 'tut', 'attr', 'misc', 'dialog', 'story', 'fix'];
  if (lang !== 'ko' && document.readyState === 'loading') {
    document.write('<script src="js/lang/mon-common.js"><\/script>');
    PARTS.forEach((p) => document.write('<script src="js/lang/' + lang + '-' + p + '.js"><\/script>'));
  }
  // 언어 선택 드롭다운 (select.lang-sel)
  if (typeof document !== 'undefined') document.addEventListener('change', (e) => { const t = e.target; if (t && t.classList && t.classList.contains('lang-sel')) setLang(t.value); });
  global.I18n = {
    get lang() { return lang; }, LANGS, add, tr, setNameMap, nameSet: (l) => nameSets[l] || null, hook: (f) => hooks.push(f), setLang, setNames,
    names: () => nameSets[lang] || null,
    scan: () => walk(document.documentElement), // 점검용
    dictSize: (l) => { const d = D[l || lang]; return d ? d.exact.size + [...d.idx.values()].reduce((a, x) => a + x.length, 0) + d.gen.length : 0; },
  };
})(window);
