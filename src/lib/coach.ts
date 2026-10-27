// The AI coach (Pro). The app asks the server function `coach-plan` to write a
// plan; the plan waits for Uzi's review in the table coach_plans, and only the
// status of the latest one comes back here until he approves it (see
// supabase/functions/coach-plan and supabase/migrations).
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Exercise, Language } from '../types';
import { supabase } from './supabase';
import { isoDay } from './records';

export type PlanWeeks = 1 | 2 | 4;
export const PLAN_WEEKS: PlanWeeks[] = [1, 2, 4];

// writing = the coach is writing it, review = waiting for Uzi, returned = Uzi asked for changes.
export type CoachStatus = 'writing' | 'review' | 'approved' | 'returned' | 'failed';

export interface CoachPlanStatus {
  id: string;
  status: CoachStatus;
  weeks: PlanWeeks;
  startDate: string | null;
  createdAt: string;
}

/** The athlete sees "your coach is reviewing your plan" for all of these. */
export const isWaiting = (s: CoachStatus | undefined) => s === 'writing' || s === 'review' || s === 'returned';

export type AskError = 'limit' | 'profile' | 'pro' | 'failed';

// Preview mode has no server: the request is kept on this device so the screens can be tried.
const PREVIEW_KEY = 'sadbarz:preview-coach';

export async function coachStatus(): Promise<CoachPlanStatus | null> {
  if (!supabase) {
    const saved = await AsyncStorage.getItem(PREVIEW_KEY).catch(() => null);
    return saved ? (JSON.parse(saved) as CoachPlanStatus) : null;
  }
  const { data, error } = await supabase.rpc('my_coach_plan_status');
  if (error) throw error;
  const row = (data as { id: string; status: CoachStatus; weeks: PlanWeeks; start_date: string | null; created_at: string }[] | null)?.[0];
  return row ? { id: row.id, status: row.status, weeks: row.weeks, startDate: row.start_date, createdAt: row.created_at } : null;
}

export async function askForPlan(weeks: PlanWeeks, exercises: Exercise[], language: Language): Promise<{ ok: true } | { ok: false; error: AskError }> {
  const body = { weeks, today: isoDay(Date.now()), language, exercises: exercises.map(({ id, name, kind, category }) => ({ id, name, kind, category })) };
  if (!supabase) {
    const status: CoachPlanStatus = { id: 'preview', status: 'review', weeks, startDate: body.today, createdAt: new Date().toISOString() };
    await AsyncStorage.setItem(PREVIEW_KEY, JSON.stringify(status)).catch(() => {});
    return { ok: true };
  }
  const { error } = await supabase.functions.invoke('coach-plan', { body });
  if (!error) return { ok: true };
  // The function answers { error: 'limit' | 'profile' | 'pro' | ... } with the status code.
  const res = (error as { context?: Response }).context;
  const code = res && typeof res.json === 'function' ? ((await res.json().catch(() => ({}))) as { error?: string }).error : undefined;
  return { ok: false, error: code === 'limit' || code === 'profile' || code === 'pro' ? code : 'failed' };
}
