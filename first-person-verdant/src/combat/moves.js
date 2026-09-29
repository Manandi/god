// Timing data for the explorer's unarmed style. Every number is in seconds
// from the start of the move, and the animation clip of the same name is keyed
// to the same timeline, so what you see is what the hit check uses.
//
// Phases:  startup [0, active[0])  ·  active [active[0], active[1])  ·  recovery
// Windows: chainFrom   a buffered light attack starts `next` from here
//          heavyFrom   a buffered heavy attack starts the heavy finisher from here
//          evadeFrom   a buffered evade cancels the rest of the move from here
//          moveFrom    movement input ends the move (back to locomotion)
//          turnUntil   the body can still turn toward the target until here
//          armor       [from, to] hyper-armour: light hits deal damage but do not interrupt
//
// damage is in health points before real-world Strength scaling; poise is how
// much the strike wears down a creature's footing (see creatures.js).

export const MOVES = {
  palm: {
    label: 'Sapling Palm', clip: 'palm', duration: .46, kind: 'light',
    active: [.09, .17], chainFrom: .17, heavyFrom: .17, evadeFrom: .17, moveFrom: .3, turnUntil: .09,
    lunge: { from: .02, to: .13, distance: .5 }, reach: 1.25,
    hitbox: { from: 'LeftForeArm', to: 'LeftHand', extend: .1, radius: .17 },
    damage: 9, poise: 2, stamina: 9, hitstop: .07, push: .3, stagger: .3, next: 'swing'
  },
  swing: {
    label: 'Bough Swing', clip: 'swing', duration: .6, kind: 'light',
    active: [.16, .25], chainFrom: .25, heavyFrom: .25, evadeFrom: .25, moveFrom: .42, turnUntil: .15,
    lunge: { from: .08, to: .21, distance: .42 }, reach: 1.1,
    hitbox: { from: 'RightForeArm', to: 'RightHand', extend: .08, radius: .2 },
    damage: 11, poise: 3, stamina: 11, hitstop: .085, push: .5, stagger: .38, next: 'palm'
  },
  heel: {
    label: 'Taproot Heel', clip: 'heel', duration: .82, kind: 'heavy',
    active: [.24, .34], chainFrom: 99, heavyFrom: 99, evadeFrom: .46, moveFrom: .62, turnUntil: .2,
    lunge: { from: .16, to: .3, distance: .55 }, reach: 1.35,
    hitbox: { from: 'RightLeg', to: 'RightFoot', extend: .12, radius: .19 },
    damage: 20, poise: 6, stamina: 18, hitstop: .12, push: 1.7, stagger: .85, next: null,
    armor: [.05, .34],
    // Hold heavy to charge: the clip holds at the chamber pose.
    charge: { at: .14, levels: [.35, .75], max: 1.1, damage: [1, 1.3, 1.65], poise: [1, 1.6, 2.4], stamina: 6 }
  },
  // Root Strike: the finisher on a toppled creature (same heel clip, driven harder).
  root: {
    label: 'Root Strike', clip: 'heel', duration: .82, kind: 'critical',
    active: [.24, .36], chainFrom: 99, heavyFrom: 99, evadeFrom: .5, moveFrom: .64, turnUntil: .22,
    lunge: { from: .12, to: .3, distance: .9 }, reach: 1.25,
    hitbox: { from: 'RightLeg', to: 'RightFoot', extend: .14, radius: .26 },
    damage: 30, poise: 0, stamina: 0, hitstop: .2, push: 1.2, stagger: .6, next: null, armor: [0, .4]
  }
};
// Sprinting and airborne variants reuse the same clips, driven harder.
MOVES.dash_palm = { ...MOVES.palm, label: 'Running Palm', kind: 'light', lunge: { from: 0, to: .14, distance: 1.7 }, damage: 11, poise: 3, stamina: 12, next: 'swing', reach: 1.35 };
MOVES.dash_heel = { ...MOVES.heel, label: 'Leaping Heel', kind: 'heavy', lunge: { from: .08, to: .3, distance: 2.1 }, damage: 22, poise: 8, stamina: 20, charge: null, armor: [.05, .34] };
MOVES.air_heel = { ...MOVES.heel, label: 'Falling Heel', kind: 'heavy', lunge: { from: 0, to: .3, distance: .6 }, damage: 18, poise: 9, stamina: 16, charge: null, armor: [0, .34],
  airborne: true };                    // gravity keeps acting; a jump attack breaks poise hard
MOVES.guard_heel = { ...MOVES.heel, label: 'Guard Counter', kind: 'heavy', active: [.2, .3], evadeFrom: .42, moveFrom: .58, turnUntil: .18,
  damage: 24, poise: 10, stamina: 14, charge: null, armor: [0, .3] };

