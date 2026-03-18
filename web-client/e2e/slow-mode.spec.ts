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

/**
 * Seed a sentence cache entry in Firestore emulator so SentenceRead can load
 * without hitting a real AI service.
 *
 * The sentenceCache stores SentenceExample objects:
 *   { chinese: string, english: string, segments: string[], targetIndex: number }
 */
async function seedSentenceCache(word: string): Promise<void> {
  const FIRESTORE_EMULATOR = 'http://localhost:8082';
  const PROJECT_ID = 'hanlearn-dd14f';
  const url = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/sentenceCache/${word}`;

  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({
      fields: {
        sentences: {
          arrayValue: {
            values: [
              {
                mapValue: {
                  fields: {
                    chinese: { stringValue: `我很${word}。` },
                    english: { stringValue: 'I am very good.' },
                    segments: {
                      arrayValue: {
                        values: [
                          { stringValue: '我' },
                          { stringValue: '很' },
                          { stringValue: word },
                          { stringValue: '。' },
                        ],
                      },
                    },
                    targetIndex: { integerValue: '2' },
                  },
                },
              },
            ],
          },
        },
      },
    }),
  });
}

/**
 * Intercept the Cloud Functions callable endpoint for textToSpeech and
 * return a fake base64-encoded MP3 response. This makes the component
 * set googleTtsAvailable=true so the slow mode button renders.
 */
async function mockTextToSpeechFunction(page: import('@playwright/test').Page): Promise<void> {
  // Minimal valid MP3 frame (a silent 0.1s) encoded as base64
  const FAKE_AUDIO_BASE64 =
    'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYlNuq8AAAAAAAAAAAAAAAAAAAAAP/7UMQAA';

  await page.route('**/textToSpeech', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: { audioContent: FAKE_AUDIO_BASE64 },
      }),
    });
  });
}

test.describe('Slow mode toggle', () => {
  const dueWord: TestWord = {
    id: 7001,
    simp: '好',
    trad: '好',
    pinyin: 'hao3',
    meaning: 'good',
    bank: 1,
    dueDate: new Date(Date.now() - 86400000),
  };

  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await seedSentenceCache('好');

    // Mock speechSynthesis.getVoices() so the app detects a Chinese voice and
    // sets synthAvailable=true (headless Chromium has no voices by default).
    await page.addInitScript(() => {
      const fakeVoice = {
        name: 'Google 普通话',
        lang: 'zh-CN',
        localService: false,
        default: false,
        voiceURI: 'Google 普通话',
      };

      window.speechSynthesis.getVoices = () => [fakeVoice as SpeechSynthesisVoice];
      // Fire voiceschanged so the app picks up the fake voice
      window.speechSynthesis.dispatchEvent(new Event('voiceschanged'));
    });

    // Enable sound and sentenceRead for the slow mode test
    await configureTestSettings(page, {
      useSound: 'true',
      sentenceRead: 'true',
      sentenceWrite: 'false',
      numWords: '1',
    });
    await mockTextToSpeechFunction(page);
    await loginViaUI(page);
    await seedWords(TEST_USER.uid, [dueWord]);
  });

  test('slow mode toggle appears and persists state to localStorage', async ({ page }) => {
    await page.goto('/test-words');

    // Complete the vocab/flashcard stage first to reach SentenceRead
    const showAnswer = page.getByRole('button', { name: 'Show Answer' });
    await expect(showAnswer).toBeVisible({ timeout: 20000 });
    await showAnswer.click();
    const like = page.locator('[aria-label="I knew this"]');
    await expect(like).toBeVisible({ timeout: 5000 });
    await like.click();

    // Wait for the SentenceRead stage to load — look for "Listen & translate"
    await expect(page.getByText(/listen.*translate/i)).toBeVisible({ timeout: 20000 });

    // The slow mode toggle button should appear once Google TTS responds
    const slowToggle = page.getByRole('button', { name: /toggle slow mode/i });
    await expect(slowToggle).toBeVisible({ timeout: 10000 });

    // Initially off
    await expect(slowToggle).toHaveAttribute('aria-pressed', 'false');

    // Click to enable slow mode
    await slowToggle.click();
    await expect(slowToggle).toHaveAttribute('aria-pressed', 'true');

    // Verify localStorage was updated
    const stored = await page.evaluate(() => localStorage.getItem('slowMode'));
    expect(stored).toBe('true');

    // Click again to disable
    await slowToggle.click();
    await expect(slowToggle).toHaveAttribute('aria-pressed', 'false');

    const storedAfter = await page.evaluate(() => localStorage.getItem('slowMode'));
    expect(storedAfter).toBe('false');
  });

  test('slow mode initialises from localStorage on page load', async ({ page }) => {
    // Pre-set slowMode in localStorage before navigating
    await page.addInitScript(() => {
      localStorage.setItem('slowMode', 'true');
    });

    await page.goto('/test-words');

    // Complete the vocab/flashcard stage first to reach SentenceRead
    const showAnswer = page.getByRole('button', { name: 'Show Answer' });
    await expect(showAnswer).toBeVisible({ timeout: 20000 });
    await showAnswer.click();
    const like = page.locator('[aria-label="I knew this"]');
    await expect(like).toBeVisible({ timeout: 5000 });
    await like.click();

    await expect(page.getByText(/listen.*translate/i)).toBeVisible({ timeout: 20000 });

    const slowToggle = page.getByRole('button', { name: /toggle slow mode/i });
    await expect(slowToggle).toBeVisible({ timeout: 10000 });

    // Should be initialised as pressed from localStorage
    await expect(slowToggle).toHaveAttribute('aria-pressed', 'true');
  });
});
