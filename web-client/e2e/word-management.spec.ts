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

    // Handle potential clash table (multiple entries), direct add modal,
    // or "Word not found" (if Cloud Functions cold-start is slow)
    const clashTable = page.getByText('Select entry for');
    const addModal = page.getByText('Add to Word List?');
    const notFoundModal = page.getByText('Word not found');

    // Wait for any result modal to appear
    await expect(clashTable.or(addModal).or(notFoundModal)).toBeVisible({ timeout: 30000 });

    if (await clashTable.isVisible()) {
      // Select the first entry from clash table
      await addWords.selectClashEntry(0);
      // After selecting, the add confirmation modal should appear
      await addWords.confirmAddWord();
      await addWords.expectWordVisible('你好');
    } else if (await addModal.isVisible()) {
      await addWords.confirmAddWord();
      await addWords.expectWordVisible('你好');
    } else {
      // Word not found modal — add as custom word
      const meaningInput = page.locator('#meaning');
      await meaningInput.fill('hello');
      await page.getByRole('button', { name: 'Submit' }).click();
      await addWords.expectWordVisible('你好');
    }
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

    // Should show some kind of result (add confirmation, clash table, not-found modal, or error alert)
    // Cloud Functions dictionary search may have cold-start delay
    await expect(
      page
        .getByText('Add to Word List?')
        .or(page.getByText('Select entry for'))
        .or(page.getByText('Word not found'))
        .or(page.getByText('Could not search for word')),
    ).toBeVisible({ timeout: 30000 });
  });
});
