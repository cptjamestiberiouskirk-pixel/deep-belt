import {defineConfig, devices} from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests',
  // The game runs in real time (warps, mining cycles), so tests are slow by nature.
  timeout: 180_000,
  expect: {timeout: 15_000},
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: {width: 1280, height: 800},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome'], viewport: {width: 1280, height: 800}}}],
  // Tests run against the production build, the same files that get deployed.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
