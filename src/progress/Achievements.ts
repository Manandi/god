import { PlayerProgress } from './PlayerProgress';

export interface Achievement {
  id: string;
  title: string;
  description: string;
}

export const ACHIEVEMENTS = {
  guardianFelled: {
    id: 'guardian-felled',
    title: 'Warden Felled',
    description: 'Defeat the Verdant Guardian.'
  },
  guardianUntouched: {
    id: 'guardian-untouched',
    title: 'Untouched by Roots',
    description: 'Defeat the Verdant Guardian without taking a hit.'
  },
  guardianSwift: {
    id: 'guardian-swift',
    title: 'Swift Reckoning',
    description: 'Defeat the Verdant Guardian in under 90 seconds.'
  }
} as const satisfies Record<string, Achievement>;

export const ACHIEVEMENT_LIST: Achievement[] = Object.values(ACHIEVEMENTS);

export function hasAchievement(id: string): boolean {
  return id in PlayerProgress.achievements;
}

/** Records the unlock date the first time only. Returns whether it was new, so
 * the banner fires once rather than on every repeat kill. */
export function unlockAchievement(achievement: Achievement): boolean {
  if (hasAchievement(achievement.id)) return false;
  PlayerProgress.achievements[achievement.id] = new Date().toISOString().slice(0, 10);
  return true;
}
