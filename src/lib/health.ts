// Health tab data: the athlete's daily numbers from Google Health (Fitbit, Pixel Watch).
// Stored in Supabase (health_days); the health-google Edge Function connects Google and syncs it.
// Preview mode has no server: connecting shows made-up example numbers.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export interface HealthDay {
  day: string; // YYYY-MM-DD, the athlete's calendar day (sleep counts for the day they woke up)
  sleepMin?: number | null;
  sleepDeepMin?: number | null;
  sleepRemMin?: number | null;
  sleepLightMin?: number | null;
  sleepAwakeMin?: number | null;
  bedAt?: string | null;
  wakeAt?: string | null;
  restingHr?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  hrvMs?: number | null;
  steps?: number | null;
  calories?: number | null;
}

export interface HealthLink {
  configured: boolean;
  connected: boolean;
  lastSync: string | null;
  error: string | null;
}

const COLUMNS: [keyof HealthDay, string][] = [
  ['sleepMin', 'sleep_min'],
  ['sleepDeepMin', 'sleep_deep_min'],
  ['sleepRemMin', 'sleep_rem_min'],
  ['sleepLightMin', 'sleep_light_min'],
  ['sleepAwakeMin', 'sleep_awake_min'],
  ['bedAt', 'bed_at'],
  ['wakeAt', 'wake_at'],
  ['restingHr', 'resting_hr'],
  ['avgHr', 'avg_hr'],
  ['maxHr', 'max_hr'],
  ['hrvMs', 'hrv_ms'],
  ['steps', 'steps'],
  ['calories', 'calories'],
];

const DAY_MS = 86_400_000;
export const localDay = (ts: number = Date.now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + n, 12).getTime());
};
/** The days from..to, both included. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

const PREVIEW_LINK = 'sadbarz:preview-health-link';

function fromRow(r: Record<string, unknown>): HealthDay {
  const out: HealthDay = { day: String(r.day) };
  for (const [k, col] of COLUMNS) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    (out as unknown as Record<string, unknown>)[k] = typeof v === 'string' && k !== 'bedAt' && k !== 'wakeAt' ? Number(v) : v;
  }
  return out;
}

/** The athlete's days from..to (both included), by day. */
export async function loadHealth(userId: string, from: string, to: string): Promise<Map<string, HealthDay>> {
  const byDay = (rows: HealthDay[]) => new Map(rows.map((d) => [d.day, d]));
  if (!supabase) return byDay((await previewLinked()) ? demoDays(from, to) : []);
  const { data, error } = await supabase
    .from('health_days')
    .select('*')
    .eq('user_id', userId)
    .gte('day', from)
    .lte('day', to)
    .order('day');
  if (error) throw error;
  return byDay((data ?? []).map((r) => fromRow(r as Record<string, unknown>)));
}

const previewLinked = async () => (await AsyncStorage.getItem(PREVIEW_LINK).catch(() => null)) === '1';

// ---------- Google Health ----------

async function fn(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!supabase) throw new Error('preview');
  const { data, error } = await supabase.functions.invoke('health-google', { body: { today: localDay(), ...body } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const out = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as Record<string, unknown>) : {};
    throw new Error(String(out.error ?? 'failed'));
  }
  return (data ?? {}) as Record<string, unknown>;
}

export async function healthLink(): Promise<HealthLink> {
  if (!supabase) {
    const linked = await previewLinked();
    return { configured: true, connected: linked, lastSync: linked ? new Date(Date.now() - 2 * 3600_000).toISOString() : null, error: null };
  }
  const r = await fn({ action: 'status' }).catch(() => null);
  // No function yet (not deployed) reads as "not set up".
  if (!r) return { configured: false, connected: false, lastSync: null, error: null };
  return { configured: !!r.configured, connected: !!r.connected, lastSync: (r.lastSync as string) ?? null, error: (r.error as string) ?? null };
}

const redirectUri = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://sadbarz.com/');

/** Sends the athlete to Google to allow SadBarz to read their health data. */
export async function connectGoogle(): Promise<void> {
  if (!supabase) {
    await AsyncStorage.setItem(PREVIEW_LINK, '1');
    return;
  }
  const r = await fn({ action: 'start', redirect: redirectUri() });
  if (typeof r.url !== 'string') throw new Error('failed');
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(r.url);
}

// Google sends the athlete back to the app with ?code=...&state=health.... Read once at start.
let returned: { code?: string; state?: string; error?: string } | null | undefined;
export function googleReturn(): { code?: string; state?: string; error?: string } | null {
  if (returned !== undefined) return returned;
  returned = null;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const state = params.get('state') ?? '';
  if (!state.startsWith('health.')) return null;
  returned = { code: params.get('code') ?? undefined, state, error: params.get('error') ?? undefined };
  window.history.replaceState(null, '', window.location.pathname);
  return returned;
}
export const clearGoogleReturn = () => {
  returned = null;
};

export async function finishGoogle(code: string, state: string): Promise<number> {
  const r = await fn({ action: 'finish', code, state, redirect: redirectUri() });
  return Number(r.days ?? 0);
}

export async function syncGoogle(days?: number): Promise<number> {
  if (!supabase) return 0;
  const r = await fn({ action: 'sync', ...(days ? { days } : {}) });
  return Number(r.days ?? 0);
}

