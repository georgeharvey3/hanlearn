import { test, expect } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
  seedWords,
  loginViaUI,
  TEST_USER,
  configureTestSettings,
  TestWord,
} from './fixtures/seed';
import { TestWordsPage } from './pages/test-words.page';

test.describe('Chengyus in main test', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page, { numWords: '5' });
    await loginViaUI(page);
  });

  test('chengyu-only word bank starts a test session', async ({ page }) => {
    const chengyuWords: TestWord[] = [
      {
        id: 6001,
        simp: '一举两得',
        trad: '一舉兩得',
        pinyin: 'yi1 ju3 liang3 de2',
        meaning: 'kill two birds with one stone',
        bank: 1,
        dueDate: new Date(Date.now() - 86400000),
      },
    ];
    await seedWords(TEST_USER.uid, chengyuWords);

    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    // Should see the test UI — not "No words due"
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Complete the test
    await testPage.completeTestWithIDK();
    await testPage.waitForSummary();
    await expect(page.getByText('Session Summary')).toBeVisible();
  });

  test('mixed regular words and chengyus appear together in test', async ({ page }) => {
    const mixedWords: TestWord[] = [
      {
        id: 7001,
        simp: '大',
        trad: '大',
        pinyin: 'da4',
        meaning: 'big',
        bank: 2,
        dueDate: new Date(Date.now() - 86400000),
      },
      {
        id: 7002,
        simp: '半途而废',
        trad: '半途而廢',
        pinyin: 'ban4 tu2 er2 fei4',
        meaning: 'give up halfway',
        bank: 2,
        dueDate: new Date(Date.now() - 86400000),
      },
    ];
    await seedWords(TEST_USER.uid, mixedWords);

    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    // Test should load with both words
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Complete the entire test and reach summary
    await testPage.completeTestWithIDK();
    await testPage.waitForSummary();

    // Summary should show both words were tested
    await expect(page.getByText(/2 word.*tested/i)).toBeVisible({ timeout: 5000 });
  });

  test('chengyu-only bank shows Practice button when none due', async ({ page }) => {
    const futureChengyus: TestWord[] = [
      {
        id: 8001,
        simp: '守株待兔',
        trad: '守株待兔',
        pinyin: 'shou3 zhu1 dai4 tu4',
        meaning: 'wait for a windfall',
        bank: 3,
        dueDate: new Date(Date.now() + 30 * 86400000),
      },
    ];
    await seedWords(TEST_USER.uid, futureChengyus);

    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    // Should show "No words due" with Practice button (not just Add Words)
    await expect(page.getByText(/No words due/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Practice' })).toBeVisible();
  });
});
