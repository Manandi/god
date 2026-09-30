import { profile, stats, weaponEligibility, frame, FRAMES, level, units } from './profile.js';
import { MOVESETS, WEAPONS, FLASK } from './combat/moves.js';

// What real-life measurements do in the game. Every system reads its numbers
// from here, and the stats screen shows this same table, so the link between
// effort and play is explicit. Classes (the ChatGPT Sites design) amplify the
// strengths you already have; they never replace them.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const devOverrides = { anyWeapon: false };

// Abilities: each stat unlocks one at 12 and a stronger one at 16. Stats move
// with the monthly test (plus Growth and the body-goal bonus), so a better test
// can unlock the next one.
export const ABILITIES = [
  { id: 'crushing', stat: 'strength', at: 12, name: 'CRUSHING BLOWS', text: 'Strikes break poise 25% faster.', apply: m => { m.poise *= 1.25; } },
  { id: 'titan', stat: 'strength', at: 16, name: "TITAN'S STRIKE", text: 'Charged heavies deal 20% more damage.', apply: m => { m.chargedDamage *= 1.2; } },
  { id: 'fleet', stat: 'speed', at: 12, name: 'FLEET FOOT', text: 'Run 6% faster.', apply: m => { m.runSpeed *= 1.06; } },
  { id: 'afterimage', stat: 'speed', at: 16, name: 'AFTERIMAGE', text: 'Dodges stay invulnerable 40 ms longer.', apply: m => { m.iframeBonus += .04; } },
  { id: 'lungs', stat: 'stamina', at: 12, name: 'DEEP LUNGS', text: 'Breath returns 20% faster.', apply: m => { m.regen *= 1.2; } },
  { id: 'tireless', stat: 'stamina', at: 16, name: 'TIRELESS', text: 'Every action costs 12% less Breath.', apply: m => { m.staminaCost *= .88; m.guardCost *= .88; } },
  { id: 'bark', stat: 'defense', at: 12, name: 'BARKSKIN', text: '+1 vitality.', apply: m => { m.maxHealth += 1; } },
  { id: 'rooted', stat: 'defense', at: 16, name: 'ROOTED GUARD', text: 'Guarding costs 25% less Breath.', apply: m => { m.guardCost *= .75; } },
  { id: 'tell', stat: 'intelligence', at: 12, name: 'READ THE TELL', text: 'The parry window is 60 ms longer.', apply: m => { m.parryBonus += .06; } },
  { id: 'alchemy', stat: 'intelligence', at: 16, name: 'SAP ALCHEMY', text: 'Sap Flasks heal 1 more.', apply: m => { m.flaskHeal += 1; } },
  { id: 'steady', stat: 'discipline', at: 12, name: 'STEADY HANDS', text: '+1 Sap Flask.', apply: m => { m.flasks += 1; } },
  { id: 'unbroken', stat: 'discipline', at: 16, name: 'UNBROKEN WILL', text: 'Once per rest, a blow that would drop you leaves you standing.', apply: m => { m.secondWind = true; } }
];
export const unlockedAbilities = (s = stats()) => ABILITIES.filter(a => s[a.stat] >= a.at);
// Workout XP levels: enemies get 15% more health per level (creatures.js), and
// your strikes grow in step, so you keep pace; every fourth level adds vitality.
export const levelDamage = (lv = level()) => 1 + (lv - 1) * .15;
export const levelVitality = (lv = level()) => Math.min(2, Math.floor(lv / 4));

export function mechanics() {
  const s = stats(), klass = profile.appearance.discipline || 'fighter', jumpCm = profile.inputs.verticalJumpCm, body = frame();
  const staminaCost = clamp(.98 - (s.stamina - 10) * .025, .62, 1.2);
  const m = {
    klass, frame: body,
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
    parryReward: klass === 'support' ? 22 : 10,
    steadfast: false, secondWind: false,
    poise: 1, chargedDamage: 1, parryBonus: 0, flasks: FLASK.charges, flaskHeal: FLASK.heal, abilities: []
  };
  // Frames (weight and height): every body gets a real advantage.
  if (body === 'stone') { m.maxHealth = Math.min(9, m.maxHealth + 1); m.steadfast = true; m.guardCost *= .85; }
  if (body === 'swift') { m.runSpeed *= 1.07; m.dash *= 1.15; m.iframeBonus += .02; }
  if (body === 'balanced') { m.regen *= 1.15; m.secondWind = true; }
  // Workout level, then the abilities your stats have unlocked.
  m.level = level(); m.damage *= levelDamage(m.level); m.maxHealth += levelVitality(m.level);
  for (const a of unlockedAbilities(s)) { a.apply(m); m.abilities.push(a.id); }
  m.maxHealth = Math.min(12, m.maxHealth);
  return m;
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
    ['SPEED', `Run ${units.speed(m.runSpeed)} · dash ${pct(m.dash)} · dash i-frames +${Math.round(m.iframeBonus * 1000)} ms`],
    ['VERTICAL JUMP', `Jump ${units.short(m.jumpVelocity ** 2 / 44)} · ${m.doubleJump ? 'DOUBLE JUMP' : `double jump at ${units.cm(55)} (${units.cm(profile.inputs.verticalJumpCm)} now)`}`],
    ['STAMINA', `Action cost ${pct(m.staminaCost)} · Breath recovery ${pct(m.regen)}`],
    ['DEFENSE', `${m.maxHealth} vitality · guard cost ${pct(m.guardCost)}`],
    ['INTELLIGENCE', `Rootbreaker charge ${pct(m.chargePower)} · ${m.echoReach > 0 ? `memories answer from ${units.short(m.echoReach)} farther` : 'memories answer from farther at INT 11+'}`],
    ['CLASS', `${m.klass.toUpperCase()} · parry restores ${m.parryReward} Breath`],
    ['FRAME', `${FRAMES[m.frame].label} · ${FRAMES[m.frame].bonus}`],
    ['WEAPON', `${WEAPONS[equippedWeapon()].label} · ${WEAPONS[equippedWeapon()].note}`],
    ['LEVEL', `LV ${m.level} · strikes ${pct(levelDamage(m.level))} to keep pace with enemies (+15% health per level)${levelVitality(m.level) ? ` · +${levelVitality(m.level)} vitality` : ' · +1 vitality at LV 4'}`],
    ['ABILITIES', m.abilities.length ? ABILITIES.filter(a => m.abilities.includes(a.id)).map(a => a.name).join(' · ') : 'None yet · a stat of 12 unlocks the first']
  ];
}
