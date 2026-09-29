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
const localDay=()=>{const d=new Date(),t=new Date(d.getTime()-d.getTimezoneOffset()*60000);return t.toISOString().slice(0,10);};
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
export const profile={complete:false,introSeen:false,customized:false,units:'metric',personality:{role:'',instinct:''},inputs:defaults(),reasoning:100,reasoningTaken:'',xp:0,activities:[],claimed:[],appearance:{skinIndex:2,face:'soft',hairStyle:'short',hairColor:'raven',shirt:'moss',pants:'charcoal',outfit:'ranger',weapon:'rootbound',discipline:'fighter'},lastWeek:'',name:''};
export function saveProfile(){try{localStorage.setItem(STORAGE,JSON.stringify(profile));}catch{/* Private browsing can disable storage. */}}
export function loadProfile(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE)||'{}');
    profile.complete=raw.complete===true;profile.introSeen=raw.introSeen===true;profile.customized=raw.customized===true;
    profile.units=raw.units==='imperial'?'imperial':'metric';
    profile.personality={role:CLASSES.includes(raw.personality?.role)?raw.personality.role:'',instinct:CLASSES.includes(raw.personality?.instinct)?raw.personality.instinct:''};
    for(const metric of METRICS){const v=Number(raw.inputs?.[metric.key]);profile.inputs[metric.key]=Number.isFinite(v)?Math.max(metric.min,Math.min(metric.max,v)):metric.value;}
    profile.reasoning=Number.isFinite(raw.reasoning)?Math.max(70,Math.min(135,raw.reasoning)):100;
    profile.reasoningTaken=typeof raw.reasoningTaken==='string'?raw.reasoningTaken:'';
    profile.xp=Number.isFinite(raw.xp)?Math.max(0,Math.min(1e7,raw.xp)):0;
    profile.activities=Array.isArray(raw.activities)?raw.activities.filter(a=>a&&['workout','steps','run','study'].includes(a.kind)&&/^\d{4}-\d{2}-\d{2}$/.test(a.date)&&Number.isFinite(a.amount)).slice(-240):[];
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
const score=m=>{
  const v=profile.inputs[m.key],a=m.anchors,asc=a[4]>a[0],points=[1,5,10,15,20];
  if(asc?v<=a[0]:v>=a[0])return 1;
  if(asc?v>=a[4]:v<=a[4])return 20;
  for(let i=0;i<4;i++)if(asc?v>=a[i]&&v<=a[i+1]:v<=a[i]&&v>=a[i+1])return Math.round(points[i]+(v-a[i])/(a[i+1]-a[i])*(points[i+1]-points[i]));
  return 10;
};
export function level(){return 1+Math.floor(Math.sqrt(profile.xp/250));}
export function stats(){
  const s=Object.fromEntries(METRICS.filter(m=>m.anchors).map(m=>[m.key,score(m)]));
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
export function weeklyGoals(){
  const week=weekKey(),recent=profile.activities.filter(a=>a.date>=week);
  const count=kind=>new Set(recent.filter(a=>a.kind===kind).map(a=>a.date)).size;
  return [
    {id:'workout',label:'Train on three days',value:count('workout'),target:3,unit:'days',xp:250},
    {id:'steps',label:'Reach 5,000 steps on three days',value:count('steps'),target:3,unit:'days',xp:150},
    {id:'run',label:'Move five kilometres',value:recent.filter(a=>a.kind==='run').reduce((n,a)=>n+a.amount,0),target:5,unit:'km',xp:200},
    {id:'study',label:'Learn for two hours',value:recent.filter(a=>a.kind==='study').reduce((n,a)=>n+a.amount,0),target:120,unit:'min',xp:180}
  ].map(g=>({...g,claimed:profile.claimed.includes(`${week}:${g.id}`)}));
}
export function logActivity(kind,amount){
  const date=localDay();
  if(!['workout','steps','run','study'].includes(kind)||!Number.isFinite(amount)||amount<=0)return 'Enter a valid activity amount.';
  if(kind==='steps'&&amount<5000)return 'Reach at least 5,000 steps to log a step day.';
  const daily=['workout','steps'].includes(kind);
  if(daily&&profile.activities.some(a=>a.date===date&&a.kind===kind))return 'Already logged for today.';
  const capped=Math.min(amount,kind==='steps'?100000:kind==='run'?100:kind==='study'?600:1);
  const xp=kind==='workout'?75:kind==='steps'?50:kind==='run'?Math.round(capped*12):Math.round(capped*.5);
  profile.activities.push({kind,date,amount:capped,xp});profile.activities=profile.activities.slice(-240);profile.xp+=xp;
  const completed=[];
  for(const g of weeklyGoals())if(!g.claimed&&g.value>=g.target){profile.claimed.push(`${weekKey()}:${g.id}`);profile.xp+=g.xp;completed.push(g.label);}
  saveProfile();return `+${xp} XP${completed.length?` · Weekly quest complete: ${completed.join(', ')}`:''}`;
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
