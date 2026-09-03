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

  /**
   * Grade the revealed flashcard question.
   *
   * Flashcard mode has no attempt to read, so the reveal offers all three
   * grades and the learner reports one of them.
   */
  async gradeFlashcard(grade: 'pass' | 'lapse' | 'fail'): Promise<void> {
    const label = {
      pass: 'I knew this',
      lapse: 'I nearly knew this',
      fail: "I didn't know this",
    }[grade];
    await this.page.locator(`[aria-label="${label}"]`).click();
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
   * Complete a test session using flashcard mode.
   *
   * Test settings configure flashcard mode with MP (meaning answer,
   * pinyin question) as the only priority. Each question shows a
   * "Show Answer" button, then like/dislike buttons.
   *
   * - "I knew this" (like) → onCorrectAnswer → removes the perm
   * - "I didn't know this" (dislike) → onIDontKnow → keeps the perm,
   *   adds to IDK list, auto-advances after 2s
   *
   * @param targetIdkRounds Number of "I didn't know this" clicks before
   *   switching to "I knew this" to finish. Use 0 for good scores, or
   *   a higher number (e.g. 8) for poor scores ("Weak"/"Very Weak").
   */
  async completeTestWithIDK(targetIdkRounds: number = 0): Promise<void> {
    let idkRounds = 0;
    for (let i = 0; i < 100; i++) {
      const summaryVisible = await this.page.getByText('Session Summary').isVisible();
      if (summaryVisible) return;

      // Wait for "Show Answer" button (flashcard mode)
      const showAnswer = this.page.getByRole('button', { name: 'Show Answer' });
      if (await showAnswer.isVisible()) {
        await showAnswer.click();
        await this.page.waitForTimeout(300);

        if (idkRounds < targetIdkRounds) {
          // Phase 1: Click "I didn't know this" to accumulate IDK counts
          const dislike = this.page.locator('[aria-label="I didn\'t know this"]');
          if (await dislike.isVisible()) {
            await dislike.click();
            idkRounds++;
            // onIDontKnow shows answer for 2s then auto-advances
            await this.page.waitForTimeout(2500);
            continue;
          }
        }

        // Phase 2: Click "I knew this" to remove the perm and finish
        const like = this.page.locator('[aria-label="I knew this"]');
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
        await this.page.waitForTimeout(2500);
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
