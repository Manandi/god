export interface LifeInputs {
  pushups: number;
  pullups: number;
  dashSeconds: number;
  verticalJumpCm: number;
  mileSeconds: number;
  restingHeartRate: number;
  plankSeconds: number;
  benchPressKg: number;
  sleepHours: number;
  iqScore: number;
}

export interface CharacterStats {
  strength: number;
  speed: number;
  stamina: number;
  defense: number;
  intelligence: number;
  discipline: number;
}

export type StatKey = keyof CharacterStats;
export type ActivityKind = 'workout' | 'steps' | 'run' | 'study' | 'focus' | 'goal';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  date: string;
  amount: number;
  xp: number;
  note?: string;
}

export type CloakId = 'moss' | 'sunroot' | 'moonfern' | 'guardian';
export type HairId = 'raven' | 'earth' | 'silver';

export interface CharacterAppearance {
  skinIndex: number;
  cloak: CloakId;
  hair: HairId;
}

/** Each metric's value at 1, 5, 10, 15 and 20 points. Descending rows are
 * metrics where lower is better. DEFAULT_INPUTS sits on the 10 anchor, so an
 * untouched profile reads as dead average. */
export const STAT_ANCHORS = {
  pushups: [0, 5, 15, 35, 60],
  pullups: [0, 1, 5, 12, 22],
  dashSeconds: [7.5, 6.3, 5.5, 4.9, 4.4],
  verticalJumpCm: [10, 25, 40, 55, 70],
  mileSeconds: [900, 720, 600, 480, 360],
  restingHeartRate: [90, 78, 68, 58, 45],
  plankSeconds: [10, 40, 90, 180, 300],
  benchPressKg: [10, 35, 60, 90, 130],
  sleepHours: [4, 5.5, 7, 8, 8.5],
  iqScore: [70, 90, 100, 115, 135]
} as const satisfies Record<keyof LifeInputs, readonly number[]>;

export const INPUT_BOUNDS = {
  pushups: [0, 300],
  pullups: [0, 100],
  dashSeconds: [3.5, 20],
  verticalJumpCm: [0, 150],
  mileSeconds: [200, 2400],
  restingHeartRate: [30, 140],
  plankSeconds: [0, 1200],
  benchPressKg: [0, 300],
  sleepHours: [0, 14],
  iqScore: [55, 200]
} as const satisfies Record<keyof LifeInputs, readonly [number, number]>;

export type UnitSystem = 'metric' | 'imperial';

/** Canonical storage stays metric whatever the player picks, so switching
 * systems changes what is typed and read but never changes a stat. */
export const IMPERIAL_UNITS: Partial<Record<keyof LifeInputs, { unit: string; perMetric: number; step: number }>> = {
  verticalJumpCm: { unit: 'inches', perMetric: 1 / 2.54, step: 0.5 },
  benchPressKg: { unit: 'lbs', perMetric: 2.2046226218, step: 5 }
};

export const KM_PER_MILE = 1.609344;

