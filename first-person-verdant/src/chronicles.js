// Mossgate Chronicles and dialogue choices (the ChatGPT Sites design).
//
// The main story (story.js) is the forest's history: the Warden, its oath, the
// theft that started the Hollowing, and the Warden's name. The Chronicles are
// Mossgate's side of it: three side quests the townsfolk give through dialogue
// choices, one for each memory, in story order. Each completes when you recover
// that memory, and turning it in tells you what the town took from it: the
// promise Mossgate was built on, and why it matters at the gate.

export const CHRONICLES = [
  { id: 'water-remembers', giver: 'sela', site: 'rootwell', title: 'THE WATER REMEMBERS',
    opening: 'The Rootwell has gone silent beneath hungry guardians. When you clear the spring, listen to what its water kept, and bring its meaning back to Mossgate.',
    accept: 'I will listen to the Rootwell.', accepted: 'Follow the lantern road west. The memory will not speak while its guardians stand.',
    turnin: 'I heard the Rootwell memory.', complete: 'It carried the stones. Mossgate’s first rule is carved over my door: “Carry your own stone.” I never knew we borrowed it from the Warden.' },
  { id: 'broken-oath', giver: 'orin', site: 'ruins', title: 'THE BROKEN OATH',
    opening: 'Mosswatch was our shield before it hollowed out. My wardens still wear its leaf. Bring back the truth of what happened there, whatever it costs us.',
    accept: 'I will reclaim Mosswatch.', accepted: 'Break the pack around the ruins. The stones will show you why the old wardens failed.',
    turnin: 'I saw what happened at Mosswatch.', complete: 'Ashmere’s crown bought strength it never earned, and wardens like mine paid for it with the forest. From today Mossgate’s wardens swear on sweat, not on a crown. Tell Ysolde the leaf comes off.' },
  { id: 'name-beneath-bark', giver: 'mycel', site: 'shrine', title: 'THE NAME BENEATH BARK',
    opening: 'The Canopy Shrine guards the last name this forest kept. Mycel says the Heartseed cannot take root at the gate until that name is spoken. Wake the memory.',
    accept: 'I will wake the Canopy Shrine.', accepted: 'The oldest trail runs north. Clear its guardians, then let the memory speak.',
    turnin: 'The Shrine spoke its name.', complete: 'Orrun, the one who carries, and with it the forest’s own old name: Avarra, the refuge that keeps every earned promise. Take both to the gate. The Heartseed will follow you.' }
];

/** What you can ask each person about (besides quests). [key, your line, their reply]; a reply
 *  can be a list of lines. The first topic of each Mossgate NPC is a tutorial. */
