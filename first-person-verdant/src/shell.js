import {BIOMES,METRICS,FRAMES,PERSONALITY,profile,saveProfile,loadProfile,stats,level,weeklyGoals,weekKey,logActivity,CLASS_INFO,recommendedClass,classReason,frame,weaponEligibility} from './profile.js';
import {mechanicsTable} from './mechanics.js';
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
  loadProfile();let view='menu',line=0,typing=null,selected=BIOMES[0],pointer=null,notice='',quizIndex=0,quizCorrect=0,quizStarted=0,personalityIndex=0;
  const stopTyping=()=>{if(typing){clearInterval(typing);typing=null;}if(narrator)narrator.talking=false;};
  // First time through: intro → measure → check → how you play → reveal → look.
  const onboarding=()=>!profile.customized;
  const step=n=>onboarding()?` · STEP ${n} OF 4`:'';
  const startQuiz=()=>{quizIndex=0;quizCorrect=0;quizStarted=Date.now();show('quiz');};
  const button=(action,label,primary=false)=>`<button type="button" class="${primary?'primary':''}" data-action="${action}">${label}</button>`;
  function show(next){stopTyping();view=next;entry.classList.remove('hidden');entry.classList.toggle('map-view',view==='map');entry.classList.toggle('intro-view',view==='intro');
    if(view==='intro')renderIntro();else if(view==='baseline')renderBaseline();else if(view==='personality')renderPersonality();else if(view==='reveal')renderReveal();else if(view==='quiz')renderQuiz();else if(view==='map')renderMap();else if(view==='weekly')renderWeekly();
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
    const input=m=>`<label class="metric"><span>${m.label} <small>${conv(m)?m.imperial.unit:m.unit}</small></span><input name="${m.key}" ${m.clock?'type="text" inputmode="numeric" placeholder="10:00"':'type="number" inputmode="decimal" step="any"'} value="${shown(m)}" data-shown="${shown(m)}" required></label>`;
    entry.innerHTML=`<section class="shell-card wide-card"><div class="panel-heading"><div><span class="eyebrow">MYCEL'S MEASURE${step(1)}</span><h2>YOUR MEASURE</h2></div><div class="unit-toggle">${button('metric','METRIC',!imperial)}${button('imperial','IMPERIAL',imperial)}</div></div><p>Mycel reads your frame and what your body can do today. Use your real results; you can update them whenever they change. Every frame has a gift, so there is nothing to hide.</p><form id="baselineForm"><h3>YOUR FRAME</h3><div class="metric-grid">${METRICS.filter(m=>m.body).map(input).join('')}</div><h3>WHAT YOU CAN DO</h3><div class="metric-grid">${METRICS.filter(m=>!m.body).map(input).join('')}</div><div class="baseline-note">Weight and height choose your frame (Stoneframe, Swiftframe or Trueframe); they never lower a stat. Bench press is judged against your body weight. Mile time as minutes:seconds. Intelligence comes from Mycel's check next; discipline from the training you log.</div><div class="panel-actions">${onboarding()?'':button('back','BACK')}<button class="primary" type="submit">${onboarding()?'NEXT · MIND CHECK →':'SAVE MEASURE →'}</button></div></form></section>`;
    const form=entry.querySelector('#baselineForm');
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
      e.preventDefault();if(!read(true))return;
      profile.complete=true;saveProfile();if(onboarding())startQuiz();else show('stats');
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
  function statTiles(){const values=stats();return `<div class="stat-grid">${Object.entries(values).map(([key,v])=>`<div><small>${short[key]}</small><strong>${v}</strong><span>${key.toUpperCase()}</span></div>`).join('')}</div>`;}
  function renderStats(){const rec=recommendedClass();entry.innerHTML=`<section class="shell-card wide-card"><div class="panel-heading"><div><span class="eyebrow">REAL LIFE → GAMEPLAY</span><h2>EXPLORER STATS</h2></div>${button('back','BACK')}</div>${statTiles()}<div class="reveal-grid"><div class="class-recommend"><small>RECOMMENDED CLASS</small><strong>${CLASS_INFO[rec].label}</strong><span>${CLASS_INFO[rec].description}</span><p>${esc(classReason())}</p></div><div class="class-recommend frame-card"><small>YOUR FRAME</small><strong>${FRAMES[frame()].label}</strong><span>${FRAMES[frame()].description}</span><em>${FRAMES[frame()].bonus}</em></div></div><div class="impact-grid">${mechanicsTable().map(([k,v])=>`<article><b>${k}</b><span>${esc(v)}</span></article>`).join('')}</div><div class="panel-actions">${button('baseline','UPDATE MEASUREMENTS')}${button('personality','HOW YOU PLAY')}${canTakeReasoning(profile.reasoningTaken)?button('quiz','MIND CHECK'):''}${button('weekly','OPEN WEEKLY QUEST',true)}</div><small class="baseline-note">The mind check sets a game estimate, not a clinical IQ score. Retake after 30 days.</small></section>`;
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
  function renderWeekly(){const goals=weeklyGoals();
    entry.innerHTML=`<section class="shell-card wide-card weekly-card"><div class="panel-heading"><div><span class="eyebrow">WEEK OF ${weekKey()} · RESETS MONDAY</span><h2>WEEKLY QUEST</h2></div>${button('back','BACK')}</div><div class="weekly-columns"><div><h3>REAL-WORLD GOALS</h3>${goals.map(g=>`<div class="goal ${g.claimed?'claimed':''}"><div><strong>${g.label}</strong><span>${g.claimed?'CLAIMED':`+${g.xp} XP`}</span></div><div class="goal-track"><i style="width:${Math.min(100,g.value/g.target*100)}%"></i></div><small>${Math.round(Math.min(g.value,g.target)*10)/10} / ${g.target} ${g.unit}</small></div>`).join('')}</div><div><h3>LOG YOUR EFFORT</h3><p>Only real-world activity grants XP. Workout and step days can be logged once per day.</p><form id="logForm"><label>ACTIVITY<select name="kind"><option value="workout">Workout day</option><option value="steps">Daily steps</option><option value="run">Run or walk distance (km)</option><option value="study">Learning (minutes)</option></select></label><label>AMOUNT<input name="amount" type="number" min="1" step="any" value="1" required></label><button class="primary" type="submit">RECORD ACTIVITY</button></form><small class="feedback">${esc(notice)}</small></div></div><div class="panel-actions">${button('stats','VIEW YOUR STATS')}</div></section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>show('menu');entry.querySelector('[data-action="stats"]').onclick=()=>show('stats');
    const form=entry.querySelector('#logForm'),amount=form.elements.amount;
    form.elements.kind.onchange=()=>{amount.value={workout:1,steps:5000,run:1,study:30}[form.elements.kind.value];};
    form.onsubmit=e=>{e.preventDefault();notice=logActivity(form.elements.kind.value,Number(amount.value));renderWeekly();};
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
