import { describe, expect, it } from 'vitest';

import { planTiming, type MyPlan } from '../../src/lib/coach';

const plan = (startDate: string, weeks: 1 | 2 | 4): MyPlan => ({ id: 'p', weeks, startDate, progression: '', days: [] });

describe('planTiming', () => {
  it('is upcoming before the start', () => {
    expect(planTiming(plan('2026-11-23', 4), '2026-11-19')).toMatchObject({ phase: 'upcoming', week: 1, daysLeft: 28 });
  });

  it('counts the weeks and the days left, today included', () => {
    expect(planTiming(plan('2026-11-02', 4), '2026-11-02')).toMatchObject({ phase: 'active', week: 1, daysLeft: 28, endDate: '2026-11-29' });
    expect(planTiming(plan('2026-11-02', 4), '2026-11-19')).toMatchObject({ phase: 'active', week: 3, daysLeft: 11 });
    expect(planTiming(plan('2026-11-02', 4), '2026-11-29')).toMatchObject({ phase: 'active', week: 4, daysLeft: 1 });
  });

  it('ends the day after the last day', () => {
    expect(planTiming(plan('2026-11-02', 4), '2026-11-30')).toMatchObject({ phase: 'ended', week: 4, daysLeft: 0 });
  });

  it('is not thrown off by daylight saving time', () => {
    // Daylight saving ended Nov 1 2026 (US): a plan across it still has 7-day weeks.
    expect(planTiming(plan('2026-10-26', 2), '2026-11-02')).toMatchObject({ phase: 'active', week: 2, daysLeft: 7 });
  });
});
