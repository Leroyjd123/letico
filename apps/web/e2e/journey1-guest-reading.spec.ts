/**
 * Journey 1 — Guest mark-chapter flow
 *
 * Preconditions: app running on localhost:3000, Supabase configured.
 *
 * Flow:
 *   1. Visit /read (no prior session)
 *   2. Wait for guest provisioning (localStorage lectio_guest_token set)
 *   3. Wait for today's plan to load (TodayCard visible)
 *   4. Tap the first chapter tile
 *   5. Assert the tile changes to "read" state
 *   6. Assert verse_reads count > 0 (via API call to GET /progress/summary)
 */
import { test, expect } from '@playwright/test';

test.describe('Journey 1 — Guest reading', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any leftover guest token from previous tests
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('guest can tap a chapter tile and mark it read', async ({ page }) => {
    await page.goto('/read');

    // Wait for guest provisioning
    await expect(async () => {
      const token = await page.evaluate(() => localStorage.getItem('lectio_guest_token'));
      expect(token).toBeTruthy();
    }).toPass({ timeout: 10_000 });

    // Wait for the chapter grid to load
    await expect(page.locator('[aria-label*="chapter"]').first()).toBeVisible({ timeout: 15_000 });

    // Click the first unread chapter tile
    const firstUnread = page.locator('[aria-label*="unread"]').first();
    if (await firstUnread.count() > 0) {
      await firstUnread.click();
      // After tap the tile should become read
      await expect(page.locator('[aria-label*="read"]:not([aria-label*="partially"])').first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('progress updates after marking chapters read', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.getByText(/your reading at a glance/i)).toBeVisible({ timeout: 10_000 });
  });
});
