// App state: exercises, routines, workouts and settings, saved on the device.
// On web this is the browser's local storage; on the phone it is the app's storage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { SEED_EXERCISES, seedRoutines } from '../data/seed';
import { setVolume } from '../lib/sound';
import type { Exercise, Routine, Settings, Workout } from '../types';

const STORAGE_KEY = 'sadbarz:v1';

export const DEFAULT_SETTINGS: Settings = {
  language: 'es',
  leadInSec: 3,
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
}

interface AppContextValue extends Data {
  ready: boolean;
  exerciseById: (id: string) => Exercise | undefined;
  saveRoutine: (r: Routine) => void;
  deleteRoutine: (id: string) => void;
  saveWorkout: (w: Workout) => void;
  deleteWorkout: (id: string) => void;
  addExercise: (e: Exercise) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  reloadExamples: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function initialData(): Data {
  return { exercises: SEED_EXERCISES, routines: seedRoutines(), workouts: [], settings: DEFAULT_SETTINGS };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(initialData);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<Data>;
          // Keep seed exercises up to date, add the user's own on top.
          const custom = (saved.exercises ?? []).filter((e) => e.custom);
          setData({
            exercises: [...SEED_EXERCISES, ...custom],
            routines: saved.routines ?? seedRoutines(),
            workouts: saved.workouts ?? [],
            settings: { ...DEFAULT_SETTINGS, ...saved.settings },
          });
        }
      } catch {
        // storage blocked or broken: start fresh, the app still works
      }
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    setVolume(data.settings.volume);
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data]);

  const exerciseById = useCallback((id: string) => data.exercises.find((e) => e.id === id), [data.exercises]);

  const saveRoutine = useCallback((r: Routine) => {
    setData((d) => {
      const exists = d.routines.some((x) => x.id === r.id);
      const next = { ...r, updatedAt: Date.now() };
      return { ...d, routines: exists ? d.routines.map((x) => (x.id === r.id ? next : x)) : [next, ...d.routines] };
    });
  }, []);

  const deleteRoutine = useCallback((id: string) => {
    setData((d) => ({ ...d, routines: d.routines.filter((r) => r.id !== id) }));
  }, []);

  const saveWorkout = useCallback((w: Workout) => {
    setData((d) => ({ ...d, workouts: [w, ...d.workouts.filter((x) => x.id !== w.id)] }));
  }, []);

  const deleteWorkout = useCallback((id: string) => {
    setData((d) => ({ ...d, workouts: d.workouts.filter((w) => w.id !== id) }));
  }, []);

  const addExercise = useCallback((e: Exercise) => {
    setData((d) => ({ ...d, exercises: [...d.exercises, { ...e, custom: true }] }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const reloadExamples = useCallback(() => {
    setData((d) => {
      const seeds = seedRoutines();
      const others = d.routines.filter((r) => !seeds.some((s) => s.id === r.id));
      return { ...d, routines: [...others, ...seeds] };
    });
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({ ...data, ready, exerciseById, saveRoutine, deleteRoutine, saveWorkout, deleteWorkout, addExercise, updateSettings, reloadExamples }),
    [data, ready, exerciseById, saveRoutine, deleteRoutine, saveWorkout, deleteWorkout, addExercise, updateSettings, reloadExamples],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
