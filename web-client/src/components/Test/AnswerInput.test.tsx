/**
 * Tests for AnswerInput — the answer area of the vocabulary quiz.
 *
 * Rendering is driven by the answer category and its quiz type:
 * - character  → the handwriting box, then the characters printed after a miss
 * - input      → the answer field, under the microphone when the browser
 *                supports speech recognition
 * - flashcard  → nothing; the buttons are in TestActions
 */
import React from 'react';
import { screen, fireEvent, render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./constants', () => ({
  beep: { play: vi.fn() },
  fail: { play: vi.fn() },
}));

import AnswerInput from './AnswerInput';
import { TestState } from './types';

const baseState = {
  answer: 'ni3 hao3',
  answerInput: '',
  result: '',
  showAnswer: false,
  outcome: null,
  gradeClicked: null,
  useSound: false,
  useSoundEffects: false,
  pinyinQuizType: 'input',
  meaningQuizType: 'input',
  answerCategory: 'character',
  recognition: null,
  listening: false,
  componentReviewChars: [],
  awaitingContinue: false,
  toneErrorCount: 0,
  writingIndex: 0,
} as unknown as TestState;

function makeProps(stateOverrides: Partial<TestState> = {}, speechAvailable = false) {
  return {
    state: { ...baseState, ...stateOverrides } as TestState,
    speechAvailable,
    onKeyPress: vi.fn() as any,
    onInputChanged: vi.fn() as any,
    onFocusEntry: vi.fn() as any,
    onListen: vi.fn(),
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

describe('AnswerInput — handwriting', () => {
  it('renders the handwriting box with an accessible label', () => {
    renderAnswerInput({ answerCategory: 'character', answer: '你好' });
    const box = document.getElementById('character-target-div');
    expect(box).toBeInTheDocument();
    expect(box?.getAttribute('aria-label')).toMatch(/draw/i);
  });

  it('says which character of the word is being written', () => {
    renderAnswerInput({ answerCategory: 'character', answer: '你好', writingIndex: 1 });
    expect(screen.getByRole('img', { name: 'Character 2 of 2' })).toBeInTheDocument();
    // The written character shows in its step.
    expect(screen.getByText('你')).toBeInTheDocument();
  });

  it('prints the characters in place of the box once a miss has played', () => {
    renderAnswerInput({
      answerCategory: 'character',
      answer: '你好',
      outcome: 'fail',
      awaitingContinue: true,
    });
    expect(document.getElementById('character-target-div')).not.toBeInTheDocument();
    expect(screen.getByText('你')).toBeInTheDocument();
    expect(screen.getByText('好')).toBeInTheDocument();
  });

  it('keeps the box while the strokes of a miss play', () => {
    renderAnswerInput({ answerCategory: 'character', answer: '你好', outcome: 'fail' });
    expect(document.getElementById('character-target-div')).toBeInTheDocument();
  });
});

describe('AnswerInput — the answer field', () => {
  it('renders the field with a placeholder for the pinyin', () => {
    renderAnswerInput({ answerCategory: 'pinyin' });
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toHaveAttribute(
      'placeholder',
      'Pinyin with tone numbers',
    );
  });

  it('renders the field with a placeholder for the meaning', () => {
    renderAnswerInput({ answerCategory: 'meaning', answer: ['hello'] });
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toHaveAttribute(
      'placeholder',
      'Type the meaning',
    );
  });

  it('forwards typing to onInputChanged', () => {
    const props = renderAnswerInput({ answerCategory: 'meaning' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(props.onInputChanged).toHaveBeenCalled();
  });

  it('shows no microphone when speech is unavailable', () => {
    renderAnswerInput({ answerCategory: 'meaning' });
    expect(screen.queryByRole('button', { name: 'Record speech' })).not.toBeInTheDocument();
  });

  it('shows nothing in flashcard mode', () => {
    const { container } = render(
      <AnswerInput
        {...makeProps({ answerCategory: 'meaning', meaningQuizType: 'flashcard' }, true)}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AnswerInput — the microphone', () => {
  it('records when pressed', () => {
    const props = renderAnswerInput({ answerCategory: 'pinyin' }, true);
    fireEvent.click(screen.getByRole('button', { name: 'Record speech' }));
    expect(props.onListen).toHaveBeenCalled();
  });

  it('stops recording when pressed while listening', () => {
    const abort = vi.fn();
    const props = renderAnswerInput(
      { answerCategory: 'pinyin', listening: true, recognition: { abort } as any },
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(abort).toHaveBeenCalled();
    expect(props.onListen).not.toHaveBeenCalled();
  });

  it('keeps the field and the mic after a wrong attempt, so it can be sent again', () => {
    renderAnswerInput({ answerCategory: 'pinyin', answerInput: 'ni2', result: 'Try again' }, true);
    expect(screen.getByRole('textbox')).toHaveValue('ni2');
    expect(screen.getByRole('button', { name: 'Record speech' })).toBeEnabled();
  });

  it('stays in place, switched off, once the answer is known', () => {
    renderAnswerInput(
      { answerCategory: 'meaning', answerInput: 'hello', outcome: 'pass', result: 'Correct' },
      true,
    );
    expect(screen.getByRole('button', { name: 'Record speech' })).toBeDisabled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});

describe('AnswerInput — after a miss', () => {
  it('underlines the syllables with the wrong tone, and edits again on a tap', () => {
    renderAnswerInput({
      answerCategory: 'pinyin',
      answer: 'ni3 hao3',
      answerInput: 'ni3 hao4',
      result: 'Incorrect tones',
      toneErrorCount: 1,
    });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Your answer' }));
    expect(screen.getByRole('textbox')).toHaveValue('ni3 hao4');
  });

  it('shows the attempt struck through when the learner gave up', () => {
    renderAnswerInput(
      { answerCategory: 'pinyin', answerInput: 'peng2 yu3', outcome: 'fail', result: 'Not known' },
      true,
    );
    expect(screen.getByText('You typed')).toBeInTheDocument();
    expect(screen.getByText('peng2 yu3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record speech' })).not.toBeInTheDocument();
  });
});
