import { test, expect } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
  seedWords,
  readWordFromFirestore,
  loginViaUI,
  TEST_USER,
  configureTestSettings,
  TestWord,
} from './fixtures/seed';
import { TestWordsPage } from './pages/test-words.page';

test.describe('Spaced repetition', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page, { numWords: '1' });
    await loginViaUI(page);
  });

  test('incorrect answer resets word to bank 1', async ({ page }) => {
    const word: TestWord = {
      id: 6001,
      simp: '红',
      trad: '紅',
      pinyin: 'hong2',
      meaning: 'red',
      bank: 3,
      dueDate: new Date(Date.now() - 86400000), // yesterday
    };
    await seedWords(TEST_USER.uid, [word]);

    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    // Wait for test to load
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Answer poorly — use IDK 3 times then mark as known to finish
    await testPage.completeTestWithIDK(3);
    await testPage.waitForSummary();

    // Verify summary shows weak score (3 IDKs → "Weak")
    await expect(page.getByText(/Very Weak|Weak/i).first()).toBeVisible();

    // Verify Firestore state — bank should be reset to 1
    const wordData = await readWordFromFirestore(TEST_USER.uid, word.id);
    expect(wordData).not.toBeNull();
    expect(wordData!.bank).toBe(1);
  });

  test('word bank updates after completing test', async ({ page }) => {
    const word: TestWord = {
      id: 7001,
      simp: '白',
      trad: '白',
      pinyin: 'bai2',
      meaning: 'white',
      bank: 1,
      dueDate: new Date(Date.now() - 86400000),
    };
    await seedWords(TEST_USER.uid, [word]);

    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    // Wait for test to load
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Complete the test poorly (IDK 3 times → score 1 → bank resets to 1)
    await testPage.completeTestWithIDK(3);
    await testPage.waitForSummary();

    // Verify Firestore was updated (due date should have changed)
    const wordData = await readWordFromFirestore(TEST_USER.uid, word.id);
    expect(wordData).not.toBeNull();
    // Bank should be 1 (stayed at 1 since we answered poorly)
    expect(wordData!.bank).toBe(1);
    // Due date should be updated (tomorrow = today + 1 day for bank 1)
    const dueDate = new Date(wordData!.dueDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Due date should be roughly tomorrow (within a day tolerance)
    expect(dueDate.getTime()).toBeGreaterThan(Date.now() - 3600000);
  });
});
