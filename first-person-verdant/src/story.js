import { SITES, GATE } from './world.js';

// The Verdant Reach story: one questline that runs through every site on the
// lantern trail. Stages are strictly ordered; each chapter follows the same
// beat (meet the keeper → clear the hollowed → recover the memory → report),
// and every line of dialogue depends on the stage, so talking to anyone at
// any time tells you something true about where the story stands.
//
// The lore in one breath: the Waymakers raised a shellback hatched in the
// Rootwell, and at Mosswatch it swore to keep the Canopy Gate "until the
// forest forgets me". Now the Hollowing rots the forest's memory; as the
// forest forgets it, the Warden roots itself into the gate to stay
// remembered, draining its kin (the shellbacks and thornlings) into savagery.
// Its true name, hidden in the Canopy Shrine, is the only thing that can
// release the oath.

const site = id => SITES.find(s => s.id === id);
const titleCase = text => text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

/** Keepers of the trail. Positions sit beside the lantern trail on the approach to each site. */
export const NPCS = {
  wren: { name: 'WREN', title: 'THE WAYMAKER', x: -3.6, z: 33.4, yaw: 2.6, scale: 1,
    appearance: { skinIndex: 1, face: 'sharp', hairStyle: 'braid', hairColor: 'silver', shirt: 'ochre', pants: 'umber', outfit: 'warden' } },
  brannoch: { name: 'BRANNOCH', title: 'KEEPER OF THE ROOTWELL', x: -51, z: -31, yaw: 2.2, scale: 1.05,
    appearance: { skinIndex: 5, face: 'round', hairStyle: 'curly', hairColor: 'earth', shirt: 'clay', pants: 'charcoal', outfit: 'ranger' } },
  ysolde: { name: 'YSOLDE', title: 'LAST SENTINEL OF MOSSWATCH', x: 52.5, z: -78, yaw: -2.4, scale: 1,
    appearance: { skinIndex: 3, face: 'sharp', hairStyle: 'tied', hairColor: 'silver', shirt: 'slate', pants: 'indigo', outfit: 'warden' } },
  pip: { name: 'PIP', title: 'APPRENTICE SCOUT', x: 3, z: -140.5, yaw: .6, scale: .9,
    appearance: { skinIndex: 2, face: 'round', hairStyle: 'swept', hairColor: 'copper', shirt: 'moss', pants: 'olive', outfit: 'ranger' } }
};

/** A keeper's name as written in sentences: 'Brannoch'. */
export const keeperName = id => titleCase(NPCS[id].name);

/** Each chapter: its site, its keeper, the hollowed that gather there, and the memory it holds. */
export const CHAPTERS = [
  { id: 'rootwell', npc: 'brannoch', site: site('rootwell'),
    mobs: [[-68, -50, 'shellback'], [-57, -55, 'shellback'], [-71, -37, 'thornling']],
    fight: 'Clear the hollowed nest at the Rootwell', memory: 'Recover the memory in the Rootwell', report: 'Tell Brannoch what the spring remembered',
    memoryTitle: 'THE FIRST MEMORY · A HATCHLING IN THE SPRING',
    memoryText: 'In the first spring a shellback hatched in the Rootwell. The Waymakers knelt in the water around it, and it followed them up the trail.' },
  { id: 'ruins', npc: 'ysolde', site: site('ruins'),
    mobs: [[67, -91, 'thornling'], [68, -86, 'thornling'], [58, -99, 'shellback']],
    fight: 'Drive the thornlings from the Mosswatch arches', memory: 'Listen to the oath-stone at Mosswatch', report: 'Tell Ysolde the words of the oath',
    memoryTitle: 'THE OATH · MOSSWATCH',
    memoryText: 'Grown vast, the shellback bowed before the Sentinels on these stones and swore: “I will keep the gate until the forest forgets me.”' },
  { id: 'shrine', npc: 'pip', site: site('shrine'),
    mobs: [[-24, -145, 'thornling'], [-19, -163, 'shellback'], [-3, -163, 'thornling'], [-26, -157, 'thornling']],
    fight: 'Clear the thornlings from the Canopy Shrine', memory: 'Find the carving in the Canopy Shrine', report: 'Tell Pip the name you found',
    memoryTitle: 'THE NAME · ORRUN',
    memoryText: 'High in the crown the Waymakers carved the name they gave it, so that it could never be lost: ORRUN.' }
];
const chapter = id => CHAPTERS.find(c => c.id === id);

