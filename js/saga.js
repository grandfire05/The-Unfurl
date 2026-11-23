/* ============================================================
   saga.js - 모험가의 이야기: 귀환 에피소드 · 유언 · 유품
   성격(특성에서 정해진 말투)에 따라 같은 일도 다르게 기록된다. 전투 결과에는 영향이 없다.
   ============================================================ */
(function (global) {
  'use strict';
  const pickOf = (a, r) => a[Math.floor((r || Math.random)() * a.length)];
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  // 받침 유무에 따른 조사
  const josa = (w, a, b) => { const c = String(w).charCodeAt(String(w).length - 1) - 0xac00; return c >= 0 && c % 28 !== 0 ? a : b; };
  const I = (w) => w + josa(w, '이', '가'), EUN = (w) => w + josa(w, '은', '는'), EUL = (w) => w + josa(w, '을', '를'), WA = (w) => w + josa(w, '과', '와');

  /* ---------- 성격: 특성 이름으로 말투를 정한다 (없으면 이름으로 고정) ---------- */
  const TONE_TRAITS = {
    bold: ['용감함', '고집불통', '살기', '투지', '광전사', '배수진', '불굴', '야심가', '사선의 결의', '선제공격', '거인살해'],
    calm: ['신중함', '침착', '완벽주의', '인내', '성실', '관찰자', '전략가', '집중', '베테랑', '선견지명', '노력가'],
    timid: ['도망치는 기술', '생존 본능', '공포 면역', '느긋함', '게으름뱅이', '유리 대포', '고독한 늑대', '소식가', '야행성'],
    warm: ['동료애', '희생정신', '치유의 손', '응원', '지원', '리더십', '조율자', '방패', '사기 고양', '낙천적', '협상가', '군중 속의 영웅'],
    wry: ['도박꾼', '대식가', '행운아', '보물 감각', '상인', '복권', '대박', '천재', '행운의 부적', '악운의 대가', '눈썰미', '비운의 영웅'],
  };
  const TONES = Object.keys(TONE_TRAITS);
  function toneOf(c) {
    const tr = (c && c.traits) || [];
    for (const t of TONES) if (tr.some((x) => TONE_TRAITS[t].includes(x))) return t;
    return TONES[hash((c && c.name) || '') % TONES.length];
  }
  const TONE_NAME = { bold: '호방한', calm: '담담한', timid: '소심한', warm: '다정한', wry: '익살스러운' };


  /* ---------- 위기 중 동료 의견 ---------- */
  const OPIN = {
    fight: {
      bold: ['여기서 물러나면 평생 후회해. 끝까지 간다!', '아직 칼이 들린다. 싸우자!'],
      calm: ['숫자는 우리 편이에요. 이어 가죠.', '지금 물러나면 얻는 게 없어요. 계속해요.'],
      timid: ['무서워… 그래도 다들 있으니까, 해 볼게.', '여기까지 왔는데… 조금만 더 해 보죠.'],
      warm: ['모두 같이라면 할 수 있어요. 싸워요.', '내가 받쳐 줄게요. 계속해요.'],
      wry: ['이 정도 위기는 단골 메뉴지. 계속하자고!', '내기를 걸자면 우리 쪽이야. 가자!'],
    },
    back: {
      bold: ['이건 아니야. 다시 노리자, 지금은 물러난다.', '싸울 때와 물러날 때는 달라. 물러나자.'],
      calm: ['지금은 위험해요. 후퇴가 이득이에요.', '잃을 수 있는 게 너무 커요. 물러나요.'],
      timid: ['안 돼요, 이러다 누군가 죽어요! 제발 물러나요!', '더는 못 해요… 돌아가요.'],
      warm: ['누구도 잃고 싶지 않아요. 물러나요.', '다치는 사람이 더 나오기 전에 돌아가요.'],
      wry: ['목숨은 하나뿐이거든. 오늘은 접자.', '도박이 너무 크네. 판을 물리자.'],
    },
  };
  // c: 모험가, ctx: { hpFrac, selfCrisis, friendCrisis, safeLow }
  function opinion(c, ctx, salt) {
    const t = toneOf(c);
    let side = 'fight';
    if (t === 'timid') side = 'back';
    else if (t === 'bold') side = ctx.hpFrac < 0.15 ? 'back' : 'fight';
    else if (t === 'calm') side = ctx.safeLow ? 'back' : 'fight';
    else if (t === 'warm') side = ctx.friendCrisis || ctx.selfCrisis ? 'back' : 'fight';
    else side = ctx.hpFrac < 0.5 ? 'back' : 'fight';
    const arr = OPIN[side][t];
    return { side, tone: t, line: arr[(hash(c.name) + (salt || 0)) % arr.length] };
  }

  /* ---------- 유언 ---------- */
  const LAST = {
    bold: ['후회는 없다. 끝까지 앞에서 싸웠으니까.', '이 정도에 쓰러질 줄이야. 그래도 속은 시원하군.', '내 이름을 기억해 줘. 크게 불러 줘도 좋아.', '다음에 만나면 한판 더 붙자고!'],
    calm: ['조용히 마무리할 수 있어서 다행이에요.', '모두 무사히 돌아가길 바랄 뿐이에요.', '계획대로는 아니었지만, 나쁘지 않은 길이었어요.', '남은 사람들이 너무 오래 슬퍼하지 않았으면 해요.'],
    timid: ['역시… 도망쳤어야 했나 봐요. 그래도 끝까지 있었어요.', '무서웠어요. 그래도 같이 있어서 덜 무서웠어요.', '나, 잘한 거죠? 아무도 말해 주지 않아도 돼요.', '제 자리는 비워 두지 말아 주세요. 가끔은 생각해 줘요.'],
    warm: ['모두 고마웠어요. 함께라서 행복했어요.', '울지 말고, 밥은 꼭 챙겨 먹어요.', '나 대신 다음 사람을 잘 부탁해요.', '따뜻했어요, 이 길드. 정말로.'],
    wry: ['이거 완전 밑지는 장사였네. 그래도 구경은 실컷 했군.', '유언이라니, 마지막까지 농담거리를 못 찾겠네.', '내 몫의 술은 누가 마시든 상관없어. 대신 맛있게 마셔.', '다음 생엔 운 좋은 쪽으로 태어나 볼래.'],
  };
  const LAST_FRIEND = {
    bold: ['{f}, 네가 살아 있으니 됐다. 나 몫까지 싸워 줘.', '{f}, 앞은 네가 맡아라. 내가 길을 터 놨다.'],
    calm: ['{f}, 뒷일을 부탁해요. 당신이라면 괜찮을 거예요.', '{f}, 함께한 시간은 잊지 않을게요.'],
    timid: ['{f}, 먼저 가서 미안해요. 나 없이도 잘 해낼 거죠?', '{f}, 같이 있어 줘서 고마웠어요… 정말로.'],
    warm: ['{f}, 웃어 줘요. 그게 제일 보고 싶었으니까.', '{f}, 나는 괜찮아요. 당신이 살아 돌아와 줘서 다행이에요.'],
    wry: ['{f}, 내 장비는 팔지 말고 써. 폼은 나니까.', '{f}, 외상값은 탕감이다. 대신 가끔 내 얘기나 해 줘.'],
  };
  function lastWords(c, friend, r) {
    const t = toneOf(c);
    if (friend && (r || Math.random)() < 0.7) return pickOf(LAST_FRIEND[t], r).replace('{f}', friend);
    return pickOf(LAST[t], r);
  }

  /* ---------- 유품: 직업에 어울리는 물건 ---------- */
  const KEEP = {
    전사: ['이 빠진 검집', '낡은 가죽 장갑', '흠집 많은 투구 끈'], 방패병: ['금이 간 방패 손잡이', '녹슨 방패 문장'], 궁수: ['닳은 화살 깃', '낡은 활시위'], 도적: ['한쪽만 남은 단검 칼집', '구겨진 지도 조각'],
    마법사: ['빛바랜 마법 책갈피', '금이 간 수정구슬 조각'], 사제: ['낡은 성인 메달', '손때 묻은 기도문'], 성기사: ['빛바랜 서약 휘장', '낡은 십자 목걸이'], 연금술사: ['깨진 약병 마개', '얼룩진 조제 수첩'],
    음유시인: ['줄 하나 끊어진 류트 피크', '구겨진 악보'], 무투가: ['낡은 손목 붕대', '닳은 손 보호대'],
  };
  const KEEP_ANY = ['낡은 인식표', '손때 묻은 수첩', '바래 버린 머리끈', '반쯤 남은 부적'];
  const keepsake = (c, r) => pickOf(KEEP[(c.path && c.path[0]) || ''] || KEEP_ANY, r);

  /* ---------- 귀환 에피소드 ---------- */
  // ctx: { outcome, hadCrisis, members:[{name, tone, kills, dmg, fate, hp(0~1), crisis}], pairs:[[a,b]...] (함께 살아 돌아온 유대 쌍), dead:[{name, friend}] }
  const FLAVOR = {
    bold: ['{n}{가} 제일 먼저 적진으로 뛰어들었다.', '{n}{은} 상처를 자랑스럽게 내보이며 돌아왔다.', '{n}{가} 또 앞장서다 혼쭐이 났다.'],
    calm: ['{n}{은} 마지막까지 흐트러지지 않았다.', '{n}{가} 전투 내내 상황을 조용히 읽고 있었다.', '{n}{은} 귀환길에도 장비 점검을 잊지 않았다.'],
    timid: ['{n}{은} 내내 뒷걸음질 쳤지만 끝까지 자리를 지켰다.', '{n}{은} 돌아오자마자 한참 말이 없었다.', '{n}{가} 몇 번이나 뒤를 돌아봤지만, 도망치지는 않았다.'],
    warm: ['{n}{가} 다친 동료부터 챙겼다.', '{n}{가} 돌아오는 길에 모두에게 물을 나눠 주었다.', '{n}{가} 모두를 격려하며 걸음을 이끌었다.'],
    wry: ['{n}{가} 전투 중에도 농담을 던져 분위기를 풀었다.', '{n}{가} 돌아오는 길에 배고프다는 말만 열 번 했다.', '{n}{가} 이번 일의 보수를 암산하며 흐뭇해했다.'],
  };
  const fill = (s, n) => s.replace('{n}{가}', I(n)).replace('{n}{은}', EUN(n));
  function episodes(ctx, r) {
    const out = [], rnd = r || Math.random, ms = ctx.members || [];
    if (!ms.length) return out;
    // 1) 사망: 가장 가까웠던 사람의 반응
    (ctx.dead || []).slice(0, 2).forEach((d) => {
      if (d.friend) out.push(pickOf([`${I(d.friend)} ${EUL(d.name)} 끝까지 부르며 손을 놓지 못했다.`, `${EUN(d.friend)} ${d.name}의 장비를 한참 동안 쓸어 보았다.`, `${I(d.friend)} ${d.name}${josa(d.name, '이', '가')} 쓰러진 자리를 돌아보지 못했다.`], rnd));
      else out.push(pickOf([`${EUL(d.name)} 잃은 파티는 말없이 길을 걸었다.`, `${EUN(d.name)} 마지막까지 맡은 자리를 지켰다.`], rnd));
    });
    const alive = ms.filter((x) => x.fate !== 'dead');
    // 2) 위기를 넘겼다면 가장 활약한 사람
    const top = ms.slice().sort((a, b) => b.dmg - a.dmg)[0];
    if (ctx.hadCrisis && ctx.outcome === 'win' && top && top.fate !== 'dead') out.push(pickOf([`위기의 순간, ${I(top.name)} 전세를 뒤집었다.`, `모두가 물러설 때 ${I(top.name)} 한 걸음 더 나아가 끝을 냈다.`], rnd));
    else if (top && top.kills >= 3 && top.fate !== 'dead') out.push(`${I(top.name)} 가장 많은 적(${top.kills}마리)을 쓰러뜨렸다.`);
    // 3) 가장 위태로웠던 생존자
    const weak = alive.filter((x) => x.hp !== undefined && x.hp < 0.25).sort((a, b) => a.hp - b.hp)[0];
    if (weak && out.length < 3) out.push(`${EUN(weak.name)} 체력 ${Math.round(weak.hp * 100)}%로 간신히 돌아왔다.`);
    // 4) 함께 돌아온 유대 쌍
    if (ctx.pairs && ctx.pairs.length && out.length < 3 && rnd() < 0.6) { const p = pickOf(ctx.pairs, rnd); out.push(pickOf([`${WA(p[0])} ${p[1]}${josa(p[1], '은', '는')} 서로의 어깨를 두드리며 귀환했다.`, `${WA(p[0])} ${p[1]}${josa(p[1], '은', '는')} 돌아오는 길에 나란히 걸었다.`], rnd)); }
    // 5) 성격이 묻어나는 한 줄
    if (out.length < 3 && alive.length) { const x = pickOf(alive, rnd); out.push(fill(pickOf(FLAVOR[x.tone] || FLAVOR.calm, rnd), x.name)); }
    return out.slice(0, 3);
  }

  global.Saga = { opinion, toneOf, TONE_NAME, lastWords, keepsake, episodes };
})(typeof window !== 'undefined' ? window : globalThis);
