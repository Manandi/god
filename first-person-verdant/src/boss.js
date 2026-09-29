import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { groundY, ARENA, ARENA_Y } from './world.js';
import { angleTo } from './angles.js';

// Orrun, the Hollow Warden (tools/blender/build_warden.py) and its arena
// (tools/blender/build_arena.py). The Warden speaks the same interface as the
// creatures in creatures.js — hurtVolumes, hit, deflect, exposed, update
// events — so lock-on, strikes, guard and parry all work on it unchanged.
//
// Every attack is one authored clip, and the hit windows below are clip
// times: what you see is what the damage check uses. Damage volumes follow
// the animated bones (head, tail, feet), not a guess.

const BASE = import.meta.env?.BASE_URL || '/';
const SCALE = 1.1;
export const BED = { x: ARENA.x, z: ARENA.z - 9 };     // where it sleeps, roots holding it to the gate
const ROAM = 17;                                        // it never leaves the plaza (menhirs stand at 20)

const ATTACKS = {
  bite:   { clip: 'Bite', dur: 2.8, windup: .7, kind: 'light', damage: 1, label: 'Warden bite', parry: true,
            hits: [[.72, .9], [1.66, 1.84]], lunge: [[.62, .85, 1.6], [1.55, 1.8, 1.1]], range: [0, 6.5], arc: .75 },
  stomp:  { clip: 'Stomp', dur: 2.6, windup: 1.0, kind: 'heavy', damage: 2, label: 'root stomp', impact: [1.08, 1.2],
            wave: { from: 2.2, to: 10.5, duration: .8 }, range: [0, 7.5], arc: 1.0 },
  sweep:  { clip: 'Sweep', dur: 2.2, windup: .7, kind: 'heavy', damage: 2, label: 'tail sweep', hits: [[.72, 1.08]], range: [0, 9.5], arc: 9 },
  charge: { clip: 'Charge', windup: .9, run: 2.3, speed: 9, recover: 1.3, kind: 'heavy', damage: 2, label: 'charge', range: [12, 40], arc: .6 },
  // A full turn with the tail held out flat: nowhere near it is safe, so dash through or back off.
  tailspin: { clip: 'TailSpin', dur: 2.6, windup: .8, kind: 'heavy', damage: 2, label: 'tail spin', hits: [[.86, 1.5]], range: [0, 9], arc: 9 },
  // Turns its back and hammers the tail down where you stood; the ground cracks around the tip.
  tailslam: { clip: 'TailSlam', dur: 2.8, windup: .95, kind: 'heavy', damage: 2, label: 'tail hammer', hits: [[1.04, 1.2]], impact: [1.08, 1.2],
              wave: { from: 2, to: 4.8, duration: .5 }, at: 'tail', range: [4.5, 10.5], arc: 9 },
  // Crouches, then leaps at you and lands shell-first; the landing sends out a ring.
  pounce: { clip: 'Pounce', dur: 2.6, windup: .75, kind: 'heavy', damage: 2, label: 'pounce', impact: [1.18, 1.32], wave: { from: 3.6, to: 8.5, duration: .7 }, at: 'body',
            lunge: [[.75, 1.2, 9]], close: 1.4, range: [5.5, 17], arc: .9 },
  erupt:  { clip: 'Erupt', dur: 2.4, windup: .95, kind: 'heavy', damage: 1, label: 'root eruption', range: [3, 30], arc: 9, phase: 2 }
};
// Follow-ups: some attacks flow straight into another, Monster Hunter style,
// with no recovery between them. [next attack, chance in phase 1, phase 2, max distance].
const FOLLOW = { bite: ['tailspin', .2, .45, 6], stomp: ['bite', .25, .4, 6.5], tailslam: ['pounce', .15, .35, 16], pounce: ['bite', .3, .5, 6] };
const CHARGE_REST = 12;                                 // seconds before it will charge again
const PART = { head: 1.5, neck: 1.1, shell: .45, leg: 1, tail: .8, club: 1, belly: 2.2 };
// The root club on its tail breaks after this much damage to it: its tail
// attacks then lose the club's reach, weight and the tail hammer's shockwave.
const CLUB_HEALTH = 150;
const POISE = 70, FLINCH = 110, TOPPLE_DOWN = 4.6, REEL = 2.3;
const lerp = THREE.MathUtils.lerp, damp = THREE.MathUtils.damp;

