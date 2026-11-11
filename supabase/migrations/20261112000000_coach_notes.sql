-- The coach's notes on each athlete: what it has learned about them from their workouts and the chat
-- (how they train, how they progress, what hurts, what motivates them, what to follow up on).
-- The coach-chat Edge Function writes them with the server key; the coach reads them in every chat
-- answer and every plan it writes. The athlete can read their own notes in the app (and delete them);
-- admins (Uzi) can read everyone's.
-- Run once in Supabase > SQL Editor (running it again is safe).

create table if not exists public.coach_notes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notes text not null default '',
  learned_until bigint not null default 0, -- finishedAt (ms) of the newest workout the coach has learned from
  learning_at timestamptz,                 -- set while the coach is updating the notes, so two devices don't both do it
  usage jsonb,                             -- tokens used by the last update
  updated_at timestamptz not null default now()
);

alter table public.coach_notes enable row level security;

drop policy if exists "coach_notes read" on public.coach_notes;
create policy "coach_notes read" on public.coach_notes
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

-- An athlete can delete what the coach knows about them (it starts learning again from their next workout).
drop policy if exists "coach_notes delete own" on public.coach_notes;
create policy "coach_notes delete own" on public.coach_notes
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, delete on public.coach_notes to authenticated;
