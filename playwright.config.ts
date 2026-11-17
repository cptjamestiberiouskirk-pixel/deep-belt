import {defineConfig, devices} from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests',
  // The game runs in real time (warps, mining cycles), so tests are slow by nature.
  timeout: 180_000,
  expect: {timeout: 15_000},
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Hosted runners have two cores; more workers starve the game loop.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: {width: 1280, height: 800},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Silent in every mode: headless Chromium is muted already, a --headed run is not.
    launchOptions: {args: ['--mute-audio']},
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome'], viewport: {width: 1280, height: 800}}}],
  // Tests run against the production build, the same files that get deployed.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Always build and serve fresh: a preview left on this port would otherwise be
    // tested in place of the current code. With one there, the run stops with
    // "already used" instead. PW_REUSE_SERVER=1 reuses it on purpose.
    reuseExistingServer: !process.env.CI && process.env.PW_REUSE_SERVER === '1',
    timeout: 120_000,
  },
});
