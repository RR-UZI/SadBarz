# SadBarz

Calisthenics app and personal coach: build routines, run them with built-in timers (EMOM, EM2M, Tabata, sets with rest, circuits), log every set, and (with Pro, coming later) let the coach make the next session harder as you get stronger.

One codebase for web, iPhone and Android (Expo / React Native). Spanish first, switchable to English in Settings. Dark theme.

## What works now (web prototype, Free features)

- **Routines**: create, edit, duplicate, delete. A routine is a list of blocks.
- **Block formats**: EMOM / every N seconds (E30", E50", EM2M...), Tabata (work / rest), sets with rest (pyramids, weighted work, pairs), circuit (stopwatch + rounds). Each exercise can have reps, seconds, meters, calories, added weight (+kg), "max" and a note (DS, unbroken...).
- **Workout mode**: the timer runs inside the routine. 10-second get-ready countdown (beeps on 3-2-1), start sound, sound every round, last-seconds beeps, end sound. After each block: Done (reps and weight pre-filled, editable), Repeat, Skip, or Finish workout. Then a 1, 2, 3 or 5 min break (the routine's own rest highlighted), and the next block waits for Start.
- **Timers tab**: EMOM, Tabata / intervals, countdown and stopwatch without a routine.
- **History**: last 2 weeks (Free plan).
- **Settings**: language, every timer sound and beep, voice cues, vibration, break behavior, keep screen on, volume.
- **Example routines** from Uzi's own training, one per weekday: Monday weighted push and pull, Tuesday tubes, reps and cardio, Wednesday legs and abs, Thursday reps to failure, Friday full body.
- **Accounts**: welcome, sign up, log in, continue with Google (web), forgot password, log out (Settings).
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

In Supabase, **Authentication → URL Configuration** must list the site address (the Vercel URL, and `http://localhost:8081` for local work) so confirmation and password reset links come back to the app.

## Deploy the web app (Vercel)

`vercel.json` already has the settings. In Vercel: **Add New → Project → Import** `RR-UZI/SadBarz`, keep the defaults, **Deploy**. Every push to `main` then publishes a new version, and every pull request gets its own preview link.

## Code map

| Path | What it is |
| --- | --- |
| `App.tsx` | Providers, tab bar, screen switching |
| `src/types.ts` | Data shapes: exercises, blocks, routines, workouts, settings |
| `src/store/AppStore.tsx` | App state saved to device storage |
| `src/data/seed.ts` | Exercise library and example routines |
| `src/lib/blocks.ts` | Block helpers and the timer timeline |
| `src/lib/sound.ts` | Beeps, voice cues, vibration |
| `src/components/BlockRunner.tsx` | The timer for each block format |
| `src/components/BlockEditor.tsx` | Editing a block |
| `src/screens/` | Home, Routines, Editor, Workout, Timers, History, Settings, Auth, Onboarding |
| `src/lib/profile.ts` | Onboarding helpers: starting level from the max reps test, next training day |
| `src/i18n/` | Spanish and English text |

## Notes

- On phones, sounds currently use vibration only; real beeps through `expo-audio` come in the phone phase.
- Navigation is a small built-in stack instead of Expo Router, so the web build works from any URL.
