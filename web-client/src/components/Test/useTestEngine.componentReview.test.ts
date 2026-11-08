/**
 * Tests for the component review that follows a missed character question.
 *
 * A direction the learner has just lost is the moment to show the components
 * of its character again, so the session holds on the reveal until Continue.
 * See issue #335.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('./constants', () => ({
  beep: { play: vi.fn() },
  fail: { play: vi.fn() },
  createInitialState: vi.fn((props: { words?: unknown[] }) => ({
    testSet: props.words ?? [],
    queue: [],
    charSet: 'simp',
    currentPair: null,
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
    initialQueueLength: 0,
    gradeList: [],
    gradeCap: 'pass',
    missedCharIndexes: [],
    toneErrorCount: 0,
    alternativesSent: [],
    alternatives: null,
    scoreList: [],
    testFinished: false,
    showInputChars: [],
    drawnCharacters: [],
    useSound: false,
    useSoundEffects: false,
    useHandwriting: false,
    meaningQuizType: 'input',
    pinyinQuizType: 'input',
    useAutoRecord: false,
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
    componentReviewChars: [],
    showComponents: false,
    gradeClicked: null,
    pauseAutoRecord: false,
    synthLoading: false,
    speechLoading: false,
    interaction: false,
    speechResult: false,
  })),
}));

vi.mock('../../services/dictionaryService', () => ({
  fetchAlternatives: vi.fn().mockResolvedValue([]),
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
  pinyin: vi.fn((text: string) => text),
}));

import { renderHook, act } from '@testing-library/react';
import { useTestEngine } from './useTestEngine';
import { QueuePair, Word } from '../../types/models';
import { Props, TestState } from './types';

const makeWord = (overrides: Partial<Word> = {}): Word => ({
  id: 1,
  simp: '你好',
  trad: '你好',
  pinyin: 'nǐ hǎo',
  meaning: 'hello/hi',
  level: 1,
  due_date: '2020/01/01',
  ...overrides,
});

const makeProps = (overrides: Partial<Props> = {}): Props => ({
  words: [makeWord(), makeWord({ id: 2, simp: '再见', trad: '再見' })],
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

const firstPair: QueuePair = { index: '0', aCategory: 'M', qCategory: 'C' };
const secondPair: QueuePair = { index: '1', aCategory: 'M', qCategory: 'C' };

/** A session of two questions, sitting on the first one. */
const seatOnQuestion = (
  setStateMerged: (update: Partial<TestState>) => void,
  overrides: Partial<TestState> = {},
): void => {
  setStateMerged({
    testSet: [makeWord(), makeWord({ id: 2, simp: '再见', trad: '再見' })],
    queue: [firstPair, secondPair],
    currentPair: firstPair,
    answerCategory: 'meaning',
    questionCategory: 'character',
    chosenCharacter: '你好',
    ...overrides,
  });
};

/**
 * Let the timed advance run, if the question left one.
 *
 * The engine moves an answered question on with a timer, so a test that claims
 * the session held has to outlast the longest of them: 2s, after a reveal.
 */
const letTimersRun = async (ms = 2500): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) =>
    key === 'useHandwriting' ? 'false' : null,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as any).HanziWriter;
});

describe('useTestEngine — component review after a miss', () => {
  it('offers the components of the character and holds the session on a lapse', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    act(() => seatOnQuestion(result.current.setStateMerged));
    act(() => result.current.onCorrectAnswer('lapse'));

    expect(result.current.state.componentReviewChars).toEqual(['你', '好']);
    expect(result.current.state.showComponents).toBe(false);

    // The timers that move an unmissed question on must not move this one.
    await letTimersRun();
    expect(result.current.state.currentPair).toBe(firstPair);
  });

  it('asks the next question when the learner continues', () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    act(() => seatOnQuestion(result.current.setStateMerged));
    act(() => result.current.onCorrectAnswer('lapse'));
    act(() => result.current.onContinue());

    expect(result.current.state.componentReviewChars).toEqual([]);
    expect(result.current.state.currentPair).toEqual(secondPair);
  });

  it('expands and collapses the breakdown', () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    act(() => seatOnQuestion(result.current.setStateMerged));
    act(() => result.current.onCorrectAnswer('lapse'));

    act(() => result.current.onToggleComponents());
    expect(result.current.state.showComponents).toBe(true);

    act(() => result.current.onToggleComponents());
    expect(result.current.state.showComponents).toBe(false);
  });

  it('offers nothing after a pass, and holds the typed answer for Continue', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    act(() => seatOnQuestion(result.current.setStateMerged));
    act(() => result.current.onCorrectAnswer('pass'));

    expect(result.current.state.componentReviewChars).toEqual([]);
    expect(result.current.state.awaitingContinue).toBe(true);

    await letTimersRun(1200);
    expect(result.current.state.currentPair).toBe(firstPair);

    act(() => result.current.onContinue());
    expect(result.current.state.currentPair).toEqual(secondPair);
    expect(result.current.state.awaitingContinue).toBe(false);
  });

  it('moves a flashcard grade on by itself when there is nothing to review', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    // MP: pinyin asked from a meaning, so no character is shown at all.
    act(() =>
      seatOnQuestion(result.current.setStateMerged, {
        answerCategory: 'pinyin',
        questionCategory: 'meaning',
        showAnswer: true,
      }),
    );
    act(() => result.current.onCorrectAnswer('lapse'));

    expect(result.current.state.componentReviewChars).toEqual([]);
    expect(result.current.state.awaitingContinue).toBeFalsy();

    await letTimersRun(1200);
    expect(result.current.state.currentPair).toEqual(secondPair);
  });

  it('offers the components after a reveal, which grades a fail', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));

    act(() => seatOnQuestion(result.current.setStateMerged, { answer: 'hello' }));
    act(() => result.current.onIDontKnow());

    expect(result.current.state.componentReviewChars).toEqual(['你', '好']);

    await letTimersRun();
    expect(result.current.state.currentPair).toBe(firstPair);
  });

  it('continues on an Enter pressed on the reveal, not on the Enter that sent the answer', () => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));
    const key = (type: 'keydown' | 'keyup') =>
      document.body.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', bubbles: true }));

    act(() => seatOnQuestion(result.current.setStateMerged));
    // The Enter goes down on the live question and sends it...
    act(() => {
      key('keydown');
      result.current.onCorrectAnswer('pass');
    });
    // ...and comes back up on the reveal, which must stay.
    act(() => key('keyup'));
    expect(result.current.state.currentPair).toBe(firstPair);

    act(() => {
      key('keydown');
      key('keyup');
    });
    expect(result.current.state.currentPair).toEqual(secondPair);
  });
});

