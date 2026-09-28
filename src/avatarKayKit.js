import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Animator } from './anim/animator.js';
import { MOVES } from './combat/moves.js';

// KayKit Adventurers 1.0, CC0. A single authored character supplies its own
// locomotion, punches, kick, dodge and emotes. No separate camera hands.
const FILES = { rogue: 'Rogue', knight: 'Knight', mage: 'Mage', barbarian: 'Barbarian' };
const CLIPS = {
  idle: 'Unarmed_Idle', walk: 'Walking_A', run: 'Running_A', walk_back: 'Walking_Backwards',
  strafe_left: 'Running_Strafe_Left', strafe_right: 'Running_Strafe_Right',
  guard: 'Unarmed_Idle', guard_fwd: 'Walking_A', guard_back: 'Walking_Backwards',
  guard_left: 'Running_Strafe_Left', guard_right: 'Running_Strafe_Right',
  air: 'Jump_Idle', jump: 'Jump_Start', land: 'Jump_Land', sit: 'Sit_Floor_Idle',
  pose: 'Unarmed_Pose', wave: 'Interact', cheer: 'Cheer', interact: 'Interact', death: 'Death_A',
  palm: 'Unarmed_Melee_Attack_Punch_B', swing: 'Unarmed_Melee_Attack_Punch_A', heel: 'Unarmed_Melee_Attack_Kick',
  evadeForward: 'Dodge_Forward', evadeBack: 'Dodge_Backward', evadeLeft: 'Dodge_Left', evadeRight: 'Dodge_Right', hurt: 'Hit_A'
};
const ALIAS = {
  Hips: 'hips', Spine: 'spine', Chest: 'chest', Neck: 'neck', Head: 'head',
  LeftArm: 'upperarml', LeftForeArm: 'lowerarml', LeftHand: 'handl',
  RightArm: 'upperarmr', RightForeArm: 'lowerarmr', RightHand: 'handr',
  LeftUpLeg: 'upperlegl', LeftLeg: 'lowerlegl', LeftFoot: 'footl',
  RightUpLeg: 'upperlegr', RightLeg: 'lowerlegr', RightFoot: 'footr'
};

export async function loadKayKit(scene, character = 'rogue') {
  const chosen = Object.hasOwn(FILES, character) ? character : 'rogue';
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env?.BASE_URL || '/'}characters/kaykit/${FILES[chosen]}.glb`);
  const root = new THREE.Group(), model = gltf.scene;
  model.rotation.y = Math.PI;
  model.scale.setScalar(.8);  // 2.19 m source -> 1.75 m, same capsule as the explorer
  root.add(model); scene.add(root);
  model.traverse(o => {
    if (!o.isMesh) return;
    // The free pack ships held weapons and capes inside the same GLB. The
    // explorer starts unarmed; only the six complete skinned body pieces show.
    if (!o.isSkinnedMesh) { o.visible = false; return; }
    o.castShadow = true; o.receiveShadow = true;
    o.frustumCulled = false;
    if (o.material?.map) o.material.map.anisotropy = 4;
  });
  const byName = {};
  model.traverse(o => { if (o.isBone) byName[o.name] = o; });
  const bones = new Proxy(byName, { get: (t, key) => t[ALIAS[key] || key] });
  if (!bones.LeftHand || !bones.RightHand || !bones.LeftFoot || !bones.RightFoot || !bones.Head)
    throw new Error('KayKit rig lacks a combat bone');
  const clips = Object.entries(CLIPS).map(([game, source]) => {
    const clip = gltf.animations.find(a => a.name === source);
    if (!clip) throw new Error(`KayKit clip missing: ${source}`);
    const copy = clip.clone(); copy.name = game;
    // Combat timing and hit registration are authored in MOVES. Match their
    // action window so the visible punch lands when its damage is evaluated.
    if (MOVES[game]) {
      const factor = MOVES[game].duration / clip.duration;
      for (const track of copy.tracks) for (let i = 0; i < track.times.length; i++) track.times[i] *= factor;
      copy.resetDuration();
    }
    return copy;
  });
  const animator = new Animator(model, clips);
  model.updateMatrixWorld(true);
  const headRest = bones.Head.getWorldPosition(new THREE.Vector3()).y;
  let emote = 'idle';
  return {
    root, bones, animator, headRest, isAuthored: true, isKayKit: true, character: chosen,
    setAppearance() {},
    emote(name) { emote = name; }, get emoteName() { return emote; },
    setMood() {}, setTalking() {},
    update(dt) { animator.update(dt); root.updateMatrixWorld(true); },
    flicker(t, invulnerable) { root.visible = !(invulnerable > 0 && Math.floor(t * 15) % 3 === 0); }
  };
}
