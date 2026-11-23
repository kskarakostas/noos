/* Η σχολική μας γωνιά, engine v1
   Shared by every page: styles, progress table, tabs, the chapter shell (top bar, chapter home, bottom bar, rail; round 3,
   W2: Engine.shell below, its CSS and markup contract at the top of engine-ui.css), cards, quiz, true/false and generic games.
   Pages load in the head: tokens.css, icons.js, engine.css, engine-content.css, (page styles), engine-ui.css, rewards.css;
   then engine.js (rewards.js and rewards-ui.js after it), then call Engine.start(...) or Engine.build(...). */
var $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
var shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
var pick=a=>a[Math.floor(Math.random()*a.length)];
var ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1));

/* =====================================================================
   ENGINE API
   ===================================================================== */
var Engine = window.Engine = {
  version: '1.0',
  tabHooks: [],
  cheer: null,
  kid: null,
  bossItems: {quiz: [], tf: []},
  /* audit L6: the quiz, true/false and boss items the child has seen in this page visit, by reference (memory only, never
     stored); the final boss prefers the others. Quiz and true/false items count once answered: each round renders its first
     question into the hidden tab at load, before anyone sees it. */
  seenItems: new Set(),
  onTab(f){ this.tabHooks.push(f); },
  _cheer(ok){ Engine.shell.played(); try{ if(typeof this.cheer==='function') this.cheer(ok); }catch(e){} },
  /* reward hook: runs only when engine/rewards.js is loaded; a reward error never breaks a game */
  _reward(fn, o){
    if(!window.Rewards) return null;
    let res = null;
    try{ res = Rewards[fn](o); }catch(e){ console.error(e); return null; }
    if(res && res.sticker) Engine._stk.push({key: res.starsUp ? res.starsUp.key : null});   /* the end screen's sticker card */
    try{ if(window.RewardsUI && typeof RewardsUI.celebrate==='function') RewardsUI.celebrate(res); }catch(e){ console.error(e); }
    return res;
  },
  /* end-of-round review (audit L4), shared by the quiz, true/false and the final boss: a missed item is recorded once, in the
     order missed; the retry asks only those, shuffled */
  _missOnce(list, item){ if(!list.includes(item)) list.push(item); return list; },
  _retryList(list){ return shuffle(list); },
  /* misses = [{kind:'quiz'|'tf', item}]: «Τι να ξαναδώ», each with its right answer and explanation; rights (optional, the
     same shape): the ones answered right, «Τα βρήκες», each with its answer; '' when both are empty. The question, the
     answer and the explanation are the page's own item text, put in as HTML exactly as the rounds render them; the only
     other text is fixed here. */
  _reviewHtml(misses, rights){
    const ans = (kind, item) => kind === 'tf' ? (item[1] === true ? 'Σωστό' : 'Λάθος') : item[1][0], tick = `<span class="rv-ok" aria-hidden="true">${Engine._icon('tick')}</span>`;
    const li = misses.map(({kind, item}) => `<li class="rv-item"><div class="rv-q">${item[0]}</div><div class="rv-a">${tick} Σωστή απάντηση: <b>${ans(kind, item)}</b></div>${item[2] ? `<div class="rv-ex">${item[2]}</div>` : ''}</li>`).join('');
    const ok = (rights || []).map(({kind, item}) => `<li class="rv-good"><div class="rv-q">${item[0]}</div><div class="rv-a">${tick} <b>${ans(kind, item)}</b></div></li>`).join('');
    return (li ? `<div class="rv"><h3 class="rv-h">Τι να ξαναδώ</h3><ol class="rv-list">${li}</ol></div>` : '')
      + (ok ? `<div class="rv rv-right"><h3 class="rv-h">Τα βρήκες</h3><ol class="rv-list">${ok}</ol></div>` : '');
  },
  /* ---------- the end of a round (round 3, W6b, mockup 06): quiz, true/false, the final boss (rewards-ui.js) and the
     engine games of Engine._steps. Presentation only: the caller has scored, stored and rewarded the round. ----------
     The screen is the box's content, drawn fixed over the content area (engine-ui.css «end of a round»: the whole screen
     below 1100 px, the area beside the rail from 1100 px): close (to the chapter start; Escape too), the context line,
     three stars (or a tag on a practice round), the heading, its lines, the sticker card when this round earned one, then
     «Συνέχισε: <next activity of the learning path>» (the yellow primary; the again button takes its place when there is
     no other activity to go to), «Ξανά μόνο τα N λάθη» (with misses), the again button and «Δες τις απαντήσεις σου» (the
     review, a second view of the same screen, with the retry again under it). Every retry button has class rv-retry.
     o = {tab, stars: 0 to 3 or null, tag: html shown instead of the stars, face: html beside the heading, head: html,
     lines: [[class, html]], sticker: {name, gold} or null, again: {id, r (its data-r), label}, retry: {id, n} or null,
     misses, rights: [{kind, item}]}. Texts are engine strings or the page's own item text. Wire with _endOn(box). */
  CUTS: [.5, .7, .9],      /* the share right for 1, 2 and 3 stars, as the end screens always drew them */
  CUTS_TF: [.5, .75, .9],  /* true/false: its trophy (.9) and star (.75) lines, one star from half */
  roundStars(score, total, cuts){ const c = cuts || Engine.CUTS, r = total > 0 ? score / total : 0; return c.filter(x => r >= x).length; },
  /* what the next star needs, in words: the fewest right answers out of total that reach it; '' at 3 stars or with no total */
  nextStar(score, total, cuts){
    const c = cuts || Engine.CUTS, s = Engine.roundStars(score, total, c);
    if(s >= 3 || !(total > 0)) return '';
    let k = 0; while(k < total && !(k / total >= c[s])) k++;
    return `Με ${k} ${k === 1 ? 'σωστή' : 'σωστές'} παίρνεις ${s === 0 ? 'το πρώτο' : s === 1 ? 'και το δεύτερο' : 'και το τρίτο'} αστέρι.`;
  },
  /* the result line: «8 στις 10 σωστές» */
  result(score, total){ return `${score} στις ${total} ${score === 1 ? 'σωστή' : 'σωστές'}`; },
  /* the sticker of row key earned since mark n of Engine._stk (Engine._reward records each: a row reaching 3 stars), as the
     end screen's card {name: the row's label without its emoji}, or null. Another row's sticker (a game played while this
     round waited) is not this round's. */
  _stk: [],
  _stickerSince(n, key){
    if(!Engine._stk.slice(n || 0).some(x => x.key === key)) return null;
    const rows = typeof PG_ROWS !== 'undefined' && Array.isArray(PG_ROWS) ? PG_ROWS : [], r = rows.find(x => Array.isArray(x) && x[0] === key);
    return {name: r ? Engine.shell.name(r[1]) : ''};
  },
  /* the activity «Συνέχισε» opens from the end of tab t: the learning path's next tab (Engine.shell.nextTab), or null when
     there is none or it is t itself */
  _endNext(t){
    const S = Engine.shell;let n;
    try{ n = S.ready ? S.nextTab() : null; }catch(e){ n = null; }
    return n && n !== t && S.tabs.some(x => x[0] === n) ? {t: n, name: S._tabName(S.tabs, n)} : null;
  },
  _endStars(n){
    let h = '';
    for(let k = 0; k < 3; k++) h += `<span class="sh-end-st${k < n ? ' on' : ''}${k === 1 ? ' mid' : ''}">${Engine._icon('star')}</span>`;
    return `<div class="sh-end-stars" role="img" aria-label="${n} από 3 αστέρια">${h}</div>`;
  },
  _endScreen(o){
    const S = Engine.shell, ic = Engine._icon, esc = S.esc, t = o.tab || '', hid = 'shEndH_' + String(t).replace(/\W/g, '');
    const ctx = [S._tabName(S.tabs, t), S.title].filter(Boolean).join(', '), nx = Engine._endNext(t);
    const misses = o.misses || [], rights = o.rights || [], rv = Engine._reviewHtml(misses, rights), a = o.again;
    const again = a ? `<button type="button" class="${nx ? 'sh-end-link' : 'sh-end-go'} sh-end-again"${a.id ? ` id="${a.id}"` : ''}${a.r ? ` data-r="${a.r}"` : ''}>${ic('retry')}${a.label}</button>` : '';
    const n = o.retry ? o.retry.n : 0, rb = id => `<button class="rv-retry sh-end-retry" type="button"${id ? ` id="${id}"` : ''}>${n === 1 ? 'Ξανά μόνο το 1 λάθος' : `Ξανά μόνο τα ${n} λάθη`}</button>`;
    const stk = o.sticker ? `<div class="sh-end-stk"><span class="sh-end-disc${o.sticker.gold ? ' gold' : ''}" aria-hidden="true">${ic(o.sticker.gold ? 'trophy' : 'mascot-sticker')}</span><span class="sh-end-stkt"><b>Νέο αυτοκόλλητο</b><span>${o.sticker.name ? `«${esc(o.sticker.name)}»: μπήκε` : 'Μπήκε'} στο άλμπουμ σου.</span></span></div>` : '';
    const lines = (o.lines || []).filter(l => l && l[1]).map(([c, h]) => `<p class="sh-end-l${c ? ' ' + c : ''}">${h}</p>`).join('');
    const head = `<h2 class="sh-end-h" id="${hid}" tabindex="-1">${o.head}</h2>`;
    return `<div class="sh-end" role="dialog" aria-labelledby="${hid}"><div class="sh-end-top"><button type="button" class="sh-end-x" data-end="close" aria-label="Κλείσιμο, πίσω στο κεφάλαιο">${ic('cross')}</button><span class="sh-end-ctx">${esc(ctx)}</span><span class="sh-end-sp"></span></div>`
      + `<div class="sh-end-main">${o.stars == null ? (o.tag ? `<p class="sh-end-tag">${o.tag}</p>` : '') : Engine._endStars(o.stars)}`
      + (o.face ? `<div class="sh-end-hrow">${o.face}${head}</div>` : head) + lines + stk
      + `<div class="sh-end-acts">${nx ? `<button type="button" class="sh-end-go" data-end="next" data-t="${esc(nx.t)}">${ic('play')}Συνέχισε: ${esc(nx.name)}</button>` : again}${n ? rb(o.retry.id) : ''}`
      + `<div class="sh-end-links">${nx ? again : ''}${rv ? `<button type="button" class="sh-end-link" data-end="review">${ic('eye')}Δες τις απαντήσεις σου</button>` : ''}</div></div></div>`
      + (rv ? `<div class="sh-end-rv" hidden><div class="sh-end-rvtop"><button type="button" class="sh-end-link" data-end="result">${ic('back')}Πίσω στο αποτέλεσμα</button></div><h2 class="sh-end-rvh" tabindex="-1">Οι απαντήσεις σου</h2>${rv}${n ? `<div class="sh-end-rvacts">${rb()}</div>` : ''}</div>` : '')
      + '</div>';
  },
  /* after an end screen went into box: its close, «Συνέχισε» and review buttons work (one listener per box), and the focus
     moves to its heading. A no-op where the box has no DOM (the node tests).
     W8: the screen is a dialog. Below the rail breakpoint it covers the top and bottom bars, so it is modal there
     (aria-modal, Tab and Shift+Tab stay inside it); from the breakpoint the rail beside it stays usable, so it is not.
     Closing it (its button or Escape) goes to the chapter start, whose tile of this activity takes the focus back. */
  _endOn(box){
    if(!box || typeof box.querySelector !== 'function') return;
    if(!box._shEnd && typeof box.addEventListener === 'function'){
      box._shEnd = true;
      box.addEventListener('click', e => {
        const b = e.target && e.target.closest ? e.target.closest('[data-end]') : null;
        if(!b || !box.contains(b)) return;
        const a = b.dataset.end;
        if(a === 'close') Engine.shell.home({});
        else if(a === 'next') Engine.shell.open(b.dataset.t);
        else Engine._endView(box, a === 'review');
      });
      box.addEventListener('keydown', e => {
        const end = box.querySelector('.sh-end');
        if(e.key !== 'Tab' || !end || !Engine._endModal(end)) return;
        const f = [...end.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.getClientRects().length);
        if(!f.length) return;
        const i = f.indexOf(document.activeElement), to = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i === f.length - 1 ? 0 : i + 1);
        e.preventDefault(); f[to].focus();
      });
    }
    Engine._endView(box, false);
  },
  /* whether the end screen el is modal now (below the rail breakpoint), and its aria-modal set to match */
  _endModal(el){
    const on = typeof innerWidth === 'number' && innerWidth < Engine.shell.RAIL_MIN;
    if(el && typeof el.setAttribute === 'function'){ if(on) el.setAttribute('aria-modal', 'true'); else el.removeAttribute('aria-modal'); }
    return on;
  },
  /* the result (review false) or the review (true) of the end screen in box, the focus on its heading */
  _endView(box, review){
    const m = box.querySelector('.sh-end-main'), r = box.querySelector('.sh-end-rv');
    if(m) m.hidden = !!review && !!r;
    if(r) r.hidden = !review;
    Engine._endModal(box.querySelector('.sh-end'));
    const h = box.querySelector(review && r ? '.sh-end-rvh' : '.sh-end-h');
    if(h) try{ h.focus({preventScroll: true}); }catch(e){}
  },
  get _retryTag(){ return `<div class="rv-tag">${Engine._icon('retry')}Ξανά στα λάθη</div>`; },
  _retryLine(s, L, left){ return left ? `Σωστά τώρα: ${s} από ${L}. Δες ξανά όσα έμειναν.` : 'Τα διόρθωσες όλα! 🎉'; },
  /* public names for the helpers pages call (W5 fit pass): Engine.icon, Engine.verdict, Engine.okMark; the underscore names
     stay and are the same functions */
  icon(name, opts){ return Engine._icon(name, opts); },
  verdict(ok, text){ return Engine._verdict(ok, text); },
  okMark(ok){ return Engine._okMark(ok); },
  /* the scroll behaviour that respects prefers-reduced-motion: 'auto' (a jump) under it, else 'smooth' */
  _motion(){ try{ return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; }catch(e){ return 'smooth'; } },
  /* an interface icon from engine/icons.js ('' where it is not loaded, as in the node tests) */
  _icon(name, opts){ return typeof Icons !== 'undefined' && Icons && typeof Icons.svg === 'function' ? Icons.svg(name, opts) : ''; },
  /* the mark after an answered option: a tick or a cross, never colour alone, and the word for a screen reader */
  _okMark(ok){ return `<span class="sh-mark">${Engine._icon(ok ? 'tick' : 'cross')}<span class="sh-sr"> (${ok ? 'σωστό' : 'λάθος'})</span></span>`; },
  /* the verdict word of a feedback panel, with its icon */
  _verdict(ok, text){ return `<b class="sh-v ${ok ? 'ok' : 'bad'}">${Engine._icon(ok ? 'tick' : 'cross')}${text}</b>`; },
  /* progress line of a round, one segment per question: res[k] true (right), false (wrong), else open; i is the question on screen */
  _segs(id, res, n, i){
    let s = '', ok = 0, bad = 0;
    for(let k = 0; k < n; k++){ const r = res[k]; if(r === true) ok++; else if(r === false) bad++;
      s += `<i class="${r === true ? 'ok' : r === false ? 'bad' : k === i ? 'cur' : ''}"></i>`; }
    return `<div class="sh-segs" id="${id}" role="img" aria-label="Ερώτηση ${Math.min(i + 1, n)} από ${n}: ${ok} ${ok === 1 ? 'σωστή' : 'σωστές'}, ${bad} λάθος">${s}</div>`;
  },
  /* a quiz, true/false or boss box goes onto the activity frame (engine-ui.css): the box is the frame's column, its section the frame */
  _round(box){
    if(!box || !box.classList) return;
    box.classList.add('sh-round', 'sh-col');
    const sec = typeof box.closest === 'function' ? box.closest('section') : null;
    if(sec) sec.classList.add('sh-frame', 'sh-rframe');
    if(!Engine._fitOn && typeof window !== 'undefined' && window.addEventListener){ Engine._fitOn = true; window.addEventListener('resize', () => Engine._refit()); }
  },
  /* fit (G2): an answered round (quiz, true/false, the boss) shows the question, every option with its tick or cross, the
     verdict, the boss's taunt and the next button, nothing cut or scrolled out. While .sh-body or the feedback panel
     overflows, the box takes the next level, classes sh-fit1 to sh-fit7 (engine-ui.css): 1 tighter spacing, 2 a smaller
     boss and hearts row, 3 options 56 px high, 4 to 6 the question at 24, 22 and 20 px, 7 the boss's taunt on the verdict's
     line (box._fitLast, set by the boss, moves it there). reset (a new question, the intro, the end screen) drops the
     levels; within one question they never go down. Engine._refit runs it again on the open round when the owl's note
     takes its row or the window resizes. */
  _fit(box, reset){
    if(!box || !box.classList) return;
    if(reset){ for(let k = 1; k <= 7; k++) box.classList.remove('sh-fit' + k); delete box._fitLast; return; }
    if(typeof box.querySelector !== 'function') return;   /* no layout to measure (node tests) */
    const body = box.querySelector('.sh-body'), fb = box.querySelector('.sh-fb');
    if(!body || typeof body.getClientRects !== 'function' || !body.getClientRects().length) return;
    const over = () => body.scrollHeight > body.clientHeight + 1 || (!!fb && fb.scrollHeight > fb.clientHeight + 1);
    for(let k = 1; k <= 7 && over(); k++){
      if(k === 7 && !box.classList.contains('sh-fit7') && typeof box._fitLast === 'function') box._fitLast();
      box.classList.add('sh-fit' + k);
    }
  },
  _refit(){ document.querySelectorAll('main > section.on .sh-round').forEach(b => Engine._fit(b)); },

  /* ---------- start: progress table, tabs, the chapter shell ---------- */
  start(cfg){
    cfg = cfg || {};
    if(cfg.id) window.PG_ID = cfg.id;
    if(cfg.rows) window.PG_ROWS = cfg.rows;
    const kid = cfg.kid || (typeof PG_KID !== 'undefined' ? PG_KID : null) || null;
    Engine.kid = kid === 'totX' ? null : kid;   /* 'totX' is the _template.html placeholder: a page that never set its kid has none */
    if(!document.getElementById('pg')) document.body.insertAdjacentHTML('afterbegin', Engine.html.pg());
    window.PG = Engine._makePG();
    /* final boss slot (filled by the reward UI), only when rewards.js is loaded: before the tabs are wired and the phone menu is built.
       Its own ids (fboss, fbossBox) never clash with page content such as a page's own #boss game. */
    const pTab = $('#tabs button[data-t="parent"]'), pSec = document.getElementById('parent');
    const boss = !!window.Rewards && !!(document.getElementById('quizBox') || document.getElementById('tfBox')) && !!pTab && !!pSec;
    if(boss){
      pTab.insertAdjacentHTML('beforebegin', '<button data-t="fboss">👹 Τελικό τέρας</button>');
      pSec.insertAdjacentHTML('beforebegin', '<section id="fboss"><div class="card" id="fbossBox"></div></section>');
    }
    Engine._groupTabs();   /* after the boss tab exists, before the phone menu copies the tab row */
    if(window.Rewards){
      const file = location.pathname.split('/').pop(), h1 = document.querySelector('h1');
      const o = {pageId: PG_ID, title: h1 ? h1.textContent.trim() : '', progress: PG.store(),
        rows: PG_ROWS.concat(boss ? [['_boss','👹 Τελικό τέρας','boss']] : [])};
      if(/^dim[\w-]+\.html$/.test(file)) o.file = file;
      if(Engine.kid) o.kid = Engine.kid;
      try{ Rewards.onPageOpen(o); }catch(e){ console.error(e); }
    }
    $$('#tabs button').forEach(b => b.onclick = () => {
      /* the learning path (W3): a locked step never opens, from any control (tile, rail row, «Συνέχισε», a page button);
         the tap says what opens it */
      if(Engine.shell.locked(b.dataset.t)){Engine.shell.why(b.dataset.t);return}
      $$('#tabs button').forEach(x => x.classList.toggle('on', x === b));
      $$('main section').forEach(s => s.classList.toggle('on', s.id === b.dataset.t));
      window.scrollTo({top:0, behavior:Engine._motion()});
      Engine.tabHooks.forEach(f => { try{ f(b.dataset.t); }catch(e){ console.error(e); } });
      /* W8 (A1): every way into an activity is a user's tap or key (tile, rail row, «Συνέχισε», an end screen), so the
         focus follows it to the activity's heading instead of staying on the control that is now hidden */
      try{ Engine.shell._focusView(b.dataset.t); }catch(e){ console.error(e); }
    });
    /* the shell replaces the page header, the tab row and the old phone bar; the home link is its back button (see Engine.shell) */
    try{ Engine.shell.init(); }catch(e){ console.error(e); }
    Engine._mobile();
    try{ window.RewardsUI && RewardsUI.init && RewardsUI.init(); }catch(e){ console.error(e); }
    try{ Engine.shell.sound(); }catch(e){ console.error(e); }
    try{ Engine.shell.refresh(); }catch(e){ console.error(e); }
    return window.PG;
  },

  /* ---------- tab groups: 0 «Μαθαίνω», 1 «Παίζω», 2 «Δοκιμάζομαι», 3 the parent tab (apart, no label) ----------
     By data-t only. A page's own game may use data-t="boss" (dim3 en01c): that is a game; the final boss is "fboss". */
  tabGroupNames: ['Μαθαίνω', 'Παίζω', 'Δοκιμάζομαι'],
  _tabGroup(t){ return t==='sum'||t==='fc' ? 0 : t==='quiz'||t==='tf'||t==='fboss' ? 2 : t==='parent' ? 3 : 1; },
  /* reorders #tabs by group (page order kept inside a group) and, when two or more named groups have tabs, wraps each
     in <div class="tabgrp" role="group" aria-label> whose first child <span class="tabhead"> holds the visible label
     (aria-hidden, not a button) and the group's first tab, so a label never ends a row alone; #tabs gets class "grouped" */
  _groupTabs(){
    const box = document.getElementById('tabs');
    if(!box) return;
    const g = b => Engine._tabGroup(b.dataset.t), names = Engine.tabGroupNames;
    const tabs = [...box.querySelectorAll('button')].map((b,i) => [g(b), i, b]).sort((x,y) => x[0]-y[0] || x[1]-y[1]);
    const labelled = new Set(tabs.map(x => x[0]).filter(k => k < 3)).size > 1;
    box.classList.toggle('grouped', labelled);
    let grp = null, cur = -1;
    tabs.forEach(([k,,b]) => {
      if(!labelled || k === 3){ box.appendChild(b); return; }
      if(k !== cur){
        cur = k;
        grp = document.createElement('div'); grp.className = 'tabgrp'; grp.setAttribute('role','group'); grp.setAttribute('aria-label', names[k]);
        const head = document.createElement('span'); head.className = 'tabhead';
        head.innerHTML = `<span class="tablbl" aria-hidden="true">${names[k]}</span>`;
        head.appendChild(b); grp.appendChild(head); box.appendChild(grp);
      } else grp.appendChild(b);
    });
  },

  /* ---------- section markup for pages built from data ---------- */
  html: {
    pg(){ return `<div id="pg"><button id="pgBtn" aria-label="Πρόοδος">📊 <span id="pgPct">0%</span></button>
<div id="pgPanel"><h4>Η πρόοδός μου</h4><div class="pgall" id="pgAll"></div><div id="pgRows"></div>
<div class="pgfoot"><span class="note">Αποθηκεύεται σε αυτόν τον browser</span><button id="pgReset">Μηδενισμός</button></div></div></div>`; },
    fc(filters){
      const f = filters && filters.length ? `<div class="seg" id="fcFilter"><button data-c="all" class="on">Όλες</button>${filters.map(([k,l]) => `<button data-c="${k}">${l}</button>`).join('')}</div>` : '';
      return `<h2>Κάρτες ερωτήσεων</h2>
  <div class="row">${f}<button class="btn ghost" id="fcShuffle">🔀 Ανακάτεμα</button></div>
  <div class="row" style="margin-top:10px;justify-content:space-between"><span class="score" id="fcCount"></span><span class="score" id="fcKnown"></span></div>
  <div class="prog"><div id="fcProg" style="width:0"></div></div>
  <div class="fc-wrap"><div class="fc" id="fcCard">
    <div class="face front"><span class="tag" id="fcTag"></span><div class="big" id="fcQ"></div><div class="hint">πάτα την κάρτα για την απάντηση</div></div>
    <div class="face back"><span class="tag" id="fcTag2"></span><div class="ans" id="fcA"></div><div class="extra" id="fcX"></div></div>
  </div></div>
  <div class="row" style="justify-content:center">
    <button class="btn ghost" id="fcPrev">◀ Πίσω</button><button class="btn later" id="fcNo">Όχι ακόμα</button><button class="btn ok" id="fcYes">Το ήξερα ✓</button><button class="btn ghost" id="fcNext">Επόμενη ▶</button>
  </div>
  <div class="row" style="justify-content:center;margin-top:10px"><button class="btn ghost" id="fcRetry">🔁 Επανάληψη λαθών</button></div>`; },
    quiz(){ return `<h2>Κουίζ πολλαπλής επιλογής</h2><div class="card" id="quizBox"></div>`; },
    tf(){ return `<h2>Σωστό ή Λάθος;</h2><p class="muted">Κάθε σωστή απάντηση στη σειρά ανεβάζει το 🔥.</p><div class="card" id="tfBox"></div>`; }
  },

  /* where the deck opens: the first card not rated yet, so a child who left halfway goes on from there (rated as the gate of
     the games counts it, Rewards.pathState: the path's ratings and the known cards); the first card when none or all are, or
     after «Μηδενισμός», which keeps the path and clears the list of the cards row */
  _cardSeen(progress){
    const R=window.Rewards,list=progress&&typeof progress==='object'&&progress.cards?progress.cards.list:null;
    return R&&typeof R.pathOf==='function'&&Array.isArray(list)?{known:new Set(list),seen:new Set([...(R.pathOf(progress).rated||[]),...list])}:null;
  },
  _cardStart(n,progress){
    const c=Engine._cardSeen(progress);
    if(c)for(let i=0;i<n;i++)if(!c.seen.has(i))return i;
    return 0;
  },
  /* the cards rated «Όχι ακόμα»: rated and not known, so «Επανάληψη λαθών» has them after a reload too */
  _cardsNotYet(n,progress){
    const c=Engine._cardSeen(progress);
    return c?[...c.seen].filter(i=>i<n&&!c.known.has(i)):[];
  },

  /* ---------- flashcards: cards = [[cat, question, answer, extra], ...] ---------- */
  flashcards(o){
    const CARDS = o.cards, TAGS = o.tags || {};
    const tagOf = c => TAGS[c[0]] || [String(c[0]).toUpperCase(), 'pi'];
    let fcDeck=[],fcI=0,fcCat='all',fcKnown=new Set(((PG.get('cards')||{}).list||[]).filter(i=>i<CARDS.length)),fcWrong=new Set(Engine._cardsNotYet(CARDS.length,PG.store())),fcSeen=false;
    const fcFiltered=()=>CARDS.map((c,i)=>i).filter(i=>fcCat==='all'||CARDS[i][0]===fcCat);
    /* self-rating needs the answer seen: both buttons stay disabled until the current card is flipped once */
    const fcRate=on=>{fcSeen=on;$('#fcYes').disabled=$('#fcNo').disabled=!on};
    const line=Engine._fcFrame();   /* the page's #fc markup on the activity frame; the deck's progress line */
    function fcBuild(l){fcDeck=l;fcI=0;fcShow()}
    /* W8: only the face on view is read (the other is aria-hidden), so the card's name is its question, or its answer once flipped */
    const fcFaces=()=>{const up=$('#fcCard').classList.contains('flip');$$('#fcCard .face').forEach(f=>f.setAttribute('aria-hidden',String(f.classList.contains('back')!==up)))};
    function fcShow(){
      const card=$('#fcCard'),was=card.classList.contains('flip');card.classList.remove('flip');fcRate(false);fcFaces();
      const paint=()=>{
        if(!fcDeck.length){$('#fcQ').textContent='Τέλεια! Δεν υπάρχουν λάθη για επανάληψη 🎉';['#fcA','#fcX','#fcCount','#fcKnown'].forEach(s=>$(s).textContent='');$('#fcTag').innerHTML=$('#fcTag2').innerHTML='';
          if(line){line.firstChild.style.width='0%';line.setAttribute('aria-label','Καμία κάρτα')}return}
        const c=CARDS[fcDeck[fcI]],t=tagOf(c),tg=`<span class="pill ${t[1]}">${t[0]}</span>`;
        $('#fcQ').innerHTML=c[1];$('#fcA').innerHTML=c[2];$('#fcX').innerHTML=c[3]||'';$('#fcTag').innerHTML=$('#fcTag2').innerHTML=tg;
        /* the deck's progress: the line and «12 από 34»; what is known and not yet, each with its icon and a word */
        $('#fcCount').textContent=`${fcI+1} από ${fcDeck.length}`;
        if(line){line.firstChild.style.width=Engine.shell.pct(fcI+1,fcDeck.length)+'%';line.setAttribute('aria-label',`Κάρτα ${fcI+1} από ${fcDeck.length}`)}
        const k=fcDeck.filter(i=>fcKnown.has(i)).length,w=fcDeck.filter(i=>fcWrong.has(i)).length;
        $('#fcKnown').innerHTML=`<span class="fc-k">${Engine._icon('tick')}<span class="sh-sr">Τις ήξερα: </span>${k}</span><span class="fc-w">${Engine._icon('cross')}<span class="sh-sr">, όχι ακόμα: </span>${w}</span>`;
        $('#fcProg').style.width=(k/fcDeck.length*100)+'%';
      };
      was?setTimeout(paint,300):paint();
    }
    const fcFlip=()=>{$('#fcCard').classList.toggle('flip');fcFaces();if(fcDeck.length)fcRate(true)};
    $('#fcCard').onclick=fcFlip;
    $('#fcCard').tabIndex=0;$('#fcCard').setAttribute('role','button');$('#fcCard').setAttribute('data-primary','');
    $('#fcCard').setAttribute('aria-describedby','fcCount');
    $('#fcCard').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fcFlip()}};
    /* Space or Enter flips the card also while the focus rests on nothing (the page itself) with the cards open; the left and
       right arrows go to the previous and next card (W8, A1), from the card, the page or a button of the cards (not the
       category filter, whose arrows move between its choices) */
    document.addEventListener('keydown',e=>{
      if(Engine.shell.view!=='fc'||e.altKey||e.ctrlKey||e.metaKey)return;
      const bare=e.target===document.body||e.target===document.documentElement,t=e.target;
      if((e.key===' '||e.key==='Enter')&&bare){e.preventDefault();fcFlip();return}
      const d={ArrowLeft:'#fcPrev',ArrowRight:'#fcNext'}[e.key];
      if(!d||!(bare||(t.closest&&t.closest('#fc')&&!t.closest('.seg,input,select,textarea'))))return;
      const b=$(d);if(b){e.preventDefault();b.click();if(t===$('#fcCard')||bare)$('#fcCard').focus({preventScroll:true})}});
    $('#fcNext').onclick=()=>{if(fcDeck.length){fcI=(fcI+1)%fcDeck.length;fcShow()}};
    $('#fcPrev').onclick=()=>{if(fcDeck.length){fcI=(fcI-1+fcDeck.length)%fcDeck.length;fcShow()}};
    /* the learning path (W3): the number of cards, and each rating («Το ήξερα» or «Όχι ακόμα») counts as rated once */
    Engine.shell.cardCount(CARDS.length);
    $('#fcYes').onclick=()=>{if(!fcDeck.length||!fcSeen)return;const i=fcDeck[fcI];Engine.shell.cardRated(i);fcKnown.add(i);fcWrong.delete(i);PG.setList('cards',[...fcKnown],CARDS.length);$('#fcNext').onclick()};
    $('#fcNo').onclick=()=>{if(!fcDeck.length||!fcSeen)return;const i=fcDeck[fcI];Engine.shell.cardRated(i);fcWrong.add(i);fcKnown.delete(i);PG.setList('cards',[...fcKnown],CARDS.length);$('#fcNext').onclick()};
    $('#fcShuffle').onclick=()=>fcBuild(shuffle(fcDeck.length?fcDeck:fcFiltered()));
    $('#fcRetry').onclick=()=>fcBuild(shuffle(fcFiltered().filter(i=>fcWrong.has(i))));
    $$('#fcFilter button').forEach(b=>b.onclick=()=>{$$('#fcFilter button').forEach(x=>x.classList.toggle('on',x===b));fcCat=b.dataset.c;fcBuild(fcFiltered())});
    fcBuild(fcFiltered());fcI=Engine._cardStart(CARDS.length,PG.store());fcShow();
  },

  /* the cards on the activity frame (round 3, W6b; the contract at the top of engine-ui.css). The 8 hand-written pages carry
     static #fc markup and Engine.html.fc writes the same: the elements are moved (never rebuilt, so their ids and handlers
     stay) into the progress row (previous, the deck's line, «12 από 34», known and not yet, next), a tools row (the
     category filter, shuffle, retry of the not yet), the body (the card, filling it, and any note of the page) and the
     action row («Όχι ακόμα» and «Το ήξερα»). The old known bar (.prog) stays, hidden. Returns the deck's line, or null. */
  _fcFrame(){
    const g=id=>document.getElementById(id),card=g('fcCard'),sec=card&&typeof card.closest==='function'?card.closest('section'):null;
    if(!sec||typeof document.createElement!=='function')return null;
    if(sec.classList.contains('fc-frame'))return sec.querySelector('.fc-line');
    const ic=Engine._icon,mk=(tag,cls)=>{const e=document.createElement(tag);e.className=cls;return e};
    const btn=(id,cls,html,label)=>{const b=g(id);if(!b)return null;b.className=cls;b.type='button';b.innerHTML=html;if(label)b.setAttribute('aria-label',label);return b};
    const prev=btn('fcPrev','fc-nav',ic('back'),'Προηγούμενη κάρτα'),next=btn('fcNext','fc-nav',ic('skip'),'Επόμενη κάρτα');
    btn('fcShuffle','fc-tool',`${ic('shuffle')}<span class="fc-tl">Ανακάτεμα</span>`);
    btn('fcRetry','fc-tool',`${ic('retry')}<span class="fc-tl">Επανάληψη λαθών</span>`);
    btn('fcNo','fc-rate',`${ic('cross')}Όχι ακόμα`);btn('fcYes','fc-rate',`${ic('tick')}Το ήξερα`);
    const top=mk('div','sh-prog fc-top'),line=mk('div','sh-line fc-line'),tools=mk('div','fc-tools'),body=mk('div','sh-body fc-body'),acts=mk('div','sh-actions fc-acts');
    line.setAttribute('role','img');line.innerHTML='<span></span>';
    const count=g('fcCount'),known=g('fcKnown');
    if(count)count.classList.add('sh-count');
    if(known)known.classList.add('fc-known');
    [prev,line,count,known,next].forEach(e=>{if(e)top.appendChild(e)});
    /* G2: the filter strip scrolls sideways when wider than its room; engine-ui.css fades each edge that has more behind it
       (taken before the move below takes it out of the document) */
    const fl=g('fcFilter');
    ['fcFilter','fcShuffle','fcRetry'].forEach(id=>{const e=g(id);if(e)tools.appendChild(e)});
    if(fl){const cut=()=>{const m=fl.scrollWidth-fl.clientWidth;fl.classList.toggle('fc-cutl',m>1&&fl.scrollLeft>1);fl.classList.toggle('fc-cutr',m>1&&fl.scrollLeft<m-1)};
      fl.addEventListener('scroll',cut,{passive:true});window.addEventListener('resize',cut);Engine.onTab(t=>{if(t==='fc')cut()});
      if(document.fonts&&document.fonts.ready)document.fonts.ready.then(cut);cut()}
    const wrap=card.closest('.fc-wrap')||card;body.appendChild(wrap);
    ['fcNo','fcYes'].forEach(id=>{const e=g(id);if(e)acts.appendChild(e)});
    const old=[...sec.children],h2=sec.querySelector(':scope > h2');
    sec.insertBefore(top,h2?h2.nextSibling:sec.firstChild);
    top.after(tools,body,acts);
    /* what is left of the page's markup: the old bar hidden, emptied rows gone, anything else (a note) under the card */
    for(const e of old){
      if(e===h2||body.contains(e))continue;
      if(e.classList.contains('prog')){e.hidden=true;body.appendChild(e);continue}
      if(!e.children.length&&!e.textContent.trim()){e.remove();continue}
      body.appendChild(e);
    }
    sec.classList.add('sh-frame','fc-frame');
    return line;
  },

  /* ---------- quiz: items = [[question, [correct, wrong, wrong, wrong], explanation], ...] ---------- */
  quiz(o){
    const Q = o.items, N = o.n || 10;
    Engine.bossItems.quiz = Q;
    Engine._round($('#quizBox'));
    let qz;
    /* retry: the misses of the round before (audit L4); a retry round records every answer but never ends a reward round.
       res: right (true) or wrong (false) per question answered, for the progress line only */
    function qzStart(retry){qz={list:retry?Engine._retryList(retry):shuffle(Q).slice(0,N),i:0,score:0,answered:false,miss:[],retry:!!retry,res:[],stk:Engine._stk.length};qzShow()}
    function qzShow(){
      const box=$('#quizBox');
      Engine._fit(box,true);
      if(qz.i>=qz.list.length){
        const s=qz.score,L=qz.list.length,r=s/L,m=qz.miss;Engine._cheer(r>=.7);
        if(!qz.retry){Engine.shell.roundEnd('quiz',s,L);Engine._reward('onRoundEnd',{pageId:PG_ID,kid:Engine.kid,kind:'quiz',score:s,total:L})}
        /* the end screen (Engine._endScreen): a retry round is practice (a tag, no stars), as before it never ends a reward round */
        const end={tab:'quiz',head:Engine.result(s,L),again:{id:'qzAgain',label:'Νέο κουίζ'},retry:m.length?{id:'qzRetry',n:m.length}:null,
          misses:m.map(item=>({kind:'quiz',item})),rights:qz.list.filter((it,k)=>qz.res[k]===true).map(item=>({kind:'quiz',item}))};
        box.innerHTML=Engine._endScreen(Object.assign(end,qz.retry?{stars:null,tag:Engine._retryTag,lines:[['sh-end-say',Engine._retryLine(s,L,m.length)]]}
          :{stars:Engine.roundStars(s,L),sticker:Engine._stickerSince(qz.stk,'quiz'),lines:[['sh-end-say',r>=.9?'Εξαιρετικά!':r>=.7?'Πολύ καλά! Λίγη επανάληψη ακόμα.':'Ας δούμε ξανά τις κάρτες και ξαναπροσπαθούμε!'],['sh-end-next',Engine.nextStar(s,L)]]}));
        $('#qzAgain').onclick=()=>qzStart();$$('#quizBox .rv-retry').forEach(b=>b.onclick=()=>qzStart(m));Engine._endOn(box);return;
      }
      const [q,opts,ex]=qz.list[qz.i],correct=opts[0],sh=shuffle(opts),n=qz.list.length;
      qz.answered=false;
      /* the activity frame (engine-ui.css): progress line, the question and its options (data-primary), the feedback panel */
      box.innerHTML=`${qz.retry?Engine._retryTag:''}<div class="sh-prog">${Engine._segs('qzSegs',qz.res,n,qz.i)}<span class="score">Ερώτηση ${qz.i+1} / ${n}</span><span class="score" id="qzScore">Σκορ: ${qz.score}</span></div>
  <div class="sh-body"><div class="big" style="margin:12px 0">${q}</div>
  <div class="sh-opts" data-primary>${sh.map((o,k)=>`<button class="opt" data-k="${k}">${String.fromCharCode(945+k)}) ${o}</button>`).join('')}</div></div><div id="qzEx" class="sh-fb"></div>`;
      $$('#quizBox .opt').forEach(b=>b.onclick=()=>{
        if(qz.answered)return;qz.answered=true;Engine.seenItems.add(qz.list[qz.i]);
        const ok=sh[b.dataset.k]===correct;if(ok)qz.score++;else Engine._missOnce(qz.miss,qz.list[qz.i]);$('#qzScore').textContent=`Σκορ: ${qz.score}`;PG.hit('quiz',ok);Engine._cheer(ok);
        qz.res[qz.i]=ok;$('#qzSegs').outerHTML=Engine._segs('qzSegs',qz.res,n,qz.i);
        $$('#quizBox .opt').forEach(x=>{x.disabled=true;if(sh[x.dataset.k]===correct){x.classList.add('right');x.innerHTML+=Engine._okMark(true)}});
        if(!ok){b.classList.add('wrong');b.innerHTML+=Engine._okMark(false)}
        $('#qzEx').innerHTML=`<div class="expl">${Engine._verdict(ok,ok?'Σωστά! ':'Όχι ακριβώς. ')}${ex||''}</div><div class="sh-fbnav"><button class="btn sh-primary" id="qzNext">${qz.i+1<n?'Επόμενη':'Αποτέλεσμα'}</button></div>`;
        Engine._fit(box);   /* the answered state fits the frame (G2) */
        $('#qzNext').onclick=()=>{qz.i++;qzShow()};try{$('#qzNext').focus({preventScroll:true})}catch(e){}   /* the options are disabled now: the focus leads on (W8) */
      });
    }
    qzStart();
  },

  /* ---------- true/false: items = [[statement, true|false, explanation], ...] ---------- */
  truefalse(o){
    const TF = o.items, N = o.n || 12;
    Engine.bossItems.tf = TF;
    Engine._round($('#tfBox'));
    let tf;
    /* retry: as in the quiz (audit L4); res: as in the quiz */
    function tfStart(retry){tf={list:retry?Engine._retryList(retry):shuffle(TF).slice(0,N),i:0,score:0,streak:0,best:0,done:false,t0:Date.now(),miss:[],retry:!!retry,res:[],stk:Engine._stk.length};tfShow()}
    function tfShow(){
      const box=$('#tfBox');
      Engine._fit(box,true);
      if(tf.i>=tf.list.length){
        const sec=Math.round((Date.now()-tf.t0)/1000),L=tf.list.length,r=tf.score/L,m=tf.miss;Engine._cheer(r>=.75);
        if(!tf.retry){Engine.shell.roundEnd('tf',tf.score,L);Engine._reward('onRoundEnd',{pageId:PG_ID,kid:Engine.kid,kind:'tf',score:tf.score,total:L})}
        /* the end screen, as the quiz's; the best streak and the time in a line of their own */
        const end={tab:'tf',head:Engine.result(tf.score,L),again:{id:'tfAgain',label:'Ξανά'},retry:m.length?{id:'tfRetry',n:m.length}:null,
          misses:m.map(item=>({kind:'tf',item})),rights:tf.list.filter((it,k)=>tf.res[k]===true).map(item=>({kind:'tf',item}))};
        box.innerHTML=Engine._endScreen(Object.assign(end,tf.retry?{stars:null,tag:Engine._retryTag,lines:[['sh-end-say',Engine._retryLine(tf.score,L,m.length)]]}
          :{stars:Engine.roundStars(tf.score,L,Engine.CUTS_TF),sticker:Engine._stickerSince(tf.stk,'tf'),lines:[['sh-end-next',Engine.nextStar(tf.score,L,Engine.CUTS_TF)],
            ['sh-end-fact',`${Engine._icon('flame')}Καλύτερο σερί: ${tf.best}, χρόνος: ${sec} δευτερόλεπτα`]]}));
        $('#tfAgain').onclick=()=>tfStart();$$('#tfBox .rv-retry').forEach(b=>b.onclick=()=>tfStart(m));Engine._endOn(box);return;
      }
      const [s]=tf.list[tf.i],n=tf.list.length;tf.done=false;
      const tfTop=()=>{$('#tfScore').textContent=`${tf.i+1} / ${n}, Σκορ ${tf.score}`;$('#tfStreak').innerHTML=`${Engine._icon('flame')}<span class="sh-sr">Σερί </span>${tf.streak}`};
      box.innerHTML=`${tf.retry?Engine._retryTag:''}<div class="sh-prog">${Engine._segs('tfSegs',tf.res,n,tf.i)}<span class="score" id="tfScore"></span><span class="streak" id="tfStreak"></span></div>
   <div class="sh-body"><div class="big" style="text-align:center;margin:26px 6px 6px">${s}</div>
   <div class="tf sh-tf" data-primary><button class="btn ok" id="tfT">${Engine._icon('tick')}Σωστό</button><button class="btn bad" id="tfF">${Engine._icon('cross')}Λάθος</button></div></div><div id="tfEx" class="sh-fb"></div>`;
      tfTop();
      const ans=v=>{if(tf.done)return;tf.done=true;Engine.seenItems.add(tf.list[tf.i]);const [,truth,ex]=tf.list[tf.i],ok=v===truth;
        if(ok){tf.score++;tf.streak++;tf.best=Math.max(tf.best,tf.streak)}else{tf.streak=0;Engine._missOnce(tf.miss,tf.list[tf.i])}tfTop();PG.hit('tf',ok);Engine._cheer(ok);
        tf.res[tf.i]=ok;$('#tfSegs').outerHTML=Engine._segs('tfSegs',tf.res,n,tf.i);
        $('#tfT').disabled=$('#tfF').disabled=true;
        $('#tfEx').innerHTML=`<div class="expl">${Engine._verdict(ok,ok?'Μπράβο!':'Ωπ!')} Η πρόταση είναι <b>${truth?'Σωστή':'Λάθος'}</b>. ${ex||''}</div><div class="sh-fbnav"><button class="btn sh-primary" id="tfNext">Επόμενη</button></div>`;
        Engine._fit(box);   /* the answered state fits the frame (G2) */
        $('#tfNext').onclick=()=>{tf.i++;tfShow()};try{$('#tfNext').focus({preventScroll:true})}catch(e){}};
      $('#tfT').onclick=()=>ans(true);$('#tfF').onclick=()=>ans(false);
    }
    tfStart();
  },

  /* ---------- generic games on the activity frame (round 3, W5g; the contract at the top of engine-ui.css) ----------
     Engine.build gives each engine game a section that is the frame and a box (#<id>Box) that is its column. _gframe draws
     the column once: the progress line row (.sh-prog: the line drawn, «2 από 5», the score, and a «new game» button where the
     game has one), the content (.sh-body: the page's intro first, then the game in data-r="body"), the action row (.sh-actions,
     data-r="act", hidden while empty) and the feedback panel (.sh-fb, data-r="fb"; read by Engine.shell._a11y through #shLive). Returns R(name), the
     data-r finder of the box. Styles: the section «fit generic games» of engine-content.css. */
  _gframe(box, o, type, extra){
    box.classList.add('gm', 'gm-'+type, 'sh-col');
    const sec = typeof box.closest === 'function' ? box.closest('section') : null;
    if(sec) sec.classList.add('sh-frame', 'gm-frame');
    box.innerHTML = `<div class="sh-prog"><div class="sh-line" data-r="line" role="img"><span></span></div><span class="sh-count" data-r="count"></span><span class="score" data-r="score"></span>${extra||''}</div>`
      + `<div class="sh-body">${o.intro ? `<p class="gm-intro">${o.intro}</p>` : ''}<div class="gm-main" data-r="body"></div></div>`
      + '<div class="sh-actions" data-r="act"></div><div class="sh-fb" data-r="fb"></div>';
    return n => box.querySelector(`[data-r="${n}"]`);
  },
  /* the progress line: d of n filled; words, what a screen reader hears (default «d από n») */
  _gline(R, d, n, words){
    const l = R('line');
    if(!l) return;
    l.firstChild.style.width = Engine.shell.pct(d, n) + '%';
    l.setAttribute('aria-label', words || `${d} από ${n}`);
  },
  /* the feedback panel: the verdict word (tick or cross), the explanation, then one full-width button (its data-r, its words,
     its icon after the words); ok null: no verdict word. Returns the button. */
  _gfb(R, ok, html, r, words, icon){
    R('act').innerHTML = '';
    R('fb').innerHTML = `<div class="expl">${ok === null ? '' : Engine._verdict(ok, ok ? 'Σωστά!' : 'Όχι ακριβώς.') + ' '}${html}</div>`
      + `<div class="sh-fbnav"><button type="button" class="btn sh-primary" data-r="${r}">${words}${Engine._icon(icon)}</button></div>`;
    return R(r);
  },
  /* the action row's one button (the primary control there: data-primary), '' empties the row */
  _gact(R, r, words, icon, off){
    R('act').innerHTML = r ? `<button type="button" class="sh-primary" data-r="${r}" data-primary${off ? ' disabled' : ''}>${Engine._icon(icon)}${words}</button>` : '';
    return r ? R(r) : null;
  },

  /* a finished matching board counts one answer per pair: all right within the move limit, fewer the slower (never under half,
     never all), so a first board earns stars at once, a slow one still a star */
  _memoryRight(pairs,moves,good){return moves<=good?pairs:Math.max(Math.ceil(pairs/2),Math.min(pairs-1,Math.round(pairs*good/moves)))},
  memoryDone(key,pairs,moves,good){
    const right=Engine._memoryRight(pairs,moves,good);
    PG.hits(key,Array.from({length:pairs},(_,i)=>Math.ceil((i+1)*right/pairs)>Math.ceil(i*right/pairs)));   // spread evenly: a run of wrong ones at one end would leave the window of recent answers first
    return moves<=good;
  },

  /* ---------- memory: pairs = [[left, right], ...]; 6 random pairs per game ---------- */
  memory(o){
    const box=$(o.el), key=o.key||'mem', N=o.n||6, good=o.goodMoves||N*2;
    const R=Engine._gframe(box,o,'mem',`<button type="button" class="gm-new" data-r="new" aria-label="Νέο παιχνίδι" title="Νέο παιχνίδι">${Engine._icon('shuffle')}</button>`);
    R('body').innerHTML='<div class="mem" data-r="grid" data-primary></div>';
    let m;
    const info=()=>{const w=`${m.done} από ${m.pairs.length} ζευγάρια`;R('count').textContent=w;R('score').textContent=`Κινήσεις: ${m.moves}`;Engine._gline(R,m.done,m.pairs.length,w)};
    /* a card is a button: face down it is «Κάρτα n» for a screen reader, face up its text; a found pair gets a tick, a
       pair that does not match a cross while it shows */
    const face=(d,up)=>{if(up)d.removeAttribute('aria-label');else d.setAttribute('aria-label',`Κάρτα ${+d.dataset.k+1}`)};
    function start(){
      const pairs=shuffle(o.pairs).slice(0,N);
      const cards=shuffle(pairs.flatMap((p,i)=>[{id:i,t:p[0]},{id:i,t:p[1]}]));
      m={cards,pairs,open:[],done:0,moves:0,lock:false};
      R('grid').innerHTML=cards.map((c,k)=>`<button type="button" class="mcard" data-k="${k}" aria-label="Κάρτα ${k+1}"><span class="mtx">${c.t}</span></button>`).join('');
      R('grid').querySelectorAll('.mcard').forEach(d=>d.onclick=()=>tap(+d.dataset.k,d));
      const pl=R('pairs');if(pl)pl.remove();R('grid').hidden=false;
      R('fb').innerHTML='';info();
    }
    function tap(k,d){
      if(m.lock||d.classList.contains('up')||d.classList.contains('done'))return;
      d.classList.add('up');face(d,true);m.open.push([k,d]);if(m.open.length<2)return;
      m.moves++;Engine.shell.played();   /* a pair turned over is a checked answer (the learning path) */const [[k1,d1],[k2,d2]]=m.open;m.open=[];
      if(m.cards[k1].id===m.cards[k2].id){[d1,d2].forEach(x=>{x.classList.add('done');x.setAttribute('aria-disabled','true');x.insertAdjacentHTML('beforeend',Engine._okMark(true))});m.done++;
        if(m.done===m.pairs.length){const ok=Engine.memoryDone(key,m.pairs.length,m.moves,good);Engine._cheer(ok);info();
          const say=m.moves<=Math.round(good*.75)?'🏆 Μνήμη ελέφαντα!':ok?'🌟 Πολύ καλά!':'💪 Ξαναπροσπάθησε με λιγότερες!';
          /* the end: the pairs as a list in place of the cards, the verdict and «Νέο παιχνίδι» in the panel */
          R('grid').hidden=true;R('body').insertAdjacentHTML('beforeend',`<div class="mem-end" data-r="pairs"><p class="gm-lbl">Τα ζευγάρια:</p><ul class="mem-pairs">${m.pairs.map(p=>`<li>${p[0]} ↔ ${p[1]}</li>`).join('')}</ul></div>`);
          Engine._gfb(R,null,Engine._verdict(ok,`Τελείωσες σε ${m.moves} κινήσεις! ${say}`),'again','Νέο παιχνίδι','shuffle').onclick=start;
          return}}
      else{m.lock=true;[d1,d2].forEach(x=>{x.classList.add('miss');x.insertAdjacentHTML('beforeend',Engine._okMark(false))});
        setTimeout(()=>{[d1,d2].forEach(x=>{x.classList.remove('up','miss');const mk=x.querySelector('.sh-mark');if(mk)mk.remove();face(x,false)});m.lock=false},900)}
      info();
    }
    R('new').onclick=start;start();
  },

  /* ---------- sort into bins: bins = [[id, icon, label], ...]; items = [[text, binId, why], ...] ---------- */
  sort(o){
    const box=$(o.el), key=o.key||'sort', N=o.n||10;
    const R=Engine._gframe(box,o,'sort','<span class="streak" data-r="streak"></span>');
    R('body').innerHTML=`<div class="item-card" data-r="item"></div><div class="bins" data-r="bins" data-primary style="--bins:${Math.min(o.bins.length,3)}">${o.bins.map(b=>`<button type="button" class="bin" data-b="${b[0]}"><span class="ico">${b[1]}</span><span class="bin-t">${b[2]}</span></button>`).join('')}</div>`;
    let s;
    const bins=()=>[...box.querySelectorAll('.bin')];
    function start(){s={list:shuffle(o.items).slice(0,N),i:0,score:0,streak:0,done:false};show()}
    const sortTop=()=>{const L=s.list.length;R('count').textContent=s.i<L?`${s.i+1} από ${L}`:'';R('score').textContent=`Σκορ: ${s.score}`;
      R('streak').innerHTML=`${Engine._icon('flame')}<span class="sh-sr">Σερί </span>${s.streak}`;Engine._gline(R,Math.min(s.i,L),L)};
    function show(){
      sortTop();R('fb').innerHTML='';
      bins().forEach(b=>{b.disabled=false;b.classList.remove('right','wrong');const mk=b.querySelector('.sh-mark');if(mk)mk.remove()});
      const end=s.i>=s.list.length;R('bins').hidden=end;
      if(end){R('item').innerHTML=`<span class="emo">${s.score>=s.list.length*.8?'🏆':'💪'}</span>${s.score} / ${s.list.length}`;
        Engine._gact(R,'again','Ξανά','retry').onclick=start;return}
      Engine._gact(R,'');s.done=false;R('item').innerHTML=s.list[s.i][0];
    }
    bins().forEach(b=>b.onclick=()=>{
      if(!s||s.done||s.i>=s.list.length)return;s.done=true;const [,right,why]=s.list[s.i],ok=b.dataset.b===right;
      if(ok){s.score++;s.streak++}else s.streak=0;sortTop();PG.hit(key,ok);Engine._cheer(ok);
      /* the bin tapped and, after a wrong one, the right bin: a tick or a cross with the colour, until «Επόμενο» */
      bins().forEach(x=>{x.disabled=true;const r=x.dataset.b===right;if(x===b||r){x.classList.add(r?'right':'wrong');x.insertAdjacentHTML('beforeend',Engine._okMark(r))}});
      const rb=o.bins.find(x=>x[0]===right);
      const nx=Engine._gfb(R,ok,`${ok?'':`Πάει στο «${rb[2]}». `}${why||''}`,'next','Επόμενο','chevron-right');
      nx.onclick=()=>{s.i++;show()};nx.focus({preventScroll:true});
    });
    start();
  },

  /* ---------- blitz: make() returns {q, a, opts:[wrong...]} or pass items like the quiz ---------- */
  blitz(o){
    const box=$(o.el), key=o.key||'blitz', T=o.seconds||60, goal=o.goal||15;
    let st={run:false},timer=null;
    const make=o.make||(()=>{const [q,opts]=pick(o.items);return {q,a:opts[0],opts:opts.slice(1)}});
    const stop=()=>{if(timer){clearInterval(timer);timer=null}st.run=false};
    const R=Engine._gframe(box,o,'blitz');
    const best=()=>((PG.get(key)||{}).list||[]).length;
    function intro(){
      R('count').textContent=`${T} δευτερόλεπτα`;R('count').classList.remove('low');R('score').textContent=`Ρεκόρ: ${best()}`;Engine._gline(R,1,1,`${T} δευτερόλεπτα`);R('fb').innerHTML='';
      R('body').innerHTML=`<div class="gm-mid"><div class="blitz-ico" aria-hidden="true">⏱️</div><p class="big">Έτοιμος;</p><p class="muted">Ρεκόρ σου: <b>${best()}</b> σωστά σε ${T} δευτερόλεπτα. Στόχος: ${goal}.</p></div>`;
      Engine._gact(R,'go','Ξεκίνα!','play').onclick=go;
    }
    function go(){
      stop();st={run:true,t:T,score:0,wrong:0};Engine._gact(R,'');
      R('body').innerHTML='<div class="blitz-q" data-r="q"></div><div class="blitz-opts" data-r="o" data-primary></div>';
      R('score').innerHTML=`${Engine._icon('tick')}<span class="sh-sr">Σωστά: </span>0`;
      tick();next();timer=setInterval(()=>{st.t--;tick();if(st.t<=0)end()},1000);
    }
    /* the time left: the line, and the seconds in words (red and still in words from 10 down) */
    function tick(){const t=Math.max(0,st.t);R('count').textContent=`${t} δευτ.`;R('count').classList.toggle('low',t<=10);Engine._gline(R,t,T,`${t} δευτερόλεπτα`)}
    function next(){
      const c=make(),opts=shuffle([c.a,...shuffle(c.opts).slice(0,3)]);
      R('q').innerHTML=c.q;R('o').innerHTML=opts.map(v=>`<button type="button">${v}</button>`).join('');
      R('o').querySelectorAll('button').forEach((btn,k)=>btn.onclick=()=>{
        if(!st.run||btn.classList.contains('ok')||btn.classList.contains('no'))return;Engine.shell.played();const ok=String(opts[k])===String(c.a);   /* each answer counts for the learning path */
        btn.classList.add(ok?'ok':'no');btn.insertAdjacentHTML('beforeend',Engine._okMark(ok));
        if(ok){st.score++;R('score').innerHTML=`${Engine._icon('tick')}<span class="sh-sr">Σωστά: </span>${st.score}`}
        else{st.wrong++;st.t-=3;tick();R('o').querySelectorAll('button').forEach((x,j)=>{if(String(opts[j])===String(c.a)&&!x.classList.contains('ok')){x.classList.add('ok');x.insertAdjacentHTML('beforeend',Engine._okMark(true))}})}
        if(st.t<=0){end();return}setTimeout(()=>{if(st.run)next()},ok?250:700);
      });
    }
    function end(){
      if(!st.run)return;stop();
      const prev=best(),rec=st.score>prev;if(rec)PG.setList(key,Array(st.score).fill(1),goal);Engine._cheer(rec);
      R('count').textContent='0 δευτ.';
      R('body').innerHTML=`<div class="gm-mid"><div class="blitz-ico" aria-hidden="true">${rec?'🏆':st.score>=goal?'🌟':'💪'}</div><p class="big">${st.score} σωστά!</p><p>${rec?'<b>Νέο ρεκόρ!</b>':`Ρεκόρ: ${prev}`}. Λάθη: ${st.wrong}</p></div>`;
      Engine._gact(R,'again','Ξανά','retry').onclick=go;
    }
    Engine.onTab(t=>{if(st.run&&!box.closest('section.on')){stop();intro()}});
    intro();
  },

  /* ---------- word search: words = ['ΛΕΞΗ', ...] (Greek capitals, no accents) ---------- */
  wordsearch(o){
    const box=$(o.el), key=o.key||'ws', SZ=o.size||10, A='ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
    const R=Engine._gframe(box,o,'ws',`<button type="button" class="gm-new" data-r="new" aria-label="Νέο κρυπτόλεξο" title="Νέο κρυπτόλεξο">${Engine._icon('shuffle')}</button>`);
    R('body').innerHTML=`<p class="gm-lbl">Πάτα το πρώτο και το τελευταίο γράμμα της λέξης.</p><div class="wlist" data-r="list"></div><div class="ws-box"><div class="ws-grid" data-r="grid" data-primary></div></div>`;
    let W;
    function build(){
      for(let tries=0;tries<200;tries++){
        const g=Array.from({length:SZ},()=>Array(SZ).fill('')),placed=[];
        const dirs=[[0,1],[1,0],[1,1]];let ok=true;
        for(const w of shuffle(o.words.filter(w=>w.length<=SZ)).slice(0,o.n||8)){
          let done=false;
          for(let k=0;k<300&&!done;k++){const [dr,dc]=pick(dirs),r=ri(0,SZ-1-dr*(w.length-1)),c=ri(0,SZ-1-dc*(w.length-1));
            if([...w].every((ch,i)=>{const x=g[r+dr*i][c+dc*i];return x===''||x===ch})){[...w].forEach((ch,i)=>g[r+dr*i][c+dc*i]=ch);placed.push({w,cells:[...w].map((_,i)=>(r+dr*i)*SZ+c+dc*i)});done=true}}
          if(!done){ok=false;break}
        }
        if(ok){g.forEach(row=>row.forEach((x,i)=>{if(!x)row[i]=pick([...A])}));return {g,placed}}
      }
    }
    function start(){
      const b=build();W={...b,found:new Set(),sel:[]};
      R('grid').style.gridTemplateColumns=`repeat(${SZ},1fr)`;
      R('grid').innerHTML=b.g.flat().map((ch,i)=>`<div data-i="${i}">${ch}</div>`).join('');
      R('list').innerHTML=b.placed.map(p=>`<span data-w="${p.w}">${p.w}</span>`).join('');R('fb').innerHTML='';info();
      R('grid').querySelectorAll('div').forEach(d=>d.onclick=()=>tap(+d.dataset.i,d));
    }
    const info=()=>{const w=`${W.found.size} από ${W.placed.length} λέξεις`;R('count').textContent=w;Engine._gline(R,W.found.size,W.placed.length,w)};
    function tap(i,d){
      W.sel.push(i);d.classList.add('sel');if(W.sel.length<2)return;
      const [a,b]=W.sel;W.sel=[];
      const hit=W.placed.find(p=>!W.found.has(p.w)&&((p.cells[0]===a&&p.cells[p.cells.length-1]===b)||(p.cells[0]===b&&p.cells[p.cells.length-1]===a)));
      R('grid').querySelectorAll('.sel').forEach(x=>x.classList.remove('sel'));
      PG.hit(key,!!hit);
      if(hit){W.found.add(hit.w);hit.cells.forEach(c=>R('grid').children[c].classList.add('found'));
        const li=R('list').querySelector(`[data-w="${hit.w}"]`);li.classList.add('done');li.insertAdjacentHTML('beforeend',Engine._okMark(true));info();Engine._cheer(true);
        if(W.found.size===W.placed.length)Engine._gfb(R,true,'Τα βρήκες όλα! 🎉','again','Νέο κρυπτόλεξο','shuffle').onclick=start}
    }
    R('new').onclick=start;start();
  },

  /* ---------- order, cloze, source (Ιστορία, Γλώσσα): pure round building and checking, node-tested (tests/games.test.js) ----------
     Texts are page-authored and go in as HTML, as the quiz's do; only the source link is escaped, as an attribute. */
  _txt(v){ return typeof v==='number'&&isFinite(v) ? String(v) : typeof v==='string'&&v.trim() ? v : null; },
  /* a play: n rounds when given, else all of them up to 10, drawn at random */
  _draw(list, n){ return shuffle(list).slice(0, Number.isInteger(n)&&n>0 ? n : 10); },
  /* [correct, wrong, ...] -> {right, wrong: up to 3 distinct wrong texts}, or null with no distinct wrong one */
  _choices(opts){
    if(!Array.isArray(opts)) return null;
    const right=Engine._txt(opts[0]);
    if(right===null) return null;
    const wrong=[...new Set(opts.slice(1).map(Engine._txt).filter(t=>t!==null&&t!==right))].slice(0,3);
    return wrong.length ? {right, wrong} : null;
  },
  _deal(c){ return shuffle([c.right, ...c.wrong]); },
  _isRight(c, text){ return text===c.right; },
  /* order: rounds = [[prompt, [item, ...], why], ...]; an item is a text or [text, caption]; 2 to 7 items, two distinct texts at least */
  _orderRounds(raw){
    return (Array.isArray(raw)?raw:[]).map(r=>{
      if(!Array.isArray(r)||!Array.isArray(r[1])||r[1].length<2||r[1].length>7) return null;
      const items=r[1].map(it=>{const [t,c]=Array.isArray(it)?it:[it],tx=Engine._txt(t);return tx===null?null:{t:tx,c:Engine._txt(c)||''}});
      if(items.includes(null)||new Set(items.map(i=>i.t)).size<2) return null;
      return {prompt:Engine._txt(r[0])||'', items, why:Engine._txt(r[2])||''};
    }).filter(Boolean);
  },
  /* the order shown: item indices that never read as the right order (a valid round has two distinct texts) */
  _orderDeal(round){
    const its=round.items, idx=its.map((_,i)=>i), same=d=>d.every((k,i)=>its[k].t===its[i].t);
    for(let tries=0;tries<50;tries++){const d=shuffle(idx);if(!same(d))return d}
    const j=idx.findIndex(k=>its[k].t!==its[0].t);[idx[0],idx[j]]=[idx[j],idx[0]];return idx;
  },
  /* placed: item indices in the child's order. A position is right when its text is the right one there, so identical texts
     (two «και» in a sentence) are interchangeable; the whole order is right when every position is and each item is placed once. */
  _orderCheck(round, placed){
    const its=round.items, pos=its.map((it,i)=>its[placed[i]]!==undefined&&its[placed[i]].t===it.t);
    return {ok:placed.length===its.length&&new Set(placed).size===placed.length&&pos.every(Boolean), pos};
  },
  /* cloze: rounds = [[text with one {_}, [correct, wrong, ...], why], ...] */
  _GAP: '{_}',
  _clozeRounds(raw){
    return (Array.isArray(raw)?raw:[]).map(r=>{
      if(!Array.isArray(r)||typeof r[0]!=='string') return null;
      const parts=r[0].split(Engine._GAP), c=Engine._choices(r[1]);
      return parts.length===2&&c ? Object.assign({before:parts[0], after:parts[1], why:Engine._txt(r[2])||''}, c) : null;
    }).filter(Boolean);
  },
  /* source: rounds = [{title?, text, link?, questions: [[question, [correct, wrong, ...], why], ...]}, ...]; a link must be http(s) */
  _sourceRounds(raw){
    const esc=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return (Array.isArray(raw)?raw:[]).map(r=>{
      if(!r||typeof r!=='object'||Array.isArray(r)||Engine._txt(r.text)===null) return null;
      const questions=(Array.isArray(r.questions)?r.questions:[]).map(q=>{
        const c=Array.isArray(q)&&Engine._txt(q[0])!==null&&Engine._choices(q[1]);
        return c ? Object.assign({q:q[0], why:Engine._txt(q[2])||''}, c) : null;
      }).filter(Boolean);
      if(!questions.length) return null;
      const link=typeof r.link==='string'&&/^https?:\/\//i.test(r.link) ? esc(r.link) : '';
      return {title:Engine._txt(r.title)||'', text:r.text, link, questions};
    }).filter(Boolean);
  },

  /* Shared driver of order, cloze and source, on the activity frame (_gframe): a play is a list of steps (a round, or one
     question of a text), each answered once (one PG.hit), with the progress line, «Γύρος 2 από 5» (label), a live score, the
     verdict and explanation in the feedback panel (read by Engine.shell._a11y through #shLive) with «Συνέχεια». paint(step, body, answer, act) draws the step into
     body (and its check button, if any, into the action row act) and calls answer(ok, html) once. Bad or empty data: a
     short note and one warning. */
  _steps(o, type, rounds, steps, label, paint){
    const box=typeof o.el==='string'?$(o.el):o.el, key=o.key||type;
    if(!rounds.length){
      try{console.warn(`noos: game «${o.id||key}» (${type}) has no valid rounds`)}catch(e){}
      if(box) box.innerHTML='<p class="muted">Αυτό το παιχνίδι δεν έχει ακόμα γύρους.</p>';
      return;
    }
    if(!box) return;
    const dropped=(Array.isArray(o.rounds)?o.rounds.length:0)-rounds.length;
    if(dropped) try{console.warn(`noos: game «${o.id||key}» (${type}): ${dropped} round(s) skipped, bad data`)}catch(e){}
    const R=Engine._gframe(box,o,type);let st;
    /* arrow keys move between the buttons of one row (the pieces, the choices), wrapping; Tab still works */
    box.addEventListener('keydown',e=>{
      const d={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key],row=d&&e.target.closest&&e.target.closest('.ord-pool,.gm-opts');
      if(!row||!box.contains(row))return;const bs=[...row.querySelectorAll('button:not(:disabled)')],i=bs.indexOf(e.target);
      if(i<0)return;e.preventDefault();bs[(i+d+bs.length)%bs.length].focus();
    });
    const top=()=>{const L=st.list.length;R('count').textContent=st.i<L?label(st.list[st.i],st):'';R('score').textContent=`Σκορ: ${st.score}`;
      Engine._gline(R,Math.min(st.i,L),L)};
    function start(focus){st={list:steps(Engine._draw(rounds,o.n)),i:0,score:0,done:false,stk:Engine._stk.length};show(focus)}
    function show(focus){
      R('fb').innerHTML='';R('act').innerHTML='';top();
      if(st.i>=st.list.length){
        /* the end screen (Engine._endScreen) over the frame; its «Ξανά» (data-r="again") starts a new play */
        const s=st.score,L=st.list.length,r=s/L,sec=box.closest('section');Engine._cheer(r>=.7);
        R('body').innerHTML=Engine._endScreen({tab:sec?sec.id:(o.id||key),stars:Engine.roundStars(s,L),head:Engine.result(s,L),sticker:Engine._stickerSince(st.stk,key),
          lines:[['sh-end-say',r>=.9?'Εξαιρετικά!':r>=.7?'Πολύ καλά!':'Ας το ξαναπροσπαθήσουμε!'],['sh-end-next',Engine.nextStar(s,L)]],again:{r:'again',label:'Ξανά'}});
        R('again').onclick=()=>start(true);Engine._endOn(box);return;
      }
      st.done=false;paint(st.list[st.i],R('body'),answer,R('act'));
      if(focus)R('q').focus();
    }
    function answer(ok, html){
      if(st.done)return;st.done=true;if(ok)st.score++;top();PG.hit(key,ok);Engine._cheer(ok);
      const nx=Engine._gfb(R,ok,html,'next',st.i+1<st.list.length?'Συνέχεια':'Αποτέλεσμα','chevron-right');
      nx.onclick=()=>{st.i++;show(true)};nx.focus({preventScroll:true});
    }
    start(false);
  },
  /* the right and wrong marks beside a choice or a placed item: a tick or a cross icon, a word for a screen reader */
  _mark(ok){ return Engine._okMark(ok).replace('class="sh-mark"', 'class="sh-mark gm-mark"'); },
  /* the choice buttons of a cloze gap or a source question; pick(text, ok) after the answer is marked */
  _choiceRow(body, c, pick){
    const opts=Engine._deal(c), row=body.querySelector('.gm-opts');
    row.innerHTML=opts.map((t,k)=>`<button type="button" class="opt" data-k="${k}"><span class="opt-t">${String.fromCharCode(945+k)}) ${t}</span></button>`).join('');
    row.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
      if(b.disabled)return;const ok=Engine._isRight(c,opts[b.dataset.k]);
      row.querySelectorAll('.opt').forEach(x=>{x.disabled=true;const r=opts[x.dataset.k]===c.right;
        if(r||x===b){x.classList.add(r?'right':'wrong');x.insertAdjacentHTML('beforeend',Engine._mark(r))}});
      pick(ok);
    });
  },

  /* ---------- order: put the items in sequence. rounds = [[prompt, [item, ...], why], ...], item = text or [text, caption] ----------
     Tap the pieces in order: each tapped piece shows its place (1, 2, ...); tap it again to take it back (the later ones move
     up). «Έλεγχος» once all are placed; then the list shows the right order (with the captions), each place marked right
     or wrong, and for a wrong one where the child put it. */
  order(o){
    const rounds=Engine._orderRounds(o.rounds);
    /* the how-to line under the prompt: the page's intro already says to tap the pieces in order */
    Engine._steps(o,'order',rounds,l=>l,(r,L)=>`Γύρος ${L.i+1} από ${L.list.length}`,(rd,body,answer,act)=>{
      const deal=Engine._orderDeal(rd),n=rd.items.length;let placed=[];
      body.innerHTML=`<div class="big gm-q" data-r="q" tabindex="-1">${rd.prompt||'Βάλε τα στη σωστή σειρά.'}</div>
        <p class="gm-lbl" data-r="poolLbl">${o.intro?'':'Πάτα τα κομμάτια με τη σωστή σειρά. '}Ξαναπάτα ένα κομμάτι για να το βγάλεις.</p><div class="ord-pool" role="group" aria-label="Κομμάτια" data-r="pool" data-primary></div>`;
      const B=k=>body.querySelector(`[data-r="${k}"]`);
      act.innerHTML=`<button type="button" class="sh-primary" data-r="check" disabled>${Engine._icon('tick')}Έλεγχος</button>`;
      const C=act.querySelector('[data-r="check"]');
      function draw(focus){
        B('pool').innerHTML=deal.map(k=>{const p=placed.indexOf(k);
          return `<button type="button" class="ord-chip${p<0?'':' on'}" data-k="${k}" aria-pressed="${p<0?'false':'true'}"><span class="ord-n" aria-hidden="true">${p<0?'':p+1}</span><span class="ord-t">${rd.items[k].t}</span>${p<0?'':`<span class="sh-sr">, θέση ${p+1}</span>`}</button>`}).join('');
        C.disabled=placed.length<n;
        B('pool').querySelectorAll('button').forEach((b,j)=>b.onclick=()=>{const k=+b.dataset.k,p=placed.indexOf(k);if(p<0)placed.push(k);else placed.splice(p,1);draw(j)});
        if(focus!=null){const t=B('pool').querySelectorAll('button')[focus];if(t)t.focus()}
      }
      draw(null);
      C.onclick=()=>{
        if(placed.length<n)return;const res=Engine._orderCheck(rd,placed),good=res.pos.filter(Boolean).length;
        B('pool').remove();B('poolLbl').remove();
        body.insertAdjacentHTML('beforeend',`<p class="gm-lbl">Η σωστή σειρά:</p><ol class="ord-ans ord-right">${rd.items.map((it,i)=>`<li class="ord-done ${res.pos[i]?'right':'wrong'}"><span class="ord-t">${it.t}</span>${it.c||!res.pos[i]?`<span class="ord-sub">${it.c?`<span class="ord-cap">${it.c}</span>`:''}${res.pos[i]?'':`<span class="ord-you">εσύ: ${placed.indexOf(i)+1}η</span>`}</span>`:''}${Engine._mark(res.pos[i])}</li>`).join('')}</ol>`);
        answer(res.ok,`${res.ok?'':`Σωστές θέσεις: ${good} από ${n}. `}${rd.why}`);
      };
    });
  },

  /* ---------- cloze: one gap and a few choices. rounds = [[text with one {_}, [correct, wrong, ...], why], ...] ---------- */
  cloze(o){
    const rounds=Engine._clozeRounds(o.rounds);
    Engine._steps(o,'cloze',rounds,l=>l,(r,L)=>`Πρόταση ${L.i+1} από ${L.list.length}`,(c,body,answer)=>{
      body.innerHTML=`<div class="big gm-q cz-s" data-r="q" tabindex="-1">${c.before}<span class="cz-gap" data-r="gap"><span class="gm-sr">(κενό)</span></span>${c.after}</div>
        <p class="gm-lbl">Τι ταιριάζει στο κενό;</p><div class="gm-opts" data-primary></div>`;
      Engine._choiceRow(body,c,ok=>{
        const g=body.querySelector('[data-r="gap"]');g.className='cz-fill';g.innerHTML=c.right;
        answer(ok,`${ok?'':`Η σωστή απάντηση: <b>${c.right}</b>. `}${c.why}`);
      });
    });
  },

  /* ---------- source: a short text and questions about it, the text kept on screen (a reading pane that scrolls on its own
     when the text is longer than the room left above the question).
     rounds = [{title?, text, link?, questions: [[question, [correct, wrong, ...], why], ...]}, ...]; one PG.hit per question ---------- */
  source(o){
    const rounds=Engine._sourceRounds(o.rounds);let shown=null;
    const steps=list=>list.flatMap((src,t)=>src.questions.map((q,k)=>({src,q,t,k,T:list.length})));
    Engine._steps(o,'source',rounds,steps,(s,L)=>`Ερώτηση ${L.i+1} από ${L.list.length}`,(s,body,answer)=>{
      if(shown!==s.src||!body.querySelector('.src-box')){
        const src=s.src;
        body.innerHTML=`<article class="src-box" tabindex="0" aria-label="Κείμενο ${s.t+1} από ${s.T}${src.title?`: ${Engine.shell.esc(src.title.replace(/<[^>]*>/g,''))}`:''}"><p class="src-n">Κείμενο ${s.t+1} από ${s.T}</p>${src.title?`<h3 class="src-title">${src.title}</h3>`:''}
          <div class="src-text">${src.text}</div>
          ${src.link?`<p class="src-link"><a href="${src.link}" target="_blank" rel="noopener">Το πρωτότυπο κείμενο<span class="gm-sr"> (ανοίγει σε νέα καρτέλα)</span></a></p>`:''}</article><div class="src-qa" data-r="qa"></div>`;
        shown=src;
      }
      const qa=body.querySelector('[data-r="qa"]');
      qa.innerHTML=`<div class="big gm-q" data-r="q" tabindex="-1">${s.q.q}</div><div class="gm-opts" data-primary></div>`;
      Engine._choiceRow(qa,s.q,ok=>answer(ok,`${ok?'':`Η σωστή απάντηση: <b>${s.q.right}</b>. `}${s.q.why}`));
    });
  },

  /* ---------- build a whole page from data (new chapters) ---------- */
  build(cfg){
    const sub = cfg.subject || {};
    document.documentElement.lang='el';
    document.title = `${cfg.grade}, ${sub.name||''}, ${cfg.chapter||''} ${cfg.title}`.replace(/\s+/g,' ');
    document.body.classList.add('themed');   /* round 3: no per-subject page tint (sub.color and sub.soft stay in the data, unused here) */
    (cfg.games||[]).forEach(g=>{if(g.key&&g.key!==g.id)Engine.shell.rowTab[g.id]=g.key});   /* a game whose row key is not its tab id */
    const tabs=[['sum','📘 Σύνοψη']];
    if(cfg.cards)tabs.push(['fc','🃏 Κάρτες']);
    if(cfg.quiz)tabs.push(['quiz','✅ Κουίζ']);
    if(cfg.tf)tabs.push(['tf','⚡ Σωστό ή Λάθος']);
    (cfg.games||[]).forEach(g=>tabs.push([g.id,g.tab]));
    tabs.push(['parent','👨‍👦 Για τον γονιό']);
    const lvl = cfg.level ? `<span class="lvl2">${cfg.level}</span>` : '';
    /* an engine game (type) is drawn on the activity frame by its function, the intro inside it; a page's own game (html,
       init) whose html holds a .sh-body opts into the frame too (its intro goes first into that .sh-body, see below) */
    const frame=g=>!!(g.type&&Engine[g.type])||/\bsh-body\b/.test(g.html||'');
    const games=(cfg.games||[]).map(g=>frame(g)
      ?`<section id="${g.id}" class="sh-frame gm-frame"><h2>${g.title||g.tab}</h2><div class="gm-box sh-col" id="${g.id}Box">${g.html||''}</div></section>`
      :`<section id="${g.id}"><h2>${g.title||g.tab}</h2>${g.intro?`<p class="muted">${g.intro}</p>`:''}<div class="card" id="${g.id}Box">${g.html||''}</div></section>`).join('');
    const src=(cfg.sources||[]).map(([t,u])=>`<li><a href="${u}" target="_blank" rel="noopener">${t}</a></li>`).join('');
    document.body.insertAdjacentHTML('afterbegin',`
<header>
  <div class="crumbs"><span>${cfg.grade}</span><span class="s">${sub.icon||''} ${sub.name||''}</span>${cfg.chapter?`<span>${cfg.chapter}</span>`:''}${lvl}</div>
  <h1>${cfg.title}</h1>${cfg.sub?`<p class="sub">${cfg.sub}</p>`:''}
</header>
<nav><div class="tabs" id="tabs">${tabs.map(([t,l],i)=>`<button data-t="${t}"${i?'':' class="on"'}>${l}</button>`).join('')}</div></nav>
<main>
  <section id="sum" class="on">${cfg.summary||''}</section>
  ${cfg.cards?`<section id="fc">${Engine.html.fc(cfg.cardFilters)}</section>`:''}
  ${cfg.quiz?`<section id="quiz">${Engine.html.quiz()}</section>`:''}
  ${cfg.tf?`<section id="tf">${Engine.html.tf()}</section>`:''}
  ${games}
  <section id="parent"><h2>Οδηγός για τον γονιό</h2>${cfg.parent||''}${src?`<h3>Πηγές</h3><div class="card"><ul class="tight">${src}</ul></div>`:''}</section>
</main>`);
    const rows=[];
    if(cfg.cards)rows.push(['cards','🃏 Κάρτες (τις ήξερα)','list']);
    if(cfg.quiz)rows.push(['quiz','✅ Κουίζ','hit']);
    if(cfg.tf)rows.push(['tf','⚡ Σωστό ή Λάθος','hit']);
    (cfg.games||[]).forEach(g=>{if(g.row!==false)rows.push([g.key||g.id,g.rowLabel||g.tab,g.type==='blitz'?'list':'hit'])});
    Engine.start({id:cfg.id,rows,kid:cfg.kid});
    if(cfg.cards)Engine.flashcards({cards:cfg.cards,tags:cfg.cardTags});
    if(cfg.quiz)Engine.quiz({items:cfg.quiz,n:cfg.quizN});
    if(cfg.tf)Engine.truefalse({items:cfg.tf,n:cfg.tfN});
    (cfg.games||[]).forEach(g=>{
      const o=Object.assign({},g,{el:'#'+g.id+'Box',key:g.key||g.id});
      if(!(g.type&&Engine[g.type])&&g.intro&&frame(g)){const b=document.querySelector('#'+g.id+'Box .sh-body');if(b)b.insertAdjacentHTML('afterbegin',`<p class="gm-intro">${g.intro}</p>`)}
      if(g.type&&Engine[g.type])Engine[g.type](o);else if(typeof g.init==='function')g.init(document.getElementById(g.id+'Box'),o);
    });
    PG.render();
  }
};

