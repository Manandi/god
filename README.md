# The Hollow Roots — project handoff

This is the shared status file for work on the game from different devices or AI assistants. **Read it before changing the game and update it after each meaningful change.** The GitHub branch is the shared source of truth; a local checkout can be behind even when another device has pushed newer work.

## Latest handoff — 2026-10-05 (later) · Shadowmere as its own world, new monkeys, open-ended saga, dev panel (Claude)

The owner asked for:
- Shadowmere as another world in the green part of the globe, unlocked at **level 3**; the snow realm comes next at **level 5** ("by the end of week two").
- A better monkey design, plus a new, harder combo of its own.
- A darker forest.
- An open-ended story that keeps connecting world to world.
- A less congested dev panel that reaches everything.

### Worlds
- **Shadowmere is its own world.** It's centred at (900, −55) in `world.js` (`SHADOWMERE`, `REALMS`, `realmAt`), beyond the camera's 540 m draw distance from the Reach.
  - It has its own height function (`shadowY`: a level trail and clearing, banks rising past the edge), a dark ground skirt, and a walkable edge (`collision.js` `inWorld`).
  - The sky now follows the camera.
- **Getting there and back:**
  - The Rootway in Mossgate's square (`ROOTWAY` at (2.6, 49.2)) or the atlas, at level 3. Locked otherwise.
  - In Shadowmere, a Rootway by the arch (`ROOTWAY_BACK`) takes you home.
  - `crossRealm()` and `placeAt()` in `main.js` handle the move. Falling in Shadowmere respawns you at its arch.
  - When the objective is in the other world, the quest marker points to the Rootway.
- **Atlas (`profile.js` BIOMES):** SHADOWMERE (id `shadow`) at longitude .225, latitude .62 on the green, level 3. FROSTBOUND CROWN restored at level 5 ("COMING NEXT"), then Ember 10 and Wraith 15. ChatGPT's atlas let anyone enter at level 1; it now checks the level.
- **Darker:** fully night everywhere in the realm (no fade). Deep blue fog and sky, a dim moon and fill, and 5 stronger lantern lights.

### Monkeys
- **New Blender model** (`build_shadowmere.py` `monkey()`; preview with `-- --preview x.png --monkey`): leaf crown and leafy collar, huge pink-lined ears, amber eyes with highlights, heart-shaped pale face, a crouched stance on long arms, a spiral tail. Size .82.
- **New moveset** (`creatures.js` ATTACKS: `flurry`, `pounce`, `seed`; monkeys keep `lunge`):
  - **Claw Flurry:** 3 swipes that step in and re-aim between hits. A lunge chains into it 55% of the time, with a faster tell.
  - **Leaping Pounce:** from 4–8 m, it leaps to where you stood and lands a heavy blow.
  - **Seed Pellet:** thrown from 5.5–13 m. `main.js` `throwSeed` flies it; you can dash through, guard, or parry it away.
  - **Hop back:** when struck, a monkey often springs out of reach and counters.
  - Stats: 50 health, 12 poise, faster, shorter cooldowns. Monkeys respawn after 45 s, Garrow after 150 s.

