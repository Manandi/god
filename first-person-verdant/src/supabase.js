import {createClient} from '@supabase/supabase-js';

export const SUPABASE_URL=import.meta.env?.VITE_SUPABASE_URL||'https://gitqmiwwakaejznucxqn.supabase.co';
export const SUPABASE_KEY=import.meta.env?.VITE_SUPABASE_ANON_KEY||'sb_publishable_uRC4vHHdHUnrdsqV2cSajA_HWrPTmZK';
// One client for saves, leaderboard and Realtime avoids duplicate auth clients
// and keeps all browser networking on the same connection pool.
export const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false},realtime:{params:{eventsPerSecond:30}}});

