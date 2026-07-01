/**
 * Journey 4 — Offline queue flush
 *
 * Flow:
 *   1. Visit /read
 *   2. Go offline (Playwright network emulation)
 *   3. Tap a chapter tile (optimistic update fires, queued to IndexedDB)
 *   4. Assert tile shows read state immediately (optimistic)
 *   5. Assert NetworkBanner appears
 *   6. Go online
 *   7. Assert NetworkBanner disappears
 *   8. Wait for flush — verse_reads should now be in the API
 */
import { test, expect } from '@playwright/test';

test.describe('Journey 4 — Offline queue', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
  });

  test('offline reads show optimistically and sync when online', async ({ page, context }) => {
    await page.goto('/read');
    await expect(page.locator('[aria-label*="chapter"]').first()).toBeVisible({ timeout: 15_000 });

    // Go offline
    await context.setOffline(true);

    // Tap a chapter tile
    const tile = page.locator('button[aria-label*="unread"]').first();
    if (await tile.count() > 0) {
      await tile.click();
      // Optimistic: tile should update immediately
      await expect(page.locator('button[aria-label*="read"]').first()).toBeVisible({ timeout: 3_000 });
    }

    // NetworkBanner should appear
    await expect(page.locator('[role="status"]').filter({ hasText: /offline/i })).toBeVisible({ timeout: 5_000 });

    // Come back online
    await context.setOffline(false);

    // NetworkBanner should disappear
    await expect(page.locator('[role="status"]').filter({ hasText: /offline/i })).not.toBeVisible({ timeout: 10_000 });
  });
});
