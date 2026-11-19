-- Plan text in the other language (Spanish <-> English), so an athlete who reads the app in English sees a plan
-- the coach wrote in Spanish in English. Filled by the coach-plan function ({ translate }); each text once for everyone.
-- Only the function (server key) reads and writes it.
create table if not exists public.text_translations (
  language text not null check (language in ('en', 'es')),
  source text not null,
  text text not null,
  created_at timestamptz not null default now(),
  primary key (language, source)
);

alter table public.text_translations enable row level security;
revoke all on public.text_translations from anon, authenticated;
