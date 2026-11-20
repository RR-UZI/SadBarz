import { describe, expect, it } from 'vitest';

import { personalBests, weeklyTotals } from '../../src/lib/progress';
import { at, block, workout } from './helpers';

const pullUps = (reps: number, weightKg?: number) => ({ exerciseId: 'ex_pull', rounds: 4, reps, ...(weightKg ? { weightKg } : {}) });

describe('personalBests', () => {
  it('keeps the most reps in a set and the best before it', () => {
    const bests = personalBests([
      workout(at(2026, 11, 2), [block([pullUps(8)])]),
      workout(at(2026, 11, 4), [block([pullUps(12)])]),
      workout(at(2026, 11, 6), [block([pullUps(10)])]),
    ]);
    const reps = bests.find((b) => b.key === 'reps:ex_pull')!;
    expect(reps.value).toBe(12);
    expect(reps.previous).toBe(8);
    expect(reps.at).toBe(at(2026, 11, 4));
    expect(reps.times).toBe(3);
  });

  it('does not count the same value again as a new best', () => {
    const bests = personalBests([workout(at(2026, 11, 2), [block([pullUps(10)])]), workout(at(2026, 11, 9), [block([pullUps(10)])])]);
    const reps = bests.find((b) => b.key === 'reps:ex_pull')!;
    expect(reps.at).toBe(at(2026, 11, 2));
    expect(reps.previous).toBeUndefined();
  });

  it('works out of order (sorts the workouts first)', () => {
    const bests = personalBests([workout(at(2026, 11, 9), [block([pullUps(9)])]), workout(at(2026, 11, 2), [block([pullUps(6)])])]);
    expect(bests[0]).toMatchObject({ value: 9, previous: 6 });
  });

  it('keeps weighted sets apart from bodyweight reps', () => {
    const bests = personalBests([workout(at(2026, 11, 2), [block([pullUps(5, 10), pullUps(11)])]), workout(at(2026, 11, 4), [block([pullUps(3, 20)])])]);
    expect(bests.find((b) => b.key === 'weight:ex_pull')).toMatchObject({ value: 20, reps: 3, previous: 10 });
    expect(bests.find((b) => b.key === 'reps:ex_pull')).toMatchObject({ value: 11 });
  });

  it('ignores skipped blocks', () => {
    const bests = personalBests([workout(at(2026, 11, 2), [block([pullUps(30)], { status: 'skipped' })])]);
    expect(bests).toEqual([]);
  });

  it('keeps holds, distance, AMRAP (more is better) and for time (less is better)', () => {
    const w = (d: number, rounds: number, reps: number, timeSec: number, seconds: number) =>
      workout(
        at(2026, 11, d),
        [
          block([{ exerciseId: 'ex_dead_hang', rounds: 1, seconds }, { exerciseId: 'ex_correr', rounds: 1, meters: 400 + d }], { blockId: 'a', format: 'amrap', score: { rounds, reps } }),
          block([{ exerciseId: 'ex_burpees', rounds: 1, reps: 50 }], { blockId: 'f', title: 'Chipper', format: 'fortime', forTime: { rounds: 1, timeSec } }),
        ],
        { routineId: 'r1' },
      );
    const bests = personalBests([w(2, 5, 3, 600, 40), w(4, 5, 9, 540, 35), w(6, 4, 15, 570, 45)]);
    expect(bests.find((b) => b.kind === 'amrap')).toMatchObject({ rounds: 5, reps: 9, previous: 5003 });
    expect(bests.find((b) => b.kind === 'fortime')).toMatchObject({ value: 540, previous: 600, title: 'Chipper' });
    expect(bests.find((b) => b.kind === 'hold')).toMatchObject({ value: 45, previous: 40 });
    expect(bests.find((b) => b.kind === 'meters')).toMatchObject({ value: 406 });
  });

  it('compares block scores only within the same routine', () => {
    const amrap = (routineId: string, rounds: number) =>
      workout(at(2026, 11, rounds), [block([{ exerciseId: 'ex_push', rounds, reps: 10 }], { blockId: 'a', format: 'amrap', score: { rounds, reps: 0 } })], { routineId });
    const bests = personalBests([amrap('r1', 6), amrap('r2', 4)]).filter((b) => b.kind === 'amrap');
    expect(bests).toHaveLength(2);
  });

  it('lists the newest best first', () => {
    const bests = personalBests([
      workout(at(2026, 11, 2), [block([{ exerciseId: 'ex_fondos', rounds: 3, reps: 15 }])]),
      workout(at(2026, 11, 8), [block([pullUps(9)])]),
    ]);
    expect(bests.map((b) => b.exerciseId)).toEqual(['ex_pull', 'ex_fondos']);
  });
});

describe('weeklyTotals', () => {
  // Thursday Nov 19 2026: its week starts Monday Nov 16.
  const now = at(2026, 11, 19, 20);

  it('gives the last n weeks, oldest first, starting on Mondays', () => {
    const weeks = weeklyTotals([], 4, now);
    expect(weeks.map((w) => new Date(w.start).toDateString())).toEqual(['Mon Oct 26 2026', 'Mon Nov 02 2026', 'Mon Nov 09 2026', 'Mon Nov 16 2026']);
  });

  it('adds up workouts, reps of done blocks and minutes per week', () => {
    const weeks = weeklyTotals(
      [
        workout(at(2026, 11, 16, 7), [block([pullUps(10)]), block([pullUps(99)], { status: 'skipped' })]), // 40 reps, 60 min
        workout(at(2026, 11, 18, 7), [block([{ exerciseId: 'ex_fondos', rounds: 2, reps: 5 }])], { finishedAt: at(2026, 11, 18, 7) + 30 * 60_000 }),
        workout(at(2026, 11, 15, 23), [block([pullUps(1)])]), // Sunday: the week before
        workout(at(2026, 8, 1), [block([pullUps(1)])]), // too old: left out
      ],
      2,
      now,
    );
    expect(weeks[1]).toMatchObject({ workouts: 2, reps: 50, minutes: 90 });
    expect(weeks[0]).toMatchObject({ workouts: 1, reps: 4 });
  });

  it('crosses the end of daylight saving time without losing a week', () => {
    // US daylight saving ended on Nov 1 2026; every week must still be 7 days apart.
    const weeks = weeklyTotals([], 6, now);
    const gaps = weeks.slice(1).map((w, i) => Math.round((w.start - weeks[i].start) / 86_400_000));
    expect(gaps).toEqual([7, 7, 7, 7, 7]);
  });
});
