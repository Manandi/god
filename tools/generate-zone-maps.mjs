#!/usr/bin/env node
// One-off authoring tool: emits genuine Tiled-JSON maps (openable in the real
// Tiled editor) for each zone, so level geometry lives in data files rather
// than hand-coded JS. Tile GIDs are picked by adjacency (classifyTiles) from a
// small composed tileset per zone (see tools/compose-assets note in README),
// built from Kenney's CC0 "New Platformer Pack".
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TILE = 16;
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'maps');
mkdirSync(OUT_DIR, { recursive: true });

// Matches the 5x3 grid baked by the asset-composition step into
// public/tilesets/<zone>.png (GID = row * 5 + col + 1).
const GID = {
  topLeft: 1,
  top: 2,
  topRight: 3,
  center: 4,
  bottomLeft: 6,
  bottom: 7,
  bottomRight: 8,
  cloudLeft: 11,
  cloudMiddle: 12,
  cloudRight: 13,
  cloudSingle: 14
};

function emptyGrid(width, height) {
  return Array.from({ length: height }, () => new Array(width).fill(0));
}

function fillRect(grid, x, y, w, h, width, height) {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      if (row >= 0 && row < height && col >= 0 && col < width) {
        grid[row][col] = 1;
      }
    }
  }
}

function carve(grid, x, y, w, h) {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      grid[row][col] = 0;
    }
  }
}

// Picks a tile variant (top/bottom/interior/floating-platform, with left/right
// caps) per solid cell based on its neighbors, so platforms and ground read as
// real shaped terrain instead of one flat stamped tile.
function classifyTiles(grid, width, height) {
  const isSolid = (r, c) => r >= 0 && r < height && c >= 0 && c < width && grid[r][c] !== 0;
  const out = grid.map((row) => row.slice());
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!isSolid(r, c)) continue;
      const above = isSolid(r - 1, c);
      const below = isSolid(r + 1, c);
      const left = isSolid(r, c - 1);
      const right = isSolid(r, c + 1);

      let gid;
      if (!above && !below) {
        gid = !left && !right ? GID.cloudSingle : !left ? GID.cloudLeft : !right ? GID.cloudRight : GID.cloudMiddle;
      } else if (!above && below) {
        gid = !left ? GID.topLeft : !right ? GID.topRight : GID.top;
      } else if (above && !below) {
        gid = !left ? GID.bottomLeft : !right ? GID.bottomRight : GID.bottom;
      } else {
        gid = GID.center;
      }
      out[r][c] = gid;
    }
  }
  return out;
}

function hash(n) {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 13;
  x = (x * 2246822519) >>> 0;
  return x >>> 0;
}

function findSurfaceRow(grid, col, width, height) {
  if (col < 0 || col >= width) return -1;
  for (let row = 0; row < height; row++) {
    if (grid[row][col] !== 0) return row;
  }
  return -1;
}

// Scatters decorative props (rocks/bushes/torches/gems — cosmetic only, no
// collision) along whatever surface is topmost in each sampled column, so
// platforms stop reading as one flat stamped tile repeated end to end.
function scatterDecor(grid, width, height, step, kinds, seed) {
  const objects = [];
  for (let col = 3; col < width - 3; col += step) {
    const jitter = hash(col + seed) % 3;
    const c = Math.min(width - 3, col + jitter);
    const row = findSurfaceRow(grid, c, width, height);
    if (row <= 0) continue;
    const kind = kinds[hash(col + seed + 97) % kinds.length];
    objects.push(marker('decor', kind, c, row - 1));
  }
  return objects;
}

let objectIdSeq = 1;
function nextObjectId() {
  return objectIdSeq++;
}

function doorObject({ col, rowBottom, name, targetZone, targetSpawn, requiredLevel = 0 }) {
  const rows = 5;
  return {
    id: nextObjectId(),
    name,
    type: 'door',
    x: col * TILE,
    y: (rowBottom - rows + 1) * TILE,
    width: TILE,
    height: rows * TILE,
    visible: true,
    properties: [
      { name: 'targetZone', type: 'string', value: targetZone },
      { name: 'targetSpawn', type: 'string', value: targetSpawn },
      { name: 'requiredLevel', type: 'int', value: requiredLevel }
    ]
  };
}

