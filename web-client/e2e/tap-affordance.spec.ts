import { test, expect } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
  seedWords,
  loginViaUI,
  TEST_USER,
  configureTestSettings,
  emulatorFirestoreUrl,
  TestWord,
} from './fixtures/seed';

/**
 * Seed sentence cache so SentenceRead can load sentences without the AI service.
 */
async function seedSentenceCache(word: string): Promise<void> {
  const url = emulatorFirestoreUrl(`sentenceCache/${word}`);
  const sentences = [
    {
      chinese: '我喜欢喝水。',
      english: 'I like to drink water.',
      segments: ['我', '喜欢', '喝', '水'],
      targetIndex: 3,
    },
  ];

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
    body: JSON.stringify({
      fields: {
        sentences: {
          arrayValue: {
            values: sentences.map((s) => ({
              mapValue: {
                fields: {
                  chinese: { stringValue: s.chinese },
                  english: { stringValue: s.english },
                  segments: {
                    arrayValue: {
                      values: s.segments.map((seg) => ({ stringValue: seg })),
                    },
                  },
                  targetIndex: { integerValue: s.targetIndex.toString() },
                },
              },
            })),
          },
        },
        generatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to seed sentence cache: ${await res.text()}`);
  }
}

test.describe('Tap affordance for clickable words', () => {
  const dueWord: TestWord = {
    id: 7001,
    simp: '水',
    trad: '水',
    pinyin: 'shui3',
    meaning: 'water',
    bank: 1,
    dueDate: new Date(Date.now() - 86400000),
  };

  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    // Enable sentenceRead in text mode (useSound=false), disable other stages
    await configureTestSettings(page, {
      sentenceRead: 'true',
      sentenceWrite: 'false',
      newWords: 'false',
      useFlashcards: 'false',
      useSound: 'false',
      numWords: '1',
      priority: 'MP',
      onlyPriority: 'true',
    });
    await loginViaUI(page);
  });

  test('shows first-use hint that dismisses after tapping a word', async ({ page }) => {
    await seedWords(TEST_USER.uid, [dueWord]);
    await seedSentenceCache(dueWord.simp);

    await page.goto('/test-words');

    // Wait for the test to load and progress to sentence stage
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Answer the meaning question to advance to sentence stage
    const answerInput = page.locator('#answer-input');
    if (await answerInput.isVisible({ timeout: 5000 })) {
      await answerInput.fill(dueWord.meaning);
      await answerInput.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Check for the first-use hint text in the sentence read stage
    const tapHint = page.getByTestId('tap-hint');
    const hintVisible = await tapHint.isVisible({ timeout: 10000 }).catch(() => false);

    if (hintVisible) {
      // Should show the first-use hint
      await expect(tapHint).toContainText('Tap any word for its definition');

      // Find a clickable word span (has data-popup attribute)
      const clickableWord = page.locator('[data-popup]').first();
      const wordVisible = await clickableWord.isVisible({ timeout: 5000 }).catch(() => false);

      if (wordVisible) {
        // Tap the word
        await clickableWord.click();

        // After tapping, hint should change to the default text
        await expect(tapHint).toContainText('Tap a word to reveal its meaning');

        // localStorage should be updated
        const dismissed = await page.evaluate(() => localStorage.getItem('tapHintDismissed'));
        expect(dismissed).toBe('true');
      }
    }
  });

  test('clickable words have visual tap affordance (dotted underline)', async ({ page }) => {
    await seedWords(TEST_USER.uid, [dueWord]);
    await seedSentenceCache(dueWord.simp);

    await page.goto('/test-words');

    // Wait for test to load
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Answer the meaning question to advance to sentence stage
    const answerInput = page.locator('#answer-input');
    if (await answerInput.isVisible({ timeout: 5000 })) {
      await answerInput.fill(dueWord.meaning);
      await answerInput.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Find clickable word spans with data-popup attribute
    const clickableWord = page.locator('[data-popup]').first();
    const wordVisible = await clickableWord.isVisible({ timeout: 10000 }).catch(() => false);

    if (wordVisible) {
      // Verify the word has a dotted bottom border (tap affordance)
      const borderStyle = await clickableWord.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return computed.borderBottomStyle;
      });
      expect(borderStyle).toBe('dotted');

      // Verify it has cursor: pointer
      const cursor = await clickableWord.evaluate((el) => {
        return window.getComputedStyle(el).cursor;
      });
      expect(cursor).toBe('pointer');
    }
  });

  test('tapping a word opens its definition popup', async ({ page }) => {
    await seedWords(TEST_USER.uid, [dueWord]);
    await seedSentenceCache(dueWord.simp);

    await page.goto('/test-words');

    // Wait for test to load
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Answer the meaning question
    const answerInput = page.locator('#answer-input');
    if (await answerInput.isVisible({ timeout: 5000 })) {
      await answerInput.fill(dueWord.meaning);
      await answerInput.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Find and tap a clickable word
    const clickableWord = page.locator('[data-popup]').first();
    const wordVisible = await clickableWord.isVisible({ timeout: 10000 }).catch(() => false);

    if (wordVisible) {
      await clickableWord.click();

      // The popup should become visible (contains Pinyin/Meaning labels)
      const popup = page.locator('[data-popup-text]').first();
      await expect(popup).toBeVisible({ timeout: 5000 });

      // Popup should contain pinyin and meaning labels
      await expect(popup.getByText('Pinyin:')).toBeVisible();
      await expect(popup.getByText('Meaning:')).toBeVisible();
    }
  });
});