/** Seeds the initial choice from the browser's locale; the player owns it after that. */
export function localeUnitSystem(): UnitSystem {
  try {
    return /^en-(US|LR|MM)\b/i.test(navigator.language ?? '') ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

export const DEFAULT_INPUTS: LifeInputs = {
  pushups: 15,
  pullups: 5,
  dashSeconds: 5.5,
  verticalJumpCm: 40,
  mileSeconds: 600,
  restingHeartRate: 68,
  plankSeconds: 90,
  benchPressKg: 60,
  sleepHours: 7,
  iqScore: 100
};

export const DEFAULT_STATS: CharacterStats = {
  strength: 10,
  speed: 10,
  stamina: 10,
  defense: 10,
  intelligence: 10,
  discipline: 10
};

export const DEFAULT_STAT_XP: Record<StatKey, number> = {
  strength: 0,
  speed: 0,
  stamina: 0,
  defense: 0,
  intelligence: 0,
  discipline: 0
};

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  skinIndex: 1,
  cloak: 'moss',
  hair: 'raven'
};

const POINTS = [1, 5, 10, 15, 20];

/** Scores one measurement on a 1-20 scale by interpolating between its real
 * anchor values. The old formula compressed every answer into 8-18, so a
 * beginner and an athlete came out nearly identical; anchors spread them. */
export function scoreMetric(key: keyof LifeInputs, value: number): number {
  const anchors = STAT_ANCHORS[key];
  const ascending = anchors[4] > anchors[0];
  const atOrBelowFloor = ascending ? value <= anchors[0] : value >= anchors[0];
  const atOrAboveCeiling = ascending ? value >= anchors[4] : value <= anchors[4];
  if (atOrBelowFloor) return POINTS[0];
  if (atOrAboveCeiling) return POINTS[4];
  for (let i = 0; i < 4; i += 1) {
    const low = anchors[i];
    const high = anchors[i + 1];
    const inBand = ascending ? value >= low && value <= high : value <= low && value >= high;
    if (inBand) return Math.round(POINTS[i] + ((value - low) / (high - low)) * (POINTS[i + 1] - POINTS[i]));
  }
  return POINTS[2];
}

/** How much of each stat its defining metric carries. The second metric is a
 * modifier, not an equal partner: a skipped bench press or a pull-up count of
 * zero should shade an attribute, not halve it. */
export const STAT_WEIGHTS: Record<StatKey, number> = {
  strength: 0.6,
  speed: 0.7,
  stamina: 0.7,
  defense: 0.6,
  intelligence: 0.7,
  discipline: 1
};

const blend = (primary: number, secondary: number, weight: number): number =>
  Math.round(primary * weight + secondary * (1 - weight));

/** Two real-world measurements feed each stat, the first weighted heavier.
 * Ongoing logged activity adds permanent stat XP on top. */
export function calculateBaseStats(input: LifeInputs, activities: ActivityEntry[] = []): CharacterStats {
  const score = (key: keyof LifeInputs): number => scoreMetric(key, input[key]);
  return {
    strength: blend(score('pushups'), score('pullups'), STAT_WEIGHTS.strength),
    speed: blend(score('dashSeconds'), score('verticalJumpCm'), STAT_WEIGHTS.speed),
    stamina: blend(score('mileSeconds'), score('restingHeartRate'), STAT_WEIGHTS.stamina),
    defense: blend(score('plankSeconds'), score('benchPressKg'), STAT_WEIGHTS.defense),
    intelligence: blend(score('iqScore'), score('sleepHours'), STAT_WEIGHTS.intelligence),
    discipline: disciplineFromHistory(activities)
  };
}

export function calculateStats(input: LifeInputs, statXp: Record<StatKey, number> = DEFAULT_STAT_XP, activities: ActivityEntry[] = PlayerProgress.activities): CharacterStats {
  const base = calculateBaseStats(input, activities);
  return Object.fromEntries((Object.keys(base) as StatKey[]).map(key => [
    key,
    // statXp is allowed to go negative, so lapsed effort can pull a stat
    // below the baseline it was originally tested at.
    key === 'discipline' ? base[key] : Math.max(1, Math.min(30, base[key] + Math.trunc(statXp[key] / 250)))
  ])) as unknown as CharacterStats;
}

export const PlayerProgress: {
  level: number;
  totalXp: number;
  profileCompleted: boolean;
  inputs: LifeInputs;
  statXp: Record<StatKey, number>;
  stats: CharacterStats;
  activities: ActivityEntry[];
  claimedWeeklyGoals: string[];
  appearance: CharacterAppearance;
  currentZone: string;
  currentSpawn: string;
  guardianDefeated: boolean;
  /** Stat XP already burned off for the current run of idle days, so reloading
   * the page does not charge the same lapse twice. */
  decayApplied: number;
  /** Date of the last reasoning quiz, gating the monthly retake. */
  iqTakenAt: string;
  unitSystem: UnitSystem;
  /** Week key of the last reckoning with Mycel. */
  lastCheckInWeek: string;
  /** Day the baseline was set; decay is never charged for days before it. */
  profileCreatedAt: string;
  /** Achievement id to the date it was first earned. */
  achievements: Record<string, string>;
  /** Name shown to friends on the online leaderboard. */
  displayName: string;
} = {
  level: 1,
  totalXp: 0,
  profileCompleted: false,
  inputs: { ...DEFAULT_INPUTS },
  statXp: { ...DEFAULT_STAT_XP },
  stats: { ...DEFAULT_STATS },
  activities: [],
  claimedWeeklyGoals: [],
  appearance: { ...DEFAULT_APPEARANCE },
  currentZone: 'biosphere',
  currentSpawn: 'start',
  guardianDefeated: false,
  decayApplied: 0,
  iqTakenAt: '',
  unitSystem: localeUnitSystem(),
  lastCheckInWeek: '',
  profileCreatedAt: '',
  achievements: {},
  displayName: ''
};

export interface WeeklyReport {
  trainingDays: number;
  distanceKm: number;
  sleepHours: number;
  studyHours: number;
}

/** Mycel holds a reckoning once per calendar week, but only for players who
 * already have a baseline — there is nothing to review on day one. */
export function checkInDue(): boolean {
  return PlayerProgress.profileCompleted && PlayerProgress.lastCheckInWeek !== currentWeekKey();
}

/** Turns a week's self-report into permanent stat XP and folds the new sleep
 * figure back into the baseline. Returns the point movement per stat so Mycel
 * can tell the player what actually changed. */
export function applyWeeklyCheckIn(report: WeeklyReport): Partial<Record<StatKey, number>> {
  const before = { ...PlayerProgress.stats };
  const days = Math.max(0, Math.min(7, report.trainingDays));
  const distance = Math.max(0, Math.min(500, report.distanceKm));
  const study = Math.max(0, Math.min(80, report.studyHours));

  PlayerProgress.statXp.strength += Math.round(days * 45);
  PlayerProgress.statXp.defense += Math.round(days * 30);
  PlayerProgress.statXp.speed += Math.round(distance * 6);
  PlayerProgress.statXp.stamina += Math.round(distance * 14);
  PlayerProgress.statXp.intelligence += Math.round(study * 35);
  PlayerProgress.inputs.sleepHours = Math.max(0, Math.min(14, report.sleepHours));

  PlayerProgress.totalXp += Math.round(days * 60 + distance * 12 + study * 25);
  PlayerProgress.lastCheckInWeek = currentWeekKey();
  // A completed reckoning counts as showing up, so it clears any pending decay.
  PlayerProgress.decayApplied = 0;
  PlayerProgress.stats = calculateStats(PlayerProgress.inputs, PlayerProgress.statXp);
  recalculateLevel();

  const deltas: Partial<Record<StatKey, number>> = {};
  for (const key of Object.keys(PlayerProgress.stats) as StatKey[]) {
    const change = PlayerProgress.stats[key] - before[key];
    if (change !== 0) deltas[key] = change;
  }
  return deltas;
}

export const DECAY_GRACE_DAYS = 3;
export const DECAY_XP_PER_IDLE_DAY = 25;

/** Days of silence ending today, counting back to the last logged day — or to
 * the day the character was created, whichever is later. Without that floor a
 * player who has not logged anything yet would be charged for every day back
 * to the search limit the first time they reopened the game. */
function idleDayCount(): number {
  const logged = new Set(PlayerProgress.activities.map(entry => entry.date));
  const created = PlayerProgress.profileCreatedAt;
  const cursor = new Date();
  let idle = 0;
  while (idle < 400) {
    const key = cursor.toISOString().slice(0, 10);
    if (logged.has(key)) break;
    if (created && key <= created) break;
    idle += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return idle;
}

/** Effort that stops has to cost something, or the stats stop meaning anything.
 * Past a grace window every idle day drains stat XP, and because statXp may go
 * negative a long enough lapse drops stats below their tested baseline.
 * Returns the XP removed by this call so the UI can report the loss. */
export function applyInactivityDecay(): number {
  // Nothing to lose before a baseline exists.
  if (!PlayerProgress.profileCompleted) return 0;
  const owed = Math.max(0, idleDayCount() - DECAY_GRACE_DAYS) * DECAY_XP_PER_IDLE_DAY;
  const unpaid = owed - PlayerProgress.decayApplied;
  PlayerProgress.decayApplied = owed;
  if (unpaid <= 0) return 0;
  for (const key of Object.keys(PlayerProgress.statXp) as StatKey[]) PlayerProgress.statXp[key] -= unpaid;
  PlayerProgress.stats = calculateStats(PlayerProgress.inputs, PlayerProgress.statXp);
  return unpaid;
}

export function xpForLevel(level: number): number {
  return 500 + Math.max(0, level - 1) * 150;
}

export function recalculateLevel(): void {
  let remaining = Math.max(0, PlayerProgress.totalXp);
  let level = 1;
  while (level < 99 && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  PlayerProgress.level = level;
}

export function currentLevelXp(): number {
  let remaining = Math.max(0, PlayerProgress.totalXp);
  for (let level = 1; level < PlayerProgress.level; level += 1) remaining -= xpForLevel(level);
  return Math.max(0, remaining);
}

export function addActivity(kind: ActivityKind, amount = 1, note?: string): { ok: boolean; message: string; xp: number } {
  const today = new Date().toISOString().slice(0, 10);
  const firstActivityToday = !PlayerProgress.activities.some(entry => entry.date === today);
  const onceDaily = kind === 'workout' || kind === 'steps' || kind === 'goal';
  if (onceDaily && PlayerProgress.activities.some(entry => entry.kind === kind && entry.date === today)) {
    return { ok: false, message: 'Already credited today.', xp: 0 };
  }

  let xp = 0;
  const gains: Partial<Record<StatKey, number>> = {};
  if (kind === 'workout') {
    xp = 100;
    gains.strength = 40;
    gains.defense = 15;
  } else if (kind === 'steps') {
    xp = 50;
    gains.stamina = 15;
  } else if (kind === 'run') {
    const distance = Math.max(0.1, Math.min(100, amount));
    xp = Math.min(300, Math.round(distance * 35));
    gains.speed = Math.round(distance * 8);
    gains.stamina = Math.round(distance * 18);
  } else if (kind === 'study' || kind === 'focus') {
    const minutes = Math.max(5, Math.min(480, amount));
    xp = Math.min(240, Math.round(minutes * 1.5));
    gains.intelligence = Math.round(minutes * 0.7);
  } else {
    xp = 60;
  }

  let streakBonus = false;
  if (firstActivityToday) {
    const dates = new Set(PlayerProgress.activities.map(entry => entry.date));
    dates.add(today);
    const streak = consecutiveDays(dates);
    if (streak >= 7 && streak % 7 === 0) {
      xp += 150;
      streakBonus = true;
    }
  }

  for (const [key, value] of Object.entries(gains) as Array<[StatKey, number]>) PlayerProgress.statXp[key] += value;
  PlayerProgress.totalXp += xp;
  PlayerProgress.activities.push({ id: `${today}:${kind}:${Date.now()}`, kind, date: today, amount, xp, note });
  PlayerProgress.activities = PlayerProgress.activities.slice(-180);
  const weekly = awardWeeklyGoals();
  if (weekly.xp > 0) {
    xp += weekly.xp;
    PlayerProgress.totalXp += weekly.xp;
    PlayerProgress.activities[PlayerProgress.activities.length - 1].xp += weekly.xp;
  }
  // Today now counts as logged, so the next lapse starts its own decay run.
  PlayerProgress.decayApplied = 0;
  PlayerProgress.stats = calculateStats(PlayerProgress.inputs, PlayerProgress.statXp);
  recalculateLevel();
  const message = weekly.names.length
    ? `Weekly goal complete: ${weekly.names.join(', ')}!`
    : streakBonus
    ? 'Real effort logged · 7-day streak bonus!'
    : 'Real effort logged.';
  return { ok: true, message, xp };
}

export function activityStreak(): number {
  return consecutiveDays(new Set(PlayerProgress.activities.map(entry => entry.date)));
}

function consecutiveDays(active: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  while (active.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function workoutsThisWeek(): number {
  const start = startOfWeek(new Date());
  return new Set(PlayerProgress.activities
    .filter(entry => entry.kind === 'workout' && new Date(`${entry.date}T12:00:00`) >= start)
    .map(entry => entry.date)).size;
}

export interface WeeklyGoal {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: string;
  reward: number;
  claimed: boolean;
}

export function currentWeekKey(date = new Date()): string {
  return startOfWeek(date).toISOString().slice(0, 10);
}

export function weeklyGoals(): WeeklyGoal[] {
  const week = currentWeekKey();
  const entries = PlayerProgress.activities.filter(entry => entry.date >= week);
  const workoutDays = new Set(entries.filter(entry => entry.kind === 'workout').map(entry => entry.date)).size;
  const stepDays = new Set(entries.filter(entry => entry.kind === 'steps').map(entry => entry.date)).size;
  const runKm = entries.filter(entry => entry.kind === 'run').reduce((sum, entry) => sum + entry.amount, 0);
  const studyMinutes = entries.filter(entry => entry.kind === 'study' || entry.kind === 'focus').reduce((sum, entry) => sum + entry.amount, 0);
  const make = (id: string, label: string, current: number, target: number, unit: string, reward: number): WeeklyGoal => ({
    id,
    label,
    current: Math.min(target, Math.round(current * 10) / 10),
    target,
    unit,
    reward,
    claimed: PlayerProgress.claimedWeeklyGoals.includes(`${week}:${id}`)
  });
  const tier = weeksSinceFirstActivity();
  // Targets climb with every week played, so the quest keeps pace instead of
  // staying trivial once the habit is established. Rewards climb with them.
  const grow = (base: number, perWeek: number, cap: number): number => Math.min(cap, Math.round(base + tier * perWeek));
  // Distance is stored in km; when the player is on imperial both sides of the
  // goal convert together, so the progress ratio is unchanged.
  const imperial = PlayerProgress.unitSystem === 'imperial';
  const distanceKm = grow(5, 1, 30);
  const distanceTarget = imperial ? Math.round((distanceKm / KM_PER_MILE) * 10) / 10 : distanceKm;
  const distanceUnit = imperial ? 'mi' : 'km';
  return [
    make('train', `Train ${grow(3, 0.25, 6)} days`, workoutDays, grow(3, 0.25, 6), 'days', 250 + tier * 25),
    make('steps', `5K steps on ${grow(3, 0.25, 7)} days`, stepDays, grow(3, 0.25, 7), 'days', 150 + tier * 20),
    make('distance', `Move ${distanceTarget} ${distanceUnit}`, imperial ? runKm / KM_PER_MILE : runKm, distanceTarget, distanceUnit, 200 + tier * 25),
    make('study', `Learn ${grow(120, 15, 420)} min`, studyMinutes, grow(120, 15, 420), 'min', 180 + tier * 20)
  ];
}

/** Whole weeks since the player first logged anything, used to escalate goals. */
export function weeksSinceFirstActivity(): number {
  const first = PlayerProgress.activities[0]?.date;
  if (!first) return 0;
  const elapsed = Date.now() - Date.parse(`${first}T00:00:00Z`);
  return Math.max(0, Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000)));
}

function awardWeeklyGoals(): { xp: number; names: string[] } {
  const week = currentWeekKey();
  let xp = 0;
  const names: string[] = [];
  for (const goal of weeklyGoals()) {
    if (goal.claimed || goal.current < goal.target) continue;
    PlayerProgress.claimedWeeklyGoals.push(`${week}:${goal.id}`);
    xp += goal.reward;
    names.push(goal.label);
    if (goal.id === 'train4') {
      PlayerProgress.statXp.strength += 60;
      PlayerProgress.statXp.defense += 40;
    } else if (goal.id === 'steps4') {
      PlayerProgress.statXp.stamina += 45;
    } else if (goal.id === 'distance5') {
      PlayerProgress.statXp.speed += 30;
      PlayerProgress.statXp.stamina += 55;
    } else {
      PlayerProgress.statXp.intelligence += 70;
    }
  }
  PlayerProgress.claimedWeeklyGoals = PlayerProgress.claimedWeeklyGoals.slice(-32);
  return { xp, names };
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const mondayOffset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - mondayOffset);
  return copy;
}

export function totalStats(stats: CharacterStats = PlayerProgress.stats): number {
  return Object.values(stats).reduce((sum, value) => sum + value, 0);
}

/** Discipline is deliberately earned, never self-reported. It combines recent
 * consistency with the current streak and updates whenever effort is logged. */
export const DISCIPLINE_BASE = 10;

/** The one stat with no baseline question. It starts at 10 and reads purely
 * off logged consistency, climbing toward 20 while effort stays regular and
 * sliding back toward 1 once it stops. */
function disciplineFromHistory(activities: ActivityEntry[]): number {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - 27);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const recentDays = new Set(activities.filter(entry => entry.date >= cutoffKey).map(entry => entry.date)).size;
  const active = new Set(activities.map(entry => entry.date));
  const streak = consecutiveDays(active);
  if (activities.length === 0) return DISCIPLINE_BASE;
  const consistency = Math.min(1, recentDays / 20);
  const streakScore = Math.min(1, streak / 14);
  const score = consistency * 0.75 + streakScore * 0.25;
  // Half marks hold the base; anything above climbs, anything below slides.
  return Math.max(1, Math.min(20, Math.round(DISCIPLINE_BASE + (score - 0.5) * 20)));
}