function spawnPoint(name, col, rowFloorTop) {
  return {
    id: nextObjectId(),
    name,
    type: 'spawn',
    point: true,
    x: col * TILE,
    y: rowFloorTop * TILE,
    width: 0,
    height: 0,
    visible: true,
    properties: []
  };
}

function marker(kind, name, col, row, extra = []) {
  return {
    id: nextObjectId(),
    name,
    type: kind,
    point: true,
    x: col * TILE,
    y: row * TILE,
    width: 0,
    height: 0,
    visible: true,
    properties: [{ name: 'kind', type: 'string', value: name }, ...extra]
  };
}

// Places a marker resting on whatever surface is topmost at that column,
// instead of a manually guessed row — markers are static images with no
// physics to "settle" them, so a wrong row leaves them floating unreachable.
function markerOnSurface(grid, width, height, kind, name, col, extra = []) {
  const row = findSurfaceRow(grid, col, width, height);
  return marker(kind, name, col, row - 1, extra);
}

function buildTiledMap({ width, height, layers, zoneKey }) {
  let layerId = 1;
  const tiledLayers = layers.map((layer) => {
    if (layer.type === 'tile') {
      return {
        id: layerId++,
        name: layer.name,
        type: 'tilelayer',
        width,
        height,
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        data: layer.grid.flat()
      };
    }
    return {
      id: layerId++,
      name: layer.name,
      type: 'objectgroup',
      draworder: 'topdown',
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
      objects: layer.objects
    };
  });

  return {
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width,
    height,
    tilewidth: TILE,
    tileheight: TILE,
    infinite: false,
    nextlayerid: layerId,
    nextobjectid: objectIdSeq,
    tilesets: [
      {
        firstgid: 1,
        name: 'terrain',
        tilewidth: TILE,
        tileheight: TILE,
        tilecount: 15,
        columns: 5,
        margin: 0,
        spacing: 0,
        image: `../tilesets/${zoneKey}.png`,
        imagewidth: TILE * 5,
        imageheight: TILE * 3
      }
    ],
    layers: tiledLayers
  };
}

function writeZone(fileName, mapData) {
  writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(mapData, null, 2) + '\n');
  console.log(`wrote ${fileName}`);
}

function lore(text) {
  return [{ name: 'text', type: 'string', value: text }];
}

function loot(item) {
  return [{ name: 'item', type: 'string', value: item }];
}

