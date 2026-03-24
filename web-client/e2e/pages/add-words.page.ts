import { Page, Locator, expect } from '@playwright/test';

export class AddWordsPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('#addInput');
    this.submitButton = page.getByRole('button', { name: 'Search' });
  }

  async navigateTo(): Promise<void> {
    await this.page.goto('/add-words');
  }

  async searchWord(text: string): Promise<void> {
    await this.searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.searchInput.fill(text);
    // Submit via Enter key on the input (triggers form submission)
    await this.searchInput.press('Enter');
    // Cloud Functions dictionary search may take time on first call
    await this.page.waitForTimeout(3000);
  }

  async confirmAddWord(): Promise<void> {
    // Wait for the "Add to Word List?" modal
    await expect(this.page.getByText('Add to Word List?')).toBeVisible({ timeout: 10000 });
    // Two buttons named "Add" exist: the "+ Add" meaning chip and the confirm button.
    // The confirm button is the last one.
    await this.page.getByRole('button', { name: 'Add', exact: true }).last().click();
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
    await expect(this.page.getByText(character, { exact: true }).first()).toBeVisible({ timeout: 10000 });
  }

  async expectWordNotVisible(character: string): Promise<void> {
    await expect(this.page.getByText(character, { exact: false })).not.toBeVisible();
  }
}
