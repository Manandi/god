import { profile, stats, level } from './profile.js';
import {supabase} from './supabase.js';

// The shared leaderboard (supabase/schema.sql). Everyone can read it; this
// browser writes its own row through submit_hunter(), which only accepts the
// random secret made here the first time. Players can hide themselves.

const IDENTITY = 'hollow-roots-hunter-v1';

export function hunterIdentity() {
  try {
    const saved = JSON.parse(localStorage.getItem(IDENTITY) || 'null');
    if (saved?.id && saved?.secret) return saved;
  } catch { /* A fresh identity below. */ }
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const made = { id: crypto.randomUUID(), secret: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''), hidden: false };
  try { localStorage.setItem(IDENTITY, JSON.stringify(made)); } catch { /* Private browsing. */ }
  return made;
}
const save = me => { try { localStorage.setItem(IDENTITY, JSON.stringify(me)); } catch { /* Private browsing. */ } };

export const leaderboard = {
  get id() { return hunterIdentity().id; },
  get hidden() { return !!hunterIdentity().hidden; },
  /** Send this explorer's level and stats (skipped while hidden, or before setup is finished). */
  async submit() {
    const me = hunterIdentity();
    if (me.hidden || !profile.complete) return false;
    const { error } = await supabase.rpc('submit_hunter', {
      p_id: me.id, p_secret: me.secret, p_name: (profile.name || 'Wayfarer').slice(0, 24), p_level: level(), p_xp: Math.round(profile.xp),
      p_klass: profile.appearance.discipline || 'fighter', p_stats: stats()
    });
    if (error) throw error;
    return true;
  },
  /** The top explorers, highest level first. */
  async top(limit = 50) {
    const { data, error } = await supabase.from('hunters').select('id,name,level,xp,klass,stats,updated_at').order('level', { ascending: false }).order('xp', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },
  /** Hide from (and remove this browser's row from) the board, or show again. */
  async setHidden(hidden) {
    const me = hunterIdentity(); me.hidden = hidden; save(me);
    if (hidden) { const { error } = await supabase.rpc('remove_hunter', { p_id: me.id, p_secret: me.secret }); if (error) throw error; }
    else await leaderboard.submit();
  }
};

