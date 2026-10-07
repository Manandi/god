import { SITES, GATE, SHADOWMERE as SM, ROOTWAY, SEED_SHRINE } from './world.js';

// The Verdant Reach story: one questline that runs through every site on the
// lantern trail. Stages are strictly ordered; each chapter follows the same
// beat (meet the keeper → clear the hollowed → recover the memory → report),
// and every line of dialogue depends on the stage, so talking to anyone at
// any time tells you something true about where the story stands.
//
// The lore in one breath. In Built, the Heartseed grows the Verdant Reach out
// of effort: whatever is done honestly feeds its roots. A shellback hatched in
// the Rootwell, Orrun, grew vast working beside the Waymakers, carried the
// stones of the Canopy Gate, and at Mosswatch swore to keep it "until the
// forest forgets me". Then the Crown of Ashmere wanted the Reach's strength
// without the work. Its wardens at Mosswatch cut the Heartseed's roots in what
// is now the Scorched Hollow and drank. Borrowed strength never holds: it
// hollowed them out, and the rot it left, the Hollowing, spread through the
// roots, eating strength and memory alike. As the forest forgets Orrun, its
// oath runs thin, so it roots itself into the gate and drinks the forest's
// memory to stay remembered, which only spreads the rot. Only strength that
// was earned can mend what stolen strength broke: an explorer from outside,
// whose power comes from real effort, who wakes the three memories and speaks
// Orrun's true name.
//
// The saga (owner, 2026-10-05: "the story doesn't end with the Warden; leave it open and
// continuing for each world we add"). The world stands on one great root, and every realm
// grows from its own Seed, tended by a keeper. The Crown of Ashmere wanted strength without
// labour and went realm to realm taking it; each realm's Hollowing wears a different face
// (forgetting in the Reach, darkness in Shadowmere, stillness in the Frostbound Crown...).
// Each Book ends by freeing that realm's keeper and pointing to the next world:
//   Book I   The Verdant Reach   (Orrun, the Thursday hunt)          → Halden hears the roots pull west
//   Book II  Shadowmere (lv 3)    (Garrow, the Rootbound Gorilla)     → a shard of crown-glass points north
//   Book III The Frostbound Crown (lv 5) where what's left of Ashmere waits: next to be built.
// To add a world: append its stages after the last one (saves keep their place), give it a
// keeper in NPCS and a Book in progress/journal, and end on the hook into the next.
//
// Pacing (2026-10-04): every beat raises the stakes and ends on a hook. The clock
// is the Forgetting: each night Mossgate loses something (a lantern, a word, a
// name), and when the last lantern goes dark the town forgets itself. Orin thinks
// the Warden must die; the Rootwell shows wardens drinking; Ysolde confesses it
// was Mosswatch, and turns the plot: Orrun is the only thing still holding the
// rot back. Pip makes it personal (Sela forgot Pip's name), and the name tells
// you how it ends: beat it down until it can hear you, then let it rest.

/**
 * The saga's road to the end of the 90-day challenge (owner, 2026-10-05: "the chapters must
 * build on each other till the final boss at the end of the 3-month challenge, and keep going
 * after"). Levels rise about 2 a week (week n ends near level 1 + 2n, the Thursday hunt levels),
 * so each world opens on the week the challenge reaches it, and the finale lands on Thursday,
 * 31 December, the last day of the challenge.
 * Threads that carry from Book to Book:
 *  - The Five Lights: each Book ends by freeing a world's keeper, who gives you its Seed's light.
 *    The five together open the way to Ashmere.
 *  - The Hollow Crown: Ashmere's last ruler wears a crown cut from a stolen Seed and cannot be
 *    killed while its name is hidden. Each Book uncovers one piece of it, and Book V gives the
 *    name (the same rule that freed Orrun in Book I).
 * `built` marks the worlds that are playable today; the rest are the plan for the builders.
 */
export const SAGA = [
  { book: 'I', realm: 'grove', title: 'THE VERDANT REACH', level: 1, weeks: 'Oct 1 – 8', keeper: 'Orrun', light: 'the Heartseed', built: true,
    reveals: 'Ashmere bought strength without labour, through Mosswatch. The rot is its leftovers.' },
  { book: 'II', realm: 'shadow', title: 'SHADOWMERE', level: 3, weeks: 'Oct 8 – 14', keeper: 'Garrow', light: 'the Lantern Seed', built: true,
    reveals: 'Ashmere did not only drink: it put the lights out to hide where it went. Its blade was cut from a crown.' },
  { book: 'III', realm: 'frost', title: 'THE FROSTBOUND CROWN', level: 5, weeks: 'Oct 15 – Nov 4', keeper: 'the White Maw', light: 'the Rime Seed',
    reveals: 'Ashmere’s court froze itself here to wait for its ruler, the Hollow Crown, who left long ago to steal fire.' },
  { book: 'IV', realm: 'ember', title: 'THE EMBER WASTES', level: 11, weeks: 'Nov 5 – 25', keeper: 'the Pyreback Colossus', light: 'the Ember Seed',
    reveals: 'The Crown burned the Colossus to forge itself a body that cannot die, as long as no one knows its name.' },
  { book: 'V', realm: 'wraith', title: 'WRAITHMOOR', level: 17, weeks: 'Nov 26 – Dec 16', keeper: 'the Veiled Queen', light: 'the Grave Seed',
    reveals: 'The dead of Ashmere remember what the Crown was called before it was hollow: its true name.' },
  { book: 'FINALE', realm: 'crown', title: 'ASHMERE · THE HOLLOW CROWN', level: 23, weeks: 'Dec 17 – 31', keeper: 'all five keepers', light: 'the five lights together',
    reveals: 'Final boss, Thursday 31 December: every hunter together, five lights, one true name.' }
];
/** How many of the Five Lights you carry (a keeper freed in each finished Book). */
export const lightsFrom = story => (story.reached('end') ? 1 : 0) + (story.reached('frost_wait') ? 1 : 0);

const site = id => SITES.find(s => s.id === id);
const titleCase = text => text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

