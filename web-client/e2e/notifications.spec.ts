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
    await addWords.addFirstResult('hello');

    // Assert toast notification appears
    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('Added');
  });

  test('toast appears when deleting a word', async ({ page }) => {
    // Seed a word first
    await seedWords(TEST_USER.uid, [TEST_WORDS[0]]);

    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    // Wait for word to appear
    await addWords.expectWordVisible(TEST_WORDS[0].simp);

    // Open the word's row, then remove it
    await page.getByText(TEST_WORDS[0].simp, { exact: true }).first().click();
    await page.getByRole('button', { name: 'Remove' }).click();

    // Assert toast notification appears
    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('Word removed');
  });

  test('toast auto-dismisses after timeout', async ({ page }) => {
    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    await addWords.searchWord('你好');

    await addWords.addFirstResult('hello');

    // Toast should appear
    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible({ timeout: 10000 });

    // Toast should auto-dismiss (default 4s + transition time)
    await expect(toast).not.toBeVisible({ timeout: 8000 });
  });
});
