import { profile, planWeekKey, weeklyPlan } from './profile.js';
import { hunterIdentity } from './identity.js';
import { rpc, SUPABASE_URL, SUPABASE_KEY } from './supabase.js';

// A single global schedule (7 PM in each player's local timezone) is delivered
// by Supabase Web Push, including when the game page is closed.
const ENABLED = 'hollow-roots-weekly-push-enabled-v1';
let started = false;
let lastSync = '';
let serverKey = '';
let keyRequest = null;

function baseUrl() { return new URL(import.meta.env.BASE_URL || './', location.href); }
async function registration() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const base = baseUrl();
  return navigator.serviceWorker.register(new URL('sw.js', base).pathname, { scope: base.pathname });
}
function publicKeyBytes(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}
async function getServerKey() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/weekly-ping`, { headers: { apikey: SUPABASE_KEY } });
  if (!response.ok) throw new Error('Push reminders are not configured on the server yet.');
  const result = await response.json();
  if (!result.publicKey) throw new Error('Push reminders are not configured on the server yet.');
  return result.publicKey;
}
async function prepare() {
  if (serverKey) return 'ready';
  if (!keyRequest) keyRequest = getServerKey().then(key => { serverKey = key; return 'ready'; }).catch(error => {
    keyRequest = null;
    return /fetch|network/i.test(error?.message || '') ? 'offline' : 'not-configured';
  });
  const result = await keyRequest;
  return typeof result === 'string' && result !== 'ready' ? result : 'ready';
}
function currentState() {
  const plan = weeklyPlan();
  return {
    week: planWeekKey(),
    complete: plan.checked >= plan.total,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  };
}
async function syncProgress(force = false) {
  if (!profile.complete) return;
  try { if (localStorage.getItem(ENABLED) !== '1') return; } catch { return; }
  const state = currentState();
  const me = hunterIdentity();
  const signature = `${me.id}:${state.week}:${state.complete}:${state.timezone}`;
  if (!force && signature === lastSync) return;
  const sw = await navigator.serviceWorker.getRegistration(baseUrl().pathname).catch(() => null);
  const subscription = await sw?.pushManager.getSubscription();
  if (subscription) {
    const json = subscription.toJSON();
    const { error } = await rpc('save_weekly_push_subscription', {
      p_id: me.id, p_secret: me.secret, p_endpoint: json.endpoint,
      p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth,
      p_week_start: state.week, p_complete: state.complete, p_timezone: state.timezone
    });
    if (error) throw error;
  }
  const { error } = await rpc('update_weekly_push_state', {
    p_id: me.id, p_secret: me.secret, p_week_start: state.week,
    p_complete: state.complete, p_timezone: state.timezone
  });
  if (error) throw error;
  lastSync = signature;
}

export const weeklyReminder = {
  get enabled() { try { return localStorage.getItem(ENABLED) === '1'; } catch { return false; } },
  get supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
  get ready() { return Boolean(serverKey); },
  prepare,
  async enable() {
    if (!weeklyReminder.supported) return 'unsupported';
    if (!serverKey) return 'not-configured';
    let permission;
    try { permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission(); }
    catch { return 'denied'; }
    if (permission !== 'granted') return 'denied';
    let subscription;
    try {
      const sw = await registration();
      if (!sw) return 'unsupported';
      subscription = await sw.pushManager.getSubscription();
      if (!subscription) subscription = await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKeyBytes(serverKey) });
      const me = hunterIdentity(), state = currentState(), json = subscription.toJSON();
      const { error } = await rpc('save_weekly_push_subscription', {
        p_id: me.id, p_secret: me.secret, p_endpoint: json.endpoint,
        p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth,
        p_week_start: state.week, p_complete: state.complete, p_timezone: state.timezone
      });
      if (error) throw error;
      localStorage.setItem(ENABLED, '1');
      lastSync = `${me.id}:${state.week}:${state.complete}:${state.timezone}`;
      return 'enabled';
    } catch (error) {
      if (subscription && !weeklyReminder.enabled) await subscription.unsubscribe().catch(() => {});
      if (/not your hunter/i.test(error?.message || '')) return 'save-not-ready';
      return /fetch|network/i.test(error?.message || '') ? 'offline' : 'not-configured';
    }
  },
  async disable() {
    try {
      const sw = await registration().catch(() => null);
      const subscription = await sw?.pushManager.getSubscription();
      if (subscription) {
        const me = hunterIdentity();
        const { error } = await rpc('remove_weekly_push_subscription', { p_id: me.id, p_secret: me.secret, p_endpoint: subscription.endpoint });
        if (error) return 'offline';
        await subscription.unsubscribe().catch(() => {});
      }
      localStorage.removeItem(ENABLED);
      lastSync = '';
      return 'disabled';
    } catch { return 'offline'; }
  },
  async toggle() { return weeklyReminder.enabled ? weeklyReminder.disable() : weeklyReminder.enable(); }
};

export function startWeeklyReminderChecks() {
  if (started) return;
  started = true;
  const sync = () => syncProgress().catch(() => {});
  window.addEventListener('hollow-roots-profile-saved', sync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  syncProgress(true).catch(() => {});
}
