# SadBarz

Calisthenics app and personal coach: build routines, run them with built-in timers (EMOM, EM2M, Tabata, sets with rest, circuits, AMRAP, For time), log every set, and (with Pro, coming later) let the coach make the next session harder as you get stronger.

One codebase for web, iPhone and Android (Expo / React Native). Spanish first, switchable to English in Settings. Dark theme.

## What works now (web prototype, Free features)

- **Routines**: create, edit, duplicate, delete. A routine is a list of blocks. In the editor, tap an exercise's name to swap it for another (reps, weight and note stay when the new one is measured the same way), and press and hold an exercise card or a row of sets to drag it up or down. Exercises you created have a ✎ in the exercise picker to fix their name or group; the new name shows everywhere and syncs (the newest rename wins).
- **Block formats**: EMOM / every N seconds (E30", E50", EM2M...), Tabata (work / rest), sets with rest (pyramids, weighted work, pairs), circuit (stopwatch + rounds; after each round it asks to start the next one, then counts down 3 seconds), AMRAP (time cap countdown, "+1 ronda" counter, extra reps at the end; the score "5 rondas + 8 reps" is saved to the history), For time (stopwatch counts up to a time cap, optional rounds with "Terminé la ronda N", then "¡Terminé!" saves the time; if the cap hits first it asks for the reps done and saves "tope · 2 rondas + 15 reps"). Each exercise can have reps, seconds, meters, calories, added weight (+kg), "max" and a note (DS, unbroken...). In an alternating EMOM or Tabata ("uno por ronda"), "↑ Misma ronda" on an exercise puts it in the same round as the one above it, e.g. round 1 = muscle ups + dips + pull ups, round 2 = burpees.
- **Resistance bands**: any exercise counted in reps or seconds can be done with a band (+ banda in the block editor): yellow, red, black, purple, green or blue, each with roughly how much weight it takes off (`src/lib/bands.ts`; brands differ). The band shows in the routine, while training and in the history.
- **Block feedback**: on the rest screen after a block (and on the summary for the last one) the athlete can, if they want, say how it felt (Fácil, Bien, Difícil, Al límite), mark that they had to pause the clock, and write a note. It's saved with the workout, shows in the history, and the AI coach reads it when it writes the next plan.
- **Coach chat** (Pro): the Coach tab is a chat with the AI coach, who knows the athlete's profile, last 2 weeks of workouts (with their block feedback), records and current plan. It only talks about training, exercise and the mental side of sport; anything else gets a one-line no. 30 messages a day per athlete. Free accounts see what it is and the Pro button.
- **Search and link previews**: `public/index.html` is the web page template (title, description, Open Graph image `public/og.png`, canonical sadbarz.com). `public/robots.txt` and `public/sitemap.xml` are served from the site root for Google.
- **Workout mode**: the timer runs inside the routine. 10-second get-ready countdown (beeps on 3-2-1), start sound, sound every round, last-seconds beeps, end sound. After each block: Done (reps and weight pre-filled, editable), Repeat, Skip, or Finish workout. Then a 1, 2, 3 or 5 min break (the routine's own rest highlighted), and the next block waits for Start. Progress is saved as you go: leave with back (or close the tab) and Home and the routine page show "Entreno en curso" with Continuar or Descartar. Continuar opens where you were, with the timer paused at the same second. A saved workout is kept for 12 hours. Any block can be edited mid-workout with ✎ Editar (while it runs, before it starts, or during the break): the timer pauses while you edit, and Guardar y seguir carries on from the same round and second. The change is for that workout, unless "Guardar también en la rutina" is on.
- **Timers tab**: EMOM, Tabata / intervals, countdown and stopwatch without a routine.
- **History**: last 2 weeks (Free plan). A saved workout shows every block with what was logged, and "Ver resumen" pops up its summary (time, blocks done, total reps, each block's status).
- **Settings**: language, every timer sound and beep, voice cues, vibration, break behavior, keep screen on, volume. On the web, keep screen on uses the browser's wake lock, which phones drop whenever the page is hidden (locking, unlocking with Face ID, a notification). The app asks for it again when the page comes back, and on the next tap if the browser refused it.
- **Example routines** in Uzi's style of training: three each week, one per level (Principiante, Intermedio, Avanzado, shown as a badge), from a four-week cycle that moves on every Monday (`src/data/seed.ts`). Untouched examples are swapped for the new week's; ones the athlete edited stay theirs, and ones they deleted don't come back. Home lists the athlete's own level first; with a plan, the plan replaces the examples.
- **Accounts**: welcome, sign up, log in, continue with Google (web), forgot password, log out (Settings).
- **Athlete profile** (every plan): tap the photo on Home, or the account card in Settings. Profile photo (cut to a square and shrunk to 256 px, saved with the user's data so every device shows it; tapping it shows it big, only "Cambiar foto" changes it), stats (workouts, hours, reps, weeks in a row), personal records added by hand (max reps, hold seconds, added weight, or finish time of a test), and best marks read from the workout log (most reps in a set, longest hold, heaviest added weight, best AMRAP score, best For time). Tapping a logged mark saves it as a PR.
- **Onboarding**: after the first sign in, the questions for the coach, one per screen, then a review. Free accounts answer the short version (goal: compete, endurance, strength, skills, statics or get fit; max reps test or level; equipment; training days, up to 6 so there is always a rest day). Pro answers the full version: the same plus a goal page (statics: hardest stage and seconds held; endurance: more max reps; strength: added weight and reps; skills: skills they have, the next one and where they are with it; compete: which competition, date, category, format, last result, weakest move; get fit: what they want, time off, a quick test, other sports, daily activity, goal weight), session length, start date, age and weight, injuries and reminders. A Pro athlete whose profile came from the short version gets a "Completar preguntas" card on Home that asks only what is missing. Answers can be changed in Settings.
- **AI coach (Pro)**: ask for a plan of 1 week, 2 weeks or 1 month; the coach writes it, Uzi reviews it, and the athlete follows it in Mi plan (see AI coach below).

Data is saved on the device (browser storage on web). Accounts, cloud backup, the coach and payments come in later phases.

## Roles

SadBarz has four roles. Each one is a flag in the account's **app_metadata**, which only the server can set, so nobody can give themselves a role.

| Role | Flag | What it gets | Status |
| :--- | :--- | :--- | :--- |
| **Athlete Free** | none (the default) | Up to 5 of their own routines, every timer and workout feature, and limited plan codes. | Works |
| **Athlete Pro** | `"plan": "pro"` | No routine limit, unlimited plan codes, and the AI coach. | Works. Admins switch it in Home → Usuarios until Stripe (step 8) |
| **Coach** | `"coach": true`, and always `"plan": "pro"` | Builds routines and weekly plans, gets a code for each, shares it, and sees how many people redeemed it (see [Later: professional coaches](#later-professional-coaches)). A coach account that isn't Pro gets no coach tools. Uzi approves who becomes a coach. | Planned |
| **Admin** | `"admin": true` | Uzi. Reviews and approves AI coach plans, sees every code and redemption, has the Free/Pro view switch, and approves coaches. | Works |

## Run it

```bash
npm install
npx expo start --web     # opens in the browser
npx expo start           # scan the QR code with Expo Go on your phone
```

Checks:

```bash
npx tsc --noEmit
```

Shareable web preview (relative paths, can be hosted from any folder):

```bash
./scripts/build-web-preview.sh   # output in dist-preview/
```

## Accounts (Supabase)

Sign up and log in use [Supabase Auth](https://supabase.com/docs/guides/auth), project `tdfslnfurzqryyecxfik`. Its address and publishable key are in `src/lib/supabase.ts`; both are public by design. `.env.example` shows how to point at another project or switch to **preview mode** (account kept on the device, no emails), which the shareable preview build uses.

**Google sign in** (web) needs the Google provider turned on in Supabase (**Authentication → Sign In / Providers → Google**) with a Client ID and Secret from a Google Cloud OAuth client whose redirect URI is `https://tdfslnfurzqryyecxfik.supabase.co/auth/v1/callback`. On phones it comes with the phone phase.

The onboarding answers are saved in the account's user metadata under `profile` (see `Profile` in `src/types.ts`), so they follow the user to any device and a server function can read them when it builds the plan. No table is needed for this.

**Routines, workouts, own exercises, settings, profile photo and PRs** are saved per user in the table `public.user_data` (one row per user, a JSON copy of their data). Row level security lets each signed-in user read and write only their own row. Create it once by pasting `supabase/migrations/20261024000000_user_data.sql` into **SQL Editor → New query → Run**. Each device keeps its own copy too (`sadbarz:v1:<user id>`), works offline, and merges with the cloud copy on sign in, when the app comes back to the front, and a moment after every change (`src/lib/sync.ts`). Settings → Datos shows whether the last sync worked.

**Free vs Pro.** Free accounts keep up to 5 of their own routines (`FREE_ROUTINE_LIMIT` in `src/lib/plan.ts`; the example routines don't count). Creating or duplicating a 6th opens the Pro pop-up instead (`src/components/ProHost.tsx`), whose "Quiero Pro" button stores `pro_interest_at` in the user's metadata until payments exist. An account is Pro when its **app_metadata** has `"plan": "pro"`. Only the server can set that, so users can't upgrade themselves. **Admins give or take away Pro in the app: Home → Usuarios** lists every account (search by email or name) with a Pro switch. It needs `supabase/migrations/20261103010000_admin_users.sql` run once in the SQL Editor (two admin-only functions, `admin_list_users` and `admin_set_plan`). The person sees the change the next time they open the app (the app refreshes the session when it comes back to the front, at most every 5 minutes). By hand instead, in the SQL Editor:

```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"plan":"pro"}'::jsonb where email = 'their@email.com';
```

**Shared exercise pool.** Anyone can make their own exercise in the exercise picker and use it right away (it's saved with their data, as before). Every exercise someone makes also waits for an admin in **Home → Ejercicios nuevos**: approving it (after fixing its name or group if needed) adds it to the table `shared_exercises`, which every account reads and shows in its exercise list; rejecting it leaves it only with the person who made it. The waiting list is read straight from everyone's synced data, so nothing extra is sent from the app; a warning shows when the name matches one already in the list. **Aprobar todos** approves the whole list in one go (with any name or group fixes made on the cards), after a confirmation that also says how many look like repeats. Needs `supabase/migrations/20261105000000_exercise_pool.sql` run once (`src/lib/exercisePool.ts`, `src/screens/ExerciseReviewScreen.tsx`).

**Admin Free/Pro switch.** An account whose app_metadata has `"admin": true` sees a FREE/PRO pill on Home (and a "Ver la app como" switch in Settings) that flips what the app shows, to try both plans. It only changes the view on that device (`sadbarz:plan-view`), never the real plan, and no other account sees it. In the preview build every account has it. To make the owner's account admin:

```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"admin":true}'::jsonb where email = 'owner@email.com';
```

In Supabase, **Authentication → URL Configuration** must list the site address (the Vercel URL, and `http://localhost:8081` for local work) so confirmation and password reset links come back to the app.

## AI coach (Pro)

A Pro athlete with a complete profile picks a plan length on Home (1 week, 2 weeks or 1 month) and taps **Pedir mi plan**. The Supabase Edge Function `coach-plan` (`supabase/functions/coach-plan/index.ts`) checks the account is Pro (or admin), reads the profile, the last 4 weeks of workouts, the records and the last approved plan, and asks Claude (`claude-opus-5-5`, structured JSON output) for one week of routines in the app's routine format, following Uzi's method (the `METHOD` text at the top of that file; edit it to change how the coach writes). The plan is saved in the table `coach_plans` with status `review`; until Uzi approves it the athlete sees "Tu coach está revisando tu plan". One plan at a time, at most 3 requests a day per athlete. In the preview build the request is only kept on the device.

**Uzi's review.** Admin accounts get a "Planes por revisar" card on Home (real accounts only, not the preview build). The list shows plans waiting for review, oldest first, then the latest reviewed. A plan shows the athlete's answers, max reps, injuries and how much they trained, the coach's summary and progression, and each day's routine. Uzi can:
- **Aprobar**: the athlete can see it. If he edited any day first (Editar opens the normal routine editor), his version is saved apart in `approved_plan`, so the original stays to compare.
- **Fixing an approved plan**: Editar stays on every day of an approved plan. Edits wait on the page until **Guardar cambios** (or **Descartar**); saving replaces `approved_plan`, and the athlete sees it next time the app loads the plan. Routines redeemed by code follow it too (see Plan codes).
- **Devolver con nota**: the function rewrites the same plan following the note, keeping the old version and the note in the plan's history. The coach also reads Uzi's latest notes on every new plan, so it keeps applying what he corrects.

**Mi plan.** Once approved, the athlete gets a "Mi plan" card at the top of Home: today's routine with a Start button (or "Hoy toca descanso" and the next day), the week of the plan and the days left. "Ver mi plan" opens the whole week: tap a day to see and start its routine, a ✓ marks days done this week, and the coach's progression note is at the bottom. It shows Uzi's edited version when there is one, and it's kept on the device so it opens with no signal.

**Plan codes.** Every plan gets a code like `SB-7K4QXM`. For now only Uzi's account sees it: on an approved plan in his review, with a Copy button, so he decides who gets it (the server keeps the `code` column out of what athletes can read; admins get it through `plan_code()`). Anyone who redeems it in Rutinas ("¿Tienes un código de plan? Canjéalo") gets that plan's routines, as Uzi approved them, plus any of the original athlete's own exercises they use. Free accounts redeem 1 code per calendar month (Mexico City time), Pro and admins as many as they like; the server function `redeem_plan_code` checks it, so the app can't skip it. Redeeming the same code again doesn't count. Routines from codes don't show the code (the redeem box's example is a generic `SB-XXXXXX`) and, like the examples, don't count toward the free limit (a duplicate of one does). They follow the plan: when Uzi fixes it, Home and Rutinas ask `redeemed_plans()` (at most once a minute) for the current version of the plans behind the codes this account redeemed, and replace the copies in place (same routine ids, so past workouts stay linked). Each copy remembers its plan day and the version it has, so it only changes when the plan does; an athlete's own edits to a copy are replaced then.

Setup, once:

1. Run `supabase/migrations/20261027000000_coach_plans.sql` in the SQL Editor.
   Then `supabase/migrations/20261028000000_plan_codes.sql` (plan codes).
   Then `supabase/migrations/20261029000000_plan_coach_exercises.sql` (adds the coach's own exercises to plans approved before the app did it).
   Then `supabase/migrations/20261030000000_code_routine_updates.sql` (routines from codes follow the plan).
   Then `supabase/migrations/20261103000000_plan_athletes.sql` (the review list shows who asked: their name and email).
   Then `supabase/migrations/20261105000000_exercise_pool.sql` (the shared exercise pool, see below).
   Then `supabase/migrations/20261106000000_coach_chat.sql` (the Coach tab's chat, see below).
2. **Edge Functions → Secrets**: `ANTHROPIC_API_KEY` (never in the app or the repo).
3. **Edge Functions → Deploy a new function → Via Editor**, name it `coach-plan`, paste `supabase/functions/coach-plan/index.ts`, deploy. The function checks the athlete's session itself, so if every call fails with "Invalid JWT" (projects on the new signing keys), turn "Verify JWT" off for it. With the Supabase CLI instead: `supabase functions deploy coach-plan`.

**Coach chat.** The Edge Function `coach-chat` (`supabase/functions/coach-chat/index.ts`) answers the Coach tab with Claude (`claude-sonnet-5-5` at low effort, short answers; the `COACH` text at the top of the file is how the coach talks and what it won't talk about). Both messages are saved in the table `coach_messages` (`supabase/migrations/20261106000000_coach_chat.sql`): an athlete reads and can clear their own chat, admins can read every chat. Set it up like `coach-plan`: run the migration, then Edge Functions → Deploy a new function → Via Editor, name it `coach-chat`, paste the file, deploy (turn "Verify JWT" off if calls fail with "Invalid JWT"). It uses the same `ANTHROPIC_API_KEY` secret.

Check it locally with `deno check supabase/functions/coach-plan/index.ts` (the app's `tsc` skips that folder).

## Deploy the web app (Vercel)

`vercel.json` already has the settings. In Vercel: **Add New → Project → Import** `RR-UZI/SadBarz`, keep the defaults, **Deploy**. Every push to `main` then publishes a new version, and every pull request gets its own preview link.

## Code map

| Path | What it is |
| --- | --- |
| `App.tsx` | Providers, tab bar, screen switching |
| `src/lib/plan.ts`, `src/components/ProHost.tsx` | Free plan limits and the Pro pop-up |
| `src/lib/sync.ts` | Per-user cloud copy: pull, merge, push |
| `src/lib/records.ts`, `src/lib/avatar.ts`, `src/screens/ProfileScreen.tsx` | Athlete profile: stats, logged bests, PRs, profile photo |
| `supabase/migrations/` | SQL for the Supabase tables |
| `supabase/functions/coach-plan/` | The AI coach: writes a plan with Claude and saves it for Uzi's review |
| `supabase/functions/coach-chat/` | The Coach tab's chat: answers the athlete with Claude, training topics only |
| `src/lib/coach.ts`, `src/components/CoachCard.tsx` | Asking for a plan and its status on Home |
| `src/screens/CoachReviewScreen.tsx` | Uzi's review: plans waiting, approve, edit, send back with a note |
| `src/screens/MyPlanScreen.tsx` | Mi plan: the athlete's approved plan, today's routine, the week |
| `src/components/PlanCode.tsx` | A plan's code to share, and redeeming a code in Rutinas |
| `src/types.ts` | Data shapes: exercises, blocks, routines, workouts, settings |
| `src/store/AppStore.tsx` | App state per user: device copy plus cloud sync |
| `src/data/seed.ts` | Exercise library and example routines |
| `src/lib/blocks.ts` | Block helpers and the timer timeline |
| `src/lib/sound.ts` | Beeps, voice cues, vibration |
| `src/components/BlockRunner.tsx` | The timer for each block format |
| `src/components/BlockEditor.tsx` | Editing a block |
| `src/screens/` | Home, Routines, Editor, Workout, Timers, History, Profile, Settings, Auth, Onboarding |
| `src/lib/profile.ts` | Onboarding helpers: starting level from the max reps test, next training day |
| `src/i18n/` | Spanish and English text |

## Later: professional coaches

Ideas Uzi wants to build on top of plan codes. Nothing here exists yet.

**Coaches who share their own routines.** Besides Uzi, verified professional coaches get a coach account (`app_metadata.coach = true`, set only by the server, like `admin`). A coach:
- builds routines or full weekly plans in the app with the normal editor (no AI needed, or the AI coach as a starting point they edit),
- gets a code for each one and shares it with their followers (Instagram, WhatsApp, a QR at the gym),
- sees how many people redeemed each code.

Followers redeem a coach's code exactly like Uzi's today (same Free and Pro limits), and the routines show the coach's name. What it needs: a `coach_routines` table (owner, title, routines, code, published or not), `redeem_plan_code` reading from it as well as from `coach_plans`, a coach profile (name, photo, social link), and a simple "Mis códigos" screen for coaches. Uzi approves who becomes a coach.

**Subscribing to one coach.** An athlete pays a monthly subscription to a specific coach and gets everything that coach publishes, and new plans as they come, with no code needed. What it needs:
- payments through Stripe (the app's own Pro subscription is step 8). Paying a coach their share needs Stripe Connect: each coach connects a Stripe account, SadBarz keeps a percentage and Stripe pays the coach.
- a `coach_subscriptions` table (athlete, coach, status, renews on) kept up to date by Stripe webhooks in an Edge Function, never by the app.
- a coach page in the app (bio, what they publish, price, "Suscribirme"), and in Rutinas a section per coach the athlete follows.
- open questions for Uzi: does a coach subscription include SadBarz Pro, or is it separate? Who sets the price (the coach, within a range)? What happens to the routines when a subscription ends (keep the ones already added, or remove them)?

## Notes

- On phones, sounds currently use vibration only; real beeps through `expo-audio` come in the phone phase.
- Navigation is a small built-in stack instead of Expo Router, so the web build works from any URL.
