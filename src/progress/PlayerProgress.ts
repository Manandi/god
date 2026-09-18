export interface LifeInputs {
  pushups: number;
  pullups: number;
  balanceSeconds: number;
  coordinationDays: number;
  cardioMinutes: number;
  continuousMinutes: number;
  learningHours: number;
  learningDays: number;
  reflectionDays: number;
  detailRating: number;
  habitStreak: number;
  followThroughRating: number;
}

export interface CharacterStats {
  strength: number;
  dexterity: number;
  stamina: number;
  intelligence: number;
  insight: number;
  resolve: number;
}

export type CloakId = 'moss' | 'sunroot' | 'moonfern' | 'guardian';
export type HairId = 'raven' | 'earth' | 'silver';

export interface CharacterAppearance {
  skinIndex: number;
  cloak: CloakId;
  hair: HairId;
}

export const DEFAULT_INPUTS: LifeInputs = {
  pushups: 10,
  pullups: 0,
  balanceSeconds: 20,
  coordinationDays: 2,
  cardioMinutes: 60,
  continuousMinutes: 15,
  learningHours: 5,
  learningDays: 4,
  reflectionDays: 2,
  detailRating: 3,
  habitStreak: 7,
  followThroughRating: 3
};

export const DEFAULT_STATS: CharacterStats = {
  strength: 10,
  dexterity: 10,
  stamina: 10,
  intelligence: 10,
  insight: 10,
  resolve: 10
};

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  skinIndex: 1,
  cloak: 'moss',
  hair: 'raven'
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const ability = (value: number): number => Math.round(8 + clamp01(value) * 10);

/** Converts current habits and simple physical benchmarks into 8–18 RPG
 * abilities. Intelligence represents learning practice, not innate IQ. */
export function calculateStats(input: LifeInputs): CharacterStats {
  return {
    strength: ability(clamp01(input.pushups / 40) * 0.62 + clamp01(input.pullups / 12) * 0.38),
    dexterity: ability(clamp01(input.balanceSeconds / 60) * 0.55 + clamp01(input.coordinationDays / 5) * 0.45),
    stamina: ability(clamp01(input.cardioMinutes / 150) * 0.58 + clamp01(input.continuousMinutes / 45) * 0.42),
    intelligence: ability(clamp01(input.learningHours / 10) * 0.62 + clamp01(input.learningDays / 7) * 0.38),
    insight: ability(clamp01(input.reflectionDays / 7) * 0.52 + clamp01((input.detailRating - 1) / 4) * 0.48),
    resolve: ability(clamp01(input.habitStreak / 30) * 0.55 + clamp01((input.followThroughRating - 1) / 4) * 0.45)
  };
}

export const PlayerProgress: {
  level: number;
  profileCompleted: boolean;
  inputs: LifeInputs;
  stats: CharacterStats;
  appearance: CharacterAppearance;
  currentZone: string;
  currentSpawn: string;
  guardianDefeated: boolean;
} = {
  level: 1,
  profileCompleted: false,
  inputs: { ...DEFAULT_INPUTS },
  stats: { ...DEFAULT_STATS },
  appearance: { ...DEFAULT_APPEARANCE },
  currentZone: 'biosphere',
  currentSpawn: 'start',
  guardianDefeated: false
};

export function totalStats(stats: CharacterStats = PlayerProgress.stats): number {
  return Object.values(stats).reduce((sum, value) => sum + value, 0);
}
