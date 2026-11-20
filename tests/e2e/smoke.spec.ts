// Smoke test: the app opens, a new athlete can sign up, and every tab opens without errors, as Pro and as Free.
// Runs the preview build (accounts saved in the browser), so it needs no server or Supabase.
import { expect, test, type Page } from '@playwright/test';

const PROFILE = {
  version: 1,
  goal: 'strength',
  level: 'advanced',
  levelSource: 'picked',
  skills: [],
  equipment: ['bar'],
  trainingDays: [0, 2, 4],
  sessionMin: 60,
  startDate: '2026-11-02',
  age: 30,
  weightKg: 70,
  injuries: [],
  reminders: false,
  reminderTime: '19:00',
  updatedAt: 'x',
};

// Three weeks of workouts, getting a little better each time, so History has charts and personal bests.
function workouts() {
  const DAY = 86_400_000;
  return Array.from({ length: 9 }, (_, i) => {
    const start = Date.now() - (i * 2 + 1) * DAY;
    return {
      id: `w${i}`,
      routineName: 'Lunes · Fuerza',
      totalBlocks: 1,
      startedAt: start,
      finishedAt: start + 50 * 60_000,
      blocks: [
        {
          blockId: 'b1',
          title: 'Fuerza',
          format: 'sets',
          status: 'done',
          durationSec: 900,
          entries: [
            { exerciseId: 'ex_pull', rounds: 4, reps: 12 - i },
            { exerciseId: 'ex_fondos', rounds: 4, reps: 15 - i },
          ],
        },
      ],
    };
  });
}

/** Signs in a preview athlete (Pro or Free) with the app in `language`. */
async function signIn(page: Page, opts: { plan: 'pro' | 'free'; language: 'en' | 'es'; extra?: Record<string, string> }) {
  await page.goto('/');
  await page.evaluate(({ plan, language, profile, workouts, extra }) => {
    localStorage.clear();
    localStorage.setItem('sadbarz:preview-accounts', JSON.stringify({ 'athlete@example.com': { id: 'u1', name: 'Alex', hash: 'x', plan, profile } }));
    localStorage.setItem('sadbarz:preview-session', 'athlete@example.com');
    localStorage.setItem('sadbarz:v1:u1', JSON.stringify({ settings: { language }, workouts }));
    for (const [k, v] of Object.entries(extra ?? {})) localStorage.setItem(k, v);
  }, { ...opts, profile: PROFILE, workouts: workouts() });
  await page.reload();
}

/** Fails the test on any page error or console error. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

test('a new athlete signs up and finishes the questions', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByText('Crear cuenta', { exact: true }).first().click();
  await page.getByPlaceholder('Cómo te llamamos').fill('Alex');
  await page.getByPlaceholder('tu@correo.com').fill('alex@example.com');
  await page.locator('input[type=password]').fill('secret123');
  await page.getByText('Crear cuenta', { exact: true }).last().click();

  await expect(page.getByText('Paso 1 de 4')).toBeVisible();
  await page.getByText('Fuerza', { exact: true }).first().click();
  await page.getByText('Continuar', { exact: true }).click();
  await expect(page.getByText('Paso 2 de 4')).toBeVisible();
  await page.getByText('Continuar', { exact: true }).click();
  await expect(page.getByText('Paso 3 de 4')).toBeVisible();
  await page.getByText('Barra de dominadas', { exact: true }).click();
  await page.getByText('Continuar', { exact: true }).click();
  await expect(page.getByText('Paso 4 de 4')).toBeVisible();
  for (const day of ['Lunes', 'Miércoles', 'Viernes']) await page.getByRole('checkbox', { name: day }).click();
  await page.getByText('Continuar', { exact: true }).click();
  await expect(page.getByText('Revisa tus respuestas')).toBeVisible();
  await page.getByText('Guardar y empezar', { exact: true }).click();

  await expect(tab(page, 'Inicio')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Pro: every tab opens, with the full history and Health', async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page, { plan: 'pro', language: 'en' });

  await expect(tab(page, 'Home')).toBeVisible();
  for (const name of ['Routines', 'Coach', 'Timers']) {
    await tab(page, name).click();
    await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
  }

  await tab(page, 'History').click();
  await expect(page.getByText('Progress by week', { exact: true })).toBeVisible();
  await expect(page.getByText('Personal bests', { exact: true })).toBeVisible();

  await tab(page, 'Health').click();
  await expect(page.getByText('Connect your watch', { exact: true })).toBeVisible();
  await expect(page.getByText('Your recovery, in numbers', { exact: true })).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('Free: History and Health show what Pro adds', async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page, { plan: 'free', language: 'en' });

  await tab(page, 'History').click();
  await expect(page.getByText('With Pro: full history, personal bests and charts.')).toBeVisible();
  await expect(page.getByText('Progress by week', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Personal bests', { exact: true })).toHaveCount(0);

  await tab(page, 'Health').click();
  await expect(page.getByText('Your recovery, in numbers', { exact: true })).toBeVisible();

  expect(errors).toEqual([]);
});

test('Spanish: the tabs are in Spanish', async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page, { plan: 'pro', language: 'es' });
  for (const name of ['Inicio', 'Rutinas', 'Coach', 'Salud', 'Timers', 'Historial']) await expect(tab(page, name)).toBeVisible();
  expect(errors).toEqual([]);
});

test("a coach plan written in Spanish reads in English when the app is in English", async ({ page }) => {
  const errors = watchErrors(page);
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const block = { id: 'b1', title: 'Calentamiento', format: 'circuit', items: [{ id: 'i1', exerciseId: 'ex_push', reps: 10, note: 'con calma' }], rows: [], intervalSec: 60, rounds: 2, perRound: 'all', workSec: 20, restSec: 10 };
  const plan = {
    id: 'p1',
    weeks: 4,
    startDate: day(monday),
    language: 'es',
    progression: 'Sube una repetición por semana.',
    days: [0, 2, 4].map((n) => ({ day: n, routine: { id: `plan_p1_${n}`, name: 'Lunes · Fuerza con lastre', blocks: [block], createdAt: 1, updatedAt: 1 } })),
  };
  const translations = { 'Lunes · Fuerza con lastre': 'Monday · Weighted strength', Calentamiento: 'Warm up', 'con calma': 'easy pace', 'Sube una repetición por semana.': 'Add one rep a week.' };
  await signIn(page, {
    plan: 'pro',
    language: 'en',
    extra: { 'sadbarz:preview-plan': JSON.stringify(plan), 'sadbarz:tr:en': JSON.stringify(translations) },
  });

  await tab(page, 'Routines').click();
  await expect(page.getByText(/Weighted strength/).first()).toBeVisible();
  await expect(page.getByText(/Fuerza con lastre/)).toHaveCount(0);
  expect(errors).toEqual([]);
});
