/* ============================================================
   appearance.js  -  외형 ID 생성기 (1단계)
   - 외형 9개 요소 <-> 하나의 BigInt ID (혼합 진법)
   - 생성 순번 -> 외형 ID (Feistel 네트워크 + cycle-walking)
   순번이 다르면 외형 ID도 반드시 다르다 (중복 없음, 순열).
   ============================================================ */
(function (global) {
  'use strict';

  // 요소 순서와 종류 수 (기획서 기준). 순서를 바꾸면 기존 ID가 전부 달라지니 주의!
  const PARTS = [
    { key: 'gender',    label: '성별',   size: 2   },
    { key: 'race',      label: '종족',   size: 20  },
    { key: 'skin',      label: '피부색', size: 20  },
    { key: 'eye',       label: '눈',     size: 50  },
    { key: 'hair',      label: '헤어',   size: 100 },
    { key: 'eyeColor',  label: '눈색',   size: 500 },
    { key: 'hairColor', label: '헤어색', size: 500 },
    { key: 'clothes',   label: '옷',     size: 100 },
    { key: 'accessory', label: '장식',   size: 100 },
  ];

  // 전체 조합 수 = 10,000,000,000,000,000 (1경)
  const TOTAL = PARTS.reduce((acc, p) => acc * BigInt(p.size), 1n);

  /* ---------- 9개 값 <-> ID ---------- */

  // { gender:1, race:7, ... } -> BigInt ID
  function encodeAppearance(a) {
    let id = 0n;
    for (const p of PARTS) {
      const v = a[p.key];
      if (!Number.isInteger(v) || v < 0 || v >= p.size) {
        throw new RangeError(`${p.key} 값이 범위(0~${p.size - 1})를 벗어났어요: ${v}`);
      }
      id = id * BigInt(p.size) + BigInt(v);
    }
    return id;
  }

  // BigInt ID -> { gender, race, ... }
  function decodeAppearance(id) {
    id = BigInt(id);
    if (id < 0n || id >= TOTAL) throw new RangeError('외형 ID 범위 오류');
    const a = {};
    for (let i = PARTS.length - 1; i >= 0; i--) {
      const size = BigInt(PARTS[i].size);
      a[PARTS[i].key] = Number(id % size);
      id = id / size;
    }
    return a;
  }

  /* ---------- 순번 -> 외형 ID (Feistel PRP) ---------- */

  // 2^54 = 약 1.8경 > 1경. 27비트 두 조각으로 나눠 Feistel을 돌린다.
  const HALF_BITS = 27n;
  const HALF_MASK = (1n << HALF_BITS) - 1n;
  const ROUNDS = 6;

  // 32비트 정수 섞기 함수 (Math.imul로 정확한 32비트 곱셈)
  function mix32(x) {
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }

  // 라운드 함수 F(오른쪽 조각, 라운드 키) -> 27비트
  function roundFn(r, key) {
    return mix32((r ^ key) >>> 0) & Number(HALF_MASK);
  }

  // 시드 문자열에서 라운드 키 6개를 만든다.
  function makeKeys(seed) {
    let h = 2166136261;
    for (const ch of String(seed)) {
      h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    }
    const keys = [];
    for (let i = 0; i < ROUNDS; i++) {
      h = mix32((h + 0x9e3779b9 + i) >>> 0);
      keys.push(h);
    }
    return keys;
  }

  function feistelEncrypt(n, keys) {
    let L = Number(n >> HALF_BITS);
    let R = Number(n & HALF_MASK);
    for (let i = 0; i < ROUNDS; i++) {
      const nextR = (L ^ roundFn(R, keys[i])) >>> 0;
      L = R;
      R = nextR;
    }
    return (BigInt(L) << HALF_BITS) | BigInt(R);
  }

  function feistelDecrypt(n, keys) {
    let L = Number(n >> HALF_BITS);
    let R = Number(n & HALF_MASK);
    for (let i = ROUNDS - 1; i >= 0; i--) {
      const prevL = (R ^ roundFn(L, keys[i])) >>> 0;
      R = L;
      L = prevL;
    }
    return (BigInt(L) << HALF_BITS) | BigInt(R);
  }

  // 순열 만들기. 같은 seed면 항상 같은 순열이 나온다.
  // 주의: seed는 서버에서만 알고 있어야 외형 예측이 안 된다. 한 번 정하면 절대 바꾸지 말 것!
  function createPermutation(seed) {
    const keys = makeKeys(seed);
    return {
      // 순번(0 ~ 1경-1) -> 외형 ID
      indexToId(index) {
        index = BigInt(index);
        if (index < 0n || index >= TOTAL) throw new RangeError('순번 범위 오류 (외형 조합이 모두 소진됨)');
        let x = index;
        do { x = feistelEncrypt(x, keys); } while (x >= TOTAL); // cycle-walking
        return x;
      },
      // 외형 ID -> 순번 (검증용 역함수)
      idToIndex(id) {
        let x = BigInt(id);
        do { x = feistelDecrypt(x, keys); } while (x >= TOTAL);
        return x;
      },
    };
  }

  global.Appearance = {
    PARTS, TOTAL,
    encodeAppearance, decodeAppearance, createPermutation,
  };
})(typeof window !== 'undefined' ? window : globalThis);
