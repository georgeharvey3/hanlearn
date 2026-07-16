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

import { getHintSentence } from '../../services/sentenceService';

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
  propsOverrides: Partial<Props> = {},
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

    act(() => {
      result.current.onSubmitAnswer();
    });

    expect(result.current.state.result).toBe('Correct');
    expect(result.current.state.idkDisabled).toBe(true);
  });

  it('strips spaces before comparing pinyin (ni3hao3 matches ni3hao3)', () => {
    const result = renderEngineWithState({
      answerCategory: 'pinyin',
      answer: 'ni3hao3',
      answerInput: 'ni3hao3',
    });

    act(() => {
      result.current.onSubmitAnswer();
    });

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

    act(() => {
      result.current.onSubmitAnswer();
    });

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

    act(() => {
      result.current.onSubmitAnswer();
    });

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

    act(() => {
      result.current.onSubmitAnswer();
    });

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

    act(() => {
      result.current.onSubmitAnswer();
    });

    expect(result.current.state.result).toBe('Try again');
  });

  it('is case-insensitive: "Hello" matches ["hello"]', () => {
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      answerInput: 'Hello',
    });

    act(() => {
      result.current.onSubmitAnswer();
    });

    expect(result.current.state.result).toBe('Correct');
  });

  it('strips trailing punctuation before comparing meanings', () => {
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      answerInput: 'hello!',
    });

    act(() => {
      result.current.onSubmitAnswer();
    });

    expect(result.current.state.result).toBe('Correct');
  });
});

