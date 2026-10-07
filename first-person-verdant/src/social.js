import { rpc } from './supabase.js';
import { hunterIdentity } from './identity.js';
import { profile } from './profile.js';
import { leaderboard } from './leaderboard.js';

// The Social tab's Activity feed (owner, 2026-10-07): whenever someone logs something (a workout,
// steps, a learning session, a lift, the monthly tests, a level, a hunt), a short line goes to the
// shared feed (supabase/schema.sql: activity_feed). Friends can give kudos, and the person gets a
// notification: a toast in game, a badge in the menu, and a browser notification if they allowed it.
// Only game-written lines are posted, never body measurements (weight, height, raw test numbers).
// Hidden from the leaderboard, or SHARE MY ACTIVITY off: nothing is posted.

const SHARE = 'hollow-roots-share-activity';
const listeners = new Set();

export const social = {
  /** Kudos received but not yet looked at (the menu badge and the Activity tab's "new" strip). */
  inbox: [],
  get sharing() { try { return localStorage.getItem(SHARE) !== '0' && !leaderboard.hidden; } catch { return !leaderboard.hidden; } },
  setSharing(on) { try { localStorage.setItem(SHARE, on ? '1' : '0'); } catch { /* private browsing */ } },
  get myId() { return hunterIdentity().id; },
  /** Post a line to the feed (quietly does nothing offline, hidden, or before setup). */
  async post(kind, text, retry = true) {
    if (!social.sharing || !profile.complete) return;
    const me = hunterIdentity();
    const { error } = await rpc('post_activity', { p_id: me.id, p_secret: me.secret, p_name: (profile.name || 'Wayfarer').slice(0, 24), p_kind: kind, p_text: String(text).slice(0, 120) });
    // A brand-new explorer's first save may still be on its way: try once more shortly.
    if (error && retry && /not your hunter/.test(error.message || '')) setTimeout(() => social.post(kind, text, false).catch(() => {}), 4000);
  },
  async feed(limit = 60) { const { data, error } = await rpc('list_activity', { p_limit: limit }); if (error) throw error; return data || []; },
  async kudos(activityId) {
    const me = hunterIdentity();
    const { data, error } = await rpc('give_kudos', { p_activity: activityId, p_id: me.id, p_secret: me.secret, p_name: (profile.name || 'A friend').slice(0, 24) });
    if (error) throw error; return data;
  },
  /** Ask for kudos nobody has shown me yet; new ones go to the inbox and to every listener. */
  async check() {
    if (!profile.complete) return [];
    const me = hunterIdentity();
    const { data, error } = await rpc('my_new_kudos', { p_id: me.id, p_secret: me.secret });
    if (error || !data?.length) return [];
    social.inbox.push(...data); social.inbox = social.inbox.slice(-30);
    for (const fn of listeners) fn(data);
    return data;
  },
  onKudos(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  clearInbox() { social.inbox = []; for (const fn of listeners) fn([]); },
  /** Browser notifications for kudos while the game is in the background (asked for once, from the Activity tab). */
  get canNotify() { return typeof Notification !== 'undefined'; },
  get notifyOn() { return social.canNotify && Notification.permission === 'granted'; },
  async askNotify() { if (!social.canNotify) return false; return (await Notification.requestPermission()) === 'granted'; }
};

// The game announces what was logged (profile.js and main.js dispatch this event).
window.addEventListener('hollow-roots-activity', e => social.post(e.detail.kind, e.detail.text).catch(() => {}));
// Kudos reach you while the page is open: checked every minute and whenever you come back to the tab.
setInterval(() => social.check().catch(() => {}), 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) social.check().catch(() => {}); });
setTimeout(() => social.check().catch(() => {}), 5000);
social.onKudos(list => {
  if (!list.length || !social.notifyOn || !document.hidden) return;
  const k = list[list.length - 1];
  try { new Notification('The Hollow Roots · Kudos', { body: `${k.giver_name} gave you kudos: “${k.text}”${list.length > 1 ? ` (+${list.length - 1} more)` : ''}`, tag: 'hollow-roots-kudos' }); } catch { /* some browsers only notify from a service worker */ }
});

/** "3 min ago" style times for the feed. */
export function ago(iso) {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`; const d = Math.floor(s / 86400); return d === 1 ? 'yesterday' : `${d} days ago`;
}
