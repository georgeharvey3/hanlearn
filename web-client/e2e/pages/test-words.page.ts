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

  /** Get the "I don't know" button */
  get idkButton(): Locator {
    return this.page.locator('#idk');
  }

  /** Get the "Show answer" button */
  get showAnswerButton(): Locator {
    return this.page.getByRole('button', { name: 'Show answer' });
  }

  /** Get the Continue button, which moves on from a graded question */
  get continueButton(): Locator {
    return this.page.locator('#continue');
  }

  /** Move on from a graded question, when it waits for Continue */
  async continueIfHeld(): Promise<void> {
    if (await this.continueButton.isVisible()) await this.continueButton.click();
  }

  /** Submit an answer by typing and pressing Enter */
  async submitAnswer(answer: string): Promise<void> {
    await this.answerInput.fill(answer);
    await this.answerInput.press('Enter');
  }

  /** Click "I don't know" to reveal the current question */
  async clickIDontKnow(): Promise<void> {
    await this.idkButton.click();
  }

  /**
   * Grade the revealed flashcard question.
   *
   * Flashcard mode has no attempt to read, so the reveal offers all three
   * grades and the learner reports one of them.
   */
  async gradeFlashcard(grade: 'pass' | 'lapse' | 'fail'): Promise<void> {
    const name = { pass: 'Yes', lapse: 'Nearly', fail: 'No' }[grade];
    await this.page.getByRole('button', { name, exact: true }).click();
  }

  /** Wait for the test to reach the summary stage */
  async waitForSummary(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Back to Dashboard' })).toBeVisible({
      timeout: 30000,
    });
  }

  /** Check if we're on the summary page */
  async isOnSummary(): Promise<boolean> {
    return this.page.getByRole('button', { name: 'Back to Dashboard' }).isVisible();
  }

  /** Get session accuracy text from summary */
  async getSessionAccuracy(): Promise<string> {
    const el = this.page.getByTestId('session-accuracy');
    return (await el.textContent()) || '';
  }

  /** Check if the "Nothing due" screen is shown */
  async isNoWordsDue(): Promise<boolean> {
    return this.page.getByText(/Nothing due in|No words yet/i).isVisible();
  }

  /** Click Practise button on the "nothing due" screen */
  async clickPractice(): Promise<void> {
    await this.page.getByRole('button', { name: 'Practise' }).click();
  }

  /** Click Add Words button on the "nothing due" screen */
  async clickAddWords(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Words' }).click();
  }

  /**
   * Complete a test session using flashcard mode.
   *
   * Test settings configure flashcard mode with MP (meaning answer,
   * pinyin question) as the only priority. Each question shows a
   * "Show answer" button, then the No / Nearly / Yes grades.
   *
   * - "Yes" → onCorrectAnswer → removes the perm
   * - "No" → onIDontKnow → keeps the perm, adds to IDK list,
   *   auto-advances after 2s
   *
   * @param targetIdkRounds Number of "No" clicks before switching to
   *   "Yes" to finish. Use 0 for good scores, or
   *   a higher number (e.g. 8) for poor scores ("Weak"/"Very Weak").
   */
  async completeTestWithIDK(targetIdkRounds: number = 0): Promise<void> {
    let idkRounds = 0;
    for (let i = 0; i < 100; i++) {
      const summaryVisible = await this.page
        .getByRole('button', { name: 'Back to Dashboard' })
        .isVisible();
      if (summaryVisible) return;

      // A graded question that waits for Continue
      if (await this.continueButton.isVisible()) {
        await this.continueButton.click();
        await this.page.waitForTimeout(300);
        continue;
      }

      // Wait for "Show answer" button (flashcard mode)
      const showAnswer = this.page.getByRole('button', { name: 'Show answer' });
      if (await showAnswer.isVisible()) {
        await showAnswer.click();
        await this.page.waitForTimeout(300);

        if (idkRounds < targetIdkRounds) {
          // Phase 1: Click "No" to accumulate IDK counts
          const dislike = this.page.getByRole('button', { name: 'No', exact: true });
          if (await dislike.isVisible()) {
            await dislike.click();
            idkRounds++;
            // onIDontKnow shows answer for 2s then auto-advances
            await this.page.waitForTimeout(2500);
            continue;
          }
        }

        // Phase 2: Click "Yes" to remove the perm and finish
        const like = this.page.getByRole('button', { name: 'Yes', exact: true });
        if (await like.isVisible()) {
          await like.click();
          // onCorrectAnswer removes perm, waits 1s, then next question
          await this.page.waitForTimeout(1500);
          continue;
        }
      }

      // Fallback: IDK button visible (non-flashcard question)
      const idkVisible = await this.idkButton.isVisible();
      if (idkVisible && !(await this.idkButton.isDisabled())) {
        await this.idkButton.click();
        await this.page.waitForTimeout(500);
        idkRounds++;
        continue;
      }

      // Wait and retry
      await this.page.waitForTimeout(1000);
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
