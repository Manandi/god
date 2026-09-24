export type BaseRoom = 'outside' | 'inside';
export interface GroundRect { x: number; y: number; width: number; height: number }

export const HOME_DOOR = { x: 435, y: 280 };
export const HOME_EXIT = { x: 768, y: 815 };
export const WORLD_BRIDGE = { x: 188, y: 682 };

const obstacles: GroundRect[] = [
  { x: 0, y: 0, width: 330, height: 388 }, // upper cliff and trees
  { x: 275, y: 0, width: 370, height: 262 }, // cottage and roots
  { x: 560, y: 0, width: 157, height: 271 }, // trunk beside the cottage
  { x: 272, y: 350, width: 188, height: 220 }, // raised stone bank and its dense shrubs
  { x: 821, y: 285, width: 270, height: 29 }, // garden fence
  { x: 1160, y: 192, width: 376, height: 355 }, // pond and shore
  { x: 1085, y: 387, width: 82, height: 115 }, // waterfront rocks
  { x: 525, y: 514, width: 161, height: 69 }, // terrace wall, left of stairs
  { x: 785, y: 515, width: 208, height: 49 }, // terrace wall, right of stairs
  { x: 469, y: 697, width: 200, height: 35 }, // lower garden fence
  { x: 791, y: 715, width: 236, height: 38 }
];

function contains(rect: GroundRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function inBridgePath(x: number, y: number): boolean {
  // The southwest bridge is outside the island oval. This tapered corridor
  // connects its landing to the west glade instead of making an invisible wall.
  const polygon = [[104, 456], [257, 468], [340, 569], [295, 626], [271, 677], [182, 755], [105, 722], [143, 621]];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function walkablePoint(room: BaseRoom, x: number, y: number): boolean {
  if (room === 'inside') {
    return x >= 105 && x <= 1430 && y >= 335 && y <= 835;
  }
  const nx = (x - 760) / 645, ny = (y - 479) / 330;
  if (nx * nx + ny * ny > 1 && !inBridgePath(x, y)) return false;
  if (y > 768 && !inBridgePath(x, y)) return false;
  return !obstacles.some(rect => contains(rect, x, y));
}

/** The avatar's feet have a small footprint; every edge of it must be clear. */
export function canWalkTerrain(room: BaseRoom, x: number, y: number, radius = 8): boolean {
  return [[0, 0], [-radius, 0], [radius, 0], [0, -radius], [0, radius]]
    .every(([dx, dy]) => walkablePoint(room, x + dx, y + dy));
}

const outdoorPlots: GroundRect[] = [
  { x: 840, y: 157, width: 240, height: 114 }, // fenced garden
  { x: 830, y: 352, width: 195, height: 124 }, // central lawn
  { x: 575, y: 594, width: 410, height: 92 }, // lower yard
  { x: 127, y: 425, width: 125, height: 122 } // western glade
];
const indoorFloor: GroundRect = { x: 170, y: 365, width: 1195, height: 391 };

/** Build space is intentionally smaller than walking space: keep paths open. */
export function canBuildFootprint(room: BaseRoom, bounds: GroundRect): boolean {
  const plots = room === 'inside' ? [indoorFloor] : outdoorPlots;
  const fitsPlot = plots.some(plot => contains(plot, bounds.x, bounds.y) &&
    contains(plot, bounds.x + bounds.width, bounds.y + bounds.height));
  if (!fitsPlot) return false;
  const corners = [[bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y],
    [bounds.x, bounds.y + bounds.height], [bounds.x + bounds.width, bounds.y + bounds.height]];
  return corners.every(([x, y]) => walkablePoint(room, x, y));
}

export function intersects(a: GroundRect, b: GroundRect, padding = 0): boolean {
  return a.x < b.x + b.width + padding && a.x + a.width + padding > b.x &&
    a.y < b.y + b.height + padding && a.y + a.height + padding > b.y;
}
