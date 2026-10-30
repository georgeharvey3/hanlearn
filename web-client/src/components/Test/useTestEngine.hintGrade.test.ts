/**
 * Tests for the grade of a hint: a hint gives one step of the answer and caps
 * the question at `lapse`, and a disambiguator leaves the grade as it was. See
 * issue #396 and docs/adr/0018-a-hint-caps-the-grade.md.
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

import { renderHook, act } from '@testing-library/react';
import { useTestEngine } from './useTestEngine';
import { fetchAlternatives } from '../../services/dictionaryService';
import { getHintSentence } from '../../services/sentenceService';
import { QueuePair, Word } from '../../types/models';
import { Props } from './types';

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
const CHANG = word(5, '长', 'chang2', 'long');
const ZHANG = word(6, '长', 'zhang3', 'to grow');

const COLLECTION = [XUNLIAN, PEIXUN, CHANG, ZHANG];

const CATEGORY = { M: 'meaning', P: 'pinyin', C: 'character' } as const;

const mockWriter = {
  quiz: vi.fn(),
  setCharacter: vi.fn(),
  animateCharacter: vi.fn().mockResolvedValue(undefined),
  cancelQuiz: vi.fn(),
  showOutline: vi.fn(),
  hideOutline: vi.fn(),
};

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
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
    if (key === 'useHandwriting') return 'false';
    if (key === 'charSet') return 'simp';
    return null;
  });
  vi.mocked(fetchAlternatives).mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * One question of `asked` in `direction`, in `mode`. A spare pair keeps the
 * session running, so the grade stays in state.
 */
function question(
  asked: Word,
  direction: string,
  answer: string | string[],
  question: string | string[],
  mode: 'input' | 'flashcard' = 'input',
) {
  const pair: QueuePair = {
    index: '0',
    aCategory: direction[0] as QueuePair['aCategory'],
    qCategory: direction[1] as QueuePair['qCategory'],
  };
  const { result } = renderHook(() => useTestEngine(makeProps({ words: [asked] })));
  act(() => {
    result.current.setStateMerged({
      testSet: [asked],
      currentPair: pair,
      queue: [pair, { ...pair, aCategory: 'C' }],
      answer,
      answerCategory: CATEGORY[direction[0] as keyof typeof CATEGORY],
      question,
      questionCategory: CATEGORY[direction[1] as keyof typeof CATEGORY],
      chosenCharacter: asked.simp,
      meaningQuizType: mode,
      pinyinQuizType: mode,
      gradeList: [],
      ...(direction[0] === 'C' ? { writer: mockWriter as any } : {}),
    });
  });
  return result;
}

type Engine = ReturnType<typeof question>;

function submit(result: Engine, answer: string) {
  act(() => {
    result.current.setStateMerged({ answerInput: answer });
  });
  act(() => {
    result.current.onSubmitAnswer();
  });
}

async function hint(result: Engine) {
  await act(async () => {
    result.current.onHint();
  });
}

const SENTENCE = { chinese: '我们训练', english: 'We train' };

