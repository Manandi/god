import { clip, cycle, merge, mirror } from './pose.js';

// ---------------------------------------------------------------------------
// Rootbound: the explorer's unarmed style. Low, rooted stances; strikes start in
// the feet, turn through the hips and chest, and finish in the palm, forearm or
// heel. Left side leads.
// ---------------------------------------------------------------------------

// Relaxed standing, used outside combat.
export const RELAXED = {
  LeftArm: [2, 0, -4], RightArm: [2, 0, 4], LeftForeArm: [8, 0, 0], RightForeArm: [8, 0, 0],
  Spine: [0, 0, 0], Chest: [0, 0, 0]
};

// Guard: bladed stance, lead (left) foot forward, knees soft, hands up.
export const GUARD = {
  HipsPos: [0, -.05, 0],
  Hips: [0, -24, 0], Spine: [-4, 9, 0], Chest: [-3, 8, 0], Neck: [2, 4, 0], Head: [2, 3, 0],
  LeftUpLeg: [24, 16, -4], LeftLeg: [-26, 0, 0], LeftFoot: [4, 8, 0],
  RightUpLeg: [-10, 24, 5], RightLeg: [-18, 0, 0], RightFoot: [22, 4, 0],
  LeftShoulder: [0, 0, 0], RightShoulder: [0, 0, 0],
  LeftArm: [48, -32, -10], LeftForeArm: [100, 0, 0], LeftHand: [-8, 0, 0],
  RightArm: [36, 30, 10], RightForeArm: [122, 0, 0], RightHand: [-8, 0, 0]
};

// --- Strike 1 · Sapling Palm ------------------------------------------------
// A quick lead-hand palm heel that steps in off the front foot.
const PALM_LOAD = merge(GUARD, {
  HipsPos: [0, -.08, .03], Hips: [0, -32, 0], Spine: [-2, 6, 0], Chest: [-2, 4, 0],
  LeftArm: [42, -30, -10], LeftForeArm: [110, 0, 0],
  LeftUpLeg: [30, 16, -4], LeftLeg: [-34, 0, 0]
});
const PALM_HIT = merge(GUARD, {
  HipsPos: [0, -.1, -.08], Hips: [0, -8, 0], Spine: [-12, 8, 0], Chest: [-10, 10, 0], Neck: [10, 0, 0], Head: [8, -6, 0],
  LeftShoulder: [0, 8, -4], LeftArm: [84, -6, -4], LeftForeArm: [8, 0, 0], LeftHand: [-38, 0, 0],
  RightArm: [30, 30, 10], RightForeArm: [130, 0, 0],
  LeftUpLeg: [40, 10, -4], LeftLeg: [-36, 0, 0], LeftFoot: [0, 4, 0],
  RightUpLeg: [-22, 20, 5], RightLeg: [-6, 0, 0], RightFoot: [30, 0, 0]
});
export const PALM = { name: 'palm', keys: [
  { t: 0, pose: GUARD }, { t: .07, pose: PALM_LOAD }, { t: .12, pose: PALM_HIT },
  { t: .19, pose: PALM_HIT }, { t: .32, pose: merge(GUARD, { HipsPos: [0, -.07, -.04] }) }, { t: .46, pose: GUARD }
] };

// --- Strike 2 · Bough Swing -------------------------------------------------
// The rear arm sweeps across as the hips and chest unwind. The forearm is the
// striking surface, so it lands wide and forgiving.
const SWING_WIND = merge(GUARD, {
  HipsPos: [0, -.07, .06], Hips: [0, -46, 0], Spine: [-3, -8, 0], Chest: [-2, -10, 0], Neck: [0, 30, 0], Head: [0, 20, 0],
  RightShoulder: [0, 0, 8], RightArm: [30, -30, 70], RightForeArm: [96, 0, 0],
  LeftArm: [52, -30, -14], LeftForeArm: [110, 0, 0],
  RightUpLeg: [-6, 24, 5], RightLeg: [-30, 0, 0]
});
const SWING_HIT = merge(GUARD, {
  HipsPos: [0, -.09, -.06], Hips: [0, 22, 0], Spine: [-10, 18, 0], Chest: [-8, 22, 0], Neck: [6, -26, 0], Head: [4, -22, 0],
  RightShoulder: [0, 10, 4], RightArm: [18, 62, 78], RightForeArm: [70, 0, 0], RightHand: [0, 0, 0],
  LeftArm: [46, -30, -16], LeftForeArm: [120, 0, 0],
  LeftUpLeg: [32, 8, -6], LeftLeg: [-30, 0, 0],
  RightUpLeg: [-26, -10, 4], RightLeg: [-10, 0, 0], RightFoot: [34, 0, 0]
});
const SWING_FOLLOW = merge(SWING_HIT, {
  Hips: [0, 30, 0], Chest: [-6, 28, 0], RightArm: [16, 78, 70], RightForeArm: [84, 0, 0]
});
export const SWING = { name: 'swing', keys: [
  { t: 0, pose: GUARD }, { t: .12, pose: SWING_WIND }, { t: .2, pose: SWING_HIT }, { t: .26, pose: SWING_FOLLOW },
  { t: .42, pose: merge(GUARD, { Hips: [0, 4, 0], Chest: [-3, 12, 0] }) }, { t: .6, pose: GUARD }
] };

