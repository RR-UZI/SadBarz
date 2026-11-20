// coach-plan, run with a fake database and a fake Claude: who can ask, one plan at a time, the daily limit,
// a plan from the request to "waiting for review", and translating a plan's text.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { claude, textMessage } from '../fakes/anthropic';
import { call, settle, setupDeno } from '../fakes/deno';
import { fake } from '../fakes/supabase';

const EXERCISES = [
  { id: 'ex_pull', name: 'Pull ups', kind: 'reps', category: 'pull' },
  { id: 'ex_fondos', name: 'Fondos', kind: 'reps', category: 'push' },
  { id: 'ex_push', name: 'Push ups', kind: 'reps', category: 'push' },
  { id: 'ex_sentadilla', name: 'Sentadillas', kind: 'reps', category: 'legs' },
  { id: 'ex_dead_hang', name: 'Dead hang', kind: 'hold', category: 'pull' },
];
const PROFILE = { goal: 'strength', level: 'intermediate', trainingDays: [0, 2, 4], sessionMin: 60 };
const ASK = { weeks: 4, today: '2026-11-19', language: 'es', exercises: EXERCISES };

const day = (n: number, name: string) => ({
  day: n,
  name,
  note: 'A tu ritmo.',
  blocks: [
    { title: 'Calentamiento', format: 'circuit', items: [{ exerciseId: 'ex_push', reps: 10 }], rows: [], rounds: 2 },
    { title: 'Fuerza', format: 'sets', items: [], rows: [{ sets: 4, restSec: 120, items: [{ exerciseId: 'ex_pull', reps: 6, weightKg: 10 }] }], rounds: 1 },
  ],
});
const PLAN = { summary: 'Fuerza con lastre.', progression: 'Sube 1 rep por semana.', days: [day(0, 'Lunes · Fuerza'), day(2, 'Miércoles · Volumen'), day(4, 'Viernes · Full body')] };

beforeAll(async () => {
  setupDeno({ ANTHROPIC_API_KEY: 'test' });
  await import('../../supabase/functions/coach-plan/index.ts');
});

beforeEach(() => {
  fake.reset();
  claude.reset();
  fake.users['athlete-jwt'] = { id: 'u1', app_metadata: { plan: 'pro' }, user_metadata: { name: 'Uzi', profile: PROFILE } };
  fake.users['free-jwt'] = { id: 'u2', app_metadata: { plan: 'free' }, user_metadata: { profile: PROFILE } };
});

describe('who can ask', () => {
  it('needs a session', async () => {
    expect((await call(ASK, 'nobody')).status).toBe(401);
  });

  it('is for Pro athletes only', async () => {
    expect(await call(ASK, 'free-jwt')).toEqual({ status: 403, json: { error: 'pro' } });
  });

  it('needs the athlete profile and enough exercises', async () => {
    fake.users['athlete-jwt'].user_metadata = {};
    expect((await call(ASK)).json).toEqual({ error: 'profile' });
    expect((await call({ ...ASK, exercises: EXERCISES.slice(0, 3) })).json).toEqual({ error: 'exercises' });
  });
});

describe('a new plan', () => {
  it('goes from writing to waiting for review', async () => {
    // Claude answers only when the test says so, to see the plan while it's being written.
    let finish = () => {};
    claude.answer = () => new Promise((done) => (finish = () => done(textMessage(JSON.stringify(PLAN)))));
    const res = await call(ASK);
    expect(res.status).toBe(202);
    expect(res.json.status).toBe('writing');
    expect(fake.tables.coach_plans[0]).toMatchObject({ user_id: 'u1', status: 'writing', weeks: 4, start_date: '2026-11-19' });

    finish();
    await settle();
    const row = fake.tables.coach_plans[0] as { status: string; plan: { summary: string; days: { day: number; routine: { name: string; blocks: unknown[] } }[] } };
    expect(row.status).toBe('review');
    expect(row.plan.summary).toBe('Fuerza con lastre.');
    expect(row.plan.days.map((d) => [d.day, d.routine.name])).toEqual([
      [0, 'Lunes · Fuerza'],
      [2, 'Miércoles · Volumen'],
      [4, 'Viernes · Full body'],
    ]);
    expect(row.plan.days[0].routine.blocks).toHaveLength(2);
  });

  it('tells Claude the language, the training days and the exercises it may use', async () => {
    claude.answer = () => textMessage(JSON.stringify(PLAN));
    await call({ ...ASK, language: 'en' });
    await settle();
    const ask = JSON.stringify(claude.calls[0]);
    expect(ask).toContain('Write the routines in English');
    expect(ask).toContain('one routine for each training day (0, 2, 4)');
    expect(ask).toContain('ex_dead_hang');
  });

  it('fails the plan when Claude leaves a training day out', async () => {
    claude.answer = () => textMessage(JSON.stringify({ ...PLAN, days: PLAN.days.slice(0, 2) }));
    await call(ASK);
    await settle();
    expect(fake.tables.coach_plans[0]).toMatchObject({ status: 'failed' });
    expect(String(fake.tables.coach_plans[0].error)).toContain('2 usable days, expected 3');
  });

  it('fails the plan when Claude refuses', async () => {
    claude.answer = () => textMessage('', 'refusal');
    await call(ASK);
    await settle();
    expect(fake.tables.coach_plans[0]).toMatchObject({ status: 'failed', error: 'stop_reason refusal' });
  });
});

