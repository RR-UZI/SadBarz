// Records for the athlete profile: the best marks found in the workout log,
// plus the stats on top of the profile.
import type { Exercise, PersonalRecord, RecordUnit, Workout } from '../types';
import { totalReps } from './blocks';
import { clock, DAY_MS, startOfWeek } from './util';

// Best mark for one move, read from the logged workouts.
export interface LoggedBest {
  key: string;
  exerciseId: string;
  unit: Exclude<RecordUnit, 'time'>;
  value: number;
  reps?: number; // kg: done for this many reps
  at: number; // when it was first reached
}

// Best AMRAP score of one block of one routine.
export interface AmrapBest {
  key: string;
  name: string;
  rounds: number;
  reps: number;
  at: number;
}

// Oldest workout first, so a tie keeps the day the mark was first reached.
function oldestFirst(workouts: Workout[]) {
  return [...workouts].sort((a, b) => a.startedAt - b.startedAt);
}

export function loggedBests(workouts: Workout[], exerciseById: (id: string) => Exercise | undefined): LoggedBest[] {
  const best = new Map<string, LoggedBest>();
  const offer = (b: LoggedBest) => {
    const cur = best.get(b.key);
    if (!cur || b.value > cur.value || (b.unit === 'kg' && b.value === cur.value && (b.reps ?? 0) > (cur.reps ?? 0))) best.set(b.key, b);
  };
  for (const w of oldestFirst(workouts)) {
    for (const block of w.blocks) {
      if (block.status !== 'done') continue;
      for (const e of block.entries) {
        const kind = exerciseById(e.exerciseId)?.kind;
        if (!kind || e.rounds <= 0) continue;
        if (e.weightKg && e.weightKg > 0) offer({ key: `${e.exerciseId}:kg`, exerciseId: e.exerciseId, unit: 'kg', value: e.weightKg, reps: e.reps, at: w.startedAt });
        else if (kind === 'reps' && e.reps) offer({ key: `${e.exerciseId}:reps`, exerciseId: e.exerciseId, unit: 'reps', value: e.reps, at: w.startedAt });
        if (kind === 'hold' && e.seconds) offer({ key: `${e.exerciseId}:sec`, exerciseId: e.exerciseId, unit: 'sec', value: e.seconds, at: w.startedAt });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.at - a.at);
}

export function amrapBests(workouts: Workout[]): AmrapBest[] {
  const best = new Map<string, AmrapBest>();
  for (const w of oldestFirst(workouts)) {
    for (const block of w.blocks) {
      if (block.status !== 'done' || !block.score) continue;
      const key = `${w.routineId ?? w.routineName}:${block.blockId}`;
      const cur = best.get(key);
      const { rounds, reps } = block.score;
      if (!cur || rounds > cur.rounds || (rounds === cur.rounds && reps > cur.reps)) {
        best.set(key, { key, name: block.title ? `${w.routineName} · ${block.title}` : w.routineName, rounds, reps, at: w.startedAt });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.at - a.at);
}

export interface ProfileStats {
  workouts: number;
  minutes: number;
  reps: number;
  weekStreak: number; // weeks in a row with at least one workout
}

export function profileStats(workouts: Workout[], now = Date.now()): ProfileStats {
  const weeks = new Set(workouts.map((w) => startOfWeek(w.startedAt)));
  // This week still counts as "in a row" while it isn't over, even before the first workout.
  let week = startOfWeek(now);
  if (!weeks.has(week)) week = startOfWeek(week - DAY_MS);
  let weekStreak = 0;
  while (weeks.has(week)) {
    weekStreak++;
    week = startOfWeek(week - DAY_MS);
  }
  return {
    workouts: workouts.length,
    minutes: Math.round(workouts.reduce((s, w) => s + (w.finishedAt - w.startedAt), 0) / 60000),
    reps: workouts.reduce((s, w) => s + w.blocks.filter((b) => b.status === 'done').reduce((n, b) => n + totalReps(b.entries), 0), 0),
    weekStreak,
  };
}

// "20 reps", '45"', "+32 kg × 3", "12:34"
export function recordValue(r: Pick<PersonalRecord, 'unit' | 'value' | 'reps'>): string {
  switch (r.unit) {
    case 'reps':
      return `${r.value} reps`;
    case 'sec':
      return `${r.value}"`;
    case 'kg':
      return `+${r.value} kg${r.reps ? ` × ${r.reps}` : ''}`;
    case 'time':
      return clock(r.value);
  }
}

// YYYY-MM-DD of a moment, in local time.
export function isoDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
