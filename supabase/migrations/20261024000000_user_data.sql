-- One private row per user with their routines, workouts, own exercises and
-- settings (see src/lib/sync.ts). Row level security makes each row readable
-- and writable only by the signed-in user it belongs to.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "Users read their own data" on public.user_data;
create policy "Users read their own data" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users add their own data" on public.user_data;
create policy "Users add their own data" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own data" on public.user_data;
create policy "Users update their own data" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own data" on public.user_data;
create policy "Users delete their own data" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Signed-in users only; nothing for anonymous visitors.
revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;
