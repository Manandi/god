# The Explorer · authored character

`explorer.glb` is the player character for the 3D build, made in Blender from a
script, not by hand-placing primitives. `explorer-preview.png` shows the Ranger
outfit in the guard stance (top) and the Warden outfit (bottom).

## Build

| | |
|---|---|
| Blender | 4.5.14 LTS (headless) |
| MPFB | 2.0.17 (Blender extension, GPL-3.0; used as a tool only) |
| Script | `first-person-verdant/tools/blender/build_explorer.py` (+ `animate_explorer.py`) |
| Scale | 1 unit = 1 m. Model is 1.68 m; the game scales it ×1.08 (1.81 m) to match the camera and collision capsule |
| Origin | Between the feet, at ground level. The model faces +Z in glTF; the game turns it to face −Z |
| Skeleton | MPFB "game engine" rig, 53 bones (Unreal-style names: `pelvis`, `spine_01…03`, `upperarm_l`, `thigh_r`, fingers…) |

### Regenerate

1. Install Blender 4.5 LTS and the MPFB extension:
   `blender -b --command extension install-file -r user_default -e add-on-mpfb-v2.0.17.zip`
2. Unzip the CC0 asset packs into MPFB's user data folder
   (`~/.config/blender/4.5/extensions/.user/user_default/mpfb/data`):
   `makehuman_system_assets_cc0.zip`, `system_clothes_materials01_cc0.zip`, `system_hair_materials01_cc0.zip`
   from https://static.makehumancommunity.org/assets/assetpacks.html
3. Download the free **Universal Animation Library [Standard]** from
   https://quaternius.itch.io/universal-animation-library and point `UAL_GLB` at
   `Unreal-Godot/UAL1_Standard.glb` (default path: `/opt/mpfb/ual/…`).
4. Run from the repository root:
   `blender -b --python first-person-verdant/tools/blender/build_explorer.py -- --stage full`
   Add `--save /tmp/explorer.blend` to keep a .blend for inspection, or
   `--stage body` to skip animation.

### Export settings

glTF 2.0 binary; skins, morph targets (with normals) and every action as its own
animation; textures embedded as WebP (quality 88); no cameras or lights;
`export_apply` off so the armature stays live; animations sampled at 30 fps.
Library clips and the library skeleton are deleted before export.

## What is in the file

**Meshes** (the game toggles visibility; nothing is rebuilt at runtime)

- `Explorer_Body` — one connected body. Faces fully covered by clothing are removed.
- `Explorer_Eyes`, `Explorer_Brows`, `Explorer_Lashes`, `Explorer_Teeth`, `Explorer_Boots`
- `Hair_short`, `Hair_curly`, `Hair_swept`, `Hair_tied`, `Hair_braid`
- Shared: `Outfit_Undershirt`, `Outfit_Trousers`
- Ranger outfit: `Ranger_Jerkin` (laced V-neck, split skirt), `Ranger_Belt`, `Ranger_Buckle`,
  `Ranger_Pouch`, `Ranger_PouchFlap`, `Ranger_Strap`, `Ranger_Bracers`, `Ranger_Lace*`
- Warden outfit: `Warden_Coat` (quilted, high collar, back vent), `Warden_Belt`,
  `Warden_Pauldron`, `Warden_PauldronPlate`, `Warden_Wraps`

Garments are cut from the body surface, loosened, given real thickness and
hemmed, so they share the body's topology, UVs and skin weights. Seams, hems and
stitching are painted into each garment's texture along its UV seams and edges.

**Materials the game tints** (textures are near-white so the colour multiplies through)

- `M_Skin` → skin tone · `M_Shirt_*` → shirt colour · `M_Pants_*` → trouser colour ·
  `M_Hair_*` → hair colour (hair and brows).
- Fixed: `M_Linen`, `M_Leather*`, `M_Brass`, `M_Wraps`, boots, eyes, teeth.

**Morph targets** (on the body; brows and lashes follow all of them, eyes and hair follow the face presets)

- Face presets: `Face_Sharp`, `Face_Round` (both 0 = soft)
- Expressions: `Blink`, `Smile`, `Exert`, `Hurt`, `Talk`

**Animation clips** (seconds)

| Clip | Use | Source |
|---|---|---|
| `Idle`, `Walk`, `Jog`, `WalkBackward`, `Talk`, `Sit`, `Death`, `Interact`, `Fall` | locomotion, emotes | retargeted from UAL, re-timed |
| `StrafeLeft`, `StrafeRight` | sideways walk, chest square to the front | UAL walk + authored hip/spine counter-rotation |
| `GuardIdle`, `GuardWalk`, `GuardBack`, `GuardLeft`, `GuardRight` | combat locomotion with fists up | UAL + authored guard (IK hand targets) |
| `JumpStart` (0.3), `Land` (0.42) | jumping | UAL, trimmed |
| `Dash` (0.6) | evade roll | UAL roll, re-timed to the evade window |
| `Hurt` (0.42) | hit reaction | UAL, re-timed |
| `AttackLight1` (0.46) | Sapling Palm — contact 0.12 s | UAL jab lower body; arms authored with IK: open palm heel, torso turn |
| `AttackLight2` (0.60) | Bough Swing — contact 0.20 s | UAL cross lower body; authored forearm sweep and hip/chest unwind |
| `AttackHeavy` (0.82) | Taproot Heel — contact 0.27–0.34 s | authored: chamber, heel drive, re-chamber |
| `Wave`, `Cheer`, `Pose` | emotes | authored over UAL idle |

Strike contact times match `src/combat/moves.js`. Change one, change the other.

## Adding a hairstyle or outfit

- **Hairstyle:** add an entry to `HAIR` in `build_explorer.py` (any MakeHuman hair
  asset), add its name to `HAIR_STYLES` in `src/avatar.js` and `HAIR_MESH` in
  `src/avatarGLB.js`, and allow it in `src/profile.js`.
- **Outfit:** build its garments in section 6 of `build_explorer.py` with the same
  helpers (`new_from_body`, `cut`, `loosen`, `extrude_hem`, `band_from`, `ribbon`),
  prefix every object with the outfit name (e.g. `Scout_`), list them in `OUTFITS`,
  give tintable cloth an `M_Shirt_`/`M_Pants_` material, then add the name to
  `OUTFITS` in `src/avatar.js`, the prefix check in `src/avatarGLB.js`, and the
  allowed values in `src/profile.js`.

## Sources and licences

| Asset | Licence |
|---|---|
| MakeHuman base mesh, skins, eyes, brows, lashes, teeth, hair, boots (`shoes03`), expression units | CC0 — https://static.makehumancommunity.org/about/license.html |
| Universal Animation Library [Standard] by Quaternius | CC0 1.0 |
| Garments, garment textures, authored animation, face presets | Made for The Hollow Roots |

MPFB (GPL) and Blender (GPL) are tools; their licences do not apply to exported
models.
