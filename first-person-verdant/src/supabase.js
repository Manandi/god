import {createClient} from '@supabase/supabase-js';

export const SUPABASE_URL=import.meta.env?.VITE_SUPABASE_URL||'https://gitqmiwwakaejznucxqn.supabase.co';
export const SUPABASE_KEY=import.meta.env?.VITE_SUPABASE_ANON_KEY||'sb_publishable_uRC4vHHdHUnrdsqV2cSajA_HWrPTmZK';
// One client for saves, device links and Realtime avoids duplicate auth clients
// and keeps all browser networking on the same connection pool.
export const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false},realtime:{params:{eventsPerSecond:30}}});
/** An RPC that survives a dropped connection (phones, flaky Wi-Fi): retried twice;
 *  a real answer from the server, even an error, is returned at once. */
export async function rpc(name,args){
  for(let i=0;;i++){
    const res=await supabase.rpc(name,args);
    if(!res.error||!/fetch|network/i.test(res.error.message||'')||i>=2)return res;
    await new Promise(r=>setTimeout(r,700*(i+1)));
  }
}