// Holding heavy past its chamber turns any heavy into a Rootbreaker: the
// ChatGPT Sites two-handed blow, charged through three levels.
const ROOT_CHARGE = { at: .3, levels: [.35, .8], max: 1.3, damage: [1, 1.35, 1.75], poise: [1, 1.7, 2.6], stamina: 7 };
MOVES.heel.charge = { ...MOVES.heel.charge, into: 'rootbreaker' };
MOVES.rootbreaker = {
  label: 'Rootbreaker', clip: 'rootbreaker', duration: 1.02, kind: 'heavy', fp: 'fp_heavy',
  active: [.38, .5], chainFrom: 99, heavyFrom: 99, evadeFrom: .62, moveFrom: .8, turnUntil: .3,
  lunge: { from: .3, to: .46, distance: .82 }, reach: 1.55,
  hitbox: { from: 'RightForeArm', to: 'RightHand', extend: .28, radius: .27 },
  damage: 30, poise: 11, stamina: 28, hitstop: .16, push: 2.4, stagger: 1.1, next: null, armor: [.1, .5], charge: ROOT_CHARGE, ring: true
};

// --- Groveblade: a quick sword. The blade continues the forearm (hits.js). ---
const BLADE = { from: 'RightForeArm', to: 'RightHand', blade: .95, radius: .14, weapon: true };   // weapon: the model's own markers once loaded
MOVES.blade1 = { label: 'Grove Cut', clip: 'blade1', fp: 'fp_swing', duration: .52, kind: 'light',
  active: [.13, .22], chainFrom: .22, heavyFrom: .22, evadeFrom: .2, moveFrom: .36, turnUntil: .1,
  lunge: { from: .02, to: .13, distance: .55 }, reach: 1.9, hitbox: BLADE,
  damage: 12, poise: 3, stamina: 10, hitstop: .065, push: .35, stagger: .3, next: 'blade2' };
MOVES.blade2 = { label: 'Return Cut', clip: 'blade2', fp: 'fp_swing', duration: .55, kind: 'light',
  active: [.14, .23], chainFrom: .23, heavyFrom: .23, evadeFrom: .21, moveFrom: .38, turnUntil: .11,
  lunge: { from: .03, to: .14, distance: .5 }, reach: 1.9, hitbox: BLADE,
  damage: 13, poise: 3, stamina: 11, hitstop: .07, push: .4, stagger: .32, next: 'blade3' };
MOVES.blade3 = { label: 'Heartwood Thrust', clip: 'blade3', fp: 'fp_palm', duration: .7, kind: 'light',
  active: [.22, .32], chainFrom: .34, heavyFrom: .3, evadeFrom: .3, moveFrom: .48, turnUntil: .16,
  lunge: { from: .12, to: .26, distance: .95 }, reach: 2.1, hitbox: { ...BLADE, radius: .16 },
  damage: 17, poise: 5, stamina: 14, hitstop: .09, push: .8, stagger: .5, next: 'blade1' };
// The overhead split: the Groveblade's leaping and falling heavies.
const BLADE_SPLIT = { label: 'Canopy Split', clip: 'blade_heavy', fp: 'fp_heavy', duration: .9, kind: 'heavy',
  active: [.34, .44], chainFrom: 99, heavyFrom: 99, evadeFrom: .52, moveFrom: .68, turnUntil: .26,
  lunge: { from: .28, to: .4, distance: .7 }, reach: 2.1, hitbox: { ...BLADE, radius: .18 },
  damage: 24, poise: 7, stamina: 18, hitstop: .12, push: 1.4, stagger: .8, next: null, armor: [.12, .44],
  charge: null };
// The Groveblade's own heavy: a wide Crescent Sweep; held, the Verdant Spiral, a full turn that hits all around.
MOVES.blade_heavy = { label: 'Crescent Sweep', clip: 'blade_crescent', fp: 'fp_swing', duration: .85, kind: 'heavy',
  active: [.32, .5], chainFrom: 99, heavyFrom: 99, evadeFrom: .56, moveFrom: .7, turnUntil: .24,
  lunge: { from: .3, to: .44, distance: .8 }, reach: 2.2, hitbox: { ...BLADE, radius: .2 },
  damage: 24, poise: 7, stamina: 18, hitstop: .11, push: 1.5, stagger: .8, next: null, armor: [.12, .48],
  charge: { at: .2, levels: [.35, .75], max: 1.1, damage: [1, 1.3, 1.65], poise: [1, 1.6, 2.4], stamina: 6, into: 'blade_spiral' } };
