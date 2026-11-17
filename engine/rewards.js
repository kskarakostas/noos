/* Reward scoring core. DOM-free: runs in the browser (window.Rewards) and in Node (module.exports). */
(function () {
  'use strict';

  const EXCLUDED = new Set(['mountq', 'times_r']);   // keys the hub never counted
  const RECENT = 20;      // answers kept in `r`
  const MIN_RECENT = 10;  // below this many recent answers, use lifetime ok/n
  const DAY_MIN = 10;     // answers that make a day count toward the streak
  const KEEP_DAYS = 60;   // day history kept per kid
  const JAR_GOAL = 30;    // default family jar goal, in stars
  const QUEST_TASKS = 3;  // tasks in a daily quest
  const QUEST_HITS = 5;   // right answers a hit task asks for
  const QUEST_CARDS = 5;  // new known flashcards a `cards` task asks for, at most
  const LOW_BELOW = 0.5;  // a row under this value, with enough answers, is flagged low (fixer)
  const LOW_MIN_ANSWERS = 5;
  const MASTERED = 0.9;    // row value of 3 stars; the weekly note lists only rows under it
  const EARLY_BEFORE = 8 * 60 + 30;  // 'early' badge: minutes after local midnight
  const COMEBACK_DAYS = 7;           // 'comeback' badge: days since the previous active day
  const LEVELS = [[0, 'Μαθητευόμενος'], [15, 'Εξερευνητής'], [40, 'Ειδικός'], [80, 'Θρύλος']];

  function pushResult(rec, ok) {
    rec.n = (rec.n || 0) + 1;
    rec.ok = (rec.ok || 0) + (ok ? 1 : 0);
    rec.r = ((rec.r || '') + (ok ? '1' : '0')).slice(-RECENT);
    return rec;
  }

  // 0..1 or null. Anything that is not 'hit' is a list row, as in Engine._makePG.
  // A corrupt record (non-numeric fields) gives null, never NaN; a non-string `r` counts as empty.
  function rowValue(rec, type) {
    if (!rec) return null;
    let v = null;
    if (type === 'hit') {
      if (!rec.n) return null;
      const r = typeof rec.r === 'string' ? rec.r : '';
      v = r.length < MIN_RECENT ? rec.ok / rec.n : (r.split('1').length - 1) / r.length;
    } else if (rec.total) v = (rec.list || []).length / rec.total;
    return Number.isFinite(v) ? v : null;
  }

  function starsFor(rec, type) {
    const v = rowValue(rec, type);
    if (v === null) return 0;
    if (type === 'hit' && rec.n < 5) return 0;
    if (v >= 0.9 && !(type === 'hit' && rec.n < 10)) return 3;
    if (v >= 0.7) return 2;
    if (v >= 0.5) return 1;
    return 0;
  }

  function bumpBest(rec, type) {
    const from = Number.isFinite(rec.best) ? rec.best : 0;
    rec.best = Math.max(from, starsFor(rec, type));
    let hiRaised = false;
    if (type !== 'hit') {
      const len = (rec.list || []).length, prev = rec.hi || 0;
      hiRaised = prev > 0 && len > prev;   // the first play sets hi; only beating an earlier hi is a record
      rec.hi = Math.max(prev, len);
    }
    return { from, to: rec.best, hiRaised };
  }

  const counted = key => key.charAt(0) !== '_' && !EXCLUDED.has(key);
  const countedRows = rows => rows.filter(r => counted(r[0]));

  function pageStars(progress, rows) {
    const p = progress || {};
    let sum = countedRows(rows).reduce((a, r) => a + ((p[r[0]] && p[r[0]].best) || 0), 0);
    if (p._boss && p._boss.won) sum += 3;
    return sum;
  }

  // Mean row value (recent accuracy). With rows null, every counted key counts and the
  // row type is read off the record, which is what the hub did before.
  function pagePct(progress, rows) {
    if (!progress) return null;
    const pairs = rows
      ? countedRows(rows).map(r => [progress[r[0]], r[2]])
      : Object.keys(progress).filter(counted).map(k => [progress[k], progress[k] && progress[k].n ? 'hit' : 'list']);
    let sum = 0, cnt = 0;
    for (const [rec, type] of pairs) {
      const v = rowValue(rec, type);
      if (v !== null) { sum += v; cnt++; }
    }
    return cnt ? sum / cnt : null;
  }

  // Dates are local 'YYYY-MM-DD' strings. Built from parts with new Date(y, m-1, d), never parsed as UTC.
  const pad = n => (n < 10 ? '0' : '') + n;
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const local = (day, n = 0) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d + n); };
  const addDays = (day, n) => dayKey(local(day, n));
  // Whole days from a to b; rounding absorbs the 23h or 25h days around a DST change.
  const diffDays = (a, b) => Math.round((local(b) - local(a)) / 86400000);

  // ISO 8601 week: the week belongs to the year of its Thursday.
  function isoWeek(day) {
    const thu = local(day, 3 - ((local(day).getDay() + 6) % 7));
    const yr = thu.getFullYear();
    const doy = Math.round((thu - new Date(yr, 0, 1)) / 86400000);
    return yr + '-W' + pad(Math.floor(doy / 7) + 1);
  }

  // unlocked: {pageId: day} pages a parent unlocked ahead of the class on this device (timed release, see planState).
  const newKid = () => ({ days: {}, badges: {}, freezes: {}, bonus: {}, quest: null, testDates: {}, questsDone: 0, unlocked: {} });

  // Own-property lookups only, so a key such as 'toString' or 'constructor' never reaches the prototype.
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function dayRec(kid, day) {
    const d = own(kid.days, day) ? kid.days[day] : (kid.days[day] = {});
    d.ok = d.ok || 0; d.n = d.n || 0; d.stars = d.stars || 0; d.acts = d.acts || {};
    return d;
  }

  function logAnswer(kid, day, actId, ok) {
    const d = dayRec(kid, day);
    const a = own(d.acts, actId) ? d.acts[actId] : (d.acts[actId] = { ok: 0, n: 0 });
    d.n++; a.n++;
    if (ok) { d.ok++; a.ok++; }
    const cutoff = addDays(day, -KEEP_DAYS);
    for (const k of Object.keys(kid.days)) if (k < cutoff) delete kid.days[k];
    return kid;
  }

  function logStars(kid, day, k) {
    dayRec(kid, day).stars += k;
    return kid;
  }

  // Walk back from today (or from yesterday while today is not counted yet); the start day may itself be a miss.
  // A miss is covered by a freeze when its ISO week has no covered miss yet; the first uncovered miss ends the walk.
  // `frozen` holds the covered misses between the start and the oldest counted day reached; misses past it are
  // dropped, and with no counted day reached the result is 0.
  function streak(kid, today) {
    const counted = d => own(kid.days, d) && kid.days[d].n >= DAY_MIN;
    let day = counted(today) ? today : addDays(today, -1);
    let count = 0, gap = [];
    const frozen = [], usedWeeks = new Set();
    for (;;) {
      if (counted(day)) { count++; frozen.unshift(...gap); gap = []; }
      else {
        const wk = isoWeek(day);
        if (usedWeeks.has(wk)) break;
        usedWeeks.add(wk); gap.unshift(day);
      }
      day = addDays(day, -1);
    }
    return { count, frozen };
  }

  function level(stars) {
    const s = Math.max(0, Number(stars) || 0);
    let idx = 0;
    LEVELS.forEach((l, i) => { if (s >= l[0]) idx = i; });
    const next = idx + 1 < LEVELS.length ? LEVELS[idx + 1][0] : null;
    return { idx, name: LEVELS[idx][1], next, frac: next === null ? 1 : (s - LEVELS[idx][0]) / (next - LEVELS[idx][0]) };
  }

  function jar(totalStars, fam) {
    const f = fam || {};
    const fill = Math.max(0, (Number(totalStars) || 0) - (Number(f.jarBase) || 0) - (Number(f.jarSpent) || 0));
    const goal = Number(f.jarGoal) || JAR_GOAL;
    return { fill, goal, full: fill >= goal };
  }

  // Whole days from today to target (0 = today); null when target is missing, malformed or in the past.
  function daysUntil(today, target) {
    if (!target) return null;
    const n = diffDays(today, target);
    return n >= 0 ? n : null;
  }

  // Badge wall data: Greek name and one-line description, original emoji (no brand characters).
  // fire10/fire20 and days3/days7/days30 and quest1/quest10 share one spec name; the desc tells them apart.
  const BADGES = [
    { id: 'first_star', name: 'Πρώτο αστέρι', emo: '🌟', secret: false, desc: 'Πήρες το πρώτο σου αστέρι!' },
    { id: 'page_full', name: 'Γεμάτη σελίδα', emo: '📗', secret: false, desc: 'Όλες οι δραστηριότητες μιας σελίδας έχουν 3 αστέρια.' },
    { id: 'explorer', name: 'Εξερευνητής', emo: '🧭', secret: false, desc: 'Έπαιξες όλες τις δραστηριότητες μιας σελίδας.' },
    { id: 'cards_all', name: 'Ξέρω όλες τις κάρτες', emo: '🃏', secret: false, desc: 'Ξέρεις όλες τις κάρτες μιας σελίδας.' },
    { id: 'fire10', name: 'Φλογερό σερί', emo: '🔥', secret: false, desc: '10 σωστές στη σειρά σε μια δραστηριότητα.' },
    { id: 'fire20', name: 'Φλογερό σερί', emo: '🌋', secret: false, desc: '20 σωστές στη σειρά σε μια δραστηριότητα.' },
    { id: 'fixer', name: 'Διορθωτής', emo: '🔧', secret: false, desc: 'Ανέβασες μια δραστηριότητα από κάτω από 50% σε 90% ή περισσότερο.' },
    { id: 'days3', name: 'Σταθερός μαθητής', emo: '🌱', secret: false, desc: 'Εξασκήθηκες 3 μέρες στη σειρά.' },
    { id: 'days7', name: 'Σταθερός μαθητής', emo: '🌿', secret: false, desc: 'Εξασκήθηκες 7 μέρες στη σειρά.' },
    { id: 'days30', name: 'Σταθερός μαθητής', emo: '🌳', secret: false, desc: 'Εξασκήθηκες 30 μέρες στη σειρά.' },
    { id: 'quest1', name: 'Κυνηγός αποστολών', emo: '🎯', secret: false, desc: 'Ολοκλήρωσες την πρώτη σου καθημερινή αποστολή.' },
    { id: 'quest10', name: 'Κυνηγός αποστολών', emo: '🏹', secret: false, desc: 'Ολοκλήρωσες 10 καθημερινές αποστολές.' },
    { id: 'boss1', name: 'Νικητής τεράτων', emo: '🏆', secret: false, desc: 'Νίκησες ένα Τελικό τέρας.' },
    { id: 'record', name: 'Ρεκόρ!', emo: '🚀', secret: false, desc: 'Έσπασες το ρεκόρ σου σε ένα παιχνίδι.' },
    { id: 'early', name: 'Πρωινό πουλί', emo: '🐦', secret: true, desc: 'Διάβασες πριν από τις 08:30 το πρωί.' },
    { id: 'comeback', name: 'Επιστροφή', emo: '🔄', secret: true, desc: 'Γύρισες μετά από 7 ή περισσότερες μέρες.' },
    { id: 'perfect', name: 'Τέλειος γύρος', emo: '💎', secret: true, desc: 'Ένας ολόκληρος γύρος χωρίς κανένα λάθος.' },
    { id: 'helper', name: 'Ομαδικό πνεύμα', emo: '🤝', secret: true, desc: 'Τα αστέρια σου γέμισαν το βάζο της οικογένειας.' },
  ];

  // Daily quest: the weakest activities first (never played = lowest), random tie-break, one per activity.
  // `rand` is drawn once per remaining candidate, in input order, before sorting, so a fixed rand keeps input order on ties.
  // A hit task needs QUEST_HITS right answers today. A list task needs the row to grow by its target: 1 for game
  // records, min(QUEST_CARDS, cards left) for the flashcards row `cards` (QUEST_CARDS when the total is unknown).
  // A list row already at 100% can never grow, so it is skipped (its task could never finish).
  // A candidate without a valid page file gives a task without a `file` key, so the task survives JSON unchanged.
  // Class plan (candidates carry `tier`, see questCands): the weakest current-page rows fill QUEST_TASKS minus one slot, the
  // weakest done-page row takes that slot (a review task), and when no done page has a candidate all slots go to current
  // pages. Slots current pages cannot fill go to done pages, then to pages missing from the plan (tier 'free'). Tasks are
  // listed in that order. Without any `tier` the selection is the plain weakest-first one.
  const questTarget = c => {
    if (c.type === 'hit') return QUEST_HITS;
    if (c.key !== 'cards') return 1;
    const left = isNum(c.total) && c.total > 0 ? c.total - (c.len || 0) : QUEST_CARDS;
    return Math.max(1, Math.min(QUEST_CARDS, left));
  };
  function buildQuest(cands, day, rand = Math.random) {
    const ranked = (cands || [])
      .filter(c => !(c.type !== 'hit' && typeof c.value === 'number' && c.value >= 1))
      .map(c => ({ c, v: typeof c.value === 'number' && !isNaN(c.value) ? c.value : -1, t: rand() }))
      .sort((a, b) => a.v - b.v || a.t - b.t)
      .map(x => x.c);
    const seen = new Set(), tasks = [];
    const take = (want, n) => {
      for (const c of ranked) {
        const id = c.pageId + ':' + c.key;
        if (n <= 0 || tasks.length >= QUEST_TASKS) return;
        if (!want(c) || seen.has(id)) continue;
        seen.add(id); n--;
        const hit = c.type === 'hit', t = { pageId: c.pageId, key: c.key, label: c.label };
        if (isStr(c.file) && FILE_RE.test(c.file)) t.file = c.file;
        tasks.push(Object.assign(t, { type: c.type, target: questTarget(c), startLen: hit ? 0 : (c.len || 0) }));
      }
    };
    const tier = name => c => c.tier === name;
    if (!ranked.some(c => c.tier)) take(() => true, QUEST_TASKS);
    else {
      const review = ranked.some(tier('done')) ? 1 : 0;
      take(tier('current'), QUEST_TASKS - review);
      take(tier('done'), QUEST_TASKS);
      take(tier('free'), QUEST_TASKS);
    }
    return { date: day, tasks, done: false };
  }

  // Progress of the kid's quest for `day`. `lens` maps 'pageId:key' to the current list length. A quest built
  // for another day, a missing quest and an empty quest are never complete.
  function questStatus(kid, day, lens) {
    const q = kid && kid.quest;
    if (!q || q.date !== day || !Array.isArray(q.tasks)) return { tasks: [], allDone: false };
    const acts = kid.days && own(kid.days, day) && kid.days[day].acts || {}, L = lens || {};
    const tasks = q.tasks.map(t => {
      const id = t.pageId + ':' + t.key;
      const count = t.type === 'hit'
        ? (own(acts, id) ? acts[id].ok || 0 : 0)
        : (own(L, id) ? Math.max(0, L[id] - t.startLen) : 0);
      return Object.assign({}, t, { count, done: count >= t.target });
    });
    return { tasks, allDone: tasks.length > 0 && tasks.every(t => t.done) };
  }

  // Flags a hit row that has fallen under 50% after at least 5 answers; fixer needs it. Sticky: never cleared.
  // List records carry no answer count, so they are never flagged.
  function markLow(rec, type) {
    const v = rowValue(rec, type);
    if (v !== null && v < LOW_BELOW && (rec.n || 0) >= LOW_MIN_ANSWERS) rec.low = true;
    return rec;
  }

  // One dispatch table: an event kind evaluates only its own badge ids. The caller checks 'hit'/'list' before
  // logAnswer (so comeback sees the previous active day) and checks {kind: 'day'} after it.
  const ANSWER_BADGES = ['first_star', 'page_full', 'explorer', 'cards_all', 'fire10', 'fire20', 'fixer', 'record', 'early', 'comeback'];
  const KIND_BADGES = {
    hit: ANSWER_BADGES, list: ANSWER_BADGES, other: ['early', 'comeback'],   // other: an answer on a key that is not a counted row
    day: ['days3', 'days7', 'days30'], quest: ['quest1', 'quest10'], round: ['perfect'], boss: ['boss1'], jar: ['helper'],
  };

  // Latest day in kid.days strictly before `day`, or null. ISO day strings sort as text.
  function priorDay(kid, day) {
    let prev = null;
    for (const k of Object.keys(kid.days || {})) if (k < day && (prev === null || k > prev)) prev = k;
    return prev;
  }

  // c = {kid, day, now, ev, cr (counted rows of the current page), rec(key), cur (record of ev.key)}.
  // State rules read only the current page; an empty page is never "all done".
  const BADGE_RULES = {
    first_star: c => c.cr.some(r => (c.rec(r[0]) || {}).best >= 1),
    page_full: c => c.cr.length > 0 && c.cr.every(r => (c.rec(r[0]) || {}).best === 3),
    explorer: c => c.cr.length > 0 && c.cr.every(r => { const x = c.rec(r[0]); return !!x && (x.n > 0 || Array.isArray(x.list)); }),
    cards_all: c => { const x = c.rec('cards'); return !!x && Array.isArray(x.list) && x.total > 0 && x.list.length >= x.total; },
    fire10: c => /1{10}$/.test((c.cur && c.cur.r) || ''),
    fire20: c => /^1{20}$/.test((c.cur && c.cur.r) || ''),
    fixer: c => !!c.cur && c.cur.low === true && num(c.cur.n) >= MIN_RECENT && rowValue(c.cur, c.ev.kind) >= 0.9,   // n: «Μηδενισμός» keeps low
    record: c => c.ev.kind === 'list' && !!c.ev.hiRaised && c.ev.key !== 'cards',
    early: c => c.now instanceof Date && c.now.getHours() * 60 + c.now.getMinutes() < EARLY_BEFORE,
    comeback: c => { const prev = priorDay(c.kid, c.day); return prev !== null && diffDays(prev, c.day) >= COMEBACK_DAYS; },
    days3: c => streak(c.kid, c.day).count >= 3,
    days7: c => streak(c.kid, c.day).count >= 7,
    days30: c => streak(c.kid, c.day).count >= 30,
    quest1: c => (Number(c.kid.questsDone) || 0) >= 1,
    quest10: c => (Number(c.kid.questsDone) || 0) >= 10,
    boss1: c => !!c.ev.won,
    perfect: c => !!c.ev.perfect,
    helper: () => true,      // a 'jar' event means this kid's stars filled the family jar
  };

  // Pure: returns the ids newly earned by this event, never ones already in kid.badges; the caller records dates.
  function checkBadges(ctx) {
    const ev = ctx.ev || {}, kid = ctx.kid, p = ctx.progress || {};
    const rec = k => (own(p, k) ? p[k] : undefined);
    const c = { kid, day: ctx.day, now: ctx.now, ev, cr: countedRows(ctx.rows || []), rec, cur: rec(ev.key) };
    const have = kid.badges || {};
    return (own(KIND_BADGES, ev.kind) ? KIND_BADGES[ev.kind] : []).filter(id => !own(have, id) && BADGE_RULES[id](c));
  }

  // ---- Backup code: export, validation, merge ----
  const KEY_RE = /^(progress_[A-Za-z0-9_-]{1,64}|noos_rows_[A-Za-z0-9_-]{1,64}|noos_kid_[A-Za-z0-9_-]{1,32}|noos_family)$/;
  const FILE_RE = /^dim[\w-]+\.html$/;
  const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;   // plus length % 4 === 0, see parseCode: two cheap checks, no nested quantifier
  const ID_RE = /^[\w-]{1,64}$/, KID_RE = /^[\w-]{1,32}$/;
  const ROW_TYPES = ['hit', 'list', 'boss'];
  const MAX_TITLE = 200;
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const MAX_CODE = 1000000;   // characters
  const MAX_DEPTH = 8;        // shortcut: fixed nesting cap, the deepest real container sits at depth 5; raise it if a store grows deeper
  const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  const ERR = {
    empty: 'Δεν βρέθηκε κωδικός. Κόλλησε τον κωδικό που δημιουργήθηκε στην άλλη συσκευή.',
    size: 'Ο κωδικός είναι πολύ μεγάλος.',
    format: 'Ο κωδικός δεν διαβάζεται. Αντίγραψέ τον ολόκληρο, όπως εμφανίστηκε.',
    version: 'Ο κωδικός είναι από άλλη έκδοση και δεν μπορεί να διαβαστεί.',
    data: 'Ο κωδικός περιέχει δεδομένα που δεν αναγνωρίζονται.',
    write: 'Η συσκευή δεν δέχτηκε την αποθήκευση (ίσως ιδιωτική περιήγηση ή γεμάτος χώρος). Η επαναφορά δεν κρατήθηκε.',
  };

  // Base64 of UTF-8: Buffer in Node, btoa/atob in the browser, picked at runtime. Decoding is strict (bad UTF-8 throws).
  const b64enc = s => (typeof Buffer !== 'undefined' ? Buffer.from(s, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(s))));
  const b64dec = s => (typeof Buffer !== 'undefined'
    ? new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(s, 'base64')) : decodeURIComponent(escape(atob(s))));

  const isObj = x => typeof x === 'object' && x !== null && !Array.isArray(x);   // a plain JSON object
  const isNum = x => typeof x === 'number' && isFinite(x);
  const isStr = x => typeof x === 'string';
  const isBool = x => typeof x === 'boolean';
  const num = x => (isNum(x) ? x : 0);
  const getOwn = (o, k) => (own(o, k) ? o[k] : undefined);
  const keysOf = o => Object.keys(o).filter(k => k !== '__proto__');   // assigning to '__proto__' would swap the prototype
  const validDay = s => isStr(s) && DAY_RE.test(s) && addDays(s, 0) === s;   // a rolled-over date such as 2026-02-30 fails

  // Field types per store: a field that is present must have this type; other fields are left alone.
  // Numbers and dates are checked because pages print them with innerHTML and add them up.
  const mapOk = (m, ok) => isObj(m) && Object.keys(m).every(k => ok(m[k]));
  const fieldsOk = (o, types) => Object.keys(types).every(f => !own(o, f) || types[f](o[f]));
  const nonNeg = x => isNum(x) && x >= 0;
  const DAY_T = { ok: nonNeg, n: nonNeg, stars: nonNeg };
  const dayOk = d => isObj(d) && fieldsOk(d, DAY_T) && (!own(d, 'acts') || mapOk(d.acts, a => isObj(a) && fieldsOk(a, DAY_T)));
  const dates = m => mapOk(m, validDay);
  const dayMap = (m, ok) => mapOk(m, ok) && Object.keys(m).every(validDay);   // keys are days too
  const pageIdOk = id => isStr(id) && ID_RE.test(id) && !BAD_KEYS.has(id);
  const pageDays = m => dates(m) && Object.keys(m).every(pageIdOk);   // {pageId: day}
  const REC_T = { ok: nonNeg, n: nonNeg, best: x => Number.isInteger(x) && x >= 0 && x <= 3, hi: nonNeg, total: nonNeg, r: isStr, low: isBool, won: isBool, list: Array.isArray };
  const BOSS_T = { ...REC_T, best: x => Number.isInteger(x) && x >= 0 };   // the boss row keeps a score out of its round length, not stars
  const rowOk = r => Array.isArray(r) && r.length === 3 && r.every(isStr) && ID_RE.test(r[0]) && ROW_TYPES.includes(r[2]);   // [key, label, type]
  const MANIFEST_T = { file: f => isStr(f) && FILE_RE.test(f), kid: k => isStr(k) && KID_RE.test(k), title: t => isStr(t) && t.length <= MAX_TITLE,
    rows: rs => Array.isArray(rs) && rs.every(rowOk), ts: isNum };
  const KID_T = { days: m => mapOk(m, dayOk), badges: dates, freezes: dates, testDates: dates, bosses: dates, bonus: m => dayMap(m, isNum),
    unlocked: pageDays, questsDone: nonNeg, quest: q => q === null || isObj(q) };   // quest is only type-checked: it is never imported, see mergeAll
  const FAMILY_T = { launch: validDay, lastExport: validDay, jarBase: nonNeg, jarGoal: x => isNum(x) && x > 0, jarSpent: nonNeg, jarReward: isStr, sound: isBool,
    jarCelebrated: nonNeg };   // the jarSpent value when the hub last celebrated a full jar, so each jar is celebrated once

  function storeOk(key, v) {
    if (key.startsWith('progress_')) return Object.keys(v).every(row => isObj(v[row]) && fieldsOk(v[row], row === '_boss' ? BOSS_T : REC_T));
    if (key.startsWith('noos_rows_')) return own(v, 'file') && fieldsOk(v, MANIFEST_T);
    if (key.startsWith('noos_kid_')) return fieldsOk(v, KID_T);
    return fieldsOk(v, FAMILY_T);
  }

  // True when any key is __proto__, constructor or prototype, or containers nest deeper than MAX_DEPTH.
  // Iterative, so a hostile deep nest cannot overflow the stack.
  function unsafeShape(root) {
    const stack = [[root, 0]];
    while (stack.length) {
      const [node, depth] = stack.pop();
      if (depth > MAX_DEPTH) return true;
      for (const k of Object.keys(node)) {
        if (BAD_KEYS.has(k)) return true;
        if (typeof node[k] === 'object' && node[k] !== null) stack.push([node[k], depth + 1]);
      }
    }
    return false;
  }

  // shortcut: no compression, data is a few KB; add CompressionStream if codes get unwieldy.
  const exportCode = entries => b64enc(JSON.stringify({ v: 1, at: new Date().toISOString(), data: entries }));

  // Pure: nothing is written; the caller stores `data` only on ok. Whitespace is ignored so a wrapped paste still works.
  function parseCode(code) {
    const fail = error => ({ ok: false, error });
    if (typeof code !== 'string') return fail(ERR.empty);
    if (code.length > MAX_CODE) return fail(ERR.size);
    const s = code.replace(/\s+/g, '');
    if (!s) return fail(ERR.empty);
    if (s.length % 4 !== 0 || !B64_RE.test(s)) return fail(ERR.format);
    let env;
    try { env = JSON.parse(b64dec(s)); } catch { return fail(ERR.format); }
    if (!isObj(env)) return fail(ERR.format);
    if (getOwn(env, 'v') !== 1) return fail(ERR.version);
    const data = getOwn(env, 'data');
    if (!isObj(data) || unsafeShape(data) || !Object.keys(data).every(k => KEY_RE.test(k) && isObj(data[k]) && storeOk(k, data[k]))) return fail(ERR.data);
    return { ok: true, data };
  }

  // Deep copy of JSON data; never copies a '__proto__' key.
  function clone(x) {
    if (Array.isArray(x)) return x.map(v => clone(v));
    if (!isObj(x)) return x;
    const out = {};
    for (const k of keysOf(x)) out[k] = clone(x[k]);
    return out;
  }

  function same(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every(k => own(b, k) && same(a[k], b[k]));
  }

  // Union of two maps (a side that is not a plain object counts as empty); resolve(a, b) settles a key both sides have.
  function unionMap(a, b, resolve) {
    const A = isObj(a) ? a : {}, B = isObj(b) ? b : {}, out = {};
    for (const k of keysOf(A)) out[k] = clone(own(B, k) ? resolve(A[k], B[k]) : A[k]);
    for (const k of keysOf(B)) if (!own(A, k)) out[k] = clone(B[k]);
    return out;
  }

  const earliest = (a, b) => (b < a ? b : a);   // dates and day flags: the earlier one, local on a tie or a type mismatch
  const nOf = d => (isObj(d) ? num(getOwn(d, 'n')) : 0);

  // The record that carries more wins whole: a won boss beats an unwon one, then a longer list, then a larger n; local on a tie.
  // best and hi are the max of both sides and low is OR, so stars and records never go down. A list never replaces a hit record.
  const heft = r => [getOwn(r, 'won') === true ? 1 : 0, Array.isArray(getOwn(r, 'list')) ? r.list.length : num(getOwn(r, 'n'))];
  function mergeRec(a, b) {
    const ha = heft(a), hb = heft(b);
    const bWins = Array.isArray(getOwn(a, 'list')) === Array.isArray(getOwn(b, 'list')) && (hb[0] - ha[0] || hb[1] - ha[1]) > 0;
    const out = clone(bWins ? b : a);
    for (const f of ['best', 'hi']) if (own(a, f) || own(b, f)) out[f] = Math.max(num(getOwn(a, f)), num(getOwn(b, f)));
    if (getOwn(a, 'low') === true || getOwn(b, 'low') === true) out.low = true;
    return out;
  }

  const mergeProgress = (x, y) => unionMap(x, y, (a, b) => (isObj(a) && isObj(b) ? mergeRec(a, b) : isObj(a) ? a : b));
  const mergeManifest = (x, y) => clone(num(getOwn(y, 'ts')) > num(getOwn(x, 'ts')) ? y : x);

  // A quest is never imported (mergeAll drops it from incoming kids): it is rebuilt daily and carries a page file and labels.
  function mergeKid(x, y) {
    const out = clone(x), maps = { days: (a, b) => (nOf(b) > nOf(a) ? b : a), badges: earliest, freezes: earliest, bosses: earliest, bonus: earliest, testDates: a => a,
      unlocked: earliest };   // unlocked: a page unlocked on either device stays unlocked, from the earlier day
    for (const f of Object.keys(maps)) if (own(x, f) || own(y, f)) out[f] = unionMap(getOwn(x, f), getOwn(y, f), maps[f]);
    if (own(x, 'questsDone') || own(y, 'questsDone')) out.questsDone = Math.max(num(getOwn(x, 'questsDone')), num(getOwn(y, 'questsDone')));
    return out;
  }

  // Local values win, except jarSpent and jarBase are the max of both: the merged progress holds both devices' stars, so a fresh
  // device (jarBase 0) must take the source jarBase or the imported stars would fill the jar at once. A restore then sets
  // jarBase from both jars, see mergeBackup.
  function mergeFamily(x, y) {
    const out = clone(x);
    for (const f of ['jarBase', 'jarSpent']) if (own(x, f) || own(y, f)) out[f] = Math.max(num(getOwn(x, f)), num(getOwn(y, f)));
    return out;
  }

  function mergeStore(key, x, y) {
    if (key.startsWith('progress_')) return mergeProgress(x, y);
    if (key.startsWith('noos_rows_')) return mergeManifest(x, y);
    if (key.startsWith('noos_kid_')) return mergeKid(x, y);
    return mergeFamily(x, y);
  }

  // Pure. `data` is the full merged state (local keys first, then incoming-only ones); `changed` lists the keys whose merged
  // value differs from local, which are the only ones a caller needs to write. Keys outside KEY_RE and values that are not
  // plain objects are ignored. An incoming kid's quest is dropped (set to null). Merging the same code again changes nothing.
  function mergeAll(local, incoming) {
    const L = isObj(local) ? local : {}, I = isObj(incoming) ? incoming : {}, data = {}, changed = [];
    for (const k of [...Object.keys(L), ...Object.keys(I).filter(j => !own(L, j))]) {
      if (!KEY_RE.test(k)) continue;
      const x = isObj(getOwn(L, k)) ? L[k] : null;
      let y = isObj(getOwn(I, k)) ? I[k] : null;
      if (y && k.startsWith('noos_kid_') && own(y, 'quest')) y = { ...clone(y), quest: null };   // never import a quest (it is rebuilt daily)
      const merged = x && y ? mergeStore(k, x, y) : clone(x || y);
      if (!merged) continue;
      data[k] = merged;
      if (!same(merged, x)) changed.push(k);
    }
    return { data, changed };
  }

  // ---- Storage layer ----
  // Every access is wrapped. A missing or throwing storage falls back to an in-memory map: the page keeps working and
  // rewards last for the session (so a badge is not re-earned on every answer) but do not persist.
  let store = null;
  try { store = typeof window !== 'undefined' ? window.localStorage : null; } catch { store = null; }
  const memory = new Map();   // raw JSON for keys that could not be written through `store`

  function useStorage(s) { store = s || null; memory.clear(); }

  // A plain object or null; bad JSON, arrays and scalars load as null.
  function load(key) {
    let raw = null;
    if (memory.has(key)) raw = memory.get(key);
    else if (store) { try { raw = store.getItem(key); } catch { raw = null; } }
    if (typeof raw !== 'string') return null;
    try { const v = JSON.parse(raw); return isObj(v) ? v : null; } catch { return null; }
  }

  // True when the value reached `store`; false when it was kept in memory only (or could not be encoded).
  function save(key, obj) {
    let raw;
    try { raw = JSON.stringify(obj); } catch { return false; }
    if (store) { try { store.setItem(key, raw); memory.delete(key); return true; } catch { /* keep it in memory */ } }
    memory.set(key, raw);
    return false;
  }

  function storedKeys() {
    const out = new Set(memory.keys());
    if (store) {
      try { for (let i = 0; i < store.length; i++) { const k = store.key(i); if (isStr(k)) out.add(k); } } catch { /* keep what was listed */ }
    }
    return [...out];
  }

  // Loaded stores are merged onto defaults: a field of the wrong type keeps its default, unknown fields are kept.
  function normalize(v, defs, types) {
    if (isObj(v)) for (const k of keysOf(v)) if (!own(types, k) || types[k](v[k])) defs[k] = v[k];
    return defs;
  }

  const kidStore = kidKey => normalize(load('noos_kid_' + kidKey), newKid(), KID_T);
  const saveKid = (kidKey, kid) => save('noos_kid_' + kidKey, kid);
  const saveFamily = fam => save('noos_family', fam);

  // Created and saved on the first call: `launch` is the day the reward layer first ran on this device.
  // A missing or corrupt record (or jarBase) is rebuilt with jarBase = the stars already earned (0 on a true first
  // launch), so the jar never fills at once with every existing star.
  function family() {
    const v = load('noos_family');
    const rebuild = !v || !nonNeg(getOwn(v, 'jarBase'));
    const fam = normalize(v, { launch: dayKey(new Date()), jarBase: 0, jarGoal: JAR_GOAL, jarReward: '', jarSpent: 0, sound: false }, FAMILY_T);
    if (rebuild) { fam.jarBase = totalStars(); saveFamily(fam); }
    return fam;
  }

  // {pageId: {kid?, file, title, rows, ts}}; rows default to [] when absent or malformed.
  function manifests() {
    const out = {};
    for (const k of storedKeys()) {
      const id = k.slice('noos_rows_'.length);
      if (!k.startsWith('noos_rows_') || BAD_KEYS.has(id)) continue;
      const v = load(k);
      if (v) out[id] = normalize(v, { rows: [] }, MANIFEST_T);
    }
    return out;
  }

  // ---- Event API ----
  const result = () => ({ starsUp: null, sticker: false, badges: [], questDone: false });
  const when = d => (d instanceof Date && !isNaN(d) ? d : new Date());
  const recOf = (p, key) => (own(p, key) && isObj(p[key]) ? p[key] : null);
  const listLen = rec => (rec && Array.isArray(rec.list) ? rec.list.length : 0);

  function award(kid, day, ids, got) {
    for (const id of ids) { kid.badges[id] = day; got.push(id); }
  }

  // The class plan known to this module, set by the page layer (rewards-ui.js when plan.js settles, the hub before its
  // quest): null or undefined = no plan (as on a fresh module), PLAN_PENDING = plan.js is on its way, anything else is
  // the plan object as loaded (planState checks it). This file never reads window.
  const PLAN_PENDING = Object.freeze({ pending: true });
  let knownPlan = null;
  function usePlan(plan) { knownPlan = plan === undefined ? null : plan; }

  // Quest candidates from the kid's manifests and stored progress (R9): a hit row with fewer than 5 answers (no star
  // possible yet) has value null, so it counts as weakest. A list row carries its stored total (null when unknown).
  // `opts` = {plan, day, unlocked, extra}, all optional. Only when planState(plan, kidKey, day, unlocked) is active: each
  // candidate gets `tier` ('current', 'done', or 'free' for a page missing from the plan's order), upcoming and hidden
  // pages give none, and `extra` ({pageId: manifest}, e.g. the hub's build-time entries) adds the kid's pages that have
  // no device manifest, checked like a stored one. Inactive: exactly the plain device-manifest candidates.
  // `progress` ({pageId: progress object}, with or without a plan) is read instead of the stored progress of those pages:
  // the page strip passes its own page's progress as it was at page open, before the page's games stored anything.
  function questCands(kidKey, opts) {
    const o = isObj(opts) ? opts : {}, st = planState(o.plan, kidKey, o.day, o.unlocked);
    const ms = manifests(), cands = [], prog = isObj(o.progress) ? o.progress : {};
    if (st.active && isObj(o.extra)) {
      for (const id of keysOf(o.extra)) {
        if (own(ms, id) || BAD_KEYS.has(id) || !ID_RE.test(id) || !isObj(o.extra[id])) continue;
        ms[id] = normalize(o.extra[id], { rows: [] }, MANIFEST_T);
      }
    }
    for (const id of Object.keys(ms)) {
      if (ms[id].kid !== kidKey) continue;
      const tier = !st.active ? null : own(st.states, id) ? st.states[id] : 'free';
      if (tier === 'upcoming' || tier === 'hidden') continue;
      const p = (own(prog, id) && isObj(prog[id]) ? prog[id] : load('progress_' + id)) || {};
      for (const [key, label, type] of countedRows(ms[id].rows)) {
        const rec = recOf(p, key), hit = type === 'hit';
        const value = hit ? (rec && num(rec.n) >= 5 ? rowValue(rec, type) : null) : rowValue(rec, type);
        const c = { pageId: id, key, label, file: ms[id].file, type, value, len: hit ? 0 : listLen(rec),
          total: !hit && rec && isNum(rec.total) ? rec.total : null };
        if (tier) c.tier = tier;
        cands.push(c);
      }
    }
    return cands;
  }

  // Pure. The kid's stored quest when it is well-formed, non-empty and for `day`; otherwise null.
  function dayQuest(kid, day) {
    const q = isObj(kid) ? getOwn(kid, 'quest') : undefined;
    return isObj(q) && q.date === day && Array.isArray(q.tasks) && q.tasks.length > 0 && q.tasks.every(isObj) ? q : null;
  }

  // Builds today's quest into `kid` unless it already holds a well-formed, non-empty one for `day`; true when it built one.
  // An empty quest (built before the kid had a manifest) is rebuilt, so a page opened later still gets a quest that day.
  // A stored quest is kept all day, whatever plan is passed later. Without an own `plan` in opts the plan set by usePlan
  // is used; while it is PLAN_PENDING nothing is built (false), so no path builds a planless quest while plan.js is on its
  // way. Without an own `unlocked` in opts the kid store's `unlocked` is used (slice 4; planState checks it).
  function questFor(kid, kidKey, day, opts) {
    if (dayQuest(kid, day)) return false;
    const o = Object.assign({}, isObj(opts) ? opts : {}, { day });
    if (!own(o, 'plan')) {
      if (knownPlan === PLAN_PENDING) return false;
      o.plan = knownPlan;
    }
    if (!own(o, 'unlocked')) o.unlocked = getOwn(kid, 'unlocked');
    kid.quest = buildQuest(questCands(kidKey, o), day);
    return true;
  }

  // Saves only a rebuilt quest with tasks: an empty one is never kept (questFor rebuilds it), so a kid with no
  // manifest costs no write on each hub render. `opts` = {plan, unlocked, extra, progress}, see questCands; `plan` and
  // `unlocked` default to usePlan's plan and the kid store (questFor). The page layer reads window.PLAN and manifest.js and
  // passes them in; this file never does. While the plan is pending it returns the stored quest (possibly another day's or null).
  function ensureQuest(kidKey, day, opts) {
    if (!kidKey) return null;
    const kid = kidStore(kidKey);
    if (questFor(kid, kidKey, day || dayKey(new Date()), opts) && kid.quest.tasks.length) saveKid(kidKey, kid);
    return kid.quest;
  }

  // Current list length per list task; the current page reads the live progress object.
  function questLens(q, pageId, live) {
    const lens = {};
    for (const t of q.tasks) {
      if (t.type === 'hit') continue;
      lens[t.pageId + ':' + t.key] = listLen(recOf(t.pageId === pageId ? live : load('progress_' + t.pageId) || {}, t.key));
    }
    return lens;
  }

  // Launch seeding: a record without a numeric `best` gets best (and hi on list rows) silently, with no badge; the
  // seeded stars of counted rows on a kid page move family().jarBase, so the jar starts empty.
  // The day's quest is not built here: the page strip (rewards-ui.js questStrip) builds it once the class plan has loaded
  // or failed to load, so a quest is never built from a planless view while plan.js is on its way.
  function onPageOpen(o) {
    const { pageId, kid, file, title } = o || {};
    const rows = Array.isArray(o && o.rows) ? o.rows.filter(rowOk) : [];
    const fam = family();
    const man = { file, title, rows, ts: Date.now() };
    if (kid) man.kid = kid;   // a page without kid omits the field (parseCode rejects kid: null)
    save('noos_rows_' + pageId, man);
    const p = isObj(o && o.progress) ? o.progress : null;
    let seeded = false, gained = 0;
    if (p) {
      for (const r of rows) {
        if (r[0].charAt(0) === '_') continue;
        const rec = recOf(p, r[0]);
        if (!rec || isNum(rec.best)) continue;
        rec.best = starsFor(rec, r[2]);
        if (r[2] !== 'hit') rec.hi = Math.max(num(rec.hi), listLen(rec));
        if (counted(r[0])) gained += rec.best;
        seeded = true;
      }
    }
    if (seeded) save('progress_' + pageId, p);
    if (kid && gained > 0) { fam.jarBase = num(fam.jarBase) + gained; saveFamily(fam); }
  }

  // `progress` is the page's live store, already updated by pushResult. Order (R2/R9): markLow, bumpBest, answer
  // badges (before logAnswer), logAnswer, logStars, freezes (R5), day badges, quest check, save.
  // Only a counted row of this page earns stars and row badges; any other key (mountq, a row:false game) is logged as an
  // answer for the day and checks only the time and day badges.
  function onAnswer(o) {
    const { pageId, kid, key, type, ok } = o || {};
    const now = when(o && o.now), day = dayKey(now), res = result();
    const p = isObj(o && o.progress) ? o.progress : {}, rows = Array.isArray(o && o.rows) ? o.rows.filter(rowOk) : [];
    const isRow = isStr(key) && counted(key) && rows.some(r => r[0] === key);
    const rec = isRow ? recOf(p, key) : null;
    let up = { from: 0, to: 0, hiRaised: false };
    if (rec) {
      markLow(rec, type);
      up = bumpBest(rec, type);
      if (up.to > up.from) { res.starsUp = { key, from: up.from, to: up.to }; res.sticker = up.to === 3; }
      save('progress_' + pageId, p);
    }
    if (!kid) return res;
    const k = kidStore(kid), got = res.badges;
    const check = ev => award(k, day, checkBadges({ kid: k, day, now, rows, progress: p, ev }), got);
    check({ kind: !isRow ? 'other' : type === 'hit' ? 'hit' : 'list', key, ok: !!ok, starsTo: up.to, hiRaised: up.hiRaised });
    logAnswer(k, day, pageId + ':' + key, !!ok);
    if (up.to > up.from) logStars(k, day, up.to - up.from);
    for (const d of streak(k, day).frozen) { const wk = isoWeek(d); if (!own(k.freezes, wk)) k.freezes[wk] = d; }   // first freeze of a week sticks
    check({ kind: 'day' });
    questFor(k, kid, day);   // a page left open across midnight gets the new day's quest (none while the plan is pending)
    if (!own(k.bonus, day) && dayQuest(k, day) && questStatus(k, day, questLens(k.quest, pageId, p)).allDone) {
      k.bonus[day] = 1;
      k.questsDone = num(k.questsDone) + 1;
      res.questDone = true;
      check({ kind: 'quest' });
    }
    saveKid(kid, k);
    return res;
  }

  // A quiz or true/false round is perfect with no mistake over at least 10 questions.
  function onRoundEnd(o) {
    const { kid, score, total } = o || {}, res = result();
    if (!kid) return res;
    const now = when(o.now), day = dayKey(now), k = kidStore(kid);
    const perfect = isNum(total) && total >= 10 && score === total;
    award(k, day, checkBadges({ kid: k, day, now, ev: { kind: 'round', perfect } }), res.badges);
    if (res.badges.length) saveKid(kid, k);
    return res;
  }

  // The caller has already stored `_boss` on a win. The 3 trophy stars count in the day log once per page: the first
  // win is recorded in kid.bosses, since `_boss` is replaced on every win.
  function onBoss(o) {
    const { pageId, kid, won } = o || {}, res = result();
    if (!kid) return res;
    const now = when(o.now), day = dayKey(now), k = kidStore(kid);
    award(k, day, checkBadges({ kid: k, day, now, rows: o.rows, progress: o.progress, ev: { kind: 'boss', won: !!won } }), res.badges);
    if (won) {
      const b = isObj(k.bosses) ? k.bosses : (k.bosses = {});
      if (!own(b, pageId)) { b[pageId] = day; logStars(k, day, 3); }
    }
    saveKid(kid, k);
    return res;
  }

  // The hub calls this once when a jar fills: each listed kid gets the 'helper' badge (if new), dated today.
  // Returns {kidKey: [new badge ids]}; a key that is not a valid kid key is skipped.
  function onJarFull(kidKeys, at) {
    const now = when(at), day = dayKey(now), out = {};
    for (const kidKey of Array.isArray(kidKeys) ? kidKeys : []) {
      if (!isStr(kidKey) || !KID_RE.test(kidKey) || own(out, kidKey)) continue;
      const k = kidStore(kidKey), got = [];
      award(k, day, checkBadges({ kid: k, day, now, ev: { kind: 'jar' } }), got);
      if (got.length) saveKid(kidKey, k);
      out[kidKey] = got;
    }
    return out;
  }

  // The per-device override (timed release): a parent unlocks a page ahead of the class, or locks it again. Each touches
  // only the kid store; true when it changed it. A bad kid key or page id, an id already unlocked (unlockPage, which keeps
  // the first day) or one not unlocked (lockPage) is a no-op that writes nothing.
  const kidKeyOk = k => isStr(k) && KID_RE.test(k) && !BAD_KEYS.has(k);
  function unlockPage(kidKey, pageId, at) {
    if (!kidKeyOk(kidKey) || !pageIdOk(pageId)) return false;
    const k = kidStore(kidKey);
    if (own(k.unlocked, pageId)) return false;
    k.unlocked[pageId] = dayKey(when(at));
    saveKid(kidKey, k);
    return true;
  }
  function lockPage(kidKey, pageId) {
    if (!kidKeyOk(kidKey) || !pageIdOk(pageId)) return false;
    const k = kidStore(kidKey);
    if (!own(k.unlocked, pageId)) return false;
    delete k.unlocked[pageId];
    saveKid(kidKey, k);
    return true;
  }

  // Pure: stars per kid and in total from a data map {storeKey: object}. A kid's stars are the page stars over its manifests
  // (boss trophies included) plus one per quest bonus day; the kids are those named by a manifest or holding a kid store.
  // A page without kid never counts.
  function starsIn(data) {
    const D = isObj(data) ? data : {}, ms = {}, kids = new Set(), per = {};
    for (const k of keysOf(D)) {
      if (k.startsWith('noos_rows_')) {
        const id = k.slice('noos_rows_'.length);
        if (BAD_KEYS.has(id) || !isObj(D[k])) continue;
        ms[id] = normalize(D[k], { rows: [] }, MANIFEST_T);
        if (ms[id].kid) kids.add(ms[id].kid);
      } else if (k.startsWith('noos_kid_')) kids.add(k.slice('noos_kid_'.length));
    }
    let total = 0;
    for (const kid of kids) {
      let sum = Object.keys(normalize(getOwn(D, 'noos_kid_' + kid), newKid(), KID_T).bonus).length;
      for (const id of Object.keys(ms)) {
        if (ms[id].kid !== kid) continue;
        const pg = getOwn(D, 'progress_' + id), s = pageStars(isObj(pg) ? pg : {}, ms[id].rows);
        sum += isNum(s) ? s : 0;
      }
      per[kid] = sum; total += sum;
    }
    return { kids: per, total };
  }

  // The stores starsIn reads, loaded from storage.
  function starData() {
    const data = {};
    for (const k of storedKeys()) {
      if (!/^(progress_|noos_rows_|noos_kid_)/.test(k)) continue;
      const v = load(k);
      if (v) data[k] = v;
    }
    return data;
  }

  function kidStars(kidKey) {
    if (!kidKey) return 0;
    const per = starsIn(starData()).kids;
    return own(per, kidKey) ? per[kidKey] : 0;
  }

  // All kids' stars (the family jar).
  const totalStars = () => starsIn(starData()).total;

  // Pure: {total, fill} of the family jar held in a data map. A map without a valid family has a jar that never started: fill 0.
  function jarFill(data) {
    const total = starsIn(data).total, fam = isObj(data) ? getOwn(data, 'noos_family') : undefined;
    return { total, fill: isObj(fam) && nonNeg(getOwn(fam, 'jarBase')) ? jar(total, fam).fill : 0 };
  }

  // Stars a kid earned from `day` on: day stars logged since then plus quest bonus days (pre-launch page stars never count).
  function kidStarsSince(kidKey, day) {
    if (!kidKey || !validDay(day)) return 0;
    const kid = kidStore(kidKey);
    let sum = Object.keys(kid.bonus).filter(d => d >= day).length;
    for (const d of Object.keys(kid.days)) if (d >= day && isObj(kid.days[d])) sum += num(kid.days[d].stars);
    return sum;
  }

  function localData() {
    const data = {};
    for (const k of storedKeys()) { if (!KEY_RE.test(k)) continue; const v = load(k); if (v) data[k] = v; }
    return data;
  }

  // Null on any failure. A store that parseCode would reject is left out, so one bad record cannot sink the whole code.
  function exportAll() {
    try {
      const data = localData();
      for (const k of Object.keys(data)) if (unsafeShape(data[k]) || !storeOk(k, data[k])) delete data[k];
      const code = exportCode(data);
      const fam = family();
      fam.lastExport = dayKey(new Date());
      saveFamily(fam);
      return code;
    } catch { return null; }
  }

  // Pure: mergeAll, then the merged family's jarBase is set so the jar shows the fuller of the two jars (never a jar filled
  // with the other device's pre-launch stars). With no family on either side the jar is left to family() to start.
  function mergeBackup(local, incoming) {
    const out = mergeAll(local, incoming), fam = getOwn(out.data, 'noos_family');
    if (!isObj(fam)) return out;
    const want = Math.max(jarFill(local).fill, jarFill(incoming).fill);
    fam.jarBase = Math.max(0, starsIn(out.data).total - num(getOwn(fam, 'jarSpent')) - want);
    const i = out.changed.indexOf('noos_family'), diff = !same(fam, getOwn(local, 'noos_family'));
    if (diff && i < 0) out.changed.push('noos_family');
    else if (!diff && i >= 0) out.changed.splice(i, 1);
    return out;
  }

  // Reads only: the stores an import of `code` would change, so the parent sees the count before confirming.
  function previewImport(code) {
    const parsed = parseCode(code);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return { ok: true, changed: mergeBackup(localData(), parsed.data).changed };
  }

  // Writes only when the code is valid, and only the keys whose merged value differs from local. A store that refuses
  // a write makes the result an error: the merged values then live in memory for this session only.
  function importCode(code) {
    const parsed = parseCode(code);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const { data, changed } = mergeBackup(localData(), parsed.data);
    let kept = true;
    for (const k of changed) if (!save(k, data[k])) kept = false;
    return kept ? { ok: true, changed } : { ok: false, error: ERR.write };
  }

  // Parent weekly note over the 7 days ending `today`. A day is active with answers or stars (a boss win logs stars only).
  // stars = day stars plus quest bonus days (bonuses live in kid.bonus, not in day.stars). weakest: the 3 lowest rows of the
  // kid's pages that are not mastered yet (under 90%); a hit row needs LOW_MIN_ANSWERS answers, a list row a non-empty list.
  function weekly(kidKey, today) {
    const kid = kidStore(kidKey), from = addDays(today, -6);
    const inWeek = d => isStr(d) && d >= from && d <= today;
    const out = { daysActive: 0, n: 0, ok: 0, stars: 0, badges: [], weakest: [] };
    for (const d of Object.keys(kid.days)) {
      if (!inWeek(d)) continue;
      const r = kid.days[d];
      if (!isObj(r)) continue;
      out.n += num(r.n); out.ok += num(r.ok); out.stars += num(r.stars);
      if (num(r.n) > 0 || num(r.stars) > 0) out.daysActive++;
    }
    out.stars += Object.keys(kid.bonus).filter(inWeek).length;
    out.badges = Object.keys(kid.badges).filter(id => inWeek(kid.badges[id]));
    const ms = manifests(), rows = [];
    for (const id of Object.keys(ms)) {
      if (ms[id].kid !== kidKey) continue;
      const p = load('progress_' + id) || {};
      for (const [key, label, type] of countedRows(ms[id].rows)) {
        const rec = recOf(p, key);
        if (!rec || (type === 'hit' ? num(rec.n) < LOW_MIN_ANSWERS : !listLen(rec))) continue;   // an empty list row is unplayed
        const value = rowValue(rec, type);
        if (value !== null && value < MASTERED) rows.push({ pageId: id, key, label, file: ms[id].file, value });
      }
    }
    out.weakest = rows.sort((a, b) => a.value - b.value).slice(0, 3);   // stable sort: manifest and row order on ties
    return out;
  }

  /* ---------- chapter boss ---------- */
  const BOSS_LEN = 15;
  // Fisher-Yates on a copy (named mix: the page global shuffle must never be redeclared).
  function mix(a, rand) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Up to 15 questions from both pools, split in proportion to pool size; a non-empty pool gives at least one
  // question when the round has room for two, and a short pool hands its unused places to the other one.
  // seen (optional, audit L6): a Set of the items already shown in this page visit. The split stays the same; within each
  // kind the unseen items come first and seen ones only fill what is left. Each pool is shuffled as before and then split
  // (stably) into unseen and seen, so with nothing seen the round is drawn exactly as without `seen` for the same rand.
  function bossRound(quiz, tf, rand = Math.random, seen = null) {
    const q = Array.isArray(quiz) ? quiz : [], t = Array.isArray(tf) ? tf : [];
    const n = Math.min(BOSS_LEN, q.length + t.length);
    if (!n) return [];
    let nt = Math.round(n * t.length / (q.length + t.length));
    if (t.length && !nt) nt = 1;
    if (q.length && nt === n && n > 1) nt = n - 1;
    nt = Math.min(nt, t.length);
    let nq = n - nt;
    if (nq > q.length) { nq = q.length; nt = n - nq; }
    const was = seen && typeof seen.has === 'function' ? it => seen.has(it) : () => false;
    const draw = a => { const m = mix(a, rand); return m.filter(it => !was(it)).concat(m.filter(was)); };
    const out = draw(q).slice(0, nq).map(item => ({ kind: 'quiz', item }))
      .concat(draw(t).slice(0, nt).map(item => ({ kind: 'tf', item })));
    return mix(out, rand);
  }

  // 13 of 15; the same share, rounded up, on a shorter round.
  const bossPass = len => Math.ceil(len * 13 / 15);

  // Hearts (audit L7): a fight starts with the misses that still allow a win, plus one (3 on a 15-question round), so the
  // last heart goes exactly when the pass mark can no longer be reached. 0 for an empty or invalid length (no fight).
  const roundLen = len => (Number.isInteger(len) && len > 0 ? len : 0);
  const bossHearts = len => (roundLen(len) ? len - bossPass(len) + 1 : 0);
  // Pure. After an answer: {over, why, won, hearts}. why 'hearts' (the last heart went: a loss, even on the last question),
  // 'end' (the last question was answered with hearts left: a win, its score at least the pass mark) or null while it goes
  // on; won is null until it is over. The practice round (o.practice) has no hearts (null) and no result: it just ends.
  function bossOver(o) {
    const { len, answered, wrong, practice } = o || {};
    const n = roundLen(len), a = Number.isInteger(answered) && answered > 0 ? answered : 0;
    if (practice) return a >= n ? { over: true, why: 'end', won: null, hearts: null } : { over: false, why: null, won: null, hearts: null };
    const hearts = Math.max(0, bossHearts(n) - (Number.isInteger(wrong) && wrong > 0 ? wrong : 0));
    if (!hearts) return { over: true, why: 'hearts', won: false, hearts: 0 };
    return a >= n ? { over: true, why: 'end', won: true, hearts } : { over: false, why: null, won: null, hearts };
  }
  // Pure. A taunt line at random, never `last` again while there is another; '' with no lines.
  function bossTaunt(lines, last, rand = Math.random) {
    const all = Array.isArray(lines) ? lines : [], pool = all.filter(l => l !== last);
    const from = pool.length ? pool : all;
    if (!from.length) return '';
    const r = Number(rand());
    return from[Math.min(from.length - 1, Math.max(0, Math.floor((Number.isFinite(r) ? r : 0) * from.length)))];
  }

  // Original characters (no known cartoon or game figures), one per subject colour. taunt (audit L7): what the boss says on
  // a miss, next to the explanation; he boasts about himself and never mocks the child; at most 60 characters each.
  const BOSSES = {
    phys: { name: 'Μπουρμπουλήθρας', emo: '👾',
      intro: 'Είμαι ο Μπουρμπουλήθρας! Ανακατεύω τα υλικά και μπερδεύω τα παιδιά. Απάντησε σωστά για να με ξεφουσκώσεις!',
      win: 'Πφφσσς... Με ξεφούσκωσες! Ξέρεις τη Φυσική σου!',
      lose: 'Μπλουπ μπλουπ! Αυτή τη φορά γλίτωσα. Κάνε λίγη επανάληψη και έλα ξανά!',
      taunt: ['Μπλουπ! Τα ανακάτεψα όλα σαν μίγμα!', 'Χι χι! Φούσκωσα ακόμα πιο πολύ!', 'Πλοπ πλοπ! Οι φούσκες μου μπερδεύουν τα πάντα!'] },
    math: { name: 'Αριθμοφάγος', emo: '🐲',
      intro: 'Είμαι ο Αριθμοφάγος! Τρώω τους αριθμούς και αφήνω τις πράξεις μισές. Λύσε σωστά για να με διώξεις!',
      win: 'Ωχ! Μου έκοψες την όρεξη! Είσαι μάστορας στους αριθμούς!',
      lose: 'Χαμ χαμ! Αυτή τη φορά κέρδισα εγώ. Ξαναδοκίμασε!',
      taunt: ['Χαμ! Αυτόν τον αριθμό τον έφαγα εγώ!', 'Νιαμ νιαμ! Τι νόστιμη πράξη!', 'Μπουρπ! Άλλο ένα ψηφίο στην κοιλιά μου!'] },
    default: { name: 'Ξεχασιάρης', emo: '👹',
      intro: 'Είμαι ο Ξεχασιάρης! Θέλω να σε κάνω να ξεχάσεις όσα έμαθες. Θα με νικήσεις;',
      win: 'Αααχ! Τα θυμάσαι όλα! Με νίκησες!',
      lose: 'Χε χε! Κάτι ξέχασες. Κάνε επανάληψη και έλα ξανά!',
      taunt: ['Σβιτς σβιτς! Το έσβησα στο πι και φι!', 'Χε χε! Κανείς δεν σβήνει πιο γρήγορα από μένα!', 'Σβουπ! Ούτε εγώ δεν θυμάμαι τι ήταν!'] },
  };
  // The subject comes from the page id: dim5_fysiki_ch02 -> phys, dim3_mathimatika_en01c -> math.
  const bossFor = pageId => {
    const s = String(pageId || '').split('_')[1];
    return s === 'fysiki' ? BOSSES.phys : s === 'mathimatika' ? BOSSES.math : BOSSES.default;
  };

  /* ---------- page guide: «Συνέχισε» and the final boss lock ---------- */
  const BOSS_TAB = 'fboss';
  const TAB_OF = { cards: 'fc', ws: 'wsearch' };   // row keys whose tab id differs; any other row opens the tab of its own name
  const UNLOCK_ROWS = 3;   // played rows that unlock the final boss (all of them on a page with fewer)
  const UNLOCK_DAYS = 3;   // a test this many days ahead or nearer unlocks it at once
  // Row value, or null while the row is unplayed: a list row with an empty list is unplayed too, as in weekly (physics ch02
  // stores {list: [], total} for `miss` on load, before the child does anything).
  const playedValue = (rec, type) => (type !== 'hit' && !listLen(rec) ? null : rowValue(rec, type));
  // Mastered: the 3-star value; a hit row also needs MIN_RECENT answers, as in starsFor, so one right answer is not mastery.
  const mastered = (rec, type) => {
    const v = rowValue(rec, type);
    return v !== null && v >= MASTERED && !(type === 'hit' && num(rec.n) < MIN_RECENT);
  };

  // Pure. The tab to open next: the first never-played row in `tabs` order (the order on screen), else the played row with
  // the lowest value (first on screen on a tie); mastered rows and rows without a tab are skipped. With nothing left, the
  // final boss when the page has it, it is unlocked and not won yet; otherwise null.
  function nextTab(o) {
    const { rows, progress, tabs, bossUnlocked } = o || {};
    const T = Array.isArray(tabs) ? tabs : [], p = isObj(progress) ? progress : {};
    const cands = [];
    for (const [key, , type] of countedRows(Array.isArray(rows) ? rows.filter(rowOk) : [])) {
      const tab = T.includes(key) ? key : own(TAB_OF, key) && T.includes(TAB_OF[key]) ? TAB_OF[key] : null;
      if (!tab || tab === BOSS_TAB) continue;
      const rec = recOf(p, key);
      if (mastered(rec, type)) continue;
      cands.push({ tab, at: T.indexOf(tab), v: playedValue(rec, type) });
    }
    cands.sort((a, b) => (a.v === null ? -1 : a.v) - (b.v === null ? -1 : b.v) || a.at - b.at);
    if (cands.length) return cands[0].tab;
    const boss = recOf(p, '_boss');
    return T.includes(BOSS_TAB) && bossUnlocked === true && !(boss && boss.won === true) ? BOSS_TAB : null;
  }

  // Pure. {unlocked, left}: unlocked once UNLOCK_ROWS counted rows are played (see playedValue; all of them on a smaller
  // page), or a test date for the page is today or within UNLOCK_DAYS days, or a `_boss` record exists (a child who fought
  // it keeps it). `left` is how many more rows unlock it, 0 when unlocked.
  function bossUnlock(o) {
    const { rows, progress, today, testDate } = o || {};
    const p = isObj(progress) ? progress : {};
    const cr = countedRows(Array.isArray(rows) ? rows.filter(rowOk) : []);
    const played = cr.filter(r => playedValue(recOf(p, r[0]), r[2]) !== null).length;
    const left = Math.max(0, Math.min(UNLOCK_ROWS, cr.length) - played);
    const days = isStr(today) && isStr(testDate) ? daysUntil(today, testDate) : null;
    const unlocked = left === 0 || (days !== null && days <= UNLOCK_DAYS) || !!recOf(p, '_boss');
    return { unlocked, left: unlocked ? 0 : left };
  }

  /* ---------- timed release: the class plan (plan.js, audit section 8) ---------- */
  const UPCOMING = 2;   // pages after the last current one shown as upcoming teasers
  const planOff = () => ({ active: false, states: {}, current: [], done: [], upcoming: [], hidden: [] });
  const planKid = (plan, kidKey) => {
    const kids = isObj(plan) ? getOwn(plan, 'kids') : undefined;
    const k = isObj(kids) && isStr(kidKey) ? getOwn(kids, kidKey) : undefined;
    return isObj(k) ? k : null;
  };
  const planPage = (k, pageId) => {
    const pages = getOwn(k, 'pages'), pg = isObj(pages) && isStr(pageId) ? getOwn(pages, pageId) : undefined;
    return isObj(pg) ? pg : null;
  };

  // Pure, never throws. The kid's `order` (string ids, each once at its first position, unsafe keys skipped) gets states:
  // the current ids are `current` (an id or a list; ids not in order ignored), else the last page in order whose valid `from`
  // is on or before `day`; with neither, the plan is not active (states empty: callers behave as without a plan).
  // Before the first current page: done; between the first and last current page: done. Then the override: an id after the
  // last current page with an own key in `unlocked` becomes current (done and current pages are unaffected). The UPCOMING
  // first pages after the last current page that are not current are upcoming (a page the parent skipped stays one of them,
  // never done); the rest after it are hidden. The override alone never makes a plan active. The arrays list ids in plan order.
  function planState(plan, kidKey, day, unlocked) {
    try {
      const k = planKid(plan, kidKey), raw = k ? getOwn(k, 'order') : undefined;
      if (!Array.isArray(raw)) return planOff();
      const order = [];
      for (const id of raw) if (isStr(id) && ID_RE.test(id) && !BAD_KEYS.has(id) && !order.includes(id)) order.push(id);
      let cur = getOwn(k, 'current');
      cur = (isStr(cur) ? [cur] : Array.isArray(cur) ? cur : []).filter(id => order.includes(id));
      if (!cur.length && validDay(day)) {
        const past = order.filter(id => { const from = getOwn(planPage(k, id) || {}, 'from'); return validDay(from) && daysUntil(from, day) !== null; });
        if (past.length) cur = [past[past.length - 1]];
      }
      if (!cur.length) return planOff();
      const last = Math.max(...cur.map(id => order.indexOf(id)));
      const out = planOff(), U = isObj(unlocked) ? unlocked : {};
      let soon = 0;
      order.forEach((id, i) => {
        const s = cur.includes(id) ? 'current' : i < last ? 'done' : own(U, id) ? 'current' : soon++ < UPCOMING ? 'upcoming' : 'hidden';
        out.states[id] = s;
        out[s].push(id);
      });
      out.active = true;
      return out;
    } catch { return planOff(); }
  }

  // The page's default test date in the plan ('YYYY-MM-DD'), or null when absent or malformed. Pure, never throws.
  function planTest(plan, kidKey, pageId) {
    try {
      const k = planKid(plan, kidKey), pg = k ? planPage(k, pageId) : null, t = pg ? getOwn(pg, 'test') : undefined;
      return validDay(t) ? t : null;
    } catch { return null; }
  }

  // Pure, never throws. True when a kid's chapter page shows the soft «not started in class yet» banner: the kid's plan is
  // active (planState with `day` and the kid store's `unlocked`) and the page is upcoming or hidden. False for a current or
  // done page, a page missing from the plan's order, a page the parent unlocked (current through planState), a dormant,
  // missing or pending plan (PLAN_PENDING), and without a kid key or page id.
  function planBanner(plan, kidKey, pageId, day, unlocked) {
    if (plan === PLAN_PENDING || !isStr(kidKey) || !isStr(pageId)) return false;
    const st = planState(plan, kidKey, day, unlocked);
    const s = st.active && own(st.states, pageId) ? st.states[pageId] : null;
    return s === 'upcoming' || s === 'hidden';
  }

  // The test date that counts for a kid's page ('YYYY-MM-DD' or null): the parent's date on this device (the kid store's
  // testDates), else the plan's `test` (planTest on the plan set by usePlan; none while it is pending). A fallback that is
  // never stored. `kid` is the kid store when the caller holds one already (read instead of storage). Never throws.
  function testDateFor(kidKey, pageId, kid) {
    try {
      if (!kidKeyOk(kidKey) || !pageIdOk(pageId)) return null;
      const d = getOwn(isObj(kid) ? kid : kidStore(kidKey), 'testDates');
      if (isObj(d) && own(d, pageId) && validDay(d[pageId])) return d[pageId];
      return knownPlan === PLAN_PENDING ? null : planTest(knownPlan, kidKey, pageId);
    } catch { return null; }
  }

  const Rewards = {
    EXCLUDED, pushResult, rowValue, starsFor, bumpBest, countedRows, pageStars, pagePct,
    dayKey, isoWeek, addDays, newKid, logAnswer, logStars, streak, level, jar, daysUntil,
    BADGES, buildQuest, questStatus, markLow, checkBadges,
    KEY_RE, exportCode, parseCode, mergeAll,
    useStorage, load, save, kidStore, saveKid, family, saveFamily, manifests,
    onPageOpen, ensureQuest, dayQuest, usePlan, PLAN_PENDING, onAnswer, onRoundEnd, onBoss, onJarFull, kidStars, totalStars, jarFill, kidStarsSince, exportAll, importCode, previewImport, weekly,
    bossRound, bossPass, bossHearts, bossOver, bossTaunt, BOSSES, bossFor, nextTab, bossUnlock, planState, planTest, planBanner,
    unlockPage, lockPage, testDateFor,
  };
  if (typeof window !== 'undefined') window.Rewards = Rewards;
  if (typeof module !== 'undefined' && module.exports) module.exports = Rewards;
})();
