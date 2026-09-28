# Verdant Reach · 3D prototype

Standalone 3D exploration experiment for **The Hollow Roots**. It has its own package, build, save key, and deployment. The 2D game is untouched.

## Play

```sh
npm install
npm run dev
```

Meet Mycel, enter your real-world baseline, then select Verdant Reach from the spinning world map. Combat opens in first person with animated hands and sleeves in your chosen colors. Move with WASD (relative to the camera), look with the mouse, light strike with left click or F, heavy strike with right click or R (hold to charge), roll with Shift, lock on with Q or middle click (flick the mouse hard to switch targets), jump with Space, press V to inspect your full character in third person and V again to return (`?third` starts in third person), interact with E, open the journal with J, open the map with M, and pause with Escape. In third person, move the mouse to orbit and scroll to zoom. Emotes are 1 pose, 2 sit, 3 wave, 4 cheer, and 0 to clear. Find three memories along branching trails and return to the Canopy Gate. Progress saves in this browser.

## The explorer

The player is the Roblox-style block explorer from the ChatGPT Sites design: square limbs and head over the procedural rig, which also drives the first-person block hands. You start at the Rootward Homestead and walk through Mossgate, whose block NPCs (Sela, Orin, Mycel, Tavi) start and carry the story; Brannoch, Ysolde and Pip keep the sites along the lantern road. The earlier Blender/MPFB explorer is kept in `public/characters/explorer/` (see its README) and loads only with `?legacyCharacters`. `/character-lab.html` renders that model, its clips, outfits and expressions.

## Combat

- **Light string:** Sapling Palm → Bough Swing → … (left click). **Heavy:** Taproot Heel (right click), also a finisher from any light strike; hold to charge through two levels for more damage, poise damage and impact. Heavies have hyper-armour: light hits hurt but don't interrupt.
- **Breath (stamina):** every strike and roll spends it; it recovers after a short pause. At zero you can't act.
- **Roll:** invulnerable frames; your real-world Speed lengthens them. Roll so an attack lands in the opening frames for a **perfect evade**: time slows, Breath returns, and your next strikes count as counters.
- **Shellbacks** read their moves before they commit: a lunging bite, a shell spin that punishes standing beside or behind them, and a rearing slam whose shockwave ring you jump over or roll through. Light hits never cancel a committed attack; heavies and enough damage stagger them. Below 40% health they enrage.
- **Poise:** hits wear down footing. At zero the turtle flips onto its back — its belly takes double damage and you can land a **Root Strike**. The head is a weak point (orange numbers); the shell is armoured (grey numbers, clank).
- Real-world stats: Strength scales damage and poise damage, Speed the roll's i-frames, Stamina Breath recovery, Defense health.

Timing lives in `src/combat/moves.js`; each clip is keyed to the same timeline, and hits are tested against the posed limb, so first and third person land identically. Press **F3** (or add `?debug`) for a combat readout that draws the collision capsule, strike and hurt volumes and the creature's damage volumes, and logs why each strike hit, missed or was blocked. `?arena` skips the menus and starts beside the first shellback. `/lab.html?clips=palm,swing` renders any clip from several angles during development.

This is a prototype biome, not an open-world production release. Trees and substantial rocks block movement; smaller obstacles can be jumped over. The shellbacks and thornlings are 3D animated creatures; defeating them does not award XP. Real-world activities logged under Weekly Quest grant XP; baseline metrics shape your character stats. The other three world-map realms are level gated previews, not playable yet. The leaderboard is not connected to a shared service. The 3D profile has its own local save and does not read or modify the 2D game's save.
