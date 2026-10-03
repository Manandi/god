import * as THREE from 'three';

// Ranged strikes: spore bolts and orbs (Spore Wand), arrows (Windstring Bow) and
// the Ranger's Volley. A projectile flies straight, stops at a wall, the ground,
// its range or the first creature it touches (a piercing arrow keeps going), and
// an orb with `aoe` bursts where it stops. update() returns what landed; main.js
// turns that into damage the same way a melee hit does (strikeCreature), so team
// fights route guest hits to the host as usual.

const orbGeometry = new THREE.SphereGeometry(1, 12, 8);
const arrowGeometry = new THREE.CylinderGeometry(.025, .045, .95, 6);
const UP = new THREE.Vector3(0, 1, 0);

export function createProjectiles(scene) {
  const list = [];
  return {
    get count() { return list.length; },
    /** o: { from, dir (unit), speed, range, radius, color, arrow?, pierce?, aoe?, payload } */
    spawn(o) {
      const material = new THREE.MeshBasicMaterial({ color: o.color, transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(o.arrow ? arrowGeometry : orbGeometry, material);
      if (o.arrow) mesh.quaternion.setFromUnitVectors(UP, o.dir); else mesh.scale.setScalar(o.radius * .6);
      mesh.position.copy(o.from); scene.add(mesh);
      list.push({ ...o, mesh, pos: o.from.clone(), travelled: 0, hit: new Set() });
    },
    /** Move everything; returns [{ shot, target?, aoe?, point }]. */
    update(dt, { targets, blocked, ground }) {
      const out = [];
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i], step = p.speed * dt;
        p.pos.addScaledVector(p.dir, step); p.travelled += step;
        let end = p.travelled >= p.range || p.pos.y < ground(p.pos.x, p.pos.z) + .05 || blocked(p.pos);
        if (!end) for (const c of targets) {
          if (p.hit.has(c)) continue;
          const mid = ground(c.x, c.z) + (c.focusHeight || 1), r = (c.radius || 1) + p.radius;
          const dx = p.pos.x - c.x, dz = p.pos.z - c.z;
          if (dx * dx + dz * dz > r * r || Math.abs(p.pos.y - mid) > (c.focusHeight || 1) + .9) continue;
          p.hit.add(c);
          if (p.aoe) { end = true; break; }                // an orb bursts on the first thing it meets
          out.push({ shot: p, target: c, point: p.pos.clone() });
          if (!p.pierce) { end = true; break; }
        }
        if (end) {
          if (p.aoe) out.push({ shot: p, aoe: true, point: p.pos.clone() });
          scene.remove(p.mesh); p.mesh.material.dispose(); list.splice(i, 1); continue;
        }
        p.mesh.position.copy(p.pos);
        if (!p.arrow) p.mesh.scale.setScalar(p.radius * (.55 + .12 * Math.sin(p.travelled * 2.4)));
      }
      return out;
    }
  };
}
