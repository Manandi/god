Warning: truncated output (original token count: 28416)
Total output lines: 1069

# The Hollow Roots — project handoff

This is the shared status file for work on the game from different devices or AI assistants. **Read it before changing the game and update it after each meaningful change.** The GitHub branch is the shared source of truth; a local checkout can be behind even when another device has pushed newer work.

## Latest handoff — 2026-10-07 · Daily Weekly Quest ping reminder (Codex)

- WEEKLY QUEST has one global daily reminder at 7 PM in each opted-in player's timezone; players can turn it on or off, but do not choose a time.
- Supabase Cron invokes `weekly-ping` every 15 minutes. The Edge Function sends Web Push while that player's current challenge week is unfinished, even when the game is closed. A service worker displays the ping and opens the game when clicked.
- Permission and subscription are per browser, as required by Web Push. The per-user schedule setting is not used.
- **Backend activation is still required:** apply `supabase/migrations/202610070001_weekly_push.sql`, deploy `supabase/functions/weekly-ping`, set its VAPID and cron secrets, and run `supabase/weekly-ping-schedule.sql`. Until then, the game reports that push is not configured. See [global push setup](supabase/weekly-ping-setup.md).
- Save cleanup is still pending. The seven identified Supabase rows already have a private backup, but the live delete requires authenticated database access. The three `Wayfarer` rows may belong to friends because `Wayfarer` is the default name; confirm which records to remove before deleting them.
- Checks: Vite production build, JavaScript syntax checks, and Edge Function TypeScript transpile; live delivery requires Supabase setup.

## Latest handoff — 2026-10-07 (late) · Garrow sealed behind a quest line; phase 2 transforms it (Claude)

The owner asked for three things: Garrow should change appearance in phase 2, it should have new moves there, and it should be locked behind a quest line like world 1.

