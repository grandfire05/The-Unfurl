/* ui/hub.js — 홈(길드 홀)
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

  /* ============================================================
     1) 홈 (길드 홀)
     ============================================================ */
  function hubHtml() {
    const act = actives().map((c) => ({ c, s: statusOf(c) })).sort((a, b) => order[a.s.state] - order[b.s.state]);
    const n = act.length;
    const lob = Guild.lobby();
    const actors = lob.slice().sort((p, q) => p.y - q.y).map((p) => {
      const c = byId(p.id), sc = (0.82 + 0.2 * (p.y - 66) / 28).toFixed(2);
      return `<button class="actor" style="left:${p.x}%;top:${p.y}%;z-index:${Math.round(p.y / 5)};transform:translate(-50%,-100%) scale(${sc});transform-origin:50% 100%" data-act="open-talk" data-id="${c.id}" aria-label="${c.name}에게 말 걸기">
        <span class="sbub">${icon('chat')}</span><span class="bobw">${Art.character(c.appearance, { label: c.name })}</span><span class="nameplate">${c.name} Lv.${c.level}</span></button>`;
    }).join('');

    const names = (m) => m.memberIds.map((id) => (byId(id) || {}).name).join(', ');
    const rows = Guild.missions.map((m) => ({ m, s: Guild.missionInfo(m) }))
      .sort((x, y) => (x.s.state === 'alert' ? 0 : 1) - (y.s.state === 'alert' ? 0 : 1)).map(({ m, s: i }) => {
        if (i.state === 'alert') {
          return `<button class="qrow alert" data-act="view-battle" data-id="${m.id}">${icon('alert')}<span><b>위기 신호!</b> 「${i.quest.name}」<br>${names(m)} · 결정 제한 <span class="eta" data-eta="${i.deadline}">${clock(i.deadline - Guild.now())}</span></span></button>`;
        }
        if (m.wait) return `<div class="qrow">${icon('book')}<span><b>「${i.quest.name}」</b> · ${names(m)}<br>${Combat.TYPE_TEXT[i.quest.type]} 중 · 남은 시간 <span class="eta" data-eta="${i.endsAt}">${clock(i.endsAt - Guild.now())}</span></span></div>`;
        return `<button class="qrow" data-act="view-battle" data-id="${m.id}">${icon('sword')}<span><b>「${i.quest.name}」</b> · ${names(m)}<br>전투 중 <b data-bclock="${m.id}">${mmss(i.clock)}</b></span></button>`;
      });
    act.filter((x) => x.s.state === 'training').forEach(({ c, s: i }) => {
      rows.push(`<button class="qrow" data-act="open-char" data-id="${c.id}">${icon(i.state === 'training' ? 'book' : 'bandage')}<span><b>${c.name}</b> ${i.state === 'training' ? '훈련 중' : '부상 회복 중'}<br>남은 시간 <span class="eta" data-eta="${i.until}">${clock(i.until - Guild.now())}</span></span></button>`);
    });
    if (promoReady()) rows.unshift(`<button class="qrow" data-act="goto" data-screen="guild">${icon('star')}<span><b>길드 승급 가능!</b><br>위쪽 <b>길드</b>(6)에서 승급해요</span></button>`);
    if (mailCount()) rows.unshift(`<button class="qrow" data-act="goto" data-screen="results">${icon('mail')}<span><b>새 의뢰 결과 ${mailCount()}건</b><br>눌러서 확인해요</span></button>`);
    act.filter((x) => Character.needsAdvance(x.c)).forEach(({ c }) => {
      rows.push(`<button class="qrow" data-act="open-char" data-id="${c.id}">${icon('star')}<span><b>${c.name}</b> 전직할 수 있어요<br>명부에서 직업을 골라 주세요</span></button>`);
    });
    if (rows.length > 5) { const extra = rows.length - 5; rows.length = 5; rows.push(`<div class="qnone">…외 ${extra}건</div>`); }

    return `<div class="hub">${Art.hall()}
      <div class="hub-title"><h1>${icon('pin')}길드 홀</h1><small>${esc(Guild.state.guildName)} · ${Guild.guildGrade()}급 · 명성 ${Guild.state.fame}${Guild.promoNeed() ? ' / ' + Guild.promoNeed().fame : ''}</small></div>
      <div class="hubq"><h2>길드 소식</h2>${rows.length ? rows.join('') : '<div class="qnone">진행 중인 일이 없어요.<br>위쪽 <b>원정</b> 탭에서 파티를 꾸려 보내 보세요.</div>'}</div>
      <div class="actors">${actors}</div>
      ${n === 0 ? '<div class="hub-hint">아직 길드에 모험가가 없어요.<br>위쪽 <b>주점</b>(숫자 키 4)에서 첫 모험가를 맞이해 보세요.</div>' : ''}
      ${n > 0 && !lob.length ? '<div class="hub-hint" style="top:40%">지금은 모두 의뢰나 훈련 중이라 로비가 비어 있어요.</div>' : ''}
      <div class="lobby-note">로비 ${lob.length}명 · 12시간마다(00:00 · 12:00 PST) 의뢰 중이 아닌 모험가 10명이 나와요 · 다음 교체 <span class="eta" data-eta="${Guild.lobbyNextAt()}">${clock(Guild.lobbyNextAt() - Guild.now())}</span></div>
    </div>`;
  }
