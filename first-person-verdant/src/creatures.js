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
  shellback: { size: .64, health: 6, walk: 1.0, chase: 2.3, turn: 3.2, notice: 12, spacing: 2.5, attackRange: 3.3,
    windup: .75, track: .5, lunge: .3, lungeDistance: 2.8, bite: [.04, .25], recover: .95, cooldown: [1.1, 2.2], biteRadius: .42 },
  thornling: { size: .57, health: 4, walk: 1.2, chase: 3.0, turn: 4.2, notice: 12, spacing: 2.2, attackRange: 3.0,
    windup: .58, track: .38, lunge: .26, lungeDistance: 2.4, bite: [.03, .22], recover: .75, cooldown: [.9, 1.8], biteRadius: .38 }
};

/**
 * A creature driven by explicit states:
 *   wander → alert → approach ⇄ circle → windup → lunge → recover → approach …
 *   any state except lunge → stagger when struck;  health 0 → defeated
 * The windup is the readable telegraph: the creature rears, pulls its head in
 * and its shell glows. It tracks the explorer for the first part of the windup,
 * then commits to that line, which is what makes a sidestep work.
 */
export class Creature {
  constructor(scene, x, z, type = 'shellback', options = {}) {
    const k = KINDS[type];
    this.kind = k; this.type = type; this.home = { x, z }; this.x = x; this.z = z;
    this.maxHealth = k.health; this.health = k.health; this.alive = true;
    this.respawnDelay = options.respawn ?? 0; this.deadTime = 0;
    this.heading = Math.random() * Math.PI * 2; this.speed = 0;
    this.state = 'wander'; this.t = 0; this.cooldown = 1; this.wanderTurn = 0;
    this.lungeYaw = 0; this.bitten = false;
    this.push = { x: 0, z: 0 }; this.flash = 0; this.shake = 0;
    this.radius = 1.15 * k.size; this.legPhase = 0;
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
    this.place();
  }
  /** Hurt volumes in world space: the shell (two spheres) and the head. */
  hurtVolumes() {
    const s = this.kind.size, out = [];
    const f = new THREE.Vector3();
    for (const [z, r, part] of [[.45, .98, 'shell'], [-.75, .98, 'shell']]) {
      f.set(0, 1.05, z).applyMatrix4(this.body.matrixWorld); out.push({ x: f.x, y: f.y, z: f.z, r: r * s, part });
    }
    this.head.getWorldPosition(f); f.addScaledVector(this.forward(), .35 * s);
    out.push({ x: f.x, y: f.y, z: f.z, r: .6 * s, part: 'head' });
    return out;
  }
  forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  place() {
    const g = groundY(this.x, this.z);
    this.root.position.set(this.x, g, this.z);
    this.root.rotation.y = this.heading;
    this.root.updateMatrixWorld(true);
  }
  setState(state) { this.state = state; this.t = 0; }

