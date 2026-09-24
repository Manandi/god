// Timing data for the explorer's unarmed style. Every number is in seconds
// from the start of the move, and the animation clip of the same name is keyed
// to the same timeline, so what you see is what the hit check uses.
//
// Phases:  startup [0, active[0])  ·  active [active[0], active[1])  ·  recovery
// Windows: chainFrom   a buffered attack starts the next strike from here
//          evadeFrom   a buffered evade cancels the rest of the move from here
//          moveFrom    movement input ends the move (back to locomotion)
//          turnUntil   the body can still turn toward the target until here

export const MOVES = {
  palm: {
    label: 'Sapling Palm', clip: 'palm', duration: .46,
    active: [.09, .17], chainFrom: .17, evadeFrom: .17, moveFrom: .3, turnUntil: .09,
    lunge: { from: .02, to: .13, distance: .5 }, reach: 1.25,
    hitbox: { from: 'LeftForeArm', to: 'LeftHand', extend: .1, radius: .17 },
    damage: 1, hitstop: .075, push: .3, stagger: .3, next: 'swing'
  },
  swing: {
    label: 'Bough Swing', clip: 'swing', duration: .6,
    active: [.16, .25], chainFrom: .25, evadeFrom: .25, moveFrom: .42, turnUntil: .15,
    lunge: { from: .08, to: .21, distance: .42 }, reach: 1.1,
    hitbox: { from: 'RightForeArm', to: 'RightHand', extend: .08, radius: .2 },
    damage: 1, hitstop: .09, push: .5, stagger: .38, next: 'heel'
  },
  heel: {
    label: 'Taproot Heel', clip: 'heel', duration: .82,
    active: [.24, .34], chainFrom: 99, evadeFrom: .46, moveFrom: .62, turnUntil: .2,
    lunge: { from: .16, to: .3, distance: .55 }, reach: 1.35,
    hitbox: { from: 'RightLeg', to: 'RightFoot', extend: .12, radius: .19 },
    damage: 2, hitstop: .13, push: 1.7, stagger: .85, next: null
  }
};
export const FIRST_MOVE = 'palm';

export const EVADE = {
  duration: .6, invulnerable: [.04, .34], travel: { from: .03, to: .42, distance: 3.4 },
  attackFrom: .4, evadeFrom: .5, moveFrom: .46, stamina: 22
};

export const HURT = { duration: .42, push: .7, evadeFrom: .2, attackFrom: .3, moveFrom: .34, invulnerable: .7 };

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