### Story: an open-ended saga (`story.js` header explains it)
- **Book I, The Verdant Reach:** unchanged up to Orrun. `end` is no longer the end: "Ask Halden what the roots are saying" (Halden's main dialogue). The ending card says BOOK I COMPLETE.
- **Book II, Shadowmere:** `shadow_cross` → `shadow_meet` → `shadow_hunt` → `shadow_memory` → `shadow_guardian` → `shadow_report`.
  - **Maren** the Lamplighter is a new NPC by the arch.
  - The hunt counts 3 monkeys (`story.tally`, saved).
  - The memory is a lantern seed by the falls (`SEED_SHRINE`): Ashmere fused crown-glass to Garrow's hand.
  - Garrow is the Rootbound Gorilla. Freeing it breaks the shard.
- **Book III, The Frostbound Crown:** `frost_wait`, "Grow to level 5". The shard points north to where what's left of Ashmere waits.
- **To add the next world:** append its stages after `frost_wait` (saves keep their place), and give it a keeper, journal pages and a hook into the world after.
- The quest card shows BOOK I / II / III.

### Dev panel (F2, password unchanged)
- Tabs: PLAYER, WORLD, FIGHT, STORY, STATS, with a sticky header and RESUME.
- **New:**
  - a level override (REAL/1/3/5/10/15, ±1). It's `profile.js` `devLevel`; real XP and the leaderboard (`realLevel()`) are untouched.
  - world travel, IGNORE LEVEL LOCKS, OPEN THE HUNT NOW
  - teleports to every place, Shadowmere spots, and every NPC
  - a monkey or Garrow in front of you, FREEZE ENEMIES, REVIVE ALL
  - story jumps by Book, plus ◀ PREV, and stage picker groups
  - inventory and atlas shortcuts
- The scratchpad test `devkey2` now opens the STORY tab before clicking NEW GAME.

### Checks
- Travel both ways, the level lock, respawn in the realm, and the edge holds.
- The full Book II run: the 1/3–3/3 count, falls memory, Garrow, the Book III hook, journal pages, and saved tally.
- Monkey attacks picked by range, and the pounce, flurry (multi-hit) and seeds all land. 8 of 20 struck monkeys hop back.
- Shadowmere flood fill: no pockets, and every point reachable.
- story, smoke3, weap, talkmem2, devkey2 and saves pass. Screens: the atlas, the dark forest, the new monkeys, all dev tabs.

## Latest handoff — 2026-10-05 · Shadowmere rebuilt from the concept image (Claude)

The owner asked for the dark forest to match the concept image, "with the mobs as well". ChatGPT's version (below) worked, but it was cylinder trees and primitive-shape monkeys. It is now built in Blender:
- **Blender builder:** `tools/blender/build_shadowmere.py`, rewritten, run with Blender 4.5 here. Its output `public/worlds/shadowmere.glb` (1.2 MB) holds:
  - **Forest:** 3 giant gnarled mossy trees with buttress roots and hanging moss (about 4k triangles each), an amber cage lantern on a vine, glowing mushroom clusters, a mossy boulder, the root arch, and the waterfall cliff.
  - **Green monkey:** big pointed ears, amber eyes, leaf crown, leafy collar, curled tail.
  - **Rootbound Gorilla:** leaf mantle, three seed grenades on its belt, roots wrapped round its right forearm, green crystal sword.
  - **How the parts are set up:** each creature part's origin is at its joint (shoulders, hips, neck, tail base, sword grip).
  - **To preview:** run `blender --background --python tools/blender/build_shadowmere.py -- --preview out.png [--trees]`.
- **`src/shadowmere.js` (new):**
  - Places about 76 instanced trees, plus rocks, mushrooms, lantern posts every 7.5 m along the trail, the root arch at the entrance, and the cliff with the waterfall and pool behind the gorilla's clearing, with a stream running east.
  - Colliders are spaced so nothing can box a walker in.
  - The moon hangs over the trail (north), with fireflies, blue ground mist, and 4 warm lights that hop to the nearest lanterns.
  - `dress()` puts the Blender bodies on the monkeys and the gorilla. The arms, legs, head, tail and sword stay on the joints that `creatures.js` already animates, so the attack tells still line up.
- **`src/world.js`:**
  - ChatGPT's cylinder trees, seed posts and its two point lights were replaced by the above. Its ground disc, trail, ferns and monoliths stay.
  - The floor has moss and stone colour patches, and the ferns stay 7.5 m off the trail.
  - `updateAtmosphere` now fades into blue moonlit mist (cool moon colour, bluer fill) and returns the shade value.
- **`src/creatures.js`:**
  - A dressed primate keeps its head on its own neck (`neckBase`). Before, the shellback head code pushed the monkey's head out in front of its body.
  - The gorilla has belly and chest hit volumes. Before, its body sphere sat about 2 m up and blade swings passed under it.
  - There are 5 green monkeys instead of 3.
- **`src/main.js`:** creates and updates Shadowmere, and the HUD region says SHADOWMERE inside it. Entering from the atlas (or `?shadowmere`) now faces you north, through the root arch into the forest; before, it faced back out at the grassland. It also skips the "Welcome to Mossgate" tip.
- **Checks:**
  - Screenshots of the entrance, trail, clearing and mobs.
  - A flood fill over Shadowmere: no closed pockets, and the trail reaches the gorilla, the pool, the stream and every monkey's spawn point.
  - Hits land on the monkeys and the gorilla, and they hit back.
  - The production build passes, and smoke3, story and weap pass.
- **Saves:** checked on 2026-10-05. All 8 cloud saves are present (the friends' unnamed ones, Speckz, Vincent, Wayfarer, manandi and two more). None changed after ChatGPT's commits. `load_weekly_hunter` falls back to a player's latest save when a new week starts, so the 2026-10-05 week loads last week's progress.

## Latest handoff — 2026-10-05 · Shadowmere scene design

- **Branch:** `claude/practical-babbage-tbonr1`. Initial Shadowmere game commit: `12cc7f36f4757183073851735f6ee1ab91fe03bc`. This handoff accompanies a follow-up scene-design commit. Fetch the branch and check for newer PC commits before continuing.
- **New destination:** Shadowmere is selectable as the second playable atlas realm inside the connected grassland. It adds dark soil, a dense canopy and amber seed lights; green monkey enemies; and the Rootbound Gorilla with a sword, telegraphed slam and expanding seed-burst attack. Test route: `?shadowmere&debug`.
- **Concept image:** `first-person-verdant/public/concepts/shadowmere-forest-concept.png`. Blender scene source: `first-person-verdant/tools/blender/build_shadowmere.py`.
- **Playable scene design:** the concept image is only a reference. The actual 3D scene now has a longer dark-soil trail, 140 dense crown trees with physical trunks, exposed roots, ferns, amber trail lights, stone guardian markers, a clear combat arena and smoothly changing forest fog/lighting. Bright grassland trees, rocks and flowers are excluded from this biome. The entry and central trail are clear of colliders.
- **Data safety:** no save, account-linking, leaderboard, Supabase or world-record code/data was changed. Keep existing storage keys and shared player records intact. The new direct-entry route does not mark the profile complete.
- **Checks:** `npm ci` and the Vite production build pass; the build reports the existing large JavaScript chunk warning. Changed JavaScript passes `node --check`; a Three.js smoke check created both enemy types, confirmed 150 forest colliders with a clear entry and five clear trail samples, and observed gorilla wind-up, slam and seed-burst events. The local browser preview was blocked by the admin policy check, so visual playtesting is still pending.
- **Blender status (superseded):** ChatGPT's builder never exported on the Mac. Claude rewrote and exported it on 2026-10-05; see the newer section above.
- **Deployment:** game commit `12cc7f36f4757183073851735f6ee1ab91fe03bc` was fast-forwarded to the existing branch without a force push. Its GitHub Pages Actions run completed successfully. The public page serves the new JavaScript bundle with the Rootbound Gorilla and Shadowmere route, and the concept image returns HTTP 200. Play at `https://manandi.github.io/god/?shadowmere`. The separate Sites config is independent and was not updated.

## Rules for AI assistants: read first

These come from the owner. Follow them on every device and with every model.

### Who owns what (the owner's decision, 2026-09-28)

The 3D game combines two sources. Keep each part with its owner, and don't replace one with the other.

| Part | Source | Where |
|---|---|---|
| **Character design**: the Roblox-style block explorer, first-person block hands, character creator (name and look) | ChatGPT Sites version (`box-characters` branch) | `src/avatar.js`, `src/humanoid.js`, `src/shell.js`, `src/profile.js` |
| **NPC design**: block NPCs with animated faces, turning to face you, markers | ChatGPT Sites version | `src/npcs.js` (the builder); colours and positions in `NPCS` in `src/story.js` |
| **Town design**: Mossgate, the Rootward Homestead (start), lantern-light pooling | ChatGPT Sites version | `buildCity` and `buildHome` in `src/world.js`; house positions in `CITY_HOUSES` |
| **Town dressing** (added 2026-09-29 at the owner's request): Blender props that add to Mossgate without changing it | Claude | `tools/blender/build_mossgate.py` → `public/sites/mossgate-props.glb`, placed by `src/sites.js` |
| **Memory sites**: the Rootwell (its ring was the ChatGPT design; the owner asked for it to be rebuilt in Blender), Mosswatch Ruins, the Canopy Shrine | Claude (Blender) | `tools/blender/build_sites.py` → `public/sites/memory-sites.glb`, placed by `src/sites.js` |
| **Combat**: moves, guard and parry, evade, flasks, sprint and jump attacks, creature AI | Claude | `src/combat/*`, `src/creatures.js` |
| **Story and plot**: stages, all dialogue, journal, quest-point mob spawns, save migration | Claude | `src/story.js`, and the encounter and dialogue code in `src/main.js` |
| **Boss and arena**: Orrun, the Hollow Warden (moveset, tail club), and the Warden's Hollow | Claude | `src/boss.js`, `tools/blender/build_warden.py`, `build_arena.py` |
| **Camera and quest waypoint**: shoulder camera (hold right click to orbit), compass strip, on-screen waypoint | Claude; camera adapted from [Rotten Souls](https://github.com/igorjohn/rotten-souls) (MIT) | `src/camera.js`, `updateWaypoint` in `src/main.js` |
| **Stats → mechanics**: what each real-life stat does in play, and frames (weight and height) | Claude | `src/mechanics.js`, `FRAMES`/`frame()` in `src/profile.js` (the stats screen shows the same table) |
| **Onboarding**: the story intro with the floating Mycel (Blender), measure, the adaptive mind check, how you play, class reveal | Claude (at the owner's request, 2026-09-30) | `src/shell.js` (intro to reveal), `src/narrator.js`, `tools/blender/build_mycel.py`, `src/reasoning.js`, `METRICS`/`PERSONALITY` in `src/profile.js`. The character creator that follows stays ChatGPT's design |
| **Classes, weapons, Rootbreaker, double jump**: class and weapon rules from ChatGPT; weapon models (Blender, `build_weapons.py`), movesets and hit timing by Claude | Both | `CLASS_INFO`/`weaponEligibility` in `src/profile.js`; `MOVESETS` in `src/combat/moves.js` |
| **Mossgate Chronicles, dialogue choices**: the idea and choice UI from ChatGPT; the three chronicles were rewritten into Claude's story on 2026-10-01. The Old Shell was removed at the owner's request ("it keeps the game repetitive") | Both | `src/chronicles.js` |
| **Dev panel and co-op lobby**: ideas from ChatGPT, rebuilt for GitHub Pages. The dev panel is hidden: F2 then the password | Claude | dev block in `src/main.js`; `src/coop.js` (Supabase Realtime) |
| **Link this device**: one-time codes that carry an explorer and its cloud save to another browser | Claude | `src/identity.js`, `supabase/schema.sql` |
| **Leaderboard with 🧢 caps**: stats only (never weight or height); friends can cap a doubtful stat until shown proof | Claude | `src/leaderboard.js`, `supabase/schema.sql` |

How the story uses the ChatGPT NPCs:
- In Mossgate, **Sela** (Wayfinder) starts the story, **Orin** (Warden-Captain) reviews the trial and sends you to the Rootwell, and **Halden** (Rootkeeper; the NPC id is still `mycel` for old saves) and **Tavi** have story lines for every stage. The town NPC was renamed so it no longer clashes with Mycel, the floating spirit who narrates the intro.
- The site keepers **Brannoch, Ysolde and Pip** are block NPCs in the same style.

**Brought over from the Sites version (2026-09-29):** classes, weapons and their stat gates, the Rootbreaker, the double jump, the Mossgate quest (now the Mossgate Chronicles), the Old Shell boss (removed 2026-10-01), dialogue choices, the dev panel and F4 FPS readout, and a co-op lobby. The Sites lobby used its D1 worker, which GitHub Pages can't run, so co-op now runs on Supabase Realtime with the same lobby codes and `?lobby=CODE` links.

**Still not taken:** the KayKit legacy models. They remain on the `box-characters` branch. **Do not merge that branch wholesale:** its last commit moves the Sites project to the repo root.

### Do not touch

- **Character, NPC and town design.** Do not restyle, remodel, re-rig or re-proportion the block explorer, the first-person hands, the block NPCs, Mossgate or the Homestead. Town props may be added (`src/sites.js`); the ChatGPT houses, square, stalls and palisade stay as they are. The old rounded Blender explorer is kept only behind `?legacyCharacters`; never make it the default again.
- **The 2D game is gone.** The owner asked for it to be removed on 2026-10-01; it is in git history (before that date's commits) if ever needed. Don't bring it back without asking.
- **3D save data.** Keep the `verdant-reach-3d-v1` and `hollow-roots-verdant-3d-profile-v1` keys. Any change to the save format must migrate older saves; see `createStory` in `first-person-verdant/src/story.js`. It already maps the old `meet_wren` stage to `meet_sela`.
- **The ChatGPT Site.** `first-person-verdant/.openai/hosting.json` and its separate source must not be overwritten wholesale with this tree. The 2D Site's `.openai/hosting.json` was removed with the 2D game.
- **Secrets.** Never ask the owner to paste tokens or keys in chat. Never commit a Supabase `service_role` key. The publishable key in the Pages workflow is meant to be public.
- **Branches and history.** Work on `claude/practical-babbage-tbonr1`. Never force-push, and never merge `box-characters` wholesale.
- **Scope.** Don't change things the owner didn't ask for. Adding things is fine.
- **Intentional duplicates.** `AGENTS.md` and `CLAUDE.md` are identical on purpose. 
- **Unity.** It is not usable here: it needs a licensed, signed-in editor, and the game is Three.js. Make 3D assets with the Blender scripts in `first-person-verdant/tools/blender/`.

### Next steps, in order

1. **Playtest Shadowmere in a real browser** with `?shadowmere&debug`: monkey and gorilla hits in first/third person, seed-burst tells, tree collisions and the atlas round trip.
2. **Finish the Blender asset export** from `tools/blender/build_shadowmere.py` in a working Blender environment, then decide whether the exported model replaces or complements the procedural runtime forest/enemies.
3. **Tune the guardian by feel** once the owner plays it. Headless combat checks verify state timing only; they cannot judge weight or readability.
4. Continue the older co-op, Orrun-balance and Mossgate-shop tasks after this requested biome work is verified.

### Map of the 3D game (`first-person-verdant/src/`)

| File | What it owns |
|---|---|
| `main.js` | Input, the game loop, HUD, quest waypoint, dialogue and choices, encounter spawning, boss wiring, dev panel |
| `camera.js` | Third-person shoulder camera: right-drag orbit, lock-on framing, world collision, shake, boss intro shots |
| `mechanics.js` | Real-life stats → damage, speed, dash, jump and double jump, Breath cost, vitality, class bonuses; the equipped weapon |
| `chronicles.js` | The three Mossgate Chronicles and each NPC's dialogue topics (the first topic is a tutorial) |
| `training.js` | The weekly training plan (tasks per week, tiers), the home workouts with their easier versions, the lift-log exercise list, `e1rm()` and cosmetic `TITLES` |
| `coop.js` | Co-op lobby over Supabase Realtime: presence, positions, shared progress, and host-authoritative team fights (`world` snapshots, `hit` events) |
| `combat/moves.js`, `combat/player.js` | Move timings and the player combat state machine |
| `combat/hits.js`, `combat/feedback.js` | Hit detection, and combat sound and effects |
| `creatures.js` | Shellbacks, thornlings, green monkeys and Shadowmere's gorilla (AI, poise, attack tells and hit volumes) |
| `dressingRoom.js` | The character screen's live 3D preview of the real avatar |
| `identity.js` | This browser's hunter id and secret (the cloud save key) and LINK DEVICE codes |
| `leaderboard.js` | The shared leaderboard, worn titles and 🧢 stat caps |
| `boss.js` | Orrun, the Hollow Warden (attacks, follow-ups, breakable tail club), and arena loading |
| `weapons.js` | Loads the Blender weapons and mounts them in the fist; their markers are the strike hitbox |
| `narrator.js` | The intro's 3D glade and the floating, animated Mycel |
| `sites.js` | Loads the Blender memory sites and Mossgate's props, their colliders, and the shrine tree's leaf crowns |
| `profile.js`, `shell.js` | Real-life profile, stats, classes and weapon eligibility; the menus, stats screen and character creator |
| `story.js` | Quest stages, NPC positions, all dialogue, the journal, save migration |
| `world.js` | Terrain (town, homestead and arena levelled), Mossgate and the Homestead, sites, colliders |
| `avatar.js`, `humanoid.js` | The block explorer and first-person block hands (ChatGPT design) |
| `npcs.js` | Block NPC builder and animation (ChatGPT design) |
| `avatarGLB.js` | The old Blender explorer, used only with `?legacyCharacters` |
| `angles.js` | Shared `angleTo` and `yawOf` helpers |

**Testing:**
- `?arena` skips the menus; add `&third` for third person, `&debug` or F3 for the combat readout, and `&capture` for stepped frames.
- `?shadowmere&debug` opens Shadowmere directly without marking the profile complete.
- **F2 then the password (`DEV_PASSWORD` in `src/main.js`) opens the dev panel** (asked once per tab): NEW GAME to replay the start as a new player, REDO MY TESTS to retake your measurements now, stat presets (MY REAL STATS undoes them), no damage, no-clip, infinite Breath, colliders, teleport to any place, any weapon, any class, stat presets, and jump to any story stage. F4 shows FPS.
- `window.__verdant` exposes the game state and its test hooks.
- The owner prefers to test game feel themselves. Don't run long capture or video pipelines; quick logic checks are fine.

## Repository and publishing

- Repository: `https://github.com/Manandi/god`
- Active branch: `claude/practical-babbage-tbonr1`. Fetch it and inspect `git status` before editing. Integrate newer commits without force pushing or discarding local changes.
- `first-person-verdant/`: the game (Vite/Three.js 3D). The 2D Phaser game that used to be the repository root was removed on 2026-10-01. Read its [README](first-person-verdant/README.md), combat and camera code, and the deployment configuration before editing.
- GitHub Actions [Pages workflow](.github/workflows/pages.yml) publishes this branch's 3D game at `https://manandi.github.io/god/`; `/god/verdant/` redirects there, keeping `?lobby=` codes.
- The existing owner-private 3D Site is `https://verdant-reach-first-person.manandi.chatgpt.site`, configured by `first-person-verdant/.openai/hosting.json`. Its source repository has some independent character/performance work. Merge deliberately; do not overwrite it wholesale with the GitHub tree.

## Latest shared state — 2026-10-04 (no more getting stuck, 3 dialogue choices, stronger story, quest tracker)

- **Getting stuck** (the owner was wedged between crates and posts in Mossgate, and on some rocks):
  - `src/collision.js` `canOccupy`: if you already overlap something (after landing a jump on a rock's edge, a dash, or a knockback), any step that moves you out of it is allowed.
  - The crate stack by house 3's door is gone (`BY_DOOR` in `src/sites.js`). With the cart and lantern posts it boxed walkers in.
  - Automatic unstick: `escapePocket()` in `collision.js`, called from the movement code in `main.js`. If you push for a second without moving, it flood-fills the 0.5 m cells around you. If no open path leads 6 m out, it moves you to the nearest open ground. Out in the open it does nothing, so walking into a wall never teleports you.
  - Checked by a full-map flood fill: the only enclosed area is the sealed hollow, plus 1–4 cell slivers, and the unstick walks out of every one.
- **Dialogue shows at most 3 choices** (`showChoices` in `main.js`): the chronicle step, if there is one, then the freshest topics (heard ones only when nothing new is left), then Farewell. Keepers' decisions still show only their 2 answers.
- **Story pacing and plot** (`src/story.js`; stage ids unchanged, so saves are untouched):
  - **The clock:** the Forgetting. Each night Mossgate loses something (a lantern, the baker's name), and when the last lantern goes dark the town forgets itself.
  - **The beats:**
    - Orin says the Warden may have to die.
    - The Rootwell memory shows wardens in Mosswatch green drinking at the pool.
    - Ysolde confesses it was Mosswatch, and the plot turns: Orrun is the only thing still holding the rot back.
    - Pip makes it personal: Sela forgot Pip's name.
    - The carving says "If it forgets, remind it. Don't kill it."
    - The finale: beat it down until it can hear you, then let it rest, through the Thursday rift.
  - The main conversations are 4–5 lines, and each ends on a hook into the next place. The memories, the journal and some objectives were rewritten to match. The gate objective is now "Free Orrun: on Thursday, step through the Hollow Rift in Mossgate".
- **Quest tracker** (top left; `updateQuestCard` in `main.js`, `story.progress` in `story.js`, `.quest-card` in `style.css`):
  - A framed card shows the act ("CHAPTER II · MOSSWATCH RUINS") with diamond pips for its 4 steps, the objective (it wraps, never clipped), an arrow and distance to the target, and a thin bar for the whole story.
  - A new objective flashes gold with "NEW OBJECTIVE" for 4 s.
  - The chronicle or hunt line sits under the card.
  - On phones the compass strip is hidden, because the card already shows the direction and distance.

## Latest shared state — 2026-10-04 (class picker dropdown)

- **CUSTOMIZE's class section is a dropdown** (`classTable()`/`classDetail()` in `src/shell.js`):
  - Closed, it's one line: the current class and ▾.
  - Open, the **left** side is a list: Mycel's recommendation (with TAKE), then the 5 CLASSES, then the 10 HYBRIDS. Locked hybrids are dimmed and say LOCKED.
  - The **right** side shows the details of the hovered (or current) class: description, bonus, key stats, G/T moves, weapons, and open or locked with what it needs. On phones the details sit below the list.
  - Clicking an open class takes it and closes the dropdown.
- The owner first got a 5×5 table and didn't like it ("just keep it a drop down for each class, and on the right side the detail"), so don't bring the table back.

## Latest shared state — 2026-10-03 (weapon charge tiers by level)

- **Charging grows with level** (owner's idea; `chargeCap()`/`CHARGE_TIERS` in `src/combat/moves.js`, applied in `combat/player.js`):
  - Below **level 3** the heavy can't be held (no charge).
  - **Level 3:** charge I. **Level 5:** charge II.
  - **Level 10:** holding the heavy turns it into the weapon's **signature blow**: Rootbreaker (fists), Verdant Spiral (Groveblade), Faultline (Stonebreaker), and new ones for the new weapons: **Spore Storm** (wand: a bigger burst), **Gale Shot** (bow: a faster, harder piercing arrow) and **Grove Bloom** (staff: heals 2–3 within 9 m).
  - This applies to every weapon, fists included. Dev mode ignores it.
- The inventory shows each weapon's three tiers and which are unlocked. Orin's "Show me the Rootbreaker" and the controls hint explain it.
- Tested holding heavy: level 1 doesn't charge; level 3 reaches charge I; level 5 charge II; level 11 turns into the signature blow (spiral, storm, grove), with no errors.

## Latest shared state — 2026-10-03 (class weapons, inventory, class moves)

- **New Blender weapons** (`tools/blender/build_weapons.py` → `public/characters/weapons/weapons.glb`):
  - **Spore Wand** (mage): twisted rootwood with a glowing mushroom tip.
  - **Windstring Bow** (ranger): curved heartwood limbs with a glowing string.
  - **Bloom Staff** (support): a long haft crowned with a healing flower.
  - Fighter keeps the Groveblade and tank the Stonebreaker.
  - Grips are in `src/weapons.js` (`GRIP`/`FP_GRIP`).
- **Ranged and healing moves** (`src/combat/moves.js`):
  - Moves without a `hitbox` fire a `shot` at a set time (`combat/projectiles.js`). Projectiles hit through `strikeCreature`, so co-op guests' hits still go to the host.
  - The wand fires bolts; its heavy is a charged orb that bursts in an area (the mage's `chargePower` scales the wand).
  - The bow fires arrows; its charged heavy pierces.
  - The staff does two sweeps; its heavy is the **Bloom** (a `pulse`), which heals you and every hunter within 7 m.
  - Aiming uses the lock target, else a creature within about 18° ahead, else straight ahead (in first person, where you look).
- **Weapon rules** (`weaponEligibility` in `src/profile.js`):
  - Fists for everyone. Each class weapon opens at **level 3**, for its own class only; an unlocked hybrid carries both classes' weapons.
  - If your chosen weapon is locked you hold your class weapon (if open) or your fists. The old stat-gated "bare hands" penalty is gone.
- **INVENTORY** (menu button, or **I** in game): your weapons, showing which are equipped, open or locked and why, plus your class moves. EQUIP picks one.
- **Class moves** (`src/combat/skills.js`, keys **G** and **T**, a HUD bar under Breath with cooldowns and active buffs):
  - Every class learns a move at **level 3 (G)** and **level 5 (T)**:
    - **Fighter:** Whirlwind (360° heavy); War Cry (+25% damage for you and hunters within 9 m).
    - **Tank:** Barkshield (you and the nearest hunter soak 2 hits); Root Stomp (stagger within 4 m).
    - **Ranger:** Volley (5 arrows); Wind Step (+30% speed, free dashes).
    - **Mage:** Spore Nova (area burst at the target); Rooting Snare (they reel, open to a Root Strike).
    - **Support:** Mending Bloom (heal 1 for you and hunters within 9 m); Second Spring (survive one fatal blow).
  - An unlocked hybrid gets its first class's level-3 move on G and its second class's on T.
  - Team effects travel as co-op `support` messages (`coop.sendSupport`, `applySupport` in `main.js`).
- Orin's tutorial now mentions level 3 weapons, I, and G/T. The dev panel can equip any weapon.
- **Tested in the browser:**
  - Wand bolts and burst, bow arrows and Volley, and the Bloom and Mending Bloom (+1 heart each) all work.
  - Barkshield is up for the tank.
  - At level 1, moves and weapons are locked.
  - The inventory equips a weapon.
  - Grips were checked in third and first person (the bow was rolled upright).

## Latest shared state — 2026-10-03 (Thursday hunt, Hollow Rift, week 1 quest)

- **Week 1 quest:** learning is **one 20-minute session** (was two). Every learning task now says that anything counts: a hobby, cooking, an instrument, a language and so on (`note` on `learn()` in `src/training.js`). Week 1 is still about 560 XP, which is level 3.
- **The weekly hunt** (`src/bossEvent.js`, `bossWindow()` in `src/weeklyWorld.js`):
  - **When:** Orrun opens every **Thursday, Central time** (America/Chicago), all day. The first hunt is **2026-10-08**, a week after launch.
  - **Level required:** 3 for the first boss, then 2 more each week (5, 7, …), which tracks the plan's pace. Doing the full plan reaches it, with little slack in week 2.
  - **Getting in:** the hollow is **sealed by a ring of thorns** (colliders at 24 m; you can't walk or jump in). The only way in is the **Hollow Rift** in Mossgate's square (0, 61.6), and a gold rift inside takes you home.
  - **The gathering:** the first hunter through starts a **shared 5-minute gathering** (`boss_gather` RPC; `weekly_worlds.gathering_at`, server time, so every player sees the same clock). When it ends, Orrun wakes if **2+ hunters** are in the hollow; otherwise the HUD says "WAITING FOR A SECOND HUNTER".
  - **During the fight:** once it starts, the rift only lets back in people who already joined this attempt. If you fall while others still fight, Orrun keeps going and you wake by the rift in Mossgate. If everyone falls and Orrun sleeps again, the host clears the gathering so the next attempt starts fresh. Gatherings older than 25 minutes also go stale.
  - The story is no longer needed to fight Orrun. Players at the gate stage still get the release scene and the ending, and the gate objective now points to the rift.
  - The server checks Thursday Central for both `boss_gather` and `defeat_weekly_boss` (migration `boss_thursday_central_gathering`, in `supabase/schema.sql`).
  - **Tested** with a faked Thursday clock and mocked RPCs, so nothing was written live:
    - Level 2 is turned away; on a Saturday the rift is sealed.
    - At level 3 the rift teleports you and starts the 4:59 countdown.
    - Alone after 5 minutes: "waiting". With two hunters (tabs over `&net=local`), Orrun wakes.
    - Walking at the hollow stops at the thorns (25 m).

## Latest shared state — 2026-10-02 (quieter theme, typing sounds)

- **Mycel's theme is quieter and chiller** (`src/music.js`):
  - About 8 dB quieter (`VOLUME = .28`).
  - 62 BPM instead of 72, a darker filter (2.1 kHz) and a soft tape echo.
  - Slow-rolled chords; one kick per bar (two every other bar) and lighter brushes; a softer flute that rests 4 bars in 16; fewer birds.
- **Typing sounds:** a soft wooden tick on every other letter, with slightly varying pitch, throttled to at most one every 45 ms. It plays while Mycel's intro text types (`lofi.blip` in `src/shell.js`) and while NPC dialogue types in game (`typeBlip` in `updateDialogue`, `src/main.js`). It plays whether or not the music is on. `music.js` now exports a single `lofi` player shared by both.

## Latest shared state — 2026-10-02 (NPC memory, story decisions, overall ranking, Mycel's theme)

- **NPCs share what you have been told** (`chronicles.heard`, saved in the world save; old saves start empty):
  - Every topic you hear, from anyone, is remembered. New topics are listed first; heard ones drop to the bottom with ✓.
  - Tutorials skip what another NPC already taught you. For example, Tavi skips Breath once Orin explained it, and Sela's "Where should I go now?" names the current objective.
  - A side quest's full pitch is given once. If you already cleared its site, the giver just asks what you found and you turn it in.
  - Replies can be functions of what you know (`replyLines()` in `src/chronicles.js`).
  - The old "Last time you asked me…" line is gone.
- **Gossip:** NPCs mention, once each, something you said or did with someone else, or your class and level (`GOSSIP` in `src/story.js`; one per conversation).
- **Story decisions** (`DECISIONS`, `story.decisions` saved in `story`, `pendingDecision()`):
  - Each keeper asks one real question after its report:
    - Brannoch: wall the Rootwell off, or leave it open to the creatures.
    - Ysolde: confess in the square, or tell only Orin.
    - Pip: bring Pip to the gate, or send them home to Sela.
  - Walk away and they ask again next time.
  - The keepers' everyday lines change with your answer, the town gossips about it, and the journal has a WHAT YOU DECIDED page.
  - The release scene at the gate (`endingLines()`) and the ending card (`#endingChoices`) both reflect all three.
- **Leaderboard ranks by OVR:** the average of the six stats, with a capped stat counting as at most 10, as in play. Ties go to level, then XP. It is sorted in the browser over up to 200 rows, with a new OVR column. Tested with mocked rows, so nothing was written live.
- **Mycel's theme** (`src/music.js`):
  - An original lofi forest loop synthesised with Web Audio, with no audio files and nothing copyrighted. The owner asked for "the most popular YouTube forest or game opening theme"; those are copyrighted, so this one was composed instead.
  - Parts: Fmaj9, Em9, Dm9, Cmaj9 electric piano, bass, a swung brush beat, pentatonic flute, vinyl hiss and birds, at 72 BPM.
  - It plays during the intro and the rest of onboarding (while Mycel talks), starts on the first click or key, and fades out in game.
  - ♪ MUSIC ON/OFF is on the intro screen (`hollow-roots-music`).

## Latest shared state — 2026-10-02 (named hybrid classes, class unlocks)

- **Hybrids are their own choices.** CUSTOMIZE shows COMBAT CLASS (5 pure) and HYBRID CLASS (all 10 by name, e.g. SKIRMISHER, FIGHTER + RANGER) instead of a hidden "second class" row. Mycel's recommendation card has a TAKE button, or shows ✓ THIS IS YOUR CLASS. Buttons use `data-path="primary+secondary"`; picking a hybrid keeps your current primary first (the leaderboard shows the primary).
- **Class unlocks, as the owner settled them:**
  - **All five classes are open to everyone.** The owner didn't want to push anyone into Support.
  - **Hybrids are stat-locked:** both stats must reach **12** (`HYBRID_REQ`, `classUnlock()` in `src/profile.js`). They are "something to chase".
  - **Hybrids are much stronger:** the full bonus of both classes (`HYBRID_SHARE = 1`) plus Hybrid Mastery (+10% damage, +10% Breath recovery; `HYBRID_MASTERY`, applied in `mechanics.js`).
  - A hybrid whose stat drops below 12 (a new test or a 🧢 cap) plays as its first class until the stat is back.
  - Mycel recommends your best class plus your best unlocked hybrid partner.
  - Example at strong stats: Fighter has damage ×1.42; Skirmisher has damage ×1.56 plus Ranger's speed and dash.

## Latest shared state — 2026-10-02 (squat and deadlift removed)

- Owner's call: no squat or deadlift tests. Strength stays bodyweight first (push-ups 40%, pull-ups 35%, bench 25%), and the bench also feeds Defense (the shield arm, 45%). The optional tests are now plank (→ DEF) and resting heart rate (→ STA). Squat and deadlift stay in the lift log's exercise list (cosmetic titles only).
- Decided 2026-10-02: stats stay based on the monthly test only. Logged training does not move stats between tests (the owner's call; don't build the activity-based idea unless asked again).

## Latest shared state — 2026-10-02 (lift log page, faster levels, minimap, hybrid classes)

- **Lift log has its own page.** WEEKLY QUEST shows a PERSONAL LIFT LOG › button under OTHER ACTIVITY (with sets and PRs); it opens view `lifts` (`renderLifts()` in `src/shell.js`).
- **Leveling, the owner's pace.** A full first week of the plan (about 570 XP) is level 3; two weeks (about 1,200) is level 5.
  - `xpForLevel(n) = 227·(n−1)^1.14`, and `level()` is the highest level reached. Levels then slow: about level 7 after week 3 and the high 20s by the end of the 90 days.
  - The menu shows the XP to the next level. Existing players simply show their new level.
  - Orrun now scales his health with the level damage bonus (`warden.scaleHealth`, applied when he wakes), like the creatures already did, so faster levels don't trivialise him.
- **Minimap** (`#minimap`, `updateMinimap()` in `src/main.js`): north-up, 60 m around you.
  - It shows: your arrow, friends in the lobby (blue, named, pinned to the rim with their name when far), townsfolk (gold), awake creatures (red) and the objective (diamond, pinned to the rim).
  - `coop.others()` now includes names. Tested with two tabs over `&net=local`.
- **Hybrid classes** (`HYBRIDS`, `pathInfo()`, `classWeights()`, `recommendedPath()` in `src/profile.js`):
  - An optional SECOND CLASS in CUSTOMIZE blends two classes, with a name for each of the 10 pairs: Skirmisher (fighter+ranger), Vanguard, Spellblade, Warcaller, Pathguard, Runeguard (tank+mage), Protector, Windcaller, Pathfinder, Sage.
  - A hybrid gets 65% of each class's bonus (`mechanics.js` scales every class bonus by its weight); a pure class gets 100%.
  - Mycel recommends a hybrid when your top two class scores are within 8%.
  - The leaderboard still stores the primary class.
- **Sela no longer stands on a crate stack.** A crate stack by house 3's door was placed on her spot; it moved to the other side of the door (`BY_DOOR` in `src/sites.js`). A browser check finds no NPC overlapping any collider.
- **Click fuzzing:**
  - 260 random clicks and drags across 12 menu screens (59 distinct buttons); then 150 actions on the world map (globe clicks and drags, realm buttons, ENTER, BACK, M in game).
  - No errors and no stuck states.
  - ENTER on a locked or unbuilt realm is now visibly disabled instead of a live button that did nothing.
- The stat rebalance the owner floated was settled: stats stay on the monthly test (see the next entry up).

## Latest shared state — 2026-10-02 (hair and outfits fixed, optional tests)

- **Hair in front of the face, and messy outfits: fixed.** `tools/blender/build_customization.py` wrote three.js coordinates (y up) straight into Blender (z up), so every hair and outfit piece came out turned 90°: hair over the face, plates sideways. The script now converts each piece (`to_blender`), and the GLB is rebuilt.
  - avatar.js also showed the old code-built outfit pieces **together with** the Blender ones; once the pack loads, the code-built ones are now removed.
  - Redesigned pieces:
    - **Ranger:** hood, cape, quiver, chest strap, belt pouches, archer's guard.
    - **Warden:** plates, layered pauldrons, gorget, vambraces, tabard.
    - **Wanderer:** coat, lapels, scarf, sash, satchel.
    - **Sentinel:** cuirass, round pauldrons, faulds, tassets, knee cops, greaves.
    - **Hair:** a shared scalp for every style, plus tufts, curls, a quiff, a ponytail and a braid.
  - Cloth pieces follow the chosen shirt colour (materials `Customization_Cloth`/`DarkCloth`).
  - `?dresstest` exposes `window.__dressAngle(radians)` to turn the preview for screenshots.
- **Optional tests** (measurement form, "OPTIONAL · MORE TESTS, SHARPER STATS"):
  - The tests: plank hold (→ DEF) and resting heart rate (→ STA). (Back squat and deadlift were added here too, then removed at the owner's request.)
  - Blank tests are stored as `null` and drop out. When they are blank, the stat uses the old formula exactly (checked over 20,000 random inputs: 0 differences), so existing saves keep their stats.
  - Every test shows the stats it feeds (→ STR · DEF), and each stat tile lists its tests (`STAT_SOURCES`).
  - Norms for the new tests are estimates (see the 3D README).

## Latest shared state — 2026-10-01 (flicker fix, stat refresh)

- **Background flicker fixed** (`frame()` in `src/main.js`). Since the live character preview went in (b557c81), a broken `else if` chain drew the paused game world over the intro and map backgrounds every 0.15 s. Now each view draws only its own scene: one clear per frame on the intro, against three before. The intro also runs much smoother.
- **Stat refresh (dev panel, F2 + password):**
  - **REDO MY TESTS** clears the monthly-test lock and history and reopens the measurements, then the mind check (from the stats screen). Level, XP, story and the lift log stay.
  - **MY REAL STATS:** stat presets (DEFAULT, ATHLETE, MAX TEST, UNTRAINED) now set your real measurements aside (`hollow-roots-dev-real-inputs`) and this puts them back. Before, a preset overwrote them for good, and the fake numbers went to the cloud save and the leaderboard.
  - **NEW GAME** now really starts fresh. It used to delete the local save, so the cloud copy counted as newer and the old explorer (with old stats) came back on reload. It now stamps an empty save as newest, and the fresh explorer replaces the cloud copy when it first saves.
- Tested: presets, then MY REAL STATS restores the exact numbers; REDO MY TESTS opens an unlocked form and records one fresh test while keeping XP; NEW GAME leads to the intro; story, saves, combat smoke and dressing room regressions pass. Supabase was blocked in these tests, so nothing was written live.

## Latest shared state — 2026-10-01 (lift log, cosmetic titles, NPC tutorials)

- Still one link: **https://manandi.github.io/god/**, lobby `HROOTS`.
- **Personal lift log** (WEEKLY QUEST page, under the quest list; `liftLog()`/`wireLiftLog()` in `src/shell.js`):
  - A searchable exercise box (a `<datalist>` of 77 exercises from `EXERCISES` in `src/training.js`; you can also type your own), weight (lb or kg, following the units setting), reps and sets, then LOG SET.
  - It shows the last 8 entries (× deletes one), personal records as the best estimated 1RM (Epley, `e1rm()`), and titles.
  - **It never gives XP or changes stats** (the owner's call: lifts can't be checked). Saved in the profile as `lifts` (max 600 entries; sanitized on load), so it goes to the cloud save like everything else. Old saves just get an empty log.
- **Cosmetic titles** (`TITLES` in `src/training.js`): First Rep, Iron Apprentice/Regular/Veteran (25/100/300 sets), Consistent (12 days), Well-Rounded (15 exercises), Record Breaker (10 PRs), Two-Plate Club (102 kg), Three-Plate Club (143 kg). Press one to wear it; the worn title (`profile.title`) shows under your name on the leaderboard.
  - Database: migration `leaderboard_titles` adds `hunters.title` (only those nine ids are accepted) and an 8-parameter `submit_hunter(..., p_title)`; the old 7-parameter one still works. Recorded in `supabase/schema.sql`.
- **NPC tutorials:** each Mossgate NPC's first topic is now a short guide, spoken over several lines. Halden: "How do I get stronger?" (real tests, WEEKLY QUEST and XP, 30-day retests, the lift log, caps). Orin: "Teach me to fight." (light strikes and Breath, charged heavy, lock-on and dash, guard and parry, weak points, the weekend boss needing 2+ players). Sela: "How do I get around?" (movement, double jump, camera, waypoint, journal and map, lanterns). Tavi: "How do I stay alive?" (hearts and flasks, brazier and hearth, Breath, falling).
- **First-time tips** (`tip()` in `src/main.js`, remembered in `hollow-roots-tips-v1`): on the first start, the first time Breath runs out, the first fight, and the first time health drops to half with flasks left.
- Tested in the browser: datalist, PR detection, title unlock and wear, delete, XP unchanged at 0; NPC tutorials; story, saves, combat smoke and dressing room regressions pass. No test data was written to the live database.
- Live data as of this update: five cloud saves (the friends' two unnamed saves from 04:48 and 04:54 UTC plus three newer ones, one named Speckz) and one board row (Speckz). All left untouched.

## Latest shared state — 2026-10-01 (leaderboard back, with 🧢 caps)

- **Everything ships to the one link people have: https://manandi.github.io/god/** (Pages builds every push to this branch). Don't change the URL or the `HROOTS` lobby during the 90-day challenge.
- **Leaderboard is back** (owner's request; `src/leaderboard.js`; LEADERBOARD in the menu).
  - It shows name, class, level, XP and the six game stats only. **Weight, height and raw test numbers are never sent**: the `hunters` table has no columns for them, and `submit_hunter` keeps only the six stat keys, clamped to 1–30.
  - Cloud saves (which do hold measurements) can't be read through the API.
  - The game submits when the menu or the board opens (at most once a minute). HIDE ME removes your row.
- **Caps 🧢** (table `stat_caps`, `toggle_stat_cap`):
  - Next to every stat of every other player is a 🧢 button. Pressing it marks that stat as doubtful; pressing it again lifts your cap once they've shown proof in person or on video.
  - On the board a capped stat is struck through, with a 🧢 count, and hovering shows who capped it.
  - In play, a capped stat counts as **at most 10** (`stats()` in `profile.js`; `claimedStats()` is the uncapped value the board shows). The player's own stats screen shows "🧢 CAPPED · CAPPED BY NAME · SHOW THEM PROOF".
  - Caps on you are fetched at load and every 3 minutes, and cached (`hollow-roots-caps-v1`).
  - **Rules enforced by the database:**
    - you must be on the board to cap
    - you can't cap yourself or write caps directly
    - only the player who placed a cap can lift it
    - caps survive hiding from the board (no foreign keys), so hiding can't shake them off
  - Probed from outside: an outsider's cap is refused ("join the board first"); secret hashes can't be read; direct inserts and deletes are refused.
  - Two-player browser test against live Supabase: Bravo capped Alpha's strength, Alpha's stats screen showed ~~18~~ 10 "capped by Bravo"; after Bravo lifted it, back to 18. All test rows were deleted afterwards.
- **Two real saves exist** (unnamed, still in the intro, 2026-10-01 04:48 and 04:54 UTC), probably friends opening the link. Left untouched.

## Latest shared state — 2026-10-01 (one permanent lobby)

- **The lobby is permanent: `HROOTS`** (`weeklyLobbyCode` in `src/weeklyWorld.js`). The owner asked to keep one link for the 90-day challenge (Oct 1 – Dec 31). Everyone who opens https://manandi.github.io/god/ joins the same lobby every time.
  - It used to change every Monday (`HR` + MMDD), which split players in different time zones for a few hours around Monday midnight.
  - The weekly boss window and boss result, and the cloud saves, still go by week (`weekKey`), independent of the lobby name.
  - A `?lobby=CODE` link still makes a separate private room, so share only the plain link.

## Latest shared state — 2026-10-01 (adaptive mind check)

- **The mind check is now an adaptive test** (`src/reasoning.js`, the quiz screens in `src/shell.js`). The old one was 8 fixed easy questions; 8 of 8 gave IQ 135 (INT 20), and 6 of 8 gave about INT 15.
  - **Question bank:** 55 items, from easy (b = −2.2) to very hard (b = 3.2): number and letter series, 3×3 matrices, analogies, vocabulary, deduction, quantitative and spatial reasoning, and a little knowledge. Every computable answer was checked in code.
  - **Adaptive:** 12 items per test, each picked near the current ability estimate, with shuffled options. A retake avoids the last test's items, and the test can be retaken every 30 days.
  - **Timed:** 75 seconds per item; running out counts as wrong.
  - **Scoring:** a 3-parameter IRT model (a = 1, b per item, guessing c = 1/options), EAP over a N(0, 2.0) prior, IQ = 100 + 15θ (range 55–160). The result screen shows the estimate with its standard error.
  - **Simulated** with 400 test-takers per level: true 70/100/130/145 scored about 76/99/124/137. A perfect run scores about 146–151, and random clicking about 60. 12 items were chosen over 8 because 8 under-rated strong test-takers more (true 145 scored about 133). Item difficulties are the designer's estimates, not calibrated norms, so it remains a game estimate.
- **Intelligence uses the population scale** like the body tests (`normalPercentile` in `profile.js`): IQ 100 → 10, 115 → 14, 125 → 16, 135 → 18, 146 → 20.
- **Old results** (`reasoningVersion` < 2) are capped at 110 (INT 13) and the new check opens straight away. New fields: `reasoningVersion`, `reasoningSeen`.
- Tested in a browser: an old 135 shows INT 13; random answers scored 61 (INT 1); a perfect run scored 146 ± 10 (INT 20); the matrix grid and the clock render correctly. Story, saves and smoke tests pass.

## Latest shared state — 2026-10-01 (link device, leaderboard removed, fresh lobby)

- **Link this device** (`src/identity.js`; LINK DEVICE in the menu, and PLAYED BEFORE? LINK DEVICE on the first intro line for a brand-new device).
  - **GET A CODE** uploads the save, then shows an 8-character code (`ABCD 2345`). It lasts 10 minutes and works once.
  - On the other device, entering the code makes that browser the same hunter (`hollow-roots-hunter-v1`), clears its local saves, and reloads into the linked explorer's cloud save.
  - **Database** (`create_device_link`/`claim_device_link`, table `device_links`, migration `remove_leaderboard_add_device_links`):
    - The table isn't readable through the API.
    - A code can only be made for a hunter whose secret matches.
    - Claiming deletes the code, and lower case and spaces are accepted.
  - **Safety:** after linking, `hollow-roots-link-pending` stops the new device from uploading anything until the linked save has loaded, so a failed load can't overwrite real progress with a blank one.
  - Link, save and load calls retry twice on a dropped connection (`rpc` in `src/supabase.js`).
  - Tested 3 of 3 with separate browsers against live Supabase: the explorer, name and story stage moved across, and the new device opened at the menu. Wrong and reused codes were refused. The test saves were deleted.
- **Leaderboard removed** (owner's request): the menu entry, `leaderboard.js`, its styles, and the `hunters` table with its two functions. The browser identity key keeps its old name so existing players keep their cloud saves. The keep-alive workflow now reads `weekly_worlds`.
- **Fresh lobby.**
  - The weekly lobby code is now `HR` plus the week's Monday as MMDD (`HR0928` this week); it was `ROOTdd`, which also repeated every month.
  - The online data is empty: no saves, no boss results, no link codes.
  - Players' local progress in their own browsers is untouched; use dev mode → NEW GAME to start a browser over.
- The 2D game's empty `explorers`/`friendships` tables are still in the database.

## Latest shared state — 2026-10-01 (review of the weekly world; live preview; cute Mycel; Supabase live)

Claude reviewed and finished the other device's "weekly world and Blender character pass" (commits `c2ab760`–`8ded6eb`):
- **The weekly-world SQL is now applied** to `hollow-roots` (migration `weekly_world`), with three fixes, also in `supabase/schema.sql`:
  - `defeat_weekly_boss` only accepts the current week. Before, anyone could pre-mark a future week's Orrun as defeated.
  - `load_weekly_hunter` returns the hunter's most recent save from any week, so progress carries over when a new week starts.
  - Saves are capped at 200 KB.
- **Cloud restore is now newer-wins** (`savedAt` in the world save). Before, a save that failed to upload (offline, or the project paused) could be overwritten on the next login by an older cloud copy.
- Probed from outside: a save from one week loads in the next, a wrong secret loads nothing, the table can't be read directly, and the boss can't be marked defeated on a weekday. The probe row was deleted.
- **Live 3D preview on the character screen** (`src/dressingRoom.js`). The old CSS drawing could not show the Blender hair and outfits. The preview is the real avatar (with the `customization.glb` pieces), turning slowly, draggable, and updated with every choice.
- **Mycel rebuilt as cute and squishy** (`tools/blender/build_mycel.py` → `public/characters/mycel/mycel.glb`, 130 KB, 6,400 triangles).
  - A soft dumpling body with tiny feet, a puffy mint cap with pastel spots and a sprout, big glossy eyes with sparkles, rosy cheeks, a tiny mouth and stubby nub arms.
  - It replaces the tall mushroom with dangling root tendrils. Part names are unchanged, so `narrator.js` still animates him; he is shown a little larger (base scale .96).
- **Dev unlock fix.** `dev.bossUnlocked` now also lets Orrun wake when you walk up to him (`canWake`), not only through the WAKE button.
- **Keep-alive** (`.github/workflows/keepalive.yml`): reads the leaderboard every 3 days so the free Supabase project doesn't pause again. It pauses after about a week idle, as it did on 2026-09-30. Scheduled runs need this branch to stay the repo's default branch, which it is.
- **Leaderboard leftovers.** Three level-1 "Wayfarer" rows exist. One is from 2026-09-30 15:17 UTC, possibly a Claude test run; two are from 2026-10-01 00:20–00:28 UTC, around the other device's push. They were left in place; delete them in the dashboard if they aren't real players.
- **Testing note.** On weekdays Orrun stays asleep by design (open Sat–Sun UTC, 2+ hunters online). Tests set `window.__verdant.dev.bossUnlocked = true`, or use dev mode → WAKE.
- Tested: story, smoke, saves, heavies, dev key and NEW GAME, the two-tab team boss fight (with the dev unlock), the leaderboard, the weekly page, and the character-screen preview pass.

## Customization update — 2026-09-30

- Character customization was rebuilt so choices change silhouette, not just color. The active block explorer now has five visibly distinct hairstyles (short, curly, swept, tied, braid) and four outfits (ranger, warden, wanderer, sentinel) with bone-mounted geometry in `first-person-verdant/src/avatar.js`.
- Added `first-person-verdant/tools/blender/build_customization.py` as the Blender source/concept generator for those hair and outfit designs. Blender is not installed in the GitHub connector runtime, so the script is committed for Blender generation/export rather than falsely claiming a generated .blend/.glb was verified here.
- Runtime commits: `c2ab760` (distinct hair/outfit meshes), `0ded2e2` (Blender source generator). Preserve the newer combat/onboarding work when iterating on these assets.

## Weekly world and Blender character pass — 2026-09-30

- The customization gap is closed: `tools/blender/build_customization.py` now exports `public/characters/customization/customization.glb`. `src/avatar.js` loads those Blender meshes, mounts outfit pieces to named combat bones, and keeps the procedural pieces only as a loading/error fallback. All five hairstyles and four outfits are valid saved choices. This also fixes the old outfit-parenting bug that could leave pieces detached from animation bones.
- Mycel was rebuilt and exported in Blender as a rounder plush mushroom spirit: wider squishy body and cap, large eyes and pupils, blush, tiny root arms, a brighter palette, and runtime squash-and-stretch. Source remains `tools/blender/build_mycel.py`; the runtime asset remains `public/characters/mycel/mycel.glb`.
- Normal play auto-joins one deterministic lobby for the current Monday-based week. URL lobby codes remain as an explicit private/test override. Other players and team combat are shared, while memories, encounter clears, dialogue, and quest stage are personal.
- Orrun is a weekend community event: sealed Monday–Friday, open Saturday 00:00 UTC through Monday 00:00 UTC, and requires at least two hunters online to wake. F2 dev mode's WAKE WARDEN bypasses both gates for testing. A defeat is shared for that week's world.
- `src/weeklyWorld.js` and the appended `supabase/schema.sql` section add durable personal weekly saves and shared boss completion using the existing browser hunter identity. Local storage remains the offline fallback. **Run the new SQL once in the existing Supabase project's SQL editor before cloud saves/shared boss completion become durable; do not claim the migration is live until it has been applied.**
- Hosting remains GitHub Pages + Supabase. The owner does **not** need to leave a MacBook on: GitHub serves the game and Supabase stores saves/presence. For reliable 24/7 play, use a paid/non-pausing Supabase project; the free project may pause after inactivity.

## Latest shared state — 2026-10-01 (story rewrite, Old Shell and 2D game removed, leaderboard, hidden dev mode)

- **The 2D game is removed** (owner's request). Its root files, the 2D Site config (`.openai/`) and `ASSETS.md` are deleted; they remain in git history.
  - The Pages workflow now builds `first-person-verdant/` to the site root: **https://manandi.github.io/god/**.
  - `/god/verdant/` is a small redirect page that keeps `?lobby=` codes and `#` fragments.
  - `CLAUDE.md` and `AGENTS.md` no longer say to preserve the 2D game.
- **The Old Shell is removed** (the owner: "it keeps the game repetitive"). Orrun is the only boss.
  - Removed: the creature, its chronicle, its boss bar, its co-op sharing and its save flag.
  - The Scorched Hollow stays as a place in the world and in the story.
  - Unused `isBoss`/quake code paths remain in `creatures.js`.
- **Story rewrite (`src/story.js`, `src/chronicles.js`, the intro in `src/shell.js`, `RELEASE_LINES` and the ending in `main.js`/`index.html`).** One thread that pays off the game's premise ("strength you did not earn, you cannot keep"):
  - The Heartseed grows the Reach from honest effort. Orrun hatched in the Rootwell, grew by carrying the Canopy Gate's stones with the Waymakers, and swore at Mosswatch to keep the gate "until the forest forgets me".
  - The Crown of Ashmere wanted that strength without the work. Mosswatch's wardens cut the Heartseed's roots in the Scorched Hollow and drank. Borrowed strength hollowed them out, and its rot is the Hollowing.
  - As the forest forgets Orrun, it roots into the gate to hold on, and spreads the rot. Only earned strength (you, one of the Built) and its true name (Orrun, "the one who carries") can release it. The Heartseed takes root in the gate at the end.
  - Every NPC's lines, for every stage, build toward this. Nobody reveals the theft before Ysolde does at Mosswatch; afterwards Orin's wardens take off the Mosswatch leaf, Tavi explains the dead Hollow, and Halden ties it to the Heartseed.
  - The town NPC "Mycel" is renamed **Halden, Rootkeeper** (id still `mycel`), so he no longer clashes with Mycel, the floating spirit.
  - The three chronicles (Sela, Orin, Halden) follow the three memories. The intro gained two beats that set up the theft and the finale.
- **Hidden dev mode.** The DEV button and the on-screen hint are gone. F2 asks for a password (simplified from Ctrl+Shift+` at the owner's request) (`DEV_PASSWORD` in `src/main.js`), once per tab. This only keeps players out by accident; the password ships in the page code.
  - New **NEW GAME · START OVER** button erases this browser's explorer and story and reloads to the intro.
  - The stat presets now use the adult norms: median, top ~5%, top 0.1%, bottom ~5%.
- **Shared leaderboard (`src/leaderboard.js`, `supabase/schema.sql`, migration `hunters_leaderboard`).**
  - Table `public.hunters`. Anyone can read name, class, level, XP and the six stats; `secret_hash` is not readable.
  - Rows are written only through `submit_hunter`/`remove_hunter`, which check a random secret each browser makes and stores in `hollow-roots-hunter-v1`.
  - The game submits when the menu or the board opens (at most once a minute). **HIDE ME FROM THE BOARD** removes your row.
  - Probed from outside: the wrong secret can't overwrite, direct inserts are denied, the secret hash can't be read, and stats are clamped to 1–30. The browser test posted, showed and hid a row, and left nothing behind.
  - Supabase's advisor warns that the two SECURITY DEFINER functions are callable by anyone; that is intended, since they are the write path and check the secret.
- **Supabase had paused the project** (status INACTIVE, which also stopped co-op). It was restored on 2026-10-01 and is ACTIVE_HEALTHY. Free projects pause after about a week without activity; if co-op or the board says offline, check the dashboard and press Restore.
- The 2D game's old tables `explorers` and `friendships` (0 rows) are still in the database. Delete them only if the owner agrees.
- Tested: story, smoke, saves, boss, team and heavies tests pass. The hidden key test passed (F2 does nothing, a wrong password is refused, the right one opens the panel), and NEW GAME clears both saves and lands on the intro.

## Latest shared state — 2026-10-01 (US units, Supabase check)

- **US units by default (`units` in `src/profile.js`).**
  - New players, and saves that never picked a system, use pounds, inches, miles and mph. The toggle on the measurement form reads METRIC / US · LB, IN, MI, and a choice made there is remembered (`profile.unitsChosen`).
  - US units reach the measurement form, weigh-ins and the body goal, the walk/run tasks (whole miles: 1.25, 2, 2.5, 3), the other-activity log (miles), the stats table (run mph, jump inches) and the in-game quest distance (feet, or miles past 1,000 ft).
- **Supabase (`hollow-roots`, `gitqmiwwakaejznucxqn`) is ready for co-op.**
  - The project is ACTIVE_HEALTHY.
  - Realtime accepted a broadcast to `verdant-reach:PROBE1` with the game's publishable key (HTTP 202, and it shows in the edge logs).
  - This sandbox's proxy blocks websockets, so the upgrade never reached Supabase. A real two-browser test has still not been done.
  - Nothing to deploy on Supabase: the game connects from GitHub Pages.

## Latest shared state — 2026-10-01 (population norms)

- **Stats are scored against real adult norms (`METRICS[].norms`, `SCORE_SCALE`, `percentile` in `src/profile.js`).** The owner asked that a 20 mean the top 0.1% of people and an 18 the top 1%.
  - Each test now maps a result to the share of all adults who do no better, then to a score: 50th percentile = 10, 70th = 12, 85th = 14, 95th = 16, 99th = 18, 99.9th = 20, with the same steps below the middle.
  - Examples for push-ups: 10 reps ≈ 54th percentile, 40 ≈ 93rd, 60 = top 1%, 100 = top 0.1%.
  - The tables, their sources, and the parts that are estimates (the 40-yard dash especially) are in `first-person-verdant/README.md` under "Stat norms".
  - Checks: a median adult scores 10 in every body stat, top 1% in every test scores 18, and top 0.1% scores 20. A regular gym-goer (35 push-ups, 8 pull-ups, 80 kg bench) scores 16 in strength.
  - The measurement form shows a live "BETTER THAN X% OF ADULTS" (or "TOP X%") under each result. New players' default values are now the adult medians.
- **Discipline starts at 10 and only rises**: 10 + active days in the last 4 weeks × 10/24, so 24 active days reaches 20. Before this change, logging one activity dropped it to about 3.
- Tested: smoke, saves, weekly-page and heavies tests pass; the form's percentile hints update while typing.

## Latest shared state — 2026-10-01 (training and progression)

- **Monthly tests (`testStatus`, `recordTest`, `growth` in `src/profile.js`).**
  - Measurements are now a monthly test. After the first one they lock for 30 days; a mistake can be fixed for 2 days after a test.
  - Every body stat that rose since the last test earns a **Growth** bonus until the next test: half the gain, rounded up, capped at +4.
  - After a test, a results screen shows each stat before and after, the Growth earned, and any abilities gained or lost.
  - Saves from before this count as having tested 30 days ago, so the first monthly test is open now.
- **Abilities (`ABILITIES` in `src/mechanics.js`).** Each stat unlocks one ability at 12 and a stronger one at 16:
  - Strength: Crushing Blows (poise damage +25%), Titan's Strike (charged heavies +20%).
  - Speed: Fleet Foot (+6% run), Afterimage (+40 ms dodge invulnerability).
  - Stamina: Deep Lungs (+20% Breath recovery), Tireless (−12% Breath costs).
  - Defense: Barkskin (+1 vitality), Rooted Guard (−25% guard cost).
  - Intelligence: Read the Tell (+60 ms parry window), Sap Alchemy (flasks heal 1 more).
  - Discipline: Steady Hands (+1 Sap Flask), Unbroken Will (a second wind once per rest).
  - The stats screen shows all twelve and what each locked one still needs.
- **Level keeps pace with enemies (`levelDamage`, `levelVitality`).** Level still comes only from logged workouts. Each level adds 15% strike damage, matching the 15% health per level that shellbacks and thornlings already gain, and every fourth level adds a vitality heart (up to +2). Level 1 is unchanged.
- **Weekly quest is a clickable plan (`src/training.js`, `weeklyPlan` in `src/profile.js`).**
  - Week 1 (beginner): reach 5,000 steps on 2 days, do the beginner home workout twice, and learn for 20 minutes twice. Each task is a row of check boxes, one per day.
  - The plan steps up each week you finish at least half of it, and repeats the week if you don't: beginner (weeks 1–2), foundation, builder, advanced (week 7 on). Finishing a whole week gives +300 XP.
  - Clicking a workout opens it: a 5-minute warm-up, a no-equipment full-body circuit of 30–40 minutes, and a cool-down. The easier version of every exercise sits in a column on the right. **✓ DONE · LOG THIS WORKOUT** logs it.
  - Each task can be checked once a day, and today's check can be undone. The free-form log is still there as OTHER ACTIVITY.
- **Body goal rewards (`setGoal`, `logWeighIn`, `goalBoon`).**
  - Choose lose, gain, or maintain/recomp, and weigh in once a week. A weigh-in moving toward the goal at a healthy pace earns a mark (+80 XP):
    - lose: 0.1–1% of body weight a week
    - gain: 0.05–0.5% a week
    - maintain: within 1% while training at least twice that week
  - Faster changes earn nothing, and the message says to slow down.
  - Every 2 marks from the last 12 weeks give +1 to your class's own stat (Fighter STR, Tank DEF, Ranger SPD, Mage INT, Support DIS), up to +5.
  - Reaching the target gives 2 more marks and +300 XP, then switches the goal to maintain.
- **Tested** in a browser: checking, the once-a-day rule, undo, opening and logging a workout, setting a goal and a weigh-in (−0.6 kg of 82 kg earned a mark), the monthly test (it unlocked 3 abilities, with Growth +2 STR and +2 DEF), and the in-game numbers. Smoke, heavies, saves and story tests pass.

## Latest shared state — 2026-10-01 (team fights)

- **Team fights (`src/coop.js`, the team-fights block in `src/main.js`).** Players in one lobby now fight the same Orrun, Old Shell and shellbacks together.
  - **The host runs the fight.** The lobby member with the smallest id is the host; every game works this out the same way, so no one has to choose. The status reads `CODE · 2 HUNTERS · HOST` or `· GUEST`.
  - The host's game runs every creature and boss. Ten times a second it sends each one's position, state, attack, timing and health (`world`); sleeping ones are sent once a second.
  - Guests show those snapshots and send every hit they land to the host (`hit`, and `deflect` for parries). The host's game applies the damage, so everyone sees the same health bar.
  - Each game still judges the blows that land on its own explorer: guard, parry, dodge and damage feel the same as solo.
  - Enemies go after the nearest explorer. Bosses get +50% health per extra player (Orrun 1000 → 1500 for two).
  - **Bigger nests for bigger parties.** Each story nest rises with two more hollowed (shellbacks or thornlings, like the nest's own) for every extra player: 3 → 5 at the Rootwell for two. Someone joining mid-fight raises two more. Solo nests are unchanged. The extras are made the same way in every game (`extraHollowed` in `src/creatures.js`, ids `x:<chapter>:<k>`).
  - The small hollowed spread out: at most two go after each player while another player nearby has room, and each keeps its player while it can (`assignTargets` in `src/main.js`). Each player has their own attack tokens, so two players can both be attacked at once.
  - A guest who reaches a nest first asks the host to raise it (`spawn`), so the nest rises for everyone at once.
  - Tested between tabs: a solo nest rose with 3; a two-player nest rose with 5 when the guest arrived, split 2 and 3 between the players, and clearing it on the host moved both players on to the memory.
  - A defeat shows for everyone. When the host leaves, the next member should take over from the last snapshot (built that way, not yet tested).
  - Friends' block figures lunge when they attack (`act`).
- **Tested** with `?lobby=CODE&net=local`, which runs the same protocol between tabs of one browser (BroadcastChannel). The sandbox blocks websockets, so the Supabase path is still untested with real players.
  - One tab became host and one guest. Orrun woke, went for the nearer player and chained pounce, bite and tail slam, and the guest saw the same states at the same spot.
  - Three 30-damage head hits sent by the guest took the host's Orrun from 1500 to 1365, and the guest saw the same number. A defeat on the host showed on the guest.
  - Solo play is unchanged: smoke, boss, story, chronicles, heavies and saves tests pass.

## Latest shared state — 2026-10-01 (later)

- **Orrun's reach (`ATTACKS` and `damageVolumes` in `src/boss.js`).** The owner felt the boss's attacks reached too far, and that the pounce should not make a wave when the tail already does.
  - Only two attacks make ground waves now:
    - the stomp: the jumpable ring, 2.2→7 m, was 10.5
    - the tail hammer: a small crack at the club, 1.9→3.6 m, was 2→4.8
  - The pounce has no wave. Its landing hit now sits under the head and plastron (body + 3.4 m ahead, r 2.3), because the head pushes a standing player about 5.5 m from the centre. The old centre hit (r 3.3) could never reach, so the pounce had only ever hit through its wave. Forced test: it lands 3/4 from 10 m and 2/4 from 14 m.
  - Tail and club hit zones are tighter (tail r 0.85–1.1, club 1.05, hammer club 1.3), and the ground tells match.
- **Co-op:**
  - The Supabase project `hollow-roots` (`gitqmiwwakaejznucxqn`) is ACTIVE_HEALTHY.
  - Its logs show no realtime connections yet, so co-op has not been tried by two players.
  - It needs no ChatGPT hosting.

## Latest shared state — 2026-10-01

The owner reported that holding R still put weapons in the ground, a leg floated up by the head after a few seconds, and turtles got stuck on trees. Each was reproduced in a headless test before it was fixed.

- **Floating leg (`update` in `src/avatar.js`):**
  - Cause: foot placement bends the leg bones after each animation frame. Clips that do not key the legs (idle) kept each frame's correction and stacked them, until a leg twisted up past the head (a foot 0.84 m above the hips).
  - The bug was already in `c1a998a`, the first build with the ChatGPT character code; recent changes did not introduce it.
  - Fix: the previous frame's correction is undone before the animation plays.
  - Test: every weapon at 5 spots, idling, running and holding R. The highest foot is now 0.17 m below the hips (during the Earthsplitter hop).
- **Weapon in the ground when holding R (`holdWeapon` in `src/weapons.js`):**
  - Cause: the ground check only watched two points on the haft. The Stonebreaker's head is 0.5 m wide, so its corners dipped up to 13 cm into slopes.
  - Fix: it now checks the eight corners of each weapon's bounding box.
  - Test: every vertex of both weapons at 8 sloped spots, idle, run, hold R, release, tap and light chain. The lowest point is now 5–7 cm above the ground or higher.
- **Turtles stuck on trees (`steer`/`travel` in `src/creatures.js`):**
  - Cause: steering looked at one point 1.4 m ahead (a trunk closer than that was missed) and re-picked a side every frame. Before the fix, 0 of 12 turtles placed behind a tree reached the player.
  - Fix: the path is checked at 0.4, 0.8 and 1.3 m. A turtle keeps to one side of an obstacle until the way straight on is clear, following its edge out of pockets. It switches sides if blocked for 0.5 s, and a creature overlapping an obstacle can walk out.
  - Test: 12/12, then 30/30 other trees from varied angles.
- **Tested headless, no page errors:** the combat smoke test, the story, the boss, the Chronicles and Old Shell, weapons, heavies and save launches.
- **Testing note:** these faults showed up only over time (idle for seconds), on slopes, or at the edges of a mesh. Future checks should cover those, not just the base and tip or one flat spot.

## Latest shared state — 2026-09-30 (later)

The owner reported the character falling through the floor and weapons going into the ground. They asked for bench press to count as raw strength again, discipline to stay auto-calculated, and a unique heavy attack per weapon.

- **Falling through the floor (`groundY` in `src/world.js`):**
  - Cause: the terrain is drawn as flat triangles on a 2.5 m grid, but everything stood on the exact height curve. The two disagreed by up to 0.4–0.6 m (worst on the slopes into the town, the homestead and the levelled sites), so feet sank below the visible ground or floated.
  - Fix: `groundY` now reads the drawn triangles (`surfaceY` is the exact curve the grid samples). A probe over every area now measures 0.00 m difference.
  - The shoulder camera also never goes below the ground (`ground` option in `src/camera.js`).
- **Weapons in the ground (`src/weapons.js`):**
  - Each weapon has a carry grip for standing and running (Groveblade raised forward, Stonebreaker upright) and a strike grip for attacking, charging and guarding, blended quickly.
  - `holdWeapon` tilts a weapon up if it would still touch the ground.
  - The hammer's overhead slam (hammer2) now stops the hands at knee height.
  - Measured lowest point: Groveblade 0.06–0.9 m above ground in every state; Stonebreaker 1.0–1.4 m when carried, and touching the ground only at the moment of a slam.
  - Bug fixed: the Stonebreaker's markers were renamed on export (`WeaponBase001`), so its hitbox had silently fallen back to the forearm line. `mountWeapon` now finds them by prefix.
- **Unique heavies (`src/combat/moves.js`, `src/anim/clips.js`), R to use, hold R to charge:**
  - **Rootbound:** Taproot Heel, then the Rootbreaker.
  - **Groveblade:** Crescent Sweep (a wide wound-up cut), then the Verdant Spiral (a full spinning cut that hits all around; tested hitting enemies ahead, beside and behind).
  - **Stonebreaker:** Earthsplitter (a hop into a slam whose shockwave hits everything near the impact), then the Faultline (a bigger, harder quake). The shockwave is a `slam` event from `player.js`, handled in `main.js`.
  - The old overhead split stays as the Groveblade's leaping and falling heavies.
- **Stats:**
  - Bench press counts as raw weight again (anchors 10–130 kg), so the strongest are rewarded.
  - Discipline stays auto-calculated from logged training, and is now shown as its own tile on the measure page.

## Latest shared state — 2026-09-30

The owner asked for better weapons, a new Mycel who floats while he talks, a story intro, a new measurement and question flow, rewards for every body type, and a class recommendation shaped by personality.

- **Weapons (`tools/blender/build_weapons.py`, `src/weapons.js`):**
  - **Groveblade:** a leaf-shaped heartwood blade with a glowing sap vein and a root crossguard.
  - **Stonebreaker:** a hewn stone maul bound in bronze, with glowing runes.
  - Both have their grip in the fist, in first and third person. The Groveblade is held forward; the Stonebreaker rests at the shoulder.
  - The strike hitbox now follows markers on the model, so the blade you see is what hits. Groveblade chain 35 damage (as before); its Rootbreaker now lands 84, up from 52.
- **Mycel (`tools/blender/build_mycel.py`, `src/narrator.js`):**
  - A new 3D floating mushroom spirit in a dusky glade. He drifts to a new spot above the story box on each line, bobs and blinks, and moves his mouth while text types.
  - Each line sets a mood (brows, eyes, arm gestures). The Heartseed orbits him.
  - The owner wrote "Mystrel"; the narrator is Mycel, and the name was kept.
- **Intro:** eleven story beats, starting "Welcome to the world of Built." / "This is no normal world. In this world, what you do out there carries over." Chips show which real effort feeds which stat, and what each frame gives. Space or NEXT advances.
- **Onboarding (4 steps):**
  - **Measure:** weight, height, max push-ups, pull-ups, vertical, 40-yard dash, mile (min:sec) and bench, with a metric/imperial toggle. Resting heart rate, plank and sleep are no longer asked.
  - **Mind check:** 8 questions, 5 reasoning and 3 knowledge.
  - **How you play:** 2 questions (your usual role in games; what you do when a fight goes badly).
  - **Reveal:** recommended class with the reason, frame card and stats, then the character creator.
- **Stats:**
  - Strength comes from push-ups, pull-ups and bench (judged against body weight).
  - Speed from dash and vertical; stamina from mile.
  - Defense from bench, push-ups and mile; intelligence from the check.
  - Personality adds 5 (role) and 3 (instinct) to a class's score.
- **Frames (`FRAMES`, `frame()`):**
  - **Stoneframe** (heavier): +1 vitality and steadfast (heavy blows stagger instead of knocking down), plus cheaper guarding.
  - **Swiftframe** (light, or tall and lean): faster, with a longer dash.
  - **Trueframe** (balanced): +15% Breath recovery and Second Wind (once per rest, survive a lethal blow on 1 heart).
  - Weight and height never appear as numbers in the game.
- **Saves:** returning players keep going to the menu. The stats screen has HOW YOU PLAY and MIND CHECK. Old profiles load; missing weight and height default to 75 kg and 175 cm (Trueframe).
- **Tested headless, no page errors:**
  - a full new-player walkthrough (intro to measure, check, questions, reveal and customize) and the unit toggle round trip
  - each frame's bonuses, and Second Wind against real turtle hits
  - weapons in first and third person
  - the story, combat smoke test, Chronicles and Old Shell, boss, and save launches
- **Not verified:** feel in a real browser.

## Latest shared state — 2026-09-29 (late)

The owner reported that the little turtles still took too many hits, and that swings kept missing them.

- **Swings missing (`src/combat/hits.js`):** it was the height difference. The punch travels at 1.1–1.4 m, just above a shellback's shell and head, so it missed by 2–6 cm even point-blank (0 of 12 in a probe). Small creatures' hurt volumes are now short upright capsules (`up` in `hurtVolumes` in `src/creatures.js`), and the same probe lands 12 of 12. Bosses are unchanged.
- **Little turtles:** health 45 (shellback) and 32 (thornling) at level 1, about 4–6 hits. Each explorer level still adds 15%.
- **Two moves only:** shellbacks and thornlings now only lunge and spin. The rearing slam and its shockwave belong to the Old Shell alone.
- **Tested headless, no page errors:** the combat smoke test, weapons, the full story, the Chronicles and the Old Shell, and the boss.

## Latest shared state — 2026-09-29 (evening)

The owner asked for a more distinctive boss moveset (it charged too often and had no tail attacks), easier level 1 mobs, and Blender work on the memory areas and the town.

- **Orrun's moveset (`src/boss.js`, `tools/blender/build_warden.py`):**
  - New Blender clips, each with its own hit windows:
    - **Tail spin:** a full turn with the tail held out flat.
    - **Tail hammer:** it turns its back and slams the tail club down; the ground cracks where it lands.
    - **Pounce:** a leap that lands shell-first with a shockwave.
  - The model now has a long tail with a thorn ridge and a root club.
  - **The club breaks, Monster Hunter style,** after 150 damage to it. Tail attacks then become shorter and lighter, and the hammer no longer makes a shockwave.
  - **Follow-ups:** some attacks chain straight into another. Bite goes into tail spin, stomp into bite, tail hammer into pounce, and pounce into bite; they chain more often in phase 2.
  - **Charge:** now only beyond 12 m, and at most once every 12 s. The pounce closes most gaps instead.
  - In a 160 s test, all seven attacks appeared and the charge fired once.
- **Mob balance (`src/creatures.js`):**
  - At level 1, the shellback's health drops from 160 to 72 and the thornling's from 110 to 50. The shell now takes 80% damage instead of 70%.
  - A shellback falls to about three light strings.
  - Each explorer level adds 15% health; bosses are not scaled.
- **Memory sites (`tools/blender/build_sites.py`):** the Rootwell, Mosswatch Ruins and the Canopy Shrine are Blender set pieces now, replacing the primitive shapes.
  - Each opens toward its road.
  - The ground under each one is levelled, via `LEVELLED` in `src/world.js`.
  - The Rootwell's pool now sits at ground level, so you wade in instead of standing inside rock.
  - See `first-person-verdant/public/sites/README.md`.
- **Mossgate props (`tools/blender/build_mossgate.py`):** a well, market counters with produce, a cart, lantern posts, a signpost, benches, planters, barrels, crates, sacks, firewood, a window box on three walls and a chimney on every house, and bunting at the gate and across the square.
  - They are additions only: the ChatGPT houses, square, stalls, palisade and NPC positions are unchanged, and no prop blocks an NPC.
- **Tested headless, no page errors:**
  - the full story and old-save migration
  - the combat smoke test and the boss logic
  - the boss moveset and the club break
  - the Chronicles and the Old Shell
  - weapons and double jump
  - save launches
  - in-game screenshots of all three sites and the town
  - no mob spawns inside a new collider
- **Not verified:** how the new attacks feel in a real browser.

## Latest shared state — 2026-09-29 (morning)

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
