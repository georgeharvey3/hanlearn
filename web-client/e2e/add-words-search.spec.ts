import { test, expect } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
  loginViaUI,
  configureTestSettings,
} from './fixtures/seed';
import { AddWordsPage } from './pages/add-words.page';

test.describe('Word bank search field', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page);
    await loginViaUI(page);
  });

  test('Enter asks the dictionary', async ({ page }) => {
    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    await addWords.searchWord('你好');
    await expect(addWords.searchOutcome.first()).toBeVisible();
  });

  test('the dictionary is asked after a pause in typing', async ({ page }) => {
    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    await addWords.searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await addWords.searchInput.fill('好');
    await expect(addWords.searchOutcome.first()).toBeVisible({ timeout: 30000 });
  });

  test('Clear empties the field and brings the lists back', async ({ page }) => {
    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    await addWords.searchWord('你好');
    await addWords.clearSearch();
    await expect(addWords.searchInput).toHaveValue('');
    await expect(page.getByRole('tablist', { name: 'Lists' })).toBeVisible();
  });
});
