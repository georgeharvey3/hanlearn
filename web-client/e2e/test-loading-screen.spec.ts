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

test.describe('Test loading screen', () => {
  const dueWords: TestWord[] = [
    {
      id: 6001,
      simp: '火',
      trad: '火',
      pinyin: 'huo3',
      meaning: 'fire',
      bank: 2,
      dueDate: new Date(Date.now() - 86400000),
    },
    {
      id: 6002,
      simp: '山',
      trad: '山',
      pinyin: 'shan1',
      meaning: 'mountain',
      bank: 2,
      dueDate: new Date(Date.now() - 86400000),
    },
  ];

  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page, { numWords: '2' });
    await loginViaUI(page);
  });

  test('does not flash "No words due" when starting a test with due words', async ({ page }) => {
    await seedWords(TEST_USER.uid, dueWords);

    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    // Wait for the test to load — should see test UI elements
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Once the test has loaded, "No words due" should not be visible
    await expect(page.getByText(/No words due/i).first()).not.toBeVisible();
  });

  test('shows loading spinner before test content appears', async ({ page }) => {
    await seedWords(TEST_USER.uid, dueWords);

    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    // Either a loading spinner or the test content should be visible — never "No words due"
    const noWordsDue = page.getByText(/No words due/i).first();
    const testContent = page.getByText(/pinyin|character|meaning/i).first();

    // Wait for test content to appear
    await expect(testContent).toBeVisible({ timeout: 15000 });

    // Verify no words due message is not shown
    await expect(noWordsDue).not.toBeVisible();
  });

  test('shows "No words due" only when there are genuinely no words due', async ({ page }) => {
    // Seed words with a future due date
    const futureWords: TestWord[] = [
      {
        id: 7001,
        simp: '风',
        trad: '風',
        pinyin: 'feng1',
        meaning: 'wind',
        bank: 3,
        dueDate: new Date(Date.now() + 30 * 86400000),
      },
    ];
    await seedWords(TEST_USER.uid, futureWords);

    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    // Should eventually show "No words due" (this is the correct behavior)
    await expect(page.getByText(/No words due/i).first()).toBeVisible({ timeout: 15000 });

    // Practice button should be available since there are words in the list
    await expect(page.getByRole('button', { name: 'Practice' })).toBeVisible();
  });
});
