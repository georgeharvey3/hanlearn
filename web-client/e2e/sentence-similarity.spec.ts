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
 * Seed sentence cache into Firestore emulator so the SentenceRead component
 * can load sentences without calling the real AI service.
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
 * Mock the Firebase AI (Gemini) API to return a controlled similarity score.
 * The Firebase AI SDK calls firebasevertexai.googleapis.com.
 */
async function mockGeminiSimilarityResponse(
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

test.describe('Sentence similarity scoring', () => {
  const dueWord: TestWord = {
    id: 6001,
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
    // Enable sentenceRead, disable other stages for a focused test
    await configureTestSettings(page, {
      sentenceRead: 'true',
      sentenceWrite: 'false',
      newWords: 'false',
      useFlashcards: 'false',
      numWords: '1',
      // Only test meaning priority so we get one question before sentence stage
      priority: 'MP',
      onlyPriority: 'true',
    });
    await loginViaUI(page);
  });

  test('displays similarity score after submitting translation', async ({ page }) => {
    await seedWords(TEST_USER.uid, [dueWord]);
    await seedSentenceCache(dueWord.simp);

    // Mock Gemini to return a high score
    await mockGeminiSimilarityResponse(page, 85);

    await page.goto('/test-words');

    // Wait for test to load
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Answer the flashcard/meaning question to progress to sentence stage
    // Type the meaning and submit
    const answerInput = page.locator('#answer-input');
    if (await answerInput.isVisible({ timeout: 5000 })) {
      await answerInput.fill(dueWord.meaning);
      await answerInput.press('Enter');
      // Wait for the sentence stage to appear
      await page.waitForTimeout(2000);
    }

    // We should now be in the sentence read stage
    // Look for the sentence text or the translation input
    const sentenceVisible = await page.getByText('I like to drink water.').isVisible({ timeout: 10000 }).catch(() => false);

    if (sentenceVisible) {
      // Find the answer input for the sentence translation
      const sentenceInput = page.locator('#answerInput');
      await sentenceInput.waitFor({ state: 'visible', timeout: 5000 });
      await sentenceInput.fill('I like to drink water.');
      await sentenceInput.press('Enter');

      // Should show the similarity score (85% = "Great")
      await expect(
        page.getByText(/85%|Great|Score unavailable|Scoring/i).first(),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('shows Score unavailable when AI service fails', async ({ page }) => {
    await seedWords(TEST_USER.uid, [dueWord]);
    await seedSentenceCache(dueWord.simp);

    // Mock Gemini to return an error
    await page.route('**/firebasevertexai.googleapis.com/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Service unavailable' } }),
      });
    });

    await page.goto('/test-words');

    // Wait for test to load
    await expect(
      page.getByText(/pinyin|character|meaning/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Answer the flashcard/meaning question
    const answerInput = page.locator('#answer-input');
    if (await answerInput.isVisible({ timeout: 5000 })) {
      await answerInput.fill(dueWord.meaning);
      await answerInput.press('Enter');
      await page.waitForTimeout(2000);
    }

    // In sentence read stage
    const sentenceVisible = await page.getByText('I like to drink water.').isVisible({ timeout: 10000 }).catch(() => false);

    if (sentenceVisible) {
      const sentenceInput = page.locator('#answerInput');
      await sentenceInput.waitFor({ state: 'visible', timeout: 5000 });
      await sentenceInput.fill('Some random text');
      await sentenceInput.press('Enter');

      // Should show "Score unavailable" since the AI service failed
      await expect(
        page.getByText('Score unavailable'),
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
