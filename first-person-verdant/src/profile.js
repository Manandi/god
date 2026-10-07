import {PLAN,PLAN_BONUS,planStep,e1rm,TITLES} from './training.js';

export const BIOMES=[
  {id:'grove',name:'VERDANT REACH',short:'VERDANT',longitude:.115,latitude:.20,level:1,color:'#a8db91',description:'Ancient roots, drowned temples, and the Shellbacks. The first realm is open.',creatures:'Shellbacks · Thornlings',guardian:'Verdant Guardian'},
  {id:'shadow',name:'SHADOWMERE',short:'SHADOW',longitude:.225,latitude:.62,level:3,color:'#7fd08f',description:'A moonlit forest in the green west where the lanterns are going out. Green monkeys hunt from the roots; a sword-bearing gorilla keeps its heart.',creatures:'Green Monkeys',guardian:'The Rootbound Gorilla'},
  {id:'frost',name:'FROSTBOUND CROWN',short:'FROST',longitude:.37,latitude:.43,level:5,color:'#a3dafa',description:'Glacial lakes beneath crystal peaks, where the Crown of Ashmere fled. The next realm: it opens at level 5.',creatures:'Rime Hares · Icebound Sentinels',guardian:'The White Maw'},
  {id:'ember',name:'EMBER WASTES',short:'EMBER',longitude:.62,latitude:.23,level:11,color:'#ffa278',description:'Black citadels divided by living fire.',creatures:'Cinder Hounds · Ash Knights',guardian:'Pyreback Colossus'},
  {id:'wraith',name:'WRAITHMOOR',short:'WRAITH',longitude:.865,latitude:.20,level:17,color:'#d5a9fa',description:'Violet ruins where the dead still wander.',creatures:'Lantern Wraiths · Hollow Knights',guardian:'The Veiled Queen'}
];
// What Mycel measures. Body weight and height set your frame (FRAMES), not a stat.
// Each test is scored against all adults (both sexes, roughly 18–65): `norms` are
// [result, percentile of adults at or below it] points, and SCORE_SCALE turns the
// percentile into a 1–20 score, so 20 means the top 0.1% and 18 the top 1%.
// Sources and reasoning for each table: first-person-verdant/README.md ("Stat norms").
export const METRICS=[
  {key:'weightKg',label:'Body weight',unit:'kg',min:30,max:250,step:.5,value:75,body:true,imperial:{unit:'lb',factor:2.20462,step:1}},
  {key:'heightCm',label:'Height',unit:'cm',min:120,max:230,step:1,value:175,body:true,imperial:{unit:'in',factor:1/2.54,step:.5}},
  // About 1 in 5 adults cannot do one; 36% do fewer than 5 and 54% fewer than 10 (US survey of 2,000 adults).
  {key:'pushups',label:'Max push-ups',unit:'reps',min:0,max:300,step:1,value:10,stat:'strength',feeds:['strength','defense'],
    norms:[[0,10],[1,20],[5,36],[10,54],[15,65],[20,74],[30,86],[40,93],[50,97],[60,99],[80,99.7],[100,99.9]]},
  // Only about 17% of men and 5% of women can do one strict pull-up.
  {key:'pullups',label:'Max pull-ups',unit:'reps',min:0,max:100,step:1,value:0,stat:'strength',feeds:['strength'],
    norms:[[0,44],[1,89],[2,91.5],[5,95],[10,98],[15,99],[20,99.6],[25,99.9]]},
  // Men average about 45 cm and women about 30 cm; elite jumpers reach 75+.
  {key:'verticalJumpCm',label:'Vertical jump',unit:'cm',min:0,max:150,step:1,value:37,stat:'speed',feeds:['speed'],imperial:{unit:'in',factor:1/2.54,step:.5},
    norms:[[15,1],[20,5],[26,15],[31,30],[37,50],[43,70],[49,85],[56,95],[64,99],[75,99.9]]},
  // Untrained adults run about 6–7 s; NFL combine players average about 4.7 s.
  {key:'dashSeconds',label:'40-yard dash',unit:'seconds',min:3.5,max:20,step:.1,value:6.4,stat:'speed',feeds:['speed'],
    norms:[[11,1],[9,5],[7.8,15],[7,30],[6.4,50],[5.9,70],[5.5,85],[5.1,95],[4.75,99],[4.45,99.9]]},
  // Adults average about 9–10 min (men) and 11–12 min (women); under 6 min is rare.
  {key:'mileSeconds',label:'One-mile time',unit:'min:sec',min:200,max:2400,step:1,value:690,stat:'stamina',feeds:['stamina','defense'],clock:true,
    norms:[[1500,1],[1320,2],[1080,8],[900,20],[780,35],[690,50],[600,68],[540,80],[480,90],[420,96],[360,99],[300,99.9]]},
  // Most adults never train the bench; fewer than 1% of the US population can bench 102 kg (225 lb).
  {key:'benchPressKg',label:'Max bench press',unit:'kg',min:0,max:300,step:2.5,value:35,stat:'strength',feeds:['strength','defense'],imperial:{unit:'lb',factor:2.20462,step:5},
    norms:[[5,1],[12,5],[20,15],[27,30],[35,50],[45,70],[57,85],[75,95],[102,99],[140,99.9]]},
  // Optional tests (added 2026-10-02): leave them blank and the stat is worked out
  // exactly as before.
  // Core endurance, the closest home test of being hard to break. Adults hold a
  // plank for about a minute; past five minutes is rare.
  {key:'plankSeconds',label:'Plank hold',unit:'seconds',min:0,max:3600,step:1,value:null,optional:true,stat:'defense',feeds:['defense'],
    norms:[[5,1],[10,5],[20,15],[35,30],[60,50],[90,70],[120,85],[180,95],[300,99],[480,99.9]]},
  // Resting heart rate on waking (a phone or watch reads it). Adults average about
  // 72 bpm; trained endurance athletes sit in the 40s.
  {key:'restingHeartRate',label:'Resting heart rate',unit:'bpm',min:30,max:130,step:1,value:null,optional:true,stat:'stamina',feeds:['stamina'],
    norms:[[100,1],[92,5],[84,15],[78,30],[72,50],[67,70],[62,85],[55,95],[48,99],[40,99.9]]}
];
/** Which tests feed each stat (for the stats screen). */
export const STAT_SOURCES=Object.fromEntries(['strength','speed','stamina','defense'].map(k=>[k,METRICS.filter(m=>m.feeds?.includes(k)).map(m=>{const l=m.label.replace(/^Max /,'');return l[0].toUpperCase()+l.slice(1);})]));
/** Percentile of adults → score: 50th = 10, 99th = 18, 99.9th = 20 (and the same steps below the middle). */
export const SCORE_SCALE=[[.5,1],[1,2],[5,4],[15,6],[30,8],[50,10],[70,12],[85,14],[95,16],[99,18],[99.9,20]];
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
const cleanInputs=src=>Object.fromEntries(METRICS.map(m=>{const r=src?.[m.key];if(m.optional&&(r===null||r===undefined||r===''))return [m.key,null];const v=Number(r);return [m.key,Number.isFinite(v)?Math.max(m.min,Math.min(m.max,v)):m.value];}));
export function weekKey(date=new Date()){
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-(d.getDay()+6)%7);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
// Challenge weeks run Thursday to Wednesday (owner, 2026-10-07): week 1 is launch day, Thursday
// 2026-10-01, to Wednesday 2026-10-07, and each new week starts on boss day. The weekly quest, its
// step up and its bonus follow these weeks; the weekly world and cloud saves keep weekKey above.
export const CHALLENGE_START='2026-10-01';
export function planWeekKey(date=new Date()){
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-(d.getDay()+3)%7);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
/** Which week of the 90-day challenge it is (1 from launch day). */
export const challengeWeek=(date=new Date())=>Math.max(1,Math.floor(daysBetween(CHALLENGE_START,planWeekKey(date))/7)+1);
/** A Monday-week key from before 2026-10-07 as the Thursday week it falls in (never before launch). */
const thursdayOf=key=>{const k=planWeekKey(new Date(`${key}T12:00:00`));return k<CHALLENGE_START?CHALLENGE_START:k;};
const isThursday=key=>new Date(`${key}T12:00:00Z`).getUTCDay()===4;
// Combat classes and stat-gated weapons are the ChatGPT Sites design.
export const CLASS_INFO={
  fighter:{label:'FIGHTER',description:'Strength becomes direct damage and combo pressure.',bonus:'Damage + stronger stagger'},
  tank:{label:'TANK',description:'Defense and stamina become vitality and cheaper guards.',bonus:'Extra vitality + guard efficiency'},
  ranger:{label:'RANGER',description:'Speed and conditioning extend movement and Leaf Step.',bonus:'Longer dash + faster movement'},
  mage:{label:'MAGE',description:'Reasoning and recovery empower charged Rootbreaker strikes.',bonus:'Charge power + memory reach'},
  support:{label:'SUPPORT',description:'Discipline and conditioning accelerate breath recovery.',bonus:'Fast stamina recovery + parry reward'}
};
export const profile={complete:false,introSeen:false,customized:false,units:'imperial',unitsChosen:false,personality:{role:'',instinct:''},inputs:defaults(),reasoning:100,reasoningTaken:'',reasoningVersion:0,reasoningSeen:[],lifts:[],title:'',xp:0,activities:[],claimed:[],tests:[],program:{week:1,key:''},goal:{type:'',targetKg:0,since:''},weighIns:[],appearance:{skinIndex:2,face:'soft',hairStyle:'short',hairColor:'raven',shirt:'moss',pants:'charcoal',outfit:'ranger',weapon:'rootbound',discipline:'fighter'},lastWeek:'',name:'',wardenFelled:false};
export function saveProfile(){try{localStorage.setItem(STORAGE,JSON.stringify(profile));window.dispatchEvent(new Event('hollow-roots-profile-saved'));}catch{/* Private browsing can disable storage. */}}
export function loadProfile(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE)||'{}');
    profile.complete=raw.complete===true;profile.introSeen=raw.introSeen===true;profile.customized=raw.customized===true;profile.wardenFelled=raw.wardenFelled===true;
    // US units by default; a choice made with the METRIC/IMPERIAL toggle is remembered.
    profile.unitsChosen=raw.unitsChosen===true;profile.units=profile.unitsChosen&&raw.units==='metric'?'metric':'imperial';
    profile.personality={role:CLASSES.includes(raw.personality?.role)?raw.personality.role:'',instinct:CLASSES.includes(raw.personality?.instinct)?raw.personality.instinct:''};
    profile.inputs=cleanInputs(raw.inputs);
    profile.reasoning=Number.isFinite(raw.reasoning)?Math.max(55,Math.min(160,raw.reasoning)):100;
    profile.reasoningTaken=typeof raw.reasoningTaken==='string'?raw.reasoningTaken:'';
    profile.reasoningVersion=Number.isInteger(raw.reasoningVersion)?raw.reasoningVersion:0;
    profile.reasoningSeen=Array.isArray(raw.reasoningSeen)?raw.reasoningSeen.filter(v=>typeof v==='string').slice(0,20):[];
    // Results from the old 8-question check (far too easy) are capped at 110 and
    // the new adaptive check opens at once.
    if(profile.reasoningVersion<2&&profile.reasoningTaken){profile.reasoning=Math.min(profile.reasoning,110);profile.reasoningTaken='';}
    profile.xp=Number.isFinite(raw.xp)?Math.max(0,Math.min(1e7,raw.xp)):0;
    profile.activities=Array.isArray(raw.activities)?raw.activities.filter(a=>a&&['workout','steps','run','study'].includes(a.kind)&&DATE.test(a.date)&&Number.isFinite(a.amount)).map(a=>({kind:a.kind,date:a.date,amount:a.amount,xp:Number.isFinite(a.xp)?a.xp:0,...(typeof a.item==='string'?{item:a.item}:{})})).slice(-240):[];
    // Monthly tests: the measurements on each test day. Saves from before tests existed count as one taken a month ago, so a new test is open now.
    profile.tests=Array.isArray(raw.tests)?raw.tests.filter(t=>t&&DATE.test(t.date)&&t.inputs).map(t=>({date:t.date,inputs:cleanInputs(t.inputs)})).slice(-24):[];
    if(!profile.tests.length&&profile.complete)profile.tests=[{date:dayOf(Date.now()-30*86400000),inputs:{...profile.inputs}}];
    profile.program={week:Number.isInteger(raw.program?.week)?Math.max(1,Math.min(PLAN.length,raw.program.week)):1,key:typeof raw.program?.key==='string'?raw.program.key:''};
    const g=raw.goal||{};profile.goal={type:['lose','gain','recomp'].includes(g.type)?g.type:'',targetKg:Number.isFinite(g.targetKg)?g.targetKg:0,since:typeof g.since==='string'?g.since:''};
    profile.weighIns=Array.isArray(raw.weighIns)?raw.weighIns.filter(w=>w&&DATE.test(w.date)&&Number.isFinite(w.kg)).map(w=>({date:w.date,kg:w.kg,marks:Number.isFinite(w.marks)?w.marks:0})).slice(-104):[];
    profile.claimed=Array.isArray(raw.claimed)?raw.claimed.filter(v=>typeof v==='string').slice(-100):[];
    // Plan weeks used to start on Monday, which moved everyone to week 2 on Monday 2026-10-05 and
    // hid week 1's checks. Old keys move to their Thursday week, and a step up taken on a Monday
    // after launch is undone (it comes back on Thursday if half or more of week 1 was done).
    if(DATE.test(profile.program.key)&&!isThursday(profile.program.key)){
      if(profile.program.key>CHALLENGE_START&&profile.program.week>1)profile.program.week--;
      profile.program.key=thursdayOf(profile.program.key);
    }
    profile.claimed=profile.claimed.map(v=>{const m=/^(\d{4}-\d{2}-\d{2}):plan$/.exec(v);return m&&!isThursday(m[1])?`${thursdayOf(m[1])}:plan`:v;}).filter((v,i,a)=>a.indexOf(v)===i);
    const appearance=raw.appearance||{};
    profile.appearance.skinIndex=Number.isInteger(appearance.skinIndex)?Math.max(0,Math.min(5,appearance.skinIndex)):2;
    profile.appearance.face=['soft','sharp','round'].includes(appearance.face)?appearance.face:'soft';
    profile.appearance.hairStyle=['short','curly','swept','tied','braid'].includes(appearance.hairStyle)?appearance.hairStyle:'short';
    profile.appearance.outfit=['ranger','warden','wanderer','sentinel'].includes(appearance.outfit)?appearance.outfit:'ranger';
    profile.appearance.weapon=['rootbound','groveblade','stonebreaker','sporewand','windstring','bloomstaff'].includes(appearance.weapon)?appearance.weapon:'rootbound';
    profile.appearance.discipline=Object.hasOwn(CLASS_INFO,appearance.discipline)?appearance.discipline:'fighter';
    profile.appearance.secondary=Object.hasOwn(CLASS_INFO,appearance.secondary)&&appearance.secondary!==profile.appearance.discipline?appearance.secondary:'';
    profile.appearance.hairColor=['raven','earth','copper','silver','gold'].includes(appearance.hairColor)?appearance.hairColor:['raven','earth','silver'].includes(appearance.hair)?appearance.hair:'raven';
    profile.appearance.shirt=['moss','ochre','slate','clay','ivory','violet','navy'].includes(appearance.shirt)?appearance.shirt:({sunroot:'ochre',moonfern:'slate',guardian:'violet'}[appearance.cloak]||'moss');
    profile.appearance.pants=['charcoal','umber','olive','indigo'].includes(appearance.pants)?appearance.pants:'charcoal';
    profile.lastWeek=typeof raw.lastWeek==='string'?raw.lastWeek:'';
    profile.name=typeof raw.name==='string'?raw.name.slice(0,24):'';
    profile.lifts=Array.isArray(raw.lifts)?raw.lifts.filter(l=>l&&typeof l.ex==='string'&&DATE.test(l.date)&&Number.isFinite(l.kg)&&Number.isFinite(l.reps)).map(l=>({date:l.date,ex:l.ex.slice(0,40),kg:Math.max(0,Math.min(500,l.kg)),reps:Math.max(1,Math.min(100,Math.round(l.reps))),sets:Math.max(1,Math.min(20,Math.round(l.sets)||1)),pr:l.pr===true})).slice(-600):[];
    profile.title=TITLES.some(t=>t.id===raw.title)?raw.title:'';
  }catch{/* New profile. */}
}
/** Share of a normal population below z, in percent (Abramowitz–Stegun erf, error < 1.5e-7). */
const normalPercentile=z=>{const x=Math.abs(z)/Math.SQRT2,t=1/(1+.3275911*x),y=1-((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);return 50*(1+Math.sign(z)*y);};
const lerp=(pts,x)=>{   // piecewise linear through [x, y] points (x ascending), flat past the ends
  if(x<=pts[0][0])return pts[0][1];
  for(let i=1;i<pts.length;i++)if(x<=pts[i][0]){const [x0,y0]=pts[i-1],[x1,y1]=pts[i];return y0+(x-x0)/(x1-x0)*(y1-y0);}
  return pts.at(-1)[1];
};
/** The share of adults (0–100) who do no better than this result. */
export function percentile(m,v){const pts=[...m.norms].sort((a,b)=>a[0]-b[0]);return lerp(pts,v);}
const score=(m,inputs=profile.inputs)=>inputs[m.key]==null?null:Math.max(1,Math.min(20,Math.round(lerp(SCORE_SCALE,percentile(m,inputs[m.key])))));
/** Weighted average of the tests that were taken (optional tests left blank drop out). */
const blend=(s,weights)=>{let sum=0,w=0;for(const [k,f] of Object.entries(weights))if(s[k]!=null){sum+=s[k]*f;w+=f;}return Math.round(sum/w);};
/** Distances and speeds in the player's units (US by default). */
export const units={
  get us(){return profile.units==='imperial';},
  dist(m){if(!this.us)return `${Math.round(m)} m`;const ft=m*3.28084;return ft<1000?`${Math.round(ft)} ft`:`${(m/1609.34).toFixed(1)} mi`;},
  short(m){return this.us?`${Math.round(m*39.37)} in`:`${m.toFixed(2)} m`;},
  cm(cm){return this.us?`${Math.round(cm/2.54)} in`:`${Math.round(cm)} cm`;},
  speed(ms){return this.us?`${(ms*2.23694).toFixed(1)} mph`:`${ms.toFixed(1)} m/s`;}
};
// Level from XP. Paced so a full first week of the plan (about 570 XP) reaches
// level 3 and two weeks (about 1,200) reach level 5; later levels come slower.
// The XP needed for level n is 227·(n−1)^1.14 (500 for level 3, 1,100 for level 5).
export const xpForLevel=n=>n<=1?0:Math.round(227*Math.pow(n-1,1.14));
/** Dev panel only: play at another level without touching real XP (never sent to the board). */
export const devLevel={value:null};
export function realLevel(xp=profile.xp){let n=1;while(n<999&&xp>=xpForLevel(n+1))n++;return n;}
export function level(xp=profile.xp){return devLevel.value!==null&&xp===profile.xp?devLevel.value:realLevel(xp);}
/** Stats straight from a set of measurements (and the mind check and training log). */
function rawStats(inputs=profile.inputs){
  const s=Object.fromEntries(METRICS.filter(m=>m.norms).map(m=>[m.key,score(m,inputs)]));
  // Intelligence uses the same population scale as the body tests: the mind
  // check's IQ-scale score is turned into a percentile of adults (normal, mean
  // 100, SD 15), so 100 → 10, ~125 → 16, ~135 → 18, ~146 → 20.
  const reason=Math.max(1,Math.min(20,Math.round(lerp(SCORE_SCALE,normalPercentile((profile.reasoning-100)/15)))));
  const days=new Set(profile.activities.filter(a=>a.date>=new Date(Date.now()-27*86400000).toISOString().slice(0,10)).map(a=>a.date)).size;
  return {
    // Weights keep the original split when the optional tests are blank.
    // Strength is bodyweight first (push-ups and pull-ups, 75%), with the bench for the rest.
    strength:Math.round(s.pushups*.4+s.pullups*.35+s.benchPressKg*.25),
    speed:Math.round(s.dashSeconds*.7+s.verticalJumpCm*.3),
    stamina:s.restingHeartRate==null?s.mileSeconds:blend(s,{mileSeconds:.7,restingHeartRate:.3}),
    // Defense is holding the line: the bench is the shield arm, push-ups and the mile keep it up.
    defense:s.plankSeconds==null?Math.round(s.benchPressKg*.45+s.pushups*.3+s.mileSeconds*.25):blend(s,{plankSeconds:.4,benchPressKg:.27,pushups:.18,mileSeconds:.15}),
    intelligence:reason,discipline:Math.min(20,10+Math.round(days*10/24))   // starts at 10; 24 active days in 4 weeks reaches 20
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
  profile.tests=profile.tests.slice(-24);saveProfile();announce('test','finished their monthly tests');
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
/** Stats as claimed: measured, plus Growth and the body goal's class bonus (what the leaderboard shows). */
export function claimedStats(){
  const s=rawStats(),gr=growth(),boon=goalBoon();
  for(const [k,v] of Object.entries(gr))s[k]=Math.min(24,s[k]+v.bonus);
  if(boon.points)s[boon.stat]=Math.min(24,s[boon.stat]+boon.points);
  return s;
}
// Caps (leaderboard.js): a friend who thinks one of your stats is fake can cap
// it. While any cap stands, that stat counts as at most 10 (the adult average)
// in play, until whoever capped it lifts the cap after seeing proof.
// stat -> [names of who capped it]; cached so it also holds offline.
const CAPS='hollow-roots-caps-v1';
export const caps=new Map((()=>{try{return JSON.parse(localStorage.getItem(CAPS)||'[]');}catch{return [];}})());
export function setCaps(list){caps.clear();for(const [stat,who] of list)caps.set(stat,who);try{localStorage.setItem(CAPS,JSON.stringify([...caps]));}catch{}}
/** Stats as the game uses them: claimed stats, with capped ones held at 10. */
export function stats(){
  const s=claimedStats();
  for(const k of caps.keys())if(k in s)s[k]=Math.min(s[k],10);
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
  const now=planWeekKey(),p=profile.program;
  if(p.key!==now){
    if(p.key){const step=planStep(p.week),want=step.items.reduce((n,i)=>n+i.count,0),got=step.items.reduce((n,i)=>n+Math.min(i.count,doneIn(p.key,i.id).length),0);
      if(got/want>=.5)p.week=Math.min(PLAN.length,p.week+1);}
    p.key=now;saveProfile();
  }
  return p.week;
}
export function weeklyPlan(){
  const week=programWeek(),key=planWeekKey(),step=planStep(week),today=localDay();
  const items=step.items.map(i=>{const done=doneIn(key,i.id);return {...i,done:done.map(a=>a.date),today:done.some(a=>a.date===today)};});
  const total=items.reduce((n,i)=>n+i.count,0),checked=items.reduce((n,i)=>n+Math.min(i.count,i.done.length),0);
  return {week,challengeWeek:challengeWeek(),tier:step.tier,items,total,checked,bonus:PLAN_BONUS,claimed:profile.claimed.includes(`${key}:plan`)};
}
/** Check off one day of a plan item: logs its activity. */
export function checkPlanItem(id){
  const item=weeklyPlan().items.find(i=>i.id===id);
  if(!item)return 'Not in this week’s plan.';
  if(item.done.length>=item.count)return 'Already complete this week.';
  if(item.today)return 'One check per day for each task.';
  return logActivity(item.kind,profile.units==='imperial'&&item.amountUS?item.amountUS:item.amount,item.id);
}
/** Undo today's check (a mis-click). */
export function uncheckPlanItem(id){
  const today=localDay(),i=profile.activities.findLastIndex(a=>a.item===id&&a.date===today);
  if(i<0)return 'Only today’s check can be undone.';
  profile.xp=Math.max(0,profile.xp-(profile.activities[i].xp||0));profile.activities.splice(i,1);
  const claim=profile.claimed.indexOf(`${planWeekKey()}:plan`);
  if(claim>=0){profile.claimed.splice(claim,1);profile.xp=Math.max(0,profile.xp-PLAN_BONUS);}
  saveProfile();return 'Check removed.';
}
/** Tell the Social feed what was logged (social.js posts it; only these short lines, never measurements). */
export function announce(kind,text){try{window.dispatchEvent(new CustomEvent('hollow-roots-activity',{detail:{kind,text}}));}catch{/* no window in tests */}}
export function logActivity(kind,amount,item=''){
  const date=localDay(),levelBefore=realLevel(),planItem=item?weeklyPlan().items.find(i=>i.id===item):null;
  if(!['workout','steps','run','study'].includes(kind)||!Number.isFinite(amount)||amount<=0)return 'Enter a valid activity amount.';
  if(kind==='steps'&&amount<5000)return 'Reach at least 5,000 steps to log a step day.';
  const daily=['workout','steps'].includes(kind);
  if(daily&&profile.activities.some(a=>a.date===date&&a.kind===kind))return kind==='workout'?'A workout is already logged today.':'Steps are already logged today.';
  const capped=Math.min(amount,kind==='steps'?100000:kind==='run'?100:kind==='study'?600:1);
  const xp=kind==='workout'?75:kind==='steps'?50:kind==='run'?Math.round(capped*12):Math.round(capped*.5);
  profile.activities.push({kind,date,amount:capped,xp,...(item?{item}:{})});profile.activities=profile.activities.slice(-240);profile.xp+=xp;
  const plan=weeklyPlan();let done=false;
  if(!plan.claimed&&plan.checked>=plan.total){profile.claimed.push(`${planWeekKey()}:plan`);profile.claimed=profile.claimed.slice(-100);profile.xp+=PLAN_BONUS;done=true;}
  saveProfile();
  announce(kind,kind==='workout'?`finished ${planItem?.workout?`home workout ${planItem.workout}`:'a workout'}`:kind==='steps'?`walked ${capped.toLocaleString('en-US')} steps`
    :kind==='run'?`walked or ran ${profile.units==='imperial'?`${(capped/1.609).toFixed(1)} mi`:`${capped.toFixed(1)} km`}`:`spent ${Math.round(capped)} minutes learning something new`);
  if(done)announce('plan','completed this week’s quest');
  if(realLevel()>levelBefore)announce('level',`reached level ${realLevel()}`);
  return `+${xp} XP${done?` · WEEK COMPLETE +${PLAN_BONUS} XP`:''}`;
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
// Class unlocks: the five classes are open to everyone. Hybrids are earned: both
// of their stats must reach 12 (the first ability tier), and they are much
// stronger (the full bonus of both classes plus Hybrid Mastery, mechanics.js).
// A hybrid whose stat drops below 12 (a new test, or a 🧢 cap) falls back to its
// first class until the stat is back, like an ability that slips.
export const HYBRID_REQ=12;
const STAT_SHORT={strength:'STR',defense:'DEF',speed:'SPD',intelligence:'INT',discipline:'DIS'};
/** Whether a class (or a hybrid pair) is open, and what it needs. */
export function classUnlock(primary,secondary=''){
  const s=stats();
  if(secondary&&secondary!==primary){
    const need=[primary,secondary].map(k=>CLASS_STAT[k]).filter(k=>s[k]<HYBRID_REQ);
    return {ok:!need.length,requirement:`${STAT_SHORT[CLASS_STAT[primary]]} ${HYBRID_REQ} + ${STAT_SHORT[CLASS_STAT[secondary]]} ${HYBRID_REQ}`,missing:need};
  }
  return {ok:true,requirement:'',missing:[]};
}
// Hybrid paths: two classes at once, unlocked by stats. A hybrid gets the full
// bonus of both classes plus Hybrid Mastery (mechanics.js).
export const HYBRID_SHARE=1,HYBRID_MASTERY={damage:.1,regen:.1};
export const HYBRIDS={
  'fighter+ranger':{label:'SKIRMISHER',description:'Hit hard and keep moving: damage with a quicker step.'},
  'fighter+tank':{label:'VANGUARD',description:'Lead the charge and take the answer: damage backed by a sturdier body.'},
  'fighter+mage':{label:'SPELLBLADE',description:'Steel and charged Rootbreaker strikes together.'},
  'fighter+support':{label:'WARCALLER',description:'Strike, and keep your Breath coming back for the next push.'},
  'ranger+tank':{label:'PATHGUARD',description:'Quick on your feet and hard to drop.'},
  'mage+tank':{label:'RUNEGUARD',description:'A shield that thinks: vitality and cheap guards with charged power.'},
  'support+tank':{label:'PROTECTOR',description:'Hold the line and outlast it: guards, hearts and fast Breath.'},
  'mage+ranger':{label:'WINDCALLER',description:'Mobile and clever: a long dash and charged strikes.'},
  'ranger+support':{label:'PATHFINDER',description:'Endless legs: speed with the fastest Breath recovery.'},
  'mage+support':{label:'SAGE',description:'Charged power, better parries and steady Breath.'}
};
const pairKey=(a,b)=>[a,b].sort().join('+');
/** The class (or hybrid) to show for a primary and optional second class. */
export function pathInfo(primary=profile.appearance.discipline,secondary=profile.appearance.secondary){
  const base=CLASS_INFO[primary]||CLASS_INFO.fighter;
  if(!secondary||secondary===primary||!CLASS_INFO[secondary])return {label:base.label,description:base.description,bonus:base.bonus,hybrid:false};
  const h=HYBRIDS[pairKey(primary,secondary)];
  return {label:h.label,description:h.description,bonus:`${base.label} + ${CLASS_INFO[secondary].label} · full bonus of both + Hybrid Mastery (+10% damage, +10% Breath recovery)`,hybrid:true};
}
/** How much of each class's bonus applies (1 for a pure class). */
export function classWeights(primary=profile.appearance.discipline||'fighter',secondary=profile.appearance.secondary){
  const w=Object.fromEntries(Object.keys(CLASS_INFO).map(k=>[k,0]));
  if(secondary&&secondary!==primary&&w[secondary]!==undefined){
    if(classUnlock(primary,secondary).ok){w[primary]=HYBRID_SHARE;w[secondary]=HYBRID_SHARE;return w;}
  }
  w[primary]=1;   // a pure class, or a hybrid that is locked right now
  return w;
}
/** Mycel's pick: your best class, blended with your next-best one that you have unlocked a hybrid with. */
export function recommendedPath(){
  const [a,...rest]=Object.entries(classScores()).sort((x,y)=>y[1]-x[1]),b=rest.find(([k])=>classUnlock(a[0],k).ok);
  return {primary:a[0],secondary:b?b[0]:''};
}
/** True when the class you hold is below its requirement right now. */
export function pathLocked(){return !classUnlock(profile.appearance.discipline,profile.appearance.secondary).ok;}
/** Why Mycel recommends it, in words. */
export function classReason(){
  const s=stats(),top=Object.entries(s).filter(([k])=>k!=='discipline').sort((a,b)=>b[1]-a[1])[0],rec=recommendedClass(),{role,instinct}=profile.personality;
  const plays=role===rec&&instinct===rec?'You told me this is how you play, and your instincts agree.':role===rec?'It is the role you told me you play.':instinct===rec?'It is how you react when a fight turns.':'Your numbers point here more than your answers do.';
  const path=recommendedPath(),blend=path.secondary?` You have unlocked the ${CLASS_INFO[path.primary].label} + ${CLASS_INFO[path.secondary].label} hybrid, and it suits you.`:'';
  return `Your strongest attribute is ${top[0].toUpperCase()} (${top[1]}). ${plays}${blend}`;
}
// Class weapons (owner's rules, 2026-10-03): fists for everyone; every weapon opens at
// level 3, and only for its class. An unlocked hybrid carries both classes' weapons.
export const WEAPON_LEVEL=3;
export const CLASS_WEAPON={fighter:'groveblade',tank:'stonebreaker',ranger:'windstring',mage:'sporewand',support:'bloomstaff'};
const WEAPON_CLASS=Object.fromEntries(Object.entries(CLASS_WEAPON).map(([k,w])=>[w,k]));
/** The classes whose weapons you may carry right now. */
export function myClasses(){const a=profile.appearance,out=[a.discipline||'fighter'];if(a.secondary&&a.secondary!==out[0]&&classUnlock(out[0],a.secondary).ok)out.push(a.secondary);return out;}
export function weaponEligibility(weapon){
  if(weapon==='rootbound')return {ok:true,requirement:''};
  const owner=WEAPON_CLASS[weapon];if(!owner)return {ok:false,requirement:'Unknown weapon'};
  const cls=CLASS_INFO[owner].label;
  if(!myClasses().includes(owner))return {ok:false,requirement:`${cls} CLASS`,classLocked:true};
  if(level()<WEAPON_LEVEL)return {ok:false,requirement:`LEVEL ${WEAPON_LEVEL}`};
  // Owner, 2026-10-07: fists only until you help bring Orrun down; that hunt grants your class weapon.
  if(!profile.wardenFelled)return {ok:false,requirement:'DEFEAT ORRUN',warden:true};
  return {ok:true,requirement:''};
}


// ------------------------------------------------------------- lift log
// No XP: the lift log only tracks personal records and unlocks cosmetic titles.
/** Best estimated one-rep max per exercise: Map(exercise -> {e1rm, kg, reps, date}). */
export function liftRecords(){
  const best=new Map();
  for(const l of profile.lifts){const v=e1rm(l.kg,l.reps),b=best.get(l.ex);if(!b||v>b.e1rm)best.set(l.ex,{e1rm:v,kg:l.kg,reps:l.reps,date:l.date});}
  return best;
}
export function liftSummary(){
  const L=profile.lifts;
  return {sets:L.reduce((n,l)=>n+l.sets,0),days:new Set(L.map(l=>l.date)).size,exercises:new Set(L.map(l=>l.ex)).size,prs:L.filter(l=>l.pr).length,heaviest:L.reduce((m,l)=>Math.max(m,l.kg),0)};
}
export const unlockedTitles=()=>{const s=liftSummary();return TITLES.filter(t=>t.test(s));};
/** Log sets of an exercise (weight in kg). Returns {pr, titles: newly unlocked} or {error}. */
export function logLift(ex,kg,reps,sets=1){
  ex=String(ex||'').trim().replace(/\s+/g,' ').slice(0,40);
  if(!ex)return {error:'Choose or type an exercise.'};
  if(!(kg>=0&&kg<=500))return {error:'Enter the weight (0 for bodyweight).'};
  if(!(reps>=1&&reps<=100))return {error:'Enter the reps (1–100).'};
  const before=new Set(unlockedTitles().map(t=>t.id)),prev=liftRecords().get(ex);
  const pr=!prev||e1rm(kg,reps)>prev.e1rm+1e-9;
  profile.lifts.push({date:localDay(),ex,kg:Math.round(kg*100)/100,reps:Math.round(reps),sets:Math.max(1,Math.min(20,Math.round(sets)||1)),pr:pr&&!!prev});
  profile.lifts=profile.lifts.slice(-600);
  const titles=unlockedTitles().filter(t=>!before.has(t.id));
  if(titles.length&&!profile.title)profile.title=titles[0].id;
  saveProfile();
  const lb=profile.units==='imperial',w=lb?Math.round(kg*2.20462):Math.round(kg*10)/10;
  announce('lift',`logged ${ex} · ${kg>0?`${w} ${lb?'lb':'kg'}`:'bodyweight'} × ${Math.round(reps)}${pr&&prev?' · new record!':''}`);
  return {pr:pr&&!!prev,first:!prev,titles};
}
export function removeLift(index){if(index>=0&&index<profile.lifts.length){profile.lifts.splice(index,1);saveProfile();}}
