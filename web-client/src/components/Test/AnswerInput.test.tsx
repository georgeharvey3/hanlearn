import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

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
  useFlashcards: false,
  useChineseSpeechRecognition: false,
  useEnglishSpeechRecognition: false,
  useAutoRecord: false,
  useTypingInput: true,
  showInput: false,
  answerCategory: 'character',
  recognition: null,
} as unknown as TestState;

const noop = () => {};

function renderAnswerInput(
  stateOverrides: Partial<TestState>,
  extraProps?: Record<string, unknown>,
) {
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
      {...extraProps}
    />,
  );
}

function makeState(overrides: Partial<TestState> = {}): TestState {
  return { ...baseState, ...overrides } as TestState;
}

function makeProps(stateOverrides: Partial<TestState> = {}) {
  return {
    state: makeState(stateOverrides),
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

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe('AnswerInput — pinyin text input', () => {
  it('renders a text input when speech recognition is disabled', () => {
    renderAnswerInput({ answerCategory: 'pinyin', useChineseSpeechRecognition: false });
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/record speech/i)).not.toBeInTheDocument();
  });
});

describe('AnswerInput — pinyin with speech recognition', () => {
  it('renders mic input when useChineseSpeechRecognition=true and useTypingInput=false', () => {
    renderAnswerInput({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
    });
    expect(screen.getByLabelText(/record speech/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/switch to typing/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/switch to speaking/i)).not.toBeInTheDocument();
  });

  it('does not show secondary text input when showInput is false', () => {
    renderAnswerInput({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
      showInput: false,
    });
    expect(screen.queryByLabelText(/type your answer/i)).not.toBeInTheDocument();
  });

  it('shows secondary text input when showInput is true', () => {
    renderAnswerInput({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
      showInput: true,
    });
    expect(screen.getByLabelText(/type your answer/i)).toBeInTheDocument();
  });

  it('renders typing input with mic-toggle when useChineseSpeechRecognition=true and useTypingInput=true', () => {
    renderAnswerInput({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: true,
    });
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/switch to speaking/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/switch to typing/i)).not.toBeInTheDocument();
  });

  it('calls setStateMerged with useTypingInput=false when "Switch to speaking" is clicked', () => {
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
    fireEvent.click(screen.getByLabelText(/switch to speaking/i));
    expect(setStateMerged).toHaveBeenCalledWith({ useTypingInput: false });
  });

  it('calls setStateMerged with useTypingInput=true when "Switch to typing" is clicked', () => {
    const setStateMerged = vi.fn();
    const recognition = { abort: vi.fn() };
    const state = {
      ...baseState,
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
      recognition,
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
    fireEvent.click(screen.getByLabelText(/switch to typing/i));
    expect(recognition.abort).toHaveBeenCalled();
    expect(setStateMerged).toHaveBeenCalledWith({ useTypingInput: true });
  });
});