export class Warden {
  constructor(scene, gltf) {
    this.type = 'warden'; this.name = 'ORRUN, THE HOLLOW WARDEN';
    this.x = BED.x; this.z = BED.z; this.heading = 0; this.radius = 2.7; this.focusHeight = 2.3; this.markerHeight = 5.6;
    this.maxHealth = 1000; this.health = this.maxHealth; this.poise = POISE; this.poiseDelay = 0; this.flinch = 0;
    this.alive = true; this.awake = false; this.phase = 1; this.enraged = false; this.state = 'dormant'; this.t = 0;
    this.attack = null; this.cooldown = 2; this.lastEvent = ''; this.hitDone = new Set(); this.pending = [];
    this.scene = scene; this.root = new THREE.Group(); scene.add(this.root);
    const model = gltf.scene; model.scale.setScalar(SCALE); this.root.add(model); this.model = model;
    this.bones = {}; this.mats = {}; this.clubHealth = CLUB_HEALTH;
    model.traverse(o => {
      if (o.name === 'TailClub') this.club = o;
      if (o.isBone) this.bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        for (const m of [].concat(o.material)) this.mats[m.name] = m;
      }
    });
    this.mixer = new THREE.AnimationMixer(model); this.actions = {};
    for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    for (const name of ['Roar', 'Bite', 'Stomp', 'Sweep', 'Erupt', 'Stagger', 'Topple', 'GetUp', 'Death']) {
      const a = this.actions[name]; if (a) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    }
    this.current = null; this.play('Sleep');
    // Ground tell under attacks, and the eruption markers.
    this.tell = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xe9ad62, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.tell.rotation.x = -Math.PI / 2; this.tell.visible = false; scene.add(this.tell);
    this.spots = [];
    this.spikeMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: .95, flatShading: true });
    // Tuned for the game's ACES exposure: enough to glow teal without blowing out to white.
    this.baseEmissive = { memory: .9, shell: 1.4 };
    if (this.mats.M_Eye) this.mats.M_Eye.emissiveIntensity = 2.5;
    this.setGlow(1);
    this.place();
  }

  // ------------------------------------------------------------ helpers
  play(name, { time = null, fade = .3, speed = 1 } = {}) {
    const next = this.actions[name]; if (!next) return;
    if (next !== this.current) {
      next.reset(); next.play(); next.enabled = true;
      if (this.current) this.current.crossFadeTo(next, fade, false);
      this.current = next;
    }
    if (time !== null) { next.timeScale = 0; next.time = Math.min(time, next.getClip().duration); }
    else next.timeScale = speed;
  }
  get pace() { return this.enraged ? .78 : this.phase > 1 ? .88 : 1; }
  forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  bone(name, out = new THREE.Vector3()) { return this.bones[name] ? this.bones[name].getWorldPosition(out) : out.set(this.x, ARENA_Y + 2, this.z); }
  place() {
    const r = Math.hypot(this.x - ARENA.x, this.z - ARENA.z);
    if (r > ROAM && this.state !== 'return') { this.x = ARENA.x + (this.x - ARENA.x) / r * ROAM; this.z = ARENA.z + (this.z - ARENA.z) / r * ROAM; }
    this.root.position.set(this.x, groundY(this.x, this.z), this.z); this.root.rotation.y = this.heading; this.root.updateMatrixWorld(true);
  }
  setState(s) { this.state = s; this.t = 0; this.hitDone.clear(); }
  get toppled() { return this.state === 'down' || (this.state === 'topple' && this.t > .8); }
  /** Open to a Root Strike: on its back, or reeling from a parried bite. */
  get exposed() { return this.toppled || this.state === 'reeling'; }
  /** Things the explorer cannot walk through: the shell, and the head and tail. */
  bodyCircles() {
    if (this.state === 'released' || !this.root.visible) return [{ x: this.x, z: this.z, r: this.radius }];
    const h = this.bone('head'), t = this.bone('tail_02'), c = this.tailTip();
    return [{ x: this.x, z: this.z, r: this.radius }, { x: h.x, z: h.z, r: .9 }, { x: t.x, z: t.z, r: .6 }, { x: c.x, z: c.z, r: this.clubBroken ? .35 : .7 }];
  }
  showBar() {}

  hurtVolumes() {
    if (!this.alive) return [];
    if (this.toppled) { const b = this.bone('shell'); return [{ x: b.x, y: b.y, z: b.z, r: 2.5, part: 'belly' }]; }
    const out = [], f = this.forward(), v = new THREE.Vector3();
    this.bone('head', v).addScaledVector(f, .45); out.push({ x: v.x, y: v.y, z: v.z, r: .85, part: 'head' });
    this.bone('neck_02', v); out.push({ x: v.x, y: v.y, z: v.z, r: .65, part: 'neck' });
    this.bone('body', v);
    for (const k of [-1.7, 0, 1.7]) out.push({ x: v.x + f.x * k, y: v.y + .6, z: v.z + f.z * k, r: 2.05, part: 'shell' });
    for (const leg of ['fl', 'fr', 'bl', 'br']) { this.bone('shin_' + leg, v); out.push({ x: v.x, y: v.y, z: v.z, r: .8, part: 'leg' }); }
    this.bone('tail_02', v); out.push({ x: v.x, y: v.y, z: v.z, r: .6, part: 'tail' });
    this.bone('tail_03', v); out.push({ x: v.x, y: v.y, z: v.z, r: .45, part: 'tail' });
    const c = this.tailTip(); out.push({ x: c.x, y: c.y, z: c.z, r: this.clubBroken ? .4 : .85, part: this.clubBroken ? 'tail' : 'club' });
    return out;
  }
  /** Where the current attack can hurt (also drawn by the F3 debug overlay). */
  damageVolumes() {
    const a = ATTACKS[this.attack], out = [], v = new THREE.Vector3(), ct = this.clipTime;
    if (!a || !['attack', 'charge'].includes(this.state)) return out;
    const live = w => ct >= w[0] && ct <= w[1];
    if (this.attack === 'bite' && a.hits.some(live)) { this.bone('head', v).addScaledVector(this.forward(), .7); out.push({ x: v.x, y: v.y, z: v.z, r: 1.05 }); }
    if (this.attack === 'tailspin' && a.hits.some(live)) {
      for (const [b, r] of [['tail_03', 1.1], ['tail_02', 1.3], ['tail_01', 1.3]]) { this.bone(b, v); out.push({ x: v.x, y: v.y, z: v.z, r }); }
      const tip = this.tailTip(); out.push({ x: tip.x, y: tip.y, z: tip.z, r: this.clubBroken ? .8 : 1.4 });
    }
    if (this.attack === 'tailslam' && a.hits.some(live)) { const tip = this.tailTip(); out.push({ x: tip.x, y: tip.y + .3, z: tip.z, r: this.clubBroken ? 1.1 : 1.8 }); }
    if (this.attack === 'pounce' && live(a.impact)) { this.bone('body', v); out.push({ x: v.x, y: groundY(v.x, v.z) + .6, z: v.z, r: 3.3 }); }
    if (a.wave && this.attack !== 'stomp' && !(a.at === 'tail' && this.clubBroken)) {
      const w = ct - a.impact[0];
      if (w >= 0 && w <= a.wave.duration) { const q = this.impactPoint(); out.push({ x: q.x, y: q.y, z: q.z, r: lerp(a.wave.from, a.wave.to, w / a.wave.duration), ring: true }); }
    }
    if (this.attack === 'sweep' && a.hits.some(live)) {
      for (const [b, r] of [['tail_03', 1.1], ['tail_02', 1.4], ['tail_01', 1.3]]) { this.bone(b, v); out.push({ x: v.x, y: v.y, z: v.z, r }); }
      const tip = this.tailTip(); out.push({ x: tip.x, y: tip.y, z: tip.z, r: this.clubBroken ? .8 : 1.4 });
    }
    if (this.attack === 'stomp') {
      if (live(a.impact)) { const p = this.stompPoint(); out.push({ x: p.x, y: p.y + .4, z: p.z, r: 2.5 }); }
      const w = ct - a.impact[0];
      if (w >= 0 && w <= a.wave.duration) { const p = this.stompPoint(); out.push({ x: p.x, y: p.y, z: p.z, r: lerp(a.wave.from, a.wave.to, w / a.wave.duration), ring: true }); }
    }
    if (this.attack === 'charge' && this.chargeRun) { this.bone('body', v).addScaledVector(this.forward(), 2.4); out.push({ x: v.x, y: v.y, z: v.z, r: 2.1 }); }
    return out;
  }
  /** The root club at the end of the tail, where the tail hammer lands. */
  tailTip() {
    const a = this.bone('tail_02'), b = this.bone('tail_03'); return b.clone().add(b.sub(a).multiplyScalar(this.clubBroken ? .75 : .95));
  }
  impactPoint() {
    const a = ATTACKS[this.attack];
    const p = a?.at === 'tail' ? this.tailTip() : a?.at === 'body' ? this.bone('body') : this.stompPoint(); p.y = groundY(p.x, p.z); return p;
  }
  stompPoint() {
    const a = this.bone('foot_fl'), b = this.bone('foot_fr'); const p = a.add(b).multiplyScalar(.5); p.y = groundY(p.x, p.z); return p;
  }
  get clipTime() { return this.t / this.pace; }

  // --------------------------------------------------------- being hit
  hit({ damage, poise, fromX, fromZ, stagger, part, pierce = 0 }) {
    if (!this.alive) return null;
    if (!this.awake) { this.wake(); }
    let mult = PART[part] ?? 1;
    if (mult < 1 && pierce) mult = Math.min(1, mult * (1 + pierce));
    const dealt = damage * mult;
    this.health = Math.max(0, this.health - dealt); this.flash = .12;
    if (part === 'club' && !this.clubBroken && (this.clubHealth -= dealt) <= 0) {
      this.clubBroken = true; if (this.club) this.club.visible = false; this.pending.push({ type: 'tailBroken' });
    }
    const out = { damage: dealt, effect: part === 'belly' ? 'belly' : mult > 1 ? 'weak' : mult < 1 ? 'armored' : 'normal', toppled: false, defeated: false, staggered: false };
    if (this.health <= 0) { this.alive = false; this.attack = null; this.setState('defeated'); this.lastEvent = 'released'; out.defeated = true; this.clearSpots(); return out; }
    if (this.phase === 1 && this.health < this.maxHealth * .6) this.pendingPhase = true;
    if (!this.enraged && this.health < this.maxHealth * .25) { this.enraged = true; this.pending.push({ type: 'enrage' }); }
    if (this.toppled || this.state === 'topple' || this.state === 'getup') { this.lastEvent = 'struck while down'; return out; }
    this.poise -= poise * (part === 'leg' ? 1.8 : part === 'head' ? 1.2 : 1); this.poiseDelay = 4;
    if (this.poise <= 0 && !['roar', 'awaken'].includes(this.state)) {
      this.poise = POISE; this.attack = null; this.chargeRun = false; this.clearSpots(); this.setState('topple'); this.lastEvent = 'TOPPLED'; out.toppled = true; return out;
    }
    this.flinch += dealt * (part === 'head' ? 1.6 : 1) * (stagger >= .8 ? 1.5 : 1);
    if (this.flinch >= FLINCH && !['roar', 'awaken', 'reeling'].includes(this.state)) {
      this.flinch = 0; this.attack = null; this.chargeRun = false; this.clearSpots(); this.setState('stagger'); this.lastEvent = 'staggered'; out.staggered = true;
    } else this.lastEvent = this.state === 'attack' ? 'hit (kept attacking)' : 'hit';
    return out;
  }
  /** Only the bite can be parried: the head recoils and it reels, open to a riposte. */
  deflect() {
    if (!this.alive || this.state !== 'attack' || this.attack !== 'bite') return false;
    this.attack = null; this.poise = Math.max(1, this.poise - 18); this.poiseDelay = 4; this.setState('reeling'); this.lastEvent = 'PARRIED';
    return true;
  }
  /** Before the story reaches the gate it only sleeps: nothing to lock on to or strike. */
  setSealed(on) {
    if (on === !!this.sealed) return;
    this.sealed = on;
    if (on) { this.alive = false; this.awake = false; this.setState('dormant'); }
    else if (this.state === 'dormant') this.alive = true;
  }
  /** The attack being wound up right now, if any (for the HUD warning). */
  get winding() {
    const a = ATTACKS[this.attack];
    if (!a) return null;
    if (this.state === 'attack' && this.clipTime < a.windup) return this.attack;
    if (this.state === 'charge' && !this.chargeRun) return this.attack;
    return null;
  }
  wake() { if (this.awake || !this.alive) return; this.awake = true; this.setState('awaken'); this.pending.push({ type: 'awaken' }); }
  /** Back to sleep in its bed, whole again (the explorer fell or fled). */
  reset() {
    this.alive = true; this.awake = false; this.health = this.maxHealth; this.poise = POISE; this.phase = 1; this.enraged = false; this.pendingPhase = false;
    this.x = BED.x; this.z = BED.z; this.heading = 0; this.attack = null; this.chargeRun = false; this.clearSpots(); this.setState('dormant'); this.play('Sleep', { fade: .1 });
    this.clubHealth = CLUB_HEALTH; this.clubBroken = false; if (this.club) this.club.visible = true;
    this.setGlow(1); this.place();
  }
  /** Freed: lies still, eyes warm, the drained memories gone from its back. */
  release(instant = false) {
    this.alive = false; this.awake = false; this.attack = null; this.clearSpots(); this.setState('released'); this.released = 0;
    if (instant) { this.released = 9; this.x = BED.x; this.z = BED.z; this.heading = 0; this.play('Sleep', { fade: .01 }); }
    this.place();
  }
  setGlow(k) {
    if (this.mats.M_Memory) this.mats.M_Memory.emissiveIntensity = this.baseEmissive.memory * k;
    if (this.mats.M_Shell) this.mats.M_Shell.emissiveIntensity = this.baseEmissive.shell * k;
  }

  // ---------------------------------------------------------- behaviour
  update(dt, time, ctx) {
    if (this.sealed) { this.t += dt; this.play('Sleep'); this.mixer.update(dt); return []; }
    const events = this.pending.splice(0), p = ctx.player;
    this.t += dt; this.clock = (this.clock || 0) + dt; this.flash = Math.max(0, (this.flash || 0) - dt);
    this.poiseDelay -= dt; if (this.poiseDelay <= 0) this.poise = Math.min(POISE, this.poise + dt * 5);
    this.flinch = Math.max(0, this.flinch - dt * 6);
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz), toPlayer = Math.atan2(dx, dz), rel = angleTo(this.heading, toPlayer);
    const turn = (want, rate) => { this.heading += THREE.MathUtils.clamp(angleTo(this.heading, want), -rate * dt, rate * dt); };
    const step = (speed, yaw = this.heading) => { this.x += Math.sin(yaw) * speed * dt; this.z += Math.cos(yaw) * speed * dt; };
    const pc = this.pace, ct = this.clipTime;

    // The fight has a boundary: flee the Hollow and it returns to its bed.
    if (this.awake && this.alive && Math.hypot(p.x - ARENA.x, p.z - ARENA.z) > ARENA.r + 13 && !['return', 'topple', 'down', 'getup'].includes(this.state)) {
      this.attack = null; this.chargeRun = false; this.clearSpots(); this.setState('return'); events.push({ type: 'leash' });
    }
    switch (this.state) {
      case 'dormant':
        this.play('Sleep');
        if (ctx.canWake && (Math.hypot(p.x - BED.x, p.z - BED.z) < 15 || Math.hypot(p.x - ARENA.x, p.z - ARENA.z) < ARENA.r - 4)) this.wake();
        break;
      case 'awaken': case 'roar': {
        this.play('Roar', { time: this.t });
        if (this.t < .5) turn(toPlayer, 1.2);
        if (this.t >= .72 && !this.hitDone.has('roar')) {
          this.hitDone.add('roar'); events.push({ type: 'roar' });
          if (dist < 7.5) events.push({ type: 'strike', attack: 'roar', label: 'roar', kind: 'light', damage: 0, x: this.x, z: this.z });
        }
        if (this.t >= 2.6) { this.cooldown = 1; this.setState('hunt'); }
        break;
      }
      case 'hunt': {
        if (this.pendingPhase) { this.pendingPhase = false; this.phase = 2; this.setState('roar'); events.push({ type: 'phase', phase: 2 }); break; }
        this.cooldown -= dt;
        if (this.cooldown <= 0 && (!ctx.mayAttack || ctx.mayAttack(this))) {
          const name = this.choose(dist, rel);
          if (name) { this.begin(name, p, events); break; }
          this.cooldown = .8;
        }
        // Close in, or turn to face; slow and heavy.
        const facing = Math.abs(rel) < .45;
        if (dist > 5.5) { turn(toPlayer, 1.3); if (facing) step(2.1 / pc); this.play('Walk', { speed: facing ? 1.6 / pc : .7 }); }
        else if (!facing) { turn(toPlayer, 1.4); this.play('Walk', { speed: .7 }); }
        else this.play('Idle');
        break;
      }
      case 'attack': this.runAttack(dt, p, ctx, events, dist, rel, toPlayer); break;
      case 'charge': this.runCharge(dt, p, ctx, events, toPlayer); break;
      case 'recover':
        this.play('Idle');
        if (this.t >= this.recoverTime) { this.setState('hunt'); }
        break;
      case 'stagger':
        this.play('Stagger', { time: this.t });
        if (this.t >= 1.2) { this.cooldown = .6; this.setState('hunt'); }
        break;
      case 'reeling':
        this.play('Stagger', { time: this.t * .52 });
        if (this.t >= REEL) { this.cooldown = .8; this.setState('hunt'); }
        break;
      case 'topple':
        this.play('Topple', { time: this.t, fade: .15 });
        if (this.t >= 1.2) this.setState('down');
        break;
      case 'down':
        this.play('Down', { fade: .1 });
        if (this.t >= TOPPLE_DOWN) { this.setState('getup'); events.push({ type: 'rising' }); }
        break;
      case 'getup':
        this.play('GetUp', { time: this.t, fade: .1 });
        if (this.t >= 1.4) { this.cooldown = 1.2; this.setState('hunt'); }
        break;
      case 'return': {
        const want = Math.atan2(BED.x - this.x, BED.z - this.z); turn(want, 1.5); step(2.2); this.play('Walk', { speed: 1.4 });
        this.health = Math.min(this.maxHealth, this.health + dt * this.maxHealth * .2);
        if (Math.hypot(BED.x - this.x, BED.z - this.z) < 1.5) { this.reset(); events.push({ type: 'slept' }); }
        break;
      }
      case 'defeated':
        this.play('Death', { time: this.t, fade: .4 });
        this.setGlow(Math.max(0, 1 - this.t / 3));
        if (this.t >= 3.5) { this.setState('released'); this.released = 0; }
        break;
      case 'released':
        this.released += dt;
        if (this.current !== this.actions.Sleep) this.play('Death', { time: 3.5 });
        this.setGlow(0);
        if (this.mats.M_Eye) this.mats.M_Eye.emissive.lerp(new THREE.Color(0xffc56a), Math.min(1, dt * 1.5));
        break;
    }
    // Glow rises with the phase: the drained memories burn brighter as it weakens.
    if (this.alive && this.awake) this.setGlow((this.phase > 1 ? 1.8 : 1) * (this.enraged ? 1.4 : 1) + (this.flash ? 2 : 0));
    this.updateSpots(dt, p, ctx, events);
    this.updateTell(ct);
    this.place();
    this.mixer.update(dt);
    this.root.updateMatrixWorld(true);
    return events;
  }

  choose(dist, rel) {
    const behind = Math.abs(rel) > 1.7, side = Math.abs(rel) > 1.1, front = Math.abs(rel) < .8, options = [];
    const chargeReady = this.clock - (this.lastCharge ?? -99) > CHARGE_REST;
    for (const [name, a] of Object.entries(ATTACKS)) {
      if (a.phase && this.phase < a.phase) continue;
      if (dist < a.range[0] || dist > a.range[1]) continue;
      let w = 0;
      if (name === 'bite') w = front && dist < 6.5 ? 1.4 : 0;
      if (name === 'stomp') w = front ? (dist < 4.5 ? 1.2 : .7) : 0;
      if (name === 'sweep') w = behind || (Math.abs(rel) > 1.2 && dist < 6) ? 2.2 : 0;
      // The charge is its long-range answer, used sparingly; the pounce closes most gaps.
      if (name === 'charge') w = chargeReady && Math.abs(rel) < .6 && dist > 12 ? .8 : 0;
      if (name === 'pounce') w = Math.abs(rel) < .9 ? (dist < 12 ? 1.1 : .8) : 0;
      if (name === 'tailspin') w = dist < 8.5 ? (side ? 1.6 : this.phase > 1 ? 1 : .55) : 0;
      if (name === 'tailslam') w = front && dist > 4.5 ? 1.2 : 0;   // turns its back on you, so only from the front
      if (name === 'erupt') w = dist > 7 ? 1.3 : .5;
      if (name === this.lastAttack) w *= .45;              // rarely the same thing twice
      if (w > 0) options.push([name, w]);
    }
    options.push([null, dist > 9 ? .8 : .25]);           // sometimes it just keeps coming
    let r = Math.random() * options.reduce((s, [, w]) => s + w, 0);
    for (const [name, w] of options) if ((r -= w) <= 0) return name;
    return null;
  }
  begin(name, p, events) {
    this.attack = name; this.lastAttack = name; this.hitDone.clear();
    if (name === 'charge') { this.setState('charge'); this.chargeRun = false; this.ran = 0; this.lastCharge = this.clock; }
    else this.setState('attack');
    if (name === 'erupt') this.planEruption(p);
    events.push({ type: 'windup', attack: name });
  }
  runAttack(dt, p, ctx, events, dist, rel, toPlayer) {
    const a = ATTACKS[this.attack], ct = this.clipTime;
    this.play(a.clip, { time: ct, fade: .22 });
    // Wind-ups keep tracking the explorer, then commit.
    if (ct < a.windup * .8) this.heading += THREE.MathUtils.clamp(angleTo(this.heading, toPlayer), -1.3 * dt, 1.3 * dt);
    if (ct >= a.windup && !this.hitDone.has('go')) { this.hitDone.add('go'); events.push({ type: 'attack', attack: this.attack }); }
    for (const [from, to, dist2] of a.lunge || []) if (ct >= from && ct < to) {
      const f = this.forward(), gap = Math.hypot(p.x - this.x, p.z - this.z) - (a.close ?? this.radius + 1.2);
      const s = Math.min(dist2 / (to - from) * dt / this.pace, Math.max(0, gap)); this.x += f.x * s; this.z += f.z * s;
    }
    for (const v of this.damageVolumes()) {
      const key = v.ring ? 'ring' : this.attack === 'bite' ? (ct < 1.3 ? 'bite1' : 'bite2') : 'body';
      if (this.hitDone.has(key)) continue;
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      const inside = v.ring ? Math.abs(d - v.r) < .55 && ctx.playerGrounded : d < v.r + .35 && p.y < v.y + v.r + .3 && p.y + 1.8 > v.y - v.r;
      const weak = this.clubBroken && ['sweep', 'tailspin', 'tailslam'].includes(this.attack);
      if (inside) { this.hitDone.add(key); events.push({ type: 'strike', attack: this.attack, label: a.label, kind: weak ? 'light' : a.kind, damage: weak ? 1 : a.damage, ring: !!v.ring, x: v.x, z: v.z }); }
    }
    if (a.wave && ct >= a.impact[0] && !this.hitDone.has('wave')) {
      this.hitDone.add('wave'); const pt = this.impactPoint();
      events.push({ type: 'shockwave', point: pt, from: a.wave.from, to: a.wave.to, duration: a.wave.duration * this.pace });
    }
    if (ct >= a.dur) {
      const f = FOLLOW[this.attack], d = Math.hypot(p.x - this.x, p.z - this.z);
      if (f && !this.followed && d <= f[3] && Math.random() < (this.phase > 1 ? f[2] : f[1])) { this.followed = true; this.begin(f[0], p, events); return; }
      this.followed = false;
      this.recoverTime = .5 * this.pace; this.cooldown = (1.2 + Math.random() * 1.2) * (this.enraged ? .65 : 1); this.attack = null; this.setState('recover');
    }
  }
  runCharge(dt, p, ctx, events, toPlayer) {
    const a = ATTACKS.charge;
    if (!this.chargeRun) {
      // Wind-up: head raised, braced, scraping the ground.
      this.play('Erupt', { time: Math.min(.75, this.t * .85), fade: .2 });
      this.heading += THREE.MathUtils.clamp(angleTo(this.heading, toPlayer), -1.6 * dt, 1.6 * dt);
      if (this.t >= a.windup * this.pace) { this.chargeRun = true; this.runT = 0; events.push({ type: 'attack', attack: 'charge' }); }
      return;
    }
    this.runT += dt; this.play('Charge', { speed: 1.2, fade: .15 });
    if (this.runT < .45) this.heading += THREE.MathUtils.clamp(angleTo(this.heading, toPlayer), -.7 * dt, .7 * dt);
    const f = this.forward(), s = a.speed * Math.min(1, this.runT / .35) * dt; this.x += f.x * s; this.z += f.z * s; this.ran += s;
    for (const v of this.damageVolumes()) {
      if (this.hitDone.has('body')) break;
      if (Math.hypot(v.x - p.x, v.z - p.z) < v.r + .35) { this.hitDone.add('body'); events.push({ type: 'strike', attack: 'charge', label: a.label, kind: 'heavy', damage: a.damage, x: this.x, z: this.z }); }
    }
    const past = (p.x - this.x) * f.x + (p.z - this.z) * f.z < -4;
    if (this.runT >= a.run || Math.hypot(this.x - ARENA.x, this.z - ARENA.z) > ROAM - .3 || (past && this.runT > .8)) {
      this.chargeRun = false; this.attack = null; this.recoverTime = a.recover * this.pace; this.cooldown = 1 + Math.random(); this.setState('recover');
      events.push({ type: 'skid', x: this.x, z: this.z });
    }
  }

  // ------------------------------------------------------ root eruption
  planEruption(p) {
    const n = this.enraged ? 5 : 3, ang = Math.random() * Math.PI * 2;
    const offsets = [[0, 0], [Math.cos(ang) * 3, Math.sin(ang) * 3], [-Math.cos(ang) * 3, -Math.sin(ang) * 3], [Math.cos(ang + 1.6) * 4, Math.sin(ang + 1.6) * 4], [-Math.cos(ang + 1.6) * 4, -Math.sin(ang + 1.6) * 4]];
    this.plan = offsets.slice(0, n).map(([ox, oz], i) => ({ x: p.x + ox, z: p.z + oz, at: .3 + i * .2, follow: i === 0 }));
  }
  clearSpots() { for (const s of this.spots) { this.scene.remove(s.group); } this.spots = []; this.plan = null; }
  updateSpots(dt, p, ctx, events) {
    const ct = this.clipTime;
    if (this.plan && this.state === 'attack' && this.attack === 'erupt') {
      for (const s of this.plan) if (!s.made && ct >= s.at) {
        s.made = true;
        // The first root follows the explorer until it is committed.
        if (s.follow) { s.x = p.x; s.z = p.z; }
        this.spots.push(this.makeSpot(s.x, s.z));
      }
    }
    for (let i = this.spots.length - 1; i >= 0; i--) {
      const s = this.spots[i]; s.t += dt;
      const y = groundY(s.x, s.z);
      s.ring.material.opacity = s.t < s.burst ? .25 + .5 * Math.abs(Math.sin(s.t * 9)) : Math.max(0, .6 - (s.t - s.burst) * 2);
      s.ring.scale.setScalar(s.t < s.burst ? .6 + .4 * Math.min(1, s.t / .3) : 1);
      const rise = s.t < s.burst ? 0 : s.t < s.burst + .12 ? (s.t - s.burst) / .12 : s.t < s.burst + .9 ? 1 : Math.max(0, 1 - (s.t - s.burst - .9) / .4);
      s.spikes.scale.set(1, Math.max(.001, rise), 1); s.spikes.position.y = y - .2;
      if (s.t >= s.burst && s.t < s.burst + .22 && !s.hit && Math.hypot(p.x - s.x, p.z - s.z) < 1.7 && p.y < y + 2.4) {
        s.hit = true; events.push({ type: 'strike', attack: 'erupt', label: 'root eruption', kind: 'heavy', damage: 1, x: s.x, z: s.z });
      }
      if (s.t >= s.burst && !s.burstSent) { s.burstSent = true; events.push({ type: 'erupt', x: s.x, z: s.z }); }
      if (s.t > s.burst + 1.4) { this.scene.remove(s.group); this.spots.splice(i, 1); }
    }
  }
  makeSpot(x, z) {
    const group = new THREE.Group(), y = groundY(x, z); group.position.set(x, 0, z); this.scene.add(group);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.7, 40), new THREE.MeshBasicMaterial({ color: 0xf08a4b, transparent: true, opacity: .4, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = y + .08; group.add(ring);
    const spikes = new THREE.Group(); group.add(spikes);
    for (let i = 0; i < 6; i++) {
      const h = 1.6 + Math.random() * 1.4, m = new THREE.Mesh(new THREE.ConeGeometry(.22 + Math.random() * .12, h, 6), this.spikeMat);
      const a = i / 6 * Math.PI * 2 + Math.random() * .5, r = i ? .55 + Math.random() * .6 : 0;
      m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); m.rotation.set((Math.random() - .5) * .5, 0, (Math.random() - .5) * .5); m.castShadow = true; spikes.add(m);
    }
    spikes.scale.set(1, .001, 1);
    return { x, z, t: 0, burst: .85 * this.pace, group, ring, spikes, hit: false };
  }
  updateTell(ct) {
    const a = ATTACKS[this.attack];
    const warning = a && ((this.state === 'attack' && ct < a.windup) || (this.state === 'charge' && !this.chargeRun));
    const active = a && (this.state === 'attack' || this.chargeRun);
    this.tell.visible = !!(this.alive && active && this.attack !== 'erupt');
    if (!this.tell.visible) return;
    const reach = { bite: 5.2, stomp: 4.2, sweep: 8.4, charge: 3.4, tailspin: this.clubBroken ? 7.6 : 8.8, tailslam: 8.2, pounce: 3.4 }[this.attack] || 4;
    const w = warning ? Math.min(1, this.state === 'attack' ? ct / a.windup : this.t / (a.windup * this.pace)) : 1;
    this.tell.position.set(this.x, groundY(this.x, this.z) + .07, this.z);
    this.tell.scale.setScalar(reach * (warning ? .75 + .25 * w : 1));
    this.tell.material.color.setHex(warning ? 0xe9ad62 : 0xf27d56);
    this.tell.material.opacity = warning ? .2 + .45 * w : .7;
  }
}

