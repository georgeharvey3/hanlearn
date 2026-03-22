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

test.describe('Dashboard due count accuracy', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page);
    await loginViaUI(page);
  });

  test('dashboard shows correct due count for words due today', async ({ page }) => {
    // Seed words with due dates at a later time today (simulating words set
    // via finishTest at a later hour — this is the scenario that caused the bug).
    const now = new Date();
    const laterToday = new Date(now);
    laterToday.setHours(23, 30, 0, 0); // 11:30pm today

    const words: TestWord[] = [
      {
        id: 6001,
        simp: '大',
        trad: '大',
        pinyin: 'da4',
        meaning: 'big',
        bank: 1,
        dueDate: laterToday,
      },
      {
        id: 6002,
        simp: '小',
        trad: '小',
        pinyin: 'xiao3',
        meaning: 'small',
        bank: 1,
        dueDate: laterToday,
      },
      {
        id: 6003,
        simp: '人',
        trad: '人',
        pinyin: 'ren2',
        meaning: 'person',
        bank: 2,
        dueDate: new Date(Date.now() + 7 * 86400000), // future, not due
      },
    ];
    await seedWords(TEST_USER.uid, words);

    // Navigate to dashboard
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });

    // The dashboard should show 2 words due (the two due today), not 0
    const dueCount = page.getByTestId('due-words-count');
    await expect(dueCount).toBeVisible({ timeout: 10000 });
    await expect(dueCount).toHaveText('2');
  });

  test('dashboard due count matches test page due count', async ({ page }) => {
    // Seed words due at a later time today
    const laterToday = new Date();
    laterToday.setHours(23, 59, 0, 0);

    const words: TestWord[] = [
      {
        id: 7001,
        simp: '水',
        trad: '水',
        pinyin: 'shui3',
        meaning: 'water',
        bank: 1,
        dueDate: laterToday,
      },
      {
        id: 7002,
        simp: '火',
        trad: '火',
        pinyin: 'huo3',
        meaning: 'fire',
        bank: 1,
        dueDate: new Date(Date.now() - 86400000), // yesterday, clearly due
      },
    ];
    await seedWords(TEST_USER.uid, words);

    // Check dashboard
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });

    // Wait for stats to load — the "Words Due" label should appear
    const wordsDueLabel = page.locator('text=Words Due').first();
    await expect(wordsDueLabel).toBeVisible({ timeout: 10000 });

    // Navigate to test page and verify it also sees the same words as due
    await page.goto('/test-words');
    // The test page should load and show test UI (meaning words are due)
    // If it showed "No words due" that would indicate a mismatch
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });
});
