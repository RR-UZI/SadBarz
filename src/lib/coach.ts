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
  code: string | null; // other athletes redeem it to get the plan's routines (only admins can read it)
  codeError?: string; // why the code couldn't be read, shown instead of hiding it
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
  // Codes are only readable through plan_code(), which answers admins only.
  const read = data.status === 'approved' ? await supabase.rpc('plan_code', { plan_id: id }) : null;
  const code = (read?.data as string | null) ?? null;
  const codeError = read && !code ? read.error?.message ?? 'no code' : undefined;
  return {
    id: data.id,
    status: data.status,
    weeks: data.weeks,
    startDate: data.start_date,
    code,
    codeError,
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

/** Every exercise id the plan's routines use. */
export function planExerciseIds(plan: CoachPlan): Set<string> {
  return new Set(plan.days.flatMap((d) => d.routine.blocks.flatMap((b) => [...b.items, ...b.rows.flatMap((r) => r.items)].map((it) => it.exerciseId))));
}

/**
 * Approve as written, or with Uzi's edits (kept apart so the coach can learn from them).
 * Exercises Uzi created and put in the plan exist only in his account, so they're added to the
 * plan's exercise list: the athlete's app and anyone who redeems the code add them from there.
 */
export async function approvePlan(plan: ReviewPlan, reviewer: string, edited: CoachPlan | null, mine: Exercise[]): Promise<void> {
  if (!supabase) return;
  const week = edited ?? plan.plan;
  const have = new Set((plan.input.exercises ?? []).map((e) => e.id));
  const used = week ? planExerciseIds(week) : new Set<string>();
  const extra = mine.filter((e) => e.custom && used.has(e.id) && !have.has(e.id)).map(({ id, name, kind, category }) => ({ id, name, kind, category }));
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('coach_plans')
    .update({
      status: 'approved',
      approved_plan: edited,
      reviewed_by: reviewer,
      reviewed_at: now,
      updated_at: now,
      ...(extra.length ? { input: { ...plan.input, exercises: [...(plan.input.exercises ?? []), ...extra] } } : null),
    })
    .eq('id', plan.id);
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

// ---------- Mi plan (the athlete's latest approved plan) ----------

export interface MyPlan {
  id: string;
  weeks: PlanWeeks;
  startDate: string; // YYYY-MM-DD, the first day of week 1
  progression: string;
  /** One routine per training day (0 = Monday), in day order. */
  days: { day: number; routine: Routine }[];
  /** Exercises the routines use that may not be in this athlete's app (ones the coach created). */
  exercises?: Exercise[];
}

// Kept on the device too, so the plan opens with no signal at the gym.
const myPlanKey = (userId: string) => `sadbarz:my-plan:${userId}`;
const PREVIEW_PLAN_KEY = 'sadbarz:preview-plan';
const memo = new Map<string, MyPlan | null>();

function toMyPlan(row: {
  id: string;
  weeks: PlanWeeks;
  start_date: string | null;
  created_at: string;
  plan: CoachPlan | null;
  approved_plan: CoachPlan | null;
  exercises?: unknown;
}): MyPlan | null {
  const plan = row.approved_plan ?? row.plan;
  if (!plan?.days?.length) return null;
  const used = planExerciseIds(plan);
  return {
    id: row.id,
    weeks: row.weeks,
    startDate: row.start_date ?? row.created_at.slice(0, 10),
    progression: plan.progression ?? '',
    days: [...plan.days]
      .sort((a, b) => a.day - b.day)
      // A stable id per plan and day, so the workouts done can be matched to the plan's days.
      .map((d) => ({ day: d.day, routine: { ...d.routine, id: `plan_${row.id}_${d.day}` } })),
    exercises: (Array.isArray(row.exercises) ? (row.exercises as Exercise[]) : []).filter((e) => used.has(e.id)),
  };
}

/** What this device last saw, right away. */
export async function cachedPlan(userId: string): Promise<MyPlan | null> {
  if (memo.has(userId)) return memo.get(userId) ?? null;
  const saved = await AsyncStorage.getItem(supabase ? myPlanKey(userId) : PREVIEW_PLAN_KEY).catch(() => null);
  try {
    return saved ? (JSON.parse(saved) as MyPlan) : null;
  } catch {
    return null;
  }
}

/** The latest approved plan from the server (the cached one when offline). */
export async function myPlan(userId: string): Promise<MyPlan | null> {
  if (!supabase) return cachedPlan(userId);
  const { data, error } = await supabase
    .from('coach_plans')
    .select('id, weeks, start_date, created_at, plan, approved_plan, exercises:input->exercises')
    // Admins can read every plan, so ask for this user's own.
    .eq('user_id', userId)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) return cachedPlan(userId);
  const plan = data ? toMyPlan(data) : null;
  memo.set(userId, plan);
  if (plan) AsyncStorage.setItem(myPlanKey(userId), JSON.stringify(plan)).catch(() => {});
  else AsyncStorage.removeItem(myPlanKey(userId)).catch(() => {});
  return plan;
}

export type PlanPhase = 'upcoming' | 'active' | 'ended';

/** Where today falls in the plan. Dates are local calendar days. */
export function planTiming(plan: MyPlan, today: string) {
  const day = 86_400_000;
  const [sy, sm, sd] = plan.startDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  // UTC on both sides keeps daylight saving changes out of the day count.
  const sinceStart = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / day);
  const total = plan.weeks * 7;
  const end = new Date(Date.UTC(sy, sm - 1, sd) + (total - 1) * day);
  const phase: PlanPhase = sinceStart < 0 ? 'upcoming' : sinceStart >= total ? 'ended' : 'active';
  return {
    phase,
    week: Math.min(plan.weeks, Math.max(1, Math.floor(sinceStart / 7) + 1)),
    daysLeft: Math.max(0, Math.min(total, total - sinceStart)), // today included
    endDate: `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`,
  };
}

// ---------- Plan codes ----------
// Every plan has a code (SB-7K4QXM) that only Uzi sees and hands out. Redeeming one adds that plan's routines to Rutinas.
// The server checks the limit: Free 1 code a month, Pro as many as they like.

export type RedeemError = 'not_found' | 'limit' | 'auth' | 'offline' | 'failed';

export interface Redeemed {
  code: string;
  weeks: PlanWeeks;
  progression: string;
  days: { day: number; routine: Routine }[];
  /** The exercises the routines use, so ones the redeemer doesn't have can be added. */
  exercises: Exercise[];
}

export type RedeemResult = { ok: true; plan: Redeemed } | { ok: false; error: RedeemError; next?: string };

export async function redeemCode(code: string): Promise<RedeemResult> {
  if (!supabase) return { ok: false, error: 'offline' };
  const { data, error } = await supabase.rpc('redeem_plan_code', { plan_code: code });
  if (error) return { ok: false, error: 'failed' };
  const answer = (data ?? {}) as Partial<Redeemed> & { error?: string; next?: string };
  if (answer.error) {
    const known: RedeemError[] = ['not_found', 'limit', 'auth'];
    return { ok: false, error: known.includes(answer.error as RedeemError) ? (answer.error as RedeemError) : 'failed', next: answer.next };
  }
  if (!answer.code || !Array.isArray(answer.days)) return { ok: false, error: 'failed' };
  return {
    ok: true,
    plan: {
      code: answer.code,
      weeks: answer.weeks ?? 1,
      progression: answer.progression ?? '',
      days: [...answer.days].sort((a, b) => a.day - b.day),
      exercises: Array.isArray(answer.exercises) ? answer.exercises : [],
    },
  };
}
