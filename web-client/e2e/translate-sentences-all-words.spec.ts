import { test, expect } from '@playwright/test';
import { clearEmulatorData, seedTestUser, loginViaUI } from './fixtures/seed';

test.describe('Translate sentences for all words setting', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
  });

  test('Settings page shows the "Translate sentences for all words" checkbox unchecked by default', async ({
    page,
  }) => {
    await loginViaUI(page);
    await page.goto('/settings');

    const checkbox = page.getByRole('checkbox', { name: /translate sentences for all words/i });
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test('toggling the checkbox persists the setting to localStorage', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/settings');

    const checkbox = page.getByRole('checkbox', { name: /translate sentences for all words/i });
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
    const checkbox = page.getByRole('checkbox', { name: /translate sentences for all words/i });
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Reload the page
    await page.reload();

    // Verify the checkbox is still checked
    const checkboxAfterReload = page.getByRole('checkbox', {
      name: /translate sentences for all words/i,
    });
    await expect(checkboxAfterReload).toBeChecked();
  });

  // The setting widens the Read stage only, so Make Sentences does not enable it.
  test('checkbox is disabled when the Read stage is turned off', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sentenceRead', 'false');
      localStorage.setItem('sentenceWrite', 'true');
    });

    await loginViaUI(page);
    await page.goto('/settings');

    const checkbox = page.getByRole('checkbox', { name: /translate sentences for all words/i });
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
    const checkbox = page.getByRole('checkbox', { name: /translate sentences for all words/i });
    await checkbox.click();

    // The estimated time should change
    await expect(estimateEl).not.toHaveText(initialText!);
  });
});
