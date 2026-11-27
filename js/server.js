/* 서버(Supabase) 연결: 로그인 · 세이브 동기화 · 고유스킬 소유 · 채팅(실시간 방송).
   서버가 없거나(오프라인) 로그인을 건너뛰면 예전처럼 이 기기 안에서만 동작한다. */
(function (global) {
  'use strict';
  const SB_URL = 'https://oxylcjzjeorijrhuwdcn.supabase.co';
  const KEY = 'sb_publishable_aVW138jdau5xo_hB7JCflQ_oOVhtiPc'; // 공개용 키(브라우저에 들어가도 됨). 접근 제한은 서버의 RLS가 맡는다.
  const OWNER_KEY = 'guild_save_owner', PUSH_MS = 120000;
  let sb = null, user = null, room = null, owners = new Map(), lastKnown = null, pushTimer = null, dirty = false, conflict = false, busy = false;
  const handlers = {};
  const on = (k, fn) => { handlers[k] = fn; };
  const emit = (k, a) => { try { handlers[k] && handlers[k](a); } catch (e) { /* 무시 */ } };
  const G = () => global.Guild;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 무시 */ } } };

  function client() {
    if (sb) return sb;
    if (!global.supabase || !global.supabase.createClient) return null; // 오프라인이면 스크립트를 못 받아 온다
    sb = global.supabase.createClient(SB_URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && user) { user = null; leave(); emit('signedOut'); } });
    return sb;
  }
  const available = () => !!client();
  const msg = (e) => {
    const m = String((e && e.message) || e || '');
    if (/expired|invalid.*(token|otp)|token.*invalid|otp/i.test(m)) return '인증 번호가 맞지 않거나 시간이 지났어요. 다시 확인하거나 새로 받아 주세요.';
    if (/Invalid login/i.test(m)) return '이메일이나 비밀번호가 맞지 않아요.';
    if (/Email not confirmed/i.test(m)) return '이메일 인증이 아직이에요. 메일의 링크를 눌러 주세요.';
    if (/already registered|already been registered/i.test(m)) return '이미 가입된 이메일이에요.';
    if (/rate limit|too many/i.test(m)) return '요청이 너무 많아요. 잠시 뒤에 다시 해 주세요.';
    if (/Password should/i.test(m)) return '비밀번호가 너무 짧거나 약해요.';
    if (/fetch|network|Failed/i.test(m)) return '서버에 연결할 수 없어요. 인터넷을 확인해 주세요.';
    return '문제가 생겼어요: ' + m;
  };

  /* ---------- 로그인 ---------- */
  const noScript = { ok: false, reason: '서버 스크립트를 불러오지 못했어요. 인터넷을 확인해 주세요.' };
  async function signUp(email, password) {
    const c = client(); if (!c) return noScript;
    const { data, error } = await c.auth.signUp({ email, password });
    if (error) return { ok: false, reason: msg(error) };
    // 이미 가입된 이메일은 오류 없이 identities 가 빈 채로 돌아온다
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return { ok: false, exists: true, reason: '이미 가입된 이메일이에요. 로그인해 주세요.' };
    if (!data.session) return { ok: true, code: true }; // 인증 번호를 메일로 보냈다
    await afterLogin(data.user); return { ok: true };
  }
  async function signIn(email, password) {
    const c = client(); if (!c) return noScript;
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) { if (/not confirmed/i.test(error.message || '')) return { ok: false, needCode: true, reason: msg(error) }; return { ok: false, reason: msg(error) }; }
    await afterLogin(data.user); return { ok: true };
  }
  // 메일로 받은 인증 번호 확인
  async function verifyCode(email, token) {
    const c = client(); if (!c) return noScript;
    const { data, error } = await c.auth.verifyOtp({ email, token: String(token).trim(), type: 'signup' });
    if (error) return { ok: false, reason: msg(error) };
    if (!data || !data.user) return { ok: false, reason: '인증하지 못했어요. 다시 시도해 주세요.' };
    await afterLogin(data.user); return { ok: true };
  }
  async function resendCode(email) {
    const c = client(); if (!c) return noScript;
    const { error } = await c.auth.resend({ type: 'signup', email });
    return error ? { ok: false, reason: msg(error) } : { ok: true };
  }
  async function signOut() {
    if (dirty) await pushSave(true);
    leave(); user = null;
    if (sb) { try { await sb.auth.signOut(); } catch (e) { /* 무시 */ } }
  }
  // 새로고침 뒤에도 로그인이 남아 있는지 확인한다
  async function restore() {
    const c = client(); if (!c) return false;
    try { const { data } = await c.auth.getSession(); if (data && data.session) { await afterLogin(data.session.user); return true; } } catch (e) { /* 무시 */ }
    return false;
  }
  async function afterLogin(u) {
    user = u;
    store.set('guild_auth', JSON.stringify({ email: u.email, uid: u.id, at: Date.now() }));
    await pullSave();
    await refreshOwners();
    await syncSkills();
    await syncAppearances();
    await syncGuildName();
    await checkAway();
    joinRoom();
    emit('signedIn');
  }

  /* ---------- 세이브 ---------- */
  async function pullSave() {
    const g = G(); if (!g || !user) return;
    const { data, error } = await sb.from('saves').select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) return;
    const snap = g.snapshot();
    const hasLocal = snap && (snap.characters.length > 0 || snap.guildNamed);
    if (data && data.data) {
      lastKnown = data.updated_at;
      const cloud = data.data;
      let useCloud = true;
      if (hasLocal) useCloud = global.confirm('서버에 이 계정의 저장이 있어요.\n서버 저장을 불러올까요?\n\n[확인] 서버 저장 불러오기\n[취소] 지금 하던 게임으로 서버를 덮어쓰기');
      if (useCloud) { g.importSave(JSON.stringify(cloud)); emit('saveReplaced'); }
      else { dirty = true; await pushSave(true); }
    } else {
      // 서버에 저장이 없다: 지금 하던 게임을 올린다
      dirty = true; await pushSave(true);
    }
  }
  let sstate = 'idle', savedAt = 0;
  function setS(v) { sstate = v; if (v === 'saved') savedAt = Date.now(); emit('saveState'); }
  function queueSave() {
    if (!user || conflict) return;
    dirty = true; if (sstate !== 'saving') setS('wait');
    if (!pushTimer) pushTimer = setTimeout(() => { pushTimer = null; pushSave(); }, PUSH_MS);
  }
  async function pushSave(force) {
    const g = G(); if (!user || !g || busy || conflict || (!dirty && !force)) return false;
    busy = true; setS('saving');
    try {
      // 다른 기기에서 더 최근에 저장했는지 먼저 본다
      const cur = await sb.from('saves').select('updated_at').eq('user_id', user.id).maybeSingle();
      if (cur.data && lastKnown && cur.data.updated_at !== lastKnown) {
        conflict = true;
        if (global.confirm('다른 기기에서 더 최근에 저장했어요.\n서버 저장을 불러올까요?\n\n[확인] 서버 저장 불러오기\n[취소] 지금 하던 게임으로 덮어쓰기')) {
          const r = await sb.from('saves').select('data, updated_at').eq('user_id', user.id).maybeSingle();
          if (r.data) { lastKnown = r.data.updated_at; g.importSave(JSON.stringify(r.data.data)); emit('saveReplaced'); }
          conflict = false; busy = false; setS('saved'); return false;
        }
        conflict = false;
      }
      const row = { user_id: user.id, data: g.snapshot(), version: 1, updated_at: new Date().toISOString() };
      const { data, error } = await sb.from('saves').upsert(row).select('updated_at').single();
      if (error) { busy = false; setS('error'); return false; }
      lastKnown = data.updated_at; dirty = false;
    } catch (e) { busy = false; setS('error'); return false; }
    busy = false; setS('saved'); return true;
  }
  global.addEventListener('pagehide', () => { if (user && dirty) pushSave(true); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && user && dirty) pushSave(true); });

  /* ---------- 고유스킬 소유 ---------- */
  async function refreshOwners() {
    if (!user) return;
    const { data, error } = await sb.from('skill_owners').select('skill, user_id');
    if (error || !data) return;
    owners = new Map(data.map((r) => [r.skill, r.user_id]));
  }
  const foreign = (id) => !!user && owners.has(id) && owners.get(id) !== user.id; // 다른 사람이 가진 스킬
  const takenCount = () => owners.size;
  async function claim(skill, charId) {
    if (!user) return true; // 로그인 안 했으면 이 기기 안에서만
    try {
      const { data, error } = await sb.rpc('claim_skill', { p_skill: skill, p_char_id: charId });
      if (error) return null; // 서버 문제: 나중에 다시 맞춘다
      if (data === true) { owners.set(skill, user.id); return true; }
      await refreshOwners();
      return false;
    } catch (e) { return null; }
  }
  async function release(skill) {
    if (!user) return;
    try { await sb.rpc('release_skill', { p_skill: skill }); owners.delete(skill); } catch (e) { /* 무시 */ }
  }
  async function pickAnother(charId) {
    try { const { data, error } = await sb.rpc('acquire_random_skill', { p_char_id: charId }); return error ? null : data; } catch (e) { return null; }
  }
  // 이 기기의 모험가들이 가진 스킬을 서버 기록과 맞춘다. 겹치면(다른 사람이 먼저 가졌으면) 다른 스킬로 바꾼다.
  async function syncSkills() {
    const g = G(); if (!g || !user) return;
    for (const c of g.snapshot().characters) {
      if (c.status === 'DEAD' || c.uniqueSkill == null) continue;
      if (owners.get(c.uniqueSkill) === user.id) continue;
      const ok = await claim(c.uniqueSkill, c.id);
      if (ok === false) {
        const ns = await pickAnother(c.id);
        g.swapSkill(c.id, c.uniqueSkill, ns); // ns가 null이면 스킬 없음
      }
    }
  }
  // 채용 확정 직후 부른다
  async function claimNew(c, noticeText) {
    if (!user || c.uniqueSkill == null) return;
    const ok = await claim(c.uniqueSkill, c.id);
    if (ok === false) { const ns = await pickAnother(c.id); G().swapSkill(c.id, c.uniqueSkill, ns); }
    else if (ok === true && noticeText) broadcast('notice', noticeText);
  }

  // 마지막 접속은 서버가 계정 단위로 기록한다 (어느 기기든 같은 사람의 접속). 직전 접속 이후 다른 길드가 얻은 스킬 수를 알려 준다.
  async function touchSeen(report) {
    if (!user) return;
    try {
      const { data, error } = await sb.rpc('touch_seen');
      if (!error && report && data && data.prev && data.away > 0) emit('away', data.away);
    } catch (e) { /* 무시 */ }
  }
  const checkAway = () => touchSeen(true);
  setInterval(() => touchSeen(false), 60000);
  global.addEventListener('pagehide', () => touchSeen(false));

  /* ---------- 모험가 외모 (서버 전체에서 하나뿐) ---------- */
  // 채용을 확정하기 전에 지원자의 외모를 서버에 등록한다. 겹치면(거의 없지만) 새 외모로 바꿔서 다시 등록한다.
  async function reserveAppearance(applicantId) {
    const g = G(); if (!user || !g) return;
    const a = g.snapshot().applicants.find((x) => x.id === applicantId); if (!a) return;
    for (let i = 0; i < 12; i++) {
      try {
        const { data, error } = await sb.rpc('claim_appearance', { p_id: String(a.char.appearanceId), p_char_id: a.char.id });
        if (error) return; // 서버 문제면 일단 진행하고, 다음 접속 때 맞춘다
        if (data === true) return;
      } catch (e) { return; }
      g.retarget(a.char, g.freshAppearanceId()); // 같은 외모를 누군가 먼저 가졌다
    }
  }
  // 이 기기의 모든 모험가(죽은 모험가 포함)의 외모를 등록하고, 겹치는 모험가는 새 외모로 바꾼다.
  async function syncAppearances() {
    const g = G(); if (!g || !user) return;
    for (let round = 0; round < 5; round++) {
      const chars = g.snapshot().characters;
      if (!chars.length) return;
      let bad;
      try {
        const { data, error } = await sb.rpc('claim_appearances', { p_ids: chars.map((c) => String(c.appearanceId)), p_chars: chars.map((c) => c.id) });
        if (error) return; bad = data || [];
      } catch (e) { return; }
      if (!bad.length) return;
      bad.forEach((cid) => { const c = chars.find((x) => x.id === cid); if (c) g.retarget(c, g.freshAppearanceId()); });
    }
  }

  /* ---------- 길드 이름 (서버 전체에서 하나뿐) ---------- */
  async function guildNameAvailable(name) {
    if (!user) return true;
    try { const { data, error } = await sb.rpc('guild_name_available', { p_name: name }); return error ? true : data !== false; } catch (e) { return true; }
  }
  // 이름을 내 것으로 등록한다. 로그인 안 했거나 서버가 응답하지 않으면 통과시키고, 다음 로그인 때 맞춘다.
  async function claimGuildName(name) {
    if (!user) return true;
    try { const { data, error } = await sb.rpc('claim_guild_name', { p_name: name }); return error ? true : data === true; } catch (e) { return true; }
  }
  async function syncGuildName() {
    const g = G(); if (!g || !user) return;
    const st = g.state; if (!st.guildNamed || !st.guildName) return;
    if (!(await claimGuildName(st.guildName))) { g.unsetName(); emit('nameTaken'); }
  }

  /* ---------- 채팅 ---------- */
  function joinRoom() {
    if (room || !sb || !user) return;
    room = sb.channel('guild-room', { config: { broadcast: { self: false } } });
    room.on('broadcast', { event: 'msg' }, ({ payload }) => {
      if (!payload || typeof payload.text !== 'string') return;
      const text = payload.text.slice(0, 160);
      if (payload.ch === 'normal') global.Chat.receive({ ch: 'normal', from: String(payload.from || '이름 없는 길드').slice(0, 12), text, t: Date.now() });
      else if (payload.ch === 'notice' && /^[^{}]{1,80}\{\{sk:\d{1,3}\}\}[^{}]{0,40}$/.test(text)) global.Chat.receive({ ch: 'notice', text, t: Date.now() }); // 공지는 고유스킬 획득 알림만 받는다
    }).subscribe((st) => { if (st === 'SUBSCRIBED') { global.Chat.setTransport({ send: (ch, text) => broadcast('msg', text, ch) }); global.Chat.log('서버 채팅에 연결됐어요. 지금부터 오는 메시지만 보여요.'); } });
  }
  function broadcast(kind, text, ch) {
    if (!room) return;
    const g = G(), from = (g && g.state && g.state.guildName) || '이름 없는 길드';
    room.send({ type: 'broadcast', event: 'msg', payload: { ch: kind === 'notice' ? 'notice' : 'normal', from, text } });
  }
  function leave() { if (room && sb) { try { sb.removeChannel(room); } catch (e) { /* 무시 */ } } room = null; if (global.Chat) global.Chat.setTransport(null); }

  setInterval(() => { if (user) refreshOwners(); }, 60000);

  global.Server = { available, signUp, signIn, verifyCode, resendCode, guildNameAvailable, claimGuildName, signOut, restore, queueSave, pushSave, saveInfo: () => ({ state: sstate, at: savedAt }), claimNew, release, reserveAppearance, foreign, takenCount, on, isIn: () => !!user, email: () => (user && user.email) || null };
})(window);
