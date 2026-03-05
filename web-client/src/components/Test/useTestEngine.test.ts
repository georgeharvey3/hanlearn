/**
 * Tests for useTestEngine hook — the core vocabulary test engine.
 * Covers answer checking (pinyin & meaning), wrong-answer flow, and the
 * I-don't-know flow that feeds into final test scoring.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock modules that have audio/external dependencies before importing the hook
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
    useChineseSpeechRecognition: false,
    useEnglishSpeechRecognition: false,
    useAutoRecord: false,
    useFlashcards: false,
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

vi.mock('pinyin', () => {
  const pinyinFn = vi.fn((text: string) => text.split('').map((c: string) => [c]));
  pinyinFn.STYLE_TONE2 = 'STYLE_TONE2';
  return { default: pinyinFn };
});

import { renderHook, act } from '@testing-library/react';
import { useTestEngine } from './useTestEngine';
import { Word } from '../../types/models';
import { Props } from './types';

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
  history: { push: vi.fn(), replace: vi.fn(), go: vi.fn(), goBack: vi.fn(), goForward: vi.fn() } as any,
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
  // Prevent useHandwriting from being enabled via localStorage (avoids HanziWriter calls)
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

/**
 * Render the hook then immediately apply state overrides.
 * Initial effects (initialiseSettings) run inside renderHook's internal act,
 * then we override specific fields for each test scenario.
 */
function renderEngineWithState(
  stateOverrides: Record<string, unknown>,
  propsOverrides: Partial<Props> = {}
) {
  const props = makeProps(propsOverrides);
  const { result } = renderHook(() => useTestEngine(props));

  act(() => {
    result.current.setStateMerged(stateOverrides as any);
  });

  return result;
}

describe('useTestEngine — checkAnswer for pinyin answers', () => {
  it('marks answer correct when pinyin input matches exactly', () => {
    const result = renderEngineWithState({
      answerCategory: 'pinyin',
      answer: 'nǐ hǎo',
      answerInput: 'nǐ hǎo',
    });

    act(() => { result.current.onSubmitAnswer(); });

    expect(result.current.state.result).toBe('Correct');
    expect(result.current.state.idkDisabled).toBe(true);
  });

  it('strips spaces before comparing pinyin (ni3hao3 matches ni3hao3)', () => {
    const result = renderEngineWithState({
      answerCategory: 'pinyin',
      answer: 'ni3hao3',
      answerInput: 'ni3hao3',
    });

    act(() => { result.current.onSubmitAnswer(); });

    expect(result.current.state.result).toBe('Correct');
  });

  it('shows "Try again" when pinyin answer is completely wrong', () => {
    const result = renderEngineWithState({
      answerCategory: 'pinyin',
      answer: 'nǐ hǎo',
      answerInput: 'wrong',
      useAutoRecord: false,
      recognition: null,
    });

    act(() => { result.current.onSubmitAnswer(); });

    expect(result.current.state.result).toBe('Try again');
  });

  it('shows "Incorrect tones" when syllables match but tone numbers differ', () => {
    const result = renderEngineWithState({
      answerCategory: 'pinyin',
      answer: 'ni3hao3',
      answerInput: 'ni1hao1',
      useAutoRecord: false,
      recognition: null,
    });

    act(() => { result.current.onSubmitAnswer(); });

    expect(result.current.state.result).toBe('Incorrect tones');
  });
});

describe('useTestEngine — checkAnswer for meaning answers', () => {
  it('marks answer correct when input matches one meaning in the array', () => {
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello', 'hi', 'hey'],
      answerInput: 'hi',
    });

    act(() => { result.current.onSubmitAnswer(); });

    expect(result.current.state.result).toBe('Correct');
  });

  it('marks answer wrong when input matches none of the meanings', () => {
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello', 'hi', 'hey'],
      answerInput: 'goodbye',
      useAutoRecord: false,
      recognition: null,
    });

    act(() => { result.current.onSubmitAnswer(); });

    expect(result.current.state.result).toBe('Try again');
  });

  it('is case-insensitive: "Hello" matches ["hello"]', () => {
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      answerInput: 'Hello',
    });

    act(() => { result.current.onSubmitAnswer(); });

    expect(result.current.state.result).toBe('Correct');
  });

  it('strips trailing punctuation before comparing meanings', () => {
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      answerInput: 'hello!',
    });

    act(() => { result.current.onSubmitAnswer(); });

    expect(result.current.state.result).toBe('Correct');
  });
});

