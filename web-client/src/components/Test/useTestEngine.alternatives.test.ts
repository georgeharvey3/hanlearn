/**
 * Tests for alternative answers: an answer that fits the question shown but
 * belongs to another word costs nothing, and the learner answers again. See
 * issue #348.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('./constants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./constants')>()),
  beep: { play: vi.fn() },
  fail: { play: vi.fn() },
}));

vi.mock('../../services/sentenceService', () => ({
  checkSentenceAvailability: vi.fn().mockResolvedValue(false),
  getHintSentence: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/ttsService', () => ({
  speak: vi.fn(),
  prefetch: vi.fn(),
  stopAll: vi.fn(),
}));

vi.mock('../../services/dictionaryService', () => ({
  fetchAlternatives: vi.fn(),
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { useTestEngine } from './useTestEngine';
import { fetchAlternatives } from '../../services/dictionaryService';
import { QueuePair, Word } from '../../types/models';
import { Props } from './types';
import { copy } from '../../copy';

const word = (id: number, simp: string, pinyin: string, meaning: string): Word => ({
  id,
  simp,
  trad: simp,
  pinyin,
  meaning,
  level: 1,
  due_date: '2020/01/01',
});

const XUNLIAN = word(1, '训练', 'xun4 lian4', 'to train/to drill');
const PEIXUN = word(2, '培训', 'pei2 xun4', 'to cultivate/to train');
const SHI_IS = word(3, '是', 'shi4', 'is');
const SHI_MATTER = word(4, '事', 'shi4', 'matter');
const CHANG = word(5, '长', 'chang2', 'long');
const ZHANG = word(6, '长', 'zhang3', 'to grow');

const COLLECTION = [XUNLIAN, PEIXUN, SHI_IS, SHI_MATTER, CHANG, ZHANG];

const pairOf = (direction: string): QueuePair => ({
  index: '0',
  aCategory: direction[0] as QueuePair['aCategory'],
  qCategory: direction[1] as QueuePair['qCategory'],
});

const makeProps = (overrides: Partial<Props> = {}): Props => ({
  words: [XUNLIAN],
  collection: COLLECTION,
  userId: 'user-1',
  speechAvailable: false,
  synthAvailable: false,
  isDemo: false,
  onFinishTest: vi.fn(),
  history: { push: vi.fn() } as any,
  location: { pathname: '/', search: '', hash: '', state: undefined } as any,
  match: { isExact: true, params: {}, path: '/', url: '/' } as any,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
    if (key === 'useHandwriting') return 'false';
    if (key === 'charSet') return 'simp';
    return null;
  });
  vi.mocked(fetchAlternatives).mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * One typed question of `asked` in `direction`. A spare pair keeps the session
 * running, so the grade stays in state.
 */
function typedQuestion(
  asked: Word,
  direction: string,
  answer: string | string[],
  question: string | string[],
  props: Partial<Props> = {},
) {
  const pair = pairOf(direction);
  const { result } = renderHook(() => useTestEngine(makeProps({ words: [asked], ...props })));
  act(() => {
    result.current.setStateMerged({
      testSet: [asked],
      currentPair: pair,
      queue: [pair, { ...pair, aCategory: 'C' }],
      answer,
      answerCategory: direction[0] === 'P' ? 'pinyin' : 'meaning',
      question,
      questionCategory: { M: 'meaning', P: 'pinyin', C: 'character' }[direction[1]]!,
      chosenCharacter: asked.simp,
      meaningQuizType: 'input',
      pinyinQuizType: 'input',
      gradeList: [],
    });
  });
  return result;
}

function submit(result: ReturnType<typeof typedQuestion>, answer: string) {
  act(() => {
    result.current.setStateMerged({ answerInput: answer });
  });
  act(() => {
    result.current.onSubmitAnswer();
  });
}

