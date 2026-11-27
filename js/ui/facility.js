/* ui/facility.js — 길드 시설 + 영입 면접
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

  /* ============================================================
     6) 길드 시설
     ============================================================ */
  const FAC_ICON = { dorm: 'people', board: 'scroll', dojo: 'sword', ward: 'bandage', archive: 'book', workshop: 'gear', shop: 'coin' };
  const promoReady = () => { const n = Guild.promoNeed(); return !!n && Guild.state.fame >= n.fame && Guild.state.gold >= n.gold; };
  function guildHtml() {
    const st = Guild.state;
    const cards = Guild.FACILITIES.map((f) => {
      const lv = Guild.facLevel(f.id), cap = Guild.facCap(f), cost = Guild.facCost(f.id);
      const maxed = !f.locked && lv >= f.max, capped = !f.locked && !maxed && lv >= cap;
      const pips = Array.from({ length: f.locked ? 3 : f.max }, (_, i) => `<i class="${i < lv ? 'on' : i >= cap ? 'lock' : ''}"></i>`).join('');
      const btn = f.locked ? '<button class="act primary fbtn" disabled>준비 중</button>'
        : maxed ? '<button class="act primary fbtn" disabled>최고 단계</button>'
        : capped ? `<button class="act primary fbtn" disabled>길드 ${Guild.GRADES[Guild.gradeIdx() + 1] || ''}급 승급이 필요해요</button>`
        : `<button class="act primary fbtn" data-act="upgrade" data-id="${f.id}"${st.gold < cost ? ' disabled' : ''}>확장 · 금화 ${cost.toLocaleString()}</button>`;
      return `<div class="fcard"><div class="fhead"><span class="fic">${icon(FAC_ICON[f.id])}</span><div><b>${f.name}</b> <small class="muted">${f.locked ? '' : `Lv.${lv} / ${cap}`}</small><div class="pips">${pips}</div></div></div>
        <p class="fdesc">${f.desc}</p>
        <div class="fnow">지금: ${f.effect(lv)}</div>${f.locked || maxed || capped ? '' : `<div class="fnext">다음: ${f.effect(lv + 1)}</div>`}${btn}</div>`;
    }).join('');
    const need = Guild.promoNeed();
    const pct = need ? Math.min(100, Math.round((st.fame / need.fame) * 100)) : 100;
    const promo = need
      ? `<p class="small">다음 등급 <b>${need.next}</b>까지<br>명성 ${st.fame.toLocaleString()} / ${need.fame.toLocaleString()}</p><div class="fame"><i style="width:${pct}%"></i></div>
         <p class="small" style="margin:6px 0">승급 비용 금화 ${need.gold.toLocaleString()}</p>
         <button class="btn sm" data-act="promote"${promoReady() ? '' : ' disabled'}>${promoReady() ? `${need.next}급으로 승급` : st.fame < need.fame ? '명성이 더 필요해요' : '금화가 더 필요해요'}</button>`
      : '<p class="small">최고 등급(S)에 올랐어요.</p>';
    const left = `<div class="col"><section class="parch fit"><h3>길드 ${Guild.guildGrade()}급</h3><hr class="rule"><div class="scroll lines">
      ${promo}
      <p class="small" style="margin-top:8px">등급이 오르면 시설을 더 높이 키울 수 있고 더 어려운 의뢰가 들어와요.<br>의뢰를 깨면 명성이 쌓이고, 모험가가 죽거나 파티가 전멸하면 줄어요.</p></div></section></div>`;
    const center = `<section class="cpanel wide">${chead('길드 시설')}<div class="fgrid">${cards}</div></section>`;
    return `<div class="pscreen">${Art.hall()}<div class="cols">${left}${center}</div></div>`;
  }

  /* ============================================================
     7) 영입 면접
     ============================================================ */
  // 접수처: 카운터 뒤에 앉아(1인칭) 찾아온 지원자 한 명을 마주 보고 이야기를 듣는다
  function recruitHtml() {
    const a = Guild.applicants[0] || null;
    U.applicant = a ? a.id : null;
    if (U.recFor !== U.applicant) { U.recFor = U.applicant; U.recLine = 0; }
    const c = a ? a.char : null;
    const block = Guild.recruitBlock();
    const nAct = actives().length, cap = Guild.rosterCap();
    const lines = a ? a.story.concat(a.hint ? [a.hint] : []) : [];
    const animNow = a && U.recAnim !== a.id; if (a) U.recAnim = a.id;
    const li = Math.min(U.recLine || 0, Math.max(0, lines.length - 1)), last = li >= lines.length - 1;
    const isHint = a && a.hint && li === lines.length - 1;
    const dlg = a
      ? `<div class="rcp-dlg" data-act="rec-next" role="button" tabindex="0"><div class="nm">${esc(c.name)}</div><div class="tx${isHint ? ' hint' : ''}">${esc(lines[li] || '')}</div><div class="nx">${last ? '' : '다음 ▶'} <small>${li + 1} / ${lines.length}</small></div></div>`
      : '<div class="rcp-dlg"><div class="tx" style="text-align:center;color:var(--muted)">접수처 앞이 비어 있어요. 다음 지원자를 기다리는 중…</div></div>';
    const memo = a ? `<div class="rcp-memo"><div class="mh">면접 메모 <small>${li + 1} / ${lines.length}</small></div>${lines.map((t, i) => `<p class="${a.hint && i === lines.length - 1 ? 'hint ' : ''}${i > li ? 'fut' : i === li ? 'cur' : ''}">${esc(t)}</p>`).join('')}</div>` : '';
    const desk = `<div class="rcp-desk">
      <div class="rcp-pad"><h3>채용 점검</h3>${chk(`금화 ${Guild.recruitCost()} (보유 ${Guild.state.gold})`, Guild.state.gold >= Guild.recruitCost())}${chk(`기숙사 여유 (${nAct} / ${cap})`, nAct < cap)}
        <p class="small muted" style="margin-top:6px">희귀도·직업·특성·능력치는 채용하면 바로 공개돼요.<br>돌려보낸 지원자는 다시 오지 않아요.</p></div>
      <div class="rcp-btns"><button class="act primary" data-act="hire" data-id="${a ? a.id : ''}"${a && !block ? '' : ' disabled'}>채용 · 금화 ${Guild.recruitCost()} ${icon('check')}</button>
        <button class="act" data-act="app-dismiss" data-id="${a ? a.id : ''}"${a ? '' : ' disabled'}>돌려보내기 ${icon('cross')}</button></div>
      <div class="rcp-pad right"><h3>지원서</h3>${a ? `<div class="kv1"><span class="k">이름</span><span class="v">${esc(c.name)}</span></div><div class="kv1"><span class="k">기본 직업</span><span class="v">${esc(c.path[0])}</span></div><div class="kv1"><span class="k">머무는 시간</span><span class="v"><span data-eta-left="${a.expiresAt}">${leftText(a.expiresAt - Guild.now())}</span></span></div>` : '<p class="small muted">기다리는 지원자가 없어요.</p>'}</div></div>`;
    return `<div class="rcp">${Art.hall()}<div class="rcp-shade"></div>${memo}${a ? `<div class="rcp-app${animNow ? ' enter' : ''}">${Art.character(c.appearance, { label: c.name })}</div>` : ''}${dlg}${desk}</div>`;
  }


