import { test, expect } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
  seedWords,
  loginViaUI,
  TEST_USER,
  TEST_WORDS,
  configureTestSettings,
} from './fixtures/seed';
import { AddWordsPage } from './pages/add-words.page';

test.describe('Notification toasts', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page);
    await loginViaUI(page);
  });

  test('toast appears when adding a word', async ({ page }) => {
    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    await addWords.searchWord('你好');

    // Handle clash table or direct add modal
    const clashTable = page.getByText('Select entry for');
    const addModal = page.getByText('Add to Word List?');
    const notFoundModal = page.getByText('Word not found');

    await expect(clashTable.or(addModal).or(notFoundModal)).toBeVisible({ timeout: 30000 });

    if (await clashTable.isVisible()) {
      await addWords.selectClashEntry(0);
      await addWords.confirmAddWord();
    } else if (await addModal.isVisible()) {
      await addWords.confirmAddWord();
    } else {
      // Word not found — add as custom word
      const meaningInput = page.locator('#meaning');
      await meaningInput.fill('hello');
      await page.getByRole('button', { name: 'Submit' }).click();
    }

    // Assert toast notification appears
    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('added to your list');
  });

  test('toast appears when deleting a word', async ({ page }) => {
    // Seed a word first
    await seedWords(TEST_USER.uid, [TEST_WORDS[0]]);

    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    // Wait for word to appear
    await addWords.expectWordVisible(TEST_WORDS[0].simp);

    // Click the remove button on the word card
    const removeButton = page.getByRole('button', { name: /remove word/i });
    await removeButton.first().click();

    // Assert toast notification appears
    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('Word removed');
  });

  test('toast auto-dismisses after timeout', async ({ page }) => {
    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    await addWords.searchWord('你好');

    const clashTable = page.getByText('Select entry for');
    const addModal = page.getByText('Add to Word List?');
    const notFoundModal = page.getByText('Word not found');

    await expect(clashTable.or(addModal).or(notFoundModal)).toBeVisible({ timeout: 30000 });

    if (await clashTable.isVisible()) {
      await addWords.selectClashEntry(0);
      await addWords.confirmAddWord();
    } else if (await addModal.isVisible()) {
      await addWords.confirmAddWord();
    } else {
      const meaningInput = page.locator('#meaning');
      await meaningInput.fill('hello');
      await page.getByRole('button', { name: 'Submit' }).click();
    }

    // Toast should appear
    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible({ timeout: 10000 });

    // Toast should auto-dismiss (default 4s + transition time)
    await expect(toast).not.toBeVisible({ timeout: 8000 });
  });
});
