import { test, expect } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
  seedWords,
  loginViaUI,
  TEST_USER,
  TestWord,
} from './fixtures/seed';

/**
 * Mock webkitSpeechRecognition that fires audiostart (showing "Listening...")
 * so we can verify whether recognition is triggered or not.
 */
const SPEECH_RECOGNITION_MOCK = `
  window.__speechRecognitionStarted = false;
  window.webkitSpeechRecognition = class MockSpeechRecognition {
    lang = '';
    _listeners = {};

    addEventListener(event, fn) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(fn);
    }
    removeEventListener(event, fn) {
      if (this._listeners[event]) {
        this._listeners[event] = this._listeners[event].filter(l => l !== fn);
      }
    }
    start() {
      window.__speechRecognitionStarted = true;
      // Fire audiostart so the UI shows "Listening..."
      setTimeout(() => {
        if (this._listeners['audiostart']) {
          this._listeners['audiostart'].forEach(fn => fn());
        }
      }, 50);
    }
    stop() {}
    abort() {}
  };
`;

const dueWords: TestWord[] = [
  {
    id: 6001,
    simp: '大',
    trad: '大',
    pinyin: 'da4',
    meaning: 'big',
    bank: 1,
    dueDate: new Date(Date.now() - 86400000),
  },
  {
    id: 6002,
    simp: '小',
    trad: '小',
    pinyin: 'xiao3',
    meaning: 'small',
    bank: 1,
    dueDate: new Date(Date.now() - 86400000),
  },
];

test.describe('Speech recognition respects disabled setting', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await seedWords(TEST_USER.uid, dueWords);
  });

  test('does not auto-record when Chinese speech recognition is disabled', async ({ page }) => {
    // Inject mock speech recognition API + configure settings
    await page.addInitScript(SPEECH_RECOGNITION_MOCK);
    await page.addInitScript(() => {
      // Enable auto-record but disable Chinese speech recognition
      localStorage.setItem('useAutoRecord', 'true');
      localStorage.setItem('useChineseSpeechRecognition', 'false');
      localStorage.setItem('useEnglishSpeechRecognition', 'false');
      localStorage.setItem('useFlashcards', 'false');
      localStorage.setItem('useSound', 'false');
      localStorage.setItem('useHandwriting', 'false');
      localStorage.setItem('useSoundEffects', 'false');
      // Force pinyin-answer questions
      localStorage.setItem('priority', 'PM');
      localStorage.setItem('onlyPriority', 'true');
      localStorage.setItem('sentenceRead', 'false');
      localStorage.setItem('sentenceWrite', 'false');
      localStorage.setItem('newWords', 'false');
      localStorage.setItem('charSet', 'simp');
      localStorage.setItem('numWords', '2');
    });

    await loginViaUI(page);
    await page.goto('/test-words');

    // Wait for test to load — should see a text input (not mic) since speech is disabled
    await expect(page.locator('#answer-input')).toBeVisible({ timeout: 15000 });

    // Verify "Listening..." never appeared
    await expect(page.getByText('Listening...')).not.toBeVisible();

    // Verify the mock's start() was never called
    const started = await page.evaluate(() => (window as any).__speechRecognitionStarted);
    expect(started).toBe(false);
  });

  test('shows text input instead of mic button when speech recognition is disabled', async ({
    page,
  }) => {
    // Inject mock speech recognition API + configure settings
    await page.addInitScript(SPEECH_RECOGNITION_MOCK);
    await page.addInitScript(() => {
      localStorage.setItem('useAutoRecord', 'false');
      localStorage.setItem('useChineseSpeechRecognition', 'false');
      localStorage.setItem('useEnglishSpeechRecognition', 'false');
      localStorage.setItem('useFlashcards', 'false');
      localStorage.setItem('useSound', 'false');
      localStorage.setItem('useHandwriting', 'false');
      localStorage.setItem('useSoundEffects', 'false');
      localStorage.setItem('priority', 'PM');
      localStorage.setItem('onlyPriority', 'true');
      localStorage.setItem('sentenceRead', 'false');
      localStorage.setItem('sentenceWrite', 'false');
      localStorage.setItem('newWords', 'false');
      localStorage.setItem('charSet', 'simp');
      localStorage.setItem('numWords', '2');
    });

    await loginViaUI(page);
    await page.goto('/test-words');

    // Should show text input for pinyin answer (not mic input)
    await expect(page.locator('#answer-input')).toBeVisible({ timeout: 15000 });

    // Should NOT show "Speak the" prompt — should show "Enter the" instead
    await expect(page.getByText(/Enter the/)).toBeVisible();
  });

  test('auto-records when Chinese speech recognition is enabled', async ({ page }) => {
    // Inject mock speech recognition API + configure settings
    await page.addInitScript(SPEECH_RECOGNITION_MOCK);
    await page.addInitScript(() => {
      localStorage.setItem('useAutoRecord', 'true');
      localStorage.setItem('useChineseSpeechRecognition', 'true');
      localStorage.setItem('useEnglishSpeechRecognition', 'false');
      localStorage.setItem('useFlashcards', 'false');
      localStorage.setItem('useSound', 'false');
      localStorage.setItem('useHandwriting', 'false');
      localStorage.setItem('useSoundEffects', 'false');
      // PM = Pinyin answer, Meaning question; pinyin answers use Chinese speech recognition
      localStorage.setItem('priority', 'PM');
      localStorage.setItem('onlyPriority', 'true');
      localStorage.setItem('sentenceRead', 'false');
      localStorage.setItem('sentenceWrite', 'false');
      localStorage.setItem('newWords', 'false');
      localStorage.setItem('charSet', 'simp');
      localStorage.setItem('numWords', '2');
    });

    await loginViaUI(page);
    await page.goto('/test-words');

    // Wait for auto-record to trigger — "Listening..." should appear
    await expect(page.getByText('Listening...')).toBeVisible({ timeout: 15000 });

    // Verify the mock's start() was called
    const started = await page.evaluate(() => (window as any).__speechRecognitionStarted);
    expect(started).toBe(true);
  });
});
