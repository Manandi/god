import type { SupabaseClient } from '@supabase/supabase-js';
import type { CharacterStats } from '../progress/PlayerProgress';

export interface Explorer {
  id: string;
  name: string;
  friend_code: string;
  level: number;
  total_stats: number;
  stats: Partial<CharacterStats>;
  achievements: number;
  streak: number;
  updated_at: string;
}

export interface ExplorerSnapshot {
  name: string;
  level: number;
  stats: CharacterStats;
  achievements: number;
  streak: number;
}

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: Promise<SupabaseClient> | undefined;

/** Loaded on first use rather than bundled into the game's entry chunk: most
 * sessions never open the leaderboard, so they should not pay for the client. */
function supabase(): Promise<SupabaseClient> {
  if (!URL || !ANON_KEY) return Promise.reject(new Error('The leaderboard is not connected to a Supabase project yet.'));
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL, ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } }));
  return client;
}

/** Postgres errors come back as objects; turn them into something a player can read. */
function readable(error: unknown, fallback: string): Error {
  const message = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : '';
  if (/fetch|network|load failed/i.test(message)) return new Error('Could not reach the leaderboard. Check your connection.');
  if (/anonymous/i.test(message)) return new Error('Anonymous sign-ins are switched off in the Supabase project.');
  return new Error(message || fallback);
}

/** Talks to the friends leaderboard. Every call is scoped by row-level security
 * to the signed-in player, so the anon key in the bundle cannot touch anyone
 * else's row — see supabase/schema.sql. */
export const Leaderboard = {
  isConfigured(): boolean {
    return Boolean(URL && ANON_KEY);
  },

  /** Each browser signs in anonymously once and keeps that identity, which is
   * what the database uses to decide which row is yours. */
  async ensureSession(): Promise<string> {
    const auth = (await supabase()).auth;
    const { data: existing } = await auth.getSession();
    if (existing.session) return existing.session.user.id;
    const { data, error } = await auth.signInAnonymously();
    if (error || !data.user) throw readable(error, 'Could not start a leaderboard session.');
    return data.user.id;
  },

  async publish(snapshot: ExplorerSnapshot): Promise<Explorer> {
    const id = await this.ensureSession();
    const total = Object.values(snapshot.stats).reduce((sum, value) => sum + value, 0);
    const { data, error } = await (await supabase())
      .from('explorers')
      .upsert({
        id,
        name: snapshot.name.trim().slice(0, 24),
        level: snapshot.level,
        total_stats: total,
        stats: snapshot.stats,
        achievements: snapshot.achievements,
        streak: snapshot.streak,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();
    if (error || !data) throw readable(error, 'Could not save your standing.');
    return data as Explorer;
  },

  async addFriend(code: string): Promise<void> {
    await this.ensureSession();
    const { error } = await (await supabase()).rpc('add_friend', { code: code.trim().toUpperCase() });
    if (error) throw readable(error, 'Could not add that friend.');
  },

  /** You and everyone you are linked with, strongest first. */
  async board(): Promise<{ me: string; rows: Explorer[] }> {
    const me = await this.ensureSession();
    const db = await supabase();
    const { data: links, error: linkError } = await db.from('friendships').select('friend_id');
    if (linkError) throw readable(linkError, 'Could not load your friends.');
    const ids = [me, ...(links ?? []).map(link => link.friend_id as string)];
    const { data, error } = await db
      .from('explorers')
      .select('*')
      .in('id', ids)
      .order('total_stats', { ascending: false })
      .order('level', { ascending: false });
    if (error) throw readable(error, 'Could not load the leaderboard.');
    return { me, rows: (data ?? []) as Explorer[] };
  }
};
