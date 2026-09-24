import * as THREE from 'three';
import { BONES } from '../humanoid.js';

// Poses are authored as local Euler rotations in degrees per bone, plus an optional
// `HipsPos` offset in metres. Conventions (explorer faces -Z, right hand on +X):
//   limbs hanging down: +X swings forward, arms: +Z raises the right arm outward
//   (-Z for the left), legs: -X on Leg bends the knee;
//   Spine/Chest/Neck/Head: -X leans forward, +Y turns the chest to the left
//   (right shoulder forward).
export const BONE_NAMES = BONES.map(([name]) => name);
const REST = Object.fromEntries(BONES.map(([name, parent, x, y, z]) => {
  const p = parent ? BONES.find(b => b[0] === parent) : null;
  return [name, new THREE.Vector3(x - (p ? p[2] : 0), y - (p ? p[3] : 0), z - (p ? p[4] : 0))];
}));

const euler = new THREE.Euler(), quat = new THREE.Quaternion();
const RAD = Math.PI / 180;

export function mirror(pose) {
  const out = {};
  for (const [key, value] of Object.entries(pose)) {
    const name = key.startsWith('Left') ? 'Right' + key.slice(4) : key.startsWith('Right') ? 'Left' + key.slice(5) : key;
    out[name] = key === 'HipsPos' ? [-value[0], value[1], value[2]] : [value[0], -value[1], -value[2]];
  }
  return out;
}

/** Layer poses left to right; later values replace earlier ones bone by bone. */
export const merge = (...poses) => Object.assign({}, ...poses);

/**
 * Build a THREE.AnimationClip from timed key poses. Every key is laid over
 * `base`, so a key only lists the bones that move. All bones get a track, which
 * keeps blends between clips complete.
 */
export function clip(name, keys, base = {}) {
  const times = keys.map(k => k.t);
  const tracks = [];
  for (const bone of BONE_NAMES) {
    const values = [];
    for (const key of keys) {
      const r = key.pose[bone] ?? base[bone] ?? [0, 0, 0];
      euler.set(r[0] * RAD, r[1] * RAD, r[2] * RAD, 'XYZ');
      quat.setFromEuler(euler);
      values.push(quat.x, quat.y, quat.z, quat.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }
  const positions = [];
  for (const key of keys) {
    const o = key.pose.HipsPos ?? base.HipsPos ?? [0, 0, 0];
    positions.push(REST.Hips.x + o[0], REST.Hips.y + o[1], REST.Hips.z + o[2]);
  }
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, positions));
  return new THREE.AnimationClip(name, times[times.length - 1], tracks);
}

/** A looping cycle: the first key is repeated at the end so the loop is seamless. */
export function cycle(name, duration, poses, base = {}) {
  const keys = poses.map((pose, i) => ({ t: (duration * i) / poses.length, pose }));
  keys.push({ t: duration, pose: poses[0] });
  return clip(name, keys, base);
}
