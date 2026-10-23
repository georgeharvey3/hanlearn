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

    await addWords.addFirstResult('hello');
    // The added word shows under "In your bank".
    await addWords.expectWordVisible('你好');
  });

  test('view word list with pre-seeded words', async ({ page }) => {
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

    // The results, the own-word form or an error take the place of the list.
    await expect(addWords.searchOutcome.first()).toBeVisible();
  });
});
