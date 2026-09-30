import {PLAN,PLAN_BONUS,planStep} from './training.js';

export const BIOMES=[
  {id:'grove',name:'VERDANT REACH',short:'VERDANT',longitude:.115,latitude:.20,level:1,color:'#a8db91',description:'Ancient roots, drowned temples, and the Shellbacks. The first realm is open.',creatures:'Shellbacks · Thornlings',guardian:'Verdant Guardian'},
  {id:'frost',name:'FROSTBOUND CROWN',short:'FROST',longitude:.37,latitude:.43,level:5,color:'#a3dafa',description:'Glacial lakes beneath crystal peaks. A realm waiting beyond the first ascent.',creatures:'Rime Hares · Icebound Sentinels',guardian:'The White Maw'},
  {id:'ember',name:'EMBER WASTES',short:'EMBER',longitude:.62,latitude:.23,level:10,color:'#ffa278',description:'Black citadels divided by living fire.',creatures:'Cinder Hounds · Ash Knights',guardian:'Pyreback Colossus'},
  {id:'wraith',name:'WRAITHMOOR',short:'WRAITH',longitude:.865,latitude:.20,level:15,color:'#d5a9fa',description:'Violet ruins where the dead still wander.',creatures:'Lantern Wraiths · Hollow Knights',guardian:'The Veiled Queen'}
];
// What Mycel measures. Body weight and height set your frame (FRAMES), not a stat.
// Bench is raw weight lifted: the strongest lift, the strongest score.
export const METRICS=[
  {key:'weightKg',label:'Body weight',unit:'kg',min:30,max:250,step:.5,value:75,body:true,imperial:{unit:'lb',factor:2.20462,step:1}},
  {key:'heightCm',label:'Height',unit:'cm',min:120,max:230,step:1,value:175,body:true,imperial:{unit:'in',factor:1/2.54,step:.5}},
  {key:'pushups',label:'Max push-ups',unit:'reps',min:0,max:300,step:1,value:15,anchors:[0,5,15,35,60],stat:'strength'},
  {key:'pullups',label:'Max pull-ups',unit:'reps',min:0,max:100,step:1,value:5,anchors:[0,1,5,12,22],stat:'strength'},
  {key:'verticalJumpCm',label:'Vertical jump',unit:'cm',min:0,max:150,step:1,value:40,anchors:[10,25,40,55,70],stat:'speed',imperial:{unit:'in',factor:1/2.54,step:.5}},
  {key:'dashSeconds',label:'40-yard dash',unit:'seconds',min:3.5,max:20,step:.1,value:5.5,anchors:[7.5,6.3,5.5,4.9,4.4],stat:'speed'},
  {key:'mileSeconds',label:'One-mile time',unit:'min:sec',min:200,max:2400,step:1,value:600,anchors:[900,720,600,480,360],stat:'stamina',clock:true},
  {key:'benchPressKg',label:'Max bench press',unit:'kg',min:0,max:300,step:2.5,value:60,anchors:[10,35,60,90,130],stat:'strength',imperial:{unit:'lb',factor:2.20462,step:5}}
];
/** Frames: every body gets something. Heavier frames are hard to move; light or tall
 *  ones are quick; balanced ones endure. Chosen from weight and height, never shown as numbers. */
