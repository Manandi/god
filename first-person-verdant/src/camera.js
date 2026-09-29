import * as THREE from 'three';

// Third-person shoulder camera. Adapted from the CameraRig in Rotten Souls by
// Igor John (MIT licence, https://github.com/igorjohn/rotten-souls): free orbit
// when roaming; on lock-on it swings behind the explorer, shifts to the
// shoulder so the explorer never hides the target, lowers itself for tall
// targets, and pulls the distance back so both fighters stay framed. It never
// passes through the world: a ray from the pivot shortens the arm on terrain,
// buildings, trees and rocks, snapping in at once and easing back out.
//
// Conventions here: yaw 0 looks toward -Z (the explorer's convention);
// elevation > 0 puts the camera above the pivot looking down.

const PIVOT_HEIGHT = 1.5, SHOULDER = .42, SHOULDER_LOCKED = .9;
export const MIN_ELEVATION = -.45, MAX_ELEVATION = 1.05;
const COLLISION_PAD = .32, MIN_DISTANCE = 1.1;
const approachAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, t);

export class ShoulderCamera {
  constructor(camera, { obstacles, grid }) {
    this.camera = camera; this.obstacles = obstacles; this.grid = grid;
    this.distance = 5; this.armLength = 5; this.shake = 0; this.shakeStrength = 0; this.cinematic = null;
    this.raycaster = new THREE.Raycaster();
    this.pivot = new THREE.Vector3(); this.desired = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.forward = new THREE.Vector3(); this.right = new THREE.Vector3(); this.dir = new THREE.Vector3();
  }
  punch(strength) { this.shakeStrength = Math.max(this.shakeStrength, strength); this.shake = .28; }
  /** A scripted shot (a boss intro); the shoulder view resumes from wherever it ends. */
  playCinematic({ from, to, lookFrom, lookTo, duration }) {
    this.cinematic = { t: 0, duration, from: from.clone(), to: to.clone(), lookFrom: lookFrom.clone(), lookTo: lookTo.clone() };
  }
  get inCinematic() { return !!this.cinematic; }

  /**
   * view: { yaw, elevation, zoom } — updated in place while locked on.
   * target: null, or { x, y, z, focus, big } (focus: height to aim at; big: a boss).
   */
  update(dt, pivotAt, view, target) {
    if (this.cinematic) return this.updateCinematic(dt);
    this.pivot.set(pivotAt.x, pivotAt.y + PIVOT_HEIGHT, pivotAt.z);
    let wantDistance = view.zoom;
    if (target) {
      const dx = target.x - pivotAt.x, dz = target.z - pivotAt.z, flat = Math.hypot(dx, dz);
      view.yaw = approachAngle(view.yaw, Math.atan2(-dx, -dz), dt * 7);
      const heightDelta = target.y + (target.focus ?? 1) - this.pivot.y;
      const wantElevation = THREE.MathUtils.clamp(-Math.atan2(heightDelta, Math.max(2.5, flat)) * .55 + .16, MIN_ELEVATION, MAX_ELEVATION);
      view.elevation += (wantElevation - view.elevation) * Math.min(1, dt * 5);
      wantDistance = Math.max(view.zoom, Math.min(target.big ? 9 : 6, 3.8 + flat * (target.big ? .3 : .14)));
    }
    this.armLength += (wantDistance - this.armLength) * Math.min(1, dt * 4);
    this.forward.set(-Math.sin(view.yaw), 0, -Math.cos(view.yaw));
    this.right.set(Math.cos(view.yaw), 0, -Math.sin(view.yaw));
    const shoulder = target ? SHOULDER_LOCKED : SHOULDER, cos = Math.cos(view.elevation);
    this.desired.copy(this.pivot).addScaledVector(this.right, shoulder).addScaledVector(this.forward, -this.armLength * cos);
    this.desired.y = this.pivot.y + this.armLength * Math.sin(view.elevation);
    // Collision: snap in immediately, ease back out, so walls never pop the view.
    const clear = this.clearance(this.pivot, this.desired);
    this.distance = clear < this.distance ? clear : this.distance + (clear - this.distance) * Math.min(1, dt * 3.5);
    this.dir.copy(this.desired).sub(this.pivot); const full = this.dir.length() || 1;
    this.desired.copy(this.pivot).addScaledVector(this.dir, Math.min(this.distance, full) / full);
    if (this.shake > 0) {
      this.shake -= dt; const amount = this.shakeStrength * Math.max(0, this.shake) * .6;
      this.desired.x += (Math.random() - .5) * amount; this.desired.y += (Math.random() - .5) * amount; this.desired.z += (Math.random() - .5) * amount;
      if (this.shake <= 0) this.shakeStrength = 0;
    }
    this.camera.position.copy(this.desired);
    this.look.copy(this.pivot); this.look.y += .2;
    if (target) this.look.lerp(new THREE.Vector3(target.x, target.y + (target.focus ?? 1), target.z), target.big ? .35 : .4);
    this.look.addScaledVector(this.right, shoulder);
    this.camera.lookAt(this.look);
  }

  /** How far the camera can sit from the pivot toward `to` before hitting the world. */
  clearance(from, to) {
    this.dir.copy(to).sub(from); const length = this.dir.length(); if (length < 1e-3) return length;
    this.dir.divideScalar(length);
    let best = length;
    this.raycaster.set(from, this.dir); this.raycaster.far = length;
    const hit = this.raycaster.intersectObjects(this.obstacles, false)[0];
    if (hit) best = Math.min(best, hit.distance - COLLISION_PAD);
    // Trunks, rocks, posts and walls are vertical cylinders in the collision grid.
    const seen = new Set();
    for (const s of [0, .5, 1]) for (const o of this.grid.near(from.x + this.dir.x * length * s, from.z + this.dir.z * length * s)) {
      if (seen.has(o)) continue; seen.add(o);
      const ox = from.x - o.x, oz = from.z - o.z, r = o.r + .2;
      const a = this.dir.x ** 2 + this.dir.z ** 2; if (a < 1e-6) continue;
      const b = 2 * (ox * this.dir.x + oz * this.dir.z), c = ox * ox + oz * oz - r * r, disc = b * b - 4 * a * c;
      if (c < 0 || disc < 0) continue;              // the pivot itself is inside (hugging a wall): ignore
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t > 0 && t < best && from.y + this.dir.y * t < o.top + .2) best = t - COLLISION_PAD;
    }
    return Math.max(MIN_DISTANCE, best);
  }

  updateCinematic(dt) {
    const shot = this.cinematic; shot.t += dt;
    const t = Math.min(1, shot.t / shot.duration), eased = t * t * (3 - 2 * t);
    this.camera.position.copy(shot.from).lerp(shot.to, eased);
    this.camera.lookAt(this.look.copy(shot.lookFrom).lerp(shot.lookTo, eased));
    if (t >= 1) this.cinematic = null;
  }
}
