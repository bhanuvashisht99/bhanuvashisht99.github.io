import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config for the nutrition feature.
 *
 * Needs a running dev server (Vercel dev, for cleanUrls -> /nutrition) and a
 * Supabase project with database/nutrition-v2.sql applied and the food seed
 * imported. The full sign-up journey runs only when E2E_EMAIL / E2E_PASSWORD are
 * set; otherwise just the public isolation checks run.
 */
const PORT = process.env.E2E_PORT || 3000;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
