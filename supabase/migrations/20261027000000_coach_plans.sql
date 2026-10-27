-- Plans the AI coach writes for Pro athletes (see supabase/functions/coach-plan).
-- Every plan waits for Uzi's review before the athlete sees it:
--   writing  -> the coach is still writing it
--   review   -> written, waiting for Uzi
--   approved -> Uzi approved it (as is or edited), the athlete can see it
--   returned -> Uzi sent it back with a note; the coach writes a new one
--   failed   -> something went wrong while writing it (see error)
-- Only the coach function writes new plans (it runs on the server). Athletes read
-- their approved plans and the status of their latest one; admins read and review all.

create table if not exists public.coach_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'writing' check (status in ('writing', 'review', 'approved', 'returned', 'failed')),
  weeks smallint not null check (weeks in (1, 2, 4)),
  start_date date,
  -- What the coach was given: profile, recent training and records.
  input jsonb not null default '{}'::jsonb,
  -- The proposed week: { summary, progression, routines: Routine[] } in the app's format.
  plan jsonb,
  -- Uzi's version when he edits it before approving, and his note when he sends it back.
  approved_plan jsonb,
  review_note text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  model text,
  usage jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_plans_user_created on public.coach_plans (user_id, created_at desc);
create index if not exists coach_plans_status on public.coach_plans (status, created_at);

alter table public.coach_plans enable row level security;

-- Admin = app_metadata.admin true, which only the server can set (see README).
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false)
$$;

drop policy if exists "Athletes read their approved plans" on public.coach_plans;
create policy "Athletes read their approved plans" on public.coach_plans
  for select to authenticated using ((select auth.uid()) = user_id and status = 'approved');

drop policy if exists "Admins read all plans" on public.coach_plans;
create policy "Admins read all plans" on public.coach_plans
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "Admins review plans" on public.coach_plans;
create policy "Admins review plans" on public.coach_plans
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.coach_plans from anon;
grant select, update on public.coach_plans to authenticated;

-- The athlete's latest plan without the plan itself or Uzi's notes, so the app
-- can show "Tu coach está revisando tu plan" before Uzi approves it.
create or replace function public.my_coach_plan_status()
returns table (id uuid, status text, weeks smallint, start_date date, created_at timestamptz, reviewed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.status, p.weeks, p.start_date, p.created_at, p.reviewed_at
  from public.coach_plans p
  where p.user_id = auth.uid()
  order by p.created_at desc
  limit 1
$$;

revoke all on function public.my_coach_plan_status() from public, anon;
grant execute on function public.my_coach_plan_status() to authenticated;
