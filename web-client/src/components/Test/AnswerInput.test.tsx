/**
 * Tests for AnswerInput — the answer area of the vocabulary quiz.
 *
 * Rendering is driven by the answer category and its quiz type:
 * - character  → handwriting canvas
 * - input      → text input, plus mic + auto-record toggle when the browser
 *                supports speech recognition
 * - flashcard  → Show Answer button, then like/dislike buttons
 */
import React from 'react';
import { screen, fireEvent, render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./constants', () => ({
  beep: { play: vi.fn() },
  fail: { play: vi.fn() },
  buttonStyle: { display: 'inline-block' },
  activeButtonStyle: { display: 'inline-block', boxShadow: '0px 0px' },
}));

import AnswerInput, { getVerb } from './AnswerInput';
import { fail } from './constants';
import { TestState } from './types';

const baseState = {
  answerInput: '',
  showAnswer: false,
  yesClicked: false,
  noClicked: false,
  useSound: false,
  useSoundEffects: false,
  pinyinQuizType: 'input',
  meaningQuizType: 'input',
  useAutoRecord: false,
  answerCategory: 'character',
  recognition: null,
} as unknown as TestState;

const noop = () => {};

function makeState(overrides: Partial<TestState> = {}): TestState {
  return { ...baseState, ...overrides } as TestState;
}

function makeProps(stateOverrides: Partial<TestState> = {}, speechAvailable = false) {
  return {
    state: makeState(stateOverrides),
    speechAvailable,
    onKeyPress: vi.fn() as any,
    onInputChanged: vi.fn() as any,
    onFocusEntry: vi.fn() as any,
    onListen: vi.fn(),
    onShowAnswer: vi.fn(),
    onCorrectAnswer: vi.fn(),
    onIDontKnow: vi.fn(),
    setStateMerged: vi.fn() as any,
  };
}

function renderAnswerInput(stateOverrides: Partial<TestState>, speechAvailable = false) {
  const props = makeProps(stateOverrides, speechAvailable);
  render(<AnswerInput {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── character (handwriting) ─────────────────────────────────────────────────

describe('AnswerInput — handwriting canvas', () => {
  it('renders the handwriting canvas with an accessible label', () => {
    renderAnswerInput({ answerCategory: 'character' });
    const canvas = document.getElementById('character-target-div');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('aria-label');
    expect(canvas?.getAttribute('aria-label')).toMatch(/draw/i);
  });

  it('renders placeholder text in the handwriting canvas', () => {
    renderAnswerInput({ answerCategory: 'character' });
    expect(screen.getByText(/draw here/i)).toBeInTheDocument();
  });
});

// ── input mode without speech support ────────────────────────────────────────

describe('AnswerInput — input mode without speech recognition', () => {
  it('renders only a text input for pinyin answers', () => {
    renderAnswerInput({ answerCategory: 'pinyin', pinyinQuizType: 'input' });
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/record speech/i)).not.toBeInTheDocument();
  });

  it('renders only a text input for meaning answers', () => {
    renderAnswerInput({ answerCategory: 'meaning', meaningQuizType: 'input' });
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/record speech/i)).not.toBeInTheDocument();
  });

  it('renders a text input for an unknown answer category', () => {
    renderAnswerInput({ answerCategory: 'unknown' as any });
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
  });

  it('forwards typing to onInputChanged', () => {
    const props = renderAnswerInput({ answerCategory: 'pinyin', pinyinQuizType: 'input' });
    fireEvent.change(screen.getByLabelText(/enter your answer/i), { target: { value: 'ni3' } });
    expect(props.onInputChanged).toHaveBeenCalled();
  });
});

// ── input mode with speech support ───────────────────────────────────────────

describe('AnswerInput — input mode with speech recognition', () => {
  it('renders the text input and the mic side by side for pinyin answers', () => {
    renderAnswerInput({ answerCategory: 'pinyin', pinyinQuizType: 'input' }, true);
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/record speech/i)).toBeInTheDocument();
  });

  it('renders the text input and the mic side by side for meaning answers', () => {
    renderAnswerInput({ answerCategory: 'meaning', meaningQuizType: 'input' }, true);
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/record speech/i)).toBeInTheDocument();
  });

  it('calls onListen when the mic button is clicked', () => {
    const props = renderAnswerInput({ answerCategory: 'pinyin', pinyinQuizType: 'input' }, true);
    fireEvent.click(screen.getByLabelText(/record speech/i));
    expect(props.onListen).toHaveBeenCalled();
  });

  it('enables auto-record and starts listening when the toggle is switched on', () => {
    const recognition = { abort: vi.fn() };
    const props = makeProps(
      { answerCategory: 'pinyin', pinyinQuizType: 'input', recognition } as any,
      true,
    );
    render(<AnswerInput {...props} />);

    fireEvent.click(screen.getByRole('switch'));

    expect(recognition.abort).toHaveBeenCalled();
    expect(props.setStateMerged).toHaveBeenCalledWith({ useAutoRecord: true });
    expect(props.onListen).toHaveBeenCalled();
  });

  it('does not show the mic in flashcard mode even when speech is available', () => {
    renderAnswerInput({ answerCategory: 'meaning', meaningQuizType: 'flashcard' }, true);
    expect(screen.queryByLabelText(/record speech/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
  });
});

