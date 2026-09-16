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
// collision) along broad ground, so platforms stop reading as one flat
// stamped tile repeated end to end. Skips narrow platforms (a lone prop
// perched on a 3-tile stepping stone reads as clutter, not scenery) and
// keeps a minimum gap between props so they read as placed, not sprayed.
function scatterDecor(grid, width, height, step, kinds, seed) {
  const isSolidAt = (r, c) => r >= 0 && r < height && c >= 0 && c < width && grid[r][c] !== 0;
  const objects = [];
  let lastCol = -Infinity;
  for (let col = 4; col < width - 4; col += step) {
    const jitter = hash(col + seed) % 3;
    const c = Math.min(width - 4, col + jitter);
    if (c - lastCol < Math.max(4, step - 2)) continue;
    const row = findSurfaceRow(grid, c, width, height);
    if (row <= 0) continue;
    if (!isSolidAt(row, c - 2) || !isSolidAt(row, c + 2)) continue; // needs a wide surface either side
    const kind = kinds[hash(col + seed + 97) % kinds.length];
    objects.push(marker('decor', kind, c, row - 1));
    lastCol = c;
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

function regionObject(type, name, col, row, widthCols, heightRows, extra = []) {
  return {
    id: nextObjectId(),
    name,
    type,
    x: col * TILE,
    y: row * TILE,
    width: widthCols * TILE,
    height: heightRows * TILE,
    visible: true,
    properties: extra
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

// Authored terrain profiles. Most walkable area belongs to solid land masses;
// shafts connect surface routes to underpasses instead of floating staircases.
const layouts = [
  {key:'biosphere', title:'THE HOLLOW ROOTS', floor:52,
    profile:[[0,52],[22,52],[28,49],[42,49],[48,46],[65,46],[71,50],[84,50],[90,47],[105,47],[111,43],[130,43],[136,47],[155,47],[161,50],[184,50],[190,46],[208,46],[214,49],[244,49]],
    ridge:[52,28,27], cave:[100,51,58,9], climb:[[48,28,4,24],[79,28,4,25],[96,42,4,20],[158,43,4,19]],
    hazards:[[32,48,4],[144,46,4],[202,45,4]], names:['Waking grove','Hollow roots','Keeper overlook']},
];
for (const [index, layout] of layouts.slice(0, 1).entries()) {
  objectIdSeq = 1;
  const W=244, H=72;
  const grid=emptyGrid(W,H);
  const surfaces=[];
  for(let x=0;x<W;x++){
    const p=layout.profile.findIndex((point,i)=>i<layout.profile.length-1 && x>=point[0] && x<layout.profile[i+1][0]);
    const a=layout.profile[Math.max(0,p)], b=layout.profile[Math.max(0,p)+1];
    const y=Math.round(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));
    surfaces.push(y); fillRect(grid,x,y,1,H-y,W,H);
  }
  const [rx,ry,rw]=layout.ridge;
  fillRect(grid,rx,ry,rw,H-ry,W,H);
  // A spacious traversable arch underneath the ridge. Its ceiling remains
  // ten tiles above the route and the solid supports stay outside the path.
  carve(grid,rx,layout.floor-9,rw,9);
  const [cx,cy,cw,ch]=layout.cave;
  carve(grid,cx,cy,cw,ch);
  for(const [x,y,w,h] of layout.climb) carve(grid,x,y,w,h);
  // Climbing ledges are attached to the shaft's side, never across its mouth.
  const shelves=[[rx,ry,rw],[cx+8,cy+ch-4,9],[cx+cw-17,cy+ch-5,9]];
  for(const [x,y,w] of shelves.slice(1)) fillRect(grid,x,y,w,2,W,H);
  const spawns=[spawnPoint('start',5,surfaces[5]),spawnPoint('fromWest',5,surfaces[5]),spawnPoint('fromEast',W-6,surfaces[W-6])];
  const checkpointCols=[22,104,211];
  const checkpoints=checkpointCols.map((x,i)=>{
    const name='rest'+i;
    spawns.push(spawnPoint(name,x,surfaces[x]-1));
    return marker('checkpoint',name,x,surfaces[x]);
  });
  const encounters=[... [34,91,152,195].map(x=>marker('encounter','turtle',x,surfaces[x]-1)),
    marker('encounter','turtle',rx+12,ry-1),
    marker('encounter','turtle',cx+cw/2,cy+ch-1),
    marker('encounter','turtle-boss',229,surfaces[229]-1)];
  const interactables=[
    marker('interactable','lore',10,surfaces[10]-1,lore(layout.names[0]+'. Hold W or ↑ to climb. Press C to leap away.')),
    marker('interactable','chest',rx+rw-6,ry-1,loot('Overlook relic')),
    marker('interactable','chest',cx+cw-12,cy+ch-6,loot('Buried relic')),
    marker('interactable','lore',216,surfaces[216]-1,lore('The guardian guards the passage. Its amber warning means: prepare to evade.'))
  ];
  const doors=[];
  if(index>0) doors.push(doorObject({col:0,rowBottom:surfaces[0],name:'west',targetZone:layouts[index-1].key,targetSpawn:'fromEast'}));
  if(index<3) doors.push(doorObject({col:W-1,rowBottom:surfaces[W-1],name:'east',targetZone:'rustsea',targetSpawn:'fromWest'}));
  const hazards=layout.hazards.map(([x,y,w],i)=>regionObject('hazard','hazard'+i,x,y,w,1));
  const climbables=layout.climb.map(([x,y,w,h],i)=>regionObject('climbable','shaft'+i,x,y,w,h));
  const regions=[marker('region',layout.names[0],5,surfaces[5]-6),marker('region',layout.names[1],108,surfaces[108]-6),marker('region',layout.names[2],210,surfaces[210]-6)];
  writeZone(layout.key+'.json',buildTiledMap({width:W,height:H,zoneKey:layout.key,layers:[
    {type:'tile',name:'ground',grid:classifyTiles(grid,W,H)},
    ...Object.entries({doors,spawns,encounters,interactables,climbables,hazards,checkpoints,regions,decor:[]}).map(([name,objects])=>({type:'objects',name,objects}))
  ]}));
}

// ---------------------------------------------------------------------------
// Zone: rustsea
// ---------------------------------------------------------------------------
{
  objectIdSeq = 1;
  const W = 160;
  const H = 34;
  const R = H;
  const grid = emptyGrid(W, H);

  fillRect(grid, 0, R - 3, W, 3, W, H);
  carve(grid, 25, R - 3, 6, 2); // wide gap right out of the gate

  fillRect(grid, 40, R - 6, 9, 2, W, H);
  fillRect(grid, 54, R - 10, 9, 2, W, H);
  fillRect(grid, 68, R - 6, 9, 2, W, H);

  // Tide terraces: alternating step heights instead of one flat run.
  carve(grid, 90, R - 3, 39, 2);
  fillRect(grid, 90, R - 6, 8, 2, W, H);
  fillRect(grid, 106, R - 9, 8, 2, W, H);
  fillRect(grid, 122, R - 6, 8, 2, W, H);
  fillRect(grid, 130, R - 3, 4, 3, W, H); // rejoins full floor height

  carve(grid, 140, R - 3, 5, 2); // late gap before the boss arena

  const decor = scatterDecor(grid, W, H, 10, ['rock', 'cactus', 'fence_broken'], 23);

  const doors = [
    doorObject({ col: 0, rowBottom: R - 3, name: 'toBiosphere', targetZone: 'biosphere', targetSpawn: 'fromEast' }),
    doorObject({ col: W - 1, rowBottom: R - 3, name: 'toForge', targetZone: 'forge', targetSpawn: 'fromWest' })
  ];

  const spawns = [spawnPoint('fromWest', 6, R - 8), spawnPoint('fromEast', W - 6, R - 8)];

  const encounters = [
    markerOnSurface(grid, W, H, 'encounter', 'enemy', 34),
    markerOnSurface(grid, W, H, 'encounter', 'enemy', 44),
    markerOnSurface(grid, W, H, 'encounter', 'enemy', 72),
    markerOnSurface(grid, W, H, 'encounter', 'enemy', 110),
    markerOnSurface(grid, W, H, 'encounter', 'boss', 150)
  ];

  const interactables = [
    markerOnSurface(grid, W, H, 'interactable', 'lore', 10, lore('The sea rusted first, then the machines that watched it.')),
    markerOnSurface(grid, W, H, 'interactable', 'chest', 58, loot('Corroded Gear Fragment')),
    markerOnSurface(grid, W, H, 'interactable', 'lore', 94, lore('High-tide marks are scored into the terrace, a decade apart.')),
    markerOnSurface(grid, W, H, 'interactable', 'chest', 134, loot('Salt-Etched Locket'))
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
  const WIDE_INDICES = new Set([2, 4, 9]); // these get a patrolling enemy — give it real room
  const chimneyPlatforms = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const y = R - 7 - i * 4;
    if (i === MID_REST_INDEX) {
      fillRect(grid, 2, y, 18, 2, W, H);
      chimneyPlatforms.push({ x: 10, y, rest: true });
    } else {
      const x = i % 2 === 0 ? 8 : 2;
      const width = WIDE_INDICES.has(i) ? 9 : 5;
      fillRect(grid, x, y, width, 2, W, H);
      chimneyPlatforms.push({ x, y, rest: false });
    }
  }
  const topSegment = chimneyPlatforms[SEGMENTS - 1];
  const landingTopRow = topSegment.y - 4;

  // Top landing leading right to the exit.
  fillRect(grid, 2, landingTopRow, W - 2, 3, W, H);

  const decor = scatterDecor(grid, W, H, 8, ['rock', 'chain', 'torch_on_a', 'torch_on_b'], 37);

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

  // Spire climb: asymmetric jutting platforms, narrower every third segment
  // — except where a patrolling enemy stands, which gets real room instead.
  const SEGMENTS = 13;
  const WIDE_INDICES = new Set([3, 7]);
  const spirePlatforms = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const x = i % 2 === 0 ? 16 : 22;
    const y = R - 6 - i * 3;
    const w = WIDE_INDICES.has(i) ? 8 : i % 3 === 2 ? 3 : 4;
    fillRect(grid, x, y, w, 2, W, H);
    spirePlatforms.push({ x, y, w });
  }
  const topSpire = spirePlatforms[SEGMENTS - 1];
  const plateauTopRow = topSpire.y - 4;

  fillRect(grid, 40, plateauTopRow, W - 40, 3, W, H); // final plateau

  const decor = scatterDecor(grid, W, H, 8, ['gem_green', 'gem_red', 'gem_yellow', 'rock'], 59);

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