// --- Strike 3 · Taproot Heel ------------------------------------------------
// The rear knee chambers high, then the heel drives straight through the target.
const HEEL_CHAMBER = merge(GUARD, {
  HipsPos: [0, -.02, .05], Hips: [0, -6, 0], Spine: [8, 4, 0], Chest: [2, 4, 0], Neck: [-6, 0, 0], Head: [-6, 0, 0],
  RightUpLeg: [96, 0, 6], RightLeg: [-118, 0, 0], RightFoot: [-10, 0, 0],
  LeftUpLeg: [14, 6, -4], LeftLeg: [-20, 0, 0], LeftFoot: [4, 0, 0],
  LeftArm: [50, -26, -22], LeftForeArm: [100, 0, 0], RightArm: [24, 24, 20], RightForeArm: [118, 0, 0]
});
const HEEL_HIT = merge(HEEL_CHAMBER, {
  HipsPos: [0, -.04, -.1], Hips: [0, 4, 0], Spine: [18, 0, 0], Chest: [8, 0, 0], Neck: [-14, 0, 0], Head: [-10, 0, 0],
  RightUpLeg: [86, 0, 4], RightLeg: [-8, 0, 0], RightFoot: [-34, 0, 0],
  LeftUpLeg: [4, 6, -4], LeftLeg: [-14, 0, 0], LeftFoot: [10, 0, 0],
  LeftArm: [40, -10, -44], LeftForeArm: [60, 0, 0], RightArm: [-24, -6, 34], RightForeArm: [70, 0, 0]
});
const HEEL_RETURN = merge(HEEL_CHAMBER, { RightUpLeg: [70, 0, 6], RightLeg: [-96, 0, 0], Spine: [6, 2, 0] });
export const HEEL = { name: 'heel', keys: [
  { t: 0, pose: GUARD }, { t: .16, pose: HEEL_CHAMBER }, { t: .27, pose: HEEL_HIT }, { t: .34, pose: HEEL_HIT },
  { t: .47, pose: HEEL_RETURN }, { t: .62, pose: merge(GUARD, { HipsPos: [0, -.08, -.04] }) }, { t: .82, pose: GUARD }
] };

// --- Evades · Leaf Step -----------------------------------------------------
// A low, quick step out of line. The body stays square to the threat.
const STEP_RIGHT = merge(GUARD, {
  HipsPos: [.05, -.2, 0], Hips: [0, -10, 12], Spine: [-10, 6, -10], Chest: [-6, 4, -6], Neck: [4, 0, 8],
  RightUpLeg: [18, 10, 30], RightLeg: [-60, 0, 0], RightFoot: [20, 0, -12],
  LeftUpLeg: [4, 10, -34], LeftLeg: [-6, 0, 0], LeftFoot: [10, 0, 16],
  LeftArm: [58, -30, -12], LeftForeArm: [118, 0, 0], RightArm: [40, 28, 14], RightForeArm: [126, 0, 0]
});
const STEP_BACK = merge(GUARD, {
  HipsPos: [0, -.18, .06], Hips: [0, -20, 0], Spine: [-18, 8, 0], Chest: [-12, 6, 0], Neck: [14, 0, 0], Head: [8, 0, 0],
  LeftUpLeg: [34, 10, -4], LeftLeg: [-10, 0, 0], LeftFoot: [-10, 0, 0],
  RightUpLeg: [-4, 20, 5], RightLeg: [-70, 0, 0], RightFoot: [30, 0, 0],
  LeftArm: [62, -30, -12], LeftForeArm: [116, 0, 0], RightArm: [46, 30, 12], RightForeArm: [128, 0, 0]
});
const STEP_FORWARD = merge(GUARD, {
  HipsPos: [0, -.22, -.06], Hips: [0, -14, 0], Spine: [-28, 6, 0], Chest: [-14, 6, 0], Neck: [24, 0, 0], Head: [14, 0, 0],
  LeftUpLeg: [62, 10, -4], LeftLeg: [-70, 0, 0], LeftFoot: [4, 0, 0],
  RightUpLeg: [-24, 20, 5], RightLeg: [-40, 0, 0], RightFoot: [40, 0, 0],
  LeftArm: [66, -28, -12], LeftForeArm: [110, 0, 0], RightArm: [52, 28, 12], RightForeArm: [124, 0, 0]
});
const evade = (name, pose) => ({ name, keys: [
  { t: 0, pose: GUARD }, { t: .06, pose: merge(pose, { HipsPos: [pose.HipsPos[0] * .5, -.12, pose.HipsPos[2] * .5] }) },
  { t: .16, pose }, { t: .28, pose }, { t: .4, pose: merge(GUARD, { HipsPos: [0, -.08, 0] }) }, { t: .5, pose: GUARD }
] });
export const EVADES = [
  evade('evadeRight', STEP_RIGHT), evade('evadeLeft', mirror(STEP_RIGHT)),
  evade('evadeBack', STEP_BACK), evade('evadeForward', STEP_FORWARD)
];

