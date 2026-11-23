// Browser tests: the web app as built for previews (accounts kept in the browser, no Supabase), at phone size.
// Build first with `bash scripts/build-web-preview.sh`, then `npm run test:e2e`.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:8098',
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // A Chromium already on the machine, when it isn't the one this Playwright version installs.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'node tests/e2e/serve.mjs',
    url: 'http://localhost:8098',
    reuseExistingServer: !process.env.CI,
  },
});
