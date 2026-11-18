/* Η σχολική μας γωνιά · engine v1
   Shared by every page: styles, progress table, tabs, phone menu, cards, quiz, true/false and generic games.
   Pages load: engine.css, engine-content.css, (page styles), engine-ui.css, rewards.css, then engine.js (rewards.js and
   rewards-ui.js after it), then call Engine.start(...) or Engine.build(...). */
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
  _cheer(ok){ try{ if(typeof this.cheer==='function') this.cheer(ok); }catch(e){} },
  /* reward hook: runs only when engine/rewards.js is loaded; a reward error never breaks a game */
  _reward(fn, o){
    if(!window.Rewards) return null;
    let res = null;
    try{ res = Rewards[fn](o); }catch(e){ console.error(e); return null; }
    try{ if(window.RewardsUI && typeof RewardsUI.celebrate==='function') RewardsUI.celebrate(res); }catch(e){ console.error(e); }
    return res;
  },
  /* end-of-round review (audit L4), shared by the quiz, true/false and the final boss: a missed item is recorded once, in the
     order missed; the retry asks only those, shuffled */
  _missOnce(list, item){ if(!list.includes(item)) list.push(item); return list; },
  _retryList(list){ return shuffle(list); },
  /* misses = [{kind:'quiz'|'tf', item}]; '' when there are none. The question, the right answer and the explanation are the
     page's own item text, put in as HTML exactly as the rounds render them; the only other text is fixed here. */
  _reviewHtml(misses){
    if(!misses.length) return '';
    const li = misses.map(({kind, item}) => `<li class="rv-item"><div class="rv-q">${item[0]}</div><div class="rv-a"><span class="rv-ok" aria-hidden="true">✔</span> Σωστή απάντηση: <b>${kind === 'tf' ? (item[1] === true ? 'Σωστό' : 'Λάθος') : item[1][0]}</b></div>${item[2] ? `<div class="rv-ex">${item[2]}</div>` : ''}</li>`).join('');
    return `<div class="rv"><h3 class="rv-h">Τι να ξαναδώ</h3><ol class="rv-list">${li}</ol></div>`;
  },
  /* end screen of a quiz or true/false round: with no miss, exactly the result (head) and the again button as before; with
     misses, «Ξανά μόνο τα λάθη» beside the again button above the review list, so both stay at the top of a long list, and
     once more under a list of 4 or more. Every retry button has class rv-retry; the top one also gets retryId. */
  _endHtml(head, again, misses, retryId){
    if(!misses.length) return `<div style="text-align:center">${head}${again}</div>`;
    const rb = id => `<button class="btn rv-retry"${id ? ` id="${id}"` : ''}>Ξανά μόνο τα λάθη</button>`;
    return `<div style="text-align:center">${head}<div class="rv-btns">${rb(retryId)}${again}</div></div>${Engine._reviewHtml(misses)}${misses.length >= 4 ? `<div class="rv-btns rv-end">${rb()}</div>` : ''}`;
  },
  _retryTag: '<div class="rv-tag">🎯 Ξανά στα λάθη</div>',
  _retryLine(s, L, left){ return left ? `Σωστά τώρα: ${s} από ${L}. Δες ξανά όσα έμειναν.` : 'Τα διόρθωσες όλα! 🎉'; },

  /* ---------- start: progress table, tabs, home link, phone menu ---------- */
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
      $$('#tabs button').forEach(x => x.classList.toggle('on', x === b));
      $$('main section').forEach(s => s.classList.toggle('on', s.id === b.dataset.t));
      window.scrollTo({top:0, behavior:'smooth'});
      Engine.tabHooks.forEach(f => { try{ f(b.dataset.t); }catch(e){ console.error(e); } });
    });
    /* home link: shown when the family hub has been opened in this browser */
    const header = document.querySelector('header');
    if(header && !document.getElementById('homeLink'))
      header.insertAdjacentHTML('afterbegin', '<a id="homeLink" class="homebtn" href="index.html">🏠 Όλες οι σελίδες</a>');
    try{ if(localStorage.getItem('hub_seen')) document.getElementById('homeLink').style.display = 'inline-flex'; }catch(e){}
    Engine._mobile();
    try{ window.RewardsUI && RewardsUI.init && RewardsUI.init(); }catch(e){ console.error(e); }
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

  /* ---------- flashcards: cards = [[cat, question, answer, extra], ...] ---------- */
  flashcards(o){
    const CARDS = o.cards, TAGS = o.tags || {};
    const tagOf = c => TAGS[c[0]] || [String(c[0]).toUpperCase(), 'pi'];
    let fcDeck=[],fcI=0,fcCat='all',fcKnown=new Set(((PG.get('cards')||{}).list||[]).filter(i=>i<CARDS.length)),fcWrong=new Set(),fcSeen=false;
    const fcFiltered=()=>CARDS.map((c,i)=>i).filter(i=>fcCat==='all'||CARDS[i][0]===fcCat);
    /* self-rating needs the answer seen: both buttons stay disabled until the current card is flipped once */
    const fcRate=on=>{fcSeen=on;$('#fcYes').disabled=$('#fcNo').disabled=!on};
    /* the 8 hand-written pages carry their own markup with class="btn bad" */
    $('#fcNo').classList.replace('bad','later');
    function fcBuild(l){fcDeck=l;fcI=0;fcShow()}
    function fcShow(){
      const card=$('#fcCard'),was=card.classList.contains('flip');card.classList.remove('flip');fcRate(false);
      const paint=()=>{
        if(!fcDeck.length){$('#fcQ').textContent='Τέλεια! Δεν υπάρχουν λάθη για επανάληψη 🎉';['#fcA','#fcX','#fcCount','#fcKnown'].forEach(s=>$(s).textContent='');$('#fcTag').innerHTML=$('#fcTag2').innerHTML='';return}
        const c=CARDS[fcDeck[fcI]],t=tagOf(c),tg=`<span class="pill ${t[1]}">${t[0]}</span>`;
        $('#fcQ').innerHTML=c[1];$('#fcA').innerHTML=c[2];$('#fcX').innerHTML=c[3]||'';$('#fcTag').innerHTML=$('#fcTag2').innerHTML=tg;
        $('#fcCount').textContent=`Κάρτα ${fcI+1} από ${fcDeck.length}`;
        const k=fcDeck.filter(i=>fcKnown.has(i)).length;
        $('#fcKnown').textContent=`✓ ${k}  ·  ✗ ${fcDeck.filter(i=>fcWrong.has(i)).length}`;
        $('#fcProg').style.width=(k/fcDeck.length*100)+'%';
      };
      was?setTimeout(paint,300):paint();
    }
    const fcFlip=()=>{$('#fcCard').classList.toggle('flip');if(fcDeck.length)fcRate(true)};
    $('#fcCard').onclick=fcFlip;
    $('#fcCard').tabIndex=0;$('#fcCard').setAttribute('role','button');
    $('#fcCard').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fcFlip()}};
    $('#fcNext').onclick=()=>{if(fcDeck.length){fcI=(fcI+1)%fcDeck.length;fcShow()}};
    $('#fcPrev').onclick=()=>{if(fcDeck.length){fcI=(fcI-1+fcDeck.length)%fcDeck.length;fcShow()}};
    $('#fcYes').onclick=()=>{if(!fcDeck.length||!fcSeen)return;const i=fcDeck[fcI];fcKnown.add(i);fcWrong.delete(i);PG.setList('cards',[...fcKnown],CARDS.length);$('#fcNext').onclick()};
    $('#fcNo').onclick=()=>{if(!fcDeck.length||!fcSeen)return;const i=fcDeck[fcI];fcWrong.add(i);fcKnown.delete(i);PG.setList('cards',[...fcKnown],CARDS.length);$('#fcNext').onclick()};
    $('#fcShuffle').onclick=()=>fcBuild(shuffle(fcDeck.length?fcDeck:fcFiltered()));
    $('#fcRetry').onclick=()=>fcBuild(shuffle(fcFiltered().filter(i=>fcWrong.has(i))));
    $$('#fcFilter button').forEach(b=>b.onclick=()=>{$$('#fcFilter button').forEach(x=>x.classList.toggle('on',x===b));fcCat=b.dataset.c;fcBuild(fcFiltered())});
    fcBuild(fcFiltered());
  },

  /* ---------- quiz: items = [[question, [correct, wrong, wrong, wrong], explanation], ...] ---------- */
  quiz(o){
    const Q = o.items, N = o.n || 10;
    Engine.bossItems.quiz = Q;
    let qz;
    /* retry: the misses of the round before (audit L4); a retry round records every answer but never ends a reward round */
    function qzStart(retry){qz={list:retry?Engine._retryList(retry):shuffle(Q).slice(0,N),i:0,score:0,answered:false,miss:[],retry:!!retry};qzShow()}
    function qzShow(){
      const box=$('#quizBox');
      if(qz.i>=qz.list.length){
        const s=qz.score,L=qz.list.length,r=s/L,m=qz.miss,stars=r>=.9?'🌟🌟🌟':r>=.7?'🌟🌟':r>=.5?'🌟':'💪';Engine._cheer(r>=.7);
        if(!qz.retry)Engine._reward('onRoundEnd',{pageId:PG_ID,kid:Engine.kid,kind:'quiz',score:s,total:L});
        const head=qz.retry?`<div style="font-size:44px">${m.length?'💪':'🌟'}</div><div class="big">${s} / ${L}</div><p>${Engine._retryLine(s,L,m.length)}</p>`
          :`<div style="font-size:44px">${stars}</div><div class="big">${s} / ${L}</div><p>${r>=.9?'Εξαιρετικά!':r>=.7?'Πολύ καλά! Λίγη επανάληψη ακόμα.':'Ας δούμε ξανά τις κάρτες και ξαναπροσπαθούμε!'}</p>`;
        box.innerHTML=Engine._endHtml(head,'<button class="btn" id="qzAgain">Νέο κουίζ 🔁</button>',m.map(item=>({kind:'quiz',item})),'qzRetry');
        $('#qzAgain').onclick=()=>qzStart();$$('#quizBox .rv-retry').forEach(b=>b.onclick=()=>qzStart(m));return;
      }
      const [q,opts,ex]=qz.list[qz.i],correct=opts[0],sh=shuffle(opts);
      qz.answered=false;
      box.innerHTML=`${qz.retry?Engine._retryTag:''}<div class="row" style="justify-content:space-between"><span class="score">Ερώτηση ${qz.i+1} / ${qz.list.length}</span><span class="score" id="qzScore">Σκορ: ${qz.score}</span></div>
  <div class="prog"><div style="width:${qz.i/qz.list.length*100}%"></div></div>
  <div class="big" style="margin:12px 0">${q}</div>
  ${sh.map((o,k)=>`<button class="opt" data-k="${k}">${String.fromCharCode(945+k)}) ${o}</button>`).join('')}<div id="qzEx"></div>`;
      $$('#quizBox .opt').forEach(b=>b.onclick=()=>{
        if(qz.answered)return;qz.answered=true;Engine.seenItems.add(qz.list[qz.i]);
        const ok=sh[b.dataset.k]===correct;if(ok)qz.score++;else Engine._missOnce(qz.miss,qz.list[qz.i]);$('#qzScore').textContent=`Σκορ: ${qz.score}`;PG.hit('quiz',ok);Engine._cheer(ok);
        $$('#quizBox .opt').forEach(x=>{x.disabled=true;if(sh[x.dataset.k]===correct)x.classList.add('right')});
        if(!ok)b.classList.add('wrong');
        $('#qzEx').innerHTML=`<div class="expl"><b style="color:${ok?'var(--ok)':'var(--bad)'}">${ok?'Σωστά! ':'Όχι ακριβώς. '}</b>${ex||''}</div><div style="margin-top:12px;text-align:right"><button class="btn" id="qzNext">${qz.i+1<qz.list.length?'Επόμενη ▶':'Αποτέλεσμα'}</button></div>`;
        $('#qzNext').onclick=()=>{qz.i++;qzShow()};
      });
    }
    qzStart();
  },

  /* ---------- true/false: items = [[statement, true|false, explanation], ...] ---------- */
  truefalse(o){
    const TF = o.items, N = o.n || 12;
    Engine.bossItems.tf = TF;
    let tf;
    /* retry: as in the quiz (audit L4) */
    function tfStart(retry){tf={list:retry?Engine._retryList(retry):shuffle(TF).slice(0,N),i:0,score:0,streak:0,best:0,done:false,t0:Date.now(),miss:[],retry:!!retry};tfShow()}
    function tfShow(){
      const box=$('#tfBox');
      if(tf.i>=tf.list.length){
        const sec=Math.round((Date.now()-tf.t0)/1000),L=tf.list.length,r=tf.score/L,m=tf.miss;Engine._cheer(r>=.75);
        if(!tf.retry)Engine._reward('onRoundEnd',{pageId:PG_ID,kid:Engine.kid,kind:'tf',score:tf.score,total:L});
        const head=tf.retry?`<div style="font-size:44px">${m.length?'💪':'🌟'}</div><div class="big">${tf.score} / ${L}</div><p>${Engine._retryLine(tf.score,L,m.length)}</p>`
          :`<div style="font-size:44px">${r>=.9?'🏆':r>=.75?'🌟':'💪'}</div><div class="big">${tf.score} / ${L}</div><p>Καλύτερο σερί: 🔥 ${tf.best} · Χρόνος: ${sec} δευτερόλεπτα</p>`;
        box.innerHTML=Engine._endHtml(head,'<button class="btn" id="tfAgain">Ξανά 🔁</button>',m.map(item=>({kind:'tf',item})),'tfRetry');
        $('#tfAgain').onclick=()=>tfStart();$$('#tfBox .rv-retry').forEach(b=>b.onclick=()=>tfStart(m));return;
      }
      const [s]=tf.list[tf.i];tf.done=false;
      const tfTop=()=>{$('#tfScore').textContent=`${tf.i+1} / ${tf.list.length} · Σκορ ${tf.score}`;$('#tfStreak').textContent=`🔥 ${tf.streak}`};
      box.innerHTML=`${tf.retry?Engine._retryTag:''}<div class="row" style="justify-content:space-between"><span class="score" id="tfScore"></span><span class="streak" id="tfStreak"></span></div>
   <div class="prog"><div style="width:${tf.i/tf.list.length*100}%"></div></div>
   <div class="big" style="text-align:center;margin:26px 6px 6px">${s}</div>
   <div class="tf"><button class="btn ok" id="tfT">✔ Σωστό</button><button class="btn bad" id="tfF">✘ Λάθος</button></div><div id="tfEx"></div>`;
      tfTop();
      const ans=v=>{if(tf.done)return;tf.done=true;Engine.seenItems.add(tf.list[tf.i]);const [,truth,ex]=tf.list[tf.i],ok=v===truth;
        if(ok){tf.score++;tf.streak++;tf.best=Math.max(tf.best,tf.streak)}else{tf.streak=0;Engine._missOnce(tf.miss,tf.list[tf.i])}tfTop();PG.hit('tf',ok);Engine._cheer(ok);
        $('#tfT').disabled=$('#tfF').disabled=true;
        $('#tfEx').innerHTML=`<div class="expl"><b style="color:${ok?'var(--ok)':'var(--bad)'}">${ok?'Μπράβο!':'Ωπ!'}</b> Η πρόταση είναι <b>${truth?'Σωστή':'Λάθος'}</b>. ${ex||''}</div><div style="text-align:right;margin-top:10px"><button class="btn" id="tfNext">Επόμενη ▶</button></div>`;
        $('#tfNext').onclick=()=>{tf.i++;tfShow()};};
      $('#tfT').onclick=()=>ans(true);$('#tfF').onclick=()=>ans(false);
    }
    tfStart();
  },

  /* ---------- memory: pairs = [[left, right], ...]; 6 random pairs per game ---------- */
  memory(o){
    const box=$(o.el), key=o.key||'mem', N=o.n||6, good=o.goodMoves||N*2;
    box.innerHTML=`<div class="row" style="justify-content:space-between"><span class="score" data-r="info"></span><button class="btn ghost" data-r="new">🔄 Νέο παιχνίδι</button></div><div class="mem" data-r="grid"></div><div class="expl" data-r="fb" style="display:none"></div>`;
    const R=n=>box.querySelector(`[data-r="${n}"]`);let m;
    const info=()=>R('info').textContent=`Κινήσεις: ${m.moves} · Ζευγάρια: ${m.done} / ${m.pairs.length}`;
    function start(){
      const pairs=shuffle(o.pairs).slice(0,N);
      const cards=shuffle(pairs.flatMap((p,i)=>[{id:i,t:p[0]},{id:i,t:p[1]}]));
      m={cards,pairs,open:[],done:0,moves:0,lock:false};
      R('grid').innerHTML=cards.map((c,k)=>`<div class="mcard" data-k="${k}">${c.t}</div>`).join('');
      R('grid').querySelectorAll('.mcard').forEach(d=>d.onclick=()=>tap(+d.dataset.k,d));
      R('fb').style.display='none';info();
    }
    function tap(k,d){
      if(m.lock||d.classList.contains('up')||d.classList.contains('done'))return;
      d.classList.add('up');m.open.push([k,d]);if(m.open.length<2)return;
      m.moves++;const [[k1,d1],[k2,d2]]=m.open;m.open=[];
      if(m.cards[k1].id===m.cards[k2].id){d1.classList.add('done');d2.classList.add('done');m.done++;
        if(m.done===m.pairs.length){const ok=m.moves<=good;PG.hit(key,ok);Engine._cheer(ok);R('fb').style.display='block';
          R('fb').innerHTML=`<b style="color:var(--ok)">Τελείωσες σε ${m.moves} κινήσεις! ${m.moves<=Math.round(good*.75)?'🏆 Μνήμη ελέφαντα!':ok?'🌟 Πολύ καλά!':'💪 Ξαναπροσπάθησε με λιγότερες!'}</b><br>${m.pairs.map(p=>`${p[0]} ↔ ${p[1]}`).join(' · ')}`}}
      else{m.lock=true;setTimeout(()=>{d1.classList.remove('up');d2.classList.remove('up');m.lock=false},900)}
      info();
    }
    R('new').onclick=start;start();
  },

  /* ---------- sort into bins: bins = [[id, icon, label], ...]; items = [[text, binId, why], ...] ---------- */
  sort(o){
    const box=$(o.el), key=o.key||'sort', N=o.n||10;
    box.innerHTML=`<div class="row" style="justify-content:space-between"><span class="score" data-r="score"></span><span class="streak" data-r="streak"></span></div>
      <div class="prog"><div data-r="prog" style="width:0"></div></div>
      <div class="item-card" data-r="item"></div>
      <div class="bins" style="grid-template-columns:repeat(${Math.min(o.bins.length,3)},1fr)">${o.bins.map(b=>`<button class="bin" data-b="${b[0]}"><span class="ico">${b[1]}</span>${b[2]}</button>`).join('')}</div>
      <div data-r="fb"></div>`;
    const R=n=>box.querySelector(`[data-r="${n}"]`);let s;
    function start(){s={list:shuffle(o.items).slice(0,N),i:0,score:0,streak:0,done:false};show()}
    const sortTop=()=>{R('score').textContent=`${Math.min(s.i+1,s.list.length)} / ${s.list.length} · Σκορ ${s.score}`;R('streak').textContent=`🔥 ${s.streak}`};
    function show(){
      sortTop();
      R('prog').style.width=(s.i/s.list.length*100)+'%';R('fb').innerHTML='';
      if(s.i>=s.list.length){R('item').innerHTML=`<span class="emo">${s.score>=s.list.length*.8?'🏆':'💪'}</span>${s.score} / ${s.list.length}`;
        R('fb').innerHTML=`<div style="text-align:center;margin-top:10px"><button class="btn" data-r="again">Ξανά 🔁</button></div>`;R('again').onclick=start;return}
      s.done=false;R('item').innerHTML=s.list[s.i][0];
    }
    box.querySelectorAll('.bin').forEach(b=>b.onclick=()=>{
      if(!s||s.done||s.i>=s.list.length)return;s.done=true;const [t,right,why]=s.list[s.i],ok=b.dataset.b===right;
      if(ok){s.score++;s.streak++}else s.streak=0;sortTop();PG.hit(key,ok);Engine._cheer(ok);
      b.classList.add(ok?'flash-ok':'flash-bad');setTimeout(()=>b.classList.remove('flash-ok','flash-bad'),700);
      const rb=o.bins.find(x=>x[0]===right);
      R('fb').innerHTML=`<div class="expl"><b style="color:${ok?'var(--ok)':'var(--bad)'}">${ok?'Σωστά!':'Όχι.'}</b> ${ok?'':`Πάει στο «${rb[2]}». `}${why||''}</div><div style="text-align:right;margin-top:10px"><button class="btn" data-r="next">Επόμενο ▶</button></div>`;
      R('next').onclick=()=>{s.i++;show()};
    });
    start();
  },

  /* ---------- blitz: make() returns {q, a, opts:[wrong...]} or pass items like the quiz ---------- */
  blitz(o){
    const box=$(o.el), key=o.key||'blitz', T=o.seconds||60, goal=o.goal||15;
    let st={run:false},timer=null;
    const make=o.make||(()=>{const [q,opts]=pick(o.items);return {q,a:opts[0],opts:opts.slice(1)}});
    const stop=()=>{if(timer){clearInterval(timer);timer=null}st.run=false};
    function intro(){
      const best=((PG.get(key)||{}).list||[]).length;
      box.innerHTML=`<div style="text-align:center"><div style="font-size:54px">⏱️</div><p class="big">Έτοιμος;</p><p class="muted">Ρεκόρ σου: <b>${best}</b> σωστά σε ${T} δευτερόλεπτα · Στόχος: ${goal}</p><button class="btn" data-r="go" style="font-size:20px;padding:14px 28px">Ξεκίνα!</button></div>`;
      box.querySelector('[data-r="go"]').onclick=go;
    }
    function go(){
      stop();st={run:true,t:T,score:0,wrong:0};
      box.innerHTML=`<div class="blitz-top"><span class="streak" data-r="s">✔ 0</span><span class="timer" data-r="t">${T}</span></div><div class="prog"><div data-r="p" style="width:100%;background:var(--subj,var(--ink))"></div></div><div class="blitz-q" data-r="q"></div><div class="blitz-opts" data-r="o"></div>`;
      next();timer=setInterval(()=>{st.t--;tick();if(st.t<=0)end()},1000);
    }
    const R=n=>box.querySelector(`[data-r="${n}"]`);
    function tick(){const t=Math.max(0,st.t);R('t').textContent=t;R('t').classList.toggle('low',t<=10);R('p').style.width=(t/T*100)+'%'}
    function next(){
      const c=make(),opts=shuffle([c.a,...shuffle(c.opts).slice(0,3)]);
      R('q').innerHTML=c.q;R('o').innerHTML=opts.map(v=>`<button>${v}</button>`).join('');
      R('o').querySelectorAll('button').forEach((btn,k)=>btn.onclick=()=>{
        if(!st.run)return;const ok=String(opts[k])===String(c.a);btn.classList.add(ok?'ok':'no');
        if(ok){st.score++;R('s').textContent=`✔ ${st.score}`}else{st.wrong++;st.t-=3;tick();R('o').querySelectorAll('button').forEach((x,j)=>{if(String(opts[j])===String(c.a))x.classList.add('ok')})}
        if(st.t<=0){end();return}setTimeout(()=>{if(st.run)next()},ok?250:700);
      });
    }
    function end(){
      if(!st.run)return;stop();
      const prev=((PG.get(key)||{}).list||[]).length,rec=st.score>prev;if(rec)PG.setList(key,Array(st.score).fill(1),goal);Engine._cheer(rec);
      box.innerHTML=`<div style="text-align:center"><div style="font-size:54px">${rec?'🏆':st.score>=goal?'🌟':'💪'}</div><p class="big">${st.score} σωστά!</p><p>${rec?'<b>Νέο ρεκόρ!</b>':`Ρεκόρ: ${prev}`} · Λάθη: ${st.wrong}</p><button class="btn" data-r="again">Ξανά 🔁</button></div>`;
      box.querySelector('[data-r="again"]').onclick=go;
    }
    Engine.onTab(t=>{if(st.run&&!box.closest('section.on')){stop();intro()}});
    intro();
  },

  /* ---------- word search: words = ['ΛΕΞΗ', ...] (Greek capitals, no accents) ---------- */
  wordsearch(o){
    const box=$(o.el), key=o.key||'ws', SZ=o.size||10, A='ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
    box.innerHTML=`<div class="row" style="justify-content:space-between"><span class="score" data-r="info"></span><button class="btn ghost" data-r="new">🔄 Νέο κρυπτόλεξο</button></div><div class="wlist" data-r="list"></div><div id="ws" data-r="grid"></div><div data-r="fb"></div>`;
    const R=n=>box.querySelector(`[data-r="${n}"]`);let W;
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
    const info=()=>R('info').textContent=`Βρήκες ${W.found.size} από ${W.placed.length} λέξεις · Πάτα το πρώτο και το τελευταίο γράμμα`;
    function tap(i,d){
      W.sel.push(i);d.classList.add('sel');if(W.sel.length<2)return;
      const [a,b]=W.sel;W.sel=[];
      const hit=W.placed.find(p=>!W.found.has(p.w)&&((p.cells[0]===a&&p.cells[p.cells.length-1]===b)||(p.cells[0]===b&&p.cells[p.cells.length-1]===a)));
      R('grid').querySelectorAll('.sel').forEach(x=>x.classList.remove('sel'));
      PG.hit(key,!!hit);
      if(hit){W.found.add(hit.w);hit.cells.forEach(c=>R('grid').children[c].classList.add('found'));R('list').querySelector(`[data-w="${hit.w}"]`).classList.add('done');info();Engine._cheer(true);
        if(W.found.size===W.placed.length)R('fb').innerHTML=`<div class="expl"><b style="color:var(--ok)">Τα βρήκες όλα! 🎉</b></div>`}
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

  /* Shared driver of order, cloze and source: a play is a list of steps (a round, or one question of a text), each answered
     once (one PG.hit), with a counter, a live score, the explanation in a role="status" region and «Συνέχεια ▶». paint(step,
     body, answer) draws the step into body and calls answer(ok, html) once. Bad or empty data: a short note and one warning. */
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
    box.classList.add('gm','gm-'+type);
    box.innerHTML=`<div class="row" style="justify-content:space-between"><span class="score" data-r="count"></span><span class="score" data-r="score"></span></div>
      <div class="prog"><div data-r="prog" style="width:0"></div></div><div data-r="body"></div>
      <div data-r="fb" role="status"></div><div class="gm-nav" data-r="nav"></div>`;
    const R=n=>box.querySelector(`[data-r="${n}"]`);let st;
    /* arrow keys move between the buttons of one row (the pieces, the answer row, the choices), wrapping; Tab still works */
    box.addEventListener('keydown',e=>{
      const d={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key],row=d&&e.target.closest&&e.target.closest('.ord-pool,.ord-ans,.gm-opts');
      if(!row||!box.contains(row))return;const bs=[...row.querySelectorAll('button:not(:disabled)')],i=bs.indexOf(e.target);
      if(i<0)return;e.preventDefault();bs[(i+d+bs.length)%bs.length].focus();
    });
    const top=()=>{R('count').textContent=st.i<st.list.length?label(st.list[st.i],st):'';R('score').textContent=`Σκορ: ${st.score}`;
      R('prog').style.width=(Math.min(st.i,st.list.length)/st.list.length*100)+'%'};
    function start(focus){st={list:steps(Engine._draw(rounds,o.n)),i:0,score:0,done:false};show(focus)}
    function show(focus){
      R('fb').innerHTML='';R('nav').innerHTML='';top();
      if(st.i>=st.list.length){
        const s=st.score,L=st.list.length,r=s/L;Engine._cheer(r>=.7);
        R('body').innerHTML=Engine._endHtml(`<div style="font-size:44px">${r>=.9?'🌟🌟🌟':r>=.7?'🌟🌟':r>=.5?'🌟':'💪'}</div><div class="big gm-q" data-r="q" tabindex="-1">${s} / ${L}</div><p>${r>=.9?'Εξαιρετικά!':r>=.7?'Πολύ καλά!':'Ας το ξαναπροσπαθήσουμε!'}</p>`,'<button type="button" class="btn" data-r="again">Ξανά 🔁</button>',[]);
        R('again').onclick=()=>start(true);if(focus)R('q').focus();return;
      }
      st.done=false;paint(st.list[st.i],R('body'),answer);
      if(focus)R('q').focus();
    }
    function answer(ok, html){
      if(st.done)return;st.done=true;if(ok)st.score++;top();PG.hit(key,ok);Engine._cheer(ok);
      R('fb').innerHTML=`<div class="expl"><b style="color:${ok?'var(--ok)':'var(--bad)'}">${ok?'Σωστά! 🎉':'Όχι ακριβώς.'}</b> ${html}</div>`;
      R('nav').innerHTML=`<button type="button" class="btn" data-r="next">${st.i+1<st.list.length?'Συνέχεια ▶':'Αποτέλεσμα'}</button>`;
      R('next').onclick=()=>{st.i++;show(true)};R('next').focus({preventScroll:true});
    }
    start(false);
  },
  /* the right and wrong marks beside a choice or a placed item: a symbol for the eye, a word for a screen reader */
  _mark(ok){ return ok?'<span class="gm-mark" aria-hidden="true">✔</span><span class="gm-sr"> (σωστό)</span>':'<span class="gm-mark" aria-hidden="true">✘</span><span class="gm-sr"> (λάθος)</span>'; },
  /* the choice buttons of a cloze gap or a source question; pick(text, ok) after the answer is marked */
  _choiceRow(body, c, pick){
    const opts=Engine._deal(c), row=body.querySelector('.gm-opts');
    row.innerHTML=opts.map((t,k)=>`<button type="button" class="opt" data-k="${k}">${String.fromCharCode(945+k)}) ${t}</button>`).join('');
    row.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
      if(b.disabled)return;const ok=Engine._isRight(c,opts[b.dataset.k]);
      row.querySelectorAll('.opt').forEach(x=>{x.disabled=true;const r=opts[x.dataset.k]===c.right;
        if(r||x===b){x.classList.add(r?'right':'wrong');x.insertAdjacentHTML('beforeend',' '+Engine._mark(r))}});
      pick(ok);
    });
  },

  /* ---------- order: put the items in sequence. rounds = [[prompt, [item, ...], why], ...], item = text or [text, caption] ----------
     Tap an item to move it to the end of «Η σειρά σου», tap a placed one to take it back; «Έλεγχος» once all are placed. */
  order(o){
    const rounds=Engine._orderRounds(o.rounds);
    Engine._steps(o,'order',rounds,l=>l,(r,L)=>`Γύρος ${L.i+1} / ${L.list.length}`,(rd,body,answer)=>{
      const deal=Engine._orderDeal(rd),n=rd.items.length;let placed=[];
      body.innerHTML=`<div class="big gm-q" data-r="q" tabindex="-1">${rd.prompt||'Βάλε τα στη σωστή σειρά.'}</div>
        <p class="gm-lbl">Η σειρά σου <span class="muted" data-r="back">(πάτα ένα κομμάτι για να το πάρεις πίσω)</span></p><ol class="ord-ans" data-r="ans"></ol>
        <p class="gm-lbl" data-r="poolLbl">Πάτα τα κομμάτια με τη σωστή σειρά:</p><div class="ord-pool" role="group" aria-label="Κομμάτια" data-r="pool"></div>
        <div class="gm-act"><button type="button" class="btn" data-r="check" disabled>Έλεγχος ✓</button></div>`;
      const B=k=>body.querySelector(`[data-r="${k}"]`);
      const chip=(k,i)=>`<span class="ord-n" aria-hidden="true">${i+1}</span><span class="ord-t">${rd.items[k].t}</span>`;
      function draw(focus){
        const pool=deal.filter(k=>!placed.includes(k));
        B('ans').innerHTML=placed.map((k,i)=>`<li><button type="button" class="ord-chip" data-i="${i}">${chip(k,i)}</button></li>`).join('')
          +Array.from({length:n-placed.length},(_,j)=>`<li class="ord-slot" aria-hidden="true"><span class="ord-n">${placed.length+j+1}</span></li>`).join('');
        B('pool').innerHTML=pool.map(k=>`<button type="button" class="ord-chip" data-k="${k}"><span class="ord-t">${rd.items[k].t}</span></button>`).join('');
        B('poolLbl').hidden=!pool.length;B('check').disabled=placed.length<n;
        B('ans').querySelectorAll('button').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;placed.splice(i,1);draw(['ans',i])});
        B('pool').querySelectorAll('button').forEach((b,j)=>b.onclick=()=>{placed.push(+b.dataset.k);draw(['pool',j])});
        if(focus){const [w,i]=focus,list=B(w).querySelectorAll('button'),t=list[Math.min(i,list.length-1)]
          ||(w==='pool'?B('check'):B('pool').querySelector('button'));if(t&&!t.disabled)t.focus()}
      }
      draw(null);
      B('check').onclick=()=>{
        if(placed.length<n)return;const res=Engine._orderCheck(rd,placed),good=res.pos.filter(Boolean).length;
        B('ans').innerHTML=placed.map((k,i)=>`<li class="ord-done ${res.pos[i]?'right':'wrong'}">${chip(k,i)} ${Engine._mark(res.pos[i])}</li>`).join('');
        B('pool').remove();B('poolLbl').remove();B('back').remove();B('check').closest('.gm-act').remove();
        const list=rd.items.map(it=>`<li>${it.t}${it.c?` <span class="ord-cap">${it.c}</span>`:''}</li>`).join('');
        /* the right order: after a wrong answer, or to show the captions */
        answer(res.ok,`${res.ok?'':`Σωστές θέσεις: ${good} από ${n}.`}${!res.ok||rd.items.some(it=>it.c)?`<div class="ord-right"><b>Η σωστή σειρά:</b><ol>${list}</ol></div>`:''}${rd.why}`);
      };
    });
  },

  /* ---------- cloze: one gap and a few choices. rounds = [[text with one {_}, [correct, wrong, ...], why], ...] ---------- */
  cloze(o){
    const rounds=Engine._clozeRounds(o.rounds);
    Engine._steps(o,'cloze',rounds,l=>l,(r,L)=>`Πρόταση ${L.i+1} / ${L.list.length}`,(c,body,answer)=>{
      body.innerHTML=`<div class="big gm-q cz-s" data-r="q" tabindex="-1">${c.before}<span class="cz-gap" data-r="gap"><span class="gm-sr">(κενό)</span></span>${c.after}</div>
        <p class="gm-lbl">Τι ταιριάζει στο κενό;</p><div class="gm-opts"></div>`;
      Engine._choiceRow(body,c,ok=>{
        const g=body.querySelector('[data-r="gap"]');g.className='cz-fill';g.innerHTML=c.right;
        answer(ok,`${ok?'':`Η σωστή απάντηση: <b>${c.right}</b>. `}${c.why}`);
      });
    });
  },

  /* ---------- source: a short text and questions about it, the text kept on screen.
     rounds = [{title?, text, link?, questions: [[question, [correct, wrong, ...], why], ...]}, ...]; one PG.hit per question ---------- */
  source(o){
    const rounds=Engine._sourceRounds(o.rounds);let shown=null;
    const steps=list=>list.flatMap((src,t)=>src.questions.map((q,k)=>({src,q,t,k,T:list.length})));
    Engine._steps(o,'source',rounds,steps,s=>`Κείμενο ${s.t+1} / ${s.T}, ερώτηση ${s.k+1} / ${s.src.questions.length}`,(s,body,answer)=>{
      if(shown!==s.src||!body.querySelector('.src-box')){
        const src=s.src,long=src.text.replace(/<[^>]*>/g,'').length>600,txt=`<div class="src-text">${src.text}</div>`;
        body.innerHTML=`<article class="src-box">${src.title?`<h3 class="src-title">${src.title}</h3>`:''}
          ${long?`<details class="src-fold" open><summary>Το κείμενο</summary>${txt}</details>`:txt}
          ${src.link?`<p class="src-link"><a href="${src.link}" target="_blank" rel="noopener">Το πρωτότυπο κείμενο ↗<span class="gm-sr"> (ανοίγει σε νέα καρτέλα)</span></a></p>`:''}</article><div data-r="qa"></div>`;
        shown=src;
      }
      const qa=body.querySelector('[data-r="qa"]');
      qa.innerHTML=`<div class="big gm-q" data-r="q" tabindex="-1">${s.q.q}</div><div class="gm-opts"></div>`;
      Engine._choiceRow(qa,s.q,ok=>answer(ok,`${ok?'':`Η σωστή απάντηση: <b>${s.q.right}</b>. `}${s.q.why}`));
    });
  },

  /* ---------- build a whole page from data (new chapters) ---------- */
  build(cfg){
    const sub = cfg.subject || {};
    document.documentElement.lang='el';
    document.title = `${cfg.grade} · ${sub.name||''} · ${cfg.chapter||''} ${cfg.title}`.replace(/\s+/g,' ');
    document.body.classList.add('themed');
    if(sub.color){document.body.style.setProperty('--subj',sub.color);document.body.style.setProperty('--subj-soft',sub.soft||sub.color+'1f')}
    const tabs=[['sum','📘 Σύνοψη']];
    if(cfg.cards)tabs.push(['fc','🃏 Κάρτες']);
    if(cfg.quiz)tabs.push(['quiz','✅ Κουίζ']);
    if(cfg.tf)tabs.push(['tf','⚡ Σωστό ή Λάθος']);
    (cfg.games||[]).forEach(g=>tabs.push([g.id,g.tab]));
    tabs.push(['parent','👨‍👦 Για τον γονιό']);
    const lvl = cfg.level ? `<span class="lvl2">${cfg.level}</span>` : '';
    const games=(cfg.games||[]).map(g=>`<section id="${g.id}"><h2>${g.title||g.tab}</h2>${g.intro?`<p class="muted">${g.intro}</p>`:''}<div class="card" id="${g.id}Box">${g.html||''}</div></section>`).join('');
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
    document.getElementById('pgAll').innerHTML=`Συνολικά: <b>${all}%</b> · ${ok} ${ok===1?'σωστή απάντηση':'σωστές απαντήσεις'} σε ${n} ${n===1?'προσπάθεια':'προσπάθειες'}`;
  }
  const api={
    /* a stored record that is not an object starts fresh; a reward error never aborts the game's click handler */
    hit(k,ok){let s=S[k];if(!s||typeof s!=='object'||Array.isArray(s))s=S[k]={ok:0,n:0};
      if(window.Rewards){try{Rewards.pushResult(s,ok)}catch(e){console.error(e)}}else{s.n=(s.n||0)+1;s.ok=(s.ok||0)+(ok?1:0)}
      save();reward(k,rowType(k),ok);render()},
    /* keeps the reward fields best, hi and low across the list replacement; only a list longer than any this row had
       during this page load is an answer: an unchanged list (a redraw), a shorter one (a card marked «Όχι ακόμα») and a
       card toggled back to «Το ήξερα» never reach the reward layer */
    setList(k,list,total){const old=S[k]||{},rec={list,total},top=seen[k]||0,grew=list.length>top;seen[k]=Math.max(top,list.length);
      ['best','hi','low'].forEach(f=>{if(old[f]!==undefined)rec[f]=old[f]});S[k]=rec;save();if(grew)reward(k,'list',true);render()},
    put(k,obj){S[k]=obj;save();render()},
    get(k){return S[k]},
    store(){return S},
    /* clears ok, n, r, list and total; keeps best, hi, low and the whole _boss trophy; S stays the same object; then stamps
       S._reset with the reset time (rewards.js RESET), so a sync or backup merge never brings the cleared answers back */
    reset(){const at=window.Rewards&&Rewards.resetStamp?Rewards.resetStamp(S):new Date().toISOString();
      Object.keys(S).forEach(k=>{const s=S[k];if(k==='_boss'&&s&&typeof s==='object')return;const keep={};
      if(s&&typeof s==='object')['best','hi','low'].forEach(f=>{if(s[f]!==undefined)keep[f]=s[f]});
      if(Object.keys(keep).length)S[k]=keep;else delete S[k]});S._reset={at};save();render()},render
  };
  document.getElementById('pgBtn').onclick=e=>{e.stopPropagation();document.getElementById('pg').classList.toggle('open')};
  document.getElementById('pgPanel').onclick=e=>e.stopPropagation();
  document.addEventListener('click',()=>document.getElementById('pg').classList.remove('open'));
  const rb=document.getElementById('pgReset');let armed=false;
  rb.onclick=()=>{if(!armed){armed=true;rb.textContent='Σίγουρα; Πάτα ξανά';setTimeout(()=>{armed=false;rb.textContent='Μηδενισμός'},3000);return}
    armed=false;rb.textContent='Μηδενισμός';api.reset();try{location.reload()}catch(e){}};
  return api;
})();};

