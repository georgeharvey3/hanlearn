import { describe, it, expect } from 'vitest';

import { DIRECTIONS, Direction, Word } from '../types/models';
import { makeDirections } from './directions';
import {
  PracticeByWord,
  buildSet,
  gatedWords,
  hasNeverPractised,
  recordPractice,
} from './sentenceQueue';

// Wednesday 4 November 2026, mid-morning.
const NOW = new Date(2026, 10, 4, 10, 0);

/** A day key `days` days after NOW, in the format the word documents use. */
const inDays = (days: number): string => {
  const date = new Date(2026, 10, 4 + days);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
};

let nextId = 1;
const word = (
  simp: string,
  level: number,
  dueInDays = 10,
  overrides: Partial<Record<Direction, { level?: number; dueInDays?: number }>> = {},
): Word => {
  const directions = makeDirections(level, inDays(dueInDays));
  for (const direction of DIRECTIONS) {
    const over = overrides[direction];
    if (!over) continue;
    directions[direction] = {
      level: over.level ?? level,
      dueDate: inDays(over.dueInDays ?? dueInDays),
    };
  }
  return {
    id: nextId++,
    simp,
    trad: simp,
    pinyin: '',
    meaning: '',
    level: Math.min(...Object.values(directions).map((d) => d.level)),
    due_date: inDays(dueInDays),
    directions,
  };
};

const at = (days: number, hour = 9): string => new Date(2026, 10, 4 + days, hour).toISOString();

describe('the words a tab may use', () => {
  const index = { 学: ['a'], 书: ['b'], 吃: ['c'], 喝: ['d'] };

  it('keeps the words that pass the gate of the tab', () => {
    const one = word('学', 1);
    const two = word('书', 2);
    const three = word('吃', 3);

    expect(gatedWords([one, two, three], 'comprehend', NOW)).toEqual([two, three]);
    expect(gatedWords([one, two, three], 'compose', NOW)).toEqual([three]);
  });

  it('reads the four recall directions and not CM', () => {
    const weakRecall = word('学', 3, 10, { PM: { level: 1 } });
    const weakHandwriting = word('书', 3, 10, { CM: { level: 1 } });

    expect(gatedWords([weakRecall, weakHandwriting], 'compose', NOW)).toEqual([weakHandwriting]);
  });

  it('leaves out a word with a direction due today or tomorrow, overdue included', () => {
    const overdue = word('学', 3, 10, { MC: { dueInDays: -3 } });
    const today = word('书', 3, 10, { CM: { dueInDays: 0 } });
    const tomorrow = word('吃', 3, 10, { PC: { dueInDays: 1 } });
    const later = word('喝', 3, 2);

    expect(gatedWords([overdue, today, tomorrow, later], 'comprehend', NOW)).toEqual([later]);
  });

  it('leaves out a word with no example sentence', () => {
    const withSentence = word('学', 3);
    const without = word('无', 3);

    const set = buildSet({
      words: [withSentence, without],
      practice: {},
      index,
      tab: 'comprehend',
      size: 5,
      now: NOW,
    });
    expect(set.map((task) => task.word)).toEqual([withSentence]);
  });
});

