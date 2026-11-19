// SadBarz health: connects an athlete's Google Health account (Fitbit, Pixel Watch) and syncs their daily
// numbers (sleep with stages, resting heart rate, heart rate, HRV, steps, calories) into health_days.
//
// POST with the athlete's session (supabase.functions.invoke sends it):
//   { action: 'status' }                       -> { configured, connected, lastSync, error }
//   { action: 'start', redirect }              -> { url }   Google's sign-in page; Google sends the athlete back to
//                                                 redirect with ?code=...&state=...
//   { action: 'finish', code, state, redirect, today } -> { ok, days }   keeps the link and syncs the last 30 days
//   { action: 'sync', today, days? }           -> { ok, days }   syncs since the last sync (2 days back at least)
//   { action: 'day', day, start, end }         -> { hours, sleep, now }   one day hour by hour, read live (not saved):
//      hours = 24 x { start, steps, calories, hrAvg, hrMin, hrMax }; sleep = the night that ended that day with its
//      stages; now = the latest heart rate (only when end is in the future, i.e. today). start/end = the athlete's
//      local midnight to midnight, as ISO times.
//   { action: 'disconnect' }                   -> { ok }   forgets the link and the synced numbers
//   errors: 401 auth, 400 bad request, 409 'reconnect' (Google took the access back), 500 'failed' / 'config'
//
// Secrets (Supabase > Edge Functions > Secrets): GOOGLE_HEALTH_CLIENT_ID and GOOGLE_HEALTH_CLIENT_SECRET,
// the Web client from Google Cloud with the Google Health API on. SUPABASE_URL and the server key come from Supabase.
// One file on purpose, so it can be pasted into the Supabase dashboard editor.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const API = 'https://health.googleapis.com/v4/users/me/dataTypes';
const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
];
const FIRST_DAYS = 30; // synced when the athlete connects
const MAX_DAYS = 90; // the most one sync reaches back
const STATE_MS = 15 * 60 * 1000; // a sign-in has this long to come back
// Where Google may send the athlete back to (it must also be an Authorized redirect URI in Google Cloud).
const REDIRECTS = [/^https:\/\/(www\.)?sadbarz\.com\/$/, /^https:\/\/[a-z0-9-]+\.vercel\.app\/$/, /^http:\/\/localhost:\d+\/$/];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  return keys.default ?? Object.values(keys)[0];
}
const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), { auth: { persistSession: false } });

const CLIENT_ID = Deno.env.get('GOOGLE_HEALTH_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_HEALTH_CLIENT_SECRET') ?? '';

class Reconnect extends Error {}

// ---------- Dates ----------

const DAY_MS = 86_400_000;
const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const civil = (d: string) => {
  const [year, month, day] = d.split('-').map(Number);
  return { date: { year, month, day }, time: { hours: 0, minutes: 0, seconds: 0 } };
};
const pad = (n: number) => String(n).padStart(2, '0');
// Google's {year, month, day} (alone or inside a civil date-time) as YYYY-MM-DD.
function dayOf(v: unknown): string | null {
  if (!v || typeof v !== 'object') return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
  const o = v as Record<string, unknown>;
  if (o.date) return dayOf(o.date);
  if (typeof o.year === 'number' && typeof o.month === 'number' && typeof o.day === 'number') return `${o.year}-${pad(o.month)}-${pad(o.day)}`;
  return null;
}
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
// The first number in an object whose key matches (Google's value objects are small: { beatsPerMinute: 54, date: {...} }).
function pick(o: unknown, key: RegExp): number | null {
  if (!o || typeof o !== 'object') return null;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (key.test(k) && num(v) !== null) return num(v);
  }
  for (const v of Object.values(o as Record<string, unknown>)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const n = pick(v, key);
      if (n !== null) return n;
    }
  }
  return null;
}
// A list answer's items: the first array in it.
const itemsOf = (r: Record<string, unknown>): Record<string, unknown>[] =>
  ((r.dataPoints ?? r.rollupDataPoints ?? Object.values(r).find(Array.isArray) ?? []) as Record<string, unknown>[]);

// ---------- Google ----------

async function token(params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (out.error === 'invalid_grant') throw new Reconnect('invalid_grant');
  if (!res.ok) throw new Error(`token ${res.status} ${String(out.error ?? '')} ${String(out.error_description ?? '')}`.trim());
  return out;
}