describe('useTestEngine — an alternative answer from the learner’s words', () => {
  it.each([
    ['PM', XUNLIAN, 'xun4 lian4', ['to train', 'to drill'], 'pei2 xun4', 'xun4 lian4'],
    ['MP', SHI_IS, ['is'], 'shi4', 'matter', 'is'],
    ['MC', CHANG, ['long'], '长', 'to grow', 'long'],
    ['PC', CHANG, 'chang2', '长', 'zhang3', 'chang2'],
  ] as const)(
    'keeps a %s question at a pass when the asked answer follows an alternative',
    (direction, asked, answer, question, alternative, correct) => {
      const result = typedQuestion(asked, direction, answer as never, question as never);

      submit(result, alternative);

      expect(result.current.state.result).toBe(copy.test.status.otherWord);
      expect(result.current.state.gradeCap).toBe('pass');
      expect(result.current.state.missCount).toBe(0);
      expect(result.current.state.toneErrorCount).toBe(0);
      expect(result.current.state.firstWrongAnswer).toBeNull();
      expect(result.current.state.submitDisabled).toBe(false);
      expect(result.current.state.gradeList).toEqual([]);

      submit(result, correct);

      expect(result.current.state.gradeList).toMatchObject([
        { wordId: asked.id, direction, result: 'pass', alternatives: [alternative] },
      ]);
    },
  );

  it('grades a lapse when a wrong answer follows an alternative', () => {
    const result = typedQuestion(CHANG, 'PC', 'chang2', '长');

    submit(result, 'zhang3');
    submit(result, 'chang3');
    submit(result, 'chang2');

    expect(result.current.state.gradeList).toMatchObject([
      { result: 'lapse', toneErrors: 1, misses: 1, answer: 'chang3', alternatives: ['zhang3'] },
    ]);
  });

  it('takes any number of alternatives, and logs each one in order', () => {
    const result = typedQuestion(SHI_IS, 'MP', ['is'], 'shi4', {
      collection: [...COLLECTION, word(7, '试', 'shi4', 'to test')],
    });

    submit(result, 'matter');
    submit(result, 'to test');
    submit(result, 'matter');
    submit(result, 'is');

    expect(result.current.state.gradeList).toMatchObject([
      { result: 'pass', alternatives: ['matter', 'to test', 'matter'] },
    ]);
  });

  it('logs no alternatives for a question that got none', () => {
    const result = typedQuestion(CHANG, 'PC', 'chang2', '长');

    submit(result, 'chang2');

    expect(result.current.state.gradeList[0]).not.toHaveProperty('alternatives');
  });

  it('falls back to the session words when it has no collection', () => {
    const result = typedQuestion(CHANG, 'PC', 'chang2', '长', {
      words: [CHANG, ZHANG],
      collection: undefined,
    });

    submit(result, 'zhang3');

    expect(result.current.state.gradeCap).toBe('pass');
  });
});

