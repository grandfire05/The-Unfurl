/* ui/lists.js — 진행 중/결과 목록 + 상점·공방·보급고·훈련장
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

  /* ============================================================
     공통: 넓은 목록 화면 (진행 중 / 결과 / 훈련장)
     ============================================================ */
  function wideScreen(title, leftInner, inner, keep) {
    return `<div class="pscreen">${Art.hall()}<div class="cols"><div class="col"><section class="parch fit"><h3>${title}</h3><hr class="rule">${leftInner}</section></div>
      <section class="cpanel wide">${chead(title)}<div class="wlist" data-keep="${keep}">${inner}</div></section></div></div>`;
  }
  const faces = (ids) => ids.map(byId).filter(Boolean).map((c) => `<span class="av">${Art.character(c.appearance, { view: 'bust', label: c.name })}</span>`).join('');

  function activeHtml() {
    const ms = Guild.missions.map((m) => ({ m, i: Guild.missionInfo(m) })).sort((x, y) => (x.i.state === 'alert' ? 0 : 1) - (y.i.state === 'alert' ? 0 : 1));
    const cards = ms.map(({ m, i }) => {
      const k = i.quest, al = i.state === 'alert';
      const nm = m.memberIds.map((id) => (byId(id) || {}).name).join(', ');
      if (m.wait) return `<div class="mrow"><span class="faces">${faces(m.memberIds)}</span><span class="grow"><b><span class="chip qg">${k.grade}</span> ${esc(k.name)}</b><br><span class="sub">${esc(nm)}</span><br><span class="sub">${Combat.TYPE_TEXT[k.type]} 중 · 남은 시간 <span class="eta" data-eta="${i.endsAt}">${clock(i.endsAt - Guild.now())}</span> · 실시간 확인 없음</span></span></div>`;
      return `<button class="mrow${al ? ' alert' : ''}" data-act="view-battle" data-id="${m.id}"><span class="faces">${faces(m.memberIds)}</span>
        <span class="grow"><b><span class="chip qg">${k.grade}</span> ${esc(k.name)}</b><br><span class="sub">${esc(nm)}</span><br>
        ${al ? `<span class="sub" style="color:var(--red)">위기 신호! 결정 제한 <span class="eta" data-eta="${i.deadline}">${clock(i.deadline - Guild.now())}</span></span>`
             : `<span class="sub">전투 중 <b data-bclock="${m.id}">${mmss(i.clock)}</b> · 몬스터 <b data-balive="${m.id}">${Guild.battleView(m).alive}</b>마리 남음</span><span class="mbar"><i data-bhp="${m.id}"></i></span>`}</span>
        <span class="go">${al ? '결정하기' : '보기'}</span></button>`;
    });
    const others = actives().map((c) => ({ c, s: statusOf(c) })).filter((x) => x.s.state === 'training').map(({ c, s }) =>
      `<button class="mrow" data-act="open-char" data-id="${c.id}"><span class="faces">${faces([c.id])}</span><span class="grow"><b>${esc(c.name)}</b> ${'훈련 중'}<br><span class="sub">남은 시간 <span class="eta" data-eta="${s.until}">${clock(s.until - Guild.now())}</span></span></span><span class="go">보기</span></button>`);
    const adv = actives().filter((c) => Character.needsAdvance(c)).map((c) =>
      `<button class="mrow" data-act="open-char" data-id="${c.id}"><span class="faces">${faces([c.id])}</span><span class="grow"><b>${esc(c.name)}</b> 전직할 수 있어요<br><span class="sub">Lv.${c.level} · 직업을 골라 주세요</span></span><span class="go">전직</span></button>`);
    const all = cards.concat(others, adv);
    const alerts = alertCount();
    const left = `<div class="scroll lines"><p>의뢰 ${ms.length}건 진행 중</p><p class="small">${alerts ? `<b style="color:#a33a35">위기 신호 ${alerts}건 — 결정이 필요해요.</b><br>` : ''}훈련 ${others.length}명<br>카드를 누르면 전투 화면으로 가요.</p></div>`;
    return wideScreen('원정 현황', left, all.join('') || '<p class="empty" style="padding:30px">진행 중인 일이 없어요.<br>의뢰 › 게시판에서 파티를 꾸려 보내 보세요.</p>', 'active-list');
  }

  function resultsHtml() {
    const rep = Guild.lastReport;
    const absent = rep && rep.left.length
      ? `<div class="rep">${icon('people')}<div style="flex:1"><b>${rep.absentDays}일 만에 돌아오셨네요. ${Guild.ABSENCE_DAYS}일 이상 접속하지 않아 모험가 ${rep.left.length}명이 길드를 떠났어요: ${rep.left.map((c) => c.name).join(', ')}.</b><br><span class="muted" style="font-size:12px">모험가 명부의 이탈 탭에서 금화로 다시 데려올 수 있어요.</span></div>
        <button class="btn ghost sm" data-act="dismiss-report">확인</button></div>` : '';
    const reports = Guild.state.inbox.slice().reverse().map(reportHtml).join('');
    const n = mailCount();
    const left = `<div class="scroll lines"><p>확인하지 않은 결과 ${n}건</p><p class="small">의뢰와 훈련이 끝나면 결과가 이곳에 쌓여요.<br>확인하면 목록에서 사라져요.</p>${n > 1 ? '<p style="margin-top:8px"><button class="btn sm" data-act="dismiss" data-id="">모두 확인</button></p>' : ''}</div>`;
    return wideScreen('귀환 보고', left, absent + (reports ? `<div class="rc-grid">${reports}</div>` : '<div class="rc-none"><span>' + icon('scroll') + '</span>새 결과가 없어요.<small>의뢰나 훈련이 끝나면 보고서가 도착해요.</small></div>'), 'results-list');
  }


  /* ============================================================
     상점 / 대장간 / 보급고
     ============================================================ */
  const statText = (it) => Gear.bonusPts(it).map((v, i) => (v > 0.4 ? `${Gear.STAT_LABEL[i]} +${Math.round(v)}` : '')).filter(Boolean).join(' · ');
  const gIcon = (it, cls) => Art.gearIcon(it.slot, it.g, it.t === undefined ? 0 : it.t, Gear.typeOf(it).n, cls);
  const mIcon = (n, cls) => Art.matIcon(n, Gear.MAT_INFO[n] ? Gear.MAT_INFO[n].grade : 0, cls);
  const itemBlock = (it) => `<span class="ibox">${gIcon(it, 'lg')}<span class="ib-t"><b class="q q${it.q}">${esc(Gear.itemName(it))}</b> <span class="chip qg">${Gear.GRADES[it.g]}</span> <span class="chip qp q${it.q}">품질 ${Gear.qpOf(it)}% · ×${Gear.qMult(Gear.qpOf(it)).toFixed(2)}</span>${Gear.typeOf(it).drop ? ' <span class="chip skill">의뢰 전용</span>' : ''}<br><span class="sub">${Gear.SLOT_NAME[it.slot]} · Lv.${Gear.LV_REQ[it.g]} 이상 · ${statText(it)}</span>${it.opts.length ? `<br><span class="sub">옵션: ${it.opts.map(esc).join(', ')}</span>` : ''}</span></span>`;

  function shopHtml() {
    const st = Guild.state, slots = Guild.shopSlots();
    const disp = st.display.map((d) => `<div class="mrow flat"><span class="grow">${itemBlock(d.item)}</span>
      <span class="tbtns"><button class="btn ghost sm" data-act="price" data-id="${d.item.id}" data-d="-0.1">−10%</button><span class="pbox"><b class="${Guild.inFairBand(d) ? 'fair' : 'offfair'}">${d.price.toLocaleString()}금</b><small>적정 ${Guild.fairRange(d.item)[0].toLocaleString()}~${Guild.fairRange(d.item)[1].toLocaleString()} · ${Guild.inFairBand(d) ? '손님 옴' : d.price > Gear.price(d.item) ? '비싸서 안 옴' : '너무 싸서 의심받음'}</small></span><button class="btn ghost sm" data-act="price" data-id="${d.item.id}" data-d="0.1">+10%</button><button class="btn sm" data-act="undisplay" data-id="${d.item.id}">내리기</button></span></div>`).join('')
      || '<p class="empty">진열된 장비가 없어요. 대장간에서 만든 장비를 진열해 보세요.</p>';
    const stock = st.stock.map((it) => `<div class="mrow flat"><span class="grow">${itemBlock(it)}</span><span class="tbtns"><button class="btn ghost sm" data-act="dump" data-id="${it.id}" title="적정가의 반값에 바로 넘겨요">떨이 ${Guild.dumpPrice(it).toLocaleString()}금</button><button class="btn sm" data-act="display" data-id="${it.id}"${st.display.length >= slots ? ' disabled' : ''}>진열</button></span></div>`).join('')
      || '<p class="empty">보급고에 완성된 장비가 없어요.</p>';
    const th = U.dumpTh || 35;
    const dumpBar = st.stock.length ? `<div class="pills wsbar"><span class="muted small">안 팔리는 장비는 적정가의 반값에 떨이로 넘길 수 있어요.</span><select data-act="dump-th" aria-label="떨이 기준">${[20, 35, 50].map((v) => `<option value="${v}"${th === v ? ' selected' : ''}>품질 ${v}% 미만</option>`).join('')}</select><button class="btn ghost sm" data-act="dump-all">한꺼번에 떨이</button></div>` : '';
    const log = st.shopLog.slice().reverse().slice(0, 6).map((l) => `<p class="small muted" style="margin:0">${esc(l.text)}</p>`).join('') || '<p class="small muted">아직 팔린 장비가 없어요.</p>';
    const left = `<div class="scroll lines"><p>진열 ${st.display.length} / ${slots}칸</p><p class="small">모험가는 ① 적정 가격 ±20% 안이고 ② 지갑에 가격 이상의 돈이 있고 ③ 같은 칸의 지금 장비보다 좋고 ④ 착용 가능한 레벨일 때만 찾아와요. 비싸도, 너무 싸도 오지 않아요.<br>걸작이 팔리면 명성이 조금 올라요. 좋은 장비를 진열하면 지원자가 더 자주 찾아와요.</p></div>`;
    return wideScreen('가판대', left, `<h3 class="wh">가판대</h3>${disp}<h3 class="wh">보급고의 장비 (${st.stock.length})</h3>${dumpBar}${stock}<h3 class="wh">최근 거래</h3>${log}`, 'shop-list');
  }

  function workshopHtml() {
    const st = Guild.state, gi = Guild.gradeIdx(), free = Guild.craftSlots() - st.crafts.length, wl = Guild.facLevel('workshop');
    if (U.wsGrade === undefined || U.wsGrade > gi) U.wsGrade = gi;
    if (!U.wsSlot) U.wsSlot = 'weapon';
    const crafting = st.crafts.map((c) => `<div class="mrow flat">${gIcon(c.item, 'lg')}<span class="grow"><b>${esc(Gear.baseName(c.item))}</b> 제작 중<br><span class="sub">완성까지 <span class="eta" data-eta="${c.doneAt}">${clock(c.doneAt - Guild.now())}</span></span><span class="mbar"><i data-prog-start="${c.startedAt}" data-prog-end="${c.doneAt}"></i></span></span></div>`).join('');
    const rs = Gear.recipes().filter((r) => r.g === U.wsGrade && r.slot === U.wsSlot && Guild.recipeOpen(r)); // 아직 못 배운 제작법은 보이지 않는다
    const rows = rs.map((r) => {
      const open = Guild.recipeOpen(r), fee = Guild.recipeFee(r);
      const mats = r.mats.map((x) => { const h = Guild.matHave(x.name); return `<span class="mat${h >= x.qty ? ' ok' : ''}">${mIcon(x.name, 'xs')}${esc(x.name)} ${h}/${x.qty}</span>`; }).join('');
      const can = open && free > 0 && r.mats.every((x) => Guild.matHave(x.name) >= x.qty) && st.gold >= fee;
      const base = statText({ slot: r.slot, g: r.g, q: 1, qp: 50, t: r.t, plus: 0, opts: [] });
      return `<div class="mrow flat${open ? '' : ' locked'}">${Art.gearIcon(r.slot, r.g, r.t, Gear.TYPES[r.slot][r.t].n, 'lg')}<span class="grow"><b>${esc(r.name)}</b> <span class="chip">주 스탯 ${Gear.focus(r.slot, r.t)}</span><br><span class="sub mats">${mats}</span><span class="sub">품질 50% 기준 ${base} · 금화 ${fee} · ${minText(Guild.craftMinutes(r.g, r.t))}${open ? '' : ` · 대장간 Lv.${r.unlock}에 배워요`}</span></span><button class="btn sm" data-act="craft" data-id="${r.id}"${can ? '' : ' disabled'}>${open ? '제작' : '잠김'}</button></div>`;
    }).join('');
    const gsel = Gear.GRADES.slice(0, gi + 1).map((l, g) => `<option value="${g}"${U.wsGrade === g ? ' selected' : ''}>${l}등급</option>`).join('');
    const sp = Gear.SLOTS.map(([k, l]) => `<button class="pill" aria-selected="${U.wsSlot === k}" data-act="ws-slot" data-k="${k}">${l}</button>`).join('');
    const known = Gear.recipes().filter((r) => r.g <= gi && Guild.recipeOpen(r)).length;
    const left = `<div class="scroll lines"><p>동시 제작 ${st.crafts.length} / ${Guild.craftSlots()}</p><p>배운 제작법 ${known}개</p><p class="small">제작법마다 필요한 재료와 개수가 정해져 있어요. 품질은 만들어 봐야 알아요.<br>재료는 의뢰를 보낼 때 “재료 받기”를 고르면 보급고로 들어와요. 채집 의뢰와 몬스터 토벌에서 얻어요.<br>대장간을 확장하면 새 제작법을 배워요. (Lv.${Gear.UNLOCK_LV.filter((x) => x > 0).join(' · ')})<br>현재 대장간 Lv.${wl}</p></div>`;
    return wideScreen('대장간', left, (crafting ? `<h3 class="wh">제작 중</h3>${crafting}` : '') + `<div class="pills wsbar"><select data-act="ws-grade" aria-label="등급">${gsel}</select>${sp}</div><h3 class="wh">제작법</h3>${rows}`, 'workshop-list');
  }

  function warehouseHtml() {
    const st = Guild.state;
    const q = (U.wareQ || '').trim(), wg = U.wareGrade === undefined || U.wareGrade === '' ? '' : Number(U.wareGrade);
    const all = Object.keys(st.materials).filter((n) => st.materials[n] > 0);
    const have = all.filter((n) => (wg === '' || Gear.MAT_INFO[n].grade === wg) && (!q || n.includes(q))).sort((a, b) => Gear.MAT_INFO[a].grade - Gear.MAT_INFO[b].grade || a.localeCompare(b, 'ko'));
    const filt = `<div class="pills wsbar"><input type="search" class="wsearch" data-act="ware-q" placeholder="재료 이름 검색" value="${esc(U.wareQ || '')}" aria-label="재료 검색"><select data-act="ware-grade" aria-label="등급 거르기"><option value="">전체 등급</option>${Gear.GRADES.map((l, g) => `<option value="${g}"${wg === g ? ' selected' : ''}>${l}등급 (${all.filter((n) => Gear.MAT_INFO[n].grade === g).length})</option>`).join('')}</select><span class="muted small">${have.length} / ${all.length}종</span></div>`;
    const mats = have.map((n) => `<div class="mrow flat">${mIcon(n)}<span class="grow"><b>${esc(n)}</b> <span class="chip qg">${Gear.GRADES[Gear.MAT_INFO[n].grade]}</span></span><b>×${st.materials[n]}</b></div>`).join('') || `<p class="empty">${all.length ? '조건에 맞는 재료가 없어요.' : '보급고가 비어 있어요.'}</p>`;
    const pend = st.payQueue.reduce((a, p) => a + p.amt, 0);
    const left = `<div class="scroll lines"><p>보급고의 재료 ${all.length}종</p><p class="small">의뢰를 보낼 때 <b>재료 받기</b>를 고르면 가져온 재료가 바로 이곳에 들어와요.<br><b>안 받기</b>를 고르면 모험가가 재료를 팔고, 대금은 24시간 뒤 지갑에 들어와요. (지금 대기 중인 대금 ${pend.toLocaleString()}금)<br>재료는 대장간에서 장비가 돼요.</p></div>`;
    return wideScreen('보급고', left, `<h3 class="wh">보급고의 재료</h3>${filt}${mats}`, 'ware-list');
  }

  function dojoHtml() {
    const slots = Guild.trainSlots(), used = Guild.trainees().length;
    const train = Guild.trainees().map((c) => `<div class="mrow"><span class="faces">${faces([c.id])}</span><span class="grow"><b>${esc(c.name)}</b> Lv.${c.level} · 훈련 중<br><span class="sub">남은 시간 <span class="eta" data-eta="${c.training.until}">${clock(c.training.until - Guild.now())}</span></span><span class="mbar"><i data-prog-start="${c.training.startedAt}" data-prog-end="${c.training.until}"></i></span></span><button class="btn ghost sm" data-act="cancel-train" data-id="${c.id}">훈련 취소</button></div>`);
    const idle = idleHeroes().map((c) => {
      const need = Character.needsAdvance(c), max = c.level >= Character.MAX_LEVEL;
      const btns = need ? `<button class="btn sm" data-act="open-advance" data-id="${c.id}">전직하기</button>` : max ? '<span class="muted">최고 레벨</span>' : Guild.TRAIN_OPTIONS.map((min) => {
        const pv = Guild.trainPreview(c, min);
        return `<button class="btn ghost sm" data-act="train-go" data-id="${c.id}" data-min="${min}"${used >= slots || Guild.state.gold < pv.cost ? ' disabled' : ''}>${minText(min)}<br><small>금화 ${pv.cost} · 경험치 +${pv.exp}</small></button>`;
      }).join('');
      return `<div class="mrow flat"><span class="faces">${faces([c.id])}</span><span class="grow"><b>${esc(c.name)}</b> Lv.${c.level} · ${esc(clsOf(c))}<br><span class="sub">경험치 ${expText(c)}</span></span><span class="tbtns">${btns}</span></div>`;
    });
    const left = `<div class="scroll lines"><p>수련장 ${used} / ${slots}명 사용 중</p><p class="small">훈련은 목숨의 위험이 없어요.<br>시간이 지나면 경험치를 얻어요.<br>훈련장을 확장하면 동시에 더 많이, 더 효율적으로 훈련할 수 있어요.</p></div>`;
    return wideScreen('수련장', left, (train.length ? '<h3 class="wh">훈련 중</h3>' + train.join('') : '') + '<h3 class="wh">수련 보내기</h3>' + (idle.join('') || '<p class="empty">훈련을 보낼 수 있는 모험가가 없어요.</p>'), 'dojo-list');
  }


