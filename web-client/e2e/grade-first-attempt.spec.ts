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

/**
 * The grade of a question comes from the first attempt, and it has three
 * values. See docs/adr/0007-grade-the-first-attempt.md.
 *
 * configureTestSettings asks MP only, in flashcard mode, so each session below
 * asks one question and the learner reports the grade of it.
 */
test.describe('The grade of the first attempt', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page, { numWords: '1' });
    await loginViaUI(page);
  });

  /** Seed one due word at the given bank and open the session. */
  async function startSession(page: import('@playwright/test').Page, word: TestWord) {
    await seedWords(TEST_USER.uid, [word]);

    const testPage = new TestWordsPage(page);
    await testPage.navigateTo();

    await expect(page.getByText(/pinyin|character|meaning/i).first()).toBeVisible({
      timeout: 15000,
    });
    await testPage.showAnswerButton.click();

    return testPage;
  }

  test('a lapse halves the interval of the direction it asked', async ({ page }) => {
    const word: TestWord = {
      id: 8001,
      simp: '蓝',
      trad: '藍',
      pinyin: 'lan2',
      meaning: 'blue',
      bank: 3,
      dueDate: new Date(Date.now() - 86400000),
    };

    const testPage = await startSession(page, word);
    await testPage.gradeFlashcard('lapse');
    await testPage.waitForSummary();

    await expect(page.getByText('Nearly')).toBeVisible();

    // MP holds the seven days of bank 3, and the lapse halves them to four.
    // Bank 2 is the band of a four day interval. A fail would have reset the
    // interval to 0 and the bank to 1. The other four directions stay at 3.
    const wordData = await readWordFromFirestore(TEST_USER.uid, word.id);
    expect(wordData).not.toBeNull();
    expect(wordData!.intervals.MP).toBe(4);
    expect(wordData!.banks.MP).toBe(2);
    expect(wordData!.banks.CM).toBe(3);
    expect(wordData!.level).toBe(2);
  });

  test('a pass multiplies the interval of the direction it asked', async ({ page }) => {
    const word: TestWord = {
      id: 8002,
      simp: '绿',
      trad: '綠',
      pinyin: 'lv4',
      meaning: 'green',
      bank: 3,
      dueDate: new Date(Date.now() - 86400000),
    };

    const testPage = await startSession(page, word);
    await testPage.gradeFlashcard('pass');
    await testPage.waitForSummary();

    await expect(page.getByText('Known')).toBeVisible();

    // MP holds the seven days of bank 3, and the pass multiplies them by the
    // starting ease of 2.5. The other four directions stay at 3.
    const wordData = await readWordFromFirestore(TEST_USER.uid, word.id);
    expect(wordData).not.toBeNull();
    expect(wordData!.intervals.MP).toBe(18);
    expect(wordData!.banks.MP).toBe(3);
    expect(wordData!.banks.CM).toBe(3);
  });

  test('a late pass takes half of the delay as credit', async ({ page }) => {
    const day = 86400000;
    const word: TestWord = {
      id: 8003,
      simp: '红',
      trad: '紅',
      pinyin: 'hong2',
      meaning: 'red',
      bank: 3,
      interval: 10,
      lastReview: new Date(Date.now() - 30 * day),
      dueDate: new Date(Date.now() - 20 * day),
    };

    const testPage = await startSession(page, word);
    await testPage.gradeFlashcard('pass');
    await testPage.waitForSummary();

    // The schedule asked for 10 days and the learner answered on day 30. The
    // delay is 20 days, and half of it is credit: (10 + 10) * 2.5.
    const wordData = await readWordFromFirestore(TEST_USER.uid, word.id);
    expect(wordData).not.toBeNull();
    expect(wordData!.intervals.MP).toBe(50);
    expect(wordData!.banks.MP).toBe(4);
  });
});
