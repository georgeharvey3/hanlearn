/**
 * Tests for TestActions — the buttons at the foot of a question.
 *
 * The hint for a meaning question comes from a generated example sentence,
 * which can take some seconds. While it loads, the button must show that
 * work is in progress and must not accept a second click. A graded question
 * offers Continue, and a flashcard offers its three grades.
 */
import React from 'react';
import { screen, fireEvent, render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./constants', () => ({
  beep: { play: vi.fn() },
  fail: { play: vi.fn() },
}));

import TestActions from './TestActions';
import { fail } from './constants';
import { TestState } from './types';

const baseState = {
  idkDisabled: false,
  submitDisabled: false,
  showAnswer: false,
  showHint: false,
  hintLoading: false,
  useSound: false,
  useSoundEffects: false,
  answerCategory: 'meaning',
  questionCategory: 'character',
  meaningQuizType: 'input',
  pinyinQuizType: 'input',
  chosenCharacter: '你好',
  answerInput: '',
  result: '',
  outcome: null,
  gradeClicked: null,
  gradeCap: 'pass',
  awaitingContinue: false,
} as unknown as TestState;

const renderActions = (overrides: Partial<TestState> = {}) => {
  const handlers = {
    onIDontKnow: vi.fn(),
    onHint: vi.fn(),
    onShowAnswer: vi.fn(),
    onCorrectAnswer: vi.fn(),
    onNearlyKnew: vi.fn(),
    onSubmitAnswer: vi.fn(),
    onContinue: vi.fn(),
  };
  render(<TestActions state={{ ...baseState, ...overrides } as TestState} {...handlers} />);
  return handlers;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TestActions hint button', () => {
  it('shows the hint label when no hint is loading', () => {
    renderActions();
    expect(screen.getByRole('button', { name: 'Show hint' })).toBeEnabled();
  });

  it('reads Hide hint, pressed, while the hint shows', () => {
    renderActions({ showHint: true });
    expect(screen.getByRole('button', { name: 'Hide hint' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows a loading indicator while the hint loads', () => {
    renderActions({ hintLoading: true });
    const button = screen.getByRole('button', { name: /Loading hint/ });
    expect(button).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not call onHint again while the hint loads', () => {
    const { onHint } = renderActions({ hintLoading: true });
    fireEvent.click(screen.getByRole('button', { name: /Loading hint/ }));
    expect(onHint).not.toHaveBeenCalled();
  });
});

describe('TestActions — a typed answer', () => {
  it('disables Check while the field is empty', () => {
    renderActions();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('sends the answer on Check', () => {
    const { onSubmitAnswer } = renderActions({ answerInput: 'hello' });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(onSubmitAnswer).toHaveBeenCalled();
  });

  it('offers only Continue once the question is graded', () => {
    const { onContinue } = renderActions({
      outcome: 'pass',
      submitDisabled: true,
      idkDisabled: true,
      awaitingContinue: true,
    });
    expect(screen.queryByRole('button', { name: 'Check' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "I don't know" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalled();
  });
});

describe('TestActions — a flashcard', () => {
  const flashcard = { meaningQuizType: 'flashcard' } as Partial<TestState>;

  it('turns the card over on Show answer', () => {
    const { onShowAnswer } = renderActions(flashcard);
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    expect(onShowAnswer).toHaveBeenCalled();
  });

  it('asks for a grade once the answer shows', () => {
    renderActions({ ...flashcard, showAnswer: true });
    expect(screen.getByText('Did you know it?')).toBeInTheDocument();
    for (const name of ['No', 'Nearly', 'Yes']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
  });

  // A hint caps the question at a lapse, so the reveal offers no pass. See
  // issue #396.
  it('offers no Yes after a hint', () => {
    renderActions({ ...flashcard, showAnswer: true, gradeCap: 'lapse' });
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument();
    for (const name of ['No', 'Nearly']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
  });

  it('grades a pass with no argument, so the click event is not read as a grade', () => {
    const { onCorrectAnswer } = renderActions({ ...flashcard, showAnswer: true });
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onCorrectAnswer).toHaveBeenCalledWith();
  });

  it('grades a lapse on Nearly', () => {
    const { onNearlyKnew } = renderActions({ ...flashcard, showAnswer: true });
    fireEvent.click(screen.getByRole('button', { name: 'Nearly' }));
    expect(onNearlyKnew).toHaveBeenCalled();
  });

  it('grades a fail on No, with the fail sound when sound effects are on', () => {
    const { onIDontKnow } = renderActions({
      ...flashcard,
      showAnswer: true,
      useSoundEffects: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onIDontKnow).toHaveBeenCalled();
    expect(fail.play).toHaveBeenCalled();
  });

  it('keeps the pressed grade and switches the other two off', () => {
    renderActions({ ...flashcard, showAnswer: true, gradeClicked: 'lapse', outcome: 'lapse' });
    expect(screen.getByRole('button', { name: 'Nearly' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'No' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeDisabled();
    expect(screen.queryByText('Did you know it?')).not.toBeInTheDocument();
  });
});
