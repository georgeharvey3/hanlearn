/**
 * Tests for getResultColor — the colour of the feedback line under the question.
 *
 * The line must never repeat both the text and the colour of the message it
 * replaces, or a grade looks like no response at all when sound effects are off.
 */
import { vi, describe, it, expect } from 'vitest';

vi.mock('./constants', () => ({
  beep: { play: vi.fn() },
  fail: { play: vi.fn() },
  createInitialState: vi.fn(() => ({})),
  buttonStyle: {},
  activeButtonStyle: {},
}));

vi.mock('../../store/actions/index', () => ({
  finishTest: vi.fn(),
}));

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));

vi.mock('../../services/sentenceService', () => ({
  checkSentenceAvailability: vi.fn(),
  getHintSentence: vi.fn(),
}));

import { getResultColor } from './Test';

describe('getResultColor', () => {
  it('shows a correct answer in the success colour', () => {
    expect(getResultColor('Correct', false)).toBe('success.main');
    expect(getResultColor('Finished!', false)).toBe('success.main');
  });

  it('shows a wrong answer in the error colour', () => {
    expect(getResultColor('Try again', false)).toBe('error.main');
    expect(getResultColor("Answer was: 'hello'", false)).toBe('error.main');
  });

  it('shows wrong tones in the warning colour', () => {
    expect(getResultColor('Incorrect tones', false)).toBe('warning.main');
  });

  it('keeps the flashcard reveal neutral', () => {
    expect(getResultColor("Answer was: 'hello'", true)).toBe('text.primary');
  });

  it('shows a flashcard grade of not known in the error colour', () => {
    expect(getResultColor("Not known — answer was: 'hello'", true)).toBe('error.main');
  });
});
