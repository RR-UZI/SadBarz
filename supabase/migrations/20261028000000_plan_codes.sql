-- Plan codes: every coach plan gets a code like SB-7K4QXM. Another athlete who
-- redeems it gets that plan's routines in Rutinas (as Uzi approved them).
-- Free accounts redeem 1 code per calendar month (Mexico City time), Pro and
-- admins as many as they like. The check runs here on the server, so the app
-- can't skip it. Run this whole file once in the SQL Editor.

alter table public.coach_plans add column if not exists code text;
create unique index if not exists coach_plans_code on public.coach_plans (code);

-- 6 characters without look-alikes (no 0/O, 1/I/L), so codes are easy to read out and type.
create or replace function public.new_plan_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := 'SB-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.coach_plans where code = candidate);
  end loop;
  return candidate;
end $$;

alter table public.coach_plans alter column code set default public.new_plan_code();
update public.coach_plans set code = public.new_plan_code() where code is null;

-- Who redeemed which plan, and when (the monthly limit counts these).
create table if not exists public.plan_redemptions (
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.coach_plans (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);
create index if not exists plan_redemptions_user_time on public.plan_redemptions (user_id, redeemed_at desc);

alter table public.plan_redemptions enable row level security;

drop policy if exists "Users read their redemptions" on public.plan_redemptions;
create policy "Users read their redemptions" on public.plan_redemptions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Admins read all redemptions" on public.plan_redemptions;
create policy "Admins read all redemptions" on public.plan_redemptions
  for select to authenticated using ((select public.is_admin()));

-- Only redeem_plan_code below adds rows.
revoke all on public.plan_redemptions from anon, authenticated;
grant select on public.plan_redemptions to authenticated;

-- Redeem a code. Answers { error: 'auth' | 'not_found' | 'limit', next? } or
-- { code, weeks, progression, days: [{ day, routine }], exercises } with the
-- exercises the routines use (so the original athlete's own exercises come along).
-- Redeeming the same plan again (or your own plan) is free and doesn't count.
create or replace function public.redeem_plan_code(plan_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  meta jsonb := coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb);
  unlimited boolean := coalesce(meta ->> 'plan', '') = 'pro' or coalesce((meta ->> 'admin')::boolean, false);
  tz constant text := 'America/Mexico_City';
  month_start timestamptz := date_trunc('month', now() at time zone tz) at time zone tz;
  wanted text := upper(regexp_replace(coalesce(plan_code, ''), '[^A-Za-z0-9]', '', 'g'));
  found_plan record;
  used int;
  ids text[];
begin
  if me is null then
    return jsonb_build_object('error', 'auth');
  end if;
  -- "SB-7K4QXM", "sb 7k4qxm" and "7K4QXM" are the same code.
  if length(wanted) = 8 and left(wanted, 2) = 'SB' then
    wanted := substr(wanted, 3);
  end if;
  wanted := 'SB-' || wanted;

  select p.id, p.user_id, p.code, p.weeks, coalesce(p.approved_plan, p.plan) as plan, p.input
    into found_plan
    from public.coach_plans p
    where p.code = wanted and p.status = 'approved';
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if found_plan.user_id <> me and not exists (select 1 from public.plan_redemptions r where r.user_id = me and r.plan_id = found_plan.id) then
    if not unlimited then
      select count(*) into used from public.plan_redemptions r where r.user_id = me and r.redeemed_at >= month_start;
      if used >= 1 then
        return jsonb_build_object('error', 'limit', 'next', to_char((month_start + interval '1 month') at time zone tz, 'YYYY-MM-DD'));
      end if;
    end if;
    insert into public.plan_redemptions (user_id, plan_id) values (me, found_plan.id);
  end if;

  select array_agg(distinct x.id) into ids from (
    select it ->> 'exerciseId' as id
      from jsonb_array_elements(coalesce(found_plan.plan -> 'days', '[]')) d,
           jsonb_array_elements(coalesce(d -> 'routine' -> 'blocks', '[]')) b,
           jsonb_array_elements(coalesce(b -> 'items', '[]')) it
    union all
    select it ->> 'exerciseId'
      from jsonb_array_elements(coalesce(found_plan.plan -> 'days', '[]')) d,
           jsonb_array_elements(coalesce(d -> 'routine' -> 'blocks', '[]')) b,
           jsonb_array_elements(coalesce(b -> 'rows', '[]')) r,
           jsonb_array_elements(coalesce(r -> 'items', '[]')) it
  ) x;

  return jsonb_build_object(
    'code', found_plan.code,
    'weeks', found_plan.weeks,
    'progression', coalesce(found_plan.plan -> 'progression', '""'),
    'days', coalesce(found_plan.plan -> 'days', '[]'),
    'exercises', coalesce((
      select jsonb_agg(e) from jsonb_array_elements(coalesce(found_plan.input -> 'exercises', '[]')) e
      where e ->> 'id' = any(coalesce(ids, '{}'))
    ), '[]')
  );
end $$;

revoke all on function public.redeem_plan_code(text) from public, anon;
grant execute on function public.redeem_plan_code(text) to authenticated;