/* ===== progress table ===== */
Engine._makePG=function(){return (function(){
  const KEY='progress_'+PG_ID;let S={};
  try{S=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){S={}}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
  /* longest list per list row during this page load, from the stored lengths; see setList */
  const seen=Object.create(null);
  Object.keys(S).forEach(k=>{if(S[k]&&Array.isArray(S[k].list))seen[k]=S[k].list.length});
  /* another tab wrote this page's progress (a hub restore, the page open twice): reload S in place, since the reward layer
     and the games hold this object, and redraw; bad JSON keeps the current store */
  window.addEventListener('storage',e=>{if(e.key!==KEY)return;let v;try{v=JSON.parse(e.newValue||'{}')}catch(err){return}
    if(!v||typeof v!=='object'||Array.isArray(v))return;
    Object.keys(S).forEach(k=>delete S[k]);Object.keys(v).forEach(k=>{if(k!=='__proto__')S[k]=v[k]});render()});
  /* row value: recent accuracy from the reward layer when loaded, else lifetime ok/n */
  const pct=r=>{const s=S[r[0]];if(window.Rewards)return Rewards.rowValue(s,r[2]);if(!s)return null;if(r[2]==='hit')return s.n?s.ok/s.n:null;return s.total?(s.list||[]).length/s.total:null};
  const col=p=>p>=.8?'var(--ok)':p>=.5?'#e0b02f':'var(--bad)';
  const stars=s=>{if(!window.Rewards)return '';const b=Math.max(0,Math.min(3,Math.floor(Number(s&&s.best))||0));return ` <span class="pgstars">${'⭐'.repeat(b)}${'☆'.repeat(3-b)}</span>`};
  /* hit row text: the recent window once it holds 10 or more results (the % comes from it too), else lifetime */
  const hitTxt=(s,p)=>{const r=typeof s.r==='string'?s.r:'',pc=Math.round(p*100);
    return r.length>=10?`<b>${r.split('1').length-1}</b> / ${r.length} τελευταίες (${pc}%)`:`<b>${Number(s.ok)||0}</b> / ${Number(s.n)||0} σωστές (${pc}%)`};
  const rowType=k=>{const r=PG_ROWS.find(x=>x[0]===k);return r?r[2]:'hit'};
  /* hands the live store S to the reward layer, which updates best/low on the record and saves */
  const reward=(k,type,ok)=>Engine._reward('onAnswer',{pageId:PG_ID,kid:Engine.kid,rows:PG_ROWS,progress:S,key:k,type,ok});
  function render(){
    let sum=0,cnt=0,ok=0,n=0;
    const rows=PG_ROWS.filter(r=>r[0].charAt(0)!=='_').map(r=>{const s=S[r[0]],p=pct(r);
      if(p!==null){sum+=p;cnt++}
      if(r[2]==='hit'&&s){ok+=Number(s.ok)||0;n+=Number(s.n)||0}
      const txt=p===null?'<span class="muted">δεν ξεκίνησε</span>':r[2]==='hit'?hitTxt(s,p):`<b>${Array.isArray(s.list)?s.list.length:0}</b> / ${Number(s.total)||0}`;
      return `<div class="pgrow"><span>${r[1]}${stars(s)}</span><span>${txt}</span><div class="pgbar"><div style="width:${p===null?0:p*100}%;background:${p===null?'transparent':col(p)}"></div></div></div>`}).join('');
    const all=cnt?Math.round(sum/cnt*100):0;
    document.getElementById('pgRows').innerHTML=rows;
    document.getElementById('pgPct').textContent=all+'%';
    document.getElementById('pgAll').innerHTML=`Συνολικά: <b>${all}%</b>, ${ok} ${ok===1?'σωστή απάντηση':'σωστές απαντήσεις'} σε ${n} ${n===1?'προσπάθεια':'προσπάθειες'}`;
    try{Engine.shell.refresh()}catch(e){console.error(e)}   /* the chip, the tiles and the rail follow the table */
  }
  const api={
    /* a stored record that is not an object starts fresh; a reward error never aborts the game's click handler */
    /* hit and setList mark the game that owns the row played once (the learning path, Engine.shell.played) */
    hit(k,ok){Engine.shell.played(k);let s=S[k];if(!s||typeof s!=='object'||Array.isArray(s))s=S[k]={ok:0,n:0};
      if(window.Rewards){try{Rewards.pushResult(s,ok)}catch(e){console.error(e)}}else{s.n=(s.n||0)+1;s.ok=(s.ok||0)+(ok?1:0)}
      save();reward(k,rowType(k),ok);render()},
    /* several answers at once (a matching board): all are stored first, so the stars are those of the whole */
    hits(k,oks){Engine.shell.played(k);let s=S[k];if(!s||typeof s!=='object'||Array.isArray(s))s=S[k]={ok:0,n:0};
      oks.forEach(ok=>{if(window.Rewards){try{Rewards.pushResult(s,ok)}catch(e){console.error(e)}}else{s.n=(s.n||0)+1;s.ok=(s.ok||0)+(ok?1:0)}});
      save();oks.forEach(ok=>reward(k,rowType(k),ok));render()},
    /* keeps the reward fields best, hi and low across the list replacement; only a list longer than any this row had
       during this page load is an answer: an unchanged list (a redraw), a shorter one (a card marked «Όχι ακόμα») and a
       card toggled back to «Το ήξερα» never reach the reward layer */
    setList(k,list,total){Engine.shell.played(k);const old=S[k]||{},rec={list,total},top=seen[k]||0,grew=list.length>top;seen[k]=Math.max(top,list.length);
      ['best','hi','low'].forEach(f=>{if(old[f]!==undefined)rec[f]=old[f]});S[k]=rec;save();if(grew)reward(k,'list',true);render()},
    put(k,obj){S[k]=obj;save();render()},
    /* as put, without the redraw (the shell stores the learning path from inside its own redraw) */
    keep(k,obj){S[k]=obj;save()},
    get(k){return S[k]},
    store(){return S},
    /* clears ok, n, r, list and total; keeps best, hi, low, the whole _boss trophy and the whole learning path _path (a reset
       never locks a step again, rewards.js PATH); S stays the same object; then stamps S._reset with the reset time
       (rewards.js RESET), so a sync or backup merge never brings the cleared answers back */
    reset(){const at=window.Rewards&&Rewards.resetStamp?Rewards.resetStamp(S):new Date().toISOString();
      Object.keys(S).forEach(k=>{const s=S[k];if((k==='_boss'||k==='_path')&&s&&typeof s==='object')return;const keep={};
      if(s&&typeof s==='object')['best','hi','low'].forEach(f=>{if(s[f]!==undefined)keep[f]=s[f]});
      if(Object.keys(keep).length)S[k]=keep;else delete S[k]});S._reset={at};save();render()},render
  };
  /* the 📊 table opens and closes from its button (aria-expanded); opened, the focus goes to its heading; Escape closes it
     and the focus goes back to the button; a tap elsewhere closes it (W8) */
  const pgB=document.getElementById('pgBtn'),pgP=document.getElementById('pgPanel'),pgH=document.querySelector('#pgPanel h4');
  const attr=(e,k,v)=>{if(e&&typeof e.setAttribute==='function')e.setAttribute(k,v)};   /* the node tests' elements have none */
  attr(pgB,'aria-expanded','false');attr(pgB,'aria-controls','pgPanel');
  if(pgH){pgH.id=pgH.id||'pgPanelH';pgH.tabIndex=-1;attr(pgP,'role','region');attr(pgP,'aria-labelledby',pgH.id)}
  const pgOpen=(on,focus)=>{document.getElementById('pg').classList.toggle('open',on);attr(pgB,'aria-expanded',String(on));
    if(focus)try{(on&&pgH?pgH:pgB).focus({preventScroll:true})}catch(e){}};
  pgB.onclick=e=>{e.stopPropagation();pgOpen(!document.getElementById('pg').classList.contains('open'),true)};
  pgP.onclick=e=>e.stopPropagation();
  document.addEventListener('click',()=>pgOpen(false,false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('pg').classList.contains('open')){e.stopImmediatePropagation();pgOpen(false,true)}},true);
  const rb=document.getElementById('pgReset');let armed=false;
  rb.onclick=()=>{if(!armed){armed=true;rb.textContent='Σίγουρα; Πάτα ξανά';setTimeout(()=>{armed=false;rb.textContent='Μηδενισμός'},3000);return}
    armed=false;rb.textContent='Μηδενισμός';api.reset();try{location.reload()}catch(e){}};
  return api;
})();};

