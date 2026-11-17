import { test, expect, Page } from '@playwright/test';
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

/**
 * #502: on a wide screen a study screen is a phone-sized column, at most
 * 844px high, and the page never scrolls. Only the middle of the column
 * scrolls, so the session bar and the actions stay in view.
 */
test.describe('Study column', () => {
  const dueWords: TestWord[] = [
    {
      id: 9101,
      simp: '火',
      trad: '火',
      pinyin: 'huo3',
      meaning: 'fire',
      bank: 2,
      dueDate: new Date(Date.now() - 86400000),
    },
  ];

  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await seedWords(TEST_USER.uid, dueWords);
    await configureTestSettings(page, { numWords: '1' });
    await loginViaUI(page);
  });

  const openTest = async (page: Page) => {
    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();
    await expect(testPage.showAnswerButton).toBeVisible({ timeout: 15000 });
    return testPage;
  };

  const columnHeight = async (page: Page) =>
    (await page.getByTestId('study-screen').boundingBox())!.height;

  const pageScrolls = (page: Page) =>
    page.evaluate(
      () => document.documentElement.scrollHeight > document.documentElement.clientHeight,
    );

  test('is 844px high on a tall wide screen, and the page does not scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openTest(page);

    expect(await columnHeight(page)).toBe(844);
    expect(await pageScrolls(page)).toBe(false);
  });

  test('fits a short wide window, and the page does not scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await openTest(page);

    expect(await columnHeight(page)).toBeLessThanOrEqual(700);
    expect(await pageScrolls(page)).toBe(false);
  });

  test('keeps the session bar and the actions in view in a short window', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 420 });
    const testPage = await openTest(page);

    expect(await pageScrolls(page)).toBe(false);
    await expect(page.getByRole('button', { name: 'End session' })).toBeInViewport();
    await expect(testPage.showAnswerButton).toBeInViewport();
  });

  test('fills the window on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTest(page);

    expect(await columnHeight(page)).toBe(844);
  });
});
