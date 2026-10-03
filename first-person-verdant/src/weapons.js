import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The class weapons, built in Blender (tools/blender/build_weapons.py): Groveblade
// (fighter), Stonebreaker (tank), Spore Wand (mage), Windstring Bow (ranger) and Bloom Staff (support).
// Each model has its grip on the origin and its business end toward -Y; the
// empties WeaponBase and WeaponTip mark the striking segment, which the combat
// code uses as the hitbox (moves.js), so the blade you see is the blade that hits.

const BASE = import.meta.env?.BASE_URL || '/';
export const WEAPON_MODELS = ['groveblade', 'stonebreaker', 'sporewand', 'windstring', 'bloomstaff'];

// How each weapon sits in the block fist (RightHand bone space; the fist is
// centred at y -0.05 and the forearm continues along -Y). Rotations are
// [tilt, roll, 0] in XZY order: roll turns the blade's flat about its own
// length, then tilt swings it off the forearm line, the way a wrist cocks.
// `rotation` is the striking grip (attacks, charging, guarding); `carry` is how it
// is held while standing and running, clear of the ground: the Groveblade raised
// forward in a ready stance, the Stonebreaker held upright.
export const GRIP = {
  groveblade: { position: [0, -.05, -.01], rotation: [-.5, Math.PI / 2, 0], carry: [2, Math.PI / 2, 0] },
  stonebreaker: { position: [0, -.05, -.01], rotation: [.5, 0, 0], carry: [2.4, 0, 0], shift: -.18 },
  // The wand points out of the fist like a short blade; the staff is held like the maul, upright at rest;
  // the bow's grip runs across the fist with the limbs up and down.
  sporewand: { position: [0, -.05, -.01], rotation: [-.5, 0, 0], carry: [1.6, 0, 0] },
  windstring: { position: [0, -.05, -.01], rotation: [0, Math.PI / 2, 0], carry: [0, Math.PI / 2, 0] },
  bloomstaff: { position: [0, -.05, -.01], rotation: [.5, 0, 0], carry: [2.6, 0, 0], shift: .12 }
};
// First-person arms reach along -Z (the fist is at z -0.275): the same grips turned a quarter.
export const FP_GRIP = {
  groveblade: { position: [0, 0, -.27], rotation: [Math.PI / 2 + .5, Math.PI / 2, 0] },
  stonebreaker: { position: [0, 0, -.27], rotation: [Math.PI / 2 + .5, 0, 0], shift: -.18 },
  sporewand: { position: [0, 0, -.27], rotation: [Math.PI / 2 + .3, 0, 0] },
  windstring: { position: [0, 0, -.27], rotation: [Math.PI / 2, Math.PI / 2, 0] },
  bloomstaff: { position: [0, 0, -.27], rotation: [Math.PI / 2 + .5, 0, 0], shift: .12 }
};

let pending = null;
/** Loads the models once: { groveblade, stonebreaker } prototypes. */
export function loadWeaponModels() {
  pending ||= new GLTFLoader().loadAsync(`${BASE}characters/weapons/weapons.glb`).then(gltf => {
    const out = {};
    for (const name of WEAPON_MODELS) {
      const o = gltf.scene.getObjectByName(name[0].toUpperCase() + name.slice(1));
      if (o) { o.parent?.remove(o); o.position.set(0, 0, 0); out[name] = o; }
    }
    return out;
  });
  return pending;
}

/** Put a clone of the model in `parent` using a grip; returns { group, base, tip }. */
export function mountWeapon(parent, model, grip) {
  const group = new THREE.Group(), m = model.clone(true);
  // The corners of the whole weapon: the ground check watches these, not just the
  // haft, so a wide hammer head cannot sink a corner into a slope.
  const box = new THREE.Box3().setFromObject(m), corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  group.position.fromArray(grip.position); group.rotation.set(...grip.rotation, 'XZY');
  m.position.y = grip.shift || 0;           // slide the haft so the fist holds it low
  group.add(m); parent.add(group);
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  // glTF names must be unique, so the second model's markers come back as WeaponBase001 etc.
  const find = prefix => { let hit = null; m.traverse(o => { if (!hit && o.name.startsWith(prefix)) hit = o; }); return hit; };
  const q = r => new THREE.Quaternion().setFromEuler(new THREE.Euler(...r, 'XZY'));
  return { group, model: m, corners, base: find('WeaponBase'), tip: find('WeaponTip'), strike: q(grip.rotation), carry: q(grip.carry || grip.rotation), blend: 0 };
}

const tip = new THREE.Vector3(), lift = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
/**
 * Hold a mounted weapon for this frame: blend between carry and strike grips
 * (quickly into a strike, gently back), then, if any part would still dip into
 * the ground, tilt it up just enough.
 */
export function holdWeapon(m, striking, dt, groundY) {
  m.blend += ((striking ? 1 : 0) - m.blend) * Math.min(1, dt * (striking ? 22 : 7));
  m.group.quaternion.slerpQuaternions(m.carry, m.strike, m.blend);
  if (!groundY || !m.tip) return;
  const clearance = () => { m.group.updateWorldMatrix(true, true); let low = 9;
    for (const c of m.corners) { tip.copy(c).applyMatrix4(m.model.matrixWorld); low = Math.min(low, tip.y - groundY(tip.x, tip.z)); } return low; };
  let low = clearance();
  if (low >= .06) return;
  // Try both ways about the grip's tilt axis; keep turning whichever way lifts it.
  lift.setFromAxisAngle(X, .12); m.group.quaternion.multiply(lift); const up = clearance();
  if (up < low) { lift.setFromAxisAngle(X, -.24); m.group.quaternion.multiply(lift); lift.setFromAxisAngle(X, -.12); } else lift.setFromAxisAngle(X, .12);
  for (let i = 0; i < 12 && clearance() < .06; i++) m.group.quaternion.multiply(lift);
}