// ---------------------------------------------------------------------------
// Zone: biosphere (starting zone)
// ---------------------------------------------------------------------------
{
  objectIdSeq = 1;
  const W = 120;
  const H = 32;
  const R = H;
  const grid = emptyGrid(W, H);

  fillRect(grid, 0, R - 3, W, 3, W, H);
  carve(grid, 20, R - 3, 4, 2); // first gap, safety floor beneath stays solid

  fillRect(grid, 30, R - 7, 4, 1, W, H);
  fillRect(grid, 36, R - 11, 4, 1, W, H);
  fillRect(grid, 42, R - 15, 4, 1, W, H);

  fillRect(grid, 15, R - 6, 3, 1, W, H); // ledge up to the locked vault door
  fillRect(grid, 1, 4, 5, 1, W, H); // isolated vault room, teleport-only

  carve(grid, 55, R - 3, 5, 2); // second, wider gap — a real running jump
  // Canopy chain: a zig-zag route above the gap, distinct from the low stepping stones.
  fillRect(grid, 62, R - 6, 4, 1, W, H);
  fillRect(grid, 70, R - 10, 4, 1, W, H);
  fillRect(grid, 78, R - 6, 4, 1, W, H);

  // Boss arena: wide open clearing before the exit door.
  // (floor already continuous here — kept deliberately obstacle-free)

  const decor = scatterDecor(grid, W, H, 5, ['bush', 'mushroom_red', 'mushroom_brown'], 11);

  const doors = [
    doorObject({ col: W - 1, rowBottom: R - 3, name: 'toRustsea', targetZone: 'rustsea', targetSpawn: 'fromWest' }),
    doorObject({
      col: 17,
      rowBottom: R - 6,
      name: 'vaultDoor',
      targetZone: 'biosphere',
      targetSpawn: 'vault',
      requiredLevel: 5
    })
  ];

  const spawns = [
    spawnPoint('start', 3, R - 8),
    spawnPoint('fromEast', W - 6, R - 8),
    spawnPoint('vault', 3, 4)
  ];

  const encounters = [
    markerOnSurface(grid, W, H, 'encounter', 'enemy', 25),
    markerOnSurface(grid, W, H, 'encounter', 'enemy', 44),
    markerOnSurface(grid, W, H, 'encounter', 'enemy', 63),
    markerOnSurface(grid, W, H, 'encounter', 'enemy', 100),
    markerOnSurface(grid, W, H, 'encounter', 'boss', 106)
  ];

  const interactables = [
    markerOnSurface(grid, W, H, 'interactable', 'lore', 6, lore('The biosphere dome cracked a decade before anyone logged a workout for it.')),
    markerOnSurface(grid, W, H, 'interactable', 'chest', 3, loot('Fern-Wrapped Charm')),
    markerOnSurface(grid, W, H, 'interactable', 'lore', 72, lore('Something in the canopy still keeps the old irrigation rhythm.')),
    markerOnSurface(grid, W, H, 'interactable', 'chest', 80, loot('Sapling Core'))
  ];

  writeZone(
    'biosphere.json',
    buildTiledMap({
      width: W,
      height: H,
      zoneKey: 'biosphere',
      layers: [
        { type: 'tile', name: 'ground', grid: classifyTiles(grid, W, H) },
        { type: 'objects', name: 'doors', objects: doors },
        { type: 'objects', name: 'spawns', objects: spawns },
        { type: 'objects', name: 'encounters', objects: encounters },
        { type: 'objects', name: 'interactables', objects: interactables },
        { type: 'objects', name: 'decor', objects: decor }
      ]
    })
  );
}

// ---------------------------------------------------------------------------
// Zone: rustsea
// ---------------------------------------------------------------------------
{
  objectIdSeq = 1;
  const W = 140;
  const H = 34;
  const R = H;
  const grid = emptyGrid(W, H);

  fillRect(grid, 0, R - 3, W, 3, W, H);
  carve(grid, 25, R - 3, 6, 2); // wide gap right out of the gate

  fillRect(grid, 40, R - 6, 5, 1, W, H);
  fillRect(grid, 50, R - 10, 5, 1, W, H);
  fillRect(grid, 60, R - 6, 5, 1, W, H);

  // Tide terraces: alternating step heights instead of one flat run.
  carve(grid, 75, R - 3, 25, 2);
  fillRect(grid, 75, R - 6, 4, 1, W, H);
  fillRect(grid, 82, R - 9, 4, 1, W, H);
  fillRect(grid, 89, R - 6, 4, 1, W, H);
  fillRect(grid, 96, R - 3, 4, 3, W, H); // rejoins full floor height

  carve(grid, 115, R - 3, 5, 2); // late gap before the boss arena

  const decor = scatterDecor(grid, W, H, 6, ['rock', 'cactus', 'fence_broken'], 23);

  const doors = [
    doorObject({ col: 0, rowBottom: R - 3, name: 'toBiosphere', targetZone: 'biosphere', targetSpawn: 'fromEast' }),
    doorObject({ col: W - 1, rowBottom: R - 3, name: 'toForge', targetZone: 'forge', targetSpawn: 'fromWest' })
  ];

  const spawns = [spawnPoint('fromWest', 6, R - 8), spawnPoint('fromEast', W - 6, R - 8)];

  const encounters = [
    markerOnSurface(grid, W, H, 'encounter', 'enemy', 34),
    markerOnSurface(grid, W, H, 'encounter', 'enemy', 52),
    markerOnSurface(grid, W, H, 'encounter', 'enemy', 84),
    markerOnSurface(grid, W, H, 'encounter', 'enemy', 108),
    markerOnSurface(grid, W, H, 'encounter', 'boss', 130)
  ];

  const interactables = [
    markerOnSurface(grid, W, H, 'interactable', 'lore', 10, lore('The sea rusted first, then the machines that watched it.')),
    markerOnSurface(grid, W, H, 'interactable', 'chest', 62, loot('Corroded Gear Fragment')),
    markerOnSurface(grid, W, H, 'interactable', 'lore', 76, lore('High-tide marks are scored into the terrace, a decade apart.')),
    markerOnSurface(grid, W, H, 'interactable', 'chest', 112, loot('Salt-Etched Locket'))
  ];

  writeZone(
    'rustsea.json',
    buildTiledMap({
      width: W,
      height: H,
      zoneKey: 'rustsea',
      layers: [
        { type: 'tile', name: 'ground', grid: classifyTiles(grid, W, H) },
        { type: 'objects', name: 'doors', objects: doors },
        { type: 'objects', name: 'spawns', objects: spawns },
        { type: 'objects', name: 'encounters', objects: encounters },
        { type: 'objects', name: 'interactables', objects: interactables },
        { type: 'objects', name: 'decor', objects: decor }
      ]
    })
  );
}

