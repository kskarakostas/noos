/* Hub view: «Ποιος παίζει;» picker (one kid's block at a time), tile progress and stars, kid header (level, streak),
   daily quest, sticker album, badge wall, family jar and the parent area (weekly note, class plan, jar settings, test dates, backup code). With ?view=teacher: a teacher view instead
   (intro, chapter list, one grade at a time, none of the above).
   With an active class plan (plan.js, window.PLAN) a kid's tiles are laid out in the plan blocks instead of one grid per subject.
   Reads window.CATALOG, window.Rewards, window.PLAN and, when manifest.js loaded, window.NOOS_MANIFEST; holds no school content (engine/ is published as plain files).
   Every string from storage goes through esc(); links only to files matching FILE_RE. Exposes window.Hub. */
(function () {
  'use strict';

  const TXT = {
    notStarted: 'Δεν ξεκίνησε ακόμα ✨',
    progress: n => 'Πρόοδος: ' + n + '%',
    starsOf: (n, max) => '⭐ ' + n + ' / ' + max,
    stars: 'αστέρια',
    total: n => 'συνολική πρόοδος ' + n + '%',
    levelNext: (s, next) => s + ' / ' + next + ' ⭐',
    levelTop: 'Ανώτατο επίπεδο!',
    streakTip: n => n + (n === 1 ? ' μέρα' : ' μέρες') + ' στη σειρά με 10 ή περισσότερες απαντήσεις',
    freezeTip: 'Ένα πάγωμα κράτησε το σερί σου αυτή την εβδομάδα',
    questTitle: '🎯 Αποστολή της ημέρας',
    questDone: 'Μπράβο! Πήρες +1 ⭐',
    questHit: n => 'Κάνε ' + n + ' σωστές',
    questList: 'Ανέβασε την πρόοδο',
    questCards: n => 'Μάθε ' + n + ' νέες κάρτες',
    questEmpty: 'Άνοιξε μια σελίδα για να πάρεις την πρώτη σου αποστολή!',
    openNew: 'Άνοιξε νέο κεφάλαιο',
    album: '📒 Το άλμπουμ μου',
    albumCount: (n, all) => n + ' / ' + all + ' αυτοκόλλητα',
    sealed: 'Άνοιξε τη σελίδα για να δεις τα αυτοκόλλητα',
    stickerOn: 'Το κέρδισες!',
    badges: '🎖️ Τα παράσημά μου',
    badgeCount: (n, all) => n + ' / ' + all,
    secret: 'Μυστικό παράσημο',
    earnedOn: d => 'Το πήρες στις ' + d,
    jarTitle: '🫙 Το βάζο της οικογένειας',
    jarSub: 'Κάθε αστέρι που κερδίζετε μπαίνει στο βάζο. Γεμίστε το μαζί!',
    jarReward: 'Η έκπληξη της οικογένειας',
    jarFull: 'Γέμισε! Πείτε στον μπαμπά! 🎉',
    // who is playing (family view)
    whoTitle: 'Ποιος παίζει;',
    whoSwitch: g => '🔄 Άλλαξε σε ' + g,
    whoAgain: '🔄 Άλλαξε παιδί',
    // parent area
    pGate: '🔒 Για τον γονιό',
    pHint: 'Κράτα πατημένο για 2 δευτερόλεπτα',
    pTitle: '👪 Για τον γονιό',
    pClose: 'Κλείσιμο',
    wTitle: g => '📅 Η εβδομάδα: ' + g,
    wDays: n => 'Μέρες με εξάσκηση: ' + n + ' από 7',
    wAns: (n, pct) => 'Απαντήσεις: ' + n + (n ? ' (' + pct + '% σωστές)' : ''),
    wStars: n => 'Αστέρια: ' + n,
    wBadges: 'Παράσημα: ',
    wNoBadges: 'Παράσημα: κανένα αυτή την εβδομάδα',
    wWeak: 'Θέλουν εξάσκηση:',
    wNoWeak: 'Καμία δραστηριότητα δεν θέλει ιδιαίτερη εξάσκηση αυτή τη στιγμή.',
    jSet: '🫙 Βάζο: στόχος και ανταμοιβή',
    jGoal: 'Στόχος (αστέρια, 5 έως 500)',
    jReward: 'Ανταμοιβή (έως 60 χαρακτήρες)',
    jSave: 'Αποθήκευση',
    jSaved: 'Αποθηκεύτηκε.',
    jBadGoal: 'Ο στόχος πρέπει να είναι ακέραιος αριθμός από 5 έως 500.',
    jBadReward: 'Η ανταμοιβή πρέπει να έχει έως 60 χαρακτήρες.',
    jGiven: 'Δόθηκε η ανταμοιβή',
    jGivenSure: 'Σίγουρα; Πάτα ξανά για επιβεβαίωση',
    jGivenDone: 'Ξεκίνησε νέο βάζο!',
    jNotFull: 'Το κουμπί ενεργοποιείται όταν γεμίσει το βάζο.',
    tTitle: '📝 Ημερομηνίες διαγωνισμάτων',
    tSub: 'Η σελίδα του κεφαλαίου δείχνει αντίστροφη μέτρηση μέχρι το διαγώνισμα.',
    tClear: 'Καθαρισμός',
    tSaved: 'Αποθηκεύτηκε.',
    tCleared: 'Η ημερομηνία καθαρίστηκε.',
    tBad: 'Η ημερομηνία δεν είναι έγκυρη.',
    tPlan: d => 'Από το πρόγραμμα της τάξης: ' + fmtDay(d),
    // class plan card in the parent area (per-device override)
    cpTitle: g => '🗓️ Πρόγραμμα της τάξης: ' + g,
    cpSub: 'Για παιδί που προχωράει πιο γρήγορα από την τάξη. Ισχύει σε αυτή τη συσκευή και περνάει σε άλλη με τον κωδικό αντιγράφου ασφαλείας.',
    cpNow: t => 'Η τάξη τώρα: ' + t,
    cpMine: 'Ξεκλείδωτα σε αυτή τη συσκευή:',
    cpLock: '🔒 Κλείδωσε ξανά',
    cpLockOf: t => 'Κλείδωσε ξανά: ' + t,
    cpNextIs: t => 'Επόμενο: ' + t,
    cpNext: '🔓 Ξεκλείδωσε το επόμενο',
    cpOpened: t => 'Ξεκλειδώθηκε: ' + t,
    cpClosed: t => 'Κλειδώθηκε ξανά: ' + t,
    bTitle: '💾 Αντίγραφο ασφαλείας',
    bSub: 'Ο κωδικός μεταφέρει αστέρια, παράσημα, άλμπουμ και σερί σε άλλη συσκευή.',
    bMake: 'Δημιουργία κωδικού',
    bMakeFail: 'Δεν ήταν δυνατή η δημιουργία κωδικού. Δοκίμασε ξανά.',
    bCodeLabel: 'Ο κωδικός σου',
    bCopy: 'Αντιγραφή',
    bCopied: 'Ο κωδικός αντιγράφηκε.',
    bSelected: 'Ο κωδικός επιλέχτηκε. Αντίγραψέ τον με παρατεταμένο πάτημα ή Ctrl+C.',
    bRestoreLabel: 'Κόλλησε εδώ τον κωδικό από την άλλη συσκευή',
    bRestore: 'Επαναφορά',
    bPreview: n => (n === 1 ? 'Θα ενημερωθεί 1 εγγραφή.' : 'Θα ενημερωθούν ' + n + ' εγγραφές.'),
    bNothing: 'Όλα είναι ήδη ενημερωμένα. Δεν χρειάζεται επαναφορά.',
    bConfirm: 'Ναι, κάνε την επαναφορά',
    bDone: n => 'Η επαναφορά έγινε: ' + (n === 1 ? 'ενημερώθηκε 1 εγγραφή.' : 'ενημερώθηκαν ' + n + ' εγγραφές.'),
    // teacher view (?view=teacher); the teach prefix keeps these apart from the parent area's t* keys (test dates)
    teachTitle: '👩‍🏫 Για τη δασκάλα',
    teachWhat: 'Σελίδες εξάσκησης για τη μελέτη στο σπίτι. Το περιεχόμενο ακολουθεί τα επίσημα σχολικά βιβλία από το ebooks.edu.gr.',
    teachDo: 'Σε κάθε σελίδα το παιδί βρίσκει σύνοψη, κάρτες, κουίζ, «Σωστό ή Λάθος», παιχνίδια και οδηγό για τον γονιό.',
    teachCovers: 'Τι καλύπτει',
    teachStore:'Η πρόοδος αποθηκεύεται μόνο στη συσκευή όπου παίζει το παιδί και δεν στέλνεται πουθενά. Γι’ αυτό δεν μπορείτε να δείτε από εδώ την πρόοδο των μαθητών.',
    teachShared: 'Σε κοινόχρηστο ή σχολικό υπολογιστή, στη σύνδεση βγάλτε το τικ από το «Να με θυμάσαι σε αυτή τη συσκευή».',
    teachPick: 'Τάξη',
    teachExit: 'Έξοδος από προβολή δασκάλας',
    // class plan blocks (plan.js)
    planNow: 'Αυτή την εβδομάδα',
    planReview: 'Επανάληψη',
    planSoon: 'Έρχεται σύντομα',
    planGo: '▶ Συνέχισε',
    planLocked: 'Κλειδωμένο',
  };

  const FILE_RE = /^dim[\w-]+\.html$/;
  const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|[a-z][a-z0-9-]*)$/;
  const PICTO_RE = /\p{Extended_Pictographic}/u;
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const R = () => window.Rewards || null;
  const UI = () => window.RewardsUI || null;
  const kidsOf = () => (window.CATALOG && Array.isArray(window.CATALOG.kids) ? window.CATALOG.kids : []);
  const pagesOf = k => (Array.isArray(k.subjects) ? k.subjects : []).flatMap(s => (Array.isArray(s.pages) ? s.pages : []).map(p => ({ p, s })));
  const colorOf = s => { const c = String((s && s.color) || ''); return !COLOR_RE.test(c) ? 'var(--ok)' : c.charAt(0) === '#' ? c : 'var(--' + c + ')'; };
  const barCol = p => (p >= 0.8 ? '#1f9d61' : p >= 0.5 ? '#e0b02f' : '#d4443b');
  const fmtDay = d => { const [y, m, dd] = String(d).split('-'); return Number(dd) + '/' + Number(m) + '/' + y; };
  const href = f => (typeof f === 'string' && FILE_RE.test(f) ? f : null);
  const step = f => { try { f(); } catch (e) { console.error(e); } };

  // Build-time manifest (manifest.js, window.NOOS_MANIFEST) for a page never opened on this device. Checked like a stored
  // one (rewards.js MANIFEST_T, not exposed): a field of the wrong type is dropped, rows default to []. Missing file: null.
  const ROW_TYPES = ['hit', 'list', 'boss'], ROW_KEY_RE = /^[\w-]{1,64}$/, KID_RE = /^[\w-]{1,32}$/;
  const isStr = x => typeof x === 'string';
  const rowOk = r => Array.isArray(r) && r.length === 3 && r.every(isStr) && ROW_KEY_RE.test(r[0]) && ROW_TYPES.includes(r[2]);
  const GEN_T = { file: f => isStr(f) && FILE_RE.test(f), kid: k => isStr(k) && KID_RE.test(k), title: t => isStr(t) && t.length <= 200,
    rows: rs => Array.isArray(rs) && rs.every(rowOk) };
  function generated(id) {
    const all = window.NOOS_MANIFEST, v = own(all, id) ? all[id] : null;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const out = { rows: [] };
    for (const f of Object.keys(GEN_T)) if (own(v, f) && GEN_T[f](v[f])) out[f] = v[f];
    return out;
  }

  // Per-render reads: manifests once, each progress store and kid store at most once.
  // man(id): the device manifest, else the build-time one; opened(id): the device has a manifest (the page was opened here);
  // test(kid, id): the effective test date (Rewards.testDateFor: the device date, else the plan's `test`).
  function context(rw) {
    const ms = rw.manifests(), progs = new Map(), kids = new Map();
    return {
      rw, ms, day: rw.dayKey(new Date()),
      man: id => (own(ms, id) ? ms[id] : generated(id)),
      opened: id => own(ms, id),
      prog: id => { if (!progs.has(id)) progs.set(id, rw.load('progress_' + id)); return progs.get(id); },
      test: (kid, id) => { if (!kids.has(kid)) kids.set(kid, rw.kidStore(kid)); return rw.testDateFor(kid, id, kids.get(kid)); },
    };
  }

  const maxStars = (rw, rows) => rw.countedRows(rows).length * 3 + rows.filter(r => r[2] === 'boss').length * 3;

  /* ---------- tiles: bar and % as before (now from Rewards.pagePct), plus page stars when a manifest exists ---------- */
  function tiles(c) {
    const totals = {};
    document.querySelectorAll('a.tile[data-id]').forEach(t => {
      const id = t.dataset.id, m = c.man(id), prog = c.prog(id);
      const p = c.rw.pagePct(prog, m && m.rows.length ? m.rows : null);   // no rows known: every counted key, as before
      const bar = t.querySelector('.bar>div'), lab = t.querySelector('.pct');
      if (p === null) { bar.style.width = '0'; lab.textContent = TXT.notStarted; }
      else { bar.style.width = (p * 100) + '%'; bar.style.background = barCol(p); lab.textContent = TXT.progress(Math.round(p * 100)); }
      let st = t.querySelector('.rw-tstars');
      if (m && m.rows.length) {
        if (!st) { st = document.createElement('span'); st.className = 'rw-tstars'; lab.insertAdjacentElement('beforebegin', st); }
        st.textContent = TXT.starsOf(c.rw.pageStars(prog || {}, m.rows), maxStars(c.rw, m.rows));
      } else if (st) st.remove();
      const sec = t.closest('[data-kid]');
      if (sec) (totals[sec.dataset.kid] = totals[sec.dataset.kid] || []).push(p || 0);
      step(() => tileCount(t, c, sec ? sec.dataset.kid : null, id, m, prog));
    });
    return totals;
  }

  // Test countdown on the tile, worded as the page banner (RewardsUI.TXT); the boss nudge follows the page rule:
  // the page has a boss row and is below its maximum stars. Nothing for a missing or past date.
  function tileCount(t, c, kid, id, m, prog) {
    const ui = UI(), T = ui && ui.TXT, d = kid ? c.test(kid, id) : null;
    const n = T && d ? c.rw.daysUntil(c.day, d) : null;
    let box = t.querySelector('.rw-tcount');
    if (n === null) { if (box) box.remove(); return; }
    if (!box) {
      box = mk('span', 'rw-tcount');
      const desc = t.querySelector('.desc');
      if (desc) desc.insertAdjacentElement('afterend', box); else t.querySelector('.pct').insertAdjacentElement('beforebegin', box);
    }
    box.className = 'rw-tcount' + (n <= 1 ? ' soon' : '');
    box.textContent = '';
    box.appendChild(mk('b', '', '📅 ' + (n === 0 ? T.testToday : n === 1 ? T.testTomorrow : T.testIn(n))));
    const rows = m && m.rows.length ? m.rows : null;
    if (rows && rows.some(r => r[2] === 'boss') && c.rw.pageStars(prog || {}, rows) < maxStars(c.rw, rows)) box.appendChild(mk('small', '', T.bossNudge));
  }

  /* ---------- kid header: level with a thin bar, stars, streak with freeze, total % ---------- */
  function head(sec, k, c, avg) {
    const rw = c.rw, stars = rw.kidStars(k.key), lv = rw.level(stars), kid = rw.kidStore(k.key);
    const st = rw.streak(kid, c.day), froze = own(kid.freezes, rw.isoWeek(c.day));
    const lvl = sec.querySelector('[data-rw="lvl"]');
    if (lvl) {
      const pct = Math.round(Math.max(0, Math.min(1, lv.frac)) * 100);
      lvl.innerHTML = '<span class="rw-lvl-name">🏅 ' + esc(lv.name) + '</span>'
        + '<span class="rw-lvl-bar" role="progressbar" aria-label="' + esc(lv.name) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">'
        + '<span style="width:' + pct + '%"></span></span>'
        + '<span class="rw-lvl-next">' + esc(lv.next === null ? TXT.levelTop : TXT.levelNext(stars, lv.next)) + '</span>';
    }
    const se = sec.querySelector('[data-rw="stars"]');
    if (se) se.textContent = '⭐ ' + stars;
    const sk = sec.querySelector('[data-rw="streak"]');
    if (sk) {
      sk.className = 'rw-streak' + (st.count ? '' : ' zero');
      sk.setAttribute('role', 'img');
      sk.title = TXT.streakTip(st.count) + (froze ? '. ' + TXT.freezeTip : '');
      sk.setAttribute('aria-label', sk.title);
      sk.textContent = '🔥 ' + st.count + (froze ? ' 🧊' : '');
    }
    const tot = sec.querySelector('[data-rw="total"]');
    if (tot) tot.textContent = TXT.total(avg);
  }

  /* ---------- daily quest card ---------- */
  // With an active class plan the tasks follow it (Rewards.ensureQuest): a current page never opened here still gives tasks
  // from its build-time manifest, and «Άνοιξε νέο κεφάλαιο» suggests current pages, then done pages, then catalog pages
  // missing from the plan; never an upcoming or hidden one, nor a page that already has a task.
  function quest(sec, k, c) {
    const host = sec.querySelector('[data-rw="quest"]');
    if (!host) return;
    const rw = c.rw, ks = rw.kidStore(k.key), unlocked = ks && ks.unlocked;   // `unlocked`: slice 4; read as is, planState checks it
    const plan = rw.planState(window.PLAN, k.key, c.day, unlocked), extra = {};
    if (plan.active) for (const id of plan.current) { const m = c.opened(id) ? null : c.man(id); if (m) extra[id] = m; }
    let pages = pagesOf(k);
    if (plan.active) {
      const rank = id => (plan.states[id] === 'current' ? 0 : plan.states[id] === 'done' ? 1 : own(plan.states, id) ? -1 : 2);
      const at = id => plan.current.concat(plan.done).indexOf(id);
      pages = pages.filter(x => rank(String(x.p.id)) >= 0)
        .sort((a, b) => rank(String(a.p.id)) - rank(String(b.p.id)) || at(String(a.p.id)) - at(String(b.p.id)));
    }
    let st = { tasks: [], allDone: false };
    rw.usePlan(window.PLAN);   // ensureQuest then reads the plan and the kid store's `unlocked` itself
    const q = rw.ensureQuest(k.key, c.day, { extra });   // an empty quest is rebuilt once the kid has a manifest (questFor)
    if (q && Array.isArray(q.tasks)) {
      const lens = {};
      for (const t of q.tasks) {
        if (!t || t.type === 'hit') continue;
        const p = c.prog(String(t.pageId)) || {}, rec = own(p, t.key) ? p[t.key] : null;
        lens[t.pageId + ':' + t.key] = rec && Array.isArray(rec.list) ? rec.list.length : 0;
      }
      st = rw.questStatus(rw.kidStore(k.key), c.day, lens);
    }
    const items = st.tasks.map(t => {
      const m = c.man(String(t.pageId)), title = m && typeof m.title === 'string' ? m.title : '';
      const target = Number(t.target) || 0, count = Math.min(Number(t.count) || 0, target);
      const label = typeof t.label === 'string' ? t.label : String(t.key);
      const what = (t.type === 'hit' ? TXT.questHit(target) : t.key === 'cards' && target > 1 ? TXT.questCards(target) : TXT.questList)
        + (title ? ', «' + title + '»' : '');
      const link = href(t.file), tag = link ? 'a' : 'div';
      return '<' + tag + ' class="rw-hq-task' + (t.done ? ' done' : '') + '"' + (link ? ' href="' + esc(link) + '"' : '') + '>'
        + '<span class="rw-hq-txt"><b>' + esc(label) + '</b><small>' + esc(what) + '</small></span>'
        + '<span class="rw-hq-c">' + (t.done ? '✓' : esc(count + '/' + target)) + '</span></' + tag + '>';
    });
    // Fewer than 3 known activities: suggest catalog pages never opened on this device.
    const tasked = new Set(st.tasks.map(t => String(t.pageId)));
    for (const { p } of pages) {
      if (items.length >= 3) break;
      const link = href(p.file);
      if (!link || c.opened(p.id) || (plan.active && tasked.has(String(p.id)))) continue;
      items.push('<a class="rw-hq-task new" href="' + esc(link) + '"><span class="rw-hq-txt"><b>' + esc(TXT.openNew) + '</b><small>'
        + esc(p.title) + '</small></span><span class="rw-hq-c">➜</span></a>');
    }
    host.className = 'rw-hq' + (st.allDone ? ' all' : '');
    host.innerHTML = '<div class="rw-hq-h"><b>' + esc(TXT.questTitle) + (st.allDone ? ' ✓' : '') + '</b>'
      + (st.allDone ? '<span>' + esc(TXT.questDone) + '</span>' : '') + '</div>'
      + (items.length ? '<div class="rw-hq-list">' + items.join('') + '</div>' : '<p class="rw-hq-empty">' + esc(TXT.questEmpty) + '</p>');
  }

  // A <details> keeps its open state across re-renders.
  function fold(host, cls, summary, body) {
    const old = host.querySelector('details'), open = !!(old && old.open);
    host.innerHTML = '<details class="rw-fold ' + cls + '"' + (open ? ' open' : '') + '><summary><span class="rw-fold-h">' + summary + '</span></summary>' + body + '</details>';
  }

  /* ---------- sticker album: one page per catalog page, one slot per counted row plus the boss ---------- */
  function album(sec, k, c) {
    const host = sec.querySelector('[data-rw="album"]');
    if (!host) return;
    let got = 0, all = 0;
    const cards = pagesOf(k).map(({ p, s }) => {
      const m = c.man(p.id), link = href(p.file);
      const name = '<b class="rw-apage-t">' + esc(p.emo || '') + ' ' + esc(p.title || '') + '</b>';
      if (!m || !m.rows.length) {
        const inner = name + '<span class="rw-seal" aria-hidden="true">🔒</span><span class="rw-seal-t">' + esc(TXT.sealed) + '</span>';
        return link ? '<a class="rw-apage sealed" href="' + esc(link) + '">' + inner + '</a>' : '<div class="rw-apage sealed">' + inner + '</div>';
      }
      const prog = c.prog(p.id) || {};
      const rows = c.rw.countedRows(m.rows).concat(m.rows.filter(r => r[2] === 'boss'));
      const slots = rows.map(([key, label, type]) => {
        const words = String(label).trim().split(/\s+/), first = words[0] || '';
        const hasEmo = PICTO_RE.test(first), rest = hasEmo ? words.slice(1).join(' ') : String(label);
        const boss = type === 'boss', rec = own(prog, key) ? prog[key] : null;
        const on = boss ? !!(rec && rec.won === true) : !!(rec && rec.best === 3);
        all++; if (on) got++;
        const emo = boss && on ? '🏆' : hasEmo ? first : '⭐';
        return '<div class="rw-slot' + (on ? ' on' : '') + '" title="' + esc(label) + '">'
          + '<span class="rw-sticker' + (on ? (boss ? ' gold' : ' on') : '') + '" aria-hidden="true">' + esc(emo) + '</span>'
          + '<span class="rw-slot-t">' + esc(rest) + '</span>'
          + (on ? '<span class="rw-slot-ok">' + esc(TXT.stickerOn) + '</span>' : '') + '</div>';
      });
      return '<div class="rw-apage" style="--subj:' + colorOf(s) + '">' + name + '<div class="rw-slots">' + slots.join('') + '</div></div>';
    });
    fold(host, 'rw-album', esc(TXT.album) + '<span class="rw-fold-n">' + esc(TXT.albumCount(got, all)) + '</span>',
      '<div class="rw-apages">' + cards.join('') + '</div>');
  }

  /* ---------- badge wall: earned in colour with date, locked in grey, secret locked as «;» ---------- */
  function badges(sec, k, c) {
    const host = sec.querySelector('[data-rw="badges"]');
    if (!host) return;
    const have = c.rw.kidStore(k.key).badges;
    let n = 0;
    const cells = c.rw.BADGES.map(b => {
      const d = own(have, b.id) ? have[b.id] : null;
      if (d) {
        n++;
        return '<div class="rw-badge"><span class="emo" aria-hidden="true">' + esc(b.emo) + '</span><b>' + esc(b.name) + '</b>'
          + '<small>' + esc(b.desc) + '</small><span class="rw-badge-d">' + esc(TXT.earnedOn(fmtDay(d))) + '</span></div>';
      }
      if (b.secret) return '<div class="rw-badge locked secret"><span class="emo" aria-hidden="true">;</span><b>' + esc(TXT.secret) + '</b></div>';
      return '<div class="rw-badge locked"><span class="emo" aria-hidden="true">' + esc(b.emo) + '</span><b>' + esc(b.name) + '</b>'
        + '<small>' + esc(b.desc) + '</small></div>';
    });
    fold(host, 'rw-badges', esc(TXT.badges) + '<span class="rw-fold-n">' + esc(TXT.badgeCount(n, c.rw.BADGES.length)) + '</span>',
      '<div class="rw-bwall">' + cells.join('') + '</div>');
  }

  /* ---------- family jar: after the shown kid's block, or after the «Ποιος παίζει;» picker while no kid is chosen ---------- */
  function jarView(c) {
    const rw = c.rw, fam = rw.family(), j = rw.jar(rw.totalStars(), fam);
    const secs = [...document.querySelectorAll('section.kid[data-kid]')];
    if (!secs.length) return;
    const anchor = secs.find(s => !s.hidden) || document.getElementById('rwWho') || secs[0];
    let box = document.getElementById('rwJar');
    if (!box) {
      box = document.createElement('section');
      box.id = 'rwJar';
    }
    if (anchor.nextElementSibling !== box) anchor.insertAdjacentElement('afterend', box);
    const reward = typeof fam.jarReward === 'string' && fam.jarReward.trim() ? fam.jarReward : TXT.jarReward;
    const pct = Math.round(Math.min(1, j.goal ? j.fill / j.goal : 0) * 100);
    box.className = 'rw-hjar' + (j.full ? ' full' : '');
    box.innerHTML = '<div class="rw-jar" role="img" aria-label="' + esc(TXT.starsOf(j.fill, j.goal)) + '"><div class="rw-jar-fill" style="height:' + pct + '%"></div>'
      + '<span class="rw-jar-n">' + esc(j.fill + '/' + j.goal) + '</span></div>'
      + '<div class="rw-hjar-txt"><h3>' + esc(TXT.jarTitle) + '</h3><p>' + esc(TXT.jarSub) + '</p>'
      + '<p class="rw-hjar-n">' + esc(TXT.starsOf(j.fill, j.goal)) + '</p>'
      + '<p class="rw-hjar-reward">🎁 ' + esc(reward) + '</p>'
      + (j.full ? '<p class="rw-hjar-full" role="status">' + esc(TXT.jarFull) + '</p>' : '') + '</div>';
    // R20: celebrate once per jar; jarCelebrated holds the jarSpent value of the jar already celebrated.
    if (j.full && fam.jarCelebrated !== fam.jarSpent) {
      const helpers = kidsOf().map(k => k.key).filter(key => rw.kidStarsSince(key, fam.launch) > 0);   // stars since launch only
      const got = rw.onJarFull(helpers);   // before marking the jar celebrated: a throw here leaves it to the next render
      fam.jarCelebrated = fam.jarSpent;
      rw.saveFamily(fam);
      const ids = [...new Set(Object.keys(got).reduce((a, key) => a.concat(got[key]), []))];   // one toast per badge, not per kid
      const ui = UI();
      if (ui) {
        ui.toast(TXT.jarFull, '🫙');
        if (ids.length) ui.celebrate({ starsUp: null, sticker: false, badges: ids, questDone: false });
        else { ui.confetti(); ui.sound('win'); }
      }
    }
  }

  /* ---------- parent area: a 2 s hold gate (light, not security), weekly notes, jar settings, test dates, backup ---------- */
  const HOLD_MS = 2000, ARM_MS = 5000, GOAL_MIN = 5, GOAL_MAX = 500, REWARD_MAX = 60;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const pState = { open: false };
  let holdStop = null;   // the live gate's cancel; one document listener stops a hold when the page is hidden
  let visBound = false;

  function mk(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function msg(node, text, bad) {
    node.textContent = text || '';
    node.className = 'rw-msg' + (bad ? ' err' : '');
  }
  function btn(text, cls) { const b = mk('button', 'rw-pbtn' + (cls ? ' ' + cls : ''), text); b.type = 'button'; return b; }

  // Press and hold: pointer (mouse, touch, pen) or Enter/Space. Release before HOLD_MS cancels; a click alone does nothing.
  function gate(host) {
    const b = mk('button', 'rw-gate');
    b.type = 'button';
    b.setAttribute('aria-describedby', 'rwGateHint');
    b.innerHTML = '<svg class="rw-ring" viewBox="0 0 36 36" aria-hidden="true"><circle class="bg" cx="18" cy="18" r="15.9"/>'
      + '<circle class="fg" cx="18" cy="18" r="15.9" pathLength="100"/></svg><span></span>';
    b.querySelector('span').textContent = TXT.pGate;
    const hint = mk('small', 'rw-gate-hint', TXT.pHint);
    hint.id = 'rwGateHint';
    let timer = null;
    const stop = () => { clearTimeout(timer); timer = null; b.classList.remove('holding'); };
    const start = () => {
      if (timer) return;
      b.classList.add('holding');
      timer = setTimeout(() => { stop(); pState.open = true; render(); const t = document.getElementById('rwPTitle'); if (t) t.focus(); }, HOLD_MS);
    };
    b.addEventListener('pointerdown', e => { if (e.button === 0) { try { b.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ } start(); } });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, stop));
    b.addEventListener('pointerleave', e => { if (!b.hasPointerCapture || !b.hasPointerCapture(e.pointerId)) stop(); });   // capture refused
    holdStop = stop;
    if (!visBound) { visBound = true; document.addEventListener('visibilitychange', () => { if (document.hidden && holdStop) holdStop(); }); }
    b.addEventListener('contextmenu', e => e.preventDefault());   // a long touch must not open the context menu
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) start(); } });
    b.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') stop(); });
    b.addEventListener('blur', stop);
    host.append(b, hint);
  }

  function weeklyNotes(box, c) {
    box.textContent = '';
    for (const k of kidsOf()) {
      const w = c.rw.weekly(k.key, c.day), card = mk('div', 'rw-week');
      card.appendChild(mk('h4', '', TXT.wTitle(String(k.grade || k.key))));
      const ul = mk('ul', 'rw-week-l');
      const names = w.badges.map(id => c.rw.BADGES.find(b => b.id === id)).filter(Boolean).map(b => b.emo + ' ' + b.name);
      [TXT.wDays(w.daysActive), TXT.wAns(w.n, w.n ? Math.round(w.ok / w.n * 100) : 0), TXT.wStars(w.stars),
        names.length ? TXT.wBadges + names.join(', ') : TXT.wNoBadges].forEach(t => ul.appendChild(mk('li', '', t)));
      card.appendChild(ul);
      if (w.weakest.length) {
        card.appendChild(mk('p', 'rw-week-wh', TXT.wWeak));
        const wl = mk('ul', 'rw-week-weak');
        for (const r of w.weakest) {
          const m = c.man(String(r.pageId)), li = mk('li'), link = href(r.file);
          const a = mk(link ? 'a' : 'span', 'rw-week-a');
          if (link) a.href = link;
          a.appendChild(mk('b', '', String(r.label)));
          a.appendChild(mk('small', '', (m && typeof m.title === 'string' ? m.title + ', ' : '') + Math.round(r.value * 100) + '%'));
          li.appendChild(a); wl.appendChild(li);
        }
        card.appendChild(wl);
      } else card.appendChild(mk('p', 'rw-week-none', TXT.wNoWeak));
      box.appendChild(card);
    }
  }

  function jarSettings(box) {
    const rw = R(), fam = rw.family();
    box.appendChild(mk('h4', '', TXT.jSet));
    const goal = mk('input'), reward = mk('input');
    Object.assign(goal, { type: 'number', min: GOAL_MIN, max: GOAL_MAX, step: 1, id: 'rwJGoal', value: String(rw.jar(0, fam).goal) });
    goal.inputMode = 'numeric';
    Object.assign(reward, { type: 'text', maxLength: REWARD_MAX, id: 'rwJReward', value: typeof fam.jarReward === 'string' ? fam.jarReward : '' });
    const lg = mk('label', 'rw-field', TXT.jGoal), lr = mk('label', 'rw-field', TXT.jReward);
    lg.htmlFor = 'rwJGoal'; lr.htmlFor = 'rwJReward';
    const save = btn(TXT.jSave), out = mk('p', 'rw-msg');
    out.setAttribute('role', 'status');
    save.onclick = () => {
      const g = Number(goal.value), text = reward.value.trim();
      if (!goal.value.trim() || !Number.isInteger(g) || g < GOAL_MIN || g > GOAL_MAX) return msg(out, TXT.jBadGoal, true);
      if (text.length > REWARD_MAX) return msg(out, TXT.jBadReward, true);
      const f = R().family();
      f.jarGoal = g; f.jarReward = text;
      if (!R().jar(R().totalStars(), f).full) delete f.jarCelebrated;   // a jar refilled under a new goal is celebrated again
      R().saveFamily(f);
      msg(out, TXT.jSaved);
      render();
      syncForms();
    };
    const give = btn(TXT.jGiven, 'rw-give'), gout = mk('p', 'rw-msg'), ghint = mk('p', 'rw-psub', TXT.jNotFull);
    give.id = 'rwGive'; ghint.id = 'rwGiveHint'; give.setAttribute('aria-describedby', 'rwGiveHint');
    gout.setAttribute('role', 'status');
    let armed = null;
    const disarm = () => { clearTimeout(armed); armed = null; give.textContent = TXT.jGiven; give.classList.remove('armed'); };
    give.onclick = () => {
      if (!armed) { give.textContent = TXT.jGivenSure; give.classList.add('armed'); armed = setTimeout(disarm, ARM_MS); return; }
      disarm();
      const f = R().family(), j = R().jar(R().totalStars(), f);
      if (!j.full) return msg(gout, TXT.jNotFull, true);
      f.jarSpent = (Number(f.jarSpent) || 0) + j.goal;
      R().saveFamily(f);
      msg(gout, TXT.jGivenDone);
      render();
      syncForms();
    };
    box.append(lg, goal, lr, reward, save, out, give, ghint, gout);
  }

  // Puts stored values back into the open panel's inputs (after a restore or any save in the panel).
  function syncForms() {
    const rw = R(), host = document.getElementById('rwParent');
    if (!rw || !host) return;
    const fam = rw.family(), g = document.getElementById('rwJGoal'), r = document.getElementById('rwJReward'), cache = {};
    if (g) g.value = String(rw.jar(0, fam).goal);
    if (r) r.value = typeof fam.jarReward === 'string' ? fam.jarReward : '';
    host.querySelectorAll('input[type=date][data-kid]').forEach(i => {
      const k = i.dataset.kid, d = cache[k] || (cache[k] = rw.kidStore(k).testDates);
      i.value = own(d, i.dataset.page) ? d[i.dataset.page] : '';
      step(() => planHint(i));
    });
  }

  // Next to a test-date field: the plan's `test` date as a hint while the device has no date of its own (the field keeps
  // only the device value; Rewards.testDateFor falls back to the plan). No hint element at all otherwise.
  function planHint(inp) {
    const rw = R(), row = inp.parentElement, id = inp.id + '_plan';
    let hint = row.querySelector('.rw-thint');
    const d = !inp.value && rw ? rw.planTest(window.PLAN, inp.dataset.kid, inp.dataset.page) : null;
    if (!d) { if (hint) { hint.remove(); inp.removeAttribute('aria-describedby'); } return; }
    if (!hint) {
      hint = mk('small', 'rw-thint');
      hint.id = id;
      const out = row.querySelector('.rw-msg');
      if (out) out.insertAdjacentElement('beforebegin', hint); else row.appendChild(hint);
      inp.setAttribute('aria-describedby', id);
    }
    hint.textContent = TXT.tPlan(d);
  }

  // The «Δόθηκε η ανταμοιβή» button is live only while the jar is full; refreshed on every render.
  function giveState() {
    const g = document.getElementById('rwGive'), hint = document.getElementById('rwGiveHint');
    if (!g) return;
    const rw = R(), full = rw.jar(rw.totalStars(), rw.family()).full;
    g.disabled = !full;
    if (hint) hint.hidden = full;
  }

  function testDates(box, c) {
    box.appendChild(mk('h4', '', TXT.tTitle));
    box.appendChild(mk('p', 'rw-psub', TXT.tSub));
    for (const k of kidsOf()) {
      const pages = pagesOf(k);
      if (!pages.length) continue;
      box.appendChild(mk('h5', '', String(k.grade || k.key)));
      for (const { p } of pages) {
        const id = String(p.id || '');
        if (!id) continue;
        const row = mk('div', 'rw-trow'), inp = mk('input'), lab = mk('label', 'rw-tlab', (p.emo ? p.emo + ' ' : '') + String(p.title || id));
        const dates = c.rw.kidStore(k.key).testDates;
        Object.assign(inp, { type: 'date', id: 'rwT_' + k.key + '_' + id, min: c.day, value: own(dates, id) ? dates[id] : '' });
        inp.dataset.kid = k.key; inp.dataset.page = id;
        lab.htmlFor = inp.id;
        const clr = btn(TXT.tClear, 'rw-tclr'), out = mk('span', 'rw-msg');
        out.setAttribute('role', 'status');
        const put = v => {
          const kid = R().kidStore(k.key);
          if (v) kid.testDates[id] = v; else delete kid.testDates[id];
          R().saveKid(k.key, kid);
          render();   // the tile countdown follows at once
          syncForms();
        };
        inp.onchange = () => {
          const v = inp.value;
          if (!v) { put(''); return msg(out, TXT.tCleared); }
          if (!DATE_RE.test(v) || R().addDays(v, 0) !== v) return msg(out, TXT.tBad, true);
          put(v); msg(out, TXT.tSaved);
        };
        clr.onclick = () => { inp.value = ''; put(''); msg(out, TXT.tCleared); };
        clr.setAttribute('aria-label', TXT.tClear + ': ' + lab.textContent);
        row.append(lab, inp, clr, out);
        box.appendChild(row);
        step(() => planHint(inp));
      }
    }
  }

  function backup(box) {
    box.appendChild(mk('h4', '', TXT.bTitle));
    box.appendChild(mk('p', 'rw-psub', TXT.bSub));
    const make = btn(TXT.bMake), mout = mk('p', 'rw-msg'), codeWrap = mk('div', 'rw-code');
    mout.setAttribute('role', 'status');
    make.onclick = () => {
      codeWrap.textContent = '';
      const code = R().exportAll();
      if (typeof code !== 'string' || !code) return msg(mout, TXT.bMakeFail, true);
      msg(mout, '');
      const ta = mk('textarea', 'rw-ta'), lab = mk('label', 'rw-field', TXT.bCodeLabel), copy = btn(TXT.bCopy);
      ta.id = 'rwCode'; ta.readOnly = true; ta.rows = 4; ta.value = code; ta.spellcheck = false;
      lab.htmlFor = 'rwCode';
      const fallback = () => { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); msg(mout, TXT.bSelected); };   // iOS needs the range
      copy.onclick = () => {
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(code).then(() => msg(mout, TXT.bCopied), fallback);
          } else fallback();
        } catch (e) { fallback(); }
      };
      codeWrap.append(lab, ta, copy);
    };
    const rlab = mk('label', 'rw-field', TXT.bRestoreLabel), rta = mk('textarea', 'rw-ta'), restore = btn(TXT.bRestore);
    rta.id = 'rwRestore'; rta.rows = 4; rta.spellcheck = false; rta.autocomplete = 'off';
    rlab.htmlFor = 'rwRestore';
    const rout = mk('p', 'rw-msg'), confirm = btn(TXT.bConfirm, 'rw-confirm');
    rout.setAttribute('role', 'status');
    confirm.hidden = true;
    let pending = null;   // the exact code that was previewed; editing the box drops it
    const reset = () => { pending = null; confirm.hidden = true; };
    rta.addEventListener('input', () => { reset(); msg(rout, ''); });
    restore.onclick = () => {
      reset();
      const pre = R().previewImport(rta.value);
      if (!pre.ok) return msg(rout, pre.error, true);
      if (!pre.changed.length) return msg(rout, TXT.bPreview(0) + ' ' + TXT.bNothing);
      pending = rta.value;
      msg(rout, TXT.bPreview(pre.changed.length));
      confirm.hidden = false;
      confirm.focus();
    };
    confirm.onclick = () => {
      if (pending === null) return;
      const res = R().importCode(pending);
      reset();
      if (!res.ok) return msg(rout, res.error, true);
      msg(rout, TXT.bDone(res.changed.length));
      render();
      syncForms();
    };
    box.append(make, mout, codeWrap, rlab, rta, restore, rout, confirm);
  }

  // One card per kid with an active class plan, right after the weekly notes; rebuilt on every render (a kid whose plan is
  // not active has none). It names the class's current chapters (planState without the override), lists the chapters
  // unlocked on this device with «Κλείδωσε ξανά» each, and offers «Ξεκλείδωσε το επόμενο» for the first upcoming page.
  // One tap each (easily undone); the hub re-renders at once. The card and its status line are reused across rebuilds so
  // the status is announced, and focus moves to the control that undoes the tap.
  const planMsgs = new Map();   // kid key -> the card's status node
  let planFocus = null;         // set by a tap: [id to focus after the rebuild, fallback id]
  function planCards(c) {
    let prev = document.getElementById('rwWeeks');
    if (!prev) return;
    for (const k of kidsOf()) {
      const cid = 'rwPlan_' + k.key, ks = c.rw.kidStore(k.key), U = ks.unlocked;
      const st = c.rw.planState(window.PLAN, k.key, c.day, U);
      let card = document.getElementById(cid);
      if (!st.active) { if (card) card.remove(); planMsgs.delete(k.key); continue; }
      const cls = c.rw.planState(window.PLAN, k.key, c.day, {});
      const names = new Map(pagesOf(k).map(({ p }) => [String(p.id), (p.emo ? p.emo + ' ' : '') + String(p.title || p.id)]));
      const name = id => names.get(id) || id;
      if (!card) { card = mk('div', 'rw-pcard rw-plancard'); card.id = cid; }
      if (card.previousElementSibling !== prev) prev.insertAdjacentElement('afterend', card);
      prev = card;
      let out = planMsgs.get(k.key);
      if (!out) { out = mk('p', 'rw-msg'); out.setAttribute('role', 'status'); planMsgs.set(k.key, out); }
      const h = mk('h4', '', TXT.cpTitle(String(k.grade || k.key)));
      h.tabIndex = -1; h.id = cid + '_h';
      card.replaceChildren(h, mk('p', 'rw-psub', TXT.cpSub), mk('p', 'rw-cpnow', TXT.cpNow(cls.current.map(name).join(', '))));
      const mine = Object.keys(st.states).filter(id => own(U, id));
      if (mine.length) {
        card.appendChild(mk('p', 'rw-week-wh', TXT.cpMine));
        for (const id of mine) {
          const row = mk('div', 'rw-trow'), lock = btn(TXT.cpLock);
          lock.id = cid + '_lock_' + id;
          lock.setAttribute('aria-label', TXT.cpLockOf(name(id)));
          lock.onclick = () => {
            if (R().lockPage(k.key, id)) msg(out, TXT.cpClosed(name(id)));
            planFocus = [cid + '_next', h.id];
            render();
          };
          row.append(mk('span', 'rw-tlab', name(id)), lock);
          card.appendChild(row);
        }
      }
      const next = st.upcoming[0];
      if (next) {
        const is = mk('p', 'rw-psub', TXT.cpNextIs(name(next))), go = btn(TXT.cpNext);
        is.id = cid + '_nextis'; go.id = cid + '_next';
        go.setAttribute('aria-describedby', is.id);
        go.onclick = () => {
          if (R().unlockPage(k.key, next)) msg(out, TXT.cpOpened(name(next)));
          planFocus = [cid + '_lock_' + next, h.id];
          render();
        };
        card.append(is, go);
      }
      card.appendChild(out);
    }
    if (planFocus) {
      const f = document.getElementById(planFocus[0]) || document.getElementById(planFocus[1]);
      planFocus = null;
      if (f) f.focus();
    }
  }

  function parentView(c) {
    const host = document.getElementById('rwParent');
    if (!host) return;
    const built = host.dataset.state;
    if (!pState.open) {
      if (built === 'gate') return;
      host.textContent = ''; host.className = 'rw-parent'; host.dataset.state = 'gate';
      gate(host);
      return;
    }
    if (built !== 'open') {
      host.textContent = ''; host.className = 'rw-parent open'; host.dataset.state = 'open';
      const head = mk('div', 'rw-phead'), h = mk('h3', '', TXT.pTitle), close = btn(TXT.pClose, 'rw-pclose');
      h.id = 'rwPTitle'; h.tabIndex = -1;
      close.onclick = () => { pState.open = false; planMsgs.clear(); render(); const g = host.querySelector('.rw-gate'); if (g) g.focus(); };
      head.append(h, close);
      const weeks = mk('div', 'rw-weeks'), jarBox = mk('div', 'rw-pcard'), tBox = mk('div', 'rw-pcard'), bBox = mk('div', 'rw-pcard');
      weeks.id = 'rwWeeks';
      // Each block is independent: one that throws must not take the others down.
      step(() => jarSettings(jarBox));
      step(() => testDates(tBox, c));
      step(() => backup(bBox));
      host.append(head, weeks, jarBox, tBox, bBox);
    }
    // Live parts follow every render; the forms keep what the parent typed.
    step(() => weeklyNotes(document.getElementById('rwWeeks'), c));
    step(() => planCards(c));
    step(giveState);
  }

  /* ---------- sound toggle in the hero, made once ---------- */
  function soundOnce() {
    const hero = document.querySelector('.hero'), ui = UI();
    if (!hero || !ui || hero.querySelector('.rw-snd')) return;
    const wrap = document.createElement('div');
    wrap.className = 'rw-hsnd';
    if (ui.soundToggle(wrap)) hero.appendChild(wrap);
  }

  /* ---------- teacher view (route A): ?view=teacher keeps it on this device, ?view=family or the exit link turns it off ---------- */
  const VIEW_KEY = 'noos_view', GRADE_KEY = 'noos_view_grade';
  const sGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const sSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* blocked storage: the choice lasts for this page only */ } };
  const sDel = k => { try { localStorage.removeItem(k); } catch (e) { /* nothing stored */ } };
  function viewMode() {
    let q = null;
    try { q = new URLSearchParams(location.search).get('view'); } catch (e) { /* no location */ }
    if (q === 'teacher') sSet(VIEW_KEY, 'teacher');
    else if (q === 'family') sDel(VIEW_KEY);
    return q === 'teacher' || (q !== 'family' && sGet(VIEW_KEY) === 'teacher');
  }
  const TEACH = viewMode();

  // Intro, chapter list from the catalog, grade picker; one grade section shown at a time.
  function teacherView() {
    const kids = kidsOf(), secs = [...document.querySelectorAll('section.kid[data-kid]')];
    if (!secs.length) return;
    let pick = document.getElementById('rwTPick');
    if (!pick) {
      const covers = kids.flatMap(k => (Array.isArray(k.subjects) ? k.subjects : []).map(s => {
        const titles = (Array.isArray(s.pages) ? s.pages : []).map(p => esc(p.title || '')).join(', ');
        return '<li><b>' + esc(k.grade || k.key) + ', ' + esc(s.name || '') + ':</b> ' + titles + '</li>';
      }));
      const box = mk('section', 'teach');
      box.id = 'rwTeach';
      box.setAttribute('aria-labelledby', 'rwTeachH');
      box.innerHTML = '<h2 id="rwTeachH">' + esc(TXT.teachTitle) + '</h2>'
        + '<p>' + esc(TXT.teachWhat) + '</p><p>' + esc(TXT.teachDo) + '</p>'
        + '<h3>' + esc(TXT.teachCovers) + '</h3><ul class="teach-ch">' + covers.join('') + '</ul>'
        + '<p>' + esc(TXT.teachStore) + '</p><p>' + esc(TXT.teachShared) + '</p>'
        + '<p class="teach-exit"><a href="?view=family">' + esc(TXT.teachExit) + '</a></p>';
      pick = mk('div', 'teach-pick');
      pick.id = 'rwTPick';
      pick.setAttribute('role', 'group');
      pick.setAttribute('aria-label', TXT.teachPick);
      for (const k of kids) {
        const b = mk('button', '', String(k.grade || k.key));
        b.type = 'button';
        b.dataset.kid = k.key;
        b.onclick = () => { sSet(GRADE_KEY, k.key); render(); };
        pick.appendChild(b);
      }
      secs[0].insertAdjacentElement('beforebegin', box);
      secs[0].insertAdjacentElement('beforebegin', pick);
    }
    const keys = kids.map(k => k.key);
    let cur = sGet(GRADE_KEY);
    if (keys.indexOf(cur) < 0) cur = keys[0];
    secs.forEach(s => { s.hidden = s.dataset.kid !== cur; });
    pick.querySelectorAll('button[data-kid]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kid === cur)));
  }

  /* ---------- who is playing (family view): one kid's block at a time, the choice kept on this device ---------- */
  // Never a noos_kid_* key: rewards.js KEY_RE treats those as a kid's reward store in backup and merge.
  const WHO_KEY = 'noos_who';
  let who = sGet(WHO_KEY);   // in memory too, so the choice holds for this page when storage is blocked
  const kidSec = key => [...document.querySelectorAll('section.kid[data-kid]')].find(s => s.dataset.kid === key) || null;

  // key: show that kid; null: back to the picker. Focus follows to the heading of what is shown.
  function choose(key) {
    who = key;
    if (key) sSet(WHO_KEY, key); else sDel(WHO_KEY);
    render();
    const sec = key && kidSec(key), h = sec ? sec.querySelector('.kid-head h2') : document.getElementById('rwWhoH');
    if (h) h.focus();
  }

  // One kid in the catalog: no picker and no switch. A stored key that is not a current kid shows the picker.
  function whoView() {
    const kids = kidsOf(), keys = kids.map(k => k.key), secs = [...document.querySelectorAll('section.kid[data-kid]')];
    if (kids.length < 2 || !secs.length) return;
    let pick = document.getElementById('rwWho');
    if (!pick) {
      pick = mk('section', 'who');
      pick.id = 'rwWho';
      pick.setAttribute('aria-labelledby', 'rwWhoH');
      const h = mk('h2', '', TXT.whoTitle), list = mk('div', 'who-list');
      h.id = 'rwWhoH'; h.tabIndex = -1;
      for (const k of kids) {
        const b = mk('button', 'who-kid'), av = mk('span', 'avatar', String(k.avatar || ''));
        b.type = 'button'; b.dataset.kid = k.key;
        av.setAttribute('aria-hidden', 'true');
        av.style.background = String(k.avatarBg || '');   // set through the style object: an invalid value is dropped
        b.append(av, mk('span', 'who-g', String(k.grade || k.key)));
        b.onclick = () => choose(k.key);
        list.appendChild(b);
      }
      pick.append(h, list);
      secs[0].insertAdjacentElement('beforebegin', pick);
      for (const sec of secs) {
        const h2 = sec.querySelector('.kid-head h2');
        if (!h2) continue;
        h2.tabIndex = -1;
        const other = kids.length === 2 ? kids.find(k => k.key !== sec.dataset.kid) : null;
        const sw = mk('button', 'who-sw', other ? TXT.whoSwitch(String(other.grade || other.key)) : TXT.whoAgain);
        sw.type = 'button';
        sw.onclick = () => choose(other ? other.key : null);
        h2.parentElement.appendChild(sw);
      }
    }
    const cur = keys.indexOf(who) >= 0 ? who : null;
    pick.hidden = !!cur;
    secs.forEach(s => { s.hidden = s.dataset.kid !== cur; });
  }

  /* ---------- class plan layout (plan.js, audit 8.3): «Αυτή την εβδομάδα», «Επανάληψη», «Έρχεται σύντομα» ---------- */
  // Pure. Done pages for review, weakest first: a null (never played) score first, then the lowest score; ties keep `ids` order.
  function reviewOrder(ids, score) {
    const s = new Map(ids.map(id => [id, score(id)]));
    const key = v => (typeof v === 'number' && Number.isFinite(v) ? v : -1);
    return ids.slice().sort((a, b) => key(s.get(a)) - key(s.get(b)));
  }
  // Pure. The blocks for one kid from a planState result and the kid's catalog page ids (in catalog order). Only ids with a
  // catalog page are shown; hidden pages are in no list; `rest` holds catalog pages missing from the plan (shown as today).
  function planBlocks(st, ids, score) {
    const P = st || {}, has = new Set(ids), S = P.states || {};
    const keep = list => (Array.isArray(list) ? list : []).filter(id => has.has(id));
    return { now: keep(P.current), review: reviewOrder(keep(P.done), score), soon: keep(P.upcoming), rest: ids.filter(id => !own(S, id)) };
  }
  // Stars over the page maximum (0..1); null when the tile would say «Δεν ξεκίνησε ακόμα» (never played on this device).
  function pageScore(c, id) {
    const prog = c.prog(id), m = c.man(id), rows = m && m.rows.length ? m.rows : null, p = c.rw.pagePct(prog, rows);
    if (p === null) return null;
    if (!rows) return p;
    const max = maxStars(c.rw, rows);
    return max ? c.rw.pageStars(prog || {}, rows) / max : 0;
  }

  // section -> {grids: [[grid, its child nodes as built by index.html]], sig}; set only while the plan layout is shown.
  const planSaved = new WeakMap();
  const planBox = sec => [...sec.children].find(e => e.classList.contains('plan')) || null;

  // Back to the per-subject layout: every grid gets its original nodes back, in order; plan classes and additions go.
  function planRestore(sec) {
    const sv = planSaved.get(sec);
    if (!sv) return;
    const box = planBox(sec);
    if (box) box.remove();
    for (const [g, nodes] of sv.grids) {
      g.replaceChildren(...nodes);
      const subj = g.closest('.subj');
      if (subj) subj.hidden = false;
    }
    sec.querySelectorAll('a.tile[data-id]').forEach(t => {
      t.classList.remove('plan-big', 'plan-small');
      t.querySelectorAll('.plan-subj,.plan-go').forEach(e => e.remove());
    });
    planSaved.delete(sec);
  }

  // The existing tile elements are moved, not rebuilt, so tiles() and tileCount() keep working on them. Upcoming and hidden
  // tiles leave the document (kept in planSaved for planRestore); a teaser stands in for each upcoming page.
  function planKid(sec, k, c) {
    const ks = c.rw.kidStore(k.key);
    const st = c.rw.planState(window.PLAN, k.key, c.day, ks && ks.unlocked);   // `unlocked`: slice 4; read as is, planState checks it
    if (!st.active) { planRestore(sec); return; }
    const pages = pagesOf(k), byId = new Map(pages.map(x => [String(x.p.id), x]));
    const b = planBlocks(st, [...byId.keys()], id => pageScore(c, id)), sig = JSON.stringify(b);
    const sv = planSaved.get(sec);
    if (sv && sv.sig === sig && planBox(sec)) return;   // same layout as the last render
    planRestore(sec);
    const grids = [...sec.querySelectorAll('.subj .grid')];
    planSaved.set(sec, { grids: grids.map(g => [g, [...g.childNodes]]), sig });
    const tileOf = id => [...sec.querySelectorAll('a.tile[data-id]')].find(t => t.dataset.id === id) || null;
    const subjTag = (s, cls, text) => { const e = mk('span', cls, text); e.style.setProperty('--subj', colorOf(s)); return e; };
    const place = (id, size) => {
      const t = tileOf(id), x = byId.get(id);
      if (!t) return null;
      t.classList.add(size);
      const emo = t.querySelector('.emo'), lab = subjTag(x.s, 'plan-subj', String(x.s.name || ''));
      if (emo) emo.insertAdjacentElement('afterend', lab); else t.prepend(lab);
      if (size === 'plan-big') t.appendChild(subjTag(x.s, 'plan-go', TXT.planGo));
      return t;
    };
    const teaser = id => {
      const { p } = byId.get(id), d = mk('div', 'plan-soon-i'), lock = mk('span', 'plan-lock', '🔒');
      d.dataset.soon = id;
      lock.setAttribute('role', 'img');
      lock.setAttribute('aria-label', TXT.planLocked);
      d.append(mk('span', 'emo', String(p.emo || '')), mk('span', 'ttl', String(p.title || '')), lock);
      return d;
    };
    const block = (cls, title, items) => {
      const d = mk('div', 'plan-block ' + cls), g = mk('div', 'plan-grid');
      g.append(...items.filter(Boolean));
      d.append(mk('h3', '', title), g);
      return g.children.length ? d : null;
    };
    const blocks = [block('plan-now', TXT.planNow, b.now.map(id => place(id, 'plan-big'))),
      block('plan-review', TXT.planReview, b.review.map(id => place(id, 'plan-small'))),
      block('plan-soon', TXT.planSoon, b.soon.map(teaser))].filter(Boolean);
    const rest = new Set(b.rest);
    for (const t of [...sec.querySelectorAll('.subj .grid a.tile[data-id]')]) if (!rest.has(t.dataset.id)) t.remove();   // upcoming, hidden
    for (const g of grids) {
      const subj = g.closest('.subj');
      if (subj && !g.querySelector('a.tile[data-id]')) subj.hidden = true;
    }
    const box = mk('div', 'plan');
    box.append(...blocks);
    const first = sec.querySelector('.subj');
    if (first) first.insertAdjacentElement('beforebegin', box);
    else { const after = sec.querySelector('[data-rw="quest"]') || sec.querySelector('.kid-head'); if (after) after.insertAdjacentElement('afterend', box); else sec.appendChild(box); }
  }

  function planView(c) {
    for (const k of kidsOf()) {
      const sec = kidSec(k.key);
      if (sec) step(() => planKid(sec, k, c));
    }
  }

  function render() {
    if (TEACH) { step(teacherView); return; }   // no jar, level, stars, streak, quest, album, badges, parent area or sound
    step(whoView);   // before jarView, which sits the jar after the shown block
    const rw = R();
    if (!rw) return;
    let c = null;
    step(() => { c = context(rw); });
    if (!c) return;
    let totals = {};
    step(soundOnce);
    step(() => rw.usePlan(window.PLAN));   // before tiles: the tile countdown falls back to the plan's test date (testDateFor)
    step(() => planView(c));   // before tiles: the kid totals follow the tiles left in the document
    step(() => { totals = tiles(c); });
    step(() => jarView(c));   // before the badge walls, so a helper badge shows at once
    for (const k of kidsOf()) {
      const sec = [...document.querySelectorAll('section.kid[data-kid]')].find(x => x.dataset.kid === k.key);
      if (!sec) continue;
      const a = totals[k.key] || [], avg = a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 100) : 0;
      step(() => head(sec, k, c, avg));
      step(() => quest(sec, k, c));
      step(() => album(sec, k, c));
      step(() => badges(sec, k, c));
    }
    step(() => parentView(c));
  }

  window.Hub = { render, esc, TXT, teacher: () => TEACH, context, reviewOrder, planBlocks };   // context, reviewOrder, planBlocks: for tests
})();
