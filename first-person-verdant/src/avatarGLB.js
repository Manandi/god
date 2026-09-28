import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Animator, solveLeg } from './anim/animator.js';
import { SKIN_TONES, SHIRTS, TROUSERS, HAIR_COLORS } from './avatar.js';

// The authored explorer (Blender + MPFB, see public/characters/explorer/README.md).
// This adapter gives it the same interface as the procedural avatar, so the
// game, combat and camera code do not care which body is on screen.

const URL = `${import.meta.env?.BASE_URL || '/'}characters/explorer/explorer.glb`;
const SCALE = 1.08;           // 1.81 m: matches the camera height and collision capsule

// Gameplay clip names → clips exported from Blender.
const CLIP_NAMES = {
  idle: 'Idle', walk: 'Walk', run: 'Jog', walk_back: 'WalkBackward', strafe_left: 'StrafeLeft', strafe_right: 'StrafeRight',
  guard: 'GuardIdle', guard_fwd: 'GuardWalk', guard_back: 'GuardBack', guard_left: 'GuardLeft', guard_right: 'GuardRight',
  air: 'Fall', jump: 'JumpStart', land: 'Land', sit: 'Sit', pose: 'Pose', wave: 'Wave', cheer: 'Cheer', talk: 'Talk',
  interact: 'Interact', death: 'Death',
  palm: 'AttackLight1', swing: 'AttackLight2', heel: 'AttackHeavy',
  evadeForward: 'Dash', evadeBack: 'Dash', evadeLeft: 'Dash', evadeRight: 'Dash', hurt: 'Hurt'
};
// Names the combat code uses for striking limbs → bones in the explorer rig.
const BONE_ALIASES = {
  Hips: 'pelvis', Spine: 'spine_01', Chest: 'spine_03', Neck: 'neck_01', Head: 'head',
  LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
  LeftUpLeg: 'thigh_l', LeftLeg: 'calf_l', LeftFoot: 'foot_l', RightUpLeg: 'thigh_r', RightLeg: 'calf_r', RightFoot: 'foot_r'
};
const HAIR_MESH = { short: 'Hair_short', curly: 'Hair_curly', swept: 'Hair_swept', tied: 'Hair_tied', braid: 'Hair_braid' };

export async function loadExplorer(scene) {
  const gltf = await new GLTFLoader().loadAsync(URL);
  const root = new THREE.Group(), model = gltf.scene;
  model.rotation.y = Math.PI;                 // the export faces +Z; gameplay yaw 0 faces -Z
  model.scale.setScalar(SCALE);
  root.add(model); scene.add(root);

  const parts = collectParts(model), { bones: byName, morph } = parts;
  const bones = new Proxy(byName, { get: (t, k) => t[BONE_ALIASES[k] || k] });

  // Clips are renamed to the gameplay names; unknown gameplay names fall back to idle.
  const clips = [];
  for (const [game, file] of Object.entries(CLIP_NAMES)) {
    const clip = gltf.animations.find(a => a.name === file);
    if (clip) { const c = clip.clone(); c.name = game; clips.push(c); }
  }
  const animator = new Animator(model, clips);

  let mood = 'calm', emote = 'idle', blinkTimer = 2, blink = 0, talking = false, time = 0;
  const expression = { Smile: 0, Exert: 0, Hurt: 0, Talk: 0 };

  model.updateMatrixWorld(true);
  const headRest = byName.head.getWorldPosition(new THREE.Vector3()).y;

  return {
    root, bones, animator, isAuthored: true, headRest,
    setAppearance(a) { dress(model, parts, a); },
    emote(name) { emote = name; }, get emoteName() { return emote; },
    /** mood: calm | focus | strain | hurt | cheer */
    setMood(next) { mood = next; },
    setTalking(on) { talking = on; },
    update(dt, groundAt) {
      time += dt;
      animator.update(dt);
      root.updateMatrixWorld(true);
      if (groundAt) plantFeet(groundAt);
      // Face: blink on a loose rhythm, expressions ease toward the mood.
      blinkTimer -= dt; if (blinkTimer < 0) blinkTimer = 2.2 + Math.random() * 3;
      blink = THREE.MathUtils.damp(blink, blinkTimer < .11 || mood === 'hurt' ? 1 : 0, 30, dt);
      const want = { Smile: mood === 'cheer' ? 1 : talking ? .3 : 0, Exert: mood === 'strain' ? .95 : mood === 'focus' ? .22 : 0,
        Hurt: mood === 'hurt' ? 1 : 0, Talk: talking ? .5 + .5 * Math.sin(time * 13) * Math.sin(time * 4.3) : 0 };
      for (const k in expression) { expression[k] = THREE.MathUtils.damp(expression[k], want[k], 16, dt); morph(k, expression[k]); }
      morph('Blink', Math.max(blink, mood === 'hurt' ? .5 : 0));
    },
    flicker(t, invuln) { root.visible = !(invuln > 0 && Math.floor(t * 15) % 3 === 0); }
  };

  function plantFeet(groundAt) {
    const base = root.position.y, lifts = [], v = new THREE.Vector3();
    for (const side of ['l', 'r']) {
      byName['foot_' + side].getWorldPosition(v);
      const planted = THREE.MathUtils.clamp(1 - (v.y - base - .1) / .2, 0, 1);
      lifts.push(THREE.MathUtils.clamp(groundAt(v.x, v.z) - base, -.35, .35) * planted);
    }
    const drop = Math.min(0, ...lifts);
    if (drop < 0) {
      const hips = byName.pelvis, p = hips.getWorldPosition(new THREE.Vector3());
      p.y += drop; hips.parent.worldToLocal(p); hips.position.copy(p); root.updateMatrixWorld(true);
    }
    ['l', 'r'].forEach((s, i) => solveLeg(byName['thigh_' + s], byName['calf_' + s], byName['foot_' + s], lifts[i] - drop));
  }
}
