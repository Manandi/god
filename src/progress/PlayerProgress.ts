export interface LifeInputs {
  pushups: number;
  sprintSeconds: number;
  mileSeconds: number;
  plankSeconds: number;
  iqScore: number;
  focusMinutes: number;
  habitStreak: number;
}

export interface CharacterStats {
  strength: number;
  speed: number;
  stamina: number;
  defense: number;
  intelligence: number;
  focus: number;
  discipline: number;
}

export type StatKey = keyof CharacterStats;
export type ActivityKind = 'workout' | 'steps' | 'run' | 'focus' | 'goal';

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

export const DEFAULT_INPUTS: LifeInputs = {
  pushups: 10,
  sprintSeconds: 20,
  mileSeconds: 720,
  plankSeconds: 45,
  iqScore: 100,
  focusMinutes: 25,
  habitStreak: 0
};

export const DEFAULT_STATS: CharacterStats = {
  strength: 10,
  speed: 10,
  stamina: 10,
  defense: 10,
  intelligence: 10,
  focus: 10,
  discipline: 10
};

export const DEFAULT_STAT_XP: Record<StatKey, number> = {
  strength: 0,
  speed: 0,
  stamina: 0,
  defense: 0,
  intelligence: 0,
  focus: 0,
  discipline: 0
};

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  skinIndex: 1,
  cloak: 'moss',
  hair: 'raven'
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const baseline = (value: number): number => Math.round(8 + clamp01(value) * 10);

/** A compact, universal starting assessment. Ongoing real-world activity adds
 * permanent stat XP after the baseline is created. */
export function calculateBaseStats(input: LifeInputs): CharacterStats {
  return {
    strength: baseline(input.pushups / 50),
    speed: baseline((24 - input.sprintSeconds) / 12),
    stamina: baseline((900 - input.mileSeconds) / 540),
    defense: baseline(input.plankSeconds / 180),
    intelligence: baseline((input.iqScore - 70) / 60),
    focus: baseline(input.focusMinutes / 90),
    discipline: baseline(input.habitStreak / 60)
  };
}

export function calculateStats(input: LifeInputs, statXp: Record<StatKey, number> = DEFAULT_STAT_XP): CharacterStats {
  const base = calculateBaseStats(input);
  return Object.fromEntries((Object.keys(base) as StatKey[]).map(key => [
    key,
    Math.min(30, base[key] + Math.floor(Math.max(0, statXp[key]) / 250))
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
  guardianDefeated: false
};

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
    gains.discipline = 15;
  } else if (kind === 'steps') {
    xp = 50;
    gains.stamina = 15;
    gains.discipline = 10;
  } else if (kind === 'run') {
    const distance = Math.max(0.1, Math.min(100, amount));
    xp = Math.min(300, Math.round(distance * 35));
    gains.speed = Math.round(distance * 8);
    gains.stamina = Math.round(distance * 18);
  } else if (kind === 'focus') {
    const minutes = Math.max(5, Math.min(480, amount));
    xp = Math.min(240, Math.round(minutes * 1.5));
    gains.intelligence = Math.round(minutes * 0.35);
    gains.focus = Math.round(minutes * 0.7);
  } else {
    xp = 60;
    gains.discipline = 20;
  }

  let streakBonus = false;
  if (firstActivityToday) {
    const dates = new Set(PlayerProgress.activities.map(entry => entry.date));
    dates.add(today);
    const streak = consecutiveDays(dates);
    if (streak >= 7 && streak % 7 === 0) {
      xp += 150;
      gains.discipline = (gains.discipline ?? 0) + 50;
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
  const focusMinutes = entries.filter(entry => entry.kind === 'focus').reduce((sum, entry) => sum + entry.amount, 0);
  const make = (id: string, label: string, current: number, target: number, unit: string, reward: number): WeeklyGoal => ({
    id,
    label,
    current: Math.min(target, Math.round(current * 10) / 10),
    target,
    unit,
    reward,
    claimed: PlayerProgress.claimedWeeklyGoals.includes(`${week}:${id}`)
  });
  return [
    make('train4', 'Train 4 days', workoutDays, 4, 'days', 250),
    make('steps4', '5K steps on 4 days', stepDays, 4, 'days', 150),
    make('distance5', 'Move 5 km', runKm, 5, 'km', 200),
    make('focus120', 'Focus 120 min', focusMinutes, 120, 'min', 180)
  ];
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
      PlayerProgress.statXp.discipline += 30;
    } else if (goal.id === 'distance5') {
      PlayerProgress.statXp.speed += 30;
      PlayerProgress.statXp.stamina += 55;
    } else {
      PlayerProgress.statXp.intelligence += 35;
      PlayerProgress.statXp.focus += 50;
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
