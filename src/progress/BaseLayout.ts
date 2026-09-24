export interface PlacedDecoration {
  id: string;
  item: string;
  room: 'outside' | 'inside';
  x: number;
  y: number;
  rotation: number;
}

const STORAGE_KEY = 'hollow-roots-base-layout-v2';
const ITEMS = new Set(['planter', 'lantern', 'bench', 'chair', 'rug', 'table']);

/** Treat both local storage and other players' published layouts as untrusted. */
export function sanitizeBaseLayout(input: unknown): PlacedDecoration[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 32).flatMap((value): PlacedDecoration[] => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    if (typeof item.id !== 'string' || !ITEMS.has(String(item.item)) ||
      (item.room !== 'outside' && item.room !== 'inside') ||
      typeof item.x !== 'number' || typeof item.y !== 'number' ||
      !Number.isFinite(item.x) || !Number.isFinite(item.y)) return [];
    return [{
      id: item.id.slice(0, 50),
      item: String(item.item),
      room: item.room,
      x: Math.max(0, Math.min(1536, item.x)),
      y: Math.max(0, Math.min(1024, item.y)),
      rotation: typeof item.rotation === 'number' && Number.isInteger(item.rotation)
        ? ((item.rotation % 4) + 4) % 4 : 0
    }];
  });
}

export function loadBaseLayout(): PlacedDecoration[] {
  try { return sanitizeBaseLayout(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')); }
  catch { return []; }
}

export function saveBaseLayout(layout: PlacedDecoration[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeBaseLayout(layout))); }
  catch { /* Playing continues when browser storage is unavailable. */ }
}

export function clearBaseLayout(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* Nothing to clear. */ }
}
