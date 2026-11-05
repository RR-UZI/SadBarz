// The shared exercise pool: exercises people made that an admin approved, for everyone.
// Each person's own exercises still live in their data (usable right away); the pool adds
// the approved ones of others. Admins review what's waiting (Home → Ejercicios nuevos).
// On Supabase: supabase/migrations/20261105000000_exercise_pool.sql. In the preview build
// everything stays on this device, so the review reads the device's accounts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import type { Category, Exercise, ExerciseKind } from '../types';
import { supabase } from './supabase';

const CACHE = 'sadbarz:shared-exercises';
const PREVIEW_POOL = 'sadbarz:preview-shared-exercises';
const PREVIEW_REVIEWS = 'sadbarz:preview-exercise-reviews';
const REFRESH_MS = 5 * 60_000;

const KINDS: ExerciseKind[] = ['reps', 'hold', 'distance', 'calories'];
const CATEGORIES: Category[] = ['push', 'pull', 'legs', 'core', 'tubos', 'cardio', 'skills'];

function clean(rows: unknown): Exercise[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .filter((r) => typeof r.id === 'string' && typeof r.name === 'string' && KINDS.includes(r.kind as ExerciseKind) && CATEGORIES.includes(r.category as Category))
    .map((r) => ({ id: r.id as string, name: r.name as string, kind: r.kind as ExerciseKind, category: r.category as Category, shared: true }));
}

// ---------- the pool, kept in memory and on the device ----------

let pool: Exercise[] = [];
let loaded = false;
let lastFetch = 0;
const listeners = new Set<(p: Exercise[]) => void>();
const publish = (p: Exercise[]) => {
  pool = p;
  listeners.forEach((l) => l(p));
};

async function fetchPool(): Promise<Exercise[]> {
  if (supabase) {
    const { data, error } = await supabase.from('shared_exercises').select('id, name, kind, category').order('name');
    if (error) throw error;
    return clean(data);
  }
  return clean(JSON.parse((await AsyncStorage.getItem(PREVIEW_POOL)) ?? '[]'));
}

/** Fetch the pool again (on start, coming back to the app, after an admin approves one). */
export async function refreshPool(force = false) {
  if (!force && Date.now() - lastFetch < REFRESH_MS) return;
  lastFetch = Date.now();
  try {
    const p = await fetchPool();
    publish(p);
    AsyncStorage.setItem(CACHE, JSON.stringify(p)).catch(() => {});
  } catch {
    // offline or the table isn't there yet: keep what we have
  }
}

function start() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(CACHE)
    .then((c) => {
      if (c && pool.length === 0) publish(clean(JSON.parse(c)));
    })
    .catch(() => {})
    .finally(() => refreshPool(true));
  const again = () => refreshPool();
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && again());
  } else {
    AppState.addEventListener('change', (s) => s === 'active' && again());
  }
}

/** The approved exercises everyone gets. */
export function useExercisePool(): Exercise[] {
  const [p, setP] = useState(pool);
  useEffect(() => {
    start();
    listeners.add(setP);
    setP(pool);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
}

// ---------- admins: review what people made ----------

export interface WaitingExercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  category: Category;
  userName?: string;
  email?: string;
  accounts: number; // how many accounts have it (routines from a code bring exercises along)
}

export async function exercisesToReview(): Promise<WaitingExercise[]> {
  if (supabase) {
    const { data, error } = await supabase.rpc('exercises_to_review');
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[])
      .filter((r) => KINDS.includes(r.kind as ExerciseKind))
      .map((r) => ({
        id: r.id as string,
        name: String(r.name ?? ''),
        kind: r.kind as ExerciseKind,
        category: CATEGORIES.includes(r.category as Category) ? (r.category as Category) : 'push',
        userName: (r.user_name as string | null) ?? undefined,
        email: (r.email as string | null) ?? undefined,
        accounts: Number(r.accounts ?? 1),
      }));
  }
  // Preview: every account's data on this device.
  const reviewed: Record<string, string> = JSON.parse((await AsyncStorage.getItem(PREVIEW_REVIEWS)) ?? '{}');
  const shared = new Set(clean(JSON.parse((await AsyncStorage.getItem(PREVIEW_POOL)) ?? '[]')).map((e) => e.id));
  const accounts: Record<string, { id: string; name: string }> = JSON.parse((await AsyncStorage.getItem('sadbarz:preview-accounts')) ?? '{}');
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('sadbarz:v1:'));
  const out = new Map<string, WaitingExercise>();
  for (const k of keys) {
    const email = Object.keys(accounts).find((e) => `sadbarz:v1:${accounts[e].id}` === k);
    const d = JSON.parse((await AsyncStorage.getItem(k)) ?? '{}') as { exercises?: Exercise[] };
    for (const e of d.exercises ?? []) {
      if (!e.custom || reviewed[e.id] || shared.has(e.id)) continue;
      const seen = out.get(e.id);
      if (seen) seen.accounts += 1;
      else out.set(e.id, { id: e.id, name: e.name, kind: e.kind, category: e.category, userName: email ? accounts[email].name : undefined, email, accounts: 1 });
    }
  }
  return [...out.values()];
}

// `refresh` false skips reloading everyone's list (Approve all reloads it once at the end).
export async function reviewExercise(ex: WaitingExercise, approve: boolean, name: string, category: Category, refresh = true): Promise<void> {
  if (supabase) {
    const { error } = await supabase.rpc('review_exercise', { exercise_id: ex.id, approve, new_name: name, new_category: category });
    if (error) throw error;
  } else {
    const reviewed: Record<string, string> = JSON.parse((await AsyncStorage.getItem(PREVIEW_REVIEWS)) ?? '{}');
    reviewed[ex.id] = approve ? 'approved' : 'rejected';
    await AsyncStorage.setItem(PREVIEW_REVIEWS, JSON.stringify(reviewed));
    if (approve) {
      const p = clean(JSON.parse((await AsyncStorage.getItem(PREVIEW_POOL)) ?? '[]')).filter((e) => e.id !== ex.id);
      await AsyncStorage.setItem(PREVIEW_POOL, JSON.stringify([...p, { id: ex.id, name: name.trim() || ex.name, kind: ex.kind, category }]));
    }
  }
  if (approve && refresh) await refreshPool(true);
}
