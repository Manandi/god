import { CollectedItems } from './CollectedItems';
import {
  applyInactivityDecay,
  calculateStats,
  DEFAULT_APPEARANCE,
  DEFAULT_INPUTS,
  DEFAULT_STAT_XP,
  INPUT_BOUNDS,
  localeUnitSystem,
  PlayerProgress,
  recalculateLevel,
  type ActivityEntry,
  type CharacterAppearance,
  type CharacterStats,
  type LifeInputs,
  type StatKey,
  type UnitSystem
} from './PlayerProgress';

const STORAGE_KEY = 'hollow-roots-save-v1';

interface SaveSnapshot {
  version: 6;
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
  decayApplied: number;
  iqTakenAt: string;
  unitSystem: UnitSystem;
  lastCheckInWeek: string;
  profileCreatedAt: string;
}

let autosaveInstalled = false;

function finite(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function sanitizeInputs(value: Record<string, unknown> | undefined): LifeInputs {
  return Object.fromEntries((Object.keys(DEFAULT_INPUTS) as Array<keyof LifeInputs>).map(key => {
    const [min, max] = INPUT_BOUNDS[key];
    return [key, finite(value?.[key], DEFAULT_INPUTS[key], min, max)];
  })) as unknown as LifeInputs;
}

function sanitizeStatXp(value: Partial<Record<StatKey, unknown>> | undefined): Record<StatKey, number> {
  return Object.fromEntries((Object.keys(DEFAULT_STAT_XP) as StatKey[]).map(key => [
    key,
    // The floor is negative: decay drives stat XP below zero, and clamping it
    // at zero here would refund every lapse on the next page load.
    finite(value?.[key], 0, -1000000, 1000000)
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
      PlayerProgress.activities = Array.isArray(saved.activities)
        ? saved.activities.filter(entry => entry && typeof entry.date === 'string' && typeof entry.kind === 'string').slice(-180)
        : [];
      PlayerProgress.stats = calculateStats(inputs, statXp, PlayerProgress.activities);
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
      PlayerProgress.decayApplied = finite(saved.decayApplied, 0, 0, 10000000);
      PlayerProgress.iqTakenAt = typeof saved.iqTakenAt === 'string' ? saved.iqTakenAt : '';
      PlayerProgress.unitSystem = saved.unitSystem === 'imperial' || saved.unitSystem === 'metric' ? saved.unitSystem : localeUnitSystem();
      PlayerProgress.lastCheckInWeek = typeof saved.lastCheckInWeek === 'string' ? saved.lastCheckInWeek : '';
      PlayerProgress.profileCreatedAt = typeof saved.profileCreatedAt === 'string' ? saved.profileCreatedAt : '';
      // Charge any lapse that happened while the game was closed.
      applyInactivityDecay();
      return true;
    } catch {
      return false;
    }
  },

  save(): void {
    const snapshot: SaveSnapshot = {
      version: 6,
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
      },
      decayApplied: PlayerProgress.decayApplied,
      iqTakenAt: PlayerProgress.iqTakenAt,
      unitSystem: PlayerProgress.unitSystem,
      lastCheckInWeek: PlayerProgress.lastCheckInWeek,
      profileCreatedAt: PlayerProgress.profileCreatedAt
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch { /* Gameplay continues without storage. */ }
  },

  /** Wipes the stored save and returns everything to a first-run state, so the
   * next load starts at Mycel's intro with no history behind it. */
  reset(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Nothing stored to clear. */ }
    PlayerProgress.level = 1;
    PlayerProgress.totalXp = 0;
    PlayerProgress.profileCompleted = false;
    PlayerProgress.inputs = { ...DEFAULT_INPUTS };
    PlayerProgress.statXp = { ...DEFAULT_STAT_XP };
    PlayerProgress.activities = [];
    PlayerProgress.stats = calculateStats(PlayerProgress.inputs, PlayerProgress.statXp, []);
    PlayerProgress.claimedWeeklyGoals = [];
    PlayerProgress.appearance = { ...DEFAULT_APPEARANCE };
    PlayerProgress.currentZone = 'biosphere';
    PlayerProgress.currentSpawn = 'start';
    PlayerProgress.guardianDefeated = false;
    PlayerProgress.decayApplied = 0;
    PlayerProgress.iqTakenAt = '';
    PlayerProgress.lastCheckInWeek = '';
    PlayerProgress.profileCreatedAt = '';
    CollectedItems.clear();
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
