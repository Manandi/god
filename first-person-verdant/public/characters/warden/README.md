# Orrun, the Hollow Warden · boss

`warden.glb` is the Verdant Reach boss, built in Blender entirely from a script
(no hand modelling), so it can be rebuilt and changed. `warden-preview.png`
shows the bite, mid-strike.

The arena it fights in, the Warden's Hollow in front of the Canopy Gate, is
`../../arena/warden-hollow.glb`, built the same way (preview: `../../arena/warden-hollow-preview.png`).

## Build

| | |
|---|---|
| Blender | 4.5.14 LTS (headless, Cycles for texture baking) |
| Scripts | `first-person-verdant/tools/blender/build_warden.py`, `build_arena.py`, shared helpers in `procedural.py` |
| Scale | 1 unit = 1 m. About 7 m long and 5.3 m to the tallest crystal; the game scales it ×1.1 |
| Facing | +Z in glTF (Blender −Y), matching the creatures' heading convention |
| Budget | About 21k triangles, 24 bones, 14 clips, 2.7 MB (WEBP textures) |

```
blender -b --python first-person-verdant/tools/blender/build_warden.py -- [--preview out.png --pose Bite --frame 23 --angle -25] [--tex 2048]
blender -b --python first-person-verdant/tools/blender/build_arena.py -- [--preview out.png]
```

## How it is made

- **Shell:** a sphere sculpted by a spherical Voronoi of hand-placed scute
  centres. That gives the grooves, flared and serrated marginal plates, a
  flattened plastron, and growth rings. The Hollowing's glowing cracks follow
  chosen scute seams on the back and across the plastron (its weak point).
- **Body:** one continuous skin from the Skin modifier over a skeleton of
  points, so body, neck, legs and tail blend at the joints. Bark creeps up the
  lower legs.
- **Head and jaw:** one sculpted skull (heavy brow, hooked beak) cut along
  the mouth line, with the cut capped as the inside of the mouth.
- **Roots:** tapering tubes caging the shell, tendrils from the rim and a root
  "beard" from the jaw.
- **Memories:** hexagonal crystal clusters on the back. These are the
  memories it has drained; they glow brighter as the fight goes on.
- **Textures:** procedural shader networks baked by Cycles into colour,
  emission and normal maps.
- **Rig and weights:** 24 bones. The skin is weighted by distance to bone
  segments; rigid parts are bound to a single bone.

## Clips (seconds; the game's hit windows are clip times)

| Clip | Length | Used for |
|---|---|---|
| Idle, Walk, Charge | loops | locomotion; Walk ≈ 1.2 m/s, Charge ≈ 5 m/s at clip speed |
| Sleep | loop | rooted to the gate before the fight |
| Roar | 2.6 | waking and the phase change (roar hits at 0.72) |
| Bite | 2.8 | two bites: active 0.72–0.90 and 1.66–1.84. The only parryable attack |
| Stomp | 2.6 | rears up, slams at 1.08–1.2, then a shockwave ring (jump or roll it) |
| Sweep | 2.2 | tail sweep, 0.72–1.08, punishes standing behind it |
| Erupt | 2.4 | head into the ground; roots burst under marked spots |
| Stagger | 1.2 | flinch; played slowed while reeling from a parry |
| Topple, Down, GetUp | 1.2, loop, 1.4 | on its back, belly exposed for a Root Strike |
| Death | 3.5 | released; it lies down |