/* ===== phone and tablet layer ===== */
Engine._mobile=function(){/* ===== Mobile layer: bottom game menu, feedback auto-scroll ===== */
(function(){
  const tabs=[...document.querySelectorAll('#tabs button')];
  if(!tabs.length)return;
  const split=t=>{t=t.trim();const i=t.indexOf(' ');return i>0?[t.slice(0,i),t.slice(i+1)]:['•',t]};
  let hub=false;try{hub=!!localStorage.getItem('hub_seen')}catch(e){}
  const bar=document.createElement('div');bar.id='mbar';
  bar.innerHTML=(hub?'<a class="home" href="index.html" aria-label="Όλες οι σελίδες">🏠</a>':'')+'<button class="games pulse" type="button"><span>🎮</span><span class="cur"></span><span>▾</span></button>';
  const sheet=document.createElement('div');sheet.id='msheet';
  sheet.innerHTML='<div class="panel"><div class="top"><b>Τι θέλεις να παίξεις;</b><button type="button" aria-label="Κλείσιμο">✕</button></div><div class="grid"></div></div>';
  document.body.appendChild(bar);document.body.appendChild(sheet);
  const grid=sheet.querySelector('.grid'),gbtn=bar.querySelector('.games'),cur=bar.querySelector('.cur');
  /* same groups as the tab row (Engine._groupTabs): a group box with a heading, the parent tab apart */
  const labelled=document.getElementById('tabs').classList.contains('grouped');let box=null,gk=-1;
  tabs.forEach(t=>{const [e,l]=split(t.textContent);const b=document.createElement('button');b.type='button';b.dataset.t=t.dataset.t;
    if(/γονι/i.test(l))b.className='parent';b.innerHTML=`<span class="e">${e}</span><span>${l}</span>`;
    b.onclick=()=>{t.click();close()};
    const k=Engine._tabGroup(t.dataset.t);
    if(!labelled||k===3){grid.appendChild(b);return}
    if(k!==gk){gk=k;box=document.createElement('div');box.className='mgrp';box.setAttribute('role','group');box.setAttribute('aria-label',Engine.tabGroupNames[k]);
      box.innerHTML=`<div class="mlbl" aria-hidden="true">${Engine.tabGroupNames[k]}</div>`;grid.appendChild(box)}
    box.appendChild(b)});
  const sync=()=>{const on=tabs.find(t=>t.classList.contains('on'))||tabs[0];const [e,l]=split(on.textContent);cur.textContent=`${e} ${l}`;
    grid.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.t===on.dataset.t))};
  const open=()=>{sync();sheet.classList.add('open');gbtn.classList.remove('pulse');try{localStorage.setItem('menu_seen','1')}catch(e){}};
  const close=()=>sheet.classList.remove('open');
  try{if(localStorage.getItem('menu_seen'))gbtn.classList.remove('pulse')}catch(e){}
  gbtn.onclick=open;sheet.querySelector('.top button').onclick=close;sheet.onclick=e=>{if(e.target===sheet)close()};
  tabs.forEach(t=>t.addEventListener('click',()=>setTimeout(sync,0)));sync();
  /* when feedback appears below the fold (or under the keyboard), bring it into view */
  const mobile=()=>innerWidth<=1100;
  const seen=new WeakMap();
  const bringIntoView=el=>{if(!mobile()||!el.offsetParent)return;const r=el.getBoundingClientRect(),limit=innerHeight-96;
    if(r.top>limit-40||r.bottom>limit)el.scrollIntoView({behavior:'smooth',block:'center'})};
  new MutationObserver(ms=>{for(const m of ms){const el=m.target.nodeType===1?m.target:m.target.parentElement;if(!el)continue;
      const box=el.closest('.expl,[id$="Fb"]');if(box&&box.closest('section.on')){clearTimeout(seen.get(box));seen.set(box,setTimeout(()=>bringIntoView(box),120))}}})
    .observe(document.querySelector('main'),{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
  /* hide the keyboard after pressing a check button */
  document.addEventListener('click',e=>{if(!mobile())return;const b=e.target.closest('button');if(b&&document.activeElement&&document.activeElement.tagName==='INPUT'&&!b.closest('.keypad'))document.activeElement.blur()},true);
})();
};
