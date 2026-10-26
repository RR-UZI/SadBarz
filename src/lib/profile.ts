// Helpers for the training profile collected in onboarding.
import type { Level, MaxReps, Profile } from '../types';

export const MIN_AGE = 13;
export const MAX_AGE = 90;
// Everyone keeps at least one rest day a week.
export const MAX_TRAINING_DAYS = 6;
export const MIN_WEIGHT_KG = 30;
export const MAX_WEIGHT_KG = 250;
export const LB_PER_KG = 2.20462;

// Starting estimate from the max reps test. The coach refines it from the logs.
export function levelFromTest(m: MaxReps): Level {
  if (m.muscleUps >= 5 || (m.pullUps >= 15 && m.dips >= 20)) return 'advanced';
  if (m.muscleUps >= 1 || (m.pullUps >= 6 && m.dips >= 8)) return 'intermediate';
  return 'beginner';
}

/** Monday = 0 … Sunday = 6. */
export function weekday(d: Date) {
  return (d.getDay() + 6) % 7;
}

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseIsoDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Today if it is a training day, otherwise the next training day. */
export function nextTrainingDay(days: number[], from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 7 && days.length; i++) {
    if (days.includes(weekday(d))) return isoDate(d);
    d.setDate(d.getDate() + 1);
  }
  return isoDate(new Date(from.getFullYear(), from.getMonth(), from.getDate()));
}

// Accepts what came back from storage only if it has the fields the app relies on.
export function asProfile(v: unknown): Profile | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Partial<Profile>;
  if (p.version !== 1 || !p.goal || !p.level || !Array.isArray(p.trainingDays) || !p.trainingDays.length) return null;
  if (!p.startDate || typeof p.age !== 'number' || typeof p.weightKg !== 'number') return null;
  return {
    ...p,
    skills: p.skills ?? [],
    equipment: p.equipment ?? [],
    injuries: p.injuries ?? [],
    reminders: p.reminders ?? false,
    reminderTime: p.reminderTime ?? '19:00',
  } as Profile;
}
