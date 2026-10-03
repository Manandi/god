import * as THREE from 'three';
import { ARENA } from './world.js';
import { bossWindow, bossGather, loadWeeklyWorld } from './weeklyWorld.js';

// The weekly hunt (owner's design, 2026-10-03). Orrun's hollow is sealed off by a
// ring of thorns; the only way in is the Hollow Rift in Mossgate's square, which
// opens on Thursdays (Central time) for explorers who reached that week's level
// (weeklyWorld.js). The first hunter through starts a shared five-minute
// gathering (boss_gather on the server, so every player sees the same clock);
// when it ends, Orrun wakes, as long as two or more hunters stand in the hollow.
// A rift inside the hollow takes you home. If the team falls and Orrun goes back
// to sleep, the host clears the gathering so the next attempt starts fresh.

export const RIFT = { x: 0, z: 61.6 };                              // Mossgate square, between the bench and the north house
export const HOLLOW_ARRIVE = { x: ARENA.x - 2, z: ARENA.z + 16 };
export const HOLLOW_RIFT = { x: ARENA.x - 6, z: ARENA.z + 18.5 };
export const RING = 24, GATHER_MS = 5 * 60000, ATTEMPT_MS = 25 * 60000;
export const inHollow = p => Math.hypot(p.x - ARENA.x, p.z - ARENA.z) < RING - .6;

function riftMesh(scene, x, y, z, color) {
  const group = new THREE.Group(); group.position.set(x, y, z); scene.add(group);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, .13, 10, 40), new THREE.MeshStandardMaterial({ color: 0x1d2a22, emissive: color, emissiveIntensity: .9, roughness: .5 }));
  ring.position.y = 1.55; group.add(ring);
  const veil = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  veil.position.y = 1.55; group.add(veil);
  const swirl = new THREE.Mesh(new THREE.RingGeometry(.25, 1.05, 32, 1, 0, Math.PI * 1.4), new THREE.MeshBasicMaterial({ color: 0xe9fff4, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  swirl.position.y = 1.55; swirl.position.z = .01; group.add(swirl);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, .3, 16), new THREE.MeshStandardMaterial({ color: 0x3a3a33, roughness: .95 }));
  base.position.y = .15; group.add(base);
  const light = new THREE.PointLight(color, 1.6, 9, 2); light.position.y = 1.6; group.add(light);
  return {
    group, set open(on) { veil.material.opacity = on ? .45 : .08; swirl.visible = on; light.intensity = on ? 1.6 : .35; ring.material.emissiveIntensity = on ? .9 : .25; },
    update(t) { swirl.rotation.z = -t * 1.6; veil.material.opacity += ((swirl.visible ? .38 + Math.sin(t * 2.2) * .08 : .08) - veil.material.opacity) * .1; }
  };
}

export function createBossEvent(scene, { addCollider, groundY }) {
  // The thorn ring: tall black thorns all round the hollow, solid to walk and jump into.
  const n = 112, thorn = new THREE.ConeGeometry(.55, 6, 6); thorn.translate(0, 3, 0);
  const thorns = new THREE.InstancedMesh(thorn, new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: .9, emissive: 0x0b2a22, emissiveIntensity: .35 }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, wob = Math.sin(i * 12.9898) * .5, r = RING + wob * .6;
    const x = ARENA.x + Math.cos(a) * r, z = ARENA.z + Math.sin(a) * r, y = groundY(x, z) - .3;
    e.set(Math.sin(i * 3.1) * .22, a, Math.cos(i * 2.3) * .22); q.setFromEuler(e); sc.set(1, .8 + (i * 7 % 5) * .1, 1);
    thorns.setMatrixAt(i, m.compose(v.set(x, y, z), q, sc));
    addCollider({ x, z, r: .9, top: y + 7 });
  }
  thorns.castShadow = true; scene.add(thorns);

  const home = riftMesh(scene, RIFT.x, groundY(RIFT.x, RIFT.z), RIFT.z, 0x59e0c0);
  const back = riftMesh(scene, HOLLOW_RIFT.x, groundY(HOLLOW_RIFT.x, HOLLOW_RIFT.z), HOLLOW_RIFT.z, 0xf0c86a);
  back.group.rotation.y = Math.PI * .85;
  back.open = true;

  // Shared gathering: when it started (server time), and the offset of the server clock from ours.
  const state = { at: null, offset: 0, joined: false, pollIn: 0 };
  const serverNow = () => Date.now() + state.offset;
  const ev = {
    state,
    serverNow,
    /** closed (not Thursday) · idle (open, nobody gathering) · gathering (countdown) · fight (Orrun may wake) */
    phase() {
      if (!bossWindow().open) return 'closed';
      if (!state.at || serverNow() > state.at.getTime() + ATTEMPT_MS) return 'idle';
      return serverNow() < state.at.getTime() + GATHER_MS ? 'gathering' : 'fight';
    },
    /** Seconds until Orrun wakes (gathering only). */
    countdown() { return state.at ? Math.max(0, (state.at.getTime() + GATHER_MS - serverNow()) / 1000) : 0; },
    /** Go through the rift: join today's gathering, or start it. */
    async enter() { const r = await bossGather(); state.offset = r.now.getTime() - Date.now(); state.at = r.at; state.joined = true; },
    /** After a wipe: clear this gathering so the next hunter starts a new one. */
    async restart() { const at = state.at; state.at = null; state.joined = false; if (at) try { await bossGather(at); } catch { /* offline: the server lets it go stale */ } },
    /** Poll the shared gathering now and then on boss day (someone else may have started it). */
    update(dt, t) {
      home.open = bossWindow().open; home.update(t); back.update(t);
      if (!home.open) return;
      if ((state.pollIn -= dt) > 0) return;
      state.pollIn = 12;
      loadWeeklyWorld().then(w => { const at = w.gathering_at ? new Date(w.gathering_at) : null; if (!at || !state.at || at.getTime() !== state.at.getTime()) { state.at = at; if (!at) state.joined = false; } }).catch(() => {});
    }
  };
  return ev;
}
