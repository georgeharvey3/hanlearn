/**
 * Tests for resultTone — the colour and icon of the status line under the card.
 *
 * The line must never repeat both the text and the colour of the message it
 * replaces, or a grade looks like no response at all when sound effects are off.
 */
import { vi, describe, it, expect } from 'vitest';

vi.mock('./constants', () => ({
  beep: { play: vi.fn() },
  fail: { play: vi.fn() },
  createInitialState: vi.fn(() => ({})),
}));

vi.mock('../../store/actions/index', () => ({
  finishTest: vi.fn(),
}));

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));

vi.mock('../../services/sentenceService', () => ({
  checkSentenceAvailability: vi.fn(),
  getHintSentence: vi.fn(),
}));

import { resultTone } from './Test';
import { copy } from '../../copy';

const { status } = copy.test;

describe('resultTone', () => {
  it('shows a correct answer in the success colour, with a tick', () => {
    expect(resultTone(status.correct)).toEqual({ tone: 'success', icon: 'check' });
    expect(resultTone(status.finished).tone).toBe('success');
  });

  it('shows a wrong attempt in the error colour, with the retry icon', () => {
    expect(resultTone(status.tryAgain)).toEqual({ tone: 'error', icon: 'retry' });
  });

  it('shows a question not known in the error colour', () => {
    expect(resultTone(status.notKnown).tone).toBe('error');
  });

  it('shows wrong tones and a flashcard grade of nearly in the warning colour', () => {
    expect(resultTone(status.tones).tone).toBe('warning');
    expect(resultTone(status.nearly).tone).toBe('warning');
  });

  it('keeps a notice about the mic or the hint neutral', () => {
    expect(resultTone(status.heardNothing).tone).toBe('neutral');
    expect(resultTone(status.noSentence).tone).toBe('neutral');
    expect(resultTone('').tone).toBe('neutral');
  });
});