MOVES.blade_spiral = { label: 'Verdant Spiral', clip: 'blade_spiral', fp: 'fp_swing', duration: 1.1, kind: 'heavy',
  active: [.34, .8], chainFrom: 99, heavyFrom: 99, evadeFrom: .86, moveFrom: .95, turnUntil: .2,
  lunge: { from: .32, to: .74, distance: 1.4 }, reach: 2.3, hitbox: { ...BLADE, radius: .22 },
  damage: 30, poise: 10, stamina: 26, hitstop: .09, push: 2, stagger: 1, next: null, armor: [.1, .8],
  charge: { at: .2, levels: [.35, .8], max: 1.3, damage: [1, 1.35, 1.75], poise: [1, 1.7, 2.6], stamina: 7 } };
MOVES.blade_dash = { ...MOVES.blade3, label: 'Running Thrust', lunge: { from: 0, to: .26, distance: 2.2 }, damage: 18, poise: 5, stamina: 14, next: 'blade1' };
MOVES.blade_dash_heavy = { ...BLADE_SPLIT, label: 'Leaping Split', lunge: { from: .1, to: .38, distance: 2.3 }, damage: 26, charge: null };
MOVES.blade_air = { ...BLADE_SPLIT, label: 'Falling Split', lunge: { from: 0, to: .36, distance: .6 }, damage: 22, poise: 10, charge: null, armor: [0, .44], airborne: true };
MOVES.blade_counter = { ...MOVES.blade3, label: 'Guard Counter', active: [.18, .28], damage: 24, poise: 10, charge: null, armor: [0, .28], next: null };
MOVES.blade_root = { ...MOVES.blade3, label: 'Root Strike', kind: 'critical', damage: 34, poise: 0, stamina: 0, hitstop: .2, armor: [0, .4], next: null, lunge: { from: .1, to: .26, distance: .9 } };

// --- Stonebreaker: a slow hammer that breaks shells (armour pierce). --------
const HAMMER = { from: 'RightForeArm', to: 'RightHand', blade: .95, radius: .3, weapon: true };
MOVES.hammer1 = { label: 'Stone Sweep', clip: 'hammer1', fp: 'fp_swing', duration: .85, kind: 'light',
  active: [.3, .42], chainFrom: .44, heavyFrom: .42, evadeFrom: .46, moveFrom: .62, turnUntil: .22,
  lunge: { from: .18, to: .34, distance: .6 }, reach: 2.0, hitbox: HAMMER,
  damage: 21, poise: 8, stamina: 18, hitstop: .11, push: 1.2, stagger: .7, next: 'hammer2', armor: [.14, .42], pierce: 1 };
MOVES.hammer2 = { label: 'Stonefall', clip: 'hammer2', fp: 'fp_heavy', duration: 1.0, kind: 'heavy',
  active: [.4, .52], chainFrom: 99, heavyFrom: 99, evadeFrom: .6, moveFrom: .8, turnUntil: .3,
  lunge: { from: .3, to: .44, distance: .7 }, reach: 2.0, hitbox: { ...HAMMER, radius: .34 },
  damage: 28, poise: 12, stamina: 22, hitstop: .15, push: 2, stagger: 1, next: null, armor: [.1, .52], pierce: 1, ring: true };
// The Stonebreaker's own heavy: the Earthsplitter, a hopping slam whose shockwave (slam) hits
// everything around the impact; held, the Faultline, a bigger, harder quake.
MOVES.hammer_heavy = { label: 'Earthsplitter', clip: 'hammer_earthsplitter', fp: 'fp_heavy', duration: 1.15, kind: 'heavy',
  active: [.48, .6], chainFrom: 99, heavyFrom: 99, evadeFrom: .74, moveFrom: .9, turnUntil: .3,
  lunge: { from: .32, to: .52, distance: 1.0 }, reach: 2.0, hitbox: { ...HAMMER, radius: .36 },
  damage: 30, poise: 13, stamina: 24, hitstop: .15, push: 2, stagger: 1, next: null, armor: [.1, .62], pierce: 1, ring: true,
  slam: { at: .54, ahead: 1.3, radius: 3.2, damage: 14, poise: 8 },
  charge: { at: .3, levels: [.35, .8], max: 1.3, damage: [1, 1.35, 1.75], poise: [1, 1.7, 2.6], stamina: 7, into: 'hammer_faultline' } };
MOVES.hammer_faultline = { ...MOVES.hammer_heavy, label: 'Faultline', damage: 40, poise: 16, stamina: 30,
  slam: { at: .54, ahead: 1.3, radius: 5, damage: 22, poise: 16 }, charge: { ...MOVES.hammer_heavy.charge, into: null } };
