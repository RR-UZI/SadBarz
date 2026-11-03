-- Who asked for each plan, for Uzi's review list. Plans only store the name the
-- athlete had when they asked (and older ones, or accounts without a name, none),
-- so admins read the current name and email from the account itself. Only admins
-- get an answer; everyone else gets no rows.
create or replace function public.plan_athletes(plan_ids uuid[])
returns table (plan_id uuid, name text, email text)
language sql stable security definer set search_path = '' as $$
  select p.id,
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name', '')), ''),
    u.email::text
  from public.coach_plans p
  join auth.users u on u.id = p.user_id
  where p.id = any(plan_ids) and public.is_admin();
$$;

revoke all on function public.plan_athletes(uuid[]) from public, anon;
grant execute on function public.plan_athletes(uuid[]) to authenticated;