/**
 * The story's people. The four in Mossgate are the ChatGPT Sites town NPCs
 * (their block look, colours and places are that design); the three keepers
 * wait beside the lantern road on the approach to each site. `look` feeds
 * the block builder in npcs.js; `facing` is the yaw they idle at (+Z at 0).
 */
export const NPCS = {
  sela: { name: 'SELA', title: 'WAYFINDER OF MOSSGATE', x: -8.5, z: 57.4, facing: Math.PI * .12,
    look: { skin: 0xe0ad7f, hair: 0xb29b73, iris: 0x355468, cloth: 0x9a7451, braid: true, mouthTilt: .06 } },
  orin: { name: 'ORIN', title: 'WARDEN-CAPTAIN', x: 6.4, z: 53.6, facing: Math.PI * .92,
    look: { skin: 0x8f624a, hair: 0x76513b, iris: 0x523d2a, cloth: 0x526b79, browTilt: .12, armTilt: .13 } },
  // The id stays 'mycel' for old saves; he tends the Heartseed's roots and hears Mycel through them.
  mycel: { name: 'HALDEN', title: 'ROOTKEEPER', x: -3.2, z: 48.2, facing: Math.PI * .12,
    look: { skin: 0xc48f68, hair: 0x29302b, iris: 0x385342, cloth: 0x6f8f63, beard: true } },
  tavi: { name: 'TAVI', title: 'HERBALIST', x: 9.1, z: 43.9, facing: Math.PI * .92,
    look: { skin: 0xb97959, hair: 0x3b2925, iris: 0x4d382d, cloth: 0x7d596f, browTilt: .12, armTilt: .13 } },
  brannoch: { name: 'BRANNOCH', title: 'KEEPER OF THE ROOTWELL', x: -51, z: -31, facing: .55, scale: 1.08,
    look: { skin: 0x6e4a36, hair: 0x3a2a20, iris: 0x3b2a20, cloth: 0xa35e54, beard: true, browTilt: .12, armTilt: .13 } },
  ysolde: { name: 'YSOLDE', title: 'LAST SENTINEL OF MOSSWATCH', x: 52.5, z: -78, facing: -.54,
    look: { skin: 0xd9a77c, hair: 0xbdc5b9, iris: 0x355468, cloth: 0x576879, trousers: 0x37425e, braid: true } },
  // Book II: Shadowmere's keeper of lanterns, just inside the root arch.
  maren: { name: 'MAREN', title: 'LAMPLIGHTER OF SHADOWMERE', x: SM.x + 5.6, z: SM.z + 38.5, facing: -Math.PI / 2,
    look: { skin: 0x9a6b4f, hair: 0x2b2a35, iris: 0x7a5a22, cloth: 0x3d4f5f, trousers: 0x2c3340, braid: true, mouthTilt: .04 } },
  pip: { name: 'PIP', title: 'APPRENTICE SCOUT', x: 3, z: -140.5, facing: .61, scale: .85,
    look: { skin: 0xc48f68, hair: 0x9a5638, iris: 0x385342, cloth: 0x476f59, mouthTilt: .06 } }
};

/** A keeper's name as written in sentences: 'Brannoch'. */
export const keeperName = id => titleCase(NPCS[id].name);

/** Each chapter: its site, its keeper, the hollowed that gather there, and the memory it holds. */
export const CHAPTERS = [
  { id: 'rootwell', npc: 'brannoch', site: site('rootwell'),
    mobs: [[-68, -50, 'shellback'], [-57, -55, 'shellback'], [-71, -37, 'thornling']],
    fight: 'Clear the hollowed nest fouling the Rootwell', memory: 'Recover the memory in the Rootwell', report: 'Tell Brannoch what the spring showed you',
    memoryTitle: 'THE FIRST MEMORY · A HATCHLING IN THE SPRING',
    memoryText: 'In the first spring a shellback hatched in the Rootwell. The Waymakers did not tame it; they worked beside it. It carried the first stones of the Canopy Gate on its back, and it grew as they grew. Then the vision darkens: years later, figures in Mosswatch green kneel at this same pool with glowing cups, and where they drink the water turns black.' },
  { id: 'ruins', npc: 'ysolde', site: site('ruins'),
    mobs: [[67, -91, 'thornling'], [68, -86, 'thornling'], [58, -99, 'shellback']],
    fight: 'Drive the thornlings from the Mosswatch arches', memory: 'Listen to the oath-stone at Mosswatch', report: 'Confront Ysolde with the oath and the letter',
    memoryTitle: 'THE OATH · MOSSWATCH',
    memoryText: 'Grown vast from honest work, the shellback bowed before the Sentinels on these stones and swore: “I will keep the gate until the forest forgets me.” Behind it, the Sentinels were already reading a letter from the Crown of Ashmere. The seal on it is a cup.' },
  { id: 'shrine', npc: 'pip', site: site('shrine'),
    mobs: [[-24, -145, 'thornling'], [-19, -163, 'shellback'], [-3, -163, 'thornling'], [-26, -157, 'thornling']],
    fight: 'Clear the thornlings from the Canopy Shrine', memory: 'Find the carving in the Canopy Shrine', report: 'Tell Pip the name you found',
    memoryTitle: 'THE NAME · ORRUN',
    memoryText: 'High in the crown the Waymakers carved the name they gave it, so that it could never be lost: ORRUN, which in their tongue meant “the one who carries”. Beneath it, in a newer, shakier hand: “If it forgets, remind it. Don’t kill it.”' }
];
const chapter = id => CHAPTERS.find(c => c.id === id);

