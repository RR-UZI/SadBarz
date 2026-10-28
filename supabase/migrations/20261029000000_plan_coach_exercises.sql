-- Exercises Uzi creates live only in his account, so athletes who got a plan
-- with one saw "?" instead of its name. From now on the app adds them to the
-- plan's exercise list when he approves it (the athlete's app and anyone who
-- redeems the code add them from there). This fixes the plans approved before:
-- each approved plan gets the admins' own exercises it uses but didn't list.
-- Run this whole file in the SQL Editor (running it again is safe).

update public.coach_plans p
set input = jsonb_set(coalesce(p.input, '{}'), '{exercises}', coalesce(p.input -> 'exercises', '[]') || missing.list)
from (
  select p2.id, jsonb_agg(distinct ex - 'custom') as list
  from public.coach_plans p2
  cross join lateral (
    select distinct used #>> '{}' as id
    from jsonb_path_query(coalesce(p2.approved_plan, p2.plan, '{}'), 'strict $.**.exerciseId') used
  ) u
  join public.user_data d on d.user_id in (select a.id from auth.users a where a.raw_app_meta_data ->> 'admin' = 'true')
  cross join lateral jsonb_array_elements(coalesce(d.data -> 'exercises', '[]')) ex
  where p2.status = 'approved'
    and ex ->> 'id' = u.id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p2.input -> 'exercises', '[]')) have where have ->> 'id' = u.id
    )
  group by p2.id
) missing
where p.id = missing.id;
