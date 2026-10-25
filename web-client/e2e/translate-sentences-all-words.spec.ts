import { test, expect, Page } from '@playwright/test';
import { clearEmulatorData, seedTestUser, loginViaUI } from './fixtures/seed';

// The setting sits in the Stages group, which starts closed.
const openStages = (page: Page) => page.getByRole('button', { name: /^Stages/ }).click();
const allWords = (page: Page) => page.getByRole('switch', { name: /translate with all words/i });

test.describe('Translate sentences for all words setting', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
  });

  test('Settings page shows the "Translate with all words" switch off by default', async ({
    page,
  }) => {
    await loginViaUI(page);
    await page.goto('/settings');
    await openStages(page);

    const allWordsSwitch = allWords(page);
    await expect(allWordsSwitch).toBeVisible();
    await expect(allWordsSwitch).not.toBeChecked();
  });

  test('toggling the switch persists the setting to localStorage', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/settings');
    await openStages(page);

    const allWordsSwitch = allWords(page);
    await allWordsSwitch.click();
    await expect(allWordsSwitch).toBeChecked();

    // Verify localStorage was updated
    const storedValue = await page.evaluate(() =>
      localStorage.getItem('sentenceStagesForAllWords'),
    );
    expect(storedValue).toBe('true');
  });

  test('setting persists after page reload', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/settings');
    await openStages(page);

    // Enable the setting
    const allWordsSwitch = allWords(page);
    await allWordsSwitch.click();
    await expect(allWordsSwitch).toBeChecked();

    // Reload the page
    await page.reload();
    await openStages(page);

    // Verify the switch is still on
    const switchAfterReload = allWords(page);
    await expect(switchAfterReload).toBeChecked();
  });

  // The setting widens the Read stage only, so Make Sentences does not enable it.
  test('switch is disabled when the Read stage is turned off', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sentenceRead', 'false');
      localStorage.setItem('sentenceWrite', 'true');
    });

    await loginViaUI(page);
    await page.goto('/settings');
    await openStages(page);

    const allWordsSwitch = allWords(page);
    await expect(allWordsSwitch).toBeDisabled();
  });

  test('estimated test time updates when the setting is toggled', async ({ page }) => {
    // Set 10 words so the estimate difference is noticeable
    await page.addInitScript(() => {
      localStorage.setItem('numWords', '10');
    });

    await loginViaUI(page);
    await page.goto('/settings');
    await openStages(page);

    // The closed Session header shows the time of a session.
    const estimateEl = page.getByRole('button', { name: /^Session/ });
    const initialText = await estimateEl.textContent();

    // Toggle the setting on
    const allWordsSwitch = allWords(page);
    await allWordsSwitch.click();

    // The estimated time should change
    await expect(estimateEl).not.toHaveText(initialText!);
  });
});
