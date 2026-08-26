import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  chooseTestSet,
  chooseRandomTestSet,
  setPermList,
  assignQA,
  toneChecker,
  Counter,
  removePunctuation,
  directionsOf,
} from './TestLogic';
import { Word } from '../../../types/models';

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

describe('chooseRandomTestSet', () => {
  it('includes all words regardless of due_date', () => {
    const words = [
      makeWord(1, '你', '2099/01/01'), // far future
      makeWord(2, '好'), // no due_date
      makeWord(3, '学', '2020/01/01'), // past
    ];
    const result = chooseRandomTestSet(words, 3);
    expect(result).toHaveLength(3);
  });

  it('caps at numWords', () => {
    const words = Array.from({ length: 10 }, (_, i) => makeWord(i, `字${i}`));
    const result = chooseRandomTestSet(words, 4);
    expect(result).toHaveLength(4);
  });

  it('returns all words when numWords exceeds word list size', () => {
    const words = [makeWord(1, '你'), makeWord(2, '好')];
    const result = chooseRandomTestSet(words, 20);
    expect(result).toHaveLength(2);
  });

  it('returns distinct words (no duplicates)', () => {
    const words = Array.from({ length: 5 }, (_, i) => makeWord(i, `字${i}`));
    const result = chooseRandomTestSet(words, 5);
    const ids = result.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('setPermList', () => {
  const twoWords = [makeWord(1, '你'), makeWord(2, '好')];

  it('creates 4 Q/A combinations per word when handwriting excluded', () => {
    const perms = setPermList(twoWords, false);
    // 2 words × 4 combinations (PC, PM, MP, MC) = 8
    expect(perms).toHaveLength(8);
  });

  it('creates 5 Q/A combinations per word when handwriting included', () => {
    const perms = setPermList(twoWords, true);
    // 2 words × 5 combinations (CM, PC, PM, MP, MC) = 10
    expect(perms).toHaveLength(10);
  });

  it('each perm has index, aCategory, qCategory fields', () => {
    const perms = setPermList([makeWord(0, '你')], false);
    perms.forEach((p) => {
      expect(p).toHaveProperty('index');
      expect(p).toHaveProperty('aCategory');
      expect(p).toHaveProperty('qCategory');
    });
  });

  it('filters to only priority perms when onlyPriority=true', () => {
    const perms = setPermList(twoWords, false, 'PC', true);
    // aCategory='P', qCategory='C' — one perm per word
    expect(perms).toHaveLength(2);
    perms.forEach((p) => {
      expect(p.aCategory).toBe('P');
      expect(p.qCategory).toBe('C');
    });
  });

  it('returns all perms when onlyPriority=false even with priority set', () => {
    const perms = setPermList(twoWords, false, 'PC', false);
    expect(perms).toHaveLength(8);
  });

  it('returns empty array for empty test set', () => {
    const perms = setPermList([], false);
    expect(perms).toHaveLength(0);
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
    const perms = [{ index: '0', aCategory: 'C' as const, qCategory: 'M' as const }];
    const result = assignQA(testSet, perms, 'simp');
    expect(result.answer).toBe('你好');
    expect(result.answerCategory).toBe('character');
  });

  it('returns character (trad) as answer for aCategory=C, trad charSet', () => {
    const perms = [{ index: '0', aCategory: 'C' as const, qCategory: 'P' as const }];
    const result = assignQA(testSet, perms, 'trad');
    expect(result.answer).toBe('妳好');
    expect(result.chosenCharacter).toBe('妳好');
  });

  it('returns pinyin as answer for aCategory=P', () => {
    const perms = [{ index: '0', aCategory: 'P' as const, qCategory: 'C' as const }];
    const result = assignQA(testSet, perms, 'simp');
    expect(result.answer).toBe('nǐ hǎo');
    expect(result.answerCategory).toBe('pinyin');
  });

  it('returns meaning array as answer for aCategory=M', () => {
    const perms = [{ index: '0', aCategory: 'M' as const, qCategory: 'C' as const }];
    const result = assignQA(testSet, perms, 'simp');
    expect(result.answer).toEqual(['hello', 'hi']);
    expect(result.answerCategory).toBe('meaning');
  });

  it('returns meaning array as question for qCategory=M', () => {
    const perms = [{ index: '0', aCategory: 'C' as const, qCategory: 'M' as const }];
    const result = assignQA(testSet, perms, 'simp');
    expect(result.question).toEqual(['hello', 'hi']);
    expect(result.questionCategory).toBe('meaning');
  });

  it('returns pinyin as question for qCategory=P', () => {
    const perms = [{ index: '0', aCategory: 'C' as const, qCategory: 'P' as const }];
    const result = assignQA(testSet, perms, 'simp');
    expect(result.question).toBe('nǐ hǎo');
    expect(result.questionCategory).toBe('pinyin');
  });

  it('returns character as question for qCategory=C', () => {
    const perms = [{ index: '0', aCategory: 'M' as const, qCategory: 'C' as const }];
    const result = assignQA(testSet, perms, 'simp');
    expect(result.question).toBe('你好');
    expect(result.questionCategory).toBe('character');
  });

  it('returns the perm that was selected', () => {
    const perm = { index: '0', aCategory: 'C' as const, qCategory: 'M' as const };
    const result = assignQA(testSet, [perm], 'simp');
    expect(result.perm).toBe(perm);
  });

  it('prefers priority perms when priority is set and matches exist', () => {
    const permList = [
      { index: '0', aCategory: 'P' as const, qCategory: 'C' as const },
      { index: '0', aCategory: 'C' as const, qCategory: 'M' as const },
      { index: '0', aCategory: 'M' as const, qCategory: 'P' as const },
    ];
    // Run many times to confirm priority perm is always chosen
    for (let i = 0; i < 20; i++) {
      const result = assignQA(testSet, permList, 'simp', 'PC');
      expect(result.answerCategory).toBe('pinyin');
      expect(result.questionCategory).toBe('character');
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

describe('directionsOf', () => {
  it('returns the distinct directions of a perm list, in order', () => {
    const permList = setPermList([makeWord(1, '你'), makeWord(2, '好')], true);

    expect(directionsOf(permList)).toEqual(['CM', 'PC', 'PM', 'MP', 'MC']);
  });

  it('leaves out handwriting when the session does not ask it', () => {
    const permList = setPermList([makeWord(1, '你')], false);

    expect(directionsOf(permList)).not.toContain('CM');
    expect(directionsOf(permList)).toHaveLength(4);
  });

  it('returns the single direction that onlyPriority leaves', () => {
    const permList = setPermList([makeWord(1, '你')], true, 'PC', true);

    expect(directionsOf(permList)).toEqual(['PC']);
  });

  it('returns an empty list for an empty perm list', () => {
    expect(directionsOf([])).toEqual([]);
  });
});
