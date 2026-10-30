// App state: exercises, routines, workouts, records and settings of the signed-in user.
// Each user has a copy on the device (browser storage on web, app storage on the
// phone) and, with an account, a copy in the cloud that every device merges with.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { SEED_EXERCISES, seedRoutines } from '../data/seed';
import { setVolume } from '../lib/sound';
import { mergeSynced, pullRemote, pushRemote, syncEnabled, syncedKey, type Synced } from '../lib/sync';
import type { Exercise, PersonalRecord, Routine, Settings, Workout } from '../types';
import { useAuth } from './Auth';

// Before accounts all data lived under this key; the first user to sign in on the device takes it over.
const LEGACY_KEY = 'sadbarz:v1';
const userKey = (userId: string) => `sadbarz:v1:${userId}`;
// Settings of the last user on this device, so the sign-in screen keeps their language.
const DEVICE_SETTINGS_KEY = 'sadbarz:device-settings';
// Wait this long after a change before sending it to the cloud.
const PUSH_DELAY_MS = 1500;
// Bumped when a default changes and saved settings should follow it (2: 10 s lead-in).
const DATA_VERSION = 5;

export const DEFAULT_SETTINGS: Settings = {
  language: 'es',
  leadInSec: 10,
  startSound: true,
  roundSound: true,
  lastBeepsSec: 3,
  endSound: true,
  vibration: true,
  voice: false,
  autoStartNext: false,
  breakMode: 'ask',
  fixedBreakSec: 120,
  keepAwake: true,
  volume: 0.8,
};

interface Data {
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  settings: Settings;
  settingsAt: number;
  deleted: Record<string, number>;
  avatar: string | null;
  avatarAt: number;
  records: PersonalRecord[];
}

// 'off': no cloud (preview mode). 'error': the last sync failed; data is still saved on the device.
export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';

