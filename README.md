# The Hollow Roots — project handoff

This is the shared status file for work on the game from different devices or AI assistants. **Read it before changing the game and update it after each meaningful change.** The GitHub branch is the shared source of truth; a local checkout can be behind even when another device has pushed newer work.

## Rules for AI assistants: read first

These come from the owner. Follow them on every device and with every model.

### Who owns what (the owner's decision, 2026-09-28)

The 3D game combines two sources. Keep each part with its owner, and don't replace one with the other.

| Part | Source | Where |
|---|---|---|
| **Character design**: the Roblox-style block explorer, first-person block hands, character creator (name and look) | ChatGPT Sites version (`box-characters` branch) | `src/avatar.js`, `src/humanoid.js`, `src/shell.js`, `src/profile.js` |
| **NPC design**: block NPCs with animated faces, turning to face you, markers | ChatGPT Sites version | `src/npcs.js` (the builder); colours and positions in `NPCS` in `src/story.js` |
| **Town design**: Mossgate, the Rootward Homestead (start), the Rootwell ring, lantern-light pooling | ChatGPT Sites version | `buildCity` and `buildHome` in `src/world.js` |
| **Combat**: moves, guard and parry, evade, flasks, sprint and jump attacks, creature AI | Claude | `src/combat/*`, `src/creatures.js` |
| **Story and plot**: stages, all dialogue, journal, quest-point mob spawns, save migration | Claude | `src/story.js`, and the encounter and dialogue code in `src/main.js` |
| **Boss and arena**: Orrun, the Hollow Warden, and the Warden's Hollow | Claude | `src/boss.js`, `tools/blender/build_warden.py`, `build_arena.py` |
| **Camera and quest waypoint**: shoulder camera (hold right click to orbit), compass strip, on-screen waypoint | Claude; camera adapted from [Rotten Souls](https://github.com/igorjohn/rotten-souls) (MIT) | `src/camera.js`, `updateWaypoint` in `src/main.js` |
| **Stats → mechanics**: what each real-life stat does in play | Claude | `src/mechanics.js` (the stats screen shows the same table) |
| **Classes, weapons, Rootbreaker, double jump**: rules and weapon models from ChatGPT; movesets and hit timing by Claude | Both | `CLASS_INFO`/`weaponEligibility` in `src/profile.js`; `MOVESETS` in `src/combat/moves.js` |
| **Mossgate Chronicles, dialogue choices, the Old Shell**: quest text and boss look from ChatGPT; wired into Claude's story, dialogue and creature AI | Both | `src/chronicles.js`, `oldshell` in `src/creatures.js`, `HUNT` in `src/world.js` |
| **Dev panel (F2) and co-op lobby**: ideas from ChatGPT, rebuilt for GitHub Pages | Claude | dev block in `src/main.js`; `src/coop.js` (Supabase Realtime) |

How the story uses the ChatGPT NPCs:
- In Mossgate, **Sela** (Wayfinder) starts the story, **Orin** (Warden-Captain) reviews the trial and sends you to the Rootwell, and **Mycel** and **Tavi** have story lines for every stage.
- The site keepers **Brannoch, Ysolde and Pip** are block NPCs in the same style.

**Brought over from the Sites version (2026-09-29):** classes, weapons and their stat gates, the Rootbreaker, the double jump, the Mossgate quest (now the four Mossgate Chronicles), the Old Shell boss, dialogue choices, the F2 dev panel and F4 FPS readout, and a co-op lobby. The Sites lobby used its D1 worker, which GitHub Pages can't run, so co-op now runs on Supabase Realtime with the same lobby codes and `?lobby=CODE` links.

**Still not taken:** the KayKit legacy models. They remain on the `box-characters` branch. **Do not merge that branch wholesale:** its last commit moves the Sites project to the repo root and deletes the 2D game.

### Do not touch

- **Character, NPC and town design.** Do not restyle, remodel, re-rig or re-proportion the block explorer, the first-person hands, the block NPCs, Mossgate or the Homestead. The old rounded Blender explorer is kept only behind `?legacyCharacters`; never make it the default again.
- **The root 2D Phaser game and its save data.** Do not change its behaviour or the localStorage keys it uses. Removing unused files is fine only after checking that nothing references them, including map JSON.
- **3D save data.** Keep the `verdant-reach-3d-v1` and `hollow-roots-verdant-3d-profile-v1` keys. Any change to the save format must migrate older saves; see `createStory` in `first-person-verdant/src/story.js`. It already maps the old `meet_wren` stage to `meet_sela`.
- **The ChatGPT Site.** `first-person-verdant/.openai/hosting.json` and its separate source must not be overwritten wholesale with this tree. The root `.openai/hosting.json` belongs to the 2D Site.
- **Secrets.** Never ask the owner to paste tokens or keys in chat. Never commit a Supabase `service_role` key. The publishable key in the Pages workflow is meant to be public.
- **Branches and history.** Work on `claude/practical-babbage-tbonr1`. Never force-push, and never merge `box-characters` wholesale.
- **Scope.** Don't change things the owner didn't ask for. Adding things is fine.
- **Intentional duplicates.** `AGENTS.md` and `CLAUDE.md` are identical on purpose. Each game keeps its own `world-surface-v2.webp` on purpose.
- **Unity.** It is not usable here: it needs a licensed, signed-in editor, and the game is Three.js. Make 3D assets with the Blender scripts in `first-person-verdant/tools/blender/`.

### Next steps, in order

1. **Test co-op with two real browsers.** Open `/god/verdant/?lobby=ABC234` in two tabs or devices. The sandbox this was built in blocks websockets, so co-op has never connected in a test. If it stays on CO-OP OFFLINE, check that Realtime is on for the Supabase project and allows public channels.
2. **Tune the boss by feel** once the owner plays it: Orrun's health (1000), poise (70), attack cadence and eruption spacing in `src/boss.js`; the Old Shell's in `KINDS.oldshell` in `src/creatures.js`. Headless tests only check logic.
3. **Town features.** A shop and more Mossgate life. Build them in the ChatGPT town, with block NPCs from `src/npcs.js`, and tie any new dialogue to the story stages in `src/story.js`.
4. **Owner decision needed:** the 2D `canRetakeQuiz` (the monthly reasoning-quiz retake) is written but never called. Ask before wiring it in or deleting it.

### Map of the 3D game (`first-person-verdant/src/`)

| File | What it owns |
|---|---|
| `main.js` | Input, the game loop, HUD, quest waypoint, dialogue and choices, encounter spawning, boss wiring, dev panel |
| `camera.js` | Third-person shoulder camera: right-drag orbit, lock-on framing, world collision, shake, boss intro shots |
| `mechanics.js` | Real-life stats → damage, speed, dash, jump and double jump, Breath cost, vitality, class bonuses; the equipped weapon |
| `chronicles.js` | The four Mossgate Chronicles and each NPC's dialogue topics |
| `coop.js` | Co-op lobby over Supabase Realtime: presence, positions, shared progress |
| `combat/moves.js`, `combat/player.js` | Move timings and the player combat state machine |
| `combat/hits.js`, `combat/feedback.js` | Hit detection, and combat sound and effects |
| `creatures.js` | Shellbacks, thornlings and the Old Shell (AI, poise, topple, shell armour, quake) |
| `boss.js` | Orrun, the Hollow Warden, and arena loading |
| `profile.js`, `shell.js` | Real-life profile, stats, classes and weapon eligibility; the menus, stats screen and character creator |
| `story.js` | Quest stages, NPC positions, all dialogue, the journal, save migration |
| `world.js` | Terrain (town, homestead and arena levelled), Mossgate and the Homestead, sites, colliders |
| `avatar.js`, `humanoid.js` | The block explorer and first-person block hands (ChatGPT design) |
| `npcs.js` | Block NPC builder and animation (ChatGPT design) |
| `avatarGLB.js` | The old Blender explorer, used only with `?legacyCharacters` |
| `angles.js` | Shared `angleTo` and `yawOf` helpers |

**Testing:**
- `?arena` skips the menus; add `&third` for third person, `&debug` or F3 for the combat readout, and `&capture` for stepped frames.
- **F2 opens the dev panel:** no damage, no-clip, infinite Breath, colliders, teleport to any place, any weapon, any class, stat presets, and jump to any story stage. F4 shows FPS.
- `window.__verdant` exposes the game state and its test hooks.
- The owner prefers to test game feel themselves. Don't run long capture or video pipelines; quick logic checks are fine.

## Repository and publishing

- Repository: `https://github.com/Manandi/god`
- Active branch: `claude/practical-babbage-tbonr1`. Fetch it and inspect `git status` before editing. Integrate newer commits without force pushing or discarding local changes.
- Root project: Phaser 2D game. Preserve its code and save data while working on the separate 3D prototype.
- `first-person-verdant/`: Vite/Three.js 3D game. Read its [README](first-person-verdant/README.md), combat and camera code, and the deployment configuration before editing.
- GitHub Actions [Pages workflow](.github/workflows/pages.yml) publishes the 2D game at `https://manandi.github.io/god/` and this branch's 3D game at `https://manandi.github.io/god/verdant/`.
- The existing owner-private 3D Site is `https://verdant-reach-first-person.manandi.chatgpt.site`, configured by `first-person-verdant/.openai/hosting.json`. Its source repository has some independent character/performance work. Merge deliberately; do not overwrite it wholesale with the GitHub tree. The root `.openai/hosting.json` belongs to the separate 2D Site.

## Latest shared state — 2026-09-29

The owner asked for a better camera and quest marker, a dev mode, Monster Hunter / Elden Ring combat feel, "dash" instead of "roll", real-life stats that drive the mechanics, and everything left behind from the ChatGPT Sites version.

- **Commits:** `30cfa8e`, `9fbb720`, `995fcb4` and `2a2b084`, on top of `c1a998a`.
- **Camera (`src/camera.js`):**
  - Hold right click to orbit in third person; the mouse no longer turns the view on its own.
  - The camera slides along walls, trees and rocks instead of sticking.
  - On lock-on it frames both you and the target.
  - Heavy hits and big impacts shake it.
  - Both bosses get a short intro shot when they wake.
  - Adapted from Rotten Souls (MIT). The heavy attack is now R only.
- **Quest marker:** a compass strip at the top, an on-screen waypoint with distance that clamps to the screen edge with an arrow, and a light beacon at the target.
- **Real-life stats (`src/mechanics.js`):** Strength sets damage, Speed sets run, dash length and dash i-frames, and vertical jump sets jump height, with a double jump from 55 cm. Stamina sets Breath cost and recovery, Defense sets vitality and guard cost, and Intelligence sets memory reach and mage charge. The stats screen shows this table.
- **Breath:** at 0 you are WINDED: no attacks or dashes until Breath is back to 30.
- **Classes and weapons (ChatGPT rules):**
  - Classes: fighter, tank, ranger, mage, support.
  - Rootbound, Groveblade and Stonebreaker are gated by stats. Each has its own moveset and a hold-R Rootbreaker. The Stonebreaker pierces armour.
- **Mossgate Chronicles (`src/chronicles.js`):** four side quests from Sela, Orin and Mycel. Talking now offers numbered choices (1–9 or click), and NPCs remember your last topic.
- **The Old Shell:** a boss in the Scorched Hollow east of the lantern road. Its armour halves damage until you break the shell, and its quake can be dashed or guarded. Its defeat is saved.
- **Dev panel:** F2, as described in Testing above.
- **Co-op (`src/coop.js`):**
  - Press CO-OP LOBBY, or open `?lobby=CODE`, to see friends as block figures with name tags.
  - Memories, cleared nests and the Old Shell are shared. Creatures are not shared.
- **Save:** the save now also holds `chronicles` and `oldShellDefeated`. Old saves load unchanged.
- **Tested headless, no page errors:**
  - the full story, plus old-save migration
  - the combat smoke test and the boss logic
  - weapon chains and Rootbreakers
  - double jump gating
  - Chronicles accept, choice and turn-in
  - Old Shell quake, shell break and saved defeat
  - intro shot and camera blend
  - new, old and first-person save launches
- **Not verified:**
  - Co-op has never connected in a test: this sandbox's proxy blocks websockets.
  - Nothing has been checked by feel in a real browser.

## Latest shared state — 2026-09-28 (late night)

- **Game commit `c1a998a`** combines the ChatGPT Sites **character, NPC and town design** (from `box-characters`) with Claude's **combat, story, mob spawns, boss and arena**; see "Who owns what" above.
- **Published.** The Pages run for `c1a998a` succeeded. Verified live at `/god/verdant/`: the served bundle contains Mossgate (`WAYFINDER OF MOSSGATE`), the Homestead and Orrun. The 2D game at `/god/` returns 200.
- **Tested headless, no page errors:**
  - the full story from a fresh save (Sela → trial → Orin → the three chapters → the gate), plus every town NPC's line at the gate stage
  - migration of an old memory-only save, and of an out-of-order one
  - combat smoke test (block, parry, riposte, running and jump attacks, flask, attack tokens)
  - boss logic (topple, belly Root Strike, phase 2, parry, eruption, release)
  - mobs spawning free of colliders
  - screenshots of the block explorer and the block NPCs
- **Not verified:** the owner playing it in a real browser, and whether the ChatGPT Site itself matches this build.

## Latest shared state — 2026-09-28 (night)

- Latest commit: `4bd3105` (`Remove unused assets and dead code; share repeated helpers`). The Pages run for it succeeded. Verified live: the 3D bundle at `/god/verdant/` contains the new code, the 2D game at `/god/` returns 200, and a removed v1 asset now returns 404 while its v2 replacement returns 200.
- **Cleanup, no behaviour change.**
  - Deleted 10 unused 2D assets, each superseded by a newer version: `base-island-v1`, `world-globe-v1`, biosphere `climb-1`, `climb-vine-v2` and `terrain-1`, `mushroom_brown`/`mushroom_red`, and `turtle_walk_2..4`.
  - Deleted two never-called 2D exports: `workoutsThisWeek` and `ACHIEVEMENT_LIST`.
  - 3D: `src/angles.js` replaces four copies of `angleTo`/`yawOf`. The player and NPCs share the model-part and dressing code in `avatarGLB.js`. `playTone` reuses `CombatSound.tone`. Added one `checkDefeated()` and one `keeperName()`.
  - Warden-only shader code moved into `build_warden.py`.
  - Re-run and passing: 2D typecheck and build, 3D build, both Blender scripts, and the save, combat, story and boss tests.
- **Left on purpose.**
  - `AGENTS.md` and `CLAUDE.md` are identical by design.
  - Each game ships its own `world-surface-v2.webp`, because they deploy separately.
  - `canRetakeQuiz` (2D, the monthly reasoning-quiz retake rule) is defined but never called. Whether to wire it in or delete it is the owner's decision.
  - The dev lab pages and map tools stay.
- **Character style question (open).** The owner expects **Roblox-style box characters**. On this GitHub branch only the first-person hands are box-style. Third person uses the rounded Blender/MPFB explorer (since `8fc3c3e`), and the box-part body was replaced in `38a3ed3`. The story NPCs reuse the rounded model. No other GitHub branch or repository exists. If the box-style design lives in the ChatGPT Site's separate source, it has not been pushed here.

## Latest shared state — 2026-09-28 (evening)

- Latest game commit: `e794592` (`3D fixes: globe texture under a base path, solid world props, boss checkpoint`), on top of `766854e` (boss and arena), `cbe2361` (story) and `709d0d7` (combat round 3). Published by the Pages workflow run for `e794592` (success). Verified live at `https://manandi.github.io/god/verdant/`: the served bundle contains the story and boss code, and `characters/warden/warden.glb`, `arena/warden-hollow.glb`, `art/world-surface-v2.webp` and `characters/explorer/explorer.glb` all return 200 under `/god/verdant/`. The 2D game at `/god/` still returns 200. The ChatGPT Site was **not** updated.
- **Character design unchanged.** The player's explorer model and first-person hands were not modified.
- **Combat (`709d0d7`).**
  - Guard (C) and parry (raise guard ≤0.18 s before contact), which leaves the creature reeling and open to a riposte.
  - Guard counter.
  - Sprint (hold Shift) with running attacks, and a falling heel as a jump attack.
  - Sap Flasks (X, 3 charges, refilled at the trail stone or when you die).
  - Attack tokens, so creatures take turns.
  - Leashing.
- **Story (`cbe2361`, `src/story.js`).** One ordered questline: Wren's trial at camp → the Rootwell (Brannoch) → Mosswatch (Ysolde) → the Canopy Shrine (Pip) → the Canopy Gate.
  - Every line of NPC dialogue depends on the story stage.
  - The four keepers are clones of the existing explorer model with their own materials.
  - Creatures now belong to a chapter and rise at that chapter's site only when the story reaches it. Cleared nests persist.
  - Save key `verdant-reach-3d-v1` gains `story: {v:2, stage, cleared}`. Old memory-only saves migrate: the story resumes at the first chapter whose memory is missing.
  - The compass, objective and journal (J) follow the story.
- **Boss and arena (`766854e`).** Orrun, the Hollow Warden, and the Warden's Hollow before the Canopy Gate.
  - Both are built by Blender scripts: `first-person-verdant/tools/blender/build_warden.py`, `build_arena.py` and `procedural.py`, with Cycles-baked textures. See `public/characters/warden/README.md` for clips and hit windows.
  - Boss AI is in `src/boss.js`. Attacks: bite (the only parryable one), stomp with a shockwave, tail sweep, charge, and root eruption from phase 2.
  - Leg and head damage topples it onto its back. Phase 2 starts at 60% health, enrage at 25%.
  - Leaving the Hollow resets it. Dying respawns you at a checkpoint below the Hollow.
  - Defeating it, then pressing E to speak its name, ends the story.
  - The arena terrain is levelled in `world.js` (`ARENA`).
  - **Unity was not used.** It needs a licensed, signed-in editor, and the game is Three.js; everything was made in Blender.
- **Fixes (`e794592`).**
  - The globe texture uses the Vite base URL.
  - Colliders added for the Rootwell platform and rocks, the Shrine trunk and ring stones, lantern posts and Mosswatch rune slabs. Boulder colliders now match their size.
- **Tested headless (Chromium/SwiftShader), no page errors:**
  - combat smoke test (block, parry, riposte, running and jump attacks, flask, attack tokens)
  - full story run from a fresh save to the ending
  - old-save migration
  - boss fight logic (wake, attacks landing, topple, belly Root Strike, phase 2, parry, eruption, release)
  - collider probes
  - new, old and first-person save launches
  - production build

## Current feedback and next work

1. Play the boss in a real browser and tune by feel: health (1000), poise (70), attack cadence, eruption spacing. Headless tests run at about 1 fps, so they check logic, not feel.
2. A shop and more town life are still **not built**. Build them in the ChatGPT town with block NPCs from `makeNpc` in `src/npcs.js`.
3. Third-person limb distortion was reported earlier. The player asked not to change the character design, so it is untouched; revisit only if they ask.
4. The ChatGPT Site (`first-person-verdant/.openai/hosting.json`) still serves older source. Merge deliberately before redeploying it.

## Earlier state — 2026-09-28 (morning)

- Game commit `ecf0fbb` merged the PC's combat overhaul (charged heavy attacks, Breath/stamina, poise/topples, three shellback attacks). The previous ChatGPT Site deployment was built from its own source commit `4a4f2eb`, before that overhaul.

## How to hand off work

After each meaningful task, update this file with the date, the exact commit, what changed, what was tested, what was published and verified, and remaining issues. Keep the newest update above older notes; remove stale claims. Run `npm ci`, `npm run dev` and `npm run build` in `first-person-verdant/` for 3D changes. Use `?arena&debug` or F3 for combat testing. Run root checks when touching the 2D project. Commit and push to the existing branch, then verify the GitHub Actions run and live Pages result. If updating the 3D Site, push its **existing** source repository and verify the deployment separately. Never claim a deployment is live from a successful push alone.