/* ===== feedback in view, keyboard away (below the rail breakpoint) =====
   The old phone bar and game sheet are gone (the shell below replaces them); what stays: feedback that appears below the
   visible part of the page, or under the keyboard, is brought into view, and a check button hides the keyboard. */
Engine._mobile=function(){
  const main=document.querySelector('main');
  if(!main)return;
  const mobile=()=>innerWidth<Engine.shell.RAIL_MIN;
  const seen=new WeakMap();
  const bringIntoView=el=>{if(!mobile()||!el.offsetParent||el.closest('.sh-fb'))return;
    const r=el.getBoundingClientRect(),limit=innerHeight-(document.documentElement.classList.contains('sh-barvis')?96:28);
    if(r.top>limit-40||r.bottom>limit)el.scrollIntoView({behavior:Engine._motion(),block:'center'})};
  if(typeof MutationObserver==='function')new MutationObserver(ms=>{for(const m of ms){const el=m.target.nodeType===1?m.target:m.target.parentElement;if(!el)continue;
      const box=el.closest('.expl,[id$="Fb"]');if(box&&box.closest('section.on')){clearTimeout(seen.get(box));seen.set(box,setTimeout(()=>bringIntoView(box),120))}}})
    .observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
  document.addEventListener('click',e=>{if(!mobile())return;const b=e.target.closest('button');if(b&&document.activeElement&&document.activeElement.tagName==='INPUT'&&!b.closest('.keypad'))document.activeElement.blur()},true);
};

