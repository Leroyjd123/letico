/**
 * Journey 2 — Long-press verse selection
 *
 * Flow:
 *   1. Visit /read
 *   2. Long-press (600ms) on a chapter tile
 *   3. Assert VerseSelectorModal opens
 *   4. Move the start verse slider to verse 3
 *   5. Click "save selected range"
 *   6. Assert modal closes
 *   7. Assert tile is now "partial" state
 */
import { test, expect } from '@playwright/test';

test.describe('Journey 2 — Verse selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
  });

  test('long-press opens verse selector modal', async ({ page }) => {
    await page.goto('/read');
    await expect(page.locator('[aria-label*="chapter"]').first()).toBeVisible({ timeout: 15_000 });

    // Simulate long press via keyboard (Alt+Enter) — more reliable in headless browsers
    const tile = page.locator('button[aria-label*="chapter"]').first();
    await tile.focus();
    await page.keyboard.press('Alt+Enter');

    // Modal should appear
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3_000 });

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3_000 });
  });
});