describe('useTestEngine — a hint caps the question at lapse', () => {
  it.each([
    ['PM', XUNLIAN, 'xun4 lian4', ['to train', 'to drill']],
    ['PC', CHANG, 'chang2', '长'],
  ] as const)('caps a typed %s answer after the initials', async (direction, asked, answer, q) => {
    const result = question(asked, direction, answer, q as string | string[]);

    await hint(result);
    submit(result, answer);

    expect(result.current.state.gradeList).toMatchObject([{ result: 'lapse', hint: true }]);
  });

  it.each([
    ['MC', CHANG, ['long'], '长'],
    ['MP', XUNLIAN, ['to train', 'to drill'], 'xun4 lian4'],
  ] as const)('caps a typed %s answer after the sentence', async (direction, asked, answer, q) => {
    vi.mocked(getHintSentence).mockResolvedValueOnce(SENTENCE);
    const result = question(asked, direction, [...answer], q);

    await hint(result);
    submit(result, answer[0]);

    expect(result.current.state.gradeList).toMatchObject([{ result: 'lapse', hint: true }]);
  });

  it.each([
    ['PM', XUNLIAN, 'xun4 lian4', ['to train', 'to drill']],
    ['MC', CHANG, ['long'], '长'],
  ] as const)('grades a typed %s answer with no hint a pass', (direction, asked, answer, q) => {
    const result = question(asked, direction, answer as string | string[], q as string | string[]);

    submit(result, typeof answer === 'string' ? answer : answer[0]);

    expect(result.current.state.gradeList).toMatchObject([{ result: 'pass', hint: false }]);
  });

  it('costs nothing when the sentence does not load', async () => {
    vi.mocked(getHintSentence).mockRejectedValueOnce(new Error('offline'));
    const result = question(CHANG, 'MC', ['long'], '长');

    await hint(result);
    submit(result, 'long');

    expect(result.current.state.gradeList).toMatchObject([{ result: 'pass', hint: false }]);
  });

  it('costs nothing when there is no sentence', async () => {
    vi.mocked(getHintSentence).mockResolvedValueOnce(null);
    const result = question(CHANG, 'MC', ['long'], '长');

    await hint(result);
    submit(result, 'long');

    expect(result.current.state.gradeList).toMatchObject([{ result: 'pass', hint: false }]);
  });

  it('costs one step however many times the learner presses it', async () => {
    const result = question(XUNLIAN, 'PM', 'xun4 lian4', ['to train', 'to drill']);

    await hint(result);
    await hint(result);
    await hint(result);
    submit(result, 'xun4 lian4');

    expect(result.current.state.gradeList).toMatchObject([{ result: 'lapse' }]);
  });

  it('caps a CM drawing after the outline', async () => {
    const result = question(CHANG, 'CM', '长', ['long']);

    await hint(result);
    act(() => {
      result.current.onCorrectAnswer();
    });

    expect(result.current.state.gradeList).toMatchObject([{ result: 'lapse', hint: true }]);
  });
});

describe('useTestEngine — a hint in flashcard mode', () => {
  it('records a pass report after a hint as lapse', async () => {
    const result = question(XUNLIAN, 'PM', 'xun4 lian4', ['to train', 'to drill'], 'flashcard');

    await hint(result);
    act(() => {
      result.current.onShowAnswer();
    });
    act(() => {
      result.current.onCorrectAnswer('pass');
    });

    expect(result.current.state.gradeList).toMatchObject([
      { result: 'lapse', hint: true, mode: 'flashcard' },
    ]);
  });

  it('records a pass report with no hint as pass', () => {
    const result = question(XUNLIAN, 'PM', 'xun4 lian4', ['to train', 'to drill'], 'flashcard');

    act(() => {
      result.current.onShowAnswer();
    });
    act(() => {
      result.current.onCorrectAnswer('pass');
    });

    expect(result.current.state.gradeList).toMatchObject([{ result: 'pass', hint: false }]);
  });

  it('keeps a fail report after a hint as fail', async () => {
    const result = question(XUNLIAN, 'PM', 'xun4 lian4', ['to train', 'to drill'], 'flashcard');

    await hint(result);
    act(() => {
      result.current.onShowAnswer();
    });
    act(() => {
      result.current.onIDontKnow();
    });

    expect(result.current.state.gradeList).toMatchObject([{ result: 'fail' }]);
  });
});

describe('useTestEngine — the CM initials', () => {
  it('leaves the pass, and logs the disambiguator', () => {
    const result = question(CHANG, 'CM', '长', ['long']);

    act(() => {
      result.current.onToggleDisambiguator();
    });
    act(() => {
      result.current.onCorrectAnswer();
    });

    expect(result.current.state.gradeList).toMatchObject([
      { result: 'pass', hint: false, disambiguator: true },
    ]);
  });

  it('still caps the outline when the initials show', async () => {
    const result = question(CHANG, 'CM', '长', ['long']);

    act(() => {
      result.current.onToggleDisambiguator();
    });
    await hint(result);
    act(() => {
      result.current.onCorrectAnswer();
    });

    expect(result.current.state.gradeList).toMatchObject([
      { result: 'lapse', hint: true, disambiguator: true },
    ]);
  });
});
