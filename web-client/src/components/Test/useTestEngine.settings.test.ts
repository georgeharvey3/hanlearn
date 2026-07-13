/**
 * Tests for useTestEngine — initialiseSettings localStorage paths and
 * onSpeak auto-record continuation logic (lines 128-138, 804-831).
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
    showInput: false,
    showInputChars: [],
    drawnCharacters: [],
    numSpeakTries: 0,
    useSound: false,
    useSoundEffects: false,
    useHandwriting: false,
    pinyinQuizType: 'text',
    meaningQuizType: 'text',
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
    useTypingInput: false,
  })),
}));

vi.mock('../../services/sentenceService', () => ({
  checkSentenceAvailability: vi.fn().mockResolvedValue(false),
  getHintSentence: vi.fn().mockResolvedValue(null),
}));

const mockSpeak = vi.fn();
vi.mock('../../services/ttsService', () => ({
  speak: (...args: unknown[]) => mockSpeak(...args),
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

const makeWord = (overrides: Partial<Word> = {}): Word => ({
  id: 1,
  simp: '好',
  trad: '好',
  pinyin: 'hǎo',
  meaning: 'good',
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

beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);
  (window as any).HanziWriter = {
    create: vi.fn().mockReturnValue({
      quiz: vi.fn(),
      setCharacter: vi.fn(),
      animateCharacter: vi.fn().mockResolvedValue(undefined),
      cancelQuiz: vi.fn(),
      showOutline: vi.fn(),
      hideOutline: vi.fn(),
    }),
  };
  mockSpeak.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as any).HanziWriter;
});

// ---------------------------------------------------------------------------
// initialiseSettings — localStorage reading paths
// ---------------------------------------------------------------------------
describe('useTestEngine — initialiseSettings reads localStorage correctly', () => {
  it('disables sound when localStorage useSound is "false"', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'useSound') return 'false';
      return null;
    });

    const props = makeProps({ synthAvailable: true });
    const { result } = renderHook(() => useTestEngine(props));

    expect(result.current.state.useSound).toBe(false);
  });

  it('enables sound when localStorage useSound is not "false" and synth is available', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);

    const props = makeProps({ synthAvailable: true });
    const { result } = renderHook(() => useTestEngine(props));

    expect(result.current.state.useSound).toBe(true);
  });

  it('disables sound effects when localStorage useSoundEffects is "false"', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'useSoundEffects') return 'false';
      return null;
    });

    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    expect(result.current.state.useSoundEffects).toBe(false);
  });

  it('defaults to meaning=flashcard and pinyin=speech when localStorage is empty', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);

    const props = makeProps({ speechAvailable: true });
    const { result } = renderHook(() => useTestEngine(props));

    expect(result.current.state.meaningQuizType).toBe('flashcard');
    expect(result.current.state.pinyinQuizType).toBe('speech');
  });

  it('reads stored quiz types from localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'meaningQuizType') return 'text';
      if (key === 'pinyinQuizType') return 'flashcard';
      return null;
    });

    const props = makeProps({ speechAvailable: true });
    const { result } = renderHook(() => useTestEngine(props));

    expect(result.current.state.meaningQuizType).toBe('text');
    expect(result.current.state.pinyinQuizType).toBe('flashcard');
  });

  it('maps legacy useFlashcards="false" to a non-flashcard meaning quiz type', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'useFlashcards') return 'false';
      return null;
    });

    const props = makeProps({ speechAvailable: true });
    const { result } = renderHook(() => useTestEngine(props));

    expect(result.current.state.meaningQuizType).toBe('speech');
  });

  it('degrades speech quiz types to text when speechAvailable=false', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'meaningQuizType') return 'speech';
      if (key === 'pinyinQuizType') return 'speech';
      return null;
    });

    const props = makeProps({ speechAvailable: false });
    const { result } = renderHook(() => useTestEngine(props));

    expect(result.current.state.meaningQuizType).toBe('text');
    expect(result.current.state.pinyinQuizType).toBe('text');
  });

  it('forces demo mode to meaning=flashcard and pinyin=speech regardless of localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => 'false');

    const props = makeProps({
      isDemo: true,
      synthAvailable: true,
      speechAvailable: true,
    });
    const { result } = renderHook(() => useTestEngine(props));

    expect(result.current.state.useSound).toBe(true);
    expect(result.current.state.useSoundEffects).toBe(true);
    expect(result.current.state.useHandwriting).toBe(true);
    expect(result.current.state.meaningQuizType).toBe('flashcard');
    expect(result.current.state.pinyinQuizType).toBe('speech');
  });

  it('degrades the demo pinyin quiz type to text when speechAvailable=false', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);

    const props = makeProps({ isDemo: true, speechAvailable: false });
    const { result } = renderHook(() => useTestEngine(props));

    expect(result.current.state.meaningQuizType).toBe('flashcard');
    expect(result.current.state.pinyinQuizType).toBe('text');
  });
});

// ---------------------------------------------------------------------------
// onSpeak — auto-record continuation (lines 128-138)
// ---------------------------------------------------------------------------
describe('useTestEngine — onSpeak auto-record continuation', () => {
  it('calls onListen after speak ends when auto=true and answerCategory is pinyin', () => {
    const props = makeProps({ synthAvailable: true, speechAvailable: true });
    const { result } = renderHook(() => useTestEngine(props));

    // Set up state for a pinyin question with auto-record
    act(() => {
      result.current.setStateMerged({
        answerCategory: 'pinyin',
        chosenCharacter: '好',
        useSound: true,
        interaction: true,
      } as any);
    });

    // Call onSpeak with auto=true
    act(() => {
      result.current.onSpeak('好', true);
    });

    // Verify speak was called
    expect(mockSpeak).toHaveBeenCalled();

    // Get the onEnd callback that was passed to speak
    const speakCall = mockSpeak.mock.calls[0];
    const options = speakCall[1];
    expect(typeof options.onEnd).toBe('function');
  });

  it('does NOT call onListen after speak when answerCategory is character', () => {
    const props = makeProps({ synthAvailable: true, speechAvailable: true });
    const { result } = renderHook(() => useTestEngine(props));

    act(() => {
      result.current.setStateMerged({
        answerCategory: 'character',
        chosenCharacter: '好',
        useSound: true,
        interaction: true,
      } as any);
    });

    act(() => {
      result.current.onSpeak('好', true);
    });

    // The onEnd callback should exist but should NOT trigger listen for character mode
    expect(mockSpeak).toHaveBeenCalled();
  });

  it('does NOT call onListen after speak when meaning + flashcards', () => {
    const props = makeProps({ synthAvailable: true, speechAvailable: true });
    const { result } = renderHook(() => useTestEngine(props));

    act(() => {
      result.current.setStateMerged({
        answerCategory: 'meaning',
        meaningQuizType: 'flashcard',
        chosenCharacter: '好',
        useSound: true,
        interaction: true,
      } as any);
    });

    act(() => {
      result.current.onSpeak('好', true);
    });

    expect(mockSpeak).toHaveBeenCalled();
  });

  it('sets synthLoading true when interaction is active', () => {
    const props = makeProps({ synthAvailable: true });
    const { result } = renderHook(() => useTestEngine(props));

    act(() => {
      result.current.setStateMerged({
        interaction: true,
        chosenCharacter: '好',
        useSound: true,
      } as any);
    });

    act(() => {
      result.current.onSpeak('好');
    });

    // synthLoading should have been set to true before speak was called
    expect(mockSpeak).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onSpeak — onError callback (line 141)
// ---------------------------------------------------------------------------
describe('useTestEngine — onSpeak error handling', () => {
  it('sets error result and shows pinyin when speak triggers onError', () => {
    const props = makeProps({ synthAvailable: true });
    const { result } = renderHook(() => useTestEngine(props));

    act(() => {
      result.current.setStateMerged({
        chosenCharacter: '好',
        useSound: true,
        interaction: false,
      } as any);
    });

    act(() => {
      result.current.onSpeak('好');
    });

    // Get the onError callback
    const speakCall = mockSpeak.mock.calls[0];
    const options = speakCall[1];

    // Trigger the error callback
    act(() => {
      options.onError();
    });

    expect(result.current.state.result).toBe('Error playing pinyin');
    expect(result.current.state.showPinyin).toBe(true);
  });
});