export async function disconnectGoogle(): Promise<void> {
  if (!supabase) {
    await AsyncStorage.removeItem(PREVIEW_LINK);
    return;
  }
  await fn({ action: 'disconnect' });
}

// ---------- Preview examples ----------

// Repeatable made-up numbers, so preview builds show the charts.
function demoDays(from: string, to: string): HealthDay[] {
  const today = localDay();
  return daysBetween(from, to < today ? to : today).map((day) => {
    const n = Math.round(Date.parse(`${day}T12:00:00Z`) / DAY_MS);
    const r = (k: number) => ((Math.sin(n * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    const sleep = Math.round(330 + r(1) * 170);
    const [y, m, d] = day.split('-').map(Number);
    const wake = new Date(y, m - 1, d, 6, Math.round(r(11) * 120)).getTime();
    return {
      day,
      bedAt: new Date(wake - (sleep + 30) * 60_000).toISOString(),
      wakeAt: new Date(wake).toISOString(),
      sleepMin: sleep,
      sleepDeepMin: Math.round(sleep * (0.13 + r(2) * 0.08)),
      sleepRemMin: Math.round(sleep * (0.18 + r(3) * 0.07)),
      sleepLightMin: Math.round(sleep * 0.55),
      sleepAwakeMin: Math.round(20 + r(4) * 40),
      restingHr: Math.round(52 + r(5) * 8 + (sleep < 380 ? 3 : 0)),
      avgHr: Math.round(68 + r(6) * 10),
      maxHr: Math.round(150 + r(7) * 35),
      hrvMs: Math.round(48 + r(8) * 30 - (sleep < 380 ? 8 : 0)),
      steps: Math.round(4000 + r(9) * 9000),
      calories: Math.round(2100 + r(10) * 900),
    };
  });
}

// ---------- One day, hour by hour ----------

export interface DayHour {
  start: string;
  steps: number | null;
  calories: number | null;
  hrAvg: number | null;
  hrMin: number | null;
  hrMax: number | null;
}
export type StageType = 'AWAKE' | 'LIGHT' | 'DEEP' | 'REM' | 'ASLEEP' | 'RESTLESS';
export interface DayDetail {
  hours: DayHour[];
  sleep: { start: string | null; end: string | null; minutes: number; stages: { type: StageType; start: string; end: string }[] } | null;
  now: { bpm: number; at: string } | null;
}

/** A day hour by hour, read live from Google (today or yesterday). */
export async function loadDay(day: string): Promise<DayDetail> {
  const [y, m, d] = day.split('-').map(Number);
  const start = new Date(y, m - 1, d).toISOString();
  const end = new Date(y, m - 1, d + 1).toISOString();
  if (!supabase) return demoDay(day, start);
  const r = await fn({ action: 'day', day, start, end });
  return { hours: (r.hours as DayHour[]) ?? [], sleep: (r.sleep as DayDetail['sleep']) ?? null, now: (r.now as DayDetail['now']) ?? null };
}

function demoDay(day: string, start: string): DayDetail {
  const t0 = Date.parse(start);
  const isToday = day === localDay();
  const nowH = isToday ? new Date().getHours() : 24;
  const r = (k: number) => ((Math.sin((t0 / 3600_000 + k) * 12.9898) * 43758.5453) % 1 + 1) % 1;
  const hours: DayHour[] = Array.from({ length: 24 }, (_, h) => {
    if (h > nowH) return { start: new Date(t0 + h * 3600_000).toISOString(), steps: null, calories: null, hrAvg: null, hrMin: null, hrMax: null };
    const asleep = h < 7;
    const trained = h === 18;
    const hr = asleep ? 50 + r(h) * 6 : trained ? 128 + r(h) * 20 : 64 + r(h) * 18;
    return {
      start: new Date(t0 + h * 3600_000).toISOString(),
      steps: asleep ? 0 : Math.round((trained ? 1500 : 200) + r(h + 50) * 900),
      calories: Math.round(asleep ? 60 : trained ? 420 : 85 + r(h + 90) * 60),
      hrAvg: Math.round(hr),
      hrMin: Math.round(hr - 8),
      hrMax: Math.round(hr + (trained ? 45 : 22)),
    };
  });
  const bed = t0 - 75 * 60_000;
  const plan: [StageType, number][] = [['LIGHT', 25], ['DEEP', 55], ['LIGHT', 40], ['REM', 25], ['AWAKE', 6], ['LIGHT', 50], ['DEEP', 35], ['REM', 35], ['LIGHT', 60], ['REM', 40], ['AWAKE', 4], ['LIGHT', 45], ['REM', 30]];
  let t = bed;
  const stages = plan.map(([type, min]) => {
    const s = { type, start: new Date(t).toISOString(), end: new Date(t + min * 60_000).toISOString() };
    t += min * 60_000;
    return s;
  });
  return {
    hours,
    sleep: { start: new Date(bed).toISOString(), end: new Date(t).toISOString(), minutes: plan.filter(([s]) => s !== 'AWAKE').reduce((a, [, m]) => a + m, 0), stages },
    now: isToday ? { bpm: 72, at: new Date(Date.now() - 4 * 60_000).toISOString() } : null,
  };
}
