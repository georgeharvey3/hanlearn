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

test.describe('Study flow', () => {
  const dueWords: TestWord[] = [
    {
      id: 2001,
      simp: '大',
      trad: '大',
      pinyin: 'da4',
      meaning: 'big',
      bank: 1,
      dueDate: new Date(Date.now() - 86400000), // yesterday
    },
    {
      id: 2002,
      simp: '小',
      trad: '小',
      pinyin: 'xiao3',
      meaning: 'small',
      bank: 1,
      dueDate: new Date(Date.now() - 86400000),
    },
  ];

  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page, { numWords: '2' });
    await loginViaUI(page);
  });

  test('start and complete a test session', async ({ page }) => {
    await seedWords(TEST_USER.uid, dueWords);

    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    // Wait for the test to load — should see test UI elements
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Complete the test by clicking "I Don't Know" through all questions
    await testPage.completeTestWithIDK();

    // Should reach the summary
    await testPage.waitForSummary();
    await expect(page.getByText('Session Summary')).toBeVisible();
    await expect(page.getByText(/word.*tested/i)).toBeVisible();
  });

  test('show answer and score as weak', async ({ page }) => {
    const singleWord: TestWord[] = [
      {
        id: 3001,
        simp: '水',
        trad: '水',
        pinyin: 'shui3',
        meaning: 'water',
        bank: 1,
        dueDate: new Date(Date.now() - 86400000),
      },
    ];
    await seedWords(TEST_USER.uid, singleWord);

    const testPage = new TestWordsPage(page);
    await page.goto('/test-words');

    // Wait for test to load
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Use IDK for all questions
    await testPage.completeTestWithIDK();
    await testPage.waitForSummary();

    // Should show weak/very weak scores
    await expect(
      page.getByText(/Very Weak|Weak/i).first(),
    ).toBeVisible();
  });

  test('no words due shows appropriate message', async ({ page }) => {
    // Seed words with future due date
    const futureWords: TestWord[] = [
      {
        id: 4001,
        simp: '天',
        trad: '天',
        pinyin: 'tian1',
        meaning: 'sky/day',
        bank: 2,
        dueDate: new Date(Date.now() + 7 * 86400000), // 7 days from now
      },
    ];
    await seedWords(TEST_USER.uid, futureWords);

    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    // Should see "No words due" message with Practice option
    await expect(page.getByText(/No words due/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Practice' })).toBeVisible();
  });

  test('practice mode when no words due', async ({ page }) => {
    const futureWords: TestWord[] = [
      {
        id: 5001,
        simp: '人',
        trad: '人',
        pinyin: 'ren2',
        meaning: 'person',
        bank: 2,
        dueDate: new Date(Date.now() + 7 * 86400000),
      },
    ];
    await seedWords(TEST_USER.uid, futureWords);

    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    // Wait for no words due screen
    await expect(page.getByText(/No words due/i)).toBeVisible({ timeout: 15000 });

    // Click Practice
    await testPage.clickPractice();

    // Should start a practice session — test UI should appear
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Complete the practice session
    await testPage.completeTestWithIDK();
    await testPage.waitForSummary();
  });

  test('redirect to add words when word bank is empty', async ({ page }) => {
    // Don't seed any words
    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    // Should show "No words due" with Add Words button but no Practice button
    await expect(page.getByText(/No words due/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Add Words' })).toBeVisible();
  });
});