async function call(access: string, path: string, init?: { body?: unknown; query?: Record<string, string> }): Promise<Record<string, unknown>> {
  const url = `${API}/${path}${init?.query ? `?${new URLSearchParams(init.query)}` : ''}`;
  const res = await fetch(url, {
    method: init?.body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${access}`, Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (res.status === 401) throw new Reconnect('401');
  if (!res.ok) throw new Error(`${path.split('/')[0]} ${res.status} ${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

// Every page of a list.
async function list(access: string, type: string, filter: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let pageToken = '';
  for (let page = 0; page < 20; page++) {
    const r = await call(access, `${type}/dataPoints`, { query: { filter, pageSize: '100', ...(pageToken ? { pageToken } : {}) } });
    out.push(...itemsOf(r));
    pageToken = typeof r.nextPageToken === 'string' ? r.nextPageToken : '';
    if (!pageToken) break;
  }
  return out;
}

// One value per day, from..to (to not included), in chunks of at most `chunk` days.
async function daily(access: string, type: string, from: string, to: string, chunk: number): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let start = from; start < to; start = addDays(start, chunk)) {
    const end = addDays(start, chunk) < to ? addDays(start, chunk) : to;
    let pageToken = '';
    for (let page = 0; page < 10; page++) {
      const r = await call(access, `${type}/dataPoints:dailyRollUp`, {
        body: { range: { start: civil(start), end: civil(end) }, windowSizeDays: 1, ...(pageToken ? { pageToken } : {}) },
      });
      out.push(...itemsOf(r));
      pageToken = typeof r.nextPageToken === 'string' ? r.nextPageToken : '';
      if (!pageToken) break;
    }
  }
  return out;
}

type Day = {
  sleep_min?: number | null;
  sleep_deep_min?: number | null;
  sleep_rem_min?: number | null;
  sleep_light_min?: number | null;
  sleep_awake_min?: number | null;
  bed_at?: string | null;
  wake_at?: string | null;
  resting_hr?: number | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  hrv_ms?: number | null;
  steps?: number | null;
  calories?: number | null;
};

const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

// Reads from..to (to not included) from Google and saves it. Each data type on its own: one failing doesn't stop the rest.
async function sync(userId: string, refresh: string, from: string, to: string): Promise<{ days: number; errors: string[] }> {
  const { access_token } = await token({ grant_type: 'refresh_token', refresh_token: refresh });
  const access = String(access_token);
  const days = new Map<string, Day>();
  const at = (d: string) => days.get(d) ?? (days.set(d, {}), days.get(d)!);
  const inRange = (d: string | null): d is string => !!d && d >= from && d < to;
  const errors: string[] = [];
  const debug: Record<string, unknown> = {};

  const parts: [string, () => Promise<void>][] = [
    ['steps', async () => {
      const rows = await daily(access, 'steps', from, to, 90);
      debug.steps = rows[0];
      for (const r of rows) {
        const d = dayOf(r.civilStartTime ?? r.startTime);
        const v = pick(r.steps ?? r, /count/i);
        if (inRange(d) && v !== null) at(d).steps = Math.round(v);
      }
    }],
    ['total-calories', async () => {
      const rows = await daily(access, 'total-calories', from, to, 14);
      debug.calories = rows[0];
      for (const r of rows) {
        const d = dayOf(r.civilStartTime ?? r.startTime);
        const v = pick(r.totalCalories ?? r, /kcal/i);
        if (inRange(d) && v !== null) at(d).calories = Math.round(v);
      }
    }],
    ['heart-rate', async () => {
      const rows = await daily(access, 'heart-rate', from, to, 14);
      debug.heartRate = rows[0];
      for (const r of rows) {
        const d = dayOf(r.civilStartTime ?? r.startTime);
        const hr = (r.heartRate ?? r) as Record<string, unknown>;
        if (!inRange(d)) continue;
        const avg = pick(hr, /avg/i), max = pick(hr, /max/i);
        if (avg !== null) at(d).avg_hr = round1(avg);
        if (max !== null) at(d).max_hr = round1(max);
      }
    }],
    ['daily-resting-heart-rate', async () => {
      const rows = await list(access, 'daily-resting-heart-rate', `daily_resting_heart_rate.date >= "${from}" AND daily_resting_heart_rate.date < "${to}"`);
      debug.restingHr = rows[0];
      for (const r of rows) {
        const v = (r.dailyRestingHeartRate ?? r) as Record<string, unknown>;
        const d = dayOf(v.date ?? r.date);
        const bpm = pick(v, /beats|bpm|rate/i);
        if (inRange(d) && bpm !== null) at(d).resting_hr = round1(bpm);
      }
    }],
    ['daily-heart-rate-variability', async () => {
      const rows = await list(access, 'daily-heart-rate-variability', `daily_heart_rate_variability.date >= "${from}" AND daily_heart_rate_variability.date < "${to}"`);
      debug.hrv = rows[0];
      for (const r of rows) {
        const v = (r.dailyHeartRateVariability ?? r) as Record<string, unknown>;
        const d = dayOf(v.date ?? r.date);
        const ms = pick(v, /milli|rmssd|variability|average/i);
        if (inRange(d) && ms !== null) at(d).hrv_ms = round1(ms);
      }
    }],
    ['sleep', async () => {
      const rows = await list(access, 'sleep', `sleep.interval.civil_end_time >= "${from}T00:00:00" AND sleep.interval.civil_end_time < "${to}T00:00:00"`);
      debug.sleep = rows[0];
      // The longest sleep that ended on a day is that day's night (naps don't replace it).
      const best = new Map<string, number>();
      for (const r of rows) {
        const s = (r.sleep ?? r) as Record<string, unknown>;
        const interval = (s.interval ?? {}) as Record<string, unknown>;
        const summary = (s.summary ?? {}) as Record<string, unknown>;
        const d = dayOf(interval.civilEndTime ?? interval.endTime);
        const asleep = num(summary.minutesAsleep);
        if (!inRange(d) || asleep === null || asleep <= (best.get(d) ?? 0)) continue;
        best.set(d, asleep);
        const stage = (type: string) => {
          const st = ((summary.stagesSummary ?? []) as Record<string, unknown>[]).find((x) => x.type === type);
          return st ? num(st.minutes) : null;
        };
        Object.assign(at(d), {
          sleep_min: Math.round(asleep),
          sleep_deep_min: stage('DEEP'),
          sleep_rem_min: stage('REM'),
          sleep_light_min: stage('LIGHT'),
          sleep_awake_min: stage('AWAKE') ?? num(summary.minutesAwake),
          bed_at: typeof interval.startTime === 'string' ? interval.startTime : null,
          wake_at: typeof interval.endTime === 'string' ? interval.endTime : null,
        });
      }
    }],
  ];

  for (const [name, run] of parts) {
    try {
      await run();
    } catch (e) {
      if (e instanceof Reconnect) throw e;
      errors.push(`${name}: ${String((e as Error).message ?? e).slice(0, 300)}`);
    }
  }

  const now = new Date().toISOString();
  const rows = [...days.entries()].map(([day, v]) => ({ user_id: userId, day, source: 'google', ...v, updated_at: now }));
  if (rows.length) {
    const { error } = await db.from('health_days').upsert(rows, { onConflict: 'user_id,day,source' });
    if (error) throw new Error(`save ${error.message}`);
  }
  await db
    .from('health_links')
    .update({ last_sync_at: now, last_error: errors.length ? errors.join(' | ').slice(0, 2000) : null, debug, updated_at: now })
    .eq('user_id', userId);
  return { days: rows.length, errors };
}

// ---------- One day, hour by hour ----------

const iso = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v : null);
// A start and end time anywhere in a small object ({ startTime, endTime } or { interval: { startTime, endTime } }).
function timesOf(o: Record<string, unknown>): { start: string | null; end: string | null } {
  const start = iso(o.startTime) ?? iso(o.start), end = iso(o.endTime) ?? iso(o.end);
  if (start && end) return { start, end };
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const t = timesOf(v as Record<string, unknown>);
      if (t.start && t.end) return t;
    }
  }
  return { start, end };
}
const STAGES = ['AWAKE', 'LIGHT', 'DEEP', 'REM', 'ASLEEP', 'RESTLESS'];
function stageType(o: Record<string, unknown>): string | null {
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && STAGES.includes(v)) return v;
    if (typeof v === 'string') {
      const hit = STAGES.find((s) => v.endsWith(`_${s}`) || v === s);
      if (hit) return hit;
    }
  }
  return null;
}

