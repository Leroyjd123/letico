/**
 * Journey 3 — Mark day complete
 *
 * Flow:
 *   1. Visit /read
 *   2. Click "mark day complete" button
 *   3. Assert success state appears (progress bar at 100% or success message)
 */
import { test, expect } from '@playwright/test';

test.describe('Journey 3 — Mark day complete', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
  });

  test('mark day complete shows success state', async ({ page }) => {
    await page.goto('/read');
    // Wait for TodayCard to load
    await expect(page.locator('button').filter({ hasText: /mark day/i }).or(page.locator('button').filter({ hasText: /complete/i }))).toBeVisible({ timeout: 15_000 });

    const markBtn = page.locator('button').filter({ hasText: /mark/i }).first();
    await markBtn.click();

    // Success state — look for completion indicator
    await expect(page.locator('[aria-label*="complete"], [aria-label*="finished"], [data-state="complete"]').or(page.locator('text=/complete|finished/i'))).toBeVisible({ timeout: 8_000 });
  });
});