// Ordered stages. `target` is an NPC id, a chapter's site, or a point.
export const STAGES = [
  { id: 'meet_wren', objective: 'Speak with Wren at the trail camp', target: 'wren' },
  { id: 'trial', objective: 'Drive back the shellback on the slope below camp', target: { x: 1, z: 27, title: 'THE CAMP SLOPE' } },
  { id: 'trial_report', objective: 'Return to Wren', target: 'wren' },
  ...CHAPTERS.flatMap(c => [
    { id: c.id, chapter: c.id, step: 'find', objective: `Find ${keeperName(c.npc)} at ${titleCase(c.site.title).replace(/^The /, 'the ')}`, target: c.npc },
    { id: `${c.id}_fight`, chapter: c.id, step: 'fight', objective: c.fight, target: c.id },
    { id: `${c.id}_memory`, chapter: c.id, step: 'memory', objective: c.memory, target: c.id },
    { id: `${c.id}_report`, chapter: c.id, step: 'report', objective: c.report, target: c.npc }
  ]),
  { id: 'gate', objective: 'Face the Hollow Warden at the Canopy Gate', target: { ...GATE, title: 'THE CANOPY GATE' } },
  { id: 'end', objective: 'The Canopy Gate stands open', target: { ...GATE, title: 'THE CANOPY GATE' } }
];
const index = id => STAGES.findIndex(s => s.id === id);

