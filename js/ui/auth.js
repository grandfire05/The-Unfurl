/* ui/auth.js — 로그인 / 회원가입 / 길드 이름
   (ui.js를 쪼갠 파일: 전역 스크립트로 같은 이름 공간을 공유한다. 로드 순서는 index.html 참고) */
'use strict';

  function authGet() { try { return JSON.parse(localStorage.getItem('guild_auth') || 'null'); } catch (e) { return null; } }
  function authSet(v) { try { if (v == null) localStorage.removeItem('guild_auth'); else localStorage.setItem('guild_auth', JSON.stringify(v)); } catch (e) {} }
  const AUTH_MODE = 'link'; // 'link' = 메일의 인증 링크(기본 메일 서버) / 'code' = 메일의 인증 번호(템플릿을 {{ .Token }}으로 바꾼 경우)
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const AU = { tab: 'login', step: 'form', err: '', ok: '', busy: false, v: { email: '', pw: '', pw2: '', guild: '', code: '' }, cool: 0, nameOk: null };
  const EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.6 18.6 0 0 1 5.1-5.9M9.9 4.2A10.7 10.7 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/></svg>';
  const pwField = (id, label, ph, auto, val) => `<div class="au-f"><label for="${id}">${label}</label><div class="au-in"><input id="${id}" type="password" autocomplete="${auto}" placeholder="${ph}" value="${esc(val)}"><button type="button" class="au-eye" data-au="eye" data-t="${id}" aria-label="비밀번호 보기" title="비밀번호 보기">${EYE}</button></div><div class="au-h" id="h-${id}"></div></div>`;
  function authHtml() {
    const sess = authGet(), v = AU.v;
    const card = (inner) => `<div class="au-wrap"><div class="au-card"><div class="au-logo">모험가 길드</div><div class="au-sub">모험가를 모으고, 키우고, 떠나보내는 이야기</div>${inner}</div></div>`;
    const msg = () => `<div class="au-msg ${AU.ok ? 'ok' : AU.err ? 'err' : ''}" role="alert">${esc(AU.ok || AU.err || '')}</div>`;
    if (sess && !Guild.guildNamed()) {
      return card(`<h2>길드 이름을 정해 주세요</h2><p class="au-note">길드의 첫 이름이에요. 나중에 바꿀 수 있지만, <b>바꾸면 명성이 50% 떨어져요.</b></p>
        <form novalidate data-form="name"><div class="au-f"><label for="au-guild">길드 이름 <small>2~8자 · 다른 길드와 겹칠 수 없어요</small></label><div class="au-in"><input id="au-guild" type="text" maxlength="8" autocomplete="off" placeholder="예) 푸른 늑대 길드" value="${esc(v.guild)}"></div><div class="au-h" id="h-au-guild"></div></div>
        ${msg()}<button class="au-btn primary" type="submit"${AU.busy ? ' disabled' : ''}>${AU.busy ? '확인하는 중…' : '길드 시작하기'}</button></form>`);
    }
    if (AU.step === 'code') {
      const left = Math.max(0, Math.ceil((AU.cool - Date.now()) / 1000));
      const links = `<div class="au-links"><button class="au-link" data-au="resend"${left > 0 || AU.busy ? ' disabled' : ''}>${left > 0 ? `인증 메일 다시 받기 (${left}초)` : '인증 메일 다시 받기'}</button><button class="au-link" data-au="back">이메일 다시 입력</button></div>`;
      if (AUTH_MODE === 'link') {
        return card(`<h2>메일함을 확인해 주세요</h2><p class="au-note"><b>${esc(v.email)}</b> 로 인증 메일을 보냈어요.<br>① 메일의 <b>인증 링크</b>를 누르고<br>② 이 창으로 돌아와 아래 버튼을 눌러 주세요.<br><span class="muted">(메일이 안 보이면 스팸함도 확인해 보세요 · 이 창으로 돌아오면 자동으로 확인해요)</span></p>
          ${msg()}<button class="au-btn primary" data-au="confirmed"${AU.busy ? ' disabled' : ''}>${AU.busy ? '확인하는 중…' : '인증했어요 · 시작하기'}</button>${links}`);
      }
      return card(`<h2>이메일 인증</h2><p class="au-note"><b>${esc(v.email)}</b> 로 인증 번호를 보냈어요.<br>메일에 적힌 숫자를 입력해 주세요. <span class="muted">(메일이 안 보이면 스팸함도 확인해 보세요)</span></p>
        <form novalidate data-form="code"><div class="au-f"><label for="au-code">인증 번호</label><div class="au-in"><input id="au-code" class="au-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="••••••" value="${esc(v.code)}"></div></div>
        ${msg()}<button class="au-btn primary" type="submit"${AU.busy ? ' disabled' : ''}>${AU.busy ? '확인하는 중…' : '인증하고 시작하기'}</button></form>${links}`);
    }
    const t = AU.tab;
    return card(`<div class="au-tabs" role="tablist"><button role="tab" aria-selected="${t === 'login'}" data-au="tab" data-k="login" class="${t === 'login' ? 'on' : ''}">로그인</button><button role="tab" aria-selected="${t === 'signup'}" data-au="tab" data-k="signup" class="${t === 'signup' ? 'on' : ''}">회원가입</button></div>
      <form novalidate data-form="${t}">
      <div class="au-f"><label for="au-email">이메일</label><div class="au-in"><input id="au-email" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(v.email)}"></div><div class="au-h" id="h-au-email"></div></div>
      ${pwField('au-pw', '비밀번호', t === 'signup' ? '8자 이상' : '비밀번호', t === 'login' ? 'current-password' : 'new-password', v.pw)}
      ${t === 'signup' ? pwField('au-pw2', '비밀번호 확인', '한 번 더 입력', 'new-password', v.pw2) : ''}
      ${msg()}
      <button class="au-btn primary" type="submit"${AU.busy ? ' disabled' : ''}>${AU.busy ? '잠시만요…' : t === 'login' ? '로그인' : '인증 번호 받기'}</button></form>
      ${t === 'signup' ? '<p class="au-foot">가입하면 메일로 <b>인증 번호</b>를 보내 드려요.</p>' : ''}
      <div class="au-or"><span>또는</span></div>
      <button class="au-btn ghost" data-au="skip">로그인 없이 하기 <small>저장 안 됨 · 채팅·고유스킬 서버 기능 없음</small></button>`);
  }
  function authRender() {
    const sess = authGet(), el = $('auth');
    if (sess && Guild.guildNamed()) { el.innerHTML = ''; el.style.display = 'none'; render(); return; }
    el.style.display = 'block';
    el.innerHTML = authHtml();
    const f = el.querySelector('input'); if (f) { f.focus(); const n = f.value.length; try { f.setSelectionRange(n, n); } catch (e) {} }
    authHints();
  }
  // 입력하는 대로 보여 주는 안내 (칸 아래 작은 글씨)
  function authHints() {
    const v = AU.v, set = (id, cls, txt) => { const h = document.getElementById('h-' + id); if (h) { h.className = 'au-h ' + cls; h.textContent = txt; } };
    if (document.getElementById('au-email') && v.email) set('au-email', EMAIL_RE.test(v.email.trim()) ? 'ok' : 'bad', EMAIL_RE.test(v.email.trim()) ? '✓ 사용할 수 있는 형식이에요' : '이메일 형식을 확인해 주세요');
    else set('au-email', '', '');
    if (AU.tab === 'signup' && document.getElementById('au-pw')) {
      set('au-pw', v.pw ? (v.pw.length >= 8 ? 'ok' : 'bad') : '', v.pw ? (v.pw.length >= 8 ? '✓ 좋아요' : `${v.pw.length}/8자 — 8자 이상이어야 해요`) : '');
      set('au-pw2', v.pw2 ? (v.pw2 === v.pw ? 'ok' : 'bad') : '', v.pw2 ? (v.pw2 === v.pw ? '✓ 비밀번호가 같아요' : '비밀번호가 서로 달라요') : '');
    }
    const g = document.getElementById('au-guild');
    if (g) { const n = v.guild.trim(); set('au-guild', n.length < 2 ? '' : AU.nameOk === true ? 'ok' : AU.nameOk === false ? 'bad' : 'wait', n.length < 2 ? '' : AU.nameOk === true ? '✓ 사용할 수 있는 이름이에요' : AU.nameOk === false ? '이미 다른 길드가 쓰고 있는 이름이에요' : '확인하는 중…'); }
  }
  let nameTimer = null;
  function checkName() {
    const n = AU.v.guild.trim(); AU.nameOk = null; clearTimeout(nameTimer);
    if (n.length < 2 || !Server.isIn()) { authHints(); return; }
    nameTimer = setTimeout(() => { Server.guildNameAvailable(n).then((ok) => { if (AU.v.guild.trim() === n) { AU.nameOk = ok; authHints(); } }); }, 350);
  }
  const clearMsg = () => { AU.err = ''; AU.ok = ''; const m = $('auth').querySelector('.au-msg'); if (m) { m.className = 'au-msg'; m.textContent = ''; } };
  const tickCool = () => { if (AU.step === 'code' && AU.cool > Date.now()) { const b = $('auth').querySelector('[data-au="resend"]'); const left = Math.ceil((AU.cool - Date.now()) / 1000); if (b) { b.textContent = left > 0 ? `인증 번호 다시 받기 (${left}초)` : '인증 번호 다시 받기'; b.disabled = left > 0; } setTimeout(tickCool, 500); } };
  $('auth').addEventListener('input', (e) => {
    const id = e.target.id, v = AU.v;
    if (id === 'au-email') v.email = e.target.value; else if (id === 'au-pw') v.pw = e.target.value; else if (id === 'au-pw2') v.pw2 = e.target.value;
    else if (id === 'au-guild') { v.guild = e.target.value; checkName(); } else if (id === 'au-code') { v.code = e.target.value = e.target.value.replace(/\D/g, ''); }
    clearMsg(); authHints();
  });
  $('auth').addEventListener('click', (e) => {
    const b = e.target.closest('[data-au]'); if (!b) return;
    const k = b.dataset.au;
    if (k === 'tab') { AU.tab = b.dataset.k; AU.v.pw = ''; AU.v.pw2 = ''; clearMsg(); authRender(); }
    else if (k === 'skip') { authSet({ skip: true, at: Date.now() }); clearMsg(); authRender(); }
    else if (k === 'eye') { const i = document.getElementById(b.dataset.t); if (!i) return; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = show ? EYE_OFF : EYE; b.title = b.ariaLabel = show ? '비밀번호 숨기기' : '비밀번호 보기'; i.focus(); }
    else if (k === 'back') { AU.step = 'form'; AU.v.code = ''; clearMsg(); authRender(); }
    else if (k === 'resend') sendCode(false);
    else if (k === 'confirmed') tryConfirmed(false);
  });
  // 링크 방식: 메일에서 인증을 눌렀는지 로그인을 시도해 확인한다
  function tryConfirmed(silent) {
    if (AU.busy || AU.step !== 'code' || !AU.v.pw) { if (!silent && !AU.v.pw) { AU.err = '비밀번호를 다시 입력해 주세요.'; AU.step = 'form'; authRender(); } return; }
    AU.busy = true; if (!silent) { clearMsg(); authRender(); }
    Server.signIn(AU.v.email.trim(), AU.v.pw).then((r) => {
      AU.busy = false;
      if (r.ok) { AU.step = 'form'; AU.v.pw = ''; AU.v.pw2 = ''; AU.err = ''; AU.ok = ''; authRender(); return; }
      if (!silent) { AU.err = r.needCode ? '아직 인증이 안 됐어요. 메일의 링크를 먼저 눌러 주세요.' : r.reason; authRender(); }
    });
  }
  window.addEventListener('focus', () => { if (AUTH_MODE === 'link' && AU.step === 'code') tryConfirmed(true); });
  function sendCode(first) {
    if (AU.busy) return; AU.busy = true; clearMsg();
    Server.resendCode(AU.v.email.trim()).then((r) => {
      AU.busy = false;
      if (r.ok) { AU.cool = Date.now() + 60000; AU.ok = first ? '' : '인증 번호를 다시 보냈어요.'; } else AU.err = r.reason;
      authRender(); tickCool();
    });
  }
  $('auth').addEventListener('submit', (e) => {
    e.preventDefault();
    const kind = e.target.dataset.form, v = AU.v, fail = (m) => { AU.ok = ''; AU.err = m; const x = $('auth').querySelector('.au-msg'); if (x) { x.className = 'au-msg err'; x.textContent = m; } };
    if (AU.busy) return;
    if (kind === 'name') {
      const n = v.guild.trim();
      if (n.length < 2) return fail('길드 이름은 2~8글자로 지어 주세요.');
      AU.busy = true; authRender();
      Server.claimGuildName(n).then((ok) => {
        AU.busy = false;
        if (!ok) { AU.nameOk = false; authRender(); return fail('이미 다른 길드가 쓰고 있는 이름이에요. 다른 이름을 골라 주세요.'); }
        const r = Guild.nameGuild(n); if (!r.ok) { authRender(); return fail(r.reason); }
        AU.err = ''; authRender();
      });
      return;
    }
    if (!Server.available()) return fail('서버에 연결할 수 없어요. 인터넷을 확인하거나 "로그인 없이 하기"를 눌러 주세요.');
    if (kind === 'code') {
      if (v.code.length < 6) return fail('메일에 적힌 인증 번호를 입력해 주세요.');
      AU.busy = true; authRender();
      Server.verifyCode(v.email.trim(), v.code).then((r) => { AU.busy = false; if (!r.ok) { authRender(); return fail(r.reason); } AU.step = 'form'; AU.err = ''; authRender(); });
      return;
    }
    const email = v.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return fail('이메일 주소를 확인해 주세요.');
    if (v.pw.length < 8) return fail('비밀번호는 8자 이상이어야 해요.');
    if (kind === 'signup' && v.pw !== v.pw2) return fail('비밀번호가 서로 달라요.');
    v.email = email; AU.busy = true; authRender();
    (kind === 'signup' ? Server.signUp(email, v.pw) : Server.signIn(email, v.pw)).then((r) => {
      AU.busy = false;
      if (r.needCode || r.code) { AU.step = 'code'; AU.v.code = ''; AU.ok = ''; AU.err = ''; if (r.needCode) { AU.ok = '이메일 인증이 아직이에요. 인증 번호를 다시 보낼게요.'; } authRender(); if (r.needCode) sendCode(true); else { AU.cool = Date.now() + 60000; authRender(); tickCool(); } return; }
      if (!r.ok) { authRender(); return fail(r.reason); }
      AU.v.pw = ''; AU.v.pw2 = ''; AU.err = ''; authRender();
    });
  });
