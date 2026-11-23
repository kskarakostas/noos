/* Cloud sync of the device stores (round 2, W3): Supabase Auth sign-in, family lookup, pull, merge, push, offline queue
   and status events. Runs in the browser (window.Sync) and in Node (module.exports) with an injected client factory.
   Loaded at run time by engine/rewards-ui.js (loadSync) only when sync-config.js holds a project URL and key; the
   Supabase client (engine/vendor/supabase.js) is loaded only when a session exists on the device or the parent signs in.
   Everything that touches a store goes through window.Rewards (load, save, localData, storeValid, mergeAll); this file
   never reads a store from localStorage itself. Nothing here ever shows on a child's screen: errors become a state for
   the parent area (engine/hub.js), never a dialog, spinner or console error.

   Device keys owned here, both outside Rewards.KEY_RE (so never synced and never in the backup code, Rewards.exportAll):
     noos_sync_auth  the Supabase session (the client's auth storageKey; written and removed by the client only)
     noos_sync       sync bookkeeping {v, user, family, since, sent, at, resetAt, base, tried}
   Synced keys: progress_<pageId>, noos_kid_<key>, noos_family (the noos.stores key check). Never sent (wire): a kid store's
   daily quest, and the family store's per-device fields (launch, lastExport, sound, jarCelebrated). Pull: rows of
   noos.stores with updated_at newer than `since` minus OVERLAP_MS, `since` being the newest server updated_at seen in a pull
   (never a device clock). The overlap catches a row whose transaction started before `since` and committed after the pull
   that moved it (the server stamps updated_at at transaction start); a row pulled again merges to what the device holds and
   is not pushed back. A row whose updated_at is not a server time is skipped (not merged, not the cursor). Push: keys whose
   merged value differs from what the server holds as far as this device knows (`sent`, a fingerprint per key). The push is
   conditional (W5b), never a blind upsert: a key whose row this device has seen is updated only where the row still has the
   updated_at this device last pulled or received for it (`at`, the server's own string), and zero rows back means another
   device wrote it since; a key it has never seen is inserted (all such keys in one request), and a unique violation means a
   row exists now. On a conflict nothing of that key is written: the cycle pulls those rows again (whatever their time),
   merges and pushes them again, MAX_ROUNDS rounds at most, then fails ('conflict') into the usual backoff. The server sets
   updated_at and the answer's value is kept in `at`. Requests per cycle: the pull, one insert for all new keys, one
   update per changed known key, then the schedule (its pull and one write per pending edit); a conflict adds a keyed pull
   and its writes. `since` moves only with full pulls: a push's updated_at must not move it, or a row another device wrote
   between this device's pull and push would never be pulled. A store that fails Rewards.storeValid is never sent (every
   other device would drop the row): the cycle ends 'failed' with error 'invalid', with no timer.

   Merge (W5): Rewards.syncMerge, which gives both devices the same store whatever the order (no value pushed back and
   forth) and settles the parent settings (unlocked, testDates, jarGoal, jarReward) three-way against `base`, the settled
   fields of each key as the server held them when this device last pulled or pushed it (Rewards.syncBase). useMerge(fn)
   replaces it (tests); fn(local, remote, {resetAt, base}) returns {data, changed}. A write whose answer never came is
   settled through the write ids (`_w`, `tried`, see mark()). After a sign-out there is no base: the next merge takes the
   cloud's settled fields where the cloud row has them.
   Reset stamps (W5, see Rewards.RESET): a progress store's `_reset.at` is sent as noos.stores.reset_at with every push (every
   pushed row carries reset_at, null for the others, so a batch has one set of columns). A pulled progress row stands for
   the later of its data stamp and its reset_at; a stamp more than Rewards.RESET_SKEW_MS ahead of the row's updated_at (a
   device clock far ahead) counts as that updated_at, which is the same value on every device; the device that pushed such
   a stamp caps its own copy the same way when the response comes back, and when that answer was lost, at its next pull of
   the row (the row still carrying its raw stamp gives the capped value; a row rewritten since carries it already).
   W4 seam (schedule table): client(), familyId(), on().
   A store larger than the noos.stores check (MAX_DATA bytes as jsonb text) is not sent: the cycle ends 'failed' with error
   'size' for the parent area and is not retried on a timer (the other keys still go); a 23514 (check violation) from the
   server is treated the same way. A pull is one request: the server's row cap (PostgREST max-rows, 1000 on Supabase) is far
   above the keys one family has (one per page played, one per kid, one family store), so the response is never cut.

   Schedule (W4), in the same cycle after the stores: every noos.schedule row of the family is pulled (a few rows: one per
   kid and subject), checked (Rewards.scheduleKeyOk and a server timestamp) and written to the device copy
   (Rewards.SCHEDULE_KEY, outside KEY_RE: never synced through stores, never in the backup code). Last write wins by the
   SERVER updated_at, never a device clock: an entry with no pending edit takes the row; a pending edit (setSchedule, the
   hub's editor) is kept while the row is not newer than the server updated_at the edit was based on (`at`), and dropped for
   a newer row (another device wrote after it). Pending edits are then written conditionally, as the stores (W5b): an
   update of the row version the edit was based on, or an insert when there was no row; a conflict pulls and applies the
   rule above again. The returned updated_at becomes their `at`. A pull that changes a unit emits {type: 'pulled', changed: [SCHEDULE_KEY]}.
   A write whose answer never came is marked on the entry (`sent`, its unit): a newer row carrying that unit is the
   device's own write, so a later pick stays pending on top of it instead of losing to it (W5c).
   Sign out (W5c) first sends what waits (a cycle, for at most SIGNOUT_WAIT_MS; offline it gives up at once), then moves
   the account generation on: a cycle still out stops at its next step and keeps nothing (no bookkeeping, no device write,
   no further request). It keeps the copy (the children keep their view) and drops the pending marks: an edit that could
   not be sent is not carried into whatever account signs in next, and the next pull restores the cloud's position. */
