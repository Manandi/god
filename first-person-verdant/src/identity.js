import { rpc } from './supabase.js';

// Who this browser is online: a random hunter id and secret, made the first
// time and kept in localStorage. The cloud save (weeklyWorld.js) is keyed by
// it. "Link this device" moves it to another browser with a one-time code
// (create_device_link / claim_device_link in supabase/schema.sql).

const IDENTITY = 'hollow-roots-hunter-v1';   // the key from the old leaderboard, so existing saves keep their identity
export const LINK_PENDING = 'hollow-roots-link-pending';

export function hunterIdentity() {
  try {
    const saved = JSON.parse(localStorage.getItem(IDENTITY) || 'null');
    if (saved?.id && saved?.secret) return saved;
  } catch { /* A fresh identity below. */ }
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const made = { id: crypto.randomUUID(), secret: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') };
  try { localStorage.setItem(IDENTITY, JSON.stringify(made)); } catch { /* Private browsing. */ }
  return made;
}

/** A one-time code (10 minutes) for another device to take over this hunter. */
export async function createLinkCode() {
  const me = hunterIdentity();
  const { data, error } = await rpc('create_device_link', { p_id: me.id, p_secret: me.secret });
  if (error) throw error;
  return data;
}

/** Use a code from another device: this browser becomes that hunter. Returns false if the code is wrong or expired. */
export async function claimLinkCode(code) {
  const { data, error } = await rpc('claim_device_link', { p_code: code });
  if (error) throw error;
  if (!data?.id || !data?.secret) return false;
  localStorage.setItem(IDENTITY, JSON.stringify({ id: data.id, secret: data.secret }));
  // Until the linked explorer's cloud save has loaded, this device must not upload
  // its own (empty) save over it. main.js clears this once the load succeeds.
  localStorage.setItem(LINK_PENDING, '1');
  return true;
}