// Ordered stages. `target` is an NPC id, a chapter's site, or a point.
export const STAGES = [
  { id: 'meet_sela', objective: 'Speak with Sela in Mossgate', target: 'sela' },
  { id: 'trial', objective: 'Break the hollowed shellback past Mossgate\'s north gate', target: { x: 1, z: 27, title: 'NORTH OF MOSSGATE' } },
  { id: 'trial_report', objective: 'Report to Captain Orin', target: 'orin' },
  ...CHAPTERS.flatMap(c => [
    { id: c.id, chapter: c.id, step: 'find', objective: `Find ${keeperName(c.npc)} at ${titleCase(c.site.title).replace(/^The /, 'the ')}`, target: c.npc },
    { id: `${c.id}_fight`, chapter: c.id, step: 'fight', objective: c.fight, target: c.id },
    { id: `${c.id}_memory`, chapter: c.id, step: 'memory', objective: c.memory, target: c.id },
    { id: `${c.id}_report`, chapter: c.id, step: 'report', objective: c.report, target: c.npc }
  ]),
  { id: 'gate', objective: 'Free Orrun: on Thursday, step through the Hollow Rift in Mossgate', target: { x: 0, z: 61.6, title: 'THE HOLLOW RIFT' } },
  { id: 'end', objective: 'Orrun rests. Ask Halden what the roots are saying', target: 'mycel' },
  // ---- Book II · Shadowmere (level 3)
  { id: 'shadow_cross', book: 2, objective: 'Cross into Shadowmere through the Rootway in Mossgate (level 3)', target: { ...ROOTWAY, title: 'THE ROOTWAY' } },
  { id: 'shadow_meet', book: 2, objective: 'Find Maren the Lamplighter under the root arch', target: 'maren' },
  { id: 'shadow_hunt', book: 2, objective: 'Drive off the green monkeys stealing the lantern seeds', target: { x: SM.x, z: SM.z + 14, title: 'THE LANTERN TRAIL' }, count: ['monkeys', 3] },
  { id: 'shadow_memory', book: 2, objective: 'Find what the falls remember', target: { ...SEED_SHRINE, title: 'THE FALLS' } },
  { id: 'shadow_guardian', book: 2, objective: 'Boss fight: free Garrow, the Rootbound Gorilla, in the clearing', target: { ...SM.guardian, title: 'GARROW' } },
  { id: 'shadow_report', book: 2, objective: 'Bring the broken shard to Maren', target: 'maren' },
  // ---- Book III · The Frostbound Crown (level 5): the next world to be built. Its stages go after this one.
  { id: 'frost_wait', book: 3, objective: 'Grow to level 5: Book III, the Frostbound Crown, opens next (from Oct 15)', target: 'maren' }
];
const index = id => STAGES.findIndex(s => s.id === id);

