import {BIOMES,METRICS,STAT_SOURCES,FRAMES,PERSONALITY,profile,saveProfile,loadProfile,stats,rawStats,level,xpForLevel,weekKey,logActivity,CLASS_INFO,recommendedClass,recommendedPath,pathInfo,HYBRIDS,classUnlock,pathLocked,HYBRID_REQ,classReason,frame,weaponEligibility,myClasses,CLASS_WEAPON,WEAPON_LEVEL,caps,claimedStats,logLift,removeLift,liftRecords,liftSummary,unlockedTitles,weeklyPlan,checkPlanItem,uncheckPlanItem,testStatus,recordTest,growth,goalBoon,GOALS,setGoal,logWeighIn,nextWeighIn,localDay,percentile} from './profile.js';
import {mechanicsTable,ABILITIES,unlockedAbilities} from './mechanics.js';
import {WORKOUTS,WORKOUT_NOTE,EXERCISES,TITLES,e1rm} from './training.js';
import {createLinkCode,claimLinkCode} from './identity.js';
import {leaderboard,STAT_KEYS} from './leaderboard.js';
import {createMindCheck,iqFromTheta,canTakeReasoning,TEST_ITEMS,TIME_LIMIT,TEST_VERSION} from './reasoning.js';
import {lofi} from './music.js';
import {WEAPONS} from './combat/moves.js';
import {skillSlots,SKILLS} from './combat/skills.js';
import {SKIN_TONES,SHIRTS,TROUSERS,HAIR_COLORS,HAIR_STYLES,FACE_STYLES,OUTFITS} from './avatar.js';

// The intro, told by Mycel (narrator.js floats him around the screen). Each beat
// sets his mood; some show how the world turns real effort into power.
const INTRO=[
  {mood:'welcoming',text:'Welcome to the world of Built.'},
  {mood:'curious',text:'This is no normal world. In this world, what you do out there carries over.'},
  {mood:'thoughtful',text:'Long ago, the first people of Built learned a hard truth: strength you did not earn, you cannot keep. So the land made them a promise, and it has kept it ever since.'},
  {mood:'excited',text:'Every push-up you grind out, every mile you run, every page you learn: the roots feel it, and they answer here.',chips:['PUSH-UPS · PULL-UPS · BENCH → STRENGTH','DASH · VERTICAL → SPEED','MILE → STAMINA','MIND CHECK → INTELLIGENCE','LOGGED TRAINING → DISCIPLINE']},
  {mood:'proud',text:'Lift out there, and your blows land harder in here. Run out there, and your feet carry you farther. Learn out there, and your mind cuts through the fog.'},
  {mood:'warm',text:'But Built does not only reward the strongest. Every body has a gift here.'},
  {mood:'hopeful',text:'A heavy frame stands like stone: hard to hurt, harder to knock down. A light or tall frame moves like wind. A balanced frame finds a second wind when others fall.',chips:['STONEFRAME · MORE VITALITY · STEADFAST','SWIFTFRAME · FASTER · LONGER DASH','TRUEFRAME · MORE BREATH · SECOND WIND']},
  {mood:'stern',text:'And you will not grow by slaying monsters. Cut down every creature in the forest and your arms will be exactly as they were this morning. Here, you grow when you grow.'},
  {mood:'serious',text:'Long ago, a crown far from here wanted this forest’s strength without the work. Its wardens cut the Heartseed’s roots and drank. Borrowed strength never holds: it hollowed them out, and the rot they left still spreads. We call it the Hollowing.'},
  {mood:'thoughtful',text:'It eats strength and memory together. The shellbacks forget what they are. And the old guardian who built the Canopy Gate is holding on so hard that it is dragging the whole forest down with it.'},
  {mood:'hopeful',text:'Only strength that was earned can mend what stolen strength broke. That is why the forest needs someone real. That is why it needs you.'},
  {mood:'welcoming',text:'I am Mycel, keeper of the Heartseed. Before you step in, I must take your measure: your body, your mind, and the way you fight.'},
  {mood:'warm',text:'Be honest. The roots always know, and nobody here judges where you start. Only that you start.'}
];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short={strength:'STR',speed:'SPD',stamina:'STA',defense:'DEF',intelligence:'INT',discipline:'DIS'};

