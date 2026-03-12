import { Page, Locator, expect } from '@playwright/test';

export class AddWordsPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('#addInput');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
  }

  async navigateTo(): Promise<void> {
    await this.page.goto('/add-words');
  }

  async searchWord(text: string): Promise<void> {
    await this.searchInput.fill(text);
    await this.submitButton.click();
  }

  async confirmAddWord(): Promise<void> {
    // Wait for the "Add to Word Bank?" modal
    await expect(this.page.getByText('Add to Word Bank?')).toBeVisible({ timeout: 10000 });
    await this.page.getByRole('button', { name: 'Add' }).click();
  }

  async selectClashEntry(index: number): Promise<void> {
    // When multiple entries match, a table appears
    const rows = this.page.locator('table tbody tr, [role="row"]');
    await rows.nth(index).click();
  }

  async getWordBankItems(): Promise<Locator> {
    // Show the word table if hidden
    const showTableBtn = this.page.getByRole('button', { name: /show table/i });
    if (await showTableBtn.isVisible()) {
      await showTableBtn.click();
    }
    return this.page.locator('[class*="wordCard"], [class*="WordCard"]').or(
      this.page.locator('table tbody tr'),
    );
  }

  async expectWordVisible(character: string): Promise<void> {
    await expect(this.page.getByText(character, { exact: false })).toBeVisible({ timeout: 10000 });
  }

  async expectWordNotVisible(character: string): Promise<void> {
    await expect(this.page.getByText(character, { exact: false })).not.toBeVisible();
  }
}
