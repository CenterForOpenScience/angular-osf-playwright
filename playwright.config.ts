import { defineConfig, devices } from '@playwright/test';

import * as settings from './config/settings';

/**
 * Environment (stage1/stage2/stage3/stage4/test/test2/test3/test4/prod) is selected via the
 * TEST_ENV env var and resolved in config/settings.ts. Browser is selected via the
 * `--project` CLI flag (chromium | firefox | edge | webkit), e.g.:
 *
 *   TEST_ENV=test4 npx playwright test --project=firefox
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 1,
  // 'github' prints failures as inline GitHub Actions annotations (file/line + error)
  // directly in the run log/checks UI. 'json' feeds scripts/write-failure-summary.js,
  // which turns that into a markdown table in the job's Summary page - both let you see
  // what failed and why without downloading the (often huge) html report/trace artifacts.
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github'], ['json', { outputFile: 'test-results/results.json' }]]
    : [['list'], ['html', { open: 'never' }]],
  // Must stay comfortably above the largest individual wait below (navigationTimeout,
  // LONG_TIMEOUT_MS) - otherwise a single slow-but-legitimate navigation/assertion can
  // exhaust the whole test budget before its own, more specific timeout gets a chance to
  // fire, so failures surface as an opaque global timeout (plus a cascading
  // "Target page, context or browser has been closed" from the mid-flight kill)
  // instead of a clear "element X never appeared" error.
  
  timeout: settings.VERY_LONG_TIMEOUT_MS,
  expect: {
    timeout: settings.TIMEOUT_MS,
  },
  use: {
    baseURL: settings.OSF_HOME,
    headless: settings.HEADLESS,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: settings.TIMEOUT_MS,
    navigationTimeout: settings.LONG_TIMEOUT_MS,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      // Playwright's WebKit engine - the closest thing to Safari available
      // cross-platform (real Safari automation only runs on macOS).
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