describe('useTestEngine — alternative answers from the dictionary', () => {
  it('asks once, when the session starts, for each question value of the queue', async () => {
    const pm = pairOf('PM');
    const pc = pairOf('PC');
    const cm = pairOf('CM');
    renderHook(() =>
      useTestEngine(
        makeProps({
          words: [XUNLIAN],
          plan: { words: [XUNLIAN], queue: [pm, pc, cm, pm], newWords: [] },
        }),
      ),
    );

    await waitFor(() => expect(fetchAlternatives).toHaveBeenCalledTimes(1));
    expect(fetchAlternatives).toHaveBeenCalledWith('simp', [
      { direction: 'PM', value: ['to train', 'to drill'] },
      { direction: 'PC', value: '训练' },
    ]);
  });

  it('takes an alternative from a word the learner does not hold, and reports it for the save', async () => {
    vi.mocked(fetchAlternatives).mockResolvedValue([['xun4 lian4', 'shou4 xun4']]);
    const pm = pairOf('PM');
    const onProgress = vi.fn();
    const { result } = renderHook(() =>
      useTestEngine(
        makeProps({
          words: [XUNLIAN],
          collection: [XUNLIAN],
          plan: { words: [XUNLIAN], queue: [pm, { ...pm, aCategory: 'C' }], newWords: [] },
          onProgress,
        }),
      ),
    );
    await waitFor(() =>
      expect(onProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({
          alternatives: { 'PM:to train/to drill': ['xun4 lian4', 'shou4 xun4'] },
        }),
      ),
    );

    submit(result, 'shou4 xun4');

    expect(result.current.state.result).toBe(copy.test.status.otherWord);
    expect(result.current.state.gradeCap).toBe('pass');
  });

  it('makes no call for a resumed session that kept its alternatives', async () => {
    const pm = pairOf('PM');
    const { result } = renderHook(() =>
      useTestEngine(
        makeProps({
          words: [XUNLIAN],
          collection: [XUNLIAN],
          plan: { words: [XUNLIAN], queue: [pm, { ...pm, aCategory: 'C' }], newWords: [] },
          resume: {
            queue: [pm, { ...pm, aCategory: 'C' }],
            gradeList: [],
            initialQueueLength: 2,
            alternatives: { 'PM:to train/to drill': ['shou4 xun4'] },
          },
        }),
      ),
    );

    submit(result, 'shou4 xun4');

    expect(result.current.state.result).toBe(copy.test.status.otherWord);
    expect(fetchAlternatives).not.toHaveBeenCalled();
  });

  it('runs on the learner’s words alone when the call fails', async () => {
    vi.mocked(fetchAlternatives).mockRejectedValue(new Error('offline'));
    const result = typedQuestion(CHANG, 'PC', 'chang2', '长', {
      plan: { words: [CHANG], queue: [pairOf('PC')], newWords: [] },
    });
    await waitFor(() => expect(fetchAlternatives).toHaveBeenCalled());

    submit(result, 'zhang3');

    expect(result.current.state.gradeCap).toBe('pass');
  });

  it('makes no call in the demo', async () => {
    renderHook(() => useTestEngine(makeProps({ isDemo: true })));
    await act(async () => {});
    expect(fetchAlternatives).not.toHaveBeenCalled();
  });
});

describe('useTestEngine — the disambiguator after an alternative answer', () => {
  it('logs that the learner looked at the disambiguator, and keeps the pass', () => {
    const result = typedQuestion(SHI_IS, 'MP', ['is'], 'shi4');

    submit(result, 'matter');
    act(() => {
      result.current.onToggleDisambiguator();
    });
    expect(result.current.state.showDisambiguator).toBe(true);
    submit(result, 'is');

    expect(result.current.state.gradeList).toMatchObject([
      { result: 'pass', alternatives: ['matter'], disambiguator: true },
    ]);
  });

  it('logs that the learner had the disambiguator and did not use it', () => {
    const result = typedQuestion(CHANG, 'MC', ['long'], '长');

    submit(result, 'to grow');
    submit(result, 'long');

    expect(result.current.state.gradeList[0]).toMatchObject({ disambiguator: false });
  });

  it('logs no disambiguator for a question that got no alternative answer', () => {
    const result = typedQuestion(CHANG, 'MC', ['long'], '长');

    submit(result, 'long');

    expect(result.current.state.gradeList[0]).not.toHaveProperty('disambiguator');
  });
});

describe('useTestEngine — the initials of a pinyin answer (PC)', () => {
  it('keeps the pass when the learner looks at the initials', () => {
    const result = typedQuestion(CHANG, 'PC', 'chang2', '长');

    submit(result, 'zhang3');
    act(() => {
      result.current.onToggleDisambiguator();
    });
    submit(result, 'chang2');

    expect(result.current.state.gradeList).toMatchObject([
      { result: 'pass', alternatives: ['zhang3'], disambiguator: true, hint: false },
    ]);
  });
});
