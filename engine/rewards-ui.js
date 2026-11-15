/* Page-side reward effects: toasts, confetti, a flying star, optional sound, the daily quest strip and the test countdown.
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
    otherPage: title => (title ? 'Στη σελίδα «' + title + '»' : 'Σε άλλη σελίδα'),
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
  };

  const TOAST_MS = 2500, CONFETTI_MS = 1200, STAR_MS = 800;
  const FILE_RE = /^dim[\w-]+\.html$/;
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

  /* ---------- daily quest strip, under the header on kid pages ---------- */
  function questStrip() {
    const rw = R(), eng = E(), pid = pageId();
    const old = document.getElementById('rwQuest');
    if (!rw || !eng || !eng.kid || !pid) { if (old) old.remove(); return null; }
    const day = today();
    const q = rw.ensureQuest(eng.kid, day);
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
    let mans = null;
    const titleOf = id => { if (!mans) mans = rw.manifests(); return own(mans, id) && typeof mans[id].title === 'string' ? mans[id].title : ''; };
    const box = el('div', 'rw-quest' + (st.allDone ? ' all' : ''));
    box.id = 'rwQuest';
    box.appendChild(el('span', 'rw-quest-h', TXT.questTitle + (st.allDone ? ' ✓' : '')));
    const list = el('div', 'rw-quest-list');
    for (const t of st.tasks) {
      const label = typeof t.label === 'string' ? t.label : String(t.key);
      const target = Number(t.target) || 0, count = Math.min(Number(t.count) || 0, target);
      const other = t.pageId !== pid, link = other && typeof t.file === 'string' && FILE_RE.test(t.file);
      const chip = el(link ? 'a' : 'span', 'rw-task' + (t.done ? ' done' : '') + (other ? ' other' : ''));
      if (link) chip.href = t.file;
      let tip = t.type === 'hit' ? TXT.questHit(target, label) : TXT.questList(label);
      if (other) tip = TXT.otherPage(titleOf(t.pageId)) + ': ' + tip;
      chip.title = tip;
      chip.setAttribute('aria-label', tip + (t.done ? ' ✓' : ' (' + count + '/' + target + ')'));
      chip.appendChild(el('span', 'rw-task-l', label));
      chip.appendChild(el('b', 'rw-task-c', t.done ? '✓' : count + '/' + target));
      if (link) chip.appendChild(el('span', 'rw-task-go', '➜'));
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
  function countdown() {
    const rw = R(), eng = E(), pid = pageId();
    const old = document.getElementById('rwCount');
    const drop = () => { if (old) old.remove(); return null; };
    if (!rw || !eng || !eng.kid || !pid) return drop();
    const dates = rw.kidStore(eng.kid).testDates;
    const n = own(dates, pid) ? rw.daysUntil(today(), dates[pid]) : null;
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
    if (inited) { questStrip(); countdown(); }
  }

  /* ---------- chapter boss: 15 mixed quiz and true/false questions; answers never call PG.hit ---------- */
  // Item text comes from the page's own constants and may hold simple HTML, so it is rendered like Engine.quiz renders it.
  let bossOn = false;
  function boss() {
    const rw = R(), eng = E(), box = document.getElementById('fbossBox');
    if (!rw || !eng || !box || !window.PG) return;
    bossOn = true;
    const pid = pageId(), who = rw.bossFor(pid);
    const pool = eng.bossItems || { quiz: [], tf: [] };
    let run = null;
    const scoreOf = () => {
      const b = PG.get('_boss');
      return b && typeof b === 'object' ? b : null;
    };
    const face = cls => el('div', 'rw-boss-face' + (cls ? ' ' + cls : ''), who.emo);

    function intro() {
      const list = rw.bossRound(pool.quiz, pool.tf);
      box.replaceChildren();
      const card = el('div', 'rw-boss-intro');
      card.appendChild(face());
      card.appendChild(el('h3', 'rw-boss-name', who.name));
      if (!list.length) { card.appendChild(el('p', '', TXT.bossEmpty)); box.appendChild(card); return; }
      card.appendChild(el('p', 'rw-boss-say', who.intro));
      card.appendChild(el('p', 'rw-boss-rule', TXT.bossRule(list.length, rw.bossPass(list.length))));
      const b = scoreOf();
      if (b && b.won === true) card.appendChild(el('p', 'rw-boss-won', TXT.bossBeaten));
      if (b && Number.isInteger(b.best) && Number.isInteger(b.total)) card.appendChild(el('p', 'score', TXT.bossBest(b.best, b.total)));
      const go = el('button', 'btn', TXT.bossGo);
      go.type = 'button';
      go.onclick = () => { run = { list, i: 0, score: 0, pass: rw.bossPass(list.length) }; show(); };
      card.appendChild(go);
      box.appendChild(card);
    }

    function show() {
      if (run.i >= run.list.length) { end(); return; }
      const n = run.list.length, hp = Math.max(0, run.pass - run.score) / run.pass;
      const { kind, item } = run.list[run.i];
      box.replaceChildren();
      const top = el('div', 'row');
      top.style.justifyContent = 'space-between';
      top.appendChild(el('span', 'score', TXT.bossQ(run.i + 1, n)));
      top.appendChild(el('span', 'score', TXT.bossScore(run.score)));
      box.appendChild(top);
      const prog = el('div', 'prog'), pf = el('div');
      pf.style.width = (run.i / n * 100) + '%';
      prog.appendChild(pf);
      box.appendChild(prog);
      const hpRow = el('div', 'rw-boss-hprow');
      const f = face('small');
      hpRow.appendChild(f);
      const bar = el('div', 'rw-boss-hp'), fill = el('div', 'rw-boss-hpfill');
      bar.setAttribute('role', 'meter');
      bar.setAttribute('aria-label', TXT.bossHp);
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', String(run.pass));
      bar.setAttribute('aria-valuenow', String(Math.max(0, run.pass - run.score)));
      fill.style.width = (hp * 100) + '%';
      bar.appendChild(fill);
      hpRow.appendChild(bar);
      box.appendChild(hpRow);
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
          eng._cheer(ok);
          opts.forEach(([x, r]) => { x.disabled = true; if (r) x.classList.add('right'); });
          if (!ok) b.classList.add('wrong');
          const left = Math.max(0, run.pass - run.score);
          fill.style.width = (left / run.pass * 100) + '%';
          bar.setAttribute('aria-valuenow', String(left));
          if (ok && !reduced()) { f.classList.remove('hit'); void f.offsetWidth; f.classList.add('hit'); }
          const expl = el('div', 'expl');
          const head = el('b', '', ok ? TXT.bossRight : TXT.bossWrong);
          head.style.color = ok ? 'var(--ok)' : 'var(--bad)';
          expl.appendChild(head);
          const body = el('span');
          body.innerHTML = (kind === 'tf' ? TXT.bossTfIs(item[1] === true) : '') + (item[2] || '');
          expl.appendChild(body);
          const nav = el('div');
          nav.style.cssText = 'margin-top:12px;text-align:right';
          const nb = el('button', 'btn', run.i + 1 < run.list.length ? TXT.bossNext : TXT.bossEnd);
          nb.type = 'button';
          nb.onclick = () => { run.i++; show(); };
          nav.appendChild(nb);
          ex.replaceChildren(expl, nav);
        };
        box.appendChild(b);
      });
      box.appendChild(ex);
    }

    function end() {
      const total = run.list.length, score = run.score, won = score >= run.pass;
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
      card.appendChild(face(won ? 'down' : ''));
      card.appendChild(el('h3', 'rw-boss-name', won ? TXT.bossWon : TXT.bossLost));
      card.appendChild(el('div', 'big', score + ' / ' + total));
      card.appendChild(el('p', 'rw-boss-say', won ? who.win : who.lose));
      card.appendChild(el('p', 'score', TXT.bossBest(rec.best, total)));
      const again = el('button', 'btn', TXT.bossAgain);
      again.type = 'button';
      again.onclick = intro;
      card.appendChild(again);
      box.appendChild(card);
      run = null;
    }

    intro();
  }

  /* ---------- init: called at the end of Engine.start ---------- */
  function init() {
    if (!R()) return;
    if (!inited) {
      // a tab left in the background (or open across midnight) shows today's quest and countdown when it comes back
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        try { questStrip(); countdown(); } catch (e) { console.error(e); }
      });
      const eng = E();
      if (eng && typeof eng.onTab === 'function') eng.onTab(t => { if (t === 'fboss' && !bossOn) boss(); });
    }
    inited = true;
    region();
    const pg = document.getElementById('pg'), btn = document.getElementById('pgBtn');
    if (pg && btn && !document.getElementById('rwSnd')) {
      const holder = document.createDocumentFragment();
      const b = soundToggle(holder);
      if (b) { b.id = 'rwSnd'; pg.insertBefore(holder, btn); document.body.classList.add('rw-snd-on'); }
    }
    questStrip();
    countdown();
  }

  window.RewardsUI = { TXT, celebrate, confetti, sound, soundToggle, questStrip, countdown, toast, boss, init };
})();
