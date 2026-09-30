import {BIOMES,METRICS,FRAMES,PERSONALITY,profile,saveProfile,loadProfile,stats,rawStats,level,weekKey,logActivity,CLASS_INFO,recommendedClass,classReason,frame,weaponEligibility,weeklyPlan,checkPlanItem,uncheckPlanItem,testStatus,recordTest,growth,goalBoon,GOALS,setGoal,logWeighIn,nextWeighIn,localDay,percentile} from './profile.js';
import {mechanicsTable,ABILITIES,unlockedAbilities} from './mechanics.js';
import {WORKOUTS,WORKOUT_NOTE} from './training.js';
import {QUESTIONS,canTakeReasoning} from './reasoning.js';
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
  {mood:'serious',text:'The forest is sick. Its memories have been drained, and its old guardian has turned. It needs someone real.'},
  {mood:'welcoming',text:'I am Mycel, keeper of the Heartseed. Before you step in, I must take your measure: your body, your mind, and the way you fight.'},
  {mood:'warm',text:'Be honest. The roots always know, and nobody here judges where you start. Only that you start.'}
];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short={strength:'STR',speed:'SPD',stamina:'STA',defense:'DEF',intelligence:'INT',discipline:'DIS'};

export function createShell(entry,canvas,globe,{enterGame,pauseGame,onAppearance,narrator}){
  loadProfile();let workoutId='A',testBefore=null,goalEdit=false,view='menu',line=0,typing=null,selected=BIOMES[0],pointer=null,notice='',quizIndex=0,quizCorrect=0,quizStarted=0,personalityIndex=0;
  const stopTyping=()=>{if(typing){clearInterval(typing);typing=null;}if(narrator)narrator.talking=false;};
  // First time through: intro → measure → check → how you play → reveal → look.
  const onboarding=()=>!profile.customized;
  const step=n=>onboarding()?` · STEP ${n} OF 4`:'';
  const startQuiz=()=>{quizIndex=0;quizCorrect=0;quizStarted=Date.now();show('quiz');};
  const button=(action,label,primary=false)=>`<button type="button" class="${primary?'primary':''}" data-action="${action}">${label}</button>`;
  function show(next){stopTyping();view=next;entry.classList.remove('hidden');entry.classList.toggle('map-view',view==='map');entry.classList.toggle('intro-view',view==='intro');
    if(view==='intro')renderIntro();else if(view==='baseline')renderBaseline();else if(view==='personality')renderPersonality();else if(view==='reveal')renderReveal();else if(view==='quiz')renderQuiz();else if(view==='map')renderMap();else if(view==='weekly')renderWeekly();else if(view==='workout')renderWorkout();else if(view==='testResult')renderTestResult();
    else if(view==='customize')renderCustomize();else if(view==='stats')renderStats();else if(view==='leaderboard')renderLeaderboard();else renderMenu();
  }
  // Returning players (measure saved) go straight to the menu; HOW YOU PLAY is on the stats screen.
  function start(){show(profile.complete?'menu':profile.introSeen?'baseline':'intro');}
  function renderIntro(){
    const beat=INTRO[line];
    entry.innerHTML=`<div class="story-stage"><div class="story-box"><span class="eyebrow">THE HEARTSEED SPEAKS · ${line+1} / ${INTRO.length}</span><h2>MYCEL</h2><p id="spoken"></p>${beat.chips?`<div class="story-chips">${beat.chips.map((c,i)=>`<span style="animation-delay:${.4+i*.18}s">${esc(c)}</span>`).join('')}</div>`:''}<div class="story-actions">${button('skip','SKIP INTRO')}${button('next',line===INTRO.length-1?'BEGIN →':'NEXT ▸',true)}</div><small>Click NEXT or press Space to reveal a line, then again to continue.</small></div></div>`;
    const target=entry.querySelector('#spoken'),phrase=beat.text;let cursor=0;
    if(narrator){narrator.say(beat.mood,line>0);narrator.talking=true;}
    typing=setInterval(()=>{target.textContent=phrase.slice(0,++cursor);if(cursor>=phrase.length)stopTyping();},26);
    const finish=()=>{profile.introSeen=true;saveProfile();show('baseline');};
    entry.querySelector('[data-action="next"]').onclick=()=>{
      if(typing){stopTyping();target.textContent=phrase;return;}
      if(++line>=INTRO.length){finish();return;}
      renderIntro();
    };
    entry.querySelector('[data-action="skip"]').onclick=finish;
  }
  addEventListener('keydown',e=>{if(view==='intro'&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();entry.querySelector('[data-action="next"]')?.click();}});
  function renderMenu(){
    entry.innerHTML=`<section class="shell-card menu-card"><span class="eyebrow">REAL EFFORT · IN-GAME POWER</span><h1>THE HOLLOW<br>ROOTS</h1><p class="shell-subtitle">What you build outside, you carry inside.</p><div class="level-strip"><strong>LV ${level()} EXPLORER</strong><span>${profile.xp} real-world XP</span><button data-action="stats">VIEW STATS ↗</button></div><div class="menu-actions">${button('map','CONTINUE · WORLD MAP',true)}${button('customize','CUSTOMIZE')}${button('weekly','WEEKLY QUEST + LOG')}${button('leaderboard','LEADERBOARD')}</div><small class="save-caption">AUTOSAVE ON · YOUR 3D PROTOTYPE HAS ITS OWN PROFILE</small></section>`;
    for(const name of ['map','customize','weekly','leaderboard','stats'])entry.querySelector(`[data-action="${name}"]`).onclick=()=>show(name);
  }
  function renderBaseline(){
    const imperial=profile.units==='imperial',conv=m=>imperial&&m.imperial;
    const shown=m=>{const v=profile.inputs[m.key];if(m.clock)return `${Math.floor(v/60)}:${String(Math.round(v%60)).padStart(2,'0')}`;return conv(m)?String(Math.round(v*m.imperial.factor/m.imperial.step)*m.imperial.step):String(v);};
    // Where a result stands among all adults (profile.js METRICS norms).
    const rank=(m,v)=>{const p=percentile(m,v);return p>=99?`TOP ${Math.max(.1,Math.round((100-p)*10)/10)}% OF ADULTS`:`BETTER THAN ${Math.round(p)}% OF ADULTS`;};
    const input=m=>`<label class="metric"><span>${m.label} <small>${conv(m)?m.imperial.unit:m.unit}</small></span><input name="${m.key}" ${m.clock?'type="text" inputmode="numeric" placeholder="10:00"':'type="number" inputmode="decimal" step="any"'} value="${shown(m)}" data-shown="${shown(m)}" required>${m.norms?`<em class="rank" data-rank="${m.key}">${rank(m,profile.inputs[m.key])}</em>`:''}</label>`;
    // After the first test, measurements are retaken monthly (a fix is allowed for two days after a test).
    const st=testStatus(),first=!st.count,locked=!first&&!st.due&&!st.correctable;
    const title=first?`MYCEL'S MEASURE${step(1)}`:st.due?'MONTHLY TEST · OPEN NOW':st.correctable?'THIS MONTH’S TEST · FIXES OPEN FOR 2 DAYS':`MONTHLY TEST · NEXT IN ${st.nextIn} DAY${st.nextIn===1?'':'S'}`;
    const lead=first?'Mycel reads your frame and what your body can do today. Use your real results. Every frame has a gift, so there is nothing to hide.':st.due?'A month has passed. Test yourself again: every stat that rises earns a Growth bonus on top, and higher stats unlock abilities.':st.correctable?'You can still fix a mistake in this month’s test.':`Your measurements lock between monthly tests so every gain is a real one. Your next test opens in ${st.nextIn} day${st.nextIn===1?'':'s'}. Until then, WEEKLY QUEST training keeps raising your level.`;
    entry.innerHTML=`<section class="shell-card wide-card"><div class="panel-heading"><div><span class="eyebrow">${title}</span><h2>${first?'YOUR MEASURE':'MONTHLY TEST'}</h2></div><div class="unit-toggle">${button('metric','METRIC',!imperial)}${button('imperial','IMPERIAL',imperial)}</div></div><p>${lead}</p><form id="baselineForm" class="${locked?'locked':''}"><h3>YOUR FRAME</h3><div class="metric-grid">${METRICS.filter(m=>m.body).map(input).join('')}</div><h3>WHAT YOU CAN DO</h3><div class="metric-grid">${METRICS.filter(m=>!m.body).map(input).join('')}<div class="metric auto-metric"><span>Discipline <small>auto</small></span><strong>${stats().discipline}</strong><small>Calculated from the training you log in WEEKLY QUEST; it rises as you keep showing up.</small></div></div><div class="baseline-note">Each result is scored against all adults: the middle of everyone is 10, the top 1% is 18, and the top 0.1% is 20. Weight and height choose your frame (Stoneframe, Swiftframe or Trueframe); they never lower a stat. Mile time as minutes:seconds. Intelligence comes from Mycel's check next; discipline is calculated automatically from the training you log.</div><div class="panel-actions">${onboarding()?'':button('back','BACK')}${locked?'':`<button class="primary" type="submit">${onboarding()?'NEXT · MIND CHECK →':st.correctable&&!first?'SAVE FIX →':'RECORD TEST →'}</button>`}</div></form></section>`;
    const form=entry.querySelector('#baselineForm');
    if(locked)form.querySelectorAll('input').forEach(i=>{i.disabled=true;});
    form.addEventListener('input',e=>{
      const m=METRICS.find(x=>x.key===e.target.name),out=m?.norms&&form.querySelector(`[data-rank="${m.key}"]`);if(!out)return;
      const raw=e.target.value.trim(),hit=m.clock&&/^(\d{1,2}):(\d{2})$/.exec(raw),v=m.clock?(hit?Number(hit[1])*60+Number(hit[2]):Number(raw)*60):Number(raw)/(conv(m)?m.imperial.factor:1);
      if(raw&&Number.isFinite(v))out.textContent=rank(m,v);
    });
    const read=strict=>{
      for(const m of METRICS){
        const el=form.elements[m.key],raw=el.value.trim();let v;
        if(raw===el.dataset.shown){el.setCustomValidity('');continue;}   // untouched: keep the exact stored value
        if(m.clock){const hit=/^(\d{1,2}):(\d{2})$/.exec(raw);v=hit?Number(hit[1])*60+Number(hit[2]):Number(raw)*60;}
        else v=Number(raw)/(conv(m)?m.imperial.factor:1);
        const ok=raw&&Number.isFinite(v)&&v>=m.min&&v<=m.max;
        el.setCustomValidity(ok?'':m.clock?'Enter minutes:seconds, for example 9:30':`Enter a value between ${conv(m)?Math.round(m.min*m.imperial.factor):m.min} and ${conv(m)?Math.round(m.max*m.imperial.factor):m.max}`);
        if(!ok){if(strict){el.reportValidity();return false;}continue;}
        profile.inputs[m.key]=Math.round(v*100)/100;
      }
      return true;
    };
    for(const u of ['metric','imperial'])entry.querySelector(`[data-action="${u}"]`).onclick=()=>{read(false);profile.units=u;saveProfile();renderBaseline();};
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
    const rec=recommendedClass(),c=CLASS_INFO[rec],f=FRAMES[frame()],current=profile.appearance.discipline;
    entry.innerHTML=`<section class="shell-card wide-card reveal-card"><span class="eyebrow">MYCEL READS YOU${step(4)}</span><h2>WHAT THE ROOTS SEE</h2><div class="reveal-grid"><div class="class-recommend"><small>RECOMMENDED CLASS</small><strong>${c.label}</strong><span>${c.description}</span><em>${c.bonus}</em><p>${esc(classReason())}</p></div><div class="class-recommend frame-card"><small>YOUR FRAME</small><strong>${f.label}</strong><span>${f.description}</span><em>${f.bonus}</em></div></div>${statTiles()}<div class="panel-actions">${button('again','ANSWER AGAIN')}${onboarding()?'':button('keep',`KEEP ${CLASS_INFO[current]?.label||'MY CLASS'}`)}${button('take',onboarding()?'ACCEPT · CHOOSE YOUR LOOK →':`TAKE ${c.label}`,true)}</div><small class="baseline-note">You can switch class any time in CUSTOMIZE.</small></section>`;
    entry.querySelector('[data-action="again"]').onclick=()=>{personalityIndex=0;show('personality');};
    entry.querySelector('[data-action="keep"]')?.addEventListener('click',()=>show('stats'));
    entry.querySelector('[data-action="take"]').onclick=()=>{profile.appearance.discipline=rec;saveProfile();onAppearance();show(onboarding()?'customize':'stats');};
  }
  function statTiles(){const values=stats(),raw=rawStats();return `<div class="stat-grid">${Object.entries(values).map(([key,v])=>`<div><small>${short[key]}${v>raw[key]?` <em class="bonus">+${v-raw[key]}</em>`:''}</small><strong>${v}</strong><span>${key.toUpperCase()}</span></div>`).join('')}</div>`;}
  /** The twelve abilities: which your stats have unlocked, and what the rest need. */
  function abilityGrid(){const s=stats(),on=new Set(unlockedAbilities(s).map(a=>a.id));
    return `<div class="ability-grid">${ABILITIES.map(a=>`<article class="${on.has(a.id)?'on':''}"><small>${short[a.stat]} ${a.at}</small><b>${a.name}</b><span>${esc(a.text)}</span><em>${on.has(a.id)?'UNLOCKED':`${short[a.stat]} ${s[a.stat]} / ${a.at}`}</em></article>`).join('')}</div>`;}
  function bonusNote(){
    const gr=Object.entries(growth()),boon=goalBoon(),st=testStatus(),parts=[];
    if(gr.length)parts.push(`Growth since your last test: ${gr.map(([k,v])=>`+${v.bonus} ${short[k]} (you rose ${v.gain})`).join(', ')}.`);
    if(boon.points)parts.push(`Body goal: +${boon.points} ${short[boon.stat]} for your class (${boon.marks} marks in 12 weeks).`);
    parts.push(st.due?'Your monthly test is open now.':`Next monthly test in ${st.nextIn} day${st.nextIn===1?'':'s'}.`);
    return `<p class="bonus-note">${parts.join(' ')}</p>`;}
  function renderStats(){const rec=recommendedClass();entry.innerHTML=`<section class="shell-card wide-card"><div class="panel-heading"><div><span class="eyebrow">REAL LIFE → GAMEPLAY</span><h2>EXPLORER STATS</h2></div>${button('back','BACK')}</div>${statTiles()}${bonusNote()}<h3>ABILITIES · A STAT OF 12 AND 16 UNLOCKS EACH</h3>${abilityGrid()}<div class="reveal-grid"><div class="class-recommend"><small>RECOMMENDED CLASS</small><strong>${CLASS_INFO[rec].label}</strong><span>${CLASS_INFO[rec].description}</span><p>${esc(classReason())}</p></div><div class="class-recommend frame-card"><small>YOUR FRAME</small><strong>${FRAMES[frame()].label}</strong><span>${FRAMES[frame()].description}</span><em>${FRAMES[frame()].bonus}</em></div></div><div class="impact-grid">${mechanicsTable().map(([k,v])=>`<article><b>${k}</b><span>${esc(v)}</span></article>`).join('')}</div><div class="panel-actions">${button('baseline',testStatus().due?'MONTHLY TEST · OPEN':'MONTHLY TEST')}${button('personality','HOW YOU PLAY')}${canTakeReasoning(profile.reasoningTaken)?button('quiz','MIND CHECK'):''}${button('weekly','OPEN WEEKLY QUEST',true)}</div><small class="baseline-note">The mind check sets a game estimate, not a clinical IQ score. Retake after 30 days.</small></section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>show('menu');entry.querySelector('[data-action="baseline"]').onclick=()=>show('baseline');entry.querySelector('[data-action="weekly"]').onclick=()=>show('weekly');
    entry.querySelector('[data-action="personality"]').onclick=()=>{personalityIndex=0;show('personality');};
    entry.querySelector('[data-action="quiz"]')?.addEventListener('click',startQuiz);}
  function renderQuiz(){const q=QUESTIONS[quizIndex];
    entry.innerHTML=`<section class="shell-card wide-card quiz-card"><span class="eyebrow">MYCEL'S MIND CHECK · ${q.kind==='knowledge'?'KNOWLEDGE':'REASONING'} · ${quizIndex+1} / ${QUESTIONS.length}${step(2)}</span><h2>${esc(q.prompt)}</h2><p>Select the best answer. Eight short questions set your Intelligence; this is a game estimate, not an IQ diagnosis.</p><div class="quiz-options">${q.options.map((o,i)=>`<button data-answer="${i}">${esc(o)}</button>`).join('')}</div><div class="panel-actions">${button('skip','KEEP DEFAULT SCORE')}</div></section>`;
    entry.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{
      if(Number(b.dataset.answer)===q.answer)quizCorrect++;
      quizIndex++;if(quizIndex<QUESTIONS.length){renderQuiz();return;}
      const accuracy=quizCorrect/QUESTIONS.length,pace=Math.max(0,1-(Date.now()-quizStarted)/300000);
      profile.reasoning=Math.round(70+65*(accuracy*.85+accuracy*pace*.15));profile.reasoningTaken=new Date().toISOString().slice(0,10);
      saveProfile();show(onboarding()?'personality':'stats');
    });
    entry.querySelector('[data-action="skip"]').onclick=()=>show(onboarding()?'personality':'stats');
  }
  // WEEKLY QUEST: this week's step of the training plan, checked off one day at a
  // time; the body goal and weigh-ins; and a free log for anything else.
  function renderWeekly(){
    const plan=weeklyPlan(),today=localDay(),imperial=profile.units==='imperial',unit=imperial?'lb':'kg';
    const shownKg=kg=>imperial?Math.round(kg*2.20462):Math.round(kg*10)/10,toKg=v=>imperial?v/2.20462:v;
    const item=i=>`<div class="plan-item ${i.done.length>=i.count?'done':''}"><div class="plan-main">${i.workout?`<button type="button" class="plan-open" data-open="${i.workout}">${esc(i.label)}<small>${WORKOUTS[i.workout].minutes} MIN · NO EQUIPMENT · OPEN ›</small></button>`:`<strong>${esc(i.label)}</strong>`}<small>${Math.min(i.count,i.done.length)} / ${i.count} ${i.unit}${i.count>1?'s':''}</small></div><div class="plan-checks">${Array.from({length:i.count},(_,k)=>{const d=i.done[k];return `<button type="button" class="check ${d?'on':''}" data-check="${i.id}" data-date="${d||''}" title="${d?`Logged ${d}${d===today?' · click to undo':''}`:i.workout?'Open the workout':'Check off today'}">${d?'✓':''}</button>`;}).join('')}</div></div>`;
    const g=profile.goal,boon=goalBoon(),wait=nextWeighIn(),history=profile.weighIns.slice(-6).reverse();
    const goalForm=`<form id="goalForm"><div class="goal-types">${Object.entries(GOALS).map(([k,v])=>`<label><input type="radio" name="type" value="${k}" ${(g.type||'lose')===k?'checked':''}><span>${v.label}</span></label>`).join('')}</div><label>WEIGHT TODAY (${unit})<input name="current" type="number" step="any" required value="${profile.weighIns.at(-1)?shownKg(profile.weighIns.at(-1).kg):shownKg(profile.inputs.weightKg)}"></label><label class="target-field">TARGET WEIGHT (${unit})<input name="target" type="number" step="any" value="${g.type&&g.type!=='recomp'?shownKg(g.targetKg):''}"></label><button class="primary" type="submit">SET GOAL</button></form>`;
    const goalPanel=!g.type||goalEdit?goalForm:`<div class="goal-now"><strong>${GOALS[g.type].label}</strong>${g.type!=='recomp'?`<span>TARGET ${shownKg(g.targetKg)} ${unit}</span>`:''}<small>${GOALS[g.type].pace}</small><div class="boon"><b>+${boon.points} ${short[boon.stat]}</b><span>${boon.marks} mark${boon.marks===1?'':'s'} in the last 12 weeks · every 2 marks = +1 ${boon.stat.toUpperCase()} for your ${(profile.appearance.discipline||'fighter').toUpperCase()} (max +5)</span></div></div><form id="weighForm"><label>WEEKLY WEIGH-IN (${unit})<input name="kg" type="number" step="any" required ${wait?'disabled':''} placeholder="${wait?`opens in ${wait} day${wait===1?'':'s'}`:'weight today'}"></label><button class="primary" type="submit" ${wait?'disabled':''}>LOG WEIGH-IN</button></form>${history.length?`<ul class="weigh-list">${history.map(w=>`<li><span>${w.date}</span><b>${shownKg(w.kg)} ${unit}</b><em>${w.marks?'✦'.repeat(w.marks):'·'}</em></li>`).join('')}</ul>`:''}<button type="button" class="link-button" data-action="changeGoal">CHANGE GOAL</button>`;
    entry.innerHTML=`<section class="shell-card wide-card weekly-card"><div class="panel-heading"><div><span class="eyebrow">WEEK ${plan.week} OF THE PLAN · ${plan.tier} · RESETS MONDAY</span><h2>WEEKLY QUEST</h2></div>${button('back','BACK')}</div><div class="plan-progress"><div class="goal-track"><i style="width:${plan.checked/plan.total*100}%"></i></div><small>${plan.checked} / ${plan.total} checked · ${plan.claimed?'WEEK COMPLETE · BONUS CLAIMED':`finish the week for +${plan.bonus} XP`} · finish half or more to move up next week</small></div><div class="weekly-columns"><div><h3>THIS WEEK</h3>${plan.items.map(item).join('')}<small class="feedback">${esc(notice)}</small></div><div><h3>BODY GOAL</h3>${goalPanel}<h3>OTHER ACTIVITY</h3><form id="logForm"><label>ACTIVITY<select name="kind"><option value="workout">Workout day</option><option value="steps">Daily steps</option><option value="run">Run or walk distance (km)</option><option value="study">Learning (minutes)</option></select></label><label>AMOUNT<input name="amount" type="number" min="1" step="any" value="1" required></label><button type="submit">RECORD ACTIVITY</button></form></div></div><div class="panel-actions">${button('stats','VIEW YOUR STATS')}</div></section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>{notice='';show('menu');};entry.querySelector('[data-action="stats"]').onclick=()=>show('stats');
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
    log.onsubmit=e=>{e.preventDefault();notice=logActivity(log.elements.kind.value,Number(amount.value));renderWeekly();};
    const gf=entry.querySelector('#goalForm');
    if(gf){const sync=()=>{gf.querySelector('.target-field').classList.toggle('hidden',gf.elements.type.value==='recomp');};gf.querySelectorAll('[name="type"]').forEach(r=>r.onchange=sync);sync();
      gf.onsubmit=e=>{e.preventDefault();const t=gf.elements.type.value;notice=setGoal(t,toKg(Number(gf.elements.current.value)),toKg(Number(gf.elements.target.value)));if(profile.goal.type===t)goalEdit=false;renderWeekly();};}
    const wf=entry.querySelector('#weighForm');
    if(wf)wf.onsubmit=e=>{e.preventDefault();notice=logWeighIn(toKg(Number(wf.elements.kg.value)));renderWeekly();};
    entry.querySelector('[data-action="changeGoal"]')?.addEventListener('click',()=>{goalEdit=true;renderWeekly();});
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
    const choices=(key,items)=>`<div class="appearance-options">${items.map(([name,color])=>`<button type="button" class="appearance-choice ${String(a[key])===String(name)?'selected':''}" data-feature="${key}" data-value="${name}">${color?`<i style="background:${color}"></i>`:''}${String(name).toUpperCase()}</button>`).join('')}</div>`;
    // The first time through (after the baseline), naming and dressing the explorer is part of onboarding.
    const onboarding=!profile.customized;
    entry.innerHTML=`<section class="shell-card wide-card customize-panel"><div class="panel-heading"><div><span class="eyebrow">${onboarding?'BEFORE THE FIRST HUNT':'THE EXPLORER'}</span><h2>MAKE IT YOURS</h2></div>${onboarding?'':button('back','BACK')}</div><p>Changes autosave. Play in first person, then press V to see your complete explorer in the world. Your arms and outfit also appear during first-person combat.</p><div class="class-recommend"><small>MYCEL RECOMMENDS</small><strong>${CLASS_INFO[recommendedClass()].label}</strong><span>${CLASS_INFO[recommendedClass()].description}</span><em>${CLASS_INFO[recommendedClass()].bonus}</em></div><div class="customize-layout"><div class="customize-fields"><h3>NAME</h3><input class="name-input" name="explorerName" maxlength="24" value="${esc(profile.name)}" placeholder="WAYFARER"><h3>COMBAT CLASS</h3>${choices('discipline',Object.keys(CLASS_INFO).map(name=>[name,null]))}<small>${CLASS_INFO[a.discipline]?.description||CLASS_INFO.fighter.description} ${CLASS_INFO[a.discipline]?.bonus||''}</small><h3>WEAPON</h3><div class="appearance-options weapon-options">${['rootbound','groveblade','stonebreaker'].map(name=>{const gate=weaponEligibility(name);return `<button type="button" class="appearance-choice ${a.weapon===name?'selected':''} ${gate.ok?'':'locked'}" data-feature="weapon" data-value="${name}" ${gate.ok?'':'disabled'}>${name.toUpperCase()}<small>${gate.ok?'READY':`LOCKED · ${gate.requirement}`}</small></button>`;}).join('')}</div><small>Train your real attributes to unlock heavier weapons. The Stonebreaker cracks shells.</small><h3>SKIN TONE</h3>${choices('skinIndex',SKIN_TONES.map((c,i)=>[i,c]))}<h3>FACE</h3>${choices('face',FACE_STYLES.map(n=>[n,null]))}<h3>HAIR STYLE</h3>${choices('hairStyle',HAIR_STYLES.map(n=>[n,null]))}<h3>HAIR COLOR</h3>${choices('hairColor',Object.entries(HAIR_COLORS))}<h3>OUTFIT</h3>${choices('outfit',OUTFITS.map(n=>[n,null]))}<h3>SHIRT</h3>${choices('shirt',Object.entries(SHIRTS))}<h3>TROUSERS</h3>${choices('pants',Object.entries(TROUSERS))}<div class="panel-actions">${button('finish',onboarding?'BEGIN YOUR STORY →':'SAVE EXPLORER →',true)}</div></div><div class="customize-preview"><div class="preview-head" style="--skin:${SKIN_TONES[a.skinIndex]};--hair:${HAIR_COLORS[a.hairColor]}"><i class="preview-hair ${a.hairStyle}"></i><i class="preview-eyes ${a.face}"></i><i class="preview-mouth"></i></div><div class="preview-body" style="background:${SHIRTS[a.shirt]}"><i class="preview-arm left" style="background:${SHIRTS[a.shirt]}"></i><i class="preview-arm right" style="background:${SHIRTS[a.shirt]}"></i></div><div class="preview-legs" style="--pants:${TROUSERS[a.pants]}"><i></i><i></i></div><strong>${esc((profile.name||'WAYFARER').toUpperCase())}</strong><small>APPEARANCE · PRESS V IN GAME TO INSPECT</small></div></div></section>`;
    entry.querySelector('[data-action="back"]')?.addEventListener('click',()=>show('menu'));
    entry.querySelector('[name="explorerName"]')?.addEventListener('change',e=>{profile.name=e.target.value.trim().slice(0,24);saveProfile();});
    entry.querySelector('[data-action="finish"]').onclick=()=>{
      const input=entry.querySelector('[name="explorerName"]');profile.name=(input?.value.trim()||profile.name||'Wayfarer').slice(0,24);
      profile.customized=true;saveProfile();onAppearance();
      show('menu');
    };
    entry.querySelectorAll('[data-feature]').forEach(b=>b.onclick=()=>{const key=b.dataset.feature;profile.appearance[key]=key==='skinIndex'?Number(b.dataset.value):b.dataset.value;saveProfile();onAppearance();renderCustomize();});
  }
  function renderLeaderboard(){entry.innerHTML=`<section class="shell-card wide-card"><div class="panel-heading"><div><span class="eyebrow">THE HOLLOW ROOTS</span><h2>LEADERBOARD</h2></div>${button('back','BACK')}</div><p>The 3D prototype does not have an online leaderboard connection yet. Other players' scores and islands cannot be shown accurately until a shared service is configured.</p><div class="stat-grid"><div><small>YOUR LEVEL</small><strong>${level()}</strong><span>EXPLORER</span></div><div><small>YOUR XP</small><strong>${profile.xp}</strong><span>REAL EFFORT</span></div></div></section>`;entry.querySelector('[data-action="back"]').onclick=()=>show('menu');}
  function renderMap(){
    entry.innerHTML=`<section class="map-shell"><div class="map-heading"><span class="eyebrow">THE HOLLOW ROOTS · ATLAS</span><h2>THE LIVING WORLD</h2><p>Drag the globe through 360° · choose a realm</p>${button('back','← TITLE')}</div><div class="map-details"><span class="eyebrow">SELECTED REALM</span><h2 style="color:${selected.color}">${selected.name}</h2><p>${selected.description}</p><dl><dt>CREATURES</dt><dd>${selected.creatures}</dd><dt>GUARDIAN</dt><dd>${selected.guardian}</dd><dt>REQUIRED LEVEL</dt><dd>${selected.level} · YOU ARE LV ${level()}</dd></dl>${button('enter',selected.id==='grove'?'ENTER VERDANT REACH →':level()<selected.level?`LOCKED · LEVEL ${selected.level}`:'REALM IN DEVELOPMENT',true)}<div class="realm-list">${BIOMES.map(b=>`<button class="${selected.id===b.id?'selected':''}" data-realm="${b.id}"><i style="background:${b.color}"></i>${b.short}<small>${level()<b.level?`LV ${b.level}`:b.id==='grove'?'OPEN':'SOON'}</small></button>`).join('')}</div></div></section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>show('menu');
    entry.querySelector('[data-action="enter"]').onclick=()=>{if(selected.id==='grove')enterGame();};
    entry.querySelectorAll('[data-realm]').forEach(b=>b.onclick=()=>{selected=BIOMES.find(v=>v.id===b.dataset.realm);globe.face(selected);renderMap();});
  }
  canvas.addEventListener('pointerdown',e=>{if(view!=='map')return;pointer={x:e.clientX,last:e.clientX,moved:false};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(view!=='map'||!pointer)return;const delta=e.clientX-pointer.last;pointer.last=e.clientX;if(Math.abs(e.clientX-pointer.x)>5)pointer.moved=true;globe.turn(delta*.008);});
  canvas.addEventListener('pointerup',e=>{if(view!=='map'||!pointer)return;if(!pointer.moved){const rect=canvas.getBoundingClientRect();const picked=globe.pick((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);if(picked){selected=picked;renderMap();}}pointer=null;});
  return {start,show,get view(){return view;},hide(){stopTyping();entry.classList.add('hidden');entry.classList.remove('map-view');view='game';},pause(){pauseGame();show('menu');}};
}