// ------------------------------------------------------------------ dialogue
// main: the conversation that moves the story (then → next stage, spawn → the
// chapter's hollowed rise when it ends). idle: what they say otherwise, keyed
// by the stage range it applies to ('<x' before stage x, '>=x' from x on).
const DIALOGUE = {
  sela: {
    main: {
      meet_sela: { then: 'trial', lines: [
        'Keep walking, {name}, and don’t look back yet. The lantern behind you just went out.',
        'I’m Sela, the Wayfinder. I keep this road lit so the forest remembers where it leads. Every night now, something forgets. A lantern. A path. Last week, the baker’s own name. He still can’t find it.',
        'We call it the Hollowing. It eats strength and memory together, and when the last lantern on this road goes dark, Mossgate forgets itself.',
        'Mycel says you are one of the Built: whatever you earn out there, you carry in here. Earned strength is the one thing the rot can’t eat.',
        'Prove it to Captain Orin. Past the north gate is a shellback that used to follow me like a dog. It doesn’t know me any more. Break its footing, and watch the glow in its shell: that’s its tell.'
      ] }
    },
    idle: [
      ['<trial_report', 'Out the north gate, past the ward posts. Watch the glow in its shell before it moves. Dash into the strike, or hold C and meet it head on.'],
      ['<rootwell', 'Orin watched that from the wall. Go and tell him; he decides where the road starts for you.'],
      ['<ruins', 'Two lanterns went dark past the Rootwell last night. I relit them. They took longer to catch than they used to.'],
      ['<shrine', 'A hatchling that carried stone. My grandmother’s lullaby had a shellback in it who “built the door and kept the key”. I can’t remember the last verse any more. I used to sing it every night.'],
      ['<gate', 'Pip went up to the Shrine? Of course they did. That child has been hunting the Warden’s name since… since… Pip. Yes. Since Pip could climb.'],
      ['<end', 'Three memories, and the lanterns burn steadier. On Thursday the rift in the square opens. Go through with your hunters, and say its name like you mean it.'],
      ['<shadow_meet', 'A Rootway in my square, glowing like a lantern. Halden says it goes west to Shadowmere. Of course it does. Nothing stays simple once you arrive, {name}.'],
      ['>=end', 'The lanterns haven’t burned this bright since I was an apprentice. If Shadowmere’s lamplighter needs oil, tell her Mossgate sends it.']
    ]
  },
  orin: {
    main: {
      trial_report: { then: 'rootwell', lines: [
        'I watched from the wall. You read it before you swung. Most of my wardens never learn that.',
        'So here is what Sela won’t say out loud. Something holds the Canopy Gate at the end of her road. The songs call it the Warden. Its roots spread every year, and the Hollowing rides them.',
        'Kill it, and the rot may die with it. Or the gate falls and takes the forest’s memory down too. Nobody knows which. That is why nobody has tried.',
        'The forest kept three memories of the Warden: the Rootwell, Mosswatch, the Canopy Shrine. Learn what it is before you raise a blade to it.',
        'Start west, at the Rootwell. Brannoch keeps the spring and hasn’t sent word in nine days. Take Tavi’s flasks; the brazier in the square refills them.'
      ] }
    },
    idle: [
      ['<trial', 'Sela decides who walks her road. Speak with her first.'],
      ['<trial_report', 'The shellback past the north gate. Break its footing, then come back to me.'],
      ['<rootwell_report', 'Brannoch is west along the lanterns. If he is alive, he is swearing. Follow the swearing.'],
      ['<ruins', 'The ward posts glow brighter already. Whatever you woke in that spring, the roots felt it.'],
      ['<shrine', 'Mosswatch. My wardens still wear its leaf on their shoulders. If Ysolde tells you what I think she will, I will be taking mine off.'],
      ['<gate', 'I told you to learn what it was before you killed it. I didn’t expect the answer to be “the only thing holding the line.” Ashmere’s crown bought that rot, and my order carried out the purchase.'],
      ['<end', 'The rift opens Thursdays. Don’t go through alone; I have buried enough wardens who thought they could. Beat it down, then let it rest.'],
      ['>=end', 'The wards are quiet. First time in my command. Don’t tell anyone I said thank you.']
    ]
  },
  mycel: {
    main: {
      end: { then: 'shadow_cross', lines: [
        'You did it, {name}. Orrun rests, and the Heartseed has taken root in the gate. Now listen. Do you hear that?',
        'The roots are still talking. Orrun was not only holding our rot back. Something on the far side of the roots was pulling it, the way a current pulls a leaf.',
        'The Heartseed is not the only seed. The old songs name five, one for every world the great root holds up, and Orrun has just given you the first of their lights. One of the others is going dark: Shadowmere, in the green west, where the lanterns grow.',
        'I have opened a Rootway in the square. It only carries someone strong enough to come home again: level 3. Find the Lamplighter. If Shadowmere’s lights go out, our roots feel the cold next.'
      ] }
    },
    idle: [
      ['<rootwell', 'I am Halden. I tend the Heartseed’s roots beneath the square, and sometimes Mycel speaks through them. Today they say your name.'],
      ['<ruins', 'The Rootwell was the forest’s first spring. If its memory is fouled, everything downstream forgets a little. Everything, and everyone.'],
      ['<shrine', 'Mosswatch’s Sentinels swore their oaths on stone so the words would outlast them. Stone forgets too, only slowly. Ask Ysolde what else those stones heard.'],
      ['<gate', 'Now you know why the Hollowing hurts the strong first: it feeds on strength that was taken. And an oath is a root; the Warden has held on so long it cannot let go. It needs its name, and a hand whose strength is its own.'],
      ['<end', 'Names are the deepest roots. Carry that one carefully. The Heartseed will follow you to the gate.'],
      ['<frost_wait', 'The Heartseed is calm, but the roots still lean west, toward Shadowmere. Follow them, {name}. The Rootway is in the square.'],
      ['>=end', 'North. The roots under the snow are so cold they barely speak. When you are ready, the Frostbound Crown will be waiting.']
    ]
  },
  tavi: {
    main: {},
    idle: [
      ['<rootwell', 'Rest beside the green brazier in the square and I’ll bind your wounds. Stand by it and press E.'],
      ['<ruins', 'Three Sap Flasks, and the brazier refills them. Drink when it hurts, not when it’s hopeless: a flask takes a moment to go down.'],
      ['<shrine', 'Nothing grows in the Scorched Hollow east of the road. Not since before my grandmother’s time, and she never would say why. Just shook her head and said “Mosswatch.”'],
      ['<gate', 'Stolen sap is sweet for a season, then it rots you from the root. That is the whole Hollowing, in an herbalist’s words.'],
      ['<end', 'Whatever holds that gate has been sick a long time. Hit it where the shell cracks, and don’t stand in front of it when it rears.'],
      ['>=end', 'Sunmoss is sprouting at the edge of the Scorched Hollow. First green there in my lifetime.']
    ]
  },
  brannoch: {
    main: {
      rootwell: { then: 'rootwell_fight', spawn: 'rootwell', lines: [
        'Stop there. Sela sent you? Then it is worse in town than she’s saying.',
        'Nine nights ago the hollowed crawled out of my spring and nested in the pool. I have held them off the lanterns with a torch and language my mother would bury me for.',
        'That spring holds the oldest memory in the forest. If they foul it, the Reach forgets where it was born.',
        'Here they come. Clear the nest. I’ll keep the lanterns lit behind you.'
      ], cleared: [
        'Stop there. Sela sent you? Then it is worse in town than she’s saying.',
        'And you’ve cleared the nest already. Nine nights I fought them, and you walked through in one.',
        'That spring holds the oldest memory in the forest. Go on. Touch the light over the pool.'
      ] },
      rootwell_report: { then: 'ruins', lines: [
        'You have the look of someone the spring talked to.',
        'A hatchling in my water, and the Waymakers working beside it, stone by stone. The Warden was born here. It built the very gate it guards.',
        'Then tell me what the rest was. Wardens on the bank, in Mosswatch green, drinking from cups that glowed like sap? I have seen that shadow in the pool for years and told myself it was weed.',
        'Mosswatch was our own order. Ysolde is the last of them, east along the lanterns. Ask her what they drank, and watch her face when you do.'
      ] }
    },
    idle: [
      ['<rootwell', 'Turn back. The spring isn’t safe, and I haven’t time to explain it twice. Sela in Mossgate will tell you.'],
      ['<rootwell_memory', 'Keep one of them in front of you. They take turns if you let them; the clever ones wait for your back.'],
      ['<rootwell_report', 'The spring has gone quiet. The memory is yours to carry. Touch the light over the pool.'],
      ['<end', 'The wall is half up. Your townsfolk carry stone like they mean it. I only had to swear at two of them.', d => d.rootwell === 'wall'],
      ['<end', 'A shellback drank here at dawn. Looked at me a long while, then went back into the trees. Nobody swung at anybody. Strangest morning of my life.', d => d.rootwell === 'open'],
      ['<gate', 'The pool is clearing. I saw a fish this morning, the first in nine days. Tell Sela.'],
      ['<end', 'If you face the Warden, remember it hatched in this water and hauled stone for us. Tell it the spring still remembers.'],
      ['>=end', 'The spring is running sweet again. Whatever you said to that old shell, it listened.']
    ]
  },
  ysolde: {
    main: {
      ruins: { then: 'ruins_fight', spawn: 'ruins', lines: [
        'So the Rootwell runs clear and Sela sends me her errand-runner. Brannoch told you to ask what we drank. I can see it on you.',
        'I will answer. Not here, and not first. The oath-stone tells it better than I can, if the thornlings leave it standing.',
        'They were the Warden’s kin once. The Hollowing makes them forget that too, and they have taken the arches.',
        'There. They have seen you. Clear the arches. My knees swore an oath of their own years ago.'
      ], cleared: [
        'Brannoch told you to ask what we drank, and you cleared my arches before you asked. Rude, but useful.',
        'Go to the oath-stone and listen. It remembers what I have spent sixty years trying to forget.'
      ] },
      ruins_report: { then: 'shrine', lines: [
        '“Until the forest forgets me.” I kept those words sixty years and lost them. The rest I didn’t lose. I buried it.',
        'The Crown of Ashmere wanted the Reach’s strength without the labour. Mosswatch obeyed. We cut the Heartseed’s roots in the Hollow east of town and drank. I was there. I held a cup.',
        'Borrowed strength never holds. It hollowed us out, and the rot it left is the Hollowing. Not a curse from outside. Us.',
        'And the Warden? As the forest forgets it, its oath runs thin, so it roots into the gate and drinks memory to stay remembered. It isn’t killing the forest. It is the only thing still holding our rot back, and it is losing.',
        'Kill it and the rot runs free. Only its true name can release an oath like that. The Waymakers carved it in the Canopy Shrine, and a child went up there two days ago. Pip. Go, before the thornlings remember they are hungry.'
      ] }
    },
    idle: [
      ['<ruins', 'Mosswatch isn’t for wanderers. If Sela sent you, you will have news from the Rootwell first.'],
      ['<ruins_memory', 'Thornlings are quicker than shellbacks but lighter. Let the lunge land beside you, then answer.'],
      ['<ruins_report', 'Go to the oath-stone and listen closely. I have been forgetting the words myself.'],
      ['<end', 'I said it in the square. A child asked me if I was sorry. I said yes, and that sorry is where the work starts, not where it ends.', d => d.ruins === 'truth'],
      ['<end', 'Orin knows. The town does not. I keep telling myself that is kindness. Go on, the Shrine, before I talk myself out of it.', d => d.ruins === 'quiet'],
      ['<gate', 'The words are coming back to me, all of them, even the ones I would rather lose. Go on, the Shrine.'],
      ['<end', 'What we took by force, you have earned by sweat. That is the only thing that can pay the debt. When you face it, don’t only fight. Remind it.'],
      ['>=end', 'The oath is fulfilled, and the debt with it. The stones feel lighter for it.']
    ]
  },
  maren: {
    main: {
      shadow_meet: { then: 'shadow_hunt', lines: [
        'Stay in the light. Further in. There. You came through the Rootway? Then the Reach finally heard us.',
        'I am Maren. I keep Shadowmere’s lanterns. Every lantern holds a seed of light, and every night the green monkeys steal more of them.',
        'They were lantern-keepers once, like me. Gentle, clever things. Since Garrow in the clearing changed, they hoard light like it is the last food in the world.',
        'Drive off three of them and they will leave the trail alone for a while. Mind their claws: they never strike just once, and they leap farther than you think.'
      ] },
      shadow_report: { then: 'frost_wait', lines: [
        'You brought it back. Garrow is sleeping. Truly sleeping, for the first time since I was small.',
        'Look at the shard. That is not forest glass. It was cut from a crown. Ashmere came here too, and it did not come to drink. It came to put the lights out, so nobody would see where it went next.',
        'Every cut face points the same way: north, to the Frostbound Crown, where the snow never melts. Whatever is left of Ashmere is waiting up there, frozen and patient.',
        'And take this: the Lantern Seed’s light. Garrow would want you to carry it. Orrun’s and Garrow’s: two of five. The songs say whoever carries all five can walk into Ashmere itself and face the one who wears the crown. The Hollow Crown. It hides its name the way Orrun lost its own.',
        'The cold there would break you today. Grow stronger, {name}: the Rootway will open north at level 5. Until then, Shadowmere’s lanterns are yours to keep lit.'
      ] }
    },
    idle: [
      ['<shadow_meet', 'Who is there? Step into the light where I can see you.'],
      ['<shadow_memory', 'They chain their blows. Guard the first, expect the second, and the third comes faster. And if one crouches low, it is about to leap.'],
      ['<shadow_guardian', 'The falls were Garrow’s favourite place. If anything remembers what happened to it, the water does.'],
      ['<shadow_report', 'Garrow carried the light from tree to tree when I was young. Whatever is holding that sword is not Garrow. Free it, please.'],
      ['>=frost_wait', 'The Frostbound Crown. I have only seen it in drawings. White, still, and very quiet. Two lights of five, {name}. Come back stronger. I will keep a lantern lit for you.']
    ]
  },
  pip: {
    main: {
      shrine: { then: 'shrine_fight', spawn: 'shrine', lines: [
        'Oh, thank the roots, a person. A real one. Please say you’re not a thornling.',
        'I’m Pip. Apprentice scout. Sela said “absolutely not,” which I took as a maybe.',
        'I came because Sela forgot my name yesterday. A whole minute, looking at me like a stranger. Then she remembered and pretended she hadn’t.',
        'The Warden’s name is carved up in the crown. If the forest gets it back, maybe people stop losing theirs. But the thornlings guard that tree like they know what’s in it.',
        'And they’re coming. You fight, I’ll supervise. From back here. Deal? Deal.'
      ], cleared: [
        'Oh, thank the roots, a person. And you already cleared the thornlings? I was about to. Probably.',
        'I’m Pip. I came because Sela forgot my name yesterday, for a whole minute. The Warden’s name is carved in the crown, just above the light. Find it. Please.'
      ] },
      shrine_report: { then: 'gate', lines: [
        'Orrun. “The one who carries.” It had a name the whole time and we just called it the Warden.',
        'It carried the gate stones. It carried the oath. Now it carries all the rot Mosswatch made, so the gate doesn’t fall. That’s why it can’t let go.',
        'So we don’t kill it. We beat it down until it can hear us, then we say its name and let it rest. Somebody already wrote that under the carving. Somebody knew.',
        'The Hollow Rift in Mossgate’s square opens on Thursdays, when the roots run thinnest. Bring hunters. It won’t go quietly, even if part of it wants to.'
      ] }
    },
    idle: [
      ['<shrine', 'Shh! Thornlings, everywhere. Come back with somebody who knows what they’re doing. Or be that somebody.'],
      ['<shrine_memory', 'When something big rears up, jump or dash through the ring. Through! I learned that the hard way. My ribs learned it.'],
      ['<shrine_report', 'The carving is just above the light. Go on, touch it. I would, but I’m supervising.'],
      ['<end', 'I’ll be right behind you. Well, behind that rock. Which is behind you. Same thing.', d => d.shrine === 'bring'],
      ['<end', 'Orrun. Say it like you mean it. Thursday, through the rift. Don’t let it be forgotten again.'],
      ['>=end', 'You did it! Sela says I can be a real scout now. On probation. Heavy probation.']
    ]
  }
};

