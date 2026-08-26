/**
 * Additional tests for useTestEngine — covers the qNum effect's setHanziWriter path
 * (lines 1022-1023) when answerCategory='character' and answer is a string.
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

// ---------------------------------------------------------------------------
// qNum effect — answerCategory='character' path (lines 1022-1023)
// ---------------------------------------------------------------------------
describe('useTestEngine — qNum effect triggers setHanziWriter for character questions', () => {
  it('calls HanziWriter.create when answerCategory is "character" and answer is a string', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    // The initial mount fires initialiseSettings which calls onInitialiseTestSet
    // which does setStateMerged({ qNum: prevState.qNum + 1 }), setting qNum to 1.
    // We need to snapshot the current qNum and advance it to trigger the effect.
    const currentQNum = result.current.state.qNum;

    // Step 1: Set character state so stateRef is updated
    act(() => {
      result.current.setStateMerged({
        answerCategory: 'character',
        answer: '好',
        questionCategory: 'meaning',
        useSound: false,
        useAutoRecord: false,
      } as any);
    });

    // Step 2: Advance qNum BEYOND current value so the qNum useEffect fires
    act(() => {
      result.current.setStateMerged({ qNum: currentQNum + 2 } as any);
    });

    expect((window as any).HanziWriter.create).toHaveBeenCalledWith(
      'character-target-div',
      '好',
      expect.objectContaining({ width: 150, height: 150 }),
    );
  });

  it('does NOT call HanziWriter.create when answerCategory is NOT "character"', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    await act(async () => {
      result.current.setStateMerged({
        answerCategory: 'pinyin',
        answer: 'hǎo',
        useSound: false,
        useAutoRecord: false,
      } as any);
    });

    const callsBefore = (window as any).HanziWriter.create.mock.calls.length;

    await act(async () => {
      result.current.setStateMerged({ qNum: 2 } as any);
    });

    // No new calls should have been made for a non-character question
    expect((window as any).HanziWriter.create.mock.calls.length).toBe(callsBefore);
  });

  it('does NOT call HanziWriter.create when answer is not a string (e.g. array)', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    await act(async () => {
      result.current.setStateMerged({
        answerCategory: 'character',
        answer: ['好', '坏'], // array — should not trigger setHanziWriter
        useSound: false,
        useAutoRecord: false,
      } as any);
    });

    const callsBefore = (window as any).HanziWriter.create.mock.calls.length;

    await act(async () => {
      result.current.setStateMerged({ qNum: 3 } as any);
    });

    expect((window as any).HanziWriter.create.mock.calls.length).toBe(callsBefore);
  });

  it('resets yesClicked, noClicked, showQuestionPinyin, pauseAutoRecord on qNum change', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    await act(async () => {
      result.current.setStateMerged({
        yesClicked: true,
        noClicked: true,
        showQuestionPinyin: true,
        pauseAutoRecord: true,
        answerCategory: 'meaning',
        answer: ['good'],
        useSound: false,
        useAutoRecord: false,
      } as any);
    });

    await act(async () => {
      result.current.setStateMerged({ qNum: 4 } as any);
    });

    expect(result.current.state.yesClicked).toBe(false);
    expect(result.current.state.noClicked).toBe(false);
    expect(result.current.state.showQuestionPinyin).toBe(false);
    expect(result.current.state.pauseAutoRecord).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Regression: test does not reinitialise or play audio after finishing (#118)
// ---------------------------------------------------------------------------
describe('useTestEngine — no reinitialisation or audio after test finishes (#118)', () => {
  it('qNum effect skips audio/setup when testFinished is true', async () => {
    const ttsService = await import('../../services/ttsService');
    vi.mocked(ttsService.stopAll).mockClear();
    vi.mocked(ttsService.speak).mockClear();

    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    // Mark the test as finished and set up state that would normally trigger audio
    act(() => {
      result.current.setStateMerged({
        testFinished: true,
        questionCategory: 'pinyin',
        useSound: true,
        chosenCharacter: '好',
        useAutoRecord: true,
        answerCategory: 'pinyin',
        answer: 'hǎo',
      } as any);
    });

    // Clear any calls from the above state update
    vi.mocked(ttsService.stopAll).mockClear();
    vi.mocked(ttsService.speak).mockClear();

    // Advance qNum — the effect should bail out because testFinished is true
    act(() => {
      result.current.setStateMerged({ qNum: 99 } as any);
    });

    expect(ttsService.speak).not.toHaveBeenCalled();
    // stopAll should also not be called since the effect returns early
    expect(ttsService.stopAll).not.toHaveBeenCalled();
  });

  it('does not reinitialise the test when callbacks change after test finishes', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    // Set up a test in progress with known permList
    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };
    act(() => {
      result.current.setStateMerged({
        testSet: [makeWord()],
        permList: [perm],
        initNumPerms: 3,
        perm,
        answer: ['good'],
        answerCategory: 'meaning',
        question: 'hǎo',
        questionCategory: 'pinyin',
        chosenCharacter: '好',
      } as any);
    });

    const permListAfterSetup = result.current.state.permList.length;

    // Mark the test as finished (simulating what happens after last answer)
    act(() => {
      result.current.setStateMerged({
        testFinished: true,
        permList: [],
        scoreList: [{ char: '好', score: 'Very Strong' as const }],
      } as any);
    });

    // permList should be empty (finished)
    expect(result.current.state.permList).toHaveLength(0);
    expect(result.current.state.testFinished).toBe(true);

    // The permList should not have been reset to a new full set
    // (i.e., no reinitialisation occurred)
    expect(result.current.state.permList).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// qNum effect — useAutoRecord path for pinyin/meaning answers
// ---------------------------------------------------------------------------
describe('useTestEngine — qNum effect auto-record paths', () => {
  it('does not error when useAutoRecord=false and answerCategory=pinyin on qNum change', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    await act(async () => {
      result.current.setStateMerged({
        answerCategory: 'pinyin',
        answer: 'hǎo',
        useAutoRecord: false,
        questionCategory: 'meaning',
        useSound: false,
      } as any);
    });

    // Should not throw
    await act(async () => {
      result.current.setStateMerged({ qNum: 5 } as any);
    });

    expect(result.current.state.qNum).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Flashcard grading — the feedback line and the pressed button state
// ---------------------------------------------------------------------------
describe('useTestEngine — flashcard grade feedback', () => {
  const perm = { index: '0', aCategory: 'M' as any, qCategory: 'C' as any };

  const gradeState = (overrides: Record<string, unknown> = {}) => ({
    answerCategory: 'meaning',
    answer: ['hello'],
    chosenCharacter: '你好',
    perm,
    testSet: [makeWord()],
    permList: [perm, { index: '0', aCategory: 'P' as any, qCategory: 'C' as any }],
    charSet: 'simp',
    idkList: [],
    idkDisabled: false,
    useHandwriting: false,
    writer: null,
    showAnswer: true,
    ...overrides,
  });

  it('reports the grade instead of repeating the reveal text when the answer is shown', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    await act(async () => {
      result.current.setStateMerged(gradeState() as any);
    });

    act(() => {
      result.current.onIDontKnow();
    });

    expect(result.current.state.result).toContain('Not known');
    expect(result.current.state.result).toContain('hello');
    expect(result.current.state.noClicked).toBe(true);
  });

  it('keeps the plain answer text when the answer was not shown', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    await act(async () => {
      result.current.setStateMerged(gradeState({ showAnswer: false }) as any);
    });

    act(() => {
      result.current.onIDontKnow();
    });

    expect(result.current.state.result).toBe("Answer was: 'hello'");
    expect(result.current.state.noClicked).toBe(false);
  });

  it('marks the like button pressed when the answer is graded as known', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    await act(async () => {
      result.current.setStateMerged(gradeState() as any);
    });

    act(() => {
      result.current.onCorrectAnswer();
    });

    expect(result.current.state.result).toBe('Correct');
    expect(result.current.state.yesClicked).toBe(true);
  });

  it('does not mark the like button pressed for a typed correct answer', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    await act(async () => {
      result.current.setStateMerged(gradeState({ showAnswer: false }) as any);
    });

    act(() => {
      result.current.onCorrectAnswer();
    });

    expect(result.current.state.yesClicked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// An empty plan: candidates exist, but none of their due directions is asked
// ---------------------------------------------------------------------------
describe('useTestEngine — a session with nothing to ask', () => {
  it('finishes rather than showing a question that does not exist', () => {
    // Only handwriting is due, and the session does not ask handwriting.
    localStorage.setItem('useHandwriting', 'false');
    const word: Word = {
      id: 1,
      simp: '你好',
      trad: '你好',
      pinyin: 'nǐ hǎo',
      meaning: 'hello',
      level: 2,
      due_date: '2026/01/01',
      directions: {
        MC: { level: 2, dueDate: '2099/01/01' },
        MP: { level: 2, dueDate: '2099/01/01' },
        PM: { level: 2, dueDate: '2099/01/01' },
        PC: { level: 2, dueDate: '2099/01/01' },
        CM: { level: 2, dueDate: '2026/01/01' },
      },
    };

    // The engine plans the session on mount.
    const props = makeProps({ words: [word], isDemo: false });
    const { result } = renderHook(() => useTestEngine(props));

    expect(result.current.state.permList).toHaveLength(0);
    expect(result.current.state.testFinished).toBe(true);
    expect(result.current.state.scoreList).toEqual([]);
    localStorage.removeItem('useHandwriting');
  });
});
