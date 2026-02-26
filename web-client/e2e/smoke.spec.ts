import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  // Should show login or homepage — not a blank/error page
  await expect(page).not.toHaveTitle('');
  await expect(page.locator('body')).toBeVisible();
});
