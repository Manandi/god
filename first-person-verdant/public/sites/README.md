# Memory sites and Mossgate props

Built in Blender from scripts (no hand modelling), so they can be rebuilt and changed.

| File | Script | What it is |
|---|---|---|
| `memory-sites.glb` | `tools/blender/build_sites.py` | The Rootwell, Mosswatch Ruins and the Canopy Shrine. About 49k triangles, 3.8 MB, baked stone and root textures (WEBP) |
| `mossgate-props.glb` | `tools/blender/build_mossgate.py` | Set dressing for Mossgate: well, market counters, cart, lantern posts, signpost, benches, planters, barrels, crates, sacks, firewood, window boxes, chimneys, bunting. About 5k triangles, flat colours |

```
blender -b --python first-person-verdant/tools/blender/build_sites.py -- [--preview out]    # renders out_<site>.png
blender -b --python first-person-verdant/tools/blender/build_mossgate.py -- [--preview out.png]
```

## Memory sites

Each site is a root object built around its own centre, with its open side
(where the road arrives) on local +X. `src/sites.js` turns each one to face its
`approach` point in `SITES` (`src/world.js`), and `groundY` levels the ground
under all three.

- **Rootwell:** a ring of mossy boulders open toward the road, a stone lip
  around a shallow pool (the water itself is in `world.js`, for its
  animation), lily pads, reeds, glowcaps, a rune-ringed spring stone, standing
  runestones, and three great roots arching over the pool.
- **Mosswatch:** a broken flagstone floor, a round dais with glowing runes, a
  colonnade of fluted columns (some whole under arches, some broken with their
  drums fallen), a ruined wall with arched windows, two stone sentinels (one
  headless), fallen oath slabs, and ivy.
- **Canopy Shrine:** a great tree with flared buttress roots and a cleft that
  opens into the hollow where the memory glows, limbs that carry the forest's
  leaf crowns, prayer ribbons, steps, and stone lanterns.

Also exported: `COL_*` empties (custom props `r`, `h`) for colliders, and
`CROWN_*` empties where the game hangs leaf crowns on the shrine tree.

## Mossgate props

The town itself is the ChatGPT Sites design and is not changed: these props
only add to it. They use the town's palette and blocky, flat-shaded style.
Each prop is one object at the origin, front facing +X. `src/sites.js`
places them (the `TOWN`, `AT_HOUSE` and `BY_DOOR` tables) and adds colliders.
