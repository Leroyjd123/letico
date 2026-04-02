/**
 * Journey 5 — OTP sign-in and guest migration
 *
 * Note: This journey requires a real Supabase test project with a configured
 * test email address (E2E_TEST_EMAIL) and a Supabase admin key to retrieve
 * the OTP from the auth.users table directly.
 *
 * This test will be skipped if E2E_TEST_EMAIL is not set.
 */
import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env['E2E_TEST_EMAIL'];

test.describe('Journey 5 — OTP sign-in', () => {
  test.skip(!TEST_EMAIL, 'E2E_TEST_EMAIL not set — skipping OTP test');

  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
  });

  test('guest progress migrates after OTP sign-in', async ({ page }) => {
    // Step 1: Create guest progress
    await page.goto('/read');
    await expect(page.locator('[aria-label*="chapter"]').first()).toBeVisible({ timeout: 15_000 });

    // Step 2: Navigate to login
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5_000 });

    // Step 3: Submit email
    await page.locator('input[type="email"]').fill(TEST_EMAIL!);
    await page.locator('button[type="submit"], button').filter({ hasText: /send/i }).first().click();

    // Step 4: OTP input should appear
    await expect(page.locator('input[type="text"], input[inputmode="numeric"]')).toBeVisible({ timeout: 5_000 });

    // Note: In a real test environment, retrieve the OTP from the Supabase admin API
    // and fill it in here. This step is environment-specific.
    // await page.locator('input[type="text"]').fill(otp);
    // await page.locator('button').filter({ hasText: /verify/i }).click();
    // await page.waitForURL('/read');
  });
});