// ----------------------------------------------------------------- decisions
// One real choice per chapter, asked by its keeper once the memory is reported.
// Every choice is remembered: the townsfolk talk about it (GOSSIP below), and it
// changes what you say to Orrun at the gate (endingLines). Nothing is locked out
// by either answer; they change how the forest remembers what you did.
export const DECISIONS = {
  rootwell: { npc: 'brannoch', after: 'rootwell_report',
    ask: 'The spring runs clean again. So tell me, since you cleared it: do I wall it off so the hollowed never come back, or leave it open to the creatures that still remember drinking here?',
    options: [
      ['wall', 'Wall it off. The town drinks first.', ['Stone it is. Mossgate will carry them up here, every one. Fitting, for the spring that taught the Warden to carry stone.', 'If the hollowed come back, they will find a wall and a very rude man behind it.']],
      ['open', 'Leave it open. Their kin drank here first.', ['Open. Hah. My grandmother would have kissed you.', 'If a shellback comes to drink and remembers what it was, maybe that is one fewer we have to fight. I will keep the torch close all the same.']]
    ] },
  ruins: { npc: 'ysolde', after: 'ruins_report',
    ask: 'Mossgate thinks the Hollowing was a curse from outside. It was us. Do I go down and say so in the square, in front of everyone, or do I tell only Orin and let the town keep its story?',
    options: [
      ['truth', 'Tell them. All of them.', ['Then I will say it in the square, with my own mouth, and let them look at me while I do.', 'Sixty years I kept watch over a lie. I would like to spend whatever is left of them keeping watch over the truth.']],
      ['quiet', 'Tell Orin. Let the town heal first.', ['Orin, then, behind a closed door. He will take the leaf off his shoulder and nobody will know why.', 'Perhaps that is mercy. Perhaps it is cowardice wearing mercy’s cloak. I am too old to tell the difference any more.']]
    ] },
  shrine: { npc: 'pip', after: 'shrine_report',
    ask: 'So, um. Can I come to the gate? I found the name too, sort of. I would stand really far back. Or I can run home and tell Sela everything. Your call. Please say the first one.',
    options: [
      ['bring', 'Come with me, Pip. You found it first.', ['Yes! Yes. I mean, a dignified yes. I will be at the edge of the hollow, being dignified.', 'If it goes badly, I will say its name for you. Loudly. From behind a rock.']],
      ['home', 'Go home. Sela needs to hear this from you.', ['…Okay. Yeah. She should hear it from me. She will be angry, then proud. In that order.', 'Say its name properly, okay? Say it like someone is finally listening.']]
    ] }
};

