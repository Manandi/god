import * as THREE from 'three';
import { makeNpc } from './npcs.js';
import { SKIN_TONES, SHIRTS, TROUSERS, HAIR_COLORS } from './avatar.js';
import {supabase} from './supabase.js';

// Co-op lobby and team fights. The ChatGPT Sites version synced through its own
// server; GitHub Pages has none, so this uses Supabase Realtime: a channel per
// lobby code, presence for who is in it, and broadcasts for everything else.
//
// Team fights are host-authoritative. The lobby member with the smallest id is
// the host (every member works this out the same way). The host's game runs the
// creatures and the bosses and sends a `world` snapshot ten times a second; the
// others show those snapshots and send their hits to the host as `hit`. Each
// game still judges the blows that land on its own explorer.
//
// ?lobby=CODE&net=local runs the same protocol between tabs of one browser
// (BroadcastChannel), for testing without a network.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const clean = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const EVENTS = ['pos', 'state', 'hello', 'world', 'hit', 'act', 'spawn'];

function nameTag(text) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 48;
  const ctx = canvas.getContext('2d'); ctx.font = '600 26px Cinzel, serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#0b1b18cc'; ctx.fillRect(18, 6, 220, 36); ctx.fillStyle = '#f0d98f'; ctx.fillText(text.toUpperCase().slice(0, 16), 128, 33);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }));
  sprite.scale.set(1.8, .34, 1); sprite.position.y = 2.95; sprite.renderOrder = 20; return sprite;
}
const lookFrom = a => ({ skin: SKIN_TONES[a?.skinIndex] || SKIN_TONES[2], hair: HAIR_COLORS[a?.hairColor] || HAIR_COLORS.raven, iris: 0x385342,
  cloth: SHIRTS[a?.shirt] || SHIRTS.moss, trousers: TROUSERS[a?.pants] || TROUSERS.charcoal, braid: a?.hairStyle === 'braid' });

