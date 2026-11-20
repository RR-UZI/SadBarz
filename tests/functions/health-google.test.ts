// health-google, run with a fake database and a fake Google (fetch is replaced): who can use it, connecting,
// syncing a day's numbers into health_days, Google taking the access back, and disconnecting.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { call, setupDeno } from '../fakes/deno';
import { fake } from '../fakes/supabase';

// ---- A fake Google: answers by URL, and remembers what was asked ----

type Answer = { status?: number; body: unknown };
let google: { calls: { url: string; body?: string }[]; answer: (url: string, body?: string) => Answer };

const DAY = (y: number, m: number, d: number) => ({ year: y, month: m, day: d });
const SLEEP = {
  sleep: {
    interval: { startTime: '2026-11-18T05:10:00Z', endTime: '2026-11-18T12:40:00Z', civilEndTime: { date: DAY(2026, 11, 18) } },
    summary: {
      minutesAsleep: 412,
      stagesSummary: [
        { type: 'DEEP', minutes: 70 },
        { type: 'REM', minutes: 95 },
        { type: 'LIGHT', minutes: 247 },
        { type: 'AWAKE', minutes: 38 },
      ],
    },
  },
};
const NAP = { sleep: { interval: { civilEndTime: { date: DAY(2026, 11, 18) } }, summary: { minutesAsleep: 25 } } };

function googleData(url: string): Answer {
  if (url.startsWith('https://oauth2.googleapis.com/token')) return { body: { access_token: 'access-1', refresh_token: 'refresh-1', scope: 'sleep activity' } };
  if (url.startsWith('https://oauth2.googleapis.com/revoke')) return { body: {} };
  const type = url.split('/dataTypes/')[1]?.split('/')[0];
  switch (type) {
    case 'steps':
      return { body: { rollupDataPoints: [{ civilStartTime: { date: DAY(2026, 11, 18) }, steps: { countSum: '9876' } }] } };
    case 'total-calories':
      return { body: { rollupDataPoints: [{ civilStartTime: { date: DAY(2026, 11, 18) }, totalCalories: { kcalSum: 2310.4 } }] } };
    case 'heart-rate':
      return { body: { rollupDataPoints: [{ civilStartTime: { date: DAY(2026, 11, 18) }, heartRate: { beatsPerMinuteAvg: 71.26, beatsPerMinuteMax: 162 } }] } };
    case 'daily-resting-heart-rate':
      return { body: { dataPoints: [{ dailyRestingHeartRate: { date: DAY(2026, 11, 18), beatsPerMinute: 54 } }] } };
    case 'daily-heart-rate-variability':
      return { body: { dataPoints: [{ dailyHeartRateVariability: { date: DAY(2026, 11, 18), averageHeartRateVariabilityMilliseconds: 48.37 } }] } };
    case 'sleep':
      return { body: { dataPoints: [SLEEP, NAP] } }; // the nap comes after the night
  }
  return { status: 404, body: { error: 'not found' } };
}

const SECRETS = { GOOGLE_HEALTH_CLIENT_ID: 'client-id', GOOGLE_HEALTH_CLIENT_SECRET: 'client-secret' };
const PRO = { id: 'u1', app_metadata: { plan: 'pro' } };
const LINKED = { user_id: 'u1', refresh_token: 'refresh-1', last_sync_at: null, last_error: null };

beforeAll(async () => {
  setupDeno(SECRETS);
  await import('../../supabase/functions/health-google/index.ts');
});

