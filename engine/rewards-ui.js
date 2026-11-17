/* Page-side reward effects: toasts, confetti, a flying star, optional sound, the daily quest strip, the test countdown,
   the class plan banner and the character drawings (art).
   Loads after engine.js and rewards.js. Every storage access goes through window.Rewards; strings from storage go in
   with textContent only. Exposes window.RewardsUI. */
(function () {
  'use strict';

  const TXT = {
    sticker: 'Νέο αυτοκόλλητο για το άλμπουμ! 🎉',
    badge: 'Νέο παράσημο: ',
    questDone: 'Ολοκλήρωσες την αποστολή της ημέρας! +1 ⭐',
    questTitle: '🎯 Αποστολή της ημέρας',
    questHit: (n, label) => 'Κάνε ' + n + ' σωστές: ' + label,
    questList: label => 'Ανέβασε την πρόοδο: ' + label,
    questCards: (n, label) => 'Μάθε ' + n + ' νέες κάρτες: ' + label,
    questElsewhere: n => 'και ' + n + ' σε άλλο κεφάλαιο',
    testIn: n => 'Διαγώνισμα σε ' + n + ' μέρες',
    testToday: 'Διαγώνισμα σήμερα!',
    testTomorrow: 'Διαγώνισμα αύριο!',
    bossNudge: 'Δοκίμασε το 👹 Τελικό τέρας',
    sound: 'Ήχος',
    bossRule: (n, pass) => n + ' ερωτήσεις. Με ' + pass + ' σωστές το νικάς!',
    bossGo: 'Στη μάχη! ⚔️',
    bossAgain: 'Νέα μάχη 🔁',
    bossBest: (best, total) => 'Καλύτερο σκορ: ' + best + ' / ' + total,
    bossBeaten: '🏆 Το έχεις νικήσει!',
    bossQ: (i, n) => 'Ερώτηση ' + i + ' / ' + n,
    bossScore: s => 'Σκορ: ' + s,
    bossHp: 'Ζωή τέρατος',
    bossRight: 'Σωστά! ',
    bossWrong: 'Όχι ακριβώς. ',
    bossTfIs: truth => 'Η πρόταση είναι ' + (truth ? 'Σωστή' : 'Λάθος') + '. ',
    bossTrue: '✔ Σωστό',
    bossFalse: '✘ Λάθος',
    bossNext: 'Επόμενη ▶',
    bossEnd: 'Αποτέλεσμα',
    bossWon: 'Νίκη! 🏆',
    bossLost: 'Σχεδόν!',
    bossEmpty: 'Δεν υπάρχουν ακόμα ερωτήσεις για το τέρας.',
    bossRetry: 'Ξανά μόνο τα λάθη',
    bossPractice: '🎯 Εξάσκηση στα λάθη',
    bossPracticeNote: 'Δεν μετράει στη μάχη.',
    bossPracticeLeft: (s, n) => 'Σωστά τώρα: ' + s + ' από ' + n + '. Δες ξανά όσα έμειναν.',
    bossPracticeAll: 'Τα διόρθωσες όλα! Τώρα σε αληθινή μάχη.',
    bossHeartsRule: h => 'Έχεις ' + h + (h === 1 ? ' καρδιά' : ' καρδιές') + '. Κάθε λάθος κοστίζει μία.',
    bossHearts: (n, of) => 'Καρδιές: ' + n + ' από ' + of,
    bossHeartLost: n => 'Μια καρδιά λιγότερη. ' + (n === 1 ? 'Έμεινε 1.' : 'Έμειναν ' + n + '.'),
    bossNoHearts: 'Τελείωσαν οι καρδιές σου!',
    bossLocked: n =>'Το τέρας ξεκλειδώνει όταν παίξεις ακόμα ' + (n === 1 ? '1 δραστηριότητα' : n + ' δραστηριότητες') + '.',
    next: label => '▶ Συνέχισε: ' + label,
    planNotStarted: 'Αυτό το κεφάλαιο δεν έχει ξεκινήσει ακόμα στην τάξη.',
  };

  const TOAST_MS = 2500, CONFETTI_MS = 1200, STAR_MS = 800;
  const R = () => window.Rewards || null;
  const E = () => window.Engine || null;
  // PG_ID and PG_ROWS are page-level const globals (not window properties) on hand-written pages, so read them bare.
  /* global PG_ID, PG_ROWS, shuffle */
  const pageId = () => (typeof PG_ID === 'string' ? PG_ID : null);
  const pageRows = () => (typeof PG_ROWS !== 'undefined' && Array.isArray(PG_ROWS) ? PG_ROWS : []);
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const today = () => R().dayKey(new Date());
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------- pointer tracking: where the answer was tapped, and the first gesture for sound ---------- */
  let lastPt = null, actx = null, soundWanted = false, inited = false;
  function onGesture(e) {
    if (e.clientX !== undefined) lastPt = { x: e.clientX, y: e.clientY, t: Date.now() };
    if (soundWanted && (!actx || actx.state === 'suspended')) audio();
  }
  // a touch only counts as a gesture from pointerup on, so both ends of the tap are watched
  document.addEventListener('pointerdown', onGesture, true);
  document.addEventListener('pointerup', onGesture, true);
  document.addEventListener('keydown', onGesture, true);

  /* ---------- sound: Web Audio tones, off by default, AudioContext made on a user gesture ---------- */
  // Creates the context only inside a user gesture (the first tap after the toggle is on); outside one it returns the
  // existing context or null, so a celebration with no gesture (a hub render) stays silent instead of making a muted context.
  function audio() {
    const act = navigator.userActivation;
    if (!actx && act && !act.isActive) return null;
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { actx = new AC(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') { try { actx.resume(); } catch (e) { /* stays silent */ } }
    return actx;
  }
  const TONES = { star: [880, 1320], badge: [523, 659, 784, 1047], win: [523, 659, 784, 1047, 1319] };
  function sound(kind) {
    const rw = R();
    if (!rw || !TONES[kind]) return;
    let on = false;
    try { on = rw.family().sound === true; } catch (e) { on = false; }
    soundWanted = on;
    if (!on) return;
    const ctx = audio();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02, step = kind === 'star' ? 0.09 : 0.11;
    TONES[kind].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + i * step;
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + step + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + step + 0.15);
    });
  }

  function soundToggle(host) {
    const rw = R();
    if (!rw || !host) return null;
    const b = el('button', 'rw-snd');
    b.type = 'button';
    b.setAttribute('aria-label', TXT.sound);   // fixed name; the state is in aria-pressed
    b.title = TXT.sound;
    const paint = on => {
      b.textContent = on ? '🔈' : '🔇';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    let fam = null;
    try { fam = rw.family(); } catch (e) { fam = null; }
    soundWanted = !!(fam && fam.sound === true);
    paint(soundWanted);
    b.onclick = () => {
      let f;
      try { f = rw.family(); } catch (err) { return; }
      f.sound = f.sound !== true;
      rw.saveFamily(f);
      soundWanted = f.sound;
      paint(f.sound);
      if (f.sound) sound('star');   // the toggle tap is the gesture that creates the AudioContext
    };
    host.appendChild(b);
    return b;
  }

  /* ---------- toasts: one live region, shown one at a time ---------- */
  const queue = [];
  let showing = false;
  function region() {
    let r = document.getElementById('rwToasts');
    if (!r && document.body) {
      r = el('div');
      r.id = 'rwToasts';
      r.setAttribute('role', 'status');
      r.setAttribute('aria-live', 'polite');
      document.body.appendChild(r);
    }
    return r;
  }
  function toast(text, emo) {
    queue.push({ text: String(text), emo: emo ? String(emo) : '' });
    if (!showing) next();
  }
  function next() {
    const r = region(), item = queue.shift();
    if (!r || !item) { showing = false; return; }
    showing = true;
    const t = el('div', 'rw-toast' + (reduced() ? ' glow' : ''));
    if (item.emo) t.appendChild(el('span', 'rw-toast-emo', item.emo));
    t.appendChild(el('span', 'rw-toast-txt', item.text));
    let gone = false;
    const done = () => { if (gone) return; gone = true; clearTimeout(timer); t.remove(); next(); };
    const timer = setTimeout(done, TOAST_MS);
    t.onclick = done;
    r.appendChild(t);
  }

  /* ---------- confetti: one canvas at a time, about 1.2 s, removed after; none under reduced motion ---------- */
  let conf = null;
  const COLORS = ['#e0782f', '#2f7de1', '#1f9d61', '#7b4fd6', '#e0b02f', '#d4443b'];
  function confetti() {
    if (reduced() || !document.body) return false;
    const W = innerWidth, H = innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    const parts = Array.from({ length: 110 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
      vx: (Math.random() - 0.5) * 9, vy: -4 - Math.random() * 8,
      s: 5 + Math.random() * 6, a: Math.random() * 6.3, va: (Math.random() - 0.5) * 0.4,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    if (conf) { conf.parts.push(...parts); conf.end = performance.now() + CONFETTI_MS; return true; }
    const cv = el('canvas', 'rw-confetti');
    cv.setAttribute('aria-hidden', 'true');
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    if (!g) return false;
    g.scale(dpr, dpr);
    document.body.appendChild(cv);
    conf = { cv, parts, end: performance.now() + CONFETTI_MS };
    const frame = now => {
      if (!conf) return;
      if (now >= conf.end) { conf.cv.remove(); conf = null; return; }
      g.clearRect(0, 0, W, H);
      const fade = Math.min(1, (conf.end - now) / 300);
      for (const p of conf.parts) {
        p.vy += 0.28; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        g.save(); g.globalAlpha = fade; g.translate(p.x, p.y); g.rotate(p.a);
        g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return true;
  }

  /* ---------- a star flies from the answer to the 📊 button; static highlight under reduced motion ---------- */
  function flyStar() {
    const btn = document.getElementById('pgBtn');
    if (!btn || !btn.getClientRects().length) return;
    const light = cls => { btn.classList.remove(cls); void btn.offsetWidth; btn.classList.add(cls); setTimeout(() => btn.classList.remove(cls), 1500); };
    if (reduced() || typeof btn.animate !== 'function') { light('rw-lit'); return; }
    const to = btn.getBoundingClientRect();
    let from = lastPt && Date.now() - lastPt.t < 3000 ? lastPt : null;
    if (!from) {
      const a = document.activeElement;
      if (a && a !== document.body && a.getBoundingClientRect) { const r = a.getBoundingClientRect(); from = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
      else from = { x: innerWidth / 2, y: innerHeight / 2 };
    }
    const s = el('span', 'rw-fly', '⭐');
    s.setAttribute('aria-hidden', 'true');
    document.body.appendChild(s);
    const x1 = to.left + to.width / 2, y1 = to.top + to.height / 2;
    const anim = s.animate([
      { transform: 'translate(' + from.x + 'px,' + from.y + 'px) translate(-50%,-50%) scale(1.4)', opacity: 1 },
      { transform: 'translate(' + x1 + 'px,' + y1 + 'px) translate(-50%,-50%) scale(.7)', opacity: 0.6 },
    ], { duration: STAR_MS, easing: 'cubic-bezier(.45,0,.55,1)' });
    anim.onfinish = () => { s.remove(); light('rw-bump'); };
    anim.oncancel = () => s.remove();
  }

  /* ---------- class plan (plan.js, timed release): loaded once at runtime, from the page's own folder ---------- */
  // Chapter pages have no plan.js tag; the hub has one, so window.PLAN (or a failed tag) is already settled there.
  // A script element is added once and Rewards is told the plan is pending (Rewards.PLAN_PENDING): until it settles no
  // code path (the strip, an answer) builds the day's quest. Its load or error settles it and hands window.PLAN (undefined
  // after a 404 or a broken file: no plan) to Rewards.usePlan. PLAN_WAIT_MS is only a safety net for a request that
  // neither loads nor fails: the quest is then built without the plan, and kept for the day.
  const PLAN_WAIT_MS = 3000;
  let planSettled = false, planAsked = false, planUsed = null;   // planUsed: the plan handed to Rewards.usePlan on settling
  const planWaiters = [];
  function loadPlan(then) {
    if (!planSettled && typeof window.PLAN !== 'undefined') { planSettled = true; planUsed = window.PLAN; R().usePlan(planUsed); }
    if (planSettled) { then(); return; }
    planWaiters.push(then);
    if (planAsked) return;
    planAsked = true;
    R().usePlan(R().PLAN_PENDING);
    const s = document.createElement('script');
    let timer = null;
    const settle = () => {
      if (planSettled) return;
      planSettled = true;
      clearTimeout(timer);
      s.onload = s.onerror = null;
      planUsed = window.PLAN;
      try { R().usePlan(planUsed); } catch (e) { console.error(e); }
      for (const f of planWaiters.splice(0)) { try { f(); } catch (e) { console.error(e); } }
    };
    s.onload = s.onerror = settle;
    s.src = 'plan.js';
    timer = setTimeout(settle, PLAN_WAIT_MS);
    (document.head || document.documentElement).appendChild(s);
  }
  // `openProg` is this page's progress as init found it (the state the quest was built from before plan.js existed), passed
  // to the first build after the plan settles only: the page's games may store records (an empty list, for instance) first.
  let openProg = null;
  function buildOpts() {
    if (!planSettled || !openProg) return undefined;
    const o = { progress: openProg };
    openProg = null;
    return o;
  }

  /* ---------- daily quest strip, under the header on kid pages ---------- */
  // While the plan is pending, ensureQuest builds nothing: only a quest already stored for today is shown.
  function questStrip() {
    const rw = R(), eng = E(), pid = pageId();
    const old = document.getElementById('rwQuest');
    if (!rw || !eng || !eng.kid || !pid) { if (old) old.remove(); return null; }
    const day = today();
    const q = rw.ensureQuest(eng.kid, day, buildOpts());
    if (!q || !Array.isArray(q.tasks) || !q.tasks.length) { if (old) old.remove(); return null; }
    const live = window.PG && typeof PG.store === 'function' ? PG.store() : {};
    const lens = {};
    for (const t of q.tasks) {
      if (!t || t.type === 'hit') continue;
      const p = t.pageId === pid ? live : rw.load('progress_' + t.pageId) || {};
      const rec = own(p, t.key) ? p[t.key] : null;
      lens[t.pageId + ':' + t.key] = rec && Array.isArray(rec.list) ? rec.list.length : 0;
    }
    const st = rw.questStatus(rw.kidStore(eng.kid), day, lens);
    if (!st.tasks.length) { if (old) old.remove(); return null; }
    const box = el('div', 'rw-quest' + (st.allDone ? ' all' : ''));
    box.id = 'rwQuest';
    box.appendChild(el('span', 'rw-quest-h', TXT.questTitle + (st.allDone ? ' ✓' : '')));
    const list = el('div', 'rw-quest-list');
    // only this page's tasks get a chip; the tasks of other pages collapse into one summary chip at the end
    const rest = st.tasks.filter(t => t.pageId !== pid);
    for (const t of st.tasks) {
      if (t.pageId !== pid) continue;
      const label = typeof t.label === 'string' ? t.label : String(t.key);
      const target = Number(t.target) || 0, count = Math.min(Number(t.count) || 0, target);
      const chip = el('span', 'rw-task' + (t.done ? ' done' : ''));
      const tip = t.type === 'hit' ? TXT.questHit(target, label)
        : t.key === 'cards' && target > 1 ? TXT.questCards(target, label) : TXT.questList(label);
      chip.title = tip;
      chip.setAttribute('aria-label', tip + (t.done ? ' ✓' : ' (' + count + '/' + target + ')'));
      chip.appendChild(el('span', 'rw-task-l', label));
      chip.appendChild(el('b', 'rw-task-c', t.done ? '✓' : count + '/' + target));
      list.appendChild(chip);
    }
    if (rest.length) {
      const left = rest.filter(t => !t.done).length, allOk = left === 0, text = TXT.questElsewhere(allOk ? rest.length : left);
      let hub = false;   // the hub sets hub_seen; same signal as the engine's home link
      try { hub = !!localStorage.getItem('hub_seen'); } catch (e) { hub = false; }
      const chip = el(hub ? 'a' : 'span', 'rw-task rw-more' + (allOk ? ' done' : ''));
      if (hub) chip.href = 'index.html';
      chip.setAttribute('aria-label', text + (allOk ? ' ✓' : ''));
      chip.appendChild(el('span', 'rw-task-l', text));
      if (allOk) chip.appendChild(el('b', 'rw-task-c', '✓'));
      else if (hub) chip.appendChild(el('span', 'rw-task-go', '➜'));
      list.appendChild(chip);
    }
    box.appendChild(list);
    if (old) old.replaceWith(box);
    else {
      const h = document.querySelector('header');
      if (h) h.insertAdjacentElement('afterend', box); else document.body.insertBefore(box, document.body.firstChild);
    }
    return box;
  }

  /* ---------- test countdown in the header ---------- */
  // The date is Rewards.testDateFor: the parent's date on this device, else the plan's `test` (device only while plan.js loads).
  function countdown() {
    const rw = R(), eng = E(), pid = pageId();
    const old = document.getElementById('rwCount');
    const drop = () => { if (old) old.remove(); return null; };
    if (!rw || !eng || !eng.kid || !pid) return drop();
    const d = rw.testDateFor(eng.kid, pid);
    const n = d ? rw.daysUntil(today(), d) : null;
    if (n === null) return drop();
    const box = el('div', 'rw-count' + (n <= 1 ? ' soon' : ''));
    box.id = 'rwCount';
    box.appendChild(el('span', 'rw-count-t', '📅 ' + (n === 0 ? TXT.testToday : n === 1 ? TXT.testTomorrow : TXT.testIn(n))));
    const rows = pageRows();
    const bossTab = document.querySelector('#tabs button[data-t="fboss"]');
    const max = rw.countedRows(rows).length * 3 + (bossTab ? 3 : 0);
    const live = window.PG && typeof PG.store === 'function' ? PG.store() : {};
    if (bossTab && rw.pageStars(live, rows) < max) {
      const b = el('button', 'rw-nudge', TXT.bossNudge);
      b.type = 'button';
      b.onclick = () => bossTab.click();
      box.appendChild(b);
    }
    if (old) old.replaceWith(box);
    else { const h = document.querySelector('header'); if (!h) return null; h.appendChild(box); }
    return box;
  }

  /* ---------- page guide: the «Συνέχισε» button and the final boss lock ---------- */
  const livePg = () => (window.PG && typeof PG.store === 'function' ? PG.store() : {});
  const tabBtns = () => [...document.querySelectorAll('#tabs button[data-t]')];
  // {unlocked, left} of this page's final boss; the test date (Rewards.testDateFor, as in countdown) counts only on a kid page
  function lockState() {
    const rw = R(), eng = E(), pid = pageId();
    const testDate = eng && eng.kid && pid ? rw.testDateFor(eng.kid, pid) : null;
    return rw.bossUnlock({ rows: pageRows(), progress: livePg(), today: today(), testDate });
  }
  // the tab button «Συνέχισε» opens now, or null
  function nextBtn(st) {
    const tabs = tabBtns();
    const id = R().nextTab({ rows: pageRows(), progress: livePg(), tabs: tabs.map(b => b.dataset.t), bossUnlocked: st.unlocked });
    return tabs.find(b => b.dataset.t === id) || null;
  }
  // a «Συνέχισε» button that taps the tab itself, so the tab's own handler and hooks run
  function nextButton(tab) {
    const b = el('button', 'rw-next-btn', TXT.next(tab.textContent.trim()));
    b.type = 'button';
    b.onclick = () => tab.click();
    return b;
  }
  // Soft banner on a kid's chapter page the class has not started yet (timed release): Rewards.planBanner on the settled plan,
  // today and the kid store's `unlocked`; nothing while the plan is pending. It sits above the «Συνέχισε» button and the tab
  // row, never takes focus, and is a polite live region whose text is set just after it is inserted, so it is announced.
  // Re-evaluated with guide(), so it comes and goes without a reload (an unlock in the hub shows when this tab comes back).
  function planNote(row) {
    const rw = R(), eng = E(), pid = pageId(), old = document.getElementById('rwPlanNote');
    let show = false;
    if (eng && eng.kid && pid && planSettled) {
      let unlocked;
      try { unlocked = rw.kidStore(eng.kid).unlocked; } catch (e) { unlocked = undefined; }
      show = rw.planBanner(planUsed, eng.kid, pid, today(), unlocked);
    }
    if (!show) { if (old) old.remove(); return null; }
    if (old) return old;
    const box = el('div', 'rw-plannote');
    box.id = 'rwPlanNote';
    box.setAttribute('role', 'status');
    const at = document.getElementById('rwNext') || row.closest('nav') || row;
    at.parentNode.insertBefore(box, at);
    setTimeout(() => { box.textContent = TXT.planNotStarted; }, 0);
    return box;
  }

  let bossView = null, lockedNow = null;
  // Refreshes the plan banner (planNote), the boss lock (tab, phone sheet tile, an idle boss screen) and the «Συνέχισε» button above the tab row.
  // Runs at init, after every answer (celebrate), on every tab change and when the browser tab comes back.
  function guide() {
    const rw = R(), row = document.getElementById('tabs');
    if (!rw || !row) return null;
    planNote(row);
    const st = lockState(), was = lockedNow;
    lockedNow = !st.unlocked;
    document.querySelectorAll('#tabs button[data-t="fboss"], #msheet button[data-t="fboss"]').forEach(b => b.classList.toggle('rw-locked', lockedNow));
    if (bossView && !bossView.busy() && (lockedNow || was !== lockedNow)) bossView.intro();
    const tab = nextBtn(st);
    const old = document.getElementById('rwNext');
    if (!tab) { if (old) old.remove(); return null; }
    const box = el('div', 'rw-next');
    box.id = 'rwNext';
    box.appendChild(nextButton(tab));
    if (old) old.replaceWith(box);
    else { const at = row.closest('nav') || row; at.parentNode.insertBefore(box, at); }
    return box;
  }

  /* ---------- celebrate one answer's result ---------- */
  function celebrate(res) {
    if (!res || typeof res !== 'object') return;
    const rw = R();
    const badges = Array.isArray(res.badges) ? res.badges : [];
    let party = false, kind = null;
    if (res.starsUp) { flyStar(); kind = 'star'; }
    if (res.sticker) { toast(TXT.sticker); party = true; kind = 'badge'; }
    for (const id of badges) {
      const b = rw && rw.BADGES.find(x => x.id === id);
      if (!b) continue;
      toast(TXT.badge + b.name, b.emo);
      party = true; kind = 'badge';
    }
    if (res.questDone) { toast(TXT.questDone); party = true; kind = 'win'; }
    if (party) confetti();
    if (kind) sound(kind);
    if (inited) { questStrip(); countdown(); guide(); }
  }

  /* ---------- character art (audit U2 pilot): original SVG drawings in place of emoji ---------- */
  // Every drawing is a static table of shapes below, built with DOM calls; no page, user or stored data reaches it.
  // art(name, state, opts) returns an <svg> (viewBox 0 0 100 100, sized by CSS) or null for an unknown name or state, or
  // when SVG cannot be built: the caller then keeps the emoji. opts.hidden marks it aria-hidden (the name is in nearby
  // text); otherwise it is role="img" with the character's name.
  const SVGNS = 'http://www.w3.org/2000/svg', INK = '#1d2433', WHITE = '#fff';
  const PH = { o: '#e0782f', d: '#a95419', s: '#fdeee2', a: '#f4978e' };   // physics orange, dark, soft; accent: pink
  const MA = { i: '#4f46e5', s: '#eceafd', a: '#ffb703' };                 // maths indigo, soft; accent: sun yellow
  const ATTR = { sw: 'stroke-width', tf: 'transform' };
  // shape helpers: each returns [tag, attributes, children]
  const g = (a, kids) => ['g', a, kids];
  const c = (cx, cy, r, a) => ['circle', Object.assign({ cx, cy, r }, a)];
  const e = (cx, cy, rx, ry, a) => ['ellipse', Object.assign({ cx, cy, rx, ry }, a)];
  const p = (d, a) => ['path', Object.assign({ d }, a)];
  const rc = (x, y, width, height, rx, a) => ['rect', Object.assign({ x, y, width, height, rx }, a)];
  const line = (d, color, sw) => p(d, { fill: 'none', stroke: color, sw });
  // One outlined blob from overlapping shapes: a wide stroke layer under a fill layer, so only the outer edge shows.
  const blob = (shapes, fill, stroke, sw) => g({}, [g({ fill: stroke, stroke, sw: sw * 2 }, shapes), g({ fill }, shapes)]);
  // eye: white ball, pupil looking (dx, dy), a glint
  const eye = (x, y, r, dx, dy) => g({}, [c(x, y, r, { fill: WHITE, stroke: INK, sw: 3 }),
    c(x + dx, y + dy, r * 0.5, { fill: INK }), c(x + dx + r * 0.22, y + dy - r * 0.22, r * 0.16, { fill: WHITE })]);
  const squint = (x, y, dir) => line('M' + (x - 4 * dir) + ' ' + (y - 5) + 'l' + 8 * dir + ' 5l' + -8 * dir + ' 5', INK, 3.5);
  const bubble = (x, y, r) => c(x, y, r, { fill: PH.s, stroke: PH.d, sw: 2.5 });
  const spark = (x, y, k) => p('M' + x + ' ' + (y - 6 * k) + 'l' + 1.6 * k + ' ' + 4.4 * k + 'l' + 4.4 * k + ' ' + 1.6 * k
    + 'l' + -4.4 * k + ' ' + 1.6 * k + 'l' + -1.6 * k + ' ' + 4.4 * k + 'l' + -1.6 * k + ' ' + -4.4 * k
    + 'l' + -4.4 * k + ' ' + -1.6 * k + 'l' + 4.4 * k + ' ' + -1.6 * k + 'z', { fill: MA.a, stroke: INK, sw: 1.5 });

  // Μπουρμπουλήθρας: a big soap bubble with little bubbles for hands; a hit squashes him, a win lets the air out.
  const physBody = [c(50, 55, 32), c(17, 68, 9), c(84, 64, 8)];
  const physSquash = [e(50, 64, 35, 24), c(13, 74, 8), c(88, 72, 7)];
  const physFeet = g({ fill: PH.d }, [e(37, 90, 9, 5), e(63, 90, 9, 5)]);
  const gloss = d => line(d, WHITE, 4);
  const cheeks = y => g({ fill: PH.a }, [e(28, y, 5, 3), e(72, y, 5, 3)]);
  const PHYS = {
    idle: [bubble(14, 22, 5), bubble(24, 9, 3), bubble(87, 18, 4.5), physFeet, blob(physBody, PH.o, PH.d, 4),
      gloss('M28 48A24 24 0 0 1 42 32M13 64a4 4 0 0 1 3-3'), eye(39, 52, 8, 1, 1), eye(61, 52, 8, -1, 1),
      cheeks(64), p('M37 65Q50 81 63 65Z', { fill: INK, stroke: INK, sw: 2 }), e(50, 72, 6, 3, { fill: PH.a })],
    hit: [bubble(88, 22, 6), bubble(95, 9, 3), line('M3 50h8M4 60h8M89 50h8M88 60h8', PH.d, 3), physFeet,
      blob(physSquash, PH.o, PH.d, 4), gloss('M24 58A28 22 0 0 1 39 46'), squint(39, 60, 1), squint(61, 60, -1), cheeks(70),
      e(50, 75, 5, 6, { fill: INK })],
    // half deflated: sagging, wrinkled, bubble hands flat on the floor, dizzy eyes, the air puffing out
    beaten: [line('M74 30q6-6 12-2M78 40q7-4 14 0M70 22q3-7 10-8', PH.d, 3), bubble(92, 20, 3),
      g({ fill: PH.o, stroke: PH.d, sw: 4 }, [e(14, 88, 9, 4), e(86, 88, 9, 4)]),
      p('M12 90C10 72 22 64 26 52C30 40 40 34 50 36C60 34 70 40 74 52C78 64 90 72 88 90Z', { fill: PH.o, stroke: PH.d, sw: 4 }),
      line('M22 74q4 3 8 0M70 74q4 3 8 0M44 41q6 3 12 0', PH.d, 2.5), gloss('M29 62a22 22 0 0 1 6-14'),
      g({ fill: WHITE, stroke: INK, sw: 3 }, [c(38, 57, 10), c(62, 57, 10)]),
      line('M38 57m-1.5 0a1.5 1.5 0 1 1 3 0a4 4 0 1 1-8 0a6.5 6.5 0 1 1 13 0M62 57m-1.5 0a1.5 1.5 0 1 1 3 0a4 4 0 1 1-8 0a6.5 6.5 0 1 1 13 0', INK, 2.6),
      line('M38 78q6-4 12 0t12 0', INK, 3.5), p('M50 79a5 5 0 0 0 10 0z', { fill: PH.a, stroke: INK, sw: 2 })],
  };

  // Αριθμοφάγος: a round-cornered muncher with a huge mouth and bobble antennae, snacking on yellow number blocks.
  const numBlock = (x, y, s, rot) => g({ tf: 'rotate(' + rot + ' ' + (x + s / 2) + ' ' + (y + s / 2) + ')' }, [
    rc(x, y, s, s, 2, { fill: MA.a, stroke: INK, sw: 2.5 }), line('M' + (x + s / 2) + ' ' + y + 'v' + s + 'M' + x + ' ' + (y + s / 2) + 'h' + s, INK, 1.5)]);
  const antennae = d => g({}, [line(d, INK, 4)]);
  const bobbles = pts => g({ fill: MA.a, stroke: INK, sw: 3 }, pts.map(([x, y]) => c(x, y, 5)));
  const mathFeet = g({ fill: MA.i, stroke: INK, sw: 3.5 }, [e(35, 89, 10, 5), e(65, 89, 10, 5)]);
  const mathBody = (y, h) => rc(15, y, 70, h, 28, { fill: MA.i, stroke: INK, sw: 4 });
  const MATH = {
    idle: [antennae('M38 26L30 10M62 26L70 10'), bobbles([[30, 9], [70, 9]]), mathFeet, mathBody(22, 66),
      eye(37, 40, 8, 1, 2), eye(63, 40, 8, -1, 2),
      p('M25 54Q50 49 75 54Q73 82 50 82Q27 82 25 54Z', { fill: INK, stroke: INK, sw: 2 }),
      e(50, 75, 13, 5, { fill: MA.s }), g({ fill: WHITE, stroke: INK, sw: 1.5 }, [rc(37, 52, 9, 9, 2), rc(54, 52, 9, 9, 2)]),
      numBlock(78, 58, 14, 12), c(80, 74, 5.5, { fill: MA.i, stroke: INK, sw: 3 }), g({ fill: MA.a }, [rc(12, 76, 4, 4, 1), rc(86, 80, 3, 3, 1)])],
    hit: [antennae('M38 26L24 14M62 26L76 14'), bobbles([[22, 13], [78, 13]]), mathFeet, mathBody(24, 64),
      squint(37, 44, 1), squint(63, 44, -1), e(50, 66, 8, 9, { fill: INK }),
      line('M62 62l13-5M62 70l14 0', MA.s, 3), numBlock(84, 46, 13, 25)],
    // lost his appetite: limp antennae, heavy eyes looking away, a queasy mouth with the tongue out, the plate pushed away
    beaten: [antennae('M38 26Q34 8 22 14M62 26Q66 8 78 14'), bobbles([[20, 19], [80, 19]]), mathFeet, mathBody(24, 64),
      eye(36, 43, 7, -2, 3), eye(60, 43, 7, -2, 3),
      p('M28 42a8 8 0 0 1 16 0zM52 42a8 8 0 0 1 16 0z', { fill: MA.i, stroke: INK, sw: 2.5 }),
      line('M34 66q6-4 12 0t12 0', INK, 3.5), p('M46 67a6 6 0 0 0 12 0z', { fill: MA.s, stroke: INK, sw: 2 }),
      e(86, 90, 13, 4, { fill: WHITE, stroke: INK, sw: 2.5 }), numBlock(80, 75, 12, 0)],
  };

  // Αριθμούλα: an indigo owl with a soft face mask, sun-yellow beak and feet; she raises her wings to cheer.
  const owlBack = [p('M25 32L21 11L40 22Z'), p('M75 32L79 11L60 22Z')];
  const owlBody = p('M50 15C74 15 84 36 84 58C84 80 70 92 50 92C30 92 16 80 16 58C16 36 26 15 50 15Z');
  const owlMask = g({ fill: MA.s }, [c(37, 44, 14), c(63, 44, 14)]);
  const owlBelly = g({}, [e(50, 76, 17, 12, { fill: MA.s }), line('M41 73q3 3 6 0M53 73q3 3 6 0M47 80q3 3 6 0', MA.i, 2)]);
  const owlFeet = g({ fill: MA.a, stroke: INK, sw: 2 }, [e(40, 93, 6, 3), e(60, 93, 6, 3)]);
  const owlBase = [g({ fill: MA.i, stroke: INK, sw: 4 }, owlBack.concat([owlBody])), owlMask, owlBelly];
  const OWL = {
    idle: owlBase.concat([eye(37, 44, 9, 1, 1), eye(63, 44, 9, -1, 1),
      p('M44 55L56 55L50 64Z', { fill: MA.a, stroke: INK, sw: 2.5 }),
      g({ fill: MA.i, stroke: INK, sw: 3.5 }, [p('M19 52Q9 70 22 85Q28 70 25 54Z'), p('M81 52Q91 70 78 85Q72 70 75 54Z')]), owlFeet]),
    cheer: [spark(8, 12, 1), spark(92, 10, 0.8)].concat(owlBase, [line('M29 46Q37 36 45 46M55 46Q63 36 71 46', INK, 3.5),
      p('M44 54L56 54L50 60Z', { fill: MA.a, stroke: INK, sw: 2.5 }), p('M46 62L54 62L50 67Z', { fill: MA.a, stroke: INK, sw: 2 }),
      g({ fill: MA.i, stroke: INK, sw: 3.5 }, [p('M25 64Q5 60 4 30Q20 40 27 54Z'), p('M75 64Q95 60 96 30Q80 40 73 54Z')]), owlFeet]),
  };

  // Ξεχασιάρης (the default boss, for subjects without their own): a green rubber eraser in a paper sleeve who rubs out
  // what you learned; a hit squeezes crumbs out of him, a win wears him down to a stub. Colours: --ok and --ok-soft.
  const EG = { g: '#1f9d61', s: '#e0f5ea' };
  const crumbs = pts => g({ fill: EG.s, stroke: EG.g, sw: 2 }, pts.map(([x, y, r]) => e(x, y, r, r * 0.6)));
  const sleeve = (y, h) => rc(14, y, 72, h, 8, { fill: WHITE, stroke: INK, sw: 4 });
  const rubber = (top, bot) => p('M20 ' + (top + 20) + 'L34 ' + top + 'H68Q80 ' + top + ' 80 ' + (top + 12) + 'V' + bot + 'H20Z',
    { fill: EG.g, stroke: INK, sw: 4 });
  const ERASER = {
    idle: [line('M2 30q9-6 18 0M4 42q7-4 14 0', EG.g, 3), g({ fill: EG.g, stroke: INK, sw: 3.5 }, [e(36, 92, 9, 4), e(64, 92, 9, 4)]),
      rubber(12, 70), sleeve(60, 28), line('M14 70h72', EG.s, 3),
      line('M30 26l10 4M72 24l-10 5', INK, 3.5), eye(38, 37, 7, 3, 1), eye(64, 37, 7, 3, 1), line('M40 50q12 6 22-4', INK, 3.5),
      line('M14 76q-8 0-10-10M86 76q8 0 10-10', INK, 3.5), g({ fill: EG.g, stroke: INK, sw: 2.5 }, [c(4, 64, 4.5), c(96, 64, 4.5)]),
      crumbs([[88, 93, 4], [97, 87, 3]])],
    hit: [g({ fill: EG.g, stroke: INK, sw: 3.5 }, [e(36, 92, 9, 4), e(64, 92, 9, 4)]),
      rubber(24, 72), sleeve(62, 26), line('M14 72h72', EG.s, 3),
      squint(38, 42, 1), squint(64, 42, -1), e(51, 54, 5, 4, { fill: INK }),
      line('M6 40l8 4M4 52h9M94 40l-8 4M96 52h-9', INK, 2.5), crumbs([[12, 18, 4], [26, 8, 3], [80, 8, 3.5], [92, 20, 4]])],
    // beaten: he has rubbed himself out; the top of him is only a dashed outline, the rest a short stub in the sleeve
    beaten: [p('M20 30L34 10H68Q80 10 80 22V30', { fill: 'none', stroke: EG.g, sw: 3, 'stroke-dasharray': '5 6' }), crumbs([[8, 90, 4], [18, 95, 3], [84, 95, 3], [93, 89, 4], [10, 78, 3], [90, 76, 3], [6, 62, 2.5], [94, 58, 2.5]]),
      g({ fill: EG.g, stroke: INK, sw: 3.5 }, [e(36, 92, 9, 4), e(64, 92, 9, 4)]),
      rc(20, 30, 60, 40, 6, { fill: EG.g, stroke: INK, sw: 4 }), sleeve(62, 26), line('M14 72h72', EG.s, 3),
      g({ fill: WHITE, stroke: INK, sw: 3 }, [c(38, 42, 7), c(62, 42, 7)]),
      line('M38 42m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-6 0a5 5 0 1 1 10 0M62 42m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-6 0a5 5 0 1 1 10 0', INK, 2),
      line('M42 56q4-3 8 0t8 0', INK, 3), line('M14 76q-8 4-10 12M86 76q8 4 10 12', INK, 3.5), g({ fill: EG.g, stroke: INK, sw: 2.5 }, [c(4, 90, 4.5), c(96, 90, 4.5)])],
  };

  // Κοάξ and Μπουμπού, the frogs of the «Βατραχάκια» game: one shape, two colours (the page's green and orange dots);
  // Μπουμπού also wears a red bow. Sitting, feet at y=92.
  const frog = (col, soft, extra) => [g({ fill: col, stroke: INK, sw: 3.5 }, [e(20, 80, 15, 10), e(80, 80, 15, 10)]),
    blob([e(50, 58, 34, 22), e(50, 76, 26, 16), c(30, 32, 13), c(70, 32, 13)], col, INK, 3.5), e(50, 78, 16, 10, { fill: soft }),
    eye(30, 31, 8, 1, 1), eye(70, 31, 8, -1, 1), g({ fill: INK }, [c(45, 50, 1.6), c(55, 50, 1.6)]),
    g({ fill: col, stroke: INK, sw: 3 }, [e(36, 91, 9, 4), e(64, 91, 9, 4)])].concat(extra);
  const KOAX = { idle: frog('#2fa84f', '#e0f5ea', [line('M28 58Q50 74 72 58', INK, 3.5)]) };
  const BOUBOU = { idle: frog('#f08a24', '#fdeee2', [line('M36 60Q50 70 64 60', INK, 3.5),
    g({ fill: '#d4443b' }, [e(32, 58, 4, 2.5), e(68, 58, 4, 2.5)]),
    g({ fill: '#d4443b', stroke: INK, sw: 2.5 }, [p('M50 22L35 12L36 32ZM50 22L65 12L64 32Z'), c(50, 22, 4.5)])]) };

  // Objects of the «Επιπλέει;» tank, in the material colours of the page's density table, with ink outlines so they read
  // on water and on mercury. Each lists its vertical extent (box) for the markup anchors.
  const OB = { cork: '#c9a26b', corkDot: '#9c7440', ice: '#d8f0fb', iceTop: '#f4fbff', iceSide: '#b9e2f5', iron: '#7d8691',
    copper: '#c8733b', copperIn: '#9a5528', gold: '#e6b422', lead: '#6b7380', alu: '#c9d1d9', aluTop: '#e6eaef', aluSide: '#aeb7c1',
    wood: '#a8743f', woodEnd: '#e3bf86', egg: '#fbf3e4' };
  const OBJ = {
    cork: [p('M32 36V76A18 6 0 0 0 68 76V36Z', { fill: OB.cork, stroke: INK, sw: 4 }), e(50, 36, 18, 6, { fill: OB.cork, stroke: INK, sw: 4 }),
      g({ fill: OB.corkDot }, [c(40, 52, 2.5), c(56, 58, 3), c(44, 70, 2.5), c(60, 72, 2), c(50, 36, 2.5), c(41, 35, 1.8), c(58, 37, 1.8)])],
    ice: [g({ stroke: INK, sw: 3.5 }, [p('M50 22L80 36L50 50L20 36Z', { fill: OB.iceTop }), p('M20 36L50 50L50 84L20 70Z', { fill: OB.ice }),
      p('M80 36L50 50L50 84L80 70Z', { fill: OB.iceSide })]), line('M27 46v14M33 49v6', WHITE, 3.5)],
    nail: [g({ fill: OB.iron, stroke: INK, sw: 3.5 }, [p('M74 44L90 50L74 56Z'), rc(22, 44, 54, 12, 2), rc(12, 36, 10, 28, 3)]),
      line('M26 47h44', OB.alu, 2.5)],
    coin: [c(50, 56, 26, { fill: OB.copper, stroke: INK, sw: 4 }), c(50, 56, 18, { fill: 'none', stroke: OB.copperIn, sw: 3 }),
      line('M36 46a16 16 0 0 1 10-8', WHITE, 3.5)],
    ring: [e(50, 64, 24, 20, { fill: 'none', stroke: INK, sw: 13 }), e(50, 64, 24, 20, { fill: 'none', stroke: OB.gold, sw: 7 }),
      p('M41 38L50 28L59 38L50 48Z', { fill: WHITE, stroke: INK, sw: 3 }), line('M34 58a18 16 0 0 1 6-8', WHITE, 2.5)],
    sinker: [c(50, 24, 6, { fill: 'none', stroke: INK, sw: 3.5 }),
      p('M50 30C64 44 70 56 70 66C70 78 61 86 50 86C39 86 30 78 30 66C30 56 36 44 50 30Z', { fill: OB.lead, stroke: INK, sw: 4 }),
      line('M38 62a14 14 0 0 1 5-12', OB.alu, 3)],
    alu: [g({ stroke: INK, sw: 3.5 }, [p('M50 34L86 46L50 58L14 46Z', { fill: OB.aluTop }), p('M14 46L50 58L50 76L14 64Z', { fill: OB.alu }),
      p('M86 46L50 58L50 76L86 64Z', { fill: OB.aluSide })]), line('M30 46l18 6M44 42l18 6', WHITE, 2.5)],
    wood: [p('M24 44H76V76H24A10 16 0 0 1 24 44Z', { fill: OB.wood, stroke: INK, sw: 4 }), line('M30 54h22M40 66h26', OB.woodEnd, 2.5),
      e(76, 60, 11, 16, { fill: OB.woodEnd, stroke: INK, sw: 4 }), e(76, 60, 6, 9, { fill: 'none', stroke: OB.wood, sw: 2.5 }),
      c(76, 60, 1.8, { fill: OB.wood })],
    egg: [e(50, 58, 21, 27, { fill: OB.egg, stroke: INK, sw: 4 }), line('M38 50a14 18 0 0 1 6-12', WHITE, 4)],
  };
  const OBJ_BOX = { cork: [28, 84], ice: [20, 86], nail: [34, 66], coin: [28, 84], ring: [26, 86], sinker: [16, 88], alu: [32, 78],
    wood: [42, 78], egg: [29, 87] };
  const OBJ_NAME = { cork: 'φελλός', ice: 'παγάκι', nail: 'καρφί', coin: 'νόμισμα', ring: 'δαχτυλίδι', sinker: 'βαρίδι',
    alu: 'αλουμίνιο', wood: 'ξύλο', egg: 'αβγό' };

  // The child's hearts in a boss fight (audit L7): full is solid red with a glint; empty is hollow and cracked, so the two
  // differ in shape and fill, not only in colour. Drawn small (about 26 px), hence the thick outline.
  const heart = fill => p('M50 88C44 82 10 62 10 36C10 21 21 12 33 12C41 12 47 17 50 24C53 17 59 12 67 12C79 12 90 21 90 36C90 62 56 82 50 88Z',
    { fill, stroke: INK, sw: 8 });
  const HEART = {
    full: [heart('#e0435a'), line('M23 36a11 11 0 0 1 10-11', WHITE, 6)],
    empty: [heart(WHITE), line('M50 25l-8 17l12 9l-9 18', INK, 6)],
  };

  const ART = {
    heart: { name: 'καρδιά', states: HEART },
    phys: { name: 'Μπουρμπουλήθρας', states: PHYS },
    math: { name: 'Αριθμοφάγος', states: MATH },
    default: { name: 'Ξεχασιάρης', states: ERASER },
    owl: { name: 'Αριθμούλα', states: OWL },
    koax: { name: 'Κοάξ', states: KOAX, box: [17, 96] },
    boubou: { name: 'Μπουμπού', states: BOUBOU, box: [10, 96] },
  };
  for (const k of Object.keys(OBJ)) ART[k] = { name: OBJ_NAME[k], states: { idle: OBJ[k] }, box: OBJ_BOX[k] };
  function svgNode([tag, a, kids]) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k of Object.keys(a || {})) n.setAttribute(ATTR[k] || k, String(a[k]));
    if (kids) for (const k of kids) n.appendChild(svgNode(k));
    return n;
  }
  function art(name, state, opts) {
    const a = own(ART, name) ? ART[name] : null;
    const shapes = a && own(a.states, state) ? a.states[state] : null;
    if (!shapes || typeof document === 'undefined' || typeof document.createElementNS !== 'function') return null;
    try {
      const svg = svgNode(['svg', { viewBox: '0 0 100 100', class: 'rw-art rw-art-' + name + ' is-' + state, focusable: 'false',
        'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, shapes]);
      if (opts && opts.hidden) svg.setAttribute('aria-hidden', 'true');
      else { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', a.name); }
      return svg;
    } catch (err) { return null; }
  }
  // The markup form, for pages that build their SVG as a string: a nested <svg> (aria-hidden, the page text names the
  // thing) of the given size, placed by opts.cx and opts.cy. anchor: 'center' (default) puts the drawing's centre there;
  // 'foot' its lowest point; 'float' the line with the share `sub` (0 to 1) of the drawing's height below it, so a floating
  // object given sub = its density / the liquid's sits that deep in the liquid. Built only from the tables above; '' for an unknown name or state.
  const escAttr = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  function svgText([tag, a, kids]) {
    let t = '<' + tag;
    for (const k of Object.keys(a || {})) t += ' ' + (ATTR[k] || k) + '="' + escAttr(a[k]) + '"';
    return t + '>' + (kids || []).map(svgText).join('') + '</' + tag + '>';
  }
  const fin = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const r2 = v => Math.round(v * 100) / 100;
  function artMarkup(name, state, opts) {
    const a = own(ART, name) ? ART[name] : null;
    const shapes = a && own(a.states, state) ? a.states[state] : null;
    if (!shapes) return '';
    const o = opts || {}, size = Math.max(1, fin(o.size, 40)), k = size / 100, [top, foot] = a.box || [0, 100];
    const sub = Math.min(0.95, Math.max(0.05, fin(o.sub, 0.5)));
    const at = o.anchor === 'foot' ? foot : o.anchor === 'float' ? foot - sub * (foot - top) : 50;
    return svgText(['svg', { x: r2(fin(o.cx, 0) - 50 * k), y: r2(fin(o.cy, 0) - at * k), width: r2(size), height: r2(size),
      viewBox: '0 0 100 100', class: 'rw-art-m rw-art-' + name, 'aria-hidden': 'true',
      'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, shapes]);
  }
  // Puts the drawing into host (replacing what is there) and marks it; false (host untouched) when there is none.
  function putArt(host, name, state, opts) {
    const svg = host ? art(name, state, opts) : null;
    if (!svg) return false;
    host.replaceChildren(svg);
    host.classList.add('rw-art-on');
    return true;
  }

  // The owl on the Γ΄ maths pages (.mascot .owl, next to the #owlSay bubble) becomes the drawing when the page starts. The
  // page's own owl() helper writes the bubble; when it writes one of the page's PRAISE lines (a global const on those
  // pages, read bare like PG_ID) she cheers for OWL_CHEER_MS, then goes back to idle. Without PRAISE she stays idle.
  // PRAISE is read on each change, not at init: the pages declare it after Engine.start(), so it is not yet readable then.
  /* global PRAISE */
  const OWL_CHEER_MS = 1800, BOSS_HIT_MS = 900;
  const praiseList = () => { try { return Array.isArray(PRAISE) ? PRAISE : []; } catch (e) { return []; } };
  let owlWatch = null;
  function owlArt() {
    const host = document.querySelector('.mascot .owl'), say = document.getElementById('owlSay');
    if (!host || host.classList.contains('rw-art-on') || !putArt(host, 'owl', 'idle')) return;
    if (!say || typeof MutationObserver !== 'function' || owlWatch) return;
    let back = null;
    owlWatch = new MutationObserver(() => {
      clearTimeout(back);
      const yes = praiseList().includes(say.textContent);
      putArt(host, 'owl', yes ? 'cheer' : 'idle');
      if (yes) back = setTimeout(() => putArt(host, 'owl', 'idle'), OWL_CHEER_MS);
    });
    owlWatch.observe(say, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- chapter boss: 15 mixed quiz and true/false questions; answers never call PG.hit ---------- */
  // Item text comes from the page's own constants and may hold simple HTML, so it is rendered like Engine.quiz renders it.
  // The end screen reviews the misses (Engine._reviewHtml) and offers a practice round on them that never touches `_boss`.
  let bossOn = false;
  function boss() {
    const rw = R(), eng = E(), box = document.getElementById('fbossBox');
    if (!rw || !eng || !box || !window.PG) return;
    bossOn = true;
    const pid = pageId(), who = rw.bossFor(pid);
    const pool = eng.bossItems || { quiz: [], tf: [] };
    const seen = eng.seenItems || null;   // audit L6: items seen in this page visit; the fight prefers the others
    let run = null, lastTaunt = null;   // lastTaunt: so the same taunt never comes twice in a row, across fights too
    const scoreOf = () => {
      const b = PG.get('_boss');
      return b && typeof b === 'object' ? b : null;
    };
    // the drawing for this boss (art key = its BOSSES key) in the given state; who.emo when there is none
    const artKey = Object.keys(rw.BOSSES || {}).find(k => rw.BOSSES[k] === who);
    const face = (cls, state, hidden) => {
      const f = el('div', 'rw-boss-face' + (cls ? ' ' + cls : ''));
      if (!putArt(f, artKey, state, { hidden })) f.textContent = who.emo;
      return f;
    };
    // the child's hearts (audit L7): `left` full, then the empty ones, of bossHearts(len), with the count as the text
    // alternative; lost: the heart that just went gets a short animation, none under reduced motion
    function drawHearts(host, len, left, lost) {
      const all = rw.bossHearts(len);
      host.replaceChildren();
      host.setAttribute('aria-label', TXT.bossHearts(left, all));
      for (let k = 0; k < all; k++) {
        const full = k < left, h = el('span', 'rw-heart' + (full ? '' : ' is-empty') + (lost && k === left && !reduced() ? ' lost' : ''));
        h.setAttribute('aria-hidden', 'true');
        if (!putArt(h, 'heart', full ? 'full' : 'empty', { hidden: true })) h.textContent = full ? '♥︎' : '♡︎';
        host.appendChild(h);
      }
    }

    function intro() {
      const list = rw.bossRound(pool.quiz, pool.tf);
      box.replaceChildren();
      const card = el('div', 'rw-boss-intro');
      card.appendChild(face('', 'idle', true));   // the name is the heading right below
      card.appendChild(el('h3', 'rw-boss-name', who.name));
      if (!list.length) { card.appendChild(el('p', '', TXT.bossEmpty)); box.appendChild(card); return; }
      const st = lockState();
      if (!st.unlocked) {   // locked: the lock text and the «Συνέχισε» action instead of the start button
        card.classList.add('rw-boss-locked');
        card.appendChild(el('p', 'rw-boss-rule', TXT.bossLocked(st.left)));
        const tab = nextBtn(st);
        if (tab) card.appendChild(nextButton(tab));
        box.appendChild(card);
        return;
      }
      card.appendChild(el('p', 'rw-boss-say', who.intro));
      card.appendChild(el('p', 'rw-boss-rule', TXT.bossRule(list.length, rw.bossPass(list.length))));
      card.appendChild(el('p', 'rw-boss-rule', TXT.bossHeartsRule(rw.bossHearts(list.length))));
      const b = scoreOf();
      if (b && b.won === true) card.appendChild(el('p', 'rw-boss-won', TXT.bossBeaten));
      if (b && Number.isInteger(b.best) && Number.isInteger(b.total)) card.appendChild(el('p', 'score', TXT.bossBest(b.best, b.total)));
      const go = el('button', 'btn', TXT.bossGo);
      go.type = 'button';
      // the fight is drawn when it starts, so what was answered since this intro appeared counts as seen (same length as list)
      go.onclick = () => {
        const fight = rw.bossRound(pool.quiz, pool.tf, undefined, seen);
        run = { list: fight, i: 0, score: 0, wrong: 0, pass: rw.bossPass(fight.length), miss: [] };
        show();
      };
      card.appendChild(go);
      box.appendChild(card);
    }

    // Practice on the misses of the round before (audit L4): the same questions and feedback, but no health bar, no boss
    // record, no Rewards.onBoss and no celebration; `run` is set while it lasts, so guide() leaves it alone (bossView.busy).
    function practice(miss) {
      run = { list: eng._retryList(miss), i: 0, score: 0, wrong: 0, pass: 0, miss: [], practice: true };
      show();
    }
    // the end card's buttons: «Νέα μάχη» (to the intro), with «Ξανά μόνο τα λάθη» before it while there are misses
    function endButtons(card, miss) {
      const again = el('button', 'btn', TXT.bossAgain);
      again.type = 'button';
      again.onclick = intro;
      if (!miss.length) { card.appendChild(again); return; }
      const row = el('div', 'rw-boss-btns');
      row.append(retryButton(miss), again);
      card.appendChild(row);
    }
    function retryButton(miss) {
      const b = el('button', 'btn rv-retry', TXT.bossRetry);
      b.type = 'button';
      b.onclick = () => practice(miss);
      return b;
    }
    // the review list under the end card (page item text, rendered as the questions are), and the retry again under a long list
    function review(miss) {
      if (!miss.length) return;
      const rv = el('div', 'rw-boss-review');
      rv.innerHTML = eng._reviewHtml(miss);
      box.appendChild(rv);
      if (miss.length < 4) return;
      const row = el('div', 'rw-boss-btns rv-end');
      row.appendChild(retryButton(miss));
      box.appendChild(row);
    }

    function show() {
      if (run.i >= run.list.length) { end(); return; }
      const n = run.list.length;
      const { kind, item } = run.list[run.i];
      if (seen) seen.add(item);   // a fight or practice question on screen counts as seen for the next fight
      box.replaceChildren();
      const top = el('div', 'row');
      top.style.justifyContent = 'space-between';
      top.appendChild(el('span', 'score', TXT.bossQ(run.i + 1, n)));
      const sc = el('span', 'score', TXT.bossScore(run.score));
      top.appendChild(sc);
      box.appendChild(top);
      const prog = el('div', 'prog'), pf = el('div');
      pf.style.width = (run.i / n * 100) + '%';
      prog.appendChild(pf);
      box.appendChild(prog);
      const practiceRun = !!run.practice;
      let f = null, bar = null, fill = null, back = null, hearts = null, say = null;
      if (practiceRun) {   // a label in place of the boss and its health bar
        const tag = el('div', 'rw-boss-practice');
        tag.append(el('b', '', TXT.bossPractice), el('span', '', TXT.bossPracticeNote));
        box.appendChild(tag);
      } else {
        const hpRow = el('div', 'rw-boss-hprow');
        f = face('small', 'idle');
        hpRow.appendChild(f);
        bar = el('div', 'rw-boss-hp'); fill = el('div', 'rw-boss-hpfill');
        bar.setAttribute('role', 'meter');
        bar.setAttribute('aria-label', TXT.bossHp);
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', String(run.pass));
        bar.setAttribute('aria-valuenow', String(Math.max(0, run.pass - run.score)));
        fill.style.width = (Math.max(0, run.pass - run.score) / run.pass * 100) + '%';
        bar.appendChild(fill);
        hpRow.appendChild(bar);
        hearts = el('div', 'rw-hearts');
        hearts.setAttribute('role', 'img');
        drawHearts(hearts, n, rw.bossOver({ len: n, answered: run.i, wrong: run.wrong }).hearts, false);
        hpRow.appendChild(hearts);
        box.appendChild(hpRow);
        // the polite announcement of a lost heart (the hearts' own label changes too, but a label change is not announced)
        say = el('p', 'rw-sr');
        say.setAttribute('role', 'status');
        box.appendChild(say);
      }
      const q = el('div', 'big');
      q.style.margin = '12px 0';
      q.innerHTML = item[0];
      box.appendChild(q);
      const ex = el('div');
      // each option is [button, right]; quiz options are shuffled with the engine's global shuffle, as in Engine.quiz
      const opts = kind === 'quiz'
        ? shuffle(item[1]).map((o, k) => {
          const b = el('button', 'opt');
          b.innerHTML = String.fromCharCode(945 + k) + ') ' + o;
          return [b, o === item[1][0]];
        })
        : [[TXT.bossTrue, true], [TXT.bossFalse, false]].map(([label, v]) => [el('button', 'opt', label), v === item[1]]);
      let answered = false;
      opts.forEach(([b, ok]) => {
        b.type = 'button';
        b.onclick = () => {
          if (answered) return;
          answered = true;
          if (ok) run.score++;
          else { run.wrong++; eng._missOnce(run.miss, run.list[run.i]); }
          // audit L7: in a fight the last heart ends it here (after this explanation); practice just runs to its end
          const st = rw.bossOver({ len: run.list.length, answered: run.i + 1, wrong: run.wrong, practice: practiceRun });
          sc.textContent = TXT.bossScore(run.score);
          eng._cheer(ok);
          opts.forEach(([x, r]) => { x.disabled = true; if (r) x.classList.add('right'); });
          if (!ok) b.classList.add('wrong');
          if (!practiceRun) {
            const left = Math.max(0, run.pass - run.score);
            fill.style.width = (left / run.pass * 100) + '%';
            bar.setAttribute('aria-valuenow', String(left));
            // a right answer: the hit drawing for BOSS_HIT_MS (also under reduced motion), and the shake unless reduced
            if (ok && f.classList.contains('rw-art-on')) {
              putArt(f, artKey, 'hit');
              clearTimeout(back);
              back = setTimeout(() => putArt(f, artKey, 'idle'), BOSS_HIT_MS);
            }
            if (ok && !reduced()) { f.classList.remove('hit'); void f.offsetWidth; f.classList.add('hit'); }
            if (!ok) {
              drawHearts(hearts, run.list.length, st.hearts, true);
              say.textContent = st.hearts ? TXT.bossHeartLost(st.hearts) : TXT.bossNoHearts;
            }
          }
          const expl = el('div', 'expl');
          const head = el('b', '', ok ? TXT.bossRight : TXT.bossWrong);
          head.style.color = ok ? 'var(--ok)' : 'var(--bad)';
          expl.appendChild(head);
          const body = el('span');
          body.innerHTML = (kind === 'tf' ? TXT.bossTfIs(item[1] === true) : '') + (item[2] || '');
          expl.appendChild(body);
          // a miss that leaves hearts: the boss boasts under the explanation (the last heart gets his `lose` line on the end card)
          if (!ok && !practiceRun && st.why !== 'hearts') {
            lastTaunt = rw.bossTaunt(who.taunt, lastTaunt);
            if (lastTaunt) {
              const t = el('p', 'rw-boss-taunt');
              t.append(el('b', '', who.name + ': '), el('span', '', '«' + lastTaunt + '»'));
              expl.appendChild(t);
            }
          }
          const nav = el('div');
          nav.style.cssText = 'margin-top:12px;text-align:right';
          const nb = el('button', 'btn', st.over ? TXT.bossEnd : TXT.bossNext);
          nb.type = 'button';
          nb.onclick = () => { run.i++; if (st.over) end(st); else show(); };
          nav.appendChild(nb);
          ex.replaceChildren(expl, nav);
        };
        box.appendChild(b);
      });
      box.appendChild(ex);
    }

    // practice end: the score of this practice, what is still missed, the retry while misses remain, and «Νέα μάχη»
    function practiceEnd() {
      const total = run.list.length, score = run.score, miss = run.miss;
      box.replaceChildren();
      const card = el('div', 'rw-boss-intro');
      card.appendChild(el('p', 'rw-boss-practice', TXT.bossPractice));
      card.appendChild(el('div', 'big', score + ' / ' + total));
      card.appendChild(el('p', 'rw-boss-say', miss.length ? TXT.bossPracticeLeft(score, total) : TXT.bossPracticeAll));
      endButtons(card, miss);
      box.appendChild(card);
      review(miss);
      run = null;
    }

    // st: bossOver's result for the last answer. A fight that lost its last heart ends early: a loss, recorded like any
    // other (best never lowered, total the full round length) and with no Rewards.onBoss call, as for every loss.
    function end(st) {
      if (run.practice) { practiceEnd(); return; }
      const total = run.list.length, score = run.score, won = score >= run.pass, miss = run.miss;
      const early = !!(st && st.why === 'hearts');
      const prev = scoreOf(), wasWon = !!(prev && prev.won === true);
      const prevBest = prev && Number.isInteger(prev.best) && prev.best >= 0 ? prev.best : 0;
      // never downgrade: once won stays won; best is the highest score; a loss keeps the date of the last win
      const rec = { won: wasWon || won, best: Math.max(prevBest, score), total,
        at: won || !(prev && typeof prev.at === 'string') ? today() : prev.at };
      PG.put('_boss', rec);
      if (won) {
        let res = null;
        try {
          res = rw.onBoss({ pageId: pid, kid: eng.kid, rows: pageRows().concat([['_boss', '👹 Τελικό τέρας', 'boss']]), progress: PG.store(), won: true });
        } catch (e) { console.error(e); }
        const badges = res && Array.isArray(res.badges) ? res.badges : [];
        // the first win on this page is the gold sticker (3 trophy stars); a repeat win still gets confetti
        if (!wasWon) celebrate({ starsUp: null, sticker: true, badges, questDone: false });
        else { celebrate({ starsUp: null, sticker: false, badges, questDone: false }); confetti(); sound('win'); }
      }
      box.replaceChildren();
      const card = el('div', 'rw-boss-intro');
      card.appendChild(face(won ? 'down' : '', won ? 'beaten' : 'idle'));
      card.appendChild(el('h3', 'rw-boss-name', won ? TXT.bossWon : TXT.bossLost));
      if (early) card.appendChild(el('p', 'rw-boss-rule', TXT.bossNoHearts));
      card.appendChild(el('div', 'big', score + ' / ' + total));
      card.appendChild(el('p', 'rw-boss-say', won ? who.win : who.lose));
      card.appendChild(el('p', 'score', TXT.bossBest(rec.best, total)));
      endButtons(card, miss);
      box.appendChild(card);
      review(miss);
      run = null;
      guide();   // a stored _boss record or a win can change what «Συνέχισε» opens
    }

    bossView = { intro, busy: () => !!run };
    intro();
  }

  /* ---------- init: called at the end of Engine.start ---------- */
  function init() {
    if (!R()) return;
    if (!inited) {
      // a tab left in the background (or open across midnight) shows today's quest and countdown when it comes back
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        try { questStrip(); countdown(); guide(); } catch (e) { console.error(e); }
      });
      const eng = E();
      if (eng && typeof eng.onTab === 'function') {
        eng.onTab(t => { if (t === 'fboss' && !bossOn) boss(); });
        eng.onTab(() => guide());
      }
    }
    inited = true;
    region();
    try { owlArt(); } catch (e) { console.error(e); }   // a failure leaves the emoji owl
    const pg = document.getElementById('pg'), btn = document.getElementById('pgBtn');
    if (pg && btn && !document.getElementById('rwSnd')) {
      const holder = document.createDocumentFragment();
      const b = soundToggle(holder);
      if (b) { b.id = 'rwSnd'; pg.insertBefore(holder, btn); document.body.classList.add('rw-snd-on'); }
    }
    // A kid page builds the day's quest once the class plan has loaded or failed to load; loadPlan marks it pending first,
    // so the questStrip below shows only a quest already stored for today.
    const eng = E(), pid = pageId();
    if (eng && eng.kid && pid) {
      openProg = { [pid]: R().load('progress_' + pid) || {} };
      loadPlan(() => { try { questStrip(); countdown(); guide(); } catch (e) { console.error(e); } });   // the plan's test date may count now
    }
    questStrip();
    countdown();
    guide();
  }

  window.RewardsUI = { TXT, celebrate, confetti, sound, soundToggle, questStrip, countdown, toast, boss, guide, init, art, artMarkup };
})();
