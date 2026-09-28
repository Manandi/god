# The Hollow Roots — project handoff

This is the shared status file for work on the game from different devices or AI assistants. **Read it before changing the game and update it after each meaningful change.** The GitHub branch is the shared source of truth; a local checkout can be behind even when another device has pushed newer work.

## Rules for AI assistants: read first

These come from the owner. Follow them on every device and with every model.

### Do not touch

- **Character design, in first and third person.** Do not restyle, remodel, re-rig or re-proportion the player, the first-person hands or the NPCs. The owner expects **Roblox-style box characters**. That design is being pushed from the ChatGPT Site's source (see "Next steps"). Until it arrives, do not "fix", replace or restyle any character, including the current rounded Blender explorer.
- **The root 2D Phaser game and its save data.** Do not change its behaviour or the localStorage keys it uses. Removing unused files is fine only after checking that nothing references them, including map JSON.
- **3D save data.** Keep the `verdant-reach-3d-v1` and `hollow-roots-verdant-3d-profile-v1` keys. Any change to the save format must migrate older saves; see `createStory` in `first-person-verdant/src/story.js`.
- **The ChatGPT Site.** `first-person-verdant/.openai/hosting.json` and its separate source must not be overwritten wholesale with this tree. The root `.openai/hosting.json` belongs to the 2D Site.
- **Secrets.** Never ask the owner to paste tokens or keys in chat. Never commit a Supabase `service_role` key. The publishable key in the Pages workflow is meant to be public.
- **Branches and history.** Work only on `claude/practical-babbage-tbonr1`. Never force-push.
- **Scope.** Don't change things the owner didn't ask for. Adding things is fine.
- **Intentional duplicates.** `AGENTS.md` and `CLAUDE.md` are identical on purpose. Each game keeps its own `world-surface-v2.webp` on purpose.
- **Unity.** It is not usable here: it needs a licensed, signed-in editor, and the game is Three.js. Make 3D assets with the Blender scripts in `first-person-verdant/tools/blender/`.

### Next steps, in order

1. **Merge the box-style characters.** The owner will push the ChatGPT Site's source to GitHub, as a branch (for example `box-characters`) or a link.
   - Diff its character code against this branch. Keep its box player, first-person hands and appearance options exactly as they are.
   - Bring this branch's combat, story, boss and arena onto it.
   - Remake the four story NPCs (Wren, Brannoch, Ysolde, Pip) in the same box style. They are currently clones of the rounded explorer; see `createNPC` in `src/avatarGLB.js`.
   - Do not start this before the source arrives.
2. **Tune the boss by feel** once the owner plays it: Orrun's health (1000), poise (70), attack cadence and eruption spacing in `src/boss.js`. Headless tests only check logic.
3. **Build the town and shop** in the existing 3D world, reusing the NPC and dialogue systems. Record asset sources and licences.
4. **Owner decision needed:** the 2D `canRetakeQuiz` (the monthly reasoning-quiz retake) is written but never called. Ask before wiring it in or deleting it.

### Map of the 3D game (`first-person-verdant/src/`)

| File | What it owns |
|---|---|
| `main.js` | Input, the game loop, camera, HUD, dialogue, encounter spawning, boss wiring |
| `combat/moves.js`, `combat/player.js` | Move timings and the player combat state machine |
| `combat/hits.js`, `combat/feedback.js` | Hit detection, and combat sound and effects |
| `creatures.js` | Shellbacks and thornlings (AI, poise, topple) |
| `boss.js` | Orrun, the Hollow Warden, and arena loading |
| `story.js` | Quest stages, NPC positions, all dialogue, the journal, save migration |
| `world.js` | Terrain (with the arena levelled), sites, colliders |
| `avatarGLB.js`, `avatar.js`, `humanoid.js` | Player model, NPC clones, first-person hands, procedural fallback |
| `angles.js` | Shared `angleTo` and `yawOf` helpers |

**Testing:**
- `?arena` skips the menus; add `&third` for third person, `&debug` or F3 for the combat readout, and `&capture` for stepped frames.
- `window.__verdant` exposes the game state and its test hooks.
- The owner prefers to test game feel themselves. Don't run long capture or video pipelines; quick logic checks are fine.

## Repository and publishing

- Repository: `https://github.com/Manandi/god`
- Active branch: `claude/practical-babbage-tbonr1`. Fetch it and inspect `git status` before editing. Integrate newer commits without force pushing or discarding local changes.
- Root project: Phaser 2D game. Preserve its code and save data while working on the separate 3D prototype.
- `first-person-verdant/`: Vite/Three.js 3D game. Read its [README](first-person-verdant/README.md), combat and camera code, and the deployment configuration before editing.
- GitHub Actions [Pages workflow](.github/workflows/pages.yml) publishes the 2D game at `https://manandi.github.io/god/` and this branch's 3D game at `https://manandi.github.io/god/verdant/`.
- The existing owner-private 3D Site is `https://verdant-reach-first-person.manandi.chatgpt.site`, configured by `first-person-verdant/.openai/hosting.json`. Its source repository has some independent character/performance work. Merge deliberately; do not overwrite it wholesale with the GitHub tree. The root `.openai/hosting.json` belongs to the separate 2D Site.

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
2. The town and shop are still **not built**. The story keepers are the first NPCs; the town should reuse `createNPC` in `src/avatarGLB.js`.
3. Third-person limb distortion was reported earlier. The player asked not to change the character design, so it is untouched; revisit only if they ask.
4. The ChatGPT Site (`first-person-verdant/.openai/hosting.json`) still serves older source. Merge deliberately before redeploying it.

## Earlier state — 2026-09-28 (morning)

- Game commit `ecf0fbb` merged the PC's combat overhaul (charged heavy attacks, Breath/stamina, poise/topples, three shellback attacks). The previous ChatGPT Site deployment was built from its own source commit `4a4f2eb`, before that overhaul.

## How to hand off work

After each meaningful task, update this file with the date, the exact commit, what changed, what was tested, what was published and verified, and remaining issues. Keep the newest update above older notes; remove stale claims. Run `npm ci`, `npm run dev` and `npm run build` in `first-person-verdant/` for 3D changes. Use `?arena&debug` or F3 for combat testing. Run root checks when touching the 2D project. Commit and push to the existing branch, then verify the GitHub Actions run and live Pages result. If updating the 3D Site, push its **existing** source repository and verify the deployment separately. Never claim a deployment is live from a successful push alone.
