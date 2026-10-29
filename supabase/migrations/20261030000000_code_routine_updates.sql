-- Routines added from a plan code follow the plan: when Uzi fixes an approved
-- plan, the app of everyone who redeemed its code updates their copies.
-- redeemed_plans() answers the current version of the plans behind the given
-- codes, only for plans this account redeemed (or its own), so it can't be used
-- to read plans without redeeming them. Run this whole file in the SQL Editor
-- (running it again is safe).

create or replace function public.redeemed_plans(plan_codes text[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', p.code,
    'version', p.updated_at,
    'days', coalesce(coalesce(p.approved_plan, p.plan) -> 'days', '[]'),
    -- The exercises the routines use, so ones the athlete doesn't have can be added.
    'exercises', coalesce((
      select jsonb_agg(e) from jsonb_array_elements(coalesce(p.input -> 'exercises', '[]')) e
      where e ->> 'id' in (select x #>> '{}' from jsonb_path_query(coalesce(p.approved_plan, p.plan, '{}'), 'strict $.**.exerciseId') x)
    ), '[]')
  )), '[]')
  from public.coach_plans p
  where p.status = 'approved'
    and p.code = any(plan_codes)
    and (p.user_id = auth.uid() or exists (select 1 from public.plan_redemptions r where r.plan_id = p.id and r.user_id = auth.uid()))
$$;

revoke all on function public.redeemed_plans(text[]) from public, anon;
grant execute on function public.redeemed_plans(text[]) to authenticated;
