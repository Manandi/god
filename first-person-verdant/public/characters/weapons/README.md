# Weapons

`weapons.glb` holds the Groveblade and the Stonebreaker, built in Blender from
`tools/blender/build_weapons.py` (no hand modelling). About 2k triangles, 57 KB,
flat materials with glowing inlays.

```
blender -b --python first-person-verdant/tools/blender/build_weapons.py -- [--preview out.png]
```

- **Groveblade:** a leaf-shaped heartwood blade with a glowing sap vein on both
  faces, a crossguard of two curling roots around a seed gem, a leather-wrapped
  grip and an acorn pommel.
- **Stonebreaker:** a maul with a hewn stone head across the haft, bronze
  straps, a glowing rune on each striking face, roots binding the head, and a
  long haft with bronze collars and a leather grip.

Each model has its grip on the origin and its business end toward -Y in the
game. `src/weapons.js` mounts it in the right fist (`GRIP` for the third-person
body, `FP_GRIP` for the first-person arms). The empties `WeaponBase` and
`WeaponTip` mark the striking segment, and the combat hitbox uses them
(`weapon: true` in `src/combat/moves.js`), so the blade you see is the blade
that hits. The original box weapons from the ChatGPT design stay as stand-ins
until the models load.
