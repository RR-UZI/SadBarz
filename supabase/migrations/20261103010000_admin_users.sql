-- Admins manage accounts from the app (Home → Usuarios) instead of the SQL Editor.
-- Roles live in app_metadata, which only the server can change (see "Roles" in the README).
-- Both functions answer admins only: anyone else gets no rows, or an error.

-- Accounts, newest first, optionally filtered by email or name.
create or replace function public.admin_list_users(search text default '', max_rows int default 50)
returns table (id uuid, email text, name text, plan text, admin boolean, coach boolean, created_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id,
    u.email::text,
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name', '')), ''),
    case when u.raw_app_meta_data ->> 'plan' = 'pro' then 'pro' else 'free' end,
    coalesce((u.raw_app_meta_data ->> 'admin')::boolean, false),
    coalesce((u.raw_app_meta_data ->> 'coach')::boolean, false),
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  where public.is_admin()
    and (
      coalesce(trim(search), '') = ''
      or u.email ilike '%' || trim(search) || '%'
      or coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name', '') ilike '%' || trim(search) || '%'
    )
  order by u.created_at desc
  limit least(greatest(coalesce(max_rows, 50), 1), 200);
$$;

-- Give (pro) or take away (free) Pro. Returns the account's new plan.
create or replace function public.admin_set_plan(target uuid, new_plan text)
returns text
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if new_plan not in ('free', 'pro') then
    raise exception 'unknown plan %', new_plan using errcode = '22023';
  end if;
  update auth.users
    set raw_app_meta_data = case
      when new_plan = 'pro' then coalesce(raw_app_meta_data, '{}'::jsonb) || '{"plan":"pro"}'::jsonb
      else coalesce(raw_app_meta_data, '{}'::jsonb) - 'plan'
    end
  where id = target;
  if not found then
    raise exception 'no such account' using errcode = 'P0002';
  end if;
  return new_plan;
end;
$$;

revoke all on function public.admin_list_users(text, int) from public, anon;
revoke all on function public.admin_set_plan(uuid, text) from public, anon;
grant execute on function public.admin_list_users(text, int) to authenticated;
grant execute on function public.admin_set_plan(uuid, text) to authenticated;
