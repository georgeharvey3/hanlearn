import { test, expect } from '@playwright/test';
import { clearEmulatorData, seedTestUser, loginViaUI } from './fixtures/seed';

test.describe('Sentence stages for all words setting', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
  });

  test('Settings page shows the "Sentence stages for all words" checkbox unchecked by default', async ({
    page,
  }) => {
    await loginViaUI(page);
    await page.goto('/settings');

    const checkbox = page.getByRole('checkbox', { name: /sentence stages for all words/i });
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test('toggling the checkbox persists the setting to localStorage', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/settings');

    const checkbox = page.getByRole('checkbox', { name: /sentence stages for all words/i });
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Verify localStorage was updated
    const storedValue = await page.evaluate(() =>
      localStorage.getItem('sentenceStagesForAllWords'),
    );
    expect(storedValue).toBe('true');
  });

  test('setting persists after page reload', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/settings');

    // Enable the setting
    const checkbox = page.getByRole('checkbox', { name: /sentence stages for all words/i });
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Reload the page
    await page.reload();

    // Verify the checkbox is still checked
    const checkboxAfterReload = page.getByRole('checkbox', {
      name: /sentence stages for all words/i,
    });
    await expect(checkboxAfterReload).toBeChecked();
  });

  test('checkbox is disabled when both sentence stages are turned off', async ({ page }) => {
    // Set both sentence stages to false via localStorage before navigating
    await page.addInitScript(() => {
      localStorage.setItem('sentenceRead', 'false');
      localStorage.setItem('sentenceWrite', 'false');
    });

    await loginViaUI(page);
    await page.goto('/settings');

    const checkbox = page.getByRole('checkbox', { name: /sentence stages for all words/i });
    await expect(checkbox).toBeDisabled();
  });

  test('estimated test time updates when the setting is toggled', async ({ page }) => {
    // Set 10 words so the estimate difference is noticeable
    await page.addInitScript(() => {
      localStorage.setItem('numWords', '10');
    });

    await loginViaUI(page);
    await page.goto('/settings');

    const estimateEl = page.getByText(/estimated test time:/i);
    const initialText = await estimateEl.textContent();

    // Toggle the setting on
    const checkbox = page.getByRole('checkbox', { name: /sentence stages for all words/i });
    await checkbox.click();

    // The estimated time should change
    await expect(estimateEl).not.toHaveText(initialText!);
  });
});
