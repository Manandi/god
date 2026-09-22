import { CollectedItems } from '../progress/CollectedItems';
import { GameSave } from '../progress/GameSave';
import {
  applyInactivityDecay,
  calculateStats,
  currentWeekKey,
  DEFAULT_INPUTS,
  DEFAULT_STAT_XP,
  PlayerProgress,
  recalculateLevel,
  type LifeInputs
} from '../progress/PlayerProgress';

const FLAG_KEY = 'hollow-roots-dev';

export type DevPreset = 'beginner' | 'average' | 'athlete';

/** Baselines that land near the bottom, middle and top of the 1-20 scale, so
 * every screen can be checked against a plausible profile without sitting
 * through the assessment. */
const PRESETS: Record<DevPreset, LifeInputs> = {
  beginner: {
    pushups: 3, pullups: 0, dashSeconds: 7.2, verticalJumpCm: 16,
    mileSeconds: 870, restingHeartRate: 86, plankSeconds: 18,
    benchPressKg: 15, sleepHours: 5, iqScore: 84
  },
  average: { ...DEFAULT_INPUTS },
  athlete: {
    pushups: 62, pullups: 23, dashSeconds: 4.4, verticalJumpCm: 71,
    mileSeconds: 355, restingHeartRate: 44, plankSeconds: 310,
    benchPressKg: 132, sleepHours: 8, iqScore: 134
  }
};

function today(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date.toISOString().slice(0, 10);
}

/** Developer tooling, off unless explicitly switched on. Nothing here runs or
 * renders for an ordinary player. */
export const DevMode = {
  enabled: false,

  /** Ctrl+Shift+D toggles it, ?dev in the URL forces it on, and the choice
   * persists so a reload does not drop back out of it. */
  init(): void {
    try {
      const forced = new URLSearchParams(location.search).has('dev');
      this.enabled = forced || localStorage.getItem(FLAG_KEY) === 'on';
      if (forced) localStorage.setItem(FLAG_KEY, 'on');
    } catch {
      this.enabled = false;
    }
  },

  toggle(): boolean {
    this.enabled = !this.enabled;
    try { localStorage.setItem(FLAG_KEY, this.enabled ? 'on' : 'off'); } catch { /* Fine without storage. */ }
    return this.enabled;
  },

  /** Drops a finished profile in place so the menu, game and weekly screens
   * are reachable without answering anything. */
  seedProfile(preset: DevPreset): void {
    PlayerProgress.inputs = { ...PRESETS[preset] };
    PlayerProgress.statXp = { ...DEFAULT_STAT_XP };
    PlayerProgress.activities = [];
    PlayerProgress.claimedWeeklyGoals = [];
    PlayerProgress.profileCompleted = true;
    PlayerProgress.profileCreatedAt = today();
    PlayerProgress.lastCheckInWeek = currentWeekKey();
    PlayerProgress.iqTakenAt = today();
    PlayerProgress.decayApplied = 0;
    PlayerProgress.totalXp = 0;
    PlayerProgress.stats = calculateStats(PlayerProgress.inputs, PlayerProgress.statXp, []);
    recalculateLevel();
    GameSave.save();
  },

  /** Backdates the profile so decay has something to charge for. Decay is
   * normally unobservable in one sitting, since it needs days of silence. */
  simulateIdleDays(days: number): number {
    const span = Math.max(0, Math.round(days));
    PlayerProgress.activities = [];
    PlayerProgress.profileCreatedAt = today(span);
    PlayerProgress.decayApplied = 0;
    const lost = applyInactivityDecay();
    GameSave.save();
    return lost;
  },

  /** Makes Mycel's reckoning due on the next title load. */
  forceCheckIn(): void {
    PlayerProgress.lastCheckInWeek = 'dev-forced';
    GameSave.save();
  },

  wipe(): void {
    GameSave.reset();
    CollectedItems.clear();
  }
};
