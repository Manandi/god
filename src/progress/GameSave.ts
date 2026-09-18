import { CollectedItems } from './CollectedItems';
import {
  calculateStats,
  DEFAULT_APPEARANCE,
  DEFAULT_INPUTS,
  PlayerProgress,
  type CharacterAppearance,
  type CharacterStats,
  type LifeInputs
} from './PlayerProgress';

const STORAGE_KEY = 'hollow-roots-save-v1';

interface SaveSnapshot {
  version: 1;
  updatedAt: string;
  profileCompleted: boolean;
  inputs: LifeInputs;
  stats: CharacterStats;
  appearance: CharacterAppearance;
  progress: {
    level: number;
    currentZone: string;
    currentSpawn: string;
    guardianDefeated: boolean;
    collectedItems: string[];
  };
}

let autosaveInstalled = false;

function finite(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function sanitizeInputs(value: Partial<LifeInputs> | undefined): LifeInputs {
  return {
    pushups: finite(value?.pushups, DEFAULT_INPUTS.pushups, 0, 200),
    pullups: finite(value?.pullups, DEFAULT_INPUTS.pullups, 0, 100),
    balanceSeconds: finite(value?.balanceSeconds, DEFAULT_INPUTS.balanceSeconds, 0, 300),
    coordinationDays: finite(value?.coordinationDays, DEFAULT_INPUTS.coordinationDays, 0, 7),
    cardioMinutes: finite(value?.cardioMinutes, DEFAULT_INPUTS.cardioMinutes, 0, 1000),
    continuousMinutes: finite(value?.continuousMinutes, DEFAULT_INPUTS.continuousMinutes, 0, 300),
    learningHours: finite(value?.learningHours, DEFAULT_INPUTS.learningHours, 0, 100),
    learningDays: finite(value?.learningDays, DEFAULT_INPUTS.learningDays, 0, 7),
    reflectionDays: finite(value?.reflectionDays, DEFAULT_INPUTS.reflectionDays, 0, 7),
    detailRating: finite(value?.detailRating, DEFAULT_INPUTS.detailRating, 1, 5),
    habitStreak: finite(value?.habitStreak, DEFAULT_INPUTS.habitStreak, 0, 3650),
    followThroughRating: finite(value?.followThroughRating, DEFAULT_INPUTS.followThroughRating, 1, 5)
  };
}

function sanitizeAppearance(value: Partial<CharacterAppearance> | undefined): CharacterAppearance {
  const cloak = ['moss', 'sunroot', 'moonfern', 'guardian'].includes(String(value?.cloak))
    ? value!.cloak as CharacterAppearance['cloak']
    : DEFAULT_APPEARANCE.cloak;
  const hair = ['raven', 'earth', 'silver'].includes(String(value?.hair))
    ? value!.hair as CharacterAppearance['hair']
    : DEFAULT_APPEARANCE.hair;
  return {
    skinIndex: Math.round(finite(value?.skinIndex, DEFAULT_APPEARANCE.skinIndex, 0, 4)),
    cloak,
    hair
  };
}

export const GameSave = {
  load(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw) as Partial<SaveSnapshot>;
      const inputs = sanitizeInputs(saved.inputs);
      PlayerProgress.profileCompleted = saved.profileCompleted === true;
      PlayerProgress.inputs = inputs;
      PlayerProgress.stats = calculateStats(inputs);
      PlayerProgress.appearance = sanitizeAppearance(saved.appearance);
      PlayerProgress.level = Math.max(1, Math.round(finite(saved.progress?.level, 1, 1, 99)));
      PlayerProgress.currentZone = saved.progress?.currentZone || 'biosphere';
      PlayerProgress.currentSpawn = saved.progress?.currentSpawn || 'start';
      PlayerProgress.guardianDefeated = saved.progress?.guardianDefeated === true;
      CollectedItems.clear();
      for (const id of saved.progress?.collectedItems ?? []) {
        if (typeof id === 'string') CollectedItems.add(id);
      }
      return true;
    } catch {
      return false;
    }
  },

  save(): void {
    const snapshot: SaveSnapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      profileCompleted: PlayerProgress.profileCompleted,
      inputs: { ...PlayerProgress.inputs },
      stats: { ...PlayerProgress.stats },
      appearance: { ...PlayerProgress.appearance },
      progress: {
        level: PlayerProgress.level,
        currentZone: PlayerProgress.currentZone,
        currentSpawn: PlayerProgress.currentSpawn,
        guardianDefeated: PlayerProgress.guardianDefeated,
        collectedItems: [...CollectedItems]
      }
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Storage can be unavailable in private browsing; gameplay continues.
    }
  },

  startNewJourney(): void {
    PlayerProgress.level = 1;
    PlayerProgress.currentZone = 'biosphere';
    PlayerProgress.currentSpawn = 'start';
    PlayerProgress.guardianDefeated = false;
    CollectedItems.clear();
    this.save();
  },

  installAutosave(): void {
    if (autosaveInstalled) return;
    autosaveInstalled = true;
    window.addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.save();
    });
  },

  updatedAt(): string | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<SaveSnapshot>;
      return typeof value.updatedAt === 'string' ? value.updatedAt : null;
    } catch {
      return null;
    }
  }
};
