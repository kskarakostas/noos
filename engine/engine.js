/* Η σχολική μας γωνιά · engine v1
   Shared by every page: styles, progress table, tabs, phone menu, cards, quiz, true/false and generic games.
   Pages load: engine.css, (page styles), engine-ui.css, then engine.js, then call Engine.start(...) or Engine.build(...). */
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
    <button class="btn ghost" id="fcPrev">◀ Πίσω</button><button class="btn bad" id="fcNo">Όχι ακόμα</button><button class="btn ok" id="fcYes">Το ήξερα ✓</button><button class="btn ghost" id="fcNext">Επόμενη ▶</button>
  </div>
  <div class="row" style="justify-content:center;margin-top:10px"><button class="btn ghost" id="fcRetry">🔁 Επανάληψη λαθών</button></div>`; },
    quiz(){ return `<h2>Κουίζ πολλαπλής επιλογής</h2><div class="card" id="quizBox"></div>`; },
    tf(){ return `<h2>Σωστό ή Λάθος;</h2><p class="muted">Κάθε σωστή απάντηση στη σειρά ανεβάζει το 🔥.</p><div class="card" id="tfBox"></div>`; }
  },

  /* ---------- flashcards: cards = [[cat, question, answer, extra], ...] ---------- */
  flashcards(o){
    const CARDS = o.cards, TAGS = o.tags || {};
    const tagOf = c => TAGS[c[0]] || [String(c[0]).toUpperCase(), 'pi'];
    let fcDeck=[],fcI=0,fcCat='all',fcKnown=new Set(((PG.get('cards')||{}).list||[]).filter(i=>i<CARDS.length)),fcWrong=new Set();
    const fcFiltered=()=>CARDS.map((c,i)=>i).filter(i=>fcCat==='all'||CARDS[i][0]===fcCat);
    function fcBuild(l){fcDeck=l;fcI=0;fcShow()}
    function fcShow(){
      const card=$('#fcCard'),was=card.classList.contains('flip');card.classList.remove('flip');
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
    $('#fcCard').onclick=()=>$('#fcCard').classList.toggle('flip');
    $('#fcNext').onclick=()=>{if(fcDeck.length){fcI=(fcI+1)%fcDeck.length;fcShow()}};
    $('#fcPrev').onclick=()=>{if(fcDeck.length){fcI=(fcI-1+fcDeck.length)%fcDeck.length;fcShow()}};
    $('#fcYes').onclick=()=>{if(!fcDeck.length)return;const i=fcDeck[fcI];fcKnown.add(i);fcWrong.delete(i);PG.setList('cards',[...fcKnown],CARDS.length);$('#fcNext').onclick()};
    $('#fcNo').onclick=()=>{if(!fcDeck.length)return;const i=fcDeck[fcI];fcWrong.add(i);fcKnown.delete(i);PG.setList('cards',[...fcKnown],CARDS.length);$('#fcNext').onclick()};
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
    function qzStart(){qz={list:shuffle(Q).slice(0,N),i:0,score:0,answered:false};qzShow()}
    function qzShow(){
      const box=$('#quizBox');
      if(qz.i>=qz.list.length){
        const s=qz.score,L=qz.list.length,r=s/L,stars=r>=.9?'🌟🌟🌟':r>=.7?'🌟🌟':r>=.5?'🌟':'💪';Engine._cheer(r>=.7);
        Engine._reward('onRoundEnd',{pageId:PG_ID,kid:Engine.kid,kind:'quiz',score:s,total:L});
        box.innerHTML=`<div style="text-align:center"><div style="font-size:44px">${stars}</div><div class="big">${s} / ${L}</div><p>${r>=.9?'Εξαιρετικά!':r>=.7?'Πολύ καλά! Λίγη επανάληψη ακόμα.':'Ας δούμε ξανά τις κάρτες και ξαναπροσπαθούμε!'}</p><button class="btn" id="qzAgain">Νέο κουίζ 🔁</button></div>`;
        $('#qzAgain').onclick=qzStart;return;
      }
      const [q,opts,ex]=qz.list[qz.i],correct=opts[0],sh=shuffle(opts);
      qz.answered=false;
      box.innerHTML=`<div class="row" style="justify-content:space-between"><span class="score">Ερώτηση ${qz.i+1} / ${qz.list.length}</span><span class="score">Σκορ: ${qz.score}</span></div>
  <div class="prog"><div style="width:${qz.i/qz.list.length*100}%"></div></div>
  <div class="big" style="margin:12px 0">${q}</div>
  ${sh.map((o,k)=>`<button class="opt" data-k="${k}">${String.fromCharCode(945+k)}) ${o}</button>`).join('')}<div id="qzEx"></div>`;
      $$('#quizBox .opt').forEach(b=>b.onclick=()=>{
        if(qz.answered)return;qz.answered=true;
        const ok=sh[b.dataset.k]===correct;if(ok)qz.score++;PG.hit('quiz',ok);Engine._cheer(ok);
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
    function tfStart(){tf={list:shuffle(TF).slice(0,N),i:0,score:0,streak:0,best:0,done:false,t0:Date.now()};tfShow()}
    function tfShow(){
      const box=$('#tfBox');
      if(tf.i>=tf.list.length){
        const sec=Math.round((Date.now()-tf.t0)/1000),L=tf.list.length,r=tf.score/L;Engine._cheer(r>=.75);
        Engine._reward('onRoundEnd',{pageId:PG_ID,kid:Engine.kid,kind:'tf',score:tf.score,total:L});
        box.innerHTML=`<div style="text-align:center"><div style="font-size:44px">${r>=.9?'🏆':r>=.75?'🌟':'💪'}</div><div class="big">${tf.score} / ${L}</div><p>Καλύτερο σερί: 🔥 ${tf.best} · Χρόνος: ${sec} δευτερόλεπτα</p><button class="btn" id="tfAgain">Ξανά 🔁</button></div>`;
        $('#tfAgain').onclick=tfStart;return;
      }
      const [s]=tf.list[tf.i];tf.done=false;
      box.innerHTML=`<div class="row" style="justify-content:space-between"><span class="score">${tf.i+1} / ${tf.list.length} · Σκορ ${tf.score}</span><span class="streak">🔥 ${tf.streak}</span></div>
   <div class="prog"><div style="width:${tf.i/tf.list.length*100}%"></div></div>
   <div class="big" style="text-align:center;margin:26px 6px 6px">${s}</div>
   <div class="tf"><button class="btn ok" id="tfT">✔ Σωστό</button><button class="btn bad" id="tfF">✘ Λάθος</button></div><div id="tfEx"></div>`;
      const ans=v=>{if(tf.done)return;tf.done=true;const [,truth,ex]=tf.list[tf.i],ok=v===truth;
        if(ok){tf.score++;tf.streak++;tf.best=Math.max(tf.best,tf.streak)}else tf.streak=0;PG.hit('tf',ok);Engine._cheer(ok);
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
    function show(){
      R('score').textContent=`${Math.min(s.i+1,s.list.length)} / ${s.list.length} · Σκορ ${s.score}`;R('streak').textContent=`🔥 ${s.streak}`;
      R('prog').style.width=(s.i/s.list.length*100)+'%';R('fb').innerHTML='';
      if(s.i>=s.list.length){R('item').innerHTML=`<span class="emo">${s.score>=s.list.length*.8?'🏆':'💪'}</span>${s.score} / ${s.list.length}`;
        R('fb').innerHTML=`<div style="text-align:center;margin-top:10px"><button class="btn" data-r="again">Ξανά 🔁</button></div>`;R('again').onclick=start;return}
      s.done=false;R('item').innerHTML=s.list[s.i][0];
    }
    box.querySelectorAll('.bin').forEach(b=>b.onclick=()=>{
      if(!s||s.done||s.i>=s.list.length)return;s.done=true;const [t,right,why]=s.list[s.i],ok=b.dataset.b===right;
      if(ok){s.score++;s.streak++}else s.streak=0;PG.hit(key,ok);Engine._cheer(ok);
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
    /* clears ok, n, r, list and total; keeps best, hi, low and the whole _boss trophy; S stays the same object */
    reset(){Object.keys(S).forEach(k=>{const s=S[k];if(k==='_boss'&&s&&typeof s==='object')return;const keep={};
      if(s&&typeof s==='object')['best','hi','low'].forEach(f=>{if(s[f]!==undefined)keep[f]=s[f]});
      if(Object.keys(keep).length)S[k]=keep;else delete S[k]});save();render()},render
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
  tabs.forEach(t=>{const [e,l]=split(t.textContent);const b=document.createElement('button');b.type='button';b.dataset.t=t.dataset.t;
    if(/γονι/i.test(l))b.className='parent';b.innerHTML=`<span class="e">${e}</span><span>${l}</span>`;
    b.onclick=()=>{t.click();close()};grid.appendChild(b)});
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
