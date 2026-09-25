# Verdant Reach · 3D prototype

Standalone 3D exploration experiment for **The Hollow Roots**. It has its own package, build, save key, and deployment. The 2D game is untouched.

## Play

```sh
npm install
npm run dev
```

Meet Mycel, enter your real-world baseline, then select Verdant Reach from the spinning world map. Combat opens in first person with animated hands and sleeves in your chosen colors. Move with WASD (relative to the camera), look with the mouse, strike with left click or F, evade with Shift or right click, mark a target with Q or middle click, jump with Space, press V to inspect your full character in third person and V again to return, interact with E, open the journal with J, open the map with M, and pause with Escape. In third person, move the mouse to orbit and scroll to zoom. Emotes are 1 pose, 2 sit, 3 wave, 4 cheer, and 0 to clear. Find three memories along branching trails and return to the Canopy Gate. Progress saves in this browser.

## The explorer

The player character is an authored, rigged model built in Blender with MPFB from CC0 MakeHuman assets, animated with retargeted CC0 Quaternius motion plus Hollow Roots strikes, guard and emotes. It lives in `public/characters/explorer/` (see its README for sources, licences and how to regenerate it with `tools/blender/build_explorer.py`). The older procedural body remains as a fallback if the model cannot load; `?procedural` forces it. `/character-lab.html` renders the model, clips, outfits and expressions from several angles.

## Combat

The unarmed style has a three-strike string — Sapling Palm, Bough Swing, Taproot Heel — plus an evade roll with invulnerable frames. Timing lives in `src/combat/moves.js`; each clip in `src/anim/clips.js` is keyed to the same timeline, and hits are tested against the posed limb, so first and third person land identically. Press **F3** (or add `?debug`) for a combat readout that draws hitboxes and logs why each strike hit, missed or was blocked. `?arena` skips the menus and starts beside the first shellback. `/lab.html?clips=palm,swing` renders any clip from several angles during development.

This is a prototype biome, not an open-world production release. Trees and substantial rocks block movement; smaller obstacles can be jumped over. The shellbacks and thornlings are 3D animated creatures; defeating them does not award XP. Real-world activities logged under Weekly Quest grant XP; baseline metrics shape your character stats. The other three world-map realms are level gated previews, not playable yet. The leaderboard is not connected to a shared service. The 3D profile has its own local save and does not read or modify the 2D game's save.
