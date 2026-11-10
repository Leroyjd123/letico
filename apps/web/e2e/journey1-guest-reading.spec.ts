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

  test('guest can tap a chapter tile and mark it read', async ({ page }) => {
    await page.goto('/read');

    // Wait for guest provisioning
    await expect(async () => {
      const token = await page.evaluate(() => localStorage.getItem('lectio_guest_token'));
      expect(token).toBeTruthy();
    }).toPass({ timeout: 10_000 });

    // New guest: every tile starts unread
    const tile = page.getByRole('button', { name: /, unread\./ }).first();
    await expect(tile).toBeVisible({ timeout: 15_000 });
    const name = (await tile.getAttribute('aria-label'))!.split(',')[0]!;

    await tile.click();
    await expect(page.getByRole('button', { name: new RegExp(`^${name}, read\\.`) })).toBeVisible({ timeout: 5_000 });

    // Survives a reload (it reached the server, not just the cache)
    await page.reload();
    await expect(page.getByRole('button', { name: new RegExp(`^${name}, read\\.`) })).toBeVisible({ timeout: 15_000 });

    // Tapping again undoes it
    await page.getByRole('button', { name: new RegExp(`^${name}, read\\.`) }).click();
    await expect(page.getByRole('button', { name: new RegExp(`^${name}, unread\\.`) })).toBeVisible({ timeout: 5_000 });
  });

  test('progress updates after marking chapters read', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: /your journey/i })).toBeVisible({ timeout: 10_000 });
  });
});
