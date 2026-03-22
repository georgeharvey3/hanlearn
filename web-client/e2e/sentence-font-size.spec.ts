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

test.describe('Sentence character font size consistency', () => {
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

  test('target word and surrounding words have the same font size', async ({ page }) => {
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

    // Wait for sentence text to appear with clickable words
    const clickableWord = page.locator('[data-popup]').first();
    await expect(clickableWord).toBeVisible({ timeout: 10000 });

    // Get all font sizes: the target word (highlighted span) and clickable words
    const fontSizes = await page.evaluate(() => {
      const sizes: { element: string; fontSize: string }[] = [];

      // Find the sentence container (has lang="zh")
      const container = document.querySelector('[lang="zh"]');
      if (!container) return sizes;

      // Get computed font size of all direct child spans
      const children = container.querySelectorAll(':scope > span');
      children.forEach((child) => {
        const computed = window.getComputedStyle(child);
        sizes.push({
          element: child.textContent?.slice(0, 10) || 'unknown',
          fontSize: computed.fontSize,
        });
      });

      return sizes;
    });

    // All elements should have the same computed font size
    expect(fontSizes.length).toBeGreaterThanOrEqual(2);
    const firstSize = fontSizes[0].fontSize;
    for (const entry of fontSizes) {
      expect(entry.fontSize).toBe(firstSize);
    }
  });
});