// ------------------------------------------------------------------ dialogue
// main: the conversation that moves the story (then → next stage, spawn → the
// chapter's hollowed rise when it ends). idle: what they say otherwise, keyed
// by the stage range it applies to ('<x' before stage x, '>=x' from x on).
const DIALOGUE = {
  wren: {
    main: {
      meet_wren: { then: 'trial', lines: [
        'Easy, {name}. You came up the old trail. Nobody has done that since the lanterns started going out.',
        'I am Wren, the last of the Waymakers. We kept this trail lit so the forest would remember where it leads.',
        'It is forgetting anyway. There is a rot in the roots, the Hollowing. It eats memory, and anything that forgets what it is turns savage.',
        'Even the shellbacks. They used to follow us up this trail like dogs. The one on the slope below doesn’t know me anymore.',
        'Before I send you deeper, show me you can stand your ground. Break its footing and drive it back. Watch the glow in its shell: that is its tell.'
      ] },
      trial_report: { then: 'rootwell', lines: [
        'Good. You read it instead of just swinging. The deeper roots will ask the same of you.',
        'Here is what I know. Something sleeps beneath the Canopy Gate at the end of this trail. The old songs call it the Warden. The Hollowing began there.',
        'The forest kept three memories of the Warden: one in the Rootwell, one at Mosswatch, one in the crown of the Canopy Shrine. If the forest remembers it, perhaps it will remember itself.',
        'Start at the Rootwell, west along the lanterns. Brannoch keeps the spring there. He hasn’t sent word in nine days.',
        'And take these Sap Flasks. The trail stone here refills them whenever you pass back through camp.'
      ] }
    },
    idle: [
      ['<trial_report', 'Watch the glow in its shell before it moves. Roll into the strike, not away from it, or hold C and meet it head on.'],
      ['<ruins', 'Brannoch is as stubborn as bark. If he has gone quiet, it is because he is too busy to talk. I tell myself that, anyway.'],
      ['<shrine', 'Ysolde was a Sentinel of Mosswatch when I was a girl. If anyone still knows the Warden’s oath word for word, it is her.'],
      ['<gate', 'Pip went up to the Shrine? Of course they did. That child has been hunting the Warden’s name since they could climb.'],
      ['<end', 'Three memories. The lanterns are burning steadier already. Go, {name}, and say its name when it matters.'],
      ['>=end', 'The lanterns haven’t burned this bright since I was an apprentice. The trail goes on past the gate now, and so will you.']
    ]
  },
  brannoch: {
    main: {
      rootwell: { then: 'rootwell_fight', spawn: 'rootwell', lines: [
        'Stop there. Wren sent you? Then she is more worried than she lets on.',
        'The hollowed crawled up out of the spring nine nights ago and nested in the pool like it was theirs. I have been keeping them off the lanterns with a torch and bad language.',
        'The spring holds the first memory, the oldest thing this forest knows. If they foul it, it is gone.',
        'Here they come. Clear the nest. I’ll keep the lanterns lit behind you.'
      ], cleared: [
        'Stop there. Wren sent you? Then she is more worried than she lets on.',
        'You cleared the nest already? Nine nights I’ve fought them, and you walk through in one.',
        'The spring holds the first memory, the oldest thing this forest knows. Go on. Touch the light over the pool.'
      ] },
      rootwell_report: { then: 'ruins', lines: [
        'You have that look. The spring showed you something.',
        'A hatchling in the water, and the first Waymakers kneeling around it. So that is where the Warden came from. It was born here, in my spring.',
        'My grandmother used to say the Warden never guarded the gate for the Waymakers. It guarded it because it loved this forest, and it swore an oath to it at Mosswatch.',
        'Ysolde keeps the oath-stones there, east along the lanterns. Mind the thornlings. Mosswatch was always theirs, but they never used to bite.'
      ] }
    },
    idle: [
      ['<rootwell', 'Turn back. The spring isn’t safe, and I haven’t time to explain it twice. Wren at the camp will tell you.'],
      ['<rootwell_memory', 'Keep one of them in front of you. They take turns if you let them; the clever ones wait for your back.'],
      ['<rootwell_report', 'The spring has gone quiet. The memory is yours to carry. Touch the light over the pool.'],
      ['<gate', 'The pool is clearing. I saw a fish this morning, the first in nine days. Tell Wren.'],
      ['<end', 'If you face the Warden, remember it hatched in this water. Tell it the spring still remembers.'],
      ['>=end', 'The spring is running sweet again. Whatever you said to that old shell, it listened.']
    ]
  },
  ysolde: {
    main: {
      ruins: { then: 'ruins_fight', spawn: 'ruins', lines: [
        'Another of Wren’s errand-runners. The Rootwell runs clear, then? Good. Then it is Mosswatch’s turn.',
        'I was the last Sentinel sworn on these stones. Each of us took an oath here, and the Warden took the first.',
        'The thornlings have taken the arches. They were the Warden’s kin once, and the Hollowing is making them forget that too.',
        'There, they have seen you. Clear the arches and the oath-stone will speak. My knees swore an oath of their own years ago.'
      ], cleared: [
        'Another of Wren’s errand-runners, and one who fights before introductions. The arches are clear.',
        'Each Sentinel took an oath on these stones, and the Warden took the first. Go to the oath-stone and listen. I have been forgetting the words myself.'
      ] },
      ruins_report: { then: 'shrine', lines: [
        '“Until the forest forgets me.” I had lost those words. I kept them for sixty years and lost them.',
        'Don’t you see? That is the Hollowing. As the forest forgets the Warden, its oath runs out. So it roots itself into the gate to hold on, and drinks the forest’s memory to stay remembered.',
        'It isn’t cruel. It is frightened, and it is taking the whole forest down with it.',
        'Only its true name can release an oath like that. The Waymakers hid the name in the crown of the Canopy Shrine.',
        'A young scout went up there already. Pip. Wren’s stories got into their head. North along the lanterns.'
      ] }
    },
    idle: [
      ['<ruins', 'Mosswatch isn’t for wanderers. If Wren sent you, you will have news from the Rootwell first.'],
      ['<ruins_memory', 'Thornlings are quicker than shellbacks but lighter. Let the lunge land beside you, then answer.'],
      ['<ruins_report', 'Go to the oath-stone and listen closely. I have been forgetting the words myself.'],
      ['<gate', 'The words are coming back to me, all of them. Go on, the Shrine.'],
      ['<end', 'When you face it, don’t only fight. Remind it.'],
      ['>=end', 'The oath is fulfilled. The stones feel lighter for it.']
    ]
  },
  pip: {
    main: {
      shrine: { then: 'shrine_fight', spawn: 'shrine', lines: [
        'Oh, thank the roots, a person. A real one. Please say you’re not a thornling.',
        'I’m Pip. Scout. Well, apprentice scout. Well, Wren said “absolutely not,” which I took as a maybe.',
        'The Warden’s name is carved up in the crown. I climbed halfway, saw the carving, and then the thornlings came out of the roots and I came down a lot faster than I went up.',
        'They guard the tree like they know what is in it. Maybe some part of them does.',
        'And they’re coming this way. You fight, I’ll supervise. From back here. Deal? Deal.'
      ], cleared: [
        'Oh, thank the roots, a person. And you already cleared the thornlings? I was about to. Probably.',
        'I’m Pip, apprentice scout. The Warden’s name is carved in the crown, just above the light. Go on, find it.'
      ] },
      shrine_report: { then: 'gate', lines: [
        'Orrun. It’s called Orrun. I have said “the Warden” my whole life and it had a name the entire time.',
        'You know what that means? It isn’t a monster. It’s someone who got forgotten.',
        'The gate is just north-east of here. Say its name and maybe it stops. Or maybe it hits you really hard. Honestly, could go either way.',
        'I’m going back to tell Wren. She will be so angry I came up here, and then so proud. In that order.'
      ] }
    },
    idle: [
      ['<shrine', 'Shh! Thornlings, everywhere. Come back with somebody who knows what they’re doing. Or be that somebody.'],
      ['<shrine_memory', 'When a shellback rears up, jump or roll through the ring. Through! I learned that the hard way. My ribs learned it.'],
      ['<shrine_report', 'The carving is just above the light. Go on, touch it. I would, but I’m supervising.'],
      ['<end', 'Orrun. Say it like you mean it. Don’t let it be forgotten again.'],
      ['>=end', 'You did it! Wren says I can be a real scout now. On probation. Heavy probation.']
    ]
  }
};

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
  let stage = 'meet_wren';
  const cleared = new Set();
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
    cleared, migrated: !valid && memories.size > 0,
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
      const idle = d.idle.find(([rule]) => matches(rule, stage));
      return { lines: fill([idle ? idle[1] : '…']) };
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
      const pages = [{ title: 'PROLOGUE · THE WAYMAKER', text: 'Wren, the last Waymaker, keeps the lantern trail. A rot called the Hollowing is eating the forest’s memory, and the creatures that forget turn savage.', open: true }];
      pages.push({ title: 'THE WARDEN', text: 'Something sleeps beneath the Canopy Gate. The forest kept three memories of it: at the Rootwell, at Mosswatch, and in the Canopy Shrine.', open: story.reached('rootwell') });
      for (const c of CHAPTERS) pages.push({ title: c.memoryTitle, text: c.memoryText, open: memories.has(c.id) });
      pages.push({ title: 'WHAT THE HOLLOWING IS', text: 'As the forest forgets the Warden, its oath runs out. It has rooted itself into the gate and drinks the forest’s memory to stay remembered. Only its name can release it.', open: story.reached('shrine') });
      pages.push({ title: 'ORRUN', text: 'The Warden has a name. Carry it to the Canopy Gate.', open: story.reached('gate') });
      pages.push({ title: 'THE FOREST REMEMBERS', text: 'Orrun is remembered, its watch is over, and the Canopy Gate stands open.', open: story.reached('end') });
      return pages;
    },
    serialize() { return { v: 2, stage, cleared: [...cleared] }; }
  };
  story.advance(stage);
  return story;
}
