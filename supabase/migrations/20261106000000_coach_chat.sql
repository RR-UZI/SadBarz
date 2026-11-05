-- Coach chat: the athlete's conversation with the AI coach (Coach tab).
-- Messages are written only by the coach-chat Edge Function (server key); the app reads them.
-- Run once in Supabase > SQL Editor.

create table if not exists public.coach_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  usage jsonb, -- tokens used for an answer (assistant rows)
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_user_time on public.coach_messages (user_id, created_at desc);

alter table public.coach_messages enable row level security;

-- An athlete sees their own chat; admins (Uzi) see every chat.
drop policy if exists "coach_messages read" on public.coach_messages;
create policy "coach_messages read" on public.coach_messages
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

-- An athlete can clear their own chat.
drop policy if exists "coach_messages delete own" on public.coach_messages;
create policy "coach_messages delete own" on public.coach_messages
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, delete on public.coach_messages to authenticated;
