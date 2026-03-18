import { test, expect } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
  seedChengyuSentence,
  loginViaUI,
  configureTestSettings,
} from './fixtures/seed';
import { DashboardPage } from './pages/dashboard.page';

test.describe('Chengyu daily challenge', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await seedTestUser();
    await configureTestSettings(page);
    await loginViaUI(page);
  });

  test('daily chengyu challenge loads', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.navigateTo();

    // Should show "Chengyu Of The Day" heading
    await expect(page.getByText('Chengyu Of The Day')).toBeVisible({ timeout: 10000 });

    // Should show "Choose the correct translation"
    await expect(page.getByText('Choose the correct translation:')).toBeVisible();

    // Should have answer options
    const options = await dashboard.getChengyuOptions();
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  test('selecting correct answer reveals character breakdown', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.navigateTo();

    // Wait for chengyu to load
    await expect(page.getByText('Chengyu Of The Day')).toBeVisible({ timeout: 10000 });

    // Solve the chengyu by trying options
    const correctIndex = await dashboard.solveChengyu();
    expect(correctIndex).toBeGreaterThanOrEqual(0);

    // Character breakdown should be visible
    await expect(page.locator('[aria-label="Character breakdown"]')).toBeVisible();
  });

  test('wrong answer shows feedback', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.navigateTo();

    await expect(page.getByText('Chengyu Of The Day')).toBeVisible({ timeout: 10000 });

    // Get all options
    const options = page.locator('[aria-label="Answer options"] [role="button"]');
    const count = await options.count();

    // Try the first option
    await options.first().click();
    await page.waitForTimeout(500);

    // Check if it was wrong (breakdown not visible) — if so, verify the option got styled as incorrect
    const revealed = await dashboard.isChengyuRevealed();
    if (!revealed) {
      // The wrong option should have an "incorrect" aria-label
      const incorrectOption = page.locator('[aria-label*="incorrect"]');
      await expect(incorrectOption.first()).toBeVisible();
    }
    // If it was correct on first try, that's also fine — the test still passes
  });

  test('save chengyu to word bank after solving', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.navigateTo();

    await expect(page.getByText('Chengyu Of The Day')).toBeVisible({ timeout: 10000 });

    // Solve the chengyu
    await dashboard.solveChengyu();

    // Should see "Save to my words" button after solving
    const saveButton = page.getByRole('button', { name: /Save to my words/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });

    // Click save
    await saveButton.click();

    // Button should change to "Saved!"
    await expect(page.getByRole('button', { name: /Saved!/i })).toBeVisible({ timeout: 5000 });
  });

  test('example sentence appears after solving when cached', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.navigateTo();

    await expect(page.getByText('Chengyu Of The Day')).toBeVisible({ timeout: 10000 });

    // Read the displayed chengyu characters from the page
    const chengyuChars = await dashboard.getChengyuCharacters();
    expect(chengyuChars).toBeTruthy();

    // Seed an example sentence for this chengyu in Firestore
    await seedChengyuSentence(chengyuChars, {
      chinese: `这是一个使用${chengyuChars}的例句。`,
      pinyin: 'Zhè shì yí gè shǐyòng chéngyǔ de lì jù.',
      english: 'This is an example sentence using the chengyu.',
    });

    // Solve the chengyu — this triggers the sentence fetch
    await dashboard.solveChengyu();

    // Example sentence should appear with the "Example" label
    await expect(page.getByText('Example')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`这是一个使用${chengyuChars}的例句。`)).toBeVisible();
    await expect(page.getByText('This is an example sentence using the chengyu.')).toBeVisible();
  });
});
