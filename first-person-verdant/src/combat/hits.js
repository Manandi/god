import * as THREE from 'three';

const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();

/** World-space striking segment for a move's hitbox, taken from the posed skeleton. */
export function strikeSegment(bones, hitbox, out = { a: new THREE.Vector3(), b: new THREE.Vector3() }) {
  bones[hitbox.from].getWorldPosition(a);
  bones[hitbox.to].getWorldPosition(b);
  d.copy(b).sub(a).normalize();
  out.a.copy(a).lerp(b, .35);                    // the striking half of the limb
  out.b.copy(b).addScaledVector(d, hitbox.extend);
  return out;
}

export function closestOnSegment(p, s0, s1, out = new THREE.Vector3()) {
  d.copy(s1).sub(s0);
  const t = THREE.MathUtils.clamp(a.copy(p).sub(s0).dot(d) / Math.max(1e-9, d.lengthSq()), 0, 1);
  return out.copy(s0).addScaledVector(d, t);
}

/**
 * Sweeps the striking segment from last frame's pose to this frame's pose and
 * returns the first contact against each target's hurt volumes. Sweeping keeps
 * fast strikes from passing through a target between two frames.
 */
export function sweep(prev, cur, radius, targets) {
  const contacts = [];
  let nearest = Infinity;
  const s0 = new THREE.Vector3(), s1 = new THREE.Vector3(), c = new THREE.Vector3(), center = new THREE.Vector3();
  for (const target of targets) {
    let best = null;
    for (const v of target.hurtVolumes()) {
      center.set(v.x, v.y, v.z);
      for (let i = 0; i <= 4; i++) {
        const k = i / 4;
        s0.lerpVectors(prev.a, cur.a, k); s1.lerpVectors(prev.b, cur.b, k);
        closestOnSegment(center, s0, s1, c);
        const gap = c.distanceTo(center) - radius - v.r;
        nearest = Math.min(nearest, gap);
        if (gap <= 0 && (!best || gap < best.gap)) {
          // Contact point on the surface of the hurt volume, toward the limb.
          const point = center.clone().add(c.clone().sub(center).setLength(v.r * .9));
          best = { target, part: v.part, point, gap };
        }
      }
    }
    if (best) contacts.push(best);
  }
  return { contacts, nearest };
}

/**
 * Is there a solid obstacle between `from` and `to`? Returns the obstacle and
 * where the line meets it, or null. Obstacles are the world's vertical
 * cylinders (trunks, pillars, boulders).
 */
export function obstacleBetween(from, to, grid) {
  const steps = Math.max(2, Math.ceil(from.distanceTo(to) / .12));
  const p = new THREE.Vector3();
  for (let i = 1; i <= steps; i++) {
    p.lerpVectors(from, to, i / steps);
    for (const o of grid.near(p.x, p.z)) {
      if (p.y < o.top && Math.hypot(o.x - p.x, o.z - p.z) < o.r) return { obstacle: o, point: p.clone() };
    }
  }
  return null;
}
