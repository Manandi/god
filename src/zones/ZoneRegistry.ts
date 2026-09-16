export interface ZoneConfig {
  key: string;
  mapPath: string;
  tilesetPath: string;
  backgroundPath: string;
  backgroundTintFar: number;
  backgroundTintNear: number;
  /** Optional single large painted scene, shown once (not tiled) instead of
   * the tinted repeating backgroundPath — for real hand-painted key art. */
  heroBackgroundPath?: string;
}

export const ZONES: Record<string, ZoneConfig> = {
  biosphere: {
    key: 'biosphere',
    mapPath: 'maps/biosphere.json',
    tilesetPath: 'tilesets/biosphere.png',
    backgroundPath: 'backgrounds/biosphere.png',
    backgroundTintFar: 0x1b3a2a,
    backgroundTintNear: 0x2f6b47,
    heroBackgroundPath: 'backgrounds/biosphere-panorama-hero.jpg'
  },
  rustsea: {
    key: 'rustsea',
    mapPath: 'maps/rustsea.json',
    tilesetPath: 'tilesets/rustsea.png',
    backgroundPath: 'backgrounds/rustsea.png',
    backgroundTintFar: 0x3a2013,
    backgroundTintNear: 0x8f4f2f
  },
  forge: {
    key: 'forge',
    mapPath: 'maps/forge.json',
    tilesetPath: 'tilesets/forge.png',
    backgroundPath: 'backgrounds/forge.png',
    backgroundTintFar: 0x2a0d0d,
    backgroundTintNear: 0x8f2f2f
  },
  crystal: {
    key: 'crystal',
    mapPath: 'maps/crystal.json',
    tilesetPath: 'tilesets/crystal.png',
    backgroundPath: 'backgrounds/crystal.png',
    backgroundTintFar: 0x241c40,
    backgroundTintNear: 0x6f5fbf
  }
};

export const FIRST_ZONE = 'biosphere';
export const FIRST_SPAWN = 'start';