// ---------------------------------------------------------------------------
// Zone: forge (vertical climb)
// ---------------------------------------------------------------------------
{
  objectIdSeq = 1;
  const W = 100;
  const H = 60;
  const R = H;
  const grid = emptyGrid(W, H);

  fillRect(grid, 0, R - 3, 22, 3, W, H); // bottom landing spans the entry area

  // Climbing chimney: alternating left/right platforms, with a wide mid-rest
  // landing partway up so the climb has a breather instead of one long grind.
  const SEGMENTS = 12;
  const MID_REST_INDEX = 6;
  const chimneyPlatforms = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const y = R - 7 - i * 4;
    if (i === MID_REST_INDEX) {
      fillRect(grid, 2, y, 18, 2, W, H);
      chimneyPlatforms.push({ x: 10, y, rest: true });
    } else {
      const x = i % 2 === 0 ? 8 : 2;
      fillRect(grid, x, y, 5, 1, W, H);
      chimneyPlatforms.push({ x, y, rest: false });
    }
  }
  const topSegment = chimneyPlatforms[SEGMENTS - 1];
  const landingTopRow = topSegment.y - 4;

  // Top landing leading right to the exit.
  fillRect(grid, 2, landingTopRow, W - 2, 3, W, H);

  const decor = scatterDecor(grid, W, H, 4, ['rock', 'chain', 'torch_on_a', 'torch_on_b'], 37);

  const doors = [
    doorObject({ col: 0, rowBottom: R - 3, name: 'toRustsea', targetZone: 'rustsea', targetSpawn: 'fromEast' }),
    doorObject({
      col: W - 1,
      rowBottom: landingTopRow,
      name: 'toCrystal',
      targetZone: 'crystal',
      targetSpawn: 'fromWest'
    })
  ];

  const spawns = [spawnPoint('fromWest', 4, R - 8), spawnPoint('fromEast', W - 6, landingTopRow - 3)];

  // Segment platforms share columns across the two alternating families, so
  // markers tied to a *specific* segment use its known y directly rather than
  // a column-based surface lookup (which would find whichever segment in
  // that column is topmost, not necessarily this one).
  const enemySpots = [chimneyPlatforms[2], chimneyPlatforms[4], chimneyPlatforms[9]];
  const encounters = [
    ...enemySpots.map((p) => marker('encounter', 'enemy', p.x + 2, p.y - 1)),
    markerOnSurface(grid, W, H, 'encounter', 'boss', 40)
  ];

  const midRest = chimneyPlatforms[MID_REST_INDEX];
  const interactables = [
    markerOnSurface(grid, W, H, 'interactable', 'lore', 16, lore('The forge never went cold; it just ran out of things worth shaping.')),
    marker('interactable', 'chest', midRest.x, midRest.y - 1, loot('Ember Core Shard')),
    markerOnSurface(grid, W, H, 'interactable', 'lore', 6, lore('Whoever built the last landing meant to come back down.')),
    markerOnSurface(grid, W, H, 'interactable', 'chest', W - 10, loot('Slag-Forged Ring'))
  ];

  writeZone(
    'forge.json',
    buildTiledMap({
      width: W,
      height: H,
      zoneKey: 'forge',
      layers: [
        { type: 'tile', name: 'ground', grid: classifyTiles(grid, W, H) },
        { type: 'objects', name: 'doors', objects: doors },
        { type: 'objects', name: 'spawns', objects: spawns },
        { type: 'objects', name: 'encounters', objects: encounters },
        { type: 'objects', name: 'interactables', objects: interactables },
        { type: 'objects', name: 'decor', objects: decor }
      ]
    })
  );
}

