import { test, expect } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
  loginViaUI,
  configureTestSettings,
} from './fixtures/seed';
import { AddWordsPage } from './pages/add-words.page';

test.describe('AddWords submit button', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page);
    await loginViaUI(page);
  });

  test('search button is labelled "Search"', async ({ page }) => {
    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    // The button should say "Search" (not "Submit")
    await expect(addWords.submitButton).toBeVisible();
    await expect(addWords.submitButton).toHaveText('Search');
  });

  test('search button is disabled when input is empty', async ({ page }) => {
    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    await addWords.searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await expect(addWords.submitButton).toBeDisabled();
  });

  test('search button is enabled after typing in the input', async ({ page }) => {
    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    await addWords.searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await addWords.searchInput.fill('好');
    await expect(addWords.submitButton).toBeEnabled();
  });

  test('clicking the search button triggers word search', async ({ page }) => {
    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    await addWords.searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await addWords.searchInput.fill('你好');

    // Click the Search button (instead of pressing Enter)
    await addWords.submitButton.click();

    // Should show some kind of result modal (add confirmation, clash table, not-found, or error)
    await expect(
      page
        .getByText('Add to Word Bank?')
        .or(page.getByText('Select entry for'))
        .or(page.getByText('Word not found'))
        .or(page.getByText('Could not search for word')),
    ).toBeVisible({ timeout: 30000 });
  });
});
