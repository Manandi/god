import * as THREE from 'three';
import { createClient } from '@supabase/supabase-js';
import { makeNpc } from './npcs.js';
import { SKIN_TONES, SHIRTS, TROUSERS, HAIR_COLORS } from './avatar.js';

// Co-op lobby. The ChatGPT Sites version synced through its own server; GitHub
// Pages has none, so this uses Supabase Realtime: a channel per lobby code,
// presence for who is in it, and broadcasts for positions and shared progress
// (memories, cleared nests, the Old Shell). Same lobby codes and the same
// ?lobby=CODE links. Creatures are not synchronised; each player fights their own.

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'https://gitqmiwwakaejznucxqn.supabase.co';
// The publishable key is meant to ship in browser bundles (it is also in the Pages workflow).
const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_uRC4vHHdHUnrdsqV2cSajA_HWrPTmZK';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const clean = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

function nameTag(text) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 48;
  const ctx = canvas.getContext('2d'); ctx.font = '600 26px Cinzel, serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#0b1b18cc'; ctx.fillRect(18, 6, 220, 36); ctx.fillStyle = '#f0d98f'; ctx.fillText(text.toUpperCase().slice(0, 16), 128, 33);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }));
  sprite.scale.set(1.8, .34, 1); sprite.position.y = 2.95; sprite.renderOrder = 20; return sprite;
}
const lookFrom = a => ({ skin: SKIN_TONES[a?.skinIndex] || SKIN_TONES[2], hair: HAIR_COLORS[a?.hairColor] || HAIR_COLORS.raven, iris: 0x385342,
  cloth: SHIRTS[a?.shirt] || SHIRTS.moss, trousers: TROUSERS[a?.pants] || TROUSERS.charcoal, braid: a?.hairStyle === 'braid' });

export function createCoop(scene, { player, groundY, getName, getAppearance, getShared, onShared }) {
  const button = document.getElementById('lobbyButton'), status = document.getElementById('lobbyStatus');
  const id = sessionStorage.getItem('verdant-player-id') || crypto.randomUUID(); sessionStorage.setItem('verdant-player-id', id);
  let client = null, channel = null, code = '', sendTimer = 0, lastShared = '', connected = false;
  const remotes = new Map();
  const setStatus = t => { if (status) status.textContent = t; };
  const count = () => `${code} · ${remotes.size + 1} HUNTER${remotes.size ? 'S' : ''}`;

  function remote(key, info = {}) {
    let r = remotes.get(key);
    if (!r) {
      const figure = makeNpc(scene, key, { x: info.x ?? player.x, z: info.z ?? player.z, name: info.name || 'WAYFARER', look: lookFrom(info.appearance) });
      figure.marker.visible = false; figure.root.add(nameTag(info.name || 'Wayfarer'));
      r = { figure, x: figure.x, z: figure.z, y: 0, yaw: 0, name: info.name }; remotes.set(key, r);
    }
    return r;
  }
  function drop(key) { const r = remotes.get(key); if (r) { scene.remove(r.figure.root); remotes.delete(key); } }
  function sendShared(force) {
    if (!connected) return;
    const shared = getShared(), json = JSON.stringify(shared);
    if (force || json !== lastShared) { lastShared = json; channel.send({ type: 'broadcast', event: 'state', payload: shared }); }
  }

  async function join(requested) {
    if (channel) await leave();
    code = clean(requested) || makeCode(); setStatus('CONNECTING…');
    client ||= createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } });
    channel = client.channel(`verdant-reach:${code}`, { config: { presence: { key: id }, broadcast: { self: false } } });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        for (const key of [...remotes.keys()]) if (!state[key]) drop(key);
        for (const [key, metas] of Object.entries(state)) if (key !== id) remote(key, metas[0]);
        setStatus(count());
      })
      .on('broadcast', { event: 'pos' }, ({ payload }) => {
        if (!payload || payload.id === id) return;
        const r = remote(payload.id, payload); Object.assign(r, { x: payload.x, z: payload.z, y: payload.y || 0, yaw: payload.yaw });
      })
      .on('broadcast', { event: 'state' }, ({ payload }) => payload && onShared(payload))
      .on('broadcast', { event: 'hello' }, () => sendShared(true))
      .subscribe(async s => {
        if (s === 'SUBSCRIBED') {
          connected = true;
          await channel.track({ name: getName(), appearance: getAppearance(), x: player.x, z: player.z });
          channel.send({ type: 'broadcast', event: 'hello', payload: {} }); sendShared(true); setStatus(count());
          const url = new URL(location.href); url.searchParams.set('lobby', code); history.replaceState({}, '', url);
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { connected = false; setStatus('CO-OP OFFLINE'); }
      });
  }
  async function leave() {
    connected = false; for (const key of [...remotes.keys()]) drop(key);
    if (channel) { await client.removeChannel(channel); channel = null; }
    code = ''; setStatus('SOLO HUNT');
    const url = new URL(location.href); url.searchParams.delete('lobby'); history.replaceState({}, '', url);
  }
  button?.addEventListener('click', e => {
    e.stopPropagation();
    if (code) {
      const choice = prompt(`Lobby ${code}. Share this code with friends.\nType LEAVE to go back to a solo hunt.`, code);
      if (choice && choice.trim().toUpperCase() === 'LEAVE') leave(); else { navigator.clipboard?.writeText(code); setStatus(`${code} · CODE COPIED`); }
      return;
    }
    const requested = prompt('Enter a 6-character lobby code to join, or leave it blank to start a new lobby.', '');
    if (requested !== null) join(requested);
  });
  const fromUrl = clean(new URLSearchParams(location.search).get('lobby'));
  if (fromUrl) join(fromUrl);

  return {
    get code() { return code; }, get connected() { return connected; }, get remotes() { return remotes; }, join, leave, sendShared,
    update(dt, time) {
      if (connected && (sendTimer -= dt) <= 0) {
        sendTimer = .12;
        channel.send({ type: 'broadcast', event: 'pos', payload: { id, name: getName(), appearance: getAppearance(), x: player.x, z: player.z, y: player.height, yaw: player.yaw } });
        sendShared(false);
      }
      for (const r of remotes.values()) {
        const root = r.figure.root, moving = Math.hypot(r.x - root.position.x, r.z - root.position.z) > .05;
        root.position.x = THREE.MathUtils.damp(root.position.x, r.x, 8, dt); root.position.z = THREE.MathUtils.damp(root.position.z, r.z, 8, dt);
        root.position.y = groundY(root.position.x, root.position.z) + r.y;
        // Block figures face +Z; the explorer's yaw faces -Z at 0.
        root.rotation.y = THREE.MathUtils.damp(root.rotation.y, r.yaw + Math.PI, 10, dt);
        r.figure.body.position.y = moving ? Math.abs(Math.sin(time * 10)) * .08 : Math.sin(time * 1.7) * .012;
      }
    }
  };
}