// ── flashcard mode ───────────────────────────────────────────────────────────

describe('AnswerInput — flashcard mode (show-answer flow)', () => {
  it('renders "Show Answer" button for meaning answers when showAnswer is false', () => {
    renderAnswerInput({
      answerCategory: 'meaning',
      meaningQuizType: 'flashcard',
      showAnswer: false,
    });
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/i knew this/i)).not.toBeInTheDocument();
  });

  it('renders "Show Answer" button for pinyin answers when showAnswer is false', () => {
    renderAnswerInput({
      answerCategory: 'pinyin',
      pinyinQuizType: 'flashcard',
      showAnswer: false,
    });
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/enter your answer/i)).not.toBeInTheDocument();
  });

  it('calls onShowAnswer when "Show Answer" is clicked', () => {
    const props = renderAnswerInput({
      answerCategory: 'meaning',
      meaningQuizType: 'flashcard',
      showAnswer: false,
    });
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(props.onShowAnswer).toHaveBeenCalled();
  });

  it('renders like/dislike buttons when showAnswer is true', () => {
    renderAnswerInput({
      answerCategory: 'pinyin',
      pinyinQuizType: 'flashcard',
      showAnswer: true,
    });
    expect(screen.getByLabelText(/i knew this/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/i didn't know this/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show answer/i })).not.toBeInTheDocument();
  });

  it('calls onCorrectAnswer when the like button is clicked', () => {
    const props = renderAnswerInput({
      answerCategory: 'meaning',
      meaningQuizType: 'flashcard',
      showAnswer: true,
    });
    fireEvent.click(screen.getByLabelText(/i knew this/i));
    expect(props.onCorrectAnswer).toHaveBeenCalledTimes(1);
  });

  it('calls onIDontKnow when the dislike button is clicked', () => {
    const props = renderAnswerInput({
      answerCategory: 'meaning',
      meaningQuizType: 'flashcard',
      showAnswer: true,
    });
    fireEvent.click(screen.getByLabelText(/i didn't know this/i));
    expect(props.onIDontKnow).toHaveBeenCalledTimes(1);
  });

  it('plays fail sound when dislike is clicked and useSoundEffects=true', () => {
    const mockedFail = vi.mocked(fail);
    renderAnswerInput({
      answerCategory: 'meaning',
      meaningQuizType: 'flashcard',
      showAnswer: true,
      useSoundEffects: true,
    });
    fireEvent.click(screen.getByLabelText(/i didn't know this/i));
    expect(mockedFail.play).toHaveBeenCalled();
  });

  it('does not play fail sound on dislike when useSoundEffects=false', () => {
    const mockedFail = vi.mocked(fail);
    renderAnswerInput({
      answerCategory: 'meaning',
      meaningQuizType: 'flashcard',
      showAnswer: true,
      useSoundEffects: false,
      useSound: true,
    });
    fireEvent.click(screen.getByLabelText(/i didn't know this/i));
    expect(mockedFail.play).not.toHaveBeenCalled();
  });
});

// ── getVerb ──────────────────────────────────────────────────────────────────

describe('getVerb', () => {
  it('returns "Draw the " for character answers', () => {
    expect(getVerb(makeState({ answerCategory: 'character' }))).toBe('Draw the ');
  });

  it('returns "Enter the " for input-mode pinyin answers', () => {
    expect(getVerb(makeState({ answerCategory: 'pinyin', pinyinQuizType: 'input' }))).toBe(
      'Enter the ',
    );
  });

  it('returns "Enter the " for input-mode meaning answers', () => {
    expect(getVerb(makeState({ answerCategory: 'meaning', meaningQuizType: 'input' }))).toBe(
      'Enter the ',
    );
  });

  it('returns "What is the " for flashcard pinyin answers', () => {
    expect(getVerb(makeState({ answerCategory: 'pinyin', pinyinQuizType: 'flashcard' }))).toBe(
      'What is the ',
    );
  });

  it('returns "What is the " for flashcard meaning answers', () => {
    expect(getVerb(makeState({ answerCategory: 'meaning', meaningQuizType: 'flashcard' }))).toBe(
      'What is the ',
    );
  });

  it('returns "Enter the " for an unknown answer category', () => {
    expect(getVerb(makeState({ answerCategory: 'unknown' as any }))).toBe('Enter the ');
  });
});