/** Supabase Realtime: presence plus broadcasts on `verdant-reach:CODE`. */
function supabaseTransport(code, id, on) {
  const channel = supabase.channel(`verdant-reach:${code}`, { config: { presence: { key: id }, broadcast: { self: false } } });
  channel.on('presence', { event: 'sync' }, () => on.presence(Object.fromEntries(Object.entries(channel.presenceState()).map(([k, m]) => [k, m[0]]))));
  for (const e of EVENTS) channel.on('broadcast', { event: e }, ({ payload }) => payload && on.event(e, payload));
  channel.subscribe(s => on.status(s === 'SUBSCRIBED' ? 'up' : s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' ? 'down' : 'wait'));
  return {
    track: meta => channel.track(meta),
    send: (event, payload) => channel.send({ type: 'broadcast', event, payload }),
    close: () => supabase.removeChannel(channel)
  };
}
/** Tabs of one browser: BroadcastChannel, with a heartbeat standing in for presence. */
function localTransport(code, id, on) {
  const bc = new BroadcastChannel(`verdant-reach:${code}`), members = new Map(); let meta = {}, beat = null;
  const sync = () => on.presence(Object.fromEntries([[id, meta], ...[...members].map(([k, m]) => [k, m.meta])]));
  bc.onmessage = ({ data }) => {
    if (data.kind === 'presence') { const known = members.has(data.id); members.set(data.id, { meta: data.meta, seen: Date.now() }); if (!known) sync(); }
    else if (data.kind === 'leave') { members.delete(data.id); sync(); }
    else on.event(data.event, data.payload);
  };
  beat = setInterval(() => {
    bc.postMessage({ kind: 'presence', id, meta });
    let gone = false; for (const [k, m] of members) if (Date.now() - m.seen > 3000) { members.delete(k); gone = true; }
    if (gone) sync();
  }, 500);
  setTimeout(() => on.status('up'), 0);
  return {
    track: m => { meta = m; bc.postMessage({ kind: 'presence', id, meta }); sync(); },
    send: (event, payload) => bc.postMessage({ kind: 'event', event, payload }),
    close: () => { clearInterval(beat); bc.postMessage({ kind: 'leave', id }); bc.close(); }
  };
}

export function createCoop(scene, { player, groundY, getName, getAppearance, getShared=()=>({}), onShared=()=>{}, onWorld, onHit, onSpawn, defaultCode='' }) {
  const button = document.getElementById('lobbyButton'), status = document.getElementById('lobbyStatus');
  const params = new URLSearchParams(location.search), local = params.get('net') === 'local';
  // Each tab is its own player (sessionStorage), so two tabs can share a lobby.
  const id = sessionStorage.getItem('verdant-player-id') || crypto.randomUUID(); sessionStorage.setItem('verdant-player-id', id);
  let net = null, code = '', sendTimer = 0, lastShared = '', connected = false, memberIds = [id];
  const remotes = new Map();
  const setStatus = t => { if (status) status.textContent = t; };
  const isHost = () => connected && memberIds[0] === id;
  const count = () => `${code} · ${remotes.size + 1} HUNTER${remotes.size ? 'S' : ''}${remotes.size ? (isHost() ? ' · HOST' : ' · GUEST') : ''}`;

  function remote(key, info = {}) {
    let r = remotes.get(key);
    if (!r) {
      const figure = makeNpc(scene, key, { x: info.x ?? player.x, z: info.z ?? player.z, name: info.name || 'WAYFARER', look: lookFrom(info.appearance) });
      figure.marker.visible = false; figure.root.add(nameTag(info.name || 'Wayfarer'));
      r = { figure, x: figure.x, z: figure.z, y: 0, yaw: 0, name: info.name, act: 0 }; remotes.set(key, r);
    }
    return r;
  }
  function drop(key) { const r = remotes.get(key); if (r) { scene.remove(r.figure.root); remotes.delete(key); } }
  function send(event, payload) { if (connected) net.send(event, payload); }
  function sendShared(force) {
    if (!connected) return;
    const shared = getShared(), json = JSON.stringify(shared);
    if (force || json !== lastShared) { lastShared = json; send('state', shared); }
  }
  const handlers = {
    presence(state) {
      for (const key of [...remotes.keys()]) if (!state[key]) drop(key);
      for (const [key, meta] of Object.entries(state)) if (key !== id) remote(key, meta);
      memberIds = [...new Set([id, ...Object.keys(state)])].sort();
      setStatus(count());
    },
    event(name, payload) {
      if (name === 'pos' && payload.id !== id) Object.assign(remote(payload.id, payload), { x: payload.x, z: payload.z, y: payload.y || 0, yaw: payload.yaw });
      else if (name === 'state') onShared(payload);
      else if (name === 'hello') sendShared(true);
      else if (name === 'world' && payload.from !== id && !isHost()) onWorld?.(payload);
      else if (name === 'hit' && isHost()) onHit?.(payload);
      else if (name === 'spawn' && isHost()) onSpawn?.(payload.id);
      else if (name === 'act' && payload.id !== id) { const r = remotes.get(payload.id); if (r) r.act = .35; }
    },
    async status(s) {
      if (s === 'up') {
        connected = true;
        await net.track({ name: getName(), appearance: getAppearance(), x: player.x, z: player.z });
        send('hello', {}); sendShared(true); setStatus(count());
        const url = new URL(location.href); url.searchParams.set('lobby', code); history.replaceState({}, '', url);
      } else if (s === 'down') { connected = false; setStatus('CO-OP OFFLINE'); }
    }
  };

  async function join(requested) {
    if (net) await leave();
    code = clean(requested) || makeCode(); setStatus('CONNECTING…');
    net = (local ? localTransport : supabaseTransport)(code, id, handlers);
  }
  async function leave() {
    connected = false; for (const key of [...remotes.keys()]) drop(key); memberIds = [id];
    if (net) { await net.close(); net = null; }
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
  const fromUrl = clean(params.get('lobby'));
  // The normal game is one persistent weekly world. A URL lobby remains an
  // explicit override for private testing, but returning players auto-join.
  if (fromUrl || defaultCode) join(fromUrl || defaultCode);

  return {
    id, get code() { return code; }, get connected() { return connected; }, get remotes() { return remotes; }, join, leave, sendShared,
    /** In a team fight: this game runs the creatures (solo, or the lobby's host). */
    get authority() { return !connected || remotes.size === 0 || isHost(); },
    /** A guest in a team fight: creatures come from the host's snapshots. */
    get guest() { return connected && remotes.size > 0 && !isHost(); },
    get teamSize() { return connected ? remotes.size + 1 : 1; },
    /** Other explorers, for creatures to choose whom to chase (the host uses this). */
    others() { return [...remotes].map(([key, r]) => ({ key, x: r.x, z: r.z, y: groundY(r.x, r.z) + r.y })); },
    sendWorld: world => send('world', { ...world, from: id }),
    sendHit: hit => send('hit', { ...hit, from: id }),
    /** A guest reached a nest: ask the host to raise it. */
    sendSpawn: chapter => send('spawn', { id: chapter, from: id }),
    /** This explorer attacked: friends see their figure lunge. */
    sendAct: () => send('act', { id }),
    update(dt, time) {
      if (connected && (sendTimer -= dt) <= 0) {
        sendTimer = .1;
        send('pos', { id, name: getName(), appearance: getAppearance(), x: player.x, z: player.z, y: player.height, yaw: player.yaw });
        sendShared(false);
      }
      for (const r of remotes.values()) {
        const root = r.figure.root, moving = Math.hypot(r.x - root.position.x, r.z - root.position.z) > .05;
        root.position.x = THREE.MathUtils.damp(root.position.x, r.x, 10, dt); root.position.z = THREE.MathUtils.damp(root.position.z, r.z, 10, dt);
        root.position.y = groundY(root.position.x, root.position.z) + r.y;
        // Block figures face +Z; the explorer's yaw faces -Z at 0.
        root.rotation.y = THREE.MathUtils.damp(root.rotation.y, r.yaw + Math.PI, 10, dt);
        r.act = Math.max(0, r.act - dt);
        r.figure.body.rotation.x = r.act > 0 ? Math.sin((1 - r.act / .35) * Math.PI) * .45 : 0;   // a lunge when they attack
        r.figure.body.position.y = moving ? Math.abs(Math.sin(time * 10)) * .08 : Math.sin(time * 1.7) * .012;
      }
    }
  };
}

