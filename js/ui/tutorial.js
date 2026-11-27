/* ui/tutorial.js — 튜토리얼과 챕터 안내(스포트라이트·타자 연출)
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

  /* ============================================================
     튜토리얼 (건너뛸 수 없다)
     카드 단계는 [다음]을 눌러야 넘어가고, 행동 단계는 조건이 채워지면 저절로 넘어간다.
     행동 단계에서는 안내에 없는 버튼이 막히고, 눌러야 할 버튼이 반짝인다.
     ============================================================ */
  const chars2 = () => Guild.state.characters.filter((c) => c.status === 'ACTIVE').length;
  const TUT = [
    { card: true, t: '길드에 오신 걸 환영해요', x: '당신은 작은 길드의 마스터예요.<br>개성 있는 모험가를 맞이하고 정성껏 키우는 게임이에요.<br>의뢰와 전투는 그 수단일 뿐이에요.<br><br><b>체력이 0이 된 모험가는 영원히 돌아오지 않아요.</b><br>잃은 사람은 되살릴 수 없으니, 누구를 어디로 보낼지 신중하게 정해요.', btn: '시작하기' },
    { t: '모험가를 맞이해요', x: '모험가는 <b>주점</b>에서 만나요.<br>위쪽 <b>주점</b> 탭(숫자 키 <b>4</b>)을 눌러 보세요.<br>▸ 지원자는 시간이 지나면 새로 찾아와요.<br>▸ 놓친 지원자는 다시 오지 않을 수도 있어요.', hl: ['#tabs .tab[data-screen="recruit"]'], allow: { goto: ['recruit'], acts: [] }, done: () => U.screen === 'recruit' },
    { t: '이야기를 들어봐요', x: '지원자가 자기 이야기를 들려줘요. <b>아래 대사창</b>을 눌러 끝까지 들어 봐요.<br>▸ 출신지·말투·사연에 그 사람의 <b>성격</b>이 묻어나요.<br>▸ 오른쪽 위 <b>면접 메모</b>에 들은 이야기가 쌓여요.<br>▸ 마지막에 <b>색이 다른 한 줄</b>이 나오면 숨은 재능을 암시하는 <b>힌트</b>예요.', hl: ['.rcp-dlg', '.rcp-memo'], allow: { goto: ['recruit'], acts: ['rec-next', 'app-sel'] }, done: () => { const a = Guild.applicants[0]; if (!a) return false; const n = a.story.length + (a.hint ? 1 : 0); return (U.recLine || 0) >= n - 1; } },
    { next: true, t: '채용 전에 확인해요', x: '<b>채용 점검</b> (왼쪽 아래)<br>▸ <b>금화</b>와 <b>기숙사 자리</b>가 모두 충족돼야 채용할 수 있어요.<br><b>지원서</b> (오른쪽 아래)<br>▸ 이름, 기본 직업, 접수처에 <b>머무는 시간</b>이 적혀 있어요.<br>▸ 시간이 지나면 떠나니, 마음에 들면 서둘러요.', hl: ['.rcp-pad'], allow: { goto: ['recruit'], acts: [] } },
    { t: '첫 모험가를 채용해요', x: '한 명을 골라 <b>채용</b>을 눌러요. (금화 100)<br>▸ 어떤 사람인지는 채용해야 알 수 있어요.<br>▸ 모험가는 저마다 <b>성격과 재능</b>이 달라서 같은 사람이 없어요.<br>▸ 마음에 들지 않으면 <b>돌려보내기</b>로 다른 지원자를 기다려요.', hl: ['[data-act="hire"]', '[data-act="app-sel"]', '[data-act="app-dismiss"]'], allow: { goto: ['recruit'], acts: ['app-sel', 'hire', 'app-dismiss'] }, done: () => chars2() >= 1 },
    { at: 4, t: '채용 연출을 기다려요', noClose: true, x: '채용하면 모험가의 정보가 <b>슬롯머신</b>처럼 하나씩 공개돼요.<br>▸ 희귀도 → 직업 → 속성 → 고유스킬 → 특성 → 능력치 순서예요.<br>▸ 끝까지 지켜보거나, 화면을 눌러 바로 결과로 넘어가도 돼요.', hl: ['.reveal'], allow: { goto: [], acts: [] }, done: () => !U.modal || U.revFin === U.modal.id },
    { next: true, at: 4, noClose: true, t: '공개된 정보 읽는 법 ①', x: '<b>왼쪽</b>은 이름과 얼굴이에요. 같은 모험가는 한 명도 없어요.<br><b>오른쪽 · 정해진 정보</b><br>▸ <b>희귀도</b>: 높을수록 잠재력이 커요.<br>▸ <b>직업 · 속성</b>: 싸우는 방식과 약점이 정해져요.<br>▸ <b>고유스킬</b>: <b>있음</b>이면 이 모험가만 가진 특별한 스킬이에요.<br>▸ <b>특성</b>: 타고난 성격이에요. 나중에 얻을 수는 없어요.', hl: ['.rv-left', '.rv-right .rv-row'], allow: { goto: [], acts: [] } },
    { next: true, at: 4, noClose: true, t: '공개된 정보 읽는 법 ②', x: '<b>능력치</b><br>▸ 체력·공격·방어·운·속도예요. 막대가 길수록 그 분야가 뛰어나요.<br>▸ 레벨이 오르면 함께 자라요.<br>▸ 스킬과 장비의 효과도 여기에 반영돼 있어요.', hl: ['.rv-stats'], allow: { goto: [], acts: [] } },
    { t: '합류를 확인해요', x: '이제 아래 <b>확인</b>을 눌러 닫아요.', hl: ['.modal .mfoot .btn.ghost'], allow: { goto: ['recruit'], acts: ['close-modal'] }, done: () => !U.modal },
    { next: true, t: '길잡이가 도와줘요', x: '왼쪽 <b>길잡이 카드</b>를 봐요.<br>▸ 지금 해야 할 일을 알려 주는 <b>목표 카드</b>예요.<br>▸ 막막할 땐 언제든 이 카드를 먼저 확인해 보세요.', hl: ['.gcard'], allow: { goto: [], acts: [] } },
    { card: true, t: '길드의 작은 지원', x: '첫 의뢰를 위해 길드가 작은 선물을 준비했어요.<br>▸ <b>Lv.3</b>으로 시작해요.<br>▸ 몬스터가 약하고 늘 안전한 <b>연습 의뢰</b>를 하나 걸어 뒀어요.<br>(튜토리얼에서만 주는 선물이에요)<br><br>이제 원정 탭에 걸린 의뢰를 하나 맡아 볼까요?', btn: '고마워요', wait: () => U.screen === 'quests', onNext: () => { Guild.state.characters.filter((c) => c.status === 'ACTIVE').slice(0, 1).forEach((c) => { if (c.level < 3) Guild.devSetLevel(c.id, 3); }); Guild.addTutorialContract(); U.contract = null; U.tutPicked = false; } },
    { next: true, at: 520, t: '의뢰지 읽는 법', x: '종이 한 장이 의뢰 하나예요.<br>▸ <b>동그란 글자</b>: 등급 (F가 가장 쉬워요)<br>▸ <b>이름·종류·필요 인원</b>: 무엇을 몇 명이 하는지<br>▸ <b>금화·경험치</b>: 보상<br>▸ <b>명성</b>: 클리어하면 오르고(+), 사망·전멸하면 내려가요(−)<br>▸ <b>위험도 칩</b>: 파티를 정하면 나타나요<br>▸ <b>마감 시간</b>: 지나면 사라지고 새 의뢰로 채워져요', hl: ['.cork'], allow: { goto: ['quests'], acts: [] } },
    { t: '의뢰를 골라요', x: '<b>연습 의뢰</b> 종이를 눌러 선택해요.<br>▸ <b>의뢰 상세</b>와 <b>원정대 편성</b> 화면이 열려요.', hl: ['.qnote'], allow: { goto: ['quests'], acts: ['quest-sel'] }, done: () => !!U.tutPicked || Guild.missions.length >= 1 },
    { next: true, t: '편성 화면 ① 의뢰 상세', x: '<b>화면 왼쪽 · 의뢰 상세</b><br>▸ 이 의뢰의 보상(금화·경험치)과 명성 변화예요.<br>▸ 아래 <b>출정 준비</b> 점검표는 조건이 모자라면 빨간 줄로 알려 줘요.<br>▸ 파티를 정하면 점검표에 <b>파티 평균 체력</b>도 나와요. 체력이 낮은 모험가가 있으면 알려 줘요.', hl: ['.qpaper'], allow: { goto: ['quests'], acts: [] } },
    { next: true, t: '편성 화면 ② 원정대 편성', x: '<b>화면 가운데 · 원정대 편성</b><br>▸ 위쪽 칩: 상대 몬스터, 필요 인원, <b>위험도</b>예요. 위험도는 위기를 맞을 가능성이에요.<br>▸ 둥근 칸에 모험가를 넣어요. 칸 아래에 <b>체력 막대</b>가 따라붙어요.<br>▸ 몬스터의 <b>약점 속성</b>과 맞는 모험가에게는 일치 표시가 떠요.', hl: ['.cpanel'], allow: { goto: ['quests'], acts: [] } },
    { t: '직접 파티를 꾸려 봐요', x: '오른쪽 <b>대기 모험가</b>를 눌러 파티에 넣어 봐요.<br>▸ 이름 옆 <b>체력 막대</b>가 <b>현재 체력</b>이에요. 초록 · 주황 · 빨강으로 위험이 보여요.<br>▸ 전투는 <b>지금 가진 체력 그대로</b> 시작해요. 다친 채로 보내면 그만큼 위험해요.<br>▸ 넣고 나면 왼쪽 점검표에 <b>파티 평균 체력</b>이 나타나요. (체력은 길드에서 쉬면 천천히 차요)', hl: ['.pscreen .dpanel', '.pslots'], allow: { goto: ['quests'], acts: ['party-toggle', 'cand-sort', 'recommend', 'clear-party'] }, done: () => U.party.length >= 1 },
    { t: '출정 방침을 눌러 봐요', x: '<b>출정 방침</b>은 이번 원정의 태도예요. 하나씩 눌러서 설명을 읽어 봐요.<br>▸ <b>신중</b>: 방어와 버티는 힘이 올라 더 안전하지만 조금 느려요.<br>▸ <b>균형</b>: 추가 효과가 없어요.<br>▸ <b>공격적</b>: 강해지고 빨리 끝나지만 훨씬 위험해요.<br>▸ 이번 연습 의뢰는 무엇을 골라도 <b>균형으로 적용</b>돼요.', hl: ['.pol-bar'], allow: { goto: ['quests'], acts: ['policy'] }, done: () => !!(U.tutTry && U.tutTry.pol) },
    { t: '재료 받기 / 안 받기를 눌러 봐요', x: '나올 <b>재료</b>를 어떻게 할지 정해요. 두 버튼을 눌러 설명을 읽어 봐요.<br>▸ <b>재료 받기</b>: 재료가 바로 길드 <b>보급고</b>로 들어와요. 대신 모험가가 가져가는 수수료가 늘어요.<br>▸ <b>안 받기</b>: 재료는 모험가가 팔아요. 대금은 <b>24시간 뒤</b> 모험가 지갑으로 들어가고, 수수료는 그대로예요.<br>▸ 모험가가 가져가는 돈은 거의 비슷해요. 재료가 필요하면 받기를 골라요.<br>▸ 연습 의뢰는 무엇을 골라도 <b>받기, 수수료 없음</b>으로 적용돼요.', hl: ['.mat-bar'], allow: { goto: ['quests'], acts: ['matmode'] }, done: () => !!(U.tutTry && U.tutTry.mat) },
    { t: '출정해요', x: '준비가 끝났어요. <b>출정!</b>을 눌러요.<br>▸ 인원이 모자라면 <b>자동 편성</b>을 써도 돼요.<br>▸ 위험도 칩이 이 파티가 위기를 맞을 가능성을 알려 줘요. 연습 의뢰는 언제나 <b>안전</b>이에요.', hl: ['[data-act="dispatch"]'], allow: { goto: ['quests'], acts: ['quest-sel', 'party-toggle', 'recommend', 'clear-party', 'dispatch', 'cand-sort', 'confirm-yes'] }, done: () => Guild.missions.length >= 1 },
    { t: '전투를 지켜봐요', x: '파티가 길드를 떠났어요!<br>위쪽 <b>원정 중</b> 칩(위기 신호가 떴다면 <b>위기</b> 칩)을 눌러 <b>전투 보기</b>로 가 봐요.<br>▸ 모험가들이 싸우며 주고받는 말도 이 게임의 재미예요.', hl: ['.strip .schip', '[data-act="view-battle"]'], allow: { goto: ['quests', 'active'], acts: ['view-battle'] }, done: () => U.screen === 'battle' },
    { next: true, at: 300, t: '전투 화면 읽는 법 ①', x: '<b>위쪽</b><br>▸ 의뢰 이름, 전투 경과 시간, 남은 몬스터 수<br>▸ <b>우리 편이 이길 확률</b>은 실시간으로 바뀌어요.<br><b>왼쪽 위 · 행동 순서</b><br>▸ 다음에 누가 움직이는지 알려줘요.', hl: ['.b-top', '.b-order'], allow: { goto: [], acts: [] } },
    { next: true, t: '전투 화면 읽는 법 ② 체력', x: '<b>왼쪽이 우리 모험가</b>예요. 이름 아래 막대가 <b>체력(HP)</b>이에요.<br>▸ 체력이 <b>15% 아래</b>로 떨어지면 <b>위기</b>예요. 전투가 멈추고 결정을 내려요.<br>▸ <b>0이 되면 사망</b>해요. 단, 전투마다 한 번, 확률로 <b>치명상을 버텨요</b>.<br>▸ 체력 막대 밑의 <b>파란 게이지</b>는 <b>행동 게이지</b>예요. 가득 차면 그 모험가가 공격하고, <b>속도</b>가 높을수록 빨리 차요.<br>▸ 이번 연습에서는 위기를 겪어 볼 수 있게 <b>일부러 체력을 15% 아래로</b> 맞춰 뒀어요.', hl: ['.b-party'], allow: { goto: [], acts: [] } },
    { next: true, t: '전투 화면 읽는 법 ③ 몬스터·기록·승률', x: '<b>오른쪽은 몬스터</b>예요. 몬스터 아래 막대는 몬스터의 체력이에요.<br>▸ 모험가들은 싸우며 <b>말풍선</b>으로 한마디씩 해요. 성격이 묻어나요.<br>▸ <b>좋은 일 · 나쁜 일</b>이 일어나기도 해요. 4명 이상이면 호흡이 안 맞는 사고도 나요.<br><b>아래쪽</b><br>▸ <b>전투 기록</b>: 일어난 일이 글로 남아요.<br>▸ <b>승률 그래프</b>: 선이 올라가면 유리, 내려가면 불리예요. 전투 중에는 개입할 수 없어요.', hl: ['.b-enemies', '.b-log', '.b-bottom'], allow: { goto: [], acts: [] } },
    { card: true, t: '전투는 실시간이에요', x: '전투 시간은 실제 시간과 같이 흘러요.<br>▸ <b>얼마나 걸릴지는 아무도 몰라요.</b> (대개 몇 분)<br>▸ 접속을 끊어도 전투는 계속돼요.<br>▸ 끝나면 <b>귀환 보고</b>가 도착해요.', btn: '다음' },
    { card: true, t: '위기가 오면 결정해요', x: '모험가의 체력이 <b>15% 아래</b>로 떨어지면 전투가 멈춰요.<br>▸ <b>계속 싸운다</b>: 끝까지 싸워요. 이기면 큰 성과지만 잃을 수도 있어요.<br>▸ <b>전체 후퇴</b>: 모두 물러나요. 경험치는 적지만 모두 살아요.<br>▸ <b>엄호 후퇴</b>: 한 명이 남아 시간을 벌고 나머지는 물러나요. 남은 사람은 <b>살아 돌아올 확률</b>이 있어요. 파티에 2명 이상 있을 때만 고를 수 있어요.<br>▸ 화면에는 전황과 <b>동료들의 의견</b>이 보여요. 같은 편을 들면 가까워지고, 반대하면 사이가 멀어져요.<br>▸ 시간 안에 정하지 않으면 계속 싸워요.<br><br>이제 직접 결정해 볼 차례예요.', btn: '해 볼게요' },
    { t: '위기! 직접 결정해요', x: '지금 우리 모험가의 체력이 15% 아래예요. 아래 위기 창을 읽어 봐요.<br>▸ <b>남은 적 · 파티원 체력 · 동료 의견</b>을 보고 판단하는 곳이에요.<br>▸ <b>🔒 엄호 후퇴</b>는 2명 이상일 때만 열려요. 지금은 1명이라 잠겨 있어요.<br>▸ 이번에는 <b>전체 후퇴</b>를 눌러 봐요. (연습에서는 다른 선택이 잠겨 있어요)<br>▸ 결정이 끝나면 의뢰가 끝나고 <b>체력도 전부 회복</b>돼요.', hl: ['.crisis'], allow: { goto: [], acts: ['decide', 'confirm-yes', 'close-modal'] }, done: () => { const m = Guild.missions[0]; return !m || (!!m.hadCrisis && Guild.missionInfo(m).state !== 'alert'); } },
    { card: true, t: '쓰러진 모험가는 돌아오지 않아요', x: '체력이 0이 되면 그 모험가는 <b>영원히</b> 떠나요.<br>▸ 떠나기 전에 <b>유언</b>을 남기고, 몸에 지닌 <b>유품</b>은 가까운 동료가 이어받을 수 있어요.<br>▸ 유품을 이어받으면 영구히 조금 더 강해져요.<br>▸ 함께 갔다 돌아온 동료는 <b>슬픔</b>에 잠겨 6~24시간 의뢰에 나갈 수 없어요. 추모식을 열면 바로 풀려요.<br>▸ 그래서 누구를 보낼지, 언제 물러날지가 중요해요.', btn: '알겠어요' },
    { t: '결과를 기다려요', x: '전투가 끝나면 <b>귀환 보고</b>가 도착해요.<br>▸ 기다리는 동안 다른 화면을 둘러봐도 돼요.<br>▸ 앞으로는 위기 신호가 오면 직접 판단해야 해요.<br>▸ 이번 연습 의뢰는 안전하니 마음 편히 기다려요.', allow: null, done: () => mailCount() >= 1 },
    { t: '결과를 확인해요', x: '위쪽 <b>귀환 보고</b> 칩을 눌러 <b>확인</b>해요.<br>▸ <b>경험치</b>: 모험가가 성장해요.<br>▸ <b>재료</b>: 장비의 원료가 돼요.<br>▸ <b>명성</b>: 길드를 키워 줘요.<br>▸ 모험가의 <b>등급 점수</b>도 쌓여요.', hl: ['.strip [data-screen="results"]', '[data-act="dismiss"]'], allow: { goto: ['quests', 'results', 'active'], acts: ['dismiss', 'dismiss-all', 'close-modal'] }, done: () => mailCount() === 0 },
    { next: true, t: '이제 길잡이를 따라가세요', get x() { const q = Guild.guideNow(); return `첫 의뢰를 무사히 마쳤어요! 튜토리얼은 여기까지예요.<br>▸ 지금 목표는 <b>${q ? q.title : '길잡이 카드'}</b>예요.<br>▸ <b>전체 목표 보기</b>로 앞으로의 목표와 보상을 볼 수 있어요.<br>▸ 목표를 마칠 때마다 <b>보상</b>을 받고 <b>새 기능</b>이 열려요. 새 기능의 안내는 따로 나와요.`; }, hl: ['.gcard'], allow: { goto: [], acts: [] } },
  ];
  // 마지막 단계를 지난 저장(이전 버전의 버그로 단계만 올라간 경우)은 튜토리얼을 마친 것으로 본다
  // 해금될 때마다 뜨는 짧은 안내. 형식은 처음 튜토리얼과 같다.
  const tabSel = (id) => `#tabs .tab[data-screen="${id}"]`, subSel = (id) => `.tb-sub .pill[data-screen="${id}"]`;
  const CH = {
    roster: [
      { t: '동료 탭이 열렸어요', x: '첫 의뢰를 마쳐서 <b>동료</b> 탭이 열렸어요.<br>위쪽 <b>동료</b> 탭(숫자 키 <b>3</b>)을 눌러 모험가들의 체력을 확인해 봐요.<br>▸ 귀환한 모험가는 <b>싸우고 남은 체력 그대로</b> 돌아와요.', hl: [tabSel('roster')], allow: { goto: ['roster'], acts: [] }, done: () => U.screen === 'roster' },
      { next: true, t: '체력은 쉬어야 차요', x: '이름 옆 <b>체력 막대</b>와 오른쪽 상세의 <b>큰 막대</b>가 현재 체력이에요.<br>▸ 가득 차기 전에는 상태가 <b>회복중</b>으로 보여요.<br>▸ 길드에서 쉬는 동안 천천히 차요. 의뢰나 훈련 중에는 차지 않아요.<br>▸ <b>병동</b>을 키우면 더 빨리 낫고, 회복중에도 보낼 수는 있지만 <b>위험</b>해요.', hl: ['.rrow .hpm', '.rd-hp'], allow: { goto: [], acts: [] } },
      { next: true, t: '수련장', x: '<b>수련장</b>에서는 시간을 들여 모험가를 키울 수 있어요.<br>▸ 의뢰에 나가지 않는 동안 천천히 성장시키고 싶을 때 써요.', hl: [subSel('dojo')], allow: { goto: [], acts: [] } },
      { card: true, t: '함께한 시간이 유대가 돼요', x: '같은 파티로 살아 돌아오면 모험가끼리 <b>유대</b>가 쌓여요.<br>▸ 지인 → 동료 → 전우 → 막역 순으로 깊어져요.<br>▸ 유대가 깊으면 서로를 지켜 줘서 <b>더 강하고 더 안 죽어요</b>.<br>▸ 파티가 <b>4명 이상</b>이면 호흡이 안 맞는 사고가 생겨요. 유대가 깊은 파티일수록 드물어요.<br>▸ 편성 화면 점검표의 <b>유대</b> 줄과 동료 상세의 <b>관계</b>에서 볼 수 있어요.', btn: '다음' },
    ],
    market: [
      { t: '장터가 열렸어요', x: '의뢰를 몇 번 해냈더니 <b>장터</b>가 열렸어요.<br>위쪽 <b>장터</b> 탭(숫자 키 <b>5</b>)을 눌러 봐요.<br>▸ 이번에는 장비를 직접 하나 만들어 팔아 볼 거예요.', hl: [tabSel('shop')], allow: { goto: ['shop'], acts: [] }, enter: () => Guild.tutorialMats(), done: () => ['shop', 'workshop', 'warehouse'].includes(U.screen) },
      { next: true, t: '보급고', x: '<b>보급고</b>에는 의뢰에서 받은 <b>재료</b>가 쌓여요.<br>▸ 몬스터마다 떨어뜨리는 재료가 달라요.<br>▸ 길드가 첫 제작용 재료를 조금 넣어 뒀어요.', hl: [subSel('warehouse')], allow: { goto: [], acts: [] } },
      { t: '대장간으로 가요', x: '<b>장터 › 대장간</b>을 눌러 봐요.<br>▸ 재료로 <b>장비</b>를 만드는 곳이에요.', hl: [subSel('workshop')], allow: { goto: ['workshop'], acts: [] }, done: () => U.screen === 'workshop' },
      { t: '낡은 단검을 만들어요', x: '<b>낡은 단검</b>의 <b>제작</b> 버튼을 눌러 봐요.<br>▸ 필요한 재료와 금화가 모두 갖춰져 있어요.<br>▸ 제작법마다 재료가 정해져 있고, 품질은 만들어 봐야 알 수 있어요.', hl: ['[data-act="craft"]'], allow: { goto: ['workshop'], acts: ['craft', 'ws-slot', 'ws-grade'] }, done: () => Guild.state.crafts.length > 0 || Guild.state.stats.crafted > 0 },
      { t: '완성을 기다려요', x: '제작에는 시간이 걸려요. 보통은 몇 분에서 몇 시간이지만, 이번에는 길드가 서둘러 줘서 금방 끝나요.<br>▸ 완성된 장비는 <b>보급고</b>에 들어와요.', enter: () => Guild.tutorialFastCraft(), allow: null, done: () => Guild.state.stats.crafted > 0 },
      { t: '가판대로 가요', x: '<b>장터 › 가판대</b>를 눌러 봐요.<br>▸ 만든 장비는 여기에 올려 팔아요.', hl: [subSel('shop')], allow: { goto: ['shop'], acts: [] }, done: () => U.screen === 'shop' },
      { t: '진열해요', x: '완성된 장비의 <b>진열</b> 버튼을 눌러요.<br>▸ <b>적정가</b>에 올려 두면 모험가들이 사 가요.<br>▸ 너무 비싸면 팔리지 않고, 너무 싸면 손해예요.', hl: ['[data-act="display"]'], allow: { goto: ['shop'], acts: ['display'] }, done: () => Guild.state.display.length > 0 },
      { card: true, t: '장사 시작!', x: '장비가 팔리면 모험가의 지갑에서 금화가 길드로 들어와요.<br>▸ 의뢰에서 <b>재료 받기</b>를 고르면 재료가 늘어요.<br>▸ 재료로 더 좋은 장비를 만들어 팔아 길드를 키워요.', btn: '다음' },
    ],
    guild: [
      { t: '길드 탭이 열렸어요', x: '이제 길드를 키울 차례예요.<br>위쪽 <b>길드</b> 탭(숫자 키 <b>6</b>)을 눌러 봐요.', hl: [tabSel('guild')], allow: { goto: ['guild'], acts: [] }, done: () => ['guild', 'achv', 'memorial', 'chronicle', 'codex'].includes(U.screen) },
      { next: true, t: '건설과 승급', x: '<b>건설</b>에서는 의뢰로 쌓은 <b>명성</b>으로 길드를 <b>승급</b>하고 시설을 지어요.<br>▸ 승급하면 더 어려운 의뢰와 새 시설이 열려요.', hl: [subSel('guild')], allow: { goto: [], acts: [] } },
      { next: true, t: '도감', x: '<b>도감</b>에는 만난 몬스터가 기록돼요.<br>▸ 몬스터의 <b>약점 속성</b>은 많이 만날수록 더 자세히 알게 돼요.', hl: [subSel('codex')], allow: { goto: [], acts: [] } },
      { card: true, t: '이제 길드 운영 시작', x: '▸ <b>공적</b>은 달성할 때마다 보상을 줘요.<br>▸ <b>기념비</b>와 <b>연대기</b>에는 잃은 사람들과 길드의 역사가 남아요.<br><br>모험가를 잃어도 그 이름은 남아요. 건투를 빌어요!', btn: '시작' },
    ],
  };
  // 지금 보여 줄 안내: 첫 튜토리얼이 진행 중이면 그것, 아니면 해금 안내. 첫 튜토리얼이 '기다리는' 단계에 있으면(조건 미충족) 아무것도 띄우지 않는다.
  function tutCtx() {
    if (Guild.tutorialActive()) {
      const i = Guild.tutorialStep(), s = TUT[Math.min(i, TUT.length - 1)];
      if (s && s.wait && !s.wait()) return null;
      return { kind: 'main', list: TUT, i, id: 'main' };
    }
    const c = Guild.guideChap();
    return c && CH[c.id] ? { kind: 'ch', list: CH[c.id], i: c.i, id: c.id } : null;
  }
  const tutStep = () => { const c = tutCtx(); return c ? c.list[Math.min(c.i, c.list.length - 1)] : null; };
  const tutOn = () => !!tutCtx();
  const tutKey = (c) => (c ? c.id + ':' + c.i : '');
  function tutSet(c, n) {
    if (c.kind === 'main') Guild.setTutorial(n >= TUT.length ? Guild.TUTORIAL_DONE : n); else Guild.guideSetChap(n, c.list.length);
    const ns = c.list[n]; if (ns && ns.enter) ns.enter(); // 단계가 시작될 때 할 일 (재료 지급 등)
  }
  // 조건이 채워진 행동 단계는 넘긴다 (카드 단계는 클릭해야 한다)
  function tutAdvance() {
    for (let guard = 0; guard++ < 20;) {
      const c = tutCtx(); if (!c) break;
      const s = c.list[c.i];
      if (!s || s.card || s.next || !s.done || !s.done()) break;
      tutSet(c, c.i + 1);
    }
    Guild.guideCheck();
  }
  const hlOf = (s) => (s && !s.card && s.hl ? (typeof s.hl === 'function' ? s.hl() : s.hl) : null);
  const hlMissing = (s) => { const hl = hlOf(s); return !!hl && !hl.some((q) => document.querySelector(q)); };
  // 안내하는 하위 메뉴(장터·길드 안쪽 탭)가 화면에 없으면, 그 메뉴가 있는 곳으로 알아서 데려간다 (튜토리얼 중간에 나갔다 온 뒤 막히지 않게)
  function tutEnsure() {
    const s = tutStep(); if (!s || !hlMissing(s)) return;
    const want = { '낡은 단검을 만들어요': 'workshop', '진열해요': 'shop' }[s.t]; // 이 단계의 버튼이 있는 화면
    if (want && U.screen !== want && Guild.unlockedCat(NAV[want][0])) { U.screen = want; U.modal = null; render(); return; }
    for (const q of hlOf(s)) {
      const m = /\.tb-sub \.pill\[data-screen="(\w+)"\]/.exec(q); if (!m || !NAV[m[1]]) continue;
      const cat = CATS.find((c) => c.id === NAV[m[1]][0]); if (!cat || !Guild.unlockedCat(cat.id)) continue;
      U.screen = cat.subs.find(([id]) => id === m[1]) ? cat.subs[0][0] : m[1]; U.modal = null; render(); return;
    }
  }
  setInterval(() => { if (!document.hidden && tutOn()) tutEnsure(); }, 700);
  function tutAllowed(el) {
    const s = tutStep();
    if (!s) return true;
    const a = el.dataset.act;
    if (['coach-next', 'scrim', 'dev-tutorial', 'save', 'rec-next'].includes(a)) return true;
    if (s.allow === null) return true;
    if (a === 'modal') return true;
    if (a === 'close-modal' || a === 'confirm-yes') return !s.card && !s.noClose;
    const al = s.allow || { goto: [], acts: [] };
    if (a === 'goto') return (al.goto || []).includes(el.dataset.screen) || hlMissing(s); // 안내하는 버튼이 지금 화면에 없으면(나갔다 돌아온 경우 등) 이동은 막지 않는다
    return (al.acts || []).includes(a);
  }
  // 줄 단위로 나눠 보여 주고, ▸ 줄은 내어쓰기로 정렬한다
  const mtext = (x) => x;
  const fmtX = (x) => mtext(I18n.tr(x)).split('<br>').map((l) => (l ? `<div class="ln${l.startsWith('▸') ? ' b' : ''}">${l}</div>` : '<div class="gap"></div>')).join('');
  // 튜토리얼: 대상만 밝게 두고 나머지는 어둡게 (SVG 마스크 구멍). 클릭은 그대로 통과한다.
  let dimSig = '';
  // 대상 요소와 그 안에서 삐져나온 자식(이름표 등)까지 합친 영역
  function unionRect(el) {
    const r = el.getBoundingClientRect();
    if (el.matches('.reveal')) { // 스킵할 때 쾅/흔들림(transform)으로 영역이 커 보이지 않도록 변형을 무시한 배치 좌표로 계산
      const stg = $('stage'), sr = stg.getBoundingClientRect(), sc = sr.width / stg.offsetWidth;
      let x = 0, y = 0, o = el;
      while (o && o !== stg) { x += o.offsetLeft; y += o.offsetTop; o = o.offsetParent; }
      if (o === stg) return { left: sr.left + x * sc, top: sr.top + y * sc, width: el.offsetWidth * sc, height: el.offsetHeight * sc };
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    let l = r.left, t = r.top, rt = r.right, bt = r.bottom;
    el.querySelectorAll('*').forEach((c) => { if (c.matches('.rv-reel, .rv-reel *, .rv-rays, .rv-ring, .rv-flash, .confetti, .confetti *, .fx-burst, .fx-burst *')) return; const q = c.getBoundingClientRect(); if (q.width < 1 || q.height < 1) return; l = Math.min(l, q.left); t = Math.min(t, q.top); rt = Math.max(rt, q.right); bt = Math.max(bt, q.bottom); });
    return { left: l, top: t, width: rt - l, height: bt - t };
  }
  function drawDim() {
    const s = tutStep();
    let d = document.getElementById('tutdim');
    const hl = s && !s.card && s.hl ? (typeof s.hl === 'function' ? s.hl() : s.hl) : null;
    if (!hl) { if (d) d.remove(); dimSig = ''; return; }
    const SW = 1760, SH = 990;
    const st = $('stage').getBoundingClientRect(), k = st.width / SW;
    const rs = [];
    hl.forEach((q) => document.querySelectorAll(q).forEach((el) => {
      const r = unionRect(el);
      if (r.width < 2 || r.height < 2) return;
      rs.push({ x: (r.left - st.left) / k - 6, y: (r.top - st.top) / k - 6, w: r.width / k + 12, h: r.height / k + 12 });
    }));
    // 서로 겹치거나 맞닿은 강조 영역은 하나의 큰 외곽선으로 합친다 (테두리가 겹쳐 지저분해지는 것을 막는다)
    for (let again = true; again;) {
      again = false;
      for (let i = 0; i < rs.length && !again; i++) for (let j = i + 1; j < rs.length && !again; j++) {
        const a = rs[i], b = rs[j], gap = 20;
        if (a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap) {
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), x2 = Math.max(a.x + a.w, b.x + b.w), y2 = Math.max(a.y + a.h, b.y + b.h);
          rs[i] = { x, y, w: x2 - x, h: y2 - y }; rs.splice(j, 1); again = true;
        }
      }
    }
    const sig = rs.map((r) => [r.x, r.y, r.w, r.h].map(Math.round).join(',')).join('|');
    if (d && sig === dimSig) return;
    dimSig = sig;
    if (d && d.querySelectorAll('.td-ring').length === rs.length) { // 같은 개수면 위치만 갱신 (깜빡임 방지)
      const holes = d.querySelectorAll('#tdm rect:not(:first-child)'), rings = d.querySelectorAll('.td-ring');
      rs.forEach((r, i) => [holes[i], rings[i]].forEach((e) => { e.setAttribute('x', r.x); e.setAttribute('y', r.y); e.setAttribute('width', r.w); e.setAttribute('height', r.h); }));
      return;
    }
    const holes = rs.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="#000"/>`).join('');
    const rings = rs.map((r) => `<rect class="td-ring" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10"/>`).join('');
    const html = `<svg viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none"><defs><mask id="tdm"><rect width="${SW}" height="${SH}" fill="#fff"/>${holes}</mask></defs><rect width="${SW}" height="${SH}" fill="rgba(3,5,12,.74)" mask="url(#tdm)"/>${rings}</svg>`;
    if (!d) { d = document.createElement('div'); d.id = 'tutdim'; $('stage').insertBefore(d, $('coach')); }
    d.innerHTML = html;
  }
  function tutHighlight() { drawDim(); }
  setInterval(() => { if (!document.hidden && tutOn()) drawDim(); }, 300);
  window.addEventListener('resize', () => { dimSig = ''; drawDim(); });
  // 클릭으로 넘기는 단계(카드·다음 단계)에는 버튼이 없다. 2초 뒤 아래쪽에 "화면을 클릭해 주세요"가 나타나고, 화면 어디를 눌러도 다음으로 넘어간다.
  window.UIDebug = { tutStep }; // 점검용
  const tutClickStep = () => { const s = tutStep(); return !!(s && (s.card || s.next)); };
  function coachHtml() {
    const s = tutStep();
    if (!s) return '';
    const tc = tutCtx(), n = tutKey(tc), total = tc.list.length, num = tc.i + 1, lab = tc.kind === 'main' ? '튜토리얼' : '새 기능 안내', fresh = U.tutShown !== n;
    if (U.tutKey !== n) { U.tutKey = n; U.tutAt = Date.now(); }
    const cls = fresh ? ' coach-in' : '';
    const hint = s.card || s.next ? `<div class="coach-click${Date.now() - U.tutAt >= 2000 ? ' on' : ''}">화면을 클릭해 주세요 <i>▼</i></div>` : '';
    if (s.card) return `<div class="coach-scrim"><div class="coach-card${cls}"><div class="cstep">${lab} ${num} / ${total}</div><h2>${I18n.tr(s.t)}</h2><div class="coach-x">${fmtX(s.x)}</div></div></div>${hint}`;
    return `<div class="coach-bar${cls}"${s.at ? ` style="top:${s.at}px"` : ''}><div class="cb-top"><span class="cstep">${lab} ${num} / ${total}</span><b>${I18n.tr(s.t)}</b></div><div class="coach-x">${fmtX(s.x)}</div></div>${hint}`;
  }
  setInterval(() => { const h = document.querySelector('#coach .coach-click'); if (h && !h.classList.contains('on') && Date.now() - U.tutAt >= 2000) h.classList.add('on'); }, 250);
  // 설명 글자가 한 글자씩 튀어나오는 연출. 단계가 바뀔 때만 재생한다.
  let typeDone = null;
  function finishType() { if (typeDone) typeDone(); }
  // 글자가 채워지는 연출. 아직 안 나온 글자는 보이지 않을 뿐 자리는 차지해서 상자 크기가 변하지 않는다.
  function typeFill(root, perTick, ms, onEnd) {
    const nodes = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) nodes.push(w.currentNode);
    const parts = nodes.map((n) => {
      const t = window.I18n && !(n.parentNode && n.parentNode.closest && n.parentNode.closest('[data-i18n="off"]')) ? I18n.tr(n.nodeValue) : n.nodeValue, a = document.createElement('span'), b = document.createElement('span');
      b.style.visibility = 'hidden'; b.textContent = t; n.parentNode.replaceChild(a, n); a.after(b);
      return { a, b, t };
    });
    const total = parts.reduce((x, o) => x + o.t.length, 0);
    let shown = 0, timer = null, ended = false;
    const paint = () => { let left = shown; parts.forEach((o) => { const take = Math.max(0, Math.min(o.t.length, left)); o.a.textContent = o.t.slice(0, take); o.b.textContent = o.t.slice(take); left -= take; }); };
    const finish = () => { if (ended) return; ended = true; clearInterval(timer); shown = total; paint(); root.classList.remove('typing'); if (onEnd) onEnd(); };
    paint(); root.classList.add('typing');
    timer = setInterval(() => { shown += perTick; paint(); if (shown >= total) finish(); }, ms);
    return finish;
  }
  function tutType() {
    const n = tutKey(tutCtx());
    if (!n || U.tutShown === n) return;
    U.tutShown = n;
    typeDone = null;
    const host = document.querySelector('#coach .coach-x');
    if (!host) return;
    const btn = document.querySelector('#coach .coach-btn'); if (btn) btn.classList.add('wait');
    typeDone = typeFill(host, 2, 22, () => { typeDone = null; if (btn) btn.classList.remove('wait'); });
  }
  // 영입 면접: 새 대사와 메모 줄이 한 글자씩 채워진다
  let recDone = null;
  function recType() {
    const key = U.applicant + ':' + (U.recLine || 0);
    if (!U.applicant || U.recTyped === key) return;
    U.recTyped = key;
    const tx = document.querySelector('.rcp-dlg .tx'), cur = document.querySelector('.rcp-memo p.cur');
    if (!tx) return;
    const f1 = typeFill(tx, 1, 28), f2 = cur ? typeFill(cur, 1, 28) : null;
    recDone = () => { f1(); if (f2) f2(); recDone = null; };
    const t = setInterval(() => { if (!tx.classList.contains('typing')) { clearInterval(t); recDone = null; } }, 60);
  }


/* ---------- 클릭 처리 (data-act) — 이 화면의 동작을 ACT 표에 등록한다. false를 돌려주면 다시 그리지 않는다 ---------- */
Object.assign(ACT, {
  'coach-next'(el, id) {
    { if (typeDone) { finishType(); return; } const tcx = tutCtx(), s = tutStep(); if (tcx && s && (s.card || s.next)) { if (s.onNext) s.onNext(); tutSet(tcx, tcx.i + 1); } return; }
  },
  'dev-tutorial'(el, id) {
    Guild.setTutorial(0); U.modal = null; U.screen = 'hub'; return;
  },
});
