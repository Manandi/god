# Third-party art

Placeholder tiles, parallax backgrounds, and encounter/interactable marker
icons are built from Kenney's **New Platformer Pack**
(https://kenney.nl/assets/new-platformer-pack), licensed
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain,
no attribution required).

`tools/generate-zone-maps.mjs` composes the source tiles into small per-zone
tilesets (`public/tilesets/*.png`) and picks a tile variant per cell by
adjacency (top/bottom/interior/floating-platform, with left/right caps) so
platforms render as shaped terrain instead of one flat stamped tile. Source
tile themes used: `grass` (biosphere), `sand` (rustsea), `stone` (forge),
`purple` (crystal).

This is still placeholder art standing in for Phase 5's real custom pipeline
— swap `public/tilesets`, `public/backgrounds`, and `public/sprites/markers`
for finished art when it's ready; the zone JSON and `ZoneScene` don't need to
change, only the registered image paths in `src/zones/ZoneRegistry.ts`.
