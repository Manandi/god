export interface BackgroundLayerConfig {
  color: number;
  scrollFactor: number;
}

export interface ZoneConfig {
  key: string;
  mapPath: string;
  tileAccent: number;
  backgroundLayers: BackgroundLayerConfig[];
}

export const ZONES: Record<string, ZoneConfig> = {
  biosphere: {
    key: 'biosphere',
    mapPath: 'maps/biosphere.json',
    tileAccent: 0x2f8f5c,
    backgroundLayers: [
      { color: 0x0d1f16, scrollFactor: 0.2 },
      { color: 0x14331f, scrollFactor: 0.5 }
    ]
  },
  rustsea: {
    key: 'rustsea',
    mapPath: 'maps/rustsea.json',
    tileAccent: 0x8f4f2f,
    backgroundLayers: [
      { color: 0x231209, scrollFactor: 0.2 },
      { color: 0x3a2013, scrollFactor: 0.5 }
    ]
  },
  forge: {
    key: 'forge',
    mapPath: 'maps/forge.json',
    tileAccent: 0x8f2f2f,
    backgroundLayers: [
      { color: 0x230a0a, scrollFactor: 0.2 },
      { color: 0x3a1414, scrollFactor: 0.5 }
    ]
  },
  crystal: {
    key: 'crystal',
    mapPath: 'maps/crystal.json',
    tileAccent: 0x6f5fbf,
    backgroundLayers: [
      { color: 0x140f28, scrollFactor: 0.2 },
      { color: 0x241c40, scrollFactor: 0.5 }
    ]
  }
};

export const FIRST_ZONE = 'biosphere';
export const FIRST_SPAWN = 'start';
