# SadBarz

Calisthenics app and personal coach: build routines, run them with built-in timers (EMOM, EM2M, Tabata, sets with rest, circuits), log every set, and (with Pro, coming later) let the coach make the next session harder as you get stronger.

One codebase for web, iPhone and Android (Expo / React Native). Spanish first, switchable to English in Settings. Dark theme.

## What works now (web prototype, Free features)

- **Routines**: create, edit, duplicate, delete. A routine is a list of blocks.
- **Block formats**: EMOM / every N seconds (E30", E50", EM2M...), Tabata (work / rest), sets with rest (pyramids, weighted work, pairs), circuit (stopwatch + rounds). Each exercise can have reps, seconds, meters, calories, added weight (+kg), "max" and a note (DS, unbroken...).
- **Workout mode**: the timer runs inside the routine. 3-2-1 countdown, start sound, sound every round, last-seconds beeps, end sound. After each block: Done (reps and weight pre-filled, editable), Repeat, Skip, or Finish workout. Then a 1, 2, 3 or 5 min break (the routine's own rest highlighted), and the next block waits for Start.
- **Timers tab**: EMOM, Tabata / intervals, countdown and stopwatch without a routine.
- **History**: last 2 weeks (Free plan).
- **Settings**: language, every timer sound and beep, voice cues, vibration, break behavior, keep screen on, volume.
- **Example routines** from Uzi's own training.

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
| `src/screens/` | Home, Routines, Editor, Workout, Timers, History, Settings |
| `src/i18n/` | Spanish and English text |

## Notes

- On phones, sounds currently use vibration only; real beeps through `expo-audio` come in the phone phase.
- Navigation is a small built-in stack instead of Expo Router, so the web build works from any URL.
