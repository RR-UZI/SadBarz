// Free vs Pro. The plan lives in the account's app_metadata (`plan: 'pro'`),
// which only the server can change, so a user can't make themselves Pro.
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import type { Routine } from '../types';

export type Plan = 'free' | 'pro';

/** Own routines a free account can keep. The examples and routines from plan codes don't count. */
export const FREE_ROUTINE_LIMIT = 5;

export function ownRoutines(routines: Routine[]) {
  return routines.filter((r) => !r.example && !r.fromCode);
}

export function useRoutineLimit() {
  const { user } = useAuth();
  const { routines } = useApp();
  const isPro = user?.plan === 'pro';
  const used = ownRoutines(routines).length;
  return { isPro, used, limit: FREE_ROUTINE_LIMIT, canAdd: isPro || used < FREE_ROUTINE_LIMIT };
}

// The Pro pop-up is drawn by <ProHost />; screens open it with showPro().
export type ProReason = 'routineLimit' | 'info';
let open: ((reason: ProReason) => void) | null = null;

export function registerProHost(fn: ((reason: ProReason) => void) | null) {
  open = fn;
}

export function showPro(reason: ProReason = 'info') {
  open?.(reason);
}
