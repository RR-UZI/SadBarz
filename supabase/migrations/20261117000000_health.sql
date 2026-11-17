-- Health: the athlete's daily health numbers (sleep, heart, activity) for the Health tab and the coach,
-- synced from Google Health (Fitbit, Pixel Watch) by the health-google Edge Function (server key).
-- Run once in Supabase > SQL Editor.

create table if not exists public.health_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null, -- the athlete's calendar day (sleep counts for the day they woke up)
  source text not null default 'google' check (source in ('google')),
  sleep_min int, -- minutes asleep in the main sleep that ended this day
  sleep_deep_min int,
  sleep_rem_min int,
  sleep_light_min int,
  sleep_awake_min int,
  bed_at timestamptz,
  wake_at timestamptz,
  resting_hr numeric, -- beats per minute
  avg_hr numeric,
  max_hr numeric,
  hrv_ms numeric, -- nightly heart rate variability (RMSSD, milliseconds)
  steps int,
  calories int, -- total kcal burned in the day
  updated_at timestamptz not null default now(),
  primary key (user_id, day, source)
);

alter table public.health_days enable row level security;

-- An athlete sees their own days; admins (Uzi) see everyone's.
drop policy if exists "health_days read" on public.health_days;
create policy "health_days read" on public.health_days
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Only the Edge Function writes (server key).
grant select on public.health_days to authenticated;

-- The link to the athlete's Google Health account. Holds the refresh token, so only the server key
-- reads it (row level security on, no policies); the app asks the Edge Function for the status.
create table if not exists public.health_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null default 'google',
  refresh_token text,
  scopes text,
  state text, -- the sign-in in progress (checked when Google sends the athlete back)
  state_at timestamptz,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  debug jsonb, -- the first item Google sent for each data type, to check the format
  updated_at timestamptz not null default now()
);

alter table public.health_links enable row level security;
revoke all on public.health_links from anon, authenticated;
