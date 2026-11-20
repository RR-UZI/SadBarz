import { describe, expect, it } from 'vitest';

import { addDays, daysBetween, type HealthDay } from '../../src/lib/health';
import { hm, insights, readiness, summary } from '../../src/lib/healthStats';

const TODAY = '2026-11-19';

/** 30 normal days before today (sleep 7h30, resting HR 55, HRV 70), then today as given. */
function history(today: Partial<HealthDay>) {
  const days = new Map<string, HealthDay>();
  for (const day of daysBetween(addDays(TODAY, -30), addDays(TODAY, -1))) days.set(day, { day, sleepMin: 450, restingHr: 55, hrvMs: 70 });
  days.set(TODAY, { day: TODAY, ...today });
  return days;
}

describe('readiness', () => {
  it('says take it easy after a short night with a high resting heart rate and low HRV', () => {
    const r = readiness(history({ sleepMin: 330, restingHr: 61, hrvMs: 55 }), TODAY);
    expect(r.level).toBe('easy');
    expect(r.reasons.map((x) => x.key)).toEqual(['health.why.hrvLow', 'health.why.rhrHigh', 'health.why.sleepShort']);
  });

  it('says ready after a long night with a low resting heart rate and high HRV', () => {
    expect(readiness(history({ sleepMin: 480, restingHr: 52, hrvMs: 80 }), TODAY).level).toBe('ready');
  });

  it('says normal on a normal day', () => {
    expect(readiness(history({ sleepMin: 440, restingHr: 55, hrvMs: 70 }), TODAY).level).toBe('normal');
  });

  it('is unknown with no data for today', () => {
    expect(readiness(history({}), TODAY)).toEqual({ level: 'unknown', reasons: [] });
  });

  it('only compares HRV and heart rate with at least 5 days of baseline', () => {
    const days = new Map<string, HealthDay>([
      ['2026-11-18', { day: '2026-11-18', hrvMs: 90, restingHr: 50 }],
      [TODAY, { day: TODAY, hrvMs: 40, restingHr: 70, sleepMin: 460 }],
    ]);
    const r = readiness(days, TODAY);
    expect(r.reasons.map((x) => x.key)).toEqual(['health.why.sleepOk']);
    expect(r.level).toBe('ready');
  });
});

describe('summary', () => {
  it('gives the average and the change from the period before', () => {
    const days = new Map<string, HealthDay>();
    for (const day of daysBetween('2026-11-06', '2026-11-12')) days.set(day, { day, steps: 6000 });
    for (const day of daysBetween('2026-11-13', '2026-11-19')) days.set(day, { day, steps: 8000 });
    expect(summary(days, '2026-11-13', '2026-11-19', 'steps')).toEqual({ avg: 8000, delta: 2000 });
  });

  it('has no change when the period before is empty', () => {
    const days = new Map<string, HealthDay>([[TODAY, { day: TODAY, steps: 5000 }]]);
    expect(summary(days, TODAY, TODAY, 'steps')).toEqual({ avg: 5000, delta: null });
  });
});

describe('insights', () => {
  it('notices shorter sleep before training days', () => {
    const days = new Map<string, HealthDay>();
    const training = new Set<string>();
    daysBetween('2026-11-06', '2026-11-19').forEach((day, i) => {
      const trains = i % 2 === 0;
      if (trains) training.add(day);
      days.set(day, { day, sleepMin: trains ? 380 : 470 });
    });
    const keys = insights(days, '2026-11-06', '2026-11-19', training).map((n) => n.key);
    expect(keys).toContain('health.ins.sleepBeforeTrainLess');
  });
});

describe('hm', () => {
  it('writes minutes as hours and minutes', () => {
    expect(hm(452)).toBe('7h 32m');
    expect(hm(60)).toBe('1h 00m');
  });
});

describe('days', () => {
  it('adds days across months and lists a range', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-31', '2026-11-02')).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
  });
});
