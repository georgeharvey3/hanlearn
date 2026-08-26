/**
 * Tests for useTestEngine keyboard shortcuts (onKeyUp handler, lines 841–954)
 * and the onFinishTest sentence-availability async paths.
 *
 * The onKeyUp handler drives the core test UX on desktop — spacebar triggers
 * mic/speaker/flashcard-reveal, Ctrl+i / 'i' fires IDK, ArrowUp/Down
 * confirm/reject answers in flashcard mode, 'h' toggles hint, 'p' toggles
 * pinyin visibility, 'a' toggles auto-record, and Ctrl+m / Ctrl+q fire mic
 * and speaker.
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
import * as ttsService from '../../services/ttsService';
import { checkSentenceAvailability } from '../../services/sentenceService';

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

function fireKeyUp(key: string, options: Partial<KeyboardEventInit> = {}) {
  // Dispatch from document.body so event.target.tagName === 'body' (not input),
  // matching the non-input-element branch in onKeyUp.
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
  // Note: webkitSpeechRecognition cannot be deleted in jsdom — just reset to undefined
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
// Keyboard: Ctrl+i triggers IDK
// ---------------------------------------------------------------------------
describe('useTestEngine — keyboard Ctrl+i triggers onIDontKnow', () => {
  it('adds word to idkList when Ctrl+i is pressed and idkDisabled=false', () => {
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
      fireKeyUp('i', { ctrlKey: true });
    });

    expect(result.current.state.idkList).toContain('你好');
    expect(result.current.state.idkDisabled).toBe(true);
  });

  it('does NOT fire IDK when Ctrl+i is pressed but idkDisabled=true', () => {
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
      idkDisabled: true,
    });

    act(() => {
      fireKeyUp('i', { ctrlKey: true });
    });

    expect(result.current.state.idkList).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Keyboard: 'i' key (without Ctrl) triggers IDK when source is not input
// ---------------------------------------------------------------------------
describe('useTestEngine — keyboard "i" key triggers onIDontKnow from non-input', () => {
  it('adds word to idkList when "i" is pressed from body (non-input element)', () => {
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
      // Dispatching from document (body) — tagName is 'body', not 'input'
      fireKeyUp('i');
    });

    expect(result.current.state.idkList).toContain('你好');
  });
});

// ---------------------------------------------------------------------------
// Keyboard: spacebar triggers onListen when mic is available and pinyin answer
// ---------------------------------------------------------------------------
describe('useTestEngine — spacebar triggers onListen for pinyin answers', () => {
  it('calls recognition.start when spacebar pressed in pinyin mode with speech enabled', () => {
    const mockRecognition = setupRecognitionMock();

    const perm = { index: '0', aCategory: 'P' as any, qCategory: 'C' as any };
    const result = renderEngineWithState(
      {
        answerCategory: 'pinyin',
        questionCategory: 'meaning',
        pinyinQuizType: 'input',
        listening: false,
        testFinished: false,
        chosenCharacter: '你好',
        perm,
        testSet: [makeWord()],
        permList: [perm],
        charSet: 'simp',
      },
      { speechAvailable: true },
    );

    act(() => {
      fireKeyUp(' ');
    });

    expect(mockRecognition.start).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Keyboard: 'h' key toggles hint from non-input element
// ---------------------------------------------------------------------------
describe('useTestEngine — keyboard "h" key toggles hint', () => {
  it('shows pinyin hint when "h" is pressed and answerCategory=pinyin', () => {
    const result = renderEngineWithState({
      answerCategory: 'pinyin',
      answer: 'ni3 hao3',
      showHint: false,
    });

    act(() => {
      fireKeyUp('h');
    });

    expect(result.current.state.showHint).toBe(true);
    expect(result.current.state.result).toMatch(/Hint:/);
  });

  it('clears hint when "h" is pressed and hint is already shown', () => {
    const result = renderEngineWithState({
      answerCategory: 'pinyin',
      answer: 'ni3 hao3',
      showHint: true,
      result: 'Hint: ni3__ hao3__',
    });

    act(() => {
      fireKeyUp('h');
    });

    expect(result.current.state.showHint).toBe(false);
    expect(result.current.state.result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Keyboard: 'p' key toggles pinyin visibility
// ---------------------------------------------------------------------------
describe('useTestEngine — keyboard "p" key toggles question pinyin', () => {
  it('toggles showQuestionPinyin when questionCategory=pinyin and "p" is pressed', () => {
    const result = renderEngineWithState({
      questionCategory: 'pinyin',
      showQuestionPinyin: false,
    });

    act(() => {
      fireKeyUp('p');
    });

    expect(result.current.state.showQuestionPinyin).toBe(true);
  });

  it('does NOT toggle showQuestionPinyin when questionCategory is not pinyin', () => {
    const result = renderEngineWithState({
      questionCategory: 'meaning',
      showQuestionPinyin: false,
    });

    act(() => {
      fireKeyUp('p');
    });

    expect(result.current.state.showQuestionPinyin).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Keyboard: ArrowUp in flashcard mode confirms correct answer
// ---------------------------------------------------------------------------
describe('useTestEngine — keyboard ArrowUp confirms answer in flashcard mode', () => {
  it('sets yesClicked=true and calls onCorrectAnswer when ArrowUp pressed with showAnswer=true', () => {
    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };
    const result = renderEngineWithState({
      answerCategory: 'meaning',
      answer: ['hello'],
      chosenCharacter: '你好',
      perm,
      testSet: [makeWord()],
      permList: [perm],
      charSet: 'simp',
      showAnswer: true,
      idkDisabled: false,
    });

    act(() => {
      fireKeyUp('ArrowUp');
    });

    expect(result.current.state.yesClicked).toBe(true);
    // onCorrectAnswer removes perm from permList; since this is the last perm, it triggers finish
    expect(result.current.state.result).toMatch(/Correct|Finished/);
  });
});

// ---------------------------------------------------------------------------
// Keyboard: ArrowDown in flashcard mode marks answer wrong (IDK)
// ---------------------------------------------------------------------------
describe('useTestEngine — keyboard ArrowDown marks IDK in flashcard mode', () => {
  it('sets noClicked=true and adds to idkList when ArrowDown pressed with showAnswer=true', () => {
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
      showAnswer: true,
      idkDisabled: false,
      useHandwriting: false,
      writer: null,
    });

    act(() => {
      fireKeyUp('ArrowDown');
    });

    expect(result.current.state.noClicked).toBe(true);
    expect(result.current.state.idkList).toContain('你好');
  });
});

// ---------------------------------------------------------------------------
// Keyboard: Ctrl+m triggers onListen
// ---------------------------------------------------------------------------
describe('useTestEngine — keyboard Ctrl+m triggers onListen', () => {
  it('calls recognition.start when Ctrl+m is pressed and mic is available', () => {
    const mockRecognition = setupRecognitionMock();

    const perm = { index: '0', aCategory: 'P' as any, qCategory: 'C' as any };
    const result = renderEngineWithState(
      {
        answerCategory: 'pinyin',
        questionCategory: 'meaning',
        pinyinQuizType: 'input',
        listening: false,
        testFinished: false,
        chosenCharacter: '你好',
        perm,
        testSet: [makeWord()],
        permList: [perm],
        charSet: 'simp',
      },
      { speechAvailable: true },
    );

    act(() => {
      fireKeyUp('m', { ctrlKey: true });
    });

    expect(mockRecognition.start).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Keyboard: Ctrl+q triggers onSpeak
// ---------------------------------------------------------------------------
describe('useTestEngine — keyboard Ctrl+q triggers onSpeak', () => {
  it('calls ttsService.speak when Ctrl+q is pressed and speaker is available', () => {
    vi.mocked(ttsService.speak).mockClear();

    const perm = { index: '0', aCategory: 'P' as any, qCategory: 'C' as any };
    const result = renderEngineWithState({
      useSound: true,
      questionCategory: 'pinyin',
      testFinished: false,
      listening: false,
      chosenCharacter: '你好',
      perm,
      testSet: [makeWord()],
      permList: [perm],
      charSet: 'simp',
    });

    act(() => {
      fireKeyUp('q', { ctrlKey: true });
    });

    expect(ttsService.speak).toHaveBeenCalledWith('你好', expect.any(Object));
  });
});

// ---------------------------------------------------------------------------
// Keyboard: 'a' key toggles auto-record mode
// ---------------------------------------------------------------------------
describe('useTestEngine — keyboard "a" key toggles auto-record', () => {
  it('toggles useAutoRecord from false to true when "a" is pressed from non-input', () => {
    // When useAutoRecord is false, pressing 'a' calls onListen then toggles the flag.
    // Set up speech recognition so onListen doesn't throw.
    const mockRecognition = setupRecognitionMock();

    const result = renderEngineWithState({
      useAutoRecord: false,
      pinyinQuizType: 'input',
      answerCategory: 'pinyin',
      testFinished: false,
      listening: false,
    });

    act(() => {
      fireKeyUp('a');
    });

    expect(result.current.state.useAutoRecord).toBe(true);
    // onListen should also have been called (side effect of toggling on)
    expect(mockRecognition.start).toHaveBeenCalled();
  });

  it('toggles useAutoRecord from true to false when "a" is pressed', () => {
    const result = renderEngineWithState({
      useAutoRecord: true,
      recognition: null,
    });

    act(() => {
      fireKeyUp('a');
    });

    expect(result.current.state.useAutoRecord).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Keyboard: 's' key triggers onSpeak from non-input element
// ---------------------------------------------------------------------------
describe('useTestEngine — keyboard "s" key triggers onSpeak', () => {
  it('calls ttsService.speak when "s" is pressed and speaker is available', () => {
    vi.mocked(ttsService.speak).mockClear();

    const perm = { index: '0', aCategory: 'P' as any, qCategory: 'C' as any };
    const result = renderEngineWithState({
      useSound: true,
      questionCategory: 'pinyin',
      testFinished: false,
      listening: false,
      chosenCharacter: '你好',
      perm,
      testSet: [makeWord()],
      permList: [perm],
      charSet: 'simp',
    });

    act(() => {
      fireKeyUp('s');
    });

    expect(ttsService.speak).toHaveBeenCalledWith('你好', expect.any(Object));
  });
});

// ---------------------------------------------------------------------------
// qNum effect: auto-speak path (line 1011)
// When useSound=true and questionCategory=pinyin, onSpeak is called with
// the chosenCharacter AND the useAutoRecord flag (auto=true triggers onListen
// after speech ends for non-character/non-flashcard questions).
// ---------------------------------------------------------------------------
describe('useTestEngine — qNum effect triggers onSpeak when useSound=true', () => {
  it('calls ttsService.speak when questionCategory=pinyin and useSound=true on qNum change', () => {
    vi.mocked(ttsService.speak).mockClear();

    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };
    const result = renderEngineWithState({
      questionCategory: 'pinyin',
      answerCategory: 'meaning',
      useSound: true,
      chosenCharacter: '你好',
      useAutoRecord: false,
      perm,
      testSet: [makeWord()],
      permList: [perm],
      charSet: 'simp',
      qNum: 1,
    });

    vi.mocked(ttsService.speak).mockClear();

    act(() => {
      result.current.setStateMerged({ qNum: 2 } as any);
    });

    expect(ttsService.speak).toHaveBeenCalledWith('你好', expect.any(Object));
  });
});

// ---------------------------------------------------------------------------
// onFinishTest: sentence-check async path — sentences available for level-1 words
// ---------------------------------------------------------------------------
describe('useTestEngine — onFinishTest sentence availability check', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls startSentenceRead when level-1 words have sentences available', async () => {
    vi.mocked(checkSentenceAvailability).mockResolvedValue(true);

    const startSentenceRead = vi.fn();
    const level1Word = makeWord({ id: 1, level: 1 });

    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };
    const result = renderEngineWithState(
      {
        answerCategory: 'meaning',
        answer: ['hello'],
        answerInput: 'hello', // must match to trigger onCorrectAnswer
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
        startSentenceRead,
        onFinishTest: vi.fn(),
      },
    );

    // Trigger correct answer — last perm is exhausted, onFinishTest called
    act(() => {
      result.current.onSubmitAnswer();
    });

    // onCorrectAnswer sets Finished! then calls onFinishTest after 1s timeout
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // Wait for the sentence availability promise to resolve
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(checkSentenceAvailability).toHaveBeenCalledWith('你好', 'simp');
    expect(startSentenceRead).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 1 })]),
      expect.any(Array),
    );
  });

  it('calls onVocabComplete when no sentences are available after check', async () => {
    vi.mocked(checkSentenceAvailability).mockResolvedValue(false);

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

  it('sets sentenceCheckStatus to "available" when sentences are found', async () => {
    vi.mocked(checkSentenceAvailability).mockResolvedValue(true);

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
        startSentenceRead: vi.fn(),
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

    expect(result.current.state.sentenceCheckStatus).toBe('available');
  });

  it('sets sentenceCheckStatus to "unavailable" when no sentences found after check', async () => {
    vi.mocked(checkSentenceAvailability).mockResolvedValue(false);

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
        onVocabComplete: vi.fn(),
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

    expect(result.current.state.sentenceCheckStatus).toBe('unavailable');
  });
});

// ---------------------------------------------------------------------------
// The finishTest payload: one entry per word, carrying the asked directions
// ---------------------------------------------------------------------------
describe('useTestEngine — the finishTest payload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function finishSessionWithIdkList(idkList: string[], onFinishTest: Props['onFinishTest']) {
    const word = makeWord({ id: 1, simp: '你好', level: 3 });
    const perm = { index: '0', aCategory: 'M' as any, qCategory: 'P' as any };

    const result = renderEngineWithState(
      {
        answerCategory: 'meaning',
        answer: ['hello'],
        answerInput: 'hello',
        chosenCharacter: '你好',
        perm,
        testSet: [word],
        permList: [perm],
        charSet: 'simp',
        idkList,
        // The session asked these four; handwriting was switched off.
        askedDirections: ['MC', 'MP', 'PM', 'PC'],
        useAutoRecord: false,
        recognition: null,
      },
      { words: [word], isDemo: false, practiceMode: false, onFinishTest },
    );

    act(() => {
      result.current.onSubmitAnswer();
    });
    act(() => {
      vi.advanceTimersByTime(1100);
    });
  }

  it('marks every asked direction as a pass when the word had no failure', () => {
    const onFinishTest = vi.fn();

    finishSessionWithIdkList([], onFinishTest);

    expect(onFinishTest).toHaveBeenCalledWith([
      { word_id: 1, directions: { MC: 'pass', MP: 'pass', PM: 'pass', PC: 'pass' } },
    ]);
  });

  it('marks every asked direction as a failure when the word was not known', () => {
    const onFinishTest = vi.fn();

    finishSessionWithIdkList(['你好'], onFinishTest);

    expect(onFinishTest).toHaveBeenCalledWith([
      { word_id: 1, directions: { MC: 'fail', MP: 'fail', PM: 'fail', PC: 'fail' } },
    ]);
  });

  it('leaves a direction the session did not ask out of the payload', () => {
    const onFinishTest = vi.fn();

    finishSessionWithIdkList([], onFinishTest);

    const payload = onFinishTest.mock.calls[0][0];
    expect(payload[0].directions).not.toHaveProperty('CM');
  });
});
