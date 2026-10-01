import {hunterIdentity} from './identity.js';
import {weekKey} from './profile.js';
import {supabase,rpc} from './supabase.js';

export const worldWeek=()=>weekKey();
// The week's lobby: HR + the Monday's month and day (HR0928). Changed from ROOTdd on
// 2026-10-01 to start everyone in a fresh lobby; it also no longer repeats each month.
export const weeklyLobbyCode=()=>`HR${worldWeek().slice(5).replace('-','')}`;
export function bossWindow(now=new Date()){
  const day=now.getUTCDay(),hour=now.getUTCHours();
  const open=day===6||day===0; // Saturday 00:00 UTC through Sunday 23:59 UTC.
  let next=new Date(now);
  if(open){next.setUTCDate(next.getUTCDate()+(day===6?2:1));next.setUTCHours(0,0,0,0);}
  else{const add=(6-day+7)%7||7;next.setUTCDate(next.getUTCDate()+add);next.setUTCHours(0,0,0,0);}
  return {open,next,remaining:Math.max(0,next-now)};
}
export function bossWindowLabel(){
  const w=bossWindow(),hours=Math.ceil(w.remaining/3600000),days=Math.floor(hours/24),tail=hours%24;
  return w.open?`ORRUN OPEN · ${days?`${days}D `:''}${tail}H LEFT`:`ORRUN SEALED · OPENS IN ${days?`${days}D `:''}${tail}H`;
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
  const {data,error}=await supabase.from('weekly_worlds').select('boss_defeated,defeated_at').eq('week_id',worldWeek()).maybeSingle();
  if(error)throw error;return data||{boss_defeated:false};
}
export async function markWeeklyBossDefeated(){
  const {error}=await rpc('defeat_weekly_boss',{p_week:worldWeek()});if(error)throw error;
}