MOVES.hammer_dash = { ...MOVES.hammer1, label: 'Charging Sweep', lunge: { from: .05, to: .34, distance: 2.0 }, damage: 22 };
MOVES.hammer_dash_heavy = { ...MOVES.hammer2, label: 'Leaping Stonefall', lunge: { from: .1, to: .42, distance: 2.2 } };
MOVES.hammer_air = { ...MOVES.hammer2, label: 'Meteor Fall', lunge: { from: 0, to: .4, distance: .5 }, damage: 26, poise: 14, armor: [0, .52], airborne: true };
MOVES.hammer_counter = { ...MOVES.hammer1, label: 'Guard Counter', active: [.24, .36], damage: 28, poise: 14, next: null, armor: [0, .36] };
MOVES.hammer_root = { ...MOVES.hammer2, label: 'Root Strike', kind: 'critical', damage: 42, poise: 0, stamina: 0, hitstop: .22, armor: [0, .52] };

// Which move each input opens with, per weapon. Rootbound fists are the
// unarmed style; unarmed (a weapon you are not yet strong enough for) uses the
// same moves at lower power.
export const MOVESETS = {
  unarmed:      { first: 'palm', heavy: 'heel', dash_light: 'dash_palm', dash_heavy: 'dash_heel', air: 'air_heel', counter: 'guard_heel', root: 'root' },
  rootbound:    { first: 'palm', heavy: 'heel', dash_light: 'dash_palm', dash_heavy: 'dash_heel', air: 'air_heel', counter: 'guard_heel', root: 'root' },
  groveblade:   { first: 'blade1', heavy: 'blade_heavy', dash_light: 'blade_dash', dash_heavy: 'blade_dash_heavy', air: 'blade_air', counter: 'blade_counter', root: 'blade_root' },
  stonebreaker: { first: 'hammer1', heavy: 'hammer_heavy', dash_light: 'hammer_dash', dash_heavy: 'hammer_dash_heavy', air: 'hammer_air', counter: 'hammer_counter', root: 'hammer_root' }
};
export const WEAPONS = {
  rootbound: { label: 'ROOTBOUND FISTS', power: 1, note: 'Fast palm, swing and heel string.' },
  groveblade: { label: 'GROVEBLADE', power: 1, note: 'Quick three-cut chain ending in a thrust; a rising heavy.' },
  stonebreaker: { label: 'STONEBREAKER', power: 1, note: 'Slow, heavy two-hit chain; cracks shells and armour.' },
  unarmed: { label: 'BARE HANDS', power: .85, note: 'Your chosen weapon is still locked by your stats.' }
};

export const FIRST_LIGHT = 'palm';
export const HEAVY = 'heel';

export const EVADE = {
  duration: .6, invulnerable: [.04, .3], travel: { from: .03, to: .42, distance: 3.4 },
  attackFrom: .4, evadeFrom: .5, moveFrom: .46, stamina: 18,
  perfect: .16        // an attack that lands within this long of the dash starting is a perfect evade
};

export const HURT = {
  light: { duration: .42, push: .7, evadeFrom: .2, attackFrom: .3, moveFrom: .34, invulnerable: .6 },
  heavy: { duration: .95, push: 1.5, evadeFrom: .55, attackFrom: .7, moveFrom: .8, invulnerable: 1.0 }
};

export const STAMINA = { max: 100, delay: .55, regen: 26, winded: 30 };   // at 0 Breath you are winded until it refills to 30   // regen per second, scaled by Stamina stat
export const COUNTER = { window: 1.4, damage: 1.3, poise: 1.5 }; // after a perfect evade

// Guard (hold): blocks attacks from the front. Raising it just before a hit
// lands is a parry: no Breath lost and the attacker reels, open to a riposte.
export const GUARD = { arc: 1.75, parry: .18, cost: { light: 18, heavy: 40 }, chip: { light: 0, heavy: .5 }, counterWindow: .7, speed: 1.9 };
export const SPRINT = { hold: .22, speed: 1.55, drain: 13 };        // hold Shift to sprint; tap to dash
export const FLASK = { charges: 3, duration: 1.0, healAt: .6, heal: 2, moveSpeed: .35 };

/** Phase name for a time within a move, for feedback and the debug overlay. */
export function phaseOf(move, t) {
  if (t < move.active[0]) return 'startup';
  if (t < move.active[1]) return 'active';
  return 'recovery';
}

// Ease-out used for lunges and evades: fast start, soft landing.
export const easeOut = x => 1 - (1 - x) ** 3;
export function travelBetween(window, t0, t1) {
  const f = t => easeOut(Math.min(1, Math.max(0, (t - window.from) / (window.to - window.from))));
  return (f(t1) - f(t0)) * window.distance;
}