/* ---------- 클릭 처리 (data-act) — 이 화면의 동작을 ACT 표에 등록한다. false를 돌려주면 다시 그리지 않는다 ---------- */
Object.assign(ACT, {
  'price'(el, id) {
    { const d = Guild.state.display.find((x) => x.item.id === id); if (d) Guild.setPrice(id, d.price * (1 + Number(el.dataset.d))); return; }
  },
  'display'(el, id) {
    { const r = Guild.displayItem(id); if (!r.ok) toast(r.reason); return; }
  },
  'undisplay'(el, id) {
    Guild.undisplayItem(id); return;
  },
  'dump'(el, id) {
    { const r = Guild.dumpItem(id); toast(r.ok ? `떨이로 넘겼어요. +${r.gold.toLocaleString()}금` : r.reason); return; }
  },
  'dump-all'(el, id) {
    {
          const th = U.dumpTh || 35, n = Guild.state.stock.filter((it) => Gear.qpOf(it) < th).length;
          if (!n) { toast('조건에 맞는 장비가 없어요.'); return; }
          U.modal = { type: 'confirm', title: '떨이 처분', text: `품질 ${th}% 미만 장비 ${n}점을 적정가의 반값에 모두 넘길까요? 되돌릴 수 없어요.`, yes: '넘기기', onYes: () => { const r = Guild.dumpBelow(th); toast(r.ok ? `${r.n}점을 넘겼어요. +${r.gold.toLocaleString()}금` : r.reason); } };
          return;
        }
  },
  'ws-slot'(el, id) {
    U.wsSlot = el.dataset.k; return;
  },
  'craft'(el, id) {
    { const r = Guild.startCraft(el.dataset.id); toast(r.ok ? '제작을 시작했어요.' : r.reason); return; }
  },
});
