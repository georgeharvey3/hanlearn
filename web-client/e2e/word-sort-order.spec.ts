import { test, expect } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
  seedWords,
  loginViaUI,
  TEST_USER,
  configureTestSettings,
} from './fixtures/seed';
import { AddWordsPage } from './pages/add-words.page';

test.describe('Word sort order after adding', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page);
    await loginViaUI(page);
  });

  test('newly added word appears in due-date sorted position, not at top', async ({ page }) => {
    // Seed words with specific due dates:
    // - One overdue (past) and one far in the future
    const pastDate = new Date('2020-01-01');
    const futureDate = new Date('2099-12-31');

    await seedWords(TEST_USER.uid, [
      {
        id: 2001,
        simp: '过去',
        trad: '過去',
        pinyin: 'guo4 qu4',
        meaning: 'past',
        dueDate: pastDate,
      },
      {
        id: 2002,
        simp: '未来',
        trad: '未來',
        pinyin: 'wei4 lai2',
        meaning: 'future',
        dueDate: futureDate,
      },
    ]);

    const addWords = new AddWordsPage(page);
    await addWords.navigateTo();

    // Verify initial order: 过去 (past due) should be before 未来 (future due)
    await addWords.expectWordVisible('过去');
    await addWords.expectWordVisible('未来');

    // Add a new word — it will get today's date as due date
    await addWords.searchWord('大');

    await addWords.addFirstResult('big');
    // Clear the search to bring the list back.
    await addWords.clearSearch();

    // Wait for the new word to appear
    await addWords.expectWordVisible('大');

    // Verify sort order: the new word (due today) should appear between
    // 过去 (overdue, 2020) and 未来 (future, 2099)
    // Get all word characters in display order: each row is a button that opens it
    const wordElements = page.locator('[aria-expanded] [lang="zh"]');
    const wordTexts: string[] = [];
    const count = await wordElements.count();
    for (let i = 0; i < count; i++) {
      const text = await wordElements.nth(i).textContent();
      if (text) wordTexts.push(text);
    }

    // The order should be: 过去 (past), 大 (today), 未来 (future)
    const pastIndex = wordTexts.indexOf('过去');
    const newWordIndex = wordTexts.indexOf('大');
    const futureIndex = wordTexts.indexOf('未来');

    expect(pastIndex).toBeGreaterThanOrEqual(0);
    expect(newWordIndex).toBeGreaterThanOrEqual(0);
    expect(futureIndex).toBeGreaterThanOrEqual(0);

    expect(pastIndex).toBeLessThan(newWordIndex);
    expect(newWordIndex).toBeLessThan(futureIndex);
  });
});