/* ---------- 클릭 처리 (data-act) — 이 화면의 동작을 ACT 표에 등록한다. false를 돌려주면 다시 그리지 않는다 ---------- */
Object.assign(ACT, {
  'app-sel'(el, id) {
    U.applicant = id; return;
  },
  'rec-next'(el, id) {
    {
          if (recDone) { recDone(); return; }
          const ap = Guild.applicants[0], n = ap ? ap.story.length + (ap.hint ? 1 : 0) : 0;
          if ((U.recLine || 0) >= n - 1) return false; // 마지막 대사에서는 눌러도 아무 일도 없다(다시 그려지며 흔들리지 않게)
          U.recLine = (U.recLine || 0) + 1; return;
        }
  },
  'app-dismiss'(el, id) {
    Guild.dismissApplicant(id); toast('지원자를 돌려보냈어요.'); return;
  },
  'hire'(el, id) {
    {
          if (U.hiring) return;
          const doHire = () => { const r = Guild.hire(id); if (!r.ok) { toast(r.reason); } else { U.modal = { type: 'recruit', id: r.character.id }; Sound.play('hire'); } };
          if (Server.isIn()) { // 외모가 서버 전체에서 하나뿐이도록, 채용 전에 서버에 등록한다
            U.hiring = true;
            Promise.race([Promise.resolve().then(() => Server.reserveAppearance(id)), new Promise((r) => setTimeout(r, 4000))]).catch(() => {}).then(() => { U.hiring = false; try { doHire(); } catch (er) { toast('채용 중 문제가 생겼어요. 다시 눌러 주세요.'); } render(); }); // 서버가 느리거나 막혀도 4초 뒤엔 그대로 진행한다
            return;
          }
          doHire();
          return;
        }
  },
  'promote'(el, id) {
    { const r = Guild.promoteGuild(); toast(r.ok ? `길드가 ${Guild.guildGrade()}급으로 올랐어요!` : r.reason); return; }
  },
  'upgrade'(el, id) {
    { const r = Guild.upgradeFacility(id); toast(r.ok ? '시설을 확장했어요.' : r.reason); return; }
  },
});
