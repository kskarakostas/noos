/* Hub view (index.html), round 3 (W4): four tabs, «Σήμερα», «Τετράδια», «Βραβεία» and «Γονιός» (a bottom bar below 1100 px,
   a left rail at 1100 px and wider), under a top bar with the child switch, the streak and the stars.
   «Σήμερα» fits one screen: the daily mission as a trail of steps ending in a gift, one sentence for the next step and
   «Συνέχισε»; one notebook per subject with its current unit (the first unit without a schedule); «Επανάληψη», the weakest
   done unit and the nearest test date. «Τετράδια»: per subject, its units in catalog order with their state and each
   unit's pages. «Βραβεία»: level, sticker album and badge wall per kid, and the family jar. «Γονιός»: the parent area behind
   the 2 s hold (weekly notes, the family account, the schedule cards or editor, jar settings, test dates, backup code).
   With ?view=teacher: a teacher view instead (intro, chapter list, one grade at a time, none of the above).
   Every rule of what is shown comes from engine/rewards.js (kidSubjects, ensureQuest, questStatus, pageStars, ...) and the
   pure helpers below (subjectBlocks, reviewOrder); this file only draws it.
   Reads window.CATALOG, window.Rewards, window.PLAN, window.Icons and, when manifest.js loaded, window.NOOS_MANIFEST; holds
   no school content (engine/ is published as plain files). Every string from storage or the catalog goes through esc();
   links only to files matching FILE_RE. Exposes window.Hub. */
