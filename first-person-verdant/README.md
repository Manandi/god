# Verdant Reach · 3D prototype

Standalone 3D exploration experiment for **The Hollow Roots**. It has its own package, build, save key, and deployment. The 2D game is untouched.

## Play

```sh
npm install
npm run dev
```

Meet Mycel, enter your real-world baseline, then select Verdant Reach from the spinning world map. Your measurements decide your stats, and your stats decide how you play (see *Real-life stats* below).

| Control | Action |
|---|---|
| WASD | Move (relative to the camera) |
| Hold right click + mouse | Orbit the camera (third person); look around (first person) |
| Scroll | Zoom |
| Left click / F | Attack (string) |
| R | Heavy; hold to charge a Rootbreaker |
| Shift | Dash (tap); hold to sprint |
| C | Guard; raise it just before a hit to parry |
| X | Sap Flask |
| Q / middle click | Lock on (flick the mouse to switch targets) |
| Space | Jump; again in the air to double jump (vertical jump of 55 cm or more) |
| E | Talk / interact; 1–9 picks a dialogue choice |
| J / M | Journal / map |
| V | Switch first and third person (`?third` starts in third person) |
| F2 / F3 / F4 | Dev panel / combat debug readout / FPS |
| 1–4, 0 | Emotes (pose, sit, wave, cheer; clear) when no dialogue is open |
| Esc | Pause |

Mossgate's people start the story (three memories, then the Canopy Gate and Orrun) and the Mossgate Chronicles side quests, including the hunt for the Old Shell in the Scorched Hollow. Press CO-OP LOBBY to create or join a lobby by code, or share a `?lobby=CODE` link. Progress saves in this browser.

## The explorer

The player is the Roblox-style block explorer from the ChatGPT Sites design: square limbs and head over the procedural rig, which also drives the first-person block hands. You start at the Rootward Homestead and walk through Mossgate, whose block NPCs (Sela, Orin, Mycel, Tavi) start and carry the story; Brannoch, Ysolde and Pip keep the sites along the lantern road. The earlier Blender/MPFB explorer is kept in `public/characters/explorer/` (see its README) and loads only with `?legacyCharacters`. `/character-lab.html` renders that model, its clips, outfits and expressions.

## Combat

- **Weapons:** bare-handed Rootbound style, the Groveblade (needs STR 8 and SPD 8) or the Stonebreaker (STR 12 and DEF 12; pierces armour). Each has its own string, heavy, dash attack, air attack and counter.
- **Light string:** Sapling Palm → Bough Swing → … (left click). **Heavy:** Taproot Heel (R), also a finisher from any light strike; hold to charge through two levels and release a **Rootbreaker** with a shockwave. Heavies have hyper-armour: light hits hurt but don't interrupt.
- **Breath (stamina):** every strike and dash spends it; it recovers after a short pause. At zero you are **winded**: no attacks or dashes until Breath is back to 30.
- **Dash:** invulnerable frames; your real-world Speed lengthens them. Dash so an attack lands in the opening frames for a **perfect evade**: time slows, Breath returns, and your next strikes count as counters.
- **Shellbacks and thornlings** have two moves, telegraphed before they commit: a lunging bite, and a shell spin that punishes standing beside or behind them. (The rearing slam and its shockwave ring belong to the Old Shell.) Light hits never cancel a committed attack; heavies and enough damage stagger them. Below 40% health they enrage.
- **Hitting low creatures:** their hurt volumes reach up a little, so a punch or swing thrown at chest height still lands on a turtle's shell or head.
- **Poise:** hits wear down footing. At zero the turtle flips onto its back — its belly takes double damage and you can land a **Root Strike**. The head is a weak point (orange numbers); the shell is armoured (grey numbers, clank).
- **The Old Shell** is a boss. Its shell halves damage until enough hits break it, which exposes the head and enrages it. When it rears, dash through the quake or guard it.
Timing lives in `src/combat/moves.js`; each clip is keyed to the same timeline, and hits are tested against the posed limb, so first and third person land identically. Press **F3** (or add `?debug`) for a combat readout that draws the collision capsule, strike and hurt volumes and the creature's damage volumes, and logs why each strike hit, missed or was blocked. `?arena` skips the menus and starts beside the first shellback. `/lab.html?clips=palm,swing` renders any clip from several angles during development.

## Real-life stats

`src/mechanics.js` turns your measurements into play, and the stats screen shows the same table:

- **Strength:** damage.
- **Speed:** run speed, dash distance and dash invulnerability.
- **Vertical jump:** jump height, and a double jump from 55 cm.
- **Stamina:** Breath cost and recovery.
- **Defense:** vitality and guard cost.
- **Intelligence:** how far away memories answer, and Rootbreaker power for mages.

Classes add to what you already have:

- fighter: damage and stagger
- tank: one more heart and cheaper guards
- ranger: speed and dash
- mage: charge power
- support: Breath recovery and parry reward

The third-person camera is adapted from the CameraRig in [Rotten Souls](https://github.com/igorjohn/rotten-souls) (MIT).

This is a prototype biome, not an open-world production release. Trees and substantial rocks block movement; smaller obstacles can be jumped over. The shellbacks and thornlings are 3D animated creatures; defeating them does not award XP. Real-world activities logged under Weekly Quest grant XP; baseline metrics shape your character stats. The other three world-map realms are level gated previews, not playable yet. The leaderboard is not connected to a shared service. The 3D profile has its own local save and does not read or modify the 2D game's save.