// One-time remarks: when you next talk to `npc`, they mention something you did
// elsewhere. `when` gets {heard, dec, level, klass, name, objective}. Each is said once.
export const GOSSIP = [
  { id: 'g-doubt', npc: 'sela', when: c => c.heard.has('doubt'), line: 'Halden says you don’t trust Mossgate yet. Good. Neither did I, my first winter here.' },
  { id: 'g-boast', npc: 'tavi', when: c => c.heard.has('boast'), line: 'Orin tells me you can “handle the turtles.” I packed you extra sunmoss anyway. Humour me.' },
  { id: 'g-company', npc: 'pip', when: c => c.heard.has('company'), line: 'Sela said you asked her to come with you? She never leaves the road. So you get me instead. You’re welcome.' },
  { id: 'g-flasks', npc: 'orin', when: c => c.heard.has('learn-survive') && !c.heard.has('learn-fight'), line: 'Tavi says she has talked you through flasks already. Good. Ask me about fighting when you are ready; then you have both halves.' },
  { id: 'g-class', npc: 'orin', when: c => !!c.klass, line: c => `A ${c.klass.toLowerCase()}, by the way you stand. Good. Mossgate needs every kind.` },
  { id: 'g-level', npc: 'tavi', when: c => c.level >= 3, line: c => `Level ${c.level} already? Whatever you are doing out there, keep doing it. It shows in your colour.` },
  { id: 'g-wall-sela', npc: 'sela', when: c => c.dec.rootwell === 'wall', line: 'Half the town walked out to the Rootwell this morning, carrying stones for Brannoch’s wall. I have not seen Mossgate carry anything together in years.' },
  { id: 'g-open-sela', npc: 'sela', when: c => c.dec.rootwell === 'open', line: 'Brannoch left the Rootwell open. He swears a shellback came to drink at dawn, looked at him for a long time, and left without a fight.' },
  { id: 'g-wall-tavi', npc: 'tavi', when: c => c.dec.rootwell === 'wall', line: 'The walled spring runs clean. Brannoch sends water up to my stall in barrels now. I could get used to this.' },
  { id: 'g-open-tavi', npc: 'tavi', when: c => c.dec.rootwell === 'open', line: 'Bellcap is growing by the Rootwell again. The creatures that drink there are calmer, Brannoch says. For once I believe him.' },
  { id: 'g-truth-orin', npc: 'orin', when: c => c.dec.ruins === 'truth', line: 'Ysolde said it in the square. All of it. I took the leaf off my shoulder in front of everyone. Lightest thing I have ever carried.' },
  { id: 'g-quiet-orin', npc: 'orin', when: c => c.dec.ruins === 'quiet', line: 'Ysolde came to me alone. I took the leaf off in the barracks, door shut. One day I will say it in the square. Not today.' },
  { id: 'g-truth-halden', npc: 'mycel', when: c => c.dec.ruins === 'truth', line: 'The square was silent a whole evening after Ysolde spoke. Then people began carrying each other’s stones. Truth is heavy, but it bears weight.' },
  { id: 'g-quiet-halden', npc: 'mycel', when: c => c.dec.ruins === 'quiet', line: 'Orin came down to the roots last night and sat with me without a word. Whatever Ysolde told him, he is carrying it alone.' },
  { id: 'g-bring-sela', npc: 'sela', when: c => c.dec.shrine === 'bring', line: c => `Pip is going to the gate with you? Then bring that child back in one piece, ${c.name}, or don’t bother coming back yourself.` },
  { id: 'g-home-sela', npc: 'sela', when: c => c.dec.shrine === 'home', line: 'Pip came home. Told me everything twice, then fell asleep on my map table. Thank you for sending them back to me.' }
];