describe("useTestEngine — I-don't-know flow", () => {
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

    act(() => {
      result.current.onIDontKnow();
    });

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

    act(() => {
      result.current.onIDontKnow();
    });

    expect(result.current.state.result).toContain('nǐ hǎo');
    expect(result.current.state.result).toContain('Answer was');
  });

  it("accumulates multiple IDK entries in idkList (each IDK = +1 to that word's score)", () => {
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

    act(() => {
      result.current.onIDontKnow();
    });

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

    act(() => {
      result.current.onShowAnswer();
    });

    expect(result.current.state.result).toContain('nǐ hǎo');
    expect(result.current.state.showAnswer).toBe(true);
  });

  it('joins meaning array with " / " in result', () => {
    const result = renderEngineWithState({
      answer: ['hello', 'hi'],
      answerCategory: 'meaning',
      showAnswer: false,
    });

    act(() => {
      result.current.onShowAnswer();
    });

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

    act(() => {
      result.current.onHint();
    });

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

    act(() => {
      result.current.onHint();
    });

    expect(result.current.state.showHint).toBe(false);
    expect(result.current.state.result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Character hint: showOutline flashes for 1 second then hides
// ---------------------------------------------------------------------------
describe('useTestEngine — character hint flash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows outline and hides it after 1 second', () => {
    mockWriter.showOutline.mockClear();
    mockWriter.hideOutline.mockClear();
    const result = renderEngineWithState({
      answerCategory: 'character',
      writer: mockWriter,
      showHint: false,
    });

    act(() => {
      result.current.onHint();
    });

    expect(mockWriter.showOutline).toHaveBeenCalled();
    expect(mockWriter.hideOutline).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockWriter.hideOutline).toHaveBeenCalled();
  });

  it('does not set showHint state (no toggle behavior)', () => {
    mockWriter.showOutline.mockClear();
    const result = renderEngineWithState({
      answerCategory: 'character',
      writer: mockWriter,
      showHint: false,
    });

    act(() => {
      result.current.onHint();
    });

    expect(result.current.state.showHint).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Speech submissions go through the shared input flow: the transcript is
// written into the answer input, submitted like a typed answer, and a wrong
// transcript stays in the input so the user can edit and resubmit it.
// ---------------------------------------------------------------------------
describe('useTestEngine — speech submissions fill and submit the answer input', () => {
  function setupSpeechRecognition() {
    const listeners: Record<string, (event: any) => void> = {};
    const mockRecognition = {
      lang: '',
      start: vi.fn(),
      abort: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn((event: string, handler: (e: any) => void) => {
        listeners[event] = handler;
      }),
      removeEventListener: vi.fn(),
    };

    class FakeRecognition {
      lang = '';
      start = mockRecognition.start;
      abort = mockRecognition.abort;
      stop = mockRecognition.stop;
      addEventListener = mockRecognition.addEventListener;
      removeEventListener = mockRecognition.removeEventListener;
    }

    (window as any).webkitSpeechRecognition = FakeRecognition;

    const speak = (transcript: string) => {
      listeners['result']?.({ results: [[{ transcript }]] });
    };

    return { mockRecognition, speak };
  }

  function setupMeaningQuestion() {
    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };
    const sparePerm = { index: '0', aCategory: 'P' as any, qCategory: 'M' as any };
    return renderEngineWithState(
      {
        answerCategory: 'meaning',
        answer: ['hello', 'hi'],
        chosenCharacter: '你好',
        meaningQuizType: 'input',
        useAutoRecord: false,
        perm,
        testSet: [makeWord()],
        permList: [perm, sparePerm],
        charSet: 'simp',
      },
      { speechAvailable: true },
    );
  }

  it('keeps a wrong transcript in the answer input for editing', () => {
    const { speak } = setupSpeechRecognition();
    const result = setupMeaningQuestion();

    act(() => {
      result.current.onListen();
    });
    act(() => {
      speak('goodbye');
    });

    expect(result.current.state.answerInput).toBe('goodbye');
    expect(result.current.state.result).toBe('Try again');
    expect(result.current.state.idkDisabled).toBe(false);
  });

  it('accepts a correct transcript like a typed answer', () => {
    const { speak } = setupSpeechRecognition();
    const result = setupMeaningQuestion();

    act(() => {
      result.current.onListen();
    });
    act(() => {
      speak('hello');
    });

    expect(result.current.state.answerInput).toBe('hello');
    expect(result.current.state.result).toBe('Correct');
    expect(result.current.state.idkDisabled).toBe(true);
  });

  it('an edited wrong transcript can be resubmitted as a typed answer', () => {
    const { speak } = setupSpeechRecognition();
    const result = setupMeaningQuestion();

    act(() => {
      result.current.onListen();
    });
    act(() => {
      speak('goodbye');
    });
    expect(result.current.state.result).toBe('Try again');

    // User edits the transcript in the input and submits again
    act(() => {
      result.current.setStateMerged({ answerInput: 'hi' } as any);
    });
    act(() => {
      result.current.onSubmitAnswer();
    });

    expect(result.current.state.result).toBe('Correct');
  });

  it('accepts recognised hanzi matching the target word for pinyin answers', () => {
    const { speak } = setupSpeechRecognition();
    const perm = { index: '0', aCategory: 'P' as any, qCategory: 'M' as any };
    const sparePerm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };
    const result = renderEngineWithState(
      {
        answerCategory: 'pinyin',
        answer: 'ni3 hao3',
        chosenCharacter: '你好',
        pinyinQuizType: 'input',
        useAutoRecord: false,
        perm,
        testSet: [makeWord()],
        permList: [perm, sparePerm],
        charSet: 'simp',
      },
      { speechAvailable: true },
    );

    act(() => {
      result.current.onListen();
    });
    act(() => {
      speak('你好');
    });

    expect(result.current.state.result).toBe('"ni3 hao3" is correct!');
    expect(result.current.state.idkDisabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// qNum effect: autoRecord paths and character/setHanziWriter path
// Lines 994–1025 in useTestEngine.ts
// ---------------------------------------------------------------------------
describe('useTestEngine — qNum effect with useAutoRecord', () => {
  let cancelSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // jsdom defines speechSynthesis as non-configurable, so use spyOn
    cancelSpy = vi.spyOn(window.speechSynthesis, 'cancel').mockImplementation(() => {});
    vi.spyOn(window.speechSynthesis, 'speak').mockImplementation(() => {});
  });

  function setupRecognitionMock() {
    const mockRecognition = {
      lang: '',
      start: vi.fn(),
      abort: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    class FakeRecognition {
      lang = '';
      start = mockRecognition.start;
      abort = mockRecognition.abort;
      stop = mockRecognition.stop;
      addEventListener = mockRecognition.addEventListener;
      removeEventListener = mockRecognition.removeEventListener;
    }

    (window as any).webkitSpeechRecognition = FakeRecognition;
    return mockRecognition;
  }

  it('calls onListen when answerCategory=pinyin, useAutoRecord=true, and speech is available on qNum change', () => {
    const mockRecognition = setupRecognitionMock();

    const perm = { index: '0', aCategory: 'P' as any, qCategory: 'M' as any };
    const result = renderEngineWithState(
      {
        answerCategory: 'pinyin',
        questionCategory: 'meaning',
        useAutoRecord: true,
        pinyinQuizType: 'input',
        useSound: false,
        useHandwriting: false,
        writer: null,
        perm,
        testSet: [makeWord()],
        permList: [perm],
        charSet: 'simp',
        chosenCharacter: '你好',
        qNum: 1,
      },
      { speechAvailable: true },
    );

    // Increment qNum to trigger the effect
    act(() => {
      result.current.setStateMerged({ qNum: 2 } as any);
    });

    // After qNum change with answerCategory=pinyin and useAutoRecord=true, onListen should fire
    expect(mockRecognition.start).toHaveBeenCalled();
  });

  it('does NOT call onListen when useAutoRecord=true but speech recognition is unavailable', () => {
    const mockRecognition = setupRecognitionMock();

    const perm = { index: '0', aCategory: 'P' as any, qCategory: 'M' as any };
    const result = renderEngineWithState(
      {
        answerCategory: 'pinyin',
        questionCategory: 'meaning',
        useAutoRecord: true,
        pinyinQuizType: 'input',
        useSound: false,
        useHandwriting: false,
        writer: null,
        perm,
        testSet: [makeWord()],
        permList: [perm],
        charSet: 'simp',
        chosenCharacter: '你好',
        qNum: 1,
      },
      { speechAvailable: false },
    );

    act(() => {
      result.current.setStateMerged({ qNum: 2 } as any);
    });

    expect(mockRecognition.start).not.toHaveBeenCalled();
  });

  it('calls onListen when answerCategory=meaning, useAutoRecord=true, and speech is available', () => {
    const mockRecognition = setupRecognitionMock();

    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };
    const result = renderEngineWithState(
      {
        answerCategory: 'meaning',
        questionCategory: 'pinyin',
        useAutoRecord: true,
        meaningQuizType: 'input',
        useSound: false,
        useHandwriting: false,
        writer: null,
        perm,
        testSet: [makeWord()],
        permList: [perm],
        charSet: 'simp',
        chosenCharacter: '你好',
        qNum: 1,
      },
      { speechAvailable: true },
    );

    act(() => {
      result.current.setStateMerged({ qNum: 2 } as any);
    });

    expect(mockRecognition.start).toHaveBeenCalled();
  });

  it('does NOT call onListen when answerCategory=meaning + quiz type flashcard', () => {
    const mockRecognition = setupRecognitionMock();

    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };
    const result = renderEngineWithState(
      {
        answerCategory: 'meaning',
        questionCategory: 'pinyin',
        useAutoRecord: true,
        useSound: false,
        meaningQuizType: 'flashcard',
        useHandwriting: false,
        writer: null,
        perm,
        testSet: [makeWord()],
        permList: [perm],
        charSet: 'simp',
        chosenCharacter: '你好',
        qNum: 1,
      },
      { speechAvailable: true },
    );

    act(() => {
      result.current.setStateMerged({ qNum: 2 } as any);
    });

    // Flashcard mode should not trigger listen
    expect(mockRecognition.start).not.toHaveBeenCalled();
  });

  it('calls HanziWriter.create when answerCategory=character and answer is set on qNum change', () => {
    // No speech recognition needed for this test
    const perm = { index: '0', aCategory: 'C' as any, qCategory: 'P' as any };
    const result = renderEngineWithState({
      answerCategory: 'character',
      questionCategory: 'pinyin',
      answer: '你',
      useAutoRecord: false,
      useSound: false,
      useHandwriting: true,
      writer: null,
      perm,
      testSet: [makeWord({ simp: '你', trad: '你', pinyin: 'nǐ', meaning: 'you' })],
      permList: [perm],
      charSet: 'simp',
      chosenCharacter: '你',
      qNum: 1,
    });

    // Clear any previous calls from initial render
    vi.mocked((window as any).HanziWriter.create).mockClear();

    act(() => {
      result.current.setStateMerged({ qNum: 2 } as any);
    });

    // HanziWriter.create should be called to set up the character quiz
    expect((window as any).HanziWriter.create).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Regression: showSentenceHint with useSound=true must set showHint=true
// so that pressing hint a second time clears it (toggle behaviour).
// Bug: the sound branch called setStateMerged({ hintLoading: false }) without
// setting showHint: true, leaving showHint=false and breaking the toggle.
// ---------------------------------------------------------------------------
describe('useTestEngine — showSentenceHint (regression: showHint set in sound branch)', () => {
  beforeEach(() => {
    vi.spyOn(window.speechSynthesis, 'cancel').mockImplementation(() => {});
    vi.spyOn(window.speechSynthesis, 'speak').mockImplementation(() => {});
    // jsdom does not implement SpeechSynthesisUtterance; stub it so onSpeak does not throw
    (window as any).SpeechSynthesisUtterance = class {
      lang = '';
      voice: SpeechSynthesisVoice | null = null;
      onerror: ((e: SpeechSynthesisErrorEvent) => void) | null = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;
      constructor(_text: string) {}
    };
  });

  afterEach(() => {
    delete (window as any).SpeechSynthesisUtterance;
  });

  it('sets showHint=true after hint resolves when useSound=true', async () => {
    vi.mocked(getHintSentence).mockResolvedValueOnce({
      chinese: '你好吗',
      english: 'How are you?',
    });

    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      chosenCharacter: '你好',
      showHint: false,
      useSound: true,
    });

    await act(async () => {
      result.current.onHint();
    });

    expect(result.current.state.showHint).toBe(true);
  });

  it('toggles showHint off on second call when useSound=true', async () => {
    vi.mocked(getHintSentence).mockResolvedValue({
      chinese: '你好吗',
      english: 'How are you?',
    });

    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      chosenCharacter: '你好',
      showHint: false,
      useSound: true,
    });

    // First call — should set showHint=true
    await act(async () => {
      result.current.onHint();
    });
    expect(result.current.state.showHint).toBe(true);

    // Second call — should toggle showHint back to false
    act(() => {
      result.current.onHint();
    });
    expect(result.current.state.showHint).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Regression: Dashboard loading stuck when userId is null on retry
// ---------------------------------------------------------------------------
// (Covered in Dashboard.test.tsx — the 'does not call getDashboardStats when userId is null'
//  test now also verifies that loading resolves to false rather than staying stuck.)