export const TOPICS = {
  mycel: [['learn-grow', 'How do I get stronger?', [
      'Not in here. Out there. Your stats come from real tests: push-ups, pull-ups, bench, vertical jump, sprint and the mile, scored against real people.',
      'Open WEEKLY QUEST in the menu. Check off the steps, the home workouts and the learning. That is your XP, and XP is your level.',
      'Every 30 days you can retest. A stat that rises earns a Growth bonus, and a stat of 12 or 16 wakes an ability.',
      'Lifting on your own program? Log it in the lift log on the quest page. It gives no XP, but it earns titles your friends will see.',
      'And the leaderboard keeps everyone honest: if a friend doubts a stat, they cap it, and it does not count until you show them proof.']],
    ['city', 'What is Mossgate?', 'A promise made from rootwood and stubbornness: carry your own stone, and shelter those who carry theirs.'],
    ['heartseed', 'What is the Heartseed?', 'The heart of the Reach. It grows from effort honestly spent, yours included. That is why you grow stronger here only when you grow stronger out there.'],
    ['doubt', 'I do not trust this place.', 'Good. Trust should grow roots before it bears weight. Look around, then ask me again.']],
  orin: [['learn-fight', 'Teach me to fight.', [
      'Click, or F, strikes. Chain them, but every swing costs Breath: the bar at the bottom. Run dry and you are winded.',
      'R is a heavy blow. Hold it to charge and let go to commit. Heavies stagger and topple; light hits will not.',
      'Q locks on. Watch for the glow before they move: that is the tell. Shift dashes, and a dash just as the blow lands passes straight through it.',
      'C raises your guard. Raise it just before the hit and you parry: no Breath lost, and they are open for a riposte.',
      'Shells turn blades, so go for the head and the legs. Topple them, then strike the belly.',
      'The Warden at the Canopy Gate only stirs on weekends, and only when two or more of you stand before it together.']],
    ['training', 'Show me the Rootbreaker.', 'Hold R, then let it go to commit your weight. Don’t throw it without enough Breath to escape afterward.'],
    ['duty', 'How can I help Mossgate?', 'Wake the forest memories. Every one strengthens our wards and weakens the rot.'],
    ['boast', 'I can handle the turtles.', 'Confidence is useful. Noise is not. Come back after a perfect parry.']],
  sela: [['learn-move', 'How do I get around?', [
      'W, A, S and D walk. Hold Shift to sprint, tap it to dash. Space jumps, and if your real vertical jump is good enough, a second press jumps again in the air.',
      'Hold the right mouse button to look around. The marker on screen and the compass at the top always point to your next goal.',
      'J opens your journal with the story so far, M the world map, and V switches between first and third person. E talks to people and uses things.',
      'Lost or stuck? Follow the lanterns. They always lead to whatever the forest needs next.']],
    ['route', 'Where should I go first?', 'Follow the lanterns. They always lead to the next thing the forest needs remembered.'],
    ['hollowing', 'What is the Hollowing?', 'A rot in the roots. It takes strength and memory together, and it hits the strong first. That is all anyone knew, until you started asking the right people.'],
    ['company', 'Will you come with me?', 'Not yet. Someone must keep the path home visible. Bring me a memory and I may reconsider.']],
  tavi: [['learn-survive', 'How do I stay alive?', [
      'Those diamonds at the top are your hearts. X drinks a Sap Flask: it heals after a moment, and a hit before then spills it.',
      'The green brazier in the square and the hearth at your homestead refill your hearts and your flasks. Stand by one and press E.',
      'Breath is your stamina. Back off and it comes back fast; stay greedy and you will be winded right when you need to dash.',
      'And if you fall, the roots carry you home. You lose nothing but the walk back.']],
    ['healing', 'Can you heal me?', 'The brazier in the square restores vitality, Breath and flasks. Stand beside it and press E.'],
    ['herbs', 'What grows in the Reach?', 'Sunmoss for wounds, bellcap for fever, and ghostfern for mistakes best left unnamed. Nothing at all in the Scorched Hollow.'],
    ['hollow', 'What happened in the Scorched Hollow?', 'Someone cut the roots there and drank the sap. The ground still remembers the fire they set to hide it.']],
  brannoch: [['spring', 'What is the Rootwell?', 'The oldest spring in the Reach. Everything that grows here drank from it first, the Warden included.'],
    ['nest', 'Why did the hollowed nest here?', 'Memory pools where water pools. They came to drink the forest’s past and forgot their own.']],
  ysolde: [['oath', 'What did you swear?', 'To keep watch until I am relieved. No one has come to relieve me. You are the closest thing yet.'],
    ['crown', 'Who did Mosswatch serve?', 'The Crown of Ashmere, far from these roots. It asked for strength without work, and we were proud enough to deliver it.']],
  pip: [['climb', 'How did you get up there?', 'Badly. There’s a knot in the bark shaped like a ladder if you squint. I squinted.'],
    ['sela', 'Does Sela know you’re here?', 'Define “know.” She knows I’m somewhere. That’s a kind of knowing.']]
};

/**
 * Chronicle state. `done(site)` says whether a chronicle's goal is met
 * (that site's memory recovered).
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
