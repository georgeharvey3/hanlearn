import { Page, Locator, expect } from '@playwright/test';

export class AddWordsPage {
  readonly page: Page;
  readonly searchInput: Locator;
  /** Whatever the dictionary gave: the entries, the own-word form, or an error. */
  readonly searchOutcome: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByRole('textbox', { name: 'Search a Chinese word' });
    this.searchOutcome = page
      .getByText(/^\d+ results?$/)
      .or(page.getByText(/^No entry for/))
      .or(page.getByText('Search failed'));
  }

  async navigateTo(): Promise<void> {
    await this.page.goto('/add-words');
  }

  async searchWord(text: string): Promise<void> {
    await this.searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.searchInput.fill(text);
    await this.searchInput.press('Enter');
    // The Cloud Functions dictionary search may take time on its first call.
    await expect(this.searchOutcome.first()).toBeVisible({ timeout: 30000 });
  }

  /**
   * Add the first dictionary entry of the search. A word with no entry is added
   * as the learner's own word, with the given meaning.
   */
  async addFirstResult(meaning = 'hello'): Promise<void> {
    if (await this.page.getByText(/^No entry for/).isVisible()) {
      await this.page.getByRole('textbox', { name: 'Add as your own word' }).fill(meaning);
      await this.page.getByRole('button', { name: 'Add', exact: true }).click();
      return;
    }
    await this.page.getByRole('button', { name: /^Add / }).first().click();
    await expect(this.page.getByText('Added', { exact: true }).first()).toBeVisible();
  }

  async clearSearch(): Promise<void> {
    await this.page.getByRole('button', { name: 'Clear' }).click();
  }

  async expectWordVisible(character: string): Promise<void> {
    await expect(this.page.getByText(character, { exact: true }).first()).toBeVisible({
      timeout: 10000,
    });
  }

  async expectWordNotVisible(character: string): Promise<void> {
    await expect(this.page.getByText(character, { exact: false })).not.toBeVisible();
  }
}
