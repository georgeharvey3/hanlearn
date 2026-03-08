/**
 * Tests for Test.tsx (via useTestEngine hook) — additional coverage for paths
 * not tested in useTestEngine.test.ts:
 * - refreshSettings: respects synthAvailable / speechAvailable flags
 * - onToggleShowPinyin: only works when questionCategory === 'pinyin'
 * - showCharacter: toggle result to/from chosenCharacter
 * - onInputChanged: updates answerInput and sets pauseAutoRecord
 * - onKeyPress: guards (empty input / submitDisabled) and happy path
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('./constants', () => ({
  beep: { play: vi.fn() },
  fail: { play: vi.fn() },
  createInitialState: vi.fn((props: { words?: unknown[] }) => ({
    testSet: props.words ?? [],
    permList: [],
    numWords: 5,
    charSet: 'simp',
    perm: null,
    answer: null,
    answerCategory: 'meaning',
    question: '你好',
    questionCategory: 'character',
    chosenCharacter: '你好',
    result: '',
    answerInput: '',
    idkDisabled: false,
    submitDisabled: false,
    progressBar: 0,
    initNumPerms: 3,
    idkList: [],
    scoreList: [],
    testFinished: false,
    showInput: false,
    showInputChars: [],
    drawnCharacters: [],
    numSpeakTries: 0,
    useSound: false,
    useHandwriting: false,
    useChineseSpeechRecognition: false,
    useEnglishSpeechRecognition: false,
    useAutoRecord: false,
    useFlashcards: false,
    showErrorMessage: false,
    redoChar: false,
    sentenceWords: [],
    sentenceCheckStatus: 'idle' as const,
    writer: null,
    qNum: 0,
    recognition: null,
    showPinyin: false,
    showHint: false,
    listening: false,
    priority: 'none',
    onlyPriority: false,
    showQuestionPinyin: false,
    hintLoading: false,
    showAnswer: false,
    yesClicked: false,
    noClicked: false,
    pauseAutoRecord: false,
    synthLoading: false,
    speechLoading: false,
    interaction: false,
    speechResult: false,
    useTypingInput: false,
  })),
}));

vi.mock('../../services/sentenceService', () => ({
  checkSentenceAvailability: vi.fn().mockResolvedValue(false),
  getHintSentence: vi.fn().mockResolvedValue(null),
}));

vi.mock('pinyin-pro', () => ({
  pinyin: vi.fn((text: string) => text),
}));

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useTestEngine } from './useTestEngine';
import { Word } from '../../types/models';
import { Props } from './types';

// ────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ────────────────────────────────────────────────────────────────────────────

const makeWord = (overrides: Partial<Word> = {}): Word => ({
  id: 1,
  simp: '你好',
  trad: '你好',
  pinyin: 'nǐ hǎo',
  meaning: 'hello/hi',
  bank: 1,
  ...overrides,
});

const makeProps = (overrides: Partial<Props> = {}): Props => ({
  words: [makeWord()],
  userId: 'user-1',
  speechAvailable: false,
  synthAvailable: false,
  isDemo: false,
  onFinishTest: vi.fn(),
  history: {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
  } as any,
  location: { pathname: '/', search: '', hash: '', state: undefined } as any,
  match: { isExact: true, params: {}, path: '/', url: '/' } as any,
  ...overrides,
});

const mockWriter = {
  quiz: vi.fn(),
  setCharacter: vi.fn(),
  animateCharacter: vi.fn().mockResolvedValue(undefined),
  cancelQuiz: vi.fn(),
  showOutline: vi.fn(),
  hideOutline: vi.fn(),
};

beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
    if (key === 'useHandwriting') return 'false';
    return null;
  });

  (window as any).HanziWriter = {
    create: vi.fn().mockReturnValue(mockWriter),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as any).HanziWriter;
});

// ────────────────────────────────────────────────────────────────────────────
// Helper: render hook then apply state overrides (mirrors useTestEngine.test.ts)
// ────────────────────────────────────────────────────────────────────────────

function renderEngineWithState(
  stateOverrides: Record<string, unknown>,
  propsOverrides: Partial<Props> = {},
) {
  const props = makeProps(propsOverrides);
  const { result } = renderHook(() => useTestEngine(props));

  act(() => {
    result.current.setStateMerged(stateOverrides as any);
  });

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// refreshSettings
// ────────────────────────────────────────────────────────────────────────────

describe('useTestEngine — refreshSettings', () => {
  it('enables useSound when synthAvailable is true and settings.useSound is true', () => {
    const result = renderEngineWithState({}, { synthAvailable: true });

    act(() => {
      result.current.refreshSettings({
        useSound: true,
        useChineseSpeechRecognition: false,
        useEnglishSpeechRecognition: false,
        useAutoRecord: false,
        useFlashcards: false,
      });
    });

    expect(result.current.state.useSound).toBe(true);
  });

  it('forces useSound=false when synthAvailable is false even if settings say true', () => {
    const result = renderEngineWithState({}, { synthAvailable: false });

    act(() => {
      result.current.refreshSettings({
        useSound: true,
        useChineseSpeechRecognition: false,
        useEnglishSpeechRecognition: false,
        useAutoRecord: false,
        useFlashcards: false,
      });
    });

    expect(result.current.state.useSound).toBe(false);
  });

  it('enables useAutoRecord via refreshSettings', () => {
    const result = renderEngineWithState({});

    act(() => {
      result.current.refreshSettings({
        useSound: false,
        useChineseSpeechRecognition: false,
        useEnglishSpeechRecognition: false,
        useAutoRecord: true,
        useFlashcards: false,
      });
    });

    expect(result.current.state.useAutoRecord).toBe(true);
  });

  it('enables useFlashcards via refreshSettings', () => {
    const result = renderEngineWithState({});

    act(() => {
      result.current.refreshSettings({
        useSound: false,
        useChineseSpeechRecognition: false,
        useEnglishSpeechRecognition: false,
        useAutoRecord: false,
        useFlashcards: true,
      });
    });

    expect(result.current.state.useFlashcards).toBe(true);
  });

  it('disables speech recognition when speechAvailable is false', () => {
    const result = renderEngineWithState({}, { speechAvailable: false });

    act(() => {
      result.current.refreshSettings({
        useSound: false,
        useChineseSpeechRecognition: true,
        useEnglishSpeechRecognition: true,
        useAutoRecord: false,
        useFlashcards: false,
      });
    });

    expect(result.current.state.useChineseSpeechRecognition).toBe(false);
    expect(result.current.state.useEnglishSpeechRecognition).toBe(false);
  });

  it('enables speech recognition when speechAvailable is true', () => {
    const result = renderEngineWithState({}, { speechAvailable: true });

    act(() => {
      result.current.refreshSettings({
        useSound: false,
        useChineseSpeechRecognition: true,
        useEnglishSpeechRecognition: true,
        useAutoRecord: false,
        useFlashcards: false,
      });
    });

    expect(result.current.state.useChineseSpeechRecognition).toBe(true);
    expect(result.current.state.useEnglishSpeechRecognition).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// onToggleShowPinyin
// ────────────────────────────────────────────────────────────────────────────

describe('useTestEngine — onToggleShowPinyin', () => {
  it('toggles showQuestionPinyin when questionCategory is pinyin', () => {
    const result = renderEngineWithState({ questionCategory: 'pinyin', showQuestionPinyin: false });

    act(() => {
      result.current.onToggleShowPinyin();
    });

    expect(result.current.state.showQuestionPinyin).toBe(true);
  });

  it('toggles showQuestionPinyin back to false when already true', () => {
    const result = renderEngineWithState({ questionCategory: 'pinyin', showQuestionPinyin: true });

    act(() => {
      result.current.onToggleShowPinyin();
    });

    expect(result.current.state.showQuestionPinyin).toBe(false);
  });

  it('does not change showQuestionPinyin when questionCategory is not pinyin', () => {
    const result = renderEngineWithState({ questionCategory: 'character', showQuestionPinyin: false });

    act(() => {
      result.current.onToggleShowPinyin();
    });

    expect(result.current.state.showQuestionPinyin).toBe(false);
  });

  it('does not change showQuestionPinyin when questionCategory is meaning', () => {
    const result = renderEngineWithState({ questionCategory: 'meaning', showQuestionPinyin: false });

    act(() => {
      result.current.onToggleShowPinyin();
    });

    expect(result.current.state.showQuestionPinyin).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// showCharacter
// ────────────────────────────────────────────────────────────────────────────

describe('useTestEngine — showCharacter', () => {
  it('sets result to chosenCharacter when result is currently empty', () => {
    const result = renderEngineWithState({ chosenCharacter: '你', result: '' });

    act(() => {
      result.current.showCharacter();
    });

    expect(result.current.state.result).toBe('你');
  });

  it('clears result when it already shows the chosenCharacter (toggle off)', () => {
    const result = renderEngineWithState({ chosenCharacter: '你', result: '你' });

    act(() => {
      result.current.showCharacter();
    });

    expect(result.current.state.result).toBe('');
  });

  it('sets result to chosenCharacter even when result shows something else', () => {
    const result = renderEngineWithState({ chosenCharacter: '你', result: 'Try again' });

    act(() => {
      result.current.showCharacter();
    });

    expect(result.current.state.result).toBe('你');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// onInputChanged
// ────────────────────────────────────────────────────────────────────────────

describe('useTestEngine — onInputChanged', () => {
  it('updates answerInput with the new value', () => {
    const result = renderEngineWithState({ answerInput: '', recognition: null });

    const fakeEvent = { target: { value: 'hello' } } as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.onInputChanged(fakeEvent);
    });

    expect(result.current.state.answerInput).toBe('hello');
  });

  it('sets pauseAutoRecord to true when user types', () => {
    const result = renderEngineWithState({ answerInput: '', recognition: null, pauseAutoRecord: false });

    const fakeEvent = { target: { value: 'test' } } as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.onInputChanged(fakeEvent);
    });

    expect(result.current.state.pauseAutoRecord).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// onKeyPress
// ────────────────────────────────────────────────────────────────────────────

describe('useTestEngine — onKeyPress', () => {
  it('does nothing when the key is not Enter', () => {
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      answerInput: 'hello',
      submitDisabled: false,
    });

    const event = { key: 'a' } as React.KeyboardEvent<HTMLInputElement>;
    act(() => {
      result.current.onKeyPress(event);
    });

    // No state change — result stays empty
    expect(result.current.state.result).toBe('');
  });

  it('does not submit when Enter is pressed but answerInput is empty', () => {
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      answerInput: '',
      submitDisabled: false,
    });

    const event = { key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>;
    act(() => {
      result.current.onKeyPress(event);
    });

    expect(result.current.state.result).toBe('');
  });

  it('does not submit when submitDisabled is true', () => {
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      answerInput: 'hi',
      submitDisabled: true,
    });

    const event = { key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>;
    act(() => {
      result.current.onKeyPress(event);
    });

    // Should remain empty (no submission)
    expect(result.current.state.result).toBe('');
  });

  it('submits correctly when Enter is pressed with matching answer', () => {
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      answerInput: 'hello',
      submitDisabled: false,
      useAutoRecord: false,
      useTypingInput: false,
      recognition: null,
    });

    const event = { key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>;
    act(() => {
      result.current.onKeyPress(event);
    });

    expect(result.current.state.result).toBe('Correct');
  });

  it('clears answerInput after submitting via Enter', () => {
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      answerInput: 'hello',
      submitDisabled: false,
      useAutoRecord: false,
      useTypingInput: false,
      recognition: null,
    });

    const event = { key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>;
    act(() => {
      result.current.onKeyPress(event);
    });

    expect(result.current.state.answerInput).toBe('');
  });
});
