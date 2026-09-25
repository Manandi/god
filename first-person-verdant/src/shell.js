import {BIOMES,METRICS,profile,saveProfile,loadProfile,stats,level,weeklyGoals,weekKey,logActivity} from './profile.js';
import {QUESTIONS,canTakeReasoning} from './reasoning.js';
import {SKIN_TONES,SHIRTS,TROUSERS,HAIR_COLORS,HAIR_STYLES,FACE_STYLES,OUTFITS} from './avatar.js';

const INTRO=[
  'Ah. Another one stirs beneath the roots.',
  'Welcome to the Hollow Roots — what is left of a world that grew too fast and forgot how to stop.',
  'I am Mycel. I have kept the Heartseed since before your grandparents had a name for the sky.',
  'Here you will not grow strong by killing things. Slay every creature in the canopy and your arms will be exactly as they were this morning.',
  'In the Hollow Roots, your strength is YOUR strength. What you lift out there, you lift in here.',
  'What you can run, you can run. How you sleep decides how clearly you think.',
  'So before you take another step down, I must take your measure.',
  'Show me what you are, and I will show you what you could become.'
];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short={strength:'STR',speed:'SPD',stamina:'STA',defense:'DEF',intelligence:'INT',discipline:'DIS'};
const EMOTIONS=['curious','welcoming','warm','stern','proud','thoughtful','serious','hopeful'];