/**
 * A handwriting question (`CM`) knows which characters the learner missed, so the
 * review holds only those, expanded. See issue #493.
 */
describe('useTestEngine — component review after a missed handwriting question', () => {
  const handwritingPair: QueuePair = { index: '0', aCategory: 'C', qCategory: 'M' };
  const writer = {
    quiz: vi.fn(),
    setCharacter: vi.fn(),
    animateCharacter: vi.fn().mockResolvedValue(undefined),
    cancelQuiz: vi.fn(),
    showOutline: vi.fn(),
    hideOutline: vi.fn(),
  };
  type Quiz = { onMistake: (data: object) => void; onComplete: () => void };
  const quizOf = (n: number): Quiz => writer.quiz.mock.calls[n][0];
  const capped = { mistakesOnStroke: 5, strokeNum: 0, totalMistakes: 5 };
  const belowCap = { mistakesOnStroke: 1, strokeNum: 0, totalMistakes: 1 };

  beforeEach(() => {
    vi.useFakeTimers();
    writer.quiz.mockClear();
    (window as any).HanziWriter = { create: vi.fn().mockReturnValue(writer) };
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Seat a handwriting question of `word`, with the writer mounted on its first character. */
  const handwritingQuestion = (word: string) => {
    const props = makeProps();
    const { result } = renderHook(() => useTestEngine(props));
    act(() =>
      seatOnQuestion(result.current.setStateMerged, {
        queue: [handwritingPair, secondPair],
        currentPair: handwritingPair,
        answerCategory: 'character',
        questionCategory: 'meaning',
        answer: word,
        chosenCharacter: word,
        useHandwriting: true,
        qNum: 1,
      }),
    );
    // A new question number mounts the writer, as it does in a session.
    writer.quiz.mockClear();
    act(() => result.current.setStateMerged({ qNum: 2 }));
    return result;
  };

  /** Finish the character the writer is on, and let the engine move to the next. */
  const complete = (n: number) => {
    act(() => quizOf(n).onComplete());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  };

  it('shows the breakdown of a one-character word at once', () => {
    const result = handwritingQuestion('好');
    act(() => quizOf(0).onMistake(capped));
    complete(0);

    expect(result.current.state.componentReviewChars).toEqual(['好']);
    expect(result.current.state.showComponents).toBe(true);
  });

  it('holds only the character the hint was used on', () => {
    const result = handwritingQuestion('你好');
    act(() => result.current.onHint());
    complete(0);
    complete(1);

    expect(result.current.state.componentReviewChars).toEqual(['你']);
    expect(result.current.state.showComponents).toBe(true);
  });

  it('holds only the character a stroke reached the cap on', () => {
    const result = handwritingQuestion('你好');
    complete(0);
    act(() => quizOf(1).onMistake(capped));
    complete(1);

    expect(result.current.state.componentReviewChars).toEqual(['好']);
  });

  it('leaves out a character with a mistake below the cap', () => {
    const result = handwritingQuestion('你好');
    act(() => quizOf(0).onMistake(belowCap));
    complete(0);
    act(() => result.current.onHint());
    complete(1);

    expect(result.current.state.componentReviewChars).toEqual(['好']);
  });

  it('holds every character after "I don\'t know"', async () => {
    const result = handwritingQuestion('你好');
    complete(0);
    await act(async () => result.current.onIDontKnow());

    expect(result.current.state.componentReviewChars).toEqual(['你', '好']);
    expect(result.current.state.showComponents).toBe(true);
  });

  it('records a hint pressed before the next character loads on the drawn one', () => {
    const result = handwritingQuestion('你好');
    act(() => quizOf(0).onComplete());
    act(() => result.current.onHint());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    complete(1);

    expect(result.current.state.componentReviewChars).toEqual(['你']);
  });

  it('closes the review when the learner counts the question as known', () => {
    const result = handwritingQuestion('好');
    act(() => quizOf(0).onMistake(capped));
    complete(0);
    act(() => result.current.onCountAsKnown());

    expect(result.current.state.componentReviewChars).toEqual([]);
    expect(result.current.state.showComponents).toBe(false);
  });

  it('starts the next question with no missed characters', () => {
    const result = handwritingQuestion('好');
    act(() => quizOf(0).onMistake(capped));
    complete(0);
    act(() => result.current.onContinue());

    expect(result.current.state.missedCharIndexes).toEqual([]);
  });
});