/** What you tell Orrun, shaped by your three decisions (the release scene's middle). */
export function endingLines(dec = {}) {
  return [
    dec.rootwell === 'open' ? 'You tell it the Rootwell is open again, that its kin can drink where it hatched. Something deep in its chest loosens.' :
      dec.rootwell === 'wall' ? 'You tell it the Rootwell is safe behind new stones, carried up by the whole town. It knows what carrying stones means.' : null,
    dec.ruins === 'truth' ? 'You tell it Mosswatch confessed, out loud, in the square. The oath it swore on those stones is answered with honesty at last.' :
      dec.ruins === 'quiet' ? 'You tell it the debt is known by the ones who needed to know. It listens, and bows a little lower.' : null,
    dec.shrine === 'bring' ? 'Pip steps up beside you and says it too, “Orrun,” voice shaking, and the old shell turns toward the child as if it remembers small hands on its back.' :
      dec.shrine === 'home' ? 'Far down the road, in Mossgate, Pip is telling the story for the third time. The name is already spreading.' : null
  ].filter(Boolean);
}

function matches(rule, stage) {
  const i = index(stage), at = rule.startsWith('>=') ? index(rule.slice(2)) : index(rule.slice(1));
  return rule.startsWith('>=') ? i >= at : i < at;
}

/**
 * Story state. `saved` is the `story` object from the save file (or nothing);
 * `memories` is the Set of recovered memory ids. Saves from before the story
 * existed carry only memories: those chapters are treated as done, and the
 * story resumes at the first chapter whose memory is still missing.
 */
