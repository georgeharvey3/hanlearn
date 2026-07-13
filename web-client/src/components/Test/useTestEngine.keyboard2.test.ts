/**
 * Additional keyboard tests for useTestEngine — covers previously untested paths:
 * - Ctrl+B focuses the answer input
 * - Spacebar + flashcards + meaning triggers onShowAnswer
 * - Spacebar + speaker available triggers onSpeak
 * - Spacebar when testFinished is ignored
 * - onFocusEntry scrolls to q-phrase-box
 * - onInputChanged aborts recognition and updates answerInput
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
    answerCategory: null,
    question: null,
    questionCategory: null,
    chosenCharacter: null,
    result: '',
    answerInput: '',
    idkDisabled: false,
    submitDisabled: false,
    progressBar: 0,
    initNumPerms: 0,
    idkList: [],
    scoreList: [],
    testFinished: false,
    showInputChars: [],
    drawnCharacters: [],
    numSpeakTries: 0,
    useSound: false,
    useHandwriting: false,
    pinyinQuizType: 'input',
    meaningQuizType: 'input',
    useAutoRecord: false,
    showErrorMessage: false,
    redoChar: false,
    sentenceWords: [],
    sentenceCheckStatus: 'idle',
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
    useSoundEffects: false,
  })),
}));

vi.mock('../../services/sentenceService', () => ({
  checkSentenceAvailability: vi.fn().mockResolvedValue(false),
  getHintSentence: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/ttsService', () => ({
  speak: vi.fn(() => ({ play: vi.fn(), stop: vi.fn() })),
  prefetch: vi.fn(),
  stopAll: vi.fn(),
}));

vi.mock('pinyin-pro', () => ({
  pinyin: vi.fn((text: string, opts?: { type?: string }) =>
    opts?.type === 'array' ? text.split('').map((c: string) => c) : text.split('').join(' '),
  ),
}));

import { renderHook, act } from '@testing-library/react';
import { useTestEngine } from './useTestEngine';
import { Word } from '../../types/models';
import { Props } from './types';
import * as ttsService from '../../services/ttsService';

const makeWord = (overrides: Partial<Word> = {}): Word => ({
  id: 1,
  simp: '你好',
  trad: '你好',
  pinyin: 'nǐ hǎo',
  meaning: 'hello/hi',
  level: 1,
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

function fireKeyUp(key: string, options: Partial<KeyboardEventInit> = {}) {
  document.body.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, ...options }));
}

beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
    if (key === 'useHandwriting') return 'false';
    return null;
  });

  (window as any).HanziWriter = {
    create: vi.fn().mockReturnValue(mockWriter),
  };

  vi.spyOn(window.speechSynthesis, 'cancel').mockImplementation(() => {});
  vi.spyOn(window.speechSynthesis, 'speak').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as any).HanziWriter;
  (window as any).webkitSpeechRecognition = undefined;
});

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

// ---------------------------------------------------------------------------
// Ctrl+B focuses answer-input element
// ---------------------------------------------------------------------------
describe('useTestEngine — keyboard Ctrl+B focuses input', () => {
  it('focuses the answer-input element when it exists', () => {
    const input = document.createElement('input');
    input.id = 'answer-input';
    document.body.appendChild(input);
    const focusSpy = vi.spyOn(input, 'focus');

    renderEngineWithState({});

    act(() => {
      fireKeyUp('b', { ctrlKey: true });
    });

    expect(focusSpy).toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('does nothing when the input element does not exist', () => {
    // Just verifying no error is thrown
    renderEngineWithState({});

    act(() => {
      fireKeyUp('b', { ctrlKey: true });
    });
    // No assertion needed — the test passes if no error is thrown
  });
});

// ---------------------------------------------------------------------------
// Spacebar + flashcards + meaning triggers onShowAnswer
// ---------------------------------------------------------------------------
describe('useTestEngine — spacebar triggers onShowAnswer in flashcard mode', () => {
  it('reveals the answer when spacebar pressed with meaningQuizType=flashcard', () => {
    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      chosenCharacter: '你好',
      perm,
      testSet: [makeWord()],
      permList: [perm],
      charSet: 'simp',
      meaningQuizType: 'flashcard',
      pinyinQuizType: 'input',
      testFinished: false,
      listening: false,
    });

    act(() => {
      fireKeyUp(' ');
    });

    expect(result.current.state.showAnswer).toBe(true);
  });

  it('reveals the answer when spacebar pressed with pinyinQuizType=flashcard', () => {
    const perm = { index: '0', aCategory: 'P' as any, qCategory: 'M' as any };
    const result = renderEngineWithState({
      answerCategory: 'pinyin',
      questionCategory: 'meaning',
      answer: 'ni3 hao3',
      chosenCharacter: '你好',
      perm,
      testSet: [makeWord()],
      permList: [perm],
      charSet: 'simp',
      pinyinQuizType: 'flashcard',
      testFinished: false,
      listening: false,
    });

    act(() => {
      fireKeyUp(' ');
    });

    expect(result.current.state.showAnswer).toBe(true);
    expect(result.current.state.result).toBe("Answer was: 'ni3 hao3'");
  });
});

// ---------------------------------------------------------------------------
// Spacebar + speaker available triggers onSpeak
// ---------------------------------------------------------------------------
describe('useTestEngine — spacebar triggers onSpeak when speaker available', () => {
  it('calls ttsService.speak when spacebar pressed with useSound=true and questionCategory=pinyin', () => {
    vi.mocked(ttsService.speak).mockClear();

    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };
    renderEngineWithState({
      answerCategory: 'meaning',
      questionCategory: 'pinyin',
      chosenCharacter: '你好',
      perm,
      testSet: [makeWord()],
      permList: [perm],
      charSet: 'simp',
      useSound: true,
      pinyinQuizType: 'input',
      meaningQuizType: 'input',
      testFinished: false,
      listening: false,
    });

    act(() => {
      fireKeyUp(' ');
    });

    expect(ttsService.speak).toHaveBeenCalledWith('你好', expect.any(Object));
  });
});

// ---------------------------------------------------------------------------
// Spacebar when testFinished is ignored
// ---------------------------------------------------------------------------
describe('useTestEngine — spacebar ignored when test is finished', () => {
  it('does not trigger any action when spacebar pressed and testFinished=true', () => {
    vi.mocked(ttsService.speak).mockClear();

    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      chosenCharacter: '你好',
      perm,
      testSet: [makeWord()],
      permList: [perm],
      charSet: 'simp',
      useSound: true,
      questionCategory: 'pinyin',
      testFinished: true,
      listening: false,
    });

    const stateBefore = { ...result.current.state };

    act(() => {
      fireKeyUp(' ');
    });

    // speak should not be called since testFinished=true
    expect(ttsService.speak).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onFocusEntry scrolls to q-phrase-box
// ---------------------------------------------------------------------------
describe('useTestEngine — onFocusEntry scrolls to q-phrase-box', () => {
  it('calls window.scrollTo when q-phrase-box element exists', () => {
    const el = document.createElement('div');
    el.id = 'q-phrase-box';
    Object.defineProperty(el, 'offsetTop', { value: 200 });
    document.body.appendChild(el);

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    act(() => {
      const fakeEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.FocusEvent<HTMLInputElement>;
      result.current.onFocusEntry(fakeEvent);
    });

    expect(scrollToSpy).toHaveBeenCalledWith(0, 195);
    document.body.removeChild(el);
  });
});

// ---------------------------------------------------------------------------
// onInputChanged updates answerInput and aborts recognition
// ---------------------------------------------------------------------------
describe('useTestEngine — onInputChanged updates state', () => {
  it('sets answerInput and pauseAutoRecord when input changes', () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    act(() => {
      const fakeEvent = {
        target: { value: 'test answer' },
      } as React.ChangeEvent<HTMLInputElement>;
      result.current.onInputChanged(fakeEvent);
    });

    expect(result.current.state.answerInput).toBe('test answer');
    expect(result.current.state.pauseAutoRecord).toBe(true);
  });

  it('aborts active recognition when input changes', () => {
    const mockAbort = vi.fn();
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    act(() => {
      result.current.setStateMerged({
        recognition: { abort: mockAbort } as any,
      } as any);
    });

    act(() => {
      const fakeEvent = {
        target: { value: 'x' },
      } as React.ChangeEvent<HTMLInputElement>;
      result.current.onInputChanged(fakeEvent);
    });

    expect(mockAbort).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onFinishTest sentence-check: catch path when checkSentenceAvailability rejects
// ---------------------------------------------------------------------------
describe('useTestEngine — onFinishTest handles sentence check rejection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats rejected sentence checks as unavailable and calls onVocabComplete', async () => {
    const { checkSentenceAvailability } = await import('../../services/sentenceService');
    vi.mocked(checkSentenceAvailability).mockRejectedValue(new Error('Network error'));

    const onVocabComplete = vi.fn();
    const level1Word = makeWord({ id: 1, level: 1 });
    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };

    const result = renderEngineWithState(
      {
        answerCategory: 'meaning',
        answer: ['hello'],
        answerInput: 'hello',
        chosenCharacter: '你好',
        perm,
        testSet: [level1Word],
        permList: [perm],
        charSet: 'simp',
        idkList: [],
        useAutoRecord: false,
        recognition: null,
      },
      {
        words: [level1Word],
        isDemo: false,
        practiceMode: false,
        finalStage: false,
        onVocabComplete,
        onFinishTest: vi.fn(),
      },
    );

    act(() => {
      result.current.onSubmitAnswer();
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onVocabComplete).toHaveBeenCalled();
  });
});