export function createShell(entry,canvas,globe,{enterGame,pauseGame,onAppearance}){
  loadProfile();let view='menu',line=0,typing=null,selected=BIOMES[0],pointer=null,notice='',quizIndex=0,quizCorrect=0,quizStarted=0;
  const stopTyping=()=>{if(typing){clearInterval(typing);typing=null;}entry.querySelector('.mycel-portrait')?.classList.remove('mycel-speaking');};
  const button=(action,label,primary=false)=>`<button type="button" class="${primary?'primary':''}" data-action="${action}">${label}</button>`;
  function show(next){stopTyping();view=next;entry.classList.remove('hidden');entry.classList.toggle('map-view',view==='map');
    if(view==='intro')renderIntro();else if(view==='baseline')renderBaseline();else if(view==='quiz')renderQuiz();else if(view==='map')renderMap();else if(view==='weekly')renderWeekly();
    else if(view==='customize')renderCustomize();else if(view==='stats')renderStats();else if(view==='leaderboard')renderLeaderboard();else renderMenu();
  }
  function start(){show(profile.complete?'menu':profile.introSeen?'baseline':'intro');}
  function renderIntro(){
    entry.innerHTML=`<div class="story-stage"><div class="mycel-portrait mycel-${EMOTIONS[line]}"><span class="mycel-cap"></span><span class="mycel-face"><i class="mycel-brow left"></i><i class="mycel-brow right"></i><i class="mycel-eye left"></i><i class="mycel-eye right"></i><i class="mycel-mouth"></i></span><span class="mycel-roots"></span><span class="mycel-emotion">${EMOTIONS[line].toUpperCase()}</span></div><div class="story-box"><span class="eyebrow">THE HEARTSEED SPEAKS</span><h2>MYCEL</h2><p id="spoken"></p><div class="story-actions">${button('skip','SKIP INTRO')}${button('next',line===INTRO.length-1?'BEGIN →':'NEXT ▸',true)}</div><small>Tap NEXT to reveal a line, then tap again to continue.</small></div></div>`;
    const target=entry.querySelector('#spoken'),phrase=INTRO[line];let cursor=0;
    entry.querySelector('.mycel-portrait').classList.add('mycel-speaking');
    typing=setInterval(()=>{target.textContent=phrase.slice(0,++cursor);if(cursor>=phrase.length)stopTyping();},28);
    entry.querySelector('[data-action="next"]').onclick=()=>{
      if(typing){stopTyping();target.textContent=phrase;return;}
      if(++line>=INTRO.length){profile.introSeen=true;saveProfile();show('baseline');return;}
      renderIntro();
    };
    entry.querySelector('[data-action="skip"]').onclick=()=>{profile.introSeen=true;saveProfile();show('baseline');};
  }
  function renderMenu(){
    entry.innerHTML=`<section class="shell-card menu-card"><span class="eyebrow">REAL EFFORT · IN-GAME POWER</span><h1>THE HOLLOW<br>ROOTS</h1><p class="shell-subtitle">What you build outside, you carry inside.</p><div class="level-strip"><strong>LV ${level()} EXPLORER</strong><span>${profile.xp} real-world XP</span><button data-action="stats">VIEW STATS ↗</button></div><div class="menu-actions">${button('map','CONTINUE · WORLD MAP',true)}${button('customize','CUSTOMIZE')}${button('weekly','WEEKLY QUEST + LOG')}${button('leaderboard','LEADERBOARD')}</div><small class="save-caption">AUTOSAVE ON · YOUR 3D PROTOTYPE HAS ITS OWN PROFILE</small></section>`;
    for(const name of ['map','customize','weekly','leaderboard','stats'])entry.querySelector(`[data-action="${name}"]`).onclick=()=>show(name);
  }
  function renderBaseline(){
    const input=m=>`<label class="metric"><span>${m.label} <small>${m.unit}</small></span><input name="${m.key}" type="number" inputmode="decimal" min="${m.min}" max="${m.max}" step="${m.step}" value="${profile.inputs[m.key]}"></label>`;
    entry.innerHTML=`<section class="shell-card wide-card"><span class="eyebrow">MYCEL'S MEASURE · 01 / 01</span><h2>YOUR REAL-WORLD BASELINE</h2><p>These answers become your starting attributes. Change them later as your measurements change. Use your actual results; the defaults are placeholders until you do.</p><form id="baselineForm"><div class="metric-grid">${METRICS.map(input).join('')}</div><div class="baseline-note">Discipline is calculated from logged activity. Intelligence combines sleep with a reasoning score; the default score of 100 is a game placeholder, not an IQ test.</div><div class="panel-actions">${profile.complete?button('back','BACK'):''}<button class="primary" type="submit">SAVE BASELINE →</button></div></form></section>`;
    entry.querySelector('#baselineForm').onsubmit=e=>{
      e.preventDefault();for(const m of METRICS){const raw=entry.querySelector(`[name="${m.key}"]`),v=Number(raw.value);if(!raw.value||!Number.isFinite(v)||v<m.min||v>m.max){raw.focus();raw.reportValidity();return;}profile.inputs[m.key]=v;}
      profile.complete=true;saveProfile();if(!profile.reasoningTaken){quizIndex=0;quizCorrect=0;quizStarted=Date.now();show('quiz');}else show('stats');
    };
    entry.querySelector('[data-action="back"]')?.addEventListener('click',()=>show('stats'));
  }
  function statTiles(){const values=stats();return `<div class="stat-grid">${Object.entries(values).map(([key,v])=>`<div><small>${short[key]}</small><strong>${v}</strong><span>${key.toUpperCase()}</span></div>`).join('')}</div>`;}
  function renderStats(){entry.innerHTML=`<section class="shell-card wide-card"><div class="panel-heading"><div><span class="eyebrow">REAL LIFE → GAMEPLAY</span><h2>EXPLORER STATS</h2></div>${button('back','BACK')}</div>${statTiles()}<p>Strength improves punches. Speed affects movement. Stamina restores dash breath. Defense improves vitality. Intelligence extends memory interaction reach. Discipline comes from consistent real activity.</p><div class="panel-actions">${button('baseline','UPDATE MEASUREMENTS')}${canTakeReasoning(profile.reasoningTaken)?button('quiz','REASONING CHECK'):''}${button('weekly','OPEN WEEKLY QUEST',true)}</div><small class="baseline-note">The reasoning check sets a game estimate, not a clinical IQ score. Retake after 30 days.</small></section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>show('menu');entry.querySelector('[data-action="baseline"]').onclick=()=>show('baseline');entry.querySelector('[data-action="weekly"]').onclick=()=>show('weekly');
    entry.querySelector('[data-action="quiz"]')?.addEventListener('click',()=>{quizIndex=0;quizCorrect=0;quizStarted=Date.now();show('quiz');});}
  function renderQuiz(){const q=QUESTIONS[quizIndex];
    entry.innerHTML=`<section class="shell-card wide-card quiz-card"><span class="eyebrow">MYCEL'S REASONING CHECK · ${quizIndex+1} / ${QUESTIONS.length}</span><h2>${esc(q.prompt)}</h2><p>Select the best answer. This short game puzzle estimates an attribute; it is not an IQ diagnosis.</p><div class="quiz-options">${q.options.map((o,i)=>`<button data-answer="${i}">${esc(o)}</button>`).join('')}</div><div class="panel-actions">${button('skip','KEEP DEFAULT SCORE')}</div></section>`;
    entry.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{
      if(Number(b.dataset.answer)===q.answer)quizCorrect++;
      quizIndex++;if(quizIndex<QUESTIONS.length){renderQuiz();return;}
      const accuracy=quizCorrect/QUESTIONS.length,pace=Math.max(0,1-(Date.now()-quizStarted)/300000);
      profile.reasoning=Math.round(70+65*(accuracy*.85+accuracy*pace*.15));profile.reasoningTaken=new Date().toISOString().slice(0,10);
      saveProfile();show('stats');
    });
    entry.querySelector('[data-action="skip"]').onclick=()=>show('stats');
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
    entry.innerHTML=`<section class="shell-card wide-card customize-panel"><div class="panel-heading"><div><span class="eyebrow">THE EXPLORER</span><h2>MAKE IT YOURS</h2></div>${button('back','BACK')}</div><p>Changes autosave. Play in first person, then press V to see your complete explorer in the world. Your arms and outfit also appear during first-person combat.</p><div class="customize-layout"><div class="customize-fields"><h3>SKIN TONE</h3>${choices('skinIndex',SKIN_TONES.map((c,i)=>[i,c]))}<h3>FACE</h3>${choices('face',FACE_STYLES.map(n=>[n,null]))}<h3>HAIR STYLE</h3>${choices('hairStyle',HAIR_STYLES.map(n=>[n,null]))}<h3>HAIR COLOR</h3>${choices('hairColor',Object.entries(HAIR_COLORS))}<h3>OUTFIT</h3>${choices('outfit',OUTFITS.map(n=>[n,null]))}<h3>SHIRT</h3>${choices('shirt',Object.entries(SHIRTS))}<h3>TROUSERS</h3>${choices('pants',Object.entries(TROUSERS))}</div><div class="customize-preview"><div class="preview-head" style="--skin:${SKIN_TONES[a.skinIndex]};--hair:${HAIR_COLORS[a.hairColor]}"><i class="preview-hair ${a.hairStyle}"></i><i class="preview-eyes ${a.face}"></i><i class="preview-mouth"></i></div><div class="preview-body" style="background:${SHIRTS[a.shirt]}"><i class="preview-arm left" style="background:${SHIRTS[a.shirt]}"></i><i class="preview-arm right" style="background:${SHIRTS[a.shirt]}"></i></div><div class="preview-legs" style="--pants:${TROUSERS[a.pants]}"><i></i><i></i></div><small>APPEARANCE · PRESS V IN GAME TO INSPECT</small></div></div></section>`;
    entry.querySelector('[data-action="back"]').onclick=()=>show('menu');
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