**Quest line (Book II):** shadow_cross → shadow_meet → shadow_hunt (3 monkeys) → shadow_memory (the falls) → **shadow_seal (new)** → shadow_guardian (the boss) → shadow_report → frost_wait.
- `shadow_seal` sits between two existing stages. Saves store stage ids and the order of the old stages is unchanged, so saves are unaffected.
- **The seal** (`GARROW_SEAL` in `world.js`, `garrowSeal()` in `shadowmere.js`):
  - A ring of crown-glass spires and a shimmering wall, 6.5 m round Garrow. Its colliders close the ring.
  - The walkway between the ring and the trees stays open, so the falls can still be reached.
  - Garrow kneels inside, bound (`bind()`, a creature that can't be hit or targeted).
- **Three dark lanterns** (east, west, south, 10.6 m out):
  - Two **lantern thieves** (monkeys `seal-thief-i-j`, asleep until then) drop from the canopy when you come within 10 m.
  - Each lantern can be relit (E) once its thieves are gone; each one lit cracks a third of the spires.
  - Progress is saved in `story.tally` (`lanterns`, `lit0`…`lit2`).
- **All three lit:** the seal shatters (the colliders drop) and Garrow rises about 1.6 s later as the boss. `updateGarrowQuest()` in `main.js` keeps Garrow and the seal in step with the story.
- **During the fight:**
  - It's one-on-one: roaming monkeys within 26 m scatter to the canopy and come back afterwards.
  - If you fall, Garrow resets to full health and phase 1.
- **After it's freed:** it kneels at rest in the clearing (`calm()`), its blade gone.
- **Dev:** GARROW IN FRONT and GARROW PHASE 2 set `devAwake`, so the story doesn't rebind it.
- Maren has new idle lines, and the journal has a new page, THE SEAL.

**Phase 2 transformation** (`crownGlow()` / `buildGrowth()` in `creatures.js`, grows in during the roar):
- 20 crown-glass crystals burst out of its back, shoulders and head and climb the sword arm (fitted to the Blender model's bounds).
- The fur goes dark, the eyes and blade burn violet, a violet light surrounds it, and it grows 10% taller. The boss bar turns violet.
- Everything resets when Garrow respawns.

**Phase 2 moveset:**
- Backhand, boulder and roar are phase-1 only (`phase1: true`).
- Chop, charge and pound stay in both phases.
- Phase 2 adds six moves:
  - combo, leaping cleave, eruption,
  - **shard barrage**: three crystals off its back thrown in a fan; dash or guard,
  - **crown-glass whirl**: two spinning turns while it walks you down; back away,
  - **crushing grab**: unblockable lunge; caught, you're lifted and slammed for 2. A miss leaves a long opening.

**Checks** (Playwright, Supabase aborted):
- The quest test runs falls → seal (Garrow bound, ring blocks, walkway open) → thieves ambush at every lantern → can't light while they live → 3 lanterns → seal breaks → Garrow wakes as the boss with the bar → phase 2 (20/20 crystals, scale 1.34, glow) → phase-2 moves land and only the phase-2 set is chosen → freed → calm, blade hidden.
- The fight test passes for every move in both phases and the monkey swing.
- The dev panel test passes, and there are no page errors.

## Earlier handoff — 2026-10-07 (night) · Monkeys' own attack, Garrow as a two-phase boss (Claude)

The owner asked for two things: the monkeys should drop the turtle dash for an attack of their own, and Garrow (the gorilla) should be a boss quest again, with a massive moveset and a phase 2. All of it is in `creatures.js` (ATTACKS, `runGorilla`, `gorillaPose`, `crownGlow`) and `main.js` (cues, effects, crystal hazards, boulder, boss bar).

**Green monkeys:** no more `lunge`.
- The new move is the **vine swing** (`swing`).
  - The monkey grabs a vine from the canopy and swings round you.
  - It kicks you from the side mid-swing and lands behind you; about half the time it chains straight into the claw flurry.
  - Counter: turn and guard (lock-on helps), dash, or step away from where you stood.
- `planSwing` only commits when there is clear ground to land on.
- The monkeys keep their flurry, pounce and seed throw.

**Garrow, the Rootbound:** a boss with only gorilla moves.
- Health is 360 base, scaled +15% per level (about 470 at level 3). Poise is higher than before.
- The boss bar shows while it fights you (violet in phase 2).
- The first time it notices you there is an intro camera shot and a "BOSS · GARROW" toast.
- **Phase 1:**
  - Cleaver chop: a line strip on the ground; step out of it.
  - Backhand sweep: back off or guard.
  - Knuckle charge: about 13 m. A tree in its path stops it dead, and it stays **dazed** for 1.8 s, open to a Root Strike.
  - Double ground pound: two shockwaves; jump or dash through each.
  - Boulder hurl: a ring marks where it lands; guard facing Garrow, dash, or move off the ring.
  - Chest-drum roar: no damage, but it knocks you off balance and Garrow follows up at once. Dash through it.
- **Phase 2** starts at half health.
  - Garrow stops, drums its chest and roars (takes no damage during the change), and a blast knocks back anyone within 5.5 m.
  - The crown-glass blade turns violet and its attacks get faster.
  - New moves:
    - **Crown-glass combo**: chop, backhand, rising cut.
    - **Leaping cleave**: lands on you, then a line of crystal spikes bursts out ahead.
    - **Crown-glass eruption**: three marks appear where you stand, each bursting 0.7 s later.
- The quest objective now reads "Boss fight: free Garrow…". The stage ids are unchanged, so saves are unaffected.
- The dev panel's FIGHT tab has a new **GARROW PHASE 2** button.

**Checks** (Supabase aborted, Playwright):
- Every Garrow move and the vine swing land on a player standing still in range.
- Phase 2 triggers at half health; Garrow is immune during the change and the blade glows.
- Phase-2 moves are only chosen in phase 2, and monkeys never pick `lunge`.
- The Book II story test runs from `end` to `frost_wait`, with Garrow beaten.
- The dev panel test passes, and there are no page errors.

## Earlier handoff — 2026-10-07 (evening) · Workout logs count, week 1 is one workout (Claude)

**Bug:** a workout logged under **OTHER ACTIVITY → Workout day** gave XP but never ticked the plan's workout. Only the button on the workout page did, so the owner's 10-06 workout didn't show on the plan.
- Now any log counts toward the plan item of its kind, whichever form it came from. `counts()` in `profile.js` accepts a plan check, or a free log at least as big as one check.
- One check per day per item still applies.
- Undo also works on a free log made today.

**Week 1 is one home workout** (owner). The other items are unchanged: 2 step days and 1 learning session.
- Plan step 1 now has `bonus: 350` (`training.js`; `stepBonus()` in `profile.js`). With one workout, a full week is 2×50 + 75 + 10 + 350 = 535 XP, which still reaches level 3 (500) for the first boss. The old full week was 560.
- Every other week keeps `PLAN_BONUS` 300.

**Weekly bonus timing:** a week completed by any route now pays its bonus as soon as `weeklyPlan()` sees it complete, or at the Thursday rollover if it was never opened. Previously the bonus was only paid from `logActivity`.

The owner's live save (steps 10-02 and 10-04, learning 10-04, workout 10-06) becomes 4/4, +350, 535 XP, level 3. Tested with the clock faked and Supabase aborted.

**Removal still to do.** The owner asked to remove "Wayfarer and the unsaved files".
- Wayfarer is 2 `hunters` rows (`ec0f7578…`, `383c8a62…`) plus 1 save; the 4 unnamed `weekly_hunters` saves (`dd7faadf…`, `b2ee7063…`, `a58a8f17…`, `2f102c06…`) are the likely "unsaved files".
- A copy of all 7 rows is in `public.removed_saves_backup`: RLS on, no access for anon or authenticated.
- The delete itself didn't run: the tool timed out waiting for approval, and the auto-mode check blocked it until the owner confirms the exact rows.
- Note: **"Wayfarer" is the default name for anyone who leaves the name box empty** (`shell.js`), so it may be a friend.

## Earlier handoff — 2026-10-07 (later) · Challenge weeks run Thursday to Wednesday (Claude)

The owner asked why the weekly quest said week 2 and why their logs had gone on Wednesday 2026-10-07. The cause was that plan weeks started on Monday. On Monday 2026-10-05 everyone moved to plan week 2, and the weekly page stopped showing the checks from 10-02 and 10-04.

**Nothing was lost.** A read-only check of the cloud saves showed:
- manandi still has steps on 10-02, steps on 10-04 and a 20-minute learning session on 10-04 (110 XP).
- Speckz, Vincent, Wayfarer and the unnamed saves had not logged anything yet.

What changed in `profile.js`:
- Weeks now start on Thursday:
  - `planWeekKey()` gives the Thursday that starts the current week.
  - `challengeWeek()` counts weeks from launch: week 1 is 10-01 to 10-07, week 2 starts on Thursday 10-08 (the first boss day), and 12-31 is week 14.
- The weekly quest uses these weeks for its checks, its step up (half or more done) and its bonus.
- **Migration in `loadProfile`:**
  - An old Monday key moves to the Thursday week it falls in, never earlier than launch.
  - A plan step taken on a Monday after launch is undone. If half or more of week 1 was done, it comes back on Thursday.
  - Old `YYYY-MM-DD:plan` claims are mapped the same way.
- The weekly page header now reads `CHALLENGE WEEK n · PLAN STEP n · tier · NEW WEEK EVERY THURSDAY`.
- `weekKey()` (Monday) still keys the weekly world and the cloud saves (`weekly_hunters.week_id`, `weekly_worlds`), so those rows and the server RPCs are unchanged. The lobby is still HROOTS.

Checks, with supabase.co aborted and the clock faked:
- manandi's save on 10-07 shows challenge week 1, step 1, 3/5 checked, XP unchanged.
- On 10-08 it is week 2 and steps up to step 2.
- With only 1/5 done, it stays on step 1.
- A pre-launch Monday key is treated as week 1.
- Production build passes.

## Earlier handoff — 2026-10-07 · Weapons from Orrun, the Social tab (Leaderboard + Activity with kudos) (Claude)

**Class weapons are earned by beating Orrun** (owner: "beating the Warden boss at level 3 grants everyone the weapon from their class, till then it's hands only").
- `profile.wardenFelled` is a new saved flag, also restored from the cloud through `loadProfile`.
- `weaponEligibility` in `profile.js` now needs it, as well as level 3 and the class. Before it's set, the inventory and CUSTOMIZE show "LOCKED · DEFEAT ORRUN", and fists are the only weapon.
- **How it's granted:** `grantClassWeapon()` in `main.js` runs when Orrun goes down, for every hunter standing in the hollow at that moment (each player's own game sees the kill). It sets the flag, equips the class weapon, shows a toast, and posts to the Activity feed. Speaking Orrun's name (`finishStory`) grants it too.
- Saves that already finished Book I get the flag on load.
- The dev panel's weapon buttons still ignore the lock.

**The Social tab replaces LEADERBOARD in the menu.** It has two tabs (`renderLeaderboard` and `renderActivity` in `shell.js`).
- **LEADERBOARD:** unchanged.
- **ACTIVITY:** a feed of what everyone logs, with a 🌿 kudos button.
  - The menu shows "SOCIAL · n NEW" and the tab carries a badge.
  - A "NEW KUDOS FOR YOU" strip shows what came in.
  - Buttons: SHARE MY ACTIVITY on/off (off automatically when hidden from the board), TURN ON NOTIFICATIONS, and REFRESH.
- **`src/social.js` (new):**
  - Posts lines announced by `profile.js` `announce()`: steps, home workouts, walks and runs, learning minutes, completing the week's quest, level-ups, lifts (with a "new record" flag) and monthly tests.
  - Posts from `main.js` too: earning the weapon from Orrun, finishing Book I, and freeing Garrow.
  - Body weight, weigh-ins and test numbers are never posted.
  - Checks for new kudos every minute and when the tab regains focus. Each new one shows as an in-game toast, a menu badge, and a browser notification if the player allowed them and the game is in the background.
- **Supabase** (migration `social_activity_kudos`, applied live, copied into `supabase/schema.sql`):
  - Tables `activity_feed` and `activity_kudos`, with row security on and no direct access.
  - RPCs `post_activity`, `list_activity`, `give_kudos` and `my_new_kudos` all check the hunter secret (`hunter_secret_ok`).
  - Limits: 40 posts per day, a 120-character line, 30 days of history, one kudos per person per post, and no kudos on your own post.
- **Tested:**
  - The RPCs were tested in a transaction that rolled back: spoofing, self-kudos, double kudos and a one-time notification all behave correctly. No test rows were left, and the 8 saves are untouched.
  - The UI was tested with every Supabase call mocked, covering posts from real logs, the toast, the badge, kudos and both tabs.
  - The weapon rule was tested on a real Orrun kill from inside the hollow.
  - Regressions pass: weap and inv (both now start with `wardenFelled: true`), smoke3, story, book2, saves, devkey2 and talkmem2.

## The saga plan to the end of the challenge (owner, 2026-10-05) · build every new world to this

"The story or chapters must build on each other till the final boss for the end of the year 3-month challenge; of course we will keep going after that." Levels rise about 2 a week (week n ends near level 1 + 2n, matching the Thursday hunt levels 3, 5, 7…). So each world opens in the week the challenge reaches it, and the finale is **Thursday 31 December**, the challenge's last day (boss level 27). `SAGA` in `src/story.js` is the source of truth; the journal and the atlas read it.

| Book | World (atlas id) | Opens at | Weeks | Keeper to free → light | What it reveals about the final boss |
|---|---|---|---|---|---|
| I | Verdant Reach (`grove`) | start | Oct 1 – 8 | Orrun → the Heartseed | Ashmere bought strength without labour, through Mosswatch |
| II | Shadowmere (`shadow`) | lv 3 | Oct 8 – 14 | Garrow → the Lantern Seed | Ashmere put the lights out to hide; its blade was cut from a crown |
| III | Frostbound Crown (`frost`) | lv 5 | Oct 15 – Nov 4 | the White Maw → the Rime Seed | Ashmere's court froze itself here waiting for its ruler, the Hollow Crown, who left to steal fire |
| IV | Ember Wastes (`ember`) | lv 11 | Nov 5 – 25 | the Pyreback Colossus → the Ember Seed | The Crown forged itself an undying body; it can't die while its name is hidden |
| V | Wraithmoor (`wraith`) | lv 17 | Nov 26 – Dec 16 | the Veiled Queen → the Grave Seed | The dead of Ashmere give its true name |
| Finale | Ashmere (`crown`) | lv 23 + five lights | Dec 17 – 31 | — | **Final boss: the Hollow Crown, Thursday 31 Dec**, every hunter together, five lights, one true name (the same rule that freed Orrun) |

**Threads that must carry through every Book:**
- **The Five Lights:** each Book ends by freeing that world's keeper, who gives its Seed's light. `lightsFrom(story)` counts them, and the HUD shows LIGHTS n / 5 after Book I.
- **The Hollow Crown:** Ashmere's last ruler. Each Book reveals one piece of it, as in the table.
- **Every Book's shape** (Book II is the template):
  - a Rootway or atlas entry gated by level
  - a keeper NPC who explains what the Hollowing looks like in that world
  - a counted hunt
  - a memory
  - the guardian fight that frees the keeper
  - a report that hands over the light and points to the next world
- **To add a Book:** append its stages after `frost_wait` (renaming that stage's objective as the Book's start), add its keeper to `NPCS`, mark it `built: true` in `SAGA`, add it to `OPEN_REALMS` in `shell.js` and `REALMS`/`REALM_LEVEL` in the code, and write its journal pages.

**Still to decide with the owner:**
- Whether the Thursday hunt should switch from Orrun to the current Book's guardian as the weeks go on. Today it is always Orrun, at the week's level.
- The Hollow Crown's model and moveset for Dec 31.

**Owner's follow-up, same day: "just update the story till Shadowmere in game, have the story in the back. We will be doing weekly updates for the world building."**
- In game, the story stops at the end of Book II (Shadowmere).
- The plan above lives only in `SAGA` in `story.js` and in this README:
  - The journal shows no future Books.
  - The atlas has no saga or dates line.
  - Ashmere is not on the globe until it is built.
- Each weekly update builds the next world and then reveals it in game.

**Changes in this update:**
- `SAGA` and `lightsFrom` added to `story.js`; Halden's and Maren's lines carry the Five Lights and the Hollow Crown.
- The journal gains THE FIVE LIGHTS page once Book II is done.
- Atlas (`profile.js` BIOMES): Ember is now level 11 and Wraithmoor 17, to match the weekly pace.
- Book III's waiting objective says "from Oct 15".

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
  - **Forest:** 3 giant gnarled mossy trees with buttress roots and hanging…16416 tokens truncated…arer player and chained pounce, bite and tail slam, and the guest saw the same states at the same spot.
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
