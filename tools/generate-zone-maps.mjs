#!/usr/bin/env node
// One-off authoring tool: emits genuine Tiled-JSON maps (openable in the real
// Tiled editor) for each zone, so level geometry lives in data files rather
// than hand-coded JS. Placeholder tileset image; Phase 2 uses a runtime
// solid-color texture per zone until real art (Phase 5) replaces it.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TILE = 16;
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'maps');
mkdirSync(OUT_DIR, { recursive: true });

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

function buildTiledMap({ width, height, layers }) {
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
        name: 'placeholder',
        tilewidth: TILE,
        tileheight: TILE,
        tilecount: 1,
        columns: 1,
        margin: 0,
        spacing: 0,
        image: '../tilesets/placeholder.png',
        imagewidth: TILE,
        imageheight: TILE
      }
    ],
    layers: tiledLayers
  };
}

function writeZone(fileName, mapData) {
  writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(mapData, null, 2) + '\n');
  console.log(`wrote ${fileName}`);
}

// ---------------------------------------------------------------------------
// Zone: biosphere (starting zone)
// ---------------------------------------------------------------------------
{
  objectIdSeq = 1;
  const W = 80;
  const H = 30;
  const R = H;
  const grid = emptyGrid(W, H);

  fillRect(grid, 0, R - 3, W, 3, W, H);
  carve(grid, 20, R - 3, 4, 2); // jumpable gap, safety floor beneath stays solid

  fillRect(grid, 30, R - 7, 4, 1, W, H);
  fillRect(grid, 36, R - 11, 4, 1, W, H);
  fillRect(grid, 42, R - 15, 4, 1, W, H);

  fillRect(grid, 15, R - 6, 3, 1, W, H); // ledge up to the locked vault door

  // Isolated vault room, reachable only via the locked door teleport (not by foot).
  fillRect(grid, 1, 4, 5, 1, W, H);

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
    marker('encounter', 'enemy', 25, R - 8),
    marker('encounter', 'enemy', 46, R - 20),
    marker('encounter', 'boss', 66, R - 8)
  ];

  const interactables = [
    marker('interactable', 'lore', 6, R - 8),
    marker('interactable', 'chest', 3, 3)
  ];

  writeZone(
    'biosphere.json',
    buildTiledMap({
      width: W,
      height: H,
      layers: [
        { type: 'tile', name: 'ground', grid },
        { type: 'objects', name: 'doors', objects: doors },
        { type: 'objects', name: 'spawns', objects: spawns },
        { type: 'objects', name: 'encounters', objects: encounters },
        { type: 'objects', name: 'interactables', objects: interactables }
      ]
    })
  );
}

// ---------------------------------------------------------------------------
// Zone: rustsea
// ---------------------------------------------------------------------------
{
  objectIdSeq = 1;
  const W = 90;
  const H = 32;
  const R = H;
  const grid = emptyGrid(W, H);

  fillRect(grid, 0, R - 3, W, 3, W, H);
  carve(grid, 25, R - 3, 6, 2); // wider gap than biosphere

  fillRect(grid, 40, R - 6, 5, 1, W, H);
  fillRect(grid, 50, R - 10, 5, 1, W, H);
  fillRect(grid, 60, R - 6, 5, 1, W, H);

  const doors = [
    doorObject({ col: 0, rowBottom: R - 3, name: 'toBiosphere', targetZone: 'biosphere', targetSpawn: 'fromEast' }),
    doorObject({ col: W - 1, rowBottom: R - 3, name: 'toForge', targetZone: 'forge', targetSpawn: 'fromWest' })
  ];

  const spawns = [spawnPoint('fromWest', 6, R - 8), spawnPoint('fromEast', W - 6, R - 8)];

  const encounters = [
    marker('encounter', 'enemy', 34, R - 8),
    marker('encounter', 'enemy', 55, R - 15),
    marker('encounter', 'boss', 80, R - 8)
  ];

  const interactables = [marker('interactable', 'lore', 10, R - 8), marker('interactable', 'chest', 62, R - 11)];

  writeZone(
    'rustsea.json',
    buildTiledMap({
      width: W,
      height: H,
      layers: [
        { type: 'tile', name: 'ground', grid },
        { type: 'objects', name: 'doors', objects: doors },
        { type: 'objects', name: 'spawns', objects: spawns },
        { type: 'objects', name: 'encounters', objects: encounters },
        { type: 'objects', name: 'interactables', objects: interactables }
      ]
    })
  );
}

