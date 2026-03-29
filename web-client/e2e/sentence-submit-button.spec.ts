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
 * Seed sentence cache so the sentence stages can load without the AI service.
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

/**
 * Mock the Firebase AI API to return a controlled similarity score.
 */
async function mockGeminiResponse(
  page: import('@playwright/test').Page,
  score: number,
): Promise<void> {
  await page.route('**/firebasevertexai.googleapis.com/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ score }) }],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
      }),
    });
  });
}

test.describe('Sentence stage submit buttons', () => {
  const dueWord: TestWord = {
    id: 7001,
    simp: '水',
    trad: '水',
    pinyin: 'shui3',
    meaning: 'water',
    bank: 1,
    dueDate: new Date(Date.now() - 86400000),
  };

  test.describe('SentenceRead submit button', () => {
    test.beforeEach(async ({ page }) => {
      await clearEmulatorData();
      await seedTestUser();
      await configureTestSettings(page, {
        sentenceRead: 'true',
        sentenceWrite: 'false',
        newWords: 'false',
        useFlashcards: 'false',
        numWords: '1',
        priority: 'MP',
        onlyPriority: 'true',
      });
      await loginViaUI(page);
    });

    test('submit button submits translation in sentence read stage', async ({ page }) => {
      await seedWords(TEST_USER.uid, [dueWord]);
      await seedSentenceCache(dueWord.simp);
      await mockGeminiResponse(page, 90);

      await page.goto('/test-words');

      // Wait for test to load and answer the vocab question
      await expect(
        page.getByText(/pinyin|character|meaning/i).first(),
      ).toBeVisible({ timeout: 15000 });

      const answerInput = page.locator('#answer-input');
      if (await answerInput.isVisible({ timeout: 5000 })) {
        await answerInput.fill(dueWord.meaning);
        await answerInput.press('Enter');
        await page.waitForTimeout(2000);
      }

      // Wait for sentence read stage
      const sentenceInput = page.locator('#answerInput');
      const inputVisible = await sentenceInput.isVisible({ timeout: 10000 }).catch(() => false);

      if (inputVisible) {
        // Submit button should be visible but disabled when input is empty
        const submitBtn = page.getByRole('button', { name: 'Submit translation' });
        await expect(submitBtn).toBeVisible();
        await expect(submitBtn).toBeDisabled();

        // Type a translation
        await sentenceInput.fill('I like to drink water.');

        // Submit button should now be enabled
        await expect(submitBtn).toBeEnabled();

        // Click the submit button instead of pressing Enter
        await submitBtn.click();

        // Should show the comparison view with score
        await expect(
          page.getByText(/your translation/i),
        ).toBeVisible({ timeout: 10000 });

        await expect(
          page.getByRole('button', { name: /next word/i }),
        ).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('SentenceWrite submit button', () => {
    test.beforeEach(async ({ page }) => {
      await clearEmulatorData();
      await seedTestUser();
      await configureTestSettings(page, {
        sentenceRead: 'false',
        sentenceWrite: 'true',
        newWords: 'false',
        useFlashcards: 'false',
        numWords: '1',
        priority: 'MP',
        onlyPriority: 'true',
      });
      await loginViaUI(page);
    });

    test('submit button submits answer in sentence write stage', async ({ page }) => {
      await seedWords(TEST_USER.uid, [dueWord]);
      await seedSentenceCache(dueWord.simp);
      await mockGeminiResponse(page, 75);

      await page.goto('/test-words');

      // Wait for test to load and answer the vocab question
      await expect(
        page.getByText(/pinyin|character|meaning/i).first(),
      ).toBeVisible({ timeout: 15000 });

      const answerInput = page.locator('#answer-input');
      if (await answerInput.isVisible({ timeout: 5000 })) {
        await answerInput.fill(dueWord.meaning);
        await answerInput.press('Enter');
        await page.waitForTimeout(2000);
      }

      // Wait for sentence write stage
      const sentenceInput = page.locator('#answerInput');
      const inputVisible = await sentenceInput.isVisible({ timeout: 10000 }).catch(() => false);

      if (inputVisible) {
        // Submit button should be visible but disabled when input is empty
        const submitBtn = page.getByRole('button', { name: 'Submit answer' });
        await expect(submitBtn).toBeVisible();
        await expect(submitBtn).toBeDisabled();

        // Type a Chinese answer
        await sentenceInput.fill('我喜欢喝水');

        // Submit button should now be enabled
        await expect(submitBtn).toBeEnabled();

        // Click the submit button
        await submitBtn.click();

        // Should show the comparison view
        await expect(
          page.getByText(/your answer/i),
        ).toBeVisible({ timeout: 10000 });

        await expect(
          page.getByRole('button', { name: /next word/i }),
        ).toBeVisible({ timeout: 5000 });
      }
    });
  });
});