describe('useTestEngine — I-don\'t-know flow', () => {
  it('adds the chosen character to idkList when IDK is triggered', () => {
    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };

    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      chosenCharacter: '你好',
      perm,
      testSet: [makeWord()],
      permList: [perm],
      charSet: 'simp',
      idkList: [],
      idkDisabled: false,
      useHandwriting: false,
      writer: null,
    });

    act(() => { result.current.onIDontKnow(); });

    expect(result.current.state.idkList).toContain('你好');
    expect(result.current.state.idkDisabled).toBe(true);
  });

  it('shows the correct answer in result text when IDK is triggered', () => {
    const perm = { index: '0', aCategory: 'P' as any, qCategory: 'M' as any };

    const result = renderEngineWithState({
      answerCategory: 'pinyin',
      answer: 'nǐ hǎo',
      chosenCharacter: '你好',
      perm,
      testSet: [makeWord()],
      permList: [perm],
      charSet: 'simp',
      idkList: [],
      idkDisabled: false,
      useHandwriting: false,
      writer: null,
    });

    act(() => { result.current.onIDontKnow(); });

    expect(result.current.state.result).toContain('nǐ hǎo');
    expect(result.current.state.result).toContain('Answer was');
  });

  it('accumulates multiple IDK entries in idkList (each IDK = +1 to that word\'s score)', () => {
    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };
    const testWord = makeWord();

    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      chosenCharacter: '你好',
      perm,
      testSet: [testWord],
      permList: [perm],
      charSet: 'simp',
      idkList: ['你好'], // already has one IDK
      idkDisabled: false,
      useHandwriting: false,
      writer: null,
    });

    act(() => { result.current.onIDontKnow(); });

    expect(result.current.state.idkList.filter((c) => c === '你好')).toHaveLength(2);
  });
});

describe('useTestEngine — onShowAnswer', () => {
  it('shows a string answer in result', () => {
    const result = renderEngineWithState({
      answer: 'nǐ hǎo',
      answerCategory: 'pinyin',
      showAnswer: false,
    });

    act(() => { result.current.onShowAnswer(); });

    expect(result.current.state.result).toContain('nǐ hǎo');
    expect(result.current.state.showAnswer).toBe(true);
  });

  it('joins meaning array with " / " in result', () => {
    const result = renderEngineWithState({
      answer: ['hello', 'hi'],
      answerCategory: 'meaning',
      showAnswer: false,
    });

    act(() => { result.current.onShowAnswer(); });

    expect(result.current.state.result).toContain('hello / hi');
    expect(result.current.state.showAnswer).toBe(true);
  });
});

describe('useTestEngine — pinyin hint', () => {
  it('shows a Hint: prefix with initial letters and underscores for each syllable', () => {
    const result = renderEngineWithState({
      answerCategory: 'pinyin',
      answer: 'ni3 hao3',
      showHint: false,
    });

    act(() => { result.current.onHint(); });

    expect(result.current.state.result).toMatch(/Hint:/);
    expect(result.current.state.showHint).toBe(true);
  });

  it('toggles hint off when onHint is called while hint is already shown', () => {
    const result = renderEngineWithState({
      answerCategory: 'pinyin',
      answer: 'ni3 hao3',
      showHint: true,
      result: 'Hint: ni3__ hao3__',
    });

    act(() => { result.current.onHint(); });

    expect(result.current.state.showHint).toBe(false);
    expect(result.current.state.result).toBe('');
  });
});
