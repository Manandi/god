export interface BiomeDefinition {
  id: string;
  title: string;
  subtitle: string;
  zoneKey: string;
  requiredLevel: number;
  color: number;
  marker: { x: number; y: number };
  mobs: string;
  boss: string;
}

export const BIOMES: BiomeDefinition[] = [
  { id: 'grove', title: 'THE VERDANT REACH', subtitle: 'Ancient roots and drowned temples', zoneKey: 'biosphere', requiredLevel: 1, color: 0x9fe27d, marker: { x: -126, y: 58 }, mobs: 'Shellbacks · Thornlings', boss: 'Verdant Guardian' },
  { id: 'frost', title: 'THE FROSTBOUND CROWN', subtitle: 'Glacial lakes beneath crystal peaks', zoneKey: 'rustsea', requiredLevel: 5, color: 0x8fddff, marker: { x: -18, y: -132 }, mobs: 'Rime Hares · Icebound Sentinels', boss: 'The White Maw' },
  { id: 'ember', title: 'THE EMBER WASTES', subtitle: 'Black citadels divided by living fire', zoneKey: 'forge', requiredLevel: 10, color: 0xff874f, marker: { x: 132, y: -24 }, mobs: 'Cinder Hounds · Ash Knights', boss: 'Pyreback Colossus' },
  { id: 'wraith', title: 'WRAITHMOOR', subtitle: 'A violet ruin where the dead still wander', zoneKey: 'crystal', requiredLevel: 15, color: 0xc995ff, marker: { x: 48, y: 132 }, mobs: 'Lantern Wraiths · Hollow Knights', boss: 'The Veiled Queen' }
];

export function biomeForZone(zoneKey: string): BiomeDefinition {
  return BIOMES.find(biome => biome.zoneKey === zoneKey) ?? BIOMES[0];
}