describe('AnswerInput — meaning with flashcards', () => {
  it('renders "Show Answer" button when showAnswer is false', () => {
    renderAnswerInput({ answerCategory: 'meaning', useFlashcards: true, showAnswer: false });
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/i knew this/i)).not.toBeInTheDocument();
  });

  it('calls onShowAnswer when "Show Answer" button is clicked', () => {
    const onShowAnswer = vi.fn();
    const state = {
      ...baseState,
      answerCategory: 'meaning',
      useFlashcards: true,
      showAnswer: false,
    } as unknown as TestState;
    render(
      <AnswerInput
        state={state}
        onKeyPress={noop as any}
        onInputChanged={noop as any}
        onFocusEntry={noop as any}
        onListen={noop}
        onShowAnswer={onShowAnswer}
        onCorrectAnswer={noop}
        onIDontKnow={noop}
        setStateMerged={noop as any}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(onShowAnswer).toHaveBeenCalled();
  });

  it('renders like/dislike buttons when showAnswer is true', () => {
    renderAnswerInput({ answerCategory: 'meaning', useFlashcards: true, showAnswer: true });
    expect(screen.getByLabelText(/i knew this/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/i didn't know this/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show answer/i })).not.toBeInTheDocument();
  });

  it('calls onCorrectAnswer when the like button is clicked', () => {
    const onCorrectAnswer = vi.fn();
    const state = {
      ...baseState,
      answerCategory: 'meaning',
      useFlashcards: true,
      showAnswer: true,
    } as unknown as TestState;
    render(
      <AnswerInput
        state={state}
        onKeyPress={noop as any}
        onInputChanged={noop as any}
        onFocusEntry={noop as any}
        onListen={noop}
        onShowAnswer={noop}
        onCorrectAnswer={onCorrectAnswer}
        onIDontKnow={noop}
        setStateMerged={noop as any}
      />,
    );
    fireEvent.click(screen.getByLabelText(/i knew this/i));
    expect(onCorrectAnswer).toHaveBeenCalled();
  });

  it('calls onIDontKnow when the dislike button is clicked', () => {
    const onIDontKnow = vi.fn();
    const state = {
      ...baseState,
      answerCategory: 'meaning',
      useFlashcards: true,
      showAnswer: true,
      useSound: false,
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
        onIDontKnow={onIDontKnow}
        setStateMerged={noop as any}
      />,
    );
    fireEvent.click(screen.getByLabelText(/i didn't know this/i));
    expect(onIDontKnow).toHaveBeenCalled();
  });
});

describe('AnswerInput — pinyin with flashcards', () => {
  it('renders "Show Answer" button when showAnswer is false', () => {
    renderAnswerInput({
      answerCategory: 'pinyin',
      useFlashcards: true,
      useChineseSpeechRecognition: true,
      showAnswer: false,
    });
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/record speech/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/enter your answer/i)).not.toBeInTheDocument();
  });

  it('renders like/dislike buttons when showAnswer is true', () => {
    renderAnswerInput({ answerCategory: 'pinyin', useFlashcards: true, showAnswer: true });
    expect(screen.getByLabelText(/i knew this/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/i didn't know this/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show answer/i })).not.toBeInTheDocument();
  });

  it('calls onShowAnswer when "Show Answer" button is clicked', () => {
    const onShowAnswer = vi.fn();
    const state = {
      ...baseState,
      answerCategory: 'pinyin',
      useFlashcards: true,
      showAnswer: false,
    } as unknown as TestState;
    render(
      <AnswerInput
        state={state}
        onKeyPress={noop as any}
        onInputChanged={noop as any}
        onFocusEntry={noop as any}
        onListen={noop}
        onShowAnswer={onShowAnswer}
        onCorrectAnswer={noop}
        onIDontKnow={noop}
        setStateMerged={noop as any}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(onShowAnswer).toHaveBeenCalled();
  });
});

describe('AnswerInput — meaning with English speech recognition', () => {
  it('renders mic input when useEnglishSpeechRecognition=true and useTypingInput=false', () => {
    renderAnswerInput({
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: true,
      useTypingInput: false,
    });
    expect(screen.getByLabelText(/record speech/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/switch to typing/i)).toBeInTheDocument();
  });

  it('renders typing+mic-toggle when useEnglishSpeechRecognition=true and useTypingInput=true', () => {
    renderAnswerInput({
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: true,
      useTypingInput: true,
    });
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/switch to speaking/i)).toBeInTheDocument();
  });

  it('renders plain text input when no flags set', () => {
    renderAnswerInput({
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: false,
    });
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/record speech/i)).not.toBeInTheDocument();
  });
});

