import {hunterIdentity} from './identity.js';
import {weekKey} from './profile.js';
import {supabase,rpc} from './supabase.js';

export const worldWeek=()=>weekKey();
// One permanent lobby for everyone, so the same link always lands in the same
// room (it used to change every Monday, which split players in different time
// zones for a few hours). The weekly boss and saves still reset by week on their own.
export const weeklyLobbyCode=()=>'HROOTS';
// The weekly boss: every Thursday, Central time (America/Chicago), from
// 2026-10-08, a week after launch. The server checks the same day
// (boss_day_open in supabase/schema.sql). Entry needs a level that rises with
// the weeks: 3 for the first boss, then 2 more each week (the pace of the plan).
export const BOSS_TZ='America/Chicago',FIRST_BOSS='2026-10-08';
const DAY=86400000;
/** The date (YYYY-MM-DD), weekday (0 = Sunday) and time of day in Central time. */
export function centralNow(now=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:BOSS_TZ,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,dow:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday),secs:(+p.hour)*3600+(+p.minute)*60+(+p.second)};
}
const addDays=(date,n)=>new Date(Date.parse(`${date}T00:00:00Z`)+n*DAY).toISOString().slice(0,10);
/** Which boss a Thursday is (1 for 2026-10-08), and the level it asks for. */
export const bossNumber=date=>Math.floor((Date.parse(`${date}T00:00:00Z`)-Date.parse(`${FIRST_BOSS}T00:00:00Z`))/(7*DAY))+1;
// Week 1 ran two weeks (owner, 2026-10-09), so the 2026-10-15 hunt asks level 3 again and the climb
// (+2 a week) starts a week later: 3, 3, 5, 7, 9…
export const bossLevel=n=>1+2*Math.max(1,n-1);
export function bossWindow(now=new Date()){
  const c=centralNow(now),open=c.dow===4&&c.date>=FIRST_BOSS;
  // The next (or current) boss Thursday, and the time until it opens or closes.
  let day=open?c.date:addDays(c.date,((4-c.dow)+7)%7||7);
  if(day<FIRST_BOSS)day=FIRST_BOSS;
  const untilMidnight=DAY/1000-c.secs,daysAhead=Math.round((Date.parse(`${day}T00:00:00Z`)-Date.parse(`${c.date}T00:00:00Z`))/DAY);
  const remaining=open?untilMidnight*1000:((daysAhead-1)*DAY/1000+untilMidnight)*1000;
  const number=bossNumber(day);
  return {open,day,number,level:bossLevel(number),remaining:Math.max(0,remaining),next:new Date(now.getTime()+remaining)};
}
export function bossWindowLabel(){
  const w=bossWindow(),hours=Math.ceil(w.remaining/3600000),days=Math.floor(hours/24),tail=hours%24;
  return w.open?`ORRUN · THURSDAY · LV ${w.level}+ · ${days?`${days}D `:''}${tail}H LEFT`:`ORRUN SEALED · THURSDAY (CENTRAL) · LV ${w.level}+ · IN ${days?`${days}D `:''}${tail}H`;
}
/** Join (or start) today's gathering: {at, now} as Dates; at is null after a restart. */
export async function bossGather(restart=null){
  const {data,error}=await rpc('boss_gather',{p_week:worldWeek(),p_restart:restart?restart.toISOString():null});
  if(error)throw error;
  return {at:data?.at?new Date(data.at):null,now:new Date(data.now)};
}
export async function loadWeeklySave(){
  const me=hunterIdentity(),{data,error}=await rpc('load_weekly_hunter',{p_week:worldWeek(),p_id:me.id,p_secret:me.secret});
  if(error)throw error;return data||null;
}
export async function saveWeeklyHunter(profile,world){
  const me=hunterIdentity(),{error}=await rpc('save_weekly_hunter',{p_week:worldWeek(),p_id:me.id,p_secret:me.secret,p_profile:profile,p_world:world});
  if(error)throw error;
}
export async function loadWeeklyWorld(){
  const {data,error}=await supabase.from('weekly_worlds').select('boss_defeated,defeated_at,gathering_at').eq('week_id',worldWeek()).maybeSingle();
  if(error)throw error;return data||{boss_defeated:false};
}
export async function markWeeklyBossDefeated(){
  const {error}=await rpc('defeat_weekly_boss',{p_week:worldWeek()});if(error)throw error;
}

