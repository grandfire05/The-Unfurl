/* ============================================================
   guild-guide.js - 길잡이 퀘스트 · 탭 해금 · 해금 안내(챕터) 규칙
   길드 상태(state)는 guild.js가 갖고 있고, 여기서는 getState()로 읽기만 한다. 저장은 받은 save()에 맡긴다.
   (guild.js보다 먼저 불러온다)
   ============================================================ */
(function (global) {
  'use strict';
  function create(getState, save) {
    const st = getState;
  const newGuide = (open) => ({ unlock: open ? { quests: true, roster: true, shop: true, guild: true } : { quests: false, roster: false, shop: false, guild: false }, done: {}, chap: null, queue: [], news: [] });
  // 순서대로 하나씩 열린다. 달성하면 보상을 받고, 탭이 열리며(unlock), 그 기능의 짧은 안내(chapter)가 뜬다. 보상·조건은 임시 값.
  const GUIDE = [
    { id: 'hire', title: '모험가 채용하기', hint: '주점에서 지원자의 이야기를 듣고 채용해요.', goal: 1, cur: () => st().stats.recruited, gold: 0, unlock: 'quests', open: '원정' },
    { id: 'first', title: '첫 의뢰 완수하기', hint: '원정 탭에서 연습 의뢰를 받아 모험가를 보내요.', goal: 1, cur: () => (st().tutorial >= 29 ? 1 : 0), gold: 150, unlock: 'roster', open: '동료', chapter: 'roster' },
    { id: 'clear3', title: '의뢰 3건 완수하기', hint: '원정 탭의 게시판에서 의뢰를 골라 보내요.', goal: 3, cur: () => st().stats.clears, gold: 200, unlock: 'shop', open: '장터', chapter: 'market' },
    { id: 'clear8', title: '의뢰 8건 완수하기', hint: '모험가를 키우며 의뢰를 계속 해결해요.', goal: 8, cur: () => st().stats.clears, gold: 300, unlock: 'guild', open: '길드', chapter: 'guild' },
    { id: 'promote', title: '길드를 E등급으로 승급하기', hint: '의뢰로 명성을 모아 길드 탭에서 승급해요.', goal: 1, cur: () => (st().guildGrade >= 1 ? 1 : 0), gold: 500 },
  ];
  const unlockedCat = (id) => !st().guide || id === 'hub' || id === 'recruit' || !!st().guide.unlock[id];
  const lockReason = (id) => { const q = GUIDE.find((x) => x.unlock === id); return q ? `'${q.title}'를 마치면 열려요.` : ''; };
  // 달성한 퀘스트를 처리한다. 새로 마친 것이 있으면 true
  function guideCheck() {
    if (!st() || !st().guide) return false;
    const g = st().guide; let any = false;
    for (const q of GUIDE) {
      if (g.done[q.id] || q.cur() < q.goal) continue;
      g.done[q.id] = Date.now(); any = true;
      if (q.gold) st().gold += q.gold;
      if (q.unlock) g.unlock[q.unlock] = true;
      if (q.chapter) g.queue.push(q.chapter);
      g.news.push({ id: q.id, title: q.title, gold: q.gold, open: q.open || '' });
    }
    if (any) save();
    return any;
  }
  const guideInfo = () => GUIDE.map((q) => ({ id: q.id, title: q.title, hint: q.hint, goal: q.goal, cur: Math.min(q.goal, q.cur()), gold: q.gold, open: q.open || '', done: !!(st().guide && st().guide.done[q.id]) }));
  const guideNow = () => guideInfo().find((q) => !q.done) || null; // 지금 목표
  const takeGuideNews = () => { const n = st().guide.news; st().guide.news = []; return n; };
  const guideChap = () => (st().guide && st().guide.chap) || null;
  function guideStartChapter() { const g = st().guide; if (!g.chap && g.queue.length) { g.chap = { id: g.queue.shift(), i: 0 }; save(); } return g.chap; }
  function guideSetChap(i, len) { const g = st().guide; if (!g.chap) return; if (i >= len) { g.chap = null; } else g.chap.i = i; save(); }
  const guideQueued = () => !!(st().guide && (st().guide.chap || st().guide.queue.length));

    return { newGuide, GUIDE, unlockedCat, lockReason, guideCheck, guideInfo, guideNow, takeGuideNews, guideChap, guideStartChapter, guideSetChap, guideQueued };
  }
  global.GuildGuide = { create };
})(window);
