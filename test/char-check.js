/* 캐릭터 그림 검증 (playwright):  node test/char-check.js [index.html 경로]
   1) 수천 가지 조합을 그려 오류·NaN·undefined가 없는지
   2) 그림이 캔버스(viewBox) 밖으로 잘리지 않는지
   3) 눈·코·입·볼 위에 머리카락·모자·배낭이 올라가지 않는지(실제 화면 위치에서 맨 위 요소를 찍어서 확인)
   4) 모자를 쓰면 정수리 머리·동물 귀·뿔이 모자 밖으로 나오지 않는지
   5) 외형 값을 하나만 바꿔도 그림이 달라지는지(값마다 다르게 보이는지)                         */
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const file = process.argv[2] || 'file:///home/claude/guild/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 700, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(file); await p.waitForTimeout(800);
  const res = await p.evaluate(() => {
    const P = Appearance.PARTS, KEYS = P.map((x) => x.key), SZ = P.map((x) => x.size);
    let seed = 12345; const rnd = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    const rand = () => { const a = {}; P.forEach((x) => { a[x.key] = rnd(x.size); }); return a; };
    const out = { total: 0, bad: [], clipped: [], occluded: [], hatLeak: [], same: {}, samples: {} };
    const note = (arr, a, why) => { if (arr.length < 12) arr.push(why + ' ' + JSON.stringify(a)); };
    // ----- 조합 목록 -----
    const combos = [];
    for (let i = 0; i < 2500; i++) combos.push(rand());
    for (let ot = 0; ot < 10; ot++) for (let hs = 0; hs < 100; hs++) for (let g = 0; g < 2; g++) { const a = rand(); a.clothes = ot + 10 * rnd(10); a.hair = hs; a.gender = g; combos.push(a); }
    for (let r = 0; r < 20; r++) for (let ot = 0; ot < 10; ot++) for (let g = 0; g < 2; g++) { const a = rand(); a.race = r; a.clothes = ot + 10 * rnd(10); a.gender = g; combos.push(a); }
    for (let ac = 0; ac < 100; ac++) for (let ot = 0; ot < 10; ot++) { const a = rand(); a.accessory = ac; a.clothes = ot + 10 * rnd(10); combos.push(a); }
    for (let e = 0; e < 50; e++) for (let g = 0; g < 2; g++) for (let k = 0; k < 4; k++) { const a = rand(); a.eye = e; a.gender = g; combos.push(a); }
    // ----- 1) 문자열 검사 -----
    const hatted = (a) => [0, 1, 3, 6, 9].includes(a.clothes % 10);
    const strs = combos.map((a) => { try { return Art.character(a); } catch (e) { note(out.bad, a, 'throw ' + e.message); return ''; } });
    strs.forEach((s, i) => { out.total++; if (/undefined|NaN|\[object|Infinity/.test(s)) note(out.bad, combos[i], 'bad-text'); });
    // ----- 2~4) 화면에 그려서 검사 -----
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:570px;background:#fff';
    document.body.innerHTML = ''; document.body.appendChild(host);
    const step = Math.max(1, Math.floor(combos.length / 2200));
    for (let i = 0; i < combos.length; i += step) {
      const a = combos[i]; host.innerHTML = strs[i].replace('<svg ', '<svg style="width:300px;height:570px" ');
      const svg = host.firstChild; const vb = svg.viewBox.baseVal; const bb = svg.getBBox();
      if (bb.x < vb.x - 0.6 || bb.y < vb.y - 0.6 || bb.x + bb.width > vb.x + vb.width + 0.6 || bb.y + bb.height > vb.y + vb.height + 0.6) note(out.clipped, a, `clip bbox=${[bb.x, bb.y, bb.width, bb.height].map((v) => v.toFixed(1))}`);
      const ctm = svg.getScreenCTM();
      const hit = (ux, uy) => { const pt = svg.createSVGPoint(); pt.x = 50 + (ux - 50) * 1.2; pt.y = 50 + (uy - 50) * 1.2; const sp = pt.matrixTransform(ctm); const el = document.elementFromPoint(sp.x, sp.y); const g = el && el.closest ? el.closest('[data-l]') : null; return g ? g.getAttribute('data-l') : 'none'; };
      const sh = a.eye % 5, closed = sh === 2 || sh === 3;
      const okFace = ['fx', 'hd', 'ac'];
      const chk = (name, ux, uy, okExtra) => { const l = hit(ux, uy); if (!okFace.includes(l) && !(okExtra || []).includes(l)) note(out.occluded, a, `${name}←${l}`); };
      if (!closed) { chk('눈L', 43.5, 31); chk('눈R', 56.5, 31); }
      chk('코', 50, 38, ['beard']); chk('입', 50, 43, ['beard']); chk('볼L', 41.5, 37); chk('볼R', 58.5, 37);
      if (hatted(a)) {
        const crown = svg.querySelector('[data-l="hair"]').innerHTML.includes('Q29 7 50 7');
        const top = svg.querySelector('[data-l="topear"]').children.length;
        if (crown || top) note(out.hatLeak, a, `crown=${crown} topear=${top}`);
      }
    }
    // ----- 5) 값 하나만 바꿨을 때 달라지는가 -----
    host.remove();
    const key = (a) => Art.character(a).replace(/id="g\d+/g, 'id="g').replace(/url\(#g\d+/g, 'url(#g');
    for (let t = 0; t < 40; t++) {
      const base = rand(); const bs = key(base);
      P.forEach((part) => {
        let dup = 0, n = 0;
        for (let v = 0; v < part.size; v += (part.size > 120 ? 7 : 1)) {
          if (v === base[part.key]) continue;
          const a = Object.assign({}, base, { [part.key]: v });
          if (part.key === 'eyeColor' && ([2, 3].includes(a.eye % 5))) continue;     // 감은 눈은 눈색이 없다
          n++; if (key(a) === bs) { dup++; if (dup === 1 && (out.samples[part.key] || (out.samples[part.key] = [])).length < 3) out.samples[part.key].push(JSON.stringify(base) + ' -> ' + part.key + '=' + v); }
        }
        out.same[part.key] = (out.same[part.key] || [0, 0]); out.same[part.key][0] += dup; out.same[part.key][1] += n;
      });
    }
    // 서로 다른 외형 5000쌍이 모두 다른 그림인지
    const seen = new Set(); let dupAll = 0; for (let i = 0; i < 5000; i++) { const k = key(rand()); if (seen.has(k)) dupAll++; seen.add(k); }
    out.dupAll = dupAll;
    return out;
  });
  console.log('조합 수', res.total, '| 오류', res.bad.length, '| 잘림', res.clipped.length, '| 얼굴 가림', res.occluded.length, '| 모자 침범', res.hatLeak.length, '| 무작위 5000 중 같은 그림', res.dupAll);
  ['bad', 'clipped', 'occluded', 'hatLeak'].forEach((k) => res[k].length && console.log(k, res[k].slice(0, 6)));
  console.log('값 하나만 바꿨는데 같은 그림 (같은 수/비교 수):', JSON.stringify(res.same));
  Object.keys(res.samples).forEach((k) => console.log('  예)', k, res.samples[k].slice(0, 2)));
  console.log('페이지 오류', errs.length ? errs : '없음');
  await b.close();
})();
