// The Health tab's numbers: averages, trends, "how you're doing today" and what the numbers say.
// Pure functions over the merged days, so they are easy to check.
import { addDays, daysBetween, type HealthDay } from './health';

export type Metric = 'sleepMin' | 'restingHr' | 'hrvMs' | 'steps' | 'calories';
export type Days = Map<string, HealthDay>;

/** "7h 12m" */
export const hm = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`;

export function values(days: Days, from: string, to: string, k: keyof HealthDay): number[] {
  const out: number[] = [];
  for (const d of daysBetween(from, to)) {
    const v = days.get(d)?.[k];
    if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
  }
  return out;
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** The average over from..to and the change from the same number of days just before. */
export function summary(days: Days, from: string, to: string, k: Metric) {
  const n = daysBetween(from, to).length;
  const cur = mean(values(days, from, to, k));
  const prev = mean(values(days, addDays(from, -n), addDays(from, -1), k));
  return { avg: cur, delta: cur !== null && prev !== null ? cur - prev : null };
}

export type Note = { key: string; vars?: Record<string, string | number> };
export type Readiness = { level: 'ready' | 'normal' | 'easy' | 'unknown'; reasons: Note[] };

/** How the athlete comes into today, from last night against their own last 30 days. Guidance, not a diagnosis. */
export function readiness(days: Days, today: string): Readiness {
  const t = days.get(today);
  const from = addDays(today, -30), to = addDays(today, -1);
  const hrvBase = mean(values(days, from, to, 'hrvMs'));
  const rhrBase = mean(values(days, from, to, 'restingHr'));
  const enough = (k: keyof HealthDay) => values(days, from, to, k).length >= 5;
  let score = 0, signals = 0;
  const reasons: Note[] = [];

  if (t?.hrvMs != null && hrvBase && enough('hrvMs')) {
    signals++;
    const pct = ((t.hrvMs - hrvBase) / hrvBase) * 100;
    if (pct <= -15) score -= 2;
    else if (pct <= -7) score -= 1;
    else if (pct >= 7) score += 1;
    reasons.push({ key: pct <= -7 ? 'health.why.hrvLow' : pct >= 7 ? 'health.why.hrvHigh' : 'health.why.hrvNormal', vars: { v: Math.round(t.hrvMs), base: Math.round(hrvBase) } });
  }
  if (t?.restingHr != null && rhrBase && enough('restingHr')) {
    signals++;
    const diff = t.restingHr - rhrBase;
    if (diff >= 5) score -= 2;
    else if (diff >= 3) score -= 1;
    else if (diff <= -2) score += 1;
    reasons.push({ key: diff >= 3 ? 'health.why.rhrHigh' : diff <= -2 ? 'health.why.rhrLow' : 'health.why.rhrNormal', vars: { v: Math.round(t.restingHr), base: Math.round(rhrBase) } });
  }
  if (t?.sleepMin != null) {
    signals++;
    if (t.sleepMin < 360) score -= 2;
    else if (t.sleepMin < 420) score -= 1;
    else if (t.sleepMin >= 450) score += 1;
    reasons.push({ key: t.sleepMin < 420 ? 'health.why.sleepShort' : 'health.why.sleepOk', vars: { v: hm(t.sleepMin) } });
  }
  if (!signals) return { level: 'unknown', reasons: [] };
  return { level: score <= -2 ? 'easy' : score >= 1 ? 'ready' : 'normal', reasons };
}

/** What the numbers say over from..to: links between sleep, heart and training worth telling the athlete. */
export function insights(days: Days, from: string, to: string, trainingDays: Set<string>): Note[] {
  const out: Note[] = [];
  const range = daysBetween(from, to);
  const pick = (pred: (d: HealthDay, day: string) => boolean, k: keyof HealthDay) =>
    range.flatMap((day) => {
      const d = days.get(day);
      const v = d?.[k];
      return d && typeof v === 'number' && pred(d, day) ? [v] : [];
    });

  // Sleep the night before training vs other nights (sleep counts for the day they woke up).
  const sTrain = pick((_, day) => trainingDays.has(day), 'sleepMin');
  const sRest = pick((_, day) => !trainingDays.has(day), 'sleepMin');
  if (sTrain.length >= 3 && sRest.length >= 3) {
    const a = mean(sTrain)!, b = mean(sRest)!;
    if (Math.abs(a - b) >= 15) out.push({ key: a < b ? 'health.ins.sleepBeforeTrainLess' : 'health.ins.sleepBeforeTrainMore', vars: { a: hm(a), b: hm(b) } });
  }

  // Short nights and HRV.
  const hShort = pick((d) => d.sleepMin != null && d.sleepMin < 420, 'hrvMs');
  const hLong = pick((d) => d.sleepMin != null && d.sleepMin >= 420, 'hrvMs');
  if (hShort.length >= 3 && hLong.length >= 3) {
    const diff = mean(hLong)! - mean(hShort)!;
    if (diff >= 3) out.push({ key: 'health.ins.shortSleepHrv', vars: { d: Math.round(diff) } });
  }

  // Resting heart rate: the last week against the three before.
  const rhrWeek = mean(values(days, addDays(to, -6), to, 'restingHr'));
  const rhrBefore = values(days, addDays(to, -27), addDays(to, -7), 'restingHr');
  if (rhrWeek !== null && rhrBefore.length >= 7) {
    const diff = rhrWeek - mean(rhrBefore)!;
    if (diff >= 3) out.push({ key: 'health.ins.rhrUp', vars: { d: Math.round(diff) } });
    else if (diff <= -2) out.push({ key: 'health.ins.rhrDown', vars: { d: Math.round(-diff) } });
  }

  // A steady bedtime helps recovery.
  const beds = range.flatMap((day) => {
    const b = days.get(day)?.bedAt;
    if (!b) return [];
    const d = new Date(b);
    let m = d.getHours() * 60 + d.getMinutes();
    if (m < 12 * 60) m += 24 * 60; // after midnight counts as late, not early
    return [m];
  });
  if (beds.length >= 5) {
    const avg = mean(beds)!;
    const sd = Math.sqrt(mean(beds.map((m) => (m - avg) ** 2))!);
    if (sd >= 45) out.push({ key: 'health.ins.bedtime', vars: { d: Math.round(sd) } });
  }

  // Training this period.
  const trained = range.filter((d) => trainingDays.has(d)).length;
  if (trained) {
    const calTrain = pick((_, day) => trainingDays.has(day), 'calories');
    const calRest = pick((_, day) => !trainingDays.has(day), 'calories');
    if (calTrain.length >= 2 && calRest.length >= 2) {
      const diff = mean(calTrain)! - mean(calRest)!;
      if (diff >= 100) out.push({ key: 'health.ins.trainCalories', vars: { n: trained, d: Math.round(diff) } });
    }
  }
  return out;
}
