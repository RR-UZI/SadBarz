-- Shared exercise pool. Anyone can make their own exercise and use it right away
-- (it lives in their user_data, as before). Every exercise someone makes waits
-- for an admin: approved ones join the pool everyone sees in the exercise list,
-- rejected ones stay only with the person who made them.
--
-- Nothing extra is sent from the app: the exercises waiting are read straight from
-- user_data, so one made offline shows up once it syncs.

-- The pool. Everyone can read it (it's just names); only review_exercise() writes it.
create table if not exists public.shared_exercises (
  id text primary key,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('reps', 'hold', 'distance', 'calories')),
  category text not null check (category in ('push', 'pull', 'legs', 'core', 'tubos', 'cardio', 'skills')),
  created_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz not null default now()
);

alter table public.shared_exercises enable row level security;
drop policy if exists "Everyone reads the exercise pool" on public.shared_exercises;
create policy "Everyone reads the exercise pool" on public.shared_exercises
  for select to anon, authenticated using (true);
grant select on public.shared_exercises to anon, authenticated;

-- What an admin decided about each exercise id (approved or rejected). Admins only.
create table if not exists public.exercise_reviews (
  exercise_id text primary key,
  status text not null check (status in ('approved', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz not null default now()
);

alter table public.exercise_reviews enable row level security;
drop policy if exists "Admins read exercise reviews" on public.exercise_reviews;
create policy "Admins read exercise reviews" on public.exercise_reviews
  for select to authenticated using ((select public.is_admin()));
revoke all on public.exercise_reviews from anon;

-- Exercises people made that no admin has decided on yet, oldest account first.
-- The same exercise can be in several accounts (routines from a code bring the
-- coach's exercises along): it's listed once, with who made it and how many have it.
create or replace function public.exercises_to_review()
returns table (id text, name text, kind text, category text, user_id uuid, user_name text, email text, accounts int)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select e ->> 'id' as id, e ->> 'name' as name, e ->> 'kind' as kind, e ->> 'category' as category,
      d.user_id, u.created_at as joined, u.email::text as email,
      nullif(trim(coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name', '')), '') as user_name
    from public.user_data d
    join auth.users u on u.id = d.user_id
    cross join lateral jsonb_array_elements(case when jsonb_typeof(d.data -> 'exercises') = 'array' then d.data -> 'exercises' else '[]'::jsonb end) e
    where (e ->> 'custom')::boolean is true and coalesce(e ->> 'id', '') <> ''
  ),
  waiting as (
    select m.* from mine m
    where not exists (select 1 from public.exercise_reviews r where r.exercise_id = m.id)
      and not exists (select 1 from public.shared_exercises s where s.id = m.id)
  )
  select distinct on (w.id) w.id, w.name, w.kind, w.category, w.user_id, w.user_name, w.email,
    (count(*) over (partition by w.id))::int
  from waiting w
  where public.is_admin()
  order by w.id, w.joined;
$$;

-- Approve (with the name and category the admin settled on) or reject an exercise.
create or replace function public.review_exercise(exercise_id text, approve boolean, new_name text default null, new_category text default null)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  ex jsonb;
  owner uuid;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select e, d.user_id into ex, owner
  from public.user_data d
  join auth.users u on u.id = d.user_id
  cross join lateral jsonb_array_elements(case when jsonb_typeof(d.data -> 'exercises') = 'array' then d.data -> 'exercises' else '[]'::jsonb end) e
  where e ->> 'id' = exercise_id
  order by u.created_at
  limit 1;
  if ex is null then
    raise exception 'no such exercise' using errcode = 'P0002';
  end if;
  if approve then
    insert into public.shared_exercises (id, name, kind, category, created_by, approved_by)
    values (
      exercise_id,
      left(trim(coalesce(nullif(trim(new_name), ''), ex ->> 'name')), 80),
      ex ->> 'kind',
      coalesce(nullif(new_category, ''), ex ->> 'category'),
      owner,
      auth.uid()
    )
    on conflict (id) do update set name = excluded.name, category = excluded.category, approved_by = excluded.approved_by, approved_at = now();
  end if;
  insert into public.exercise_reviews (exercise_id, status, reviewed_by)
  values (exercise_id, case when approve then 'approved' else 'rejected' end, auth.uid())
  on conflict on constraint exercise_reviews_pkey do update set status = excluded.status, reviewed_by = excluded.reviewed_by, reviewed_at = now();
  return case when approve then 'approved' else 'rejected' end;
end;
$$;

revoke all on function public.exercises_to_review() from public, anon;
revoke all on function public.review_exercise(text, boolean, text, text) from public, anon;
grant execute on function public.exercises_to_review() to authenticated;
grant execute on function public.review_exercise(text, boolean, text, text) to authenticated;
