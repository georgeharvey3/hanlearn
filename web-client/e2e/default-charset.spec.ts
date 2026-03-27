import { test, expect } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
  seedWords,
  loginViaUI,
  TEST_USER,
  TEST_WORDS,
} from './fixtures/seed';

test.describe('Default character set is Traditional', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
  });

  test('Settings page shows Traditional as the default character set', async ({ page }) => {
    // Do NOT call configureTestSettings — we want pristine localStorage
    await loginViaUI(page);
    await page.goto('/settings');

    const tradRadio = page.getByRole('radio', { name: 'Traditional' });
    await expect(tradRadio).toBeChecked();

    const simpRadio = page.getByRole('radio', { name: 'Simplified' });
    await expect(simpRadio).not.toBeChecked();
  });

  test('word list displays traditional characters by default', async ({ page }) => {
    // Seed words that have different simp/trad forms
    await seedWords(TEST_USER.uid, TEST_WORDS);

    // Login without configureTestSettings to keep default charSet
    await loginViaUI(page);
    await page.goto('/add-words');

    // TEST_WORDS[1] is 谢谢/謝謝 — these differ between simp and trad
    // With trad as default, we should see the traditional form
    await expect(page.getByText('謝謝').first()).toBeVisible({ timeout: 10000 });
  });

  test('user can switch to Simplified in settings and it persists', async ({ page }) => {
    await seedWords(TEST_USER.uid, TEST_WORDS);
    await loginViaUI(page);
    await page.goto('/settings');

    // Switch to Simplified
    const simpRadio = page.getByRole('radio', { name: 'Simplified' });
    await simpRadio.click();
    await expect(simpRadio).toBeChecked();

    // Navigate to add-words to verify simplified characters are shown
    await page.goto('/add-words');
    await expect(page.getByText('谢谢').first()).toBeVisible({ timeout: 10000 });
  });
});