export const FRAMES={
  stone:{label:'STONEFRAME',description:'A heavy frame stands like stone: hard to hurt, harder to knock down.',bonus:'+1 vitality · heavy blows stagger you instead of knocking you down · guarding costs 15% less Breath'},
  swift:{label:'SWIFTFRAME',description:'A light or tall frame moves like wind.',bonus:'+7% run speed · +15% dash distance · longer dash invulnerability'},
  balanced:{label:'TRUEFRAME',description:'A balanced frame keeps going when others fall.',bonus:'+15% Breath recovery · Second Wind: once per rest, a blow that would drop you leaves you standing'}
};
export function frame(){
  const {weightKg:w,heightCm:h}=profile.inputs,bmi=w/((h/100)**2);
  if(bmi>=27)return 'stone';
  if(bmi<20.5||(h>=183&&bmi<25))return 'swift';
  return 'balanced';
}
// Two questions about how you play (other games count): they tilt the class Mycel recommends.
export const PERSONALITY=[
  {key:'role',prompt:'When you play games with other people, which role do you usually take?',options:[
    ['fighter','Front line. I deal the damage.'],['tank','Tank. I take the hits so nobody else has to.'],['ranger','Scout or ranged. Fast, mobile, first to spot things.'],
    ['mage','Caster. Big plans, big spells.'],['support','Healer or support. I keep everyone going.']]},
  {key:'instinct',prompt:'A fight is going badly. What do you do?',options:[
    ['fighter','Hit harder and end it fast.'],['tank','Plant my feet and hold the line.'],['ranger','Reposition. Find a better angle.'],
    ['mage','Stop and think. Find the weakness.'],['support','Help whoever is hurting most.']]}
];
const STORAGE='hollow-roots-verdant-3d-profile-v1';
const defaults=()=>Object.fromEntries(METRICS.map(m=>[m.key,m.value]));
const CLASSES=['fighter','tank','ranger','mage','support'];
const dayOf=ms=>{const d=new Date(ms);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
export const localDay=()=>dayOf(Date.now());
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const daysBetween=(a,b)=>Math.round((Date.parse(`${b}T00:00:00Z`)-Date.parse(`${a}T00:00:00Z`))/86400000);
const cleanInputs=src=>Object.fromEntries(METRICS.map(m=>{const v=Number(src?.[m.key]);return [m.key,Number.isFinite(v)?Math.max(m.min,Math.min(m.max,v)):m.value];}));
export function weekKey(date=new Date()){
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-(d.getDay()+6)%7);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
// Combat classes and stat-gated weapons are the ChatGPT Sites design.
export const CLASS_INFO={
  fighter:{label:'FIGHTER',description:'Strength becomes direct damage and combo pressure.',bonus:'Damage + stronger stagger'},
  tank:{label:'TANK',description:'Defense and stamina become vitality and cheaper guards.',bonus:'Extra vitality + guard efficiency'},
  ranger:{label:'RANGER',description:'Speed and conditioning extend movement and Leaf Step.',bonus:'Longer dash + faster movement'},
  mage:{label:'MAGE',description:'Reasoning and recovery empower charged Rootbreaker strikes.',bonus:'Charge power + memory reach'},
  support:{label:'SUPPORT',description:'Discipline and conditioning accelerate breath recovery.',bonus:'Fast stamina recovery + parry reward'}
};
export const profile={complete:false,introSeen:false,customized:false,units:'metric',personality:{role:'',instinct:''},inputs:defaults(),reasoning:100,reasoningTaken:'',xp:0,activities:[],claimed:[],tests:[],program:{week:1,key:''},goal:{type:'',targetKg:0,since:''},weighIns:[],appearance:{skinIndex:2,face:'soft',hairStyle:'short',hairColor:'raven',shirt:'moss',pants:'charcoal',outfit:'ranger',weapon:'rootbound',discipline:'fighter'},lastWeek:'',name:''};
export function saveProfile(){try{localStorage.setItem(STORAGE,JSON.stringify(profile));}catch{/* Private browsing can disable storage. */}}
export function loadProfile(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE)||'{}');
    profile.complete=raw.complete===true;profile.introSeen=raw.introSeen===true;profile.customized=raw.customized===true;
    profile.units=raw.units==='imperial'?'imperial':'metric';
    profile.personality={role:CLASSES.includes(raw.personality?.role)?raw.personality.role:'',instinct:CLASSES.includes(raw.personality?.instinct)?raw.personality.instinct:''};
    profile.inputs=cleanInputs(raw.inputs);
    profile.reasoning=Number.isFinite(raw.reasoning)?Math.max(70,Math.min(135,raw.reasoning)):100;
    profile.reasoningTaken=typeof raw.reasoningTaken==='string'?raw.reasoningTaken:'';
    profile.xp=Number.isFinite(raw.xp)?Math.max(0,Math.min(1e7,raw.xp)):0;
    profile.activities=Array.isArray(raw.activities)?raw.activities.filter(a=>a&&['workout','steps','run','study'].includes(a.kind)&&DATE.test(a.date)&&Number.isFinite(a.amount)).map(a=>({kind:a.kind,date:a.date,amount:a.amount,xp:Number.isFinite(a.xp)?a.xp:0,...(typeof a.item==='string'?{item:a.item}:{})})).slice(-240):[];
    // Monthly tests: the measurements on each test day. Saves from before tests existed count as one taken a month ago, so a new test is open now.
    profile.tests=Array.isArray(raw.tests)?raw.tests.filter(t=>t&&DATE.test(t.date)&&t.inputs).map(t=>({date:t.date,inputs:cleanInputs(t.inputs)})).slice(-24):[];
    if(!profile.tests.length&&profile.complete)profile.tests=[{date:dayOf(Date.now()-30*86400000),inputs:{...profile.inputs}}];
    profile.program={week:Number.isInteger(raw.program?.week)?Math.max(1,Math.min(PLAN.length,raw.program.week)):1,key:typeof raw.program?.key==='string'?raw.program.key:''};
    const g=raw.goal||{};profile.goal={type:['lose','gain','recomp'].includes(g.type)?g.type:'',targetKg:Number.isFinite(g.targetKg)?g.targetKg:0,since:typeof g.since==='string'?g.since:''};
    profile.weighIns=Array.isArray(raw.weighIns)?raw.weighIns.filter(w=>w&&DATE.test(w.date)&&Number.isFinite(w.kg)).map(w=>({date:w.date,kg:w.kg,marks:Number.isFinite(w.marks)?w.marks:0})).slice(-104):[];
    profile.claimed=Array.isArray(raw.claimed)?raw.claimed.filter(v=>typeof v==='string').slice(-100):[];
    const appearance=raw.appearance||{};
    profile.appearance.skinIndex=Number.isInteger(appearance.skinIndex)?Math.max(0,Math.min(5,appearance.skinIndex)):2;
    profile.appearance.face=['soft','sharp','round'].includes(appearance.face)?appearance.face:'soft';
    profile.appearance.hairStyle=['short','curly','swept','tied','braid'].includes(appearance.hairStyle)?appearance.hairStyle:'short';
    profile.appearance.outfit=['ranger','warden'].includes(appearance.outfit)?appearance.outfit:'ranger';
    profile.appearance.weapon=['rootbound','groveblade','stonebreaker'].includes(appearance.weapon)?appearance.weapon:'rootbound';
    profile.appearance.discipline=Object.hasOwn(CLASS_INFO,appearance.discipline)?appearance.discipline:'fighter';
    profile.appearance.hairColor=['raven','earth','copper','silver','gold'].includes(appearance.hairColor)?appearance.hairColor:['raven','earth','silver'].includes(appearance.hair)?appearance.hair:'raven';
    profile.appearance.shirt=['moss','ochre','slate','clay','ivory','violet','navy'].includes(appearance.shirt)?appearance.shirt:({sunroot:'ochre',moonfern:'slate',guardian:'violet'}[appearance.cloak]||'moss');
    profile.appearance.pants=['charcoal','umber','olive','indigo'].includes(appearance.pants)?appearance.pants:'charcoal';
    profile.lastWeek=typeof raw.lastWeek==='string'?raw.lastWeek:'';
    profile.name=typeof raw.name==='string'?raw.name.slice(0,24):'';
  }catch{/* New profile. */}
}
const score=(m,inputs=profile.inputs)=>{
  const v=inputs[m.key],a=m.anchors,asc=a[4]>a[0],points=[1,5,10,15,20];
  if(asc?v<=a[0]:v>=a[0])return 1;
  if(asc?v>=a[4]:v<=a[4])return 20;
  for(let i=0;i<4;i++)if(asc?v>=a[i]&&v<=a[i+1]:v<=a[i]&&v>=a[i+1])return Math.round(points[i]+(v-a[i])/(a[i+1]-a[i])*(points[i+1]-points[i]));
  return 10;
};
export function level(){return 1+Math.floor(Math.sqrt(profile.xp/250));}
/** Stats straight from a set of measurements (and the mind check and training log). */
function rawStats(inputs=profile.inputs){
  const s=Object.fromEntries(METRICS.filter(m=>m.anchors).map(m=>[m.key,score(m,inputs)]));
  const iq=[70,90,100,115,135],points=[1,5,10,15,20];let reason=20;
  if(profile.reasoning<=70)reason=1;
  else for(let i=0;i<4;i++)if(profile.reasoning<=iq[i+1]){reason=Math.round(points[i]+(profile.reasoning-iq[i])/(iq[i+1]-iq[i])*(points[i+1]-points[i]));break;}
  const days=new Set(profile.activities.filter(a=>a.date>=new Date(Date.now()-27*86400000).toISOString().slice(0,10)).map(a=>a.date)).size;
  return {
    strength:Math.round(s.pushups*.4+s.pullups*.35+s.benchPressKg*.25),speed:Math.round(s.dashSeconds*.7+s.verticalJumpCm*.3),
    stamina:s.mileSeconds,defense:Math.round(s.benchPressKg*.45+s.pushups*.3+s.mileSeconds*.25),
    intelligence:reason,discipline:profile.activities.length?Math.max(1,Math.min(20,10+Math.round((days/20-.5)*16))):10
  };
}
// ------------------------------------------------------------- monthly tests
// Measurements are retaken once a month. A stat that rose since the last test
// earns a Growth bonus on top until the next one (bigger gains, bigger bonus);
// the stats themselves unlock abilities (mechanics.js).
export const TEST_DAYS=30,CORRECT_DAYS=2;
const BODY_STATS=['strength','speed','stamina','defense'];
export function testStatus(){
  const last=profile.tests.at(-1),age=last?daysBetween(last.date,localDay()):Infinity;
  return {last:last?.date||'',due:age>=TEST_DAYS,correctable:age<CORRECT_DAYS,nextIn:Math.max(0,TEST_DAYS-age),count:profile.tests.length};
}
/** Save the measurements in profile.inputs as this month's test (a fix within two days replaces it). */
export function recordTest(){
  const st=testStatus(),entry={date:localDay(),inputs:{...profile.inputs}};
  if(st.correctable&&profile.tests.length)profile.tests[profile.tests.length-1]={...entry,date:profile.tests.at(-1).date};else profile.tests.push(entry);
  profile.tests=profile.tests.slice(-24);saveProfile();
}
/** How much each body stat rose between the last two tests, and the Growth bonus it earns. */
export function growth(){
  const out={};if(profile.tests.length<2)return out;
  const now=rawStats(profile.tests.at(-1).inputs),before=rawStats(profile.tests.at(-2).inputs);
  for(const k of BODY_STATS){const gain=now[k]-before[k];if(gain>0)out[k]={gain,bonus:Math.min(4,Math.ceil(gain/2))};}
  return out;
}
// ------------------------------------------------------------- body goal
// Lose, gain, or maintain and recomposition. A weekly weigh-in that moves toward
// the goal at a healthy pace earns a mark; marks from the last 12 weeks give the
// class's own stat a bonus (two marks per point, up to +5).
export const CLASS_STAT={fighter:'strength',tank:'defense',ranger:'speed',mage:'intelligence',support:'discipline'};
export const GOALS={
  lose:{label:'LOSE WEIGHT',pace:'Rewarded for losing 0.1–1% of your weight a week.'},
  gain:{label:'GAIN WEIGHT',pace:'Rewarded for gaining 0.05–0.5% of your weight a week.'},
  recomp:{label:'MAINTAIN · RECOMP',pace:'Rewarded for holding within 1% a week while training at least twice.'}
};
export function goalBoon(){
  const since=dayOf(Date.now()-84*86400000),marks=profile.weighIns.filter(w=>w.date>=since).reduce((n,w)=>n+w.marks,0);
  return {stat:CLASS_STAT[profile.appearance.discipline]||'strength',marks,points:Math.min(5,Math.floor(marks/2))};
}
export function setGoal(type,currentKg,targetKg){
  if(!GOALS[type])return 'Choose a goal.';
  if(!(currentKg>=30&&currentKg<=250))return 'Enter your weight today.';
  if(type==='lose'&&!(targetKg<currentKg&&targetKg>=30))return 'A target below your weight today.';
  if(type==='gain'&&!(targetKg>currentKg&&targetKg<=250))return 'A target above your weight today.';
  profile.goal={type,targetKg:type==='recomp'?currentKg:targetKg,since:localDay()};
  profile.weighIns=profile.weighIns.filter(w=>w.date!==localDay());profile.weighIns.push({date:localDay(),kg:currentKg,marks:0});
  saveProfile();return `Goal set: ${GOALS[type].label}. Weigh in once a week to earn marks.`;
}
export function nextWeighIn(){const last=profile.weighIns.at(-1);return last?Math.max(0,6-daysBetween(last.date,localDay())):0;}
export function logWeighIn(kg){
  const g=profile.goal,prev=profile.weighIns.at(-1);
  if(!g.type)return 'Set a goal first.';
  if(!(kg>=30&&kg<=250))return 'Enter a real weight.';
  if(nextWeighIn()>0)return `One weigh-in a week · the next opens in ${nextWeighIn()} day${nextWeighIn()===1?'':'s'}.`;
  const days=Math.max(1,daysBetween(prev.date,localDay())),rate=(kg-prev.kg)/prev.kg*7/days;   // change per week, as a fraction
  let marks=0,note='';
  if(g.type==='lose'){if(-rate>.01)note='Faster than 1% a week. Slow down: the roots reward steady change.';else if(-rate>=.001){marks=1;note='Steady loss.';}else note='No loss this week. Keep going.';}
  else if(g.type==='gain'){if(rate>.005)note='Faster than 0.5% a week. Slow down to keep it lean.';else if(rate>=.0005){marks=1;note='Steady gain.';}else note='No gain this week. Keep eating and training.';}
  else{const trained=new Set(profile.activities.filter(a=>a.kind==='workout'&&a.date>dayOf(Date.now()-7*86400000)).map(a=>a.date)).size;
    if(Math.abs(rate)<=.01&&trained>=2){marks=1;note='Weight held while you trained.';}else note=Math.abs(rate)>.01?'Weight moved more than 1%.':'Train at least twice in the week to earn the mark.';}
  let reached=false;
  if((g.type==='lose'&&kg<=g.targetKg)||(g.type==='gain'&&kg>=g.targetKg)){reached=true;marks+=2;profile.goal={type:'recomp',targetKg:kg,since:localDay()};profile.xp+=300;}
  profile.weighIns.push({date:localDay(),kg,marks});profile.weighIns=profile.weighIns.slice(-104);profile.xp+=marks*80;saveProfile();
  return reached?`GOAL REACHED · +${marks} marks · +${marks*80+300} XP. Your goal is now to hold it.`:`${note}${marks?` +1 mark · +80 XP.`:''}`;
}
/** Stats as the game uses them: measured, plus Growth and the body goal's class bonus. */
export function stats(){
  const s=rawStats(),gr=growth(),boon=goalBoon();
  for(const [k,v] of Object.entries(gr))s[k]=Math.min(24,s[k]+v.bonus);
  if(boon.points)s[boon.stat]=Math.min(24,s[boon.stat]+boon.points);
  return s;
}
export {rawStats};
// ------------------------------------------------------------- weekly plan
// WEEKLY QUEST is this week's step of the plan (training.js). Each check logs
// the activity. Finishing half or more of a week moves the plan up a step the
// next week; otherwise the step repeats.
const addDays=(key,n)=>{const d=new Date(`${key}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
function doneIn(key,item){return profile.activities.filter(a=>a.item===item&&a.date>=key&&a.date<addDays(key,7));}
export function programWeek(){
  const now=weekKey(),p=profile.program;
  if(p.key!==now){
    if(p.key){const step=planStep(p.week),want=step.items.reduce((n,i)=>n+i.count,0),got=step.items.reduce((n,i)=>n+Math.min(i.count,doneIn(p.key,i.id).length),0);
      if(got/want>=.5)p.week=Math.min(PLAN.length,p.week+1);}
    p.key=now;saveProfile();
  }
  return p.week;
}
export function weeklyPlan(){
  const week=programWeek(),key=weekKey(),step=planStep(week),today=localDay();
  const items=step.items.map(i=>{const done=doneIn(key,i.id);return {...i,done:done.map(a=>a.date),today:done.some(a=>a.date===today)};});
  const total=items.reduce((n,i)=>n+i.count,0),checked=items.reduce((n,i)=>n+Math.min(i.count,i.done.length),0);
  return {week,tier:step.tier,items,total,checked,bonus:PLAN_BONUS,claimed:profile.claimed.includes(`${key}:plan`)};
}
/** Check off one day of a plan item: logs its activity. */
export function checkPlanItem(id){
  const item=weeklyPlan().items.find(i=>i.id===id);
  if(!item)return 'Not in this week’s plan.';
  if(item.done.length>=item.count)return 'Already complete this week.';
  if(item.today)return 'One check per day for each task.';
  return logActivity(item.kind,item.amount,item.id);
}
/** Undo today's check (a mis-click). */
export function uncheckPlanItem(id){
  const today=localDay(),i=profile.activities.findLastIndex(a=>a.item===id&&a.date===today);
  if(i<0)return 'Only today’s check can be undone.';
  profile.xp=Math.max(0,profile.xp-(profile.activities[i].xp||0));profile.activities.splice(i,1);
  const claim=profile.claimed.indexOf(`${weekKey()}:plan`);
  if(claim>=0){profile.claimed.splice(claim,1);profile.xp=Math.max(0,profile.xp-PLAN_BONUS);}
  saveProfile();return 'Check removed.';
}
export function logActivity(kind,amount,item=''){
  const date=localDay();
  if(!['workout','steps','run','study'].includes(kind)||!Number.isFinite(amount)||amount<=0)return 'Enter a valid activity amount.';
  if(kind==='steps'&&amount<5000)return 'Reach at least 5,000 steps to log a step day.';
  const daily=['workout','steps'].includes(kind);
  if(daily&&profile.activities.some(a=>a.date===date&&a.kind===kind))return kind==='workout'?'A workout is already logged today.':'Steps are already logged today.';
  const capped=Math.min(amount,kind==='steps'?100000:kind==='run'?100:kind==='study'?600:1);
  const xp=kind==='workout'?75:kind==='steps'?50:kind==='run'?Math.round(capped*12):Math.round(capped*.5);
  profile.activities.push({kind,date,amount:capped,xp,...(item?{item}:{})});profile.activities=profile.activities.slice(-240);profile.xp+=xp;
  const plan=weeklyPlan();let done=false;
  if(!plan.claimed&&plan.checked>=plan.total){profile.claimed.push(`${weekKey()}:plan`);profile.claimed=profile.claimed.slice(-100);profile.xp+=PLAN_BONUS;done=true;}
  saveProfile();return `+${xp} XP${done?` · WEEK COMPLETE +${PLAN_BONUS} XP`:''}`;
}
export function classScores(){
  const s=stats(),{role,instinct}=profile.personality,scores={
    fighter:s.strength*.55+s.speed*.2+s.discipline*.25,
    tank:s.defense*.48+s.stamina*.27+s.strength*.25,
    ranger:s.speed*.5+s.stamina*.3+s.discipline*.2,
    mage:s.intelligence*.58+s.discipline*.27+s.stamina*.15,
    support:s.discipline*.42+s.intelligence*.32+s.stamina*.26
  };
  // How you like to play counts as much as a strong attribute.
  for(const k of Object.keys(scores))scores[k]+=(role===k?5:0)+(instinct===k?3:0);
  return scores;
}
export function recommendedClass(){return Object.entries(classScores()).sort((a,b)=>b[1]-a[1])[0][0];}
/** Why Mycel recommends it, in words. */
export function classReason(){
  const s=stats(),top=Object.entries(s).filter(([k])=>k!=='discipline').sort((a,b)=>b[1]-a[1])[0],rec=recommendedClass(),{role,instinct}=profile.personality;
  const plays=role===rec&&instinct===rec?'You told me this is how you play, and your instincts agree.':role===rec?'It is the role you told me you play.':instinct===rec?'It is how you react when a fight turns.':'Your numbers point here more than your answers do.';
  return `Your strongest attribute is ${top[0].toUpperCase()} (${top[1]}). ${plays}`;
}
export function weaponEligibility(weapon){
  const s=stats(),rules={
    rootbound:{ok:s.intelligence>=8||s.discipline>=8,requirement:'INT 8 or DIS 8'},
    groveblade:{ok:s.strength>=8&&s.speed>=8,requirement:'STR 8 and SPD 8'},
    stonebreaker:{ok:s.strength>=12&&s.defense>=12,requirement:'STR 12 and DEF 12'}
  };
  return rules[weapon]||{ok:false,requirement:'Unknown discipline'};
}
