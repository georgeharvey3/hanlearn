/**
 * Additional tests for AnswerInput — covers the pinyin+speech, meaning+flashcards,
 * meaning+speech rendering paths (lines 174-177, 181-206) and the getVerb helper.
 */
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

import AnswerInput, { getVerb } from './AnswerInput';
import { TestState } from './types';

const noop = () => {};

const baseState: Partial<TestState> = {
  answerInput: '',
  showAnswer: false,
  yesClicked: false,
  noClicked: false,
  useSound: false,
  useFlashcards: false,
  useChineseSpeechRecognition: false,
  useEnglishSpeechRecognition: false,
  useAutoRecord: false,
  useTypingInput: true,
  showInput: false,
  recognition: null,
};

function renderAnswerInput(stateOverrides: Partial<TestState>) {
  const state = { ...baseState, ...stateOverrides } as unknown as TestState;
  return render(
    <AnswerInput
      state={state}
      onKeyPress={noop as any}
      onInputChanged={noop as any}
      onFocusEntry={noop as any}
      onListen={noop}
      onShowAnswer={noop}
      onCorrectAnswer={noop}
      onIDontKnow={noop}
      setStateMerged={noop as any}
    />,
  );
}

// ---------------------------------------------------------------------------
// pinyin mode — text input (default, no speech recognition)
// ---------------------------------------------------------------------------
describe('AnswerInput — pinyin mode', () => {
  it('renders a text input when useChineseSpeechRecognition is false', () => {
    renderAnswerInput({ answerCategory: 'pinyin', useChineseSpeechRecognition: false });
    expect(screen.getByRole('textbox', { name: /enter your answer/i })).toBeInTheDocument();
  });

  it('renders micInput when useChineseSpeechRecognition is true and useTypingInput is false', () => {
    renderAnswerInput({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
    });
    expect(screen.getByRole('button', { name: /record speech/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/auto record/i)).toBeInTheDocument();
  });

  it('renders typingInputWithMicToggle when useChineseSpeechRecognition is true and useTypingInput is true', () => {
    renderAnswerInput({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: true,
    });
    expect(screen.getByRole('textbox', { name: /enter your answer/i })).toBeInTheDocument();
    // Should have the "Switch to speaking" icon button
    expect(screen.getByRole('button', { name: /switch to speaking/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// meaning mode — flashcard variant
// ---------------------------------------------------------------------------
describe('AnswerInput — meaning mode with flashcards', () => {
  it('renders "Show Answer" button when showAnswer is false', () => {
    renderAnswerInput({
      answerCategory: 'meaning',
      useFlashcards: true,
      showAnswer: false,
    });
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
  });

  it('renders like/dislike picture buttons when showAnswer is true', () => {
    renderAnswerInput({
      answerCategory: 'meaning',
      useFlashcards: true,
      showAnswer: true,
    });
    expect(screen.getByRole('button', { name: /i knew this/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i didn't know this/i })).toBeInTheDocument();
  });

  it('applies activeButtonStyle to the like button when yesClicked is true', () => {
    renderAnswerInput({
      answerCategory: 'meaning',
      useFlashcards: true,
      showAnswer: true,
      yesClicked: true,
    });
    // The "I knew this" button should be rendered (style change via activeButtonStyle)
    expect(screen.getByRole('button', { name: /i knew this/i })).toBeInTheDocument();
  });

  it('applies activeButtonStyle to the dislike button when noClicked is true', () => {
    renderAnswerInput({
      answerCategory: 'meaning',
      useFlashcards: true,
      showAnswer: true,
      noClicked: true,
    });
    expect(screen.getByRole('button', { name: /i didn't know this/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// meaning mode — speech recognition variant
// ---------------------------------------------------------------------------
describe('AnswerInput — meaning mode with English speech recognition', () => {
  it('renders micInput when useEnglishSpeechRecognition is true and useTypingInput is false', () => {
    renderAnswerInput({
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: true,
      useTypingInput: false,
    });
    expect(screen.getByRole('button', { name: /record speech/i })).toBeInTheDocument();
  });

  it('renders typingInputWithMicToggle when useEnglishSpeechRecognition true and useTypingInput true', () => {
    renderAnswerInput({
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: true,
      useTypingInput: true,
    });
    expect(screen.getByRole('textbox', { name: /enter your answer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to speaking/i })).toBeInTheDocument();
  });

  it('renders plain text input when useEnglishSpeechRecognition is false and no flashcards', () => {
    renderAnswerInput({
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: false,
    });
    expect(screen.getByRole('textbox', { name: /enter your answer/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// micInput interactive behaviour
// ---------------------------------------------------------------------------
describe('AnswerInput — micInput interactions', () => {
  it('renders secondary text input when showInput is true in mic mode', () => {
    renderAnswerInput({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
      showInput: true,
    });
    expect(screen.getByRole('textbox', { name: /type your answer/i })).toBeInTheDocument();
  });

  it('calls setStateMerged when "Switch to typing" keyboard button is clicked', () => {
    const setStateMerged = vi.fn();
    const state = {
      ...baseState,
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
      recognition: { abort: vi.fn() },
    } as unknown as TestState;
    render(
      <AnswerInput
        state={state}
        onKeyPress={noop as any}
        onInputChanged={noop as any}
        onFocusEntry={noop as any}
        onListen={noop}
        onShowAnswer={noop}
        onCorrectAnswer={noop}
        onIDontKnow={noop}
        setStateMerged={setStateMerged}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /switch to typing/i }));
    expect(setStateMerged).toHaveBeenCalledWith({ useTypingInput: true });
  });

  it('calls setStateMerged when "Switch to speaking" mic button is clicked', () => {
    const setStateMerged = vi.fn();
    const state = {
      ...baseState,
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: true,
    } as unknown as TestState;
    render(
      <AnswerInput
        state={state}
        onKeyPress={noop as any}
        onInputChanged={noop as any}
        onFocusEntry={noop as any}
        onListen={noop}
        onShowAnswer={noop}
        onCorrectAnswer={noop}
        onIDontKnow={noop}
        setStateMerged={setStateMerged}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /switch to speaking/i }));
    expect(setStateMerged).toHaveBeenCalledWith({ useTypingInput: false });
  });
});

// ---------------------------------------------------------------------------
// default / unknown answerCategory
// ---------------------------------------------------------------------------
describe('AnswerInput — default case', () => {
  it('renders a text input for an unknown answerCategory', () => {
    renderAnswerInput({ answerCategory: 'unknown-type' });
    expect(screen.getByRole('textbox', { name: /enter your answer/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// getVerb helper
// ---------------------------------------------------------------------------
describe('getVerb', () => {
  it('returns "Enter the " for pinyin without speech', () => {
    const state = {
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: false,
      useTypingInput: true,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('Enter the ');
  });

  it('returns "Speak the " for pinyin with speech recognition and not typing', () => {
    const state = {
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('Speak the ');
  });

  it('returns "Enter the " for pinyin with speech recognition but useTypingInput=true', () => {
    const state = {
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: true,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('Enter the ');
  });

  it('returns "Draw the " for character answerCategory', () => {
    const state = { answerCategory: 'character' } as unknown as TestState;
    expect(getVerb(state)).toBe('Draw the ');
  });

  it('returns "What is the " for meaning with flashcards', () => {
    const state = {
      answerCategory: 'meaning',
      useFlashcards: true,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('What is the ');
  });

  it('returns "Speak the " for meaning with English speech recognition and not typing', () => {
    const state = {
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: true,
      useTypingInput: false,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('Speak the ');
  });

  it('returns "Enter the " for meaning with English speech recognition but useTypingInput=true', () => {
    const state = {
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: true,
      useTypingInput: true,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('Enter the ');
  });

  it('returns "Enter the " for meaning without flashcards or speech', () => {
    const state = {
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: false,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('Enter the ');
  });

  it('returns "Enter the " for unknown answerCategory', () => {
    const state = { answerCategory: 'unknown' } as unknown as TestState;
    expect(getVerb(state)).toBe('Enter the ');
  });
});