/* ===== the chapter shell (round 3, W2) =====
   Built by Engine.start from what every page already has (h1, crumbs, #tabs, main > section); no page markup changes.
   - Top bar #shTop (64 px): back button #shBack, the label (#shCtx context line, #shTitle title), #shTools with the sound
     toggle (rewards-ui.js) and the page's #pg, whose #pgBtn becomes the star chip that opens the 📊 table (#pgPanel).
   - Chapter start view section#shHome in main, the view on load (round 3, W3, mockup 03): a card with the chapter stars,
     the countdown slot (#shSlotCount), the one sentence of what opens next (#shSay), the plan banner slot (#shSlotNote) and
     «Συνέχισε» (#shSlotNext); the daily mission (#shSlotQuest, a trail); the three stages (Μαθαίνω, Παίζω, Δοκιμάζομαι),
     each a header (badge: done, current or locked; name; its progress or what opens it) and one tile per activity; the
     parent link.
   - The learning path (W3, brief section 7): Rewards.pathState on the live store gives the open level (0 Σύνοψη, 1 Κάρτες,
     2 Παίζω, 3 Κουίζ and Σωστό ή Λάθος, 4 Τελικό τέρας); refresh() stores what it raised (progress_<id>._path). A locked
     tab never opens (the #tabs click handler in Engine.start): its tile, rail row or any button that taps it shows why in
     #shWhy (a polite status, visible). The facts come in through markSummaryRead(), cardCount(n), cardRated(i), played()
     (a game answer while a game is open, or opening a game without a progress row) and roundEnd(kind, score, total).
   - Bottom bar nav#shBar (below RAIL_MIN): one item per group; an item opens the home at that group. Hidden on the home
     and in a quiz, true/false or boss round (brief A3: the way out is the back arrow).
   - Rail aside#shRail (RAIL_MIN and wider): back to the notebooks, the label with chapter stars, every activity with its
     state (a row opens it), the parent link.
   - The tab row #tabs stays in the DOM, hidden: every view change still goes through its buttons' click handler, so
     Engine.tabHooks, PG, rewards-ui.js and the pages' own hooks run as before. Hooks also get 'home' when the home opens.
   - html.sh marks a page with the shell; html[data-sh-view] is home, parent, g0, g1 or g2; html.sh-barvis while the bottom
     bar shows. The CSS and the markup contract for activities are at the top of engine/engine-ui.css.
   The pure parts (name, context, rowFor, item, model, step, say, whyText, side) are node-tested in tests/shell.test.js and
   tests/path.test.js. */
