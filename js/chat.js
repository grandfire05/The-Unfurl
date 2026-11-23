/* 채팅: 전체 / 공지 / 일반 / 로그.
   서버가 붙기 전에는 이 기기 안에서만 동작한다. 서버를 붙일 때는 Chat.setTransport({ send(channel, text) })로 보내는 쪽을,
   Chat.receive({ ch, from, text, t }) 로 받는 쪽을 연결하면 된다. */
(function (global) {
  'use strict';
  const KEY = 'guild_chat_v1', MAX = 160, MAXLEN = 120;
  const CHANNELS = [
    { id: 'all', label: '전체', hint: '전체 채널에서 보내는 글은 일반 채팅으로 전송돼요.' },
    { id: 'notice', label: '공지', readonly: true, hint: '읽기 전용 채널이에요.' },
    { id: 'normal', label: '일반', hint: '일반 채팅 (Enter로 전송 · 빈 칸에서 Enter로 닫기)' },
    { id: 'log', label: '로그', readonly: true, hint: '읽기 전용 채널이에요.' },
  ];
  const TAG = { notice: '공지', normal: '일반', log: '로그' };
  let msgs = [], seq = 1, cur = 'all', open = false, transport = null, notedLocal = false, lastSend = 0;
  const unread = { all: 0, notice: 0, normal: 0, log: 0 };
  let clampPos = () => {}, el = null, skillInfo = null, tip = null;
  const SK_RE = /\{\{sk:(\d+)\}\}/g;
  const skName = (id) => { const i = skillInfo && skillInfo(Number(id)); return i ? i.name : '고유스킬'; };
  const plain = (t) => String(t).replace(SK_RE, (_, id) => '[' + skName(id) + ']');
  function setSkillInfo(fn) { skillInfo = fn; }
  try { const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw && Array.isArray(raw.msgs)) { msgs = raw.msgs; seq = raw.seq || msgs.length + 1; } } catch (e) { /* 무시 */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ msgs: msgs.slice(-MAX), seq })); } catch (e) { /* 무시 */ } }

  function push(ch, text, from, extra) {
    const m = Object.assign({ id: seq++, ch, from: from || null, text: String(text), t: Date.now() }, extra || {});
    msgs.push(m); if (msgs.length > MAX) msgs.shift();
    save();
    if (!(open && (cur === 'all' || cur === ch))) { unread[ch] = (unread[ch] || 0) + 1; unread.all++; }
    if (el) { appendRow(m); updateBar(); }
    return m;
  }
  const log = (text, kind) => push('log', text, null, { kind: kind || '' });
  const notice = (text) => push('notice', text, null);
  function receive(m) { if (m && TAG[m.ch]) push(m.ch, m.text, m.from, { remote: true, t: m.t }); }
  function setTransport(t) { transport = t; }
  function send(text) {
    text = String(text || '').trim().slice(0, MAXLEN);
    if (!text) return false;
    const n = Date.now();
    if (n - lastSend < 700) return false; // 도배 방지
    lastSend = n;
    const G = global.Guild, name = (G && G.state && G.state.guildName) || '길드 마스터';
    push('normal', text, name, { mine: true });
    if (transport) transport.send('normal', text);
    else if (!notedLocal) { notedLocal = true; push('normal', '서버에 연결되어 있지 않아 이 메시지는 이 기기에만 남아요.', null, { sys: true }); }
    return true;
  }

  /* ---------- 화면 ---------- */
  const hhmm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  function rowEl(m) {
    const r = document.createElement('div');
    r.className = 'cm cm-' + m.ch + (m.mine ? ' mine' : '') + (m.sys ? ' sys' : '') + (m.kind ? ' k-' + m.kind : '');
    r.dataset.ch = m.ch;
    const t = document.createElement('span'); t.className = 'cm-t'; t.textContent = hhmm(m.t); r.appendChild(t);
    const g = document.createElement('span'); g.className = 'cm-g'; g.textContent = TAG[m.ch]; r.appendChild(g);
    if (m.from) { const f = document.createElement('b'); f.className = 'cm-f'; f.textContent = m.from; r.appendChild(f); }
    const x = document.createElement('span'); x.className = 'cm-x';
    let last = 0, mt; SK_RE.lastIndex = 0;
    while ((mt = SK_RE.exec(m.text))) {
      if (mt.index > last) x.appendChild(document.createTextNode(m.text.slice(last, mt.index)));
      const a = document.createElement('span'); a.className = 'cm-sk'; a.dataset.sk = mt[1]; a.textContent = '[' + skName(mt[1]) + ']'; x.appendChild(a);
      last = mt.index + mt[0].length;
    }
    if (last < m.text.length) x.appendChild(document.createTextNode(m.text.slice(last)));
    r.appendChild(x);
    return r;
  }
  const LOGGRP = { go: 'quest', win: 'quest', bad: 'quest', hire: 'adv', level: 'adv', skill: 'adv', chronicle: 'rec' };
  let logF = 'all';
  // 채팅 설정: 안 볼 항목 (전체 탭·알림 막대·배지에서 숨긴다. 그 채널 탭을 직접 열면 볼 수 있다)
  const SETKEY = 'guild_chat_set_v1';
  let hide = { notice: false, normal: false, log: false, quest: false, adv: false, rec: false };
  try { Object.assign(hide, JSON.parse(localStorage.getItem(SETKEY) || '{}')); } catch (e) { /* 무시 */ }
  const hiddenMsg = (m) => hide[m.ch] || (m.ch === 'log' && hide[LOGGRP[m.kind] || 'rec']);
  const visible = (m) => (cur === 'all' ? !hiddenMsg(m) : (m.ch === cur && (cur !== 'log' || logF === 'all' || (LOGGRP[m.kind] || 'rec') === logF)));
  function listEl() { return el.querySelector('.chat-list'); }
  function appendRow(m) {
    if (!open || !visible(m)) return;
    const l = listEl(), near = l.scrollHeight - l.scrollTop - l.clientHeight < 40;
    l.appendChild(rowEl(m));
    while (l.children.length > MAX) l.removeChild(l.firstChild);
    if (near || m.mine) l.scrollTop = l.scrollHeight;
  }
  function fill() {
    if (tip) tip.style.display = 'none';
    const l = listEl(); l.textContent = '';
    msgs.filter(visible).slice(-MAX).forEach((m) => l.appendChild(rowEl(m)));
    l.scrollTop = l.scrollHeight;
  }
  function updateBar() {
    const last = msgs.slice().reverse().find((m) => m.ch !== 'log' && !hiddenMsg(m)), bar = el.querySelector('.chat-bar-txt'), bd = el.querySelector('.chat-badge');
    bar.textContent = last ? `[${TAG[last.ch]}] ${last.from ? last.from + ': ' : ''}${plain(last.text)}` : '채팅 (Enter 키)';
    bar.className = 'chat-bar-txt' + (last ? ' c-' + last.ch : '');
    const nb = (hide.notice ? 0 : unread.notice || 0) + (hide.normal ? 0 : unread.normal || 0); bd.textContent = nb > 99 ? '99+' : String(nb); bd.style.display = nb ? '' : 'none';
    el.querySelectorAll('.chat-tab').forEach((b) => {
      const n = unread[b.dataset.ch] || 0, s = b.querySelector('i');
      s.textContent = n ? (n > 99 ? '99+' : n) : ''; s.style.display = n ? '' : 'none';
      b.setAttribute('aria-selected', b.dataset.ch === cur ? 'true' : 'false');
    });
    el.querySelector('.chat-filter').style.display = cur === 'log' ? '' : 'none';
    el.querySelectorAll('.chat-fb').forEach((b) => b.setAttribute('aria-selected', b.dataset.f === logF ? 'true' : 'false'));
    const ch = CHANNELS.find((c) => c.id === cur), inp = el.querySelector('.chat-in');
    inp.disabled = !!ch.readonly; inp.placeholder = ch.hint;
    el.querySelector('.chat-send').disabled = !!ch.readonly;
    if (open) clampPos();
  }
  function setOpen(v) {
    open = v; el.classList.toggle('open', v);
    if (v) { clearCur(); fill(); clampPos(); }
    else { const i = el.querySelector('.chat-in'); if (i) i.blur(); }
    updateBar();
  }
  function clearCur() { unread[cur] = 0; if (cur === 'all') unread.notice = unread.normal = unread.log = 0; recount(); }
  function recount() { unread.all = unread.notice + unread.normal + unread.log; }
  function setChannel(id) {
    cur = id; clearCur(); fill(); updateBar();
  }
  function openSettings() {
    const stage = document.getElementById('stage');
    if (document.getElementById('chat-set')) return;
    const rows = [['notice', '공지 안 보기'], ['normal', '일반 채팅 안 보기'], ['log', '로그 전부 안 보기'], ['quest', '의뢰 로그 안 보기'], ['adv', '모험가 로그 안 보기'], ['rec', '기록 로그 안 보기']];
    const d = document.createElement('div'); d.id = 'chat-set';
    d.innerHTML = `<div class="cs-box" role="dialog" aria-label="채팅 설정"><div class="cs-h">채팅 설정<button type="button" class="cs-x" aria-label="닫기">×</button></div>
      <p class="cs-p">체크한 항목은 <b>전체</b> 탭과 알림 막대에서 보이지 않아요.<br>해당 탭을 직접 열면 볼 수 있어요.</p>
      ${rows.map(([k, l]) => `<label class="cs-r"><input type="checkbox" data-k="${k}"${hide[k] ? ' checked' : ''}><span>${l}</span></label>`).join('')}
      <div class="cs-f"><button type="button" class="cs-ok">확인</button></div></div>`;
    stage.appendChild(d);
    const close = () => { d.remove(); };
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.cs-x') || e.target.closest('.cs-ok')) close(); });
    d.addEventListener('change', (e) => {
      const i = e.target.closest('input[data-k]'); if (!i) return;
      hide[i.dataset.k] = i.checked;
      try { localStorage.setItem(SETKEY, JSON.stringify(hide)); } catch (er) { /* 무시 */ }
      fill(); updateBar();
    });
  }
  function mount() {
    const stage = document.getElementById('stage');
    if (!stage || el) return;
    el = document.createElement('div'); el.id = 'chat';
    el.innerHTML = `<button type="button" class="chat-bar" aria-label="채팅 열기"><span class="chat-ico">✉</span><span class="chat-bar-txt"></span><b class="chat-badge" style="display:none"></b></button>
      <div class="chat-panel"><div class="chat-head">${CHANNELS.map((c) => `<button type="button" class="chat-tab" data-ch="${c.id}">${c.label}<i style="display:none"></i></button>`).join('')}<span class="chat-gap"></span><button type="button" class="chat-cfg" aria-label="채팅 설정" title="채팅 설정">⚙</button><button type="button" class="chat-min" aria-label="채팅 접기">–</button></div>
      <div class="chat-filter" style="display:none">${[['all', '전체'], ['quest', '의뢰'], ['adv', '모험가'], ['rec', '기록']].map((f) => `<button type="button" class="chat-fb" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
      <div class="chat-list" role="log" aria-live="off"></div>
      <form class="chat-form"><input class="chat-in" type="text" maxlength="${MAXLEN}" autocomplete="off" spellcheck="false"><button type="submit" class="chat-send">보내기</button></form></div>`;
    stage.appendChild(el);
    el.querySelector('.chat-bar').addEventListener('click', () => setOpen(!open));
    el.querySelector('.chat-min').addEventListener('click', () => setOpen(false));
    el.querySelector('.chat-cfg').addEventListener('click', openSettings);
    el.querySelectorAll('.chat-tab').forEach((b) => b.addEventListener('click', () => setChannel(b.dataset.ch)));
    el.querySelectorAll('.chat-fb').forEach((b) => b.addEventListener('click', () => { logF = b.dataset.f; fill(); updateBar(); }));
    // 머리 부분을 끌어 위치를 옮길 수 있다 (위치는 기억). 항상 왼쪽·아래 기준으로 두어서, 접으면 같은 아래 자리에 막대가 남는다.
    const head = el.querySelector('.chat-head');
    const place = (l, b) => { // 패널이 무대 안에 완전히 들어오도록 보정
      const st = document.getElementById('stage'), h = el.offsetHeight || 40, w = el.offsetWidth || 300;
      l = Math.max(0, Math.min(st.offsetWidth - w, l)); b = Math.max(0, Math.min(st.offsetHeight - h, b));
      el.style.left = l + 'px'; el.style.bottom = b + 'px'; el.style.top = 'auto'; return [l, b];
    };
    clampPos = () => { const st = document.getElementById('stage'); place(el.offsetLeft, st.offsetHeight - el.offsetTop - el.offsetHeight); };
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const st = document.getElementById('stage'), k = st.getBoundingClientRect().width / st.offsetWidth, sx = e.clientX, sy = e.clientY, ol = el.offsetLeft, ob = st.offsetHeight - el.offsetTop - el.offsetHeight;
      let pos = [ol, ob];
      const mv = (ev) => { pos = place(ol + (ev.clientX - sx) / k, ob - (ev.clientY - sy) / k); };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); try { localStorage.setItem('guild_chat_pos', JSON.stringify({ l: pos[0], b: pos[1] })); } catch (er) { /* 무시 */ } };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    try { const ps = JSON.parse(localStorage.getItem('guild_chat_pos') || 'null'); if (ps && typeof ps.b === 'number') place(ps.l, ps.b); } catch (er) { /* 무시 */ }
    window.addEventListener('resize', () => clampPos());
    el.querySelector('.chat-form').addEventListener('submit', (e) => { e.preventDefault(); const i = el.querySelector('.chat-in'); if (send(i.value)) i.value = ''; });
    el.querySelector('.chat-in').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') setOpen(false); else if (e.key === 'Enter' && !e.isComposing && !e.target.value.trim()) { e.preventDefault(); setOpen(false); } });
    // Enter: 채팅을 열고 입력창에 포커스. 입력창이 비어 있을 때 Enter를 다시 누르면 닫는다.
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.key !== 'Enter' || e.isComposing) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return;
      if (document.getElementById('auth') && document.getElementById('auth').innerHTML) return;
      e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (!open) setOpen(true);
      if (CHANNELS.find((c) => c.id === cur).readonly) setChannel('normal');
      el.querySelector('.chat-in').focus();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { setOpen(false); e.stopImmediatePropagation(); } }, true);
    // 스킬 이름에 마우스를 올리면 설명이 뜬다
    tip = document.createElement('div'); tip.className = 'sk-tip'; tip.style.display = 'none'; stage.appendChild(tip);
    stage.addEventListener('mouseover', (e) => {
      const a = e.target.closest && e.target.closest('.cm-sk'); if (!a || !skillInfo) return;
      const i = skillInfo(Number(a.dataset.sk)); if (!i) return;
      tip.innerHTML = `<div class="sk-tip-h">${i.icon}<b>${i.name}</b></div><p>${i.text}</p>`;
      tip.style.display = 'block';
      const sr = stage.getBoundingClientRect(), k = sr.width / stage.offsetWidth, r = a.getBoundingClientRect();
      let x = (r.left - sr.left) / k, y = (r.top - sr.top) / k - tip.offsetHeight - 8;
      if (y < 8) y = (r.bottom - sr.top) / k + 8;
      tip.style.left = Math.max(8, Math.min(x, stage.offsetWidth - tip.offsetWidth - 8)) + 'px'; tip.style.top = y + 'px';
    });
    stage.addEventListener('mouseout', (e) => { if (e.target.closest && e.target.closest('.cm-sk')) tip.style.display = 'none'; });
    if (!msgs.some((m) => m.ch === 'notice')) {
      notice('모험가 길드에 오신 것을 환영해요. Enter로 채팅을 열 수 있어요. 중요한 소식은 이곳 공지 채널에 올라와요.');
      notice('지금은 서버에 연결되어 있지 않아 채팅이 이 기기 안에서만 동작해요.');
    }
    updateBar();
  }
  function init() { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount(); }
  global.Chat = { log, notice, receive, send, setSkillInfo, setTransport, mount, init, isOpen: () => open };
  init();
})(window);