/** Load the Warden and its arena. Resolves to { warden, arena }. */
export async function loadWardenAndArena(scene) {
  const loader = new GLTFLoader();
  const [wardenGLTF, arenaGLTF] = await Promise.all([
    loader.loadAsync(`${BASE}characters/warden/warden.glb`),
    loader.loadAsync(`${BASE}arena/warden-hollow.glb`)
  ]);
  const arena = arenaGLTF.scene, colliders = [];
  arena.position.set(ARENA.x, ARENA_Y, ARENA.z); scene.add(arena);
  let gateRoots = null; const lanterns = [];
  arena.traverse(o => {
    if (o.isMesh) { o.castShadow = o.name !== 'Plaza'; o.receiveShadow = true; }
    if (o.name === 'GateRoots') gateRoots = o;
    if (o.name === 'Lanterns') lanterns.push(o);
    if (/^COL_/.test(o.name) && o.userData.r) colliders.push({ x: ARENA.x + o.position.x, z: ARENA.z + o.position.z, r: o.userData.r, top: ARENA_Y + o.userData.h });
  });
  for (const [x, z] of [[-19.5, -4.2], [-19.5, 4.2]]) {
    const l = new THREE.PointLight(0xffd18a, 2.2, 14, 2); l.position.set(ARENA.x + x, ARENA_Y + 2.9, ARENA.z + z); scene.add(l);
  }
  arena.updateMatrixWorld(true);
  const warden = new Warden(scene, wardenGLTF);
  return { warden, arena, colliders, gateRoots };
}