(function () {
  'use strict';

  const TXT = {
    appName: 'Η σχολική μας γωνιά',
    // top bar
    whoNow: g => 'Αλλαγή παιδιού, τώρα ' + g,
    whoMenu: 'Ποιος παίζει;',
    starsChip: n => n + (n === 1 ? ' αστέρι' : ' αστέρια'),
    streakTip: n => n + (n === 1 ? ' μέρα' : ' μέρες') + ' στη σειρά με 10 ή περισσότερες απαντήσεις',
    freezeTip: 'Ένα πάγωμα κράτησε το σερί σου αυτή την εβδομάδα',
    // «Σήμερα»
    today: 'Σήμερα',
    go: 'Συνέχισε',
    trail: (done, n, all) => 'Αποστολή της ημέρας: ' + (all ? 'έγινε! Πήρες το αστέρι της ημέρας.'
      : (done === 1 ? 'έγινε 1' : 'έγιναν ' + done) + ' από τα ' + n + ' βήματα. Στο τέλος περιμένει ένα αστέρι.'),
    sayHit: (l, n) => '«' + l + '»: κάνε ' + n + ' σωστές.',
    sayCards: n => 'Μάθε ' + n + ' νέες κάρτες.',
    sayList: l => '«' + l + '»: ανέβασε την πρόοδο.',
    sayNew: w => 'Άνοιξε νέο κεφάλαιο: ' + w + '.',
    sayDone: 'Μπράβο! Έκανες την αποστολή της ημέρας και πήρες ένα αστέρι.',
    questEmpty: 'Άνοιξε μια σελίδα για να πάρεις την πρώτη σου αποστολή!',
    // G3: every page opened here, no task (nothing but summaries open): the page «Συνέχισε» opens, then this
    questRead: 'Διάβασε τη Σύνοψη ως το τέλος για να ξεκλειδώσεις την αποστολή σου.',
    countOf: (n, all) => n + ' από ' + all,
    starsOf: (n, max) => n + ' από ' + max + ' αστέρια',
    books: 'Τα τετράδιά μου',
    review: 'Επανάληψη',
    reviewNone: 'Όταν η τάξη τελειώσει ένα κεφάλαιο, εδώ θα βλέπεις τι θέλει επανάληψη.',
    weakest: l => 'Πιο αδύναμο: ' + l,
    bossTry: 'Δοκίμασε το Τελικό τέρας.',
    // what to do on a page whose next activity is still locked (G2): the step the learning path has open, never a locked one
    stepTry: ['Ξεκίνα από τη Σύνοψη.', 'Συνέχισε με τις Κάρτες.', 'Συνέχισε με τα παιχνίδια.', 'Συνέχισε με το Κουίζ.', 'Συνέχισε με το Σωστό ή Λάθος.'],
    stepAny: 'Πάμε για επανάληψη.',
    // «Τετράδια»
    stDone: 'Έγινε',
    stCurrent: 'Τώρα',
    stUpcoming: 'Έρχεται σύντομα',
    notStarted: 'Δεν ξεκίνησε ακόμα',
    // «Βραβεία» (round 3, W6a): level, album, badges, the family jar
    level: 'Το επίπεδό μου',
    levelNo: n => 'Επίπεδο ' + n,
    levelAria: (name, s, next) => name + ': ' + s + ' αστέρια, το επόμενο επίπεδο στα ' + next,
    levelLeft: (n, name) => 'Ακόμα ' + n + (n === 1 ? ' αστέρι' : ' αστέρια') + ' για το επίπεδο «' + name + '».',
    album: 'Το άλμπουμ μου',
    albumAria: (n, all) => n + ' από ' + all + ' αυτοκόλλητα',
    albumHow: 'Κάθε δραστηριότητα με 3 αστέρια σού δίνει ένα αυτοκόλλητο. Το Τελικό τέρας δίνει το χρυσό.',
    albumEmpty: 'Το άλμπουμ περιμένει το πρώτο σου αυτοκόλλητο!',
    albumAll: n => 'Δες όλο το άλμπουμ (' + n + ')',
    less: 'Δείξε λιγότερα',
    sealed: 'Άνοιξε τη σελίδα για να δεις τα αυτοκόλλητα',
    got: 'Το κέρδισες.',
    notYet: 'Δεν το κέρδισες ακόμα.',
    badges: 'Τα παράσημά μου',
    badgesAria: (n, all) => n + ' από ' + all + ' παράσημα',
    badgesEmpty: 'Κάθε παράσημο γράφει τι χρειάζεται. Το πρώτο είναι κοντά!',
    badgesAll: n => 'Δες όλα τα παράσημα (' + n + ')',
    secret: 'Μυστικό παράσημο',
    secretHow: 'Θα μάθεις τι είναι όταν το κερδίσεις.',
    earnedOn: d => 'Το πήρες στις ' + d,
    jarAria: (n, max) => n + ' από ' + max + ' αστέρια στο βάζο',
    jarTitle: 'Το βάζο της οικογένειας',
    jarSub: 'Κάθε αστέρι που κερδίζετε μπαίνει στο βάζο. Γεμίστε το μαζί!',
    jarReward: 'Η έκπληξη της οικογένειας',
    jarPrize: r => 'Ανταμοιβή: ' + r,
    jarFull: 'Γέμισε! Πείτε στον μπαμπά!',
    // «Γονιός»
    sound: 'Ήχοι στις σελίδες',
    planHint: names => 'Δεν έχει οριστεί ακόμα σε ποιο κεφάλαιο είναι η τάξη (' + names + '), οπότε το «Σήμερα» δείχνει το πρώτο κεφάλαιο.',
    pGate: 'Για τον γονιό',
    pHint: 'Κράτα πατημένο για 2 δευτερόλεπτα',
    pTitle: 'Για τον γονιό',
    pClose: 'Κλείσιμο',
    wTitle: g => 'Η εβδομάδα: ' + g,
    wDays: n => 'Μέρες με εξάσκηση: ' + n + ' από 7',
    wAns: (n, pct) => 'Απαντήσεις: ' + n + (n ? ' (' + pct + '% σωστές)' : ''),
    wStars: n => 'Αστέρια: ' + n,
    wBadges: 'Παράσημα: ',
    wNoBadges: 'Παράσημα: κανένα αυτή την εβδομάδα',
    wWeak: 'Θέλουν εξάσκηση:',
    wNoWeak: 'Καμία δραστηριότητα δεν θέλει ιδιαίτερη εξάσκηση αυτή τη στιγμή.',
    jSet: 'Βάζο: στόχος και ανταμοιβή',
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
    // the learning path (round 3, W3): «Άνοιξε όλο το κεφάλαιο» per chapter page (Rewards.openChapter)
    oTitle: 'Η διαδρομή κάθε κεφαλαίου',
    oSub: 'Σε κάθε κεφάλαιο το παιδί ανοίγει τα βήματα με τη σειρά: Σύνοψη, Κάρτες, παιχνίδια, Κουίζ, Τελικό τέρας. Εδώ μπορείς να ανοίξεις όλο το κεφάλαιο αμέσως. Δεν κλειδώνει ξανά.',
    oOpen: 'Άνοιξε όλο το κεφάλαιο',
    oSure: 'Σίγουρα; Πάτα ξανά',
    oIsOpen: 'Ανοιχτό από τον γονιό',
    oDone: 'Όλο το κεφάλαιο είναι ανοιχτό.',
    tTitle: 'Ημερομηνίες διαγωνισμάτων',
    tSub: 'Η σελίδα του κεφαλαίου δείχνει αντίστροφη μέτρηση μέχρι το διαγώνισμα.',
    tClear: 'Καθαρισμός',
    tSaved: 'Αποθηκεύτηκε.',
    tCleared: 'Η ημερομηνία καθαρίστηκε.',
    tBad: 'Η ημερομηνία δεν είναι έγκυρη.',
    tPlan: d => 'Από το πρόγραμμα της τάξης: ' + fmtDay(d),
    // «Πού είναι η τάξη»: the class plan card per kid (device), or the schedule editor while signed in to sync
    schedTitle: 'Πού είναι η τάξη',
    kidSwitch: 'Παιδί',
    cpTitle: g => 'Πρόγραμμα της τάξης: ' + g,
    cpSub: 'Για παιδί που προχωράει πιο γρήγορα από την τάξη. Ισχύει σε αυτή τη συσκευή και περνάει σε άλλη με τον κωδικό αντιγράφου ασφαλείας.',
    cpNow: t => 'Η τάξη τώρα: ' + t,
    cpPos: (i, n) => 'Κεφάλαιο ' + i + ' από ' + n,
    cpMine: 'Ξεκλείδωτα σε αυτή τη συσκευή:',
    cpLock: 'Κλείδωσε ξανά',
    cpLockOf: t => 'Κλείδωσε ξανά: ' + t,
    cpNextIs: t => 'Επόμενο: ' + t,
    cpNext: 'Ξεκλείδωσε το επόμενο',
    cpOpened: t => 'Ξεκλειδώθηκε: ' + t,
    cpClosed: t => 'Κλειδώθηκε ξανά: ' + t,
    cpNone: 'Δεν έχει οριστεί πρόγραμμα, οπότε το παιδί βλέπει όλα τα κεφάλαια. Όρισε το τρέχον κεφάλαιο για να βλέπει μόνο ό,τι κάνει τώρα η τάξη.',
    spSub: 'Σε ποιο κεφάλαιο είναι το παιδί σε κάθε μάθημα. Αποθηκεύεται στον λογαριασμό της οικογένειας και ισχύει σε κάθε συνδεδεμένη συσκευή.',
    spInHint: 'Συνδέσου πιο πάνω με τον λογαριασμό της οικογένειας για να ορίζεις από εδώ σε ποιο κεφάλαιο είναι κάθε παιδί, σε κάθε συσκευή. Μέχρι τότε ισχύουν τα κουμπιά ξεκλειδώματος, μόνο σε αυτή τη συσκευή.',
    spNone: 'Χωρίς πρόγραμμα: το παιδί βλέπει όλα τα κεφάλαια αυτού του μαθήματος.',
    spPrev: 'Προηγούμενο κεφάλαιο',
    spNext: 'Επόμενο κεφάλαιο',
    spBackTo: (t, s) => 'Πίσω, ' + s + ': ' + t,
    spFwdTo: (t, s) => 'Μπροστά, ' + s + ': ' + t,
    spPick: s => 'Διάλεξε κεφάλαιο (' + s + ')',
    spPickNone: 'Χωρίς πρόγραμμα',
    spTest: t => 'Διαγώνισμα: ' + t,
    spSaved: 'Αποθηκεύτηκε. Οι άλλες συσκευές θα το δουν στο επόμενο άνοιγμα.',
    spWait: 'Περιμένει συγχρονισμό.',
    spFail: 'Δεν αποθηκεύτηκε ακόμα. Θα ξαναδοκιμάσει μόνο του.',
    // the family account (engine/sync.js): one card, the sign-in form while signed out (decision 7), absent while
    // sync-config.js is empty
    syInTitle: 'Λογαριασμός της οικογένειας',
    syInSub: 'Με τον λογαριασμό της οικογένειας τα αστέρια, το άλμπουμ, τα παράσημα και το σερί είναι ίδια σε κάθε συσκευή, και ορίζεις από εδώ σε ποιο κεφάλαιο είναι κάθε παιδί.',
    syTitle: 'Συγχρονισμός συσκευών',
    syEmail: 'Email',
    syPass: 'Κωδικός',
    syShow: 'Εμφάνιση κωδικού',
    syHide: 'Απόκρυψη κωδικού',
    sySignIn: 'Σύνδεση',
    syBusy: 'Σύνδεση…',
    syEmpty: 'Συμπλήρωσε το email και τον κωδικό.',
    syBad: 'Λάθος email ή κωδικός. Δοκίμασε ξανά.',
    syNet: 'Δεν υπάρχει σύνδεση στο διαδίκτυο. Δοκίμασε ξανά σε λίγο.',
    syOther: 'Η σύνδεση δεν έγινε. Δοκίμασε ξανά σε λίγο.',
    syExpired: 'Η σύνδεση έληξε. Συνδέσου ξανά για να συνεχιστεί ο συγχρονισμός.',
    syAs: e => 'Λογαριασμός: ' + e,
    sySaved: 'Όλα συγχρονίστηκαν.',
    syWait: 'Περιμένει συγχρονισμό.',
    syFail: 'Ο συγχρονισμός απέτυχε. Θα ξαναδοκιμάσει μόνος του.',
    syNoFam: 'Ο λογαριασμός δεν έχει ακόμα οικογένεια. Η πρόοδος μένει μόνο σε αυτή τη συσκευή.',
    syRetry: 'Δοκίμασε τώρα',
    syOut: 'Αποσύνδεση λογαριασμού',
    bTitle: 'Αντίγραφο ασφαλείας',
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
    teachTitle: 'Για τη δασκάλα',
    teachWhat: 'Σελίδες εξάσκησης για τη μελέτη στο σπίτι. Το περιεχόμενο ακολουθεί τα επίσημα σχολικά βιβλία από το ebooks.edu.gr.',
    teachDo: 'Σε κάθε σελίδα το παιδί βρίσκει σύνοψη, κάρτες, κουίζ, «Σωστό ή Λάθος», παιχνίδια και οδηγό για τον γονιό.',
    teachCovers: 'Τι καλύπτει',
    teachStore:'Η πρόοδος αποθηκεύεται μόνο στη συσκευή όπου παίζει το παιδί και δεν στέλνεται πουθενά. Γι’ αυτό δεν μπορείτε να δείτε από εδώ την πρόοδο των μαθητών.',
    teachShared: 'Σε κοινόχρηστο ή σχολικό υπολογιστή, στη σύνδεση βγάλτε το τικ από το «Να με θυμάσαι σε αυτή τη συσκευή».',
    teachPick: 'Τάξη',
    teachExit: 'Έξοδος από προβολή δασκάλας',
  };

  const FILE_RE = /^dim[\w-]+\.html$/;
  const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
  const SUBJ_KEY_RE = /^[a-z][a-z0-9_-]{0,31}$/;
  const ID_RE = /^[\w-]{1,64}$/;
  const PICTO_RE = /\p{Extended_Pictographic}/u;
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const R = () => window.Rewards || null;
  const UI = () => window.RewardsUI || null;
  const kidsOf = () => (window.CATALOG && Array.isArray(window.CATALOG.kids) ? window.CATALOG.kids : []);
  const subsOf = k => (k && Array.isArray(k.subjects) ? k.subjects : []);
  const pagesOf = k => subsOf(k).flatMap(s => (Array.isArray(s.pages) ? s.pages : []).map(p => ({ p, s })));
  const fmtDay = d => { const [y, m, dd] = String(d).split('-'); return Number(dd) + '/' + Number(m) + '/' + y; };
  const href = f => (typeof f === 'string' && FILE_RE.test(f) ? f : null);
  const step = f => { try { f(); } catch (e) { console.error(e); } };
  const ico = (name, o) => (window.Icons && typeof window.Icons.svg === 'function' ? window.Icons.svg(name, o) : '');
  // A subject's cover colour: its token (--cover-<key>, tokens.css), else a hex colour from the catalog, else the cover.
  const coverOf = s => {
    const k = String((s && s.key) || ''), c = String((s && s.color) || ''), fb = COLOR_RE.test(c) ? c : 'var(--cover)';
    return SUBJ_KEY_RE.test(k) ? 'var(--cover-' + k + ',' + fb + ')' : fb;
  };
  // An activity label without its leading emoji (the manifest rows start with one).
  const plainLabel = l => { const w = String(l).trim().split(/\s+/); return PICTO_RE.test(w[0] || '') ? w.slice(1).join(' ') : String(l).trim(); };
  // «Κεφάλαιο 2» becomes «Κεφ. 2» where room is short; other chapter labels stay as they are.
  const chShort = ch => String(ch || '').replace(/^Κεφάλαιο(?=\s)/, 'Κεφ.');
  // Markup that was set from this exact string is not set again, so focus and scroll inside it survive a render.
  const htmlSet = new WeakMap();
  function setHTML(host, html) { if (htmlSet.get(host) === html) return; host.innerHTML = html; htmlSet.set(host, html); }

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

  // The learning path as the hub can know it (G2; G3: the same function as the daily mission, Rewards.rowsLevel): the guard
  // rails alone (the level the page stored, `_path.open`, raised on every page refresh; progress; a test date within
  // UNLOCK_DAYS; the parent's open all; old-version progress) with the page described from its manifest rows. No gate
  // condition is stepped through (a page has games without a row and a card count the rows do not tell), so the level is
  // never above the page's own. Limit: a page whose gate was met but whose level was never stored reads lower here, so the
  // hub suggests an earlier step than the page would, never a locked one.
  // -1 when nothing is known (no rows, or no Rewards.rowsLevel): the caller then says nothing about an activity.
  const rowStep = key => (key === 'cards' ? 1 : key === 'quiz' || key === 'tf' ? 3 : key === '_boss' ? 4 : 2);
  function pathLevel(rw, rows, progress, day, testDate) {
    if (!rw || typeof rw.rowsLevel !== 'function' || !Array.isArray(rows) || !rows.length) return -1;
    return rw.rowsLevel(rows, progress || {}, day, testDate || null);
  }
  // The sentence for the open step at `level` (0 to 3) of a page with these rows; the neutral one when the page has no such step.
  function stepSay(level, rows) {
    const keys = (Array.isArray(rows) ? rows : []).map(r => r[0]);
    if (level === 0) return TXT.stepTry[0];
    if (level === 1 && keys.includes('cards')) return TXT.stepTry[1];
    if (level === 2 && keys.some(k => k.charAt(0) !== '_' && rowStep(k) === 2)) return TXT.stepTry[2];
    if (level === 3 && keys.includes('quiz')) return TXT.stepTry[3];
    if (level === 3 && keys.includes('tf')) return TXT.stepTry[4];
    return TXT.stepAny;
  }
  // A page's path level in a render: its rows (device or build-time manifest), its stored progress, its test date.
  const levelOf = (c, kidKey, id) => { const m = c.man(id); return pathLevel(c.rw, m && m.rows, c.prog(id), c.day, c.test(kidKey, id)); };

  const maxStars = (rw, rows) => rw.countedRows(rows).length * 3 + rows.filter(r => r[2] === 'boss').length * 3;

  // A page's stars and star maximum (0 when no rows are known: no device and no build-time manifest).
  function pageStat(c, id) {
    const m = c.man(id), rows = m && m.rows.length ? m.rows : null;
    return rows ? { stars: c.rw.pageStars(c.prog(id) || {}, rows), max: maxStars(c.rw, rows) } : { stars: 0, max: 0 };
  }
  // Stars over the page maximum (0..1); null when the page was never played on this device (Rewards.pagePct null).
  function pageScore(c, id) {
    const prog = c.prog(id), m = c.man(id), rows = m && m.rows.length ? m.rows : null, p = c.rw.pagePct(prog, rows);
    if (p === null) return null;
    if (!rows) return p;
    const max = maxStars(c.rw, rows);
    return max ? c.rw.pageStars(prog || {}, rows) / max : 0;
  }

  // A drawn ratio (D6): optional star icon, «n / max» in ink, then a bar. `label` names it for screen readers.
  function ratio(n, max, cls, star, label) {
    const pct = max ? Math.round(Math.max(0, Math.min(1, n / max)) * 100) : 0;
    return '<span class="hub-ratio' + (cls ? ' ' + cls : '') + '" role="img" aria-label="' + esc(label || TXT.starsOf(n, max)) + '">'
      + (star ? ico('star', { size: 16, cls: 'hub-star' }) : '') + '<b class="hub-num">' + esc(n + ' / ' + max) + '</b>'
      + '<span class="hub-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span></span>';
  }
  // The test countdown wording of the chapter page banner (RewardsUI.TXT); null without it.
  function testText(n) {
    const ui = UI(), T = ui && ui.TXT;
    if (!T || n === null || n === undefined) return null;
    return n === 0 ? T.testToday : n === 1 ? T.testTomorrow : T.testIn(n);
  }

  // A catalog subject's units in catalog order: Map unit -> [page, ...]. A page's unit is its `unit` when that is a valid
  // page id, else its own id (as Rewards.planSubjects reads it).
  function catUnits(s) {
    const out = new Map();
    for (const p of s && Array.isArray(s.pages) ? s.pages : []) {
      if (!p || !ID_RE.test(String(p.id))) continue;
      const u = isStr(p.unit) && ID_RE.test(p.unit) ? p.unit : String(p.id);
      if (!out.has(u)) out.set(u, []);
      out.get(u).push(p);
    }
    return out;
  }
  const baseOf = (u, pages) => pages.find(p => String(p.id) === u) || pages[0];
  // A unit's state in a kidSubjects entry: the state of its first page; '' for a subject without a schedule.
  const unitState = (e, pages) => (e && e.active && own(e.states, String(pages[0].id)) ? e.states[String(pages[0].id)] : '');
  const entryOf = (ps, s) => (ps && ps.subjects && own(ps.subjects, s.key) ? ps.subjects[s.key] : null);

  /* ---------- shell: tabs (bottom bar or rail), top bar, one block per kid in each panel ---------- */
  const TABS = ['today', 'books', 'awards', 'parent'];
  const tabEl = t => document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
  const panelEl = t => document.getElementById('panel' + t.charAt(0).toUpperCase() + t.slice(1));
  let tab = 'today';
  let shellDone = false;
  function shell() {
    if (shellDone) return;
    shellDone = true;
    document.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = ico(e.dataset.icon, { size: e.dataset.size ? Number(e.dataset.size) : 24 }); });
    for (const t of TABS) {
      const b = tabEl(t);
      if (!b) continue;
      b.addEventListener('click', () => selectTab(t, false));
      b.addEventListener('keydown', tabKey);
    }
    const parts = { today: 'today', books: 'books', awards: 'awards' };
    for (const [t, cls] of Object.entries(parts)) {
      const p = panelEl(t);
      if (!p) continue;
      for (const k of kidsOf()) {
        const d = mk('div', 'hub-kid ' + cls);
        d.dataset.kid = String(k.key);
        if (t === 'awards') {
          const lvl = mk('section', 'hub-lvl'), al = mk('div', 'hub-album'), bw = mk('div', 'hub-badges');
          lvl.dataset.rw = 'lvl'; lvl.dataset.block = 'level';
          al.dataset.rw = 'album'; al.dataset.block = 'album';
          bw.dataset.rw = 'badges'; bw.dataset.block = 'badges';
          d.append(lvl, al, bw);
        }
        p.appendChild(d);
      }
      if (t === 'awards') {
        const j = mk('section', 'hub-card hub-jarc'); j.id = 'rwJar'; j.dataset.block = 'jar'; p.appendChild(j);
        p.addEventListener('click', moreClick);
      }
    }
    document.addEventListener('pointerdown', e => { const m = document.getElementById('hubWhoMenu'); if (m && !m.hidden && !e.target.closest('#hubWho')) whoMenu(false); });
  }
  // Tab keys: arrows move and select (left/right on the bottom bar, up/down on the rail; both work everywhere), Home, End.
  function tabKey(e) {
    const i = TABS.indexOf(tab), n = TABS.length;
    const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1 + n, ArrowUp: i - 1 + n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    selectTab(TABS[to % n], true);
  }
  // Leaving «Γονιός» closes the parent area, so the next visit needs the hold again.
  function selectTab(t, focus) {
    if (!TABS.includes(t)) return;
    const was = tab;
    tab = t;
    for (const x of TABS) {
      const b = tabEl(x), p = panelEl(x), on = x === t;
      if (b) { b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
      if (p) p.hidden = !on;
    }
    const main = document.getElementById('hubMain');
    if (main) main.dataset.tab = t;
    if (focus && tabEl(t)) tabEl(t).focus();
    if (was !== t) { try { window.scrollTo(0, 0); } catch (e) { /* no layout */ } }
    if (was === 'parent' && t !== 'parent' && pState.open) { pState.open = false; planMsgs.clear(); planLines.clear(); render(); }
  }

  /* ---------- who is playing: the child switch in the top bar, the choice kept on this device ---------- */
  // Never a noos_kid_* key: rewards.js KEY_RE treats those as a kid's reward store in backup and merge.
  const WHO_KEY = 'noos_who';
  const sGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const sSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* blocked storage: the choice lasts for this page only */ } };
  const sDel = k => { try { localStorage.removeItem(k); } catch (e) { /* nothing stored */ } };
  let who = sGet(WHO_KEY);   // in memory too, so the choice holds for this page when storage is blocked
  // The kid shown: the stored choice while it is a catalog kid, else the first kid.
  const curKid = () => { const keys = kidsOf().map(k => k.key); return keys.includes(who) ? who : keys.length ? keys[0] : null; };
  const initial = k => String(k.grade || k.key).trim().split(/\s+/)[0];
  function whoMenu(open) {
    const b = document.getElementById('hubWhoBtn'), m = document.getElementById('hubWhoMenu');
    if (!b || !m) return;
    m.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
  }
  function choose(key) {
    who = key;
    sSet(WHO_KEY, key);
    whoMenu(false);
    render();
    const b = document.getElementById('hubWhoBtn');
    if (b) b.focus();
  }
  // One kid in the catalog: a plain label, no switch. Two or more: a button that opens the list of kids.
  function whoView(kid) {
    const host = document.getElementById('hubWho'), kids = kidsOf();
    if (!host) return;
    const k = kids.find(x => x.key === kid);
    if (!k) { host.textContent = ''; return; }
    const face = '<span class="hub-av" aria-hidden="true">' + esc(initial(k)) + '</span><span class="hub-whot">' + esc(k.grade || k.key) + '</span>';
    if (kids.length < 2) { setHTML(host, '<div class="hub-whob single">' + face + '</div>'); return; }
    let b = document.getElementById('hubWhoBtn');
    if (!b) {
      host.textContent = '';
      b = mk('button', 'hub-whob');
      b.type = 'button'; b.id = 'hubWhoBtn';
      b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'hubWhoMenu');
      b.onclick = () => { const m = document.getElementById('hubWhoMenu'); whoMenu(!!m && m.hidden); if (m && !m.hidden) { const on = m.querySelector('[aria-pressed="true"]') || m.querySelector('button'); if (on) on.focus(); } };
      const m = mk('div', 'hub-whomenu');
      m.id = 'hubWhoMenu'; m.hidden = true;
      m.setAttribute('role', 'group'); m.setAttribute('aria-label', TXT.whoMenu);
      for (const x of kids) {
        const o = mk('button', 'hub-whoo');
        o.type = 'button'; o.dataset.kid = String(x.key);
        o.innerHTML = '<span class="hub-av" aria-hidden="true">' + esc(initial(x)) + '</span><span>' + esc(x.grade || x.key) + '</span>' + ico('tick', { size: 20, cls: 'hub-whotick' });
        o.onclick = () => choose(x.key);
        m.appendChild(o);
      }
      m.addEventListener('keydown', e => { if (e.key === 'Escape') { whoMenu(false); b.focus(); } });
      b.addEventListener('keydown', e => { if (e.key === 'Escape') whoMenu(false); });
      host.append(b, m);
    }
    const html = face + ico('chevron-down', { size: 16, cls: 'hub-whov' });
    if (htmlSet.get(b) !== html) { b.innerHTML = html; htmlSet.set(b, html); }
    b.setAttribute('aria-label', TXT.whoNow(String(k.grade || k.key)));
    document.querySelectorAll('#hubWhoMenu button[data-kid]').forEach(o => o.setAttribute('aria-pressed', String(o.dataset.kid === kid)));
  }
  // The streak (with the week's freeze in its label) and the kid's stars.
  function chips(c, kid) {
    const host = document.getElementById('hubChips');
    if (!host || !kid) return;
    const rw = c.rw, ks = rw.kidStore(kid), st = rw.streak(ks, c.day), froze = own(ks.freezes, rw.isoWeek(c.day)), stars = rw.kidStars(kid);
    const tip = TXT.streakTip(st.count) + (froze ? '. ' + TXT.freezeTip : '');
    setHTML(host, '<span class="hub-chip hub-streak' + (st.count ? '' : ' zero') + (froze ? ' froze' : '') + '" role="img" aria-label="' + esc(tip) + '" title="' + esc(tip) + '">'
      + ico('flame', { size: 16 }) + '<b>' + esc(st.count) + '</b></span>'
      + '<span class="hub-chip hub-stars" role="img" aria-label="' + esc(TXT.starsChip(stars)) + '">' + ico('star', { size: 16 }) + '<b>' + esc(stars) + '</b></span>');
  }
  function showKid(kid) {
    document.querySelectorAll('.hub-kid[data-kid]').forEach(e => { e.hidden = e.dataset.kid !== kid; });
  }

  /* ---------- «Σήμερα»: the daily mission, the notebooks, «Επανάληψη» ---------- */
  // The mission's items, as the round 2 quest card listed them: the quest's tasks (Rewards.ensureQuest and questStatus) and,
  // with fewer than 3, catalog pages never opened on this device («Άνοιξε νέο κεφάλαιο»). With any subject on a schedule the
  // tasks follow it: a page of a current unit never opened here still gives tasks from its build-time manifest, and the
  // suggestions take pages of current units, then of done units, then of subjects without a schedule (each in catalog
  // order); never a page of an upcoming or hidden unit, nor a page that already has a task.
  function questModel(k, c, ps) {
    const rw = c.rw, extra = {};
    if (ps.active) for (const id of Object.keys(ps.states)) {
      if (ps.states[id] !== 'current') continue;
      const m = c.opened(id) ? null : c.man(id);
      if (m) extra[id] = m;
    }
    let pages = pagesOf(k);
    if (ps.active) {   // a stable sort: catalog order inside each rank
      const rank = id => (ps.states[id] === 'current' ? 0 : ps.states[id] === 'done' ? 1 : own(ps.states, id) ? -1 : 2);
      pages = pages.filter(x => rank(String(x.p.id)) >= 0).sort((a, b) => rank(String(a.p.id)) - rank(String(b.p.id)));
    }
    let st = { tasks: [], allDone: false };
    rw.usePlan(window.PLAN, window.CATALOG);   // ensureQuest then reads the plan, the catalog and the kid store's `unlocked` itself
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
      const target = Number(t.target) || 0;
      return { kind: 'task', done: !!t.done, id: String(t.pageId), file: href(t.file), type: t.type, key: String(t.key),
        label: typeof t.label === 'string' ? t.label : String(t.key), target, count: Math.min(Number(t.count) || 0, target) };
    });
    const tasked = new Set(st.tasks.map(t => String(t.pageId)));
    for (const { p } of pages) {
      if (items.length >= 3) break;
      const link = href(p.file);
      if (!link || c.opened(p.id) || (ps.active && tasked.has(String(p.id)))) continue;
      items.push({ kind: 'new', done: false, id: String(p.id), file: link });
    }
    // G3: no task and no page left to open (a mission takes only open activities): the first page, in the same order, whose
    // next step is its summary (pathLevel 0), for «Συνέχισε» and questRead
    let read = null;
    if (!items.length) for (const { p } of pages) {
      const link = href(p.file);
      if (link && levelOf(c, k.key, String(p.id)) === 0) { read = { id: String(p.id), file: link }; break; }
    }
    return { items, allDone: st.allDone, read };
  }
  // Where a page sits, in words: «Φυσική, Κεφάλαιο 2: Μίγματα» (the manifest title for a page outside the catalog).
  function whereOf(k, c, id) {
    const x = pagesOf(k).find(y => String(y.p.id) === id);
    if (x) return String(x.s.name || x.s.key) + ', ' + (x.p.ch ? String(x.p.ch) + ': ' : '') + String(x.p.title || id);
    const m = c.man(id);
    return m && isStr(m.title) ? m.title : '';
  }
  function sayOf(it, where) {
    if (it.kind === 'new') return TXT.sayNew(where);
    const l = plainLabel(it.label);
    const what = it.type === 'hit' ? TXT.sayHit(l, it.target) : it.key === 'cards' && it.target > 1 ? TXT.sayCards(it.target) : TXT.sayList(l);
    return (where ? where + '. ' : '') + what;
  }
  // One notebook per subject: the unit of the first unfinished page among its current units (the class unit and any
  // unlocked on the device), else its last current unit; without a schedule, the first unit. It opens that unfinished page,
  // else the unit's first unfinished page, else its first page; it shows the unit's stars over their maximum.
  function notebooks(k, c, ps, score) {
    const out = [];
    for (const s of subsOf(k)) {
      const units = catUnits(s), e = entryOf(ps, s);
      if (!units.size) continue;
      let unit = units.keys().next().value, go = null;
      if (e && e.active) {
        const cur = [...units.keys()].filter(u => unitState(e, units.get(u)) === 'current');
        go = cur.flatMap(u => units.get(u)).find(p => !(score(String(p.id)) >= 1)) || null;
        if (go) unit = cur.find(u => units.get(u).includes(go));
        else if (cur.length) unit = cur[cur.length - 1];
      }
      const pages = units.get(unit), base = baseOf(unit, pages);
      if (!go) go = pages.find(p => !(score(String(p.id)) >= 1)) || pages[0];
      let stars = 0, max = 0;
      for (const p of pages) { const st = pageStat(c, String(p.id)); stars += st.stars; max += st.max; }
      out.push({ s, unit, link: href(go.file), base, stars, max });
    }
    return out;
  }
  function notebookHTML(nb) {
    const tag = nb.link ? 'a' : 'div', s = nb.s;
    return '<' + tag + ' class="hub-nb"' + (nb.link ? ' href="' + esc(nb.link) + '"' : '') + ' data-subj="' + esc(s.key) + '" data-unit="' + esc(nb.unit)
      + '" style="--subj:' + esc(coverOf(s)) + '"><span class="hub-nbl"><b class="hub-nbs">' + esc(s.name || s.key) + '</b>'
      + (nb.base.ch ? '<span class="hub-nbc">' + esc(chShort(nb.base.ch)) + '</span>' : '')
      + '<span class="hub-nbt">' + esc(nb.base.title || nb.unit) + '</span></span>'
      + (nb.max ? ratio(nb.stars, nb.max, 'hub-nbr', true) : '') + '</' + tag + '>';
  }
  // «Επανάληψη»: the weakest done unit (the unit of the first page of subjectBlocks' review, weakest first), with its stars
  // and its weakest activity (the counted row with the lowest value; never played first).
  function reviewRow(k, c, ps, score) {
    const b = subjectBlocks(ps, k, score), id = b.review[0];
    if (!id) return '';
    for (const s of subsOf(k)) {
      for (const [u, pages] of catUnits(s)) {
        const pg = pages.find(p => String(p.id) === id);
        if (!pg) continue;
        const base = baseOf(u, pages);
        let stars = 0, max = 0;
        for (const p of pages) { const st = pageStat(c, String(p.id)); stars += st.stars; max += st.max; }
        const m = c.man(id), prog = c.prog(id) || {}, lv = levelOf(c, k.key, id);
        let weak = null, low = Infinity;
        for (const [key, label, type] of m && m.rows.length ? c.rw.countedRows(m.rows) : []) {
          if (lv >= 0 && rowStep(key) > lv) continue;   // never an activity the learning path still locks (G2)
          const v = c.rw.rowValue(own(prog, key) ? prog[key] : null, type), val = v === null ? -1 : v;
          if (val < low) { low = val; weak = label; }
        }
        const sub = String(s.name || s.key) + (base.ch ? ', ' + chShort(base.ch) : '') + (weak !== null ? '. ' + TXT.weakest(plainLabel(weak)) : '');
        const link = href(pg.file), tag = link ? 'a' : 'div';
        return '<' + tag + ' class="hub-rev" data-unit="' + esc(u) + '" data-id="' + esc(id) + '"' + (link ? ' href="' + esc(link) + '"' : '')
          + '><span class="hub-revx"><b class="hub-revt">' + esc(base.title || u) + '</b><span class="hub-revd">' + esc(sub) + '</span></span>'
          + (max ? ratio(stars, max, 'hub-revr', true) : '') + '</' + tag + '>';
      }
    }
    return '';
  }
  // The nearest test date (Rewards.testDateFor, today or later) of a page the kid can open from «Τετράδια» (not of an
  // upcoming or hidden unit); the earlier page in catalog order on a tie. The boss nudge follows the page rule (the page
  // has a boss row and is below its maximum stars) and shows only while the boss is open (pathLevel 4).
  function testRow(k, c, ps) {
    let best = null;
    for (const { p, s } of pagesOf(k)) {
      const id = String(p.id), st = ps && own(ps.states, id) ? ps.states[id] : '';
      if (st === 'upcoming' || st === 'hidden' || !href(p.file)) continue;
      const d = c.test(k.key, id), n = d ? c.rw.daysUntil(c.day, d) : null;
      if (n !== null && (!best || n < best.n)) best = { n, p, s };
    }
    const t = best && testText(best.n);
    if (!t) return '';
    const id = String(best.p.id), m = c.man(id), rows = m && m.rows.length ? m.rows : null;
    const boss = rows && rows.some(r => r[2] === 'boss') && c.rw.pageStars(c.prog(id) || {}, rows) < maxStars(c.rw, rows);
    // the boss nudge only while the learning path has the boss open; else the step it has open (G2)
    const lv = boss ? levelOf(c, k.key, id) : -1, say = !boss ? String(best.p.title || '') : lv >= 4 ? TXT.bossTry : stepSay(lv, rows);
    const sub = String(best.s.name || best.s.key) + (best.p.ch ? ', ' + chShort(best.p.ch) : '') + '. ' + say;
    return '<a class="hub-rev hub-test' + (best.n <= 1 ? ' soon' : '') + '" href="' + esc(href(best.p.file)) + '" data-id="' + esc(id) + '">'
      + '<span class="hub-revx"><b class="hub-revt">' + esc(t) + '</b><span class="hub-revd">' + esc(sub) + '</span></span>'
      + ico('chevron-right', { size: 20, cls: 'hub-chev' }) + '</a>';
  }
  function todayView(k, c, ps, score) {
    const host = document.querySelector('#panelToday .hub-kid[data-kid="' + k.key + '"]');
    if (!host) return;
    const q = questModel(k, c, ps), nbs = notebooks(k, c, ps, score), n = q.items.length;
    const next = q.items.find(it => !it.done) || null;
    const rd = !q.allDone && !next && q.read ? whereOf(k, c, q.read.id) : null;
    let say = q.allDone ? TXT.sayDone : next ? sayOf(next, whereOf(k, c, next.id)) : q.read ? (rd ? rd + '. ' : '') + TXT.questRead : TXT.questEmpty, mini = '';
    // a task on an activity the learning path still locks: the open step of its page instead (G2), no count
    const lv = !q.allDone && next && next.kind === 'task' ? levelOf(c, k.key, next.id) : -1, shut = lv >= 0 && rowStep(next.key) > lv;
    if (shut) { const w = whereOf(k, c, next.id), m = c.man(next.id); say = (w ? w + '. ' : '') + stepSay(lv, m && m.rows); }
    if (!shut && !q.allDone && next && next.kind === 'task' && next.target > 1) mini = ratio(next.count, next.target, 'hub-mini', false, TXT.countOf(next.count, next.target));
    const goLink = (next && next.file) || (!q.allDone && q.read && q.read.file) || (nbs.find(x => x.link) || {}).link || null;
    let trail = '';
    if (n) {
      let seen = false, prevDone = false;
      const parts = q.items.map((it, i) => {
        const cls = it.done ? 'done' : seen ? 'later' : (seen = true, 'next');
        const link = i ? '<span class="hub-link' + (prevDone ? ' on' : '') + '" aria-hidden="true"></span>' : '';
        prevDone = it.done;
        return link + '<span class="hub-step ' + cls + '" data-kind="' + it.kind + '"' + (it.file ? ' data-href="' + esc(it.file) + '"' : '')
          + ' aria-hidden="true">' + (it.done ? ico('star', { size: 18 }) : String(i + 1)) + '</span>';
      });
      const done = q.items.filter(it => it.done).length;
      trail = '<div class="hub-trail" role="img" aria-label="' + esc(TXT.trail(done, n, q.allDone)) + '">' + parts.join('')
        + '<span class="hub-link' + (prevDone ? ' on' : '') + '" aria-hidden="true"></span><span class="hub-gift' + (q.allDone ? ' got' : '') + '" aria-hidden="true">'
        + ico('gift', { size: 22 }) + '</span></div>';
    }
    const go = goLink ? '<a class="hub-go" href="' + esc(goLink) + '">' + ico('play', { size: 20 }) + '<span>' + esc(TXT.go) + '</span></a>'
      : '<span class="hub-go off" aria-disabled="true">' + ico('play', { size: 20 }) + '<span>' + esc(TXT.go) + '</span></span>';
    const hid = 'hubTodayH_' + k.key, nid = 'hubBooksH_' + k.key, rid = 'hubRevH_' + k.key;
    const rows = reviewRow(k, c, ps, score) + testRow(k, c, ps);
    setHTML(host, '<section class="hub-card hub-todaycard' + (q.allDone ? ' all' : '') + '" aria-labelledby="' + hid + '"><div class="hub-trow"><h2 id="' + hid + '">'
      + esc(TXT.today) + '</h2>' + trail + '</div><div class="hub-say"><p>' + esc(say) + '</p>' + mini + '</div>' + go + '</section>'
      + '<section class="hub-nbs" aria-labelledby="' + nid + '"><h2 id="' + nid + '">' + esc(TXT.books) + '</h2><div class="hub-nbgrid">'
      + nbs.map(notebookHTML).join('') + '</div></section>'
      + '<section class="hub-revs" aria-labelledby="' + rid + '"><h2 id="' + rid + '">' + esc(TXT.review) + '</h2>'
      + (rows || '<p class="hub-empty">' + esc(TXT.reviewNone) + '</p>') + '</section>');
  }

  /* ---------- «Τετράδια»: per subject, its units in catalog order with their state, and each unit's pages ---------- */
  // States as Rewards.kidSubjects gives them: done, current (the class unit and units unlocked on the device), upcoming
  // (named, with a padlock, no page tiles: as the round 2 teaser) and hidden (not drawn). A subject without a schedule shows
  // every unit and page with no state, as before. `c` null (teacher view, no Rewards): titles only, no progress.
  function tileHTML(k, p, c) {
    const id = String(p.id), link = href(p.file), tag = link ? 'a' : 'div';
    const lv = Array.isArray(p.badge) && isStr(p.badge[1]) ? plainLabel(p.badge[1]) : '';
    let body = '<span class="hub-tl"><span class="hub-tn">' + esc(p.title || id) + '</span>' + (lv ? '<span class="hub-lv">' + esc(lv) + '</span>' : '') + '</span>';
    if (c) {
      const st = pageStat(c, id);
      body += st.max ? ratio(st.stars, st.max, 'hub-tr', true) : '<span class="hub-tns">' + esc(TXT.notStarted) + '</span>';
      const d = c.test(k.key, id), t = testText(d ? c.rw.daysUntil(c.day, d) : null);
      if (t) body += '<span class="hub-tcount">' + ico('test', { size: 16 }) + '<b>' + esc(t) + '</b></span>';
    } else if (p.desc) body += '<span class="hub-tns">' + esc(p.desc) + '</span>';
    return '<' + tag + ' class="tile hub-tile"' + (link ? ' href="' + esc(link) + '"' : '') + ' data-id="' + esc(id) + '">' + body + '</' + tag + '>';
  }
  const STATE_CHIP = { done: ['tick', 'stDone'], current: ['play', 'stCurrent'], upcoming: ['lock', 'stUpcoming'] };
  function booksHTML(k, c, ps) {
    return subsOf(k).map(s => {
      const e = entryOf(ps, s);
      const units = [...catUnits(s)].map(([u, pages]) => {
        const st = unitState(e, pages);
        if (st === 'hidden') return '';
        const base = baseOf(u, pages), chip = STATE_CHIP[st];
        return '<div class="hub-unit' + (st ? ' ' + st : '') + '" data-unit="' + esc(u) + '" data-state="' + st + '"><div class="hub-uh"><span class="hub-ut">'
          + (base.ch ? '<span class="hub-uch">' + esc(base.ch) + '</span>' : '') + '<b>' + esc(base.title || u) + '</b></span>'
          + (chip ? '<span class="hub-ust">' + ico(chip[0], { size: 16 }) + esc(TXT[chip[1]]) + '</span>' : '') + '</div>'
          + (st === 'upcoming' ? '' : '<div class="hub-pages">' + pages.map(p => tileHTML(k, p, c)).join('') + '</div>') + '</div>';
      }).join('');
      return '<section class="hub-subj" data-subj="' + esc(s.key) + '" style="--subj:' + esc(coverOf(s)) + '"><h2>' + esc(s.name || s.key) + '</h2>' + units + '</section>';
    }).join('');
  }
  function booksView(k, c, ps) {
    const host = document.querySelector('#panelBooks .hub-kid[data-kid="' + k.key + '"]');
    if (host) setHTML(host, booksHTML(k, c, ps));
  }

  /* ---------- «Βραβεία» (round 3, W6a): level, sticker album, badge wall (per kid); the family jar ----------
     One visual language (brief 4.5): a white card per block, its count drawn as a ratio (bar, then «n / max»); an earned
     sticker or badge is a solid card with its art on a yellow disc, a missing one a dashed grey tile with a padlock. The
     album shows its first row (3 stickers on a phone, 5 or 6 wider), the badge wall its first two rows (4 or 6), earned
     first, and a «Δες όλο ...» button opens the whole set in place (the album grouped by page); the choice is kept per kid
     while the hub is open (rewards.css hides the rest of the first 6 by width). What earns
     a sticker, badge or level comes from engine/rewards.js and is not changed here. */
  const awOpen = new Set();   // 'album:<kid>', 'badges:<kid>': opened in place
  // A drawn ratio for «Βραβεία»: the bar first, then «n / max» in ink (D6, brief 4.5).
  function aRatio(n, max, frac, label) {
    const pct = Math.round(Math.max(0, Math.min(1, frac)) * 100);
    return '<span class="hub-aratio" role="img" aria-label="' + esc(label) + '"><span class="hub-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>'
      + '<b class="hub-num">' + esc(n + ' / ' + max) + '</b></span>';
  }
  // The sticker owl (D11: the mascot-sticker symbol of engine/icons.svg) on a sticker disc: empty states and generic stickers.
  const owlDisc = () => '<span class="hub-disc hub-owl" aria-hidden="true">' + ico('mascot-sticker', { size: 40 }) + '</span>';
  const emptyHTML = text => '<div class="hub-awempty">' + owlDisc() + '<p>' + esc(text) + '</p></div>';
  function moreHTML(what, kid, open, label) {
    return '<button type="button" class="hub-more" data-more="' + what + '" aria-expanded="' + open + '" aria-controls="hubAw_' + what + '_' + esc(kid) + '">'
      + '<span>' + esc(open ? TXT.less : label) + '</span>' + ico('chevron-down', { size: 20 }) + '</button>';
  }
  // «Δες όλο ...» and «Δείξε λιγότερα»: one listener on the panel; the button is drawn again, so focus goes to the new one.
  function moreClick(e) {
    const b = e.target && e.target.closest ? e.target.closest('[data-more]') : null, box = b && b.closest('.hub-kid[data-kid]');
    if (!box) return;
    const id = b.dataset.more + ':' + box.dataset.kid;
    if (awOpen.has(id)) awOpen.delete(id); else awOpen.add(id);
    render();
    const nb = box.querySelector('[data-more="' + b.dataset.more + '"]');
    if (nb) nb.focus();
  }

  function levelView(sec, k, c) {
    const host = sec.querySelector('[data-rw="lvl"]');
    if (!host) return;
    const rw = c.rw, stars = rw.kidStars(k.key), lv = rw.level(stars), ks = rw.kidStore(k.key);
    const froze = own(ks.freezes, rw.isoWeek(c.day)), up = rw.level(lv.next), hid = 'hubLvlH_' + k.key;
    host.setAttribute('aria-labelledby', hid);
    setHTML(host, '<h2 id="' + esc(hid) + '">' + ico('star', { size: 22, cls: 'hub-star' }) + '<span>' + esc(TXT.level) + '</span></h2>'
      + '<div class="hub-lvrow"><span class="hub-lvno" aria-hidden="true">' + esc(lv.idx + 1) + '</span><span class="hub-lvt"><b class="hub-lvn">'
      + esc(lv.name) + '</b><span class="hub-lvs">' + esc(TXT.levelNo(lv.idx + 1)) + '</span></span></div>'
      + aRatio(stars, lv.next, lv.frac, TXT.levelAria(lv.name, stars, lv.next))
      + '<p class="hub-lvleft">' + esc(TXT.levelLeft(Math.max(1, lv.next - stars), up.name)) + '</p>'
      + (froze ? '<p class="hub-freeze">' + esc(TXT.freezeTip) + '</p>' : ''));
  }

  // The album as data (for tests): per catalog page its stickers, one per counted row plus the boss, as in round 2: a row
  // sticker is earned at 3 stars (best === 3), the gold boss sticker by a won boss. A page with no known rows is sealed.
  // A sticker's art is the emoji its activity label starts with (a placeholder until the art pass, A4), else the owl.
  function albumModel(k, c) {
    let got = 0, all = 0;
    const pages = pagesOf(k).map(({ p, s }) => {
      const id = String(p.id), m = c.man(p.id);
      const page = { id, title: String(p.title || id), sub: [s.name || s.key, chShort(p.ch)].filter(Boolean).join(', '), file: href(p.file),
        cover: coverOf(s), sealed: !m || !m.rows.length, got: 0, stickers: [] };
      if (page.sealed) return page;
      const prog = c.prog(p.id) || {};
      const rows = c.rw.countedRows(m.rows).concat(m.rows.filter(r => r[2] === 'boss'));
      page.stickers = rows.map(([key, label, type]) => {
        const words = String(label).trim().split(/\s+/), first = words[0] || '', hasEmo = PICTO_RE.test(first);
        const boss = type === 'boss', rec = own(prog, key) ? prog[key] : null;
        const on = boss ? !!(rec && rec.won === true) : !!(rec && rec.best === 3);
        if (on) page.got++;
        return { key, page: id, name: hasEmo ? words.slice(1).join(' ') : String(label).trim(), emo: hasEmo ? first : '', boss, on, cover: page.cover };
      });
      got += page.got; all += page.stickers.length;
      return page;
    });
    return { got, all, pages };
  }
  function stickerHTML(st) {
    const art = !st.on ? ico('lock', { size: 24 }) : st.boss ? ico('trophy', { size: 30 })
      : st.emo ? '<span class="hub-emo">' + esc(st.emo) + '</span>' : ico('mascot-sticker', { size: 40 });
    return '<li class="hub-stk ' + (st.on ? 'on' : 'off') + (st.boss ? ' gold' : '') + '" style="--subj:' + esc(st.cover) + '" title="' + esc(st.name) + '">'
      + '<span class="hub-disc" aria-hidden="true">' + art + '</span><span class="hub-stkn">' + esc(st.name) + '</span>'
      + '<span class="hub-sr">' + esc(st.on ? TXT.got : TXT.notYet) + '</span></li>';
  }
  function album(sec, k, c) {
    const host = sec.querySelector('[data-rw="album"]');
    if (!host) return;
    const a = albumModel(k, c), open = awOpen.has('album:' + k.key), hid = 'hubAlbumH_' + k.key, gid = 'hubAw_album_' + k.key;
    let body;
    if (open) {
      body = '<div class="hub-apgs" id="' + esc(gid) + '">' + a.pages.map(pg => '<section class="hub-apg" style="--subj:' + esc(pg.cover) + '">'
        + '<h3 class="hub-apgh"><span class="hub-apgt"><span>' + esc(pg.title) + '</span><small>' + esc(pg.sub) + '</small></span>'
        + (pg.sealed ? '' : '<b class="hub-num">' + esc(pg.got + ' / ' + pg.stickers.length) + '</b>') + '</h3>'
        + (pg.sealed
          ? (pg.file ? '<a class="hub-seal" href="' + esc(pg.file) + '">' : '<div class="hub-seal">') + ico('lock', { size: 24 }) + '<span>' + esc(TXT.sealed) + '</span>' + (pg.file ? '</a>' : '</div>')
          : '<ul class="hub-grid hub-stks">' + pg.stickers.map(stickerHTML).join('') + '</ul>')
        + '</section>').join('') + '</div>';
    } else {
      const flat = a.pages.flatMap(pg => pg.stickers), first = flat.filter(s => s.on).concat(flat.filter(s => !s.on)).slice(0, 6);
      body = first.length ? '<ul class="hub-grid hub-stks hub-prev" id="' + esc(gid) + '">' + first.map(stickerHTML).join('') + '</ul>' : '<div id="' + esc(gid) + '"></div>';
    }
    const more = a.pages.length && (a.all > 3 || a.pages.some(pg => pg.sealed));
    setHTML(host, '<section class="hub-card hub-aw" aria-labelledby="' + esc(hid) + '"><div class="hub-awh"><h2 id="' + esc(hid) + '">' + ico('notebook', { size: 22 })
      + '<span>' + esc(TXT.album) + '</span></h2>' + aRatio(a.got, a.all, a.all ? a.got / a.all : 0, TXT.albumAria(a.got, a.all)) + '</div>'
      + '<p class="hub-awnote">' + esc(TXT.albumHow) + '</p>' + (a.got ? '' : emptyHTML(TXT.albumEmpty)) + body
      + (more ? moreHTML('album', k.key, open, TXT.albumAll(a.all)) : '') + '</section>');
  }

  // The badge wall as data (for tests): every badge of Rewards.BADGES, the earned ones first, each group in table order.
  function badgeModel(rw, have) {
    const list = rw.BADGES.map(b => {
      const d = own(have, b.id) ? have[b.id] : null;
      return { id: b.id, name: b.name, emo: b.emo, desc: b.desc, secret: !!b.secret, on: !!d, day: d ? String(d) : null };
    });
    const got = list.filter(b => b.on);
    return { got: got.length, all: list.length, list: got.concat(list.filter(b => !b.on)) };
  }
  function badgeHTML(b) {
    if (b.on) {
      return '<li class="hub-bdg on"><span class="hub-disc" aria-hidden="true"><span class="hub-emo">' + esc(b.emo) + '</span></span>'
        + '<b class="hub-bdgn">' + esc(b.name) + '</b><span class="hub-bdgd">' + esc(b.desc) + '</span>'
        + '<span class="hub-bdgw">' + esc(TXT.earnedOn(fmtDay(b.day))) + '</span></li>';
    }
    // locked: what earns it; a secret badge keeps its name and rule hidden until it is earned
    return '<li class="hub-bdg off' + (b.secret ? ' secret' : '') + '"><span class="hub-disc" aria-hidden="true">' + ico('lock', { size: 24 }) + '</span>'
      + '<b class="hub-bdgn">' + esc(b.secret ? TXT.secret : b.name) + '</b><span class="hub-bdgd">' + esc(b.secret ? TXT.secretHow : b.desc) + '</span>'
      + '<span class="hub-sr">' + esc(TXT.notYet) + '</span></li>';
  }
  function badges(sec, k, c) {
    const host = sec.querySelector('[data-rw="badges"]');
    if (!host) return;
    const m = badgeModel(c.rw, c.rw.kidStore(k.key).badges), open = awOpen.has('badges:' + k.key), hid = 'hubBadgesH_' + k.key;
    const shown = open ? m.list : m.list.slice(0, 6);
    setHTML(host, '<section class="hub-card hub-aw" aria-labelledby="' + esc(hid) + '"><div class="hub-awh"><h2 id="' + esc(hid) + '">' + ico('trophy', { size: 22 })
      + '<span>' + esc(TXT.badges) + '</span></h2>' + aRatio(m.got, m.all, m.all ? m.got / m.all : 0, TXT.badgesAria(m.got, m.all)) + '</div>'
      + (m.got ? '' : emptyHTML(TXT.badgesEmpty))
      + '<ul class="hub-grid hub-bdgs' + (open ? '' : ' hub-prev') + '" id="hubAw_badges_' + esc(k.key) + '">' + shown.map(badgeHTML).join('') + '</ul>'
      + (m.all > 4 ? moreHTML('badges', k.key, open, TXT.badgesAll(m.all)) : '') + '</section>');
  }

  /* family jar: one for the family, after the kid blocks of «Βραβεία»: the jar drawn with its fill, the ratio, the goal's
     reward; the celebration when it fills (R20) is unchanged */
  function jarView(c) {
    const rw = c.rw, fam = rw.family(), j = rw.jar(rw.totalStars(), fam);
    const box = document.getElementById('rwJar');
    if (!box) return;
    const reward = typeof fam.jarReward === 'string' && fam.jarReward.trim() ? fam.jarReward : TXT.jarReward;
    const frac = Math.min(1, j.goal ? j.fill / j.goal : 0), pct = Math.round(frac * 100);
    box.className = 'hub-card hub-jarc' + (j.full ? ' full' : '');
    box.setAttribute('aria-labelledby', 'hubJarH');
    setHTML(box, '<div class="hub-jar" aria-hidden="true"><span class="hub-jarlid"></span><span class="hub-jarbody"><i style="height:' + pct + '%"></i>'
      + ico('star', { size: 28, cls: 'hub-star' }) + '</span></div>'
      + '<div class="hub-jart"><h2 id="hubJarH">' + esc(TXT.jarTitle) + '</h2><p class="hub-jarsub">' + esc(TXT.jarSub) + '</p>'
      + aRatio(j.fill, j.goal, frac, TXT.jarAria(j.fill, j.goal))
      + '<p class="hub-jarrw">' + ico('gift', { size: 20 }) + '<span>' + esc(TXT.jarPrize(reward)) + '</span></p>'
      + (j.full ? '<p class="hub-jarfull" role="status">' + esc(TXT.jarFull) + '</p>' : '') + '</div>');
    // R20: celebrate once per jar; jarCelebrated holds the jarSpent value of the jar already celebrated.
    if (j.full && fam.jarCelebrated !== fam.jarSpent) {
      const helpers = kidsOf().map(k => k.key).filter(key => rw.kidStarsSince(key, fam.launch) > 0);   // stars since launch only
      const got = rw.onJarFull(helpers);   // before marking the jar celebrated: a throw here leaves it to the next render
      fam.jarCelebrated = fam.jarSpent;
      rw.saveFamily(fam);
      const ids = [...new Set(Object.keys(got).reduce((a, key) => a.concat(got[key]), []))];   // one toast per badge, not per kid
      const ui = UI();
      if (ui) {
        ui.toast(TXT.jarFull);
        if (ids.length) ui.celebrate({ starsUp: null, sticker: false, badges: ids, questDone: false });
        else { ui.confetti(); ui.sound('win'); }
      }
    }
  }

  function awardsView(k, c) {
    const sec = document.querySelector('#panelAwards .hub-kid[data-kid="' + k.key + '"]');
    if (!sec) return;
    step(() => levelView(sec, k, c));
    step(() => album(sec, k, c));
    step(() => badges(sec, k, c));
  }

  /* ---------- «Γονιός»: the sound toggle and the schedule hint (outside the gate), then the parent area ---------- */
  function soundOnce() {
    const host = document.getElementById('hubSound'), ui = UI();
    if (!host || !ui || host.querySelector('.rw-snd')) return;
    const lab = mk('span', 'hub-soundt', TXT.sound);
    host.appendChild(lab);
    const b = ui.soundToggle(host, { icon: true });   // the sound-on and sound-off icons, no emoji (W8)
    if (!b) lab.remove(); else host.hidden = false;
  }
  // The kid's subjects without a schedule, named above the gate while the parent area is closed.
  function planHintView(c, kid) {
    const p = document.getElementById('hubPlanHint'), k = kidsOf().find(x => x.key === kid);
    if (!p) return;
    const ks = k ? c.rw.kidStore(k.key) : null, ps = k ? c.rw.kidSubjects(window.CATALOG, window.PLAN, k.key, ks && ks.unlocked) : null;
    const names = k ? subsOf(k).filter(s => { const e = entryOf(ps, s); return !(e && e.active); }).map(s => String(s.name || s.key)) : [];
    const text = names.length && !pState.open ? TXT.planHint(names.join(', ')) : '';
    if (p.textContent !== text) p.textContent = text;
    p.hidden = !text;
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
  // A state line with its icon (tick, or cross when bad); its textContent stays the text alone.
  function lineMsg(node, text, bad) {
    node.innerHTML = text ? ico(bad ? 'cross' : 'tick', { size: 18 }) + '<span>' + esc(text) + '</span>' : '';
    node.className = 'rw-msg rw-line' + (bad ? ' err' : '');
  }
  function btn(text, cls) { const b = mk('button', 'rw-pbtn' + (cls ? ' ' + cls : ''), text); b.type = 'button'; return b; }
  // A button with an icon before its text (textContent stays the text).
  function tbtn(icon, text, cls) { const b = btn('', cls); b.innerHTML = ico(icon, { size: 20 }) + '<span>' + esc(text) + '</span>'; return b; }
  // An icon-only button; its name is the label.
  function ibtn(icon, label) { const b = btn('', 'rw-ibtn'); b.innerHTML = ico(icon, { size: 22 }); b.setAttribute('aria-label', label); return b; }

  // Press and hold: pointer (mouse, touch, pen) or Enter/Space. Release before HOLD_MS cancels; a click alone does nothing.
  function gate(host) {
    const b = mk('button', 'rw-gate');
    b.type = 'button';
    b.setAttribute('aria-describedby', 'rwGateHint');
    b.innerHTML = '<svg class="rw-ring" viewBox="0 0 36 36" aria-hidden="true"><circle class="bg" cx="18" cy="18" r="15.9"/>'
      + '<circle class="fg" cx="18" cy="18" r="15.9" pathLength="100"/></svg>' + ico('lock', { size: 20, cls: 'rw-gate-i' }) + '<span></span>';
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
      const days = mk('span', 'hub-bar rw-week-bar');   // the days drawn too (D6)
      days.setAttribute('aria-hidden', 'true');
      days.innerHTML = '<i style="width:' + Math.round(Math.max(0, Math.min(7, Number(w.daysActive) || 0)) / 7 * 100) + '%"></i>';
      ul.firstChild.appendChild(days);
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
        const row = dateRow(k, p, c, 'rwT_', (p.emo ? p.emo + ' ' : '') + String(p.title || p.id || ''));
        if (row) box.appendChild(row);
      }
    }
  }
  // One test-date row (label, date field, «Καθαρισμός», status) for page `p` of kid `k`, field id pre + kid + '_' + page id.
  // Used by the test dates card (rwT_) and by the schedule editor for the current unit's pages (rwTS_); both write the kid
  // store's testDates, and syncForms keeps every field of a page equal. Null for a page without an id.
  function dateRow(k, p, c, pre, label) {
    const id = String(p.id || '');
    if (!id) return null;
    const row = mk('div', 'rw-trow'), inp = mk('input'), lab = mk('label', 'rw-tlab', label);
    const dates = c.rw.kidStore(k.key).testDates;
    Object.assign(inp, { type: 'date', id: pre + k.key + '_' + id, min: c.day, value: own(dates, id) ? dates[id] : '' });
    inp.dataset.kid = k.key; inp.dataset.page = id;
    lab.htmlFor = inp.id;
    const clr = btn(TXT.tClear, 'rw-tclr'), out = mk('span', 'rw-msg');
    out.setAttribute('role', 'status'); out.id = inp.id + '_msg';
    const now = () => document.getElementById(out.id) || out;   // the editor's rows are rebuilt by the render a save runs
    const put = v => {
      const kid = R().kidStore(k.key);
      if (v) kid.testDates[id] = v; else delete kid.testDates[id];
      R().saveKid(k.key, kid);
      render();   // the countdowns follow at once
      syncForms();
    };
    inp.onchange = () => {
      const v = inp.value;
      if (!v) { put(''); return msg(now(), TXT.tCleared); }
      if (!DATE_RE.test(v) || R().addDays(v, 0) !== v) return msg(out, TXT.tBad, true);
      put(v); msg(now(), TXT.tSaved);
    };
    clr.onclick = () => { inp.value = ''; put(''); msg(now(), TXT.tCleared); };
    clr.setAttribute('aria-label', TXT.tClear + ': ' + lab.textContent);
    clr.id = inp.id + '_clr';
    row.append(lab, inp, clr, out);
    step(() => planHint(inp));
    return row;
  }

  // «Άνοιξε όλο το κεφάλαιο» (round 3, W3): one row per chapter page of each kid, a button (armed: a second tap confirms,
  // since it cannot be undone) or, once done, «Ανοιχτό από τον γονιό». Writes progress_<id>._path.all (Rewards.openChapter);
  // an open chapter page follows through its storage listener.
  function openCard(box) {
    box.appendChild(mk('h4', '', TXT.oTitle));
    box.appendChild(mk('p', 'rw-psub', TXT.oSub));
    for (const k of kidsOf()) {
      const pages = pagesOf(k).filter(({ p }) => p && typeof p.id === 'string' && p.id);
      if (!pages.length) continue;
      box.appendChild(mk('h5', '', String(k.grade || k.key)));
      for (const { p } of pages) {
        const id = p.id, row = mk('div', 'rw-trow rw-orow'), lab = mk('span', 'rw-tlab', (p.emo ? p.emo + ' ' : '') + String(p.title || id));
        const out = mk('span', 'rw-msg');
        out.setAttribute('role', 'status');
        row.dataset.page = id;
        lab.id = 'rwOpenL_' + id;
        // the state that stays: a tick and «Ανοιχτό από τον γονιό» (focusable by script, so focus is not lost after the tap)
        const done = () => {
          const st = mk('span', 'rw-oopen');
          st.innerHTML = ico('tick', { size: 18 }) + '<span>' + esc(TXT.oIsOpen) + '</span>';
          st.tabIndex = -1;
          row.replaceChildren(lab, st, out);
          return st;
        };
        if (R().chapterOpen(id)) { done(); box.appendChild(row); continue; }
        const b = btn(TXT.oOpen, 'rw-obtn');
        b.id = 'rwOpen_' + id;
        b.setAttribute('aria-describedby', lab.id);
        let armed = null;
        const disarm = () => { clearTimeout(armed); armed = null; b.textContent = TXT.oOpen; b.classList.remove('armed'); };
        b.onclick = () => {
          if (!armed) { b.textContent = TXT.oSure; b.classList.add('armed'); armed = setTimeout(disarm, ARM_MS); return; }
          disarm();
          R().openChapter(id);
          if (!R().chapterOpen(id)) return;
          done().focus();
          msg(out, TXT.oDone);
        };
        row.append(lab, b, out);
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

  // The family account card (engine/sync.js, loaded by RewardsUI.loadSync), right after the weekly notes and before «Πού
  // είναι η τάξη», only while the panel is open and sync is on. Signed out: the one sign-in form of the parent area, for the
  // sync and the schedule alike (decision 7; no sign-up, no reset link); signed in: the account, the sync state and sign
  // out. Rebuilt only when that mode changes, so what the parent typed survives the renders a sync triggers. The password is
  // read once on submit, the field is emptied at once, and it is never stored, logged or put in a URL (the form posts
  // nowhere: its inputs have no name, and submit is handled here). After sign-in or sign-out the schedule cards follow
  // through schedState (their mode changed).
  const SY_ERR = { empty: 'syEmpty', credentials: 'syBad', network: 'syNet' };
  let syFocus = false;   // after sign-in or sign-out: focus the rebuilt card's heading
  // The sign-in form, built into `card` (ids rwSyncH, rwSyncExp, rwSyncEmail, rwSyncPass, rwSyncShow, rwSyncGo, rwSyncOut).
  function syncOut(card, st) {
    const P = 'rwSync';
    const h = mk('h4', '', TXT.syInTitle), exp = mk('p', 'rw-msg err', st.expired ? TXT.syExpired : '');
    h.id = P + 'H'; h.tabIndex = -1; exp.id = P + 'Exp';
    const form = mk('form', 'rw-syform'), email = mk('input'), pass = mk('input'), le = mk('label', 'rw-field', TXT.syEmail), lp = mk('label', 'rw-field', TXT.syPass);
    form.method = 'post'; form.noValidate = true;
    Object.assign(email, { type: 'email', id: P + 'Email', autocomplete: 'username', spellcheck: false, inputMode: 'email' });
    email.setAttribute('autocapitalize', 'none');
    Object.assign(pass, { type: 'password', id: P + 'Pass', autocomplete: 'current-password', spellcheck: false });
    pass.setAttribute('autocapitalize', 'none');
    le.htmlFor = P + 'Email'; lp.htmlFor = P + 'Pass';
    const show = btn(TXT.syShow, 'rw-syshow'), row = mk('div', 'rw-sypass');
    show.id = P + 'Show'; show.setAttribute('aria-pressed', 'false'); show.setAttribute('aria-controls', P + 'Pass');
    const hide = () => { pass.type = 'password'; show.setAttribute('aria-pressed', 'false'); show.textContent = TXT.syShow; };
    show.onclick = () => { if (pass.type === 'password') { pass.type = 'text'; show.setAttribute('aria-pressed', 'true'); show.textContent = TXT.syHide; } else hide(); };
    row.append(pass, show);
    const go = mk('button', 'rw-pbtn rw-confirm', TXT.sySignIn), out = mk('p', 'rw-msg');
    go.type = 'submit'; go.id = P + 'Go'; out.id = P + 'Out'; out.setAttribute('role', 'status');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (go.disabled || !window.Sync) return;
      const mail = email.value;
      let pw = pass.value;
      pass.value = ''; hide();
      go.disabled = true; go.textContent = TXT.syBusy; msg(out, '');
      let r = null;
      try { r = await window.Sync.signIn(mail, pw); } catch (err) { r = null; }
      pw = '';
      go.disabled = false; go.textContent = TXT.sySignIn;
      if (r && r.ok) { syFocus = true; step(syncCard); return; }
      msg(out, TXT[SY_ERR[r && r.error] || 'syOther'], true);
      pass.focus();
    });
    form.append(le, email, lp, row, go, out);
    card.append(h, mk('p', 'rw-psub', TXT.syInSub), exp, form);
  }
  function syncIn(card) {
    const h = mk('h4', '', TXT.syTitle), as = mk('p', 'rw-psub rw-syas'), line = mk('p', 'rw-msg'), retry = btn(TXT.syRetry), out = btn(TXT.syOut);
    h.id = 'rwSyncH'; h.tabIndex = -1; as.id = 'rwSyncAs'; line.id = 'rwSyncState'; line.setAttribute('role', 'status');
    retry.id = 'rwSyncRetry'; out.id = 'rwSyncSignOut';
    retry.onclick = () => { if (window.Sync) window.Sync.sync(); };
    out.onclick = async () => {
      out.disabled = true;
      try { if (window.Sync) await window.Sync.signOut(); } catch (e) { console.error(e); }
      out.disabled = false; syFocus = true; step(syncCard);
    };
    card.append(h, as, line, retry, out);
  }
  function syncCard() {
    const host = document.getElementById('rwParent'), S = window.Sync;
    let card = document.getElementById('rwSync');
    const st = S && pState.open && host && host.dataset.state === 'open' ? S.state() : null;
    if (!st || st.status === 'off') { if (card) card.remove(); return; }
    const mode = st.status === 'signedIn' ? 'in' : 'out';
    if (!card || card.dataset.mode !== mode) {
      const fresh = mk('div', 'rw-pcard rw-sync');
      fresh.id = 'rwSync'; fresh.dataset.mode = mode;
      if (mode === 'in') syncIn(fresh); else syncOut(fresh, st);
      const weeks = document.getElementById('rwWeeks');
      if (card) card.replaceWith(fresh); else if (weeks) weeks.after(fresh); else host.appendChild(fresh);
      card = fresh;
    }
    if (mode === 'in') {
      const as = TXT.syAs(st.email || ''), bad = st.sync === 'failed';
      const text = st.family === 'none' ? TXT.syNoFam : bad ? TXT.syFail : st.sync === 'saved' ? TXT.sySaved : TXT.syWait;
      const a = document.getElementById('rwSyncAs'), line = document.getElementById('rwSyncState');
      if (a.textContent !== as) a.textContent = as;
      if (line.textContent !== text || line.classList.contains('err') !== bad) lineMsg(line, text, bad);
      document.getElementById('rwSyncRetry').hidden = !bad;
    } else {
      const exp = document.getElementById('rwSyncExp'), text = st.expired ? TXT.syExpired : '';
      if (exp.textContent !== text) exp.textContent = text;
    }
    if (syFocus) { syFocus = false; const h = document.getElementById('rwSyncH'); if (h) h.focus(); }
  }

  // «Πού είναι η τάξη» (#rwSched): a two-part switch of the kids (one kid's card shown at a time, the hub's kid first), then
  // one card per kid with catalog subjects, rebuilt on every render; each subject a part with its cover colour on the left
  // edge. The mode follows cloud sync (schedMode):
  //   device  sync off (empty sync-config.js) or not booted: the class plan card, below.
  //   signin  sync on, signed out: the same device card, pointing to the family account card above (its one sign-in form).
  //   edit    signed in: the schedule editor (round 2 brief, section 8), below.
  // Device card, one part per subject: with a schedule (Rewards.kidSubjects) it names the class's current unit, lists the
  // units unlocked on this device with «Κλείδωσε ξανά» each, and offers «Ξεκλείδωσε το επόμενο» for the upcoming unit (every
  // page of the unit); without one it says so, with a hint to set it (visible only here: the kid sees all of that subject's
  // chapters, as before). One tap each (easily undone); the hub re-renders at once.
  // Editor, one part per subject: the arrows around the current unit (one unit each way; from no schedule forward is the
  // first unit), its chapter label and title (or «Χωρίς πρόγραμμα»), the test date field of each page of the current unit
  // (dateRow: the kid store's testDates, as in the test dates card), a native select of every unit, with «Χωρίς πρόγραμμα»
  // only while none is set (a schedule row is never deleted), and the units unlocked on this device with «Κλείδωσε ξανά»
  // (they still show to the kid). A change goes to Sync.setSchedule, which writes the device copy at once and starts a cycle,
  // and the hub re-renders at once. Under the parts, the card's state line (schedLines): saved, waiting to sync, or failed
  // with «Δοκίμασε τώρα».
  // Status nodes are reused across rebuilds so they are announced. Focus moves to the control that undoes the tap (device)
  // or stays on the control used (editor); a render from elsewhere (a pull) puts it back on the element with the same id.
  const planMsgs = new Map();    // kid key -> the card's action status node
  const planLines = new Map();   // kid key -> the editor's state line
  let planFocus = null;          // set by a tap: ids to try after the rebuild, in order (the first enabled one present)
  let schedBuilt = null;         // the mode the cards were last built in
  let pKid = null;               // the kid whose card the switch shows
  function schedMode() {
    const S = window.Sync, st = S && typeof S.state === 'function' && typeof S.setSchedule === 'function' ? S.state() : null;
    return !st || st.status === 'off' ? 'device' : st.status === 'signedIn' ? 'edit' : 'signin';
  }
  // A unit's base page (the page whose id is the unit) in kid `k`.
  const unitPage = (k, u) => pagesOf(k).map(x => x.p).find(x => String(x.id) === u) || null;
  // A unit's name in the editor: its base page's chapter label and title.
  function unitLabel(k, u) {
    const p = unitPage(k, u);
    return p ? (p.ch ? String(p.ch) + ': ' : '') + String(p.title || u) : u;
  }
  function focusFirst(ids) {
    for (const id of ids) { const e = id && document.getElementById(id); if (e && !e.disabled) { e.focus(); return; } }
  }
  // The two-part kid switch of «Πού είναι η τάξη» (two kids or more with subjects); it only shows the other kid's card.
  function kidSwitch(box, kids) {
    let sw = document.getElementById('rwSchedKid');
    if (kids.length < 2) { if (sw) sw.remove(); return; }
    if (!sw) {
      sw = mk('div', 'rw-kidsw');
      sw.id = 'rwSchedKid';
      sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', TXT.kidSwitch);
      sw.style.setProperty('--n', String(kids.length));
      for (const k of kids) {
        const b = mk('button', 'rw-kidsw-b', String(k.grade || k.key));
        b.type = 'button'; b.dataset.kid = String(k.key);
        b.onclick = () => { pKid = k.key; paintSwitch(); };
        sw.appendChild(b);
      }
      const h = box.querySelector('h4');
      if (h) h.after(sw); else box.prepend(sw);
    }
    paintSwitch();
  }
  function paintSwitch() {
    document.querySelectorAll('#rwSchedKid button[data-kid]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kid === pKid)));
    document.querySelectorAll('#rwSched .rw-plancard').forEach(c => { c.hidden = c.id !== 'rwPlan_' + pKid; });
  }
  // The class unit's place in the subject («Κεφάλαιο 2 από 3»), drawn.
  function posPart(e) {
    const list = e && e.active && Array.isArray(e.units) ? e.units : [], i = list.indexOf(e && e.current);
    if (i < 0) return null;
    const s = mk('span', 'rw-cppos');
    s.setAttribute('role', 'img'); s.setAttribute('aria-label', TXT.cpPos(i + 1, list.length));
    s.innerHTML = '<span class="hub-bar" aria-hidden="true"><i style="width:' + Math.round((i + 1) / list.length * 100) + '%"></i></span><b>' + esc(TXT.countOf(i + 1, list.length)) + '</b>';
    return s;
  }
  function planCards(c) {
    const box = document.getElementById('rwSched');
    if (!box) return;
    const mode = schedMode(), act = document.activeElement;
    const keep = act && act.id && act.closest && act.closest('.rw-plancard') ? act.id : null;
    schedBuilt = mode;
    const withSubs = kidsOf().filter(k => subsOf(k).length);
    if (!withSubs.some(k => k.key === pKid)) pKid = withSubs.length ? withSubs[0].key : null;
    kidSwitch(box, withSubs);
    for (const k of kidsOf()) {
      const cid = 'rwPlan_' + k.key, subs = subsOf(k);
      let card = document.getElementById(cid);
      if (!subs.length) { if (card) card.remove(); planMsgs.delete(k.key); planLines.delete(k.key); continue; }
      const U = c.rw.kidStore(k.key).unlocked, st = c.rw.kidSubjects(window.CATALOG, window.PLAN, k.key, U);
      const names = new Map(pagesOf(k).map(({ p }) => [String(p.id), (p.emo ? p.emo + ' ' : '') + String(p.title || p.id)]));
      const name = id => names.get(id) || id;
      if (!card) { card = mk('div', 'rw-pcard rw-plancard'); card.id = cid; }
      card.dataset.mode = mode;
      if (card.parentElement !== box) box.appendChild(card);
      let out = planMsgs.get(k.key);
      if (!out) { out = mk('p', 'rw-msg'); out.setAttribute('role', 'status'); planMsgs.set(k.key, out); }
      const h = mk('h4', '', TXT.cpTitle(String(k.grade || k.key)));
      h.tabIndex = -1; h.id = cid + '_h';
      card.replaceChildren(h, mk('p', 'rw-psub', mode === 'edit' ? TXT.spSub : mode === 'signin' ? TXT.spInHint : TXT.cpSub));
      for (const s of subs) {
        const e = own(st.subjects, s.key) ? st.subjects[s.key] : null, sid = cid + '_' + s.key, part = mk('div', 'rw-cpsubj');
        const head = mk('div', 'rw-cphead'), pos = posPart(e);
        part.id = sid;
        part.style.setProperty('--subj', coverOf(s));
        head.appendChild(mk('h5', '', String(s.name || s.key)));
        if (pos) head.appendChild(pos);
        part.appendChild(head);
        card.appendChild(part);
        if (mode === 'edit' && e) { editPart(part, c, k, s, e, sid, h, name); continue; }
        if (!e || !e.active) { part.appendChild(mk('p', 'rw-psub rw-cphint', TXT.cpNone)); continue; }
        part.appendChild(mk('p', 'rw-cpnow', TXT.cpNow(name(e.current))));
        unlockedPart(part, k, s, e, sid, h, out, name, true);
      }
      card.appendChild(out);
      if (mode === 'edit') {
        let line = planLines.get(k.key);
        if (!line) { line = mk('p', 'rw-msg'); line.setAttribute('role', 'status'); planLines.set(k.key, line); }
        line.id = cid + '_state';
        const retry = btn(TXT.syRetry);
        retry.id = cid + '_retry'; retry.hidden = true;
        retry.onclick = () => { if (window.Sync) window.Sync.sync(); };
        card.append(line, retry);
      }
    }
    paintSwitch();
    schedLines();
    if (planFocus) { const f = planFocus; planFocus = null; focusFirst(f); }
    else if (keep && document.activeElement !== document.getElementById(keep)) focusFirst([keep]);
  }
  // The units after the class unit that are unlocked on this device, each with «Κλείδωσε ξανά»; then, with `next`, the
  // upcoming unit with «Ξεκλείδωσε το επόμενο».
  function unlockedPart(box, k, s, e, sid, h, out, name, next) {
    const units = unitsIn(s, e), state = u => e.states[units.get(u)[0]];
    const mine = [...units.keys()].filter(u => u !== e.current && state(u) === 'current');   // unlocked on this device
    if (mine.length) box.appendChild(mk('p', 'rw-week-wh', TXT.cpMine));
    for (const u of mine) {
      const row = mk('div', 'rw-trow'), lock = tbtn('lock', TXT.cpLock);
      lock.id = sid + '_lock_' + u;
      lock.setAttribute('aria-label', TXT.cpLockOf(name(u)));
      lock.onclick = () => {
        let changed = false;
        for (const id of units.get(u)) changed = R().lockPage(k.key, id) || changed;
        if (changed) msg(out, TXT.cpClosed(name(u)));
        planFocus = [sid + '_next', sid + '_fwd', h.id];
        render();
      };
      row.append(mk('span', 'rw-tlab', name(u)), lock);
      box.appendChild(row);
    }
    const up = next ? [...units.keys()].find(u => state(u) === 'upcoming') : undefined;
    if (up === undefined) return;
    const is = mk('p', 'rw-psub', TXT.cpNextIs(name(up))), go = tbtn('play', TXT.cpNext);
    is.id = sid + '_nextis'; go.id = sid + '_next';
    go.setAttribute('aria-describedby', is.id);
    go.onclick = () => {
      let changed = false;
      for (const id of units.get(up)) changed = R().unlockPage(k.key, id) || changed;
      if (changed) msg(out, TXT.cpOpened(name(up)));
      planFocus = [sid + '_lock_' + up, h.id];
      render();
    };
    box.append(is, go);
  }
  // One subject of the editor (see planCards). `e` is the subject's kidSubjects entry (units listed even when inactive).
  function editPart(box, c, k, s, e, sid, h, name) {
    const sname = String(s.name || s.key), list = Array.isArray(e.units) ? e.units : [];
    const cur = e.active && list.includes(e.current) ? e.current : null, i = cur ? list.indexOf(cur) : -1;
    const prevU = i > 0 ? list[i - 1] : null, nextU = i + 1 < list.length ? list[i + 1] : null;
    const now = mk('p', 'rw-cpnow rw-spnow');
    now.id = sid + '_now';
    if (cur) {   // textContent is unitLabel: «Κεφάλαιο 2: Μίγματα»
      const p = unitPage(k, cur);
      now.append(mk('span', 'rw-spch', p && p.ch ? String(p.ch) + ': ' : ''), mk('b', '', p ? String(p.title || cur) : cur));
    } else now.textContent = TXT.spNone;
    const nav = mk('div', 'rw-spnav'), back = ibtn('back', prevU ? TXT.spBackTo(unitLabel(k, prevU), sname) : TXT.spPrev);
    const fwd = ibtn('chevron-right', nextU ? TXT.spFwdTo(unitLabel(k, nextU), sname) : TXT.spNext);
    const lab = mk('label', 'rw-field', TXT.spPick(sname)), sel = mk('select', 'rw-spsel');
    back.id = sid + '_back'; fwd.id = sid + '_fwd'; sel.id = sid + '_pick'; lab.htmlFor = sel.id;
    back.disabled = !prevU; fwd.disabled = !nextU;
    const go = (u, ids) => {
      if (window.Sync && typeof window.Sync.setSchedule === 'function') window.Sync.setSchedule(k.key, s.key, u);
      planFocus = ids;
      render();   // the kid's notebooks and units follow at once
    };
    back.onclick = () => { if (prevU) go(prevU, [back.id, fwd.id, sel.id, h.id]); };
    fwd.onclick = () => { if (nextU) go(nextU, [fwd.id, back.id, sel.id, h.id]); };
    const opt = (value, text) => { const o = mk('option', '', text); o.value = value; return o; };
    if (!cur) sel.appendChild(opt('', TXT.spPickNone));
    for (const u of list) sel.appendChild(opt(u, unitLabel(k, u)));
    sel.value = cur || '';
    sel.onchange = () => { if (sel.value && sel.value !== cur) go(sel.value, [sel.id, h.id]); };
    nav.append(back, now, fwd);
    box.appendChild(nav);
    if (cur) {
      const pages = new Map(pagesOf(k).map(({ p }) => [String(p.id), p]));
      for (const id of unitsIn(s, e).get(cur) || []) {
        const p = pages.get(id), row = p ? dateRow(k, p, c, 'rwTS_', TXT.spTest(name(id))) : null;
        if (row) box.appendChild(row);
      }
    }
    box.append(lab, sel);
    if (cur) unlockedPart(box, k, s, e, sid, h, planMsgs.get(k.key), name, false);
  }
  // The editor cards' state lines: per kid, failed (with «Δοκίμασε τώρα») while an edit waits and the last cycle failed,
  // waiting while an edit waits, saved once the kid has a schedule in the device copy and nothing waits; empty otherwise.
  function schedLines() {
    if (schedBuilt !== 'edit' || !window.Sync || !R()) return;
    const cache = R().scheduleCache(), st = window.Sync.state();
    for (const k of kidsOf()) {
      const line = planLines.get(k.key), retry = document.getElementById('rwPlan_' + k.key + '_retry');
      if (!line || !line.isConnected) continue;
      const kc = own(cache.kids, k.key) ? cache.kids[k.key] : {}, es = Object.keys(kc).map(x => kc[x]);
      const wait = es.some(x => x.pending), bad = wait && st.sync === 'failed';
      const text = bad ? TXT.spFail : wait ? TXT.spWait : es.length ? TXT.spSaved : '';
      if (line.textContent !== text || line.classList.contains('err') !== bad) lineMsg(line, text, bad);
      if (retry) retry.hidden = !bad;
    }
  }
  // A sync state change while the panel is open: the cards are rebuilt when the mode changed (sign-in, sign-out, expiry),
  // else only the state lines follow.
  function schedState() {
    const host = document.getElementById('rwParent');
    if (!pState.open || !host || host.dataset.state !== 'open') return;
    if (schedMode() !== schedBuilt) { render(); return; }
    schedLines();
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
      pKid = curKid();
      const head = mk('div', 'rw-phead'), h = mk('h3', '', TXT.pTitle), close = btn(TXT.pClose, 'rw-pclose');
      h.id = 'rwPTitle'; h.tabIndex = -1;
      close.onclick = () => { pState.open = false; planMsgs.clear(); planLines.clear(); render(); const g = host.querySelector('.rw-gate'); if (g) g.focus(); };
      head.append(h, close);
      const weeks = mk('div', 'rw-weeks'), sched = mk('section', 'rw-sched'), jarBox = mk('div', 'rw-pcard'), tBox = mk('div', 'rw-pcard'), bBox = mk('div', 'rw-pcard');
      const oBox = mk('div', 'rw-pcard');
      oBox.id = 'rwOpen';
      weeks.id = 'rwWeeks'; sched.id = 'rwSched'; bBox.id = 'rwBackup';
      const sh = mk('h4', 'rw-schedh', TXT.schedTitle);
      sh.id = 'rwSchedH';
      sched.setAttribute('aria-labelledby', sh.id);
      sched.appendChild(sh);
      // Each block is independent: one that throws must not take the others down.
      step(() => jarSettings(jarBox));
      step(() => testDates(tBox, c));
      step(() => openCard(oBox));
      step(() => backup(bBox));
      host.append(head, weeks, sched, jarBox, tBox, oBox, bBox);
    }
    // Live parts follow every render; the forms keep what the parent typed.
    step(() => weeklyNotes(document.getElementById('rwWeeks'), c));
    step(() => planCards(c));
    step(giveState);
    step(syncCard);
  }

  /* ---------- teacher view (route A): ?view=teacher keeps it on this device, ?view=family or the exit link turns it off ---------- */
  const VIEW_KEY = 'noos_view', GRADE_KEY = 'noos_view_grade';
  function viewMode() {
    let q = null;
    try { q = new URLSearchParams(location.search).get('view'); } catch (e) { /* no location */ }
    if (q === 'teacher') sSet(VIEW_KEY, 'teacher');
    else if (q === 'family') sDel(VIEW_KEY);
    return q === 'teacher' || (q !== 'family' && sGet(VIEW_KEY) === 'teacher');
  }
  const TEACH = viewMode();

  // Intro, chapter list from the catalog, grade picker; one grade's notebooks shown at a time (titles, no progress). No
  // tabs, no stars, streak, mission, album, badges, jar, parent area or sound.
  function teacherView() {
    const kids = kidsOf(), panel = panelEl('books');
    if (!panel) return;
    document.body.classList.add('hub-teach');
    document.querySelectorAll('#rwParent,.hub-tip').forEach(e => e.remove());
    selectTab('books', false);
    const top = document.getElementById('hubWho');
    if (top && !top.querySelector('.hub-title')) top.innerHTML = '<span class="hub-title">' + esc(TXT.appName) + '</span>';
    let pick = document.getElementById('rwTPick');
    if (!pick) {
      const covers = kids.flatMap(k => subsOf(k).map(s => {
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
      panel.prepend(box, pick);
    }
    for (const k of kids) {
      const host = panel.querySelector('.hub-kid[data-kid="' + k.key + '"]');
      if (host) setHTML(host, booksHTML(k, null, null));
    }
    const keys = kids.map(k => k.key);
    let cur = sGet(GRADE_KEY);
    if (keys.indexOf(cur) < 0) cur = keys[0];
    showKid(cur);
    pick.querySelectorAll('button[data-kid]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kid === cur)));
  }

  /* ---------- pure helpers of the per-subject schedule (round 2 brief, section 7), kept with their tests ---------- */
  // Pure. Done pages for review, weakest first: a null (never played) score first, then the lowest score; ties keep `ids` order.
  function reviewOrder(ids, score) {
    const s = new Map(ids.map(id => [id, score(id)]));
    const key = v => (typeof v === 'number' && Number.isFinite(v) ? v : -1);
    return ids.slice().sort((a, b) => key(s.get(a)) - key(s.get(b)));
  }
  // Pure. The blocks for one kid from a planState result and the kid's catalog page ids (in catalog order). Only ids with a
  // catalog page are shown; hidden pages are in no list; `rest` holds catalog pages missing from the plan (shown as today).
  // Not used by the hub since the per-subject layout (subjectBlocks); kept, with its tests (decision 9 of 18 Nov).
  function planBlocks(st, ids, score) {
    const P = st || {}, has = new Set(ids), S = P.states || {};
    const keep = list => (Array.isArray(list) ? list : []).filter(id => has.has(id));
    return { now: keep(P.current), review: reviewOrder(keep(P.done), score), soon: keep(P.upcoming), rest: ids.filter(id => !own(S, id)) };
  }
  // Pure. A catalog subject's units with a state in its kidSubjects entry `e`: Map unitId -> [pageId, ...], both in catalog
  // order. A page's unit is its `unit` when that is one of e.units (as planSubjects reads it), else its own id; a page
  // without a state (or already taken by an earlier subject, as `seen` records) is skipped.
  function unitsIn(s, e, seen) {
    const out = new Map(), units = e && Array.isArray(e.units) ? e.units : [], S = e && e.states ? e.states : {};
    for (const p of s && Array.isArray(s.pages) ? s.pages : []) {
      const id = String(p && p.id);
      if (!own(S, id) || (seen && seen.has(id))) continue;
      if (seen) seen.add(id);
      const u = units.includes(p.unit) ? p.unit : id;
      if (!out.has(u)) out.set(u, []);
      out.get(u).push(id);
    }
    return out;
  }
  // Pure. The per-subject blocks for one kid from a Rewards.kidSubjects result `ps`, the kid's catalog entry `k` and a page
  // score (0..1, null when never played):
  //   now:    one group per subject with a schedule, in catalog order: {key, units: [{unit, ids}], go}: the subject's current
  //           units (the class unit and any unlocked on the device), each with its pages, in catalog order; `go` is the first
  //           of those pages whose score is below 1 (unfinished), else null
  //   review: the pages of done units across subjects, weakest first (reviewOrder; ties keep catalog order)
  //   soon:   one teaser per subject with an upcoming unit: {key, unit, id}, `id` the unit's first page; hidden units: nothing
  //   rest:   the keys of the subjects without a schedule
  // The hub uses `review` for «Επανάληψη»; the notebooks and «Τετράδια» read the same states from `ps` directly.
  function subjectBlocks(ps, k, score) {
    const subs = ps && ps.subjects && typeof ps.subjects === 'object' ? ps.subjects : {};
    const out = { now: [], review: [], soon: [], rest: [] }, seen = new Set(), done = [];
    for (const s of k && Array.isArray(k.subjects) ? k.subjects : []) {
      const e = s && own(subs, s.key) ? subs[s.key] : null;
      if (!e || !e.active) { out.rest.push(s && s.key); continue; }
      const units = unitsIn(s, e, seen), state = u => e.states[units.get(u)[0]], cur = [];
      for (const [unit, ids] of units) {
        if (state(unit) === 'current') cur.push({ unit, ids });
        else if (state(unit) === 'done') done.push(...ids);
      }
      if (cur.length) {
        const go = cur.flatMap(x => x.ids).find(id => !(score(id) >= 1));
        out.now.push({ key: s.key, units: cur, go: go === undefined ? null : go });
      }
      const up = [...units.keys()].find(u => state(u) === 'upcoming');
      if (up !== undefined) out.soon.push({ key: s.key, unit: up, id: units.get(up)[0] });
    }
    out.review = reviewOrder(done, score);
    return out;
  }

  // Cloud sync on the hub: sync-config.js is requested once; with a URL and key, engine/sync.js boots (and pulls when a
  // session exists). A pull that changed stores or the schedule re-renders the hub; every other sync event refreshes the
  // family account card and the schedule cards' state (schedState: a rebuild only when signing in or out changed their mode).
  let syncAsked = false;
  function syncLoad() {
    if (syncAsked || !UI() || typeof UI().loadSync !== 'function') return;
    syncAsked = true;
    UI().loadSync(true, S => {
      S.on(ev => { if (ev && ev.type === 'pulled') render(); else { step(syncCard); step(schedState); } });
      step(syncCard);   // the panel may be open already
      step(schedState);
    });
  }

  // Without the reward layer: «Τετράδια» with titles only, as the hub showed tiles before without it.
  function plainView() {
    for (const k of kidsOf()) {
      const host = document.querySelector('#panelBooks .hub-kid[data-kid="' + k.key + '"]');
      if (host) setHTML(host, booksHTML(k, null, null));
    }
    showKid(curKid());
    selectTab('books', false);
  }

  function render() {
    step(shell);
    if (TEACH) { step(teacherView); return; }   // no jar, level, stars, streak, quest, album, badges, parent area or sound
    const rw = R();
    if (!rw) { step(plainView); return; }
    step(syncLoad);
    step(() => { if (window.Sync) window.Sync.touch(); });   // a parent's change (jar, test date, unlock, restore): push soon
    let c = null;
    step(() => { c = context(rw); });
    if (!c) return;
    const kid = curKid();
    step(() => rw.usePlan(window.PLAN, window.CATALOG));   // before the countdowns: they fall back to the plan's test date (testDateFor)
    step(() => whoView(kid));
    step(() => jarView(c));   // before the badge walls, so a helper badge shows at once
    for (const k of kidsOf()) {
      let ps = null;
      step(() => { const ks = rw.kidStore(k.key); ps = rw.kidSubjects(window.CATALOG, window.PLAN, k.key, ks && ks.unlocked); });   // `unlocked` read as is, planSubjects checks it
      if (!ps) continue;
      const score = id => pageScore(c, id);
      step(() => todayView(k, c, ps, score));
      step(() => booksView(k, c, ps));
      step(() => awardsView(k, c));
    }
    step(() => chips(c, kid));   // after the quests: a finished mission's bonus star counts at once
    step(() => showKid(kid));
    step(soundOnce);
    step(() => parentView(c));
    step(() => planHintView(c, kid));
  }

  window.Hub = { render, esc, TXT, teacher: () => TEACH, context, reviewOrder, planBlocks, pathLevel, stepSay, questModel, todayView, subjectBlocks, selectTab, albumModel, badgeModel };   // context and the block helpers: for tests
})();