beforeEach(() => {
  fake.reset();
  fake.users['athlete-jwt'] = PRO;
  fake.users['free-jwt'] = { id: 'u2', app_metadata: { plan: 'free' } };
  fake.users['admin-jwt'] = { id: 'u3', app_metadata: { admin: true } };
  google = { calls: [], answer: googleData };
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? String(init.body) : undefined;
    google.calls.push({ url, body });
    const a = google.answer(url, body);
    return new Response(JSON.stringify(a.body), { status: a.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('who can use it', () => {
  it('needs a session', async () => {
    expect((await call({ action: 'status' }, 'nobody')).status).toBe(401);
  });

  it('is for Pro: Free accounts only see their status and can disconnect', async () => {
    expect(await call({ action: 'start', redirect: 'https://sadbarz.com/' }, 'free-jwt')).toEqual({ status: 403, json: { error: 'pro' } });
    expect((await call({ action: 'sync', today: '2026-11-19' }, 'free-jwt')).status).toBe(403);
    expect((await call({ action: 'status' }, 'free-jwt')).status).toBe(200);
    expect((await call({ action: 'disconnect' }, 'free-jwt')).status).toBe(200);
  });

  it('lets an admin in', async () => {
    expect((await call({ action: 'start', redirect: 'https://sadbarz.com/' }, 'admin-jwt')).status).toBe(200);
  });

  it('rejects an unknown action', async () => {
    expect(await call({ action: 'nope' })).toEqual({ status: 400, json: { error: 'action' } });
  });
});

describe('connecting', () => {
  it('says whether it is set up and connected', async () => {
    expect((await call({ action: 'status' })).json).toEqual({ configured: true, connected: false, lastSync: null, error: null });
    fake.tables.health_links = [{ ...LINKED, last_sync_at: '2026-11-18T10:00:00Z', last_error: 'sleep: 500' }];
    expect((await call({ action: 'status' })).json).toEqual({ configured: true, connected: true, lastSync: '2026-11-18T10:00:00Z', error: 'sleep: 500' });
  });

  it("sends the athlete to Google's sign-in, only back to SadBarz", async () => {
    const res = await call({ action: 'start', redirect: 'https://sadbarz.com/' });
    const url = new URL(String(res.json.url));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://sadbarz.com/');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('state')).toBe(fake.tables.health_links[0].state);

    for (const redirect of ['https://evil.com/', 'https://sadbarz.com.evil.com/', 'http://sadbarz.com/', 'https://sadbarz.com/x']) {
      expect(await call({ action: 'start', redirect })).toEqual({ status: 400, json: { error: 'redirect' } });
    }
    expect((await call({ action: 'start', redirect: 'https://sadbarz-git-tests.vercel.app/' })).status).toBe(200);
    expect((await call({ action: 'start', redirect: 'http://localhost:8081/' })).status).toBe(200);
  });

  it('finishes only with the state it gave, then keeps the link and syncs', async () => {
    await call({ action: 'start', redirect: 'https://sadbarz.com/' });
    const state = fake.tables.health_links[0].state;
    expect(await call({ action: 'finish', code: 'c', state: 'health.other', redirect: 'https://sadbarz.com/' })).toEqual({ status: 400, json: { error: 'state' } });

    const res = await call({ action: 'finish', code: 'code-1', state, redirect: 'https://sadbarz.com/', today: '2026-11-19' });
    expect(res).toEqual({ status: 200, json: { ok: true, days: 1 } });
    expect(fake.tables.health_links[0]).toMatchObject({ refresh_token: 'refresh-1', state: null, last_error: null });
    const exchange = new URLSearchParams(google.calls[0].body);
    expect(Object.fromEntries(exchange)).toMatchObject({ grant_type: 'authorization_code', code: 'code-1', client_secret: 'client-secret' });
  });

  it("doesn't accept a sign-in that took too long", async () => {
    fake.tables.health_links = [{ user_id: 'u1', state: 'health.old', state_at: new Date(Date.now() - 20 * 60_000).toISOString() }];
    expect((await call({ action: 'finish', code: 'c', state: 'health.old', redirect: 'https://sadbarz.com/' })).json).toEqual({ error: 'state' });
  });
});

describe('syncing', () => {
  beforeEach(() => {
    fake.tables.health_links = [{ ...LINKED }];
  });

  it("saves a day's sleep, heart and activity numbers", async () => {
    expect(await call({ action: 'sync', today: '2026-11-19' })).toEqual({ status: 200, json: { ok: true, days: 1 } });
    expect(fake.tables.health_days).toEqual([
      expect.objectContaining({
        user_id: 'u1',
        day: '2026-11-18',
        source: 'google',
        steps: 9876,
        calories: 2310,
        avg_hr: 71.3,
        max_hr: 162,
        resting_hr: 54,
        hrv_ms: 48.4,
        // the night, not the nap
        sleep_min: 412,
        sleep_deep_min: 70,
        sleep_rem_min: 95,
        sleep_light_min: 247,
        sleep_awake_min: 38,
        bed_at: '2026-11-18T05:10:00Z',
        wake_at: '2026-11-18T12:40:00Z',
      }),
    ]);
    expect(fake.tables.health_links[0]).toMatchObject({ last_error: null });
    expect(fake.tables.health_links[0].last_sync_at).toBeTruthy();
  });

  it('updates the same day instead of adding it twice', async () => {
    await call({ action: 'sync', today: '2026-11-19' });
    await call({ action: 'sync', today: '2026-11-19' });
    expect(fake.tables.health_days).toHaveLength(1);
  });

  it('goes back 30 days the first time, and two days before the last sync after that', async () => {
    await call({ action: 'sync', today: '2026-11-19' });
    const firstSteps = google.calls.find((c) => c.url.includes('/steps/'))!;
    expect(JSON.parse(firstSteps.body!).range.start.date).toEqual(DAY(2026, 10, 21));

    fake.tables.health_links[0].last_sync_at = '2026-11-15T08:00:00Z';
    google.calls = [];
    await call({ action: 'sync', today: '2026-11-19' });
    const steps = google.calls.find((c) => c.url.includes('/steps/'))!;
    expect(JSON.parse(steps.body!).range).toMatchObject({ start: { date: DAY(2026, 11, 13) }, end: { date: DAY(2026, 11, 20) } });
  });

  it("keeps the rest when one kind of data fails, and notes what failed", async () => {
    google.answer = (url) => (url.includes('/sleep/') ? { status: 500, body: { error: 'boom' } } : googleData(url));
    expect((await call({ action: 'sync', today: '2026-11-19' })).json).toEqual({ ok: true, days: 1 });
    expect(fake.tables.health_days[0]).toMatchObject({ steps: 9876 });
    expect(fake.tables.health_days[0].sleep_min).toBeUndefined();
    expect(String(fake.tables.health_links[0].last_error)).toMatch(/^sleep: sleep 500/);
  });

  it('asks to reconnect when Google took the access back', async () => {
    google.answer = (url) =>
      url.includes('oauth2.googleapis.com/token') ? { status: 400, body: { error: 'invalid_grant' } } : googleData(url);
    expect(await call({ action: 'sync', today: '2026-11-19' })).toEqual({ status: 409, json: { error: 'reconnect' } });
    expect(fake.tables.health_links[0]).toMatchObject({ refresh_token: null, last_error: 'reconnect' });
  });

  it('needs a connection first', async () => {
    fake.tables.health_links = [];
    expect(await call({ action: 'sync', today: '2026-11-19' })).toEqual({ status: 409, json: { error: 'reconnect' } });
  });
});

describe('one day, hour by hour', () => {
  beforeEach(() => {
    fake.tables.health_links = [{ ...LINKED }];
  });

  it('checks the range', async () => {
    const day = { action: 'day', day: '2026-11-18' };
    expect((await call({ ...day, start: '2026-11-18T06:00:00Z', end: '2026-11-17T06:00:00Z' })).json).toEqual({ error: 'range' });
    expect((await call({ ...day, start: '2026-11-18T06:00:00Z', end: '2026-11-20T06:00:00Z' })).json).toEqual({ error: 'range' });
    expect((await call({ ...day, day: 'yesterday', start: '2026-11-18T06:00:00Z', end: '2026-11-19T06:00:00Z' })).json).toEqual({ error: 'range' });
  });

  it('puts each hour in its place and finds the night', async () => {
    google.answer = (url) => {
      if (url.includes('/steps/dataPoints:rollUp')) return { body: { rollupDataPoints: [{ startTime: '2026-11-18T08:00:00Z', steps: { countSum: 420 } }] } };
      if (url.includes('/heart-rate/dataPoints:rollUp'))
        return { body: { rollupDataPoints: [{ startTime: '2026-11-18T08:00:00Z', heartRate: { beatsPerMinuteAvg: 80, beatsPerMinuteMin: 61, beatsPerMinuteMax: 120 } }] } };
      return googleData(url);
    };
    const res = await call({ action: 'day', day: '2026-11-18', start: '2026-11-18T06:00:00Z', end: '2026-11-19T06:00:00Z' });
    expect(res.status).toBe(200);
    const hours = res.json.hours as Record<string, unknown>[];
    expect(hours).toHaveLength(24);
    expect(hours[2]).toMatchObject({ start: '2026-11-18T08:00:00.000Z', steps: 420, hrAvg: 80, hrMin: 61, hrMax: 120 });
    expect(hours[3]).toMatchObject({ steps: null, hrAvg: null });
    expect(res.json.sleep).toMatchObject({ minutes: 412, start: '2026-11-18T05:10:00Z', end: '2026-11-18T12:40:00Z' });
    expect(res.json.now).toBeNull(); // a past day has no "right now"
  });
});

describe('disconnecting', () => {
  it("revokes Google's access and forgets the link and the synced numbers", async () => {
    fake.tables.health_links = [{ ...LINKED }];
    fake.tables.health_days = [
      { user_id: 'u1', day: '2026-11-18', source: 'google', steps: 1 },
      { user_id: 'u1', day: '2026-11-18', source: 'manual', steps: 2 },
      { user_id: 'u9', day: '2026-11-18', source: 'google', steps: 3 },
    ];
    expect(await call({ action: 'disconnect' })).toEqual({ status: 200, json: { ok: true } });
    expect(google.calls.map((c) => c.url)).toEqual(['https://oauth2.googleapis.com/revoke?token=refresh-1']);
    expect(fake.tables.health_links).toEqual([]);
    expect(fake.tables.health_days.map((d) => d.steps)).toEqual([2, 3]);
  });
});