describe('getVerb', () => {
  it('returns "Enter the " for pinyin without speech recognition', () => {
    const state = {
      ...baseState,
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: false,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('Enter the ');
  });

  it('returns "Speak the " for pinyin with speech recognition and useTypingInput=false', () => {
    const state = {
      ...baseState,
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('Speak the ');
  });

  it('returns "Enter the " for pinyin with speech recognition but useTypingInput=true', () => {
    const state = {
      ...baseState,
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: true,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('Enter the ');
  });

  it('returns "What is the " for pinyin with flashcards', () => {
    const state = {
      ...baseState,
      answerCategory: 'pinyin',
      useFlashcards: true,
      useChineseSpeechRecognition: true,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('What is the ');
  });

  it('returns "Draw the " for character', () => {
    const state = { ...baseState, answerCategory: 'character' } as unknown as TestState;
    expect(getVerb(state)).toBe('Draw the ');
  });

  it('returns "What is the " for meaning with flashcards', () => {
    const state = {
      ...baseState,
      answerCategory: 'meaning',
      useFlashcards: true,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('What is the ');
  });

  it('returns "Speak the " for meaning with English speech recognition and useTypingInput=false', () => {
    const state = {
      ...baseState,
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: true,
      useTypingInput: false,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('Speak the ');
  });

  it('returns "Enter the " for meaning with English speech recognition but useTypingInput=true', () => {
    const state = {
      ...baseState,
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: true,
      useTypingInput: true,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('Enter the ');
  });

  it('returns "Enter the " for meaning without any flags', () => {
    const state = {
      ...baseState,
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: false,
    } as unknown as TestState;
    expect(getVerb(state)).toBe('Enter the ');
  });

  it('returns "Enter the " for unknown answerCategory', () => {
    const state = { ...baseState, answerCategory: 'unknown' } as unknown as TestState;
    expect(getVerb(state)).toBe('Enter the ');
  });
});

// ── pinyin without speech ────────────────────────────────────────────────────

describe('AnswerInput — pinyin without speech recognition', () => {
  it('renders a text input when answerCategory=pinyin and no speech recognition', () => {
    const props = makeProps({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: false,
      useTypingInput: false,
    });
    render(<AnswerInput {...props} />);
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
  });
});

// ── pinyin with speech recognition (mic mode) ────────────────────────────────

describe('AnswerInput — pinyin with Chinese speech recognition (mic mode)', () => {
  it('renders the mic button when useChineseSpeechRecognition=true and useTypingInput=false', () => {
    const props = makeProps({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
    });
    render(<AnswerInput {...props} />);
    expect(screen.getByLabelText(/record speech/i)).toBeInTheDocument();
  });

  it('does NOT show secondary text input when showInput=false', () => {
    const props = makeProps({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
      showInput: false,
    });
    render(<AnswerInput {...props} />);
    expect(screen.queryByLabelText(/type your answer/i)).not.toBeInTheDocument();
  });

  it('shows secondary text input when showInput=true', () => {
    const props = makeProps({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
      showInput: true,
    });
    render(<AnswerInput {...props} />);
    expect(screen.getByLabelText(/type your answer/i)).toBeInTheDocument();
  });

  it('calls onListen when mic button is clicked', () => {
    const props = makeProps({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
    });
    render(<AnswerInput {...props} />);
    fireEvent.click(screen.getByLabelText(/record speech/i));
    expect(props.onListen).toHaveBeenCalledTimes(1);
  });

  it('renders "Switch to typing" button in mic mode', () => {
    const props = makeProps({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
    });
    render(<AnswerInput {...props} />);
    expect(screen.getByLabelText(/switch to typing/i)).toBeInTheDocument();
  });

  it('calls setStateMerged with useTypingInput:true when "Switch to typing" is clicked', () => {
    const props = makeProps({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
    });
    render(<AnswerInput {...props} />);
    fireEvent.click(screen.getByLabelText(/switch to typing/i));
    expect(props.setStateMerged).toHaveBeenCalledWith({ useTypingInput: true });
  });

  it('shows typing input and "Switch to speaking" when useTypingInput=true', () => {
    const props = makeProps({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: true,
    });
    render(<AnswerInput {...props} />);
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/switch to speaking/i)).toBeInTheDocument();
  });

  it('calls setStateMerged with useTypingInput:false when "Switch to speaking" is clicked', () => {
    const props = makeProps({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: true,
    });
    render(<AnswerInput {...props} />);
    fireEvent.click(screen.getByLabelText(/switch to speaking/i));
    expect(props.setStateMerged).toHaveBeenCalledWith({ useTypingInput: false });
  });
});

// ── meaning + flashcards ─────────────────────────────────────────────────────

describe('AnswerInput — meaning with flashcards (show-answer flow)', () => {
  it('renders "Show Answer" button when showAnswer=false', () => {
    const props = makeProps({ answerCategory: 'meaning', useFlashcards: true, showAnswer: false });
    render(<AnswerInput {...props} />);
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
  });

  it('calls onShowAnswer when "Show Answer" button is clicked', () => {
    const props = makeProps({ answerCategory: 'meaning', useFlashcards: true, showAnswer: false });
    render(<AnswerInput {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(props.onShowAnswer).toHaveBeenCalledTimes(1);
  });

  it('renders like and dislike buttons when showAnswer=true', () => {
    const props = makeProps({ answerCategory: 'meaning', useFlashcards: true, showAnswer: true });
    render(<AnswerInput {...props} />);
    expect(screen.getByLabelText(/i knew this/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/i didn't know this/i)).toBeInTheDocument();
  });

  it('calls onCorrectAnswer when the like (I knew this) button is clicked', () => {
    const props = makeProps({ answerCategory: 'meaning', useFlashcards: true, showAnswer: true });
    render(<AnswerInput {...props} />);
    fireEvent.click(screen.getByLabelText(/i knew this/i));
    expect(props.onCorrectAnswer).toHaveBeenCalledTimes(1);
  });

  it("calls onIDontKnow when the dislike (I didn't know this) button is clicked", () => {
    const props = makeProps({
      answerCategory: 'meaning',
      useFlashcards: true,
      showAnswer: true,
      useSound: false,
    });
    render(<AnswerInput {...props} />);
    fireEvent.click(screen.getByLabelText(/i didn't know this/i));
    expect(props.onIDontKnow).toHaveBeenCalledTimes(1);
  });

  it('plays fail sound when dislike is clicked and useSound=true', () => {
    const mockedFail = vi.mocked(fail);
    const props = makeProps({
      answerCategory: 'meaning',
      useFlashcards: true,
      showAnswer: true,
      useSound: true,
    });
    render(<AnswerInput {...props} />);
    fireEvent.click(screen.getByLabelText(/i didn't know this/i));
    expect(mockedFail.play).toHaveBeenCalled();
  });
});

// ── meaning + English speech recognition ────────────────────────────────────

describe('AnswerInput — meaning with English speech recognition', () => {
  it('renders mic input when useFlashcards=false and useEnglishSpeechRecognition=true', () => {
    const props = makeProps({
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: true,
      useTypingInput: false,
    });
    render(<AnswerInput {...props} />);
    expect(screen.getByLabelText(/record speech/i)).toBeInTheDocument();
  });

  it('renders text input when meaning+speech and useTypingInput=true', () => {
    const props = makeProps({
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: true,
      useTypingInput: true,
    });
    render(<AnswerInput {...props} />);
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
  });

  it('renders plain text input when meaning, no speech, no flashcards', () => {
    const props = makeProps({
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: false,
      useTypingInput: false,
    });
    render(<AnswerInput {...props} />);
    expect(screen.getByLabelText(/enter your answer/i)).toBeInTheDocument();
  });
});

// ── getVerb() helper ─────────────────────────────────────────────────────────

describe('getVerb() — prompt verb for each answer category', () => {
  it('returns "Enter the " for pinyin without speech', () => {
    const state = makeState({ answerCategory: 'pinyin', useChineseSpeechRecognition: false });
    expect(getVerb(state)).toBe('Enter the ');
  });

  it('returns "Speak the " for pinyin with speech in mic mode', () => {
    const state = makeState({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: false,
    });
    expect(getVerb(state)).toBe('Speak the ');
  });

  it('returns "Enter the " for pinyin with speech when useTypingInput=true', () => {
    const state = makeState({
      answerCategory: 'pinyin',
      useChineseSpeechRecognition: true,
      useTypingInput: true,
    });
    expect(getVerb(state)).toBe('Enter the ');
  });

  it('returns "Draw the " for character category', () => {
    const state = makeState({ answerCategory: 'character' });
    expect(getVerb(state)).toBe('Draw the ');
  });

  it('returns "What is the " for meaning with flashcards', () => {
    const state = makeState({ answerCategory: 'meaning', useFlashcards: true });
    expect(getVerb(state)).toBe('What is the ');
  });

  it('returns "Speak the " for meaning with English speech in mic mode', () => {
    const state = makeState({
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: true,
      useTypingInput: false,
    });
    expect(getVerb(state)).toBe('Speak the ');
  });

  it('returns "Enter the " for meaning with English speech in typing mode', () => {
    const state = makeState({
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: true,
      useTypingInput: true,
    });
    expect(getVerb(state)).toBe('Enter the ');
  });

  it('returns "Enter the " for meaning without speech and without flashcards', () => {
    const state = makeState({
      answerCategory: 'meaning',
      useFlashcards: false,
      useEnglishSpeechRecognition: false,
    });
    expect(getVerb(state)).toBe('Enter the ');
  });

  it('returns "Enter the " for unknown answerCategory (default case)', () => {
    const state = makeState({ answerCategory: 'unknown' });
    expect(getVerb(state)).toBe('Enter the ');
  });
});