(function () {
  'use strict';

  const AUTH_KEY = 'noos_sync_auth';   // engine/rewards-ui.js SYNC_AUTH holds the same name (tests/sync.test.js checks)
  const BOOK_KEY = 'noos_sync';
  const SYNC_RE = /^(progress_[A-Za-z0-9_-]{1,64}|noos_kid_[A-Za-z0-9_-]{1,32}|noos_family)$/;   // = noos.stores key check
  const URL_RE = /^https:\/\/[A-Za-z0-9.-]+(:\d{1,5})?\/?$/;
  const VENDOR = 'engine/vendor/supabase.js?v=f2d5458a1a';
  const DEBOUNCE_MS = 3000;
  const BACKOFF_MS = [5000, 15000, 60000, 300000];   // then every 5 minutes while the page is open
  const OVERLAP_MS = 2 * 60 * 1000;   // pull window before `since`: longer than any write transaction lasts (statement timeout)
  const MAX_DATA = 262144;            // = the noos.stores check octet_length(data::text) <= 262144
  const MAX_ROUNDS = 3;               // pull, merge, push rounds per cycle while pushes meet newer rows; then the backoff
  const DEVICE_FIELDS = ['launch', 'lastExport', 'sound', 'jarCelebrated'];   // of noos_family: per device, never sent
  const CLIENT_OPTS = Object.freeze({
    db: { schema: 'noos' },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_KEY },
  });

  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const isObj = x => typeof x === 'object' && x !== null && !Array.isArray(x);
  const isStr = x => typeof x === 'string';
  const synced = k => isStr(k) && SYNC_RE.test(k);

  // Pure: sync is on only with an https project URL (host only) and a non-empty key.
  function configured(c) {
    return isObj(c) && isStr(c.url) && URL_RE.test(c.url.trim()) && isStr(c.key) && c.key.trim() !== '';
  }

  // ---- fingerprints: canonical JSON (sorted keys) hashed to 53 bits (cyrb53) ----
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (isObj(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function fp(v) {
    const s = canon(v);
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  // The value as sent: a kid store without its daily quest (rebuilt each day on each device, never imported by mergeAll),
  // the family store without its per-device fields (the day this device started, its last backup export, its sound
  // switch, the jar it last celebrated).
  function wire(key, v) {
    if (key.startsWith('noos_kid_') && own(v, 'quest')) { const out = { ...v }; delete out.quest; return out; }
    if (key === 'noos_family' && DEVICE_FIELDS.some(f => own(v, f))) { const out = { ...v }; for (const f of DEVICE_FIELDS) delete out[f]; return out; }
    return v;
  }

  // Bytes of `v` as Postgres prints jsonb (the noos.stores size check): JSON with a space after each ':' and ','.
  // shortcut: strings and numbers are counted as JSON.stringify prints them, which jsonb matches for the values noos stores
  // (plain numbers, short strings); the 23514 path in once() still covers a miss. Make it exact if a store nears the limit.
  const utf8 = s => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : unescape(encodeURIComponent(s)).length);
  function jsonbBytes(v) {
    if (Array.isArray(v)) return v.length ? 2 * v.length + v.reduce((a, x) => a + jsonbBytes(x), 0) : 2;
    if (isObj(v)) { const ks = Object.keys(v); return ks.length ? 4 * ks.length + ks.reduce((a, k) => a + utf8(JSON.stringify(k)) + jsonbBytes(v[k]), 0) : 2; }
    return utf8(JSON.stringify(v === undefined ? null : v));
  }

  // Server timestamps compared as instants with microseconds (PostgREST gives e.g. 2026-11-18T09:00:00.123456+00:00).
  // NaN for anything else.
  const TS_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6})\d*)?(Z|[+-]\d{2}(?::?\d{2})?)$/;
  function tsVal(s) {
    const m = isStr(s) ? TS_RE.exec(s) : null;
    if (!m) return NaN;
    let off = m[4] === 'Z' ? 'Z' : m[4].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
    if (/^[+-]\d{2}$/.test(off)) off += ':00';
    const ms = Date.parse(m[1] + 'T' + m[2] + off);
    return isNaN(ms) ? NaN : ms * 1000 + Number((m[3] || '').padEnd(6, '0'));
  }

  // ---- module state (reset by boot) ----
  let R = null, cfg = null, factory = null, T = null;
  let clientP = null, clientObj = null, authSub = null;
  let user = null;            // {id, email} once the session is confirmed by the client
  let st = null;              // the public state, see state()
  let book = null;            // bookkeeping, see BOOK_KEY
  let mergeFn = null;
  let debounce = null, retry = null, attempts = 0, running = null, again = false, signingOut = false;
  // The account generation: boot and signOut move it on. A cycle remembers the one it started in and checks it after every
  // await (live()); from another generation it stops there, writes nothing on the device and sends no further request.
  let gen = 0;
  const SIGNOUT_WAIT_MS = 4000;   // signOut first sends what waits, for at most this long, then signs out anyway
  const listeners = new Set();

  const fresh = id => ({ v: 1, user: id || null, family: null, since: null, sent: {}, at: {}, resetAt: {}, base: {}, tried: {} });
  function loadBook() {
    const b = R.load(BOOK_KEY);
    if (!isObj(b) || b.v !== 1) return fresh(null);
    const out = fresh(isStr(b.user) ? b.user : null);
    if (isStr(b.family)) out.family = b.family;
    if (isStr(b.since) && !isNaN(tsVal(b.since))) out.since = b.since;
    for (const f of ['sent', 'at', 'resetAt']) if (isObj(b[f])) for (const k of Object.keys(b[f])) if (synced(k) && (isStr(b[f][k]) || b[f][k] === null)) out[f][k] = b[f][k];
    // a base is a partial store of its key (the settled fields only): checked as one, so a broken entry is just no base
    if (isObj(b.base)) for (const k of Object.keys(b.base)) if (synced(k) && R.storeValid(k, b.base[k])) out.base[k] = b.base[k];
    if (isObj(b.tried)) for (const k of Object.keys(b.tried)) { const t = b.tried[k]; if (synced(k) && isObj(t) && isStr(t.id) && R.storeValid(k, t.fields)) out.tried[k] = t; }
    return out;
  }
  // Records what the server holds for key k as far as this device knows: its fingerprint, and its settled fields.
  function known(k, data) {
    const w = wire(k, data), b = R.syncBase(k, w);
    book.sent[k] = fp(w);
    if (b) book.base[k] = b; else delete book.base[k];
    delete book.tried[k];
  }
  // Write ids (kid and family stores, the ones with settled fields): a push that changes the settled fields puts a new id
  // first in the store's `_w` list (the last CHAIN ids, newest first); any other push keeps the row's list (W5c). Every
  // write is based on the row as it was (conditional push), so the list a row holds names every settings write in its
  // history, and ordinary pushes (answers) never push an id out. `tried` {key: {id, fields}} is set just before a write request and
  // cleared when its answer comes (or the next pull of the key is merged): a mark that stays is a write whose answer
  // never came. At the next pull, its id in the row's list means it committed, so its settled fields are the base of
  // that merge (a change made here after it is a local change, a change made elsewhere after it a remote one); its id
  // missing means it never committed, and the base stays.
  const CHAIN = 16;
  const chainOf = v => (isObj(v) && Array.isArray(v._w) ? v._w.filter(isStr) : []);
  const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  function mark(xs) {
    for (const x of xs) {
      if (!x.id) continue;
      book.tried[x.key] = { id: x.id, fields: R.syncBase(x.key, x.data) };
      const cur = R.load(x.key);   // the device copy carries the same list, so it equals the row once written
      if (isObj(cur)) R.save(x.key, { ...cur, _w: x.data._w });
    }
    saveBook();   // before the request: a page closed meanwhile keeps the mark
  }

  // The reset stamp a pulled progress row stands for (a string, or null): the later of its data stamp and its reset_at
  // column, each counted as the row's updated_at when it is more than Rewards.RESET_SKEW_MS ahead of it.
  function rowStamp(r) {
    const u = tsVal(r.updated_at), skew = R.RESET_SKEW_MS * 1000;
    const cap = s => { const v = R.stampVal(s); return isNaN(v) ? null : !isNaN(R.stampVal(r.updated_at)) && v > u + skew ? { s: r.updated_at, v: u } : { s, v }; };
    const d = cap(isObj(r.data[R.RESET]) ? r.data[R.RESET].at : null), c = cap(r.reset_at);
    return (d && c ? (c.v > d.v ? c : d) : d || c || { s: null }).s;
  }
  const stampIn = (k, w) => (k.startsWith('progress_') && isObj(w[R.RESET]) && !isNaN(tsVal(w[R.RESET].at)) ? w[R.RESET].at : null);
  const saveBook = () => R.save(BOOK_KEY, book);

  function emit(ev) {
    for (const f of [...listeners]) { try { f(ev); } catch (e) { /* a listener never breaks sync */ } }
  }
  function set(patch) {
    Object.assign(st, patch);
    emit({ type: 'state', state: state() });
  }

  function state() {
    return { status: st.status, expired: st.expired, email: st.email, family: st.family, sync: st.sync, error: st.error, pending: st.status === 'signedIn' ? pending().length + schedPending().length : 0 };
  }

  // ---- schedule (W4) ----
  const SCHED_COLS = 'kid_key,subject,current_unit,updated_at';
  // A pulled row as {kid, subject, unit, at}, or null when any column fails the table's checks or the timestamp is not a
  // server one. Other columns are ignored.
  function schedRow(r) {
    if (!isObj(r) || !R.scheduleKeyOk(r.kid_key, r.subject, r.current_unit) || isNaN(tsVal(r.updated_at))) return null;
    return { kid: r.kid_key, subject: r.subject, unit: r.current_unit, at: r.updated_at };
  }
  // The pending edits of the device copy: [{kid, subject, unit}].
  function schedPending(cache) {
    if (!R || typeof R.scheduleCache !== 'function') return [];
    const c = cache || R.scheduleCache(), out = [];
    for (const kid of Object.keys(c.kids)) for (const subject of Object.keys(c.kids[kid])) {
      const e = c.kids[kid][subject];
      if (e.pending) out.push({ kid, subject, unit: e.unit });
    }
    return out;
  }
  const waiting = () => pending().length + schedPending().length;
  const entry = (c, kid, subject) => (own(c.kids, kid) && own(c.kids[kid], subject) ? c.kids[kid][subject] : null);
  const put = (c, kid, subject, e) => { (own(c.kids, kid) ? c.kids[kid] : (c.kids[kid] = {}))[subject] = e; };

  // Pull, merge into the device copy, push the pending edits. Each read-modify-write of the copy runs with no await inside,
  // so an edit made while a request is out is never overwritten. A pending edit based on a row (`at`) updates only that row
  // version (the updated_at filter; zero rows back: a newer row exists); an edit with no row behind it is inserted (a unique
  // violation: a row exists now). On either conflict nothing of it is written and the round runs again: the pull then
  // applies W4's rule (a row newer than the edit's base wins), at most MAX_ROUNDS rounds, then the usual backoff.
  async function schedSync(c, fid, live) {
    for (let round = 1; ; round++) {
      if (!(await schedRound(c, fid, live))) return;
      if (round >= MAX_ROUNDS) throw new SyncError('conflict');
    }
  }
  // One round; true when a push met a newer row.
  async function schedRound(c, fid, live) {
    const { data, error } = await c.from('schedule').select(SCHED_COLS).eq('family_id', fid);
    live();
    if (error) throw error;
    if (!Array.isArray(data)) throw new SyncError('server');
    let cache = R.scheduleCache(), moved = false;
    const rows = new Set();
    for (const raw of data) {
      const r = schedRow(raw);
      if (!r) continue;
      rows.add(r.kid + '|' + r.subject);
      const e = entry(cache, r.kid, r.subject), base = e ? tsVal(e.at) : NaN;
      // a newer row carrying the unit this device sent in a write whose answer never came (`sent`) is that write: the
      // pending edit is now based on it (and is done when it is that unit), not dropped as another device's newer row
      if (e && e.pending && e.sent === r.unit && !(tsVal(r.at) <= base)) {
        put(cache, r.kid, r.subject, e.unit === r.unit ? { unit: r.unit, at: r.at, pending: false } : { unit: e.unit, at: r.at, pending: true });
        continue;
      }
      if (e && e.pending && !isNaN(base) && !(tsVal(r.at) > base)) {   // the edit is based on this row or a newer one
        if (r.at !== e.at) put(cache, r.kid, r.subject, { ...e, at: r.at });   // an older row (a server that lost data): the update is based on it
        continue;
      }
      if (e && !e.pending && e.unit === r.unit && e.at === r.at) continue;
      if (!e || e.unit !== r.unit) moved = true;
      put(cache, r.kid, r.subject, { unit: r.unit, at: r.at, pending: false });
    }
    // a pending edit based on a row the server no longer has: inserted
    for (const x of schedPending(cache)) if (cache.kids[x.kid][x.subject].at && !rows.has(x.kid + '|' + x.subject)) cache.kids[x.kid][x.subject].at = null;
    R.save(R.SCHEDULE_KEY, cache);
    if (moved) emit({ type: 'pulled', changed: [R.SCHEDULE_KEY], state: state() });
    let conflict = false;
    // `sent` on the entry: the unit of the write about to go, until its answer comes (see the pull above)
    const mark = (x, unit) => { const m = R.scheduleCache(), me = entry(m, x.kid, x.subject); if (!me) return; if (unit) me.sent = unit; else delete me.sent; R.save(R.SCHEDULE_KEY, m); };
    for (const x of schedPending(cache)) {
      live();
      const base = cache.kids[x.kid][x.subject].at;
      mark(x, x.unit);
      const res = base
        ? await c.from('schedule').update({ current_unit: x.unit }).eq('family_id', fid).eq('kid_key', x.kid).eq('subject', x.subject).eq('updated_at', base).select(SCHED_COLS)
        : await c.from('schedule').insert([{ family_id: fid, kid_key: x.kid, subject: x.subject, current_unit: x.unit }]).select(SCHED_COLS);
      live();
      if (res.error && !base && res.error.code === '23505') { mark(x, null); conflict = true; continue; }   // answered: not written
      if (res.error) throw res.error;
      const r = (Array.isArray(res.data) ? res.data : []).map(schedRow).find(y => y && y.kid === x.kid && y.subject === x.subject);
      if (!r) { mark(x, null); conflict = true; continue; }
      const now = R.scheduleCache(), e = entry(now, r.kid, r.subject);
      // the server holds r.unit as of r.at; an edit made while the request was out stays pending, now based on r.at
      if (e) { put(now, r.kid, r.subject, { unit: e.unit, at: r.at, pending: e.pending && e.unit !== r.unit }); R.save(R.SCHEDULE_KEY, now); }
    }
    return conflict;
  }

  // The hub's schedule editor: kid `kid` is now on unit `unit` of subject `subject`. Written to the device copy at once as a
  // pending edit (so the hub and its pages follow at once, online or not) and sent by a cycle started now. Only while signed
  // in; false when signed out, for keys that fail the table's checks, and when the copy already holds that unit.
  function setSchedule(kid, subject, unit) {
    if (!cfg || !st || st.status !== 'signedIn' || !R.scheduleKeyOk(kid, subject, unit)) return false;
    const cache = R.scheduleCache(), e = entry(cache, kid, subject);
    if (e && e.unit === unit) return false;
    put(cache, kid, subject, { unit, at: e ? e.at : null, pending: true, ...(e && e.pending && e.sent ? { sent: e.sent } : {}) });   // a lost write's mark stays
    R.save(R.SCHEDULE_KEY, cache);
    set({ sync: st.sync === 'failed' ? 'failed' : 'pending' });
    cycle();
    return true;
  }

  // The stores this device holds that are synced, as plain objects.
  function localSynced() {
    const all = R.localData(), out = {};
    for (const k of Object.keys(all)) if (synced(k) && isObj(all[k])) out[k] = all[k];
    return out;
  }
  // Keys whose device value differs from what the server holds as far as this device knows: the offline queue.
  function pending() {
    if (!R || !book) return [];
    const loc = localSynced();
    return Object.keys(loc).filter(k => book.sent[k] !== fp(wire(k, loc[k])));
  }

  // ---- client ----
  function addScript(src) {
    return new Promise((res, rej) => {
      if (typeof document === 'undefined') { rej(new Error('no document')); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => res();
      s.onerror = () => rej(new Error('script failed'));
      (document.head || document.documentElement).appendChild(s);
    });
  }
  // Default factory (browser): the vendored UMD build defines window.supabase.
  async function vendorFactory(url, key, options) {
    if (!(typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function')) await addScript(VENDOR);
    if (!(window.supabase && typeof window.supabase.createClient === 'function')) throw new Error('no client');
    return window.supabase.createClient(url, key, options);
  }
  function client() {
    if (!cfg) return Promise.reject(new Error('sync off'));
    if (!clientP) {
      clientP = Promise.resolve().then(() => factory(cfg.url.trim(), cfg.key.trim(), CLIENT_OPTS)).then(c => {
        clientObj = c;
        try {
          const r = c.auth.onAuthStateChange((event, session) => {
            // no client call inside the callback; the state change is enough
            if (event === 'SIGNED_OUT' && !signingOut && st.status === 'signedIn') expire();
            else if (session && session.user && user && session.user.id === user.id && isStr(session.user.email)) st.email = session.user.email;
          });
          authSub = r && r.data && r.data.subscription ? r.data.subscription : null;
        } catch (e) { authSub = null; }
        return c;
      });
      clientP.catch(() => { clientP = null; });   // a failed load (offline) is tried again next time
    }
    return clientP;
  }

  // ---- errors ----
  class SyncError extends Error {
    constructor(kind, cause) { super(kind); this.kind = kind; this.cause = cause; }
  }
  const isAuthErr = e => !!e && (e.status === 401 || /^PGRST30[1-3]$/.test(String(e.code || '')));
  const kindOf = e => (e instanceof SyncError ? e.kind : isAuthErr(e) ? 'auth' : !e || !e.status ? 'network' : 'server');

  function expire() {
    clearTimers();
    user = null;
    set({ status: 'signedOut', expired: true, email: null, family: null, sync: 'idle', error: null });
  }
  function clearTimers() {
    if (debounce) { T.clearTimeout(debounce); debounce = null; }
    if (retry) { T.clearTimeout(retry); retry = null; }
  }
  function scheduleRetry() {
    if (retry) T.clearTimeout(retry);
    const ms = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
    attempts++;
    retry = T.setTimeout(() => { retry = null; cycle(); }, ms);
  }

  // ---- one sync cycle: session, family, pull, merge, write, push ----
  async function ensureUser(c, live) {
    if (user) return user;
    let res;
    try { res = await c.auth.getSession(); } catch (e) { throw new SyncError('network', e); }
    live();
    const s = res && res.data ? res.data.session : null;
    if (!s || !s.user || !isStr(s.user.id)) {
      if (res && res.error && R.load(AUTH_KEY)) throw new SyncError('network', res.error);   // could not check: keep the session
      throw new SyncError('expired');
    }
    user = { id: s.user.id, email: isStr(s.user.email) ? s.user.email : null };
    if (book.user !== user.id) { book = fresh(user.id); saveBook(); }
    if (user.email && st.email !== user.email) st.email = user.email;
    return user;
  }

  async function ensureFamily(c, live) {
    if (book.family) return book.family;
    const { data, error } = await c.from('families').select('id').eq('owner', user.id).limit(1);
    live();
    if (error) throw error;
    const row = Array.isArray(data) ? data.find(r => isObj(r) && isStr(r.id)) : null;
    if (!row) return null;
    book.family = row.id;
    saveBook();
    return row.id;
  }

  // One round of the stores: pull (rows newer than `since` minus OVERLAP_MS; with `keys`, only those rows, whatever their
  // time), merge and write on the device, then push. Returns the keys whose push met a newer row (written by another
  // device after this device last saw it): nothing of those was written, and the caller runs a round for them again.
  async function storesRound(c, fid, keys, acc, live) {
    let q = c.from('stores').select('key,data,updated_at,reset_at').eq('family_id', fid);
    if (keys) q = q.in('key', keys);
    else if (book.since) q = q.gt('updated_at', new Date(Math.floor(tsVal(book.since) / 1000) - OVERLAP_MS).toISOString());
    const { data: rows, error } = await q;
    live();
    if (error) throw error;
    if (!Array.isArray(rows)) throw new SyncError('server');
    const remote = {}, raw = {}, seen = {}, resetAt = {}, local = localSynced(), fixed = [];
    let since = book.since, sinceV = tsVal(book.since);
    for (const r of rows) {
      if (!isObj(r) || !synced(r.key)) continue;
      const v = tsVal(r.updated_at);
      if (isNaN(v)) continue;   // not a server time: never merged, never the cursor, never the base of a write
      if (!keys && !(v <= sinceV)) { since = r.updated_at; sinceV = v; }
      seen[r.key] = r.updated_at;   // a row that fails the checks is seen too, so a valid device value can replace it
      if (!R.storeValid(r.key, r.data)) continue;   // never merged
      raw[r.key] = remote[r.key] = r.data;
      resetAt[r.key] = isStr(r.reset_at) ? r.reset_at : null;
      if (!r.key.startsWith('progress_')) continue;
      const s = rowStamp(r);   // the row's stamp, in its data, as the merge reads it
      if (s !== null && !(isObj(r.data[R.RESET]) && r.data[R.RESET].at === s)) remote[r.key] = { ...r.data, [R.RESET]: { at: s } };
      // this device's own stamp from a clock far ahead whose push answer was lost (so not capped on the answer): the row
      // still carrying it gives the capped value every device computes; a row rewritten since this device last saw it
      // carries that value already (or a later reset), which the device then takes
      const L = local[r.key] ? stampIn(r.key, local[r.key]) : null;
      if (L === null || !(tsVal(L) > v + R.RESET_SKEW_MS * 1000)) continue;
      const mine = [isObj(r.data[R.RESET]) ? r.data[R.RESET].at : null, r.reset_at].some(x => R.stampVal(x) === tsVal(L));
      const to = mine ? s : s !== null && R.stampVal(s) > tsVal(book.at[r.key]) ? s : null;
      if (to !== null && to !== L) { local[r.key] = { ...local[r.key], [R.RESET]: { ...local[r.key][R.RESET], at: to } }; fixed.push(r.key); }
    }

    // merge and write on the device (nothing was written before this point)
    const base = { ...book.base };
    for (const k of Object.keys(remote)) { const t = book.tried[k]; if (t && chainOf(raw[k]).includes(t.id)) base[k] = t.fields; }   // that write committed
    const merged = mergeFn(local, remote, { resetAt, base });
    if (!merged || !isObj(merged.data) || !Array.isArray(merged.changed)) throw new SyncError('merge');
    const changed = [];
    for (const k of new Set([...merged.changed, ...fixed])) if (synced(k) && isObj(merged.data[k])) { R.save(k, merged.data[k]); changed.push(k); }
    for (const k of Object.keys(seen)) book.at[k] = seen[k];
    for (const k of Object.keys(remote)) { known(k, raw[k]); book.resetAt[k] = resetAt[k]; }
    if (keys) { for (const k of keys) if (!own(seen, k)) { delete book.at[k]; delete book.sent[k]; delete book.base[k]; } }   // gone: inserted next
    else book.since = since;
    saveBook();
    acc.pulled.push(...Object.keys(remote)); acc.changed.push(...changed);
    if (changed.length) emit({ type: 'pulled', changed: changed.slice(), state: state() });

    // push: a key this device has seen on the server is updated only where the row still has the updated_at this device
    // last pulled or received for it (zero rows back: a conflict); a key it has never seen is inserted (a unique
    // violation: a conflict). The server time is sent back as the server gave it.
    const ins = [], upd = [], conflicts = [], capped = [];
    for (const k of Object.keys(merged.data)) {
      if (!synced(k) || !isObj(merged.data[k])) continue;
      const w = wire(k, merged.data[k]), f = fp(w);
      if (book.sent[k] === f) continue;
      if (!R.storeValid(k, w)) { acc.bad.add(k); continue; }   // every other device would drop the row, every time
      if (jsonbBytes(w) > MAX_DATA) { acc.big.add(k); continue; }   // the server would refuse it, every time
      const x = { key: k, data: w, reset_at: stampIn(k, w), f, id: null };
      // a new write id only for a push that changes the settled fields from what the server holds as far as this device
      // knows; any other push keeps the row's list as it is, so ordinary pushes never push a lost write's id out
      const sb = R.syncBase(k, w);
      if (sb && fp(sb) !== fp(own(book.base, k) ? book.base[k] : null)) { x.id = newId(); x.data = { ...w, _w: [x.id, ...chainOf(w)].slice(0, CHAIN) }; x.f = fp(x.data); }
      (isStr(book.at[k]) ? upd : ins).push(x);
    }
    const wrote = (x, r) => {
      known(x.key, x.data); book.resetAt[x.key] = x.reset_at; acc.pushed.push(x.key);
      if (!isObj(r) || !isStr(r.updated_at)) { delete book.at[x.key]; return; }   // no server time back: the next write conflicts and pulls
      book.at[x.key] = r.updated_at;
      // a stamp sent from a clock far ahead: this device's copy takes the row's updated_at, as every puller does
      const u = tsVal(r.updated_at);
      if (x.reset_at === null || isNaN(u) || !(tsVal(x.reset_at) > u + R.RESET_SKEW_MS * 1000)) return;
      const cur = R.load(x.key);   // read now: the device may have changed it while the request was out
      if (isObj(cur) && isObj(cur[R.RESET]) && cur[R.RESET].at === x.reset_at) { R.save(x.key, { ...cur, [R.RESET]: { ...cur[R.RESET], at: r.updated_at } }); capped.push(x.key); }
    };
    const failed = xs => { for (const x of xs) { delete book.tried[x.key]; conflicts.push(x.key); } };   // answered: not written
    if (ins.length) {
      mark(ins);
      const res = await c.from('stores').insert(ins.map(x => ({ family_id: fid, key: x.key, data: x.data, reset_at: x.reset_at }))).select('key,updated_at');
      live();
      if (res.error && res.error.code === '23505') failed(ins);   // a row of one of them exists now
      else if (res.error) throw res.error;
      else for (const x of ins) wrote(x, (Array.isArray(res.data) ? res.data : []).find(r => isObj(r) && r.key === x.key));
      saveBook();
    }
    for (const x of upd) {
      mark([x]);
      const res = await c.from('stores').update({ data: x.data, reset_at: x.reset_at }).eq('family_id', fid).eq('key', x.key).eq('updated_at', book.at[x.key]).select('key,updated_at');
      live();
      if (res.error) throw res.error;
      const r = Array.isArray(res.data) ? res.data.find(y => isObj(y) && y.key === x.key) : null;
      if (r) wrote(x, r); else failed([x]);
      saveBook();
    }
    if (capped.length) { again = true; emit({ type: 'pulled', changed: capped, state: state() }); }   // sent in a next cycle
    return conflicts;
  }

  async function once() {
    if (st.status !== 'signedIn') return { ok: false, error: 'signedOut' };
    const g = gen, live = () => { if (g !== gen) throw new SyncError('stale'); };
    set({ sync: 'syncing' });
    let c;
    try {
      c = await client();
      live();
      await ensureUser(c, live);
      const fid = await ensureFamily(c, live);
      if (!fid) { attempts = 0; set({ family: 'none', sync: 'idle', error: null }); return { ok: false, error: 'nofamily' }; }
      if (st.family !== 'ok') st.family = 'ok';

      // pull, merge, push; a push that meets a newer row (another device wrote after this device's pull) writes nothing of
      // that key, and the round runs again for those keys only, at most MAX_ROUNDS rounds per cycle
      const acc = { pulled: [], changed: [], pushed: [], big: new Set(), bad: new Set() };
      for (let round = 1, keys = null; ; round++) {
        const conflicts = await storesRound(c, fid, keys, acc, live);
        if (!conflicts.length) break;
        if (round >= MAX_ROUNDS) throw new SyncError('conflict');   // then the usual backoff
        keys = conflicts;
      }
      await schedSync(c, fid, live);
      attempts = 0;
      const big = [...acc.big], bad = [...acc.bad];
      set(big.length || bad.length ? { sync: 'failed', error: big.length ? 'size' : 'invalid' } : { sync: waiting() ? 'pending' : 'saved', error: null });
      return { ok: true, pulled: acc.pulled, changed: acc.changed, pushed: acc.pushed, big, bad };
    } catch (e) {
      if (g !== gen) return { ok: false, error: 'stale' };   // signed out (or booted) meanwhile: nothing of it is kept
      if (e && e.code === '23514' && st.status === 'signedIn') { set({ sync: 'failed', error: 'size' }); return { ok: false, error: 'size' }; }   // check violation: retrying cannot help
      const kind = kindOf(e);
      if (kind === 'expired') { expire(); return { ok: false, error: 'expired' }; }
      if (kind === 'auth' && c) {
        let s = null;
        try { const r = await c.auth.getSession(); s = r && r.data ? r.data.session : null; } catch (err) { s = 'unknown'; }
        if (!s) { expire(); return { ok: false, error: 'expired' }; }
      }
      if (st.status !== 'signedIn') return { ok: false, error: kind };
      set({ sync: 'failed', error: kind });
      scheduleRetry();
      return { ok: false, error: kind };
    }
  }

  // One cycle at a time; a trigger during a cycle runs one more after it.
  function cycle() {
    if (!st || st.status !== 'signedIn') return Promise.resolve({ ok: false, error: 'signedOut' });
    if (debounce) { T.clearTimeout(debounce); debounce = null; }
    if (running) { again = true; return running; }
    if (retry) { T.clearTimeout(retry); retry = null; }
    const p = (async () => {
      let res;
      do { again = false; res = await once(); } while (again && res.ok);
      return res;
    })().finally(() => { if (running === p) running = null; });   // a cycle dropped by signOut never clears the next one
    running = p;
    return p;
  }

  // ---- public API ----
  // opts: config (window.NOOS_SYNC), createClient(url, key, options) -> client or a promise of one (default: the vendored
  // build), rewards (default window.Rewards), timers {setTimeout, clearTimeout}, events (pagehide and online; default
  // window), doc (visibilitychange; default document). Never throws; returns state().
  function boot(opts) {
    const o = isObj(opts) ? opts : {};
    clearTimers();
    if (authSub) { try { authSub.unsubscribe(); } catch (e) { /* gone */ } }
    R = o.rewards || (typeof window !== 'undefined' ? window.Rewards : null);
    T = isObj(o.timers) ? o.timers : { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: id => clearTimeout(id) };
    factory = typeof o.createClient === 'function' ? o.createClient : vendorFactory;
    clientP = null; clientObj = null; authSub = null; user = null; running = null; again = false; attempts = 0; signingOut = false; gen++;
    mergeFn = (l, r, m) => R.syncMerge(l, r, m);
    listeners.clear();
    cfg = configured(o.config) && R ? o.config : null;
    st = { status: 'off', expired: false, email: null, family: null, sync: 'idle', error: null };
    if (!cfg) { book = null; return state(); }
    book = loadBook();
    const sess = R.load(AUTH_KEY);
    if (sess) {
      const u = isObj(sess.user) ? sess.user : null;
      st.status = 'signedIn';
      st.email = u && isStr(u.email) ? u.email : null;
      cycle();   // pull on load; the session is confirmed (or found expired) by the client inside the cycle
    } else st.status = 'signedOut';
    const ev = o.events || (typeof window !== 'undefined' ? window : null);
    const doc = o.doc || (typeof document !== 'undefined' ? document : null);
    try {
      if (ev) {
        ev.addEventListener('pagehide', () => flush());
        ev.addEventListener('online', () => { if (st.status === 'signedIn' && (retry || st.sync === 'failed')) { attempts = 0; cycle(); } });
      }
      if (doc) doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'hidden') flush(); });
    } catch (e) { /* no events: the debounce and the next page load still sync */ }
    return state();
  }

  // Resolves {ok: true} or {ok: false, error: 'off' | 'busy' | 'empty' | 'credentials' | 'network' | 'other'}. The
  // password lives only in this call; it is never stored, logged or put in a URL.
  async function signIn(email, password) {
    if (!cfg) return { ok: false, error: 'off' };
    if (st.status === 'signedIn' || st.busy) return { ok: false, error: 'busy' };
    const mail = isStr(email) ? email.trim() : '';
    if (!mail || !isStr(password) || !password) return { ok: false, error: 'empty' };
    st.busy = true;
    try {
      let c;
      try { c = await client(); } catch (e) { return { ok: false, error: 'network' }; }
      let res;
      try { res = await c.auth.signInWithPassword({ email: mail, password }); } catch (e) { return { ok: false, error: 'network' }; }
      const err = res && res.error, data = res && res.data;
      if (err) {
        if (err.name === 'AuthRetryableFetchError' || !err.status) return { ok: false, error: 'network' };
        if (err.code === 'invalid_credentials' || err.status === 400) return { ok: false, error: 'credentials' };
        return { ok: false, error: 'other' };
      }
      const u = data && (data.user || (data.session && data.session.user));
      if (!u || !isStr(u.id)) return { ok: false, error: 'other' };
      user = { id: u.id, email: isStr(u.email) ? u.email : mail };
      if (book.user !== user.id) { book = fresh(user.id); saveBook(); }
      attempts = 0;
      set({ status: 'signedIn', expired: false, email: user.email, family: null, sync: 'idle', error: null });
      cycle();   // first sign-in on this device: the same merge, stars never go down
      return { ok: true };
    } finally { st.busy = false; }
  }

  // Signs this device out only (scope local: the family's other devices stay signed in). The device stores stay; the
  // bookkeeping is cleared, so the next sign-in pulls everything again.
  async function signOut() {
    if (!cfg) return;
    // what waits (an edit inside the debounce, a cycle on its way) is sent first, for at most SIGNOUT_WAIT_MS; offline or
    // slow, the device signs out anyway (and the edit is lost on the device, see the next sign-in in Rewards.syncMerge)
    if (st && st.status === 'signedIn' && waiting()) {   // a cycle out or a debounce with nothing waiting has nothing to send
      let tid = null;
      await Promise.race([cycle().catch(() => null), new Promise(r => { tid = T.setTimeout(r, SIGNOUT_WAIT_MS); })]);
      if (tid !== null) T.clearTimeout(tid);
    }
    gen++; running = null; again = false;   // a cycle still out is dropped at its next step
    clearTimers();
    signingOut = true;
    try {
      const c = clientObj || (R.load(AUTH_KEY) ? await client().catch(() => null) : null);
      if (c) { try { await c.auth.signOut({ scope: 'local' }); } catch (e) { /* the local session goes first in the client */ } }
    } finally { signingOut = false; }
    user = null;
    book = fresh(null);
    saveBook();
    const sc = R.scheduleCache();
    if (schedPending(sc).length) {
      for (const x of schedPending(sc)) { sc.kids[x.kid][x.subject].pending = false; delete sc.kids[x.kid][x.subject].sent; }
      R.save(R.SCHEDULE_KEY, sc);
    }
    set({ status: 'signedOut', expired: false, email: null, family: null, sync: 'idle', error: null });
  }

  // After an answer or a parent's change: a cycle a few seconds later, only when something waits to be sent then. During a
  // cycle the timer is armed too (a change after the cycle read the device must not be lost); it does nothing when that
  // cycle already sent everything.
  function touch() {
    if (!st || st.status !== 'signedIn') return;
    if (!running && !waiting()) return;
    if (debounce) T.clearTimeout(debounce);
    debounce = T.setTimeout(() => { debounce = null; if (waiting()) cycle(); }, DEBOUNCE_MS);
    if (!running && st.sync !== 'pending' && st.sync !== 'failed') set({ sync: 'pending' });
  }

  // Page hidden or left: send now what waits (a cut-off cycle is finished by the next page load).
  function flush() {
    if (!st || st.status !== 'signedIn') return Promise.resolve(null);
    if (!debounce && !waiting()) return Promise.resolve(null);
    return cycle();
  }

  function on(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  const Sync = {
    AUTH_KEY, BOOK_KEY, VENDOR, DEBOUNCE_MS, BACKOFF_MS, CLIENT_OPTS, OVERLAP_MS, MAX_DATA, SIGNOUT_WAIT_MS,
    configured, synced, fp, wire, tsVal, jsonbBytes,
    boot, signIn, signOut, state, on, touch, flush,
    sync: () => cycle(),
    pending: () => pending(),
    idle: () => (running ? running.then(() => undefined) : Promise.resolve()),
    client: () => client(),
    familyId: () => (book && book.family) || null,
    setSchedule,
    schedulePending: () => schedPending(),
    // fn(local, remote, {resetAt, base}) -> {data, changed}; null restores Rewards.syncMerge
    useMerge: fn => { mergeFn = typeof fn === 'function' ? fn : (l, r, m) => R.syncMerge(l, r, m); },
  };
  if (typeof window !== 'undefined') window.Sync = Sync;
  if (typeof module !== 'undefined' && module.exports) module.exports = Sync;
})();
