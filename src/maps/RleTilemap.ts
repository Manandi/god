export type RlePair = [value: number, count: number];

type PackedLayer = {
  data?: number[];
  dataRle?: RlePair[];
  layers?: PackedLayer[];
};

type PackedMap = {
  layers: PackedLayer[];
  [key: string]: unknown;
};

function expandLayer(layer: PackedLayer): void {
  if (Array.isArray(layer.dataRle)) {
    const data: number[] = [];
    for (const pair of layer.dataRle) {
      const value = Number(pair[0]);
      const count = Math.max(0, Number(pair[1]) | 0);
      for (let index = 0; index < count; index += 1) data.push(value);
    }
    layer.data = data;
    delete layer.dataRle;
  }
  for (const child of layer.layers ?? []) expandLayer(child);
}

/** Expands compact authoring data only in memory. The repository keeps long
 * empty tile runs as [value,count] pairs instead of thousands of literal 0s. */
export function expandRleTilemap(source: PackedMap): PackedMap {
  const map = structuredClone(source);
  for (const layer of map.layers ?? []) expandLayer(layer);
  return map;
}
