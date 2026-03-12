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

test.describe('Word management', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page);
    await loginViaUI(page);
  });

  test('add a word from dictionary search', async ({ page }) => {
    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    await addWords.searchWord('你好');

    // Handle potential clash table (multiple entries) or direct add modal
    const clashTable = page.getByText('Select entry for');
    const addModal = page.getByText('Add to Word Bank?');

    // Wait for either modal to appear
    await expect(clashTable.or(addModal)).toBeVisible({ timeout: 10000 });

    if (await clashTable.isVisible()) {
      // Select the first entry from clash table
      await addWords.selectClashEntry(0);
    }

    // Now confirm the add
    await addWords.confirmAddWord();

    // Word should appear on the page
    await addWords.expectWordVisible('你好');
  });

  test('view word bank with pre-seeded words', async ({ page }) => {
    // Seed 3 words before navigating
    await seedWords(TEST_USER.uid, TEST_WORDS);

    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    // All 3 test words should be visible
    for (const word of TEST_WORDS) {
      await addWords.expectWordVisible(word.simp);
    }
  });

  test('search for word shows results', async ({ page }) => {
    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    // Search for a common word
    await addWords.searchWord('大');

    // Should show some kind of result modal (add confirmation, clash table, or error)
    await expect(
      page
        .getByText('Add to Word Bank?')
        .or(page.getByText('Select entry for'))
        .or(page.getByText('Word not found')),
    ).toBeVisible({ timeout: 10000 });
  });
});
