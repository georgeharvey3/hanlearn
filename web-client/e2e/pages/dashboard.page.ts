import { Page, expect, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigateTo(): Promise<void> {
    await this.page.goto('/');
  }

  async expectDashboardVisible(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Today' })).toBeVisible({
      timeout: 10000,
    });
  }

  /** The chengyu widget, under its "Chengyu" label. */
  chengyuCard(): Locator {
    return this.page.getByRole('region', { name: 'Chengyu' });
  }

  async expectChengyuVisible(): Promise<void> {
    await expect(this.page.getByText('今日成语')).toBeVisible({ timeout: 10000 });
  }

  /** The answer options, while the quiz is still asking. */
  chengyuOptions(): Locator {
    return this.chengyuCard().getByRole('button');
  }

  async getChengyuOptions(): Promise<string[]> {
    await expect(this.page.getByText('What does it mean?')).toBeVisible({ timeout: 10000 });
    return (await this.chengyuOptions().allTextContents()).map((t) => t.trim());
  }

  /** Answer the quiz with one option. Any answer reveals the meaning. */
  async answerChengyu(index = 0): Promise<void> {
    await this.getChengyuOptions();
    await this.chengyuOptions().nth(index).click();
    await expect(this.page.getByText('What does it mean?')).toBeHidden();
  }
}