// ---------------------------------------------------------------------------
// Zone: forge (vertical climb)
// ---------------------------------------------------------------------------
{
  objectIdSeq = 1;
  const W = 80;
  const H = 40;
  const R = H;
  const grid = emptyGrid(W, H);

  fillRect(grid, 0, R - 3, 20, 3, W, H); // bottom landing only spans the entry area

  // Climbing chimney: alternating left/right platforms rising to the top.
  const chimney = [
    [8, R - 7],
    [2, R - 11],
    [8, R - 15],
    [2, R - 19],
    [8, R - 23],
    [2, R - 27],
    [8, R - 31]
  ];
  for (const [x, y] of chimney) {
    fillRect(grid, x, y, 5, 1, W, H);
  }

  // Top landing leading right to the exit.
  fillRect(grid, 2, R - 35, W - 2, 3, W, H);

  const doors = [
    doorObject({ col: 0, rowBottom: R - 3, name: 'toRustsea', targetZone: 'rustsea', targetSpawn: 'fromEast' }),
    doorObject({ col: W - 1, rowBottom: R - 35, name: 'toCrystal', targetZone: 'crystal', targetSpawn: 'fromWest' })
  ];

  const spawns = [spawnPoint('fromWest', 4, R - 8), spawnPoint('fromEast', W - 6, R - 37)];

  const encounters = [
    marker('encounter', 'enemy', 8, R - 15),
    marker('encounter', 'enemy', 2, R - 27),
    marker('encounter', 'boss', 40, R - 38)
  ];

  const interactables = [marker('interactable', 'lore', 10, R - 8), marker('interactable', 'chest', 8, R - 31)];

  writeZone(
    'forge.json',
    buildTiledMap({
      width: W,
      height: H,
      layers: [
        { type: 'tile', name: 'ground', grid },
        { type: 'objects', name: 'doors', objects: doors },
        { type: 'objects', name: 'spawns', objects: spawns },
        { type: 'objects', name: 'encounters', objects: encounters },
        { type: 'objects', name: 'interactables', objects: interactables }
      ]
    })
  );
}

// ---------------------------------------------------------------------------
// Zone: crystal (current frontier — no forward door yet)
// ---------------------------------------------------------------------------
{
  objectIdSeq = 1;
  const W = 70;
  const H = 34;
  const R = H;
  const grid = emptyGrid(W, H);

  fillRect(grid, 0, R - 3, 14, 3, W, H);

  const spire = [
    [16, R - 6],
    [22, R - 9],
    [16, R - 12],
    [22, R - 15],
    [16, R - 18],
    [22, R - 21],
    [16, R - 24]
  ];
  for (const [x, y] of spire) {
    fillRect(grid, x, y, 4, 1, W, H);
  }

  fillRect(grid, 30, R - 27, W - 30, 3, W, H); // final plateau

  const doors = [doorObject({ col: 0, rowBottom: R - 3, name: 'toForge', targetZone: 'forge', targetSpawn: 'fromEast' })];

  const spawns = [spawnPoint('fromWest', 4, R - 8), spawnPoint('end', W - 10, R - 30)];

  const encounters = [marker('encounter', 'enemy', 22, R - 15), marker('encounter', 'boss', 50, R - 30)];

  const interactables = [marker('interactable', 'lore', 55, R - 30)];

  writeZone(
    'crystal.json',
    buildTiledMap({
      width: W,
      height: H,
      layers: [
        { type: 'tile', name: 'ground', grid },
        { type: 'objects', name: 'doors', objects: doors },
        { type: 'objects', name: 'spawns', objects: spawns },
        { type: 'objects', name: 'encounters', objects: encounters },
        { type: 'objects', name: 'interactables', objects: interactables }
      ]
    })
  );
}
