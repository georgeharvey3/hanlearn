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
        useTypingInput: false,
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
