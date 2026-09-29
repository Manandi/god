// Mossgate Chronicles and dialogue choices (the ChatGPT Sites design).
//
// The main story (story.js) is the forest's history: the Warden, its oath and
// its name. The Chronicles are Mossgate's: four side quests the townsfolk give
// through dialogue choices. The first three complete when you recover the
// memory at their site (which the main story also takes you to); the fourth is
// the hunt for the Old Shell. Turning each one in adds the town's side of the
// history to the journal.

export const CHRONICLES = [
  { id: 'water-remembers', giver: 'sela', site: 'rootwell', title: 'THE WATER REMEMBERS',
    opening: 'The Rootwell has gone silent beneath hungry guardians. When you clear the spring, listen to what its water kept, and bring its meaning back to Mossgate.',
    accept: 'I will listen to the Rootwell.', accepted: 'Follow the lantern road north-west. The memory will not speak while its guardians stand.',
    turnin: 'I heard the Rootwell memory.', complete: 'A hatchling in the spring… and Mossgate was founded by refugees who drank from that same water. We chose shelter over conquest because something older had sheltered us first.' },
  { id: 'broken-oath', giver: 'orin', site: 'ruins', title: 'THE BROKEN OATH',
    opening: 'Mosswatch was our shield before pride hollowed it out. Bring back the truth of what happened there.',
    accept: 'I will reclaim Mosswatch.', accepted: 'Break the pack around the ruins. The stones will show you why the old wardens failed.',
    turnin: 'I saw what happened at Mosswatch.', complete: 'The Warden kept its oath while Mosswatch’s wardens obeyed a distant crown and abandoned their neighbours. Mossgate survives because we never made that choice again.' },
  { id: 'name-beneath-bark', giver: 'mycel', site: 'shrine', title: 'THE NAME BENEATH BARK',
    opening: 'The Canopy Shrine guards the last name this forest kept. Wake that memory, and our road opens.',
    accept: 'I will wake the Canopy Shrine.', accepted: 'The oldest trail runs north. Clear its guardians, then let the memory speak.',
    turnin: 'The Shrine spoke its name.', complete: 'Orrun, and with it the forest’s own old name: Avarra, the refuge that remembers every promise. Carry both through the gate.' },
  { id: 'old-shell', giver: 'orin', site: 'oldshell', title: 'HUNT OF THE OLD SHELL',
    opening: 'The Old Shell has nested in the Scorched Hollow east of the road. Its armour remembers every failed hunter. Break the shell, survive the quake, and clear our road.',
    accept: 'I will hunt the Old Shell.', accepted: 'East of the lantern road. Its shell turns light blows: strike the head, or crack its back with a Stonebreaker. When it rears, dash through the quake or guard.',
    turnin: 'The Old Shell is defeated.', complete: 'That was no wandering beast. You read its tells, broke its armour, and came back. Mossgate names you a hunter.' }
];

/** What you can ask each person about (besides quests). [key, your line, their reply] */
export const TOPICS = {
  mycel: [['city', 'What is Mossgate?', 'A promise made from rootwood and stubbornness. We shelter travellers, not conquerors.'],
    ['training', 'Teach me to survive.', 'Watch the creature’s feet. When they leave the earth, your parry must already be moving.'],
    ['doubt', 'I do not trust this place.', 'Good. Trust should grow roots before it bears weight. Look around, then ask me again.']],
  orin: [['training', 'Show me the Rootbreaker.', 'Hold R, then let it go to commit your weight. Don’t throw it without enough Breath to escape afterward.'],
    ['duty', 'How can I help Mossgate?', 'Wake the forest memories. Every one strengthens our wards.'],
    ['boast', 'I can handle the turtles.', 'Confidence is useful. Noise is not. Come back after a perfect parry.']],
  sela: [['route', 'Where should I go first?', 'Take the north-west lantern road. The Rootwell lies where the ground turns blue-green.'],
    ['ruins', 'What happened to Mosswatch?', 'Its wardens listened to a distant crown and forgot the roots. The stones remember the price.'],
    ['company', 'Will you come with me?', 'Not yet. Someone must keep the path home visible. Bring me a memory and I may reconsider.']],
  tavi: [['healing', 'Can you heal me?', 'The brazier in the square restores vitality, Breath and flasks. Stand beside it and press E.'],
    ['herbs', 'What grows in the Reach?', 'Sunmoss for wounds, bellcap for fever, and ghostfern for mistakes best left unnamed.'],
    ['style', 'Do I look like I belong?', 'Square cuffs, honest leather, steady eyes. You look more like the Reach every day.']],
  brannoch: [['spring', 'What is the Rootwell?', 'The oldest spring in the Reach. Everything that grows here drank from it first, the Warden included.'],
    ['nest', 'Why did the hollowed nest here?', 'Memory pools where water pools. They came to drink the forest’s past and forgot their own.']],
  ysolde: [['oath', 'What did you swear?', 'To keep watch until I am relieved. No one has come to relieve me. You are the closest thing yet.'],
    ['crown', 'Who did Mosswatch serve?', 'A crown far from these roots. We obeyed it and let our neighbours burn. The Warden never did.']],
  pip: [['climb', 'How did you get up there?', 'Badly. There’s a knot in the bark shaped like a ladder if you squint. I squinted.'],
    ['sela', 'Does Sela know you’re here?', 'Define “know.” She knows I’m somewhere. That’s a kind of knowing.']]
};

/**
 * Chronicle state. `done(site)` says whether a chronicle's goal is met
 * (a memory recovered, or the Old Shell defeated).
 */
export function createChronicles(saved, done) {
  const completed = new Set((Array.isArray(saved?.completed) ? saved.completed : []).filter(id => CHRONICLES.some(q => q.id === id)));
  let active = CHRONICLES.some(q => q.id === saved?.active) && !completed.has(saved.active) ? saved.active : '';
  const stances = { ...(saved?.stances || {}) };
  const byId = id => CHRONICLES.find(q => q.id === id);
  const available = () => CHRONICLES.find((q, i) => !completed.has(q.id) && (i === 0 || completed.has(CHRONICLES[i - 1].id)));
  return {
    completed, stances,
    get active() { return byId(active) || null; },
    available,
    goalMet(q) { return done(q.site); },
    /** The chronicle choice this person offers right now: [key, label, reply] or null. */
    choiceFor(npc) {
      const q = active ? byId(active) : available();
      if (!q || q.giver !== npc) return null;
      if (active === q.id && done(q.site)) return [`turnin:${q.id}`, q.turnin, q.complete];
      if (active === q.id) return [`remind:${q.id}`, 'Remind me where to go.', q.accepted];
      return [`accept:${q.id}`, q.accept, q.accepted];
    },
    /** Apply a chosen chronicle action; returns an extra line to append, if any. */
    choose(key) {
      const [kind, id] = key.split(':');
      if (kind === 'accept') { active = id; return null; }
      if (kind === 'turnin') {
        completed.add(id); active = '';
        const next = available();
        return next ? `${next.giver[0].toUpperCase() + next.giver.slice(1)} carries the next chronicle.` : 'Every chronicle of Mossgate is told.';
      }
      return null;
    },
    /** The line that opens an offer, spoken before the choices. */
    openingFor(npc) {
      const q = active ? byId(active) : available();
      if (!q || q.giver !== npc) return null;
      if (active === q.id && done(q.site)) return 'You have the look of someone who has seen it. Tell me.';
      if (active === q.id) return null;
      return q.opening;
    },
    reset() { completed.clear(); active = ''; for (const k in stances) delete stances[k]; },
    serialize() { return { active, completed: [...completed], stances }; }
  };
}
