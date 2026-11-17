/* Hub view: tile progress and stars, kid header (level, streak), daily quest, sticker album, badge wall, family jar and
   the parent area (weekly note, jar settings, test dates, backup code). With ?view=teacher: a teacher view instead
   (intro, chapter list, one grade at a time, none of the above).
   Reads window.CATALOG and window.Rewards; holds no school content (engine/ is published as plain files).
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
    // teacher view (?view=teacher)
    tTitle: '👩‍🏫 Για τη δασκάλα',
    tWhat: 'Σελίδες εξάσκησης για τη μελέτη στο σπίτι. Το περιεχόμενο ακολουθεί τα επίσημα σχολικά βιβλία από το ebooks.edu.gr.',
    tDo: 'Σε κάθε σελίδα το παιδί βρίσκει σύνοψη, κάρτες, κουίζ, «Σωστό ή Λάθος», παιχνίδια και οδηγό για τον γονιό.',
    tCovers: 'Τι καλύπτει',
    tStore: 'Η πρόοδος αποθηκεύεται μόνο στη συσκευή όπου παίζει το παιδί και δεν στέλνεται πουθενά. Γι’ αυτό δεν μπορείτε να δείτε από εδώ την πρόοδο των μαθητών.',
    tShared: 'Σε κοινόχρηστο ή σχολικό υπολογιστή, στη σύνδεση βγάλτε το τικ από το «Να με θυμάσαι σε αυτή τη συσκευή».',
    tPick: 'Τάξη',
    tExit: 'Έξοδος από προβολή δασκάλας',
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

  // Per-render reads: manifests once, each progress store at most once.
  function context(rw) {
    const ms = rw.manifests(), progs = new Map(), dates = new Map();
    return {
      rw, ms, day: rw.dayKey(new Date()),
      man: id => (own(ms, id) ? ms[id] : null),
      prog: id => { if (!progs.has(id)) progs.set(id, rw.load('progress_' + id)); return progs.get(id); },
      dates: kid => { if (!dates.has(kid)) dates.set(kid, rw.kidStore(kid).testDates); return dates.get(kid); },
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
    const ui = UI(), T = ui && ui.TXT, d = kid ? c.dates(kid) : {};
    const n = T && own(d, id) ? c.rw.daysUntil(c.day, d[id]) : null;
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
  function quest(sec, k, c) {
    const host = sec.querySelector('[data-rw="quest"]');
    if (!host) return;
    const rw = c.rw, pages = pagesOf(k);
    let st = { tasks: [], allDone: false };
    const q = rw.ensureQuest(k.key, c.day);   // an empty quest is rebuilt once the kid has a manifest (questFor)
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
      const what = (t.type === 'hit' ? TXT.questHit(target) : TXT.questList) + (title ? ', «' + title + '»' : '');
      const link = href(t.file), tag = link ? 'a' : 'div';
      return '<' + tag + ' class="rw-hq-task' + (t.done ? ' done' : '') + '"' + (link ? ' href="' + esc(link) + '"' : '') + '>'
        + '<span class="rw-hq-txt"><b>' + esc(label) + '</b><small>' + esc(what) + '</small></span>'
        + '<span class="rw-hq-c">' + (t.done ? '✓' : esc(count + '/' + target)) + '</span></' + tag + '>';
    });
    // Fewer than 3 known activities: suggest catalog pages never opened on this device.
    for (const { p } of pages) {
      if (items.length >= 3) break;
      const link = href(p.file);
      if (!link || c.man(p.id)) continue;
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

  /* ---------- family jar, between the kids ---------- */
  function jarView(c) {
    const rw = c.rw, fam = rw.family(), j = rw.jar(rw.totalStars(), fam);
    const secs = document.querySelectorAll('section.kid[data-kid]');
    if (!secs.length) return;
    let box = document.getElementById('rwJar');
    if (!box) {
      box = document.createElement('section');
      box.id = 'rwJar';
      secs[0].insertAdjacentElement('afterend', box);
    }
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
    });
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
      close.onclick = () => { pState.open = false; render(); const g = host.querySelector('.rw-gate'); if (g) g.focus(); };
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
      box.innerHTML = '<h2 id="rwTeachH">' + esc(TXT.tTitle) + '</h2>'
        + '<p>' + esc(TXT.tWhat) + '</p><p>' + esc(TXT.tDo) + '</p>'
        + '<h3>' + esc(TXT.tCovers) + '</h3><ul class="teach-ch">' + covers.join('') + '</ul>'
        + '<p>' + esc(TXT.tStore) + '</p><p>' + esc(TXT.tShared) + '</p>'
        + '<p class="teach-exit"><a href="?view=family">' + esc(TXT.tExit) + '</a></p>';
      pick = mk('div', 'teach-pick');
      pick.id = 'rwTPick';
      pick.setAttribute('role', 'group');
      pick.setAttribute('aria-label', TXT.tPick);
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

  function render() {
    if (TEACH) { step(teacherView); return; }   // no jar, level, stars, streak, quest, album, badges, parent area or sound
    const rw = R();
    if (!rw) return;
    let c = null;
    step(() => { c = context(rw); });
    if (!c) return;
    let totals = {};
    step(soundOnce);
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

  window.Hub = { render, esc, TXT, teacher: () => TEACH };
})();