// --- Reactions --------------------------------------------------------------
const FLINCH = merge(GUARD, {
  HipsPos: [0, -.1, .1], Hips: [8, -30, 0], Spine: [16, -6, 4], Chest: [12, -4, 6], Neck: [-14, 8, 0], Head: [-12, 10, 0],
  LeftArm: [30, 30, -40], LeftForeArm: [70, 0, 0], RightArm: [20, -20, 40], RightForeArm: [80, 0, 0],
  LeftUpLeg: [20, 16, -8], LeftLeg: [-14, 0, 0], RightUpLeg: [-18, 24, 8], RightLeg: [-30, 0, 0]
});
export const HURT = { name: 'hurt', keys: [
  { t: 0, pose: GUARD }, { t: .07, pose: FLINCH }, { t: .2, pose: merge(FLINCH, { Spine: [8, -4, 2], HipsPos: [0, -.12, .06] }) }, { t: .42, pose: GUARD }
] };

// --- Locomotion -------------------------------------------------------------
const stride = (lead, s = 1) => ({
  // `lead`: which foot is planted forward at this key. s scales the stride.
  HipsPos: [0, -.03, 0], Spine: [-7, lead === 'L' ? 7 : -7, 0], Chest: [-2, lead === 'L' ? 4 : -4, 0],
  LeftUpLeg: [lead === 'L' ? 32 * s : -28 * s, 0, -2], LeftLeg: [lead === 'L' ? -12 : -40 * s, 0, 0], LeftFoot: [lead === 'L' ? -8 : 26, 0, 0],
  RightUpLeg: [lead === 'R' ? 32 * s : -28 * s, 0, 2], RightLeg: [lead === 'R' ? -12 : -40 * s, 0, 0], RightFoot: [lead === 'R' ? -8 : 26, 0, 0],
  LeftArm: [lead === 'L' ? -30 * s : 36 * s, 0, -8], LeftForeArm: [lead === 'L' ? 30 : 70, 0, 0],
  RightArm: [lead === 'R' ? -30 * s : 36 * s, 0, 8], RightForeArm: [lead === 'R' ? 30 : 70, 0, 0]
});
const passing = (swing, s = 1) => ({
  HipsPos: [0, .03, 0], Spine: [-7, 0, 0], Chest: [-2, 0, 0],
  [swing + 'UpLeg']: [40 * s, 0, 0], [swing + 'Leg']: [-86 * s, 0, 0], [swing + 'Foot']: [18, 0, 0],
  [(swing === 'Left' ? 'Right' : 'Left') + 'UpLeg']: [-4, 0, 0], [(swing === 'Left' ? 'Right' : 'Left') + 'Leg']: [-6, 0, 0],
  LeftArm: [4, 0, -8], LeftForeArm: [52, 0, 0], RightArm: [4, 0, 8], RightForeArm: [52, 0, 0]
});
const guardStep = (dir, phase) => {
  // Short shuffling steps that keep the guard: phase 0/2 = feet apart, 1/3 = gathered.
  const apart = phase % 2 === 0, lead = phase === 0 ? 1 : -1;
  const pose = merge(GUARD, { HipsPos: [0, apart ? -.07 : -.035, 0] });
  if (dir === 'fwd' || dir === 'back') {
    const k = dir === 'fwd' ? 1 : -1;
    pose.LeftUpLeg = [GUARD.LeftUpLeg[0] + (apart ? 12 * lead * k : 0), 16, -4];
    pose.RightUpLeg = [GUARD.RightUpLeg[0] - (apart ? 12 * lead * k : 0), 24, 5];
    pose.LeftLeg = [apart ? -20 : -44, 0, 0]; pose.RightLeg = [apart ? -18 : -40, 0, 0];
  } else {
    const k = dir === 'right' ? 1 : -1, open = apart ? 1 : 0;
    pose.LeftUpLeg = [GUARD.LeftUpLeg[0], 16, -4 - (lead * k < 0 ? 16 * open : 0)];
    pose.RightUpLeg = [GUARD.RightUpLeg[0], 24, 5 + (lead * k > 0 ? 16 * open : 0)];
    pose.LeftLeg = [apart ? -24 : -42, 0, 0]; pose.RightLeg = [apart ? -18 : -38, 0, 0];
  }
  return pose;
};

