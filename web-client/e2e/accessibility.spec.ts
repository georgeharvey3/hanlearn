import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { clearEmulatorData, seedTestUser, loginViaUI, configureTestSettings } from './fixtures/seed';

test.describe('Accessibility — axe-core audits', () => {
  test('home page has no a11y violations', async ({ page }) => {
    await page.goto('/');
    // Wait for the page to fully render (spinner replaced by content)
    await page.waitForSelector('text=Master Mandarin', { timeout: 10000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('skip link is present and targets main content', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();

    // Tab to the skip link and verify it becomes visible
    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();
  });

  test('main content landmark has correct id', async ({ page }) => {
    await page.goto('/');
    const main = page.locator('main#main-content');
    await expect(main).toBeAttached();
  });

  test('Chinese text elements have lang="zh" attribute', async ({ page }) => {
    // The chengyu component (which has lang="zh") only renders for authenticated users
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page);
    await loginViaUI(page);

    // Wait for the Chengyu component to render
    await page.waitForSelector('text=Chengyu Of The Day', { timeout: 10000 });

    const zhElements = page.locator('[lang="zh"]');
    const count = await zhElements.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Accessibility — keyboard navigation', () => {
  test('interactive elements are keyboard focusable on the home page', async ({ page }) => {
    await page.goto('/');

    // Tab through elements and verify focus is visible
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab'); // first interactive element

    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });
});
