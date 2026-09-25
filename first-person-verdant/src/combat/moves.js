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
export const FIRST_LIGHT = 'palm';
export const HEAVY = 'heel';

export const EVADE = {
  duration: .6, invulnerable: [.04, .3], travel: { from: .03, to: .42, distance: 3.4 },
  attackFrom: .4, evadeFrom: .5, moveFrom: .46, stamina: 18,
  perfect: .16        // an attack that lands within this long of the roll starting is a perfect evade
};

export const HURT = {
  light: { duration: .42, push: .7, evadeFrom: .2, attackFrom: .3, moveFrom: .34, invulnerable: .6 },
  heavy: { duration: .95, push: 1.5, evadeFrom: .55, attackFrom: .7, moveFrom: .8, invulnerable: 1.0 }
};

export const STAMINA = { max: 100, delay: .55, regen: 26 };   // regen per second, scaled by Stamina stat
export const COUNTER = { window: 1.4, damage: 1.3, poise: 1.5 }; // after a perfect evade

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