export function createShell(entry,canvas,globe,{enterGame,pauseGame,onAppearance,narrator,dressingRoom,weapon,saveNow}){
  loadProfile();let workoutId='A',testBefore=null,goalEdit=false,view='menu',line=0,typing=null,selected=BIOMES[0],pointer=null,notice='',mind=null,quizQ=null,quizTimer=null,quizResult=null,personalityIndex=0;
  const stopTyping=()=>{if(typing){clearInterval(typing);typing=null;}if(narrator)narrator.talking=false;if(quizTimer){clearInterval(quizTimer);quizTimer=null;}};
  // First time through: intro → measure → check → how you play → reveal → look.
  const onboarding=()=>!profile.customized;
  const step=n=>onboarding()?` · STEP ${n} OF 4`:'';
  const startQuiz=()=>{mind=createMindCheck(profile.reasoningSeen);quizQ=null;quizResult=null;show('quiz');};
  const button=(action,label,primary=false)=>`<button type="button" class="${primary?'primary':''}" data-action="${action}">${label}</button>`;
  function show(next){stopTyping();view=next;
    // Mycel's theme plays while Mycel talks: the intro, and the rest of onboarding.
    lofi.want(view==='intro'||(!profile.customized&&['baseline','personality','reveal','quiz','customize','link'].includes(view)));entry.classList.remove('hidden');entry.classList.toggle('map-view',view==='map');entry.classList.toggle('intro-view',view==='intro');
    if(view==='intro')renderIntro();else if(view==='baseline')renderBaseline();else if(view==='personality')renderPersonality();else if(view==='reveal')renderReveal();else if(view==='quiz')renderQuiz();else if(view==='map')renderMap();else if(view==='weekly')renderWeekly();else if(view==='lifts')renderLifts();else if(view==='inventory')renderInventory();else if(view==='workout')renderWorkout();else if(view==='testResult')renderTestResult();
    else if(view==='customize')renderCustomize();else if(view==='stats')renderStats();else if(view==='link')renderLink();else if(view==='leaderboard')renderLeaderboard();else renderMenu();
  }
  // Returning players (measure saved) go straight to the menu; HOW YOU PLAY is on the stats screen.
  function start(){show(profile.complete?'menu':profile.introSeen?'baseline':'intro');}
  function renderIntro(){
    const beat=INTRO[line];
    entry.innerHTML=`<div class="story-stage"><div class="story-box"><span class="eyebrow">THE HEARTSEED SPEAKS · ${line+1} / ${INTRO.length}</span><h2>MYCEL</h2><p id="spoken"></p>${beat.chips?`<div class="story-chips">${beat.chips.map((c,i)=>`<span style="animation-delay:${.4+i*.18}s">${esc(c)}</span>`).join('')}</div>`:''}<div class="story-actions">${button('skip','SKIP INTRO')}${line===0?button('link','PLAYED BEFORE? LINK DEVICE'):''}<button type="button" class="music-toggle" data-action="music" title="Mycel’s theme">${lofi.enabled?'♪ MUSIC ON':'♪ MUSIC OFF'}</button>${button('next',line===INTRO.length-1?'BEGIN →':'NEXT ▸',true)}</div><small>Click NEXT or press Space to reveal a line, then again to continue.</small></div></div>`;
    const target=entry.querySelector('#spoken'),phrase=beat.text;let cursor=0;
    if(narrator){narrator.say(beat.mood,line>0);narrator.talking=true;}
    typing=setInterval(()=>{target.textContent=phrase.slice(0,++cursor);if(cursor%2)lofi.blip(phrase[cursor-1]);if(cursor>=phrase.length)stopTyping();},26);
    const finish=()=>{profile.introSeen=true;saveProfile();show('baseline');};
    entry.querySelector('[data-action="next"]').onclick=()=>{
      if(typing){stopTyping();target.textContent=phrase;return;}
      if(++line>=INTRO.length){finish();return;}
      renderIntro();
    };
    entry.querySelector('[data-action="skip"]').onclick=finish;
    entry.querySelector('[data-action="link"]')?.addEventListener('click',()=>show('link'));
    entry.querySelector('[data-action="music"]').onclick=e=>{e.currentTarget.textContent=lofi.toggle()?'♪ MUSIC ON':'♪ MUSIC OFF';};
  }
  addEventListener('keydown',e=>{if(view==='intro'&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();entry.querySelector('[data-action="next"]')?.click();}});
  function renderMenu(){
    entry.innerHTML=`<section class="shell-card menu-card"><span class="eyebrow">REAL EFFORT · IN-GAME POWER</span><h1>THE HOLLOW<br>ROOTS</h1><p class="shell-subtitle">What you build outside, you carry inside.</p><div class="level-strip"><strong>LV ${level()} EXPLORER</strong><span>${profile.xp} real-world XP · ${Math.max(0,xpForLevel(level()+1)-profile.xp)} to LV ${level()+1}</span><button data-action="stats">VIEW STATS ↗</button></div><div class="menu-actions">${button('map','CONTINUE · WORLD MAP',true)}${button('customize','CUSTOMIZE')}${button('weekly','WEEKLY QUEST + LOG')}${button('inventory','INVENTORY')}${button('leaderboard','LEADERBOARD')}${button('link','LINK DEVICE')}</div><small class="save-caption">AUTOSAVE ON · YOUR 3D PROTOTYPE HAS ITS OWN PROFILE</small></section>`;
    for(const name of ['map','customize','weekly','inventory','leaderboard','link','stats'])entry.querySelector(`[data-action="${name}"]`).onclick=()=>show(name);
    syncBoard();
  }
  function renderBaseline(){
    const imperial=profile.units==='imperial',conv=m=>imperial&&m.imperial;
    const shown=m=>{const v=profile.inputs[m.key];if(v==null)return '';if(m.clock)return `${Math.floor(v/60)}:${String(Math.round(v%60)).padStart(2,'0')}`;return conv(m)?String(Math.round(v*m.imperial.factor/m.imperial.step)*m.imperial.step):String(v);};
    // Where a result stands among all adults (profile.js METRICS norms).
    const rank=(m,v)=>{if(v==null)return 'OPTIONAL · BLANK IS FINE';const p=percentile(m,v);return p>=99?`TOP ${Math.max(.1,Math.round((100-p)*10)/10)}% OF ADULTS`:`BETTER THAN ${Math.round(p)}% OF ADULTS`;};
    const feeds=m=>m.feeds?` <b class="feeds">→ ${m.feeds.map(k=>short[k]).join(' · ')}</b>`:'';
    const input=m=>`<label class="metric${m.optional?' optional':''}"><span>${m.label} <small>${conv(m)?m.imperial.unit:m.unit}</small>${feeds(m)}</span><input name="${m.key}" ${m.clock?'type="text" inputmode="numeric" placeholder="10:00"':`type="number" inputmode="decimal" step="any"${m.optional?' placeholder="optional"':''}`} value="${shown(m)}" data-shown="${shown(m)}" ${m.optional?'':'required'}>${m.norms?`<em class="rank" data-rank="${m.key}">${rank(m,profile.inputs[m.key])}</em>`:''}</label>`;
    // After the first test, measurements are retaken monthly (a fix is allowed for two days after a test).
    const st=testStatus(),first=!st.count,locked=!first&&!st.due&&!st.correctable;
    const title=first?`MYCEL'S MEASURE${step(1)}`:st.due?'MONTHLY TEST · OPEN NOW':st.correctable?'THIS MONTH’S TEST · FIXES OPEN FOR 2 DAYS':`MONTHLY TEST · NEXT IN ${st.nextIn} DAY${st.nextIn===1?'':'S'}`;
    const lead=first?'Mycel reads your frame and what your body can do today. Use your real results. Every frame has a gift, so there is nothing to hide.':st.due?'A month has passed. Test yourself again: every stat that rises earns a Growth bonus on top, and higher stats unlock abilities.':st.correctable?'You can still fix a mistake in this month’s test.':`Your measurements lock between monthly tests so every gain is a real one. Your next test opens in ${st.nextIn} day${st.nextIn===1?'':'s'}. Until then, WEEKLY QUEST training keeps raising your level.`;
    entry.innerHTML=`<section class="shell-card wide-card"><div class="panel-heading"><div><span class="eyebrow">${title}</span><h2>${first?'YOUR MEASURE':'MONTHLY TEST'}</h2></div><div class="unit-toggle">${button('metric','METRIC',!imperial)}${button('imperial','US · LB, IN, MI',imperial)}</div></div><p>${lead}</p><form id="baselineForm" class="${locked?'locked':''}"><h3>YOUR FRAME</h3><div class="metric-grid">${METRICS.filter(m=>m.body).map(input).join('')}</div><h3>WHAT YOU CAN DO</h3><div class="metric-grid">${METRICS.filter(m=>!m.body&&!m.optional).map(input).join('')}<div class="metric auto-metric"><span>Discipline <small>auto</small></span><strong>${stats().discipline}</strong><small>Calculated from the training you log in WEEKLY QUEST; it rises as you keep showing up.</small></div></div><h3>OPTIONAL · MORE TESTS, SHARPER STATS</h3><p class="baseline-note">A plank and your resting heart rate. Fill in any you can test; leave the rest blank and those stats are worked out from the tests above, as before.</p><div class="metric-grid">${METRICS.filter(m=>m.optional).map(input).join('')}</div><div class="baseline-note">Each result is scored against all adults: the middle of everyone is 10, the top 1% is 18, and the top 0.1% is 20. Weight and height choose your frame (Stoneframe, Swiftframe or Trueframe); they never lower a stat. Mile time as minutes:seconds. Intelligence comes from Mycel's check next; discipline is calculated automatically from the training you log.</div><div class="panel-actions">${onboarding()?'':button('back','BACK')}${locked?'':`<button class="primary" type="submit">${onboarding()?'NEXT · MIND CHECK →':st.correctable&&!first?'SAVE FIX →':'RECORD TEST →'}</button>`}</div></form></section>`;
    const form=entry.querySelector('#baselineForm');
    if(locked)form.querySelectorAll('input').forEach(i=>{i.disabled=true;});
    form.addEventListener('input',e=>{
      const m=METRICS.find(x=>x.key===e.target.name),out=m?.norms&&form.querySelector(`[data-rank="${m.key}"]`);if(!out)return;
      if(m.optional&&!e.target.value.trim()){out.textContent=rank(m,null);return;}
      const raw=e.target.value.trim(),hit=m.clock&&/^(\d{1,2}):(\d{2})$/.exec(raw),v=m.clock?(hit?Number(hit[1])*60+Number(hit[2]):Number(raw)*60):Number(raw)/(conv(m)?m.imperial.factor:1);
      if(raw&&Number.isFinite(v))out.textContent=rank(m,v);
    });
    const read=strict=>{
      for(const m of METRICS){
        const el=form.elements[m.key],raw=el.value.trim();let v;
        if(raw===el.dataset.shown){el.setCustomValidity('');continue;}   // untouched: keep the exact stored value
        if(m.optional&&!raw){el.setCustomValidity('');profile.inputs[m.key]=null;continue;}
        if(m.clock){const hit=/^(\d{1,2}):(\d{2})$/.exec(raw);v=hit?Number(hit[1])*60+Number(hit[2]):Number(raw)*60;}
        else v=Number(raw)/(conv(m)?m.imperial.factor:1);
        const ok=raw&&Number.isFinite(v)&&v>=m.min&&v<=m.max;
        el.setCustomValidity(ok?'':m.clock?'Enter minutes:seconds, for example 9:30':`Enter a value between ${conv(m)?Math.round(m.min*m.imperial.factor):m.min} and ${conv(m)?Math.round(m.max*m.imperial.factor):m.max}`);
        if(!ok){if(strict){el.reportValidity();return false;}continue;}
        profile.inputs[m.key]=Math.round(v*100)/100;
      }
      return true;
    };
    for(const u of ['metric','imperial'])entry.querySelector(`[data-action="${u}"]`).onclick=()=>{read(false);profile.units=u;profile.unitsChosen=true;saveProfile();renderBaseline();};
    form.onsubmit=e=>{
      e.preventDefault();if(locked)return;
      const before=stats(),had=unlockedAbilities(before).map(a=>a.id);
      if(!read(true))return;
      profile.complete=true;recordTest();
      if(onboarding()||first){if(onboarding())startQuiz();else show('stats');return;}
      testBefore={stats:before,had};show('testResult');
    };
    entry.querySelector('[data-action="back"]')?.addEventListener('click',()=>show('stats'));
  }
  function renderPersonality(){
    const q=PERSONALITY[personalityIndex];
    entry.innerHTML=`<section class="shell-card wide-card quiz-card"><span class="eyebrow">HOW YOU PLAY · ${personalityIndex+1} / ${PERSONALITY.length}${step(3)}</span><h2>${esc(q.prompt)}</h2><p>There is no wrong answer. Games you play elsewhere count; Mycel uses this with your stats to recommend a class.</p><div class="quiz-options personality-options">${q.options.map(([k,label])=>`<button data-pick="${k}" class="${profile.personality[q.key]===k?'selected':''}">${esc(label)}<small>${CLASS_INFO[k].label}</small></button>`).join('')}</div></section>`;
    entry.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{
      profile.personality[q.key]=b.dataset.pick;saveProfile();
      if(++personalityIndex<PERSONALITY.length){renderPersonality();return;}
      personalityIndex=0;show('reveal');
    });
  }
  function renderReveal(){
    const path=recommendedPath(),rec=path.primary,c=pathInfo(path.primary,path.secondary),f=FRAMES[frame()],current=pathInfo();
    entry.innerHTML=`<section class="shell-card wide-card reveal-card"><span class="eyebrow">MYCEL READS YOU${step(4)}</span><h2>WHAT THE ROOTS SEE</h2><div class="reveal-grid"><div class="class-recommend"><small>RECOMMENDED CLASS</small><strong>${c.label}</strong><span>${c.description}</span><em>${c.bonus}</em><p>${esc(classReason())}</p></div><div class="class-recommend frame-card"><small>YOUR FRAME</small><strong>${f.label}</strong><span>${f.description}</span><em>${f.bonus}</em></div></div>${statTiles()}<div class="panel-actions">${button('again','ANSWER AGAIN')}${onboarding()?'':button('keep',`KEEP ${current.label}`)}${button('take',onboarding()?'ACCEPT · CHOOSE YOUR LOOK →':`TAKE ${c.label}`,true)}</div><small class="baseline-note">You can switch class any time in CUSTOMIZE.</small></section>`;
    entry.querySelector('[data-action="again"]').onclick=()=>{personalityIndex=0;show('personality');};
    entry.querySelector('[data-action="keep"]')?.addEventListener('click',()=>show('stats'));
    entry.querySelector('[data-action="take"]').onclick=()=>{profile.appearance.discipline=rec;profile.appearance.secondary=path.secondary;saveProfile();onAppearance();show(onboarding()?'customize':'stats');};
  }
  function statTiles(){const values=stats(),claimed=claimedStats(),raw=rawStats();return `<div class="stat-grid">${Object.entries(values).map(([key,v])=>{const capped=caps.get(key);return `<div class="${capped?'capped':''}"><small>${short[key]}${claimed[key]>raw[key]?` <em class="bonus">+${claimed[key]-raw[key]}</em>`:''}${capped?' <em class="cap">🧢 CAPPED</em>':''}</small><strong>${capped&&claimed[key]>v?`<s>${claimed[key]}</s> ${v}`:v}</strong><span>${capped?`CAPPED BY ${esc(capped.join(', ').toUpperCase())} · SHOW THEM PROOF`:key.toUpperCase()}</span>${STAT_SOURCES[key]?`<em class="sources">${esc(STAT_SOURCES[key].join(' · '))}</em>`:key==='intelligence'?'<em class="sources">Mind check</em>':key==='discipline'?'<em class="sources">Days you train</em>':''}</div>`;}).join('')}</div>`;}
  /** The twelve abilities: which your stats have unlocked, and what the rest need. */
  function abilityGrid(){const s=stats(),on=new Set(unlockedAbilities(s).map(a=>a.id));
    return `<div class="ability-grid">${ABILITIES.map(a=>`<article class="${on.has(a.id)?'on':''}"><small>${short[a.stat]} ${a.at}</small><b>${a.name}</b><span>${esc(a.text)}</span><em>${on.has(a.id)?'UNLOCKED':`${short[a.stat]} ${s[a.stat]} / ${a.at}`}</em></article>`).join('')}</div>`;}
  function bonusNote(){
    const gr=Object.entries(growth()),boon=goalBoon(),st=testStatus(),parts=[];
    if(gr.length)parts.push(`Growth since your last test: ${gr.map(([k,v])=>`+${v.bonus} ${short[k]} (you rose ${v.gain})`).join(', ')}.`);
    if(boon.points)parts.push(`Body goal: +${boon.points} ${short[boon.stat]} for your class (${boon.marks} marks in 12 weeks).`);
    parts.push(st.due?'Your monthly test is open now.':`Next monthly test in ${st.nextIn} day${st.nextIn===1?'':'s'}.`);
    return `<p class="bonus-note">${parts.join(' ')}</p>`;}
  function renderStats(){const rp=recommendedPath(),rec=pathInfo(rp.primary,rp.secondary);entry.innerHTML=`<section class="shell-card wide-card"><div class="panel-heading"><div><span class="eyebrow">REAL LIFE → GAMEPLAY</span><h2>EXPLORER STATS</h2></div>${button('back','BACK')}</div>${statTiles()}${bonusNote()}<h3>ABILITIES · A STAT OF 12 AND 16 UNLOCKS EACH</h3>${abilityGrid()}<div class="reveal-grid"><div class="class-recommend"><small>RECOMMENDED CLASS</small><strong>${rec.label}</strong><span>${rec.description}</span>${rec.hybrid?`<em>${rec.bonus}</em>`:''}<p>${esc(classReason())}</p></div><div class="class-recommend frame-card"><small>YOUR FRAME</small><strong>${FRAMES[frame()].label}</strong><span>${FRAMES[frame()].description}</span><em>${FRAMES[frame()].bonus}</em></div></div><div class="impact-grid">${mechanicsTable().map(([k,v])=>`<article><b>${k}</b><span>${esc(v)}</span></article>`).join('')}</div><div class="panel-actions">${button('baseline',testStatus().due?'MONTHLY TEST · OPEN':'MONTHLY TEST')}${button('personality','HOW YOU PLAY')}${canTakeReasoning(profile.reasoningTaken)?button('quiz','MIND CHECK'):''}${button('weekly','OPEN WEEKLY QUEST',true)}</div><small class="baseline-note">The mind check sets a game estimate, not a clinical IQ score. Retake after 30 days.</small></section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>show('menu');entry.querySelector('[data-action="baseline"]').onclick=()=>show('baseline');entry.querySelector('[data-action="weekly"]').onclick=()=>show('weekly');
    entry.querySelector('[data-action="personality"]').onclick=()=>{personalityIndex=0;show('personality');};
    entry.querySelector('[data-action="quiz"]')?.addEventListener('click',startQuiz);}
  // Mycel's mind check (reasoning.js): twelve adaptive items, each on a clock.
  const TYPE_LABEL={series:'NUMBER SERIES','letter series':'LETTER SERIES',matrix:'MATRIX',analogy:'ANALOGY',vocabulary:'VOCABULARY','odd one out':'ODD ONE OUT',deduction:'DEDUCTION',quantitative:'QUANTITATIVE',spatial:'SPATIAL',knowledge:'KNOWLEDGE'};
  function renderQuiz(){
    if(quizResult){renderQuizResult();return;}
    if(!mind)mind=createMindCheck(profile.reasoningSeen);
    const q=quizQ||(quizQ=mind.next());
    const [text,...grid]=q.prompt.split('\n');
    entry.innerHTML=`<section class="shell-card wide-card quiz-card"><span class="eyebrow">MYCEL'S MIND CHECK · ${TYPE_LABEL[q.type]||'REASONING'} · ${mind.count+1} / ${TEST_ITEMS}${step(2)}</span><h2>${esc(text)}</h2>${grid.length?`<div class="quiz-matrix">${grid.map(r=>`<div>${r.trim().split(/\s+/).map(c=>`<span>${esc(c)}</span>`).join('')}</div>`).join('')}</div>`:''}<div class="quiz-clock"><i></i></div><p>Questions get harder as you get them right. ${TIME_LIMIT} seconds each; running out counts as wrong. A game estimate on the IQ scale, not a clinical test.</p><div class="quiz-options">${q.options.map((o,i)=>`<button data-answer="${i}">${esc(o)}</button>`).join('')}</div><div class="panel-actions">${button('skip',onboarding()?'SKIP · KEEP AVERAGE (10)':'STOP · KEEP CURRENT SCORE')}</div></section>`;
    const started=Date.now(),bar=entry.querySelector('.quiz-clock i');
    const submit=choice=>{if(quizTimer){clearInterval(quizTimer);quizTimer=null;}mind.answer(q,choice);quizQ=null;
      if(!mind.done){renderQuiz();return;}
      const est=mind.estimate(),iq=iqFromTheta(est.theta);
      profile.reasoning=iq;profile.reasoningTaken=new Date().toISOString().slice(0,10);profile.reasoningVersion=TEST_VERSION;profile.reasoningSeen=mind.ids;saveProfile();
      quizResult={iq,se:Math.round(est.se*15),int:stats().intelligence};mind=null;renderQuizResult();};
    quizTimer=setInterval(()=>{const left=1-(Date.now()-started)/(TIME_LIMIT*1000);bar.style.width=`${Math.max(0,left)*100}%`;bar.classList.toggle('low',left<.25);if(left<=0)submit(-1);},200);
    entry.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>submit(Number(b.dataset.answer)));
    entry.querySelector('[data-action="skip"]').onclick=()=>{mind=null;quizQ=null;show(onboarding()?'personality':'stats');};
  }
  function renderQuizResult(){
    const r=quizResult;
    entry.innerHTML=`<section class="shell-card wide-card quiz-card"><span class="eyebrow">MYCEL'S MIND CHECK · COMPLETE${step(2)}</span><h2>INTELLIGENCE ${r.int}</h2><div class="stat-grid"><div><small>IQ-SCALE ESTIMATE</small><strong>${r.iq}</strong><span>± ${r.se} (ONE STANDARD ERROR)</span></div><div><small>INTELLIGENCE</small><strong>${r.int}</strong><span>10 IS THE ADULT AVERAGE · 20 IS THE TOP 0.1%</span></div></div><p>Twelve questions can only estimate, so treat this as a range. You can retake it in 30 days, with different questions.</p><div class="panel-actions">${button('next','CONTINUE →',true)}</div></section>`;
    entry.querySelector('[data-action="next"]').onclick=()=>{quizResult=null;show(onboarding()?'personality':'stats');};
  }
  // WEEKLY QUEST: this week's step of the training plan, checked off one day at a
  // time; the body goal and weigh-ins; and a free log for anything else.
  function renderWeekly(){
    const plan=weeklyPlan(),today=localDay(),imperial=profile.units==='imperial',unit=imperial?'lb':'kg';
    const shownKg=kg=>imperial?Math.round(kg*2.20462):Math.round(kg*10)/10,toKg=v=>imperial?v/2.20462:v;
    const item=i=>`<div class="plan-item ${i.done.length>=i.count?'done':''}"><div class="plan-main">${i.workout?`<button type="button" class="plan-open" data-open="${i.workout}">${esc(i.label)}<small>${WORKOUTS[i.workout].minutes} MIN · NO EQUIPMENT · OPEN ›</small></button>`:`<strong>${esc(imperial&&i.labelUS?i.labelUS:i.label)}</strong>${i.note?`<em class="plan-note">${esc(i.note)}</em>`:''}`}<small>${Math.min(i.count,i.done.length)} / ${i.count} ${i.unit}${i.count>1?'s':''}</small></div><div class="plan-checks">${Array.from({length:i.count},(_,k)=>{const d=i.done[k];return `<button type="button" class="check ${d?'on':''}" data-check="${i.id}" data-date="${d||''}" title="${d?`Logged ${d}${d===today?' · click to undo':''}`:i.workout?'Open the workout':'Check off today'}">${d?'✓':''}</button>`;}).join('')}</div></div>`;
    const g=profile.goal,boon=goalBoon(),wait=nextWeighIn(),history=profile.weighIns.slice(-6).reverse();
    const goalForm=`<form id="goalForm"><div class="goal-types">${Object.entries(GOALS).map(([k,v])=>`<label><input type="radio" name="type" value="${k}" ${(g.type||'lose')===k?'checked':''}><span>${v.label}</span></label>`).join('')}</div><label>WEIGHT TODAY (${unit})<input name="current" type="number" step="any" required value="${profile.weighIns.at(-1)?shownKg(profile.weighIns.at(-1).kg):shownKg(profile.inputs.weightKg)}"></label><label class="target-field">TARGET WEIGHT (${unit})<input name="target" type="number" step="any" value="${g.type&&g.type!=='recomp'?shownKg(g.targetKg):''}"></label><button class="primary" type="submit">SET GOAL</button></form>`;
    const goalPanel=!g.type||goalEdit?goalForm:`<div class="goal-now"><strong>${GOALS[g.type].label}</strong>${g.type!=='recomp'?`<span>TARGET ${shownKg(g.targetKg)} ${unit}</span>`:''}<small>${GOALS[g.type].pace}</small><div class="boon"><b>+${boon.points} ${short[boon.stat]}</b><span>${boon.marks} mark${boon.marks===1?'':'s'} in the last 12 weeks · every 2 marks = +1 ${boon.stat.toUpperCase()} for your ${(profile.appearance.discipline||'fighter').toUpperCase()} (max +5)</span></div></div><form id="weighForm"><label>WEEKLY WEIGH-IN (${unit})<input name="kg" type="number" step="any" required ${wait?'disabled':''} placeholder="${wait?`opens in ${wait} day${wait===1?'':'s'}`:'weight today'}"></label><button class="primary" type="submit" ${wait?'disabled':''}>LOG WEIGH-IN</button></form>${history.length?`<ul class="weigh-list">${history.map(w=>`<li><span>${w.date}</span><b>${shownKg(w.kg)} ${unit}</b><em>${w.marks?'✦'.repeat(w.marks):'·'}</em></li>`).join('')}</ul>`:''}<button type="button" class="link-button" data-action="changeGoal">CHANGE GOAL</button>`;
    entry.innerHTML=`<section class="shell-card wide-card weekly-card"><div class="panel-heading"><div><span class="eyebrow">WEEK ${plan.week} OF THE PLAN · ${plan.tier} · RESETS MONDAY</span><h2>WEEKLY QUEST</h2></div>${button('back','BACK')}</div><div class="plan-progress"><div class="goal-track"><i style="width:${plan.checked/plan.total*100}%"></i></div><small>${plan.checked} / ${plan.total} checked · ${plan.claimed?'WEEK COMPLETE · BONUS CLAIMED':`finish the week for +${plan.bonus} XP`} · finish half or more to move up next week</small></div><div class="weekly-columns"><div><h3>THIS WEEK</h3>${plan.items.map(item).join('')}<small class="feedback">${esc(notice)}</small></div><div><h3>BODY GOAL</h3>${goalPanel}<h3>OTHER ACTIVITY</h3><form id="logForm"><label>ACTIVITY<select name="kind"><option value="workout">Workout day</option><option value="steps">Daily steps</option><option value="run">Run or walk distance (${imperial?'miles':'km'})</option><option value="study">Learning (minutes)</option></select></label><label>AMOUNT<input name="amount" type="number" min="1" step="any" value="1" required></label><button type="submit">RECORD ACTIVITY</button></form><button type="button" class="lift-open" data-action="lifts">PERSONAL LIFT LOG ›<small>${profile.lifts.length?`${liftSummary().sets} SETS LOGGED · ${liftSummary().prs} PRS`:'FOR YOUR OWN PROGRAM · NO XP · EARNS TITLES'}</small></button></div></div><div class="panel-actions">${button('stats','VIEW YOUR STATS')}</div></section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>{notice='';show('menu');};entry.querySelector('[data-action="stats"]').onclick=()=>show('stats');
    entry.querySelector('[data-action="lifts"]').onclick=()=>{notice='';liftNotice='';show('lifts');};
    entry.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{workoutId=b.dataset.open;notice='';show('workout');});
    entry.querySelectorAll('[data-check]').forEach(b=>b.onclick=()=>{
      const id=b.dataset.check,it=plan.items.find(i=>i.id===id);
      if(b.dataset.date){notice=b.dataset.date===today?uncheckPlanItem(id):`Logged on ${b.dataset.date}. Only today’s check can be undone.`;}
      else if(it.workout){workoutId=it.workout;notice='';show('workout');return;}
      else notice=checkPlanItem(id);
      renderWeekly();
    });
    const log=entry.querySelector('#logForm'),amount=log.elements.amount;
    log.elements.kind.onchange=()=>{amount.value={workout:1,steps:5000,run:1,study:30}[log.elements.kind.value];};
    log.onsubmit=e=>{e.preventDefault();const kind=log.elements.kind.value;notice=logActivity(kind,Number(amount.value)*(kind==='run'&&imperial?1.609:1));renderWeekly();};
    const gf=entry.querySelector('#goalForm');
    if(gf){const sync=()=>{gf.querySelector('.target-field').classList.toggle('hidden',gf.elements.type.value==='recomp');};gf.querySelectorAll('[name="type"]').forEach(r=>r.onchange=sync);sync();
      gf.onsubmit=e=>{e.preventDefault();const t=gf.elements.type.value;notice=setGoal(t,toKg(Number(gf.elements.current.value)),toKg(Number(gf.elements.target.value)));if(profile.goal.type===t)goalEdit=false;renderWeekly();};}
    const wf=entry.querySelector('#weighForm');
    if(wf)wf.onsubmit=e=>{e.preventDefault();notice=logWeighIn(toKg(Number(wf.elements.kg.value)));renderWeekly();};
    entry.querySelector('[data-action="changeGoal"]')?.addEventListener('click',()=>{goalEdit=true;renderWeekly();});
  }
  // The personal lift log: for lifters on their own program. No XP; it tracks
  // personal records (estimated 1RM) and unlocks cosmetic titles for the board.
  let liftNotice='';
  // INVENTORY: your weapons (class ones open at level 3; a hybrid carries both classes')
  // and your class moves (level 3 and 5). Opened from the menu, or with I in game.
  let invFromGame=false;
  function renderInventory(){
    const lv=level(),mine=myClasses(),chosen=profile.appearance.weapon||'rootbound',inHand=weapon?.()||'rootbound';
    const names=['rootbound',...Object.values(CLASS_WEAPON)],owner=w=>Object.entries(CLASS_INFO).find(([k])=>CLASS_WEAPON[k]===w)?.[0];
    const card=w=>{const g=weaponEligibility(w),info=WEAPONS[w]||{},cls=owner(w),yours=w==='rootbound'||mine.includes(cls);
      return `<article class="inv-item ${g.ok?'':'locked'} ${inHand===w?'equipped':''} ${yours?'':'other'}"><small>${w==='rootbound'?'EVERYONE':CLASS_INFO[cls].label}</small><b>${esc(info.label||w.toUpperCase())}</b><span>${esc(info.note||'')}</span>${inHand===w?'<em>IN HAND</em>':g.ok?`<button type="button" data-equip="${w}">EQUIP</button>`:`<em class="lock">LOCKED · ${esc(g.requirement)}</em>`}</article>`;};
    const ordered=[...names.filter(w=>w==='rootbound'||mine.includes(owner(w))),...names.filter(w=>w!=='rootbound'&&!mine.includes(owner(w)))];
    const moves=skillSlots(mine,lv).map(s=>`<article class="inv-item ${s.unlocked?'':'locked'}"><small>KEY ${s.key} · LEVEL ${s.level}</small><b>${esc(s.skill.name)}</b><span>${esc(s.skill.text)} Cooldown ${s.skill.cooldown} s.</span>${s.unlocked?'<em>READY</em>':`<em class="lock">LOCKED · LEVEL ${s.level}</em>`}</article>`).join('');
    entry.innerHTML=`<section class="shell-card wide-card inventory-card"><div class="panel-heading"><div><span class="eyebrow">LV ${lv} · ${esc(pathInfo().label)}</span><h2>INVENTORY</h2></div>${button('back',invFromGame?'BACK TO THE HUNT':'BACK')}</div><p>Your class weapons open at level ${WEAPON_LEVEL}${mine.length>1?'; your hybrid carries both classes’ weapons':''}. ${chosen!==inHand?`You chose ${esc((WEAPONS[chosen]||{}).label||chosen)}, which is still locked, so you hold ${esc(WEAPONS[inHand].label)}.`:''}</p><h3>WEAPONS</h3><div class="inv-grid">${ordered.map(card).join('')}</div><h3>CLASS MOVES</h3><div class="inv-grid">${moves}</div><small class="baseline-note">Keys: G and T use your class moves in the hunt. A hybrid learns its first class’s move on G and its second class’s on T.</small></section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>{if(invFromGame){invFromGame=false;enterGame();}else show('menu');};
    entry.querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>{profile.appearance.weapon=b.dataset.equip;saveProfile();onAppearance();renderInventory();});
  }
  function renderLifts(){
    const imperial=profile.units==='imperial';
    entry.innerHTML=`<section class="shell-card wide-card weekly-card lift-card"><div class="panel-heading"><div><span class="eyebrow">YOUR OWN PROGRAM · NO XP · EARNS TITLES</span><h2>LIFT LOG</h2></div>${button('back','BACK')}</div>${liftLog(imperial)}</section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>{liftNotice='';show('weekly');};
    wireLiftLog(imperial);
  }
  function liftLog(imperial){
    const u=imperial?'lb':'kg',show=kg=>imperial?Math.round(kg*2.20462):Math.round(kg*10)/10;
    const recent=profile.lifts.map((l,i)=>({...l,i})).slice(-8).reverse(),records=[...liftRecords()].sort((a,b)=>b[1].e1rm-a[1].e1rm).slice(0,8);
    const sum=liftSummary(),have=new Set(unlockedTitles().map(t=>t.id));
    return `<div class="lift-log"><p class="lift-note">Following your own program? Log your sets here to track personal records. It doesn't give XP; it unlocks titles that show next to your name on the leaderboard.</p>
    <form id="liftForm" autocomplete="off"><label class="lift-ex">EXERCISE<input name="ex" list="exerciseList" placeholder="Search: bench, squat, row…" required></label><datalist id="exerciseList">${EXERCISES.map(e=>`<option value="${esc(e)}">`).join('')}</datalist><label>WEIGHT (${u})<input name="w" type="number" min="0" step="any" placeholder="0 = bodyweight" required></label><label>REPS<input name="reps" type="number" min="1" max="100" step="1" required></label><label>SETS<input name="sets" type="number" min="1" max="20" step="1" value="1"></label><button class="primary" type="submit">LOG SET</button></form><small class="feedback lift-feedback">${esc(liftNotice)}</small>
    <div class="lift-columns"><div><h4>RECENT</h4>${recent.length?`<ul class="lift-list">${recent.map(l=>`<li><span>${l.date.slice(5)}</span><b>${esc(l.ex)}</b><em>${l.sets>1?`${l.sets} × `:''}${show(l.kg)} ${u} × ${l.reps}${l.pr?' · PR':''}</em><button type="button" class="lift-del" data-del="${l.i}" title="Delete this entry">×</button></li>`).join('')}</ul>`:'<p class="lift-note">Nothing logged yet.</p>'}</div>
    <div><h4>PERSONAL RECORDS <small>EST. 1RM</small></h4>${records.length?`<ul class="lift-list">${records.map(([ex,r])=>`<li><b>${esc(ex)}</b><em>${show(r.e1rm)} ${u} <small>(${show(r.kg)} × ${r.reps})</small></em></li>`).join('')}</ul>`:'<p class="lift-note">Your best lifts will show here.</p>'}</div>
    <div><h4>TITLES <small>${sum.sets} SETS · ${sum.prs} PRS</small></h4><ul class="title-list">${TITLES.map(t=>`<li class="${have.has(t.id)?'on':''}"><button type="button" data-title="${t.id}" ${have.has(t.id)?'':'disabled'} class="${profile.title===t.id?'worn':''}">${esc(t.label)}</button><small>${have.has(t.id)?(profile.title===t.id?'SHOWN ON THE BOARD':'TAP TO WEAR'):esc(t.need)}</small></li>`).join('')}</ul></div></div></div>`;
  }
  function wireLiftLog(imperial){
    const f=entry.querySelector('#liftForm');if(!f)return;
    f.onsubmit=e=>{e.preventDefault();const toKg=v=>imperial?v/2.20462:v;
      const r=logLift(f.elements.ex.value,toKg(Number(f.elements.w.value)),Number(f.elements.reps.value),Number(f.elements.sets.value));
      liftNotice=r.error||`${r.pr?'NEW PERSONAL RECORD! ':r.first?'First log of this lift. ':'Logged. '}${r.titles.length?`Title unlocked: ${r.titles.map(t=>t.label).join(', ')}.`:''}`;
      renderLifts();entry.querySelector('#liftForm [name="ex"]')?.focus();};
    entry.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(confirm('Delete this entry?')){removeLift(Number(b.dataset.del));liftNotice='Entry deleted.';renderLifts();}});
    entry.querySelectorAll('[data-title]').forEach(b=>b.onclick=()=>{profile.title=profile.title===b.dataset.title?'':b.dataset.title;saveProfile();liftNotice=profile.title?`Wearing “${TITLES.find(t=>t.id===profile.title).label}”. It shows on the leaderboard.`:'Title removed.';renderLifts();});
  }
  /** A home workout: the circuit with an easier version of every exercise beside it; DONE logs it. */
  function renderWorkout(){
    const w=WORKOUTS[workoutId],plan=weeklyPlan(),it=plan.items.find(i=>i.workout===workoutId);
    const canLog=it&&it.done.length<it.count&&!it.today,list=xs=>`<ul class="workout-list">${xs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
    const state=!it?'NOT IN THIS WEEK’S PLAN':it.today?'LOGGED TODAY ✓':it.done.length>=it.count?'DONE FOR THIS WEEK ✓':'';
    entry.innerHTML=`<section class="shell-card wide-card workout-card"><div class="panel-heading"><div><span class="eyebrow">WEEK ${plan.week} · ${plan.tier} · ABOUT ${w.minutes} MIN · FULL BODY</span><h2>${w.title}</h2></div>${button('back','BACK')}</div><p>${esc(w.where)}. Do the circuit ${w.rounds} times. ${esc(w.rest)}</p><h3>WARM-UP · 5 MIN</h3>${list(w.warmup)}<h3>THE CIRCUIT · ${w.rounds} ROUNDS</h3><div class="workout-table"><div class="wt-head"><span>THE WORKOUT</span><span>EASIER VERSION</span></div>${w.exercises.map(([n,d,en,ed,cue],i)=>`<div class="wt-row"><div><b>${i+1}. ${esc(n)}</b><em>${esc(d)}</em><small>${esc(cue)}</small></div><div class="easier"><b>${esc(en)}</b><em>${esc(ed)}</em></div></div>`).join('')}</div><h3>COOL-DOWN · 5 MIN</h3>${list(w.cooldown)}<small class="baseline-note">Swap in the easier version of any exercise whenever you need to; it still counts. ${esc(WORKOUT_NOTE)}</small><div class="panel-actions">${button('week','BACK TO THE WEEK')}${canLog?button('log','✓ DONE · LOG THIS WORKOUT',true):`<span class="done-tag">${state}</span>`}</div><small class="feedback">${esc(notice)}</small></section>`;
    for(const a of ['back','week'])entry.querySelector(`[data-action="${a}"]`).onclick=()=>show('weekly');
    entry.querySelector('[data-action="log"]')?.addEventListener('click',()=>{notice=checkPlanItem(it.id);show('weekly');});
  }
  /** After a monthly test: what rose, the Growth it earned, and abilities gained (or slipped). */
  function renderTestResult(){
    const before=testBefore?.stats||stats(),now=stats(),gr=growth(),had=new Set(testBefore?.had||[]),has=new Set(unlockedAbilities(now).map(a=>a.id));
    const gained=ABILITIES.filter(a=>has.has(a.id)&&!had.has(a.id)),lost=ABILITIES.filter(a=>had.has(a.id)&&!has.has(a.id));
    entry.innerHTML=`<section class="shell-card wide-card"><div class="panel-heading"><div><span class="eyebrow">MONTHLY TEST · ${testStatus().last}</span><h2>THE ROOTS ANSWER</h2></div></div><div class="test-rows">${Object.keys(short).map(k=>{const d=now[k]-before[k];return `<div class="${d>0?'up':d<0?'down':''}"><small>${short[k]}</small><b>${before[k]} → ${now[k]}</b><span>${d>0?`+${d}`:d<0?d:'='}${gr[k]?` · GROWTH +${gr[k].bonus}`:''}</span></div>`;}).join('')}</div>${Object.keys(gr).length?`<p>Every stat that rose since your last test carries a Growth bonus until the next one: the bigger the gain, the bigger the bonus (up to +4).</p>`:'<p>No stat rose this month. Your level still grows with every workout you log, and next month is another chance.</p>'}${gained.length?`<h3>NEW ABILITIES</h3><div class="ability-grid">${gained.map(a=>`<article class="on"><small>${short[a.stat]} ${a.at}</small><b>${a.name}</b><span>${esc(a.text)}</span></article>`).join('')}</div>`:''}${lost.length?`<h3>SLIPPED</h3><div class="ability-grid">${lost.map(a=>`<article><small>${short[a.stat]} ${a.at}</small><b>${a.name}</b><span>Raise ${a.stat} back to ${a.at} to regain it.</span></article>`).join('')}</div>`:''}<div class="panel-actions">${button('stats','VIEW STATS',true)}</div></section>`;
    entry.querySelector('[data-action="stats"]').onclick=()=>{testBefore=null;show('stats');};
  }
  function renderCustomize(){
    const a=profile.appearance;
    const choices=(key,items)=>`<div class="appearance-options">${items.map(([name,color])=>`<button type="button" class="appearance-choice ${String(a[key])===String(name)?'selected':''}" data-feature="${key}" data-value="${name}">${color?`<i style="background:${color}"></i>`:''}${String(name).toUpperCase()||'NONE'}</button>`).join('')}</div>`;
    // The first time through (after the baseline), naming and dressing the explorer is part of onboarding.
    const onboarding=!profile.customized;
    entry.innerHTML=`<section class="shell-card wide-card customize-panel"><div class="panel-heading"><div><span class="eyebrow">${onboarding?'BEFORE THE FIRST HUNT':'THE EXPLORER'}</span><h2>MAKE IT YOURS</h2></div>${onboarding?'':button('back','BACK')}</div><p>Changes autosave. Play in first person, then press V to see your complete explorer in the world. Your arms and outfit also appear during first-person combat.</p>${(()=>{const r=recommendedPath(),i=pathInfo(r.primary,r.secondary);const mine=a.discipline===r.primary&&(a.secondary||'')===r.secondary||r.secondary&&a.discipline===r.secondary&&a.secondary===r.primary;return `<div class="class-recommend"><small>MYCEL RECOMMENDS</small><strong>${i.label}</strong><span>${i.description}</span><em>${i.bonus}</em>${mine?'<em class="class-current">✓ THIS IS YOUR CLASS</em>':`<button type="button" class="take-rec" data-path="${r.primary}+${r.secondary}">TAKE ${i.label}</button>`}</div>`;})()}<div class="customize-layout"><div class="customize-fields"><h3>NAME</h3><input class="name-input" name="explorerName" maxlength="24" value="${esc(profile.name)}" placeholder="WAYFARER"><h3>COMBAT CLASS <small>FULL BONUS</small></h3><div class="appearance-options class-options">${Object.keys(CLASS_INFO).map(k=>{const u=classUnlock(k),on=!a.secondary&&a.discipline===k;return `<button type="button" class="appearance-choice ${on?'selected':''} ${u.ok?'':'locked'}" data-path="${k}+" ${u.ok||on?'':'disabled'}>${CLASS_INFO[k].label}<small>${CLASS_INFO[k].bonus}</small></button>`;}).join('')}</div><h3>HYBRID CLASS <small>STAT-LOCKED · ${HYBRID_REQ} IN BOTH · FULL BONUS OF BOTH + MASTERY</small></h3><div class="appearance-options hybrid-options">${Object.entries(HYBRIDS).map(([pair,h])=>{const [x,y]=pair.split('+'),on=a.secondary&&[a.discipline,a.secondary].sort().join('+')===pair,u=classUnlock(x,y);return `<button type="button" class="appearance-choice ${on?'selected':''} ${u.ok?'':'locked'}" data-path="${x}+${y}" ${u.ok||on?'':'disabled'}>${h.label}<small>${CLASS_INFO[x].label} + ${CLASS_INFO[y].label}${u.ok?'':` · NEEDS ${u.requirement}`}</small></button>`;}).join('')}</div><small class="class-now">YOUR CLASS: <b>${pathInfo().label}</b> · ${pathInfo().description} ${pathInfo().bonus}${pathLocked()?` <em class="cap">NEEDS ${classUnlock(a.discipline,a.secondary).requirement}: PLAYING AS ${CLASS_INFO[a.discipline].label} UNTIL THEN</em>`:''}</small><small>Every class is open. Hybrids are the chase: reach ${HYBRID_REQ} in both stats (FIGHTER STR, TANK DEF, RANGER SPD, MAGE INT, SUPPORT DIS) to unlock one.</small><h3>WEAPON</h3><div class="appearance-options weapon-options">${['rootbound',...Object.values(CLASS_WEAPON)].map(name=>{const gate=weaponEligibility(name);return `<button type="button" class="appearance-choice ${a.weapon===name?'selected':''} ${gate.ok?'':'locked'}" data-feature="weapon" data-value="${name}" ${gate.ok?'':'disabled'}>${name.toUpperCase()}<small>${gate.ok?'READY':`LOCKED · ${gate.requirement}`}</small></button>`;}).join('')}</div><small>Fists for everyone. Each class weapon opens at level ${WEAPON_LEVEL} for its class (a hybrid carries both). Open your INVENTORY for details.</small><h3>SKIN TONE</h3>${choices('skinIndex',SKIN_TONES.map((c,i)=>[i,c]))}<h3>FACE</h3>${choices('face',FACE_STYLES.map(n=>[n,null]))}<h3>HAIR STYLE</h3>${choices('hairStyle',HAIR_STYLES.map(n=>[n,null]))}<h3>HAIR COLOR</h3>${choices('hairColor',Object.entries(HAIR_COLORS))}<h3>OUTFIT</h3>${choices('outfit',OUTFITS.map(n=>[n,null]))}<h3>SHIRT</h3>${choices('shirt',Object.entries(SHIRTS))}<h3>TROUSERS</h3>${choices('pants',Object.entries(TROUSERS))}<div class="panel-actions">${button('finish',onboarding?'BEGIN YOUR STORY →':'SAVE EXPLORER →',true)}</div></div><div class="customize-preview"><div class="preview-3d"></div><strong>${esc((profile.name||'WAYFARER').toUpperCase())}</strong><small>LIVE PREVIEW · DRAG TO TURN · PRESS V IN GAME TO INSPECT</small></div></div></section>`;
    dressingRoom?.mount(entry.querySelector('.preview-3d'),profile.appearance,weapon?.());
    entry.querySelector('[data-action="back"]')?.addEventListener('click',()=>show('menu'));
    entry.querySelector('[name="explorerName"]')?.addEventListener('change',e=>{profile.name=e.target.value.trim().slice(0,24);saveProfile();});
    entry.querySelector('[data-action="finish"]').onclick=()=>{
      const input=entry.querySelector('[name="explorerName"]');profile.name=(input?.value.trim()||profile.name||'Wayfarer').slice(0,24);
      profile.customized=true;saveProfile();onAppearance();
      show('menu');
    };
    // A class choice: "fighter+" is pure, "fighter+ranger" a hybrid. Keep the current
    // primary first when it is one of the pair (it is what the leaderboard shows).
    entry.querySelectorAll('[data-path]').forEach(b=>b.onclick=()=>{
      let [x,y]=b.dataset.path.split('+');if(y&&y===a.discipline)[x,y]=[y,x];
      profile.appearance.discipline=x;profile.appearance.secondary=y||'';saveProfile();onAppearance();renderCustomize();
    });
    entry.querySelectorAll('[data-feature]').forEach(b=>b.onclick=()=>{const key=b.dataset.feature;profile.appearance[key]=key==='skinIndex'?Number(b.dataset.value):b.dataset.value;if(profile.appearance.secondary===profile.appearance.discipline)profile.appearance.secondary='';saveProfile();onAppearance();renderCustomize();});
  }
  // The shared leaderboard (leaderboard.js): class, level, XP and the six stats,
  // never weight or height. 🧢 caps a friend's stat you think is fake; press it
  // again to lift your cap once they've shown you proof.
  let lastSync=0;
  function syncBoard(force=false){
    if(!force&&Date.now()-lastSync<60000)return Promise.resolve();lastSync=Date.now();
    return leaderboard.submit().catch(()=>{}).then(()=>leaderboard.refreshMyCaps()).catch(()=>{lastSync=0;});
  }
  function renderLeaderboard(){
    entry.innerHTML=`<section class="shell-card wide-card board-card"><div class="panel-heading"><div><span class="eyebrow">THE HOMIES · RANKED BY OVERALL</span><h2>LEADERBOARD</h2></div>${button('back','BACK')}</div><p>Ranked by OVR, the average of all six stats (a capped stat counts as 10, as it does in play); ties go to level. Levels come only from training you log; stats come from real tests. Only class, level, XP and stats are shown, never weight or height. Think a stat is fake? Press 🧢 to cap it: it stops counting until they show you proof in person or on video, then press 🧢 again to lift it.</p><div class="board-wrap"><p class="board-note">Loading the board…</p></div><small class="feedback">${esc(notice)}</small><div class="panel-actions"><button type="button" data-action="hide">${leaderboard.hidden?'SHOW ME ON THE BOARD':'HIDE ME FROM THE BOARD'}</button>${button('refresh','REFRESH',true)}</div></section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>{notice='';show('menu');};
    entry.querySelector('[data-action="refresh"]').onclick=()=>{notice='';renderLeaderboard();};
    entry.querySelector('[data-action="hide"]').onclick=async e=>{e.target.disabled=true;try{await leaderboard.setHidden(!leaderboard.hidden);}catch{}renderLeaderboard();};
    syncBoard(true).then(()=>leaderboard.load()).then(({rows,caps:all})=>{
      if(view!=='leaderboard')return;
      const me=leaderboard.id,names=new Map(rows.map(r=>[r.id,r.name]));
      const capsOn=(id,stat)=>all.filter(c=>c.target===id&&c.stat===stat);
      // Overall: the average of the six stats, a capped stat counting as at most 10 (as in play).
      const ovr=r=>STAT_KEYS.reduce((t,k)=>{const v=Number(r.stats?.[k])||0;return t+(capsOn(r.id,k).length?Math.min(v,10):v);},0)/STAT_KEYS.length;
      rows.forEach(r=>{r.ovr=ovr(r);});rows.sort((a,b)=>b.ovr-a.ovr||b.level-a.level||b.xp-a.xp);
      const cell=(r,stat)=>{const list=capsOn(r.id,stat),mine=list.some(c=>c.flagger===me),v=r.stats?.[stat]??'–';
        const who=list.map(c=>names.get(c.flagger)||'someone').join(', ');
        return `<td class="${list.length?'capped':''}" title="${list.length?`Capped by ${esc(who)}`:''}"><span class="stat-v">${v}</span>${r.id===me?(list.length?' <em class="cap-n">🧢'+list.length+'</em>':''):`<button type="button" class="cap ${mine?'on':''}" data-target="${r.id}" data-stat="${stat}" title="${mine?'Lift your cap (they showed proof)':'Cap this stat (you think it is fake)'}">🧢${list.length?`<b>${list.length}</b>`:''}</button>`}</td>`;};
      const table=rows.length?`<table class="board"><thead><tr><th>#</th><th>EXPLORER</th><th>OVR</th><th>CLASS</th><th>LV</th><th>XP</th>${STAT_KEYS.map(k=>`<th>${short[k]}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr class="${r.id===me?'me':''}"><td>${i+1}</td><td>${esc(r.name)}${r.id===me?' <em>YOU</em>':''}${r.title?`<small class="board-title">${esc(TITLES.find(t=>t.id===r.title)?.label||'')}</small>`:''}</td><td class="ovr">${r.ovr.toFixed(1)}</td><td>${esc(CLASS_INFO[r.klass]?.label||r.klass)}</td><td>${r.level}</td><td>${r.xp}</td>${STAT_KEYS.map(k=>cell(r,k)).join('')}</tr>`).join('')}</tbody></table>`:'<p class="board-note">No explorers yet. Finish your measure and you will be the first.</p>';
      entry.querySelector('.board-wrap').innerHTML=table;
      entry.querySelectorAll('button.cap').forEach(b=>b.onclick=async()=>{
        b.disabled=true;
        try{const on=await leaderboard.toggleCap(b.dataset.target,b.dataset.stat);notice=on?`Capped ${names.get(b.dataset.target)}’s ${b.dataset.stat}. It won’t count until you lift it.`:`Cap lifted from ${names.get(b.dataset.target)}’s ${b.dataset.stat}.`;}
        catch(err){notice=/join the board/.test(err.message||'')?'You need to be on the board yourself to cap someone.':'Could not reach the board. Try again.';}
        renderLeaderboard();
      });
    }).catch(()=>{if(view==='leaderboard')entry.querySelector('.board-wrap').innerHTML='<p class="board-note">The board could not be reached. Check your connection and press REFRESH.</p>';});
  }
  // Link this device (identity.js): move this explorer to another browser, or take one over here.
  function renderLink(){
    entry.innerHTML=`<section class="shell-card wide-card link-card"><div class="panel-heading"><div><span class="eyebrow">ONE EXPLORER · ANY DEVICE</span><h2>LINK DEVICE</h2></div>${button('back','BACK')}</div><p>Your explorer and story are saved online. Use a code to carry them to another computer or phone.</p><div class="link-columns"><div><h3>USE THIS EXPLORER ON ANOTHER DEVICE</h3><p class="link-note">Get a code here, then on the other device open the game, choose LINK DEVICE and enter it. Codes work once and last 10 minutes.</p><div class="link-code" aria-live="polite"></div>${button('make','GET A CODE',true)}</div><div><h3>BRING AN EXPLORER TO THIS DEVICE</h3><p class="link-note">Enter the code from your other device. <b>This replaces the explorer and progress on this device.</b></p><form id="linkForm"><input name="code" autocomplete="off" spellcheck="false" maxlength="12" placeholder="ABCD 2345" required><button class="primary" type="submit">LINK THIS DEVICE</button></form></div></div><small class="feedback">${esc(notice)}</small></section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>{notice='';if(profile.complete)show('menu');else{line=0;start();}};
    const out=entry.querySelector('.link-code');
    entry.querySelector('[data-action="make"]').onclick=async e=>{
      e.target.disabled=true;out.textContent='Saving your progress…';
      try{await saveNow?.();const code=await createLinkCode();out.innerHTML=`<strong>${code.slice(0,4)} ${code.slice(4)}</strong><small>Expires in 10 minutes · works once</small>`;}
      catch(err){console.warn('link failed',err);out.textContent='Could not reach the save service. Check your connection and try again.';}
      e.target.disabled=false;e.target.textContent='GET A NEW CODE';
    };
    entry.querySelector('#linkForm').onsubmit=async e=>{
      e.preventDefault();const code=e.target.elements.code.value;
      if(!confirm('Link this device? The explorer and progress on this device will be replaced by the linked one.'))return;
      try{
        if(!await claimLinkCode(code)){notice='That code is wrong or has expired. Get a new one on your other device.';renderLink();return;}
        // Clear this device's saves; the linked explorer's cloud save loads on the reload.
        localStorage.removeItem('hollow-roots-verdant-3d-profile-v1');localStorage.removeItem('verdant-reach-3d-v1');
        for(const k of Object.keys(sessionStorage))if(k.startsWith('hollow-roots-cloud-restored-'))sessionStorage.removeItem(k);
        location.href=location.pathname;
      }catch{notice='Could not reach the save service. Check your connection and try again.';renderLink();}
    };
  }
  function renderMap(){
    entry.innerHTML=`<section class="map-shell"><div class="map-heading"><span class="eyebrow">THE HOLLOW ROOTS · ATLAS</span><h2>THE LIVING WORLD</h2><p>Drag the globe through 360° · choose a realm</p>${button('back','← TITLE')}</div><div class="map-details"><span class="eyebrow">SELECTED REALM</span><h2 style="color:${selected.color}">${selected.name}</h2><p>${selected.description}</p><dl><dt>CREATURES</dt><dd>${selected.creatures}</dd><dt>GUARDIAN</dt><dd>${selected.guardian}</dd><dt>REQUIRED LEVEL</dt><dd>${selected.level} · YOU ARE LV ${level()}</dd></dl>${selected.id==='grove'?button('enter','ENTER VERDANT REACH →',true):`<button type="button" class="primary" data-action="enter" disabled>${level()<selected.level?`LOCKED · LEVEL ${selected.level}`:'REALM IN DEVELOPMENT'}</button>`}<div class="realm-list">${BIOMES.map(b=>`<button class="${selected.id===b.id?'selected':''}" data-realm="${b.id}"><i style="background:${b.color}"></i>${b.short}<small>${level()<b.level?`LV ${b.level}`:b.id==='grove'?'OPEN':'SOON'}</small></button>`).join('')}</div></div></section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>show('menu');
    entry.querySelector('[data-action="enter"]').onclick=()=>{if(selected.id==='grove')enterGame();};
    entry.querySelectorAll('[data-realm]').forEach(b=>b.onclick=()=>{selected=BIOMES.find(v=>v.id===b.dataset.realm);globe.face(selected);renderMap();});
  }
  canvas.addEventListener('pointerdown',e=>{if(view!=='map')return;pointer={x:e.clientX,last:e.clientX,moved:false};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(view!=='map'||!pointer)return;const delta=e.clientX-pointer.last;pointer.last=e.clientX;if(Math.abs(e.clientX-pointer.x)>5)pointer.moved=true;globe.turn(delta*.008);});
  canvas.addEventListener('pointerup',e=>{if(view!=='map'||!pointer)return;if(!pointer.moved){const rect=canvas.getBoundingClientRect();const picked=globe.pick((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);if(picked){selected=picked;renderMap();}}pointer=null;});
  return {start,show,inventory(){invFromGame=true;show('inventory');},get view(){return view;},hide(){stopTyping();lofi.want(false);entry.classList.add('hidden');entry.classList.remove('map-view');view='game';},pause(){pauseGame();show('menu');}};
}