describe('the order of a set', () => {
  it('puts a wrong last grade first, then never practised, then a right last grade', () => {
    const right = word('学', 3);
    const fresh = word('书', 3);
    const wrong = word('吃', 3);
    const practice: PracticeByWord = {
      [right.id]: { comprehend: { lastPractised: at(-5), lastResult: 'right', seen: {} } },
      [wrong.id]: { comprehend: { lastPractised: at(-1), lastResult: 'wrong', seen: {} } },
    };

    const set = buildSet({
      words: [right, fresh, wrong],
      practice,
      index: { 学: ['a'], 书: ['b'], 吃: ['c'] },
      tab: 'comprehend',
      size: 5,
      now: NOW,
    });
    expect(set.map((task) => task.word.simp)).toEqual(['吃', '书', '学']);
  });

  it('takes the oldest practice first among the wrong and among the right', () => {
    const words = ['一', '二', '三', '四'].map((simp) => word(simp, 3));
    const entry = (days: number, lastResult: 'right' | 'wrong') => ({
      comprehend: { lastPractised: at(days), lastResult, seen: {} },
    });
    const practice: PracticeByWord = {
      [words[0].id]: entry(-1, 'right'),
      [words[1].id]: entry(-4, 'right'),
      [words[2].id]: entry(-1, 'wrong'),
      [words[3].id]: entry(-6, 'wrong'),
    };

    const set = buildSet({
      words,
      practice,
      index: { 一: ['a'], 二: ['b'], 三: ['c'], 四: ['d'] },
      tab: 'comprehend',
      size: 5,
      now: NOW,
    });
    expect(set.map((task) => task.word.simp)).toEqual(['四', '三', '二', '一']);
  });

  it('takes the lowest level first among the words never practised', () => {
    const high = word('一', 5);
    const low = word('二', 2);
    const mid = word('三', 3);

    const set = buildSet({
      words: [high, low, mid],
      practice: {},
      index: { 一: ['a'], 二: ['b'], 三: ['c'] },
      tab: 'comprehend',
      size: 5,
      now: NOW,
    });
    expect(set.map((task) => task.word.simp)).toEqual(['二', '三', '一']);
  });

  it('keeps a miss first after a big import of new words', () => {
    const missed = word('错', 3);
    const imported = Array.from({ length: 50 }, (_, i) => word(`新${i}`, 2));
    const index: Record<string, string[]> = { 错: ['x'] };
    for (const w of imported) index[w.simp] = [`s-${w.simp}`];
    const practice: PracticeByWord = {
      [missed.id]: { comprehend: { lastPractised: at(-1), lastResult: 'wrong', seen: {} } },
    };

    const set = buildSet({
      words: [...imported, missed],
      practice,
      index,
      tab: 'comprehend',
      size: 5,
      now: NOW,
    });
    expect(set[0].word).toBe(missed);
  });

  it('reads the practice of its own tab only', () => {
    const composedWrong = word('学', 3);
    const fresh = word('书', 2);
    const practice: PracticeByWord = {
      [composedWrong.id]: { compose: { lastPractised: at(-1), lastResult: 'wrong', seen: {} } },
    };

    const set = buildSet({
      words: [composedWrong, fresh],
      practice,
      index: { 学: ['a'], 书: ['b'] },
      tab: 'comprehend',
      size: 5,
      now: NOW,
    });
    // Both are never practised in Comprehend, so the lower level comes first.
    expect(set.map((task) => task.word.simp)).toEqual(['书', '学']);
  });

  it('holds the set to its size', () => {
    const words = ['一', '二', '三'].map((simp) => word(simp, 3));
    const set = buildSet({
      words,
      practice: {},
      index: { 一: ['a'], 二: ['b'], 三: ['c'] },
      tab: 'compose',
      size: 2,
      now: NOW,
    });
    expect(set).toHaveLength(2);
  });
});

describe('the sentence of a task', () => {
  const study = word('学', 3);
  const index = { 学: ['first', 'second', 'third'] };

  it('takes a sentence never seen before one that was seen', () => {
    const practice: PracticeByWord = {
      [study.id]: {
        comprehend: { lastPractised: at(-1), lastResult: 'right', seen: { first: at(-1) } },
      },
    };
    const [task] = buildSet({
      words: [study],
      practice,
      index,
      tab: 'comprehend',
      size: 1,
      now: NOW,
    });
    expect(task.sentenceId).toBe('second');
  });

  it('takes the sentence seen longest ago when every one was seen', () => {
    const practice: PracticeByWord = {
      [study.id]: {
        comprehend: {
          lastPractised: at(-1),
          lastResult: 'right',
          seen: { first: at(-1), second: at(-9), third: at(-3) },
        },
      },
    };
    const [task] = buildSet({
      words: [study],
      practice,
      index,
      tab: 'comprehend',
      size: 1,
      now: NOW,
    });
    expect(task.sentenceId).toBe('second');
  });
});

describe('whether a tab has a word never practised there', () => {
  const index = { 学: ['a'], 书: ['b'] };

  it('is true for an eligible word with no practice in the tab', () => {
    const study = word('学', 3);
    const practice: PracticeByWord = {
      [study.id]: { compose: { lastPractised: at(-1), lastResult: 'right', seen: {} } },
    };
    expect(
      hasNeverPractised({ words: [study], practice, index, tab: 'comprehend', now: NOW }),
    ).toBe(true);
    expect(hasNeverPractised({ words: [study], practice, index, tab: 'compose', now: NOW })).toBe(
      false,
    );
  });

  it('is false when the only fresh word is not eligible', () => {
    const due = word('学', 3, 1);
    const noSentence = word('无', 3);
    expect(
      hasNeverPractised({
        words: [due, noSentence],
        practice: {},
        index,
        tab: 'comprehend',
        now: NOW,
      }),
    ).toBe(false);
  });
});

describe('recording a grade', () => {
  it('sets the result and the date, and adds the sentence to the seen ones', () => {
    const before: PracticeByWord = {
      '7': {
        comprehend: { lastPractised: at(-3), lastResult: 'right', seen: { a: at(-3) } },
        compose: { lastPractised: at(-2), lastResult: 'right', seen: {} },
      },
    };
    const after = recordPractice(before, {
      wordId: 7,
      tab: 'comprehend',
      sentenceId: 'b',
      result: 'wrong',
      at: NOW,
    });

    expect(after['7'].comprehend).toEqual({
      lastPractised: NOW.toISOString(),
      lastResult: 'wrong',
      seen: { a: at(-3), b: NOW.toISOString() },
    });
    expect(after['7'].compose).toBe(before['7'].compose);
    // The state before is left as it was.
    expect(before['7'].comprehend?.lastResult).toBe('right');
  });
});
