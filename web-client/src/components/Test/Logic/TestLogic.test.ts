import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  chooseTestSet,
  planSession,
  assignQA,
  toneChecker,
  Counter,
  removePunctuation,
} from './TestLogic';
import { DIRECTIONS, Word } from '../../../types/models';

function makeWord(id: number, simp: string, due_date?: string): Word {
  return {
    id,
    simp,
    trad: simp,
    pinyin: 'pīn yīn',
    meaning: 'test meaning/other meaning',
    due_date,
    level: 1,
  };
}

describe('chooseTestSet', () => {
  beforeEach(() => {
    // Fix "today" to 2026-02-27
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 27, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('includes words due today', () => {
    const words = [makeWord(1, '你', '2026/02/27')];
    const result = chooseTestSet(words, 10);
    expect(result).toHaveLength(1);
  });

  it('includes words due in the past', () => {
    const words = [makeWord(1, '你', '2026/02/20')];
    const result = chooseTestSet(words, 10);
    expect(result).toHaveLength(1);
  });

  it('excludes words due in the future', () => {
    const words = [makeWord(1, '你', '2026/03/01')];
    const result = chooseTestSet(words, 10);
    expect(result).toHaveLength(0);
  });

  it('excludes words with no due_date', () => {
    const words = [
      makeWord(1, '你'), // no due_date
      makeWord(2, '好', '2026/02/20'), // past - due
    ];
    const result = chooseTestSet(words, 10);
    expect(result).toHaveLength(1);
    expect(result[0].simp).toBe('好');
  });

  it('caps result at numWords', () => {
    const words = Array.from({ length: 10 }, (_, i) => makeWord(i, `字${i}`, '2026/02/20'));
    const result = chooseTestSet(words, 5);
    expect(result).toHaveLength(5);
  });

  it('returns fewer than numWords when not enough due words', () => {
    const words = [makeWord(1, '你', '2026/02/20')];
    const result = chooseTestSet(words, 5);
    expect(result).toHaveLength(1);
  });

  it('returns all words when numWords matches due words exactly', () => {
    const words = [makeWord(1, '你', '2026/02/20'), makeWord(2, '好', '2026/02/21')];
    const result = chooseTestSet(words, 2);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no words are due', () => {
    const words = [makeWord(1, '你', '2026/03/01'), makeWord(2, '好', '2026/03/02')];
    const result = chooseTestSet(words, 10);
    expect(result).toHaveLength(0);
  });

  it('is deterministic across repeated calls', () => {
    const words = Array.from({ length: 10 }, (_, i) => makeWord(i, `字${i}`, '2026/02/20'));
    const result1 = chooseTestSet(words, 5);
    const result2 = chooseTestSet(words, 5);
    expect(result1.map((w) => w.id)).toEqual(result2.map((w) => w.id));
  });

  it('selects oldest due dates first', () => {
    const words = [
      makeWord(1, '一', '2026/02/25'),
      makeWord(2, '二', '2026/02/20'),
      makeWord(3, '三', '2026/02/22'),
      makeWord(4, '四', '2026/02/18'),
      makeWord(5, '五', '2026/02/26'),
    ];
    const result = chooseTestSet(words, 3);
    const ids = result.map((w) => w.id);
    // Should pick the 3 oldest: ids 4 (Feb 18), 2 (Feb 20), 3 (Feb 22)
    expect(ids.sort()).toEqual([2, 3, 4]);
  });

  it('breaks ties deterministically within a day', () => {
    const words = Array.from({ length: 10 }, (_, i) => makeWord(i, `字${i}`, '2026/02/20'));
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const result = chooseTestSet(words, 5);
      results.add(result.map((w) => w.id).join(','));
    }
    // All calls on the same day should return the same set
    expect(results.size).toBe(1);
  });

  it('tie-breaking may change on a different day', () => {
    const words = Array.from({ length: 20 }, (_, i) => makeWord(i, `字${i}`, '2026/02/20'));
    const result1 = chooseTestSet(words, 5);
    vi.setSystemTime(new Date(2026, 1, 28, 10, 0, 0));
    const result2 = chooseTestSet(words, 5);
    // With 20 words and only picking 5, different days should very likely differ
    const ids1 = result1.map((w) => w.id).join(',');
    const ids2 = result2.map((w) => w.id).join(',');
    expect(ids1).not.toEqual(ids2);
  });

  it('selects definite words plus deterministic ties', () => {
    const yesterday = Array.from({ length: 3 }, (_, i) => makeWord(i, `昨${i}`, '2026/02/26'));
    const today = Array.from({ length: 5 }, (_, i) => makeWord(i + 3, `今${i}`, '2026/02/27'));
    const words = [...yesterday, ...today];
    const result = chooseTestSet(words, 5);
    // All 3 from yesterday should be included
    const resultIds = result.map((w) => w.id);
    expect(resultIds).toContain(0);
    expect(resultIds).toContain(1);
    expect(resultIds).toContain(2);
    // Plus 2 from today's tie group
    expect(result).toHaveLength(5);
  });

  it('correctly parses slash-separated dates (Safari compatibility)', () => {
    // Safari returns Invalid Date for new Date('YYYY/MM/DD'); parseDueDate must
    // split the string manually so words are selected on iOS.
    const past = makeWord(1, '你', '2026/02/20');
    const today = makeWord(2, '好', '2026/02/27');
    const future = makeWord(3, '学', '2026/03/10');
    const result = chooseTestSet([past, today, future], 10);
    expect(result).toHaveLength(2);
    expect(result.map((w) => w.id).sort()).toEqual([1, 2]);
  });

  it('correctly parses hyphen-separated dates', () => {
    const past = makeWord(1, '你', '2026-02-20');
    const future = makeWord(2, '好', '2026-03-10');
    const result = chooseTestSet([past, future], 10);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns distinct words (no duplicates)', () => {
    const words = Array.from({ length: 5 }, (_, i) => makeWord(i, `字${i}`, '2026/02/20'));
    const result = chooseTestSet(words, 5);
    const ids = result.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('assignQA', () => {
  const word: Word = {
    id: 1,
    simp: '你好',
    trad: '妳好',
    pinyin: 'nǐ hǎo',
    meaning: 'hello/hi',
  };
  const testSet = [word];

  it('returns character (simp) as answer for aCategory=C, simp charSet', () => {
    const pairs = [{ index: '0', aCategory: 'C' as const, qCategory: 'M' as const }];
    const result = assignQA(testSet, pairs, 'simp');
    expect(result.answer).toBe('你好');
    expect(result.answerCategory).toBe('character');
  });

  it('returns character (trad) as answer for aCategory=C, trad charSet', () => {
    const pairs = [{ index: '0', aCategory: 'C' as const, qCategory: 'P' as const }];
    const result = assignQA(testSet, pairs, 'trad');
    expect(result.answer).toBe('妳好');
    expect(result.chosenCharacter).toBe('妳好');
  });

  it('returns pinyin as answer for aCategory=P', () => {
    const pairs = [{ index: '0', aCategory: 'P' as const, qCategory: 'C' as const }];
    const result = assignQA(testSet, pairs, 'simp');
    expect(result.answer).toBe('nǐ hǎo');
    expect(result.answerCategory).toBe('pinyin');
  });

  it('returns meaning array as answer for aCategory=M', () => {
    const pairs = [{ index: '0', aCategory: 'M' as const, qCategory: 'C' as const }];
    const result = assignQA(testSet, pairs, 'simp');
    expect(result.answer).toEqual(['hello', 'hi']);
    expect(result.answerCategory).toBe('meaning');
  });

  it('returns meaning array as question for qCategory=M', () => {
    const pairs = [{ index: '0', aCategory: 'C' as const, qCategory: 'M' as const }];
    const result = assignQA(testSet, pairs, 'simp');
    expect(result.question).toEqual(['hello', 'hi']);
    expect(result.questionCategory).toBe('meaning');
  });

  it('returns pinyin as question for qCategory=P', () => {
    const pairs = [{ index: '0', aCategory: 'C' as const, qCategory: 'P' as const }];
    const result = assignQA(testSet, pairs, 'simp');
    expect(result.question).toBe('nǐ hǎo');
    expect(result.questionCategory).toBe('pinyin');
  });

  it('returns character as question for qCategory=C', () => {
    const pairs = [{ index: '0', aCategory: 'M' as const, qCategory: 'C' as const }];
    const result = assignQA(testSet, pairs, 'simp');
    expect(result.question).toBe('你好');
    expect(result.questionCategory).toBe('character');
  });

  it('returns the pair that was selected', () => {
    const pair = { index: '0', aCategory: 'C' as const, qCategory: 'M' as const };
    const result = assignQA(testSet, [pair], 'simp');
    expect(result.pair).toBe(pair);
  });

  it('takes the head of the queue, not a random entry', () => {
    const queue = [
      { index: '0', aCategory: 'P' as const, qCategory: 'C' as const },
      { index: '0', aCategory: 'C' as const, qCategory: 'M' as const },
      { index: '0', aCategory: 'M' as const, qCategory: 'P' as const },
    ];
    // planSession already ordered the queue, so this is deterministic.
    for (let i = 0; i < 20; i++) {
      const result = assignQA(testSet, queue, 'simp');
      expect(result.pair).toBe(queue[0]);
    }
  });
});

describe('toneChecker', () => {
  it('returns true when input exactly matches answer', () => {
    expect(toneChecker('ni hao', 'ni hao')).toBe(true);
  });

  it('strips tone digits from both input and answer before comparing', () => {
    expect(toneChecker('ni3 hao3', 'ni hao')).toBe(true);
    expect(toneChecker('ni3hao3', 'nihao')).toBe(true);
  });

  it('strips digits from the answer side too', () => {
    expect(toneChecker('ni hao', 'ni3 hao3')).toBe(true);
  });

  it('returns false when stripped strings differ', () => {
    expect(toneChecker('hello', 'world')).toBe(false);
    expect(toneChecker('ni3 hao3', 'ni ma')).toBe(false);
  });

  it('returns true for empty strings', () => {
    expect(toneChecker('', '')).toBe(true);
  });
});

describe('Counter', () => {
  it('counts occurrences of each value', () => {
    expect(Counter(['a', 'b', 'a', 'c', 'a', 'b'])).toEqual({
      a: 3,
      b: 2,
      c: 1,
    });
  });

  it('returns empty object for empty array', () => {
    expect(Counter([])).toEqual({});
  });

  it('handles single-item array', () => {
    expect(Counter(['x'])).toEqual({ x: 1 });
  });

  it('counts all distinct values', () => {
    const result = Counter(['yes', 'no', 'yes', 'maybe', 'no', 'yes']);
    expect(result.yes).toBe(3);
    expect(result.no).toBe(2);
    expect(result.maybe).toBe(1);
  });
});

describe('removePunctuation', () => {
  it('lowercases the input', () => {
    expect(removePunctuation('Hello World')).toBe('hello world');
  });

  it('removes periods and commas', () => {
    expect(removePunctuation('hello, world.')).toBe('hello world');
  });

  it('removes exclamation marks and hash', () => {
    expect(removePunctuation('hello! #test')).toBe('hello test');
  });

  it('collapses multiple spaces into one', () => {
    expect(removePunctuation('hello  world')).toBe('hello world');
  });

  it('handles a clean string without changes (beyond lowercasing)', () => {
    expect(removePunctuation('hello world')).toBe('hello world');
  });

  it('removes slashes', () => {
    expect(removePunctuation('hello/world')).toBe('helloworld');
  });
});

// ---------------------------------------------------------------------------
// planSession — the session queue (issue #328 rules 1-8; closes #306)
// ---------------------------------------------------------------------------
describe('planSession', () => {
  const TODAY = new Date(2026, 2, 10);
  const past = '2026/03/01';
  const older = '2026/02/20';
  const soon = '2026/03/09';
  const future = '2026/12/01';

  /** A word with an explicit state for each direction. */
  function wordWith(
    id: number,
    directions: Partial<Record<string, { level: number; dueDate: string }>>,
    fallbackLevel = 3,
  ): Word {
    const full = DIRECTIONS.reduce<Record<string, { level: number; dueDate: string }>>(
      (acc, direction) => {
        acc[direction] = directions[direction] ?? { level: fallbackLevel, dueDate: future };
        return acc;
      },
      {},
    );
    const earliest = DIRECTIONS.map((d) => full[d].dueDate).sort()[0];
    return {
      id,
      simp: `字${id}`,
      trad: `字${id}`,
      pinyin: 'zì',
      meaning: 'char',
      level: Math.min(...DIRECTIONS.map((d) => full[d].level)),
      due_date: earliest,
      directions: full as Word['directions'],
    };
  }

  /** A word past its first pass, with all five directions due on the same day. */
  function allDue(id: number, dueDate = past): Word {
    return wordWith(
      id,
      DIRECTIONS.reduce<Record<string, { level: number; dueDate: string }>>((acc, d) => {
        acc[d] = { level: 2, dueDate };
        return acc;
      }, {}),
    );
  }

  /** A word that has never been answered correctly in any direction. */
  function newWord(id: number, dueDate = past): Word {
    return wordWith(
      id,
      DIRECTIONS.reduce<Record<string, { level: number; dueDate: string }>>((acc, d) => {
        acc[d] = { level: 1, dueDate };
        return acc;
      }, {}),
      1,
    );
  }

  const plan = (candidates: Word[], overrides = {}) =>
    planSession(candidates, {
      budget: 25,
      includeHandwriting: true,
      now: TODAY,
      ...overrides,
    });

  const directionsIn = (result: ReturnType<typeof planSession>) =>
    result.queue.map((pair) => `${pair.aCategory}${pair.qCategory}`);

  // ─── Rule 2: one direction per word. This is issue #306. ─────────────────

  it('asks a word at most once, however many of its directions are due', () => {
    const word = wordWith(1, {
      MC: { level: 2, dueDate: past },
      MP: { level: 2, dueDate: past },
      PM: { level: 2, dueDate: past },
      PC: { level: 2, dueDate: past },
      CM: { level: 2, dueDate: past },
    });

    const result = plan([word]);

    expect(result.queue).toHaveLength(1);
  });

  it('takes the direction with the oldest due date when several are due', () => {
    const word = wordWith(1, {
      PC: { level: 2, dueDate: past },
      CM: { level: 2, dueDate: older },
      MP: { level: 2, dueDate: past },
    });

    expect(directionsIn(plan([word]))).toEqual(['CM']);
  });

  it('varies the direction across words whose directions are all in step', () => {
    const words = Array.from({ length: 40 }, (_, i) => allDue(i));

    const seen = new Set(directionsIn(plan(words, { budget: 40 })));

    // The fixed order this replaces made this exactly one, for every session,
    // which is the fault in issue #328 comment 5416130923.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('does not favour the first direction of DIRECTIONS among tied ones', () => {
    const words = Array.from({ length: 40 }, (_, i) => allDue(i));

    const asked = directionsIn(plan(words, { budget: 40 }));

    expect(asked.filter((direction) => direction === 'MC').length).toBeLessThan(asked.length);
  });

  it('asks the same word the same direction twice on one day', () => {
    const words = Array.from({ length: 20 }, (_, i) => allDue(i));

    // The budget cut needs a session that survives a reload, so the tie-break
    // is seeded rather than random.
    expect(directionsIn(plan(words, { budget: 20 }))).toEqual(
      directionsIn(plan(words, { budget: 20 })),
    );
  });

  it('asks the one direction that is due when the other four are not', () => {
    const word = wordWith(1, { CM: { level: 2, dueDate: past } });

    expect(directionsIn(plan([word]))).toEqual(['CM']);
  });

  it('leaves out a word with no due direction', () => {
    const word = wordWith(1, {});

    expect(plan([word]).queue).toHaveLength(0);
  });

  // ─── Rule 1: oldest due date first ───────────────────────────────────────

  it('orders review pairs by due date, oldest first', () => {
    const older = wordWith(1, { MC: { level: 2, dueDate: past } });
    const newer = wordWith(2, { MC: { level: 2, dueDate: soon } });

    const result = plan([newer, older]);

    expect(result.words[parseInt(result.queue[0].index)].id).toBe(1);
    expect(result.words[parseInt(result.queue[1].index)].id).toBe(2);
  });

  // ─── Rule 6: stop at the budget ──────────────────────────────────────────

  it('stops at the budget', () => {
    const words = Array.from({ length: 30 }, (_, i) =>
      wordWith(i, { MC: { level: 2, dueDate: past } }),
    );

    expect(plan(words, { budget: 8 }).queue).toHaveLength(8);
  });

  it('gives a shorter session when the due words run out first', () => {
    const words = Array.from({ length: 3 }, (_, i) =>
      wordWith(i, { MC: { level: 2, dueDate: past } }),
    );

    expect(plan(words, { budget: 25 }).queue).toHaveLength(3);
  });

  it('returns an empty plan for a budget of zero', () => {
    expect(plan([wordWith(1, { MC: { level: 2, dueDate: past } })], { budget: 0 }).queue).toEqual(
      [],
    );
  });

  // ─── Rule 4: a new word takes one direction, like any other word ─────────

  it('asks a new word once, not once per direction', () => {
    const result = plan([newWord(1)]);

    expect(result.queue).toHaveLength(1);
    expect(result.newWords.map((w) => w.id)).toEqual([1]);
  });

  it('asks a new word only in a direction the session asks', () => {
    const result = plan([newWord(1)], { includeHandwriting: false });

    expect(result.queue).toHaveLength(1);
    expect(directionsIn(result)).not.toContain('CM');
  });

  it('varies the direction across new words', () => {
    const words = Array.from({ length: 40 }, (_, i) => newWord(i));

    const seen = new Set(directionsIn(plan(words, { budget: 40 })));

    // The five directions of a new word are all at level 1 and share one due
    // date, so they are all tied and the tie-break settles it.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('leaves the four directions it did not ask for a later session', () => {
    const result = plan([newWord(1)]);

    expect(result.queue).toHaveLength(1);
  });

  // ─── Rule 5: the due date is the only rank ───────────────────────────────

  it('puts the older new word before the newer review word', () => {
    const review = wordWith(1, { MC: { level: 2, dueDate: past } });

    const result = plan([review, newWord(2, older)]);

    expect(result.words[parseInt(result.queue[0].index)].id).toBe(2);
    expect(result.words[parseInt(result.queue[1].index)].id).toBe(1);
  });

  it('puts the older review word before the newer new word', () => {
    const review = wordWith(1, { MC: { level: 2, dueDate: older } });

    const result = plan([newWord(2, past), review]);

    expect(result.words[parseInt(result.queue[0].index)].id).toBe(1);
    expect(result.words[parseInt(result.queue[1].index)].id).toBe(2);
  });

  it('admits at most five new words, however large the budget is', () => {
    const words = Array.from({ length: 9 }, (_, i) => newWord(i));

    const result = plan(words, { budget: 100 });

    expect(result.newWords).toHaveLength(5);
    expect(result.queue).toHaveLength(5);
  });

  it('admits the five oldest new words', () => {
    const oldest = Array.from({ length: 5 }, (_, i) => newWord(i, older));
    const newer = Array.from({ length: 4 }, (_, i) => newWord(i + 10, past));

    const result = plan([...newer, ...oldest], { budget: 100 });

    expect(result.newWords.map((word) => word.id).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it('gives the question a passed-over new word would have had to a review word', () => {
    const news = Array.from({ length: 8 }, (_, i) => newWord(i, older));
    const reviews = Array.from({ length: 5 }, (_, i) =>
      wordWith(i + 10, { MC: { level: 2, dueDate: past } }),
    );

    // The new words are all due before every review word, so without the cap
    // they would take the first 8 questions of the 10.
    const result = plan([...news, ...reviews], { budget: 10 });

    expect(result.newWords).toHaveLength(5);
    expect(result.queue).toHaveLength(10);
  });

  it('caps the new words in practice too', () => {
    const words = Array.from({ length: 9 }, (_, i) => newWord(i, future));

    const result = plan(words, { budget: 100, practiceMode: true });

    expect(result.newWords).toHaveLength(5);
  });

  it('cuts the review words that are newer than the new words at the budget', () => {
    const reviews = Array.from({ length: 10 }, (_, i) =>
      wordWith(i + 10, { MC: { level: 2, dueDate: past } }),
    );

    // The three new words are due before every review word, so they take the
    // first three questions and the budget cuts three review words.
    const result = plan([...reviews, newWord(1, older), newWord(2, older), newWord(3, older)], {
      budget: 12,
    });

    expect(result.newWords).toHaveLength(3);
    expect(result.queue).toHaveLength(12);
    expect(
      result.words
        .slice(0, 3)
        .map((word) => word.id)
        .sort(),
    ).toEqual([1, 2, 3]);
  });

  it('admits no new word when older review words take the whole budget', () => {
    const reviews = Array.from({ length: 12 }, (_, i) =>
      wordWith(i + 10, { MC: { level: 2, dueDate: older } }),
    );

    const result = plan([...reviews, newWord(1, past)], { budget: 12 });

    expect(result.newWords).toHaveLength(0);
    expect(result.queue).toHaveLength(12);
  });

  it('leaves out a new word that is not due yet', () => {
    const result = plan([newWord(1, future)]);

    expect(result.queue).toHaveLength(0);
    expect(result.newWords).toHaveLength(0);
  });

  // ─── Rule 7: priority and onlyPriority ───────────────────────────────────

  it('takes the priority direction when it shares the oldest due date', () => {
    const word = wordWith(1, {
      MC: { level: 2, dueDate: past },
      PC: { level: 2, dueDate: past },
    });

    expect(directionsIn(plan([word], { priority: 'PC' }))).toEqual(['PC']);
  });

  it('takes the priority direction for every word that is still in step', () => {
    const words = Array.from({ length: 20 }, (_, i) => allDue(i));

    const asked = directionsIn(plan(words, { priority: 'PC', budget: 20 }));

    expect(asked.every((direction) => direction === 'PC')).toBe(true);
  });

  it('leaves the priority direction out when an older direction is due', () => {
    const word = wordWith(1, {
      MC: { level: 2, dueDate: older },
      PC: { level: 2, dueDate: past },
    });

    // A direction that falls behind outranks the priority, so no direction
    // starves. See docs/adr/0004-priority-breaks-ties-only.md.
    expect(directionsIn(plan([word], { priority: 'PC' }))).toEqual(['MC']);
  });

  it('ranks by due date when the priority direction is not due', () => {
    const word = wordWith(1, { MC: { level: 2, dueDate: past } });

    expect(directionsIn(plan([word], { priority: 'PC' }))).toEqual(['MC']);
  });

  it('onlyPriority filters the queue to that one direction', () => {
    const asked = wordWith(1, { PC: { level: 2, dueDate: past } });
    const notAsked = wordWith(2, { MC: { level: 2, dueDate: past } });

    const result = plan([asked, notAsked], { priority: 'PC', onlyPriority: true });

    expect(directionsIn(result)).toEqual(['PC']);
  });

  it('asks each admitted new word exactly once', () => {
    const result = plan([newWord(1), newWord(2)], { budget: 25 });

    expect(result.queue.map((pair) => pair.index)).toEqual(['0', '1']);
  });

  it('onlyPriority asks a new word in that one direction', () => {
    const result = plan([newWord(1)], { priority: 'PC', onlyPriority: true });

    expect(directionsIn(result)).toEqual(['PC']);
  });

  // ─── Rule 8: practice mode ───────────────────────────────────────────────

  it('practice ignores due dates and still asks each word once', () => {
    const notDue = wordWith(1, {});
    const alsoNotDue = wordWith(2, {});

    const result = plan([notDue, alsoNotDue], { practiceMode: true });

    expect(result.queue).toHaveLength(2);
  });

  it('practice varies the direction rather than always asking the first', () => {
    const words = Array.from({ length: 40 }, (_, i) => wordWith(i, {}));

    const seen = new Set(directionsIn(plan(words, { practiceMode: true, budget: 40 })));

    // Random per word: 40 words hitting only one of five directions is
    // vanishingly unlikely, and always-MC would make this exactly one.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('practice respects the handwriting setting', () => {
    const words = Array.from({ length: 40 }, (_, i) => wordWith(i, {}));

    const result = plan(words, { practiceMode: true, budget: 40, includeHandwriting: false });

    expect(directionsIn(result)).not.toContain('CM');
  });

  // ─── Words a word list of legacy shape ───────────────────────────────────

  it('falls back to the word due date when a word has no directions map', () => {
    const legacy: Word = {
      id: 1,
      simp: '你',
      trad: '你',
      pinyin: 'nǐ',
      meaning: 'you',
      level: 3,
      due_date: past,
    };

    expect(plan([legacy]).queue).toHaveLength(1);
  });
});
