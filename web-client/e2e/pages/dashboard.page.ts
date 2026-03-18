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
   * Get the character breakdown items after the chengyu is revealed.
   * Returns character + pinyin + meaning for each character.
   */
  async getChengyuCharacterBreakdown(): Promise<
    { char: string; pinyin: string; meaning: string }[]
  > {
    const breakdown = this.page.locator('[aria-label="Character breakdown"]');
    await expect(breakdown).toBeVisible({ timeout: 5000 });

    const items = breakdown.locator(':scope > li');
    const count = await items.count();
    const results: { char: string; pinyin: string; meaning: string }[] = [];

    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      // Character items have lang="zh" on the first Typography
      const charEl = item.locator('[lang="zh"]');
      if ((await charEl.count()) === 0) continue;

      const char = ((await charEl.first().textContent()) || '').trim();
      const pinyinEl = item.locator('[lang="zh-Latn"]');
      const pinyin = ((await pinyinEl.textContent()) || '').trim();

      // Meaning is the third Typography (italic style) if present
      const allTypos = item.locator('.MuiTypography-root');
      const typoCount = await allTypos.count();
      let meaning = '';
      if (typoCount >= 3) {
        meaning = ((await allTypos.nth(2).textContent()) || '').trim();
      }

      results.push({ char, pinyin, meaning });
    }

    return results;
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
