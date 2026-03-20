import { test, expect } from '@playwright/test';
import { clearEmulatorData, seedTestUser, loginViaUI, configureTestSettings } from './fixtures/seed';

test.describe('Keyboard shortcuts dialog', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await configureTestSettings(page);
  });

  test('opens via ? hotkey and closes with Escape', async ({ page }) => {
    await page.goto('/');

    // Press ? to open the dialog
    await page.keyboard.press('Shift+/');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText('Keyboard Shortcuts')).toBeVisible();

    // Verify at least some shortcut groups are shown
    await expect(dialog.getByText('Global')).toBeVisible();
    await expect(dialog.getByText('Test')).toBeVisible();

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
    await expect(dialog.getByText('Keyboard Shortcuts')).toBeVisible();
  });

  test('? hotkey does not fire when typing in an input', async ({ page }) => {
    await seedTestUser();
    await loginViaUI(page);

    // Navigate to add-words which has an input field
    await page.goto('/add-words');
    await page.waitForLoadState('networkidle');

    // Focus the search input
    const input = page.locator('input').first();
    await input.click();
    await input.type('?');

    // Dialog should NOT be visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();
  });

  test('dialog shows shortcut keys and descriptions', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Shift+/');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify known shortcuts are displayed
    await expect(dialog.getByText('Show hint')).toBeVisible();
    await expect(dialog.getByText('Toggle pinyin visibility')).toBeVisible();
    await expect(dialog.getByText('Add Words')).toBeVisible();
    await expect(dialog.getByText('Daily Chengyu')).toBeVisible();
    await expect(dialog.getByText('Sentence Exercises')).toBeVisible();

    // Verify kbd elements exist
    const kbdElements = dialog.locator('kbd');
    await expect(kbdElements.first()).toBeVisible();
    expect(await kbdElements.count()).toBeGreaterThan(5);
  });

  test('dialog closes when close button is clicked', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Shift+/');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click the close button
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toBeVisible();
  });
});
