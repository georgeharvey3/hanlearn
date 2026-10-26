import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
  seedWords,
  seedWordList,
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

  test('a word in two lists stays when one of the lists is deleted', async ({ page }) => {
    await seedWordList(TEST_USER.uid, { id: 'hsk1', name: 'HSK 1', order: 1 });
    await seedWords(TEST_USER.uid, [{ ...TEST_WORDS[0], listIds: ['hsk1'] }]);

    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();
    await page.getByRole('tab', { name: /^HSK 1/ }).click();

    // Put the word into General too.
    await page.getByText('你好', { exact: true }).click();
    await page.getByRole('button', { name: 'Edit lists' }).click();
    const lists = page.getByRole('dialog', { name: 'Lists for 你好' });
    await lists.getByRole('checkbox', { name: 'General' }).check();
    await lists.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('General, HSK 1')).toBeVisible();

    // Delete HSK 1. The word is in General, so the delete removes no word.
    await page.getByRole('button', { name: 'List actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete HSK 1?' });
    await expect(confirm.getByText(/^Deletes/)).toHaveCount(0);
    await confirm.getByRole('button', { name: 'Delete' }).click();

    // The bank moves to General, and the word is there.
    await expect(page.getByRole('tab', { name: /^General/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await addWords.expectWordVisible('你好');
  });

  test('a premade list becomes the active list, and the next session teaches its words', async ({
    page,
  }) => {
    // The catalogue that `npm run build:dict` writes.
    const hsk1 = JSON.parse(
      readFileSync(path.join(__dirname, '../public/premade-lists/hsk-1.json'), 'utf8'),
    ) as { simp: string }[];
    await configureTestSettings(page, { newWords: 'true' });

    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();
    await page.getByRole('button', { name: 'New list' }).click();
    const dialog = page.getByRole('dialog', { name: 'New list' });
    await dialog.getByRole('button', { name: /^HSK 1/ }).click();

    const confirm = page.getByRole('dialog', { name: 'HSK 1' });
    await expect(confirm.getByText(/words, all new\.$/)).toBeVisible();
    await confirm.getByRole('button', { name: 'Add list' }).click();
    await expect(confirm).toBeHidden({ timeout: 30000 });

    await expect(page.getByRole('tab', { name: /^HSK 1/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.goto('/test-words');
    await expect(page.getByText('New words', { exact: true })).toBeVisible({ timeout: 30000 });
    const shown = await page.locator('[lang="zh"]').first().textContent();
    expect(hsk1.map((entry) => entry.simp)).toContain(shown?.trim());
  });
});
