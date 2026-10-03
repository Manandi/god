// Class moves, earned with levels (owner's design, 2026-10-03): every class learns a
// move at level 3 (key G) and another at level 5 (key T). They work with any weapon.
// A hybrid (unlocked: 12 in both stats) takes its first class's level-3 move on G and
// its second class's level-3 move on T (at level 5), so it blends both classes.
//
// Moves that help teammates (War Cry, Barkshield, Mending Bloom, Second Spring)
// reach friends through the co-op channel as `support` messages (coop.js); each
// game applies what reaches its own explorer (main.js applySupport).

export const SKILLS = {
  fighter: [
    { id: 'whirlwind', level: 3, name: 'Whirlwind', text: 'A spinning heavy blow that hits everything within 3 m.', cooldown: 9, stamina: 22 },
    { id: 'warcry', level: 5, name: 'War Cry', text: 'You and every hunter within 9 m deal 25% more damage for 10 s.', cooldown: 30, stamina: 10 }
  ],
  tank: [
    { id: 'barkshield', level: 3, name: 'Barkshield', text: 'Bark armour on you and the nearest hunter within 10 m: it soaks the next 2 hits (12 s).', cooldown: 20, stamina: 12 },
    { id: 'rootstomp', level: 5, name: 'Root Stomp', text: 'Slam the ground: everything within 4 m staggers and loses its footing.', cooldown: 12, stamina: 18 }
  ],
  ranger: [
    { id: 'volley', level: 3, name: 'Volley', text: 'Loose five arrows in a fan.', cooldown: 8, stamina: 16 },
    { id: 'windstep', level: 5, name: 'Wind Step', text: 'For 8 s: 30% faster, and dashes cost no Breath.', cooldown: 22, stamina: 0 }
  ],
  mage: [
    { id: 'sporenova', level: 3, name: 'Spore Nova', text: 'Spores erupt at your target (or 6 m ahead): heavy damage within 3 m.', cooldown: 9, stamina: 18 },
    { id: 'snare', level: 5, name: 'Rooting Snare', text: 'Roots seize everything within 4 m of your target: they reel, open to a Root Strike.', cooldown: 18, stamina: 16 }
  ],
  support: [
    { id: 'mend', level: 3, name: 'Mending Bloom', text: 'Heal 1 heart for you and every hunter within 9 m.', cooldown: 14, stamina: 10 },
    { id: 'secondspring', level: 5, name: 'Second Spring', text: 'For 15 s, you and every hunter within 9 m survive one fatal blow with 1 heart.', cooldown: 45, stamina: 10 }
  ]
};

/**
 * The two move slots for a path. `classes` is [primary] or [primary, secondary]
 * (an unlocked hybrid). Returns [{ key, skill, level, unlocked }].
 */
export function skillSlots(classes, level) {
  const [a, b] = classes, first = SKILLS[a] || SKILLS.fighter;
  const g = first[0], t = b ? (SKILLS[b] || first)[0] : first[1];
  return [
    { key: 'G', skill: g, level: 3, unlocked: level >= 3 },
    { key: 'T', skill: t, level: 5, unlocked: level >= 5 }
  ];
}
