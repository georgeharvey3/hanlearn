/**
 * Seed helpers for e2e tests.
 * All e2e tests should use the Firebase emulator (localhost:9099 / localhost:8082).
 * Call seedTestUser() in beforeEach to get a fresh authenticated user.
 */

import { Page } from '@playwright/test';

export const TEST_USER = {
  email: 'testuser@hanlearn.test',
  password: 'testpassword123',
  uid: 'e2e-test-user',
};

const AUTH_EMULATOR = 'http://localhost:9099';
const FIRESTORE_EMULATOR = 'http://localhost:8082';
const PROJECT_ID = 'hanlearn-dd14f';

/**
 * Returns the Firestore emulator REST API URL for a given document path.
 */
export function emulatorFirestoreUrl(path: string): string {
  return `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

/**
 * Clear all data from Auth and Firestore emulators.
 */
export async function clearEmulatorData(): Promise<void> {
  // Clear Firestore
  await fetch(
    `${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  // Clear Auth
  await fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });
}

/**
 * Create a test user in the Auth emulator and a corresponding Firestore user document.
 */
export async function seedTestUser(): Promise<void> {
  // Create user in Auth emulator via admin batchCreate (supports localId for deterministic UID)
  const signUpRes = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchCreate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer owner',
      },
      body: JSON.stringify({
        users: [
          {
            localId: TEST_USER.uid,
            email: TEST_USER.email,
            rawPassword: TEST_USER.password,
          },
        ],
      }),
    },
  );
  if (!signUpRes.ok) {
    throw new Error(`Failed to seed test user: ${await signUpRes.text()}`);
  }

  // Create user document in Firestore (use Bearer owner to bypass security rules)
  await fetch(emulatorFirestoreUrl(`users/${TEST_USER.uid}?documentId=${TEST_USER.uid}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
    body: JSON.stringify({
      fields: {
        email: { stringValue: TEST_USER.email },
        username: { stringValue: 'testuser' },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
}

export interface TestWord {
  id: number;
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
  bank?: number;
  dueDate?: Date;
  listId?: string;
}

/**
 * A set of known test words with predictable data for testing.
 */
export const TEST_WORDS: TestWord[] = [
  { id: 1001, simp: '你好', trad: '你好', pinyin: 'ni3 hao3', meaning: 'hello' },
  { id: 1002, simp: '谢谢', trad: '謝謝', pinyin: 'xie4 xie4', meaning: 'thank you' },
  { id: 1003, simp: '学习', trad: '學習', pinyin: 'xue2 xi2', meaning: 'to study' },
];

/**
 * Seed words into the Firestore emulator for the test user.
 */
export async function seedWords(
  userId: string,
  words: TestWord[],
): Promise<void> {
  for (const word of words) {
    const dueDate = word.dueDate || new Date();
    const bank = word.bank || 1;
    const listId = word.listId || 'default';

    const url = emulatorFirestoreUrl(`users/${userId}/userWords/${word.id}`);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
      body: JSON.stringify({
        fields: {
          wordId: { stringValue: word.id.toString() },
          wordData: {
            mapValue: {
              fields: {
                simp: { stringValue: word.simp },
                trad: { stringValue: word.trad },
                pinyin: { stringValue: word.pinyin },
                meaning: { stringValue: word.meaning },
              },
            },
          },
          amendedMeaning: { nullValue: null },
          bank: { integerValue: bank.toString() },
          dueDate: { timestampValue: dueDate.toISOString() },
          addedAt: { timestampValue: new Date().toISOString() },
          listId: { stringValue: listId },
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to seed word ${word.simp}: ${await res.text()}`);
    }
  }
}

/**
 * Read a word document from Firestore emulator to verify test results.
 */
export async function readWordFromFirestore(
  userId: string,
  wordId: number,
): Promise<{ level: number; dueDate: string } | null> {
  const url = emulatorFirestoreUrl(`users/${userId}/userWords/${wordId}`);
  const res = await fetch(url, { headers: { 'Authorization': 'Bearer owner' } });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    level: parseInt(data.fields.bank.integerValue, 10),
    dueDate: data.fields.dueDate.timestampValue,
  };
}

/**
 * Log in via the UI. Opens the auth modal, fills credentials, and submits.
 */
export async function loginViaUI(page: Page): Promise<void> {
  await page.goto('/');

  // Click the "Login" button in the toolbar (single word, no space)
  const loginButton = page.getByRole('button', { name: /^Login$/i });
  await loginButton.click();

  // Wait for the auth modal to appear (should open in login mode with "Welcome Back")
  await page.locator('input[placeholder="Email"]').waitFor({ state: 'visible', timeout: 5000 });

  // Fill login form
  await page.locator('input[placeholder="Email"]').fill(TEST_USER.email);
  await page.locator('input[placeholder="Password"]').fill(TEST_USER.password);

  // Submit — the modal button says "Log In" (with space)
  await page.getByRole('button', { name: 'Log In' }).click();

  // Wait for authenticated state — nav should show Dashboard/Add Words links
  await page.getByText(/Dashboard|Add Words/i).first().waitFor({ timeout: 10000 });
}

/**
 * Set localStorage settings to simplify test sessions.
 * Disables sentence stages and speech features for predictable E2E testing.
 */
export async function configureTestSettings(page: Page, overrides: Record<string, string> = {}): Promise<void> {
  await page.addInitScript((settings) => {
    // Disable speech features (Playwright Chromium doesn't support Web Speech API)
    localStorage.setItem('useSound', 'false');
    localStorage.setItem('useChineseSpeechRecognition', 'false');
    localStorage.setItem('useEnglishSpeechRecognition', 'false');
    // Disable handwriting — HanziWriter is not available in headless Chromium
    localStorage.setItem('useHandwriting', 'false');
    // Use flashcard mode with meaning-only answers for reliable E2E test flow
    // (flashcard "I knew this" / "I didn't know this" buttons reliably advance the test)
    localStorage.setItem('useFlashcards', 'true');
    localStorage.setItem('priority', 'MP');
    localStorage.setItem('onlyPriority', 'true');
    // Disable sentence stages for simpler test flow
    localStorage.setItem('sentenceRead', 'false');
    localStorage.setItem('sentenceWrite', 'false');
    localStorage.setItem('newWords', 'false');
    // Use simplified character set
    localStorage.setItem('charSet', 'simp');
    // Apply overrides
    for (const [key, value] of Object.entries(settings)) {
      localStorage.setItem(key, value);
    }
  }, overrides);
}
