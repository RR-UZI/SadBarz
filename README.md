# SadBarz

Calisthenics app and personal coach: build routines, run them with built-in timers (EMOM, EM2M, Tabata, sets with rest, circuits, AMRAP), log every set, and (with Pro, coming later) let the coach make the next session harder as you get stronger.

One codebase for web, iPhone and Android (Expo / React Native). Spanish first, switchable to English in Settings. Dark theme.

## What works now (web prototype, Free features)

- **Routines**: create, edit, duplicate, delete. A routine is a list of blocks.
- **Block formats**: EMOM / every N seconds (E30", E50", EM2M...), Tabata (work / rest), sets with rest (pyramids, weighted work, pairs), circuit (stopwatch + rounds; after each round it asks to start the next one, then counts down 3 seconds), AMRAP (time cap countdown, "+1 ronda" counter, extra reps at the end; the score "5 rondas + 8 reps" is saved to the history). Each exercise can have reps, seconds, meters, calories, added weight (+kg), "max" and a note (DS, unbroken...).
- **Workout mode**: the timer runs inside the routine. 10-second get-ready countdown (beeps on 3-2-1), start sound, sound every round, last-seconds beeps, end sound. After each block: Done (reps and weight pre-filled, editable), Repeat, Skip, or Finish workout. Then a 1, 2, 3 or 5 min break (the routine's own rest highlighted), and the next block waits for Start.
- **Timers tab**: EMOM, Tabata / intervals, countdown and stopwatch without a routine.
- **History**: last 2 weeks (Free plan).
- **Settings**: language, every timer sound and beep, voice cues, vibration, break behavior, keep screen on, volume.
- **Example routines** from Uzi's own training, one per weekday: Monday weighted push and pull, Tuesday tubes, reps and cardio, Wednesday legs and abs, Thursday pull, push and tubes, Friday full body.
- **Accounts**: welcome, sign up, log in, continue with Google (web), forgot password, log out (Settings).
- **Athlete profile** (every plan): tap the photo on Home, or the account card in Settings. Profile photo (cut to a square and shrunk to 256 px, saved with the user's data so every device shows it), stats (workouts, hours, reps, weeks in a row), personal records added by hand (max reps, hold seconds, added weight, or finish time of a test), and best marks read from the workout log (most reps in a set, longest hold, heaviest added weight, best AMRAP score). Tapping a logged mark saves it as a PR.
- **Terms and privacy**: after the first sign in (and whenever `TERMS_VERSION` in `src/legal/texts.ts` goes up) the athlete accepts the terms of use, the privacy notice and the use of their health data before anything else (athletes 13 to 17: a parent or guardian accepts, with their name and email; onboarding then only takes ages 13 to 17, adults 18 and up); the acceptance (version, date) is saved in the account's metadata as `terms`. The texts exist for Mexico (Spanish) and the USA (English) and open from that screen and from Settings → Legal. Drafts until a lawyer reviews them; fill `LEGAL` (legal name, address, contact email, courts) before publishing.
- **Onboarding**: after the first sign in, nine questions for the coach (goal, max reps test or level, equipment, training days, session length, start date, age and weight, injuries, reminders), then a review. Answers can be changed in Settings.

Data is saved on the device (browser storage on web). Accounts, cloud backup, the coach and payments come in later phases.

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

**Free vs Pro.** Free accounts keep up to 5 of their own routines (`FREE_ROUTINE_LIMIT` in `src/lib/plan.ts`; the example routines don't count). Creating or duplicating a 6th opens the Pro pop-up instead (`src/components/ProHost.tsx`), whose "Quiero Pro" button stores `pro_interest_at` in the user's metadata until payments exist. An account is Pro when its **app_metadata** has `"plan": "pro"`. Only the server can set that, so users can't upgrade themselves. To make an account Pro by hand, run this in the SQL Editor (the user signs out and in again to see it):

```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"plan":"pro"}'::jsonb where email = 'their@email.com';
```

In Supabase, **Authentication → URL Configuration** must list the site address (the Vercel URL, and `http://localhost:8081` for local work) so confirmation and password reset links come back to the app.

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

## Notes

- On phones, sounds currently use vibration only; real beeps through `expo-audio` come in the phone phase.
- Navigation is a small built-in stack instead of Expo Router, so the web build works from any URL.
