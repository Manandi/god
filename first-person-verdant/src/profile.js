export const BIOMES=[
  {id:'grove',name:'VERDANT REACH',short:'VERDANT',longitude:.115,latitude:.20,level:1,color:'#a8db91',description:'Ancient roots, drowned temples, and the Shellbacks. The first realm is open.',creatures:'Shellbacks · Thornlings',guardian:'Verdant Guardian'},
  {id:'frost',name:'FROSTBOUND CROWN',short:'FROST',longitude:.37,latitude:.43,level:5,color:'#a3dafa',description:'Glacial lakes beneath crystal peaks. A realm waiting beyond the first ascent.',creatures:'Rime Hares · Icebound Sentinels',guardian:'The White Maw'},
  {id:'ember',name:'EMBER WASTES',short:'EMBER',longitude:.62,latitude:.23,level:10,color:'#ffa278',description:'Black citadels divided by living fire.',creatures:'Cinder Hounds · Ash Knights',guardian:'Pyreback Colossus'},
  {id:'wraith',name:'WRAITHMOOR',short:'WRAITH',longitude:.865,latitude:.20,level:15,color:'#d5a9fa',description:'Violet ruins where the dead still wander.',creatures:'Lantern Wraiths · Hollow Knights',guardian:'The Veiled Queen'}
];
export const METRICS=[
  {key:'pushups',label:'Push-ups',unit:'reps',min:0,max:300,step:1,value:15,anchors:[0,5,15,35,60],stat:'strength'},
  {key:'pullups',label:'Pull-ups',unit:'reps',min:0,max:100,step:1,value:5,anchors:[0,1,5,12,22],stat:'strength'},
  {key:'dashSeconds',label:'40-yard sprint',unit:'seconds',min:3.5,max:20,step:.1,value:5.5,anchors:[7.5,6.3,5.5,4.9,4.4],stat:'speed'},
  {key:'verticalJumpCm',label:'Vertical jump',unit:'cm',min:0,max:150,step:1,value:40,anchors:[10,25,40,55,70],stat:'speed'},
  {key:'mileSeconds',label:'One-mile time',unit:'seconds',min:200,max:2400,step:1,value:600,anchors:[900,720,600,480,360],stat:'stamina'},
  {key:'restingHeartRate',label:'Resting heart rate',unit:'bpm',min:30,max:140,step:1,value:68,anchors:[90,78,68,58,45],stat:'stamina'},
  {key:'plankSeconds',label:'Plank hold',unit:'seconds',min:0,max:1200,step:1,value:90,anchors:[10,40,90,180,300],stat:'defense'},
  {key:'benchPressKg',label:'Bench press',unit:'kg',min:0,max:300,step:2.5,value:60,anchors:[10,35,60,90,130],stat:'defense'},
  {key:'sleepHours',label:'Average sleep',unit:'hours',min:0,max:14,step:.5,value:7,anchors:[4,5.5,7,8,8.5],stat:'intelligence'}
];
const STORAGE='hollow-roots-verdant-3d-profile-v1';
const defaults=()=>Object.fromEntries(METRICS.map(m=>[m.key,m.value]));
const localDay=()=>{const d=new Date(),t=new Date(d.getTime()-d.getTimezoneOffset()*60000);return t.toISOString().slice(0,10);};
export function weekKey(date=new Date()){
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-(d.getDay()+6)%7);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
export const profile={complete:false,introSeen:false,inputs:defaults(),reasoning:100,reasoningTaken:'',xp:0,activities:[],claimed:[],appearance:{skinIndex:2,face:'soft',hairStyle:'short',hairColor:'raven',shirt:'moss',pants:'charcoal'},lastWeek:'',name:''};
export function saveProfile(){try{localStorage.setItem(STORAGE,JSON.stringify(profile));}catch{/* Private browsing can disable storage. */}}
export function loadProfile(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE)||'{}');
    profile.complete=raw.complete===true;profile.introSeen=raw.introSeen===true;
    for(const metric of METRICS){const v=Number(raw.inputs?.[metric.key]);profile.inputs[metric.key]=Number.isFinite(v)?Math.max(metric.min,Math.min(metric.max,v)):metric.value;}
    profile.reasoning=Number.isFinite(raw.reasoning)?Math.max(70,Math.min(135,raw.reasoning)):100;
    profile.reasoningTaken=typeof raw.reasoningTaken==='string'?raw.reasoningTaken:'';
    profile.xp=Number.isFinite(raw.xp)?Math.max(0,Math.min(1e7,raw.xp)):0;
    profile.activities=Array.isArray(raw.activities)?raw.activities.filter(a=>a&&['workout','steps','run','study'].includes(a.kind)&&/^\d{4}-\d{2}-\d{2}$/.test(a.date)&&Number.isFinite(a.amount)).slice(-240):[];
    profile.claimed=Array.isArray(raw.claimed)?raw.claimed.filter(v=>typeof v==='string').slice(-100):[];
    const appearance=raw.appearance||{};
    profile.appearance.skinIndex=Number.isInteger(appearance.skinIndex)?Math.max(0,Math.min(5,appearance.skinIndex)):2;
    profile.appearance.face=['soft','sharp','round'].includes(appearance.face)?appearance.face:'soft';
    profile.appearance.hairStyle=['short','curly','swept','tied'].includes(appearance.hairStyle)?appearance.hairStyle:'short';
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
  const s=Object.fromEntries(METRICS.map(m=>[m.key,score(m)]));
  const iq=[70,90,100,115,135],points=[1,5,10,15,20];let reason=20;
  if(profile.reasoning<=70)reason=1;
  else for(let i=0;i<4;i++)if(profile.reasoning<=iq[i+1]){reason=Math.round(points[i]+(profile.reasoning-iq[i])/(iq[i+1]-iq[i])*(points[i+1]-points[i]));break;}
  const days=new Set(profile.activities.filter(a=>a.date>=new Date(Date.now()-27*86400000).toISOString().slice(0,10)).map(a=>a.date)).size;
  return {
    strength:Math.round(s.pushups*.6+s.pullups*.4),speed:Math.round(s.dashSeconds*.7+s.verticalJumpCm*.3),
    stamina:Math.round(s.mileSeconds*.7+s.restingHeartRate*.3),defense:Math.round(s.plankSeconds*.6+s.benchPressKg*.4),
    intelligence:Math.round(reason*.7+s.sleepHours*.3),discipline:profile.activities.length?Math.max(1,Math.min(20,10+Math.round((days/20-.5)*16))):10
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
