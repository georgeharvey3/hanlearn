/**
 * Tests for useTestEngine hint paths not covered by the main test file:
 * - showSentenceHint when getHintSentence returns null
 * - showSentenceHint when useSound=false (pinyin result path)
 * - showSentenceHint when getHintSentence rejects (error path)
 * - onHint toggle-off with character writer (hideOutline call)
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

vi.mock('../../services/ttsService', () => ({
  speak: vi.fn(() => ({ play: vi.fn(), stop: vi.fn() })),
  prefetch: vi.fn(),
  stopAll: vi.fn(),
}));

vi.mock('pinyin-pro', () => ({
  pinyin: vi.fn((text: string, opts?: { type?: string; toneType?: string }) =>
    opts?.type === 'array' ? text.split('').map((c: string) => c) : text.split('').join(' '),
  ),
}));

import { renderHook, act } from '@testing-library/react';
import { useTestEngine } from './useTestEngine';
import { getHintSentence } from '../../services/sentenceService';
import { pinyin } from 'pinyin-pro';
import { Word } from '../../types/models';
import { Props } from './types';

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
// showSentenceHint — null sentence (line 701-703)
// ---------------------------------------------------------------------------
describe('useTestEngine — showSentenceHint when sentence is null', () => {
  it('sets result to "No example sentence found" when getHintSentence returns null', async () => {
    vi.mocked(getHintSentence).mockResolvedValueOnce(null);

    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      chosenCharacter: '你好',
      showHint: false,
      useSound: false,
    });

    await act(async () => {
      result.current.onHint();
    });

    expect(result.current.state.result).toBe('No example sentence found');
    expect(result.current.state.hintLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// showSentenceHint — useSound=false path (lines 709-715)
// ---------------------------------------------------------------------------
describe('useTestEngine — showSentenceHint with useSound=false shows pinyin', () => {
  it('displays pinyin result instead of playing audio when useSound is false', async () => {
    vi.mocked(getHintSentence).mockResolvedValueOnce({
      chinese: '你好吗',
      english: 'How are you?',
    });

    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      chosenCharacter: '你好',
      showHint: false,
      useSound: false,
    });

    await act(async () => {
      result.current.onHint();
    });

    // pinyin mock joins chars with space: '你 好 吗'
    expect(vi.mocked(pinyin)).toHaveBeenCalledWith('你好吗', { toneType: 'num' });
    expect(result.current.state.showHint).toBe(true);
    expect(result.current.state.hintLoading).toBe(false);
    // result should contain the pinyin output
    expect(result.current.state.result).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// showSentenceHint — error/catch path (lines 717-718)
// ---------------------------------------------------------------------------
describe('useTestEngine — showSentenceHint when getHintSentence rejects', () => {
  it('sets result to "Could not load hint" on error', async () => {
    vi.mocked(getHintSentence).mockRejectedValueOnce(new Error('network failure'));

    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      chosenCharacter: '你好',
      showHint: false,
      useSound: false,
    });

    await act(async () => {
      result.current.onHint();
    });

    expect(result.current.state.result).toBe('Could not load hint');
    expect(result.current.state.hintLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// onHint toggle-off with character writer (line 727-728)
// ---------------------------------------------------------------------------
describe('useTestEngine — onHint dismiss hides character outline', () => {
  it('calls writer.hideOutline when toggling hint off for character answer', () => {
    mockWriter.hideOutline.mockClear();

    const result = renderEngineWithState({
      answerCategory: 'character',
      writer: mockWriter,
      showHint: true,
      result: 'some hint text',
    });

    act(() => {
      result.current.onHint();
    });

    expect(mockWriter.hideOutline).toHaveBeenCalled();
    expect(result.current.state.showHint).toBe(false);
    expect(result.current.state.result).toBe('');
  });

  it('does NOT call hideOutline when toggling hint off for non-character answer', () => {
    mockWriter.hideOutline.mockClear();

    const result = renderEngineWithState({
      answerCategory: 'pinyin',
      answer: 'ni3 hao3',
      showHint: true,
      result: 'Hint: n__ h__',
    });

    act(() => {
      result.current.onHint();
    });

    expect(mockWriter.hideOutline).not.toHaveBeenCalled();
    expect(result.current.state.showHint).toBe(false);
  });
});