// ---------------------------------------------------------------------------
// Zone: crystal (current frontier — no forward door yet)
// ---------------------------------------------------------------------------
{
  objectIdSeq = 1;
  const W = 100;
  const H = 50;
  const R = H;
  const grid = emptyGrid(W, H);

  fillRect(grid, 0, R - 3, 14, 3, W, H);

  // Spire climb: asymmetric jutting platforms, narrower every third segment.
  const SEGMENTS = 13;
  const spirePlatforms = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const x = i % 2 === 0 ? 16 : 22;
    const y = R - 6 - i * 3;
    const w = i % 3 === 2 ? 3 : 4;
    fillRect(grid, x, y, w, 1, W, H);
    spirePlatforms.push({ x, y, w });
  }
  const topSpire = spirePlatforms[SEGMENTS - 1];
  const plateauTopRow = topSpire.y - 4;

  fillRect(grid, 40, plateauTopRow, W - 40, 3, W, H); // final plateau

  const decor = scatterDecor(grid, W, H, 4, ['gem_green', 'gem_red', 'gem_yellow', 'rock'], 59);

  const doors = [doorObject({ col: 0, rowBottom: R - 3, name: 'toForge', targetZone: 'forge', targetSpawn: 'fromEast' })];

  const spawns = [spawnPoint('fromWest', 4, R - 8), spawnPoint('end', W - 15, plateauTopRow - 3)];

  // Same column-sharing caveat as forge's chimney: use each segment's known
  // y directly instead of a surface lookup.
  const enemySpots = [spirePlatforms[3], spirePlatforms[7]];
  const encounters = [
    ...enemySpots.map((p) => marker('encounter', 'enemy', p.x + 1, p.y - 1)),
    markerOnSurface(grid, W, H, 'encounter', 'boss', W - 30)
  ];

  const interactables = [
    marker('interactable', 'lore', spirePlatforms[1].x, spirePlatforms[1].y - 1, lore('The crystal grows fastest where people used to give up.')),
    markerOnSurface(grid, W, H, 'interactable', 'chest', W - 20, loot('Prism Splinter')),
    markerOnSurface(grid, W, H, 'interactable', 'lore', W - 12, lore('The path ends here — for now. The next vein hasn’t been logged yet.'))
  ];

  writeZone(
    'crystal.json',
    buildTiledMap({
      width: W,
      height: H,
      zoneKey: 'crystal',
      layers: [
        { type: 'tile', name: 'ground', grid: classifyTiles(grid, W, H) },
        { type: 'objects', name: 'doors', objects: doors },
        { type: 'objects', name: 'spawns', objects: spawns },
        { type: 'objects', name: 'encounters', objects: encounters },
        { type: 'objects', name: 'interactables', objects: interactables },
        { type: 'objects', name: 'decor', objects: decor }
      ]
    })
  );
}
