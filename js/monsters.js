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
    [['오크', '뼈'], ['트롤', '피'], ['웨어울프', '털'], ['미노타우로스', '뿔'], ['석상 병사', '파편'], ['뱀파이어', '송곳니'], ['와이트', '수의'], ['켄타우로스', '발굽'], ['사이클롭스', '눈알'], ['바실리스크', '독액']],
    [['정령', '결정'], ['골렘', '핵'], ['데스나이트', '갑옷 조각'], ['히드라', '비늘'], ['키메라', '갈기'], ['리치', '두개골'], ['그리폰', '깃털'], ['엔트', '수액']],
    [['와이번', '비늘'], ['드레이크', '심장'], ['거인', '뼈'], ['서큐버스', '날개'], ['악마', '뿔'], ['기사 악령', '검 파편'], ['용인', '비늘']],
    [['심연의 사도', '파편'], ['타락한 천사', '깃털'], ['공허의 군체', '핵'], ['그림자 군주', '정수'], ['고룡', '비늘'], ['마신', '정수']],
  ];
  const ADJ = {
    불: ['붉은', '불타는', '이글거리는', '화염의', '그을린', '달아오른', '용암빛', '잿불의'],
    물: ['푸른', '젖은', '물결치는', '이슬 맺힌', '얼어붙은', '안개 낀', '깊은', '소금기 어린'],
    바람: ['날쌘', '휘몰아치는', '깃털 달린', '떠도는', '돌풍의', '하늘빛', '가벼운', '속삭이는'],
    땅: ['단단한', '진흙투성이', '바위 같은', '굴 파는', '이끼 낀', '묵직한', '모래빛', '뿌리 내린'],
    빛: ['빛나는', '하얀', '금빛', '성스러운', '눈부신', '새벽의', '투명한', '반짝이는'],
    어둠: ['검은', '그림자의', '어두운', '밤의', '사악한', '음침한', '저주받은', '안개 속의'],
  };
  const ATTRS = Object.keys(ADJ);
  const TITLES = ['왕', '우두머리', '군주', '여왕', '대장', '수호자', '폭군', '주술사', '파괴자', '제왕'];
  const BOSS_PART = ['증표', '왕관 조각', '심장', '송곳니', '핵', '인장', '뿔', '눈동자'];

  // 원래부터 있던 몬스터 (저장된 의뢰와의 호환)
  const ORIGINAL = {
    '들쥐': { mat: '쥐 가죽', attr: '땅', grade: 0 }, '쥐왕': { mat: '쥐왕의 이빨', attr: '어둠', grade: 0, boss: true },
    '늑대': { mat: '늑대 가죽', attr: '바람', grade: 1 }, '우두머리 늑대': { mat: '은빛 송곳니', attr: '바람', grade: 1, boss: true },
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

  Object.keys(ORIGINAL).forEach((n) => { const o = ORIGINAL[n]; INFO[n] = { ...o, base: n, hue: hueOf(n, o.attr) }; (o.boss ? BOSS : NORMAL)[o.grade].push(n); });
  GRADES.forEach((g, gi) => {
    const rnd = mulberry(7001 + gi * 131);
    const combos = [];
    BASES[gi].forEach(([base, part], bi) => ATTRS.forEach((attr) => ADJ[attr].forEach((adj) => combos.push({ base, part, attr, adj }))));
    shuffle(combos, rnd);
    for (const c of combos) {
      if (NORMAL[gi].length >= NORMAL_N[gi]) break;
      const name = `${c.adj} ${c.base}`;
      if (INFO[name]) continue;
      INFO[name] = { grade: gi, attr: c.attr, boss: false, base: c.base, mat: `${name} ${c.part}`, hue: hueOf(name, c.attr) };
      NORMAL[gi].push(name);
    }
    const bc = [];
    BASES[gi].forEach(([base], bi) => ATTRS.forEach((attr) => ADJ[attr].forEach((adj) => TITLES.forEach((t) => bc.push({ base, attr, adj, t })))));
    shuffle(bc, rnd);
    for (const c of bc) {
      if (BOSS[gi].length >= BOSS_N[gi]) break;
      const name = `${c.adj} ${c.base} ${c.t}`;
      if (INFO[name]) continue;
      INFO[name] = { grade: gi, attr: c.attr, boss: true, base: c.base, mat: `${name}의 ${BOSS_PART[hash(name) % BOSS_PART.length]}`, hue: hueOf(name, c.attr) };
      BOSS[gi].push(name);
    }
  });

  // Gear에 합친다
  GRADES.forEach((g, gi) => GATHER[gi].forEach((m) => { global.Gear.MAT_INFO[m] = { grade: gi, monster: null, gather: true }; }));
  Object.keys(INFO).forEach((n) => { const o = INFO[n]; global.Gear.MONSTERS[n] = { mat: o.mat, attr: o.attr, grade: o.grade, ...(o.boss ? { boss: true } : {}) }; global.Gear.MAT_INFO[o.mat] = { grade: o.grade, monster: n }; });

  const pickFrom = (arr, rng) => arr[Math.floor(rng() * arr.length)];
  global.Monsters = { GRADES, NORMAL, BOSS, INFO, GATHER, PLACES, VILLAGES, HELP, pickFrom, CORE: 24, CORE_BOSS: 5, // 제작법에 쓰이는 앞쪽 몬스터는 의뢰에 더 자주 나온다
    total: () => Object.keys(INFO).length, normalTotal: () => NORMAL.reduce((a, l) => a + l.length, 0), bossTotal: () => BOSS.reduce((a, l) => a + l.length, 0) };
})(typeof window !== 'undefined' ? window : globalThis);
