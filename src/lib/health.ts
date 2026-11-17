// Health tab data: the athlete's daily numbers from Google Health (Fitbit, Pixel Watch) and their own daily log.
// Stored in Supabase (health_days); the health-google Edge Function connects Google and syncs it.
// Preview mode has no server: the log stays on this device and the device numbers are made-up examples.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export interface HealthDay {
  day: string; // YYYY-MM-DD, the athlete's calendar day (sleep counts for the day they woke up)
  source: 'google' | 'manual';
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
  energy?: number | null; // manual 1..5
  soreness?: number | null; // manual 1..5
  note?: string | null;
}

/** One row per day: the device numbers, with the athlete's log on top (their sleep counts when the watch has none). */
export type MergedDay = Omit<HealthDay, 'source'> & { logged: boolean; device: boolean };

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
  ['energy', 'energy'],
  ['soreness', 'soreness'],
  ['note', 'note'],
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

const PREVIEW_LOG = 'sadbarz:preview-health-log';
const PREVIEW_LINK = 'sadbarz:preview-health-link';

function fromRow(r: Record<string, unknown>): HealthDay {
  const out: HealthDay = { day: String(r.day), source: r.source === 'manual' ? 'manual' : 'google' };
  for (const [k, col] of COLUMNS) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    (out as unknown as Record<string, unknown>)[k] = typeof v === 'string' && k !== 'note' && k !== 'bedAt' && k !== 'wakeAt' ? Number(v) : v;
  }
  return out;
}

/** The athlete's days from..to (both included), device and log. */
export async function loadHealth(userId: string, from: string, to: string): Promise<HealthDay[]> {
  if (!supabase) {
    const log = await previewLog();
    const link = await previewLinked();
    return [...(link ? demoDays(from, to) : []), ...log.filter((d) => d.day >= from && d.day <= to)];
  }
  const { data, error } = await supabase
    .from('health_days')
    .select('*')
    .eq('user_id', userId)
    .gte('day', from)
    .lte('day', to)
    .order('day');
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as Record<string, unknown>));
}

export function mergeDays(rows: HealthDay[]): Map<string, MergedDay> {
  const out = new Map<string, MergedDay>();
  for (const r of [...rows].sort((a, b) => (a.source === b.source ? 0 : a.source === 'google' ? -1 : 1))) {
    const prev = out.get(r.day) ?? { day: r.day, logged: false, device: false };
    const next: MergedDay = { ...prev, logged: prev.logged || r.source === 'manual', device: prev.device || r.source === 'google' };
    for (const [k] of COLUMNS) {
      const v = r[k];
      if (v === null || v === undefined) continue;
      // The athlete's log fills what the watch doesn't have; the watch's sleep wins when there is one.
      if (r.source === 'manual' && k === 'sleepMin' && prev.sleepMin != null) continue;
      (next as unknown as Record<string, unknown>)[k] = v;
    }
    out.set(r.day, next);
  }
  return out;
}

export type HealthLog = Pick<HealthDay, 'sleepMin' | 'energy' | 'soreness' | 'note'>;

/** Saves (or replaces) the athlete's log for a day. */
export async function saveLog(userId: string, day: string, log: HealthLog): Promise<void> {
  const clean = {
    sleep_min: log.sleepMin != null ? Math.max(0, Math.min(24 * 60, Math.round(log.sleepMin))) : null,
    energy: log.energy ?? null,
    soreness: log.soreness ?? null,
    note: log.note?.trim() ? log.note.trim().slice(0, 500) : null,
  };
  if (!supabase) {
    const all = (await previewLog()).filter((d) => d.day !== day);
    all.push({ day, source: 'manual', sleepMin: clean.sleep_min, energy: clean.energy, soreness: clean.soreness, note: clean.note });
    await AsyncStorage.setItem(PREVIEW_LOG, JSON.stringify(all));
    return;
  }
  const { error } = await supabase
    .from('health_days')
    .upsert({ user_id: userId, day, source: 'manual', ...clean, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day,source' });
  if (error) throw error;
}

async function previewLog(): Promise<HealthDay[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(PREVIEW_LOG)) ?? '[]') as HealthDay[];
  } catch {
    return [];
  }
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
      bedAt: new Date(wake - (sleep + 30) * 60_000).toISOString(),
      wakeAt: new Date(wake).toISOString(),
      day,
      source: 'google',
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