Engine.shell={
  ready:false,
  RAIL_MIN:1100,               /* engine-ui.css: the rail from this width, the bottom bar below it */
  ICONS:['book','gamepad','test'],
  rowTab:{},                   /* tab id -> row key where they differ (Engine.build games with their own key) */
  tabs:[], view:null, hub:false, title:'', ctx:'', head:'', barN:0,
  path:null,                   /* the learning path of the last refresh (Rewards.pathState), null without rewards.js */
  cardN:null,                  /* the number of cards (Engine.flashcards), null until known */

  /* ---------- pure ---------- */
  /* a tab label without its leading emoji or symbol: «✅ Κουίζ» -> «Κουίζ» */
  name(label){const t=String(label==null?'':label).trim(),n=t.replace(/^[^\p{L}\p{N}]+/u,'').trim();return n||t},
  /* the label's context line from the crumbs [{text, cls}]: subject and grade, then the chapter crumbs, then the level;
     «Ε΄ Δημοτικού», «∑ Μαθηματικά», «Ενότητα 2 (middle dot) Κεφ. 10» -> «Μαθηματικά Ε΄, Ενότητα 2, Κεφ. 10» */
  context(crumbs){
    const S=Engine.shell,list=(Array.isArray(crumbs)?crumbs:[]).map(c=>({text:S.name(c&&c.text).replace(/\s*[\u00b7\u0387]\s*/g,', '),cls:String((c&&c.cls)||'')})).filter(c=>c.text);
    const subj=list.find(c=>/(^|\s)s(\s|$)/.test(c.cls)),lvl=list.filter(c=>/(^|\s)lvl\d(\s|$)/.test(c.cls)),rest=list.filter(c=>c!==subj&&!lvl.includes(c));
    const grade=rest.length&&/Δημοτικού|Γυμνασίου/.test(rest[0].text)?rest.shift().text.split(/\s+/)[0]:'';
    return [[subj?subj.text:'',grade].filter(Boolean).join(' '),...rest.map(c=>c.text),...lvl.map(c=>c.text)].filter(Boolean).join(', ');
  },
  /* the progress row of a tab: map[tab] first, then a row with the tab's own id, then the engine's aliases (as rewards.js TAB_OF) */
  rowFor(t,rows,map){
    const R=Array.isArray(rows)?rows.filter(r=>Array.isArray(r)):[],find=k=>R.find(r=>r[0]===k)||null;
    if(map&&Object.prototype.hasOwnProperty.call(map,t))return find(map[t]);
    return find(t)||(t==='fc'?find('cards'):t==='wsearch'?find('ws'):null);
  },
  /* one activity: {t, name, g, kind} and its state. kind: 'read' (summary, parent), 'none' (no progress row), 'stars' (hit
     row: played, stars 0 to 3 from best), 'list' (list row: done of total, played, stars), 'boss' (played, won, best, total,
     locked). locks: {tab id: true} for the steps the learning path keeps locked; a locked activity gets locked: true (the
     boss always carries locked) */
  item(t,label,rows,progress,map,locks){
    const S=Engine.shell,p=progress&&typeof progress==='object'?progress:{},g=Engine._tabGroup(t),it={t,name:S.name(label),g};
    const num=v=>{const x=Number(v);return Number.isFinite(x)?x:0},best=r=>Math.max(0,Math.min(3,Math.floor(num(r&&r.best)))),obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
    const lock=x=>obj(locks)&&Object.prototype.hasOwnProperty.call(locks,t)&&locks[t]===true?Object.assign(x,{locked:true}):x;
    if(t==='fboss'){const b=obj(p._boss)?p._boss:null;
      return Object.assign(it,{kind:'boss',played:!!b,won:!!(b&&b.won===true),best:b&&Number.isInteger(b.best)?b.best:null,
        total:b&&Number.isInteger(b.total)?b.total:null,locked:false},lock({}))}
    if(t==='sum'||g===3)return lock(Object.assign(it,{kind:'read'}));
    const row=S.rowFor(t,rows,map);
    if(!row)return lock(Object.assign(it,{kind:'none'}));
    const rec=obj(p[row[0]])?p[row[0]]:null;
    if(row[2]==='hit')return lock(Object.assign(it,{kind:'stars',key:row[0],played:num(rec&&rec.n)>0,stars:best(rec)}));
    const total=Math.max(0,Math.floor(num(rec&&rec.total))),done=rec&&Array.isArray(rec.list)?rec.list.length:0;
    return lock(Object.assign(it,{kind:'list',key:row[0],played:done>0,stars:best(rec),done:total?Math.min(done,total):done,total}));
  },
  /* the home's data: the three groups in order, each with its activities in tab order (empty groups left out), how many of
     its scored activities (stars, list) were played, and the parent tab apart. o: {tabs: [[id, label]], rows, progress,
     rowTab, locks} */
  model(o){
    const S=Engine.shell,a=o||{},groups=Engine.tabGroupNames.map((name,g)=>({g,name,items:[],played:0,counted:0}));
    let parent=null;
    for(const [t,label] of (Array.isArray(a.tabs)?a.tabs:[])){
      if(Engine._tabGroup(t)===3){if(!parent)parent={t,name:S.name(label)};continue}
      const it=S.item(t,label,a.rows,a.progress,a.rowTab,a.locks),gr=groups[it.g];
      gr.items.push(it);
      if(it.kind==='stars'||it.kind==='list'){gr.counted++;if(it.played)gr.played++}
    }
    return {groups:groups.filter(x=>x.items.length),parent};
  },
  esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')},
  /* drawn ratios (D6): three stars, or a bar with «done / total» beside it; the words for screen readers in aria-label */
  starsHtml(n){let h='';for(let k=0;k<3;k++)h+=`<span class="sh-st${k<n?' on':''}">${Engine._icon('star')}</span>`;
    return `<span class="sh-stars" role="img" aria-label="${n} από 3 αστέρια">${h}</span>`},
  barHtml(done,total,label){const pct=total?Math.round(Math.min(1,done/total)*100):0;
    return `<span class="sh-ratio" role="img" aria-label="${Engine.shell.esc(label)}"><span class="sh-track"><span style="width:${pct}%"></span></span><b aria-hidden="true">${done} / ${total}</b></span>`},
  stateHtml(it){
    const S=Engine.shell,ic=Engine._icon,isNew='<span class="sh-new">νέο</span>';
    if(it.locked)return `${ic('lock')}<span class="sh-sr">κλειδωμένο</span>`;
    if(it.kind==='read')return it.done?`${ic('tick')}<span>τη διάβασα</span>`:`${ic('book')}<span>για διάβασμα</span>`;
    if(it.kind==='list')return it.total?S.barHtml(it.done,it.total,`${it.done} από ${it.total}`):isNew;
    if(it.kind==='stars')return (it.played?'':isNew)+S.starsHtml(it.stars);
    if(it.kind==='boss')return it.won?`${ic('trophy')}<span>νικήθηκε</span>`:it.played&&it.total?`<span>καλύτερο ${it.best} / ${it.total}</span>`:isNew;
    return '<span>χωρίς αστέρια</span>';
  },

  /* ---------- the learning path, pure (st: Rewards.pathState; tabs: [[id, label]]) ---------- */
  /* the step of a tab: 0 summary, 1 cards, 2 a game, 3 quiz and true/false, 4 the final boss; -1 the parent tab (never locked) */
  step(t){const g=Engine._tabGroup(t);return t==='fc'?1:t==='fboss'?4:g===0?0:g===1?2:g===2?3:-1},
  _hasStep(tabs,k){return (Array.isArray(tabs)?tabs:[]).some(x=>Array.isArray(x)&&Engine.shell.step(x[0])===k)},
  _tabName(tabs,t){const x=(Array.isArray(tabs)?tabs:[]).find(y=>Array.isArray(y)&&y[0]===t);return x?Engine.shell.name(x[1]):String(t)},
  /* what the page has, for Rewards.pathState: o = {tabs, rows, rowTab, cardN} */
  page(o){
    const S=Engine.shell,a=o||{},T=(Array.isArray(a.tabs)?a.tabs:[]).filter(x=>Array.isArray(x)).map(x=>x[0]);
    return {sum:T.includes('sum'),cards:T.includes('fc'),cardCount:Number.isInteger(a.cardN)?a.cardN:null,
      games:T.filter(t=>S.step(t)===2).map(t=>{const r=S.rowFor(t,a.rows,a.rowTab);return {t,key:r?r[0]:null}}),quiz:T.includes('quiz'),tf:T.includes('tf')};
  },
  /* condition k (1 to 4) in words: an order (doIt) or what follows «όταν» */
  cond(st,tabs,k,doIt){
    const S=Engine.shell,v=(a,b)=>doIt?a:b,q=t=>`«${S._tabName(tabs,t)}»`;
    if(k===1)return v('Διάβασε','διαβάσεις')+' τη Σύνοψη ως το τέλος';
    if(k===2){const m=st.cardCount===null?null:Math.max(0,st.cardCount-st.rated);
      return v('Πάτα','πατήσεις')+' «Το ήξερα» ή «Όχι ακόμα» σε κάθε κάρτα'+(m===null?'':m===1?' (μένει 1)':` (μένουν ${m})`)}
    if(k===3){const L=st.left;
      return v('Παίξε','παίξεις')+(L.length===1?` το παιχνίδι ${q(L[0])}`:L.length===2?` τα παιχνίδια ${q(L[0])} και ${q(L[1])}`:` κάθε παιχνίδι μία φορά (μένουν ${L.length})`)}
    if(k===4)return v('Τελείωσε','τελειώσεις')+` ένα ${(Array.isArray(tabs)?tabs:[]).some(x=>Array.isArray(x)&&x[0]==='quiz')?'Κουίζ':'Σωστό ή Λάθος'} με τουλάχιστον 7 στις 10 σωστές`;
    return '';
  },
  /* the next step the page has above the open level (1 to 4), or 0 when nothing of the page is locked */
  target(st,tabs){if(!st)return 0;for(let k=st.level+1;k<=4;k++)if(Engine.shell._hasStep(tabs,k))return k;return 0},
  /* the one sentence of the start view: what to do and what it opens; with nothing locked, that the chapter is open */
  say(st,tabs){
    const S=Engine.shell,s=S.target(st,tabs);
    if(!st)return '';
    if(!s)return st.all?'Ο γονιός σου άνοιξε όλο το κεφάλαιο.':'Όλο το κεφάλαιο είναι ανοιχτό.';
    const T=(tabs||[]).filter(x=>Array.isArray(x)).map(x=>x[0]),qz=T.includes('quiz'),tf=T.includes('tf');
    const [what,verb]=s===1?['οι Κάρτες','ανοίξουν']:s===2?['τα παιχνίδια','ανοίξουν']:s===4?['το Τελικό τέρας','ανοίξει']
      :qz&&tf?['το Κουίζ και το Σωστό ή Λάθος','ανοίξουν']:qz?['το Κουίζ','ανοίξει']:['το Σωστό ή Λάθος','ανοίξει'];
    return `${S.cond(st,tabs,st.need,true)} για να ${verb} ${what}.`;
  },
  /* what a tap on locked tab t says: the tab, then every condition still unmet up to its step ('' when t is open) */
  whyText(st,tabs,t){
    const S=Engine.shell,s=S.step(t);
    if(!st||s<=st.level)return '';
    const c=[];for(let k=st.level+1;k<=s;k++)if(!(st.met&&st.met[k]))c.push(S.cond(st,tabs,k,false));
    const name=S._tabName(tabs,t),head=s===1?'Οι Κάρτες ανοίγουν':s===2?`Το παιχνίδι «${name}» ανοίγει`:`Το «${name}» ανοίγει`;
    return `${head} όταν ${c.length>1?c.slice(0,-1).join(', ')+' και '+c[c.length-1]:c[0]||''}.`;
  },
  /* a stage header's state and right side: {state: 'done' | 'cur' | 'locked', html}. gr: a model group; without a path, as W2 */
  side(st,gr){
    const S=Engine.shell,g=gr.g,bar=(d,n,l)=>S.barHtml(d,n,l),txt=t=>`<span>${t}</span>`;
    if(!st)return {state:'cur',html:gr.counted?bar(gr.played,gr.counted,`ξεκίνησες ${gr.played} από ${gr.counted}`):''};
    const first=g===0?0:g===1?2:3;
    if(first>st.level){
      const k=st.need,m=k===2&&st.cardCount!==null?Math.max(0,st.cardCount-st.rated):k===3?st.left.length:null;
      return {state:'locked',html:txt(k===1?'ανοίγει μετά τη Σύνοψη':k===2&&g===1&&m!==null?`ανοίγει με ${m} ${m===1?'κάρτα':'κάρτες'} ακόμα`
        :k===2?'ανοίγει μετά τις Κάρτες':`ανοίγει με ${m} ${m===1?'παιχνίδι':'παιχνίδια'} ακόμα`)};
    }
    const met=k=>!!(st.met&&st.met[k]),boss=gr.items.find(it=>it.kind==='boss');
    if(g===0?met(1)&&met(2):g===1?met(3):boss?boss.won:met(4))return {state:'done',html:txt('έτοιμο')};
    if(g===0)return {state:'cur',html:!met(1)?txt('ξεκίνα από τη Σύνοψη'):st.cardCount?bar(st.rated,st.cardCount,`βαθμολόγησες ${st.rated} από ${st.cardCount} κάρτες`):''};
    if(g===1){const n=st.games.length,d=st.games.filter(x=>x.played).length;return {state:'cur',html:n?bar(d,n,`έπαιξες ${d} από ${n} παιχνίδια`):''}}
    return {state:'cur',html:gr.counted?bar(gr.played,gr.counted,`ξεκίνησες ${gr.played} από ${gr.counted}`):''};
  },
  /* this page's stars and their maximum (as the countdown's boss nudge counts them), or null without rewards.js */
  stars(rows,prog){
    if(!window.Rewards||typeof Rewards.pageStars!=='function')return null;
    const S=Engine.shell;
    return {n:Rewards.pageStars(prog,rows),max:Rewards.countedRows(rows).length*3+(S.tabs.some(x=>x[0]==='fboss')?3:0)};
  },

  /* ---------- DOM ---------- */
  init(){
    const S=Engine.shell,tabs=document.getElementById('tabs'),main=document.querySelector('main'),body=document.body;
    if(S.ready||!tabs||!main||!body||typeof document.createElement!=='function')return;
    const ic=Engine._icon,esc=S.esc,h1=document.querySelector('h1');
    const crumbs=$$('.crumbs span').map(s=>({text:s.textContent,cls:s.className}));
    S.title=h1?h1.textContent.trim():'';
    S.ctx=S.context(crumbs);
    S.head=S.context(crumbs.filter(c=>!/(^|\s)lvl\d(\s|$)/.test(c.cls)).slice(0,2));
    S.tabs=$$('#tabs button[data-t]').map(b=>[b.dataset.t,b.textContent]);
    S.hub=S.hubLink(window);   /* H6: the home link always, except in a self-contained copy (no hub there) */
    S.docTitle=String(document.title||'').replace(/\s*[\u00b7\u0387]\s*/g,', ').trim();
    document.documentElement.classList.add('sh');
    /* top bar; the page's #pg (📊 table, reset) moves into it and its button becomes the star chip. The label is the page's
       heading (the page's own h1 is hidden with its header); its name is the whole text, which a phone cuts (W8) */
    const top=document.createElement('header');top.id='shTop';top.className='sh-top';
    top.innerHTML=`<button type="button" class="sh-back" id="shBack">${ic('back')}</button><div class="sh-label" id="shLabel" role="heading" aria-level="1"><span class="sh-ctx" id="shCtx"></span><span class="sh-title" id="shTitle"></span></div><div class="sh-tools" id="shTools"></div>`;
    body.insertBefore(top,body.firstChild);
    const pg=document.getElementById('pg'),chip=document.getElementById('pgBtn');
    if(pg)top.querySelector('#shTools').appendChild(pg);
    if(chip){chip.classList.add('sh-chip');chip.type='button';
      chip.innerHTML=`${ic('star')}<span class="sh-chipn" id="shStars"></span><span id="pgPct"${window.Rewards?' class="sh-sr"':''}>0%</span>`}
    const ph=document.querySelector('#pgPanel h4');   /* the 📊 table's heading: the chart icon */
    if(ph&&!ph.querySelector('.icon'))ph.insertAdjacentHTML('afterbegin',ic('chart'));
    /* rail */
    const rail=document.createElement('aside');rail.id='shRail';rail.className='sh-rail';rail.setAttribute('aria-label','Το κεφάλαιο');
    rail.innerHTML=`<a class="sh-rback" href="index.html"${S.hub?'':' hidden'}>${ic('back')}<span>Όλα τα τετράδια</span></a>
<button type="button" class="sh-label sh-rlabel" id="shRLabel" aria-label="Αρχή του κεφαλαίου: ${esc(S.title)}"><span class="sh-ctx">${esc(S.ctx)}</span><span class="sh-rtitle">${esc(S.title)}</span><span class="sh-rprog" id="shRProg"></span></button>
<nav class="sh-rnav" id="shRNav" aria-label="Δραστηριότητες"></nav><div class="sh-rfoot" id="shRFoot"></div>`;
    top.insertAdjacentElement('afterend',rail);
    /* chapter home: the first section of main */
    const home=document.createElement('section');home.id='shHome';home.className='sh-home sh-read';
    home.innerHTML=`<div class="sh-hcard"><div class="sh-hstars" id="shHStars"></div><p class="sh-say" id="shSay"></p><div id="shSlotNote"></div><div id="shSlotNext"></div><div id="shSlotCount"></div></div>
<div id="shSlotQuest"></div><div id="shGroups"></div><div class="sh-hfoot" id="shHFoot"></div>`;
    main.insertBefore(home,main.firstChild);
    /* what a tap on a locked step says: one polite status, shown at the bottom of the screen for a few seconds. G2: it never
       blocks a tap (pointer-events none, engine-ui.css): any tap anywhere closes it, so a tap on another locked tile shows
       that tile's reason at once (Engine.shell.why) and a tap on an open tile opens it; Escape closes it too */
    const why=document.createElement('div');why.id='shWhy';why.className='sh-why';why.setAttribute('role','status');why.setAttribute('aria-live','polite');
    document.addEventListener('pointerdown',()=>{if(why.textContent){clearTimeout(S._whyT);why.textContent=''}},true);
    body.appendChild(why);
    /* the same words, as the description of each locked tile and rail row (aria-describedby; hidden, read on focus) */
    const whyTxt=document.createElement('div');whyTxt.id='shWhyTxt';whyTxt.hidden=true;body.appendChild(whyTxt);
    /* the summary counts as read once its end has been on screen (main is the one scroll container) */
    main.addEventListener('scroll',()=>S._readCheck(),{passive:true});
    $$('main > section').forEach(s=>{if(s!==home)s.classList.add(s.id==='sum'||s.id==='parent'?'sh-read':'sh-act')});
    S._sumInit();   /* the summary as concept cards with a pager (W6b) */
    /* Escape: on an end-of-round screen (Engine._endScreen) back to the chapter start, as its close button does; else it
       closes the locked-step note or the owl's note (neither ever holds the focus; the owl's closes even on a cut line,
       which a tap would open first) */
    document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;
      if(S._endOpen()){e.preventDefault();S.home({});return}
      if(why.textContent){clearTimeout(S._whyT);why.textContent=''}
      if(S._owlHide)S._owlHide()});
    /* the end screen is modal below the rail breakpoint only: aria-modal follows a resize */
    window.addEventListener('resize',()=>document.querySelectorAll('main .sh-end').forEach(e=>Engine._endModal(e)));
    /* P4 and P6 (round 3 polish): the start view's title and the rail's fade follow a resize, the scroll and the fonts */
    window.addEventListener('resize',()=>{S._labFit();S._railCut()});
    rail.querySelector('#shRNav').addEventListener('scroll',()=>S._railCut(),{passive:true});
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{S._labFit();S._railCut()});
    /* bottom bar: one item per group that has activities */
    const m=S.model({tabs:S.tabs}),bar=document.createElement('nav');
    bar.id='shBar';bar.className='sh-bar';bar.setAttribute('aria-label','Ενότητες κεφαλαίου');
    bar.innerHTML=m.groups.map(gr=>`<button type="button" data-g="${gr.g}">${ic(S.ICONS[gr.g])}<span>${esc(gr.name)}</span></button>`).join('');
    S.barN=m.groups.length;
    main.insertAdjacentElement('afterend',bar);
    if(m.parent){const p=`<button type="button" class="sh-plink" data-t="${esc(m.parent.t)}">${ic('parent')}<span>${esc(m.parent.name)}</span></button>`;
      home.querySelector('#shHFoot').innerHTML=p;rail.querySelector('#shRFoot').innerHTML=p}
    /* a tile, a rail row or a parent link opens its tab through the tab row; a bar item opens the home at its group */
    const go=e=>{const b=e.target.closest('[data-t]');if(b){e.preventDefault();S.open(b.dataset.t)}};
    home.addEventListener('click',go);
    rail.querySelector('#shRNav').addEventListener('click',go);rail.querySelector('#shRFoot').addEventListener('click',go);
    bar.addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(b)S.home({group:+b.dataset.g})});
    top.querySelector('#shBack').onclick=()=>S.back();
    rail.querySelector('#shRLabel').onclick=()=>S.home({});
    /* A1 (W8): the bottom bar, the rail's activities and the start view's tiles are each one stop of the Tab key; the arrow
       keys, Home and End move inside (the tiles: up and down by row, as drawn) */
    S._rove(bar,'button[data-g]','line');S._roveFix(bar,'button[data-g]');
    S._rove(rail.querySelector('#shRNav'),'.sh-rrow','line');
    S._rove(home.querySelector('#shGroups'),'.sh-tile','grid');
    S._a11y(main);
    Engine.onTab(t=>S._view(t));
    S._owl();
    S.ready=true;
    S.home({});
  },
  /* H6: the link to the notebooks (index.html) shows on the site, always; a self-contained copy (tools/build_single.py
     sets window.NOOS_SINGLE = true) has no hub beside it. w: the window */
  hubLink(w){return !(w&&w.NOOS_SINGLE===true)},
  /* ---------- keyboard inside a group of controls (W8, A1), pure ----------
     keyMove: the index the key moves to in a row or column of n items from i: the arrows one step (wrapping), Home the
     first, End the last; -1 for any other key or no items */
  keyMove(n,i,key){
    if(!(Number.isInteger(n)&&n>0))return -1;
    const k=Number.isInteger(i)&&i>=0&&i<n?i:0,d={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[key];
    if(d)return (k+d+n)%n;
    return key==='Home'?0:key==='End'?n-1:-1;
  },
  /* gridMove: ArrowUp or ArrowDown in items laid out as boxes [{x, y, w, h}] (a grid, rows of any length, groups one under
     another): the item of the nearest row above or below whose centre is nearest across; -1 at the top or bottom edge,
     for another key or a bad index */
  gridMove(rects,i,key){
    const R=Array.isArray(rects)?rects:[],c=R[i];
    if(!c||(key!=='ArrowUp'&&key!=='ArrowDown'))return -1;
    const down=key==='ArrowDown',cy=c.y+c.h/2,cx=c.x+c.w/2;
    const cand=R.map((r,j)=>({r,j})).filter(({r,j})=>j!==i&&r&&(down?r.y+r.h/2>cy+c.h/2:r.y+r.h/2<cy-c.h/2));
    if(!cand.length)return -1;
    const row=down?Math.min(...cand.map(o=>o.r.y)):Math.max(...cand.map(o=>o.r.y));
    const inRow=cand.filter(o=>Math.abs(o.r.y-row)<c.h/2);
    inRow.sort((a,b)=>Math.abs(a.r.x+a.r.w/2-cx)-Math.abs(b.r.x+b.r.w/2-cx)||a.j-b.j);
    return inRow[0].j;
  },
  /* the id of the hidden words that say what opens locked tab t (aria-describedby of its tile and rail row) */
  whyId(t){return 'shWhyT_'+String(t).replace(/[^\w-]/g,'_')},
  /* box: one Tab stop for the items sel inside it (roving tabindex); the arrow keys (mode 'line', or 'grid': up and down by
     the drawn rows), Home and End move the focus; the item focused last stays the stop */
  _rove(box,sel,mode){
    const S=Engine.shell;if(!box)return;
    box.addEventListener('keydown',e=>{
      if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
      const it=e.target.closest&&e.target.closest(sel);if(!it||!box.contains(it))return;
      const items=[...box.querySelectorAll(sel)].filter(x=>x.getClientRects().length),i=items.indexOf(it);if(i<0)return;
      const j=mode==='grid'&&(e.key==='ArrowUp'||e.key==='ArrowDown')
        ?S.gridMove(items.map(x=>{const r=x.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}}),i,e.key):S.keyMove(items.length,i,e.key);
      if(j<0||j===i)return;
      e.preventDefault();items[j].focus();
    });
    box.addEventListener('focusin',e=>{const it=e.target.closest&&e.target.closest(sel);if(!it||!box.contains(it))return;
      box._roveT=it.dataset.t||it.dataset.g||null;S._roveFix(box,sel,it)});
  },
  /* exactly one item of box is in the Tab order: it (or the one focused), the one focused last, the current one, else the first */
  _roveFix(box,sel,it){
    if(!box)return;const items=[...box.querySelectorAll(sel)];if(!items.length)return;
    const a=document.activeElement,key=x=>x.dataset.t||x.dataset.g||null;
    const cur=(it&&items.includes(it)?it:null)||items.find(x=>x===a)||(box._roveT!=null?items.find(x=>key(x)===box._roveT):null)
      ||items.find(x=>x.hasAttribute('aria-current'))||items[0];
    items.forEach(x=>{x.tabIndex=x===cur?0:-1});
  },
  /* the focus goes to the open activity's heading (the frame's hidden h2, read by screen readers; else its first heading on
     view), or to the section itself (W8) */
  _focusView(t){
    const S=Engine.shell;if(!S.ready||!t||t==='home'||S.view!==t)return;
    const sec=document.getElementById(t);if(!sec||!sec.classList.contains('on'))return;
    const vis=e=>e.getClientRects().length>0;   /* an end screen left open: its heading (the dialog), else the activity's */
    const h=[...sec.querySelectorAll('.sh-end-h,.sh-end-rvh')].find(vis)||[...sec.querySelectorAll('h2,h3')].find(vis)||sec;
    if(!h.hasAttribute('tabindex'))h.tabIndex=-1;
    try{h.focus({preventScroll:true})}catch(e){}
  },
  /* the control tapped went away with the screen it was on (a next question, a new game) or was disabled (an answered
     option): the focus goes to the feedback's next button, else the question, else the activity's first control, else its
     heading, never to the page itself */
  _focusLost(){
    const S=Engine.shell,sec=document.querySelector('main > section.on');if(!sec||sec.id==='shHome')return;
    const vis=e=>!!e&&e.getClientRects().length>0,go=e=>{if(!e.hasAttribute('tabindex')&&!e.matches('button,a[href],input,select,textarea'))e.tabIndex=-1;try{e.focus({preventScroll:true})}catch(x){}};
    const end=sec.querySelector('.sh-end');
    if(vis(end)){const h=[...end.querySelectorAll('.sh-end-h,.sh-end-rvh')].find(vis);if(h){go(h);return}}
    const nx=[...sec.querySelectorAll('.sh-fbnav button:not(:disabled)')].find(vis);
    if(nx){go(nx);return}
    const q=[...sec.querySelectorAll('[data-r="q"],.sh-round .big')].find(vis);
    if(q){go(q);return}
    const c=[...sec.querySelectorAll('[data-primary]')].filter(vis)
      .map(p=>p.matches('button,input,select,textarea,[tabindex]')?p:p.querySelector('button:not(:disabled),input:not(:disabled),select,textarea,[tabindex]:not([tabindex="-1"])'))
      .find(x=>vis(x)&&!x.disabled);
    if(c){go(c);return}
    S._focusView(S.view);
  },
  /* ---------- screen readers and keys across the activities (W8: A1, A2, A4) ----------
     - #shLive: one polite live region, always on the page (an empty panel is display:none, and a region that appears with
       its words is often not read). Every feedback panel (.sh-fb, and the fit pass's .fit-fb) of the open activity is read
       through it once when its words change: the verdict and explanation, without its buttons. The panels lose their own
       role="status" (they would be read twice). A panel that speaks also describes the inputs of its activity
       (aria-describedby), so an input error stays tied to its field.
     - .seg (a level or filter switch): a group of toggle buttons, aria-pressed following class on; one Tab stop, the arrows
       move between its buttons.
     - the summary's pager: the left and right arrows go to the previous and next concept card.
     - the focus never falls to the page when the control tapped goes away (_focusLost). */
  PANELS:'.sh-fb,.fit-fb',
  _a11y(main){
    const S=Engine.shell,live=document.createElement('div');
    live.id='shLive';live.className='sh-sr';live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');
    document.body.appendChild(live);
    const quiet=p=>[p,...p.querySelectorAll('[role="status"],[aria-live]')].forEach(x=>{if(x.getAttribute('role')==='status')x.removeAttribute('role');x.removeAttribute('aria-live')});
    main.querySelectorAll(S.PANELS).forEach(quiet);
    main.querySelectorAll('.seg').forEach(g=>S._seg(g));
    if(typeof MutationObserver==='function')new MutationObserver(ms=>{
      const panels=new Map(),segs=new Set();
      for(const m of ms){
        const n=m.target.nodeType===1?m.target:m.target.parentElement;if(!n||!n.closest)continue;
        const p=n.closest(S.PANELS),content=m.type!=='attributes';
        if(p)panels.set(p,panels.get(p)||content);
        const g=n.closest('.seg');if(g)segs.add(g);
        for(const a of m.addedNodes||[])if(a.nodeType===1){
          for(const x of a.matches(S.PANELS)?[a]:a.querySelectorAll(S.PANELS)){quiet(x);panels.set(x,true)}
          for(const x of a.matches('.seg')?[a]:a.querySelectorAll('.seg'))segs.add(x);
        }
      }
      segs.forEach(g=>S._seg(g));
      panels.forEach((content,p)=>{quiet(p);S._panelSay(p,content)});
    }).observe(main,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','hidden','class']});
    /* the arrows of a level or filter switch */
    main.addEventListener('keydown',e=>{
      const b=e.target.closest&&e.target.closest('.seg button'),g=b&&b.closest('.seg');if(!g||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
      const bs=[...g.querySelectorAll('button')].filter(x=>!x.disabled&&x.getClientRects().length),j=S.keyMove(bs.length,bs.indexOf(b),e.key);
      if(j<0||bs[j]===b)return;e.preventDefault();bs.forEach(x=>{x.tabIndex=x===bs[j]?0:-1});bs[j].focus();
    });
    /* the summary's arrows: from the summary or the page itself, not from a field */
    document.addEventListener('keydown',e=>{
      if(S.view!=='sum'||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'))return;
      const t=e.target,sec=document.getElementById('sum');
      if(!sec||!sec.classList.contains('sum-cards')||!(t===document.body||t===document.documentElement||(t.closest&&t.closest('#sum'))))return;
      if(t.closest&&t.closest('input,select,textarea,.seg'))return;
      const k=S.sumI+(e.key==='ArrowLeft'?-1:1);if(k<0||k>=S.sumN)return;
      e.preventDefault();S._sumGo(k);
      /* the focus was on the card that went (its heading): it goes to the new card's heading, as when the summary opens */
      const a=document.activeElement;if(!a||a===document.body||!a.getClientRects().length)S._focusView('sum');
    });
    /* a tapped control that left the page with its screen: the focus goes on (see _focusLost). Seen in the capture phase,
       before the control's own handler takes it out of the page. The focus counts as lost also while it still sits on a
       control that is hidden or disabled: Chrome moves it to the page only at its next rendering, after this timeout (a
       verdict panel that hides the action row with its check button) */
    const shown=x=>x.isConnected&&!x.closest('[disabled],[hidden]')&&x.getClientRects().length>0;
    document.addEventListener('click',e=>{const t=e.target;if(!t||typeof t.closest!=='function'||!t.closest('main'))return;
      setTimeout(()=>{if(shown(t))return;const a=document.activeElement;if(a&&a!==document.body&&a!==document.documentElement&&shown(a))return;S._focusLost()},0)},true);
  },
  /* reads text out through #shLive (cleared first, so the same words are read again) */
  announce(text){
    const S=Engine.shell,el=document.getElementById('shLive'),t=String(text==null?'':text).replace(/\s+/g,' ').trim();
    if(!el||!t)return;
    clearTimeout(S._liveT);el.textContent='';S._liveT=setTimeout(()=>{el.textContent=t},60);
  },
  /* the words a panel shows: its text on view, without buttons, hidden parts or icons; '' when it is not shown */
  _panelText(p){
    if(!p||!p.getClientRects().length)return '';
    const out=[],walk=n=>{for(const c of n.childNodes){
      if(c.nodeType===3){out.push(c.data);continue}
      if(c.nodeType!==1||c.tagName==='BUTTON'||c.tagName==='svg'||c.getAttribute('aria-hidden')==='true'||c.classList.contains('sh-fbnav'))continue;
      if(!c.getClientRects().length)continue;
      walk(c);if(/^(DIV|P|LI|UL|OL|BR|H\d)$/.test(c.tagName))out.push(' ');
    }};
    walk(p);return out.join('').replace(/\s+/g,' ').trim();
  },
  /* a panel of the open activity changed: its words are said once (again only when it was written anew, a second or more
     later), and they describe the activity's inputs */
  _panelSay(p,content){
    const S=Engine.shell;
    if(!p.closest('main > section.on')){p._shSaid='';return}
    const t=S._panelText(p),now=Date.now();
    if(!t){p._shSaid='';return}
    if(t===p._shSaid&&!(content&&now-(p._shAt||0)>1000))return;
    p._shSaid=t;p._shAt=now;S.announce(t);
    const sec=p.closest('main > section');if(!p.id)p.id='shFb'+(S._fbN=(S._fbN||0)+1);
    sec.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(i=>{const d=(i.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);
      if(!d.includes(p.id)){d.push(p.id);i.setAttribute('aria-describedby',d.join(' '))}});
  },
  /* a level or filter switch: a named group, aria-pressed from class on (when the page marks it so), one Tab stop */
  _seg(g){
    if(!g||!g.isConnected)return;
    if(!g.hasAttribute('role'))g.setAttribute('role','group');
    if(!g.hasAttribute('aria-label')&&!g.hasAttribute('aria-labelledby'))g.setAttribute('aria-label',g.classList.contains('sh-level')?'Επίπεδο':g.id==='fcFilter'?'Κατηγορία καρτών':'Επιλογή');
    const bs=[...g.querySelectorAll('button')];if(!bs.length)return;
    const byClass=bs.some(b=>b.classList.contains('on'));
    bs.forEach(b=>{if(byClass){const v=String(b.classList.contains('on'));if(b.getAttribute('aria-pressed')!==v)b.setAttribute('aria-pressed',v)}});
    if(!g.contains(document.activeElement)){const on=bs.find(b=>b.getAttribute('aria-pressed')==='true')||bs[0];bs.forEach(b=>{const v=b===on?0:-1;if(b.tabIndex!==v)b.tabIndex=v})}
  },
  /* opens a tab through its #tabs button (sections, tab hooks, rewards guide), as a click on the old tab row did */
  open(t){const b=$$('#tabs button[data-t]').find(x=>x.dataset.t===t);if(b)b.click()},
  /* the chapter home; o.group scrolls to that group and focuses its heading; coming back from an activity focuses its tile */
  home(o){
    const S=Engine.shell;if(!S.ready)return;
    const a=o||{},from=S.view;
    $$('#tabs button').forEach(x=>x.classList.remove('on'));
    $$('main section').forEach(s=>s.classList.toggle('on',s.id==='shHome'));
    Engine.tabHooks.forEach(f=>{try{f('home')}catch(e){console.error(e)}});
    S.refresh();
    const to=Number.isInteger(a.group)?document.getElementById('shGrp'+a.group)
      :from&&from!=='home'?$$('#shGroups [data-t]').find(x=>x.dataset.t===from)||null:null;
    if(to){try{to.scrollIntoView({block:Number.isInteger(a.group)?'start':'center'})}catch(e){}try{to.focus({preventScroll:true})}catch(e){}}
  },
  /* back: from an activity to the home; from the home to the notebooks (index.html), except in a self-contained copy (H6) */
  back(){const S=Engine.shell;if(S.view&&S.view!=='home')S.home({});else if(S.hub)location.href='index.html'},
  /* the sound toggle of the top bar (rewards-ui.js soundToggle draws the sound-off icon and toggles is-on): the sound-on
     icon beside it, engine-ui.css shows the one that matches the state */
  sound(){const b=document.getElementById('rwSnd');if(b&&b.querySelector('.icon-sound-off')&&!b.querySelector('.icon-sound-on'))b.insertAdjacentHTML('beforeend',Engine._icon('sound-on'))},
  /* an end-of-round screen (Engine._endScreen) or its review is on screen */
  _endOpen(){const end=document.querySelector('main section.on .sh-end');return !!(end&&end.getClientRects().length)},
  /* the owl's lines (D7): the Γ΄ pages write their mascot's hint and cheer lines into #owlSay, inside the page header the
     shell hides. Each new line shows for 4 to 7 s (longer for a longer line) in a note of up to two lines in the top bar, in
     the label's place (G2: never over a control, and no activity moves; the label stays for screen readers); a tap on a
     cut line opens the whole line, the top bar growing to hold it (it stays a while longer; an answered round refits,
     Engine._refit), a tap on a whole one closes it, Escape closes it either way (S._owlHide). The whole line is read politely
     (Engine.shell.announce), also while an end-of-round screen or its review is open, where the note does not show. Not
     on the chapter home (the page's greeting there points at the old tab row). */
  _owl(){
    const S=Engine.shell,say=document.getElementById('owlSay');
    if(!say||typeof MutationObserver!=='function')return;
    /* W8: the note is drawn hidden between lines (not in the accessibility tree), so its words go through #shLive (announce) */
    const n=document.createElement('div');n.id='shOwl';n.className='sh-owl';n.setAttribute('aria-hidden','true');
    n.innerHTML=`<span class="sh-owlface" aria-hidden="true">${Engine._icon('mascot-owl')}</span><span class="sh-owlt"></span>`;
    const lab=document.getElementById('shLabel');
    if(lab)lab.after(n);else document.body.appendChild(n);
    const t=n.querySelector('.sh-owlt'),hide=()=>{clearTimeout(S._owlT);n.classList.remove('on','open')},later=ms=>{clearTimeout(S._owlT);S._owlT=setTimeout(hide,ms)};
    S._owlHide=hide;
    n.addEventListener('click',()=>{if(!n.classList.contains('open')&&t.scrollHeight>t.clientHeight+1){n.classList.add('open');later(8000);Engine._refit()}else hide()});
    /* P8: the line as printed and read, without its emoji (the page's own #owlSay keeps them) */
    new MutationObserver(()=>{const x=say.textContent.replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200D\uFE0F\u20E3]/gu,'').replace(/\s+([.,;:!?])/g,'$1').replace(/\s+/g,' ').trim();if(!x||!S.view||S.view==='home')return;
      S.announce(x);
      if(S._endOpen()){hide();return}
      t.textContent=x;n.classList.remove('open');n.classList.add('on');later(Math.max(4000,Math.min(7000,2500+x.length*40)));Engine._refit()})
      .observe(say,{childList:true,characterData:true,subtree:true});
    Engine.onTab(()=>{if(S.view==='home')hide()});
  },
  _text(id,t){const e=document.getElementById(id);if(e&&e.textContent!==t)e.textContent=t},
  /* innerHTML only when it changed: a redraw after an answer or a tab change keeps the focus on an unchanged tile or row */
  _html(e,h){if(e&&e._shHtml!==h){e.innerHTML=h;e._shHtml=h}},
  /* tab hook: the label, the back button, the bottom bar and the rail follow the open view */
  _view(t){
    const S=Engine.shell,H=document.documentElement,home=t==='home',g=home?-1:Engine._tabGroup(t);
    S.view=t;
    H.setAttribute('data-sh-view',home?'home':g===3?'parent':'g'+g);
    H.classList.toggle('sh-barvis',!home&&g!==2&&S.barN>0);
    const tab=S.tabs.find(x=>x[0]===t);
    S._text('shCtx',home?S.ctx:[S.head,S.title].filter(Boolean).join(', '));
    S._text('shTitle',home||!tab?S.title:S.name(tab[1]));
    S._labFit();
    /* the label's name is its whole text (the phone cuts it with an ellipsis); the page title follows the view */
    const lab=document.getElementById('shLabel'),full=home||!tab?[S.title,S.ctx]:[S.name(tab[1]),S.head,S.title];
    if(lab)lab.setAttribute('aria-label',full.filter(Boolean).join(', '));
    if(S.docTitle)document.title=home||!tab?S.docTitle:`${S.name(tab[1])}, ${S.docTitle}`;
    const back=document.getElementById('shBack');
    if(back){back.classList.toggle('sh-off',home&&!S.hub);back.setAttribute('aria-label',home?'Όλα τα τετράδια':'Πίσω στο κεφάλαιο')}
    $$('#shBar [data-g]').forEach(b=>{const on=+b.dataset.g===g;b.classList.toggle('on',on);if(on)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
    const bar=document.getElementById('shBar');if(bar){bar._roveT=null;S._roveFix(bar,'button[data-g]')}
    S._railOn();
    const m=document.querySelector('main');if(m)m.scrollTop=0;
    const sec=home?null:document.getElementById(t),end=sec&&sec.querySelector('.sh-end');if(end)Engine._endModal(end);   /* an end screen left open */
    /* the summary: read at once when it fits the screen (checked once it is laid out); a game without a progress row
       counts as played once it is opened (it has no answer to check) */
    if(t==='sum'){S._sumGo(S.sumI);setTimeout(()=>S._readCheck(),300)}
    if(g===1&&!S.rowFor(t,typeof PG_ROWS!=='undefined'?PG_ROWS:[],S.rowTab))S.played();
  },
  /* the summary's end is on screen (within 32 px) while the summary is open: the whole summary («Όλη η σύνοψη») scrolled
     to its end inside its frame (the concept cards count by the pager, _sumGo), or main without the pager */
  _readCheck(){
    const S=Engine.shell,sec=document.getElementById('sum');
    if(S.view!=='sum'||(S.path&&S.path.read))return;
    const b=sec&&sec.classList.contains('sum-frame')?sec.querySelector('.sum-body'):null,m=b||document.querySelector('main');
    if(!m||(b&&!sec.classList.contains('sum-full')))return;
    if(m.scrollHeight-m.scrollTop-m.clientHeight<=32)S.markSummaryRead();
  },
  /* P4 (round 3 polish): on the start view below the rail a title that does not fit two lines takes the context line's
     place on three lines, then a smaller size (classes sh-lab3, sh-lab14, sh-lab13 added in turn while it overflows,
     engine-ui.css); measured again on each view change, resize and once the fonts are in. Off the start view (and at the
     rail's width, where the title is one line) none is set. */
  _labFit(){
    const lab=document.getElementById('shLabel'),t=document.getElementById('shTitle'),L=['sh-lab3','sh-lab14','sh-lab13'];
    if(!lab||!t)return;
    lab.classList.remove(...L);
    if(Engine.shell.view!=='home')return;
    for(const c of L){if(t.scrollHeight<=t.clientHeight+1)break;lab.classList.add(c)}
  },
  /* P6 (round 3 polish): the rail's list of activities fades out at its bottom edge while rows are hidden below it */
  _railCut(){
    const n=document.getElementById('shRNav');if(!n)return;
    const m=n.scrollHeight-n.clientHeight;n.classList.toggle('sh-rcut',m>1&&n.scrollTop<m-1);
  },
  _railOn(){const t=Engine.shell.view;$$('#shRail [data-t]').forEach(b=>{const on=b.dataset.t===t;b.classList.toggle('on',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
    const rn=document.getElementById('shRNav');if(rn){rn._roveT=null;Engine.shell._roveFix(rn,'.sh-rrow')}},
  /* redraws the chip, the home and the rail from the live store; runs after every PG.render and from rewards-ui.js guide() */
  refresh(){
    const S=Engine.shell;if(!S.ready||!window.PG||typeof PG.store!=='function')return;
    const ic=Engine._icon,esc=S.esc,rows=typeof PG_ROWS!=='undefined'&&Array.isArray(PG_ROWS)?PG_ROWS:[],prog=PG.store();
    const path=S._pathNow(rows,prog),locks={};
    if(path)for(const [t] of S.tabs)if(S.step(t)>path.level)locks[t]=true;
    const m=S.model({tabs:S.tabs,rows,progress:prog,rowTab:S.rowTab,locks}),st=S.stars(rows,prog);
    const pct=st&&st.max?Math.round(st.n/st.max*100):0,say=st?`${st.n} από ${st.max} αστέρια`:'';
    for(const gr of m.groups)for(const it of gr.items)if(it.t==='sum')it.done=!!(path&&path.read);
    /* the chip */
    const chip=document.getElementById('pgBtn');
    if(chip){S._text('shStars',st?String(st.n):'');chip.setAttribute('aria-label',st?'Η πρόοδός μου: '+say:'Η πρόοδός μου')}
    /* the home: chapter stars, then the groups */
    const hs=document.getElementById('shHStars');
    S._html(hs,st?`<span class="sh-hsn" role="img" aria-label="${say} στο κεφάλαιο">${ic('star',{size:26})}<b>${st.n}</b><span>/ ${st.max}</span></span><span class="sh-track"><span style="width:${pct}%"></span></span>`:'');
    S._text('shSay',S.say(path,S.tabs));
    /* the stages: badge (a tick done, the stage's number current, a padlock locked), name, the right side; then the tiles,
       a locked one dashed with a padlock (a tap says what opens it) */
    const gs=document.getElementById('shGroups'),WORD={done:'έτοιμο',cur:'τώρα',locked:'κλειδωμένο'};
    /* a locked tile or rail row: unavailable (aria-disabled; a tap still says why) and described by what opens it */
    const lockA=it=>` aria-disabled="true" aria-describedby="${S.whyId(it.t)}"`;
    S._html(gs,m.groups.map((gr,k)=>{const sd=S.side(path,gr),badge=sd.state==='done'?ic('tick'):sd.state==='locked'?ic('lock'):String(k+1);
      return `<div class="sh-grp is-${sd.state}" data-g="${gr.g}"><div class="sh-shead"><span class="sh-badge" aria-hidden="true">${badge}</span><h2 class="sh-ghead" id="shGrp${gr.g}" tabindex="-1">${esc(gr.name)}<span class="sh-sr">, ${WORD[sd.state]}</span></h2><span class="sh-gside">${sd.html}</span></div>
<div class="sh-tiles">${gr.items.map(it=>it.locked?`<button type="button" class="sh-tile is-locked" data-t="${esc(it.t)}" data-g="${it.g}"${lockA(it)}><span class="sh-tname">${esc(it.name)}<span class="sh-sr">, κλειδωμένο</span></span>${ic('lock')}</button>`
  :`<button type="button" class="sh-tile" data-t="${esc(it.t)}" data-g="${it.g}"><span class="sh-tname">${esc(it.name)}</span><span class="sh-tstate">${S.stateHtml(it)}</span></button>`).join('')}</div></div>`}).join(''));
    S._roveFix(gs,'.sh-tile');
    /* the rail */
    const rp=document.getElementById('shRProg');
    S._html(rp,st?`<span class="sh-track"><span style="width:${pct}%"></span></span><span class="sh-rstars" role="img" aria-label="${say}">${ic('star')}<b>${st.n} / ${st.max}</b></span>`:'');
    const rn=document.getElementById('shRNav');
    S._html(rn,m.groups.map(gr=>`<div class="sh-rgrp" role="group" aria-label="${esc(gr.name)}"><div class="sh-rghead" aria-hidden="true">${esc(gr.name)}</div>${gr.items.map(it=>
      `<button type="button" class="sh-rrow${it.locked?' is-locked':''}" data-t="${esc(it.t)}"${it.locked?lockA(it):''}><span class="sh-rname">${esc(it.name)}</span><span class="sh-rstate">${S.stateHtml(it)}</span></button>`).join('')}</div>`).join(''));
    S._railCut();S._labFit();   /* P6, P4: the rows may have changed, and the chip's star count the label's room */
    /* what opens each locked step, the description of its tile and row (W8) */
    S._html(document.getElementById('shWhyTxt'),S.tabs.filter(([t])=>locks[t]).map(([t])=>`<span id="${S.whyId(t)}">${esc(S.whyText(path,S.tabs,t))}</span>`).join(''));
    S._railOn();
  },

  /* ---------- the summary as concept cards (round 3, W6b; brief section 5, not drawn) ----------
     No page markup changes: the top-level blocks of #sum are split into cards by their structure (_sumSplit), each block
     marked with the cards it belongs to, and moved, never copied, into the frame's body (ids, tables a page fills later
     and its handlers stay). The card on screen shows its blocks only; «Όλη η σύνοψη» shows the summary whole, as before.
     The rule (_sumSplit), over the element children of #sum in order:
     - an h2 is the summary's title: no card (it shows in the whole summary);
     - an h3 or h4 is a heading: it goes on top of every card of the block that follows it (repeated on each);
     - a p is a lead line: it goes on top of the first card that follows it;
     - a block whose element children are all .card (a .grid3) gives one card per child;
     - any other block (a .card, a .callout, a table, a figure) is one card, never split;
     - a heading or lead line with nothing after it is a card of its own.
     nodes: [{tag, cards}] (cards: how many .card children when every element child is one, else 0). Returns the cards, each
     a list of [node, child] (child -1: the whole node). */
  _sumSplit(nodes){
    const out=[];let heads=[],leads=[];
    (Array.isArray(nodes)?nodes:[]).forEach((n,i)=>{
      const tag=String(n&&n.tag||'').toLowerCase(),k=n&&Number.isInteger(n.cards)&&n.cards>0?n.cards:0;
      if(tag==='h2')return;
      if(tag==='h3'||tag==='h4'){heads.push([i,-1]);return}
      if(tag==='p'){leads.push([i,-1]);return}
      if(k){for(let j=0;j<k;j++)out.push([...heads,...(j?[]:leads),[i,j]])}
      else out.push([...heads,...leads,[i,-1]]);
      heads=[];leads=[];
    });
    if(heads.length||leads.length)out.push([...heads,...leads]);
    return out;
  },
  sumI:0,sumN:0,
  _sumInit(){
    const S=Engine.shell,sec=document.getElementById('sum');
    if(!sec||sec.classList.contains('sum-frame')||typeof document.createElement!=='function')return;
    const ic=Engine._icon,kids=[...sec.children];
    if(!kids.length)return;
    const isCard=e=>e.classList.contains('card');
    const cards=S._sumSplit(kids.map(e=>({tag:e.tagName,cards:e.children.length&&[...e.children].every(isCard)?e.children.length:0})));
    if(!cards.length)return;
    /* each block (and each card of a .grid3) lists its cards in data-sc; a .grid3 split into cards is a box (sc-box) */
    const add=(e,k)=>{e.dataset.sc=e.dataset.sc?e.dataset.sc+' '+k:String(k)};
    cards.forEach((parts,k)=>parts.forEach(([i,j])=>{const e=kids[i];add(e,k);if(j>=0){e.classList.add('sc-box');add(e.children[j],k)}}));
    const top=document.createElement('div'),body=document.createElement('div'),acts=document.createElement('div');
    top.className='sh-prog sum-top';body.className='sh-body sum-body';acts.className='sh-actions sum-pager';
    top.innerHTML=`<div class="sum-dots" role="img"></div><span class="sh-count" aria-live="polite"></span><button type="button" class="sum-all" data-sum="all">${ic('book')}<span>Όλη η σύνοψη</span></button>`;
    acts.innerHTML=`<button type="button" class="sh-skip" data-sum="prev" aria-label="Προηγούμενη κάρτα">${ic('back')}</button><button type="button" class="sh-primary" data-sum="next" data-primary></button>`;
    kids.forEach(e=>body.appendChild(e));
    sec.append(top,body,acts);
    sec.classList.add('sh-frame','sum-frame','sum-cards');
    S.sumN=cards.length;S.sumI=0;
    sec.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-sum]');if(!b)return;const a=b.dataset.sum;
      if(a==='all')S._sumFull(!sec.classList.contains('sum-full'));
      else if(a==='prev')S._sumGo(S.sumI-1);
      else if(S.sumI<S.sumN-1)S._sumGo(S.sumI+1);
      else{const n=b.dataset.t;if(n)S.open(n);else S.home({})}});
    body.addEventListener('scroll',()=>S._readCheck(),{passive:true});
    S._sumGo(0,true);
  },
  /* the pager of card k of n, pure: i (k kept in range), the dots ('seen', 'cur' or ''), «3 από 7», whether there is a
     previous card, and last: the card on screen is the last one, which marks the summary read (the Κάρτες gate) */
  sumPager(k,n){
    const N=Number.isInteger(n)&&n>0?n:0,i=N?Math.max(0,Math.min(N-1,Number.isInteger(k)?k:0)):0,dots=[];
    for(let j=0;j<N;j++)dots.push(j===i?'cur':j<i?'seen':'');
    return {i,dots,count:N?`${i+1} από ${N}`:'',label:N?`Κάρτα ${i+1} από ${N}`:'',prev:i>0,last:N>0&&i===N-1};
  },
  /* the card k on screen; the last one marks the summary read. quiet: drawn only (at load, before anyone sees it) */
  _sumGo(k,quiet){
    const S=Engine.shell,sec=document.getElementById('sum');
    if(!sec||!sec.classList.contains('sum-frame')||!S.sumN)return;
    const p=S.sumPager(k,S.sumN),i=p.i,ic=Engine._icon;S.sumI=i;
    sec.querySelectorAll('[data-sc]').forEach(e=>e.classList.toggle('sc-on',e.dataset.sc.split(' ').includes(String(i))));
    const dots=sec.querySelector('.sum-dots');dots.innerHTML=p.dots.map(c=>`<i class="${c}"></i>`).join('');dots.setAttribute('aria-label',p.label);
    sec.querySelector('.sum-top .sh-count').textContent=p.count;
    const pv=sec.querySelector('[data-sum="prev"]'),had=document.activeElement===pv;pv.disabled=!p.prev;
    /* the next button; on the last card it leads on: the learning path's next activity, else the chapter start */
    const nb=sec.querySelector('[data-sum="next"]');let nx=null;
    if(had&&pv.disabled)try{nb.focus({preventScroll:true})}catch(e){}   /* a disabled button drops the focus (W8) */
    if(p.last&&!quiet){S.markSummaryRead();try{nx=S.nextTab()}catch(e){nx=null}if(nx==='sum'||!S.tabs.some(x=>x[0]===nx))nx=null}
    if(!p.last){nb.innerHTML=`Επόμενη${ic('chevron-right')}`;delete nb.dataset.t}
    else if(nx){nb.innerHTML=`${ic('play')}Συνέχισε: ${S.esc(S._tabName(S.tabs,nx))}`;nb.dataset.t=nx}
    else{nb.innerHTML='Στο κεφάλαιο';delete nb.dataset.t}
    const b=sec.querySelector('.sum-body');if(b)b.scrollTop=0;
  },
  /* the whole summary (true) or the cards (false) */
  _sumFull(on){
    const S=Engine.shell,sec=document.getElementById('sum');if(!sec)return;
    sec.classList.toggle('sum-full',on);sec.classList.toggle('sum-cards',!on);
    const a=sec.querySelector('[data-sum="all"]');
    if(a)a.innerHTML=on?`${Engine._icon('back')}<span>Μία μία</span>`:`${Engine._icon('book')}<span>Όλη η σύνοψη</span>`;
    const b=sec.querySelector('.sum-body');if(b)b.scrollTop=0;
    if(on)setTimeout(()=>S._readCheck(),300);else S._sumGo(S.sumI,true);
  },

  /* ---------- the learning path, DOM side (round 3, W3) ---------- */
  /* computes the path on the live store (the test date of a kid page counts), stores what it raised, keeps it in S.path;
     null without rewards.js (nothing is locked then) */
  _pathNow(rows,prog){
    const S=Engine.shell,R=window.Rewards;
    if(!R||typeof R.pathState!=='function'){S.path=null;return null}
    let testDate=null;
    try{testDate=Engine.kid&&typeof PG_ID==='string'&&typeof R.testDateFor==='function'?R.testDateFor(Engine.kid,PG_ID):null}catch(e){testDate=null}
    const st=R.pathState({page:S.page({tabs:S.tabs,rows,rowTab:S.rowTab,cardN:S.cardN}),rows,progress:prog,today:R.dayKey(new Date()),testDate});
    if(st.store&&window.PG&&typeof PG.keep==='function'){PG.keep(R.PATH,st.store);S._synced()}
    S.path=st;
    return st;
  },
  /* a stored path is a write like an answer: the cloud sync (engine/sync.js, when loaded) sends it a few seconds later, also
     when it comes while a sync cycle runs (a write on load or after a pull) */
  _synced(){try{if(window.Sync&&typeof Sync.touch==='function')Sync.touch()}catch(e){console.error(e)}},
  locked(t){const S=Engine.shell;return !!S.path&&S.step(t)>S.path.level},
  /* a tap on a locked step: what opens it, visible and announced (cleared first, so the same text is announced again) */
  why(t){
    const S=Engine.shell,msg=S.whyText(S.path,S.tabs,t),el=document.getElementById('shWhy');
    if(!msg||!el)return;
    clearTimeout(S._whyT);el.textContent='';
    S._whyT=setTimeout(()=>{el.textContent=msg;S._whyT=setTimeout(()=>{el.textContent=''},7000)},60);
  },
  /* the tab «Συνέχισε» opens: while a step is locked, the activity its gate waits for (the summary, the cards, the first
     game not played, the quiz or true/false); with nothing locked, Rewards.nextTab. undefined without a path */
  nextTab(){
    const S=Engine.shell,st=S.path,R=window.Rewards;
    if(!st)return undefined;
    const T=S.tabs.map(x=>x[0]);
    if(S.target(st,S.tabs)){const k=st.need;return k===1?'sum':k===2?'fc':k===3?st.left[0]:T.includes('quiz')?'quiz':'tf'}
    return R&&typeof R.nextTab==='function'?R.nextTab({rows:typeof PG_ROWS!=='undefined'?PG_ROWS:[],progress:PG.store(),tabs:T,bossUnlocked:true}):null;
  },
  /* the facts (W6 calls these from the new summary pager and cards): each stores once, then redraws */
  _fact(add){
    const S=Engine.shell,R=window.Rewards;
    if(!R||typeof R.mergePath!=='function'||typeof R.pathOf!=='function'||!window.PG||typeof PG.store!=='function'||typeof PG.keep!=='function')return false;
    try{
      const cur=R.pathOf(PG.store()),next=R.mergePath(cur,add);
      if(JSON.stringify(next)===JSON.stringify(cur))return false;
      PG.keep(R.PATH,next);S._synced();S.refresh();return true;
    }catch(e){console.error(e);return false}
  },
  markSummaryRead(){return Engine.shell._fact({read:true})},
  cardCount(n){const S=Engine.shell;if(Number.isInteger(n)&&n>=0&&n!==S.cardN){S.cardN=n;S.refresh()}},
  cardRated(i){return Number.isInteger(i)&&i>=0?Engine.shell._fact({rated:[i]}):false},
  /* an answer (or opening a game without a progress row) while a game of «Παίζω» is open: that game was played once */
  /* with a row key k (PG.hit, PG.setList): the game that owns the row, wherever it is written from (a late timer write after
     the child moved on marks only its own game), and nothing when its owner is no game or still locked; a key no tab owns
     (ch02 `miss` of the tab `dis`: the engine cannot know it, and it is written on load too) falls back to the game in view */
  played(k){
    const S=Engine.shell;if(!S.ready)return false;
    const own=typeof k==='string'?S.tabOfRow(k,S.tabs,typeof PG_ROWS!=='undefined'?PG_ROWS:[],S.rowTab):null,t=own||S.view;
    if(!t||S.step(t)!==2||!S.tabs.some(x=>x[0]===t)||(own&&S.locked(t)))return false;return S._fact({played:[t]})},
  /* the reverse of rowFor: the tab whose progress row is k, or null; the uncounted rows times_r (en01) and mountq (en01b,
     rewards.js EXCLUDED) belong to their games */
  tabOfRow(k,tabs,rows,map){
    const S=Engine.shell,T=(Array.isArray(tabs)?tabs:[]).filter(x=>Array.isArray(x)).map(x=>x[0]),al={times_r:'times',mountq:'mount'};
    if(Object.prototype.hasOwnProperty.call(al,k)&&T.includes(al[k]))return al[k];
    return T.find(t=>{const r=S.rowFor(t,rows,map);return !!r&&r[0]===k})||null;
  },
  /* the end of a quiz or true/false round (not a retry): 7 of 10 or better passes; only the quiz counts on a page with one */
  roundEnd(kind,score,total){
    const S=Engine.shell,R=window.Rewards,T=S.tabs.map(x=>x[0]);
    if(!R||typeof R.passes!=='function'||kind!==(T.includes('quiz')?'quiz':'tf')||!R.passes(score,total))return false;
    return S._fact({passed:true});
  },
  /* ---------- the activity frame, from page scripts (the contract at the top of engine-ui.css) ---------- */
  /* the section of where (a section id, or an element inside a section of main) */
  _sec(where){const el=typeof where==='string'?document.getElementById(where):where;if(!el||typeof el.closest!=='function')return null;return el.closest('main > section')},
  /* the filled share of a progress line in % (0 to 100): 0 with no total, a total of 0 or anything not a finite number */
  pct(done,total){const d=Number(done),T=Number(total),r=d/T;return Number.isFinite(r)&&T>0&&r>0?Math.round(Math.min(1,r)*1000)/10:0},
  /* the progress line of an activity: a bar and «done από total» (or text); creates the .sh-prog row when the section has none */
  progress(where,done,total,text){
    const sec=Engine.shell._sec(where);if(!sec)return null;
    let row=sec.querySelector('.sh-prog');
    if(!row){row=document.createElement('div');row.className='sh-prog';const h=sec.querySelector(':scope > h2');sec.insertBefore(row,h?h.nextSibling:sec.firstChild)}
    let bar=row.querySelector('.sh-line');
    if(!bar){bar=document.createElement('div');bar.className='sh-line';row.insertBefore(bar,row.firstChild)}
    let fill=bar.querySelector('span');   /* a page's own .sh-line may come without its span, or with text around it */
    if(!fill){fill=document.createElement('span');bar.appendChild(fill)}
    let c=row.querySelector('.sh-count');
    if(!c){c=document.createElement('span');c.className='sh-count';bar.insertAdjacentElement('afterend',c)}
    const d=Math.max(0,Number(done)||0),T=Math.max(0,Number(total)||0);
    fill.style.width=Engine.shell.pct(d,T)+'%';
    c.textContent=text!=null?String(text):`${d} από ${T}`;
    bar.setAttribute('role','img');bar.setAttribute('aria-label',c.textContent);
    return row;
  },
  /* the feedback panel of an activity: html shows it in place of the action row, null or '' empties and hides it */
  feedback(where,html){
    const sec=Engine.shell._sec(where);if(!sec)return null;
    let fb=sec.querySelector('.sh-fb');
    if(!fb){fb=document.createElement('div');fb.className='sh-fb';sec.appendChild(fb)}   /* read through #shLive (W8, _a11y) */
    const on=html!=null&&html!=='';
    fb.innerHTML=on?String(html):'';fb.hidden=!on;sec.classList.toggle('sh-fbon',on);
    return fb;
  }
};