interface AppContextValue extends Data {
  ready: boolean;
  sync: { status: SyncStatus; at: number | null };
  syncNow: () => void;
  exerciseById: (id: string) => Exercise | undefined;
  saveRoutine: (r: Routine) => void;
  deleteRoutine: (id: string) => void;
  saveWorkout: (w: Workout) => void;
  deleteWorkout: (id: string) => void;
  addExercise: (e: Exercise) => void;
  updateExercise: (e: Exercise) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setAvatar: (dataUrl: string | null) => void;
  saveRecord: (r: PersonalRecord) => void;
  deleteRecord: (id: string) => void;
  reloadExamples: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function initialData(settings: Settings = DEFAULT_SETTINGS): Data {
  return { exercises: SEED_EXERCISES, routines: seedRoutines(), workouts: [], settings, settingsAt: 0, deleted: {}, avatar: null, avatarAt: 0, records: [] };
}

// Swaps the old examples for the current ones. Examples the user edited are kept.
function withNewExamples(routines: Routine[]) {
  const kept = routines.filter((r) => !r.example || r.updatedAt !== r.createdAt);
  const seeds = seedRoutines().filter((s) => !kept.some((r) => r.id === s.id));
  return [...kept.filter((r) => !r.example), ...seeds, ...kept.filter((r) => r.example)];
}

function fromSaved(saved: Partial<Data> & { version?: number }): Data {
  const settings = { ...DEFAULT_SETTINGS, ...saved.settings };
  // v2: the lead-in default went from 3 s to 10 s.
  if ((saved.version ?? 1) < 2 && settings.leadInSec === 3) settings.leadInSec = 10;
  // Keep seed exercises up to date, add the user's own on top.
  const custom = (saved.exercises ?? []).filter((e) => e.custom);
  return {
    exercises: [...SEED_EXERCISES, ...custom],
    // v3: the examples became one routine per weekday, Monday to Friday. v4: new Thursday. v5: its EMOM alternates rounds.
    routines: saved.routines ? ((saved.version ?? 1) < 5 ? withNewExamples(saved.routines) : saved.routines) : seedRoutines(),
    workouts: saved.workouts ?? [],
    settings,
    settingsAt: saved.settingsAt ?? 0,
    deleted: saved.deleted ?? {},
    avatar: saved.avatar ?? null,
    avatarAt: saved.avatarAt ?? 0,
    records: saved.records ?? [],
  };
}

function toSynced(d: Data): Synced {
  return {
    routines: d.routines,
    workouts: d.workouts,
    exercises: d.exercises.filter((e) => e.custom),
    settings: d.settings,
    settingsAt: d.settingsAt,
    deleted: d.deleted,
    avatar: d.avatar,
    avatarAt: d.avatarAt,
    records: d.records,
  };
}

function fromSynced(s: Synced): Data {
  return { ...s, exercises: [...SEED_EXERCISES, ...s.exercises] };
}

// This device's copy for a user. The first user to sign in here inherits the data saved before accounts.
async function readLocal(userId: string): Promise<Data> {
  try {
    const own = await AsyncStorage.getItem(userKey(userId));
    if (own) return fromSaved(JSON.parse(own));
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      await AsyncStorage.setItem(userKey(userId), legacy);
      await AsyncStorage.removeItem(LEGACY_KEY);
      const data = fromSaved(JSON.parse(legacy));
      // Settings chosen before accounts beat another device's untouched defaults.
      return { ...data, settingsAt: Math.max(data.settingsAt, 1) };
    }
    const device = await AsyncStorage.getItem(DEVICE_SETTINGS_KEY);
    return initialData(device ? { ...DEFAULT_SETTINGS, ...JSON.parse(device) } : DEFAULT_SETTINGS);
  } catch {
    // storage blocked or broken: start fresh, the app still works
    return initialData();
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [data, setData] = useState<Data>(initialData);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<{ status: SyncStatus; at: number | null }>({ status: syncEnabled ? 'syncing' : 'off', at: null });
  // The user whose data is in `data`; null while it loads or when signed out.
  const owner = useRef<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  // What the cloud holds after the last good sync, to skip pushing unchanged data.
  const cloudKey = useRef('');
  const running = useRef(false);
  const rerun = useRef(false);

  // Pull the cloud copy, merge it into this device's, and push the result back.
  const syncNow = useCallback(async () => {
    const uid = owner.current;
    if (!syncEnabled || !uid) return;
    if (running.current) {
      rerun.current = true;
      return;
    }
    running.current = true;
    setSync((s) => ({ ...s, status: 'syncing' }));
    try {
      const remote = await pullRemote(uid);
      if (owner.current !== uid) return;
      const merged = remote ? mergeSynced(toSynced(dataRef.current), remote) : toSynced(dataRef.current);
      const key = syncedKey(merged);
      if (!remote || syncedKey(remote) !== key) await pushRemote(uid, merged);
      if (owner.current !== uid) return;
      cloudKey.current = key;
      // Changes made while this ran are merged on top, and trigger another push.
      setData((d) => (syncedKey(toSynced(d)) === key ? d : fromSynced(mergeSynced(toSynced(d), merged))));
      setSync({ status: 'synced', at: Date.now() });
    } catch {
      if (owner.current === uid) setSync((s) => ({ ...s, status: 'error' }));
    } finally {
      running.current = false;
      if (rerun.current) {
        rerun.current = false;
        syncNow();
      }
    }
  }, []);

  // Load the signed-in user's data: this device's copy right away, then the cloud's.
  useEffect(() => {
    owner.current = null;
    cloudKey.current = '';
    let cancelled = false;
    setReady(false);
    (async () => {
      if (!userId) {
        let settings = DEFAULT_SETTINGS;
        try {
          const device = await AsyncStorage.getItem(DEVICE_SETTINGS_KEY);
          if (device) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(device) };
        } catch {
          // storage blocked: defaults
        }
        if (cancelled) return;
        setData(initialData(settings));
        setReady(true);
        return;
      }
      const local = await readLocal(userId);
      if (cancelled) return;
      dataRef.current = local;
      setData(local);
      owner.current = userId;
      setReady(true);
      syncNow();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, syncNow]);

  // Save every change on the device, and send it to the cloud shortly after.
  useEffect(() => {
    setVolume(data.settings.volume);
    const uid = owner.current;
    if (!uid) return;
    AsyncStorage.setItem(userKey(uid), JSON.stringify({ ...data, version: DATA_VERSION })).catch(() => {});
    AsyncStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify(data.settings)).catch(() => {});
    if (!syncEnabled || syncedKey(toSynced(data)) === cloudKey.current) return;
    const id = setTimeout(syncNow, PUSH_DELAY_MS);
    return () => clearTimeout(id);
  }, [data, syncNow]);

  // Coming back to the app (another tab, the phone unlocked) picks up changes from other devices.
  useEffect(() => {
    if (!syncEnabled) return;
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const onVisible = () => {
        if (document.visibilityState === 'visible') syncNow();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', onVisible);
      return () => {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('online', onVisible);
      };
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncNow();
    });
    return () => sub.remove();
  }, [syncNow]);

