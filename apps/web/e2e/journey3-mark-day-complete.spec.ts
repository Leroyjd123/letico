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

  test('mark day complete shows success state', async ({ page }) => {
    await page.goto('/read');
    const markBtn = page.getByRole('button', { name: /mark day \d+ complete/i });
    await expect(markBtn).toBeVisible({ timeout: 15_000 });
    await markBtn.click();

    await expect(page.getByText(/day \d+ complete/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('progressbar', { name: '100% complete' })).toBeVisible();
    // Every tile of the day is read, and none is left unread
    await expect(page.getByRole('button', { name: /, unread\./ })).toHaveCount(0);
  });
});
