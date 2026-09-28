# Verdant Reach · 3D prototype

Standalone 3D exploration experiment for **The Hollow Roots**. It has its own package, build, save key, multiplayer lobby data, and deployment. The original 2D game is untouched.

## Play

```sh
npm install
npm run dev
```

Meet Mycel, enter your real-world baseline, customize an explorer, then select Verdant Reach from the spinning world map. The current game opens with the Roblox-inspired block explorer: square arms and legs, readable facial features, configurable skin, face, hair, clothing, combat class, and stat-gated weapon.

Mossgate is the first town. Its block-styled NPCs have animated faces, turn toward the player, remember conversation choices, and offer a four-chapter story quest that leads through three guarded memories to the Old Shell hunt. The Rootward Homestead is the starter base. Shellbacks spawn outside the town wards, and a co-op lobby code lets multiple players share quest, memory, and boss progress.

## Controls

- **WASD / arrows** — move relative to the camera
- **Hold right mouse** — rotate the third-person camera; scroll to zoom
- **V** — switch first/third person
- **Left click / F / K** — buffered three-strike combo
- **Hold and release R** — charge Rootbreaker
- **C** — guard and timed parry
- **Shift** — directional evade with invulnerable frames
- **Q / Tab / middle click** — target lock
- **Space** — jump; measured 55 cm vertical unlocks the double jump
- **E** — talk, remember, rest, or use; left click advances dialogue
- **J** — quest journal; **M** — world map; **Escape** — pause
- **1–4** — pose, sit, wave, cheer; **0** clears the emote
- **F3** — combat volumes and hit/miss diagnostics
- **F4** — FPS and frame-timing readout
- **F2** or **DEV · F2** — developer test mode

Dev Mode keeps the normal game intact while exposing safe teleports, unstuck, healing, invulnerability, no-collision testing, collision markers, physical-stat presets, encounter clearing, memory unlocking, quest acceptance, and a complete quest-world reset.

## Characters and NPCs

The canonical player and Mossgate NPCs use the same Roblox-inspired block language, including square limbs and expressive faces. The procedural rig remains the dependable gameplay body and drives the first-person hands, terrain-aware feet, attacks, guard, emotes, and facial mood.

The earlier authored explorer is still preserved in `public/characters/explorer/`. It was built in Blender with MPFB from CC0 MakeHuman assets and animated with retargeted CC0 Quaternius motion plus Hollow Roots strikes, guard, and emotes. Four CC0 KayKit Adventurers are also preserved. Add `?legacyCharacters` to load the selected authored/KayKit character. `?procedural` remains compatible with older links. `/character-lab.html` renders the authored model, clips, outfits, and expressions from several angles; `/lab.html` renders procedural clips and combat poses.

See `public/characters/explorer/README.md` for sources, licences, and regeneration with `tools/blender/build_explorer.py`.

## Combat and the Old Shell

Combat uses committed movement, animation-matched limb hitboxes, swept collision tests, buffered follow-ups, hit-stop, camera feedback, directional evades, guard stamina, timed parries, target lock, weak points, and charged heavy attacks. The unarmed string is **Sapling Palm → Bough Swing → Taproot Heel**. Timing lives in `src/combat/moves.js`; the matching procedural clips live in `src/anim/clips.js`. First- and third-person strikes use the same combat timeline.

Real-world measurements shape damage, speed, dash distance, jumping, stamina costs and recovery, guarding, vitality, class recommendations, and weapon requirements. Creatures never grant XP; logged real-world activity does.

The Old Shell is a persistent boss at the Canopy Gate with a larger charred silhouette, red eyes and aura, asymmetric shell spines, tusks, a scarred face, armoured-shell damage reduction, a breakable shell, an exposed head weak point, lunges, and a telegraphed area quake. Breaking its armour changes its materials and pushes the encounter into its enraged state.

## World and development routes

Trees, buildings, town wards, Rootwell stonework, the Canopy Gate, and substantial rocks block movement. Mossgate and the home base use level foundations; smaller natural obstacles can be jumped. Three memory sites have non-respawning guardian groups. The remaining world-map realms are level-gated previews rather than playable regions.

- `?arena` skips the menus and starts beside a shellback.
- `?debug` enables the combat readout immediately.
- `?legacyCharacters` loads the authored/KayKit path.
- `/lab.html?clips=palm,swing` renders requested procedural clips.
- `/character-lab.html` inspects the authored explorer and exported animation set.

Progress and the 3D profile save in this browser and do not read or modify the 2D game's save. The public leaderboard is still a presentation surface rather than a shared ranked service.
