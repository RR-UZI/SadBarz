-- Plan changes from the coach chat: when the athlete and the coach agree on a change to the athlete's
-- plan, the coach's answer carries it as a proposal. The athlete sends it to Uzi with one tap; the
-- coach-plan function writes the new version of the plan, which waits in Uzi's review like any plan.
-- Run once in Supabase > SQL Editor (running it again is safe).

-- On assistant messages: { summary, change } as the coach proposed it, plus { planId, sentAt } once the
-- athlete sent it (written by coach-plan with the server key; the app only reads it).
alter table public.coach_messages add column if not exists proposal jsonb;
