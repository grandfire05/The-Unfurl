/* ============================================================
   monsters.js - 몬스터 1000종 · 보스 100종 (등급별 분포) + 채집물
   이름은 [속성 수식어 + 기본 몬스터(+ 보스 칭호)] 조합을 등급마다 고정된 순서로 섞어 뽑는다. 항상 같은 목록이 나온다.
   각 몬스터는 속성 · 등급 · 재료를 가지고, Gear.MONSTERS / Gear.MAT_INFO 에 합쳐진다.
   ============================================================ */
(function (global) {
  'use strict';

  const GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
  const NORMAL_N = [220, 200, 170, 140, 110, 90, 70];   // 합계 1000
  const BOSS_N = [20, 18, 16, 14, 12, 11, 9];           // 합계 100
  // 기본 몬스터 [이름, 재료 부위]
  const BASES = [
    [['들쥐', '가죽'], ['슬라임', '점액'], ['박쥐', '날개'], ['딱정벌레', '껍질'], ['두더지', '발톱'], ['독사', '허물'], ['산토끼', '털'], ['메뚜기', '다리'], ['늪개구리', '점액'], ['까마귀', '깃털'], ['생쥐', '꼬리']],
    [['늑대', '가죽'], ['멧돼지', '엄니'], ['거미', '실'], ['곰', '발톱'], ['여우', '꼬리'], ['독수리', '깃털'], ['산적', '두건'], ['해골병', '뼛조각'], ['좀비', '붕대'], ['도마뱀', '비늘'], ['하이에나', '송곳니'], ['임프', '뿔조각']],
    [['고블린', '귀'], ['홉고블린', '창날'], ['코볼트', '비늘'], ['리자드맨', '비늘'], ['가고일', '돌조각'], ['하피', '깃털'], ['구울', '손톱'], ['트렌트', '껍질'], ['미믹', '자물쇠'], ['오우거', '가죽']],
    [['오크', '뼈'], ['트롤', '피'], ['웨어울프', '털'], ['미노타', '뿔'], ['석상병', '파편'], ['뱀파이어', '송곳니'], ['와이트', '수의'], ['켄타우', '발굽'], ['외눈거인', '눈알'], ['바실', '독액']],
    [['정령', '결정'], ['골렘', '핵'], ['죽음기사', '갑옷 조각'], ['히드라', '비늘'], ['키메라', '갈기'], ['리치', '두개골'], ['그리폰', '깃털'], ['엔트', '수액']],
    [['와이번', '비늘'], ['드레이크', '심장'], ['거인', '뼈'], ['서큐버스', '날개'], ['악마', '뿔'], ['악령기사', '검 파편'], ['용인', '비늘']],
    [['사도', '파편'], ['타락천사', '깃털'], ['공허군체', '핵'], ['그림자', '정수'], ['고룡', '비늘'], ['마신', '정수']],
  ];
  const ADJ = {   // 이름은 6글자 이내: 수식어(2글자) + 기본 몬스터(4글자 이하)
    불: ['붉은', '불꽃', '화염', '용암', '잿불', '홍염', '열화', '작열', '불씨', '적색'],
    물: ['푸른', '젖은', '물결', '이슬', '서리', '안개', '심해', '소금', '빙결', '파도'],
    바람: ['날쌘', '질풍', '돌풍', '깃털', '하늘', '바람', '회오', '폭풍', '유랑', '비상'],
    땅: ['단단', '진흙', '바위', '굴착', '이끼', '묵직', '모래', '뿌리', '대지', '암석'],
    빛: ['하얀', '금빛', '광휘', '성광', '새벽', '백색', '여명', '순백', '태양', '섬광'],
    어둠: ['검은', '그늘', '밤의', '흑색', '암흑', '음침', '사악', '저주', '심야', '망령'],
  };
  const ATTRS = Object.keys(ADJ);
  const TITLES = ['왕', '군주', '여왕', '대장', '폭군', '제왕', '수호자', '주술사'];
  const BOSS_PART = ['증표', '왕관 조각', '심장', '송곳니', '핵', '인장', '뿔', '눈동자'];

  // 원래부터 있던 몬스터 (저장된 의뢰와의 호환)
  const ORIGINAL = {
    '들쥐': { mat: '쥐 가죽', attr: '땅', grade: 0 }, '쥐왕': { mat: '쥐왕의 이빨', attr: '어둠', grade: 0, boss: true },
    '늑대': { mat: '늑대 가죽', attr: '바람', grade: 1 }, '늑대 대장': { mat: '은빛 송곳니', attr: '바람', grade: 1, boss: true },
    '고블린': { mat: '고블린 귀', attr: '땅', grade: 2 }, '고블린 왕': { mat: '왕의 왕관 조각', attr: '불', grade: 2, boss: true },
    '오크': { mat: '오크 뼈', attr: '불', grade: 3 }, '동굴 트롤': { mat: '트롤의 피', attr: '땅', grade: 3, boss: true },
    '불꽃 정령': { mat: '불꽃 결정', attr: '불', grade: 4 }, '용암 골렘': { mat: '용암 핵', attr: '불', grade: 4, boss: true },
    '와이번': { mat: '와이번 비늘', attr: '바람', grade: 5 }, '고대 용': { mat: '고대 용의 심장', attr: '불', grade: 5, boss: true },
    '심연의 사도': { mat: '심연의 파편', attr: '어둠', grade: 6 }, '마왕': { mat: '마왕의 뿔', attr: '어둠', grade: 6, boss: true },
  };
  // 채집물 (재료가 된다: 같은 등급의 아무 재료로 장비를 만든다)
  const GATHER = [
    ['들풀 약초', '야생 버섯', '마른 나뭇가지', '반짝이는 조약돌', '들꽃 꿀', '민들레 뿌리'],
    ['은엽 약초', '붉은 열매', '구리 광석', '단단한 목재', '송진', '산딸기 잎'],
    ['철광석', '푸른 이끼 약초', '달빛 버섯', '질긴 덩굴', '석탄 덩이', '꿀 먹은 호박'],
    ['은광석', '불씨꽃', '깊은 숲의 수액', '마력 깃든 목재', '검은 진주', '서리 열매'],
    ['미스릴 원석', '용암초', '얼음 장미', '고대 나무 껍질', '번개 수정', '하늘 이끼'],
    ['용린 광석', '천둥 열매', '영약초', '별빛 수정', '구름 소금', '황금 사과'],
    ['오리하르콘 원석', '세계수 잎', '심연 수정', '신성한 이슬', '시간의 모래', '공허의 꽃'],
  ];
  const PLACES = ['북쪽 숲', '마른 계곡', '안개 습지', '옛 광산 입구', '바위 언덕', '강가 둔치', '폐허가 된 정원', '이끼 낀 동굴 앞', '해안 절벽', '고원 초지'];
  const VILLAGES = ['버들골', '돌다리 마을', '갈대 마을', '언덕 위 마을', '포구 마을', '솔숲 마을', '옛 성터 마을', '샘골', '장터 마을', '푸른 들 마을'];
  const HELP = ['지붕 고치기', '밭일 거들기', '짐 나르기', '길 잃은 가축 찾기', '우물 청소', '울타리 보수', '장터 일손 돕기', '아이들 길 안내', '홍수 대비 모래주머니 쌓기', '수확 철 일손 돕기', '방앗간 돕기', '다리 보수', '약 심부름', '편지 전달', '축제 준비 돕기'];

  const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const shuffle = (arr, rnd) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };

  const NORMAL = [[], [], [], [], [], [], []];  // 등급별 일반 몬스터 이름 목록
  const BOSS = [[], [], [], [], [], [], []];
  const INFO = {};                              // 이름 -> { grade, attr, boss, mat, base, hue }
  const hueOf = (name, attr) => (({ 불: 0, 물: 205, 바람: 120, 땅: 30, 빛: 50, 어둠: 270 })[attr] + (hash(name) % 40) - 20 + 360) % 360;

  // 보스 재료: 비슷한 종류끼리 한 재료로 묶는다 (등급마다 최대 4종류)
  const bossMat = (gi, base) => {
    const bs = BASES[gi].map((x) => x[0]), k = Math.max(0, bs.indexOf(base)), grp = k % 4, rep = bs[grp] || base;
    return `${rep}의 ${BOSS_PART[hash(rep + gi) % BOSS_PART.length]}`;
  };
  Object.keys(ORIGINAL).forEach((n) => { const o = ORIGINAL[n]; INFO[n] = { ...o, base: n, hue: hueOf(n, o.attr) }; (o.boss ? BOSS : NORMAL)[o.grade].push(n); });
  GRADES.forEach((g, gi) => {
    const rnd = mulberry(7001 + gi * 131);
    const combos = [];
    BASES[gi].forEach(([base, part], bi) => ATTRS.forEach((attr) => ADJ[attr].forEach((adj) => combos.push({ base, part, attr, adj }))));
    shuffle(combos, rnd);
    for (const c of combos) {
      if (NORMAL[gi].length >= NORMAL_N[gi]) break;
      const name = `${c.adj}${c.base}`;
      if (name.length > 6 || INFO[name]) continue;
      INFO[name] = { grade: gi, attr: c.attr, boss: false, base: c.base, mat: `${c.base} ${c.part}`, hue: hueOf(name, c.attr) }; // 같은 종류(기본 몬스터)는 같은 재료를 준다
      NORMAL[gi].push(name);
    }
    const bc = [];
    BASES[gi].forEach(([base], bi) => ATTRS.forEach((attr) => ADJ[attr].forEach((adj) => TITLES.forEach((t) => bc.push({ base, attr, adj, t })))));
    shuffle(bc, rnd);
    for (const c of bc) {
      if (BOSS[gi].length >= BOSS_N[gi]) break;
      const name = `${c.adj}${c.base}${c.t}`;
      if (name.length > 6 || INFO[name]) continue;
      INFO[name] = { grade: gi, attr: c.attr, boss: true, base: c.base, mat: bossMat(gi, c.base), hue: hueOf(name, c.attr) };
      BOSS[gi].push(name);
    }
  });

  // 원래부터 있던 몬스터도 같은 종류의 재료를 준다 (이름이 닮은 종류, 없으면 이름으로 정한 종류)
  Object.keys(ORIGINAL).forEach((n) => {
    const o = INFO[n], pool = o.boss ? BOSS[o.grade].filter((x) => !ORIGINAL[x]) : NORMAL[o.grade].filter((x) => !ORIGINAL[x]);
    const fams = [...new Set(pool.map((x) => INFO[x].base))];
    if (!fams.length) return;
    const fam = fams.find((b) => n.includes(b) || b.includes(n.slice(0, 2))) || fams[hash(n) % fams.length];
    const ref = pool.find((x) => INFO[x].base === fam);
    o.mat = INFO[ref].mat; o.base = fam;
  });
  // 등급별로 실제 쓰이는 재료 목록 (제작법이 여기서 고른다)
  const MATS_NORMAL = GRADES.map((g, gi) => [...new Set(NORMAL[gi].map((n) => INFO[n].mat))]);
  const MATS_BOSS = GRADES.map((g, gi) => [...new Set(BOSS[gi].map((n) => INFO[n].mat))]);
  // Gear에 합친다
  Object.keys(global.Gear.MAT_INFO).forEach((k) => { delete global.Gear.MAT_INFO[k]; }); // 옛 재료 목록은 비우고, 실제로 얻을 수 있는 재료만 남긴다
  GRADES.forEach((g, gi) => (gi <= 1 ? GATHER[gi] : []).forEach((m) => { global.Gear.MAT_INFO[m] = { grade: gi, monster: null, gather: true }; }));
  Object.keys(INFO).forEach((n) => { const o = INFO[n]; global.Gear.MONSTERS[n] = { mat: o.mat, attr: o.attr, grade: o.grade, ...(o.boss ? { boss: true } : {}) }; if (!global.Gear.MAT_INFO[o.mat]) global.Gear.MAT_INFO[o.mat] = { grade: o.grade, monster: n }; });

  const pickFrom = (arr, rng) => arr[Math.floor(rng() * arr.length)];
  global.Monsters = { BASES, ADJ, TITLES, BOSS_PART, ORIGINAL, GRADES, NORMAL, BOSS, INFO, GATHER, PLACES, VILLAGES, HELP, MATS_NORMAL, MATS_BOSS, pickFrom,
   
    total: () => Object.keys(INFO).length, normalTotal: () => NORMAL.reduce((a, l) => a + l.length, 0), bossTotal: () => BOSS.reduce((a, l) => a + l.length, 0) };
})(typeof window !== 'undefined' ? window : globalThis);