async function dayDetail(userId: string, refresh: string, day: string, start: string, end: string) {
  const { access_token } = await token({ grant_type: 'refresh_token', refresh_token: refresh });
  const access = String(access_token);
  const debug: Record<string, unknown> = {};
  const hours = Array.from({ length: 24 }, (_, i) => ({
    start: new Date(Date.parse(start) + i * 3600_000).toISOString(),
    steps: null as number | null,
    calories: null as number | null,
    hrAvg: null as number | null,
    hrMin: null as number | null,
    hrMax: null as number | null,
  }));
  const until = new Date(Math.min(Date.parse(end), Date.now())).toISOString();
  const slot = (r: Record<string, unknown>) => {
    const t = Date.parse(String(r.startTime ?? ''));
    const i = Math.floor((t - Date.parse(start)) / 3600_000);
    return Number.isFinite(i) && i >= 0 && i < 24 ? hours[i] : null;
  };
  const rollUp = async (type: string) =>
    itemsOf(await call(access, `${type}/dataPoints:rollUp`, { body: { range: { startTime: start, endTime: until }, windowSize: '3600s' } }));

  const parts: [string, () => Promise<unknown>][] = [
    ['steps', async () => {
      for (const r of await rollUp('steps')) {
        const h = slot(r), v = pick(r.steps ?? r, /count/i);
        if (h && v !== null) h.steps = Math.round(v);
      }
    }],
    ['total-calories', async () => {
      for (const r of await rollUp('total-calories')) {
        const h = slot(r), v = pick(r.totalCalories ?? r, /kcal/i);
        if (h && v !== null) h.calories = Math.round(v);
      }
    }],
    ['heart-rate', async () => {
      const rows = await rollUp('heart-rate');
      debug.hourHr = rows[0];
      for (const r of rows) {
        const h = slot(r), hr = (r.heartRate ?? r) as Record<string, unknown>;
        if (!h) continue;
        h.hrAvg = round1(pick(hr, /avg$/i));
        h.hrMin = round1(pick(hr, /min$/i));
        h.hrMax = round1(pick(hr, /max$/i));
      }
    }],
    ['sleep', async () => {
      const rows = await list(access, 'sleep', `sleep.interval.civil_end_time >= "${day}T00:00:00" AND sleep.interval.civil_end_time < "${addDays(day, 1)}T00:00:00"`);
      let best: Record<string, unknown> | null = null, bestMin = 0;
      for (const r of rows) {
        const s = (r.sleep ?? r) as Record<string, unknown>;
        const m = num(((s.summary ?? {}) as Record<string, unknown>).minutesAsleep) ?? 0;
        if (m > bestMin) (best = s), (bestMin = m);
      }
      if (!best) return null;
      const stages = ((best.stages ?? []) as Record<string, unknown>[]).flatMap((st) => {
        const t = timesOf(st), type = stageType(st);
        return t.start && t.end && type ? [{ type, start: t.start, end: t.end }] : [];
      });
      debug.dayStage = (best.stages as unknown[] | undefined)?.[0];
      const t = timesOf((best.interval ?? {}) as Record<string, unknown>);
      return { start: t.start, end: t.end, minutes: bestMin, stages };
    }],
  ];
  const out: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const [name, run] of parts) {
    try {
      const r = await run();
      if (name === 'sleep') out.sleep = r;
    } catch (e) {
      if (e instanceof Reconnect) throw e;
      errors.push(`${name}: ${String((e as Error).message ?? e).slice(0, 200)}`);
    }
  }

  // Right now: the latest minute with a heart rate in the last 30 minutes (today only).
  let now: { bpm: number; at: string } | null = null;
  if (Date.parse(end) > Date.now()) {
    try {
      const from = new Date(Date.now() - 30 * 60_000).toISOString();
      const rows = itemsOf(await call(access, 'heart-rate/dataPoints:rollUp', { body: { range: { startTime: from, endTime: new Date().toISOString() }, windowSize: '60s' } }));
      for (const r of rows) {
        const bpm = pick((r.heartRate ?? r) as Record<string, unknown>, /avg/i);
        const at = iso(r.endTime) ?? iso(r.startTime);
        if (bpm !== null && at && (!now || at > now.at)) now = { bpm: Math.round(bpm), at };
      }
    } catch (e) {
      if (e instanceof Reconnect) throw e;
      errors.push(`now: ${String((e as Error).message ?? e).slice(0, 200)}`);
    }
  }

  const { data: link } = await db.from('health_links').select('debug').eq('user_id', userId).maybeSingle();
  await db
    .from('health_links')
    .update({ debug: { ...((link?.debug as Record<string, unknown>) ?? {}), ...debug, dayErrors: errors.length ? errors : undefined } })
    .eq('user_id', userId);
  return { hours, sleep: out.sleep ?? null, now, errors: errors.length };
}

