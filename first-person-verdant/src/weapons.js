import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The Groveblade and Stonebreaker, built in Blender (tools/blender/build_weapons.py).
// Each model has its grip on the origin and its business end toward -Y; the
// empties WeaponBase and WeaponTip mark the striking segment, which the combat
// code uses as the hitbox (moves.js), so the blade you see is the blade that hits.

const BASE = import.meta.env?.BASE_URL || '/';
export const WEAPON_MODELS = ['groveblade', 'stonebreaker'];

// How each weapon sits in the block fist (RightHand bone space; the fist is
// centred at y -0.05 and the forearm continues along -Y). Rotations are
// [tilt, roll, 0] in XZY order: roll turns the blade's flat about its own
// length, then tilt swings it off the forearm line, the way a wrist cocks.
// The Groveblade is held forward across the body; the Stonebreaker rests up at the shoulder.
export const GRIP = {
  groveblade: { position: [0, -.05, -.01], rotation: [-.5, Math.PI / 2, 0] },
  stonebreaker: { position: [0, -.05, -.01], rotation: [.5, 0, 0], shift: -.18 }
};
// First-person arms reach along -Z (the fist is at z -0.275): the same grips turned a quarter.
export const FP_GRIP = {
  groveblade: { position: [0, 0, -.27], rotation: [Math.PI / 2 + .5, Math.PI / 2, 0] },
  stonebreaker: { position: [0, 0, -.27], rotation: [Math.PI / 2 + .5, 0, 0], shift: -.18 }
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
  group.position.fromArray(grip.position); group.rotation.set(...grip.rotation, 'XZY');
  m.position.y = grip.shift || 0;           // slide the haft so the fist holds it low
  group.add(m); parent.add(group);
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return { group, base: m.getObjectByName('WeaponBase'), tip: m.getObjectByName('WeaponTip') };
}
