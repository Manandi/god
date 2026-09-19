import { CollectedItems } from './CollectedItems';
import {
  calculateStats,
  DEFAULT_APPEARANCE,
  DEFAULT_INPUTS,
  DEFAULT_STAT_XP,
  PlayerProgress,
  recalculateLevel,
  type ActivityEntry,
  type CharacterAppearance,
  type CharacterStats,
  type LifeInputs,
  type StatKey
} from './PlayerProgress';

const STORAGE_KEY = 'hollow-roots-save-v1';

interface SaveSnapshot {
  version: 3;
  updatedAt: string;
  profileCompleted: boolean;
  inputs: LifeInputs;
  statXp: Record<StatKey, number>;
  stats: CharacterStats;
  activities: ActivityEntry[];
  claimedWeeklyGoals: string[];
  appearance: CharacterAppearance;
  progress: {
    level: number;
    totalXp: number;
    currentZone: string;
    currentSpawn: string;
    guardianDefeated: boolean;
    collectedItems: string[];
  };
}

let autosaveInstalled = false;

function finite(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function sanitizeInputs(value: Record<string, unknown> | undefined): LifeInputs {
  return {
    pushups: finite(value?.pushups, DEFAULT_INPUTS.pushups, 0, 200),
    sprintSeconds: finite(value?.sprintSeconds, DEFAULT_INPUTS.sprintSeconds, 8, 60),
    mileSeconds: finite(value?.mileSeconds, DEFAULT_INPUTS.mileSeconds, 240, 1800),
    plankSeconds: finite(value?.plankSeconds, DEFAULT_INPUTS.plankSeconds, 0, 600),
    iqScore: finite(value?.iqScore, DEFAULT_INPUTS.iqScore, 55, 160),
    focusMinutes: finite(value?.focusMinutes, DEFAULT_INPUTS.focusMinutes, 0, 480),
    habitStreak: finite(value?.habitStreak, DEFAULT_INPUTS.habitStreak, 0, 3650)
  };
}

function sanitizeStatXp(value: Partial<Record<StatKey, unknown>> | undefined): Record<StatKey, number> {
  return Object.fromEntries((Object.keys(DEFAULT_STAT_XP) as StatKey[]).map(key => [
    key,
    finite(value?.[key], 0, 0, 1000000)
  ])) as Record<StatKey, number>;
}

function sanitizeAppearance(value: Partial<CharacterAppearance> | undefined): CharacterAppearance {
  const cloak = ['moss', 'sunroot', 'moonfern', 'guardian'].includes(String(value?.cloak))
    ? value!.cloak as CharacterAppearance['cloak'] : DEFAULT_APPEARANCE.cloak;
  const hair = ['raven', 'earth', 'silver'].includes(String(value?.hair))
    ? value!.hair as CharacterAppearance['hair'] : DEFAULT_APPEARANCE.hair;
  return { skinIndex: Math.round(finite(value?.skinIndex, DEFAULT_APPEARANCE.skinIndex, 0, 4)), cloak, hair };
}

export const GameSave = {
  load(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw) as Partial<SaveSnapshot> & { inputs?: Record<string, unknown> };
      const inputs = sanitizeInputs(saved.inputs);
      const statXp = sanitizeStatXp(saved.statXp);
      PlayerProgress.profileCompleted = saved.profileCompleted === true;
      PlayerProgress.inputs = inputs;
      PlayerProgress.statXp = statXp;
      PlayerProgress.stats = calculateStats(inputs, statXp);
      PlayerProgress.activities = Array.isArray(saved.activities)
        ? saved.activities.filter(entry => entry && typeof entry.date === 'string' && typeof entry.kind === 'string').slice(-180)
        : [];
      PlayerProgress.claimedWeeklyGoals = Array.isArray(saved.claimedWeeklyGoals)
        ? saved.claimedWeeklyGoals.filter(value => typeof value === 'string').slice(-32)
        : [];
      PlayerProgress.appearance = sanitizeAppearance(saved.appearance);
      PlayerProgress.totalXp = finite(saved.progress?.totalXp, 0, 0, 100000000);
      recalculateLevel();
      PlayerProgress.currentZone = saved.progress?.currentZone || 'biosphere';
      PlayerProgress.currentSpawn = saved.progress?.currentSpawn || 'start';
      PlayerProgress.guardianDefeated = saved.progress?.guardianDefeated === true;
      CollectedItems.clear();
      for (const id of saved.progress?.collectedItems ?? []) if (typeof id === 'string') CollectedItems.add(id);
      return true;
    } catch {
      return false;
    }
  },

  save(): void {
    const snapshot: SaveSnapshot = {
      version: 3,
      updatedAt: new Date().toISOString(),
      profileCompleted: PlayerProgress.profileCompleted,
      inputs: { ...PlayerProgress.inputs },
      statXp: { ...PlayerProgress.statXp },
      stats: { ...PlayerProgress.stats },
      activities: [...PlayerProgress.activities],
      claimedWeeklyGoals: [...PlayerProgress.claimedWeeklyGoals],
      appearance: { ...PlayerProgress.appearance },
      progress: {
        level: PlayerProgress.level,
        totalXp: PlayerProgress.totalXp,
        currentZone: PlayerProgress.currentZone,
        currentSpawn: PlayerProgress.currentSpawn,
        guardianDefeated: PlayerProgress.guardianDefeated,
        collectedItems: [...CollectedItems]
      }
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch { /* Gameplay continues without storage. */ }
  },

  startNewJourney(): void {
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
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.save(); });
  },

  updatedAt(): string | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<SaveSnapshot>;
      return typeof value.updatedAt === 'string' ? value.updatedAt : null;
    } catch { return null; }
  }
};
