import { Page, Locator, expect } from '@playwright/test';

export class TestWordsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigateTo(): Promise<void> {
    await this.page.goto('/test-words');
  }

  /** Get the answer input field */
  get answerInput(): Locator {
    return this.page.locator('#answer-input');
  }

  /** Get the "I Don't Know" button */
  get idkButton(): Locator {
    return this.page.locator('#idk');
  }

  /** Get the "Show Answer" button */
  get showAnswerButton(): Locator {
    return this.page.getByRole('button', { name: 'Show Answer' });
  }

  /** Submit an answer by typing and pressing Enter */
  async submitAnswer(answer: string): Promise<void> {
    await this.answerInput.fill(answer);
    await this.answerInput.press('Enter');
  }

  /** Click "I Don't Know" to skip the current question */
  async clickIDontKnow(): Promise<void> {
    await this.idkButton.click();
  }

  /** Wait for the test to reach the summary stage */
  async waitForSummary(): Promise<void> {
    await expect(this.page.getByText('Session Summary')).toBeVisible({ timeout: 30000 });
  }

  /** Check if we're on the summary page */
  async isOnSummary(): Promise<boolean> {
    return this.page.getByText('Session Summary').isVisible();
  }

  /** Get session accuracy text from summary */
  async getSessionAccuracy(): Promise<string> {
    const el = this.page.getByTestId('session-accuracy');
    return (await el.textContent()) || '';
  }

  /** Check if the "No words due" screen is shown */
  async isNoWordsDue(): Promise<boolean> {
    return this.page.getByText(/No words due/i).isVisible();
  }

  /** Click Practice button on the "no words due" screen */
  async clickPractice(): Promise<void> {
    await this.page.getByRole('button', { name: 'Practice' }).click();
  }

  /** Click Add Words button on the "no words due" screen */
  async clickAddWords(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Words' }).click();
  }

  /**
   * Complete a test session by answering all questions with "I Don't Know".
   * This reliably gets through the test regardless of question types.
   */
  async completeTestWithIDK(): Promise<void> {
    // Keep clicking IDK until we reach the summary
    for (let i = 0; i < 50; i++) {
      const summaryVisible = await this.page.getByText('Session Summary').isVisible();
      if (summaryVisible) return;

      const idkVisible = await this.idkButton.isVisible();
      if (idkVisible) {
        const isDisabled = await this.idkButton.isDisabled();
        if (!isDisabled) {
          await this.idkButton.click();
          await this.page.waitForTimeout(500);
          continue;
        }
      }

      // If IDK is not available, try Show Answer flow
      const showAnswer = this.page.getByRole('button', { name: 'Show Answer' });
      if (await showAnswer.isVisible()) {
        await showAnswer.click();
        await this.page.waitForTimeout(300);
        // Click "I didn't know this"
        const didntKnow = this.page.getByRole('button', { name: /didn.*know/i });
        if (await didntKnow.isVisible()) {
          await didntKnow.click();
          await this.page.waitForTimeout(500);
          continue;
        }
      }

      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Try to answer a question. For text-input questions, type the answer.
   * For character-drawing questions, use IDK since we can't draw.
   */
  async answerCurrentQuestion(answer: string): Promise<void> {
    const inputVisible = await this.answerInput.isVisible();
    if (inputVisible) {
      await this.submitAnswer(answer);
    } else {
      // Probably a character-drawing question — use IDK
      await this.clickIDontKnow();
    }
  }
}