describe('one plan at a time', () => {
  it('answers with the plan already waiting for review instead of writing another', async () => {
    fake.tables.coach_plans = [{ id: 'p-old', user_id: 'u1', status: 'review', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
    expect(await call(ASK)).toEqual({ status: 200, json: { id: 'p-old', status: 'review' } });
    expect(claude.calls).toHaveLength(0);
  });

  it('gives up on a plan stuck writing and starts a new one', async () => {
    const old = new Date(Date.now() - 60 * 60_000).toISOString();
    fake.tables.coach_plans = [{ id: 'p-stuck', user_id: 'u1', status: 'writing', input: {}, created_at: old, updated_at: old }];
    claude.answer = () => textMessage(JSON.stringify(PLAN));
    const res = await call(ASK);
    expect(res.status).toBe(202);
    expect(fake.tables.coach_plans.find((r) => r.id === 'p-stuck')).toMatchObject({ status: 'failed', error: 'timed out' });
    await settle();
  });

  it('allows 3 plans a day, not counting failed ones', async () => {
    const recent = new Date(Date.now() - 3600_000).toISOString();
    const row = (id: string, status: string) => ({ id, user_id: 'u1', status, created_at: recent, updated_at: recent });
    fake.tables.coach_plans = [row('a', 'approved'), row('b', 'approved'), row('c', 'failed')];
    claude.answer = () => textMessage(JSON.stringify(PLAN));
    expect((await call(ASK)).status).toBe(202);
    await settle();
    fake.tables.coach_plans.forEach((r) => (r.status = 'approved'));
    expect(await call(ASK)).toEqual({ status: 429, json: { error: 'limit' } });
  });
});

describe('translating a plan', () => {
  const translated = (params: Record<string, unknown>) => {
    // Answers "EN: <text>" for each numbered text it was sent.
    const content = String((params.messages as { content: string }[])[0].content);
    const texts = content.split('\n').slice(1).map((line, i) => ({ n: i + 1, text: `EN: ${JSON.parse(line.replace(/^\d+\.\s/, ''))}` }));
    return textMessage(JSON.stringify({ texts }));
  };

  it('translates what it has not seen and keeps it for everyone', async () => {
    claude.answer = translated;
    const res = await call({ translate: ['Calentamiento', 'Fondos', 'Calentamiento', ''], language: 'en' });
    expect(res.json).toEqual({ map: { Calentamiento: 'EN: Calentamiento', Fondos: 'EN: Fondos' } });
    expect(claude.calls).toHaveLength(1);
    expect(claude.calls[0].model).toBe('claude-haiku-5-5');
    expect(fake.tables.text_translations).toEqual([
      expect.objectContaining({ language: 'en', source: 'Calentamiento', text: 'EN: Calentamiento' }),
      expect.objectContaining({ language: 'en', source: 'Fondos', text: 'EN: Fondos' }),
    ]);
  });

  it('uses what was translated before without asking Claude', async () => {
    fake.tables.text_translations = [{ language: 'en', source: 'Fondos', text: 'Dips' }];
    const res = await call({ translate: ['Fondos'], language: 'en' });
    expect(res.json).toEqual({ map: { Fondos: 'Dips' } });
    expect(claude.calls).toHaveLength(0);
  });

  it('still translates before the translations table exists', async () => {
    fake.missing.add('text_translations');
    claude.answer = translated;
    expect((await call({ translate: ['Pierna'], language: 'en' })).json).toEqual({ map: { Pierna: 'EN: Pierna' } });
  });

  it('answers with what it has when Claude fails', async () => {
    fake.tables.text_translations = [{ language: 'es', source: 'Legs', text: 'Pierna' }];
    claude.answer = () => {
      throw new Error('overloaded');
    };
    expect((await call({ translate: ['Legs', 'Abs'], language: 'es' })).json).toEqual({ map: { Legs: 'Pierna' } });
  });

  it('is for Pro athletes only', async () => {
    expect((await call({ translate: ['Fondos'], language: 'en' }, 'free-jwt')).status).toBe(403);
  });
});
