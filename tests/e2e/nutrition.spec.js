import { test, expect } from '@playwright/test';

const RUN_JOURNEY = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

/**
 * Isolation: the marketing homepage must not pull in any nutrition asset or hit
 * Supabase. The nav link is currently hidden (feature still in dev) — this only
 * checks that /nutrition itself keeps working when visited directly, and that
 * nothing on the public homepage references it.
 */
test('homepage stays isolated from the nutrition feature', async ({ page }) => {
  const bad = [];
  page.on('request', (req) => {
    const url = req.url();
    if (/supabase\.co/.test(url) || /\/css\/nutrition\.css/.test(url) || /\/js\/(modules\/)?nutrition\//.test(url)) {
      bad.push(url);
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('nav .nav-menu a[href="/nutrition"]')).toHaveCount(0);
  expect(bad, `homepage loaded nutrition assets:\n${bad.join('\n')}`).toEqual([]);
});

test('nutrition hub shows the guest call-to-action when logged out', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/nutrition');
  await expect(page.getByRole('heading', { name: /your nutrition, built around how you train/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /create an account/i })).toBeVisible();
});

test.describe('responsive snapshots', () => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    test(`hub renders with no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/nutrition');
      await page.waitForLoadState('networkidle');
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientW = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollW).toBeLessThanOrEqual(clientW + 1);
      await page.screenshot({ path: `test-results/hub-${width}.png`, fullPage: true });
    });
  }
});

test.describe('full journey', () => {
  test.skip(!RUN_JOURNEY, 'set E2E_EMAIL and E2E_PASSWORD (a real Supabase user) to run');

  test('onboarding → plan → nutrient gap → resolve → save', async ({ page }) => {
    // --- sign in ---
    await page.goto('/auth.html');
    await page.getByPlaceholder(/email/i).first().fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder(/password/i).first().fill(process.env.E2E_PASSWORD);
    await page.getByRole('button', { name: /log ?in|sign ?in/i }).first().click();
    await page.waitForURL(/nutrition|dashboard/);

    // --- questionnaire ---
    await page.goto('/nutrition-onboarding.html');
    await page.getByRole('button', { name: 'Next' }).waitFor();

    // basics
    await page.getByLabel('Age').fill('31');
    await page.getByRole('button', { name: 'Male', exact: true }).click();
    await page.getByLabel('Height (cm)').fill('178');
    await page.getByLabel('Weight (kg)').fill('76');
    await page.getByRole('button', { name: 'Next' }).click();

    // goal
    await page.getByRole('button', { name: 'Build muscle' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // training
    await page.getByLabel('Training sessions per week').fill('4');
    await page.getByLabel('Typical session length (minutes)').fill('60');
    await page.getByRole('button', { name: 'Weights / strength' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // conditions (skip), diet, cuisines
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Indian' }).click();
    await page.getByRole('button', { name: 'Western / Continental' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // foods (leave untouched), practical, review
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: /save & build my plan/i }).click();

    // --- plan page ---
    await page.waitForURL(/nutrition-plan/);
    await expect(page.locator('.n-day')).toHaveCount(7);

    // remove every iron-ish source to force a critical gap
    // (delete all items in the first few days, then regenerate is not called)
    const removeButtons = page.locator('.n-item button[title="Remove"]');
    for (let i = 0; i < 12 && (await removeButtons.count()) > 0; i++) {
      await removeButtons.first().click();
    }
    const banner = page.locator('.n-gap.critical').first();
    await expect(banner).toBeVisible();
    await expect(page.getByRole('button', { name: /save as my active plan/i })).toBeDisabled();

    // resolve via a one-click remedy
    await page.locator('.n-gap .g-remedies .n-chip').first().click();

    // acknowledge anything left, then save
    const ackButtons = page.getByRole('button', { name: /let me save anyway/i });
    while (await ackButtons.count()) {
      await ackButtons.first().click();
    }
    const save = page.getByRole('button', { name: /save as my active plan/i });
    await expect(save).toBeEnabled();
    await save.click();

    await page.waitForURL(/\/nutrition$/);
    await expect(page.getByText(/active plan/i)).toBeVisible();
  });
});
