// The workout in progress, saved on the device as it goes, so leaving the workout screen
// (back button, closing the tab, the phone killing the page) doesn't lose it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { AmrapScore, BlockLog, ForTimeScore, LogEntry, Routine } from '../types';

const KEY = 'sadbarz:active-workout';
// Older than this it's a workout someone forgot about, not one to pick up again.
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Where a running block's timer was: the clock and whatever the block's runner keeps (round, set, splits...).
export type RunState = { ms: number } & Record<string, unknown>;

export type SavedPhase =
  | { kind: 'ready'; afterBreak?: boolean }
  | { kind: 'running' }
  | { kind: 'review'; durationSec: number }
  | { kind: 'pickBreak'; nextIndex: number }
  | { kind: 'summary' };

export interface ActiveWorkout {
  userId: string | null;
  routine: Routine; // as it was when the workout started, so edits made meanwhile don't scramble it
  index: number;
  phase: SavedPhase;
  logs: BlockLog[];
  entries: LogEntry[];
  score?: AmrapScore;
  forTime?: ForTimeScore;
  run?: RunState;
  startedAt: number;
  savedAt: number;
}

let current: ActiveWorkout | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const load = (() => {
  let p: Promise<void> | null = null;
  return () =>
    (p ??= AsyncStorage.getItem(KEY)
      .then((raw) => {
        current = raw ? (JSON.parse(raw) as ActiveWorkout) : null;
      })
      .catch(() => {
        current = null;
      })
      .finally(() => {
        loaded = true;
        emit();
      }));
})();

export function saveActiveWorkout(w: ActiveWorkout) {
  current = w;
  loaded = true;
  AsyncStorage.setItem(KEY, JSON.stringify(w)).catch(() => {});
  emit();
}

export function clearActiveWorkout() {
  current = null;
  loaded = true;
  AsyncStorage.removeItem(KEY).catch(() => {});
  emit();
}

// The signed-in user's unfinished workout, if there is a recent one.
export function useActiveWorkout(userId: string | null): ActiveWorkout | null {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    if (!loaded) load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (!current || current.userId !== userId || Date.now() - current.savedAt > MAX_AGE_MS) return null;
  return current;
}
