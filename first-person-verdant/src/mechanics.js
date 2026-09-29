import { profile, stats, weaponEligibility } from './profile.js';
import { MOVESETS, WEAPONS } from './combat/moves.js';

// What real-life measurements do in the game. Every system reads its numbers
// from here, and the stats screen shows this same table, so the link between
// effort and play is explicit. Classes (the ChatGPT Sites design) amplify the
// strengths you already have; they never replace them.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const devOverrides = { anyWeapon: false };

export function mechanics() {
  const s = stats(), klass = profile.appearance.discipline || 'fighter', jumpCm = profile.inputs.verticalJumpCm;
  const staminaCost = clamp(.98 - (s.stamina - 10) * .025, .62, 1.2);
  return {
    klass,
    // Strength: every strike; fighters add more on top.
    damage: 1 + clamp((s.strength - 10) * .05, -.3, .65) + (klass === 'fighter' ? Math.max(0, s.strength - 8) * .015 : 0),
    stagger: klass === 'fighter' ? 1.2 : 1,
    // Speed: running, dash distance and dash invulnerability; rangers go further.
    runSpeed: (5.1 + (s.speed - 10) * .08) * (klass === 'ranger' ? 1.06 : 1),
    guardSpeed: 3.2 + (s.speed - 10) * .04,
    dash: clamp(.86 + s.speed * .018 + (klass === 'ranger' ? .2 : 0), .85, 1.45),
    iframeBonus: clamp((s.speed - 10) * .006, 0, .06),
    // Vertical jump: jump height, and a double jump from 55 cm.
    jumpVelocity: 7.1 + Math.min(110, jumpCm) * .03,
    doubleJump: jumpCm >= 55,
    // Stamina: what actions cost, and how fast Breath returns; support recovers fastest.
    staminaCost,
    regen: (1 + (s.stamina - 10) * .04) * (klass === 'support' ? 1.38 : 1),
    // Defense: vitality and guarding; tanks get one more heart and cheaper guards.
    maxHealth: clamp(3 + Math.floor(s.defense / 7) + (klass === 'tank' ? 1 : 0), 3, 8),
    guardCost: staminaCost * (klass === 'tank' ? .7 : 1),
    // Intelligence: charged Rootbreaker power for mages, and how far memories answer.
    chargePower: klass === 'mage' ? 1 + Math.max(0, s.intelligence - 8) * .025 : 1,
    echoReach: Math.max(0, s.intelligence - 10) * .18,
    // Discipline: a better parry reward for support.
    parryReward: klass === 'support' ? 22 : 10
  };
}

/** The weapon actually in hand: the chosen one if your stats allow it (or dev mode), else bare hands. */
export function equippedWeapon() {
  const chosen = profile.appearance.weapon || 'rootbound';
  return devOverrides.anyWeapon || weaponEligibility(chosen).ok ? chosen : 'unarmed';
}
export const movesetFor = weapon => MOVESETS[weapon] || MOVESETS.unarmed;
export const weaponPower = weapon => WEAPONS[weapon]?.power ?? 1;

/** Plain-language rows for the stats screen. */
export function mechanicsTable() {
  const m = mechanics(), pct = v => `${v >= 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
  return [
    ['STRENGTH', `Strike damage ${pct(m.damage)}`],
    ['SPEED', `Run ${m.runSpeed.toFixed(1)} m/s · dash ${pct(m.dash)} · dash i-frames +${Math.round(m.iframeBonus * 1000)} ms`],
    ['VERTICAL JUMP', `Jump ${(m.jumpVelocity ** 2 / 44).toFixed(2)} m · ${m.doubleJump ? 'DOUBLE JUMP' : `double jump at 55 cm (${profile.inputs.verticalJumpCm} cm now)`}`],
    ['STAMINA', `Action cost ${pct(m.staminaCost)} · Breath recovery ${pct(m.regen)}`],
    ['DEFENSE', `${m.maxHealth} vitality · guard cost ${pct(m.guardCost)}`],
    ['INTELLIGENCE', `Rootbreaker charge ${pct(m.chargePower)} · memories answer from +${m.echoReach.toFixed(1)} m`],
    ['CLASS', `${m.klass.toUpperCase()} · parry restores ${m.parryReward} Breath`],
    ['WEAPON', `${WEAPONS[equippedWeapon()].label} · ${WEAPONS[equippedWeapon()].note}`]
  ];
}