const idleBreath = t => merge(RELAXED, { Chest: [-1 - t * 1.5, 0, 0], Neck: [t * 1.5, 0, 0], HipsPos: [0, -t * .006, 0] });
const guardBreath = t => merge(GUARD, { HipsPos: [0, -.05 - t * .018, 0], Chest: [-3 - t * 2, 8, 0], LeftForeArm: [100 + t * 5, 0, 0] });

// --- Emotes (kept from the earlier avatar) -----------------------------------
const WAVE_UP = merge(RELAXED, { RightArm: [10, 0, 140], RightForeArm: [30, 0, 0], Head: [0, -8, 4] });
const WAVE_OUT = merge(WAVE_UP, { RightForeArm: [0, 0, 0], RightArm: [10, 0, 150] });
const CHEER = merge(RELAXED, { LeftArm: [0, 0, -160], RightArm: [0, 0, 160], LeftForeArm: [10, 0, 0], RightForeArm: [10, 0, 0], Head: [-12, 0, 0], Chest: [8, 0, 0] });
const POSE = merge(RELAXED, { Hips: [0, -14, 0], LeftArm: [-4, 0, -20], RightArm: [70, 0, 10], RightForeArm: [110, 0, 0], LeftUpLeg: [6, 0, -8], Head: [0, 14, 0] });
const SIT = merge(RELAXED, { HipsPos: [0, -.56, .14], LeftUpLeg: [88, 0, -6], RightUpLeg: [88, 0, 6], LeftLeg: [-88, 0, 0], RightLeg: [-88, 0, 0],
  Spine: [6, 0, 0], LeftArm: [30, 0, -8], RightArm: [30, 0, 8], LeftForeArm: [40, 0, 0], RightForeArm: [40, 0, 0] });

const AIR = merge(GUARD, { HipsPos: [0, 0, 0], LeftUpLeg: [40, 10, -6], LeftLeg: [-60, 0, 0], RightUpLeg: [10, 20, 6], RightLeg: [-50, 0, 0],
  LeftArm: [40, 10, -30], RightArm: [30, -10, 30] });

const oneShot = move => clip(move.name, move.keys);

export function buildClips() {
  return [
    // locomotion loops (all share one phase)
    cycle('idle', 3, [idleBreath(0), idleBreath(1)]),
    cycle('guard', 1.4, [guardBreath(0), guardBreath(1)]),
    cycle('run', .72, [stride('L'), passing('Right'), stride('R'), passing('Left')]),
    cycle('walk', 1.1, [stride('L', .6), passing('Right', .55), stride('R', .6), passing('Left', .55)]),
    ...['fwd', 'back', 'left', 'right'].map(d => cycle('guard_' + d, .76, [0, 1, 2, 3].map(p => guardStep(d, p)))),
    cycle('air', 1, [AIR, AIR]),
    cycle('sit', 2, [SIT, merge(SIT, { Chest: [2, 0, 0] })]),
    cycle('pose', 2, [POSE, POSE]),
    cycle('wave', .8, [WAVE_UP, WAVE_OUT]),
    cycle('cheer', 1, [CHEER, merge(CHEER, { HipsPos: [0, .04, 0] })]),
    // one-shots
    oneShot(PALM), oneShot(SWING), oneShot(HEEL), ...EVADES.map(oneShot), oneShot(HURT)
  ];
}