  hit(damage, fromX, fromZ, push, stagger) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - damage);
    const d = Math.hypot(this.x - fromX, this.z - fromZ) || 1;
    // A lunge carries through a light hit; everything else is interrupted.
    const armoured = this.state === 'lunge' && stagger < .6;
    this.push = { x: (this.x - fromX) / d * push * (armoured ? .3 : 1), z: (this.z - fromZ) / d * push * (armoured ? .3 : 1) };
    this.flash = .14; this.shake = .1;
    if (this.health <= 0) { this.alive = false; this.setState('defeated'); this.lastEvent = 'defeated'; return true; }
    if (!armoured) { this.setState('stagger'); this.staggerTime = stagger; }
    this.lastEvent = armoured ? 'hit (kept lunging)' : 'staggered';
    return true;
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

  update(dt, time, ctx) {
    const events = [], k = this.kind, p = ctx.player;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt); this.shake = Math.max(0, this.shake - dt);
    if (this.state === 'defeated') {
      this.body.rotation.z = damp(this.body.rotation.z, Math.PI * .92, 7, dt);
      this.body.position.y = damp(this.body.position.y, this.t > .9 ? -2.4 : .4, this.t > .9 ? 2 : 9, dt);
      if (this.t > 2.2) this.root.visible = false;
      if (this.respawnDelay && this.t > this.respawnDelay) this.respawn();
      this.bar.visible = false;
      return events;
    }
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz);
    let wantHeading = this.heading, wantSpeed = 0, turn = k.turn;
    this.cooldown -= dt;

    switch (this.state) {
      case 'wander':
        this.wanderTurn -= dt;
        if (this.wanderTurn <= 0) { this.wanderTurn = 2 + Math.random() * 2.5; this.wanderHeading = this.heading + (Math.random() - .5) * 2.4; }
        if (Math.hypot(this.x - this.home.x, this.z - this.home.z) > 8) this.wanderHeading = Math.atan2(this.home.x - this.x, this.home.z - this.z);
        wantHeading = this.wanderHeading ?? this.heading; wantSpeed = k.walk; turn = 1.4;
        if (dist < k.notice) { this.setState('alert'); events.push({ type: 'alert' }); }
        break;
      case 'alert':           // a short beat to turn and notice
        wantHeading = toPlayer; turn = 5;
        if (this.t > .5) this.setState('approach');
        break;
      case 'approach':
        wantHeading = this.steer(toPlayer, ctx.grid); wantSpeed = k.chase * THREE.MathUtils.clamp((dist - k.spacing) / 1.5, .25, 1);
        if (dist < k.spacing + .3) this.setState('circle');
        if (dist > k.notice * 1.6) this.setState('wander');
        break;
      case 'circle': {         // hold spacing, edging sideways, until ready to strike
        const side = Math.sin(time * .7 + this.home.x) > 0 ? 1 : -1;
        wantHeading = toPlayer + side * .9 * (dist < k.spacing - .4 ? 1.6 : 1);
        wantSpeed = dist < k.spacing - .6 ? k.walk * .9 : k.walk * .45;
        if (dist < k.spacing - .6) wantHeading = toPlayer + Math.PI; // back off if crowded
        if (dist > k.attackRange + .6) this.setState('approach');
        else if (this.cooldown <= 0 && dist < k.attackRange && Math.abs(angleTo(this.heading, toPlayer)) < 1.2) {
          this.setState('windup'); events.push({ type: 'windup' });
        }
        break;
      }
      case 'windup':
        // Track the explorer, then lock the line for the rest of the telegraph.
        if (this.t < k.track) { wantHeading = toPlayer; turn = 4.5; } else turn = 0;
        if (this.t >= k.windup) { this.lungeYaw = this.heading; this.bitten = false; this.setState('lunge'); events.push({ type: 'lunge' }); }
        break;
      case 'lunge': {
        turn = 0;
        const frac = this.t / k.lunge, eased = 1 - (1 - Math.min(1, frac)) ** 2;
        const prevEased = 1 - (1 - Math.max(0, (this.t - dt) / k.lunge)) ** 2;
        let step = (eased - prevEased) * k.lungeDistance;
        // Stop at the explorer's body rather than passing through it.
        const ahead = dx * Math.sin(this.lungeYaw) + dz * Math.cos(this.lungeYaw);
        const lateral = Math.abs(dx * Math.cos(this.lungeYaw) - dz * Math.sin(this.lungeYaw));
        if (lateral < this.radius + .35) step = Math.min(step, Math.max(0, ahead - this.radius - .38));
        this.travel(Math.sin(this.lungeYaw) * step, Math.cos(this.lungeYaw) * step, ctx.grid);
        if (!this.bitten && this.t >= k.bite[0] && this.t <= k.bite[1]) {
          const bite = this.biteSphere();
          const gap = Math.hypot(bite.x - p.x, bite.z - p.z) - (bite.r + .34);
          const within = gap <= 0 && bite.y > p.y + .1 && bite.y < p.y + 1.8;
          if (within) {
            this.bitten = true;
            events.push({ type: ctx.playerInvulnerable ? 'evaded' : 'bite', x: this.x, z: this.z });
          } else this.closest = Math.min(this.closest ?? 9, gap);
        }
        if (this.t >= k.lunge) {
          if (!this.bitten) events.push({ type: 'missed', gap: this.closest ?? 9 });
          this.closest = undefined;
          this.setState('recover');
        }
        break;
      }
      case 'recover':          // the punish window: winded, head low, slow to turn
        turn = .6;
        if (this.t >= k.recover) { this.cooldown = k.cooldown[0] + Math.random() * (k.cooldown[1] - k.cooldown[0]); this.setState(dist < k.attackRange ? 'circle' : 'approach'); }
        break;
      case 'stagger':
        turn = 0;
        if (this.t >= this.staggerTime) { this.cooldown = Math.max(this.cooldown, .5); this.setState(dist < k.attackRange ? 'circle' : 'approach'); }
        break;
    }

    // Turn at a limited rate; circle faces the explorer while stepping sideways.
    const faceTarget = this.state === 'circle' ? toPlayer : wantHeading;
    if (turn > 0) this.heading += THREE.MathUtils.clamp(angleTo(this.heading, faceTarget), -turn * dt, turn * dt);
    this.speed = damp(this.speed, wantSpeed, 6, dt);
    if (this.state !== 'lunge') {
      const moveYaw = this.state === 'circle' ? wantHeading : this.heading;
      if (this.speed > .01) this.travel(Math.sin(moveYaw) * this.speed * dt, Math.cos(moveYaw) * this.speed * dt, ctx.grid);
    }
    // Knockback from hits decays quickly and still respects obstacles.
    if (Math.hypot(this.push.x, this.push.z) > .001) {
      const f = 1 - Math.exp(-11 * dt);
      this.travel(this.push.x * f, this.push.z * f, ctx.grid);
      this.push.x *= 1 - f; this.push.z *= 1 - f;
    }
    this.animate(dt, time);
    return events;
  }
  biteSphere() {
    const f = new THREE.Vector3(); this.head.getWorldPosition(f);
    f.addScaledVector(this.forward(), .5 * this.kind.size);
    return { x: f.x, y: f.y, z: f.z, r: this.kind.biteRadius };
  }

  animate(dt, time) {
    this.place();
    // Align to the slope under the shell so feet stay on the ground.
    const s = this.kind.size * 1.1, h = this.heading;
    const fx = Math.sin(h) * s, fz = Math.cos(h) * s, rx = Math.cos(h) * s, rz = -Math.sin(h) * s;
    const pitch = Math.atan2(groundY(this.x - fx, this.z - fz) - groundY(this.x + fx, this.z + fz), 2 * s);
    const roll = Math.atan2(groundY(this.x + rx, this.z + rz) - groundY(this.x - rx, this.z - rz), 2 * s);
    this.tilt.rotation.x = damp(this.tilt.rotation.x, pitch, 10, dt);
    this.tilt.rotation.z = damp(this.tilt.rotation.z, roll, 10, dt);
    const k = this.kind, st = this.state, t = this.t;
    let rear = 0, headOut = 0, headLow = 0, glow = 0, lean = 0;
    if (st === 'alert') { rear = -.12 * Math.sin(Math.min(1, t / .5) * Math.PI); headOut = .15; }
    if (st === 'windup') { const w = Math.min(1, t / k.windup); rear = -.28 * w; headOut = -.35 * w; glow = w * w; }
    if (st === 'lunge') { rear = .16; headOut = .45; glow = .6; }
    if (st === 'recover') { rear = .06; headOut = .1; headLow = -.25 + Math.sin(time * 5) * .03; }
    if (st === 'stagger') { lean = Math.sin(t * 28) * .12 * Math.max(0, 1 - t / this.staggerTime); rear = .1; headOut = -.2; }
    this.body.rotation.x = damp(this.body.rotation.x, rear, st === 'lunge' ? 22 : 10, dt);
    this.body.rotation.z = damp(this.body.rotation.z, lean, 20, dt);
    this.body.position.y = damp(this.body.position.y, Math.sin(time * 7) * .01, 10, dt);
    this.neck.position.z = damp(this.neck.position.z, 1.2 + headOut, st === 'lunge' ? 26 : 12, dt);
    this.neck.position.y = damp(this.neck.position.y, 1.2 + headLow, 10, dt);
    // Walk cycle scaled by ground speed.
    const moving = st === 'lunge' ? 2.2 : Math.min(1, this.speed / 2);
    this.legPhase += dt * (4 + this.speed * 4.5);
    this.legs.forEach(({ mesh, phase }) => { mesh.rotation.x = Math.sin(this.legPhase + phase) * .5 * moving; });
    this.shellMat.emissive.setRGB(.55 * glow + this.flash * 3, .28 * glow + this.flash * 3, .05 * glow + this.flash * 3);
    this.skinMat.emissive.setScalar(this.flash * 2.5);
    this.eyeMat.emissive.setRGB(.35 + glow * .8, .26 + glow * .4, .13);
    // A small shudder on impact reads as weight without shaking the camera.
    if (this.shake > 0) { this.root.position.x += (Math.random() - .5) * .07; this.root.position.z += (Math.random() - .5) * .07; }
    this.root.updateMatrixWorld(true);
  }
  showBar(visible, camera) {
    this.bar.visible = visible && this.alive;
    if (!this.bar.visible) return;
    this.bar.quaternion.copy(this.root.quaternion).invert().multiply(camera.quaternion);
    const f = this.health / this.maxHealth;
    this.barFill.scale.x = Math.max(.001, f); this.barFill.position.x = -.76 * (1 - f);
  }
  respawn() {
    this.alive = true; this.health = this.maxHealth; this.x = this.home.x; this.z = this.home.z;
    this.root.visible = true; this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0);
    this.setState('wander'); this.cooldown = 1.5; this.push = { x: 0, z: 0 };
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
