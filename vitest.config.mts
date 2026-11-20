// Unit tests (tests/unit) check the app's logic; function tests (tests/functions) run the Supabase functions
// with a fake database, fake Claude and fake Google. `npm test` runs both; the browser test is `npm run test:e2e`.
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const here = (p: string) => path.resolve(import.meta.dirname, p);

export default defineConfig({
  // The app's tsconfig extends expo/tsconfig.base, which Vite can't resolve: the tests have their own.
  tsconfig: 'tests/tsconfig.json',
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/functions/**/*.test.ts'],
    environment: 'node',
    // No server in unit tests: the app runs in preview mode (accounts on the device).
    env: { EXPO_PUBLIC_ACCOUNTS: 'preview' },
    restoreMocks: true,
  },
  resolve: {
    alias: [
      // React Native pieces the logic files import; the tests only need what they touch.
      { find: /^react-native$/, replacement: here('tests/stubs/react-native.ts') },
      { find: /^@react-native-async-storage\/async-storage$/, replacement: here('tests/stubs/async-storage.ts') },
      { find: /^react-native-url-polyfill\/auto$/, replacement: here('tests/stubs/empty.ts') },
      // The functions import packages the Deno way (npm:name@version): these point them at the fakes.
      { find: /^npm:@anthropic-ai\/sdk@.*$/, replacement: here('tests/fakes/anthropic.ts') },
      { find: /^npm:@supabase\/supabase-js@.*$/, replacement: here('tests/fakes/supabase.ts') },
    ],
  },
});
