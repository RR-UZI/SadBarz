import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeAll, describe, expect, it } from 'vitest';

import { localExercise } from '../../src/data/seed';
import type { MyPlan } from '../../src/lib/coach';
import { loadTranslations, localCoachExercise, localPlan, planTexts, withDay } from '../../src/lib/planText';

const plan: MyPlan = {
  id: 'p1',
  weeks: 4,
  startDate: '2026-11-16',
  progression: 'Semana de descarga.',
  language: 'es',
  exercises: [{ id: 'cx_prensa', name: 'Prensa por pierna', kind: 'reps', category: 'legs' }],
  days: [
    {
      day: 0,
      routine: {
        id: 'plan_p1_0',
        name: 'Lunes · Lastre push y pull',
        note: 'Menos series.',
        createdAt: 1,
        updatedAt: 1,
        blocks: [
          { id: 'b1', title: 'Calentamiento', format: 'circuit', items: [{ id: 'i1', exerciseId: 'ex_burpees', reps: 10, note: 'suave' }], rows: [], intervalSec: 60, rounds: 2, perRound: 'all', workSec: 20, restSec: 10 },
          { id: 'b2', title: 'Tubo + fondos', format: 'emom', items: [], rows: [], intervalSec: 60, rounds: 6, perRound: 'all', workSec: 20, restSec: 10 },
        ],
      },
    },
  ],
};

beforeAll(async () => {
  await AsyncStorage.setItem(
    'sadbarz:tr:en',
    JSON.stringify({
      'Semana de descarga.': 'Deload week.',
      'Lunes · Lastre push y pull': 'Monday · Weighted push and pull',
      'Menos series.': 'Fewer sets.',
      Calentamiento: 'Warm up',
      suave: 'easy',
      'Tubo + fondos': 'Tubo + dips',
      'Prensa por pierna': 'Single-leg press',
    }),
  );
  await loadTranslations('en');
});

describe('withDay', () => {
  it('shows the day once, in the app language', () => {
    expect(withDay('Lunes · Lastre push y pull', 'Monday')).toBe('Monday · Lastre push y pull');
    expect(withDay('Monday · Weighted push and pull', 'Monday')).toBe('Monday · Weighted push and pull');
    expect(withDay('Miércoles: Pierna', 'Wednesday')).toBe('Wednesday · Pierna');
    expect(withDay('Full body', 'Viernes')).toBe('Viernes · Full body');
  });
});

describe('plan translation', () => {
  it('collects every text of the plan once', () => {
    expect(planTexts(plan).sort()).toEqual(
      ['Calentamiento', 'Lunes · Lastre push y pull', 'Menos series.', 'Prensa por pierna', 'Semana de descarga.', 'Tubo + fondos', 'suave'].sort(),
    );
  });

  it('shows the plan in English with the translations this device has', () => {
    const en = localPlan(plan, 'en');
    const r = en.days[0].routine;
    expect(en.progression).toBe('Deload week.');
    expect(r.name).toBe('Monday · Weighted push and pull');
    expect(r.note).toBe('Fewer sets.');
    expect(r.blocks.map((b) => b.title)).toEqual(['Warm up', 'Tubo + dips']);
    expect(r.blocks[0].items[0].note).toBe('easy');
    expect(en.exercises?.[0].name).toBe('Single-leg press');
  });

  it('leaves a plan alone in its own language', () => {
    expect(localPlan(plan, 'es')).toBe(plan);
    expect(localPlan({ ...plan, language: 'en' }, 'en')).toEqual({ ...plan, language: 'en' });
  });

  it('shows texts without a translation as written', () => {
    const extra = { ...plan, progression: 'Sin traducir todavía.' };
    expect(localPlan(extra, 'en').progression).toBe('Sin traducir todavía.');
  });

  it('translates the exercises the coach created', () => {
    expect(localCoachExercise({ id: 'cx_prensa', name: 'Prensa por pierna', kind: 'reps', category: 'legs' }, 'en').name).toBe('Single-leg press');
    expect(localCoachExercise({ id: 'cx_x', name: 'Otro', kind: 'reps', category: 'legs' }, 'en').name).toBe('Otro');
  });
});

describe('starter exercises in English', () => {
  it('uses the English name unless the athlete renamed it', () => {
    expect(localExercise({ id: 'ex_fondos', name: 'Fondos', kind: 'reps', category: 'push' }, 'en').name).toBe('Dips');
    expect(localExercise({ id: 'ex_fondos', name: 'Mis fondos', kind: 'reps', category: 'push' }, 'en').name).toBe('Mis fondos');
    expect(localExercise({ id: 'ex_tubo', name: 'Tubo', kind: 'reps', category: 'tubos' }, 'en').name).toBe('Tubo');
  });
});