// ---------- The request ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = await db.auth.getUser(jwt);
  const user = auth?.user;
  if (authError || !user) return json({ error: 'auth' }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const configured = !!(CLIENT_ID && CLIENT_SECRET);
  // Health is a Pro feature. Free accounts can still see their status and disconnect (e.g. after leaving Pro).
  const pro = user.app_metadata?.plan === 'pro' || user.app_metadata?.admin === true;
  if (!pro && body.action !== 'status' && body.action !== 'disconnect') return json({ error: 'pro' }, 403);
  const { data: link } = await db.from('health_links').select('*').eq('user_id', user.id).maybeSingle();
  const today = isDay(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const tomorrow = addDays(today, 1);

  try {
    switch (body.action) {
      case 'status':
        return json({
          configured,
          connected: !!link?.refresh_token,
          lastSync: link?.last_sync_at ?? null,
          error: link?.refresh_token ? (link.last_error ?? null) : null,
        });

      case 'start': {
        if (!configured) return json({ error: 'config' }, 500);
        const redirect = String(body.redirect ?? '');
        if (!REDIRECTS.some((r) => r.test(redirect))) return json({ error: 'redirect' }, 400);
        const state = `health.${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        await db.from('health_links').upsert({ user_id: user.id, state, state_at: now, updated_at: now }, { onConflict: 'user_id' });
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.search = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: redirect,
          response_type: 'code',
          scope: SCOPES.join(' '),
          access_type: 'offline',
          prompt: 'consent',
          state,
        }).toString();
        return json({ url: url.toString() });
      }

      case 'finish': {
        if (!configured) return json({ error: 'config' }, 500);
        const redirect = String(body.redirect ?? '');
        const fresh = link?.state_at && Date.now() - Date.parse(link.state_at) < STATE_MS;
        if (!link?.state || link.state !== body.state || !fresh || typeof body.code !== 'string') return json({ error: 'state' }, 400);
        if (!REDIRECTS.some((r) => r.test(redirect))) return json({ error: 'redirect' }, 400);
        const t = await token({ grant_type: 'authorization_code', code: body.code, redirect_uri: redirect });
        const refresh = typeof t.refresh_token === 'string' ? t.refresh_token : link.refresh_token;
        if (!refresh) return json({ error: 'refresh' }, 400);
        const now = new Date().toISOString();
        await db
          .from('health_links')
          .update({ refresh_token: refresh, scopes: String(t.scope ?? ''), state: null, state_at: null, connected_at: now, last_error: null, updated_at: now })
          .eq('user_id', user.id);
        const r = await sync(user.id, refresh, addDays(tomorrow, -FIRST_DAYS), tomorrow);
        return json({ ok: true, days: r.days });
      }

      case 'sync': {
        if (!configured) return json({ error: 'config' }, 500);
        if (!link?.refresh_token) return json({ error: 'reconnect' }, 409);
        // From two days before the last sync (late watch syncs fill in), at most MAX_DAYS back.
        const back = Number(body.days) > 0 ? Math.min(MAX_DAYS, Math.round(Number(body.days))) : 0;
        let from = back
          ? addDays(tomorrow, -back)
          : link.last_sync_at
            ? addDays(String(link.last_sync_at).slice(0, 10), -2)
            : addDays(tomorrow, -FIRST_DAYS);
        if (from < addDays(tomorrow, -MAX_DAYS)) from = addDays(tomorrow, -MAX_DAYS);
        if (from >= tomorrow) from = today;
        const r = await sync(user.id, link.refresh_token, from, tomorrow);
        return json({ ok: true, days: r.days });
      }

      case 'day': {
        if (!configured) return json({ error: 'config' }, 500);
        if (!link?.refresh_token) return json({ error: 'reconnect' }, 409);
        const start = iso(body.start), end = iso(body.end);
        if (!isDay(body.day) || !start || !end || Date.parse(end) - Date.parse(start) > 26 * 3600_000 || Date.parse(end) <= Date.parse(start)) {
          return json({ error: 'range' }, 400);
        }
        return json(await dayDetail(user.id, link.refresh_token, body.day, start, end));
      }

      case 'disconnect': {
        if (link?.refresh_token) {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(link.refresh_token)}`, { method: 'POST' }).catch(() => {});
        }
        await db.from('health_links').delete().eq('user_id', user.id);
        await db.from('health_days').delete().eq('user_id', user.id).eq('source', 'google');
        return json({ ok: true });
      }

      default:
        return json({ error: 'action' }, 400);
    }
  } catch (e) {
    if (e instanceof Reconnect) {
      await db.from('health_links').update({ refresh_token: null, last_error: 'reconnect', updated_at: new Date().toISOString() }).eq('user_id', user.id);
      return json({ error: 'reconnect' }, 409);
    }
    console.error('health-google', e);
    await db.from('health_links').update({ last_error: String((e as Error).message ?? e).slice(0, 2000), updated_at: new Date().toISOString() }).eq('user_id', user.id);
    return json({ error: 'failed' }, 500);
  }
});
