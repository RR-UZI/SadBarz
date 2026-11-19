// The coach plan in the app's language. The coach writes a plan in the language the app had when it was asked for;
// reading the app in the other language, its text (routine names, block titles, notes, the progression and the
// exercises the coach created) is translated by the coach-plan function and kept on this device.
// Anything not translated yet shows as written.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { Exercise, Language, Routine } from '../types';
import type { MyPlan } from './coach';
import { supabase } from './supabase';

type Map_ = Record<string, string>;

const KEY = (language: Language) => `sadbarz:tr:${language}`;
const KEEP = 3000; // texts kept per language on the device

const maps: Partial<Record<Language, Map_>> = {};
const loading: Partial<Record<Language, Promise<Map_>>> = {};
const asked = new Set<string>(); // texts already asked for this session, so a failure isn't retried in a loop
const listeners = new Set<() => void>();

function load(language: Language): Promise<Map_> {
  if (maps[language]) return Promise.resolve(maps[language]!);
  loading[language] ??= AsyncStorage.getItem(KEY(language))
    .then((saved) => {
      try {
        return saved ? (JSON.parse(saved) as Map_) : {};
      } catch {
        return {};
      }
    })
    .catch(() => ({}))
    .then((m) => (maps[language] = { ...m, ...maps[language] }));
  return loading[language]!;
}

function save(language: Language) {
  const entries = Object.entries(maps[language] ?? {});
  const kept = Object.fromEntries(entries.slice(-KEEP));
  AsyncStorage.setItem(KEY(language), JSON.stringify(kept)).catch(() => {});
}

/** Every text of a plan the athlete reads. */
export function planTexts(plan: MyPlan): string[] {
  const out = new Set<string>();
  const add = (s?: string | null) => {
    const t = s?.trim();
    if (t) out.add(t);
  };
  add(plan.progression);
  for (const d of plan.days) {
    add(d.routine.name);
    add(d.routine.note);
    for (const b of d.routine.blocks) {
      add(b.title);
      add(b.note);
      for (const it of b.items) add(it.note);
    }
  }
  for (const e of plan.exercises ?? []) add(e.name);
  return [...out];
}

/** Asks the server for the texts this device doesn't have in `language` yet. */
async function fetchMissing(texts: string[], language: Language) {
  const map = await load(language);
  const missing = texts.filter((t) => !(t in map) && !asked.has(`${language}:${t}`));
  if (!missing.length || !supabase) return;
  missing.forEach((t) => asked.add(`${language}:${t}`));
  const { data, error } = await supabase.functions.invoke('coach-plan', { body: { translate: missing, language } });
  if (error) return;
  const got = ((data ?? {}) as { map?: Map_ }).map ?? {};
  let changed = false;
  for (const [source, text] of Object.entries(got)) {
    if (typeof text === 'string' && text && map[source] !== text) {
      map[source] = text;
      changed = true;
    }
  }
  if (changed) {
    save(language);
    listeners.forEach((l) => l());
  }
}

const tr = (map: Map_, s: string | undefined): string | undefined => (s ? (map[s.trim()] ?? s) : s);

function localRoutine(r: Routine, map: Map_): Routine {
  return {
    ...r,
    name: tr(map, r.name) ?? r.name,
    note: tr(map, r.note),
    blocks: r.blocks.map((b) => ({
      ...b,
      title: tr(map, b.title) ?? b.title,
      note: tr(map, b.note),
      items: b.items.map((it) => (it.note ? { ...it, note: tr(map, it.note) } : it)),
    })),
  };
}

/** The plan with its text in `language`, using what this device has. */
export function localPlan(plan: MyPlan, language: Language): MyPlan {
  const map = maps[language];
  if (!map || (plan.language ?? 'es') === language) return plan;
  return {
    ...plan,
    progression: tr(map, plan.progression) ?? plan.progression,
    days: plan.days.map((d) => ({ ...d, routine: localRoutine(d.routine, map) })),
    exercises: plan.exercises?.map((e) => ({ ...e, name: tr(map, e.name) ?? e.name })),
  };
}

/** An exercise the coach created, in `language` (the starter exercises have their own names, see data/seed). */
export function localCoachExercise(e: Exercise, language: Language): Exercise {
  const name = maps[language]?.[e.name.trim()];
  return name ? { ...e, name } : e;
}

/** The plan in the app's language: translated texts show as soon as they arrive. */
export function useLocalPlan(plan: MyPlan | null | undefined, language: Language): MyPlan | null | undefined {
  const [, setVersion] = useState(0);
  const needs = !!plan && (plan.language ?? 'es') !== language;
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);
  useEffect(() => {
    if (!needs || !plan) return;
    load(language).then(() => {
      setVersion((v) => v + 1);
      return fetchMissing(planTexts(plan), language);
    });
  }, [needs, plan, language]);
  return plan && needs ? localPlan(plan, language) : plan;
}

/** Re-renders when new translations arrive (for the exercise list). */
export function useTranslationsVersion(language: Language): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    listeners.add(bump);
    load(language).then(bump);
    return () => {
      listeners.delete(bump);
    };
  }, [language]);
  return version;
}