export function createStory(saved, memories) {
  let stage = 'meet_sela';
  const cleared = new Set();
  const decisions = {};
  const tally = { ...(saved?.tally || {}) };        // counted objectives (Book II: monkeys driven off)
  for (const [k, v] of Object.entries(saved?.decisions || {})) if (DECISIONS[k]?.options.some(o => o[0] === v)) decisions[k] = v;
  // Saves from before Mossgate called the first stage 'meet_wren'.
  if (saved?.stage === 'meet_wren') saved = { ...saved, stage: 'meet_sela' };
  const valid = saved && index(saved.stage) >= 0;
  if (valid) {
    stage = saved.stage;
    for (const c of Array.isArray(saved.cleared) ? saved.cleared : []) if (chapter(c)) cleared.add(c);
  } else if (memories.size) {
    for (const c of CHAPTERS) if (memories.has(c.id)) cleared.add(c.id);
    stage = CHAPTERS.find(c => !memories.has(c.id))?.id || 'gate';
  }

  const story = {
    get stage() { return stage; },
    get info() { return STAGES[index(stage)]; },
    get chapter() { return chapter(STAGES[index(stage)].chapter) || null; },
    cleared, decisions, tally, migrated: !valid && memories.size > 0,
    /** Count toward a counted objective (e.g. 'monkeys'); returns true when it completes. */
    bump(key) {
      const s = STAGES[index(stage)]; if (!s.count || s.count[0] !== key) return false;
      tally[key] = (tally[key] || 0) + 1; return tally[key] >= s.count[1];
    },
    /** The objective as the HUD shows it, with a count where the stage has one. */
    get objectiveText() { const s = STAGES[index(stage)]; return s.count ? `${s.objective} (${Math.min(tally[s.count[0]] || 0, s.count[1])}/${s.count[1]})` : s.objective; },
    /** The decision this person is waiting on you for, if its chapter is reported and you haven't chosen. */
    pendingDecision(npc) {
      const e = Object.entries(DECISIONS).find(([k, d]) => d.npc === npc && !decisions[k] && index(stage) > index(d.after));
      return e ? { id: e[0], ...e[1] } : null;
    },
    decide(id, option) { if (DECISIONS[id]?.options.some(o => o[0] === option)) decisions[id] = option; },
    before(id) { return index(stage) < index(id); },
    reached(id) { return index(stage) >= index(id); },
    /** Move to a stage, skipping steps already done (cleared nests, found memories). */
    advance(to) {
      stage = to;
      for (;;) {
        const s = STAGES[index(stage)];
        if (s.step === 'fight' && cleared.has(s.chapter)) stage = STAGES[index(stage) + 1].id;
        else if (s.step === 'memory' && memories.has(s.chapter)) stage = STAGES[index(stage) + 1].id;
        else break;
      }
      return stage;
    },
    clear(id) { cleared.add(id); if (stage === `${id}_fight`) story.advance(`${id}_memory`); },
    remember(id) { if (stage === `${id}_memory`) story.advance(`${id}_report`); },
    /** Who has a story conversation waiting right now (for the marker over their head). */
    get speaker() {
      for (const [npc, d] of Object.entries(DIALOGUE)) if (d.main[stage]) return npc;
      return null;
    },
    /** The conversation an NPC has at this stage: { lines, then?, spawn? }. */
    talk(npc, name) {
      const d = DIALOGUE[npc], main = d.main[stage];
      const fill = lines => lines.map(l => l.replaceAll('{name}', name || 'wayfarer'));
      if (main) {
        const c = main.spawn && chapter(main.spawn), done = c && cleared.has(c.id);
        return { lines: fill(done && main.cleared ? main.cleared : main.lines), then: main.then, spawn: done ? null : main.spawn || null };
      }
      const idle = d.idle.find(([rule, , when]) => matches(rule, stage) && (!when || when(decisions)));
      return { lines: fill([idle ? idle[1] : '…']) };
    },
    /** For the quest tracker: the act's title and how far through its steps you are. */
    get progress() {
      const i = index(stage), s = STAGES[i];
      if (s.chapter) {
        const n = CHAPTERS.findIndex(c => c.id === s.chapter), c = CHAPTERS[n];
        return { act: `CHAPTER ${['I', 'II', 'III'][n]} · ${c.site.title}`, step: ['find', 'fight', 'memory', 'report'].indexOf(s.step), steps: 4, overall: i / (STAGES.length - 1) };
      }
      if (i < index(CHAPTERS[0].id)) return { act: 'BOOK I · PROLOGUE · THE WAYFINDER', step: i, steps: 3, overall: i / (STAGES.length - 1) };
      if (s.book === 2) { const first = index('shadow_cross'); return { act: 'BOOK II · SHADOWMERE', step: i - first, steps: index('shadow_report') - first + 1, overall: i / (STAGES.length - 1) }; }
      if (s.book === 3) return { act: 'BOOK III · THE FROSTBOUND CROWN', step: 0, steps: 1, overall: i / (STAGES.length - 1) };
      return stage === 'end' ? { act: 'BOOK I · EPILOGUE · THE FOREST REMEMBERS', step: 1, steps: 2, overall: i / (STAGES.length - 1) } : { act: 'BOOK I · FINALE · ORRUN', step: 0, steps: 1, overall: i / (STAGES.length - 1) };
    },
    /** Where the compass points. */
    target() {
      const t = STAGES[index(stage)].target;
      if (typeof t === 'string' && NPCS[t]) return { x: NPCS[t].x, z: NPCS[t].z, title: NPCS[t].name };
      if (typeof t === 'string') { const s = chapter(t).site; return { x: s.x, z: s.z, title: s.title }; }
      return t;
    },
    /** Why a memory crystal will not answer yet, or null when it will. */
    memoryLocked(id) {
      if (stage === `${id}_memory`) return null;
      const c = chapter(id), keeper = keeperName(c.npc);
      if (index(stage) < index(id)) return ['THE MEMORY IS SILENT', 'It will not answer until the story reaches it. Follow the lantern trail.'];
      if (!cleared.has(id)) return ['THE HOLLOWED GUARD THIS MEMORY', 'Drive them off before it will answer.'];
      return ['THE MEMORY WAITS', `Speak with ${keeper} first.`];
    },
    /** Journal pages: the story so far, in order, up to the current stage. */
    journal() {
      const pages = [{ title: 'PROLOGUE · THE WAYFINDER', text: 'Sela, the Wayfinder of Mossgate, keeps the lantern road. A rot called the Hollowing is eating the forest’s strength and memory: every night the town forgets something, and when the last lantern goes dark Mossgate forgets itself. She says you are one of the Built: what you earn out there, you carry in here.', open: true }];
      pages.push({ title: 'THE WARDEN', text: 'Something holds the Canopy Gate at the end of the road, and the Hollowing follows its roots. Orin says kill it, or understand it first. The forest kept three memories of it: at the Rootwell, at Mosswatch, and in the Canopy Shrine.', open: story.reached('rootwell') });
      for (const c of CHAPTERS) pages.push({ title: c.memoryTitle, text: c.memoryText, open: memories.has(c.id) });
      pages.push({ title: 'WHAT THE HOLLOWING IS', text: 'The Crown of Ashmere wanted the Reach’s strength without the labour. Mosswatch’s wardens cut the Heartseed’s roots in the Scorched Hollow and drank. Borrowed strength never holds: it hollowed them out, and its rot is the Hollowing. The Warden isn’t the rot: it is the last thing holding it back, rooting into the gate to stay remembered. Kill it and the rot runs free.', open: story.reached('shrine') });
      pages.push({ title: 'ORRUN', text: 'The Warden has a name: Orrun, the one who carries. Beat it down until it can hear you, then speak its name and let it rest. The Hollow Rift in Mossgate opens on Thursdays.', open: story.reached('gate') });
      // The saga plan beyond Shadowmere (SAGA above) stays behind the scenes: worlds appear in the
      // journal as they are built, one weekly update at a time.
      pages.push({ title: `THE FIVE LIGHTS · ${lightsFrom(story)} OF 5`, text: 'Each world rests on a Seed, tended by a keeper. Free a keeper and its light goes with you. The songs say whoever carries all five can walk into Ashmere itself.', open: story.reached('frost_wait') });
      const said = Object.entries(DECISIONS).filter(([k]) => decisions[k]).map(([k, d]) => d.options.find(o => o[0] === decisions[k])[1]);
      pages.push({ title: 'WHAT YOU DECIDED', text: said.length ? said.map(t => `“${t}”`).join(' · ') : 'Nothing yet. The keepers will ask.', open: said.length > 0 });
      pages.push({ title: 'BOOK I · THE FOREST REMEMBERS', text: 'Orrun is remembered, its watch is over, and the Heartseed has taken root in the Canopy Gate. But the roots still pull: the Heartseed is one of five seeds, one for every world the great root holds up, and one of them is going dark.', open: story.reached('end') });
      pages.push({ title: 'BOOK II · SHADOWMERE', text: 'West of the Reach lies Shadowmere, where every lantern holds a seed of light. Maren the Lamplighter keeps them, but the green monkeys, once lantern-keepers themselves, now steal and hoard the light, and Garrow, the realm’s keeper, guards the dark with a sword it never chose.', open: story.reached('shadow_meet') });
      pages.push({ title: 'THE FOURTH MEMORY · THE LAMPLIGHTERS', text: 'Garrow carried the Lantern Seed’s light from tree to tree, and the monkeys followed it like moths. Then riders in Ashmere grey came through the falls with a blade of black crown-glass. They did not drink. They fused the blade to Garrow’s hand, so the keeper’s own strength would keep the lights out for them.', open: story.reached('shadow_guardian') });
      pages.push({ title: 'THE SHARD POINTS NORTH', text: 'Garrow sleeps, and the crown-glass broke. Every cut face points north, to the Frostbound Crown, where whatever is left of Ashmere waits, frozen and patient. The Rootway north opens at level 5.', open: story.reached('frost_wait') });
      return pages;
    },
    serialize() { return { v: 2, stage, cleared: [...cleared], decisions: { ...decisions }, tally: { ...tally } }; }
  };
  story.advance(stage);
  return story;
}
