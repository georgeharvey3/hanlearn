import { test, expect } from '@playwright/test';
import { clearEmulatorData, seedTestUser, loginViaUI, configureTestSettings } from './fixtures/seed';

/**
 * Helper: open the keyboard shortcuts dialog via the ? hotkey.
 * Waits for React to mount (so the keydown listener is attached)
 * then dispatches a synthetic KeyboardEvent to avoid keyboard-layout
 * inconsistencies in headless Chromium on CI.
 */
async function pressQuestionMark(page: import('@playwright/test').Page) {
  await expect(page.locator('#main-content')).toBeVisible();
  await page.evaluate(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '?', code: 'Slash', shiftKey: true, bubbles: true }),
    );
  });
}

test.describe('Keyboard shortcuts dialog', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await configureTestSettings(page);
  });

  test('opens via ? hotkey and closes with Escape', async ({ page }) => {
    await page.goto('/');

    // Press ? to open the dialog
    await pressQuestionMark(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByRole('heading', { name: /Keyboard Shortcuts/ })).toBeVisible();

    // Verify at least some shortcut groups are shown
    await expect(dialog.getByText('Global', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Test', { exact: true })).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('opens via Sidebar shortcuts button (authenticated, desktop)', async ({ page }) => {
    await seedTestUser();
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaUI(page);

    // Click the "Shortcuts" item in the sidebar
    const sidebar = page.locator('.MuiDrawer-paperAnchorLeft');
    await sidebar.getByText('Shortcuts', { exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByRole('heading', { name: /Keyboard Shortcuts/ })).toBeVisible();
  });

  test('? hotkey does not fire when typing in an input', async ({ page }) => {
    await seedTestUser();
    await loginViaUI(page);

    // Navigate to add-words which has an input field
    await page.goto('/add-words');
    await expect(page.locator('#main-content')).toBeVisible();

    // Focus the search input
    const input = page.getByLabel('Search for a Chinese word');
    await input.click();
    await input.type('?');

    // Dialog should NOT be visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();
  });

  test('dialog shows shortcut keys and descriptions', async ({ page }) => {
    await page.goto('/');

    await pressQuestionMark(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify known shortcuts are displayed
    await expect(dialog.getByText('Show hint')).toBeVisible();
    await expect(dialog.getByText('Toggle pinyin visibility')).toBeVisible();
    await expect(dialog.getByText('Add Words')).toBeVisible();
    await expect(dialog.getByText('Sentence Exercises')).toBeVisible();

    // Verify kbd elements exist
    const kbdElements = dialog.locator('kbd');
    await expect(kbdElements.first()).toBeVisible();
    expect(await kbdElements.count()).toBeGreaterThan(5);
  });

  test('dialog closes when close button is clicked', async ({ page }) => {
    await page.goto('/');

    await pressQuestionMark(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click the close button
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toBeVisible();
  });
});
