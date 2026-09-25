import * as THREE from 'three';
import { groundY } from './world.js';
import { canOccupy } from './collision.js';

const shellMaterial = new THREE.MeshStandardMaterial({ color: 0x556f3b, roughness: .92, flatShading: true });
const scuteMaterial = new THREE.MeshStandardMaterial({ color: 0x9aaa5c, roughness: .9, flatShading: true });
const skinMaterial = new THREE.MeshStandardMaterial({ color: 0x7b9963, roughness: .92, flatShading: true });
const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x293c31, roughness: 1 });
const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xf0d397, emissive: 0x594322, roughness: .3 });
const thornMaterial = new THREE.MeshStandardMaterial({ color: 0x758e47, roughness: .9, flatShading: true });
const sphere = (radius = 1) => new THREE.IcosahedronGeometry(radius, 1);
function part(parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const damp = THREE.MathUtils.damp;

// Behaviour tuning per kind. Times in seconds, distances in metres.
const KINDS = {
  shellback: { size: .64, pace: 1, health: 160, poise: 12, walk: 1.0, chase: 2.3, turn: 3.2, notice: 12, spacing: 2.4, cooldown: [1.0, 2.0], biteRadius: .42 },
  thornling: { size: .57, pace: .8, health: 110, poise: 9, walk: 1.2, chase: 3.0, turn: 4.2, notice: 12, spacing: 2.2, cooldown: [.8, 1.6], biteRadius: .38 }
};
// The moveset. Each attack: wind-up (the telegraph), active, recovery (the
// punish window). `track` is how long the wind-up keeps turning toward the
// explorer before committing. `kind` decides the explorer's reaction:
// light → flinch (hyper-armour holds), heavy → knockdown.
const ATTACKS = {
  lunge: { windup: .82, track: .46, active: .3, recover: 1.12, range: [1.5, 3.4], damage: 1, kind: 'light', label: 'shell lunge' },
  spin:  { windup: .65, track: 0, active: 1.0, recover: 1.1, range: [0, 2.4], damage: 1, kind: 'light', label: 'shell spin' },
  slam:  { windup: .85, track: .55, active: .44, recover: 1.2, range: [.6, 2.9], damage: 2, kind: 'heavy', label: 'root slam' }
};
const PART_DAMAGE = { head: 1.3, shell: .7, belly: 2 };
const ENRAGE_AT = .4, TOPPLE_TIME = 3.2, RISE_TIME = .6;
// The slam's shockwave: radius over time. Rolling through it is safe; rolling
// away works only if you start early.
export const SHOCKWAVE = { start: .02, duration: .4, from: .5, to: 3.1 };
const shockwaveRadius = t => SHOCKWAVE.from + (SHOCKWAVE.to - SHOCKWAVE.from) * Math.min(1, Math.max(0, (t - SHOCKWAVE.start) / SHOCKWAVE.duration));

/**
 * A creature driven by explicit states:
 *   wander → alert → approach ⇄ circle → windup(attack) → attack → recover → …
 *   hits wear down poise; at zero it topples onto its back (belly exposed,
 *   Root Strike open), then rises. Heavy hits or enough damage make it
 *   stagger; light hits alone never cancel a committed attack.
 *   Below 40% health it enrages: shorter wind-ups and cooldowns.
 */
export class Creature {
  constructor(scene, x, z, type = 'shellback', options = {}) {
    const k = KINDS[type];
    this.kind = k; this.type = type; this.home = { x, z }; this.x = x; this.z = z;
    this.maxHealth = k.health; this.health = k.health; this.alive = true;
    this.poise = k.poise; this.poiseDelay = 0; this.flinchMeter = 0;
    this.respawnDelay = options.respawn ?? 0;
    this.heading = Math.random() * Math.PI * 2; this.speed = 0;
    this.state = 'wander'; this.t = 0; this.cooldown = 1; this.wanderTurn = 0;
    this.attack = null; this.attackYaw = 0; this.connected = false; this.enraged = false; this.combo = false;
    this.push = { x: 0, z: 0 }; this.flash = 0; this.shake = 0; this.jolt = { pitch: 0, roll: 0 };
    this.radius = 1.15 * k.size; this.legPhase = 0; this.spinAngle = 0;
    this.lastEvent = '';
    this.root = new THREE.Group(); scene.add(this.root);
    this.tilt = new THREE.Group(); this.root.add(this.tilt);       // follows the slope
    this.body = new THREE.Group(); this.tilt.add(this.body);       // rears, lunges, flinches
    this.root.scale.setScalar(k.size);
    this.shellMat = shellMaterial.clone(); this.skinMat = skinMaterial.clone(); this.eyeMat = eyeMaterial.clone();
    part(this.body, sphere(), this.skinMat, 0, .95, 0, 1.28, .58, 1.8);
    this.shell = part(this.body, new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.shellMat, 0, 1.05, -.27, 1.43, 1.22, 1.65);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399, r = .82 + .24 * (i % 2);
      const q = part(this.body, sphere(.23), scuteMaterial, Math.cos(a) * r, 1.89 - Math.abs(Math.cos(a)) * .17, Math.sin(a) * r - .25, 1.4, .55, 1.1); q.rotation.y = a;
    }
    this.legs = [];
    for (const xSide of [-1, 1]) for (const zSide of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(xSide * .86, .76, zSide * .89); this.body.add(leg);
      part(leg, sphere(.48), this.skinMat, xSide * .13, -.18, .14, .65, 1, .85);
      part(leg, sphere(.37), darkMaterial, xSide * .12, -.51, .32, .8, .34, 1.25);
      this.legs.push({ mesh: leg, phase: xSide * zSide > 0 ? 0 : Math.PI });
    }
    this.neck = new THREE.Group(); this.neck.position.set(0, 1.2, 1.2); this.body.add(this.neck);
    this.head = new THREE.Group(); this.neck.add(this.head);
    part(this.head, sphere(.65), this.skinMat, 0, 0, .36, 1.02, .78, 1.18);
    for (const xEye of [-.38, .38]) {
      part(this.head, sphere(.11), this.eyeMat, xEye, .23, .92);
      part(this.head, sphere(.05), darkMaterial, xEye, .23, 1.005);
    }
    if (type === 'thornling') {
      for (let i = -1; i <= 1; i++) { const thorn = part(this.body, new THREE.ConeGeometry(.25, .85, 5), thornMaterial, i * .7, 2.0, -.4); thorn.rotation.z = i * .24; }
      for (let i = 0; i < 4; i++) { const leaf = part(this.body, new THREE.ConeGeometry(.28, .8, 4), thornMaterial, (i % 2 ? 1 : -1) * 1.0, 1.5, i < 2 ? -.9 : .35); leaf.rotation.z = (i % 2 ? 1 : -1) * .6; }
    }
    // Health bar, only shown while the creature is hurt or targeted.
    this.bar = new THREE.Group(); this.bar.position.set(0, 2.9, 0); this.root.add(this.bar);
    const barBack = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .12), new THREE.MeshBasicMaterial({ color: 0x14201a, transparent: true, opacity: .7, depthTest: false }));
    this.barFill = new THREE.Mesh(new THREE.PlaneGeometry(1.52, .07), new THREE.MeshBasicMaterial({ color: 0xd6c07a, depthTest: false }));
    this.barFill.position.z = .001; barBack.renderOrder = 10; this.barFill.renderOrder = 11;
    this.bar.add(barBack, this.barFill); this.bar.visible = false;
    // Ground-level tell survives camera angle changes. Amber builds during
    // tracking, red marks the committed attack, pale green marks recovery.
    this.tell = new THREE.Mesh(new THREE.RingGeometry(.82, .91, 32), new THREE.MeshBasicMaterial({ color: 0xe9ad62, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.tell.rotation.x = -Math.PI / 2; this.tell.visible = false; scene.add(this.tell);
    this.place();
  }
  get toppled() { return this.state === 'toppled'; }
  /** Hurt volumes in world space. Upright: shell (two spheres) and head. On its back: the belly. */
  hurtVolumes() {
    const s = this.kind.size, out = [], f = new THREE.Vector3();
    if (this.state === 'toppled' || this.state === 'rising') {
      // On its back only the belly is offered; the head is tucked against the ground.
      f.set(0, 1.0, -.2).applyMatrix4(this.body.matrixWorld); out.push({ x: f.x, y: f.y, z: f.z, r: 1.15 * s, part: 'belly' });
      return out;
    } else {
      for (const [z, r] of [[.45, .98], [-.75, .98]]) {
        f.set(0, 1.05, z).applyMatrix4(this.body.matrixWorld); out.push({ x: f.x, y: f.y, z: f.z, r: r * s, part: 'shell' });
      }
    }
    this.head.getWorldPosition(f); f.addScaledVector(this.forward(), .35 * s);
    out.push({ x: f.x, y: f.y, z: f.z, r: .52 * s, part: 'head' });
    return out;
  }
  forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  place() {
    this.root.position.set(this.x, groundY(this.x, this.z), this.z);
    this.root.rotation.y = this.heading;
    this.root.updateMatrixWorld(true);
  }
  setState(state) { this.state = state; this.t = 0; }
  timing(a) { const m = (this.enraged ? .78 : 1) * this.kind.pace; return { windup: a.windup * m, recover: a.recover * (this.enraged ? .85 : 1) * this.kind.pace, track: a.track * m }; }

  /**
   * A strike from the explorer. Returns what happened so the game can show it:
   * { damage, effect: 'weak'|'armored'|'belly'|'normal', toppled, defeated, staggered }
   */
  hit({ damage, poise, fromX, fromZ, push, stagger, part }) {
    if (!this.alive) return null;
    const onBack = this.state === 'toppled' || this.state === 'rising';
    const mult = PART_DAMAGE[part] ?? 1;
    const dealt = damage * mult;
    this.health = Math.max(0, this.health - dealt);
    const d = Math.hypot(this.x - fromX, this.z - fromZ) || 1, dx = (this.x - fromX) / d, dz = (this.z - fromZ) / d;
    // Jolt away from the blow in the creature's own frame.
    const f = this.forward(); this.jolt.pitch += -(dx * f.x + dz * f.z) * .22 * (stagger + .3); this.jolt.roll += (dx * f.z - dz * f.x) * .22 * (stagger + .3);
    this.flash = .12; this.shake = .09 + stagger * .08;
    const out = { damage: dealt, effect: part === 'belly' ? 'belly' : mult > 1 ? 'weak' : mult < 1 ? 'armored' : 'normal', toppled: false, defeated: false, staggered: false };
    if (this.health <= 0) { this.alive = false; this.setState('defeated'); this.lastEvent = 'defeated'; out.defeated = true; return out; }
    if (this.health < this.maxHealth * ENRAGE_AT && !this.enraged) { this.enraged = true; this.enragedNow = true; }
    if (onBack) { this.lastEvent = 'struck while toppled'; return out; }
    this.push = { x: dx * push * .6, z: dz * push * .6 };
    this.poise -= poise; this.poiseDelay = 2.5; this.flinchMeter += dealt;
    if (this.poise <= 0) {
      this.poise = this.kind.poise; this.setState('toppled'); this.attack = null; this.lastEvent = 'TOPPLED';
      out.toppled = true; return out;
    }
    const committed = this.state === 'attack';
    if (stagger >= .6 || (this.flinchMeter >= 22 && !committed)) {
      this.flinchMeter = 0; this.staggerTime = stagger >= .6 ? .8 : .45; this.setState('stagger'); this.attack = null;
      this.lastEvent = 'staggered'; out.staggered = true;
    } else this.lastEvent = committed ? 'hit (kept attacking)' : 'flinched';
    return out;
  }

  /** Try to move; slide around obstacles and refuse slopes that are too steep. */
  travel(dx, dz, grid) {
    const r = this.radius * .8, step = Math.hypot(dx, dz);
    if (step < 1e-5) return true;
    const ok = (x, z) => canOccupy(x, z, groundY(x, z), grid, groundY, r) && Math.abs(groundY(x, z) - groundY(this.x, this.z)) < .9 * step + .12;
    if (ok(this.x + dx, this.z + dz)) { this.x += dx; this.z += dz; return true; }
    if (ok(this.x + dx, this.z)) { this.x += dx; return false; }
    if (ok(this.x, this.z + dz)) { this.z += dz; return false; }
    return false;
  }
  /** Heading toward `want` that is not blocked, checking wider angles if needed. */
  steer(want, grid) {
    const r = this.radius * .8;
    for (const offset of [0, .5, -.5, 1, -1, 1.6, -1.6]) {
      const h = want + offset, x = this.x + Math.sin(h) * 1.4, z = this.z + Math.cos(h) * 1.4;
      if (canOccupy(x, z, groundY(x, z), grid, groundY, r) && Math.abs(groundY(x, z) - groundY(this.x, this.z)) < 1.3) return h;
    }
    return want;
  }
  /** Pick an attack for the explorer's range and angle, or null. */
  chooseAttack(dist, rel) {
    const behind = Math.abs(rel) > 1.3;
    const options = [];
    for (const [name, a] of Object.entries(ATTACKS)) {
      if (dist < a.range[0] || dist > a.range[1]) continue;
      let w = 1;
      if (name === 'lunge') w = behind ? 0 : Math.abs(rel) < .5 ? 1.4 : .6;
      if (name === 'spin') w = behind || dist < 1.4 ? 2.4 : .35;
      if (name === 'slam') w = behind ? 0 : Math.abs(rel) < .8 ? (this.enraged ? 1.4 : .9) : 0;
      if (w > 0) options.push([name, w]);
    }
    let r = Math.random() * options.reduce((s, [, w]) => s + w, 0);
    for (const [name, w] of options) { if ((r -= w) <= 0) return name; }
    return null;
  }

  update(dt, time, ctx) {
    const events = [], k = this.kind, p = ctx.player;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt); this.shake = Math.max(0, this.shake - dt);
    this.jolt.pitch = damp(this.jolt.pitch, 0, 9, dt); this.jolt.roll = damp(this.jolt.roll, 0, 9, dt);
    if (this.enragedNow) { this.enragedNow = false; events.push({ type: 'enrage' }); }
    if (this.state === 'defeated') {
      this.tell.visible = false;
      this.body.rotation.z = damp(this.body.rotation.z, Math.PI * .92, 7, dt);
      this.body.position.y = damp(this.body.position.y, this.t > .9 ? -2.4 : .4, this.t > .9 ? 2 : 9, dt);
      if (this.t > 2.2) this.root.visible = false;
      if (this.respawnDelay && this.t > this.respawnDelay) this.respawn();
      this.bar.visible = false;
      return events;
    }
    // Poise recovers once the creature has had a moment without being hit.
    this.poiseDelay -= dt; if (this.poiseDelay <= 0) this.poise = Math.min(k.poise, this.poise + dt * 4);
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz), rel = angleTo(this.heading, toPlayer);
    let wantHeading = this.heading, wantSpeed = 0, turn = k.turn, moveYaw = null;
    this.cooldown -= dt;

    switch (this.state) {
      case 'wander':
        this.wanderTurn -= dt;
        if (this.wanderTurn <= 0) { this.wanderTurn = 2 + Math.random() * 2.5; this.wanderHeading = this.heading + (Math.random() - .5) * 2.4; }
        if (Math.hypot(this.x - this.home.x, this.z - this.home.z) > 8) this.wanderHeading = Math.atan2(this.home.x - this.x, this.home.z - this.z);
        wantHeading = this.wanderHeading ?? this.heading; wantSpeed = k.walk; turn = 1.4;
        if (dist < k.notice) { this.setState('alert'); events.push({ type: 'alert' }); }
        break;
      case 'alert':
        wantHeading = toPlayer; turn = 5;
        if (this.t > .5) this.setState('approach');
        break;
      case 'approach':
        wantHeading = this.steer(toPlayer, ctx.grid); wantSpeed = k.chase * THREE.MathUtils.clamp((dist - k.spacing) / 1.5, .25, 1);
        if (dist < k.spacing + .3) this.setState('circle');
        if (dist > k.notice * 1.6) this.setState('wander');
        if (this.cooldown <= 0 && dist < 3.4) this.beginAttack(dist, rel, events);
        break;
      case 'circle': {
        // Hold spacing and face the explorer; turn in place when flanked.
        const side = Math.sin(time * .7 + this.home.x) > 0 ? 1 : -1;
        wantHeading = toPlayer;
        if (Math.abs(rel) > .9) { wantSpeed = 0; turn = k.turn * 1.25; }
        else if (dist < k.spacing - .6) { moveYaw = toPlayer + Math.PI; wantSpeed = k.walk * .9; }
        else { moveYaw = toPlayer + side * 1.6; wantSpeed = k.walk * .45; }
        if (dist > k.spacing + 1.4) this.setState('approach');
        else if (this.cooldown <= 0) this.beginAttack(dist, rel, events);
        break;
      }
      case 'windup': {
        const a = ATTACKS[this.attack], tm = this.timing(a);
        if (this.t < tm.track) { wantHeading = toPlayer; turn = 4.5; } else turn = 0;
        if (this.t >= tm.windup) { this.attackYaw = this.heading; this.connected = false; this.closest = 9; this.setState('attack'); events.push({ type: 'attack', attack: this.attack }); }
        break;
      }
      case 'attack':
        turn = 0;
        this.runAttack(dt, p, ctx, events, dx, dz);
        break;
      case 'recover': {
        turn = .6;
        if (this.t >= this.timing(ATTACKS[this.attack]).recover) {
          this.cooldown = k.cooldown[0] + Math.random() * (k.cooldown[1] - k.cooldown[0]);
          if (this.enraged) this.cooldown *= .65;
          this.setState(dist < k.spacing + 1 ? 'circle' : 'approach');
        }
        break;
      }
      case 'stagger':
        turn = 0;
        if (this.t >= this.staggerTime) { this.cooldown = Math.max(this.cooldown, .4); this.setState(dist < k.spacing + 1 ? 'circle' : 'approach'); }
        break;
      case 'toppled':
        turn = 0;
        if (this.t >= TOPPLE_TIME) { this.setState('rising'); events.push({ type: 'rising' }); }
        break;
      case 'rising':
        turn = 0;
        if (this.t >= RISE_TIME) { this.cooldown = .6; this.setState('circle'); }
        break;
    }

    if (turn > 0) this.heading += THREE.MathUtils.clamp(angleTo(this.heading, wantHeading), -turn * dt, turn * dt);
    this.speed = damp(this.speed, wantSpeed, 6, dt);
    if (this.state !== 'attack' && this.speed > .01) {
      const yaw = moveYaw ?? this.heading;
      this.travel(Math.sin(yaw) * this.speed * dt, Math.cos(yaw) * this.speed * dt, ctx.grid);
    }
    if (Math.hypot(this.push.x, this.push.z) > .001) {
      const f = 1 - Math.exp(-11 * dt);
      this.travel(this.push.x * f, this.push.z * f, ctx.grid);
      this.push.x *= 1 - f; this.push.z *= 1 - f;
    }
    this.animate(dt, time);
    return events;
  }

  beginAttack(dist, rel, events) {
    const name = this.chooseAttack(dist, rel);
    if (!name) return;
    this.attack = name; this.setState('windup');
    events.push({ type: 'windup', attack: name });
  }

  /** The active part of each attack, with its own damage volume. */
  runAttack(dt, p, ctx, events, dx, dz) {
    const a = ATTACKS[this.attack], k = this.kind, s = k.size;
    const strike = (extra = {}) => {
      if (this.connected) return;
      this.connected = true;
      events.push({ type: 'strike', attack: this.attack, label: a.label, kind: a.kind, damage: a.damage, x: this.x, z: this.z, ...extra });
    };
    if (this.attack === 'lunge') {
      const frac = Math.min(1, this.t / a.active), prev = Math.max(0, (this.t - dt) / a.active);
      let step = ((1 - (1 - frac) ** 2) - (1 - (1 - prev) ** 2)) * 2.8;
      const ahead = dx * Math.sin(this.attackYaw) + dz * Math.cos(this.attackYaw);
      const lateral = Math.abs(dx * Math.cos(this.attackYaw) - dz * Math.sin(this.attackYaw));
      if (lateral < this.radius + .35) step = Math.min(step, Math.max(0, ahead - this.radius - .38));
      this.travel(Math.sin(this.attackYaw) * step, Math.cos(this.attackYaw) * step, ctx.grid);
      if (this.t >= .04 && this.t <= .25) {
        const bite = this.damageVolumes()[0];
        const gap = Math.hypot(bite.x - p.x, bite.z - p.z) - (bite.r + .34);
        if (gap <= 0 && bite.y > p.y + .1 && bite.y < p.y + 1.8) strike();
        else this.closest = Math.min(this.closest, gap);
      }
    } else if (this.attack === 'spin') {
      this.spinAngle += dt * 17;
      const v = this.damageVolumes()[0];
      const gap = Math.hypot(v.x - p.x, v.z - p.z) - (v.r + .34);
      if (gap <= 0 && p.y < v.y + 1.2) strike();
      else this.closest = Math.min(this.closest, gap);
    } else if (this.attack === 'slam') {
      // The shell hits the ground, then a shockwave ring rolls outward: roll
      // through it or jump over it.
      for (const v of this.damageVolumes()) {
        const d = Math.hypot(v.x - p.x, v.z - p.z);
        const inside = v.ring ? Math.abs(d - v.r) < .45 && ctx.playerGrounded : d < v.r + .34;
        if (inside) strike({ ring: !!v.ring });
        else this.closest = Math.min(this.closest, v.ring ? Math.abs(d - v.r) - .45 : d - v.r - .34);
      }
    }
    if (this.t >= a.active) {
      if (!this.connected) events.push({ type: 'missed', attack: this.attack, label: a.label, gap: this.closest ?? 9 });
      this.setState('recover');
    }
  }
  /** Damage volumes for the current attack (debug draws these). */
  damageVolumes() {
    const s = this.kind.size, f = new THREE.Vector3();
    if (this.attack === 'lunge') {
      this.head.getWorldPosition(f); f.addScaledVector(this.forward(), .5 * s);
      return [{ x: f.x, y: f.y, z: f.z, r: this.kind.biteRadius }];
    }
    if (this.attack === 'spin') {
      const g = groundY(this.x, this.z);
      return [{ x: this.x, y: g + .5, z: this.z, r: this.radius + .55 }];
    }
    if (this.attack === 'slam') {
      const fw = this.forward(), cx = this.x + fw.x * 1.0 * s, cz = this.z + fw.z * 1.0 * s, g = groundY(cx, cz);
      const out = [];
      if (this.state !== 'attack') return out;
      if (this.t < .1) out.push({ x: cx, y: g + .3, z: cz, r: .75 });
      if (this.t >= .02) out.push({ x: cx, y: g + .1, z: cz, r: shockwaveRadius(this.t), ring: true });
      return out;
    }
    return [];
  }

  animate(dt, time) {
    this.place();
    const s = this.kind.size * 1.1, h = this.heading;
    const fx = Math.sin(h) * s, fz = Math.cos(h) * s, rx = Math.cos(h) * s, rz = -Math.sin(h) * s;
    const pitch = Math.atan2(groundY(this.x - fx, this.z - fz) - groundY(this.x + fx, this.z + fz), 2 * s);
    const roll = Math.atan2(groundY(this.x + rx, this.z + rz) - groundY(this.x - rx, this.z - rz), 2 * s);
    this.tilt.rotation.x = damp(this.tilt.rotation.x, pitch, 10, dt);
    this.tilt.rotation.z = damp(this.tilt.rotation.z, roll, 10, dt);
    const st = this.state, t = this.t, a = this.attack ? ATTACKS[this.attack] : null, tm = a ? this.timing(a) : null;
    let rear = 0, headOut = 0, headLow = 0, glow = 0, lean = 0, lift = 0, flip = 0, spin = 0, legsIn = 0, legRate = 1;
    if (st === 'alert') { rear = -.12 * Math.sin(Math.min(1, t / .5) * Math.PI); headOut = .15; }
    if (st === 'windup') {
      const w = Math.min(1, t / tm.windup); glow = w * w;
      if (this.attack === 'lunge') { rear = -.28 * w; headOut = -.35 * w; }
      if (this.attack === 'spin') { headOut = -.6 * w; legsIn = w; spin = Math.sin(t * 40) * .06 * w; }    // retract and rattle
      if (this.attack === 'slam') { rear = -.75 * w; lift = .9 * w; headOut = .2 * w; }                     // rear up high
    }
    if (st === 'attack') {
      glow = .7;
      if (this.attack === 'lunge') { rear = .16; headOut = .45; }
      if (this.attack === 'spin') { headOut = -.6; legsIn = 1; spin = this.spinAngle; }
      if (this.attack === 'slam') { const k = Math.min(1, t / .07); rear = -.75 + .95 * k; lift = .9 * (1 - k); }
    }
    if (st === 'recover') { rear = .06; headOut = .1; headLow = -.25 + Math.sin(time * 5) * .03; legRate = .5; }
    if (st === 'stagger') { lean = Math.sin(t * 28) * .12 * Math.max(0, 1 - t / this.staggerTime); rear = .1; headOut = -.2; }
    if (st === 'toppled') { flip = 1; legRate = 3; headOut = Math.sin(time * 6) * .15; }
    if (st === 'rising') { flip = 1 - Math.min(1, t / RISE_TIME); }
    this.body.rotation.x = damp(this.body.rotation.x, rear + this.jolt.pitch, st === 'attack' ? 22 : 10, dt);
    this.body.rotation.z = damp(this.body.rotation.z, lean + this.jolt.roll + flip * Math.PI, flip ? 9 : 20, dt);
    this.body.rotation.y = st === 'attack' && this.attack === 'spin' ? spin : damp(this.body.rotation.y, spin, 12, dt);
    this.body.position.y = damp(this.body.position.y, lift + flip * 2.3 + Math.sin(time * 7) * .01, 12, dt);
    this.neck.position.z = damp(this.neck.position.z, 1.2 + headOut, st === 'attack' ? 26 : 12, dt);
    this.neck.position.y = damp(this.neck.position.y, 1.2 + headLow, 10, dt);
    const moving = st === 'attack' && this.attack === 'lunge' ? 2.2 : st === 'toppled' ? 1 : Math.min(1, (this.speed + (st === 'circle' ? .6 : 0)) / 2);
    this.legPhase += dt * (4 + this.speed * 4.5) * legRate;
    this.legs.forEach(({ mesh, phase }) => {
      mesh.rotation.x = Math.sin(this.legPhase + phase) * .5 * moving;
      mesh.scale.setScalar(damp(mesh.scale.x, 1 - legsIn * .55, 14, dt));
    });
    const rage = this.enraged ? 1 : 0;
    this.shellMat.emissive.setRGB(.55 * glow + this.flash * 3, .28 * glow + this.flash * 3, .05 * glow + this.flash * 3);
    this.skinMat.emissive.setScalar(this.flash * 2.5);
    this.eyeMat.emissive.setRGB(.35 + glow * .8 + rage * .9, (.26 + glow * .4) * (1 - rage * .8), .13 * (1 - rage));
    this.tell.visible = this.alive && (st === 'windup' || st === 'attack' || st === 'recover');
    if (this.tell.visible) {
      const warning = st === 'windup', w = warning ? Math.min(1, t / tm.windup) : 1;
      // The spin's danger zone is wider than the body; size the tell to match.
      const reach = this.attack === 'spin' ? (this.radius + .55) / this.radius : 1;
      this.tell.position.set(this.x, groundY(this.x, this.z) + .065, this.z);
      this.tell.scale.setScalar(this.radius * reach * (warning ? .9 + .45 * w : st === 'attack' ? 1.42 : 1.18));
      this.tell.material.color.setHex(warning ? 0xe9ad62 : st === 'attack' ? 0xf27d56 : 0xb9d892);
      this.tell.material.opacity = warning ? .25 + .45 * w : st === 'attack' ? .75 : .3;
    }
    if (this.shake > 0) { this.root.position.x += (Math.random() - .5) * .07; this.root.position.z += (Math.random() - .5) * .07; }
    this.root.updateMatrixWorld(true);
  }
  showBar(visible, camera) {
    this.bar.visible = visible && this.alive && this.state !== 'toppled' && this.state !== 'rising';
    if (!this.bar.visible) return;
    this.bar.quaternion.copy(this.root.quaternion).invert().multiply(camera.quaternion);
    const f = this.health / this.maxHealth;
    this.barFill.scale.x = Math.max(.001, f); this.barFill.position.x = -.76 * (1 - f);
    this.barFill.material.color.set(this.enraged ? 0xe0805a : 0xd6c07a);
  }
  respawn() {
    this.alive = true; this.health = this.maxHealth; this.poise = this.kind.poise; this.enraged = false;
    this.x = this.home.x; this.z = this.home.z;
    this.root.visible = true; this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0);
    this.setState('wander'); this.cooldown = 1.5; this.push = { x: 0, z: 0 }; this.attack = null;
  }
}

export function createCreatures(scene) {
  // The first shellback waits on the open slope below the camp so the first
  // fight happens on readable ground. It returns a few seconds after defeat.
  const list = [new Creature(scene, 1, 27, 'shellback', { respawn: 6 })];
  for (const [x, z, type] of [[-17, -1, 'shellback'], [-44, -30, 'thornling'], [-20, -73, 'shellback'], [33, -56, 'shellback'], [52, -106, 'thornling'], [8, -125, 'shellback'], [4, -169, 'thornling']])
    list.push(new Creature(scene, x, z, type));
  return list;
}
