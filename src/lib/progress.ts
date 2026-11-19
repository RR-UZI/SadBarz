// Pro history: weekly totals and personal bests, worked out from the logged workouts.
// Pure functions, so they are easy to check.
import { totalReps } from './blocks';
import { startOfWeek } from './util';
import type { Workout } from '../types';

export interface Week {
  start: number; // Monday 00:00, local time
  workouts: number;
  reps: number;
  minutes: number;
}

/** The last `n` weeks, oldest first, the current week last. */
export function weeklyTotals(workouts: Workout[], n: number, now: number = Date.now()): Week[] {
  const starts: number[] = [];
  let s = startOfWeek(now);
  for (let i = 0; i < n; i++) {
    starts.unshift(s);
    s = startOfWeek(s - 3 * 86_400_000); // a few days back lands in the week before, even across a time change
  }
  const weeks: Week[] = starts.map((start) => ({ start, workouts: 0, reps: 0, minutes: 0 }));
  const byStart = new Map(weeks.map((w) => [w.start, w]));
  for (const w of workouts) {
    const week = byStart.get(startOfWeek(w.startedAt));
    if (!week) continue;
    week.workouts++;
    week.reps += w.blocks.filter((b) => b.status === 'done').reduce((sum, b) => sum + totalReps(b.entries), 0);
    week.minutes += Math.max(0, (w.finishedAt - w.startedAt) / 60_000);
  }
  return weeks;
}

export type BestKind = 'reps' | 'weight' | 'hold' | 'meters' | 'amrap' | 'fortime';

export interface Best {
  key: string;
  kind: BestKind;
  exerciseId?: string; // exercise bests
  title?: string; // block bests: the block's title
  routineName?: string; // block bests
  value: number; // reps, kg, seconds, meters, amrap rounds*1000+reps, for-time seconds
  reps?: number; // weight: lifted for this many reps; amrap: reps in the last round
  rounds?: number; // amrap: full rounds
  at: number; // when it was set
  previous?: number; // the best before this one, when it beat an earlier one
  times: number; // how many times it was logged
}

/** Higher is better for everything but a for-time finish. */
const better = (kind: BestKind, a: number, b: number) => (kind === 'fortime' ? a < b : a > b);

/** The athlete's bests: per exercise (most reps in a set, heaviest weight, longest hold, longest distance) and per block (AMRAP, for time). */
export function personalBests(workouts: Workout[]): Best[] {
  const bests = new Map<string, Best>();
  const offer = (b: Omit<Best, 'times' | 'previous'>) => {
    const cur = bests.get(b.key);
    if (!cur) {
      bests.set(b.key, { ...b, times: 1 });
      return;
    }
    cur.times++;
    // Same value later doesn't count as a new best: the first time it was done stays.
    if (better(b.kind, b.value, cur.value)) bests.set(b.key, { ...b, times: cur.times, previous: cur.value });
  };
  const ordered = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
  for (const w of ordered) {
    for (const blk of w.blocks) {
      if (blk.status !== 'done') continue;
      for (const e of blk.entries) {
        const id = e.exerciseId;
        if (e.weightKg && e.weightKg > 0) offer({ key: `weight:${id}`, kind: 'weight', exerciseId: id, value: e.weightKg, reps: e.reps, at: w.startedAt });
        else if (e.reps && e.reps > 0) offer({ key: `reps:${id}`, kind: 'reps', exerciseId: id, value: e.reps, at: w.startedAt });
        if (e.seconds && e.seconds > 0) offer({ key: `hold:${id}`, kind: 'hold', exerciseId: id, value: e.seconds, at: w.startedAt });
        if (e.meters && e.meters > 0) offer({ key: `meters:${id}`, kind: 'meters', exerciseId: id, value: e.meters, at: w.startedAt });
      }
      // Block scores only compare with the same block of the same routine.
      const where = `${w.routineId ?? w.routineName}|${blk.blockId}`;
      const block = { title: blk.title || blk.format.toUpperCase(), routineName: w.routineName, at: w.startedAt };
      if (blk.score) {
        offer({ key: `amrap:${where}`, kind: 'amrap', ...block, value: blk.score.rounds * 1000 + blk.score.reps, rounds: blk.score.rounds, reps: blk.score.reps });
      }
      if (blk.forTime?.timeSec != null && blk.forTime.timeSec > 0) {
        offer({ key: `fortime:${where}`, kind: 'fortime', ...block, value: blk.forTime.timeSec });
      }
    }
  }
  // Newest first: what the athlete just beat is what they want to see.
  return [...bests.values()].sort((a, b) => b.at - a.at);
}
