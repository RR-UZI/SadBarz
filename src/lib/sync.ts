// Cloud copy of each user's data: one row per user in the Supabase table
// `user_data`, readable and writable only by that user (row level security,
// see supabase/migrations). Devices merge their copy with the cloud one, so a
// routine made on the laptop shows up on the phone and the other way round.
import type { Exercise, PersonalRecord, Routine, Settings, Workout } from '../types';
import { supabase } from './supabase';

export const SYNC_TABLE = 'user_data';

// What is shared between a user's devices.
export interface Synced {
  routines: Routine[];
  workouts: Workout[];
  exercises: Exercise[]; // the user's own exercises only
  settings: Settings;
  settingsAt: number; // when the settings last changed
  deleted: Record<string, number>; // id -> when it was deleted, so a delete reaches every device
  avatar: string | null; // profile photo, a small JPEG data URL
  avatarAt: number; // when the photo last changed
  records: PersonalRecord[];
}

export const syncEnabled = !!supabase;

export async function pullRemote(userId: string): Promise<Partial<Synced> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from(SYNC_TABLE).select('data').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data?.data as Partial<Synced> | undefined) ?? null;
}

export async function pushRemote(userId: string, synced: Synced): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(SYNC_TABLE).upsert({ user_id: userId, data: synced, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Items from both lists by id; `pick` chooses when both have it. Items only in `b` go first.
function byId<T extends { id: string }>(a: T[], b: T[], pick: (x: T, y: T) => T): T[] {
  const inA = new Map(a.map((x) => [x.id, x]));
  const onlyB = b.filter((y) => !inA.has(y.id));
  const inB = new Map(b.map((y) => [y.id, y]));
  return [...onlyB, ...a.map((x) => (inB.has(x.id) ? pick(x, inB.get(x.id)!) : x))];
}

// Combines two copies: everything from both, the newest version of each routine and renamed exercise,
// newest settings and photo, and anything deleted on either side stays deleted.
export function mergeSynced(local: Synced, remote: Partial<Synced>): Synced {
  const deleted = { ...(remote.deleted ?? {}) };
  for (const [id, at] of Object.entries(local.deleted)) deleted[id] = Math.max(at, deleted[id] ?? 0);

  // An example nobody touched loses to an edited copy, even an older one: every device
  // creates the examples fresh, so "newest" would otherwise undo the user's changes.
  const pristine = (r: Routine) => !!r.example && r.updatedAt === r.createdAt;
  const routines = byId(local.routines, remote.routines ?? [], (x, y) =>
    pristine(x) !== pristine(y) ? (pristine(x) ? y : x) : y.updatedAt > x.updatedAt ? y : x,
  )
    // a routine edited after it was deleted on another device comes back
    .filter((r) => !(r.id in deleted) || (!pristine(r) && r.updatedAt > deleted[r.id]));
  const workouts = byId(local.workouts, remote.workouts ?? [], (x) => x)
    .filter((w) => !(w.id in deleted))
    .sort((x, y) => y.startedAt - x.startedAt);
  const exercises = byId(local.exercises, remote.exercises ?? [], (x, y) => ((y.updatedAt ?? 0) > (x.updatedAt ?? 0) ? y : x)).filter((e) => !(e.id in deleted));
  const records = byId(local.records, remote.records ?? [], (x, y) => (y.updatedAt > x.updatedAt ? y : x)).filter((r) => !(r.id in deleted));

  // On a tie the cloud wins, so two devices never keep overwriting each other.
  const remoteNewer = !!remote.settings && (remote.settingsAt ?? 0) >= local.settingsAt;
  const remotePhoto = remote.avatarAt != null && remote.avatarAt >= local.avatarAt;
  return {
    routines,
    workouts,
    exercises,
    settings: remoteNewer ? { ...local.settings, ...remote.settings } : local.settings,
    settingsAt: remoteNewer ? (remote.settingsAt ?? 0) : local.settingsAt,
    deleted,
    avatar: remotePhoto ? (remote.avatar ?? null) : local.avatar,
    avatarAt: remotePhoto ? remote.avatarAt! : local.avatarAt,
    records,
  };
}

// Stable text for "did anything change?" checks. Keys are sorted because the
// database (jsonb) does not keep the order they were written in.
export function syncedKey(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v,
  );
}
