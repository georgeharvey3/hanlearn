import { Page, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigateTo(): Promise<void> {
    await this.page.goto('/');
  }

  async expectDashboardVisible(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
      timeout: 10000,
    });
  }

  async getChengyuHeading(): Promise<string> {
    const heading = this.page.getByText('Chengyu Of The Day');
    await expect(heading).toBeVisible({ timeout: 10000 });
    return (await heading.textContent()) || '';
  }

  async getChengyuOptions(): Promise<string[]> {
    const options = this.page.locator('[aria-label="Answer options"] [role="button"]');
    await options.first().waitFor({ state: 'visible', timeout: 10000 });
    const count = await options.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text) texts.push(text.trim());
    }
    return texts;
  }

  async clickChengyuOption(index: number): Promise<void> {
    const options = this.page.locator('[aria-label="Answer options"] [role="button"]');
    await options.nth(index).click();
  }

  async isChengyuRevealed(): Promise<boolean> {
    return this.page.locator('[aria-label="Character breakdown"]').isVisible();
  }

  /**
   * Try each chengyu option until the correct one is found.
   * Returns the index of the correct option.
   */
  async solveChengyu(): Promise<number> {
    const options = this.page.locator('[aria-label="Answer options"] [role="button"]');
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const isDisabled = await options.nth(i).getAttribute('aria-disabled');
      if (isDisabled) continue;

      await options.nth(i).click();
      // Check if character breakdown appeared (means correct)
      await this.page.waitForTimeout(500);
      const revealed = await this.isChengyuRevealed();
      if (revealed) return i;
    }
    return -1;
  }
}
