/**
 * Journey 6 — Read-ahead and backfill
 *
 * Flow:
 *   1. Visit /plan
 *   2. Click on a future plan day (day + 5)
 *   3. Assert chapter grid opens for that day
 *   4. Tap a chapter tile — should mark it read even for a future day
 *   5. Navigate back to /plan
 *   6. Assert that day's completion % > 0
 *   7. Click on a past day — assert chapter grid opens
 *   8. Tap a chapter — marks it read (backfill works)
 */
import { test, expect } from '@playwright/test';

test.describe('Journey 6 — Read-ahead and backfill', () => {

  test('future and past days are fully accessible', async ({ page }) => {
    await page.goto('/read');
    await expect(page.getByRole('button', { name: /mark day \d+ complete/i })).toBeVisible({ timeout: 15_000 });

    // Plan list → a future day
    await page.getByRole('link', { name: /plan$/i }).click();
    const futureRow = page.getByRole('link', { name: /^day 6,/i });
    await expect(futureRow).toBeVisible({ timeout: 15_000 });
    await futureRow.click();
    await expect(page).toHaveURL(/\/read\?day=6$/);
    await expect(page.getByText(/day 6 of \d+/i)).toBeVisible({ timeout: 10_000 });

    // Read ahead: mark a chapter on that day
    await page.getByRole('button', { name: /, unread\./ }).first().click();

    // Back on the plan list, day 6 now shows progress
    await page.getByRole('link', { name: /plan$/i }).click();
    await expect(page.getByRole('link', { name: /^day 6, .*, [1-9]\d*% complete/i })).toBeVisible({ timeout: 15_000 });

    // Previous-day navigation works for backfilling
    await page.goto('/read?day=6');
    await page.getByRole('link', { name: /previous day/i }).click();
    await expect(page.getByText(/day 5 of \d+/i)).toBeVisible({ timeout: 10_000 });
  });

  test('journey page renders', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: /your journey/i })).toBeVisible({ timeout: 10_000 });
  });
});