  const exerciseById = useCallback((id: string) => data.exercises.find((e) => e.id === id), [data.exercises]);

  const saveRoutine = useCallback((r: Routine) => {
    setData((d) => {
      const exists = d.routines.some((x) => x.id === r.id);
      const next = { ...r, updatedAt: Date.now() };
      return { ...d, routines: exists ? d.routines.map((x) => (x.id === r.id ? next : x)) : [next, ...d.routines] };
    });
  }, []);

  const deleteRoutine = useCallback((id: string) => {
    setData((d) => ({ ...d, routines: d.routines.filter((r) => r.id !== id), deleted: { ...d.deleted, [id]: Date.now() } }));
  }, []);

  const saveWorkout = useCallback((w: Workout) => {
    setData((d) => ({ ...d, workouts: [w, ...d.workouts.filter((x) => x.id !== w.id)] }));
  }, []);

  const deleteWorkout = useCallback((id: string) => {
    setData((d) => ({ ...d, workouts: d.workouts.filter((w) => w.id !== id), deleted: { ...d.deleted, [id]: Date.now() } }));
  }, []);

  const addExercise = useCallback((e: Exercise) => {
    // Skips one already there, so two screens adding the same exercise don't make a copy.
    setData((d) => (d.exercises.some((x) => x.id === e.id) ? d : { ...d, exercises: [...d.exercises, { ...e, custom: true }] }));
  }, []);

  const updateExercise = useCallback((e: Exercise) => {
    setData((d) => ({ ...d, exercises: d.exercises.map((x) => (x.id === e.id ? { ...e, updatedAt: Date.now() } : x)) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch }, settingsAt: Date.now() }));
  }, []);

  const setAvatar = useCallback((avatar: string | null) => {
    setData((d) => ({ ...d, avatar, avatarAt: Date.now() }));
  }, []);

  const saveRecord = useCallback((r: PersonalRecord) => {
    setData((d) => {
      const next = { ...r, updatedAt: Date.now() };
      return { ...d, records: d.records.some((x) => x.id === r.id) ? d.records.map((x) => (x.id === r.id ? next : x)) : [next, ...d.records] };
    });
  }, []);

  const deleteRecord = useCallback((id: string) => {
    setData((d) => ({ ...d, records: d.records.filter((r) => r.id !== id), deleted: { ...d.deleted, [id]: Date.now() } }));
  }, []);

  const reloadExamples = useCallback(() => {
    setData((d) => {
      const seeds = seedRoutines();
      // Untouched old examples go too; ones the user edited stay unless a current example replaces them.
      const others = d.routines.filter((r) => !seeds.some((s) => s.id === r.id) && !(r.example && r.updatedAt === r.createdAt));
      // examples deleted before (on any device) come back too
      const deleted = Object.fromEntries(Object.entries(d.deleted).filter(([id]) => !seeds.some((r) => r.id === id)));
      return { ...d, routines: [...others, ...seeds], deleted };
    });
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({ ...data, ready, sync, syncNow, exerciseById, saveRoutine, deleteRoutine, saveWorkout, deleteWorkout, addExercise, updateExercise, updateSettings, setAvatar, saveRecord, deleteRecord, reloadExamples }),
    [data, ready, sync, syncNow, exerciseById, saveRoutine, deleteRoutine, saveWorkout, deleteWorkout, addExercise, updateExercise, updateSettings, setAvatar, saveRecord, deleteRecord, reloadExamples],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
