// The AI coach (Pro). The app asks the server function `coach-plan` to write a
// plan; the plan waits for Uzi's review in the table coach_plans, and only the
// status of the latest one comes back here until he approves it (see
// supabase/functions/coach-plan and supabase/migrations).
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Exercise, Goal, Language, Profile, Routine } from '../types';
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

export type AskResult = { ok: true } | { ok: false; error: AskError; detail: string };

export async function askForPlan(weeks: PlanWeeks, exercises: Exercise[], language: Language): Promise<AskResult> {
  const body = { weeks, today: isoDay(Date.now()), language, exercises: exercises.map(({ id, name, kind, category }) => ({ id, name, kind, category })) };
  if (!supabase) {
    const status: CoachPlanStatus = { id: 'preview', status: 'review', weeks, startDate: body.today, createdAt: new Date().toISOString() };
    await AsyncStorage.setItem(PREVIEW_KEY, JSON.stringify(status)).catch(() => {});
    return { ok: true };
  }
  const { error } = await supabase.functions.invoke('coach-plan', { body });
  if (!error) return { ok: true };
  // The function answers { error: 'limit' | 'profile' | 'pro' | ..., detail? } with the status code.
  // Anything else (the gateway refusing the call, no network) keeps its own message for the admin view.
  const res = (error as { context?: Response }).context;
  let answer: { error?: string; detail?: string; message?: string; msg?: string } = {};
  if (res && typeof res.text === 'function') {
    const raw = await res.text().catch(() => '');
    try {
      answer = JSON.parse(raw);
    } catch {
      answer = { message: raw.slice(0, 200) };
    }
  }
  const code = answer.error;
  const detail = [res?.status, code, answer.detail ?? answer.message ?? answer.msg ?? (res ? undefined : error.message)].filter(Boolean).join(' · ');
  return { ok: false, error: code === 'limit' || code === 'profile' || code === 'pro' ? code : 'failed', detail };
}

/** Admins only (row level security): why a plan failed, as the server saved it. */
export async function planError(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('coach_plans').select('error').eq('id', id).maybeSingle();
  return (data as { error: string | null } | null)?.error ?? null;
}

// ---------- Uzi's review (admins only; row level security lets admins read and update every plan) ----------

/** A plan as the coach writes it: one routine per training day (0 = Monday). */
export interface CoachPlan {
  summary: string;
  progression: string;
  days: { day: number; routine: Routine }[];
}

export interface PlanInput {
  athlete?: { name?: string };
  profile?: Partial<Profile>;
  records?: unknown[];
  recentWorkouts?: unknown[];
  exercises?: Exercise[];
  revisions?: { note: string; at: string }[];
}

export interface ReviewItem {
  id: string;
  status: CoachStatus;
  weeks: PlanWeeks;
  createdAt: string;
  updatedAt: string;
  name?: string;
  goal?: Goal;
}

export interface ReviewPlan extends ReviewItem {
  startDate: string | null;
  input: PlanInput;
  plan: CoachPlan | null;
  approvedPlan: CoachPlan | null;
  reviewNote: string | null;
  error: string | null;
}

/** Waiting for review first (oldest first), then the latest reviewed ones. */
export async function reviewList(): Promise<{ pending: ReviewItem[]; recent: ReviewItem[] }> {
  if (!supabase) return { pending: [], recent: [] };
  const cols = 'id, status, weeks, created_at, updated_at, name:input->athlete->>name, goal:input->profile->>goal';
  const [p, r] = await Promise.all([
    supabase.from('coach_plans').select(cols).in('status', ['writing', 'review', 'returned']).order('created_at', { ascending: true }),
    supabase.from('coach_plans').select(cols).in('status', ['approved', 'failed']).order('updated_at', { ascending: false }).limit(15),
  ]);
  if (p.error) throw p.error;
  if (r.error) throw r.error;
  const item = (x: Record<string, unknown>): ReviewItem => ({
    id: x.id as string,
    status: x.status as CoachStatus,
    weeks: x.weeks as PlanWeeks,
    createdAt: x.created_at as string,
    updatedAt: x.updated_at as string,
    name: (x.name as string | null) ?? undefined,
    goal: (x.goal as Goal | null) ?? undefined,
  });
  return { pending: (p.data ?? []).map(item), recent: (r.data ?? []).map(item) };
}

export async function loadPlan(id: string): Promise<ReviewPlan | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('coach_plans')
    .select('id, status, weeks, start_date, created_at, updated_at, input, plan, approved_plan, review_note, error')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const input = (data.input ?? {}) as PlanInput;
  return {
    id: data.id,
    status: data.status,
    weeks: data.weeks,
    startDate: data.start_date,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    name: input.athlete?.name,
    goal: input.profile?.goal,
    input,
    plan: data.plan,
    approvedPlan: data.approved_plan,
    reviewNote: data.review_note,
    error: data.error,
  };
}

/** Approve as written, or with Uzi's edits (kept apart so the coach can learn from them). */
export async function approvePlan(id: string, reviewer: string, edited: CoachPlan | null): Promise<void> {
  if (!supabase) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('coach_plans')
    .update({ status: 'approved', approved_plan: edited, reviewed_by: reviewer, reviewed_at: now, updated_at: now })
    .eq('id', id);
  if (error) throw error;
}

/** Send it back with a note: the coach writes it again following the note. */
export async function sendBack(id: string, note: string, exercises: Exercise[]): Promise<AskResult> {
  if (!supabase) return { ok: true };
  const { error } = await supabase.functions.invoke('coach-plan', {
    body: { rewrite: id, note, exercises: exercises.map(({ id: exId, name, kind, category }) => ({ id: exId, name, kind, category })) },
  });
  if (!error) return { ok: true };
  const res = (error as { context?: Response }).context;
  const raw = res && typeof res.text === 'function' ? await res.text().catch(() => '') : '';
  return { ok: false, error: 'failed', detail: [res?.status, raw.slice(0, 200) || error.message].filter(Boolean).join(' · ') };
}

// Screens that show plans listen here, so a review on one screen updates the others.
const listeners = new Set<() => void>();
export function onPlansChanged(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function plansChanged() {
  listeners.forEach((fn) => fn());
}
