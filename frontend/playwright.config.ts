import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E baseline for the Timebooking frontend.
 *
 * Determinism notes:
 * - The webServer block starts `ng serve` (port 4200). `reuseExistingServer`
 *   is enabled outside CI so a locally running dev server is reused.
 * - All backend traffic is intercepted in tests via the shared fixture
 *   (see e2e/fixtures.ts). Tests never reach a real Express/Google backend.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
