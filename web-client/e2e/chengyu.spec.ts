import { test, expect } from '@playwright/test';
import {
  clearEmulatorData,
  seedTestUser,
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
    await dashboard.expectChengyuVisible();

    const options = await dashboard.getChengyuOptions();
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  test('an answer reveals the meaning and a gloss for each character', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.navigateTo();
    await dashboard.expectChengyuVisible();

    await dashboard.answerChengyu(0);

    await expect(page.getByText(/^(Correct|It means)$/)).toBeVisible();
  });

  test('the answer stays revealed on a return visit the same day', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.navigateTo();
    await dashboard.answerChengyu(0);

    await page.reload();
    await dashboard.expectChengyuVisible();
    await expect(page.getByText(/^(Correct|It means)$/)).toBeVisible();
    await expect(page.getByText('What does it mean?')).toBeHidden();
  });

  test('save chengyu to word list after answering', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.navigateTo();
    await dashboard.answerChengyu(0);

    const saveButton = page.getByRole('button', { name: 'Add to my words' });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    await expect(page.getByRole('button', { name: 'Added' })).toBeVisible({ timeout: 5000 });
  });
});
