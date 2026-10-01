import { profile, claimedStats, level, setCaps } from './profile.js';
import { supabase, rpc } from './supabase.js';
import { hunterIdentity } from './identity.js';

// The shared leaderboard (supabase/schema.sql): name, class, level, XP and the
// six game stats. Body measurements (weight, height, raw test numbers) are never
// sent; they stay in the player's own save.
//
// Caps: any player on the board can "cap" 🧢 a friend's stat they think is fake.
// While any cap stands the stat shows struck through, and in play it counts as
// at most 10 (profile.js). Whoever placed a cap lifts it by pressing 🧢 again,
// once they've seen proof in person or on video.

export const STAT_KEYS = ['strength', 'speed', 'stamina', 'defense', 'intelligence', 'discipline'];
const HIDDEN = 'hollow-roots-board-hidden';

export const leaderboard = {
  get id() { return hunterIdentity().id; },
  get hidden() { try { return localStorage.getItem(HIDDEN) === '1'; } catch { return false; } },
  /** Send this explorer's class, level, XP and claimed stats (not while hidden or before setup). */
  async submit() {
    if (leaderboard.hidden || !profile.complete) return false;
    const me = hunterIdentity();
    const { error } = await rpc('submit_hunter', { p_id: me.id, p_secret: me.secret, p_name: (profile.name || 'Wayfarer').slice(0, 24),
      p_level: level(), p_xp: Math.round(profile.xp), p_klass: profile.appearance.discipline || 'fighter', p_stats: claimedStats() });
    if (error) throw error;
    return true;
  },
  /** The board (highest level first) and every standing cap. */
  async load(limit = 50) {
    const [h, c] = await Promise.all([
      supabase.from('hunters').select('id,name,level,xp,klass,stats').order('level', { ascending: false }).order('xp', { ascending: false }).limit(limit),
      supabase.from('stat_caps').select('target,flagger,stat')
    ]);
    if (h.error) throw h.error; if (c.error) throw c.error;
    return { rows: h.data, caps: c.data };
  },
  /** Cap or un-cap a friend's stat; returns true if the cap is now on. */
  async toggleCap(target, stat) {
    const me = hunterIdentity();
    const { data, error } = await rpc('toggle_stat_cap', { p_id: me.id, p_secret: me.secret, p_target: target, p_stat: stat });
    if (error) throw error;
    return data;
  },
  /** Fetch the caps on this explorer's own stats and apply them in play. */
  async refreshMyCaps(names = null) {
    const { data, error } = await supabase.from('stat_caps').select('flagger,stat').eq('target', hunterIdentity().id);
    if (error) throw error;
    let who = names;
    if (!who && data.length) {
      const r = await supabase.from('hunters').select('id,name').in('id', [...new Set(data.map(c => c.flagger))]);
      who = new Map((r.data || []).map(h => [h.id, h.name]));
    }
    const by = new Map();
    for (const c of data) { if (!by.has(c.stat)) by.set(c.stat, []); by.get(c.stat).push(who?.get(c.flagger) || 'a friend'); }
    setCaps([...by]);
    return by;
  },
  /** Hide from the board (removes your row; caps placed on you still stand) or show again. */
  async setHidden(hidden) {
    try { localStorage.setItem(HIDDEN, hidden ? '1' : '0'); } catch { /* Private browsing. */ }
    const me = hunterIdentity();
    if (hidden) { const { error } = await rpc('remove_hunter', { p_id: me.id, p_secret: me.secret }); if (error) throw error; }
    else await leaderboard.submit();
  }
};
